import { describe, expect, it } from "vitest";

import { isPersonalWebMode } from "./web-mode";

describe("personal web mode", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["personal_single_user_local_extra", false],
    ["personal_single_user_local", true],
  ] as const)("maps %s to %s", (value, expected) => {
    expect(isPersonalWebMode(value)).toBe(expected);
  });
});
