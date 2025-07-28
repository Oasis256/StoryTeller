// utils/upcoming/metadataCacheStorageManager.js
// Storage manager with proper permissions handling for Docker environments

const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const Logger = require('../../Logger')

class MetadataCacheStorageManager {
  constructor(metadataCacheDir = '/metadata/cache') {
    // Use the existing metadata cache directory structure
    this.metadataCacheDir = metadataCacheDir
    this.baseUpcomingDir = path.join(metadataCacheDir, 'upcoming')
    this.defaultTTL = 24 * 60 * 60 * 1000 // 24 hours
    this.operationLocks = new Map()

    // Docker/permission settings - use standard 1000:1000
    this.isDockerEnvironment = this.detectDockerEnvironment()
    this.nodeUid = 1000 // Standard Docker node UID
    this.nodeGid = 1000 // Standard Docker node GID

    // Logger.info(`[MetadataCacheStorage 1.0] Initialized with base path: ${this.baseUpcomingDir}`)
    // Logger.info(`[MetadataCacheStorage 1.1] Docker environment: ${this.isDockerEnvironment}`)
    // Logger.info(`[MetadataCacheStorage 1.2] Using standard UID/GID: 1000:1000`)
  }

  /**
   * Detects if running in Docker environment
   */
  detectDockerEnvironment() {
    try {
      // Check for Docker-specific files/environment
      return (
        process.env.DOCKER === 'true' || require('fs').existsSync('/.dockerenv') || process.env.NODE_ENV === 'production' // Assume production is Docker
      )
    } catch {
      return false
    }
  }

  /**
   * Gets the node user UID - defaults to 1000 (standard Docker node user)
   */
  getNodeUid() {
    return 1000 // Standard Docker node UID
  }

  /**
   * Gets the node user GID - defaults to 1000 (standard Docker node group)
   */
  getNodeGid() {
    return 1000 // Standard Docker node GID
  }

  /**
   * Sets proper ownership using direct numeric UID/GID (most reliable in Docker)
   */
  async setOwnership(targetPath) {
    if (!this.isDockerEnvironment) {
      Logger.debug(`[MetadataCacheStorage 2.0] Skipping ownership change - not in Docker`)
      return
    }

    try {
      // Use direct numeric chown - most reliable approach
      execSync(`chown 1000:1000 "${targetPath}"`, {
        stdio: 'pipe',
        timeout: 5000
      })
      Logger.debug(`[MetadataCacheStorage 2.1] Set ownership (1000:1000): ${targetPath}`)
    } catch (error) {
      Logger.debug(`[MetadataCacheStorage 2.2] chown 1000:1000 failed for ${targetPath}: ${error.message}`)
      // Don't throw - permissions might work anyway or be unnecessary
    }
  }

  /**
   * Sets recursive ownership on directories using direct numeric UID/GID
   */
  async setRecursiveOwnership(targetPath) {
    if (!this.isDockerEnvironment) {
      Logger.debug(`[MetadataCacheStorage 3.0] Skipping recursive ownership change - not in Docker`)
      return
    }

    try {
      execSync(`chown 1000:1000 -R "${targetPath}"`, {
        stdio: 'pipe',
        timeout: 15000
      })
      // Logger.info(`[MetadataCacheStorage 3.1] Set recursive ownership (1000:1000): ${targetPath}`)
    } catch (error) {
      // Logger.warn(`[MetadataCacheStorage 3.2] chown 1000:1000 -R failed for ${targetPath}: ${error.message}`)
      // Don't throw - permissions might work anyway
    }
  }

  /**
   * Creates directory with proper permissions
   */
  async createDirectoryWithPermissions(dirPath) {
    try {
      // Create the directory
      await fs.mkdir(dirPath, { recursive: true, mode: 0o755 })

      // Set ownership
      await this.setOwnership(dirPath)

      Logger.debug(`[MetadataCacheStorage 4.0] Created directory with permissions: ${dirPath}`)
      return true
    } catch (error) {
      Logger.error(`[MetadataCacheStorage 4.1] Failed to create directory ${dirPath}: ${error.message}`)
      return false
    }
  }

  /**
   * Factory method to create storage manager using your app's metadata cache directory.
   * This integrates with your existing cache structure.
   */
  static createFromAppConfig(appConfig = {}) {
    // Try to determine metadata cache directory from various sources
    let metadataCacheDir = '/metadata/cache' // Default

    // Option 1: Explicit metadata cache path
    if (appConfig.metadataCacheDir) {
      metadataCacheDir = appConfig.metadataCacheDir
    }
    // Option 2: From metadata path (if it includes 'cache')
    else if (appConfig.MetadataPath && appConfig.MetadataPath.includes('cache')) {
      metadataCacheDir = appConfig.MetadataPath
    }
    // Option 3: Build from metadata path
    else if (appConfig.MetadataPath) {
      metadataCacheDir = path.join(appConfig.MetadataPath, 'cache')
    }
    // Option 4: Environment variable
    else if (process.env.METADATA_CACHE_DIR) {
      metadataCacheDir = process.env.METADATA_CACHE_DIR
    }

    return new MetadataCacheStorageManager(metadataCacheDir)
  }

