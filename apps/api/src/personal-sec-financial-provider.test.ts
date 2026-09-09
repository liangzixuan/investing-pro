import { PERSONAL_SEC_ANNUAL_CONCEPTS } from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSecPersonalFinancialProvider,
  PERSONAL_SEC_USER_AGENT,
} from "./personal-sec-financial-provider";

const NOW = new Date("2026-09-09T18:00:00.000Z");
const USER_AGENT = "PersonalResearch/1.0 owner@example.test";

function fact(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    cik: 42,
    accn: "0000000042-26-000001",
    start: "2025-01-01",
    end: "2025-12-31",
    val: 1200000,
    entityName: "Synthetic issuer",
    loc: "US-TX",
    ...overrides,
  };
}

function payload(
  url: string,
  data: readonly unknown[] = [fact()],
): Record<string, unknown> {
  const path = new URL(url).pathname.split("/");
  return {
    taxonomy: "us-gaap",
    tag: path[5],
    ccp: path[7]?.replace(".json", ""),
    uom: "USD",
    label: "Synthetic annual fact",
    description: "Synthetic fixture only",
    pts: data.length,
    data,
  };
}

function mockedFetch(
  transform?: (url: string, index: number) => Response,
): ReturnType<typeof vi.fn<typeof fetch>> {
  let index = 0;
  return vi.fn<typeof fetch>((input) => {
    const url = requestUrl(input);
    return Promise.resolve(
      transform?.(url, index++) ?? Response.json(payload(url)),
    );
  });
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

async function finish<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("SEC annual financial provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires a declared contact user agent and does no constructor/status network work", async () => {
    expect(PERSONAL_SEC_USER_AGENT).toBe("PERSONAL_SEC_USER_AGENT");
    const fetch = mockedFetch();
    for (const userAgent of [
      undefined,
      "",
      "Mozilla/5.0",
      "Agent owner@example.test\r\nSecret: exposed",
      `App ${"x".repeat(260)}@example.test`,
    ]) {
      const provider = createSecPersonalFinancialProvider(userAgent, { fetch });
      expect(provider.status()).toEqual({ configured: false });
      await expect(provider.loadSnapshot(2025)).rejects.toMatchObject({
        code: "not_configured",
        message: "Personal financial screening data is unavailable.",
      });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).status(),
    ).toEqual({ configured: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads only six fixed USD annual routes, preserves facts, and spaces requests below five per second", async () => {
    const starts: number[] = [];
    const fetch = mockedFetch((url) => {
      starts.push(Date.now());
      return Response.json(
        payload(url, [fact({ val: "-120.250000" }), fact({ cik: 7, val: 0 })]),
      );
    });
    const provider = createSecPersonalFinancialProvider(USER_AGENT, {
      fetch,
      now: () => NOW,
    });
    const snapshot = await finish(provider.loadSnapshot(2025));
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(snapshot.frames.map((frame) => frame.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_CONCEPTS,
    );
    for (const [index, [url, init]] of fetch.mock.calls.entries()) {
      expect(url).toBe(
        `https://data.sec.gov/api/xbrl/frames/us-gaap/${PERSONAL_SEC_ANNUAL_CONCEPTS[index]}/USD/CY2025.json`,
      );
      expect(init).toMatchObject({
        method: "GET",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      if (index > 0)
        expect(starts[index]! - starts[index - 1]!).toBeGreaterThanOrEqual(200);
    }
    expect(snapshot.frames[0]?.facts).toEqual([
      {
        cik: "0000000007",
        accessionNumber: "0000000042-26-000001",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        value: "0",
      },
      {
        cik: "0000000042",
        accessionNumber: "0000000042-26-000001",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        value: "-120.25",
      },
    ]);
    expect(snapshot).toMatchObject({
      calendarYear: 2025,
      fetchedAt: NOW.toISOString(),
      expiresAt: "2026-09-09T18:30:00.000Z",
    });
    expect(snapshot.snapshotSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(Object.isFrozen(snapshot.frames[0]?.facts[0])).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(USER_AGENT);
  });

  it("keeps actual annual dates across calendar boundaries and quarantines invalid or quarterly dates", async () => {
    const fetch = mockedFetch((url) =>
      Response.json(
        payload(url, [
          fact({ cik: 1, start: "2025-02-01", end: "2026-01-31" }),
          fact({ cik: 2, start: "2025-02-30" }),
          fact({ cik: 3, start: "2025-10-01" }),
          fact({ cik: 4, start: "2022-01-01", end: "2022-12-31" }),
          fact({ cik: 5, accn: "untrusted-provider-value" }),
        ]),
      ),
    );
    const snapshot = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(snapshot.frames[0]?.facts).toHaveLength(1);
    expect(snapshot.frames[0]?.facts[0]).toMatchObject({
      cik: "0000000001",
      startDate: "2025-02-01",
      endDate: "2026-01-31",
    });
    expect(snapshot.frames[0]?.unknownCiks).toEqual([
      "0000000002",
      "0000000003",
      "0000000004",
      "0000000005",
    ]);
  });

  it("makes both duplicate and conflicting issuer facts unknown independently of input order", async () => {
    const rows = [
      fact({ cik: 1 }),
      fact({ cik: 1 }),
      fact({ cik: 2 }),
      fact({ cik: 2, val: 3 }),
      fact({ cik: 3 }),
    ];
    const first = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, {
        fetch: mockedFetch((url) => Response.json(payload(url, rows))),
      }).loadSnapshot(2025),
    );
    const second = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, {
        fetch: mockedFetch((url) =>
          Response.json(payload(url, [...rows].reverse())),
        ),
      }).loadSnapshot(2025),
    );
    expect(first.frames[0]?.unknownCiks).toEqual(["0000000001", "0000000002"]);
    expect(first.frames[0]?.facts.map((row) => row.cik)).toEqual([
      "0000000003",
    ]);
    expect(first.snapshotSha256).toBe(second.snapshotSha256);
  });

  it("preserves JSON number precision before validation and rejects unsafe or unsupported decimals", async () => {
    const rows = [
      fact({ cik: 1, val: "RAW_UNSAFE" }),
      fact({ cik: 2, val: "9007199254740993" }),
      fact({ cik: 3, val: "9007199254740991" }),
      fact({ cik: 4, val: "0.0000001" }),
      fact({ cik: 5, val: true }),
      fact({ cik: 6, val: null }),
      fact({ cik: 7, val: "12.500000" }),
      fact({ cik: 8, val: "1e999" }),
      fact({ cik: 9, val: "900719925474099.11" }),
      fact({ cik: 10, val: 1.25 }),
    ];
    const fetch = mockedFetch(
      (url) =>
        new Response(
          JSON.stringify(payload(url, rows)).replace(
            '"RAW_UNSAFE"',
            "9007199254740993",
          ),
        ),
    );
    const snapshot = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(
      snapshot.frames[0]?.facts.map((row) => [row.cik, row.value]),
    ).toEqual([
      ["0000000003", "9007199254740991"],
      ["0000000007", "12.5"],
      ["0000000010", "1.25"],
    ]);
    expect(snapshot.frames[0]?.unknownCiks).toHaveLength(7);
  });

  it("retains independent frame failures without treating missing source data as zero", async () => {
    const fetch = mockedFetch((url, index) => {
      if (index === 0)
        return new Response("private provider message", { status: 429 });
      if (index === 1)
        return new Response("private provider message", { status: 404 });
      if (index === 2)
        return new Response("private provider message", { status: 503 });
      if (index === 3) return new Response("not JSON with secret content");
      return Response.json(payload(url));
    });
    const snapshot = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(snapshot.frames.map((frame) => frame.status)).toEqual([
      "rate_limited",
      "not_covered",
      "upstream_unavailable",
      "invalid_response",
      "available",
      "available",
    ]);
    expect(
      snapshot.frames
        .slice(0, 4)
        .every(
          (frame) => frame.facts.length === 0 && frame.unknownCiks.length === 0,
        ),
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private provider|secret content/u,
    );
    const failed = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, {
        fetch: mockedFetch(() => {
          throw new Error("private-transport-canary");
        }),
      }).loadSnapshot(2025),
    );
    expect(
      failed.frames.every((frame) => frame.status === "upstream_unavailable"),
    ).toBe(true);
    expect(JSON.stringify(failed)).not.toContain("private-transport-canary");
  });

  it("rejects mismatched frame identities, counts, unsafe CIKs, and oversized row arrays", async () => {
    const fetch = mockedFetch((url, index) => {
      const overrides = [
        { taxonomy: "ifrs-full" },
        { tag: "Assets" },
        { uom: "EUR" },
        { ccp: "CY2024" },
        { pts: 2 },
        { data: [fact({ cik: "unknown-secret" })] },
      ][index];
      return Response.json({ ...payload(url), ...overrides });
    });
    const invalid = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(
      invalid.frames.every((frame) => frame.status === "invalid_response"),
    ).toBe(true);
    const capped = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, {
        fetch: mockedFetch((url, index) =>
          Response.json(
            payload(
              url,
              index === 0
                ? Array.from({ length: 50_001 }, () => ({}))
                : [fact()],
            ),
          ),
        ),
      }).loadSnapshot(2025),
    );
    expect(capped.frames[0]?.status).toBe("invalid_response");
    expect(capped.frames[1]?.status).toBe("available");
  });

  it("caps both declared and streamed response bytes and rejects invalid UTF-8", async () => {
    const fetch = mockedFetch((url, index) => {
      if (index === 0)
        return new Response("{}", {
          headers: { "content-length": String(8 * 1024 * 1024 + 1) },
        });
      if (index === 1) return new Response(new Uint8Array(8 * 1024 * 1024 + 1));
      if (index === 2) return new Response(new Uint8Array([0xc3, 0x28]));
      if (index === 3)
        return new Response("{}", { headers: { "content-length": "NaN" } });
      return Response.json(payload(url));
    });
    const snapshot = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(
      snapshot.frames
        .slice(0, 4)
        .every((frame) => frame.status === "invalid_response"),
    ).toBe(true);
    expect(snapshot.frames[4]?.status).toBe("available");
  });

  it("rejects redirect outcomes without issuing another URL", async () => {
    const fetch = mockedFetch((url, index) => {
      if (index === 0)
        return Response.redirect("https://untrusted.example.test/private");
      const response = Response.json(payload(url));
      if (index === 1)
        Object.defineProperty(response, "redirected", { value: true });
      if (index === 2)
        Object.defineProperty(response, "url", {
          value: "https://untrusted.example.test/private",
        });
      return response;
    });
    const snapshot = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(
      snapshot.frames
        .slice(0, 3)
        .every((frame) => frame.status !== "available"),
    ).toBe(true);
    expect(
      fetch.mock.calls.every(([url]) =>
        requestUrl(url).startsWith("https://data.sec.gov/api/xbrl/frames/"),
      ),
    ).toBe(true);
  });

  it("reuses one snapshot for thirty minutes, refreshes explicitly, and gives changed facts a changed digest", async () => {
    let now = NOW;
    let amount = 1;
    const fetch = mockedFetch((url) =>
      Response.json(payload(url, [fact({ val: amount })])),
    );
    const provider = createSecPersonalFinancialProvider(USER_AGENT, {
      fetch,
      now: () => now,
    });
    const first = await finish(provider.loadSnapshot(2025));
    expect(await provider.loadSnapshot(2025)).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(6);
    const refreshed = await finish(
      provider.loadSnapshot(2025, undefined, true),
    );
    expect(refreshed.snapshotSha256).toBe(first.snapshotSha256);
    expect(fetch).toHaveBeenCalledTimes(12);
    now = new Date("2026-09-09T18:30:00.000Z");
    amount = 2;
    const changed = await finish(provider.loadSnapshot(2025));
    expect(changed.snapshotSha256).not.toBe(first.snapshotSha256);
    expect(fetch).toHaveBeenCalledTimes(18);
    await finish(provider.loadSnapshot(2024));
    await finish(provider.loadSnapshot(2025));
    expect(fetch).toHaveBeenCalledTimes(30);
  });

  it("coalesces simultaneous same-year refreshes and bounds different-year concurrency", async () => {
    const fetch = mockedFetch();
    const provider = createSecPersonalFinancialProvider(USER_AGENT, { fetch });
    const first = provider.loadSnapshot(2025, undefined, true);
    const second = provider.loadSnapshot(2025, undefined, true);
    await expect(provider.loadSnapshot(2024)).rejects.toMatchObject({
      code: "busy",
    });
    const snapshots = await finish(Promise.all([first, second]));
    expect(snapshots[0]).toBe(snapshots[1]);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("rejects invalid years and refresh flags before requests", async () => {
    const fetch = mockedFetch();
    const provider = createSecPersonalFinancialProvider(USER_AGENT, { fetch });
    for (const year of [
      2008,
      2026,
      2025.5,
      NaN,
      Infinity,
      "2025",
    ] as number[]) {
      await expect(provider.loadSnapshot(year)).rejects.toMatchObject({
        code: "invalid_request",
      });
    }
    await expect(
      provider.loadSnapshot(2025, undefined, "true" as unknown as boolean),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not cancel a coalesced caller when the original caller disconnects", async () => {
    const fetch = mockedFetch();
    const provider = createSecPersonalFinancialProvider(USER_AGENT, { fetch });
    const controller = new AbortController();
    const first = provider.loadSnapshot(2025, controller.signal);
    const second = provider.loadSnapshot(2025);
    const disconnected = expect(first).rejects.toMatchObject({
      code: "aborted",
    });
    controller.abort();
    await disconnected;
    const snapshot = await finish(second);
    expect(snapshot.frames.every((frame) => frame.status === "available")).toBe(
      true,
    );
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(
      fetch.mock.calls.every(([, init]) => init?.signal?.aborted === false),
    ).toBe(true);
  });

  it("honors abort and close, cancels current fetches, and never caches partial aborted loads", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise<Response>(() => undefined),
    );
    const provider = createSecPersonalFinancialProvider(USER_AGENT, { fetch });
    const controller = new AbortController();
    const pending = provider.loadSnapshot(2025, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    controller.abort();
    await rejected;
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const second = provider.loadSnapshot(2025);
    const closed = expect(second).rejects.toMatchObject({ code: "aborted" });
    provider.close();
    await closed;
    expect(provider.status()).toEqual({ configured: false });
    await expect(provider.loadSnapshot(2025)).rejects.toMatchObject({
      code: "aborted",
    });
  });

  it("applies ten-second deadlines to a fetch or stalled body and retains other frames", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const concept = new URL(requestUrl(input)).pathname.split("/")[5];
      if (concept === PERSONAL_SEC_ANNUAL_CONCEPTS[0])
        return new Promise<Response>(() => undefined);
      if (concept === PERSONAL_SEC_ANNUAL_CONCEPTS[1])
        return new Response(new ReadableStream<Uint8Array>({ start() {} }));
      return Response.json(payload(requestUrl(input)));
    });
    const snapshot = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(
      snapshot.frames
        .slice(0, 2)
        .every((frame) => frame.status === "upstream_unavailable"),
    ).toBe(true);
    expect(
      snapshot.frames.slice(2).every((frame) => frame.status === "available"),
    ).toBe(true);
    expect(
      fetch.mock.calls.slice(0, 2).every(([, init]) => init?.signal?.aborted),
    ).toBe(true);
  });
});
