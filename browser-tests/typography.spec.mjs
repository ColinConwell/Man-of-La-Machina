import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { test, expect } from "../../../apps/web/node_modules/@playwright/test/index.mjs";

const fonts = [
  ["classic", "Georgia"],
  ["garamond", "EB Garamond"],
  ["fell", "IM Fell English"],
  ["quintessential", "Quintessential"],
  ["italianno", "Italianno"],
  ["blackletter", "UnifrakturMaguntia"],
];
const field = (page, name) => page.locator(`#setting-${name}`);
const openPanel = async (page) => {
  const toggle = page.getByRole("button", { name: "Design Controls", exact: true });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
};
const closePanel = (page) => page.keyboard.press("Escape");
const importSettings = (page, settings) => page.getByLabel("Import Preset JSON").setInputFiles({
  name: "type-study.json", mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, settings })),
});
const firstFamily = locator => locator.evaluate(el => getComputedStyle(el).fontFamily.split(",")[0].replaceAll('"', "").trim());

async function expectLoadedFont(page, id, family) {
  if (id === "classic") return;
  const faces = await page.evaluate(async name => {
    const loaded = await document.fonts.load(`24px "${name}"`, "“A road invites us to begin.” — Andalucía");
    return loaded.map(face => ({ family: face.family.replaceAll('"', ""), status: face.status }));
  }, family);
  // FontFaceSet.check alone also succeeds for a missing font with a fallback.
  expect(faces.length).toBeGreaterThan(0);
  expect(faces.every(face => face.family === family && face.status === "loaded")).toBe(true);
}

