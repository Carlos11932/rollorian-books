# Design: Genre Rails en Home

**Status:** approved
**Date:** 2026-03-24
**Proposal:** `sdd/genre-rails-home/proposal`

---

## 1. Architecture Overview

### Data Flow

```
prisma.book.findMany() (existing, unchanged)
  -> books: Book[]
  -> serializedBooks: SerializableBook[]
  -> byStatus (existing grouping, unchanged)
  -> groupBooksByGenre(serializedBooks)        [NEW - pure function]
  -> genreAffinityScore(books)                 [NEW - pure function]
  -> sort by affinity desc + slice(0, MAX_GENRE_RAILS)
  -> render <BookRailSection> + <BookCard variant="browse">
```

No new database queries. No new API calls. All processing is in-memory on the server during SSR.

### Component Composition

```
Home (Server Component)
  |-- BookRailSection ("use client") -- status rails (refactored from inline markup)
  |     |-- inline card markup (existing status card style, NOT BookCard)
  |-- BookRailSection ("use client") -- genre rails (new)
        |-- BookCard variant="browse" ("use client")
```

**Critical finding:** The current home page renders inline card markup for status rails that differs significantly from `BookCard` variants. The status cards have a custom hover overlay with `STATUS_BADGE_LABEL`, a gradient overlay, and distinct sizing (w-48/w-56). `BookCard variant="browse"` has a fixed 118px width, different styling, and includes `Badge` + `CardOverlay` components. These are NOT interchangeable.

**Design decision:** Refactor status rails to use `BookRailSection` for the CONTAINER only (heading, scroll, fade edges), but preserve the existing inline card markup for status items. Genre rails use `BookRailSection` + `BookCard variant="browse"`.

---

## 2. Architecture Decisions

### ADR-1: Pure functions in `src/lib/utils/books.ts` (new file)

**Decision:** Extract `groupBooksByGenre` and `genreAffinityScore` to a new file `src/lib/utils/books.ts`.

**Alternative rejected:** Keep them as local helpers in `page.tsx`.

**Rationale:**
- `page.tsx` is a Server Component with JSX -- mixing pure data-transformation logic with render code violates single responsibility.
- These functions have zero React dependencies -- they operate on plain `SerializableBook[]` arrays and `BookStatus` types.
- A separate file enables clean, isolated unit testing without mocking page-level concerns.
- The `src/lib/utils/` directory already has `text.ts` following this pattern. `books.ts` is a natural sibling.
- Future recommendation features (v2) will reuse these functions -- extracting now avoids a refactor later.

### ADR-2: Status rail cards remain inline (no BookCard refactor)

**Decision:** Wrap status rails in `BookRailSection` for the container but keep the existing inline card markup.

**Alternative rejected:** Replace status card markup with `BookCard variant="shelf"` (which does not exist) or `BookCard variant="browse"`.

**Rationale:**
- The home page status cards have a unique visual treatment: `w-48 md:w-56` sizing, aspect-[2/3] cover, gradient overlay with status badge on hover, and no border/padding. None of the existing `BookCard` variants match this.
- Creating a new `variant="shelf"` is out of scope per the proposal (and would be a substantial component change).
- The proposal says "Refactor home to use BookRailSection" -- the value is in eliminating the duplicated CONTAINER markup (scroll, overflow, heading), not in replacing the card markup.
- Risk mitigation: Changing the card rendering could break the visual polish verified by `visual-polish.test.ts`.

### ADR-3: Title Case normalization at grouping time

**Decision:** Apply `toTitleCase` during the grouping step, before inserting into the Map.

**Alternative rejected:** Normalize at render time in the JSX.

**Rationale:**
- Normalizing at grouping time ensures books with "fiction", "Fiction", and "FICTION" all land in the same bucket.
- Normalizing only at render would create separate buckets for each casing variant, defeating the purpose.
- The `toTitleCase` result becomes the Map key AND the display title -- single source of truth.

### ADR-4: `MAX_GENRE_RAILS` and `AFFINITY_WEIGHTS` as named constants

**Decision:** Define both as module-level constants in `src/lib/utils/books.ts`.

**Alternative rejected:** Hardcoded numbers inline.

**Rationale:**
- Named constants are self-documenting and easy to find/change.
- Exporting them enables tests to reference them for assertions.
- `AFFINITY_WEIGHTS` as a `Record<BookStatus, number>` is type-safe and exhaustive -- TypeScript will error if a new status is added to the enum.

### ADR-5: Wrapper `<section>` with `aria-label` for genre rails group

**Decision:** Wrap all genre rails in a `<section aria-label="Browse by genre">` element.

