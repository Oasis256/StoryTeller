const Logger = require('../Logger')
const Database = require('../Database')
const { seed, getForUser, recomputeAndPersistUnlocks, computeStats } = require('../services/achievements')

function presentAchievement(a) {
  // Map service/model fields to client-expected shape
  return {
    ...a,
    badgeIcon: a.badgeIcon || a.icon,
    badgeColor: a.badgeColor || a.color
  }
}

class AchievementsController {
  async list(req, res) {
    try {
      await seed()
      await recomputeAndPersistUnlocks(req.user.id)
      const achievements = await getForUser(req.user.id)
      res.json({ achievements: achievements.map(presentAchievement) })
    } catch (e) {
      Logger.error('[AchievementsController] list failed', e)
      res.status(500).send('Failed to get achievements')
    }
  }

  async stats(req, res) {
    try {
      const stats = await computeStats(req.user.id)
      const all = await getForUser(req.user.id)
      const unlockedCount = all.filter((a) => a.isUnlocked).length
      const completionPercent = all.length ? Math.round((unlockedCount / all.length) * 100) : 0
      res.json({
        stats: {
          ...stats,
          unlockedCount,
          totalAchievements: all.length,
          completionPercent,
          completionRate: completionPercent / 100
        }
      })
    } catch (e) {
      Logger.error('[AchievementsController] stats failed', e)
      res.status(500).send('Failed to get stats')
    }
  }

  async recent(req, res) {
    try {
      // Ensure unlocks are up-to-date
      await seed()
      await recomputeAndPersistUnlocks(req.user.id)

      const since = new Date()
      since.setDate(since.getDate() - 30)

      const rows = await Database.userAchievementUnlockModel.findAll({
        where: { userId: req.user.id },
        order: [['unlockedAt', 'DESC']]
      })
      const ids = Array.from(new Set(rows.map((r) => r.achievementId)))
      const defs = await Database.achievementDefModel.findAll({ where: { id: ids } })
      const defMap = new Map(defs.map((d) => [d.id, d]))

      let achievements = rows
        .map((r) => {
          const d = defMap.get(r.achievementId)
          if (!d) return null
          const base = {
            ...d.toJSON(),
            isUnlocked: true,
            unlockedAt: r.unlockedAt,
            userProgress: d.targetValue,
            progressPercent: 100
          }
          return presentAchievement(base)
        })
        .filter(Boolean)

      const filtered = achievements.filter((a) => new Date(a.unlockedAt) >= since)
      if (filtered.length > 0) achievements = filtered
      // Fallback to most recent 6
      achievements = achievements.slice(0, 6)

      res.json({ achievements })
    } catch (e) {
      Logger.error('[AchievementsController] recent failed', e)
      res.status(500).send('Failed to get recent achievements')
    }
  }

  async progress(req, res) {
    try {
      await seed()
      await recomputeAndPersistUnlocks(req.user.id)
      const all = await getForUser(req.user.id)
      const inProgress = all.filter((a) => !a.isUnlocked && (a.userProgress || 0) > 0)

      const categories = ['reading', 'listening', 'streak', 'diversity', 'milestone']
      const nextByCategory = []
      for (const cat of categories) {
        const next = all.filter((a) => a.category === cat && !a.isUnlocked).sort((a, b) => (a.targetValue || 0) - (b.targetValue || 0))[0]
        if (next) nextByCategory.push(next)
      }

      const combined = [...inProgress]
      nextByCategory.forEach((n) => {
        if (!combined.find((p) => p.id === n.id)) combined.push(n)
      })

      combined.sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0))
      res.json({ achievements: combined.map(presentAchievement) })
    } catch (e) {
      Logger.error('[AchievementsController] progress failed', e)
      res.status(500).send('Failed to get achievement progress')
    }
  }

  async check(req, res) {
    try {
      await seed()
      const newly = await recomputeAndPersistUnlocks(req.user.id)
      res.json({ newAchievements: newly.map(presentAchievement) })
    } catch (e) {
      Logger.error('[AchievementsController] check failed', e)
      res.status(500).send('Failed to check achievements')
    }
  }
}

module.exports = new AchievementsController()
