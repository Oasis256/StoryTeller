const { DataTypes, Model } = require('sequelize')

/**
 * @typedef UserAchievementObject
 * @property {string} id
 * @property {string} userId
 * @property {string} achievementId
 * @property {number} progress - Current progress towards achievement
 * @property {boolean} isUnlocked - Whether achievement has been unlocked
 * @property {Date} unlockedAt - When achievement was unlocked
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

class UserAchievement extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.userId
    /** @type {string} */
    this.achievementId
    /** @type {number} */
    this.progress
    /** @type {boolean} */
    this.isUnlocked
    /** @type {Date} */
    this.unlockedAt
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt

    // Associations
    /** @type {import('./Achievement')} */
    this.achievement
    /** @type {import('./User')} */
    this.user
  }

  /**
   * Initialize UserAchievement model
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
        achievementId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        progress: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        },
        isUnlocked: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        unlockedAt: {
          type: DataTypes.DATE,
          allowNull: true
        }
      },
      {
        sequelize,
        modelName: 'userAchievement',
        indexes: [
          {
            fields: ['userId']
          },
          {
            fields: ['achievementId']
          },
          {
            fields: ['isUnlocked']
          },
          {
            unique: true,
            fields: ['userId', 'achievementId']
          }
        ]
      }
    )
  }

  /**
   * Define associations - called after all models are initialized
   * @param {Object} models - All registered models
   */
  static associate(models) {
    // A user achievement belongs to a user
    this.belongsTo(models.user, {
      foreignKey: 'userId',
      as: 'user'
    })
    
    // A user achievement belongs to an achievement
    this.belongsTo(models.achievement, {
      foreignKey: 'achievementId',
      as: 'achievement'
    })

    // Ensure the association is created properly
    this.Achievement = this.belongsTo(models.achievement, {
      foreignKey: 'achievementId'
    })
  }

  /**
   * Unlock this achievement
   */
  async unlock() {
    if (!this.isUnlocked) {
      this.isUnlocked = true
      this.unlockedAt = new Date()
      
      if (this.achievement) {
        this.progress = this.achievement.targetValue
      }
      
      await this.save()
      return true
    }
    return false
  }

  /**
   * Update progress towards achievement
   * @param {number} newProgress
   * @returns {Promise<boolean>} True if achievement was unlocked
   */
  async updateProgress(newProgress) {
    let targetValue = 1
    
    if (this.achievement) {
      targetValue = this.achievement.targetValue
    }
    
    this.progress = Math.min(newProgress, targetValue)

    // Auto-unlock if target reached
    if (!this.isUnlocked && this.progress >= targetValue) {
      await this.save()
      return await this.unlock()
    } else {
      await this.save()
      return false
    }
  }

  toJSON() {
    const json = {
      id: this.id,
      userId: this.userId,
      achievementId: this.achievementId,
      progress: this.progress,
      isUnlocked: this.isUnlocked,
      unlockedAt: this.unlockedAt?.toISOString() || null,
      createdAt: this.createdAt?.toISOString() || null,
      updatedAt: this.updatedAt?.toISOString() || null
    }

    // Include achievement data if loaded
    if (this.achievement) {
      json.Achievement = this.achievement.toJSON()
    }

    return json
  }
}

module.exports = UserAchievement
