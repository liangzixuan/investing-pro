import {
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  PERSONAL_SEC_INSTANT_CONCEPTS,
  PERSONAL_SEC_REVENUE_CONCEPTS,
  PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS,
  PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS,
  type PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import { evaluatePersonalFinancialScreen } from "@research-cockpit/personal-financial-analytics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSecPersonalFinancialProvider as createProvider,
  PERSONAL_SEC_USER_AGENT,
} from "./personal-sec-financial-provider";
import { createPersonalSecRequestScheduler } from "./personal-sec-request-scheduler";

function createSecPersonalFinancialProvider(
  ...[userAgent, dependencies]: Parameters<typeof createProvider>
) {
  return createProvider(userAgent, {
    scheduler: createPersonalSecRequestScheduler({ now: () => Date.now() }),
    ...dependencies,
  });
}

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
  data: readonly unknown[] = url.endsWith("Q4I.json")
    ? [instantFact()]
    : [
        fact({
          start: `${url.match(/CY(\d{4})/u)?.[1]}-01-01`,
          end: `${url.match(/CY(\d{4})/u)?.[1]}-12-31`,
        }),
      ],
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

function instantFact(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    cik: 42,
    accn: "0000000042-26-000001",
    end: "2025-12-31",
    val: 1200000,
    ...overrides,
  };
}

