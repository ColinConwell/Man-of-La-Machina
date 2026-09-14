import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.skip(
  !process.env.MACHINA_BROWSER_FIXTURE,
  "Uses invented editorial content only",
);

test("readings navigate, preserve an exploration, and keep citation targets", async ({
  page,
}) => {
  await page.goto("/?entry=test-3-9");
  await page
    .getByLabel("Write your next turn")
    .fill("Keep this unsent intervention.");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("link", { name: "About", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "About the Invented Project" }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Read the Essay" }).click();
  await expect(
    page.getByRole("heading", { name: "An Invented Essay" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "a reference", exact: true }).click();
  const target = new URL(page.url()).hash;
  await expect(page.locator(target)).toContainText("An invented reference.");
  await nav.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByLabel("Write your next turn")).toHaveValue(
    "Keep this unsent intervention.",
  );
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "An Invented Essay" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "An Invented Essay" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("disabled essay has no tab and cannot be read through a deep link", async ({
  page,
}) => {
  let essayRequests = 0;
  await page.route("**/api/v1/experience", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: { ...data, editorial: { about: true, essay: false } },
    });
  });
  page.on("request", (request) => {
    if (request.url().includes("/editorial/essay")) essayRequests++;
  });
  await page.goto("/?page=essay");
  await expect(
    page.getByRole("heading", { name: "This Reading Is Unavailable" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Read the Essay" }),
  ).toHaveCount(0);
  expect(essayRequests).toBe(0);
});
