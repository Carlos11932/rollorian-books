# Spec: Genre Rails en Home

**Status:** approved
**Date:** 2026-03-24
**Change:** genre-rails-home
**Depends on:** proposal.md

---

## 1. Functional Requirements

### FR-01 — Genre rails appear below status rails

The home page MUST render horizontal genre rails below the last visible status rail and above any footer. The section is rendered only when at least one book has at least one genre. If no books have genres, no genre section is rendered at all (no empty state, no heading).

### FR-02 — Genre grouping from in-memory data

Genre grouping MUST derive from the `serializedBooks` array already fetched by the existing Prisma query. No additional database queries are permitted.

### FR-03 — Genre string normalization

Every genre string MUST be normalized to Title Case before grouping. Normalization is case-insensitive: "science fiction", "Science Fiction", and "SCIENCE FICTION" all normalize to "Science Fiction" and are treated as the same genre.

### FR-04 — A book appears in every rail matching its genres

A book with `genres: ["Fiction", "Mystery"]` MUST appear in both the "Fiction" rail and the "Mystery" rail.

### FR-05 — Affinity scoring determines rail order

Genre rails MUST be ordered by affinity score descending. The affinity score for a genre is the sum of per-book weights:

| Status   | Weight |
|----------|--------|
| READ     | 4      |
| READING  | 3      |
| TO_READ  | 2      |
| WISHLIST | 1      |

A genre with 3 READ books (score 12) ranks above a genre with 10 WISHLIST books (score 10).

### FR-06 — Maximum 6 genre rails

At most `MAX_GENRE_RAILS = 6` genre rails are shown. The 6 genres with the highest affinity score are selected; the rest are silently discarded.

### FR-07 — Minimum 1 book per genre

A genre rail renders if and only if it contains at least 1 book. There is no minimum higher than 1.

### FR-08 — Section header "By Genre"

When genre rails are present, a section heading `<h2>By Genre</h2>` MUST appear above all genre rails. It MUST NOT appear when there are no genre rails.

### FR-09 — BookRailSection and BookCard usage

- Each genre rail uses the existing `BookRailSection` component with `title={genre}` and `count={books.length}`.
- Each book card inside a genre rail uses `<BookCard variant="browse" />`.
- No new components are created.

### FR-10 — Home page refactor for status rails

The existing inline carousel markup in `src/app/page.tsx` (the `<section>` blocks with manual `flex gap-6 overflow-x-auto` divs) MUST be replaced with `BookRailSection`. The visual and functional behavior of status rails MUST remain identical: scroll, fade edges, count badge, heading.

### FR-11 — `toTitleCase` utility

A new exported function `toTitleCase(str: string): string` MUST be added to `src/lib/utils/text.ts`. It converts any string to Title Case. Empty string input returns empty string. The function is pure (no side effects).

---

## 2. Non-Functional Requirements

### NFR-01 — Zero additional database queries

The implementation introduces 0 additional Prisma queries. All data processing is in-memory.

### NFR-02 — No schema changes

`prisma/schema.prisma` is not modified. The `genres: String[]` field already exists.

### NFR-03 — No new types

No new types are added to `src/lib/types/book.ts`. `SerializableBook` and `BookStatus` are used as-is.

### NFR-04 — No new components

Only existing components (`BookRailSection`, `BookCard`) are used.

### NFR-05 — TypeScript strict compliance

All new code MUST compile without TypeScript errors under the project's existing tsconfig.

### NFR-06 — Grouping complexity

Genre grouping runs in O(n * g) where n is the number of books and g is the average number of genres per book (typically 2-3). This is acceptable for expected data volumes.

### NFR-07 — No regression in status rails

After the home page refactor, status rails MUST behave identically to before: same scroll behavior, fade edges, count badge, heading, and empty-state handling.

---

## 3. Interfaces

### 3.1 `toTitleCase` — `src/lib/utils/text.ts`

```typescript
/**
 * Converts a string to Title Case.
 * Each word's first character is uppercased; remaining characters are lowercased.
 * Empty string returns empty string.
 *
 * Examples:
 *   toTitleCase("science fiction") → "Science Fiction"
 *   toTitleCase("FANTASY")         → "Fantasy"
 *   toTitleCase("")                → ""
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase())
}
```

### 3.2 Constants — `src/app/page.tsx`

```typescript
const MAX_GENRE_RAILS = 6

const AFFINITY_WEIGHTS: Record<BookStatus, number> = {
  READ: 4,
  READING: 3,
  TO_READ: 2,
  WISHLIST: 1,
}
```

