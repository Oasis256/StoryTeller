const Logger = require('../Logger')
const Database = require('../Database')
const { Op } = require('sequelize')
const { getUserListeningStats, computeStreakFromDays, deriveDiversityCountsFromSessions } = require('../utils/listeningStats')

// Source of truth: curated stats; units are seconds there. We adapt to minutes where needed.
const DEFINITIONS = [
  { 
    key: 'first_book', 
    name: 'First Steps', 
    description: 'Complete your first audiobook', 
    icon: 'book-open', 
    color: '#10b981', 
    badgeImage: '/achievements/first_book.svg',
    category: 'reading', 
    targetValue: 1, 
    targetUnit: 'books',
    rarity: 'common',
    xpValue: 10,
    unlockMessage: "You've started your audiobook journey! Keep going!"
  },
  { 
    key: 'bookworm', 
    name: 'Bookworm', 
    description: 'Complete 10 audiobooks', 
    icon: 'academic-cap', 
    color: '#3b82f6',
    badgeImage: '/achievements/bookworm.svg', 
    category: 'reading', 
    targetValue: 10, 
    targetUnit: 'books',
    rarity: 'uncommon',
    xpValue: 25,
    unlockMessage: "Your appetite for books is growing! Great work!"
  },
  { 
    key: 'library_master', 
    name: 'Library Master', 
    description: 'Complete 50 audiobooks', 
    icon: 'library', 
    color: '#8b5cf6',
    badgeImage: '/achievements/library_master.svg', 
    category: 'reading', 
    targetValue: 50, 
    targetUnit: 'books',
    rarity: 'rare',
    xpValue: 100,
    unlockMessage: "You've mastered your library with 50 completed books!"
  },
  { 
    key: 'bibliophile', 
    name: 'Bibliophile', 
    description: 'Complete 100 audiobooks', 
    icon: 'star', 
    color: '#f59e0b',
    badgeImage: '/achievements/bibliophile.svg', 
    category: 'reading', 
    targetValue: 100, 
    targetUnit: 'books',
    rarity: 'epic',
    xpValue: 250,
    unlockMessage: "100 books! You're truly a bibliophile!"
  },
  { 
    key: 'first_hour', 
    name: 'Getting Started', 
    description: 'Listen for 1 hour total', 
    icon: 'clock', 
    color: '#06b6d4',
    badgeImage: '/achievements/first_hour.svg', 
    category: 'listening', 
    targetValue: 60, 
    targetUnit: 'minutes',
    rarity: 'common',
    xpValue: 5,
    unlockMessage: "Your first hour of listening is complete! Many more await!"
  },
  { 
    key: 'dedicated_listener', 
    name: 'Dedicated Listener', 
    description: 'Listen for 24 hours total', 
    icon: 'volume-up', 
    color: '#ec4899',
    badgeImage: '/achievements/dedicated_listener.svg', 
    category: 'listening', 
    targetValue: 1440, 
    targetUnit: 'minutes',
    rarity: 'uncommon',
    xpValue: 50,
    unlockMessage: "You've spent an entire day listening to audiobooks!"
  },
  { 
    key: 'audio_enthusiast', 
    name: 'Audio Enthusiast', 
    description: 'Listen for 100 hours total', 
    icon: 'headphones', 
    color: '#f97316',
    badgeImage: '/achievements/audio_enthusiast.svg', 
    category: 'listening', 
    targetValue: 6000, 
    targetUnit: 'minutes',
    rarity: 'rare',
    xpValue: 150,
    unlockMessage: "100 hours! Your ears must be very happy!"
  },
  { 
    key: 'listening_legend', 
    name: 'Listening Legend', 
    description: 'Listen for 500 hours total', 
    icon: 'fire', 
    color: '#dc2626',
    badgeImage: '/achievements/listening_legend.svg', 
    category: 'listening', 
    targetValue: 30000, 
    targetUnit: 'minutes',
    rarity: 'legendary',
    xpValue: 500,
    unlockMessage: "You are now a listening legend with 500 hours!"
  },
  { 
    key: 'weekend_warrior', 
    name: 'Weekend Warrior', 
    description: 'Listen for 2 consecutive days', 
    icon: 'calendar', 
    color: '#059669',
    badgeImage: '/achievements/weekend_warrior.svg', 
    category: 'streak', 
    targetValue: 2, 
    targetUnit: 'days',
    rarity: 'common',
    xpValue: 15,
    unlockMessage: "Two days in a row! Keep the streak alive!"
  },
  { 
    key: 'week_streaker', 
    name: 'Week Streaker', 
    description: 'Listen for 7 consecutive days', 
    icon: 'trending-up', 
    color: '#7c3aed',
    badgeImage: '/achievements/week_streaker.svg', 
    category: 'streak', 
    targetValue: 7, 
    targetUnit: 'days',
    rarity: 'uncommon',
    xpValue: 75,
    unlockMessage: "A whole week of daily listening! Fantastic habit!"
  },
  { 
    key: 'habit_former', 
    name: 'Habit Former', 
    description: 'Listen for 30 consecutive days', 
    icon: 'check-circle', 
    color: '#f59e0b',
    badgeImage: '/achievements/habit_former.svg', 
    category: 'streak', 
    targetValue: 30, 
    targetUnit: 'days',
    rarity: 'epic',
    xpValue: 300,
    unlockMessage: "Thirty days straight! You've formed a lasting habit!"
  },
  { 
    key: 'genre_explorer', 
    name: 'Genre Explorer', 
    description: 'Listen to books from 5 different genres', 
    icon: 'collection', 
    color: '#8b5cf6',
    badgeImage: '/achievements/genre_explorer.svg', 
    category: 'diversity', 
    targetValue: 5, 
    targetUnit: 'genres',
    rarity: 'uncommon',
    xpValue: 50,
    unlockMessage: "You've explored 5 different genres! So versatile!"
  },
  { 
    key: 'author_hunter', 
    name: 'Author Hunter', 
    description: 'Listen to books from 20 different authors', 
    icon: 'users', 
    color: '#06b6d4',
    badgeImage: '/achievements/author_hunter.svg', 
    category: 'diversity', 
    targetValue: 20, 
    targetUnit: 'authors',
    rarity: 'rare',
    xpValue: 100,
    unlockMessage: "20 different authors! You really get around!"
  },
  { 
    key: 'speed_reader', 
    name: 'Speed Reader', 
    description: 'Complete a book in one day', 
    icon: 'lightning-bolt', 
    color: '#eab308',
    badgeImage: '/achievements/speed_reader.svg', 
    category: 'milestone', 
    targetValue: 1, 
    targetUnit: 'books',
    rarity: 'uncommon',
    xpValue: 75,
    unlockMessage: "Wow! A whole book in one day! Fast reader!"
  },
  { 
    key: 'marathon_listener', 
    name: 'Marathon Listener', 
    description: 'Listen for 8 hours in a single day', 
    icon: 'chart-bar', 
    color: '#ef4444',
    badgeImage: '/achievements/marathon_listener.svg', 
    category: 'milestone', 
    targetValue: 480, 
    targetUnit: 'minutes',
    rarity: 'rare',
    xpValue: 125,
    unlockMessage: "Eight hours in one day! That's marathon listening!"
  },
  {
    key: 'night_owl',
    name: 'Night Owl',
    description: 'Listen to audiobooks after midnight for 3 different days',
    icon: 'moon',
    color: '#4B5563',
    badgeImage: '/achievements/night_owl.svg',
    category: 'milestone',
    targetValue: 3,
    targetUnit: 'days',
    rarity: 'uncommon',
    xpValue: 50,
    isSecret: true,
    unlockMessage: "You've been caught listening after midnight! Night owl!"
  },
  {
    key: 'series_completer',
    name: 'Series Completer',
    description: 'Complete all books in a series with at least 3 books',
    icon: 'collection',
    color: '#7E22CE',
    badgeImage: '/achievements/series_completer.svg',
    category: 'milestone',
    targetValue: 1,
    targetUnit: 'series',
    rarity: 'rare',
    xpValue: 150,
    unlockMessage: "You've completed an entire series! So dedicated!"
  }
]

