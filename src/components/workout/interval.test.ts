import { describe, expect, it } from "vitest";
import { IntervalSettings, phaseAt, PREP_SECONDS, totalSeconds } from "./interval";

const tabata: IntervalSettings = { workSeconds: 20, restSeconds: 10, rounds: 8 };
const hiit: IntervalSettings = { workSeconds: 30, restSeconds: 45, rounds: 6 };

describe("phaseAt", () => {
  it("counts down the get-ready lead-in before round 1", () => {
    expect(phaseAt(0, tabata)).toEqual({ kind: "prep", secondsLeft: 4 });
    expect(phaseAt(3.5, tabata)).toEqual({ kind: "prep", secondsLeft: 0.5 });
    expect(phaseAt(PREP_SECONDS, tabata)).toEqual({
      kind: "work",
      round: 1,
      secondsLeft: 20,
    });
  });

  it("cycles work → rest through the rounds", () => {
    expect(phaseAt(PREP_SECONDS + 19, tabata)).toEqual({
      kind: "work",
      round: 1,
      secondsLeft: 1,
    });
    expect(phaseAt(PREP_SECONDS + 20, tabata)).toEqual({
      kind: "rest",
      round: 1,
      secondsLeft: 10,
    });
    expect(phaseAt(PREP_SECONDS + 30, tabata)).toEqual({
      kind: "work",
      round: 2,
      secondsLeft: 20,
    });
    expect(phaseAt(PREP_SECONDS + 7 * 30 + 5, tabata)).toEqual({
      kind: "work",
      round: 8,
      secondsLeft: 15,
    });
  });

  it("finishes after the last round's rest — Tabata is exactly 4 minutes", () => {
    expect(totalSeconds(tabata)).toBe(240);
    expect(phaseAt(PREP_SECONDS + 239, tabata)).toEqual({
      kind: "rest",
      round: 8,
      secondsLeft: 1,
    });
    expect(phaseAt(PREP_SECONDS + 240, tabata)).toEqual({ kind: "finished" });
  });

  it("lands on the right phase after a long timer gap (backgrounded tab)", () => {
    // Jumping straight from prep into the middle of round 4's rest.
    expect(phaseAt(PREP_SECONDS + 3 * 75 + 40, hiit)).toEqual({
      kind: "rest",
      round: 4,
      secondsLeft: 35,
    });
    expect(phaseAt(10_000, hiit)).toEqual({ kind: "finished" });
  });
});
