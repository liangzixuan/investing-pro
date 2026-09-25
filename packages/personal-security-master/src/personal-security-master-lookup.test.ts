import { describe, expect, it, vi } from "vitest";

import {
  admitPersonalSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  type PersonalSecurityMasterCatalog,
} from "./index";
import {
  admissionFromDocument,
  buildMutableSecurityMasterDocument,
  buildSecurityMasterAdmission,
} from "./test-personal-security-master-builder";

describe("exact admitted listing lookup", () => {
  it("returns the exact active listing with full identity and no search metadata", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    const result = lookupPersonalSecurityMasterListing(catalog, "lst-00001");
    expect(result).toEqual({
      cik: "0000000001",
      country: "US",
      exchangeMic: "XNYS",
      instrumentType: "common_stock",
      issuerId: "iss-00000",
      issuerName: "Zéro Alpha Holdings",
      listingId: "lst-00001",
      securityId: "sec-00001",
      securityName: "Synthetic Security 00001",
      shareClassId: "shr-00001",
      shareClassName: "Synthetic Class 00001",
      symbol: "S00001",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).not.toHaveProperty("matchKind");
    expect(result).not.toHaveProperty("providerMappings");
  });

  it.each(["lst-missing", "lst-000", "s00001", "oldzero"])(
    "does not broaden missing identity %s into search",
    (listingId) => {
      const catalog = admitPersonalSecurityMasterSnapshot(
        buildSecurityMasterAdmission(),
      );
      expect(
        lookupPersonalSecurityMasterListing(catalog, listingId),
      ).toBeNull();
    },
  );

  it("excludes an inactive listing under an otherwise active admitted security", () => {
    const document = buildMutableSecurityMasterDocument();
    const shareClass = document.records[1]?.shareClasses[0];
    const current = shareClass?.listings[0];
    if (shareClass === undefined || current === undefined)
      throw new Error("Missing fixture");
    shareClass.listings.push({
      ...current,
      active: false,
      currentSymbol: null,
      listingId: "lst-00001-retired",
      tickerHistory: current.tickerHistory.map((period) => ({
        ...period,
        listingId: "lst-00001-retired",
        validTo: "2026-08-01T00:00:00.000Z",
      })),
    });
    document.providerMappings.push({
      mappingId: "map-00001-c",
      mappingKind: "listing",
      providerId: "synthetic-provider",
      providerSecurityId: "listing-figi-retired",
      targetId: "lst-00001-retired",
    });
    const catalog = admitPersonalSecurityMasterSnapshot(
      admissionFromDocument(document),
    );
    expect(
      lookupPersonalSecurityMasterListing(catalog, "lst-00001-retired"),
    ).toBeNull();
    expect(
      lookupPersonalSecurityMasterListing(catalog, "lst-00001"),
    ).not.toBeNull();
  });

  it.each([
    "",
    "ab",
    "LST-00001",
    " lst-00001",
    "lst-00001 ",
    "lst/00001",
    "lst%2F00001",
    "lst-00001?x=1",
    "x".repeat(129),
  ])("rejects invalid listing identity %s", (listingId) => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    expect(() =>
      lookupPersonalSecurityMasterListing(catalog, listingId),
    ).toThrow(
      expect.objectContaining({
        code: "PERSONAL_SECURITY_MASTER_LOOKUP_INVALID",
      }),
    );
  });

  it("rejects forged catalog capabilities, extra arguments and coercive IDs", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    const forged = Object.freeze({
      ...catalog,
    }) as PersonalSecurityMasterCatalog;
    expect(() =>
      lookupPersonalSecurityMasterListing(forged, "lst-00001"),
    ).toThrow(
      expect.objectContaining({
        code: "PERSONAL_SECURITY_MASTER_LOOKUP_INVALID",
      }),
    );
    expect(() => {
      Reflect.apply(lookupPersonalSecurityMasterListing, undefined, [
        catalog,
        "lst-00001",
        "ignored",
      ]);
    }).toThrow(
      expect.objectContaining({
        code: "PERSONAL_SECURITY_MASTER_LOOKUP_INVALID",
      }),
    );
    const toString = vi.fn(() => "lst-00001");
    expect(() => {
      Reflect.apply(lookupPersonalSecurityMasterListing, undefined, [
        catalog,
        { toString },
      ]);
    }).toThrow(
      expect.objectContaining({
        code: "PERSONAL_SECURITY_MASTER_LOOKUP_INVALID",
      }),
    );
    expect(toString).not.toHaveBeenCalled();
  });
});
