import { describe, expect, it } from "vitest";
import {
  MANAGED_EOD_HISTORY_LIMITS,
  MANAGED_EOD_HISTORY_RANGE_LIMITS,
  managedEodHistoryWindow,
  parseManagedEodError,
  parseManagedEodHistoryRequest,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRange,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
} from "./managed-eod-history";

const request: ManagedEodHistoryRequestDto = {
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  listingId: "listing-one",
  range: "1m",
};
function packet(
  range: ManagedEodHistoryRange = "1m",
): ManagedEodHistoryResponseDto {
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
    range,
    provider: "Tiingo",
    currency: "USD",
    priceBasis: "raw_close",
    window: {
      startDate: range === "1m" ? "2026-09-02" : "2025-10-02",
      endDate: "2026-10-02",
    },
    requestStartedAt: "2026-10-02T18:00:00.000Z",
    completedAt: "2026-10-02T18:00:00.123Z",
    rows: [
      { date: "2026-09-02", close: "10.123456789123456789" },
      { date: "2026-10-01", close: "12" },
    ],
  };
}
const parse = (value: unknown, range: ManagedEodHistoryRange = "1m") =>
  parseManagedEodHistoryResponse(value, { ...request, range });

describe("managed EOD request", () => {
  it.each(["1m", "1y"] as const)("owns the exact %s request", (range) => {
    const input = { ...request, range };
    const captured = parseManagedEodHistoryRequest(input);
    expect(captured).toEqual(input);
    input.listingId = "listing-other";
    expect(captured?.listingId).toBe("listing-one");
    input.range = range === "1m" ? "1y" : "1m";
    expect(captured?.range).toBe(range);
    expect(Object.isFrozen(captured)).toBe(true);
  });
  it.each([
    null,
    [],
    { ...request, symbol: "ONE" },
    { ...request, range: "3m" },
    { ...request, range: "1Y" },
    { ...request, range: "1y " },
    { ...request, range: 1 },
    { ...request, range: null },
    { catalogSnapshotSha256: request.catalogSnapshotSha256, listingId: "one" },
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

describe("UTC calendar range window", () => {
  it.each([
    ["2024-03-31", "2024-02-29"],
    ["2026-03-31", "2026-02-28"],
    ["2026-01-31", "2025-12-31"],
    ["2026-10-02", "2026-09-02"],
  ])("clamps %s to %s", (endDate, startDate) => {
    expect(managedEodHistoryWindow(`${endDate}T23:59:59.000Z`, "1m")).toEqual({
      startDate,
      endDate,
    });
  });
  it.each([
    ["2024-02-29", "2023-02-28"],
    ["2024-03-01", "2023-03-01"],
    ["2025-02-28", "2024-02-28"],
    ["2026-01-31", "2025-01-31"],
    ["2026-10-02", "2025-10-02"],
  ])("clamps a year ending %s to %s", (endDate, startDate) => {
    const window = managedEodHistoryWindow(`${endDate}T00:00:00.000Z`, "1y");
    expect(window).toEqual({ startDate, endDate });
    expect(Object.isFrozen(window)).toBe(true);
  });
  it.each([
    "2026-02-30T00:00:00.000Z",
    "2026-10-02",
    "2026-10-02T00:00:00Z",
    "bad",
  ])("refuses noncanonical start %s", (value) => {
    expect(managedEodHistoryWindow(value, "1m")).toBeNull();
    expect(managedEodHistoryWindow(value, "1y")).toBeNull();
  });
  it.each([undefined, null, "3m", "1Y", "1y ", 12])(
    "requires an explicit supported range: %j",
    (range) => {
      expect(
        managedEodHistoryWindow(
          "2026-10-02T00:00:00.000Z",
          range as ManagedEodHistoryRange,
        ),
      ).toBeNull();
    },
  );
  it.each(["1m", "1y"] as const)("refuses %s year underflow", (range) => {
    expect(
      managedEodHistoryWindow("0000-01-01T00:00:00.000Z", range),
    ).toBeNull();
  });
});

describe("managed EOD response", () => {
  it.each(["1m", "1y"] as const)(
    "owns and freezes exact %s packets",
    (range) => {
      const input = packet(range);
      const result = parse(input, range);
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
    },
  );
  it.each(["1m", "1y"] as const)(
    "binds the %s range and its exact window to the captured request",
    (range) => {
      const otherRange = range === "1m" ? "1y" : "1m";
      expect(parse(packet(range), otherRange)).toBeNull();
      expect(
        parse({ ...packet(range), window: packet(otherRange).window }, range),
      ).toBeNull();
    },
  );
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
  it("accepts 367 inclusive leap-year dates within the unchanged response cap", () => {
    const close = "9".repeat(64);
    const rows = Array.from({ length: 367 }, (_, index) => ({
      date: new Date(Date.UTC(2023, 2, 1 + index)).toISOString().slice(0, 10),
      close,
    }));
    const input = {
      ...packet("1y"),
      requestStartedAt: "2024-03-01T00:00:00.000Z",
      completedAt: "2024-03-01T00:00:09.999Z",
      window: { startDate: "2023-03-01", endDate: "2024-03-01" },
      rows,
    };
    const result = parse(input, "1y");
    expect(result).toEqual(input);
    expect(result?.rows).toHaveLength(367);
    expect(result?.rows[0]).toEqual({ date: "2023-03-01", close });
    expect(result?.rows[366]).toEqual({ date: "2024-03-01", close });
    expect(
      new TextEncoder().encode(JSON.stringify(result)).byteLength,
    ).toBeLessThan(MANAGED_EOD_HISTORY_LIMITS.responseBytes);
    expect(
      parse({ ...input, rows: [...rows, { date: "2024-03-02", close }] }, "1y"),
    ).toBeNull();
    expect(
      parse({ ...input, completedAt: "2024-03-01T00:00:10.000Z" }, "1y"),
    ).toBeNull();
  });
  it.each(
    [
      [],
      [{ date: "2025-10-01", close: "1" }],
      [{ date: "2026-10-03", close: "1" }],
      [{ date: "2026-02-29", close: "1" }],
      [
        { date: "2026-09-03", close: "1" },
        { date: "2026-09-02", close: "2" },
      ],
      [
        { date: "2026-09-03", close: "1" },
        { date: "2026-09-03", close: "2" },
      ],
      [{ date: "2026-10-01", close: "1", volume: "2" }],
    ].map((rows) => ({ rows })),
  )("rejects malformed or out-of-year rows %j", ({ rows }) => {
    expect(parse({ ...packet("1y"), rows }, "1y")).toBeNull();
  });
  it.each(["1m", "1y"] as const)(
    "does not invoke %s data accessors",
    (range) => {
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
      expect(parse({ ...packet(range), rows: [row] }, range)).toBeNull();
      const rows = [{ date: "2026-10-01", close: "1" }];
      Object.defineProperty(rows, "0", getter);
      expect(parse({ ...packet(range), rows }, range)).toBeNull();
      const security = { ...packet(range).security };
      Object.defineProperty(security, "symbol", getter);
      expect(parse({ ...packet(range), security }, range)).toBeNull();
      expect(calls).toBe(0);
    },
  );
  it.each(["1m", "1y"] as const)(
    "rejects nonclosed %s arrays and records",
    (range) => {
      expect(parse({ ...packet(range), rows: new Array(1) }, range)).toBeNull();
      const rows = Object.assign([...packet(range).rows], { extra: true });
      expect(parse({ ...packet(range), rows }, range)).toBeNull();
      expect(
        parse({ ...packet(range), [Symbol("hidden")]: true }, range),
      ).toBeNull();
      expect(parse(Object.create(packet(range)), range)).toBeNull();
    },
  );
  it("never binds a packet to an invalid captured request", () => {
    expect(
      parseManagedEodHistoryResponse(packet(), {
        ...request,
        range: "3m",
      } as unknown as ManagedEodHistoryRequestDto),
    ).toBeNull();
  });
});

describe("managed EOD range bounds", () => {
  it("keeps common caps and owns separate immutable range limits", () => {
    expect(MANAGED_EOD_HISTORY_LIMITS).toEqual({
      requestBytes: 4_096,
      responseBytes: 65_536,
    });
    expect(MANAGED_EOD_HISTORY_RANGE_LIMITS).toEqual({
      "1m": { rows: 32, sourceBytes: 32_768 },
      "1y": { rows: 367, sourceBytes: 262_144 },
    });
    for (const value of [
      MANAGED_EOD_HISTORY_LIMITS,
      MANAGED_EOD_HISTORY_RANGE_LIMITS,
      MANAGED_EOD_HISTORY_RANGE_LIMITS["1m"],
      MANAGED_EOD_HISTORY_RANGE_LIMITS["1y"],
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
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
