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
  ["uncial", "Uncial Antiqua"],
  ["tapestry", "Tapestry"],
  ["lovers-quarrel", "Lovers Quarrel"],
  ["monte-carlo", "MonteCarlo"],
  ["mea-culpa", "Mea Culpa"],
  ["monsieur", "Monsieur La Doulaise"],
  ["ruthie", "Ruthie"],
  ["allison", "Allison"],
  ["birthstone", "Birthstone"],
  ["ballet", "Ballet"],
  ["updock", "Updock"],
  ["rouge-script", "Rouge Script"],
  ["ibm-plex-serif", "IBM Plex Serif"],
  ["tektur", "Tektur"],
  ["anta", "Anta"],
  ["tomorrow", "Tomorrow"],
  ["syne-mono", "Syne Mono"],
  ["oxanium", "Oxanium"],
  ["noto-serif", "Noto Serif"],
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
  const weight = id === "noto-serif" ? "300" : "400";
  const faces = await page.evaluate(async ({ name, weight }) => {
    const loaded = await document.fonts.load(`${weight} 24px "${name}"`, "“A road invites us to begin.” — Andalucía");
    return loaded.map(face => ({ family: face.family.replaceAll('"', ""), status: face.status, weight: face.weight }));
  }, { name: family, weight });
  // FontFaceSet.check alone also succeeds for a missing font with a fallback.
  expect(faces.length).toBeGreaterThan(0);
  expect(faces.every(face => face.family === family && face.status === "loaded" && face.weight === weight)).toBe(true);
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