async function seed() {
  const model = Database.achievementDefModel
  if (!model) {
    Logger.error('[Achievements] Definition model missing')
    return
  }
  for (const def of DEFINITIONS) {
    const exists = await model.findOne({ where: { key: def.key } })
    if (!exists) await model.create(def)
  }
}

async function computeStats(userId) {
  const stats = await getUserListeningStats(userId) // seconds-based
  const finishedBooksCount = await Database.mediaProgressModel.count({ where: { userId, isFinished: true, mediaItemType: 'book' } })
  const totalListeningMinutes = Math.round((stats.totalTime || 0) / 60)
  const currentStreak = computeStreakFromDays(stats.days)
  const { authorCount, genreCount } = deriveDiversityCountsFromSessions(stats.sessions)
  const dailyMinutes = Object.fromEntries(Object.entries(stats.days).map(([k, v]) => [k, Math.round((v || 0) / 60)]))
  return { finishedBooksCount, totalListeningMinutes, currentStreak, authorCount, genreCount, dailyMinutes }
}

function progressFor(def, userStats) {
  switch (def.category) {
    case 'reading':
      return userStats.finishedBooksCount || 0
    case 'listening':
      return userStats.totalListeningMinutes || 0
    case 'streak':
      return userStats.currentStreak || 0
    case 'diversity':
      if (def.targetUnit === 'genres') return userStats.genreCount || 0
      if (def.targetUnit === 'authors') return userStats.authorCount || 0
      return 0
    case 'milestone':
      if (def.key === 'marathon_listener') {
        const vals = Object.values(userStats.dailyMinutes || {})
        return vals.length ? Math.max(...vals) : 0
      }
      if (def.key === 'speed_reader') return 0 // derived at unlock-time only
      return 0
    default:
      return 0
  }
}

