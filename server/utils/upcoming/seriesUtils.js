// utils/upcoming/seriesUtils.js
// Utilities for working with book series data and determining sequence information

const path = require('path')
const Logger = require('../../Logger')

class SeriesUtils {
  /**
   * Extracts series name and sequence from a book object.
   * @param {Object} book - Book object with media data
   * @returns {Object} - {name: string, seq: number}
   */
  static extractSeriesAndSequence(book) {
    const s = (Array.isArray(book.media?.series) ? book.media.series[0] : book.media?.series) || book.media?.dataValues?.series?.[0] || book.media?.dataValues?.series

    let name = s?.name || s?.dataValues?.name || null
    let seq = null

    // Try different ways to get sequence number
    if (s?.bookSeries?.dataValues?.sequence) {
      seq = Number(s.bookSeries.dataValues.sequence)
    } else if (s?.dataValues?.bookSeries?.dataValues?.sequence) {
      seq = Number(s.dataValues.bookSeries.dataValues.sequence)
    } else if (s?.dataValues?.sequence) {
      seq = Number(s.dataValues.sequence)
    } else if (s?.sequence) {
      seq = Number(s.sequence)
    }

    return { name, seq }
  }

  /**
   * Gets the current book's sequence number from series object.
   * @param {Object} seriesObj - Series object from book metadata
   * @returns {number|null} - Sequence number or null
   */
  static getCurrentBookSequence(seriesObj) {
    let sequence = null

    if (seriesObj.bookSeries?.dataValues?.sequence) {
      sequence = Number(seriesObj.bookSeries.dataValues.sequence)
    } else if (seriesObj.dataValues?.bookSeries?.dataValues?.sequence) {
      sequence = Number(seriesObj.dataValues.bookSeries.dataValues.sequence)
    } else if (seriesObj.dataValues?.sequence) {
      sequence = Number(seriesObj.dataValues.sequence)
    } else if (seriesObj.sequence) {
      sequence = Number(seriesObj.sequence)
    }

    // Logger.info(`[SeriesUtils 1.0] Extracted sequence: ${sequence}`)
    return sequence
  }

  /**
   * Finds all books in the same series from a collection of books.
   * @param {Array} allBooks - All books to search through
   * @param {string} seriesName - Name of the series to filter by
   * @returns {Array} - Books in the same series
   */
  static getBooksInSeries(allBooks, seriesName) {
    return allBooks.filter((book) => {
      const { name } = this.extractSeriesAndSequence(book)
      return name && name === seriesName
    })
  }

  /**
   * Gets the maximum sequence number in a series.
   * @param {Array} seriesBooks - Books in the series
   * @returns {number|null} - Maximum sequence number or null
   */
  static getMaxSequenceInSeries(seriesBooks) {
    const allSequences = seriesBooks.map((book) => this.extractSeriesAndSequence(book).seq).filter((seq) => typeof seq === 'number' && !isNaN(seq))

    const maxSequence = allSequences.length > 0 ? Math.max(...allSequences) : null
    // Logger.info(`[SeriesUtils 2.0] Max sequence in series: ${maxSequence}`)
    return maxSequence
  }

  /**
   * Checks if a book is the last in its series based on sequence numbers.
   * @param {number} currentSequence - Current book's sequence
   * @param {number} maxSequence - Maximum sequence in series
   * @returns {boolean} - True if this is the last book
   */
  static isLastInSequence(currentSequence, maxSequence) {
    const isLast = currentSequence !== null && maxSequence !== null && currentSequence === maxSequence

    // Logger.info(`[SeriesUtils 3.0] Is last in sequence: ${isLast} (current: ${currentSequence}, max: ${maxSequence})`)
    return isLast
  }

  /**
   * Extracts series and author information from library item metadata.
   * @param {Object} libraryItem - Library item with media data
   * @returns {Object} - {series, authors, seriesName, authorName}
   */
  static extractSeriesAndAuthorInfo(libraryItem) {
    const metadata = libraryItem.media.metadata || libraryItem.media.dataValues?.metadata
    let series = metadata?.series || libraryItem.media.series || libraryItem.media.dataValues?.series
    let authors = metadata?.authors || libraryItem.media.authors || libraryItem.media.dataValues?.authors

    // If still not found, try to get from dataValues (Sequelize style)
    if (!series && libraryItem.media.dataValues) {
      series = libraryItem.media.dataValues.series
    }
    if (!authors && libraryItem.media.dataValues) {
      authors = libraryItem.media.dataValues.authors
    }

    const seriesObj = Array.isArray(series) ? series[0] : series
    const authorObj = Array.isArray(authors) ? authors[0] : authors
    const seriesName = seriesObj?.name || seriesObj?.dataValues?.name || ''
    const authorName = authorObj?.name || authorObj?.fullName || authorObj || ''

    // Logger.info(`[SeriesUtils 4.0] Extracted - Series: "${seriesName}", Author: "${authorName}"`)

    return {
      series: seriesObj,
      authors: authorObj,
      seriesName,
      authorName
    }
  }

  /**
   * Gets the common parent directory for all files in a series.
   * @param {Array<string>} filePaths - Array of absolute file paths for all books in the series
   * @returns {string|null} - The common parent directory, or null if input is empty
   */
  static getSeriesParentFolder(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      Logger.warn('[SeriesUtils 5.0] No file paths provided for series parent folder calculation')
      return null
    }

    if (filePaths.length === 1) {
      return path.dirname(filePaths[0])
    }

    // Find common path prefix
    const splitPaths = filePaths.map((fp) => fp.split(path.sep))
    let commonParts = splitPaths[0]

    for (let i = 1; i < splitPaths.length; i++) {
      let j = 0
      while (j < commonParts.length && j < splitPaths[i].length && commonParts[j] === splitPaths[i][j]) {
        j++
      }
      commonParts = commonParts.slice(0, j)
      if (commonParts.length === 0) break
    }

    const result = commonParts.length > 0 ? commonParts.join(path.sep) : null
    Logger.info(`[SeriesUtils 5.1] Series parent folder: ${result}`)
    return result
  }

  /**
   * Validates that required series and author information is present.
   * @param {Object} info - Object containing series and author info
   * @returns {boolean} - True if valid
   */
  static validateSeriesInfo({ series, authors, seriesName, authorName }) {
    const isValid = !!(series && authors && seriesName && authorName)

    if (!isValid) {
      Logger.warn('[SeriesUtils 6.0] Missing required series or author information', {
        hasSeries: !!series,
        hasAuthors: !!authors,
        seriesName,
        authorName
      })
    }

    return isValid
  }

  /**
   * Checks if the given book is the last in its series in the user's library.
   * @param {Object} book - The book object (with metadata)
   * @param {Array} libraryBooks - All books in the user's library
   * @returns {boolean}
   */
  static isLastInSeries(book, libraryBooks) {
    if (!book.series || !book.series.name || !book.series.sequence) {
      return false
    }

    const seriesBooks = libraryBooks.filter((b) => b.series && b.series.name === book.series.name)

    if (!seriesBooks.length) return false

    const maxSeq = Math.max(...seriesBooks.map((b) => Number(b.series.sequence) || 0))
    return Number(book.series.sequence) === maxSeq
  }
}

module.exports = SeriesUtils
// End of seriesUtils.js
// This utility provides functions for extracting series and sequence information from book metadata, validating series data,
// and determining if a book is the last in its series. It also includes methods for finding
// books in a series, getting the maximum sequence number, and extracting series and author information from library items.
// SeriesUtils.js (Handles series-related operations for upcoming books)
