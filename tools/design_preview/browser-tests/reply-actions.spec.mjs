import { test, expect } from "../../../apps/web/node_modules/@playwright/test/index.mjs";
import { parsePreset, serializePreset, DEFAULTS } from "../web/settings.mjs";
const open = page => page.getByRole("button", { name: "Design Controls", exact: true }).click();
const choose = async (page, layout) => {
  await open(page);
  await page.getByRole("combobox", { name: "Reply Actions", exact: true }).selectOption(layout);
  await page.getByRole("button", { name: "Close Design Controls", exact: true }).click();
};

test("all reply studies fit desktop and mobile without duplicating the composer or context", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 988 });
    for (const layout of ["composer", "tabs", "reading", "suggestions", "attached"]) {
      await choose(page, layout);
      await expect(page.locator(".composer-panel")).toHaveCount(0);
      await expect(page.locator(".journey-context, .context-fallback")).toHaveCount(0);
      if (["reading", "attached"].includes(layout)) await page.locator(".disclosure-respond > summary").click();
      await expect(page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true })).toBeVisible();
      if (layout === "tabs") await page.getByRole("tab", { name: "Explore Context" }).click();
      else await page.locator(".disclosure-context > summary").click();
      await expect(page.getByText("Context · Illustrative", { exact: true })).toBeVisible();
      const geometry = await page.locator(".preview-canvas").evaluate(el => {
        const r = el.getBoundingClientRect();
        return { overflow: el.scrollWidth - el.clientWidth, controls: [...el.querySelectorAll('.reply-study button, .reply-study summary, .reply-study textarea')].filter(x => x.getClientRects().length).map(x => { const b = x.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1; }) };
      });
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.controls.every(Boolean)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("tabs support keyboard navigation and retain only an in-memory draft", async ({ page }) => {
  const outgoing = [];
  page.on("request", request => { if (request.method() !== "GET") outgoing.push(request.url()); });
  await page.goto("/"); await choose(page, "tabs");
  await page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true }).fill("A temporary visitor reply");
  const respond = page.getByRole("tab", { name: "Try Your Own Reply" });
  await respond.focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Read Original Reply" })).toBeFocused();
  await expect(page.getByText("Original Reply · Illustrative")).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Explore Context" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true })).toHaveValue("A temporary visitor reply");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("A temporary visitor reply");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Try Your Own Reply" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true })).toHaveValue("");
  expect(outgoing).toEqual([]);
});

test("suggestions fill the composer and reply layouts persist in saved, exported and pinned designs", async ({ page }) => {
  await page.goto("/"); await choose(page, "suggestions");
  await page.getByRole("button", { name: "Challenge the Premise" }).click();
  await expect(page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true })).toHaveValue("Must I choose only one path?");
  await expect(page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true })).toBeFocused();
  await open(page);
  await page.getByRole("button", { name: "Save Configuration", exact: true }).click();
  await page.getByRole("combobox", { name: "Reply Actions", exact: true }).selectOption("reading");
  await page.getByLabel("Saved Configurations").selectOption("Default Mod A");
  await page.getByRole("button", { name: "Load Configuration" }).click();
  await expect(page.getByRole("combobox", { name: "Reply Actions", exact: true })).toHaveValue("suggestions");
  await page.getByRole("button", { name: "Pin Current Design as A" }).click();
  await page.getByRole("combobox", { name: "Reply Actions", exact: true }).selectOption("composer");
  await expect(page.getByRole("region", { name: "Design A", exact: true }).locator(".reply-study-suggestions")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Design B", exact: true }).locator(".reply-study-composer")).toHaveCount(1);
  expect(parsePreset(serializePreset({ ...DEFAULTS, replyLayout: "attached" })).replyLayout).toBe("attached");
  expect(parsePreset('{"schemaVersion":1,"settings":{}}').replyLayout).toBe("buttons");
  await page.getByLabel("Import Preset JSON").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"schemaVersion":1,"settings":{"replyLayout":"invalid"}}') });
  await expect(page.locator(".preset-status")).toContainText("unsupported replyLayout");
  await expect(page.getByRole("combobox", { name: "Reply Actions", exact: true })).toHaveValue("composer");
});

test("one animation button cycles play, pause, off and restores play without changing layers", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await page.getByLabel("Animation Layers", { exact: true }).selectOption("atmosphere");
  await page.getByRole("button", { name: "Close Design Controls", exact: true }).click();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Animation: Play. Switch to Pause" }).click();
  for (const landscape of await page.locator(".landscape").all()) await expect(landscape).toHaveClass(/is-still/);
  await expect(page.locator(".cloud-one").first()).toHaveCSS("animation-play-state", "paused");
  await page.getByRole("button", { name: "Animation: Pause. Switch to Off" }).click();
  await expect(page.locator(".atmosphere-layer, .illustration-layer, .brush-wash")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Animation: Off. Switch to Play" })).toBeVisible();
  await page.getByRole("button", { name: "Animation: Off. Switch to Play" }).click();
  await expect(page.locator(".cloud-one")).toHaveCSS("animation-play-state", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".landscape")).toHaveClass(/is-still/);
  await open(page);
  await expect(page.getByLabel("Animation Layers", { exact: true })).toHaveValue("atmosphere");
});