async function expectContainedText(page) {
  const escaped = await page.locator(".preview-frame").evaluateAll(frames => frames.flatMap((frame, pane) => {
    const bounds = frame.querySelector(".reading-inner").getBoundingClientRect();
    const failures = [];
    for (const span of frame.querySelectorAll(".message .veil-text, .chapter-heading h1 span")) {
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

test("selected faces load as real local fonts while interface labels remain readable", async ({ page }) => {
  const errors = [], requests = [], fontResponses = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
  page.on("response", response => { if (/\.woff2(?:\?|$)/.test(response.url())) fontResponses.push({ url: response.url(), status: response.status() }); });
  await page.goto("/"); await openPanel(page);
  const bylineFamily = await firstFamily(page.locator(".message-byline").first());
  const controlsFamily = await firstFamily(page.locator(".audio-message small").first());
  for (const [id, family] of fonts) {
    await field(page, "headingFont").selectOption(id);
    await field(page, "readingFont").selectOption(id);
    await expect(page.locator(".preview-frame")).toHaveAttribute("data-heading-font", id);
    await expect(page.locator(".preview-frame")).toHaveAttribute("data-reading-font", id);
    await expectLoadedFont(page, id, family);
    expect(await firstFamily(page.locator(".chapter-heading h1"))).toBe(family);
    expect(await firstFamily(page.locator(".human-message .dialogue"))).toBe(family);
    expect(await firstFamily(page.locator(".message-byline").first())).toBe(bylineFamily);
    expect(await firstFamily(page.locator(".audio-message small").first())).toBe(controlsFamily);
  }
  const origin = new URL(page.url()).origin;
  expect(fontResponses).toHaveLength(5);
  expect(fontResponses.every(response => response.status === 200 && new URL(response.url).origin === origin)).toBe(true);
  expect(requests.filter(request => request.method !== "GET" || (new URL(request.url).origin !== origin && !request.url.startsWith("data:") && !request.url.startsWith("blob:")))).toEqual([]);
  expect(requests.filter(request => new URL(request.url).pathname.startsWith("/api/"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("font settings persist, export, import and accept presets created before typography", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  const expected = { headingFont: "blackletter", readingFont: "garamond", travelerFont: "quintessential", companionFont: "italianno", textScale: 1.35 };
  for (const [name, value] of Object.entries(expected)) {
    if (name === "textScale") { await field(page, name).focus(); await page.keyboard.press("End"); }
    else await field(page, name).selectOption(value);
  }
  await page.reload(); await openPanel(page);
  for (const [name, value] of Object.entries(expected)) await expect(field(page, name)).toHaveValue(String(value));
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const filename = await (await downloadEvent).path();
  const exported = JSON.parse(await readFile(filename, "utf8"));
  expect(exported.schemaVersion).toBe(1);
  expect(exported.settings).toMatchObject(expected);
  await page.getByRole("button", { name: "Reset All Settings" }).click();
  await page.getByLabel("Import Preset JSON").setInputFiles(filename);
  for (const [name, value] of Object.entries(expected)) await expect(field(page, name)).toHaveValue(String(value));
  await importSettings(page, { scene: "windmills", veilMode: "messages", companionAlign: "right" });
  for (const [name, value] of Object.entries({ headingFont: "classic", readingFont: "classic", travelerFont: "inherit", companionFont: "inherit", textScale: 1 }))
    await expect(field(page, name)).toHaveValue(String(value));
  await expect(field(page, "scene")).toHaveValue("windmills");
  await expect(field(page, "companionAlign")).toHaveValue("right");
  for (const [invalid, error] of [[{ readingFont: "unavailable-font" }, "unsupported readingFont"], [{ textScale: 2 }, "invalid textScale"]]) {
    await importSettings(page, invalid);
    await expect(page.locator(".preset-status")).toContainText(error);
    await expect(field(page, "readingFont")).toHaveValue("classic");
    await expect(field(page, "textScale")).toHaveValue("1");
  }
});

test("the preview distributes font attribution and complete matching licenses locally", async ({ request }) => {
  const index = await request.get("/font-licenses/index.html");
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain("OFL");
  const response = await request.get("/font-licenses/manifest.json");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.fonts.map(font => font.family).sort()).toEqual(fonts.slice(1).map(([, family]) => family).sort());
  for (const font of manifest.fonts) {
    expect(font.license.spdx).toBe("OFL-1.1");
    const license = await request.get(`/font-licenses/${font.license.file}`);
    expect(license.status()).toBe(200);
    const body = await license.body();
    expect(body.toString("utf8")).toContain("SIL OPEN FONT LICENSE");
    expect(body.length).toBe(font.license.bytes);
    expect(createHash("sha256").update(body).digest("hex")).toBe(font.license.sha256);
  }
});

test("speaker overrides and type pairings preserve independent landscape and layout settings", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "scene").selectOption("aqueduct");
  await field(page, "treatment").selectOption("ink-sepia");
  await field(page, "layout").selectOption("conversation");
  await field(page, "veilMode").selectOption("contours");
  await field(page, "readingFont").selectOption("garamond");
  await field(page, "travelerFont").selectOption("quintessential");
  await field(page, "companionFont").selectOption("italianno");
  for (const state of ["reader", "comparison"]) {
    await field(page, "schematic").selectOption(state);
    for (const [speaker, id, family] of [["traveler", "quintessential", "Quintessential"], ["companion", "italianno", "Italianno"]]) {
      await expectLoadedFont(page, id, family);
      await expect(page.locator(`.message[data-speaker="${speaker}"]`).first()).toHaveAttribute("data-font", id);
      expect(await firstFamily(page.locator(`.message[data-speaker="${speaker}"] p`).first())).toBe(family);
    }
  }
  const speakerText = page.locator('.message[data-speaker="traveler"] > p').first();
  const fontSize = () => speakerText.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const originalSize = await fontSize();
  await field(page, "textScale").focus(); await page.keyboard.press("End");
  expect((await fontSize()) / originalSize).toBeCloseTo(1.35, 2);
  await page.keyboard.press("Home");
  expect((await fontSize()) / originalSize).toBeCloseTo(.85, 2);
  for (const [name, heading, reading] of [["Renaissance Book", "garamond", "garamond"], ["Quill & Print", "fell", "quintessential"], ["Flowing Script", "garamond", "italianno"], ["Blackletter Title", "blackletter", "garamond"]]) {
    await field(page, "travelerFont").selectOption("fell");
    await field(page, "companionFont").selectOption("blackletter");
    await page.getByRole("button", { name, exact: true }).click();
    for (const [setting, value] of Object.entries({ headingFont: heading, readingFont: reading, travelerFont: "inherit", companionFont: "inherit", scene: "aqueduct", treatment: "ink-sepia", layout: "conversation", veilMode: "contours", textScale: "0.85" }))
      await expect(field(page, setting)).toHaveValue(value);
    for (const message of await page.locator(".message").all()) await expect(message).toHaveAttribute("data-font", reading);
  }
});

test("A/B retains its own fonts and speaker overrides with identical content", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "headingFont").selectOption("blackletter");
  await field(page, "readingFont").selectOption("garamond");
  await field(page, "companionFont").selectOption("quintessential");
  await page.getByRole("button", { name: "Pin Current Design as A" }).click();
  await field(page, "headingFont").selectOption("fell");
  await field(page, "readingFont").selectOption("italianno");
  await field(page, "companionFont").selectOption("inherit");
  await field(page, "density").selectOption("long");
  await closePanel(page);
  for (const [id, family] of fonts.slice(1)) await expectLoadedFont(page, id, family);
  const a = page.getByRole("region", { name: "Design A", exact: true });
  const b = page.getByRole("region", { name: "Design B", exact: true });
  await expect(a).toHaveAttribute("data-heading-font", "blackletter");
  await expect(b).toHaveAttribute("data-heading-font", "fell");
  expect(await firstFamily(a.locator(".chapter-heading h1"))).toBe("UnifrakturMaguntia");
  expect(await firstFamily(b.locator(".chapter-heading h1"))).toBe("IM Fell English");
  expect(await firstFamily(a.locator(".human-message .dialogue"))).toBe("EB Garamond");
  expect(await firstFamily(a.locator(".machine-message .dialogue"))).toBe("Quintessential");
  expect(await firstFamily(b.locator(".human-message .dialogue"))).toBe("Italianno");
  expect(await firstFamily(b.locator(".machine-message .dialogue"))).toBe("Italianno");
  expect(await a.locator(".reading-inner").textContent()).toBe(await b.locator(".reading-inner").textContent());
  await expectContainedText(page);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`all fonts contain long text in message and contour veils at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto("/"); await openPanel(page);
    await field(page, "density").selectOption("long");
    await page.getByRole("button", { name: "Traveler Left · Companion Right", exact: true }).click();
    await field(page, "textScale").focus(); await page.keyboard.press("End");
    for (const [id, family] of fonts) {
      await field(page, "headingFont").selectOption(id);
      await field(page, "readingFont").selectOption(id);
      await expectLoadedFont(page, id, family);
      for (const veil of ["messages", "contours"]) {
        await field(page, "veilMode").selectOption(veil);
        for (const state of ["reader", "comparison"]) {
          await field(page, "schematic").selectOption(state);
          await closePanel(page);
          await expectContainedText(page);
          expect(await page.locator(".story-scroll").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
          await openPanel(page);
        }
      }
    }
  });
}

test("heading and reading families remain coherent in every schematic state and layout", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "headingFont").selectOption("fell");
  await field(page, "readingFont").selectOption("quintessential");
  await field(page, "density").selectOption("long");
  await expectLoadedFont(page, "fell", "IM Fell English");
  await expectLoadedFont(page, "quintessential", "Quintessential");
  const prose = { reader: ".dialogue", branching: ".branch-root p", comparison: ".comparison-passages .message > p", events: ".event p", editorial: ".editorial-passage > p", onboarding: ".first-visit > p" };
  for (const layout of ["conversation", "folio", "theater"]) {
    await field(page, "layout").selectOption(layout);
    for (const [state, selector] of Object.entries(prose)) {
      await field(page, "schematic").selectOption(state);
      expect(await firstFamily(page.locator(".chapter-heading h1"))).toBe("IM Fell English");
      expect(await firstFamily(page.locator(selector).first())).toBe("Quintessential");
      await expectContainedText(page);
    }
  }
});
