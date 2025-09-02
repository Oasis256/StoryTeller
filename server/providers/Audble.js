const axios = require('axios')
const Logger = require('../Logger')
const Audible = require('./Audible')

/**
 * Audble Provider - Enhanced provider for upcoming book discovery
 * First uses the existing Audible provider for searching, then falls back to web scraping
 * for upcoming books that Audible doesn't find by default
 *
 * Features:
 * - Uses existing Audible provider first (reusing tested code)
 * - Falls back to intelligent web scraping for upcoming books
 * - Proper rate limiting and error handling
 * - Respectful crawling practices
 */
class Audble {
  constructor() {
    this.name = 'audble'
    this.baseUrl = 'https://www.audible.com'
    this.searchUrl = 'https://www.audible.com/search'
    this.rateLimitDelay = 2000 // 2 seconds between requests
    this.maxRetries = 3
    this.timeout = 30000 // 30 seconds

    // Initialize the existing Audible provider
    this.audibleProvider = new Audible()

    // User agent rotation for respectful scraping
    this.userAgents = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36']

    this.lastRequestTime = 0
    Logger.info('[Audble] Provider initialized with Audible provider integration')
  }

  /**
   * Main search method - follows provider interface
   * Strategy: Search for UPCOMING books in the series, not the current book
   */
  async search(title, author, asin, region = 'us') {
    try {
      Logger.info(`[Audble] Searching for upcoming books in series: "${title}" by "${author}" (current book ASIN: ${asin})`)

      let results = []

      // Strategy 1: Web scraping for upcoming books (primary method)
      Logger.info('[Audble] Trying web scraping for upcoming books...')
      results = await this.searchWithWebScraping(title, author, asin, region)

      if (results.length > 0) {
        Logger.info(`[Audble] Found ${results.length} results with web scraping`)
        return results
      }

      // Strategy 2: Fallback to search for upcoming books using current book info
      Logger.info('[Audble] Web scraping failed, trying Audible API fallback...')
      const audibleResults = await this.searchWithAudibleProvider(title, author, null, region) // Don't pass current ASIN

      if (audibleResults.length > 0) {
        Logger.info(`[Audble] Found ${audibleResults.length} results with Audible API fallback`)
        return audibleResults
      }

      Logger.info('[Audble] No upcoming books found')
      return []
    } catch (error) {
      Logger.error('[Audble] Search failed:', error.message)
      return []
    }
  }

  /**
   * Search using the existing Audible provider
   */
  async searchWithAudibleProvider(title, author, asin, region) {
    try {
      Logger.info(`[Audble] Searching with Audible provider: "${title}" by "${author}"`)
      Logger.info(`[Audble] Title contains "welcome to the multiverse": ${title && title.toLowerCase().includes('welcome to the multiverse')}`)

      // Fallback to normal search
      const results = await this.audibleProvider.search(title, author, asin, region, this.timeout)

      if (!results || results.length === 0) {
        Logger.info('[Audble] Audible provider returned no results')
        return []
      }

      Logger.info(`[Audble] Audible provider found ${results.length} results:`)
      results.forEach((result, index) => {
        Logger.info(`[Audble] Result ${index + 1}: "${result.title}" by ${result.author} (ASIN: ${result.asin})`)
      })

      // Convert Audible provider results to our format
      return results.map((result) => this.convertAudibleResult(result))
    } catch (error) {
      Logger.info(`[Audble] Audible provider search failed: ${error.message}`)

      // Check if the error contains an ASIN (future release date case)
      const asinFromError = this.extractASINFromError(error)
      if (asinFromError) {
        Logger.info(`[Audble] Found ASIN in error: ${asinFromError} - attempting direct scraping`)
        const scrapedResult = await this.scrapeBookByASIN(asinFromError)
        if (scrapedResult) {
          Logger.info(`[Audble] Successfully scraped book with ASIN: ${asinFromError}`)
          return [scrapedResult]
        }
      }

      return []
    }
  }

