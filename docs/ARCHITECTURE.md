# Architecture — Rollorian Books

A personal book tracking app built on Next.js 16 with App Router, Prisma ORM connected to a Neon serverless Postgres database, and the Google Books API as the discovery layer.

---

## 1. Stack and Technical Decisions

### Next.js 16 — App Router

All pages live under `src/app/` and are Server Components by default. This means database queries run at the edge without an intermediate API call, and only the interactive leaf nodes are marked `"use client"`. The app uses the `params`-as-`Promise` pattern required by the App Router in this version (e.g., `const { id } = await params`).

The React Compiler is enabled via `reactCompiler: true` in `next.config.ts` and the `babel-plugin-react-compiler` dev dependency. This allows the compiler to automatically memoize components and hooks, so `useMemo`/`useCallback` are avoided throughout the codebase.

### Prisma 7 + Neon (serverless Postgres)

The database driver is `@prisma/adapter-pg` wrapping a standard `pg` connection pool. Neon provides serverless Postgres with connection pooling via PgBouncer, which is why the adapter is used instead of the default Prisma driver — standard TCP connections don't survive the cold-start lifecycle of serverless functions.

The Prisma client is a singleton stored on `globalThis` in development to avoid exhausting connection limits across hot reloads (`src/lib/prisma.ts`). In production a new client is created once per process.

Prisma 7 with driver adapters does not reliably export model types (`Book`) from `@prisma/client` on all platforms. For this reason, the `Book` interface and `BookStatus` constant are manually defined in `src/lib/types/book.ts` and must be kept in sync with `prisma/schema.prisma`.

### React 19

Using the latest stable React. The React Compiler works with React 19's automatic batching and transition APIs. No `useTransition` wrappers are needed in most places since the compiler handles re-render optimization.

### Tailwind CSS 4

Uses the v4 PostCSS plugin (`@tailwindcss/postcss`). CSS custom properties (design tokens) are used extensively instead of Tailwind utility classes for color tokens (`--color-surface`, `--color-primary`, etc.), which are set in `src/app/globals.css`. Tailwind utilities handle layout, spacing, and typography.

The `cn` utility in `src/lib/cn.ts` combines `clsx` + `tailwind-merge` for conditional class composition.

### Zod 4

Validation schemas live in `src/lib/schemas/book.ts`. Zod 4 uses the `{ error: "..." }` syntax instead of `{ message: "..." }` for custom messages.

---

## 2. Directory Structure

```
src/
  app/            Next.js App Router. Every file here is a route segment.
                  Server Components by default. Handles routing, metadata,
                  loading states, and error boundaries.

  features/       Domain-scoped logic and components. Code here knows about
                  business concepts (books, library, search). Never imported
                  by lib/.

    books/        The books feature domain.
      components/ All UI components for book rendering and interaction.
      types.ts    Feature-local types: GoogleBookView, SerializableBook,
                  serializeBook(). Owns the Server→Client serialization
                  contract.

    search/       Search feature components (form and results grid).
      components/

    shared/       Cross-feature UI primitives. Components here have no
                  domain knowledge — they accept plain props.
      components/ Atoms: Badge, Button, EmptyState, Skeleton, BlurredBackground, StatPill.
      ui/         Layout shells: AppShell, SiteHeader, NavLinks, BookRailSection, PageBackdrop.

  lib/            Cross-cutting utilities. No React, no domain logic.
                  Imported by both app/ and features/.

    api/          Client-side API service layer. The only place that calls
                  fetch() against internal routes. Exports saveBook(),
                  updateBook(), deleteBook(), and ApiError.

    google-books/ Integration with the Google Books REST API.
      client.ts   HTTP client (server-only). fetchBooks() and fetchBookById().
      normalize.ts Maps raw GoogleBooksVolume to NormalizedBook.
      strategy.ts Query analysis and result ranking. Pure functions, no I/O.
      types.ts    Raw Google Books API types and NormalizedBook.

    prisma.ts     Singleton PrismaClient. Only file that instantiates Prisma.

    schemas/      Zod validation schemas. createBookSchema, updateBookSchema,
                  searchQuerySchema. Shared between API routes and the client
                  API layer.

    types/        Canonical TypeScript types. book.ts defines Book, BookStatus,
                  BOOK_STATUS_VALUES, BOOK_STATUS_LABELS, BOOK_STATUS_OPTIONS.

    utils/        Pure utility functions. text.ts exports stripHtml().
    cn.ts         clsx + tailwind-merge composition helper.

  test/
    setup.ts      Vitest global setup. Mocks `server-only` so server modules
                  can be imported in the test environment.
```

---

## 3. Data Flow

### Flow A — Search and Save

