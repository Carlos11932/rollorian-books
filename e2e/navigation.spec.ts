import { test, expect } from '@playwright/test'

// Default locale is "es" — all visible text uses Spanish translations.

test.describe('Navigation', () => {
  test('home page loads with Rollorian title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Rollorian/)
  })

  test('search page is accessible from sidebar nav', async ({ page }) => {
    await page.goto('/')
    // NavLinks uses t('nav.search') → "Buscar"
    await page.getByRole('link', { name: 'Buscar' }).first().click()
    await expect(page).toHaveURL('/search')
    // search.heading → "Explorar libros"
    await expect(page.getByRole('heading', { name: /Explorar libros/i })).toBeVisible()
  })

  test('library page is accessible from sidebar nav', async ({ page }) => {
    await page.goto('/')
    // NavLinks uses t('nav.library') → "Biblioteca"
    await page.getByRole('link', { name: 'Biblioteca' }).first().click()
    await expect(page).toHaveURL('/library')
    // library.heading → "Tu Biblioteca"
    await expect(page.getByRole('heading', { name: /Tu Biblioteca/i })).toBeVisible()
  })

  test('home page link navigates back to home', async ({ page }) => {
    await page.goto('/search')
    // NavLinks uses t('nav.home') → "Inicio"
    await page.getByRole('link', { name: 'Inicio' }).first().click()
    await expect(page).toHaveURL('/')
  })
})
