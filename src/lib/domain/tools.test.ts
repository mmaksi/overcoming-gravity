import { describe, expect, it } from "vitest";
import {
  addedLoadForReps,
  formatSweetSpot,
  isometricSweetSpot,
  loadForReps,
  oneRepMax,
  percentOfMax,
  weightedOneRepMax,
} from "./tools";

describe("isometricSweetSpot", () => {
  // Every row of the coaching table, formatted "setsxhold".
  const table: Array<[number, string]> = [
    [1, "8x1"],
    [2, "7x2"],
    [3, "7x3"],
    [4, "7x3"],
    [5, "6x4"],
    [6, "6x5"],
    [7, "6x5"],
    [8, "6x6"],
    [9, "6x6"],
    [10, "5x7"],
    [11, "5x8"],
    [12, "5x8"],
    [13, "5x9"],
    [14, "5x10"],
    [15, "5x10"],
  ];

  it.each(table)("max hold %is -> %s", (hold, expected) => {
    expect(formatSweetSpot(isometricSweetSpot(hold))).toBe(expected);
  });

  it("rounds fractional holds to the nearest second", () => {
    expect(formatSweetSpot(isometricSweetSpot(9.6))).toBe("5x7"); // -> 10
    expect(formatSweetSpot(isometricSweetSpot(10.4))).toBe("5x7"); // -> 10
  });

  it("clamps below the range to the 1s row", () => {
    expect(formatSweetSpot(isometricSweetSpot(0.4))).toBe("8x1");
  });

  it("clamps above the range to the 15s row", () => {
    expect(formatSweetSpot(isometricSweetSpot(30))).toBe("5x10");
  });
});

describe("oneRepMax", () => {
  it("applies the Epley formula", () => {
    // 100 × (1 + 5/30) = 116.666…
    expect(oneRepMax(100, 5)).toBeCloseTo(116.6667, 4);
    // 80 × (1 + 10/30) = 106.666…
    expect(oneRepMax(80, 10)).toBeCloseTo(106.6667, 4);
  });

  it("returns 0 for non-positive weight or reps", () => {
    expect(oneRepMax(0, 5)).toBe(0);
    expect(oneRepMax(100, 0)).toBe(0);
    expect(oneRepMax(-10, 5)).toBe(0);
  });
});

describe("weightedOneRepMax", () => {
  it("estimates on total load then subtracts bodyweight", () => {
    // 75 + 20 = 95 total; 95 × (1 + 3/30) = 104.5; minus 75 bodyweight = 29.5
    expect(weightedOneRepMax(75, 20, 3)).toBeCloseTo(29.5, 4);
  });

  it("still yields added load when no extra weight was used", () => {
    // Bodyweight-only set: 80 × (1 + 5/30) = 93.333; minus 80 = 13.333
    expect(weightedOneRepMax(80, 0, 5)).toBeCloseTo(13.3333, 4);
  });

  it("returns 0 for non-positive bodyweight or reps", () => {
    expect(weightedOneRepMax(0, 20, 3)).toBe(0);
    expect(weightedOneRepMax(75, 20, 0)).toBe(0);
  });
});

describe("loadForReps", () => {
  it("inverts oneRepMax", () => {
    expect(loadForReps(oneRepMax(100, 5), 5)).toBeCloseTo(100, 6);
    expect(loadForReps(oneRepMax(80, 10), 10)).toBeCloseTo(80, 6);
  });

  it("returns the max itself for a single rep", () => {
    expect(loadForReps(120, 1)).toBeCloseTo(116.129, 3); // 120 ÷ (1 + 1/30)
  });

  it("returns 0 for non-positive max or reps", () => {
    expect(loadForReps(0, 5)).toBe(0);
    expect(loadForReps(120, 0)).toBe(0);
  });
});

describe("addedLoadForReps", () => {
  it("inverts weightedOneRepMax", () => {
    const oneRm = weightedOneRepMax(75, 20, 3); // 29.5 added
    expect(addedLoadForReps(75, oneRm, 3)).toBeCloseTo(20, 6);
  });

  it("goes negative when the rep target needs assistance", () => {
    // 75 + 20 = 95 total 1RM; 95 ÷ (1 + 12/30) = 67.857 total, 7.14 under
    // bodyweight — that much help is needed to reach 12 reps.
    expect(addedLoadForReps(75, 20, 12)).toBeCloseTo(-7.1429, 4);
  });

  it("returns 0 for non-positive bodyweight, reps, or total load", () => {
    expect(addedLoadForReps(0, 20, 5)).toBe(0);
    expect(addedLoadForReps(75, 20, 0)).toBe(0);
    expect(addedLoadForReps(75, -80, 5)).toBe(0);
  });
});

describe("percentOfMax", () => {
  it("is 100% at one rep only in the limit — Epley discounts even a single", () => {
    expect(percentOfMax(1)).toBeCloseTo(96.774, 3);
    expect(percentOfMax(5)).toBeCloseTo(85.714, 3);
    expect(percentOfMax(10)).toBeCloseTo(75, 6);
  });

  it("returns 0 for non-positive reps", () => {
    expect(percentOfMax(0)).toBe(0);
  });
});
