<template>
  <modals-modal v-model="show" name="achievement-unlocked" :width="500" :height="400">
    <template #outer>
      <div class="absolute top-0 left-0 right-0 bottom-0 w-full h-full overflow-hidden bg-black bg-opacity-75 text-white">
        <div class="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
          <div class="bg-bg p-8 rounded-lg border border-yellow-400 max-w-md w-full mx-4 relative overflow-hidden">
            <!-- Background Animation -->
            <div class="absolute inset-0 opacity-20">
              <div class="absolute inset-0 bg-gradient-to-br from-yellow-400 via-transparent to-yellow-600 animate-pulse"></div>
            </div>

            <!-- Confetti Animation -->
            <div class="absolute inset-0 pointer-events-none">
              <div class="confetti-piece confetti-1"></div>
              <div class="confetti-piece confetti-2"></div>
              <div class="confetti-piece confetti-3"></div>
              <div class="confetti-piece confetti-4"></div>
              <div class="confetti-piece confetti-5"></div>
              <div class="confetti-piece confetti-6"></div>
            </div>

            <!-- Content -->
            <div class="relative z-10 text-center">
              <!-- Header -->
              <div class="mb-6">
                <div class="text-6xl mb-2 animate-bounce">🎉</div>
                <h2 class="text-2xl font-bold text-yellow-400 mb-2">Achievement Unlocked!</h2>
                <p class="text-gray-300">Congratulations on your progress!</p>
              </div>

              <!-- Achievement Display -->
              <div v-if="achievement" class="mb-6">
                <!-- Badge -->
                <div class="flex justify-center mb-4">
                  <div class="w-20 h-20 rounded-full flex items-center justify-center text-3xl animate-pulse" :style="badgeStyle">
                    <span class="material-symbols text-white text-3xl">
                      {{ achievement.achievement?.badgeIcon || 'emoji_events' }}
                    </span>
                  </div>
                </div>

                <!-- Achievement Info -->
                <h3 class="text-xl font-semibold text-white mb-2">
                  {{ achievement.achievement?.name }}
                </h3>
                <p class="text-gray-300 text-sm mb-4">
                  {{ achievement.achievement?.description }}
                </p>

                <!-- Progress -->
                <div class="bg-gray-700 rounded-lg p-3 mb-4">
                  <div class="text-sm text-gray-400 mb-1">Target Achieved</div>
                  <div class="text-lg font-semibold text-yellow-400">{{ achievement.progress }} / {{ achievement.achievement?.targetValue }} {{ achievement.achievement?.targetUnit }}</div>
                </div>

                <!-- Category Badge -->
                <div class="inline-block px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-300 capitalize">
                  {{ achievement.achievement?.category }}
                </div>
              </div>

              <!-- Actions -->
              <div class="flex space-x-3">
                <ui-btn color="primary" class="flex-1" @click="shareAchievement" v-if="achievement">
                  <template #icon>
                    <span class="material-symbols text-sm">share</span>
                  </template>
                  Share
                </ui-btn>
                <ui-btn color="secondary" class="flex-1" @click="close"> Continue </ui-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    achievement: {
      type: Object,
      default: null
    }
  },

  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },

    badgeStyle() {
      if (this.achievement?.achievement) {
        return {
          backgroundColor: this.achievement.achievement.badgeColor || '#fbbf24',
          boxShadow: `0 0 30px ${this.achievement.achievement.badgeColor || '#fbbf24'}60`
        }
      }
      return {
        backgroundColor: '#fbbf24'
      }
    }
  },

  watch: {
    value(newVal) {
      if (newVal) {
        this.playUnlockSound()
        this.startConfetti()
      }
    }
  },

  methods: {
    close() {
      this.show = false
    },

    playUnlockSound() {
      // Play achievement unlock sound if available
      try {
        const audio = new Audio('/achievement-unlock.mp3')
        audio.volume = 0.3
        audio.play().catch(() => {
          // Ignore audio errors
        })
      } catch (error) {
        // Ignore audio errors
      }
    },

    startConfetti() {
      // Confetti animation is handled by CSS
      setTimeout(() => {
        // Reset confetti after animation
      }, 3000)
    },

    async shareAchievement() {
      if (!this.achievement?.achievement) return

      const text = `🎉 I just unlocked the "${this.achievement.achievement.name}" achievement! ${this.achievement.achievement.description}`

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Achievement Unlocked!',
            text: text,
            url: window.location.origin
          })
        } catch (error) {
          this.fallbackShare(text)
        }
      } else {
        this.fallbackShare(text)
      }
    },

    fallbackShare(text) {
      // Copy to clipboard as fallback
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            this.$toast.success('Achievement text copied to clipboard!')
          })
          .catch(() => {
            this.$toast.error('Failed to copy achievement text')
          })
      } else {
        this.$toast.info('Share this achievement: ' + text)
      }
    }
  }
}
</script>

<style scoped>
.confetti-piece {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fbbf24;
  animation: confetti-fall 3s ease-out infinite;
}

.confetti-1 {
  left: 10%;
  animation-delay: 0s;
  background: #ef4444;
}

.confetti-2 {
  left: 20%;
  animation-delay: 0.5s;
  background: #3b82f6;
}

.confetti-3 {
  left: 30%;
  animation-delay: 1s;
  background: #10b981;
}

.confetti-4 {
  left: 70%;
  animation-delay: 0.2s;
  background: #8b5cf6;
}

.confetti-5 {
  left: 80%;
  animation-delay: 0.8s;
  background: #f59e0b;
}

.confetti-6 {
  left: 90%;
  animation-delay: 1.2s;
  background: #ec4899;
}

@keyframes confetti-fall {
  0% {
    transform: translateY(-100px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(400px) rotate(720deg);
    opacity: 0;
  }
}

/* Additional animations */
@keyframes glow {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.6);
  }
  50% {
    box-shadow: 0 0 30px rgba(251, 191, 36, 0.8);
  }
}

.animate-glow {
  animation: glow 2s ease-in-out infinite;
}
</style>
