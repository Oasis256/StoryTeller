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
    super.init({
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
    }, {
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
    })

    // Set up associations after model definition
    const { user, achievement } = sequelize.models
    if (user) {
      // A user achievement belongs to a user
      this.belongsTo(user)
      // A user has many achievements
      user.hasMany(this)
    }
    if (achievement) {
      // A user achievement belongs to an achievement
      this.belongsTo(achievement)
      // An achievement has many user achievements  
      achievement.hasMany(this)
    }
  }

  /**
   * Define associations
   * @param {Object} models 
   */
  static associate(models) {
    // A user achievement belongs to a user
    this.belongsTo(models.user)
    // A user achievement belongs to an achievement
    this.belongsTo(models.achievement)
  }

  /**
   * Unlock this achievement
   */
  async unlock() {
    if (!this.isUnlocked) {
      this.isUnlocked = true
      this.unlockedAt = new Date()
      this.progress = this.achievement?.targetValue || this.progress
      await this.save()
    }
  }

  /**
   * Update progress towards achievement
   * @param {number} newProgress 
   */
  async updateProgress(newProgress) {
    const targetValue = this.achievement?.targetValue || 1
    this.progress = Math.min(newProgress, targetValue)
    
    // Auto-unlock if target reached
    if (!this.isUnlocked && this.progress >= targetValue) {
      await this.unlock()
    } else {
      await this.save()
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

    if (this.achievement) {
      json.achievement = this.achievement.toJSON()
    }

    return json
  }
}

module.exports = UserAchievement
