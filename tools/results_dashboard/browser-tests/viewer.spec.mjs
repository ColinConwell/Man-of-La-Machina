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
    page.getByRole("tab", { name: "Dialogue", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".inspector-heading h2")).toHaveText(
    "One author · fixed length",
  );
  await expect(page.locator(".rv-introduction")).toContainText("One author · 8 turns");
  await expect(page.locator(".rv-script .rv-turn")).toHaveCount(8);
  await page.getByRole("link", { name: "Open ↗" }).click();
  await expect(page.locator("main")).toHaveClass("result-reader-mode");
  await expect(
    page.getByRole("region", { name: "Cases", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Result", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("case")).toBe(second);
  await page.reload();
  await expect(page.locator(".rv-script .rv-turn")).toHaveCount(8);
  await page
    .getByRole("combobox", { name: "Jump to turn", exact: true })
    .selectOption("2");
  await expect(page.locator("#result-turn-3")).toBeFocused();
  const turn = page.locator("#result-turn-3");
  await turn.locator(".rv-agent-trigger").hover();
  const preview = page.getByRole("region", { name: "Turn 3 agent" });
  await expect(preview).toContainText("One author writes both roles");
  await expect(preview).toContainText("invented-offline-model");
  await expect(preview).toContainText("Dialogue");
  const bounds = await preview.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(998);
  await turn.locator(".rv-agent-trigger").click();
  await page.mouse.move(5, 5);
  await expect(preview).toContainText("pinned");
  const rect = await preview.boundingBox(),
    viewport = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
  await preview
    .getByRole("button", { name: "Prompt and context", exact: true })
    .click();
  const receipt = page.getByRole("region", { name: "Turn request details" });
  await expect(receipt).toContainText("Prompt and context");
  await receipt.getByText("1. System · Instruction", { exact: true }).click();
  await expect(receipt).toContainText("EXACT AUTHOR PROMPT");
  await turn.locator(".rv-agent-trigger").click();
  await page
    .getByRole("region", { name: "Turn 3 agent" })
    .getByRole("button", { name: "Open in Setup ↗" })
    .click();
  await expect(
    page.getByRole("tab", { name: "Setup", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("combobox", { name: "Inspect request" }),
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
    note: "Names are aliased for display. Hashes refer to the unchanged originals.",
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
  await expect(page.locator(".rv-alias-note")).toHaveAttribute(
    "title",
    /unchanged originals/,
  );
  await page.getByText("Start", { exact: true }).click();
  await expect(page.locator(".rv-anchor").first()).toContainText(
    "Invented recorded starting anchor.",
  );
  await page.locator(".rv-agent-trigger").first().click();
  const preview = page.getByRole("region", { name: "Turn 1 agent" });
  await expect(preview).toContainText("pinned");
  const rect = await preview.boundingBox(),
    viewport = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
  await preview
    .getByRole("button", { name: "Prompt and context", exact: true })
    .click();
  const receipt = page.getByRole("region", { name: "Turn request details" });
  await expect(receipt.locator(".hash-line")).toHaveAttribute(
    "title",
    /invented-displayed-hash/,
  );
  await expect(
    receipt.getByText("Provider payload (aliased)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("End", { exact: true })).toBeVisible();
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

test("view settings switch to a compact chat layout and persist", async ({
  page,
}) => {
  await page.goto(`/?run=script-path-screening&case=${second}`);
  await expect(page.locator(".rv-script .rv-turn")).toHaveCount(8);
  await page.getByRole("button", { name: "View ▾" }).click();
  const panel = page.getByRole("dialog", { name: "View settings" });
  await panel.getByRole("radio", { name: "Chat" }).click();
  await panel.getByRole("radio", { name: "Small" }).click();
  await panel.getByLabel("Turn numbers").uncheck();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".result-viewer")).toHaveClass(/rv-chat/);
  await expect(page.locator(".rv-bubble")).toHaveCount(8);
  await expect(page.locator(".rv-turn-number")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Jump to turn" })).toHaveCount(0);
  const sides = await page
    .locator(".rv-script .rv-turn")
    .evaluateAll((turns) => turns.map((t) => getComputedStyle(t).alignSelf));
  expect(sides.slice(0, 2)).toEqual(["flex-start", "flex-end"]);
  await page.reload();
  await expect(page.locator(".result-viewer")).toHaveClass(/rv-chat/);
  await page.getByRole("tab", { name: "Compare", exact: true }).click();
  await expect(page.locator(".dialogue .rv-bubble").first()).toBeVisible();
  await page.getByRole("button", { name: "View ▾" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("tab", { name: "Dialogue", exact: true }).click();
  await expect(page.locator(".result-viewer")).not.toHaveClass(/rv-chat/);
});
