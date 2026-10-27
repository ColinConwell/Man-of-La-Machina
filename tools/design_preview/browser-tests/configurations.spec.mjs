import { test, expect } from "../../../apps/web/node_modules/@playwright/test/index.mjs";
import { quickNames } from "../web/saved-designs.mjs";
const field = (page, key) => page.locator(`#setting-${key}`);
const open = async page => { await page.getByRole("button", { name: "Design Controls", exact: true }).click(); };

test("named designs persist, restore all controls, and never overwrite duplicate names", async ({ page }) => {
  await page.goto("/"); await open(page);
  await page.getByRole("button", { name: "Mechanical Dusk", exact: true }).click();
  for (const [key, value] of Object.entries({navbarSurface:"beveled",footerSurface:"beveled",travelerLabel:"above",companionLabel:"hidden",messageEdges:"opposed"})) await field(page,key).selectOption(value);
  await field(page,"backgroundOpacity").fill("0.35");
  await field(page,"travelerWidth").fill("0.75");
  await field(page,"companionInset").fill("0.12");
  await page.getByLabel("Enable All Animation").uncheck();
  await expect(page.getByLabel("Configuration Name")).toHaveValue("Mechanical Dusk Mod A");
  await page.getByRole("button", {name:"Save Configuration",exact:true}).click();
  await expect(page.getByLabel("Configuration Name")).toHaveValue("Mechanical Dusk Mod B");
  await page.getByLabel("Naming Style").selectOption("version");
  await expect(page.getByLabel("Configuration Name")).toHaveValue("Default v01");
  await page.getByRole("button", {name:"Save Configuration",exact:true}).click();
  await page.getByLabel("Naming Style").selectOption("custom");
  await page.getByLabel("Configuration Name").fill("My Reading Study");
  await page.getByRole("button", {name:"Save Configuration"}).click();
  await field(page,"backgroundOpacity").fill("0.9");
  await page.getByRole("button", {name:"Save Configuration"}).click();
  await expect(page.getByText("That name is already saved. Choose a new name to keep both designs.").first()).toBeVisible();
  await page.reload(); await open(page);
  await expect(page.getByLabel("Configuration Name")).toHaveValue("Mechanical Dusk Mod B");
  await page.getByLabel("Naming Style").selectOption("version");
  await expect(page.getByLabel("Configuration Name")).toHaveValue("Default v02");
  await page.getByRole("button", {name:"Reset All Settings"}).click();
  await page.getByLabel("Saved Configurations").selectOption("My Reading Study");
  await page.getByRole("button", {name:"Load Configuration"}).click();
  for (const [key,value] of Object.entries({scene:"lilac-automata",backgroundOpacity:"0.35",travelerWidth:"0.75",companionInset:"0.12",travelerLabel:"above",companionLabel:"hidden",messageEdges:"opposed",navbarSurface:"beveled",footerSurface:"beveled"})) await expect(field(page,key)).toHaveValue(value);
  await expect(page.getByLabel("Enable All Animation")).not.toBeChecked();
  await expect(page.getByLabel("Saved Configurations").locator("option")).toHaveCount(4);
  expect(quickNames(Array.from({length:26},(_,i)=>({name:`Example Mod ${String.fromCharCode(65+i)}`})),"Example")[0]).toBe("Example Mod AA");
});

test("animation off overrides presets and all comparison runtimes; background opacity is independent", async ({page}) => {
  await page.goto("/"); await open(page);
  await page.getByLabel("Enable All Animation").uncheck();
  await page.getByRole("button",{name:"Rose Reverie",exact:true}).click();
  await expect(page.locator(".preview-frame")).toHaveAttribute("data-animations","off");
  await expect(page.getByRole("button",{name:"Preview Living Brushstrokes",exact:true})).toBeDisabled();
  await expect(page.locator(".brush-wash, .atmosphere-layer, .illustration-layer")).toHaveCount(0);
  await expect(page.locator(".landscape-painting")).toBeVisible();
  await field(page,"backgroundOpacity").fill("0");
  await expect(page.locator(".landscape")).toHaveCSS("opacity","0");
  await expect(page.locator(".reading-inner")).toHaveCSS("opacity","1");
  await page.getByRole("button",{name:"Compare Animation Tools"}).click();
  await expect(page.getByText("All animation is turned off in Design Controls.")).toBeVisible();
  await expect(page.locator(".trial-comparison")).toHaveCount(0);
  await page.getByRole("button",{name:"Close Animation Study"}).click();
  await page.reload(); await open(page);
  await expect(page.getByLabel("Enable All Animation")).not.toBeChecked();
  await expect(field(page,"backgroundOpacity")).toHaveValue("0");
});

