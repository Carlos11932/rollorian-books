import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('home page loads with Rollorian title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Rollorian/)
  })

  test('search page is accessible from sidebar nav', async ({ page }) => {
    await page.goto('/')
    // NavLinks renders <Link href="/search"> with text "Search"
    await page.getByRole('link', { name: 'Search' }).first().click()
    await expect(page).toHaveURL('/search')
    await expect(page.getByRole('heading', { name: /Explore the Archive/i })).toBeVisible()
  })

  test('library page is accessible from sidebar nav', async ({ page }) => {
    await page.goto('/')
    // NavLinks renders <Link href="/library"> with text "Library"
    await page.getByRole('link', { name: 'Library' }).first().click()
    await expect(page).toHaveURL('/library')
    await expect(page.getByRole('heading', { name: /Your Archive/i })).toBeVisible()
  })

  test('home page link navigates back to home', async ({ page }) => {
    await page.goto('/search')
    await page.getByRole('link', { name: 'Home' }).first().click()
    await expect(page).toHaveURL('/')
  })
})
