const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')
const sequelize = require('sequelize')

class UpcomingBookManager {
  constructor() {
    this.initialized = false
    this.providers = new Map()
  }

  /**
   * Initialize the upcoming book manager
   */
  async init() {
    if (this.initialized) return
    
    try {
      // Initialize providers
      await this.initProviders()
      
      this.initialized = true
      Logger.info('[UpcomingBookManager] Initialized successfully')
    } catch (error) {
      Logger.error('[UpcomingBookManager] Failed to initialize:', error)
    }
  }

  /**
   * Initialize book data providers
   */
  async initProviders() {
    try {
      // Initialize RisingShadow provider
      const RisingShadowProvider = require('../providers/RisingShadowProvider')
      this.providers.set('risingshadow', new RisingShadowProvider())
      
      // Initialize Generic provider as fallback
      const GenericProvider = require('../providers/GenericProvider')
      this.providers.set('generic', new GenericProvider())
      
      // Could add other providers here (Goodreads, Amazon, etc.)
      // this.providers.set('goodreads', new GoodreadsProvider())
      
      Logger.debug('[UpcomingBookManager] Initialized providers:', Array.from(this.providers.keys()))
    } catch (error) {
      Logger.error('[UpcomingBookManager] Failed to initialize providers:', error)
    }
  }

  /**
   * Get upcoming book for a library item
   * @param {Object} libraryItem 
   * @param {Object[]} allLibraryBooks - All books in the library for series analysis
   * @returns {Promise<Object|null>}
   */
  async getUpcomingBookForItem(libraryItem, allLibraryBooks) {
    try {
      if (!libraryItem?.media || libraryItem.mediaType !== 'book') {
        return null
      }

      // Extract series information
      const seriesInfo = this.extractSeriesInfo(libraryItem)
      if (!seriesInfo.isValid) {
        Logger.debug('[UpcomingBookManager] Invalid series info for item:', libraryItem.id)
        return null
      }

      const { seriesName, authorName } = seriesInfo

      // Check if this is the last book in the series within the user's library
      if (!this.isLastBookInSeries(libraryItem, allLibraryBooks, seriesInfo)) {
        Logger.debug('[UpcomingBookManager] Not the last book in series:', seriesName)
        return null
      }

      // Try to get from database first
      let upcomingBook = await Database.upcomingBookModel.findBySeriesAndAuthor(seriesName, authorName)

      // Check if we need to refresh the data
      if (!upcomingBook || upcomingBook.needsRefresh()) {
        Logger.debug('[UpcomingBookManager] Fetching fresh data for:', seriesName, 'by', authorName)
        upcomingBook = await this.fetchUpcomingBook(seriesName, authorName, upcomingBook)
      }

      return upcomingBook ? upcomingBook.toJSON() : null
    } catch (error) {
      Logger.error('[UpcomingBookManager] Error getting upcoming book:', error)
      return null
    }
  }

  /**
   * Extract series information from library item
   * @param {Object} libraryItem 
   * @returns {Object}
   */
  extractSeriesInfo(libraryItem) {
    const media = libraryItem.media
    if (!media) {
      return { isValid: false }
    }

    // Get series information - check both metadata.series and direct media.series
    let series = null
    if (media.metadata && media.metadata.series) {
      series = media.metadata.series
    } else if (media.series) {
      series = media.series
    }
    
    if (!Array.isArray(series) || !series.length) {
      return { isValid: false }
    }

    const firstSeries = series[0]
    const seriesName = firstSeries.name
    if (!seriesName) {
      return { isValid: false }
    }

    // Get author information - check both metadata.authors and direct media.authors
    let authors = null
    if (media.metadata && media.metadata.authors) {
      authors = media.metadata.authors
    } else if (media.authors) {
      authors = media.authors
    }
    
    if (!Array.isArray(authors) || !authors.length) {
      return { isValid: false }
    }

    const authorName = authors[0].name
    if (!authorName) {
      return { isValid: false }
    }

    // Get sequence - check both metadata series sequence and bookSeries sequence
    let sequence = null
    if (firstSeries.sequence) {
      sequence = parseFloat(firstSeries.sequence)
    } else if (firstSeries.bookSeries && firstSeries.bookSeries.sequence) {
      sequence = parseFloat(firstSeries.bookSeries.sequence)
    }

    return {
      isValid: true,
      seriesName,
      authorName,
      sequence
    }
  }

