import type {
  PersonalAnnualFinancialReportedFieldKeyDto,
  PersonalAnnualFinancialsDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalQuarterlyFinancialsDto,
  PersonalValuationHistoryDto,
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterScreenRequestDto,
  PersonalSecurityMasterScreenResponseDto,
  PersonalSecurityMasterSnapshotReceiptDto,
  PersonalScreenerSavedViewsPayloadDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyPersonalWatchlist,
  createEmptyPersonalScreenerSavedViews,
  fetchMainPersonalWatchlist,
  fetchPersonalScreenerSavedViews,
  fetchPersonalAnnualFinancials,
  fetchPersonalMarketDataStatus,
  fetchPersonalMarketOverview,
  fetchPersonalQuarterlyFinancials,
  fetchPersonalValuationHistory,
  fetchPersonalSecurityMasterStatus,
  membershipFromSearchResult,
  normalizeWatchlistNote,
  PersonalWorkspaceApiError,
  saveMainPersonalWatchlist,
  savePersonalScreenerSavedViews,
  screenPersonalSecurities,
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

  it("posts one exact typed local-universe screen and validates its snapshot", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(screenResponse()));
    const input = screenRequest();

    await expect(
      screenPersonalSecurities(input, new AbortController().signal),
    ).resolves.toMatchObject({
      limitApplied: 25,
      rows: [{ listingId: "lst-00001", symbol: "ZERO" }],
      totalMatches: 1,
      totalUniverse: 3_001,
    });

    expect(requestUrl(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:3100/v1/personal-filing/security-master/screen",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "include",
      method: "POST",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  });

  it("accepts an empty out-of-range screen page and rejects mismatched or extra response data", async () => {
    const outOfRangeInput = {
      ...screenRequest(),
      page: { limit: 25, offset: 50 },
    } satisfies PersonalSecurityMasterScreenRequestDto;
    const base = screenResponse();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ...base,
          hasMore: false,
          offset: 50,
          rows: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...base,
          snapshotSha256: `sha256:${"b".repeat(64)}`,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ...base, privateField: true }));

    await expect(
      screenPersonalSecurities(outOfRangeInput, new AbortController().signal),
    ).resolves.toMatchObject({ hasMore: false, offset: 50, rows: [] });
    await expect(
      screenPersonalSecurities(screenRequest(), new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
    await expect(
      screenPersonalSecurities(screenRequest(), new AbortController().signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects unusable identity normalization before a screen request", async () => {
    for (const value of ["--- 🎯", "\uFDFA".repeat(128)]) {
      const invalid = {
        ...screenRequest(),
        query: {
          clauses: [{ field: "identity_text", operator: "matches", value }],
          operator: "and",
        },
      } as PersonalSecurityMasterScreenRequestDto;
      await expect(
        screenPersonalSecurities(invalid, new AbortController().signal),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads, creates, and updates strict saved screener definitions with CAS headers", async () => {
    const payload = savedScreenerViews();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(savedScreenerRecord(payload)))
      .mockResolvedValueOnce(jsonResponse(screenerMutationReceipt(1), 201))
      .mockResolvedValueOnce(jsonResponse(screenerMutationReceipt(2), 200));

    await expect(
      fetchPersonalScreenerSavedViews(new AbortController().signal),
    ).resolves.toBeNull();
    await expect(
      fetchPersonalScreenerSavedViews(new AbortController().signal),
    ).resolves.toMatchObject({ version: 2, payload });
    await expect(
      savePersonalScreenerSavedViews(0, payload, new AbortController().signal),
    ).resolves.toMatchObject({ version: 1, payload });
    await expect(
      savePersonalScreenerSavedViews(1, payload, new AbortController().signal),
    ).resolves.toMatchObject({ version: 2, payload });

    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({
      "If-None-Match": "*",
      "X-Research-Cockpit-Idempotency-Key":
        "saved-screen-11111111-2222-4333-8444-555555555555",
      "X-Research-Cockpit-Intent": "personal-vault-create",
    });
    expect(fetchMock.mock.calls[3]?.[1]?.headers).toMatchObject({
      "If-Match": '"v1"',
      "X-Research-Cockpit-Intent": "personal-vault-update",
    });
  });

  it("rejects saved screens without the mandatory symbol column or with duplicate names", async () => {
    const payload = savedScreenerViews();
    const first = payload.views[0];
    if (first === undefined) throw new Error("Expected saved screen fixture.");
    const withoutSymbol = {
      schemaVersion: 1,
      views: [{ ...first, columns: ["issuer_name"] }],
    } as PersonalScreenerSavedViewsPayloadDto;
    const duplicateNames = {
      schemaVersion: 1,
      views: [first, { ...first, id: "screen-two", name: "my screen" }],
    } satisfies PersonalScreenerSavedViewsPayloadDto;

    await expect(
      savePersonalScreenerSavedViews(
        0,
        withoutSymbol,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      savePersonalScreenerSavedViews(
        0,
        duplicateNames,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(createEmptyPersonalScreenerSavedViews()).toEqual({
      schemaVersion: 1,
      views: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("posts one exact quarterly-financials request and returns a deeply frozen response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(quarterlyFinancials()));

    const result = await fetchPersonalQuarterlyFinancials(
      { listingId: "lst-00001", symbol: "ZERO" },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      coverage: { knownReportedCells: 60, returnedQuarterlyPeriods: 2 },
      quarters: [
        { fiscalQuarter: 4, fiscalYear: 2029 },
        { fiscalQuarter: 3, fiscalYear: 2029 },
      ],
      security: { listingId: "lst-00001", symbol: "ZERO" },
      status: "available",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.coverage.missingFiscalQuarters)).toBe(true);
    expect(Object.isFrozen(result.coverage.missingFiscalQuarters[0])).toBe(
      true,
    );
    expect(Object.isFrozen(result.quarters)).toBe(true);
    expect(Object.isFrozen(result.quarters[0]?.reported.revenue)).toBe(true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/market-data/quarterly-financials",
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

  it("posts one exact valuation-history request and returns a deeply frozen response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(valuationHistory()));

    const result = await fetchPersonalValuationHistory(
      { listingId: "lst-00001", range: "5y", symbol: "ZERO" },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      coverage: { knownCells: 10, observationCount: 2, unknownCells: 0 },
      history: { range: "5y" },
      security: { listingId: "lst-00001", symbol: "ZERO" },
      status: "available",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.coverage)).toBe(true);
    expect(Object.isFrozen(result.history)).toBe(true);
    expect(Object.isFrozen(result.history.points)).toBe(true);
    expect(Object.isFrozen(result.history.points[0])).toBe(true);
    expect(Object.isFrozen(result.history.points[0]?.priceToEarnings)).toBe(
      true,
    );
    expect(result.history.latestPoint).toBe(result.history.points.at(-1));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/market-data/valuation-history",
      ),
      expect.objectContaining({
        body: JSON.stringify({
          listingId: "lst-00001",
          range: "5y",
          symbol: "ZERO",
        }),
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

  it("strictly rejects malformed valuation history chronology, coverage, cells, and identity", async () => {
    const unordered = valuationHistory();
    const wrongLatest = valuationHistory();
    const wrongCoverage = valuationHistory();
    const wrongUnit = valuationHistory();
    const wrongWindow = valuationHistory();
    const identityMismatch = valuationHistory("lst-other", "ZERO");
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ...unordered,
          history: {
            ...unordered.history,
            points: [...unordered.history.points].reverse(),
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...wrongLatest,
          history: {
            ...wrongLatest.history,
            latestPoint: wrongLatest.history.points[0],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...wrongCoverage,
          coverage: { ...wrongCoverage.coverage, knownCells: 9 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...wrongUnit,
          history: {
            ...wrongUnit.history,
            latestPoint: {
              ...wrongUnit.history.latestPoint,
              priceToBook: {
                ...wrongUnit.history.latestPoint.priceToBook,
                unit: "USD",
              },
            },
            points: [
              wrongUnit.history.points[0],
              {
                ...wrongUnit.history.points[1],
                priceToBook: {
                  ...wrongUnit.history.points[1]?.priceToBook,
                  unit: "USD",
                },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...wrongWindow,
          history: {
            ...wrongWindow.history,
            startDate: "2029-02-01",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(identityMismatch));

    for (let index = 0; index < 6; index += 1) {
      await expect(
        fetchPersonalValuationHistory(
          { listingId: "lst-00001", range: "5y", symbol: "ZERO" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("strictly rejects malformed quarterly chronology and coverage", async () => {
    const unordered = quarterlyFinancials();
    const wrongMissing = quarterlyFinancials();
    const invalidStatementDate = quarterlyFinancials();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ...unordered,
          quarters: [...unordered.quarters].reverse(),
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...wrongMissing,
          coverage: {
            ...wrongMissing.coverage,
            missingFiscalQuarters:
              wrongMissing.coverage.missingFiscalQuarters.slice(1),
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...invalidStatementDate,
          quarters: [
            {
              ...invalidStatementDate.quarters[0],
              statementDate: "2030-01-15T21:00:00.000Z",
            },
            invalidStatementDate.quarters[1],
          ],
        }),
      );

    for (let index = 0; index < 3; index += 1) {
      await expect(
        fetchPersonalQuarterlyFinancials(
          { listingId: "lst-00001", symbol: "ZERO" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("strictly rejects malformed or identity-mismatched annual financials", async () => {
    const extraRootKey = annualFinancials();
    const noncanonicalDecimal = annualFinancials();
    const identityMismatch = annualFinancials("lst-other", "ZERO");
    const invalidStatementDate = annualFinancials();
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
          ...invalidStatementDate,
          years: [
            {
              ...invalidStatementDate.years[0],
              statementDate: "2030-01-15T21:00:00.000Z",
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
    await expect(
      fetchPersonalQuarterlyFinancials(
        { listingId: "bad id", symbol: "ZERO" },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      fetchPersonalValuationHistory(
        { listingId: "lst-00001", range: "overnight" as "1y", symbol: "ZERO" },
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
    schemaVersion: "1.1.0",
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
        reported,
        statementDate: "2030-01-15",
      },
    ],
  };
}

function quarterlyFinancials(
  listingId = "lst-00001",
  symbol = "ZERO",
): PersonalQuarterlyFinancialsDto {
  const reported = Object.fromEntries(
    annualFinancialReportedFieldKeys.map((key, index) => [
      key,
      { status: "known", value: String((index + 1) * 10) },
    ]),
  ) as PersonalQuarterlyFinancialsDto["quarters"][number]["reported"];
  const missingFiscalQuarters = [
    { fiscalQuarter: 2, fiscalYear: 2029 },
    { fiscalQuarter: 1, fiscalYear: 2029 },
    { fiscalQuarter: 4, fiscalYear: 2028 },
    { fiscalQuarter: 3, fiscalYear: 2028 },
    { fiscalQuarter: 2, fiscalYear: 2028 },
    { fiscalQuarter: 1, fiscalYear: 2028 },
    { fiscalQuarter: 4, fiscalYear: 2027 },
    { fiscalQuarter: 3, fiscalYear: 2027 },
    { fiscalQuarter: 2, fiscalYear: 2027 },
    { fiscalQuarter: 1, fiscalYear: 2027 },
    { fiscalQuarter: 4, fiscalYear: 2026 },
    { fiscalQuarter: 3, fiscalYear: 2026 },
    { fiscalQuarter: 2, fiscalYear: 2026 },
    { fiscalQuarter: 1, fiscalYear: 2026 },
  ] as const;
  return {
    asOf: "2030-01-15T21:01:00.000Z",
    coverage: {
      earliestFiscalQuarter: 3,
      earliestFiscalYear: 2029,
      knownReportedCells: 60,
      latestFiscalQuarter: 4,
      latestFiscalYear: 2029,
      missingFiscalQuarters,
      requestedQuarterlyPeriods: 16,
      returnedQuarterlyPeriods: 2,
      status: "partial",
      unknownReportedCells: 0,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: annualFinancials().provider,
    quarters: [
      {
        fiscalQuarter: 4,
        fiscalYear: 2029,
        reported,
        statementDate: "2030-01-15",
      },
      {
        fiscalQuarter: 3,
        fiscalYear: 2029,
        reported,
        statementDate: "2029-10-15",
      },
    ],
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

function screenRequest(): PersonalSecurityMasterScreenRequestDto {
  return {
    page: { limit: 25, offset: 0 },
    query: {
      clauses: [{ field: "identity_text", operator: "matches", value: "Zero" }],
      operator: "and",
    },
    schemaVersion: "1.0.0",
    snapshotSha256: snapshot().snapshotSha256,
    sort: { direction: "asc", field: "symbol" },
  };
}

function screenResponse(): PersonalSecurityMasterScreenResponseDto {
  const first = searchResponse("ZERO").results[0];
  if (first === undefined) throw new Error("Expected search fixture.");
  const { matchKind: _matchKind, matchedValue: _matchedValue, ...row } = first;
  void _matchKind;
  void _matchedValue;
  return {
    hasMore: false,
    limitApplied: 25,
    offset: 0,
    rows: [row],
    schemaVersion: "1.0.0",
    snapshot: snapshot(),
    snapshotSha256: snapshot().snapshotSha256,
    totalMatches: 1,
    totalUniverse: 3_001,
  };
}

function savedScreenerViews(): PersonalScreenerSavedViewsPayloadDto {
  return {
    schemaVersion: 1,
    views: [
      {
        columns: ["symbol", "issuer_name", "exchange_mic"],
        createdAgainstSnapshotSha256: snapshot().snapshotSha256,
        id: "screen-one",
        name: "My Screen",
        query: screenRequest().query,
        sort: screenRequest().sort,
      },
    ],
  };
}

function savedScreenerRecord(payload: PersonalScreenerSavedViewsPayloadDto) {
  return {
    createdAt: "2030-01-15T01:00:00.000Z",
    id: "stock-screener-saved-views",
    kind: "settings",
    payload,
    payloadSha256: "e".repeat(64),
    profile: "personal_single_user_local_vault",
    updatedAt: "2030-01-15T02:00:00.000Z",
    version: 2,
  };
}

function screenerMutationReceipt(version: number) {
  return {
    committedAt: "2030-01-15T03:00:00.000Z",
    digestSha256: "f".repeat(64),
    id: "stock-screener-saved-views",
    kind: "settings",
    operation: "put",
    profile: "personal_single_user_local_vault",
    replayed: false,
    version,
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

function valuationHistory(
  listingId = "lst-00001",
  symbol = "ZERO",
): PersonalValuationHistoryDto {
  const points = [
    valuationPoint("2029-01-15", "23.5"),
    valuationPoint("2030-01-15", "24.125"),
  ] as const;
  return {
    asOf: "2030-01-15T22:00:00.000Z",
    coverage: {
      knownCells: 10,
      observationCount: 2,
      status: "complete",
      unknownCells: 0,
    },
    history: {
      endDate: "2030-01-15",
      latestPoint: points[1],
      points,
      range: "5y",
      startDate: "2025-01-15",
    },
    profile: "personal_single_user_local_valuation",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      valuationFeed: "tiingo_fundamentals_daily",
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
  };
}

function valuationPoint(date: string, pe: string) {
  return {
    date,
    enterpriseValue: {
      status: "known",
      unit: "USD",
      value: "130000000000.5",
    },
    marketCapitalization: {
      status: "known",
      unit: "USD",
      value: "125000000000.25",
    },
    priceToBook: { status: "known", unit: "ratio", value: "6.25" },
    priceToEarnings: { status: "known", unit: "ratio", value: pe },
    trailingPeg1Y: { status: "known", unit: "ratio", value: "1.75" },
  } as const;
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
