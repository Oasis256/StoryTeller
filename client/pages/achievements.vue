<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-6xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">{{ $strings.PageAchievementsTitle }}</h1>

        <ui-dropdown v-model="selectedCategory" :items="categoryOptions" small />
      </div>

      <!-- Stats Overview -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-success">{{ stats.unlockedCount || 0 }}</div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsUnlocked }}</div>
        </div>
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-warning">{{ Math.round((stats.completionRate || 0) * 100) }}%</div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsCompletionRate }}</div>
        </div>
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-info">{{ stats.booksCompleted || 0 }}</div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsBooksCompleted }}</div>
        </div>
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-purple-400">{{ formatListeningTime(stats.totalListeningMinutes || 0) }}</div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsTotalListening }}</div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mb-8 space-x-2">
        <ui-btn color="bg-primary" :loading="checking" @click="checkProgress">
          {{ $strings.PageAchievementsCheckForNew }}
        </ui-btn>

        <ui-btn v-if="userIsAdmin" color="bg-success" :loading="testingUnlock" @click="testUnlockAchievement">
          {{ $strings.PageAchievementsTestUnlock }}
        </ui-btn>
      </div>

      <!-- Recently Unlocked -->
      <div v-if="recentAchievements.length" class="mb-8">
        <h2 class="text-xl font-semibold mb-4 flex items-center">
          <span class="material-symbols text-yellow-400 mr-2">star</span>
          {{ $strings.PageAchievementsRecentlyUnlocked }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <achievement-card v-for="achievement in recentAchievements" :key="achievement.id" :achievement="achievement" class="ring-2 ring-yellow-400 ring-opacity-50" />
        </div>
      </div>

      <!-- Achievement Categories -->
      <div class="space-y-8">
        <div v-for="(categoryAchievements, category) in filteredAchievementsByCategory" :key="category">
          <h2 class="text-xl font-semibold mb-4 flex items-center capitalize">
            <span class="material-symbols mr-2" :class="getCategoryIconClass(category)">{{ getCategoryIcon(category) }}</span>
            {{ getCategoryTitle(category) }}
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <achievement-card v-for="achievement in categoryAchievements" :key="achievement.id" :achievement="achievement" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!achievements.length && !isLoading" class="text-center py-12">
        <span class="material-symbols text-6xl text-gray-500 mb-4">emoji_events</span>
        <h3 class="text-xl font-semibold mb-2">{{ $strings.PageAchievementsEmptyTitle }}</h3>
        <p class="text-gray-300">{{ $strings.PageAchievementsEmptySubtitle }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12">
        <widgets-loading-spinner />
      </div>
    </div>

    <!-- Achievement Unlock Modal -->
    <modals-achievement-unlocked v-model="showUnlockModal" :achievement="unlockedAchievement" />
  </div>
</template>

<script>
export default {
  async asyncData({ $axios }) {
    try {
      const [achievementsResponse, statsResponse, recentResponse] = await Promise.all([$axios.$get('/api/achievements'), $axios.$get('/api/achievements/stats'), $axios.$get('/api/achievements/recent')])

      return {
        achievements: achievementsResponse.achievements || [],
        stats: statsResponse.stats || {},
        recentAchievements: recentResponse.achievements || []
      }
    } catch (error) {
      console.error('Failed to load achievements:', error)
      return {
        achievements: [],
        stats: {},
        recentAchievements: []
      }
    }
  },

  data() {
    return {
      isLoading: false,
      checking: false,
      testingUnlock: false,
      selectedCategory: 'all',
      showUnlockModal: false,
      unlockedAchievement: null
    }
  },

  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },

    userIsAdmin() {
      return this.$store.state.user.user && this.$store.state.user.user.type === 'admin'
    },

    achievementsByCategory() {
      const categories = {}
      this.achievements.forEach((achievement) => {
        if (!categories[achievement.category]) {
          categories[achievement.category] = []
        }
        categories[achievement.category].push(achievement)
      })
      return categories
    },

    filteredAchievementsByCategory() {
      if (this.selectedCategory === 'all') {
        return this.achievementsByCategory
      }

      const filtered = {}
      if (this.achievementsByCategory[this.selectedCategory]) {
        filtered[this.selectedCategory] = this.achievementsByCategory[this.selectedCategory]
      }
      return filtered
    },

    categoryOptions() {
      const categories = [
        { text: this.$strings.PageAchievementsAllCategories, value: 'all' },
        { text: this.getCategoryTitle('reading'), value: 'reading' },
        { text: this.getCategoryTitle('listening'), value: 'listening' },
        { text: this.getCategoryTitle('streak'), value: 'streak' },
        { text: this.getCategoryTitle('diversity'), value: 'diversity' },
        { text: this.getCategoryTitle('milestone'), value: 'milestone' }
      ]
      return categories
    }
  },

  mounted() {
    // Listen for achievement unlock events
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
    async checkProgress() {
      this.checking = true
      try {
        const response = await this.$axios.$post('/api/achievements/check')

        if (response.newAchievements && response.newAchievements.length > 0) {
          this.$toast.success(`Unlocked ${response.newAchievements.length} new achievement(s)!`)
          await this.fetchAchievements()
        } else {
          this.$toast.info('No new achievements unlocked')
        }
      } catch (error) {
        console.error('Failed to check for achievements:', error)
        this.$toast.error('Failed to check for achievements')
      } finally {
        this.checking = false
      }
    },

    async testUnlockAchievement() {
      this.testingUnlock = true
      try {
        // Test unlock the "First Book" achievement
        const response = await this.$axios.$post('/api/achievements/test-unlock', {
          achievementKey: 'first_book'
        })

        this.$toast.success(`Test unlocked: ${response.achievement.Achievement.name}`)
        await this.fetchAchievements()
      } catch (error) {
        console.error('Failed to test unlock achievement:', error)
        if (error.response && error.response.data && error.response.data.error) {
          this.$toast.error(error.response.data.error)
        } else {
          this.$toast.error('Failed to test unlock achievement')
        }
      } finally {
        this.testingUnlock = false
      }
    },

    async fetchAchievements() {
      this.isLoading = true
      try {
        const [achievementsResponse, statsResponse, recentResponse] = await Promise.all([this.$axios.$get('/api/achievements'), this.$axios.$get('/api/achievements/stats'), this.$axios.$get('/api/achievements/recent')])

        this.achievements = achievementsResponse.achievements || []
        this.stats = statsResponse.stats || {}
        this.recentAchievements = recentResponse.achievements || []
      } catch (error) {
        console.error('Failed to fetch achievements:', error)
        this.$toast.error('Failed to load achievements')
      } finally {
        this.isLoading = false
      }
    },

    onAchievementUnlocked(data) {
      if (data.userId === this.$store.state.user.user.id) {
        this.unlockedAchievement = data.achievement
        this.showUnlockModal = true
        // Refresh achievements
        this.fetchAchievements()
      }
    },

    getCategoryIcon(category) {
      const icons = {
        reading: 'menu_book',
        listening: 'headphones',
        streak: 'local_fire_department',
        diversity: 'explore',
        milestone: 'emoji_events'
      }
      return icons[category] || 'emoji_events'
    },

    getCategoryIconClass(category) {
      const classes = {
        reading: 'text-blue-400',
        listening: 'text-purple-400',
        streak: 'text-red-400',
        diversity: 'text-green-400',
        milestone: 'text-yellow-400'
      }
      return classes[category] || 'text-gray-400'
    },

    getCategoryTitle(category) {
      const categoryKeys = {
        reading: 'AchievementCategoryReading',
        listening: 'AchievementCategoryListening',
        streak: 'AchievementCategoryStreak',
        diversity: 'AchievementCategoryDiversity',
        milestone: 'AchievementCategoryMilestone'
      }

      const key = categoryKeys[category]
      if (key && this.$strings[key]) {
        return this.$strings[key]
      }

      // Fallback to capitalized category name
      return category.charAt(0).toUpperCase() + category.slice(1)
    },

    formatListeningTime(minutes) {
      if (minutes < 60) {
        return `${minutes}m`
      } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60)
        return `${hours}h`
      } else {
        const days = Math.floor(minutes / 1440)
        const hours = Math.floor((minutes % 1440) / 60)
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`
      }
    }
  },

  head() {
    return {
      title: 'Achievements'
    }
  }
}
</script>
