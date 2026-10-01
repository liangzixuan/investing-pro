import { describe, expect, it } from "vitest";
import {
  MANAGED_CATALOG_LIMITS,
  MANAGED_CATALOG_SEARCH_PATH,
  MANAGED_CATALOG_STATUS_PATH,
  parseManagedCatalogSearch,
  parseManagedCatalogStatus,
  type ManagedCatalogCoverageDto,
  type ManagedCatalogSnapshotDto,
  type PersonalSecurityMasterSearchResultDto,
} from "./index";

function coverage(): ManagedCatalogCoverageDto {
  return {
    activeEligibleSecurities: 3,
    activeListings: 3,
    admittedSourceRecords: 3,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 2,
    providerMappings: 3,
    quarantinedSourceRecords: 3,
    sourceRecords: 6,
    staleSourceRecords: 0,
    shareClasses: 3,
    totalSecurities: 3,
    unsupportedSourceRecords: 0,
  };
}

function snapshot(): ManagedCatalogSnapshotDto {
  return {
    schemaVersion: "1.0.0",
    profile: "personal_single_user_managed_security_master",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    catalogId: "catalog-demo",
    catalogVersion: "version-demo",
    acquiredAt: "2026-09-29T00:00:00.000Z",
    generatedAt: "2026-09-30T00:00:00.000Z",
    asOf: "2026-09-30T12:00:00.000Z",
    contentKind: "synthetic_engineering",
    attribution: "Invented engineering catalog",
    coverage: coverage(),
    sources: [
      {
        label: "Reference",
        url: "https://example.test/reference",
        issuerName: null,
        filingDate: null,
      },
      {
        label: "Example filing",
        url: "https://example.test/filing",
        issuerName: "Example issuer",
        filingDate: "2026-08-01",
      },
    ],
    excludedCandidates: [
      { symbol: "DEMO", reason: "source_review_incomplete" },
    ],
  };
}

function result(
  listingId = "listing-one",
): PersonalSecurityMasterSearchResultDto {
  return {
    cik: "0000000001",
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-one",
    issuerName: "Example issuer",
    listingId,
    matchKind: "name_exact",
    matchedValue: "Example issuer",
    securityId: "security-one",
    securityName: "Example common",
    shareClassId: "class-one",
    shareClassName: "Common",
    symbol: "DEMO",
  };
}

function search() {
  const base = snapshot();
  return {
    snapshot: {
      ...base,
      coverage: { ...base.coverage },
      sources: base.sources.map((source) => ({ ...source })),
      excludedCandidates: base.excludedCandidates.map((entry) => ({
        ...entry,
      })),
    },
    results: [{ ...result() }],
    limitApplied: 25,
    totalMatches: 1,
    normalizedQuery: "EXAMPLE",
  };
}

