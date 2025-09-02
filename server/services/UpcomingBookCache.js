const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const Logger = require('../Logger')
const https = require('https')
const http = require('http')

/**
 * Enhanced upcoming book cache with comprehensive data storage
 * Two-layer caching: Memory (fast) + File (persistent)
 * Caches ALL book details: name, series, cover, release date, author, description, ASIN/ISBN, and additional metadata
 */
class UpcomingBookCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'metadata', 'cache', 'upcoming-v5')
    this.memoryCacheSize = options.memoryCacheSize || 100
    this.defaultTTL = options.defaultTTL || {
      memory: 30 * 60 * 1000, // 30 minutes
      file: 6 * 60 * 60 * 1000 // 6 hours
    }

    this.memoryCache = new Map()
    this.memoryCacheOrder = []
    this.stats = {
      memoryHits: 0,
      memoryMisses: 0,
      fileHits: 0,
      fileMisses: 0,
      writes: 0,
      deletes: 0,
      errors: 0,
      lastReset: Date.now()
    }

    this.initialize()
  }

  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      await fs.mkdir(path.join(this.cacheDir, 'books'), { recursive: true })
      await fs.mkdir(path.join(this.cacheDir, 'covers'), { recursive: true })
      Logger.info(`[UpcomingBookCache] Two-layer cache initialized at: ${this.cacheDir}`)
    } catch (error) {
      Logger.error('[UpcomingBookCache] Initialization failed:', error)
      throw error
    }
  }

  async get(key) {
    try {
      // Layer 1: Memory cache (fastest)
      const memoryResult = this.getFromMemory(key)
      if (memoryResult) {
        this.stats.memoryHits++
        return memoryResult
      }
      this.stats.memoryMisses++

      // Layer 2: File cache (persistent)
      const fileResult = await this.getFromFile(key)
      if (fileResult) {
        this.stats.fileHits++
        // Promote to memory cache for faster future access
        this.setInMemory(key, fileResult)
        return fileResult
      }
      this.stats.fileMisses++

      return null
    } catch (error) {
      this.stats.errors++
      Logger.error('[UpcomingBookCache] Get operation failed:', error)
      return null
    }
  }

  async set(key, data, options = {}) {
    try {
      const ttl = options.ttl || this.defaultTTL
      const enrichedData = this.enrichCacheData(data, ttl)

      // Store in both layers
      this.setInMemory(key, enrichedData)
      await this.setInFile(key, enrichedData)

      this.stats.writes++
      Logger.debug(`[UpcomingBookCache] Cached data in both layers: ${key}`)
      return true
    } catch (error) {
      this.stats.errors++
      Logger.error('[UpcomingBookCache] Set operation failed:', error)
      return false
    }
  }

  enrichCacheData(data, ttl) {
    return {
      data: data,
      metadata: {
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttl.file,
        version: '2.0',
        comprehensive: true,
        dataTypes: this.extractDataTypes(data)
      },
      statistics: {
        size: JSON.stringify(data).length,
        hasCover: !!data.cover,
        hasSeries: !!(data.series && data.series.length > 0),
        hasDescription: !!data.description,
        hasReleaseDate: !!data.releaseDate
      }
    }
  }

  extractDataTypes(data) {
    const types = []
    if (data.title) types.push('title')
    if (data.author) types.push('author')
    if (data.asin) types.push('asin')
    if (data.isbn) types.push('isbn')
    if (data.cover) types.push('cover')
    if (data.description) types.push('description')
    if (data.releaseDate) types.push('releaseDate')
    if (data.series) types.push('series')
    if (data.narrator) types.push('narrator')
    if (data.publisher) types.push('publisher')
    if (data.duration) types.push('duration')
    if (data.language) types.push('language')
    if (data.genres) types.push('genres')
    if (data.tags) types.push('tags')
    if (data.rating) types.push('rating')
    if (data.abridged !== undefined) types.push('abridged')
    return types
  }

  getFromMemory(key) {
    const cached = this.memoryCache.get(key)
    if (!cached) return null

    if (Date.now() > cached.metadata.expiresAt) {
      this.memoryCache.delete(key)
      this.removeFromMemoryOrder(key)
      return null
    }

    return cached
  }

  setInMemory(key, data) {
    if (this.memoryCache.has(key)) {
      this.removeFromMemoryOrder(key)
    }

    this.memoryCache.set(key, data)
    this.memoryCacheOrder.push(key)

    if (this.memoryCacheOrder.length > this.memoryCacheSize) {
      const oldestKey = this.memoryCacheOrder.shift()
      this.memoryCache.delete(oldestKey)
    }
  }

  removeFromMemoryOrder(key) {
    const index = this.memoryCacheOrder.indexOf(key)
    if (index > -1) {
      this.memoryCacheOrder.splice(index, 1)
    }
  }

  async getFromFile(key) {
    try {
      const filePath = this.getFilePath(key)
      const fileContent = await fs.readFile(filePath, 'utf8')
      const cached = JSON.parse(fileContent)

      if (Date.now() > cached.metadata.expiresAt) {
        await this.deleteFile(key)
        return null
      }

      return cached
    } catch (error) {
      if (error.code !== 'ENOENT') {
        Logger.debug(`[UpcomingBookCache] File read error for ${key}: ${error.message}`)
      }
      return null
    }
  }

  async setInFile(key, data) {
    try {
      const filePath = this.getFilePath(key)
      const tempPath = `${filePath}.tmp`
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2))
      await fs.rename(tempPath, filePath)
    } catch (error) {
      Logger.error(`[UpcomingBookCache] File write failed for ${key}:`, error)
      throw error
    }
  }

  getFilePath(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex')
    return path.join(this.cacheDir, 'books', `${hash}.json`)
  }

  async deleteFile(key) {
    try {
      const filePath = this.getFilePath(key)
      await fs.unlink(filePath)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        Logger.debug(`[UpcomingBookCache] File deletion failed for ${key}: ${error.message}`)
      }
    }
  }

  async delete(key) {
    try {
      this.memoryCache.delete(key)
      this.removeFromMemoryOrder(key)
      await this.deleteFile(key)
      this.stats.deletes++
      return true
    } catch (error) {
      this.stats.errors++
      Logger.error(`[UpcomingBookCache] Delete failed for ${key}:`, error)
      return false
    }
  }

  async clear() {
    try {
      this.memoryCache.clear()
      this.memoryCacheOrder = []

      const booksDir = path.join(this.cacheDir, 'books')
      const files = await fs.readdir(booksDir)

      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(booksDir, file))
        }
      }

      this.stats = {
        memoryHits: 0,
        memoryMisses: 0,
        fileHits: 0,
        fileMisses: 0,
        writes: 0,
        deletes: 0,
        errors: 0,
        lastReset: Date.now()
      }

      Logger.info('[UpcomingBookCache] All caches cleared')
      return true
    } catch (error) {
      Logger.error('[UpcomingBookCache] Clear failed:', error)
      return false
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    try {
      // Clear memory cache
      this.memoryCache.clear()
      this.memoryCacheOrder = []

      // Clear file cache
      if (this.cacheDir) {
        await fs.rm(this.cacheDir, { recursive: true, force: true })
        await fs.mkdir(this.cacheDir, { recursive: true })
        await fs.mkdir(path.join(this.cacheDir, 'books'), { recursive: true })
        await fs.mkdir(path.join(this.cacheDir, 'covers'), { recursive: true })
      }

      Logger.info('[UpcomingBookCache] Cache cleared successfully')
      return true
    } catch (error) {
      Logger.error('[UpcomingBookCache] Failed to clear cache:', error)
      return false
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const booksDir = path.join(this.cacheDir, 'books')
      let fileCount = 0
      let totalSize = 0

      try {
        const files = await fs.readdir(booksDir)
        fileCount = files.filter((f) => f.endsWith('.json')).length

        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(booksDir, file)
            const stats = await fs.stat(filePath)
            totalSize += stats.size
          }
        }
      } catch (error) {
        // Directory might not exist yet
      }

      const memoryUsage = this.memoryCacheOrder.length
      const memorySize = JSON.stringify(Array.from(this.memoryCache.entries())).length

      return {
        memory: {
          entries: memoryUsage,
          maxEntries: this.memoryCacheSize,
          size: memorySize,
          hits: this.stats.memoryHits,
          misses: this.stats.memoryMisses,
          hitRate: this.stats.memoryHits + this.stats.memoryMisses > 0 ? ((this.stats.memoryHits / (this.stats.memoryHits + this.stats.memoryMisses)) * 100).toFixed(2) + '%' : '0%'
        },
        file: {
          entries: fileCount,
          size: totalSize,
          hits: this.stats.fileHits,
          misses: this.stats.fileMisses,
          hitRate: this.stats.fileHits + this.stats.fileMisses > 0 ? ((this.stats.fileHits / (this.stats.fileHits + this.stats.fileMisses)) * 100).toFixed(2) + '%' : '0%'
        },
        operations: {
          writes: this.stats.writes,
          deletes: this.stats.deletes,
          errors: this.stats.errors
        },
        cacheDir: this.cacheDir,
        uptime: Date.now() - this.stats.lastReset,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      Logger.error('[UpcomingBookCache] Stats calculation failed:', error)
      return { error: error.message }
    }
  }

  async performMaintenance() {
    try {
      let cleanedCount = 0
      let errorCount = 0

      // Clean expired memory entries
      const memoryKeys = Array.from(this.memoryCache.keys())
      for (const key of memoryKeys) {
        const cached = this.memoryCache.get(key)
        if (cached && Date.now() > cached.metadata.expiresAt) {
          this.memoryCache.delete(key)
          this.removeFromMemoryOrder(key)
          cleanedCount++
        }
      }

      // Clean expired file entries
      const booksDir = path.join(this.cacheDir, 'books')
      try {
        const files = await fs.readdir(booksDir)

        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(booksDir, file)
              const fileContent = await fs.readFile(filePath, 'utf8')
              const cached = JSON.parse(fileContent)

              if (Date.now() > cached.metadata.expiresAt) {
                await fs.unlink(filePath)
                cleanedCount++
              }
            } catch (error) {
              errorCount++
            }
          }
        }
      } catch (error) {
        // Directory might not exist
      }

      Logger.info(`[UpcomingBookCache] Maintenance completed: ${cleanedCount} cleaned, ${errorCount} errors`)
      return { cleaned: cleanedCount, errors: errorCount }
    } catch (error) {
      Logger.error('[UpcomingBookCache] Maintenance failed:', error)
      return { error: error.message }
    }
  }

  async cleanup() {
    try {
      Logger.info('[UpcomingBookCache] Cleanup completed')
    } catch (error) {
      Logger.error('[UpcomingBookCache] Cleanup failed:', error)
    }
  }

  /**
   * Cache cover image from URL
   */
  async cacheCover(coverUrl, seriesName, authorName) {
    try {
      if (!coverUrl) return null

      const coverKey = this.buildCoverKey(seriesName, authorName)
      const coverPath = path.join(this.cacheDir, 'covers', `${coverKey}.jpg`)

      // Check if already cached
      try {
        await fs.access(coverPath)
        Logger.debug(`[UpcomingBookCache] Cover already cached: ${coverKey}`)
        return coverKey
      } catch {
        // File doesn't exist, download it
      }

      Logger.info(`[UpcomingBookCache] Downloading cover: ${coverUrl}`)

      const imageBuffer = await this.downloadImage(coverUrl)
      if (imageBuffer) {
        await fs.writeFile(coverPath, imageBuffer)
        Logger.info(`[UpcomingBookCache] Cover cached: ${coverKey}`)
        return coverKey
      }

      return null
    } catch (error) {
      Logger.error('[UpcomingBookCache] Cover caching failed:', error)
      return null
    }
  }

  /**
   * Get cached cover path
   */
  async getCoverPath(seriesName, authorName) {
    try {
      const coverKey = this.buildCoverKey(seriesName, authorName)
      const coverPath = path.join(this.cacheDir, 'covers', `${coverKey}.jpg`)

      // Check if file exists
      await fs.access(coverPath)
      return coverPath
    } catch {
      return null
    }
  }

  /**
   * Build cover key from series and author
   */
  buildCoverKey(seriesName, authorName) {
    const normalizedSeries = seriesName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const normalizedAuthor = authorName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    return `${normalizedSeries}_${normalizedAuthor}`
  }

  /**
   * Download image from URL
   */
  async downloadImage(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http

      const request = protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const buffer = Buffer.concat(chunks)
          resolve(buffer)
        })
      })

      request.on('error', reject)
      request.setTimeout(10000, () => {
        request.destroy()
        reject(new Error('Download timeout'))
      })
    })
  }
}

module.exports = UpcomingBookCache


