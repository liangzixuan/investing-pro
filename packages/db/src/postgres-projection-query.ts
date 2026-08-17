import type {
  FinancialFact,
  OperationProjectionQuery,
  OperationProjectionSourceResult,
  ProjectionOperation,
} from "@research-cockpit/research-core";

import {
  normalizePostgresFinancialFactRows,
  PostgresProjectionNormalizationError,
} from "./projection-normalization";

export const MAX_POSTGRES_PROJECTION_ROWS = 100;
const POSTGRES_PROJECTION_QUERY_LIMIT = MAX_POSTGRES_PROJECTION_ROWS + 1;

export interface PostgresProjectionOperationContext {
  readonly purpose: "display" | "derive" | "alert";
  readonly channel: "api" | "local_alert";
}

const DISPLAY_API_CONTEXT = Object.freeze({
  purpose: "display",
  channel: "api",
} satisfies PostgresProjectionOperationContext);
const DERIVE_API_CONTEXT = Object.freeze({
  purpose: "derive",
  channel: "api",
} satisfies PostgresProjectionOperationContext);
const ALERT_LOCAL_ALERT_CONTEXT = Object.freeze({
  purpose: "alert",
  channel: "local_alert",
} satisfies PostgresProjectionOperationContext);

/**
 * A stable, value-free error for an unsupported query contract. Runtime callers
 * are checked even though TypeScript restricts the public operation type.
 */
export class PostgresProjectionQueryError extends Error {
  public readonly code = "INVALID_POSTGRES_PROJECTION_QUERY" as const;

  public constructor() {
    super("PostgreSQL projection query is invalid.");
    this.name = "PostgresProjectionQueryError";
  }
}

/**
 * Renders one immutable query body for PREPARE. The only SQL parameters are:
 * $1 listing ID, $2 public-known cutoff, and $3 system-recorded cutoff.
 * Operation selection is a closed source-controlled mapping, never SQL input.
 */
export function renderPostgresFinancialFactProjectionQuery(
  operation: ProjectionOperation,
): string {
  return projectionSql(postgresProjectionOperationContext(operation));
}

/** The same closed operation tuple used by SQL and request-context setup. */
export function postgresProjectionOperationContext(
  operation: ProjectionOperation,
): Readonly<PostgresProjectionOperationContext> {
  switch (operation) {
    case "display_api":
      return DISPLAY_API_CONTEXT;
    case "derive_api":
      return DERIVE_API_CONTEXT;
    case "alert_local_alert":
      return ALERT_LOCAL_ALERT_CONTEXT;
    default:
      throw new PostgresProjectionQueryError();
  }
}

/**
 * Parses quiet, tuples-only, unaligned psql output. The query emits one JSON
 * object per line; structural and semantic validation remains the normalizer's
 * responsibility.
 */
export function parsePostgresFinancialFactProjectionRows(
  stdout: string,
): unknown[] {
  try {
    if (typeof stdout !== "string") invalidRows();

    const withoutTrailingNewline = stdout.replace(/(?:\r?\n)$/, "");
    if (withoutTrailingNewline === "") return [];

    const lines = withoutTrailingNewline.split(/\r?\n/);
    if (lines.length > POSTGRES_PROJECTION_QUERY_LIMIT) invalidRows();

    return lines.map((line) => {
      if (line === "") invalidRows();
      return JSON.parse(line) as unknown;
    });
  } catch {
    invalidRows();
  }
}

/**
 * Enforces the 100-row public boundary before the existing all-or-nothing row
 * normalizer can inspect any returned value. LIMIT 101 makes overflow
 * distinguishable from an authorized 100-row result without truncation.
 */
export function normalizePostgresFinancialFactProjectionRows(
  query: OperationProjectionQuery,
  rows: unknown,
): OperationProjectionSourceResult<FinancialFact> {
  if (!withinProjectionRowBound(rows)) invalidRows();
  return normalizePostgresFinancialFactRows(query, rows);
}

