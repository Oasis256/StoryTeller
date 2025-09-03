const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const path = require('path')

/**
 * Run achievement system migrations
 */
async function runAchievementMigrations() {
  Logger.info('[Achievement Migration] Running achievement migrations')
  
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations', 'achievement')
    
    // Check if directory exists
    if (!(await fs.pathExists(migrationsDir))) {
      Logger.info('[Achievement Migration] No achievement migrations directory found')
      return
    }
    
    // Get all migration files
    const files = await fs.readdir(migrationsDir)
    
    // Filter for JavaScript files and sort them
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort()
    
    // Execute each migration
    for (const file of migrationFiles) {
      Logger.info(`[Achievement Migration] Running migration: ${file}`)
      
      try {
        const migration = require(path.join(migrationsDir, file))
        
        if (typeof migration.migrate === 'function') {
          await migration.migrate()
          Logger.info(`[Achievement Migration] Successfully ran migration: ${file}`)
        } else {
          Logger.warn(`[Achievement Migration] Migration ${file} does not have a migrate function`)
        }
      } catch (error) {
        Logger.error(`[Achievement Migration] Failed to run migration ${file}:`, error)
        throw error
      }
    }
    
    Logger.info('[Achievement Migration] Successfully completed all achievement migrations')
  } catch (error) {
    Logger.error('[Achievement Migration] Failed to run achievement migrations:', error)
    throw error
  }
}

module.exports = { runAchievementMigrations }