describe("managed catalog wire contract", () => {
  it("exports the fixed read routes and core search limits", () => {
    expect(MANAGED_CATALOG_STATUS_PATH).toBe("/v1/managed/catalog");
    expect(MANAGED_CATALOG_SEARCH_PATH).toBe("/v1/managed/catalog/search");
    expect(MANAGED_CATALOG_LIMITS.searchResultCap).toBe(25);
    expect(MANAGED_CATALOG_LIMITS.searchQueryCodePoints).toBe(128);
    expect(MANAGED_CATALOG_LIMITS.maximumRequestTargetCodeUnits).toBe(2048);
  });

  it("accepts public metadata without full policy fields and preserves partial coverage", () => {
    const input = { snapshot: snapshot() };
    expect(parseManagedCatalogStatus(input)).toEqual(input);
    const reviewed = {
      ...snapshot(),
      contentKind: "redistributable_source",
      coverage: { ...coverage(), basis: "reviewed_snapshot_only" },
    };
    expect(parseManagedCatalogStatus({ snapshot: reviewed })).toEqual({
      snapshot: reviewed,
    });
    expect(
      parseManagedCatalogStatus({ snapshot: { ...reviewed, policy: {} } }),
    ).toBeNull();
  });

  it("owns and freezes all nested output without mutating its inputs", () => {
    const input = structuredClone(search());
    const before = structuredClone(input);
    const parsed = parseManagedCatalogSearch(input)!;
    expect(input).toEqual(before);
    expect(parsed).toEqual(before);
    input.snapshot.coverage.activeListings = 99;
    input.snapshot.sources[0]!.label = "Changed";
    input.snapshot.excludedCandidates[0]!.symbol = "OTHER";
    input.results[0]!.issuerName = "Changed";
    input.results.push(result("listing-two"));
    expect(parsed).toEqual(before);
    for (const part of [
      parsed,
      parsed.snapshot,
      parsed.snapshot.coverage,
      parsed.snapshot.sources,
      parsed.snapshot.sources[0],
      parsed.snapshot.excludedCandidates,
      parsed.snapshot.excludedCandidates[0],
      parsed.results,
      parsed.results[0],
    ]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
  });

  it("rejects missing, extra, symbol and accessor fields at every object level", () => {
    const value = search();
    const paths = [
      [],
      ["snapshot"],
      ["snapshot", "coverage"],
      ["snapshot", "sources", "0"],
      ["snapshot", "excludedCandidates", "0"],
      ["results", "0"],
    ];
    for (const path of paths) {
      const at = (input: unknown) =>
        path.reduce(
          (node, key) => (node as Record<string, unknown>)[key],
          input,
        ) as Record<string, unknown>;
      for (const key of Object.keys(at(value))) {
        const missing = structuredClone(value);
        delete at(missing)[key];
        expect(parseManagedCatalogSearch(missing)).toBeNull();
      }
      const extra = structuredClone(value);
      at(extra).unexpected = true;
      expect(parseManagedCatalogSearch(extra)).toBeNull();
      const symbolic = structuredClone(value);
      Object.defineProperty(at(symbolic), Symbol("extra"), { value: true });
      expect(parseManagedCatalogSearch(symbolic)).toBeNull();
      const accessor = structuredClone(value);
      const key = Object.keys(at(accessor))[0]!;
      Object.defineProperty(at(accessor), key, {
        get() {
          throw new Error("must not invoke");
        },
        enumerable: true,
      });
      expect(parseManagedCatalogSearch(accessor)).toBeNull();
    }
  });

  it.each([
    null,
    [],
    false,
    "catalog",
    1,
    new Date(),
    Object.create({ snapshot: snapshot() }),
  ])("rejects a malformed outer object %#", (value) => {
    expect(parseManagedCatalogStatus(value)).toBeNull();
    expect(parseManagedCatalogSearch(value)).toBeNull();
  });

  it("rejects sparse and accessor arrays without invoking accessors", () => {
    const sparse = new Array(1);
    const accessor = [result()];
    Object.defineProperty(accessor, "0", {
      get() {
        throw new Error("must not invoke");
      },
      enumerable: true,
    });
    for (const results of [sparse, accessor]) {
      expect(parseManagedCatalogSearch({ ...search(), results })).toBeNull();
    }
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...snapshot(), sources: sparse },
      }),
    ).toBeNull();
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...snapshot(), excludedCandidates: sparse },
      }),
    ).toBeNull();
  });

  it("returns null if an unknown input throws during inspection", () => {
    const input = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("private input detail");
        },
      },
    );
    expect(parseManagedCatalogStatus(input)).toBeNull();
    expect(parseManagedCatalogSearch(input)).toBeNull();
    expect(parseManagedCatalogStatus({ snapshot: input })).toBeNull();
  });

  it.each([
    {
      phase: "identity",
      change: { profile: "unknown_profile" },
      laterField: "asOf",
    },
    {
      phase: "chronology",
      change: { generatedAt: "2026-09-28T00:00:00.000Z" },
      laterField: "attribution",
    },
    {
      phase: "coverage",
      change: { coverage: { ...coverage(), totalSecurities: 99 } },
      laterField: "contentKind",
    },
  ])(
    "stops after invalid $phase before inspecting later metadata",
    ({ change, laterField }) => {
      let laterReads = 0;
      const input = new Proxy(
        { ...snapshot(), ...change },
        {
          get(target, key, receiver): unknown {
            if (key === laterField) {
              laterReads += 1;
              throw new Error("Later metadata must remain uninspected");
            }
            return Reflect.get(target, key, receiver);
          },
        },
      );
      expect(parseManagedCatalogStatus({ snapshot: input })).toBeNull();
      expect(
        parseManagedCatalogSearch({ ...search(), snapshot: input }),
      ).toBeNull();
      expect(laterReads).toBe(0);
    },
  );

  it.each([
    ["schemaVersion", "2.0.0"],
    ["profile", "personal_single_user_local_security_master"],
    ["snapshotSha256", `sha256:${"A".repeat(64)}`],
    ["catalogId", "BAD"],
    ["catalogVersion", "ab"],
    ["contentKind", "owner_local_source"],
    ["attribution", ""],
    ["attribution", " hidden"],
    ["attribution", "bad\u200btext"],
    ["attribution", "😀".repeat(513)],
    ["sources", null],
    ["excludedCandidates", {}],
  ])("rejects malformed receipt %s %#", (key, value) => {
    expect(
      parseManagedCatalogStatus({ snapshot: { ...snapshot(), [key]: value } }),
    ).toBeNull();
  });

  it("accepts epoch zero and leap dates while enforcing acquisition/generation/as-of ordering", () => {
    const epoch = {
      ...snapshot(),
      acquiredAt: "1970-01-01T00:00:00.000Z",
      generatedAt: "1970-01-01T00:00:00.000Z",
      asOf: "1970-01-01T00:00:00.000Z",
      sources: [],
    };
    expect(parseManagedCatalogStatus({ snapshot: epoch })).not.toBeNull();
    for (const field of ["acquiredAt", "generatedAt", "asOf"]) {
      for (const bad of [
        "2026-02-30T00:00:00.000Z",
        "2026-09-30T00:00:00Z",
        "2026-09-30T00:00:00.000+00:00",
        null,
      ]) {
        expect(
          parseManagedCatalogStatus({
            snapshot: { ...snapshot(), [field]: bad },
          }),
        ).toBeNull();
      }
    }
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...snapshot(), acquiredAt: "2026-09-30T00:00:00.001Z" },
      }),
    ).toBeNull();
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...snapshot(), generatedAt: "2026-09-30T12:00:00.001Z" },
      }),
    ).toBeNull();
    const leap = {
      label: "Leap filing",
      url: "https://example.test/leap",
      issuerName: "Example",
      filingDate: "2024-02-29",
    };
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...snapshot(), sources: [leap] },
      }),
    ).not.toBeNull();
  });

  it.each([
    ["activeListings", -1],
    ["issuers", 1.5],
    ["providerMappings", Number.MAX_SAFE_INTEGER + 1],
    ["formerTickerEntries", Infinity],
    ["sourceRecords", 7],
    ["admittedSourceRecords", 4],
    ["inactiveSecurities", 1],
    ["issuers", 4],
    ["shareClasses", 2],
    ["basis", "reviewed_snapshot_only"],
    ["eligibleSecurityBand", "from_1000_to_2999"],
  ])("rejects inconsistent coverage %s %#", (key, value) => {
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...snapshot(), coverage: { ...coverage(), [key]: value } },
      }),
    ).toBeNull();
  });

  it("keeps excluded candidates separate from admitted-source partitions", () => {
    const value = {
      ...snapshot(),
      excludedCandidates: [
        { symbol: "OTHER", reason: "identity_not_resolved" },
        { symbol: "THIRD", reason: "source_review_incomplete" },
      ],
    };
    expect(parseManagedCatalogStatus({ snapshot: value })).not.toBeNull();
    for (const bad of [
      [{ symbol: "lower", reason: "identity_not_resolved" }],
      [{ symbol: "X".repeat(16), reason: "identity_not_resolved" }],
      [{ symbol: "DEMO", reason: "raw_provider_error" }],
      [value.excludedCandidates[0], value.excludedCandidates[0]],
      Array.from({ length: 65 }, (_, index) => ({
        symbol: `X${index}`,
        reason: "identity_not_resolved",
      })),
    ])
      expect(
        parseManagedCatalogStatus({
          snapshot: { ...snapshot(), excludedCandidates: bad },
        }),
      ).toBeNull();
  });

  it.each([
    {
      label: "",
      url: "https://example.test/",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "http://example.test/",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "https://name:secret@example.test/",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "https://EXAMPLE.test/",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "https://example.test/#fragment",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "https://example.test/?q=one",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "https://example.test/?",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "https://example.test/#",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: "https://example.test/é",
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Reference",
      url: `https://example.test/${"x".repeat(2048)}`,
      issuerName: null,
      filingDate: null,
    },
    {
      label: "Filing",
      url: "https://example.test/",
      issuerName: null,
      filingDate: "2026-01-01",
    },
    {
      label: "Filing",
      url: "https://example.test/",
      issuerName: "Example",
      filingDate: null,
    },
    {
      label: "Filing",
      url: "https://example.test/",
      issuerName: "Example",
      filingDate: "2026-02-29",
    },
    {
      label: "Filing",
      url: "https://example.test/",
      issuerName: "Example",
      filingDate: "2026-10-01",
    },
    {
      label: "Filing",
      url: "https://example.test/",
      issuerName: "😀".repeat(129),
      filingDate: "2026-01-01",
    },
  ])("rejects malformed or mismatched public source %#", (source) => {
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...snapshot(), sources: [source] },
      }),
    ).toBeNull();
  });

  it("rejects a ninth public source", () => {
    expect(
      parseManagedCatalogStatus({
        snapshot: {
          ...snapshot(),
          sources: Array.from({ length: 9 }, () => snapshot().sources[0]),
        },
      }),
    ).toBeNull();
  });

  it("accepts empty search and distinct same-symbol listings, without requiring a source per result", () => {
    expect(
      parseManagedCatalogSearch({ ...search(), results: [], totalMatches: 0 }),
    ).not.toBeNull();
    expect(
      parseManagedCatalogSearch({
        ...search(),
        results: [result(), result("listing-two")],
        totalMatches: 2,
      }),
    ).not.toBeNull();
  });

  it.each([
    { limitApplied: 20 },
    { totalMatches: -1 },
    { totalMatches: 4 },
    { totalMatches: 2 },
    { totalMatches: Number.MAX_SAFE_INTEGER + 1 },
    { normalizedQuery: "" },
    { normalizedQuery: "\u200b" },
    { normalizedQuery: "😀".repeat(513) },
    { results: [result(), result()], totalMatches: 2 },
    { results: null },
  ])("rejects malformed search envelope %#", (change) => {
    expect(parseManagedCatalogSearch({ ...search(), ...change })).toBeNull();
  });

  it.each([
    ["cik", "1"],
    ["country", "CA"],
    ["exchangeMic", "xnas"],
    ["instrumentType", "etf"],
    ["issuerId", "Issuer"],
    ["listingId", "x"],
    ["securityId", "x".repeat(129)],
    ["shareClassId", "class/id"],
    ["issuerName", ""],
    ["securityName", " padded"],
    ["shareClassName", "bad\u0000text"],
    ["matchedValue", "😀".repeat(129)],
    ["matchKind", "fuzzy"],
    ["symbol", "demo"],
  ])("rejects malformed result %s %#", (key, value) => {
    expect(
      parseManagedCatalogSearch({
        ...search(),
        results: [{ ...result(), [key]: value }],
      }),
    ).toBeNull();
  });

  it("accepts maximum field/array sizes and proves the catalog byte ceiling including escaping", () => {
    const astral = "😀".repeat(128);
    const id = "x".repeat(128);
    const partition = 1_000_000_000_000_000;
    const total = Number.MAX_SAFE_INTEGER - partition * 4;
    const active = Math.floor(total / 2);
    const maximumCoverage: ManagedCatalogCoverageDto = {
      ...coverage(),
      activeEligibleSecurities: active,
      inactiveSecurities: total - active,
      activeListings: Number.MAX_SAFE_INTEGER,
      admittedSourceRecords: total,
      totalSecurities: total,
      issuers: total,
      shareClasses: Number.MAX_SAFE_INTEGER,
      providerMappings: Number.MAX_SAFE_INTEGER,
      formerTickerEntries: Number.MAX_SAFE_INTEGER,
      sourceRecords: Number.MAX_SAFE_INTEGER,
      ineligibleSourceRecords: partition,
      quarantinedSourceRecords: partition,
      staleSourceRecords: partition,
      unsupportedSourceRecords: partition,
      eligibleSecurityBand: "at_least_3000",
    };
    const prefix = "https://example.test/";
    const sources = Array.from({ length: 8 }, (_, index) => ({
      label: astral,
      issuerName: astral,
      filingDate: "2026-09-30",
      url: prefix + "x".repeat(2048 - prefix.length - 1) + index,
    }));
    const excludedCandidates = Array.from({ length: 64 }, (_, index) => ({
      symbol: `X${index.toString().padStart(14, "0")}`,
      reason: "source_review_incomplete" as const,
    }));
    const maximum = {
      snapshot: {
        ...snapshot(),
        catalogId: id,
        catalogVersion: id,
        attribution: "😀".repeat(512),
        coverage: maximumCoverage,
        sources,
        excludedCandidates,
      },
      results: Array.from({ length: 25 }, (_, index) => ({
        ...result(),
        issuerId: id,
        listingId: `${id.slice(2)}${index.toString().padStart(2, "0")}`,
        securityId: id,
        shareClassId: id,
        issuerName: astral,
        securityName: astral,
        shareClassName: astral,
        matchedValue: astral,
        matchKind: "current_symbol_prefix" as const,
        symbol: "X".repeat(15),
      })),
      normalizedQuery: "😀".repeat(512),
      limitApplied: 25,
      totalMatches: Number.MAX_SAFE_INTEGER,
    };
    const parsed = parseManagedCatalogSearch(maximum);
    expect(parsed).toEqual(maximum);
    expect(
      parseManagedCatalogStatus({ snapshot: maximum.snapshot }),
    ).not.toBeNull();
    const bytes = new TextEncoder().encode(JSON.stringify(parsed)).byteLength;
    // Allowed display code points cost at most 4 JSON UTF-8 bytes. Canonical
    // ASCII source URLs are conservatively allowed 2 per character here.
    // These bounds include object keys, string quotes and array punctuation.
    const resultBound = 25 * 2846 + 26;
    const sourceBound = 8 * 5183 + 9;
    const exclusionBound = 64 * 64 + 65;
    const otherMetadataBound = 8192;
    const responseBound =
      resultBound + sourceBound + exclusionBound + otherMetadataBound;
    expect(responseBound).toBe(125_002);
    expect(bytes).toBeGreaterThan(95_000);
    expect(bytes).toBeLessThanOrEqual(responseBound);
    expect(responseBound).toBeLessThan(MANAGED_CATALOG_LIMITS.responseBytes);
    expect(MANAGED_CATALOG_LIMITS.responseBytes).toBe(128 * 1024);
    expect(
      parseManagedCatalogSearch({
        ...maximum,
        results: [...maximum.results, maximum.results[0]],
      }),
    ).toBeNull();
    expect(
      parseManagedCatalogStatus({
        snapshot: { ...maximum.snapshot, attribution: "😀".repeat(513) },
      }),
    ).toBeNull();
    const escaped = {
      ...maximum,
      normalizedQuery: '\\"'.repeat(256),
      snapshot: { ...maximum.snapshot, attribution: '\\"'.repeat(256) },
    };
    expect(parseManagedCatalogSearch(escaped)).toEqual(escaped);
    expect(
      new TextEncoder().encode(JSON.stringify(escaped)).byteLength,
    ).toBeLessThan(responseBound);
  });
});
