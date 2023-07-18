const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')
const oldLibrary = require('../objects/Library')

module.exports = (sequelize) => {
  class Library extends Model {
    static async getAllOldLibraries() {
      const libraries = await this.findAll({
        include: sequelize.models.libraryFolder,
        order: [['displayOrder', 'ASC']]
      })
      return libraries.map(lib => this.getOldLibrary(lib))
    }

    static getOldLibrary(libraryExpanded) {
      const folders = libraryExpanded.libraryFolders.map(folder => {
        return {
          id: folder.id,
          fullPath: folder.path,
          libraryId: folder.libraryId,
          addedAt: folder.createdAt.valueOf()
        }
      })
      return new oldLibrary({
        id: libraryExpanded.id,
        oldLibraryId: libraryExpanded.extraData?.oldLibraryId || null,
        name: libraryExpanded.name,
        folders,
        displayOrder: libraryExpanded.displayOrder,
        icon: libraryExpanded.icon,
        mediaType: libraryExpanded.mediaType,
        provider: libraryExpanded.provider,
        settings: libraryExpanded.settings,
        createdAt: libraryExpanded.createdAt.valueOf(),
        lastUpdate: libraryExpanded.updatedAt.valueOf()
      })
    }

    /**
     * @param {object} oldLibrary 
     * @returns {Library|null}
     */
    static async createFromOld(oldLibrary) {
      const library = this.getFromOld(oldLibrary)

      library.libraryFolders = oldLibrary.folders.map(folder => {
        return {
          id: folder.id,
          path: folder.fullPath
        }
      })

      return this.create(library, {
        include: sequelize.models.libraryFolder
      }).catch((error) => {
        Logger.error(`[Library] Failed to create library ${library.id}`, error)
        return null
      })
    }

    static async updateFromOld(oldLibrary) {
      const existingLibrary = await this.findByPk(oldLibrary.id, {
        include: sequelize.models.libraryFolder
      })
      if (!existingLibrary) {
        Logger.error(`[Library] Failed to update library ${oldLibrary.id} - not found`)
        return null
      }

      const library = this.getFromOld(oldLibrary)

      const libraryFolders = oldLibrary.folders.map(folder => {
        return {
          id: folder.id,
          path: folder.fullPath,
          libraryId: library.id
        }
      })
      for (const libraryFolder of libraryFolders) {
        const existingLibraryFolder = existingLibrary.libraryFolders.find(lf => lf.id === libraryFolder.id)
        if (!existingLibraryFolder) {
          await sequelize.models.libraryFolder.create(libraryFolder)
        } else if (existingLibraryFolder.path !== libraryFolder.path) {
          await existingLibraryFolder.update({ path: libraryFolder.path })
        }
      }

      const libraryFoldersRemoved = existingLibrary.libraryFolders.filter(lf => !libraryFolders.some(_lf => _lf.id === lf.id))
      for (const existingLibraryFolder of libraryFoldersRemoved) {
        await existingLibraryFolder.destroy()
      }

      return existingLibrary.update(library)
    }

    static getFromOld(oldLibrary) {
      const extraData = {}
      if (oldLibrary.oldLibraryId) {
        extraData.oldLibraryId = oldLibrary.oldLibraryId
      }
      return {
        id: oldLibrary.id,
        name: oldLibrary.name,
        displayOrder: oldLibrary.displayOrder,
        icon: oldLibrary.icon || null,
        mediaType: oldLibrary.mediaType || null,
        provider: oldLibrary.provider,
        settings: oldLibrary.settings?.toJSON() || {},
        createdAt: oldLibrary.createdAt,
        updatedAt: oldLibrary.lastUpdate,
        extraData
      }
    }

    static removeById(libraryId) {
      return this.destroy({
        where: {
          id: libraryId
        }
      })
    }
  }

  Library.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    displayOrder: DataTypes.INTEGER,
    icon: DataTypes.STRING,
    mediaType: DataTypes.STRING,
    provider: DataTypes.STRING,
    lastScan: DataTypes.DATE,
    lastScanVersion: DataTypes.STRING,
    settings: DataTypes.JSON,
    extraData: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'library'
  })

  return Library
}