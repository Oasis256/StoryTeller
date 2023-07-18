const Path = require('path')
const { Sequelize } = require('sequelize')

const packageJson = require('../package.json')
const fs = require('./libs/fsExtra')
const Logger = require('./Logger')

const dbMigration = require('./utils/migrations/dbMigration')

class Database {
  constructor() {
    this.sequelize = null
    this.dbPath = null
    this.isNew = false // New absdatabase.sqlite created

    // Temporarily using format of old DB
    // TODO: below data should be loaded from the DB as needed
    this.libraryItems = []
    this.users = []
    this.libraries = []
    this.settings = []
    this.collections = []
    this.playlists = []
    this.authors = []
    this.series = []

    this.serverSettings = null
    this.notificationSettings = null
    this.emailSettings = null
  }

  get models() {
    return this.sequelize?.models || {}
  }

  get hasRootUser() {
    return this.users.some(u => u.type === 'root')
  }

  async checkHasDb() {
    if (!await fs.pathExists(this.dbPath)) {
      Logger.info(`[Database] absdatabase.sqlite not found at ${this.dbPath}`)
      return false
    }
    return true
  }

  async init(force = false) {
    this.dbPath = Path.join(global.ConfigPath, 'absdatabase.sqlite')

    // First check if this is a new database
    this.isNew = !(await this.checkHasDb()) || force

    if (!await this.connect()) {
      throw new Error('Database connection failed')
    }

    await this.buildModels(force)
    Logger.info(`[Database] Db initialized with models:`, Object.keys(this.sequelize.models).join(', '))

    await this.loadData()
  }

