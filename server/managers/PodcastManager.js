const fs = require('fs-extra')
const cron = require('node-cron')
const axios = require('axios')

const { parsePodcastRssFeedXml } = require('../utils/podcastUtils')
const Logger = require('../Logger')

const { downloadFile } = require('../utils/fileUtils')
const prober = require('../utils/prober')
const LibraryFile = require('../objects/files/LibraryFile')
const PodcastEpisodeDownload = require('../objects/PodcastEpisodeDownload')
const PodcastEpisode = require('../objects/entities/PodcastEpisode')
const AudioFile = require('../objects/files/AudioFile')

class PodcastManager {
  constructor(db, watcher, emitter) {
    this.db = db
    this.watcher = watcher
    this.emitter = emitter

    this.downloadQueue = []
    this.currentDownload = null

    this.episodeScheduleTask = null
  }

  get serverSettings() {
    return this.db.serverSettings || {}
  }

  init() {
    var podcastsWithAutoDownload = this.db.libraryItems.some(li => li.mediaType === 'podcast' && li.media.autoDownloadEpisodes)
    if (podcastsWithAutoDownload) {
      this.schedulePodcastEpisodeCron()
    }
  }

  getEpisodeDownloadsInQueue(libraryItemId) {
    return this.downloadQueue.filter(d => d.libraryItemId === libraryItemId)
  }

  clearDownloadQueue(libraryItemId = null) {
    if (!this.downloadQueue.length) return

    if (!libraryItemId) {
      Logger.info(`[PodcastManager] Clearing all downloads in queue (${this.downloadQueue.length})`)
      this.downloadQueue = []
    } else {
      var itemDownloads = this.getEpisodeDownloadsInQueue(libraryItemId)
      Logger.info(`[PodcastManager] Clearing downloads in queue for item "${libraryItemId}" (${itemDownloads.length})`)
      this.downloadQueue = this.downloadQueue.filter(d => d.libraryItemId !== libraryItemId)
    }
  }

  async downloadPodcastEpisodes(libraryItem, episodesToDownload) {
    var index = libraryItem.media.episodes.length + 1
    episodesToDownload.forEach((ep) => {
      var newPe = new PodcastEpisode()
      newPe.setData(ep, index++)
      newPe.libraryItemId = libraryItem.id
      var newPeDl = new PodcastEpisodeDownload()
      newPeDl.setData(newPe, libraryItem)
      this.startPodcastEpisodeDownload(newPeDl)
    })
  }

  async startPodcastEpisodeDownload(podcastEpisodeDownload) {
    if (this.currentDownload) {
      this.downloadQueue.push(podcastEpisodeDownload)
      this.emitter('episode_download_queued', podcastEpisodeDownload.toJSONForClient())
      return
    }

    this.emitter('episode_download_started', podcastEpisodeDownload.toJSONForClient())
    this.currentDownload = podcastEpisodeDownload

    // Ignores all added files to this dir
    this.watcher.addIgnoreDir(this.currentDownload.libraryItem.path)

    var success = await downloadFile(this.currentDownload.url, this.currentDownload.targetPath).then(() => true).catch((error) => {
      Logger.error(`[PodcastManager] Podcast Episode download failed`, error)
      return false
    })
    if (success) {
      success = await this.scanAddPodcastEpisodeAudioFile()
      if (!success) {
        await fs.remove(this.currentDownload.targetPath)
        this.currentDownload.setFinished(false)
      } else {
        Logger.info(`[PodcastManager] Successfully downloaded podcast episode "${this.currentDownload.podcastEpisode.title}"`)
        this.currentDownload.setFinished(true)
      }
    } else {
      this.currentDownload.setFinished(false)
    }

    this.emitter('episode_download_finished', this.currentDownload.toJSONForClient())

    this.watcher.removeIgnoreDir(this.currentDownload.libraryItem.path)
    this.currentDownload = null
    if (this.downloadQueue.length) {
      this.startPodcastEpisodeDownload(this.downloadQueue.shift())
    }
  }

  async scanAddPodcastEpisodeAudioFile() {
    var libraryFile = await this.getLibraryFile(this.currentDownload.targetPath, this.currentDownload.targetRelPath)

    // TODO: Set meta tags on new audio file

    var audioFile = await this.probeAudioFile(libraryFile)
    if (!audioFile) {
      return false
    }

    var libraryItem = this.db.libraryItems.find(li => li.id === this.currentDownload.libraryItem.id)
    if (!libraryItem) {
      Logger.error(`[PodcastManager] Podcast Episode finished but library item was not found ${this.currentDownload.libraryItem.id}`)
      return false
    }

    var podcastEpisode = this.currentDownload.podcastEpisode
    podcastEpisode.audioFile = audioFile
    libraryItem.media.addPodcastEpisode(podcastEpisode)
    libraryItem.libraryFiles.push(libraryFile)
    libraryItem.updatedAt = Date.now()
    await this.db.updateLibraryItem(libraryItem)
    this.emitter('item_updated', libraryItem.toJSONExpanded())
    return true
  }

