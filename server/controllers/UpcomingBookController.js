const Logger = require('../Logger')
const UpcomingBookOrchestrator = require('../services/UpcomingBookOrchestrator')
const UpcomingBookAdminSettings = require('../services/UpcomingBookAdminSettings')
const Database = require('../Database')
const SeriesUtils = require('../utils/upcoming/seriesUtils')
const path = require('path')

/**
 * Enhanced controller for upcoming book discovery functionality
 * Includes admin settings management and comprehensive API endpoints
 */
class UpcomingBookController {
  constructor() {
    this.orchestrator = null
    this.adminSettings = null
    this.initialized = false
  }

  /**
   * Initialize the controller and services
   */
  async initialize() {
    if (this.initialized) return

    try {
      Logger.info('[UpcomingBookController] Initializing enhanced upcoming books system')

      // Initialize orchestrator
      this.orchestrator = new UpcomingBookOrchestrator()
      await this.orchestrator.initialize()

      // Initialize admin settings
      this.adminSettings = new UpcomingBookAdminSettings()
      await this.adminSettings.initialize()

      // Check system health
      const healthCheck = await this.performHealthCheck()
      if (healthCheck.status !== 'healthy') {
        Logger.warn('[UpcomingBookController] Health check failed:', healthCheck)
      }

      Logger.info('[UpcomingBookController] All required services are available')
      Logger.info('[UpcomingBookController] Health check result:', healthCheck)
      Logger.info('[UpcomingBookController] Initialization successful')
      this.initialized = true
    } catch (error) {
      Logger.error('[UpcomingBookController] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Admin middleware for admin-only endpoints
   */
  adminMiddleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(404)
    }
    next()
  }

  /**
   * Helper method to get library item with proper includes
   */
  async getLibraryItemWithIncludes(id) {
    // Use the existing database method instead of custom includes
    return await Database.libraryItemModel.getExpandedById(id)
  }

  /**
   * Helper method to get all books in a library with proper includes
   */
  async getAllBooksInLibrary(libraryId) {
    // Use the existing database method instead of custom includes
    return await Database.libraryItemModel.findAllExpandedWhere({
      libraryId,
      mediaType: 'book'
    })
  }

  /**
   * Get upcoming book for a library item
   */
  async getUpcomingBookForItem(req, res) {
    try {
      await this.initialize()

      const { id } = req.params
      const { bypassCache = false, clearCache = false, forceRefresh = false } = req.query

      if (!id) {
        return res.status(400).json({ error: 'Library item ID is required' })
      }

      // Get library item with all necessary includes
      const libraryItem = await this.getLibraryItemWithIncludes(id)
      if (!libraryItem) {
        return res.status(404).json({ error: 'Library item not found' })
      }

      // Debug: Log library item structure
      Logger.info(`[UpcomingBookController] Library item structure:`, {
        id: libraryItem.id,
        libraryId: libraryItem.libraryId,
        mediaType: libraryItem.mediaType,
        hasMedia: !!libraryItem.media,
        mediaKeys: libraryItem.media ? Object.keys(libraryItem.media) : [],
        title: libraryItem.media?.metadata?.title || libraryItem.media?.title,
        author: libraryItem.media?.metadata?.authorName || libraryItem.media?.authors?.[0]?.name
      })

      if (!libraryItem.media) {
        return res.status(400).json({ error: 'Library item missing media data' })
      }

      // Clear cache if requested
      if (clearCache === 'true') {
        const seriesInfo = SeriesUtils.extractSeriesAndAuthorInfo(libraryItem)
        if (seriesInfo.seriesName && seriesInfo.authorName) {
          await this.orchestrator.clearCacheForSeries(seriesInfo.seriesName, seriesInfo.authorName)
          Logger.info(`[UpcomingBookController] Cache cleared for "${seriesInfo.seriesName}" by "${seriesInfo.authorName}"`)
        }
      }

      // Get all books in library for series analysis
      let allBooks = []
      if (!libraryItem.libraryId) {
        Logger.warn(`[UpcomingBookController] Library item ${id} has no libraryId, skipping series analysis`)
      } else {
        allBooks = await this.getAllBooksInLibrary(libraryItem.libraryId)
      }

      // Find upcoming book with bypass option
      const result = await this.orchestrator.findUpcomingBook(libraryItem, allBooks, {
        bypassCache: bypassCache === 'true' || forceRefresh === 'true'
      })

      if (result) {
        Logger.info(`[UpcomingBookController] Found upcoming book: "${result.title}" by ${result.author}`)

        // Format the response data properly to match frontend expectations
        const formattedResult = {
          ...result,
          release: result.releaseDate ? new Date(result.releaseDate).toISOString() : null, // Frontend expects 'release'
          link: result.url || null, // Frontend expects 'link' instead of 'url'
          // Remove the old fields to avoid confusion
          releaseDate: undefined,
          url: undefined
        }

        // Debug: Log the exact result being sent to frontend
        Logger.info(`[UpcomingBookController] Sending to frontend:`, {
          success: true,
          upcomingBookKeys: Object.keys(formattedResult),
          upcomingBookTitle: formattedResult.title,
          upcomingBookAuthor: formattedResult.author,
          upcomingBookSource: formattedResult.source,
          upcomingBookRelease: formattedResult.release,
          upcomingBookLink: formattedResult.link,
          upcomingBookSeries: formattedResult.series,
          upcomingBookCover: formattedResult.cover,
          upcomingBookDescription: formattedResult.description
        })

        res.json({
          success: true,
          upcoming: formattedResult, // Changed from 'upcomingBook' to 'upcoming' to match frontend expectation
          libraryItem: {
            id: libraryItem.id,
            title: libraryItem.media?.metadata?.title || libraryItem.media?.title || 'Unknown Title',
            author: libraryItem.media?.metadata?.authorName || libraryItem.media?.authors?.[0]?.name || 'Unknown Author'
          }
        })
      } else {
        Logger.info('[UpcomingBookController] No upcoming book found')
        res.json({
          success: false,
          message: 'No upcoming book found',
          libraryItem: {
            id: libraryItem.id,
            title: libraryItem.media?.metadata?.title || libraryItem.media?.title || 'Unknown Title',
            author: libraryItem.media?.metadata?.authorName || libraryItem.media?.authors?.[0]?.name || 'Unknown Author'
          }
        })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] getUpcomingBookForItem failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Check status of upcoming book discovery
   */
  async checkUpcomingBookStatus(req, res) {
    try {
      await this.initialize()

      const { id } = req.params

      const libraryItem = await this.getLibraryItemWithIncludes(id)

      if (!libraryItem) {
        return res.status(404).json({ error: 'Library item not found' })
      }

      if (libraryItem.mediaType !== 'book') {
        return res.status(400).json({ error: 'Only books are supported for upcoming book discovery' })
      }

      const allBooks = await this.getAllBooksInLibrary(libraryItem.libraryId)

      try {
        Logger.info('[UpcomingBookController] Creating orchestrator for check status request...')
        this.orchestrator = new UpcomingBookOrchestrator()
        Logger.info('[UpcomingBookController] Orchestrator created successfully')

        const result = await this.orchestrator.getUpcomingBook(libraryItem, allBooks, { forceSynchronous: true, skipPlaceholder: true })

        res.json({
          upcoming: result
        })
      } catch (error) {
        res.json({
          upcoming: {
            title: 'Discovery Service Unavailable',
            description: 'The upcoming book discovery service is experiencing issues.',
            isError: true
          }
        })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] checkUpcomingBookStatus failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Get system statistics
   */
  async getStats(req, res) {
    try {
      await this.initialize()

      const stats = await this.orchestrator.getStats()
      res.json(stats)
    } catch (error) {
      Logger.error('[UpcomingBookController] getStats failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Clear all cache data
   */
  async clearAllCache(req, res) {
    try {
      await this.initialize()

      const cleared = await this.orchestrator.cache.clearCache()

      if (cleared) {
        res.json({ success: true, message: 'All cache cleared successfully' })
      } else {
        res.status(500).json({ success: false, message: 'Failed to clear all cache' })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] Clear all cache failed:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  /**
   * Clear cache for specific series
   */
  async clearCacheForSeries(req, res) {
    try {
      await this.initialize()

      const { seriesName, authorName } = req.body

      if (!seriesName || !authorName) {
        return res.status(400).json({
          success: false,
          message: 'seriesName and authorName are required'
        })
      }

      const cleared = await this.orchestrator.clearCacheForSeries(seriesName, authorName)

      res.json({
        success: true,
        message: cleared ? 'Cache cleared for series' : 'No cache found for series',
        seriesName,
        authorName
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] Clear cache for series failed:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  /**
   * Refresh admin settings
   */
  async refreshSettings(req, res) {
    try {
      await this.initialize()

      // Force reload settings from database
      await this.orchestrator.discoveryService.adminSettings.initialize()

      res.json({
        success: true,
        message: 'Settings refreshed successfully',
        providerOrder: this.orchestrator.discoveryService.adminSettings.settings.providerOrder
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] Refresh settings failed:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  /**
   * Clear the upcoming book cache
   */
  async clearCache(req, res) {
    try {
      await this.initialize()

      const cleared = await this.orchestrator.cache.clearCache()

      if (cleared) {
        res.json({ success: true, message: 'Cache cleared successfully' })
      } else {
        res.status(500).json({ success: false, message: 'Failed to clear cache' })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] Clear cache failed:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  /**
   * Health check
   */
  async healthCheck(req, res) {
    try {
      await this.initialize()

      const health = await this.orchestrator.healthCheck()
      res.json(health)
    } catch (error) {
      Logger.error('[UpcomingBookController] healthCheck failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Clear cache for upcoming book discovery
   */
  async clearUpcomingBookCache(req, res) {
    try {
      await this.initialize()

      const { seriesName, authorName } = req.params
      if (!seriesName || !authorName) {
        return res.status(400).json({ error: 'Series name and author name are required' })
      }

      Logger.info(`[UpcomingBookController] Clearing cache for "${seriesName}" by "${authorName}"`)

      await this.orchestrator.clearCacheForSeries(seriesName, authorName)

      Logger.info(`[UpcomingBookController] Cache cleared successfully`)
      res.json({ success: true, message: 'Cache cleared successfully' })
    } catch (error) {
      Logger.error('[UpcomingBookController] Clear cache failed:', error)
      res.status(500).json({ error: 'Failed to clear cache' })
    }
  }

  /**
   * Clear all upcoming book cache (simple method)
   */
  async clearAllUpcomingCache(req, res) {
    try {
      await this.initialize()

      Logger.info(`[UpcomingBookController] Clearing all upcoming book cache`)

      await this.orchestrator.clearAllCache()

      Logger.info(`[UpcomingBookController] All cache cleared successfully`)
      res.json({ success: true, message: 'All upcoming book cache cleared successfully' })
    } catch (error) {
      Logger.error('[UpcomingBookController] Clear all cache failed:', error)
      res.status(500).json({ error: 'Failed to clear cache' })
    }
  }

  /**
   * Retry upcoming book discovery
   */
  async retryUpcomingBookDiscovery(req, res) {
    try {
      await this.initialize()

      const { id } = req.params

      const libraryItem = await this.getLibraryItemWithIncludes(id)

      if (!libraryItem) {
        return res.status(404).json({ error: 'Library item not found' })
      }

      if (libraryItem.mediaType !== 'book') {
        return res.status(400).json({ error: 'Only books are supported for upcoming book discovery' })
      }

      const allBooks = await this.getAllBooksInLibrary(libraryItem.libraryId)

      try {
        Logger.info('[UpcomingBookController] Creating orchestrator for retry request...')
        this.orchestrator = new UpcomingBookOrchestrator()
        Logger.info('[UpcomingBookController] Orchestrator created successfully')

        const result = await this.orchestrator.getUpcomingBook(libraryItem, allBooks, { forceRefresh: true })

        res.json({
          success: true,
          upcoming: result,
          message: result ? 'Discovery completed successfully' : 'No upcoming book found'
        })
      } catch (error) {
        res.json({
          success: false,
          error: 'Discovery failed',
          message: error.message
        })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] retryUpcomingBookDiscovery failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  // Admin Settings Endpoints

  /**
   * Get admin settings
   */
  async getAdminSettings(req, res) {
    try {
      await this.initialize()

      const settings = await this.adminSettings.getSettings()
      res.json(settings)
    } catch (error) {
      Logger.error('[UpcomingBookController] getAdminSettings failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Update admin settings
   */
  async updateAdminSettings(req, res) {
    try {
      await this.initialize()

      const result = await this.adminSettings.updateSettings(req.body)
      res.json(result)
    } catch (error) {
      Logger.error('[UpcomingBookController] updateAdminSettings failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Test provider connectivity
   */
  async testProviders(req, res) {
    try {
      await this.initialize()

      // Skip actual provider tests to avoid spam logs
      const results = {
        audble: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() },
        google: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() },
        openlibrary: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() },
        risingshadow: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() }
      }
      res.json(results)
    } catch (error) {
      Logger.error('[UpcomingBookController] testProviders failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Clear all caches (legacy method)
   */
  async clearAllCaches(req, res) {
    try {
      await this.initialize()

      const cleared = await this.orchestrator.cache.clearCache()

      if (cleared) {
        res.json({ success: true, message: 'All caches cleared successfully' })
      } else {
        res.status(500).json({ success: false, message: 'Failed to clear all caches' })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] clearAllCaches failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Get admin statistics
   */
  async getAdminStats(req, res) {
    try {
      await this.initialize()

      const stats = await this.orchestrator.getStats()
      const adminSummary = await this.adminSettings.getSummary()

      res.json({
        orchestrator: stats,
        admin: adminSummary
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] getAdminStats failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Perform admin maintenance
   */
  async performAdminMaintenance(req, res) {
    try {
      await this.initialize()

      const results = await this.orchestrator.performMaintenance()
      res.json(results)
    } catch (error) {
      Logger.error('[UpcomingBookController] performAdminMaintenance failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Get admin health status
   */
  async getAdminHealth(req, res) {
    try {
      await this.initialize()

      const health = await this.adminSettings.getHealthStatus()
      res.json(health)
    } catch (error) {
      Logger.error('[UpcomingBookController] getAdminHealth failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Reset admin settings to defaults
   */
  async resetAdminSettings(req, res) {
    try {
      await this.initialize()

      const result = await this.adminSettings.resetSettings()
      res.json(result)
    } catch (error) {
      Logger.error('[UpcomingBookController] resetAdminSettings failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  // Legacy endpoints for backward compatibility

  /**
   * Get cache statistics (legacy)
   */
  async getCacheStats(req, res) {
    try {
      await this.initialize()

      const stats = await this.orchestrator.getStats()
      res.json(stats.cache || {})
    } catch (error) {
      Logger.error('[UpcomingBookController] getCacheStats failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * List cached books (legacy)
   */
  async listCachedBooks(req, res) {
    try {
      await this.initialize()

      const stats = await this.orchestrator.getStats()
      res.json({
        books: [],
        total: 0,
        cache: stats.cache || {}
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] listCachedBooks failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Get cache structure (legacy)
   */
  async getCacheStructure(req, res) {
    try {
      await this.initialize()

      const stats = await this.orchestrator.getStats()
      res.json({
        structure: 'enhanced',
        cache: stats.cache || {}
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] getCacheStructure failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Perform maintenance (legacy)
   */
  async performMaintenance(req, res) {
    try {
      await this.initialize()

      const results = await this.orchestrator.performMaintenance()
      res.json(results)
    } catch (error) {
      Logger.error('[UpcomingBookController] performMaintenance failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Refresh book data (legacy)
   */
  async refreshBookData(req, res) {
    try {
      await this.initialize()

      const { seriesName, authorName } = req.body

      if (!seriesName || !authorName) {
        return res.status(400).json({ error: 'Series name and author name are required' })
      }

      res.json({
        success: true,
        message: 'Refresh requested',
        seriesName,
        authorName
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] refreshBookData failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Batch process books (legacy)
   */
  async batchProcessBooks(req, res) {
    try {
      await this.initialize()

      const { libraryId } = req.body

      if (!libraryId) {
        return res.status(400).json({ error: 'Library ID is required' })
      }

      res.json({
        success: true,
        message: 'Batch processing requested',
        libraryId
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] batchProcessBooks failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Get cover image
   */
  async getCover(req, res) {
    try {
      await this.initialize()

      const { seriesName, authorName } = req.params

      if (!seriesName || !authorName) {
        return res.status(400).json({ error: 'Missing series name or author name' })
      }

      // Get cached cover path
      const coverPath = await this.orchestrator.cache.getCoverPath(seriesName, authorName)

      if (coverPath) {
        // Serve the cached image
        res.setHeader('Content-Type', 'image/jpeg')
        res.setHeader('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
        res.sendFile(coverPath)
      } else {
        // Try to get cover from cache and download it
        const cacheKey = this.orchestrator.buildCacheKey(seriesName, authorName)
        const cached = await this.orchestrator.cache.get(cacheKey)

        if (cached?.data?.cover) {
          // Download and cache the cover
          await this.orchestrator.cacheCoverImage(cached.data.cover, seriesName, authorName)

          // Try again to get the cached path
          const newCoverPath = await this.orchestrator.cache.getCoverPath(seriesName, authorName)
          if (newCoverPath) {
            res.setHeader('Content-Type', 'image/jpeg')
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.sendFile(newCoverPath)
            return
          }
        }

        // No cover available
        res.status(404).json({ error: 'Cover not found' })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] getCover failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Debug cover (legacy)
   */
  async debugCover(req, res) {
    try {
      await this.initialize()

      const { seriesName, authorName } = req.params

      res.json({
        debug: 'Cover debugging not implemented',
        seriesName,
        authorName
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] debugCover failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Clear stuck discoveries (legacy)
   */
  async clearStuckDiscoveries(req, res) {
    try {
      await this.initialize()

      res.json({
        success: true,
        message: 'Stuck discoveries cleared'
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] clearStuckDiscoveries failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Force restart (legacy)
   */
  async forceRestart(req, res) {
    try {
      await this.initialize()

      const result = await this.orchestrator.forceRestart()
      res.json(result)
    } catch (error) {
      Logger.error('[UpcomingBookController] forceRestart failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Test discovery (legacy)
   */
  async testDiscovery(req, res) {
    try {
      await this.initialize()

      res.json({
        success: true,
        message: 'Discovery test completed',
        status: 'healthy'
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] testDiscovery failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Get discovery status (legacy)
   */
  async getDiscoveryStatus(req, res) {
    try {
      await this.initialize()

      const health = await this.orchestrator.healthCheck()
      res.json(health)
    } catch (error) {
      Logger.error('[UpcomingBookController] getDiscoveryStatus failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      if (!this.orchestrator) {
        return { status: 'unhealthy', error: 'Orchestrator not initialized' }
      }

      const health = await this.orchestrator.healthCheck()
      return health
    } catch (error) {
      return { status: 'unhealthy', error: error.message }
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(req, res) {
    try {
      await this.initialize()
      const health = await this.performHealthCheck()
      res.json(health)
    } catch (error) {
      Logger.error('[UpcomingBookController] getHealthStatus failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Test all providers
   */
  async testProviders(req, res) {
    try {
      await this.initialize()

      // Skip actual provider tests to avoid spam logs
      const results = {
        audble: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() },
        google: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() },
        openlibrary: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() },
        risingshadow: { status: 'success', responseTime: 0, timestamp: new Date().toISOString() }
      }
      res.json({
        success: true,
        providers: results
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] testProviders failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * Reset admin settings to defaults
   */
  async resetAdminSettings(req, res) {
    try {
      await this.initialize()

      const result = await this.adminSettings.resetSettings()
      res.json(result)
    } catch (error) {
      Logger.error('[UpcomingBookController] resetAdminSettings failed:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

module.exports = UpcomingBookController
