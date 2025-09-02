const Logger = require('../Logger')
const axios = require('axios')
const cheerio = require('cheerio')

class RisingShadowProvider {
  constructor() {
    this.baseUrl = 'https://www.risingshadow.net'
    this.name = 'RisingShadow'
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.risingshadow.net/',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    })
  }

  /**
   * Search method that matches the expected interface for discovery service
   * @param {string} seriesName
   * @param {string} authorName
   * @param {string} asin
   * @param {string} region
   * @param {number|null} currentSequence - Current highest book number user owns (optional)
   * @returns {Promise<Array>}
   */
  async search(seriesName, authorName, asin = null, region = 'us', currentSequence = null) {
    try {
      Logger.info(`[RisingShadowProvider] Searching for: "${seriesName}" by "${authorName}" (current sequence: ${currentSequence})`)

      const result = await this.searchUpcomingBook(seriesName, authorName, currentSequence)

      if (result) {
        // Add the author name to the result
        result.author = authorName
        Logger.info(`[RisingShadowProvider] Found result: "${result.title}"`)
        return [result] // Return as array to match expected interface
      }

      Logger.info(`[RisingShadowProvider] No results found`)
      return []
    } catch (error) {
      Logger.error(`[RisingShadowProvider] Search failed: ${error.message}`)
      return []
    }
  }

  /**
   * Search for upcoming book in a series by an author
   * @param {string} seriesName
   * @param {string} authorName
   * @param {number|null} currentSequence - Current highest book number user owns (optional)
   * @returns {Promise<Object|null>}
   */
  async searchUpcomingBook(seriesName, authorName, currentSequence = null) {
    try {
      const searchUrl = this.buildSearchUrl(seriesName, authorName)
      Logger.info(`[RisingShadowProvider] Searching: ${searchUrl}`)

      const bookData = await this.fetchBookData(searchUrl, currentSequence)
      if (!bookData) {
        return null
      }

      // Validate and normalize the data - pass the original series name
      return this.normalizeBookData(bookData, seriesName)
    } catch (error) {
      Logger.error('[RisingShadowProvider] Search failed:', error)
      return null
    }
  }

  /**
   * Build search URL for RisingShadow
   * @param {string} seriesName
   * @param {string} authorName
   * @returns {string}
   */
  buildSearchUrl(seriesName, authorName) {
    // Use the same format as the original scraper
    const query = `${seriesName} by ${authorName}`.replace(/ /g, '+')
    return `${this.baseUrl}/search?q=${query}`
  }

  /**
   * Clean search term for better matching
   * @param {string} term
   * @returns {string}
   */
  cleanSearchTerm(term) {
    return term
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
  }

  /**
   * Fetch book data from search URL
   * @param {string} url
   * @param {number|null} currentSequence - Current highest book number user owns (optional)
   * @returns {Promise<Object|null>}
   */
  async fetchBookData(url, currentSequence = null) {
    try {
      Logger.info('[RisingShadowProvider] Fetching book data from:', url)

      const response = await this.client.get(url)
      const $ = cheerio.load(response.data)

      const today = new Date()
      const nextBook = this.findNextSequentialBook($, today, currentSequence)

      if (!nextBook) {
        Logger.info('[RisingShadowProvider] No upcoming books found')
        return null
      }

      Logger.info(`[RisingShadowProvider] Found upcoming book: ${nextBook.title}`)
      return nextBook
    } catch (error) {
      Logger.error('[RisingShadowProvider] Failed to fetch book data:', error)
      return null
    }
  }

