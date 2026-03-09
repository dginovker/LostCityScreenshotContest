<template>
  <div
    class="image-card b"
    :class="cardClass"
    data-testid="image-card"
    @mouseenter="onHover"
    @mouseleave="onLeave"
    @click="$emit('pick')"
  >
    <div class="card-img-wrap">
      <img :src="image.url" :alt="image.topicTitle" class="card-img" />
    </div>
    <template v-if="revealed">
      <div class="card-stats yellow">
        {{ winRateText }}
      </div>
      <div class="card-username white">
        {{ image.username }}
      </div>
      <div class="card-topic">
        <a :href="'https://lostcity.rs/t/' + image.topicId" target="_blank" rel="noopener">
          {{ image.topicTitle }}
        </a>
      </div>
    </template>
    <button
      class="report-btn"
      :disabled="reported"
      title="Not relevant / too small"
      @click.stop="onReport"
    >
      {{ reported ? 'Reported' : 'Report Issue' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { reportNotRelevant } from '../services/moderation'

export interface ImageEntry {
  id: string
  url: string
  topicId: number
  topicTitle: string
  username: string
  postedAt: string
}

export interface ImageStatsData {
  wins: number
  comparisons: number
}

const props = defineProps<{
  image: ImageEntry
  revealed: boolean
  isSelected: boolean
  highlighted: boolean
  stats?: ImageStatsData
}>()

defineEmits<{ pick: [] }>()

const cardClass = computed(() => {
  if (!props.revealed) return props.highlighted ? 'card-interactive card-highlighted' : 'card-interactive'
  return props.isSelected ? 'card-selected' : 'card-not-selected'
})

const winRateText = computed(() => {
  if (!props.stats || props.stats.comparisons === 0) return '0% (0/0)'
  const pct = Math.round((props.stats.wins / props.stats.comparisons) * 100)
  return `${pct}% (${props.stats.wins}/${props.stats.comparisons})`
})

const reported = ref(false)

function onReport() {
  reported.value = true
  reportNotRelevant(props.image.id)
}

function onHover(e: MouseEvent) {
  if (!props.revealed) (e.currentTarget as HTMLElement).style.borderColor = '#ff3030'
}
function onLeave(e: MouseEvent) {
  if (!props.revealed) (e.currentTarget as HTMLElement).style.borderColor = ''
}
</script>

<style scoped>
.image-card {
  flex: 1 1 0;
  max-width: 1320px;
  min-width: 0;
  padding: 8px;
  text-align: center;
  box-sizing: border-box;
  background: #1a1a1a;
}

.card-interactive { cursor: pointer; }
.card-highlighted { border-color: #ff3030 !important; }
.card-selected { border-color: #04A800 !important; }
.card-not-selected { border-color: #E10505 !important; opacity: 0.6; }

.card-img-wrap {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 6px;
}
.card-img {
  max-width: 100%;
  max-height: 860px;
  object-fit: contain;
}

.card-stats {
  font-weight: bold;
  margin-top: 4px;
}
.card-username {
  font-size: 12px;
  margin-top: 2px;
}
.card-topic {
  font-size: 11px;
  margin-top: 2px;
  word-break: break-word;
}

.report-btn {
  margin-top: 6px;
  padding: 2px 8px;
  background: transparent;
  color: #888;
  border: 1px solid #555;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  cursor: pointer;
}
.report-btn:hover:not(:disabled) {
  color: #ff5555;
  border-color: #ff5555;
}
.report-btn:disabled {
  color: #555;
  cursor: default;
}
</style>
