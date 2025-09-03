<template>
  <div class="achievement-card bg-bg rounded-lg p-4 border transition-all duration-200 hover:shadow-lg" :class="cardClasses">
    <div class="flex items-start space-x-4">
      <!-- Badge Icon -->
      <div class="flex-shrink-0">
        <div class="achievement-badge w-16 h-16 rounded-full flex items-center justify-center text-2xl" :style="badgeStyle">
          <span class="material-symbols" :class="{ 'text-white': achievement.isUnlocked, 'text-gray-500': !achievement.isUnlocked }">
            {{ getMaterialIcon(achievement.badgeIcon) }}
          </span>
        </div>
      </div>

      <!-- Achievement Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-lg truncate" :class="{ 'text-white': achievement.isUnlocked, 'text-gray-300': !achievement.isUnlocked }">
            {{ achievementName }}
          </h3>
          <div v-if="achievement.isUnlocked" class="text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-medium">
            {{ $strings.LabelAchievementUnlocked }}
          </div>
        </div>

        <p class="text-sm text-gray-400 mb-3 line-clamp-2">
          {{ achievementDescription }}
        </p>

        <!-- Progress Bar -->
        <div class="mb-2">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-gray-400">{{ $strings.LabelAchievementProgress }}</span>
            <span :class="{ 'text-yellow-400 font-medium': achievement.isUnlocked, 'text-gray-400': !achievement.isUnlocked }"> {{ achievement.userProgress || 0 }} / {{ achievement.targetValue }} ({{ achievement.progressPercent || 0 }}%) </span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div class="h-2 rounded-full transition-all duration-500" :class="progressBarClass" :style="{ width: Math.min(100, achievement.progressPercent || 0) + '%' }"></div>
          </div>
        </div>

        <!-- Achievement Details -->
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center space-x-2">
            <span class="px-2 py-1 bg-gray-700 rounded-full text-gray-300 capitalize">
              {{ categoryName }}
            </span>
            <span class="text-gray-500"> {{ achievement.targetValue }} {{ achievement.targetUnit }} </span>
          </div>

          <div v-if="achievement.isUnlocked && achievement.unlockedAt" class="text-gray-500">
            {{ formatUnlockedDate(achievement.unlockedAt) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Unlock Animation Overlay -->
    <div v-if="showUnlockAnimation" class="absolute inset-0 bg-yellow-400 bg-opacity-20 rounded-lg flex items-center justify-center">
      <div class="text-6xl animate-bounce">🎉</div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    achievement: {
      type: Object,
      required: true
    },
    showAnimation: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      showUnlockAnimation: false
    }
  },

  computed: {
    achievementName() {
      // Try to get localized name first, fallback to original name
      if (this.achievement.nameKey && this.$strings[this.achievement.nameKey]) {
        return this.$strings[this.achievement.nameKey]
      }
      return this.achievement.name
    },

    achievementDescription() {
      // Try to get localized description first, fallback to original description
      if (this.achievement.descKey && this.$strings[this.achievement.descKey]) {
        return this.$strings[this.achievement.descKey]
      }
      return this.achievement.description
    },

    categoryName() {
      // Localize category names
      const categoryKey = `AchievementCategory${this.achievement.category.charAt(0).toUpperCase() + this.achievement.category.slice(1)}`
      if (this.$strings[categoryKey]) {
        return this.$strings[categoryKey]
      }
      return this.achievement.category
    },

    cardClasses() {
      return {
        'border-yellow-400': this.achievement.isUnlocked,
        'border-gray-600': !this.achievement.isUnlocked,
        'hover:border-yellow-300': this.achievement.isUnlocked,
        'hover:border-gray-500': !this.achievement.isUnlocked,
        'achievement-unlocked': this.achievement.isUnlocked,
        'achievement-locked': !this.achievement.isUnlocked,
        relative: true
      }
    },

    badgeStyle() {
      if (this.achievement.isUnlocked) {
        return {
          backgroundColor: this.achievement.badgeColor || '#fbbf24',
          boxShadow: `0 0 20px ${this.achievement.badgeColor || '#fbbf24'}40`
        }
      } else {
        return {
          backgroundColor: '#374151',
          border: '2px dashed #6b7280'
        }
      }
    },

    progressBarClass() {
      if (this.achievement.isUnlocked) {
        return 'bg-yellow-400'
      } else if (this.achievement.progressPercent >= 75) {
        return 'bg-green-400'
      } else if (this.achievement.progressPercent >= 50) {
        return 'bg-blue-400'
      } else if (this.achievement.progressPercent >= 25) {
        return 'bg-purple-400'
      } else {
        return 'bg-gray-600'
      }
    }
  },

  watch: {
    'achievement.isUnlocked'(newVal, oldVal) {
      if (newVal && !oldVal && this.showAnimation) {
        this.playUnlockAnimation()
      }
    }
  },

  mounted() {
    if (this.showAnimation && this.achievement.isUnlocked) {
      this.playUnlockAnimation()
    }
  },

  methods: {
    playUnlockAnimation() {
      this.showUnlockAnimation = true
      setTimeout(() => {
        this.showUnlockAnimation = false
      }, 2000)
    },

    formatUnlockedDate(dateString) {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        return 'Today'
      } else if (diffDays === 1) {
        return 'Yesterday'
      } else if (diffDays < 7) {
        return `${diffDays} days ago`
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7)
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`
      } else {
        return date.toLocaleDateString()
      }
    },
    
    getMaterialIcon(iconName) {
      if (!iconName) return 'emoji_events'
      
      // Map non-standard icon names to Material Icons
      const iconMap = {
        'chart-bar': 'bar_chart',
        'calendar': 'calendar_month',
        'crown': 'workspace_premium',
        'library': 'local_library',
        'ace-cap': 'school',
        'open': 'book',
        'trending': 'trending_up'
      }
      
      return iconMap[iconName.toLowerCase()] || iconName
    }
  }
}
</script>

<style scoped>
.achievement-card {
  transition: all 0.3s ease;
}

.achievement-card:hover {
  transform: translateY(-2px);
}

.achievement-unlocked {
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
}

.achievement-locked {
  opacity: 0.7;
}

.achievement-badge {
  transition: all 0.3s ease;
}

.achievement-unlocked .achievement-badge {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
