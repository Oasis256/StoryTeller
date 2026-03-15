const Path = require('path')
const EventEmitter = require('events')
const express = require('express')
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const fs = require('../libs/fsExtra')
const StreamZip = require('../libs/nodeStreamZip')

const Logger = require('../Logger')

const DEFAULT_ENTRY_FILES = ['abs-plugin.js', 'index.js']
const PLUGIN_ID_REGEX = /^[a-z0-9][a-z0-9-_.]*$/

class PluginManager {
  constructor() {
    this.Server = null
    this.lifecycleEvents = new EventEmitter()
    this.plugins = []
    this.socketHandlers = []
    this.apiRoutes = []
    this.uiSlotContributions = {}
    this.staticMounts = []
    this.hasLoaded = false
    this.rootRouter = null
    this.authMiddleware = null
    this.mountedApiRouteKeys = new Set()
    this.mountedStaticRouteKeys = new Set()
    this.activeRuntimeTokens = {}
    this.currentRegisteringPlugin = null

    this.slowHandlerThresholdMs = this.toNumber(process.env.ABS_PLUGIN_SLOW_MS, 100)
    this.metrics = {
      startup: {
        discovered: 0,
        loaded: 0,
        failed: 0,
        totalLoadMs: 0,
        plugins: {}
      },
      lifecycle: {},
      socket: {},
      http: {},
      updatedAt: null
    }
  }

  /**
   * @param {import('../Server')} Server
   */
  async initialize(Server) {
    this.Server = Server

    const pluginEntries = this.getPluginEntries()
    this.metrics.startup.discovered = pluginEntries.length

    if (!pluginEntries.length) {
      this.hasLoaded = true
      Logger.info('[PluginManager] No plugins discovered')
      return
    }

    Logger.info(`[PluginManager] Discovering ${pluginEntries.length} plugin(s)`)

    for (const entryPath of pluginEntries) {
      await this.loadPlugin(entryPath)
    }

    this.hasLoaded = true
    this.metrics.startup.loaded = this.plugins.length
    Logger.info(`[PluginManager] Loaded ${this.plugins.length}/${pluginEntries.length} plugin(s)`)
    Logger.info(`[PluginManager] Startup load time ${this.metrics.startup.totalLoadMs.toFixed(2)}ms`)
  }

  getPluginsDirectories() {
    if (process.env.ABS_PLUGIN_DIR) {
      return [Path.resolve(process.env.ABS_PLUGIN_DIR)]
    }

    const directories = [Path.join(global.ConfigPath, 'plugins')]
    if (global.appRoot) {
      directories.push(Path.join(global.appRoot, 'plugins'))
    }
    return directories
  }

  getPluginEntries() {
    const pluginEntries = []
    for (const pluginRoot of this.getPluginsDirectories()) {
      if (!fs.pathExistsSync(pluginRoot)) continue

      const dirEntries = fs.readdirSync(pluginRoot, { withFileTypes: true })
      for (const entry of dirEntries) {
        const fullPath = Path.join(pluginRoot, entry.name)
        if (entry.isFile() && entry.name.endsWith('.js')) {
          pluginEntries.push(fullPath)
          continue
        }

        if (!entry.isDirectory()) continue

        const entryFile = DEFAULT_ENTRY_FILES.find((filename) => fs.pathExistsSync(Path.join(fullPath, filename)))
        if (entryFile) {
          pluginEntries.push(Path.join(fullPath, entryFile))
        }
      }
    }

    return [...new Set(pluginEntries)].sort((a, b) => a.localeCompare(b))
  }

