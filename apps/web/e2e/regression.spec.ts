import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { curatorFixtureURL, explorationFixtureURL } from "./fixture-ports";

test("landing copy, compact theme control, and all three beginnings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Man of La Machina/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Every conversation is a fork in the road",
  );
  await expect(page.locator(".threshold-copy p").first()).toHaveText(
    "An interactive exploration of one human's journey, the chatbot that guided it, and the power of language in shaping the journeys of tomorrow.",
  );
  await expect(page.locator(".mode-indicator")).toHaveText(
    "Local Curator / Demo",
  );
  await expect(page.locator(".beginning")).toHaveCount(3);
  const theme = page.getByRole("combobox", { name: "Theme", exact: true });
  const width = (await theme.boundingBox())!.width;
  await theme.selectOption("western-gothic");
  expect((await theme.boundingBox())!.width).toBeGreaterThan(width + 25);
  await theme.selectOption("archive");
  expect((await theme.boundingBox())!.width).toBeLessThan(105);
  for (const [title, entry] of [
    ["From the beginning · April 1", "test-0-0"],
    ["Rain in Spain · May 8", "test-2-1"],
    ["Naming Mirrows · May 10", "test-3-2"],
  ]) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`entry=${entry}`));
    await expect(page.locator(`#turn-${entry}`)).toContainText(
      "Selected cutoff",
    );
    if (entry === "test-2-1")
      await expect(
        page.getByLabel("Replace the selected human turn"),
      ).toBeDisabled();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test("breadth changes actual context without creating branches, and generation uses it", async ({
  page,
}) => {
  let branches = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/branches")) branches++;
  });
  await page.goto("/?entry=test-3-9&anchor=naming-mirrows");
  for (const [scope, count] of [
    ["Scene", 6],
    ["Thread", 10],
    ["Chapter", 30],
    ["Journey", 40],
  ] as const) {
    await page.getByRole("radio", { name: scope, exact: true }).check();
    await expect(
      page.getByRole("radio", { name: scope, exact: true }),
    ).toBeChecked();
    await expect(page.getByTestId("context-coverage")).toContainText(
      `${count} of ${count} eligible recorded turns included.`,
    );
  }
  expect(branches).toBe(0);
  await page
    .getByLabel("Write your next turn", { exact: true })
    .fill("An invented next step.");
  await page
    .getByRole("button", { name: "Preview context", exact: true })
    .click();
  await expect(page.getByTestId("manifest-hash")).toHaveText(/[a-f0-9]{64}/);
  // Wait for the preview containing the current visitor input.
  await expect(page.locator(".receipt-summary")).toContainText("42 items");
  const hash = await page.getByTestId("manifest-hash").textContent();
  await page
    .getByRole("button", { name: "Generate continuation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect this turn’s receipt", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByTestId("manifest-hash"),
  ).toHaveText(hash!);
  expect(branches).toBe(1);
});

