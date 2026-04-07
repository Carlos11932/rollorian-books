import { describe, expect, it, vi, beforeEach } from "vitest";
import { rankTitleCandidate, resolveUserBookByReference } from "@/lib/donna/resolve";
import type { SelectedUserBook } from "@/lib/donna/normalize";
import type { DonnaBookRef } from "@/lib/donna/contracts";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the mocked modules
// ---------------------------------------------------------------------------

const { prismaMock, getDonnaStateMapMock } = vi.hoisted(() => ({
  prismaMock: {
    userBook: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  getDonnaStateMapMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

// Mock normalize so we can control getDonnaStateMap without hitting Prisma
vi.mock("@/lib/donna/normalize", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getDonnaStateMap: getDonnaStateMapMock,
  };
});

// ---------------------------------------------------------------------------
// Minimal candidate factory
// ---------------------------------------------------------------------------

function makeCandidate(
  title: string,
  authors: string[] = [],
  bookId = "book-001",
): SelectedUserBook {
  return {
    id: "ub-001",
    userId: "user-001",
    bookId,
    status: "TO_READ",
    rating: null,
    notes: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    book: {
      id: bookId,
      title,
      subtitle: null,
      authors,
      description: null,
      coverUrl: null,
      publisher: null,
      publishedDate: null,
      pageCount: null,
      isbn10: null,
      isbn13: null,
      genres: [],
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
  } as unknown as SelectedUserBook;
}

function makeRef(overrides: Partial<DonnaBookRef>): DonnaBookRef {
  return { title: "dune", ...overrides } as DonnaBookRef;
}

// ---------------------------------------------------------------------------
// rankTitleCandidate
// ---------------------------------------------------------------------------

describe("rankTitleCandidate", () => {
  describe("title scoring", () => {
    it("scores +50 for an exact (case-insensitive) title match", () => {
      const candidate = makeCandidate("Dune");
      const ref = makeRef({ title: "Dune" });
      const score = rankTitleCandidate(candidate, ref, new Set());
      expect(score).toBeGreaterThanOrEqual(50);
    });

    it("scores +25 for a substring title match", () => {
      const candidate = makeCandidate("Dune Messiah");
      const ref = makeRef({ title: "Dune" });
      const score = rankTitleCandidate(candidate, ref, new Set());
      // exact match is 50, substring is 25 — only the substring branch applies here
      expect(score).toBeGreaterThanOrEqual(25);
      expect(score).toBeLessThan(50);
    });

    it("scores 0 for a title that neither matches nor contains the ref", () => {
      const candidate = makeCandidate("Foundation");
      const ref = makeRef({ title: "Dune" });
      const score = rankTitleCandidate(candidate, ref, new Set());
      expect(score).toBe(0);
    });
  });

  describe("author scoring", () => {
    it("scores +20 per matching author", () => {
      const candidate = makeCandidate("Foundation", ["Isaac Asimov"]);
      const ref = makeRef({ title: "Foundation", authors: ["Isaac Asimov"] });
      const score = rankTitleCandidate(candidate, ref, new Set());
      // 50 (exact title) + 20 (matching author)
      expect(score).toBe(70);
    });

    it("adds +20 for each matching author when there are multiple", () => {
      const candidate = makeCandidate("Good Omens", ["Neil Gaiman", "Terry Pratchett"]);
      const ref = makeRef({ title: "Good Omens", authors: ["Neil Gaiman", "Terry Pratchett"] });
      const score = rankTitleCandidate(candidate, ref, new Set());
      // 50 (exact title) + 20 + 20 (both authors match)
      expect(score).toBe(90);
    });

    it("does not add author score when ref has no authors", () => {
      const candidate = makeCandidate("Dune", ["Frank Herbert"]);
      const ref = makeRef({ title: "Dune", authors: undefined });
      const score = rankTitleCandidate(candidate, ref, new Set());
      expect(score).toBe(50); // only title score
    });

    it("is case-insensitive for author matching", () => {
      const candidate = makeCandidate("Dune", ["FRANK HERBERT"]);
      const ref = makeRef({ title: "Dune", authors: ["frank herbert"] });
      const score = rankTitleCandidate(candidate, ref, new Set());
      expect(score).toBe(70); // 50 title + 20 author
    });
  });

  describe("ownership bonus", () => {
    it("adds +15 when the book id is in the ownedBookIds set", () => {
      const candidate = makeCandidate("Dune", [], "book-owned");
      const ref = makeRef({ title: "Dune" });
      const score = rankTitleCandidate(candidate, ref, new Set(["book-owned"]));
      expect(score).toBe(65); // 50 title + 15 ownership
    });

    it("does not add ownership bonus when id is NOT in the set", () => {
      const candidate = makeCandidate("Dune", [], "book-001");
      const ref = makeRef({ title: "Dune" });
      const score = rankTitleCandidate(candidate, ref, new Set(["book-other"]));
      expect(score).toBe(50); // only title
    });
  });

  describe("edge cases", () => {
    it("returns 0 when ref has no title and no authors and book is not owned", () => {
      const candidate = makeCandidate("Dune");
      // No title in ref → refTitle = ""
      const ref = { title: undefined, authors: undefined } as unknown as DonnaBookRef;
      const score = rankTitleCandidate(candidate, ref, new Set());
      expect(score).toBe(0);
    });

    it("combined score: exact title + author + ownership", () => {
      const candidate = makeCandidate("Dune", ["Frank Herbert"], "book-xyz");
      const ref = makeRef({ title: "Dune", authors: ["Frank Herbert"] });
      const score = rankTitleCandidate(candidate, ref, new Set(["book-xyz"]));
      expect(score).toBe(85); // 50 + 20 + 15
    });
  });
});

// ---------------------------------------------------------------------------
// resolveUserBookByReference — decision logic / integration
// ---------------------------------------------------------------------------

describe("resolveUserBookByReference", () => {
  const userId = "user-001";

  // A minimal SelectedUserBook as returned by Prisma
  function makeDbEntry(
    overrides: Partial<{
      bookId: string;
      title: string;
      status: string;
      authors: string[];
    }> = {},
  ): SelectedUserBook {
    const bookId = overrides.bookId ?? "book-001";
    return {
      id: "ub-001",
      userId,
      bookId,
      status: overrides.status ?? "TO_READ",
      rating: null,
      notes: null,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      book: {
        id: bookId,
        title: overrides.title ?? "Dune",
        subtitle: null,
        authors: overrides.authors ?? ["Frank Herbert"],
        description: null,
        coverUrl: null,
        publisher: null,
        publishedDate: null,
        pageCount: null,
        isbn10: null,
        isbn13: null,
        genres: [],
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      },
    } as unknown as SelectedUserBook;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: state map returns empty (no DonnaBookState rows)
    getDonnaStateMapMock.mockResolvedValue(new Map());
  });

  describe("lookup by bookId", () => {
    it("returns exact match when the book is found by bookId", async () => {
      const entry = makeDbEntry({ bookId: "book-abc" });
      prismaMock.userBook.findUnique.mockResolvedValueOnce(entry);

      const result = await resolveUserBookByReference(userId, { bookId: "book-abc" });

      expect(result.matchStatus).toBe("exact");
      expect(result.matchedBook).not.toBeNull();
      expect(result.matchedBook?.book.id).toBe("book-abc");
      expect(result.suggestions).toHaveLength(0);
    });

    it("returns none when bookId resolves to no row", async () => {
      prismaMock.userBook.findUnique.mockResolvedValueOnce(null);

      const result = await resolveUserBookByReference(userId, { bookId: "book-missing" });

      expect(result.matchStatus).toBe("none");
      expect(result.matchedBook).toBeNull();
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe("lookup by ISBN", () => {
    it("returns exact match when the book is found by isbn13", async () => {
      const entry = makeDbEntry({ bookId: "book-isbn13" });
      prismaMock.userBook.findFirst.mockResolvedValueOnce(entry);

      const result = await resolveUserBookByReference(userId, { isbn13: "9780441013593" });

      expect(result.matchStatus).toBe("exact");
      expect(result.matchedBook?.book.id).toBe("book-isbn13");
      expect(result.suggestions).toHaveLength(0);
    });

    it("returns exact match when the book is found by isbn10", async () => {
      const entry = makeDbEntry({ bookId: "book-isbn10" });
      prismaMock.userBook.findFirst.mockResolvedValueOnce(entry);

      const result = await resolveUserBookByReference(userId, { isbn10: "0441013597" });

      expect(result.matchStatus).toBe("exact");
      expect(result.matchedBook?.book.id).toBe("book-isbn10");
    });

    it("returns none when no book matches the ISBN", async () => {
      prismaMock.userBook.findFirst.mockResolvedValueOnce(null);

      const result = await resolveUserBookByReference(userId, { isbn13: "0000000000000" });

      expect(result.matchStatus).toBe("none");
      expect(result.matchedBook).toBeNull();
    });
  });

  describe("lookup by title", () => {
    it("returns strong match when top candidate scores ≥ 50 with clear lead (score 50, no second)", async () => {
      // Single candidate: exact title match → score 50, no second candidate
      const entry = makeDbEntry({ title: "Dune" });
      prismaMock.userBook.findMany.mockResolvedValueOnce([entry]);

      const result = await resolveUserBookByReference(userId, { title: "Dune" });

      expect(result.matchStatus).toBe("strong");
      expect(result.matchedBook).not.toBeNull();
    });

    it("returns exact when top candidate scores ≥ 70 (title + author match = 70)", async () => {
      // Exact title (50) + matching author (20) = 70 → should be "exact"
      const entry = makeDbEntry({ title: "Dune", authors: ["Frank Herbert"] });
      prismaMock.userBook.findMany.mockResolvedValueOnce([entry]);

      const result = await resolveUserBookByReference(userId, { title: "Dune", authors: ["Frank Herbert"] });

      expect(result.matchStatus).toBe("exact");
      expect(result.matchedBook).not.toBeNull();
    });

    it("returns ambiguous when top candidate leads but two scores are within 20 points", async () => {
      // Two candidates with equal score → ambiguous
      const entry1 = makeDbEntry({ bookId: "book-001", title: "Dune" });
      const entry2 = makeDbEntry({ bookId: "book-002", title: "Dune Messiah" });
      prismaMock.userBook.findMany.mockResolvedValueOnce([entry1, entry2]);

      // Both get ownership bonus since they are in the candidates list (ownedIds = candidates' bookIds)
      // entry1: exact title "dune" = 50 + ownership 15 = 65
      // entry2: substring "dune" = 25 + ownership 15 = 40
      // diff = 25 which IS >= 20 but title "Dune Messiah" only contains "Dune" → 25+15=40
      // 65 - 40 = 25 >= 20 → strong, not ambiguous
      // To force ambiguous, use two entries with the same score
      const entry3 = makeDbEntry({ bookId: "book-003", title: "Dune" });
      const entry4 = makeDbEntry({ bookId: "book-004", title: "Dune" });
      prismaMock.userBook.findMany.mockReset();
      prismaMock.userBook.findMany.mockResolvedValueOnce([entry3, entry4]);

      const result = await resolveUserBookByReference(userId, { title: "Dune" });

      // Both score identically (50 title + 15 ownership = 65), diff = 0 < 20 → ambiguous
      expect(result.matchStatus).toBe("ambiguous");
      expect(result.matchedBook).toBeNull();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it("returns none when no candidates are found", async () => {
      prismaMock.userBook.findMany.mockResolvedValueOnce([]);

      const result = await resolveUserBookByReference(userId, { title: "Unknown Book XYZ" });

      expect(result.matchStatus).toBe("none");
      expect(result.matchedBook).toBeNull();
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe("insufficient reference payload", () => {
    it("returns none when ref has no bookId, no ISBN, and no title", async () => {
      // The code checks: if (!ref.title) return none
      // A ref with only authors (no bookId/isbn/title) falls through to the title check
      const result = await resolveUserBookByReference(userId, { title: undefined } as unknown as DonnaBookRef);

      expect(result.matchStatus).toBe("none");
      expect(result.matchedBook).toBeNull();
      expect(result.suggestions).toHaveLength(0);
      // No DB calls should have been made
      expect(prismaMock.userBook.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.userBook.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.userBook.findMany).not.toHaveBeenCalled();
    });
  });
});
