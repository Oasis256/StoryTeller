<template>
  <div>
    <app-settings-content header-text="Upcoming Books Settings" description="Configure upcoming book discovery providers and cache settings">
      
      <!-- Provider Configuration -->
      <div class="mb-6">
        <h3 class="text-lg font-medium mb-3">Provider Configuration</h3>
        <div class="space-y-4">
          <div>
            <p class="text-white/60 uppercase text-sm mb-2">Provider Order:</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="provider in settings.providerOrder" :key="provider" 
                    class="px-2 py-1 bg-primary/20 rounded text-sm text-gray-100">
                {{ provider }}
              </span>
            </div>
            <p class="text-xs text-gray-400 mt-1">Providers are tried in this order</p>
          </div>
          
          <div>
            <p class="text-white/60 uppercase text-sm mb-2">Provider Timeouts:</p>
            <div class="space-y-1">
              <div v-for="(timeout, provider) in settings.providerTimeouts" :key="provider" 
                   class="flex justify-between items-center text-sm">
                <span class="text-gray-100">{{ provider }}:</span>
                <span class="text-gray-100 font-mono">{{ timeout }}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cache Configuration -->
      <div class="mb-6">
        <h3 class="text-lg font-medium mb-3">Cache Configuration</h3>
        <div class="space-y-4">
          <div class="flex items-center">
            <div :class="settings.cacheEnabled ? 'bg-success' : 'bg-error'" 
                 class="w-3 h-3 rounded-full mr-2"></div>
            <span class="text-gray-100">Cache: {{ settings.cacheEnabled ? 'Enabled' : 'Disabled' }}</span>
          </div>
          
          <div>
            <p class="text-white/60 uppercase text-sm mb-2">Cache TTL:</p>
            <div class="space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-gray-100">Memory:</span>
                <span class="text-gray-100">{{ formatDuration(settings.cacheTTL?.memory) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-100">File:</span>
                <span class="text-gray-100">{{ formatDuration(settings.cacheTTL?.file) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Flags -->
      <div class="mb-6">
        <h3 class="text-lg font-medium mb-3">Feature Flags</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div v-for="(enabled, feature) in settings.features" :key="feature" 
               class="flex items-center">
            <div :class="enabled ? 'bg-success' : 'bg-error'" 
                 class="w-3 h-3 rounded-full mr-2"></div>
            <span class="text-sm text-gray-100">{{ formatFeatureName(feature) }}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2 mb-6">
        <ui-btn @click="testAllProviders" :loading="testing" color="bg-primary">
          {{ testing ? 'Testing...' : 'Test All Providers' }}
        </ui-btn>
        <ui-btn @click="clearAllCache" :loading="clearing" color="bg-warning">
          {{ clearing ? 'Clearing...' : 'Clear All Cache' }}
        </ui-btn>
        <ui-btn @click="resetSettings" :loading="resetting" color="bg-error">
          {{ resetting ? 'Resetting...' : 'Reset to Defaults' }}
        </ui-btn>
      </div>

      <!-- Provider Test Results -->
      <div v-if="testResults" class="mb-6">
        <h3 class="text-lg font-medium mb-3">Provider Test Results</h3>
        <div class="space-y-3">
          <div v-for="(result, provider) in testResults" :key="provider" 
               class="flex items-center justify-between p-3 rounded border"
               :class="result.status === 'success' ? 'border-success/30 bg-success/10' : 'border-error/30 bg-error/10'">
            <div class="flex items-center gap-3">
              <div :class="result.status === 'success' ? 'bg-success' : 'bg-error'" 
                   class="w-3 h-3 rounded-full"></div>
              <span class="font-medium text-gray-100">{{ provider }}</span>
            </div>
            <div class="text-sm">
              <span v-if="result.status === 'success'" class="text-success">
                {{ result.responseTime }}ms
              </span>
              <span v-else class="text-error">
                {{ result.error }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Health Status -->
      <div class="mb-6">
        <h3 class="text-lg font-medium mb-3">System Health</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center p-3 border border-white/10 rounded">
            <div class="text-2xl font-bold text-gray-100">{{ healthStatus.discovery?.providers || 0 }}</div>
            <div class="text-sm text-gray-400">Active Providers</div>
          </div>
          <div class="text-center p-3 border border-white/10 rounded">
            <div class="text-2xl font-bold text-gray-100">{{ healthStatus.statistics?.cacheHits || 0 }}</div>
            <div class="text-sm text-gray-400">Cache Hits</div>
          </div>
          <div class="text-center p-3 border border-white/10 rounded">
            <div class="text-2xl font-bold text-gray-100">{{ healthStatus.statistics?.successfulDiscoveries || 0 }}</div>
            <div class="text-sm text-gray-400">Successful Discoveries</div>
          </div>
        </div>
      </div>

    </app-settings-content>
  </div>
</template>

<script>
export default {
  name: 'UpcomingBooksConfig',
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      loading: true,
      testing: false,
      clearing: false,
      resetting: false,
      settings: {},
      testResults: null,
      healthStatus: {}
    }
  },
  async mounted() {
    await this.loadSettings()
    await this.loadHealthStatus()
  },
  methods: {
    async loadSettings() {
      try {
        const response = await this.$axios.get('/api/upcoming/admin/settings')
        this.settings = response.data
      } catch (error) {
        console.error('Failed to load settings:', error)
        this.$toast.error('Failed to load settings')
      } finally {
        this.loading = false
      }
    },
    
    async loadHealthStatus() {
      try {
        const response = await this.$axios.get('/api/upcoming/health')
        this.healthStatus = response.data
      } catch (error) {
        console.error('Failed to load health status:', error)
      }
    },
    
    async testAllProviders() {
      this.testing = true
      try {
        const response = await this.$axios.post('/api/upcoming/admin/test-providers')
        this.testResults = response.data.providers
        this.$toast.success('Provider tests completed')
      } catch (error) {
        console.error('Provider tests failed:', error)
        this.$toast.error('Provider tests failed')
      } finally {
        this.testing = false
      }
    },
    
    async clearAllCache() {
      this.clearing = true
      try {
        await this.$axios.delete('/api/upcoming/cache')
        this.$toast.success('All cache cleared successfully')
        await this.loadHealthStatus() // Refresh stats
      } catch (error) {
        console.error('Failed to clear cache:', error)
        this.$toast.error('Failed to clear cache')
      } finally {
        this.clearing = false
      }
    },
    
    async resetSettings() {
      this.resetting = true
      try {
        const response = await this.$axios.post('/api/upcoming/admin/reset-settings')
        if (response.data.success) {
          this.$toast.success('Settings reset to defaults successfully')
          await this.loadSettings() // Reload settings
          await this.loadHealthStatus() // Refresh stats
        } else {
          this.$toast.error('Failed to reset settings')
        }
      } catch (error) {
        console.error('Failed to reset settings:', error)
        this.$toast.error('Failed to reset settings')
      } finally {
        this.resetting = false
      }
    },
    
    formatDuration(ms) {
      if (!ms) return 'N/A'
      const minutes = Math.floor(ms / (1000 * 60))
      const hours = Math.floor(minutes / 60)
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`
      }
      return `${minutes}m`
    },
    
    formatFeatureName(feature) {
      return feature
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
    }
  }
}
</script>
