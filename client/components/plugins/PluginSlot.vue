<template>
  <div v-if="isReady && resolvedContributions.length">
    <component
      :is="contribution.componentName"
      v-for="contribution in resolvedContributions"
      :key="`${slotName}:${contribution.pluginId}:${contribution.componentName}`"
      :slot-context="slotContext"
      :contribution="contribution"
    />
  </div>
</template>

<script>
const slotCache = new Map()
const scriptLoadCache = new Map()
const styleLoadCache = new Map()

export default {
  props: {
    slotName: {
      type: String,
      required: true
    },
    slotContext: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      isReady: false,
      resolvedContributions: []
    }
  },
  watch: {
    slotName: {
      immediate: true,
      handler() {
        this.bootstrap()
      }
    }
  },
  methods: {
    withRuntimeToken(url, token) {
      if (!url || !token) return url
      const joiner = url.includes('?') ? '&' : '?'
      return `${url}${joiner}rt=${encodeURIComponent(token)}`
    },
    resolveUrl(url) {
      if (!url || typeof url !== 'string') return null
      if (!url.startsWith('/')) return url
      const basePath = this.$config?.routerBasePath || ''
      return `${basePath}${url}`
    },
    async loadScript(url) {
      const resolvedUrl = this.resolveUrl(url)
      if (!resolvedUrl) return

      if (scriptLoadCache.has(resolvedUrl)) {
        return scriptLoadCache.get(resolvedUrl)
      }

      const scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = resolvedUrl
        script.async = true
        script.onload = () => resolve(true)
        script.onerror = () => reject(new Error(`Failed to load plugin script: ${resolvedUrl}`))
        document.head.appendChild(script)
      })

      scriptLoadCache.set(resolvedUrl, scriptPromise)
      return scriptPromise
    },
    async loadStyle(url) {
      const resolvedUrl = this.resolveUrl(url)
      if (!resolvedUrl) return

      if (styleLoadCache.has(resolvedUrl)) {
        return styleLoadCache.get(resolvedUrl)
      }

      const stylePromise = new Promise((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = resolvedUrl
        link.onload = () => resolve(true)
        link.onerror = () => reject(new Error(`Failed to load plugin style: ${resolvedUrl}`))
        document.head.appendChild(link)
      })

      styleLoadCache.set(resolvedUrl, stylePromise)
      return stylePromise
    },
    async fetchSlotContributions() {
      if (slotCache.has(this.slotName)) {
        return slotCache.get(this.slotName)
      }

      const payload = await this.$axios.$get(`/api/plugins/ui/slots/${encodeURIComponent(this.slotName)}`)
      const contributions = payload?.contributions || []
      slotCache.set(this.slotName, contributions)
      return contributions
    },
    async bootstrap() {
      this.isReady = false
      this.resolvedContributions = []

      try {
        const contributions = await this.fetchSlotContributions()

        for (const contribution of contributions) {
          const tokenizedStyleUrl = this.withRuntimeToken(contribution.styleUrl, contribution.runtimeToken)
          const tokenizedScriptUrl = this.withRuntimeToken(contribution.scriptUrl, contribution.runtimeToken)

          if (tokenizedStyleUrl) {
            await this.loadStyle(tokenizedStyleUrl)
          }
          if (tokenizedScriptUrl) {
            await this.loadScript(tokenizedScriptUrl)
          }
        }

        this.resolvedContributions = contributions
      } catch (error) {
        // Fail silently when plugin runtime endpoints are unavailable.
        console.warn('[PluginSlot] Failed to initialize slot', this.slotName, error)
      } finally {
        this.isReady = true
      }
    }
  }
}
</script>
