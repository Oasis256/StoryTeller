<template>
  <div class="user-level-container">
    <div class="level-info">
      <div class="level-badge">
        <span class="level-number">{{ levelInfo.level }}</span>
      </div>
      <div class="level-details">
        <h3>Level {{ levelInfo.level }}</h3>
        <div v-if="levelInfo.reward" class="level-reward">
          <i class="material-icons">{{ rewardIcon }}</i>
          <span>{{ levelInfo.reward.name }} Unlocked!</span>
        </div>
      </div>
    </div>
    
    <div class="xp-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${levelInfo.percentToNextLevel}%` }"></div>
      </div>
      <div class="progress-stats">
        <span>{{ levelInfo.xpProgressToNextLevel }} / {{ levelInfo.xpForNextLevel - levelInfo.xpForCurrentLevel }} XP</span>
        <span>{{ levelInfo.percentToNextLevel }}% to Level {{ levelInfo.level + 1 }}</span>
      </div>
    </div>
    
    <div class="total-xp">
      <i class="material-icons">star</i>
      <span>{{ levelInfo.totalXP }} Total XP</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    levelInfo: {
      type: Object,
      required: true
    }
  },
  computed: {
    rewardIcon() {
      if (!this.levelInfo.reward) return 'star';
      
      switch(this.levelInfo.reward.type) {
        case 'badge':
          return 'emoji_events';
        case 'feature':
          return 'lock_open';
        default:
          return 'card_giftcard';
      }
    }
  }
}
</script>

<style scoped>
.user-level-container {
  background-color: #2c3e50;
  border-radius: 10px;
  padding: 20px;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.level-info {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.level-badge {
  background: linear-gradient(135deg, #3498db, #9b59b6);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  box-shadow: 0 0 15px rgba(52, 152, 219, 0.5);
}

.level-number {
  font-size: 28px;
  font-weight: 700;
}

.level-details {
  flex: 1;
}

.level-details h3 {
  margin: 0 0 5px;
  font-size: 20px;
}

.level-reward {
  display: flex;
  align-items: center;
  color: #f39c12;
  font-size: 14px;
}

.level-reward i {
  font-size: 16px;
  margin-right: 5px;
}

.xp-progress {
  margin-bottom: 15px;
}

.progress-bar {
  height: 8px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 5px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(to right, #3498db, #9b59b6);
  border-radius: 4px;
  transition: width 0.5s ease-out;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #a4b0be;
}

.total-xp {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  color: #f1c40f;
}

.total-xp i {
  margin-right: 5px;
  font-size: 18px;
}

/* For animated XP gaining effect */
@keyframes xp-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.xp-gain {
  animation: xp-pulse 0.5s ease;
}
</style>
