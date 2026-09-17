import { randomBytes } from "node:crypto";

import type {
  PersonalFinancialSavedViewsPayloadDto,
  PersonalFinancialScreenRequestDto,
  PersonalFinancialScreenResponseDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  LocalResearchVaultError,
  type JsonValue,
  type LocalResearchRecord,
  type LocalResearchVault,
  type PutLocalResearchRecordCommand,
} from "@research-cockpit/local-research-vault";
import {
  admitPersonalSecurityMasterSnapshot,
  screenPersonalSecurityMaster,
} from "@research-cockpit/personal-security-master";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
} from "./personal-owner-session-routes";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { bootstrapTestPersonalOwnerSession } from "./test-personal-owner-session-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";
import {
  PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
  PERSONAL_FINANCIAL_SCREEN_PATH,
  PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
} from "./workspace-financial-screen-routes";

const LISTEN_OPTIONS = { host: "127.0.0.1" as const, port: 3100 };
const applications: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map(async (app) => app.close()));
});

import {
  PERSONAL_FINANCIAL_REVENUE_BASES,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  PERSONAL_SEC_INSTANT_CONCEPTS,
  PERSONAL_SEC_REVENUE_CONCEPTS,
  PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS,
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  type PersonalSecFinancialSnapshotDto,
} from "@research-cockpit/contracts";
import {
  createSecPersonalFinancialProvider,
  PersonalSecFinancialProviderError,
} from "./personal-sec-financial-provider";

