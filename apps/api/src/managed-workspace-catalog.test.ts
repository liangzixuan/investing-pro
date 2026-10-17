import { createHash } from "node:crypto";

import {
  MANAGED_CATALOG_LIMITS,
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
} from "@research-cockpit/contracts";
import { lookupPersonalSecurityMasterListing } from "@research-cockpit/personal-security-master";
import * as securityMaster from "@research-cockpit/personal-security-master";
import { describe, expect, it, vi } from "vitest";

import oldManifest from "./managed-catalog/2026-10-12.manifest.json";
import oldSnapshot from "./managed-catalog/2026-10-12.snapshot.json";
import manifest from "./managed-catalog/2026-10-16.manifest.json";
import snapshot from "./managed-catalog/2026-10-16.snapshot.json";
import { createManagedEodService } from "./managed-eod-service";
import { createManagedSecAnnualService } from "./managed-sec-annual-service";
import { createManagedSecFilingsService } from "./managed-sec-filings-service";
import { MANAGED_SEC_ISSUERS } from "./managed-sec-issuers";
import { MANAGED_EOD_MAPPING_CANDIDATES } from "./managed-eod-config";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

// Exact reviewed listing coordinates; source receipt is pinned by the manifest.
const REVIEWED_LISTINGS = [
  {
    symbol: "AAPL",
    cik: "0000320193",
    exchangeMic: "XNAS",
    listingId: "oid-listing-fdc1a316c06e4efca10b09944c908bbc",
  },
  {
    symbol: "AEM",
    cik: "0000002809",
    exchangeMic: "XNYS",
    listingId: "oid-listing-f2a900e0dbe04e54a112ed3605c15b9f",
  },
  {
    symbol: "AFL",
    cik: "0000004977",
    exchangeMic: "XNYS",
    listingId: "oid-listing-df5875b9129b425eb7a71639d386bf0f",
  },
  {
    symbol: "AIG",
    cik: "0000005272",
    exchangeMic: "XNYS",
    listingId: "oid-listing-ca6320aaed1546b4b60a39cfac5216c6",
  },
  {
    symbol: "ALCO",
    cik: "0000003545",
    exchangeMic: "XNAS",
    listingId: "oid-listing-aaa05639eb514de0b4e50eca8e2772a8",
  },
  {
    symbol: "AMD",
    cik: "0000002488",
    exchangeMic: "XNAS",
    listingId: "oid-listing-e2f6df3fdcf14a7c8dad342145ed2865",
  },
  {
    symbol: "AP",
    cik: "0000006176",
    exchangeMic: "XNYS",
    listingId: "oid-listing-7caea5222b61491bbdf4e108858bec02",
  },
  {
    symbol: "AVD",
    cik: "0000005981",
    exchangeMic: "XNYS",
    listingId: "oid-listing-761dd788312e43ec94fa70152b714ef2",
  },
  {
    symbol: "AXP",
    cik: "0000004962",
    exchangeMic: "XNYS",
    listingId: "oid-listing-1c349e39481c4ac3a809de85320ac624",
  },
  {
    symbol: "BKTI",
    cik: "0000002186",
    exchangeMic: "XNYS",
    listingId: "oid-listing-34697b1c4cea41238c7142c2fd450af6",
  },
  {
    symbol: "GOOG",
    cik: "0001652044",
    exchangeMic: "XNAS",
    listingId: "oid-listing-44bc5fe9c57246a3adef40bbcbcb88a7",
  },
  {
    symbol: "GOOGL",
    cik: "0001652044",
    exchangeMic: "XNAS",
    listingId: "oid-listing-5acae2cd933a4a32a3ac19e428ab27ce",
  },
  {
    symbol: "HWM",
    cik: "0000004281",
    exchangeMic: "XNYS",
    listingId: "oid-listing-4d7eaeadda75432580d22693b0b0550d",
  },
  {
    symbol: "LNG",
    cik: "0000003570",
    exchangeMic: "XNYS",
    listingId: "oid-listing-f2b374cd393c440da682a6117d0f0722",
  },
  {
    symbol: "MATX",
    cik: "0000003453",
    exchangeMic: "XNYS",
    listingId: "oid-listing-fa59842c214846238f516e08f48d0dd6",
  },
  {
    symbol: "MSFT",
    cik: "0000789019",
    exchangeMic: "XNAS",
    listingId: "oid-listing-eac65ef4a5d24849a600626df89fc761",
  },
  {
    symbol: "SWKS",
    cik: "0000004127",
    exchangeMic: "XNAS",
    listingId: "oid-listing-ec4641726d8e48a1b1eee268a2134d00",
  },
  {
    symbol: "UHAL",
    cik: "0000004457",
    exchangeMic: "XNYS",
    listingId: "oid-listing-aab6d6f78b3442a3a6260edef5df0819",
  },
  {
    symbol: "UNM",
    cik: "0000005513",
    exchangeMic: "XNYS",
    listingId: "oid-listing-f4cdc0dadb6844d382c8efa99a85022f",
  },
] as const;

