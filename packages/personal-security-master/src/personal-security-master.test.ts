import { describe, expect, it } from "vitest";

import {
  PERSONAL_SECURITY_MASTER_CHECKS,
  PERSONAL_SECURITY_MASTER_CLAIM,
  PERSONAL_SECURITY_MASTER_LIMITS,
  PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN,
  PERSONAL_SECURITY_MASTER_NOT_PROVEN,
  PERSONAL_SECURITY_MASTER_PROFILE,
  PERSONAL_SECURITY_MASTER_SCHEMA_VERSION,
  PERSONAL_SECURITY_MASTER_SEARCH_NORMALIZATION,
  PERSONAL_SECURITY_MASTER_SEARCH_RANKING,
  PERSONAL_SECURITY_MASTER_SEARCH_TIE_BREAKS,
  PERSONAL_SECURITY_MASTER_SYMBOL_NORMALIZATION,
  PersonalSecurityMasterError,
  admitPersonalSecurityMasterSnapshot,
  measurePersonalSecurityMasterSearchP95,
  searchPersonalSecurityMaster,
} from "./personal-security-master";
import {
  admissionFromDocument,
  buildMutableSecurityMasterDocument,
  buildSecurityMasterAdmission,
  type MutableSecurityMasterDocument,
} from "./test-personal-security-master-builder";

