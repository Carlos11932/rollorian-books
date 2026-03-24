import { execSync } from 'child_process'

/**
 * Seeds the database with deterministic test data.
 * This is destructive — it deletes all existing books first.
 * Use only in CI E2E jobs against a dedicated test database.
 */
export function seedDatabase() {
  execSync('npx prisma db seed', { stdio: 'inherit' })
}

/**
 * Clears all books from the database.
 * Useful for teardown when individual test isolation is needed.
 */
export function clearDatabase() {
  execSync('npx prisma db execute --stdin <<< "DELETE FROM \\"Book\\";"', {
    stdio: 'inherit',
    shell: '/bin/bash',
  })
}
