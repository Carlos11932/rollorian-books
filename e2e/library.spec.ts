import { test, expect } from '@playwright/test'

// Default locale is "es" — visible text uses Spanish translations.
// StatusTabs uses t('library.tabAll') and t('library.statusesAriaLabel').

test.describe('Library', () => {
  test('library page shows the heading', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: /Tu Biblioteca/i })).toBeVisible()
  })

  test('library page shows status tabs navigation', async ({ page }) => {
    await page.goto('/library')
    // Wait for full hydration of the client component
    const tablist = page.getByRole('tablist', { name: /Estados de la biblioteca/i })
    await expect(tablist).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('tab', { name: /Todos/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Lista de deseos/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Por leer/i })).toBeVisible()
    await expect(page.locator('[role="tab"][href*="status=READING"]')).toBeVisible()
    await expect(page.locator('[role="tab"][href*="status=READ"]').first()).toBeVisible()
  })

  test('Todos tab is selected by default', async ({ page }) => {
    await page.goto('/library')
    const allTab = page.getByRole('tab', { name: /Todos/i })
    await expect(allTab).toBeVisible({ timeout: 15000 })
    await expect(allTab).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking a status tab filters by status in the URL', async ({ page }) => {
    await page.goto('/library')
    const tab = page.getByRole('tab', { name: /Lista de deseos/i })
    await expect(tab).toBeVisible({ timeout: 15000 })
    await tab.click()
    await expect(page).toHaveURL(/[?&]status=WISHLIST/)
    await expect(tab).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking Todos tab after a status filter removes status from URL', async ({ page }) => {
    await page.goto('/library?status=WISHLIST')
    const tab = page.getByRole('tab', { name: /Todos/i })
    await expect(tab).toBeVisible({ timeout: 15000 })
    await tab.click()
    await expect(page).not.toHaveURL(/status=/)
  })

  test('direct navigation to status filter loads the filtered view', async ({ page }) => {
    await page.goto('/library?status=READING')
    await expect(page.locator('[role="tab"][href*="status=READING"]')).toHaveAttribute('aria-selected', 'true', { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /Tu Biblioteca/i })).toBeVisible()
  })
})
