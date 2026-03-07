import { test, expect } from '@playwright/test'
import { clearFirestore, gotoReady, forcePair, getState, clickNext, TEST_IMAGE_A, TEST_IMAGE_B } from './helpers'

test.beforeEach(async () => { await clearFirestore() })

test('loads with two images', async ({ page }) => {
  await gotoReady(page)
  const images = page.locator('.image-card img.card-img')
  await expect(images).toHaveCount(2)
  for (let i = 0; i < 2; i++) {
    await expect(images.nth(i)).toHaveAttribute('src', /.+/)
  }
})

test('selecting an image reveals stats', async ({ page }) => {
  await gotoReady(page)
  await forcePair(page, TEST_IMAGE_A, TEST_IMAGE_B)

  // Click the first image card
  await page.locator('[data-testid="image-card"]').first().click()

  // Stats text should appear matching pattern like "100% (1/1)" or "0% (0/1)"
  await expect(page.locator('.card-stats').first()).toBeVisible()
  await expect(page.locator('.card-stats').first()).toHaveText(/\d+% \(\d+\/\d+\)/)

  // Metadata (username) should appear
  await expect(page.locator('.card-username').first()).toBeVisible()

  // "Next >" button should be visible
  await expect(page.getByRole('button', { name: /Next/ })).toBeVisible()
})

test('next round resets state', async ({ page }) => {
  await gotoReady(page)
  await forcePair(page, TEST_IMAGE_A, TEST_IMAGE_B)

  // Pick an image
  await page.locator('[data-testid="image-card"]').first().click()
  await expect(page.locator('.card-stats').first()).toBeVisible()

  // Click Next
  await clickNext(page)

  // New images should load and stats should be hidden
  await expect(page.locator('.card-stats')).toHaveCount(0)
  await expect(page.locator('[data-testid="image-card"]')).toHaveCount(2)
})

test('votes accumulate in Firestore', async ({ page }) => {
  await gotoReady(page)
  await forcePair(page, TEST_IMAGE_A, TEST_IMAGE_B)

  // Click the first image card (TEST_IMAGE_A wins)
  await page.locator('[data-testid="image-card"]').first().click()

  // Wait for reveal
  await expect(page.locator('.card-stats').first()).toBeVisible()

  // Verify via __testApi.getImageStats
  const winnerStats = await page.evaluate(
    (id) => (window as any).__testApi.getImageStats(id),
    TEST_IMAGE_A,
  )
  expect(winnerStats.wins).toBe(1)
  expect(winnerStats.comparisons).toBe(1)

  const loserStats = await page.evaluate(
    (id) => (window as any).__testApi.getImageStats(id),
    TEST_IMAGE_B,
  )
  expect(loserStats.wins).toBe(0)
  expect(loserStats.comparisons).toBe(1)
})

test('keyboard navigation works', async ({ page }) => {
  await gotoReady(page)
  await forcePair(page, TEST_IMAGE_A, TEST_IMAGE_B)

  // Press "1" to highlight the first image
  await page.keyboard.press('1')

  // Should highlight but NOT reveal yet
  await expect(page.locator('.card-highlighted')).toHaveCount(1)
  await expect(page.locator('.card-stats')).toHaveCount(0)

  // Switch highlight to second image
  await page.keyboard.press('2')
  await expect(page.locator('.card-highlighted')).toHaveCount(1)

  // Press "1" again to go back to first
  await page.keyboard.press('1')

  // Press Enter to confirm selection
  await page.keyboard.press('Enter')

  // Now reveal should activate
  await expect(page.locator('.card-stats').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Next/ })).toBeVisible()

  // Press Enter to go to next round
  await page.keyboard.press('Enter')

  // Verify next round starts (stats hidden)
  await expect(page.locator('.card-stats')).toHaveCount(0)
  await expect(page.locator('[data-testid="image-card"]')).toHaveCount(2)
})
