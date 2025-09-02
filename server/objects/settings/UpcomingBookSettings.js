const Logger = require('../../Logger')

class UpcomingBookSettings {
  constructor(settings) {
    this.id = 'upcoming-book-settings'

    // Provider Settings
    this.providerOrder = ['cache', 'audible', 'google', 'openlibrary', 'risingshadow']
    this.providerTimeouts = {
      audible: 30000,
      google: 15000,
      openlibrary: 15000,
      risingshadow: 45000 // Increased timeout for web scraping
    }

    // Cache Settings - Two-layer: Memory + File
    this.cacheEnabled = true
    this.cacheTTL = {
      memory: 30 * 60 * 1000, // 30 minutes
      file: 6 * 60 * 60 * 1000 // 6 hours
    }
    this.cacheSize = {
      memory: 100,
      file: 1000
    }

    // Discovery Settings
    this.discoveryEnabled = true
    this.discoveryTimeout = 60000 // 60 seconds
    this.discoveryRetries = 3
    this.forceRefreshThreshold = 24 * 60 * 60 * 1000 // 24 hours

    // Feature Flags
    this.features = {
      upcomingBooks: true,
      seriesContinuation: true,
      authorTracking: true,
      coverCaching: true,
      releaseNotifications: true,
      batchProcessing: true,
      adminSettings: true
    }

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    if (settings.providerOrder) this.providerOrder = settings.providerOrder
    if (settings.providerTimeouts) this.providerTimeouts = { ...this.providerTimeouts, ...settings.providerTimeouts }
    if (settings.cacheEnabled !== undefined) this.cacheEnabled = !!settings.cacheEnabled
    if (settings.cacheTTL) this.cacheTTL = { ...this.cacheTTL, ...settings.cacheTTL }
    if (settings.cacheSize) this.cacheSize = { ...this.cacheSize, ...settings.cacheSize }
    if (settings.discoveryEnabled !== undefined) this.discoveryEnabled = !!settings.discoveryEnabled
    if (settings.discoveryTimeout) this.discoveryTimeout = settings.discoveryTimeout
    if (settings.discoveryRetries) this.discoveryRetries = settings.discoveryRetries
    if (settings.forceRefreshThreshold) this.forceRefreshThreshold = settings.forceRefreshThreshold
    if (settings.features) this.features = { ...this.features, ...settings.features }
  }

  update(newSettings) {
    const originalSettings = this.toJSON()
    try {
      this.construct(newSettings)
      Logger.info('[UpcomingBookSettings] Settings updated successfully')
      return true
    } catch (error) {
      Logger.error('[UpcomingBookSettings] Settings update failed:', error.message)
      this.construct(originalSettings)
      return false
    }
  }

  getProviderTimeout(provider) {
    return this.providerTimeouts[provider] || 15000
  }

  isFeatureEnabled(feature) {
    return this.features[feature] === true
  }

  toJSON() {
    return {
      id: this.id,
      providerOrder: this.providerOrder,
      providerTimeouts: this.providerTimeouts,
      cacheEnabled: this.cacheEnabled,
      cacheTTL: this.cacheTTL,
      cacheSize: this.cacheSize,
      discoveryEnabled: this.discoveryEnabled,
      discoveryTimeout: this.discoveryTimeout,
      discoveryRetries: this.discoveryRetries,
      forceRefreshThreshold: this.forceRefreshThreshold,
      features: this.features
    }
  }
}

module.exports = UpcomingBookSettings
