<template>
  <div class="goal-card bg-primary bg-opacity-25 rounded-lg p-4 border border-primary">
    <!-- Goal Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1">
        <h3 class="font-semibold text-lg mb-1">{{ goal.title }}</h3>
        <p v-if="goal.description" class="text-sm text-gray-400 mb-2">{{ goal.description }}</p>
        <div class="flex items-center space-x-4 text-xs text-gray-300">
          <span class="flex items-center">
            <span class="w-2 h-2 rounded-full mr-1" :class="typeColor"></span>
            {{ typeLabel }}
          </span>
          <span v-if="goal.daysRemaining !== undefined"> {{ goal.daysRemaining }} {{ $strings.LabelDaysRemaining }} </span>
        </div>
      </div>

      <!-- Goal Status -->
      <div class="flex items-center space-x-2">
        <span v-if="goal.isCompleted" class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-success bg-opacity-20 text-success">
          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          {{ $strings.LabelCompleted }}
        </span>
        <span v-else-if="goal.onTrack" class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-accent bg-opacity-20 text-accent">
          {{ $strings.LabelOnTrack }}
        </span>
        <span v-else class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-warning bg-opacity-20 text-warning">
          {{ $strings.LabelBehind }}
        </span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium"> {{ formatProgress(goal.currentProgress) }} / {{ formatProgress(goal.targetValue) }} </span>
        <span class="text-sm text-gray-400"> {{ Math.round(goal.progressPercentage) }}% </span>
      </div>

      <div class="w-full bg-gray-700 rounded-full h-2">
        <div class="h-2 rounded-full transition-all duration-300" :class="progressBarColor" :style="{ width: `${Math.min(100, goal.progressPercentage)}%` }"></div>
      </div>
    </div>

    <!-- Goal Dates -->
    <div class="mb-4 text-xs text-gray-400">
      <div class="flex justify-between">
        <span>{{ $strings.LabelStarted }}: {{ formatDate(goal.startDate) }}</span>
        <span>{{ $strings.LabelEnds }}: {{ formatDate(goal.endDate) }}</span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <!-- Manual Progress Update -->
        <button v-if="!goal.isCompleted && canManuallyUpdate" @click="showProgressInput = !showProgressInput" class="text-xs px-2 py-1 bg-accent bg-opacity-20 text-accent rounded hover:bg-opacity-30 transition-colors">
          {{ $strings.ButtonUpdateProgress }}
        </button>
      </div>

      <div class="flex items-center space-x-1">
        <button @click="$emit('edit', goal)" class="p-1 text-gray-400 hover:text-accent transition-colors" :title="$strings.ButtonEdit">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>

        <button @click="$emit('delete', goal)" class="p-1 text-gray-400 hover:text-red-400 transition-colors" :title="$strings.ButtonDelete">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 102 0v-1a1 1 0 10-2 0v1zm4 0a1 1 0 102 0v-1a1 1 0 10-2 0v1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Manual Progress Input -->
    <div v-if="showProgressInput" class="mt-3 p-3 bg-primary bg-opacity-40 rounded">
      <div class="flex items-center space-x-2">
        <input v-model.number="manualProgress" type="number" :min="0" :max="goal.targetValue * 2" class="flex-1 px-2 py-1 text-sm bg-primary border border-gray-600 rounded focus:border-accent focus:outline-none" :placeholder="formatProgress(goal.currentProgress)" />
        <button @click="updateProgress" class="px-3 py-1 text-sm bg-accent text-black rounded hover:bg-accent-hover transition-colors">
          {{ $strings.ButtonUpdate }}
        </button>
        <button @click="showProgressInput = false" class="px-2 py-1 text-sm text-gray-400 hover:text-white transition-colors">
          {{ $strings.ButtonCancel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    goal: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showProgressInput: false,
      manualProgress: 0
    }
  },
  computed: {
    typeColor() {
      const colors = {
        books: 'bg-blue-500',
        minutes: 'bg-green-500',
        pages: 'bg-yellow-500',
        series: 'bg-purple-500',
        genres: 'bg-red-500'
      }
      return colors[this.goal.type] || 'bg-gray-500'
    },

    typeLabel() {
      const labels = {
        books: this.$strings.LabelBooks,
        minutes: this.$strings.LabelMinutes,
        pages: this.$strings.LabelPages,
        series: this.$strings.LabelSeries,
        genres: this.$strings.LabelGenres
      }
      return labels[this.goal.type] || this.goal.type
    },

    progressBarColor() {
      if (this.goal.isCompleted) return 'bg-success'
      if (this.goal.progressPercentage >= 80) return 'bg-accent'
      if (this.goal.progressPercentage >= 50) return 'bg-warning'
      return 'bg-gray-500'
    },

    canManuallyUpdate() {
      // Allow manual updates for pages type or if auto-calculation might be inaccurate
      return ['pages', 'genres'].includes(this.goal.type)
    }
  },
  watch: {
    goal: {
      handler(newGoal) {
        this.manualProgress = newGoal.currentProgress
      },
      immediate: true
    }
  },
  methods: {
    formatProgress(value) {
      if (this.goal.type === 'minutes') {
        const hours = Math.floor(value / 60)
        const minutes = value % 60
        if (hours > 0) {
          return `${hours}h ${minutes}m`
        }
        return `${minutes}m`
      }
      return value.toString()
    },

    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString()
    },

    updateProgress() {
      if (this.manualProgress !== this.goal.currentProgress) {
        this.$emit('update-progress', this.goal, this.manualProgress)
      }
      this.showProgressInput = false
    }
  }
}
</script>

<style scoped>
.goal-card {
  transition: all 0.2s ease;
}

.goal-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