test("all 24 bundled faces load locally at their intended weights throughout the schematic app", async ({ page }) => {
  const errors = [], requests = [], fontResponses = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
  page.on("response", response => { if (/\.woff2(?:\?|$)/.test(response.url())) fontResponses.push({ url: response.url(), status: response.status() }); });
  await page.goto("/"); await openPanel(page);
  const studioFamily = await firstFamily(page.locator(".panel-heading h2"));
  for (const [id, family] of fonts) {
    await field(page, "appFont").selectOption(id);
    await field(page, "readingFont").selectOption(id);
    await expect(page.locator(".preview-frame")).toHaveAttribute("data-app-font", id);
    await expect(page.locator(".preview-frame")).toHaveAttribute("data-reading-font", id);
    await expectLoadedFont(page, id, family);
    expect(await firstFamily(page.locator(".chapter-heading h1"))).toBe(family);
    expect(await firstFamily(page.locator(".human-message .dialogue"))).toBe(family);
    expect(await firstFamily(page.locator(".message-byline").first())).toBe(family);
    expect(await firstFamily(page.locator(".audio-message small").first())).toBe(family);
    expect(await firstFamily(page.locator(".primary-story"))).toBe(family);
    expect(await firstFamily(page.locator(".app-header nav button").first())).toBe(family);
    expect(await firstFamily(page.locator(".wordmark"))).toBe(family);
    expect(await firstFamily(page.locator(".panel-heading h2"))).toBe(studioFamily);
  }
  const origin = new URL(page.url()).origin;
  expect(fontResponses).toHaveLength(24);
  expect(fontResponses.every(response => response.status === 200 && new URL(response.url).origin === origin)).toBe(true);
  expect(requests.filter(request => request.method !== "GET" || (new URL(request.url).origin !== origin && !request.url.startsWith("data:") && !request.url.startsWith("blob:")))).toEqual([]);
  expect(requests.filter(request => new URL(request.url).pathname.startsWith("/api/"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("font settings persist, export, import and accept presets created before typography", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  const expected = { appFont: "blackletter", readingFont: "garamond", humanFont: "quintessential", machineFont: "italianno", textScale: 1.35, lineHeight: 2.1 };
  for (const [name, value] of Object.entries(expected)) {
    if (name === "textScale" || name === "lineHeight") { await field(page, name).focus(); await page.keyboard.press("End"); }
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
  for (const oldName of ["headingFont", "travelerFont", "companionFont"]) expect(exported.settings).not.toHaveProperty(oldName);
  await page.getByRole("button", { name: "Reset All Settings" }).click();
  await page.getByLabel("Import Preset JSON").setInputFiles(filename);
  for (const [name, value] of Object.entries(expected)) await expect(field(page, name)).toHaveValue(String(value));
  await importSettings(page, { scene: "windmills", veilMode: "messages", companionAlign: "right" });
  for (const [name, value] of Object.entries({ appFont: "classic", readingFont: "classic", humanFont: "inherit", machineFont: "inherit", textScale: 1, lineHeight: 1.6 }))
    await expect(field(page, name)).toHaveValue(String(value));
  await expect(field(page, "scene")).toHaveValue("windmills");
  await expect(field(page, "companionAlign")).toHaveValue("right");
  for (const [invalid, error] of [[{ readingFont: "unavailable-font" }, "unsupported readingFont"], [{ textScale: 2 }, "invalid textScale"], [{ lineHeight: 1 }, "invalid lineHeight"]]) {
    await importSettings(page, invalid);
    await expect(page.locator(".preset-status")).toContainText(error);
    await expect(field(page, "readingFont")).toHaveValue("classic");
    await expect(field(page, "textScale")).toHaveValue("1");
  }
});

test("previous font aliases migrate in saved and imported presets while canonical values take priority", async ({ page }) => {
  const oldSettings = { headingFont: "fell", readingFont: "garamond", travelerFont: "quintessential", companionFont: "italianno", scene: "aqueduct", textScale: 1.15 };
  await page.addInitScript(settings => {
    if (!localStorage.getItem("la-machina.landscape-studio.v1"))
      localStorage.setItem("la-machina.landscape-studio.v1", JSON.stringify({ schemaVersion: 1, settings }));
  }, oldSettings);
  await page.goto("/"); await openPanel(page);
  const migrated = { appFont: "fell", readingFont: "garamond", humanFont: "quintessential", machineFont: "italianno", scene: "aqueduct", textScale: 1.15, lineHeight: 1.6 };
  for (const [name, value] of Object.entries(migrated)) await expect(field(page, name)).toHaveValue(String(value));
  await page.reload(); await openPanel(page);
  for (const [name, value] of Object.entries(migrated)) await expect(field(page, name)).toHaveValue(String(value));
  await page.getByRole("button", { name: "Reset All Settings" }).click();
  await importSettings(page, oldSettings);
  for (const [name, value] of Object.entries(migrated)) await expect(field(page, name)).toHaveValue(String(value));
  await importSettings(page, { ...oldSettings, appFont: "anta", humanFont: "inherit", machineFont: "noto-serif", lineHeight: 1.8 });
  for (const [name, value] of Object.entries({ appFont: "anta", humanFont: "inherit", machineFont: "noto-serif", readingFont: "garamond", lineHeight: 1.8 }))
    await expect(field(page, name)).toHaveValue(String(value));
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exported = JSON.parse(await readFile(await (await downloadEvent).path(), "utf8"));
  expect(exported.settings).toMatchObject({ appFont: "anta", humanFont: "inherit", machineFont: "noto-serif" });
  for (const oldName of ["headingFont", "travelerFont", "companionFont"]) expect(exported.settings).not.toHaveProperty(oldName);
});

test("font selectors expose the complete categorized collection after the font sets", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  const expectedIds = fonts.map(([id]) => id).sort();
  for (const name of ["appFont", "readingFont", "humanFont", "machineFont"]) {
    const select = field(page, name);
    const options = await select.locator("option").evaluateAll(nodes => nodes.map(option => option.value));
    expect(options.filter(id => id !== "inherit").sort()).toEqual(expectedIds);
    expect(new Set(options).size).toBe(options.length);
    if (["humanFont", "machineFont"].includes(name)) expect(options[0]).toBe("inherit");
    const groups = await select.locator("optgroup").evaluateAll(nodes => nodes.map(group => ({ label: group.label, ids: Array.from(group.children, option => option.value) })));
    expect(groups.map(group => group.label)).toEqual(["Historical", "Literary", "Machine", "Classic"]);
    expect(groups.every(group => group.label.trim() && group.ids.length)).toBe(true);
    expect(groups.flatMap(group => group.ids).filter(id => id !== "inherit").sort()).toEqual(expectedIds);
  }
  const pairings = page.locator(".type-pairings");
  expect(await pairings.locator("button").count()).toBe(10);
  expect(await pairings.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector("#setting-appFont")) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});

test("app, shared reading and speaker fonts have independent scopes", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "appFont").selectOption("anta");
  await field(page, "readingFont").selectOption("noto-serif");
  await field(page, "humanFont").selectOption("allison");
  await field(page, "machineFont").selectOption("syne-mono");
  for (const [id, family] of [["anta", "Anta"], ["noto-serif", "Noto Serif"], ["allison", "Allison"], ["syne-mono", "Syne Mono"]]) await expectLoadedFont(page, id, family);
  const studioFamily = await firstFamily(page.locator(".panel-heading h2"));
  const uiSelectors = [".wordmark", ".app-header nav button", ".chapter-heading h1", ".message-byline", ".primary-story", ".audio-message small", ".composer-panel > span"];
  for (const selector of uiSelectors) expect(await firstFamily(page.locator(selector).first())).toBe("Anta");
  expect(await firstFamily(page.locator(".human-message .dialogue"))).toBe("Allison");
  expect(await firstFamily(page.locator(".machine-message .dialogue"))).toBe("Syne Mono");
  await field(page, "humanFont").selectOption("inherit");
  expect(await firstFamily(page.locator(".human-message .dialogue"))).toBe("Noto Serif");
  expect(await page.locator(".human-message .dialogue").evaluate(el => getComputedStyle(el).fontWeight)).toBe("300");
  expect(await firstFamily(page.locator(".machine-message .dialogue"))).toBe("Syne Mono");
  await field(page, "readingFont").selectOption("ibm-plex-serif");
  expect(await firstFamily(page.locator(".human-message .dialogue"))).toBe("IBM Plex Serif");
  expect(await firstFamily(page.locator(".machine-message .dialogue"))).toBe("Syne Mono");
  await field(page, "appFont").selectOption("tektur");
  for (const selector of uiSelectors) expect(await firstFamily(page.locator(selector).first())).toBe("Tektur");
  expect(await firstFamily(page.locator(".human-message .dialogue"))).toBe("IBM Plex Serif");
  expect(await firstFamily(page.locator(".machine-message .dialogue"))).toBe("Syne Mono");
  expect(await firstFamily(page.locator(".panel-heading h2"))).toBe(studioFamily);
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
    expect(font.weight).toBe(font.family === "Noto Serif" ? 300 : 400);
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
  await field(page, "humanFont").selectOption("quintessential");
  await field(page, "machineFont").selectOption("italianno");
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
  const sets = [
    ["Quixotic Chronicle", "tapestry", "uncial", "inherit", "inherit", 1, 1.7],
    ["Letters & Logic", "ibm-plex-serif", "noto-serif", "monte-carlo", "syne-mono", 1.05, 1.7],
    ["Courtly Correspondence", "tapestry", "birthstone", "mea-culpa", "monsieur", 1.05, 1.8],
    ["Human & Automaton", "tektur", "ibm-plex-serif", "lovers-quarrel", "oxanium", 1, 1.75],
    ["Flourished Letters", "fell", "rouge-script", "ballet", "ruthie", 1.1, 1.85],
    ["Light & Mechanical", "anta", "noto-serif", "allison", "tomorrow", 1.05, 1.75],
    ["Renaissance Book", "garamond", "garamond", "inherit", "inherit", 1, 1.6],
    ["Quill & Print", "fell", "quintessential", "inherit", "inherit", 1, 1.6],
    ["Flowing Script", "garamond", "italianno", "inherit", "inherit", 1, 1.7],
    ["Blackletter Title", "blackletter", "garamond", "inherit", "inherit", 1, 1.6],
  ];
  for (const [name, appFont, readingFont, humanFont, machineFont, textScale, lineHeight] of sets) {
    await field(page, "humanFont").selectOption("fell");
    await field(page, "machineFont").selectOption("blackletter");
    await field(page, "textScale").focus(); await page.keyboard.press("Home");
    await field(page, "lineHeight").focus(); await page.keyboard.press("End");
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    for (const [setting, value] of Object.entries({ appFont, readingFont, humanFont, machineFont, textScale, lineHeight, scene: "aqueduct", treatment: "ink-sepia", layout: "conversation", veilMode: "contours" }))
      await expect(field(page, setting)).toHaveValue(String(value));
    await expect(page.locator('.message[data-speaker="traveler"]').first()).toHaveAttribute("data-font", humanFont === "inherit" ? readingFont : humanFont);
    await expect(page.locator('.message[data-speaker="companion"]').first()).toHaveAttribute("data-font", machineFont === "inherit" ? readingFont : machineFont);
  }
});

test("A/B retains its own fonts and speaker overrides with identical content", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "appFont").selectOption("blackletter");
  await field(page, "readingFont").selectOption("garamond");
  await field(page, "machineFont").selectOption("quintessential");
  await field(page, "lineHeight").focus(); await page.keyboard.press("End");
  await page.getByRole("button", { name: "Pin Current Design as A" }).click();
  await field(page, "appFont").selectOption("fell");
  await field(page, "readingFont").selectOption("italianno");
  await field(page, "machineFont").selectOption("inherit");
  await field(page, "lineHeight").focus(); await page.keyboard.press("Home");
  await field(page, "density").selectOption("long");
  await closePanel(page);
  for (const [id, family] of fonts.slice(1, 6)) await expectLoadedFont(page, id, family);
  const a = page.getByRole("region", { name: "Design A", exact: true });
  const b = page.getByRole("region", { name: "Design B", exact: true });
  await expect(a).toHaveAttribute("data-app-font", "blackletter");
  await expect(b).toHaveAttribute("data-app-font", "fell");
  expect(await firstFamily(a.locator(".chapter-heading h1"))).toBe("UnifrakturMaguntia");
  expect(await firstFamily(b.locator(".chapter-heading h1"))).toBe("IM Fell English");
  expect(await firstFamily(a.locator(".human-message .dialogue"))).toBe("EB Garamond");
  expect(await firstFamily(a.locator(".machine-message .dialogue"))).toBe("Quintessential");
  expect(await firstFamily(b.locator(".human-message .dialogue"))).toBe("Italianno");
  expect(await firstFamily(b.locator(".machine-message .dialogue"))).toBe("Italianno");
  const leading = locator => locator.evaluate(el => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize));
  expect(await leading(a.locator(".human-message .dialogue"))).toBeCloseTo(2.1, 2);
  expect(await leading(b.locator(".human-message .dialogue"))).toBeCloseTo(1.35, 2);
  expect(await a.locator(".reading-inner").textContent()).toBe(await b.locator(".reading-inner").textContent());
  await expectContainedText(page);
});

