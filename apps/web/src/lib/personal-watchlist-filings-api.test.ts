import type {
  PersonalWatchlistFilingsRequestDto,
  PersonalWatchlistFilingsResponseDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersonalWatchlistFilings,
  personalSecFilingUrl,
} from "./personal-watchlist-filings-api";

const fetchMock = vi.fn<typeof fetch>();
const signal = () => new AbortController().signal;
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("watchlist filing transport", () => {
  it("uses the private loopback POST with saved listing IDs and validates issuer links", async () => {
    fetchMock.mockResolvedValue(json(response()));
    expect(await fetchPersonalWatchlistFilings(request(), signal())).toEqual(
      response(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/watchlist-filings",
      ),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request()),
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: expect.any(AbortSignal) as unknown,
      }),
    );
    expect(personalSecFilingUrl("0000000001", "0000000001-26-000001")).toBe(
      "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    );
  });

  it.each([
    { ...request(), listingIds: [] },
    { ...request(), listingIds: ["listing-one", "listing-one"] },
    {
      ...request(),
      listingIds: Array.from(
        { length: 21 },
        (_, index) => `listing-${String(index)}`,
      ),
    },
    { ...request(), listingIds: ["https://evil.invalid"] },
    { ...request(), lookbackDays: 1 },
    { ...request(), watchlistVersion: 0 },
    { ...request(), cik: "0000000001" },
  ])("rejects invalid request %# before network", async (input) => {
    await expect(
      fetchPersonalWatchlistFilings(
        input as PersonalWatchlistFilingsRequestDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "extra reply keys",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        secret: "hidden",
      }),
    ],
    [
      "catalog mismatch",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    ],
    [
      "version mismatch",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        watchlistVersion: 2,
      }),
    ],
    [
      "selected identity mismatch",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        selectedListingIds: ["listing-two"],
      }),
    ],
    [
      "missing issuer coverage",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        issuers: [],
      }),
    ],
    [
      "duplicate issuers",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        issuers: [...value.issuers, ...value.issuers],
      }),
    ],
    [
      "incorrect count",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        matchingFilings: 2,
      }),
    ],
    [
      "missing result",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        filings: [],
      }),
    ],
    [
      "false truncation",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        truncated: true,
      }),
    ],
    [
      "incorrect date window",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        fromDate: "2026-08-10",
      }),
    ],
    [
      "invalid calendar date",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        throughDate: "2026-02-30",
      }),
    ],
    [
      "incorrect observation date",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        fetchedAt: "2026-09-08T10:00:00.000Z",
      }),
    ],
    [
      "arbitrary issuer link",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        issuers: value.issuers.map((issuer) => ({
          ...issuer,
          sourceUrl: "https://evil.invalid",
        })),
      }),
    ],
    [
      "arbitrary filing link",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        filings: value.filings.map((filing) => ({
          ...filing,
          sourceUrl: "https://evil.invalid",
        })),
      }),
    ],
    [
      "unexpected form",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        filings: value.filings.map((filing) => ({
          ...filing,
          form: "<script>",
        })),
      }),
    ],
    [
      "invalid report date",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        filings: value.filings.map((filing) => ({
          ...filing,
          reportDate: "2026-02-30",
        })),
      }),
    ],
    [
      "outside filing window",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        filings: value.filings.map((filing) => ({
          ...filing,
          filingDate: "2025-09-08",
        })),
      }),
    ],
    [
      "disagreeing filing identity",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        filings: value.filings.map((filing) => ({
          ...filing,
          listings: filing.listings.map((listing) => ({
            ...listing,
            symbol: "OTHER",
          })),
        })),
      }),
    ],
    [
      "unavailable source with facts",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        issuers: value.issuers.map((issuer) => ({
          ...issuer,
          status: "rate_limited",
        })),
      }),
    ],
    [
      "invalid issuer truncation",
      (value: PersonalWatchlistFilingsResponseDto) => ({
        ...value,
        issuers: value.issuers.map((issuer) => ({
          ...issuer,
          truncated: true,
        })),
      }),
    ],
  ] as const)("rejects %s", async (_name, corrupt) => {
    fetchMock.mockResolvedValue(json(corrupt(response())));
    await expect(
      fetchPersonalWatchlistFilings(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("accepts an empty available history and an unavailable history as distinct states", async () => {
    for (const status of ["available", "not_covered"] as const) {
      const value = response();
      const empty = {
        ...value,
        filings: [],
        matchingFilings: 0,
        issuers: value.issuers.map((issuer) => ({
          ...issuer,
          status,
          matchingFilings: 0,
        })),
      };
      fetchMock.mockResolvedValueOnce(json(empty));
      expect(await fetchPersonalWatchlistFilings(request(), signal())).toEqual(
        empty,
      );
    }
  });

  it("allows issuer observations after the check start and preserves amendments", async () => {
    const value = response();
    const amended = {
      ...value,
      filings: value.filings.map((filing) => ({
        ...filing,
        form: "10-Q/A",
        reportDate: null,
      })),
    };
    fetchMock.mockResolvedValue(json(amended));
    expect(await fetchPersonalWatchlistFilings(request(), signal())).toEqual(
      amended,
    );
  });

  it("rejects duplicate accessions even when matching counts agree", async () => {
    const value = response();
    fetchMock.mockResolvedValue(
      json({
        ...value,
        matchingFilings: 2,
        issuers: value.issuers.map((issuer) => ({
          ...issuer,
          matchingFilings: 2,
        })),
        filings: [...value.filings, ...value.filings],
      }),
    );
    await expect(
      fetchPersonalWatchlistFilings(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    [401, "session_unavailable"],
    [403, "session_unavailable"],
    [409, "conflict"],
    [400, "invalid_request"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
    [503, "not_configured"],
  ])(
    "maps status %s without disclosing response details",
    async (status, code) => {
      fetchMock.mockResolvedValue(
        json({ code, detail: "private source error" }, status),
      );
      await expect(
        fetchPersonalWatchlistFilings(request(), signal()),
      ).rejects.toMatchObject({
        code,
        message: "The personal workspace request was not accepted.",
      });
    },
  );

  it("propagates cancellation through the private fetch", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const pending = fetchPersonalWatchlistFilings(request(), controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

function request(): PersonalWatchlistFilingsRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    watchlistVersion: 1,
    listingIds: ["listing-one"],
    lookbackDays: 30,
  };
}
function response(): PersonalWatchlistFilingsResponseDto {
  const listings = [
    { listingId: "listing-one", symbol: "ONE", issuerName: "Example One" },
  ];
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: request().catalogSnapshotSha256,
    watchlistVersion: 1,
    lookbackDays: 30,
    fromDate: "2026-08-11",
    throughDate: "2026-09-09",
    fetchedAt: "2026-09-09T10:00:00.000Z",
    totalWatchlistListings: 1,
    selectedListingIds: ["listing-one"],
    issuers: [
      {
        cik: "0000000001",
        status: "available",
        fetchedAt: "2026-09-09T10:00:01.000Z",
        sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
        olderHistoryAvailable: false,
        matchingFilings: 1,
        truncated: false,
        listings,
      },
    ],
    matchingFilings: 1,
    truncated: false,
    filings: [
      {
        cik: "0000000001",
        accessionNumber: "0000000001-26-000001",
        form: "10-Q",
        filingDate: "2026-09-08",
        reportDate: "2026-06-30",
        sourceUrl: personalSecFilingUrl("0000000001", "0000000001-26-000001"),
        listings,
      },
    ],
  };
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
