import { describe, expect, it } from "vitest";
import { isAllowedStagingRequest } from "./staging-request-policy";

const expectedOrigin = "https://staging.example.invalid";
const fontPath = "/assets/InterVariable-Abcd1234.woff2";

function allowed(
  path: string,
  resourceType: string,
  method = "GET",
  origin = expectedOrigin,
): boolean {
  return isAllowedStagingRequest({
    url: new URL(path, origin),
    method,
    resourceType,
    expectedOrigin,
  });
}

describe("staging request policy", () => {
  it("admits the root document and existing hashed script and stylesheet requests", () => {
    expect(allowed("/", "document")).toBe(true);
    for (const resourceType of ["script", "stylesheet", "font", "image"]) {
      for (const extension of ["js", "css"]) {
        expect(
          allowed(`/assets/index-Abcd1234.${extension}`, resourceType),
        ).toBe(true);
      }
    }
  });

  it("admits a bundled hashed WOFF2 font", () => {
    expect(allowed(fontPath, "font")).toBe(true);
  });

  it.each(["document", "script", "stylesheet", "image", "fetch", "xhr"])(
    "refuses a WOFF2 request with resource type %s",
    (resourceType) => {
      expect(allowed(fontPath, resourceType)).toBe(false);
    },
  );

  it.each([
    "https://fonts.example.invalid",
    "https://other.staging.example.invalid",
    "http://staging.example.invalid",
    "https://staging.example.invalid:8443",
  ])("refuses a font from a different origin: %s", (origin) => {
    expect(allowed(fontPath, "font", "GET", origin)).toBe(false);
  });

  it.each(["POST", "HEAD", "OPTIONS"])(
    "refuses a font request using %s",
    (method) => {
      expect(allowed(fontPath, "font", method)).toBe(false);
    },
  );

  it.each([
    `${fontPath}?v=1`,
    "/assets/InterVariable.woff2",
    "/assets/InterVariable-Abcd123.woff2",
    "/assets/fonts/InterVariable-Abcd1234.woff2",
    "/fonts/InterVariable-Abcd1234.woff2",
    "/assets/InterVariable-Abcd1234.woff",
    "/assets/InterVariable-Abcd1234.WOFF2",
    "/assets/InterVariable-Abcd1234.woff2.js",
    "/assets/InterVariable-Abcd1234.woff2/extra",
    "/assets/InterVariable%2FAbcd1234.woff2",
  ])("refuses an unexpected font URL: %s", (path) => {
    expect(allowed(path, "font")).toBe(false);
  });

  it.each([
    ["/sign-in", "document"],
    ["/?session=1", "document"],
    ["/assets/index.js", "script"],
    ["/assets/index-Abcd1234.js?data=1", "script"],
    ["/assets/index-Abcd1234.css", "fetch"],
    ["/v1/managed/status", "fetch"],
    ["/socket", "websocket"],
  ])("continues to refuse %s as %s", (path, resourceType) => {
    expect(allowed(path, resourceType)).toBe(false);
  });
});
