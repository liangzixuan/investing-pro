import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalFinancialRevenueBasisDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialScreenCellDto,
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
    const revenue: PersonalFinancialScreenCellDto = {
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
    "propagates %s with revenue before profit and exact source retention",
    async (reason) => {
      for (const operand of ["revenue", "profit", "both"] as const) {
        const knownRevenue = ratioOperand("Revenues", "0");
        const knownProfit = ratioOperand("GrossProfit", "-1");
        const revenue: PersonalFinancialScreenCellDto =
          operand === "profit"
            ? knownRevenue
            : {
                status: "unavailable",
                unit: "USD",
                reason,
                sources: knownRevenue.sources,
              };
        const profit: PersonalFinancialScreenCellDto =
          operand === "revenue"
            ? knownProfit
            : {
                status: "unavailable",
                unit: "USD",
                reason: operand === "both" ? "source_unavailable" : reason,
                sources: knownProfit.sources,
              };
        const result = ratioResponse(revenue, profit, { reason });
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
        const operating: PersonalFinancialScreenCellDto =
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
        const purchases: PersonalFinancialScreenCellDto =
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
    const purchases: PersonalFinancialScreenCellDto = {
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
            grossMargin: {
              status: "unavailable",
              unit: "percent",
              reason: "missing",
              sources: row.metrics.grossProfit.sources,
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

  it("sends v4 criteria and retains the complete eleven-metric, eight-source response", async () => {
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
    expect(decoded.schemaVersion).toBe("4.0.0");
    expect(decoded.formulaVersion).toBe("1.2.0");
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
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(input));
  });

  it.each(["1.0.0", "2.0.0", "3.0.0"])(
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
    "historical v1 shape relabeled v4",
    "historical v2 shape relabeled v4",
    "missing metric",
    "missing coverage",
    "duplicate source",
    "twelfth metric",
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
    if (kind === "historical v1 shape relabeled v4")
      invalid = {
        ...historicalResponse(),
        schemaVersion: "4.0.0",
        formulaVersion: "1.2.0",
      };
    if (kind === "historical v2 shape relabeled v4")
      invalid = {
        ...historicalResponse("2.0.0"),
        schemaVersion: "4.0.0",
        formulaVersion: "1.2.0",
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
    if (kind === "twelfth metric")
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
    schemaVersion: "4.0.0",
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
): PersonalFinancialScreenCellDto {
  return {
    status: "available",
    unit: "USD",
    value,
    sources: [{ ...source(), concept, value }],
  };
}
function ratioResponse(
  revenue: PersonalFinancialScreenCellDto,
  profit: PersonalFinancialScreenCellDto,
  expected:
    | string
    | {
        reason: Extract<
          PersonalFinancialScreenCellDto,
          { status: "unavailable" }
        >["reason"];
      },
  basis?: PersonalFinancialRevenueBasisDto,
): PersonalFinancialScreenResponseDto {
  const result = basis === undefined ? response() : responseWithBasis(basis);
  const row = result.rows[0]!;
  const sources = [...profit.sources, ...revenue.sources];
  const grossMargin: PersonalFinancialScreenCellDto =
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
        metrics: { ...row.metrics, revenue, grossProfit: profit, grossMargin },
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
): PersonalFinancialScreenCellDto {
  return {
    status: "available",
    unit: "USD",
    value,
    sources: [cashRef(concept, value)],
  };
}
function cashResponse(
  operating: PersonalFinancialScreenCellDto,
  purchases: PersonalFinancialScreenCellDto,
  derived:
    | string
    | {
        reason: Extract<
          PersonalFinancialScreenCellDto,
          { status: "unavailable" }
        >["reason"];
      },
): PersonalFinancialScreenResponseDto {
  const result = response();
  const row = result.rows[0]!;
  const sources = [...operating.sources, ...purchases.sources];
  const cell: PersonalFinancialScreenCellDto =
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
        },
      },
    ],
  };
}
function response(): PersonalFinancialScreenResponseDto {
  return {
    schemaVersion: "4.0.0",
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
          PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => {
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
        { known: 1, unknown: 0 },
      ]),
    ) as PersonalFinancialScreenResponseDto["metricCoverage"],
    offset: 0,
    limitApplied: 25,
    hasMore: false,
    formulaVersion: "1.2.0",
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
