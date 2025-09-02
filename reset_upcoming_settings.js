const Database = require('./server/Database')
const UpcomingBookSettings = require('./server/objects/settings/UpcomingBookSettings')

async function resetSettings() {
  try {
    console.log('Connecting to database...')
    await Database.init()
    
    console.log('Creating default settings...')
    const defaultSettings = new UpcomingBookSettings()
    
    console.log('Default provider order:', defaultSettings.providerOrder)
    
    console.log('Saving to database...')
    await Database.models.setting.upsert({
      key: 'upcomingBookSettings',
      value: JSON.stringify(defaultSettings.toJSON()),
      updatedAt: new Date()
    })
    
    console.log('Settings reset successfully!')
    console.log('Provider order is now:', defaultSettings.providerOrder)
    
    process.exit(0)
  } catch (error) {
    console.error('Failed to reset settings:', error)
    process.exit(1)
  }
}

resetSettings()


