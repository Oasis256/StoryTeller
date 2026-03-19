<template>
  <div>
    <app-settings-content header-text="Plugins">
      <div class="mb-4 text-sm text-white/70">
        <p>Manage plugins entirely from this page (upload, install, enable, disable, reload, uninstall).</p>
        <p class="mt-1">Install path: <span class="font-mono text-xs">{{ overview.installDir || 'N/A' }}</span></p>
      </div>

      <div class="mb-5 rounded border border-white/10 bg-black-200/50 p-3">
        <h2 class="font-semibold mb-2">Upload Plugin Package (.zip)</h2>
        <p class="text-xs text-white/60 mb-2">Package should include plugin folder root with <span class="font-mono">abs-plugin.js</span> or <span class="font-mono">index.js</span>.</p>
        <div class="flex flex-wrap items-center gap-2">
          <input ref="uploadFileInput" type="file" accept=".zip,application/zip" class="text-xs" @change="onUploadFileChanged" />
          <ui-text-input v-model="uploadPluginId" placeholder="Optional plugin id override" class="w-64" />
          <label class="inline-flex items-center gap-1 text-xs text-white/70">
            <input type="checkbox" v-model="uploadForce" />
            Force replace
          </label>
          <ui-btn color="bg-secondary" small :disabled="!uploadFile || loading || validateInProgress || uploadInProgress" :loading="validateInProgress" @click="validateUploadPackage">Validate Package</ui-btn>
          <ui-btn color="bg-primary" small :disabled="!uploadFile || loading || uploadInProgress || validateInProgress" :loading="uploadInProgress" @click="uploadAndInstallPlugin">Upload & Install</ui-btn>
        </div>
        <div v-if="validationResult" class="mt-3 rounded border border-white/10 bg-black-300/60 p-2 text-xs">
          <p class="text-success">Validation OK</p>
          <p>Detected plugin id: <span class="font-mono">{{ validationResult.detectedPluginId || 'N/A' }}</span></p>
          <p>Install plugin id: <span class="font-mono">{{ validationResult.pluginId }}</span></p>
          <p>Entry file: <span class="font-mono">{{ validationResult.entryFile }}</span></p>
          <p>Target dir: <span class="font-mono">{{ validationResult.installDir }}</span></p>
        </div>
      </div>

      <div class="mb-4 flex items-center gap-2">
        <ui-btn color="bg-primary" small :disabled="loading" @click="fetchOverview">Refresh</ui-btn>
      </div>

      <div v-if="errorMessage" class="mb-3 rounded border border-error/60 bg-error/20 px-3 py-2 text-sm text-error">
        {{ errorMessage }}
      </div>

      <div v-if="loading" class="py-6 text-sm text-white/60">Loading plugins...</div>

      <div v-else>
        <div class="mb-6">
          <h2 class="font-semibold mb-2">Installed Plugins</h2>
          <div v-if="!overview.installedPlugins.length" class="text-sm text-white/60">No installed plugins found.</div>
          <div v-else class="space-y-2">
            <div v-for="plugin in overview.installedPlugins" :key="`installed-${plugin.id}`" class="rounded border border-white/10 bg-black-200/50 px-3 py-2">
              <div class="flex items-start gap-3">
                <div class="grow min-w-0">
                  <p class="font-semibold text-sm">{{ plugin.name || plugin.id }} <span class="text-white/60">({{ plugin.id }})</span></p>
                  <p class="text-xs text-white/60">Path: <span class="font-mono">{{ plugin.installDir }}</span></p>
                  <p class="text-xs mt-0.5" :class="plugin.loaded ? 'text-success' : 'text-white/60'">
                    {{ plugin.loaded ? 'Loaded (active)' : 'Installed (inactive)' }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <ui-btn v-if="!plugin.loaded" small color="bg-success" :disabled="isBusy(plugin.id)" @click="enablePlugin(plugin.id)">Enable</ui-btn>
                  <ui-btn v-if="plugin.loaded" small color="bg-warning" :disabled="isBusy(plugin.id)" @click="disablePlugin(plugin.id)">Disable</ui-btn>
                  <ui-btn small color="bg-primary" :disabled="isBusy(plugin.id)" @click="reloadPlugin(plugin.id)">Reload</ui-btn>
                  <ui-btn small color="bg-error" :disabled="isBusy(plugin.id)" @click="uninstallPlugin(plugin.id, false)">Uninstall</ui-btn>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h2 class="font-semibold mb-2">Loaded Plugins (Current Runtime)</h2>
          <div v-if="!overview.loadedPlugins.length" class="text-sm text-white/60">No plugins currently loaded.</div>
          <div v-else class="space-y-2">
            <div v-for="plugin in overview.loadedPlugins" :key="`loaded-${plugin.id}`" class="rounded border border-white/10 bg-black-200/50 px-3 py-2">
              <p class="font-semibold text-sm">{{ plugin.name || plugin.id }} <span class="text-white/60">({{ plugin.id }})</span></p>
              <p v-if="plugin.version" class="text-xs text-white/60">v{{ plugin.version }}</p>
              <p v-if="plugin.description" class="text-xs text-white/70 mt-0.5">{{ plugin.description }}</p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h2 class="font-semibold mb-2">Upcoming Book Settings</h2>
          <div class="rounded border border-white/10 bg-black-200/50 px-3 py-2">
            <div class="flex items-center gap-2 mb-2">
              <ui-btn color="bg-primary" small :disabled="loadingUpcomingSettings" @click="loadUpcomingSettings">Load Settings</ui-btn>
              <ui-btn color="bg-success" small :disabled="loadingUpcomingSettings || !upcomingSettingsLoaded" @click="saveUpcomingSettings">Save</ui-btn>
              <ui-btn color="bg-warning" small :disabled="loadingUpcomingSettings || !upcomingSettingsLoaded" @click="clearUpcomingCache">Clear Cache</ui-btn>
            </div>
            <div v-if="upcomingSettingsLoaded" class="space-y-2 text-sm">
              <div class="flex items-center gap-2">
                <ui-toggle-switch v-model="upcomingSettings.coverCacheEnabled" small />
                <span class="text-white/70">Cover cache enabled</span>
              </div>
              <div class="flex items-center gap-2">
                <ui-toggle-switch v-model="upcomingSettings.debugBypassCache" small />
                <span class="text-white/70">Debug: bypass response cache</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-white/70 w-40">Cache days</span>
                <ui-text-input type="number" v-model="upcomingSettings.coverCacheDays" no-spinner class="w-20" />
              </div>
              <div class="flex items-center gap-2">
                <ui-toggle-switch v-model="upcomingSettings.purgeOnLibraryAdd" small />
                <span class="text-white/70">Purge when book added to library</span>
              </div>
              <div class="pt-2 border-t border-white/10"></div>
              <div class="flex items-center gap-2">
                <ui-toggle-switch v-model="upcomingSettings.providersEnabled.audble" small />
                <span class="text-white/70">Enable Audble</span>
              </div>
              <div class="flex items-center gap-2">
                <ui-toggle-switch v-model="upcomingSettings.providersEnabled.risingshadow" small />
                <span class="text-white/70">Enable RisingShadow</span>
              </div>
              <div class="flex items-center gap-2">
                <ui-dropdown v-model="upcomingSettings.defaultProvider" :items="upcomingProviderOptions" label="Default provider" small class="max-w-56" />
              </div>
            </div>
            <div v-else class="text-xs text-white/60">Load settings to edit cache behavior.</div>
          </div>
        </div>

        <div>
          <h2 class="font-semibold mb-2">Bundled Plugins</h2>
          <div v-if="!overview.availablePlugins.length" class="text-sm text-white/60">No bundled plugins found.</div>
          <div v-else class="space-y-2">
            <div v-for="plugin in overview.availablePlugins" :key="`candidate-${plugin.id}`" class="rounded border border-white/10 bg-black-200/50 px-3 py-2">
              <div class="flex items-start gap-3">
                <div class="grow min-w-0">
                  <p class="font-semibold text-sm">{{ plugin.name || plugin.id }} <span class="text-white/60">({{ plugin.id }})</span></p>
                  <p class="text-xs text-white/60">Source: <span class="font-mono">{{ plugin.sourceDir }}</span></p>
                  <p class="text-xs mt-0.5" :class="plugin.installed ? 'text-success' : 'text-white/60'">
                    {{ plugin.installed ? 'Installed' : 'Not installed' }}
                    <span v-if="plugin.loaded"> • Loaded</span>
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <ui-btn v-if="!plugin.installed" small color="bg-success" :disabled="isBusy(plugin.id)" @click="installBundledPlugin(plugin.id, false)">Install</ui-btn>
                  <ui-btn v-if="plugin.installed" small color="bg-warning" :disabled="isBusy(plugin.id)" @click="installBundledPlugin(plugin.id, true)">Reinstall</ui-btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      loading: false,
      uploadInProgress: false,
      validateInProgress: false,
      busyPluginIds: {},
      uploadFile: null,
      uploadPluginId: '',
      uploadForce: false,
      validationResult: null,
      overview: {
        installDir: null,
        bundledDir: null,
        loadedPlugins: [],
        installedPlugins: [],
        availablePlugins: []
      },
      loadingUpcomingSettings: false,
      upcomingSettingsLoaded: false,
      upcomingSettings: {
        coverCacheEnabled: true,
        coverCacheDays: 30,
        purgeOnLibraryAdd: true,
        debugBypassCache: false,
        providersEnabled: {
          audble: true,
          risingshadow: true
        },
        defaultProvider: 'audble'
      },
      errorMessage: null
    }
  },
  computed: {
    upcomingProviderOptions() {
      return [
        { value: 'audble', text: 'Audble' },
        { value: 'risingshadow', text: 'RisingShadow' }
      ]
    }
  },
  mounted() {
    this.fetchOverview()
  },
  methods: {
    isBusy(pluginId) {
      return !!this.busyPluginIds[pluginId]
    },
    onUploadFileChanged(event) {
      const selected = event?.target?.files?.[0] || null
      this.uploadFile = selected
      this.validationResult = null
    },
    async validateUploadPackage() {
      if (!this.uploadFile) return

      this.validateInProgress = true
      this.errorMessage = null
      this.validationResult = null
      try {
        const form = new FormData()
        form.append('file', this.uploadFile)
        if (this.uploadPluginId?.trim()) {
          form.append('pluginId', this.uploadPluginId.trim())
        }

        const payload = await this.$axios.$post('/api/plugins/admin/validate-upload', form)
        if (!payload?.success || !payload.valid) {
          throw new Error(payload?.error || 'Validation failed')
        }

        this.validationResult = payload
        this.$toast.success(`Package is valid for plugin "${payload.pluginId}".`)
      } catch (error) {
        console.error('Plugin package validation failed', error)
        const message = error?.response?.data?.error || error.message || 'Validation failed'
        this.errorMessage = message
        this.$toast.error(message)
      } finally {
        this.validateInProgress = false
      }
    },
    async fetchOverview() {
      this.loading = true
      this.errorMessage = null
      try {
        const payload = await this.$axios.$get('/api/plugins/admin/overview')
        this.overview = payload || this.overview
        if (this.overview.loadedPlugins.some((p) => p.id === 'upcoming-book')) {
          this.loadUpcomingSettings()
        }
      } catch (error) {
        console.error('Failed to load plugin overview', error)
        this.errorMessage = error?.response?.data?.error || 'Failed to load plugin overview'
      } finally {
        this.loading = false
      }
    },
    async loadUpcomingSettings() {
      this.loadingUpcomingSettings = true
      try {
        const payload = await this.$axios.$get('/api/plugins/upcoming-book/v1/settings')
        if (payload?.settings) {
          this.upcomingSettings = { ...this.upcomingSettings, ...payload.settings }
          this.upcomingSettingsLoaded = true
        }
      } catch (error) {
        const status = error?.response?.status
        if (status === 401 || status === 403 || status === 404) {
          // Plugin not available or not authorized; avoid noisy toast.
          this.upcomingSettingsLoaded = false
        } else {
          console.error('Failed to load upcoming book settings', error)
          this.$toast.error(error?.response?.data?.error || 'Failed to load upcoming settings')
        }
      } finally {
        this.loadingUpcomingSettings = false
      }
    },
    async saveUpcomingSettings() {
      this.loadingUpcomingSettings = true
      try {
        const payload = await this.$axios.$put('/api/plugins/upcoming-book/v1/settings', this.upcomingSettings)
        if (payload?.settings) {
          this.upcomingSettings = { ...this.upcomingSettings, ...payload.settings }
        }
        this.$toast.success('Upcoming Book settings saved.')
      } catch (error) {
        console.error('Failed to save upcoming book settings', error)
        this.$toast.error(error?.response?.data?.error || 'Failed to save upcoming settings')
      } finally {
        this.loadingUpcomingSettings = false
      }
    },
    async clearUpcomingCache() {
      this.loadingUpcomingSettings = true
      try {
        const payload = await this.$axios.$post('/api/plugins/upcoming-book/v1/cache/clear', {})
        const removed = payload?.removed ?? 0
        this.$toast.success(`Upcoming Book cache cleared (${removed} files).`)
      } catch (error) {
        console.error('Failed to clear upcoming book cache', error)
        this.$toast.error(error?.response?.data?.error || 'Failed to clear cache')
      } finally {
        this.loadingUpcomingSettings = false
      }
    },
    async installBundledPlugin(pluginId, force) {
      this.$set(this.busyPluginIds, pluginId, true)
      this.errorMessage = null
      try {
        const payload = await this.$axios.$post(`/api/plugins/admin/install/${pluginId}`, {
          force
        })
        if (!payload?.success) {
          throw new Error(payload?.error || 'Install failed')
        }
        this.$toast.success(`Plugin "${pluginId}" installed and loaded.`)
        await this.fetchOverview()
      } catch (error) {
        console.error('Plugin install failed', error)
        const message = error?.response?.data?.error || error.message || 'Install failed'
        this.errorMessage = message
        this.$toast.error(message)
      } finally {
        this.$delete(this.busyPluginIds, pluginId)
      }
    },
    async uploadAndInstallPlugin() {
      if (!this.uploadFile) return

      this.uploadInProgress = true
      this.errorMessage = null
      try {
        const form = new FormData()
        form.append('file', this.uploadFile)
        form.append('force', this.uploadForce ? '1' : '0')
        if (this.uploadPluginId?.trim()) {
          form.append('pluginId', this.uploadPluginId.trim())
        }

        const payload = await this.$axios.$post('/api/plugins/admin/install-upload', form)
        if (!payload?.success) {
          throw new Error(payload?.error || 'Upload install failed')
        }

        this.$toast.success(`Plugin "${payload.pluginId}" uploaded, installed, and loaded.`)
        this.uploadFile = null
        this.uploadPluginId = ''
        this.uploadForce = false
        this.validationResult = null
        if (this.$refs.uploadFileInput) this.$refs.uploadFileInput.value = null
        await this.fetchOverview()
      } catch (error) {
        console.error('Plugin upload install failed', error)
        const message = error?.response?.data?.error || error.message || 'Upload install failed'
        this.errorMessage = message
        this.$toast.error(message)
      } finally {
        this.uploadInProgress = false
      }
    },
    async enablePlugin(pluginId) {
      this.$set(this.busyPluginIds, pluginId, true)
      this.errorMessage = null
      try {
        const payload = await this.$axios.$post(`/api/plugins/admin/enable/${pluginId}`)
        if (!payload?.success) throw new Error(payload?.error || 'Enable failed')
        this.$toast.success(`Plugin "${pluginId}" enabled.`)
        await this.fetchOverview()
      } catch (error) {
        console.error('Enable failed', error)
        const message = error?.response?.data?.error || error.message || 'Enable failed'
        this.errorMessage = message
        this.$toast.error(message)
      } finally {
        this.$delete(this.busyPluginIds, pluginId)
      }
    },
    async disablePlugin(pluginId) {
      this.$set(this.busyPluginIds, pluginId, true)
      this.errorMessage = null
      try {
        const payload = await this.$axios.$post(`/api/plugins/admin/disable/${pluginId}`)
        if (!payload?.success) throw new Error(payload?.error || 'Disable failed')
        this.$toast.success(`Plugin "${pluginId}" disabled.`)
        await this.fetchOverview()
      } catch (error) {
        console.error('Disable failed', error)
        const message = error?.response?.data?.error || error.message || 'Disable failed'
        this.errorMessage = message
        this.$toast.error(message)
      } finally {
        this.$delete(this.busyPluginIds, pluginId)
      }
    },
    async reloadPlugin(pluginId) {
      this.$set(this.busyPluginIds, pluginId, true)
      this.errorMessage = null
      try {
        const payload = await this.$axios.$post(`/api/plugins/admin/reload/${pluginId}`)
        if (!payload?.success) throw new Error(payload?.error || 'Reload failed')
        this.$toast.success(`Plugin "${pluginId}" reloaded.`)
        await this.fetchOverview()
      } catch (error) {
        console.error('Reload failed', error)
        const message = error?.response?.data?.error || error.message || 'Reload failed'
        this.errorMessage = message
        this.$toast.error(message)
      } finally {
        this.$delete(this.busyPluginIds, pluginId)
      }
    },
    async uninstallPlugin(pluginId, purge) {
      this.$set(this.busyPluginIds, pluginId, true)
      this.errorMessage = null
      try {
        const payload = await this.$axios.$post(`/api/plugins/admin/uninstall/${pluginId}`, {
          purge
        })
        if (!payload?.success) {
          throw new Error(payload?.error || 'Uninstall failed')
        }
        this.$toast.success(`Plugin "${pluginId}" uninstalled.`)
        await this.fetchOverview()
      } catch (error) {
        console.error('Plugin uninstall failed', error)
        const message = error?.response?.data?.error || error.message || 'Uninstall failed'
        this.errorMessage = message
        this.$toast.error(message)
      } finally {
        this.$delete(this.busyPluginIds, pluginId)
      }
    }
  }
}
</script>
