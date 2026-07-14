import { expect, test } from "@playwright/test";

test("install button uses the native prompt when the browser offers one", async ({
  page,
}) => {
  // Simulate Chrome firing beforeinstallprompt before hydration — the head
  // script must stash it so the button can use it whenever it mounts.
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const event = new Event("beforeinstallprompt") as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string; platform: string }>;
      };
      event.prompt = () => {
        (window as unknown as { __promptCalled: boolean }).__promptCalled =
          true;
        return Promise.resolve();
      };
      event.userChoice = Promise.resolve({
        outcome: "accepted",
        platform: "web",
      });
      window.dispatchEvent(event);
    });
  });

  await page.goto("/");
  const button = page.getByRole("button", { name: "Install app" });
  await expect(button).toBeEnabled();
  await button.click();

  // Native path taken: prompt() called, no fallback dialog shown.
  await expect
    .poll(() => page.evaluate(() => (window as never)["__promptCalled"]))
    .toBe(true);
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("install button falls back to instructions without a prompt event", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Install app" }).click();
  await expect(
    page.getByRole("heading", { name: "Install Strong Journal" }),
  ).toBeVisible();
  await expect(page.getByText("Add to Home screen")).toBeVisible();
});
