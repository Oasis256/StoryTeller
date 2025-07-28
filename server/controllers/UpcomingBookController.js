// UpcomingBookController.js (Integrated with /metadata/cache/upcoming)
const Database = require('../Database')
const Logger = require('../Logger')
const UpcomingBookService = require('../services/UpcomingBookService')

module.exports = {
  /**
   * GET /api/items/:id/upcoming
   * Returns info about the next Upcoming Book in the series, or null if not last in series or not found.
   */
  async getUpcomingBook(req, res) {
    try {
      // Logger.info('[UpcomingBookController-TRACE] ENTERED FUNCTION')

      // Ensure the cache is initialized on first use
      const initialized = await UpcomingBookService.initialize()
      if (!initialized) {
        Logger.error('[UpcomingBookController 1.0] Failed to initialize upcoming books cache')
        return res.status(500).json({
          error: 'Failed to initialize cache',
          book: null
        })
      }

      const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
      if (!libraryItem || !libraryItem.media) {
        Logger.info('[UpcomingBookController 1.1] No libraryItem or media found')
        Logger.info('[UpcomingBookController-TRACE] RETURNING: no libraryItem or media')
        return res.json({ book: null })
      }

      // Logger.info('[UpcomingBookController 1.2] Book Name:', libraryItem.media.title)
      // Logger.info('[UpcomingBookController 1.3] Author:', libraryItem.media.authorName)

      // Get all books in the library for series analysis
      const allBooks = await Database.libraryItemModel.findAllExpandedWhere({
        libraryId: libraryItem.libraryId,
        mediaType: 'book'
      })

      // Use the service to get Upcoming Book info
      // This will handle caching in /metadata/cache/upcoming automatically
      const bookInfo = await UpcomingBookService.getUpcomingBookInfo(libraryItem, allBooks)

      if (!bookInfo) {
        Logger.info('[UpcomingBookController 1.4] No Upcoming Book info found')
        // Logger.info('[UpcomingBookController-TRACE] RETURNING: no Upcoming Book')
        return res.json({ book: null })
      }

      // Logger.info('[UpcomingBookController-TRACE 1.5] RETURNING: success with book info')
      res.json({ book: bookInfo })
    } catch (error) {
      Logger.error('[UpcomingBookController] Error:', error)
      // Logger.info('[UpcomingBookController-TRACE 1.6] RETURNING: exception thrown')
      res.status(500).json({
        error: 'Internal server error',
        book: null
      })
    }
  },

  /**
   * GET /api/upcoming/cache/stats
   * Returns statistics about the upcoming books cache in /metadata/cache/upcoming.
   */
  async getCacheStats(req, res) {
    try {
      const stats = await UpcomingBookService.getCacheStats()
      res.json({
        success: true,
        stats: stats
      })
    } catch (error) {
      Logger.error('[UpcomingBookController 2.0] Error getting cache stats:', error)
      res.status(500).json({
        success: false,
        error: 'Error getting cache statistics'
      })
    }
  },

  /**
   * GET /api/upcoming/cache/list
   * Lists all cached upcoming books with details.
   */
  async listCachedBooks(req, res) {
    try {
      const books = await UpcomingBookService.listCachedBooks()
      res.json({
        success: true,
        count: books.length,
        books: books
      })
    } catch (error) {
      Logger.error('[UpcomingBookController 3.0] Error listing cached books:', error)
      res.status(500).json({
        success: false,
        error: 'Error listing cached books'
      })
    }
  },

  /**
   * DELETE /api/upcoming/cache
   * Clears all cached Upcoming Book data from /metadata/cache/upcoming.
   */
  async clearCache(req, res) {
    try {
      const result = await UpcomingBookService.clearAllCache()

      if (result.error) {
        res.status(500).json({
          success: false,
          error: result.error
        })
      } else {
        Logger.info(`[UpcomingBookController 4.0] Cache cleared: ${result.cleared} entries`)
        res.json({
          success: true,
          message: `Cleared ${result.cleared} cached books`,
          cleared: result.cleared
        })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController 4.1] Error clearing cache:', error)
      res.status(500).json({
        success: false,
        error: 'Error clearing cache'
      })
    }
  },

  /**
   * POST /api/upcoming/cache/maintenance
   * Performs maintenance on the cache (cleanup expired entries, verify files).
   */
  async performMaintenance(req, res) {
    try {
      const result = await UpcomingBookService.performMaintenance()

      if (result.error) {
        res.status(500).json({
          success: false,
          error: result.error
        })
      } else {
        Logger.info(`[UpcomingBookController 5.0] Maintenance completed:`, result)
        res.json({
          success: true,
          message: 'Maintenance completed successfully',
          result: result
        })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController 5.1] Error during maintenance:', error)
      res.status(500).json({
        success: false,
        error: 'Error during maintenance'
      })
    }
  },

  /**
   * POST /api/upcoming/refresh
   * Manually refreshes Upcoming Book data for a specific series/author.
   * Body: { seriesName: string, authorName: string }
   */
  async refreshBookData(req, res) {
    try {
      const { seriesName, authorName } = req.body

      if (!seriesName || !authorName) {
        return res.status(400).json({
          success: false,
          error: 'seriesName and authorName are required'
        })
      }

      const refreshedData = await UpcomingBookService.refreshBookData(seriesName, authorName)

      if (!refreshedData) {
        res.json({
          success: true,
          message: 'No Upcoming Book found for this series/author',
          book: null
        })
      } else {
        res.json({
          success: true,
          message: 'Book data refreshed successfully',
          book: refreshedData
        })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController 6.0] Error refreshing book data:', error)
      res.status(500).json({
        success: false,
        error: 'Error refreshing book data'
      })
    }
  },

  /**
   * GET /api/upcoming/cache/structure
   * Returns the directory structure of the cache for debugging.
   */
  async getCacheStructure(req, res) {
    try {
      const structure = await UpcomingBookService.getDirectoryStructure()
      res.json({
        success: true,
        structure: structure
      })
    } catch (error) {
      Logger.error('[UpcomingBookController 7.0] Error getting cache structure:', error)
      res.status(500).json({
        success: false,
        error: 'Error getting cache structure'
      })
    }
  },

  /**
   * POST /api/upcoming/batch-process
   * Batch processes multiple library items to find upcoming books.
   * Body: { libraryItemIds: string[], maxConcurrent?: number }
   */
  async batchProcessBooks(req, res) {
    try {
      const { libraryItemIds, maxConcurrent = 3 } = req.body

      if (!Array.isArray(libraryItemIds) || libraryItemIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'libraryItemIds array is required'
        })
      }

      // Get library items
      const libraryItems = []
      for (const id of libraryItemIds) {
        const item = await Database.libraryItemModel.getExpandedById(id)
        if (item && item.media) {
          libraryItems.push(item)
        }
      }

      if (libraryItems.length === 0) {
        return res.json({
          success: true,
          message: 'No valid library items found',
          results: []
        })
      }

      // Get all books for series analysis
      const allBooks = await Database.libraryItemModel.findAllExpandedWhere({
        mediaType: 'book'
      })

      // Process batch
      const results = await UpcomingBookService.batchProcessUpcomingBooks(libraryItems, allBooks, { maxConcurrent })

      res.json({
        success: true,
        processed: libraryItems.length,
        found: results.length,
        results: results
      })
    } catch (error) {
      Logger.error('[UpcomingBookController 8.0] Error in batch processing:', error)
      res.status(500).json({
        success: false,
        error: 'Error in batch processing'
      })
    }
  },
  // Add this method to your UpcomingBookController.js
  // Add this temporary debug method to your UpcomingBookController.js

  /**
   * GET /api/upcoming/debug-cover/:seriesName/:authorName
   * Debug endpoint to check cover file paths and existence.
   */
  async debugCover(req, res) {
    try {
      const { seriesName, authorName } = req.params
      const decodedSeries = decodeURIComponent(seriesName)
      const decodedAuthor = decodeURIComponent(authorName)

      Logger.info(`[UpcomingBookController 9.0] Debug cover for: "${decodedSeries}" by "${decodedAuthor}"`)

      const storage = UpcomingBookService.getStorage()
      const paths = storage.getStoragePaths(decodedSeries, decodedAuthor)

      const fs = require('fs').promises
      const path = require('path')

      // Check directory existence
      let dirExists = false
      let dirContents = []
      try {
        await fs.access(paths.directory)
        dirExists = true
        dirContents = await fs.readdir(paths.directory)
      } catch (e) {
        Logger.warn(`[UpcomingBookController 9.1] Directory doesn't exist: ${paths.directory}`)
      }

      // Check specific cover file
      let coverExists = false
      let coverStats = null
      try {
        await fs.access(paths.coverFile)
        coverExists = true
        coverStats = await fs.stat(paths.coverFile)
      } catch (e) {
        Logger.warn(`[UpcomingBookController 9.2] Cover file doesn't exist: ${paths.coverFile}`)
      }

      // Try alternative extensions
      const possibleExtensions = ['.webp', '.jpg', '.jpeg', '.png']
      const alternativeFiles = []

      for (const ext of possibleExtensions) {
        const altPath = path.join(paths.directory, `cover${ext}`)
        try {
          await fs.access(altPath)
          const stats = await fs.stat(altPath)
          alternativeFiles.push({
            path: altPath,
            exists: true,
            size: stats.size,
            extension: ext
          })
        } catch {
          alternativeFiles.push({
            path: altPath,
            exists: false,
            extension: ext
          })
        }
      }

      const debugInfo = {
        input: {
          seriesName,
          authorName,
          decodedSeries,
          decodedAuthor
        },
        paths: {
          directory: paths.directory,
          coverFile: paths.coverFile,
          expectedExtension: path.extname(paths.coverFile)
        },
        fileSystem: {
          directoryExists: dirExists,
          directoryContents: dirContents,
          coverFileExists: coverExists,
          coverFileStats: coverStats
            ? {
                size: coverStats.size,
                modified: coverStats.mtime
              }
            : null
        },
        alternativeFiles: alternativeFiles,
        cacheInfo: {
          baseDir: '/metadata/cache/upcoming',
          fullPath: paths.coverFile
        }
      }

      Logger.info(`[UpcomingBookController 9.3] Debug info:`, debugInfo)

      res.json({
        success: true,
        debug: debugInfo
      })
    } catch (error) {
      Logger.error('[UpcomingBookController 9.4] Debug cover error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  },
  /**
   * GET /api/upcoming/cover/:seriesName/:authorName
   * Serves cached cover images for upcoming books.
   * FIXED: Now tries multiple file extensions to find the actual cover file.
   */
  async getCover(req, res) {
    try {
      const { seriesName, authorName } = req.params

      if (!seriesName || !authorName) {
        Logger.warn('[UpcomingBookController] getCover: Missing seriesName or authorName')
        return res.status(400).json({
          success: false,
          error: 'seriesName and authorName are required'
        })
      }

      const decodedSeries = decodeURIComponent(seriesName)
      const decodedAuthor = decodeURIComponent(authorName)

      Logger.info(`[UpcomingBookController 10.0] Serving cover for: "${decodedSeries}" by "${decodedAuthor}"`)

      const storage = UpcomingBookService.getStorage()
      const fs = require('fs').promises
      const path = require('path')

      // Try multiple extensions since we don't know which one was downloaded
      const possibleExtensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif']

      let foundCoverPath = null
      let foundExtension = null

      for (const ext of possibleExtensions) {
        const paths = storage.getStoragePaths(decodedSeries, decodedAuthor, ext)
        Logger.debug(`[UpcomingBookController 10.1] Checking: ${paths.coverFile}`)

        try {
          await fs.access(paths.coverFile)
          foundCoverPath = paths.coverFile
          foundExtension = ext
          Logger.info(`[UpcomingBookController 10.2] Found cover at: ${foundCoverPath}`)
          break
        } catch (error) {
          Logger.debug(`[UpcomingBookController 10.3] Not found with ${ext} extension`)
          continue
        }
      }

      if (!foundCoverPath) {
        Logger.warn(`[UpcomingBookController 10.4] No cover file found for: "${decodedSeries}" by "${decodedAuthor}"`)
        return res.status(404).json({
          success: false,
          error: 'Cover image not found'
        })
      }

      // Determine content type from file extension
      let contentType = 'image/jpeg' // default

      switch (foundExtension.toLowerCase()) {
        case '.png':
          contentType = 'image/png'
          break
        case '.webp':
          contentType = 'image/webp'
          break
        case '.gif':
          contentType = 'image/gif'
          break
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg'
          break
      }

      Logger.debug(`[UpcomingBookController 10.5] Serving as ${contentType}`)

      // Set headers
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        ETag: `"upcoming-${seriesName}-${authorName}-${foundExtension}"`
      })

      // Stream the file
      const fileStream = require('fs').createReadStream(foundCoverPath)
      fileStream.pipe(res)

      Logger.info(`[UpcomingBookController 10.6] Successfully served cover: ${foundCoverPath}`)
    } catch (error) {
      Logger.error('[UpcomingBookController 10.7] Error serving cover:', error)
      res.status(500).json({
        success: false,
        error: 'Error serving cover image'
      })
    }
  },

  /**
   * GET /api/upcoming/health
   * Health check endpoint for the upcoming books feature.
   */
  async healthCheck(req, res) {
    try {
      // Check if cache directory is accessible
      const initialized = await UpcomingBookService.initialize()
      const stats = await UpcomingBookService.getCacheStats()

      const health = {
        status: initialized ? 'healthy' : 'unhealthy',
        cacheInitialized: initialized,
        cacheDirectory: '/metadata/cache/upcoming',
        stats: stats,
        timestamp: new Date().toISOString()
      }

      const statusCode = initialized ? 200 : 503
      res.status(statusCode).json(health)
    } catch (error) {
      Logger.error('[UpcomingBookController 11.0] Health check error:', error)
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }
}
// End of UpcomingBookController.js
// This controller handles all endpoints related to upcoming books, including cache management, batch processing, and health checks.
