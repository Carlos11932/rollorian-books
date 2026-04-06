import { test, expect } from '@playwright/test'

// Default locale is "es" — visible text uses Spanish translations.
// StatusTabs uses t('library.tabAll') and t('library.statusesAriaLabel').
// Other tabs use t('book.status.XXX') → Spanish.

test.describe('Library', () => {
  test('library page shows the heading', async ({ page }) => {
    await page.goto('/library')
    // library.heading → "Tu Biblioteca"
    await expect(page.getByRole('heading', { name: /Tu Biblioteca/i })).toBeVisible()
  })

  test('library page shows status tabs navigation', async ({ page }) => {
    await page.goto('/library')
    // StatusTabs renders <nav role="tablist"> with i18n aria-label
    const tablist = page.getByRole('tablist', { name: /Estados de la biblioteca/i })
    await expect(tablist).toBeVisible()
    // library.tabAll → "Todos"; others use book.status translations
    await expect(page.getByRole('tab', { name: /Todos/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Lista de deseos/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Por leer/i })).toBeVisible()
    await expect(page.locator('[role="tab"][href*="status=READING"]')).toBeVisible()
    await expect(page.locator('[role="tab"][href*="status=READ"]').first()).toBeVisible()
  })

  test('Todos tab is selected by default', async ({ page }) => {
    await page.goto('/library')
    const allTab = page.getByRole('tab', { name: /Todos/i })
    await expect(allTab).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking a status tab filters by status in the URL', async ({ page }) => {
    await page.goto('/library')
    // Click "Lista de deseos" tab (WISHLIST)
    await page.getByRole('tab', { name: /Lista de deseos/i }).click()
    await expect(page).toHaveURL(/[?&]status=WISHLIST/)
    await expect(page.getByRole('tab', { name: /Lista de deseos/i })).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking Todos tab after a status filter removes status from URL', async ({ page }) => {
    await page.goto('/library?status=WISHLIST')
    await page.getByRole('tab', { name: /Todos/i }).click()
    await expect(page).not.toHaveURL(/status=/)
  })

  test('direct navigation to status filter loads the filtered view', async ({ page }) => {
    await page.goto('/library?status=READING')
    // READING tab should be active (use href selector to avoid Leyendo/Releyendo ambiguity)
    await expect(page.locator('[role="tab"][href*="status=READING"]')).toHaveAttribute('aria-selected', 'true')
    // The page shows either books or an empty state — both are valid without seeded data
    const heading = page.getByRole('heading', { name: /Tu Biblioteca/i })
    await expect(heading).toBeVisible()
  })
})
