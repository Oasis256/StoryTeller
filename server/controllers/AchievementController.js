const { Response } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')
const AchievementManager = require('../managers/AchievementManager')
const achievementService = require('../services/achievements')
const achievementAdapter = require('../services/achievementAdapter')

/**
 * Controller for achievement-related endpoints
 */
class AchievementController {
  constructor() {}
  
  /**
   * Register achievement routes
   * 
   * @param {express.Router} router - Express router
   */
  registerRoutes(router) {
    // Routes accessible to authenticated users
    router.get('/achievements', this.getAllAchievements.bind(this))
    router.get('/achievements/unlocked', this.getUnlockedAchievements.bind(this))
    router.get('/achievements/recent', this.getRecentAchievements.bind(this))
    router.get('/achievements/progress', this.getAchievementProgress.bind(this))
    router.get('/achievements/stats', this.getAchievementStats.bind(this))
    router.post('/achievements/check', this.checkAchievements.bind(this))
    router.post('/achievements/acknowledge/:id', this.acknowledgeAchievement.bind(this))
    router.get('/xp/user-level', this.getUserLevel.bind(this))
    
    // Admin-only routes
    router.post('/achievements/test-unlock', this.testUnlockAchievement.bind(this))
    router.post('/achievements/initialize', this.initializeAchievements.bind(this))
  }
  
