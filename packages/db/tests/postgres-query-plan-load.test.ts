import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertPostgresQueryPlan,
  assertPostgresTenantThesisRows,
  inspectPostgresQueryPlanLoadFixture,
  POSTGRES_QUERY_PLAN_LOAD_ACTORS,
  POSTGRES_QUERY_PLAN_LOAD_FACT_QUERY,
  POSTGRES_QUERY_PLAN_LOAD_PLANNER_SETTINGS,
  POSTGRES_QUERY_PLAN_LOAD_PROFILE,
  PostgresQueryPlanLoadError,
  renderPostgresFinancialFactExplainQuery,
  renderPostgresQueryPlanLoadFixtureTransaction,
  renderPostgresTenantThesisExplainQuery,
  renderPostgresTenantThesisReadQuery,
  type PostgresQueryPlanAuthorization,
  type PostgresQueryPlanKind,
} from "../src/postgres-query-plan-load";
import { renderPostgresFinancialFactProjectionQuery } from "../src/postgres-projection-query";

const fixtureUrl = new URL(
  "../acceptance/query-plan-load-fixture.sql",
  import.meta.url,
);

describe("PostgreSQL B12 query-plan/load contract", () => {
  it("deep-freezes the exact isolated profile, actors, query, and planner settings", () => {
    expect(POSTGRES_QUERY_PLAN_LOAD_PROFILE).toEqual({
      databaseName: "research_cockpit_b12_query_load_test",
      listingCount: 2_048,
      factsPerListing: 8,
      factCount: 16_384,
      thesesPerListing: 2,
      thesisCount: 4_096,
      targetOrdinal: 1_024,
      targetInstrumentId: "listing-b12-001024",
      seedLoginRole: "research_cockpit_b12_seed_login",
      seedCapabilityRole: "research_cockpit_test_seed",
      seedApplicationName: "research-cockpit-b12-seed",
      runtimeLoginRole: "research_cockpit_b12_read_load_login",
      runtimeCapabilityRole: "research_cockpit_runtime",
      runtimeApplicationName: "research-cockpit-b12-query-load",
      adminApplicationName: "research-cockpit-b12-admin",
      poolMax: 8,
      loginConnectionLimit: 8,
      factRequestCount: 1_000,
      tenantRequestCount: 1_000,
      totalRequestCount: 2_000,
      connectionTimeoutMilliseconds: 30_000,
      statementTimeoutMilliseconds: 10_000,
      lockTimeoutMilliseconds: 5_000,
      overallTimeoutMilliseconds: 90_000,
    });
    expect(POSTGRES_QUERY_PLAN_LOAD_FACT_QUERY).toEqual({
      operation: "display_api",
      instrumentId: "listing-b12-001024",
      publicKnownAt: "2026-01-01T00:00:00.000Z",
      systemRecordedAt: "2026-01-01T00:00:00.000Z",
      expectedRows: 8,
    });
    expect(POSTGRES_QUERY_PLAN_LOAD_PLANNER_SETTINGS).toEqual([
      "SET LOCAL jit = off",
      "SET LOCAL max_parallel_workers_per_gather = 0",
      "SET LOCAL plan_cache_mode = 'force_custom_plan'",
    ]);
    expect(POSTGRES_QUERY_PLAN_LOAD_ACTORS.alpha).toEqual({
      principalId: "20000000-0000-4000-8000-000000000001",
      organizationId: "10000000-0000-4000-8000-000000000001",
      expectedThesisId: "b1200001-0000-4000-8000-000000001024",
    });
    expect(POSTGRES_QUERY_PLAN_LOAD_ACTORS.beta).toEqual({
      principalId: "20000000-0000-4000-8000-000000000002",
      organizationId: "10000000-0000-4000-8000-000000000002",
      expectedThesisId: "b1200002-0000-4000-8000-000000001024",
    });
    for (const value of [
      POSTGRES_QUERY_PLAN_LOAD_PROFILE,
      POSTGRES_QUERY_PLAN_LOAD_FACT_QUERY,
      POSTGRES_QUERY_PLAN_LOAD_PLANNER_SETTINGS,
      POSTGRES_QUERY_PLAN_LOAD_ACTORS,
      POSTGRES_QUERY_PLAN_LOAD_ACTORS.alpha,
      POSTGRES_QUERY_PLAN_LOAD_ACTORS.beta,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("renders only the exact tenant shape and executed JSON EXPLAIN wrappers", () => {
    const tenant = renderPostgresTenantThesisReadQuery();
    expect(tenant).toBe(`SELECT
  thesis.id::text AS thesis_id,
  thesis.organization_id::text AS organization_id,
  thesis.instrument_id::text AS instrument_id
FROM private_data.theses AS thesis
WHERE thesis.organization_id = private_data.current_organization_id()
  AND thesis.instrument_id = $1::text
ORDER BY thesis.updated_at DESC, thesis.id::text COLLATE "C"
LIMIT 1;`);
    expect(renderPostgresFinancialFactExplainQuery()).toBe(
      `EXPLAIN (ANALYZE, BUFFERS, COSTS, SETTINGS, SUMMARY, TIMING OFF, FORMAT JSON)\n${renderPostgresFinancialFactProjectionQuery(
        "display_api",
      )}`,
    );
    expect(renderPostgresTenantThesisExplainQuery()).toBe(
      `EXPLAIN (ANALYZE, BUFFERS, COSTS, SETTINGS, SUMMARY, TIMING OFF, FORMAT JSON)\n${tenant}`,
    );
    for (const sql of [
      renderPostgresFinancialFactExplainQuery(),
      renderPostgresTenantThesisExplainQuery(),
    ]) {
      expect(sql).not.toMatch(/enable_seqscan/i);
      expect(sql).not.toMatch(/CREATE\s+(?:TEMPORARY\s+)?INDEX/i);
    }
  });

  it.each([
    ["fact", "runtime_rls"],
    ["fact", "superuser_bypass"],
    ["tenant", "runtime_rls"],
    ["tenant", "superuser_bypass"],
  ] as const)(
    "accepts the executed named-index %s/%s plan and emits only a safe summary",
    (query, authorization) => {
      const summary = assertPostgresQueryPlan(
        query,
        authorization,
        executedPlan(query, authorization),
      );
      expect(summary).toEqual({
        query,
        authorization,
        rootActualRows: query === "fact" ? 8 : 1,
        requiredIndexName:
          query === "fact"
            ? "financial_facts_as_known"
            : "theses_by_instrument",
        requiredIndexExecuted: true,
        targetRelationSequentialScan: false,
        policyEvidence:
          authorization === "runtime_rls"
            ? "required_and_present"
            : "forbidden_and_absent",
        planningTimeMilliseconds: 0.25,
        executionTimeMilliseconds: 0.5,
        sharedHitBlocks: 3,
        sharedReadBlocks: 1,
      });
      expect(Object.isFrozen(summary)).toBe(true);
      expect(JSON.stringify(summary)).not.toContain("Filter");
      expect(JSON.stringify(summary)).not.toContain("current_setting");
    },
  );

  it("accepts only a target-bound executed bitmap index subtree", () => {
    const accepted = bitmapExecutedPlan();
    expect(
      assertPostgresQueryPlan("fact", "runtime_rls", accepted),
    ).toMatchObject({
      requiredIndexName: "financial_facts_as_known",
      requiredIndexExecuted: true,
    });

    for (const mutate of [
      (plan: PlanDocument) => {
        plan[0].Plan.Plans[0]["Relation Name"] = "listings";
      },
      (plan: PlanDocument) => {
        plan[0].Plan.Plans[0].Schema = "private_data";
      },
      (plan: PlanDocument) => {
        const bitmap = plan[0].Plan.Plans[0].Plans as [Record<string, unknown>];
        bitmap[0]["Index Name"] = "financial_facts_pkey";
      },
      (plan: PlanDocument) => {
        const bitmap = plan[0].Plan.Plans[0].Plans as [Record<string, unknown>];
        bitmap[0]["Actual Loops"] = 0;
      },
      (plan: PlanDocument) => {
        const bitmap = plan[0].Plan.Plans[0].Plans as [Record<string, unknown>];
        bitmap[0]["Actual Rows"] = 0;
      },
    ]) {
      const rejected = bitmapExecutedPlan();
      mutate(rejected);
      expectContractFailure(() =>
        assertPostgresQueryPlan("fact", "runtime_rls", rejected),
      );
    }
  });

  it.each([
    [
      "missing executed index",
      (plan: PlanDocument) => {
        plan[0].Plan.Plans[0]["Index Name"] = "financial_facts_pkey";
      },
    ],
    [
      "sequential target scan",
      (plan: PlanDocument) => {
        plan[0].Plan.Plans[0]["Node Type"] = "Seq Scan";
      },
    ],
    [
      "wrong root cardinality",
      (plan: PlanDocument) => {
        plan[0].Plan["Actual Rows"] = 7;
      },
    ],
    [
      "node timing despite TIMING OFF",
      (plan: PlanDocument) => {
        plan[0].Plan["Actual Total Time"] = 0.1;
      },
    ],
    [
      "disabled sequential scans",
      (plan: PlanDocument) => {
        plan[0].Settings.enable_seqscan = "off";
      },
    ],
  ] as const)("rejects a fact plan with %s", (_label, mutate) => {
    const plan = executedPlan("fact", "runtime_rls");
    mutate(plan);
    expectContractFailure(() =>
      assertPostgresQueryPlan("fact", "runtime_rls", plan),
    );
  });

  it("requires policy evidence on runtime paths and forbids it on bypass paths", () => {
    const missingRuntime = executedPlan("tenant", "runtime_rls");
    delete missingRuntime[0].Plan.Plans[0].Filter;
    expectContractFailure(() =>
      assertPostgresQueryPlan("tenant", "runtime_rls", missingRuntime),
    );

    const contaminatedBypass = executedPlan("tenant", "superuser_bypass");
    contaminatedBypass[0].Plan.Plans[0].Filter =
      "private_data.has_active_membership(organization_id, roles)";
    expectContractFailure(() =>
      assertPostgresQueryPlan("tenant", "superuser_bypass", contaminatedBypass),
    );
  });

  it("rejects malformed or accessor-bearing plans with one value-free error", () => {
    let accessed = false;
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, "Plan", {
      enumerable: true,
      get: () => {
        accessed = true;
        return {};
      },
    });

    for (const value of [null, [], [{}], [accessor], new Date()]) {
      expectContractFailure(() =>
        assertPostgresQueryPlan("fact", "runtime_rls", value),
      );
    }
    expect(accessed).toBe(false);
  });

  it("accepts only the exact Alpha or Beta target thesis row", () => {
    for (const actor of ["alpha", "beta"] as const) {
      const expected = POSTGRES_QUERY_PLAN_LOAD_ACTORS[actor];
      expect(() =>
        assertPostgresTenantThesisRows(actor, [
          {
            thesis_id: expected.expectedThesisId,
            organization_id: expected.organizationId,
            instrument_id: POSTGRES_QUERY_PLAN_LOAD_PROFILE.targetInstrumentId,
          },
        ]),
      ).not.toThrow();
    }

    expectContractFailure(() =>
      assertPostgresTenantThesisRows("alpha", [
        {
          thesis_id: POSTGRES_QUERY_PLAN_LOAD_ACTORS.beta.expectedThesisId,
          organization_id: POSTGRES_QUERY_PLAN_LOAD_ACTORS.beta.organizationId,
          instrument_id: POSTGRES_QUERY_PLAN_LOAD_PROFILE.targetInstrumentId,
        },
      ]),
    );
    expectContractFailure(() => assertPostgresTenantThesisRows("alpha", []));
  });

  it("does not invoke tenant-row accessors", () => {
    let accessed = false;
    const row = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(row, "thesis_id", {
      enumerable: true,
      get: () => {
        accessed = true;
        return POSTGRES_QUERY_PLAN_LOAD_ACTORS.alpha.expectedThesisId;
      },
    });
    Object.defineProperty(row, "organization_id", {
      enumerable: true,
      value: POSTGRES_QUERY_PLAN_LOAD_ACTORS.alpha.organizationId,
    });
    Object.defineProperty(row, "instrument_id", {
      enumerable: true,
      value: POSTGRES_QUERY_PLAN_LOAD_PROFILE.targetInstrumentId,
    });
    expectContractFailure(() => assertPostgresTenantThesisRows("alpha", [row]));
    expect(accessed).toBe(false);
  });

  it("accepts only the exact six INSERT SELECT fixture and returns a frozen summary", async () => {
    const fixture = await readFile(fixtureUrl, "utf8");
    const inspection = inspectPostgresQueryPlanLoadFixture(fixture);
    expect(inspection).toEqual({
      insertCount: 6,
      tables: [
        "shared_data.securities",
        "shared_data.share_classes",
        "shared_data.listings",
        "shared_data.financial_facts",
        "private_data.resource_id_registry",
        "private_data.theses",
      ],
      listingCount: 2_048,
      factCount: 16_384,
      thesisCount: 4_096,
    });
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.tables)).toBe(true);
    expect(fixture.match(/^INSERT INTO /gm)).toHaveLength(6);
    expect(fixture.match(/generate_series\(1, 2048\)/g)).toHaveLength(6);
    expect(fixture.match(/generate_series\(1, 8\)/g)).toHaveLength(1);
    expect(fixture).toContain("'issuer-syn1'");
    expect(fixture).toContain("'exchange-synx'");
    expect(fixture).toContain("'evidence-full-v1'");
    expect(fixture).toContain("'synthetic.full'");
  });

  it("renders the reviewed fixture body under one authenticated seed transaction", async () => {
    const fixture = await readFile(fixtureUrl, "utf8");
    const rendered = renderPostgresQueryPlanLoadFixtureTransaction(fixture);
    expect(rendered).toMatch(
      /^BEGIN;\nSET LOCAL ROLE research_cockpit_test_seed;\nINSERT INTO shared_data\.securities/,
    );
    expect(rendered).toMatch(
      /INSERT INTO private_data\.theses[\s\S]+\nCOMMIT;$/,
    );
    expect(rendered.match(/^INSERT INTO /gm)).toHaveLength(6);
    expect(rendered.match(/SET LOCAL ROLE/g)).toHaveLength(1);
    expect(rendered).not.toContain("SET SESSION AUTHORIZATION");
    expect(rendered).not.toContain("RESET SESSION AUTHORIZATION");
    expect(rendered).not.toMatch(/\bANALYZE\b/);
  });

  it("rejects every fixture mutation with the same value-free error", async () => {
    const fixture = await readFile(fixtureUrl, "utf8");
    const mutations = [
      fixture.replace("generate_series(1, 2048)", "generate_series(1, 2047)"),
      fixture.replace("'issuer-syn1'", "'issuer-other'"),
      fixture.replace(
        "INSERT INTO shared_data.share_classes",
        "INSERT INTO shared_data.listings",
      ),
      fixture.replace(
        "COMMIT;",
        "UPDATE private_data.theses SET version = 2;\nCOMMIT;",
      ),
      fixture.replace(
        "20000000-0000-4000-8000-000000000001",
        "20000000-0000-4000-8000-000000000009",
      ),
      `${fixture}\n`,
      fixture.replace("\nBEGIN;", "\rBEGIN;"),
    ];
    for (const mutation of mutations) {
      expectContractFailure(() =>
        inspectPostgresQueryPlanLoadFixture(mutation),
      );
      expectContractFailure(() =>
        renderPostgresQueryPlanLoadFixtureTransaction(mutation),
      );
    }
  });

  it("accepts a CRLF checkout while retaining the canonical transaction", async () => {
    const fixture = await readFile(fixtureUrl, "utf8");
    const crlf = fixture.replaceAll("\n", "\r\n");
    expect(inspectPostgresQueryPlanLoadFixture(crlf).insertCount).toBe(6);
    expect(renderPostgresQueryPlanLoadFixtureTransaction(crlf)).not.toContain(
      "\r",
    );
  });
});

interface PlanNode extends Record<string, unknown> {
  Plans: [Record<string, unknown>];
}

type PlanDocument = [
  {
    Plan: PlanNode;
    Settings: Record<string, string>;
    "Planning Time": number;
    "Execution Time": number;
  },
];

function executedPlan(
  query: PostgresQueryPlanKind,
  authorization: PostgresQueryPlanAuthorization,
): PlanDocument {
  const fact = query === "fact";
  const runtime = authorization === "runtime_rls";
  const child: Record<string, unknown> = {
    "Node Type": "Index Scan",
    Schema: fact ? "shared_data" : "private_data",
    "Relation Name": fact ? "financial_facts" : "theses",
    "Index Name": fact ? "financial_facts_as_known" : "theses_by_instrument",
    "Startup Cost": 0,
    "Total Cost": 1,
    "Plan Rows": fact ? 8 : 1,
    "Plan Width": 32,
    "Actual Rows": fact ? 8 : 1,
    "Actual Loops": 1,
    "Shared Hit Blocks": 2,
    "Shared Read Blocks": 1,
  };
  if (runtime) {
    child.Filter = fact
      ? "shared_data.rights_allow_current_use(rights_policy_id, rights_policy_version)"
      : "private_data.has_active_membership(organization_id, roles)";
  }
  return [
    {
      Plan: {
        "Node Type": fact ? "Sort" : "Limit",
        "Startup Cost": 0,
        "Total Cost": 2,
        "Plan Rows": fact ? 8 : 1,
        "Plan Width": 32,
        "Actual Rows": fact ? 8 : 1,
        "Actual Loops": 1,
        "Shared Hit Blocks": 3,
        "Shared Read Blocks": 1,
        Plans: [child],
      },
      Settings: {
        jit: "off",
        max_parallel_workers_per_gather: "0",
        plan_cache_mode: "force_custom_plan",
      },
      "Planning Time": 0.25,
      "Execution Time": 0.5,
    },
  ];
}

function bitmapExecutedPlan(): PlanDocument {
  const plan = executedPlan("fact", "runtime_rls");
  plan[0].Plan.Plans[0] = {
    "Node Type": "Bitmap Heap Scan",
    Schema: "shared_data",
    "Relation Name": "financial_facts",
    "Startup Cost": 0,
    "Total Cost": 1,
    "Plan Rows": 8,
    "Plan Width": 32,
    "Actual Rows": 8,
    "Actual Loops": 1,
    "Shared Hit Blocks": 2,
    "Shared Read Blocks": 1,
    Filter:
      "shared_data.rights_allow_current_use(rights_policy_id, rights_policy_version)",
    Plans: [
      {
        "Node Type": "Bitmap Index Scan",
        "Index Name": "financial_facts_as_known",
        "Startup Cost": 0,
        "Total Cost": 1,
        "Plan Rows": 8,
        "Plan Width": 0,
        "Actual Rows": 8,
        "Actual Loops": 1,
        "Shared Hit Blocks": 0,
        "Shared Read Blocks": 0,
      },
    ],
  };
  return plan;
}

function expectContractFailure(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(PostgresQueryPlanLoadError);
    expect(error).toMatchObject({
      name: "PostgresQueryPlanLoadError",
      code: "POSTGRES_QUERY_PLAN_LOAD_FAILURE",
      message: "PostgreSQL query-plan/load contract failed.",
    });
    return;
  }
  throw new Error("Expected PostgreSQL query-plan/load contract failure");
}
