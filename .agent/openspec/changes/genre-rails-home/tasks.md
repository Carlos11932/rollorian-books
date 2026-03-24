# Tasks: Genre Rails en Home

**Status:** ready
**Date:** 2026-03-24
**Change:** genre-rails-home
**Depends on:** spec.md, design.md

---

## Key Design Decisions (from approved design)

- Pure functions (`groupBooksByGenre`, `genreAffinityScore`, `topGenreRails`) go in `src/lib/utils/books.ts` (new file), NOT in `page.tsx`
- Constants (`MAX_GENRE_RAILS`, `AFFINITY_WEIGHTS`) live in `src/lib/utils/books.ts`
- Status rails are NOT refactored (ADR-7 accepted) — only genre rails are added
- Test file for book utils: `src/lib/utils/__tests__/books.test.ts` (new)
- Test file for text utils: `src/lib/utils/__tests__/text.test.ts` (additive)
- Genre rails JSX uses `BookRailSection` + `BookCard variant="browse"`
- Spec test file reference (`src/app/__tests__/genre-grouping.test.ts`) is superseded by design — use `src/lib/utils/__tests__/books.test.ts` instead

---

## Phase 1 — Utilities

### Tarea 1 — `toTitleCase` utility

**Archivos:**
- `src/lib/utils/text.ts` (MODIFY — add function)
- `src/lib/utils/__tests__/text.test.ts` (MODIFY — add test suite)

**Qué hacer:**

1. Open `src/lib/utils/text.ts` and add `toTitleCase` after the existing `stripHtml` function:

```typescript
/**
 * Converts a string to Title Case.
 * Used to normalize genre strings from Google Books API
 * which return inconsistent casing ("fiction", "Fiction", "FICTION").
 */
export function toTitleCase(str: string): string {
  if (!str) return ""
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
```

2. Open `src/lib/utils/__tests__/text.test.ts` and:
   - Add `toTitleCase` to the import from `@/lib/utils/text`
   - Append a new `describe("toTitleCase")` block with these cases:
     - `""` → `""`
     - `"fiction"` → `"Fiction"`
     - `"science fiction"` → `"Science Fiction"`
     - `"MYSTERY"` → `"Mystery"`
     - `"yOuNg aDuLt"` → `"Young Adult"`
     - `"a tale"` → `"A Tale"`
     - `"Historical Fiction"` → `"Historical Fiction"`
   - DO NOT touch the existing `stripHtml` tests

**Verificación:**
- `npm run test:run` — all tests green, including new `toTitleCase` suite
- `npx tsc --noEmit` — 0 errors

**Dependencias:** ninguna

---

### Tarea 2 — `src/lib/utils/books.ts` (new file) + tests

**Archivos:**
- `src/lib/utils/books.ts` (NEW)
- `src/lib/utils/__tests__/books.test.ts` (NEW)

**Qué hacer:**

1. Create `src/lib/utils/books.ts` with:

```typescript
import type { SerializableBook } from "@/features/books/types"
import type { BookStatus } from "@/lib/types/book"
import { toTitleCase } from "./text"

/** Maximum number of genre rails shown on the home page */
export const MAX_GENRE_RAILS = 6

/** Affinity weights by reading status — higher = stronger signal of real interest */
export const AFFINITY_WEIGHTS: Record<BookStatus, number> = {
  READ: 4,
  READING: 3,
  TO_READ: 2,
  WISHLIST: 1,
}

/**
 * Groups books by genre, normalizing genre names to Title Case.
 * A book with multiple genres appears in multiple groups.
 * Skips empty or whitespace-only genre strings.
 * Returns a Map preserving insertion order.
 */
export function groupBooksByGenre(
  books: SerializableBook[],
): Map<string, SerializableBook[]> {
  const byGenre = new Map<string, SerializableBook[]>()

  for (const book of books) {
    for (const genre of book.genres) {
      if (!genre.trim()) continue
      const normalized = toTitleCase(genre)
      if (!normalized) continue
      const list = byGenre.get(normalized)
      if (list) {
        list.push(book)
      } else {
        byGenre.set(normalized, [book])
      }
    }
  }

  return byGenre
}

/**
 * Calculates an affinity score for a list of books.
 * Higher score = user has more actively engaged with this genre.
 * READ (4) > READING (3) > TO_READ (2) > WISHLIST (1).
 */
export function genreAffinityScore(books: SerializableBook[]): number {
  return books.reduce(
    (score, book) => score + (AFFINITY_WEIGHTS[book.status] ?? 1),
    0,
  )
}

/**
 * Returns the top genre rails sorted by affinity score descending,
 * capped at maxRails.
 */
export function topGenreRails(
  books: SerializableBook[],
  maxRails: number = MAX_GENRE_RAILS,
): Array<[string, SerializableBook[]]> {
  const byGenre = groupBooksByGenre(books)

  return [...byGenre.entries()]
    .sort(([, a], [, b]) => genreAffinityScore(b) - genreAffinityScore(a))
    .slice(0, maxRails)
}
```

