import { describe, expect, it } from "vitest";
import { buildIdentity } from "./build-identity";

describe("public build identity", () => {
  it("keeps ordinary local builds unlabelled", () => {
    expect(buildIdentity(undefined)).toBeUndefined();
  });
  it("keeps the exact full source SHA", () => {
    expect(buildIdentity("a".repeat(40))).toBe("a".repeat(40));
  });
  it.each([
    "",
    "a".repeat(39),
    "A".repeat(40),
    "a".repeat(41),
    "<script>",
    1,
    null,
  ])("rejects an invalid identity (%s)", (value) =>
    expect(() => buildIdentity(value)).toThrow(),
  );
});
