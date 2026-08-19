import { createHash } from "node:crypto";

import { renderPostgresFinancialFactProjectionQuery } from "./postgres-projection-query";

const QUERY_PLAN_LOAD_DATABASE_NAME =
  "research_cockpit_b12_query_load_test" as const;
const QUERY_PLAN_LOAD_TARGET_ORDINAL = 1_024;
const QUERY_PLAN_LOAD_TARGET_INSTRUMENT_ID = "listing-b12-001024" as const;
const QUERY_PLAN_LOAD_TARGET_ALPHA_THESIS_ID =
  "b1200001-0000-4000-8000-000000001024" as const;
const QUERY_PLAN_LOAD_TARGET_BETA_THESIS_ID =
  "b1200002-0000-4000-8000-000000001024" as const;
const QUERY_PLAN_LOAD_FIXTURE_PREFIX =
  "SET SESSION AUTHORIZATION research_cockpit_test_seed;\n\nBEGIN;\n\n";
const QUERY_PLAN_LOAD_FIXTURE_SUFFIX =
  "\n\nCOMMIT;\n\nRESET SESSION AUTHORIZATION;\n";
const QUERY_PLAN_LOAD_FIXTURE_SHA256 =
  "e344c31adeb4cef3d7de2fad65bd4837a0c51c57f3b359a634eb42da9d0642ad";
const QUERY_PLAN_LOAD_FIXTURE_TABLES = Object.freeze([
  "shared_data.securities",
  "shared_data.share_classes",
  "shared_data.listings",
  "shared_data.financial_facts",
  "private_data.resource_id_registry",
  "private_data.theses",
] as const);
const EXPLAIN_PREFIX =
  "EXPLAIN (ANALYZE, BUFFERS, COSTS, SETTINGS, SUMMARY, TIMING OFF, FORMAT JSON)";
const TENANT_THESIS_READ_QUERY = `SELECT
  thesis.id::text AS thesis_id,
  thesis.organization_id::text AS organization_id,
  thesis.instrument_id::text AS instrument_id
FROM private_data.theses AS thesis
WHERE thesis.organization_id = private_data.current_organization_id()
  AND thesis.instrument_id = $1::text
ORDER BY thesis.updated_at DESC, thesis.id::text COLLATE "C"
LIMIT 1;`;
const PLAN_EXPRESSION_KEYS = Object.freeze([
  "Filter",
  "Index Cond",
  "Recheck Cond",
  "Join Filter",
  "Hash Cond",
  "Merge Cond",
  "One-Time Filter",
] as const);
const PLAN_CHILD_KEYS = Object.freeze([
  "Plans",
  "InitPlan",
  "Subplans",
] as const);
const MAX_PLAN_DEPTH = 128;
const MAX_PLAN_NODES = 10_000;
const MAX_PLAN_STRING_LENGTH = 32_768;

export const POSTGRES_QUERY_PLAN_LOAD_PROFILE = Object.freeze({
  databaseName: QUERY_PLAN_LOAD_DATABASE_NAME,
  listingCount: 2_048,
  factsPerListing: 8,
  factCount: 16_384,
  thesesPerListing: 2,
  thesisCount: 4_096,
  targetOrdinal: QUERY_PLAN_LOAD_TARGET_ORDINAL,
  targetInstrumentId: QUERY_PLAN_LOAD_TARGET_INSTRUMENT_ID,
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
} as const);

export const POSTGRES_QUERY_PLAN_LOAD_ACTORS = Object.freeze({
  alpha: Object.freeze({
    principalId: "20000000-0000-4000-8000-000000000001",
    organizationId: "10000000-0000-4000-8000-000000000001",
    expectedThesisId: QUERY_PLAN_LOAD_TARGET_ALPHA_THESIS_ID,
  }),
  beta: Object.freeze({
    principalId: "20000000-0000-4000-8000-000000000002",
    organizationId: "10000000-0000-4000-8000-000000000002",
    expectedThesisId: QUERY_PLAN_LOAD_TARGET_BETA_THESIS_ID,
  }),
} as const);

