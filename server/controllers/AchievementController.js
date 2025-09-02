const Logger = require('../Logger')
const Database = require('../Database')
const AchievementManager = require('../managers/AchievementManager')
const SocketAuthority = require('../SocketAuthority')

class AchievementController {
  constructor() {}

  /**
   * GET: /api/achievements
   * Get all achievements with user progress
   */
  async getAllAchievements(req, res) {
    try {
      const achievements = await AchievementManager.getUserAchievements(req.user.id)
      res.json({
        achievements: achievements.sort((a, b) => {
          // Sort by category, then by target value
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category)
          }
          return a.targetValue - b.targetValue
        })
      })
    } catch (error) {
      Logger.error('[AchievementController] Failed to get achievements:', error)
      return res.status(500).send('Failed to get achievements')
    }
  }

  /**
   * GET: /api/achievements/unlocked
   * Get user's unlocked achievements only
   */
  async getUnlockedAchievements(req, res) {
    try {
      const unlockedAchievements = await AchievementManager.getUserUnlockedAchievements(req.user.id)
      res.json({
        achievements: unlockedAchievements
      })
    } catch (error) {
      Logger.error('[AchievementController] Failed to get unlocked achievements:', error)
      return res.status(500).send('Failed to get unlocked achievements')
    }
  }

  /**
   * POST: /api/achievements/check
   * Manually check for new achievements
   */
  async checkAchievements(req, res) {
    try {
      const userId = req.user.id

      const newAchievements = await AchievementManager.checkAllAchievements(userId)

      if (newAchievements.length > 0) {
        Logger.info(`[AchievementController] User ${userId} unlocked ${newAchievements.length} new achievements`)

        // Emit socket events for each new achievement
        for (const achievement of newAchievements) {
          SocketAuthority.emitter('achievement_unlocked', {
            userId,
            achievement: achievement
          })
        }
      }

      res.json({
        newAchievements: newAchievements,
        message: newAchievements.length > 0 ? `Unlocked ${newAchievements.length} new achievement(s)!` : 'No new achievements unlocked'
      })
    } catch (error) {
      Logger.error('[AchievementController] Error checking achievements:', error)
      res.status(500).json({ error: 'Failed to check achievements' })
    }
  }

  /**
   * POST: /api/achievements/test-unlock
   * Test endpoint to manually unlock achievements for demonstration
   */
  async testUnlock(req, res) {
    try {
      if (!req.user.isAdminOrUp) {
        return res.status(403).json({ error: 'Admin access required' })
      }

      const userId = req.user.id
      const { achievementKey } = req.body

      if (!achievementKey) {
        return res.status(400).json({ error: 'Achievement key required' })
      }

      // Find the achievement
      const achievement = await Database.achievementModel.findOne({
        where: { key: achievementKey, isActive: true }
      })

      if (!achievement) {
        return res.status(404).json({ error: 'Achievement not found' })
      }

      // Check if already unlocked
      const existingUserAchievement = await Database.userAchievementModel.findOne({
        where: { userId, achievementId: achievement.id }
      })

      if (existingUserAchievement && existingUserAchievement.isUnlocked) {
        return res.status(400).json({ error: 'Achievement already unlocked' })
      }

      // Unlock the achievement
      let userAchievement
      if (existingUserAchievement) {
        await existingUserAchievement.unlock()
        userAchievement = existingUserAchievement
      } else {
        userAchievement = await Database.userAchievementModel.create({
          userId,
          achievementId: achievement.id,
          progress: achievement.targetValue,
          isUnlocked: true,
          unlockedAt: new Date()
        })
      }

      await userAchievement.reload({ include: [Database.achievementModel] })

      Logger.info(`[AchievementController] Test unlocked achievement "${achievement.name}" for user ${userId}`)

      // Emit socket event
      SocketAuthority.emitter('achievement_unlocked', {
        userId,
        achievement: userAchievement.toJSON()
      })

      res.json({
        achievement: userAchievement.toJSON(),
        message: `Successfully unlocked "${achievement.name}"!`
      })
    } catch (error) {
      Logger.error('[AchievementController] Error test unlocking achievement:', error)
      res.status(500).json({ error: 'Failed to test unlock achievement' })
    }
  }

  /**
   * GET: /api/achievements/stats
   * Get user statistics for achievements
   */
  async getAchievementStats(req, res) {
    try {
      const stats = await AchievementManager.getUserStats(req.user.id)
      const allAchievements = await AchievementManager.getUserAchievements(req.user.id)

      const unlockedCount = allAchievements.filter((a) => a.isUnlocked).length
      const totalCount = allAchievements.length
      const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0

      res.json({
        stats: {
          ...stats,
          unlockedAchievements: unlockedCount,
          totalAchievements: totalCount,
          completionPercent,
          // Add UI-expected property names
          unlockedCount: unlockedCount,
          completionRate: completionPercent / 100,
          booksCompleted: stats.finishedBooksCount || 0,
          totalListeningMinutes: stats.totalListeningTime || 0
        }
      })
    } catch (error) {
      Logger.error('[AchievementController] Failed to get achievement stats:', error)
      return res.status(500).send('Failed to get achievement stats')
    }
  }

  /**
   * GET: /api/achievements/categories
   * Get achievements grouped by category
   */
  async getAchievementsByCategory(req, res) {
    try {
      const achievements = await AchievementManager.getUserAchievements(req.user.id)

      const categorized = achievements.reduce((acc, achievement) => {
        if (!acc[achievement.category]) {
          acc[achievement.category] = []
        }
        acc[achievement.category].push(achievement)
        return acc
      }, {})

      // Sort achievements within each category by target value
      Object.keys(categorized).forEach((category) => {
        categorized[category].sort((a, b) => a.targetValue - b.targetValue)
      })

      res.json({
        categories: categorized
      })
    } catch (error) {
      Logger.error('[AchievementController] Failed to get achievements by category:', error)
      return res.status(500).send('Failed to get achievements by category')
    }
  }

  /**
   * GET: /api/achievements/recent
   * Get recently unlocked achievements (last 30 days)
   */
  async getRecentAchievements(req, res) {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentAchievements = await AchievementManager.getUserUnlockedAchievements(req.user.id)
      const filtered = recentAchievements.filter((ua) => new Date(ua.unlockedAt) >= thirtyDaysAgo)

      res.json({
        achievements: filtered
      })
    } catch (error) {
      Logger.error('[AchievementController] Failed to get recent achievements:', error)
      return res.status(500).send('Failed to get recent achievements')
    }
  }

  /**
   * GET: /api/achievements/progress
   * Get achievements showing progress toward next unlock
   */
  async getAchievementProgress(req, res) {
    try {
      const achievements = await AchievementManager.getUserAchievements(req.user.id)

      // Filter to show only achievements that are in progress (not unlocked, but have some progress)
      const inProgress = achievements.filter((a) => !a.isUnlocked && a.userProgress > 0)

      // Also include next achievements in each category
      const categories = ['reading', 'listening', 'streak', 'diversity', 'milestone']
      const nextAchievements = []

      for (const category of categories) {
        const categoryAchievements = achievements.filter((a) => a.category === category && !a.isUnlocked).sort((a, b) => a.targetValue - b.targetValue)

        if (categoryAchievements.length > 0) {
          nextAchievements.push(categoryAchievements[0])
        }
      }

      // Combine and deduplicate
      const progressAchievements = [...inProgress]
      nextAchievements.forEach((next) => {
        if (!progressAchievements.find((p) => p.id === next.id)) {
          progressAchievements.push(next)
        }
      })

      res.json({
        achievements: progressAchievements.sort((a, b) => b.progressPercent - a.progressPercent)
      })
    } catch (error) {
      Logger.error('[AchievementController] Failed to get achievement progress:', error)
      return res.status(500).send('Failed to get achievement progress')
    }
  }
}

module.exports = new AchievementController()
