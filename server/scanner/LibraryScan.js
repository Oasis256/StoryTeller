const Path = require('path')
const fs = require('../libs/fsExtra')
const date = require('../libs/dateAndTime')

const Logger = require('../Logger')
const Library = require('../objects/Library')
const { LogLevel } = require('../utils/constants')
const filePerms = require('../utils/filePerms')
const { getId, secondsToTimestamp } = require('../utils/index')

class LibraryScan {
  constructor() {
    this.id = null
    this.type = null
    this.library = null
    this.verbose = false

    this.scanOptions = null

    this.startedAt = null
    this.finishedAt = null
    this.elapsed = null

    this.resultsMissing = 0
    this.resultsAdded = 0
    this.resultsUpdated = 0

    this.logs = []
  }

  get libraryId() { return this.library.id }
  get libraryName() { return this.library.name }
  get libraryMediaType() { return this.library.mediaType }
  get folders() { return this.library.folders }

  get _scanOptions() { return this.scanOptions || {} }
  get forceRescan() { return !!this._scanOptions.forceRescan }
  get preferAudioMetadata() { return !!this._scanOptions.preferAudioMetadata }
  get preferOpfMetadata() { return !!this._scanOptions.preferOpfMetadata }
  get preferOverdriveMediaMarker() { return !!this._scanOptions.preferOverdriveMediaMarker }
  get findCovers() { return !!this._scanOptions.findCovers }
  get timestamp() {
    return (new Date()).toISOString()
  }

  get resultStats() {
    return `${this.resultsAdded} Added | ${this.resultsUpdated} Updated | ${this.resultsMissing} Missing`
  }
  get elapsedTimestamp() {
    return secondsToTimestamp(this.elapsed / 1000)
  }
  get getScanEmitData() {
    return {
      id: this.libraryId,
      type: this.type,
      name: this.libraryName,
      results: {
        added: this.resultsAdded,
        updated: this.resultsUpdated,
        missing: this.resultsMissing
      }
    }
  }
  get totalResults() {
    return this.resultsAdded + this.resultsUpdated + this.resultsMissing
  }
  get logFilename() {
    return date.format(new Date(), 'YYYY-MM-DD') + '_' + this.id + '.txt'
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      library: this.library.toJSON(),
      scanOptions: this.scanOptions ? this.scanOptions.toJSON() : null,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsed: this.elapsed,
      resultsAdded: this.resultsAdded,
      resultsUpdated: this.resultsUpdated,
      resultsMissing: this.resultsMissing
    }
  }

  setData(library, scanOptions, type = 'scan') {
    this.id = getId('lscan')
    this.type = type
    this.library = new Library(library.toJSON()) // clone library

    this.scanOptions = scanOptions

    this.startedAt = Date.now()
  }

  setComplete() {
    this.finishedAt = Date.now()
    this.elapsed = this.finishedAt - this.startedAt
  }

  getLogLevelString(level) {
    for (const key in LogLevel) {
      if (LogLevel[key] === level) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  addLog(level, ...args) {
    const logObj = {
      timestamp: this.timestamp,
      message: args.join(' '),
      levelName: this.getLogLevelString(level),
      level
    }

    if (this.verbose) {
      Logger.debug(`[LibraryScan] "${this.libraryName}":`, args)
    }
    this.logs.push(logObj)
  }

  async saveLog() {
    await Logger.logManager.ensureScanLogDir()

    const logDir = Path.join(global.MetadataPath, 'logs', 'scans')
    const outputPath = Path.join(logDir, this.logFilename)
    const logLines = [JSON.stringify(this.toJSON())]
    this.logs.forEach(l => {
      logLines.push(JSON.stringify(l))
    })
    await fs.writeFile(outputPath, logLines.join('\n') + '\n')
    await filePerms.setDefault(outputPath)

    Logger.info(`[LibraryScan] Scan log saved "${outputPath}"`)
  }
}
module.exports = LibraryScan