describe("personal security master", () => {
  it("publishes the bounded personal profile and honest claim surface", () => {
    expect(PERSONAL_SECURITY_MASTER_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_SECURITY_MASTER_PROFILE).toBe(
      "personal_single_user_local_security_master",
    );
    expect(PERSONAL_SECURITY_MASTER_CLAIM).toContain(
      "bounded_exact_owner_local",
    );
    expect(PERSONAL_SECURITY_MASTER_LIMITS.records).toBe(20_000);
    expect(PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap).toBe(25);
    expect(
      PERSONAL_SECURITY_MASTER_LIMITS.normalizedSearchQueryCodePoints,
    ).toBe(512);
    expect(PERSONAL_SECURITY_MASTER_LIMITS.searchableNameCodePoints).toBe(128);
    expect(PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN).toEqual({
      clock: "module_captured_node_perf_hooks_performance_now_monotonic",
      iterations: 100,
      queryCount: 32,
      querySetDigestMethod:
        "sha256_of_utf8_canonical_json_ordered_raw_query_array_with_lf",
      resultLimit: 25,
      timedRegion: "normalize_request_and_search_in_memory_catalog",
    });
    expect(PERSONAL_SECURITY_MASTER_CHECKS).toContain(
      "exact_source_admitted_and_exclusion_coverage_accounting",
    );
    expect(PERSONAL_SECURITY_MASTER_NOT_PROVEN).toContain(
      "real_universe_three_thousand_security_breadth",
    );
    expect(PERSONAL_SECURITY_MASTER_NOT_PROVEN).toContain(
      "later_policy_revocation_after_offline_snapshot",
    );
    expect(PERSONAL_SECURITY_MASTER_NOT_PROVEN).toContain(
      "production_hardware_latency_slo",
    );
    expect(PERSONAL_SECURITY_MASTER_SEARCH_NORMALIZATION).toEqual([
      "trim_unicode_whitespace",
      "unicode_nfkd",
      "remove_combining_marks",
      "unicode_uppercase",
      "replace_non_letter_or_number_runs_with_one_space",
      "collapse_and_trim_spaces",
    ]);
    expect(PERSONAL_SECURITY_MASTER_SEARCH_RANKING).toEqual([
      "current_symbol_exact",
      "current_symbol_prefix",
      "former_symbol_exact",
      "former_symbol_prefix",
      "name_exact",
      "name_token_prefix",
      "name_contains",
    ]);
    expect(PERSONAL_SECURITY_MASTER_SYMBOL_NORMALIZATION).toContain(
      "preserve_ascii_dot_and_hyphen",
    );
    expect(PERSONAL_SECURITY_MASTER_SEARCH_TIE_BREAKS[0]).toBe(
      "unicode_code_point_current_symbol",
    );
  });

  it("admits an exact digest-bound canonical snapshot with immutable status", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );

    expect(catalog).toMatchObject({
      catalogId: "personal-security-master-2026-09",
      catalogVersion: "1.0.0",
      claim: PERSONAL_SECURITY_MASTER_CLAIM,
      profile: PERSONAL_SECURITY_MASTER_PROFILE,
      schemaVersion: PERSONAL_SECURITY_MASTER_SCHEMA_VERSION,
      status: "admitted_for_personal_local_search",
    });
    expect(catalog.snapshotSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(catalog.coverage).toEqual({
      admittedSourceRecords: 2,
      activeEligibleSecurities: 2,
      activeListings: 2,
      basis: "synthetic_engineering_only_not_real_universe",
      eligibleSecurityBand: "under_1000",
      formerTickerEntries: 1,
      ineligibleSourceRecords: 5,
      inactiveSecurities: 0,
      issuers: 1,
      providerMappings: 4,
      quarantinedSourceRecords: 3,
      sourceRecords: 17,
      staleSourceRecords: 4,
      shareClasses: 2,
      totalSecurities: 2,
      unsupportedSourceRecords: 3,
    });
    expect(catalog.provenance.artifacts).toHaveLength(2);
    expect(catalog.provenance.artifacts[1]?.mediaType).toBe("text/html");
    expect(catalog.sourcePolicyCompatibility).toMatchObject({
      decision: "compatible",
      operation: "fetch_snapshot",
      policyProfile: "personal_single_user_local_connected",
      revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
      revokedAt: null,
      sourceId: catalog.provenance.sourceId,
    });
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.coverage)).toBe(true);
    expect(Object.isFrozen(catalog.provenance)).toBe(true);
    expect(Object.isFrozen(catalog.provenance.artifacts)).toBe(true);
    expect(Object.isFrozen(catalog.provenance.artifacts[0])).toBe(true);
    expect(Object.isFrozen(catalog.sourcePolicyCompatibility)).toBe(true);
  });

  it("owns the snapshot bytes and returns immutable defensive search results", () => {
    const admission = buildSecurityMasterAdmission();
    const originalFirstByte = admission.snapshot[0];
    const catalog = admitPersonalSecurityMasterSnapshot(admission);
    admission.snapshot.fill(0);

    const response = searchPersonalSecurityMaster(catalog, {
      limit: 5,
      query: "S00000",
    });
    expect(originalFirstByte).not.toBe(0);
    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.securityId).toBe("sec-00000");
    expect(response.results[0]).toMatchObject({
      country: "US",
      issuerId: "iss-00000",
      shareClassId: "shr-00000",
      shareClassName: "Zéro Alpha ADR",
    });
    expect(Object.isFrozen(response)).toBe(true);
    expect(Object.isFrozen(response.results)).toBe(true);
    expect(Object.isFrozen(response.results[0])).toBe(true);
    expect(() =>
      (
        response.results as unknown as PersonalSecurityMasterSearchResultMutable[]
      ).push(
        response
          .results[0] as unknown as PersonalSecurityMasterSearchResultMutable,
      ),
    ).toThrow();
  });

  it("ranks current/former symbols before normalized names", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    expect(searchOne(catalog, "S00000")).toMatchObject({
      matchKind: "current_symbol_exact",
      matchedValue: "S00000",
    });
    expect(searchOne(catalog, "S000")).toMatchObject({
      matchKind: "current_symbol_prefix",
      matchedValue: "S00000",
    });
    expect(searchOne(catalog, "OLDZERO")).toMatchObject({
      matchKind: "former_symbol_exact",
      matchedValue: "OLDZERO",
      symbol: "S00000",
    });
    expect(searchOne(catalog, "OLDZ")).toMatchObject({
      matchKind: "former_symbol_prefix",
      matchedValue: "OLDZERO",
    });
    expect(searchOne(catalog, "zero alpha holdings")).toMatchObject({
      matchKind: "name_exact",
      matchedValue: "Zéro Alpha Holdings",
    });
    expect(searchOne(catalog, "alpha")).toMatchObject({
      matchKind: "name_token_prefix",
      matchedValue: "Zéro Alpha Holdings",
    });
    expect(searchOne(catalog, "pha hold")).toMatchObject({
      matchKind: "name_contains",
      matchedValue: "Zéro Alpha Holdings",
    });
  });

  it("keeps dot and hyphen ticker identities distinct with code-point ties", () => {
    const document = buildMutableSecurityMasterDocument(2);
    setCurrentSymbol(document, 0, "A-B");
    setCurrentSymbol(document, 1, "A.B");
    const catalog = admitPersonalSecurityMasterSnapshot(
      admissionFromDocument(document),
    );

    const hyphen = searchPersonalSecurityMaster(catalog, {
      limit: 5,
      query: "A-B",
    });
    expect(hyphen.results).toHaveLength(1);
    expect(hyphen.normalizedQuery).toBe("A-B");
    expect(
      searchPersonalSecurityMaster(catalog, { limit: 5, query: "A.B" }).results,
    ).toHaveLength(1);
    expect(
      searchPersonalSecurityMaster(catalog, { limit: 5, query: "A.B" })
        .normalizedQuery,
    ).toBe("A.B");
    expect(
      searchPersonalSecurityMaster(catalog, {
        limit: 5,
        query: "A",
      }).results.map((result) => result.symbol),
    ).toEqual(["A-B", "A.B"]);
  });

  it("applies the exact result cap while retaining total match count", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(40),
    );
    const response = searchPersonalSecurityMaster(catalog, {
      limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap,
      query: "synthetic",
    });
    expect(response.limitApplied).toBe(25);
    expect(response.totalMatches).toBe(39);
    expect(response.results).toHaveLength(25);
    expect(response.results[0]?.securityId).toBe("sec-00001");
  });

  it("keeps listing, share-class, composite, and security provider mappings distinct", () => {
    const document = buildMutableSecurityMasterDocument(1);
    document.providerMappings.push(
      {
        mappingId: "map-00000-c",
        mappingKind: "composite",
        providerId: "synthetic-provider",
        providerSecurityId: "composite-figi-00000",
        targetId: "shr-00000",
      },
      {
        mappingId: "map-00000-d",
        mappingKind: "issuer",
        providerId: "synthetic-provider",
        providerSecurityId: "issuer-key-00000",
        targetId: "iss-00000",
      },
      {
        mappingId: "map-00000-e",
        mappingKind: "security",
        providerId: "synthetic-provider",
        providerSecurityId: "security-key-00000",
        targetId: "sec-00000",
      },
      {
        mappingId: "map-00000-f",
        mappingKind: "share_class",
        providerId: "second-synthetic-provider",
        providerSecurityId: "second-share-class-figi-00000",
        targetId: "shr-00000",
      },
    );
    const catalog = admitPersonalSecurityMasterSnapshot(
      admissionFromDocument(document),
    );
    expect(catalog.coverage.providerMappings).toBe(6);
  });

  it("rejects multiple external IDs for one provider, mapping kind, and target", () => {
    const document = buildMutableSecurityMasterDocument(1);
    document.providerMappings.push({
      mappingId: "map-00000-c",
      mappingKind: "share_class",
      providerId: "synthetic-provider",
      providerSecurityId: "alternate-share-class-figi-00000",
      targetId: "shr-00000",
    });
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(admissionFromDocument(document)),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );
  });

  it("supports one issuer with multiple securities and nested share classes", () => {
    const document = buildMutableSecurityMasterDocument(2);
    const record = document.records[0]!;
    record.shareClasses.push({
      active: true,
      listings: [
        {
          active: true,
          country: "US",
          currentSymbol: "CLASSB",
          exchangeMic: "XNYS",
          exchangeMicType: "operating",
          listingId: "lst-00000-b",
          securityId: "sec-00000",
          shareClassId: "shr-00000-b",
          tickerHistory: [
            {
              listingId: "lst-00000-b",
              symbol: "CLASSB",
              timeBasis: "prospective_snapshot_observed",
              validFrom: "2021-01-01T00:00:00.000Z",
              validTo: null,
            },
          ],
        },
      ],
      securityId: "sec-00000",
      shareClassId: "shr-00000-b",
      shareClassName: "Zéro Alpha Class B",
    });
    document.providerMappings.splice(
      2,
      0,
      {
        mappingId: "map-00000-c",
        mappingKind: "share_class",
        providerId: "synthetic-provider",
        providerSecurityId: "share-class-figi-00000-b",
        targetId: "shr-00000-b",
      },
      {
        mappingId: "map-00000-d",
        mappingKind: "listing",
        providerId: "synthetic-provider",
        providerSecurityId: "listing-figi-00000-b",
        targetId: "lst-00000-b",
      },
    );
    const catalog = admitPersonalSecurityMasterSnapshot(
      admissionFromDocument(document),
    );
    const result = searchOne(catalog, "class b");
    expect(document.records[0]?.issuerId).toBe(document.records[1]?.issuerId);
    expect(catalog.coverage).toMatchObject({
      activeListings: 3,
      issuers: 1,
      shareClasses: 3,
      totalSecurities: 2,
    });
    expect(result).toMatchObject({
      issuerId: "iss-00000",
      listingId: "lst-00000-b",
      matchedValue: "Zéro Alpha Class B",
      securityId: "sec-00000",
      shareClassId: "shr-00000-b",
      shareClassName: "Zéro Alpha Class B",
      symbol: "CLASSB",
    });
  });

  it("validates source coverage and source-policy chronology as closed facts", () => {
    const mutations: Array<(value: MutableSecurityMasterDocument) => void> = [
      (value) => {
        value.sourceCoverage.sourceRecords = 999;
      },
      (value) => {
        value.sourceCoverage.admittedRecords = 1;
      },
      (value) => {
        value.sourcePolicyCompatibility.sourceId = "different-source";
      },
      (value) => {
        value.sourcePolicyCompatibility.revokedAt = "2026-08-31T00:00:00.000Z";
      },
      (value) => {
        value.sourcePolicyCompatibility.expiresAt = "2026-08-31T00:00:00.000Z";
      },
      (value) => {
        value.sourcePolicyCompatibility.expiresAt = value.asOf;
      },
      (value) => {
        value.provenance.sourceRevision = `sha256:${"d".repeat(64)}`;
      },
      (value) => {
        value.generatedAt = "2026-09-01T16:59:59.999Z";
      },
      (value) => {
        (
          value.provenance.artifacts as Record<string, unknown>[]
        )[0]!.sourceUri = "http://example.invalid/not-https";
      },
    ];
    for (const mutate of mutations) {
      const document = buildMutableSecurityMasterDocument();
      mutate(document);
      expectFailure(
        () =>
          admitPersonalSecurityMasterSnapshot(admissionFromDocument(document)),
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
      );
    }
  });

  it("rejects broken references, chronology, identities, and active eligibility", () => {
    const mutations: Array<(value: MutableSecurityMasterDocument) => void> = [
      (value) => {
        value.records[0]!.eligibility = "ineligible";
      },
      (value) => {
        firstListing(value, 0).securityId = "sec-99999";
      },
      (value) => {
        firstListing(value, 0).tickerHistory[0]!.listingId = "lst-99999";
      },
      (value) => {
        value.providerMappings[0]!.targetId = "shr-99999";
      },
      (value) => {
        value.providerMappings[2]!.mappingId = "map-00000-a";
      },
      (value) => {
        value.providerMappings[2]!.providerSecurityId =
          "share-class-figi-00000";
      },
      (value) => {
        firstListing(value, 0).listingId = "0000000001";
        for (const ticker of firstListing(value, 0).tickerHistory) {
          ticker.listingId = "0000000001";
        }
        value.providerMappings[1]!.targetId = "0000000001";
      },
      (value) => {
        firstListing(value, 0).listingId = "s00000";
        for (const ticker of firstListing(value, 0).tickerHistory) {
          ticker.listingId = "s00000";
        }
        value.providerMappings[1]!.targetId = "s00000";
      },
      (value) => {
        value.providerMappings[0]!.mappingId =
          value.providerMappings[0]!.providerSecurityId;
      },
      (value) => {
        value.issuers[0]!.issuerId = "share-class-figi-00000";
        value.records[0]!.issuerId = "share-class-figi-00000";
        value.records[1]!.issuerId = "share-class-figi-00000";
      },
      (value) => {
        setCurrentSymbol(value, 1, "S00000");
        firstListing(value, 1).exchangeMic = "XNAS";
      },
      (value) => {
        firstListing(value, 0).tickerHistory[0]!.validTo =
          "2009-01-01T00:00:00.000Z";
      },
      (value) => {
        firstListing(value, 0).tickerHistory[0]!.timeBasis =
          "exchange_effective";
      },
      (value) => {
        firstListing(value, 0).country = "CA";
      },
      (value) => {
        firstListing(value, 0).exchangeMicType = "segment";
      },
      (value) => {
        value.records[0]!.issuerId = "iss-99999";
      },
      (value) => {
        value.records[0]!.shareClasses[0]!.securityId = "sec-99999";
      },
      (value) => {
        value.providerMappings.splice(1, 1);
      },
    ];
    for (const mutate of mutations) {
      const document = buildMutableSecurityMasterDocument();
      mutate(document);
      expectFailure(
        () =>
          admitPersonalSecurityMasterSnapshot(admissionFromDocument(document)),
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
      );
    }
  });

  it("rejects duplicate CIK declarations for different issuers", () => {
    const document = buildMutableSecurityMasterDocument(3);
    document.issuers[1]!.cik = document.issuers[0]!.cik;
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(admissionFromDocument(document)),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );
  });

  it("uses the fixed package-owned monotonic measurement plan", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    const measurement = measurePersonalSecurityMasterSearchP95(catalog, {
      hardwareProfile: "vitest-process-unspecified-ci-hardware",
      iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
      queries: measurementQueries(),
      resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
    });
    expect(measurement).toMatchObject({
      activeEligibleSecurities: 2,
      basis: "synthetic_engineering_only_not_production_slo",
      catalogId: catalog.catalogId,
      catalogVersion: catalog.catalogVersion,
      clock: "module_captured_node_perf_hooks_performance_now_monotonic",
      hardwareProfile: "vitest-process-unspecified-ci-hardware",
      iterations: 100,
      method: "nearest_rank_p95_of_individual_local_searches",
      queryCount: 32,
      querySetDigestMethod:
        "sha256_of_utf8_canonical_json_ordered_raw_query_array_with_lf",
      rawQuerySetSha256:
        "sha256:cab65913f185472498b9ab39229c4955b0373e91b808d8017e936afde338a4e8",
      resultLimit: 25,
      sampleCount: 3_200,
      snapshotSha256: catalog.snapshotSha256,
      timedRegion: "normalize_request_and_search_in_memory_catalog",
    });
    expect(Number.isFinite(measurement.p95Milliseconds)).toBe(true);
    expect(measurement.p95Milliseconds).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(measurement.maximumMilliseconds)).toBe(true);
    expect(measurement.maximumMilliseconds).toBeGreaterThanOrEqual(
      measurement.p95Milliseconds,
    );
    expect(Object.isFrozen(measurement)).toBe(true);
  });

  it("handles at least 3,000 eligible records below a generous local synthetic p95", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(3_100),
    );
    expect(catalog.coverage).toMatchObject({
      activeEligibleSecurities: 3_100,
      basis: "synthetic_engineering_only_not_real_universe",
      eligibleSecurityBand: "at_least_3000",
    });

    const measurement = measurePersonalSecurityMasterSearchP95(catalog, {
      hardwareProfile: "vitest-process-unspecified-ci-hardware",
      iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
      queries: measurementQueries(),
      resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
    });
    expect(measurement.basis).toBe(
      "synthetic_engineering_only_not_production_slo",
    );
    expect(measurement.sampleCount).toBe(3_200);
    expect(measurement.resultLimit).toBe(25);
    expect(measurement.clock).toBe(
      "module_captured_node_perf_hooks_performance_now_monotonic",
    );
    expect(measurement.timedRegion).toBe(
      "normalize_request_and_search_in_memory_catalog",
    );
    // Engineering-only guardrail: synthetic bytes do not prove real coverage or an SLO.
    expect(measurement.p95Milliseconds).toBeLessThan(200);
  }, 30_000);
});

