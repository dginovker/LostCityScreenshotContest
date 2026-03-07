<template>
  <MainLayout>
    <p class="yellow" style="text-align:center;font-weight:bold;margin-bottom:8px">
      Your History
    </p>

    <template v-if="loading">
      <p class="white" style="text-align: center;">Loading history...</p>
    </template>

    <template v-else-if="votes.length === 0">
      <p class="white" style="text-align: center;">No votes yet — go compare some screenshots!</p>
    </template>

    <template v-else>
      <div class="history-list b">
        <div
          v-for="(vote, idx) in votes"
          :key="idx"
          class="hist-row"
          :class="{ 'hist-row-odd': idx % 2 === 1 }"
        >
          <div class="hist-pair">
            <div class="hist-img-wrap hist-winner">
              <a :href="vote.winner.url" target="_blank" rel="noopener">
                <img :src="vote.winner.url" :alt="'Winner: ' + vote.winner.username" class="hist-thumb" />
              </a>
              <span class="hist-label green">Winner</span>
              <span class="white hist-user">{{ vote.winner.username }}</span>
              <a :href="'https://lostcity.rs/t/' + vote.winner.topicId" target="_blank" rel="noopener" class="hist-topic">{{ vote.winner.topicTitle }}</a>
            </div>
            <span class="white hist-vs">vs</span>
            <div class="hist-img-wrap">
              <a :href="vote.loser.url" target="_blank" rel="noopener">
                <img :src="vote.loser.url" :alt="vote.loser.username" class="hist-thumb" />
              </a>
              <span class="white hist-user">{{ vote.loser.username }}</span>
              <a :href="'https://lostcity.rs/t/' + vote.loser.topicId" target="_blank" rel="noopener" class="hist-topic">{{ vote.loser.topicTitle }}</a>
            </div>
          </div>
          <div class="hist-meta">
            <span class="white hist-time">{{ formatTime(vote.timestamp) }}</span>
          </div>
        </div>
      </div>
    </template>

    <div style="text-align:center;margin-top:8px">
      <router-link to="/" class="green">Back to Compare</router-link>
    </div>
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getUserVotes } from '../services/voting'
import images from '../data/images.json'
import MainLayout from '@/layouts/MainLayout.vue'

interface ImageMeta {
  url: string
  username: string
  topicId: number
  topicTitle: string
}

interface VoteDisplay {
  winner: ImageMeta
  loser: ImageMeta
  timestamp: Date
}

const loading = ref(true)
const votes = ref<VoteDisplay[]>([])

const metaMap = new Map<string, ImageMeta>()
for (const img of images) {
  metaMap.set(img.id, { url: img.url, username: img.username, topicId: img.topicId, topicTitle: img.topicTitle })
}

function formatTime(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  const records = await getUserVotes()
  votes.value = records
    .map(r => {
      const winner = metaMap.get(r.winnerId)
      const loser = metaMap.get(r.loserId)
      if (!winner || !loser) return null
      return {
        winner,
        loser,
        timestamp: r.timestamp,
      }
    })
    .filter((v): v is VoteDisplay => v !== null)
  loading.value = false
})
</script>

<style scoped>
.history-list {
  background: rgba(0, 0, 0, 0.6);
}

.hist-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px;
  background: rgba(30, 30, 30, 0.8);
}

.hist-row-odd {
  background: rgba(50, 50, 50, 0.8);
}

.hist-pair {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hist-img-wrap {
  text-align: center;
}

.hist-winner {
  position: relative;
}

.hist-thumb {
  height: 80px;
  max-width: 140px;
  object-fit: contain;
  display: block;
}

.hist-label {
  font-size: 10px;
  font-weight: bold;
}

.hist-user {
  display: block;
  font-size: 11px;
  margin-top: 2px;
}

.hist-topic {
  display: block;
  font-size: 10px;
  margin-top: 1px;
  word-break: break-word;
}

.hist-vs {
  font-size: 12px;
  opacity: 0.6;
}

.hist-meta {
  flex-shrink: 0;
}

.hist-time {
  font-size: 11px;
  opacity: 0.7;
}
</style>