**Alternative rejected:** Plain `<div>`.

**Rationale:**
- Each `BookRailSection` already renders its own `<section>`. A parent `<section>` with an aria-label creates a navigable landmark for screen readers, grouping the genre rails as a distinct region from status rails.
- Status rails do not need a wrapper because they are the primary content and each has its own `<section>`.

### ADR-6: `BookCard` is a "use client" component -- safe to use from Server Component

**Decision:** Import and render `BookCard` directly in the Server Component `page.tsx`.

**Alternative considered:** Create a client wrapper component.

**Rationale:**
- Next.js allows Server Components to import and render Client Components. The `"use client"` boundary is at the component definition, not the import.
- The library page (`src/app/library/page.tsx`) already uses this exact pattern: Server Component importing `BookRailSection` (client) and `LibraryBookCard` (client).
- No wrapper needed.

---

## 3. File Changes

### File 1: `src/lib/utils/text.ts` (MODIFY)

**Add** `toTitleCase` function after existing `stripHtml`.

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

**Design note:** Uses `split(" ")` + `map` instead of the regex approach from the proposal (`/(?:^|\s)\S/g`). Both produce identical results, but split+map is more readable and debuggable. Handles empty/falsy input gracefully following the same guard pattern as `stripHtml`.

**DO NOT touch:** `stripHtml` function.

---

### File 2: `src/lib/utils/books.ts` (NEW)

New file with pure functions for book data transformations.

