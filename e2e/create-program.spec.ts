import { expect, test } from "@playwright/test";

test.beforeAll(async () => {
  const { rm } = await import("node:fs/promises");
  await rm("data/db.e2e.json", { force: true });
});

test("create a program end-to-end", async ({ page }) => {
  await page.goto("/programs/new");

  // Step 1 — basics
  await page.getByLabel("Program name").fill("E2E Front Lever");
  await page.getByRole("button", { name: "Full Body" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 2 — periodization
  await page.getByRole("button", { name: /High–Low/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Step 3 — schedule
  await page.getByRole("button", { name: "Mon", exact: true }).click();
  await page.getByRole("button", { name: "Thu", exact: true }).click();
  await expect(page.getByText("Deload week")).toBeVisible();
  await page.getByRole("button", { name: /Design workouts/ }).click();

  // Designer
  await expect(page.getByText("E2E Front Lever")).toBeVisible();
  await expect(page.getByRole("button", { name: /W6/ })).toBeVisible();
  await expect(page.getByText("Monday")).toBeVisible();
  await expect(page.getByText("High volume").first()).toBeVisible();
  // default template prefill + skill work
  await expect(page.getByText("Wrist Circles & Prep").first()).toBeVisible();
  await expect(page.getByText("Front Lever").first()).toBeVisible();

  // Activate
  await page.getByRole("button", { name: "Finish & activate" }).click();
  await expect(page.getByText("active").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start program" }),
  ).toBeVisible();
});