2. Create `src/lib/utils/__tests__/books.test.ts` using the `makeBook` helper and the full test suites from design section 3 (File 5). Cover:
   - `groupBooksByGenre`: empty genres, normalization merging, multi-genre book, blank genre skip, empty input
   - `genreAffinityScore`: empty list, per-status weights, mixed accumulation, `AFFINITY_WEIGHTS` values
   - `topGenreRails`: empty input, affinity ordering, `MAX_GENRE_RAILS` cap, custom `maxRails`, READ-beats-WISHLIST scenario

**Verificación:**
- `npm run test:run` — all tests green (Tarea 1 tests still pass, new books tests pass)
- `npx tsc --noEmit` — 0 errors, including correct import resolution of `@/features/books/types` and `@/lib/types/book`

**Dependencias:** Tarea 1 (books.ts imports `toTitleCase` from text.ts)

---

## Phase 2 — Integration

### Tarea 3 — Integrate genre rails into `src/app/page.tsx`

**Archivos:**
- `src/app/page.tsx` (MODIFY)

**Qué hacer:**

1. Add three new imports at the top of `page.tsx` (after existing imports):

```typescript
import { BookRailSection } from "@/features/shared/ui/book-rail-section"
import { BookCard } from "@/features/books/components/book-card"
import { topGenreRails } from "@/lib/utils/books"
```

2. Add the genre rail computation inside the component body, after the `byStatus` grouping and before `featuredBook`:

```typescript
const genreRails = topGenreRails(serializedBooks)
```

3. Add the genre rails JSX section after the closing of the status rails `.map()` block and before the closing `</div>` of the main content area:

```tsx
{/* Genre discovery rails */}
{genreRails.length > 0 && (
  <section aria-label="Browse by genre">
    <div className="flex items-center gap-3 mb-8">
      <h2 className="text-xl font-bold tracking-tight text-on-surface">
        Browse by Genre
      </h2>
    </div>
    <div className="space-y-12">
      {genreRails.map(([genre, books]) => (
        <BookRailSection
          key={genre}
          title={genre}
          count={books.length}
        >
          {books.map((book, index) => (
            <BookCard
              key={book.id}
              variant="browse"
              book={book}
              index={index}
            />
          ))}
        </BookRailSection>
      ))}
    </div>
  </section>
)}
```

4. DO NOT touch:
   - The empty state block
   - `byStatus` grouping
   - `featuredBook` selection
   - Background blur effect
   - The status rails `.map()` — status cards stay inline (ADR-7)
   - Any existing imports

**Verificación:**
- `npm run test:run` — all tests still green (no regressions)
- `npx tsc --noEmit` — 0 errors
- Visual check: if running locally, home page shows genre rails below status rails when books have genres

**Dependencias:** Tarea 2 (requires `topGenreRails` from `books.ts`)

---

## Phase 3 — Final Verification

### Tarea 4 — Verificación final

**Archivos:** ninguno (solo verificación)

**Qué hacer:**

Run the full verification suite in order:

1. `npm run test:run` — all tests pass, including:
   - Existing tests (no regressions)
   - New `toTitleCase` suite in `text.test.ts`
   - New `groupBooksByGenre`, `genreAffinityScore`, `topGenreRails` suites in `books.test.ts`

2. `npx tsc --noEmit` — 0 TypeScript errors

3. `npx eslint src/ --max-warnings 0` — 0 warnings

4. `npm run build` — production build completes without errors

5. If all green, commit all changes:
   ```
   git add src/lib/utils/text.ts \
            src/lib/utils/books.ts \
            src/lib/utils/__tests__/text.test.ts \
            src/lib/utils/__tests__/books.test.ts \
            src/app/page.tsx
   git commit -m "feat: add genre rails to home page with affinity scoring"
   ```

**Verificación:** All 4 commands above exit with code 0.

**Dependencias:** Tareas 1, 2, 3 completadas

---

## Summary

| Tarea | Archivos | Tipo | Depends on |
|-------|----------|------|------------|
| 1 — `toTitleCase` | `text.ts`, `text.test.ts` | utility + tests | — |
| 2 — `books.ts` | `books.ts`, `books.test.ts` | utility + tests | Tarea 1 |
| 3 — `page.tsx` | `page.tsx` | integration | Tarea 2 |
| 4 — Verificación | — | QA + commit | Tareas 1-3 |

**Total estimado:** ~267 lines added, 0 lines deleted across 5 files.

**Archivos NO tocados:** `prisma/schema.prisma`, `src/lib/types/book.ts`, `src/features/books/components/book-card.tsx`, `src/features/shared/ui/book-rail-section.tsx`, status rail inline cards.
