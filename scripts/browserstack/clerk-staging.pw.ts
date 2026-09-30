import { expect, test } from "@playwright/test";
import { previewOrigin, webTarget } from "./playwright.config";

test("exact-build Clerk staging boots without auth or data requests", async ({
  context,
  page,
}) => {
  if (webTarget.mode !== "staging")
    throw new Error("The Clerk staging smoke requires an expected build SHA.");
  const expectedBuildSha = webTarget.expectedBuildSha;

  let blockedRequests = 0;
  let pageErrors = 0;
  let consoleErrors = 0;
  page.on("pageerror", () => {
    pageErrors += 1;
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors += 1;
  });

  // This fresh context permits only the fixed public page and bundled assets.
  // Count attempted refusals without retaining URLs, headers or request bodies.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const type = request.resourceType();
    const document = type === "document" && url.pathname === "/";
    const asset =
      ["script", "stylesheet", "font", "image"].includes(type) &&
      /^\/assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]{8,}\.(?:js|css)$/u.test(
        url.pathname,
      );
    if (
      request.method() === "GET" &&
      url.origin === previewOrigin &&
      url.search === "" &&
      (document || asset)
    ) {
      await route.fallback();
      return;
    }
    blockedRequests += 1;
    await route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", async (route) => {
    blockedRequests += 1;
    await route.close();
  });

  await test.step("The public marker matches before any UI action", async () => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    const marker = page.locator('meta[name="investment-build-sha"]');
    await expect(marker, "Exactly one public build identity").toHaveCount(1);
    await expect(
      marker,
      "Deployed source matches the pipeline SHA",
    ).toHaveAttribute("content", expectedBuildSha);
    await expect(page).toHaveURL(`${previewOrigin}/`);
    await expect(page).toHaveTitle("Investment sign-in trial");
  });

  const heading = page.getByRole("heading", {
    name: "A shared watchlist, across your devices",
    level: 1,
    exact: true,
  });
  const preview = page.getByRole("region", {
    name: "Staging preview",
    exact: true,
  });
  const notices = page.getByRole("region", {
    name: "Third-party software licenses",
    exact: true,
  });

  await test.step("React renders the inert staging preview", async () => {
    await expect(heading).toBeVisible();
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(
      "Sign-in is available on the production site.",
    );
    await expect(preview).toContainText(
      "This preview does not start a session or load saved data.",
    );
    await expect(page.getByRole("main")).toContainText(
      "Synthetic data only. Your local research and vault are separate.",
    );
    await expect(page.locator("input, textarea, iframe")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(1);
  });

  await test.step("Desktop and narrow layouts load and toggle bundled notices", async () => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(heading).toBeVisible();
      await expect(preview).toBeVisible();
      await expect(notices).toBeHidden();
      const show = page.getByRole("button", {
        name: "Software licenses",
        exact: true,
      });
      await expect(show).toHaveAttribute("aria-expanded", "false");
      await show.click();
      const text = notices.locator("pre");
      await expect(text).toBeVisible();
      await expect(text).toContainText(
        "Third-party software notices for the Investment sign-in trial",
      );
      await expect(text).toContainText("@clerk/react@");
      await expect(text).toContainText("react@");
      const size = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(size.content, `Page width at ${width}px`).toBeLessThanOrEqual(
        size.viewport + 1,
      );
      const hide = page.getByRole("button", {
        name: "Hide software licenses",
        exact: true,
      });
      await expect(hide).toHaveAttribute("aria-expanded", "true");
      await hide.click();
      await expect(notices).toBeHidden();
    }
  });

  expect(
    blockedRequests,
    "Attempted auth, data or other unexpected requests",
  ).toBe(0);
  expect(pageErrors, "Uncaught page errors").toBe(0);
  expect(consoleErrors, "Browser console errors").toBe(0);
});
