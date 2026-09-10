import {
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS as LIMITS,
  type PersonalSecQuarterlyConcept,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSecPersonalQuarterlyEvidenceProvider,
  PersonalSecQuarterlyEvidenceProviderError,
} from "./personal-sec-quarterly-evidence-provider";
import {
  createPersonalSecRequestScheduler,
  PersonalSecRequestSchedulerError,
  type PersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";

const NOW = new Date("2026-09-10T08:00:00.000Z");
const USER_AGENT = "Research/1.0 owner@example.test";
const CIK = "0000000042";
const ACCESSION = "0000999999-26-000001"; // Filing-agent prefix is not issuer identity.
const FACTS_URL = `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`;
const SUBMISSIONS_URL = `https://data.sec.gov/submissions/CIK${CIK}.json`;

function fact(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    start: "2025-01-01",
    end: "2025-03-31",
    val: 120,
    accn: ACCESSION,
    fy: 2026,
    fp: "Q1",
    form: "10-Q",
    filed: "2026-05-01",
    frame: "CY2025Q1",
    ...overrides,
  };
}

function companyFacts(
  rows: readonly unknown[] = [fact()],
  extras: Partial<Record<PersonalSecQuarterlyConcept, unknown>> = {},
): Record<string, unknown> {
  return {
    cik: 42,
    entityName: "Synthetic fixture only",
    facts: {
      "us-gaap": { Revenues: { units: { USD: rows } }, ...extras },
      custom: { Revenues: { units: { USD: [fact({ val: 999999 })] } } },
    },
  };
}

function submissions(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    cik: "0000000042",
    filings: {
      recent: {
        accessionNumber: [ACCESSION],
        form: ["10-Q"],
        filingDate: ["2026-05-01"],
        reportDate: ["2026-03-31"],
        acceptanceDateTime: ["2026-05-01T16:02:03.000Z"],
        primaryDocument: ["https://attacker.invalid/ignored"],
        ...overrides,
      },
      files: [{ name: "https://attacker.invalid/older.json" }],
    },
  };
}

