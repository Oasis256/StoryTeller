const Logger = require('../Logger')
const Database = require('../Database')

/**
 * Enhanced user preferences system for upcoming book discovery
 * - Favorite authors tracking
 * - Series watchlists
 * - Notification preferences
 * - Discovery frequency settings
 * - Personalized recommendations
 */
class UpcomingBookUserPreferences {
  constructor() {
    this.preferencesCache = new Map()
    this.cacheExpiry = 30 * 60 * 1000 // 30 minutes
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId) {
    try {
      // Check cache first
      const cached = this.preferencesCache.get(userId)
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data
      }

      // Load from database
      const preferences = await this.loadPreferencesFromDatabase(userId)

      // Cache the result
      this.preferencesCache.set(userId, {
        data: preferences,
        timestamp: Date.now()
      })

      return preferences
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to get user preferences:', error)
      return this.getDefaultPreferences()
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId, updates) {
    try {
      const currentPreferences = await this.getUserPreferences(userId)
      const updatedPreferences = { ...currentPreferences, ...updates }

      // Validate preferences
      const validatedPreferences = this.validatePreferences(updatedPreferences)

      // Save to database
      await this.savePreferencesToDatabase(userId, validatedPreferences)

      // Update cache
      this.preferencesCache.set(userId, {
        data: validatedPreferences,
        timestamp: Date.now()
      })

      Logger.info(`[UpcomingBookUserPreferences] Updated preferences for user ${userId}`)
      return validatedPreferences
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to update preferences:', error)
      throw error
    }
  }

  /**
   * Add favorite author
   */
  async addFavoriteAuthor(userId, authorName) {
    try {
      const preferences = await this.getUserPreferences(userId)

      if (!preferences.favoriteAuthors.includes(authorName)) {
        preferences.favoriteAuthors.push(authorName)
        await this.updateUserPreferences(userId, preferences)

        Logger.info(`[UpcomingBookUserPreferences] Added favorite author "${authorName}" for user ${userId}`)
      }

      return preferences.favoriteAuthors
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to add favorite author:', error)
      throw error
    }
  }

  /**
   * Remove favorite author
   */
  async removeFavoriteAuthor(userId, authorName) {
    try {
      const preferences = await this.getUserPreferences(userId)

      preferences.favoriteAuthors = preferences.favoriteAuthors.filter((author) => author.toLowerCase() !== authorName.toLowerCase())

      await this.updateUserPreferences(userId, preferences)

      Logger.info(`[UpcomingBookUserPreferences] Removed favorite author "${authorName}" for user ${userId}`)
      return preferences.favoriteAuthors
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to remove favorite author:', error)
      throw error
    }
  }

  /**
   * Add series to watchlist
   */
  async addSeriesToWatchlist(userId, seriesName, authorName) {
    try {
      const preferences = await this.getUserPreferences(userId)

      const seriesEntry = {
        name: seriesName,
        author: authorName,
        addedAt: new Date().toISOString(),
        lastChecked: null,
        notifications: true
      }

      // Check if already in watchlist
      const existingIndex = preferences.seriesWatchlist.findIndex((series) => series.name.toLowerCase() === seriesName.toLowerCase() && series.author.toLowerCase() === authorName.toLowerCase())

      if (existingIndex >= 0) {
        preferences.seriesWatchlist[existingIndex] = seriesEntry
      } else {
        preferences.seriesWatchlist.push(seriesEntry)
      }

      await this.updateUserPreferences(userId, preferences)

      Logger.info(`[UpcomingBookUserPreferences] Added series "${seriesName}" to watchlist for user ${userId}`)
      return preferences.seriesWatchlist
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to add series to watchlist:', error)
      throw error
    }
  }

  /**
   * Remove series from watchlist
   */
  async removeSeriesFromWatchlist(userId, seriesName, authorName) {
    try {
      const preferences = await this.getUserPreferences(userId)

      preferences.seriesWatchlist = preferences.seriesWatchlist.filter((series) => !(series.name.toLowerCase() === seriesName.toLowerCase() && series.author.toLowerCase() === authorName.toLowerCase()))

      await this.updateUserPreferences(userId, preferences)

      Logger.info(`[UpcomingBookUserPreferences] Removed series "${seriesName}" from watchlist for user ${userId}`)
      return preferences.seriesWatchlist
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to remove series from watchlist:', error)
      throw error
    }
  }

  /**
   * Update series notification settings
   */
  async updateSeriesNotifications(userId, seriesName, authorName, notifications) {
    try {
      const preferences = await this.getUserPreferences(userId)

      const series = preferences.seriesWatchlist.find((s) => s.name.toLowerCase() === seriesName.toLowerCase() && s.author.toLowerCase() === authorName.toLowerCase())

      if (series) {
        series.notifications = notifications
        await this.updateUserPreferences(userId, preferences)

        Logger.info(`[UpcomingBookUserPreferences] Updated notifications for series "${seriesName}" for user ${userId}`)
      }

      return preferences.seriesWatchlist
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to update series notifications:', error)
      throw error
    }
  }

