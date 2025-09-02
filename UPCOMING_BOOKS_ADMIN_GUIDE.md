# 📚 Upcoming Books Admin Guide

## 🎯 Overview

The Enhanced Upcoming Books system provides instant responses through intelligent caching and background discovery. This guide covers all administrative features and configuration options.

## 🚀 Key Features

- **Cache-First Strategy**: Instant UI responses (sub-second)
- **Background Discovery**: Non-blocking 2400x2400 cover processing
- **Real-time Updates**: WebSocket notifications and progress tracking
- **Long-lived Cache**: 30-day TTL with infinite option
- **Auto Cache Warming**: Startup prewarming for recently accessed items
- **Smart Error Recovery**: Retry mechanisms and fallback strategies

## 📊 Admin Interface Features

### **1. Cache Management Dashboard**

#### Cache Statistics
```
GET /api/upcoming/cache/stats
```
**Response:**
```json
{
  "discoveryRequests": 1245,
  "cacheHits": 1180,
  "cacheMisses": 65,
  "successfulDiscoveries": 58,
  "failedDiscoveries": 7,
  "cache": {
    "memoryEntries": 150,
    "fileEntries": 340,
    "totalSize": "45.2 MB"
  },
  "config": {
    "cacheStrategy": "cache_first",
    "memoryTTL": 86400000,
    "fileTTL": 2592000000,
    "infiniteCache": false,
    "backgroundRefresh": true
  },
  "backgroundQueue": 2,
  "activeDiscoveries": 1
}
```

#### Cache Configuration
```
PUT /api/upcoming/cache/config
```
**Body:**
```json
{
  "infiniteCache": true,          // Never expire cache
  "memoryTTL": 86400000,         // 24 hours
  "fileTTL": 2592000000,         // 30 days
  "backgroundRefresh": true       // Auto-refresh stale cache
}
```

### **2. Cache Operations**

#### Prewarm Cache
```
POST /api/upcoming/cache/prewarm
```
**Body:**
```json
{
  "libraryId": "lib-123",         // Optional: specific library
  "maxConcurrent": 5,             // Concurrent discoveries
  "forceRefresh": false           // Skip existing cache
}
```

#### Clear Cache
```
DELETE /api/upcoming/cache?seriesName=Harry%20Potter&authorName=J.K.%20Rowling
DELETE /api/upcoming/cache  // Clear all
```

### **3. Individual Item Management**

#### Check Discovery Status
```
GET /api/items/{itemId}/upcoming/check
```

#### Retry Failed Discovery
```
POST /api/items/{itemId}/upcoming/retry
```

## ⚙️ Configuration Options

### **Cache TTL Settings**

| Setting | Default | Description |
|---------|---------|-------------|
| `memoryTTL` | 24 hours | In-memory cache lifetime |
| `fileTTL` | 30 days | Disk cache lifetime |
| `infiniteCache` | false | Never expire cache entries |
| `backgroundRefreshInterval` | 6 hours | Auto-refresh threshold |

### **Performance Settings**

| Setting | Default | Description |
|---------|---------|-------------|
| `maxConcurrentDiscoveries` | 3 | Parallel background discoveries |
| `enableCacheWarming` | true | Startup cache prewarming |
| `cacheStrategy` | cache_first | Response strategy |

### **Discovery Settings**

| Setting | Default | Description |
|---------|---------|-------------|
| `retryAttempts` | 2 | Failed discovery retries |
| `enableBackgroundDiscovery` | true | Background processing |
| `backgroundRefresh` | true | Auto-refresh stale data |

## 🎮 WebSocket Events

### **For Frontend Implementation**

#### Progress Updates
```javascript
socket.on('upcoming_book_progress', (data) => {
  // data.seriesName, data.authorName
  // data.progress: { stage, message, percentage, error?, retryable? }
})
```

#### Discovery Completion
```javascript
socket.on('upcoming_book_update', (data) => {
  // data.seriesName, data.authorName
  // data.book: { title, author, releaseDate, cover, description, series }
  // data.discoveredAt, data.progress
})
```

## 🛠️ Recommended Admin UI Components

### **1. Cache Dashboard Widget**
```javascript
// Display cache hit rate, total entries, background queue size
// Real-time updates via WebSocket or polling /api/upcoming/cache/stats
```

### **2. Cache Management Panel**
```javascript
// Buttons for:
// - Clear All Cache
// - Prewarm Library Cache  
// - Toggle Infinite Cache
// - Configure TTL Settings
```

### **3. Discovery Monitor**
```javascript
// Live view of:
// - Active discoveries (series/author names)
// - Background queue size
// - Recent completions/failures
// - Retry buttons for failed items
```

### **4. Settings Configuration**
```javascript
// Form controls for:
// - Cache TTL settings (memory/file)
// - Infinite cache toggle
// - Background refresh settings
// - Performance tuning (concurrency limits)
```

### **5. Library Prewarming Tool**
```javascript
// Interface to:
// - Select specific libraries to prewarm
// - Set concurrency limits
// - Monitor prewarming progress
// - View prewarming results/statistics
```

## 📈 Performance Monitoring

### **Key Metrics to Track**

1. **Cache Hit Rate**: Target >95%
2. **Average Response Time**: Target <100ms for cached items
3. **Background Discovery Success Rate**: Target >90%
4. **Memory Usage**: Monitor cache size growth
5. **Discovery Queue Length**: Alert if consistently >10

### **Recommended Alerts**

- Cache hit rate drops below 90%
- Background queue size exceeds 20 items
- Discovery failure rate exceeds 20%
- Memory cache size exceeds 500MB

## 🔧 Troubleshooting

### **Common Issues**

#### "Discovering..." Stuck in UI
- **Check**: WebSocket connection working
- **Fix**: Implement polling fallback: `GET /api/items/{id}/upcoming/check`
- **Retry**: `POST /api/items/{id}/upcoming/retry`

#### High Cache Miss Rate
- **Check**: Cache TTL settings too short
- **Fix**: Increase `fileTTL` or enable `infiniteCache`
- **Action**: Run cache prewarming for popular items

#### Slow Background Discovery
- **Check**: External provider response times
- **Fix**: Increase `maxConcurrentDiscoveries` if CPU/memory allows
- **Monitor**: Network connectivity to metadata providers

#### Memory Usage Growth
- **Check**: `memoryTTL` setting and infinite cache usage
- **Fix**: Reduce memory TTL or clear cache periodically
- **Monitor**: Cache size via stats endpoint

## 🚀 Best Practices

1. **Enable Infinite Cache** for stable libraries with infrequent additions
2. **Prewarm Cache** after library imports or server restarts
3. **Monitor WebSocket** connections for real-time updates
4. **Set Reasonable TTL** based on how often new books are released
5. **Use Background Refresh** to keep cache current without user delays
6. **Monitor Discovery Success Rate** to catch provider issues early

## 📋 Maintenance Tasks

### **Daily**
- Monitor cache hit rates and queue sizes
- Check for failed discoveries needing retry

### **Weekly**  
- Review cache size and memory usage
- Clear cache for inactive series if needed

### **Monthly**
- Update cache TTL settings based on usage patterns
- Review and optimize prewarming strategies

### **After Major Updates**
- Clear cache if book metadata format changes
- Test WebSocket connectivity and fallback polling
- Verify cache warming still targets relevant items

---

*This admin guide provides complete control over the Enhanced Upcoming Books system. The cache-first architecture ensures instant user experiences while maintaining data freshness through intelligent background processing.*