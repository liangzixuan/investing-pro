import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
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
    schemaVersion: "1.0.0",
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
    schemaVersion: "1.0.0",
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
              sources: [source()],
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
