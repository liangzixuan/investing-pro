import { describe, expect, it } from "vitest";
import {
  managedEodHistoryWindow,
  parseManagedEodError,
  parseManagedEodHistoryRequest,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
} from "./managed-eod-history";

const request: ManagedEodHistoryRequestDto = {
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  listingId: "listing-one",
  range: "1m",
};
function packet(): ManagedEodHistoryResponseDto {
  return {
    schemaVersion: "1.0.0",
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
    },
    range: "1m",
    provider: "Tiingo",
    currency: "USD",
    priceBasis: "raw_close",
    window: { startDate: "2026-09-02", endDate: "2026-10-02" },
    requestStartedAt: "2026-10-02T18:00:00.000Z",
    completedAt: "2026-10-02T18:00:00.123Z",
    rows: [
      { date: "2026-09-02", close: "10.123456789123456789" },
      { date: "2026-10-01", close: "12" },
    ],
  };
}
const parse = (value: unknown) =>
  parseManagedEodHistoryResponse(value, request);

describe("managed EOD request", () => {
  it("owns only the selected listing, current digest and fixed month", () => {
    const input = { ...request };
    const captured = parseManagedEodHistoryRequest(input);
    expect(captured).toEqual(input);
    input.listingId = "listing-other";
    expect(captured?.listingId).toBe("listing-one");
    expect(Object.isFrozen(captured)).toBe(true);
  });
  it.each([
    null,
    [],
    { ...request, symbol: "ONE" },
    { ...request, range: "1y" },
    { ...request, catalogSnapshotSha256: "sha256:bad" },
    { ...request, listingId: "../other" },
    { ...request, listingId: "x".repeat(129) },
  ])("refuses malformed or broader request %j", (value) => {
    expect(parseManagedEodHistoryRequest(value)).toBeNull();
  });
  it("refuses getters without invoking them and catches proxy traps", () => {
    let calls = 0;
    const input = { ...request };
    Object.defineProperty(input, "listingId", {
      enumerable: true,
      get: () => {
        calls += 1;
        return "listing-one";
      },
    });
    expect(parseManagedEodHistoryRequest(input)).toBeNull();
    expect(calls).toBe(0);
    expect(
      parseManagedEodHistoryRequest(
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

describe("calendar-month window", () => {
  it.each([
    ["2024-03-31", "2024-02-29"],
    ["2026-03-31", "2026-02-28"],
    ["2026-01-31", "2025-12-31"],
    ["2026-10-02", "2026-09-02"],
  ])("clamps %s to %s", (endDate, startDate) => {
    expect(managedEodHistoryWindow(`${endDate}T23:59:59.000Z`)).toEqual({
      startDate,
      endDate,
    });
  });
  it.each([
    "2026-02-30T00:00:00.000Z",
    "2026-10-02",
    "2026-10-02T00:00:00Z",
    "bad",
  ])("refuses noncanonical start %s", (value) => {
    expect(managedEodHistoryWindow(value)).toBeNull();
  });
});

describe("managed EOD response", () => {
  it("owns and freezes nested data, preserving normalized decimal strings", () => {
    const input = packet();
    const result = parse(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(result?.security).not.toBe(input.security);
    expect(result?.rows).not.toBe(input.rows);
    expect(result?.rows[0]?.close).toBe("10.123456789123456789");
    for (const value of [
      result,
      result?.security,
      result?.window,
      result?.rows,
      result?.rows[0],
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    (input.rows[0] as { close: string }).close = "999";
    expect(result?.rows[0]?.close).toBe("10.123456789123456789");
  });
  it.each([
    { schemaVersion: "2.0.0" },
    { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
    { range: "1y" },
    { currency: "CAD" },
    { provider: "Other" },
    { priceBasis: "adjusted_close" },
    { requestStartedAt: "2026-10-02T18:00:00Z" },
    { completedAt: "2026-10-02T17:59:59.999Z" },
    { completedAt: "2026-10-02T18:00:10.000Z" },
    { extra: true },
    { window: { startDate: "2026-09-01", endDate: "2026-10-02" } },
    { window: { startDate: "2026-09-02", endDate: "2026-10-03" } },
  ])("rejects mismatched metadata %j", (patch) => {
    expect(parse({ ...packet(), ...patch })).toBeNull();
  });
  it.each([
    { listingId: "listing-other" },
    { country: "CA" },
    { symbol: "one" },
    { shareClassId: "" },
    { issuerName: "Bad\nName" },
    { securityId: "" },
    { note: "not an identity field" },
  ])("rejects malformed or mismatched identity %j", (patch) => {
    const input = packet();
    expect(
      parse({ ...input, security: { ...input.security, ...patch } }),
    ).toBeNull();
  });
  it.each([
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1e3",
    "01",
    "1.0",
    "0.10",
    " 1",
    "1 ",
    "1".repeat(65),
  ])("rejects invalid normalized close %s", (close) => {
    expect(
      parse({ ...packet(), rows: [{ date: "2026-10-01", close }] }),
    ).toBeNull();
  });
  it.each(["0.000000000000000001", "123456789012345678901234567890.123456789"])(
    "preserves positive decimals %s",
    (close) => {
      expect(
        parse({ ...packet(), rows: [{ date: "2026-10-01", close }] })?.rows[0]
          ?.close,
      ).toBe(close);
    },
  );
  it.each(
    [
      [],
      [{ date: "2026-09-01", close: "1" }],
      [{ date: "2026-10-03", close: "1" }],
      [{ date: "2026-09-31", close: "1" }],
      [
        { date: "2026-09-03", close: "1" },
        { date: "2026-09-02", close: "2" },
      ],
      [
        { date: "2026-09-03", close: "1" },
        { date: "2026-09-03", close: "2" },
      ],
    ].map((rows) => ({ rows })),
  )(
    "rejects empty, unordered, duplicate or out-of-window rows %j",
    ({ rows }) => {
      expect(parse({ ...packet(), rows })).toBeNull();
    },
  );
  it("accepts exactly 32 distinct inclusive calendar days and rejects 33", () => {
    const rows = Array.from({ length: 32 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 6, 31 + index)).toISOString().slice(0, 10),
      close: "1",
    }));
    const input = {
      ...packet(),
      requestStartedAt: "2026-08-31T00:00:00.000Z",
      completedAt: "2026-08-31T00:00:00.001Z",
      window: { startDate: "2026-07-31", endDate: "2026-08-31" },
      rows,
    };
    expect(parse(input)?.rows).toHaveLength(32);
    expect(
      parse({ ...input, rows: [...rows, { date: "2026-09-01", close: "1" }] }),
    ).toBeNull();
  });
  it("does not read accessor values on row arrays, rows or identity", () => {
    let calls = 0;
    const getter = {
      enumerable: true,
      get: () => {
        calls += 1;
        return "1";
      },
    };
    const row = { date: "2026-10-01", close: "1" };
    Object.defineProperty(row, "close", getter);
    expect(parse({ ...packet(), rows: [row] })).toBeNull();
    const rows = [{ date: "2026-10-01", close: "1" }];
    Object.defineProperty(rows, "0", getter);
    expect(parse({ ...packet(), rows })).toBeNull();
    const security = { ...packet().security };
    Object.defineProperty(security, "symbol", getter);
    expect(parse({ ...packet(), security })).toBeNull();
    expect(calls).toBe(0);
  });
  it("rejects sparse and decorated arrays, symbols and inherited fields", () => {
    expect(parse({ ...packet(), rows: new Array(1) })).toBeNull();
    const rows = Object.assign([...packet().rows], { extra: true });
    expect(parse({ ...packet(), rows })).toBeNull();
    expect(parse({ ...packet(), [Symbol("hidden")]: true })).toBeNull();
    expect(parse(Object.create(packet()))).toBeNull();
  });
  it("never binds a packet to an invalid captured request", () => {
    expect(
      parseManagedEodHistoryResponse(packet(), {
        ...request,
        range: "1y",
      } as unknown as ManagedEodHistoryRequestDto),
    ).toBeNull();
  });
});

describe("finite managed EOD errors", () => {
  it("distinguishes local quota release from an upstream limit without a known reset", () => {
    expect(
      parseManagedEodError({
        error: "rate_limited",
        nextAllowedAt: "2026-10-02T19:00:00.000Z",
      }),
    ).toEqual({
      error: "rate_limited",
      nextAllowedAt: "2026-10-02T19:00:00.000Z",
    });
    expect(parseManagedEodError({ error: "source_rate_limited" })).toEqual({
      error: "source_rate_limited",
    });
  });
  it.each([
    { error: "rate_limited" },
    { error: "source_rate_limited", nextAllowedAt: "2026-10-02T19:00:00.000Z" },
    { error: "rate_limited", nextAllowedAt: "tomorrow" },
    { error: "unknown" },
    { error: "unavailable", rawMessage: "do not expose" },
  ])("refuses unbounded or guessed error metadata %j", (value) => {
    expect(parseManagedEodError(value)).toBeNull();
  });
});
