import { describe, it, expect } from "vitest";
import {
  BookStatus,
  BOOK_STATUS_VALUES,
} from "@/lib/types/book";

describe("BookStatus", () => {
  it("defines the six expected status constants", () => {
    expect(BookStatus.WISHLIST).toBe("WISHLIST");
    expect(BookStatus.TO_READ).toBe("TO_READ");
    expect(BookStatus.READING).toBe("READING");
    expect(BookStatus.REREADING).toBe("REREADING");
    expect(BookStatus.READ).toBe("READ");
    expect(BookStatus.ON_HOLD).toBe("ON_HOLD");
  });
});

describe("BOOK_STATUS_VALUES", () => {
  it("contains exactly six statuses", () => {
    expect(BOOK_STATUS_VALUES).toHaveLength(6);
  });

  it("contains all BookStatus values", () => {
    for (const status of Object.values(BookStatus)) {
      expect(BOOK_STATUS_VALUES).toContain(status);
    }
  });

  it("is ordered: WISHLIST, TO_READ, READING, REREADING, READ, ON_HOLD", () => {
    expect(BOOK_STATUS_VALUES).toEqual([
      "WISHLIST",
      "TO_READ",
      "READING",
      "REREADING",
      "READ",
      "ON_HOLD",
    ]);
  });
});