function measurementQueries(): string[] {
  return Array.from(
    { length: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.queryCount },
    (_, index) => `S${String(index).padStart(5, "0")}`,
  );
}

type PersonalSecurityMasterSearchResultMutable = Record<string, unknown>;

function searchOne(
  catalog: ReturnType<typeof admitPersonalSecurityMasterSnapshot>,
  query: string,
) {
  const result = searchPersonalSecurityMaster(catalog, { limit: 1, query })
    .results[0];
  expect(result).toBeDefined();
  return result;
}

function setCurrentSymbol(
  document: MutableSecurityMasterDocument,
  recordIndex: number,
  symbol: string,
): void {
  const listing = firstListing(document, recordIndex);
  listing.currentSymbol = symbol;
  listing.tickerHistory.at(-1)!.symbol = symbol;
}

function firstListing(
  document: MutableSecurityMasterDocument,
  recordIndex: number,
) {
  return document.records[recordIndex]!.shareClasses[0]!.listings[0]!;
}

function expectFailure(
  callback: () => unknown,
  code: PersonalSecurityMasterError["code"],
): void {
  try {
    callback();
    throw new Error("expected operation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalSecurityMasterError);
    expect((error as PersonalSecurityMasterError).code).toBe(code);
    expect((error as Error).message).toBe(
      "Personal security master operation failed.",
    );
  }
}
