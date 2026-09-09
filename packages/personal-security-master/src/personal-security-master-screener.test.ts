import { describe, expect, it } from "vitest";

import {
  PERSONAL_SECURITY_MASTER_SCREENER_LIMITS,
  PERSONAL_SECURITY_MASTER_SCREENER_SCHEMA_VERSION,
  PERSONAL_SECURITY_MASTER_SCREENER_SORT_FIELDS,
  PersonalSecurityMasterError,
  admitPersonalSecurityMasterSnapshot,
  screenPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
  type PersonalSecurityMasterScreenClause,
  type PersonalSecurityMasterScreenInput,
  type PersonalSecurityMasterScreenSortField,
} from "./personal-security-master";
import { buildSecurityMasterAdmission } from "./test-personal-security-master-builder";

describe("personal security master catalog screener", () => {
  it("publishes its closed schema, limits, and sort vocabulary", () => {
    expect(PERSONAL_SECURITY_MASTER_SCREENER_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_SECURITY_MASTER_SCREENER_LIMITS).toEqual({
      clauses: 4,
      identityTextCodePoints: 128,
      inValues: 16,
      offset: 100_000,
      pageLimit: 100,
    });
    expect(PERSONAL_SECURITY_MASTER_SCREENER_SORT_FIELDS).toEqual([
      "symbol",
      "issuer_name",
      "exchange_mic",
      "instrument_type",
      "cik",
    ]);
  });

  it("screens the admitted active listing universe with AND semantics", () => {
    const catalog = catalogWith(8);
    const response = screenPersonalSecurityMaster(
      catalog,
      request(catalog, {
        clauses: [
          { field: "identity_text", operator: "matches", value: "synthetic" },
          { field: "exchange_mic", operator: "in", values: ["XNAS"] },
          {
            field: "instrument_type",
            operator: "in",
            values: ["common_stock"],
          },
        ],
      }),
    );

    expect(response).toMatchObject({
      hasMore: false,
      limitApplied: 100,
      offset: 0,
      schemaVersion: "1.0.0",
      snapshotSha256: catalog.snapshotSha256,
      totalMatches: 3,
      totalUniverse: 8,
    });
    expect(response.rows.map(({ symbol }) => symbol)).toEqual([
      "S00002",
      "S00004",
      "S00006",
    ]);
    expect(response.rows[0]).toEqual({
      cik: "0000000002",
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "iss-00001",
      issuerName: "Synthetic Issuer 00001",
      listingId: "lst-00002",
      securityId: "sec-00002",
      securityName: "Synthetic Security 00002",
      shareClassId: "shr-00002",
      shareClassName: "Synthetic Class 00002",
      symbol: "S00002",
    });
  });

  it("supports every closed identity filter independently", () => {
    const catalog = catalogWith(8);
    expect(
      screenPersonalSecurityMaster(
        catalog,
        request(catalog, {
          clauses: [
            {
              field: "identity_text",
              operator: "matches",
              value: "ZERO ALPHA",
            },
          ],
        }),
      ).rows.map(({ symbol }) => symbol),
    ).toEqual(["S00000", "S00001"]);
    expect(
      screenPersonalSecurityMaster(
        catalog,
        request(catalog, {
          clauses: [
            { field: "exchange_mic", operator: "in", values: ["XNYS"] },
          ],
        }),
      ).rows.map(({ symbol }) => symbol),
    ).toEqual(["S00001", "S00003", "S00005", "S00007"]);
    expect(
      screenPersonalSecurityMaster(
        catalog,
        request(catalog, {
          clauses: [
            { field: "instrument_type", operator: "in", values: ["adr"] },
          ],
        }),
      ).rows.map(({ symbol }) => symbol),
    ).toEqual(["S00000", "S00005"]);
    expect(
      screenPersonalSecurityMaster(
        catalog,
        request(catalog, {
          clauses: [{ field: "cik", operator: "equals", value: "0000000002" }],
        }),
      ).rows.map(({ symbol }) => symbol),
    ).toEqual(["S00002", "S00003"]);
  });

  it("normalizes identity text across ticker case and accented names", () => {
    const catalog = catalogWith(2);
    const punctuation = screenPersonalSecurityMaster(
      catalog,
      request(catalog, {
        clauses: [
          { field: "identity_text", operator: "matches", value: "s000" },
        ],
      }),
    );
    const accent = screenPersonalSecurityMaster(
      catalog,
      request(catalog, {
        clauses: [
          { field: "identity_text", operator: "matches", value: "zero" },
        ],
      }),
    );

    expect(punctuation.rows.map(({ symbol }) => symbol)).toEqual([
      "S00000",
      "S00001",
    ]);
    expect(accent.rows.map(({ symbol }) => symbol)).toEqual([
      "S00000",
      "S00001",
    ]);
  });

  it("applies deterministic primary direction with ascending stable ties", () => {
    const catalog = catalogWith(6);
    const expectedFirstByField: Readonly<
      Record<PersonalSecurityMasterScreenSortField, string>
    > = {
      cik: "S00004",
      exchange_mic: "S00001",
      instrument_type: "S00001",
      issuer_name: "S00000",
      symbol: "S00005",
    };

    for (const field of PERSONAL_SECURITY_MASTER_SCREENER_SORT_FIELDS) {
      const response = screenPersonalSecurityMaster(catalog, {
        ...request(catalog),
        sort: { direction: "desc", field },
      });
      expect(response.rows[0]?.symbol, field).toBe(expectedFirstByField[field]);
    }

    const sameIssuer = screenPersonalSecurityMaster(catalog, {
      ...request(catalog, {
        clauses: [{ field: "cik", operator: "equals", value: "0000000002" }],
      }),
      sort: { direction: "desc", field: "issuer_name" },
    });
    expect(sameIssuer.rows.map(({ symbol }) => symbol)).toEqual([
      "S00002",
      "S00003",
    ]);
  });

  it("paginates after filtering and reports a stable continuation state", () => {
    const catalog = catalogWith(6);
    const first = screenPersonalSecurityMaster(catalog, {
      ...request(catalog),
      page: { limit: 2, offset: 1 },
    });
    const final = screenPersonalSecurityMaster(catalog, {
      ...request(catalog),
      page: { limit: 100, offset: 6 },
    });

    expect(first.rows.map(({ symbol }) => symbol)).toEqual([
      "S00001",
      "S00002",
    ]);
    expect(first).toMatchObject({
      hasMore: true,
      limitApplied: 2,
      offset: 1,
      totalMatches: 6,
      totalUniverse: 6,
    });
    expect(final.rows).toEqual([]);
    expect(final.hasMore).toBe(false);
  });

  it("returns immutable defensive rows without modifying the catalog", () => {
    const catalog = catalogWith(2);
    const response = screenPersonalSecurityMaster(catalog, request(catalog));

    expect(Object.isFrozen(response)).toBe(true);
    expect(Object.isFrozen(response.rows)).toBe(true);
    expect(response.rows.every(Object.isFrozen)).toBe(true);
    expect(() =>
      (response.rows as unknown as unknown[]).push(response.rows[0]),
    ).toThrow();
    expect(
      screenPersonalSecurityMaster(catalog, request(catalog)).rows.map(
        ({ symbol }) => symbol,
      ),
    ).toEqual(["S00000", "S00001"]);
  });

  it("rejects a stale snapshot digest before returning rows", () => {
    const catalog = catalogWith(2);
    expectScreenFailure(() =>
      screenPersonalSecurityMaster(catalog, {
        ...request(catalog),
        snapshotSha256: `sha256:${"f".repeat(64)}`,
      }),
    );
  });

  it.each([
    [
      "duplicate clauses",
      [
        { field: "cik", operator: "equals", value: "0000000001" },
        { field: "cik", operator: "equals", value: "0000000002" },
      ],
    ],
    ["empty IN", [{ field: "exchange_mic", operator: "in", values: [] }]],
    [
      "duplicate IN",
      [{ field: "exchange_mic", operator: "in", values: ["XNAS", "XNAS"] }],
    ],
    ["invalid CIK", [{ field: "cik", operator: "equals", value: "1" }]],
    [
      "noncanonical text",
      [{ field: "identity_text", operator: "matches", value: " padded " }],
    ],
  ] as const)("rejects %s", (_label, clauses) => {
    const catalog = catalogWith(2);
    expectScreenFailure(() =>
      screenPersonalSecurityMaster(
        catalog,
        request(catalog, {
          clauses,
        }),
      ),
    );
  });

  it("rejects unknown keys, vocabularies, and pagination outside the bounds", () => {
    const catalog = catalogWith(2);
    const base = request(catalog);
    for (const invalid of [
      { ...base, ignored: true },
      { ...base, schemaVersion: "2.0.0" },
      { ...base, query: { clauses: [], operator: "or" } },
      { ...base, sort: { direction: "sideways", field: "symbol" } },
      { ...base, sort: { direction: "asc", field: "market_cap" } },
      { ...base, page: { limit: 0, offset: 0 } },
      { ...base, page: { limit: 101, offset: 0 } },
      { ...base, page: { limit: 1, offset: 100_001 } },
    ]) {
      expectScreenFailure(() =>
        screenPersonalSecurityMaster(
          catalog,
          invalid as PersonalSecurityMasterScreenInput,
        ),
      );
    }
  });
});

function catalogWith(recordCount: number): PersonalSecurityMasterCatalog {
  return admitPersonalSecurityMasterSnapshot(
    buildSecurityMasterAdmission(recordCount),
  );
}

function request(
  catalog: PersonalSecurityMasterCatalog,
  query: Readonly<{
    clauses: readonly PersonalSecurityMasterScreenClause[];
  }> = {
    clauses: [],
  },
): PersonalSecurityMasterScreenInput {
  return {
    page: { limit: 100, offset: 0 },
    query: { clauses: query.clauses, operator: "and" },
    schemaVersion: PERSONAL_SECURITY_MASTER_SCREENER_SCHEMA_VERSION,
    snapshotSha256: catalog.snapshotSha256,
    sort: { direction: "asc", field: "symbol" },
  };
}

function expectScreenFailure(operation: () => unknown): void {
  try {
    operation();
    throw new Error("expected screener failure");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalSecurityMasterError);
    expect((error as PersonalSecurityMasterError).code).toBe(
      "PERSONAL_SECURITY_MASTER_SCREEN_INVALID",
    );
  }
}
