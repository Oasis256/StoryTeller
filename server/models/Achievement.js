const { DataTypes, Model } = require('sequelize')

/**
 * @typedef AchievementObject
 * @property {string} id
 * @property {string} key - Unique achievement identifier
 * @property {string} name - Display name
 * @property {string} description - Achievement description
 * @property {string} badgeIcon - Icon name for the badge
 * @property {string} badgeColor - Badge color
 * @property {string} category - Achievement category (reading, listening, streak, milestone, etc.)
 * @property {number} targetValue - Target value to unlock achievement
 * @property {string} targetUnit - Unit for target value (books, hours, days, etc.)
 * @property {boolean} isActive - Whether achievement is currently available
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
    this.description
    /** @type {string} */
    this.badgeIcon
    /** @type {string} */
    this.badgeColor
    /** @type {string} */
    this.category
    /** @type {number} */
    this.targetValue
    /** @type {string} */
    this.targetUnit
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
    super.init({
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
        defaultValue: true
      }
    }, {
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
    })

    // Set up associations after model definition
    // Don't set up associations here since UserAchievement might not be loaded yet
  }

  /**
   * Define associations
   * @param {Object} models 
   */
  static associate(models) {
    // An achievement can have many user achievements
    this.hasMany(models.userAchievement)
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
      category: this.category,
      targetValue: this.targetValue,
      targetUnit: this.targetUnit,
      isActive: this.isActive,
      createdAt: this.createdAt?.toISOString() || null,
      updatedAt: this.updatedAt?.toISOString() || null
    }
  }
}

module.exports = Achievement
