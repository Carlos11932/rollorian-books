import { describe, it, expect } from "vitest";
import {
  BookStatus,
  BOOK_STATUS_VALUES,
  BOOK_STATUS_LABELS,
  BOOK_STATUS_OPTIONS,
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

describe("BOOK_STATUS_LABELS", () => {
  it("has a label for every BookStatus", () => {
    for (const status of BOOK_STATUS_VALUES) {
      expect(BOOK_STATUS_LABELS[status]).toBeDefined();
      expect(typeof BOOK_STATUS_LABELS[status]).toBe("string");
      expect(BOOK_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("maps to the expected human-readable labels", () => {
    expect(BOOK_STATUS_LABELS["WISHLIST"]).toBe("Wishlist");
    expect(BOOK_STATUS_LABELS["TO_READ"]).toBe("To Read");
    expect(BOOK_STATUS_LABELS["READING"]).toBe("Reading");
    expect(BOOK_STATUS_LABELS["READ"]).toBe("Read");
  });
});

describe("BOOK_STATUS_OPTIONS", () => {
  it("has the same length as BOOK_STATUS_VALUES", () => {
    expect(BOOK_STATUS_OPTIONS).toHaveLength(BOOK_STATUS_VALUES.length);
  });

  it("each option has a value and a label", () => {
    for (const option of BOOK_STATUS_OPTIONS) {
      expect(option.value).toBeDefined();
      expect(option.label).toBeDefined();
      expect(typeof option.label).toBe("string");
    }
  });

  it("option values match BOOK_STATUS_VALUES in the same order", () => {
    const values = BOOK_STATUS_OPTIONS.map((o) => o.value);
    expect(values).toEqual(BOOK_STATUS_VALUES);
  });

  it("option labels match BOOK_STATUS_LABELS", () => {
    for (const option of BOOK_STATUS_OPTIONS) {
      expect(option.label).toBe(BOOK_STATUS_LABELS[option.value]);
    }
  });
});