### 3.3 Pure functions — `src/app/page.tsx`

These functions MUST be defined at module scope (outside the component) so they are importable in tests.

```typescript
/**
 * Computes the affinity score for a list of books in a genre.
 * Score is the sum of AFFINITY_WEIGHTS[book.status] for each book.
 * Returns 0 for an empty list.
 */
export function genreAffinityScore(books: SerializableBook[]): number {
  return books.reduce((score, book) => score + (AFFINITY_WEIGHTS[book.status] ?? 1), 0)
}

/**
 * Groups books by normalized (Title Case) genre.
 * A book with multiple genres appears in each genre's list.
 * Books with no genres are excluded.
 * Returns a Map<normalizedGenre, SerializableBook[]>.
 */
export function groupBooksByGenre(books: SerializableBook[]): Map<string, SerializableBook[]> {
  const map = new Map<string, SerializableBook[]>()
  for (const book of books) {
    for (const genre of book.genres) {
      const normalized = toTitleCase(genre)
      if (!map.has(normalized)) map.set(normalized, [])
      map.get(normalized)!.push(book)
    }
  }
  return map
}
```

### 3.4 `BookRailSection` interface (existing, read-only)

```typescript
interface BookRailSectionProps {
  title: string
  eyebrow?: string
  count?: number
  emptyTitle?: string
  emptyCopy?: string
  children: ReactNode
  className?: string
}
```

The component accepts `children: ReactNode`, NOT a `books` prop. Book cards are passed as children.

### 3.5 Genre rail rendering — `src/app/page.tsx`

```tsx
{genreRails.length > 0 && (
  <div className="space-y-12">
    <h2 className="text-xl font-bold text-on-surface">By Genre</h2>
    {genreRails.map(([genre, books]) => (
      <BookRailSection
        key={genre}
        title={genre}
        count={books.length}
      >
        {books.map((book, index) => (
          <BookCard key={book.id} book={book} variant="browse" index={index} />
        ))}
      </BookRailSection>
    ))}
  </div>
)}
```

`genreRails` is of type `[string, SerializableBook[]][]` — the sorted and capped result of:

```typescript
const genreRails = [...groupBooksByGenre(serializedBooks).entries()]
  .sort(([, a], [, b]) => genreAffinityScore(b) - genreAffinityScore(a))
  .slice(0, MAX_GENRE_RAILS)
```

---

## 4. User Scenarios (Given / When / Then)

### Feature: Genre Rails on Home Page

---

**Scenario 01 — User has no books**

Given the user's library is empty
When the home page renders
Then no genre rails section appears
And the existing empty state ("Your archive is empty") is shown

---

**Scenario 02 — User has books but none have genres**

Given the user has 5 books
And all books have `genres: []`
When the home page renders
Then no genre rails section appears
And no "By Genre" heading appears
And the status rails render normally

---

**Scenario 03 — User has books with genres, all distinct**

Given the user has books with genres ["Fantasy", "Mystery", "Thriller"]
And each genre has at least 1 book
When the home page renders
Then three genre rails appear below the status rails
And each rail title matches the normalized genre name
And the "By Genre" heading appears above all genre rails

---

**Scenario 04 — A book with multiple genres appears in each rail**

Given a book has `genres: ["Fiction", "Mystery"]`
When the home page renders
Then the book appears in the "Fiction" rail
And the book appears in the "Mystery" rail

---

**Scenario 05 — More than 6 distinct genres exist**

Given the user has books spanning 10 distinct genres
When the home page renders
Then exactly 6 genre rails appear
And the 6 genres shown are the 6 with the highest affinity score

---

**Scenario 06 — Genres with mixed casing are normalized and grouped**

Given a user has two books
And one book has `genres: ["science fiction"]`
And the other has `genres: ["Science Fiction"]`
When the home page renders
Then both books appear in a single "Science Fiction" rail
And no duplicate or mis-cased rails appear

---

**Scenario 07 — A genre with exactly 1 book renders a rail**

Given a genre has exactly 1 book
When the home page renders
Then the genre rail appears with that single book
And no minimum-count filtering removes it

---

**Scenario 08 — Affinity ordering: READ genre beats WISHLIST genre with more books**

Given genre "Fantasy" has 3 books all with status READ (score = 3 * 4 = 12)
And genre "Thriller" has 10 books all with status WISHLIST (score = 10 * 1 = 10)
When the home page renders
Then "Fantasy" rail appears before "Thriller" rail

