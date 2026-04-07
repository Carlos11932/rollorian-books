import { describe, expect, it } from "vitest";
import { nextSemanticState, getEventTimestamp } from "@/lib/donna/events";
import type { ReadingEventRequest } from "@/lib/donna/contracts";
import type { SelectedUserBook } from "@/lib/donna/normalize";

// ---------------------------------------------------------------------------
// nextSemanticState — state machine transitions
// ---------------------------------------------------------------------------

describe("nextSemanticState", () => {
  describe("wishlisted event", () => {
    it("transitions to wishlist regardless of current status", () => {
      expect(nextSemanticState("wishlisted", "TO_READ")).toBe("wishlist");
      expect(nextSemanticState("wishlisted", "READING")).toBe("wishlist");
      expect(nextSemanticState("wishlisted", undefined)).toBe("wishlist");
    });
  });

  describe("started event", () => {
    it("transitions to reading when current status is not READ", () => {
      expect(nextSemanticState("started", "TO_READ")).toBe("reading");
      expect(nextSemanticState("started", "WISHLIST")).toBe("reading");
      expect(nextSemanticState("started", "ON_HOLD")).toBe("reading");
      expect(nextSemanticState("started", undefined)).toBe("reading");
    });

    it("transitions to rereading when current status is READ", () => {
      expect(nextSemanticState("started", "READ")).toBe("rereading");
    });
  });

  describe("restarted event", () => {
    it("always transitions to rereading", () => {
      expect(nextSemanticState("restarted", "READ")).toBe("rereading");
      expect(nextSemanticState("restarted", "READING")).toBe("rereading");
      expect(nextSemanticState("restarted", undefined)).toBe("rereading");
    });
  });

  describe("finished event", () => {
    it("transitions to read", () => {
      expect(nextSemanticState("finished", "READING")).toBe("read");
      expect(nextSemanticState("finished", "REREADING")).toBe("read");
      expect(nextSemanticState("finished", undefined)).toBe("read");
    });
  });

  describe("paused event", () => {
    it("transitions to paused", () => {
      expect(nextSemanticState("paused", "READING")).toBe("paused");
      expect(nextSemanticState("paused", undefined)).toBe("paused");
    });
  });

  describe("abandoned event", () => {
    it("transitions to abandoned", () => {
      expect(nextSemanticState("abandoned", "READING")).toBe("abandoned");
      expect(nextSemanticState("abandoned", undefined)).toBe("abandoned");
    });
  });

  describe("events that do not change state", () => {
    it("rated event returns null (no state change)", () => {
      expect(nextSemanticState("rated", "READ")).toBeNull();
    });

    it("noted event returns null (no state change)", () => {
      expect(nextSemanticState("noted", "READING")).toBeNull();
    });
  });

  describe("unknown / unrecognised event", () => {
    it("returns null for an unrecognised event type", () => {
      expect(nextSemanticState("unknown_event" as never, undefined)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Extended matrix: every event × every BookStatus value
  // ---------------------------------------------------------------------------
  // BookStatus values: WISHLIST | TO_READ | READING | READ | ON_HOLD | REREADING
  // Events that always return the same value regardless of status:
  //   wishlisted → "wishlist", restarted → "rereading", finished → "read",
  //   paused → "paused", abandoned → "abandoned", rated/noted → null
  // Events with conditional logic: started (READ → rereading, else → reading)
  // ---------------------------------------------------------------------------

  describe("wishlisted — exhaustive status matrix", () => {
    const allStatuses: Array<SelectedUserBook["status"] | undefined> = [
      "WISHLIST", "TO_READ", "READING", "READ", "ON_HOLD", "REREADING", undefined,
    ];
    it.each(allStatuses)("returns wishlist from status %s", (status) => {
      expect(nextSemanticState("wishlisted", status)).toBe("wishlist");
    });
  });

  describe("started — exhaustive status matrix", () => {
    it("returns reading from WISHLIST", () => {
      expect(nextSemanticState("started", "WISHLIST")).toBe("reading");
    });
    it("returns reading from TO_READ", () => {
      expect(nextSemanticState("started", "TO_READ")).toBe("reading");
    });
    it("returns reading from READING", () => {
      expect(nextSemanticState("started", "READING")).toBe("reading");
    });
    it("returns rereading from READ", () => {
      expect(nextSemanticState("started", "READ")).toBe("rereading");
    });
    it("returns reading from ON_HOLD", () => {
      expect(nextSemanticState("started", "ON_HOLD")).toBe("reading");
    });
    it("returns reading from REREADING", () => {
      expect(nextSemanticState("started", "REREADING")).toBe("reading");
    });
    it("returns reading from undefined", () => {
      expect(nextSemanticState("started", undefined)).toBe("reading");
    });
  });

  describe("restarted — exhaustive status matrix", () => {
    const allStatuses: Array<SelectedUserBook["status"] | undefined> = [
      "WISHLIST", "TO_READ", "READING", "READ", "ON_HOLD", "REREADING", undefined,
    ];
    it.each(allStatuses)("returns rereading from status %s", (status) => {
      expect(nextSemanticState("restarted", status)).toBe("rereading");
    });
  });

  describe("finished — exhaustive status matrix", () => {
    const allStatuses: Array<SelectedUserBook["status"] | undefined> = [
      "WISHLIST", "TO_READ", "READING", "READ", "ON_HOLD", "REREADING", undefined,
    ];
    it.each(allStatuses)("returns read from status %s", (status) => {
      expect(nextSemanticState("finished", status)).toBe("read");
    });
  });

  describe("paused — exhaustive status matrix", () => {
    const allStatuses: Array<SelectedUserBook["status"] | undefined> = [
      "WISHLIST", "TO_READ", "READING", "READ", "ON_HOLD", "REREADING", undefined,
    ];
    it.each(allStatuses)("returns paused from status %s", (status) => {
      expect(nextSemanticState("paused", status)).toBe("paused");
    });
  });

  describe("abandoned — exhaustive status matrix", () => {
    const allStatuses: Array<SelectedUserBook["status"] | undefined> = [
      "WISHLIST", "TO_READ", "READING", "READ", "ON_HOLD", "REREADING", undefined,
    ];
    it.each(allStatuses)("returns abandoned from status %s", (status) => {
      expect(nextSemanticState("abandoned", status)).toBe("abandoned");
    });
  });

  describe("rated — exhaustive status matrix (all → null)", () => {
    const allStatuses: Array<SelectedUserBook["status"] | undefined> = [
      "WISHLIST", "TO_READ", "READING", "READ", "ON_HOLD", "REREADING", undefined,
    ];
    it.each(allStatuses)("returns null from status %s", (status) => {
      expect(nextSemanticState("rated", status)).toBeNull();
    });
  });

  describe("noted — exhaustive status matrix (all → null)", () => {
    const allStatuses: Array<SelectedUserBook["status"] | undefined> = [
      "WISHLIST", "TO_READ", "READING", "READ", "ON_HOLD", "REREADING", undefined,
    ];
    it.each(allStatuses)("returns null from status %s", (status) => {
      expect(nextSemanticState("noted", status)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// getEventTimestamp — date parsing
// ---------------------------------------------------------------------------

describe("getEventTimestamp", () => {
  function makePayload(occurredAt?: string): ReadingEventRequest["payload"] {
    return occurredAt ? { occurredAt } : {};
  }

  it("returns a Date object", () => {
    const result = getEventTimestamp(makePayload());
    expect(result).toBeInstanceOf(Date);
  });

  it("returns approximately now when occurredAt is not provided", () => {
    const before = Date.now();
    const result = getEventTimestamp(makePayload());
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it("parses a valid ISO 8601 datetime string", () => {
    const result = getEventTimestamp(makePayload("2026-01-15T10:30:00.000Z"));
    expect(result.toISOString()).toBe("2026-01-15T10:30:00.000Z");
  });

  it("parses a valid datetime with timezone offset", () => {
    const result = getEventTimestamp(makePayload("2026-03-01T12:00:00.000Z"));
    expect(result.getTime()).toBe(new Date("2026-03-01T12:00:00.000Z").getTime());
  });

  it("falls back to now when occurredAt is an invalid date string", () => {
    const before = Date.now();
    const result = getEventTimestamp(makePayload("not-a-date"));
    const after = Date.now();
    // Should fall back to `new Date()` — within the current test execution window
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it("falls back to now when occurredAt is an empty string (invalid)", () => {
    const before = Date.now();
    // Empty string produces Invalid Date (NaN)
    const result = getEventTimestamp({ occurredAt: "" } as never);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});
