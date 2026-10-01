import { describe, expect, it } from "vitest";
import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  MANAGED_SEC_ANNUAL_EVIDENCE_PATH,
  parseManagedSecAnnualEvidenceRequest,
} from "./index";

function request() {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "synthetic-listing-a",
    symbol: "ZERO.A",
  };
}

describe("managed annual SEC request", () => {
  it("owns the four fields and preserves exact requested listing/class spelling", () => {
    const input = request();
    const result = parseManagedSecAnnualEvidenceRequest(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
    input.listingId = "synthetic-listing-b";
    input.symbol = "ZERO.B";
    expect(result?.listingId).toBe("synthetic-listing-a");
    expect(result?.symbol).toBe("ZERO.A");
  });

  it.each([
    null,
    [],
    "request",
    { ...request(), schemaVersion: "2.0.0" },
    { ...request(), catalogSnapshotSha256: `sha256:${"A".repeat(64)}` },
    { ...request(), catalogSnapshotSha256: "a".repeat(64) },
    { ...request(), listingId: "ab" },
    { ...request(), listingId: "a".repeat(129) },
    { ...request(), listingId: "HTTPS://example.test" },
    { ...request(), symbol: "" },
    { ...request(), symbol: "aapl" },
    { ...request(), symbol: "A".repeat(16) },
    { ...request(), symbol: "AAPL " },
    { ...request(), cik: "0000000001" },
    { ...request(), sourceUrl: "https://data.sec.gov" },
    { ...request(), [Symbol("extra")]: true },
    Object.create(request()),
  ])("rejects malformed or non-exact request %#", (input) => {
    expect(parseManagedSecAnnualEvidenceRequest(input)).toBeNull();
  });

  it("captures each getter once and rejects throwing access without leaking it", () => {
    let reads = 0;
    const input = {
      ...request(),
      get symbol() {
        reads++;
        return reads === 1 ? "ZERO.A" : "OTHER";
      },
    };
    expect(parseManagedSecAnnualEvidenceRequest(input)?.symbol).toBe("ZERO.A");
    expect(reads).toBe(1);
    expect(
      parseManagedSecAnnualEvidenceRequest({
        ...request(),
        get listingId() {
          throw new Error("Synthetic private diagnostic");
        },
      }),
    ).toBeNull();
  });

  it("exports the selected route and contains the maximal ASCII request", () => {
    const maximal = parseManagedSecAnnualEvidenceRequest({
      ...request(),
      listingId: "a".repeat(128),
      symbol: "A".repeat(15),
    });
    expect(maximal).not.toBeNull();
    expect(MANAGED_SEC_ANNUAL_EVIDENCE_PATH).toBe(
      "/v1/managed/sec-annual-evidence",
    );
    expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS).toEqual({
      requestBytes: 4096,
      responseBytes: 2097152,
    });
    expect(
      new TextEncoder().encode(JSON.stringify(maximal)).byteLength,
    ).toBeLessThan(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.requestBytes);
  });
});