async function checkSpeedReader(userId) {
  const count = await Database.mediaProgressModel.count({
    where: {
      userId,
      isFinished: true,
      mediaItemType: 'book',
      [Op.and]: Database.sequelize.where(Database.sequelize.fn('DATE', Database.sequelize.col('createdAt')), '=', Database.sequelize.fn('DATE', Database.sequelize.col('finishedAt')))
    }
  })
  return count > 0
}

async function getForUser(userId) {
  const [defs, userStats, unlocked] = await Promise.all([Database.achievementDefModel.findAll({ where: { isActive: true } }), computeStats(userId), Database.userAchievementUnlockModel.findAll({ where: { userId } })])
  const unlockedSet = new Set(unlocked.map((u) => u.achievementId))
  return defs.map((d) => {
    const prog = progressFor(d, userStats)
    const reached = prog >= (d.targetValue || 1)
    const isUnlocked = unlockedSet.has(d.id) || (d.key === 'speed_reader' ? false : reached)
    const progressPercent = Math.min(100, Math.round(((prog || 0) / (d.targetValue || 1)) * 100))
    return { ...d.toJSON(), userProgress: prog, isUnlocked, progressPercent }
  })
}

// User levels and XP requirements
const LEVEL_XP_REQUIREMENTS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  1000,   // Level 5
  1750,   // Level 6
  2750,   // Level 7
  4000,   // Level 8
  5500,   // Level 9
  7500,   // Level 10
  10000,  // Level 11
  12500,  // Level 12
  15000,  // Level 13
  17500,  // Level 14
  20000,  // Level 15
  25000,  // Level 16
  30000,  // Level 17
  40000,  // Level 18
  50000,  // Level 19
  75000   // Level 20
]

// Level rewards (could be unlocked features, badges, etc.)
const LEVEL_REWARDS = {
  5: { type: 'feature', id: 'custom_themes', name: 'Custom Themes' },
  10: { type: 'badge', id: 'veteran_listener', name: 'Veteran Listener' },
  15: { type: 'feature', id: 'extended_stats', name: 'Extended Statistics' },
  20: { type: 'badge', id: 'master_listener', name: 'Master Listener' }
}

/**
 * Calculate user level based on total XP
 * 
 * @param {number} totalXP - User's total XP
 * @returns {Object} - Level information
 */
