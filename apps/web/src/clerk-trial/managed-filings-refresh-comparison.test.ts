import { describe, expect, it } from "vitest";
import {
  managedSecFilingsWindow,
  parseManagedSecFilingsResponse,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import { compareManagedFilingsResponses } from "./managed-filings-refresh-comparison";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";

function admitted(response: ManagedSecFilingsResponseDto) {
  const result = parseManagedSecFilingsResponse(response, {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: response.catalogSnapshotSha256,
    listingId: response.security.listingId,
    symbol: response.security.symbol,
  });
  expect(result).not.toBeNull();
  return result!;
}

describe("consecutive admitted filing lists", () => {
  it("keeps current order and exact forms while comparing only accessions", () => {
    const source = filingsResponse(4);
    const previous = admitted({
      ...source,
      issuer: {
        ...source.issuer,
        matchingFilings: 2,
        filings: [source.issuer.filings[1]!, source.issuer.filings[3]!],
      },
    });
    const current = admitted({
      ...source,
      issuer: {
        ...source.issuer,
        filings: source.issuer.filings.map((row, index) => ({
          ...row,
          form: index === 2 ? "8-K/A" : row.form,
        })),
      },
    });
    const comparison = compareManagedFilingsResponses(previous, current)!;
    expect(comparison.previous).toBe(previous);
    expect(comparison.current).toBe(current);
    expect(comparison.newAccessions).toEqual([
      "0000000001-26-000001",
      "0000000001-26-000003",
    ]);
    expect(current.issuer.filings[2]?.form).toBe("8-K/A");
    expect(Object.isFrozen(comparison)).toBe(true);
    expect(Object.isFrozen(comparison.newAccessions)).toBe(true);
    expect(previous.issuer.filings).toHaveLength(2);
  });

  it("keeps both original sliding windows and incomplete coverage without inferring removals", () => {
    const original = filingsResponse(1000);
    const previous = admitted({
      ...original,
      issuer: { ...original.issuer, truncated: true, matchingFilings: 1001 },
    });
    const first = original.issuer.filings[0]!;
    const current = admitted({
      ...original,
      requestStartedAt: "2026-10-13T00:00:00.000Z",
      completedAt: "2026-10-13T00:00:01.000Z",
      window: managedSecFilingsWindow("2026-10-13T00:00:00.000Z")!,
      issuer: {
        ...original.issuer,
        fetchedAt: "2026-10-13T00:00:00.500Z",
        matchingFilings: 1,
        filings: [first],
      },
    });
    const comparison = compareManagedFilingsResponses(previous, current)!;
    expect(comparison.newAccessions).toEqual([]);
    expect(comparison.previous).toBe(previous);
    expect(comparison.current).toBe(current);
    expect(previous.issuer.truncated).toBe(true);
    expect(previous.issuer.olderHistoryAvailable).toBe(true);
    expect(current.window).not.toEqual(previous.window);
    expect(current.issuer.filings[0]).toEqual(first);
  });

  it("compares empty and equal-content packets without inventing a first-load comparison", () => {
    const empty = admitted(filingsResponse(0));
    const current = admitted(filingsResponse(2));
    expect(compareManagedFilingsResponses(null, current)).toBeNull();
    expect(
      compareManagedFilingsResponses(empty, current)?.newAccessions,
    ).toEqual(current.issuer.filings.map((row) => row.accessionNumber));
    expect(
      compareManagedFilingsResponses(current, empty)?.newAccessions,
    ).toEqual([]);
    const equal = admitted(filingsResponse(2));
    expect(equal).not.toBe(current);
    expect(
      compareManagedFilingsResponses(current, equal)?.newAccessions,
    ).toEqual([]);
  });

  it.each([
    "not_covered",
    "invalid_response",
    "rate_limited",
    "upstream_unavailable",
  ] as const)("requires both packets to be available for %s", (status) => {
    const available = admitted(filingsResponse(1));
    const unavailable = admitted(filingsResponse(0, status));
    expect(compareManagedFilingsResponses(unavailable, available)).toBeNull();
    expect(compareManagedFilingsResponses(available, unavailable)).toBeNull();
  });

  it.each([
    ["exchangeMic", "XNYS"],
    ["instrumentType", "adr"],
    ["issuerId", "issuer-other"],
    ["issuerName", "Other Issuer"],
    ["listingId", "listing-other"],
    ["securityId", "security-other"],
    ["securityName", "Other Security"],
    ["shareClassId", "class-other"],
    ["shareClassName", "Other Class"],
    ["symbol", "OTHER"],
  ] as const)("does not compare a different %s", (field, value) => {
    const previous = admitted(filingsResponse(1));
    const wire = filingsResponse(2);
    const current = admitted({
      ...wire,
      security: { ...wire.security, [field]: value },
    });
    expect(compareManagedFilingsResponses(previous, current)).toBeNull();
  });

  it("requires the same issuer CIK and catalog even when listing fields match", () => {
    const previous = admitted(filingsResponse(1));
    const otherCik = admitted(
      filingsResponse(2, "available", {
        ...filingsSelection,
        cik: "0000000002",
      }),
    );
    const otherCatalog = admitted(
      filingsResponse(2, "available", {
        ...filingsSelection,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    );
    expect(compareManagedFilingsResponses(previous, otherCik)).toBeNull();
    expect(compareManagedFilingsResponses(previous, otherCatalog)).toBeNull();
  });
});
