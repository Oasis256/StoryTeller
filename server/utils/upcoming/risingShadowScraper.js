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
   * @returns {Promise<Object|null>} - Book info or null if not found
   */
  static async fetchUpcomingBookInfo(searchUrl) {
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
      const today = new Date()
      const upcomingBooks = this.parseSearchResults($, today)

      if (upcomingBooks.length === 0) {
        Logger.info('[RisingShadowScraper 1.2] No upcoming books found')
        return null
      }

      // Sort by soonest release date and return the first one
      upcomingBooks.sort((a, b) => a.releaseDate - b.releaseDate)
      const nextBook = upcomingBooks[0]

      // Logger.info(`[RisingShadowScraper 1.3] Found Upcoming Book: ${nextBook.title}`)
      return nextBook
    } catch (error) {
      Logger.error(`[RisingShadowScraper 1.4] Error fetching book info: ${error}`)
      return null
    }
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
// parsing HTML, and extracting relevant book details including title, release date, and cover image.
// It also includes utility functions for building search URLs and parsing release dates.
// RisingShadowScraper.js (Handles scraping RisingShadow.net for Upcoming Book information)
// This scraper is integrated with the UpcomingBookController to provide Upcoming Book data for series and authors
// and is used in the UpcomingBookService for caching and processing book information.
// It is designed to work seamlessly with the UpcomingBookController and UpcomingBookService for fetching and
// caching Upcoming Book data from RisingShadow.net, ensuring that the data is up-to-date and
// correctly formatted for use in the application.
// This scraper is part of the overall system for managing and displaying upcoming books in the application.
// It is used to scrape RisingShadow.net for Upcoming Book information, including series and author searches
// and is integrated with the UpcomingBookController and UpcomingBookService for caching and processing book data
// to provide a seamless user experience.
// This scraper is designed to be used in conjunction with the UpcomingBookController and UpcomingBookService
// to provide a comprehensive solution for managing and displaying upcoming books in the application.
// It handles scraping RisingShadow.net for Upcoming Book information, including series and author searches,
// parsing HTML, and extracting relevant book details such as title, release date, and cover image
// and is integrated with the UpcomingBookController and UpcomingBookService for caching and processing book data
// to ensure that the data is up-to-date and correctly formatted for use in the application.
// It is designed to work seamlessly with the UpcomingBookController and UpcomingBookService for fetching and
// caching Upcoming Book data from RisingShadow.net, ensuring that the data is up-to-date and
// correctly formatted for use in the application.
// This scraper is part of the overall system for managing and displaying upcoming books in the application.
// It is used to scrape RisingShadow.net for Upcoming Book information, including series and author searches
// and is integrated with the UpcomingBookController and UpcomingBookService for caching and processing book data
// to provide a seamless user experience.