  /**
   * Get personalized discovery recommendations
   */
  async getPersonalizedRecommendations(userId) {
    try {
      const preferences = await this.getUserPreferences(userId)
      const recommendations = []

      // Recommendations based on favorite authors
      for (const author of preferences.favoriteAuthors) {
        recommendations.push({
          type: 'author',
          value: author,
          priority: 'high',
          reason: 'Favorite author'
        })
      }

      // Recommendations based on series watchlist
      for (const series of preferences.seriesWatchlist) {
        recommendations.push({
          type: 'series',
          value: series.name,
          author: series.author,
          priority: 'high',
          reason: 'Watched series',
          lastChecked: series.lastChecked
        })
      }

      // Recommendations based on reading history (if available)
      const readingHistory = await this.getReadingHistory(userId)
      for (const book of readingHistory.slice(0, 10)) {
        // Top 10 recent books
        if (book.author && !preferences.favoriteAuthors.includes(book.author)) {
          recommendations.push({
            type: 'author',
            value: book.author,
            priority: 'medium',
            reason: 'Recent reading'
          })
        }
      }

      return recommendations
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to get recommendations:', error)
      return []
    }
  }

  /**
   * Get reading history for recommendations
   */
  async getReadingHistory(userId) {
    try {
      // This would integrate with the existing reading progress system
      // For now, return empty array
      return []
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to get reading history:', error)
      return []
    }
  }

  /**
   * Load preferences from database
   */
  async loadPreferencesFromDatabase(userId) {
    try {
      // Check if user has preferences in database
      const existing = await Database.settingModel.findOne({
        where: {
          key: `upcoming_books_preferences_${userId}`
        }
      })

      if (existing) {
        return JSON.parse(existing.value)
      }

      // Return default preferences if none exist
      return this.getDefaultPreferences()
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to load preferences from database:', error)
      return this.getDefaultPreferences()
    }
  }

  /**
   * Save preferences to database
   */
  async savePreferencesToDatabase(userId, preferences) {
    try {
      await Database.settingModel.upsert({
        key: `upcoming_books_preferences_${userId}`,
        value: JSON.stringify(preferences),
        updatedAt: new Date()
      })
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to save preferences to database:', error)
      throw error
    }
  }

  /**
   * Get default preferences
   */
  getDefaultPreferences() {
    return {
      // Favorite authors
      favoriteAuthors: [],

      // Series watchlist
      seriesWatchlist: [],

      // Notification preferences
      notifications: {
        email: false,
        push: true,
        inApp: true,
        frequency: 'daily' // daily, weekly, monthly
      },

      // Discovery settings
      discovery: {
        enabled: true,
        frequency: 'weekly', // daily, weekly, monthly
        includeNonSeries: true,
        includeUpcoming: true,
        includeReleased: false,
        maxResults: 10
      },

      // Privacy settings
      privacy: {
        shareReadingHistory: false,
        sharePreferences: false
      },

      // Advanced settings
      advanced: {
        autoAddToWatchlist: false,
        smartRecommendations: true,
        cachePersonalization: true
      }
    }
  }

  /**
   * Validate preferences
   */
  validatePreferences(preferences) {
    const validated = { ...this.getDefaultPreferences(), ...preferences }

    // Validate arrays
    if (!Array.isArray(validated.favoriteAuthors)) {
      validated.favoriteAuthors = []
    }
    if (!Array.isArray(validated.seriesWatchlist)) {
      validated.seriesWatchlist = []
    }

    // Validate notification frequency
    const validFrequencies = ['daily', 'weekly', 'monthly']
    if (!validFrequencies.includes(validated.notifications.frequency)) {
      validated.notifications.frequency = 'daily'
    }

    // Validate discovery frequency
    if (!validFrequencies.includes(validated.discovery.frequency)) {
      validated.discovery.frequency = 'weekly'
    }

    // Validate max results
    if (typeof validated.discovery.maxResults !== 'number' || validated.discovery.maxResults < 1) {
      validated.discovery.maxResults = 10
    }

    return validated
  }

  /**
   * Clear user preferences
   */
  async clearUserPreferences(userId) {
    try {
      // Remove from database
      await Database.settingModel.destroy({
        where: {
          key: `upcoming_books_preferences_${userId}`
        }
      })

      // Remove from cache
      this.preferencesCache.delete(userId)

      Logger.info(`[UpcomingBookUserPreferences] Cleared preferences for user ${userId}`)
      return true
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to clear preferences:', error)
      return false
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      const preferences = await this.getUserPreferences(userId)

      return {
        favoriteAuthorsCount: preferences.favoriteAuthors.length,
        watchedSeriesCount: preferences.seriesWatchlist.length,
        notificationsEnabled: preferences.notifications.inApp || preferences.notifications.push,
        discoveryEnabled: preferences.discovery.enabled,
        lastUpdated: new Date().toISOString()
      }
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to get user stats:', error)
      return null
    }
  }

  /**
   * Export user preferences
   */
  async exportUserPreferences(userId) {
    try {
      const preferences = await this.getUserPreferences(userId)

      return {
        preferences,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to export preferences:', error)
      throw error
    }
  }

  /**
   * Import user preferences
   */
  async importUserPreferences(userId, importData) {
    try {
      if (!importData.preferences) {
        throw new Error('Invalid import data: missing preferences')
      }

      const validatedPreferences = this.validatePreferences(importData.preferences)
      await this.updateUserPreferences(userId, validatedPreferences)

      Logger.info(`[UpcomingBookUserPreferences] Imported preferences for user ${userId}`)
      return validatedPreferences
    } catch (error) {
      Logger.error('[UpcomingBookUserPreferences] Failed to import preferences:', error)
      throw error
    }
  }
}

module.exports = UpcomingBookUserPreferences
