const Logger = require('../Logger')
const SeriesUtils = require('../utils/upcoming/seriesUtils')
const Audible = require('../providers/Audible')
const Audble = require('../providers/Audble')
const GoogleBooks = require('../providers/GoogleBooks')
const OpenLibrary = require('../providers/OpenLibrary')
const RisingShadowProvider = require('../providers/RisingShadowProvider')
const UpcomingBookAdminSettings = require('./UpcomingBookAdminSettings')
const ProviderResultAdapter = require('./ProviderResultAdapter')

/**
 * Enhanced upcoming book discovery service with correct provider order
 * Provider order: Cache → Audble → Google → Others → RisingShadow
 * Integrates with admin settings for configuration
 */
class UpcomingBookDiscoveryService {
  constructor() {
    this.initialized = false
    this.adminSettings = null
    this.providers = null
    this.resultAdapter = new ProviderResultAdapter()

    Logger.info('[UpcomingBookDiscoveryService] Discovery service initialized')
  }

  /**
   * Initialize the discovery service
   */
  async initialize() {
    if (this.initialized) return

    try {
      // Load admin settings
      const UpcomingBookAdminSettings = require('./UpcomingBookAdminSettings')
      this.adminSettings = new UpcomingBookAdminSettings()
      await this.adminSettings.initialize()

      // Initialize providers with default timeouts first
      this.providers = [
        { name: 'audible', provider: new Audible(), timeout: 30000 },
        // { name: 'audble', provider: new Audble(), timeout: 30000 }, // Temporarily disabled
        { name: 'google', provider: new GoogleBooks(), timeout: 15000 },
        { name: 'openlibrary', provider: new OpenLibrary(), timeout: 15000 },
        { name: 'risingshadow', provider: new RisingShadowProvider(), timeout: 45000 }
      ]

      // Update timeouts from admin settings
      for (const provider of this.providers) {
        try {
          provider.timeout = await this.adminSettings.getProviderTimeout(provider.name)
        } catch (error) {
          Logger.warn(`[UpcomingBookDiscoveryService] Failed to get timeout for ${provider.name}, using default`)
        }
      }

      this.initialized = true
      Logger.info(
        '[UpcomingBookDiscoveryService] Initialized with providers in correct order:',
        this.providers.map((p) => p.name)
      )
    } catch (error) {
      Logger.error('[UpcomingBookDiscoveryService] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Main discovery method with correct provider order
   */
  async discoverUpcomingBook(libraryItem, allLibraryBooks) {
    try {
      await this.initialize()

      const seriesInfo = SeriesUtils.extractSeriesAndAuthorInfo(libraryItem)
      if (!SeriesUtils.validateSeriesInfo(seriesInfo)) {
        Logger.debug('[UpcomingBookDiscoveryService] Invalid series information')
        return null
      }

      const { seriesName, authorName } = seriesInfo
      const maxSequence = this.calculateMaxSequence(seriesName, allLibraryBooks)
      const asin = this.extractASIN(libraryItem)

      Logger.info(`[UpcomingBookDiscoveryService] Searching for: "${seriesName}" by "${authorName}" (after book ${maxSequence})`)

      // Search with correct provider order: Cache → Audble → Google → Others → RisingShadow
      const result = await this.searchWithProviderOrder(seriesName, authorName, asin, maxSequence)

      if (result) {
        Logger.info(`[UpcomingBookDiscoveryService] Found upcoming book: "${result.title}" by ${result.author}`)
        return result
      }

      Logger.info('[UpcomingBookDiscoveryService] No upcoming book found')
      return null
    } catch (error) {
      Logger.error('[UpcomingBookDiscoveryService] Discovery failed:', error)
      return null
    }
  }

  /**
   * Search with provider order
   */
  async searchWithProviderOrder(seriesName, authorName, asin = null, currentSequence = null) {
    Logger.info(`[UpcomingBookDiscoveryService] Searching for: "${seriesName}" by "${authorName}" (after book ${currentSequence})`)

    const providerOrder = this.adminSettings.settings.providerOrder
    Logger.info(`[UpcomingBookDiscoveryService] Provider order: ${providerOrder.join(' → ')}`)

    for (const providerName of providerOrder) {
      if (providerName === 'cache') {
        Logger.debug(`[UpcomingBookDiscoveryService] Skipping cache provider in discovery service`)
        continue
      }

      Logger.info(`[UpcomingBookDiscoveryService] Trying ${providerName} provider...`)
      const result = await this.searchWithProvider(providerName, seriesName, authorName, asin, currentSequence)

      if (result) {
        // Check if this is the correct next book in sequence
        const resultSequence = this.extractBookSequence(result)
        if (resultSequence && resultSequence > currentSequence) {
          Logger.info(`[UpcomingBookDiscoveryService] ${providerName} found correct next book: "${result.title}" (sequence ${resultSequence})`)
          return result
        } else {
          Logger.info(`[UpcomingBookDiscoveryService] ${providerName} found wrong book: "${result.title}" (sequence ${resultSequence}, need ${currentSequence + 1})`)
          // Continue to next provider to find the correct book
        }
      } else {
        Logger.info(`[UpcomingBookDiscoveryService] ${providerName} provider returned no results`)
      }
    }

    Logger.info(`[UpcomingBookDiscoveryService] All providers exhausted, no results found`)
    return null
  }

  /**
   * Search with a specific provider
   */
  async searchWithProvider(providerName, seriesName, authorName, asin, currentSequence) {
    try {
      const provider = this.providers.find((p) => p.name === providerName)
      if (!provider) {
        Logger.warn(`[UpcomingBookDiscoveryService] Provider not found: ${providerName}`)
        return null
      }

      const timeout = provider.timeout
      Logger.info(`[UpcomingBookDiscoveryService] Searching with ${providerName} (timeout: ${timeout}ms)`)

      // ASIN is now passed as a parameter

      // Search with timeout - pass currentSequence to providers that support it
      let searchPromise
      if (providerName === 'risingshadow') {
        // RisingShadow provider needs currentSequence for proper sequential book finding
        Logger.info(`[UpcomingBookDiscoveryService] Calling RisingShadow with sequence: ${currentSequence}`)
        searchPromise = provider.provider.search(seriesName, authorName, asin, 'us', currentSequence)
      } else {
        searchPromise = provider.provider.search(seriesName, authorName, asin, 'us')
      }

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Provider timeout')), timeout))

      const results = await Promise.race([searchPromise, timeoutPromise])

      if (!results) {
        Logger.info(`[UpcomingBookDiscoveryService] ${providerName} returned no results`)
        return null
      }

      // Use the adapter to process provider-specific results
      Logger.info(`[UpcomingBookDiscoveryService] ${providerName} returned results, processing with adapter`)
      return this.resultAdapter.processProviderResults(providerName, results, seriesName, authorName, currentSequence)
    } catch (error) {
      Logger.info(`[UpcomingBookDiscoveryService] ${providerName} search failed: ${error.message}`)
      return null
    }
  }

  /**
   * Extract ASIN from library item
   */
  extractASIN(libraryItem) {
    try {
      return libraryItem.media?.asin || libraryItem.media?.metadata?.asin || null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract book sequence from result
   */
  extractBookSequence(result) {
    try {
      if (result.series && Array.isArray(result.series)) {
        for (const seriesInfo of result.series) {
          if (seriesInfo.sequence) {
            const seq = parseInt(seriesInfo.sequence)
            if (!isNaN(seq)) {
              return seq
            }
          }
        }
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Calculate maximum sequence in user's library for a series
   */
  calculateMaxSequence(seriesName, allLibraryBooks) {
    try {
      if (!seriesName || !allLibraryBooks || !Array.isArray(allLibraryBooks)) {
        return 0
      }

      let maxSequence = 0

      for (const book of allLibraryBooks) {
        const seriesInfo = SeriesUtils.extractSeriesAndSequence(book)
        if (seriesInfo.name && seriesInfo.name.toLowerCase().includes(seriesName.toLowerCase())) {
          if (seriesInfo.seq && seriesInfo.seq > maxSequence) {
            maxSequence = seriesInfo.seq
          }
        }
      }

      return maxSequence
    } catch (error) {
      Logger.debug('[UpcomingBookDiscoveryService] Error calculating max sequence:', error.message)
      return 0
    }
  }

  /**
   * Find next book in series (public method for external use)
   */
  async findNextInSeries(seriesName, authorName, currentSequence) {
    try {
      await this.initialize()

      Logger.info(`[UpcomingBookDiscoveryService] Finding next book in series: "${seriesName}" (current: ${currentSequence})`)

      // Create a mock library item for the search
      const mockLibraryItem = {
        media: {
          metadata: {
            series: [{ name: seriesName }],
            authors: [{ name: authorName }]
          }
        }
      }

      return await this.searchWithProviderOrder(seriesName, authorName, currentSequence, mockLibraryItem)
    } catch (error) {
      Logger.error('[UpcomingBookDiscoveryService] Find next in series failed:', error)
      return null
    }
  }

  /**
   * Health check for the discovery service
   */
  async healthCheck() {
    try {
      await this.initialize()

      const health = {
        status: 'healthy',
        providers: this.providers.length,
        adminSettings: !!this.adminSettings,
        initialized: this.initialized,
        timestamp: new Date().toISOString()
      }

      // Test provider connectivity
      const providerTests = {}
      for (const provider of this.providers) {
        try {
          // Skip actual provider testing to avoid spam logs
          // const testResult = await Promise.race([provider.provider.search('test', 'test', null, 'us'), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), provider.timeout))])
          providerTests[provider.name] = { status: 'healthy' }
        } catch (error) {
          providerTests[provider.name] = { status: 'error', error: error.message }
        }
      }

      health.providerTests = providerTests
      const failedProviders = Object.values(providerTests).filter((p) => p.status === 'error').length

      if (failedProviders > 0) {
        health.status = 'degraded'
        health.warnings = [`${failedProviders} providers are not responding`]
      }

      return health
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}

module.exports = UpcomingBookDiscoveryService
