/**
 * @param { import("sequelize").QueryInterface } queryInterface
 * @param { import("sequelize").Sequelize } sequelize
 */
async function up({ context: { queryInterface, logger } }) {
  // Check if ReadingGoal table already exists using SQLite-compatible method
  try {
    const [results] = await queryInterface.sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='readingGoals'")
    if (results.length > 0) {
      return
    }
  } catch (error) {
    // If query fails, assume table doesn't exist and continue
    console.log('Could not check if readingGoals table exists, proceeding with creation')
  }

  // Create ReadingGoal table
  const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
  await queryInterface.createTable('readingGoals', {
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
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    targetValue: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    currentProgress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    targetGenres: {
      type: DataTypes.JSON,
      allowNull: true
    },
    extraData: {
      type: DataTypes.JSON,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  })

  // Create indexes
  await queryInterface.addIndex('readingGoals', ['userId'])
  await queryInterface.addIndex('readingGoals', ['userId', 'isActive'])
  await queryInterface.addIndex('readingGoals', ['endDate'])
}

/**
 * @param { import("sequelize").QueryInterface } queryInterface
 * @param { import("sequelize").Sequelize } sequelize
 */
async function down({ context: { queryInterface, logger } }) {
  await queryInterface.dropTable('readingGoals')
}

module.exports = { up, down }
