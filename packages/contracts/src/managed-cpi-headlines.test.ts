import { describe, expect, it, vi } from "vitest";
import {
  compareCpiSourceInstants,
  isCpiHeadlineUrl,
  MANAGED_CPI_HEADLINE_SOURCE,
  MANAGED_CPI_HEADLINES_LIMITS,
  parseCpiSourceInstant,
  parseManagedCpiHeadline,
  parseManagedCpiHeadlines,
} from "./managed-cpi-headlines";
function packet() {
  return {
    schemaVersion: "1.0.0",
    source: { ...MANAGED_CPI_HEADLINE_SOURCE },
    fetchedAt: "2026-10-28T19:00:00.000Z",
    feedUpdatedAt: "2026-10-14T07:50:31.2-04:00" as string | null,
    availableItemCount: 2,
    items: [
      {
        sourceId: "invented-cpi-a",
        title: "Invented café CPI headline",
        url: "https://www.bls.gov/news.release/archives/cpi_10142026.htm",
        publishedAt: "2026-10-14T07:50:31.2000001-04:00" as string | null,
        updatedAt: "2025-01-01T00:00:00Z" as string | null,
      },
      {
        sourceId: "invented-cpi-b",
        title: "Invented unknown clock",
        url: "https://www.bls.gov/news.release/archives/cpi_09112026.htm",
        publishedAt: null as string | null,
        updatedAt: null as string | null,
      },
    ],
  };
}
describe("qualified CPI source clocks and archive links", () => {
  it.each([
    ["2026-09-11T07:50:40.968-04:00", "2026-09-11T11:50:40.968Z"],
    ["2026-09-11T07:50:40.0000001-04:00", "2026-09-11T11:50:40.000Z"],
    ["2026-01-01T00:00:00+05:30", "2025-12-31T18:30:00.000Z"],
    ["2000-02-29T23:59:59Z", "2000-02-29T23:59:59.000Z"],
    ["2026-01-01T00:00:00+00:00", "2026-01-01T00:00:00.000Z"],
  ])("derives UTC from %s without rewriting the input", (raw, utc) =>
    expect(parseCpiSourceInstant(raw)).toBe(utc),
  );
  it.each([
    null,
    undefined,
    1,
    "",
    "2026-10-28",
    "2026-10-28T12:00:00",
    "2026-02-29T00:00:00Z",
    "1900-02-29T00:00:00Z",
    "2026-04-31T00:00:00Z",
    "2026-00-01T00:00:00Z",
    "2026-01-00T00:00:00Z",
    "0000-01-01T00:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01T00:60:00Z",
    "2026-01-01T00:00:60Z",
    "2026-01-01T00:00:00-00:00",
    "2026-01-01T00:00:00+24:00",
    "2026-01-01T00:00:00+01:60",
    "2026-01-01T00:00:00.z",
    " 2026-01-01T00:00:00Z",
    `2026-01-01T00:00:00.${"1".repeat(64)}Z`,
  ])("refuses malformed or unqualified source clock %#", (raw) =>
    expect(parseCpiSourceInstant(raw)).toBeNull(),
  );
  it("orders exact submillisecond fractions and equivalent offsets", () => {
    expect(
      compareCpiSourceInstants(
        "2026-01-01T00:00:00.0000002Z",
        "2025-12-31T19:00:00.0000001-05:00",
      ),
    ).toBe(1);
    expect(
      compareCpiSourceInstants(
        "2026-01-01T00:00:00.1Z",
        "2025-12-31T19:00:00.1000-05:00",
      ),
    ).toBe(0);
    expect(() =>
      compareCpiSourceInstants("bad", "2026-01-01T00:00:00Z"),
    ).toThrow("Invalid CPI source clock");
  });
  it.each([
    "http://www.bls.gov/news.release/archives/cpi_10142026.htm",
    "https://bls.gov/news.release/archives/cpi_10142026.htm",
    "https://www.bls.gov/news.release/cpi.htm",
    "https://www.bls.gov/news.release/archives/empsit_10142026.htm",
    "https://www.bls.gov/news.release/archives/cpi_02292026.htm",
    "https://www.bls.gov/news.release/archives/cpi_10142026.htm?q=1",
    "https://www.bls.gov/news.release/archives/cpi_10142026.htm#x",
    "https://www.bls.gov:443/news.release/archives/cpi_10142026.htm",
    "https://x@www.bls.gov/news.release/archives/cpi_10142026.htm",
    "https://www.bls.gov/news.release/archives/cpi_%31%30%31%34%32%30%32%36.htm",
  ])("refuses noncanonical CPI URL %s", (url) =>
    expect(isCpiHeadlineUrl(url)).toBe(false),
  );
  it("admits valid leap-day archive dates independently of source clocks", () =>
    expect(
      isCpiHeadlineUrl(
        "https://www.bls.gov/news.release/archives/cpi_02292024.htm",
      ),
    ).toBe(true));
});
describe("complete CPI headline packet admission", () => {
  it("detaches and deeply freezes raw source metadata without inventing relationships", () => {
    const input = packet(),
      expected = structuredClone(input),
      result = parseManagedCpiHeadlines(input)!;
    expect(result).toEqual(expected);
    expect(result).not.toBe(input);
    expect(result.items).not.toBe(input.items);
    expect(result.items[0]).not.toBe(input.items[0]);
    for (const value of [result, result.source, result.items, ...result.items])
      expect(Object.isFrozen(value)).toBe(true);
    input.items[0]!.title = "Changed";
    input.items.pop();
    input.source.topic = "Changed" as typeof input.source.topic;
    expect(result).toEqual(expected);
    expect(
      parseManagedCpiHeadlines({ ...expected, feedUpdatedAt: null }),
    ).not.toBeNull();
    expect(
      parseManagedCpiHeadlines({
        ...expected,
        fetchedAt: "2001-01-01T00:00:00.000Z",
      }),
    ).not.toBeNull();
  });
  it.each([
    (p: ReturnType<typeof packet>) => ({ ...p, extra: 1 }),
    (p: ReturnType<typeof packet>) => ({ ...p, schemaVersion: "2" }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      source: { ...p.source, topic: "Employment" },
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      feedUpdatedAt: "2026-02-30T00:00:00Z",
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      fetchedAt: "2026-10-28T19:00:00Z",
    }),
    (p: ReturnType<typeof packet>) => ({ ...p, availableItemCount: 129 }),
    (p: ReturnType<typeof packet>) => ({ ...p, availableItemCount: 1 }),
    (p: ReturnType<typeof packet>) => ({ ...p, items: [...p.items].reverse() }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      items: [p.items[0], p.items[0]],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      items: [{ ...p.items[0], sourceId: "x".repeat(129) }, p.items[1]],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      items: [{ ...p.items[0], title: "x".repeat(257) }, p.items[1]],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      items: [{ ...p.items[0], title: "bad\u202e" }, p.items[1]],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      items: [{ ...p.items[0], updatedAt: undefined }, p.items[1]],
    }),
    (p: ReturnType<typeof packet>) => ({
      ...p,
      items: [{ ...p.items[0], description: "not admitted" }, p.items[1]],
    }),
  ])("refuses the entire invalid packet %#", (change) =>
    expect(parseManagedCpiHeadlines(change(packet()))).toBeNull(),
  );
  it("admits checked-empty and exact ten-of-128 bounded items", () => {
    expect(
      parseManagedCpiHeadlines({
        ...packet(),
        availableItemCount: 0,
        items: [],
      })?.items,
    ).toEqual([]);
    const p = packet();
    p.availableItemCount = 128;
    p.items = Array.from({ length: 10 }, (_, i) => ({
      ...p.items[0]!,
      sourceId: `invented-${i}`,
      title: "界".repeat(256),
      url: `https://www.bls.gov/news.release/archives/cpi_10${String(i + 1).padStart(2, "0")}2026.htm`,
    }));
    const parsed = parseManagedCpiHeadlines(p)!;
    expect(parsed).not.toBeNull();
    expect(
      new TextEncoder().encode(JSON.stringify(parsed)).byteLength,
    ).toBeLessThan(MANAGED_CPI_HEADLINES_LIMITS.responseBytes);
    p.items.push({ ...p.items[0]!, sourceId: "eleventh" });
    expect(parseManagedCpiHeadlines(p)).toBeNull();
  });
  it("refuses getters and sparse or decorated arrays without running caller getters", () => {
    const p = packet(),
      getter = vi.fn();
    Object.defineProperty(p.items[0], "title", {
      get: getter,
      enumerable: true,
    });
    expect(parseManagedCpiHeadlines(p)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    const sparse = packet();
    Reflect.deleteProperty(sparse.items, 0);
    expect(parseManagedCpiHeadlines(sparse)).toBeNull();
    const decorated = packet();
    Object.assign(decorated.items, { extra: true });
    expect(parseManagedCpiHeadlines(decorated)).toBeNull();
    expect(
      parseManagedCpiHeadlines(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error("private");
            },
          },
        ),
      ),
    ).toBeNull();
  });
  it("uses descriptor snapshots without executing Proxy gets and sanitizes item traps", () => {
    const p = packet(),
      get = vi.fn(() => {
        throw new Error("get must not run");
      });
    p.items[0] = new Proxy(p.items[0]!, { get });
    p.items = new Proxy(p.items, { get });
    p.source = new Proxy(p.source, { get });
    expect(parseManagedCpiHeadlines(new Proxy(p, { get }))).toEqual(packet());
    expect(get).not.toHaveBeenCalled();
    const trapped = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("private");
        },
      },
    );
    expect(parseManagedCpiHeadline(trapped)).toBeNull();
  });
});