  async connect() {
    Logger.info(`[Database] Initializing db at "${this.dbPath}"`)
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: this.dbPath,
      logging: false
    })

    // Helper function
    this.sequelize.uppercaseFirst = str => str ? `${str[0].toUpperCase()}${str.substr(1)}` : ''

    try {
      await this.sequelize.authenticate()
      Logger.info(`[Database] Db connection was successful`)
      return true
    } catch (error) {
      Logger.error(`[Database] Failed to connect to db`, error)
      return false
    }
  }

  async disconnect() {
    Logger.info(`[Database] Disconnecting sqlite db`)
    await this.sequelize.close()
    this.sequelize = null
  }

  async reconnect() {
    Logger.info(`[Database] Reconnecting sqlite db`)
    await this.init()
  }

  buildModels(force = false) {
    require('./models/User')(this.sequelize)
    require('./models/Library')(this.sequelize)
    require('./models/LibraryFolder')(this.sequelize)
    require('./models/Book')(this.sequelize)
    require('./models/Podcast')(this.sequelize)
    require('./models/PodcastEpisode')(this.sequelize)
    require('./models/LibraryItem')(this.sequelize)
    require('./models/MediaProgress')(this.sequelize)
    require('./models/Series')(this.sequelize)
    require('./models/BookSeries')(this.sequelize)
    require('./models/Author')(this.sequelize)
    require('./models/BookAuthor')(this.sequelize)
    require('./models/Collection')(this.sequelize)
    require('./models/CollectionBook')(this.sequelize)
    require('./models/Playlist')(this.sequelize)
    require('./models/PlaylistMediaItem')(this.sequelize)
    require('./models/Device')(this.sequelize)
    require('./models/PlaybackSession')(this.sequelize)
    require('./models/Feed')(this.sequelize)
    require('./models/FeedEpisode')(this.sequelize)
    require('./models/Setting')(this.sequelize)

    return this.sequelize.sync({ force, alter: false })
  }

  async loadData() {
    if (this.isNew && await dbMigration.checkShouldMigrate()) {
      Logger.info(`[Database] New database was created and old database was detected - migrating old to new`)
      await dbMigration.migrate(this.models)
    }

    const startTime = Date.now()

    const settingsData = await this.models.setting.getOldSettings()
    this.settings = settingsData.settings
    this.emailSettings = settingsData.emailSettings
    this.serverSettings = settingsData.serverSettings
    this.notificationSettings = settingsData.notificationSettings
    global.ServerSettings = this.serverSettings.toJSON()

    // Version specific migrations
    if (this.serverSettings.version === '2.3.0' && packageJson.version !== '2.3.0') {
      await dbMigration.migrationPatch(this)
    }

    this.libraryItems = await this.models.libraryItem.getAllOldLibraryItems()
    this.users = await this.models.user.getOldUsers()
    this.libraries = await this.models.library.getAllOldLibraries()
    this.collections = await this.models.collection.getOldCollections()
    this.playlists = await this.models.playlist.getOldPlaylists()
    this.authors = await this.models.author.getOldAuthors()
    this.series = await this.models.series.getAllOldSeries()

    Logger.info(`[Database] Db data loaded in ${Date.now() - startTime}ms`)

    if (packageJson.version !== this.serverSettings.version) {
      Logger.info(`[Database] Server upgrade detected from ${this.serverSettings.version} to ${packageJson.version}`)
      this.serverSettings.version = packageJson.version
      await this.updateServerSettings()
    }
  }

  async createRootUser(username, pash, token) {
    if (!this.sequelize) return false
    const newUser = await this.models.user.createRootUser(username, pash, token)
    if (newUser) {
      this.users.push(newUser)
      return true
    }
    return false
  }

  updateServerSettings() {
    if (!this.sequelize) return false
    global.ServerSettings = this.serverSettings.toJSON()
    return this.updateSetting(this.serverSettings)
  }

  updateSetting(settings) {
    if (!this.sequelize) return false
    return this.models.setting.updateSettingObj(settings.toJSON())
  }

  async createUser(oldUser) {
    if (!this.sequelize) return false
    await this.models.user.createFromOld(oldUser)
    this.users.push(oldUser)
    return true
  }

  updateUser(oldUser) {
    if (!this.sequelize) return false
    return this.models.user.updateFromOld(oldUser)
  }

  updateBulkUsers(oldUsers) {
    if (!this.sequelize) return false
    return Promise.all(oldUsers.map(u => this.updateUser(u)))
  }

  async removeUser(userId) {
    if (!this.sequelize) return false
    await this.models.user.removeById(userId)
    this.users = this.users.filter(u => u.id !== userId)
  }

  upsertMediaProgress(oldMediaProgress) {
    if (!this.sequelize) return false
    return this.models.mediaProgress.upsertFromOld(oldMediaProgress)
  }

  removeMediaProgress(mediaProgressId) {
    if (!this.sequelize) return false
    return this.models.mediaProgress.removeById(mediaProgressId)
  }

  updateBulkBooks(oldBooks) {
    if (!this.sequelize) return false
    return Promise.all(oldBooks.map(oldBook => this.models.book.saveFromOld(oldBook)))
  }

  async createLibrary(oldLibrary) {
    if (!this.sequelize) return false
    await this.models.library.createFromOld(oldLibrary)
    this.libraries.push(oldLibrary)
  }

  updateLibrary(oldLibrary) {
    if (!this.sequelize) return false
    return this.models.library.updateFromOld(oldLibrary)
  }

  async removeLibrary(libraryId) {
    if (!this.sequelize) return false
    await this.models.library.removeById(libraryId)
    this.libraries = this.libraries.filter(lib => lib.id !== libraryId)
  }

  async createCollection(oldCollection) {
    if (!this.sequelize) return false
    const newCollection = await this.models.collection.createFromOld(oldCollection)
    // Create CollectionBooks
    if (newCollection) {
      const collectionBooks = []
      oldCollection.books.forEach((libraryItemId) => {
        const libraryItem = this.libraryItems.find(li => li.id === libraryItemId)
        if (libraryItem) {
          collectionBooks.push({
            collectionId: newCollection.id,
            bookId: libraryItem.media.id
          })
        }
      })
      if (collectionBooks.length) {
        await this.createBulkCollectionBooks(collectionBooks)
      }
    }
    this.collections.push(oldCollection)
  }

  updateCollection(oldCollection) {
    if (!this.sequelize) return false
    const collectionBooks = []
    let order = 1
    oldCollection.books.forEach((libraryItemId) => {
      const libraryItem = this.getLibraryItem(libraryItemId)
      if (!libraryItem) return
      collectionBooks.push({
        collectionId: oldCollection.id,
        bookId: libraryItem.media.id,
        order: order++
      })
    })
    return this.models.collection.fullUpdateFromOld(oldCollection, collectionBooks)
  }

  async removeCollection(collectionId) {
    if (!this.sequelize) return false
    await this.models.collection.removeById(collectionId)
    this.collections = this.collections.filter(c => c.id !== collectionId)
  }

  createCollectionBook(collectionBook) {
    if (!this.sequelize) return false
    return this.models.collectionBook.create(collectionBook)
  }

  createBulkCollectionBooks(collectionBooks) {
    if (!this.sequelize) return false
    return this.models.collectionBook.bulkCreate(collectionBooks)
  }

  removeCollectionBook(collectionId, bookId) {
    if (!this.sequelize) return false
    return this.models.collectionBook.removeByIds(collectionId, bookId)
  }

  async createPlaylist(oldPlaylist) {
    if (!this.sequelize) return false
    const newPlaylist = await this.models.playlist.createFromOld(oldPlaylist)
    if (newPlaylist) {
      const playlistMediaItems = []
      let order = 1
      for (const mediaItemObj of oldPlaylist.items) {
        const libraryItem = this.libraryItems.find(li => li.id === mediaItemObj.libraryItemId)
        if (!libraryItem) continue

        let mediaItemId = libraryItem.media.id // bookId
        let mediaItemType = 'book'
        if (mediaItemObj.episodeId) {
          mediaItemType = 'podcastEpisode'
          mediaItemId = mediaItemObj.episodeId
        }
        playlistMediaItems.push({
          playlistId: newPlaylist.id,
          mediaItemId,
          mediaItemType,
          order: order++
        })
      }
      if (playlistMediaItems.length) {
        await this.createBulkPlaylistMediaItems(playlistMediaItems)
      }
    }
    this.playlists.push(oldPlaylist)
  }

  updatePlaylist(oldPlaylist) {
    if (!this.sequelize) return false
    const playlistMediaItems = []
    let order = 1
    oldPlaylist.items.forEach((item) => {
      const libraryItem = this.getLibraryItem(item.libraryItemId)
      if (!libraryItem) return
      playlistMediaItems.push({
        playlistId: oldPlaylist.id,
        mediaItemId: item.episodeId || libraryItem.media.id,
        mediaItemType: item.episodeId ? 'podcastEpisode' : 'book',
        order: order++
      })
    })
    return this.models.playlist.fullUpdateFromOld(oldPlaylist, playlistMediaItems)
  }

  async removePlaylist(playlistId) {
    if (!this.sequelize) return false
    await this.models.playlist.removeById(playlistId)
    this.playlists = this.playlists.filter(p => p.id !== playlistId)
  }

  createPlaylistMediaItem(playlistMediaItem) {
    if (!this.sequelize) return false
    return this.models.playlistMediaItem.create(playlistMediaItem)
  }

  createBulkPlaylistMediaItems(playlistMediaItems) {
    if (!this.sequelize) return false
    return this.models.playlistMediaItem.bulkCreate(playlistMediaItems)
  }

  removePlaylistMediaItem(playlistId, mediaItemId) {
    if (!this.sequelize) return false
    return this.models.playlistMediaItem.removeByIds(playlistId, mediaItemId)
  }

  getLibraryItem(libraryItemId) {
    if (!this.sequelize || !libraryItemId) return false

    // Temp support for old library item ids from mobile
    if (libraryItemId.startsWith('li_')) return this.libraryItems.find(li => li.oldLibraryItemId === libraryItemId)

    return this.libraryItems.find(li => li.id === libraryItemId)
  }

  async createLibraryItem(oldLibraryItem) {
    if (!this.sequelize) return false
    await this.models.libraryItem.fullCreateFromOld(oldLibraryItem)
    this.libraryItems.push(oldLibraryItem)
  }

  updateLibraryItem(oldLibraryItem) {
    if (!this.sequelize) return false
    return this.models.libraryItem.fullUpdateFromOld(oldLibraryItem)
  }

  async updateBulkLibraryItems(oldLibraryItems) {
    if (!this.sequelize) return false
    let updatesMade = 0
    for (const oldLibraryItem of oldLibraryItems) {
      const hasUpdates = await this.models.libraryItem.fullUpdateFromOld(oldLibraryItem)
      if (hasUpdates) updatesMade++
    }
    return updatesMade
  }

  async createBulkLibraryItems(oldLibraryItems) {
    if (!this.sequelize) return false
    for (const oldLibraryItem of oldLibraryItems) {
      await this.models.libraryItem.fullCreateFromOld(oldLibraryItem)
      this.libraryItems.push(oldLibraryItem)
    }
  }

  async removeLibraryItem(libraryItemId) {
    if (!this.sequelize) return false
    await this.models.libraryItem.removeById(libraryItemId)
    this.libraryItems = this.libraryItems.filter(li => li.id !== libraryItemId)
  }

  async createFeed(oldFeed) {
    if (!this.sequelize) return false
    await this.models.feed.fullCreateFromOld(oldFeed)
  }

  updateFeed(oldFeed) {
    if (!this.sequelize) return false
    return this.models.feed.fullUpdateFromOld(oldFeed)
  }

  async removeFeed(feedId) {
    if (!this.sequelize) return false
    await this.models.feed.removeById(feedId)
  }

  updateSeries(oldSeries) {
    if (!this.sequelize) return false
    return this.models.series.updateFromOld(oldSeries)
  }

  async createSeries(oldSeries) {
    if (!this.sequelize) return false
    await this.models.series.createFromOld(oldSeries)
    this.series.push(oldSeries)
  }

  async createBulkSeries(oldSeriesObjs) {
    if (!this.sequelize) return false
    await this.models.series.createBulkFromOld(oldSeriesObjs)
    this.series.push(...oldSeriesObjs)
  }

  async removeSeries(seriesId) {
    if (!this.sequelize) return false
    await this.models.series.removeById(seriesId)
    this.series = this.series.filter(se => se.id !== seriesId)
  }

  async createAuthor(oldAuthor) {
    if (!this.sequelize) return false
    await this.models.author.createFromOld(oldAuthor)
    this.authors.push(oldAuthor)
  }

  async createBulkAuthors(oldAuthors) {
    if (!this.sequelize) return false
    await this.models.author.createBulkFromOld(oldAuthors)
    this.authors.push(...oldAuthors)
  }

  updateAuthor(oldAuthor) {
    if (!this.sequelize) return false
    return this.models.author.updateFromOld(oldAuthor)
  }

  async removeAuthor(authorId) {
    if (!this.sequelize) return false
    await this.models.author.removeById(authorId)
    this.authors = this.authors.filter(au => au.id !== authorId)
  }

  async createBulkBookAuthors(bookAuthors) {
    if (!this.sequelize) return false
    await this.models.bookAuthor.bulkCreate(bookAuthors)
    this.authors.push(...bookAuthors)
  }

  async removeBulkBookAuthors(authorId = null, bookId = null) {
    if (!this.sequelize) return false
    if (!authorId && !bookId) return
    await this.models.bookAuthor.removeByIds(authorId, bookId)
    this.authors = this.authors.filter(au => {
      if (authorId && au.authorId !== authorId) return true
      if (bookId && au.bookId !== bookId) return true
      return false
    })
  }

  getPlaybackSessions(where = null) {
    if (!this.sequelize) return false
    return this.models.playbackSession.getOldPlaybackSessions(where)
  }

  getPlaybackSession(sessionId) {
    if (!this.sequelize) return false
    return this.models.playbackSession.getById(sessionId)
  }

  createPlaybackSession(oldSession) {
    if (!this.sequelize) return false
    return this.models.playbackSession.createFromOld(oldSession)
  }

  updatePlaybackSession(oldSession) {
    if (!this.sequelize) return false
    return this.models.playbackSession.updateFromOld(oldSession)
  }

  removePlaybackSession(sessionId) {
    if (!this.sequelize) return false
    return this.models.playbackSession.removeById(sessionId)
  }

  getDeviceByDeviceId(deviceId) {
    if (!this.sequelize) return false
    return this.models.device.getOldDeviceByDeviceId(deviceId)
  }

  updateDevice(oldDevice) {
    if (!this.sequelize) return false
    return this.models.device.updateFromOld(oldDevice)
  }

  createDevice(oldDevice) {
    if (!this.sequelize) return false
    return this.models.device.createFromOld(oldDevice)
  }
}

module.exports = new Database()