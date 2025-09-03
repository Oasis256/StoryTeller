<template>
  <transition name="slide-up">
    <div v-if="visible" class="achievement-notification" :class="rarityClass">
      <div class="achievement-icon">
        <div class="badge-container">
          <i class="material-icons">{{ achievement.badgeIcon || 'emoji_events' }}</i>
        </div>
        <div class="confetti" v-for="i in 10" :key="i"></div>
      </div>
      <div class="achievement-content">
        <div class="achievement-header">
          <h4>{{ $t('LabelAchievementNotification') }}</h4>
          <div class="xp-badge" v-if="achievement.xpEarned">
            +{{ achievement.xpEarned }} XP
          </div>
        </div>
        <h3>{{ achievement.name }}</h3>
        <p>{{ achievement.unlockMessage || achievement.description }}</p>
      </div>
      <button class="close-btn" @click="acknowledge">
        <i class="material-icons">close</i>
      </button>
    </div>
  </transition>
</template>

<script>
export default {
  props: {
    achievement: {
      type: Object,
      required: true
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    rarityClass() {
      return `rarity-${this.achievement.rarity || 'common'}`;
    }
  },
  methods: {
    acknowledge() {
      // Send request to mark achievement as acknowledged
      this.$axios.$post(`/api/achievements/acknowledge/${this.achievement.id}`)
        .catch(error => {
          console.error('Failed to acknowledge achievement:', error);
        });
      
      this.$emit('close');
    }
  },
  mounted() {
    // Auto-dismiss after 10 seconds
    if (this.visible) {
      setTimeout(() => {
        this.$emit('close');
      }, 10000);
    }
  }
}
</script>

<style scoped>
.achievement-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #2c3e50;
  border-radius: 8px;
  box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  width: 360px;
  padding: 12px;
  z-index: 1000;
  align-items: center;
  border: 2px solid #3498db;
  animation: glow 2s infinite alternate;
}

.achievement-icon {
  position: relative;
  margin-right: 15px;
}

.badge-container {
  background-color: #3498db;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
}

.badge-container i {
  color: white;
  font-size: 28px;
}

.achievement-content {
  flex: 1;
}

