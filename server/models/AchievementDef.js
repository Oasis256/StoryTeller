const { DataTypes, Model } = require('sequelize')

class AchievementDef extends Model {
  static init(sequelize) {
    super.init(
      {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        key: { type: DataTypes.STRING, allowNull: false, unique: true },
        name: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false },
        icon: { type: DataTypes.STRING, allowNull: false },
        color: { type: DataTypes.STRING, allowNull: false },
        category: { type: DataTypes.STRING, allowNull: false },
        targetValue: { type: DataTypes.INTEGER, allowNull: false },
        targetUnit: { type: DataTypes.STRING, allowNull: false },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
      },
      { sequelize, modelName: 'achievementDef', indexes: [{ fields: ['category'] }, { fields: ['isActive'] }] }
    )
  }
}

module.exports = AchievementDef
