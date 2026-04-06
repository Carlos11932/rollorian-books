import { describe, it, expect } from "vitest";
import { normalizeGenres, groupByNormalizedGenre } from "../genre-normalizer";

describe("normalizeGenres", () => {
  it("maps Google Books compound category to a single broad genre", () => {
    expect(normalizeGenres(["Fiction / Fantasy / Epic"])).toEqual(["Fantasía"]);
  });

  it("maps multiple Google Books categories to distinct broad genres", () => {
    const result = normalizeGenres([
      "Fiction / Fantasy / General",
      "Fiction / Science Fiction / Space Opera",
    ]);
    expect(result).toContain("Fantasía");
    expect(result).toContain("Ciencia Ficción");
  });

  it("deduplicates when multiple raw genres map to the same broad genre", () => {
    const result = normalizeGenres([
      "Fiction / Fantasy / Epic",
      "Fiction / Fantasy / General",
      "Fiction / Fantasy / Dark",
    ]);
    expect(result).toEqual(["Fantasía"]);
  });

  it("maps OpenLibrary subjects correctly", () => {
    const result = normalizeGenres([
      "Software architecture",
      "Computer programming",
      "Clean code",
    ]);
    expect(result).toContain("Tecnología");
  });

  it("maps simple genre keywords", () => {
    expect(normalizeGenres(["Horror"])).toEqual(["Terror"]);
    expect(normalizeGenres(["Romance"])).toEqual(["Romance"]);
    expect(normalizeGenres(["History"])).toEqual(["Historia"]);
    expect(normalizeGenres(["Poetry"])).toEqual(["Poesía"]);
  });

  it("returns empty array for unmappable genres", () => {
    expect(normalizeGenres(["XYZABC123"])).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeGenres([])).toEqual([]);
  });

  it("caps results at 3 broad genres", () => {
    const result = normalizeGenres([
      "Fantasy",
      "Horror",
      "Romance",
      "History",
      "Science",
    ]);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("sorts results alphabetically", () => {
    const result = normalizeGenres(["Romance", "Fantasy", "Horror"]);
    expect(result).toEqual([...result].sort((a, b) => a.localeCompare(b)));
  });
});

describe("groupByNormalizedGenre", () => {
  const books = [
    { id: "1", genres: ["Fiction / Fantasy / Epic"] },
    { id: "2", genres: ["Fiction / Fantasy / General"] },
    { id: "3", genres: ["Horror", "Thriller"] },
    { id: "4", genres: [] },
  ];

  it("groups books by normalized genre, merging Fantasy variants", () => {
    const groups = groupByNormalizedGenre(books, "Sin género");
    const fantasyGroup = groups.find(([label]) => label === "Fantasía");
    expect(fantasyGroup).toBeDefined();
    // Both book 1 and 2 should be in Fantasy
    expect(fantasyGroup![1].map((b) => b.id)).toContain("1");
    expect(fantasyGroup![1].map((b) => b.id)).toContain("2");
  });

  it("puts books with no mappable genres in fallback section", () => {
    const groups = groupByNormalizedGenre(books, "Sin género");
    const fallback = groups.find(([label]) => label === "Sin género");
    expect(fallback).toBeDefined();
    expect(fallback![1].map((b) => b.id)).toContain("4");
  });

  it("places fallback section last", () => {
    const groups = groupByNormalizedGenre(books, "Sin género");
    const lastLabel = groups[groups.length - 1]![0];
    expect(lastLabel).toBe("Sin género");
  });

  it("a book matching multiple genres appears in each section", () => {
    const groups = groupByNormalizedGenre(books, "Sin género");
    const terrorGroup = groups.find(([label]) => label === "Terror");
    const misterioGroup = groups.find(([label]) => label === "Misterio");
    // book 3 has ["Horror", "Thriller"] → Terror + Misterio
    expect(terrorGroup?.[1].map((b) => b.id)).toContain("3");
    expect(misterioGroup?.[1].map((b) => b.id)).toContain("3");
  });
});
