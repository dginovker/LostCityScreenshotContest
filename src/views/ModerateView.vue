<template>
  <MainLayout>
    <p class="yellow" style="text-align:center;font-weight:bold;margin-bottom:8px">
      Moderate Images ({{ visibleImages.length }} visible / {{ hiddenCount }} hidden)
    </p>

    <template v-if="loading">
      <p class="white" style="text-align: center;">Loading...</p>
    </template>

    <template v-else>
      <div v-if="selected.size > 0" class="action-bar">
        <span class="white">{{ selected.size }} selected</span>
        <button class="action-btn b discard-btn" @click="discardSelected">Discard</button>
        <button class="action-btn b clear-btn" @click="selected = new Set()">Clear Selection</button>
      </div>

      <div
        ref="gridRef"
        class="grid"
        @mousedown.prevent="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
      >
        <div
          v-for="img in visibleImages"
          :key="img.id"
          :data-id="img.id"
          class="grid-item"
          :class="{ 'grid-selected': selected.has(img.id) }"
        >
          <img :src="img.url" :alt="img.topicTitle" loading="lazy" class="grid-thumb" draggable="false" />
        </div>

        <div v-if="dragging" class="select-rect" :style="rectStyle"></div>
      </div>

    </template>

    <template v-if="reportedImages.length > 0">
      <p class="yellow" style="text-align:center;font-weight:bold;margin-top:16px;margin-bottom:8px">
        Reported Images ({{ reportedImages.length }})
      </p>
      <div
        ref="reportGridRef"
        class="grid"
        @mousedown.prevent="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
      >
        <div
          v-for="r in reportedImages"
          :key="r.image.id"
          :data-id="r.image.id"
          class="grid-item"
          :class="{ 'grid-selected': selected.has(r.image.id) }"
        >
          <img :src="r.image.url" :alt="r.image.topicTitle" loading="lazy" class="grid-thumb" draggable="false" />
          <span class="report-badge">{{ r.count }}</span>
        </div>

        <div v-if="dragging" class="select-rect" :style="rectStyle"></div>
      </div>
    </template>

    <div style="text-align:center;margin-top:8px">
      <router-link to="/" class="green">Back to Compare</router-link>
    </div>

    <div v-if="modalImage" class="modal-overlay" @click.self="modalImage = null">
      <div class="modal-content">
        <img :src="modalImage.url" :alt="modalImage.topicTitle" class="modal-img" />
        <div class="modal-meta">
          <span class="white">{{ modalImage.username }}</span>
          <span class="white"> &mdash; </span>
          <a :href="'https://lostcity.rs/t/' + modalImage.topicId" target="_blank" rel="noopener">{{ modalImage.topicTitle }}</a>
        </div>
        <button class="action-btn b clear-btn" style="margin-top:8px" @click="modalImage = null">Close (Esc)</button>
      </div>
    </div>
  </MainLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import allImages from '../data/images.json'
import { loadHiddenIds, hideMany, loadReports } from '../services/moderation'
import type { Report } from '../services/moderation'
import MainLayout from '@/layouts/MainLayout.vue'

const images = allImages
const loading = ref(true)
const hidden = ref(new Set<string>())
const selected = ref(new Set<string>())
const modalImage = ref<typeof allImages[0] | null>(null)

const imageMap = new Map(allImages.map(img => [img.id, img]))
const reports = ref<Report[]>([])

const reportedImages = computed(() => {
  const counts = new Map<string, number>()
  for (const r of reports.value) {
    counts.set(r.imageId, (counts.get(r.imageId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ image: imageMap.get(id), count }))
    .filter((r): r is { image: typeof allImages[0]; count: number } => r.image != null && !hidden.value.has(r.image.id))
    .sort((a, b) => b.count - a.count)
})

const hiddenCount = computed(() => hidden.value.size)

const visibleImages = computed(() => images.filter(img => !hidden.value.has(img.id)))

// --- Drag-to-select ---
const gridRef = ref<HTMLElement | null>(null)
const reportGridRef = ref<HTMLElement | null>(null)
let activeGrid: HTMLElement | null = null
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragEnd = ref({ x: 0, y: 0 })

const rectStyle = computed(() => {
  const x1 = Math.min(dragStart.value.x, dragEnd.value.x)
  const y1 = Math.min(dragStart.value.y, dragEnd.value.y)
  const x2 = Math.max(dragStart.value.x, dragEnd.value.x)
  const y2 = Math.max(dragStart.value.y, dragEnd.value.y)
  return {
    left: x1 + 'px',
    top: y1 + 'px',
    width: (x2 - x1) + 'px',
    height: (y2 - y1) + 'px',
  }
})

const dragMoved = ref(false)

function onMouseDown(e: MouseEvent) {
  const grid = (e.currentTarget as HTMLElement)
  if (!grid) return
  // Ctrl+click opens modal, don't start drag
  if (e.ctrlKey || e.metaKey) {
    const target = (e.target as HTMLElement).closest('.grid-item') as HTMLElement | null
    if (target?.dataset.id) {
      modalImage.value = imageMap.get(target.dataset.id) ?? null
    }
    return
  }
  activeGrid = grid
  const rect = grid.getBoundingClientRect()
  const x = e.clientX - rect.left + grid.scrollLeft
  const y = e.clientY - rect.top + grid.scrollTop
  dragStart.value = { x, y }
  dragEnd.value = { x, y }
  dragging.value = true
  dragMoved.value = false
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value || !activeGrid) return
  dragMoved.value = true
  const rect = activeGrid.getBoundingClientRect()
  const x = e.clientX - rect.left + activeGrid.scrollLeft
  const y = e.clientY - rect.top + activeGrid.scrollTop
  dragEnd.value = { x, y }

  updateSelectionFromRect()
}

