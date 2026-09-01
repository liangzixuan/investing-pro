import { describe, expect, it } from "vitest";

import { isPersonalDossierWebMode, isPersonalWebMode } from "./web-mode";

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

describe("personal dossier web mode", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["personal_single_user_local", false],
    ["personal_dossier_extra", false],
    ["personal_dossier", true],
  ] as const)("maps %s to %s", (value, expected) => {
    expect(isPersonalDossierWebMode(value)).toBe(expected);
  });
});
