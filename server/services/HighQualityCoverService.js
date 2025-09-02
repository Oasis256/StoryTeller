const Logger = require('../Logger')
const AudiobookCovers = require('../providers/AudiobookCovers')
const GoogleBooks = require('../providers/GoogleBooks')

/**
 * Service to find high-quality cover images from multiple sources
 */
class HighQualityCoverService {
  constructor() {
    this.audiobookCovers = new AudiobookCovers()
    this.googleBooks = new GoogleBooks()
  }

  /**
   * Find the highest quality cover image for a book
   * @param {Object} bookData - Book data with title, author, etc.
   * @returns {Promise<Object>} - Enhanced book data with high-quality cover
   */
  async enhanceCoverQuality(bookData) {
    try {
      const { title, author } = bookData
      
      if (!title || !author) {
        Logger.debug('[HighQualityCoverService] Missing title or author, cannot enhance cover')
        return bookData
      }

      Logger.info(`[HighQualityCoverService] Searching for high-quality cover for "${title}" by ${author}`)
      
      // Try different sources in order of quality preference
      const coverSources = {
        ...bookData.coverSources || {},
        openLibrary: await this.getOpenLibraryCover(title, author),
        publisher: await this.getPublisherCover(title, author, bookData.asin),
        audiobookCovers: await this.getAudiobookCoversCover(title, author),
        googleBooks: await this.getGoogleBooksCover(title, author),
        upscaled: await this.getUpscaledCover(bookData.cover, title, author),
      }

      // Debug log all sources
      Logger.debug(`[HighQualityCoverService] Cover sources found:`, JSON.stringify(coverSources, null, 2))
      
      // Select the best available cover
      const bestCover = this.selectBestCover(coverSources)
      
      const result = {
        ...bookData,
        cover: bestCover.url || bookData.cover,
        coverSources,
        coverQuality: bestCover.quality
      }

      if (bestCover.url && bestCover.url !== bookData.cover) {
        Logger.info(`[HighQualityCoverService] Enhanced cover quality: ${bestCover.quality} (${bestCover.source})`)
      } else {
        Logger.info(`[HighQualityCoverService] No better cover found, using original: ${bookData.cover}`)
      }

      return result

    } catch (error) {
      Logger.error('[HighQualityCoverService] Failed to enhance cover quality:', error)
      return bookData
    }
  }

  /**
   * Get cover from AudiobookCovers.com (usually high quality)
   */
  async getAudiobookCoversCover(title, author) {
    try {
      const searchTerm = `${title} ${author}`
      const results = await this.audiobookCovers.search(searchTerm, 10000)
      
      if (results && results.length > 0) {
        const cover = results[0].cover
        Logger.debug(`[HighQualityCoverService] Found AudiobookCovers cover: ${cover}`)
        return cover
      }
    } catch (error) {
      Logger.debug(`[HighQualityCoverService] AudiobookCovers search failed: ${error.message}`)
    }
    
    return null
  }

  /**
   * Get cover from Google Books (often 2400x2400 or higher)
   */
  async getGoogleBooksCover(title, author) {
    try {
      const results = await this.googleBooks.search(title, author, 10000)
      
      if (results && results.length > 0) {
        // Google Books often has extraLarge covers
        for (const result of results.slice(0, 3)) { // Check first 3 results
          if (result.cover) {
            // Try to get the largest version
            let cover = result.cover
            
            // Google Books URL patterns for larger images
            cover = cover.replace(/&zoom=\d+/, '&zoom=0') // Remove zoom limit
            cover = cover.replace(/&edge=curl/, '') // Remove curl effect
            
            Logger.debug(`[HighQualityCoverService] Found Google Books cover: ${cover}`)
            return cover
          }
        }
      }
    } catch (error) {
      Logger.debug(`[HighQualityCoverService] Google Books search failed: ${error.message}`)
    }
    
    return null
  }

  /**
   * Search publisher websites and direct sources for high-res covers
   */
  async getPublisherCover(title, author, asin) {
    try {
      const axios = require('axios')
      
      // Try Open Library first (often has 2400x2400+ covers)
      const openLibraryCover = await this.getOpenLibraryCover(title, author)
      if (openLibraryCover) return openLibraryCover

      // Common publisher patterns for high-resolution covers
      if (asin) {
        const publisherSources = [
          `https://images.randomhouse.com/cover/${asin}`, // Random House
          `https://images.macmillan.com/folio-assets/covers/${asin}.jpg`, // Macmillan
          `https://images.harpercollins.com/harperimages/isbn/large/${asin}.jpg`, // HarperCollins
        ]

        for (const publisherUrl of publisherSources) {
          try {
            const response = await axios.head(publisherUrl, { timeout: 5000 })
            if (response.status === 200) {
              // Check content length to ensure it's a real image (> 10KB)
              const contentLength = parseInt(response.headers['content-length'] || '0')
              if (contentLength > 10000) {
                Logger.debug(`[HighQualityCoverService] Found publisher cover: ${publisherUrl} (${Math.round(contentLength/1024)}KB)`)
                return publisherUrl
              } else {
                Logger.debug(`[HighQualityCoverService] Publisher cover too small: ${publisherUrl} (${contentLength} bytes)`)
              }
            }
          } catch (error) {
            // Continue to next source
          }
        }
      }

    } catch (error) {
      Logger.debug(`[HighQualityCoverService] Publisher search failed: ${error.message}`)
    }
    
    return null
  }