test("rapid changes cannot overwrite the selected scope with a stale preview", async ({
  page,
}) => {
  await page.route("**/api/v1/context/preview", async (route) => {
    if (route.request().postDataJSON().options.breadth === "chapter") {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.goto("/?entry=test-3-9");
  const pending = page.waitForRequest(
    (r) =>
      r.url().endsWith("/context/preview") &&
      r.postDataJSON().options.breadth === "chapter",
  );
  await page.getByRole("radio", { name: "Chapter", exact: true }).check();
  await pending;
  await page.getByRole("radio", { name: "Scene", exact: true }).check();
  await expect(page.getByTestId("context-coverage")).toContainText("6 of 6");
  await page.waitForTimeout(1100); // Deliberately wait beyond the delayed response.
  await expect(page.getByTestId("context-coverage")).toContainText(
    "Scene context",
  );
  await expect(page.getByTestId("context-coverage")).toContainText("6 of 6");
});

test("preview failure recovers and tag and beginning controls change included history", async ({
  page,
}) => {
  await page.route("**/api/v1/context/preview", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Preview temporarily unavailable" },
    }),
  );
  await page.goto("/?entry=test-3-9");
  await expect(page.getByTestId("context-coverage")).toContainText(
    "Preview temporarily unavailable",
  );
  await page.unroute("**/api/v1/context/preview");
  await page.getByRole("button", { name: "Retry context preview" }).click();
  await expect(page.getByTestId("context-coverage")).toContainText("10 of 10");
  await page.getByLabel("Practical details").uncheck();
  await expect(page.getByTestId("context-coverage")).toContainText("5 of 5");
  await page.getByText("More context controls", { exact: true }).click();
  await page
    .getByLabel("Where context begins")
    .selectOption("begin_context_here");
  await expect(page.getByTestId("context-coverage")).toContainText("1 of 1");
  await expect(page.getByLabel("Where context begins")).toBeEnabled();
});

test("breadth radio keyboard and mobile controls remain accessible", async ({
  page,
}) => {
  await page.goto("/?entry=test-3-9");
  await page.getByRole("radio", { name: "Thread", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("context-coverage")).toContainText("30 of 30");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page.getByRole("radio", { name: "Journey", exact: true }).check();
  await expect(page.getByTestId("context-coverage")).toContainText("40 of 40");
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
});

test("paired mode answers one turn under two contexts with distinct receipts", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(new URL(r.url()).pathname);
  });
  await page.goto("/?entry=test-3-9");
  await expect(page.getByTestId("context-coverage")).toContainText("10 of 10");
  await page.getByRole("radio", { name: "Compare two contexts" }).check();
  const composer = page.locator(".branch-composer");
  await composer
    .getByLabel("Write your next turn", { exact: true })
    .fill("An invented paired turn.");
  const generate = page.getByRole("button", { name: "Generate both replies" });
  await expect(page.getByTestId("pair-estimate")).toContainText(
    "Choose what B withholds",
  );
  await expect(generate).toBeDisabled();
  await composer.getByLabel("Practical details").check();
  await expect(page.getByTestId("pair-estimate")).toContainText(
    "B withholds 5 items A includes",
  );
  await generate.click();
  const pair = page.getByTestId("context-pair");
  const a = pair.getByTestId("condition-A");
  const b = pair.getByTestId("condition-B");
  await expect(
    a.getByRole("button", { name: "Inspect receipt A" }),
  ).toBeVisible();
  // Demo generation varies with the withheld group and makes no model calls.
  await expect(a).toContainText("practical details in this context");
  await expect(a).toContainText("using 10 historical turns");
  await expect(b).toContainText("less of the earlier detail");
  await expect(b).toContainText("using 5 historical turns");
  await expect(b).toContainText("Without Practical details");
  await expect(pair.locator(".branch-message.visitor")).toHaveCount(1);
  await expect(pair.locator(".branch-message.visitor")).toContainText(
    "held fixed for both contexts",
  );
  await expect(pair.locator(".pair-summary")).toContainText(
    "5 recorded turns removed",
  );
  await expect(pair.getByTestId("composition-B")).toHaveAttribute(
    "aria-label",
    /5 withheld/,
  );
  await expect(pair.locator(".composition-bar .segment.withheld")).toHaveCount(
    1,
  );
  await expect(pair.locator(".composition-bar .segment.gap")).toHaveCount(1);
  await expect(composer).toContainText("1 / 5 exchanges");
  await expect(
    composer.getByLabel("Write your next turn", { exact: true }),
  ).toHaveValue("");
  // Condition A remains the workbench selection; B's withholding is separate.
  await expect(
    page.locator(".context-workbench").getByLabel("Practical details"),
  ).toBeChecked();
  const hashes: string[] = [];
  for (const [condition, label] of [
    [a, "A"],
    [b, "B"],
  ] as const) {
    await condition
      .getByRole("button", { name: `Inspect receipt ${label}` })
      .click();
    const hash = page.getByRole("dialog").getByTestId("manifest-hash");
    await expect(hash).toHaveText(/[a-f0-9]{64}/);
    hashes.push((await hash.textContent())!);
    expect(
      hashes
        .at(-1)!
        .startsWith((await condition.locator("code").textContent())!),
    ).toBe(true);
    await page.getByRole("button", { name: "Close receipt" }).click();
  }
  expect(hashes[0]).not.toBe(hashes[1]);
  expect(posts.filter((p) => p.endsWith("/branches"))).toHaveLength(1);
  expect(posts.filter((p) => p.endsWith("/pairs"))).toHaveLength(1);
  expect(posts.filter((p) => p.endsWith("/messages"))).toHaveLength(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("local annotation tool edits, saves, and reloads a private boundary", async ({
  page,
}) => {
  await page.goto(curatorFixtureURL + "/");
  await expect(page.getByRole("status")).toContainText(
    "Loaded private candidate catalog",
  );
  await expect(
    page.getByRole("heading", {
      name: "Annotate + Demarcate • Local Development",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview in App" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Invented original source paragraph.",
  );
  await page.getByRole("button", { name: "Close Preview" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Candidate", exact: true })
    .selectOption("2");
  await expect(page.getByLabel("Source Conversation")).toHaveValue("thread-b5");
  await page
    .getByLabel("Private Annotation")
    .fill("An invented browser annotation.");
  await page
    .locator("article")
    .nth(3)
    .getByRole("button", { name: "Begin at This Turn" })
    .click();
  await expect(page.locator("#boundary")).toContainText("test-2-3");
  await page.getByRole("button", { name: "Save Private Catalog" }).click();
  await expect(page.getByRole("status")).toContainText("Saved privately");
  await page.reload();
  await page
    .getByRole("combobox", { name: "Candidate", exact: true })
    .selectOption("2");
  await expect(page.getByLabel("Private Annotation")).toHaveValue(
    "An invented browser annotation.",
  );
  await expect(page.locator("#boundary")).toContainText("test-2-3");
  await page.getByLabel("Find Within Conversation").fill("turn 7:");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article")).toContainText("Turn 8");
  // Main experience never mounts development routes.
  for (const path of [
    "/api/catalog",
    "/curator",
    "/tools/curator/index.html",
  ]) {
    expect(
      (await page.request.get(explorationFixtureURL + path)).status(),
    ).toBe(404);
  }
});
