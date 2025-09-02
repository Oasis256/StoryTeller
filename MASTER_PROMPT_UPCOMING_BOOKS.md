# Master Prompt: Rewrite Upcoming Book Feature for AudbleTales

## Context

You are tasked with **completely replacing** the existing upcoming book discovery feature for AudbleTales. The current implementation is broken and causing headaches - it needs to be scrapped and rebuilt from scratch with a clean, working architecture. Do NOT modify any existing providers - leave them completely untouched.

## Current Architecture Analysis

### Existing Components:

1. **UpcomingBookController** (`server/controllers/UpcomingBookController.js`) - Handles API endpoints
2. **UpcomingBookOrchestrator** (`server/services/UpcomingBookOrchestrator.js`) - Coordinates discovery and caching
3. **UpcomingBookDiscoveryService** (`server/services/UpcomingBookDiscoveryService.js`) - Performs actual book discovery
4. **UpcomingBookCache** (`server/services/UpcomingBookCache.js`) - Multi-layer caching system
5. **SeriesUtils** (`server/utils/upcoming/seriesUtils.js`) - Series information extraction utilities
6. **Existing Providers** - Audible, GoogleBooks, OpenLibrary, Audnexus, etc.

### Current API Endpoints:

- `GET /items/:id/upcoming` - Get upcoming book for specific item
- `GET /items/:id/upcoming/check` - Check discovery status
- `POST /items/:id/upcoming/retry` - Retry failed discovery
- `GET /upcoming/stats` - Get system statistics
- `DELETE /upcoming/cache` - Clear cache
- Various admin endpoints for monitoring and maintenance

## Requirements

### 1. Provider Integration

