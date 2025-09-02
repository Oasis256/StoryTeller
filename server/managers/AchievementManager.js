const Logger = require('../Logger')
const Database = require('../Database')
const { Sequelize, Op } = require('sequelize')

/**
 * Achievement definitions with their unlock criteria
 */
const ACHIEVEMENT_DEFINITIONS = [
  // Reading Progress Achievements
  {
    key: 'first_book',
    nameKey: 'AchievementFirstBookName',
    descKey: 'AchievementFirstBookDesc',
    name: 'First Steps',
    description: 'Complete your first audiobook',
    badgeIcon: 'book-open',
    badgeColor: '#10b981',
    category: 'reading',
    targetValue: 1,
    targetUnit: 'books'
  },
  {
    key: 'bookworm',
    nameKey: 'AchievementBookwormName',
    descKey: 'AchievementBookwormDesc',
    name: 'Bookworm',
    description: 'Complete 10 audiobooks',
    badgeIcon: 'academic-cap',
    badgeColor: '#3b82f6',
    category: 'reading',
    targetValue: 10,
    targetUnit: 'books'
  },
  {
    key: 'library_master',
    nameKey: 'AchievementLibraryMasterName',
    descKey: 'AchievementLibraryMasterDesc',
    name: 'Library Master',
    description: 'Complete 50 audiobooks',
    badgeIcon: 'library',
    badgeColor: '#8b5cf6',
    category: 'reading',
    targetValue: 50,
    targetUnit: 'books'
  },
  {
    key: 'bibliophile',
    nameKey: 'AchievementBibliophileName',
    descKey: 'AchievementBibliophileDesc',
    name: 'Bibliophile',
    description: 'Complete 100 audiobooks',
    badgeIcon: 'star',
    badgeColor: '#f59e0b',
    category: 'reading',
    targetValue: 100,
    targetUnit: 'books'
  },

  // Listening Time Achievements
  {
    key: 'first_hour',
    nameKey: 'AchievementFirstHourName',
    descKey: 'AchievementFirstHourDesc',
    name: 'Getting Started',
    description: 'Listen for 1 hour total',
    badgeIcon: 'clock',
    badgeColor: '#06b6d4',
    category: 'listening',
    targetValue: 60,
    targetUnit: 'minutes'
  },
  {
    key: 'dedicated_listener',
    nameKey: 'AchievementDedicatedListenerName',
    descKey: 'AchievementDedicatedListenerDesc',
    name: 'Dedicated Listener',
    description: 'Listen for 24 hours total',
    badgeIcon: 'volume-up',
    badgeColor: '#ec4899',
    category: 'listening',
    targetValue: 1440,
    targetUnit: 'minutes'
  },
  {
    key: 'audio_enthusiast',
    nameKey: 'AchievementAudioEnthusiastName',
    descKey: 'AchievementAudioEnthusiastDesc',
    name: 'Audio Enthusiast',
    description: 'Listen for 100 hours total',
    badgeIcon: 'headphones',
    badgeColor: '#f97316',
    category: 'listening',
    targetValue: 6000,
    targetUnit: 'minutes'
  },
  {
    key: 'listening_legend',
    nameKey: 'AchievementListeningLegendName',
    descKey: 'AchievementListeningLegendDesc',
    name: 'Listening Legend',
    description: 'Listen for 500 hours total',
    badgeIcon: 'fire',
    badgeColor: '#dc2626',
    category: 'listening',
    targetValue: 30000,
    targetUnit: 'minutes'
  },

  // Streak Achievements
  {
    key: 'weekend_warrior',
    nameKey: 'AchievementWeekendWarriorName',
    descKey: 'AchievementWeekendWarriorDesc',
    name: 'Weekend Warrior',
    description: 'Listen for 2 consecutive days',
    badgeIcon: 'calendar',
    badgeColor: '#059669',
    category: 'streak',
    targetValue: 2,
    targetUnit: 'days'
  },
  {
    key: 'week_streaker',
    nameKey: 'AchievementWeekStreakerName',
    descKey: 'AchievementWeekStreakerDesc',
    name: 'Week Streaker',
    description: 'Listen for 7 consecutive days',
    badgeIcon: 'trending-up',
    badgeColor: '#7c3aed',
    category: 'streak',
    targetValue: 7,
    targetUnit: 'days'
  },
  {
    key: 'habit_former',
    nameKey: 'AchievementHabitFormerName',
    descKey: 'AchievementHabitFormerDesc',
    name: 'Habit Former',
    description: 'Listen for 30 consecutive days',
    badgeIcon: 'check-circle',
    badgeColor: '#f59e0b',
    category: 'streak',
    targetValue: 30,
    targetUnit: 'days'
  },

  // Diversity Achievements
  {
    key: 'genre_explorer',
    nameKey: 'AchievementGenreExplorerName',
    descKey: 'AchievementGenreExplorerDesc',
    name: 'Genre Explorer',
    description: 'Listen to books from 5 different genres',
    badgeIcon: 'collection',
    badgeColor: '#8b5cf6',
    category: 'diversity',
    targetValue: 5,
    targetUnit: 'genres'
  },
  {
    key: 'author_hunter',
    nameKey: 'AchievementAuthorHunterName',
    descKey: 'AchievementAuthorHunterDesc',
    name: 'Author Hunter',
    description: 'Listen to books from 20 different authors',
    badgeIcon: 'users',
    badgeColor: '#06b6d4',
    category: 'diversity',
    targetValue: 20,
    targetUnit: 'authors'
  },

  // Milestone Achievements
  {
    key: 'speed_reader',
    nameKey: 'AchievementSpeedReaderName',
    descKey: 'AchievementSpeedReaderDesc',
    name: 'Speed Reader',
    description: 'Complete a book in one day',
    badgeIcon: 'lightning-bolt',
    badgeColor: '#eab308',
    category: 'milestone',
    targetValue: 1,
    targetUnit: 'books'
  },
  {
    key: 'marathon_listener',
    nameKey: 'AchievementMarathonListenerName',
    descKey: 'AchievementMarathonListenerDesc',
    name: 'Marathon Listener',
    description: 'Listen for 8 hours in a single day',
    badgeIcon: 'chart-bar',
    badgeColor: '#ef4444',
    category: 'milestone',
    targetValue: 480,
    targetUnit: 'minutes'
  }
]