  async loadPlugin(entryPath) {
    const startNs = this.nowNs()

    try {
      const loadedModule = require(entryPath)
      const plugin = loadedModule?.default || loadedModule
      if (!plugin || typeof plugin !== 'object') {
        Logger.warn(`[PluginManager] Skipping ${entryPath}. Expected module to export an object`)
        this.metrics.startup.failed++
        return
      }

      if (typeof plugin.register !== 'function') {
        Logger.warn(`[PluginManager] Skipping ${entryPath}. Missing register(context) function`)
        this.metrics.startup.failed++
        return
      }

      const pluginId = this.resolvePluginId(plugin, entryPath)
      if (!PLUGIN_ID_REGEX.test(pluginId)) {
        Logger.warn(`[PluginManager] Skipping ${entryPath}. Invalid plugin id "${pluginId}"`)
        this.metrics.startup.failed++
        return
      }

      if (this.plugins.some((p) => p.id === pluginId)) {
        Logger.warn(`[PluginManager] Skipping ${entryPath}. Duplicate plugin id "${pluginId}"`)
        this.metrics.startup.failed++
        return
      }

      const pluginLogger = this.createPluginLogger(pluginId)
      const context = this.createPluginContext(pluginId, pluginLogger, entryPath)
      const runtimeToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      this.currentRegisteringPlugin = {
        pluginId,
        runtimeToken
      }

      const registration = await plugin.register(context)
      this.currentRegisteringPlugin = null
      const record = {
        id: pluginId,
        name: plugin.name || pluginId,
        version: plugin.version || '0.0.0',
        description: plugin.description || '',
        entryPath,
        dispose: typeof registration?.dispose === 'function' ? registration.dispose : null,
        raw: plugin,
        runtimeToken
      }

      this.plugins.push(record)
      this.activeRuntimeTokens[pluginId] = runtimeToken
      const durationMs = this.elapsedMs(startNs)
      this.metrics.startup.totalLoadMs += durationMs
      this.metrics.startup.plugins[pluginId] = {
        loadMs: durationMs,
        entryPath
      }
      this.metrics.updatedAt = Date.now()
      pluginLogger.info(`Loaded v${record.version} from ${entryPath} (${durationMs.toFixed(2)}ms)`)
      if (this.rootRouter && this.authMiddleware) {
        this.mountPluginRuntimeArtifacts(pluginId)
      }
    } catch (error) {
      this.currentRegisteringPlugin = null
      this.metrics.startup.failed++
      const durationMs = this.elapsedMs(startNs)
      this.metrics.startup.totalLoadMs += durationMs
      Logger.error(`[PluginManager] Failed to load plugin ${entryPath}`, error)
      if (process.env.ABS_PLUGINS_STRICT === '1') {
        throw error
      }
    }
  }

  resolvePluginId(plugin, entryPath) {
    if (plugin.id && typeof plugin.id === 'string') {
      return plugin.id.trim().toLowerCase()
    }

    const parentName = Path.basename(Path.dirname(entryPath)).trim().toLowerCase()
    if (parentName && DEFAULT_ENTRY_FILES.includes(Path.basename(entryPath))) {
      return parentName
    }

    return Path.basename(entryPath, Path.extname(entryPath)).trim().toLowerCase()
  }

  createPluginLogger(pluginId) {
    const prefix = `[Plugin:${pluginId}]`
    return {
      debug: (...args) => Logger.debug(prefix, ...args),
      info: (...args) => Logger.info(prefix, ...args),
      warn: (...args) => Logger.warn(prefix, ...args),
      error: (...args) => Logger.error(prefix, ...args)
    }
  }

  createPluginContext(pluginId, logger, entryPath) {
    const pluginDir = Path.dirname(entryPath)
    return {
      id: pluginId,
      logger,
      server: this.Server,
      express,
      lifecycle: {
        on: (eventName, handler) => this.onLifecycleEvent(pluginId, eventName, handler),
        emit: (eventName, payload) => this.emitLifecycleEvent(eventName, payload)
      },
      http: {
        registerApiRoute: (mountPath, router, options = {}) => this.registerApiRoute(pluginId, mountPath, router, options)
      },
      ui: {
        registerSlot: (slot, contribution) => this.registerUiSlot(pluginId, slot, contribution),
        registerStaticAssets: (relativeDir = 'public', mountPath = '/assets') => this.registerStaticAssets(pluginId, pluginDir, relativeDir, mountPath)
      },
      socket: {
        on: (eventName, handler, options = {}) => this.registerSocketHandler(pluginId, eventName, handler, options)
      }
    }
  }

