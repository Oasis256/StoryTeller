<template>
  <div class="achievements-page">
    <div class="page-header">
      <h1>{{ $t('MenuItemAchievements') }}</h1>
      <div class="header-actions">
        <button class="refresh-btn" @click="checkAchievements">
          <i class="material-icons">refresh</i>
          <span>{{ $t('ButtonCheckAchievements') }}</span>
        </button>
      </div>
    </div>

    <div class="user-level-section">
      <UserLevel :levelInfo="levelInfo" />
    </div>

    <div class="stats-section">
      <div class="stats-card">
        <i class="material-icons">emoji_events</i>
        <div class="stats-value" @click="console.log('Stats object:', stats)">{{ stats.unlockedAchievements }} / {{ stats.totalAchievements }}</div>
        <div class="stats-label">{{ $t('LabelAchievementsUnlocked') }}</div>
      </div>
      <div class="stats-card">
        <i class="material-icons">local_fire_department</i>
        <div class="stats-value">{{ stats.currentStreak }}</div>
        <div class="stats-label">{{ $t('LabelDayStreak') }}</div>
      </div>
      <div class="stats-card">
        <i class="material-icons">timer</i>
        <div class="stats-value">{{ formatListeningTime(stats.totalListeningMinutes) }}</div>
        <div class="stats-label">{{ $t('LabelTotalListeningTime') }}</div>
      </div>
      <div class="stats-card">
        <i class="material-icons">book</i>
        <div class="stats-value">{{ stats.booksCompleted }}</div>
        <div class="stats-label">{{ $t('LabelBooksCompleted') }}</div>
      </div>
    </div>

    <div class="achievements-filters">
      <div class="filter-group">
        <div 
          v-for="category in categories" 
          :key="category.value" 
          class="filter-btn"
          :class="{ active: selectedCategory === category.value }"
          @click="selectedCategory = category.value"
        >
          <i class="material-icons">{{ category.icon }}</i>
          <span>{{ category.label }}</span>
        </div>
      </div>
      <div class="search-filter">
        <input 
          type="text" 
          v-model="searchQuery" 
          :placeholder="$t('PlaceholderSearchAchievements')" 
          class="search-input" 
        />
      </div>
    </div>

    <div class="achievements-grid">
      <AchievementBadge 
        v-for="achievement in filteredAchievements" 
        :key="achievement.id" 
        :achievement="achievement" 
        @show-details="selectedAchievement = achievement"
      />
    </div>

    <div class="empty-state" v-if="filteredAchievements.length === 0">
      <i class="material-icons">search_off</i>
      <p>{{ $t('TextNoAchievementsFound') }}</p>
    </div>

    <!-- Achievement Details Modal -->
    <div class="modal-overlay" v-if="selectedAchievement" @click.self="selectedAchievement = null">
      <div class="modal-content">
        <button class="close-modal" @click="selectedAchievement = null">
          <i class="material-icons">close</i>
        </button>
        <AchievementDetail :achievement="selectedAchievement" />
      </div>
    </div>

    <!-- Achievement Notification -->
    <AchievementNotification 
      v-if="notification.visible" 
      :achievement="notification.achievement" 
      :visible="notification.visible" 
      @close="notification.visible = false" 
    />
  </div>
</template>

<script>
import UserLevel from '~/components/ui/UserLevel.vue'
import AchievementBadge from '~/components/ui/AchievementBadge.vue'
import AchievementDetail from '~/components/ui/AchievementDetail.vue'
import AchievementNotification from '~/components/ui/AchievementNotification.vue'

