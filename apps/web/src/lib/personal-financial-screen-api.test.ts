import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialSavedViewsPayloadDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersonalFinancialSavedViews,
  isPersonalFinancialScreenCriteria,
  personalFinancialSourceUrl,
  savePersonalFinancialSavedViews,
  screenPersonalFinancials,
} from "./personal-financial-screen-api";

const fetchMock = vi.fn<typeof fetch>();
const signal = () => new AbortController().signal;
const sha = (letter: string): `sha256:${string}` =>
  `sha256:${letter.repeat(64)}`;
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("financial screen transport", () => {
  it.each([
    ["9007199254740993.000", "9007199254740993", true],
    ["9007199254740993", "9007199254740992", false],
    ["-0.000", "0", true],
    ["-0.00000000000000001", "0", false],
  ] as const)(
    "compares gross-profit source %s and display %s without numeric precision loss",
    async (reported, displayed, accepted) => {
      const result = response();
      const row = result.rows[0]!;
      fetchMock.mockResolvedValue(
        json({
          ...result,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                grossProfit: {
                  status: "available",
                  unit: "USD",
                  value: displayed,
                  sources: [
                    { ...source(), concept: "GrossProfit", value: reported },
                  ],
                },
              },
            },
          ],
        }),
      );
      if (accepted)
        expect(
          (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
            .grossProfit,
        ).toMatchObject({ value: displayed });
      else
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(["agreeing", "different amount", "different period"])(
    "validates multiple GrossProfit references: %s",
    async (kind) => {
      const result = response();
      const row = result.rows[0]!;
      const first = { ...source(), concept: "GrossProfit", value: "123.000" };
      const second = {
        ...first,
        accessionNumber: "0000000001-25-000002",
        value: kind === "different amount" ? "124" : "123",
        startDate: kind === "different period" ? "2024-01-02" : first.startDate,
      };
      fetchMock.mockResolvedValue(
        json({
          ...result,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                grossProfit: {
                  status: "available",
                  unit: "USD",
                  value: "123",
                  sources: [first, second],
                },
              },
            },
          ],
        }),
      );
      if (kind === "agreeing")
        expect(
          (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
            .grossProfit.sources,
        ).toHaveLength(2);
      else
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    "missing",
    "conflicting",
    "source_unavailable",
    "invalid_value",
    "period_mismatch",
    "nonpositive_revenue",
  ])(
    "accepts only reported-fact gross-profit unknown reason %s",
    async (reason) => {
      const result = response();
      const row = result.rows[0]!;
      fetchMock.mockResolvedValue(
        json({
          ...result,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                grossProfit: {
                  status: "unavailable",
                  unit: "USD",
                  reason,
                  sources: [],
                },
              },
            },
          ],
        }),
      );
      if (["period_mismatch", "nonpositive_revenue"].includes(reason))
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      else
        expect(
          (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
            .grossProfit,
        ).toMatchObject({ reason });
    },
  );

  it("sends v2 criteria and retains the complete eight-metric, seven-source response", async () => {
    const result = response();
    fetchMock.mockResolvedValue(json(result));
    const input = {
      ...request(),
      criteria: {
        ...request().criteria,
        clauses: [{ field: "grossProfit", operator: "gte", value: "-0.00001" }],
        sort: { field: "grossProfit", direction: "asc" },
      },
    } as const;
    const decoded = await screenPersonalFinancials(input, signal());
    expect(decoded.schemaVersion).toBe("2.0.0");
    expect(decoded.formulaVersion).toBe("1.0.0");
    expect(Object.keys(decoded.rows[0]!.metrics)).toEqual([
      "revenue",
      "grossProfit",
      "netIncome",
      "operatingIncome",
      "operatingCashFlow",
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
    ]);
    expect(Object.keys(decoded.metricCoverage)).toEqual(
      Object.keys(decoded.rows[0]!.metrics),
    );
    expect(decoded.sources.map((frame) => frame.concept)).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
      "OperatingIncomeLoss",
      "NetCashProvidedByUsedInOperatingActivities",
      "GrossProfit",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(input));
  });

  it("rejects historical v1 requests before transport", async () => {
    await expect(
      screenPersonalFinancials(
        {
          ...request(),
          schemaVersion: "1.0.0",
        } as unknown as PersonalFinancialScreenRequestDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "historical v1",
    "expanded v1",
    "historical shape relabeled v2",
    "missing metric",
    "missing coverage",
    "duplicate source",
    "ninth metric",
  ])("rejects incompatible response: %s", async (kind) => {
    const result = response();
    const row = result.rows[0]!;
    const metrics = { ...row.metrics } as Record<string, unknown>;
    const coverage = { ...result.metricCoverage } as Record<string, unknown>;
    let invalid: unknown = result;
    if (kind === "historical v1") invalid = historicalResponse();
    if (kind === "expanded v1") invalid = { ...result, schemaVersion: "1.0.0" };
    if (kind === "historical shape relabeled v2")
      invalid = { ...historicalResponse(), schemaVersion: "2.0.0" };
    if (kind === "missing metric") {
      delete metrics.grossProfit;
      invalid = { ...result, rows: [{ ...row, metrics }] };
    }
    if (kind === "missing coverage") {
      delete coverage.grossProfit;
      invalid = { ...result, metricCoverage: coverage };
    }
    if (kind === "duplicate source")
      invalid = {
        ...result,
        sources: [...result.sources.slice(0, 6), result.sources[0]],
      };
    if (kind === "ninth metric")
      invalid = {
        ...result,
        rows: [
          {
            ...row,
            metrics: { ...metrics, grossMargin: row.metrics.netMargin },
          },
        ],
        metricCoverage: { ...coverage, grossMargin: { known: 1, unknown: 0 } },
      };
    fetchMock.mockResolvedValue(json(invalid));
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each(["available", "unavailable"] as const)(
    "binds %s gross profit only to GrossProfit references",
    async (status) => {
      const result = response();
      const row = result.rows[0]!;
      const grossProfit =
        status === "available"
          ? {
              status,
              unit: "USD",
              value: "-123.00001",
              sources: [
                { ...source(), concept: "GrossProfit", value: "-123.00001" },
              ],
            }
          : {
              status,
              unit: "USD",
              reason: "conflicting",
              sources: [{ ...source(), concept: "GrossProfit" }],
            };
      const valid = {
        ...result,
        rows: [{ ...row, metrics: { ...row.metrics, grossProfit } }],
      };
      fetchMock.mockResolvedValueOnce(json(valid));
      expect(
        (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
          .grossProfit,
      ).toEqual(grossProfit);
      fetchMock.mockResolvedValueOnce(
        json({
          ...valid,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                grossProfit: { ...grossProfit, sources: [source()] },
              },
            },
          ],
        }),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    "revenue",
    "netIncome",
    "operatingIncome",
    "operatingCashFlow",
    "netMargin",
    "operatingMargin",
    "operatingCashFlowMargin",
  ] as const)(
    "does not admit GrossProfit as a reference for existing %s",
    async (metric) => {
      const result = response();
      const row = result.rows[0]!;
      fetchMock.mockResolvedValue(
        json({
          ...result,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                [metric]: {
                  ...row.metrics[metric],
                  sources: [{ ...source(), concept: "GrossProfit" }],
                },
              },
            },
          ],
        }),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "binds explicit %s criteria to the echoed basis and selected sources",
    async (basis) => {
      const result = responseWithBasis(basis);
      fetchMock.mockResolvedValue(json(result));
      const input = {
        ...request(),
        criteria: { ...request().criteria, revenueBasis: basis },
      };
      expect(await screenPersonalFinancials(input, signal())).toEqual(result);
      expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(input));
    },
  );

  it.each([undefined, "agreement", "Revenues", null, "totalRevenue"])(
    "rejects a missing, different or invalid single-concept response basis: %s",
    async (basis) => {
      const result = responseWithBasis(
        "RevenueFromContractWithCustomerExcludingAssessedTax",
      );
      const legacyShape = { ...result };
      delete legacyShape.revenueBasis;
      fetchMock.mockResolvedValue(
        json(
          basis === undefined
            ? legacyShape
            : { ...result, revenueBasis: basis },
        ),
      );
      await expect(
        screenPersonalFinancials(
          {
            ...request(),
            criteria: {
              ...request().criteria,
              revenueBasis:
                "RevenueFromContractWithCustomerExcludingAssessedTax",
            },
          },
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("keeps omitted and explicit agreement compatible but rejects silently selected legacy results", async () => {
    fetchMock.mockResolvedValueOnce(json(response()));
    expect(
      await screenPersonalFinancials(
        {
          ...request(),
          criteria: { ...request().criteria, revenueBasis: "agreement" },
        },
        signal(),
      ),
    ).not.toHaveProperty("revenueBasis");
    fetchMock.mockResolvedValueOnce(json(responseWithBasis("agreement")));
    expect(
      (await screenPersonalFinancials(request(), signal())).revenueBasis,
    ).toBe("agreement");
    fetchMock.mockResolvedValueOnce(json(responseWithBasis("Revenues")));
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "revenue",
    "netMargin",
    "operatingMargin",
    "operatingCashFlowMargin",
  ] as const)(
    "rejects a substituted revenue concept in selected %s sources",
    async (metric) => {
      const result = responseWithBasis("Revenues");
      const row = result.rows[0]!;
      fetchMock.mockResolvedValue(
        json({
          ...result,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                [metric]: {
                  ...row.metrics[metric],
                  sources: row.metrics[metric].sources.map((ref) =>
                    ref.concept === "Revenues"
                      ? { ...ref, concept: "SalesRevenueNet" }
                      : ref,
                  ),
                },
              },
            },
          ],
        }),
      );
      await expect(
        screenPersonalFinancials(
          {
            ...request(),
            criteria: { ...request().criteria, revenueBasis: "Revenues" },
          },
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("retains missing selected revenue and margins despite available alternative frames", async () => {
    const result = responseWithBasis("SalesRevenueNet");
    const row = result.rows[0]!;
    const affected = [
      "revenue",
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
    ] as const;
    const metrics = { ...row.metrics };
    const coverage = { ...result.metricCoverage };
    for (const metric of affected) {
      metrics[metric] = {
        status: "unavailable",
        reason: "missing",
        unit: metrics[metric].unit,
        sources: metrics[metric].sources.filter(
          (ref) => ref.concept !== "SalesRevenueNet",
        ),
      };
      coverage[metric] = { known: 0, unknown: 1 };
    }
    const missing = {
      ...result,
      rows: [{ ...row, metrics }],
      metricCoverage: coverage,
      sources: result.sources.map((frame) =>
        frame.concept === "SalesRevenueNet"
          ? { ...frame, status: "not_covered" as const }
          : frame,
      ),
    };
    fetchMock.mockResolvedValue(json(missing));
    const input = {
      ...request(),
      criteria: {
        ...request().criteria,
        revenueBasis: "SalesRevenueNet" as const,
      },
    };
    expect(await screenPersonalFinancials(input, signal())).toEqual(missing);
    fetchMock.mockResolvedValue(
      json({
        ...missing,
        rows: [
          { ...row, metrics: { ...metrics, netMargin: row.metrics.netMargin } },
        ],
      }),
    );
    await expect(
      screenPersonalFinancials(input, signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("keeps a selected basis on subsequent pages and rejects rollover", async () => {
    const input = {
      ...request(),
      criteria: { ...request().criteria, revenueBasis: "Revenues" as const },
      financialSnapshotSha256: sha("b"),
      page: { offset: 25, limit: 25 },
    };
    const result = { ...responseWithBasis("Revenues"), offset: 25, rows: [] };
    fetchMock.mockResolvedValueOnce(json(result));
    expect(await screenPersonalFinancials(input, signal())).toEqual(result);
    fetchMock.mockResolvedValueOnce(
      json({ ...result, revenueBasis: "agreement" }),
    );
    await expect(
      screenPersonalFinancials(input, signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([undefined, null, "totalRevenue", 1])(
    "rejects an explicit invalid criteria basis %s without fetching",
    async (basis) => {
      const input = {
        ...request(),
        criteria: { ...request().criteria, revenueBasis: basis },
      };
      expect(isPersonalFinancialScreenCriteria(input.criteria)).toBe(false);
      await expect(
        screenPersonalFinancials(
          input as PersonalFinancialScreenRequestDto,
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("uses only the loopback private request with exact decimal criteria", async () => {
    fetchMock.mockResolvedValue(json(response()));
    const input = request();
    expect(await screenPersonalFinancials(input, signal())).toEqual(response());
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/financial-screen",
      ),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: expect.any(AbortSignal) as unknown,
      }),
    );
  });

  it.each([
    [
      "extra data",
      (value: Record<string, unknown>) => ({ ...value, prices: [] }),
    ],
    [
      "mismatched catalog",
      (value: Record<string, unknown>) => ({
        ...value,
        catalogSnapshotSha256: sha("c"),
      }),
    ],
    [
      "mismatched year",
      (value: Record<string, unknown>) => ({ ...value, calendarYear: 2023 }),
    ],
    [
      "invalid counts",
      (value: Record<string, unknown>) => ({ ...value, totalUnknown: 1 }),
    ],
    [
      "wrong offset",
      (value: Record<string, unknown>) => ({ ...value, offset: 1, rows: [] }),
    ],
    [
      "truncated page",
      (value: Record<string, unknown>) => ({ ...value, rows: [] }),
    ],
    [
      "bad coverage",
      (value: Record<string, unknown>) => ({
        ...value,
        metricCoverage: {
          ...response().metricCoverage,
          netIncome: { known: 0, unknown: 0 },
        },
      }),
    ],
    [
      "arbitrary source URL",
      (value: Record<string, unknown>) => ({
        ...value,
        sources: response().sources.map((source) => ({
          ...source,
          sourceUrl: "https://evil.invalid/private",
        })),
      }),
    ],
    [
      "missing concept",
      (value: Record<string, unknown>) => ({
        ...value,
        sources: response().sources.slice(1),
      }),
    ],
    [
      "invalid expiry",
      (value: Record<string, unknown>) => ({
        ...value,
        expiresAt: "2026-01-01T00:00:00.000Z",
      }),
    ],
  ])("rejects %s before display", async (_name, corrupt) => {
    fetchMock.mockResolvedValue(json(corrupt({ ...response() })));
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    { status: "available", unit: "USD", value: "1e20", sources: [source()] },
    { status: "available", unit: "percent", value: "20", sources: [source()] },
    { status: "available", unit: "USD", value: "20", sources: [] },
    {
      status: "available",
      unit: "USD",
      value: "20",
      sources: [{ ...source(), accessionNumber: "../../x" }],
    },
    { status: "unavailable", unit: "USD", reason: "secret-error", sources: [] },
    {
      status: "unavailable",
      unit: "USD",
      reason: "missing",
      sources: [],
      value: "0",
    },
  ])("rejects malformed financial cells %#", async (cell) => {
    const result = response();
    fetchMock.mockResolvedValue(
      json({
        ...result,
        rows: result.rows.map((row) => ({
          ...row,
          metrics: { ...row.metrics, revenue: cell },
        })),
      }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("preserves missing facts and signed decimal values", async () => {
    const result = response();
    const row = result.rows[0]!;
    const changed = {
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            netIncome: {
              status: "unavailable",
              reason: "missing",
              unit: "USD",
              sources: [],
            },
            operatingCashFlow: {
              status: "available",
              value: "-123456789.123456",
              unit: "USD",
              sources: [source()],
            },
          },
        },
      ],
      metricCoverage: {
        ...result.metricCoverage,
        netIncome: { known: 0, unknown: 1 },
      },
    };
    fetchMock.mockResolvedValue(json(changed));
    expect(
      (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics,
    ).toMatchObject(changed.rows[0]?.metrics ?? {});
  });

  it("pins subsequent pages and rejects silent snapshot rollover", async () => {
    const input = {
      ...request(),
      financialSnapshotSha256: sha("b"),
      page: { offset: 25, limit: 25 },
    };
    const result = {
      ...response(),
      offset: 25,
      rows: [],
      financialSnapshotSha256: sha("c"),
    };
    fetchMock.mockResolvedValue(json(result));
    await expect(
      screenPersonalFinancials(input, signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    { ...request(), refresh: true, financialSnapshotSha256: sha("b") },
    { ...request(), page: { offset: 25, limit: 25 } },
    {
      ...request(),
      criteria: {
        ...request().criteria,
        calendarYear: new Date().getUTCFullYear(),
      },
    },
    {
      ...request(),
      criteria: {
        ...request().criteria,
        clauses: Array.from({ length: 8 }, () => ({
          field: "revenue",
          operator: "gte",
          value: "1",
        })),
      },
    },
    {
      ...request(),
      criteria: {
        ...request().criteria,
        clauses: [{ field: "revenue", operator: "gte", value: "" }],
      },
    },
  ])("rejects invalid requests without fetching %#", async (input) => {
    await expect(
      screenPersonalFinancials(
        input as PersonalFinancialScreenRequestDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates whole criteria and a completed year without rewriting numeric precision", () => {
    const criteria = {
      ...request().criteria,
      calendarYear: 2009,
      clauses: [{ field: "netMargin", operator: "gte", value: "-0.000000001" }],
    };
    expect(isPersonalFinancialScreenCriteria(criteria)).toBe(true);
    expect(
      isPersonalFinancialScreenCriteria({ ...criteria, calendarYear: 2008 }),
    ).toBe(false);
    expect(
      isPersonalFinancialScreenCriteria({
        ...criteria,
        identityText: "\u202eAAPL",
      }),
    ).toBe(false);
  });

  it.each([
    [403, {}, "session_unavailable"],
    [409, {}, "conflict"],
    [429, {}, "rate_limited"],
    [502, {}, "provider_unavailable"],
    [503, { code: "not_configured" }, "not_configured"],
    [503, {}, "unavailable"],
  ])(
    "maps API status %s without displaying private errors",
    async (status, body, code) => {
      fetchMock.mockResolvedValue(json(body, status));
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code });
    },
  );

  it("handles malformed JSON and a controlling service worker", async () => {
    fetchMock.mockResolvedValue(new Response("{", { status: 200 }));
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockClear();
    vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("saved financial criteria", () => {
  it("preserves old saved definitions and numeric schema 1 beside an explicit gross-profit screen", async () => {
    const legacy = savedPayload().views[0]!;
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        legacy,
        {
          ...legacy,
          id: "screen-gross-profit",
          name: "Reported gross profit",
          criteria: {
            ...legacy.criteria,
            clauses: [
              { field: "grossProfit", operator: "gte", value: "-10.001" },
            ],
            sort: { field: "grossProfit", direction: "desc" },
          },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(json({ ...record(), payload }));
    expect((await fetchPersonalFinancialSavedViews(signal()))?.payload).toEqual(
      payload,
    );
    fetchMock.mockResolvedValueOnce(json(receipt(2)));
    const saved = await savePersonalFinancialSavedViews(1, payload, signal());
    expect(saved).toEqual({ version: 2, payload });
    expect(saved.payload.views[0]).toEqual(legacy);
    expect(saved.payload.views[0]?.criteria).not.toHaveProperty("revenueBasis");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ payload }),
    );
  });

  it("round-trips mixed legacy and explicit-basis views without adding defaults", async () => {
    const legacy = savedPayload().views[0]!;
    const payload = {
      ...savedPayload(),
      views: [
        legacy,
        {
          ...legacy,
          id: "screen-broad",
          name: "Broad revenue",
          criteria: { ...legacy.criteria, revenueBasis: "Revenues" as const },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(json({ ...record(), payload }));
    const loaded = await fetchPersonalFinancialSavedViews(signal());
    expect(loaded?.payload).toEqual(payload);
    expect(loaded?.payload.views[0]?.criteria).not.toHaveProperty(
      "revenueBasis",
    );
    fetchMock.mockResolvedValueOnce(json(receipt(2)));
    expect(
      (await savePersonalFinancialSavedViews(1, payload, signal())).payload,
    ).toEqual(payload);
    const corrupt = {
      ...payload,
      views: [
        {
          ...legacy,
          criteria: { ...legacy.criteria, revenueBasis: "automatic" },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(json({ ...record(), payload: corrupt }));
    await expect(
      fetchPersonalFinancialSavedViews(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockClear();
    await expect(
      savePersonalFinancialSavedViews(
        1,
        corrupt as PersonalFinancialSavedViewsPayloadDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads only the admitted settings record and treats missing records as empty", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json(record()));
    expect(await fetchPersonalFinancialSavedViews(signal())).toBeNull();
    expect(await fetchPersonalFinancialSavedViews(signal())).toEqual({
      version: 1,
      payload: savedPayload(),
    });
  });

  it.each([0, 3])(
    "saves with version %s, intent, idempotency and criteria-only payload",
    async (version) => {
      fetchMock.mockResolvedValue(
        json(receipt(version + 1), version === 0 ? 201 : 200),
      );
      const payload = savedPayload();
      const saved = await savePersonalFinancialSavedViews(
        version,
        payload,
        signal(),
      );
      expect(saved).toEqual({ version: version + 1, payload });
      expect(saved.payload).not.toBe(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        new URL(
          "http://127.0.0.1:3100/v1/personal-filing/workspace/financial-screen/saved-views",
        ),
        expect.objectContaining({
          body: JSON.stringify({ payload }),
          headers: expect.objectContaining({
            ...(version === 0
              ? { "If-None-Match": "*" }
              : { "If-Match": `"v${String(version)}"` }),
            "X-Research-Cockpit-Intent":
              version === 0 ? "personal-vault-create" : "personal-vault-update",
            "X-Research-Cockpit-Idempotency-Key":
              "financial-screen-11111111-2222-4333-8444-555555555555",
          }) as unknown,
        }),
      );
    },
  );

  it("rejects financial result storage, duplicate names, and excess definitions", async () => {
    const payload = savedPayload();
    for (const invalid of [
      { ...payload, rows: response().rows },
      {
        ...payload,
        views: [
          ...payload.views,
          { ...payload.views[0], id: "screen-other", name: "PROFITABLE" },
        ],
      },
      {
        ...payload,
        views: Array.from({ length: 21 }, (_, index) => ({
          ...payload.views[0],
          id: `screen-${String(index)}`,
          name: `Screen ${String(index)}`,
        })),
      },
    ])
      await expect(
        savePersonalFinancialSavedViews(
          0,
          invalid as PersonalFinancialSavedViewsPayloadDto,
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects wrong record IDs, extra payload fields, and mismatched receipts", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ ...record(), id: "stock-screener-saved-views" }),
      )
      .mockResolvedValueOnce(
        json({ ...record(), payload: { ...savedPayload(), metrics: {} } }),
      )
      .mockResolvedValueOnce(json(receipt(2), 201));
    await expect(
      fetchPersonalFinancialSavedViews(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    await expect(
      fetchPersonalFinancialSavedViews(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    await expect(
      savePersonalFinancialSavedViews(0, savedPayload(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function request(): PersonalFinancialScreenRequestDto {
  return {
    schemaVersion: "2.0.0",
    catalogSnapshotSha256: sha("a"),
    financialSnapshotSha256: null,
    criteria: {
      calendarYear: 2024,
      identityText: "",
      clauses: [{ field: "revenue", operator: "gte", value: "1000000000.01" }],
      sort: { field: "revenue", direction: "desc" },
    },
    page: { offset: 0, limit: 25 },
    refresh: false,
  };
}
function source() {
  return {
    concept: "Revenues" as const,
    accessionNumber: "0000000001-25-000001",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    value: "2000000000",
  };
}
function response(): PersonalFinancialScreenResponseDto {
  return {
    schemaVersion: "2.0.0",
    catalogSnapshotSha256: sha("a"),
    financialSnapshotSha256: sha("b"),
    calendarYear: 2024,
    fetchedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:30:00.000Z",
    sources: PERSONAL_SEC_ANNUAL_CONCEPTS.map((concept) => ({
      concept,
      status: "available",
      sourceUrl: personalFinancialSourceUrl(concept, 2024),
    })),
    rows: [
      {
        identity: {
          cik: "0000000001",
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "issuer-one",
          issuerName: "Example One",
          listingId: "listing-one",
          securityId: "security-one",
          securityName: "Example One Common Stock",
          shareClassId: "class-one",
          shareClassName: "Common",
          symbol: "ONE",
        },
        metrics: Object.fromEntries(
          PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => [
            metric,
            {
              status: "available",
              value: "2000000000",
              unit: metric.endsWith("Margin") ? "percent" : "USD",
              sources: [
                {
                  ...source(),
                  concept:
                    metric === "grossProfit" ? "GrossProfit" : "Revenues",
                },
              ],
            },
          ]),
        ) as unknown as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
      },
    ],
    totalUniverse: 3,
    identityMatches: 1,
    totalMatches: 1,
    totalNonMatches: 0,
    totalUnknown: 0,
    metricCoverage: Object.fromEntries(
      PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => [
        metric,
        { known: 1, unknown: 0 },
      ]),
    ) as PersonalFinancialScreenResponseDto["metricCoverage"],
    offset: 0,
    limitApplied: 25,
    hasMore: false,
    formulaVersion: "1.0.0",
  };
}
function responseWithBasis(
  basis: PersonalFinancialRevenueBasisDto,
): PersonalFinancialScreenResponseDto {
  const result = response();
  if (basis === "agreement") return { ...result, revenueBasis: basis };
  const ref = (concept: (typeof PERSONAL_SEC_ANNUAL_CONCEPTS)[number]) => ({
    ...source(),
    concept,
  });
  return {
    ...result,
    revenueBasis: basis,
    rows: result.rows.map((row) => ({
      ...row,
      metrics: {
        revenue: { ...row.metrics.revenue, sources: [ref(basis)] },
        grossProfit: row.metrics.grossProfit,
        netIncome: {
          ...row.metrics.netIncome,
          sources: [ref("NetIncomeLoss")],
        },
        operatingIncome: {
          ...row.metrics.operatingIncome,
          sources: [ref("OperatingIncomeLoss")],
        },
        operatingCashFlow: {
          ...row.metrics.operatingCashFlow,
          sources: [ref("NetCashProvidedByUsedInOperatingActivities")],
        },
        netMargin: {
          ...row.metrics.netMargin,
          sources: [ref("NetIncomeLoss"), ref(basis)],
        },
        operatingMargin: {
          ...row.metrics.operatingMargin,
          sources: [ref("OperatingIncomeLoss"), ref(basis)],
        },
        operatingCashFlowMargin: {
          ...row.metrics.operatingCashFlowMargin,
          sources: [
            ref("NetCashProvidedByUsedInOperatingActivities"),
            ref(basis),
          ],
        },
      },
    })),
  };
}
// Keep the pre-GrossProfit transport shape literal; current enums must not widen it.
function historicalResponse() {
  const result = response();
  const row = result.rows[0]!;
  return {
    ...result,
    schemaVersion: "1.0.0",
    sources: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
      "OperatingIncomeLoss",
      "NetCashProvidedByUsedInOperatingActivities",
    ].map((concept) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2024.json`,
    })),
    rows: [
      {
        ...row,
        metrics: {
          revenue: row.metrics.revenue,
          netIncome: row.metrics.netIncome,
          operatingIncome: row.metrics.operatingIncome,
          operatingCashFlow: row.metrics.operatingCashFlow,
          netMargin: row.metrics.netMargin,
          operatingMargin: row.metrics.operatingMargin,
          operatingCashFlowMargin: row.metrics.operatingCashFlowMargin,
        },
      },
    ],
    metricCoverage: {
      revenue: { known: 1, unknown: 0 },
      netIncome: { known: 1, unknown: 0 },
      operatingIncome: { known: 1, unknown: 0 },
      operatingCashFlow: { known: 1, unknown: 0 },
      netMargin: { known: 1, unknown: 0 },
      operatingMargin: { known: 1, unknown: 0 },
      operatingCashFlowMargin: { known: 1, unknown: 0 },
    },
  };
}
function savedPayload(): PersonalFinancialSavedViewsPayloadDto {
  return {
    schemaVersion: 1,
    views: [
      {
        id: "screen-profitable",
        name: "Profitable",
        criteria: request().criteria,
        createdAgainstCatalogSnapshotSha256: sha("a"),
        createdAgainstFinancialSnapshotSha256: sha("b"),
      },
    ],
  };
}
function record() {
  return {
    id: "financial-screener-saved-views",
    kind: "settings",
    profile: "personal_single_user_local_vault",
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    payloadSha256: "a".repeat(64),
    payload: savedPayload(),
  };
}
function receipt(version: number) {
  return {
    committedAt: "2026-09-01T00:00:00.000Z",
    digestSha256: "a".repeat(64),
    id: "financial-screener-saved-views",
    kind: "settings",
    operation: "put",
    profile: "personal_single_user_local_vault",
    replayed: false,
    version,
  };
}
