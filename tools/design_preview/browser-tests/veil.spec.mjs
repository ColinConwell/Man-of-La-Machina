import { readFile } from "node:fs/promises";
import { test, expect } from "../../../apps/web/node_modules/@playwright/test/index.mjs";

const field = (page, name) => page.locator(`#setting-${name}`);
const openPanel = async (page) => {
  const toggle = page.getByRole("button", { name: "Design Controls", exact: true });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
};
const closePanel = (page) => page.keyboard.press("Escape");
const importSettings = (page, settings) => page.getByLabel("Import Preset JSON").setInputFiles({
  name: "veil-study.json", mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, settings })),
});

// Inspect rendered line fragments, not just scrollWidth: inline contour padding
// can escape a message even when its block-level parent reports no overflow.
async function expectContainedText(page) {
  const escaped = await page.locator(".preview-frame").evaluateAll(frames => frames.flatMap((frame, pane) => {
    const bounds = frame.querySelector(".reading-inner").getBoundingClientRect();
    const failures = [];
    for (const span of frame.querySelectorAll(".message .veil-text")) {
      for (const line of span.getClientRects()) {
        if (line.left < bounds.left - 1 || line.right > bounds.right + 1)
          failures.push({ pane, text: span.textContent.slice(0, 35), left: line.left - bounds.left, right: line.right - bounds.right });
      }
    }
    const canvas = frame.querySelector(".preview-canvas");
    if (canvas.scrollWidth > canvas.clientWidth + 1) failures.push({ pane, canvasOverflow: canvas.scrollWidth - canvas.clientWidth });
    return failures;
  }));
  expect(escaped).toEqual([]);
}

async function windowVeilGeometry(page) {
  return page.locator(".reading-area").evaluate(el => {
    const style = getComputedStyle(el, "::before");
    const area = el.getBoundingClientRect();
    const inner = el.querySelector(".reading-inner").getBoundingClientRect();
    const left = area.left + parseFloat(style.left);
    const right = area.right - parseFloat(style.right);
    return { width: right - left, innerWidth: inner.width, leftGap: inner.left - left, rightGap: right - inner.right, surface: style.backgroundColor };
  });
}

test("automatic veil resizes with the reading window and contains long passages", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "veilMode").selectOption("window");
  await field(page, "density").selectOption("long");
  await closePanel(page);
  const desktop = await windowVeilGeometry(page);
  expect(desktop.width).toBeGreaterThan(1000);
  expect(desktop.leftGap).toBeGreaterThan(0);
  expect(desktop.rightGap).toBeGreaterThan(0);
  expect(desktop.surface).not.toBe("rgba(0, 0, 0, 0)");
  await expectContainedText(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await windowVeilGeometry(page);
  expect(mobile.width).toBeLessThan(390);
  expect(mobile.width).toBeGreaterThan(330);
  expect(mobile.width).toBeLessThan(desktop.width / 2);
  expect(mobile.innerWidth).toBeLessThan(desktop.innerWidth / 2);
  expect(mobile.leftGap).toBeGreaterThan(0);
  expect(mobile.rightGap).toBeGreaterThan(0);
  await expectContainedText(page);
});

test("speaker placement and text alignment remain independent in reading and comparison", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "veilMode").selectOption("window");
  await field(page, "density").selectOption("long");
  await page.getByRole("button", { name: "Traveler Left · Companion Right", exact: true }).click();
  await field(page, "travelerAlign").selectOption("right");
  await field(page, "companionAlign").selectOption("justify");
  for (const state of ["reader", "comparison"]) {
    await field(page, "schematic").selectOption(state);
    await closePanel(page);
    const geometry = await page.locator(".message").evaluateAll(messages => messages.map(message => {
      const box = message.getBoundingClientRect(), parent = message.parentElement.getBoundingClientRect();
      const style = getComputedStyle(message.parentElement);
      const parentLeft = parent.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
      const parentRight = parent.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      return { speaker: message.dataset.speaker, leftGap: box.left - parentLeft, rightGap: parentRight - box.right, align: getComputedStyle(message.querySelector("p")).textAlign };
    }));
    expect(geometry.length).toBe(state === "reader" ? 4 : 2);
    for (const message of geometry) {
      if (message.speaker === "traveler") {
        expect(Math.abs(message.leftGap)).toBeLessThan(1);
        expect(message.rightGap).toBeGreaterThan(10);
        expect(message.align).toBe("right");
      } else {
        expect(message.leftGap).toBeGreaterThan(10);
        expect(Math.abs(message.rightGap)).toBeLessThan(1);
        expect(message.align).toBe("justify");
      }
    }
    await expectContainedText(page);
    await openPanel(page);
  }
  await closePanel(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectContainedText(page);
});

