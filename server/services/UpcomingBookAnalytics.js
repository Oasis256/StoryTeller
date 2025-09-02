const Logger = require('../Logger')
const Database = require('../Database')

/**
 * Enhanced analytics service for upcoming book discovery
 * - Reading pattern analysis
 * - Series completion predictions
 * - Discovery accuracy metrics
 * - User engagement tracking
 * - Performance analytics
 */
class UpcomingBookAnalytics {
  constructor() {
    this.analyticsCache = new Map()
    this.cacheExpiry = 60 * 60 * 1000 // 1 hour
    this.metrics = {
      discoveries: 0,
      successfulDiscoveries: 0,
      failedDiscoveries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      userEngagement: {},
      seriesCompletions: 0,
      averageResponseTime: 0
    }
  }

  /**
   * Track discovery attempt
   */
  async trackDiscovery(seriesName, authorName, success, responseTime, provider, strategy) {
    try {
      this.metrics.discoveries++

      if (success) {
        this.metrics.successfulDiscoveries++
      } else {
        this.metrics.failedDiscoveries++
      }

      // Update average response time
      this.updateAverageResponseTime(responseTime)

      // Save to database for historical analysis
      await this.saveDiscoveryEvent({
        seriesName,
        authorName,
        success,
        responseTime,
        provider,
        strategy,
        timestamp: new Date().toISOString()
      })

      Logger.debug(`[UpcomingBookAnalytics] Tracked discovery: ${seriesName} by ${authorName} - ${success ? 'SUCCESS' : 'FAILED'}`)
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to track discovery:', error)
    }
  }

