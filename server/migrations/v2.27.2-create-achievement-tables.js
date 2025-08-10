/**
 * @param { import("sequelize").QueryInterface } queryInterface
 * @param { import("sequelize").Sequelize } sequelize
 */
async function up({ context: { queryInterface, logger } }) {
  // Check if Achievement table already exists using SQLite-compatible method
  try {
    const [achievementResults] = await queryInterface.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='achievements'"
    )
    if (achievementResults.length > 0) {
      console.log('Achievement tables already exist, skipping creation')
      return
    }
  } catch (error) {
    console.log('Could not check if achievement tables exist, proceeding with creation')
  }

  console.log('Creating Achievement tables...')

  // Create Achievement table
  const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
  await queryInterface.createTable('achievements', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    badgeIcon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    badgeColor: {
      type: DataTypes.STRING,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false
    },
    targetValue: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    targetUnit: {
      type: DataTypes.STRING,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  })

  // Create UserAchievement table
  await queryInterface.createTable('userAchievements', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    achievementId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'achievements',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    isUnlocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    unlockedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  })

  // Add indexes
  await queryInterface.addIndex('userAchievements', ['userId'])
  await queryInterface.addIndex('userAchievements', ['achievementId'])
  await queryInterface.addIndex('userAchievements', ['userId', 'achievementId'], {
    unique: true
  })

  console.log('Achievement tables created successfully')
}

async function down({ context: { queryInterface, logger } }) {
  // Remove tables in reverse order
  await queryInterface.dropTable('userAchievements')
  await queryInterface.dropTable('achievements')
}

module.exports = { up, down }