  /**
   * Finds the next sequential book in the series by analyzing all books and finding the appropriate next one.
   * @param {Object} $ - Cheerio instance
   * @param {Date} today - Current date
   * @param {number|null} currentMaxSequence - Current highest book number user owns (optional)
   * @returns {Object|null} - Next book info or null if not found
   */
  findNextSequentialBook($, today, currentMaxSequence = null) {
    const allBooks = []

    // Parse all books from search results
    $('.table-row').each((i, el) => {
      try {
        const bookData = this.extractBookData($, el)

        // Extract book number from title or series position
        let bookNumber = null
        if (bookData.title) {
          // Try to extract number from title (e.g., "The Primal Hunter 13")
          const titleMatch = bookData.title.match(/(\d+)(?:\s|$)/)
          if (titleMatch) {
            bookNumber = parseInt(titleMatch[1])
          }
        }

        // If no number in title, try series position (e.g., "#13 / 14")
        if (!bookNumber && bookData.seriesPos) {
          const seriesMatch = bookData.seriesPos.match(/#(\d+)/)
          if (seriesMatch) {
            bookNumber = parseInt(seriesMatch[1])
          }
        }

        if (bookNumber && bookData.title && bookData.link && bookData.coverUrl && bookData.releaseDate) {
          Logger.info(`[RisingShadowProvider] Found book: "${bookData.title}" (Book #${bookNumber}) - Release: ${bookData.releaseDate}`)
          allBooks.push({
            title: bookData.title,
            release: bookData.release,
            link: bookData.link,
            cover: bookData.coverUrl,
            releaseDate: bookData.releaseDate,
            bookNumber: bookNumber,
            seriesPos: bookData.seriesPos,
            originalBookData: bookData
          })
        }
      } catch (error) {
        Logger.warn(`[RisingShadowProvider] Error parsing book row: ${error}`)
      }
    })

    if (allBooks.length === 0) {
      return null
    }

    // Sort by book number to find the sequence
    allBooks.sort((a, b) => a.bookNumber - b.bookNumber)

    // If we have the user's current max sequence, find the immediate next book
    if (currentMaxSequence !== null) {
      const targetBookNumber = currentMaxSequence + 1
      Logger.info(`[RisingShadowProvider] Looking for exact next book: #${targetBookNumber}`)

      const targetBook = allBooks.find((book) => book.bookNumber === targetBookNumber)

      if (targetBook) {
        Logger.info(`[RisingShadowProvider] Found exact next sequential book: ${targetBook.title} (Book #${targetBook.bookNumber})`)
        return targetBook
      } else {
        Logger.info(`[RisingShadowProvider] Target book #${targetBookNumber} not found in search results`)
        Logger.info(`[RisingShadowProvider] Available books: ${allBooks.map((b) => `${b.title} (#${b.bookNumber})`).join(', ')}`)
        // Fall through to general logic below
      }
    }

    // General logic: Find the next book that should be upcoming
    // Priority: lowest numbered book that exists, regardless of release date

    let nextBook = null

    // First, try to find any book with a future release date (prioritize by book number)
    const futureBooks = allBooks.filter((book) => book.releaseDate > today)
    if (futureBooks.length > 0) {
      futureBooks.sort((a, b) => a.bookNumber - b.bookNumber)
      nextBook = futureBooks[0]
      Logger.info(`[RisingShadowProvider] Found future book: ${nextBook.title} (Book #${nextBook.bookNumber})`)
    } else {
      // If no future books, pick the highest numbered book (most recent release)
      allBooks.sort((a, b) => b.bookNumber - a.bookNumber)
      nextBook = allBooks[0]
      Logger.info(`[RisingShadowProvider] No future books, using highest numbered: ${nextBook.title} (Book #${nextBook.bookNumber})`)
    }

    return nextBook
  }

  /**
   * Extract sequence number from series position text
   * @param {string} seriesPos
   * @returns {number|null}
   */
  extractSequenceFromSeriesPos(seriesPos) {
    if (!seriesPos) return null

    // Look for patterns like "#12 / 14" or "Book 12"
    const match = seriesPos.match(/#(\d+)/)
    if (match) {
      return parseInt(match[1])
    }

    return null
  }

  /**
   * Extract series name from title
   * @param {string} title
   * @returns {string|null}
   */
  extractSeriesNameFromTitle(title) {
    if (!title) return null

    // Remove common suffixes like "Book 12" or "#12"
    const cleanTitle = title.replace(/\s*(?:Book\s+\d+|#\d+).*$/i, '').trim()

    return cleanTitle || null
  }

  /**
   * Extract book data from table row (using original scraper logic)
   * @param {cheerio.CheerioAPI} $
   * @param {Object} el
   * @returns {Object}
   */
  extractBookData($, el) {
    // Title and link
    const titleLink = $(el).find('.table-cell-content > a').first()
    const title = titleLink.text().trim()
    const link = titleLink.attr('href') ? `${this.baseUrl}${titleLink.attr('href')}` : null

    // Series/position
    let seriesPos = $(el).find('.table-cell-content > .small').first().text().trim()
    const seriesMatch = seriesPos.match(/#\d+\s*\/\s*\d+/)
    if (seriesMatch) {
      seriesPos = seriesMatch[0]
    }

    // Release date
    const release = this.extractReleaseDate($, el)

    // Cover image
    const cover = $(el).find('.table-cell-image .image-thumb a img').attr('src')
    const coverUrl = this.buildFullSizeCoverUrl(cover)

    // Parse release date
    const releaseDate = this.parseReleaseDate(release)

    return {
      title,
      link,
      seriesPos,
      release,
      coverUrl,
      releaseDate
    }
  }

  /**
   * Extract release date from table row element (from original scraper)
   * @param {cheerio.CheerioAPI} $
   * @param {Object} el
   * @returns {string|null}
   */
  extractReleaseDate($, el) {
    let release = null

    $(el)
      .find('.table-cell-content .smaller')
      .each((j, smallEl) => {
        const txt = $(smallEl).text()
        if (txt.includes('Release date:')) {
          const span = $(smallEl).find('span.notice')
          if (span.length) {
            release = span.text().trim()
          } else {
            release = txt
              .replace('Release date:', '')
              .replace(/\(.*?\)/g, '')
              .replace(/\s+/g, ' ')
              .trim()
          }
        }
      })

    return release
  }

  /**
   * Convert thumbnail cover URL to full-size cover URL (from original scraper)
   * @param {string} cover
   * @returns {string|null}
   */
  buildFullSizeCoverUrl(cover) {
    if (!cover) return null

    let coverUrl = `${this.baseUrl}${cover}`

    // Convert /images/book-thumb-12345/xyz.webp to /images/book-12345/xyz.webp
    if (coverUrl.match(/\/images\/book-thumb-(\d+)\//)) {
      coverUrl = coverUrl.replace(/\/images\/book-thumb-(\d+)\//, '/images/book-$1/')
    }

    return coverUrl
  }

  /**
   * Parse release date string into a Date object (from original scraper)
   * @param {string} release
   * @returns {Date|null}
   */
  parseReleaseDate(release) {
    if (!release) return null

    // Try ISO format first
    let tryDate = Date.parse(release)
    if (!isNaN(tryDate)) {
      return new Date(tryDate)
    }

    // Try DD MMM YYYY (e.g., 20 Jul 2025)
    let match = release.match(/(\d{1,2}) ([A-Za-z]{3,}) (\d{4})/)
    if (match) {
      return new Date(`${match[3]}-${match[2]}-${match[1]}`)
    }

    // Try MMMM D, YYYY (e.g., March 8, 2022)
    match = release.match(/([A-Za-z]+) (\d{1,2}), (\d{4})/)
    if (match) {
      return new Date(`${match[1]} ${match[2]}, ${match[3]}`)
    }

    Logger.warn(`[RisingShadowProvider] Could not parse release date: ${release}`)
    return null
  }

  /**
   * Validate if book data represents a valid upcoming book (from original scraper)
   * @param {Object} bookData
   * @param {Date} today
   * @returns {boolean}
   */
  isValidUpcomingBook(bookData, today) {
    const { title, seriesPos, release, link, coverUrl, releaseDate } = bookData
    return !!(title && seriesPos && release && link && coverUrl && releaseDate && releaseDate > today)
  }

  /**
   * Normalize book data to standard format
   * @param {Object} rawData
   * @param {string} originalSeriesName - The series name that was searched for
   * @returns {Object}
   */
  normalizeBookData(rawData, originalSeriesName = null) {
    // Use the original series name that was searched for, or extract from title as fallback
    const seriesName = originalSeriesName || this.extractSeriesNameFromTitle(rawData.title)
    const sequence = rawData.bookNumber || this.extractSequenceFromSeriesPos(rawData.seriesPos)

    return {
      title: rawData.title?.trim() || '',
      author: rawData.author?.trim() || '',
      description: rawData.description?.trim() || '',
      releaseDate: this.parseDate(rawData.releaseDate),
      cover: rawData.cover || rawData.coverUrl || null,
      url: rawData.link || rawData.sourceUrl || null,
      isbn: this.normalizeISBN(rawData.isbn),
      asin: rawData.asin || null,
      series: seriesName
        ? [
            {
              name: seriesName,
              sequence: sequence
            }
          ]
        : [],
      source: 'risingshadow',
      extraData: {
        publisher: rawData.publisher,
        pages: rawData.pages,
        language: rawData.language,
        bookNumber: rawData.bookNumber,
        seriesPos: rawData.seriesPos,
        originalData: rawData
      }
    }
  }

  /**
   * Parse and validate date string
   * @param {string} dateStr
   * @returns {string|null}
   */
  parseDate(dateStr) {
    if (!dateStr) return null

    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return null

      // Return ISO date string (YYYY-MM-DD)
      return date.toISOString().split('T')[0]
    } catch (error) {
      Logger.debug('[RisingShadowProvider] Invalid date format:', dateStr)
      return null
    }
  }

  /**
   * Normalize ISBN format
   * @param {string} isbn
   * @returns {string|null}
   */
  normalizeISBN(isbn) {
    if (!isbn) return null

    // Remove all non-digit characters except X (for ISBN-10)
    const cleaned = isbn.replace(/[^\dX]/g, '')

    // Validate length (ISBN-10: 10 chars, ISBN-13: 13 chars)
    if (cleaned.length === 10 || cleaned.length === 13) {
      return cleaned
    }

    return null
  }

  /**
   * Parse sequence number
   * @param {string|number} sequence
   * @returns {number|null}
   */
  parseSequence(sequence) {
    if (sequence == null) return null

    const num = parseFloat(sequence)
    return isNaN(num) ? null : num
  }

  /**
   * Extract date from text
   * @param {string} text
   * @returns {string|null}
   */
  extractDateFromText(text) {
    if (!text) return null

    // Look for date patterns (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, etc.)
    const datePatterns = [/(\d{4})-(\d{1,2})-(\d{1,2})/, /(\d{1,2})\/(\d{1,2})\/(\d{4})/, /(\d{1,2})[.-](\d{1,2})[.-](\d{4})/, /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/]

    for (const pattern of datePatterns) {
      const match = text.match(pattern)
      if (match) {
        try {
          let year, month, day

          if (pattern === datePatterns[0] || pattern === datePatterns[3]) {
            // YYYY-MM-DD format
            ;[, year, month, day] = match
          } else {
            // DD/MM/YYYY or MM/DD/YYYY format
            ;[, day, month, year] = match
          }

          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
          }
        } catch (error) {
          continue
        }
      }
    }

    return null
  }

  /**
   * Extract ISBN from text
   * @param {string} text
   * @returns {string|null}
   */
  extractISBNFromText(text) {
    if (!text) return null

    // Look for ISBN pattern
    const isbnPattern = /(?:ISBN[:\s]*)?(\d{1,5}[- ]?\d{1,7}[- ]?\d{1,7}[- ]?[\dX])/i
    const match = text.match(isbnPattern)

    if (match) {
      return this.normalizeISBN(match[1])
    }

    return null
  }

  /**
   * Extract sequence number from text
   * @param {string} text
   * @returns {number|null}
   */
  extractSequenceFromText(text) {
    if (!text) return null

    // Look for patterns like "Book 5", "#3", "Volume 2", etc.
    const sequencePatterns = [/(?:book|vol|volume|#)\s*(\d+(?:\.\d+)?)/i, /(\d+(?:\.\d+)?)(?:st|nd|rd|th)?\s*(?:book|vol|volume)/i, /^(\d+(?:\.\d+)?)$/]

    for (const pattern of sequencePatterns) {
      const match = text.match(pattern)
      if (match) {
        return parseFloat(match[1])
      }
    }

    return null
  }

  /**
   * Extract number from text
   * @param {string} text
   * @returns {number|null}
   */
  extractNumberFromText(text) {
    if (!text) return null

    const match = text.match(/(\d+)/)
    return match ? parseInt(match[1]) : null
  }

  /**
   * Get provider information
   * @returns {Object}
   */
  getInfo() {
    return {
      name: this.name,
      baseUrl: this.baseUrl,
      supportedFeatures: ['search', 'upcoming_books', 'series_tracking'],
      rateLimit: {
        requests: 60,
        period: '1 hour'
      }
    }
  }
}

module.exports = RisingShadowProvider
