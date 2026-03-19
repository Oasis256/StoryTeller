const Audible = require('./Audible')
const axios = require('axios').default
const cheerio = require('cheerio')

class Audble extends Audible {
  constructor() {
    super()
    this._futureAsinRetryLimit = 1
    this.seriesMetadata = null // Store series metadata during scraping
  }

  /**
   * Make HTTP request to audible.com directly
   */
  async makeAudibleRequest(url, options = {}) {
    const defaultOptions = {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    }

    const requestOptions = { ...defaultOptions, ...options }

    try {
    // Keep logs minimal; rely on errors for visibility.
      const response = await axios.get(url, requestOptions)
      return response
    } catch (error) {
    this.logWarn(`[Audble] Audible.com request failed: ${error.message}`)
      if (error.response) {
      this.logWarn(`[Audble] Response status: ${error.response.status}`)
        if (error.response.status === 403 || error.response.status === 503) {
        this.logWarn('[Audble] Possible bot block detected on audible.com')
        }
      }
      throw error
    }
  }

  cleanResult(item) {
    const cleaned = super.cleanResult(item)
    const rawDate = item?.releaseDate || item?.datePublished || null
    if (rawDate) {
      cleaned.releaseDate = rawDate
    }
    const seriesAsin = item?.seriesPrimary?.asin || item?.seriesPrimary?.id || (Array.isArray(item?.series) ? item.series[0]?.asin || item.series[0]?.id : null) || item?.series?.asin || item?.series?.id || null
    if (seriesAsin) cleaned.seriesAsin = String(seriesAsin).toUpperCase()
    if (!cleaned.seriesName && Array.isArray(cleaned.series) && cleaned.series[0]?.series) {
      cleaned.seriesName = cleaned.series[0].series
    }
    if (!cleaned.seriesPosition && Array.isArray(cleaned.series) && cleaned.series[0]?.sequence) {
      cleaned.seriesPosition = cleaned.series[0].sequence
    }
    return cleaned
  }

  extractAsinFromError(err) {
    if (!err) return null
    const message = err?.response?.data?.message || err?.message || ''
    if (!message || typeof message !== 'string') return null

    // audnex future release returns JSON with message containing ASIN
    const match = message.match(/ASIN\s*[:\-]?\s*([A-Z0-9]{10})/i)
    if (!match || !match[1]) return null
    const candidate = match[1].toUpperCase()
    if (!/^[A-Z0-9]{10}$/.test(candidate)) return null
    return candidate
  }

  parseDurationToMinutes(duration) {
    if (!duration) return 0
    if (typeof duration === 'number') return duration
    if (typeof duration !== 'string') return 0

    // ISO 8601 duration: PT6H45M
    let match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i)
    if (match) {
      const hours = Number(match[1] || 0)
      const minutes = Number(match[2] || 0)
      return hours * 60 + minutes
    }

    // Human readable duration: 6 hrs and 45 mins
    match = duration.match(/(\d+)\s*(?:h|hrs|hours?)\b(?:\s*(?:and|,)\s*(\d+)\s*(?:m|min|mins|minutes?)\b)?/i)
    if (match) {
      const hours = Number(match[1] || 0)
      const minutes = Number(match[2] || 0)
      return hours * 60 + minutes
    }
    match = duration.match(/(\d+)\s*(?:m|min|mins|minutes?)\b/i)
    if (match) {
      return Number(match[1])
    }

