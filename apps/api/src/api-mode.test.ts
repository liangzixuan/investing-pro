import { describe, expect, it } from "vitest";

import { ApiModeError, resolveApiMode } from "./api-mode";

describe("API mode", () => {
  it("defaults to the existing synthetic demo", () => {
    expect(resolveApiMode({})).toBe("synthetic_demo");
  });

  it("accepts only the exact personal-readiness mode", () => {
    expect(
      resolveApiMode({ RESEARCH_COCKPIT_MODE: "personal_readiness" }),
    ).toBe("personal_readiness");
    for (const value of ["", "personal", "PERSONAL_READINESS", "production"]) {
      expect(() => resolveApiMode({ RESEARCH_COCKPIT_MODE: value })).toThrow(
        ApiModeError,
      );
    }
  });
});
