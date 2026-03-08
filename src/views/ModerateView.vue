<template>
  <MainLayout>
    <p class="yellow" style="text-align:center;font-weight:bold;margin-bottom:8px">
      Moderate Images ({{ visibleImages.length }} visible / {{ hiddenCount }} hidden)
    </p>

    <template v-if="loading">
      <p class="white" style="text-align: center;">Loading...</p>
    </template>

    <template v-else>
      <div style="text-align:center;margin-bottom:8px">
        <span class="white">Page {{ page + 1 }} / {{ totalPages }}</span>
        <div style="margin-top:4px">
          <button class="nav-btn b" :disabled="page === 0" @click="page--">&lt; Prev</button>
          <button class="nav-btn b" :disabled="page >= totalPages - 1" @click="page++">Next &gt;</button>
        </div>
      </div>

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
          v-for="img in pageImages"
          :key="img.id"
          :data-id="img.id"
          class="grid-item"
          :class="{ 'grid-selected': selected.has(img.id) }"
        >
          <img :src="img.url" :alt="img.topicTitle" loading="lazy" class="grid-thumb" draggable="false" />
        </div>

        <div v-if="dragging" class="select-rect" :style="rectStyle"></div>
      </div>

      <div style="text-align:center;margin-top:8px">
        <button class="nav-btn b" :disabled="page === 0" @click="page--">&lt; Prev</button>
        <button class="nav-btn b" :disabled="page >= totalPages - 1" @click="page++">Next &gt;</button>
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
import { loadHiddenIds, hideMany } from '../services/moderation'
import MainLayout from '@/layouts/MainLayout.vue'

const PER_PAGE = 1000

const images = allImages
const loading = ref(true)
const hidden = ref(new Set<string>())
const selected = ref(new Set<string>())
const page = ref(0)
const modalImage = ref<typeof allImages[0] | null>(null)

const imageMap = new Map(allImages.map(img => [img.id, img]))

const hiddenCount = computed(() => hidden.value.size)

const visibleImages = computed(() => images.filter(img => !hidden.value.has(img.id)))

const totalPages = computed(() => Math.ceil(visibleImages.value.length / PER_PAGE))

const pageImages = computed(() => {
  const start = page.value * PER_PAGE
  return visibleImages.value.slice(start, start + PER_PAGE)
})

// --- Drag-to-select ---
const gridRef = ref<HTMLElement | null>(null)
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
  if (!gridRef.value) return
  // Ctrl+click opens modal, don't start drag
  if (e.ctrlKey || e.metaKey) {
    const target = (e.target as HTMLElement).closest('.grid-item') as HTMLElement | null
    if (target?.dataset.id) {
      modalImage.value = imageMap.get(target.dataset.id) ?? null
    }
    return
  }
  const rect = gridRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left + gridRef.value.scrollLeft
  const y = e.clientY - rect.top + gridRef.value.scrollTop
  dragStart.value = { x, y }
  dragEnd.value = { x, y }
  dragging.value = true
  dragMoved.value = false
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value || !gridRef.value) return
  dragMoved.value = true
  const rect = gridRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left + gridRef.value.scrollLeft
  const y = e.clientY - rect.top + gridRef.value.scrollTop
  dragEnd.value = { x, y }

  updateSelectionFromRect()
}

function onMouseUp(e: MouseEvent) {
  if (!dragging.value) return
  dragging.value = false

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
  if (!gridRef.value) return

  const rx1 = Math.min(dragStart.value.x, dragEnd.value.x)
  const ry1 = Math.min(dragStart.value.y, dragEnd.value.y)
  const rx2 = Math.max(dragStart.value.x, dragEnd.value.x)
  const ry2 = Math.max(dragStart.value.y, dragEnd.value.y)

  const gridRect = gridRef.value.getBoundingClientRect()
  const items = gridRef.value.querySelectorAll('.grid-item')
  const next = new Set(selected.value)

  // Remove items previously added by drag (we'll re-add intersecting ones)
  // We track which items are in the current drag rect
  items.forEach((el) => {
    const id = (el as HTMLElement).dataset.id!
    const elRect = el.getBoundingClientRect()
    const ex1 = elRect.left - gridRect.left + gridRef.value!.scrollLeft
    const ey1 = elRect.top - gridRect.top + gridRef.value!.scrollTop
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
  hidden.value = await loadHiddenIds()
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
  width: 120px;
  height: 80px;
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
</style>