    // Fallback to numbers only
    match = duration.match(/(\d+)/)
    return match ? Number(match[1]) : 0
  }

  logInfo(...args) {
    if (this.logger?.info) {
      this.logger.info(...args)
    } else {
      console.log(...args)
    }
  }

  logWarn(...args) {
    if (this.logger?.warn) {
      this.logger.warn(...args)
    } else {
      console.warn(...args)
    }
  }

  extractAsinFromHref(href) {
    if (!href || typeof href !== 'string') return null
    const match = href.match(/\/pd\/([A-Z0-9]{10})/i)
    return match ? match[1].toUpperCase() : null
  }

  async scrapeNextInSeriesAsin(currentAsin, timeout = 30000) {
    if (!currentAsin) return null
    const url = `https://www.audible.com/pd/${encodeURIComponent(currentAsin)}`
    // Silence verbose logging for regular requests.

    const response = await this.makeAudibleRequest(url, { timeout })
    const html = response?.data
    if (!html || typeof html !== 'string') return null

    const $ = cheerio.load(html)
    const candidates = []

    // Common "next" link patterns
    const relNext = $('a[rel="next"][href*="/pd/"]').attr('href')
    const relNextAsin = this.extractAsinFromHref(relNext)
    if (relNextAsin) candidates.push(relNextAsin)

    // Look for explicit "Next in series" section
    $('*').each((_, el) => {
      const text = $(el).text()
      if (text && /next in series/i.test(text)) {
        const link = $(el).find('a[href*="/pd/"]').first().attr('href')
        const asin = this.extractAsinFromHref(link)
        if (asin) candidates.push(asin)
      }
    })

    // Fallback: take the first /pd/ link that is not the current ASIN
    $('a[href*="/pd/"]').each((_, el) => {
      const asin = this.extractAsinFromHref($(el).attr('href'))
      if (asin) candidates.push(asin)
    })

    const unique = Array.from(new Set(candidates))
    const upperCurrent = String(currentAsin).toUpperCase()
    const nextAsin = unique.find((asin) => asin !== upperCurrent) || null
    if (!nextAsin) {
      this.logWarn('[Audble] No next-in-series ASIN found on page')
    }
    return nextAsin
  }

  parseSeriesSequence(text) {
    if (!text || typeof text !== 'string') return null
    const match = text.match(/(?:Book|#|bk)\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)/)
    if (!match) return null
    const value = Number(match[1])
    return Number.isFinite(value) ? value : null
  }

  /**
   * Get series metadata from the last scrape
   */
  getSeriesMetadata() {
    return this.seriesMetadata || { title: null, description: null }
  }

  /**
   * Scrape Audible series page with full pagination support
   */
  async scrapeAudibleSeriesPage(seriesAsin, timeout = 30000) {
    if (!seriesAsin) return []

    let allEntries = []
    let page = 1
    let hasMorePages = true
    const maxPages = 20 // Safety limit to prevent infinite loops
    const pageSize = 30

    // Reduce verbosity for series scraping.

    let totalPages = null

    while (hasMorePages && page <= maxPages) {
      try {
        // Construct URL with pagination parameter
        const url =
          page === 1
            ? `https://www.audible.com/series/${encodeURIComponent(seriesAsin)}?pageSize=${pageSize}`
            : `https://www.audible.com/series/${encodeURIComponent(seriesAsin)}?page=${page}&pageSize=${pageSize}`

        // Page-level logging suppressed to reduce noise.

        const response = await this.makeAudibleRequest(url, { timeout })
        const html = response?.data
        if (!html || typeof html !== 'string') {
          this.logWarn(`[Audble] No HTML returned for page ${page}`)
          break
        }

        const $ = cheerio.load(html)
        const pageEntries = []

        const addEntry = (asin, title, sequence) => {
          if (!asin) return
          pageEntries.push({
            asin,
            title: title || null,
            sequence: sequence ?? null
          })
        }

        // Look for book elements with data-asin attributes
        $('[data-asin], [data-product-id]').each((_, el) => {
          const asin = ($(el).attr('data-asin') || $(el).attr('data-product-id') || '').toUpperCase()
          if (!asin) return
          const text = $(el).text() || ''
          const sequence = this.parseSeriesSequence(text)
          const title = $(el).find('a').first().text().trim() || $(el).find('img').attr('alt') || null
          addEntry(asin, title, sequence)
        })

        // Also look for links to book pages
        $('a[href*="/pd/"]').each((_, el) => {
          const asin = this.extractAsinFromHref($(el).attr('href'))
          if (!asin) return
          const card = $(el).closest('li, div.bc-list-item, div.productListItem')
          const text = card.text() || ''
          const sequence = this.parseSeriesSequence(text)
          const title = $(el).text().trim() || card.find('img').attr('alt') || null
          addEntry(asin, title, sequence)
        })

        // Check for series description and metadata on first page
        if (page === 1) {
          const seriesTitle = $('h1.bc-heading').first().text().trim() || $('meta[property="og:title"]').attr('content') || null
          const seriesDescription = $('meta[name="description"]').attr('content') || $('.bc-section--description').text().trim() || null

          this.seriesMetadata = {
            title: seriesTitle,
            description: seriesDescription
          }

          const pageNumbers = $('.pageNumberElement')
            .map((_, el) => parseInt($(el).text().trim(), 10))
            .get()
            .filter((num) => Number.isFinite(num))
          if (pageNumbers.length) {
            totalPages = Math.max(...pageNumbers)
            // Pagination discovery logged via debug response if needed.
          }
        }

        // Check if we found any entries on this page
        if (pageEntries.length === 0) {
          // No entries found; stop pagination.
          hasMorePages = false
          break
        }

        // Add entries to our collection
        allEntries = [...allEntries, ...pageEntries]
        // Per-page entry logging suppressed.

        // Check for "next page" indicators
        const nextButton = $('.nextButton a, .pagination-next a, a[aria-label="Next"]').first()
        const hasNext = nextButton.length > 0 && !nextButton.closest('.bc-button-disabled').length && !nextButton.attr('aria-disabled')

        if (totalPages !== null) {
          hasMorePages = page < totalPages
        } else {
          hasMorePages = hasNext && pageEntries.length > 0
        }

        page++

        // Add a small delay between pages to be respectful
        if (hasMorePages) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        this.logWarn(`[Audble] Error scraping page ${page}: ${error.message}`)
        hasMorePages = false
      }
    }

    // Remove duplicates by ASIN (keep the one with the most complete data)
    const uniqueEntries = new Map()
    for (const entry of allEntries) {
      if (!uniqueEntries.has(entry.asin)) {
        uniqueEntries.set(entry.asin, entry)
      } else {
        // If we already have this ASIN, prefer the one with a title
        const existing = uniqueEntries.get(entry.asin)
        if (!existing.title && entry.title) {
          uniqueEntries.set(entry.asin, entry)
        }
      }
    }

    const finalEntries = Array.from(uniqueEntries.values())

    // Sort by sequence if available
    finalEntries.sort((a, b) => {
      if (a.sequence && b.sequence) return a.sequence - b.sequence
      return 0
    })

    // Summary log suppressed to reduce noise.

    return finalEntries
  }

  async scrapeAudiblePage(asin, timeout = 30000) {
    if (!asin) return null
    const url = `https://www.audible.com/pd/${encodeURIComponent(asin)}`
    // Keep logs minimal; rely on warnings/errors.

    try {
      const response = await this.makeAudibleRequest(url, { timeout })
      const html = response?.data
      if (!html || typeof html !== 'string') return null

      const $ = cheerio.load(html)
      let metadata = null

      const ldJsonScripts = $('script[type="application/ld+json"]')
        .toArray()
        .map((el) => $(el).html())
        .filter(Boolean)
      for (const scriptText of ldJsonScripts) {
        try {
          const parsed = JSON.parse(scriptText)
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed)) {
              const product = parsed.find((obj) => obj && obj['@type'] && obj['@type'].toLowerCase().includes('product'))
              if (product) {
                metadata = product
                break
              }
            } else if (parsed['@type'] && parsed['@type'].toLowerCase().includes('product')) {
              metadata = parsed
              break
            } else if (parsed['@type'] && parsed['@type'].toLowerCase().includes('audiobook')) {
              metadata = parsed
              break
            }
          }
        } catch (parseErr) {
          this.logWarn('[Audble] Failed to parse ld+json metadata', parseErr)
        }
      }

      const appJsonScripts = $('script[type="application/json"]')
        .toArray()
        .map((el) => $(el).html())
        .filter(Boolean)
      for (const scriptText of appJsonScripts) {
        try {
          const parsed = JSON.parse(scriptText)
          if (parsed && typeof parsed === 'object') {
            if (!metadata && (parsed.duration || parsed.releaseDate || parsed.series)) {
              metadata = parsed
              break
            }
            if (!metadata && parsed.product && Array.isArray(parsed.product) && parsed.product[0]?.productInfo) {
              metadata = {
                name: parsed.product[0].productInfo.productName,
                asin: parsed.product[0].productInfo.productID,
                publisher: { name: parsed.product[0].productInfo.publisherName },
                language: parsed.product[0].productInfo.language,
                duration: parsed.product[0].productInfo.duration,
                releaseDate: parsed.product[0].productInfo.releaseDate
              }
              break
            }
            if (metadata && (parsed.duration || parsed.releaseDate || parsed.series || parsed.publisher || parsed.language || parsed.categories)) {
              metadata.duration = metadata.duration || parsed.duration
              metadata.datePublished = metadata.datePublished || parsed.releaseDate
              metadata.releaseDate = metadata.releaseDate || parsed.releaseDate
              metadata.series = metadata.series || parsed.series
              metadata.publisher = metadata.publisher || parsed.publisher
              metadata.language = metadata.language || parsed.language
              metadata.categories = metadata.categories || parsed.categories
            }
          }
        } catch (parseErr) {
          // not JSON, skip
        }
      }

      if (!metadata) {
        const canonicalAsinMatch = html.match(/"asin"\s*:\s*"([A-Z0-9]{10})"/i)
        if (!canonicalAsinMatch) return null
        metadata = {
          name: $('meta[property="og:title"]').attr('content') || $('title').text().trim() || 'Unknown',
          description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || null,
          image: $('meta[property="og:image"]').attr('content') || $('img[class*="cover"]')?.attr('src') || null,
          datePublished: $('meta[itemprop="datePublished"]').attr('content') || null,
          publisher: { name: $('a[data-ga="publisher"]')?.text() || $('li[data-testid="publisher"]')?.text() || null },
          author: [{ name: $('a[data-ga="author"]')?.text() || $('li[data-testid="author"]')?.text() || '' }],
          duration: $('meta[itemprop="duration"]').attr('content') || null,
          asin: canonicalAsinMatch[1]
        }
      }

      const title = metadata.name || metadata.title || $('h1').first().text().trim() || null
      const summary = metadata.description || metadata.summary || $('meta[property="og:description"]').attr('content') || null
      const image = metadata.image || metadata.thumbnailUrl || $('meta[property="og:image"]').attr('content') || null
      let releaseDate = metadata.datePublished || metadata.releaseDate || null
      if (releaseDate && /^\d{2}-\d{2}-\d{2}$/.test(releaseDate)) {
        const [m, d, y] = releaseDate.split('-').map(Number)
        releaseDate = `20${y.toString().padStart(2, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
      }
      if (!releaseDate) {
        const bodyText = $('body').text().replace(/\s+/g, ' ')
        const dateMatch = bodyText.match(/Release date:\s*([0-9]{2}[\/-][0-9]{2}[\/-][0-9]{2,4})/i)
        if (dateMatch && dateMatch[1]) {
          const parts = dateMatch[1].split(/[\/-]/).map((val) => val.trim())
          if (parts.length === 3) {
            const [m, d, y] = parts.map((v) => Number(v))
            if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
              const fullYear = y < 100 ? 2000 + y : y
              releaseDate = `${fullYear.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
            }
          }
        }
      }

      let language = metadata.inLanguage || metadata.language || $('adbl-toggle-chip[selected]').text().trim() || metadata.language
      if (typeof language === 'string') language = language.split(',')[0]

      const seriesPrimaryData = metadata.series ? (Array.isArray(metadata.series) ? metadata.series[0] : metadata.series) : null
      let seriesPrimary = null
      if (seriesPrimaryData) {
        const seriesName = seriesPrimaryData.name || seriesPrimaryData.series || null
        let sequence = null
        if (seriesPrimaryData.part) sequence = seriesPrimaryData.part.replace(/Book\s*/i, '').trim()
        if (!sequence && seriesPrimaryData.position) sequence = seriesPrimaryData.position
        if (!sequence && typeof seriesPrimaryData.sequence === 'string') sequence = seriesPrimaryData.sequence
        seriesPrimary = {
          name: seriesName || null,
          position: sequence || null
        }
      }

      const authors = []
      if (metadata.author) {
        if (Array.isArray(metadata.author)) {
          metadata.author.forEach((author) => {
            if (typeof author === 'string') authors.push(author)
            else if (author?.name) authors.push(author.name)
          })
        } else if (typeof metadata.author === 'string') {
          authors.push(metadata.author)
        } else if (metadata.author?.name) {
          authors.push(metadata.author.name)
        }
      }
      if (!authors.length) {
        const byline = $('a[data-ga="author"]').first().text().trim() || $('li[data-testid="author"]').first().text().trim()
        if (byline) authors.push(byline)
      }

      const narrators = []
      if (metadata.performer) {
        if (Array.isArray(metadata.performer)) {
          metadata.performer.forEach((performer) => {
            if (typeof performer === 'string') narrators.push(performer)
            else if (performer?.name) narrators.push(performer.name)
          })
        } else if (typeof metadata.performer === 'string') {
          narrators.push(metadata.performer)
        } else if (metadata.performer?.name) {
          narrators.push(metadata.performer.name)
        }
      }

      const publisherName = metadata.publisher?.name || metadata.publisher || $('a[data-ga="publisher"]').text().trim() || null

      const runtimeLengthMin = this.parseDurationToMinutes(metadata.duration || metadata.timeRequired || metadata.audioDuration || null)

      return {
        title,
        subtitle: metadata.subtitle || null,
        asin: asin.toUpperCase(),
        authors: authors.length ? authors.map((name) => ({ name })) : null,
        narrators: narrators.length ? narrators.map((name) => ({ name })) : null,
        publisherName,
        summary,
        releaseDate,
        image,
        genres: [],
        seriesPrimary,
        seriesSecondary: null,
        language,
        runtimeLengthMin,
        formatType: 'audiobook'
      }
    } catch (error) {
      this.logWarn(`[Audble] Failed to scrape Audible page: ${error.message}`)
      throw error
    }
  }

  async asinSearch(asin, region, timeout) {
    if (!asin) return null

    try {
      // Reduce verbose ASIN search logging.

      const result = await super.asinSearch(asin, region, timeout)

      if (result && typeof result === 'object') {
        const rawDate = result.releaseDate || result.datePublished
        const yearOnly = typeof rawDate === 'string' && /^\d{4}$/.test(rawDate.trim())
        if (!rawDate || yearOnly) {
          try {
            const scraped = await this.scrapeAudiblePage(asin, timeout)
            if (scraped?.releaseDate && (!rawDate || yearOnly)) {
              result.releaseDate = scraped.releaseDate
            }
          } catch (scrapeErr) {
            this.logWarn('[Audble] Audible page scrape for release date failed', scrapeErr)
          }
        }
      }
      return result
    } catch (error) {
      const extractedAsin = this.extractAsinFromError(error)
      const scrapeAsin = extractedAsin || asin
      if (extractedAsin) {
        global.upcomingBookASIN = extractedAsin
        this.logWarn(`[Audble] Extracted upcoming ASIN ${extractedAsin} from error`)
      }

      // Fallback to scraping audible.com/pd/${scrapeAsin} for future releases.
      try {
        const scraped = await this.scrapeAudiblePage(scrapeAsin, timeout)
        if (scraped) {
          global.upcomingBookASIN = scrapeAsin.toUpperCase()
          // Successful scrape; no log to reduce noise.
          return scraped
        }
      } catch (scrapeErr) {
        this.logWarn('[Audble] Audible page scrape fallback failed', scrapeErr)
      }

      throw error
    }
  }

  async getBookDetails(asin, region) {
    // Reduce verbose logging for book details.

    try {
      const result = await super.getBookDetails(asin, region)
      return result
    } catch (error) {
      this.logWarn(`[Audble] getBookDetails failed: ${error.message}`)
      throw error
    }
  }
}

module.exports = Audble
