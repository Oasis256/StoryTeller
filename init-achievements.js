/**
 * Script to initialize achievements for the application
 */

const path = require('path')
const Database = require('./server/Database')
const Logger = require('./server/Logger')
const achievementService = require('./server/services/achievements')

// Set up logger
Logger.level = 'debug'

// Set up necessary paths for Database initialization
const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config')
const metadataPath = process.env.METADATA_PATH || path.join(process.cwd(), 'metadata')

async function initializeAchievements() {
  try {
    console.log('Initializing database...')
    await Database.init({
      configPath: configPath,
      metadataPath: metadataPath,
      dbPath: path.join(configPath, 'absdatabase.sqlite')
    })
    
    console.log('Ensuring achievement definitions...')
    const achievements = achievementService.DEFINITIONS || []
    
    // Create achievement definitions
    for (const achievementDef of achievements) {
      const existingAchievement = await Database.achievementModel.findOne({
        where: { key: achievementDef.key }
      })
      
      if (!existingAchievement) {
        console.log(`Creating achievement definition: ${achievementDef.key}`)
        await Database.achievementModel.create({
          key: achievementDef.key,
          name: achievementDef.name,
          description: achievementDef.description,
          badgeIcon: achievementDef.icon,
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
      } else {
        console.log(`Achievement definition already exists: ${achievementDef.key}`)
      }
    }
    
    // Find the root user
    const adminUser = await Database.userModel.findOne({
      where: { type: 'admin' }
    })
    
    if (!adminUser) {
      console.log('No admin user found.')
      return
    }
    
    console.log(`Found admin user: ${adminUser.username} (${adminUser.id})`)
    
    // Create user achievement entries
    const allAchievements = await Database.achievementModel.findAll()
    console.log(`Found ${allAchievements.length} achievement definitions.`)
    
    for (const achievement of allAchievements) {
      const existingUserAchievement = await Database.userAchievementModel.findOne({
        where: {
          userId: adminUser.id,
          achievementId: achievement.id
        }
      })
      
      if (!existingUserAchievement) {
        console.log(`Creating user achievement entry for: ${achievement.key}`)
        await Database.userAchievementModel.create({
          userId: adminUser.id,
          achievementId: achievement.id,
          progress: 0,
          isUnlocked: false
        })
      } else {
        console.log(`User achievement entry already exists for: ${achievement.key}`)
      }
    }
    
    console.log('Initialization complete.')
  } catch (error) {
    console.error('Error initializing achievements:', error)
  } finally {
    // Close database connection if it was initialized
    if (Database.sequelize) {
      await Database.sequelize.close()
    }
    process.exit(0)
  }
}

// Run the initialization function
initializeAchievements()
