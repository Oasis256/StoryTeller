<template>
  <modals-modal v-model="show" name="upcoming-cover" :width="'unset'" :height="'90%'" :contentMarginTop="0">
    <div class="w-full h-full relative" @click="show = false">
      <!-- Cover Image -->
      <img loading="lazy" :src="upcomingCoverUrl" :alt="upcomingBookData.title" class="w-full h-full z-10 object-scale-down" @click.stop />

      <!-- Book Info Overlay -->
      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6 z-20" @click.stop>
        <div class="max-w-4xl mx-auto">
          <h3 class="text-xl font-semibold text-white mb-3">{{ upcomingBookData.title }}</h3>

          <div class="flex flex-col space-y-2 text-sm">
            <div v-if="upcomingBookData.release" class="text-gray-300">
              <span class="font-medium">{{ $strings.LabelReleaseDate }}:</span>
              {{ formatReleaseDate(upcomingBookData.release) }}
            </div>

            <div v-if="daysUntilRelease !== null" class="text-sm font-medium" :class="releaseTimeClass">
              {{ releaseTimeText }}
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-3 mt-4">
              <!-- View on RisingShadow button -->
              <button v-if="upcomingBookData.link" @click="openUpcomingBookLink" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>{{ $strings.ButtonViewDetails }}</span>
              </button>

              <!-- Refresh Data button -->
              <button @click="refreshUpcomingData" :disabled="isRefreshing" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center space-x-2">
                <svg class="w-4 h-4" :class="{ 'animate-spin': isRefreshing }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{{ $strings.ButtonRefresh }}</span>
              </button>

              <!-- Close button -->
              <!-- <button @click="show = false" class="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg transition-colors flex items-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{{ $strings.ButtonClose }}</span>
              </button> -->
            </div>
          </div>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      isRefreshing: false
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showUpcomingCoverPreviewModal
      },
      set(val) {
        this.$store.commit('globals/setShowUpcomingCoverPreviewModal', val)
      }
    },
    upcomingCoverUrl() {
      return this.$store.state.globals.selectedUpcomingCoverUrl
    },
    upcomingBookData() {
      return this.$store.state.globals.selectedUpcomingBookData || {}
    },
    daysUntilRelease() {
      if (!this.upcomingBookData.release) return null

      try {
        const releaseDate = new Date(this.upcomingBookData.release)
        const today = new Date()
        const diffTime = releaseDate - today
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
      } catch {
        return null
      }
    },
    releaseTimeClass() {
      if (this.daysUntilRelease === null) return 'text-gray-300'

      if (this.daysUntilRelease < 0) return 'text-red-400' // Already released
      if (this.daysUntilRelease <= 30) return 'text-green-400' // Within a month - all green
      if (this.daysUntilRelease <= 60) return 'text-blue-400' // Within two months
      if (this.daysUntilRelease <= 90) return 'text-indigo-400' // Within three months
      if (this.daysUntilRelease <= 180) return 'text-purple-400' // Within six months
      return 'text-pink-400' // More than 6 months
    },
    releaseTimeText() {
      if (this.daysUntilRelease === null) return ''

      if (this.daysUntilRelease < 0) {
        const daysPast = Math.abs(this.daysUntilRelease)
        return `Released ${daysPast} day${daysPast === 1 ? '' : 's'} ago`
      }

      if (this.daysUntilRelease === 0) return 'Releases today!'
      if (this.daysUntilRelease === 1) return 'Releases tomorrow'
      if (this.daysUntilRelease <= 7) return `Releases in ${this.daysUntilRelease} days`
      if (this.daysUntilRelease <= 30) return `Releases in ${this.daysUntilRelease} days`

      return `Releases in ${this.daysUntilRelease} days`
    }
  },
  methods: {
    formatReleaseDate(dateString) {
      if (!dateString) return ''

      try {
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(date)
      } catch {
        return dateString
      }
    },

    openUpcomingBookLink() {
      if (this.upcomingBookData.link) {
        window.open(this.upcomingBookData.link, '_blank', 'noopener,noreferrer')
      }
    },

    async refreshUpcomingData() {
      if (this.isRefreshing || !this.upcomingBookData.seriesName || !this.upcomingBookData.authorName) return

      this.isRefreshing = true

      try {
        const response = await this.$axios.$post('/api/upcoming/refresh', {
          seriesName: this.upcomingBookData.seriesName,
          authorName: this.upcomingBookData.authorName
        })

        if (response.success && response.book) {
          // Update the store with new data
          this.$store.commit('globals/setSelectedUpcomingBookData', {
            ...this.upcomingBookData,
            ...response.book
          })

          this.$toast.success('Upcoming book data refreshed successfully')
        } else {
          this.$toast.info('No Upcoming Book data found')
        }
      } catch (error) {
        console.error('[UpcomingCoverPreviewModal] Failed to refresh:', error)
        this.$toast.error('Failed to refresh Upcoming Book data')
      } finally {
        this.isRefreshing = false
      }
    }
  }
}
</script>

<style scoped>
/* Line clamp for title */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Compact gradient overlay */
.bg-gradient-to-t {
  background: linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.7) 80%, transparent 100%);
}

/* Ensure the container matches the image size exactly */
.relative.inline-block {
  display: inline-block;
  line-height: 0; /* Remove any line-height issues */
}

/* Make sure overlay doesn't extend beyond image */
.absolute {
  max-width: 100%;
  box-sizing: border-box;
}

/* Button consistency */
button {
  min-width: 0;
  flex-shrink: 0;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .flex.gap-2 {
    gap: 1px;
  }

  .text-xs {
    font-size: 0.625rem;
  }

  .px-2 {
    padding-left: 0.375rem;
    padding-right: 0.375rem;
  }
}
</style>
