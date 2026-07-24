import { describe, expect, it } from "vitest";
import { exerciseSchema } from "./schemas";

const base = {
  id: "e1",
  title: "Test",
  attribute: "strength" as const,
  progressions: [{ id: "e1-p0", name: "P", order: 0, description: "" }],
};

describe("exerciseSchema category invariant", () => {
  it("keeps a category on strength exercises", () => {
    const parsed = exerciseSchema.parse({ ...base, category: "pull" });
    expect(parsed.category).toBe("pull");
  });

  it("rejects a strength exercise with no category", () => {
    expect(() =>
      exerciseSchema.parse({ ...base, category: undefined }),
    ).toThrow();
  });

  it("strips a category from non-strength exercises", () => {
    const parsed = exerciseSchema.parse({
      ...base,
      attribute: "flexibility",
      category: "pull", // a stale value from before the rule
    });
    expect(parsed.category).toBeUndefined();
  });

  it("accepts a non-strength exercise with no category", () => {
    const parsed = exerciseSchema.parse({ ...base, attribute: "warmup" });
    expect(parsed.category).toBeUndefined();
  });
});
