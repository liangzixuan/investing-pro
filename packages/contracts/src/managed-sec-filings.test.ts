import { describe, expect, it } from "vitest";
import {
  MANAGED_SEC_FILINGS_LIMITS,
  managedSecFilingsWindow,
  parseManagedSecFilingsError,
  parseManagedSecFilingsRequest,
  parseManagedSecFilingsResponse,
  type ManagedSecFilingsRequestDto,
  type ManagedSecFilingsResponseDto,
} from "./managed-sec-filings";

const request: ManagedSecFilingsRequestDto = {
  schemaVersion: "1.0.0",
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  listingId: "listing-one",
  symbol: "ONE",
};
const START = "2026-10-12T00:00:00.000Z";
function filing(index = 1) {
  const accessionNumber = `0000000001-26-${String(index).padStart(6, "0")}`;
  return {
    cik: "0000000001",
    accessionNumber,
    form: "10-K/A",
    filingDate: "2026-10-12",
    reportDate: null,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${accessionNumber}-index.htm`,
  };
}
function response(): ManagedSecFilingsResponseDto {
  return {
    schemaVersion: request.schemaVersion,
    catalogSnapshotSha256: request.catalogSnapshotSha256,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "issuer-one",
      issuerName: "One Example Inc.",
      listingId: request.listingId,
      securityId: "security-one",
      securityName: "One Common Stock",
      shareClassId: "class-one",
      shareClassName: "Common Stock",
      symbol: "ONE",
      cik: "0000000001",
    },
    window: {
      lookbackDays: 90,
      fromDate: "2026-07-15",
      throughDate: "2026-10-12",
    },
    requestStartedAt: START,
    completedAt: "2026-10-12T00:00:01.000Z",
    issuer: {
      cik: "0000000001",
      status: "available",
      fetchedAt: "2026-10-12T00:00:00.500Z",
      sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
      olderHistoryAvailable: true,
      matchingFilings: 1,
      truncated: false,
      filings: [filing()],
    },
  };
}
const parse = (value: unknown) =>
  parseManagedSecFilingsResponse(value, request);

describe("managed Filings request and fixed window", () => {
  it("copies only the exact selection and captures 90 inclusive UTC dates", () => {
    const input = { ...request };
    const result = parseManagedSecFilingsRequest(input);
    input.symbol = "TWO";
    expect(result).toEqual(request);
    expect(Object.isFrozen(result)).toBe(true);
    expect(managedSecFilingsWindow(START)).toEqual(response().window);
    expect(managedSecFilingsWindow("2024-03-01T23:59:59.999Z")).toEqual({
      lookbackDays: 90,
      fromDate: "2023-12-03",
      throughDate: "2024-03-01",
    });
  });
  it.each([
    { cik: "0000000001" },
    { fromDate: "2026-01-01" },
    { url: "https://example.test" },
    { schemaVersion: "2.0.0" },
    { listingId: "../one" },
    { symbol: "one" },
    { catalogSnapshotSha256: "sha256:bad" },
  ])("rejects caller scope expansion or malformed identity %j", (patch) => {
    expect(parseManagedSecFilingsRequest({ ...request, ...patch })).toBeNull();
  });
  it.each([
    "2026-02-30T00:00:00.000Z",
    "2026-10-12",
    "2026-10-12T00:00:00Z",
    "bad",
  ])("rejects invalid clock %s", (value) =>
    expect(managedSecFilingsWindow(value)).toBeNull(),
  );
  it("does not invoke getters and catches proxy traps", () => {
    let calls = 0;
    const input = { ...request };
    Object.defineProperty(input, "symbol", {
      enumerable: true,
      get: () => {
        calls++;
        return "ONE";
      },
    });
    expect(parseManagedSecFilingsRequest(input)).toBeNull();
    expect(calls).toBe(0);
    expect(
      parseManagedSecFilingsRequest(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error("trap");
            },
          },
        ),
      ),
    ).toBeNull();
  });
});

describe("managed Filings response", () => {
  it("preserves amendment, nullable report date, exact identities and inspectable source coverage", () => {
    const value = response();
    const result = parse(value)!;
    expect(result).toEqual(value);
    expect(result).not.toBe(value);
    expect(Object.isFrozen(result.issuer.filings[0])).toBe(true);
    expect(Object.isFrozen(result.issuer.filings)).toBe(true);
    expect(result.issuer.filings[0]?.form).toBe("10-K/A");
  });
  it.each([
    "not_covered",
    "rate_limited",
    "upstream_unavailable",
    "invalid_response",
  ] as const)(
    "preserves source status %s without inventing a shared budget deadline",
    (status) => {
      const value = response();
      const issuer = {
        ...value.issuer,
        status,
        olderHistoryAvailable: false,
        matchingFilings: 0,
        filings: [],
      };
      expect(parse({ ...value, issuer })?.issuer.status).toBe(status);
      expect(
        parse({ ...value, issuer: { ...issuer, nextAllowedAt: START } }),
      ).toBeNull();
      expect(
        parse({ ...value, issuer: { ...issuer, olderHistoryAvailable: true } }),
      ).toBeNull();
    },
  );
  it("preserves a successful empty current object without implying full archive coverage", () => {
    const value = response();
    const issuer = { ...value.issuer, matchingFilings: 0, filings: [] };
    expect(parse({ ...value, issuer })?.issuer).toEqual(issuer);
  });
  it("accepts 1000 retained rows with a larger truthful matching count", () => {
    const value = response();
    const issuer = {
      ...value.issuer,
      matchingFilings: 1001,
      truncated: true,
      filings: Array.from({ length: 1000 }, (_, index) => filing(index + 1)),
    };
    expect(parse({ ...value, issuer })?.issuer.filings).toHaveLength(1000);
    expect(
      parse({ ...value, issuer: { ...issuer, truncated: false } }),
    ).toBeNull();
    expect(
      parse({
        ...value,
        issuer: { ...issuer, filings: issuer.filings.slice(1) },
      }),
    ).toBeNull();
    expect(
      parse({ ...value, issuer: { ...issuer, matchingFilings: 10001 } }),
    ).toBeNull();
    expect(
      new TextEncoder().encode(JSON.stringify({ ...value, issuer })).byteLength,
    ).toBeLessThan(MANAGED_SEC_FILINGS_LIMITS.responseBytes);
  });
  it.each([
    { security: { ...response().security, listingId: "another" } },
    { security: { ...response().security, symbol: "TWO" } },
    { security: { ...response().security, cik: "0000000000" } },
    { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
    { window: { ...response().window, fromDate: "2026-07-14" } },
    { window: { ...response().window, lookbackDays: 91 } },
    { requestStartedAt: "2026-02-30T00:00:00.000Z" },
    { completedAt: "2026-10-12T00:00:10.000Z" },
    { completedAt: "2026-10-11T23:59:59.999Z" },
    { extra: true },
  ])("rejects envelope mismatch %j", (patch) =>
    expect(parse({ ...response(), ...patch })).toBeNull(),
  );
  it.each([
    { cik: "0000000002" },
    { status: "unknown" },
    { sourceUrl: "https://example.test" },
    { fetchedAt: "2026-10-11T23:59:59.999Z" },
    { fetchedAt: "2026-10-12T00:00:01.001Z" },
    { matchingFilings: -1 },
    { matchingFilings: 1.5 },
    { matchingFilings: 2 },
    { truncated: true },
  ])("rejects inconsistent source packet %j", (patch) =>
    expect(
      parse({ ...response(), issuer: { ...response().issuer, ...patch } }),
    ).toBeNull(),
  );
  it.each([
    { cik: "0000000002" },
    { accessionNumber: "bad" },
    { form: "10-K " },
    { filingDate: "2026-07-14" },
    { filingDate: "2026-10-13" },
    { reportDate: "2026-02-30" },
    { sourceUrl: "https://www.sec.gov.evil.test/filing" },
    {
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/2/0000000001-26-000001-index.htm",
    },
    { primaryDocument: "filing.htm" },
  ])("rejects inconsistent filing %j", (patch) =>
    expect(
      parse({
        ...response(),
        issuer: { ...response().issuer, filings: [{ ...filing(), ...patch }] },
      }),
    ).toBeNull(),
  );
  it("rejects duplicates, unsorted rows, sparse/accessor arrays and nested getters without reading them", () => {
    const value = response();
    for (const filings of [
      [filing(), filing()],
      [filing(2), filing(1)],
      new Array(2),
    ])
      expect(
        parse({
          ...value,
          issuer: { ...value.issuer, matchingFilings: 2, filings },
        }),
      ).toBeNull();
    let calls = 0;
    const rows = [filing()];
    Object.defineProperty(rows, 0, {
      enumerable: true,
      get: () => {
        calls++;
        return filing();
      },
    });
    expect(
      parse({ ...value, issuer: { ...value.issuer, filings: rows } }),
    ).toBeNull();
    const source = { ...value.issuer };
    Object.defineProperty(source, "fetchedAt", {
      enumerable: true,
      get: () => {
        calls++;
        return START;
      },
    });
    expect(parse({ ...value, issuer: source })).toBeNull();
    expect(calls).toBe(0);
  });
});

describe("shared SEC error envelope", () => {
  it("accepts only explicit errors and canonical budget deadlines", () => {
    expect(parseManagedSecFilingsError({ error: "unavailable" })).toEqual({
      error: "unavailable",
    });
    expect(
      parseManagedSecFilingsError({
        error: "rate_limited",
        nextAllowedAt: START,
      }),
    ).toEqual({ error: "rate_limited", nextAllowedAt: START });
    for (const value of [
      { error: "rate_limited" },
      { error: "rate_limited", nextAllowedAt: "bad" },
      { error: "unavailable", message: "private" },
      { error: "unknown" },
    ])
      expect(parseManagedSecFilingsError(value)).toBeNull();
  });
});