  /**
   * Check if this book is the last in the series within the library
   * @param {Object} libraryItem 
   * @param {Object[]} allLibraryBooks 
   * @param {Object} seriesInfo 
   * @returns {boolean}
   */
  isLastBookInSeries(libraryItem, allLibraryBooks, seriesInfo) {
    const { seriesName, authorName, sequence } = seriesInfo

    // Find all books in the same series by the same author
    const seriesBooks = allLibraryBooks.filter(book => {
      if (!book.media) return false

      // Check series - check both metadata.series and direct media.series
      let bookSeries = []
      if (book.media.metadata && book.media.metadata.series) {
        bookSeries = book.media.metadata.series
      } else if (book.media.series) {
        bookSeries = book.media.series
      }
      const hasMatchingSeries = bookSeries.some(s => s.name === seriesName)
      if (!hasMatchingSeries) return false

      // Check author - check both metadata.authors and direct media.authors
      let bookAuthors = []
      if (book.media.metadata && book.media.metadata.authors) {
        bookAuthors = book.media.metadata.authors
      } else if (book.media.authors) {
        bookAuthors = book.media.authors
      }
      const hasMatchingAuthor = bookAuthors.some(a => a.name === authorName)
      return hasMatchingAuthor
    })

    if (seriesBooks.length <= 1) return true // Only one book in series

    // Find the highest sequence number
    const sequences = seriesBooks
      .map(book => {
        // Get series data - check both metadata.series and direct media.series
        let bookSeries = []
        if (book.media.metadata && book.media.metadata.series) {
          bookSeries = book.media.metadata.series
        } else if (book.media.series) {
          bookSeries = book.media.series
        }
        
        const matchingSeries = bookSeries.find(s => s.name === seriesName)
        if (!matchingSeries) return null
        
        // Get sequence - check both sequence and bookSeries.sequence
        if (matchingSeries.sequence) {
          return parseFloat(matchingSeries.sequence)
        } else if (matchingSeries.bookSeries && matchingSeries.bookSeries.sequence) {
          return parseFloat(matchingSeries.bookSeries.sequence)
        }
        
        return null
      })
      .filter(seq => seq !== null)
      .sort((a, b) => b - a) // Descending order

    if (!sequences.length) return true // No sequence numbers available

    const maxSequence = sequences[0]
    return sequence === maxSequence
  }

  /**
   * Fetch upcoming book from providers
   * @param {string} seriesName 
   * @param {string} authorName 
   * @param {Object|null} existingRecord 
   * @returns {Promise<Object|null>}
   */
  async fetchUpcomingBook(seriesName, authorName, existingRecord) {
    // Try each provider in order of preference (generic last as fallback)
    const providerNames = ['risingshadow', 'generic']

    for (const providerName of providerNames) {
      const provider = this.providers.get(providerName)
      if (!provider) continue

      try {
        Logger.debug(`[UpcomingBookManager] Trying provider: ${providerName}`)
        const bookData = await provider.searchUpcomingBook(seriesName, authorName)
        
        if (bookData) {
          // Save or update in database
          const upcomingBook = await this.saveUpcomingBook({
            ...bookData,
            seriesName,
            authorName,
            provider: providerName
          }, existingRecord)

          Logger.info(`[UpcomingBookManager] Found upcoming book: "${bookData.title}" from ${providerName}`)
          return upcomingBook
        }
      } catch (error) {
        Logger.error(`[UpcomingBookManager] Provider ${providerName} failed:`, error)
        continue
      }
    }

    // Mark as checked even if no book found
    if (existingRecord) {
      await existingRecord.markChecked()
    }

    Logger.debug('[UpcomingBookManager] No upcoming book found for:', seriesName, 'by', authorName)
    return null
  }

