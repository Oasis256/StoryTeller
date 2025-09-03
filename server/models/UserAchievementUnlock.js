const { DataTypes, Model } = require('sequelize')
const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')

/**
 * @typedef UserAchievementUnlockObject
 * @property {string} id
 * @property {string} userId
 * @property {string} achievementId
 * @property {boolean} isAcknowledged - Whether the user has seen/acknowledged this achievement
 * @property {Date} unlockedAt - When achievement was unlocked
 * @property {Date} acknowledgedAt - When user acknowledged the achievement
 * @property {number} xpEarned - Experience points earned from this achievement
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

class UserAchievementUnlock extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.userId
    /** @type {string} */
    this.achievementId
    /** @type {boolean} */
    this.isAcknowledged
    /** @type {Date} */
    this.unlockedAt
    /** @type {Date} */
    this.acknowledgedAt
    /** @type {number} */
    this.xpEarned
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
        isAcknowledged: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        unlockedAt: { 
          type: DataTypes.DATE, 
          allowNull: false, 
          defaultValue: DataTypes.NOW 
        },
        acknowledgedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        xpEarned: {
          type: DataTypes.INTEGER,
          defaultValue: 0
        }
      },
      {
        sequelize,
        modelName: 'userAchievementUnlock',
        indexes: [
          { fields: ['userId'] }, 
          { fields: ['achievementId'] },
          { fields: ['isAcknowledged'] }, 
          { unique: true, fields: ['userId', 'achievementId'] }
        ]
      }
    )
  }
  
  /**
   * Define associations - called after all models are initialized
   * @param {Object} models - All registered models
   */
  static associate(models) {
    // A user achievement unlock belongs to a user
    this.belongsTo(models.user, {
      foreignKey: 'userId',
      as: 'user'
    })
    
    // A user achievement unlock belongs to an achievement
    this.belongsTo(models.achievement, {
      foreignKey: 'achievementId',
      as: 'achievement'
    })
  }

  /**
   * Acknowledge this achievement unlock
   */
  async acknowledge() {
    if (!this.isAcknowledged) {
      this.isAcknowledged = true
      this.acknowledgedAt = new Date()
      await this.save()
      return true
    }
    return false
  }

  /**
   * Send notification to user about this unlock
   */
  sendNotification() {
    try {
      if (!this.achievement) return
      
      Logger.debug(`[UserAchievementUnlock] Sending achievement notification to user ${this.userId} for "${this.achievement.name}"`)
      
      // Send socket notification to user
      SocketAuthority.clientEmitter(this.userId, 'achievement_unlocked', {
        id: this.id,
        achievementId: this.achievementId,
        achievement: this.achievement.toJSON(),
        unlockedAt: this.unlockedAt,
        xpEarned: this.xpEarned
      })
    } catch (error) {
      Logger.error('[UserAchievementUnlock] Error sending notification:', error)
    }
  }
  
  toJSON() {
    const json = {
      id: this.id,
      userId: this.userId,
      achievementId: this.achievementId,
      isAcknowledged: this.isAcknowledged,
      unlockedAt: this.unlockedAt?.toISOString() || null,
      acknowledgedAt: this.acknowledgedAt?.toISOString() || null,
      xpEarned: this.xpEarned || 0,
      createdAt: this.createdAt?.toISOString() || null,
      updatedAt: this.updatedAt?.toISOString() || null
    }

    // Include achievement data if loaded
    if (this.achievement) {
      json.achievement = this.achievement.toJSON()
    }

    return json
  }
}

module.exports = UserAchievementUnlock
