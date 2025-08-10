<template>
  <div class="achievement-widget bg-bg border border-gray-600 rounded-lg p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold flex items-center">
        <span class="material-symbols text-yellow-400 mr-2">emoji_events</span>
        {{ $strings.WidgetAchievementsTitle }}
      </h3>
      <nuxt-link to="/achievements" class="text-sm text-primary hover:text-primary-hover">
        {{ $strings.WidgetAchievementsViewAll }}
      </nuxt-link>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <ui-loading-indicator />
    </div>

    <!-- Content -->
    <div v-else-if="stats && progressAchievements.length" class="space-y-4">
      <!-- Quick Stats -->
      <div class="grid grid-cols-2 gap-3">
        <div class="text-center">
          <div class="text-xl font-bold text-yellow-400">{{ stats.unlockedAchievements || 0 }}</div>
          <div class="text-xs text-gray-400">{{ $strings.WidgetAchievementsUnlocked }}</div>
        </div>
        <div class="text-center">
          <div class="text-xl font-bold text-blue-400">{{ stats.completionPercent || 0 }}%</div>
          <div class="text-xs text-gray-400">{{ $strings.WidgetAchievementsComplete }}</div>
        </div>
      </div>

      <!-- Progress Achievements -->
      <div class="space-y-3">
        <h4 class="text-sm font-medium text-gray-300">{{ $strings.WidgetAchievementsInProgress }}</h4>
        <div class="space-y-2">
          <div v-for="achievement in progressAchievements.slice(0, 3)" :key="achievement.id" class="achievement-progress">
            <div class="flex items-center space-x-3">
              <!-- Mini Badge -->
              <div 
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                :style="getMiniBadgeStyle(achievement)"
              >
                <span class="material-symbols text-xs" :class="{ 'text-white': achievement.isUnlocked, 'text-gray-500': !achievement.isUnlocked }">
                  {{ achievement.badgeIcon || 'emoji_events' }}
                </span>
              </div>

              <!-- Progress Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-medium truncate" :class="{ 'text-white': achievement.isUnlocked, 'text-gray-300': !achievement.isUnlocked }">
                    {{ getAchievementName(achievement) }}
                  </span>
                  <span class="text-xs text-gray-500 ml-2">
                    {{ achievement.progressPercent || 0 }}%
                  </span>
                </div>
                
                <!-- Mini Progress Bar -->
                <div class="w-full bg-gray-700 rounded-full h-1.5">
                  <div 
                    class="h-1.5 rounded-full transition-all duration-300"
                    :class="getProgressBarClass(achievement)"
                    :style="{ width: Math.min(100, achievement.progressPercent || 0) + '%' }"
                  ></div>
                </div>
                
                <div class="text-xs text-gray-500 mt-1">
                  {{ achievement.userProgress || 0 }} / {{ achievement.targetValue }} {{ achievement.targetUnit }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Unlocks -->
      <div v-if="recentUnlocks.length" class="space-y-3">
        <h4 class="text-sm font-medium text-gray-300">{{ $strings.WidgetAchievementsRecentlyUnlocked }}</h4>
        <div class="space-y-2">
          <div v-for="achievement in recentUnlocks.slice(0, 2)" :key="achievement.id" class="flex items-center space-x-3">
            <div 
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ring-2 ring-yellow-400 ring-opacity-50"
              :style="getMiniBadgeStyle(achievement)"
            >
              <span class="material-symbols text-xs text-white">
                {{ achievement.achievement?.badgeIcon || 'emoji_events' }}
              </span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-white truncate">{{ getAchievementName(achievement.achievement) }}</div>
              <div class="text-xs text-gray-500">{{ formatUnlockedDate(achievement.unlockedAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-6">
      <span class="material-symbols text-3xl text-gray-500 mb-2">emoji_events</span>
      <p class="text-sm text-gray-400">{{ $strings.WidgetAchievementsEmptyTitle }}</p>
      <p class="text-xs text-gray-500">{{ $strings.WidgetAchievementsEmptySubtitle }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      stats: null,
      progressAchievements: [],
      recentUnlocks: [],
      isLoading: true
    }
  },

  async mounted() {
    await this.loadData()
    
    // Listen for achievement updates
    if (this.$socket) {
      this.$socket.on('achievement_unlocked', this.onAchievementUnlocked)
    }
  },

  beforeDestroy() {
    if (this.$socket) {
      this.$socket.off('achievement_unlocked', this.onAchievementUnlocked)
    }
  },

  methods: {
    async loadData() {
      this.isLoading = true
      try {
        const [statsResponse, progressResponse, recentResponse] = await Promise.all([
          this.$axios.$get('/api/achievements/stats').catch(() => ({ stats: {} })),
          this.$axios.$get('/api/achievements/progress').catch(() => ({ achievements: [] })),
          this.$axios.$get('/api/achievements/recent').catch(() => ({ achievements: [] }))
        ])

        this.stats = statsResponse.stats || {}
        this.progressAchievements = progressResponse.achievements || []
        this.recentUnlocks = recentResponse.achievements || []
      } catch (error) {
        console.error('Failed to load achievement data:', error)
      } finally {
        this.isLoading = false
      }
    },

    onAchievementUnlocked() {
      // Refresh data when achievement is unlocked
      this.loadData()
    },

    getAchievementName(achievement) {
      if (!achievement) return ''
      
      // Use localized name if nameKey exists
      if (achievement.nameKey && this.$strings[achievement.nameKey]) {
        return this.$strings[achievement.nameKey]
      }
      
      // Fallback to original name
      return achievement.name || ''
    },

    getMiniBadgeStyle(achievement) {
      if (achievement.isUnlocked || achievement.achievement) {
        const color = achievement.badgeColor || achievement.achievement?.badgeColor || '#fbbf24'
        return {
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}40`
        }
      } else {
        return {
          backgroundColor: '#374151',
          border: '1px solid #6b7280'
        }
      }
    },

    getProgressBarClass(achievement) {
      if (achievement.isUnlocked) {
        return 'bg-yellow-400'
      } else if (achievement.progressPercent >= 75) {
        return 'bg-green-400'
      } else if (achievement.progressPercent >= 50) {
        return 'bg-blue-400'
      } else if (achievement.progressPercent >= 25) {
        return 'bg-purple-400'
      } else {
        return 'bg-gray-600'
      }
    },

    formatUnlockedDate(dateString) {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        return this.$strings.WidgetAchievementsToday
      } else if (diffDays === 1) {
        return this.$strings.WidgetAchievementsYesterday
      } else if (diffDays < 7) {
        return this.$strings.WidgetAchievementsDaysAgo.replace('{0}', diffDays)
      } else {
        return date.toLocaleDateString()
      }
    }
  }
}
</script>

<style scoped>
.achievement-widget {
  min-height: 200px;
}

.achievement-progress {
  transition: all 0.2s ease;
}

.achievement-progress:hover {
  background-color: rgba(55, 65, 81, 0.5);
  border-radius: 0.375rem;
  padding: 0.25rem;
  margin: -0.25rem;
}
</style>
