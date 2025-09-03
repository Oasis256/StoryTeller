// check-achievement-stats.js
// Script to check the achievement stats for a user

const Database = require('./server/Database')
const Logger = require('./server/Logger')
const AchievementAdapter = require('./server/services/achievementAdapter')
const Path = require('path')

// Set necessary environment variables for database initialization
const devEnv = require('./dev').config
process.env.CONFIG_PATH = devEnv.ConfigPath
process.env.METADATA_PATH = devEnv.MetadataPath

const CONFIG_PATH = process.env.CONFIG_PATH

async function main() {
  try {
    // Initialize database
    Logger.info(`Initializing database at ${CONFIG_PATH}...`)
    global.appRoot = __dirname
    await Database.init(CONFIG_PATH)
    Logger.info('Database initialized')

    // Get the first user
    const user = await Database.userModel.findOne()
    if (!user) {
      Logger.error('No users found in database')
      process.exit(1)
    }

    Logger.info(`Checking achievement stats for user: ${user.username} (${user.id})`)

    // Get achievement stats
    const stats = await AchievementAdapter.getUserAchievementStats(user.id)
    
    console.log('\n=== Achievement Stats ===')
    console.log(`Total Achievements: ${stats.totalAchievements}`)
    console.log(`Unlocked Achievements: ${stats.unlockedAchievements}`)
    console.log(`Completion Rate: ${(stats.completionRate * 100).toFixed(1)}%`)
    console.log(`Total Listening Minutes: ${stats.totalListeningMinutes}`)
    console.log(`Books Completed: ${stats.booksCompleted}`)
    console.log(`Current Streak: ${stats.currentStreak}`)
    console.log('=========================\n')

    // Get all achievements
    const achievements = await AchievementAdapter.getAllAchievements(user.id)
    const unlocked = achievements.filter(a => a.isUnlocked)
    
    console.log(`User has ${unlocked.length} unlocked achievements`)

    // Show some sample achievements with progress
    console.log('\n=== Sample Achievements ===')
    for (let i = 0; i < Math.min(5, achievements.length); i++) {
      const a = achievements[i]
      console.log(`${a.name} (${a.key}): Progress ${a.userProgress}/${a.targetValue} (${a.progressPercent}%), Unlocked: ${a.isUnlocked}`)
    }

    Logger.info('Achievement stats check completed')
    process.exit(0)
  } catch (error) {
    Logger.error('Error checking achievement stats:', error)
    process.exit(1)
  }
}

main()
