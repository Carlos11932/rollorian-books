# Proposal: Genre Rails en Home (#12)

**Status:** draft
**Date:** 2026-03-24
**Issue:** #12 -- Agrupar libros por genero en el home

---

## 1. Executive Summary

Add horizontal genre-based book rails to the home page (below the existing status rails) using in-memory grouping of the already-fetched books data, while refactoring the home to adopt the shared `BookRailSection` component and eliminating duplicated markup.

---

## 2. Scope

### In scope

- Genre rails on the home page, rendered below status rails
- Refactor home page to use `BookRailSection` instead of inline carousel markup
- Normalize genre strings to Title Case for consistent display
- Add a `toTitleCase` utility to `src/lib/utils/text.ts` (does not exist yet)
- Configurable maximum number of genre rails (default: 6)
- Genre rails ordered by affinity score descending (weighted by reading status, not raw book count)
- Only show genres that have at least 1 book

### Out of scope

- Genre filtering on the library page (separate issue)
- Genre-based search (issue #13)
- Manual genre management (add/edit/remove genres)
- Authentication/authorization (pending)
- Schema or Prisma changes
- Additional database queries

---

## 3. Technical Proposal

### 3.1 Data flow (no new queries)

The existing query in `src/app/page.tsx` already fetches all user books with `genres` included. Zero additional database queries are needed.

### 3.2 Genre grouping logic (in `src/app/page.tsx`)

After the existing status grouping, add genre grouping:

```typescript
// After existing status grouping
const booksByGenre = new Map<string, SerializableBook[]>()
for (const book of serializedBooks) {
  for (const genre of book.genres) {
    const normalized = toTitleCase(genre)
    if (!booksByGenre.has(normalized)) booksByGenre.set(normalized, [])
    booksByGenre.get(normalized)!.push(book)
  }
}

const AFFINITY_WEIGHTS: Record<BookStatus, number> = {
  READ: 4,      // finished — strongest signal of real interest
  READING: 3,   // active consumption
  TO_READ: 2,   // real intention
  WISHLIST: 1,  // aspirational
}

function genreAffinityScore(books: SerializableBook[]): number {
  return books.reduce((score, book) =>
    score + (AFFINITY_WEIGHTS[book.status] ?? 1), 0)
}

const MAX_GENRE_RAILS = 6
const genreRails = [...booksByGenre.entries()]
  .sort(([, a], [, b]) => genreAffinityScore(b) - genreAffinityScore(a))
  .slice(0, MAX_GENRE_RAILS)
```

### 3.3 New utility: `toTitleCase`

Add to `src/lib/utils/text.ts` (currently only has `stripHtml`):

```typescript
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase())
}
```

### 3.4 Home page refactor

**Current state:** The home page has inline carousel markup that duplicates what `BookRailSection` already provides (scroll container, fade edges, heading, count badge, empty state).

**Proposed change:** Replace inline markup with `BookRailSection`:

```tsx
{/* Status rails (existing, refactored) */}
{statusEntries.map(([status, books]) => (
  <BookRailSection
    key={status}
    title={formatStatus(status)}
    count={books.length}
  >
    {books.map((book) => (
      <BookCard key={book.id} book={book} variant="shelf" />
    ))}
  </BookRailSection>
))}

{/* Genre rails (new) */}
{genreRails.length > 0 && (
  <div className="space-y-12">
    <h2 className="text-xl font-bold text-on-surface">By Genre</h2>
    {genreRails.map(([genre, books]) => (
      <BookRailSection
        key={genre}
        title={genre}
        count={books.length}
      >
        {books.map((book) => (
          <BookCard key={book.id} book={book} variant="browse" />
        ))}
      </BookRailSection>
    ))}
  </div>
)}
```

**Note on `BookRailSection` interface:** The component accepts `children: ReactNode` (not a `books` prop), plus `title`, `eyebrow?`, `count?`, `emptyTitle?`, `emptyCopy?`, and `className?`. Book cards are passed as children.

---

## 4. Design Decisions

| Decision | Rationale |
|----------|-----------|
| In-memory grouping | Prisma does not support `groupBy` on array columns. The query already returns all data needed. |
| Affinity scoring over raw count | A genre with 10 Wishlist books (score 10) should NOT rank above a genre with 3 Read books (score 12). Weighting by status surfaces genres the user actually reads, not just aspirational ones. |
| MAX 6 genre rails | Prevents excessive vertical scroll. Highest-affinity genres shown first. Configurable constant. |
| Title Case normalization | Google Books API returns genres with inconsistent casing ("fiction", "Fiction", "FICTION"). |
| Genre rails below status rails | Status reflects the user's reading state (primary concern). Genre is discovery/browsing (secondary). |
| `variant="browse"` for genre cards | Genre rails are for browsing/discovery, matching the browse card style. Status rails keep `variant="shelf"`. |
| Adopt `BookRailSection` | Eliminates ~50 lines of duplicated carousel markup in the home page. Single source of truth for rail UI. |
| Books can appear in multiple genre rails | A book tagged "Fiction" and "Mystery" appears in both. This is expected and correct behavior. |

---

## 5. Performance Impact

| Metric | Impact |
|--------|--------|
| Database queries | 0 additional |
| Grouping complexity | O(n * g) where n = books, g = avg genres per book (typically 2-3) |
| Memory | Negligible -- references to existing objects, not copies |
| Render | Additional DOM nodes for genre rails, but capped at 6 sections |
| Network | No additional API calls |

**Verdict:** Negligible performance impact.

---

## 6. Acceptance Criteria

- [ ] Genre rails appear on the home page below the status rails
- [ ] Only genres with at least 1 user book are shown
- [ ] Maximum 6 genre rails, ordered by affinity score descending (READ=4, READING=3, TO_READ=2, WISHLIST=1)
- [ ] Genre strings are normalized to Title Case
- [ ] Home page uses `BookRailSection` for all rails (status and genre), no duplicated carousel markup
- [ ] 0 additional database queries
- [ ] `toTitleCase` utility added to `src/lib/utils/text.ts` with unit tests
- [ ] Unit tests for genre grouping logic
- [ ] TypeScript compiles without errors
- [ ] When a user has no books with genres, the genre section does not render at all

---

## 7. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Genre strings not normalized (mixed casing from Google Books API) | Medium | Apply `toTitleCase` before grouping. Consistent display guaranteed. |
| Page becomes very long with many genres | Medium | Cap at MAX_GENRE_RAILS = 6. Only most popular genres shown. |
| No books have genres populated | Low | Conditionally render genre section. If `genreRails.length === 0`, section is hidden entirely. |
| Same book appears in multiple genre rails | Low (expected) | This is correct behavior. A book in "Fiction" and "Mystery" should appear in both. No mitigation needed. |
| `BookRailSection` refactor breaks existing status rail behavior | Medium | The component is already battle-tested in other pages. Verify scroll, fade edges, and empty states work identically after refactor. |
| `toTitleCase` edge cases (acronyms like "AI", "LGBTQ+") | Low | Simple implementation is acceptable for v1. Acronym handling can be added later if needed. |

---

## 8. Effort Estimate

| Work Area | Estimate |
|-----------|----------|
| `toTitleCase` utility + tests | ~15 min |
| Genre grouping logic + affinity scoring in `page.tsx` | ~25 min |
| Unit tests for affinity scoring | ~15 min |
| Refactor home to use `BookRailSection` | ~30 min |
| Genre rail rendering | ~15 min |
| Unit tests for genre grouping | ~20 min |
| Manual QA and edge cases | ~15 min |
| **Total** | **~2.5 hours** |

---

## 9. Files Affected

| File | Change Type |
|------|-------------|
| `src/app/page.tsx` | Modified -- main change (grouping logic + refactor to use BookRailSection + genre rails) |
| `src/lib/utils/text.ts` | Modified -- add `toTitleCase` function |
| `src/lib/utils/__tests__/text.test.ts` | Modified -- add tests for `toTitleCase` |
| New test file for genre grouping | Created -- unit tests for grouping logic |

---

## 10. Next Recommended Phase

`sdd-spec` -- Write detailed specification with exact interfaces, edge cases, and test scenarios.

---

## 11. Future: Sistema de Recomendaciones

Esta feature es el primer paso hacia un sistema de recomendaciones personalizado.

### En el home (v1 -- esta propuesta)
Genre rails ordenados por affinity score -- senal implicita de gusto real basada en comportamiento de lectura.

### En el home (v2 -- post-auth)
Cuando existan multiples usuarios, el affinity score puede calcularse por usuario. La seccion "Para ti" podria mostrar generos y autores basados en historial combinado (si es biblioteca compartida).

### En el search (v2 -- post-auth)
El search podria ordenar resultados de Google Books segun:
- Afinidad de genero del usuario (generos con alto affinity score primero)
- Autores previamente leidos (boost en ranking)
- Rating promedio del usuario por categoria

Inputs necesarios para v2:
- Sistema de usuarios / auth
- Historial de lectura por usuario
- Ratings explicitos (ya existe `rating` en el schema)
- Suficiente volumen de datos

Esta direccion NO requiere ML ni sistemas complejos en v1 -- un scoring heuristico simple es suficiente para personalizacion basica.
