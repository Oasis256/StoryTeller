const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')

class ReadingGoal extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {UUIDV4} */
    this.userId
    /** @type {string} */
    this.title
    /** @type {string} */
    this.description
    /** @type {string} */
    this.type // 'books', 'minutes', 'pages', 'series', 'genres'
    /** @type {number} */
    this.targetValue
    /** @type {number} */
    this.currentProgress
    /** @type {Date} */
    this.startDate
    /** @type {Date} */
    this.endDate
    /** @type {boolean} */
    this.isActive
    /** @type {boolean} */
    this.isCompleted
    /** @type {Date} */
    this.completedAt
    /** @type {Object} */
    this.extraData // For storing additional goal-specific data
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * Get active goals for a user
   * @param {string} userId
   * @returns {Promise<ReadingGoal[]>}
   */
  static getActiveGoalsForUser(userId) {
    return this.findAll({
      where: {
        userId,
        isActive: true,
        endDate: {
          [require('sequelize').Op.gte]: new Date()
        }
      },
      order: [['createdAt', 'DESC']]
    })
  }

  /**
   * Get completed goals for a user
   * @param {string} userId
   * @returns {Promise<ReadingGoal[]>}
   */
  static getCompletedGoalsForUser(userId) {
    return this.findAll({
      where: {
        userId,
        isCompleted: true
      },
      order: [['completedAt', 'DESC']]
    })
  }

  /**
   * Get goals for a specific year
   * @param {string} userId
   * @param {number} year
   * @returns {Promise<ReadingGoal[]>}
   */
  static getGoalsForYear(userId, year) {
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    return this.findAll({
      where: {
        userId,
        startDate: {
          [require('sequelize').Op.between]: [startOfYear, endOfYear]
        }
      },
      order: [['startDate', 'ASC']]
    })
  }

  /**
   * Update goal progress
   * @param {string} goalId
   * @param {number} progressValue
   * @returns {Promise<ReadingGoal>}
   */
  static async updateProgress(goalId, progressValue) {
    const goal = await this.findByPk(goalId)
    if (!goal) return null

    const oldProgress = goal.currentProgress
    goal.currentProgress = Math.max(0, progressValue)

    // Check if goal is completed
    if (!goal.isCompleted && goal.currentProgress >= goal.targetValue) {
      goal.isCompleted = true
      goal.completedAt = new Date()
      Logger.info(`[ReadingGoal] Goal "${goal.title}" completed for user ${goal.userId}`)
    } else if (goal.isCompleted && goal.currentProgress < goal.targetValue) {
      // Goal was uncompleted (e.g., user removed a book)
      goal.isCompleted = false
      goal.completedAt = null
    }

    await goal.save()
    return goal
  }

  /**
   * Calculate progress for all active goals of a user
   * @param {string} userId
   */
  static async recalculateProgressForUser(userId) {
    const activeGoals = await this.getActiveGoalsForUser(userId)
    const sequelize = this.sequelize

    for (const goal of activeGoals) {
      let progress = 0

      switch (goal.type) {
        case 'books':
          // Count finished books
          const finishedBooks = await sequelize.models.mediaProgress.count({
            where: {
              userId,
              isFinished: true,
              mediaItemType: 'book',
              finishedAt: {
                [require('sequelize').Op.between]: [goal.startDate, goal.endDate]
              }
            }
          })
          progress = finishedBooks
          break

        case 'minutes':
          // Sum listening time from playback sessions
          const sessions = await sequelize.models.playbackSession.findAll({
            where: {
              userId,
              createdAt: {
                [require('sequelize').Op.between]: [goal.startDate, goal.endDate]
              }
            },
            attributes: ['timeListening']
          })
          progress = Math.round(sessions.reduce((sum, s) => sum + (s.timeListening || 0), 0) / 60) // Convert to minutes
          break

        case 'series':
          // Count completed series (all books in series finished)
          // This would require more complex logic
          break

        case 'genres':
          // Count unique genres completed
          const genreData = goal.extraData?.targetGenres || []
          if (genreData.length > 0) {
            // Count how many target genres have at least one finished book
            // This would require joining with book metadata
          }
          break
      }

      if (progress !== goal.currentProgress) {
        await this.updateProgress(goal.id, progress)
      }
    }
  }

  /**
   * Get goal statistics for a user
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async getStatsForUser(userId) {
    const currentYear = new Date().getFullYear()
    const yearGoals = await this.getGoalsForYear(userId, currentYear)
    const activeGoals = await this.getActiveGoalsForUser(userId)
    const completedGoals = await this.getCompletedGoalsForUser(userId)

    const stats = {
      totalGoals: yearGoals.length,
      activeGoals: activeGoals.length,
      completedGoals: completedGoals.length,
      completionRate: yearGoals.length > 0 ? (completedGoals.length / yearGoals.length) * 100 : 0,
      currentStreak: 0, // Would need additional logic to calculate
      longestStreak: 0,
      goalsThisYear: yearGoals,
      recentAchievements: completedGoals.slice(0, 5)
    }

    return stats
  }

  toJSON() {
    const obj = this.get({ plain: true })

    // Calculate progress percentage
    obj.progressPercentage = obj.targetValue > 0 ? Math.min(100, (obj.currentProgress / obj.targetValue) * 100) : 0

    // Calculate days remaining
    if (obj.endDate) {
      const now = new Date()
      const end = new Date(obj.endDate)
      obj.daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
    }

    // Calculate if on track
    if (obj.startDate && obj.endDate && !obj.isCompleted) {
      const now = new Date()
      const start = new Date(obj.startDate)
      const end = new Date(obj.endDate)
      const totalDuration = end - start
      const elapsed = now - start
      const expectedProgress = (elapsed / totalDuration) * obj.targetValue
      obj.onTrack = obj.currentProgress >= expectedProgress
    } else {
      obj.onTrack = true
    }

    return obj
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        description: {
          type: DataTypes.TEXT
        },
        type: {
          type: DataTypes.ENUM('books', 'minutes', 'pages', 'series', 'genres'),
          allowNull: false
        },
        targetValue: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 1
          }
        },
        currentProgress: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
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
          defaultValue: true
        },
        isCompleted: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        completedAt: {
          type: DataTypes.DATE
        },
        extraData: {
          type: DataTypes.JSON
        }
      },
      {
        sequelize,
        modelName: 'readingGoal',
        indexes: [
          {
            fields: ['userId']
          },
          {
            fields: ['userId', 'isActive']
          },
          {
            fields: ['endDate']
          }
        ]
      }
    )

    const { user } = sequelize.models
    user.hasMany(ReadingGoal, { foreignKey: 'userId' })
    ReadingGoal.belongsTo(user, { foreignKey: 'userId' })
  }
}

module.exports = ReadingGoal
