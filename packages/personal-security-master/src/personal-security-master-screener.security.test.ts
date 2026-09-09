import { describe, expect, it, vi } from "vitest";

import {
  PERSONAL_SECURITY_MASTER_SCREENER_SCHEMA_VERSION,
  PersonalSecurityMasterError,
  admitPersonalSecurityMasterSnapshot,
  screenPersonalSecurityMaster,
  type PersonalSecurityMasterCatalog,
  type PersonalSecurityMasterScreenInput,
} from "./personal-security-master";
import { buildSecurityMasterAdmission } from "./test-personal-security-master-builder";

describe("personal security master catalog screener boundary", () => {
  it("requires exactly one catalog and one closed request", () => {
    const catalog = buildCatalog();
    const input = request(catalog);
    expectFailure(() =>
      Reflect.apply(screenPersonalSecurityMaster, undefined, [catalog]),
    );
    expectFailure(() =>
      Reflect.apply(screenPersonalSecurityMaster, undefined, [
        catalog,
        input,
        input,
      ]),
    );
    expectFailure(() =>
      screenPersonalSecurityMaster(catalog, {
        ...input,
        ignored: true,
      } as PersonalSecurityMasterScreenInput),
    );
  });

  it("rejects accessors without invoking them", () => {
    const catalog = buildCatalog();
    const input = request(catalog);
    const topAccessor = vi.fn(() => {
      throw new Error("TOP_ACCESSOR_CANARY");
    });
    const top = {
      get page(): PersonalSecurityMasterScreenInput["page"] {
        return topAccessor();
      },
      query: input.query,
      schemaVersion: input.schemaVersion,
      snapshotSha256: input.snapshotSha256,
      sort: input.sort,
    };
    expectFailure(() => screenPersonalSecurityMaster(catalog, top));
    expect(topAccessor).not.toHaveBeenCalled();

    const clauseAccessor = vi.fn(() => {
      throw new Error("CLAUSE_ACCESSOR_CANARY");
    });
    const clause = {
      get field(): "cik" {
        return clauseAccessor();
      },
      operator: "equals" as const,
      value: "0000000001",
    };
    expectFailure(() =>
      screenPersonalSecurityMaster(catalog, {
        ...input,
        query: { clauses: [clause], operator: "and" },
      }),
    );
    expect(clauseAccessor).not.toHaveBeenCalled();
  });

  it("rejects proxy and non-plain request objects", () => {
    const catalog = buildCatalog();
    const input = request(catalog);
    const proxy = new Proxy(input, {
      getPrototypeOf() {
        throw new Error("PROXY_CANARY");
      },
    });
    expectFailure(() => screenPersonalSecurityMaster(catalog, proxy));

    class ScreenRequest {
      readonly page = input.page;
      readonly query = input.query;
      readonly schemaVersion = input.schemaVersion;
      readonly snapshotSha256 = input.snapshotSha256;
      readonly sort = input.sort;
    }
    expectFailure(() =>
      screenPersonalSecurityMaster(catalog, new ScreenRequest()),
    );
  });

  it("rejects sparse and exotic clause and IN-value arrays", () => {
    const catalog = buildCatalog();
    const input = request(catalog);
    const sparseClauses = new Array(1);
    expectFailure(() =>
      screenPersonalSecurityMaster(catalog, {
        ...input,
        query: {
          clauses: sparseClauses,
          operator: "and",
        },
      }),
    );

    const sparseValues = new Array(1);
    expectFailure(() =>
      screenPersonalSecurityMaster(catalog, {
        ...input,
        query: {
          clauses: [
            {
              field: "exchange_mic",
              operator: "in",
              values: sparseValues,
            },
          ],
          operator: "and",
        },
      }),
    );

    const exoticClauses = new (class extends Array<
      PersonalSecurityMasterScreenInput["query"]["clauses"][number]
    > {})();
    expectFailure(() =>
      screenPersonalSecurityMaster(catalog, {
        ...input,
        query: {
          clauses: exoticClauses,
          operator: "and",
        },
      }),
    );
  });

  it("snapshots caller arrays before evaluation and never mutates them", () => {
    const catalog = buildCatalog();
    const values = ["XNYS", "XNAS"];
    const clauses = [
      {
        field: "exchange_mic" as const,
        operator: "in" as const,
        values,
      },
    ];
    const input: PersonalSecurityMasterScreenInput = {
      ...request(catalog),
      query: { clauses, operator: "and" },
    };

    const response = screenPersonalSecurityMaster(catalog, input);

    expect(response.rows).toHaveLength(2);
    expect(values).toEqual(["XNYS", "XNAS"]);
    expect(clauses).toHaveLength(1);
  });
});

function buildCatalog(): PersonalSecurityMasterCatalog {
  return admitPersonalSecurityMasterSnapshot(buildSecurityMasterAdmission());
}

function request(
  catalog: PersonalSecurityMasterCatalog,
): PersonalSecurityMasterScreenInput {
  return {
    page: { limit: 25, offset: 0 },
    query: { clauses: [], operator: "and" },
    schemaVersion: PERSONAL_SECURITY_MASTER_SCREENER_SCHEMA_VERSION,
    snapshotSha256: catalog.snapshotSha256,
    sort: { direction: "asc", field: "symbol" },
  };
}

function expectFailure(operation: () => unknown): void {
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
