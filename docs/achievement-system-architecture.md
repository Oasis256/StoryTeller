# AudbleTales Achievement System Architecture

## Overview

The achievement system in AudbleTales provides gamification features to enhance user engagement. It tracks user progress across various activities (like listening to books, adding books to the library, etc.) and rewards users with achievements when they reach certain milestones.

## Architecture Components

### Database Models

1. **Achievement Model**
   - Defines the achievement structure
   - Properties: id, name, description, category, icon, requirements, points, etc.
   - Located in: `/server/models/Achievement.js`

2. **UserAchievement Model**
   - Tracks user progress for each achievement
   - Properties: userId, achievementId, progress, unlocked, unlockedAt, etc.
   - Located in: `/server/models/UserAchievement.js`
   - Associates with Achievement model using the alias 'achievement'

### Backend Services

1. **AchievementAdapter**
   - Bridge between API endpoints and database models
   - Transforms achievement data to include user-specific progress
   - Key methods:
     - `getAllAchievements(userId)`: Gets all achievements with user progress
     - `getUnlockedAchievements(userId)`: Gets achievements user has completed
     - `getRecentUnlockedAchievements(userId, limit)`: Gets recently unlocked achievements
     - `getUserAchievementProgress(userId, achievementId)`: Gets progress for specific achievement
   - Located in: `/server/services/achievementAdapter.js`

2. **AchievementManager**
   - Handles achievement registration and progress updates
   - Triggers achievement unlocks when criteria are met
   - Located in: `/server/managers/AchievementManager.js`

3. **AchievementController**
   - API endpoints for achievement-related operations
   - Routes: `/api/achievements`, `/api/achievements/unlocked`, `/api/achievements/recent`, etc.
   - Located in: `/server/controllers/AchievementController.js`

### Frontend Components

1. **Achievement Cards**
   - Visual representation of achievements
   - Shows name, description, progress bar, and unlock status
   - Located in: `/client/components/cards/AchievementCard.vue`

2. **Achievement Views**
   - Pages that display achievements grouped by category
   - Shows all, unlocked, or recent achievements
   - Located in: `/client/pages/account.vue` or dedicated achievement pages

## Data Flow

1. Achievement definitions are loaded during server startup from `/server/managers/AchievementManager.js`
2. User performs actions (listens to books, adds to library, etc.)
3. AchievementManager receives progress updates from relevant controllers
4. Progress is saved to UserAchievement records
5. When criteria are met, achievements are marked as unlocked
6. Frontend requests achievement data through API endpoints
7. AchievementController uses AchievementAdapter to fetch and transform data
8. UI components render achievements with progress bars and unlock status

## Key Considerations

1. **Data Transformation**
   - Achievement objects returned to the frontend must include:
     - `isUnlocked`: Boolean indicating if achievement is completed
     - `userProgress`: Current progress value
     - `progressPercent`: Percentage of completion (0-100)
   - These properties are required by the UI components

2. **User Achievement Records**
   - Every user should have a UserAchievement record for each defined achievement
   - These are created when a user is registered or when new achievements are defined

3. **Achievement Categories**
   - Achievements are grouped by categories (e.g., "Library", "Listening", "Social")
   - The UI displays achievements grouped by these categories

## Debugging

To debug achievement issues:

1. Check server logs for achievement-related messages
2. Verify that UserAchievement records exist for the user
3. Check the data structure returned by achievement API endpoints
4. Confirm that UI components receive the expected properties

## Achievement Initialization

The system ensures all achievements are defined and all users have achievement records:

1. `ensureAchievements()` is called during server startup to define achievements
2. A utility script can be used to create missing user achievement records
