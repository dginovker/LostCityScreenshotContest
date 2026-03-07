<template>
  <MainLayout>
    <p class="yellow" style="text-align:center;font-weight:bold;margin-bottom:8px">
      Highscores
    </p>

    <template v-if="loading">
      <p class="white" style="text-align: center;">Loading highscores...</p>
    </template>

    <template v-else-if="ranked.length === 0">
      <p class="white" style="text-align: center;">No votes yet</p>
    </template>

    <template v-else>
      <div class="highscores-list b">
        <div
          v-for="(entry, idx) in ranked"
          :key="entry.id"
          class="hs-row"
          :class="{ 'hs-row-odd': idx % 2 === 1 }"
        >
          <span class="hs-rank yellow">#{{ idx + 1 }}</span>
          <a :href="entry.url" target="_blank" rel="noopener" class="hs-thumb-link">
            <img :src="entry.url" :alt="'Screenshot by ' + entry.username" class="hs-thumb" />
          </a>
          <div class="hs-info">
            <span class="green hs-rate">{{ formatRate(entry.wins, entry.comparisons) }}</span>
            <span class="white hs-user">{{ entry.username }}</span>
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
import { getDocs, collection } from 'firebase/firestore'
import { db } from '../firebase'
import images from '../data/images.json'
import MainLayout from '@/layouts/MainLayout.vue'

interface RankedEntry {
  id: string
  url: string
  username: string
  wins: number
  comparisons: number
}

const loading = ref(true)
const ranked = ref<RankedEntry[]>([])

function formatRate(wins: number, comparisons: number): string {
  const pct = Math.round((wins / comparisons) * 100)
  return `${pct}% (${wins}/${comparisons})`
}

onMounted(async () => {
  const snapshot = await getDocs(collection(db, 'images'))

  const metaMap = new Map<string, { url: string; username: string }>()
  for (const img of images) {
    metaMap.set(img.id, { url: img.url, username: img.username })
  }

  const entries: RankedEntry[] = []
  snapshot.forEach((doc) => {
    const data = doc.data()
    const wins = data.wins ?? 0
    const comparisons = data.comparisons ?? 0
    if (comparisons === 0) return

    const meta = metaMap.get(doc.id)
    if (!meta) return

    entries.push({
      id: doc.id,
      url: meta.url,
      username: meta.username,
      wins,
      comparisons,
    })
  })

  entries.sort((a, b) => {
    const rateA = a.wins / a.comparisons
    const rateB = b.wins / b.comparisons
    if (rateB !== rateA) return rateB - rateA
    return b.comparisons - a.comparisons
  })

  ranked.value = entries
  loading.value = false
})
</script>

<style scoped>
.highscores-list {
  background: rgba(0, 0, 0, 0.6);
}

.hs-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(30, 30, 30, 0.8);
}

.hs-row-odd {
  background: rgba(50, 50, 50, 0.8);
}

.hs-rank {
  font-weight: bold;
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.hs-thumb-link {
  flex-shrink: 0;
}

.hs-thumb {
  height: 80px;
  max-width: 140px;
  object-fit: contain;
  display: block;
}

.hs-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.hs-rate {
  font-weight: bold;
}

.hs-user {
  font-size: 11px;
  opacity: 0.8;
}

@media (max-width: 480px) {
  .hs-row {
    flex-wrap: wrap;
  }

  .hs-thumb {
    height: 60px;
    max-width: 100px;
  }
}
</style>
