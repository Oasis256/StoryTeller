<template>
  <modals-modal v-model="show" name="reading-goal" :width="600" :height="700">
    <template #header>
      <div class="text-xl font-semibold">
        {{ isEditing ? $strings.HeaderEditGoal : $strings.HeaderCreateGoal }}
      </div>
    </template>

    <form @submit.prevent="save" class="space-y-6">
      <!-- Template Selection (only for new goals) -->
      <div v-if="!isEditing && templates.length" class="space-y-3">
        <label class="block text-sm font-medium">{{ $strings.LabelChooseTemplate }}</label>
        <div class="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
          <button v-for="template in templates" :key="template.title" type="button" @click="applyTemplate(template)" class="text-left p-3 rounded border border-primary hover:border-accent transition-colors" :class="selectedTemplate?.title === template.title ? 'border-accent bg-accent bg-opacity-10' : ''">
            <div class="font-medium">{{ template.title }}</div>
            <div class="text-sm text-gray-400">{{ template.description }}</div>
            <div class="text-xs text-accent mt-1">{{ template.targetValue }} {{ getTypeLabel(template.type) }} • {{ template.category }}</div>
          </button>
        </div>
        <div class="border-t border-primary pt-4">
          <button type="button" @click="clearTemplate" class="text-sm text-accent hover:text-accent-hover">
            {{ $strings.ButtonCreateCustomGoal }}
          </button>
        </div>
      </div>

      <!-- Goal Details -->
      <div class="space-y-4">
        <!-- Title -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ $strings.LabelGoalTitle }} *</label>
          <input v-model="formData.title" type="text" required class="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md focus:border-accent focus:outline-none" :placeholder="$strings.PlaceholderGoalTitle" />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ $strings.LabelDescription }}</label>
          <textarea v-model="formData.description" rows="3" class="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md focus:border-accent focus:outline-none resize-none" :placeholder="$strings.PlaceholderGoalDescription"></textarea>
        </div>

        <!-- Goal Type -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ $strings.LabelGoalType }} *</label>
          <select v-model="formData.type" :key="'goal-type-' + formData.type" required class="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md focus:border-accent focus:outline-none">
            <option value="books">{{ $strings.LabelBooks }}</option>
            <option value="minutes">{{ $strings.LabelListeningMinutes }}</option>
            <option value="pages">{{ $strings.LabelPages }}</option>
            <option value="series">{{ $strings.LabelSeries }}</option>
            <option value="genres">{{ $strings.LabelGenres }}</option>
          </select>
        </div>

        <!-- Target Value -->
        <div>
          <label class="block text-sm font-medium mb-2">
            {{ $strings.LabelTarget }} *
            <span class="text-sm text-gray-400">({{ getTypeLabel(formData.type) }})</span>
          </label>
          <input v-model.number="formData.targetValue" type="number" min="1" required class="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md focus:border-accent focus:outline-none" :placeholder="getTargetPlaceholder(formData.type)" />
        </div>

        <!-- Date Range -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2">{{ $strings.LabelStartDate }} *</label>
            <input v-model="formData.startDate" type="date" required class="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">{{ $strings.LabelEndDate }} *</label>
            <input v-model="formData.endDate" type="date" required class="w-full px-3 py-2 bg-primary border border-gray-600 rounded-md focus:border-accent focus:outline-none" />
          </div>
        </div>

        <!-- Genre Selection (for genres type) -->
        <div v-if="formData.type === 'genres'" class="space-y-2">
          <label class="block text-sm font-medium">{{ $strings.LabelTargetGenres }}</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="genre in availableGenres" :key="genre" type="button" @click="toggleGenre(genre)" class="px-3 py-1 text-sm rounded-full border transition-colors" :class="selectedGenres.includes(genre) ? 'border-accent bg-accent bg-opacity-20 text-accent' : 'border-gray-600 text-gray-300 hover:border-gray-500'">
              {{ genre }}
            </button>
          </div>
          <p class="text-xs text-gray-400">
            {{ $strings.MessageSelectTargetGenres }}
          </p>
        </div>

        <!-- Active Toggle -->
        <div class="flex items-center space-x-2">
          <input v-model="formData.isActive" type="checkbox" id="active-toggle" class="w-4 h-4 text-accent bg-primary border-gray-600 rounded focus:ring-accent focus:ring-2" />
          <label for="active-toggle" class="text-sm font-medium">
            {{ $strings.LabelActiveGoal }}
          </label>
        </div>
      </div>

      <!-- Validation Errors -->
      <div v-if="errors.length" class="bg-red-500 bg-opacity-20 border border-red-500 rounded p-3">
        <ul class="text-sm">
          <li v-for="error in errors" :key="error" class="text-red-400">{{ error }}</li>
        </ul>
      </div>

      <!-- Form Actions -->
      <div class="flex items-center justify-end space-x-3 pt-4 border-t border-primary">
        <ui-btn small type="button" color="ghost" @click="close">
          {{ $strings.ButtonCancel }}
        </ui-btn>
        <ui-btn small type="submit" :loading="isSaving">
          {{ isEditing ? $strings.ButtonUpdateGoal : $strings.ButtonCreateGoal }}
        </ui-btn>
      </div>
    </form>
  </modals-modal>