export const POSTGRES_QUERY_PLAN_LOAD_FACT_QUERY = Object.freeze({
  operation: "display_api",
  instrumentId: QUERY_PLAN_LOAD_TARGET_INSTRUMENT_ID,
  publicKnownAt: "2026-01-01T00:00:00.000Z",
  systemRecordedAt: "2026-01-01T00:00:00.000Z",
  expectedRows: 8,
} as const);

export const POSTGRES_QUERY_PLAN_LOAD_PLANNER_SETTINGS = Object.freeze([
  "SET LOCAL jit = off",
  "SET LOCAL max_parallel_workers_per_gather = 0",
  "SET LOCAL plan_cache_mode = 'force_custom_plan'",
] as const);

export type PostgresQueryPlanKind = "fact" | "tenant";
export type PostgresQueryPlanAuthorization = "runtime_rls" | "superuser_bypass";
export type PostgresQueryPlanLoadActor =
  keyof typeof POSTGRES_QUERY_PLAN_LOAD_ACTORS;

export interface PostgresQueryPlanSummary {
  readonly query: PostgresQueryPlanKind;
  readonly authorization: PostgresQueryPlanAuthorization;
  readonly rootActualRows: number;
  readonly requiredIndexName:
    "financial_facts_as_known" | "theses_by_instrument";
  readonly requiredIndexExecuted: true;
  readonly targetRelationSequentialScan: false;
  readonly policyEvidence: "required_and_present" | "forbidden_and_absent";
  readonly planningTimeMilliseconds: number;
  readonly executionTimeMilliseconds: number;
  readonly sharedHitBlocks: number;
  readonly sharedReadBlocks: number;
}

export interface PostgresQueryPlanLoadFixtureInspection {
  readonly insertCount: 6;
  readonly tables: typeof QUERY_PLAN_LOAD_FIXTURE_TABLES;
  readonly listingCount: 2_048;
  readonly factCount: 16_384;
  readonly thesisCount: 4_096;
}

/** One stable, value-free error for every rejected B12 contract boundary. */
export class PostgresQueryPlanLoadError extends Error {
  public readonly code = "POSTGRES_QUERY_PLAN_LOAD_FAILURE" as const;

  public constructor() {
    super("PostgreSQL query-plan/load contract failed.");
    this.name = "PostgresQueryPlanLoadError";
  }
}

/** The only tenant query admitted by B12: runtime context plus one instrument. */
export function renderPostgresTenantThesisReadQuery(): string {
  return TENANT_THESIS_READ_QUERY;
}

/** Wraps the exact B4 display query in the exact executed-plan contract. */
export function renderPostgresFinancialFactExplainQuery(): string {
  return `${EXPLAIN_PREFIX}\n${renderPostgresFinancialFactProjectionQuery(
    POSTGRES_QUERY_PLAN_LOAD_FACT_QUERY.operation,
  )}`;
}

/** Wraps the exact tenant query in the exact executed-plan contract. */
export function renderPostgresTenantThesisExplainQuery(): string {
  return `${EXPLAIN_PREFIX}\n${TENANT_THESIS_READ_QUERY}`;
}

/**
 * Validates one executed FORMAT JSON plan without returning expressions, row
 * values, SQL, or other plan content that could cross the evidence boundary.
 */
