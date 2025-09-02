const { Request, Response } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')

// Import utility modules for upcoming books functionality
const RisingShadowScraper = require('../utils/upcoming/risingShadowScraper')
const SeriesUtils = require('../utils/upcoming/seriesUtils')
const MetadataCacheStorageManager = require('../utils/upcoming/metadataCacheStorageManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class UpcomingBookController {
  constructor() {
    this._storage = null
  }

  /**
   * Gets the storage manager instance configured for metadata cache directory.
   */
  getStorage() {
    if (!this._storage) {
      this._storage = MetadataCacheStorageManager.createFromAppConfig({
        metadataCacheDir: '/metadata/cache'
      })
    }
    return this._storage
  }

  /**
   * Initializes the upcoming books cache within existing metadata cache structure.
   */
  async initialize() {
    try {
      const storage = this.getStorage()
      const success = await storage.ensureBaseDirectory()

      if (success) {
        const stats = await storage.getCacheStats()
        return true
      } else {
        Logger.error('[UpcomingBookController] Failed to initialize cache directory')
        return false
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] Initialization error:', error)
      return false
    }
  }

  /**
   * Main method to get upcoming book information.
   */
  async getUpcomingBookInfo(libraryItem, allLibraryBooks) {
    try {
      // Extract series and author information
      const seriesInfo = SeriesUtils.extractSeriesAndAuthorInfo(libraryItem)
      if (!SeriesUtils.validateSeriesInfo(seriesInfo)) {
        Logger.info('[UpcomingBookController] Invalid series or author information')
        return null
      }

      const { series: seriesObj, seriesName, authorName } = seriesInfo

      // Check if this book is the last in the series
      const seriesBooks = SeriesUtils.getBooksInSeries(allLibraryBooks, seriesName)
      const maxSequence = SeriesUtils.getMaxSequenceInSeries(seriesBooks)
      const currentSequence = SeriesUtils.getCurrentBookSequence(seriesObj)
      const isLastInSequence = SeriesUtils.isLastInSequence(currentSequence, maxSequence)

      if (!isLastInSequence) {
        Logger.info('[UpcomingBookController] Book is not the last in series')
        return null
      }

      const storage = this.getStorage()

      // Try to get cached data
      let bookInfo = await storage.retrieveBookData(seriesName, authorName)

      // Check if cached data needs refresh
      // For sequential books (maxSequence provided), be less aggressive about refresh
      const isSequentialRequest = maxSequence !== null
      Logger.info(`[UpcomingBookController] Cache check - maxSequence: ${maxSequence}, isSequentialRequest: ${isSequentialRequest}, bookInfo exists: ${!!bookInfo}`)
      if (bookInfo && this.shouldRefreshBookData(bookInfo, isSequentialRequest)) {
        Logger.info('[UpcomingBookController] Cached data needs refresh')
        // For sequential books, preserve the cover during refresh
        await storage.removeBookData(seriesName, authorName, isSequentialRequest)
        bookInfo = null
      }

      // If no valid cached data, fetch fresh data
      if (!bookInfo) {
        // Fetch book data from RisingShadow
        const searchUrl = RisingShadowScraper.buildSearchUrl(seriesName, authorName)
        const freshBookData = await RisingShadowScraper.fetchUpcomingBookInfo(searchUrl, maxSequence)

        if (!freshBookData) {
          Logger.info('[UpcomingBookController] No upcoming book found')
          return null
        }

        // Store the data with cover download
        const storeResult = await storage.storeBookDataWithCover(seriesName, authorName, freshBookData, freshBookData.cover)
        bookInfo = storeResult.bookData
        Logger.info(`[UpcomingBookController] Stored fresh book data in: ${storeResult.storagePath}`)
      } else {
        Logger.info('[UpcomingBookController] Using cached book data')
      }

      return bookInfo
    } catch (error) {
      Logger.error('[UpcomingBookController] Error getting upcoming book info:', error)
      return null
    }
  }

  /**
   * Checks if book data should be refreshed based on release date and context.
   * @param {Object} bookData - The cached book data
   * @param {boolean} isSequentialRequest - Whether this is a sequential book request
   */
  shouldRefreshBookData(bookData, isSequentialRequest = false) {
    if (!bookData || !bookData.release) return true

    try {
      const releaseDate = new Date(bookData.release)
      const today = new Date()

      // For sequential book requests, be much more conservative about refreshing
      if (isSequentialRequest) {
        // Only refresh sequential books if they're very old (30+ days past release)
        const daysPastRelease = (today - releaseDate) / (1000 * 60 * 60 * 24)
        Logger.info(`[UpcomingBookController] Sequential book check - daysPastRelease: ${daysPastRelease}, threshold: 30`)
        if (daysPastRelease > 30) {
          Logger.info('[UpcomingBookController] Sequential book very old (30+ days past release), refreshing')
          return true
        }
        
        // Otherwise, keep the sequential book cached
        Logger.info(`[UpcomingBookController] Keeping sequential book cached (${Math.floor(daysPastRelease)} days past release)`)
        return false
      }

      // For general upcoming book requests, use the original logic
      // If the release date has passed, refresh to see if there's a newer upcoming book
      if (releaseDate <= today) {
        Logger.info('[UpcomingBookController] Book release date has passed, refreshing data')
        return true
      }

      // If release is within 30 days, refresh more frequently
      const daysUntilRelease = (releaseDate - today) / (1000 * 60 * 60 * 24)
      if (daysUntilRelease <= 30) {
        Logger.info('[UpcomingBookController] Book releasing soon, may need fresh data')
        return true
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] Error parsing release date:', error)
      return true
    }

    return false
  }

  /**
   * Gets comprehensive cache statistics.
   */
  async getCacheStats() {
    try {
      const storage = this.getStorage()
      const stats = await storage.getCacheStats()
      return {
        ...stats,
        integration: 'metadata-cache',
        baseDirectory: '/metadata/cache',
        upcomingDirectory: '/metadata/cache/upcoming'
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] Error getting cache stats:', error)
      return { error: error.message }
    }
  }

  /**
   * Lists all cached upcoming books with details.
   */
  async listCachedBooks() {
    try {
      const storage = this.getStorage()
      return await storage.listAllCachedBooks()
    } catch (error) {
      Logger.error('[UpcomingBookController] Error listing cached books:', error)
      return []
    }
  }

  /**
   * Performs maintenance on the cache directory.
   */
  async performMaintenanceTask() {
    try {
      Logger.info('[UpcomingBookController] Starting maintenance')
      const storage = this.getStorage()
      const result = await storage.performMaintenance()
      Logger.info('[UpcomingBookController] Maintenance completed:', result)
      return result
    } catch (error) {
      Logger.error('[UpcomingBookController] Error during maintenance:', error)
      return { error: error.message }
    }
  }

  /**
   * Manually refreshes data for a specific series/author.
   */
  async refreshBookData(seriesName, authorName) {
    return this.refreshBookDataWithContext(seriesName, authorName, null)
  }

  /**
   * Manually refreshes data for a specific series/author with optional context.
   */
  async refreshBookDataWithContext(seriesName, authorName, maxSequence = null) {
    try {
      const storage = this.getStorage()
      Logger.info(`[UpcomingBookController] Refreshing data for: ${seriesName} by ${authorName}${maxSequence ? ` (maxSequence: ${maxSequence})` : ''}`)

      // Remove existing cached data
      await storage.removeBookData(seriesName, authorName)

      // Fetch fresh data from RisingShadow with context
      const searchUrl = RisingShadowScraper.buildSearchUrl(seriesName, authorName)
      const freshBookData = await RisingShadowScraper.fetchUpcomingBookInfo(searchUrl, maxSequence)

      if (!freshBookData) {
        Logger.info('[UpcomingBookController] No upcoming book found during refresh')
        return null
      }

      // Store fresh data with cover
      const storeResult = await storage.storeBookDataWithCover(seriesName, authorName, freshBookData, freshBookData.cover)
      Logger.info(`[UpcomingBookController] Refreshed data stored in: ${storeResult.storagePath}`)
      return storeResult.bookData
    } catch (error) {
      Logger.error('[UpcomingBookController] Error refreshing book data:', error)
      return null
    }
  }

  /**
   * GET: /api/items/:id/upcoming
   * Get upcoming book for a specific library item
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getUpcomingBookForItem(req, res) {
    try {
      const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
      if (!libraryItem) {
        return res.status(404).json({ error: 'Library item not found' })
      }

      // Check if user has access to this library item
      if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
        Logger.warn(`[UpcomingBookController] User "${req.user.username}" attempted to access upcoming book for item "${req.params.id}" without permission`)
        return res.sendStatus(403)
      }

      // Get all books in the library for series analysis
      const allBooks = await Database.libraryItemModel.findAllExpandedWhere({
        libraryId: libraryItem.libraryId,
        mediaType: 'book'
      })

      const upcomingBook = await this.getUpcomingBookInfo(libraryItem, allBooks)
      
      res.json({
        upcoming: upcomingBook
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] Error getting upcoming book for item:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/upcoming
   * Get all upcoming books with optional filters
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getUpcomingBooks(req, res) {
    try {
      const { author, limit = 50, offset = 0 } = req.query
      
      let upcomingBooks
      if (author) {
        // For author-specific requests, we'll use the cached books list
        const cachedBooks = await this.listCachedBooks()
        upcomingBooks = cachedBooks.filter(book => book.authorName === author)
      } else {
        // Return all cached upcoming books
        upcomingBooks = await this.listCachedBooks()
        // Apply pagination
        const startIndex = parseInt(offset)
        const endIndex = startIndex + parseInt(limit)
        upcomingBooks = upcomingBooks.slice(startIndex, endIndex)
      }

      res.json({
        upcoming: upcomingBooks.map(book => book.toJSON ? book.toJSON() : book),
        total: upcomingBooks.length
      })
    } catch (error) {
      Logger.error('[UpcomingBookController] Error getting upcoming books:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/upcoming/:id
   * Get a specific upcoming book
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getUpcomingBook(req, res) {
    try {
      const upcomingBook = await Database.upcomingBookModel.findByPk(req.params.id)
      if (!upcomingBook) {
        return res.status(404).json({ error: 'Upcoming book not found' })
      }

      res.json(upcomingBook)
    } catch (error) {
      Logger.error('[UpcomingBookController] Error getting upcoming book:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * POST: /api/upcoming/refresh
   * Refresh upcoming book data for a specific series/author
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async refreshUpcomingBook(req, res) {
    try {
      if (!req.user.isAdminOrUp) {
        return res.sendStatus(403)
      }

      const { seriesName, authorName, libraryItemId } = req.body
      if (!seriesName || !authorName) {
        return res.status(400).json({ error: 'seriesName and authorName are required' })
      }

      let maxSequence = null

      // If libraryItemId is provided, get the library context for sequential book logic
      if (libraryItemId) {
        try {
          const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
          if (libraryItem) {
            // Get all books in the library for series analysis
            const allBooks = await Database.libraryItemModel.findAllExpandedWhere({
              libraryId: libraryItem.libraryId,
              mediaType: 'book'
            })

            // Calculate maxSequence using the same logic as getUpcomingBookInfo
            const SeriesUtils = require('../utils/upcoming/seriesUtils')
            const seriesBooks = SeriesUtils.getBooksInSeries(allBooks, seriesName)
            maxSequence = SeriesUtils.getMaxSequenceInSeries(seriesBooks)
            
            Logger.info(`[UpcomingBookController] Using library context for refresh - maxSequence: ${maxSequence}`)
          }
        } catch (error) {
          Logger.warn(`[UpcomingBookController] Could not get library context for refresh: ${error.message}`)
          // Continue without context
        }
      }

      const upcomingBook = await this.refreshBookDataWithContext(seriesName, authorName, maxSequence)
      
      if (upcomingBook) {
        res.json({
          message: 'Upcoming book refreshed successfully',
          upcoming: upcomingBook
        })
      } else {
        res.json({
          message: 'No upcoming book found',
          upcoming: null
        })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] Error refreshing upcoming book:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * DELETE: /api/upcoming/:id
   * Delete an upcoming book record (admin only)
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async deleteUpcomingBook(req, res) {
    try {
      if (!req.user.isAdminOrUp) {
        return res.sendStatus(403)
      }

      const upcomingBook = await Database.upcomingBookModel.findByPk(req.params.id)
      if (!upcomingBook) {
        return res.status(404).json({ error: 'Upcoming book not found' })
      }

      await upcomingBook.destroy()
      
      Logger.info(`[UpcomingBookController] Deleted upcoming book "${upcomingBook.title}" by ${req.user.username}`)
      res.status(204).send()
    } catch (error) {
      Logger.error('[UpcomingBookController] Error deleting upcoming book:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/upcoming/stats
   * Get upcoming books statistics (admin only)
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getStats(req, res) {
    try {
      if (!req.user.isAdminOrUp) {
        return res.sendStatus(403)
      }

      const stats = await this.getCacheStats()
      res.json(stats)
    } catch (error) {
      Logger.error('[UpcomingBookController] Error getting stats:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * POST: /api/upcoming/maintenance
   * Perform maintenance tasks (admin only)
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async performMaintenance(req, res) {
    try {
      if (!req.user.isAdminOrUp) {
        return res.sendStatus(403)
      }

      // Run maintenance in background
      this.performMaintenanceTask().catch(error => {
        Logger.error('[UpcomingBookController] Maintenance error:', error)
      })

      res.json({ message: 'Maintenance started' })
    } catch (error) {
      Logger.error('[UpcomingBookController] Error starting maintenance:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/upcoming/cover/:seriesName/:authorName
   * Get cached cover for a specific series/author
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getCover(req, res) {
    try {
      const { seriesName, authorName } = req.params
      
      if (!seriesName || !authorName) {
        return res.status(400).json({ error: 'seriesName and authorName are required' })
      }

      const storage = this.getStorage()
      const fs = require('../libs/fsExtra')
      const path = require('path')
      
      // Get the storage directory path 
      const decodedSeriesName = decodeURIComponent(seriesName)
      const decodedAuthorName = decodeURIComponent(authorName)
      const paths = storage.getStoragePaths(decodedSeriesName, decodedAuthorName)
      
      // Look for cover file with any extension
      try {
        const files = await fs.readdir(paths.directory)
        const coverFile = files.find(file => file.startsWith('cover.'))
        
        if (!coverFile) {
          Logger.info(`[UpcomingBookController] No cover file found in: ${paths.directory}`)
          return res.status(404).json({ error: 'Cover not found' })
        }
        
        const fullCoverPath = path.join(paths.directory, coverFile)
        
        // Verify file exists and serve it
        await fs.access(fullCoverPath)
        res.sendFile(fullCoverPath)
        
      } catch (error) {
        Logger.info(`[UpcomingBookController] Cover directory or file not found: ${paths.directory}`)
        return res.status(404).json({ error: 'Cover not found' })
      }
    } catch (error) {
      Logger.error('[UpcomingBookController] Error getting cover:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/upcoming/health
   * Health check endpoint
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async healthCheck(req, res) {
    try {
      const stats = await this.getCacheStats()
      
      const health = {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        stats
      }

      res.json(health)
    } catch (error) {
      Logger.error('[UpcomingBookController] Health check error:', error)
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }
}

module.exports = new UpcomingBookController()