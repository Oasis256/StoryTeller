/**
 * This adapter translates between the legacy achievement service and the new implementation
 */

const Logger = require('../Logger')
const Database = require('../Database')
const achievementService = require('./achievements')

/**
 * Adapter to translate between achievement implementations
 */
const AchievementAdapter = {
  /**
   * Get all achievements
   * @param {string} userId - Optional user ID to include user achievement status
   * @returns {Promise<Array>} - All achievements
   */
  async getAllAchievements(userId = null) {
    try {
      // Check if we need to initialize achievement definitions
      await this.ensureAchievements()
      
      // Get all achievements from the database
      const achievements = await Database.achievementModel.findAll({
        order: [
          ['category', 'ASC'],
          ['targetValue', 'ASC']
        ]
      })
      
      // If userId is provided, include user achievement status
      if (userId) {
        const userAchievements = await Database.userAchievementModel.findAll({
          where: { userId },
          include: [{
            model: Database.achievementModel,
            as: 'achievement'
          }]
        })
        
        // Map achievement IDs to user achievements for quick lookup
        const userAchievementMap = {}
        userAchievements.forEach(ua => {
          userAchievementMap[ua.achievementId] = ua
        })
        
        // Enhance achievement objects with user-specific data
        return achievements.map(achievement => {
          const userAchievement = userAchievementMap[achievement.id]
          const enhancedAchievement = achievement.toJSON()
          
          // Add user-specific properties
          enhancedAchievement.isUnlocked = userAchievement?.isUnlocked || false
          enhancedAchievement.userProgress = userAchievement?.progress || 0
          enhancedAchievement.unlockedAt = userAchievement?.unlockedAt || null
          enhancedAchievement.progressPercent = achievement.targetValue > 0 
            ? Math.min(100, Math.round((userAchievement?.progress || 0) / achievement.targetValue * 100)) 
            : 0
          
          return enhancedAchievement
        })
      }
      
      // If no userId, just return the achievements as is
      return achievements
    } catch (error) {
      Logger.error('[AchievementAdapter] Error getting all achievements:', error)
      throw error
    }
  },

  /**
   * Ensure achievements are defined in the database
   */
  async ensureAchievements() {
    // Import achievement definitions from the service
    const achievements = achievementService.DEFINITIONS || []
    
    Logger.debug(`[AchievementAdapter] Found ${achievements.length} achievement definitions to ensure`)
    
    // Check if we need to create achievement definitions
    for (const achievementDef of achievements) {
      const existingAchievement = await Database.achievementModel.findOne({
        where: { key: achievementDef.key }
      })
      
      if (!existingAchievement) {
        Logger.info(`[AchievementAdapter] Creating achievement definition: ${achievementDef.key}`)
        
        try {
          await Database.achievementModel.create({
            key: achievementDef.key,
            name: achievementDef.name,
            description: achievementDef.description,
            badgeIcon: achievementDef.icon || achievementDef.badgeIcon,
            badgeColor: achievementDef.color,
            badgeImage: achievementDef.badgeImage,
            category: achievementDef.category,
            targetValue: achievementDef.targetValue,
            targetUnit: achievementDef.targetUnit,
            rarity: achievementDef.rarity,
            xpValue: achievementDef.xpValue,
            isSecret: achievementDef.isSecret || false,
            unlockMessage: achievementDef.unlockMessage,
            isActive: true
          })
        } catch (error) {
          Logger.error(`[AchievementAdapter] Error creating achievement definition for ${achievementDef.key}:`, error)
        }
      } else {
        Logger.debug(`[AchievementAdapter] Achievement definition already exists: ${achievementDef.key}`)
      }
    }
    
    // Return the count of achievements
    const count = await Database.achievementModel.count()
    Logger.info(`[AchievementAdapter] Total achievement definitions: ${count}`)
    return count
  },

  /**
   * Get unlocked achievements for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} - Unlocked achievements
   */
  async getUnlockedAchievements(userId) {
    try {
      const userAchievements = await Database.userAchievementModel.findAll({
        where: {
          userId,
          isUnlocked: true
        },
        include: [{
          model: Database.achievementModel,
          as: 'achievement'
        }],
        order: [['unlockedAt', 'DESC']]
      })
      
      // Transform the data to match the format the client expects
      return userAchievements.map(ua => {
        const achievement = ua.achievement?.toJSON() || {}
        
        // Merge the userAchievement data with the achievement
        return {
          ...achievement,
          isUnlocked: ua.isUnlocked,
          userProgress: ua.progress,
          unlockedAt: ua.unlockedAt,
          progressPercent: achievement.targetValue > 0
            ? Math.min(100, Math.round((ua.progress || 0) / achievement.targetValue * 100))
            : 0
        }
      })
    } catch (error) {
      Logger.error('[AchievementAdapter] Error getting unlocked achievements:', error)
      throw error
    }
  },

  /**
   * Get recent unlocked achievements for a user
   * @param {string} userId - The user ID
   * @param {number} limit - Number of recent achievements to return
   * @returns {Promise<Array>} - Recent unlocked achievements
   */
  async getRecentUnlockedAchievements(userId, limit = 5) {
    try {
      const userAchievements = await Database.userAchievementModel.findAll({
        where: {
          userId,
          isUnlocked: true
        },
        include: [
          {
            model: Database.achievementModel,
            as: 'achievement'
          }
        ],
        order: [['unlockedAt', 'DESC']],
        limit
      })
      
      // Transform the data to match the format the client expects
      return userAchievements.map(ua => {
        const achievement = ua.achievement?.toJSON() || {}
        
        // Merge the userAchievement data with the achievement
        return {
          ...achievement,
          isUnlocked: ua.isUnlocked,
          userProgress: ua.progress,
          unlockedAt: ua.unlockedAt,
          progressPercent: achievement.targetValue > 0
            ? Math.min(100, Math.round((ua.progress || 0) / achievement.targetValue * 100))
            : 0
        }
      })
    } catch (error) {
      Logger.error('[AchievementAdapter] Error getting recent unlocked achievements:', error)
      throw error
    }
  },

  /**
   * Get achievement progress for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} - Achievement progress with details
   */
  async getUserAchievementProgress(userId) {
    try {
      const userAchievements = await Database.userAchievementModel.findAll({
        where: { userId },
        include: [{
          model: Database.achievementModel,
          as: 'achievement'
        }]
      })
      
      // Transform the data to include full achievement details with progress
      return userAchievements.map(ua => {
        const achievement = ua.achievement?.toJSON() || {}
        
        return {
          ...achievement,
          isUnlocked: ua.isUnlocked,
          userProgress: ua.progress,
          unlockedAt: ua.unlockedAt,
          progressPercent: achievement.targetValue > 0
            ? Math.min(100, Math.round((ua.progress || 0) / achievement.targetValue * 100))
            : 0
        }
      })
    } catch (error) {
      Logger.error('[AchievementAdapter] Error getting user achievement progress:', error)
      throw error
    }
  },

  /**
   * Get achievement stats for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - Achievement stats
   */
  async getUserAchievementStats(userId) {
    try {
      Logger.debug(`[AchievementAdapter] Getting achievement stats for user: ${userId}`)
      const stats = await achievementService.computeStats(userId)
      
      // Get total achievements count
      const totalCount = await Database.achievementModel.count({
        where: { isActive: true }
      })
      
      // Get unlocked achievements count
      const unlockedCount = await Database.userAchievementModel.count({
        where: { 
          userId,
          isUnlocked: true
        }
      })
      
      // Calculate completion percentage
      const completionRate = totalCount > 0 ? unlockedCount / totalCount : 0
      
      // Get a sample of unlocked achievements for debugging
      const sampleUnlockedAchievements = await Database.userAchievementModel.findAll({
        where: { 
          userId,
          isUnlocked: true
        },
        include: [{
          model: Database.achievementModel,
          as: 'achievement'
        }],
        limit: 3
      })
      
      Logger.debug(`[AchievementAdapter] Stats for user ${userId}: Total=${totalCount}, Unlocked=${unlockedCount}`)
      if (sampleUnlockedAchievements.length > 0) {
        Logger.debug(`[AchievementAdapter] Sample unlocked achievement: ${sampleUnlockedAchievements[0].achievement.name}`)
      }
      
      const userStats = {
        totalAchievements: totalCount,
        unlockedAchievements: unlockedCount,
        completionRate,
        totalListeningMinutes: stats.totalListeningMinutes,
        booksCompleted: stats.finishedBooksCount,
        currentStreak: stats.currentStreak
      }
      
      Logger.debug(`[AchievementAdapter] Returning stats: ${JSON.stringify(userStats)}`)
      return userStats
    } catch (error) {
      Logger.error('[AchievementAdapter] Error getting achievement stats:', error)
      throw error
    }
  },

  /**
   * Update user achievements and check for new unlocks
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} - Result of achievement update
   */
  async updateUserAchievements(userId) {
    try {
      // Get user with their achievements
      const user = await Database.userModel.findByPk(userId, {
        include: [
          {
            model: Database.userAchievementModel,
            as: 'userAchievements',
            include: [{
              model: Database.achievementModel,
              as: 'achievement'
            }]
          }
        ]
      })
      
      if (!user) {
        Logger.error(`[AchievementAdapter] User ${userId} not found`)
        return { newAchievements: [] }
      }
      
      // Get all achievements
      const allAchievements = await this.getAllAchievements()
      
      // Create any missing user achievement entries
      await this.ensureUserAchievements(user, allAchievements)
      
      // Get user stats
      const stats = await achievementService.computeStats(userId)
      
      // Check each achievement for progress updates
      const newUnlocks = []
      for (const userAchievement of user.userAchievements) {
        if (!userAchievement.isUnlocked && userAchievement.achievement) {
          const achievement = userAchievement.achievement
          let progress = 0
          
          // Determine progress based on category
          switch (achievement.category) {
            case 'reading':
              progress = stats.finishedBooksCount || 0
              break
            case 'listening':
              progress = stats.totalListeningMinutes || 0
              break
            case 'streak':
              progress = stats.currentStreak || 0
              break
            case 'diversity':
              if (achievement.targetUnit === 'genres') progress = stats.genreCount || 0
              if (achievement.targetUnit === 'authors') progress = stats.authorCount || 0
              break
            case 'milestone':
              if (achievement.key === 'marathon_listener') {
                const vals = Object.values(stats.dailyMinutes || {})
                progress = vals.length ? Math.max(...vals) : 0
              } else if (achievement.key === 'speed_reader') {
                const hasSpeedRead = await this.checkSpeedReader(userId)
                progress = hasSpeedRead ? 1 : 0
              }
              break
          }
          
          // Update progress and check if unlocked
          const wasUnlocked = await userAchievement.updateProgress(progress)
          if (wasUnlocked) {
            newUnlocks.push(userAchievement)
          }
        }
      }
      
      // Emit socket notifications for new unlocks
      for (const unlock of newUnlocks) {
        try {
          const SocketAuthority = require('../SocketAuthority')
          SocketAuthority.clientEmitter(userId, 'achievement_unlocked', {
            achievement: unlock.toJSON()
          })
        } catch (e) {
          Logger.error('[AchievementAdapter] Failed to emit socket achievement_unlocked', e)
        }
      }
      
      return { newAchievements: newUnlocks }
    } catch (error) {
      Logger.error('[AchievementAdapter] Error updating user achievements:', error)
      return { newAchievements: [], error: error.message }
    }
  },
  
  /**
   * Ensure the user has user achievement entries for all achievements
   * 
   * @param {Object} user - The user object
   * @param {Array} allAchievements - All achievements
   */
  async ensureUserAchievements(user, allAchievements) {
    try {
      const existingAchievementIds = user.userAchievements.map(ua => ua.achievement?.id).filter(Boolean)
      const missingAchievements = allAchievements.filter(a => !existingAchievementIds.includes(a.id))
      
      for (const achievement of missingAchievements) {
        await Database.userAchievementModel.create({
          userId: user.id,
          achievementId: achievement.id,
          progress: 0,
          isUnlocked: false
        })
      }
      
      // Reload user achievements if any were added
      if (missingAchievements.length > 0) {
        await user.reload({
          include: [
            {
              model: Database.userAchievementModel,
              include: [{
                model: Database.achievementModel,
                as: 'achievement'
              }]
            }
          ]
        })
      }
    } catch (error) {
      Logger.error('[AchievementAdapter] Error ensuring user achievements:', error)
    }
  },
  
  /**
   * Check if user has completed a book in one day
   * @param {string} userId - The user ID
   * @returns {Promise<boolean>} - Whether user has completed a book in one day
   */
  async checkSpeedReader(userId) {
    try {
      const count = await Database.mediaProgressModel.count({
        where: {
          userId,
          isFinished: true,
          [Database.sequelize.Op.and]: Database.sequelize.where(
            Database.sequelize.fn('DATE', Database.sequelize.col('createdAt')),
            '=',
            Database.sequelize.fn('DATE', Database.sequelize.col('finishedAt'))
          )
        }
      })
      return count > 0
    } catch (error) {
      Logger.error('[AchievementAdapter] Error checking speed reader:', error)
      return false
    }
  },
  
  /**
   * Test unlock an achievement (admin only)
   * @param {string} userId - The user ID
   * @param {string} achievementKey - Achievement key to unlock
   * @returns {Promise<Object>} - The unlocked achievement
   */
  async testUnlockAchievement(userId, achievementKey) {
    try {
      const achievement = await Database.achievementModel.findOne({
        where: { key: achievementKey }
      })
      
      if (!achievement) {
        throw new Error(`Achievement with key ${achievementKey} not found`)
      }
      
      let userAchievement = await Database.userAchievementModel.findOne({
        where: {
          userId,
          achievementId: achievement.id
        },
        include: [{
          model: Database.achievementModel,
          as: 'achievement'
        }]
      })
      
      if (!userAchievement) {
        userAchievement = await Database.userAchievementModel.create({
          userId,
          achievementId: achievement.id,
          progress: 0,
          isUnlocked: false
        })
        
        userAchievement = await Database.userAchievementModel.findOne({
          where: {
            id: userAchievement.id
          },
          include: [{
            model: Database.achievementModel,
            as: 'achievement'
          }]
        })
      }
      
      await userAchievement.updateProgress(userAchievement.achievement.targetValue)
      
      return userAchievement
    } catch (error) {
      Logger.error('[AchievementAdapter] Error test unlocking achievement:', error)
      throw error
    }
  }
}

module.exports = AchievementAdapter