- **DO NOT MODIFY**: Any existing providers - leave them completely untouched
- **Provider Order**: Implement the following search order:
  1. **Cache** - Check cache first for existing results
  2. **Audble** - New custom provider (note the typo) that:
     - Is completely independent of existing providers
     - Uses ASIN acquisition techniques (copy the logic, don't import)
     - Scrapes audible.com for upcoming books (since Audible doesn't find future books by default)
     - Implements intelligent web scraping with proper rate limiting and error handling
  3. **Google** - Use GoogleBooks provider (existing, don't modify)
  4. **Other Providers** - Use remaining existing providers in their current order
  5. **RisingShadow** - Use as final fallback provider
- **Fallback Strategy**: If all other providers fail, RisingShadow serves as the ultimate fallback
- **Use**: Existing providers as reference only - do not import or modify them

### 2. Enhanced Discovery Logic

- **Find Next Book**: If the next book in a series is not in the library but is already released, find it
- **Upcoming Books**: Find books that are not yet released
- **Series Continuation**: Intelligently determine the next book in a series based on sequence numbers
- **Author Tracking**: Track new releases from favorite authors even outside series

### 3. Cache-First Architecture

- **Multi-layer Caching**: Implement memory, file, and database caching
- **Comprehensive Data Caching**: Cache ALL book details including:
  - **Name/Title**: Book title and subtitle
  - **Series**: Series name, sequence number, series information
  - **Cover**: Cover image URLs and cached cover files
  - **Release Date**: Publication date, upcoming release dates
  - **Author**: Author name and details
  - **Description**: Book description and summary
  - **ASIN/ISBN**: Book identifiers
  - **Additional Details**: At your discretion - genres, ratings, narrators, duration, etc.
- **Intelligent Invalidation**: Smart cache invalidation based on series updates, new releases, etc.
- **Cache Warming**: Pre-populate cache for popular series
- **Performance Optimization**: Reduce API calls and improve response times
- **Cache Statistics**: Comprehensive monitoring and analytics

### 4. Additional Features

- **Comprehensive Data Caching**: Cache ALL book details including name, series, cover, release date, author, description, ASIN/ISBN, and additional metadata at your discretion
- **Cover Image Caching**: Cache and serve book cover images with local storage
- **Release Date Tracking**: Track and notify about upcoming releases
- **Series Mapping**: Better series name matching and normalization
- **Error Recovery**: Robust error handling and retry mechanisms
- **Background Processing**: Asynchronous discovery for better user experience
- **User Preferences**: Allow users to configure discovery preferences
- **Data Persistence**: Ensure all cached data survives application restarts
- **Admin Settings Controls**: Comprehensive admin panel for feature configuration

## Technical Implementation Guidelines

### 1. Admin Settings Implementation

```javascript
// Create: server/services/UpcomingBookAdminSettings.js
class UpcomingBookAdminSettings {
  constructor() {
    // Load settings from database/config
    // Provide default values
    // Handle settings validation
  }

  // Cache Settings
  async getCacheSettings() {
    // Return cache TTL, size limits, invalidation rules
  }

  // Provider Settings
  async getProviderSettings() {
    // Return provider order, timeouts, rate limits
  }

  // Discovery Settings
  async getDiscoverySettings() {
    // Return search strategies, fallback rules
  }

  // Update Settings
  async updateSettings(newSettings) {
    // Validate and save new settings
    // Apply settings immediately
  }

  // Test Settings
  async testSettings() {
    // Test provider connectivity
    // Validate cache functionality
    // Check system health
  }
}
```

### 2. Audble Provider Implementation

```javascript
// Create: server/providers/Audble.js
// COMPLETELY NEW FILE - do not import or reference existing providers
class Audble {
  constructor() {
    // Copy ASIN validation logic from existing Audible provider (don't import)
    // Implement web scraping capabilities for audible.com
    // Include rate limiting and error handling
    // Be completely self-contained
  }

  async search(title, author, asin, region) {
    // Implement intelligent search strategies
    // Use ASIN when available
    // Fall back to title/author search
    // Scrape audible.com for upcoming books
    // Do not use any existing provider methods
  }

  async scrapeAudibleForUpcoming(seriesName, authorName) {
    // Implement web scraping of audible.com
    // Look for upcoming releases
    // Parse release dates and book information
    // Use axios or similar for HTTP requests
  }
}
```

### 3. Enhanced Discovery Service

```javascript
// REPLACE: server/services/UpcomingBookDiscoveryService.js
// COMPLETELY NEW IMPLEMENTATION - do not enhance existing
class UpcomingBookDiscoveryService {
  constructor() {
    // Initialize providers in the correct order:
    // 1. Cache (handled by orchestrator)
    // 2. Audble provider (new)
    // 3. GoogleBooks provider (existing, don't modify)
    // 4. Other existing providers (don't modify)
    // 5. RisingShadow as fallback (existing, don't modify)
    // Implement enhanced search strategies from scratch
    // Load settings from admin configuration
  }

  async discoverUpcomingBook(libraryItem, allLibraryBooks) {
    // Enhanced logic for finding next books
    // Better series continuation detection
    // Author tracking for new releases
    // Follow the provider order: Cache -> Audble -> Google -> Others -> RisingShadow
    // Use admin settings for timeouts and retry logic
  }

  async findNextInSeries(seriesName, authorName, currentSequence) {
    // Find the next book in sequence
    // Check if already released
    // Look for upcoming releases
    // Implement completely new logic
    // Use provider order with RisingShadow as final fallback
  }

  async searchWithProviderOrder(seriesName, authorName, currentSequence) {
    // Implement the exact provider search order:
    // 1. Check cache first
    // 2. Try Audble provider
    // 3. Try GoogleBooks provider
    // 4. Try other existing providers
    // 5. Fallback to RisingShadow
    // Return first successful result
    // Use admin settings for provider timeouts and retry counts
  }
}
```

### 4. Cache-First Architecture

```javascript
// REPLACE: server/services/UpcomingBookCache.js
// COMPLETELY NEW IMPLEMENTATION - do not enhance existing
class UpcomingBookCache {
  constructor() {
    // Implement multi-layer caching from scratch
    // Add intelligent invalidation
    // Include cache warming
    // Do not reference existing cache implementation
    // Cache comprehensive book data structure
    // Load cache settings from admin configuration
  }

  async get(key) {
    // Check memory cache first
    // Fall back to file cache
    // Fall back to database cache
    // Implement cache warming
    // Build completely new caching logic
    // Return complete book object with all cached details
    // Use admin settings for TTL and cache behavior
  }

  async set(key, bookData) {
    // Cache complete book object including:
    // - title, subtitle, series info, cover URLs, release dates
    // - author details, description, ASIN/ISBN, additional metadata
    // Store in all cache layers (memory, file, database)
    // Use admin settings for cache size limits and TTL
  }

  async getCachedBook(seriesName, authorName) {
    // Retrieve complete cached book data
    // Return null if not found or expired
    // Use admin settings for cache validation
  }

  async cacheBookDetails(bookData) {
    // Cache comprehensive book details
    // Include all metadata fields
    // Handle cover image caching separately
    // Apply admin settings for data retention
  }

  async smartInvalidate(seriesName, authorName) {
    // Intelligent cache invalidation
    // Pattern-based invalidation
    // Context-aware updates
    // Implement new invalidation strategies
    // Use admin settings for invalidation rules
  }
}
```

### 5. Enhanced Controller

```javascript
// REPLACE: server/controllers/UpcomingBookController.js
// COMPLETELY NEW IMPLEMENTATION - do not enhance existing
class UpcomingBookController {
  constructor() {
    // Initialize new services
    // Do not reference existing controller logic
    // Build from scratch
    // Initialize admin settings service
  }

  // Replace all existing endpoints with new implementations:
  // - Cover image serving
  // - Release date notifications
  // - User preferences
  // - Background processing status
  // - Enhanced error handling
  // - All existing endpoints with new logic

  // Admin Settings Endpoints:
  // - GET /upcoming/admin/settings - Get current admin settings
  // - PATCH /upcoming/admin/settings - Update admin settings
  // - POST /upcoming/admin/test-providers - Test provider connectivity
  // - POST /upcoming/admin/clear-cache - Clear all caches
  // - GET /upcoming/admin/stats - Get detailed system statistics
  // - POST /upcoming/admin/maintenance - Run maintenance tasks
  // - GET /upcoming/admin/health - System health check
  // - POST /upcoming/admin/reset - Reset to default settings
}
```

## Implementation Priorities

### Phase 1: Core Provider Integration

1. Create the Audble provider (completely new file)
2. Replace discovery service with new implementation that follows the provider order:
   - Cache first
   - Audble second
   - Google third
   - Other providers fourth
   - RisingShadow as final fallback
3. Implement basic web scraping for audible.com
4. Test ASIN acquisition and search functionality
5. Ensure no existing providers are modified or imported
6. Verify the fallback chain works correctly

### Phase 2: Enhanced Discovery

1. Implement next book detection logic
2. Add series continuation algorithms
3. Implement author tracking
4. Add release date parsing and validation

### Phase 3: Cache Optimization

1. Implement multi-layer caching with comprehensive data storage
2. Cache ALL book details: name, series, cover, release date, author, description, ASIN/ISBN, and additional metadata
3. Add intelligent cache invalidation
4. Implement cache warming for popular series
5. Add comprehensive cache statistics
6. Ensure data persistence across application restarts

### Phase 4: Additional Features

1. Comprehensive data caching (all book details)
2. Cover image caching and serving with local storage
3. Release date notifications and tracking
4. User preference system
5. Background processing
6. Enhanced error handling
7. Data persistence and backup
8. Admin settings controls and configuration panel

## Quality Requirements

### Performance

- Cache hit rate should be >80% for repeated requests
- Response time should be <500ms for cached results
- Background processing should not block user interactions
- Memory usage should be optimized and monitored

### Reliability

- Graceful degradation when providers are unavailable
- Comprehensive error handling and logging
- Automatic retry mechanisms with exponential backoff
- Data validation and sanitization

### Maintainability

- Clear separation of concerns
- Comprehensive documentation
- Unit tests for critical components
- Monitoring and alerting capabilities

### User Experience

- Fast response times
- Accurate book discovery
- Clear error messages
- Intuitive API design

## Testing Strategy

### Unit Tests

- Provider functionality
- Cache operations
- Series detection algorithms
- Error handling

### Integration Tests

- End-to-end discovery workflows
- Cache invalidation scenarios
- Provider fallback mechanisms

### Performance Tests

- Cache hit rates
- Response times
- Memory usage
- Concurrent request handling

## Monitoring and Analytics

### Metrics to Track

- Cache hit/miss rates
- Provider response times
- Discovery accuracy rates
- Error rates by provider
- User engagement metrics

### Logging

- Comprehensive logging for debugging
- Performance metrics logging
- Error tracking and alerting
- User behavior analytics

## Deliverables

1. **Enhanced Provider System**: Updated provider architecture with Audble provider
2. **Improved Discovery Logic**: Better series continuation and author tracking
3. **Cache-First Architecture**: Multi-layer caching with comprehensive data storage (all book details)
4. **Additional Features**: Complete data caching, cover caching, notifications, user preferences
5. **Comprehensive Testing**: Unit, integration, and performance tests
6. **Documentation**: API documentation, implementation guides, user guides
7. **Monitoring**: Metrics, logging, and alerting systems
8. **Data Persistence**: Robust caching that survives application restarts

## Success Criteria

- [ ] Audble provider successfully scrapes audible.com for upcoming books
- [ ] Cache hit rate exceeds 80% for repeated requests
- [ ] Response time is under 500ms for cached results
- [ ] Next book detection accuracy exceeds 90%
- [ ] System gracefully handles provider failures
- [ ] Provider order is correctly implemented: Cache → Audble → Google → Others → RisingShadow
- [ ] RisingShadow serves as reliable final fallback
- [ ] Admin settings panel provides comprehensive configuration options
- [ ] All settings are properly validated and applied
- [ ] All existing functionality is preserved
- [ ] New features are well-documented and tested

## Critical Implementation Notes

- **DO NOT MODIFY** any existing providers - leave them completely untouched
- **REPLACE** all upcoming book related files with completely new implementations
- **MAINTAIN** backward compatibility with existing API endpoints (same routes, different implementation)
- **FOLLOW** the existing code style and patterns for consistency
- **USE** the existing logging and error handling patterns
- **ENSURE** proper security measures for web scraping
- **IMPLEMENT** rate limiting and respectful crawling practices
- **ADD** proper user agent strings and request headers
- **INCLUDE** comprehensive error handling for network failures
- **CONSIDER** implementing a queue system for background processing
- **ADD** configuration options for cache TTL and provider preferences
- **IMPLEMENT** proper cleanup and resource management
- **TEST** thoroughly to ensure the new implementation works correctly
- **DOCUMENT** all new functionality clearly

## File Replacement Strategy

### Files to Completely Replace:

1. `server/controllers/UpcomingBookController.js` - New implementation
2. `server/services/UpcomingBookOrchestrator.js` - New implementation
3. `server/services/UpcomingBookDiscoveryService.js` - New implementation
4. `server/services/UpcomingBookCache.js` - New implementation
5. `server/utils/upcoming/seriesUtils.js` - New implementation

### Files to Create:

1. `server/providers/Audble.js` - Completely new provider
2. `server/services/UpcomingBookAdminSettings.js` - Admin settings management

### Files to Leave Untouched:

- All existing providers in `server/providers/`
- Any other files not specifically mentioned

This master prompt provides a comprehensive roadmap for completely replacing the upcoming book feature with a clean, working implementation while preserving all existing functionality and providers.