class AchievementManager {
  constructor() {
    this.initialized = false
  }

  /**
   * Initialize achievement system
   */
  async init() {
    if (this.initialized) return

    try {
      await this.seedAchievements()
      this.initialized = true
      Logger.info('[AchievementManager] Initialized successfully')
    } catch (error) {
      Logger.error('[AchievementManager] Failed to initialize:', error)
    }
  }

  /**
   * Seed default achievements into database
   */
  async seedAchievements() {
    try {
      Logger.error('[AchievementManager] Available models:', Object.keys(Database.sequelize?.models || {}))
      Logger.error('[AchievementManager] achievementModel:', !!Database.achievementModel)

      if (!Database.achievementModel) {
        Logger.error('[AchievementManager] Achievement model not found in database')
        return
      }

      for (const achievementDef of ACHIEVEMENT_DEFINITIONS) {
        const existingAchievement = await Database.achievementModel.findOne({
          where: { key: achievementDef.key }
        })

        if (!existingAchievement) {
          await Database.achievementModel.create(achievementDef)
          Logger.debug(`[AchievementManager] Seeded achievement: ${achievementDef.key}`)
        }
      }
    } catch (error) {
      Logger.error('[AchievementManager] Failed to seed achievements:', error)
    }
  }

  /**
   * Check and update user achievements based on their activity
   * @param {string} userId
   */
  async updateUserAchievements(userId) {
    try {
      const user = await Database.userModel.findByPk(userId, {
        include: [
          {
            model: Database.mediaProgressModel,
            where: { isFinished: true },
            required: false
          }
        ]
      })

      if (!user) return

      // Get user's listening statistics
      const stats = await this.getUserStats(userId)

      // Check each achievement type
      await this.checkReadingAchievements(userId, stats)
      await this.checkListeningAchievements(userId, stats)
      await this.checkStreakAchievements(userId, stats)
      await this.checkDiversityAchievements(userId, stats)
      await this.checkMilestoneAchievements(userId, stats)
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to update achievements for user ${userId}:`, error)
    }
  }

  /**
   * Check all achievements and return newly unlocked ones
   * @param {string} userId
   * @returns {Array} Array of newly unlocked achievements
   */
  async checkAllAchievements(userId) {
    const newlyUnlocked = []

    try {
      const user = await Database.userModel.findByPk(userId, {
        include: [
          {
            model: Database.mediaProgressModel,
            where: { isFinished: true },
            required: false
          }
        ]
      })

      if (!user) return newlyUnlocked

      // Get user's listening statistics
      const stats = await this.getUserStats(userId)

      // Store the before state to track newly unlocked achievements
      const beforeState = await this.getUserUnlockedAchievements(userId)
      const beforeUnlockedIds = new Set(beforeState.map((a) => a.id))

      // Check each achievement type
      await this.checkReadingAchievements(userId, stats)
      await this.checkListeningAchievements(userId, stats)
      await this.checkStreakAchievements(userId, stats)
      await this.checkDiversityAchievements(userId, stats)
      await this.checkMilestoneAchievements(userId, stats)

      // Get the after state and find newly unlocked achievements
      const afterState = await this.getUserUnlockedAchievements(userId)

      for (const achievement of afterState) {
        if (!beforeUnlockedIds.has(achievement.id)) {
          newlyUnlocked.push(achievement)
        }
      }
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to check all achievements for user ${userId}:`, error)
      throw error
    }

