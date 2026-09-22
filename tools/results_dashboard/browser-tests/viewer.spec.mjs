import {
  test,
  expect,
} from "../../../apps/web/node_modules/@playwright/test/index.mjs";

const first = "a".repeat(64),
  second = "b".repeat(64);
test("result viewer restores linked cases, opens a readable result, and inspects the actual author request", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 715, height: 998 });
  await page.goto(`/?run=script-path-screening&case=${second}`);
  await expect(
    page.getByRole("tab", { name: "Viewer", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".rv-introduction")).toContainText(
    "One Author · Fixed Dialogue",
  );
  await expect(page.locator(".rv-script .rv-turn")).toHaveCount(8);
  await page.getByRole("link", { name: "Open Result ↗" }).click();
  await expect(page.locator("main")).toHaveClass("result-reader-mode");
  await expect(
    page.getByRole("region", { name: "Scenarios", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Simulation Result", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("case")).toBe(second);
  await page.reload();
  await expect(page.locator(".rv-script .rv-turn")).toHaveCount(8);
  await page
    .getByRole("combobox", { name: "Jump to Turn", exact: true })
    .selectOption("2");
  await expect(page.locator("#result-turn-3")).toBeFocused();
  const turn = page.locator("#result-turn-3");
  await turn.locator(".rv-agent-trigger").hover();
  const preview = page.getByRole("region", { name: "Turn 3 Agent and Setup" });
  await expect(preview).toContainText("One Author, Both Characters");
  await expect(preview).toContainText("invented-offline-model");
  await expect(preview).toContainText(
    "Input-Only · No Separate Character Sketch",
  );
  const bounds = await preview.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(998);
  await turn.locator(".rv-agent-trigger").click();
  await page.mouse.move(5, 5);
  await expect(preview).toContainText("Pinned.");
  const rect = await preview.boundingBox(),
    viewport = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
  await preview
    .getByRole("button", { name: "Read Prompt and Context", exact: true })
    .click();
  const receipt = page.getByRole("region", { name: "Turn Request Details" });
  await expect(receipt).toContainText("Prompt and Context for This Request");
  await receipt.getByText("1. System · Instruction", { exact: true }).click();
  await expect(receipt).toContainText("EXACT AUTHOR PROMPT");
  await turn.locator(".rv-agent-trigger").click();
  await page
    .getByRole("region", { name: "Turn 3 Agent and Setup" })
    .getByRole("button", { name: "Inspect Request in Setup ↗" })
    .click();
  await expect(
    page.getByRole("tab", { name: "Setup", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("combobox", { name: "Inspect Request" }),
  ).toHaveValue("author");
  expect(errors).toEqual([]);
});

test("viewer supports mobile touch previews, recorded anchors, and aliased receipts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const projection = {
    mode: "aliases",
    content_changed: true,
    note: "Display text uses configured aliases. Stored hashes identify original records; private originals remain unchanged.",
  };
  await page.route(
    `**/api/runs/script-path-screening/cases/${first}`,
    async (route) => {
      const response = await route.fetch(),
        data = await response.json();
      await route.fulfill({
        response,
        json: {
          ...data,
          display_projection: projection,
          path: {
            start: {
              id: "invented-start",
              speaker: "human",
              disclosed_at: "2026-05-08",
              body: "Invented recorded starting anchor.",
            },
            endpoint: {
              id: "invented-end",
              speaker: "mirrows",
              disclosed_at: "2026-05-10",
              body: "Invented recorded terminal target.",
            },
            gap_ids: [],
          },
        },
      });
    },
  );
  await page.route(
    `**/api/runs/script-path-screening/cases/${first}/receipts/author`,
    async (route) => {
      const response = await route.fetch(),
        data = await response.json();
      await route.fulfill({
        response,
        json: {
          ...data,
          display_projection: projection,
          display_payload_hash: "invented-displayed-hash",
        },
      });
    },
  );
  await page.goto(`/?run=script-path-screening&case=${first}&reader=1`);
  await expect(page.locator(".rv-alias-note")).toContainText(
    "private originals remain unchanged",
  );
  await page.getByText("Starting Anchor", { exact: true }).click();
  await expect(page.locator(".rv-anchor").first()).toContainText(
    "Invented recorded starting anchor.",
  );
  await page.locator(".rv-agent-trigger").first().click();
  const preview = page.getByRole("region", { name: "Turn 1 Agent and Setup" });
  await expect(preview).toContainText("Pinned.");
  const rect = await preview.boundingBox(),
    viewport = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
  await preview
    .getByRole("button", { name: "Read Prompt and Context", exact: true })
    .click();
  const receipt = page.getByRole("region", { name: "Turn Request Details" });
  await expect(receipt).toContainText("Displayed Payload SHA-256");
  await expect(
    receipt.getByText("Provider Payload With Display Aliases", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Terminal Anchor · Fixed Target", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "/tmp/machina-result-viewer-mobile.png",
    fullPage: true,
  });
});

test("invalid linked case falls back to an existing saved result", async ({
  page,
}) => {
  await page.goto("/?run=script-path-screening&case=does-not-exist&reader=1");
  await expect(page.locator(".rv-script .rv-turn")).toHaveCount(4);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("case"))
    .toBe(first);
});