---

**Scenario 09 — User with only WISHLIST books sees genre rails**

Given the user has 5 books all with status WISHLIST
And all books have genres populated
When the home page renders
Then genre rails appear
And each genre's affinity score is computed using weight 1 per book

---

### Feature: Affinity Scoring

---

**Scenario 10 — READ book contributes 4 points**

Given a genre has 1 book with status READ
Then `genreAffinityScore([book])` returns 4

---

**Scenario 11 — READING book contributes 3 points**

Given a genre has 1 book with status READING
Then `genreAffinityScore([book])` returns 3

---

**Scenario 12 — TO_READ book contributes 2 points**

Given a genre has 1 book with status TO_READ
Then `genreAffinityScore([book])` returns 2

---

**Scenario 13 — WISHLIST book contributes 1 point**

Given a genre has 1 book with status WISHLIST
Then `genreAffinityScore([book])` returns 1

---

**Scenario 14 — Mixed statuses accumulate correctly**

Given a genre has 3 books: 1 READ, 1 READING, 1 WISHLIST
Then `genreAffinityScore(books)` returns 4 + 3 + 1 = 8

---

**Scenario 15 — Empty list returns 0**

Given an empty book list
Then `genreAffinityScore([])` returns 0

---

### Feature: Home page refactor — BookRailSection for status rails

---

**Scenario 16 — Status rails render identically after refactor**

Given the home page is refactored to use `BookRailSection` for status rails
When a user navigates to the home page
Then status rails show the correct title, book count badge, fade edges, and scroll behavior
And no visual or functional regression is visible compared to the previous inline markup

---

**Scenario 17 — No additional DB queries introduced**

Given the home page renders with genre rails and refactored status rails
Then exactly 1 Prisma query executes (the existing `prisma.book.findMany`)
And no additional queries are issued for genre grouping

---

### Feature: `toTitleCase` utility

---

**Scenario 18 — Lowercase input**

Given `str = "science fiction"`
Then `toTitleCase(str)` returns `"Science Fiction"`

---

**Scenario 19 — All-uppercase input**

Given `str = "FANTASY"`
Then `toTitleCase(str)` returns `"Fantasy"`

---

**Scenario 20 — Single lowercase word**

Given `str = "history"`
Then `toTitleCase(str)` returns `"History"`

---

**Scenario 21 — Empty string**

Given `str = ""`
Then `toTitleCase(str)` returns `""`

---

**Scenario 22 — Already-mixed Title Case**

Given `str = "already Title Case"`
Then `toTitleCase(str)` returns `"Already Title Case"`

---

**Scenario 23 — Multiple words each get capitalized**

Given `str = "the old man and the sea"`
Then `toTitleCase(str)` returns `"The Old Man And The Sea"`

---

## 5. Edge Cases

### EC-01 — Book with empty genres array

A book with `genres: []` is skipped entirely during grouping. It does not contribute to any rail. `groupBooksByGenre` handles this correctly because the inner `for...of` over an empty array executes zero iterations.

### EC-02 — Genre string that is only whitespace

A genre string like `"  "` normalizes to `"  "` (toTitleCase does not trim). This is an edge case from malformed API data. Mitigation: in `groupBooksByGenre`, genres should be filtered with `.filter(g => g.trim().length > 0)` before normalization to prevent phantom rails with blank titles.

**Constraint added to implementation:** The genre loop in `groupBooksByGenre` must skip genres where `genre.trim() === ""`.

### EC-03 — Tie in affinity score between two genres

When two genres have the same affinity score, their relative order is determined by JavaScript's `Array.prototype.sort` stability (insertion order from the Map). This is acceptable for v1; no explicit tiebreaker is required.

### EC-04 — `BookRailSection` receives 0 children after genre filtering

`BookRailSection` renders an empty state when `hasChildren` is false. Since genre rails are only rendered when the genre has at least 1 book, this path is not reachable from genre rails. Status rail refactor must pass books only for non-empty statuses (same as current behavior: `if (sectionBooks.length === 0) return null`).

### EC-05 — Acronym casing (e.g. "AI", "LGBTQ+")

`toTitleCase` lowercases all characters before re-capitalizing word starts. "AI" becomes "Ai". This is a known limitation of the v1 implementation and is documented in the proposal as acceptable. No fix is required for this spec.

### EC-06 — Single-character genres

A genre like `"a"` normalizes to `"A"`. This is handled correctly by the regex `(?:^|\s)\S`.

### EC-07 — MAX_GENRE_RAILS cap with fewer than 6 genres