test("speaker labels, outer limits and revised action rows fit at desktop and mobile sizes", async ({page}) => {
  await page.goto("/"); await open(page);
  await field(page,"layout").selectOption("conversation");
  await field(page,"veilMode").selectOption("messages");
  await page.getByRole("button",{name:"Traveler Left · Companion Right",exact:true}).click();
  await field(page,"travelerLabel").selectOption("above");
  await field(page,"companionLabel").selectOption("above");
  await field(page,"messageEdges").selectOption("opposed");
  await field(page,"travelerWidth").fill("0.8");
  await field(page,"companionWidth").fill("0.75");
  await field(page,"travelerInset").fill("0.05");
  await field(page,"companionInset").fill("0.08");
  await field(page,"navbarSurface").selectOption("beveled");
  await field(page,"footerSurface").selectOption("beveled");
  await page.keyboard.press("Escape");
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    await page.setViewportSize(viewport); await page.evaluate(()=>document.fonts.ready);
    const geometry=await page.locator(".reading-inner").evaluate(inner=>{
      const r=inner.getBoundingClientRect();
      return [...inner.querySelectorAll(".message")].map(el=>{
        const b=el.getBoundingClientRect(), label=el.querySelector(".message-byline").getBoundingClientRect();
        return {width:b.width/r.width,left:b.left-r.left,right:r.right-b.right,labelBottom:label.bottom,top:b.top};
      });
    });
    expect(geometry[0].width).toBeLessThanOrEqual(.801); expect(geometry[1].width).toBeLessThanOrEqual(.751);
    expect(geometry[0].left).toBeGreaterThan(0); expect(geometry[1].right).toBeGreaterThan(0);
    for(const item of geometry) expect(item.labelBottom).toBeLessThan(item.top);
    expect(await page.locator(".preview-canvas").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await expect(page.locator(".schematic-note")).toHaveCSS("opacity","1");
    await expect(page.locator(".dialogue mark")).toHaveCount(0);
    if(viewport.width>1000) {
      await page.getByRole("button", {name:"A Turning Point",exact:true}).click();
      await expect(page.getByRole("button", {name:"Explore Context: A Turning Point",exact:true})).toBeVisible();
    }
    const [reply,recorded,inner]=await Promise.all([".primary-story",".recorded-link",".reading-inner"].map(s=>page.locator(s).boundingBox()));
    expect(recorded.y).toBeGreaterThan(reply.y+reply.height);
    expect(Math.abs(reply.width-recorded.width)).toBeLessThan(1);
    expect(Math.abs(reply.height-recorded.height)).toBeLessThan(1);
    expect(Math.abs(recorded.x-reply.x)).toBeLessThan(1);
    expect(reply.x).toBeGreaterThan(inner.x);
    await expect(page.getByRole("button",{name:"Read Original Reply",exact:true})).toBeVisible();
    await expect(page.locator(".context-fallback")).toHaveCount(0);
    for(const selector of [".primary-story", ".recorded-link"]) {
      const gap=await page.locator(selector).evaluate(el=>el.getBoundingClientRect().right-el.querySelector("svg").getBoundingClientRect().right);
      expect(gap).toBeLessThan(20);
    }
  }
});

test("soft contour backdrops follow wrapped lines after resizing without blurring text", async ({page}) => {
  await page.goto("/"); await open(page);
  await field(page,"layout").selectOption("conversation");
  await field(page,"veilMode").selectOption("contour-clouds");
  await page.keyboard.press("Escape");
  for(const width of [1440,390,1024]) {
    await page.setViewportSize({width,height:988}); await page.evaluate(()=>document.fonts.ready);
    await expect.poll(()=>page.locator(".human-message .contour-underlay i").count()).toBeGreaterThan(1);
    const mismatch=()=>page.locator(".human-message").evaluate(el=>{
      const text=[...el.querySelectorAll(".veil-text")].flatMap(s=>[...s.getClientRects()]);
      const clouds=[...el.querySelectorAll(".contour-underlay i")].map(s=>s.getBoundingClientRect());
      return text.length!==clouds.length || text.some((r,i)=>r.left<clouds[i].left || r.right>clouds[i].right+1 || r.top<clouds[i].top || r.bottom>clouds[i].bottom+1);
    });
    await expect.poll(mismatch).toBe(false);
    await expect(page.locator(".human-message .dialogue")).toHaveCSS("filter","none");
    await expect(page.locator(".human-message .dialogue .veil-text")).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
  }
});

