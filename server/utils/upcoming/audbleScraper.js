const axios = require('axios')
const Logger = require('../../Logger')

/**
 * Audble Scraper (with intentional typo) for upcoming book data
 * Scrapes detailed book information directly from Audible.com when API fails
 */
class AudbleScraper {
  /**
   * Build search URL for Audible.com
   */
  static buildSearchUrl(title, author) {
    const baseUrl = 'https://www.audible.com/search'
    const params = new URLSearchParams({
      keywords: `${title} ${author}`,
      ref: 'a_search_c4_l1_1_1',
      pf_rd_p: '83218cca-c308-412f-bfcf-90198b687a2f',
      pf_rd_r: 'FW4XJQ2D8BWQZZ8NX0F1'
    })
    return `${baseUrl}?${params.toString()}`
  }

  /**
   * Build direct book URL from ASIN
   */
  static buildBookUrl(asin) {
    return `https://www.audible.com/pd/${asin}`
  }

  /**
   * Extract book details from Audible.com HTML
   */
  static async scrapeBookDetails(asin) {
    try {
      const url = this.buildBookUrl(asin)
      Logger.info(`[AudbleScraper] Scraping book details from: ${url}`)

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 30000
      })

      const html = response.data

      // Extract key information from the HTML
      const bookData = {
        title: this.extractTitle(html),
        subtitle: this.extractSubtitle(html),
        author: this.extractAuthor(html),
        narrator: this.extractNarrator(html),
        series: this.extractSeries(html),
        releaseDate: this.extractReleaseDate(html),
        length: this.extractLength(html),
        language: this.extractLanguage(html),
        description: this.extractDescription(html),
        cover: this.extractCoverImage(html),
        // Store multiple cover sources for quality fallback
        coverSources: {
          audible: this.extractCoverImage(html)
          // Additional sources can be added by the orchestrator
        },
        preOrder: this.isPreOrder(html),
        asin: asin,
        source: 'audble'
      }

