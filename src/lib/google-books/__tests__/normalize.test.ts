import { describe, it, expect } from "vitest";
import { normalizeSearchResults, normalizeSingleBook } from "@/lib/google-books/normalize";
import type { GoogleBooksVolume } from "@/lib/google-books/types";

function makeVolume(overrides: Partial<GoogleBooksVolume["volumeInfo"]> & { id?: string } = {}): GoogleBooksVolume {
  const { id = "vol_001", ...volumeInfo } = overrides;
  return {
    id,
    volumeInfo: {
      title: "Default Title",
      authors: ["Default Author"],
      ...volumeInfo,
    },
  };
}

describe("normalizeSearchResults", () => {
  it("returns an empty array when given an empty array", () => {
    expect(normalizeSearchResults([])).toEqual([]);
  });

  it("normalizes a single volume correctly", () => {
    const volume = makeVolume({
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      publishedDate: "2008-08-01",
      industryIdentifiers: [
        { type: "ISBN_13", identifier: "9780132350884" },
        { type: "ISBN_10", identifier: "0132350882" },
      ],
      imageLinks: {
        thumbnail: "http://books.google.com/thumbnail.jpg",
      },
    });

    const [result] = normalizeSearchResults([volume]);

    expect(result).toBeDefined();
    expect(result!.title).toBe("Clean Code");
    expect(result!.authors).toEqual(["Robert C. Martin"]);
    expect(result!.publishedYear).toBe(2008);
    expect(result!.isbn).toBe("9780132350884"); // prefers ISBN_13
    expect(result!.externalId).toBe("vol_001");
    expect(result!.externalSource).toBe("google_books");
  });

  it("upgrades thumbnail URL from http to https", () => {
    const volume = makeVolume({
      imageLinks: { thumbnail: "http://books.google.com/thumbnail.jpg" },
    });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.coverUrl).toBe("https://books.google.com/thumbnail.jpg");
  });

  it("uses smallThumbnail when thumbnail is absent", () => {
    const volume = makeVolume({
      imageLinks: { smallThumbnail: "http://books.google.com/small.jpg" },
    });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.coverUrl).toBe("https://books.google.com/small.jpg");
  });

  it("returns null coverUrl when no image links are present", () => {
    const volume = makeVolume({ imageLinks: undefined });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.coverUrl).toBeNull();
  });

  it("returns null coverUrl when imageLinks object has no usable URLs", () => {
    const volume = makeVolume({ imageLinks: {} });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.coverUrl).toBeNull();
  });

  it("falls back to ISBN_10 when ISBN_13 is absent", () => {
    const volume = makeVolume({
      industryIdentifiers: [{ type: "ISBN_10", identifier: "0132350882" }],
    });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.isbn).toBe("0132350882");
  });

  it("returns null isbn when no industry identifiers are present", () => {
    const volume = makeVolume({ industryIdentifiers: undefined });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.isbn).toBeNull();
  });

  it("returns empty authors array when authors field is absent", () => {
    const volume = makeVolume({ authors: undefined });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.authors).toEqual([]);
  });

  it("filters out non-string entries from authors array", () => {
    const volume = makeVolume({
      // Force invalid data to test the filter
      authors: ["Valid Author", "", "Another Author"] as string[],
    });
    const [result] = normalizeSearchResults([volume]);
    // Empty string is falsy (length 0), so it gets filtered out
    expect(result!.authors).toEqual(["Valid Author", "Another Author"]);
  });

  it("defaults title to 'Untitled' when title is absent", () => {
    const volume = makeVolume({ title: undefined });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.title).toBe("Untitled");
  });

  it("returns null publishedYear when publishedDate is absent", () => {
    const volume = makeVolume({ publishedDate: undefined });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.publishedYear).toBeNull();
  });

  it("extracts year correctly from partial date 'YYYY-MM' format", () => {
    const volume = makeVolume({ publishedDate: "2021-06" });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.publishedYear).toBe(2021);
  });

  it("uses volume.id as externalId when present", () => {
    const volume = makeVolume({ id: "my-volume-id" });
    const [result] = normalizeSearchResults([volume]);
    expect(result!.externalId).toBe("my-volume-id");
  });

  it("normalizes multiple volumes", () => {
    const volumes = [
      makeVolume({ id: "id1", title: "Book One" }),
      makeVolume({ id: "id2", title: "Book Two" }),
    ];
    const results = normalizeSearchResults(volumes);
    expect(results).toHaveLength(2);
    expect(results[0]!.title).toBe("Book One");
    expect(results[1]!.title).toBe("Book Two");
  });
});

describe("normalizeSingleBook", () => {
  it("normalizes a single volume the same way as normalizeSearchResults", () => {
    const volume = makeVolume({ id: "single-vol", title: "Single Book" });
    const fromSingle = normalizeSingleBook(volume);
    const [fromBatch] = normalizeSearchResults([volume]);
    expect(fromSingle).toEqual(fromBatch);
  });
});
