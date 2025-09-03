const { DataTypes, Model } = require('sequelize')

/**
 * @typedef AchievementObject
 * @property {string} id
 * @property {string} key - Unique achievement identifier
 * @property {string} name - Display name
 * @property {string} nameKey - Localization key for name
 * @property {string} description - Achievement description
 * @property {string} descKey - Localization key for description
 * @property {string} badgeIcon - Icon name for the badge
 * @property {string} badgeColor - Badge color hex
 * @property {string} badgeImage - Path to achievement badge image
 * @property {string} category - Achievement category (listening, streak, diversity, milestone)
 * @property {number} targetValue - Target value to unlock achievement
 * @property {string} targetUnit - Unit for target value (minutes, days, authors, genres)
 * @property {string} rarity - How rare the achievement is (common, uncommon, rare, epic, legendary)
 * @property {number} xpValue - Experience points awarded when achievement is unlocked
 * @property {boolean} isSecret - Whether achievement is hidden until unlocked
 * @property {string} unlockMessage - Special message displayed when achievement is unlocked
 * @property {boolean} isActive - Whether achievement is available
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

class Achievement extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.key
    /** @type {string} */
    this.name
    /** @type {string} */
    this.nameKey
    /** @type {string} */
    this.description
    /** @type {string} */
    this.descKey
    /** @type {string} */
    this.badgeIcon
    /** @type {string} */
    this.badgeColor
    /** @type {string} */
    this.badgeImage
    /** @type {string} */
    this.category
    /** @type {number} */
    this.targetValue
    /** @type {string} */
    this.targetUnit
    /** @type {string} */
    this.rarity
    /** @type {number} */
    this.xpValue
    /** @type {boolean} */
    this.isSecret
    /** @type {string} */
    this.unlockMessage
    /** @type {boolean} */
    this.isActive
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * Initialize Achievement model
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
        key: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        nameKey: {
          type: DataTypes.STRING,
          allowNull: true
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        descKey: {
          type: DataTypes.STRING,
          allowNull: true
        },
        badgeIcon: {
          type: DataTypes.STRING,
          allowNull: false
        },
        badgeColor: {
          type: DataTypes.STRING,
          allowNull: false
        },
        badgeImage: {
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
          allowNull: false,
          defaultValue: 'units'
        },
        rarity: {
          type: DataTypes.ENUM('common', 'uncommon', 'rare', 'epic', 'legendary'),
          defaultValue: 'common'
        },
        xpValue: {
          type: DataTypes.INTEGER,
          defaultValue: 10
        },
        isSecret: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        unlockMessage: {
          type: DataTypes.STRING,
          allowNull: true
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true
        }
      },
      {
        sequelize,
        modelName: 'achievement',
        indexes: [
          {
            fields: ['category']
          },
          {
            fields: ['isActive']
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
    // An achievement can have many user achievements
    this.hasMany(models.userAchievement, {
      foreignKey: 'achievementId',
      as: 'userAchievements'
    })
  }

  toJSON() {
    return {
      id: this.id,
      key: this.key,
      name: this.name,
      nameKey: this.nameKey,
      description: this.description,
      descKey: this.descKey,
      badgeIcon: this.badgeIcon,
      badgeColor: this.badgeColor,
      badgeImage: this.badgeImage,
      category: this.category,
      targetValue: this.targetValue,
      targetUnit: this.targetUnit,
      rarity: this.rarity,
      xpValue: this.xpValue,
      isSecret: this.isSecret,
      unlockMessage: this.unlockMessage,
      isActive: this.isActive,
      createdAt: this.createdAt?.toISOString() || null,
      updatedAt: this.updatedAt?.toISOString() || null
    }
  }
}

module.exports = Achievement