```typescript
import type { SerializableBook } from "@/features/books/types"
import type { BookStatus } from "@/lib/types/book"
import { toTitleCase } from "./text"

/** Maximum number of genre rails shown on the home page */
export const MAX_GENRE_RAILS = 6

/** Affinity weights by reading status -- higher = stronger signal of real interest */
export const AFFINITY_WEIGHTS: Record<BookStatus, number> = {
  READ: 4,
  READING: 3,
  TO_READ: 2,
  WISHLIST: 1,
}

/**
 * Groups books by genre, normalizing genre names to Title Case.
 * A book with multiple genres appears in multiple groups.
 * Returns a Map preserving insertion order.
 */
export function groupBooksByGenre(
  books: SerializableBook[],
): Map<string, SerializableBook[]> {
  const byGenre = new Map<string, SerializableBook[]>()

  for (const book of books) {
    for (const genre of book.genres) {
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
 * Higher score = the user has more actively engaged with books in this genre.
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

**Design note:** `topGenreRails` is a convenience function that composes `groupBooksByGenre` + `genreAffinityScore` + sort + slice. This keeps `page.tsx` clean -- a single function call replaces the multi-step pipeline. All three functions are exported for granular testing.

---

### File 3: `src/app/page.tsx` (MODIFY)

#### 3a. New imports (ADD at top)

```typescript
import { BookRailSection } from "@/features/shared/ui/book-rail-section"
import { BookCard } from "@/features/books/components/book-card"
import { topGenreRails } from "@/lib/utils/books"
```

#### 3b. Genre rail computation (ADD after `byStatus` grouping, before `featuredBook`)

```typescript
const genreRails = topGenreRails(serializedBooks)
```

Single line. All logic is in the extracted pure function.

#### 3c. Refactor status rail containers (MODIFY lines 84-143)

Replace the current inline status rail rendering with `BookRailSection` for the container, but PRESERVE the existing inline card markup.

Current (lines 84-143):
```tsx
{STATUS_CONFIG.map(({ status, title }) => {
  const sectionBooks = byStatus[status];
  if (sectionBooks.length === 0) return null;
  return (
    <section key={status}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface flex items-center gap-3">
          {title}
          {status === "READING" && (
            <span className="material-symbols-outlined text-secondary text-sm" ...>
              auto_stories
            </span>
          )}
        </h2>
        <Link href="/library" className="text-primary text-sm font-semibold hover:underline">
          View All
        </Link>
      </div>
      <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4">
        {sectionBooks.map((book: SerializableBook) => {
          // ... inline card rendering
        })}
      </div>
    </section>
  );
})}
```

Proposed replacement:
```tsx
{STATUS_CONFIG.map(({ status, title }) => {
  const sectionBooks = byStatus[status];
  if (sectionBooks.length === 0) return null;

  const sectionTitle = status === "READING"
    ? `${title} \u2728`  // or keep the icon approach below
    : title;

  return (
    <BookRailSection
      key={status}
      title={title}
      count={sectionBooks.length}
    >
      {sectionBooks.map((book: SerializableBook) => {
        const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";
        const year = book.publishedDate ? new Date(book.publishedDate).getFullYear() : null;

        return (
          <Link
            key={book.id}
            href={`/books/${book.id}`}
            className="flex-none w-48 md:w-56 group cursor-pointer"
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-surface-container-low transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_20px_40px_rgba(0,17,12,0.8)]">
              {book.coverUrl ? (
                <Image
                  src={book.coverUrl}
                  alt={book.title}
                  fill
                  sizes="(max-width: 768px) 192px, 224px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary text-4xl">menu_book</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <span className="text-secondary text-xs font-bold mb-1">{STATUS_BADGE_LABEL[book.status]}</span>
              </div>
            </div>
            <h3 className="mt-4 text-on-surface font-bold text-sm group-hover:text-primary transition-colors">{book.title}</h3>
            <p className="text-tertiary text-xs">{authorLine}{year ? ` \u2022 ${year}` : ""}</p>
          </Link>
        );
      })}
    </BookRailSection>
  );
})}
```

**What changes:** The `<section>`, heading `<div>`, "View All" link, and scroll container `<div>` are replaced by `BookRailSection` which provides all of these (section, heading, scroll, fade edges, count badge).

**What is preserved:** The inline card rendering (Link + Image + overlay + text) stays identical. It is unique to the home page status rails and does NOT match any `BookCard` variant.

**What is lost:** The "View All" link and the `auto_stories` icon on "Currently Reading". The "View All" link can be added as a future enhancement to `BookRailSection` (an `action` slot prop). The icon loss is acceptable for v1.

**IMPORTANT TRADEOFF:** If losing the "View All" link and the reading icon is NOT acceptable, the status rails should NOT be refactored and the change should be limited to ADDING genre rails only. I recommend this simpler approach -- see ADR-7 below.

### ADR-7: Minimal refactor -- add genre rails, do NOT refactor status rails

**Decision (RECOMMENDED):** Keep existing status rail markup unchanged. Only ADD genre rails below.

**Alternative rejected:** Full refactor of status rails to use `BookRailSection`.

**Rationale:**
- The status rails have custom elements that `BookRailSection` does not support: "View All" link, `auto_stories` icon on READING, specific margin/padding (`-mx-4 px-4`).
- Refactoring status rails requires either (a) adding new props to `BookRailSection` (out of scope) or (b) losing functionality.
- The proposal says "Refactor home to use BookRailSection" but the PRIMARY goal is genre rails. The refactor is secondary and introduces risk with no functional gain.
- `visual-polish.test.ts` does not test home page structure directly, but changing the DOM structure could affect future snapshot tests.
- Recommendation: Ship genre rails first. Refactor status rails in a follow-up if desired, after adding an `action` slot to `BookRailSection`.

**If ADR-7 is accepted**, the `page.tsx` changes simplify to:

#### 3c-alt. Status rails UNCHANGED (lines 84-143 stay as-is)

#### 3d. Genre rails section (ADD after the status rails `.map()` closing, before the closing `</div>`)

Insert between the end of the status CONFIG map (line 143) and the closing `</div>` tags:

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

**Design notes:**
- `aria-label="Browse by genre"` creates a screen-reader landmark.
- Section heading "Browse by Genre" sits outside the individual `BookRailSection` components.
- `BookCard variant="browse"` has a fixed 118px width with `scrollSnapAlign: "start"` -- this matches the compact card style used in the library browse view.
- `index` prop enables staggered fade-in animation on the cards.
- `key={book.id}` is correct even though a book may appear in multiple genre rails -- React keys only need to be unique within their sibling list, and each genre rail is a separate `.map()`.

#### 3e. Remove unused imports (CLEANUP)

After the change, `STATUS_BADGE_LABEL` is still used by the inline status cards. All existing imports remain needed. The only NEW imports are the three listed in 3a.

**DO NOT touch:**
- The empty state block (lines 31-45)
- The `byStatus` grouping (lines 51-60)
- The `featuredBook` selection (line 62)
- The background blur effect (lines 66-81)
- The outer layout div structure

---

### File 4: `src/lib/utils/__tests__/text.test.ts` (MODIFY)

**Add** `toTitleCase` test suite after the existing `stripHtml` describe block.

```typescript
import { stripHtml, toTitleCase } from "@/lib/utils/text"

// ... existing stripHtml tests ...

describe("toTitleCase", () => {
  it("returns empty string for empty input", () => {
    expect(toTitleCase("")).toBe("")
  })

  it("capitalizes a single lowercase word", () => {
    expect(toTitleCase("fiction")).toBe("Fiction")
  })

  it("capitalizes multiple lowercase words", () => {
    expect(toTitleCase("science fiction")).toBe("Science Fiction")
  })

  it("lowercases then title-cases all-caps input", () => {
    expect(toTitleCase("MYSTERY")).toBe("Mystery")
  })

  it("normalizes mixed casing", () => {
    expect(toTitleCase("yOuNg aDuLt")).toBe("Young Adult")
  })

  it("handles single character words", () => {
    expect(toTitleCase("a tale")).toBe("A Tale")
  })

  it("preserves already title-cased input", () => {
    expect(toTitleCase("Historical Fiction")).toBe("Historical Fiction")
  })
})
```

**DO NOT touch:** Existing `stripHtml` tests. Only add the new import and the new describe block.

---

### File 5: `src/lib/utils/__tests__/books.test.ts` (NEW)

New test file for the pure book utility functions.

```typescript
import { describe, it, expect } from "vitest"
import type { SerializableBook } from "@/features/books/types"
import {
  groupBooksByGenre,
  genreAffinityScore,
  topGenreRails,
  MAX_GENRE_RAILS,
  AFFINITY_WEIGHTS,
} from "@/lib/utils/books"

// --- Test helper ---

function makeBook(
  overrides: Partial<SerializableBook> & { status: SerializableBook["status"] },
): SerializableBook {
  return {
    id: crypto.randomUUID(),
    title: "Test Book",
    subtitle: null,
    authors: ["Author"],
    description: null,
    coverUrl: null,
    publisher: null,
    publishedDate: null,
    pageCount: null,
    isbn10: null,
    isbn13: null,
    rating: null,
    notes: null,
    genres: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// --- groupBooksByGenre ---

describe("groupBooksByGenre", () => {
  it("returns empty map when no books have genres", () => {
    const books = [makeBook({ status: "READ", genres: [] })]
    expect(groupBooksByGenre(books).size).toBe(0)
  })

  it("groups books by normalized genre name", () => {
    const books = [
      makeBook({ status: "READ", genres: ["fiction"] }),
      makeBook({ status: "READ", genres: ["Fiction"] }),
      makeBook({ status: "READ", genres: ["FICTION"] }),
    ]
    const result = groupBooksByGenre(books)
    expect(result.size).toBe(1)
    expect(result.get("Fiction")).toHaveLength(3)
  })

  it("places a book in multiple genre groups", () => {
    const book = makeBook({ status: "READ", genres: ["Fiction", "Mystery"] })
    const result = groupBooksByGenre([book])
    expect(result.size).toBe(2)
    expect(result.get("Fiction")).toContain(book)
    expect(result.get("Mystery")).toContain(book)
  })

  it("skips empty genre strings", () => {
    const books = [makeBook({ status: "READ", genres: ["", "Fiction"] })]
    const result = groupBooksByGenre(books)
    expect(result.size).toBe(1)
    expect(result.has("Fiction")).toBe(true)
  })

  it("returns empty map for empty book list", () => {
    expect(groupBooksByGenre([]).size).toBe(0)
  })
})

// --- genreAffinityScore ---

describe("genreAffinityScore", () => {
  it("returns 0 for empty list", () => {
    expect(genreAffinityScore([])).toBe(0)
  })

  it("scores READ higher than WISHLIST", () => {
    const readBooks = [makeBook({ status: "READ" })]
    const wishlistBooks = [makeBook({ status: "WISHLIST" })]
    expect(genreAffinityScore(readBooks)).toBeGreaterThan(
      genreAffinityScore(wishlistBooks),
    )
  })

  it("sums weights correctly", () => {
    const books = [
      makeBook({ status: "READ" }),     // 4
      makeBook({ status: "READING" }),   // 3
      makeBook({ status: "WISHLIST" }),  // 1
    ]
    expect(genreAffinityScore(books)).toBe(8)
  })

  it("uses correct weight values", () => {
    expect(AFFINITY_WEIGHTS.READ).toBe(4)
    expect(AFFINITY_WEIGHTS.READING).toBe(3)
    expect(AFFINITY_WEIGHTS.TO_READ).toBe(2)
    expect(AFFINITY_WEIGHTS.WISHLIST).toBe(1)
  })
})

// --- topGenreRails ---

describe("topGenreRails", () => {
  it("returns empty array when no books have genres", () => {
    expect(topGenreRails([])).toEqual([])
  })

  it("sorts genres by affinity score descending", () => {
    const books = [
      makeBook({ status: "WISHLIST", genres: ["Romance"] }),       // score 1
      makeBook({ status: "READ", genres: ["Mystery"] }),           // score 4
      makeBook({ status: "READING", genres: ["Science Fiction"] }), // score 3
    ]
    const rails = topGenreRails(books)
    expect(rails.map(([genre]) => genre)).toEqual([
      "Mystery",
      "Science Fiction",
      "Romance",
    ])
  })

  it("caps results at MAX_GENRE_RAILS", () => {
    const genres = Array.from({ length: 10 }, (_, i) => `Genre ${i}`)
    const books = genres.map(g => makeBook({ status: "READ", genres: [g] }))
    const rails = topGenreRails(books)
    expect(rails.length).toBe(MAX_GENRE_RAILS)
  })

  it("respects custom maxRails parameter", () => {
    const books = [
      makeBook({ status: "READ", genres: ["A", "B", "C"] }),
    ]
    expect(topGenreRails(books, 2).length).toBe(2)
  })

  it("genre with fewer READ books outranks genre with many WISHLIST books", () => {
    const books = [
      // Mystery: 2 READ = score 8
      makeBook({ status: "READ", genres: ["Mystery"] }),
      makeBook({ status: "READ", genres: ["Mystery"] }),
      // Romance: 5 WISHLIST = score 5
      ...Array.from({ length: 5 }, () =>
        makeBook({ status: "WISHLIST", genres: ["Romance"] }),
      ),
    ]
    const rails = topGenreRails(books)
    expect(rails[0][0]).toBe("Mystery")
    expect(rails[1][0]).toBe("Romance")
  })
})
```

---

## 4. Dependencies

### Internal (existing, no changes needed)

| Dependency | Location | Used by |
|-----------|----------|---------|
| `SerializableBook` | `src/features/books/types.ts` | `books.ts`, `page.tsx` |
| `BookStatus` | `src/lib/types/book.ts` | `books.ts` |
| `BookRailSection` | `src/features/shared/ui/book-rail-section.tsx` | `page.tsx` (genre rails) |
| `BookCard` | `src/features/books/components/book-card.tsx` | `page.tsx` (genre rails) |
| `toTitleCase` | `src/lib/utils/text.ts` | `books.ts` |

### External (none)

No new npm dependencies.

---

## 5. Impact on Existing Tests

### `src/app/__tests__/visual-polish.test.ts` -- NOT AFFECTED

This test reads source files as strings and checks for specific CSS class strings and structural patterns. It tests:
1. `globals.css` -- semantic theme aliases (untouched)
2. `layout.tsx` -- Material Symbols loading (untouched)
3. `site-header.tsx`, `library/page.tsx`, `search/page.tsx`, `library/loading.tsx`, `search/loading.tsx` -- gutters and class strings (all untouched)

It does NOT read `src/app/page.tsx`. No impact.

### `src/lib/utils/__tests__/text.test.ts` -- MODIFIED (additive only)

New `toTitleCase` tests added. Existing `stripHtml` tests unchanged. The import line changes to include `toTitleCase`.

### All other tests -- NOT AFFECTED

The home page (`src/app/page.tsx`) has no dedicated test file. The change is additive (new section in JSX, new import, one new line of computation). No existing functionality is removed or modified.

---

## 6. Summary of Files Changed

| File | Change | Lines (est.) |
|------|--------|-------------|
| `src/lib/utils/text.ts` | ADD `toTitleCase` function | +12 |
| `src/lib/utils/books.ts` | NEW file -- `groupBooksByGenre`, `genreAffinityScore`, `topGenreRails`, constants | +65 |
| `src/app/page.tsx` | ADD imports, genre computation, genre rails JSX section | +30 |
| `src/lib/utils/__tests__/text.test.ts` | ADD `toTitleCase` test suite | +30 |
| `src/lib/utils/__tests__/books.test.ts` | NEW file -- tests for all book utility functions | +130 |
| **Total** | | **~267 lines added, 0 deleted** |

---

## 7. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `BookCard variant="browse"` visual size (118px) may feel too small in genre rails compared to status cards (w-48/w-56) | Medium | Verify during QA. The browse variant is designed for compact horizontal scrolling. If too small, the card width can be overridden via a wrapper div without changing BookCard. |
| `toTitleCase` flattens acronyms ("AI" becomes "Ai") | Low | Acceptable for v1. Real genre data from Google Books rarely contains acronyms. Can add an exception list later. |
| Genre rails with single book look sparse | Low | `BookRailSection` handles this gracefully -- the rail just has one card with fade edges. Acceptable UX. |
| Server Component importing two client components adds to bundle | Low | Both `BookRailSection` and `BookCard` are already in the client bundle (used by library and search pages). No new bundle cost. |