function refusingSources() {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.reject(new Error("Unexpected provider request")),
  );
  const openAdmission = vi.fn(() => {
    throw new Error("Unexpected source admission");
  });
  const base = {
    catalog: getManagedWorkspaceCatalog(),
    enteredAt: "2026-10-16T21:00:00.000Z",
    startedAt: 0,
    monotonic: () => 0,
    now: () => new Date("2026-10-16T21:00:00.000Z"),
    fetch,
    openAdmission,
  };
  const sec = {
    ...base,
    configuration: {
      userAgent: "Invented catalog fixture fixture@example.test",
    },
  };
  return {
    fetch,
    openAdmission,
    eod: createManagedEodService({
      ...base,
      configuration: { enabledSymbols: ["AAPL", "GOOG", "GOOGL"] },
      token: "invented-token",
    }),
    annual: createManagedSecAnnualService(sec),
    filings: createManagedSecFilingsService(sec),
  };
}

describe("fixed managed catalog", () => {
  it.each(REVIEWED_LISTINGS)(
    "searches and resolves the reviewed $symbol listing without ticker rebinding",
    ({ symbol, cik, exchangeMic, listingId }) => {
      const service = createManagedCatalogService();
      const found = service.search(symbol)!;
      const exact = found.results.filter(
        (row) => row.matchKind === "current_symbol_exact",
      );
      expect(exact).toHaveLength(1);
      expect(exact[0]).toMatchObject({
        symbol,
        cik,
        exchangeMic,
        listingId,
        instrumentType: "common_stock",
      });
      expect(found.limitApplied).toBe(25);
      const identity = service.resolve({
        snapshotSha256: service.status().snapshot.snapshotSha256,
        listingIds: [listingId],
      })!.results[0]!.listing!;
      expect(Object.keys(identity)).toHaveLength(11);
      expect(exact[0]).toMatchObject(identity);
      expect(Object.isFrozen(identity)).toBe(true);
    },
  );

  it("preserves the four complete old identities and all twelve typed mappings", () => {
    for (const old of oldSnapshot.issuers)
      expect(
        snapshot.issuers.find((row) => row.issuerId === old.issuerId),
      ).toEqual(old);
    for (const old of oldSnapshot.records)
      expect(
        snapshot.records.find((row) => row.securityId === old.securityId),
      ).toEqual(old);
    for (const old of oldSnapshot.providerMappings)
      expect(
        snapshot.providerMappings.find(
          (row) => row.mappingId === old.mappingId,
        ),
      ).toEqual(old);
    const service = createManagedCatalogService();
    const ids = oldSnapshot.records.flatMap((row) =>
      row.shareClasses.flatMap((share) =>
        share.listings.map((listing) => listing.listingId),
      ),
    );
    expect(
      service.resolve({
        snapshotSha256: oldManifest.snapshotSha256,
        listingIds: ids,
      }),
    ).toBeNull();
    const current = service.resolve({
      snapshotSha256: service.status().snapshot.snapshotSha256,
      listingIds: ids,
    })!;
    expect(current.results.every((row) => row.listing !== null)).toBe(true);
    expect(current.results.map((row) => row.listingId)).toEqual(ids);
  });

  it("keeps the bounded public receipt separate from complete server filing provenance", () => {
    const status = createManagedCatalogService().status();
    expect(MANAGED_CATALOG_LIMITS.sources).toBe(8);
    expect(MANAGED_CATALOG_LIMITS.excludedCandidates).toBe(64);
    expect(status.snapshot.sources).toHaveLength(7);
    expect(status.snapshot.sources.slice(0, 6)).toEqual(oldManifest.sources);
    expect(status.snapshot.sources[6]).toEqual({
      label: "SEC filing collection for additional reviewed covers",
      url: "https://www.sec.gov/Archives/edgar/data/",
      issuerName: null,
      filingDate: null,
    });
    expect(status.snapshot.excludedCandidates).toHaveLength(14);
    expect(
      manifest.exclusionDetails
        .filter((row) => row.preparationReason === "unsupportedClassification")
        .map((row) => row.symbol),
    ).toEqual(["UNMA"]);
    expect(manifest.preparationReceipt).toMatchObject({
      admittedRecords: 19,
      candidateRecords: 33,
      quarantinedRecords: 13,
      unsupportedRecords: 1,
    });
    expect(manifest.filingEvidence.additionalCandidates).toHaveLength(27);
    expect(
      manifest.filingEvidence.additionalCandidates.filter(
        (row) => row.status === "prepared_identity",
      ),
    ).toHaveLength(15);
    expect(status.snapshot).not.toHaveProperty("filingEvidence");
    expect(status.snapshot).not.toHaveProperty("exclusionDetails");
    expect(status.snapshot).not.toHaveProperty("preparationReceipt");
    expect(
      new TextEncoder().encode(JSON.stringify(status)).byteLength,
    ).toBeLessThan(MANAGED_CATALOG_LIMITS.responseBytes);
  });

  it.each(manifest.excludedCandidates)(
    "keeps $symbol outside the admitted identities",
    ({ symbol }) => {
      const result = createManagedCatalogService().search(symbol)!;
      expect(result.results.some((row) => row.symbol === symbol)).toBe(false);
    },
  );

  it.each(
    REVIEWED_LISTINGS.filter(
      (row) => !["AAPL", "GOOG", "GOOGL"].includes(row.symbol),
    ),
  )(
    "refuses Price for $symbol before admission or a provider request",
    async ({ listingId }) => {
      const f = refusingSources();
      await expect(
        f.eod.load(
          {
            catalogSnapshotSha256: getManagedWorkspaceCatalog().snapshotSha256,
            listingId,
            range: "1m",
          },
          { userId: "invented-owner" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "unsupported_listing" });
      expect(f.openAdmission).not.toHaveBeenCalled();
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );

  it.each(
    REVIEWED_LISTINGS.filter(
      (row) => !["AAPL", "GOOG", "GOOGL", "MSFT"].includes(row.symbol),
    ),
  )(
    "refuses Annual and Filings for $symbol before admission or a provider request",
    async ({ listingId, symbol, cik }) => {
      const f = refusingSources();
      expect(MANAGED_SEC_ISSUERS).toEqual([
        "0000320193",
        "0001652044",
        "0000789019",
      ]);
      expect(MANAGED_SEC_ISSUERS).not.toContain(cik);
      const request = {
        catalogSnapshotSha256: getManagedWorkspaceCatalog().snapshotSha256,
        listingId,
        symbol,
      };
      await expect(
        f.annual.load(
          {
            ...request,
            schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
          },
          { userId: "invented-owner" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      await expect(
        f.filings.load(
          { ...request, schemaVersion: "1.0.0" },
          { userId: "invented-owner" },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(f.openAdmission).not.toHaveBeenCalled();
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );

  it("resolves exact listings in request order beyond the search result cap", () => {
    const service = createManagedCatalogService();
    const selected = service.search("GOOGL")!.results[0]!;
    const listingIds = [
      ...Array.from({ length: 49 }, (_, index) => `absent-${index}`),
      selected.listingId,
    ];
    const resolved = service.resolve({
      snapshotSha256: service.status().snapshot.snapshotSha256,
      listingIds,
    })!;
    expect(resolved.results).toHaveLength(50);
    expect(resolved.results.map((entry) => entry.listingId)).toEqual(
      listingIds,
    );
    expect(
      resolved.results.slice(0, 49).every((entry) => entry.listing === null),
    ).toBe(true);
    expect(resolved.results[49]?.listing?.symbol).toBe("GOOGL");
    expect(Object.keys(resolved.results[49]!.listing!)).toHaveLength(11);
    expect(resolved.results[49]?.listing).not.toHaveProperty("cik");
    expect(Object.isFrozen(resolved.results[49]?.listing)).toBe(true);
  });

  it("rejects stale digests and invalid batches before lookup", () => {
    const service = createManagedCatalogService();
    const lookup = vi.spyOn(
      securityMaster,
      "lookupPersonalSecurityMasterListing",
    );
    try {
      expect(
        service.resolve({
          snapshotSha256: `sha256:${"a".repeat(64)}`,
          listingIds: ["unknown"],
        }),
      ).toBeNull();
      expect(() =>
        service.resolve({
          snapshotSha256: service.status().snapshot.snapshotSha256,
          listingIds: Array.from(
            { length: 51 },
            (_, index) => `listing-${index}`,
          ),
        }),
      ).toThrow("Invalid catalog resolution");
      expect(() =>
        service.resolve({
          snapshotSha256: service.status().snapshot.snapshotSha256,
          listingIds: ["same", "same"],
        }),
      ).toThrow("Invalid catalog resolution");
      expect(lookup).not.toHaveBeenCalled();
    } finally {
      lookup.mockRestore();
    }
  });

  it("returns absent for saved-only IDs but preserves valid-ID lookup failures", () => {
    const service = createManagedCatalogService();
    const lookup = vi.spyOn(
      securityMaster,
      "lookupPersonalSecurityMasterListing",
    );
    try {
      const request = {
        snapshotSha256: service.status().snapshot.snapshotSha256,
        listingIds: ["X", "aa", "SAVED"],
      };
      expect(service.resolve(request)?.results).toEqual(
        request.listingIds.map((listingId) => ({ listingId, listing: null })),
      );
      expect(lookup).not.toHaveBeenCalled();
      lookup.mockImplementationOnce(() => {
        throw new Error("lookup failed");
      });
      expect(() =>
        service.resolve({ ...request, listingIds: ["valid-current-id"] }),
      ).toThrow("lookup failed");
      expect(lookup).toHaveBeenCalledTimes(1);
    } finally {
      lookup.mockRestore();
    }
  });

  it("binds the formatted build input to the original canonical snapshot", () => {
    const digest = `sha256:${createHash("sha256")
      .update(`${JSON.stringify(snapshot)}\n`)
      .digest("hex")}`;
    expect(digest).toBe(manifest.snapshotSha256);
    const catalog = getManagedWorkspaceCatalog();
    expect(catalog.snapshotSha256).toBe(digest);
    expect(getManagedWorkspaceCatalog()).toBe(catalog);
    expect(catalog.coverage).toMatchObject({
      activeListings: 19,
      issuers: 18,
      sourceRecords: 33,
      quarantinedSourceRecords: 13,
      unsupportedSourceRecords: 1,
      providerMappings: 57,
      basis: "reviewed_snapshot_only",
    });
  });

  it("distinguishes Alphabet classes and agrees with exact listing lookup", () => {
    const service = createManagedCatalogService();
    const response = service.search("Alphabet");
    expect(response?.totalMatches).toBe(2);
    const a = service.search("GOOGL")?.results[0];
    const c = service.search("GOOG")?.results[0];
    expect(a?.symbol).toBe("GOOGL");
    expect(c?.symbol).toBe("GOOG");
    expect(a?.issuerId).toBe(c?.issuerId);
    expect(a?.securityId).not.toBe(c?.securityId);
    expect(a?.shareClassId).not.toBe(c?.shareClassId);
    expect(a?.listingId).not.toBe(c?.listingId);
    for (const result of response?.results ?? []) {
      expect(result).toMatchObject(
        lookupPersonalSecurityMasterListing(
          getManagedWorkspaceCatalog(),
          result.listingId,
        )!,
      );
    }
  });

  it("keeps exclusions, source dates and limited coverage visible", () => {
    const service = createManagedCatalogService();
    for (const symbol of ["BRK-B", "TSM"])
      expect(service.search(symbol)?.results).toEqual([]);
    const receipt = service.status().snapshot;
    expect(receipt.excludedCandidates).toEqual(manifest.excludedCandidates);
    expect(receipt.sources.filter((source) => source.filingDate)).toEqual(
      manifest.sources.filter((source) => source.filingDate),
    );
    expect(receipt.contentKind).toBe("redistributable_source");
    expect(receipt.coverage.eligibleSecurityBand).toBe("under_1000");
    expect(receipt).not.toHaveProperty("sourcePolicyCompatibility");
    expect(receipt).not.toHaveProperty("providerMappings");
  });

  it("admits one Microsoft common-stock listing with exact lookup and dated filing evidence", () => {
    const service = createManagedCatalogService();
    const result = service.search("MSFT")!;
    expect(result.results).toHaveLength(1);
    const listing = result.results[0]!;
    expect(listing).toMatchObject({
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerName: "MICROSOFT CORP",
      securityName: "Common stock, $0.00000625 par value per share",
      shareClassName: "Common stock, $0.00000625 par value per share",
      symbol: "MSFT",
    });
    expect(
      service.search("Microsoft")?.results.map((entry) => entry.listingId),
    ).toEqual([listing.listingId]);
    expect(listing.cik).toBe("0000789019");
    const identity = Object.fromEntries(
      Object.entries(listing).filter(
        ([key]) => !["cik", "matchKind", "matchedValue"].includes(key),
      ),
    );
    expect(Object.keys(identity)).toHaveLength(11);
    const catalog = getManagedWorkspaceCatalog();
    expect(
      lookupPersonalSecurityMasterListing(catalog, listing.listingId),
    ).toMatchObject({ ...identity, cik: "0000789019" });
    expect(
      service.resolve({
        snapshotSha256: catalog.snapshotSha256,
        listingIds: [listing.listingId],
      })?.results,
    ).toEqual([{ listingId: listing.listingId, listing: identity }]);
    expect(service.status().snapshot.sources).toContainEqual({
      label: "Microsoft annual filing",
      url: "https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm",
      issuerName: "MICROSOFT CORPORATION",
      filingDate: "2026-07-29",
    });
    expect(service.status().snapshot.excludedCandidates).not.toContainEqual(
      expect.objectContaining({ symbol: "MSFT" }),
    );
  });

  it("preserves every existing price identity while catalog coverage grows", () => {
    const service = createManagedCatalogService();
    expect(
      MANAGED_EOD_MAPPING_CANDIDATES.map(
        (entry) => entry.security.symbol,
      ).sort(),
    ).toEqual(["AAPL", "GOOG", "GOOGL"]);
    for (const mapping of MANAGED_EOD_MAPPING_CANDIDATES) {
      const resolved = service.resolve({
        snapshotSha256: service.status().snapshot.snapshotSha256,
        listingIds: [mapping.security.listingId],
      })!.results[0]!.listing;
      expect(resolved).toEqual(mapping.security);
      expect(
        lookupPersonalSecurityMasterListing(
          getManagedWorkspaceCatalog(),
          mapping.security.listingId,
        ),
      ).toMatchObject({ ...mapping.security, cik: mapping.cik });
    }
  });

  it.each(["", " ", "---", "\u0000", "x".repeat(129)])(
    "rejects an unsupported query %j without a provider fallback",
    (query) => expect(createManagedCatalogService().search(query)).toBeNull(),
  );

  it("returns owned immutable wire data with the same receipt for search", () => {
    const service = createManagedCatalogService();
    const result = service.search("Apple");
    expect(result?.results[0]?.symbol).toBe("AAPL");
    expect(result?.snapshot).toEqual(service.status().snapshot);
    expect(Object.isFrozen(service.status())).toBe(true);
    expect(Object.isFrozen(service.status().snapshot.sources)).toBe(true);
    expect(Object.isFrozen(result?.results[0])).toBe(true);
    expect(() => {
      Object.assign(service.status().snapshot.coverage, { activeListings: 99 });
    }).toThrow(TypeError);
    expect(service.status().snapshot.coverage.activeListings).toBe(19);
  });
});
