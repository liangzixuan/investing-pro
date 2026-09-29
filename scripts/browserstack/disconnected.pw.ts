import { expect, test } from "@playwright/test";
import { previewOrigin, webTarget } from "./playwright.config";

const title =
  webTarget.mode === "staging"
    ? "exact-build disconnected staging opens Markets, notices and hash routes"
    : "disconnected preview opens Markets, notices and hash routes";

test(title, async ({ context, page }) => {
  let blockedRequests = 0;
  let pageErrors = 0;
  page.on("pageerror", () => {
    pageErrors += 1;
  });

  // Only public documents and bundled assets can leave this fresh context.
  // Count refusals without retaining request URLs, headers or bodies.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const resourceType = request.resourceType();
    const document = resourceType === "document" && url.pathname === "/";
    const asset =
      ["script", "stylesheet", "font", "image"].includes(resourceType) &&
      /^\/assets\/[a-zA-Z0-9._-]+$/u.test(url.pathname);
    if (
      request.method() === "GET" &&
      url.origin === previewOrigin &&
      url.search === "" &&
      (document || asset)
    ) {
      await route.continue();
      return;
    }
    blockedRequests += 1;
    await route.abort("blockedbyclient");
  });

  const markets = page.getByRole("heading", {
    name: "Markets",
    level: 1,
    exact: true,
  });
  const connection = page.getByRole("complementary", {
    name: "Connection status",
  });
  const notices = page.locator("details.mobile-license-notices");

  await test.step("Startup shows the disconnected Markets surface", async () => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    if (webTarget.mode === "staging") {
      const marker = page.locator('meta[name="investment-build-sha"]');
      await expect(marker, "Exactly one public build identity").toHaveCount(1);
      await expect(
        marker,
        "Deployed source matches the validated pipeline SHA",
      ).toHaveAttribute("content", webTarget.expectedBuildSha);
    }
    await expect(page).toHaveTitle("Investment");
    await expect(page).toHaveURL(`${previewOrigin}/#/markets`);
    await expect(markets).toBeVisible();
    await expect(connection).toContainText("Not connected to your computer");
    await expect(connection).toContainText(
      "This build cannot load or save your research.",
    );
    await expect(
      page.locator('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveAttribute("content", /(?:^|;)\s*connect-src 'none'\s*(?:;|$)/u);
  });

  await test.step("Data controls stay disabled and prices stay unloaded", async () => {
    await expect(
      page.getByRole("button", { name: "Load board" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Default suggestions", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("searchbox", { name: "Find a company" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: "Sign in to search companies." }),
    ).toBeVisible();
    await expect(page.locator(".owner-session-state")).toHaveText("Locked");
    const board = page.getByRole("table", {
      name: /^Default suggestions: AAPL, MSFT, WMT\./u,
    });
    await expect(board.getByRole("row")).toHaveCount(4);
    for (const symbol of ["AAPL", "MSFT", "WMT"]) {
      const row = board.getByRole("row").filter({
        has: page.getByRole("rowheader", {
          name: `${symbol} Catalog identity not loaded`,
          exact: true,
        }),
      });
      await expect(
        row.getByRole("cell", { name: "Not loaded", exact: true }),
      ).toBeVisible();
    }
  });

  await test.step("Bundled notices open and close", async () => {
    const text = notices.locator("pre");
    await expect(text).toBeHidden();
    await notices.locator("summary").click();
    await expect(text).toBeVisible();
    await expect(text).toContainText(
      "Open-source notices for the bundled Investment client",
    );
    await expect(text).toContainText("@capacitor/android@");
    await expect(text).toContainText("react@");
  });

  await test.step("Desktop and narrow layouts contain the page and open notices", async () => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(markets).toBeVisible();
      await expect(connection).toBeVisible();
      await expect(notices.locator("pre")).toBeVisible();
      const size = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(size.content, `Page width at ${width}px`).toBeLessThanOrEqual(
        size.viewport + 1,
      );
    }
    await notices.locator("summary").click();
    await expect(notices.locator("pre")).toBeHidden();
  });

  await test.step("The brand link and browser Back preserve hash navigation", async () => {
    await page.goto("/#/discover?view=watchlist", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(`${previewOrigin}/#/discover?view=watchlist`);
    await expect(markets).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Sign in to search companies." }),
    ).toBeVisible();
    const brand = page.getByRole("link", { name: "Research Cockpit" });
    await expect(brand).toHaveAttribute("href", "#/markets");
    await brand.click();
    await expect(page).toHaveURL(`${previewOrigin}/#/markets`);
    await expect(markets).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(`${previewOrigin}/#/discover?view=watchlist`);
    await expect(markets).toBeHidden();
    await expect(connection).toBeVisible();
  });

  expect(blockedRequests, "Unexpected network requests").toBe(0);
  expect(pageErrors, "Uncaught page errors").toBe(0);
});
