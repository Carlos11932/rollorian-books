import { describe, it, expect } from "vitest"
import type { LibraryEntryView } from "@/features/books/types"
import {
  groupBooksByGenre,
  genreAffinityScore,
  topGenreRails,
  MAX_GENRE_RAILS,
  AFFINITY_WEIGHTS,
} from "@/lib/utils/books"

// --- Test helper ---

function makeBook(
  overrides: Partial<LibraryEntryView> & { status: LibraryEntryView["status"] },
): LibraryEntryView {
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
    ownershipStatus: "UNKNOWN",
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

  it("creates one entry for a single book with a single genre", () => {
    const books = [makeBook({ status: "READ", genres: ["Fantasy"] })]
    const result = groupBooksByGenre(books)
    expect(result.size).toBe(1)
    expect(result.get("Fantasy")).toHaveLength(1)
  })

  it("groups books by normalized genre name (merges different casings)", () => {
    const books = [
      makeBook({ status: "READ", genres: ["fiction"] }),
      makeBook({ status: "READ", genres: ["Fiction"] }),
      makeBook({ status: "READ", genres: ["FICTION"] }),
    ]
    const result = groupBooksByGenre(books)
    expect(result.size).toBe(1)
    expect(result.get("Fiction")).toHaveLength(3)
  })

  it("places a book with multiple genres in each group", () => {
    const book = makeBook({ status: "READ", genres: ["Fiction", "Mystery"] })
    const result = groupBooksByGenre([book])
    expect(result.size).toBe(2)
    expect(result.get("Fiction")).toContain(book)
    expect(result.get("Mystery")).toContain(book)
  })

  it("skips empty genre strings", () => {
    const books = [makeBook({ status: "READ", genres: ["", "Fantasy"] })]
    const result = groupBooksByGenre(books)
    expect(result.size).toBe(1)
    expect(result.has("Fantasy")).toBe(true)
    expect(result.has("")).toBe(false)
  })

  it("skips whitespace-only genre strings", () => {
    const books = [makeBook({ status: "READ", genres: ["   ", "Thriller"] })]
    const result = groupBooksByGenre(books)
    expect(result.size).toBe(1)
    expect(result.has("Thriller")).toBe(true)
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

  it("READ book scores 4", () => {
    expect(genreAffinityScore([makeBook({ status: "READ" })])).toBe(4)
  })

  it("READING book scores 3", () => {
    expect(genreAffinityScore([makeBook({ status: "READING" })])).toBe(3)
  })

  it("TO_READ book scores 2", () => {
    expect(genreAffinityScore([makeBook({ status: "TO_READ" })])).toBe(2)
  })

  it("WISHLIST book scores 1", () => {
    expect(genreAffinityScore([makeBook({ status: "WISHLIST" })])).toBe(1)
  })

  it("scores READ higher than WISHLIST", () => {
    const readBooks = [makeBook({ status: "READ" })]
    const wishlistBooks = [makeBook({ status: "WISHLIST" })]
    expect(genreAffinityScore(readBooks)).toBeGreaterThan(
      genreAffinityScore(wishlistBooks),
    )
  })

  it("accumulates mixed statuses correctly (READ+READING+WISHLIST = 8)", () => {
    const books = [
      makeBook({ status: "READ" }),     // 4
      makeBook({ status: "READING" }),  // 3
      makeBook({ status: "WISHLIST" }), // 1
    ]
    expect(genreAffinityScore(books)).toBe(8)
  })

  it("uses correct weight values per AFFINITY_WEIGHTS", () => {
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

  it("returns all genres when fewer than MAX_GENRE_RAILS", () => {
    const books = [
      makeBook({ status: "READ", genres: ["Fantasy"] }),
      makeBook({ status: "READ", genres: ["Mystery"] }),
      makeBook({ status: "READ", genres: ["Thriller"] }),
    ]
    const rails = topGenreRails(books)
    expect(rails.length).toBe(3)
  })

  it("caps results at MAX_GENRE_RAILS (6) when more genres exist", () => {
    const genres = Array.from({ length: 10 }, (_, i) => `Genre ${i}`)
    const books = genres.map(g => makeBook({ status: "READ", genres: [g] }))
    const rails = topGenreRails(books)
    expect(rails.length).toBe(MAX_GENRE_RAILS)
    expect(rails.length).toBe(6)
  })

  it("respects a custom maxRails parameter", () => {
    const books = [
      makeBook({ status: "READ", genres: ["A", "B", "C"] }),
    ]
    expect(topGenreRails(books, 2).length).toBe(2)
  })

  it("sorts genres by affinity score descending", () => {
    const books = [
      makeBook({ status: "WISHLIST", genres: ["Romance"] }),        // score 1
      makeBook({ status: "READ", genres: ["Mystery"] }),            // score 4
      makeBook({ status: "READING", genres: ["Science Fiction"] }), // score 3
    ]
    const rails = topGenreRails(books)
    expect(rails.map(([genre]) => genre)).toEqual([
      "Mystery",
      "Science Fiction",
      "Romance",
    ])
  })

  it("genre with fewer READ books outranks genre with many WISHLIST books", () => {
    const books = [
      // Fantasy: 3 READ = score 12
      makeBook({ status: "READ", genres: ["Fantasy"] }),
      makeBook({ status: "READ", genres: ["Fantasy"] }),
      makeBook({ status: "READ", genres: ["Fantasy"] }),
      // Thriller: 10 WISHLIST = score 10
      ...Array.from({ length: 10 }, () =>
        makeBook({ status: "WISHLIST", genres: ["Thriller"] }),
      ),
    ]
    const rails = topGenreRails(books)
    const [firstGenre] = rails[0] ?? []
    const [secondGenre] = rails[1] ?? []
    expect(firstGenre).toBe("Fantasy")
    expect(secondGenre).toBe("Thriller")
  })
})