export function assertPostgresQueryPlan(
  query: PostgresQueryPlanKind,
  authorization: PostgresQueryPlanAuthorization,
  value: unknown,
): Readonly<PostgresQueryPlanSummary> {
  try {
    if (!isQueryKind(query) || !isAuthorization(authorization)) invalid();
    const planDocument = exactJsonSnapshot(value);
    if (!Array.isArray(planDocument) || planDocument.length !== 1) invalid();

    const statement = planDocument[0];
    if (!isPlainRecord(statement)) invalid();
    const root = ownRecord(statement, "Plan");
    const expected = expectedPlan(query);

    const planningTimeMilliseconds = ownFiniteNumber(
      statement,
      "Planning Time",
    );
    const executionTimeMilliseconds = ownFiniteNumber(
      statement,
      "Execution Time",
    );
    if (
      ownFiniteNumber(root, "Actual Rows") !== expected.rootRows ||
      ownFiniteNumber(root, "Actual Loops") !== 1 ||
      !hasOwnFiniteNumber(root, "Startup Cost") ||
      !hasOwnFiniteNumber(root, "Total Cost") ||
      !hasOwnFiniteNumber(root, "Plan Rows") ||
      !hasOwnFiniteNumber(root, "Plan Width")
    ) {
      invalid();
    }
    assertPlannerSettings(statement);
    const sharedHitBlocks = optionalBufferBlocks(root, "Shared Hit Blocks");
    const sharedReadBlocks = optionalBufferBlocks(root, "Shared Read Blocks");

    const state: PlanInspectionState = {
      nodes: 0,
      requiredIndexExecuted: false,
      targetRelationSequentialScan: false,
      policyEvidence: false,
    };
    inspectPlanNode(root, expected, state, 0, false);
    if (
      !state.requiredIndexExecuted ||
      state.targetRelationSequentialScan ||
      (authorization === "runtime_rls" && !state.policyEvidence) ||
      (authorization === "superuser_bypass" && state.policyEvidence)
    ) {
      invalid();
    }

    return Object.freeze({
      query,
      authorization,
      rootActualRows: expected.rootRows,
      requiredIndexName: expected.indexName,
      requiredIndexExecuted: true,
      targetRelationSequentialScan: false,
      policyEvidence:
        authorization === "runtime_rls"
          ? "required_and_present"
          : "forbidden_and_absent",
      planningTimeMilliseconds,
      executionTimeMilliseconds,
      sharedHitBlocks,
      sharedReadBlocks,
    });
  } catch (error) {
    if (error instanceof PostgresQueryPlanLoadError) throw error;
    invalid();
  }
}

/** Requires the one exact tenant row for the selected Alpha or Beta actor. */
export function assertPostgresTenantThesisRows(
  actor: PostgresQueryPlanLoadActor,
  rows: unknown,
): void {
  try {
    if (actor !== "alpha" && actor !== "beta") invalid();
    const snapshot = exactJsonSnapshot(rows);
    if (!Array.isArray(snapshot) || snapshot.length !== 1) invalid();
    const row = snapshot[0];
    if (
      !isPlainRecord(row) ||
      !sameKeys(row, ["thesis_id", "organization_id", "instrument_id"])
    ) {
      invalid();
    }
    const expected = POSTGRES_QUERY_PLAN_LOAD_ACTORS[actor];
    if (
      ownString(row, "thesis_id") !== expected.expectedThesisId ||
      ownString(row, "organization_id") !== expected.organizationId ||
      ownString(row, "instrument_id") !==
        POSTGRES_QUERY_PLAN_LOAD_PROFILE.targetInstrumentId
    ) {
      invalid();
    }
  } catch (error) {
    if (error instanceof PostgresQueryPlanLoadError) throw error;
    invalid();
  }
}

/** Inspects the fixed six-statement fixture without returning its SQL body. */
export function inspectPostgresQueryPlanLoadFixture(
  fixtureSql: string,
): Readonly<PostgresQueryPlanLoadFixtureInspection> {
  reviewedFixtureBody(fixtureSql);
  return Object.freeze({
    insertCount: 6,
    tables: QUERY_PLAN_LOAD_FIXTURE_TABLES,
    listingCount: 2_048,
    factCount: 16_384,
    thesisCount: 4_096,
  });
}

