const Logger = require('../Logger')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    Logger.debug('[Migration] Running v2.28.0-update-achievements-table migration')

    try {
      // Check if badgeImage column exists
      const tableInfo = await queryInterface.describeTable('achievements')
      const columnsToAdd = []

      if (!tableInfo.badgeImage) {
        Logger.debug('[Migration] Adding badgeImage column to achievements table')
        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'badgeImage', {
            type: Sequelize.STRING,
            allowNull: true
          })
        )
      }

      if (!tableInfo.rarity) {
        Logger.debug('[Migration] Adding rarity column to achievements table')
        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'rarity', {
            type: Sequelize.ENUM('common', 'uncommon', 'rare', 'epic', 'legendary'),
            defaultValue: 'common'
          })
        )
      }

      if (!tableInfo.xpValue) {
        Logger.debug('[Migration] Adding xpValue column to achievements table')
        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'xpValue', {
            type: Sequelize.INTEGER,
            defaultValue: 10
          })
        )
      }

      if (!tableInfo.isSecret) {
        Logger.debug('[Migration] Adding isSecret column to achievements table')
        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'isSecret', {
            type: Sequelize.BOOLEAN,
            defaultValue: false
          })
        )
      }

      if (!tableInfo.unlockMessage) {
        Logger.debug('[Migration] Adding unlockMessage column to achievements table')
        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'unlockMessage', {
            type: Sequelize.STRING,
            allowNull: true
          })
        )
      }

      if (!tableInfo.targetUnit && !tableInfo.nameKey) {
        Logger.debug('[Migration] Adding additional columns to achievements table')
        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'targetUnit', {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'units'
          })
        )

        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'nameKey', {
            type: Sequelize.STRING,
            allowNull: true
          })
        )

        columnsToAdd.push(() =>
          queryInterface.addColumn('achievements', 'descKey', {
            type: Sequelize.STRING,
            allowNull: true
          })
        )
      }

      // Execute all migrations sequentially
      for (const addColumnFn of columnsToAdd) {
        await addColumnFn()
      }

      Logger.debug('[Migration] v2.28.0-update-achievements-table migration completed successfully')
      return true
    } catch (error) {
      Logger.error('[Migration] Error in v2.28.0-update-achievements-table migration', error)
      throw error
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      const columns = ['badgeImage', 'rarity', 'xpValue', 'isSecret', 'unlockMessage', 'targetUnit', 'nameKey', 'descKey']

      for (const column of columns) {
        try {
          await queryInterface.removeColumn('achievements', column)
        } catch (error) {
          Logger.warn(`[Migration] Could not remove column ${column} from achievements: ${error.message}`)
        }
      }

      return true
    } catch (error) {
      Logger.error('[Migration] Error reverting v2.28.0-update-achievements-table migration', error)
      throw error
    }
  }
}
