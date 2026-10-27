import { test, expect } from "../../../apps/web/node_modules/@playwright/test/index.mjs";
import { readFile } from "node:fs/promises";
const field = (page, name) => page.locator(`#setting-${name}`);
const open = async page => {
  const toggle = page.getByRole("button", {name:"Design Controls", exact:true});
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
};
const family = locator => locator.evaluate(el => getComputedStyle(el).fontFamily);

test("new default voices render and the previous settings remain importable", async ({page}) => {
  await page.goto("/"); await open(page);
  for (const [key,value] of Object.entries({appFont:"tektur",readingFont:"ibm-plex-serif",humanFont:"allison",machineFont:"tektur"}))
    await expect(field(page,key)).toHaveValue(value);
  await page.evaluate(() => document.fonts.ready);
  expect(await family(page.locator(".human-message .dialogue"))).toContain("Allison");
  expect(await family(page.locator(".machine-message .dialogue"))).toContain("Tektur");
  expect(await family(page.locator(".chapter-heading h1"))).toContain("Tektur");
  const legacy = { appFont:"classic",readingFont:"garamond",humanFont:"inherit",machineFont:"inherit",scene:"aqueduct",veilMode:"column" };
  await page.getByLabel("Import Preset JSON").setInputFiles({name:"old.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({schemaVersion:1,settings:legacy}))});
  await page.reload(); await open(page);
  for (const [key,value] of Object.entries(legacy)) await expect(field(page,key)).toHaveValue(value);
  await page.getByRole("button", {name:/^Man of La Machina/}).click();
  await expect(field(page,"humanFont")).toHaveValue("allison");
  await expect(field(page,"scene")).toHaveValue("aqueduct");
});

for (const mode of ["cloud","message-clouds","contour-clouds"]) {
  test(`${mode} fits text at desktop, mobile and in A/B with long passages`, async ({page}) => {
    await page.goto("/"); await open(page);
    await field(page,"veilMode").selectOption(mode);
    await field(page,"veilPadding").fill("40");
    await field(page,"density").selectOption("long");
    await page.getByRole("button",{name:"Traveler Left · Companion Right",exact:true}).click();
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.fonts.ready);
    for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      const escaped = await page.locator(".reading-inner").evaluate(inner => {
        const bounds=inner.getBoundingClientRect();
        return [...inner.querySelectorAll(".veil-text")].flatMap(span=>[...span.getClientRects()].filter(line=>line.left<bounds.left-1 || line.right>bounds.right+1).map(line=>({left:line.left-bounds.left,right:line.right-bounds.right})));
      });
      expect(escaped).toEqual([]);
      expect(await page.locator(".preview-canvas").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      expect(await page.locator(".story-scroll").evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
      expect(await page.locator(".human-message .dialogue").evaluate(el=>getComputedStyle(el).filter)).toBe("none");
      if(mode==="cloud") {
        const coverage=await page.locator(".reading-inner").evaluate(el=>{
          const surface=getComputedStyle(el,"::before"), bounds=el.getBoundingClientRect();
          return {bottom:bounds.bottom-parseFloat(surface.bottom), contentBottom:Math.max(...[...el.querySelectorAll(".veil-text, button")].map(node=>node.getBoundingClientRect().bottom)), filter:surface.filter};
        });
        expect(coverage.bottom).toBeGreaterThanOrEqual(coverage.contentBottom);
        expect(coverage.filter).toContain("blur");
      } else if(mode==="message-clouds") {
        expect(await page.locator(".message").first().evaluate(el=>getComputedStyle(el,"::before").filter)).toContain("blur");
      } else {
        expect(await page.locator(".human-message .dialogue .veil-text").evaluate(el=>el.getClientRects().length)).toBeGreaterThan(1);
        expect(await page.locator(".human-message .dialogue .veil-text").evaluate(el=>getComputedStyle(el).boxDecorationBreak)).toBe("clone");
      }
    }
    await page.setViewportSize({width:1440,height:1000}); await open(page);
    await page.getByRole("button",{name:"Pin Current Design as A"}).click();
    await field(page,"veilMode").selectOption("messages");
    await expect(page.locator(".reading-area").first()).toHaveClass(new RegExp(`veil-${mode}`));
    const texts=await page.locator(".reading-inner").allTextContents(); expect(texts[0]).toBe(texts[1]);
    await page.keyboard.press("Escape");
    await page.screenshot({path:`/tmp/machina-${mode}-comparison.png`});
  });
}

test("new landscapes, coherent presets, export and brush motion policy", async ({page}) => {
  const errors=[], external=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:")&&!r.url().startsWith("blob:"))external.push(r.url());});
  await page.goto("/"); await open(page);
  for(const [name,scene,theme,veil] of [["Rose Reverie","rose-windmills","rose","cloud"],["Copper & Code","celadon-circuitry","celadon","message-clouds"],["Mechanical Dusk","lilac-automata","lilac","contour-clouds"]]) {
    await page.getByRole("button",{name,exact:true}).click();
    for(const [key,value] of Object.entries({scene,theme,veilMode:veil,motion:"brush",humanFont:"allison"})) await expect(field(page,key)).toHaveValue(value);
    await expect(page.locator(".landscape-painting")).toHaveJSProperty("complete",true);
    expect(await page.locator(".landscape-painting").evaluate(img=>img.naturalWidth)).toBeGreaterThan(1000);
    await page.keyboard.press("Escape");
    await page.screenshot({path:`/tmp/machina-${scene}-desktop.png`});
    await page.setViewportSize({width:390,height:844});
    expect(await page.locator(".preview-canvas").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await page.screenshot({path:`/tmp/machina-${scene}-mobile.png`});
    await page.setViewportSize({width:1440,height:1000}); await open(page);
  }
  for (const scene of ["clockwork-windmills", "circuit-orchard", "brass-aqueduct"]) {
    await field(page,"scene").selectOption(scene);
    await expect(page.locator(".landscape-painting")).toHaveJSProperty("complete",true);
    expect(await page.locator(".landscape-painting").evaluate(img=>img.naturalWidth)).toBeGreaterThan(1000);
  }
  await field(page,"scene").selectOption("lilac-automata");
  await page.getByRole("button", {name:"Preview Living Brushstrokes",exact:true}).click();
  await expect(page.locator(".design-panel")).toHaveCount(0);
  const bounds=await page.locator(".brush-corner").first().boundingBox();
  const playback=await page.locator(".playback-panel").boundingBox();
  expect(bounds.y + bounds.height).toBeLessThan(playback.y);
  const brush=page.locator(".brush-wash").first();
  const paintedState=()=>page.locator(".brush-wash").evaluateAll(paths=>paths.map(el=>{const s=getComputedStyle(el);return [s.strokeDashoffset,s.opacity];}));
  const initialPaint=await paintedState();
  await expect.poll(paintedState).not.toEqual(initialPaint);
  await open(page);
  expect(await brush.evaluate(el=>getComputedStyle(el).animationName)).toBe("brush-reveal");
  const initial=await brush.evaluate(el=>el.getAnimations()[0].currentTime);
  await expect.poll(()=>brush.evaluate(el=>el.getAnimations()[0].currentTime)).toBeGreaterThan(initial);
  await page.getByRole("button",{name:"Animation: Play. Switch to Pause"}).click();
  await expect.poll(()=>brush.evaluate(el=>getComputedStyle(el).animationPlayState)).toBe("paused");
  await page.getByRole("button",{name:"Animation: Pause. Switch to Off"}).click();
  await page.getByRole("button",{name:"Animation: Off. Switch to Play"}).click();
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect.poll(()=>brush.evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{value:true,configurable:true});document.dispatchEvent(new Event("visibilitychange"));});
  await expect.poll(()=>brush.evaluate(el=>getComputedStyle(el).animationPlayState)).toBe("paused");
  const download=page.waitForEvent("download"); await page.getByRole("button",{name:"Export",exact:true}).click();
  const filename=await (await download).path();
  expect(JSON.parse(await readFile(filename,"utf8")).settings).toMatchObject({veilMode:"contour-clouds",scene:"lilac-automata",motion:"brush"});
  await page.reload(); await open(page);
  await expect(field(page,"veilMode")).toHaveValue("contour-clouds");
  await page.getByRole("button",{name:"Liquid Landscape",exact:true}).click();
  await expect(field(page,"veilMode")).toHaveValue("messages");
  await expect(field(page,"theme")).toHaveValue("lilac");
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
