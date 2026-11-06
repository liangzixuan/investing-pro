import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateAndroidTestAssets } from "./android-test-assets";

it("reserves the native scenario marker for every registered journey", () => {
  const source = readFileSync(
    new URL(
      "./android/app/src/androidTest/java/local/investment/personal/ReportRevisitFixtureAssets.java",
      import.meta.url,
    ),
    "utf8",
  );
  const scenarios = [...source.matchAll(/\("([a-z0-9-]+)"\)/gu)].map(
    (match) => match[1],
  );
  expect(scenarios.length).toBeGreaterThan(0);
  for (const scenario of scenarios) {
    expect(
      Buffer.byteLength(
        `<meta name="investment-android-test-scenario" content="${scenario}">`,
        "utf8",
      ),
    ).toBeLessThanOrEqual(256);
  }
});

it("rejects aggregate overflow before native setup and reserves room for the scenario marker", () => {
  expect(() =>
    validateAndroidTestAssets([
      { fileName: "index.html", source: "x".repeat(965) },
      { fileName: "assets/main.js", source: "x".repeat(4_196_389 - 965) },
    ]),
  ).toThrow(/byte limit/u);
  expect(() =>
    validateAndroidTestAssets([
      { fileName: "index.html", source: "index" },
      { fileName: "assets/main.js", source: "x".repeat(4 * 1024 * 1024 - 5) },
    ]),
  ).toThrow(/byte limit/u);
  expect(
    validateAndroidTestAssets([
      { fileName: "index.html", source: "index" },
      { fileName: "assets/main.js", source: "x".repeat(4 * 1024 * 1024 - 261) },
    ]).bytes,
  ).toBe(4 * 1024 * 1024 - 256);
});

it("counts UTF-8 bytes and preserves native filename, depth, file and index limits", () => {
  expect(
    validateAndroidTestAssets([{ fileName: "index.html", source: "é" }]).bytes,
  ).toBe(2);
  for (const fileName of [
    "../escape.js",
    "/absolute.js",
    "a/b/c/d/e.js",
    "a\\b.js",
  ]) {
    expect(() =>
      validateAndroidTestAssets([{ fileName, source: "x" }]),
    ).toThrow();
  }
  expect(() =>
    validateAndroidTestAssets([
      { fileName: "index.html", source: "x".repeat(65_537) },
    ]),
  ).toThrow(/index/u);
  expect(() =>
    validateAndroidTestAssets(
      Array.from({ length: 65 }, (_, i) => ({
        fileName: i ? `asset${i}.js` : "index.html",
        source: "",
      })),
    ),
  ).toThrow(/file limit/u);
});
