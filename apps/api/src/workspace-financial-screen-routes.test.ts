import { randomBytes } from "node:crypto";

import type {
  PersonalFinancialSavedViewsPayloadDto,
  PersonalFinancialScreenRequestDto,
  PersonalFinancialScreenResponseDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  LocalResearchVaultError,
  type LocalResearchRecord,
  type LocalResearchVault,
  type PutLocalResearchRecordCommand,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
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
  PERSONAL_FINANCIAL_SCREEN_ANNUAL_METRICS,
  type PersonalSecFinancialSnapshotDto,
} from "@research-cockpit/contracts";
import { PersonalSecFinancialProviderError } from "./personal-sec-financial-provider";

describe("personal annual financial screen routes", () => {
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
      schemaVersion: "6.0.0",
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
      "netMargin",
      "operatingMargin",
      "operatingCashFlowMargin",
      "ppePurchases",
      "operatingCashFlowLessPpePurchases",
      "grossMargin",
      "operatingCashFlowToNetIncome",
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
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
      "GrossProfit",
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "AssetsCurrent",
      "LiabilitiesCurrent",
    ]);
  });
  it("exposes the fixed Q4 selection and all three instant metrics with inclusive multiple thresholds", async () => {
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
      schemaVersion: "6.0.0",
      formulaVersion: "1.4.0",
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

  it.each(["1.0.0", "2.0.0", "3.0.0", "4.0.0", "5.0.0", "7.0.0", 1, undefined])(
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
        formulaVersion: "1.4.0",
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
      schemaVersion: "6.0.0",
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
      schemaVersion: "6.0.0",
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
    ).toMatchObject({ schemaVersion: "6.0.0", totalMatches: 2 });
    const cashScreen = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: payload.views[2]!.criteria,
    });
    expect(cashScreen.json()).toMatchObject({
      schemaVersion: "6.0.0",
      formulaVersion: "1.4.0",
      totalMatches: 2,
    });
    const ratioScreen = await screen(f.app, f.cookie, {
      ...screenRequest(f.snapshotSha256),
      criteria: payload.views[3]!.criteria,
    });
    expect(ratioScreen.json()).toMatchObject({
      schemaVersion: "6.0.0",
      formulaVersion: "1.4.0",
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
      schemaVersion: "6.0.0",
      formulaVersion: "1.4.0",
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
async function readyApp(provider = testProvider()) {
  const admission = buildTestSecurityMasterAdmission();
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
    schemaVersion: "6.0.0",
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
): PersonalFinancialSavedViewsPayloadDto {
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
          value: index === 0 ? "200" : "100",
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

  close(): void {}

  getRecord(kind: "settings", id: string): LocalResearchRecord {
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
