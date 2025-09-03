<template>
  <div class="achievement-badge" 
       :class="[rarityClass, { 'achievement-unlocked': achievement.isUnlocked, 'achievement-secret': achievement.isSecret && !achievement.isUnlocked }]"
       @click="showDetails"
       :title="achievement.name">
    <div class="badge-icon">
      <i class="material-icons">{{ achievement.badgeIcon || 'emoji_events' }}</i>
    </div>
    <div class="badge-info" v-if="showInfo">
      <div class="badge-name">{{ achievement.name }}</div>
      <div v-if="achievement.isUnlocked" class="badge-date">
        {{ formatDate(achievement.unlockedAt) }}
      </div>
      <div v-else-if="!achievement.isSecret" class="badge-progress">
        {{ Math.round(achievement.progressPercent) }}%
      </div>
      <div v-else class="badge-secret">???</div>
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
    showInfo: {
      type: Boolean,
      default: true
    }
  },
  computed: {
    rarityClass() {
      return `rarity-${this.achievement.rarity || 'common'}`;
    }
  },
  methods: {
    showDetails() {
      this.$emit('show-details', this.achievement);
    },
    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString();
    }
  }
}
</script>

<style scoped>
.achievement-badge {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #34495e;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
  width: 100px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin: 5px;
  box-sizing: border-box;
}

.achievement-badge:hover {
  transform: translateY(-5px);
}

.badge-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #3498db;
  margin-bottom: 10px;
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
}

.badge-icon i {
  font-size: 30px;
  color: white;
}

.badge-info {
  text-align: center;
  width: 100%;
}

.badge-name {
  font-size: 12px;
  font-weight: 500;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
}

.badge-date, .badge-progress, .badge-secret {
  font-size: 10px;
  color: #a4b0be;
}

/* Secret Achievement */
.achievement-secret {
  background-color: #2c3e50;
}

.achievement-secret .badge-icon {
  background-color: #7f8c8d;
  box-shadow: none;
}

.achievement-secret .badge-name {
  color: #7f8c8d;
}

.achievement-secret .badge-icon i {
  opacity: 0.6;
}

/* Unlocked Achievement */
.achievement-unlocked {
  position: relative;
}

.achievement-unlocked:before {
  content: '';
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #2ecc71;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 1;
}

.achievement-unlocked:after {
  content: '✓';
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  z-index: 2;
}

/* Rarity Styles */
.rarity-common .badge-icon {
  background-color: #78909c;
  box-shadow: 0 0 10px rgba(120, 144, 156, 0.5);
}

.rarity-uncommon .badge-icon {
  background-color: #4caf50;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.rarity-rare .badge-icon {
  background-color: #2196f3;
  box-shadow: 0 0 10px rgba(33, 150, 243, 0.5);
}

.rarity-epic .badge-icon {
  background-color: #9c27b0;
  box-shadow: 0 0 10px rgba(156, 39, 176, 0.5);
}

.rarity-legendary .badge-icon {
  background-color: #ff9800;
  box-shadow: 0 0 12px rgba(255, 152, 0, 0.6);
}

.rarity-legendary.achievement-unlocked .badge-icon {
  animation: legendary-pulse 2s infinite alternate;
}

@keyframes legendary-pulse {
  from { box-shadow: 0 0 10px rgba(255, 152, 0, 0.6); }
  to { box-shadow: 0 0 20px rgba(255, 152, 0, 0.8); }
}
</style>
