<template>
  <MainLayout>
    <template v-if="!ready">
      <p class="white" style="text-align: center;">Loading...</p>
    </template>
    <template v-else-if="images.length < 2">
      <p class="white" style="text-align: center;">Not enough images to compare</p>
    </template>
    <template v-else>
      <p class="yellow" style="text-align:center;font-weight:bold;margin-bottom:8px">
        Which screenshot do you prefer?
      </p>

      <div class="cards-row">
        <ImageCard
          :image="currentPair[0]"
          :revealed="revealed"
          :is-selected="revealed && selectedIndex === 0"
          :highlighted="!revealed && highlightedIndex === 0"
          :stats="revealed ? pairStats[0] : undefined"
          @pick="onPick(0)"
        />
        <ImageCard
          :image="currentPair[1]"
          :revealed="revealed"
          :is-selected="revealed && selectedIndex === 1"
          :highlighted="!revealed && highlightedIndex === 1"
          :stats="revealed ? pairStats[1] : undefined"
          @pick="onPick(1)"
        />
      </div>

      <div v-if="revealed" style="text-align:center;margin-top:8px">
        <button class="next-btn b" @click="nextRound">Next &gt;</button>
      </div>
    </template>
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import allImages from '../data/images.json'
import { recordVote, getImageStatsBatch, getImageStats as getImageStatsService } from '../services/voting'
import { loadHiddenIds } from '../services/moderation'
import type { ImageStats } from '../services/voting'
import MainLayout from '@/layouts/MainLayout.vue'
import ImageCard from '../components/ImageCard.vue'
import type { ImageEntry } from '../components/ImageCard.vue'

let images: typeof allImages = allImages

const ready = ref(false)
const currentPair = ref<[ImageEntry, ImageEntry]>(null as any)
const revealed = ref(false)
const selectedIndex = ref(-1)
const highlightedIndex = ref(-1)
const pairStats = ref<[ImageStats, ImageStats]>([
  { wins: 0, comparisons: 0 },
  { wins: 0, comparisons: 0 },
])

const previousPairKeys = new Set<string>()

function selectPair() {
  const len = images.length
  let attempts = 0
  while (attempts < 50) {
    const i = Math.floor(Math.random() * len)
    let j = Math.floor(Math.random() * (len - 1))
    if (j >= i) j++
    const key = [images[i]!.id, images[j]!.id].sort().join('|')
    if (!previousPairKeys.has(key) || attempts === 49) {
      previousPairKeys.add(key)
      if (previousPairKeys.size > 100) {
        const first = previousPairKeys.values().next().value!
        previousPairKeys.delete(first)
      }
      currentPair.value = [images[i] as ImageEntry, images[j] as ImageEntry]
      return
    }
    attempts++
  }
}

async function onPick(index: number) {
  if (revealed.value) return
  selectedIndex.value = index

  const winner = currentPair.value[index]!
  const loser = currentPair.value[1 - index]!

  await recordVote(winner.id, loser.id)
  const stats = await getImageStatsBatch([currentPair.value[0].id, currentPair.value[1].id])
  pairStats.value = [stats[0]!, stats[1]!]
  revealed.value = true
}

function nextRound() {
  revealed.value = false
  selectedIndex.value = -1
  highlightedIndex.value = -1
  pairStats.value = [{ wins: 0, comparisons: 0 }, { wins: 0, comparisons: 0 }]
  selectPair()
}

function onKeyDown(e: KeyboardEvent) {
  if (images.length < 2) return
  if (e.key === 'ArrowLeft' || e.key === '1') {
    e.preventDefault()
    if (!revealed.value) highlightedIndex.value = 0
  } else if (e.key === 'ArrowRight' || e.key === '2') {
    e.preventDefault()
    if (!revealed.value) highlightedIndex.value = 1
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (revealed.value) {
      nextRound()
    } else if (highlightedIndex.value !== -1) {
      onPick(highlightedIndex.value)
    }
  }
}

onMounted(async () => {
  const hiddenIds = await loadHiddenIds()
  if (hiddenIds.size > 0) {
    images = allImages.filter(img => !hiddenIds.has(img.id))
  }
  if (images.length >= 2) selectPair()
  ready.value = true
  window.addEventListener('keydown', onKeyDown)

  if (import.meta.env.DEV) {
    ;(window as any).__testApi = {
      forcePair(idA: string, idB: string) {
        const a = images.find(img => img.id === idA)
        const b = images.find(img => img.id === idB)
        if (a && b) {
          currentPair.value = [a as ImageEntry, b as ImageEntry]
          revealed.value = false
          selectedIndex.value = -1
        }
      },
      nextRound() {
        nextRound()
      },
      waitReady() {
        return new Promise<void>((resolve) => {
          if (auth.currentUser) {
            resolve()
            return
          }
          const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
              unsub()
              resolve()
            }
          })
        })
      },
      getState() {
        return {
          revealed: revealed.value,
          pair: currentPair.value,
          stats: pairStats.value,
        }
      },
      getImageStats(id: string) {
        return getImageStatsService(id)
      },
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.cards-row {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.next-btn {
  margin-top: 8px;
  padding: 4px 16px;
  background: #333;
  color: #FFE139;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  cursor: pointer;
}
.next-btn:hover {
  background: #444;
}
</style>
