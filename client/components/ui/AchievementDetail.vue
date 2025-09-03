<template>
  <div class="achievement-detail" :class="rarityClass">
    <div class="achievement-header">
      <div class="badge-container">
        <i class="material-icons">{{ achievement.badgeIcon || 'emoji_events' }}</i>
      </div>
      <div class="header-content">
        <h2>{{ achievement.name }}</h2>
        <div class="achievement-meta">
          <div class="rarity-badge">{{ capitalizeFirstLetter(achievement.rarity || 'Common') }}</div>
          <div class="xp-badge" v-if="achievement.xpValue || achievement.xpEarned">
            {{ achievement.xpValue || achievement.xpEarned || 10 }} XP
          </div>
          <div class="date-earned" v-if="achievement.isUnlocked">
            {{ formatDate(achievement.unlockedAt) }}
          </div>
        </div>
      </div>
    </div>
    
    <div class="achievement-body">
      <p class="achievement-description">{{ achievement.description }}</p>
      
      <div class="achievement-message" v-if="achievement.isUnlocked && achievement.unlockMessage">
        <i class="material-icons">format_quote</i>
        <p>{{ achievement.unlockMessage }}</p>
      </div>
      
      <div class="achievement-progress" v-if="!achievement.isUnlocked && !achievement.isSecret">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${achievement.progressPercent || 0}%` }"></div>
        </div>
        <div class="progress-text">
          {{ achievement.userProgress || 0 }} / {{ achievement.targetValue }} ({{ Math.round(achievement.progressPercent || 0) }}%)
        </div>
      </div>
      
      <div class="achievement-secret-hint" v-if="!achievement.isUnlocked && achievement.isSecret">
        <i class="material-icons">lock</i>
        <p>{{ $t('TextAchievementSecretHint') }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    achievement: {
      type: Object,
      required: true
    }
  },
  computed: {
    rarityClass() {
      return `rarity-${this.achievement.rarity || 'common'}`;
    }
  },
  methods: {
    capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    },
    formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  }
}
</script>

<style scoped>
.achievement-detail {
  background-color: #2c3e50;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  margin-bottom: 20px;
  border-left: 5px solid #78909c;
}

.achievement-header {
  background-color: #34495e;
  padding: 20px;
  display: flex;
  align-items: center;
}

.badge-container {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background-color: #78909c;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  box-shadow: 0 0 15px rgba(120, 144, 156, 0.5);
}

.badge-container i {
  font-size: 40px;
  color: white;
}

.header-content {
  flex: 1;
}

h2 {
  margin: 0 0 10px 0;
  color: white;
  font-size: 24px;
}

.achievement-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.rarity-badge,
.xp-badge,
.date-earned {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.rarity-badge {
  background-color: #78909c;
  color: white;
}

.xp-badge {
  background-color: #4caf50;
  color: white;
}

.date-earned {
  background-color: rgba(255, 255, 255, 0.1);
  color: #a4b0be;
}

.achievement-body {
  padding: 20px;
}

.achievement-description {
  color: white;
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 16px;
  line-height: 1.5;
}

.achievement-message {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  position: relative;
}

.achievement-message i {
  position: absolute;
  left: 10px;
  top: 10px;
  color: rgba(255, 255, 255, 0.2);
  font-size: 24px;
}

.achievement-message p {
  margin: 0;
  color: #a4b0be;
  padding-left: 20px;
  font-style: italic;
}

.achievement-progress {
  margin-top: 20px;
}

.progress-bar {
  height: 10px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 5px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(to right, #3498db, #9b59b6);
  border-radius: 5px;
}

.progress-text {
  text-align: right;
  font-size: 12px;
  color: #a4b0be;
}

.achievement-secret-hint {
  display: flex;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 15px;
}

.achievement-secret-hint i {
  margin-right: 10px;
  color: #a4b0be;
}

.achievement-secret-hint p {
  margin: 0;
  color: #a4b0be;
  font-style: italic;
}

/* Rarity styles */
.rarity-common {
  border-left-color: #78909c;
}
.rarity-common .badge-container {
  background-color: #78909c;
  box-shadow: 0 0 15px rgba(120, 144, 156, 0.5);
}
.rarity-common .rarity-badge {
  background-color: #78909c;
}

.rarity-uncommon {
  border-left-color: #4caf50;
}
.rarity-uncommon .badge-container {
  background-color: #4caf50;
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
}
.rarity-uncommon .rarity-badge {
  background-color: #4caf50;
}

.rarity-rare {
  border-left-color: #2196f3;
}
.rarity-rare .badge-container {
  background-color: #2196f3;
  box-shadow: 0 0 15px rgba(33, 150, 243, 0.5);
}
.rarity-rare .rarity-badge {
  background-color: #2196f3;
}

.rarity-epic {
  border-left-color: #9c27b0;
}
.rarity-epic .badge-container {
  background-color: #9c27b0;
  box-shadow: 0 0 15px rgba(156, 39, 176, 0.5);
}
.rarity-epic .rarity-badge {
  background-color: #9c27b0;
}

.rarity-legendary {
  border-left-color: #ff9800;
}
.rarity-legendary .badge-container {
  background-color: #ff9800;
  box-shadow: 0 0 15px rgba(255, 152, 0, 0.5);
}
.rarity-legendary .rarity-badge {
  background-color: #ff9800;
}
</style>
