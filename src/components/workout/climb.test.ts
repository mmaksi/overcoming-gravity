import { describe, expect, it } from "vitest";
import {
  ClimbSettings,
  ClimbState,
  completeStep,
  failStep,
  startClimb,
  totalReps,
} from "./climb";

const ones: ClimbSettings = { startReps: 1, increment: 1, intervalSeconds: 60 };
const fives: ClimbSettings = {
  startReps: 5,
  increment: 5,
  intervalSeconds: 90,
};

function climb(
  settings: ClimbSettings,
  run: (s: ClimbState) => ClimbState,
): ClimbState {
  return run(startClimb(settings));
}

function completeN(s: ClimbState, settings: ClimbSettings, n: number) {
  for (let i = 0; i < n; i++) s = completeStep(s, settings);
  return s;
}

describe("ladder", () => {
  it("climbs start, start+inc, … until failure; completed steps are the sets", () => {
    let s = climb(ones, (s) => completeN(s, ones, 4));
    expect(s.target).toBe(5);
    s = failStep(s, "ladder", ones);
    expect(s.finished).toBe(true);
    expect(s.completed).toEqual([1, 2, 3, 4]);
    expect(totalReps(s)).toBe(10);
  });

  it("supports arbitrary start and increment (5, 10, 15…)", () => {
    let s = climb(fives, (s) => completeN(s, fives, 3));
    expect(s.completed).toEqual([5, 10, 15]);
    expect(s.target).toBe(20);
    s = failStep(s, "ladder", fives);
    expect(s.finished).toBe(true);
  });

  it("failing the very first step ends with nothing recorded", () => {
    const s = failStep(startClimb(ones), "ladder", ones);
    expect(s.finished).toBe(true);
    expect(s.completed).toEqual([]);
  });
});

describe("pyramid", () => {
  it("descends from one below the last completed step back to the start", () => {
    // The book's example: completed 7, failed the 8th → 6, 5, …, 1.
    let s = climb(ones, (s) => completeN(s, ones, 7));
    s = failStep(s, "pyramid", ones);
    expect(s.finished).toBe(false);
    expect(s.direction).toBe("down");
    expect(s.target).toBe(6);
    while (!s.finished) s = completeStep(s, ones);
    expect(s.completed).toEqual([1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1]);
    expect(totalReps(s)).toBe(49);
  });

  it("descends by the increment down to the start value", () => {
    let s = climb(fives, (s) => completeN(s, fives, 3)); // 5, 10, 15
    s = failStep(s, "pyramid", fives);
    expect(s.target).toBe(10);
    while (!s.finished) s = completeStep(s, fives);
    expect(s.completed).toEqual([5, 10, 15, 10, 5]);
  });

  it("failing during the descent keeps what was done", () => {
    let s = climb(ones, (s) => completeN(s, ones, 3));
    s = failStep(s, "pyramid", ones); // down, target 2
    s = completeStep(s, ones);
    s = failStep(s, "pyramid", ones);
    expect(s.finished).toBe(true);
    expect(s.completed).toEqual([1, 2, 3, 2]);
  });

  it("has nothing to descend through when only the start step was completed", () => {
    let s = climb(ones, (s) => completeN(s, ones, 1));
    s = failStep(s, "pyramid", ones);
    expect(s.finished).toBe(true);
    expect(s.completed).toEqual([1]);
  });

  it("failing the very first step ends immediately", () => {
    const s = failStep(startClimb(fives), "pyramid", fives);
    expect(s.finished).toBe(true);
    expect(s.completed).toEqual([]);
  });
});
