import { describe, expect, it } from "vitest";
import { generateSessions, parseISODate, toISODate, weekdayOf } from "./schedule";
import { buildMesocycle } from "./build";
import { Program } from "./schemas";
import { seedData } from "@/lib/data/seed";

const seed = seedData();

function makeProgram(overrides: Partial<Program> = {}): Program {
  const base = {
    weeks: 6,
    trainingDays: ["mon", "wed", "fri"] as Program["trainingDays"],
    periodization: "daily_undulating" as const,
  };
  const merged = { ...base, ...overrides };
  return {
    id: "p1",
    userId: "u1",
    name: "Test",
    type: "full_body",
    mesocycle: buildMesocycle({
      weeks: merged.weeks,
      trainingDays: merged.trainingDays,
      periodization: merged.periodization,
      template: seed.defaultTemplate,
      exercises: seed.exercises,
    }),
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...merged,
  };
}

describe("weekdayOf", () => {
  it("maps JS dates to monday-first weekdays", () => {
    expect(weekdayOf(parseISODate("2026-07-06"))).toBe("mon");
    expect(weekdayOf(parseISODate("2026-07-12"))).toBe("sun");
  });
});

describe("generateSessions", () => {
  it("creates one session per training day per week", () => {
    const program = makeProgram();
    // 2026-07-06 is a Monday
    const sessions = generateSessions(program, "r1", "2026-07-06");
    expect(sessions).toHaveLength(6 * 3);
    expect(sessions[0]).toMatchObject({
      date: "2026-07-06",
      weekIndex: 0,
      weekday: "mon",
      status: "planned",
    });
    const last = sessions[sessions.length - 1];
    expect(last.weekIndex).toBe(5);
    expect(toISODate(parseISODate(last.date))).toBe(last.date);
  });

  it("aligns weeks to calendar weeks, skipping days before a mid-week start", () => {
    const program = makeProgram();
    // 2026-07-08 is a Wednesday: week 1 is the calendar week mon 06 – sun 12,
    // so monday 06 is skipped and week 1 has only wed + fri.
    const sessions = generateSessions(program, "r1", "2026-07-08");
    const week0 = sessions.filter((s) => s.weekIndex === 0);
    expect(week0.map((s) => s.weekday)).toEqual(["wed", "fri"]);
    expect(sessions).toHaveLength(6 * 3 - 1);
    // week 2 starts on the following monday
    const week1 = sessions.filter((s) => s.weekIndex === 1);
    expect(week1[0]).toMatchObject({ date: "2026-07-13", weekday: "mon" });
  });

  it("assigns dates sequentially within week windows", () => {
    const program = makeProgram();
    const sessions = generateSessions(program, "r1", "2026-07-06");
    const dates = sessions.map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
    expect(sessions.filter((s) => s.weekIndex === 5)).toHaveLength(3);
  });
});

describe("buildMesocycle", () => {
  it("prefills every training day and flags the last week deload", () => {
    const program = makeProgram();
    expect(program.mesocycle.weeks).toHaveLength(6);
    expect(program.mesocycle.weeks[5].isDeload).toBe(true);
    expect(program.mesocycle.weeks[0].isDeload).toBe(false);
    const day = program.mesocycle.weeks[0].days.mon;
    expect(day?.exercises.length).toBeGreaterThan(0);
  });

  it("includes the template's skill work in the prefill", () => {
    const program = makeProgram();
    const day = program.mesocycle.weeks[0].days.mon;
    expect(day?.exercises.some((we) => we.exerciseId === "front-lever")).toBe(
      true,
    );
  });

  it("alternates high/low across training days when periodized", () => {
    const program = makeProgram();
    const week = program.mesocycle.weeks[0];
    expect(week.days.mon?.intensity).toBe("high");
    expect(week.days.wed?.intensity).toBe("low");
    expect(week.days.fri?.intensity).toBe("high");
    // deload week is all low
    const deload = program.mesocycle.weeks[5];
    expect(deload.days.mon?.intensity).toBe("low");
  });

  it("sets no intensity without periodization", () => {
    const program = makeProgram({ periodization: "none" });
    expect(program.mesocycle.weeks[0].days.mon?.intensity).toBeUndefined();
  });
});