    return newlyUnlocked
  }

  /**
   * Get comprehensive user statistics
   * @param {string} userId
   */
  async getUserStats(userId) {
    try {
      // Get finished books count
      const finishedBooksCount = await Database.mediaProgressModel.count({
        where: {
          userId,
          isFinished: true,
          mediaItemType: 'book'
        }
      })

      // Get total listening time
      const [listeningTimeResult] = await Database.sequelize.query(
        `
        SELECT SUM(timeListening) as totalTime
        FROM playbackSessions
        WHERE userId = :userId
      `,
        {
          replacements: { userId },
          type: Database.sequelize.QueryTypes.SELECT
        }
      )

      const totalListeningTime = Math.round(listeningTimeResult?.totalTime || 0)

      // Get listening streak
      const currentStreak = await this.calculateListeningStreak(userId)

      // Get genre diversity
      const genreCount = await this.getUniqueGenreCount(userId)

      // Get author diversity
      const authorCount = await this.getUniqueAuthorCount(userId)

      // Get daily statistics for milestone achievements
      const dailyStats = await this.getDailyListeningStats(userId)

      return {
        finishedBooksCount,
        totalListeningTime,
        currentStreak,
        genreCount,
        authorCount,
        dailyStats
      }
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to get user stats for ${userId}:`, error)
      return {}
    }
  }

  /**
   * Check reading-based achievements
   */
  async checkReadingAchievements(userId, stats) {
    const achievements = await Database.achievementModel.findAll({
      where: { category: 'reading', isActive: true }
    })

    for (const achievement of achievements) {
      await this.updateAchievementProgress(userId, achievement.id, stats.finishedBooksCount || 0)
    }
  }

  /**
   * Check listening time achievements
   */
  async checkListeningAchievements(userId, stats) {
    const achievements = await Database.achievementModel.findAll({
      where: { category: 'listening', isActive: true }
    })

    for (const achievement of achievements) {
      await this.updateAchievementProgress(userId, achievement.id, stats.totalListeningTime || 0)
    }
  }

  /**
   * Check streak achievements
   */
  async checkStreakAchievements(userId, stats) {
    const achievements = await Database.achievementModel.findAll({
      where: { category: 'streak', isActive: true }
    })

    for (const achievement of achievements) {
      await this.updateAchievementProgress(userId, achievement.id, stats.currentStreak || 0)
    }
  }

  /**
   * Check diversity achievements
   */
  async checkDiversityAchievements(userId, stats) {
    const achievements = await Database.achievementModel.findAll({
      where: { category: 'diversity', isActive: true }
    })

    for (const achievement of achievements) {
      let progress = 0
      if (achievement.targetUnit === 'genres') {
        progress = stats.genreCount || 0
      } else if (achievement.targetUnit === 'authors') {
        progress = stats.authorCount || 0
      }

      await this.updateAchievementProgress(userId, achievement.id, progress)
    }
  }

  /**
   * Check milestone achievements
   */
  async checkMilestoneAchievements(userId, stats) {
    const achievements = await Database.achievementModel.findAll({
      where: { category: 'milestone', isActive: true }
    })

    for (const achievement of achievements) {
      let progress = 0

      if (achievement.key === 'speed_reader') {
        // Check if user completed a book in one day
        progress = (await this.checkSpeedReaderAchievement(userId)) ? 1 : 0
      } else if (achievement.key === 'marathon_listener') {
        // Check max listening time in a single day
        progress = Math.max(...Object.values(stats.dailyStats || {}))
      }

      await this.updateAchievementProgress(userId, achievement.id, progress)
    }
  }

  /**
   * Update achievement progress for a user
   */
  async updateAchievementProgress(userId, achievementId, newProgress) {
    try {
      let userAchievement = await Database.userAchievementModel.findOne({
        where: { userId, achievementId },
        include: [Database.achievementModel]
      })

      if (!userAchievement) {
        userAchievement = await Database.userAchievementModel.create({
          userId,
          achievementId,
          progress: 0
        })
        userAchievement.achievement = await Database.achievementModel.findByPk(achievementId)
      }

      const wasUnlocked = userAchievement.isUnlocked
      await userAchievement.updateProgress(newProgress)

      // Emit achievement unlocked event if newly unlocked
      if (!wasUnlocked && userAchievement.isUnlocked) {
        this.emitAchievementUnlocked(userId, userAchievement)
      }

      return userAchievement
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to update achievement progress:`, error)
    }
  }

  /**
   * Get user's current listening streak
   */
  async calculateListeningStreak(userId) {
    try {
      // SQLite-compatible streak calculation
      const dailyListening = await Database.sequelize.query(
        `
        SELECT
          DATE(createdAt) as listening_date,
          SUM(timeListening) as daily_time
        FROM playbackSessions
        WHERE userId = :userId
          AND timeListening > 0
        GROUP BY DATE(createdAt)
        HAVING daily_time > 300
        ORDER BY listening_date DESC
      `,
        {
          replacements: { userId },
          type: Database.sequelize.QueryTypes.SELECT
        }
      )

      if (!dailyListening || dailyListening.length === 0) return 0

      // Calculate streak manually since SQLite doesn't support window functions
      let streak = 0
      let currentDate = new Date()
      currentDate.setHours(0, 0, 0, 0)

      for (const day of dailyListening) {
        const dayDate = new Date(day.listening_date)
        const diffDays = Math.floor((currentDate - dayDate) / (1000 * 60 * 60 * 24))

        if (diffDays === streak) {
          streak++
        } else if (diffDays === streak + 1 && streak === 0) {
          // Allow for today not having listening yet
          streak++
        } else {
          break
        }
      }

      return streak
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to calculate listening streak:`, error)
      return 0
    }
  }

  /**
   * Get unique genre count for user
   */
  async getUniqueGenreCount(userId) {
    try {
      // SQLite-compatible genre extraction using JSON functions
      const genreResults = await Database.sequelize.query(
        `
        SELECT DISTINCT
          TRIM(json_each.value, '"') as genre
        FROM playbackSessions ps,
             json_each(json_extract(ps.mediaMetadata, '$.genres'))
        WHERE ps.userId = :userId
          AND json_extract(ps.mediaMetadata, '$.genres') IS NOT NULL
          AND json_each.value IS NOT NULL
          AND TRIM(json_each.value, '"') != ''
          AND LOWER(TRIM(json_each.value, '"')) NOT LIKE '%audiobook%'
      `,
        {
          replacements: { userId },
          type: Database.sequelize.QueryTypes.SELECT
        }
      )

      return genreResults?.length || 0
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to get unique genre count:`, error)
      return 0
    }
  }

  /**
   * Get unique author count for user
   */
  async getUniqueAuthorCount(userId) {
    try {
      // SQLite-compatible author extraction using JSON functions
      const authorResults = await Database.sequelize.query(
        `
        SELECT DISTINCT
          json_extract(json_each.value, '$.name') as author_name
        FROM playbackSessions ps,
             json_each(json_extract(ps.mediaMetadata, '$.authors'))
        WHERE ps.userId = :userId
          AND json_extract(ps.mediaMetadata, '$.authors') IS NOT NULL
          AND json_extract(json_each.value, '$.name') IS NOT NULL
          AND json_extract(json_each.value, '$.name') != ''
      `,
        {
          replacements: { userId },
          type: Database.sequelize.QueryTypes.SELECT
        }
      )

      return authorResults?.length || 0
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to get unique author count:`, error)
      return 0
    }
  }

  /**
   * Get daily listening statistics
   */
  async getDailyListeningStats(userId) {
    try {
      // SQLite-compatible date functions
      const dailyStats = await Database.sequelize.query(
        `
        SELECT
          DATE(createdAt) as date,
          SUM(timeListening) as total_time
        FROM playbackSessions
        WHERE userId = :userId
          AND createdAt >= datetime('now', '-30 days')
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
      `,
        {
          replacements: { userId },
          type: Database.sequelize.QueryTypes.SELECT
        }
      )

      const stats = {}
      if (dailyStats) {
        dailyStats.forEach((day) => {
          stats[day.date] = day.total_time
        })
      }

      return {
        daily: stats,
        totalDays: Object.keys(stats).length,
        averageTime: Object.keys(stats).length > 0 ? Object.values(stats).reduce((a, b) => a + b, 0) / Object.keys(stats).length : 0
      }
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to get daily listening stats:`, error)
      return { daily: {}, totalDays: 0, averageTime: 0 }
    }
  }

  /**
   * Check if user has completed a book in one day
   */
  async checkSpeedReaderAchievement(userId) {
    try {
      const speedReaderCount = await Database.mediaProgressModel.count({
        where: {
          userId,
          isFinished: true,
          mediaItemType: 'book',
          [Op.and]: Database.sequelize.where(Database.sequelize.fn('DATE', Database.sequelize.col('createdAt')), '=', Database.sequelize.fn('DATE', Database.sequelize.col('finishedAt')))
        }
      })

      return speedReaderCount > 0
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to check speed reader achievement:`, error)
      return false
    }
  }

  /**
   * Emit achievement unlocked event
   */
  emitAchievementUnlocked(userId, userAchievement) {
    try {
      const SocketAuthority = require('../SocketAuthority')
      SocketAuthority.clientEmitter(userId, 'achievement_unlocked', {
        achievement: userAchievement.toJSON()
      })
      Logger.info(`[AchievementManager] Achievement unlocked for user ${userId}: ${userAchievement.achievement?.name}`)
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to emit achievement unlocked event:`, error)
    }
  }

  /**
   * Get all achievements for a user
   */
  async getUserAchievements(userId) {
    try {
      const achievements = await Database.achievementModel.findAll({
        where: { isActive: true },
        include: [
          {
            model: Database.userAchievementModel,
            where: { userId },
            required: false
          }
        ]
      })

      return achievements.map((achievement) => {
        const userAchievement = achievement.userAchievements?.[0]
        const achievementData = achievement.toJSON()

        return {
          ...achievementData,
          userProgress: userAchievement?.progress || 0,
          isUnlocked: userAchievement?.isUnlocked || false,
          unlockedAt: userAchievement?.unlockedAt || null,
          progressPercent: Math.min(100, Math.round(((userAchievement?.progress || 0) / achievement.targetValue) * 100))
        }
      })
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to get user achievements:`, error)
      return []
    }
  }

  /**
   * Get user's unlocked achievements only
   */
  async getUserUnlockedAchievements(userId) {
    try {
      const unlockedAchievements = await Database.userAchievementModel.findAll({
        where: {
          userId,
          isUnlocked: true
        },
        include: [Database.achievementModel],
        order: [['unlockedAt', 'DESC']]
      })

      return unlockedAchievements.map((ua) => ua.toJSON())
    } catch (error) {
      Logger.error(`[AchievementManager] Failed to get user unlocked achievements:`, error)
      return []
    }
  }
}

module.exports = new AchievementManager()
