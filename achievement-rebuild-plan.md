# Achievement System Rebuild Plan

## Overview
We're rebuilding the achievement system to be cleaner and more maintainable, focusing solely on listening stats. The current achievement system has the following issues:
- Complex SQL queries for tracking different types of achievements
- Multiple database models that may not be properly defined
- Limited integration with the existing listening stats functions

## Goals
1. Use existing `listeningStats.js` utility as the foundation
2. Create a simplified achievement system based on listening stats only
3. Maintain backward compatibility with the UI components
4. Ensure easy extensibility for future achievement types

## Implementation Steps

### 1. Database Models
Create or update the following models:
- `Achievement`: Define achievement types and criteria
- `UserAchievement`: Track user progress and unlocked achievements

### 2. Backend Services
- Update `AchievementManager.js` to use the listening stats utilities
- Simplify achievement checking logic
- Create a service to periodically check achievements
- Keep existing API endpoints

### 3. Achievement Categories
Focus on these simpler categories:
- **Listening Time**: Total time spent listening (minutes/hours)
- **Streak**: Consecutive days with listening activity
- **Diversity**: Unique authors and genres
- **Milestone**: Special one-time achievements

### 4. Listening Stats Integration
- Leverage the existing `getUserListeningStats`, `computeStreakFromDays`, and `deriveDiversityCountsFromSessions` functions
- Add any missing utility functions needed for achievement tracking

### 5. API Endpoints
Maintain the same API structure:
- `GET /api/achievements`: List all achievements with progress
- `GET /api/achievements/unlocked`: Get unlocked achievements
- `GET /api/achievements/stats`: Get achievement statistics
- `GET /api/achievements/categories`: Get achievements by category
- `GET /api/achievements/recent`: Get recently unlocked achievements
- `GET /api/achievements/progress`: Get achievement progress
- `POST /api/achievements/check`: Manually trigger achievement check

### 6. Frontend Integration
No changes needed to:
- `achievements.vue` page
- `AchievementCard.vue` component
- `AchievementUnlocked.vue` modal

### 7. Testing
- Test with various listening patterns
- Verify all UI components display correctly
- Ensure backward compatibility

## Implementation Timeline
1. Update or create database models
2. Rewrite achievement manager using listening stats
3. Update API controllers and endpoints
4. Test with existing frontend components
5. Deploy and monitor