  onLifecycleEvent(pluginId, eventName, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Plugin ${pluginId} lifecycle handler for "${eventName}" must be a function`)
    }
    this.lifecycleEvents.on(eventName, async (payload) => {
      const metricKey = `${pluginId}:${eventName}`
      const startNs = this.nowNs()
      try {
        await handler(payload)
        const durationMs = this.elapsedMs(startNs)
        this.recordMetric(this.metrics.lifecycle, metricKey, durationMs)
        this.logSlowHandler('lifecycle', metricKey, durationMs)
      } catch (error) {
        const durationMs = this.elapsedMs(startNs)
        this.recordMetric(this.metrics.lifecycle, metricKey, durationMs, true)
        Logger.error(`[PluginManager] Plugin ${pluginId} lifecycle handler failed for "${eventName}"`, error)
      }
    })
  }

  async emitLifecycleEvent(eventName, payload) {
    const listeners = this.lifecycleEvents.listeners(eventName)
    for (const listener of listeners) {
      try {
        await listener(payload)
      } catch (error) {
        Logger.error(`[PluginManager] Failed to emit lifecycle event "${eventName}"`, error)
      }
    }
  }

  registerApiRoute(pluginId, mountPath, router, options = {}) {
    if (!router || typeof router.use !== 'function') {
      throw new Error(`Plugin ${pluginId} registerApiRoute expected an express router`)
    }

    const normalizedPath = this.normalizeMountPath(mountPath)
    this.apiRoutes.push({
      pluginId,
      mountPath: normalizedPath,
      router,
      authRequired: options.authRequired !== false,
      runtimeToken: this.currentRegisteringPlugin?.pluginId === pluginId ? this.currentRegisteringPlugin.runtimeToken : this.activeRuntimeTokens[pluginId] || null
    })
  }

  isPluginActive(pluginId) {
    return this.plugins.some((plugin) => plugin.id === pluginId)
  }

  isPluginRuntimeActive(pluginId, runtimeToken) {
    if (!this.isPluginActive(pluginId)) return false
    if (!runtimeToken) return true
    return this.activeRuntimeTokens[pluginId] === runtimeToken
  }

  registerSocketHandler(pluginId, eventName, handler, options = {}) {
    if (!eventName || typeof eventName !== 'string') {
      throw new Error(`Plugin ${pluginId} socket event name must be a non-empty string`)
    }
    if (typeof handler !== 'function') {
      throw new Error(`Plugin ${pluginId} socket handler for "${eventName}" must be a function`)
    }

    this.socketHandlers.push({
      pluginId,
      eventName,
      handler,
      authRequired: options.authRequired !== false,
      runtimeToken: this.currentRegisteringPlugin?.pluginId === pluginId ? this.currentRegisteringPlugin.runtimeToken : this.activeRuntimeTokens[pluginId] || null
    })
  }

  registerUiSlot(pluginId, slot, contribution = {}) {
    if (!slot || typeof slot !== 'string') {
      throw new Error(`Plugin ${pluginId} ui slot must be a non-empty string`)
    }
    if (!contribution || typeof contribution !== 'object') {
      throw new Error(`Plugin ${pluginId} ui contribution for "${slot}" must be an object`)
    }
    if (!contribution.componentName || typeof contribution.componentName !== 'string') {
      throw new Error(`Plugin ${pluginId} ui contribution for "${slot}" requires componentName`)
    }

    const slotContributions = this.uiSlotContributions[slot] || []
    slotContributions.push({
      pluginId,
      componentName: contribution.componentName,
      scriptUrl: contribution.scriptUrl || null,
      styleUrl: contribution.styleUrl || null,
      order: Number.isFinite(Number(contribution.order)) ? Number(contribution.order) : 100,
      props: contribution.props || {},
      runtimeToken: this.currentRegisteringPlugin?.pluginId === pluginId ? this.currentRegisteringPlugin.runtimeToken : this.activeRuntimeTokens[pluginId] || null
    })
    slotContributions.sort((a, b) => a.order - b.order)
    this.uiSlotContributions[slot] = slotContributions
  }

  registerStaticAssets(pluginId, pluginDir, relativeDir = 'public', mountPath = '/assets') {
    const staticDir = Path.resolve(pluginDir, relativeDir)
    if (!fs.pathExistsSync(staticDir)) {
      throw new Error(`Plugin ${pluginId} static assets path does not exist: ${staticDir}`)
    }

    const normalizedMountPath = this.normalizeMountPath(mountPath)
    this.staticMounts.push({
      pluginId,
      staticDir,
      mountPath: normalizedMountPath || '/assets',
      runtimeToken: this.currentRegisteringPlugin?.pluginId === pluginId ? this.currentRegisteringPlugin.runtimeToken : this.activeRuntimeTokens[pluginId] || null
    })
  }

  isAdmin(req) {
    return !!req?.user?.isAdminOrUp
  }

  getPrimaryPluginInstallDir() {
    if (process.env.ABS_PLUGIN_DIR) return Path.resolve(process.env.ABS_PLUGIN_DIR)
    return Path.join(global.ConfigPath, 'plugins')
  }

  getBundledPluginsDir() {
    if (!global.appRoot) return null
    return Path.join(global.appRoot, 'plugins')
  }

  getPluginEntryInDir(pluginDir) {
    for (const filename of DEFAULT_ENTRY_FILES) {
      const entryPath = Path.join(pluginDir, filename)
      if (fs.pathExistsSync(entryPath)) return entryPath
    }
    return null
  }

  discoverInstalledPlugins() {
    const installDir = this.getPrimaryPluginInstallDir()
    if (!fs.pathExistsSync(installDir)) return []

    const entries = fs.readdirSync(installDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => {
        const pluginId = entry.name.trim().toLowerCase()
        if (!PLUGIN_ID_REGEX.test(pluginId)) return null

        const pluginDir = Path.join(installDir, entry.name)
        const entryPath = this.getPluginEntryInDir(pluginDir)
        if (!entryPath) return null

        const loadedPlugin = this.plugins.find((plugin) => plugin.id === pluginId) || null
        return {
          id: pluginId,
          installDir: pluginDir,
          installEntryPath: entryPath,
          loaded: !!loadedPlugin,
          name: loadedPlugin?.name || pluginId,
          version: loadedPlugin?.version || null,
          description: loadedPlugin?.description || ''
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  discoverBundledPlugins() {
    const bundledDir = this.getBundledPluginsDir()
    if (!bundledDir || !fs.pathExistsSync(bundledDir)) return []

    const entries = fs.readdirSync(bundledDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const pluginId = entry.name.trim().toLowerCase()
        if (!PLUGIN_ID_REGEX.test(pluginId)) return null

        const pluginDir = Path.join(bundledDir, entry.name)
        const entryPath = this.getPluginEntryInDir(pluginDir)
        if (!entryPath) return null

        const installPath = Path.join(this.getPrimaryPluginInstallDir(), pluginId)
        const installed = fs.pathExistsSync(installPath)
        const loaded = this.plugins.some((plugin) => plugin.id === pluginId)
        const loadedPlugin = this.plugins.find((plugin) => plugin.id === pluginId) || null

        return {
          id: pluginId,
          sourceDir: pluginDir,
          sourceEntryPath: entryPath,
          installDir: installPath,
          installed,
          loaded,
          name: loadedPlugin?.name || pluginId,
          version: loadedPlugin?.version || null,
          description: loadedPlugin?.description || ''
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  runPluginHook(pluginDir, hookName) {
    const hookPath = Path.join(pluginDir, hookName)
    if (!fs.pathExistsSync(hookPath)) return
    try {
      const stats = fs.statSync(hookPath)
      if (!stats.isFile()) return
    } catch (error) {
      Logger.warn(`[PluginManager] Failed to stat plugin hook "${hookPath}"`, error)
      return
    }

    const result = spawnSync(hookPath, [], {
      env: {
        ...process.env,
        PLUGIN_DIR: pluginDir,
        CONFIG_PATH: global.ConfigPath || '',
        ABS_PLUGIN_DIR: process.env.ABS_PLUGIN_DIR || ''
      },
      stdio: 'pipe',
      encoding: 'utf8',
      shell: false
    })

    if (result.status !== 0) {
      throw new Error(`Plugin hook "${hookName}" failed for "${pluginDir}" with code ${result.status}: ${result.stderr || result.stdout || 'unknown error'}`)
    }
  }

  installBundledPlugin(pluginId, force = false) {
    if (!PLUGIN_ID_REGEX.test(pluginId)) {
      throw new Error(`Invalid plugin id "${pluginId}"`)
    }

    const bundledPlugin = this.discoverBundledPlugins().find((plugin) => plugin.id === pluginId)
    if (!bundledPlugin) {
      throw new Error(`Bundled plugin "${pluginId}" not found`)
    }

    const payload = this.installPluginFromSource(pluginId, bundledPlugin.sourceDir, force)
    return {
      ...payload,
      source: 'bundled'
    }
  }

  installPluginFromSource(pluginId, sourceDir, force = false) {
    if (!PLUGIN_ID_REGEX.test(pluginId)) {
      throw new Error(`Invalid plugin id "${pluginId}"`)
    }
    if (!fs.pathExistsSync(sourceDir)) {
      throw new Error(`Plugin source does not exist: "${sourceDir}"`)
    }

    const targetBase = this.getPrimaryPluginInstallDir()
    const targetDir = Path.join(targetBase, pluginId)
    const backupRoot = Path.join(targetBase, '.plugin-backups')
    const timestamp = Date.now()

    fs.ensureDirSync(targetBase)
    fs.ensureDirSync(backupRoot)

    if (fs.pathExistsSync(targetDir)) {
      if (!force) {
        throw new Error(`Plugin "${pluginId}" already installed. Pass force=1 to replace.`)
      }
      const backupDir = Path.join(backupRoot, `${pluginId}-preinstall-${timestamp}`)
      fs.moveSync(targetDir, backupDir, { overwrite: false })
    }

    fs.copySync(sourceDir, targetDir, { overwrite: true, errorOnExist: false })
    this.runPluginHook(targetDir, 'install.sh')

    return {
      pluginId,
      installedDir: targetDir,
      restartRequired: false
    }
  }

  async prepareUploadedPlugin(uploadedFile, explicitPluginId = null) {
    if (!uploadedFile || !uploadedFile.name || typeof uploadedFile.mv !== 'function') {
      throw new Error('Plugin upload is missing')
    }

    const extension = Path.extname(uploadedFile.name || '').toLowerCase()
    if (extension !== '.zip') {
      throw new Error('Only .zip plugin packages are supported')
    }

    const installDir = this.getPrimaryPluginInstallDir()
    const tempRoot = Path.join(installDir, '.plugin-upload-temp', `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`)
    const archivePath = Path.join(tempRoot, 'upload.zip')
    const extractRoot = Path.join(tempRoot, 'extract')

    await fs.ensureDir(tempRoot)
    await uploadedFile.mv(archivePath)

    let zip = null
    try {
      zip = new StreamZip.async({ file: archivePath })
      const entries = await zip.entries()
      const entryNames = Object.keys(entries).filter((entryName) => !entries[entryName].isDirectory)
      if (!entryNames.length) {
        throw new Error('Plugin archive has no files')
      }

      await fs.ensureDir(extractRoot)
      for (const entryName of entryNames) {
        const normalized = entryName.replace(/\\/g, '/')
        if (normalized.includes('..') || normalized.startsWith('/')) {
          throw new Error(`Unsafe archive path "${entryName}"`)
        }
        const outputPath = Path.join(extractRoot, normalized)
        await fs.ensureDir(Path.dirname(outputPath))
        await zip.extract(entryName, outputPath)
      }

      const discoveredSourceDir = this.resolvePluginSourceDir(extractRoot)
      if (!discoveredSourceDir) {
        throw new Error('Could not find plugin entry file (abs-plugin.js or index.js) in uploaded archive')
      }

      const sourceEntryPath = this.getPluginEntryInDir(discoveredSourceDir)
      if (!sourceEntryPath) {
        throw new Error('Uploaded plugin package is missing an entry file')
      }

      const detectedPluginId = this.resolvePluginIdFromEntry(sourceEntryPath)
      const pluginId = explicitPluginId?.trim()?.toLowerCase() || detectedPluginId
      if (!PLUGIN_ID_REGEX.test(pluginId)) {
        throw new Error(`Invalid plugin id "${pluginId}"`)
      }

      return {
        tempRoot,
        archivePath,
        sourceDir: discoveredSourceDir,
        sourceEntryPath,
        pluginId,
        detectedPluginId,
        uploadedFilename: uploadedFile.name
      }
    } finally {
      if (zip) {
        try {
          await zip.close()
        } catch (error) {
          Logger.warn('[PluginManager] Failed to close uploaded plugin archive', error)
        }
      }
    }
  }

  async validateUploadedPlugin(uploadedFile, explicitPluginId = null) {
    let prepared = null
    try {
      prepared = await this.prepareUploadedPlugin(uploadedFile, explicitPluginId)
      return {
        valid: true,
        pluginId: prepared.pluginId,
        detectedPluginId: prepared.detectedPluginId,
        uploadedFilename: prepared.uploadedFilename,
        entryFile: Path.basename(prepared.sourceEntryPath),
        installDir: Path.join(this.getPrimaryPluginInstallDir(), prepared.pluginId)
      }
    } finally {
      if (prepared?.tempRoot) {
        await fs.remove(prepared.tempRoot)
      }
    }
  }

  async installUploadedPlugin(uploadedFile, force = false, explicitPluginId = null) {
    let prepared = null
    try {
      prepared = await this.prepareUploadedPlugin(uploadedFile, explicitPluginId)
      const installPayload = this.installPluginFromSource(prepared.pluginId, prepared.sourceDir, force)
      return {
        ...installPayload,
        pluginId: prepared.pluginId,
        source: 'upload'
      }
    } finally {
      if (prepared?.tempRoot) {
        await fs.remove(prepared.tempRoot)
      }
    }
  }

  resolvePluginSourceDir(extractRoot) {
    if (this.getPluginEntryInDir(extractRoot)) return extractRoot

    const dirEntries = fs.readdirSync(extractRoot, { withFileTypes: true })
    for (const entry of dirEntries) {
      if (!entry.isDirectory()) continue
      const candidateDir = Path.join(extractRoot, entry.name)
      if (this.getPluginEntryInDir(candidateDir)) return candidateDir
    }
    return null
  }

  resolvePluginIdFromEntry(entryPath) {
    const loadedModule = require(entryPath)
    const plugin = loadedModule?.default || loadedModule
    const pluginId = this.resolvePluginId(plugin || {}, entryPath)
    this.clearRequireCacheForPath(Path.dirname(entryPath))
    return pluginId
  }

  clearRequireCacheForPath(rootPath) {
    const normalizedRoot = Path.resolve(rootPath)
    for (const cacheKey of Object.keys(require.cache)) {
      if (cacheKey.startsWith(normalizedRoot)) {
        delete require.cache[cacheKey]
      }
    }
  }

  async enableInstalledPlugin(pluginId, options = {}) {
    if (!PLUGIN_ID_REGEX.test(pluginId)) {
      throw new Error(`Invalid plugin id "${pluginId}"`)
    }

    const reload = !!options.reload
    if (reload && this.isPluginActive(pluginId)) {
      await this.disablePlugin(pluginId)
    } else if (this.isPluginActive(pluginId)) {
      return {
        pluginId,
        alreadyLoaded: true,
        loaded: true
      }
    }

    const targetDir = Path.join(this.getPrimaryPluginInstallDir(), pluginId)
    if (!fs.pathExistsSync(targetDir)) {
      throw new Error(`Plugin "${pluginId}" is not installed`)
    }
    const entryPath = this.getPluginEntryInDir(targetDir)
    if (!entryPath) {
      throw new Error(`Plugin "${pluginId}" has no entry file`)
    }

    const beforeCount = this.plugins.length
    await this.loadPlugin(entryPath)
    const loaded = this.plugins.length > beforeCount && this.isPluginActive(pluginId)
    if (!loaded) {
      throw new Error(`Plugin "${pluginId}" failed to load`)
    }

    return {
      pluginId,
      loaded: true,
      reloaded: reload
    }
  }

  async disablePlugin(pluginId) {
    if (!PLUGIN_ID_REGEX.test(pluginId)) {
      throw new Error(`Invalid plugin id "${pluginId}"`)
    }

    const targetPlugin = this.plugins.find((plugin) => plugin.id === pluginId)
    if (!targetPlugin) {
      return {
        pluginId,
        loaded: false,
        alreadyDisabled: true
      }
    }

    if (targetPlugin.dispose) {
      try {
        await targetPlugin.dispose({ server: this.Server })
      } catch (error) {
        Logger.error(`[PluginManager] Failed disposing plugin ${pluginId}`, error)
      }
    }

    this.plugins = this.plugins.filter((plugin) => plugin.id !== pluginId)
    this.socketHandlers = this.socketHandlers.filter((handler) => handler.pluginId !== pluginId)
    this.apiRoutes = this.apiRoutes.filter((route) => route.pluginId !== pluginId)
    this.staticMounts = this.staticMounts.filter((mount) => mount.pluginId !== pluginId)
    for (const slotName of Object.keys(this.uiSlotContributions)) {
      const kept = (this.uiSlotContributions[slotName] || []).filter((contrib) => contrib.pluginId !== pluginId)
      if (kept.length) this.uiSlotContributions[slotName] = kept
      else delete this.uiSlotContributions[slotName]
    }

    this.clearRequireCacheForPath(Path.join(this.getPrimaryPluginInstallDir(), pluginId))
    delete this.activeRuntimeTokens[pluginId]
    return {
      pluginId,
      loaded: false
    }
  }

  async uninstallPlugin(pluginId, purge = false) {
    if (!PLUGIN_ID_REGEX.test(pluginId)) {
      throw new Error(`Invalid plugin id "${pluginId}"`)
    }

    const targetBase = this.getPrimaryPluginInstallDir()
    const targetDir = Path.join(targetBase, pluginId)
    if (!fs.pathExistsSync(targetDir)) {
      throw new Error(`Plugin "${pluginId}" is not installed`)
    }

    await this.disablePlugin(pluginId)
    this.runPluginHook(targetDir, 'uninstall.sh')

    if (purge) {
      fs.removeSync(targetDir)
      return {
        pluginId,
        removedDir: targetDir,
        purged: true,
        restartRequired: false
      }
    }

    const backupRoot = Path.join(targetBase, '.plugin-backups')
    const backupDir = Path.join(backupRoot, `${pluginId}-uninstall-${Date.now()}`)
    fs.ensureDirSync(backupRoot)
    fs.moveSync(targetDir, backupDir, { overwrite: false })
    return {
      pluginId,
      archivedDir: backupDir,
      purged: false,
      restartRequired: false
    }
  }

  getAdminOverview() {
    const installDir = this.getPrimaryPluginInstallDir()
    const bundledDir = this.getBundledPluginsDir()
    const availablePlugins = this.discoverBundledPlugins()
    const installedPlugins = this.discoverInstalledPlugins()
    const loadedPlugins = this.plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description
    }))

    return {
      installDir,
      bundledDir,
      restartRequired: false,
      loadedPlugins,
      installedPlugins,
      availablePlugins
    }
  }

  mountPluginApiRoute(route) {
    const routePath = `/api/plugins/${route.pluginId}${route.mountPath}`
    const routeKey = `${route.pluginId}|${route.mountPath}|${route.runtimeToken || 'legacy'}`
    if (this.mountedApiRouteKeys.has(routeKey)) return

    const measuredRouter = express.Router()
    measuredRouter.use((req, res, next) => {
      if (!this.isPluginRuntimeActive(route.pluginId, route.runtimeToken)) {
        return next()
      }

      const startNs = this.nowNs()
      res.on('finish', () => {
        const durationMs = this.elapsedMs(startNs)
        const metricKey = `${route.pluginId}:${req.method} ${req.path || '/'} (${res.statusCode})`
        this.recordMetric(this.metrics.http, metricKey, durationMs)
        this.logSlowHandler('http', metricKey, durationMs)
      })
      next()
    })
    measuredRouter.use(route.router)

    if (route.authRequired) {
      this.rootRouter.use(routePath, this.authMiddleware, measuredRouter)
    } else {
      this.rootRouter.use(routePath, measuredRouter)
    }

    this.mountedApiRouteKeys.add(routeKey)
    Logger.info(`[PluginManager] Mounted plugin API route ${routePath}`)
  }

  mountPluginStaticAssets(staticMount) {
    const staticRoute = `/plugins-assets/${staticMount.pluginId}${staticMount.mountPath}`
    const routeKey = `${staticMount.pluginId}|${staticMount.mountPath}|${staticMount.runtimeToken || 'legacy'}`
    if (this.mountedStaticRouteKeys.has(routeKey)) return

    const staticRouter = express.Router()
    staticRouter.use((req, res, next) => {
      if (!this.isPluginRuntimeActive(staticMount.pluginId, staticMount.runtimeToken)) {
        return next()
      }
      return next()
    })
    staticRouter.use(express.static(staticMount.staticDir))
    this.rootRouter.use(staticRoute, staticRouter)

    this.mountedStaticRouteKeys.add(routeKey)
    Logger.info(`[PluginManager] Mounted plugin static assets ${staticRoute} -> ${staticMount.staticDir}`)
  }

  mountPluginRuntimeArtifacts(pluginId = null) {
    const apiRoutes = pluginId ? this.apiRoutes.filter((route) => route.pluginId === pluginId) : this.apiRoutes
    const staticMounts = pluginId ? this.staticMounts.filter((mount) => mount.pluginId === pluginId) : this.staticMounts

    for (const staticMount of staticMounts) {
      this.mountPluginStaticAssets(staticMount)
    }
    for (const route of apiRoutes) {
      this.mountPluginApiRoute(route)
    }
  }

  mountHttpRoutes(rootRouter, authMiddleware) {
    this.rootRouter = rootRouter
    this.authMiddleware = authMiddleware

    const listRouter = express.Router()
    listRouter.get('/', (req, res) => {
      const payload = {
        plugins: this.plugins.map((plugin) => ({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          description: plugin.description
        }))
      }

      if (req.query.metrics === '1' && req.user?.isAdminOrUp) {
        payload.metrics = this.getMetricsSnapshot()
      }

      res.json(payload)
    })

    rootRouter.use('/api/plugins', authMiddleware, listRouter)

    const adminRouter = express.Router()
    adminRouter.use((req, res, next) => {
      if (!this.isAdmin(req)) return res.sendStatus(403)
      next()
    })
    adminRouter.get('/overview', (req, res) => {
      res.json(this.getAdminOverview())
    })
    adminRouter.post('/install/:pluginId', (req, res) => {
      const force = req.body?.force === 1 || req.body?.force === '1' || req.body?.force === true
      Promise.resolve()
        .then(() => this.installBundledPlugin(req.params.pluginId, force))
        .then((payload) => this.enableInstalledPlugin(req.params.pluginId).then(() => payload))
        .then((payload) => {
          res.json({
            success: true,
            ...payload,
            loaded: this.isPluginActive(req.params.pluginId)
          })
        })
        .catch((error) => {
          res.status(400).json({
            success: false,
            error: error.message || 'Install failed'
          })
        })
    })
    adminRouter.post('/install-upload', (req, res) => {
      const pluginFile = req.files?.file
      const force = req.body?.force === 1 || req.body?.force === '1' || req.body?.force === true
      const pluginId = req.body?.pluginId || null
      this.installUploadedPlugin(pluginFile, force, pluginId)
        .then((payload) => this.enableInstalledPlugin(payload.pluginId).then(() => payload))
        .then((payload) => {
          res.json({
            success: true,
            ...payload,
            loaded: this.isPluginActive(payload.pluginId)
          })
        })
        .catch((error) => {
          res.status(400).json({
            success: false,
            error: error.message || 'Install upload failed'
          })
        })
    })
    adminRouter.post('/validate-upload', (req, res) => {
      const pluginFile = req.files?.file
      const pluginId = req.body?.pluginId || null
      this.validateUploadedPlugin(pluginFile, pluginId)
        .then((payload) => {
          res.json({
            success: true,
            ...payload
          })
        })
        .catch((error) => {
          res.status(400).json({
            success: false,
            error: error.message || 'Validation failed'
          })
        })
    })
    adminRouter.post('/enable/:pluginId', (req, res) => {
      this.enableInstalledPlugin(req.params.pluginId)
        .then((payload) => {
          res.json({
            success: true,
            ...payload
          })
        })
        .catch((error) => {
          res.status(400).json({
            success: false,
            error: error.message || 'Enable failed'
          })
        })
    })
    adminRouter.post('/disable/:pluginId', (req, res) => {
      this.disablePlugin(req.params.pluginId)
        .then((payload) => {
          res.json({
            success: true,
            ...payload
          })
        })
        .catch((error) => {
          res.status(400).json({
            success: false,
            error: error.message || 'Disable failed'
          })
        })
    })
    adminRouter.post('/reload/:pluginId', (req, res) => {
      this.enableInstalledPlugin(req.params.pluginId, { reload: true })
        .then((payload) => {
          res.json({
            success: true,
            ...payload
          })
        })
        .catch((error) => {
          res.status(400).json({
            success: false,
            error: error.message || 'Reload failed'
          })
        })
    })
    adminRouter.post('/uninstall/:pluginId', (req, res) => {
      const purge = req.body?.purge === 1 || req.body?.purge === '1' || req.body?.purge === true
      this.uninstallPlugin(req.params.pluginId, purge)
        .then((payload) => {
          res.json({
            success: true,
            ...payload
          })
        })
        .catch((error) => {
          res.status(400).json({
            success: false,
            error: error.message || 'Uninstall failed'
          })
        })
    })
    rootRouter.use('/api/plugins/admin', authMiddleware, adminRouter)

    const uiRouter = express.Router()
    uiRouter.get('/slots/:slot', (req, res) => {
      const slot = req.params.slot
      const contributions = (this.uiSlotContributions[slot] || []).filter((contribution) => this.isPluginRuntimeActive(contribution.pluginId, contribution.runtimeToken))
      res.json({
        slot,
        contributions
      })
    })
    rootRouter.use('/api/plugins/ui', authMiddleware, uiRouter)

    this.mountPluginRuntimeArtifacts()
  }

  bindSocketHandlers(socket, getClient) {
    for (const socketHandler of this.socketHandlers) {
      socket.on(socketHandler.eventName, async (payload, ack) => {
        if (!this.isPluginRuntimeActive(socketHandler.pluginId, socketHandler.runtimeToken)) return
        const client = getClient()
        if (socketHandler.authRequired && !client?.user) {
          if (typeof ack === 'function') {
            ack({ success: false, error: 'Unauthorized' })
          }
          return
        }

        const metricKey = `${socketHandler.pluginId}:${socketHandler.eventName}`
        const startNs = this.nowNs()

        try {
          await socketHandler.handler({
            payload,
            ack,
            socket,
            user: client?.user || null,
            client,
            server: this.Server
          })
          const durationMs = this.elapsedMs(startNs)
          this.recordMetric(this.metrics.socket, metricKey, durationMs)
          this.logSlowHandler('socket', metricKey, durationMs)
        } catch (error) {
          const durationMs = this.elapsedMs(startNs)
          this.recordMetric(this.metrics.socket, metricKey, durationMs, true)
          Logger.error(`[PluginManager] Socket handler failed for ${socketHandler.pluginId}/${socketHandler.eventName}`, error)
          if (typeof ack === 'function') {
            ack({ success: false, error: 'Plugin socket handler failed' })
          }
        }
      })
    }
  }

  normalizeMountPath(pathname) {
    if (!pathname || pathname === '/') return ''
    const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`
    if (prefixed.endsWith('/')) return prefixed.slice(0, -1)
    return prefixed
  }

