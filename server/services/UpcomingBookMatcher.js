const Logger = require('../Logger')
const { levenshteinSimilarity } = require('../utils/index')

/**
 * Intelligent matching service for upcoming books
 * Uses multiple algorithms to score and rank potential matches
 */
class UpcomingBookMatcher {
  constructor() {
    this.weights = {
      sequence: 0.4,      // Sequential match (most important)
      author: 0.25,       // Author similarity
      series: 0.2,        // Series name similarity
      releaseDate: 0.1,   // Future release date
      title: 0.05         // Title patterns
    }
    
    this.thresholds = {
      minimum: 0.6,       // Minimum confidence to accept
      excellent: 0.9,     // Excellent match
      good: 0.75,         // Good match
      fair: 0.6           // Fair match
    }
  }

  /**
   * Score and rank multiple candidates
   */
  async scoreUpcomingCandidates(candidates, libraryItem, allLibraryBooks) {
    if (!candidates || candidates.length === 0) return []

    const seriesInfo = this.extractSeriesInfo(libraryItem)
    const maxSequence = this.calculateMaxSequence(seriesInfo.seriesName, allLibraryBooks)
    
    const scoredCandidates = candidates.map(candidate => {
      const score = this.calculateMatchScore(candidate, seriesInfo, maxSequence)
      return {
        ...candidate,
        matchScore: score.total,
        matchDetails: score.breakdown,
        ranking: this.getRanking(score.total)
      }
    })

    // Sort by score and filter by minimum threshold
    // Use lower threshold for RisingShadow since it's a specialized fallback
    return scoredCandidates
      .filter(c => {
        const threshold = (c.source === 'RisingShadow' || c.source === 'risingshadow') 
          ? 0.35  // Even lower threshold for RisingShadow fallback
          : this.thresholds.minimum
        return c.matchScore >= threshold
      })
      .sort((a, b) => b.matchScore - a.matchScore)
  }

  /**
   * Calculate comprehensive match score
   */
  calculateMatchScore(candidate, seriesInfo, maxSequence) {
    const breakdown = {
      sequence: this.scoreSequenceMatch(candidate, maxSequence),
      author: this.scoreAuthorMatch(candidate, seriesInfo.authorName),
      series: this.scoreSeriesMatch(candidate, seriesInfo.seriesName),
      releaseDate: this.scoreReleaseDateMatch(candidate),
      title: this.scoreTitlePatterns(candidate, seriesInfo.seriesName, maxSequence)
    }

    // Calculate weighted total
    const total = Object.entries(breakdown).reduce((sum, [key, score]) => {
      return sum + (score * this.weights[key])
    }, 0)

    return {
      total: Math.min(1.0, Math.max(0.0, total)),
      breakdown
    }
  }

  /**
   * Score sequence match (most important factor)
   */
  scoreSequenceMatch(candidate, maxSequence) {
    const expectedSequence = maxSequence + 1
    
    // Check explicit sequence in candidate
    if (candidate.sequence) {
      const candidateSeq = parseFloat(candidate.sequence)
      if (candidateSeq === expectedSequence) return 1.0
      if (candidateSeq === expectedSequence + 1) return 0.8  // Next book after expected
      if (candidateSeq > maxSequence && candidateSeq <= maxSequence + 3) return 0.7  // Future book within reasonable range
      if (candidateSeq > maxSequence) return 0.5  // Future book (still valid)
      return 0.2  // Past book (low score)
    }

    // Check sequence in title
    const titleSequence = this.extractSequenceFromTitle(candidate.title)
    if (titleSequence) {
      if (titleSequence === expectedSequence) return 0.9
      if (titleSequence === expectedSequence + 1) return 0.75  // Next book after expected
      if (titleSequence > maxSequence && titleSequence <= maxSequence + 3) return 0.65  // Future book within reasonable range
      if (titleSequence > maxSequence) return 0.45  // Future book (still valid)
      return 0.1  // Past or unrelated book
    }

    // No sequence info - neutral score
    return 0.4
  }

