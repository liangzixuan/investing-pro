import { describe, expect, it } from "vitest";
import {
  parseManagedSecInterimCanonicalRequest,
  MANAGED_SEC_INTERIM_EVIDENCE_LIMITS,
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY,
  PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS,
} from "./personal-sec-interim-statements";
const valid = () => ({
  schemaVersion: "1.0.0",
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  listingId: "listing:example:c",
  symbol: "EX.C",
});
describe("managed interim request", () => {
  it("owns exact version and listing identity without changing Annual's registry", () => {
    const request = valid(),
      result = parseManagedSecInterimCanonicalRequest(request);
    expect(result).toEqual(request);
    expect(result).not.toBe(request);
    expect(Object.isFrozen(result)).toBe(true);
    expect(MANAGED_SEC_INTERIM_EVIDENCE_LIMITS).toEqual({
      requestBytes: 4096,
      responseBytes: 2097152,
    });
    expect(PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY).toHaveLength(32);
    expect(PERSONAL_SEC_INTERIM_STATEMENT_FACT_LIMITS).toEqual({
      concepts: 32,
      candidateRowsPerConcept: 10000,
      observationsPerConcept: 100,
      observations: 3200,
      decimalCharacters: 64,
    });
  });
  it.each([
    ["old annual version", { ...valid(), schemaVersion: "6.0.0" }],
    ["extra CIK", { ...valid(), cik: "0000000001" }],
    ["missing identity", { schemaVersion: "1.0.0" }],
    ["symbol case", { ...valid(), symbol: "ex.c" }],
    ["invalid catalog", { ...valid(), catalogSnapshotSha256: "a".repeat(64) }],
    ["invalid listing", { ...valid(), listingId: "../company" }],
    ["array", []],
    ["null", null],
    ["null prototype", Object.assign(Object.create(null), valid())],
    ["symbol key", { ...valid(), [Symbol("extra")]: true }],
  ])("refuses %s", (_name, request) =>
    expect(parseManagedSecInterimCanonicalRequest(request)).toBeNull(),
  );
  it("does not invoke accessors or accept hidden own fields", () => {
    let reads = 0;
    const getter = Object.defineProperty(valid(), "symbol", {
      enumerable: true,
      get() {
        reads++;
        return "EX.C";
      },
    });
    expect(parseManagedSecInterimCanonicalRequest(getter)).toBeNull();
    expect(reads).toBe(0);
    expect(
      parseManagedSecInterimCanonicalRequest(
        Object.defineProperty(valid(), "hidden", { value: 1 }),
      ),
    ).toBeNull();
  });
});
