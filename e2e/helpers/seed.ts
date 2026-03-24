import { execSync } from 'child_process'

/**
 * Seeds the database with deterministic test data.
 * This is destructive — it deletes all existing books first.
 * Use only against a dedicated local test database with the required
 * ROLLORIAN_DB_CONTEXT and ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS env vars.
 */
export function seedDatabase() {
  execSync('npx prisma db seed', { stdio: 'inherit' })
}

/**
 * Clears all books from the database.
 * Useful for teardown when individual test isolation is needed.
 * Must only run in the same explicitly-approved local test context as seeding.
 */
export function clearDatabase() {
  execSync('npx prisma db execute --stdin <<< "DELETE FROM \\"Book\\";"', {
    stdio: 'inherit',
    shell: '/bin/bash',
  })
}
