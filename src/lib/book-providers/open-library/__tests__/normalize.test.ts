import { describe, it, expect } from "vitest";
import { normalizeOpenLibraryResults } from "@/lib/book-providers/open-library/normalize";
import type { OpenLibraryDoc } from "@/lib/book-providers/open-library/types";

function makeDoc(overrides: Partial<OpenLibraryDoc> = {}): OpenLibraryDoc {
  return {
    key: "/works/OL123W",
    title: "Default Title",
    author_name: ["Default Author"],
    ...overrides,
  };
}

describe("normalizeOpenLibraryResults", () => {
  it("returns an empty array when given an empty array", () => {
    expect(normalizeOpenLibraryResults([])).toEqual([]);
  });

  it("normalizes a single doc correctly", () => {
    const doc = makeDoc({
      key: "/works/OL456W",
      title: "Clean Architecture",
      author_name: ["Robert C. Martin"],
      first_publish_year: 2017,
      isbn: ["9780134494166", "0134494164"],
      cover_i: 8_091_016,
      publisher: ["Prentice Hall"],
      number_of_pages_median: 432,
      subject: ["Software architecture", "Computer programming", "Clean code"],
      subtitle: "A Craftsman's Guide",
    });

    const [result] = normalizeOpenLibraryResults([doc]);

    expect(result).toBeDefined();
    expect(result!.externalSource).toBe("open_library");
    expect(result!.externalId).toBe("/works/OL456W");
    expect(result!.title).toBe("Clean Architecture");
    expect(result!.authors).toEqual(["Robert C. Martin"]);
    expect(result!.publishedYear).toBe(2017);
    expect(result!.isbn).toBe("9780134494166");
    expect(result!.coverUrl).toBe("https://covers.openlibrary.org/b/id/8091016-L.jpg");
    expect(result!.publisher).toBe("Prentice Hall");
    expect(result!.pageCount).toBe(432);
    expect(result!.genres).toEqual(["Software architecture", "Computer programming", "Clean code"]);
    expect(result!.subtitle).toBe("A Craftsman's Guide");
  });

  it("prefers ISBN-13 over ISBN-10", () => {
    const doc = makeDoc({
      isbn: ["0134494164", "9780134494166"],
    });

    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.isbn).toBe("9780134494166");
  });

  it("falls back to ISBN-10 when no ISBN-13 is available", () => {
    const doc = makeDoc({
      isbn: ["0134494164"],
    });

    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.isbn).toBe("0134494164");
  });

  it("returns null isbn when isbn array is empty", () => {
    const doc = makeDoc({ isbn: [] });
    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.isbn).toBeNull();
  });

  it("returns null isbn when isbn field is undefined", () => {
    const doc = makeDoc({ isbn: undefined });
    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.isbn).toBeNull();
  });

  it("uses cover_i-based URL when cover_i is available", () => {
    const doc = makeDoc({ cover_i: 12345 });
    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.coverUrl).toBe("https://covers.openlibrary.org/b/id/12345-L.jpg");
  });

  it("falls back to ISBN-based cover URL when cover_i is absent", () => {
    const doc = makeDoc({
      cover_i: undefined,
      isbn: ["9780134494166"],
    });

    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.coverUrl).toBe("https://covers.openlibrary.org/b/isbn/9780134494166-L.jpg");
  });

  it("returns null coverUrl when neither cover_i nor isbn is available", () => {
    const doc = makeDoc({
      cover_i: undefined,
      isbn: undefined,
    });

    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.coverUrl).toBeNull();
  });

  it("skips docs without a title", () => {
    const docs = [
      makeDoc({ title: "" }),
      makeDoc({ title: "Valid Book" }),
    ];

    const results = normalizeOpenLibraryResults(docs);
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Valid Book");
  });

  it("returns empty authors array when author_name is undefined", () => {
    const doc = makeDoc({ author_name: undefined });
    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.authors).toEqual([]);
  });

  it("returns null publishedYear when first_publish_year is undefined", () => {
    const doc = makeDoc({ first_publish_year: undefined });
    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.publishedYear).toBeNull();
  });

  it("limits genres to 5 entries", () => {
    const doc = makeDoc({
      subject: ["A", "B", "C", "D", "E", "F", "G", "H"],
    });

    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.genres).toHaveLength(5);
    expect(result!.genres).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("handles missing optional fields gracefully", () => {
    const doc = makeDoc({
      key: "/works/OL999W",
      title: "Minimal Book",
      author_name: undefined,
      first_publish_year: undefined,
      isbn: undefined,
      cover_i: undefined,
      publisher: undefined,
      number_of_pages_median: undefined,
      subject: undefined,
      subtitle: undefined,
    });

    const [result] = normalizeOpenLibraryResults([doc]);

    expect(result).toBeDefined();
    expect(result!.externalSource).toBe("open_library");
    expect(result!.externalId).toBe("/works/OL999W");
    expect(result!.title).toBe("Minimal Book");
    expect(result!.authors).toEqual([]);
    expect(result!.publishedYear).toBeNull();
    expect(result!.isbn).toBeNull();
    expect(result!.coverUrl).toBeNull();
    expect(result!.publisher).toBeUndefined();
    expect(result!.pageCount).toBeUndefined();
    expect(result!.genres).toBeUndefined();
    expect(result!.subtitle).toBeUndefined();
  });

  it("normalizes multiple docs", () => {
    const docs = [
      makeDoc({ key: "/works/OL1W", title: "Book One" }),
      makeDoc({ key: "/works/OL2W", title: "Book Two" }),
    ];

    const results = normalizeOpenLibraryResults(docs);
    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("Book One");
    expect(results[1]!.title).toBe("Book Two");
  });

  it("prefers ISBN-13 starting with 979 as well", () => {
    const doc = makeDoc({
      isbn: ["0134494164", "9791234567890"],
    });

    const [result] = normalizeOpenLibraryResults([doc]);
    expect(result!.isbn).toBe("9791234567890");
  });
});
