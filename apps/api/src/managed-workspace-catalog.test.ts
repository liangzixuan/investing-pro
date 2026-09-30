import { createHash } from "node:crypto";

import { lookupPersonalSecurityMasterListing } from "@research-cockpit/personal-security-master";
import { describe, expect, it } from "vitest";

import manifest from "./managed-catalog/2026-09-30.manifest.json";
import snapshot from "./managed-catalog/2026-09-30.snapshot.json";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

describe("fixed managed catalog", () => {
  it("binds the formatted build input to the original canonical snapshot", () => {
    const digest = `sha256:${createHash("sha256")
      .update(`${JSON.stringify(snapshot)}\n`)
      .digest("hex")}`;
    expect(digest).toBe(manifest.snapshotSha256);
    const catalog = getManagedWorkspaceCatalog();
    expect(catalog.snapshotSha256).toBe(digest);
    expect(getManagedWorkspaceCatalog()).toBe(catalog);
    expect(catalog.coverage).toMatchObject({
      activeListings: 3,
      issuers: 2,
      sourceRecords: 6,
      quarantinedSourceRecords: 3,
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
    for (const symbol of ["MSFT", "BRK-B", "TSM"])
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
    expect(service.status().snapshot.coverage.activeListings).toBe(3);
  });
});
