<template>
  <div>
    <div v-if="narrators?.length" class="flex py-0.5 mt-4">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelNarrators }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden text-ellipsis">
        <template v-for="(narrator, index) in narrators">
          <nuxt-link :key="narrator" :to="`/library/${libraryId}/bookshelf?filter=narrators.${$encode(narrator)}`" class="hover:underline">{{ narrator }}</nuxt-link
          ><span :key="index" v-if="index < narrators.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div v-if="publishedYear" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelPublishYear }}</span>
      </div>
      <div>
        {{ publishedYear }}
      </div>
    </div>
    <div v-if="publisher" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelPublisher }}</span>
      </div>
      <div>
        <nuxt-link :to="`/library/${libraryId}/bookshelf?filter=publishers.${$encode(publisher)}`" class="hover:underline">{{ publisher }}</nuxt-link>
      </div>
    </div>
    <div v-if="podcastType" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelPodcastType }}</span>
      </div>
      <div class="capitalize">
        {{ podcastType }}
      </div>
    </div>
    <div class="flex py-0.5" v-if="genres.length">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelGenres }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden text-ellipsis">
        <template v-for="(genre, index) in genres">
          <nuxt-link :key="genre" :to="`/library/${libraryId}/bookshelf?filter=genres.${$encode(genre)}`" class="hover:underline">{{ genre }}</nuxt-link
          ><span :key="index" v-if="index < genres.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div class="flex py-0.5" v-if="tags.length">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelTags }}</span>
      </div>
      <div class="max-w-[calc(100vw-10rem)] overflow-hidden text-ellipsis">
        <template v-for="(tag, index) in tags">
          <nuxt-link :key="tag" :to="`/library/${libraryId}/bookshelf?filter=tags.${$encode(tag)}`" class="hover:underline">{{ tag }}</nuxt-link
          ><span :key="index" v-if="index < tags.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>
    <div v-if="language" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelLanguage }}</span>
      </div>
      <div>
        <nuxt-link :to="`/library/${libraryId}/bookshelf?filter=languages.${$encode(language)}`" class="hover:underline">{{ language }}</nuxt-link>
      </div>
    </div>
    <div v-if="tracks.length || (isPodcast && totalPodcastDuration)" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelDuration }}</span>
      </div>
      <div>
        {{ durationPretty }}
      </div>
    </div>
    <div role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelSize }}</span>
      </div>
      <div>
        {{ sizePretty }}
      </div>
    </div>

    <!-- Loading State for Upcoming Book -->
    <div v-if="isLoadingUpcoming && !isPodcast" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelUpcomingBook }}</span>
      </div>
      <div class="flex items-center space-x-2">
        <svg class="animate-spin h-4 w-4 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm text-white/60">Loading Upcoming Book...</span>
      </div>
    </div>

    <!-- Upcoming Book Section -->
    <div v-if="upcomingBook && !isPodcast && !isLoadingUpcoming" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelUpcomingBook }}</span>
      </div>
      <div class="flex items-center space-x-3 max-w-[calc(100vw-10rem)]">
        <!-- Cover Image -->
        <div v-if="upcomingBook.cover && !upcomingBook.coverError" class="flex-shrink-0">
          <img :src="upcomingBookCoverUrl" :alt="upcomingBook.title" class="w-12 h-16 object-cover rounded shadow-sm hover:shadow-md transition-shadow cursor-pointer" @click="showUpcomingCoverModal" @error="onUpcomingCoverError" />
        </div>

        <!-- Book Info -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-col">
            <!-- Title with link -->
            <div class="font-medium text-white/90 hover:text-white transition-colors">
              <a v-if="upcomingBook.link" :href="upcomingBook.link" target="_blank" rel="noopener noreferrer" class="hover:underline line-clamp-2" :title="upcomingBook.title">
                {{ upcomingBook.title }}
              </a>
              <span v-else class="line-clamp-2" :title="upcomingBook.title">
                {{ upcomingBook.title }}
              </span>
            </div>

            <!-- Release Date -->
            <div v-if="upcomingBook.release" class="text-sm text-white/60 mt-1">{{ $strings.LabelReleaseDate }}: {{ formatReleaseDate(upcomingBook.release) }}</div>

            <!-- Days until release -->
            <div v-if="daysUntilRelease !== null" class="text-xs mt-1" :class="releaseTimeClass">
              {{ releaseTimeText }}
            </div>
          </div>
        </div>

        <!-- Refresh Button -->
        <div class="flex-shrink-0">
          <button @click="refreshUpcomingBook" :disabled="isRefreshing" class="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50" :title="$strings.ButtonRefresh">
            <svg class="w-4 h-4 text-white/60" :class="{ 'animate-spin': isRefreshing }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="upcomingBookError && !isPodcast && !isLoadingUpcoming" role="paragraph" class="flex py-0.5">
      <div class="w-34 min-w-34 sm:w-34 sm:min-w-34 break-words">
        <span class="text-white/60 uppercase text-sm">{{ $strings.LabelUpcomingBook }}</span>
      </div>
      <div class="text-sm text-red-400">Failed to load Upcoming Book information</div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      upcomingBook: null,
      isLoadingUpcoming: false,
      isRefreshing: false,
      upcomingBookError: false,
      coverFallbackAttempted: false,
      cachedCoverBlobUrl: null
    }
  },
  computed: {
    libraryId() {
      return this.libraryItem.libraryId
    },
    isPodcast() {
      return this.libraryItem.mediaType === 'podcast'
    },
    media() {
      return this.libraryItem.media || {}
    },
    tracks() {
      return this.media.tracks || []
    },
    podcastEpisodes() {
      return this.media.episodes || []
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    publishedYear() {
      return this.mediaMetadata.publishedYear
    },
    genres() {
      return this.mediaMetadata.genres || []
    },
    tags() {
      return this.media.tags || []
    },
    podcastAuthor() {
      return this.mediaMetadata.author || ''
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    publisher() {
      return this.mediaMetadata.publisher || ''
    },
    narrators() {
      return this.mediaMetadata.narrators || []
    },
    language() {
      return this.mediaMetadata.language || null
    },
    durationPretty() {
      if (this.isPodcast) return this.$elapsedPrettyExtended(this.totalPodcastDuration)

      if (!this.tracks.length && !this.audioFile) return 'N/A'
      if (this.audioFile) return this.$elapsedPrettyExtended(this.duration)
      return this.$elapsedPretty(this.duration)
    },
    duration() {
      if (!this.tracks.length && !this.audioFile) return 0
      return this.media.duration
    },
    totalPodcastDuration() {
      if (!this.podcastEpisodes.length) return 0
      let totalDuration = 0
      this.podcastEpisodes.forEach((ep) => (totalDuration += ep.duration || 0))
      return totalDuration
    },
    sizePretty() {
      return this.$bytesPretty(this.media.size)
    },
    podcastType() {
      return this.mediaMetadata.type
    },
    upcomingBookCoverUrl() {
      // Return the blob URL if we have one, otherwise the fallback URL
      return this.cachedCoverBlobUrl || this.upcomingBook?.cover || null
    },
    daysUntilRelease() {
      if (!this.upcomingBook?.release) return null

      try {
        const releaseDate = new Date(this.upcomingBook.release)
        const today = new Date()
        const diffTime = releaseDate - today
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
      } catch {
        return null
      }
    },
    releaseTimeClass() {
      if (this.daysUntilRelease === null) return ''

      if (this.daysUntilRelease < 0) return 'text-red-400'
      if (this.daysUntilRelease <= 7) return 'text-yellow-400'
      if (this.daysUntilRelease <= 30) return 'text-blue-400'
      return 'text-white/60'
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
    async fetchUpcomingBook() {
      if (this.isPodcast || this.isLoadingUpcoming) return

      this.isLoadingUpcoming = true
      this.upcomingBookError = false
      this.coverFallbackAttempted = false

      try {
        console.log(`[LibraryItemDetails] Fetching Upcoming Book for item: ${this.libraryItem.id}`)
        const response = await this.$axios.$get(`/api/items/${this.libraryItem.id}/upcoming`)

        console.log('[LibraryItemDetails] Response received:', response)

        this.upcomingBook = response.book

        if (this.upcomingBook) {
          console.log(`[LibraryItemDetails] Found Upcoming Book: ${this.upcomingBook.title}`)
          console.log('[LibraryItemDetails] Book data:', this.upcomingBook)

          // Try to fetch cached cover with authentication
          await this.fetchCachedCover()
        } else {
          console.log('[LibraryItemDetails] No Upcoming Book found')
        }
      } catch (error) {
        console.error('[LibraryItemDetails] Failed to fetch Upcoming Book:', error)
        console.error('[LibraryItemDetails] Error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        })

        this.upcomingBookError = true
        this.upcomingBook = null

        // Show error toast if available and it's not a 404 (no Upcoming Book found)
        if (this.$toast && error.response?.status !== 404) {
          this.$toast.error('Failed to load Upcoming Book information')
        }
      } finally {
        this.isLoadingUpcoming = false
      }
    },

    async fetchCachedCover() {
      // Clean up previous blob URL
      if (this.cachedCoverBlobUrl) {
        URL.revokeObjectURL(this.cachedCoverBlobUrl)
        this.cachedCoverBlobUrl = null
      }

      try {
        const series = this.mediaMetadata.series?.[0] || this.mediaMetadata.series
        const author = this.mediaMetadata.authors?.[0] || this.mediaMetadata.authors

        if (series?.name && author?.name) {
          const seriesName = encodeURIComponent(series.name)
          const authorName = encodeURIComponent(author.name)
          const cachedUrl = `/api/upcoming/cover/${seriesName}/${authorName}`

          console.log(`[LibraryItemDetails] Fetching cached cover: ${cachedUrl}`)

          // Use axios to get the image with authentication
          const response = await this.$axios.get(cachedUrl, {
            responseType: 'blob'
          })

          // Create blob URL for the image
          this.cachedCoverBlobUrl = URL.createObjectURL(response.data)
          console.log(`[LibraryItemDetails] Created blob URL for cached cover`)
        }
      } catch (error) {
        console.log(`[LibraryItemDetails] Failed to fetch cached cover, will use original:`, error)
        // Will fall back to original cover URL automatically
      }
    },

    async refreshUpcomingBook() {
      if (this.isRefreshing) return

      this.isRefreshing = true

      try {
        // Extract series and author info for refresh API
        const series = this.mediaMetadata.series?.[0] || this.mediaMetadata.series
        const author = this.mediaMetadata.authors?.[0] || this.mediaMetadata.authors

        console.log('[LibraryItemDetails] Series info for refresh:', { series, author })

        if (series?.name && author?.name) {
          console.log(`[LibraryItemDetails] Refreshing Upcoming Book for: ${series.name} by ${author.name}`)

          await this.$axios.$post('/api/upcoming/refresh', {
            seriesName: series.name,
            authorName: author.name
          })

          // Reset fallback flag and refetch the updated data
          this.coverFallbackAttempted = false
          await this.fetchUpcomingBook()

          if (this.$toast) {
            this.$toast.success('Upcoming book data refreshed')
          }
        } else {
          console.warn('[LibraryItemDetails] Cannot refresh - missing series or author info')
          console.warn('[LibraryItemDetails] Available metadata:', this.mediaMetadata)

          if (this.$toast) {
            this.$toast.error('Cannot refresh - missing series or author information')
          }
        }
      } catch (error) {
        console.error('[LibraryItemDetails] Failed to refresh Upcoming Book:', error)
        if (this.$toast) {
          this.$toast.error('Failed to refresh Upcoming Book')
        }
      } finally {
        this.isRefreshing = false
      }
    },

    formatReleaseDate(dateString) {
      if (!dateString) return ''

      try {
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }).format(date)
      } catch {
        return dateString
      }
    },

    openUpcomingBookLink() {
      if (this.upcomingBook?.link) {
        window.open(this.upcomingBook.link, '_blank', 'noopener,noreferrer')
      }
    },

    showUpcomingCoverModal() {
      console.log('[LibraryItemDetails] Opening upcoming cover modal')

      // Extract series and author for the refresh functionality
      const series = this.mediaMetadata.series?.[0] || this.mediaMetadata.series
      const author = this.mediaMetadata.authors?.[0] || this.mediaMetadata.authors

      // Use the same pattern as setRawCoverPreviewModal
      this.$store.commit('globals/setUpcomingCoverPreviewModal', {
        coverUrl: this.upcomingBookCoverUrl,
        bookData: {
          ...this.upcomingBook,
          seriesName: series?.name || '',
          authorName: author?.name || ''
        }
      })
    },

    onUpcomingCoverError() {
      console.log('[LibraryItemDetails] Cover image failed to load, attempting fallback')

      // If we haven't tried the fallback yet, try the original URL
      if (!this.coverFallbackAttempted && this.upcomingBook) {
        this.coverFallbackAttempted = true

        // Force a re-render by updating a reactive property
        this.$forceUpdate()

        console.log('[LibraryItemDetails] Falling back to original cover URL')
      } else {
        // Both cached and original failed, hide the image
        console.log('[LibraryItemDetails] Both cover sources failed, hiding image')
        if (this.upcomingBook) {
          this.$set(this.upcomingBook, 'coverError', true)
        }
      }
    }
  },
  mounted() {
    // Fetch Upcoming Book data when component mounts
    console.log('[LibraryItemDetails] Component mounted, checking if should fetch Upcoming Book')
    console.log('[LibraryItemDetails] Library item:', this.libraryItem)
    console.log('[LibraryItemDetails] Is podcast:', this.isPodcast)
    console.log('[LibraryItemDetails] Media metadata:', this.mediaMetadata)

    this.fetchUpcomingBook()
  },
  watch: {
    // Refetch if library item changes
    'libraryItem.id'() {
      console.log('[LibraryItemDetails] Library item changed, refetching Upcoming Book')
      this.upcomingBook = null
      this.coverFallbackAttempted = false

      // Clean up blob URL
      if (this.cachedCoverBlobUrl) {
        URL.revokeObjectURL(this.cachedCoverBlobUrl)
        this.cachedCoverBlobUrl = null
      }

      this.fetchUpcomingBook()
    }
  },

  beforeDestroy() {
    // Clean up blob URL when component is destroyed
    if (this.cachedCoverBlobUrl) {
      URL.revokeObjectURL(this.cachedCoverBlobUrl)
    }
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