  /**
   * Get high-res cover from Open Library (often 2400x2400+)
   */
  async getOpenLibraryCover(title, author) {
    try {
      const axios = require('axios')
      const searchUrl = `https://openlibrary.org/search.json`
      const params = {
        title: title,
        author: author,
        limit: 5
      }

      const response = await axios.get(searchUrl, { params, timeout: 10000 })
      const books = response.data?.docs || []

      for (const book of books) {
        if (book.cover_i) {
          // Open Library provides covers in different sizes, -L is largest (often 2400x2400+)
          const coverUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
          Logger.debug(`[HighQualityCoverService] Found Open Library cover: ${coverUrl}`)
          return coverUrl
        }
      }
    } catch (error) {
      Logger.debug(`[HighQualityCoverService] Open Library search failed: ${error.message}`)
    }
    
    return null
  }

  /**
   * Get AI upscaled version of existing cover (2400x2400)
   */
  async getUpscaledCover(originalUrl, title, author) {
    if (!originalUrl) return null

    try {
      // Option 1: Use AI upscaling service (e.g., Real-ESRGAN, waifu2x)
      // This would require implementing or using an external service
      
      // Option 2: Use local upscaling if sharp is available
      const upscaledUrl = await this.upscaleImageLocally(originalUrl, title, author)
      if (upscaledUrl) return upscaledUrl

      // Option 3: Use online upscaling service
      const serviceUrl = await this.upscaleImageWithService(originalUrl)
      if (serviceUrl) return serviceUrl

    } catch (error) {
      Logger.debug(`[HighQualityCoverService] Upscaling failed: ${error.message}`)
    }
    
    return null
  }

  /**
   * Upscale image locally using Sharp (if available)
   */
  async upscaleImageLocally(originalUrl, title, author) {
    try {
      // Check if sharp is available
      let sharp
      try {
        sharp = require('sharp')
      } catch (error) {
        Logger.debug('[HighQualityCoverService] Sharp not available for local upscaling')
        return null
      }

      const axios = require('axios')
      const path = require('path')
      const fs = require('fs').promises
      
      // Download original image
      const response = await axios.get(originalUrl, { responseType: 'arraybuffer', timeout: 10000 })
      const imageBuffer = Buffer.from(response.data)
      
      // Upscale to 2400x2400 using Sharp's lanczos resampling
      const upscaledBuffer = await sharp(imageBuffer)
        .resize(2400, 2400, {
          fit: 'cover',
          kernel: sharp.kernel.lanczos3
        })
        .jpeg({ quality: 95 })
        .toBuffer()

      // Save to local cache directory
      const cacheDir = '/metadata/cache/covers-upscaled'
      await fs.mkdir(cacheDir, { recursive: true })
      
      const fileName = `${title}_${author}`.replace(/[^a-zA-Z0-9]/g, '_') + '_2400x2400.jpg'
      const filePath = path.join(cacheDir, fileName)
      
      await fs.writeFile(filePath, upscaledBuffer)
      
      Logger.info(`[HighQualityCoverService] Created 2400x2400 upscaled cover: ${filePath}`)
      return `file://${filePath}`

    } catch (error) {
      Logger.debug(`[HighQualityCoverService] Local upscaling failed: ${error.message}`)
      return null
    }
  }

  /**
   * Upscale image using external service
   */
  async upscaleImageWithService(originalUrl) {
    // This could integrate with services like:
    // - Real-ESRGAN API
    // - waifu2x
    // - Topaz Gigapixel AI API
    // - Other AI upscaling services
    
    Logger.debug('[HighQualityCoverService] External upscaling services not implemented')
    return null
  }

  /**
   * Select the best cover from available sources
   */
  selectBestCover(coverSources) {
    // Priority order: Open Library > Publisher > Upscaled > AudiobookCovers > Google Books > Audible
    const priorities = [
      { key: 'openLibrary', quality: 'very_high', source: 'Open Library' },
      { key: 'publisher', quality: 'very_high', source: 'Publisher' },
      { key: 'upscaled', quality: 'high', source: 'AI Upscaled' },
      { key: 'audiobookCovers', quality: 'high', source: 'AudiobookCovers' },
      { key: 'googleBooks', quality: 'high', source: 'Google Books' },
      { key: 'audible', quality: 'medium', source: 'Audible' }
    ]

    for (const priority of priorities) {
      const url = coverSources[priority.key]
      if (url && this.isValidImageUrl(url)) {
        return {
          url,
          quality: priority.quality,
          source: priority.source
        }
      }
    }

    return { url: null, quality: 'none', source: 'none' }
  }

  /**
   * Validate image URL
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false
    
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get image dimensions (if possible)
   */
  async getImageDimensions(url) {
    // This would require image processing library like sharp or jimp
    // For now, return estimated dimensions based on URL patterns
    
    if (url.includes('_SL1500_')) return { width: 1500, height: 1500 }
    if (url.includes('_SL1200_')) return { width: 1200, height: 1200 }
    if (url.includes('_SL1000_')) return { width: 1000, height: 1000 }
    if (url.includes('_SL800_')) return { width: 800, height: 800 }
    if (url.includes('_SL600_')) return { width: 600, height: 600 }
    if (url.includes('_SL500_')) return { width: 500, height: 500 }
    
    // AudiobookCovers and Google Books often provide larger images
    if (url.includes('audiobookcovers.com')) return { width: 1000, height: 1000, estimated: true }
    if (url.includes('googleapis.com')) return { width: 800, height: 800, estimated: true }
    
    return { width: 300, height: 300, estimated: true }
  }
}

module.exports = HighQualityCoverService