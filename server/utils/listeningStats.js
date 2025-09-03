const Database = require('../Database')

/**
 * Build listening stats for a user from playback sessions.
 * Mirrors ApiRouter.getUserListeningStatsHelpers but is reusable from services/managers.
 *
 * @param {string} userId
 */
async function getUserListeningStats(userId) {
  const sessions = await Database.getPlaybackSessions({ userId })

  const todayStr = new Date().toISOString().slice(0, 10)

  const stats = {
    totalTime: 0,
    items: {},
    days: {},
    dayOfWeek: {},
    today: 0,
    recentSessions: sessions.slice(0, 10)
  }

  for (const s of sessions) {
    let sessionTimeListening = s.timeListening
    if (typeof sessionTimeListening === 'string') sessionTimeListening = Number(sessionTimeListening)

    if (s.dayOfWeek) {
      stats.dayOfWeek[s.dayOfWeek] = (stats.dayOfWeek[s.dayOfWeek] || 0) + sessionTimeListening
    }

    if (s.date && sessionTimeListening > 0) {
      stats.days[s.date] = (stats.days[s.date] || 0) + sessionTimeListening
      if (s.date === todayStr) stats.today += sessionTimeListening
    }

    if (!stats.items[s.libraryItemId]) {
      stats.items[s.libraryItemId] = {
        id: s.libraryItemId,
        timeListening: sessionTimeListening,
        mediaMetadata: s.mediaMetadata,
        lastUpdate: s.lastUpdate
      }
    } else {
      stats.items[s.libraryItemId].timeListening += sessionTimeListening
    }

    stats.totalTime += sessionTimeListening
  }

  return { ...stats, sessions }
}

/**
 * Compute a conservative listening streak based on per-day totals.
 * Days are considered listened if total >= minDailySeconds (default 300s = 5 minutes).
 *
 * @param {Record<string, number>} daysMap YYYY-MM-DD -> seconds
 * @param {number} minDailySeconds
 */
function computeStreakFromDays(daysMap, minDailySeconds = 300) {
  const keys = Object.keys(daysMap)
  if (!keys.length) return 0

  const listened = new Set(keys.filter((d) => (daysMap[d] || 0) >= minDailySeconds))
  if (!listened.size) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start from today if listened, else from yesterday
  let cursor = new Date(today)
  const todayKey = cursor.toISOString().slice(0, 10)
  if (!listened.has(todayKey)) cursor.setDate(cursor.getDate() - 1)

  // Walk backward while days qualify
  // Guard against infinite loop with a reasonable cap
  for (let i = 0; i < 366 * 5; i++) {
    const key = cursor.toISOString().slice(0, 10)
    if (listened.has(key)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

/**
 * Derive unique counts for authors and genres from playback session metadata.
 * Filters out bad genres like "audiobook" and "audio book".
 *
 * @param {Array<{ mediaMetadata?: any, mediaItemType?: string }>} sessions
 */
function deriveDiversityCountsFromSessions(sessions = []) {
  const authorSet = new Set()
  const genreSet = new Set()

  for (const s of sessions) {
    if (s.mediaItemType !== 'book') continue

    const authors = s.mediaMetadata?.authors || []
    for (const au of authors) {
      const name = typeof au === 'string' ? au : au?.name
      if (name) authorSet.add(name)
    }

    const genres = (s.mediaMetadata?.genres || []).filter((g) => g && !g.toLowerCase().includes('audiobook') && !g.toLowerCase().includes('audio book'))
    for (const g of genres) genreSet.add(g)
  }

  return { authorCount: authorSet.size, genreCount: genreSet.size }
}

module.exports = {
  getUserListeningStats,
  computeStreakFromDays,
  deriveDiversityCountsFromSessions
}
