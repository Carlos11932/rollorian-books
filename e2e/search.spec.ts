import { test, expect } from '@playwright/test'

test.describe('Search', () => {
  test('search page shows the explore heading and search input', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByRole('heading', { name: /Explore the Archive/i })).toBeVisible()
    // The input has label "Busca por título, autor o ISBN" and type="search"
    await expect(page.getByLabel(/Busca por título, autor o ISBN/i)).toBeVisible()
  })

  test('genre quick-filter pills are visible', async ({ page }) => {
    await page.goto('/search')
    // QUICK_FILTERS = ["Novela", "Historia", "Ciencia Ficción", "Romance", "Filosofía"]
    await expect(page.getByRole('button', { name: 'Novela' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Historia' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Romance' })).toBeVisible()
  })

  test('typing a query and submitting shows results or empty state', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByLabel(/Busca por título, autor o ISBN/i)
    await input.fill('Harry Potter')
    await input.press('Enter')

    // Wait for the loading state to finish (aria-busy container disappears)
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })

    // Either results section or empty-state message must be present
    const hasResults = await page.locator('[aria-label="Resultados de búsqueda"]').isVisible()
    const hasEmpty = await page.getByText(/No encontramos nada para/i).isVisible()
    expect(hasResults || hasEmpty).toBe(true)
  })

  test('clicking a quick-filter pill triggers a search', async ({ page }) => {
    await page.goto('/search')
    await page.getByRole('button', { name: 'Historia' }).click()

    // The input should now have "Historia" as its value
    await expect(page.getByLabel(/Busca por título, autor o ISBN/i)).toHaveValue('Historia')

    // Loading skeleton appears (aria-busy) or results are already visible
    // Wait for loading to settle
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
  })

  test('empty search query does not trigger a search', async ({ page }) => {
    await page.goto('/search')
    // Submit empty form — handleSearch() returns early when trimmed is falsy
    await page.keyboard.press('Enter')
    // Should still be in the default (non-searched) state: genre bento grid visible
    await expect(page.getByRole('region', { name: 'Géneros' })).toBeVisible()
  })
})