test("line spacing changes rendered prose across layouts and veil shapes", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "density").selectOption("long");
  await field(page, "readingFont").selectOption("noto-serif");
  await expectLoadedFont(page, "noto-serif", "Noto Serif");
  for (const layout of ["conversation", "folio", "theater"]) {
    await field(page, "layout").selectOption(layout);
    for (const veil of ["messages", "contours"]) {
      await field(page, "veilMode").selectOption(veil);
      const contourNote = page.getByText("Text-contour veils use at least 1.65× spacing to keep adjacent line surfaces apart.", { exact: true });
      if (veil === "contours") await expect(contourNote).toBeVisible();
      else await expect(contourNote).toHaveCount(0);
      for (const [key, expected] of [["End", 2.1], ["Home", 1.35]]) {
        await field(page, "lineHeight").focus(); await page.keyboard.press(key);
        const leading = await page.locator(".message .dialogue, .message .passage p").evaluateAll(nodes => nodes.map(el => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize)));
        expect(leading.length).toBeGreaterThan(2);
        for (const ratio of leading) expect(ratio).toBeCloseTo(veil === "contours" ? Math.max(1.65, expected) : expected, 2);
        await closePanel(page); await expectContainedText(page); await openPanel(page);
      }
    }
  }
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`all fonts contain long text in message and contour veils at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto("/"); await openPanel(page);
    await field(page, "density").selectOption("long");
    await page.getByRole("button", { name: "Traveler Left · Companion Right", exact: true }).click();
    await field(page, "textScale").focus(); await page.keyboard.press("End");
    for (const [id, family] of fonts) {
      await field(page, "appFont").selectOption(id);
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

test("app and reading families remain independent in every schematic state and layout", async ({ page }) => {
  await page.goto("/"); await openPanel(page);
  await field(page, "appFont").selectOption("fell");
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
      expect(await firstFamily(page.locator(".app-header nav button").first())).toBe("IM Fell English");
      expect(await firstFamily(page.locator(".audio-message small").first())).toBe("IM Fell English");
      await expectContainedText(page);
    }
  }
});
