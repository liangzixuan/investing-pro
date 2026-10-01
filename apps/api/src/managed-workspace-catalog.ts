import {
  MANAGED_CATALOG_LIMITS,
  parseManagedCatalogResolveRequest,
  parseManagedCatalogResolveResponse,
  parseManagedCatalogSearch,
  parseManagedCatalogStatus,
  type ManagedCatalogSearchDto,
  type ManagedCatalogStatusDto,
  type ManagedCatalogResolveRequest,
  type ManagedCatalogResolveResponse,
} from "@research-cockpit/contracts";
import {
  PersonalSecurityMasterError,
  admitManagedSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  searchPersonalSecurityMaster,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";

import manifest from "./managed-catalog/2026-09-30.manifest.json";
import snapshot from "./managed-catalog/2026-09-30.snapshot.json";

export interface ManagedCatalogService {
  status(): ManagedCatalogStatusDto;
  /** A rejected query returns null; an unavailable catalog throws. */
  search(query: string): ManagedCatalogSearchDto | null;
  /** Null means the requested digest is no longer current. */
  resolve(
    request: ManagedCatalogResolveRequest,
  ): ManagedCatalogResolveResponse | null;
}

let admittedCatalog: ManagedSecurityMasterCatalog | undefined;

/** Fixed build input only. No file, provider, credential or storage lookup. */
export function getManagedWorkspaceCatalog(): ManagedSecurityMasterCatalog {
  admittedCatalog ??= admitManagedSecurityMasterSnapshot({
    expectedSha256:
      "sha256:0ff96ab386a9f1ce4ecab834706aa8da6d9b8ee9efd97f9f79908d616b43a3e4",
    // The checked JSON has canonical key order; formatting is not identity.
    snapshot: new TextEncoder().encode(`${JSON.stringify(snapshot)}\n`),
  });
  return admittedCatalog;
}

export function createManagedCatalogService(): ManagedCatalogService {
  const catalog = getManagedWorkspaceCatalog();
  if (
    manifest.snapshotSha256 !== catalog.snapshotSha256 ||
    catalog.provenance.contentKind !== "redistributable_source"
  )
    throw new Error("Managed catalog unavailable");

  const status = parseManagedCatalogStatus({
    snapshot: {
      schemaVersion: catalog.schemaVersion,
      profile: catalog.profile,
      snapshotSha256: catalog.snapshotSha256,
      catalogId: catalog.catalogId,
      catalogVersion: catalog.catalogVersion,
      asOf: catalog.asOf,
      generatedAt: catalog.generatedAt,
      acquiredAt: catalog.provenance.acquiredAt,
      contentKind: catalog.provenance.contentKind,
      attribution: catalog.provenance.attribution,
      coverage: catalog.coverage,
      sources: manifest.sources,
      excludedCandidates: manifest.excludedCandidates,
    },
  });
  if (status === null) throw new Error("Managed catalog unavailable");

  return Object.freeze({
    status: () => status,
    resolve(input: ManagedCatalogResolveRequest) {
      const request = parseManagedCatalogResolveRequest(input);
      if (request === null) throw new Error("Invalid catalog resolution");
      if (request.snapshotSha256 !== catalog.snapshotSha256) return null;
      const response = parseManagedCatalogResolveResponse(
        {
          snapshotSha256: catalog.snapshotSha256,
          results: request.listingIds.map((listingId) => {
            // Historical saved IDs outside the current core grammar are absent.
            // A core lookup failure for a valid current ID must still propagate.
            const found = /^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(listingId)
              ? lookupPersonalSecurityMasterListing(catalog, listingId)
              : null;
            const listing =
              found === null
                ? null
                : {
                    country: found.country,
                    exchangeMic: found.exchangeMic,
                    instrumentType: found.instrumentType,
                    issuerId: found.issuerId,
                    issuerName: found.issuerName,
                    listingId: found.listingId,
                    securityId: found.securityId,
                    securityName: found.securityName,
                    shareClassId: found.shareClassId,
                    shareClassName: found.shareClassName,
                    symbol: found.symbol,
                  };
            return { listingId, listing };
          }),
        },
        request,
      );
      if (response === null) throw new Error("Managed catalog unavailable");
      return response;
    },
    search(query: string) {
      let result;
      try {
        result = searchPersonalSecurityMaster(catalog, {
          query,
          limit: MANAGED_CATALOG_LIMITS.searchResultCap,
        });
      } catch (error) {
        if (
          error instanceof PersonalSecurityMasterError &&
          error.code === "PERSONAL_SECURITY_MASTER_SEARCH_INVALID"
        )
          return null;
        throw error;
      }
      const response = parseManagedCatalogSearch({
        snapshot: status.snapshot,
        results: result.results,
        limitApplied: result.limitApplied,
        totalMatches: result.totalMatches,
        normalizedQuery: result.normalizedQuery,
      });
      if (response === null) throw new Error("Managed catalog unavailable");
      return response;
    },
  });
}
