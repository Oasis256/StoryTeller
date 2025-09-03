const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')
const achievementAdapter = require('../services/achievementAdapter')

/**
 * Manager for handling achievement definitions and checking logic
 */
class AchievementManager {
  constructor() {
    this.initialized = false
  }

  /**
   * Initialize achievement system
   */
  async init() {
    if (this.initialized) return
    
    Logger.info('[AchievementManager] Initializing achievement system')
    
    try {
      // Use the adapter to ensure achievement definitions
      await achievementAdapter.ensureAchievements()
      this.initialized = true
      Logger.info('[AchievementManager] Achievement system initialized successfully')
    } catch (error) {
      Logger.error('[AchievementManager] Failed to initialize achievement system', error)
    }
  }

  /**
   * Achievement definitions
   * These define all possible achievements in the system
   */
  get ACHIEVEMENT_DEFINITIONS() {
    return [
      // Listening time achievements
      {
        key: 'listening_time_1h',
        name: 'First Hour',
        description: 'Listen to 1 hour of audio',
        badgeIcon: 'timer',
        badgeColor: '#4caf50',
        category: 'listening',
        targetValue: 60 // minutes
      },
      {
        key: 'listening_time_5h',
        name: 'Audio Explorer',
        description: 'Listen to 5 hours of audio',
        badgeIcon: 'timer',
        badgeColor: '#4caf50',
        category: 'listening',
        targetValue: 300 // minutes
      },
      {
        key: 'listening_time_24h',
        name: 'Day Listener',
        description: 'Listen to 24 hours of audio',
        badgeIcon: 'timer',
        badgeColor: '#4caf50',
        category: 'listening',
        targetValue: 1440 // minutes
      },
      {
        key: 'listening_time_100h',
        name: 'Audio Enthusiast',
        description: 'Listen to 100 hours of audio',
        badgeIcon: 'timer',
        badgeColor: '#4caf50',
        category: 'listening',
        targetValue: 6000 // minutes
      },
      {
        key: 'listening_time_500h',
        name: 'Audio Aficionado',
        description: 'Listen to 500 hours of audio',
        badgeIcon: 'timer',
        badgeColor: '#ff9800',
        category: 'listening',
        targetValue: 30000 // minutes
      },
      {
        key: 'listening_time_1000h',
        name: 'Audio Master',
        description: 'Listen to 1,000 hours of audio',
        badgeIcon: 'timer',
        badgeColor: '#f44336',
        category: 'listening',
        targetValue: 60000 // minutes
      },
      
      // Streak achievements
      {
        key: 'streak_3_days',
        name: '3-Day Streak',
        description: 'Listen to audio for 3 consecutive days',
        badgeIcon: 'local_fire_department',
        badgeColor: '#ff9800',
        category: 'streak',
        targetValue: 3 // days
      },
      {
        key: 'streak_7_days',
        name: 'Weekly Streak',
        description: 'Listen to audio for 7 consecutive days',
        badgeIcon: 'local_fire_department',
        badgeColor: '#ff9800',
        category: 'streak',
        targetValue: 7 // days
      },
      {
        key: 'streak_30_days',
        name: 'Monthly Streak',
        description: 'Listen to audio for 30 consecutive days',
        badgeIcon: 'local_fire_department',
        badgeColor: '#f44336',
        category: 'streak',
        targetValue: 30 // days
      },
      {
        key: 'streak_365_days',
        name: 'Yearly Streak',
        description: 'Listen to audio for 365 consecutive days',
        badgeIcon: 'local_fire_department',
        badgeColor: '#9c27b0',
        category: 'streak',
        targetValue: 365 // days
      },
      
      // Book completion achievements
      {
        key: 'first_book',
        name: 'First Book Completed',
        description: 'Finish your first audiobook',
        badgeIcon: 'book',
        badgeColor: '#2196f3',
        category: 'milestone',
        targetValue: 1 // book
      },
      {
        key: 'books_5',
        name: 'Book Collector',
        description: 'Finish 5 audiobooks',
        badgeIcon: 'auto_stories',
        badgeColor: '#2196f3',
        category: 'milestone',
        targetValue: 5 // books
      },
      {
        key: 'books_10',
        name: 'Book Enthusiast',
        description: 'Finish 10 audiobooks',
        badgeIcon: 'auto_stories',
        badgeColor: '#2196f3',
        category: 'milestone',
        targetValue: 10 // books
      },
      {
        key: 'books_25',
        name: 'Bookworm',
        description: 'Finish 25 audiobooks',
        badgeIcon: 'auto_stories',
        badgeColor: '#f44336',
        category: 'milestone',
        targetValue: 25 // books
      },
      {
        key: 'books_50',
        name: 'Bibliophile',
        description: 'Finish 50 audiobooks',
        badgeIcon: 'auto_stories',
        badgeColor: '#f44336',
        category: 'milestone',
        targetValue: 50 // books
      },
      {
        key: 'books_100',
        name: 'Book Master',
        description: 'Finish 100 audiobooks',
        badgeIcon: 'auto_stories',
        badgeColor: '#9c27b0',
        category: 'milestone',
        targetValue: 100 // books
      },
      
      // Diversity achievements
      {
        key: 'authors_5',
        name: 'Author Explorer',
        description: 'Listen to books from 5 different authors',
        badgeIcon: 'diversity_3',
        badgeColor: '#9c27b0',
        category: 'diversity',
        targetValue: 5 // authors
      },
      {
        key: 'authors_10',
        name: 'Author Enthusiast',
        description: 'Listen to books from 10 different authors',
        badgeIcon: 'diversity_3',
        badgeColor: '#9c27b0',
        category: 'diversity',
        targetValue: 10 // authors
      },
      {
        key: 'series_complete_1',
        name: 'Series Completer',
        description: 'Complete your first book series',
        badgeIcon: 'playlist_add_check',
        badgeColor: '#ff5722',
        category: 'diversity',
        targetValue: 1 // series
      },
      {
        key: 'genres_5',
        name: 'Genre Explorer',
        description: 'Listen to books from 5 different genres',
        badgeIcon: 'category',
        badgeColor: '#ff5722',
        category: 'diversity',
        targetValue: 5 // genres
      }
    ]
  }

