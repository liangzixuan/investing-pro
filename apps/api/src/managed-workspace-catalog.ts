import {
  MANAGED_CATALOG_LIMITS,
  parseManagedCatalogSearch,
  parseManagedCatalogStatus,
  type ManagedCatalogSearchDto,
  type ManagedCatalogStatusDto,
} from "@research-cockpit/contracts";
import {
  PersonalSecurityMasterError,
  admitManagedSecurityMasterSnapshot,
  searchPersonalSecurityMaster,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";

import manifest from "./managed-catalog/2026-09-30.manifest.json";
import snapshot from "./managed-catalog/2026-09-30.snapshot.json";

export interface ManagedCatalogService {
  status(): ManagedCatalogStatusDto;
  /** A rejected query returns null; an unavailable catalog throws. */
  search(query: string): ManagedCatalogSearchDto | null;
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