</template>

<script>
export default {
  props: {
    goal: {
      type: Object,
      default: null
    },
    templates: {
      type: Array,
      default: () => []
    },
    value: Boolean
  },
  data() {
    return {
      isSaving: false,
      selectedTemplate: null,
      availableGenres: ['Fiction', 'Non-Fiction', 'Mystery', 'Science Fiction', 'Fantasy', 'Romance', 'Thriller', 'Biography', 'History', 'Self-Help', 'Business', 'Health', 'Travel', 'Cooking', 'Art', 'Religion', 'Philosophy', 'Science', 'Technology', 'Children'],
      selectedGenres: [],
      formData: {
        title: '',
        description: '',
        type: 'books', // Always default to 'books'
        targetValue: 12,
        startDate: '',
        endDate: '',
        isActive: true,
        extraData: {}
      },
      errors: []
    }
  },
  computed: {
    isEditing() {
      return !!this.goal
    },
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          this.initializeForm()
        }
      }
    }
  },
  created() {
    // Ensure form data is always properly initialized
    this.initializeForm()
  },
  methods: {
    initializeForm() {
      const currentYear = new Date().getFullYear()
      const startOfYear = new Date(currentYear, 0, 1).toISOString().split('T')[0]
      const endOfYear = new Date(currentYear, 11, 31).toISOString().split('T')[0]

      if (this.isEditing) {
        this.formData = {
          ...this.goal,
          startDate: new Date(this.goal.startDate).toISOString().split('T')[0],
          endDate: new Date(this.goal.endDate).toISOString().split('T')[0]
        }
        if (this.goal.extraData?.targetGenres) {
          this.selectedGenres = [...this.goal.extraData.targetGenres]
        }
      } else {
        this.formData = {
          title: '',
          description: '',
          type: 'books',
          targetValue: 12,
          startDate: startOfYear,
          endDate: endOfYear,
          isActive: true,
          extraData: {}
        }
      }

      // Ensure type is always set to a valid value
      if (!this.formData.type || !['books', 'minutes', 'pages', 'series', 'genres'].includes(this.formData.type)) {
        this.formData.type = 'books'
      }
    },

    applyTemplate(template) {
      this.selectedTemplate = template
      this.formData = {
        title: template.title,
        description: template.description,
        type: template.type,
        targetValue: template.targetValue,
        startDate: new Date(template.startDate).toISOString().split('T')[0],
        endDate: new Date(template.endDate).toISOString().split('T')[0],
        isActive: true,
        extraData: { ...template.extraData }
      }

      if (template.extraData?.targetGenres) {
        this.selectedGenres = [...template.extraData.targetGenres]
      }
    },

    clearTemplate() {
      this.selectedTemplate = null
      this.initializeForm()
    },

    toggleGenre(genre) {
      const index = this.selectedGenres.indexOf(genre)
      if (index > -1) {
        this.selectedGenres.splice(index, 1)
      } else {
        this.selectedGenres.push(genre)
      }
    },

    getTypeLabel(type) {
      const labels = {
        books: this.$strings.LabelBooks,
        minutes: this.$strings.LabelMinutes,
        pages: this.$strings.LabelPages,
        series: this.$strings.LabelSeries,
        genres: this.$strings.LabelGenres
      }
      return labels[type] || type
    },

    getTargetPlaceholder(type) {
      const placeholders = {
        books: '12',
        minutes: '10950',
        pages: '3650',
        series: '3',
        genres: '5'
      }
      return placeholders[type] || '10'
    },

    validate() {
      this.errors = []

      if (!this.formData.title.trim()) {
        this.errors.push(this.$strings.ErrorGoalTitleRequired)
      }

      if (!this.formData.type) {
        this.errors.push(this.$strings.ErrorGoalTypeRequired)
      }

      if (!this.formData.targetValue || this.formData.targetValue < 1) {
        this.errors.push(this.$strings.ErrorGoalTargetRequired)
      }

      if (!this.formData.startDate) {
        this.errors.push(this.$strings.ErrorStartDateRequired)
      }

      if (!this.formData.endDate) {
        this.errors.push(this.$strings.ErrorEndDateRequired)
      }

      if (this.formData.startDate && this.formData.endDate) {
        const start = new Date(this.formData.startDate)
        const end = new Date(this.formData.endDate)
        if (start >= end) {
          this.errors.push(this.$strings.ErrorEndDateAfterStart)
        }
      }

      if (this.formData.type === 'genres' && this.selectedGenres.length === 0) {
        this.errors.push(this.$strings.ErrorSelectAtLeastOneGenre)
      }

      return this.errors.length === 0
    },

    async save() {
      if (!this.validate()) return

      this.isSaving = true

      try {
        const goalData = { ...this.formData }

        // Handle genre-specific data
        if (goalData.type === 'genres') {
          goalData.extraData = {
            ...goalData.extraData,
            targetGenres: [...this.selectedGenres]
          }
        }

        this.$emit('save', goalData)
      } catch (error) {
        console.error('Error saving goal:', error)
        this.errors.push(this.$strings.ErrorSavingGoal)
      } finally {
        this.isSaving = false
      }
    },

    close() {
      this.show = false
      this.$emit('close')
    }
  }
}
</script>
