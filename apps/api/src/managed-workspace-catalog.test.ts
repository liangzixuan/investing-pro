import { createHash } from "node:crypto";

import { lookupPersonalSecurityMasterListing } from "@research-cockpit/personal-security-master";
import * as securityMaster from "@research-cockpit/personal-security-master";
import { describe, expect, it, vi } from "vitest";

import manifest from "./managed-catalog/2026-09-30.manifest.json";
import snapshot from "./managed-catalog/2026-09-30.snapshot.json";
import {
  createManagedCatalogService,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

describe("fixed managed catalog", () => {
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
