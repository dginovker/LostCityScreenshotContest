import { test, expect } from '@playwright/test'
import { clearFirestore, gotoReady, forcePair, TEST_IMAGE_A, TEST_IMAGE_B } from './helpers'

test('shows no votes message when empty', async ({ page }) => {
  await clearFirestore()
  await page.goto('/#/highscores')
  await expect(page.getByText('No votes yet')).toBeVisible()
})

test('shows ranked images after voting', async ({ page }) => {
  await clearFirestore()

  // Go to compare and cast a vote
  await gotoReady(page)
  await forcePair(page, TEST_IMAGE_A, TEST_IMAGE_B)
  await page.locator('[data-testid="image-card"]').first().click()
  await expect(page.locator('.card-stats').first()).toBeVisible()

  // Navigate to highscores
  await page.goto('/#/highscores')

  // Wait for loading to finish and ranked entries to appear
  await expect(page.locator('.hs-row').first()).toBeVisible({ timeout: 10000 })

  // Verify at least 1 ranked entry with win rate text
  const rows = page.locator('.hs-row')
  await expect(rows).toHaveCount(2) // both images should appear (winner + loser)
  await expect(rows.first().locator('.hs-rate')).toHaveText(/\d+% \(\d+\/\d+\)/)
})

test('back to compare link works', async ({ page }) => {
  await page.goto('/#/highscores')
  await expect(page.getByText('Back to Compare')).toBeVisible()
  await page.getByText('Back to Compare').click()

  // Verify URL is back at root
  await expect(page).toHaveURL(/\/$|\/\#\/$/)
})
