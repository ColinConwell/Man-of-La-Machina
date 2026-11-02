import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("roadmap keyboard navigation, bubble offsets, fixed disclosure alignment and settings dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 997, height: 988 });
  await page.goto("/?entry=test-2-1");
  const roadmap = page.getByRole("navigation", { name: "The Journey Roadmap" });
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Rain in Spain",
  );
  const box = (await roadmap.boundingBox())!;
  const reading = (await page.locator(".guided-reading").boundingBox())!;
  const navbar = (await page.locator(".masthead").boundingBox())!;
  expect(box.width).toBeGreaterThan(reading.width);
  expect(box.width).toBeLessThan(navbar.width);
  expect(
    await roadmap
      .locator("h2")
      .evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft)),
  ).toBeGreaterThan(10);
  const human = (await page.locator(".guided-message.human").boundingBox())!;
  const machine = (await page
    .locator(".guided-message.machine")
    .boundingBox())!;
  expect(machine.x - human.x).toBeGreaterThan(12);
  expect(Math.abs(human.width - machine.width)).toBeLessThan(1);
  await expect(page.locator(".guided-message.machine .message-body")).toHaveCSS(
    "text-align",
    "left",
  );
  expect(
    await page
      .locator(".guided-message.machine .message-body")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeLessThan(22);
  const context = roadmap.getByRole("button", { name: "Explore Context" });
  const before = (await context.boundingBox())!;
  await roadmap.locator("summary").click();
  const after = (await context.boundingBox())!;
  expect(Math.abs(before.y - after.y)).toBeLessThan(1);
  await roadmap.locator("summary").click();
  await expect(roadmap.locator(".journey-overflow.before")).toBeVisible();
  await roadmap.locator('[aria-current="step"]').press("ArrowLeft");
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Red Door to Japan",
  );
  await expect(roadmap.locator('[aria-current="step"]')).toBeFocused();
  await expect(roadmap.locator(".journey-overflow.after")).toBeVisible();
  await roadmap.locator('[aria-current="step"]').press("ArrowLeft");
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Pink Moon",
  );
  await roadmap.locator('[aria-current="step"]').press("ArrowLeft");
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Pink Moon",
  );
  for (const title of [
    "Red Door to Japan",
    "Rain in Spain",
    "Naming Mirrows",
    "Naming Mirrows",
  ]) {
    await roadmap.locator('[aria-current="step"]').press("ArrowRight");
    await expect(roadmap.locator('[aria-current="step"]')).toHaveText(title);
  }
  for (const title of ["Rain in Spain", "Red Door to Japan", "Pink Moon"]) {
    await roadmap.locator('[aria-current="step"]').press("ArrowLeft");
    await expect(roadmap.locator('[aria-current="step"]')).toHaveText(title);
  }
  const field = page.locator("#guided-reply");
  await field.fill("A draft");
  await field.press("ArrowRight");
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Pink Moon",
  );
  await field.fill("");
  await expect(
    page.getByRole("button", {
      name: "or continue with the original...",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".guided-placeholders span").first()).toHaveCSS(
    "animation-duration",
    "7.5s",
  );
  const voice = page.locator(".audio-heading select");
  await expect(voice).toHaveCSS("margin-top", "0px");
  await expect(voice).toHaveCSS("text-align-last", "center");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Placeholder Animation")).toHaveCount(0);
  await page.getByRole("heading", { name: "Appearance & Settings" }).click();
  await expect(page.locator(".appearance-dialog")).toBeVisible();
  await page.mouse.click(50, 250);
  await expect(page.locator(".appearance-dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
  await page.goto("/?entry=test-2-1");
  await expect(page.locator(".guided-message")).toHaveCount(2);
  await page.screenshot({ path: "/tmp/machina-review/refined-journey.png" });
});

test("editorial contents collapse and body follows Reading Font independently", async ({
  page,
}) => {
  for (const route of ["about", "essay"]) {
    await page.goto("/?page=" + route);
    const contents = page.getByRole("button", { name: "Table of Contents" });
    await expect(contents).toHaveAttribute("aria-expanded", "true");
    await contents.click();
    await expect(page.locator("#reading-contents")).toBeHidden();
    await contents.click();
    await expect(page.locator("#reading-contents")).toBeVisible();
    await expect(page.locator(".editorial-prose")).toHaveCSS(
      "font-family",
      /IBM Plex Serif/,
    );
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel("Reading Font", { exact: true })
      .selectOption("classic");
    await page.getByRole("button", { name: "Close Settings" }).click();
    await expect(page.locator(".editorial-prose")).toHaveCSS(
      "font-family",
      /Georgia/,
    );
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "Restore Default Settings" })
      .click();
    await page.keyboard.press("Escape");
  }
  await expect(page.locator(".editorial-heading .fine")).toHaveCount(0);
  await expect(page.locator(".editorial-heading .editorial-deck")).toHaveCount(
    1,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("timeline modes encode dates, keep unknown dates separate and disclose review on demand", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const events = ["2026-04-01", "2026-04-02", "2026-04-11", null].map(
    (date, i) => ({
      id: `event-${i}`,
      actor: "Traveler",
      action: `Invented event ${i}`,
      text: `Invented event ${i}`,
      place: null,
      occurred_at: null,
      occurred_end_at: null,
      date_basis: "unknown",
      duration_text: null,
      status: "reported",
      disclosed_at: date,
      disclosed_end_at: null,
      source_ids: [],
      source_ordinals: [i],
      annotation_source_ids: [],
      entry_message_id: null,
      evidence: [],
      provenance: { call_ids: [], method: "Invented" },
    }),
  );
  await page.route("**/api/v1/event-timeline", (r) =>
    r.fulfill({
      json: {
        version: 1,
        status: "completed",
        events,
        coverage: { sources_total: 4, sources_processed: 4 },
        semantic_review: {
          status: "completed",
          provider: "Test",
          model: "Invented",
        },
      },
    }),
  );
  await page.goto("/?page=events");
  await expect(page.locator(".event-coverage")).toContainText(
    "4 / 4 Sources Processed",
  );
  await expect(page.locator(".event-review-note")).toBeHidden();
  await page
    .getByRole("button", { name: "Extraction Review", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Extraction Review" }),
  ).toContainText("does not constitute human verification");
  await page.keyboard.press("Escape");
  await expect(page.locator(".event-review-note")).toBeHidden();
  const xs = () =>
    page
      .locator(".event-trace line")
      .evaluateAll((els) => els.map((e) => Number(e.getAttribute("x1"))));
  expect(await xs()).toHaveLength(4);
  const seq = await xs();
  expect(seq[1] - seq[0]).toBeCloseTo(seq[2] - seq[1]);
  await page.getByRole("button", { name: "Elapsed Time", exact: true }).click();
  expect(await xs()).toHaveLength(3);
  const time = await xs();
  expect((time[1] - time[0]) / (time[2] - time[0])).toBeCloseTo(0.1);
  await page.getByRole("button", { name: /Select undated event 4/ }).click();
  await expect(page.locator(".event-card h2")).toHaveText("Invented event 3");
  await expect(page.locator(".event-trace-head")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Previous event", exact: true })
    .click();
  await expect(page.locator(".event-trace-head")).toHaveCount(1);
  await page.getByRole("button", { name: "Planned", exact: false }).click();
  await expect(page.locator(".event-empty")).toContainText("No planned events");
  await page.getByRole("button", { name: "Reported", exact: false }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "/tmp/machina-review/refined-events.png",
    fullPage: true,
  });
  for (const event of events) event.disclosed_at = "2026-04-01";
  await page.getByRole("button", { name: "Refresh Events" }).click();
  await expect.poll(xs).toEqual([500, 500, 500, 500]);
  for (const event of events) event.disclosed_at = null;
  await page.getByRole("button", { name: "Refresh Events" }).click();
  await expect(
    page.getByText("No Known Disclosure Dates", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".event-trace line")).toHaveCount(0);
  await expect(page.locator(".event-undated button")).toHaveCount(4);
});

test("compact loading roadmap, hover shortcuts, sticky gap and on-demand record details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 966, height: 988 });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/threads\/[^?]+\?around=/, async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/?entry=test-2-1");
  const roadmap = page.getByRole("navigation", { name: "The Journey Roadmap" });
  await expect(
    page.getByText("Opening the recorded conversation…", { exact: true }),
  ).toBeVisible();
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Rain in Spain",
  );
  try {
    const loading = (await roadmap.boundingBox())!;
    expect(loading.height).toBeLessThan(190);
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await roadmap.boundingBox())!.height).toBeLessThan(220);
  } finally {
    release();
  }
  await expect(page.locator(".guided-message")).toHaveCount(2);
  await page.setViewportSize({ width: 966, height: 988 });
  await page.locator("#main-content").focus();
  await expect(page.locator("#main-content")).toHaveCSS(
    "outline-style",
    "none",
  );
  await page.mouse.move(0, 0);
  await expect(page.locator(".journey-navigation")).toHaveCSS("opacity", "0");
  await roadmap.hover();
  await expect(page.locator(".journey-navigation")).toHaveCSS("opacity", "1");
  const previous = page.getByRole("button", {
    name: "Previous Journey Stop",
    exact: true,
  });
  await expect(previous).toHaveAttribute("aria-keyshortcuts", "ArrowLeft");
  const next = page.getByRole("button", {
    name: "Next Journey Stop",
    exact: true,
  });
  await expect(next).toHaveAttribute("aria-keyshortcuts", "ArrowRight");
  await next.click();
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Naming Mirrows",
  );
  await expect(next).toHaveCount(0);
  await previous.press("ArrowLeft");
  await expect(roadmap.locator('[aria-current="step"]')).toHaveText(
    "Rain in Spain",
  );
  await expect(roadmap.locator('[aria-current="step"]')).toBeFocused();
  await expect(roadmap.locator('[aria-current="step"]')).toHaveCSS(
    "outline-style",
    "solid",
  );
  await page.locator(".guided-scroll").evaluate((e) => (e.scrollTop = 1000));
  const gap =
    (await roadmap.boundingBox())!.y -
    ((await page.locator(".masthead").boundingBox())!.y +
      (await page.locator(".masthead").boundingBox())!.height);
  expect(gap).toBeGreaterThanOrEqual(15);
  for (const speaker of ["human", "machine"]) {
    // Reopen the recorded pair after thread navigation selected its first turn.
    await page.goto("/?entry=test-2-1");
    await expect(page.locator(".guided-message")).toHaveCount(2);
    const edge = await page
      .locator(`.guided-message.${speaker} .guided-message-box`)
      .evaluate((el) => {
        const s = getComputedStyle(el, "::before");
        return { left: s.left, right: s.right, top: s.top, bottom: s.bottom };
      });
    expect(edge).toEqual({
      left: "-1px",
      right: "-1px",
      top: "-1px",
      bottom: "-1px",
    });
  }
  await expect(page.locator(".audio-disclosure")).toHaveCSS(
    "padding-left",
    "7px",
  );
  await expect(page.locator(".status-bar")).toHaveCount(0);
  await expect(
    page.getByText("Recorded history and generated branches remain distinct.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator(".record-details p").first()).toBeHidden();
  await page.locator(".record-details summary").click();
  await expect(page.locator(".record-details")).toContainText(
    "40 Recorded Turns",
  );
  await expect(page.locator(".record-details p").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await roadmap.hover();
  await page.screenshot({ path: "/tmp/machina-review/roadmap-polish.png" });
});

test("horizontal contents rail, keyboard shortcut, scroll tracking and justified editorial text", async ({
  page,
}) => {
  const paragraph =
    "This invented passage describes a choice, its context, and the questions that follow. ".repeat(
      32,
    );
  await page.route("**/api/v1/editorial/*", (r) =>
    r.fulfill({
      json: {
        title: "An Invented Reading",
        deck: "A test introduction",
        edition: "Reading edition · October 28, 2026",
        version: "fixture",
        body_html: `<h2 id="opening">Opening</h2><p>${paragraph}</p><h2 id="choice">The Choice</h2><p>${paragraph}</p><h2 id="bibliography">References</h2><p>A bibliography for this invented reading.</p>`,
      },
    }),
  );
  await page.setViewportSize({ width: 852, height: 988 });
  for (const route of ["essay", "about"]) {
    await page.goto("/?page=" + route);
    const nav = page.getByRole("navigation", { name: "Reading contents" });
    const toggle = page.getByRole("button", {
      name: "Table of Contents",
      exact: true,
    });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const openWidth = (await nav.boundingBox())!.width;
    const leftOpen = (await page.locator(".editorial-prose").boundingBox())!.x;
    await expect(toggle).toHaveAttribute("aria-keyshortcuts", "Shift+C");
    await toggle.press("c");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.press("Shift+C");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect
      .poll(async () => (await nav.boundingBox())!.width)
      .toBeLessThan(45);
    expect(openWidth).toBeGreaterThan(200);
    expect(
      (await page.locator(".editorial-prose").boundingBox())!.x,
    ).toBeLessThan(leftOpen - 100);
    await toggle.press("Shift+C");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".contents-shortcut")).toContainText(
      "Hide Contents",
    );
    await page.getByRole("button", { name: "Hide Contents (Shift + C)", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await toggle.press("Shift+C");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".editorial-prose p").first()).toHaveCSS(
      "text-align",
      "justify",
    );
    await expect(
      nav.getByRole("link", { name: "Opening", exact: true }),
    ).toHaveAttribute("aria-current", "location");
    await nav.getByRole("link", { name: "The Choice", exact: true }).click();
    await expect(
      nav.getByRole("link", { name: "The Choice", exact: true }),
    ).toHaveAttribute("aria-current", "location");
    // Scroll-driven selection changes independently of link clicks.
    await page
      .locator("#bibliography")
      .evaluate((el) =>
        window.scrollTo(
          0,
          window.scrollY + el.getBoundingClientRect().top - 80,
        ),
      );
    await expect(
      nav.getByRole("link", { name: "References (Bibliography)", exact: true }),
    ).toHaveAttribute("aria-current", "location");
    await expect(
      page.getByRole("heading", {
        name: "References (Bibliography)",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.keyboard.press("Shift+C");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Close Settings" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.goto("/?page=essay");
  await expect(page.locator(".editorial-edition")).toHaveText(
    "Reading Edition · October 28, 2026",
  );
  await expect(page.locator(".editorial-edition")).toHaveCSS(
    "font-size",
    "16px",
  );
  await page.screenshot({ path: "/tmp/machina-review/editorial-sidebar.png" });
  await page.getByRole("button", { name: "Table of Contents" }).press("Shift+C");
  await expect(page.locator("#reading-contents")).toBeHidden();
  await page.screenshot({ path: "/tmp/machina-review/editorial-tab.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Table of Contents" }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Table of Contents" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".contents-shortcut")).toBeVisible();
  await page.getByRole("button", { name: "Table of Contents" }).press("Shift+C");
  await expect(page.locator("#reading-contents")).toBeHidden();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("quiet source metadata, smaller traveler text and progressive audio sizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 852, height: 988 });
  await page.goto("/?entry=test-2-1");
  await expect(page.locator(".guided-message")).toHaveCount(2);
  expect(await page.locator(".guided-byline").first().innerText()).not.toContain("Unreviewed");
  const status = page.getByRole("button", {
    name: "Record Status: Recorded · Turn 1 · Unreviewed Source",
    exact: true,
  });
  await expect(status).toHaveAttribute(
    "title",
    "Recorded · Turn 1 · Unreviewed Source",
  );
  await status.click();
  await expect(
    page.getByRole("dialog", { name: "Record Status" }),
  ).toContainText("Unreviewed Source");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Record Status" })).toHaveCount(
    0,
  );
  await expect(page.locator(".guided-source").first()).toHaveCSS(
    "padding-left",
    "8px",
  );
  expect(
    await page
      .locator(".guided-message.human .message-body")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeLessThan(30);
  await expect(page.locator(".guided-roadmap li.current > button")).toHaveCSS(
    "box-shadow",
    "none",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore Default Settings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const player = page.getByRole("region", { name: "Read Aloud", exact: true });
  await expect(player).toHaveAttribute("data-size", "0");
  const full = (await player.boundingBox())!.height;
  await page
    .getByRole("button", { name: "Minimize Read Aloud", exact: true })
    .click();
  await expect
    .poll(async () => (await player.boundingBox())!.height)
    .toBeLessThan(90);
  expect(full).toBeGreaterThan(150);
  await expect(page.getByRole("combobox", {name:"Narrator Voice"})).toHaveCount(0);
  await expect(player.getByRole("button")).toHaveCount(5);
  await page.screenshot({ path: "/tmp/machina-review/audio-compact.png" });
  await page
    .getByRole("button", { name: "Minimize Read Aloud to Tab" })
    .click();
  await expect
    .poll(async () => (await player.boundingBox())!.height)
    .toBeLessThan(45);
  expect((await player.boundingBox())!.width).toBeLessThanOrEqual(190);
  await expect(player.getByRole("button")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Restore Read Aloud Controls" }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/machina-review/audio-tab-mobile.png" });
  await page
    .getByRole("button", { name: "Restore Read Aloud Controls" })
    .click();
  await expect(player).toHaveAttribute("data-size", "1");
  await page
    .getByRole("button", { name: "Expand Read Aloud", exact: true })
    .click();
  await expect(player).toHaveAttribute("data-size", "0");
  await expect(page.getByLabel("Narrator Voice")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(player).toHaveCSS("transition-duration", "0s");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