  /**
   * Convert Audible provider result to our format
   */
  convertAudibleResult(audibleResult) {
    // Extract sequence number from series data if available
    let sequence = null
    let seriesName = null

    if (audibleResult.series && Array.isArray(audibleResult.series) && audibleResult.series.length > 0) {
      const primarySeries = audibleResult.series[0]
      seriesName = primarySeries.series || primarySeries.name
      sequence = primarySeries.sequence || null

      // Log the extracted sequence for debugging
      if (sequence) {
        Logger.info(`[Audble] Extracted sequence ${sequence} from series "${seriesName}" for book "${audibleResult.title}"`)
      }
    }

    return {
      title: audibleResult.title,
      author: audibleResult.author,
      asin: audibleResult.asin,
      releaseDate: audibleResult.publishedYear ? new Date(audibleResult.publishedYear, 0, 1) : null,
      cover: audibleResult.cover,
      description: audibleResult.description,
      series: audibleResult.series,
      sequence: sequence, // Add sequence number for ProviderResultAdapter
      source: 'audible_provider',
      url: audibleResult.asin ? `${this.baseUrl}/pd/${audibleResult.asin}` : null,
      // Additional fields from Audible provider
      narrator: audibleResult.narrator,
      publisher: audibleResult.publisher,
      duration: audibleResult.duration,
      language: audibleResult.language,
      genres: audibleResult.genres,
      tags: audibleResult.tags,
      rating: audibleResult.rating,
      abridged: audibleResult.abridged
    }
  }

  /**
   * Fallback web scraping search for upcoming books
   */
  async searchWithWebScraping(title, author, asin, region) {
    try {
      // Rate limiting
      await this.respectRateLimit()

      let results = []

      // Strategy 1: Use ASIN to find series and search for upcoming books
      if (asin) {
        Logger.info(`[Audble] Using ASIN ${asin} to search for upcoming books in series`)
        results = await this.searchForUpcomingByASIN(asin, title, author)
        if (results.length > 0) {
          Logger.info(`[Audble] Found ${results.length} upcoming books via ASIN-based series search`)
          return results
        }
      }

      // Strategy 2: Series search for upcoming books
      if (title) {
        Logger.info(`[Audble] Searching for upcoming books in series: "${title}"`)
        results = await this.searchForUpcomingInSeries(title, author)
        if (results.length > 0) {
          Logger.info(`[Audble] Found ${results.length} upcoming books in series via scraping`)
          return results
        }
      }

      // Strategy 3: Title + Author search (fallback)
      if (title && author) {
        Logger.info(`[Audble] Fallback: searching by title and author`)
        results = await this.searchByTitleAndAuthor(title, author)
        if (results.length > 0) {
          Logger.info(`[Audble] Found ${results.length} results by title/author scraping`)
          return results
        }
      }

      return []
    } catch (error) {
      Logger.debug(`[Audble] Web scraping search failed: ${error.message}`)
      return []
    }
  }

  /**
   * Search by ASIN (Amazon Standard Identification Number)
   */
  async searchByASIN(asin) {
    try {
      // Validate ASIN format
      if (!this.isValidASIN(asin)) {
        Logger.debug(`[Audble] Invalid ASIN format: ${asin}`)
        return []
      }

      const url = `${this.baseUrl}/pd/${asin}`
      const response = await this.makeRequest(url)

      if (!response) return []

      // Parse the product page
      const bookData = this.parseProductPage(response.data, asin)
      return bookData ? [bookData] : []
    } catch (error) {
      Logger.debug(`[Audble] ASIN search failed for ${asin}:`, error.message)
      return []
    }
  }

  /**
   * Search by title and author
   */
  async searchByTitleAndAuthor(title, author) {
    try {
      const query = `${title} ${author}`.replace(/\s+/g, '+')
      const url = `${this.searchUrl}?keywords=${encodeURIComponent(query)}`

      const response = await this.makeRequest(url)
      if (!response) return []

      return this.parseSearchResults(response.data)
    } catch (error) {
      Logger.debug(`[Audble] Title/author search failed:`, error.message)
      return []
    }
  }

  /**
   * Search for upcoming books using ASIN to find series information
   */
  async searchForUpcomingByASIN(asin, seriesName, authorName) {
    try {
      Logger.info(`[Audble] Searching for upcoming books using ASIN: ${asin}`)

      // First, get the product page to extract series information
      const productUrl = `${this.baseUrl}/pd/${asin}`
      const response = await this.makeRequest(productUrl)

      if (!response) {
        Logger.info(`[Audble] Failed to fetch product page for ASIN: ${asin}`)
        return []
      }

      // Extract series information from the product page
      const seriesInfo = this.extractSeriesInfo(response.data)
      if (!seriesInfo || seriesInfo.length === 0) {
        Logger.info(`[Audble] No series information found for ASIN: ${asin}`)
        return []
      }

      Logger.info(`[Audble] Found series info: ${JSON.stringify(seriesInfo)}`)

      // Search for upcoming books in the series
      const results = []
      for (const series of seriesInfo) {
        if (series.name) {
          Logger.info(`[Audble] Searching for upcoming books in series: "${series.name}"`)
          const seriesResults = await this.searchForUpcomingInSeries(series.name, authorName)
          results.push(...seriesResults)
        }
      }

      Logger.info(`[Audble] ASIN-based search completed, found ${results.length} upcoming books`)
      return results
    } catch (error) {
      Logger.info(`[Audble] ASIN-based upcoming search failed:`, error.message)
      return []
    }
  }

