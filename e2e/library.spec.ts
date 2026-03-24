import { test, expect } from '@playwright/test'

test.describe('Library', () => {
  test('library page shows the Your Archive heading', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: /Your Archive/i })).toBeVisible()
  })

  test('library page shows status tabs navigation', async ({ page }) => {
    await page.goto('/library')
    // StatusTabs renders a <nav role="tablist" aria-label="Library statuses">
    const tablist = page.getByRole('tablist', { name: /Library statuses/i })
    await expect(tablist).toBeVisible()
    // The 5 tabs: All, Wishlist, To Read, Reading, Read
    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Wishlist' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'To Read' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Reading' })).toBeVisible()
    await expect(page.locator('[role="tab"][href="/library?status=READ"]')).toBeVisible()
  })

  test('All tab is selected by default', async ({ page }) => {
    await page.goto('/library')
    const allTab = page.getByRole('tab', { name: 'All' })
    await expect(allTab).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking Wishlist tab filters by status=WISHLIST in the URL', async ({ page }) => {
    await page.goto('/library')
    await page.getByRole('tab', { name: 'Wishlist' }).click()
    await expect(page).toHaveURL(/[?&]status=WISHLIST/)
    // The Wishlist tab should now be active
    await expect(page.getByRole('tab', { name: 'Wishlist' })).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking All tab after a status filter removes status from URL', async ({ page }) => {
    await page.goto('/library?status=WISHLIST')
    await page.getByRole('tab', { name: 'All' }).click()
    // URL should not contain status param
    await expect(page).not.toHaveURL(/status=/)
  })

  test('direct navigation to status filter loads the filtered view', async ({ page }) => {
    await page.goto('/library?status=READING')
    await expect(page.getByRole('tab', { name: 'Reading' })).toHaveAttribute('aria-selected', 'true')
    // The page shows an empty state or books — either is valid without seeded data
    const hasBooks = await page.locator('[class*="shrink-0"]').count() > 0
    const hasEmpty = await page.getByRole('heading', { name: /No Reading books/i }).isVisible()
    expect(hasBooks || hasEmpty).toBe(true)
  })
})