  /**
   * Gets the directory structure info for a series/author combination.
   * Uses a similar naming pattern to other metadata cache files.
   */
  getStoragePaths(seriesName, authorName, coverExtension = '.jpg') {
    // Create a hash similar to how metadata caches might work
    const hash = crypto.createHash('md5').update(`${seriesName.toLowerCase()}_${authorName.toLowerCase()}`).digest('hex')

    // Create a readable directory name with hash suffix for uniqueness
    const safeName = `${seriesName}_${authorName}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase()
      .substring(0, 40) // Keep reasonable length

    const storageDir = path.join(this.baseUpcomingDir, `${safeName}_${hash.substring(0, 8)}`)

    return {
      directory: storageDir,
      metadataFile: path.join(storageDir, 'upcoming.json'),
      coverFile: path.join(storageDir, `cover${coverExtension}`),
      lockFile: path.join(storageDir, '.processing'),
      // Relative paths for reference
      relativeCoverPath: path.relative(this.metadataCacheDir, path.join(storageDir, `cover${coverExtension}`))
    }
  }

  /**
   * Ensures the base upcoming directory exists and sets proper permissions.
   */
  async ensureBaseDirectory() {
    try {
      // Create base upcoming directory
      await fs.mkdir(this.baseUpcomingDir, { recursive: true, mode: 0o755 })

      // Set ownership recursively on the entire upcoming directory
      await this.setRecursiveOwnership(this.baseUpcomingDir)

      // Create a .gitignore file to exclude upcoming cache from version control
      const gitignorePath = path.join(this.baseUpcomingDir, '.gitignore')
      try {
        await fs.access(gitignorePath)
      } catch {
        await fs.writeFile(gitignorePath, '# Upcoming books cache\n*\n!.gitignore\n')
        await this.setOwnership(gitignorePath)
      }

      return true
    } catch (error) {
      Logger.error(`[MetadataCacheStorage 5.0] Failed to create base directory: ${error}`)
      return false
    }
  }

  /**
   * Stores book data and cover image atomically with proper permissions.
   */
  async storeBookDataWithCover(seriesName, authorName, bookData, coverUrl = null) {
    const storageKey = `${seriesName}_${authorName}`

    // Prevent concurrent operations
    if (this.operationLocks.has(storageKey)) {
      Logger.info(`[MetadataCacheStorage 6.0] Waiting for operation: ${storageKey}`)
      await this.operationLocks.get(storageKey)
    }

    const operationPromise = this._executeStoreOperation(seriesName, authorName, bookData, coverUrl)
    this.operationLocks.set(storageKey, operationPromise)

    try {
      const result = await operationPromise
      return result
    } finally {
      this.operationLocks.delete(storageKey)
    }
  }

  async _executeStoreOperation(seriesName, authorName, bookData, coverUrl) {
    await this.ensureBaseDirectory()

    const coverExtension = coverUrl ? this._getExtensionFromUrl(coverUrl) : '.jpg'
    const paths = this.getStoragePaths(seriesName, authorName, coverExtension)

    try {
      // Create storage directory
      await fs.mkdir(paths.directory, { recursive: true, mode: 0o755 })
      await this.setOwnership(paths.directory)

      // Create processing lock
      await fs.writeFile(
        paths.lockFile,
        JSON.stringify({
          operation: 'store',
          startTime: Date.now(),
          series: seriesName,
          author: authorName
        })
      )
      await this.setOwnership(paths.lockFile)

      let coverInfo = { downloaded: false }

      // Download cover if URL provided
      if (coverUrl) {
        try {
          Logger.info(`[MetadataCacheStorage 7.0] Downloading cover: ${coverUrl}`)
          await this._downloadCover(coverUrl, paths.coverFile)
          await this.setOwnership(paths.coverFile)

          coverInfo = {
            downloaded: true,
            localPath: paths.coverFile,
            relativePath: paths.relativeCoverPath,
            originalUrl: coverUrl,
            fileName: path.basename(paths.coverFile)
          }
          Logger.info(`[MetadataCacheStorage 7.1] Cover downloaded successfully`)
        } catch (error) {
          Logger.error(`[MetadataCacheStorage 7.2] Cover download failed:`, error)
          coverInfo = { downloaded: false, error: error.message }
        }
      }

      // Prepare metadata following your app's cache structure
      const metadata = {
        // Core book data
        bookData: {
          ...bookData,
          // Add local cover path for easy access
          localCoverPath: coverInfo.downloaded ? coverInfo.relativePath : null,
          localCoverFile: coverInfo.downloaded ? coverInfo.fileName : null
        },

        // Cache management
        cache: {
          seriesName,
          authorName,
          cachedAt: Date.now(),
          ttl: this.defaultTTL,
          version: '1.0',
          source: 'risingshadow'
        },

        // Cover management
        cover: coverInfo,

        // File structure info
        files: {
          directory: path.basename(paths.directory),
          metadataFile: 'upcoming.json',
          hasCover: coverInfo.downloaded
        }
      }

      // Write metadata atomically
      const tempFile = `${paths.metadataFile}.tmp`
      await fs.writeFile(tempFile, JSON.stringify(metadata, null, 2))
      await this.setOwnership(tempFile)

      await fs.rename(tempFile, paths.metadataFile)
      await this.setOwnership(paths.metadataFile)

      // Remove processing lock
      await fs.unlink(paths.lockFile).catch(() => {})

      Logger.info(`[MetadataCacheStorage 8.0] Successfully cached: ${seriesName} by ${authorName}`)

      return {
        bookData: metadata.bookData,
        coverPath: coverInfo.downloaded ? coverInfo.localPath : null,
        storagePath: paths.directory,
        cached: true
      }
    } catch (error) {
      // Cleanup on error
      await fs.unlink(paths.lockFile).catch(() => {})
      await this._cleanupFailedStorage(paths)
      Logger.error(`[MetadataCacheStorage 8.1] Store operation failed:`, error)
      throw error
    }
  }

  /**
   * Retrieves cached book data.
   */
  async retrieveBookData(seriesName, authorName) {
    const paths = this.getStoragePaths(seriesName, authorName)

    try {
      // Check for processing lock
      try {
        const lockContent = await fs.readFile(paths.lockFile, 'utf8')
        const lockInfo = JSON.parse(lockContent)
        const lockAge = Date.now() - lockInfo.startTime

        if (lockAge < 300000) {
          // 5 minutes
          Logger.info(`[MetadataCacheStorage 9.0] Operation in progress, waiting...`)
          // Wait up to 30 seconds for lock to clear
          await this._waitForLockClear(paths.lockFile, 30000)
        } else {
          // Stale lock, remove it
          await fs.unlink(paths.lockFile).catch(() => {})
        }
      } catch {
        // No lock file or invalid lock
      }

      // Read metadata
      const metadataContent = await fs.readFile(paths.metadataFile, 'utf8')
      const metadata = JSON.parse(metadataContent)

      // Validate cache freshness
      if (!this._isCacheValid(metadata)) {
        Logger.info(`[MetadataCacheStorage 10.0] Cache expired: ${seriesName} by ${authorName}`)
        await this.removeBookData(seriesName, authorName)
        return null
      }

      // Verify cover file if it should exist
      if (metadata.cover.downloaded) {
        try {
          await fs.access(paths.coverFile)
        } catch {
          // Logger.warn(`[MetadataCacheStorage 11.0] Cover file missing, invalidating cache`)
          await this.removeBookData(seriesName, authorName)
          return null
        }
      }

      Logger.info(`[MetadataCacheStorage 11.1] Retrieved cached data: ${seriesName} by ${authorName}`)
      return metadata.bookData
    } catch (error) {
      if (error.code === 'ENOENT') {
        Logger.debug(`[MetadataCacheStorage 11.2] No cached data found: ${seriesName} by ${authorName}`)
        return null
      }
      Logger.error(`[MetadataCacheStorage 11.3] Error retrieving data:`, error)
      return null
    }
  }

  /**
   * Removes cached book data and all associated files.
   */
  async removeBookData(seriesName, authorName) {
    const paths = this.getStoragePaths(seriesName, authorName)

    try {
      await fs.rm(paths.directory, { recursive: true, force: true })
      // Logger.info(`[MetadataCacheStorage 12.1] Removed cached data: ${seriesName} by ${authorName}`)
    } catch (error) {
      // Logger.error(`[MetadataCacheStorage 12.2] Error removing data:`, error)
    }
  }

  /**
   * Lists all cached upcoming books with metadata.
   */
  async listAllCachedBooks() {
    try {
      await this.ensureBaseDirectory()
      const entries = await fs.readdir(this.baseUpcomingDir, { withFileTypes: true })
      const books = []

      for (const entry of entries.filter((e) => e.isDirectory())) {
        try {
          const metadataPath = path.join(this.baseUpcomingDir, entry.name, 'upcoming.json')
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))

          books.push({
            seriesName: metadata.cache.seriesName,
            authorName: metadata.cache.authorName,
            cachedAt: metadata.cache.cachedAt,
            hasCover: metadata.cover.downloaded,
            valid: this._isCacheValid(metadata),
            directory: entry.name,
            title: metadata.bookData.title,
            releaseDate: metadata.bookData.release
          })
        } catch {
          // Skip invalid entries
        }
      }

      return books.sort((a, b) => b.cachedAt - a.cachedAt) // Most recent first
    } catch {
      return []
    }
  }

  /**
   * Gets cache statistics and health info.
   */
  async getCacheStats() {
    try {
      const books = await this.listAllCachedBooks()
      const validBooks = books.filter((b) => b.valid)
      const expiredBooks = books.filter((b) => !b.valid)
      const booksWithCovers = books.filter((b) => b.hasCover)

      return {
        total: books.length,
        valid: validBooks.length,
        expired: expiredBooks.length,
        withCovers: booksWithCovers.length,
        cacheDirectory: this.baseUpcomingDir,
        metadataCacheDir: this.metadataCacheDir,
        oldestCache: books.length > 0 ? Math.min(...books.map((b) => b.cachedAt)) : null,
        newestCache: books.length > 0 ? Math.max(...books.map((b) => b.cachedAt)) : null,
        permissions: {
          isDockerEnvironment: this.isDockerEnvironment,
          nodeUid: this.nodeUid,
          nodeGid: this.nodeGid
        }
      }
    } catch (error) {
      return { error: 'Could not calculate statistics', details: error.message }
    }
  }

  /**
   * Performs maintenance: cleanup expired entries, verify file integrity, fix permissions.
   */
  async performMaintenance() {
    let cleanedCount = 0
    let verifiedCount = 0

    try {
      Logger.info(`[MetadataCacheStorage 13.0] Starting maintenance in: ${this.baseUpcomingDir}`)

      await this.ensureBaseDirectory()

      // Fix permissions on entire upcoming directory first
      await this.setRecursiveOwnership(this.baseUpcomingDir)

      const entries = await fs.readdir(this.baseUpcomingDir, { withFileTypes: true })

      for (const entry of entries.filter((e) => e.isDirectory())) {
        try {
          const dirPath = path.join(this.baseUpcomingDir, entry.name)
          const metadataPath = path.join(dirPath, 'upcoming.json')

          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))

          if (!this._isCacheValid(metadata)) {
            await fs.rm(dirPath, { recursive: true, force: true })
            cleanedCount++
            Logger.debug(`[MetadataCacheStorage 13.1] Cleaned expired: ${entry.name}`)
          } else {
            verifiedCount++
          }
        } catch {
          // Remove corrupted entries
          const dirPath = path.join(this.baseUpcomingDir, entry.name)
          await fs.rm(dirPath, { recursive: true, force: true })
          cleanedCount++
          Logger.debug(`[MetadataCacheStorage 13.2] Cleaned corrupted: ${entry.name}`)
        }
      }

      Logger.info(`[MetadataCacheStorage 13.3] Maintenance completed: ${cleanedCount} cleaned, ${verifiedCount} verified, permissions fixed`)
      return { cleaned: cleanedCount, verified: verifiedCount, permissionsFixed: true }
    } catch (error) {
      Logger.error(`[MetadataCacheStorage 13.4] Maintenance error:`, error)
      return { error: error.message }
    }
  }

  // Private helper methods
  _isCacheValid(metadata) {
    if (!metadata.cache?.cachedAt || !metadata.cache?.ttl) return false
    const age = Date.now() - metadata.cache.cachedAt
    return age < metadata.cache.ttl
  }

  _getExtensionFromUrl(url) {
    try {
      return path.extname(new URL(url).pathname) || '.jpg'
    } catch {
      return '.jpg'
    }
  }

  async _downloadCover(url, destPath) {
    const axios = require('axios')
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    const writer = require('fs').createWriteStream(destPath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  }

  async _waitForLockClear(lockPath, maxWaitMs) {
    const startTime = Date.now()
    while (Date.now() - startTime < maxWaitMs) {
      try {
        await fs.access(lockPath)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch {
        break // Lock cleared
      }
    }
  }

  async _cleanupFailedStorage(paths) {
    try {
      await fs.unlink(paths.coverFile).catch(() => {})
      await fs.unlink(paths.metadataFile).catch(() => {})
      await fs.unlink(`${paths.metadataFile}.tmp`).catch(() => {})
    } catch {
      // Ignore cleanup errors
    }
  }

  static getInstance(metadataCacheDir) {
    if (!MetadataCacheStorageManager.instance) {
      MetadataCacheStorageManager.instance = new MetadataCacheStorageManager(metadataCacheDir)
    }
    return MetadataCacheStorageManager.instance
  }
}

module.exports = MetadataCacheStorageManager