  /**
   * Search for upcoming books in a series
   */
  async searchForUpcomingInSeries(seriesName, authorName) {
    try {
      Logger.info(`[Audble] Searching Audible.com for upcoming books: "${seriesName}" by "${authorName}"`)

      // Strategy 1: Search for pre-order books in the series
      let results = []

      // Try different search terms that might reveal pre-orders
      const searchTerms = [`${seriesName} ${authorName} preorder`, `${seriesName} ${authorName} pre-order`, `${seriesName} ${authorName} coming soon`, `${seriesName} ${authorName} 2024 2025`, `"${seriesName}" "${authorName}"`]

      for (const query of searchTerms) {
        Logger.info(`[Audble] Trying search: ${query}`)
        const url = `${this.searchUrl}?keywords=${encodeURIComponent(query)}`

        const response = await this.makeRequest(url)
        if (!response) continue

        const searchResults = this.parseSearchResults(response.data)
        Logger.info(`[Audble] Found ${searchResults.length} results for "${query}"`)

        // Filter for upcoming books
        const upcomingBooks = searchResults.filter((book) => this.isUpcomingBook(book))
        if (upcomingBooks.length > 0) {
          Logger.info(`[Audble] Found ${upcomingBooks.length} upcoming books with search: ${query}`)
          results.push(...upcomingBooks)
        }
      }

      return results
    } catch (error) {
      Logger.debug(`[Audble] Series upcoming search failed:`, error.message)
      return []
    }
  }