  /**
   * Score author name similarity
   */
  scoreAuthorMatch(candidate, targetAuthor) {
    // Be more forgiving of missing author for RisingShadow results
    if (!candidate.author && (candidate.source === 'risingshadow' || candidate.source === 'RisingShadow')) {
      return 0.6  // Neutral score for RisingShadow missing authors
    }
    if (!candidate.author || !targetAuthor) return 0.0
    
    const similarity = levenshteinSimilarity(
      this.normalizeAuthorName(candidate.author),
      this.normalizeAuthorName(targetAuthor)
    )
    
    // Boost score for exact matches
    if (similarity >= 0.95) return 1.0
    if (similarity >= 0.85) return 0.9
    if (similarity >= 0.7) return similarity
    
    return Math.max(0.0, similarity - 0.2) // Penalty for low similarity
  }

  /**
   * Score series name similarity
   */
  scoreSeriesMatch(candidate, targetSeries) {
    if (!targetSeries) return 0.5  // Neutral if no target series
    
    const candidateSeries = candidate.series || this.extractSeriesFromTitle(candidate.title)
    if (!candidateSeries) return 0.3  // Lower score if no series info
    
    const similarity = levenshteinSimilarity(
      this.normalizeSeriesName(candidateSeries),
      this.normalizeSeriesName(targetSeries)
    )
    
    if (similarity >= 0.9) return 1.0
    if (similarity >= 0.75) return 0.8
    if (similarity >= 0.6) return similarity
    
    return Math.max(0.0, similarity - 0.1)
  }

  /**
   * Score release date (future releases preferred)
   */
  scoreReleaseDateMatch(candidate) {
    if (!candidate.releaseDate && !candidate.release) return 0.3
    
    const releaseDate = new Date(candidate.releaseDate || candidate.release)
    const now = new Date()
    
    if (isNaN(releaseDate.getTime())) return 0.2  // Invalid date
    
    if (releaseDate <= now) return 0.1  // Already released
    
    // Future releases get higher scores
    const daysInFuture = (releaseDate - now) / (1000 * 60 * 60 * 24)
    
    if (daysInFuture <= 365) return 1.0    // Within a year
    if (daysInFuture <= 730) return 0.8    // Within 2 years
    if (daysInFuture <= 1095) return 0.6   // Within 3 years
    
    return 0.4  // More than 3 years out
  }

  /**
   * Score title patterns
   */
  scoreTitlePatterns(candidate, targetSeries, maxSequence) {
    if (!candidate.title) return 0.0
    
    const title = candidate.title.toLowerCase()
    const series = targetSeries?.toLowerCase() || ''
    
    let score = 0.0
    
    // Contains series name
    if (series && title.includes(series)) {
      score += 0.4
    }
    
    // Contains expected sequence
    const expectedSeq = maxSequence + 1
    const sequencePatterns = [
      `book ${expectedSeq}`,
      `#${expectedSeq}`,
      ` ${expectedSeq}:`,
      ` ${expectedSeq} `,
      ` ${expectedSeq}$`
    ]
    
    for (const pattern of sequencePatterns) {
      if (title.includes(pattern) || title.match(new RegExp(pattern))) {
        score += 0.6
        break
      }
    }
    
    // Common upcoming book indicators
    const upcomingIndicators = [
      'upcoming', 'coming soon', 'preorder', 'pre-order',
      'release', 'new', 'next', 'continues', 'returns'
    ]
    
    for (const indicator of upcomingIndicators) {
      if (title.includes(indicator)) {
        score += 0.2
        break
      }
    }
    
    return Math.min(1.0, score)
  }

