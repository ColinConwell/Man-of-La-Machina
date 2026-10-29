import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const screenshots = "/tmp/machina-review";
fs.mkdirSync(screenshots, { recursive: true });

async function enter(page: import("@playwright/test").Page) {
  await page.goto("/?entry=test-2-1");
  await expect(
    page.getByRole("navigation", { name: "The Journey Roadmap" }),
  ).toBeVisible();
  await expect(page.locator(".guided-message")).toHaveCount(2);
}

test("original insertion, recorded progression, edited branch, context and advanced controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let generations = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/branches\/[^/]+\/messages$/.test(r.url()))
      generations++;
  });
  await enter(page);
  const field = page.getByRole("textbox", {
    name: "Enter the journey with your own reply...",
  });
  await page
    .getByRole("button", { name: "or continue with the original" })
    .click();
  await expect(field).toHaveValue(
    "Invented dialogue 2, turn 2: let us consider a modest next step.",
  );
  await expect(field).toBeFocused();
  await expect(page.locator(".reply-reveal")).toHaveCount(0);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(/entry=test-2-2/);
  expect(generations).toBe(0);
  await page
    .getByRole("button", { name: "or continue with the original" })
    .click();
  await field.fill("I would like to explore another path.");
  await page
    .getByRole("button", { name: "Explore Context", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Journey Context" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close Context", exact: false })
    .click();
  await expect(field).toHaveValue("I would like to explore another path.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Generated model reply", exact: true }),
  ).toBeVisible();
  await expect(field).toHaveValue("");
  expect(generations).toBe(1);
  await expect(
    page.getByRole("button", { name: /Read message 4: Companion/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Compare, Search/ }).click();
  await expect(page.getByLabel("Experience views")).toBeVisible();
  await page.getByRole("button", { name: "Return to Guided Reading" }).click();
  await expect(
    page.getByRole("article", { name: "Generated model reply", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Branch & Its Audio" }).click();
  await expect(
    page.getByRole("article", { name: "Generated model reply", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("responsive pinned roadmap, fonts, settings persistence, reduced motion and keyboard access", async ({
  page,
}) => {
  await enter(page);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 790, 390]) {
    await page.setViewportSize({ width, height: 988 });
    await page.locator(".guided-scroll").evaluate((el) => (el.scrollTop = 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const nav = page.getByRole("navigation", { name: "The Journey Roadmap" });
    if (width < 1001) {
      await expect(page.locator(".guided-title")).toBeHidden();
      const before = (await nav.boundingBox())!;
      await page
        .locator(".guided-scroll")
        .evaluate((el) => (el.scrollTop = 200));
      const after = (await nav.boundingBox())!;
      expect(after.y).toBeGreaterThanOrEqual(0);
      expect(after.y).toBeLessThanOrEqual(before.y);
      expect(
        await nav.locator("li").evaluateAll((items) =>
          Math.max(
            ...items.map((el) => {
              const style = getComputedStyle(el, "::before");
              const button = el.querySelector("button")!;
              return Math.abs(
                parseFloat(style.left) +
                  parseFloat(style.width) / 2 -
                  button.offsetLeft -
                  button.offsetWidth / 2,
              );
            }),
          ),
        ),
      ).toBeLessThan(2);
    }
    await page.locator(".guided-scroll").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: `${screenshots}/guided-${width}.png` });
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Human Font", { exact: true }).selectOption("plex");
  await page.getByLabel("Interface Palette").selectOption("moonlight");
  await page.getByRole("button", { name: "Close Settings" }).click();
  await page.reload();
  await expect(page.locator(".landscape-app")).toHaveAttribute(
    "data-palette",
    "moonlight",
  );
  await expect(page.locator(".guided-message.human .message-body")).toHaveCSS(
    "font-family",
    /IBM Plex Serif/,
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Restore Default Settings" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".guided-placeholders span").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("narration generating, ready playback, seek, speed, voice changes, deletion and failure", async ({
  page,
}) => {
  // UI state tests use a generated local WAV, while backend ownership tests use the real routes.
  const wav = Buffer.alloc(44 + 24000 * 2 * 12);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  let polls = 0,
    deleted = 0,
    requests = 0;
  await page.route("**/api/v1/narration/capabilities", (r) =>
    r.fulfill({
      json: {
        available: true,
        voices: ["cedar", "marin"],
        session_characters_per_hour: 24000,
        retention_seconds: 7200,
      },
    }),
  );
  await page.route("**/api/v1/narration", (r) => {
    if (r.request().method() === "DELETE") {
      deleted++;
      return r.fulfill({ json: { deleted: true } });
    }
    requests++;
    return r.fulfill({
      status: 202,
      json: { id: "sample", status: "generating", parts: [], error: null },
    });
  });
  await page.route("**/api/v1/narration/sample", (r) =>
    r.fulfill({
      json: {
        id: "sample",
        status: ++polls < 2 ? "generating" : "ready",
        parts: ["/api/v1/narration/sample/audio/0"],
        error: null,
      },
    }),
  );
  await page.route("**/api/v1/narration/sample/audio/0", (r) => {
    const match = /bytes=(\d+)-(\d*)/.exec(
      r.request().headers()["range"] || "",
    );
    if (!match)
      return r.fulfill({
        contentType: "audio/wav",
        body: wav,
        headers: { "Accept-Ranges": "bytes" },
      });
    const start = Number(match[1]),
      end = match[2]
        ? Math.min(Number(match[2]), wav.length - 1)
        : wav.length - 1;
    return r.fulfill({
      status: 206,
      contentType: "audio/wav",
      body: wav.subarray(start, end + 1),
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${wav.length}`,
      },
    });
  });
  await enter(page);
  expect(requests).toBe(0);
  await page
    .getByRole("button", { name: "Play Read Aloud", exact: true })
    .click();
  await expect(page.locator(".audio-heading")).toContainText("Generating");
  await expect(page.locator(".audio-heading")).toContainText("Ready", {
    timeout: 15000,
  });
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(0);
  const audioNode = await page.locator("audio").elementHandle();
  const beforeMinimize = await page
    .locator("audio")
    .evaluate((a: HTMLAudioElement) => a.currentTime);
  await page
    .getByRole("button", { name: "Minimize Read Aloud", exact: true })
    .click();
  await expect(page.locator(".read-aloud")).toHaveAttribute("data-size", "1");
  await page
    .getByRole("button", { name: "Minimize Read Aloud to Tab", exact: true })
    .click();
  await expect(page.locator(".read-aloud")).toHaveAttribute("data-size", "2");
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(beforeMinimize);
  expect(
    await audioNode!.evaluate((el) => el === document.querySelector("audio")),
  ).toBe(true);
  expect(
    await page.locator("audio").evaluate((a: HTMLAudioElement) => a.paused),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Restore Read Aloud Controls" })
    .click();
  await page
    .getByRole("button", { name: "Pause Read Aloud", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Read Aloud", exact: true })
    .click();
  await page.getByLabel("Playback Speed").selectOption("1.5");
  expect(
    await page
      .locator("audio")
      .evaluate((a: HTMLAudioElement) => a.playbackRate),
  ).toBe(1.5);
  await page.getByRole("slider", { name: "Within-Message Progress" }).fill("1");
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(0.9);
  await page.getByLabel("Narrator Voice").selectOption("marin");
  await expect(page.locator(".audio-heading")).toContainText("Not Generated");
  await page.getByRole("button", { name: "Delete Session Audio" }).click();
  expect(deleted).toBe(1);
  await page.route("**/api/v1/narration", (r) =>
    r.fulfill({
      status: 429,
      json: { detail: "The hourly narration allowance is full." },
    }),
  );
  await page
    .getByRole("button", { name: "Play Read Aloud", exact: true })
    .click();
  await expect(
    page.getByText("The hourly narration allowance is full.", { exact: true }),
  ).toBeVisible();
});

test("new completed replies narrate only while Read Aloud is active", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("**/api/v1/narration/capabilities", (r) =>
    r.fulfill({
      json: {
        available: true,
        voices: ["cedar", "marin"],
        retention_seconds: 7200,
        session_characters_per_hour: 24000,
      },
    }),
  );
  await page.route("**/api/v1/narration", (r) => {
    const id = r.request().postDataJSON().message_id;
    requested.push(id);
    return r.fulfill({
      status: 202,
      json: { id, status: "ready", parts: [], error: null },
    });
  });
  await enter(page);
  const field = page.getByRole("textbox", {
    name: "Enter the journey with your own reply...",
  });
  await field.fill("A first invented reply.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Generated model reply", exact: true }),
  ).toHaveCount(1);
  expect(requested).toEqual([]);
  await page.getByRole("button", { name: /Read message 4:/ }).click();
  await page
    .getByRole("button", { name: "Play Read Aloud", exact: true })
    .click();
  await expect.poll(() => requested.length).toBe(1);
  await field.fill("A second invented reply.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Generated model reply", exact: true }),
  ).toHaveCount(2);
  await expect.poll(() => requested.length).toBe(2);
  expect(requested[1]).not.toBe(requested[0]);
  await page
    .getByRole("button", { name: "Pause Read Aloud", exact: true })
    .click();
  await field.fill("A third invented reply.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Generated model reply", exact: true }),
  ).toHaveCount(3);
  expect(requested).toHaveLength(2);
});

test("invalid saved appearance and unavailable storage do not prevent reading", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "machina-appearance-v1",
      JSON.stringify({ palette: "invalid", textScale: 999, humanFont: "plex" }),
    ),
  );
  await enter(page);
  await expect(page.locator(".landscape-app")).toHaveAttribute(
    "data-palette",
    "rose",
  );
  expect(
    await page
      .locator(".landscape-app")
      .evaluate((el) =>
        (el as HTMLElement).style.getPropertyValue("--text-scale"),
      ),
  ).toBe("1.35");
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("unavailable");
    };
  });
  await page.reload();
  await expect(page.locator(".guided-message")).toHaveCount(2);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText("Settings apply now, but this browser cannot save them."),
  ).toBeVisible();
});
