import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyPersonalWatchlist,
  fetchMainPersonalWatchlist,
  fetchPersonalAnnualFinancials,
  fetchPersonalMarketDataStatus,
  fetchPersonalMarketOverview,
  fetchPersonalSecurityMasterStatus,
  membershipFromSearchResult,
  normalizeWatchlistNote,
  PersonalWorkspaceApiError,
  saveMainPersonalWatchlist,
  searchPersonalSecurities,
  type PersonalWatchlistPayload,
} from "./personal-workspace-api";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("personal workspace API client", () => {
  it("loads and strictly validates the admitted snapshot status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ snapshot: snapshot() }));

    const result = await fetchPersonalSecurityMasterStatus(
      new AbortController().signal,
    );

    expect(result.snapshot.coverage.activeEligibleSecurities).toBe(3_001);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/security-master/status",
      ),
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
        method: "GET",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("uses the canonical search URL instead of form-style plus encoding", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(searchResponse("ZERO ALPHA")));

    const result = await searchPersonalSecurities(
      "  ZERO ALPHA  ",
      new AbortController().signal,
      15,
    );

    expect(result.results[0]?.symbol).toBe("ZERO");
    const requested = fetchMock.mock.calls[0]?.[0];
    expect(requestUrl(requested)).toContain("q=ZERO%20ALPHA&limit=15");
    expect(requestUrl(requested)).not.toContain("+");
  });

  it("rejects malformed status and search responses", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ snapshot: { private: true } }))
      .mockResolvedValueOnce(
        jsonResponse({ ...searchResponse("ZERO"), unexpected: true }),
      );

    await expect(
      fetchPersonalSecurityMasterStatus(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
    await expect(
      searchPersonalSecurities("ZERO", new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects search results outside the admitted MIC and symbol grammar", async () => {
    const invalidMic = searchResponse("ZERO");
    const first = invalidMic.results[0];
    if (first === undefined) throw new Error("Expected search fixture.");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...invalidMic,
        results: [{ ...first, exchangeMic: "bad!", symbol: "ZERO/US" }],
      }),
    );

    await expect(
      searchPersonalSecurities("ZERO", new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("loads either an absent or one exact typed main watchlist", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(vaultRecord(watchlist())));

    await expect(
      fetchMainPersonalWatchlist(new AbortController().signal),
    ).resolves.toBeNull();
    await expect(
      fetchMainPersonalWatchlist(new AbortController().signal),
    ).resolves.toMatchObject({
      id: "main",
      version: 2,
      payload: { name: "My Watchlist", schemaVersion: 1 },
    });
  });

  it("rejects an untyped watchlist payload instead of displaying it", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        vaultRecord({
          ...watchlist(),
          memberships: [{ symbol: "SYNTHETIC_INVALID" }],
        }),
      ),
    );

    await expect(
      fetchMainPersonalWatchlist(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("creates and updates with strong preconditions and fresh idempotency", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(mutationReceipt(1), 201))
      .mockResolvedValueOnce(jsonResponse(mutationReceipt(2), 200));
    const payload = watchlist();

    await expect(
      saveMainPersonalWatchlist(0, payload, new AbortController().signal),
    ).resolves.toMatchObject({ version: 1 });
    await expect(
      saveMainPersonalWatchlist(1, payload, new AbortController().signal),
    ).resolves.toMatchObject({ version: 2 });

    const create = fetchMock.mock.calls[0]?.[1];
    const update = fetchMock.mock.calls[1]?.[1];
    expect(create?.headers).toMatchObject({
      "Content-Type": "application/json",
      "If-None-Match": "*",
      "X-Research-Cockpit-Idempotency-Key":
        "watchlist-11111111-2222-4333-8444-555555555555",
      "X-Research-Cockpit-Intent": "personal-vault-create",
    });
    expect(update?.headers).toMatchObject({
      "If-Match": '"v1"',
      "X-Research-Cockpit-Intent": "personal-vault-update",
    });
    expect(
      requestUrl(fetchMock.mock.calls[0]?.[0]).endsWith(
        "/v1/personal-filing/workspace/watchlists/main",
      ),
    ).toBe(true);
  });

  it("surfaces version conflict without treating it as a successful save", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 409 }));

    await expect(
      saveMainPersonalWatchlist(1, watchlist(), new AbortController().signal),
    ).rejects.toEqual(expect.objectContaining({ code: "conflict" }));
  });

  it("builds an exact stable-ID membership and normalizes notes", () => {
    const result = searchResponse("ZERO").results[0];
    if (result === undefined) throw new Error("Expected search fixture.");

    expect(membershipFromSearchResult(result)).toEqual({
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "iss-00001",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-00001",
      note: "",
      securityId: "sec-00001",
      securityName: "Zero Alpha Common Stock",
      shareClassId: "shr-00001",
      shareClassName: "Common",
      symbol: "ZERO",
    });
    expect(normalizeWatchlistNote("  durable thesis  ")).toBe("durable thesis");
    expect(normalizeWatchlistNote("invalid\u0000note")).toBeNull();
  });

  it("loads closed provider status and posts one exact market request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(marketStatus()))
      .mockResolvedValueOnce(jsonResponse(marketOverview()));

    await expect(
      fetchPersonalMarketDataStatus(new AbortController().signal),
    ).resolves.toMatchObject({ status: "configured" });
    const overview = await fetchPersonalMarketOverview(
      { listingId: "lst-00001", range: "1y", symbol: "ZERO" },
      new AbortController().signal,
    );

    expect(overview.history.bars).toHaveLength(2);
    expect(Object.isFrozen(overview.history.bars[0]?.adjusted)).toBe(true);
    expect(fetchMock.mock.calls[0]).toEqual([
      new URL("http://127.0.0.1:3100/v1/personal-filing/market-data/status"),
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
        method: "GET",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      new URL("http://127.0.0.1:3100/v1/personal-filing/market-data/overview"),
      expect.objectContaining({
        body: JSON.stringify({
          listingId: "lst-00001",
          symbol: "ZERO",
          range: "1y",
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    ]);
  });

  it("posts one exact annual-financials request and returns a deeply frozen response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(annualFinancials()));

    const result = await fetchPersonalAnnualFinancials(
      { listingId: "lst-00001", symbol: "ZERO" },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      coverage: { knownReportedCells: 30, returnedAnnualYears: 1 },
      security: { listingId: "lst-00001", symbol: "ZERO" },
      status: "available",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.coverage)).toBe(true);
    expect(Object.isFrozen(result.coverage.missingFiscalYears)).toBe(true);
    expect(Object.isFrozen(result.years)).toBe(true);
    expect(Object.isFrozen(result.years[0]?.reported)).toBe(true);
    expect(Object.isFrozen(result.years[0]?.reported.revenue)).toBe(true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/market-data/annual-financials",
      ),
      expect.objectContaining({
        body: JSON.stringify({ listingId: "lst-00001", symbol: "ZERO" }),
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("strictly rejects malformed or identity-mismatched annual financials", async () => {
    const extraRootKey = annualFinancials();
    const noncanonicalDecimal = annualFinancials();
    const identityMismatch = annualFinancials("lst-other", "ZERO");
    const invalidPeriodEnd = annualFinancials();
    const excessiveMissingYears = annualFinancials();
    const oversizedName = annualFinancials();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ ...extraRootKey, providerPayload: "must not pass" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...noncanonicalDecimal,
          years: [
            {
              ...noncanonicalDecimal.years[0],
              reported: {
                ...noncanonicalDecimal.years[0]?.reported,
                revenue: { status: "known", value: "100.0" },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(identityMismatch))
      .mockResolvedValueOnce(
        jsonResponse({
          ...invalidPeriodEnd,
          years: [
            {
              ...invalidPeriodEnd.years[0],
              periodEnd: "2030-01-15T21:00:00.000Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...excessiveMissingYears,
          coverage: {
            ...excessiveMissingYears.coverage,
            missingFiscalYears: [
              ...excessiveMissingYears.coverage.missingFiscalYears,
              2019,
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...oversizedName,
          security: {
            ...oversizedName.security,
            issuerName: "x".repeat(257),
          },
        }),
      );

    for (let index = 0; index < 6; index += 1) {
      await expect(
        fetchPersonalAnnualFinancials(
          { listingId: "lst-00001", symbol: "ZERO" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("maps annual-financials HTTP 402 to a distinct entitlement error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 402 }));

    await expect(
      fetchPersonalAnnualFinancials(
        { listingId: "lst-00001", symbol: "ZERO" },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "not_entitled" });
  });

  it("rejects extra, mismatched, or noncanonical market response data", async () => {
    const extra = marketOverview();
    const mismatched = marketOverview();
    const unordered = marketOverview();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ...marketStatus(), extra: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          ...extra,
          quote: { ...extra.quote, providerPayload: "must not pass" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...mismatched,
          security: { ...mismatched.security, listingId: "lst-other" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...unordered,
          history: {
            ...unordered.history,
            bars: [...unordered.history.bars].reverse(),
          },
        }),
      );

    await expect(
      fetchPersonalMarketDataStatus(new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
    for (let index = 0; index < 3; index += 1) {
      await expect(
        fetchPersonalMarketOverview(
          { listingId: "lst-00001", range: "1y", symbol: "ZERO" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("accepts requested calendar boundaries around trading-session bars", async () => {
    const response = marketOverview();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...response,
        history: {
          ...response.history,
          endDate: "2030-01-19",
          startDate: "2030-01-12",
        },
      }),
    );

    await expect(
      fetchPersonalMarketOverview(
        { listingId: "lst-00001", range: "1y", symbol: "ZERO" },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      history: { endDate: "2030-01-19", startDate: "2030-01-12" },
    });
  });

  it.each([
    [403, "session_unavailable"],
    [404, "not_covered"],
    [424, "credentials_invalid"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
    [503, "not_configured"],
  ] as const)("maps market overview HTTP %s to %s", async (status, code) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status }));

    await expect(
      fetchPersonalMarketOverview(
        { listingId: "lst-00001", range: "1y", symbol: "ZERO" },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code });
  });

  it("rejects invalid requests before issuing network traffic", async () => {
    await expect(
      searchPersonalSecurities("   ", new AbortController().signal),
    ).rejects.toBeInstanceOf(PersonalWorkspaceApiError);
    await expect(
      saveMainPersonalWatchlist(-1, watchlist(), new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      fetchPersonalMarketOverview(
        { listingId: "bad id", range: "1y", symbol: "ZERO" },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      fetchPersonalAnnualFinancials(
        { listingId: "bad id", symbol: "ZERO" },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const annualFinancialReportedFieldKeys = [
  "revenue",
  "cost_of_revenue",
  "gross_profit",
  "research_and_development",
  "selling_general_and_administrative",
  "operating_expenses",
  "operating_income",
  "interest_expense",
  "pretax_income",
  "income_tax_expense",
  "net_income",
  "ebitda",
  "cash",
  "accounts_receivable",
  "inventory",
  "current_assets",
  "property_plant_equipment_net",
  "intangibles",
  "assets",
  "current_liabilities",
  "debt",
  "liabilities",
  "shareholders_equity",
  "depreciation_and_amortization",
  "share_based_compensation",
  "operating_cash_flow",
  "capital_expenditures",
  "free_cash_flow",
  "investing_cash_flow",
  "financing_cash_flow",
] as const satisfies readonly PersonalAnnualFinancialReportedFieldKeyDto[];

function annualFinancials(
  listingId = "lst-00001",
  symbol = "ZERO",
): PersonalAnnualFinancialsDto {
  const reported = Object.fromEntries(
    annualFinancialReportedFieldKeys.map((key, index) => [
      key,
      { status: "known", value: String((index + 1) * 100) },
    ]),
  ) as PersonalAnnualFinancialsDto["years"][number]["reported"];
  return {
    asOf: "2030-01-15T21:01:00.000Z",
    coverage: {
      earliestFiscalYear: 2029,
      knownReportedCells: 30,
      latestFiscalYear: 2029,
      missingFiscalYears: [
        2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020,
      ],
      requestedAnnualYears: 10,
      returnedAnnualYears: 1,
      status: "partial",
      unknownReportedCells: 0,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      statementFeed: "tiingo_fundamentals_statements",
      valueCurrency: "USD",
    },
    schemaVersion: "1.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId,
      securityName: "Zero Alpha Common Stock",
      symbol,
    },
    status: "available",
    years: [
      {
        fiscalYear: 2029,
        periodEnd: "2030-01-15",
        reported,
      },
    ],
  };
}

function snapshot(): PersonalSecurityMasterSnapshotReceiptDto {
  return {
    asOf: "2030-01-15T00:00:00.000Z",
    catalogId: "synthetic-browser-catalog",
    catalogVersion: "1.0.0",
    claim: "bounded_exact_owner_local_security_master_snapshot_admitted",
    coverage: {
      activeEligibleSecurities: 3_001,
      activeListings: 3_001,
      admittedSourceRecords: 3_001,
      basis: "owner_declared_snapshot_only",
      eligibleSecurityBand: "at_least_3000",
      formerTickerEntries: 0,
      ineligibleSourceRecords: 10,
      inactiveSecurities: 0,
      issuers: 2_990,
      providerMappings: 6_002,
      quarantinedSourceRecords: 3,
      sourceRecords: 3_020,
      staleSourceRecords: 2,
      shareClasses: 3_001,
      totalSecurities: 3_001,
      unsupportedSourceRecords: 4,
    },
    generatedAt: "2030-01-14T23:30:00.000Z",
    profile: "personal_single_user_local_security_master",
    provenance: {
      acquiredAt: "2030-01-14T22:00:00.000Z",
      artifacts: [
        {
          acquiredAt: "2030-01-14T22:00:00.000Z",
          artifactId: "owner-source-a",
          contentSha256: `sha256:${"b".repeat(64)}`,
          mediaType: "application/json",
          sourceUri: "https://example.invalid/source.json",
          sourceVersion: "synthetic-browser-v1",
        },
      ],
      attribution: "Owner-local research sources.",
      contentKind: "owner_local_source",
      sourceId: "owner-security-source",
      sourceRevision: `sha256:${"c".repeat(64)}`,
    },
    schemaVersion: "1.0.0",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    sourcePolicyCompatibility: {
      attribution: "required",
      cache: "permitted_owner_local",
      decision: "compatible",
      deleteOnRequest: true,
      display: "permitted_owner_local",
      effectiveAt: "2029-01-01T00:00:00.000Z",
      expiresAt: "2031-01-01T00:00:00.000Z",
      export: "prohibited",
      intendedUse: "personal_security_research",
      localOnly: true,
      operation: "fetch_snapshot",
      policyDocumentSha256: `sha256:${"d".repeat(64)}`,
      policyId: "owner-security-policy",
      policyProfile: "personal_single_user_local_connected",
      policySchemaVersion: "1.0.0",
      policyVersion: "1.0.0",
      redistribution: "prohibited",
      retention: "permitted_owner_local",
      reviewedAt: "2029-12-01T00:00:00.000Z",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      rightsBasis: "owner_reviewed_rights_compatible",
      search: "permitted_owner_local",
      sourceId: "owner-security-source",
    },
    status: "admitted_for_personal_local_search",
  };
}

function searchResponse(
  query: string,
): PersonalSecurityMasterSearchResponseDto {
  return {
    limitApplied: 15,
    normalizedQuery: query,
    results: [
      {
        cik: "0000000001",
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "iss-00001",
        issuerName: "Zero Alpha, Inc.",
        listingId: "lst-00001",
        matchKind: "current_symbol_exact",
        matchedValue: "ZERO",
        securityId: "sec-00001",
        securityName: "Zero Alpha Common Stock",
        shareClassId: "shr-00001",
        shareClassName: "Common",
        symbol: "ZERO",
      },
    ],
    snapshot: snapshot(),
    totalMatches: 1,
  };
}

function marketStatus(): PersonalMarketDataStatusDto {
  return {
    profile: "personal_single_user_local_market_data",
    provider: marketProvider(),
    schemaVersion: "1.0.0",
    status: "configured",
  };
}

function marketOverview(): PersonalMarketOverviewDto {
  return {
    history: {
      bars: [
        marketBar("2030-01-14", "100.00"),
        marketBar("2030-01-15", "101.50"),
      ],
      endDate: "2030-01-15",
      range: "1y",
      startDate: "2030-01-14",
    },
    profile: "personal_single_user_local_market_data",
    provider: marketProvider(),
    quote: {
      change: "1.50",
      changePercent: "1.50",
      currency: "USD",
      freshness: "current",
      ingestedAt: "2030-01-15T21:01:00.000Z",
      kind: "derived_realtime_reference",
      previousClose: "100.00",
      price: "101.50",
      sourceTime: "2030-01-15T21:00:00.000Z",
    },
    schemaVersion: "1.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-00001",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    status: "available",
  };
}

function marketProvider() {
  return {
    attribution: "Tiingo" as const,
    export: "prohibited" as const,
    historyFeed: "tiingo_eod_composite" as const,
    id: "tiingo" as const,
    name: "Tiingo" as const,
    persistence: "none" as const,
    quoteFeed: "tiingo_iex_derived_reference" as const,
    redistribution: "prohibited" as const,
    retention: "active_owner_session_memory_only" as const,
  };
}

function marketBar(date: string, close: string) {
  return {
    adjusted: {
      close,
      high: "102.00",
      low: "99.00",
      open: "100.00",
      volume: "1200000",
    },
    date,
    dividendCash: "0",
    raw: {
      close,
      high: "102.00",
      low: "99.00",
      open: "100.00",
      volume: "1200000",
    },
    splitFactor: "1",
  } as const;
}

function watchlist(): PersonalWatchlistPayload {
  return createEmptyPersonalWatchlist(snapshot().snapshotSha256);
}

function vaultRecord(payload: unknown) {
  return {
    profile: "personal_single_user_local_vault",
    kind: "watchlist",
    id: "main",
    version: 2,
    payload,
    payloadSha256: "e".repeat(64),
    createdAt: "2030-01-15T01:00:00.000Z",
    updatedAt: "2030-01-15T02:00:00.000Z",
  };
}

function mutationReceipt(version: number) {
  return {
    profile: "personal_single_user_local_vault",
    operation: "put",
    kind: "watchlist",
    id: "main",
    version,
    digestSha256: "f".repeat(64),
    committedAt: "2030-01-15T03:00:00.000Z",
    replayed: false,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(value: string | URL | Request | undefined): string {
  if (typeof value === "string") return value;
  if (value instanceof URL) return value.href;
  if (value instanceof Request) return value.url;
  throw new Error("Expected a request URL.");
}
