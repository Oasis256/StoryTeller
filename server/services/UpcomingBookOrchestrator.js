const Logger = require('../Logger')
const path = require('path')
const UpcomingBookDiscoveryService = require('./UpcomingBookDiscoveryService')
const UpcomingBookCache = require('./UpcomingBookCache')
const SeriesUtils = require('../utils/upcoming/seriesUtils')

/**
 * Enhanced orchestrator for upcoming book functionality
 * Implements cache-first architecture with correct provider order
 * Coordinates discovery, caching, and result delivery
 */
class UpcomingBookOrchestrator {
  constructor() {
    Logger.info('[UpcomingBookOrchestrator] Starting orchestrator initialization...')

    this.initialized = false
    this.discoveryService = null
    this.cache = null
    this.adminSettings = null

    // Statistics
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      successfulDiscoveries: 0,
      failedDiscoveries: 0,
      averageResponseTime: 0,
      lastReset: Date.now()
    }

    Logger.info('[UpcomingBookOrchestrator] Orchestrator initialization completed')
  }

  /**
   * Initialize the orchestrator and all services
   */
  async initialize() {
    if (this.initialized) return

    try {
      // Initialize admin settings first
      const UpcomingBookAdminSettings = require('./UpcomingBookAdminSettings')
      this.adminSettings = new UpcomingBookAdminSettings()
      await this.adminSettings.initialize()

      // Initialize discovery service
      this.discoveryService = new UpcomingBookDiscoveryService()
      await this.discoveryService.initialize()
      Logger.info('[UpcomingBookOrchestrator] Discovery service initialized')

      // Initialize cache with admin settings
      const cacheSettings = await this.adminSettings.getCacheSettings()
      this.cache = new UpcomingBookCache({
        cacheDir: path.join(process.cwd(), 'metadata', 'cache', 'upcoming-v5'),
        memoryCacheSize: cacheSettings.size.memory,
        defaultTTL: cacheSettings.ttl
      })
      Logger.info('[UpcomingBookOrchestrator] Cache initialized')

      this.initialized = true
      Logger.info('[UpcomingBookOrchestrator] All services initialized successfully')
    } catch (error) {
      Logger.error('[UpcomingBookOrchestrator] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Main orchestrator method to find upcoming book
   */
  async findUpcomingBook(libraryItem, allLibraryBooks, options = {}) {
    const startTime = Date.now()
    this.stats.totalRequests++
    
    try {
      await this.initialize()

      const seriesInfo = SeriesUtils.extractSeriesAndAuthorInfo(libraryItem)
      if (!SeriesUtils.validateSeriesInfo(seriesInfo)) {
        Logger.debug('[UpcomingBookOrchestrator] Invalid series information')
        return null
      }

      const { seriesName, authorName } = seriesInfo
      Logger.info(`[UpcomingBookOrchestrator] Request for "${seriesName}" by "${authorName}"`)

      // Check cache first (unless bypass is enabled)
      if (!options.bypassCache) {
        const cacheKey = this.buildCacheKey(seriesName, authorName)
        const cached = await this.getCachedResult(cacheKey, { ...options, seriesName, authorName })
        if (cached) {
          const responseTime = Date.now() - startTime
          this.updateAverageResponseTime(responseTime)
        this.stats.cacheHits++
          Logger.info(`[UpcomingBookOrchestrator] Cache hit - returning cached result (${responseTime}ms)`)
        return cached
        }
      } else {
        Logger.info(`[UpcomingBookOrchestrator] Cache bypassed - performing fresh discovery`)
      }

      this.stats.cacheMisses++

      // Perform discovery
      const result = await this.performDiscovery(libraryItem, allLibraryBooks, options)

      if (result) {
        this.stats.successfulDiscoveries++
        const responseTime = Date.now() - startTime
        this.updateAverageResponseTime(responseTime)
        Logger.info(`[UpcomingBookOrchestrator] Discovery successful (${responseTime}ms)`)

        // Cache the result (unless bypass is enabled)
        if (!options.bypassCache) {
          const cacheKey = this.buildCacheKey(seriesName, authorName)
          await this.cacheResult(cacheKey, result, seriesInfo)

          // Cache the cover image if available
          if (result.cover) {
            Logger.info(`[UpcomingBookOrchestrator] Caching cover for "${seriesName}" by "${authorName}": ${result.cover}`)
            await this.cacheCoverImage(result.cover, seriesName, authorName)
          } else {
            Logger.debug(`[UpcomingBookOrchestrator] No cover URL available for "${seriesName}" by "${authorName}"`)
          }
        }

        return result
      } else {
        this.stats.failedDiscoveries++
        const responseTime = Date.now() - startTime
        this.updateAverageResponseTime(responseTime)
        Logger.info(`[UpcomingBookOrchestrator] No upcoming book found (${responseTime}ms)`)
        return null
      }
    } catch (error) {
      this.stats.failedDiscoveries++
      const responseTime = Date.now() - startTime
      this.updateAverageResponseTime(responseTime)
      Logger.error('[UpcomingBookOrchestrator] Discovery failed:', error)
      return null
    }
  }

  /**
   * Clear cache for specific series and author
   */
  async clearCacheForSeries(seriesName, authorName) {
    try {
      if (!this.cache) return false

      const cacheKey = this.buildCacheKey(seriesName, authorName)
      const cleared = await this.cache.delete(cacheKey)

      if (cleared) {
        Logger.info(`[UpcomingBookOrchestrator] Cleared cache for key: ${cacheKey}`)
      } else {
        Logger.info(`[UpcomingBookOrchestrator] No cache found for key: ${cacheKey}`)
      }

      return cleared
    } catch (error) {
      Logger.error('[UpcomingBookOrchestrator] Failed to clear cache for series:', error)
      return false
    }
  }

  /**
   * Build cache key for series and author
   */
  buildCacheKey(seriesName, authorName) {
    const normalizedSeries = seriesName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const normalizedAuthor = authorName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    return `upcoming_${normalizedSeries}_${normalizedAuthor}`
  }

  /**
   * Get cached result
   */
  async getCachedResult(cacheKey, options) {
    try {
      if (!this.cache) return null

      const cached = await this.cache.get(cacheKey)
      if (!cached) return null

      // Debug: Log the entire cache structure
      Logger.info(`[UpcomingBookOrchestrator] Raw cache data:`, {
        cachedType: typeof cached,
        cachedKeys: Object.keys(cached),
        hasData: !!cached.data,
        hasTimestamp: !!cached.timestamp,
        dataType: typeof cached.data,
        dataKeys: cached.data ? Object.keys(cached.data) : [],
        title: cached.data?.title,
        author: cached.data?.author,
        timestamp: cached.timestamp,
        // Show actual object structure instead of stringified JSON
        dataStructure: {
          hasData: !!cached.data,
          dataKeys: cached.data ? Object.keys(cached.data) : [],
          dataType: typeof cached.data,
          isArray: Array.isArray(cached.data),
          nestedData: cached.data?.data
            ? {
                hasNestedData: !!cached.data.data,
                nestedKeys: Object.keys(cached.data.data || {}),
                nestedTitle: cached.data.data?.title,
                nestedAuthor: cached.data.data?.author
              }
            : null
        }
      })

      // Check if cache is still valid
      const cacheAge = Date.now() - cached.timestamp
      const cacheTTL = await this.adminSettings.getCacheSettings().then((s) => s.ttl.file)

      if (cacheAge > cacheTTL) {
        Logger.debug(`[UpcomingBookOrchestrator] Cache expired for key: ${cacheKey}`)
        return null
      }

      Logger.debug(`[UpcomingBookOrchestrator] Cache hit for key: ${cacheKey}`)

      // Extract book data from cache - handle the double-nested structure
      const bookData = cached.data?.data || cached.data

      // Debug: Log what we're actually returning
      Logger.debug(`[UpcomingBookOrchestrator] Returning book data:`, {
        hasBookData: !!bookData,
        bookDataType: typeof bookData,
        bookDataKeys: bookData ? Object.keys(bookData) : [],
        title: bookData?.title,
        author: bookData?.author,
        source: bookData?.source,
        cover: bookData?.cover
      })

      // Cache the cover image if it exists but hasn't been cached yet
      if (bookData?.cover) {
        const { seriesName, authorName } = options || {}
        if (seriesName && authorName) {
          Logger.info(`[UpcomingBookOrchestrator] Ensuring cover is cached for "${seriesName}" by "${authorName}": ${bookData.cover}`)
          await this.cacheCoverImage(bookData.cover, seriesName, authorName)
        }
      }

      return bookData
    } catch (error) {
      Logger.debug('[UpcomingBookOrchestrator] Cache retrieval failed:', error.message)
      return null
    }
  }

  /**
   * Perform discovery with the discovery service
   */
  async performDiscovery(libraryItem, allLibraryBooks, options) {
    try {
      if (!this.discoveryService) {
        Logger.error('[UpcomingBookOrchestrator] Discovery service not available')
        return null
      }

      const result = await this.discoveryService.discoverUpcomingBook(libraryItem, allLibraryBooks)

      if (result) {
        // Add orchestrator metadata
        result.orchestrator = {
          discoveredAt: new Date().toISOString(),
          cacheKey: this.buildCacheKey(result.title, result.author),
          source: result.source || 'unknown'
        }
      }

      return result
    } catch (error) {
      Logger.error('[UpcomingBookOrchestrator] Discovery service error:', error)
      return null
    }
  }

  /**
   * Cache the discovery result
   */
  async cacheResult(cacheKey, result, seriesInfo) {
    try {
      if (!this.cache) return

      // Create cache data with series info and metadata
      const cacheData = {
        ...result,
        seriesInfo: seriesInfo,
        metadata: {
          cachedBy: 'orchestrator',
          version: '1.0'
        }
      }

      await this.cache.set(cacheKey, cacheData)
      Logger.debug(`[UpcomingBookOrchestrator] Cached result for key: ${cacheKey}`)
    } catch (error) {
      Logger.debug('[UpcomingBookOrchestrator] Cache storage failed:', error.message)
    }
  }

  /**
   * Cache cover image
   */
  async cacheCoverImage(coverUrl, seriesName, authorName) {
    try {
      if (!this.cache) return

      const coverKey = await this.cache.cacheCover(coverUrl, seriesName, authorName)
      if (coverKey) {
        Logger.debug(`[UpcomingBookOrchestrator] Cover cached with key: ${coverKey}`)
      }
    } catch (error) {
      Logger.debug('[UpcomingBookOrchestrator] Cover caching failed:', error.message)
    }
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(responseTime) {
    const totalRequests = this.stats.totalRequests
    this.stats.averageResponseTime = (this.stats.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests
  }

  /**
   * Get orchestrator statistics
   */
  async getStats() {
    await this.initialize()

    const cacheStats = this.cache ? await this.cache.getStats() : null
    const discoveryHealth = this.discoveryService ? await this.discoveryService.healthCheck() : null
    const adminSummary = this.adminSettings ? await this.adminSettings.getSummary() : null

    return {
      orchestrator: {
        ...this.stats,
        initialized: this.initialized,
        uptime: Date.now() - this.stats.lastReset
      },
      cache: cacheStats,
      discovery: discoveryHealth,
      admin: adminSummary,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Clear all caches
   */
  async clearCache() {
    try {
      await this.initialize()

      if (this.cache) {
        await this.cache.clear()
        Logger.info('[UpcomingBookOrchestrator] Cache cleared')
      }

      if (this.discoveryService) {
        // Clear discovery service cache if it has one
        if (this.discoveryService.cache) {
          this.discoveryService.cache.clear()
        }
        Logger.info('[UpcomingBookOrchestrator] Discovery service cache cleared')
      }

      // Reset statistics
      this.stats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        successfulDiscoveries: 0,
        failedDiscoveries: 0,
        averageResponseTime: 0,
        lastReset: Date.now()
      }

      return { success: true, message: 'All caches cleared' }
    } catch (error) {
      Logger.error('[UpcomingBookOrchestrator] Cache clearing failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Perform maintenance tasks
   */
  async performMaintenance() {
    try {
      await this.initialize()

      const results = {
        cache: null,
        discovery: null,
        admin: null
      }

      // Cache maintenance
      if (this.cache) {
        results.cache = await this.cache.performMaintenance()
      }

      // Discovery service health check
      if (this.discoveryService) {
        results.discovery = await this.discoveryService.healthCheck()
      }

      // Admin settings health check
      if (this.adminSettings) {
        results.admin = await this.adminSettings.getHealthStatus()
      }

      Logger.info('[UpcomingBookOrchestrator] Maintenance completed')
      return results
    } catch (error) {
      Logger.error('[UpcomingBookOrchestrator] Maintenance failed:', error)
      return { error: error.message }
    }
  }

  /**
   * Health check for the orchestrator
   */
  async healthCheck() {
    try {
      await this.initialize()

      const health = {
        status: 'healthy',
        orchestrator: {
          initialized: this.initialized,
          uptime: Date.now() - this.stats.lastReset
        },
        services: {
          discovery: this.discoveryService ? 'available' : 'unavailable',
          cache: this.cache ? 'available' : 'unavailable',
          admin: this.adminSettings ? 'available' : 'unavailable'
        },
        statistics: this.stats,
        timestamp: new Date().toISOString()
      }

      // Check service health
      if (this.discoveryService) {
        const discoveryHealth = await this.discoveryService.healthCheck()
        health.discovery = discoveryHealth
        if (discoveryHealth.status !== 'healthy') {
          health.status = 'degraded'
        }
      }

      if (this.adminSettings) {
        const adminHealth = await this.adminSettings.getHealthStatus()
        health.admin = adminHealth
        if (adminHealth.status !== 'healthy') {
          health.status = 'degraded'
        }
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

  /**
   * Force restart of the orchestrator
   */
  async forceRestart() {
    try {
      Logger.info('[UpcomingBookOrchestrator] Force restart requested')

      this.initialized = false
      this.discoveryService = null
      this.cache = null
      this.adminSettings = null

      // Reset statistics
      this.stats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        successfulDiscoveries: 0,
        failedDiscoveries: 0,
        averageResponseTime: 0,
        lastReset: Date.now()
      }

      // Re-initialize
      await this.initialize()

      Logger.info('[UpcomingBookOrchestrator] Force restart completed')
      return { success: true, message: 'Orchestrator restarted successfully' }
    } catch (error) {
      Logger.error('[UpcomingBookOrchestrator] Force restart failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      Logger.info('[UpcomingBookOrchestrator] Cleaning up resources')

      // Cleanup cache if available
      if (this.cache) {
        await this.cache.cleanup()
      }

      // Reset state
      this.initialized = false
      this.discoveryService = null
      this.cache = null
      this.adminSettings = null
    
    Logger.info('[UpcomingBookOrchestrator] Cleanup completed')
    } catch (error) {
      Logger.error('[UpcomingBookOrchestrator] Cleanup failed:', error)
    }
  }
}

module.exports = UpcomingBookOrchestrator
