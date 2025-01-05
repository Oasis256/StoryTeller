const Logger = require('../../Logger')
const PodcastEpisode = require('../entities/PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')
const { filePathToPOSIX } = require('../../utils/fileUtils')

class Podcast {
  constructor(podcast) {
    this.id = null
    this.libraryItemId = null
    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.episodes = []

    this.autoDownloadEpisodes = false
    this.autoDownloadSchedule = null
    this.lastEpisodeCheck = 0
    this.maxEpisodesToKeep = 0
    this.maxNewEpisodesToDownload = 3

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

    if (podcast) {
      this.construct(podcast)
    }
  }

  construct(podcast) {
    this.id = podcast.id
    this.libraryItemId = podcast.libraryItemId
    this.metadata = new PodcastMetadata(podcast.metadata)
    this.coverPath = podcast.coverPath
    this.tags = [...podcast.tags]
    this.episodes = podcast.episodes.map((e) => {
      var podcastEpisode = new PodcastEpisode(e)
      podcastEpisode.libraryItemId = this.libraryItemId
      return podcastEpisode
    })
    this.autoDownloadEpisodes = !!podcast.autoDownloadEpisodes
    this.autoDownloadSchedule = podcast.autoDownloadSchedule || '0 * * * *' // Added in 2.1.3 so default to hourly
    this.lastEpisodeCheck = podcast.lastEpisodeCheck || 0
    this.maxEpisodesToKeep = podcast.maxEpisodesToKeep || 0

    // Default is 3 but 0 is allowed
    if (typeof podcast.maxNewEpisodesToDownload !== 'number') {
      this.maxNewEpisodesToDownload = 3
    } else {
      this.maxNewEpisodesToDownload = podcast.maxNewEpisodesToDownload
    }
  }

  toJSON() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map((e) => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      metadata: this.metadata.toJSONMinified(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      numEpisodes: this.episodes.length,
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map((e) => e.toJSONExpanded()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }

  toJSONForMetadataFile() {
    return {
      tags: [...this.tags],
      title: this.metadata.title,
      author: this.metadata.author,
      description: this.metadata.description,
      releaseDate: this.metadata.releaseDate,
      genres: [...this.metadata.genres],
      feedURL: this.metadata.feedUrl,
      imageURL: this.metadata.imageUrl,
      itunesPageURL: this.metadata.itunesPageUrl,
      itunesId: this.metadata.itunesId,
      itunesArtistId: this.metadata.itunesArtistId,
      explicit: this.metadata.explicit,
      language: this.metadata.language,
      podcastType: this.metadata.type
    }
  }

  get size() {
    var total = 0
    this.episodes.forEach((ep) => (total += ep.size))
    return total
  }
  get duration() {
    let total = 0
    this.episodes.forEach((ep) => (total += ep.duration))
    return total
  }
  get numTracks() {
    return this.episodes.length
  }

  update(payload) {
    var json = this.toJSON()
    delete json.episodes // do not update media entities here
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (key === 'metadata') {
          if (this.metadata.update(payload.metadata)) {
            hasUpdates = true
          }
        } else if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[Podcast] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  updateEpisode(id, payload) {
    var episode = this.episodes.find((ep) => ep.id == id)
    if (!episode) return false
    return episode.update(payload)
  }

  updateCover(coverPath) {
    coverPath = filePathToPOSIX(coverPath)
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  getEpisode(episodeId) {
    if (!episodeId) return null

    // Support old episode ids for mobile downloads
    if (episodeId.startsWith('ep_')) return this.episodes.find((ep) => ep.oldEpisodeId == episodeId)

    return this.episodes.find((ep) => ep.id == episodeId)
  }
}
module.exports = Podcast
