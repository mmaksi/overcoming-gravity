import { expect, test, type Page } from "@playwright/test";

test.beforeAll(async () => {
  const { rm } = await import("node:fs/promises");
  await rm("data/db.e2e.json", { force: true });
});

/**
 * A fresh dev profile shows the welcome tour on the first home visit (the
 * redirect is client-side, so we wait for the tour to appear rather than
 * checking the URL). Skipping it persists the flag off for the rest of the run.
 */
async function skipWelcomeTour(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: /Skip the tour/ });
  await skip.waitFor({ state: "visible" });
  await skip.click();
  await expect(skip).toBeHidden();
}

test("personal records show on the home card and the progress tab", async ({
  page,
}) => {
  await skipWelcomeTour(page);

  // Do a custom workout, prefilled from the default template (which includes
  // the Front Lever skill). Log a 30-second hold on its first set so a skill
  // record is created — completing drops untouched sets, so a value is needed.
  await page.goto("/programs");
  await page.getByRole("button", { name: /Create a workout/ }).click();
  await page.getByRole("button", { name: "Do this workout" }).click();
  await expect(page.getByRole("heading", { name: "My workout" })).toBeVisible();

  const frontLeverCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Front Lever" });
  await frontLeverCard.getByRole("textbox").first().fill("30");

  await page.getByRole("button", { name: /Complete workout/ }).click();
  // Completing shows a congrats screen; head back to the dashboard.
  await page.getByRole("link", { name: /Back to home/ }).click();
  await expect(page).toHaveURL("/");

  // The home records card (in the Stats section): exactly one trained
  // skill/strength progression.
  const recordsCard = page.getByRole("link", { name: /personal records/i });
  await expect(recordsCard).toBeVisible();
  await expect(recordsCard).toContainText("Personal records");
  await expect(recordsCard).toContainText("1");

  // Tapping the card opens the Progress tab's full records list.
  await recordsCard.click();
  await expect(page).toHaveURL(/\/calendar\?tab=progress/);
  await expect(
    page.getByRole("heading", { name: "Front Lever" }),
  ).toBeVisible();
  // Progression name, its ladder level, and the best hold value.
  await expect(page.getByText("Tuck")).toBeVisible();
  await expect(page.getByText("1/5")).toBeVisible();
  await expect(page.getByText("30s")).toBeVisible();
});
