import { test, expect } from "../../../apps/web/node_modules/@playwright/test/index.mjs";
import AxeBuilder from "../../../apps/web/node_modules/@axe-core/playwright/dist/index.mjs";
const open = page => page.getByRole("button", { name: "Design Controls", exact: true }).click();
const close = page => page.getByRole("button", { name: "Close Design Controls", exact: true }).click();

test("inline continuation inserts editable original text and focuses the composer", async ({page}) => {
  await page.goto("/"); await open(page);
  await page.getByRole("combobox", {name:"Reply Actions",exact:true}).selectOption("inline");
  await close(page);
  const field=page.getByRole("textbox",{name:"Enter the journey with your own reply...",exact:true});
  await field.fill("My own path");
  const link=page.getByRole("button",{name:"or continue with the original",exact:true});
  await link.click();
  await expect(field).toHaveValue("Let us walk far enough to see beyond the bend. We need not choose the whole journey before taking its first step.");
  await expect(field).toBeFocused();
  await expect(page.locator(".reply-study .reply-reveal")).toHaveCount(0);
  await field.fill("My edited continuation");
  await expect(field).toHaveValue("My edited continuation");
  await page.reload(); await expect(link).toBeVisible();
});

test("vertical roadmap reveals an L branch and opens selected context beside the chat", async ({page}) => {
  await page.goto("/");
  const link=page.getByRole("button",{name:"Explore Context: A Turning Point",exact:true});
  await expect(link).toBeHidden();
  await page.getByRole("button",{name:"A Turning Point",exact:true}).click();
  await expect(link).toBeVisible();
  expect(await page.locator(".is-unveiled .journey-branch").evaluate(el=>getComputedStyle(el,"::before").borderLeftWidth)).toBe("1px");
  const before=await page.locator(".reading-inner").boundingBox();
  await link.click();
  const sidebar=page.getByRole("complementary",{name:"Journey Context"});
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("heading",{name:"A Turning Point",exact:true})).toBeVisible();
  await expect.poll(async()=> (await page.locator(".reading-inner").boundingBox()).x).toBeLessThan(before.x);
  await page.getByRole("button",{name:"Close Context"}).click();
  await expect(sidebar).toBeHidden(); await expect(link).toBeFocused();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole("navigation",{name:"The Journey Roadmap"})).toBeHidden();
  await expect(page.locator(".reading-inner").getByText("Explore Context",{exact:true})).toHaveCount(0);
});

test("responsive roadmap reflows above reading, reveals context on hover and keyboard focus, and fits narrow widths", async ({page}) => {
  await page.goto("/"); await open(page);
  await page.getByLabel("Roadmap & Context").selectOption("responsive");
  await close(page);
  for(const width of [820,390]) {
    await page.setViewportSize({width,height:988});
    await page.getByRole("button",{name:"Design Controls",exact:true}).focus();
    await page.mouse.move(0,0);
    const nav=page.getByRole("navigation",{name:"The Journey Roadmap"});
    await expect(nav).toBeVisible();
    await expect(page.locator(".chapter-heading")).toBeHidden();
    await expect(nav).toHaveCSS("position", "sticky");
    const geometry = await nav.locator("li").evaluateAll(items => items.map(el => {
      const dot = getComputedStyle(el, "::before"); const label = el.querySelector(".journey-stop");
      return Math.abs(parseFloat(dot.left) + parseFloat(dot.width)/2 - label.offsetLeft - label.offsetWidth/2);
    }));
    expect(Math.max(...geometry)).toBeLessThanOrEqual(2);
    const stop=page.getByRole("button",{name:"The Beginning",exact:true});
    const link=page.getByRole("button",{name:"Explore Context: The Beginning",exact:true});
    await expect(link).toBeHidden(); await stop.hover(); await expect(link).toBeVisible();
    await page.mouse.move(0,0); await expect(link).toBeHidden();
    await stop.focus(); await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole("complementary",{name:"Journey Context"})).toContainText("sets out with a map");
    expect(await page.locator(".preview-canvas").evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("button",{name:"Close Context"}).click();
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator(".journey-rail")).toHaveCSS("animation-name","none");
  await page.reload(); await open(page); await expect(page.getByLabel("Roadmap & Context")).toHaveValue("responsive");
});

test("always-open context follows roadmap selection and both new settings round-trip", async ({page}) => {
  await page.goto("/"); await open(page);
  await page.getByLabel("Roadmap & Context").selectOption("sidebar");
  await page.getByRole("combobox", {name:"Reply Actions",exact:true}).selectOption("inline");
  await page.getByRole("button",{name:"Save Configuration",exact:true}).click();
  await close(page);
  await expect(page.getByRole("button",{name:"Close Context"})).toHaveCount(0);
  await page.getByRole("button",{name:"Naming the Companion",exact:true}).click();
  await expect(page.getByRole("complementary",{name:"Journey Context"})).toContainText("The conversation turns to names");
  const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  expect(results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  await open(page); await page.getByRole("button",{name:"Reset All Settings"}).click();
  await page.getByLabel("Saved Configurations").selectOption("Default Mod A");
  await page.getByRole("button",{name:"Load Configuration"}).click();
  await expect(page.getByLabel("Roadmap & Context")).toHaveValue("sidebar");
  await expect(page.getByRole("combobox",{name:"Reply Actions",exact:true})).toHaveValue("inline");
});