  /**
   * Make sure all achievement definitions exist in the database
   */
  async ensureAchievementDefinitions() {
    for (const achievementDef of this.ACHIEVEMENT_DEFINITIONS) {
      const existingAchievement = await Database.achievementModel.findOne({
        where: { key: achievementDef.key }
      })
      
      if (!existingAchievement) {
        Logger.debug(`[AchievementManager] Creating achievement definition: ${achievementDef.key}`)
        await Database.achievementModel.create(achievementDef)
      }
    }
  }

  /**
   * Update achievements for a user
   * 
   * @param {string} userId - The ID of the user to check achievements for
   * @returns {Promise<Object>} - Object containing new achievements that were unlocked
   */
  async updateUserAchievements(userId) {
    try {
      Logger.debug(`[AchievementManager] Checking achievements for user ${userId}`)
      return await achievementAdapter.updateUserAchievements(userId)
    } catch (error) {
      Logger.error('[AchievementManager] Error updating user achievements:', error)
      return { newAchievements: [], error: error.message }
    }
  }
  
  /**
   * Format a date as YYYY-MM-DD
   * 
   * @param {Date} date - Date object
   * @returns {string} - Formatted date
   */
  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  
  /**
   * Get all achievements
   * 
   * @returns {Promise<Array>} - All achievements
   */
  async getAllAchievements() {
    return await achievementAdapter.getAllAchievements()
  }
  
  /**
   * Get unlocked achievements for a user
   * 
   * @param {string} userId - The ID of the user
   * @returns {Promise<Array>} - User's unlocked achievements
   */
  async getUnlockedAchievements(userId) {
    return await achievementAdapter.getUnlockedAchievements(userId)
  }
  
  /**
   * Get recent unlocked achievements for a user
   * 
   * @param {string} userId - The ID of the user
   * @param {number} limit - Number of recent achievements to return
   * @returns {Promise<Array>} - User's recent unlocked achievements
   */
  async getRecentUnlockedAchievements(userId, limit = 5) {
    return await achievementAdapter.getRecentUnlockedAchievements(userId, limit)
  }
  
  /**
   * Get achievement progress for a user
   * 
   * @param {string} userId - The ID of the user
   * @returns {Promise<Array>} - User's achievement progress
   */
  async getUserAchievementProgress(userId) {
    return await achievementAdapter.getUserAchievementProgress(userId)
  }
  
  /**
   * Get achievement stats for a user
   * 
   * @param {string} userId - The ID of the user
   * @returns {Promise<Object>} - Achievement stats
   */
  async getUserAchievementStats(userId) {
    return await achievementAdapter.getUserAchievementStats(userId)
  }
  
  /**
   * Force unlock an achievement for a user (for testing)
   * 
   * @param {string} userId - The ID of the user
   * @param {string} achievementKey - The key of the achievement to unlock
   * @returns {Promise<Object>} - The unlocked achievement
   */
  async testUnlockAchievement(userId, achievementKey) {
    return await achievementAdapter.testUnlockAchievement(userId, achievementKey)
  }
}

// Create singleton instance
const manager = new AchievementManager()
module.exports = manager