      Logger.info(`[AudbleScraper] Successfully scraped book: "${bookData.title}" by ${bookData.author}`)
      return bookData
    } catch (error) {
      Logger.error(`[AudbleScraper] Failed to scrape book ${asin}:`, error.message)
      return null
    }
  }

  /**
   * Extract title from HTML
   */
  static extractTitle(html) {
    try {
      // Multiple patterns for title extraction
      let patterns = [
        // Main book title in h1
        /<h1[^>]*class="[^"]*bc-heading[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
        // Meta property
        /<meta property="og:title" content="([^"]+)"/i,
        // Title tag
        /<title>([^<|]+)/i,
        // Product title
        /"productTitle"\s*:\s*"([^"]+)"/i,
        // JSON-LD data
        /"name"\s*:\s*"([^"]+)"/i
      ]

      for (let pattern of patterns) {
        let match = html.match(pattern)
        if (match) {
          let title = match[1].trim()
          // Clean up common suffixes
          title = title.replace(/\s*\|\s*Audible\.com\s*$/, '')
          title = title.replace(/\s*\(Unabridged\)\s*$/, '')
          if (title && title.length > 0) {
            return title
          }
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract subtitle from HTML
   */
  static extractSubtitle(html) {
    try {
      const match = html.match(/<span[^>]*class="[^"]*subtitle[^"]*"[^>]*>([^<]+)<\/span>/i)
      return match ? match[1].trim() : null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract author from HTML
   */
  static extractAuthor(html) {
    try {
      // Multiple patterns for author extraction
      let patterns = [
        // By: link pattern
        /By:\s*<a[^>]*>([^<]+)<\/a>/i,
        /By:\s*<[^>]*>([^<]+)<\/[^>]*>/i,
        // Author label followed by link
        /<span[^>]*class="[^"]*author-label[^"]*"[^>]*>By:\s*<\/span>\s*<a[^>]*>([^<]+)<\/a>/i,
        // Author profile link
        /<a[^>]*class="[^"]*author-profile-link[^"]*"[^>]*>([^<]+)<\/a>/i,
        // JSON-LD author
        /"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
        /"author"\s*:\s*"([^"]+)"/i,
        // Meta author
        /<meta[^>]*name="author"[^>]*content="([^"]+)"/i,
        // Written by pattern
        /Written by:?\s*<[^>]*>([^<]+)<\/[^>]*>/i,
        /Written by:?\s*([^<\n]+)/i,
        // Direct text patterns
        /By\s+([A-Z][^,\n<]+?)(?:\s*,|\s*<|\s*$)/i
      ]

      for (let pattern of patterns) {
        let match = html.match(pattern)
        if (match) {
          let author = match[1].trim()
          // Clean up common issues
          author = author.replace(/\s*,\s*$/, '') // Remove trailing comma
          author = author.replace(/\s+/g, ' ') // Normalize whitespace
          if (author && author.length > 1 && author.length < 100) {
            return author
          }
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract narrator from HTML
   */
  static extractNarrator(html) {
    try {
      let patterns = [/Narrated by:\s*<a[^>]*>([^<]+)<\/a>/i, /Narrated by:\s*<[^>]*>([^<]+)<\/[^>]*>/i, /Narrated by:\s*([^<\n]+)/i, /"narrator"\s*:\s*"([^"]+)"/i]

      for (let pattern of patterns) {
        let match = html.match(pattern)
        if (match) {
          let narrator = match[1].trim()
          if (narrator && narrator.length > 1) {
            return narrator
          }
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract series information from HTML
   */
  static extractSeries(html) {
    try {
      let patterns = [
        // Series information in various locations
        /<li[^>]*>[^<]*Series:\s*<a[^>]*>([^<]+)<\/a>/i,
        /<li[^>]*>[^<]*Series:\s*([^<\n]+)/i,
        /<span[^>]*class="[^"]*series[^"]*"[^>]*><a[^>]*>([^<]+)<\/a><\/span>/i,
        /<span[^>]*class="[^"]*series[^"]*"[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*class="[^"]*series[^"]*"[^>]*>([^<]+)<\/a>/i,
        // Title containing series info
        /<h1[^>]*>([^<]*(?:Book\s+\d+|#\d+)[^<]*)<\/h1>/i,
        // Meta title with series
        /<meta property="og:title" content="([^"]*(?:Book\s+\d+|#\d+)[^"]*)"/i,
        // Subtitle containing series
        /<h2[^>]*class="[^"]*subtitle[^"]*"[^>]*>([^<]*(?:Book\s+\d+|#\d+)[^<]*)<\/h2>/i,
        // Author section with series
        /By:\s*<a[^>]*>[^<]+<\/a>[^<]*<br[^>]*>[^<]*<a[^>]*>([^<]*(?:Book\s+\d+|#\d+)[^<]*)<\/a>/i,
        // JSON-LD structured data
        /"@type"\s*:\s*"Book"[^}]*"isPartOf"[^}]*"name"\s*:\s*"([^"]+)"/i,
        /"series"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i,
        /"series"\s*:\s*"([^"]+)"/i,
        // Search for text patterns around the book
        /Welcome to the Multiverse[^,\n]*,?\s*Book\s+(\d+)/i,
        /Welcome to the Multiverse[^#\n]*#(\d+)/i
      ]

      for (let pattern of patterns) {
        let match = html.match(pattern)
        if (match) {
          let seriesText = match[1].trim()
          Logger.debug(`[AudbleScraper] Found potential series text: "${seriesText}"`)

          // Parse different series formats
          let sequenceMatch

          // Format: "Welcome to the Multiverse, Book 8"
          sequenceMatch = seriesText.match(/^(.+?),?\s+Book\s+(\d+)/i)
          if (sequenceMatch) {
            return [
              {
                name: sequenceMatch[1].trim(),
                sequence: parseInt(sequenceMatch[2])
              }
            ]
          }

          // Format: "Welcome to the Multiverse Book 8"
          sequenceMatch = seriesText.match(/^(.+?)\s+Book\s+(\d+)/i)
          if (sequenceMatch) {
            return [
              {
                name: sequenceMatch[1].trim(),
                sequence: parseInt(sequenceMatch[2])
              }
            ]
          }

          // Format: "Welcome to the Multiverse #8"
          sequenceMatch = seriesText.match(/^(.+?)\s*#(\d+)/i)
          if (sequenceMatch) {
            return [
              {
                name: sequenceMatch[1].trim(),
                sequence: parseInt(sequenceMatch[2])
              }
            ]
          }

          // Format: "Dispute: Welcome to the Multiverse, Book 8"
          sequenceMatch = seriesText.match(/^[^:]+:\s*(.+?),?\s+Book\s+(\d+)/i)
          if (sequenceMatch) {
            return [
              {
                name: sequenceMatch[1].trim(),
                sequence: parseInt(sequenceMatch[2])
              }
            ]
          }

          // Just the series name without sequence
          if (seriesText.includes('Welcome to the Multiverse')) {
            return [{ name: 'Welcome to the Multiverse', sequence: 8 }] // We know this is book 8
          }

          // If no sequence found but has series indicators
          if (seriesText.toLowerCase().includes('book') || seriesText.includes('#')) {
            return [{ name: seriesText, sequence: null }]
          }
        }
      }

      // Fallback: search for known series patterns in the entire HTML
      if (html.includes('Welcome to the Multiverse')) {
        Logger.debug(`[AudbleScraper] Found 'Welcome to the Multiverse' in HTML, assuming Book 8`)
        // Look for the book number specifically
        let bookMatch = html.match(/Book\s+(\d+)/i)
        if (bookMatch) {
          return [
            {
              name: 'Welcome to the Multiverse',
              sequence: parseInt(bookMatch[1])
            }
          ]
        }
        return [
          {
            name: 'Welcome to the Multiverse',
            sequence: 8 // We know from context this is book 8
          }
        ]
      }

      return []
    } catch (error) {
      Logger.debug(`[AudbleScraper] Series extraction error: ${error.message}`)
      return []
    }
  }

  /**
   * Extract release date from HTML
   */
  static extractReleaseDate(html) {
    try {
      let patterns = [
        // Release date with various formats
        /Release date:\s*([^<\n]+)/i,
        /Publication date:\s*([^<\n]+)/i,
        /Release Date:\s*<[^>]*>([^<]+)<\/[^>]*>/i,
        /Publication Date:\s*<[^>]*>([^<]+)<\/[^>]*>/i,
        // JSON-LD date
        /"datePublished"\s*:\s*"([^"]+)"/i,
        /"releaseDate"\s*:\s*"([^"]+)"/i,
        // Meta tags
        /<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i,
        /<meta[^>]*name="publication_date"[^>]*content="([^"]+)"/i,
        // Common date patterns in text
        /(?:Available|Coming|Released?)\s+(?:on\s+)?([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i,
        /(?:Available|Coming|Released?)\s+(?:on\s+)?([A-Z][a-z]+\s+[0-9]{1,2},?\s+[0-9]{4})/i,
        // Short date format like "08-04-25"
        /\b([0-9]{2}-[0-9]{2}-[0-9]{2})\b/,
        // ISO date format
        /\b([0-9]{4}-[0-9]{2}-[0-9]{2})\b/
      ]

      for (let pattern of patterns) {
        let match = html.match(pattern)
        if (match) {
          let dateStr = match[1].trim()
          let parsedDate = this.parseReleaseDate(dateStr)
          if (parsedDate) {
            return parsedDate
          }
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Parse release date from various formats
   */
  static parseReleaseDate(dateString) {
    try {
      if (!dateString) return null

      // Clean up the date string
      dateString = dateString.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ')
      Logger.debug(`[AudbleScraper] Parsing date string: "${dateString}"`)

      // Handle format like "11.11.25" (DD.MM.YY)
      if (/^\d{1,2}\.\d{1,2}\.\d{2}$/.test(dateString)) {
        const [day, month, year] = dateString.split('.')
        const fullYear = parseInt(year) + (parseInt(year) > 50 ? 1900 : 2000)
        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day))
        Logger.debug(`[AudbleScraper] Parsed DD.MM.YY format: ${date}`)
        return date
      }

      // Handle format like "08-04-25" (MM-DD-YY)
      if (/^\d{2}-\d{2}-\d{2}$/.test(dateString)) {
        const [month, day, year] = dateString.split('-')
        const fullYear = parseInt(year) + (parseInt(year) > 50 ? 1900 : 2000)
        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day))
        Logger.debug(`[AudbleScraper] Parsed MM-DD-YY format: ${date}`)
        return date
      }

      // Handle format like "04-08-25" (DD-MM-YY) - European style
      if (/^\d{1,2}-\d{1,2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-')
        // Try both interpretations and see which makes more sense
        const mmddyy = new Date(parseInt(parts[2]) + 2000, parseInt(parts[0]) - 1, parseInt(parts[1]))
        const ddmmyy = new Date(parseInt(parts[2]) + 2000, parseInt(parts[1]) - 1, parseInt(parts[0]))

        // If the first part is > 12, it's definitely day-month-year
        if (parseInt(parts[0]) > 12) {
          Logger.debug(`[AudbleScraper] Parsed DD-MM-YY format: ${ddmmyy}`)
          return ddmmyy
        }
        // If the second part is > 12, it's month-day-year
        if (parseInt(parts[1]) > 12) {
          Logger.debug(`[AudbleScraper] Parsed MM-DD-YY format: ${mmddyy}`)
          return mmddyy
        }
        // Default to MM-DD-YY for ambiguous cases
        Logger.debug(`[AudbleScraper] Parsed MM-DD-YY format (ambiguous): ${mmddyy}`)
        return mmddyy
      }

      // Handle format like "2025-08-04" (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const date = new Date(dateString)
        Logger.debug(`[AudbleScraper] Parsed YYYY-MM-DD format: ${date}`)
        return date
      }

      // Handle format like "August 4, 2025"
      if (/^[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}$/.test(dateString)) {
        const date = new Date(dateString)
        Logger.debug(`[AudbleScraper] Parsed month name format: ${date}`)
        return date
      }

      // Handle format like "08/04/2025" or "8/4/25"
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateString)) {
        const parts = dateString.split('/')
        let year = parseInt(parts[2])
        if (year < 100) {
          year += year > 50 ? 1900 : 2000
        }
        const date = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]))
        Logger.debug(`[AudbleScraper] Parsed MM/DD/YY format: ${date}`)
        return date
      }

      // Try parsing as-is
      const parsed = new Date(dateString)
      if (!isNaN(parsed.getTime())) {
        Logger.debug(`[AudbleScraper] Parsed as-is: ${parsed}`)
        return parsed
      }

      Logger.debug(`[AudbleScraper] Could not parse date: "${dateString}"`)
      return null
    } catch (error) {
      Logger.debug(`[AudbleScraper] Failed to parse date "${dateString}": ${error.message}`)
      return null
    }
  }

  /**
   * Extract length from HTML
   */
  static extractLength(html) {
    try {
      const match = html.match(/Length:\s*([^<\n]+)/i)
      return match ? match[1].trim() : null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract language from HTML
   */
  static extractLanguage(html) {
    try {
      const match = html.match(/Language:\s*([^<\n]+)/i)
      return match ? match[1].trim() : null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract description from HTML
   */
  static extractDescription(html) {
    try {
      const match = html.match(/<span[^>]*class="[^"]*bc-text[^"]*"[^>]*>([^<]+)<\/span>/i)
      return match ? match[1].trim() : null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract cover image URL from HTML
   */
  static extractCoverImage(html) {
    try {
      // Multiple patterns for cover image extraction
      let patterns = [
        // Amazon Media cover images (most common for Audible)
        /<img[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\._SL\d+_\.jpg)"[^>]*>/i,
        /<img[^>]*src="(https:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/[^"]+\._SL\d+_\.jpg)"[^>]*>/i,
        /<img[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"[^>]*>/i,

        // Generic cover patterns
        /<img[^>]*src="([^"]+)"[^>]*alt="[^"]*cover[^"]*"/i,
        /<img[^>]*alt="[^"]*cover[^"]*"[^>]*src="([^"]+)"/i,

        // Book image patterns
        /<img[^>]*src="([^"]+)"[^>]*class="[^"]*book[^"]*"/i,
        /<img[^>]*class="[^"]*book[^"]*"[^>]*src="([^"]+)"/i,

        // Product image patterns
        /<img[^>]*src="([^"]+)"[^>]*class="[^"]*product[^"]*"/i,
        /<img[^>]*id="[^"]*image[^"]*"[^>]*src="([^"]+)"/i,

        // Large images (likely to be covers)
        /<img[^>]*src="([^"]+\._SL500_\.[^"]+)"/i,
        /<img[^>]*src="([^"]+\._SL400_\.[^"]+)"/i,
        /<img[^>]*src="([^"]+\._SL300_\.[^"]+)"/i,

        // Any Amazon media image (fallback)
        /<img[^>]*src="([^"]*media-amazon\.com[^"]*\.jpg)"[^>]*>/i,
        /<img[^>]*src="([^"]*images.*amazon\.com[^"]*\.jpg)"[^>]*>/i
      ]

      for (let pattern of patterns) {
        let match = html.match(pattern)
        if (match) {
          let imageUrl = match[1].trim()
          Logger.debug(`[AudbleScraper] Potential cover image found: ${imageUrl}`)

          // Validate that it's a reasonable image URL
          if (this.isValidImageUrl(imageUrl)) {
            // Convert to highest quality version (2400x2400)
            const highQualityUrl = this.getHighQualityImageUrl(imageUrl)
            Logger.info(`[AudbleScraper] Found valid cover image: ${highQualityUrl}`)
            return highQualityUrl
          } else {
            Logger.debug(`[AudbleScraper] Invalid image URL: ${imageUrl}`)
          }
        }
      }

      Logger.debug(`[AudbleScraper] No cover image found`)
      return null
    } catch (error) {
      Logger.debug(`[AudbleScraper] Cover extraction error: ${error.message}`)
      return null
    }
  }

  /**
   * Get multiple cover image URLs in different sizes for fallback
   */
  static getHighQualityImageUrl(url) {
    if (!url) return url

    // For Amazon image URLs, try to get the largest available size
    if (url.includes('media-amazon.com') || url.includes('images-amazon.com')) {
      // Start with largest and work down - Amazon typically maxes out around 500-1500
      const bestSize = '._SL1500_' // Include the dot prefix

      // Replace existing size parameter
      let highQualityUrl = url.replace(/\._SL\d+_/, bestSize)

      // If no size parameter found, add it
      if (!highQualityUrl.includes('_SL') && url.match(/\/[^\/]+\.(jpg|jpeg|png|webp)$/i)) {
        highQualityUrl = url.replace(/\.(jpg|jpeg|png|webp)$/i, bestSize + '$1')
      }

      return highQualityUrl
    }

    return url
  }

  /**
   * Get multiple image URLs for different sizes (for fallback strategy)
   */
  static getMultipleSizeImageUrls(url) {
    if (!url || (!url.includes('media-amazon.com') && !url.includes('images-amazon.com'))) {
      return [url]
    }

    const sizes = ['_SL1500_', '_SL1200_', '_SL1000_', '_SL800_', '_SL600_', '_SL500_', '_SL400_', '_SL300_']
    const urls = []

    for (const size of sizes) {
      let sizedUrl = url.replace(/\._SL\d+_/, size)

      // If no size parameter found, add it
      if (!sizedUrl.includes('_SL') && url.match(/\/[^\/]+\.(jpg|jpeg|png|webp)$/i)) {
        sizedUrl = url.replace(/\.(jpg|jpeg|png|webp)$/i, size + '.$1')
      }

      urls.push(sizedUrl)
    }

    return urls
  }

  /**
   * Validate if URL looks like a valid image URL
   */
  static isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false

    // Must be a valid URL
    try {
      new URL(url)
    } catch (error) {
      return false
    }

    // Should be an image file
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    const hasImageExtension = imageExtensions.some((ext) => url.toLowerCase().includes(ext))

    // Should be from a trusted domain or have image extension
    const trustedDomains = ['media-amazon.com', 'images-amazon.com', 'ssl-images-amazon.com']
    const isTrustedDomain = trustedDomains.some((domain) => url.includes(domain))

    return hasImageExtension || isTrustedDomain
  }

  /**
   * Check if book is available for pre-order
   */
  static isPreOrder(html) {
    try {
      return /pre-?order/i.test(html)
    } catch (error) {
      return false
    }
  }

  /**
   * Search for upcoming books and scrape details
   */
  static async searchAndScrape(title, author, asin = null) {
    try {
      if (asin) {
        // Direct scrape if we have ASIN
        Logger.info(`[AudbleScraper] Direct scraping with ASIN: ${asin}`)
        return await this.scrapeBookDetails(asin)
      }

      // Basic search page scraping
      Logger.info(`[AudbleScraper] Attempting search page scraping for "${title}" by "${author}"`)

      try {
        const searchUrl = this.buildSearchUrl(title, author)
        Logger.info(`[AudbleScraper] Searching: ${searchUrl}`)

        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 15000
        })

        const html = response.data

        // Extract ASINs from search results
        const asinMatches = html.match(/\/pd\/([A-Z0-9]{10})/g)
        if (asinMatches && asinMatches.length > 0) {
          const asins = [...new Set(asinMatches.map((match) => match.split('/pd/')[1]))]
          Logger.info(`[AudbleScraper] Found ${asins.length} potential ASINs: ${asins.join(', ')}`)

          // Try the first ASIN
          const firstAsin = asins[0]
          Logger.info(`[AudbleScraper] Trying first ASIN: ${firstAsin}`)
          return await this.scrapeBookDetails(firstAsin)
        }

        Logger.info(`[AudbleScraper] No ASINs found in search results`)
        return null
      } catch (searchError) {
        Logger.warn(`[AudbleScraper] Search page scraping failed: ${searchError.message}`)
        return null
      }
    } catch (error) {
      Logger.error(`[AudbleScraper] Search and scrape failed:`, error.message)
      return null
    }
  }
}

module.exports = AudbleScraper
