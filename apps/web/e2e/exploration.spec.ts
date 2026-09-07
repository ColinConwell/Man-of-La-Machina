import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Rain in Spain · May 8/ }).click();
  await expect(
    page.getByRole("heading", { name: "Rain in Spain", exact: true }),
  ).toBeVisible();
}

test("complete-history, arbitrary boundaries, resolution, search and deep links", async ({
  page,
}) => {
  await page.goto("/");
  const experience = await (await page.request.get("/api/v1/experience")).json();
  await expect(page.locator(".threshold-copy")).toContainText(
    experience.profile.human_label,
  );
  await page
    .getByRole("button", { name: /From the beginning · April 1/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pink Moon", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".scene-heading")).toContainText("APR 1, 2026", {
    ignoreCase: true,
  });
  await expect(page.locator(".message-meta strong").first()).toHaveText(
    experience.profile.human_label,
  );
  const original = new URL(page.url()).searchParams.get("entry");
  for (const scale of [
    "chapter",
    "week",
    "day",
    "thread",
    "exchange",
    "message",
  ]) {
    await page.getByLabel("Timeline resolution").selectOption(scale);
    expect(new URL(page.url()).searchParams.get("entry")).toBe(original);
  }
  await expect(page.getByLabel("Ordinal conversation axis")).toBeVisible();
  await page
    .getByRole("button", { name: /^Turn 5 · .+, 1 turns$/, exact: true })
    .click();
  expect(new URL(page.url()).searchParams.get("entry")).not.toBe(original);
  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(page.locator(".cutoff-rule")).toContainText("turn 5");
  await page.getByRole("button", { name: "List & range", exact: true }).click();
  await page
    .getByLabel("Range start", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Range end", { exact: true })
    .selectOption({ index: 3 });
  await expect(page.locator(".timeline-list")).toContainText(
    "3 turns selected",
  );
  await page.getByRole("button", { name: "Close list", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search the transcript" })
    .fill("rent a car");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".search-results button").nth(1)).toBeVisible();
});

test("May 8 intervention, mutations, immutable receipts, multi-turn compare, artifacts, export, reset", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByLabel("Write your next turn", { exact: true })
    .fill("I want to rest tonight. What would keep the decision small?");
  await page
    .getByRole("button", { name: "Preview context", exact: true })
    .click();
  await expect(page.getByTestId("manifest-hash")).toHaveText(/[a-f0-9]{64}/);
  const before = await page.getByTestId("manifest-hash").textContent();
  await page.getByLabel("Theme", { exact: true }).selectOption("context-lab");
  await page
    .getByRole("button", { name: "Preview context", exact: true })
    .click();
  await expect(page.getByTestId("manifest-hash")).toHaveText(before!);
  await page.getByLabel("Intimate disclosures").uncheck();
  await page
    .getByRole("button", { name: "Preview context", exact: true })
    .click();
  await expect(page.getByTestId("manifest-hash")).not.toHaveText(before!);
  await page.getByLabel("Replace the selected human turn").check();
  await page
    .getByRole("button", { name: "Preview context", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate continuation", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Inspect this turn’s receipt",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Generated model reply")).toContainText(
    "deterministic demonstration",
  );
  await page
    .getByRole("button", { name: "Inspect this turn’s receipt", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByTestId("manifest-hash"),
  ).toHaveText(/[a-f0-9]{64}/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel("Rewrite the human turn", { exact: true })
    .fill("Let us compare two modest options for tomorrow.");
  await page
    .getByRole("button", { name: "Generate continuation", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Inspect this turn’s receipt",
      exact: true,
    }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded continuation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Generated branch", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Artifacts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The author’s thread map", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".artifact-note")).toContainText("never included");

  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  const readerTop = await page
    .locator(".reading-surface")
    .evaluate((el) => el.scrollTop);
  await page.getByRole("button", { name: "Artifacts", exact: true }).click();
  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  await expect
    .poll(() => page.locator(".reading-surface").evaluate((el) => el.scrollTop))
    .toBe(readerTop);
  await page.getByRole("button", { name: "Branch", exact: true }).click();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export branch & receipts", exact: true })
    .click();
  expect((await dl).suggestedFilename()).toBe("la-machina-branch.json");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a beginning", exact: true }),
  ).toBeVisible();
});

test("keyboard entry, reduced motion, responsive geometry and accessibility", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Rain in Spain · May 8/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Rain in Spain", exact: true }),
  ).toBeVisible();
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page.getByLabel("Intimate disclosures").uncheck();
  await page
    .getByRole("button", { name: "Close context", exact: true })
    .click();
  await page
    .getByLabel("Write your next turn", { exact: true })
    .fill("A short keyboard test.");
  await page
    .getByLabel("Write your next turn", { exact: true })
    .press("Control+Enter");
  await expect(
    page.getByRole("button", {
      name: "Inspect this turn’s receipt",
      exact: true,
    }),
  ).toBeVisible();
});

test("theme contrast and provider-failure recovery", async ({ page }) => {
  await enter(page);
  for (const theme of ["archive", "western-gothic", "context-lab"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.route("**/messages", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        generation_id: "failure-test",
        manifest_id: "failure-manifest",
        stream_url: "/api/v1/test-failure-stream",
        visitor_text: "An invented failure recovery test.",
      }),
    }),
  );
  await page.route("**/test-failure-stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'event: failure\ndata: {"category":"timeout","message":"The provider timed out. You can retry or return to the record."}\n\n',
    }),
  );
  await page
    .getByLabel("Write your next turn", { exact: true })
    .fill("An invented failure recovery test.");
  await page
    .getByRole("button", { name: "Generate continuation", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("provider timed out");
  await expect(
    page.getByRole("button", { name: "Generate continuation", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/messages");
  await page
    .getByRole("button", { name: "Generate continuation", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Inspect this turn’s receipt",
      exact: true,
    }),
  ).toBeVisible();
  await page.route("**/branches/*", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 404,
          contentType: "application/json",
          body: '{"detail":"Branch not found or expired"}',
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a beginning", exact: true }),
  ).toBeVisible();
});