  getMetricsSnapshot() {
    return {
      startup: this.metrics.startup,
      lifecycle: this.metrics.lifecycle,
      socket: this.metrics.socket,
      http: this.metrics.http,
      updatedAt: this.metrics.updatedAt
    }
  }

  recordMetric(targetMap, key, durationMs, isError = false) {
    if (!targetMap[key]) {
      targetMap[key] = {
        calls: 0,
        errors: 0,
        totalMs: 0,
        avgMs: 0,
        maxMs: 0,
        lastMs: 0,
        lastAt: 0
      }
    }

    const metric = targetMap[key]
    metric.calls++
    metric.totalMs += durationMs
    metric.avgMs = metric.totalMs / metric.calls
    metric.maxMs = Math.max(metric.maxMs, durationMs)
    metric.lastMs = durationMs
    metric.lastAt = Date.now()

    if (isError) {
      metric.errors++
    }

    this.metrics.updatedAt = metric.lastAt
  }

  logSlowHandler(kind, key, durationMs) {
    if (durationMs < this.slowHandlerThresholdMs) return
    Logger.warn(`[PluginManager] Slow ${kind} handler ${key} (${durationMs.toFixed(2)}ms)`)
  }

  nowNs() {
    return process.hrtime.bigint()
  }

  elapsedMs(startNs) {
    const elapsedNs = process.hrtime.bigint() - startNs
    return Number(elapsedNs) / 1e6
  }

  toNumber(value, fallback) {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }

  async shutdown() {
    for (const plugin of this.plugins) {
      if (!plugin.dispose) continue

      const metricKey = `${plugin.id}:dispose`
      const startNs = this.nowNs()
      try {
        await plugin.dispose({ server: this.Server })
        const durationMs = this.elapsedMs(startNs)
        this.recordMetric(this.metrics.lifecycle, metricKey, durationMs)
        this.logSlowHandler('lifecycle', metricKey, durationMs)
      } catch (error) {
        const durationMs = this.elapsedMs(startNs)
        this.recordMetric(this.metrics.lifecycle, metricKey, durationMs, true)
        Logger.error(`[PluginManager] Failed to dispose plugin ${plugin.id}`, error)
      }
    }
  }
}

module.exports = PluginManager