test("failed saves are reported and invalid new settings leave the current design intact", async ({page}) => {
  await page.goto("/"); await open(page);
  for (const settings of [{animationsEnabled:"false"},{backgroundOpacity:1.5},{travelerWidth:0},{companionLabel:"invalid"}]) {
    await page.getByLabel("Import Preset JSON").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({schemaVersion:1,settings}))});
    await expect(page.locator(".preset-status")).toContainText(/invalid|unsupported/);
    await expect(field(page,"backgroundOpacity")).toHaveValue("1");
    await expect(page.getByLabel("Enable All Animation")).toBeChecked();
  }
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException("Full","QuotaExceededError");};});
  await page.getByLabel("Naming Style").selectOption("version");
  await page.getByRole("button",{name:"Save Configuration",exact:true}).click();
  await expect(page.locator(".save-status")).toContainText("unavailable or full");
  await expect(page.getByLabel("Saved Configurations").locator("option")).toHaveCount(1);
  await expect(page.getByLabel("Configuration Name")).toHaveValue("Default v01");
  await expect(page.getByRole("button",{name:"Save Configuration",exact:true})).toBeEnabled();
});

test("hierarchy and bevel controls match their surfaces and survive reload", async ({page}) => {
  await page.goto("/"); await open(page);
  const headings=await page.locator(".panel-section h3").allTextContents();
  expect(headings.slice(0,2)).toEqual(["Preview Structure","Starting Points"]);
  expect(headings).toContain("Animation");
  expect(headings).toContain("Conversation Thread");
  expect(headings).not.toContain("Movement");
  await expect(page.locator(".animation-section h4")).toHaveText(["Preview", "Movement", "Tools & Comparison"]);
  const surfaces=page.locator(".panel-section").filter({has:page.getByRole("heading",{name:"Surface & Legibility",exact:true})});
  await expect(surfaces.locator("h4")).toHaveText(["Reading View","Playback & Composer","Header & Footer","Shared Surface Effects"]);
  await field(page,"veilMode").selectOption("messages");
  await expect(field(page,"readingBevel")).toHaveValue("0.4");
  await field(page,"messageEdges").selectOption("opposed");
  await field(page,"navbarSurface").selectOption("beveled");
  await field(page,"footerSurface").selectOption("beveled");
  for(const value of ["0","2"]) {
    for(const key of ["readingBevel","navbarBevel","footerBevel","controlBevel"]) await field(page,key).fill(value);
    await expect(page.locator(".message").first()).toHaveCSS("border-top-left-radius",`${18*Number(value)}px`);
    await expect(page.locator(".app-header")).toHaveCSS("border-top-left-radius",`${8*Number(value)}px`);
    await expect(page.locator(".schematic-note")).toHaveCSS("border-top-left-radius",`${8*Number(value)}px`);
    await expect(page.locator(".playback-panel")).toHaveCSS("border-top-left-radius",`${10*Number(value)}px`);
    const edge=await page.locator(".human-message").first().evaluate(el=>{const s=getComputedStyle(el,"::after");return [s.top,s.bottom,s.left];});
    expect(edge).toEqual([`${18*Number(value)}px`,`${18*Number(value)}px`,"1px"]);
  }
  await page.reload(); await open(page);
  for(const key of ["readingBevel","navbarBevel","footerBevel","controlBevel"]) await expect(field(page,key)).toHaveValue("2");
  await page.getByRole("button",{name:"Save Configuration",exact:true}).click();
  await field(page,"readingBevel").fill("0");
  await page.getByLabel("Saved Configurations").selectOption("Default Mod A");
  await page.getByRole("button",{name:"Load Configuration"}).click();
  await expect(field(page,"readingBevel")).toHaveValue("2");
  await expect(field(page,"footerSurface").locator('option[value="beveled"]')).toHaveText("Beveled Bar");
  await field(page,"footerSurface").selectOption("text");
  await expect(page.locator(".schematic-note")).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
  await expect(page.locator(".schematic-note")).toHaveCSS("box-shadow","none");
  await expect(page.locator(".schematic-note")).toHaveCSS("border-top-width","0px");
  await page.reload(); await open(page);
  await expect(field(page,"footerSurface")).toHaveValue("text");
});