function onMouseUp(e: MouseEvent) {
  if (!dragging.value) return
  dragging.value = false
  activeGrid = null

  // If mouse didn't move, treat as a click — toggle the item under cursor
  if (!dragMoved.value) {
    const target = (e.target as HTMLElement).closest('.grid-item') as HTMLElement | null
    if (target?.dataset.id) {
      const next = new Set(selected.value)
      if (next.has(target.dataset.id)) {
        next.delete(target.dataset.id)
      } else {
        next.add(target.dataset.id)
      }
      selected.value = next
    }
  }
}

function updateSelectionFromRect() {
  if (!activeGrid) return

  const rx1 = Math.min(dragStart.value.x, dragEnd.value.x)
  const ry1 = Math.min(dragStart.value.y, dragEnd.value.y)
  const rx2 = Math.max(dragStart.value.x, dragEnd.value.x)
  const ry2 = Math.max(dragStart.value.y, dragEnd.value.y)

  const gridRect = activeGrid.getBoundingClientRect()
  const items = activeGrid.querySelectorAll('.grid-item')
  const next = new Set(selected.value)

  items.forEach((el) => {
    const id = (el as HTMLElement).dataset.id!
    const elRect = el.getBoundingClientRect()
    const ex1 = elRect.left - gridRect.left + activeGrid!.scrollLeft
    const ey1 = elRect.top - gridRect.top + activeGrid!.scrollTop
    const ex2 = ex1 + elRect.width
    const ey2 = ey1 + elRect.height

    const intersects = ex1 < rx2 && ex2 > rx1 && ey1 < ry2 && ey2 > ry1
    if (intersects) {
      next.add(id)
    }
  })

  selected.value = next
}

// --- Actions ---
async function discardSelected() {
  const ids = [...selected.value]
  if (ids.length > 0) {
    await hideMany(ids)
    const next = new Set(hidden.value)
    for (const id of ids) next.add(id)
    hidden.value = next
  }
  selected.value = new Set()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') modalImage.value = null
}

onMounted(async () => {
  const [hiddenIds, reportList] = await Promise.all([loadHiddenIds(), loadReports()])
  hidden.value = hiddenIds
  reports.value = reportList
  loading.value = false
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
  position: relative;
  user-select: none;
}

.grid-item {
  position: relative;
  width: 200px;
  height: 140px;
  overflow: hidden;
  border: 2px solid transparent;
}

.grid-selected {
  border-color: #4a9eff !important;
  box-shadow: 0 0 4px #4a9eff;
}

.grid-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.select-rect {
  position: absolute;
  border: 1px solid #4a9eff;
  background: rgba(74, 158, 255, 0.15);
  pointer-events: none;
  z-index: 10;
}

.action-bar {
  text-align: center;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-btn {
  padding: 4px 14px;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  cursor: pointer;
}

.discard-btn {
  background: #5c1a1a;
  color: #E10505;
}
.discard-btn:hover {
  background: #732626;
}

.clear-btn {
  background: #333;
  color: #FFE139;
}
.clear-btn:hover {
  background: #444;
}

.nav-btn {
  margin: 0 4px;
  padding: 4px 12px;
  background: #333;
  color: #FFE139;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  cursor: pointer;
}
.nav-btn:hover:not(:disabled) {
  background: #444;
}
.nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  text-align: center;
  max-width: 90vw;
  max-height: 90vh;
}

.modal-img {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
}

.modal-meta {
  margin-top: 8px;
  font-size: 13px;
}

.report-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #E10505;
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 3px;
}
</style>
