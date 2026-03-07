import type { Page } from '@playwright/test'

const FIRESTORE_PORT = 8081
const PROJECT_ID = 'lostcity-screenshots'

export async function clearFirestore() {
  await fetch(
    `http://127.0.0.1:${FIRESTORE_PORT}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
}

/** Wait for Firebase auth + app initialization to complete */
export async function waitReady(page: Page) {
  await page.waitForFunction(() => (window as any).__testApi?.waitReady, null, { timeout: 10000 })
  await page.evaluate(() => (window as any).__testApi.waitReady())
}

/** Force a specific pair of images to be displayed */
export async function forcePair(page: Page, idA: string, idB: string) {
  await page.evaluate(([a, b]) => {
    ;(window as any).__testApi.forcePair(a, b)
  }, [idA, idB])
}

/** Get current app state from __testApi */
export async function getState(page: Page) {
  return page.evaluate(() => (window as any).__testApi.getState())
}

/** Click the "Next >" button */
export async function clickNext(page: Page) {
  await page.getByRole('button', { name: /Next/ }).click()
}

/** Navigate to / and wait for app + auth to be ready */
export async function gotoReady(page: Page) {
  await page.goto('/')
  await waitReady(page)
}

// First two image IDs from images.json
export const TEST_IMAGE_A = '6ab4ac9d5e6f'
export const TEST_IMAGE_B = '0e7ef90b298e'