function projectionSql(grant: PostgresProjectionOperationContext): string {
  return `WITH bounded_projection AS (
  SELECT
    fact.id::text AS row_id,
    listing.id::text AS instrument_id,
    security.id::text AS security_id,
    fact.concept_key::text AS concept_key,
    fact.value_numeric::text AS value_numeric,
    fact.value_scale::integer AS value_scale,
    fact.unit_code::text AS unit_code,
    fact.currency_code::text AS currency_code,
    fact.dimensions::text AS dimensions_json,
    fact.period_start::text AS period_start,
    fact.period_end::text AS period_end,
    pg_catalog.to_char(
      fact.known_from AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) AS known_from,
    CASE WHEN fact.known_to IS NULL THEN NULL ELSE pg_catalog.to_char(
      fact.known_to AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) END AS known_to,
    pg_catalog.to_char(
      fact.system_from AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) AS system_from,
    CASE WHEN fact.system_to IS NULL THEN NULL ELSE pg_catalog.to_char(
      fact.system_to AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) END AS system_to,
    pg_catalog.to_char(
      fact.available_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) AS available_at,
    evidence.id::text AS evidence_id,
    fact.rights_policy_id::text AS rights_policy_id,
    fact.rights_policy_version::text AS rights_policy_version,
    fact.quality_state::text AS quality_state,
    fact.classification::text AS classification,
    policy.policy_id::text AS policy_id,
    policy.policy_version::text AS policy_version,
    policy.classification::text AS policy_classification,
    policy.territory::text AS policy_territory,
    CASE WHEN policy.expires_at IS NULL THEN NULL ELSE pg_catalog.to_char(
      policy.expires_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) END AS policy_expires_at,
    operation_grant.policy_id::text AS grant_policy_id,
    operation_grant.policy_version::text AS grant_policy_version,
    operation_grant.purpose::text AS grant_purpose,
    operation_grant.channel::text AS grant_channel,
    operation_grant.allowed AS grant_allowed
  FROM shared_data.listings AS listing
  JOIN shared_data.share_classes AS share_class
    ON share_class.id = listing.share_class_id
  JOIN shared_data.securities AS security
    ON security.id = share_class.security_id
  JOIN shared_data.financial_facts AS fact
    ON fact.security_id = security.id
  JOIN shared_data.evidence AS evidence
    ON evidence.id = fact.evidence_id
   AND evidence.rights_policy_id = fact.rights_policy_id
   AND evidence.rights_policy_version = fact.rights_policy_version
  JOIN shared_data.rights_policies AS policy
    ON policy.policy_id = fact.rights_policy_id
   AND policy.policy_version = fact.rights_policy_version
  JOIN shared_data.rights_grants AS operation_grant
    ON operation_grant.policy_id = policy.policy_id
   AND operation_grant.policy_version = policy.policy_version
   AND operation_grant.purpose = '${grant.purpose}'
   AND operation_grant.channel = '${grant.channel}'
   AND operation_grant.allowed
  WHERE listing.id = $1::text
    AND listing.effective_from <= $2::timestamptz
    AND (listing.effective_to IS NULL OR $2::timestamptz < listing.effective_to)
    AND listing.system_from <= $3::timestamptz
    AND (listing.system_to IS NULL OR $3::timestamptz < listing.system_to)
    AND fact.known_from <= $2::timestamptz
    AND (fact.known_to IS NULL OR $2::timestamptz < fact.known_to)
    AND fact.system_from <= $3::timestamptz
    AND (fact.system_to IS NULL OR $3::timestamptz < fact.system_to)
    AND fact.available_at <= $2::timestamptz
    AND evidence.known_from <= $2::timestamptz
    AND (evidence.known_to IS NULL OR $2::timestamptz < evidence.known_to)
    AND evidence.available_at <= $2::timestamptz
  ORDER BY fact.id COLLATE "C"
  LIMIT ${POSTGRES_PROJECTION_QUERY_LIMIT}
)
SELECT pg_catalog.row_to_json(projection_row)::text
FROM bounded_projection AS projection_row
ORDER BY projection_row.row_id COLLATE "C";`;
}

function withinProjectionRowBound(rows: unknown): rows is unknown[] {
  try {
    return Array.isArray(rows) && rows.length <= MAX_POSTGRES_PROJECTION_ROWS;
  } catch {
    return false;
  }
}

function invalidRows(): never {
  throw new PostgresProjectionNormalizationError();
}