When the user has genres for only 3 distinct genres, `genreRails.slice(0, 6)` returns all 3. No error or empty slot occurs.

---

## 6. Criteria of "Do Not Do"

| Constraint | Reason |
|------------|--------|
| Do NOT add Prisma queries | Data is already fetched; SQL-level groupBy is unsupported for array columns anyway |
| Do NOT create new components | `BookRailSection` and `BookCard` already cover the needed UI |
| Do NOT modify `prisma/schema.prisma` | `genres: String[]` already exists |
| Do NOT modify `src/lib/types/book.ts` | `SerializableBook` and `BookStatus` are sufficient |
| Do NOT use `variant="shelf"` for genre cards | Genre rails are for browsing/discovery; `variant="browse"` is the correct choice |
| Do NOT render a genre empty state in the home | If no genres, the entire section is hidden; `BookRailSection`'s built-in empty state is not triggered |

---

## 7. Required Tests

### 7.1 `src/lib/utils/__tests__/text.test.ts` (add to existing file)

Add a new `describe("toTitleCase")` block with the following `it` cases:

| Test name | Input | Expected output |
|-----------|-------|-----------------|
| returns empty string for empty input | `""` | `""` |
| lowercases and capitalizes each word | `"science fiction"` | `"Science Fiction"` |
| handles all-uppercase input | `"FANTASY"` | `"Fantasy"` |
| handles single lowercase word | `"history"` | `"History"` |
| handles already-mixed case | `"already Title Case"` | `"Already Title Case"` |
| capitalizes every word in a multi-word string | `"the old man and the sea"` | `"The Old Man And The Sea"` |

### 7.2 `src/app/__tests__/genre-grouping.test.ts` (new file)

Import `groupBooksByGenre`, `genreAffinityScore`, `MAX_GENRE_RAILS` from `src/app/page.tsx`.

#### `describe("groupBooksByGenre")`

| Test name | Setup | Expected |
|-----------|-------|----------|
| returns empty map for books with no genres | 1 book, `genres: []` | `map.size === 0` |
| single book single genre creates one entry | 1 book, `genres: ["Fantasy"]` | map has key `"Fantasy"` with 1 book |
| book with multiple genres appears in each entry | 1 book, `genres: ["Fiction", "Mystery"]` | map has both `"Fiction"` and `"Mystery"`, each with the book |
| normalizes mixed casing — same genre different cases merged | 2 books: `genres: ["science fiction"]` and `genres: ["Science Fiction"]` | map has only `"Science Fiction"` with 2 books |
| skips blank genre strings | 1 book, `genres: ["", "Fantasy"]` | map has only `"Fantasy"`; no blank-key entry |

#### `describe("genreAffinityScore")`

| Test name | Setup | Expected |
|-----------|-------|----------|
| returns 0 for empty list | `[]` | `0` |
| READ book scores 4 | 1 book, status `READ` | `4` |
| READING book scores 3 | 1 book, status `READING` | `3` |
| TO_READ book scores 2 | 1 book, status `TO_READ` | `2` |
| WISHLIST book scores 1 | 1 book, status `WISHLIST` | `1` |
| accumulates mixed statuses | 1 READ + 1 READING + 1 WISHLIST | `4 + 3 + 1 = 8` |

#### `describe("genre rail ordering and cap")`

| Test name | Setup | Expected |
|-----------|-------|----------|
| genre with 3 READ books ranks above genre with 10 WISHLIST books | Fantasy=3xREAD (12), Thriller=10xWISHLIST (10) | Fantasy rail index < Thriller rail index |
| caps rails at MAX_GENRE_RAILS | 10 distinct genres | result length === `MAX_GENRE_RAILS` (6) |
| fewer than MAX genres shows all | 3 distinct genres | result length === 3 |

---

## 8. Files Affected

| File | Change |
|------|--------|
| `src/lib/utils/text.ts` | Add `toTitleCase` export |
| `src/lib/utils/__tests__/text.test.ts` | Add `toTitleCase` test cases |
| `src/app/page.tsx` | Add constants, pure functions, genre grouping logic; refactor status rails to use `BookRailSection`; render genre rails section |
| `src/app/__tests__/genre-grouping.test.ts` | New test file for grouping and scoring logic |

---

## 9. Out of Scope

- Genre filtering on the library page (separate issue)
- Genre-based search (issue #13)
- Manual genre management
- Authentication / per-user affinity
- Schema or Prisma changes
- Acronym casing handling (v2+)
