import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  PERSONAL_SEC_INSTANT_CONCEPTS,
  type PersonalFinancialScreenInstantCellDto,
  type PersonalFinancialScreenInstantSourceRefDto,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialScreenAnnualCellDto,
  type PersonalFinancialScreenGrowthCellDto,
  type PersonalFinancialScreenSourceRefDto,
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

describe("selected revenue year-over-year decoding", () => {
  const missing: PersonalFinancialScreenAnnualCellDto = {
    status: "unavailable",
    unit: "USD",
    reason: "missing",
    sources: [],
  };
  const dates = (
    cell: PersonalFinancialScreenAnnualCellDto,
    startDate: string,
    endDate: string,
  ): PersonalFinancialScreenAnnualCellDto => ({
    ...cell,
    sources: cell.sources.map((source) => ({ ...source, startDate, endDate })),
  });
  const current = () => growthOperand(2024, "110");
  const prior = () => growthOperand(2023, "100");
  const decode = async (result: PersonalFinancialScreenResponseDto) => {
    fetchMock.mockResolvedValueOnce(json(result));
    return screenPersonalFinancials(
      {
        ...request(),
        criteria: {
          ...request().criteria,
          calendarYear: result.calendarYear,
          revenueBasis: result.revenueBasis ?? "agreement",
        },
      },
      signal(),
    );
  };
  const corrupt = (
    result: PersonalFinancialScreenResponseDto,
    change: (value: Record<string, unknown>) => void,
  ) => {
    const clone = structuredClone(result) as unknown as {
      rows: { metrics: { revenueGrowth: Record<string, unknown> } }[];
    };
    change(clone.rows[0]!.metrics.revenueGrowth);
    return clone as unknown as PersonalFinancialScreenResponseDto;
  };

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "retains both operands for explicit basis %s",
    async (basis) => {
      const selected =
        basis === "agreement"
          ? ([
              "Revenues",
              "RevenueFromContractWithCustomerExcludingAssessedTax",
              "SalesRevenueNet",
            ] as const)
          : [basis];
      const result = growthResponse(
        growthOperand(2024, "110", selected),
        growthOperand(2023, "100", selected),
        "10.00",
        basis,
      );
      expect(await decode(result)).toEqual(result);
      expect(
        result.rows[0]!.metrics.revenueGrowth.sources.map(
          (source) => source.role,
        ),
      ).toEqual([
        ...selected.map(() => "current_revenue"),
        ...selected.map(() => "prior_revenue"),
      ]);
      expect(result.sources).toHaveLength(10);
      expect(result.priorRevenueSources).toHaveLength(3);
    },
  );

  it.each([
    ["101", "100", "1.00"],
    ["100.005", "100", "0.01"],
    ["99.995", "100", "-0.01"],
    ["99.996", "100", "0.00"],
    ["199.995", "100", "100.00"],
    ["0", "100", "-100.00"],
    ["-0.000", "100", "-100.00"],
    ["-50", "100", "-150.00"],
    ["1.000000", "1", "0.00"],
    ["9007199254740993", "1", "900719925474099200.00"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${((10n ** 64n - 1n) * 10n ** 64n - 100n).toString()}.00`,
    ],
    [
      `-${"9".repeat(63)}`,
      `0.${"0".repeat(61)}1`,
      `-${((10n ** 63n - 1n) * 10n ** 64n + 100n).toString()}.00`,
    ],
  ])("independently checks %s against %s as %s", async (c, p, expected) => {
    const result = growthResponse(
      growthOperand(2024, c),
      growthOperand(2023, p),
      expected,
    );
    expect(await decode(result)).toEqual(result);
    // Full-width positive and negative inputs reach 131 characters without overflowing that bound.
    if (p.length === 64) expect(expected).toHaveLength(131);
    for (const value of [
      expected === "0.00" ? "-0.00" : `${expected}0`,
      "123.45",
      "1e2",
    ])
      await expect(
        decode(
          corrupt(result, (cell) => {
            cell.value = value;
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    ["2022-12-31", "2023-12-29", "2023-12-30", "2025-01-03"],
    ["2023-01-01", "2023-12-31", "2024-01-01", "2024-12-31"],
  ])(
    "accepts actual adjacent periods %s–%s then %s–%s",
    async (ps, pe, cs, ce) => {
      const result = growthResponse(
        dates(current(), cs, ce),
        dates(prior(), ps, pe),
        "10.00",
      );
      expect(await decode(result)).toEqual(result);
    },
  );

  it.each([
    ["prior_unavailable", missing, missing],
    ["current_unavailable", missing, prior()],
    ["period_mismatch", dates(current(), "2024-10-01", "2024-12-31"), prior()],
    ["period_mismatch", dates(current(), "2020-01-01", "2020-12-31"), prior()],
    [
      "concept_set_changed",
      growthOperand(2024, "110", ["Revenues", "SalesRevenueNet"]),
      prior(),
    ],
    [
      "nonadjacent_periods",
      dates(current(), "2023-12-31", "2024-12-31"),
      prior(),
    ],
    [
      "nonadjacent_periods",
      dates(current(), "2024-01-02", "2024-12-31"),
      prior(),
    ],
    ["nonpositive_prior_revenue", current(), growthOperand(2023, "0")],
    ["nonpositive_prior_revenue", current(), growthOperand(2023, "-1")],
  ] as const)(
    "reconstructs %s from the complete operands",
    async (reason, c, p) => {
      const result = growthResponse(c, p, reason);
      expect(await decode(result)).toEqual(result);
      await expect(
        decode(
          corrupt(result, (cell) => {
            cell.reason =
              reason === "prior_unavailable"
                ? "current_unavailable"
                : "prior_unavailable";
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
      await expect(
        decode(
          corrupt(result, (cell) => {
            delete cell.reason;
            cell.status = "available";
            cell.value = "10.00";
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("retains a one-day prior reference only with the independently verified period mismatch", async () => {
    const oneDayPrior = dates(prior(), "2023-12-31", "2023-12-31");
    const result = growthResponse(current(), oneDayPrior, "period_mismatch");
    expect(await decode(result)).toEqual(result);
    await expect(
      decode(growthResponse(current(), oneDayPrior, "10.00")),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("checks later filings within each year, without requiring cross-year accession equality", async () => {
    const c = {
      ...current(),
      sources: [
        ...current().sources,
        { ...current().sources[0]!, accessionNumber: "0000000001-25-000002" },
      ],
    };
    const p = {
      ...prior(),
      sources: [
        ...prior().sources,
        { ...prior().sources[0]!, accessionNumber: "0000000001-24-000002" },
      ],
    };
    for (const [left, right] of [
      [c, prior()],
      [current(), p],
      [c, p],
    ]) {
      const result = growthResponse(left!, right!, "filing_mismatch");
      expect(await decode(result)).toEqual(result);
      await expect(
        decode(growthResponse(left!, right!, "10.00")),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
    expect(
      await decode(growthResponse(current(), prior(), "10.00")),
    ).toMatchObject({
      rows: [{ metrics: { revenueGrowth: { status: "available" } } }],
    });
  });

  it("preserves unavailable, period, concept, adjacency and prior-sign precedence before filing mismatch", async () => {
    const mixed = (cell: PersonalFinancialScreenAnnualCellDto) => ({
      ...cell,
      sources: [
        ...cell.sources,
        { ...cell.sources[0]!, accessionNumber: "0000000001-25-000002" },
      ],
    });
    const changed = growthOperand(2024, "110", ["Revenues", "SalesRevenueNet"]);
    const cases = [
      growthResponse(
        dates(mixed(current()), "2024-10-01", "2024-12-31"),
        missing,
        "prior_unavailable",
      ),
      growthResponse(missing, mixed(prior()), "current_unavailable"),
      growthResponse(
        dates(mixed(changed), "2024-10-01", "2024-12-31"),
        prior(),
        "period_mismatch",
      ),
      growthResponse(
        dates(mixed(changed), "2024-01-02", "2024-12-31"),
        prior(),
        "concept_set_changed",
      ),
      growthResponse(
        dates(mixed(current()), "2024-01-02", "2024-12-31"),
        growthOperand(2023, "0"),
        "nonadjacent_periods",
      ),
      growthResponse(
        mixed(current()),
        growthOperand(2023, "0"),
        "nonpositive_prior_revenue",
      ),
    ];
    for (const result of cases) expect(await decode(result)).toEqual(result);
  });

  it("requires all twelve role-tagged references with exact multiplicity and permits order changes", async () => {
    const repeated = (cell: PersonalFinancialScreenAnnualCellDto) => ({
      ...cell,
      sources: Array.from({ length: 6 }, () => ({ ...cell.sources[0]! })),
    });
    const result = growthResponse(
      repeated(current()),
      repeated(prior()),
      "10.00",
    );
    expect(
      await decode(
        corrupt(result, (cell) => {
          cell.sources = [...(cell.sources as unknown[])].reverse();
        }),
      ),
    ).toBeDefined();
    for (const change of [
      (refs: unknown[]) => refs.slice(1),
      (refs: unknown[]) => [...refs, refs[0]],
      (refs: unknown[]) => [...refs.slice(0, 11), refs[0]],
    ])
      await expect(
        decode(
          corrupt(result, (cell) => {
            cell.sources = change(cell.sources as unknown[]);
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "current role",
    "prior role",
    "current year",
    "prior year",
    "concept",
    "accession",
    "value",
    "date",
    "instant date",
    "extra key",
  ])("rejects forged tagged source %s", async (kind) => {
    const result = corrupt(
      growthResponse(current(), prior(), "10.00"),
      (cell) => {
        const refs = cell.sources as Record<string, unknown>[];
        const ref = kind.startsWith("prior") ? refs[1]! : refs[0]!;
        if (kind === "current role") ref.role = "prior_revenue";
        if (kind === "prior role") ref.role = "current_revenue";
        if (kind.endsWith("year")) ref.calendarYear = 2022;
        if (kind === "concept") ref.concept = "GrossProfit";
        if (kind === "accession") ref.accessionNumber = "0000000001-25-000002";
        if (kind === "value") ref.value = "111";
        if (kind === "date") ref.endDate = "2024-02-30";
        if (kind === "instant date") {
          ref.asOfDate = ref.endDate;
          delete ref.startDate;
          delete ref.endDate;
        }
        if (kind === "extra key") ref.sourceUrl = "https://example.test";
      },
    );
    await expect(decode(result)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([
    "current mismatch",
    "prior value mismatch",
    "later date",
    "later value",
    "USD unit",
    "overlong value",
    "empty available",
    "invalid_value",
    "missing with refs",
    "extra operand key",
  ])(
    "rejects forged operand %s even with matching tagged references",
    async (kind) => {
      const result = corrupt(
        growthResponse(current(), prior(), "10.00"),
        (cell) => {
          const operand = (
            kind === "current mismatch"
              ? cell.currentRevenue
              : cell.priorRevenue
          ) as Record<string, unknown>;
          if (kind === "current mismatch" || kind === "prior value mismatch")
            operand.value = "101";
          if (kind === "current mismatch")
            operand.sources = (
              operand.sources as Record<string, unknown>[]
            ).map((ref) => ({ ...ref, value: "101" }));
          if (kind.startsWith("later")) {
            const refs = operand.sources as Record<string, unknown>[];
            refs.push({
              ...refs[0],
              ...(kind === "later date"
                ? { startDate: "2023-01-02" }
                : { value: "101" }),
            });
          }
          if (kind === "USD unit") operand.unit = "percent";
          if (kind === "overlong value") operand.value = "9".repeat(65);
          if (kind === "empty available") operand.sources = [];
          if (kind === "invalid_value" || kind === "missing with refs") {
            operand.status = "unavailable";
            operand.reason =
              kind === "invalid_value" ? "invalid_value" : "missing";
            delete operand.value;
            delete cell.value;
            cell.status = "unavailable";
            cell.reason = "prior_unavailable";
          }
          if (kind === "extra operand key") operand.calendarYear = 2023;
          cell.sources = growthSources(
            cell.currentRevenue as PersonalFinancialScreenAnnualCellDto,
            cell.priorRevenue as PersonalFinancialScreenAnnualCellDto,
          );
        },
      );
      await expect(decode(result)).rejects.toMatchObject({
        code: "invalid_response",
      });
    },
  );

  it.each(["current", "prior"] as const)(
    "binds %s source failure, conflict and404 semantics independently",
    async (role) => {
      const sourceKey = role === "current" ? "sources" : "priorRevenueSources";
      for (const status of [
        "rate_limited",
        "upstream_unavailable",
        "invalid_response",
      ] as const) {
        const failed: PersonalFinancialScreenAnnualCellDto = {
          status: "unavailable",
          unit: "USD",
          reason: "source_unavailable",
          sources: role === "current" ? current().sources : prior().sources,
        };
        const result = growthResponse(
          role === "current" ? failed : current(),
          role === "prior" ? failed : prior(),
          role === "current" ? "current_unavailable" : "prior_unavailable",
        );
        const payload = {
          ...result,
          [sourceKey]: result[sourceKey].map((source) =>
            source.concept === "SalesRevenueNet"
              ? { ...source, status }
              : source,
          ),
        };
        expect(await decode(payload)).toEqual(payload);
        await expect(decode(result)).rejects.toMatchObject({
          code: "invalid_response",
        });
        const forged = growthResponse(current(), prior(), "10.00");
        await expect(
          decode({ ...forged, [sourceKey]: payload[sourceKey] }),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
      const agreement = growthResponse(current(), prior(), "10.00");
      const sources404 = agreement[sourceKey].map((source) =>
        source.concept === "SalesRevenueNet"
          ? { ...source, status: "not_covered" as const }
          : source,
      );
      expect(
        await decode({ ...agreement, [sourceKey]: sources404 }),
      ).toBeDefined();
      const explicit = growthResponse(
        role === "current"
          ? missing
          : growthOperand(2024, "110", ["SalesRevenueNet"]),
        role === "prior"
          ? missing
          : growthOperand(2023, "100", ["SalesRevenueNet"]),
        role === "current" ? "current_unavailable" : "prior_unavailable",
        "SalesRevenueNet",
      );
      expect(
        await decode({ ...explicit, [sourceKey]: sources404 }),
      ).toBeDefined();
      const conflict: PersonalFinancialScreenAnnualCellDto = {
        ...missing,
        reason: "conflicting",
      };
      expect(
        await decode(
          growthResponse(
            role === "current" ? conflict : current(),
            role === "prior" ? conflict : prior(),
            role === "current" ? "current_unavailable" : "prior_unavailable",
          ),
        ),
      ).toBeDefined();
    },
  );

  it.each([
    "wrong prior year",
    "missing prior year",
    "missing prior collection",
    "extra prior source",
    "duplicate prior source",
    "prior instant concept",
    "wrong prior URL",
    "current URL swapped",
    "old version",
    "old formula",
    "wrong unit",
    "extra growth key",
  ])("rejects malformed growth transport: %s", async (kind) => {
    const result = structuredClone(
      growthResponse(current(), prior(), "10.00"),
    ) as unknown as Record<string, unknown>;
    const sources = result.priorRevenueSources as Record<string, unknown>[];
    if (kind === "wrong prior year") result.priorCalendarYear = 2024;
    if (kind === "missing prior year") delete result.priorCalendarYear;
    if (kind === "missing prior collection") delete result.priorRevenueSources;
    if (kind === "extra prior source") sources.push({ ...sources[0] });
    if (kind === "duplicate prior source") sources[1] = { ...sources[0] };
    if (kind === "prior instant concept") sources[0]!.concept = "AssetsCurrent";
    if (kind === "wrong prior URL")
      sources[0]!.sourceUrl = String(sources[0]!.sourceUrl).replace(
        "2023",
        "2024",
      );
    if (kind === "current URL swapped")
      (result.sources as Record<string, unknown>[])[0]!.sourceUrl =
        personalFinancialSourceUrl(
          "RevenueFromContractWithCustomerExcludingAssessedTax",
          2023,
        );
    if (kind === "old version") result.schemaVersion = "6.0.0";
    if (kind === "old formula") result.formulaVersion = "1.4.0";
    const growth = (
      result.rows as { metrics: { revenueGrowth: Record<string, unknown> } }[]
    )[0]!.metrics.revenueGrowth;
    if (kind === "wrong unit") growth.unit = "USD";
    if (kind === "extra growth key") growth.debug = "extra";
    await expect(
      decode(result as unknown as PersonalFinancialScreenResponseDto),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("keeps saved-v1 year2009 criteria valid and admits the derived CY2008 comparison", async () => {
    const result = growthResponse(
      growthOperand(2009, "110"),
      growthOperand(2008, "100"),
      "10.00",
      "agreement",
      2009,
    );
    expect(await decode(result)).toEqual(result);
    const oldPayload = savedPayload();
    const payload = {
      ...oldPayload,
      views: oldPayload.views.map((view) => ({
        ...view,
        criteria: {
          ...view.criteria,
          calendarYear: 2009,
          clauses: [
            { field: "revenueGrowth", operator: "gte", value: "-100.00" },
          ],
          sort: { field: "revenueGrowth", direction: "asc" },
        },
      })),
    } as const;
    expect(isPersonalFinancialScreenCriteria(payload.views[0]!.criteria)).toBe(
      true,
    );
    fetchMock.mockResolvedValueOnce(json({ ...record(), payload }));
    expect(await fetchPersonalFinancialSavedViews(signal())).toEqual({
      version: 1,
      payload,
    });
    fetchMock.mockResolvedValueOnce(json(record()));
    expect((await fetchPersonalFinancialSavedViews(signal()))?.payload).toEqual(
      oldPayload,
    );
  });
});

describe("current assets less current liabilities decoding", () => {
  const decode = async (value: unknown) => {
    fetchMock.mockResolvedValueOnce(json(value));
    return screenPersonalFinancials(request(), signal());
  };
  const change = (
    result: PersonalFinancialScreenResponseDto,
    patch: Record<string, unknown>,
  ) => {
    const copy = structuredClone(result);
    Object.assign(
      copy.rows[0]!.metrics.currentAssetsLessCurrentLiabilities,
      patch,
    );
    return copy;
  };

  it.each([
    ["200", "100", "100", "2.00"],
    ["100", "125", "-25", "0.80"],
    ["100.00", "100", "0", "1.00"],
    ["1.2", "0.02", "1.18", "60.00"],
    ["9007199254740993", "9007199254740992", "1", "1.00"],
    ["7", "0", "7", null],
    ["-0.00", "0", "0", null],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(63)}8.${"9".repeat(62)}`,
      `${"9".repeat(64)}${"0".repeat(62)}.00`,
    ],
    [
      `0.${"0".repeat(61)}1`,
      "9".repeat(64),
      `-${"9".repeat(63)}8.${"9".repeat(62)}`,
      "0.00",
    ],
  ])(
    "independently checks %s less %s as %s",
    async (assets, liabilities, expected, ratio) => {
      const result = currentResponse(
        instantOperand("AssetsCurrent", assets),
        instantOperand("LiabilitiesCurrent", liabilities),
        ratio ?? null,
        "nonpositive_current_liabilities",
      );
      expect(
        result.rows[0]!.metrics.currentAssetsLessCurrentLiabilities,
      ).toMatchObject({ status: "available", value: expected, unit: "USD" });
      expect(await decode(result)).toEqual(result);
      for (const value of [
        "123.45",
        `${expected}.0`,
        expected === "0" ? "-0" : "0",
      ]) {
        await expect(decode(change(result, { value }))).rejects.toMatchObject({
          code: "invalid_response",
        });
      }
    },
  );

  it("uses asset-first unavailability, then date, filing and either operand sign", async () => {
    const missing: PersonalFinancialScreenInstantCellDto = {
      status: "unavailable",
      unit: "USD",
      reason: "missing",
      sources: [],
    };
    const conflict = { ...missing, reason: "conflicting" as const };
    const assets = instantOperand("AssetsCurrent", "-1");
    const liabilities = instantOperand("LiabilitiesCurrent", "-2");
    const laterFiling = {
      ...assets,
      sources: [
        ...assets.sources,
        { ...assets.sources[0]!, accessionNumber: "0000000001-25-000002" },
      ],
    };
    const cases = [
      [currentResponse(conflict, missing, null, "missing"), "conflicting"],
      [
        currentResponse(
          instantOperand("AssetsCurrent", "1"),
          missing,
          null,
          "missing",
        ),
        "missing",
      ],
      [
        currentResponse(
          instantOperand("AssetsCurrent", "-1", "2024-12-30"),
          liabilities,
          null,
          "balance_date_mismatch",
        ),
        "balance_date_mismatch",
      ],
      [
        currentResponse(laterFiling, liabilities, null, "filing_mismatch"),
        "filing_mismatch",
      ],
      [
        currentResponse(
          assets,
          instantOperand("LiabilitiesCurrent", "1"),
          null,
          "unsupported_sign",
        ),
        "unsupported_sign",
      ],
      [
        currentResponse(
          instantOperand("AssetsCurrent", "1"),
          liabilities,
          null,
          "nonpositive_current_liabilities",
        ),
        "unsupported_sign",
      ],
    ] as const;
    for (const [result, reason] of cases) {
      expect(
        result.rows[0]!.metrics.currentAssetsLessCurrentLiabilities,
      ).toMatchObject({ status: "unavailable", reason });
      expect(await decode(result)).toEqual(result);
      await expect(
        decode(
          change(result, {
            reason: reason === "missing" ? "conflicting" : "missing",
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
      await expect(
        decode(change(result, { reason: "nonpositive_current_liabilities" })),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("requires the exact complete source multiset and USD unit without depending on source order", async () => {
    const assets = instantOperand("AssetsCurrent", "100");
    const liabilities = instantOperand("LiabilitiesCurrent", "80");
    const repeat = (cell: PersonalFinancialScreenInstantCellDto) => ({
      ...cell,
      sources: Array.from({ length: 6 }, () => ({ ...cell.sources[0]! })),
    });
    const result = currentResponse(repeat(assets), repeat(liabilities), "1.25");
    const refs =
      result.rows[0]!.metrics.currentAssetsLessCurrentLiabilities.sources;
    expect(
      await decode(change(result, { sources: [...refs].reverse() })),
    ).toBeDefined();
    for (const sources of [
      refs.slice(1),
      [...refs, refs[0]],
      [...refs.slice(0, 11), refs[0]],
      refs.map((ref, index) =>
        index === 0 ? { ...ref, value: "100.0" } : ref,
      ),
      refs.map((ref, index) =>
        index === 11 ? { ...ref, asOfDate: "2024-12-30" } : ref,
      ),
    ]) {
      await expect(decode(change(result, { sources }))).rejects.toMatchObject({
        code: "invalid_response",
      });
    }
    for (const unit of ["multiple", "percent"])
      await expect(decode(change(result, { unit }))).rejects.toMatchObject({
        code: "invalid_response",
      });
  });

  it("rejects v7 transport/formula and omitted new metric or coverage", async () => {
    for (const field of [
      "schemaVersion",
      "formulaVersion",
      "metric",
      "coverage",
    ]) {
      const result = structuredClone(response()) as unknown as Record<
        string,
        unknown
      >;
      if (field === "schemaVersion") result.schemaVersion = "7.0.0";
      if (field === "formulaVersion") result.formulaVersion = "1.5.0";
      if (field === "metric")
        delete (result.rows as { metrics: Record<string, unknown> }[])[0]!
          .metrics.currentAssetsLessCurrentLiabilities;
      if (field === "coverage")
        delete (result.metricCoverage as Record<string, unknown>)
          .currentAssetsLessCurrentLiabilities;
      await expect(decode(result)).rejects.toMatchObject({
        code: "invalid_response",
      });
    }
  });

  it("round-trips signed balance criteria under saved payload v1 while preserving legacy criteria", async () => {
    const legacy = savedPayload().views[0]!;
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        legacy,
        {
          ...legacy,
          id: "balance-shortfall",
          name: "Balance shortfall",
          criteria: {
            ...legacy.criteria,
            clauses: [
              {
                field: "currentAssetsLessCurrentLiabilities",
                operator: "lte",
                value: "-0.01",
              },
            ],
            sort: {
              field: "currentAssetsLessCurrentLiabilities",
              direction: "asc",
            },
          },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(json({ ...record(), payload }));
    expect((await fetchPersonalFinancialSavedViews(signal()))?.payload).toEqual(
      payload,
    );
    fetchMock.mockResolvedValueOnce(json(receipt(2)));
    expect(
      (await savePersonalFinancialSavedViews(1, payload, signal())).payload,
    ).toEqual(payload);
    expect(payload.views[0]).toEqual(legacy);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("current balance and ratio decoding", () => {
  it.each([
    ["1", "3", "0.33"],
    ["0.995", "1", "1.00"],
    ["1.005", "1", "1.01"],
    ["0.9949", "1", "0.99"],
    ["0", "2", "0.00"],
    ["-0.00", "2", "0.00"],
    ["250", "100", "2.50"],
    ["9007199254740993", "1", "9007199254740993.00"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(62)}.00`,
    ],
  ])(
    "verifies %s / %s as the exact multiple %s",
    async (assets, liabilities, expected) => {
      const result = currentResponse(
        instantOperand("AssetsCurrent", assets),
        instantOperand("LiabilitiesCurrent", liabilities),
        expected,
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      if (assets.length === 64) expect(expected).toHaveLength(129);
      for (const forged of [
        expected === "0.00" ? "-0.00" : `${expected}0`,
        "123.45",
      ]) {
        fetchMock.mockResolvedValueOnce(
          json(
            currentResponse(
              instantOperand("AssetsCurrent", assets),
              instantOperand("LiabilitiesCurrent", liabilities),
              forged,
            ),
          ),
        );
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
    },
  );

  it.each(["2024-10-01", "2024-12-31"])(
    "admits inclusive Q4 boundary %s",
    async (date) => {
      const result = currentResponse(
        instantOperand("AssetsCurrent", "1", date),
        instantOperand("LiabilitiesCurrent", "1", date),
        "1.00",
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
    },
  );

  it.each(["2024-09-30", "2025-01-01", "2025-01-31"])(
    "retains %s only as an unsupported balance date",
    async (date) => {
      const assets = instantOperand("AssetsCurrent", "100", date);
      const liabilities = instantOperand("LiabilitiesCurrent", "125", date);
      const unsupported = (
        cell: PersonalFinancialScreenInstantCellDto,
      ): PersonalFinancialScreenInstantCellDto => ({
        status: "unavailable",
        unit: "USD",
        reason: "unsupported_balance_date",
        sources: cell.sources,
      });
      const result = currentResponse(
        unsupported(assets),
        unsupported(liabilities),
        null,
        "unsupported_balance_date",
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(currentResponse(assets, liabilities, "0.80")),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    ["0", "0", "nonpositive_current_liabilities"],
    ["-1", "-1", "nonpositive_current_liabilities"],
    ["1", "-0.00", "nonpositive_current_liabilities"],
    ["-1", "2", "unsupported_sign"],
  ] as const)(
    "preserves signed operands %s/%s and verifies %s",
    async (assets, liabilities, reason) => {
      const result = currentResponse(
        instantOperand("AssetsCurrent", assets),
        instantOperand("LiabilitiesCurrent", liabilities),
        null,
        reason,
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(
          currentResponse(
            instantOperand("AssetsCurrent", assets),
            instantOperand("LiabilitiesCurrent", liabilities),
            "0.50",
          ),
        ),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("checks every date and accession before signs, including later operand references", async () => {
    const assets = instantOperand("AssetsCurrent", "-1", "2024-12-30");
    const liabilities = instantOperand(
      "LiabilitiesCurrent",
      "-2",
      "2024-12-31",
    );
    const dateMismatch = currentResponse(
      assets,
      liabilities,
      null,
      "balance_date_mismatch",
    );
    fetchMock.mockResolvedValueOnce(json(dateMismatch));
    expect(await screenPersonalFinancials(request(), signal())).toEqual(
      dateMismatch,
    );
    const base = instantOperand("AssetsCurrent", "-1");
    const later = {
      ...base.sources[0]!,
      accessionNumber: "0000000001-25-000002",
    };
    const multiple = { ...base, sources: [...base.sources, later] };
    const filingMismatch = currentResponse(
      multiple,
      liabilities,
      null,
      "filing_mismatch",
    );
    fetchMock.mockResolvedValueOnce(json(filingMismatch));
    expect(await screenPersonalFinancials(request(), signal())).toEqual(
      filingMismatch,
    );
    fetchMock.mockResolvedValueOnce(
      json(
        currentResponse(
          multiple,
          liabilities,
          null,
          "nonpositive_current_liabilities",
        ),
      ),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const forgedAvailable = {
      ...base,
      sources: [
        ...base.sources,
        { ...base.sources[0]!, asOfDate: "2024-12-30" },
      ],
    };
    fetchMock.mockResolvedValueOnce(
      json(
        currentResponse(
          forgedAvailable,
          liabilities,
          null,
          "balance_date_mismatch",
        ),
      ),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("preserves unavailable-operand precedence and conflict before the date window", async () => {
    const assets: PersonalFinancialScreenInstantCellDto = {
      status: "unavailable",
      unit: "USD",
      reason: "conflicting",
      sources: [
        ...instantOperand("AssetsCurrent", "1", "2025-01-31").sources,
        ...instantOperand("AssetsCurrent", "2", "2024-12-31").sources,
      ],
    };
    const liabilities: PersonalFinancialScreenInstantCellDto = {
      status: "unavailable",
      unit: "USD",
      reason: "missing",
      sources: [],
    };
    for (const result of [
      currentResponse(assets, liabilities, null, "missing"),
      currentResponse(
        assets,
        instantOperand("LiabilitiesCurrent", "0"),
        null,
        "conflicting",
      ),
    ]) {
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
    }
    fetchMock.mockResolvedValueOnce(
      json(
        currentResponse(
          { ...assets, reason: "unsupported_balance_date" },
          liabilities,
          null,
          "missing",
        ),
      ),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("binds the complete source multiset while allowing reordering", async () => {
    const source = instantOperand("AssetsCurrent", "100");
    const result = currentResponse(
      { ...source, sources: [...source.sources, ...source.sources] },
      instantOperand("LiabilitiesCurrent", "80"),
      "1.25",
    );
    const row = result.rows[0]!;
    const changed = (
      sources: readonly PersonalFinancialScreenInstantSourceRefDto[],
    ) => ({
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            currentRatio: { ...row.metrics.currentRatio, sources },
          },
        },
      ],
    });
    fetchMock.mockResolvedValueOnce(
      json(changed([...row.metrics.currentRatio.sources].reverse())),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).resolves.toBeDefined();
    for (const sources of [
      row.metrics.currentRatio.sources.slice(1),
      [...row.metrics.currentRatio.sources, source.sources[0]!],
      row.metrics.currentRatio.sources.map((ref, index) =>
        index === 0 ? { ...ref, value: "100.0" } : ref,
      ),
    ]) {
      fetchMock.mockResolvedValueOnce(json(changed(sources)));
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it.each([
    "unit",
    "ratio unit",
    "annual shape",
    "instant shape on annual",
    "date",
    "year",
    "concept",
    "wrong reason",
    "forged window",
    "amount",
    "overlong ratio",
    "missing references",
    "invalid value reason",
    "padded amount",
  ])("rejects forged instant cell: %s", async (kind) => {
    const result = structuredClone(response());
    const cells = result.rows[0]!.metrics as unknown as Record<
      string,
      { [key: string]: unknown; sources: Record<string, unknown>[] }
    >;
    if (kind === "unit") cells.currentAssets!.unit = "multiple";
    if (kind === "ratio unit") cells.currentRatio!.unit = "percent";
    if (kind === "annual shape")
      cells.currentAssets!.sources = [
        { ...source(), concept: "AssetsCurrent" },
      ];
    if (kind === "instant shape on annual")
      cells.grossProfit!.sources = [
        { ...cells.currentAssets!.sources[0], concept: "GrossProfit" },
      ];
    if (kind === "date")
      cells.currentAssets!.sources[0]!.asOfDate = "2024-02-30";
    if (kind === "year")
      cells.currentAssets!.sources[0]!.asOfDate = "2022-12-31";
    if (kind === "concept")
      cells.currentAssets!.sources[0]!.concept = "LiabilitiesCurrent";
    if (kind === "wrong reason")
      cells.currentAssets = {
        status: "unavailable",
        unit: "USD",
        reason: "nonpositive_current_liabilities",
        sources: [],
      };
    if (kind === "forged window")
      cells.currentAssets = {
        status: "unavailable",
        unit: "USD",
        reason: "unsupported_balance_date",
        sources: cells.currentAssets!.sources,
      };
    if (kind === "amount") cells.currentAssets!.value = "101";
    if (kind === "overlong ratio")
      cells.currentRatio!.value = `${"9".repeat(127)}.00`;
    if (kind === "missing references") cells.currentAssets!.sources = [];
    if (kind === "invalid value reason")
      cells.currentAssets = {
        status: "unavailable",
        unit: "USD",
        reason: "invalid_value",
        sources: cells.currentAssets!.sources,
      };
    if (kind === "padded amount")
      cells.currentAssets!.value = `100.${"0".repeat(64)}`;
    fetchMock.mockResolvedValueOnce(json(result));
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "quarter",
    "missing quarter",
    "old version",
    "old formula",
    "annual URL",
    "wrong quarter URL",
    "missing source",
    "missing metric",
  ])("rejects inconsistent fixed-Q4 transport: %s", async (kind) => {
    const result = structuredClone(response()) as unknown as Record<
      string,
      unknown
    >;
    if (kind === "quarter") result.instantQuarter = 3;
    if (kind === "missing quarter") delete result.instantQuarter;
    if (kind === "old version") result.schemaVersion = "5.0.0";
    if (kind === "old formula") result.formulaVersion = "1.3.0";
    const sources = result.sources as { sourceUrl: string }[];
    if (kind === "annual URL")
      sources[8]!.sourceUrl = sources[8]!.sourceUrl.replace("Q4I", "");
    if (kind === "wrong quarter URL")
      sources[8]!.sourceUrl = sources[8]!.sourceUrl.replace("Q4I", "Q3I");
    if (kind === "missing source") sources.pop();
    if (kind === "missing metric")
      delete (result.rows as { metrics: Record<string, unknown> }[])[0]!.metrics
        .currentRatio;
    fetchMock.mockResolvedValueOnce(json(result));
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each(["AssetsCurrent", "LiabilitiesCurrent"] as const)(
    "binds %s reported cells to failed, absent and available source statuses",
    async (concept) => {
      const field =
        concept === "AssetsCurrent" ? "currentAssets" : "currentLiabilities";
      for (const status of [
        "not_covered",
        "rate_limited",
        "upstream_unavailable",
        "invalid_response",
      ] as const) {
        const result = response();
        const sources = result.sources.map((source) =>
          source.concept === concept ? { ...source, status } : source,
        );
        fetchMock.mockResolvedValueOnce(json({ ...result, sources }));
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
        const reason =
          status === "not_covered" ? "missing" : "source_unavailable";
        const unavailable: PersonalFinancialScreenInstantCellDto = {
          status: "unavailable",
          unit: "USD",
          reason,
          sources: [],
        };
        const valid = currentResponse(
          field === "currentAssets"
            ? unavailable
            : result.rows[0]!.metrics.currentAssets,
          field === "currentLiabilities"
            ? unavailable
            : result.rows[0]!.metrics.currentLiabilities,
          null,
          reason,
        );
        fetchMock.mockResolvedValueOnce(json({ ...valid, sources }));
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).resolves.toBeDefined();
        const wrongReason =
          reason === "missing" ? "source_unavailable" : "missing";
        const forged: PersonalFinancialScreenInstantCellDto = {
          ...unavailable,
          reason: wrongReason,
        };
        fetchMock.mockResolvedValueOnce(
          json({
            ...currentResponse(
              field === "currentAssets"
                ? forged
                : result.rows[0]!.metrics.currentAssets,
              field === "currentLiabilities"
                ? forged
                : result.rows[0]!.metrics.currentLiabilities,
              null,
              wrongReason,
            ),
            sources,
          }),
        );
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
      const unavailable: PersonalFinancialScreenInstantCellDto = {
        status: "unavailable",
        unit: "USD",
        reason: "source_unavailable",
        sources: [],
      };
      fetchMock.mockResolvedValueOnce(
        json(
          currentResponse(
            field === "currentAssets"
              ? unavailable
              : defaultInstantCells().currentAssets,
            field === "currentLiabilities"
              ? unavailable
              : defaultInstantCells().currentLiabilities,
            null,
            "source_unavailable",
          ),
        ),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("keeps the annual cells and saved grammar independent of instant acquisition", async () => {
    const result = response();
    const unavailable: PersonalFinancialScreenInstantCellDto = {
      status: "unavailable",
      unit: "USD",
      reason: "source_unavailable",
      sources: [],
    };
    const failed = currentResponse(
      unavailable,
      unavailable,
      null,
      "source_unavailable",
    );
    fetchMock.mockResolvedValueOnce(
      json({
        ...failed,
        sources: failed.sources.map((source) =>
          source.concept === "AssetsCurrent" ||
          source.concept === "LiabilitiesCurrent"
            ? { ...source, status: "upstream_unavailable" }
            : source,
        ),
      }),
    );
    const decoded = await screenPersonalFinancials(request(), signal());
    for (const metric of PERSONAL_FINANCIAL_SCREEN_METRICS.filter(
      (metric) => !metric.startsWith("current"),
    ))
      expect(decoded.rows[0]!.metrics[metric]).toEqual(
        result.rows[0]!.metrics[metric],
      );
    for (const basis of PERSONAL_FINANCIAL_REVENUE_BASES) {
      const based = responseWithBasis(basis);
      fetchMock.mockResolvedValueOnce(json(based));
      const decoded = await screenPersonalFinancials(
        {
          ...request(),
          criteria: { ...request().criteria, revenueBasis: basis },
        },
        signal(),
      );
      expect(decoded.rows[0]!.metrics.currentRatio).toEqual(
        result.rows[0]!.metrics.currentRatio,
      );
    }
    for (const field of [
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
    ] as const)
      expect(
        isPersonalFinancialScreenCriteria({
          ...request().criteria,
          clauses: [{ field, operator: "gte", value: "1.00" }],
          sort: { field, direction: "desc" },
        }),
      ).toBe(true);
    expect(
      isPersonalFinancialScreenCriteria({
        ...request().criteria,
        instantQuarter: 4,
      }),
    ).toBe(false);
  });
});

describe("operating cash flow / net income decoding", () => {
  it.each([
    ["1", "3", "33.33"],
    ["1.005", "100", "1.01"],
    ["-1.005", "100", "-1.01"],
    ["0", "100", "0.00"],
    ["-0", "100", "0.00"],
    ["-0.0049", "100", "0.00"],
    ["250", "100", "250.00"],
    ["-250", "100", "-250.00"],
    ["9007199254740993", "100", "9007199254740993.00"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(64)}.00`,
    ],
  ])(
    "independently verifies %s / %s percent as %s",
    async (operating, income, expected) => {
      const result = incomeRatioResponse(
        incomeRatioOperand(
          "NetCashProvidedByUsedInOperatingActivities",
          operating,
        ),
        incomeRatioOperand("NetIncomeLoss", income),
        expected,
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      const row = result.rows[0]!;
      for (const value of [
        `${expected.slice(0, -1)}${expected.endsWith("1") ? "2" : "1"}`,
        expected === "0.00" ? "-0.00" : expected.replace(".", ".0"),
      ]) {
        fetchMock.mockResolvedValueOnce(
          json({
            ...result,
            rows: [
              {
                ...row,
                metrics: {
                  ...row.metrics,
                  operatingCashFlowToNetIncome: {
                    ...row.metrics.operatingCashFlowToNetIncome,
                    value,
                  },
                },
              },
            ],
          }),
        );
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
      if (operating.length === 64) expect(expected).toHaveLength(131);
    },
  );

  it.each(["0", "-0.00", "-100"])(
    "keeps denominator %s unknown with the dedicated reason",
    async (income) => {
      const operating = incomeRatioOperand(
        "NetCashProvidedByUsedInOperatingActivities",
        "-1",
      );
      const denominator = incomeRatioOperand("NetIncomeLoss", income);
      const result = incomeRatioResponse(operating, denominator, {
        reason: "nonpositive_net_income",
      });
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      for (const reason of [
        "nonpositive_revenue",
        "unsupported_sign",
        "missing",
      ] as const) {
        fetchMock.mockResolvedValueOnce(
          json(incomeRatioResponse(operating, denominator, { reason })),
        );
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
    },
  );

  it.each([
    "missing",
    "conflicting",
    "invalid_value",
    "source_unavailable",
  ] as const)(
    "propagates %s with net income before operating cash flow and preserves references",
    async (reason) => {
      for (const unavailable of ["income", "operating", "both"] as const) {
        const knownIncome = incomeRatioOperand("NetIncomeLoss", "0");
        const knownOperating = {
          ...incomeRatioOperand(
            "NetCashProvidedByUsedInOperatingActivities",
            "-1",
          ),
          sources: [
            {
              ...source(),
              concept: "NetCashProvidedByUsedInOperatingActivities" as const,
              value: "-1",
              startDate: "2024-01-02",
              accessionNumber: "0000000001-25-000002",
            },
          ],
        };
        const income: PersonalFinancialScreenAnnualCellDto =
          unavailable === "operating"
            ? knownIncome
            : {
                status: "unavailable",
                unit: "USD",
                reason,
                sources: knownIncome.sources,
              };
        const operating: PersonalFinancialScreenAnnualCellDto =
          unavailable === "income"
            ? knownOperating
            : {
                status: "unavailable",
                unit: "USD",
                reason:
                  unavailable === "both"
                    ? reason === "missing"
                      ? "source_unavailable"
                      : "missing"
                    : reason,
                sources: knownOperating.sources,
              };
        const result = incomeRatioResponse(operating, income, { reason });
        fetchMock.mockResolvedValueOnce(json(result));
        expect(await screenPersonalFinancials(request(), signal())).toEqual(
          result,
        );
        for (const wrong of [
          "nonpositive_net_income",
          "period_mismatch",
          "filing_mismatch",
          ...(unavailable === "both" && operating.status === "unavailable"
            ? [operating.reason]
            : []),
        ] as const) {
          fetchMock.mockResolvedValueOnce(
            json(incomeRatioResponse(operating, income, { reason: wrong })),
          );
          await expect(
            screenPersonalFinancials(request(), signal()),
          ).rejects.toMatchObject({ code: "invalid_response" });
        }
      }
    },
  );

  it.each([
    ["2024-11-29", false],
    ["2024-11-30", true],
    ["2025-01-29", true],
    ["2025-01-30", false],
  ] as const)(
    "checks inclusive annual duration ending %s",
    async (endDate, available) => {
      const operand = (
        concept: "NetIncomeLoss" | "NetCashProvidedByUsedInOperatingActivities",
      ) => ({
        ...incomeRatioOperand(concept, "100"),
        sources: [{ ...source(), concept, value: "100", endDate }],
      });
      const operating = operand("NetCashProvidedByUsedInOperatingActivities");
      const income = operand("NetIncomeLoss");
      const result = incomeRatioResponse(
        operating,
        income,
        available ? "100.00" : { reason: "period_mismatch" },
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(
          incomeRatioResponse(
            operating,
            income,
            available ? { reason: "period_mismatch" } : "100.00",
          ),
        ),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(["period", "filing", "period and filing"])(
    "checks %s before the net-income sign",
    async (kind) => {
      const operating = {
        ...incomeRatioOperand(
          "NetCashProvidedByUsedInOperatingActivities",
          "-1",
        ),
        sources: [
          {
            ...source(),
            concept: "NetCashProvidedByUsedInOperatingActivities" as const,
            value: "-1",
            ...(kind.includes("period") ? { startDate: "2024-01-02" } : {}),
            ...(kind.includes("filing")
              ? { accessionNumber: "0000000001-25-000002" }
              : {}),
          },
        ],
      };
      const income = incomeRatioOperand("NetIncomeLoss", "0");
      const reason = kind.includes("period")
        ? "period_mismatch"
        : "filing_mismatch";
      const result = incomeRatioResponse(operating, income, { reason });
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(
          incomeRatioResponse(operating, income, {
            reason: "nonpositive_net_income",
          }),
        ),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
      if (kind === "period and filing") {
        fetchMock.mockResolvedValueOnce(
          json(
            incomeRatioResponse(operating, income, {
              reason: "filing_mismatch",
            }),
          ),
        );
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
    },
  );

  it.each(["income", "operating"])(
    "checks the last retained filing in %s",
    async (operand) => {
      let income = incomeRatioOperand("NetIncomeLoss", "100");
      let operating = incomeRatioOperand(
        "NetCashProvidedByUsedInOperatingActivities",
        "30",
      );
      const original = operand === "income" ? income : operating;
      const extra = {
        ...original.sources[0]!,
        accessionNumber: "0000000001-25-000002",
      };
      if (operand === "income")
        income = { ...income, sources: [...income.sources, extra] };
      else operating = { ...operating, sources: [...operating.sources, extra] };
      const result = incomeRatioResponse(operating, income, {
        reason: "filing_mismatch",
      });
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(incomeRatioResponse(operating, income, "30.00")),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("accepts all twelve operand references in any order without losing multiplicity", async () => {
    const operand = (
      concept: "NetIncomeLoss" | "NetCashProvidedByUsedInOperatingActivities",
      value: string,
    ) => ({
      ...incomeRatioOperand(concept, value),
      sources: Array.from({ length: 6 }, (_, index) => ({
        ...source(),
        concept,
        value: `${value}.${"0".repeat(index + 1)}`,
      })),
    });
    const result = incomeRatioResponse(
      operand("NetCashProvidedByUsedInOperatingActivities", "30"),
      operand("NetIncomeLoss", "100"),
      "30.00",
    );
    const row = result.rows[0]!;
    const ratio = row.metrics.operatingCashFlowToNetIncome;
    const reversed = {
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            operatingCashFlowToNetIncome: {
              ...ratio,
              sources: [...ratio.sources].reverse(),
            },
          },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(json(reversed));
    expect(
      (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
        .operatingCashFlowToNetIncome.sources,
    ).toHaveLength(12);
    for (const sources of [
      ratio.sources.slice(1),
      [...ratio.sources.slice(0, 11), ratio.sources[0]!],
    ]) {
      fetchMock.mockResolvedValueOnce(
        json({
          ...result,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                operatingCashFlowToNetIncome: { ...ratio, sources },
              },
            },
          ],
        }),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it.each([
    "missing reference",
    "duplicate reference",
    "extra reference",
    "reference representation",
    "reference concept",
    "reference filing",
    "reference period",
    "income value",
    "income concept",
    "income conflict",
    "income period",
    "cash flow value",
    "USD unit",
    "unknown reason",
    "missing metric",
    "missing coverage",
  ])("rejects forged ratio evidence: %s", async (kind) => {
    const result = incomeRatioResponse(
      incomeRatioOperand("NetCashProvidedByUsedInOperatingActivities", "30"),
      incomeRatioOperand("NetIncomeLoss", "100"),
      "30.00",
    );
    const row = result.rows[0]!;
    const cells = structuredClone(row.metrics) as Record<string, unknown>;
    const ratio = row.metrics.operatingCashFlowToNetIncome;
    let refs = [...ratio.sources];
    if (kind === "missing reference") refs = refs.slice(1);
    if (kind === "duplicate reference") refs = [refs[0]!, refs[0]!];
    if (kind === "extra reference") refs.push(refs[1]!);
    if (kind === "reference representation")
      refs[0] = { ...refs[0]!, value: "30.0" };
    if (kind === "reference concept")
      refs[0] = { ...refs[0]!, concept: "Revenues" };
    if (kind === "reference filing")
      refs[0] = { ...refs[0]!, accessionNumber: "0000000001-25-000002" };
    if (kind === "reference period")
      refs[0] = { ...refs[0]!, startDate: "2024-01-02" };
    cells.operatingCashFlowToNetIncome = { ...ratio, sources: refs };
    if (kind === "income value")
      cells.netIncome = { ...row.metrics.netIncome, value: "101" };
    if (kind === "cash flow value")
      cells.operatingCashFlow = {
        ...row.metrics.operatingCashFlow,
        value: "31",
      };
    if (kind === "income concept") {
      const forged = {
        ...row.metrics.netIncome.sources[0]!,
        concept: "OperatingIncomeLoss",
      };
      cells.netIncome = { ...row.metrics.netIncome, sources: [forged] };
      cells.operatingCashFlowToNetIncome = {
        ...ratio,
        sources: [refs[0], forged],
      };
    }
    if (kind === "income conflict" || kind === "income period") {
      const extra = {
        ...row.metrics.netIncome.sources[0]!,
        ...(kind === "income conflict"
          ? { value: "101" }
          : { startDate: "2024-01-02" }),
      };
      cells.netIncome = {
        ...row.metrics.netIncome,
        sources: [...row.metrics.netIncome.sources, extra],
      };
      cells.operatingCashFlowToNetIncome = {
        ...ratio,
        sources: [...ratio.sources, extra],
      };
    }
    if (kind === "USD unit")
      cells.operatingCashFlowToNetIncome = { ...ratio, unit: "USD" };
    if (kind === "unknown reason")
      cells.operatingCashFlowToNetIncome = {
        status: "unavailable",
        unit: "percent",
        reason: "missing",
        sources: refs,
      };
    if (kind === "missing metric") delete cells.operatingCashFlowToNetIncome;
    const coverage = { ...result.metricCoverage } as Record<string, unknown>;
    if (kind === "missing coverage")
      delete coverage.operatingCashFlowToNetIncome;
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        metricCoverage: coverage,
        rows: [{ ...row, metrics: cells }],
      }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "does not use the %s revenue basis or missing PP&E as a denominator",
    async (basis) => {
      const result = incomeRatioResponse(
        incomeRatioOperand("NetCashProvidedByUsedInOperatingActivities", "30"),
        incomeRatioOperand("NetIncomeLoss", "100"),
        "30.00",
        basis,
      );
      const input = {
        ...request(),
        criteria: { ...request().criteria, revenueBasis: basis },
      };
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(input, signal())).toEqual(result);
      expect(result.rows[0]?.metrics.ppePurchases).toMatchObject({
        reason: "missing",
      });
    },
  );

  it("keeps the ratio available when every revenue concept is unavailable", async () => {
    const result = incomeRatioResponse(
      incomeRatioOperand("NetCashProvidedByUsedInOperatingActivities", "30"),
      incomeRatioOperand("NetIncomeLoss", "100"),
      "30.00",
    );
    const row = result.rows[0]!;
    const unknown: PersonalFinancialScreenAnnualCellDto = {
      status: "unavailable",
      unit: "USD",
      reason: "source_unavailable",
      sources: [],
    };
    const payload = {
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            revenue: unknown,
            revenueGrowth: unavailableGrowth(unknown),
            operatingCashFlowLessPpePurchasesMargin: cashMarginFixture(
              row.metrics.operatingCashFlow,
              row.metrics.ppePurchases,
              unknown,
            ),
            grossMargin: {
              ...unknown,
              unit: "percent",
              sources: row.metrics.grossProfit.sources,
            },
          },
        },
      ],
      sources: result.sources.map((ref) =>
        PERSONAL_FINANCIAL_REVENUE_BASES.some((basis) => basis === ref.concept)
          ? { ...ref, status: "upstream_unavailable" }
          : ref,
      ),
    };
    fetchMock.mockResolvedValueOnce(json(payload));
    expect(
      (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
        .operatingCashFlowToNetIncome,
    ).toMatchObject({ status: "available", value: "30.00" });
  });

  it.each([
    "NetIncomeLoss",
    "NetCashProvidedByUsedInOperatingActivities",
  ] as const)(
    "retains source failure for %s without synthesizing a ratio",
    async (concept) => {
      const missing: PersonalFinancialScreenAnnualCellDto = {
        status: "unavailable",
        unit: "USD",
        reason: "source_unavailable",
        sources: [],
      };
      const operating =
        concept === "NetCashProvidedByUsedInOperatingActivities"
          ? missing
          : incomeRatioOperand(
              "NetCashProvidedByUsedInOperatingActivities",
              "30",
            );
      const income =
        concept === "NetIncomeLoss"
          ? missing
          : incomeRatioOperand("NetIncomeLoss", "100");
      const result = incomeRatioResponse(operating, income, {
        reason: "source_unavailable",
      });
      const payload = {
        ...result,
        sources: result.sources.map((ref) =>
          ref.concept === concept
            ? { ...ref, status: "upstream_unavailable" }
            : ref,
        ),
      };
      fetchMock.mockResolvedValueOnce(json(payload));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        payload,
      );
      const forged = incomeRatioResponse(operating, income, "30.00");
      fetchMock.mockResolvedValueOnce(
        json({ ...forged, sources: payload.sources }),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(
    PERSONAL_FINANCIAL_SCREEN_METRICS.filter(
      (metric) => metric !== "operatingCashFlowToNetIncome",
    ),
  )("rejects nonpositive_net_income on prior metric %s", async (metric) => {
    const result = response();
    const row = result.rows[0]!;
    const original = row.metrics[metric];
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              [metric]: {
                status: "unavailable",
                unit: original.unit,
                reason: "nonpositive_net_income",
                sources: original.sources,
              },
            },
          },
        ],
      }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("gross profit / selected revenue decoding", () => {
  it.each([
    ["1", "3", "33.33"],
    ["1.005", "100", "1.01"],
    ["-1.005", "100", "-1.01"],
    ["0", "100", "0.00"],
    ["-0.0049", "100", "0.00"],
    ["250", "100", "250.00"],
    ["9007199254740993", "100", "9007199254740993.00"],
    [
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
      `${"9".repeat(64)}${"0".repeat(64)}.00`,
    ],
  ])(
    "independently verifies %s / %s percent as %s",
    async (profit, revenue, expected) => {
      const result = ratioResponse(
        ratioOperand("Revenues", revenue),
        ratioOperand("GrossProfit", profit),
        expected,
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      for (const value of [
        `${expected.slice(0, -1)}${expected.endsWith("1") ? "2" : "1"}`,
        expected === "0.00" ? "-0.00" : expected.replace(".", ".0"),
      ]) {
        const row = result.rows[0]!;
        fetchMock.mockResolvedValueOnce(
          json({
            ...result,
            rows: [
              {
                ...row,
                metrics: {
                  ...row.metrics,
                  grossMargin: { ...row.metrics.grossMargin, value },
                },
              },
            ],
          }),
        );
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
      if (profit.length === 64) expect(expected).toHaveLength(131);
    },
  );

  it.each(["0", "-100"])(
    "keeps nonpositive revenue %s unknown without rejecting negative profit",
    async (revenue) => {
      const result = ratioResponse(
        ratioOperand("Revenues", revenue),
        ratioOperand("GrossProfit", "-1"),
        { reason: "nonpositive_revenue" },
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
    },
  );

  it.each([
    ["RevenueFromContractWithCustomerExcludingAssessedTax", "100", "30.00"],
    ["Revenues", "120", "25.00"],
    ["SalesRevenueNet", "150", "20.00"],
  ] as const)(
    "binds the ratio to selected %s",
    async (basis, revenue, expected) => {
      const result = ratioResponse(
        ratioOperand(basis, revenue),
        ratioOperand("GrossProfit", "30"),
        expected,
        basis,
      );
      const input = {
        ...request(),
        criteria: { ...request().criteria, revenueBasis: basis },
      };
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(input, signal())).toEqual(result);
      const alternate = basis === "Revenues" ? "SalesRevenueNet" : "Revenues";
      const forged = ratioResponse(
        ratioOperand(alternate, revenue),
        ratioOperand("GrossProfit", "30"),
        expected,
        basis,
      );
      fetchMock.mockResolvedValueOnce(json(forged));
      await expect(
        screenPersonalFinancials(input, signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("retains agreement references and does not invent a fallback for conflicting revenue", async () => {
    const revenue: PersonalFinancialScreenAnnualCellDto = {
      status: "unavailable",
      unit: "USD",
      reason: "conflicting",
      sources: [
        { ...source(), value: "100" },
        { ...source(), concept: "SalesRevenueNet", value: "120" },
      ],
    };
    const result = ratioResponse(revenue, ratioOperand("GrossProfit", "30"), {
      reason: "conflicting",
    });
    fetchMock.mockResolvedValueOnce(json(result));
    expect(await screenPersonalFinancials(request(), signal())).toEqual(result);
    const row = result.rows[0]!;
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              grossMargin: {
                status: "available",
                unit: "percent",
                value: "30.00",
                sources: row.metrics.grossMargin.sources,
              },
            },
          },
        ],
      }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "missing",
    "conflicting",
    "invalid_value",
    "source_unavailable",
  ] as const)(
    "propagates %s from reported operands with exact source retention",
    async (reason) => {
      for (const operand of ["revenue", "profit", "both"] as const) {
        // The growth operand cannot substantiate invalid_value from decimal-valid references.
        if (reason === "invalid_value" && operand !== "profit") continue;
        const knownRevenue = ratioOperand("Revenues", "0");
        const knownProfit = ratioOperand("GrossProfit", "-1");
        const revenue: PersonalFinancialScreenAnnualCellDto =
          operand === "profit"
            ? knownRevenue
            : {
                status: "unavailable",
                unit: "USD",
                reason,
                sources: reason === "missing" ? [] : knownRevenue.sources,
              };
        const profit: PersonalFinancialScreenAnnualCellDto =
          operand === "revenue"
            ? knownProfit
            : {
                status: "unavailable",
                unit: "USD",
                reason: operand === "both" ? "source_unavailable" : reason,
                sources: knownProfit.sources,
              };
        const baseResult = ratioResponse(revenue, profit, { reason });
        const result =
          reason === "source_unavailable" && operand !== "profit"
            ? {
                ...baseResult,
                sources: baseResult.sources.map((source) =>
                  source.concept === "SalesRevenueNet"
                    ? { ...source, status: "upstream_unavailable" as const }
                    : source,
                ),
              }
            : baseResult;
        fetchMock.mockResolvedValueOnce(json(result));
        expect(await screenPersonalFinancials(request(), signal())).toEqual(
          result,
        );
        const row = result.rows[0]!;
        for (const wrongReason of [
          "nonpositive_revenue",
          "period_mismatch",
          "filing_mismatch",
          "unsupported_sign",
        ]) {
          fetchMock.mockResolvedValueOnce(
            json({
              ...result,
              rows: [
                {
                  ...row,
                  metrics: {
                    ...row.metrics,
                    grossMargin: {
                      ...row.metrics.grossMargin,
                      reason: wrongReason,
                    },
                  },
                },
              ],
            }),
          );
          await expect(
            screenPersonalFinancials(request(), signal()),
          ).rejects.toMatchObject({ code: "invalid_response" });
        }
      }
    },
  );

  it.each([
    ["2024-11-29", false],
    ["2024-11-30", true],
    ["2025-01-29", true],
    ["2025-01-30", false],
  ] as const)(
    "checks inclusive annual duration ending %s",
    async (endDate, available) => {
      const operand = (concept: "Revenues" | "GrossProfit") => ({
        ...ratioOperand(concept, "100"),
        sources: [{ ...source(), concept, value: "100", endDate }],
      });
      const result = ratioResponse(
        operand("Revenues"),
        operand("GrossProfit"),
        available ? "100.00" : { reason: "period_mismatch" },
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(
          ratioResponse(
            operand("Revenues"),
            operand("GrossProfit"),
            available ? { reason: "period_mismatch" } : "100.00",
          ),
        ),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(["period", "filing", "period and filing"])(
    "checks %s before the revenue sign",
    async (kind) => {
      const revenue = ratioOperand("Revenues", "0");
      const profit = {
        ...ratioOperand("GrossProfit", "-1"),
        sources: [
          {
            ...source(),
            concept: "GrossProfit" as const,
            value: "-1",
            ...(kind.includes("period") ? { startDate: "2024-01-02" } : {}),
            ...(kind.includes("filing")
              ? { accessionNumber: "0000000001-25-000002" }
              : {}),
          },
        ],
      };
      const reason = kind.includes("period")
        ? "period_mismatch"
        : "filing_mismatch";
      const result = ratioResponse(revenue, profit, { reason });
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(ratioResponse(revenue, profit, { reason: "nonpositive_revenue" })),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(["profit", "revenue", "last agreement concept"])(
    "checks a later filing reference in %s",
    async (kind) => {
      let revenue = ratioOperand("Revenues", "100");
      let profit = ratioOperand("GrossProfit", "30");
      const differentFiling = { accessionNumber: "0000000001-25-000002" };
      if (kind === "profit")
        profit = {
          ...profit,
          sources: [
            ...profit.sources,
            { ...profit.sources[0]!, ...differentFiling },
          ],
        };
      else
        revenue = {
          ...revenue,
          sources: [
            ...revenue.sources,
            {
              ...revenue.sources[0]!,
              ...(kind === "last agreement concept"
                ? { concept: "SalesRevenueNet" as const }
                : {}),
              ...differentFiling,
            },
          ],
        };
      fetchMock.mockResolvedValueOnce(
        json(ratioResponse(revenue, profit, { reason: "filing_mismatch" })),
      );
      expect(
        (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
          .grossMargin,
      ).toMatchObject({ reason: "filing_mismatch" });
      fetchMock.mockResolvedValueOnce(
        json(ratioResponse(revenue, profit, "30.00")),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("preserves the full multiset of both six-reference operands in any order", async () => {
    const revenue = {
      ...ratioOperand("Revenues", "100"),
      sources: Array.from({ length: 6 }, () => ({ ...source(), value: "100" })),
    };
    const profit = {
      ...ratioOperand("GrossProfit", "30"),
      sources: Array.from({ length: 6 }, () => ({
        ...source(),
        concept: "GrossProfit" as const,
        value: "30",
      })),
    };
    const result = ratioResponse(revenue, profit, "30.00");
    const row = result.rows[0]!;
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              grossMargin: {
                ...row.metrics.grossMargin,
                sources: [...row.metrics.grossMargin.sources].reverse(),
              },
            },
          },
        ],
      }),
    );
    expect(
      (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
        .grossMargin.sources,
    ).toHaveLength(12);
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              grossMargin: {
                ...row.metrics.grossMargin,
                sources: row.metrics.grossMargin.sources.slice(1),
              },
            },
          },
        ],
      }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "missing",
    "duplicate",
    "extra",
    "representation",
    "concept",
    "denominator value",
    "denominator conflict",
    "denominator period",
    "unknown reason",
  ])("rejects ratio forgery: %s", async (kind) => {
    const result = ratioResponse(
      ratioOperand("Revenues", "100"),
      ratioOperand("GrossProfit", "30"),
      "30.00",
    );
    const row = result.rows[0]!;
    const cells = structuredClone(row.metrics) as Record<string, unknown>;
    const ratio = row.metrics.grossMargin;
    let refs = [...ratio.sources];
    if (kind === "missing") refs = refs.slice(1);
    if (kind === "duplicate") refs = [refs[0]!, refs[0]!];
    if (kind === "extra") refs.push(refs[1]!);
    if (kind === "representation") refs[0] = { ...refs[0]!, value: "30.0" };
    if (kind === "concept") refs[0] = { ...refs[0]!, concept: "NetIncomeLoss" };
    cells.grossMargin = { ...ratio, sources: refs };
    if (kind === "denominator value")
      cells.revenue = { ...row.metrics.revenue, value: "101" };
    if (kind === "denominator conflict" || kind === "denominator period") {
      const second = {
        ...row.metrics.revenue.sources[0]!,
        ...(kind === "denominator conflict"
          ? { value: "101" }
          : { startDate: "2024-01-02" }),
      };
      cells.revenue = {
        ...row.metrics.revenue,
        sources: [...row.metrics.revenue.sources, second],
      };
      cells.grossMargin = { ...ratio, sources: [...ratio.sources, second] };
    }
    if (kind === "unknown reason")
      cells.grossMargin = {
        status: "unavailable",
        unit: "percent",
        reason: "missing",
        sources: refs,
      };
    fetchMock.mockResolvedValueOnce(
      json({ ...result, rows: [{ ...row, metrics: cells }] }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("operating cash flow less PP&E purchases / selected revenue decoding", () => {
  const operating = (value = "10") =>
    cashCell("NetCashProvidedByUsedInOperatingActivities", value);
  const purchases = (value = "2") =>
    cashCell("PaymentsToAcquirePropertyPlantAndEquipment", value);
  const revenue = (value = "20") => ratioOperand("Revenues", value);
  const unknown = (
    reason: Extract<
      PersonalFinancialScreenAnnualCellDto,
      { status: "unavailable" }
    >["reason"],
    sources: PersonalFinancialScreenAnnualCellDto["sources"] = [],
  ): PersonalFinancialScreenAnnualCellDto => ({
    status: "unavailable",
    unit: "USD",
    reason,
    sources,
  });
  const make = (
    op = operating(),
    ppe = purchases(),
    rev = revenue(),
    expected:
      | string
      | {
          reason: Extract<
            PersonalFinancialScreenAnnualCellDto,
            { status: "unavailable" }
          >["reason"];
        } = "40.00",
    difference:
      | string
      | {
          reason: Extract<
            PersonalFinancialScreenAnnualCellDto,
            { status: "unavailable" }
          >["reason"];
        } = "8",
    basis: PersonalFinancialRevenueBasisDto = "agreement",
  ): PersonalFinancialScreenResponseDto => {
    const result = cashResponse(op, ppe, difference);
    const row = result.rows[0]!;
    const sources = [...op.sources, ...ppe.sources, ...rev.sources];
    return {
      ...result,
      revenueBasis: basis,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            revenue: rev,
            revenueGrowth: unavailableGrowth(rev),
            grossProfit: unknown("missing"),
            grossMargin: {
              ...unknown(
                rev.status === "unavailable" ? rev.reason : "missing",
                rev.sources,
              ),
              unit: "percent",
            },
            operatingCashFlowMargin: { ...unknown("missing"), unit: "percent" },
            netMargin: { ...unknown("missing"), unit: "percent" },
            operatingMargin: { ...unknown("missing"), unit: "percent" },
            operatingCashFlowLessPpePurchasesMargin:
              typeof expected === "string"
                ? {
                    status: "available",
                    unit: "percent",
                    value: expected,
                    sources,
                  }
                : {
                    status: "unavailable",
                    unit: "percent",
                    reason: expected.reason,
                    sources,
                  },
          },
        },
      ],
    };
  };
  const decode = (result: PersonalFinancialScreenResponseDto) => {
    fetchMock.mockResolvedValueOnce(json(result));
    return screenPersonalFinancials(
      {
        ...request(),
        criteria: {
          ...request().criteria,
          revenueBasis: result.revenueBasis ?? "agreement",
        },
      },
      signal(),
    );
  };
  const corrupt = (
    result: PersonalFinancialScreenResponseDto,
    change: (cell: Record<string, unknown>) => void,
  ) => {
    const copy = structuredClone(result);
    change(copy.rows[0]!.metrics.operatingCashFlowLessPpePurchasesMargin);
    return copy;
  };

  it.each([
    ["10", "2", "20", "8", "40.00"],
    ["1.005", "0.004", "100", "1.001", "1.00"],
    ["1.004", "0.006", "100", "0.998", "1.00"],
    ["12.125", "2.00001", "20", "10.12499", "50.62"],
    ["1", "0", "3", "1", "33.33"],
    ["1.005", "0", "100", "1.005", "1.01"],
    ["0", "1.005", "100", "-1.005", "-1.01"],
    ["-12.125", "2.00001", "20", "-14.12501", "-70.63"],
    ["2", "2.0000", "100", "0", "0.00"],
    ["0", "0.0049", "100", "-0.0049", "0.00"],
    ["-0.000", "0", "100", "0", "0.00"],
    ["250", "0", "100", "250", "250.00"],
    [
      "9007199254740993.1",
      "0.1",
      "100",
      "9007199254740993",
      "9007199254740993.00",
    ],
    ["9007199254740993.0001", "9007199254740993", "0.01", "0.0001", "1.00"],
  ])(
    "checks (%s − %s) / %s from original decimals once as %s USD and %s%%",
    async (op, ppe, rev, difference, expected) => {
      const result = make(
        operating(op),
        purchases(ppe),
        revenue(rev),
        expected,
        difference,
      );
      expect(await decode(result)).toEqual(result);
      for (const value of [
        `${expected.slice(0, -1)}${expected.endsWith("1") ? "2" : "1"}`,
        expected === "0.00" ? "-0.00" : `${expected}0`,
      ]) {
        await expect(
          decode(
            corrupt(result, (cell) => {
              cell.value = value;
            }),
          ),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
    },
  );

  it("admits the exact 133-character signed boundary without losing a subtraction digit", async () => {
    const difference = `-${10n ** 63n - 1n + 10n ** 64n - 1n}`;
    const expected = `-${(10n ** 63n - 1n + 10n ** 64n - 1n) * 10n ** 64n}.00`;
    expect(expected).toHaveLength(133);
    const result = make(
      operating(`-${"9".repeat(63)}`),
      purchases("9".repeat(64)),
      revenue(`0.${"0".repeat(61)}1`),
      expected,
      difference,
    );
    expect(await decode(result)).toEqual(result);
    await expect(
      decode(
        corrupt(result, (cell) => {
          cell.value = `${expected}0`;
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "retains all three operands under %s and sends signed criteria",
    async (basis) => {
      const rev = {
        ...revenue(),
        sources: (basis === "agreement"
          ? ([
              "Revenues",
              "SalesRevenueNet",
              "RevenueFromContractWithCustomerExcludingAssessedTax",
            ] as const)
          : [basis]
        ).map((concept) => ({ ...source(), concept, value: "20" })),
      };
      const result = make(operating(), purchases(), rev, "40.00", "8", basis);
      expect(await decode(result)).toEqual(result);
      fetchMock.mockResolvedValueOnce(json(result));
      const input: PersonalFinancialScreenRequestDto = {
        ...request(),
        criteria: {
          ...request().criteria,
          revenueBasis: basis,
          clauses: [
            {
              field: "operatingCashFlowLessPpePurchasesMargin",
              operator: "gte",
              value: "-0.005",
            },
          ],
          sort: {
            field: "operatingCashFlowLessPpePurchasesMargin",
            direction: "desc",
          },
        },
      };
      await screenPersonalFinancials(input, signal());
      expect(fetchMock.mock.calls.at(-1)?.[1]?.body).toBe(
        JSON.stringify(input),
      );
    },
  );

  it("preserves twelve references including exact duplicates while allowing source reorder", async () => {
    const repeat = (
      cell: PersonalFinancialScreenAnnualCellDto,
      length: number,
    ) => ({
      ...cell,
      sources: Array.from({ length }, () => ({ ...cell.sources[0]! })),
    });
    const result = make(
      repeat(operating(), 3),
      repeat(purchases(), 3),
      repeat(revenue(), 6),
    );
    expect(
      result.rows[0]!.metrics.operatingCashFlowLessPpePurchasesMargin.sources,
    ).toHaveLength(12);
    expect(await decode(result)).toEqual(result);
    const reversed = corrupt(result, (cell) => {
      (cell.sources as unknown[]).reverse();
    });
    expect(await decode(reversed)).toEqual(reversed);
    for (const delta of [-1, 1]) {
      await expect(
        decode(
          corrupt(result, (cell) => {
            const refs = cell.sources as unknown[];
            if (delta < 0) refs.pop();
            else refs.push(refs[0]);
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it.each([
    "value",
    "concept",
    "accessionNumber",
    "startDate",
    "endDate",
    "missing",
    "duplicate",
  ])("rejects a changed retained source: %s", async (kind) => {
    await expect(
      decode(
        corrupt(make(), (cell) => {
          const refs = cell.sources as Record<string, unknown>[];
          if (kind === "missing") refs.pop();
          else if (kind === "duplicate") refs.push({ ...refs[0] });
          else
            refs[2] = {
              ...refs[2],
              [kind]: (
                {
                  value: "21",
                  concept: "SalesRevenueNet",
                  accessionNumber: "0000000001-25-000002",
                  startDate: "2024-01-02",
                  endDate: "2024-12-30",
                } as Record<string, string>
              )[kind],
            };
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each(["revenue", "operatingCashFlow", "ppePurchases"] as const)(
    "rejects an operand-only tamper of %s",
    async (operand) => {
      const copy = structuredClone(make());
      const cell = copy.rows[0]!.metrics[operand];
      (cell as { value: string }).value = "123";
      await expect(decode(copy)).rejects.toMatchObject({
        code: "invalid_response",
      });
    },
  );

  it.each([334, 335, 395, 396])(
    "requires inclusive annual span %s for every original operand",
    async (days) => {
      const dates = (cell: PersonalFinancialScreenAnnualCellDto) => ({
        ...cell,
        sources: cell.sources.map((ref) => ({
          ...ref,
          startDate: "2023-12-15",
          endDate: new Date(Date.parse("2023-12-15") + (days - 1) * 86_400_000)
            .toISOString()
            .slice(0, 10),
        })),
      });
      const expected =
        days >= 335 && days <= 395
          ? "40.00"
          : { reason: "period_mismatch" as const };
      const difference = typeof expected === "string" ? "8" : expected;
      const result = make(
        dates(operating()),
        dates(purchases()),
        dates(revenue()),
        expected,
        difference,
      );
      expect(await decode(result)).toEqual(result);
      if (typeof expected !== "string")
        await expect(
          decode(
            corrupt(result, (cell) => {
              delete cell.reason;
              cell.status = "available";
              cell.value = "40.00";
            }),
          ),
        ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(["operating", "purchases", "revenue"] as const)(
    "checks every agreeing retained %s filing",
    async (operand) => {
      const append = (cell: PersonalFinancialScreenAnnualCellDto) => ({
        ...cell,
        sources: [
          ...cell.sources,
          { ...cell.sources[0]!, accessionNumber: "0000000001-25-000002" },
        ],
      });
      const op = operand === "operating" ? append(operating()) : operating();
      const ppe = operand === "purchases" ? append(purchases()) : purchases();
      const rev = operand === "revenue" ? append(revenue()) : revenue();
      const result = make(
        op,
        ppe,
        rev,
        { reason: "filing_mismatch" },
        operand === "revenue" ? "8" : { reason: "filing_mismatch" },
      );
      expect(await decode(result)).toEqual(result);
      await expect(
        decode(
          corrupt(result, (cell) => {
            delete cell.reason;
            cell.status = "available";
            cell.value = "40.00";
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  const earlierPeriod = (cell: PersonalFinancialScreenAnnualCellDto) => ({
    ...cell,
    sources: cell.sources.map((ref) => ({ ...ref, startDate: "2024-01-02" })),
  });
  const laterFiling = (cell: PersonalFinancialScreenAnnualCellDto) => ({
    ...cell,
    sources: cell.sources.map((ref) => ({
      ...ref,
      accessionNumber: "0000000001-25-000002",
    })),
  });
  it.each([
    [
      "revenue missing before both cash operands",
      unknown("conflicting"),
      unknown("missing"),
      unknown("missing"),
      "missing",
      { reason: "conflicting" },
    ],
    [
      "revenue conflict before missing operating cash flow",
      unknown("missing"),
      unknown("conflicting"),
      unknown("conflicting", revenue().sources),
      "conflicting",
      { reason: "missing" },
    ],
    [
      "operating cash flow before purchases",
      unknown("conflicting"),
      unknown("missing"),
      revenue(),
      "conflicting",
      { reason: "conflicting" },
    ],
    [
      "purchases unavailable",
      operating(),
      unknown("conflicting", purchases().sources),
      revenue(),
      "conflicting",
      { reason: "conflicting" },
    ],
    [
      "period before filing, sign and denominator",
      operating(),
      laterFiling(purchases("-2")),
      earlierPeriod(revenue("0")),
      "period_mismatch",
      { reason: "filing_mismatch" },
    ],
    [
      "filing before sign and denominator",
      operating(),
      laterFiling(purchases("-2")),
      revenue("0"),
      "filing_mismatch",
      { reason: "filing_mismatch" },
    ],
    [
      "purchase sign before denominator",
      operating(),
      purchases("-2"),
      revenue("0"),
      "unsupported_sign",
      { reason: "unsupported_sign" },
    ],
    [
      "zero selected revenue",
      operating(),
      purchases(),
      revenue("0"),
      "nonpositive_revenue",
      "8",
    ],
    [
      "negative zero selected revenue",
      operating(),
      purchases(),
      revenue("-0.00"),
      "nonpositive_revenue",
      "8",
    ],
    [
      "negative selected revenue",
      operating(),
      purchases(),
      revenue("-20"),
      "nonpositive_revenue",
      "8",
    ],
  ] as const)(
    "keeps explicit unknown precedence: %s",
    async (_label, op, ppe, rev, reason, difference) => {
      const result = make(op, ppe, rev, { reason }, difference);
      expect(await decode(result)).toEqual(result);
      for (const wrong of [
        "missing",
        "conflicting",
        "period_mismatch",
        "filing_mismatch",
        "unsupported_sign",
        "nonpositive_revenue",
        "nonpositive_net_income",
      ].filter((value) => value !== reason)) {
        await expect(
          decode(
            corrupt(result, (cell) => {
              cell.reason = wrong;
            }),
          ),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
      await expect(
        decode(
          corrupt(result, (cell) => {
            delete cell.reason;
            cell.status = "available";
            cell.value = "0.00";
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each(["unit", "status", "extra", "reason", "noncanonical"])(
    "rejects malformed available result %s",
    async (kind) => {
      await expect(
        decode(
          corrupt(make(), (cell) => {
            if (kind === "unit") cell.unit = "USD";
            if (kind === "status") cell.status = "estimated";
            if (kind === "extra") cell.providerHint = "trusted";
            if (kind === "reason") cell.reason = "missing";
            if (kind === "noncanonical") cell.value = "40";
          }),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
});

describe("financial screen transport", () => {
  it.each([
    ["12.125", "2.00001", "10.12499"],
    ["-12.125", "2.00001", "-14.12501"],
    ["2.000", "2", "-0.000"],
    ["0", "0", "0"],
    ["9007199254740993.00001", "9007199254740993", "0.00001"],
  ])(
    "verifies exact cash subtraction %s − %s = %s",
    async (operating, purchases, result) => {
      const response = cashResponse(
        cashCell("NetCashProvidedByUsedInOperatingActivities", operating),
        cashCell("PaymentsToAcquirePropertyPlantAndEquipment", purchases),
        result,
      );
      fetchMock.mockResolvedValueOnce(json(response));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        response,
      );
      const row = response.rows[0]!;
      fetchMock.mockResolvedValueOnce(
        json({
          ...response,
          rows: [
            {
              ...row,
              metrics: {
                ...row.metrics,
                operatingCashFlowLessPpePurchases: {
                  ...row.metrics.operatingCashFlowLessPpePurchases,
                  value: "999",
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

  it.each([
    "missing",
    "conflicting",
    "source_unavailable",
    "invalid_value",
  ] as const)(
    "propagates %s inputs with exact source retention and operating-input precedence",
    async (reason) => {
      for (const missingMetric of ["operating", "purchases", "both"] as const) {
        const operating: PersonalFinancialScreenAnnualCellDto =
          missingMetric === "purchases"
            ? cashCell("NetCashProvidedByUsedInOperatingActivities", "10")
            : {
                status: "unavailable",
                unit: "USD",
                reason,
                sources: [
                  cashRef("NetCashProvidedByUsedInOperatingActivities", "10"),
                ],
              };
        const purchases: PersonalFinancialScreenAnnualCellDto =
          missingMetric === "operating"
            ? cashCell("PaymentsToAcquirePropertyPlantAndEquipment", "2")
            : {
                status: "unavailable",
                unit: "USD",
                reason:
                  missingMetric === "both" ? "source_unavailable" : reason,
                sources: [
                  cashRef("PaymentsToAcquirePropertyPlantAndEquipment", "2"),
                ],
              };
        const expectedReason =
          operating.status === "unavailable" ? operating.reason : reason;
        const result = cashResponse(operating, purchases, {
          reason: expectedReason,
        });
        fetchMock.mockResolvedValueOnce(json(result));
        expect(await screenPersonalFinancials(request(), signal())).toEqual(
          result,
        );
        const row = result.rows[0]!;
        for (const wrong of [
          {
            status: "available",
            unit: "USD",
            value: "8",
            sources: [...operating.sources, ...purchases.sources],
          },
          {
            ...row.metrics.operatingCashFlowLessPpePurchases,
            reason: expectedReason === "missing" ? "conflicting" : "missing",
          },
        ]) {
          fetchMock.mockResolvedValueOnce(
            json({
              ...result,
              rows: [
                {
                  ...row,
                  metrics: {
                    ...row.metrics,
                    operatingCashFlowLessPpePurchases: wrong,
                  },
                },
              ],
            }),
          );
          await expect(
            screenPersonalFinancials(request(), signal()),
          ).rejects.toMatchObject({ code: "invalid_response" });
        }
      }
    },
  );

  it.each([
    ["period", "period_mismatch"],
    ["filing", "filing_mismatch"],
    ["negative purchases", "unsupported_sign"],
    ["period before filing and sign", "period_mismatch"],
    ["filing before sign", "filing_mismatch"],
    ["multiple filing references", "filing_mismatch"],
  ] as const)("validates derived unknown: %s", async (kind, reason) => {
    const operating = cashCell(
      "NetCashProvidedByUsedInOperatingActivities",
      "10",
    );
    const purchaseSource = {
      ...cashRef(
        "PaymentsToAcquirePropertyPlantAndEquipment",
        kind.includes("sign") || kind === "negative purchases" ? "-2" : "2",
      ),
      ...(kind.includes("period") ? { startDate: "2024-01-02" } : {}),
      ...(kind.includes("filing")
        ? { accessionNumber: "0000000001-25-000002" }
        : {}),
    };
    const purchases: PersonalFinancialScreenAnnualCellDto = {
      status: "available",
      unit: "USD",
      value: purchaseSource.value,
      sources:
        kind === "multiple filing references"
          ? [
              cashRef("PaymentsToAcquirePropertyPlantAndEquipment", "2"),
              purchaseSource,
            ]
          : [purchaseSource],
    };
    const result = cashResponse(operating, purchases, { reason });
    fetchMock.mockResolvedValueOnce(json(result));
    expect(await screenPersonalFinancials(request(), signal())).toEqual(result);
    const row = result.rows[0]!;
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              operatingCashFlowLessPpePurchases: {
                status: "available",
                unit: "USD",
                value: "8",
                sources: [...operating.sources, ...purchases.sources],
              },
            },
          },
        ],
      }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    ["2024-11-29", false],
    ["2024-11-30", true],
    ["2025-01-29", true],
    ["2025-01-30", false],
  ] as const)(
    "binds annual duration through %s using inclusive days",
    async (endDate, available) => {
      const operating = {
        ...cashCell("NetCashProvidedByUsedInOperatingActivities", "10"),
        sources: [
          {
            ...cashRef("NetCashProvidedByUsedInOperatingActivities", "10"),
            endDate,
          },
        ],
      };
      const purchases = {
        ...cashCell("PaymentsToAcquirePropertyPlantAndEquipment", "2"),
        sources: [
          {
            ...cashRef("PaymentsToAcquirePropertyPlantAndEquipment", "2"),
            endDate,
          },
        ],
      };
      const result = cashResponse(
        operating,
        purchases,
        available ? "8" : { reason: "period_mismatch" },
      );
      fetchMock.mockResolvedValueOnce(json(result));
      expect(await screenPersonalFinancials(request(), signal())).toEqual(
        result,
      );
      fetchMock.mockResolvedValueOnce(
        json(
          cashResponse(
            operating,
            purchases,
            available ? { reason: "period_mismatch" } : "8",
          ),
        ),
      );
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    "amount",
    "period",
    "concept",
    "missing reference",
    "derived amount",
    "dropped operand",
    "duplicated operand",
    "substituted reference",
    "unknown reason",
  ])("rejects cash-cell forgery: %s", async (kind) => {
    const result = cashResponse(
      cashCell(
        "NetCashProvidedByUsedInOperatingActivities",
        "9007199254740993.00001",
      ),
      cashCell(
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "9007199254740993",
      ),
      "0.00001",
    );
    const row = result.rows[0]!;
    const metrics = structuredClone(row.metrics) as Record<string, unknown>;
    const purchases = row.metrics.ppePurchases;
    const derived = row.metrics.operatingCashFlowLessPpePurchases;
    if (kind === "amount")
      metrics.ppePurchases = { ...purchases, value: "9007199254740992" };
    if (kind === "period")
      metrics.ppePurchases = {
        ...purchases,
        sources: [
          ...purchases.sources,
          { ...purchases.sources[0], startDate: "2024-01-02" },
        ],
      };
    if (kind === "concept")
      metrics.ppePurchases = { ...purchases, sources: [source()] };
    if (kind === "missing reference")
      metrics.ppePurchases = { ...purchases, sources: [] };
    if (kind === "derived amount")
      metrics.operatingCashFlowLessPpePurchases = {
        ...derived,
        value: "0.000010000000000001",
      };
    if (kind === "dropped operand")
      metrics.operatingCashFlowLessPpePurchases = {
        ...derived,
        sources: derived.sources.slice(0, 1),
      };
    if (kind === "duplicated operand")
      metrics.operatingCashFlowLessPpePurchases = {
        ...derived,
        sources: [derived.sources[0], derived.sources[0]],
      };
    if (kind === "substituted reference")
      metrics.operatingCashFlowLessPpePurchases = {
        ...derived,
        sources: [
          derived.sources[0],
          { ...derived.sources[1], value: "9007199254740993.0" },
        ],
      };
    if (kind === "unknown reason")
      metrics.operatingCashFlowLessPpePurchases = {
        status: "unavailable",
        unit: "USD",
        reason: "nonpositive_revenue",
        sources: derived.sources,
      };
    fetchMock.mockResolvedValueOnce(
      json({ ...result, rows: [{ ...row, metrics }] }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("accepts source reordering while preserving multiset multiplicity", async () => {
    const operating = cashCell(
      "NetCashProvidedByUsedInOperatingActivities",
      "10",
    );
    const purchases = cashCell(
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "2",
    );
    const withDuplicate = {
      ...purchases,
      sources: [...purchases.sources, ...purchases.sources],
    };
    const result = cashResponse(operating, withDuplicate, "8");
    const row = result.rows[0]!;
    const derived = row.metrics.operatingCashFlowLessPpePurchases;
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              operatingCashFlowLessPpePurchases: {
                ...derived,
                sources: [...derived.sources].reverse(),
              },
            },
          },
        ],
      }),
    );
    expect(
      (await screenPersonalFinancials(request(), signal())).rows[0]?.metrics
        .operatingCashFlowLessPpePurchases.sources,
    ).toHaveLength(3);
    fetchMock.mockResolvedValueOnce(
      json({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              operatingCashFlowLessPpePurchases: {
                ...derived,
                sources: derived.sources.slice(0, 2),
              },
            },
          },
        ],
      }),
    );
    await expect(
      screenPersonalFinancials(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "revenue",
    "grossProfit",
    "netIncome",
    "operatingIncome",
    "operatingCashFlow",
    "netMargin",
    "operatingMargin",
    "operatingCashFlowMargin",
  ] as const)(
    "rejects PP&E references and derived-only reasons in existing %s",
    async (metric) => {
      const result = response();
      const row = result.rows[0]!;
      for (const invalid of [
        {
          ...row.metrics[metric],
          sources: [cashRef("PaymentsToAcquirePropertyPlantAndEquipment", "2")],
        },
        ...["filing_mismatch", "unsupported_sign"].map((reason) => ({
          status: "unavailable",
          unit: row.metrics[metric].unit,
          reason,
          sources: [],
        })),
      ]) {
        fetchMock.mockResolvedValueOnce(
          json({
            ...result,
            rows: [{ ...row, metrics: { ...row.metrics, [metric]: invalid } }],
          }),
        );
        await expect(
          screenPersonalFinancials(request(), signal()),
        ).rejects.toMatchObject({ code: "invalid_response" });
      }
    },
  );

  it("sends cash criteria and retains cash results independently of selected revenue", async () => {
    const result = responseWithBasis("SalesRevenueNet");
    const row = result.rows[0]!;
    const missingRevenue = {
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            revenue: {
              status: "unavailable",
              unit: "USD",
              reason: "missing",
              sources: [],
            },
            revenueGrowth: unavailableGrowth({
              status: "unavailable",
              unit: "USD",
              reason: "missing",
              sources: [],
            }),
            grossMargin: {
              status: "unavailable",
              unit: "percent",
              reason: "missing",
              sources: row.metrics.grossProfit.sources,
            },
            operatingCashFlowLessPpePurchasesMargin: {
              status: "unavailable",
              unit: "percent",
              reason: "missing",
              sources: [
                ...row.metrics.operatingCashFlow.sources,
                ...row.metrics.ppePurchases.sources,
              ],
            },
            ...Object.fromEntries(
              ["netMargin", "operatingMargin", "operatingCashFlowMargin"].map(
                (metric) => [
                  metric,
                  {
                    status: "unavailable",
                    unit: "percent",
                    reason: "missing",
                    sources: [],
                  },
                ],
              ),
            ),
          },
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(json(missingRevenue));
    const input = {
      ...request(),
      criteria: {
        ...request().criteria,
        revenueBasis: "SalesRevenueNet",
        clauses: [
          {
            field: "operatingCashFlowLessPpePurchases",
            operator: "gte",
            value: "-0.00001",
          },
          { field: "ppePurchases", operator: "gte", value: "0" },
        ],
        sort: { field: "operatingCashFlowLessPpePurchases", direction: "desc" },
      },
    } as const;
    expect(
      (await screenPersonalFinancials(input, signal())).rows[0]?.metrics
        .ppePurchases.status,
    ).toBe("available");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(input));
  });

  it.each([
    "period_mismatch",
    "filing_mismatch",
    "unsupported_sign",
    "nonpositive_revenue",
  ] as const)(
    "rejects derived-only PP&E reported-cell reason %s",
    async (reason) => {
      const result = cashResponse(
        cashCell("NetCashProvidedByUsedInOperatingActivities", "10"),
        {
          status: "unavailable",
          unit: "USD",
          reason,
          sources: [cashRef("PaymentsToAcquirePropertyPlantAndEquipment", "2")],
        },
        { reason },
      );
      fetchMock.mockResolvedValueOnce(json(result));
      await expect(
        screenPersonalFinancials(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    ["9007199254740993.000", "9007199254740993", true, "450359962.74"],
    ["9007199254740993", "9007199254740992", false, "450359962.74"],
    ["-0.000", "0", true, "0.00"],
    ["-0.00000000000000001", "0", false, "0.00"],
  ] as const)(
    "compares gross-profit source %s and display %s without numeric precision loss",
    async (reported, displayed, accepted, percentage) => {
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
                grossMargin: {
                  status: "available",
                  unit: "percent",
                  value: percentage,
                  sources: [
                    { ...source(), concept: "GrossProfit", value: reported },
                    ...row.metrics.revenue.sources,
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
                grossMargin: {
                  status: "unavailable",
                  unit: "percent",
                  reason: "filing_mismatch",
                  sources: [first, second, ...row.metrics.revenue.sources],
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
                grossMargin: {
                  status: "unavailable",
                  unit: "percent",
                  reason,
                  sources: row.metrics.revenue.sources,
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

  it("sends v9 criteria and retains the complete eighteen-metric, thirteen-Frame response", async () => {
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
    expect(decoded.schemaVersion).toBe("9.0.0");
    expect(decoded.formulaVersion).toBe("1.7.0");
    expect(Object.keys(decoded.rows[0]!.metrics)).toEqual([
      "revenue",
      "grossProfit",
      "netIncome",
      "operatingIncome",
      "operatingCashFlow",
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
      "ppePurchases",
      "operatingCashFlowLessPpePurchases",
      "grossMargin",
      "operatingCashFlowToNetIncome",
      "operatingCashFlowLessPpePurchasesMargin",
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
      "currentAssetsLessCurrentLiabilities",
      "revenueGrowth",
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
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "AssetsCurrent",
      "LiabilitiesCurrent",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(input));
  });

  it.each([
    "1.0.0",
    "2.0.0",
    "3.0.0",
    "4.0.0",
    "5.0.0",
    "6.0.0",
    "7.0.0",
    "8.0.0",
  ])(
    "rejects historical %s requests before transport",
    async (schemaVersion) => {
      await expect(
        screenPersonalFinancials(
          {
            ...request(),
            schemaVersion,
          } as unknown as PersonalFinancialScreenRequestDto,
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    "historical v1",
    "historical v2",
    "expanded v1",
    "expanded v2",
    "expanded v3",
    "expanded v4",
    "historical v1 shape relabeled v6",
    "historical v2 shape relabeled v6",
    "missing metric",
    "missing coverage",
    "duplicate source",
    "sixteenth metric",
    "old formula version",
  ])("rejects incompatible response: %s", async (kind) => {
    const result = response();
    const row = result.rows[0]!;
    const metrics = { ...row.metrics } as Record<string, unknown>;
    const coverage = { ...result.metricCoverage } as Record<string, unknown>;
    let invalid: unknown = result;
    if (kind === "historical v1") invalid = historicalResponse();
    if (kind === "historical v2") invalid = historicalResponse("2.0.0");
    if (kind === "expanded v1") invalid = { ...result, schemaVersion: "1.0.0" };
    if (kind === "expanded v2") invalid = { ...result, schemaVersion: "2.0.0" };
    if (kind === "expanded v3") invalid = { ...result, schemaVersion: "3.0.0" };
    if (kind === "expanded v4") invalid = { ...result, schemaVersion: "4.0.0" };
    if (kind === "historical v1 shape relabeled v6")
      invalid = {
        ...historicalResponse(),
        schemaVersion: "6.0.0",
        formulaVersion: "1.4.0",
      };
    if (kind === "historical v2 shape relabeled v6")
      invalid = {
        ...historicalResponse("2.0.0"),
        schemaVersion: "6.0.0",
        formulaVersion: "1.4.0",
      };
    if (kind === "old formula version")
      invalid = { ...result, formulaVersion: "1.0.0" };
    if (kind === "missing metric") {
      delete metrics.ppePurchases;
      invalid = { ...result, rows: [{ ...row, metrics }] };
    }
    if (kind === "missing coverage") {
      delete coverage.operatingCashFlowLessPpePurchases;
      invalid = { ...result, metricCoverage: coverage };
    }
    if (kind === "duplicate source")
      invalid = {
        ...result,
        sources: [...result.sources.slice(0, 7), result.sources[0]],
      };
    if (kind === "sixteenth metric")
      invalid = {
        ...result,
        rows: [
          {
            ...row,
            metrics: { ...metrics, inventedMargin: row.metrics.netMargin },
          },
        ],
        metricCoverage: {
          ...coverage,
          inventedMargin: { known: 1, unknown: 0 },
        },
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
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              grossProfit,
              grossMargin: {
                ...(status === "available"
                  ? { status, value: "0.00" }
                  : { status, reason: "conflicting" }),
                unit: "percent",
                sources: [
                  ...grossProfit.sources,
                  ...row.metrics.revenue.sources,
                ],
              },
            },
          },
        ],
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
      "grossMargin",
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
      "operatingCashFlowLessPpePurchasesMargin",
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
    metrics.revenueGrowth = unavailableGrowth(metrics.revenue);
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
    const result = cashResponse(
      cashCell(
        "NetCashProvidedByUsedInOperatingActivities",
        "-123456789.123456",
      ),
      cashCell("PaymentsToAcquirePropertyPlantAndEquipment", "400000000.1"),
      "-523456789.223456",
    );
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
  it("round-trips the new ratio beside untouched legacy criteria in saved schema 1", async () => {
    const legacy = savedPayload().views[0]!;
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        legacy,
        {
          ...legacy,
          id: "screen-operating-income-ratio",
          name: "Operating cash flow / net income",
          criteria: {
            ...legacy.criteria,
            clauses: [
              {
                field: "operatingCashFlowToNetIncome",
                operator: "gte",
                value: "-10.005",
              },
            ],
            sort: { field: "operatingCashFlowToNetIncome", direction: "desc" },
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
    expect(saved.payload.views[1]?.criteria).not.toHaveProperty("revenueBasis");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ payload }),
    );
    fetchMock.mockResolvedValueOnce(json(response()));
    const input = { ...request(), criteria: payload.views[1]!.criteria };
    await expect(screenPersonalFinancials(input, signal())).resolves.toEqual(
      response(),
    );
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify(input));
  });

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

// Keep older, unrelated fixtures internally consistent when their original operands change.
// New cash-margin arithmetic tests below supply literal expected values independently.
function cashMarginFixture(
  operating: PersonalFinancialScreenAnnualCellDto,
  purchases: PersonalFinancialScreenAnnualCellDto,
  revenue: PersonalFinancialScreenAnnualCellDto,
): PersonalFinancialScreenAnnualCellDto {
  const sources = [
    ...operating.sources,
    ...purchases.sources,
    ...revenue.sources,
  ];
  const unknown = (
    reason: Extract<
      PersonalFinancialScreenAnnualCellDto,
      { status: "unavailable" }
    >["reason"],
  ): PersonalFinancialScreenAnnualCellDto => ({
    status: "unavailable",
    unit: "percent",
    reason,
    sources,
  });
  if (revenue.status === "unavailable") return unknown(revenue.reason);
  if (operating.status === "unavailable") return unknown(operating.reason);
  if (purchases.status === "unavailable") return unknown(purchases.reason);
  if (
    sources.some((ref) => {
      const days =
        (Date.parse(ref.endDate) - Date.parse(ref.startDate)) / 86_400_000 + 1;
      return (
        ref.startDate !== sources[0]!.startDate ||
        ref.endDate !== sources[0]!.endDate ||
        days < 335 ||
        days > 395
      );
    })
  )
    return unknown("period_mismatch");
  if (new Set(sources.map((ref) => ref.accessionNumber)).size > 1)
    return unknown("filing_mismatch");
  if (Number(purchases.value) < 0) return unknown("unsupported_sign");
  if (Number(revenue.value) <= 0) return unknown("nonpositive_revenue");
  const precision = Math.max(
    ...[operating.value, purchases.value, revenue.value].map(
      (value) => value.split(".")[1]?.length ?? 0,
    ),
  );
  const integer = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(`${whole}${fraction.padEnd(precision, "0")}`);
  };
  const numerator =
    (integer(operating.value) - integer(purchases.value)) * 10_000n;
  const denominator = integer(revenue.value);
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded = (magnitude * 2n + denominator) / (2n * denominator);
  return {
    status: "available",
    unit: "percent",
    sources,
    value: `${numerator < 0n && rounded !== 0n ? "-" : ""}${rounded / 100n}.${(rounded % 100n).toString().padStart(2, "0")}`,
  };
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function request(): PersonalFinancialScreenRequestDto {
  return {
    schemaVersion: "9.0.0",
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
function ratioOperand(
  concept:
    "GrossProfit" | Exclude<PersonalFinancialRevenueBasisDto, "agreement">,
  value: string,
): PersonalFinancialScreenAnnualCellDto {
  return {
    status: "available",
    unit: "USD",
    value,
    sources: [{ ...source(), concept, value }],
  };
}
function growthSources(
  current: PersonalFinancialScreenAnnualCellDto,
  prior: PersonalFinancialScreenAnnualCellDto,
  year = 2024,
): PersonalFinancialScreenGrowthCellDto["sources"] {
  return [
    ...current.sources.map((ref) => ({
      ...ref,
      role: "current_revenue" as const,
      calendarYear: year,
    })),
    ...prior.sources.map((ref) => ({
      ...ref,
      role: "prior_revenue" as const,
      calendarYear: year - 1,
    })),
  ] as PersonalFinancialScreenGrowthCellDto["sources"];
}
function unavailableGrowth(
  current: PersonalFinancialScreenAnnualCellDto,
): PersonalFinancialScreenGrowthCellDto {
  const prior: PersonalFinancialScreenAnnualCellDto = {
    status: "unavailable",
    unit: "USD",
    reason: "missing",
    sources: [],
  };
  return {
    status: "unavailable",
    unit: "percent",
    reason: "prior_unavailable",
    currentRevenue: current,
    priorRevenue: prior,
    sources: growthSources(current, prior),
  };
}
function growthOperand(
  year: number,
  value: string,
  concepts: readonly Exclude<
    PersonalFinancialRevenueBasisDto,
    "agreement"
  >[] = ["Revenues"],
): PersonalFinancialScreenAnnualCellDto {
  return {
    status: "available",
    unit: "USD",
    value,
    sources: concepts.map((concept) => ({
      concept,
      accessionNumber: `0000000001-${String(year + 1).slice(-2)}-000001`,
      startDate: `${String(year)}-01-01`,
      endDate: `${String(year)}-12-31`,
      value,
    })),
  };
}
function growthResponse(
  current: PersonalFinancialScreenAnnualCellDto,
  prior: PersonalFinancialScreenAnnualCellDto,
  expected: string,
  basis: PersonalFinancialRevenueBasisDto = "agreement",
  year = 2024,
): PersonalFinancialScreenResponseDto {
  const missing: PersonalFinancialScreenAnnualCellDto = {
    status: "unavailable",
    unit: "USD",
    reason: "missing",
    sources: [],
  };
  const result = ratioResponse(
    current,
    missing,
    { reason: current.status === "unavailable" ? current.reason : "missing" },
    basis,
  );
  const row = result.rows[0]!;
  const common = {
    unit: "percent" as const,
    currentRevenue: current,
    priorRevenue: prior,
    sources: growthSources(current, prior, year),
  };
  const revenueGrowth: PersonalFinancialScreenGrowthCellDto = /^-?\d/u.test(
    expected,
  )
    ? { ...common, status: "available", value: expected }
    : {
        ...common,
        status: "unavailable",
        reason: expected as Extract<
          PersonalFinancialScreenGrowthCellDto,
          { status: "unavailable" }
        >["reason"],
      };
  const instant = Object.fromEntries(
    PERSONAL_FINANCIAL_SCREEN_INSTANT_METRICS.map((metric) => {
      const cell = row.metrics[metric];
      return [
        metric,
        {
          ...cell,
          sources: cell.sources.map((ref) => ({
            ...ref,
            asOfDate: `${String(year)}-12-31`,
          })),
        },
      ];
    }),
  );
  return {
    ...result,
    calendarYear: year,
    priorCalendarYear: year - 1,
    sources: result.sources.map((s) => ({
      ...s,
      sourceUrl: personalFinancialSourceUrl(s.concept, year),
    })),
    priorRevenueSources: result.priorRevenueSources.map((s) => ({
      ...s,
      sourceUrl: personalFinancialSourceUrl(s.concept, year - 1),
    })),
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          ...instant,
          revenueGrowth,
          netMargin: { ...missing, unit: "percent" },
          operatingMargin: { ...missing, unit: "percent" },
          operatingCashFlowMargin: { ...missing, unit: "percent" },
        },
      },
    ],
    metricCoverage: {
      ...result.metricCoverage,
      revenueGrowth: {
        known: revenueGrowth.status === "available" ? 1 : 0,
        unknown: revenueGrowth.status === "unavailable" ? 1 : 0,
      },
    },
  };
}
function incomeRatioOperand(
  concept: "NetIncomeLoss" | "NetCashProvidedByUsedInOperatingActivities",
  value: string,
): PersonalFinancialScreenAnnualCellDto {
  return {
    status: "available",
    unit: "USD",
    value,
    sources: [{ ...source(), concept, value }],
  };
}
function incomeRatioResponse(
  operating: PersonalFinancialScreenAnnualCellDto,
  income: PersonalFinancialScreenAnnualCellDto,
  expected:
    | string
    | {
        reason: Extract<
          PersonalFinancialScreenAnnualCellDto,
          { status: "unavailable" }
        >["reason"];
      },
  basis?: PersonalFinancialRevenueBasisDto,
): PersonalFinancialScreenResponseDto {
  const result = basis === undefined ? response() : responseWithBasis(basis);
  const row = result.rows[0]!;
  const sources = [...operating.sources, ...income.sources];
  const operatingCashFlowToNetIncome: PersonalFinancialScreenAnnualCellDto =
    typeof expected === "string"
      ? { status: "available", unit: "percent", value: expected, sources }
      : {
          status: "unavailable",
          unit: "percent",
          reason: expected.reason,
          sources,
        };
  // Keep unrelated subtraction/margins unknown so this fixture only specifies the ratio under test.
  const missing: PersonalFinancialScreenAnnualCellDto = {
    status: "unavailable",
    unit: "USD",
    reason: "missing",
    sources: [],
  };
  return {
    ...result,
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          operatingCashFlow: operating,
          netIncome: income,
          operatingCashFlowToNetIncome,
          operatingCashFlowLessPpePurchasesMargin: cashMarginFixture(
            operating,
            missing,
            row.metrics.revenue,
          ),
          ppePurchases: missing,
          operatingCashFlowLessPpePurchases: {
            ...missing,
            reason:
              operating.status === "unavailable" ? operating.reason : "missing",
            sources: operating.sources,
          },
          netMargin: { ...missing, unit: "percent" },
          operatingCashFlowMargin: { ...missing, unit: "percent" },
        },
      },
    ],
  };
}
function ratioResponse(
  revenue: PersonalFinancialScreenAnnualCellDto,
  profit: PersonalFinancialScreenAnnualCellDto,
  expected:
    | string
    | {
        reason: Extract<
          PersonalFinancialScreenAnnualCellDto,
          { status: "unavailable" }
        >["reason"];
      },
  basis?: PersonalFinancialRevenueBasisDto,
): PersonalFinancialScreenResponseDto {
  const result = basis === undefined ? response() : responseWithBasis(basis);
  const row = result.rows[0]!;
  const sources = [...profit.sources, ...revenue.sources];
  const grossMargin: PersonalFinancialScreenAnnualCellDto =
    typeof expected === "string"
      ? { status: "available", unit: "percent", value: expected, sources }
      : {
          status: "unavailable",
          unit: "percent",
          reason: expected.reason,
          sources,
        };
  return {
    ...result,
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          revenue,
          revenueGrowth: unavailableGrowth(revenue),
          operatingCashFlowLessPpePurchasesMargin: cashMarginFixture(
            row.metrics.operatingCashFlow,
            row.metrics.ppePurchases,
            revenue,
          ),
          grossProfit: profit,
          grossMargin,
        },
      },
    ],
  };
}
function cashRef(
  concept:
    | "NetCashProvidedByUsedInOperatingActivities"
    | "PaymentsToAcquirePropertyPlantAndEquipment",
  value: string,
): PersonalFinancialScreenSourceRefDto {
  return { ...source(), concept, value };
}
function cashCell(
  concept:
    | "NetCashProvidedByUsedInOperatingActivities"
    | "PaymentsToAcquirePropertyPlantAndEquipment",
  value: string,
): PersonalFinancialScreenAnnualCellDto {
  return {
    status: "available",
    unit: "USD",
    value,
    sources: [cashRef(concept, value)],
  };
}
function cashResponse(
  operating: PersonalFinancialScreenAnnualCellDto,
  purchases: PersonalFinancialScreenAnnualCellDto,
  derived:
    | string
    | {
        reason: Extract<
          PersonalFinancialScreenAnnualCellDto,
          { status: "unavailable" }
        >["reason"];
      },
): PersonalFinancialScreenResponseDto {
  const result = response();
  const row = result.rows[0]!;
  const sources = [...operating.sources, ...purchases.sources];
  const cell: PersonalFinancialScreenAnnualCellDto =
    typeof derived === "string"
      ? { status: "available", unit: "USD", value: derived, sources }
      : { status: "unavailable", unit: "USD", reason: derived.reason, sources };
  return {
    ...result,
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          operatingCashFlow: operating,
          ppePurchases: purchases,
          operatingCashFlowLessPpePurchases: cell,
          operatingCashFlowLessPpePurchasesMargin: cashMarginFixture(
            operating,
            purchases,
            row.metrics.revenue,
          ),
          netIncome: {
            status: "unavailable",
            unit: "USD",
            reason: "missing",
            sources: [],
          },
          operatingCashFlowToNetIncome: {
            status: "unavailable",
            unit: "percent",
            reason: "missing",
            sources: operating.sources,
          },
        },
      },
    ],
  };
}
function instantOperand(
  concept: PersonalFinancialScreenInstantSourceRefDto["concept"],
  value: string,
  asOfDate = "2024-12-31",
): PersonalFinancialScreenInstantCellDto {
  return {
    status: "available",
    unit: "USD",
    value,
    sources: [
      { concept, accessionNumber: "0000000001-25-000001", asOfDate, value },
    ],
  };
}
function defaultInstantCells() {
  const currentAssets = instantOperand("AssetsCurrent", "100");
  const currentLiabilities = instantOperand("LiabilitiesCurrent", "80");
  const currentRatio: PersonalFinancialScreenInstantCellDto = {
    status: "available",
    unit: "multiple",
    value: "1.25",
    sources: [...currentAssets.sources, ...currentLiabilities.sources],
  };
  return {
    currentAssets,
    currentLiabilities,
    currentRatio,
    currentAssetsLessCurrentLiabilities: {
      status: "available",
      unit: "USD",
      value: "20",
      sources: [...currentAssets.sources, ...currentLiabilities.sources],
    } as PersonalFinancialScreenInstantCellDto,
  };
}

function balanceDifferenceFixture(
  assets: PersonalFinancialScreenInstantCellDto,
  liabilities: PersonalFinancialScreenInstantCellDto,
): PersonalFinancialScreenInstantCellDto {
  const sources = [...assets.sources, ...liabilities.sources];
  const unknown = (
    reason: Extract<
      PersonalFinancialScreenInstantCellDto,
      { status: "unavailable" }
    >["reason"],
  ): PersonalFinancialScreenInstantCellDto => ({
    status: "unavailable",
    unit: "USD",
    reason,
    sources,
  });
  if (assets.status === "unavailable") return unknown(assets.reason);
  if (liabilities.status === "unavailable") return unknown(liabilities.reason);
  if (new Set(sources.map((source) => source.asOfDate)).size > 1)
    return unknown("balance_date_mismatch");
  if (new Set(sources.map((source) => source.accessionNumber)).size > 1)
    return unknown("filing_mismatch");
  if (Number(assets.value) < 0 || Number(liabilities.value) < 0)
    return unknown("unsupported_sign");
  const precision = Math.max(
    ...[assets.value, liabilities.value].map(
      (value) => value.split(".")[1]?.length ?? 0,
    ),
  );
  const integer = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(`${whole}${fraction.padEnd(precision, "0")}`);
  };
  const amount = integer(assets.value) - integer(liabilities.value);
  const digits = (amount < 0n ? -amount : amount)
    .toString()
    .padStart(precision + 1, "0");
  const magnitude =
    precision === 0
      ? digits
      : `${digits.slice(0, -precision)}.${digits.slice(-precision)}`.replace(
          /\.?0+$/u,
          "",
        );
  return {
    status: "available",
    unit: "USD",
    value: `${amount < 0n ? "-" : ""}${magnitude}`,
    sources,
  };
}
function currentResponse(
  currentAssets: PersonalFinancialScreenInstantCellDto,
  currentLiabilities: PersonalFinancialScreenInstantCellDto,
  value: string | null,
  reason: Extract<
    PersonalFinancialScreenInstantCellDto,
    { status: "unavailable" }
  >["reason"] = "missing",
): PersonalFinancialScreenResponseDto {
  const result = response();
  const row = result.rows[0]!;
  const sources = [...currentAssets.sources, ...currentLiabilities.sources];
  const currentRatio: PersonalFinancialScreenInstantCellDto =
    value === null
      ? { status: "unavailable", unit: "multiple", reason, sources }
      : { status: "available", unit: "multiple", value, sources };
  return {
    ...result,
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          currentAssets,
          currentLiabilities,
          currentRatio,
          currentAssetsLessCurrentLiabilities: balanceDifferenceFixture(
            currentAssets,
            currentLiabilities,
          ),
        },
      },
    ],
  };
}
function response(): PersonalFinancialScreenResponseDto {
  return {
    schemaVersion: "9.0.0",
    catalogSnapshotSha256: sha("a"),
    financialSnapshotSha256: sha("b"),
    calendarYear: 2024,
    priorCalendarYear: 2023,
    fetchedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:30:00.000Z",
    instantQuarter: 4,
    sources: [
      ...PERSONAL_SEC_ANNUAL_CONCEPTS,
      ...PERSONAL_SEC_INSTANT_CONCEPTS,
    ].map((concept) => ({
      concept,
      status: "available",
      sourceUrl: personalFinancialSourceUrl(concept, 2024),
    })),
    priorRevenueSources: PERSONAL_FINANCIAL_REVENUE_BASES.filter(
      (basis) => basis !== "agreement",
    ).map((concept) => ({
      concept,
      status: "available",
      sourceUrl: personalFinancialSourceUrl(concept, 2023),
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
          PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => {
            if (metric === "revenueGrowth")
              return [
                metric,
                unavailableGrowth(ratioOperand("Revenues", "2000000000")),
              ];
            if (
              metric === "currentAssets" ||
              metric === "currentLiabilities" ||
              metric === "currentRatio" ||
              metric === "currentAssetsLessCurrentLiabilities"
            )
              return [metric, defaultInstantCells()[metric]];
            if (metric === "operatingCashFlowLessPpePurchasesMargin")
              return [
                metric,
                cashMarginFixture(
                  cashCell(
                    "NetCashProvidedByUsedInOperatingActivities",
                    "2000000000",
                  ),
                  cashCell(
                    "PaymentsToAcquirePropertyPlantAndEquipment",
                    "400000000.1",
                  ),
                  ratioOperand("Revenues", "2000000000"),
                ),
              ];
            if (metric === "operatingCashFlowToNetIncome")
              return [
                metric,
                {
                  status: "available",
                  unit: "percent",
                  value: "100.00",
                  sources: [
                    {
                      ...source(),
                      concept: "NetCashProvidedByUsedInOperatingActivities",
                    },
                    { ...source(), concept: "NetIncomeLoss" },
                  ],
                },
              ];
            if (metric === "grossMargin")
              return [
                metric,
                {
                  status: "available",
                  unit: "percent",
                  value: "100.00",
                  sources: [{ ...source(), concept: "GrossProfit" }, source()],
                },
              ];
            if (metric === "ppePurchases")
              return [
                metric,
                cashCell(
                  "PaymentsToAcquirePropertyPlantAndEquipment",
                  "400000000.1",
                ),
              ];
            if (metric === "operatingCashFlowLessPpePurchases")
              return [
                metric,
                {
                  status: "available",
                  unit: "USD",
                  value: "1599999999.9",
                  sources: [
                    cashRef(
                      "NetCashProvidedByUsedInOperatingActivities",
                      "2000000000",
                    ),
                    cashRef(
                      "PaymentsToAcquirePropertyPlantAndEquipment",
                      "400000000.1",
                    ),
                  ],
                },
              ];
            return [
              metric,
              {
                status: "available",
                value: "2000000000",
                unit: metric.endsWith("Margin") ? "percent" : "USD",
                sources: [
                  {
                    ...source(),
                    concept:
                      metric === "grossProfit"
                        ? "GrossProfit"
                        : metric === "netIncome"
                          ? "NetIncomeLoss"
                          : metric === "operatingCashFlow"
                            ? "NetCashProvidedByUsedInOperatingActivities"
                            : "Revenues",
                  },
                ],
              },
            ];
          }),
        ) as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
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
        metric === "revenueGrowth"
          ? { known: 0, unknown: 1 }
          : { known: 1, unknown: 0 },
      ]),
    ) as PersonalFinancialScreenResponseDto["metricCoverage"],
    offset: 0,
    limitApplied: 25,
    hasMore: false,
    formulaVersion: "1.7.0",
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
        ...row.metrics,
        revenue: { ...row.metrics.revenue, sources: [ref(basis)] },
        operatingCashFlowLessPpePurchasesMargin: cashMarginFixture(
          row.metrics.operatingCashFlow,
          row.metrics.ppePurchases,
          { ...row.metrics.revenue, sources: [ref(basis)] },
        ),
        revenueGrowth: unavailableGrowth({
          ...row.metrics.revenue,
          sources: [ref(basis)],
        }),
        grossProfit: row.metrics.grossProfit,
        grossMargin: {
          ...row.metrics.grossMargin,
          sources: [...row.metrics.grossProfit.sources, ref(basis)],
        },
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
// Keep both historical shapes literal; expanded metric/concept enums must not widen them.
function historicalResponse(version: "1.0.0" | "2.0.0" = "1.0.0") {
  const result = response();
  const row = result.rows[0]!;
  return {
    ...result,
    schemaVersion: version,
    formulaVersion: "1.0.0",
    sources: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
      "OperatingIncomeLoss",
      "NetCashProvidedByUsedInOperatingActivities",
      ...(version === "2.0.0" ? ["GrossProfit"] : []),
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
          ...(version === "2.0.0"
            ? { grossProfit: row.metrics.grossProfit }
            : {}),
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
      ...(version === "2.0.0" ? { grossProfit: { known: 1, unknown: 0 } } : {}),
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
