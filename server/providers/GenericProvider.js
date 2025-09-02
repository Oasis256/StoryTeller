const Logger = require('../Logger')

class GenericProvider {
  constructor() {
    this.name = 'Generic'
  }

  /**
   * Search for upcoming book - returns mock data for testing
   * @param {string} seriesName 
   * @param {string} authorName 
   * @returns {Promise<Object|null>}
   */
  async searchUpcomingBook(seriesName, authorName) {
    try {
      Logger.debug(`[GenericProvider] Mock search for: "${seriesName}" by "${authorName}"`)
      
      // For testing purposes, return mock data for specific series
      const mockBooks = this.getMockBooks()
      
      // Find a match based on series or author name similarity
      const match = mockBooks.find(book => 
        this.isPartialMatch(book.seriesName, seriesName) ||
        this.isPartialMatch(book.authorName, authorName)
      )
      
      if (match) {
        Logger.info(`[GenericProvider] Found mock upcoming book: "${match.title}"`)
        return match
      }
      
      Logger.debug('[GenericProvider] No mock data available for this series/author')
      return null
    } catch (error) {
      Logger.error('[GenericProvider] Search failed:', error)
      return null
    }
  }

  /**
   * Check if two strings are partially similar
   * @param {string} str1 
   * @param {string} str2 
   * @returns {boolean}
   */
  isPartialMatch(str1, str2) {
    if (!str1 || !str2) return false
    
    const normalize = str => str.toLowerCase().trim().replace(/[^\w\s]/g, '')
    const s1 = normalize(str1)
    const s2 = normalize(str2)
    
    // Check if one string contains the other
    return s1.includes(s2) || s2.includes(s1)
  }

  /**
   * Get mock book data for testing
   * @returns {Array}
   */
  getMockBooks() {
    const futureDate = new Date()
    futureDate.setMonth(futureDate.getMonth() + 6) // 6 months from now
    
    return [
      {
        title: 'The Next Adventure',
        description: 'The thrilling continuation of the beloved series. Our heroes face their greatest challenge yet as they venture into uncharted territories.',
        releaseDate: futureDate.toISOString().split('T')[0],
        coverUrl: null,
        sourceUrl: 'https://example.com/book-info',
        isbn: null,
        sequence: null,
        seriesName: 'Test Series',
        authorName: 'Test Author',
        extraData: {
          publisher: 'Example Publisher',
          pages: 350,
          language: 'English',
          mockData: true
        }
      },
      {
        title: 'Magic Unleashed',
        description: 'The wizarding world expands as new magical discoveries change everything we thought we knew.',
        releaseDate: futureDate.toISOString().split('T')[0],
        coverUrl: null,
        sourceUrl: 'https://example.com/magic-book',
        isbn: null,
        sequence: 8,
        seriesName: 'Harry Potter',
        authorName: 'J.K. Rowling',
        extraData: {
          publisher: 'Mock Publisher',
          pages: 500,
          language: 'English',
          mockData: true
        }
      },
      {
        title: 'The Final Quest',
        description: 'The epic conclusion to the fantasy saga that has captivated millions of readers worldwide.',
        releaseDate: futureDate.toISOString().split('T')[0],
        coverUrl: null,
        sourceUrl: 'https://example.com/final-quest',
        isbn: null,
        sequence: 12,
        seriesName: 'The Wheel of Time',
        authorName: 'Robert Jordan',
        extraData: {
          publisher: 'Fantasy Books Inc',
          pages: 800,
          language: 'English',
          mockData: true
        }
      }
    ]
  }

  /**
   * Get provider information
   * @returns {Object}
   */
  getInfo() {
    return {
      name: this.name,
      baseUrl: 'mock://generic-provider',
      supportedFeatures: [
        'mock_data',
        'testing'
      ],
      rateLimit: {
        requests: 1000,
        period: '1 hour'
      },
      description: 'Generic provider that returns mock data for testing purposes'
    }
  }
}

module.exports = GenericProvider