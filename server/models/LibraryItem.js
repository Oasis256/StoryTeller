const { DataTypes, Model, literal } = require('sequelize')
const Logger = require('../Logger')
const oldLibraryItem = require('../objects/LibraryItem')
const libraryFilters = require('../utils/queries/libraryFilters')
const { areEquivalent } = require('../utils/index')

module.exports = (sequelize) => {
  class LibraryItem extends Model {
    /**
     * Loads all podcast episodes, all library items in chunks of 500, then maps them to old library items
     * @todo this is a temporary solution until we can use the sqlite without loading all the library items on init
     * 
     * @returns {Promise<objects.LibraryItem[]>} old library items
     */
    static async loadAllLibraryItems() {
      let start = Date.now()
      Logger.info(`[LibraryItem] Loading podcast episodes...`)
      const podcastEpisodes = await sequelize.models.podcastEpisode.findAll()
      Logger.info(`[LibraryItem] Finished loading ${podcastEpisodes.length} podcast episodes in ${((Date.now() - start) / 1000).toFixed(2)}s`)

      start = Date.now()
      Logger.info(`[LibraryItem] Loading library items...`)
      let libraryItems = await this.getAllOldLibraryItemsIncremental()
      Logger.info(`[LibraryItem] Finished loading ${libraryItems.length} library items in ${((Date.now() - start) / 1000).toFixed(2)}s`)

      // Map LibraryItem to old library item
      libraryItems = libraryItems.map(li => {
        if (li.mediaType === 'podcast') {
          li.media.podcastEpisodes = podcastEpisodes.filter(pe => pe.podcastId === li.media.id)
        }
        return this.getOldLibraryItem(li)
      })

      return libraryItems
    }

    /**
     * Loads all LibraryItem in batches of 500
     * @todo temporary solution
     * 
     * @param {Model<LibraryItem>[]} libraryItems 
     * @param {number} offset 
     * @returns {Promise<Model<LibraryItem>[]>}
     */
    static async getAllOldLibraryItemsIncremental(libraryItems = [], offset = 0) {
      const limit = 500
      const rows = await this.getLibraryItemsIncrement(offset, limit)
      libraryItems.push(...rows)
      if (!rows.length || rows.length < limit) {
        return libraryItems
      }
      Logger.info(`[LibraryItem] Loaded ${rows.length} library items. ${libraryItems.length} loaded so far.`)
      return this.getAllOldLibraryItemsIncremental(libraryItems, offset + rows.length)
    }

    /**
     * Gets library items partially expanded, not including podcast episodes
     * @todo temporary solution
     * 
     * @param {number} offset
     * @param {number} limit
     * @returns {Promise<Model<LibraryItem>[]>} LibraryItem
     */
    static getLibraryItemsIncrement(offset, limit) {
      return this.findAll({
        include: [
          {
            model: sequelize.models.book,
            include: [
              {
                model: sequelize.models.author,
                through: {
                  attributes: ['createdAt']
                }
              },
              {
                model: sequelize.models.series,
                through: {
                  attributes: ['sequence', 'createdAt']
                }
              }
            ]
          },
          {
            model: sequelize.models.podcast
          }
        ],
        order: [
          ['createdAt', 'ASC'],
          // Ensure author & series stay in the same order
          [sequelize.models.book, sequelize.models.author, sequelize.models.bookAuthor, 'createdAt', 'ASC'],
          [sequelize.models.book, sequelize.models.series, 'bookSeries', 'createdAt', 'ASC'],
        ],
        offset,
        limit
      })
    }

    /**
     * Currently unused because this is too slow and uses too much mem
     * 
     * @returns {Array<objects.LibraryItem>} old library items
     */
    static async getAllOldLibraryItems() {
      let libraryItems = await this.findAll({
        include: [
          {
            model: sequelize.models.book,
            include: [
              {
                model: sequelize.models.author,
                through: {
                  attributes: []
                }
              },
              {
                model: sequelize.models.series,
                through: {
                  attributes: ['sequence']
                }
              }
            ]
          },
          {
            model: sequelize.models.podcast,
            include: [
              {
                model: sequelize.models.podcastEpisode
              }
            ]
          }
        ]
      })
      return libraryItems.map(ti => this.getOldLibraryItem(ti))
    }

    /**
     * Convert an expanded LibraryItem into an old library item
     * 
     * @param {Model<LibraryItem>} libraryItemExpanded 
     * @returns {oldLibraryItem}
     */
    static getOldLibraryItem(libraryItemExpanded) {
      let media = null
      if (libraryItemExpanded.mediaType === 'book') {
        media = sequelize.models.book.getOldBook(libraryItemExpanded)
      } else if (libraryItemExpanded.mediaType === 'podcast') {
        media = sequelize.models.podcast.getOldPodcast(libraryItemExpanded)
      }

      return new oldLibraryItem({
        id: libraryItemExpanded.id,
        ino: libraryItemExpanded.ino,
        oldLibraryItemId: libraryItemExpanded.extraData?.oldLibraryItemId || null,
        libraryId: libraryItemExpanded.libraryId,
        folderId: libraryItemExpanded.libraryFolderId,
        path: libraryItemExpanded.path,
        relPath: libraryItemExpanded.relPath,
        isFile: libraryItemExpanded.isFile,
        mtimeMs: libraryItemExpanded.mtime?.valueOf(),
        ctimeMs: libraryItemExpanded.ctime?.valueOf(),
        birthtimeMs: libraryItemExpanded.birthtime?.valueOf(),
        addedAt: libraryItemExpanded.createdAt.valueOf(),
        updatedAt: libraryItemExpanded.updatedAt.valueOf(),
        lastScan: libraryItemExpanded.lastScan?.valueOf(),
        scanVersion: libraryItemExpanded.lastScanVersion,
        isMissing: !!libraryItemExpanded.isMissing,
        isInvalid: !!libraryItemExpanded.isInvalid,
        mediaType: libraryItemExpanded.mediaType,
        media,
        libraryFiles: libraryItemExpanded.libraryFiles
      })
    }

    static async fullCreateFromOld(oldLibraryItem) {
      const newLibraryItem = await this.create(this.getFromOld(oldLibraryItem))

      if (oldLibraryItem.mediaType === 'book') {
        const bookObj = sequelize.models.book.getFromOld(oldLibraryItem.media)
        bookObj.libraryItemId = newLibraryItem.id
        const newBook = await sequelize.models.book.create(bookObj)

        const oldBookAuthors = oldLibraryItem.media.metadata.authors || []
        const oldBookSeriesAll = oldLibraryItem.media.metadata.series || []

        for (const oldBookAuthor of oldBookAuthors) {
          await sequelize.models.bookAuthor.create({ authorId: oldBookAuthor.id, bookId: newBook.id })
        }
        for (const oldSeries of oldBookSeriesAll) {
          await sequelize.models.bookSeries.create({ seriesId: oldSeries.id, bookId: newBook.id, sequence: oldSeries.sequence })
        }
      } else if (oldLibraryItem.mediaType === 'podcast') {
        const podcastObj = sequelize.models.podcast.getFromOld(oldLibraryItem.media)
        podcastObj.libraryItemId = newLibraryItem.id
        const newPodcast = await sequelize.models.podcast.create(podcastObj)

        const oldEpisodes = oldLibraryItem.media.episodes || []
        for (const oldEpisode of oldEpisodes) {
          const episodeObj = sequelize.models.podcastEpisode.getFromOld(oldEpisode)
          episodeObj.libraryItemId = newLibraryItem.id
          episodeObj.podcastId = newPodcast.id
          await sequelize.models.podcastEpisode.create(episodeObj)
        }
      }

      return newLibraryItem
    }

    static async fullUpdateFromOld(oldLibraryItem) {
      const libraryItemExpanded = await this.findByPk(oldLibraryItem.id, {
        include: [
          {
            model: sequelize.models.book,
            include: [
              {
                model: sequelize.models.author,
                through: {
                  attributes: []
                }
              },
              {
                model: sequelize.models.series,
                through: {
                  attributes: ['id', 'sequence']
                }
              }
            ]
          },
          {
            model: sequelize.models.podcast,
            include: [
              {
                model: sequelize.models.podcastEpisode
              }
            ]
          }
        ]
      })
      if (!libraryItemExpanded) return false

      let hasUpdates = false

      // Check update Book/Podcast
      if (libraryItemExpanded.media) {
        let updatedMedia = null
        if (libraryItemExpanded.mediaType === 'podcast') {
          updatedMedia = sequelize.models.podcast.getFromOld(oldLibraryItem.media)

          const existingPodcastEpisodes = libraryItemExpanded.media.podcastEpisodes || []
          const updatedPodcastEpisodes = oldLibraryItem.media.episodes || []

          for (const existingPodcastEpisode of existingPodcastEpisodes) {
            // Episode was removed
            if (!updatedPodcastEpisodes.some(ep => ep.id === existingPodcastEpisode.id)) {
              Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" episode "${existingPodcastEpisode.title}" was removed`)
              await existingPodcastEpisode.destroy()
              hasUpdates = true
            }
          }
          for (const updatedPodcastEpisode of updatedPodcastEpisodes) {
            const existingEpisodeMatch = existingPodcastEpisodes.find(ep => ep.id === updatedPodcastEpisode.id)
            if (!existingEpisodeMatch) {
              Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" episode "${updatedPodcastEpisode.title}" was added`)
              await sequelize.models.podcastEpisode.createFromOld(updatedPodcastEpisode)
              hasUpdates = true
            } else {
              const updatedEpisodeCleaned = sequelize.models.podcastEpisode.getFromOld(updatedPodcastEpisode)
              let episodeHasUpdates = false
              for (const key in updatedEpisodeCleaned) {
                let existingValue = existingEpisodeMatch[key]
                if (existingValue instanceof Date) existingValue = existingValue.valueOf()

                if (!areEquivalent(updatedEpisodeCleaned[key], existingValue, true)) {
                  Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" episode "${existingEpisodeMatch.title}" ${key} was updated from "${existingValue}" to "${updatedEpisodeCleaned[key]}"`)
                  episodeHasUpdates = true
                }
              }
              if (episodeHasUpdates) {
                await existingEpisodeMatch.update(updatedEpisodeCleaned)
                hasUpdates = true
              }
            }
          }
        } else if (libraryItemExpanded.mediaType === 'book') {
          updatedMedia = sequelize.models.book.getFromOld(oldLibraryItem.media)

          const existingAuthors = libraryItemExpanded.media.authors || []
          const existingSeriesAll = libraryItemExpanded.media.series || []
          const updatedAuthors = oldLibraryItem.media.metadata.authors || []
          const updatedSeriesAll = oldLibraryItem.media.metadata.series || []

          for (const existingAuthor of existingAuthors) {
            // Author was removed from Book
            if (!updatedAuthors.some(au => au.id === existingAuthor.id)) {
              Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" author "${existingAuthor.name}" was removed`)
              await sequelize.models.bookAuthor.removeByIds(existingAuthor.id, libraryItemExpanded.media.id)
              hasUpdates = true
            }
          }
          for (const updatedAuthor of updatedAuthors) {
            // Author was added
            if (!existingAuthors.some(au => au.id === updatedAuthor.id)) {
              Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" author "${updatedAuthor.name}" was added`)
              await sequelize.models.bookAuthor.create({ authorId: updatedAuthor.id, bookId: libraryItemExpanded.media.id })
              hasUpdates = true
            }
          }
          for (const existingSeries of existingSeriesAll) {
            // Series was removed
            if (!updatedSeriesAll.some(se => se.id === existingSeries.id)) {
              Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" series "${existingSeries.name}" was removed`)
              await sequelize.models.bookSeries.removeByIds(existingSeries.id, libraryItemExpanded.media.id)
              hasUpdates = true
            }
          }
          for (const updatedSeries of updatedSeriesAll) {
            // Series was added/updated
            const existingSeriesMatch = existingSeriesAll.find(se => se.id === updatedSeries.id)
            if (!existingSeriesMatch) {
              Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" series "${updatedSeries.name}" was added`)
              await sequelize.models.bookSeries.create({ seriesId: updatedSeries.id, bookId: libraryItemExpanded.media.id, sequence: updatedSeries.sequence })
              hasUpdates = true
            } else if (existingSeriesMatch.bookSeries.sequence !== updatedSeries.sequence) {
              Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" series "${updatedSeries.name}" sequence was updated from "${existingSeriesMatch.bookSeries.sequence}" to "${updatedSeries.sequence}"`)
              await existingSeriesMatch.bookSeries.update({ id: updatedSeries.id, sequence: updatedSeries.sequence })
              hasUpdates = true
            }
          }
        }

        let hasMediaUpdates = false
        for (const key in updatedMedia) {
          let existingValue = libraryItemExpanded.media[key]
          if (existingValue instanceof Date) existingValue = existingValue.valueOf()

          if (!areEquivalent(updatedMedia[key], existingValue, true)) {
            Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" ${libraryItemExpanded.mediaType}.${key} updated from ${existingValue} to ${updatedMedia[key]}`)
            hasMediaUpdates = true
          }
        }
        if (hasMediaUpdates && updatedMedia) {
          await libraryItemExpanded.media.update(updatedMedia)
          hasUpdates = true
        }
      }

      const updatedLibraryItem = this.getFromOld(oldLibraryItem)
      let hasLibraryItemUpdates = false
      for (const key in updatedLibraryItem) {
        let existingValue = libraryItemExpanded[key]
        if (existingValue instanceof Date) existingValue = existingValue.valueOf()

        if (!areEquivalent(updatedLibraryItem[key], existingValue, true)) {
          Logger.dev(`[LibraryItem] "${libraryItemExpanded.media.title}" ${key} updated from ${existingValue} to ${updatedLibraryItem[key]}`)
          hasLibraryItemUpdates = true
        }
      }
      if (hasLibraryItemUpdates) {
        await libraryItemExpanded.update(updatedLibraryItem)
        Logger.info(`[LibraryItem] Library item "${libraryItemExpanded.id}" updated`)
        hasUpdates = true
      }
      return hasUpdates
    }

    static getFromOld(oldLibraryItem) {
      const extraData = {}
      if (oldLibraryItem.oldLibraryItemId) {
        extraData.oldLibraryItemId = oldLibraryItem.oldLibraryItemId
      }
      return {
        id: oldLibraryItem.id,
        ino: oldLibraryItem.ino,
        path: oldLibraryItem.path,
        relPath: oldLibraryItem.relPath,
        mediaId: oldLibraryItem.media.id,
        mediaType: oldLibraryItem.mediaType,
        isFile: !!oldLibraryItem.isFile,
        isMissing: !!oldLibraryItem.isMissing,
        isInvalid: !!oldLibraryItem.isInvalid,
        mtime: oldLibraryItem.mtimeMs,
        ctime: oldLibraryItem.ctimeMs,
        birthtime: oldLibraryItem.birthtimeMs,
        size: oldLibraryItem.size,
        lastScan: oldLibraryItem.lastScan,
        lastScanVersion: oldLibraryItem.scanVersion,
        libraryId: oldLibraryItem.libraryId,
        libraryFolderId: oldLibraryItem.folderId,
        libraryFiles: oldLibraryItem.libraryFiles?.map(lf => lf.toJSON()) || [],
        extraData
      }
    }

    static removeById(libraryItemId) {
      return this.destroy({
        where: {
          id: libraryItemId
        },
        individualHooks: true
      })
    }

    /**
     * Get library items using filter and sort
     * @param {oldLibrary} library 
     * @param {string} userId 
     * @param {object} options 
     * @returns {object} { libraryItems:oldLibraryItem[], count:number }
     */
    static async getByFilterAndSort(library, userId, options) {
      const { libraryItems, count } = await libraryFilters.getFilteredLibraryItems(library, userId, options)
      return {
        libraryItems: libraryItems.map(li => {
          const oldLibraryItem = this.getOldLibraryItem(li).toJSONMinified()
          if (li.collapsedSeries) {
            oldLibraryItem.collapsedSeries = li.collapsedSeries
          }
          if (li.series) {
            oldLibraryItem.media.metadata.series = li.series
          }
          if (li.rssFeed) {
            oldLibraryItem.rssFeed = sequelize.models.feed.getOldFeed(li.rssFeed).toJSONMinified()
          }
          if (li.media.numEpisodes) {
            oldLibraryItem.media.numEpisodes = li.media.numEpisodes
          }
          if (li.size && !oldLibraryItem.media.size) {
            oldLibraryItem.media.size = li.size
          }
          if (li.numEpisodesIncomplete) {
            oldLibraryItem.numEpisodesIncomplete = li.numEpisodesIncomplete
          }

          return oldLibraryItem
        }),
        count
      }
    }

    getMedia(options) {
      if (!this.mediaType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.mediaType)}`
      return this[mixinMethodName](options)
    }
  }

  LibraryItem.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ino: DataTypes.STRING,
    path: DataTypes.STRING,
    relPath: DataTypes.STRING,
    mediaId: DataTypes.UUIDV4,
    mediaType: DataTypes.STRING,
    isFile: DataTypes.BOOLEAN,
    isMissing: DataTypes.BOOLEAN,
    isInvalid: DataTypes.BOOLEAN,
    mtime: DataTypes.DATE(6),
    ctime: DataTypes.DATE(6),
    birthtime: DataTypes.DATE(6),
    size: DataTypes.BIGINT,
    lastScan: DataTypes.DATE,
    lastScanVersion: DataTypes.STRING,
    libraryFiles: DataTypes.JSON,
    extraData: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'libraryItem'
  })

  const { library, libraryFolder, book, podcast } = sequelize.models
  library.hasMany(LibraryItem)
  LibraryItem.belongsTo(library)

  libraryFolder.hasMany(LibraryItem)
  LibraryItem.belongsTo(libraryFolder)

  book.hasOne(LibraryItem, {
    foreignKey: 'mediaId',
    constraints: false,
    scope: {
      mediaType: 'book'
    }
  })
  LibraryItem.belongsTo(book, { foreignKey: 'mediaId', constraints: false })

  podcast.hasOne(LibraryItem, {
    foreignKey: 'mediaId',
    constraints: false,
    scope: {
      mediaType: 'podcast'
    }
  })
  LibraryItem.belongsTo(podcast, { foreignKey: 'mediaId', constraints: false })

  LibraryItem.addHook('afterFind', findResult => {
    if (!findResult) return

    if (!Array.isArray(findResult)) findResult = [findResult]
    for (const instance of findResult) {
      if (instance.mediaType === 'book' && instance.book !== undefined) {
        instance.media = instance.book
        instance.dataValues.media = instance.dataValues.book
      } else if (instance.mediaType === 'podcast' && instance.podcast !== undefined) {
        instance.media = instance.podcast
        instance.dataValues.media = instance.dataValues.podcast
      }
      // To prevent mistakes:
      delete instance.book
      delete instance.dataValues.book
      delete instance.podcast
      delete instance.dataValues.podcast
    }
  })

  LibraryItem.addHook('afterDestroy', async instance => {
    if (!instance) return
    const media = await instance.getMedia()
    if (media) {
      media.destroy()
    }
  })

  return LibraryItem
}