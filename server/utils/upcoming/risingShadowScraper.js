// utils/upcoming/risingShadowScraper.js
// Handles scraping RisingShadow.net for Upcoming Book information

const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const Logger = require('../../Logger')

class RisingShadowScraper {
  /**
   * Constructs the RisingShadow search URL for a series and author.
   * @param {string} seriesName - Name of the book series
   * @param {string} authorName - Name of the author
   * @returns {string} - Search URL
   */
  static buildSearchUrl(seriesName, authorName) {
    const query = `${seriesName} by ${authorName}`.replace(/ /g, '+')
    const searchUrl = `https://www.risingshadow.net/search?q=${query}`
    // Logger.info(`[RisingShadowScraper] Built search URL: ${searchUrl}`)
    return searchUrl
  }

  /**
   * Gets HTTP headers for web scraping requests.
   * @returns {Object} - HTTP headers
   */
  static getRequestHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.risingshadow.net/',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  }

  /**
   * Scrapes RisingShadow for the next Upcoming Book in the series.
   * @param {string} searchUrl - URL to search
   * @param {number|null} currentMaxSequence - Current highest book number user owns (optional)
   * @returns {Promise<Object|null>} - Book info or null if not found
   */
  static async fetchUpcomingBookInfo(searchUrl, currentMaxSequence = null) {
    try {
      // Logger.info(`[RisingShadowScraper 1.0] Fetching data from: ${searchUrl}`)

      const { data } = await axios.get(searchUrl, {
        headers: this.getRequestHeaders()
      })

      // // Save debug HTML file
      // if (process.env.NODE_ENV === 'development') {
      //   fs.writeFileSync('debug_rising_shadow.html', data)
      //   Logger.info('[RisingShadowScraper 1.1] Saved debug HTML file')
      // }

      const $ = cheerio.load(data)
      const nextBook = this.findNextSequentialBook($, currentMaxSequence)

      if (!nextBook) {
        Logger.info('[RisingShadowScraper 1.2] No upcoming books found')
        return null
      }

      // Logger.info(`[RisingShadowScraper 1.3] Found Upcoming Book: ${nextBook.title}`)
      return nextBook
    } catch (error) {
      Logger.error(`[RisingShadowScraper 1.4] Error fetching book info: ${error}`)
      return null
    }
  }

  /**
   * Finds the next sequential book in the series by analyzing all books and finding the appropriate next one.
   * @param {Object} $ - Cheerio instance
   * @param {number|null} currentMaxSequence - Current highest book number user owns (optional)
   * @returns {Object|null} - Next book info or null if not found
   */
  static findNextSequentialBook($, currentMaxSequence = null) {
    const today = new Date()
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
          allBooks.push({
            title: `${bookData.title} Book ${bookData.seriesPos}`,
            release: bookData.release,
            link: bookData.link,
            cover: bookData.coverUrl,
            releaseDate: bookData.releaseDate,
            bookNumber: bookNumber,
            originalBookData: bookData
          })
        }
      } catch (error) {
        Logger.warn(`[RisingShadowScraper 2.0] Error parsing book row: ${error}`)
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
      const targetBook = allBooks.find(book => book.bookNumber === targetBookNumber)
      
      if (targetBook) {
        Logger.info(`[RisingShadowScraper] Found exact next sequential book: ${targetBook.title} (Book #${targetBook.bookNumber})`)
        return targetBook
      } else {
        Logger.info(`[RisingShadowScraper] Target book #${targetBookNumber} not found in search results`)
        // Fall through to general logic below
      }
    }
    
    // General logic: Find the next book that should be upcoming
    // Priority: lowest numbered book that exists, regardless of release date
    
    let nextBook = null
    
    // First, try to find any book with a future release date (prioritize by book number)
    const futureBooks = allBooks.filter(book => book.releaseDate > today)
    if (futureBooks.length > 0) {
      futureBooks.sort((a, b) => a.bookNumber - b.bookNumber)
      nextBook = futureBooks[0]
      Logger.info(`[RisingShadowScraper] Found future book: ${nextBook.title} (Book #${nextBook.bookNumber})`)
    } else {
      // If no future books, pick the highest numbered book (most recent release)
      allBooks.sort((a, b) => b.bookNumber - a.bookNumber)
      nextBook = allBooks[0]
      Logger.info(`[RisingShadowScraper] No future books, using highest numbered: ${nextBook.title} (Book #${nextBook.bookNumber})`)
    }
    
    return nextBook
  }

  /**
   * Parses the search results HTML and extracts Upcoming Book information.
   * @param {Object} $ - Cheerio instance
   * @param {Date} today - Current date
   * @returns {Array} - Array of Upcoming Book objects
   */
  static parseSearchResults($, today) {
    const upcomingBooks = []

    $('.table-row').each((i, el) => {
      try {
        const bookData = this.extractBookData($, el)

        if (this.isValidUpcomingBook(bookData, today)) {
          upcomingBooks.push({
            title: `${bookData.title} Book ${bookData.seriesPos}`,
            release: bookData.release,
            link: bookData.link,
            cover: bookData.coverUrl,
            releaseDate: bookData.releaseDate
          })
        }
      } catch (error) {
        Logger.warn(`[RisingShadowScraper 2.0] Error parsing book row: ${error}`)
      }
    })

    // Logger.info(`[RisingShadowScraper 2.1] Parsed ${upcomingBooks.length} upcoming books`)
    return upcomingBooks
  }

  /**
   * Extracts book data from a table row element.
   * @param {Object} $ - Cheerio instance
   * @param {Object} el - Table row element
   * @returns {Object} - Extracted book data
   */
  static extractBookData($, el) {
    // Title and link
    const titleLink = $(el).find('.table-cell-content > a').first()
    const title = titleLink.text().trim()
    const link = titleLink.attr('href') ? `https://www.risingshadow.net${titleLink.attr('href')}` : null

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
   * Extracts release date text from a table row element.
   * @param {Object} $ - Cheerio instance
   * @param {Object} el - Table row element
   * @returns {string|null} - Release date text
   */
  static extractReleaseDate($, el) {
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
   * Converts thumbnail cover URL to full-size cover URL.
   * @param {string} cover - Thumbnail cover path
   * @returns {string|null} - Full-size cover URL
   */
  static buildFullSizeCoverUrl(cover) {
    if (!cover) return null

    let coverUrl = `https://www.risingshadow.net${cover}`

    // Convert /images/book-thumb-12345/xyz.webp to /images/book-12345/xyz.webp
    if (coverUrl.match(/\/images\/book-thumb-(\d+)\//)) {
      coverUrl = coverUrl.replace(/\/images\/book-thumb-(\d+)\//, '/images/book-$1/')
    }

    return coverUrl
  }

  /**
   * Parses release date string into a Date object.
   * @param {string} release - Release date string
   * @returns {Date|null} - Parsed date or null
   */
  static parseReleaseDate(release) {
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

    Logger.warn(`[RisingShadowScraper 2.2] Could not parse release date: ${release}`)
    return null
  }

  /**
   * Validates if a book data object represents a valid Upcoming Book.
   * @param {Object} bookData - Book data object
   * @param {Date} today - Current date
   * @returns {boolean} - True if valid Upcoming Book
   */
  static isValidUpcomingBook(bookData, today) {
    const { title, seriesPos, release, link, coverUrl, releaseDate } = bookData

    return !!(title && seriesPos && release && link && coverUrl && releaseDate && releaseDate > today)
  }
}

module.exports = RisingShadowScraper
// End of risingShadowScraper.js
// This scraper fetches Upcoming Book information from RisingShadow.net, handling series and author searches,