  async getLibraryFile(path, relPath) {
    var newLibFile = new LibraryFile()
    await newLibFile.setDataFromPath(path, relPath)
    return newLibFile
  }

  async probeAudioFile(libraryFile) {
    var path = libraryFile.metadata.path
    var audioProbeData = await prober.probe(path)
    if (audioProbeData.error) {
      Logger.error(`[PodcastManager] Podcast Episode downloaded but failed to probe "${path}"`, audioProbeData.error)
      return false
    }
    var newAudioFile = new AudioFile()
    newAudioFile.setDataFromProbe(libraryFile, audioProbeData)
    return newAudioFile
  }

  schedulePodcastEpisodeCron() {
    try {
      Logger.debug(`[PodcastManager] Scheduled podcast episode check cron "${this.serverSettings.podcastEpisodeSchedule}"`)
      this.episodeScheduleTask = cron.schedule(this.serverSettings.podcastEpisodeSchedule, this.checkForNewEpisodes.bind(this))
    } catch (error) {
      Logger.error(`[PodcastManager] Failed to schedule podcast cron ${this.serverSettings.podcastEpisodeSchedule}`, error)
    }
  }

  cancelCron() {
    Logger.debug(`[PodcastManager] Canceled new podcast episode check cron`)
    if (this.episodeScheduleTask) {
      this.episodeScheduleTask.destroy()
      this.episodeScheduleTask = null
    }
  }

  async checkForNewEpisodes() {
    var podcastsWithAutoDownload = this.db.libraryItems.filter(li => li.mediaType === 'podcast' && li.media.autoDownloadEpisodes)
    if (!podcastsWithAutoDownload.length) {
      this.cancelCron()
      return
    }

    for (const libraryItem of podcastsWithAutoDownload) {
      const lastEpisodeCheckDate = new Date(libraryItem.media.lastEpisodeCheck || 0)
      Logger.info(`[PodcastManager] checkForNewEpisodes Cron for "${libraryItem.media.metadata.title}" - Last episode check: ${lastEpisodeCheckDate}`)
      var newEpisodes = await this.checkPodcastForNewEpisodes(libraryItem)

      if (!newEpisodes) { // Failed
        libraryItem.media.autoDownloadEpisodes = false
      } else if (newEpisodes.length) {
        Logger.info(`[PodcastManager] Found ${newEpisodes.length} new episodes for podcast "${libraryItem.media.metadata.title}" - starting download`)
        this.downloadPodcastEpisodes(libraryItem, newEpisodes)
      } else {
        Logger.debug(`[PodcastManager] No new episodes for "${libraryItem.media.metadata.title}"`)
      }

      libraryItem.media.lastEpisodeCheck = Date.now()
      libraryItem.updatedAt = Date.now()
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
    }
  }

  async checkPodcastForNewEpisodes(podcastLibraryItem) {
    if (!podcastLibraryItem.media.metadata.feedUrl) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes no feed url for ${podcastLibraryItem.media.metadata.title} (ID: ${podcastLibraryItem.id}) - disabling auto download`)
      return false
    }
    var feed = await this.getPodcastFeed(podcastLibraryItem.media.metadata.feedUrl)
    if (!feed || !feed.episodes) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes invalid feed payload for ${podcastLibraryItem.media.metadata.title} (ID: ${podcastLibraryItem.id}) - disabling auto download`)
      return false
    }
    // Filter new and not already has
    var newEpisodes = feed.episodes.filter(ep => ep.publishedAt > podcastLibraryItem.media.lastEpisodeCheck && !podcastLibraryItem.media.checkHasEpisodeByFeedUrl(ep.enclosure.url))
    // Max new episodes for safety = 2
    newEpisodes = newEpisodes.slice(0, 2)
    return newEpisodes
  }

  getPodcastFeed(feedUrl) {
    return axios.get(feedUrl).then(async (data) => {
      if (!data || !data.data) {
        Logger.error('Invalid podcast feed request response')
        return false
      }
      var payload = await parsePodcastRssFeedXml(data.data)
      if (!payload) {
        return false
      }
      return payload.podcast
    }).catch((error) => {
      console.error('Failed', error)
      return false
    })
  }
}
module.exports = PodcastManager