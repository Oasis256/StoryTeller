// services/UpcomingBookService.js (Fixed import paths)
const Logger = require('../Logger')

// Import utility modules with correct relative paths
const RisingShadowScraper = require('../utils/upcoming/risingShadowScraper')
const SeriesUtils = require('../utils/upcoming/seriesUtils')
const MetadataCacheStorageManager = require('../utils/upcoming/metadataCacheStorageManager')

class UpcomingBookService {
  static _storage = null

  /**
   * Gets the storage manager instance configured for your metadata cache directory.
   */
  static getStorage() {
    if (!this._storage) {
      // Initialize with your specific metadata cache directory
      this._storage = MetadataCacheStorageManager.createFromAppConfig({
        metadataCacheDir: '/metadata/cache'
      })
    }
    return this._storage
  }

  /**
   * Initializes the upcoming books cache within your existing metadata cache structure.
   */
  static async initialize() {
    try {
      const storage = this.getStorage()
      const success = await storage.ensureBaseDirectory()

      if (success) {
        // Logger.info('[UpcomingBookService 1.0] Initialized cache directory: /metadata/cache/upcoming')

        // Log initial stats
        const stats = await storage.getCacheStats()
        // Logger.info('[UpcomingBookService 1.1] Cache stats:', stats)

        return true
      } else {
        Logger.error('[UpcomingBookService 1.2] Failed to initialize cache directory')
        return false
      }
    } catch (error) {
      Logger.error('[UpcomingBookService 1.3] Initialization error:', error)
      return false
    }
  }

  /**
   * Main method to get Upcoming Book information.
   */
  static async getUpcomingBookInfo(libraryItem, allLibraryBooks) {
    try {
      // Logger.info('[UpcomingBookService 2.0] Processing Upcoming Book request')

      // Extract series and author information
      const seriesInfo = SeriesUtils.extractSeriesAndAuthorInfo(libraryItem)
      if (!SeriesUtils.validateSeriesInfo(seriesInfo)) {
        Logger.info('[UpcomingBookService 2.1] Invalid series or author information')
        return null
      }

      const { series: seriesObj, seriesName, authorName } = seriesInfo

      // Check if this book is the last in the series
      const seriesBooks = SeriesUtils.getBooksInSeries(allLibraryBooks, seriesName)
      const maxSequence = SeriesUtils.getMaxSequenceInSeries(seriesBooks)
      const currentSequence = SeriesUtils.getCurrentBookSequence(seriesObj)
      const isLastInSequence = SeriesUtils.isLastInSequence(currentSequence, maxSequence)

      if (!isLastInSequence) {
        Logger.info('[UpcomingBookService 2.2] Book is not the last in series')
        return null
      }

      const storage = this.getStorage()

      // Try to get cached data from /metadata/cache/upcoming
      let bookInfo = await storage.retrieveBookData(seriesName, authorName)

      // Check if cached data needs refresh based on release date
      if (bookInfo && this.shouldRefreshBookData(bookInfo)) {
        Logger.info('[UpcomingBookService 2.3] Cached data needs refresh')
        await storage.removeBookData(seriesName, authorName)
        bookInfo = null
      }

      // If no valid cached data, fetch fresh data and store it
      if (!bookInfo) {
        // Logger.info('[UpcomingBookService 2.4] Fetching fresh data from RisingShadow')

        // Fetch book data from RisingShadow
        const searchUrl = RisingShadowScraper.buildSearchUrl(seriesName, authorName)
        const freshBookData = await RisingShadowScraper.fetchUpcomingBookInfo(searchUrl, maxSequence)

        if (!freshBookData) {
          Logger.info('[UpcomingBookService 2.5] No Upcoming Book found')
          return null
        }

        // Store the data with cover download in /metadata/cache/upcoming
        const storeResult = await storage.storeBookDataWithCover(seriesName, authorName, freshBookData, freshBookData.cover)

        bookInfo = storeResult.bookData
        Logger.info(`[UpcomingBookService 2.6] Stored fresh book data in: ${storeResult.storagePath}`)
      } else {
        Logger.info('[UpcomingBookService 2.7] Using cached book data from /metadata/cache/upcoming')
      }

      return bookInfo
    } catch (error) {
      Logger.error('[UpcomingBookService 2.8] Error getting Upcoming Book info:', error)
      return null
    }
  }

  /**
   * Checks if book data should be refreshed based on release date.
   */
  static shouldRefreshBookData(bookData) {
    if (!bookData || !bookData.release) return true

    try {
      const releaseDate = new Date(bookData.release)
      const today = new Date()

      // If the release date has passed, refresh to see if there's a newer Upcoming Book
      if (releaseDate <= today) {
        Logger.info('[UpcomingBookService 2.9] Book release date has passed, refreshing data')
        return true
      }

      // If release is within 30 days, refresh more frequently
      const daysUntilRelease = (releaseDate - today) / (1000 * 60 * 60 * 24)
      if (daysUntilRelease <= 30) {
        Logger.info('[UpcomingBookService 2.10] Book releasing soon, may need fresh data')
        return true
      }
    } catch (error) {
      Logger.error('[UpcomingBookService 2.11] Error parsing release date:', error)
      return true
    }

    return false
  }

