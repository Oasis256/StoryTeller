<template>
  <div class="page scrollable" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-6xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold">{{ $strings.PageAchievementsTitle }}</h1>

        <ui-dropdown v-model="selectedCategory" :items="categoryOptions" small />
      </div>

      <!-- Stats Overview -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-success">
            {{ stats.unlockedAchievements || 0 }}
          </div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsUnlocked }}</div>
        </div>
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-warning">
            {{ Math.round((stats.completionRate || 0) * 100) }}%
          </div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsCompletionRate }}</div>
        </div>
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-info">
            {{ stats.booksCompleted || 0 }}
          </div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsBooksCompleted }}</div>
        </div>
        <div class="bg-bg border border-border rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-purple-400">
            {{ formatListeningTime(stats.totalListeningMinutes || 0) }}
          </div>
          <div class="text-sm text-gray-300">{{ $strings.PageAchievementsTotalListening }}</div>
        </div>
      </div>
      
      <!-- Admin Button Only -->
      <div v-if="userIsAdmin" class="mb-8 space-x-2">
        <ui-btn color="bg-success" :loading="testingUnlock" @click="testUnlockAchievement">
          {{ $strings.PageAchievementsTestUnlock }}
        </ui-btn>
      </div>

      <!-- Recently Unlocked -->
      <div v-if="recentAchievements.length > 0" class="mb-8">
        <h2 class="text-xl font-semibold mb-4 flex items-center">
          <span class="material-symbols text-yellow-400 mr-2">star</span>
          {{ $strings.PageAchievementsRecentlyUnlocked }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <cards-achievement-card 
            v-for="achievement in recentAchievements" 
            :key="achievement.id" 
            :achievement="achievement" 
            class="ring-2 ring-yellow-400 ring-opacity-50" 
          />
        </div>
      </div>

      <!-- Achievement Categories -->
      <div class="space-y-8">
        <div v-for="(categoryAchievements, category) in filteredAchievementsByCategory" 
             :key="category" 
             v-show="categoryAchievements.length > 0"
             class="achievement-category">
          <h2 class="text-xl font-semibold mb-4 flex items-center capitalize">
            <span class="material-symbols mr-2" :class="getCategoryIconClass(category)">{{ getCategoryIcon(category) }}</span>
            {{ getCategoryTitle(category) }}
            <span class="ml-2 text-sm text-gray-400">
              ({{ categoryAchievements.filter(a => a.isUnlocked).length }}/{{ categoryAchievements.length }})
            </span>
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <cards-achievement-card 
              v-for="achievement in categoryAchievements" 
              :key="achievement.id" 
              :achievement="achievement" 
            />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!hasAnyAchievements && !isLoading" class="text-center py-12">
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
  name: 'AchievementsPage',
  
  async asyncData({ $axios }) {
    try {
      // Get all achievement data at once
      const [achievementsResponse, statsResponse, recentResponse] = await Promise.all([
        $axios.$get('/api/achievements'),
        $axios.$get('/api/achievements/stats'),
        $axios.$get('/api/achievements/recent')
      ]);
      
      // Process the achievements and organize by category
      const rawAchievements = achievementsResponse?.achievements || [];
      const achievements = rawAchievements.map(achievement => processAchievement(achievement));
      
      // Process the stats with proper type conversion
      const rawStats = statsResponse?.stats || {};
      const stats = {
        unlockedAchievements: parseInt(rawStats.unlockedAchievements || 0, 10),
        totalAchievements: parseInt(rawStats.totalAchievements || 0, 10),
        completionRate: parseFloat(rawStats.completionRate || 0),
        totalListeningMinutes: parseInt(rawStats.totalListeningMinutes || 0, 10),
        booksCompleted: parseInt(rawStats.booksCompleted || 0, 10),
        currentStreak: parseInt(rawStats.currentStreak || 0, 10)
      };
      
      // Process recently unlocked achievements
      const rawRecentAchievements = recentResponse?.achievements || [];
      const recentAchievements = rawRecentAchievements
        .filter(a => a) // Remove null items
        .map(achievement => {
          // Handle nested achievement data
          if (achievement.achievement) {
            return {
              ...achievement.achievement,
              id: achievement.id || achievement.achievement.id,
              isUnlocked: true,
              unlockedAt: achievement.unlockedAt || new Date().toISOString(),
              userProgress: parseInt(achievement.achievement.targetValue || 1, 10),
              progressPercent: 100
            };
          }
          return processAchievement(achievement);
        });

      return {
        achievements,
        stats,
        recentAchievements
      };
    } catch (error) {
      console.error('Failed to load achievements data:', error);
      return {
        achievements: [],
        stats: {
          unlockedAchievements: 0,
          totalAchievements: 0,
          completionRate: 0,
          totalListeningMinutes: 0,
          booksCompleted: 0,
          currentStreak: 0
        },
        recentAchievements: []
      };
    }
  },

  data() {
    return {
      isLoading: false,
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

    hasAnyAchievements() {
      return this.achievements && this.achievements.length > 0;
    },

    achievementsByCategory() {
      // Group achievements by category
      const categories = {};
      
      if (this.achievements) {
        this.achievements.forEach(achievement => {
          const category = achievement.category || 'milestone';
          if (!categories[category]) {
            categories[category] = [];
          }
          categories[category].push(achievement);
        });
        
        // Sort achievements within each category (unlocked first, then by progress)
        Object.keys(categories).forEach(category => {
          categories[category].sort((a, b) => {
            // Unlocked achievements first
            if (a.isUnlocked && !b.isUnlocked) return -1;
            if (!a.isUnlocked && b.isUnlocked) return 1;
            
            // For unlocked achievements, sort by unlock date (most recent first)
            if (a.isUnlocked && b.isUnlocked) {
              return new Date(b.unlockedAt || 0) - new Date(a.unlockedAt || 0);
            }
            
            // For locked achievements, sort by progress
            return b.progressPercent - a.progressPercent;
          });
        });
      }
      
      return categories;
    },

    filteredAchievementsByCategory() {
      if (this.selectedCategory === 'all') {
        return this.achievementsByCategory;
      }
      
      const filtered = {};
      if (this.achievementsByCategory[this.selectedCategory]) {
        filtered[this.selectedCategory] = this.achievementsByCategory[this.selectedCategory];
      }
      return filtered;
    },

    categoryOptions() {
      const categories = [
        { text: this.$strings.PageAchievementsAllCategories, value: 'all' }
      ];
      
      // Add available categories from the achievements
      const categoryNames = Object.keys(this.achievementsByCategory);
      categoryNames.forEach(category => {
        categories.push({
          text: this.getCategoryTitle(category),
          value: category
        });
      });
      
      return categories;
    }
  },

  mounted() {
    // Listen for achievement unlock events
    if (this.$socket) {
      this.$socket.on('achievement_unlocked', this.onAchievementUnlocked);
    }
    
    // Automatically check for new achievements when page loads
    this.fetchAchievements();
  },

  beforeDestroy() {
    // Clean up socket listeners
    if (this.$socket) {
      this.$socket.off('achievement_unlocked', this.onAchievementUnlocked);
    }
  },

  methods: {
    async testUnlockAchievement() {
      if (!this.userIsAdmin) return;
      
      this.testingUnlock = true;
      try {
        const response = await this.$axios.$post('/api/achievements/test-unlock', {
          achievementKey: 'first_book'
        });

        this.$toast.success(`Test unlocked: ${response.achievement.Achievement.name}`);
        await this.fetchAchievements();
      } catch (error) {
        console.error('Failed to test unlock achievement:', error);
        if (error.response?.data?.error) {
          this.$toast.error(error.response.data.error);
        } else {
          this.$toast.error('Failed to test unlock achievement');
        }
      } finally {
        this.testingUnlock = false;
      }
    },

    async fetchAchievements() {
      this.isLoading = true;
      try {
        // Fetch updated achievements data and automatically check for new ones
        const [achievementsResponse, statsResponse, recentResponse, checkResponse] = await Promise.all([
          this.$axios.$get('/api/achievements'),
          this.$axios.$get('/api/achievements/stats'),
          this.$axios.$get('/api/achievements/recent'),
          this.$axios.$post('/api/achievements/check')
        ]);
        
        // Process the achievements
        this.achievements = (achievementsResponse?.achievements || [])
          .map(achievement => processAchievement(achievement));
        
        // Process the stats
        if (statsResponse?.stats) {
          this.stats = {
            unlockedAchievements: parseInt(statsResponse.stats.unlockedAchievements || 0, 10),
            totalAchievements: parseInt(statsResponse.stats.totalAchievements || 0, 10),
            completionRate: parseFloat(statsResponse.stats.completionRate || 0),
            totalListeningMinutes: parseInt(statsResponse.stats.totalListeningMinutes || 0, 10),
            booksCompleted: parseInt(statsResponse.stats.booksCompleted || 0, 10),
            currentStreak: parseInt(statsResponse.stats.currentStreak || 0, 10)
          };
        }
        
        // Process the recent achievements
        if (recentResponse?.achievements) {
          this.recentAchievements = recentResponse.achievements
            .filter(a => a) // Remove null items
            .map(achievement => {
              // Handle nested achievement data
              if (achievement.achievement) {
                return {
                  ...achievement.achievement,
                  id: achievement.id || achievement.achievement.id,
                  isUnlocked: true,
                  unlockedAt: achievement.unlockedAt || new Date().toISOString(),
                  userProgress: parseInt(achievement.achievement.targetValue || 1, 10),
                  progressPercent: 100
                };
              }
              return processAchievement(achievement);
            });
        }
        
        // Notify about new achievements if any were unlocked
        if (checkResponse?.newAchievements?.length > 0) {
          this.$toast.success(`Unlocked ${checkResponse.newAchievements.length} new achievement(s)!`);
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error);
        this.$toast.error('Failed to load achievements');
      } finally {
        this.isLoading = false;
      }
    },

    onAchievementUnlocked(data) {
      if (data.userId === this.$store.state.user.user.id) {
        this.unlockedAchievement = data.achievement;
        this.showUnlockModal = true;
        // Refresh achievements
        this.fetchAchievements();
      }
    },

    getCategoryIcon(category) {
      const icons = {
        reading: 'menu_book',
        listening: 'headphones',
        streak: 'local_fire_department',
        diversity: 'explore',
        milestone: 'emoji_events'
      };
      return icons[category] || 'emoji_events';
    },

    getCategoryIconClass(category) {
      const classes = {
        reading: 'text-blue-400',
        listening: 'text-purple-400',
        streak: 'text-red-400',
        diversity: 'text-green-400',
        milestone: 'text-yellow-400'
      };
      return classes[category] || 'text-gray-400';
    },

    getCategoryTitle(category) {
      const categoryKeys = {
        reading: 'AchievementCategoryReading',
        listening: 'AchievementCategoryListening',
        streak: 'AchievementCategoryStreak',
        diversity: 'AchievementCategoryDiversity',
        milestone: 'AchievementCategoryMilestone'
      };

      const key = categoryKeys[category];
      if (key && this.$strings[key]) {
        return this.$strings[key];
      }

      // Fallback to capitalized category name
      return category.charAt(0).toUpperCase() + category.slice(1);
    },

    formatListeningTime(minutes) {
      if (!minutes || isNaN(minutes)) return '0m';
      
      if (minutes < 60) {
        return `${minutes}m`;
      } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        return `${hours}h`;
      } else {
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
      }
    }
  },

  head() {
    return {
      title: 'Achievements'
    };
  }
};

