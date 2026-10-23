import {test,expect} from "../../../apps/web/node_modules/@playwright/test/index.mjs";
import AxeBuilder from "../../../apps/web/node_modules/@axe-core/playwright/dist/index.mjs";

const panel = async page => {
  await page.getByRole("button",{name:"Design Controls",exact:true}).click();
};
const field = (page,name) => page.locator(`#setting-${name}`);

test("identity, keyboard drawer, inert controls, local persistence and preset round trip",async({page})=>{
  const errors=[], network=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("request",req=>network.push({url:req.url(),method:req.method()}));
  await page.goto("/");
  await expect(page).toHaveTitle(/Landscape/);
  await expect(page.getByRole("heading",{name:"A Turning Point"})).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  for(const label of ["Ready","Generating","Loading","Not Generated","Failed"])
    await expect(page.locator(".audio-message small",{hasText:label})).toBeVisible();
  await expect(page.getByRole("img",{name:"Within-Message Audio Progress: 24 of 68 Seconds"})).toBeVisible();
  for(const button of await page.locator(".mock-button").all()) await expect(button).toBeDisabled();
  const toggle=page.getByRole("button",{name:"Design Controls",exact:true});
  await toggle.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button",{name:"Close Design Controls"})).toBeFocused();
  await field(page,"scene").selectOption("aqueduct");
  await field(page,"theme").selectOption("sage");
  await page.keyboard.press("Escape"); await expect(toggle).toBeFocused();
  await page.reload(); await panel(page);
  await expect(field(page,"scene")).toHaveValue("aqueduct");
  await expect(field(page,"theme")).toHaveValue("sage");
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Export",exact:true}).click();
  const saved=await download; const filename=await saved.path();
  await page.getByRole("button",{name:"Reset All Settings"}).click();
  await page.getByLabel("Import Preset JSON").setInputFiles(filename);
  await expect(field(page,"scene")).toHaveValue("aqueduct");
  await page.getByLabel("Import Preset JSON").setInputFiles({name:"bad.json",mimeType:"application/json",buffer:Buffer.from('{"schemaVersion":1,"settings":{"readingOpacity":-1}}')});
  await expect(page.locator(".preset-status")).toContainText("invalid readingOpacity");
  await expect(field(page,"scene")).toHaveValue("aqueduct");
  expect(errors).toEqual([]);
  expect(network.filter(r=>r.method!=="GET"||(!r.url.startsWith("http://127.0.0.1:")&&!r.url.startsWith("blob:")))).toEqual([]);
  expect(network.filter(r=>r.url.includes("/api/"))).toEqual([]);
});

for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
 test(`all scenes, compositions and long passages at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport); await page.goto("/"); await panel(page);
  await field(page,"density").selectOption("long");
  for(const scene of ["olive-plains","windmills","grain-tower","aqueduct","moorish-palace","andorran-valley"]){
    await field(page,"scene").selectOption(scene);
    for(const preset of ["Natural Margins","Sepia Sketch","Continuous Horizon","Liquid Landscape"]){
      await page.getByRole("button",{name:preset,exact:true}).click();
      await expect(page.locator(".landscape-painting")).toHaveJSProperty("complete",true);
      expect(await page.locator(".landscape-painting").evaluate(img=>img.naturalWidth)).toBeGreaterThan(1000);
      expect(await page.locator(".story-scroll").evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
      expect(await page.locator(".preview-canvas").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      const surface=await page.locator(".controls-zone").evaluate(el=>getComputedStyle(el).backgroundColor);
      expect(surface==="rgba(0, 0, 0, 0)").toBe(preset==="Liquid Landscape");
    }
  }
  await page.keyboard.press("Escape");
  await page.screenshot({path:`/tmp/machina-design-${viewport.width}.png`});
 });
}

test("themes survive all layouts and states; A/B has identical content",async({page})=>{
 await page.goto("/"); await panel(page);
 await field(page,"scene").selectOption("andorran-valley");
 await field(page,"treatment").selectOption("grayscale");
 for(const theme of ["parchment","sage","moonlight"]){
  await field(page,"theme").selectOption(theme);
  for(const layout of ["conversation","folio","theater"]){
   await field(page,"layout").selectOption(layout);
   for(const state of ["reader","branching","comparison","events","editorial","onboarding"]){
    await field(page,"schematic").selectOption(state);
    await expect(page.locator(".preview-frame")).toHaveClass(new RegExp(`theme-${theme}`));
    await expect(page.locator(".landscape")).toHaveClass(/treatment-grayscale/);
    await expect(page.locator(".reading-inner h1")).toBeVisible();
   }
  }
 }
 await page.getByRole("button",{name:"Pin Current Design as A"}).click();
 await field(page,"schematic").selectOption("comparison");
 await field(page,"treatment").selectOption("sepia");
 const readings=await page.locator(".reading-inner").allTextContents();
 expect(readings[0]).toEqual(readings[1]);
 await expect(page.locator(".landscape").first()).toHaveClass(/treatment-grayscale/);
 await expect(page.locator(".landscape").last()).toHaveClass(/treatment-sepia/);
});

test("motion respects pause, reduced motion and hidden-tab policy",async({page})=>{
 await page.goto("/"); await panel(page); await field(page,"motion").selectOption("all");
 await page.getByRole("button",{name:"Pause All Animation"}).click();
 await expect(page.locator(".landscape")).toHaveClass(/is-still/);
 expect(await page.locator(".cloud-one").evaluate(el=>getComputedStyle(el).animationPlayState)).toBe("paused");
 await page.getByRole("button",{name:"Resume All Animation"}).click();
 await page.emulateMedia({reducedMotion:"reduce"});
 await expect(page.locator(".landscape")).toHaveClass(/is-still/);
 await page.emulateMedia({reducedMotion:"no-preference"});
 await expect(page.locator(".landscape")).not.toHaveClass(/is-still/);
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
 await expect(page.locator(".landscape")).toHaveClass(/is-still/);
});

test("default contrasts, form labels and keyboard semantics",async({page})=>{
 await page.goto("/"); await panel(page);
 for(const theme of ["parchment","sage","moonlight"]){
   await field(page,"theme").selectOption(theme);
   const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
   expect(results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 }
});

test("exported animation tools load locally and pause together",async({page})=>{
 const errors=[],external=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:")&&!r.url().startsWith("data:"))external.push(r.url());});
 await page.goto("/"); await panel(page);
 await page.getByRole("button",{name:"Compare Animation Tools"}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await expect(page.getByText("Rive · Playing",{exact:true})).toBeVisible();
 await expect(page.getByText("Lottie · Playing",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Pause All",exact:true}).click();
 await expect(page.getByText("Rive · Paused",{exact:true})).toBeVisible();
 await expect(page.getByText("Lottie · Paused",{exact:true})).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(page.getByRole("dialog")).toHaveCount(0);
 expect(errors).toEqual([]); expect(external).toEqual([]);
});
