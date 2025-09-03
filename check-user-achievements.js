/**
 * Test utility to check user achievement records
 */
const path = require('path')
const Database = require('./server/Database')
const Logger = require('./server/Logger')

// Path configuration
const configPath = process.env.CONFIG_PATH || '/home/Oasis/Vault/config/Swag/AudbleTales/Configs/Config'
const metadataPath = process.env.METADATA_PATH || '/home/Oasis/Vault/config/Swag/AudbleTales/Configs/Metadata'

// Set debug log level
Logger.level = 'debug'

// Set global config paths required by Database.js
global.ConfigPath = configPath
global.MetadataPath = metadataPath

async function checkUserAchievements() {
  try {
    // Initialize the database
    console.log('Initializing database...')
    await Database.init()

  // Get any user
    console.log('Looking for users...')
    const users = await Database.userModel.findAll()
    
    if (!users.length) {
      console.log('No users found!')
      return
    }
    
    console.log(`Found ${users.length} users:`)
    users.forEach(user => {
      console.log(`- ${user.username} (${user.id}, type: ${user.type})`)
    })
    
    // Use the first user for testing
    const testUser = users[0]
    console.log(`\nUsing user for testing: ${testUser.username} (${testUser.id})`)    // Check achievement definitions
    console.log('Checking achievement definitions...')
    const achievements = await Database.achievementModel.findAll()
    console.log(`Found ${achievements.length} achievement definitions`)

    // Check user achievements
    console.log('Checking user achievements...')
    const userAchievements = await Database.userAchievementModel.findAll({
      where: { userId: testUser.id },
      include: [
        {
          model: Database.achievementModel,
          as: 'achievement'
        }
      ]
    })

    console.log(`Found ${userAchievements.length} user achievements for ${testUser.username}`)

    // Create missing user achievements
    if (userAchievements.length < achievements.length) {
      console.log('Creating missing user achievements...')
      const userAchievementIds = userAchievements.map((ua) => ua.achievementId)

      for (const achievement of achievements) {
        if (!userAchievementIds.includes(achievement.id)) {
          console.log(`Creating user achievement for: ${achievement.key}`)
          await Database.userAchievementModel.create({
            userId: testUser.id,
            achievementId: achievement.id,
            progress: 0,
            isUnlocked: false
          })
        }
      }

      // Verify again
      const updatedUserAchievements = await Database.userAchievementModel.findAll({
        where: { userId: testUser.id }
      })

      console.log(`Now have ${updatedUserAchievements.length} user achievements for ${testUser.username}`)
    }

    // Print some sample achievements
    console.log('\nSample achievement data:')
    for (let i = 0; i < Math.min(5, userAchievements.length); i++) {
      const ua = userAchievements[i]
      console.log(`- ${ua.achievement?.key || 'Unknown'}: progress=${ua.progress}, isUnlocked=${ua.isUnlocked}`)
    }
  } catch (error) {
    console.error('Error checking user achievements:', error)
  } finally {
    if (Database.sequelize) {
      await Database.sequelize.close()
    }
    process.exit(0)
  }
}

// Run the function
checkUserAchievements()