function calculateUserLevel(totalXP) {
  let level = 1
  let xpForNextLevel = LEVEL_XP_REQUIREMENTS[level] || Infinity
  
  // Find the highest level where the XP requirement is less than or equal to the user's XP
  while (level < LEVEL_XP_REQUIREMENTS.length && totalXP >= LEVEL_XP_REQUIREMENTS[level]) {
    level++
    xpForNextLevel = LEVEL_XP_REQUIREMENTS[level] || Infinity
  }
  
  // Calculate progress to next level
  const xpForCurrentLevel = LEVEL_XP_REQUIREMENTS[level - 1] || 0
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel
  const xpProgressToNextLevel = totalXP - xpForCurrentLevel
  const percentToNextLevel = xpNeededForNextLevel > 0 ? Math.min(100, Math.round((xpProgressToNextLevel / xpNeededForNextLevel) * 100)) : 100
  
  // Check if the user receives any rewards at this level
  const reward = LEVEL_REWARDS[level] || null
  
  return {
    level,
    totalXP,
    xpForCurrentLevel,
    xpForNextLevel,
    xpProgressToNextLevel,
    percentToNextLevel,
    reward
  }
}

/**
 * Get user XP and level information
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User XP and level info
 */
async function getUserXPAndLevel(userId) {
  // Get total XP from unlocked achievements
  const totalXP = await Database.userAchievementUnlockModel.sum('xpEarned', {
    where: { userId }
  }) || 0
  
  return calculateUserLevel(totalXP)
}

async function recomputeAndPersistUnlocks(userId) {
  const [defs, stats] = await Promise.all([Database.achievementDefModel.findAll({ where: { isActive: true } }), computeStats(userId)])
  const unlockedRows = await Database.userAchievementUnlockModel.findAll({ where: { userId } })
  const unlockedSet = new Set(unlockedRows.map((u) => u.achievementId))

  const newly = []
  let totalXPEarned = 0
  
  for (const d of defs) {
    let reached = progressFor(d, stats) >= (d.targetValue || 1)
    if (!reached && d.key === 'speed_reader') reached = await checkSpeedReader(userId)
    if (reached && !unlockedSet.has(d.id)) {
      // Calculate XP to award based on achievement rarity
      const xpEarned = d.xpValue || calculateXPByRarity(d.rarity)
      totalXPEarned += xpEarned
      
      // Create achievement unlock record with XP
      const row = await Database.userAchievementUnlockModel.create({ 
        userId, 
        achievementId: d.id,
        xpEarned
      })
      
      // Build achievement payload
      const payload = { 
        ...d.toJSON(), 
        unlockedAt: row.unlockedAt, 
        isUnlocked: true, 
        userProgress: d.targetValue, 
        progressPercent: 100,
        xpEarned
      }
      
      newly.push(payload)
      
      try {
        const SocketAuthority = require('../SocketAuthority')
        // Emit achievement unlocked event
        SocketAuthority.clientEmitter(userId, 'achievement_unlocked', { 
          userId, 
          achievement: payload,
          xpEarned
        })
      } catch (e) {
        Logger.error('[Achievements] failed to emit socket achievement_unlocked', e)
      }
    }
  }
  
  // If XP was earned, recalculate user level
  if (totalXPEarned > 0) {
    const levelInfo = await getUserXPAndLevel(userId)
    
    try {
      const SocketAuthority = require('../SocketAuthority')
      // Emit XP update event
      SocketAuthority.clientEmitter(userId, 'xp_updated', { 
        userId, 
        xpEarned: totalXPEarned,
        levelInfo
      })
    } catch (e) {
      Logger.error('[Achievements] failed to emit socket xp_updated', e)
    }
  }
  
  return {
    newAchievements: newly,
    xpEarned: totalXPEarned
  }
}

/**
 * Calculate XP for an achievement based on rarity
 * 
 * @param {string} rarity - Achievement rarity
 * @returns {number} - XP value
 */
function calculateXPByRarity(rarity) {
  switch (rarity) {
    case 'common':
      return 10
    case 'uncommon':
      return 50
    case 'rare':
      return 100
    case 'epic':
      return 250
    case 'legendary':
      return 500
    default:
      return 10
  }
}

module.exports = { 
  seed, 
  getForUser, 
  recomputeAndPersistUnlocks, 
  computeStats,
  getUserXPAndLevel,
  calculateUserLevel,
  LEVEL_XP_REQUIREMENTS,
  LEVEL_REWARDS
}