/** Renders the reviewed body for an authenticated seed-capability session. */
export function renderPostgresQueryPlanLoadFixtureTransaction(
  fixtureSql: string,
): string {
  const body = reviewedFixtureBody(fixtureSql);
  return `BEGIN;
SET LOCAL ROLE research_cockpit_test_seed;
${body}
COMMIT;`;
}

interface ExpectedPlan {
  readonly rootRows: 8 | 1;
  readonly relationName: "financial_facts" | "theses";
  readonly schemaName: "shared_data" | "private_data";
  readonly indexName: "financial_facts_as_known" | "theses_by_instrument";
  readonly policyMarker: "rights_allow_current_use" | "has_active_membership";
}

interface PlanInspectionState {
  nodes: number;
  requiredIndexExecuted: boolean;
  targetRelationSequentialScan: boolean;
  policyEvidence: boolean;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function expectedPlan(query: PostgresQueryPlanKind): ExpectedPlan {
  return query === "fact"
    ? {
        rootRows: 8,
        relationName: "financial_facts",
        schemaName: "shared_data",
        indexName: "financial_facts_as_known",
        policyMarker: "rights_allow_current_use",
      }
    : {
        rootRows: 1,
        relationName: "theses",
        schemaName: "private_data",
        indexName: "theses_by_instrument",
        policyMarker: "has_active_membership",
      };
}

function inspectPlanNode(
  node: Record<string, JsonValue>,
  expected: ExpectedPlan,
  state: PlanInspectionState,
  depth: number,
  targetBitmapSubtree: boolean,
): void {
  state.nodes += 1;
  if (depth > MAX_PLAN_DEPTH || state.nodes > MAX_PLAN_NODES) invalid();

  const nodeType = optionalString(node, "Node Type");
  const relationName = optionalString(node, "Relation Name");
  const schemaName = optionalString(node, "Schema");
  const indexName = optionalString(node, "Index Name");
  const actualLoops = optionalFiniteNumber(node, "Actual Loops");
  const actualRows = optionalFiniteNumber(node, "Actual Rows");
  const targetRelation =
    relationName === expected.relationName &&
    (schemaName === undefined || schemaName === expected.schemaName);
  const executed =
    actualLoops !== undefined &&
    actualLoops > 0 &&
    actualRows !== undefined &&
    actualRows > 0;
  if (
    targetRelation &&
    nodeType !== undefined &&
    nodeType.endsWith("Seq Scan")
  ) {
    state.targetRelationSequentialScan = true;
  }
  if (
    indexName === expected.indexName &&
    executed &&
    (targetRelation ||
      (targetBitmapSubtree &&
        nodeType === "Bitmap Index Scan" &&
        relationName === undefined &&
        (schemaName === undefined || schemaName === expected.schemaName)))
  ) {
    state.requiredIndexExecuted = true;
  }
  if (
    Object.hasOwn(node, "Actual Startup Time") ||
    Object.hasOwn(node, "Actual Total Time")
  ) {
    invalid();
  }

  for (const key of PLAN_EXPRESSION_KEYS) {
    const expression = optionalString(node, key);
    if (expression?.includes(expected.policyMarker) === true) {
      state.policyEvidence = true;
    }
  }
  for (const key of PLAN_CHILD_KEYS) {
    const children = optionalValue(node, key);
    if (children === undefined) continue;
    if (!Array.isArray(children)) invalid();
    const childTargetBitmapSubtree =
      key === "Plans" &&
      ((nodeType === "Bitmap Heap Scan" && targetRelation && executed) ||
        (targetBitmapSubtree &&
          relationName === undefined &&
          (nodeType === "BitmapAnd" || nodeType === "BitmapOr")));
    for (const child of children) {
      if (!isPlainRecord(child)) invalid();
      inspectPlanNode(
        child,
        expected,
        state,
        depth + 1,
        childTargetBitmapSubtree,
      );
    }
  }
}

function assertPlannerSettings(statement: Record<string, JsonValue>): void {
  const settings = ownRecord(statement, "Settings");
  if (
    !sameUnorderedKeys(settings, [
      "jit",
      "max_parallel_workers_per_gather",
      "plan_cache_mode",
    ]) ||
    ownString(settings, "jit") !== "off" ||
    ownString(settings, "max_parallel_workers_per_gather") !== "0" ||
    ownString(settings, "plan_cache_mode") !== "force_custom_plan"
  ) {
    invalid();
  }
}

function reviewedFixtureBody(fixtureSql: string): string {
  try {
    if (typeof fixtureSql !== "string") invalid();
    const normalized = fixtureSql.replaceAll("\r\n", "\n");
    if (
      normalized.includes("\r") ||
      createHash("sha256").update(normalized, "utf8").digest("hex") !==
        QUERY_PLAN_LOAD_FIXTURE_SHA256 ||
      !normalized.startsWith(QUERY_PLAN_LOAD_FIXTURE_PREFIX) ||
      !normalized.endsWith(QUERY_PLAN_LOAD_FIXTURE_SUFFIX)
    ) {
      invalid();
    }
    const body = normalized.slice(
      QUERY_PLAN_LOAD_FIXTURE_PREFIX.length,
      normalized.length - QUERY_PLAN_LOAD_FIXTURE_SUFFIX.length,
    );
    assertReviewedFixtureBody(body);
    return body;
  } catch (error) {
    if (error instanceof PostgresQueryPlanLoadError) throw error;
    invalid();
  }
}

function assertReviewedFixtureBody(body: string): void {
  if (body.length === 0 || body.includes("\\")) invalid();
  const visible = maskSqlQuotedContent(body);
  const statements = visible
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter((statement) => statement.length > 0);
  if (statements.length !== QUERY_PLAN_LOAD_FIXTURE_TABLES.length) invalid();

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    const expectedTable = QUERY_PLAN_LOAD_FIXTURE_TABLES[index];
    if (
      statement === undefined ||
      expectedTable === undefined ||
      !statement.startsWith(`INSERT INTO ${expectedTable} (`) ||
      !/\) SELECT\b/.test(statement) ||
      /\b(?:UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|COPY|RETURNING|ON\s+CONFLICT)\b/i.test(
        statement,
      )
    ) {
      invalid();
    }
  }

  const normalizedVisible = visible.replace(/\s+/g, " ");
  if (
    countMatches(normalizedVisible, /generate_series\(1, 2048\)/g) !== 6 ||
    countMatches(normalizedVisible, /generate_series\(1, 8\)/g) !== 1 ||
    countMatches(normalizedVisible, /INSERT INTO /g) !== 6 ||
    countMatches(normalizedVisible, /CROSS JOIN \(VALUES /g) !== 2 ||
    !body.includes("'issuer-syn1'") ||
    !body.includes("'exchange-synx'") ||
    !body.includes("'evidence-full-v1'") ||
    !body.includes("'synthetic.full'") ||
    !body.includes(POSTGRES_QUERY_PLAN_LOAD_ACTORS.alpha.organizationId) ||
    !body.includes(POSTGRES_QUERY_PLAN_LOAD_ACTORS.beta.organizationId) ||
    !body.includes(POSTGRES_QUERY_PLAN_LOAD_ACTORS.alpha.principalId) ||
    !body.includes(POSTGRES_QUERY_PLAN_LOAD_ACTORS.beta.principalId)
  ) {
    invalid();
  }
}