test("beveled messages hug content and contour surfaces reflow without clipping", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "veilMode").selectOption("messages");
  await field(page, "density").selectOption("long");
  await page.getByRole("button", { name: "Traveler Left · Companion Right", exact: true }).click();
  await closePanel(page);
  const boxes = await page.locator(".message").evaluateAll(messages => messages.map(message => {
    const style = getComputedStyle(message);
    return { height: message.getBoundingClientRect().height, radius: parseFloat(style.borderRadius), surface: style.backgroundColor, shadow: style.boxShadow };
  }));
  expect(boxes[2].height).toBeGreaterThan(boxes[0].height * 2);
  expect(boxes[3].height).toBeGreaterThan(boxes[1].height * 2);
  for (const box of boxes) {
    expect(box.radius).toBeGreaterThan(0);
    expect(box.surface).not.toBe("rgba(0, 0, 0, 0)");
    expect(box.shadow).toContain("inset");
  }
  await expectContainedText(page);
  await openPanel(page); await field(page, "veilMode").selectOption("contours");
  await field(page, "veilPadding").focus(); await page.keyboard.press("End");
  await closePanel(page);
  const fragmentCount = () => page.locator(".human-message .dialogue .veil-text").evaluate(span => span.getClientRects().length);
  const desktopLines = await fragmentCount();
  expect(desktopLines).toBeGreaterThan(1);
  expect(await page.locator(".human-message .dialogue .veil-text").evaluate(span => getComputedStyle(span).boxDecorationBreak)).toBe("clone");
  await expectContainedText(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await fragmentCount()).toBeGreaterThan(desktopLines);
  await expectContainedText(page);
  await openPanel(page); await field(page, "veilMode").selectOption("messages"); await closePanel(page);
  await expectContainedText(page);
});

test("new veil and typography settings persist, export, and accept older presets", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "veilMode").selectOption("contours");
  await field(page, "veilPadding").focus(); await page.keyboard.press("End");
  await field(page, "messageWidth").focus(); await page.keyboard.press("Home");
  await field(page, "travelerPosition").selectOption("center");
  await field(page, "travelerAlign").selectOption("justify");
  await field(page, "companionPosition").selectOption("right");
  await field(page, "companionAlign").selectOption("right");
  await field(page, "treatment").selectOption("ink-sepia");
  const expected = { veilMode: "contours", veilPadding: 40, messageWidth: .55, travelerPosition: "center", travelerAlign: "justify", companionPosition: "right", companionAlign: "right", treatment: "ink-sepia" };
  await page.reload(); await openPanel(page);
  for (const [name, value] of Object.entries(expected)) await expect(field(page, name)).toHaveValue(String(value));
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadEvent;
  const filename = await download.path();
  expect(JSON.parse(await readFile(filename, "utf8")).settings).toMatchObject(expected);
  await page.getByRole("button", { name: "Reset All Settings" }).click();
  await page.getByLabel("Import Preset JSON").setInputFiles(filename);
  for (const [name, value] of Object.entries(expected)) await expect(field(page, name)).toHaveValue(String(value));
  await importSettings(page, { theme: "sage", density: "long", treatment: "sepia" });
  await expect(field(page, "theme")).toHaveValue("sage");
  await expect(field(page, "veilMode")).toHaveValue("column");
  await expect(field(page, "travelerPosition")).toHaveValue("full");
  await expect(field(page, "companionAlign")).toHaveValue("left");
  await expect(field(page, "messageWidth")).toHaveValue("0.88");
  await importSettings(page, { veilMode: "contours", veilPadding: 500 });
  await expect(page.locator(".preset-status")).toContainText("invalid veilPadding");
  await expect(field(page, "veilMode")).toHaveValue("column");
});

test("A/B keeps the pinned veil and speaker styles with identical schematic content", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "veilMode").selectOption("window");
  await page.getByRole("button", { name: "Traveler Left · Companion Right", exact: true }).click();
  await page.getByRole("button", { name: "Pin Current Design as A" }).click();
  await field(page, "veilMode").selectOption("messages");
  await field(page, "companionPosition").selectOption("left");
  await field(page, "companionAlign").selectOption("center");
  await field(page, "density").selectOption("long");
  await closePanel(page);
  const a = page.getByRole("region", { name: "Design A", exact: true });
  const b = page.getByRole("region", { name: "Design B", exact: true });
  await expect(a.locator(".reading-area")).toHaveClass(/veil-window/);
  await expect(b.locator(".reading-area")).toHaveClass(/veil-messages/);
  expect(await a.locator(".reading-inner").textContent()).toBe(await b.locator(".reading-inner").textContent());
  await expect(a.locator(".machine-message").first()).toHaveClass(/position-right align-right/);
  await expect(b.locator(".machine-message").first()).toHaveClass(/position-left align-center/);
  await expectContainedText(page);
});

test("sepia ink and graphite treatments leave the interface palette unchanged", async ({ page }) => {
  const errors = [], apiRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  await page.goto("/"); await openPanel(page);
  await field(page, "theme").selectOption("sage");
  const colors = () => page.locator(".chapter-heading h1, .message-byline, .primary-story, .playback-panel").evaluateAll(elements => elements.map(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor })));
  const originalColors = await colors();
  for (const [treatment, shortcut] of [["ink-sepia", "Sepia Ink"], ["graphite", "Graphite"]]) {
    await page.getByRole("button", { name: shortcut, exact: true }).click();
    await expect(field(page, "treatment")).toHaveValue(treatment);
    await expect(page.locator(".sketch-illustration")).toHaveCount(1);
    expect(await page.locator(".sketch-hatching").evaluate(el => getComputedStyle(el).opacity)).not.toBe("0");
    expect(await colors()).toEqual(originalColors);
    expect(await page.locator(".reading-area").evaluate(el => getComputedStyle(el).filter)).toBe("none");
  }
  expect(errors).toEqual([]); expect(apiRequests).toEqual([]);
});
