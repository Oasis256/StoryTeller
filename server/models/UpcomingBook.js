const { DataTypes, Model } = require('sequelize')

/**
 * @typedef UpcomingBookObject
 * @property {string} id
 * @property {string} seriesName - Series name this upcoming book belongs to
 * @property {string} authorName - Author name
 * @property {string} title - Book title
 * @property {string} description - Book description
 * @property {string} releaseDate - Expected release date (ISO string)
 * @property {string} coverUrl - URL to book cover image
 * @property {string} sourceUrl - URL to source page
 * @property {string} provider - Data provider (risingshadow, goodreads, etc)
 * @property {number} sequence - Book sequence number in series
 * @property {string} isbn - ISBN if available
 * @property {Object} extraData - Additional provider-specific data
 * @property {Date} lastChecked - When this record was last verified
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

class UpcomingBook extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.seriesName
    /** @type {string} */
    this.authorName
    /** @type {string} */
    this.title
    /** @type {string} */
    this.description
    /** @type {string} */
    this.releaseDate
    /** @type {string} */
    this.coverUrl
    /** @type {string} */
    this.sourceUrl
    /** @type {string} */
    this.provider
    /** @type {number} */
    this.sequence
    /** @type {string} */
    this.isbn
    /** @type {Object} */
    this.extraData
    /** @type {Date} */
    this.lastChecked
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * Find upcoming book by series and author
   * @param {string} seriesName 
   * @param {string} authorName 
   * @returns {Promise<UpcomingBook>}
   */
  static findBySeriesAndAuthor(seriesName, authorName) {
    return this.findOne({
      where: {
        seriesName,
        authorName
      },
      order: [['sequence', 'ASC'], ['releaseDate', 'ASC']]
    })
  }

  /**
   * Find all upcoming books for an author
   * @param {string} authorName 
   * @returns {Promise<UpcomingBook[]>}
   */
  static findByAuthor(authorName) {
    return this.findAll({
      where: { authorName },
      order: [['seriesName', 'ASC'], ['sequence', 'ASC'], ['releaseDate', 'ASC']]
    })
  }

  /**
   * Check if this record needs to be refreshed
   * @returns {boolean}
   */
  needsRefresh() {
    if (!this.lastChecked) return true
    
    const now = new Date()
    const daysSinceCheck = (now - this.lastChecked) / (1000 * 60 * 60 * 24)
    
    // If release date has passed, refresh immediately
    if (this.releaseDate && new Date(this.releaseDate) <= now) {
      return true
    }
    
    // If releasing within 30 days, check daily
    if (this.releaseDate) {
      const daysUntilRelease = (new Date(this.releaseDate) - now) / (1000 * 60 * 60 * 24)
      if (daysUntilRelease <= 30 && daysSinceCheck >= 1) {
        return true
      }
    }
    
    // Otherwise check weekly
    return daysSinceCheck >= 7
  }

  /**
   * Mark as checked
   */
  async markChecked() {
    this.lastChecked = new Date()
    await this.save()
  }

  toJSON() {
    const obj = super.toJSON()
    
    // Calculate days until release
    if (obj.releaseDate) {
      const releaseDate = new Date(obj.releaseDate)
      const now = new Date()
      obj.daysUntilRelease = Math.ceil((releaseDate - now) / (1000 * 60 * 60 * 24))
      obj.isReleased = releaseDate <= now
    }
    
    return obj
  }

  /**
   * Initialize UpcomingBook model
   * @param {import('../Database').sequelize} sequelize 
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
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
      }
    }, {
      sequelize,
      modelName: 'upcomingBook',
      indexes: [
        {
          fields: ['seriesName', 'authorName'],
          unique: true
        },
        {
          fields: ['authorName']
        },
        {
          fields: ['releaseDate']
        },
        {
          fields: ['lastChecked']
        }
      ]
    })
  }
}

module.exports = UpcomingBook