function maskSqlQuotedContent(sql: string): string {
  let output = "";
  let inQuote = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (character === "'") {
      if (inQuote && sql[index + 1] === "'") {
        output += "  ";
        index += 1;
        continue;
      }
      inQuote = !inQuote;
      output += " ";
      continue;
    }
    output += inQuote ? " " : character;
  }
  if (inQuote) invalid();
  return output;
}

function exactJsonSnapshot(value: unknown): JsonValue {
  let nodes = 0;
  const copy = (candidate: unknown, depth: number): JsonValue => {
    nodes += 1;
    if (depth > MAX_PLAN_DEPTH || nodes > MAX_PLAN_NODES) invalid();
    if (
      candidate === null ||
      typeof candidate === "boolean" ||
      typeof candidate === "string"
    ) {
      if (
        typeof candidate === "string" &&
        candidate.length > MAX_PLAN_STRING_LENGTH
      ) {
        invalid();
      }
      return candidate;
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) invalid();
      return candidate;
    }
    if (Array.isArray(candidate)) {
      if (Object.getPrototypeOf(candidate) !== Array.prototype) invalid();
      const keys = Reflect.ownKeys(candidate);
      if (
        keys.some((key) => typeof key !== "string") ||
        keys.length !== candidate.length + 1
      ) {
        invalid();
      }
      const output: JsonValue[] = [];
      for (let index = 0; index < candidate.length; index += 1) {
        output.push(copy(ownDataValue(candidate, String(index)), depth + 1));
      }
      return output;
    }
    if (!isPlainUnknownRecord(candidate)) invalid();
    const output: Record<string, JsonValue> = {};
    const keys = Reflect.ownKeys(candidate);
    if (keys.some((key) => typeof key !== "string")) invalid();
    for (const key of keys) {
      if (typeof key !== "string" || key.length > 256) invalid();
      output[key] = copy(ownDataValue(candidate, key), depth + 1);
    }
    return output;
  };
  return copy(value, 0);
}

