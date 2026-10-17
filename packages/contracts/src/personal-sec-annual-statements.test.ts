import { describe, expect, it, vi } from "vitest";
import { parseManagedSecAnnualCanonicalRequest } from "./personal-sec-annual-statements";

const input = () => ({
  schemaVersion: "6.0.0",
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  listingId: "listing-invented",
  symbol: "INVENTED",
});

describe("canonical annual request", () => {
  it("owns the fixed request and leaves CIK selection to the catalog", () => {
    const source = input();
    const captured = parseManagedSecAnnualCanonicalRequest(source);
    expect(captured).toEqual(source);
    expect(Object.isFrozen(captured)).toBe(true);
    source.symbol = "OTHER";
    expect(captured?.symbol).toBe("INVENTED");
    expect(
      parseManagedSecAnnualCanonicalRequest({ ...input(), cik: "0000000042" }),
    ).toBeNull();
  });

  it.each([
    { schemaVersion: "5.0.0" },
    { schemaVersion: "7.0.0" },
    { catalogSnapshotSha256: `sha256:${"A".repeat(64)}` },
    { listingId: "UPPERCASE" },
    { listingId: "ab" },
    { symbol: "lowercase" },
    { symbol: "TOO-LONG-TO-ADMIT" },
  ])("refuses a mismatched wire field %j", (changed) => {
    expect(
      parseManagedSecAnnualCanonicalRequest({ ...input(), ...changed }),
    ).toBeNull();
  });

  it("refuses inherited, hidden, symbolic, accessor and serialization fields without reading them", () => {
    const getter = vi.fn(() => "6.0.0");
    const toJSON = vi.fn(input);
    const accessor = Object.defineProperty(input(), "schemaVersion", {
      enumerable: true,
      get: getter,
    });
    const hidden = Object.defineProperty(input(), "symbol", {
      enumerable: false,
      value: "INVENTED",
    });
    for (const value of [
      null,
      [],
      Object.create(input()),
      Object.assign(Object.create(null), input()),
      accessor,
      hidden,
      { ...input(), [Symbol("extra")]: 1 },
      { ...input(), toJSON },
    ]) {
      expect(parseManagedSecAnnualCanonicalRequest(value)).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  });
});
