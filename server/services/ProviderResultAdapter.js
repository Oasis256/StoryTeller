const Logger = require('../Logger')

/**
 * ProviderResultAdapter - Acts as a proxy to understand and normalize results from different providers
 * Each provider has its own unique API structure, and this adapter handles the differences
 */
class ProviderResultAdapter {
  constructor() {
    Logger.info('[ProviderResultAdapter] Initialized')
  }

  /**
   * Process and normalize results from any provider
   * @param {string} providerName - Name of the provider
   * @param {any} rawResults - Raw results from the provider
   * @param {string} seriesName - Original series name searched for
   * @param {string} authorName - Original author name searched for
   * @param {number|null} currentSequence - Current sequence number
   * @returns {Object|null} - Normalized result or null if no valid result
   */
  processProviderResults(providerName, rawResults, seriesName, authorName, currentSequence) {
    try {
      Logger.info(`[ProviderResultAdapter] Processing ${providerName} results`)

      switch (providerName) {
        case 'risingshadow':
          return this.processRisingShadowResults(rawResults, seriesName, authorName, currentSequence)
        case 'audible':
          return this.processAudibleResults(rawResults, seriesName, authorName, currentSequence)
        case 'audble':
          return this.processAudbleResults(rawResults, seriesName, authorName, currentSequence)
        case 'google':
          return this.processGoogleResults(rawResults, seriesName, authorName, currentSequence)
        case 'openlibrary':
          return this.processOpenLibraryResults(rawResults, seriesName, authorName, currentSequence)
        default:
          Logger.warn(`[ProviderResultAdapter] Unknown provider: ${providerName}`)
          return null
      }
    } catch (error) {
      Logger.error(`[ProviderResultAdapter] Error processing ${providerName} results:`, error)
      return null
    }
  }

  /**
   * Process RisingShadow results (array with single book object)
   * RisingShadow already handles sequence logic internally
   */
  processRisingShadowResults(rawResults, seriesName, authorName, currentSequence) {
    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      Logger.info('[ProviderResultAdapter] RisingShadow returned empty array')
      return null
    }

    // RisingShadow returns an array with one book object that's already been filtered for the next sequence
    const book = rawResults[0]
    Logger.info(`[ProviderResultAdapter] RisingShadow returned: "${book.title}"`)

