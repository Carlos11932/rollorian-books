import { test, expect } from '@playwright/test'

// Default locale is "es" — visible text uses Spanish translations.

test.describe('Search', () => {
  test('search page shows the heading and search input', async ({ page }) => {
    await page.goto('/search')
    // search.heading → "Explorar libros"
    await expect(page.getByRole('heading', { name: /Explorar libros/i })).toBeVisible()
    // search.inputLabel → "Busca por título, autor o ISBN"
    await expect(page.getByLabel(/Busca por título, autor o ISBN/i)).toBeVisible()
  })

  test('genre quick-filter pills are visible', async ({ page }) => {
    await page.goto('/search')
    // QUICK_FILTERS use t('search.genres.xxx') → Spanish labels
    await expect(page.getByRole('button', { name: 'Novela', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Historia', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Romance', exact: true })).toBeVisible()
  })

  test('typing a query and submitting shows results or empty state', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByLabel(/Busca por título, autor o ISBN/i)
    await input.fill('Harry Potter')
    await input.press('Enter')

    // Wait for loading to finish
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })

    // Either results section or empty-state message must be present
    // search.resultsLabel → "Resultados de búsqueda"
    const hasResults = await page.locator('[aria-label="Resultados de búsqueda"]').isVisible()
    // search.noResults → "No encontramos nada para …"
    const hasEmpty = await page.getByText(/No encontramos nada para/i).isVisible()
    expect(hasResults || hasEmpty).toBe(true)
  })

  test('clicking a quick-filter pill triggers a search', async ({ page }) => {
    await page.goto('/search')
    await page.getByRole('button', { name: 'Historia', exact: true }).click()

    // The input should now have "Historia" as its value
    await expect(page.getByLabel(/Busca por título, autor o ISBN/i)).toHaveValue('Historia')

    // Wait for loading to settle
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
  })

  test('empty search query does not trigger a search', async ({ page }) => {
    await page.goto('/search')
    // Submit empty form — handleSearch() returns early when trimmed is falsy
    await page.keyboard.press('Enter')
    // Should still be in default (non-searched) state:
    // no results section and no empty-state message visible
    await expect(page.locator('section[aria-label="Resultados de búsqueda"]')).not.toBeVisible()
    await expect(page.getByText(/No encontramos nada para/i)).not.toBeVisible()
  })
})