  /**
   * Extract sequence number from title
   */
  extractSequenceFromTitle(title) {
    if (!title) return null
    
    const patterns = [
      /book\s+(\d+)/i,
      /#(\d+)/,
      /volume\s+(\d+)/i,
      /vol\.?\s+(\d+)/i,
      /part\s+(\d+)/i,
      /\b(\d+):/,
      /\s(\d+)$/,
      /\s(\d+)\b/
    ]
    
    for (const pattern of patterns) {
      const match = title.match(pattern)
      if (match) {
        return parseInt(match[1])
      }
    }
    
    return null
  }

  /**
   * Extract series name from title
   */
  extractSeriesFromTitle(title) {
    if (!title) return null
    
    // Remove common patterns that indicate sequence
    const cleaned = title
      .replace(/book\s+\d+/i, '')
      .replace(/#\d+/, '')
      .replace(/volume\s+\d+/i, '')
      .replace(/vol\.?\s+\d+/i, '')
      .replace(/part\s+\d+/i, '')
      .replace(/:\s*.*$/, '')  // Remove subtitle
      .trim()
    
    return cleaned || null
  }

  /**
   * Normalize author name for comparison
   */
  normalizeAuthorName(author) {
    return author
      .toLowerCase()
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Normalize series name for comparison
   */
  normalizeSeriesName(series) {
    return series
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\bthe\b|\ban\b|\ba\b/g, '')  // Remove articles
      .trim()
  }

  /**
   * Get ranking based on score
   */
  getRanking(score) {
    if (score >= this.thresholds.excellent) return 'excellent'
    if (score >= this.thresholds.good) return 'good'
    if (score >= this.thresholds.fair) return 'fair'
    return 'poor'
  }

  /**
   * Extract series info from library item
   */
  extractSeriesInfo(libraryItem) {
    const media = libraryItem.media
    const metadata = media.metadata || media
    
    return {
      seriesName: metadata.series?.[0]?.name || null,
      authorName: metadata.authorName || metadata.authors?.[0]?.name || null,
      currentSequence: metadata.series?.[0]?.sequence || null
    }
  }

  /**
   * Calculate max sequence in series
   */
  calculateMaxSequence(seriesName, allLibraryBooks) {
    if (!seriesName || !allLibraryBooks) return 0
    
    const seriesBooks = allLibraryBooks
      .filter(book => {
        const media = book.media
        const metadata = media.metadata || media
        return metadata.series?.some(s => 
          s.name?.toLowerCase() === seriesName.toLowerCase()
        )
      })
      .map(book => {
        const media = book.media
        const metadata = media.metadata || media
        const series = metadata.series?.find(s => 
          s.name?.toLowerCase() === seriesName.toLowerCase()
        )
        return parseFloat(series?.sequence || 0)
      })
      .filter(seq => !isNaN(seq) && seq > 0)
    
    return seriesBooks.length > 0 ? Math.max(...seriesBooks) : 0
  }

  /**
   * Validate match quality
   */
  validateMatch(candidate, minimumScore = null) {
    const threshold = minimumScore || this.thresholds.minimum
    
    return {
      isValid: candidate.matchScore >= threshold,
      score: candidate.matchScore,
      ranking: candidate.ranking,
      confidence: this.getConfidenceLevel(candidate.matchScore),
      reasons: this.getMatchReasons(candidate.matchDetails)
    }
  }

  /**
   * Get confidence level description
   */
  getConfidenceLevel(score) {
    if (score >= 0.9) return 'Very High'
    if (score >= 0.75) return 'High'
    if (score >= 0.6) return 'Medium'
    if (score >= 0.4) return 'Low'
    return 'Very Low'
  }

  /**
   * Generate human-readable match reasons
   */
  getMatchReasons(breakdown) {
    const reasons = []
    
    if (breakdown.sequence > 0.8) reasons.push('Strong sequence match')
    if (breakdown.author > 0.8) reasons.push('Author name match')
    if (breakdown.series > 0.8) reasons.push('Series name match')
    if (breakdown.releaseDate > 0.8) reasons.push('Future release date')
    if (breakdown.title > 0.6) reasons.push('Title pattern match')
    
    return reasons
  }
}

module.exports = UpcomingBookMatcher