export default {
  middleware: 'authenticated',
  components: {
    UserLevel,
    AchievementBadge,
    AchievementDetail,
    AchievementNotification
  },
  data() {
    return {
      achievements: [],
      stats: {
        totalAchievements: 0,
        unlockedAchievements: 0,
        completionRate: 0,
        totalListeningMinutes: 0,
        booksCompleted: 0,
        currentStreak: 0
      },
      levelInfo: {
        level: 1,
        totalXP: 0,
        xpForCurrentLevel: 0,
        xpForNextLevel: 100,
        xpProgressToNextLevel: 0,
        percentToNextLevel: 0,
        reward: null
      },
      selectedAchievement: null,
      selectedCategory: 'all',
      searchQuery: '',
      isLoading: false,
      notification: {
        visible: false,
        achievement: null
      },
      categories: [
        { value: 'all', label: 'All', icon: 'category' },
        { value: 'unlocked', label: 'Unlocked', icon: 'check_circle' },
        { value: 'locked', label: 'Locked', icon: 'lock' },
        { value: 'listening', label: 'Listening', icon: 'headphones' },
        { value: 'streak', label: 'Streaks', icon: 'local_fire_department' },
        { value: 'milestone', label: 'Milestones', icon: 'flag' },
        { value: 'diversity', label: 'Diversity', icon: 'diversity_3' }
      ]
    }
  },
  computed: {
    filteredAchievements() {
      let filtered = this.achievements

      // Category filter
      if (this.selectedCategory === 'unlocked') {
        filtered = filtered.filter(a => a.isUnlocked)
      } else if (this.selectedCategory === 'locked') {
        filtered = filtered.filter(a => !a.isUnlocked)
      } else if (this.selectedCategory !== 'all') {
        filtered = filtered.filter(a => a.category === this.selectedCategory)
      }

      // Search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        filtered = filtered.filter(a => 
          a.name.toLowerCase().includes(query) || 
          a.description.toLowerCase().includes(query)
        )
      }

      return filtered
    }
  },
  async mounted() {
    this.initCategories()
    await this.fetchData()
    this.setupSocketListeners()
  },
  beforeDestroy() {
    this.removeSocketListeners()
  },
  methods: {
    async fetchData() {
      this.isLoading = true
      try {
        // Get user level info
        const levelInfo = await this.$axios.$get('/api/xp/user-level')
        this.levelInfo = levelInfo

        // Get achievement progress
        const [allAchievements, userAchievements, achievementStats] = await Promise.all([
          this.$axios.$get('/api/achievements'),
          this.$axios.$get('/api/achievements/progress'),
          this.$axios.$get('/api/achievements/stats')
        ])
        
        // Combine all achievements with user progress
        const userAchievementMap = {}
        userAchievements.achievements.forEach(ua => {
          userAchievementMap[ua.achievementId] = ua
        })
        
        this.achievements = allAchievements.achievements.map(a => {
          const userAchievement = userAchievementMap[a.id] || {}
          const progressPercent = userAchievement.progress ? 
            (userAchievement.progress / a.targetValue) * 100 : 0
          
          return {
            ...a,
            ...userAchievement,
            progressPercent: Math.min(100, progressPercent)
          }
        })
        
        // Debug logging to check what's in the stats response
        console.log('Achievement stats response:', achievementStats)
        
        // Update stats - make sure we're getting the correct structure
        if (achievementStats && achievementStats.stats) {
          console.log('Stats to be assigned:', achievementStats.stats)
          
          // Process stats with type conversion and defaults
          // Always convert string numbers to actual numbers in case they're strings from API
          const fixedStats = {
            ...achievementStats.stats,
            unlockedAchievements: parseInt(achievementStats.stats.unlockedAchievements || 0, 10),
            totalAchievements: parseInt(achievementStats.stats.totalAchievements || 0, 10),
            completionRate: parseFloat(achievementStats.stats.completionRate || 0),
            totalListeningMinutes: parseInt(achievementStats.stats.totalListeningMinutes || 0, 10),
            booksCompleted: parseInt(achievementStats.stats.booksCompleted || 0, 10),
            currentStreak: parseInt(achievementStats.stats.currentStreak || 0, 10)
          }
          
          console.log('Fixed stats object to assign:', fixedStats)
          
          // Replace entire stats object to ensure reactivity
          this.stats = fixedStats
          
          // Log the updated stats object after assignment
          console.log('Updated stats object:', this.stats)
          
          // Log specific values to verify
          console.log('Unlocked count check:', this.stats.unlockedAchievements, 
            'Total:', this.stats.totalAchievements, 
            'Completion:', this.stats.completionRate)
        } else {
          console.warn('Achievement stats has unexpected format:', achievementStats)
        }
      } catch (error) {
        console.error('Failed to load achievements:', error)
        this.$toast.error(this.$t('ToastFailedToLoadAchievements'))
      } finally {
        this.isLoading = false
      }
    },
    
    setupSocketListeners() {
      const socket = this.$nuxt.$socket
      
      if (socket) {
        socket.on('achievement_unlocked', this.handleAchievementUnlocked)
        socket.on('xp_updated', this.handleXPUpdated)
      }
    },
    
    removeSocketListeners() {
      const socket = this.$nuxt.$socket
      
      if (socket) {
        socket.off('achievement_unlocked', this.handleAchievementUnlocked)
        socket.off('xp_updated', this.handleXPUpdated)
      }
    },
    
    handleAchievementUnlocked(data) {
      if (data && data.achievement) {
        // Update local achievement list
        this.updateAchievementUnlocked(data.achievement)
        
        // Show notification
        this.notification = {
          visible: true,
          achievement: data.achievement
        }
        
        // Play sound
        this.playAchievementSound()
      }
    },
    
    handleXPUpdated(data) {
      if (data && data.levelInfo) {
        this.levelInfo = data.levelInfo
        
        // Add animation class
        this.$nextTick(() => {
          const el = document.querySelector('.total-xp')
          if (el) {
            el.classList.add('xp-gain')
            setTimeout(() => {
              el.classList.remove('xp-gain')
            }, 500)
          }
        })
      }
    },
    
    updateAchievementUnlocked(achievement) {
      const index = this.achievements.findIndex(a => a.id === achievement.id)
      if (index !== -1) {
        this.achievements[index] = {
          ...this.achievements[index],
          ...achievement,
          isUnlocked: true,
          progressPercent: 100
        }
        
        // Update stats
        this.stats.unlockedAchievements++
        this.stats.completionRate = this.stats.unlockedAchievements / this.stats.totalAchievements
      }
    },
    
    async checkAchievements() {
      try {
        this.$toast.info(this.$t('ToastCheckingAchievements'))
        const result = await this.$axios.$post('/api/achievements/check')
        
        if (result.newAchievements && result.newAchievements.length > 0) {
          this.$toast.success(this.$t('ToastNewAchievementsUnlocked', { count: result.newAchievements.length }))
          await this.fetchData()
        } else {
          this.$toast.info(this.$t('ToastNoNewAchievements'))
        }
      } catch (error) {
        console.error('Failed to check achievements:', error)
        this.$toast.error(this.$t('ToastFailedToCheckAchievements'))
      }
    },
    
    playAchievementSound() {
      try {
        const audio = new Audio('/sounds/achievement.mp3')
        audio.volume = 0.5
        audio.play()
      } catch (error) {
        console.error('Failed to play achievement sound:', error)
      }
    },
    
    formatListeningTime(minutes) {
      if (!minutes) return '0h'
      
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      
      if (hours === 0) {
        return `${remainingMinutes}m`
      } else if (remainingMinutes === 0) {
        return `${hours}h`
      } else {
        return `${hours}h ${remainingMinutes}m`
      }
    },
    
    initCategories() {
      this.categories = [
        { value: 'all', label: this.$t('LabelAchievementAll'), icon: 'category' },
        { value: 'unlocked', label: this.$t('LabelAchievementUnlocked'), icon: 'check_circle' },
        { value: 'locked', label: this.$t('LabelAchievementsLocked'), icon: 'lock' },
        { value: 'listening', label: this.$t('LabelAchievementCategoryListening'), icon: 'headphones' },
        { value: 'streak', label: this.$t('LabelAchievementCategoryStreaks'), icon: 'local_fire_department' },
        { value: 'milestone', label: this.$t('LabelAchievementCategoryMilestones'), icon: 'flag' },
        { value: 'diversity', label: this.$t('LabelAchievementCategoryDiversity'), icon: 'diversity_3' }
      ]
    }
  },
  head() {
    return {
      title: this.$t('MenuItemAchievements')
    }
  }
}
</script>

