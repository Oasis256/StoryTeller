const Database = require('./server/Database')
const fs = require('fs')
const Path = require('path')
const Sequelize = require('sequelize')
const Logger = require('./server/Logger')

async function runMigration() {
  try {
    console.log('Starting achievement database migration...')
    
    // Initialize database connection
    await Database.init()
    
    const queryInterface = Database.sequelize.getQueryInterface()
    const migration = require('./server/migrations/20250903_update_achievements_table')
    
    // Run the migration
    await migration.up(queryInterface, Sequelize)
    
    console.log('Migration completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