  /**
   * Save upcoming book to database
   * @param {Object} bookData 
   * @param {Object|null} existingRecord 
   * @returns {Promise<Object>}
   */
  async saveUpcomingBook(bookData, existingRecord) {
    const data = {
      seriesName: bookData.seriesName,
      authorName: bookData.authorName,
      title: bookData.title,
      description: bookData.description,
      releaseDate: bookData.releaseDate,
      coverUrl: bookData.coverUrl,
      sourceUrl: bookData.sourceUrl,
      provider: bookData.provider,
      sequence: bookData.sequence,
      isbn: bookData.isbn,
      extraData: bookData.extraData,
      lastChecked: new Date()
    }

    if (existingRecord) {
      // Update existing record
      await existingRecord.update(data)
      return existingRecord
    } else {
      // Create new record
      return await Database.upcomingBookModel.create(data)
    }
  }

  /**
   * Refresh upcoming book data
   * @param {string} seriesName 
   * @param {string} authorName 
   * @returns {Promise<Object|null>}
   */
  async refreshUpcomingBook(seriesName, authorName) {
    try {
      const existingRecord = await Database.upcomingBookModel.findBySeriesAndAuthor(seriesName, authorName)
      return await this.fetchUpcomingBook(seriesName, authorName, existingRecord)
    } catch (error) {
      Logger.error('[UpcomingBookManager] Error refreshing upcoming book:', error)
      return null
    }
  }

  /**
   * Get all upcoming books for an author
   * @param {string} authorName 
   * @returns {Promise<Object[]>}
   */
  async getUpcomingBooksForAuthor(authorName) {
    try {
      const upcomingBooks = await Database.upcomingBookModel.findByAuthor(authorName)
      return upcomingBooks.map(book => book.toJSON())
    } catch (error) {
      Logger.error('[UpcomingBookManager] Error getting upcoming books for author:', error)
      return []
    }
  }

  /**
   * Perform maintenance - cleanup old records, refresh expired data
   */
  async performMaintenance() {
    Logger.info('[UpcomingBookManager] Starting maintenance')
    
    try {
      // Find records that need refresh
      const staleRecords = await Database.upcomingBookModel.findAll({
        where: {
          lastChecked: {
            [sequelize.Op.or]: [
              null,
              { [sequelize.Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days ago
            ]
          }
        },
        limit: 50 // Process in batches
      })

      Logger.info(`[UpcomingBookManager] Found ${staleRecords.length} records to refresh`)

      for (const record of staleRecords) {
        try {
          await this.fetchUpcomingBook(record.seriesName, record.authorName, record)
          // Small delay to be respectful to external services
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          Logger.error('[UpcomingBookManager] Error refreshing record:', error)
        }
      }

      Logger.info('[UpcomingBookManager] Maintenance completed')
    } catch (error) {
      Logger.error('[UpcomingBookManager] Maintenance failed:', error)
    }
  }

  /**
   * Get statistics about upcoming books
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const [totalCount, recentCount, releasedCount] = await Promise.all([
        Database.upcomingBookModel.count(),
        Database.upcomingBookModel.count({
          where: {
            createdAt: {
              [sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        }),
        Database.upcomingBookModel.count({
          where: {
            releaseDate: {
              [sequelize.Op.lte]: new Date()
            }
          }
        })
      ])

      return {
        total: totalCount,
        recent: recentCount,
        released: releasedCount,
        providers: Array.from(this.providers.keys())
      }
    } catch (error) {
      Logger.error('[UpcomingBookManager] Error getting stats:', error)
      return { total: 0, recent: 0, released: 0, providers: [] }
    }
  }
}

module.exports = new UpcomingBookManager()