<style scoped>
.achievements-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h1 {
  margin: 0;
  color: white;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.refresh-btn i {
  margin-right: 5px;
  font-size: 18px;
}

.refresh-btn:hover {
  background-color: #2980b9;
}

.user-level-section {
  margin-bottom: 20px;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.stats-card {
  background-color: #34495e;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.stats-card i {
  font-size: 30px;
  margin-bottom: 10px;
  color: #3498db;
}

.stats-value {
  font-size: 24px;
  font-weight: 700;
  color: white;
  margin-bottom: 5px;
}

.stats-label {
  font-size: 14px;
  color: #a4b0be;
}

.achievements-filters {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-btn {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #34495e;
  border-radius: 20px;
  color: #a4b0be;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.filter-btn i {
  margin-right: 5px;
  font-size: 18px;
}

.filter-btn:hover {
  background-color: #2c3e50;
  color: white;
}

.filter-btn.active {
  background-color: #3498db;
  color: white;
}

.search-filter {
  flex: 0 0 250px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 20px;
  background-color: #34495e;
  border: none;
  color: white;
  font-size: 14px;
  outline: none;
  transition: background-color 0.2s;
}

.search-input:focus {
  background-color: #2c3e50;
}

.search-input::placeholder {
  color: #a4b0be;
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.empty-state {
  text-align: center;
  padding: 30px;
  color: #a4b0be;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 10px;
}

.empty-state p {
  font-size: 16px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  box-sizing: border-box;
}

.modal-content {
  background-color: #2c3e50;
  border-radius: 10px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.close-modal {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  z-index: 10;
}

/* Responsive styles */
@media (max-width: 768px) {
  .stats-section {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .achievements-filters {
    flex-direction: column;
  }
  
  .search-filter {
    flex: none;
    width: 100%;
  }
  
  .achievements-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-section {
    grid-template-columns: 1fr;
  }
  
  .achievements-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