describe("personal annual financial screen routes", () => {
  it.each([
    ["investingCashFlow", "NetCashProvidedByUsedInInvestingActivities"],
    ["financingCashFlow", "NetCashProvidedByUsedInFinancingActivities"],
    ["commonDividendsPaid", "PaymentsOfDividendsCommonStock"],
    ["commonStockRepurchases", "PaymentsForRepurchaseOfCommonStock"],
    ["interestPaidNet", "InterestPaidNet"],
    ["incomeTaxesPaidNet", "IncomeTaxesPaidNet"],
  ] as const)(
    "filters, sorts, pages and saves signed %s independently of revenue and preserves literal old layouts",
    async (metric, concept) => {
      const provider = testProvider();
      const original = snapshot();
      provider.loadSnapshot.mockResolvedValue({
        ...original,
        frames: original.frames.map((frame) =>
          frame.concept === concept
            ? {
                ...frame,
                facts: ["-25.000001", "0", "100.25"].map((value, index) => ({
                  ...frame.facts[0]!,
                  cik: String(index + 1).padStart(10, "0"),
                  startDate: "2025-02-01",
                  endDate: "2026-01-31",
                  accessionNumber: "0000000001-26-000099",
                  value,
                })),
              }
            : frame,
        ),
      });
      const f = await readyApp(provider, 6);
      const request = {
        ...screenRequest(f.snapshotSha256),
        page: { offset: 0, limit: 10 },
      };
      for (const revenueBasis of PERSONAL_FINANCIAL_REVENUE_BASES) {
        for (const [direction, expected] of [
          ["asc", ["-25.000001", "-25.000001", "0", "0", "100.25", "100.25"]],
          ["desc", ["100.25", "100.25", "0", "0", "-25.000001", "-25.000001"]],
        ] as const) {
          const criteria = {
            ...request.criteria,
            revenueBasis,
            sort: { field: metric, direction },
          } as const;
          const response = await screen(f.app, f.cookie, {
            ...request,
            criteria,
          });
          expect(response.statusCode).toBe(200);
          const body = response.json<PersonalFinancialScreenResponseDto>();
          expect(
            body.rows.map((row) =>
              row.metrics[metric].status === "available"
                ? row.metrics[metric].value
                : null,
            ),
          ).toEqual(expected);
          expect(body.metricCoverage[metric]).toEqual({ known: 6, unknown: 0 });
          expect(body.sources.length + body.priorRevenueSources.length).toBe(
            23,
          );
          expect(body.rows[0]?.metrics[metric].sources).toEqual([
            expect.objectContaining({
              concept,
              startDate: "2025-02-01",
              endDate: "2026-01-31",
              accessionNumber: "0000000001-26-000099",
            }),
          ]);
          const filtered = await screen(f.app, f.cookie, {
            ...request,
            criteria: {
              ...criteria,
              clauses: [
                { field: metric, operator: "gte", value: "-25.000001" },
                { field: metric, operator: "lte", value: "-25.000001" },
              ],
            },
          });
          expect(filtered.json()).toMatchObject({
            totalMatches: 2,
            totalNonMatches: 4,
            totalUnknown: 0,
          });
          const page = await screen(f.app, f.cookie, {
            ...request,
            criteria,
            financialSnapshotSha256: body.financialSnapshotSha256,
            page: { offset: 1, limit: 1 },
          });
          expect(page.json<PersonalFinancialScreenResponseDto>().rows).toEqual([
            body.rows[1],
          ]);
        }
      }
      provider.loadSnapshot.mockClear();
      const oldColumns = [
        "revenue",
        "grossProfit",
        "netIncome",
        "operatingIncome",
        "operatingCashFlow",
        "investingCashFlow",
        "financingCashFlow",
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
        "totalAssets",
        "totalLiabilities",
        "cashAndCashEquivalents",
        "stockholdersEquity",
        "revenueGrowth",
      ] as const;
      const predecessorColumns = [
        "revenue",
        "grossProfit",
        "netIncome",
        "operatingIncome",
        "operatingCashFlow",
        "investingCashFlow",
        "financingCashFlow",
        "commonDividendsPaid",
        "commonStockRepurchases",
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
        "totalAssets",
        "totalLiabilities",
        "cashAndCashEquivalents",
        "stockholdersEquity",
        "revenueGrowth",
      ] as const;
      const legacy = savedViewsPayload(f.snapshotSha256).views[0]!;
      const payload: PersonalFinancialSavedViewsPayloadDto = {
        schemaVersion: 2,
        views: [
          { ...legacy, display: { visibleMetrics: oldColumns } },
          {
            ...legacy,
            id: `signed-${metric.toLowerCase()}`,
            name: "Signed cash flow",
            criteria: {
              ...legacy.criteria,
              clauses: [
                { field: metric, operator: "gte", value: "-25.000001" },
              ],
              sort: { field: metric, direction: "asc" },
            },
            display: { visibleMetrics: [metric] },
          },
          {
            ...legacy,
            id: "literal-predecessor-columns",
            name: "Existing twenty-six columns",
            display: { visibleMetrics: predecessorColumns },
          },
        ],
      };
      expect(oldColumns).toHaveLength(24);
      expect(predecessorColumns).toHaveLength(26);
      expect(
        (
          await putSavedViews(
            f.app,
            f.cookie,
            payload,
            0,
            `save-signed-${metric}`,
          )
        ).statusCode,
      ).toBe(201);
      const loaded = await f.app.inject({
        method: "GET",
        url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
        headers: ownerHeaders(f.cookie),
        remoteAddress: "127.0.0.1",
      });
      expect(loaded.json()).toMatchObject({ payload });
      expect(provider.loadSnapshot).not.toHaveBeenCalled();
      expect(f.vault.record?.payload).toEqual(payload);
      const savedV1: PersonalFinancialSavedViewsPayloadDto = {
        schemaVersion: 1,
        views: [{ ...legacy, criteria: payload.views[1]!.criteria }],
      };
      expect(
        (await putSavedViews(f.app, f.cookie, savedV1, 1, `save-v1-${metric}`))
          .statusCode,
      ).toBe(200);
      expect(
        (await getSavedViews(f.app, f.cookie)).json<LocalResearchRecord>()
          .payload,
      ).toEqual(savedV1);
      expect(provider.loadSnapshot).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["interestPaidNet", "InterestPaidNet"],
    ["incomeTaxesPaidNet", "IncomeTaxesPaidNet"],
  ] as const)(
    "keeps %s missing, conflicting or failed independently of every other metric",
    async (metric, concept) => {
      const provider = testProvider();
      const original = snapshot();
      const f = await readyApp(provider);
      const request = screenRequest(f.snapshotSha256);
      const baseline = (
        await screen(f.app, f.cookie, request)
      ).json<PersonalFinancialScreenResponseDto>();
      for (const [mode, reason] of [
        ["missing", "missing"],
        ["conflicting", "conflicting"],
        ["failed", "source_unavailable"],
      ] as const) {
        provider.loadSnapshot.mockResolvedValue({
          ...original,
          frames: original.frames.map((frame) =>
            frame.concept !== concept
              ? frame
              : {
                  ...frame,
                  status:
                    mode === "failed" ? "upstream_unavailable" : "available",
                  facts: [],
                  unknownCiks: mode === "conflicting" ? ["0000000001"] : [],
                },
          ),
        });
        const response = await screen(f.app, f.cookie, request);
        expect(response.statusCode).toBe(200);
        const body = response.json<PersonalFinancialScreenResponseDto>();
        expect(body.rows[0]?.metrics[metric]).toMatchObject({
          status: "unavailable",
          unit: "USD",
          reason,
        });
        expect(body.metricCoverage[metric]).toEqual({ known: 0, unknown: 2 });
        const others = PERSONAL_FINANCIAL_SCREEN_METRICS.filter(
          (field) => field !== metric,
        );
        expect(others).toHaveLength(27);
        for (const other of others) {
          expect(body.rows[0]?.metrics[other]).toEqual(
            baseline.rows[0]?.metrics[other],
          );
          expect(body.metricCoverage[other]).toEqual(
            baseline.metricCoverage[other],
          );
        }
        const filtered = await screen(f.app, f.cookie, {
          ...request,
          criteria: {
            ...request.criteria,
            clauses: [{ field: metric, operator: "gte", value: "0" }],
          },
        });
        expect(filtered.json()).toMatchObject({
          totalMatches: 0,
          totalNonMatches: 0,
          totalUnknown: 2,
          rows: [],
        });
      }
      expect(f.vault.record).toBeUndefined();
    },
  );

  it.each([
    "InterestPaidNet",
    "IncomeTaxesPaidNet",
    "interestPaid",
    "interestPaidCapitalized",
    "incomeTaxesPaid",
    "interestExpense",
    "incomeTaxExpenseBenefit",
    "incomeTaxRefundsDiscontinuedOperations",
    "interestCoverage",
    "effectiveCashTaxRate",
  ])(
    "rejects unsupported cash-payment field %s before source acquisition",
    async (field) => {
      const f = await readyApp();
      const request = screenRequest(f.snapshotSha256);
      for (const criteria of [
        { ...request.criteria, sort: { field, direction: "asc" } },
        {
          ...request.criteria,
          clauses: [{ field, operator: "gte", value: "0" }],
        },
      ]) {
        expect(
          (await screen(f.app, f.cookie, { ...request, criteria })).statusCode,
        ).toBe(400);
      }
      expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
      expect(f.vault.record).toBeUndefined();
    },
  );

  it("authenticates before parsing and returns issuer financial metrics for both share-class listings", async () => {
    const f = await readyApp();
    const unauthorized = await f.app.inject({
      method: "POST",
      url: PERSONAL_FINANCIAL_SCREEN_PATH,
      headers: { ...ownerHeaders(), "content-type": "application/json" },
      payload: "{ private-financial-canary",
      remoteAddress: "127.0.0.1",
    });
    expect(unauthorized.statusCode).toBe(403);
    expect(unauthorized.payload).not.toContain("private-financial-canary");
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    const response = await screen(
      f.app,
      f.cookie,
      screenRequest(f.snapshotSha256),
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json<PersonalFinancialScreenResponseDto>();
    expect(body).toMatchObject({
      schemaVersion: "14.0.0",
      totalUniverse: 2,
      identityMatches: 2,
      totalMatches: 2,
      totalUnknown: 0,
      hasMore: true,
      rows: [
        {
          identity: { symbol: "S00000" },
          metrics: {
            revenue: { status: "available", value: "1000" },
            grossProfit: { status: "available", value: "100" },
            grossMargin: { status: "available", value: "10.00" },
            operatingCashFlowToNetIncome: {
              status: "available",
              value: "100.00",
              unit: "percent",
            },
            ppePurchases: { status: "available", value: "100" },
            operatingCashFlowLessPpePurchases: {
              status: "available",
              value: "0",
            },
            netMargin: { status: "available", value: "10.00" },
          },
        },
      ],
    });
    expect(f.vault.record).toBeUndefined();
    expect(body).not.toHaveProperty("revenueBasis");
    const metricKeys = [
      "revenue",
      "grossProfit",
      "netIncome",
      "operatingIncome",
      "operatingCashFlow",
      "investingCashFlow",
      "financingCashFlow",
      "commonDividendsPaid",
      "commonStockRepurchases",
      "interestPaidNet",
      "incomeTaxesPaidNet",
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
      "totalAssets",
      "totalLiabilities",
      "cashAndCashEquivalents",
      "stockholdersEquity",
      "revenueGrowth",
    ];
    expect(Object.keys(body.rows[0]!.metrics)).toEqual(metricKeys);
    expect(Object.keys(body.metricCoverage)).toEqual(metricKeys);
    expect(body.sources.map((source) => source.concept)).toEqual([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "NetIncomeLoss",
      "OperatingIncomeLoss",
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByUsedInInvestingActivities",
      "NetCashProvidedByUsedInFinancingActivities",
      "PaymentsOfDividendsCommonStock",
      "PaymentsForRepurchaseOfCommonStock",
      "InterestPaidNet",
      "IncomeTaxesPaidNet",
      "GrossProfit",
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "AssetsCurrent",
      "LiabilitiesCurrent",
      "Assets",
      "Liabilities",
      "CashAndCashEquivalentsAtCarryingValue",
      "StockholdersEquity",
    ]);
    expect(body.priorCalendarYear).toBe(2024);
    expect(body.priorRevenueSources).toEqual(
      PERSONAL_SEC_REVENUE_CONCEPTS.map((concept) => ({
        concept,
        status: "available",
        sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2024.json`,
      })),
    );
    expect(body.rows[0]?.metrics.revenueGrowth).toMatchObject({
      status: "available",
      value: "25.00",
      unit: "percent",
      currentRevenue: body.rows[0]?.metrics.revenue,
      priorRevenue: {
        status: "available",
        value: "800",
        sources: [
          {
            startDate: "2024-01-01",
            endDate: "2024-12-31",
            accessionNumber: "0000000001-25-000001",
          },
        ],
      },
      sources: [
        { role: "current_revenue", calendarYear: 2025 },
        { role: "prior_revenue", calendarYear: 2024 },
      ],
    });
  });

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "filters, sorts and pages growth using one selected %s basis and one financial digest",
    async (revenueBasis) => {
      const f = await readyApp();
      const initial = snapshot();
      f.provider.loadSnapshot.mockResolvedValue({
        ...initial,
        frames: initial.frames.map((frame, index) =>
          index < 3 ? { ...frame, facts: initial.frames[0]!.facts } : frame,
        ),
        priorRevenueFrames: initial.priorRevenueFrames.map((frame) => ({
          ...frame,
          facts: initial.priorRevenueFrames[0]!.facts,
        })),
      });
      const request = screenRequest(f.snapshotSha256);
      for (const direction of ["asc", "desc"] as const) {
        const criteria = {
          ...request.criteria,
          revenueBasis,
          clauses: [
            { field: "revenueGrowth", operator: "gte", value: "25.00" },
            { field: "revenueGrowth", operator: "lte", value: "25.00" },
          ],
          sort: { field: "revenueGrowth", direction },
        } as const;
        const first = await screen(f.app, f.cookie, { ...request, criteria });
        expect(first.statusCode).toBe(200);
        const body = first.json<PersonalFinancialScreenResponseDto>();
        expect(body).toMatchObject({
          schemaVersion: "14.0.0",
          formulaVersion: "1.7.0",
          priorCalendarYear: 2024,
          revenueBasis,
          totalMatches: 2,
          hasMore: true,
          metricCoverage: { revenueGrowth: { known: 2, unknown: 0 } },
        });
        expect(body.rows[0]?.metrics.revenueGrowth).toMatchObject({
          status: "available",
          value: "25.00",
        });
        expect(body.rows[0]?.metrics.revenueGrowth.currentRevenue).toEqual(
          body.rows[0]?.metrics.revenue,
        );
        const second = await screen(f.app, f.cookie, {
          ...request,
          criteria,
          financialSnapshotSha256: body.financialSnapshotSha256,
          page: { offset: 1, limit: 1 },
        });
        expect(second.statusCode).toBe(200);
        const next = second.json<PersonalFinancialScreenResponseDto>();
        expect(next).toMatchObject({
          financialSnapshotSha256: body.financialSnapshotSha256,
          hasMore: false,
        });
        expect(next.rows[0]?.identity.listingId).not.toBe(
          body.rows[0]?.identity.listingId,
        );
        expect(next.rows[0]?.metrics).toEqual(body.rows[0]?.metrics);
      }
      expect(
        (
          await screen(f.app, f.cookie, {
            ...request,
            criteria: {
              ...request.criteria,
              revenueBasis,
              clauses: [
                { field: "revenueGrowth", operator: "gte", value: "25.01" },
              ],
            },
          })
        ).json(),
      ).toMatchObject({ totalMatches: 0, totalNonMatches: 2, totalUnknown: 0 });
      expect(f.vault.record).toBeUndefined();
    },
  );

  it("keeps prior-source failure explicit, rejects client prior-year overrides, and conflicts on prior-only snapshot changes", async () => {
    const f = await readyApp();
    const initial = snapshot();
    const request = screenRequest(f.snapshotSha256);
    const before = (
      await screen(f.app, f.cookie, request)
    ).json<PersonalFinancialScreenResponseDto>();
    f.provider.loadSnapshot.mockResolvedValue({
      ...initial,
      snapshotSha256: `sha256:${"d".repeat(64)}`,
      priorRevenueFrames: initial.priorRevenueFrames.map((frame) => ({
        ...frame,
        status: "upstream_unavailable",
        facts: [],
      })),
    });
    const changed = await screen(f.app, f.cookie, {
      ...request,
      refresh: true,
    });
    expect(changed.statusCode).toBe(200);
    const body = changed.json<PersonalFinancialScreenResponseDto>();
    expect(body.rows[0]?.metrics.revenue).toEqual(
      before.rows[0]?.metrics.revenue,
    );
    expect(body.sources).toEqual(before.sources);
    expect(body.rows[0]?.metrics.revenueGrowth).toMatchObject({
      status: "unavailable",
      reason: "prior_unavailable",
      priorRevenue: { status: "unavailable", reason: "source_unavailable" },
      currentRevenue: before.rows[0]?.metrics.revenue,
    });
    expect(
      body.priorRevenueSources.every(
        (source) => source.status === "upstream_unavailable",
      ),
    ).toBe(true);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...request,
          financialSnapshotSha256: before.financialSnapshotSha256,
          page: { offset: 1, limit: 1 },
        })
      ).statusCode,
    ).toBe(409);
    for (const invalid of [
      { ...request, priorCalendarYear: 2023 },
      {
        ...request,
        criteria: { ...request.criteria, priorCalendarYear: 2023 },
      },
    ]) {
      const calls = f.provider.loadSnapshot.mock.calls.length;
      expect((await screen(f.app, f.cookie, invalid)).statusCode).toBe(400);
      expect(f.provider.loadSnapshot).toHaveBeenCalledTimes(calls);
    }
  });

  it("round-trips growth and original 2009 criteria in saved payload 1 without acquiring sources or rewriting the old view", async () => {
    const f = await readyApp();
    const legacy = savedViewsPayload(f.snapshotSha256);
    const oldView = {
      ...legacy.views[0]!,
      criteria: { ...legacy.views[0]!.criteria, calendarYear: 2009 },
    };
    const growthView = {
      ...oldView,
      id: "revenue-growth",
      name: "Reported revenue change",
      criteria: {
        ...screenRequest(f.snapshotSha256).criteria,
        revenueBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
        clauses: [
          { field: "revenueGrowth", operator: "gte", value: "-125.00" },
        ],
        sort: { field: "revenueGrowth", direction: "desc" },
      },
    } as const;
    const saved = { schemaVersion: 1, views: [oldView, growthView] } as const;
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          saved,
          0,
          "save-growth-and-legacy-2009",
        )
      ).statusCode,
    ).toBe(201);
    const loaded = await f.app.inject({
      method: "GET",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
      headers: ownerHeaders(f.cookie),
      remoteAddress: "127.0.0.1",
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json()).toMatchObject({ version: 1, payload: saved });
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(f.vault.record?.payload).toEqual(saved);
    const source = snapshot();
    f.provider.loadSnapshot.mockResolvedValue({
      ...source,
      calendarYear: 2009,
      priorCalendarYear: 2008,
      frames: source.frames.map((frame) => ({
        ...frame,
        sourceUrl: frame.sourceUrl.replace("2025", "2009"),
        facts: frame.facts.map((fact) => ({
          ...fact,
          startDate: "2009-01-01",
          endDate: "2009-12-31",
        })),
      })),
      instantFrames: source.instantFrames.map((frame) => ({
        ...frame,
        sourceUrl: frame.sourceUrl.replace("2025", "2009"),
        facts: frame.facts.map((fact) => ({ ...fact, asOfDate: "2009-12-31" })),
      })),
      priorRevenueFrames: source.priorRevenueFrames.map((frame) => ({
        ...frame,
        sourceUrl: frame.sourceUrl.replace("2024", "2008"),
        status: "not_covered",
        facts: [],
      })),
    });
    const replay = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: oldView.criteria,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({
      calendarYear: 2009,
      priorCalendarYear: 2008,
      totalMatches: 2,
      rows: [
        {
          metrics: {
            revenue: { status: "available", value: "1000" },
            revenueGrowth: {
              status: "unavailable",
              reason: "prior_unavailable",
            },
          },
        },
      ],
    });
    expect(f.provider.loadSnapshot).toHaveBeenCalledWith(
      2009,
      expect.any(AbortSignal),
      false,
    );
    expect(f.vault.record?.payload).toEqual(saved);
  });

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "filters and sorts signed balance differences independently of %s revenue with the same twenty-three Frames",
    async (revenueBasis) => {
      const provider = testProvider();
      const original = snapshot();
      provider.loadSnapshot.mockResolvedValue({
        ...original,
        instantFrames: original.instantFrames.map((frame) => ({
          ...frame,
          facts: ["100", "200", "0"].map((assets, index) => ({
            ...frame.facts[0]!,
            cik: String(index + 1).padStart(10, "0"),
            value: frame.concept === "AssetsCurrent" ? assets : "125",
          })),
        })),
      });
      const f = await readyApp(provider, 6);
      const request = {
        ...screenRequest(f.snapshotSha256),
        page: { offset: 0, limit: 10 },
      };
      for (const [direction, expected] of [
        ["asc", ["-125", "-125", "-25", "-25", "75", "75"]],
        ["desc", ["75", "75", "-25", "-25", "-125", "-125"]],
      ] as const) {
        const criteria = {
          ...request.criteria,
          revenueBasis,
          sort: { field: "currentAssetsLessCurrentLiabilities", direction },
        } as const;
        const response = await screen(f.app, f.cookie, {
          ...request,
          criteria,
        });
        expect(response.statusCode).toBe(200);
        const result = response.json<PersonalFinancialScreenResponseDto>();
        expect(
          result.rows.map((row) =>
            row.metrics.currentAssetsLessCurrentLiabilities.status ===
            "available"
              ? row.metrics.currentAssetsLessCurrentLiabilities.value
              : null,
          ),
        ).toEqual(expected);
        expect(result).toMatchObject({
          schemaVersion: "14.0.0",
          formulaVersion: "1.7.0",
          metricCoverage: {
            currentAssetsLessCurrentLiabilities: { known: 6, unknown: 0 },
          },
        });
        expect(result.sources).toHaveLength(20);
        expect(result.priorRevenueSources).toHaveLength(3);
        const filtered = await screen(f.app, f.cookie, {
          ...request,
          criteria: {
            ...criteria,
            clauses: [
              {
                field: "currentAssetsLessCurrentLiabilities",
                operator: "gte",
                value: "-25",
              },
              {
                field: "currentAssetsLessCurrentLiabilities",
                operator: "lte",
                value: "-25.00",
              },
            ],
          },
        });
        expect(filtered.json()).toMatchObject({
          totalMatches: 2,
          totalNonMatches: 4,
          totalUnknown: 0,
        });
      }
      expect(f.vault.record).toBeUndefined();
    },
  );

  it("keeps zero liabilities available for subtraction and round-trips signed saved-v1 criteria", async () => {
    const f = await readyApp();
    const original = snapshot();
    f.provider.loadSnapshot.mockResolvedValue({
      ...original,
      instantFrames: original.instantFrames.map((frame) => ({
        ...frame,
        facts: frame.facts.map((fact) => ({
          ...fact,
          value: "0",
        })),
      })),
    });
    const legacy = savedViewsPayload(f.snapshotSha256);
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        ...legacy.views,
        {
          ...legacy.views[0]!,
          id: "balance-difference",
          name: "Balance difference",
          criteria: {
            ...legacy.views[0]!.criteria,
            clauses: [
              {
                field: "currentAssetsLessCurrentLiabilities",
                operator: "gte",
                value: "-0.01",
              },
              {
                field: "currentAssetsLessCurrentLiabilities",
                operator: "lte",
                value: "0",
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
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          payload,
          0,
          "save-balance-difference-view",
        )
      ).statusCode,
    ).toBe(201);
    const loaded = await f.app.inject({
      method: "GET",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
      headers: ownerHeaders(f.cookie),
      remoteAddress: "127.0.0.1",
    });
    expect(loaded.json()).toMatchObject({ payload, version: 1 });
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    const result = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: payload.views[1]!.criteria,
    });
    expect(result.json()).toMatchObject({
      totalMatches: 2,
      totalUnknown: 0,
      rows: [
        {
          metrics: {
            currentAssetsLessCurrentLiabilities: {
              status: "available",
              unit: "USD",
              value: "0",
            },
            currentRatio: {
              status: "unavailable",
              reason: "nonpositive_current_liabilities",
            },
          },
        },
      ],
    });
    expect(f.vault.record?.payload).toEqual(payload);
    expect(payload.views[0]).toEqual(legacy.views[0]);
  });

  it("exposes the fixed Q4 selection and the original four instant metrics with inclusive multiple thresholds", async () => {
    const f = await readyApp();
    const request = screenRequest(f.snapshotSha256);
    const criteria = {
      ...request.criteria,
      clauses: [
        { field: "currentAssets", operator: "gte", value: "200" },
        { field: "currentLiabilities", operator: "lte", value: "100" },
        { field: "currentRatio", operator: "gte", value: "2.00" },
      ],
      sort: { field: "currentRatio", direction: "desc" },
    };
    const response = await screen(f.app, f.cookie, { ...request, criteria });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: "14.0.0",
      formulaVersion: "1.7.0",
      instantQuarter: 4,
      totalMatches: 2,
      rows: [
        {
          metrics: {
            currentAssets: {
              status: "available",
              value: "200",
              unit: "USD",
              sources: [{ concept: "AssetsCurrent", asOfDate: "2025-12-31" }],
            },
            currentLiabilities: {
              status: "available",
              value: "100",
              unit: "USD",
            },
            currentRatio: {
              status: "available",
              value: "2.00",
              unit: "multiple",
            },
            currentAssetsLessCurrentLiabilities: {
              status: "available",
              value: "100",
              unit: "USD",
            },
          },
        },
      ],
    });
    const excluded = await screen(f.app, f.cookie, {
      ...request,
      criteria: {
        ...criteria,
        clauses: [{ field: "currentRatio", operator: "gte", value: "2.01" }],
      },
    });
    expect(excluded.json()).toMatchObject({
      totalMatches: 0,
      totalNonMatches: 2,
      totalUnknown: 0,
    });
    for (const invalid of [
      { ...request, instantQuarter: 4 },
      { ...request, criteria: { ...request.criteria, instantQuarter: 4 } },
      { ...request, criteria: { ...request.criteria, quarter: 3 } },
    ]) {
      const calls = f.provider.loadSnapshot.mock.calls.length;
      expect((await screen(f.app, f.cookie, invalid)).statusCode).toBe(400);
      expect(f.provider.loadSnapshot).toHaveBeenCalledTimes(calls);
    }
  });

  it("retains unsupported actual balance dates and isolates instant source failures from all annual metrics", async () => {
    const f = await readyApp();
    const request = screenRequest(f.snapshotSha256);
    const original = (
      await screen(f.app, f.cookie, request)
    ).json<PersonalFinancialScreenResponseDto>();
    const outside = snapshot();
    f.provider.loadSnapshot.mockResolvedValue({
      ...outside,
      instantFrames: outside.instantFrames.map((frame) => ({
        ...frame,
        facts: frame.facts.map((fact) => ({ ...fact, asOfDate: "2026-01-31" })),
      })),
    });
    const dated = (
      await screen(f.app, f.cookie, request)
    ).json<PersonalFinancialScreenResponseDto>();
    expect(dated.rows[0]?.metrics.currentAssets).toMatchObject({
      status: "unavailable",
      reason: "unsupported_balance_date",
      sources: [{ asOfDate: "2026-01-31", value: "200" }],
    });
    expect(dated.rows[0]?.metrics.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "unsupported_balance_date",
    });
    f.provider.loadSnapshot.mockResolvedValue({
      ...outside,
      instantFrames: outside.instantFrames.map((frame) => ({
        ...frame,
        status: "upstream_unavailable",
        facts: [],
        unknownCiks: [],
      })),
    });
    const failed = (
      await screen(f.app, f.cookie, request)
    ).json<PersonalFinancialScreenResponseDto>();
    expect(failed.rows[0]?.metrics.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "source_unavailable",
    });
    for (const metric of PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS) {
      expect(dated.rows[0]?.metrics[metric]).toEqual(
        original.rows[0]?.metrics[metric],
      );
      expect(failed.rows[0]?.metrics[metric]).toEqual(
        original.rows[0]?.metrics[metric],
      );
      expect(failed.metricCoverage[metric]).toEqual(
        original.metricCoverage[metric],
      );
    }
  });

  it("round-trips all instant criteria through saved-v1 without a quarter field or rewriting legacy definitions", async () => {
    const f = await readyApp();
    const legacy = savedViewsPayload(f.snapshotSha256);
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        ...legacy.views,
        {
          ...legacy.views[0]!,
          id: "liquidity",
          name: "Current liquidity",
          criteria: {
            ...legacy.views[0]!.criteria,
            clauses: [
              { field: "currentAssets", operator: "gte", value: "0" },
              { field: "currentLiabilities", operator: "gte", value: "1" },
              { field: "currentRatio", operator: "gte", value: "1" },
            ],
            sort: { field: "currentRatio", direction: "asc" },
          },
        },
      ],
    };
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          payload,
          0,
          "save-current-liquidity-view",
        )
      ).statusCode,
    ).toBe(201);
    const loaded = await f.app.inject({
      method: "GET",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
      headers: ownerHeaders(f.cookie),
      remoteAddress: "127.0.0.1",
    });
    expect(loaded.json()).toMatchObject({ payload, version: 1 });
    expect(f.vault.record?.payload).toEqual(payload);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(payload.views[1]?.criteria).not.toHaveProperty("instantQuarter");
    expect(
      (
        await screen(f.app, f.cookie, {
          ...screenRequest(f.snapshotSha256),
          criteria: payload.views[1]!.criteria,
        })
      ).json(),
    ).toMatchObject({ totalMatches: 2, instantQuarter: 4 });
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          legacy,
          1,
          "restore-original-liquidity-view",
        )
      ).statusCode,
    ).toBe(200);
    expect(f.vault.record?.payload).toEqual(legacy);
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
    "9.0.0",
    "10.0.0",
    "11.0.0",
    "12.0.0",
    "13.0.0",
    "15.0.0",
    1,
    undefined,
  ])(
    "rejects transport version %s before source acquisition",
    async (schemaVersion) => {
      const f = await readyApp();
      // Literal historical criteria remain valid; only the HTTP version changes.
      const response = await screen(f.app, f.cookie, {
        schemaVersion,
        catalogSnapshotSha256: f.snapshotSha256,
        financialSnapshotSha256: null,
        criteria: {
          calendarYear: 2025,
          identityText: "",
          clauses: [{ field: "revenue", operator: "gte", value: "0" }],
          sort: { field: "symbol", direction: "asc" },
        },
        page: { offset: 0, limit: 1 },
        refresh: false,
      });
      expect(response.statusCode).toBe(400);
      expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
      expect(f.vault.record).toBeUndefined();
    },
  );
  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "accepts and echoes explicit revenue basis %s without changing source acquisition",
    async (revenueBasis) => {
      const f = await readyApp();
      const base = screenRequest(f.snapshotSha256);
      const response = await screen(f.app, f.cookie, {
        ...base,
        criteria: { ...base.criteria, revenueBasis },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        revenueBasis,
        formulaVersion: "1.7.0",
      });
      const cell =
        response.json<PersonalFinancialScreenResponseDto>().rows[0]!.metrics
          .revenue;
      if (
        revenueBasis === "agreement" ||
        revenueBasis === "RevenueFromContractWithCustomerExcludingAssessedTax"
      )
        expect(cell).toMatchObject({ status: "available", value: "1000" });
      else
        expect(cell).toMatchObject({
          status: "unavailable",
          reason: "missing",
        });
      expect(f.provider.loadSnapshot).toHaveBeenCalledExactlyOnceWith(
        2025,
        expect.any(AbortSignal),
        false,
      );
      expect(f.vault.record).toBeUndefined();
      expect(
        response.json<PersonalFinancialScreenResponseDto>().rows[0]!.metrics
          .grossProfit,
      ).toMatchObject({ status: "available", value: "100" });
      expect(
        response.json<PersonalFinancialScreenResponseDto>().rows[0]!.metrics
          .operatingCashFlowToNetIncome,
      ).toMatchObject({
        status: "available",
        value: "100.00",
        unit: "percent",
      });
      expect(
        response.json<PersonalFinancialScreenResponseDto>().rows[0]!.metrics
          .grossMargin,
      ).toMatchObject(
        revenueBasis === "agreement" ||
          revenueBasis === "RevenueFromContractWithCustomerExcludingAssessedTax"
          ? { status: "available", value: "10.00" }
          : { status: "unavailable", reason: "missing" },
      );
    },
  );
  it("filters signed operating cash flow to net income and pages both share classes against one snapshot", async () => {
    const f = await readyApp();
    f.provider.loadSnapshot.mockResolvedValue({
      ...snapshot(),
      frames: snapshot().frames.map((frame) => ({
        ...frame,
        facts: frame.facts.map((fact) => ({
          ...fact,
          value:
            frame.concept === "NetCashProvidedByUsedInOperatingActivities"
              ? "-1.005"
              : frame.concept === "NetIncomeLoss"
                ? "100"
                : fact.value,
        })),
      })),
    });
    const request: PersonalFinancialScreenRequestDto = {
      ...screenRequest(f.snapshotSha256),
      criteria: {
        ...screenRequest(f.snapshotSha256).criteria,
        revenueBasis: "SalesRevenueNet",
        clauses: [
          {
            field: "operatingCashFlowToNetIncome",
            operator: "lte",
            value: "-1.01",
          },
        ],
        sort: { field: "operatingCashFlowToNetIncome", direction: "asc" },
      },
    };
    const first = await screen(f.app, f.cookie, request);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      schemaVersion: "14.0.0",
      totalMatches: 2,
      totalUnknown: 0,
      metricCoverage: {
        operatingCashFlowToNetIncome: { known: 2, unknown: 0 },
      },
      rows: [
        {
          metrics: {
            revenue: { status: "unavailable", reason: "missing" },
            operatingCashFlowToNetIncome: {
              status: "available",
              value: "-1.01",
              unit: "percent",
            },
          },
        },
      ],
    });
    const second = await screen(f.app, f.cookie, {
      ...request,
      financialSnapshotSha256: FINANCIAL_DIGEST,
      page: { offset: 1, limit: 1 },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      offset: 1,
      hasMore: false,
      totalMatches: 2,
    });
    const firstRow = first.json<PersonalFinancialScreenResponseDto>().rows[0]!;
    const secondRow =
      second.json<PersonalFinancialScreenResponseDto>().rows[0]!;
    expect(secondRow.identity.symbol).not.toBe(firstRow.identity.symbol);
    expect(secondRow.metrics.operatingCashFlowToNetIncome).toEqual(
      firstRow.metrics.operatingCashFlowToNetIncome,
    );
    expect(f.vault.record).toBeUndefined();
  });
  it.each(["0", "-100"])(
    "keeps nonpositive net income %s inspectable and its ratio filter unknown",
    async (netIncome) => {
      const f = await readyApp();
      f.provider.loadSnapshot.mockResolvedValue({
        ...snapshot(),
        frames: snapshot().frames.map((frame) => ({
          ...frame,
          facts:
            frame.concept === "NetIncomeLoss"
              ? frame.facts.map((fact) => ({ ...fact, value: netIncome }))
              : frame.facts,
        })),
      });
      const request = screenRequest(f.snapshotSha256);
      const unfiltered = await screen(f.app, f.cookie, request);
      expect(unfiltered.statusCode).toBe(200);
      expect(unfiltered.json()).toMatchObject({
        rows: [
          {
            metrics: {
              netIncome: { status: "available", value: netIncome },
              operatingCashFlow: { status: "available", value: "100" },
              operatingCashFlowToNetIncome: {
                status: "unavailable",
                reason: "nonpositive_net_income",
                unit: "percent",
              },
            },
          },
        ],
      });
      expect(
        unfiltered.json<PersonalFinancialScreenResponseDto>().rows[0]!.metrics
          .operatingCashFlowToNetIncome.sources,
      ).toHaveLength(2);
      const filtered = await screen(f.app, f.cookie, {
        ...request,
        criteria: {
          ...request.criteria,
          clauses: [
            {
              field: "operatingCashFlowToNetIncome",
              operator: "gte",
              value: "0",
            },
          ],
        },
      });
      expect(filtered.statusCode).toBe(200);
      expect(filtered.json()).toMatchObject({
        totalMatches: 0,
        totalNonMatches: 0,
        totalUnknown: 2,
        rows: [],
      });
      expect(f.vault.record).toBeUndefined();
    },
  );
  it("rejects stale catalogs before fetching, malformed filters, and mixed snapshot pages", async () => {
    const f = await readyApp();
    const req = screenRequest(f.snapshotSha256);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          catalogSnapshotSha256: "sha256:" + "f".repeat(64),
        })
      ).statusCode,
    ).toBe(409);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(
      (await screen(f.app, f.cookie, { ...req, page: { offset: 1, limit: 1 } }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          refresh: true,
          page: { offset: 1, limit: 1 },
        })
      ).statusCode,
    ).toBe(400);
    for (const criteria of [
      { ...req.criteria, calendarYear: new Date().getUTCFullYear() },
      {
        ...req.criteria,
        clauses: [{ field: "revenue", operator: "gte", value: "NaN" }],
      },
    ]) {
      expect(
        (await screen(f.app, f.cookie, { ...req, criteria })).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          financialSnapshotSha256: "sha256:" + "e".repeat(64),
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...req,
          financialSnapshotSha256: FINANCIAL_DIGEST,
          page: { offset: 1, limit: 1 },
        })
      ).json(),
    ).toMatchObject({
      offset: 1,
      hasMore: false,
      rows: [{ identity: { symbol: "S00001" } }],
    });
  });
  it("keeps unavailable sources unknown and forwards explicit refresh", async () => {
    const provider = testProvider();
    provider.loadSnapshot.mockResolvedValue({
      ...snapshot(),
      frames: snapshot().frames.map((frame) => ({
        ...frame,
        status: "upstream_unavailable" as const,
        facts: [],
      })),
    });
    const f = await readyApp(provider);
    const req = screenRequest(f.snapshotSha256);
    const response = await screen(f.app, f.cookie, {
      ...req,
      refresh: true,
      criteria: {
        ...req.criteria,
        clauses: [{ field: "revenue", operator: "gte", value: "0" }],
      },
    });
    expect(response.json()).toMatchObject({
      totalMatches: 0,
      totalUnknown: 2,
      rows: [],
      metricCoverage: { revenue: { known: 0, unknown: 2 } },
    });
    expect(provider.loadSnapshot).toHaveBeenCalledWith(
      2025,
      expect.any(AbortSignal),
      true,
    );
  });
  it("returns actionable missing configuration and bounded upstream errors without echoing details", async () => {
    const provider = testProvider();
    const f = await readyApp(provider);
    for (const [code, status] of [
      ["not_configured", 503],
      ["busy", 429],
      ["aborted", 502],
    ] as const) {
      provider.loadSnapshot.mockRejectedValueOnce(
        new PersonalSecFinancialProviderError(code),
      );
      expect(
        (await screen(f.app, f.cookie, screenRequest(f.snapshotSha256)))
          .statusCode,
      ).toBe(status);
    }
    provider.loadSnapshot.mockRejectedValueOnce(
      new Error("private-contact-canary"),
    );
    const failed = await screen(
      f.app,
      f.cookie,
      screenRequest(f.snapshotSha256),
    );
    expect(failed.statusCode).toBe(502);
    expect(failed.payload).not.toContain("private-contact-canary");
  });
  it("isolates a missing GrossProfit frame while preserving old metric results and the seven-clause limit", async () => {
    const provider = testProvider();
    provider.loadSnapshot.mockResolvedValue({
      ...snapshot(),
      frames: snapshot().frames.map((frame) =>
        frame.concept === "GrossProfit"
          ? { ...frame, status: "not_covered" as const, facts: [] }
          : frame,
      ),
    });
    const f = await readyApp(provider);
    const base = screenRequest(f.snapshotSha256);
    const clauses = Array.from({ length: 7 }, () => ({
      field: "grossProfit" as const,
      operator: "gte" as const,
      value: "0",
    }));
    const response = await screen(f.app, f.cookie, {
      ...base,
      criteria: { ...base.criteria, clauses },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totalMatches: 0,
      totalUnknown: 2,
      metricCoverage: {
        grossProfit: { known: 0, unknown: 2 },
        revenue: { known: 2, unknown: 0 },
        netMargin: { known: 2, unknown: 0 },
      },
    });
    provider.loadSnapshot.mockClear();
    const invalid = { ...base.criteria, clauses: [...clauses, clauses[0]] };
    expect(
      (await screen(f.app, f.cookie, { ...base, criteria: invalid }))
        .statusCode,
    ).toBe(400);
    const saved = savedViewsPayload(f.snapshotSha256);
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          { ...saved, views: [{ ...saved.views[0], criteria: invalid }] },
          0,
          "gross-profit-eight-clauses",
        )
      ).statusCode,
    ).toBe(400);
    expect(provider.loadSnapshot).not.toHaveBeenCalled();
    expect(f.vault.record).toBeUndefined();
  });
  it("creates, reads, and updates only the bounded saved-view definition record", async () => {
    const fixture = await readyApp();
    const absent = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(absent.statusCode).toBe(404);

    const payload = savedViewsPayload(fixture.snapshotSha256);
    const created = await putSavedViews(
      fixture.app,
      fixture.cookie,
      payload,
      0,
      "screener-saved-views-create",
    );
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"v1"');
    expect(created.json()).toMatchObject({
      id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      kind: "settings",
      operation: "put",
      version: 1,
    });

    const loaded = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.headers.etag).toBe('"v1"');
    expect(loaded.json()).toMatchObject({
      id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      kind: "settings",
      payload,
      version: 1,
    });
    expect(loaded.payload).not.toContain("rows");
    expect(loaded.payload).not.toContain("totalMatches");

    const updatedPayload = {
      ...payload,
      views: [{ ...payload.views[0], name: "Nasdaq catalog" }],
    } as const;
    const updated = await putSavedViews(
      fixture.app,
      fixture.cookie,
      updatedPayload,
      1,
      "screener-saved-views-update",
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.headers.etag).toBe('"v2"');
    expect(fixture.vault.record?.payload).toEqual(updatedPayload);

    const staleUpdate = await putSavedViews(
      fixture.app,
      fixture.cookie,
      payload,
      1,
      "screener-stale-saved-views-update",
    );
    expect(staleUpdate.statusCode).toBe(409);
    expect(fixture.vault.record?.payload).toEqual(updatedPayload);
  });

  it("round-trips mixed legacy and explicit saved bases without filling omitted criteria", async () => {
    const f = await readyApp();
    const original = savedViewsPayload(f.snapshotSha256);
    const legacy = original.views[0]!;
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      ...original,
      views: [
        legacy,
        ...PERSONAL_FINANCIAL_REVENUE_BASES.map((revenueBasis, index) => ({
          ...legacy,
          id: `basis-${index}`,
          name: `Basis ${index}`,
          criteria: { ...legacy.criteria, revenueBasis },
        })),
      ],
    };
    const created = await putSavedViews(
      f.app,
      f.cookie,
      payload,
      0,
      "revenue-bases-save",
    );
    expect(created.statusCode).toBe(201);
    const loaded = await f.app.inject({
      headers: ownerHeaders(f.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(loaded.statusCode).toBe(200);
    const stored = loaded.json<{
      payload: PersonalFinancialSavedViewsPayloadDto;
    }>().payload;
    expect(stored).toEqual(payload);
    expect(stored.views[0]!.criteria).not.toHaveProperty("revenueBasis");
    for (const view of stored.views) {
      const response = await screen(f.app, f.cookie, {
        ...screenRequest(f.snapshotSha256),
        criteria: view.criteria,
      });
      expect(response.statusCode).toBe(200);
      if (view.criteria.revenueBasis === undefined)
        expect(response.json()).not.toHaveProperty("revenueBasis");
      else
        expect(response.json()).toHaveProperty(
          "revenueBasis",
          view.criteria.revenueBasis,
        );
    }
    const updated = await putSavedViews(
      f.app,
      f.cookie,
      original,
      1,
      "revenue-bases-restore-legacy",
    );
    expect(updated.statusCode).toBe(200);
    expect(f.vault.record?.payload).toEqual(original);
  });
  it("preserves literal saved-v1 definitions and creation digests while adding new metrics through the existing CAS record", async () => {
    const f = await readyApp();
    const legacy: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        {
          id: "original-screen",
          name: "Original revenue screen",
          criteria: {
            calendarYear: 2025,
            identityText: "",
            clauses: [{ field: "revenue", operator: "gte", value: "1" }],
            sort: { field: "netMargin", direction: "desc" },
          },
          createdAgainstCatalogSnapshotSha256: `sha256:${"d".repeat(64)}`,
          createdAgainstFinancialSnapshotSha256: `sha256:${"e".repeat(64)}`,
        },
      ],
    };
    f.vault.putRecord({
      kind: "settings",
      id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      expectedVersion: 0,
      idempotencyKey: "seed-original-saved-definition",
      payload: legacy as unknown as PutLocalResearchRecordCommand["payload"],
    });
    const mutation = vi.spyOn(f.vault, "putRecord");
    const loaded = await f.app.inject({
      headers: ownerHeaders(f.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(loaded.json()).toMatchObject({ payload: legacy, version: 1 });
    expect(mutation).not.toHaveBeenCalled();
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    const replay = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: legacy.views[0]!.criteria,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({
      schemaVersion: "14.0.0",
      totalMatches: 2,
    });
    expect(replay.json()).not.toHaveProperty("revenueBasis");
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        legacy.views[0]!,
        {
          ...legacy.views[0]!,
          id: "gross-profit-screen",
          name: "Gross profit screen",
          criteria: {
            ...legacy.views[0]!.criteria,
            clauses: [{ field: "grossProfit", operator: "gte", value: "50" }],
            sort: { field: "grossProfit", direction: "desc" },
          },
          createdAgainstCatalogSnapshotSha256: f.snapshotSha256,
          createdAgainstFinancialSnapshotSha256: FINANCIAL_DIGEST,
        },
        {
          ...legacy.views[0]!,
          id: "cash-generation-screen",
          name: "Cash generation screen",
          criteria: {
            ...legacy.views[0]!.criteria,
            clauses: [
              { field: "ppePurchases", operator: "gte", value: "0" },
              {
                field: "operatingCashFlowLessPpePurchases",
                operator: "gte",
                value: "0",
              },
            ],
            sort: {
              field: "operatingCashFlowLessPpePurchases",
              direction: "desc",
            },
          },
          createdAgainstCatalogSnapshotSha256: f.snapshotSha256,
          createdAgainstFinancialSnapshotSha256: FINANCIAL_DIGEST,
        },
        {
          ...legacy.views[0]!,
          id: "gross-profit-ratio-screen",
          name: "Gross profit / selected revenue",
          criteria: {
            ...legacy.views[0]!.criteria,
            revenueBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
            clauses: [{ field: "grossMargin", operator: "gte", value: "10" }],
            sort: { field: "grossMargin", direction: "desc" },
          },
          createdAgainstCatalogSnapshotSha256: f.snapshotSha256,
          createdAgainstFinancialSnapshotSha256: FINANCIAL_DIGEST,
        },
        {
          ...legacy.views[0]!,
          id: "operating-cash-flow-income-screen",
          name: "Operating cash flow / net income",
          criteria: {
            ...legacy.views[0]!.criteria,
            clauses: [
              {
                field: "operatingCashFlowToNetIncome",
                operator: "gte",
                value: "100",
              },
            ],
            sort: { field: "operatingCashFlowToNetIncome", direction: "desc" },
          },
          createdAgainstCatalogSnapshotSha256: f.snapshotSha256,
          createdAgainstFinancialSnapshotSha256: FINANCIAL_DIGEST,
        },
      ],
    };
    const saved = await putSavedViews(
      f.app,
      f.cookie,
      payload,
      1,
      "add-gross-profit-definition",
    );
    expect(saved.statusCode).toBe(200);
    expect(saved.headers.etag).toBe('"v2"');
    expect(mutation).toHaveBeenCalledExactlyOnceWith({
      kind: "settings",
      id: PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID,
      expectedVersion: 1,
      idempotencyKey: "add-gross-profit-definition",
      payload,
    });
    expect(f.vault.record?.payload).toEqual(payload);
    expect(payload.views[0]).toEqual(legacy.views[0]);
    expect(payload.views[0]!.criteria).not.toHaveProperty("revenueBasis");
    expect(
      (
        await screen(f.app, f.cookie, {
          ...screenRequest(f.snapshotSha256),
          criteria: payload.views[1]!.criteria,
        })
      ).json(),
    ).toMatchObject({ schemaVersion: "14.0.0", totalMatches: 2 });
    const cashScreen = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: payload.views[2]!.criteria,
    });
    expect(cashScreen.json()).toMatchObject({
      schemaVersion: "14.0.0",
      formulaVersion: "1.7.0",
      totalMatches: 2,
    });
    const ratioScreen = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: payload.views[3]!.criteria,
    });
    expect(ratioScreen.json()).toMatchObject({
      schemaVersion: "14.0.0",
      formulaVersion: "1.7.0",
      totalMatches: 2,
      metricCoverage: { grossMargin: { known: 2, unknown: 0 } },
      rows: [{ metrics: { grossMargin: { value: "10.00", unit: "percent" } } }],
    });
    const incomeRatioScreen = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: payload.views[4]!.criteria,
    });
    expect(incomeRatioScreen.statusCode).toBe(200);
    expect(incomeRatioScreen.json()).toMatchObject({
      schemaVersion: "14.0.0",
      formulaVersion: "1.7.0",
      totalMatches: 2,
      metricCoverage: {
        operatingCashFlowToNetIncome: { known: 2, unknown: 0 },
      },
      rows: [
        {
          metrics: {
            operatingCashFlowToNetIncome: { value: "100.00", unit: "percent" },
          },
        },
      ],
    });
    const staleSave = await putSavedViews(
      f.app,
      f.cookie,
      legacy,
      1,
      "stale-cash-screen-save",
    );
    expect(staleSave.statusCode).toBe(409);
    expect(f.vault.record?.payload).toEqual(payload);
  });

  it.each([
    [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "operatingCashFlow",
      "ppePurchases",
    ],
    [
      "NetCashProvidedByUsedInOperatingActivities",
      "ppePurchases",
      "operatingCashFlow",
    ],
  ] as const)(
    "keeps the other reported input when %s fails, with unknown filter counts",
    async (concept, retained, failed) => {
      const f = await readyApp();
      f.provider.loadSnapshot.mockResolvedValue({
        ...snapshot(),
        frames: snapshot().frames.map((frame) =>
          frame.concept === concept
            ? { ...frame, status: "upstream_unavailable" as const, facts: [] }
            : frame,
        ),
      });
      const request = screenRequest(f.snapshotSha256);
      const displayed = await screen(f.app, f.cookie, request);
      expect(displayed.statusCode).toBe(200);
      const body = displayed.json<PersonalFinancialScreenResponseDto>();
      expect(body.rows[0]!.metrics[retained]).toMatchObject({
        status: "available",
        value: "100",
      });
      expect(body.rows[0]!.metrics[failed]).toMatchObject({
        status: "unavailable",
        reason: "source_unavailable",
      });
      expect(body.rows[0]!.metrics.operatingCashFlowLessPpePurchases).toEqual({
        status: "unavailable",
        unit: "USD",
        reason: "source_unavailable",
        sources: body.rows[0]!.metrics[retained].sources,
      });
      expect(body.metricCoverage.operatingCashFlowLessPpePurchases).toEqual({
        known: 0,
        unknown: 2,
      });
      expect(body.rows[0]!.metrics.grossProfit.status).toBe("available");
      const filtered = await screen(f.app, f.cookie, {
        ...request,
        criteria: {
          ...request.criteria,
          clauses: [
            {
              field: "operatingCashFlowLessPpePurchases",
              operator: "gte",
              value: "0",
            },
          ],
        },
      });
      expect(filtered.json()).toMatchObject({
        identityMatches: 2,
        totalMatches: 0,
        totalNonMatches: 0,
        totalUnknown: 2,
        rows: [],
      });
      expect(f.vault.record).toBeUndefined();
    },
  );

  it.each([null, "auto", "revenues", "NetIncomeLoss", 1])(
    "rejects invalid revenue basis %j before source acquisition or saved mutation",
    async (revenueBasis) => {
      const f = await readyApp();
      const request = screenRequest(f.snapshotSha256);
      const invalidCriteria = { ...request.criteria, revenueBasis };
      expect(
        (
          await screen(f.app, f.cookie, {
            ...request,
            criteria: invalidCriteria,
          })
        ).statusCode,
      ).toBe(400);
      const saved = savedViewsPayload(f.snapshotSha256);
      expect(
        (
          await putSavedViews(
            f.app,
            f.cookie,
            {
              ...saved,
              views: [{ ...saved.views[0], criteria: invalidCriteria }],
            },
            0,
            "invalid-revenue-basis-save",
          )
        ).statusCode,
      ).toBe(400);
      expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
      expect(f.vault.record).toBeUndefined();
    },
  );

  it("requires exact mutation carriers and rejects unsafe saved definitions", async () => {
    const fixture = await readyApp();
    const payload = savedViewsPayload(fixture.snapshotSha256);
    const unauthorized = await fixture.app.inject({
      headers: {
        ...ownerHeaders(),
        "content-type": "application/json",
        "if-none-match": "*",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "screener-unauthorized-create",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      method: "POST",
      payload: { payload },
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(unauthorized.statusCode).toBe(403);

    const noPrecondition = await fixture.app.inject({
      headers: {
        ...ownerHeaders(fixture.cookie),
        "content-type": "application/json",
        [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]:
          "screener-missing-precondition",
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "personal-vault-create",
      },
      method: "POST",
      payload: { payload },
      remoteAddress: "127.0.0.1",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
    });
    expect(noPrecondition.statusCode).toBe(400);

    const duplicateNames = await putSavedViews(
      fixture.app,
      fixture.cookie,
      {
        schemaVersion: 1,
        views: [
          payload.views[0],
          { ...payload.views[0], id: "nasdaq-two", name: "nasdaq" },
        ],
      },
      0,
      "screener-duplicate-names",
    );
    expect(duplicateNames.statusCode).toBe(400);

    const resultBearingDefinition = await putSavedViews(
      fixture.app,
      fixture.cookie,
      {
        schemaVersion: 1,
        views: [{ ...payload.views[0], rows: [{ symbol: "PRIVATE" }] }],
      },
      0,
      "screener-result-bearing-view",
    );
    expect(resultBearingDefinition.statusCode).toBe(400);
    expect(resultBearingDefinition.payload).not.toContain("PRIVATE");

    const missingRequiredSymbol = await putSavedViews(
      fixture.app,
      fixture.cookie,
      {
        schemaVersion: 1,
        views: [
          {
            ...payload.views[0],
            columns: ["issuer_name", "exchange_mic"],
          },
        ],
      },
      0,
      "screener-missing-symbol-column",
    );
    expect(missingRequiredSymbol.statusCode).toBe(400);

    for (const id of ["ab", "Nasdaq"]) {
      const noncanonicalId = await putSavedViews(
        fixture.app,
        fixture.cookie,
        {
          schemaVersion: 1,
          views: [{ ...payload.views[0], id }],
        },
        0,
        `screener-noncanonical-id-${id.toLowerCase()}`,
      );
      expect(noncanonicalId.statusCode).toBe(400);
    }

    const invalidNormalizedQueries = [
      { id: "punctuation", value: "---" },
      { id: "emoji", value: "😀" },
      { id: "nfkd-expansion", value: "\uFDFA".repeat(128) },
    ];
    for (const { id, value } of invalidNormalizedQueries) {
      const invalidNormalizedSavedQuery = await putSavedViews(
        fixture.app,
        fixture.cookie,
        {
          schemaVersion: 1,
          views: [
            {
              ...payload.views[0],
              query: {
                clauses: [
                  { field: "identity_text", operator: "matches", value },
                ],
                operator: "and",
              },
            },
          ],
        },
        0,
        `screener-invalid-normalized-query-${id}`,
      );
      expect(invalidNormalizedSavedQuery.statusCode).toBe(400);
    }
  });

  it("exposes no saved-view collection through the generic workspace route", async () => {
    const fixture = await readyApp();
    const generic = await fixture.app.inject({
      headers: ownerHeaders(fixture.cookie),
      method: "GET",
      remoteAddress: "127.0.0.1",
      url: "/v1/personal-filing/workspace/screener/saved-views/another",
    });
    expect(generic.statusCode).toBe(404);
  });
});
describe("cash after PP&E / selected revenue route integration", () => {
  const metric = "operatingCashFlowLessPpePurchasesMargin";
  const ocf = "NetCashProvidedByUsedInOperatingActivities";
  const ppe = "PaymentsToAcquirePropertyPlantAndEquipment";
  function cashSnapshot(): PersonalSecFinancialSnapshotDto {
    const initial = snapshot();
    const reference = initial.frames[0]!.facts[0]!;
    return {
      ...initial,
      frames: initial.frames.map((frame) => ({
        ...frame,
        facts: [
          {
            ...reference,
            value:
              frame.concept === ocf
                ? "1.015"
                : frame.concept === ppe
                  ? "2.020"
                  : "100",
          },
        ],
      })),
    };
  }

  it.each(PERSONAL_FINANCIAL_REVENUE_BASES)(
    "filters, sorts and pages signed cash percentages using %s without changing acquisition",
    async (revenueBasis) => {
      const f = await readyApp();
      f.provider.loadSnapshot.mockResolvedValue(cashSnapshot());
      const request = screenRequest(f.snapshotSha256);
      const criteria = {
        ...request.criteria,
        revenueBasis,
        clauses: [
          { field: metric, operator: "gte", value: "-1.01" },
          { field: metric, operator: "lte", value: "-1.01" },
        ],
        sort: { field: metric, direction: "desc" },
      } as const;
      const response = await screen(f.app, f.cookie, { ...request, criteria });
      expect(response.statusCode).toBe(200);
      const body = response.json<PersonalFinancialScreenResponseDto>();
      expect(body).toMatchObject({
        schemaVersion: "14.0.0",
        formulaVersion: "1.7.0",
        revenueBasis,
        totalMatches: 2,
        totalUnknown: 0,
        hasMore: true,
      });
      const cells = body.rows[0]!.metrics;
      expect(cells[metric]).toEqual({
        status: "available",
        unit: "percent",
        value: "-1.01",
        sources: [
          ...cells.operatingCashFlow.sources,
          ...cells.ppePurchases.sources,
          ...cells.revenue.sources,
        ],
      });
      expect(cells[metric].sources).toHaveLength(
        revenueBasis === "agreement" ? 5 : 3,
      );
      expect(body.metricCoverage[metric]).toEqual({ known: 2, unknown: 0 });
      expect(body.sources.length + body.priorRevenueSources.length).toBe(23);
      expect(f.provider.loadSnapshot).toHaveBeenCalledExactlyOnceWith(
        2025,
        expect.any(AbortSignal),
        false,
      );
      const next = await screen(f.app, f.cookie, {
        ...request,
        criteria,
        financialSnapshotSha256: body.financialSnapshotSha256,
        page: { offset: 1, limit: 1 },
      });
      expect(next.statusCode).toBe(200);
      const page = next.json<PersonalFinancialScreenResponseDto>();
      expect(page.rows[0]!.identity.listingId).not.toBe(
        body.rows[0]!.identity.listingId,
      );
      expect(page.rows[0]!.metrics).toEqual(cells);
      expect(page).toMatchObject({
        hasMore: false,
        financialSnapshotSha256: body.financialSnapshotSha256,
      });
      expect(f.vault.record).toBeUndefined();
    },
  );

  it.each([
    [
      "missing revenue",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      { facts: [] },
      "missing",
    ],
    [
      "failed OCF",
      ocf,
      { status: "upstream_unavailable", facts: [] },
      "source_unavailable",
    ],
    ["missing PP&E", ppe, { facts: [] }, "missing"],
    ["period mismatch", ppe, { startDate: "2025-01-02" }, "period_mismatch"],
    [
      "filing mismatch",
      ppe,
      { accessionNumber: "0000000001-26-000002" },
      "filing_mismatch",
    ],
    ["negative PP&E", ppe, { value: "-1" }, "unsupported_sign"],
    [
      "nonpositive revenue",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      { value: "0" },
      "nonpositive_revenue",
    ],
  ] as const)(
    "returns %s evidence and unknown query counts",
    async (_label, concept, change, reason) => {
      const f = await readyApp();
      const source = cashSnapshot();
      f.provider.loadSnapshot.mockResolvedValue({
        ...source,
        frames: source.frames.map((frame) =>
          frame.concept !== concept
            ? frame
            : "facts" in change
              ? { ...frame, ...change }
              : {
                  ...frame,
                  facts: frame.facts.map((fact) => ({ ...fact, ...change })),
                },
        ),
      });
      const request = screenRequest(f.snapshotSha256);
      const criteria = {
        ...request.criteria,
        revenueBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
      } as const;
      const unfiltered = await screen(f.app, f.cookie, {
        ...request,
        criteria,
      });
      expect(unfiltered.statusCode).toBe(200);
      const body = unfiltered.json<PersonalFinancialScreenResponseDto>();
      const cells = body.rows[0]!.metrics;
      expect(cells[metric]).toEqual({
        status: "unavailable",
        unit: "percent",
        reason,
        sources: [
          ...cells.operatingCashFlow.sources,
          ...cells.ppePurchases.sources,
          ...cells.revenue.sources,
        ],
      });
      expect(body.metricCoverage[metric]).toEqual({ known: 0, unknown: 2 });
      const filtered = await screen(f.app, f.cookie, {
        ...request,
        criteria: {
          ...criteria,
          clauses: [{ field: metric, operator: "gte", value: "0" }],
        },
      });
      expect(filtered.json()).toMatchObject({
        totalMatches: 0,
        totalNonMatches: 0,
        totalUnknown: 2,
        rows: [],
      });
      expect(f.vault.record).toBeUndefined();
    },
  );

  it("round-trips signed new criteria in saved-v1 while preserving the original definition and rejecting aliases before acquisition", async () => {
    const f = await readyApp();
    const legacy = savedViewsPayload(f.snapshotSha256);
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 1,
      views: [
        ...legacy.views,
        {
          ...legacy.views[0]!,
          id: "cash-margin",
          name: "Cash after purchases / revenue",
          criteria: {
            ...legacy.views[0]!.criteria,
            clauses: [{ field: metric, operator: "gte", value: "-1.25" }],
            sort: { field: metric, direction: "desc" },
          },
        },
      ],
    };
    expect(
      (await putSavedViews(f.app, f.cookie, payload, 0, "cash-margin-saved-v1"))
        .statusCode,
    ).toBe(201);
    const loaded = await f.app.inject({
      method: "GET",
      url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
      headers: ownerHeaders(f.cookie),
      remoteAddress: "127.0.0.1",
    });
    expect(loaded.json()).toMatchObject({ payload, version: 1 });
    expect(f.vault.record?.payload).toEqual(payload);
    expect(payload.views[0]).toEqual(legacy.views[0]);
    const request = screenRequest(f.snapshotSha256);
    const invalid = await screen(f.app, f.cookie, {
      ...request,
      criteria: {
        ...request.criteria,
        sort: { field: "freeCashFlowMargin", direction: "desc" },
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(
      (
        await screen(f.app, f.cookie, {
          ...request,
          criteria: payload.views[1]!.criteria,
        })
      ).json(),
    ).toMatchObject({ totalMatches: 2 });
    expect(f.vault.record?.payload).toEqual(payload);
  });
});

describe("reported total balances, cash and stockholders equity routes", () => {
  it.each([
    { field: "totalAssets", concept: "Assets" },
    { field: "totalLiabilities", concept: "Liabilities" },
    {
      field: "cashAndCashEquivalents",
      concept: "CashAndCashEquivalentsAtCarryingValue",
    },
    { field: "stockholdersEquity", concept: "StockholdersEquity" },
  ] as const)(
    "filters, sorts and pages exact signed $field amounts in Catalog and My Watchlist",
    async ({ field, concept }) => {
      const provider = testProvider();
      const original = snapshot();
      provider.loadSnapshot.mockResolvedValue({
        ...original,
        instantFrames: original.instantFrames.map((frame) =>
          frame.concept !== concept
            ? frame
            : {
                ...frame,
                facts: ["9007199254740991", "-2.000001", "0"].map(
                  (value, index) => ({
                    ...frame.facts[0]!,
                    cik: String(index + 1).padStart(10, "0"),
                    value,
                    asOfDate: index === 1 ? "2025-10-01" : "2025-12-31",
                  }),
                ),
              },
        ),
      });
      const f = await readyApp(provider, 6);
      seedWatchlist(f);
      const base = screenRequest(f.snapshotSha256);
      for (const scope of [
        undefined,
        watchlistScope([
          "lst-00000",
          "lst-00001",
          "lst-00002",
          "lst-00003",
          "lst-00004",
          "lst-00005",
        ]),
      ]) {
        for (const direction of ["asc", "desc"] as const) {
          const request = {
            ...base,
            ...(scope ? { scope } : {}),
            criteria: { ...base.criteria, sort: { field, direction } },
            page: { offset: 0, limit: 2 },
          };
          const first = await screen(f.app, f.cookie, request);
          expect(first.statusCode).toBe(200);
          const body = first.json<PersonalFinancialScreenResponseDto>();
          expect(body).toMatchObject({
            schemaVersion: "14.0.0",
            formulaVersion: "1.7.0",
            totalMatches: 6,
            hasMore: true,
            metricCoverage: { [field]: { known: 6, unknown: 0 } },
          });
          expect(body.rows.map((row) => row.metrics[field])).toEqual(
            Array.from({ length: 2 }, () => ({
              status: "available",
              unit: "USD",
              value: direction === "asc" ? "-2.000001" : "9007199254740991",
              sources: [
                {
                  concept,
                  accessionNumber: "0000000001-26-000001",
                  asOfDate: direction === "asc" ? "2025-10-01" : "2025-12-31",
                  value: direction === "asc" ? "-2.000001" : "9007199254740991",
                },
              ],
            })),
          );
          const page = await screen(f.app, f.cookie, {
            ...request,
            financialSnapshotSha256: body.financialSnapshotSha256,
            page: { offset: 2, limit: 2 },
          });
          expect(page.statusCode).toBe(200);
          expect(
            page
              .json<PersonalFinancialScreenResponseDto>()
              .rows.map((row) => row.metrics[field]),
          ).toEqual(
            Array.from({ length: 2 }, () => ({
              status: "available",
              unit: "USD",
              value: "0",
              sources: [
                {
                  concept,
                  accessionNumber: "0000000001-26-000001",
                  asOfDate: "2025-12-31",
                  value: "0",
                },
              ],
            })),
          );
          const filtered = await screen(f.app, f.cookie, {
            ...request,
            criteria: {
              ...request.criteria,
              clauses: [
                { field, operator: "gte", value: "-2.000001" },
                { field, operator: "lte", value: "-2.000001" },
              ],
            },
          });
          expect(filtered.json()).toMatchObject({
            totalMatches: 2,
            totalNonMatches: 4,
            totalUnknown: 0,
          });
        }
      }
      expect(f.vault.record).toBeUndefined();
    },
  );

  it.each([
    { field: "totalAssets", concept: "Assets", other: "totalLiabilities" },
    { field: "totalLiabilities", concept: "Liabilities", other: "totalAssets" },
    {
      field: "cashAndCashEquivalents",
      concept: "CashAndCashEquivalentsAtCarryingValue",
      other: "stockholdersEquity",
    },
    {
      field: "stockholdersEquity",
      concept: "StockholdersEquity",
      other: "cashAndCashEquivalents",
    },
  ] as const)(
    "keeps $field unknown reasons independent of all other fields",
    async ({ field, concept, other }) => {
      const f = await readyApp();
      const request = screenRequest(f.snapshotSha256);
      const original = (
        await screen(f.app, f.cookie, request)
      ).json<PersonalFinancialScreenResponseDto>();
      const initial = snapshot();
      for (const [kind, reason] of [
        ["missing", "missing"],
        ["failed", "source_unavailable"],
        ["date", "unsupported_balance_date"],
        ["conflicting", "conflicting"],
      ] as const) {
        f.provider.loadSnapshot.mockResolvedValue({
          ...initial,
          instantFrames: initial.instantFrames.map((frame) =>
            frame.concept !== concept
              ? frame
              : {
                  ...frame,
                  status:
                    kind === "failed" ? "upstream_unavailable" : "available",
                  facts:
                    kind === "missing" || kind === "failed"
                      ? []
                      : kind === "date"
                        ? frame.facts.map((fact) => ({
                            ...fact,
                            asOfDate: "2026-01-31",
                          }))
                        : [...frame.facts, { ...frame.facts[0]!, value: "1" }],
                },
          ),
        });
        const response = await screen(f.app, f.cookie, request);
        expect(response.statusCode).toBe(200);
        const result = response.json<PersonalFinancialScreenResponseDto>();
        expect(result.rows[0]?.metrics[field]).toMatchObject({
          status: "unavailable",
          reason,
        });
        expect(result.metricCoverage[field]).toEqual({ known: 0, unknown: 2 });
        for (const unaffected of PERSONAL_FINANCIAL_SCREEN_METRICS.filter(
          (metric) => metric !== field,
        )) {
          expect(result.rows[0]?.metrics[unaffected]).toEqual(
            original.rows[0]?.metrics[unaffected],
          );
          expect(result.metricCoverage[unaffected]).toEqual(
            original.metricCoverage[unaffected],
          );
        }
        expect(result.rows[0]?.metrics[other].status).toBe("available");
      }
    },
  );

  it("preserves old v1 criteria and old v2 column subsets while explicitly saving total criteria and columns", async () => {
    const f = await readyApp();
    const legacy = savedViewsPayload(f.snapshotSha256);
    const totals = {
      ...legacy.views[0]!,
      id: "reported-totals",
      name: "Reported totals",
      criteria: {
        ...legacy.views[0]!.criteria,
        clauses: [
          { field: "totalAssets", operator: "gte", value: "1000" },
          { field: "totalLiabilities", operator: "lte", value: "600" },
        ],
        sort: { field: "totalLiabilities", direction: "desc" },
      },
    } as const;
    const oldLayout = {
      ...legacy.views[0]!,
      id: "old-layout",
      name: "Old columns",
      display: {
        visibleMetrics: ["currentAssets", "currentRatio", "revenueGrowth"],
      },
    } as const;
    const v1 = { ...legacy, views: [...legacy.views, totals] };
    expect(
      (await putSavedViews(f.app, f.cookie, v1, 0, "totals-v1-create"))
        .statusCode,
    ).toBe(201);
    expect(
      (await getSavedViews(f.app, f.cookie)).json<LocalResearchRecord>()
        .payload,
    ).toEqual(v1);
    const v2 = {
      schemaVersion: 2,
      views: [
        { ...legacy.views[0]!, display: null },
        oldLayout,
        {
          ...totals,
          display: { visibleMetrics: ["totalAssets", "totalLiabilities"] },
        },
      ],
    } as const;
    expect(
      (await putSavedViews(f.app, f.cookie, v2, 1, "totals-v2-explicit-save"))
        .statusCode,
    ).toBe(200);
    const record = f.vault.record;
    const loaded = (
      await getSavedViews(f.app, f.cookie)
    ).json<LocalResearchRecord>();
    expect(loaded.payload).toEqual(v2);
    expect(f.vault.record).toBe(record);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          { ...v2, views: [] },
          1,
          "totals-stale-delete",
        )
      ).statusCode,
    ).toBe(409);
    expect(f.vault.record).toBe(record);
    expect(
      (
        await screen(f.app, f.cookie, {
          ...screenRequest(f.snapshotSha256),
          criteria: totals.criteria,
        })
      ).json(),
    ).toMatchObject({ totalMatches: 2 });
    expect(f.vault.record).toBe(record);
    const count = f.provider.loadSnapshot.mock.calls.length;
    for (const invalidField of [
      "Assets",
      "Liabilities",
      "totalDebt",
      "assetsMinusEquity",
    ]) {
      expect(
        (
          await screen(f.app, f.cookie, {
            ...screenRequest(f.snapshotSha256),
            criteria: {
              ...totals.criteria,
              clauses: [{ field: invalidField, operator: "gte", value: "0" }],
            },
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(f.provider.loadSnapshot).toHaveBeenCalledTimes(count);
  });
});

describe("reported cash and equity saved views", () => {
  it("round-trips signed cash/equity criteria and explicit columns without migrating earlier layouts", async () => {
    const f = await readyApp();
    const legacy = savedViewsPayload(f.snapshotSha256);
    const cashEquity = {
      ...legacy.views[0]!,
      id: "cash-equity",
      name: "Reported cash and equity",
      criteria: {
        ...legacy.views[0]!.criteria,
        clauses: [
          { field: "cashAndCashEquivalents", operator: "gte", value: "50" },
          { field: "stockholdersEquity", operator: "lte", value: "-125.5" },
        ],
        sort: { field: "stockholdersEquity", direction: "asc" },
      },
    } as const;
    const v1 = { ...legacy, views: [...legacy.views, cashEquity] };
    expect(
      (await putSavedViews(f.app, f.cookie, v1, 0, "cash-equity-v1-create"))
        .statusCode,
    ).toBe(201);
    expect(
      (await getSavedViews(f.app, f.cookie)).json<LocalResearchRecord>()
        .payload,
    ).toEqual(v1);
    const v2 = {
      schemaVersion: 2,
      views: [
        { ...legacy.views[0]!, display: null },
        {
          ...legacy.views[0]!,
          id: "earlier-layout",
          name: "Earlier columns",
          display: {
            visibleMetrics: ["currentRatio", "totalAssets", "totalLiabilities"],
          },
        },
        {
          ...cashEquity,
          display: {
            visibleMetrics: ["cashAndCashEquivalents", "stockholdersEquity"],
          },
        },
      ],
    } as const;
    expect(
      (await putSavedViews(f.app, f.cookie, v2, 1, "cash-equity-v2-save"))
        .statusCode,
    ).toBe(200);
    const record = f.vault.record;
    expect(
      (await getSavedViews(f.app, f.cookie)).json<LocalResearchRecord>()
        .payload,
    ).toEqual(v2);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
    const response = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: cashEquity.criteria,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: "14.0.0",
      totalMatches: 2,
      rows: [
        {
          metrics: {
            cashAndCashEquivalents: { status: "available", value: "50" },
            stockholdersEquity: { status: "available", value: "-125.5" },
          },
        },
      ],
    });
    expect(f.vault.record).toBe(record);
    const calls = f.provider.loadSnapshot.mock.calls.length;
    for (const field of [
      "CashAndCashEquivalentsAtCarryingValue",
      "StockholdersEquity",
      "netCash",
      "restrictedCash",
      "commonEquity",
      "totalEquityIncludingNoncontrollingInterest",
    ]) {
      expect(
        (
          await screen(f.app, f.cookie, {
            ...screenRequest(f.snapshotSha256),
            criteria: {
              ...cashEquity.criteria,
              clauses: [{ field, operator: "gte", value: "0" }],
            },
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(f.provider.loadSnapshot).toHaveBeenCalledTimes(calls);
    expect(f.vault.record).toBe(record);
  });
});

describe("personal financial reusable saved views", () => {
  it("reads v1 unchanged and upgrades only an explicit save while preserving legacy criteria and creation digests", async () => {
    const f = await readyApp();
    const original = savedViewsPayload(f.snapshotSha256);
    const legacy = {
      ...original,
      views: [
        {
          ...original.views[0]!,
          criteria: { ...original.views[0]!.criteria, calendarYear: 2009 },
          createdAgainstCatalogSnapshotSha256: `sha256:${"d".repeat(64)}`,
          createdAgainstFinancialSnapshotSha256: `sha256:${"e".repeat(64)}`,
        },
        { ...original.views[0]!, id: "second-view", name: "Second view" },
      ],
    } as const;
    const created = await putSavedViews(
      f.app,
      f.cookie,
      legacy,
      0,
      "reusable-legacy-create",
    );
    expect(created.statusCode).toBe(201);
    const legacyRecord = f.vault.record;
    const mutation = vi.spyOn(f.vault, "putRecord");
    const loaded = await getSavedViews(f.app, f.cookie);
    expect(loaded.statusCode).toBe(200);
    const loadedPayload = loaded.json<{
      payload: PersonalFinancialSavedViewsPayloadDto;
    }>().payload;
    expect(loadedPayload).toEqual(legacy);
    expect(loaded.headers.etag).toBe('"v1"');
    expect(f.vault.record).toBe(legacyRecord);
    expect(mutation).not.toHaveBeenCalled();
    expect(loadedPayload.views[0]).not.toHaveProperty("display");
    expect(loadedPayload.views[0]!.criteria).not.toHaveProperty("revenueBasis");

    const upgraded: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 2,
      views: [
        { ...legacy.views[0], display: null },
        {
          ...legacy.views[1],
          display: { visibleMetrics: ["netIncome", "currentRatio"] },
        },
      ],
    };
    const saved = await putSavedViews(
      f.app,
      f.cookie,
      upgraded,
      1,
      "reusable-explicit-upgrade",
    );
    expect(saved.statusCode).toBe(200);
    expect(saved.headers.etag).toBe('"v2"');
    expect(mutation).toHaveBeenCalledTimes(1);
    const upgradedRecord = f.vault.record;
    const reloaded = await getSavedViews(f.app, f.cookie);
    expect(reloaded.statusCode).toBe(200);
    expect(reloaded.json<LocalResearchRecord>().payload).toEqual(upgraded);
    expect(reloaded.headers.etag).toBe('"v2"');
    expect(f.vault.record).toBe(upgradedRecord);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();

    const stale = await putSavedViews(
      f.app,
      f.cookie,
      { ...upgraded, views: [] },
      1,
      "reusable-stale-upgrade",
    );
    expect(stale.statusCode).toBe(409);
    expect(f.vault.record).toBe(upgradedRecord);
  });

  it("round-trips one through all twenty-eight columns without source reads or changing screen results", async () => {
    const f = await readyApp();
    const request = screenRequest(f.snapshotSha256);
    const before = await screen(f.app, f.cookie, request);
    expect(before.statusCode).toBe(200);
    const base = savedViewsPayload(f.snapshotSha256).views[0]!;
    const payload: PersonalFinancialSavedViewsPayloadDto = {
      schemaVersion: 2,
      views: [
        { ...base, display: { visibleMetrics: ["revenueGrowth"] } },
        {
          ...base,
          id: "all-financial-columns",
          name: "All financial columns",
          display: { visibleMetrics: [...PERSONAL_FINANCIAL_SCREEN_METRICS] },
        },
      ],
    };
    expect(PERSONAL_FINANCIAL_SCREEN_METRICS).toHaveLength(28);
    const saved = await putSavedViews(
      f.app,
      f.cookie,
      payload,
      0,
      "reusable-v2-columns-create",
    );
    expect(saved.statusCode).toBe(201);
    const record = f.vault.record;
    expect(
      (await getSavedViews(f.app, f.cookie)).json<LocalResearchRecord>()
        .payload,
    ).toEqual(payload);
    expect(f.provider.loadSnapshot).toHaveBeenCalledTimes(1);
    const after = await screen(f.app, f.cookie, request);
    expect(after.statusCode).toBe(200);
    expect(after.json()).toEqual(before.json());
    const body = after.json<PersonalFinancialScreenResponseDto>();
    expect(body.sources.length + body.priorRevenueSources.length).toBe(23);
    expect(body.schemaVersion).toBe("14.0.0");
    expect(body.formulaVersion).toBe("1.7.0");
    expect(f.provider.loadSnapshot).toHaveBeenCalledTimes(2);
    expect(f.vault.record).toBe(record);
  });

  it("rejects malformed displays and version shapes on both write and read without mutating the record", async () => {
    const f = await readyApp();
    const original = savedViewsPayload(f.snapshotSha256);
    const base = original.views[0]!;
    const valid = {
      schemaVersion: 2,
      views: [{ ...base, display: { visibleMetrics: ["revenue"] } }],
    } as const;
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          valid,
          0,
          "reusable-validation-create",
        )
      ).statusCode,
    ).toBe(201);
    const record = f.vault.record!;
    const mutation = vi.spyOn(f.vault, "putRecord");
    const invalidDisplays = [
      [],
      false,
      "private-display-canary",
      {},
      { visibleMetrics: null },
      { visibleMetrics: "revenue" },
      { visibleMetrics: [] },
      { visibleMetrics: ["revenue", "revenue"] },
      { visibleMetrics: ["private-display-canary"] },
      { visibleMetrics: ["symbol"] },
      { visibleMetrics: ["Assets"] },
      { visibleMetrics: ["totalDebt"] },
      { visibleMetrics: ["totalAssets", "totalAssets"] },
      { visibleMetrics: ["totalLiabilities", "totalAssets"] },
      { visibleMetrics: [null] },
      { visibleMetrics: ["currentRatio", "revenue"] },
      {
        visibleMetrics: [...PERSONAL_FINANCIAL_SCREEN_METRICS, "revenue"],
      },
      { visibleMetrics: ["revenue"], preset: "private-display-canary" },
    ];
    const invalidPayloads = [
      ...invalidDisplays.map((display) => ({
        schemaVersion: 2,
        views: [{ ...base, display }],
      })),
      { schemaVersion: 2, views: [base] },
      { schemaVersion: 1, views: [{ ...base, display: null }] },
      { schemaVersion: 1, views: valid.views },
      { schemaVersion: 3, views: valid.views },
      { ...valid, unexpected: "private-display-canary" },
      { ...valid, views: [{ ...valid.views[0], unexpected: true }] },
      {
        ...valid,
        views: [{ ...valid.views[0], scope: watchlistScope() }],
      },
      {
        ...valid,
        views: [
          {
            ...valid.views[0],
            criteria: { ...base.criteria, display: valid.views[0].display },
          },
        ],
      },
    ];
    for (const [index, payload] of invalidPayloads.entries()) {
      const written = await putSavedViews(
        f.app,
        f.cookie,
        payload,
        1,
        `reusable-invalid-${index}`,
      );
      expect(written.statusCode, JSON.stringify(payload)).toBe(400);
      expect(written.payload).not.toContain("private-display-canary");
      expect(f.vault.record).toBe(record);
      const malformedRecord = {
        ...record,
        payload: payload as unknown as JsonValue,
      };
      f.vault.record = malformedRecord;
      const read = await getSavedViews(f.app, f.cookie);
      expect(read.statusCode, JSON.stringify(payload)).toBe(409);
      expect(read.headers.etag).toBe('"v1"');
      expect(read.payload).not.toContain("private-display-canary");
      expect(f.vault.record).toBe(malformedRecord);
      f.vault.record = record;
    }
    expect(mutation).not.toHaveBeenCalled();
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("retains the twenty-view bound, normalized unique names, ids, criteria and digests in v2", async () => {
    const f = await readyApp();
    const base = savedViewsPayload(f.snapshotSha256).views[0]!;
    const views = Array.from({ length: 20 }, (_, index) => ({
      ...base,
      id: `saved-view-${index}`,
      name: `Saved view ${index}`,
      display: null,
    }));
    const payload = { schemaVersion: 2, views };
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          payload,
          0,
          "reusable-twenty-views",
        )
      ).statusCode,
    ).toBe(201);
    const record = f.vault.record!;
    for (const invalid of [
      [...views, { ...views[0], id: "another-id", name: "Another name" }],
      [views[0], { ...views[1], id: views[0]!.id }],
      [views[0], { ...views[1], name: views[0]!.name.toUpperCase() }],
      [{ ...views[0], name: " Leading space" }],
      [{ ...views[0], name: "e\u0301" }],
      [{ ...views[0], name: "x".repeat(81) }],
      [{ ...views[0], name: "" }],
      [{ ...views[0], id: "INVALID-ID" }],
      [{ ...views[0], createdAgainstCatalogSnapshotSha256: "bad" }],
      [{ ...views[0], createdAgainstFinancialSnapshotSha256: "bad" }],
      [{ ...views[0], criteria: { ...base.criteria, calendarYear: 2008 } }],
    ]) {
      const invalidPayload = { ...payload, views: invalid };
      expect(
        (
          await putSavedViews(
            f.app,
            f.cookie,
            invalidPayload,
            1,
            "reusable-invalid-view-bound",
          )
        ).statusCode,
      ).toBe(400);
      f.vault.record = {
        ...record,
        payload: invalidPayload as unknown as JsonValue,
      };
      expect((await getSavedViews(f.app, f.cookie)).statusCode).toBe(409);
      f.vault.record = record;
    }
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });
});

describe("personal financial screen saved-watchlist scope", () => {
  it("rejects malformed or unbounded scopes before reading the vault or acquiring frames", async () => {
    const f = await readyApp();
    const getRecord = vi.spyOn(f.vault, "getRecord");
    const scope = watchlistScope();
    for (const invalidScope of [
      null,
      [],
      {},
      { ...scope, kind: "catalog" },
      { ...scope, extra: "private-scope-canary" },
      { kind: "watchlist", listingIds: scope.listingIds },
      { ...scope, watchlistVersion: 0 },
      { ...scope, watchlistVersion: -1 },
      { ...scope, watchlistVersion: 1.5 },
      { ...scope, watchlistVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...scope, listingIds: [] },
      { ...scope, listingIds: ["lst-00000", "lst-00000"] },
      { ...scope, listingIds: ["https://untrusted.invalid"] },
      { ...scope, listingIds: [" lst-00000"] },
      { ...scope, listingIds: [true] },
      { ...scope, listingIds: ["x".repeat(129)] },
      {
        ...scope,
        listingIds: Array.from({ length: 21 }, (_, index) => `lst-${index}`),
      },
    ]) {
      const response = await screen(f.app, f.cookie, {
        ...screenRequest(f.snapshotSha256),
        scope: invalidScope,
      });
      expect(response.statusCode, JSON.stringify(invalidScope)).toBe(400);
      expect(response.payload).not.toContain("private-scope-canary");
    }
    const staleCatalog = await screen(f.app, f.cookie, {
      ...screenRequest(`sha256:${"f".repeat(64)}`),
      scope,
    });
    expect(staleCatalog.statusCode).toBe(409);
    expect(getRecord).not.toHaveBeenCalled();
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("authenticates scoped reads and rejects foreign origins before vault or provider work", async () => {
    const f = await readyApp();
    const getRecord = vi.spyOn(f.vault, "getRecord");
    for (const headers of [
      ownerHeaders(),
      { ...ownerHeaders(f.cookie), origin: "https://untrusted.invalid" },
    ]) {
      const response = await f.app.inject({
        method: "POST",
        url: PERSONAL_FINANCIAL_SCREEN_PATH,
        headers: { ...headers, "content-type": "application/json" },
        payload: {
          ...screenRequest(f.snapshotSha256),
          scope: watchlistScope(),
        },
        remoteAddress: "127.0.0.1",
      });
      expect(response.statusCode).toBe(403);
    }
    expect(getRecord).not.toHaveBeenCalled();
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("rejects missing, deleted, stale, malformed, unsaved and mismatched saved identities before loading", async () => {
    const f = await readyApp();
    const original = seedWatchlist(f);
    const request = {
      ...screenRequest(f.snapshotSha256),
      scope: watchlistScope(),
    };
    const getRecord = vi.spyOn(f.vault, "getRecord");
    for (const code of ["VAULT_NOT_FOUND", "VAULT_DELETED"] as const) {
      getRecord.mockImplementationOnce(() => {
        throw new LocalResearchVaultError(code);
      });
      expect((await screen(f.app, f.cookie, request)).statusCode).toBe(404);
    }
    f.vault.watchlistRecord = { ...original, version: 2 };
    expect((await screen(f.app, f.cookie, request)).statusCode).toBe(409);
    const payload = original.payload as Record<string, unknown>;
    for (const changedPayload of [
      { ...payload, snapshotSha256: `sha256:${"f".repeat(64)}` },
      { ...payload, unexpected: "private-note-canary" },
      {
        ...payload,
        memberships: (payload.memberships as Record<string, unknown>[]).map(
          (membership) => ({ ...membership, issuerName: "Wrong issuer" }),
        ),
      },
      {
        ...payload,
        memberships: (payload.memberships as Record<string, unknown>[]).map(
          (membership) => ({ ...membership, symbol: "UNKNOWN" }),
        ),
      },
    ]) {
      f.vault.watchlistRecord = {
        ...original,
        payload: changedPayload as LocalResearchRecord["payload"],
      };
      const response = await screen(f.app, f.cookie, request);
      expect(response.statusCode).toBe(409);
      expect(response.payload).not.toContain("private-note-canary");
    }
    f.vault.watchlistRecord = original;
    expect(
      (
        await screen(f.app, f.cookie, {
          ...request,
          scope: watchlistScope(["lst-99999"]),
        })
      ).statusCode,
    ).toBe(400);
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });

  it("preserves all twenty-eight catalog metric cells for selected listings, both share classes and unknown issuers", async () => {
    const f = await readyApp(testProvider(), 6);
    const original = seedWatchlist(f);
    const putRecord = vi.spyOn(f.vault, "putRecord");
    const getRecord = vi.spyOn(f.vault, "getRecord");
    const request = {
      ...screenRequest(f.snapshotSha256),
      page: { offset: 0, limit: 20 },
    };
    const catalogResponse = await screen(f.app, f.cookie, request);
    expect(catalogResponse.statusCode).toBe(200);
    const catalog = catalogResponse.json<PersonalFinancialScreenResponseDto>();
    expect(catalog).not.toHaveProperty("scope");
    expect(getRecord).not.toHaveBeenCalled();
    const selectedIds = ["lst-00002", "lst-00001", "lst-00000"];
    const response = await screen(f.app, f.cookie, {
      ...request,
      financialSnapshotSha256: catalog.financialSnapshotSha256,
      scope: watchlistScope(selectedIds),
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    const body = response.json<PersonalFinancialScreenResponseDto>();
    expect(body.scope).toEqual({
      ...watchlistScope(selectedIds),
      totalWatchlistListings: 6,
    });
    expect(body).toMatchObject({
      schemaVersion: "14.0.0",
      formulaVersion: "1.7.0",
      totalUniverse: 3,
      identityMatches: 3,
      totalMatches: 3,
      totalUnknown: 0,
      hasMore: false,
    });
    expect(body.rows).toEqual(
      catalog.rows.filter((row) =>
        selectedIds.includes(row.identity.listingId),
      ),
    );
    expect(Object.keys(body.rows[0]!.metrics)).toHaveLength(28);
    expect(body.rows[0]!.metrics).toEqual(body.rows[1]!.metrics);
    expect(body.rows[2]!.metrics.revenue.status).toBe("unavailable");
    for (const coverage of Object.values(body.metricCoverage)) {
      expect(coverage).toEqual({ known: 2, unknown: 1 });
    }
    expect(body.sources).toEqual(catalog.sources);
    expect(body.priorRevenueSources).toEqual(catalog.priorRevenueSources);
    expect(body.sources.length + body.priorRevenueSources.length).toBe(23);
    expect(f.provider.loadSnapshot).toHaveBeenCalledTimes(2);
    for (const call of f.provider.loadSnapshot.mock.calls) {
      expect(call).toEqual([2025, expect.any(AbortSignal), false]);
    }
    expect(getRecord).toHaveBeenCalledTimes(2);
    expect(getRecord).toHaveBeenNthCalledWith(1, "watchlist", "main");
    expect(getRecord).toHaveBeenNthCalledWith(2, "watchlist", "main");
    expect(putRecord).not.toHaveBeenCalled();
    expect(f.vault.watchlistRecord).toBe(original);
    expect(f.vault.record).toBeUndefined();
    expect(response.payload).not.toContain("private-note-canary");
    expect(body.rows[0]!.identity).not.toHaveProperty("note");
    expect(body.rows[0]!.identity).not.toHaveProperty("matchKind");
  });

  it("limits filtering, coverage and pagination to the selected universe and requires a stable snapshot", async () => {
    const f = await readyApp(testProvider(), 6);
    seedWatchlist(f);
    const request = {
      ...screenRequest(f.snapshotSha256),
      scope: watchlistScope(["lst-00000", "lst-00002"]),
    };
    const first = (
      await screen(f.app, f.cookie, request)
    ).json<PersonalFinancialScreenResponseDto>();
    expect(first).toMatchObject({
      totalUniverse: 2,
      totalMatches: 2,
      hasMore: true,
      rows: [{ identity: { listingId: "lst-00000" } }],
    });
    const next = await screen(f.app, f.cookie, {
      ...request,
      financialSnapshotSha256: first.financialSnapshotSha256,
      page: { offset: 1, limit: 1 },
    });
    expect(next.json()).toMatchObject({
      scope: first.scope,
      totalUniverse: 2,
      totalMatches: 2,
      hasMore: false,
      rows: [{ identity: { listingId: "lst-00002" } }],
    });
    const filtered = await screen(f.app, f.cookie, {
      ...request,
      criteria: {
        ...request.criteria,
        clauses: [{ field: "revenue", operator: "gte", value: "2000" }],
      },
    });
    expect(filtered.json()).toMatchObject({
      totalUniverse: 2,
      identityMatches: 2,
      totalMatches: 0,
      totalNonMatches: 1,
      totalUnknown: 1,
      rows: [],
    });
    const identityFiltered = await screen(f.app, f.cookie, {
      ...request,
      criteria: { ...request.criteria, identityText: "S00001" },
    });
    expect(identityFiltered.json()).toMatchObject({
      totalUniverse: 2,
      identityMatches: 0,
      totalMatches: 0,
      rows: [],
    });
    const stale = await screen(f.app, f.cookie, {
      ...request,
      financialSnapshotSha256: `sha256:${"e".repeat(64)}`,
    });
    expect(stale.statusCode).toBe(409);
  });

  it("accepts exactly twenty selected listings from a larger saved watchlist", async () => {
    const f = await readyApp(testProvider(), 24);
    seedWatchlist(f);
    const ids = Array.from(
      { length: 20 },
      (_, index) => `lst-${String(index).padStart(5, "0")}`,
    );
    const response = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      page: { offset: 0, limit: 20 },
      scope: watchlistScope(ids),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totalUniverse: 20,
      totalMatches: 20,
      hasMore: false,
      scope: { ...watchlistScope(ids), totalWatchlistListings: 24 },
    });
    expect(
      response.json<PersonalFinancialScreenResponseDto>().rows,
    ).toHaveLength(20);
    expect(f.provider.loadSnapshot).toHaveBeenCalledOnce();
  });

  it("reuses the existing twenty-three-Frame cache across catalog and watchlist reads", async () => {
    const fetchFrames = vi.fn<typeof fetch>((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      const path = new URL(url).pathname.split("/");
      return Promise.resolve(
        Response.json({
          taxonomy: "us-gaap",
          tag: path[5],
          ccp: path[7]?.replace(".json", ""),
          uom: "USD",
          label: "Synthetic fixture",
          description: "Synthetic fixture only",
          pts: 0,
          data: [],
        }),
      );
    });
    const source = createSecPersonalFinancialProvider(
      "PersonalResearch/1.0 owner@example.test",
      {
        fetch: fetchFrames,
        now: () => new Date("2026-09-16T00:00:00.000Z"),
        scheduler: { wait: () => Promise.resolve() },
      },
    );
    const f = await readyApp();
    f.provider.loadSnapshot.mockImplementation(() => source.loadSnapshot(2025));
    f.provider.close.mockImplementation(() => source.close());
    seedWatchlist(f);
    const request = screenRequest(f.snapshotSha256);
    const catalog = (
      await screen(f.app, f.cookie, request)
    ).json<PersonalFinancialScreenResponseDto>();
    expect(fetchFrames).toHaveBeenCalledTimes(23);
    expect(catalog.sources.every((frame) => frame.status === "available")).toBe(
      true,
    );
    for (const ids of [["lst-00000"], ["lst-00001", "lst-00000"]]) {
      const response = await screen(f.app, f.cookie, {
        ...request,
        financialSnapshotSha256: catalog.financialSnapshotSha256,
        scope: watchlistScope(ids),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        financialSnapshotSha256: catalog.financialSnapshotSha256,
        totalUniverse: ids.length,
      });
      expect(fetchFrames).toHaveBeenCalledTimes(23);
    }
    expect(
      new Set(
        fetchFrames.mock.calls.map(([input]) =>
          input instanceof Request ? input.url : input.toString(),
        ),
      ).size,
    ).toBe(23);
    // The 22 real provider intervals consume 4.84 seconds before route work.
  }, 10_000);

  it.each(["version", "deleted", "malformed", "catalog"] as const)(
    "rejects an in-flight %s change rather than returning stale selected rows",
    async (change) => {
      const f = await readyApp();
      const original = seedWatchlist(f);
      let releaseSnapshot:
        ((value: PersonalSecFinancialSnapshotDto) => void) | undefined;
      f.provider.loadSnapshot.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseSnapshot = resolve;
          }),
      );
      const pending = screen(f.app, f.cookie, {
        ...screenRequest(f.snapshotSha256),
        scope: watchlistScope(),
      });
      await vi.waitFor(() =>
        expect(f.provider.loadSnapshot).toHaveBeenCalledOnce(),
      );
      if (change === "deleted") f.vault.watchlistRecord = undefined;
      else if (change === "version")
        f.vault.watchlistRecord = { ...original, version: 2 };
      else
        f.vault.watchlistRecord = {
          ...original,
          payload:
            change === "malformed"
              ? { privateNote: "private-note-canary" }
              : {
                  ...(original.payload as Record<string, JsonValue>),
                  snapshotSha256: `sha256:${"e".repeat(64)}`,
                },
        };
      releaseSnapshot!(snapshot());
      const response = await pending;
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "conflict" });
      expect(response.payload).not.toContain("private-note-canary");
      expect(response.json()).not.toHaveProperty("rows");
    },
  );

  it("keeps scope out of saved-v1 definitions and preserves them during a scoped read", async () => {
    const f = await readyApp();
    seedWatchlist(f);
    const saved = savedViewsPayload(f.snapshotSha256);
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          saved,
          0,
          "watchlist-financial-saved-v1",
        )
      ).statusCode,
    ).toBe(201);
    const savedRecord = f.vault.record;
    expect(
      (
        await screen(f.app, f.cookie, {
          ...screenRequest(f.snapshotSha256),
          scope: watchlistScope(),
        })
      ).statusCode,
    ).toBe(200);
    expect(f.vault.record).toBe(savedRecord);
    const invalid = {
      ...saved,
      views: saved.views.map((view) => ({
        ...view,
        criteria: { ...view.criteria, scope: watchlistScope() },
      })),
    };
    expect(
      (
        await putSavedViews(
          f.app,
          f.cookie,
          invalid,
          1,
          "watchlist-financial-saved-bad",
        )
      ).statusCode,
    ).toBe(400);
    expect(f.vault.record).toBe(savedRecord);
  });

  it("sanitizes an unexpected watchlist read failure without acquiring source data", async () => {
    const f = await readyApp();
    vi.spyOn(f.vault, "getRecord").mockImplementationOnce(() => {
      throw new Error("private-vault-canary");
    });
    const response = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      scope: watchlistScope(),
    });
    expect(response.statusCode).toBe(502);
    expect(response.payload).not.toContain("private-vault-canary");
    expect(f.provider.loadSnapshot).not.toHaveBeenCalled();
  });
});

function watchlistScope(listingIds: readonly string[] = ["lst-00000"]) {
  return { kind: "watchlist" as const, watchlistVersion: 1, listingIds };
}

function seedWatchlist(f: Awaited<ReturnType<typeof readyApp>>) {
  const rows = screenPersonalSecurityMaster(f.catalog, {
    schemaVersion: "1.0.0",
    snapshotSha256: f.catalog.snapshotSha256,
    query: { operator: "and", clauses: [] },
    sort: { field: "symbol", direction: "asc" },
    page: { offset: 0, limit: 100 },
  }).rows;
  const record: LocalResearchRecord = {
    id: "main",
    kind: "watchlist",
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
    version: 1,
    profile: LOCAL_RESEARCH_VAULT_PROFILE,
    payloadSha256: "a".repeat(64),
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: f.snapshotSha256,
      memberships: rows.map((identity) => ({
        country: identity.country,
        exchangeMic: identity.exchangeMic,
        instrumentType: identity.instrumentType,
        issuerId: identity.issuerId,
        issuerName: identity.issuerName,
        listingId: identity.listingId,
        securityId: identity.securityId,
        securityName: identity.securityName,
        shareClassId: identity.shareClassId,
        shareClassName: identity.shareClassName,
        symbol: identity.symbol,
        note: "private-note-canary",
      })),
    },
  };
  f.vault.watchlistRecord = record;
  return record;
}

async function readyApp(provider = testProvider(), recordCount = 2) {
  const admission = buildTestSecurityMasterAdmission(recordCount);
  const catalog = admitPersonalSecurityMasterSnapshot({
    expectedSha256: admission.expectedSha256,
    snapshot: admission.snapshot,
  });
  const secret = randomBytes(32).toString("hex");
  const authority = PersonalOwnerSessionAuthority.create(secret);
  const vault = new TestVault();
  const app = await buildPersonalWorkspaceApp(
    catalog,
    vault as unknown as LocalResearchVault,
    authority,
    LISTEN_OPTIONS,
    undefined,
    provider,
  );
  applications.push(app);
  const cookie = await bootstrapTestPersonalOwnerSession(app, secret);
  return {
    app,
    catalog,
    cookie,
    snapshotSha256: admission.expectedSha256,
    vault,
    provider,
  };
}

async function screen(app: FastifyInstance, cookie: string, payload: unknown) {
  return await app.inject({
    headers: {
      ...ownerHeaders(cookie),
      "content-type": "application/json",
    },
    method: "POST",
    payload: payload as Record<string, unknown>,
    remoteAddress: "127.0.0.1",
    url: PERSONAL_FINANCIAL_SCREEN_PATH,
  });
}

const FINANCIAL_DIGEST = ("sha256:" + "c".repeat(64)) as `sha256:${string}`;
function screenRequest(
  catalogSnapshotSha256: string,
): PersonalFinancialScreenRequestDto {
  return {
    schemaVersion: "14.0.0",
    catalogSnapshotSha256: catalogSnapshotSha256 as `sha256:${string}`,
    financialSnapshotSha256: null,
    criteria: {
      calendarYear: 2025,
      identityText: "",
      clauses: [],
      sort: { field: "symbol", direction: "asc" },
    },
    page: { offset: 0, limit: 1 },
    refresh: false,
  };
}
function savedViewsPayload(
  catalogSnapshotSha256: string,
): Extract<PersonalFinancialSavedViewsPayloadDto, { schemaVersion: 1 }> {
  return {
    schemaVersion: 1,
    views: [
      {
        id: "nasdaq",
        name: "Nasdaq",
        criteria: screenRequest(catalogSnapshotSha256).criteria,
        createdAgainstCatalogSnapshotSha256:
          catalogSnapshotSha256 as `sha256:${string}`,
        createdAgainstFinancialSnapshotSha256: FINANCIAL_DIGEST,
      },
    ],
  };
}
function snapshot(): PersonalSecFinancialSnapshotDto {
  return {
    calendarYear: 2025,
    priorCalendarYear: 2024,
    priorRevenueFrames: PERSONAL_SEC_REVENUE_CONCEPTS.map((concept, index) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2024.json`,
      facts:
        index === 0
          ? [
              {
                cik: "0000000001",
                accessionNumber: "0000000001-25-000001",
                startDate: "2024-01-01",
                endDate: "2024-12-31",
                value: "800",
              },
            ]
          : [],
      unknownCiks: [],
    })),
    instantQuarter: 4,
    fetchedAt: "2026-09-09T00:00:00.000Z",
    expiresAt: "2026-09-09T00:30:00.000Z",
    snapshotSha256: FINANCIAL_DIGEST,
    frames: PERSONAL_SEC_ANNUAL_CONCEPTS.map((concept, index) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025.json`,
      facts:
        index < 3 && index !== 0
          ? []
          : [
              {
                cik: "0000000001",
                accessionNumber: "0000000001-26-000001",
                startDate: "2025-01-01",
                endDate: "2025-12-31",
                value: index === 0 ? "1000" : "100",
              },
            ],
      unknownCiks: [],
    })),
    instantFrames: PERSONAL_SEC_INSTANT_CONCEPTS.map((concept, index) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025Q4I.json`,
      facts: [
        {
          cik: "0000000001",
          accessionNumber: "0000000001-26-000001",
          asOfDate: "2025-12-31",
          value:
            concept === "Assets"
              ? "1000"
              : concept === "Liabilities"
                ? "600"
                : concept === "CashAndCashEquivalentsAtCarryingValue"
                  ? "50"
                  : concept === "StockholdersEquity"
                    ? "-125.5"
                    : index === 0
                      ? "200"
                      : "100",
        },
      ],
      unknownCiks: [],
    })),
  };
}
function testProvider() {
  return {
    status: () => ({ configured: true }),
    close: vi.fn(),
    loadSnapshot: vi.fn(() => Promise.resolve(snapshot())),
  };
}

function getSavedViews(app: FastifyInstance, cookie: string) {
  return app.inject({
    headers: ownerHeaders(cookie),
    method: "GET",
    remoteAddress: "127.0.0.1",
    url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
  });
}

function putSavedViews(
  app: FastifyInstance,
  cookie: string,
  payload: unknown,
  currentVersion: number,
  idempotencyKey: string,
) {
  const creating = currentVersion === 0;
  return app.inject({
    headers: {
      ...ownerHeaders(cookie),
      "content-type": "application/json",
      ...(creating
        ? { "if-none-match": "*" }
        : { "if-match": `"v${String(currentVersion)}"` }),
      [PERSONAL_OWNER_IDEMPOTENCY_HEADER_NAME]: idempotencyKey,
      [PERSONAL_OWNER_INTENT_HEADER_NAME]: creating
        ? "personal-vault-create"
        : "personal-vault-update",
    },
    method: "POST",
    payload: { payload },
    remoteAddress: "127.0.0.1",
    url: PERSONAL_FINANCIAL_SAVED_VIEWS_PATH,
  });
}

function ownerHeaders(cookie?: string): Record<string, string> {
  return {
    accept: "application/json",
    ...(cookie === undefined ? {} : { cookie }),
    host: "127.0.0.1:3100",
    origin: "http://127.0.0.1:3000",
  };
}

class TestVault {
  readonly profile = LOCAL_RESEARCH_VAULT_PROFILE;
  record: LocalResearchRecord | undefined;
  watchlistRecord: LocalResearchRecord | undefined;

  close(): void {}

  getRecord(kind: "settings" | "watchlist", id: string): LocalResearchRecord {
    if (
      kind === "watchlist" &&
      id === "main" &&
      this.watchlistRecord !== undefined
    ) {
      return this.watchlistRecord;
    }
    if (
      kind !== "settings" ||
      id !== PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID ||
      this.record === undefined
    ) {
      throw new LocalResearchVaultError("VAULT_NOT_FOUND");
    }
    return this.record;
  }

  putRecord(command: PutLocalResearchRecordCommand) {
    const currentVersion = this.record?.version ?? 0;
    if (
      command.kind !== "settings" ||
      command.id !== PERSONAL_FINANCIAL_SAVED_VIEWS_RECORD_ID ||
      command.expectedVersion !== currentVersion
    ) {
      throw new LocalResearchVaultError("VAULT_CONFLICT");
    }
    const version = currentVersion + 1;
    this.record = {
      createdAt: this.record?.createdAt ?? "2026-09-09T00:00:00.000Z",
      id: command.id,
      kind: command.kind,
      payload: command.payload,
      payloadSha256: "a".repeat(64),
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      updatedAt: "2026-09-09T00:00:00.000Z",
      version,
    };
    return {
      committedAt: "2026-09-09T00:00:00.000Z",
      digestSha256: "a".repeat(64),
      id: command.id,
      kind: command.kind,
      operation: "put" as const,
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      replayed: false,
      version,
    };
  }
}