```
User types a query
  → search/page.tsx ("use client") calls fetch("/api/search/books?q=...")
  → src/app/api/search/books/route.ts (Server, server-only)
      → analyzeQuery() in lib/google-books/strategy.ts  (query classification)
      → fetchBooks() in lib/google-books/client.ts       (Google Books HTTP)
      → normalizeSearchResults() in lib/google-books/normalize.ts
      → rankSearchResults() in lib/google-books/strategy.ts
      → returns NormalizedBook[]
  → search/page.tsx renders BookCard components

User clicks Save on a result
  → saveBookToLibrary() calls saveBook() from lib/api/books.ts
  → saveBook() POSTs to /api/books
  → src/app/api/books/route.ts validates with createBookSchema (Zod)
  → prisma.book.create()
  → returns the created Book
```

### Flow B — Book Detail Page

The `/books/[id]` page implements a dual-source resolution strategy:

```
URL /books/[id]
  → src/app/books/[id]/page.tsx (Server Component, cached with React cache())
  → resolveBook(id):
      1. prisma.book.findUnique({ where: { id } })
         If found → { source: "local", book: Book }
         If not found or invalid ID format → fall through
      2. fetchBookById(id) via Google Books API
         If found → GoogleBookView via googleVolumeToView()
         If not found → null → notFound()

If source === "local":
  → renders LocalBookDetail (Server Component)
    → serializes Book to SerializableBook (Dates → ISO strings)
    → renders BookDetailClient ("use client") for editable state/rating/notes

If source === "google":
  → renders GoogleBookDetail (Server Component)
    → renders GoogleBookSaveClient ("use client") with save button
    → on save: POST /api/books → redirect to /books/{new-local-id}
```

The `cache()` wrapper on `resolveBook` deduplicates the data fetch between `generateMetadata` and the page component, which both call it with the same ID within a single request.

---

## 4. Server Components vs Client Components

### Default: Server Component

Everything without `"use client"` is a Server Component. This covers all page files (`app/*/page.tsx`), layout files, and most components in `features/books/components/` and `features/shared/`.

Server Components run on the server only: they can query Prisma directly, read environment variables, and import `server-only` modules. They produce zero JavaScript bundle impact.

### When "use client" is used

A component is marked `"use client"` when it requires browser APIs, React state, effects, or event handlers.

| File | Why it's a Client Component |
|---|---|
| `src/app/search/page.tsx` | Manages search state, `useState`, form events, `fetch` calls |
| `src/app/error.tsx` | Uses `useEffect` to receive error boundaries |
| `src/features/books/components/book-card.tsx` | `useState` for save animation, event handlers on cards |
| `src/features/books/components/book-detail-client.tsx` | Editable status/rating/notes form, `useRouter` for refresh/redirect after PATCH/DELETE |
| `src/features/books/components/google-book-save-client.tsx` | Save button with async state, `useRouter` redirect after POST |
| `src/features/books/components/library-book-card.tsx` | Inline status dropdown with `onChange` handler |
| `src/features/shared/ui/book-rail-section.tsx` | Horizontal scroll with overflow control |
| `src/features/search/components/search-form.tsx` | Controlled input, form submission |
| `src/features/search/components/search-results-grid.tsx` | Renders search results with save callbacks |

The pattern is: Server Components fetch and prepare data, then pass serialized props down to Client Components at the leaf level.

---

## 5. API Layer

`src/lib/api/books.ts` is the client-side service layer. It centralizes all `fetch()` calls from browser code to internal Next.js API routes. Components do not call `fetch()` directly except in `search/page.tsx` (which predates the API layer introduction).

### Functions

| Function | HTTP | Route |
|---|---|---|
| `saveBook(data: CreateBookInput)` | POST | `/api/books` |
| `updateBook(id, data: UpdateBookInput)` | PATCH | `/api/books/[id]` |
| `deleteBook(id)` | DELETE | `/api/books/[id]` |

All three go through the internal `apiFetch<T>()` helper, which:
- Throws `ApiError` (with `status` and `message`) on non-OK responses
- Handles `204 No Content` by returning `undefined`
- Parses the error body from `{ error: string }` JSON shape

### ApiError

```ts
export class ApiError extends Error {
  constructor(public readonly status: number, message: string)
}
```

Client Components catch `ApiError` to display user-facing error messages. The `status` field allows callers to distinguish 404 from 500 if needed.

### API Routes

| Route | Methods | Purpose |
|---|---|---|
| `src/app/api/books/route.ts` | GET, POST | List books (with optional `?status=` and `?q=` filters); create book |
| `src/app/api/books/[id]/route.ts` | GET, PATCH, DELETE | Get, update, or delete a single book |
| `src/app/api/search/books/route.ts` | GET | Proxy Google Books search with normalization and ranking |
| `src/app/api/health/route.ts` | GET | Health check endpoint |

All API route files start with `import "server-only"` to prevent accidental client-side bundling.

---

## 6. Validation and Types

### The Type Stack

```
prisma/schema.prisma
  ↓ (manually mirrored)
src/lib/types/book.ts        → Book interface, BookStatus const + type
  ↓ (imported by)
src/lib/schemas/book.ts      → Zod schemas (createBookSchema, updateBookSchema)
  ↓ (inferred types)
CreateBookInput, UpdateBookInput  → used by lib/api/books.ts and API routes
```

### Why BookStatus Is Defined Twice