// Helper function for processing achievement data
function processAchievement(achievement) {
  if (!achievement) return null;
  
  // Handle nested achievement data
  const achievementData = achievement.achievement ? achievement.achievement : achievement;
  
  // Create a complete achievement object with all necessary properties
  return {
    ...achievementData,
    id: achievement.id || achievementData.id || `achievement-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: achievementData.name || 'Unknown Achievement',
    description: achievementData.description || '',
    category: achievementData.category || 'milestone',
    isUnlocked: achievement.isUnlocked !== undefined ? achievement.isUnlocked : !!achievement.unlockedAt,
    userProgress: parseInt(achievement.userProgress || achievement.progress || achievementData.userProgress || 0, 10),
    progressPercent: parseInt(achievement.progressPercent || achievementData.progressPercent || 0, 10),
    targetValue: parseInt(achievementData.targetValue || 1, 10),
    targetUnit: achievementData.targetUnit || 'units',
    badgeIcon: achievementData.badgeIcon || 'emoji_events',
    badgeColor: achievementData.badgeColor || '#fbbf24',
    unlockedAt: achievement.unlockedAt || (achievement.isUnlocked ? new Date().toISOString() : null)
  };
}
</script>

<style scoped>
.page.scrollable {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 2rem;
}

.achievement-category {
  margin-bottom: 2rem;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
