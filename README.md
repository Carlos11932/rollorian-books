## Rollorian Books

Next.js 16 + Prisma app for searching books, curating a local library, and exercising the UI with Vitest + Playwright.

## Getting Started

1. Copy `.env.example` to `.env.local` and set your real runtime `DATABASE_URL` / `DIRECT_URL`.
2. Install dependencies with `npm ci`.
3. Start the app with `npm run dev`.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Safe local seeding

The seed is intentionally destructive: it deletes all rows from `Book` before inserting deterministic fixtures.

It now refuses to run unless ALL of this is true:

- `DATABASE_URL` points to a loopback Postgres host (`localhost`, `127.0.0.1`, `::1`)
- the database name does not look production-like (`prod`, `production`, `staging`, `live`, `primary`)
- `ROLLORIAN_DB_CONTEXT` is explicitly set to `local-dev` or `ci-e2e-local`
- `ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS=true`

Example for a deliberate local seed against a disposable Postgres instance:

```bash
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/rollorian_books_local"
export DIRECT_URL="$DATABASE_URL"
export ROLLORIAN_DB_CONTEXT="local-dev"
export ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS="true"
npm run db:guard
npx prisma db push --skip-generate
npx prisma db seed
```

CI follows the same policy, but against an ephemeral GitHub Actions Postgres service instead of any shared/real database.

## Tests

```bash
npx tsc --noEmit
npm test
npm run lint
```

## GitHub issue enrichment

This repo includes a GitHub-native issue intake and enrichment flow based on:

- GitHub Issue Forms
- GitHub Actions
- GitHub Models

Use the `Quick intake` issue form for short mobile-friendly submissions. The workflow expands the issue into a clearer review ticket while keeping the original raw intake inside the final issue.

See `docs/github-issue-enrichment.md` for setup, trigger behavior, labels, and the GitHub settings required for it to work.
