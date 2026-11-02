import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
test("Generate, layer, automate, compare, render, save, reload, inspect and import", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sound Studio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page.getByLabel("Passage Name").fill("Browser Test Passage");
  await page
    .getByLabel("Narration Text")
    .fill("A hopeful morning. A difficult evening.");
  await page.getByRole("button", { name: "Generate One Take" }).click();
  await expect
    .poll(async () => {
      const r = await request.get("/api/sound/v1/catalog/samples");
      return (await r.json()).length;
    })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await page.getByRole("button", { name: "Duplicate Layer" }).click();
  await expect(page.locator("article.voice-layer")).toHaveCount(2);
  await page.getByLabel("Choose Effect").selectOption("reverb");
  await page.getByRole("button", { name: "Add Effect", exact: true }).click();
  await page.getByRole("button", { name: "Explain Reverb" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Illustration Amount").fill("0.7");
  await page.getByRole("button", { name: "Close Dialog" }).click();
  await page.getByText("Edit Curve Points (0)", { exact: true }).click();
  await page.getByRole("button", { name: "Add Curve Point" }).click();
  await page.getByRole("button", { name: "Add Curve Point" }).click();
  await page.getByLabel("Point 2 Value").fill("-12");
  await page.getByRole("button", { name: "Play Layers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause Playback", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Dry", { exact: true }).check();
  await page
    .getByRole("button", { name: "Stop And Rewind", exact: true })
    .click();
  await page.getByLabel("Project Name").fill("Verified Voice Study");
  await page
    .getByRole("button", {
      name: "Save Project (Unsaved Changes)",
      exact: true,
    })
    .click();
  await expect(page.locator(".notice")).toContainText("Saved revision");
  await page.reload();
  await expect(page.getByLabel("Project Name")).toHaveValue(
    "Verified Voice Study",
  );
  await expect(page.locator("article.voice-layer")).toHaveCount(2);
  await page.getByRole("button", { name: "Render Mix", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await request.get("/api/sound/v1/catalog/samples");
      return (await r.json()).some((s: any) => s.receipt.kind === "render");
    })
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("compose-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dark Appearance" }).click();
  await page.screenshot({
    path: testInfo.outputPath("compose-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Measured Spectrogram" }).click();
  await expect(page.getByRole("figure")).toBeVisible();
  await page.getByLabel("Listening Notes").fill("Tested save and reload.");
  await page.getByRole("button", { name: "Save Notes And Text" }).click();
  await page.getByRole("button", { name: "Close Dialog" }).click();
  const sample = await (
    await request.get("/api/sound/v1/catalog/samples")
  ).json();
  const bytes = await (
    await request.get(`/api/sound/v1/samples/${sample[0].id}/audio`)
  ).body();
  await page
    .locator('input[accept^="audio/"]')
    .setInputFiles({
      name: "imported-test.wav",
      mimeType: "audio/wav",
      buffer: bytes,
    });
  await expect(
    page.getByRole("cell", {
      name: "imported-test.wav · imported",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Responsive layout, reduced motion and keyboard navigation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sound Studio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page.getByLabel("Narration Text").fill("One sentence. ".repeat(5000));
  await expect(page.getByLabel("Narration Text")).toHaveValue(/One sentence/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Passage Name").press("Tab");
  await expect(page.getByLabel("Narration Text")).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("mobile.png"),
    fullPage: false,
  });
});