  /**
   * Gets comprehensive cache statistics from /metadata/cache/upcoming.
   */
  static async getCacheStats() {
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
      Logger.error('[UpcomingBookService 2.12] Error getting cache stats:', error)
      return { error: error.message }
    }
  }

  /**
   * Lists all cached upcoming books with details.
   */
  static async listCachedBooks() {
    try {
      const storage = this.getStorage()
      return await storage.listAllCachedBooks()
    } catch (error) {
      Logger.error('[UpcomingBookService 2.13] Error listing cached books:', error)
      return []
    }
  }

  /**
   * Performs maintenance on the /metadata/cache/upcoming directory.
   */
  static async performMaintenance() {
    try {
      Logger.info('[UpcomingBookService 2.14] Starting maintenance on /metadata/cache/upcoming')

      const storage = this.getStorage()
      const result = await storage.performMaintenance()

      Logger.info('[UpcomingBookService 2.15] Maintenance completed:', result)
      return result
    } catch (error) {
      Logger.error('[UpcomingBookService 2.16] Error during maintenance:', error)
      return { error: error.message }
    }
  }

  /**
   * Manually refreshes data for a specific series/author.
   */
  static async refreshBookData(seriesName, authorName) {
    try {
      const storage = this.getStorage()

      Logger.info(`[UpcomingBookService 3.0] Refreshing data for: ${seriesName} by ${authorName}`)

      // Remove existing cached data
      await storage.removeBookData(seriesName, authorName)

      // Fetch fresh data from RisingShadow
      const searchUrl = RisingShadowScraper.buildSearchUrl(seriesName, authorName)
      // Note: We don't have maxSequence context in manual refresh, so pass null
      const freshBookData = await RisingShadowScraper.fetchUpcomingBookInfo(searchUrl, null)

      if (!freshBookData) {
        Logger.info('[UpcomingBookService 3.1] No Upcoming Book found during refresh')
        return null
      }

      // Store fresh data with cover
      const storeResult = await storage.storeBookDataWithCover(seriesName, authorName, freshBookData, freshBookData.cover)

      Logger.info(`[UpcomingBookService 3.2] Refreshed data stored in: ${storeResult.storagePath}`)
      return storeResult.bookData
    } catch (error) {
      Logger.error('[UpcomingBookService 3.3] Error refreshing book data:', error)
      return null
    }
  }

  /**
   * Clears all cached data from /metadata/cache/upcoming.
   */
  static async clearAllCache() {
    try {
      const storage = this.getStorage()
      const books = await storage.listAllCachedBooks()

      for (const book of books) {
        await storage.removeBookData(book.seriesName, book.authorName)
      }

      Logger.info(`[UpcomingBookService 4.0] Cleared ${books.length} cached books from /metadata/cache/upcoming`)
      return { cleared: books.length }
    } catch (error) {
      Logger.error('[UpcomingBookService 4.1] Error clearing cache:', error)
      return { error: error.message }
    }
  }

  /**
   * Batch processes multiple library items.
   */
  static async batchProcessUpcomingBooks(libraryItems, allLibraryBooks, options = {}) {
    const results = []
    const maxConcurrent = options.maxConcurrent || 3

    Logger.info(`[UpcomingBookService 5.0] Batch processing ${libraryItems.length} items`)

    // Process items in batches to prevent overwhelming the system
    for (let i = 0; i < libraryItems.length; i += maxConcurrent) {
      const batch = libraryItems.slice(i, i + maxConcurrent)

      const batchPromises = batch.map(async (item) => {
        try {
          const upcomingBook = await this.getUpcomingBookInfo(item, allLibraryBooks)
          if (upcomingBook) {
            const seriesInfo = SeriesUtils.extractSeriesAndAuthorInfo(item)
            return {
              libraryItemId: item.id,
              seriesName: seriesInfo.seriesName,
              upcomingBook
            }
          }
        } catch (error) {
          Logger.error(`[UpcomingBookService 5.1] Error processing item ${item.id}:`, error)
        }
        return null
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter((result) => result !== null))

      // Small delay between batches to be respectful to external services
      if (i + maxConcurrent < libraryItems.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    Logger.info(`[UpcomingBookService 5.2] Batch processing completed: found ${results.length} upcoming books`)
    return results
  }

  /**
   * Gets the directory structure information for debugging.
   */
  static async getDirectoryStructure() {
    try {
      const storage = this.getStorage()
      const books = await storage.listAllCachedBooks()

      return {
        baseDirectory: '/metadata/cache',
        upcomingDirectory: '/metadata/cache/upcoming',
        structure: books.map((book) => ({
          series: book.seriesName,
          author: book.authorName,
          directory: book.directory,
          hasCover: book.hasCover,
          valid: book.valid
        }))
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  // Legacy method aliases for backward compatibility
  static buildSearchUrl(seriesName, authorName) {
    return RisingShadowScraper.buildSearchUrl(seriesName, authorName)
  }

  static async fetchUpcomingBookInfo(searchUrl) {
    return RisingShadowScraper.fetchUpcomingBookInfo(searchUrl)
  }

  static getSeriesParentFolder(filePaths) {
    return SeriesUtils.getSeriesParentFolder(filePaths)
  }

  static isLastInSeries(book, libraryBooks) {
    return SeriesUtils.isLastInSeries(book, libraryBooks)
  }
}

module.exports = UpcomingBookService
// End of UpcomingBookService.js
