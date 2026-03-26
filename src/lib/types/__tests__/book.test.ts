import { describe, it, expect } from "vitest";
import {
  BookStatus,
  BOOK_STATUS_VALUES,
} from "@/lib/types/book";

describe("BookStatus", () => {
  it("defines the four expected status constants", () => {
    expect(BookStatus.WISHLIST).toBe("WISHLIST");
    expect(BookStatus.TO_READ).toBe("TO_READ");
    expect(BookStatus.READING).toBe("READING");
    expect(BookStatus.READ).toBe("READ");
  });
});

describe("BOOK_STATUS_VALUES", () => {
  it("contains exactly four statuses", () => {
    expect(BOOK_STATUS_VALUES).toHaveLength(4);
  });

  it("contains all BookStatus values", () => {
    for (const status of Object.values(BookStatus)) {
      expect(BOOK_STATUS_VALUES).toContain(status);
    }
  });

  it("is ordered: WISHLIST, TO_READ, READING, READ", () => {
    expect(BOOK_STATUS_VALUES).toEqual(["WISHLIST", "TO_READ", "READING", "READ"]);
  });
});
