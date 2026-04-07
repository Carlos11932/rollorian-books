import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeWeeklyStreak } from "@/lib/donna/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a Date for the Monday of the ISO week that contains `anchor`.
 * Used to generate predictable "current-week" test data.
 */
function mondayOfIsoWeek(anchor: Date): Date {
  const d = new Date(anchor);
  const day = d.getUTCDay() || 7; // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() - day + 1);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

/**
 * Subtracts `weeks` ISO weeks from `anchor`.
 */
function weeksAgo(anchor: Date, weeks: number): Date {
  const d = new Date(anchor);
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return d;
}

// We pin "now" to a stable Wednesday so ISO week arithmetic is predictable.
// 2026-04-01 is a Wednesday in ISO week 14 of 2026.
const STABLE_NOW = new Date("2026-04-01T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("computeWeeklyStreak", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(STABLE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -- Edge cases -----------------------------------------------------------

  it("returns 0 when dates array is empty", () => {
    const result = computeWeeklyStreak([]);
    expect(result).toEqual({ current: 0, unit: "weeks" });
  });

  it("always returns unit: weeks", () => {
    const result = computeWeeklyStreak([]);
    expect(result.unit).toBe("weeks");
  });

  // -- Single week ----------------------------------------------------------

  it("returns streak of 1 when there is exactly one date in the current week", () => {
    const thisWeek = mondayOfIsoWeek(STABLE_NOW);
    const result = computeWeeklyStreak([thisWeek]);
    expect(result.current).toBe(1);
  });

  it("returns streak of 0 when the single date is in a past week (no current-week activity)", () => {
    const lastWeek = weeksAgo(mondayOfIsoWeek(STABLE_NOW), 1);
    const result = computeWeeklyStreak([lastWeek]);
    // The current week (week 14) is not in the set, so streak = 0
    expect(result.current).toBe(0);
  });

  it("deduplicates multiple dates within the same week", () => {
    const monday = mondayOfIsoWeek(STABLE_NOW);
    const wednesday = new Date(monday);
    wednesday.setUTCDate(monday.getUTCDate() + 2);
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 4);

    // All three dates are in the same ISO week — streak = 1 (not 3)
    const result = computeWeeklyStreak([monday, wednesday, friday]);
    expect(result.current).toBe(1);
  });

  // -- Consecutive weeks ----------------------------------------------------

  it("returns streak of 2 for the current week and last week", () => {
    const thisWeek = mondayOfIsoWeek(STABLE_NOW);
    const lastWeek = weeksAgo(thisWeek, 1);
    const result = computeWeeklyStreak([thisWeek, lastWeek]);
    expect(result.current).toBe(2);
  });

  it("returns streak of 3 for three consecutive weeks ending this week", () => {
    const thisWeek = mondayOfIsoWeek(STABLE_NOW);
    const dates = [thisWeek, weeksAgo(thisWeek, 1), weeksAgo(thisWeek, 2)];
    const result = computeWeeklyStreak(dates);
    expect(result.current).toBe(3);
  });

  it("returns streak of 5 for five consecutive weeks ending this week", () => {
    const thisWeek = mondayOfIsoWeek(STABLE_NOW);
    const dates = [0, 1, 2, 3, 4].map((n) => weeksAgo(thisWeek, n));
    const result = computeWeeklyStreak(dates);
    expect(result.current).toBe(5);
  });

  // -- Gap in sequence breaks streak ----------------------------------------

  it("stops counting at the first missing week", () => {
    const thisWeek = mondayOfIsoWeek(STABLE_NOW);
    // Current week ✓, last week ✗, two weeks ago ✓ — streak stops at 1
    const dates = [thisWeek, weeksAgo(thisWeek, 2)];
    const result = computeWeeklyStreak(dates);
    expect(result.current).toBe(1);
  });

  it("returns 0 when all dates are older than current week with a gap before now", () => {
    const thisWeek = mondayOfIsoWeek(STABLE_NOW);
    // Weeks 3 and 4 ago — consecutive but no current-week entry
    const dates = [weeksAgo(thisWeek, 3), weeksAgo(thisWeek, 4)];
    const result = computeWeeklyStreak(dates);
    expect(result.current).toBe(0);
  });

  // -- ISO week boundary year edge case -------------------------------------

  it("counts streak correctly across a year boundary", () => {
    // 2025-12-29 is ISO week 1 of 2026 in some calculations — use explicit dates
    // that we know span a calendar year boundary.
    // We pin "now" to the first Monday of 2026 (ISO week 1, 2026).
    vi.setSystemTime(new Date("2026-01-05T12:00:00.000Z")); // Monday, ISO w01 2026

    const currentWeekMonday = mondayOfIsoWeek(new Date("2026-01-05T12:00:00.000Z")); // 2026-01-05
    const prevWeekMonday = weeksAgo(currentWeekMonday, 1);                            // 2025-12-29

    const result = computeWeeklyStreak([currentWeekMonday, prevWeekMonday]);
    expect(result.current).toBe(2);
  });

  // -- Order independence ---------------------------------------------------

  it("produces the same streak regardless of date array order", () => {
    const thisWeek = mondayOfIsoWeek(STABLE_NOW);
    const ordered = [thisWeek, weeksAgo(thisWeek, 1), weeksAgo(thisWeek, 2)];
    const shuffled = [weeksAgo(thisWeek, 2), thisWeek, weeksAgo(thisWeek, 1)];

    expect(computeWeeklyStreak(ordered).current).toBe(computeWeeklyStreak(shuffled).current);
  });
});