function ownDataValue(value: object, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    !descriptor.enumerable
  ) {
    invalid();
  }
  return descriptor.value;
}

function ownRecord(
  record: Record<string, JsonValue>,
  key: string,
): Record<string, JsonValue> {
  const value = optionalValue(record, key);
  if (!isPlainRecord(value)) invalid();
  return value;
}

function ownString(record: Record<string, JsonValue>, key: string): string {
  const value = optionalValue(record, key);
  if (typeof value !== "string") invalid();
  return value;
}

function optionalString(
  record: Record<string, JsonValue>,
  key: string,
): string | undefined {
  const value = optionalValue(record, key);
  if (value === undefined) return undefined;
  if (typeof value !== "string") invalid();
  return value;
}

function ownFiniteNumber(
  record: Record<string, JsonValue>,
  key: string,
): number {
  const value = optionalFiniteNumber(record, key);
  if (value === undefined) invalid();
  return value;
}

function optionalFiniteNumber(
  record: Record<string, JsonValue>,
  key: string,
): number | undefined {
  const value = optionalValue(record, key);
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    invalid();
  }
  return value;
}

function hasOwnFiniteNumber(
  record: Record<string, JsonValue>,
  key: string,
): boolean {
  return optionalFiniteNumber(record, key) !== undefined;
}

function optionalBufferBlocks(
  record: Record<string, JsonValue>,
  key: string,
): number {
  const value = optionalFiniteNumber(record, key);
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value > 1_000_000_000) invalid();
  return value;
}

function optionalValue(
  record: Record<string, JsonValue>,
  key: string,
): JsonValue | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function isPlainRecord(
  value: JsonValue | undefined,
): value is Record<string, JsonValue> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function isPlainUnknownRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameKeys(
  record: Record<string, JsonValue>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(record);
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
}

function sameUnorderedKeys(
  record: Record<string, JsonValue>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(record);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.hasOwn(record, key))
  );
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function isQueryKind(value: unknown): value is PostgresQueryPlanKind {
  return value === "fact" || value === "tenant";
}

function isAuthorization(
  value: unknown,
): value is PostgresQueryPlanAuthorization {
  return value === "runtime_rls" || value === "superuser_bypass";
}

function invalid(): never {
  throw new PostgresQueryPlanLoadError();
}
