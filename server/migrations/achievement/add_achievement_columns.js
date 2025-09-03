const Logger = require('../../Logger')
const Database = require('../../Database')

/**
 * Migration to add new columns to the achievements table
 */
async function migrate() {
  Logger.info('[Migration] Adding new columns to achievements table')
  
  try {
    const db = Database.sequelize
    
    // Check if columns exist before adding
    const tableInfo = await db.query(`PRAGMA table_info(achievements)`)
    const columns = tableInfo[0]
    const columnNames = columns.map(col => col.name)
    
    // Add badgeImage column if it doesn't exist
    if (!columnNames.includes('badgeImage')) {
      Logger.info('[Migration] Adding badgeImage column to achievements table')
      await db.query(`ALTER TABLE achievements ADD COLUMN badgeImage TEXT NULL`)
    }
    
    // Add rarity column if it doesn't exist
    if (!columnNames.includes('rarity')) {
      Logger.info('[Migration] Adding rarity column to achievements table')
      await db.query(`ALTER TABLE achievements ADD COLUMN rarity TEXT DEFAULT 'common'`)
    }
    
    // Add xpValue column if it doesn't exist
    if (!columnNames.includes('xpValue')) {
      Logger.info('[Migration] Adding xpValue column to achievements table')
      await db.query(`ALTER TABLE achievements ADD COLUMN xpValue INTEGER DEFAULT 10`)
    }
    
    // Add unlockMessage column if it doesn't exist
    if (!columnNames.includes('unlockMessage')) {
      Logger.info('[Migration] Adding unlockMessage column to achievements table')
      await db.query(`ALTER TABLE achievements ADD COLUMN unlockMessage TEXT NULL`)
    }
    
    // Add isSecret column if it doesn't exist
    if (!columnNames.includes('isSecret')) {
      Logger.info('[Migration] Adding isSecret column to achievements table')
      await db.query(`ALTER TABLE achievements ADD COLUMN isSecret INTEGER DEFAULT 0`)
    }
    
    Logger.info('[Migration] Successfully added new columns to achievements table')
    return true
  } catch (error) {
    Logger.error('[Migration] Failed to add columns to achievements table', error)
    return false
  }
}

module.exports = {
  migrate
}