  /**
   * Make HTTP request with proper headers and rate limiting
   */
  async makeRequest(url, retries = 0) {
    try {
      // Rate limiting
      await this.respectRateLimit()

      const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)]

      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          Referer: this.baseUrl
        },
        timeout: this.timeout
      })

      this.lastRequestTime = Date.now()
      return response
    } catch (error) {
      if (retries < this.maxRetries && this.isRetryableError(error)) {
        Logger.debug(`[Audble] Request failed, retrying (${retries + 1}/${this.maxRetries}): ${error.message}`)
        await this.delay(1000 * (retries + 1)) // Exponential backoff
        return this.makeRequest(url, retries + 1)
      }

      Logger.debug(`[Audble] Request failed after ${retries} retries: ${error.message}`)
      return null
    }
  }

  /**
   * Respect rate limiting
   */
  async respectRateLimit() {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest
      await this.delay(delay)
    }
  }

  /**
   * Parse product page HTML
   */
  parseProductPage(html, asin) {
    try {
      // Extract title
      const titleMatch = html.match(/<h1[^>]*class="[^"]*bc-heading[^"]*"[^>]*>([^<]+)<\/h1>/i)
      const title = titleMatch ? titleMatch[1].trim() : null

      // Extract author
      const authorMatch = html.match(/By:\s*<a[^>]*>([^<]+)<\/a>/i)
      const author = authorMatch ? authorMatch[1].trim() : null

      // Extract release date
      const releaseMatch = html.match(/Release date:\s*([^<\n]+)/i)
      const releaseDate = releaseMatch ? this.parseReleaseDate(releaseMatch[1].trim()) : null

      // Extract cover image
      const coverMatch = html.match(/<img[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\._SL\d+_\.jpg)"[^>]*>/i)
      const cover = coverMatch ? coverMatch[1] : null

      // Extract description
      const descMatch = html.match(/<span[^>]*class="[^"]*bc-text[^"]*"[^>]*>([^<]+)<\/span>/i)
      const description = descMatch ? descMatch[1].trim() : null

      // Extract series information
      const series = this.extractSeriesInfo(html)

      if (!title || !author) {
        return null
      }

      return {
        title,
        author,
        asin,
        releaseDate,
        cover,
        description,
        series,
        source: 'audble_scraping',
        url: `${this.baseUrl}/pd/${asin}`
      }
    } catch (error) {
      Logger.debug(`[Audble] Product page parsing failed: ${error.message}`)
      return null
    }
  }

  /**
   * Parse search results HTML
   */
  parseSearchResults(html) {
    const results = []

    try {
      // Extract ASINs from search results
      const asinMatches = html.match(/\/pd\/([A-Z0-9]{10})/g)
      if (!asinMatches) return results

      // Get unique ASINs
      const asins = [...new Set(asinMatches.map((match) => match.split('/pd/')[1]))]

      // For each ASIN, try to get product details
      for (const asin of asins.slice(0, 5)) {
        // Limit to first 5 results
        const productUrl = `${this.baseUrl}/pd/${asin}`

        // Make a quick request to get product details
        this.makeRequest(productUrl)
          .then((response) => {
            if (response) {
              const bookData = this.parseProductPage(response.data, asin)
              if (bookData) {
                results.push(bookData)
              }
            }
          })
          .catch((error) => {
            Logger.debug(`[Audble] Failed to get details for ASIN ${asin}: ${error.message}`)
          })
      }
    } catch (error) {
      Logger.debug(`[Audble] Search results parsing failed: ${error.message}`)
    }

    return results
  }

  /**
   * Extract series information from HTML
   */
  extractSeriesInfo(html) {
    try {
      // Look for series information in various patterns
      const patterns = [/<li[^>]*>[^<]*Series:\s*<a[^>]*>([^<]+)<\/a>/i, /<span[^>]*class="[^"]*series[^"]*"[^>]*><a[^>]*>([^<]+)<\/a><\/span>/i, /"series"\s*:\s*"([^"]+)"/i]

      for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
          return [{ name: match[1].trim(), sequence: null }]
        }
      }

      return []
    } catch (error) {
      return []
    }
  }

  /**
   * Parse release date string
   */
  parseReleaseDate(dateString) {
    try {
      if (!dateString) return null

      // Try various date formats
      const date = new Date(dateString)
      if (!isNaN(date.getTime())) {
        return date
      }

      // Try DD MMM YYYY format
      const match = dateString.match(/(\d{1,2}) ([A-Za-z]{3,}) (\d{4})/)
      if (match) {
        return new Date(`${match[3]}-${match[2]}-${match[1]}`)
      }

      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Check if book is upcoming (not yet released)
   */
  isUpcomingBook(book) {
    if (!book.releaseDate) return false

    const today = new Date()
    return book.releaseDate > today
  }

  /**
   * Validate ASIN format
   */
  isValidASIN(asin) {
    if (!asin || typeof asin !== 'string') return false

    // ASIN should be 10 characters, alphanumeric
    const asinPattern = /^[A-Z0-9]{10}$/
    return asinPattern.test(asin)
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableCodes = [408, 429, 500, 502, 503, 504]
    return error.response && retryableCodes.includes(error.response.status)
  }

  /**
   * Extract ASIN from error message (for future release date books)
   */
  extractASINFromError(error) {
    try {
      if (!error) return null

      // Check if error has a response with data (Axios error structure)
      if (error.response && error.response.data) {
        const responseData = error.response.data

        // Check response.data.message
        if (responseData.message) {
          const asinPattern = /[A-Z0-9]{10}/g
          const matches = responseData.message.match(asinPattern)

          if (matches && matches.length > 0) {
            const asin = matches[0]
            Logger.info(`[Audble] Extracted ASIN from error.response.data.message: ${asin}`)
            return asin
          }
        }
      }

      // Fallback: Check error.message
      if (error.message) {
        const asinPattern = /[A-Z0-9]{10}/g
        const matches = error.message.match(asinPattern)

        if (matches && matches.length > 0) {
          const asin = matches[0]
          Logger.info(`[Audble] Extracted ASIN from error.message: ${asin}`)
          return asin
        }
      }

      Logger.info(`[Audble] No ASIN found in error response`)
      return null
    } catch (extractError) {
      Logger.info(`[Audble] Error extracting ASIN from error: ${extractError.message}`)
      return null
    }
  }

  /**
   * Scrape book directly by ASIN from Audible.com
   */
  async scrapeBookByASIN(asin) {
    try {
      Logger.info(`[Audble] Scraping book directly by ASIN: ${asin}`)

      const url = `https://www.audible.com/pd/${asin}`
      const response = await this.makeRequest(url)

      if (!response) {
        Logger.info(`[Audble] Failed to fetch Audible page for ASIN: ${asin}`)
        return null
      }

      // Parse the product page
      const bookData = this.parseProductPage(response.data, asin)
      if (!bookData) {
        Logger.info(`[Audble] Failed to parse book data for ASIN: ${asin}`)
        return null
      }

      Logger.info(`[Audble] Successfully scraped book: "${bookData.title}"`)
      return bookData
    } catch (error) {
      Logger.info(`[Audble] Failed to scrape book by ASIN ${asin}: ${error.message}`)
      return null
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

module.exports = Audble
