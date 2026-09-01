import { describe, expect, it } from "vitest";

import { ApiModeError, resolveApiMode } from "./api-mode";

describe("API mode", () => {
  it("defaults to the existing synthetic demo", () => {
    expect(resolveApiMode({})).toBe("synthetic_demo");
  });

  it("accepts only the exact named personal modes", () => {
    expect(
      resolveApiMode({ RESEARCH_COCKPIT_MODE: "personal_readiness" }),
    ).toBe("personal_readiness");
    expect(
      resolveApiMode({ RESEARCH_COCKPIT_MODE: "personal_fact_release" }),
    ).toBe("personal_fact_release");
    expect(resolveApiMode({ RESEARCH_COCKPIT_MODE: "personal_dossier" })).toBe(
      "personal_dossier",
    );
    expect(
      resolveApiMode({
        RESEARCH_COCKPIT_MODE: "personal_single_user_local_connected",
      }),
    ).toBe("personal_single_user_local_connected");
    for (const value of [
      "",
      "personal",
      "personal_connected",
      "PERSONAL_SINGLE_USER_LOCAL_CONNECTED",
      "PERSONAL_READINESS",
      "production",
    ]) {
      expect(() => resolveApiMode({ RESEARCH_COCKPIT_MODE: value })).toThrow(
        ApiModeError,
      );
    }
  });
});