const EXPECTED_URLS = [
  ...PERSONAL_SEC_ANNUAL_CONCEPTS.map(
    (concept) =>
      `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025.json`,
  ),
  ...PERSONAL_SEC_INSTANT_CONCEPTS.map(
    (concept) =>
      `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025Q4I.json`,
  ),
  ...PERSONAL_SEC_REVENUE_CONCEPTS.map(
    (concept) =>
      `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2024.json`,
  ),
];

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

  it("loads eight current annual, four Q4 instant and three prior revenue USD routes in order, with all fifteen requests paced", async () => {
    const starts: number[] = [];
    const fetch = mockedFetch((url) => {
      starts.push(Date.now());
      return Response.json(
        payload(
          url,
          url.endsWith("Q4I.json")
            ? [
                instantFact({ val: "-120.250000" }),
                instantFact({ cik: 7, val: 0 }),
              ]
            : [fact({ val: "-120.250000" }), fact({ cik: 7, val: 0 })],
        ),
      );
    });
    const provider = createSecPersonalFinancialProvider(USER_AGENT, {
      fetch,
      now: () => NOW,
    });
    const snapshot = await finish(provider.loadSnapshot(2025));
    expect(fetch).toHaveBeenCalledTimes(15);
    expect(snapshot.frames.map((frame) => frame.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_CONCEPTS,
    );
    expect(snapshot.frames.map((frame) => frame.concept)).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
      "OperatingIncomeLoss",
      "NetCashProvidedByUsedInOperatingActivities",
      "GrossProfit",
      "PaymentsToAcquirePropertyPlantAndEquipment",
    ]);
    for (const [index, [url, init]] of fetch.mock.calls.entries()) {
      expect(url).toBe(EXPECTED_URLS[index]);
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
        expect(starts[index]! - starts[index - 1]!).toBeGreaterThanOrEqual(220);
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
      priorCalendarYear: 2024,
      instantQuarter: 4,
      fetchedAt: NOW.toISOString(),
      expiresAt: "2026-09-09T18:30:00.000Z",
    });
    expect(snapshot.snapshotSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(snapshot.instantFrames.map((frame) => frame.concept)).toEqual(
      PERSONAL_SEC_INSTANT_CONCEPTS,
    );
    expect(snapshot.instantFrames.map((frame) => frame.concept)).toEqual([
      "AssetsCurrent",
      "LiabilitiesCurrent",
      "Assets",
      "Liabilities",
    ]);
    expect(
      snapshot.instantFrames.every((frame) => frame.status === "available"),
    ).toBe(true);
    expect(
      snapshot.instantFrames.every((frame) => frame.facts.length === 2),
    ).toBe(true);
    expect(snapshot.priorRevenueFrames.map((frame) => frame.concept)).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ]);
    expect(Object.isFrozen(snapshot.priorRevenueFrames)).toBe(true);
    expect(Object.isFrozen(snapshot.priorRevenueFrames[0]?.facts[0])).toBe(
      true,
    );
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

  it("retains actual instant dates and signed precision without inventing annual durations", async () => {
    const rows = [
      instantFact({ cik: 1, end: "2025-10-01", val: "-2.000001" }),
      instantFact({ cik: 2, end: "2025-12-31", val: "-0.000000" }),
      instantFact({ cik: 3, end: "2026-01-31" }),
      instantFact({ cik: 4, end: "2025-09-30" }),
      instantFact({ cik: 5, end: "2024-12-31" }),
      instantFact({ cik: 6, end: "2027-01-01" }),
      instantFact({ cik: 7, end: "2025-02-30" }),
      instantFact({ cik: 8, start: "2025-01-01" }),
      instantFact({ cik: 9, start: null }),
      instantFact({ cik: 10, val: "9007199254740993" }),
      instantFact({ cik: 11, val: "0.0000001" }),
      instantFact({ cik: 12, accn: "invalid-accession" }),
      instantFact({ cik: 13 }),
      instantFact({ cik: 13 }),
      instantFact({ cik: 14 }),
      instantFact({ cik: 14, val: 1 }),
    ];
    const load = async (data: readonly unknown[]) =>
      finish(
        createSecPersonalFinancialProvider(USER_AGENT, {
          fetch: mockedFetch((url) =>
            Response.json(
              url.endsWith("Q4I.json") ? payload(url, data) : payload(url),
            ),
          ),
        }).loadSnapshot(2025),
      );
    const first = await load(rows),
      reversed = await load([...rows].reverse());
    expect(first.instantFrames).toEqual(reversed.instantFrames);
    for (const frame of first.instantFrames) {
      expect(
        frame.facts.map((row) => [row.cik, row.asOfDate, row.value]),
      ).toEqual([
        ["0000000001", "2025-10-01", "-2.000001"],
        ["0000000002", "2025-12-31", "0"],
        ["0000000003", "2026-01-31", "1200000"],
        ["0000000004", "2025-09-30", "1200000"],
        ["0000000005", "2024-12-31", "1200000"],
      ]);
      expect(frame.unknownCiks).toEqual(
        Array.from({ length: 9 }, (_, index) =>
          String(index + 6).padStart(10, "0"),
        ),
      );
      expect(Object.keys(frame.facts[0]!)).toEqual([
        "cik",
        "accessionNumber",
        "asOfDate",
        "value",
      ]);
      expect(Object.isFrozen(frame.facts[0])).toBe(true);
    }
    expect(Object.isFrozen(first.instantFrames)).toBe(true);
  });

  it.each(
    PERSONAL_SEC_INSTANT_CONCEPTS.flatMap((concept) => [
      { concept, overrides: { taxonomy: "ifrs-full" } },
      {
        concept,
        overrides: { tag: concept === "Assets" ? "AssetsCurrent" : "Assets" },
      },
      { concept, overrides: { uom: "shares" } },
      { concept, overrides: { uom: "EUR" } },
      { concept, overrides: { ccp: "CY2025" } },
      { concept, overrides: { ccp: "CY2025Q3I" } },
      { concept, overrides: { ccp: "CY2026Q4I" } },
      { concept, overrides: { pts: 2 } },
      { concept, overrides: { data: [{ cik: "invalid" }] } },
    ]),
  )(
    "rejects incorrect $concept instant frame metadata $overrides without changing other frames",
    async ({ concept, overrides }) => {
      const result = await finish(
        createSecPersonalFinancialProvider(USER_AGENT, {
          fetch: mockedFetch((url) =>
            Response.json(
              url.includes(`/${concept}/`)
                ? { ...payload(url), ...overrides }
                : payload(url),
            ),
          ),
        }).loadSnapshot(2025),
      );
      expect(
        result.instantFrames.find((frame) => frame.concept === concept),
      ).toMatchObject({
        status: "invalid_response",
        facts: [],
        unknownCiks: [],
      });
      expect(
        result.instantFrames
          .filter((frame) => frame.concept !== concept)
          .every((frame) => frame.status === "available"),
      ).toBe(true);
      expect(result.frames.every((frame) => frame.status === "available")).toBe(
        true,
      );
    },
  );

  it.each([
    { status: 404, outcome: "not_covered" },
    { status: 429, outcome: "rate_limited" },
    { status: 503, outcome: "upstream_unavailable" },
    { status: 200, outcome: "invalid_response" },
  ])(
    "isolates instant source $outcome and caches the complete fifteen-frame result",
    async ({ status, outcome }) => {
      const fetch = mockedFetch((url) =>
        url.endsWith("Q4I.json")
          ? new Response("unretained-instant-body", { status })
          : Response.json(payload(url)),
      );
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const snapshot = await finish(provider.loadSnapshot(2025));
      expect(
        snapshot.frames.every((frame) => frame.status === "available"),
      ).toBe(true);
      expect(
        snapshot.instantFrames.every(
          (frame) =>
            frame.status === outcome &&
            frame.facts.length === 0 &&
            frame.unknownCiks.length === 0,
        ),
      ).toBe(true);
      expect(await provider.loadSnapshot(2025)).toBe(snapshot);
      expect(fetch).toHaveBeenCalledTimes(15);
      expect(JSON.stringify(snapshot)).not.toContain("unretained-instant-body");
    },
  );

  it.each(PERSONAL_SEC_INSTANT_CONCEPTS)(
    "binds %s instant amount, actual date, accession and failure into one cached digest",
    async (concept) => {
      let value = "1.25",
        end = "2025-12-31",
        accession = "0000000042-26-000001",
        failed = false;
      const fetch = mockedFetch((url) =>
        !url.includes(`/${concept}/`)
          ? Response.json(payload(url))
          : failed
            ? new Response(null, { status: 503 })
            : Response.json(
                payload(url, [
                  instantFact({ val: value, end, accn: accession }),
                ]),
              ),
      );
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const first = await finish(provider.loadSnapshot(2025));
      const same = await finish(provider.loadSnapshot(2025, undefined, true));
      expect(same.snapshotSha256).toBe(first.snapshotSha256);
      const hashes = new Set([first.snapshotSha256]);
      for (const mutate of [
        () => {
          value = "-2.000001";
        },
        () => {
          end = "2026-01-31";
        },
        () => {
          accession = "0000000042-26-000099";
        },
        () => {
          failed = true;
        },
      ]) {
        mutate();
        const next = await finish(provider.loadSnapshot(2025, undefined, true));
        expect(hashes.has(next.snapshotSha256)).toBe(false);
        hashes.add(next.snapshotSha256);
        expect(next.frames).toEqual(first.frames);
        expect(
          next.instantFrames.filter((frame) => frame.concept !== concept),
        ).toEqual(
          first.instantFrames.filter((frame) => frame.concept !== concept),
        );
        expect(await provider.loadSnapshot(2025)).toBe(next);
      }
      expect(fetch).toHaveBeenCalledTimes(90);
      expect(hashes.size).toBe(5);
    },
  );

  it.each(["Assets", "Liabilities"] as const)(
    "admits %s raw numeric lexemes without rounding or borrowing current balances",
    async (concept) => {
      const lexemes = [
        "-2.000001",
        "0",
        "9007199254740991",
        "123456789.123456",
        "9007199254740993",
        "0.0000001",
        "1e3",
      ];
      const fetch = mockedFetch((url) => {
        if (!url.includes(`/${concept}/`)) return Response.json(payload(url));
        const data = lexemes.map((val, index) =>
          instantFact({ cik: index + 1, val }),
        );
        const text = JSON.stringify(payload(url, data)).replace(
          /"val":"([^" ]+)"/gu,
          '"val":$1',
        );
        return new Response(text, {
          headers: { "content-type": "application/json" },
        });
      });
      const result = await finish(
        createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
          2025,
        ),
      );
      expect(
        result.instantFrames.find((frame) => frame.concept === concept),
      ).toMatchObject({
        status: "available",
        sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025Q4I.json`,
        facts: [
          { cik: "0000000001", value: "-2.000001", asOfDate: "2025-12-31" },
          { cik: "0000000002", value: "0" },
          { cik: "0000000003", value: "9007199254740991" },
          { cik: "0000000004", value: "123456789.123456" },
        ],
        unknownCiks: ["0000000005", "0000000006", "0000000007"],
      });
      expect(
        result.instantFrames
          .filter((frame) => frame.concept !== concept)
          .every((frame) => frame.facts[0]?.value === "1200000"),
      ).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(15);
    },
  );

  it.each(
    (["Assets", "Liabilities"] as const).flatMap((concept) => [
      { concept, status: 404, outcome: "not_covered" },
      { concept, status: 429, outcome: "rate_limited" },
      { concept, status: 503, outcome: "upstream_unavailable" },
      { concept, status: 200, outcome: "invalid_response" },
    ]),
  )(
    "isolates $concept $outcome while caching the other total and existing fields",
    async ({ concept, status, outcome }) => {
      const fetch = mockedFetch((url) =>
        url.includes(`/${concept}/`)
          ? new Response("unretained-total-body", { status })
          : Response.json(payload(url)),
      );
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const result = await finish(provider.loadSnapshot(2025));
      expect(
        result.instantFrames.find((frame) => frame.concept === concept),
      ).toMatchObject({ status: outcome, facts: [], unknownCiks: [] });
      expect(
        result.instantFrames
          .filter((frame) => frame.concept !== concept)
          .every((frame) => frame.status === "available"),
      ).toBe(true);
      expect(result.frames.every((frame) => frame.status === "available")).toBe(
        true,
      );
      expect(await provider.loadSnapshot(2025)).toBe(result);
      expect(fetch).toHaveBeenCalledTimes(15);
      expect(JSON.stringify(result)).not.toContain("unretained-total-body");
    },
  );

  it.each(PERSONAL_SEC_INSTANT_CONCEPTS)(
    "aborts during %s acquisition without caching a partial snapshot",
    async (concept) => {
      let stall = true;
      const fetch = vi.fn<typeof globalThis.fetch>((input) => {
        const url = requestUrl(input);
        return stall && url.includes(`/${concept}/`)
          ? new Promise<Response>(() => undefined)
          : Promise.resolve(Response.json(payload(url)));
      });
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const controller = new AbortController();
      const pending = provider.loadSnapshot(2025, controller.signal);
      const rejected = expect(pending).rejects.toMatchObject({
        code: "aborted",
      });
      const instantIndex =
        PERSONAL_SEC_ANNUAL_CONCEPTS.length +
        PERSONAL_SEC_INSTANT_CONCEPTS.indexOf(concept);
      await vi.advanceTimersByTimeAsync(instantIndex * 220 + 100);
      expect(fetch).toHaveBeenCalledTimes(instantIndex + 1);
      controller.abort();
      await rejected;
      expect(fetch.mock.calls[instantIndex]?.[1]?.signal?.aborted).toBe(true);
      stall = false;
      const recovered = await finish(provider.loadSnapshot(2025));
      expect(recovered.frames).toHaveLength(8);
      expect(
        recovered.instantFrames.every((frame) => frame.status === "available"),
      ).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(instantIndex + 1 + 15);
    },
  );

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

  it("applies annual-duration and exact-value eligibility to GrossProfit without borrowing another frame", async () => {
    const fetch = mockedFetch((url) =>
      Response.json(
        payload(
          url,
          url.includes("/GrossProfit/")
            ? [
                fact({ cik: 1, end: "2025-12-01", val: "-50.125000" }), // 335 days.
                fact({ cik: 2, end: "2026-01-30", val: "0" }), // 395 days.
                fact({ cik: 3, end: "2025-11-30" }), // 334 days.
                fact({ cik: 4, end: "2026-01-31" }), // 396 days.
                fact({ cik: 5, start: undefined }),
                fact({ cik: 6, start: "2025-10-01" }),
                fact({ cik: 7, val: "NaN" }),
                fact({ cik: 8 }),
                fact({ cik: 8 }),
                fact({ cik: 9 }),
                fact({ cik: 9, val: 3 }),
                fact({ cik: 10, val: "100.250000" }),
              ]
            : [fact({ cik: 3, val: 999 })],
        ),
      ),
    );
    const result = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    const gross = result.frames.find(
      (frame) => frame.concept === "GrossProfit",
    )!;
    expect(gross.status).toBe("available");
    expect(
      gross.facts.map((row) => [
        row.cik,
        row.value,
        row.startDate,
        row.endDate,
      ]),
    ).toEqual([
      ["0000000001", "-50.125", "2025-01-01", "2025-12-01"],
      ["0000000002", "0", "2025-01-01", "2026-01-30"],
      ["0000000010", "100.25", "2025-01-01", "2025-12-31"],
    ]);
    expect(gross.unknownCiks).toEqual([
      "0000000003",
      "0000000004",
      "0000000005",
      "0000000006",
      "0000000007",
      "0000000008",
      "0000000009",
    ]);
    expect(result.frames[0]?.facts[0]).toMatchObject({
      cik: "0000000003",
      value: "999",
    });
    expect(fetch).toHaveBeenCalledTimes(15);
  });

  it.each([
    { status: 404, outcome: "not_covered" },
    { status: 429, outcome: "rate_limited" },
    { status: 503, outcome: "upstream_unavailable" },
    { status: 200, outcome: "invalid_response" },
  ])(
    "retains GrossProfit $outcome independently and caches the complete fifteen-frame outcome",
    async ({ status, outcome }) => {
      const fetch = mockedFetch((url) =>
        url.includes("/GrossProfit/")
          ? new Response("private-provider-canary", { status })
          : Response.json(payload(url)),
      );
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const first = await finish(provider.loadSnapshot(2025));
      expect(
        first.frames
          .filter((frame) => frame.concept !== "GrossProfit")
          .every((frame) => frame.status === "available"),
      ).toBe(true);
      expect(first.frames[6]).toMatchObject({
        concept: "GrossProfit",
        status: outcome,
        facts: [],
        unknownCiks: [],
      });
      expect(JSON.stringify(first)).not.toContain("private-provider-canary");
      expect(await provider.loadSnapshot(2025)).toBe(first);
      expect(fetch).toHaveBeenCalledTimes(15);
    },
  );

  it.each([false, true])(
    "preserves PP&E purchases' exact signed amounts and annual provenance while quarantining ineligible or duplicate facts (reversed=%s)",
    async (reversed) => {
      const rows = [
        fact({
          cik: 1,
          val: "25.000001",
          start: "2025-02-01",
          end: "2026-01-31",
          accn: "0000000001-26-000099",
        }),
        fact({ cik: 2, val: "-2.000001" }),
        fact({ cik: 3, val: "-0.000000" }),
        fact({ cik: 4, val: "100.2500000" }),
        fact({ cik: 5, val: 100 }),
        fact({ cik: 5, val: 100 }),
        fact({ cik: 6, val: 100 }),
        fact({ cik: 6, val: 101 }),
        fact({ cik: 7, start: "2025-10-01" }),
        fact({ cik: 8, start: undefined }),
        fact({ cik: 9, accn: "untrusted-accession" }),
        fact({ cik: 10, val: "RAW_UNSAFE" }),
        fact({ cik: 11, val: "9007199254740993" }),
        fact({ cik: 12, end: "2025-12-01", val: 0 }), // 335 days.
        fact({ cik: 13, end: "2026-01-30", val: "1.25" }), // 395 days.
        fact({ cik: 14, end: "2025-11-30" }), // 334 days.
        fact({ cik: 15, end: "2026-01-31" }), // 396 days.
        fact({ cik: 16, val: "NaN" }),
        fact({ cik: 17, val: "0.0000001" }),
        fact({ cik: 18, val: true }),
        fact({ cik: 19, val: "900719925474099.11" }),
      ];
      const fetch = mockedFetch(
        (url) =>
          new Response(
            JSON.stringify(
              payload(
                url,
                url.includes("/PaymentsToAcquirePropertyPlantAndEquipment/")
                  ? reversed
                    ? [...rows].reverse()
                    : rows
                  : [fact({ cik: 7, val: 999 })],
              ),
            ).replace('"RAW_UNSAFE"', "9007199254740993"),
          ),
      );
      const result = await finish(
        createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
          2025,
        ),
      );
      const ppe = result.frames[7]!;
      expect(ppe).toMatchObject({
        concept: "PaymentsToAcquirePropertyPlantAndEquipment",
        status: "available",
        sourceUrl:
          "https://data.sec.gov/api/xbrl/frames/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment/USD/CY2025.json",
      });
      expect(ppe.facts.map((row) => [row.cik, row.value])).toEqual([
        ["0000000001", "25.000001"],
        ["0000000002", "-2.000001"],
        ["0000000003", "0"],
        ["0000000012", "0"],
        ["0000000013", "1.25"],
      ]);
      expect(ppe.facts[0]).toEqual({
        cik: "0000000001",
        accessionNumber: "0000000001-26-000099",
        startDate: "2025-02-01",
        endDate: "2026-01-31",
        value: "25.000001",
      });
      expect(ppe.unknownCiks).toEqual(
        [4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19].map((cik) =>
          String(cik).padStart(10, "0"),
        ),
      );
      expect(
        result.frames
          .slice(0, 7)
          .every(
            (frame) =>
              frame.status === "available" &&
              frame.facts.length === 1 &&
              frame.facts[0]?.cik === "0000000007" &&
              frame.facts[0]?.value === "999",
          ),
      ).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(15);
    },
  );

  it.each([
    { taxonomy: "ifrs-full" },
    { tag: "PaymentsToAcquireProductiveAssets" },
    { uom: "EUR" },
    { ccp: "CY2025Q4" },
    { pts: 2 },
    { data: [fact({ cik: "untrusted-cik" })] },
  ])("rejects a malformed PP&E frame independently: %j", async (overrides) => {
    const fetch = mockedFetch((url) =>
      Response.json({
        ...payload(url),
        ...(url.includes("/PaymentsToAcquirePropertyPlantAndEquipment/")
          ? overrides
          : {}),
      }),
    );
    const result = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(result.frames[7]).toMatchObject({
      concept: "PaymentsToAcquirePropertyPlantAndEquipment",
      status: "invalid_response",
      facts: [],
      unknownCiks: [],
    });
    expect(
      result.frames.slice(0, 7).every((frame) => frame.status === "available"),
    ).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(15);
  });

  it.each(
    [
      "NetCashProvidedByUsedInOperatingActivities",
      "PaymentsToAcquirePropertyPlantAndEquipment",
    ].flatMap((concept) =>
      [
        { status: 404, outcome: "not_covered" },
        { status: 429, outcome: "rate_limited" },
        { status: 503, outcome: "upstream_unavailable" },
        { status: 200, outcome: "invalid_response" },
      ].map((failure) => ({ concept, ...failure })),
    ),
  )(
    "isolates $concept $outcome from the other subtraction input and existing frames, then caches the outcome",
    async ({ concept, status, outcome }) => {
      const fetch = mockedFetch((url) =>
        url.includes(`/${concept}/`)
          ? new Response("private-ppe-provider-canary", { status })
          : Response.json(payload(url)),
      );
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const result = await finish(provider.loadSnapshot(2025));
      expect(
        result.frames.find((frame) => frame.concept === concept),
      ).toMatchObject({
        status: outcome,
        facts: [],
        unknownCiks: [],
      });
      expect(
        result.frames.filter((frame) => frame.concept !== concept),
      ).toHaveLength(7);
      expect(
        result.frames
          .filter((frame) => frame.concept !== concept)
          .every(
            (frame) =>
              frame.status === "available" &&
              frame.facts[0]?.value === "1200000",
          ),
      ).toBe(true);
      expect(JSON.stringify(result)).not.toContain(
        "private-ppe-provider-canary",
      );
      expect(await provider.loadSnapshot(2025)).toBe(result);
      expect(fetch).toHaveBeenCalledTimes(15);
    },
  );

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
        { tag: "NetIncomeLoss" },
        { tag: "PaymentsToAcquireProductiveAssets" },
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
                : [
                    fact({
                      start: `${url.match(/CY(\d{4})/u)?.[1]}-01-01`,
                      end: `${url.match(/CY(\d{4})/u)?.[1]}-12-31`,
                    }),
                  ],
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

  it("reuses all fifteen current and prior frames for thirty minutes, refreshes explicitly, and includes GrossProfit-only changes in the digest", async () => {
    let now = NOW;
    let amount = 1;
    const fetch = mockedFetch((url) =>
      Response.json(
        payload(url, [
          fact({ val: url.includes("/GrossProfit/") ? amount : 1 }),
        ]),
      ),
    );
    const provider = createSecPersonalFinancialProvider(USER_AGENT, {
      fetch,
      now: () => now,
    });
    const first = await finish(provider.loadSnapshot(2025));
    expect(await provider.loadSnapshot(2025)).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(15);
    expect(fetch.mock.calls.map(([url]) => requestUrl(url))).toEqual(
      EXPECTED_URLS,
    );
    const listing: PersonalSecurityMasterScreenRowDto = {
      cik: "0000000042",
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "issuer-42",
      issuerName: "Synthetic issuer",
      listingId: "listing-42",
      securityId: "security-42",
      securityName: "Synthetic common stock",
      shareClassId: "share-class-42",
      shareClassName: "Common Stock",
      symbol: "SYNTH",
    };
    for (const revenueBasis of PERSONAL_FINANCIAL_REVENUE_BASES) {
      const cached = await provider.loadSnapshot(2025);
      expect(cached).toBe(first);
      const result = evaluatePersonalFinancialScreen(
        [listing],
        cached,
        {
          calendarYear: 2025,
          revenueBasis,
          identityText: "",
          clauses: [
            { field: "grossMargin", operator: "gte", value: "100" },
            {
              field: "operatingCashFlowToNetIncome",
              operator: "gte",
              value: "100",
            },
          ],
          sort: { field: "operatingCashFlowToNetIncome", direction: "desc" },
        },
        { offset: 0, limit: 250 },
        `sha256:${"a".repeat(64)}`,
      );
      expect(result.rows[0]?.metrics.grossMargin).toMatchObject({
        status: "available",
        unit: "percent",
        value: "100.00",
      });
      expect(result.metricCoverage.grossMargin).toEqual({
        known: 1,
        unknown: 0,
      });
      expect(
        result.rows[0]?.metrics.operatingCashFlowToNetIncome,
      ).toMatchObject({
        status: "available",
        unit: "percent",
        value: "100.00",
      });
      expect(result.metricCoverage.operatingCashFlowToNetIncome).toEqual({
        known: 1,
        unknown: 0,
      });
      expect(fetch).toHaveBeenCalledTimes(15);
    }
    const refreshed = await finish(
      provider.loadSnapshot(2025, undefined, true),
    );
    expect(refreshed.snapshotSha256).toBe(first.snapshotSha256);
    expect(fetch).toHaveBeenCalledTimes(30);
    now = new Date("2026-09-09T18:30:00.000Z");
    amount = 2;
    const changed = await finish(provider.loadSnapshot(2025));
    expect(changed.snapshotSha256).not.toBe(first.snapshotSha256);
    expect(changed.frames.slice(0, 6)).toEqual(first.frames.slice(0, 6));
    expect(changed.frames[6]?.facts[0]?.value).toBe("2");
    expect(changed.frames[7]).toEqual(first.frames[7]);
    expect(fetch).toHaveBeenCalledTimes(45);
    await finish(provider.loadSnapshot(2024));
    await finish(provider.loadSnapshot(2025));
    expect(fetch).toHaveBeenCalledTimes(75);
  });

  it("includes PP&E-only amount, accession and failure changes in the digest without extra cache reads", async () => {
    let now = NOW;
    let amount = "1.000001";
    let accession = "0000000042-26-000001";
    let failed = false;
    const fetch = mockedFetch((url) => {
      if (!url.includes("/PaymentsToAcquirePropertyPlantAndEquipment/"))
        return Response.json(payload(url));
      return failed
        ? new Response("private-ppe-cache-canary", { status: 503 })
        : Response.json(payload(url, [fact({ val: amount, accn: accession })]));
    });
    const provider = createSecPersonalFinancialProvider(USER_AGENT, {
      fetch,
      now: () => now,
    });
    const initial = await finish(provider.loadSnapshot(2025));
    expect(await provider.loadSnapshot(2025)).toBe(initial);
    expect(fetch).toHaveBeenCalledTimes(15);
    const identical = await finish(
      provider.loadSnapshot(2025, undefined, true),
    );
    expect(identical.snapshotSha256).toBe(initial.snapshotSha256);
    expect(fetch).toHaveBeenCalledTimes(30);

    amount = "-2.000001";
    const changedAmount = await finish(
      provider.loadSnapshot(2025, undefined, true),
    );
    expect(changedAmount.snapshotSha256).not.toBe(initial.snapshotSha256);
    expect(changedAmount.frames[7]?.facts[0]?.value).toBe("-2.000001");
    expect(fetch).toHaveBeenCalledTimes(45);

    accession = "0000000042-26-000099";
    const changedAccession = await finish(
      provider.loadSnapshot(2025, undefined, true),
    );
    expect(changedAccession.snapshotSha256).not.toBe(
      changedAmount.snapshotSha256,
    );
    expect(changedAccession.frames[7]?.facts[0]?.accessionNumber).toBe(
      accession,
    );
    expect(fetch).toHaveBeenCalledTimes(60);

    failed = true;
    const unavailable = await finish(
      provider.loadSnapshot(2025, undefined, true),
    );
    expect(unavailable.snapshotSha256).not.toBe(
      changedAccession.snapshotSha256,
    );
    expect(unavailable.frames[7]).toMatchObject({
      status: "upstream_unavailable",
      facts: [],
      unknownCiks: [],
    });
    expect(await provider.loadSnapshot(2025)).toBe(unavailable);
    expect(fetch).toHaveBeenCalledTimes(75);
    expect(JSON.stringify(unavailable)).not.toContain(
      "private-ppe-cache-canary",
    );

    failed = false;
    now = new Date("2026-09-09T18:30:00.000Z");
    const recovered = await finish(provider.loadSnapshot(2025));
    expect(recovered.snapshotSha256).toBe(changedAccession.snapshotSha256);
    expect(fetch).toHaveBeenCalledTimes(90);
    for (const snapshot of [
      identical,
      changedAmount,
      changedAccession,
      unavailable,
      recovered,
    ])
      expect(snapshot.frames.slice(0, 7)).toEqual(initial.frames.slice(0, 7));
  });

  it("derives CY2008 revenue for the oldest supported selected year without changing the ten current routes", async () => {
    const fetch = mockedFetch();
    const provider = createSecPersonalFinancialProvider(USER_AGENT, { fetch });
    const snapshot = await finish(provider.loadSnapshot(2009));
    expect(snapshot.calendarYear).toBe(2009);
    expect(snapshot.priorCalendarYear).toBe(2008);
    expect(fetch.mock.calls.map(([url]) => requestUrl(url))).toEqual(
      EXPECTED_URLS.map((url) =>
        url.replace("2025", "2009").replace("2024", "2008"),
      ),
    );
    expect(
      snapshot.priorRevenueFrames.every(
        (frame) => frame.status === "available",
      ),
    ).toBe(true);
    expect(snapshot.priorRevenueFrames[0]?.facts[0]).toMatchObject({
      startDate: "2008-01-01",
      endDate: "2008-12-31",
      value: "1200000",
    });
    expect(await provider.loadSnapshot(2009)).toBe(snapshot);
    expect(fetch).toHaveBeenCalledTimes(15);
  });

  it("binds prior-only value, dates, accession, quarantine and unavailable status to one atomic snapshot digest", async () => {
    let priorRow = fact({ start: "2024-01-01", end: "2024-12-31" });
    let failed = false;
    const fetch = mockedFetch((url) =>
      !url.endsWith("CY2024.json")
        ? Response.json(payload(url))
        : failed
          ? new Response("private-prior-canary", { status: 503 })
          : Response.json(payload(url, [priorRow])),
    );
    const provider = createSecPersonalFinancialProvider(USER_AGENT, { fetch });
    const initial = await finish(provider.loadSnapshot(2025));
    const same = await finish(provider.loadSnapshot(2025, undefined, true));
    expect(same.snapshotSha256).toBe(initial.snapshotSha256);
    const hashes = new Set([initial.snapshotSha256]);
    for (const change of [
      () => {
        priorRow = { ...priorRow, val: "1.000001" };
      },
      () => {
        priorRow = { ...priorRow, start: "2023-12-31", end: "2024-12-30" };
      },
      () => {
        priorRow = { ...priorRow, accn: "0000000042-25-000099" };
      },
      () => {
        priorRow = { ...priorRow, val: "9007199254740992" };
      },
      () => {
        failed = true;
      },
    ]) {
      change();
      const next = await finish(provider.loadSnapshot(2025, undefined, true));
      expect(hashes.has(next.snapshotSha256)).toBe(false);
      hashes.add(next.snapshotSha256);
      expect(next.frames).toEqual(initial.frames);
      expect(next.instantFrames).toEqual(initial.instantFrames);
      expect(await provider.loadSnapshot(2025)).toBe(next);
      expect(JSON.stringify(next)).not.toContain("private-prior-canary");
    }
    expect(fetch).toHaveBeenCalledTimes(105);
    const final = await provider.loadSnapshot(2025);
    expect(
      final.priorRevenueFrames.every(
        (frame) => frame.status === "upstream_unavailable",
      ),
    ).toBe(true);
  });

  it.each([404, 503])(
    "isolates prior revenue HTTP%d from all nineteen other metrics and preserves explicit growth failure",
    async (failureStatus) => {
      let failPrior = false;
      const fetch = mockedFetch((url) =>
        failPrior && url.endsWith("CY2024.json")
          ? new Response("private-prior-source", { status: failureStatus })
          : Response.json(payload(url)),
      );
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const initial = await finish(provider.loadSnapshot(2025));
      failPrior = true;
      const changed = await finish(
        provider.loadSnapshot(2025, undefined, true),
      );
      const listing: PersonalSecurityMasterScreenRowDto = {
        cik: "0000000042",
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "issuer-42",
        issuerName: "Synthetic issuer",
        listingId: "listing-42",
        securityId: "security-42",
        securityName: "Synthetic common stock",
        shareClassId: "share-42",
        shareClassName: "Common Stock",
        symbol: "SYNTH",
      };
      for (const revenueBasis of PERSONAL_FINANCIAL_REVENUE_BASES) {
        const criteria = {
          calendarYear: 2025,
          revenueBasis,
          identityText: "",
          clauses: [],
          sort: { field: "symbol", direction: "asc" },
        } as const;
        const before = evaluatePersonalFinancialScreen(
          [listing],
          initial,
          criteria,
          { offset: 0, limit: 1 },
          `sha256:${"a".repeat(64)}`,
        );
        const after = evaluatePersonalFinancialScreen(
          [listing],
          changed,
          criteria,
          { offset: 0, limit: 1 },
          `sha256:${"a".repeat(64)}`,
        );
        for (const metric of [
          ...PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS,
          ...PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS,
        ]) {
          expect(after.rows[0]?.metrics[metric]).toEqual(
            before.rows[0]?.metrics[metric],
          );
          expect(after.metricCoverage[metric]).toEqual(
            before.metricCoverage[metric],
          );
        }
        expect(before.rows[0]?.metrics.revenueGrowth).toMatchObject({
          status: "available",
          value: "0.00",
        });
        expect(after.rows[0]?.metrics.revenueGrowth).toMatchObject({
          status: "unavailable",
          reason: "prior_unavailable",
          currentRevenue: before.rows[0]?.metrics.revenue,
          priorRevenue: { status: "unavailable" },
        });
        expect(after.sources).toEqual(before.sources);
        expect(after.priorRevenueSources).toHaveLength(3);
        expect(
          after.priorRevenueSources.every(
            (source) =>
              source.status ===
              (failureStatus === 404 ? "not_covered" : "upstream_unavailable"),
          ),
        ).toBe(true);
        expect(await provider.loadSnapshot(2025)).toBe(changed);
      }
      expect(fetch).toHaveBeenCalledTimes(30);
    },
  );

  it.each(["fetch", "body", "spacing"] as const)(
    "aborts in prior-year %s without caching a twelve-frame partial result",
    async (phase) => {
      let stall = true;
      const fetch = vi.fn<typeof globalThis.fetch>((input) => {
        const url = requestUrl(input);
        if (stall && url.endsWith("CY2024.json")) {
          if (phase === "fetch") return new Promise<Response>(() => undefined);
          if (phase === "body")
            return Promise.resolve(
              new Response(new ReadableStream<Uint8Array>({ start() {} })),
            );
        }
        return Promise.resolve(Response.json(payload(url)));
      });
      const provider = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
      });
      const controller = new AbortController();
      const pending = provider.loadSnapshot(2025, controller.signal);
      const rejected = expect(pending).rejects.toMatchObject({
        code: "aborted",
      });
      await vi.advanceTimersByTimeAsync(phase === "spacing" ? 2_600 : 2_700);
      const expectedBeforeAbort = phase === "spacing" ? 12 : 13;
      expect(fetch).toHaveBeenCalledTimes(expectedBeforeAbort);
      controller.abort();
      await rejected;
      if (phase !== "spacing")
        expect(fetch.mock.calls[12]?.[1]?.signal?.aborted).toBe(true);
      stall = false;
      const recovered = await finish(provider.loadSnapshot(2025));
      expect(recovered.frames).toHaveLength(8);
      expect(recovered.instantFrames).toHaveLength(4);
      expect(recovered.priorRevenueFrames).toHaveLength(3);
      expect(
        recovered.priorRevenueFrames.every(
          (frame) => frame.status === "available",
        ),
      ).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(expectedBeforeAbort + 15);
    },
  );

  it("applies the same ten-second deadlines and partial failures to prior-year fetch and body", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((input) => {
      const url = requestUrl(input);
      if (url === EXPECTED_URLS[12])
        return new Promise<Response>(() => undefined);
      if (url === EXPECTED_URLS[13])
        return Promise.resolve(
          new Response(new ReadableStream<Uint8Array>({ start() {} })),
        );
      return Promise.resolve(Response.json(payload(url)));
    });
    const result = await finish(
      createSecPersonalFinancialProvider(USER_AGENT, { fetch }).loadSnapshot(
        2025,
      ),
    );
    expect(result.frames.every((frame) => frame.status === "available")).toBe(
      true,
    );
    expect(
      result.instantFrames.every((frame) => frame.status === "available"),
    ).toBe(true);
    expect(result.priorRevenueFrames.map((frame) => frame.status)).toEqual([
      "upstream_unavailable",
      "upstream_unavailable",
      "available",
    ]);
    expect(fetch.mock.calls[12]?.[1]?.signal?.aborted).toBe(true);
    expect(fetch.mock.calls[13]?.[1]?.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(15);
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
    expect(fetch).toHaveBeenCalledTimes(15);
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
    expect(fetch).toHaveBeenCalledTimes(15);
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
    await vi.advanceTimersByTimeAsync(0);
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