Prisma generates a `BookStatus` enum in `@prisma/client`. However, Prisma 7 with driver adapters doesn't reliably export it on all platforms. The TypeScript definition in `src/lib/types/book.ts` uses a `const` object pattern (`as const`) to produce both a runtime value and a type:

```ts
export const BookStatus = { WISHLIST: "WISHLIST", ... } as const;
export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];
```

This is intentional. The Prisma enum exists in the schema; the TypeScript constant exists for application code. They must stay in sync.

### SerializableBook

`Book` (from `lib/types/book.ts`) has `createdAt: Date` and `updatedAt: Date`. React Server Components cannot pass `Date` objects as props to Client Components — they are not serializable across the RSC boundary.

`SerializableBook` in `src/features/books/types.ts` replaces both date fields with `string` (ISO format). The `serializeBook(book: Book): SerializableBook` function performs the conversion before any Server→Client prop boundary.

---

## 7. Project Conventions

### Naming

- **Files**: kebab-case (`book-detail-client.tsx`, `local-book-detail.tsx`)
- **Components**: PascalCase named exports (`export function BookDetailClient`)
- **Pages**: default exports (`export default async function LibraryPage`)
- **Constants**: SCREAMING_SNAKE_CASE (`BOOK_STATUS_VALUES`, `STATUS_ORDERED`)
- **Types/Interfaces**: PascalCase (`SerializableBook`, `GoogleBookView`)
- **Functions**: camelCase (`resolveBook`, `serializeBook`, `analyzeQuery`)

### Imports

- Path alias `@/` resolves to `src/`. Always used for cross-directory imports.
- Order: external packages → `@/lib` → `@/features` → relative siblings.
- Named imports preferred. Default imports only for Next.js page/layout conventions.

### Exports

- Components: named exports (`export function Foo`), no default exports in component files.
- Pages and layouts: default exports (required by Next.js App Router).
- Types: named exports from the canonical type files.

### Server vs Client Split Decision Rule

Use a Server Component unless the component needs:
1. `useState` or `useReducer`
2. `useEffect` or `useRef` for DOM interaction
3. Browser event handlers (`onClick`, `onChange`, `onSubmit`)
4. `useRouter` or other client-side navigation hooks

If only some of a large component needs client behavior, extract the interactive part into a dedicated `*-client.tsx` file and keep the parent as a Server Component (pattern used in `LocalBookDetail` → `BookDetailClient`).

---

## 8. Tests

### Stack

- **Test runner**: Vitest 4
- **Environment**: `node` (not jsdom — the project tests pure logic, not DOM rendering)
- **Setup**: `src/test/setup.ts` mocks `server-only` globally so modules with that guard can be imported in tests

### Location

Tests live co-located with source in `__tests__/` subdirectories:

```
src/lib/api/__tests__/books.test.ts
src/lib/google-books/__tests__/client.test.ts
src/lib/google-books/__tests__/normalize.test.ts
src/lib/google-books/__tests__/strategy.test.ts
src/lib/schemas/__tests__/book.test.ts
src/lib/types/__tests__/book.test.ts
src/lib/utils/__tests__/text.test.ts
src/app/api/books/__tests__/route.test.ts
```

### What Is Tested

- **`lib/google-books/strategy.ts`**: query analysis (ISBN detection, title-author parsing, text fallback) and result ranking logic. Pure functions — no mocking required.
- **`lib/google-books/normalize.ts`**: `normalizeSearchResults` and `normalizeSingleBook` with representative Google Books API payloads.
- **`lib/google-books/client.ts`**: `fetchBooks` and `fetchBookById` with mocked `fetch`.
- **`lib/schemas/book.ts`**: Zod schema validation for valid and invalid inputs.
- **`lib/types/book.ts`**: `BOOK_STATUS_VALUES` completeness and `BOOK_STATUS_LABELS` coverage.
- **`lib/api/books.ts`**: `saveBook`, `updateBook`, `deleteBook` with mocked `fetch`, including error cases and `ApiError` propagation.
- **`app/api/books/route.ts`**: Route handler GET and POST with mocked Prisma.
- **`lib/utils/text.ts`**: `stripHtml` edge cases.

### What Is Not Tested

- React components (no jsdom, no `@testing-library/react` test files present)
- Prisma queries directly against a database (integration tests not configured)
- End-to-end flows (no Playwright setup)

### Running Tests

```bash
npm run test          # watch mode
npm run test:run      # single run (CI)
npm run test:coverage # coverage report
```

---

## 9. Environment Variables

```
DATABASE_URL=          # Neon Postgres connection string (pooled)
GOOGLE_BOOKS_API_KEY=  # Google Books API v1 key (optional — works without it, rate limited)
```

Both variables are read at runtime via `process.env["DATABASE_URL"]` and `process.env["GOOGLE_BOOKS_API_KEY"]`. For local development, place them in `.env.local`. Neither should ever be committed.

`DATABASE_URL` is required — the Prisma client throws on startup if it is missing. `GOOGLE_BOOKS_API_KEY` is optional; the Google Books API works unauthenticated at reduced rate limits.
