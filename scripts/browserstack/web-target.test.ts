import { describe, expect, it } from "vitest";

import { resolveWebRun, resolveWebTarget } from "./web-target";

const sha = "0123456789abcdef0123456789abcdef01234567";
const origin = "https://investment-device-preview.appwrite.network";

describe("BrowserStack fixed target and source identity", () => {
  it("keeps the qualified preview explicit and requires staging to claim source identity", () => {
    expect(resolveWebRun(["--run"])).toEqual({
      run: true,
      target: { mode: "preview", origin, expectedBuildSha: null },
    });
    expect(resolveWebRun(["--check"])).toMatchObject({ run: false });
    expect(() => resolveWebRun(["--run"], sha)).toThrow(
      "Select preview without an expected SHA",
    );
  });

  it.each(["--check-staging", "--run-staging"])(
    "accepts a validated SHA for %s at the single fixed origin",
    (command) => {
      expect(resolveWebRun([command], sha)).toEqual({
        run: command === "--run-staging",
        target: { mode: "staging", origin, expectedBuildSha: sha },
      });
    },
  );

  it.each([
    undefined,
    null,
    "",
    sha.slice(1),
    `${sha}0`,
    sha.toUpperCase(),
    ` ${sha}`,
    `${sha}\n`,
    `${sha.slice(0, -1)}g`,
    "https://other.example.invalid/",
    123,
    {},
  ])("rejects invalid staging identity case %# without echoing it", (value) => {
    for (const command of ["--check-staging", "--run-staging"]) {
      expect(() => resolveWebRun([command], value)).toThrow(
        "Staging requires INVESTMENT_EXPECTED_BUILD_SHA as 40 lowercase hexadecimal characters.",
      );
    }
  });

  it.each([
    { args: [] },
    { args: ["--run", "extra"] },
    { args: ["--run-staging", "--url=https://other.example.invalid/"] },
    { args: ["--run-staging=0123456789abcdef0123456789abcdef01234567"] },
    { args: ["https://other.example.invalid/"] },
    { args: ["--unknown"] },
  ])("refuses unsupported runner arguments case %#", ({ args }) => {
    expect(() => resolveWebRun(args, sha)).toThrow(
      "Use --check or --run for the preview",
    );
  });

  it.each([undefined, null, "", "STAGING", "https://other.example.invalid/"])(
    "refuses an unrecognized child mode case %#",
    (mode) => {
      expect(() => resolveWebTarget(mode, sha)).toThrow(
        "Select preview without an expected SHA",
      );
    },
  );
});