    return {
      title: book.title || '',
      author: book.author || authorName || '',
      asin: book.asin || null,
      releaseDate: this.parseReleaseDate(book.releaseDate),
      cover: book.cover || book.coverUrl || null,
      description: book.description || '',
      url: book.url || book.link || null,
      series: book.series || [],
      source: 'risingshadow',
      providerData: book
    }
  }

  /**
   * Process original Audible provider results (array of books)
   * Original Audible provider returns multiple results that need sequence filtering
   */
  processAudibleResults(rawResults, seriesName, authorName, currentSequence) {
    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      Logger.info('[ProviderResultAdapter] Audible returned empty array')
      return null
    }

    Logger.info(`[ProviderResultAdapter] Audible returned ${rawResults.length} results`)

    // Find the next book in sequence
    const nextBook = this.findNextBookInSequence(rawResults, seriesName, currentSequence)
    if (!nextBook) {
      Logger.info('[ProviderResultAdapter] Audible found no next book in sequence')
      return null
    }

    Logger.info(`[ProviderResultAdapter] Audible found next book: "${nextBook.title}"`)

    return {
      title: nextBook.title || '',
      author: nextBook.author || authorName || '',
      asin: nextBook.asin || null,
      releaseDate: this.parseReleaseDate(nextBook.releaseDate),
      cover: nextBook.cover || nextBook.coverUrl || null,
      description: nextBook.description || '',
      url: nextBook.url || nextBook.link || null,
      series: nextBook.series || [],
      source: 'audible',
      providerData: nextBook
    }
  }

  /**
   * Process Audble results (array of books)
   * Audble returns multiple results that need sequence filtering
   */
  processAudbleResults(rawResults, seriesName, authorName, currentSequence) {
    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      Logger.info('[ProviderResultAdapter] Audble returned empty array')
      return null
    }

    Logger.info(`[ProviderResultAdapter] Audble returned ${rawResults.length} results`)

    // Find the next book in sequence
    const nextBook = this.findNextBookInSequence(rawResults, seriesName, currentSequence)
    if (!nextBook) {
      Logger.info('[ProviderResultAdapter] Audble found no next book in sequence')
      return null
    }

    Logger.info(`[ProviderResultAdapter] Audble found next book: "${nextBook.title}"`)

    return {
      title: nextBook.title || '',
      author: nextBook.author || authorName || '',
      asin: nextBook.asin || null,
      releaseDate: this.parseReleaseDate(nextBook.releaseDate),
      cover: nextBook.cover || nextBook.coverUrl || null,
      description: nextBook.description || '',
      url: nextBook.url || nextBook.link || null,
      series: nextBook.series || [],
      source: 'audble',
      providerData: nextBook
    }
  }

  /**
   * Process Google Books results (array of books)
   * Google Books returns multiple results that need sequence filtering
   */
  processGoogleResults(rawResults, seriesName, authorName, currentSequence) {
    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      Logger.info('[ProviderResultAdapter] Google returned empty array')
      return null
    }

    Logger.info(`[ProviderResultAdapter] Google returned ${rawResults.length} results`)

    // Find the next book in sequence
    const nextBook = this.findNextBookInSequence(rawResults, seriesName, currentSequence)
    if (!nextBook) {
      Logger.info('[ProviderResultAdapter] Google found no next book in sequence')
      return null
    }

    Logger.info(`[ProviderResultAdapter] Google found next book: "${nextBook.title}"`)

    return {
      title: nextBook.title || '',
      author: nextBook.author || authorName || '',
      asin: nextBook.asin || null,
      releaseDate: this.parseReleaseDate(nextBook.releaseDate),
      cover: nextBook.cover || nextBook.coverUrl || null,
      description: nextBook.description || '',
      url: nextBook.url || nextBook.link || null,
      series: nextBook.series || [],
      source: 'google',
      providerData: nextBook
    }
  }

  /**
   * Process OpenLibrary results (array of books)
   * OpenLibrary returns multiple results that need sequence filtering
   */
  processOpenLibraryResults(rawResults, seriesName, authorName, currentSequence) {
    if (!rawResults || !Array.isArray(rawResults) || rawResults.length === 0) {
      Logger.info('[ProviderResultAdapter] OpenLibrary returned empty array')
      return null
    }

    Logger.info(`[ProviderResultAdapter] OpenLibrary returned ${rawResults.length} results`)

    // Find the next book in sequence
    const nextBook = this.findNextBookInSequence(rawResults, seriesName, currentSequence)
    if (!nextBook) {
      Logger.info('[ProviderResultAdapter] OpenLibrary found no next book in sequence')
      return null
    }

    Logger.info(`[ProviderResultAdapter] OpenLibrary found next book: "${nextBook.title}"`)

    return {
      title: nextBook.title || '',
      author: nextBook.author || authorName || '',
      asin: nextBook.asin || null,
      releaseDate: this.parseReleaseDate(nextBook.releaseDate),
      cover: nextBook.cover || nextBook.coverUrl || null,
      description: nextBook.description || '',
      url: nextBook.url || nextBook.link || null,
      series: nextBook.series || [],
      source: 'openlibrary',
      providerData: nextBook
    }
  }

  /**
   * Find the next book in sequence from an array of results
   * This is used for providers that return multiple results
   */
  findNextBookInSequence(results, seriesName, currentSequence) {
    if (!results || results.length === 0) {
      return null
    }

    Logger.info(`[ProviderResultAdapter] findNextBookInSequence: ${results.length} results, currentSequence: ${currentSequence}`)

    // Filter results that match the series
    const seriesResults = results.filter((book) => {
      if (!book.series || !Array.isArray(book.series)) {
        Logger.debug(`[ProviderResultAdapter] Book "${book.title}" has no series array`)
        return false
      }

      const hasMatchingSeries = book.series.some((s) => {
        const seriesNameInData = s.series || s.name
        const seriesNameStr = String(seriesName)
        const seriesNameInDataStr = String(seriesNameInData)

        const matches = seriesNameInDataStr && (seriesNameInDataStr.toLowerCase().includes(seriesNameStr.toLowerCase()) || seriesNameStr.toLowerCase().includes(seriesNameInDataStr.toLowerCase()) || seriesNameInDataStr.toLowerCase() === seriesNameStr.toLowerCase())

        Logger.debug(`[ProviderResultAdapter] Book "${book.title}" series check: "${seriesNameInDataStr}" vs "${seriesNameStr}" = ${matches}`)
        return matches
      })

      return hasMatchingSeries
    })

    Logger.info(`[ProviderResultAdapter] Found ${seriesResults.length} books matching series`)

    if (seriesResults.length === 0) {
      return null
    }

    // Extract sequences and find the next one
    const sequences = seriesResults
      .map((book) => {
        const sequence = this.extractBookSequence(book)
        Logger.info(`[ProviderResultAdapter] Book "${book.title}" has sequence: ${sequence}`)
        return { book, sequence }
      })
      .filter((item) => item.sequence !== null)

    Logger.info(`[ProviderResultAdapter] Found ${sequences.length} books with valid sequences`)

    if (sequences.length === 0) {
      return null
    }

    // Find the next book in sequence
    if (currentSequence !== null && currentSequence !== undefined) {
      const currentSeqNum = parseInt(currentSequence)
      Logger.info(`[ProviderResultAdapter] Looking for sequence: ${currentSeqNum + 1}`)

      const nextBook = sequences.find((item) => {
        const seqNum = parseInt(item.sequence)
        const isNext = seqNum === currentSeqNum + 1
        Logger.info(`[ProviderResultAdapter] Checking sequence: ${seqNum} vs target ${currentSeqNum + 1} = ${isNext}`)
        return isNext
      })

      if (nextBook) {
        Logger.info(`[ProviderResultAdapter] Found next book in sequence: "${nextBook.book.title}" (sequence ${nextBook.sequence})`)
        return nextBook.book
      } else {
        Logger.info(`[ProviderResultAdapter] No book found with sequence ${currentSeqNum + 1}`)
        // Don't return highest numbered book if we're looking for a specific next sequence
        return null
      }
    }

    // If no current sequence provided, return the highest numbered book
    const sortedSequences = sequences.sort((a, b) => parseInt(b.sequence) - parseInt(a.sequence))
    const highestBook = sortedSequences[0]
    Logger.info(`[ProviderResultAdapter] Returning highest numbered book: "${highestBook.book.title}" (sequence ${highestBook.sequence})`)
    return highestBook.book
  }

  /**
   * Extract book sequence number
   */
  extractBookSequence(book) {
    try {
      if (!book.series || !Array.isArray(book.series)) return null

      for (const series of book.series) {
        if (series.sequence && !isNaN(series.sequence)) {
          return parseInt(series.sequence)
        }
      }

      return null
    } catch (error) {
      Logger.error('[ProviderResultAdapter] Error extracting book sequence:', error.message)
      return null
    }
  }

  /**
   * Parse release date into consistent format
   */
  parseReleaseDate(dateValue) {
    if (!dateValue) return null

    try {
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) return null

      // Return ISO date string (YYYY-MM-DD)
      return date.toISOString().split('T')[0]
    } catch (error) {
      Logger.debug('[ProviderResultAdapter] Invalid date format:', dateValue)
      return null
    }
  }
}

module.exports = ProviderResultAdapter