test("reply field starts at one line, grows with typing and shrinks after deletion at desktop and mobile widths", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/"); await choose(page, "composer");
  const field = page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true });
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 988 });
    await field.fill("");
    await expect(field).toHaveAttribute("rows", "1");
    await expect(field).toHaveCSS("resize", "none");
    const initial = await field.evaluate(el => ({ height: el.clientHeight, line: parseFloat(getComputedStyle(el).lineHeight), padding: parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom) }));
    expect(Math.abs(initial.height - initial.line - initial.padding)).toBeLessThanOrEqual(2);
    const label = await page.locator(".reply-entry-label").boundingBox();
    const box = await page.locator(".reply-composer").boundingBox();
    expect(label.y + label.height).toBeLessThan(box.y);
    await field.fill("I want to discover what lies beyond the familiar road. ".repeat(12));
    const grown = await field.evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight }));
    expect(grown.height).toBeGreaterThan(initial.height * 3);
    expect(grown.content - grown.height).toBeLessThanOrEqual(1);
    await field.fill("A shorter reply.");
    await expect.poll(() => field.evaluate(el => el.clientHeight)).toBeLessThan(grown.height);
    await field.fill("");
    await expect.poll(() => field.evaluate(el => el.clientHeight)).toBe(initial.height);
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await expect(page.locator(".reply-submit-row kbd svg")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("placeholder options follow Human Font and respect pause, off, focus and reduced motion", async ({ page }) => {
  await page.goto("/"); await choose(page, "composer");
  const placeholder = page.locator(".reply-placeholders span").first();
  await expect(placeholder).toHaveCSS("font-family", /Allison/);
  const animationTime = () => placeholder.evaluate(el => el.getAnimations()[0]?.currentTime);
  const start = await animationTime();
  await expect.poll(animationTime).toBeGreaterThan(start);
  await page.getByRole("button", { name: "Animation: Play. Switch to Pause" }).click();
  await expect(placeholder).toHaveCSS("animation-play-state", "paused");
  await page.getByRole("button", { name: "Animation: Pause. Switch to Off" }).click();
  await expect(placeholder).toHaveCSS("animation-name", "none");
  await expect(placeholder).toHaveCSS("opacity", "1");
  await expect(page.locator(".reply-placeholders span").nth(1)).toHaveCSS("opacity", "0");
  await open(page);
  await page.getByLabel("Human Font", { exact: true }).selectOption("noto-serif");
  await expect(placeholder).toHaveCSS("font-family", /Noto Serif/);
  await expect(placeholder).toHaveCSS("font-weight", "300");
  await page.getByLabel("Human Font", { exact: true }).selectOption("inherit");
  await page.getByLabel("Reading Font", { exact: true }).selectOption("garamond");
  await expect(placeholder).toHaveCSS("font-family", /EB Garamond/);
  await page.getByRole("button", { name: "Close Design Controls", exact: true }).click();
  await page.getByRole("button", { name: "Animation: Off. Switch to Play" }).click();
  const field = page.getByRole("textbox", { name: "Enter the journey with your own reply...", exact: true });
  await field.focus();
  await expect(page.locator(".reply-placeholders")).toHaveCSS("visibility", "hidden");
  await field.fill("My own words");
  await page.getByRole("heading", { name: "A Turning Point", exact: true }).click();
  await expect(page.locator(".reply-placeholders")).toHaveCSS("visibility", "hidden");
  await field.fill("");
  await page.getByRole("heading", { name: "A Turning Point", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(placeholder).toHaveCSS("animation-name", "none");
  await expect(placeholder).toHaveCSS("opacity", "1");
});

test("placeholder-only is the default and reveals each prompt from left to right without scenery motion", async ({ page }) => {
  await page.goto("/"); await choose(page, "composer");
  await expect(page.locator(".landscape")).toHaveClass(/motion-placeholder/);
  await expect(page.locator(".atmosphere-layer, .illustration-layer, .brush-wash")).toHaveCount(0);
  await expect(page.locator(".landscape-painting")).toBeVisible();
  const placeholder = page.locator(".reply-placeholders span").first();
  await expect(placeholder).toHaveCSS("animation-name", "reply-placeholder-write");
  const reveals = await placeholder.evaluate(el => {
    const animation = el.getAnimations()[0];
    animation.pause();
    const duration = animation.effect.getTiming().duration;
    return [.03, .12, .22].map(phase => {
      animation.currentTime = duration * phase;
      const style = getComputedStyle(el);
      return { right: Number(style.clipPath.match(/([\d.]+)%/)?.[1] || 0), left: style.clipPath.match(/(-?[\d.]+px)\)$/)?.[1], opacity: style.opacity, transform: style.transform };
    });
  });
  expect(reveals[0].right).toBeGreaterThan(reveals[1].right);
  expect(reveals[1].right).toBeGreaterThan(reveals[2].right);
  expect(reveals[2].right).toBe(0);
  expect(reveals.map(r => r.opacity)).toEqual(["1", "1", "1"]);
  expect(new Set(reveals.map(r => r.left)).size).toBe(1);
  expect(reveals.map(r => r.transform)).toEqual(["none", "none", "none"]);
  await open(page);
  await expect(page.getByLabel("Animation Layers", { exact: true })).toHaveValue("placeholder");
  await expect(page.getByLabel("Intensity", { exact: true })).toHaveCount(0);
  await page.getByLabel("Speed", { exact: true }).fill("2");
  await expect(placeholder).toHaveCSS("animation-duration", "6s");
  await page.getByLabel("Animation Layers", { exact: true }).selectOption("none");
  await expect(placeholder).toHaveCSS("animation-name", "none");
  await page.getByLabel("Animation Layers", { exact: true }).selectOption("placeholder");
  await page.reload(); await open(page);
  await expect(page.getByLabel("Animation Layers", { exact: true })).toHaveValue("placeholder");
  await expect(page.getByLabel("Speed", { exact: true })).toHaveValue("2");
  expect(parsePreset(serializePreset(DEFAULTS)).motion).toBe("placeholder");
});