function setup(
  factsResponse: () => Response = () => Response.json(companyFacts()),
  submissionsResponse: () => Response = () => Response.json(submissions()),
  scheduler: PersonalSecRequestScheduler = createPersonalSecRequestScheduler({
    now: () => Date.now(),
  }),
) {
  const starts: number[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>((input) => {
    starts.push(Date.now());
    return Promise.resolve(
      requestUrl(input).includes("companyfacts")
        ? factsResponse()
        : submissionsResponse(),
    );
  });
  const provider = createSecPersonalQuarterlyEvidenceProvider(USER_AGENT, {
    fetch,
    now: () => NOW,
    scheduler,
  });
  return { provider, fetch, starts };
}

async function finish<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

function sourceNumericResponse(lexeme: string): Response {
  return new Response(
    JSON.stringify(companyFacts([fact({ val: "__AMOUNT__" })])).replace(
      '"__AMOUNT__"',
      lexeme,
    ),
  );
}

describe("selected-company SEC quarterly evidence provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires an independently configured SEC contact and does no implicit requests", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    for (const userAgent of [
      undefined,
      "",
      "Mozilla/5.0",
      "Research x@example.test\r\nSecret: value",
      `Research ${"x".repeat(256)}@example.test`,
    ]) {
      const provider = createSecPersonalQuarterlyEvidenceProvider(userAgent, {
        fetch,
      });
      expect(provider.status()).toEqual({ configured: false });
      await expect(provider.loadEvidence(CIK)).rejects.toMatchObject({
        code: "not_configured",
        message: "Personal SEC quarterly evidence is unavailable.",
      });
    }
    expect(
      createSecPersonalQuarterlyEvidenceProvider(USER_AGENT, {
        fetch,
      }).status(),
    ).toEqual({ configured: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "42",
    "0000000000",
    "0000000042/evil",
    " 0000000042",
    "0000000042.0",
    "99999999999",
  ])("rejects noncanonical requested CIK %s without fetching", async (cik) => {
    const { provider, fetch } = setup();
    await expect(provider.loadEvidence(cik)).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads exactly the two fixed public URLs with required headers, spacing and no cache", async () => {
    const { provider, fetch, starts } = setup();
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      FACTS_URL,
      SUBMISSIONS_URL,
    ]);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(220);
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: expect.any(AbortSignal) as unknown,
      });
    }
    expect(result).toMatchObject({
      cik: CIK,
      fetchedAt: NOW.toISOString(),
      olderHistoryAvailable: true,
      sources: {
        companyFacts: { status: "available", sourceUrl: FACTS_URL },
        submissions: { status: "available", sourceUrl: SUBMISSIONS_URL },
      },
      coverage: {
        inspectedRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        availableObservations: 1,
        returnedObservations: 1,
        truncated: false,
      },
      ttm: {
        status: "unavailable",
        reason: "period_and_revision_not_admitted",
      },
    });
    await finish(provider.loadEvidence(CIK));
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(220);
  });

  it("retains actual comparative dates separately from filing focus and current report date", async () => {
    const { provider } = setup();
    const result = await finish(provider.loadEvidence(CIK));
    expect(result.observations[0]).toMatchObject({
      metric: "revenue",
      taxonomy: "us-gaap",
      concept: "Revenues",
      unit: "USD",
      value: "120",
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      durationDays: 90,
      periodBasis: "unresolved",
      filingFocusYear: 2026,
      filingFocusPeriod: "Q1",
      frame: "CY2025Q1",
      accessionNumber: ACCESSION,
      sourceLocator: "/facts/us-gaap/Revenues/units/USD/0",
      filing: {
        status: "matched",
        form: "10-Q",
        filedDate: "2026-05-01",
        reportDate: "2026-03-31",
        acceptedAt: "2026-05-01T16:02:03.000Z",
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/42/${ACCESSION}-index.htm`,
      },
    });
    expect(result.observations[0]).not.toHaveProperty("fiscalQuarter");
    expect(result.observations[0]).not.toHaveProperty("knownFrom");
    expect(result.observations[0]!.id).toMatch(/^sec-fact:[a-f0-9]{64}$/u);
  });

  it("preserves aliases, multiple durations, amendments, conflicting values and filing metadata variants", async () => {
    const rows = [
      fact(),
      fact(),
      fact({ start: "2024-10-01" }),
      fact({ val: 121 }),
      fact({ accn: "0000999999-26-000002", form: "10-Q/A" }),
      fact({ fy: 2025 }),
      fact({ start: null }),
    ];
    const { provider } = setup(() =>
      Response.json(
        companyFacts(rows, {
          NetIncomeLoss: { units: { USD: [fact({ val: -10 })] } },
          SalesRevenueNet: { units: { USD: [fact()] } },
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            units: { USD: [fact()] },
          },
        }),
      ),
    );
    const result = await finish(provider.loadEvidence(CIK));
    expect(result.coverage).toMatchObject({
      inspectedRows: 10,
      duplicateRows: 1,
      invalidRows: 0,
      availableObservations: 9,
      returnedObservations: 9,
    });
    expect(new Set(result.observations.map((row) => row.id)).size).toBe(9);
    expect(new Set(result.observations.map((row) => row.concept))).toEqual(
      new Set(PERSONAL_SEC_QUARTERLY_CONCEPTS),
    );
    expect(
      result.observations.every((row) => row.periodBasis === "unresolved"),
    ).toBe(true);
    expect(
      result.observations.find((row) => row.startDate === null),
    ).toMatchObject({ durationDays: null });
    expect(
      result.observations.find((row) => row.startDate === "2024-10-01"),
    ).toMatchObject({ durationDays: 182 });
    expect(
      result.observations.filter((row) => row.metric === "net_income")[0]!
        .value,
    ).toBe("-10");
  });

  it("sorts by actual period and retains stable source IDs when rows or submission metadata change", async () => {
    const rows = [
      fact({ end: "2024-12-31", start: "2024-10-01" }),
      fact(),
      fact({ start: "2025-02-01" }),
    ];
    const first = await finish(
      setup(() => Response.json(companyFacts(rows))).provider.loadEvidence(CIK),
    );
    const second = await finish(
      setup(
        () => Response.json(companyFacts([...rows].reverse())),
        () => Response.json(submissions({ reportDate: [""] })),
      ).provider.loadEvidence(CIK),
    );
    expect(first.observations.map((row) => row.startDate)).toEqual([
      "2025-02-01",
      "2025-01-01",
      "2024-10-01",
    ]);
    expect(first.observations.map((row) => row.id)).toEqual(
      second.observations.map((row) => row.id),
    );
    expect(first.observations[0]!.sourceLocator).not.toBe(
      second.observations[0]!.sourceLocator,
    );
  });

  it.each([
    ["9007199254740993", "9007199254740993"],
    [
      "-900719925474099312345678901234567890.123456789",
      "-900719925474099312345678901234567890.123456789",
    ],
    ["1.234567890123456789e20", "123456789012345678900"],
    ["1.234567890123456789e-10", "0.0000000001234567890123456789"],
    ["-120.250000", "-120.25"],
    ["-0.000e30", "0"],
    ["1000.000", "1000"],
    ["0.001200e3", "1.2"],
    ["1e63", `1${"0".repeat(63)}`],
    ["1e-62", `0.${"0".repeat(61)}1`],
  ])("preserves exact raw numeric %s as %s", async (wire, expected) => {
    const result = await finish(
      setup(() => sourceNumericResponse(wire)).provider.loadEvidence(CIK),
    );
    expect(result.observations[0]!.value).toBe(expected);
  });

  it.each([
    "1e64",
    "-1e63",
    "1e-63",
    "1e10000",
    "1e-10000",
    '"123.45"',
    "null",
    "true",
    "{}",
  ])(
    "excludes unsupported amount %s with explicit invalid-row count",
    async (wire) => {
      const result = await finish(
        setup(() => sourceNumericResponse(wire)).provider.loadEvidence(CIK),
      );
      expect(result.sources.companyFacts.status).toBe("available");
      expect(result.coverage).toMatchObject({
        inspectedRows: 1,
        invalidRows: 1,
        availableObservations: 0,
      });
      expect(result.observations).toEqual([]);
    },
  );

  it.each([
    { start: "2025-02-29" },
    { start: "0999-01-01" },
    { end: "0000-03-31" },
    { end: "2025-13-01" },
    { start: "2025-04-01" },
    { end: 20250331 },
    { filed: 20260501 },
    { fy: "2026" },
    { fy: 2026.5 },
    { fp: "\nQ1" },
    { frame: "x".repeat(129) },
    { accn: "../../secret" },
    { form: "10-Q\n" },
    { form: 10 },
  ])(
    "excludes malformed source metadata %j without losing another row",
    async (overrides) => {
      const result = await finish(
        setup(() =>
          Response.json(companyFacts([fact(overrides), fact()])),
        ).provider.loadEvidence(CIK),
      );
      expect(result.coverage).toMatchObject({
        inspectedRows: 2,
        invalidRows: 1,
        returnedObservations: 1,
      });
    },
  );

  it("leaves absent focus/frame/start metadata null and detects unavailable USD branches", async () => {
    const result = await finish(
      setup(() =>
        Response.json(
          companyFacts(
            [
              fact({
                start: undefined,
                fy: undefined,
                fp: null,
                frame: undefined,
              }),
            ],
            {
              NetIncomeLoss: { units: { EUR: [fact()] } },
              SalesRevenueNet: { units: { USD: [] } },
            },
          ),
        ),
      ).provider.loadEvidence(CIK),
    );
    expect(result.observations[0]).toMatchObject({
      startDate: null,
      durationDays: null,
      filingFocusYear: null,
      filingFocusPeriod: null,
      frame: null,
    });
    expect(result.coverage.conceptsWithoutUsd).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "SalesRevenueNet",
      "NetIncomeLoss",
    ]);
  });

  it("binds both source CIKs independently instead of trusting issuer names or accession prefixes", async () => {
    const wrongFacts = { ...companyFacts(), cik: 43 };
    const result = await finish(
      setup(() => Response.json(wrongFacts)).provider.loadEvidence(CIK),
    );
    expect(result.sources.companyFacts.status).toBe("invalid_response");
    expect(result.sources.submissions.status).toBe("available");
    expect(result.observations).toEqual([]);
    const wrongSubmissions = await finish(
      setup(undefined, () =>
        Response.json({ ...submissions(), cik: 43 }),
      ).provider.loadEvidence(CIK),
    );
    expect(wrongSubmissions.sources.submissions.status).toBe(
      "invalid_response",
    );
    expect(wrongSubmissions.observations[0]!.filing).toEqual({
      status: "submissions_unavailable",
      form: null,
      filedDate: null,
      reportDate: null,
      acceptedAt: null,
      sourceUrl: null,
    });
  });

  it.each(["42.00000000000000001", "4.2e1", "9007199254740993", "true"])(
    "does not round malformed source CIK %s into requested identity",
    async (wire) => {
      const result = await finish(
        setup(
          () =>
            new Response(
              JSON.stringify(companyFacts()).replace(
                '"cik":42',
                `"cik":${wire}`,
              ),
            ),
        ).provider.loadEvidence(CIK),
      );
      expect(result.sources.companyFacts.status).toBe("invalid_response");
    },
  );

  it("marks matched accession metadata conflicts, and does not invent links for older unmatched observations", async () => {
    const result = await finish(
      setup(
        () =>
          Response.json(
            companyFacts([fact(), fact({ accn: "0000999999-25-000001" })]),
          ),
        () =>
          Response.json(
            submissions({ form: ["10-Q/A"], filingDate: ["2026-05-02"] }),
          ),
      ).provider.loadEvidence(CIK),
    );
    expect(
      result.observations.find((row) => row.accessionNumber === ACCESSION)!
        .filing,
    ).toMatchObject({
      status: "metadata_conflict",
      form: "10-Q/A",
      filedDate: "2026-05-02",
      sourceUrl: expect.stringContaining("www.sec.gov/Archives/") as unknown,
    });
    expect(
      result.observations.find((row) => row.accessionNumber !== ACCESSION)!
        .filing,
    ).toEqual({
      status: "not_in_current_submissions",
      form: null,
      filedDate: null,
      reportDate: null,
      acceptedAt: null,
      sourceUrl: null,
    });
    expect(result.olderHistoryAvailable).toBe(true);
  });

  it("permits explicitly missing acceptance/report metadata without inventing timestamps", async () => {
    const result = await finish(
      setup(undefined, () =>
        Response.json(
          submissions({ acceptanceDateTime: undefined, reportDate: [""] }),
        ),
      ).provider.loadEvidence(CIK),
    );
    expect(result.observations[0]!.filing).toMatchObject({
      status: "matched",
      acceptedAt: null,
      reportDate: null,
    });
  });

  it.each([
    { form: [] },
    { reportDate: [] },
    { acceptanceDateTime: [] },
    { accessionNumber: [42] },
    { reportDate: ["2025-02-29"] },
    { acceptanceDateTime: ["2026-05-01T25:00:00.000Z"] },
    { acceptanceDateTime: ["2026-05-01T16:02:03-04:00"] },
    { filingDate: [20260501] },
    { form: ["<script>"] },
  ])(
    "quarantines malformed current submission metadata %j and retains facts",
    async (overrides) => {
      const result = await finish(
        setup(undefined, () =>
          Response.json(submissions(overrides)),
        ).provider.loadEvidence(CIK),
      );
      expect(result.sources.submissions.status).toBe("invalid_response");
      expect(result.observations).toHaveLength(1);
      expect(result.observations[0]!.filing.status).toBe(
        "submissions_unavailable",
      );
    },
  );

  it("accepts identical submission duplicate membership but rejects contradictory duplicates", async () => {
    const duplicated = {
      accessionNumber: [ACCESSION, ACCESSION],
      form: ["10-Q", "10-Q"],
      filingDate: ["2026-05-01", "2026-05-01"],
      reportDate: ["", ""],
      acceptanceDateTime: undefined,
    };
    const good = await finish(
      setup(undefined, () =>
        Response.json(submissions(duplicated)),
      ).provider.loadEvidence(CIK),
    );
    expect(good.observations[0]!.filing.status).toBe("matched");
    const bad = await finish(
      setup(undefined, () =>
        Response.json(submissions({ ...duplicated, form: ["10-Q", "10-Q/A"] })),
      ).provider.loadEvidence(CIK),
    );
    expect(bad.sources.submissions.status).toBe("invalid_response");
  });

  it("caps sorted results at 100 per metric while exposing the full unique count", async () => {
    const rows = Array.from({ length: 105 }, (_, index) =>
      fact({ val: index }),
    );
    const result = await finish(
      setup(() =>
        Response.json(
          companyFacts(rows, { NetIncomeLoss: { units: { USD: rows } } }),
        ),
      ).provider.loadEvidence(CIK),
    );
    expect(result.coverage).toMatchObject({
      inspectedRows: 210,
      availableObservations: 210,
      returnedObservations: 200,
      truncated: true,
    });
    expect(
      result.observations.filter((row) => row.metric === "revenue"),
    ).toHaveLength(100);
    expect(
      result.observations.filter((row) => row.metric === "net_income"),
    ).toHaveLength(100);
  });

  it("accepts the exact candidate bound, then rejects excess across concepts without a partial prefix", async () => {
    const rows = Array.from({ length: LIMITS.candidateRows }, () => fact());
    const good = await finish(
      setup(() => Response.json(companyFacts(rows))).provider.loadEvidence(CIK),
    );
    expect(good.coverage).toMatchObject({
      inspectedRows: 20_000,
      duplicateRows: 19_999,
      availableObservations: 1,
    });
    const bad = await finish(
      setup(() =>
        Response.json(
          companyFacts(rows, { NetIncomeLoss: { units: { USD: [fact()] } } }),
        ),
      ).provider.loadEvidence(CIK),
    );
    expect(bad.sources.companyFacts.status).toBe("candidate_limit");
    expect(bad.coverage).toMatchObject({
      inspectedRows: 0,
      returnedObservations: 0,
      truncated: false,
    });
    expect(bad.sources.submissions.status).toBe("available");
  });

  it("enforces the current-submission candidate cap independently", async () => {
    const result = await finish(
      setup(undefined, () =>
        Response.json(
          submissions({
            accessionNumber: Array.from(
              { length: LIMITS.submissionRows + 1 },
              () => ACCESSION,
            ),
          }),
        ),
      ).provider.loadEvidence(CIK),
    );
    expect(result.sources.submissions.status).toBe("candidate_limit");
    expect(result.observations[0]!.filing.status).toBe(
      "submissions_unavailable",
    );
  });

  it.each([
    [404, "not_covered"],
    [429, "rate_limited"],
    [401, "upstream_unavailable"],
    [500, "upstream_unavailable"],
  ] as const)(
    "reports HTTP %s source status without exposing bodies",
    async (status, expected) => {
      const result = await finish(
        setup(
          () => new Response("secret upstream detail", { status }),
        ).provider.loadEvidence(CIK),
      );
      expect(result.sources.companyFacts.status).toBe(expected);
      expect(result.sources.submissions.status).toBe("available");
      expect(JSON.stringify(result)).not.toContain("secret");
    },
  );

  it.each([
    "",
    "{",
    "null",
    "[]",
    '{"cik":42,"facts":[]}',
    '{"cik":42,"facts":{"us-gaap":42}}',
    '{"cik":42,"facts":{"us-gaap":{"Revenues":{"units":{"USD":null}}}}}',
  ])("rejects malformed source shape %s", async (body) => {
    const result = await finish(
      setup(() => new Response(body)).provider.loadEvidence(CIK),
    );
    expect(result.sources.companyFacts.status).toBe("invalid_response");
  });

  it("treats an absent standard taxonomy as visible missing USD coverage", async () => {
    const result = await finish(
      setup(() => Response.json({ cik: 42, facts: {} })).provider.loadEvidence(
        CIK,
      ),
    );
    expect(result.sources.companyFacts.status).toBe("available");
    expect(result.coverage.conceptsWithoutUsd).toEqual(
      PERSONAL_SEC_QUARTERLY_CONCEPTS,
    );
  });

  it.each(["-1", "01", "wat", "9007199254740993"])(
    "rejects invalid declared byte length %s",
    async (length) => {
      const result = await finish(
        setup(
          () => new Response("{}", { headers: { "content-length": length } }),
        ).provider.loadEvidence(CIK),
      );
      expect(result.sources.companyFacts.status).toBe("invalid_response");
    },
  );

  it("reports declared or streamed oversized data explicitly and cancels its stream", async () => {
    const declared = await finish(
      setup(
        () =>
          new Response("{}", {
            headers: { "content-length": String(LIMITS.responseBytes + 1) },
          }),
      ).provider.loadEvidence(CIK),
    );
    expect(declared.sources.companyFacts.status).toBe("response_too_large");
    const cancel = vi.fn();
    const streamed = await finish(
      setup(
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array(LIMITS.responseBytes + 1));
              },
              cancel,
            }),
          ),
      ).provider.loadEvidence(CIK),
    );
    expect(streamed.sources.companyFacts.status).toBe("response_too_large");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("accepts exactly the byte cap and rejects invalid UTF-8 without source details", async () => {
    const text = JSON.stringify(companyFacts());
    const exact = await finish(
      setup(
        () =>
          new Response(text + " ".repeat(LIMITS.responseBytes - text.length)),
      ).provider.loadEvidence(CIK),
    );
    expect(exact.observations).toHaveLength(1);
    const invalid = await finish(
      setup(
        () => new Response(new Uint8Array([0xc0, 0xaf])),
      ).provider.loadEvidence(CIK),
    );
    expect(invalid.sources.companyFacts.status).toBe("invalid_response");
  });

  it.each(["redirected", "url"])(
    "rejects unexpected response %s",
    async (field) => {
      const response = Response.json(companyFacts());
      Object.defineProperty(response, field, {
        value: field === "url" ? "https://attacker.invalid/" : true,
      });
      const result = await finish(
        setup(() => response).provider.loadEvidence(CIK),
      );
      expect(result.sources.companyFacts.status).toBe("invalid_response");
    },
  );

  it("limits a noncooperative fetch and then attempts the second source", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise(() => undefined),
    );
    const provider = createSecPersonalQuarterlyEvidenceProvider(USER_AGENT, {
      fetch,
      now: () => NOW,
      scheduler: createPersonalSecRequestScheduler({ now: () => Date.now() }),
    });
    const result = await finish(provider.loadEvidence(CIK));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.sources.companyFacts.status).toBe("upstream_unavailable");
    expect(result.sources.submissions.status).toBe("upstream_unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("limits stalled response bodies and cancels their readers", async () => {
    const cancel = vi.fn();
    const result = await finish(
      setup(
        () => new Response(new ReadableStream<Uint8Array>({ cancel })),
      ).provider.loadEvidence(CIK),
    );
    expect(result.sources.companyFacts.status).toBe("upstream_unavailable");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("allows one active load, aborts without issuing the second request, and releases active state", async () => {
    let hang = true;
    const fetch = vi.fn<typeof globalThis.fetch>((input) =>
      hang
        ? new Promise(() => undefined)
        : Promise.resolve(
            Response.json(
              requestUrl(input).includes("companyfacts")
                ? companyFacts()
                : submissions(),
            ),
          ),
    );
    const provider = createSecPersonalQuarterlyEvidenceProvider(USER_AGENT, {
      fetch,
      now: () => NOW,
      scheduler: createPersonalSecRequestScheduler({ now: () => Date.now() }),
    });
    const controller = new AbortController();
    const running = provider.loadEvidence(CIK, controller.signal);
    const rejected = expect(running).rejects.toMatchObject({ code: "aborted" });
    await vi.advanceTimersByTimeAsync(0);
    await expect(provider.loadEvidence(CIK)).rejects.toMatchObject({
      code: "busy",
    });
    controller.abort();
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    hang = false;
    expect(
      (await finish(provider.loadEvidence(CIK))).observations,
    ).toHaveLength(1);
  });

  it("cancels while queued between the two requests and closes permanently", async () => {
    let permits = 0;
    const scheduler: PersonalSecRequestScheduler = {
      wait: (signal) => {
        permits += 1;
        if (permits === 1) return Promise.resolve();
        return new Promise((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new PersonalSecRequestSchedulerError("aborted")),
            { once: true },
          ),
        );
      },
    };
    const { provider, fetch } = setup(undefined, undefined, scheduler);
    const running = provider.loadEvidence(CIK);
    const rejected = expect(running).rejects.toMatchObject({ code: "aborted" });
    await vi.advanceTimersByTimeAsync(0);
    expect(permits).toBe(2);
    provider.close();
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(provider.status()).toEqual({ configured: false });
    await expect(provider.loadEvidence(CIK)).rejects.toMatchObject({
      code: "aborted",
    });
  });

  it("does not count queued scheduler time against the request deadline", async () => {
    const scheduler: PersonalSecRequestScheduler = {
      wait: () => new Promise((resolve) => setTimeout(resolve, 12_000)),
    };
    const result = await finish(
      setup(undefined, undefined, scheduler).provider.loadEvidence(CIK),
    );
    expect(result.sources.companyFacts.status).toBe("available");
    expect(result.sources.submissions.status).toBe("available");
  });

  it("maps shared scheduler saturation to a sanitized busy error and permits a later load", async () => {
    let busy = true;
    const scheduler: PersonalSecRequestScheduler = {
      wait: () =>
        busy
          ? Promise.reject(new PersonalSecRequestSchedulerError("busy"))
          : Promise.resolve(),
    };
    const { provider, fetch } = setup(undefined, undefined, scheduler);
    await expect(provider.loadEvidence(CIK)).rejects.toBeInstanceOf(
      PersonalSecQuarterlyEvidenceProviderError,
    );
    await expect(provider.loadEvidence(CIK)).rejects.toMatchObject({
      code: "busy",
      message: "Personal SEC quarterly evidence is unavailable.",
    });
    expect(fetch).not.toHaveBeenCalled();
    busy = false;
    expect(
      (await finish(provider.loadEvidence(CIK))).observations,
    ).toHaveLength(1);
  });

  it("rejects pre-aborted requests and invalid clocks without a network request", async () => {
    const { provider, fetch } = setup();
    await expect(
      provider.loadEvidence(CIK, AbortSignal.abort()),
    ).rejects.toMatchObject({ code: "aborted" });
    const invalid = createSecPersonalQuarterlyEvidenceProvider(USER_AGENT, {
      fetch,
      now: () => new Date(NaN),
    });
    await expect(invalid.loadEvidence(CIK)).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns recursively frozen data while keeping source payloads unchanged", async () => {
    const source = companyFacts();
    const before = JSON.stringify(source);
    const result = await finish(
      setup(() => Response.json(source)).provider.loadEvidence(CIK),
    );
    function check(value: unknown): void {
      if (typeof value !== "object" || value === null) return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) check(child);
    }
    check(result);
    expect(JSON.stringify(source)).toBe(before);
  });
});