  /**
   * GET: /api/achievements
   * Get all achievements
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async getAllAchievements(req, res) {
    try {
      // Use the adapter to get all achievements with user-specific data
      Logger.debug(`[AchievementController] Getting achievements for user: ${req.user.id}`)
      const achievements = await achievementAdapter.getAllAchievements(req.user.id)
      Logger.debug(`[AchievementController] Found ${achievements.length} achievements`)
      
      if (achievements.length > 0) {
        // Log a sample achievement to debug data structure
        Logger.debug(`[AchievementController] Sample achievement: ${JSON.stringify(achievements[0])}`)
      }
      
      res.json({
        achievements: achievements
      })
    } catch (error) {
      Logger.error('[AchievementController] Error getting all achievements:', error)
      res.status(500).send({ error: 'Failed to retrieve achievements' })
    }
  }
  
  /**
   * GET: /api/achievements/unlocked
   * Get user's unlocked achievements
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async getUnlockedAchievements(req, res) {
    try {
      // Use the adapter to get unlocked achievements
      Logger.debug(`[AchievementController] Getting unlocked achievements for user: ${req.user.id}`)
      const achievements = await achievementAdapter.getUnlockedAchievements(req.user.id)
      Logger.debug(`[AchievementController] Found ${achievements.length} unlocked achievements`)
      
      if (achievements.length > 0) {
        // Log a sample achievement to debug data structure
        Logger.debug(`[AchievementController] Sample unlocked achievement: ${JSON.stringify(achievements[0])}`)
      }
      
      res.json({
        achievements: achievements
      })
    } catch (error) {
      Logger.error('[AchievementController] Error getting unlocked achievements:', error)
      res.status(500).send({ error: 'Failed to retrieve unlocked achievements' })
    }
  }
  
  /**
   * GET: /api/achievements/recent
   * Get user's recently unlocked achievements
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async getRecentAchievements(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5
      // Use the adapter to get recent unlocked achievements
      Logger.debug(`[AchievementController] Getting recent achievements for user: ${req.user.id}, limit: ${limit}`)
      const achievements = await achievementAdapter.getRecentUnlockedAchievements(req.user.id, limit)
      Logger.debug(`[AchievementController] Found ${achievements.length} recent achievements`)
      
      if (achievements.length > 0) {
        // Log a sample achievement to debug data structure
        Logger.debug(`[AchievementController] Sample recent achievement: ${JSON.stringify(achievements[0])}`)
      }
      
      res.json({
        achievements: achievements
      })
    } catch (error) {
      Logger.error('[AchievementController] Error getting recent achievements:', error)
      res.status(500).send({ error: 'Failed to retrieve recent achievements' })
    }
  }
  
  /**
   * GET: /api/achievements/progress
   * Get user's achievement progress
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async getAchievementProgress(req, res) {
    try {
      // Use the adapter to get achievement progress
      Logger.debug(`[AchievementController] Getting achievement progress for user: ${req.user.id}`)
      const achievements = await achievementAdapter.getUserAchievementProgress(req.user.id)
      Logger.debug(`[AchievementController] Found progress for ${achievements.length} achievements`)
      
      // Count unlocked achievements
      const unlockedCount = achievements.filter(a => a.isUnlocked).length
      Logger.debug(`[AchievementController] Unlocked achievements in progress data: ${unlockedCount}`)
      
      if (achievements.length > 0) {
        // Log a sample achievement to debug data structure
        Logger.debug(`[AchievementController] Sample achievement progress: ${JSON.stringify(achievements[0])}`)
      }
      
      res.json({
        achievements: achievements
      })
    } catch (error) {
      Logger.error('[AchievementController] Error getting achievement progress:', error)
      res.status(500).send({ error: 'Failed to retrieve achievement progress' })
    }
  }
  
  /**
   * GET: /api/achievements/stats
   * Get user's achievement stats
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async getAchievementStats(req, res) {
    try {
      // Use the adapter to get achievement stats
      Logger.debug(`[AchievementController] Getting stats for user: ${req.user.id}`)
      const stats = await achievementAdapter.getUserAchievementStats(req.user.id)
      
      // Log the stats being returned
      Logger.debug(`[AchievementController] Stats response: ${JSON.stringify(stats)}`)
      
      // Debug check for unlocked achievements count
      if (stats.unlockedAchievements !== undefined) {
        Logger.debug(`[AchievementController] Unlocked achievements count: ${stats.unlockedAchievements}`)
      } else {
        Logger.warn(`[AchievementController] Missing unlockedAchievements in stats!`)
      }
      
      res.json({
        stats: stats
      })
    } catch (error) {
      Logger.error('[AchievementController] Error getting achievement stats:', error)
      res.status(500).send({ error: 'Failed to retrieve achievement stats' })
    }
  }
  
  /**
   * POST: /api/achievements/check
   * Manually check for new achievements
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async checkAchievements(req, res) {
    try {
      // Use the adapter to update and check achievements
      const result = await achievementAdapter.updateUserAchievements(req.user.id)
      res.json(result)
    } catch (error) {
      Logger.error('[AchievementController] Error checking achievements:', error)
      res.status(500).send({ error: 'Failed to check achievements' })
    }
  }
  
  /**
   * POST: /api/achievements/acknowledge/:id
   * Mark an achievement as acknowledged
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async acknowledgeAchievement(req, res) {
    try {
      const achievementId = req.params.id
      if (!achievementId) {
        return res.status(400).send({ error: 'Achievement ID is required' })
      }
      
      const userAchievement = await Database.userAchievementUnlockModel.findOne({
        where: {
          userId: req.user.id,
          achievementId: achievementId
        }
      })
      
      if (!userAchievement) {
        return res.status(404).send({ error: 'Achievement not found or not unlocked' })
      }
      
      await userAchievement.acknowledge()
      
      res.json({ success: true })
    } catch (error) {
      Logger.error('[AchievementController] Error acknowledging achievement:', error)
      res.status(500).send({ error: 'Failed to acknowledge achievement' })
    }
  }
  
  /**
   * GET: /api/xp/user-level
   * Get user XP and level information
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async getUserLevel(req, res) {
    try {
      const levelInfo = await achievementService.getUserXPAndLevel(req.user.id)
      res.json(levelInfo)
    } catch (error) {
      Logger.error('[AchievementController] Error getting user level info:', error)
      res.status(500).send({ error: 'Failed to retrieve user level information' })
    }
  }

  /**
   * POST: /api/achievements/test-unlock
   * Test unlock an achievement (admin only)
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async testUnlockAchievement(req, res) {
    try {
      // Check if user is admin
      if (req.user.type !== 'admin') {
        return res.status(403).send({ error: 'Only administrators can use this endpoint' })
      }
      
      const { achievementKey } = req.body
      if (!achievementKey) {
        return res.status(400).send({ error: 'Achievement key is required' })
      }
      
      // Use the adapter to test unlock an achievement
      const achievement = await achievementAdapter.testUnlockAchievement(req.user.id, achievementKey)
      res.json({ achievement })
    } catch (error) {
      Logger.error('[AchievementController] Error test unlocking achievement:', error)
      res.status(500).send({ error: error.message || 'Failed to test unlock achievement' })
    }
  }

  /**
   * POST: /api/achievements/initialize
   * Force initialization of achievements (admin only)
   * 
   * @param {import('../routers/ApiRouter').RequestWithUser} req
   * @param {Response} res
   */
  async initializeAchievements(req, res) {
    try {
      // Check if user is admin
      if (req.user.type !== 'admin') {
        return res.status(403).send({ error: 'Only administrators can use this endpoint' })
      }
      
      Logger.debug('[AchievementController] Admin requested achievement initialization')
      
      // Force initialize achievements
      await achievementAdapter.ensureAchievements()
      
      // Create user achievement entries for this user
      const allAchievements = await Database.achievementModel.findAll()
      for (const achievement of allAchievements) {
        const existingUserAchievement = await Database.userAchievementModel.findOne({
          where: {
            userId: req.user.id,
            achievementId: achievement.id
          }
        })
        
        if (!existingUserAchievement) {
          Logger.debug(`[AchievementController] Creating user achievement for ${achievement.key}`)
          await Database.userAchievementModel.create({
            userId: req.user.id,
            achievementId: achievement.id,
            progress: 0,
            isUnlocked: false
          })
        }
      }
      
      // Return achievement count
      const achievementCount = await Database.achievementModel.count()
      const userAchievementCount = await Database.userAchievementModel.count({
        where: { userId: req.user.id }
      })
      
      res.json({
        success: true,
        message: 'Achievements initialized',
        achievementCount,
        userAchievementCount
      })
    } catch (error) {
      Logger.error('[AchievementController] Error initializing achievements:', error)
      res.status(500).send({ error: error.message || 'Failed to initialize achievements' })
    }
  }
}

module.exports = AchievementController