.achievement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.achievement-header h4 {
  color: #3498db;
  margin: 0;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

h3 {
  margin: 0 0 5px;
  color: white;
  font-size: 18px;
}

p {
  margin: 0;
  color: #a4b0be;
  font-size: 14px;
}

.close-btn {
  background: transparent;
  border: none;
  color: #a4b0be;
  cursor: pointer;
  margin-left: 10px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn i {
  font-size: 18px;
}

.close-btn:hover {
  color: white;
}

.xp-badge {
  background-color: #4caf50;
  color: white;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

/* Rarity styles */
.rarity-common {
  border-color: #78909c;
  animation: glow-common 2s infinite alternate;
}
.rarity-common .badge-container {
  background-color: #78909c;
  box-shadow: 0 0 10px rgba(120, 144, 156, 0.5);
}
.rarity-common .achievement-header h4 {
  color: #78909c;
}

.rarity-uncommon {
  border-color: #4caf50;
  animation: glow-uncommon 2s infinite alternate;
}
.rarity-uncommon .badge-container {
  background-color: #4caf50;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}
.rarity-uncommon .achievement-header h4 {
  color: #4caf50;
}

.rarity-rare {
  border-color: #2196f3;
  animation: glow-rare 2s infinite alternate;
}
.rarity-rare .badge-container {
  background-color: #2196f3;
  box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
}
.rarity-rare .achievement-header h4 {
  color: #2196f3;
}

.rarity-epic {
  border-color: #9c27b0;
  animation: glow-epic 2s infinite alternate;
}
.rarity-epic .badge-container {
  background-color: #9c27b0;
  box-shadow: 0 0 10px rgba(156, 39, 176, 0.5);
}
.rarity-epic .achievement-header h4 {
  color: #9c27b0;
}

.rarity-legendary {
  border-color: #ff9800;
  animation: glow-legendary 2s infinite alternate;
}
.rarity-legendary .badge-container {
  background-color: #ff9800;
  box-shadow: 0 0 10px rgba(255, 152, 0, 0.5);
}
.rarity-legendary .achievement-header h4 {
  color: #ff9800;
}

/* Animations */
@keyframes glow-common {
  from { box-shadow: 0 0 5px rgba(120, 144, 156, 0.5); }
  to { box-shadow: 0 0 15px rgba(120, 144, 156, 0.8); }
}
@keyframes glow-uncommon {
  from { box-shadow: 0 0 5px rgba(76, 175, 80, 0.5); }
  to { box-shadow: 0 0 15px rgba(76, 175, 80, 0.8); }
}
@keyframes glow-rare {
  from { box-shadow: 0 0 5px rgba(33, 150, 243, 0.5); }
  to { box-shadow: 0 0 15px rgba(33, 150, 243, 0.8); }
}
@keyframes glow-epic {
  from { box-shadow: 0 0 5px rgba(156, 39, 176, 0.5); }
  to { box-shadow: 0 0 20px rgba(156, 39, 176, 0.8); }
}
@keyframes glow-legendary {
  from { box-shadow: 0 0 10px rgba(255, 152, 0, 0.5); }
  to { box-shadow: 0 0 25px rgba(255, 152, 0, 0.8); }
}

/* Confetti animation */
.confetti {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: #fff;
  opacity: 0;
  top: 0;
  left: 0;
}

.confetti:nth-child(1) {
  background-color: #f44336;
  animation: confetti-1 1.5s ease-in-out forwards;
}
.confetti:nth-child(2) {
  background-color: #2196f3;
  animation: confetti-2 1.5s ease-in-out forwards;
}
.confetti:nth-child(3) {
  background-color: #4caf50;
  animation: confetti-3 1.5s ease-in-out forwards;
}
.confetti:nth-child(4) {
  background-color: #ffeb3b;
  animation: confetti-4 1.5s ease-in-out forwards;
}
.confetti:nth-child(5) {
  background-color: #9c27b0;
  animation: confetti-5 1.5s ease-in-out forwards;
}
.confetti:nth-child(6) {
  background-color: #ff9800;
  animation: confetti-6 1.5s ease-in-out forwards;
}
.confetti:nth-child(7) {
  background-color: #3f51b5;
  animation: confetti-7 1.5s ease-in-out forwards;
}
.confetti:nth-child(8) {
  background-color: #e91e63;
  animation: confetti-8 1.5s ease-in-out forwards;
}
.confetti:nth-child(9) {
  background-color: #00bcd4;
  animation: confetti-9 1.5s ease-in-out forwards;
}
.confetti:nth-child(10) {
  background-color: #8bc34a;
  animation: confetti-10 1.5s ease-in-out forwards;
}

@keyframes confetti-1 {
  0% { transform: translate(-10px, -10px) rotate(0deg); opacity: 1; }
  100% { transform: translate(-20px, 40px) rotate(360deg); opacity: 0; }
}
@keyframes confetti-2 {
  0% { transform: translate(10px, -5px) rotate(0deg); opacity: 1; }
  100% { transform: translate(30px, 30px) rotate(-180deg); opacity: 0; }
}
@keyframes confetti-3 {
  0% { transform: translate(0, -15px) rotate(0deg); opacity: 1; }
  100% { transform: translate(-10px, 30px) rotate(180deg); opacity: 0; }
}
@keyframes confetti-4 {
  0% { transform: translate(-5px, -5px) rotate(0deg); opacity: 1; }
  100% { transform: translate(-20px, 20px) rotate(-90deg); opacity: 0; }
}
@keyframes confetti-5 {
  0% { transform: translate(5px, -10px) rotate(0deg); opacity: 1; }
  100% { transform: translate(20px, 40px) rotate(90deg); opacity: 0; }
}
@keyframes confetti-6 {
  0% { transform: translate(0px, 0px) rotate(0deg); opacity: 1; }
  100% { transform: translate(30px, 30px) rotate(-270deg); opacity: 0; }
}
@keyframes confetti-7 {
  0% { transform: translate(-10px, 0px) rotate(0deg); opacity: 1; }
  100% { transform: translate(-30px, 40px) rotate(270deg); opacity: 0; }
}
@keyframes confetti-8 {
  0% { transform: translate(10px, 0px) rotate(0deg); opacity: 1; }
  100% { transform: translate(20px, 25px) rotate(-45deg); opacity: 0; }
}
@keyframes confetti-9 {
  0% { transform: translate(-5px, -15px) rotate(0deg); opacity: 1; }
  100% { transform: translate(-15px, 35px) rotate(45deg); opacity: 0; }
}
@keyframes confetti-10 {
  0% { transform: translate(5px, -5px) rotate(0deg); opacity: 1; }
  100% { transform: translate(15px, 35px) rotate(-135deg); opacity: 0; }
}

/* Transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.5s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100px);
  opacity: 0;
}
</style>
