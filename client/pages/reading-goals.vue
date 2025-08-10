<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex flex-col h-full max-w-6xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between py-4 px-4 border-b border-primary">
        <h1 class="text-2xl font-semibold">{{ $strings.HeaderReadingGoals }}</h1>
        <div class="flex items-center space-x-2">
          <ui-btn small @click="showCreateGoalModal = true">
            {{ $strings.ButtonNewGoal }}
          </ui-btn>
          <ui-btn small color="secondary" @click="recalculateProgress">
            {{ $strings.ButtonRecalculate }}
          </ui-btn>
        </div>
      </div>

      <!-- Stats Section -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 p-4" v-if="goalStats">
        <div class="bg-primary bg-opacity-25 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-accent">{{ goalStats.activeGoals }}</div>
          <div class="text-sm text-gray-300">{{ $strings.LabelActiveGoals }}</div>
        </div>
        <div class="bg-primary bg-opacity-25 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-success">{{ goalStats.completedGoals }}</div>
          <div class="text-sm text-gray-300">{{ $strings.LabelCompletedGoals }}</div>
        </div>
        <div class="bg-primary bg-opacity-25 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-warning">{{ Math.round(goalStats.completionRate) }}%</div>
          <div class="text-sm text-gray-300">{{ $strings.LabelCompletionRate }}</div>
        </div>
        <div class="bg-primary bg-opacity-25 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-info">{{ goalStats.totalGoals }}</div>
          <div class="text-sm text-gray-300">{{ $strings.LabelTotalGoals }}</div>
        </div>
      </div>

      <!-- Goals List -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Active Goals -->
        <div v-if="activeGoals.length" class="mb-8">
          <h2 class="text-xl font-semibold mb-4 flex items-center">
            <span class="w-3 h-3 bg-accent rounded-full mr-2"></span>
            {{ $strings.HeaderActiveGoals }}
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="goal in activeGoals" 
              :key="goal.id" 
              class="bg-primary bg-opacity-25 rounded-lg p-4 border border-primary"
            >
              <h3 class="font-semibold text-lg mb-2">{{ goal.title }}</h3>
              <p class="text-sm text-gray-400 mb-2">{{ goal.description }}</p>
              <p class="text-sm">Type: {{ goal.type }}</p>
              <p class="text-sm">Progress: {{ goal.currentProgress }}/{{ goal.targetValue }}</p>
              <div class="mt-4 flex space-x-2">
                <button 
                  @click="editGoal(goal)"
                  class="px-3 py-1 bg-accent text-sm rounded hover:bg-accent-hover"
                >
                  Edit
                </button>
                <button 
                  @click="deleteGoal(goal)"
                  class="px-3 py-1 bg-red-600 text-sm rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Debug Info -->
        <div v-if="activeGoals.length" class="mb-8 p-4 bg-gray-800 rounded">
          <h3 class="text-lg font-semibold mb-2">Debug Info:</h3>
          <p>Active Goals Count: {{ activeGoals.length }}</p>
          <p>First Goal: {{ JSON.stringify(activeGoals[0], null, 2) }}</p>
        </div>

        <!-- Completed Goals -->
        <div v-if="completedGoals.length" class="mb-8">
          <h2 class="text-xl font-semibold mb-4 flex items-center">
            <span class="w-3 h-3 bg-success rounded-full mr-2"></span>
            {{ $strings.HeaderCompletedGoals }}
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="goal in completedGoals" 
              :key="goal.id" 
              class="bg-primary bg-opacity-25 rounded-lg p-4 border border-primary"
            >
              <h3 class="font-semibold text-lg mb-2">{{ goal.title }}</h3>
              <p class="text-sm text-gray-400 mb-2">{{ goal.description }}</p>
              <p class="text-sm">Type: {{ goal.type }}</p>
              <p class="text-sm">Progress: {{ goal.currentProgress }}/{{ goal.targetValue }}</p>
              <div class="mt-4 flex space-x-2">
                <button 
                  @click="editGoal(goal)"
                  class="px-3 py-1 bg-accent text-sm rounded hover:bg-accent-hover"
                >
                  Edit
                </button>
                <button 
                  @click="deleteGoal(goal)"
                  class="px-3 py-1 bg-red-600 text-sm rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!activeGoals.length && !completedGoals.length && !isLoading" class="flex flex-col items-center justify-center py-16">
          <div class="text-6xl mb-4">🎯</div>
          <h3 class="text-xl font-semibold mb-2">{{ $strings.MessageNoGoals }}</h3>
          <p class="text-gray-400 mb-6 text-center max-w-md">{{ $strings.MessageNoGoalsDescription }}</p>
                    <ui-btn @click="showCreateGoalModal = true">
            {{ $strings.ButtonCreateFirstGoal }}
          </ui-btn>
        </div>
      </div>
    </div>

    <!-- Create/Edit Goal Modal -->
    <ModalsReadingGoalModal 
      v-model="showCreateGoalModal"
      :goal="editingGoal"
      :templates="goalTemplates"
      @close="closeGoalModal"
      @save="saveGoal"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      isLoading: false,
      activeGoals: [],
      completedGoals: [],
      goalStats: null,
      goalTemplates: [],
      showCreateGoalModal: false,
      editingGoal: null
    }
  },
  async mounted() {
    await this.loadGoals()
    await this.loadStats()
    await this.loadTemplates()
  },
  methods: {
    async loadGoals() {
      this.isLoading = true
      try {
        const [allActiveResponse, completedResponse] = await Promise.all([
          this.$axios.$get('/api/reading-goals?active=true'),
          this.$axios.$get('/api/reading-goals?completed=true')
        ])
        
        const allActiveGoals = allActiveResponse.goals || []
        const allCompletedGoals = completedResponse.goals || []
        
        // Create a Set of completed goal IDs for fast lookup
        const completedGoalIds = new Set(allCompletedGoals.map(goal => goal.id))
        
        // Filter active goals to exclude those that are also completed
        this.activeGoals = allActiveGoals.filter(goal => !completedGoalIds.has(goal.id))
        this.completedGoals = allCompletedGoals
      } catch (error) {
        console.error('Failed to load goals:', error)
        this.$toast.error('Failed to load reading goals')
      } finally {
        this.isLoading = false
      }
    },

    async loadStats() {
      try {
        this.goalStats = await this.$axios.$get('/api/reading-goals/stats')
      } catch (error) {
        console.error('Failed to load goal stats:', error)
      }
    },

    async loadTemplates() {
      try {
        const response = await this.$axios.$get('/api/reading-goals/templates')
        this.goalTemplates = response.templates || []
      } catch (error) {
        console.error('Failed to load goal templates:', error)
      }
    },

    async saveGoal(goalData) {
      try {
        if (this.editingGoal) {
          await this.$axios.$patch(`/api/reading-goals/${this.editingGoal.id}`, goalData)
          this.$toast.success('Goal updated successfully')
        } else {
          await this.$axios.$post('/api/reading-goals', goalData)
          this.$toast.success('Goal created successfully')
        }
        
        await this.loadGoals()
        await this.loadStats()
        this.closeGoalModal()
      } catch (error) {
        console.error('Failed to save goal:', error)
        this.$toast.error('Failed to save goal')
      }
    },

    editGoal(goal) {
      this.editingGoal = { ...goal }
      this.showCreateGoalModal = true
    },

    async deleteGoal(goal) {
      if (!confirm(`Are you sure you want to delete "${goal.title}"?`)) return
      
      try {
        await this.$axios.$delete(`/api/reading-goals/${goal.id}`)
        this.$toast.success('Goal deleted successfully')
        await this.loadGoals()
        await this.loadStats()
      } catch (error) {
        console.error('Failed to delete goal:', error)
        this.$toast.error('Failed to delete goal')
      }
    },

    async updateGoalProgress(goal, newProgress) {
      try {
        await this.$axios.$post(`/api/reading-goals/${goal.id}/progress`, {
          progress: newProgress
        })
        
        await this.loadGoals()
        await this.loadStats()
      } catch (error) {
        console.error('Failed to update goal progress:', error)
        this.$toast.error('Failed to update progress')
      }
    },

    async recalculateProgress() {
      this.isLoading = true
      try {
        await this.$axios.$post('/api/reading-goals/recalculate')
        this.$toast.success('Progress recalculated')
        await this.loadGoals()
        await this.loadStats()
      } catch (error) {
        console.error('Failed to recalculate progress:', error)
        this.$toast.error('Failed to recalculate progress')
      } finally {
        this.isLoading = false
      }
    },

    closeGoalModal() {
      this.showCreateGoalModal = false
      this.editingGoal = null
    }
  }
}
</script>
