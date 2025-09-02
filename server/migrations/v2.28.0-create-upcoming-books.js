/**
 * @param { import("sequelize").QueryInterface } queryInterface
 * @param { import("sequelize").Sequelize } sequelize
 */
async function up({ context: { queryInterface, logger } }) {
  // Check if UpcomingBook table already exists
  try {
    const [results] = await queryInterface.sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='upcomingBooks'"
    )
    if (results.length > 0) {
      logger.info('[Migration] UpcomingBook table already exists, skipping creation')
      return
    }
  } catch (error) {
    logger.info('[Migration] Could not check if upcomingBooks table exists, proceeding with creation')
  }

  logger.info('[Migration] Creating UpcomingBook table...')

  // Create UpcomingBook table
  const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
  await queryInterface.createTable('upcomingBooks', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    seriesName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    authorName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    coverUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sourceUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'risingshadow'
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    isbn: {
      type: DataTypes.STRING,
      allowNull: true
    },
    extraData: {
      type: DataTypes.JSON,
      allowNull: true
    },
    lastChecked: {
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
  await queryInterface.addIndex('upcomingBooks', ['seriesName', 'authorName'], {
    unique: true,
    name: 'upcoming_books_series_author_unique'
  })
  await queryInterface.addIndex('upcomingBooks', ['authorName'])
  await queryInterface.addIndex('upcomingBooks', ['releaseDate'])
  await queryInterface.addIndex('upcomingBooks', ['lastChecked'])

  logger.info('[Migration] UpcomingBook table created successfully')
}

async function down({ context: { queryInterface, logger } }) {
  logger.info('[Migration] Dropping UpcomingBook table...')
  await queryInterface.dropTable('upcomingBooks')
  logger.info('[Migration] UpcomingBook table dropped successfully')
}

module.exports = { up, down }