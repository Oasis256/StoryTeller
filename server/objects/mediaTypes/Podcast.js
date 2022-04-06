const Logger = require('../../Logger')
const PodcastEpisode = require('../entities/PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')
const { createNewSortInstance } = require('fast-sort')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

class Podcast {
  constructor(podcast) {
    this.libraryItemId = null
    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.episodes = []

    this.autoDownloadEpisodes = false
    this.lastEpisodeCheck = 0

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

    if (podcast) {
      this.construct(podcast)
    }
  }

  construct(podcast) {
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
    this.lastEpisodeCheck = podcast.lastEpisodeCheck || 0
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      lastEpisodeCheck: this.lastEpisodeCheck
    }
  }

  toJSONMinified() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      lastEpisodeCheck: this.lastEpisodeCheck,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSONExpanded()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      lastEpisodeCheck: this.lastEpisodeCheck,
      size: this.size
    }
  }

  get size() {
    var total = 0
    this.episodes.forEach((ep) => total += ep.size)
    return total
  }
  get hasMediaEntities() {
    return !!this.episodes.length
  }
  get shouldSearchForCover() {
    return false
  }
  get hasEmbeddedCoverArt() {
    return this.episodes.some(ep => ep.audioFile.embeddedCoverArt)
  }
  get hasIssues() {
    return false
  }
  get duration() {
    var total = 0
    this.episodes.forEach((ep) => total += ep.duration)
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
    var episode = this.episodes.find(ep => ep.id == id)
    if (!episode) return false
    return episode.update(payload)
  }

  updateCover(coverPath) {
    coverPath = coverPath.replace(/\\/g, '/')
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  removeFileWithInode(inode) {
    this.episodes = this.episodes.filter(ep => ep.ino !== inode)
  }

  findFileWithInode(inode) {
    var episode = this.episodes.find(ep => ep.audioFile.ino === inode)
    if (episode) return episode.audioFile
    return null
  }

  setData(mediaMetadata) {
    this.metadata = new PodcastMetadata()
    if (mediaMetadata.metadata) {
      this.metadata.setData(mediaMetadata.metadata)
    }

    this.coverPath = mediaMetadata.coverPath || null
    this.autoDownloadEpisodes = !!mediaMetadata.autoDownloadEpisodes
    this.lastEpisodeCheck = Date.now() // Makes sure new episodes are after this
  }

  async syncMetadataFiles(textMetadataFiles, opfMetadataOverrideDetails) {
    return false
  }

  searchQuery(query) {
    var payload = this.metadata.searchQuery(query)
    return payload || {}
  }

  checkHasEpisode(episodeId) {
    return this.episodes.some(ep => ep.id === episodeId)
  }
  checkHasEpisodeByFeedUrl(url) {
    return this.episodes.some(ep => ep.checkEqualsEnclosureUrl(url))
  }

  // Only checks container format
  checkCanDirectPlay(payload, episodeId) {
    var episode = this.episodes.find(ep => ep.id === episodeId)
    if (!episode) return false
    return episode.checkCanDirectPlay(payload)
  }

  getDirectPlayTracklist(episodeId) {
    var episode = this.episodes.find(ep => ep.id === episodeId)
    if (!episode) return false
    return episode.getDirectPlayTracklist()
  }

  addPodcastEpisode(podcastEpisode) {
    this.episodes.push(podcastEpisode)
  }

  addNewEpisodeFromAudioFile(audioFile, index) {
    var pe = new PodcastEpisode()
    pe.libraryItemId = this.libraryItemId
    pe.setDataFromAudioFile(audioFile, index)
    this.episodes.push(pe)
  }

  setEpisodeOrder(episodeIds) {
    this.episodes = this.episodes.map(ep => {
      var indexOf = episodeIds.findIndex(id => id === ep.id)
      ep.index = indexOf + 1
      return ep
    })
    this.episodes.sort((a, b) => b.index - a.index)
  }

  reorderEpisodes() {
    var hasUpdates = false
    this.episodes = naturalSort(this.episodes).asc((ep) => ep.bestFilename)
    for (let i = 0; i < this.episodes.length; i++) {
      if (this.episodes[i].index !== (i + 1)) {
        this.episodes[i].index = i + 1
        hasUpdates = true
      }
    }
    this.episodes.sort((a, b) => b.index - a.index)
    return hasUpdates
  }

  removeEpisode(episodeId) {
    this.episodes = this.episodes.filter(ep => ep.id !== episodeId)
  }

  getPlaybackTitle(episodeId) {
    var episode = this.episodes.find(ep => ep.id == episodeId)
    if (!episode) return this.metadata.title
    return episode.title
  }

  getPlaybackAuthor() {
    return this.metadata.author
  }
}
module.exports = Podcast