  /**
   * Track cache performance
   */
  async trackCachePerformance(hit, key, responseTime) {
    try {
      if (hit) {
        this.metrics.cacheHits++
      } else {
        this.metrics.cacheMisses++
      }

      // Save cache event
      await this.saveCacheEvent({
        hit,
        key,
        responseTime,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to track cache performance:', error)
    }
  }

  /**
   * Track user engagement
   */
  async trackUserEngagement(userId, action, data) {
    try {
      if (!this.metrics.userEngagement[userId]) {
        this.metrics.userEngagement[userId] = {
          actions: 0,
          lastActivity: null,
          favoriteAuthors: 0,
          watchedSeries: 0
        }
      }

      this.metrics.userEngagement[userId].actions++
      this.metrics.userEngagement[userId].lastActivity = new Date().toISOString()

      // Save engagement event
      await this.saveEngagementEvent({
        userId,
        action,
        data,
        timestamp: new Date().toISOString()
      })

      Logger.debug(`[UpcomingBookAnalytics] Tracked user engagement: ${userId} - ${action}`)
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to track user engagement:', error)
    }
  }

  /**
   * Analyze reading patterns
   */
  async analyzeReadingPatterns(userId) {
    try {
      const patterns = {
        favoriteGenres: [],
        readingSpeed: 0,
        preferredSeries: [],
        completionRate: 0,
        averageBookLength: 0,
        readingSchedule: {}
      }

      // Get user's reading history
      const readingHistory = await this.getUserReadingHistory(userId)

      if (readingHistory.length === 0) {
        return patterns
      }

      // Analyze genres
      const genreCounts = {}
      readingHistory.forEach((book) => {
        if (book.genres) {
          book.genres.forEach((genre) => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1
          })
        }
      })

      patterns.favoriteGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([genre]) => genre)

      // Analyze reading speed
      const completedBooks = readingHistory.filter((book) => book.isFinished)
      if (completedBooks.length > 0) {
        const totalTime = completedBooks.reduce((sum, book) => sum + (book.finishedAt - book.startedAt), 0)
        const totalPages = completedBooks.reduce((sum, book) => sum + (book.pages || 0), 0)

        if (totalTime > 0 && totalPages > 0) {
          patterns.readingSpeed = totalPages / (totalTime / (1000 * 60 * 60 * 24)) // pages per day
        }
      }

      // Analyze series preferences
      const seriesCounts = {}
      readingHistory.forEach((book) => {
        if (book.series) {
          seriesCounts[book.series] = (seriesCounts[book.series] || 0) + 1
        }
      })

      patterns.preferredSeries = Object.entries(seriesCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([series]) => series)

      // Calculate completion rate
      patterns.completionRate = (completedBooks.length / readingHistory.length) * 100

      // Calculate average book length
      const booksWithPages = readingHistory.filter((book) => book.pages)
      if (booksWithPages.length > 0) {
        patterns.averageBookLength = booksWithPages.reduce((sum, book) => sum + book.pages, 0) / booksWithPages.length
      }

      // Analyze reading schedule
      const hourlyActivity = new Array(24).fill(0)
      readingHistory.forEach((book) => {
        if (book.lastReadAt) {
          const hour = new Date(book.lastReadAt).getHours()
          hourlyActivity[hour]++
        }
      })

      patterns.readingSchedule = {
        peakHours: hourlyActivity
          .map((count, hour) => ({ hour, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map(({ hour }) => hour),
        totalSessions: readingHistory.length
      }

      return patterns
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to analyze reading patterns:', error)
      return {}
    }
  }

  /**
   * Predict series completion
   */
  async predictSeriesCompletion(seriesName, authorName, currentBooks, userPatterns) {
    try {
      const prediction = {
        completionProbability: 0,
        estimatedTimeToComplete: null,
        confidence: 0,
        factors: []
      }

      // Factor 1: User's completion rate
      if (userPatterns.completionRate > 80) {
        prediction.completionProbability += 25
        prediction.factors.push('High completion rate')
      } else if (userPatterns.completionRate > 60) {
        prediction.completionProbability += 15
        prediction.factors.push('Moderate completion rate')
      }

      // Factor 2: Series length preference
      const userSeriesLengths = userPatterns.preferredSeries.length
      if (userSeriesLengths > 5) {
        prediction.completionProbability += 20
        prediction.factors.push('Enjoys long series')
      }

      // Factor 3: Genre preference
      if (userPatterns.favoriteGenres.length > 0) {
        // This would check if the series genre matches user preferences
        prediction.completionProbability += 15
        prediction.factors.push('Genre preference match')
      }

      // Factor 4: Reading speed
      if (userPatterns.readingSpeed > 50) {
        prediction.completionProbability += 20
        prediction.factors.push('Fast reader')
      }

      // Factor 5: Author familiarity
      const authorBooks = await this.getAuthorBooksByUser(authorName)
      if (authorBooks.length > 2) {
        prediction.completionProbability += 20
        prediction.factors.push('Familiar author')
      }

      // Calculate confidence based on available data
      prediction.confidence = Math.min(prediction.factors.length * 20, 100)

      // Estimate time to complete based on reading speed
      if (userPatterns.readingSpeed > 0) {
        const estimatedBooksRemaining = 3 // Assume average series has 3 more books
        const estimatedPagesPerBook = 400 // Average book length
        const totalPages = estimatedBooksRemaining * estimatedPagesPerBook
        prediction.estimatedTimeToComplete = totalPages / userPatterns.readingSpeed // days
      }

      return prediction
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to predict series completion:', error)
      return { completionProbability: 0, confidence: 0, factors: [] }
    }
  }

  /**
   * Get discovery accuracy metrics
   */
  async getDiscoveryAccuracyMetrics(timeRange = '30d') {
    try {
      const events = await this.getDiscoveryEvents(timeRange)

      if (events.length === 0) {
        return {
          accuracy: 0,
          totalDiscoveries: 0,
          successfulDiscoveries: 0,
          failedDiscoveries: 0,
          averageResponseTime: 0,
          providerPerformance: {},
          strategyPerformance: {}
        }
      }

      const successful = events.filter((e) => e.success)
      const accuracy = (successful.length / events.length) * 100

      const providerPerformance = {}
      const strategyPerformance = {}

      events.forEach((event) => {
        // Provider performance
        if (event.provider) {
          if (!providerPerformance[event.provider]) {
            providerPerformance[event.provider] = { total: 0, successful: 0 }
          }
          providerPerformance[event.provider].total++
          if (event.success) {
            providerPerformance[event.provider].successful++
          }
        }

        // Strategy performance
        if (event.strategy) {
          if (!strategyPerformance[event.strategy]) {
            strategyPerformance[event.strategy] = { total: 0, successful: 0 }
          }
          strategyPerformance[event.strategy].total++
          if (event.success) {
            strategyPerformance[event.strategy].successful++
          }
        }
      })

      // Calculate provider accuracy
      Object.keys(providerPerformance).forEach((provider) => {
        const perf = providerPerformance[provider]
        perf.accuracy = (perf.successful / perf.total) * 100
      })

      // Calculate strategy accuracy
      Object.keys(strategyPerformance).forEach((strategy) => {
        const perf = strategyPerformance[strategy]
        perf.accuracy = (perf.successful / perf.total) * 100
      })

      const averageResponseTime = events.reduce((sum, event) => sum + event.responseTime, 0) / events.length

      return {
        accuracy: Math.round(accuracy * 100) / 100,
        totalDiscoveries: events.length,
        successfulDiscoveries: successful.length,
        failedDiscoveries: events.length - successful.length,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        providerPerformance,
        strategyPerformance
      }
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to get discovery accuracy metrics:', error)
      return {}
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(timeRange = '30d') {
    try {
      const events = await this.getEngagementEvents(timeRange)

      const engagement = {
        totalUsers: new Set(events.map((e) => e.userId)).size,
        totalActions: events.length,
        actionsPerUser: 0,
        mostActiveUsers: [],
        popularActions: {},
        engagementTrend: []
      }

      if (engagement.totalUsers > 0) {
        engagement.actionsPerUser = events.length / engagement.totalUsers
      }

      // Most active users
      const userActionCounts = {}
      events.forEach((event) => {
        userActionCounts[event.userId] = (userActionCounts[event.userId] || 0) + 1
      })

      engagement.mostActiveUsers = Object.entries(userActionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, actions: count }))

      // Popular actions
      events.forEach((event) => {
        engagement.popularActions[event.action] = (engagement.popularActions[event.action] || 0) + 1
      })

      // Engagement trend (daily)
      const dailyEngagement = {}
      events.forEach((event) => {
        const date = new Date(event.timestamp).toDateString()
        dailyEngagement[date] = (dailyEngagement[date] || 0) + 1
      })

      engagement.engagementTrend = Object.entries(dailyEngagement)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))

      return engagement
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to get user engagement metrics:', error)
      return {}
    }
  }

  /**
   * Get comprehensive analytics report
   */
  async getAnalyticsReport(timeRange = '30d') {
    try {
      const [accuracyMetrics, engagementMetrics, readingPatterns] = await Promise.all([this.getDiscoveryAccuracyMetrics(timeRange), this.getUserEngagementMetrics(timeRange), this.getOverallReadingPatterns()])

      return {
        period: timeRange,
        generatedAt: new Date().toISOString(),
        accuracy: accuracyMetrics,
        engagement: engagementMetrics,
        readingPatterns,
        summary: {
          totalDiscoveries: accuracyMetrics.totalDiscoveries || 0,
          discoveryAccuracy: accuracyMetrics.accuracy || 0,
          activeUsers: engagementMetrics.totalUsers || 0,
          averageResponseTime: accuracyMetrics.averageResponseTime || 0
        }
      }
    } catch (error) {
      Logger.error('[UpcomingBookAnalytics] Failed to generate analytics report:', error)
      return {}
    }
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(newResponseTime) {
    const currentTotal = this.metrics.averageResponseTime * this.metrics.discoveries
    this.metrics.averageResponseTime = (currentTotal + newResponseTime) / (this.metrics.discoveries + 1)
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    return {
      ...this.metrics,
      accuracy: this.metrics.discoveries > 0 ? ((this.metrics.successfulDiscoveries / this.metrics.discoveries) * 100).toFixed(2) : 0,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0 ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2) : 0
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      discoveries: 0,
      successfulDiscoveries: 0,
      failedDiscoveries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      userEngagement: {},
      seriesCompletions: 0,
      averageResponseTime: 0
    }
    Logger.info('[UpcomingBookAnalytics] Metrics reset')
  }

  // Database helper methods (placeholder implementations)
  async saveDiscoveryEvent(event) {
    // This would save to a dedicated analytics table
    // For now, just log the event
    Logger.debug('[UpcomingBookAnalytics] Discovery event:', event)
  }

  async saveCacheEvent(event) {
    // This would save to a dedicated analytics table
    Logger.debug('[UpcomingBookAnalytics] Cache event:', event)
  }

  async saveEngagementEvent(event) {
    // This would save to a dedicated analytics table
    Logger.debug('[UpcomingBookAnalytics] Engagement event:', event)
  }

  async getDiscoveryEvents(timeRange) {
    // This would query the analytics database
    // For now, return empty array
    return []
  }

  async getEngagementEvents(timeRange) {
    // This would query the analytics database
    // For now, return empty array
    return []
  }

  async getUserReadingHistory(userId) {
    // This would integrate with the existing reading progress system
    // For now, return empty array
    return []
  }

  async getAuthorBooksByUser(authorName) {
    // This would query the user's library for books by this author
    // For now, return empty array
    return []
  }

  async getOverallReadingPatterns() {
    // This would analyze overall reading patterns across all users
    // For now, return empty object
    return {}
  }
}

module.exports = UpcomingBookAnalytics
