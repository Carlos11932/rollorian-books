import { describe, expect, it } from "vitest";
import { isCatalogBookAvailable } from "../group-library-catalog";

describe("isCatalogBookAvailable", () => {
  it("returns false when every owner has an exclusive loan", () => {
    expect(isCatalogBookAvailable({
      id: "book-1",
      title: "Refactoring",
      authors: ["Martin Fowler"],
      coverUrl: null,
      genres: ["Software"],
      currentUserStatus: null,
      isRead: false,
      owners: [
        { userId: "owner-requested", userName: "Requested", hasExclusiveLoan: true },
        { userId: "owner-offered", userName: "Offered", hasExclusiveLoan: true },
      ],
    })).toBe(false);
  });

  it("returns true when at least one owner is still available", () => {
    expect(isCatalogBookAvailable({
      id: "book-1",
      title: "Refactoring",
      authors: ["Martin Fowler"],
      coverUrl: null,
      genres: ["Software"],
      currentUserStatus: null,
      isRead: false,
      owners: [
        { userId: "owner-requested", userName: "Requested", hasExclusiveLoan: true },
        { userId: "owner-free", userName: "Free", hasExclusiveLoan: false },
      ],
    })).toBe(true);
  });
});
