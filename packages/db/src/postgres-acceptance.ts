import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLEAN_BOOTSTRAP_DATABASE_NAME,
  maskSqlQuotedContent,
  renderReviewedCleanBootstrap,
} from "./clean-bootstrap";
import { loadMigrationFiles } from "./check-migrations";
import {
  buildPostgresAcceptanceEvidence,
  POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME,
  writePostgresAcceptanceEvidence,
  type PostgresAcceptanceSourceHashes,
  type PostgresAcceptanceToolVersions,
} from "./postgres-acceptance-evidence";

const acceptanceRunnerPath = fileURLToPath(import.meta.url);
const packageRoot = join(dirname(acceptanceRunnerPath), "..");
const repositoryRoot = join(packageRoot, "..", "..");
const imageConfigPath = join(packageRoot, "acceptance", "postgres-image.json");
const migrationManifestPath = join(packageRoot, "migration-manifest.json");
const workflowPath = join(
  repositoryRoot,
  ".github",
  "workflows",
  "postgres-acceptance.yml",
);
const syntheticFixturePath = join(
  packageRoot,
  "acceptance",
  "synthetic-fixture.sql",
);

const EXPECTED_IMAGE_REFERENCE =
  "docker.io/library/postgres:17.11-bookworm@sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad";
const EXPECTED_SERVER_VERSION = "17.11";
const EXPECTED_UPLOAD_ARTIFACT_ACTION =
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
const EXPECTED_EVIDENCE_ARTIFACT_NAME =
  "postgres-acceptance-evidence-v2-${{ github.sha }}-${{ github.run_attempt }}";
const EXPECTED_EVIDENCE_ARTIFACT_PATH = `\${{ runner.temp }}/${POSTGRES_ACCEPTANCE_EVIDENCE_FILENAME}`;
export const RUNTIME_AUTH_LOGIN_ROLE =
  "research_cockpit_runtime_login" as const;
export const RUNTIME_AUTH_CAPABILITY_ROLE = "research_cockpit_runtime" as const;
export const RUNTIME_AUTH_PASSFILE =
  "/tmp/research-cockpit-runtime-login.pgpass" as const;
export const RUNTIME_AUTH_WRONG_PASSFILE =
  "/tmp/research-cockpit-runtime-login-wrong.pgpass" as const;
export const RUNTIME_AUTH_FORBIDDEN_SET_ROLES = Object.freeze([
  "research_cockpit_owner",
  "research_cockpit_test_seed",
  "research_cockpit_backup",
  "postgres",
] as const);
const BASE64URL_RUNTIME_AUTH_PASSWORD = /^[A-Za-z0-9_-]+$/;
const CAPABILITY_ROLES = [
  "research_cockpit_backup",
  "research_cockpit_owner",
  "research_cockpit_runtime",
  "research_cockpit_test_seed",
] as const;
const CATALOG_FALSE = "false";
const CATALOG_TRUE = "true";
export const EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS = Object.freeze(
  CAPABILITY_ROLES.map((role) =>
    [role, ...Array<string>(7).fill(CATALOG_FALSE)].join("|"),
  ),
);
const APPLICATION_TABLES = [
  "private_data.alert_rules",
  "private_data.audit_events",
  "private_data.entitlements",
  "private_data.idempotency_records",
  "private_data.memberships",
  "private_data.organization_principals",
  "private_data.organizations",
  "private_data.principals",
  "private_data.resource_id_registry",
  "private_data.theses",
  "shared_data.evidence",
  "shared_data.exchanges",
  "shared_data.financial_facts",
  "shared_data.issuers",
  "shared_data.listings",
  "shared_data.metric_definitions",
  "shared_data.rights_grants",
  "shared_data.rights_policies",
  "shared_data.schema_migrations",
  "shared_data.securities",
  "shared_data.share_classes",
  "shared_data.symbol_history",
] as const;
const PROTECTED_TABLES = APPLICATION_TABLES.filter(
  (table) => table !== "shared_data.schema_migrations",
);
const RUNTIME_SELECT_TABLES = APPLICATION_TABLES.filter(
  (table) =>
    table !== "private_data.audit_events" &&
    table !== "shared_data.schema_migrations",
);
const RUNTIME_EXECUTE_ROUTINES = [
  "private_data.current_channel",
  "private_data.current_data_classification",
  "private_data.current_organization_id",
  "private_data.current_principal_id",
  "private_data.current_purpose",
  "private_data.current_territory",
  "private_data.has_active_entitlement",
  "private_data.has_active_membership",
  "private_data.set_request_context",
  "shared_data.rights_allow_current_use",
] as const;
const OWNED_APPLICATION_ROUTINES = [
  ...RUNTIME_EXECUTE_ROUTINES,
  "private_data.guard_live_resource_identity",
  "private_data.guard_resource_id_registry",
  "private_data.tombstone_resource_id_after_delete",
].sort();
const EXPECTED_CONSTRAINT_COUNTS = [
  "private_data.alert_rules|c|6",
  "private_data.alert_rules|f|6",
  "private_data.alert_rules|p|1",
  "private_data.audit_events|c|9",
  "private_data.audit_events|f|2",
  "private_data.audit_events|p|1",
  "private_data.entitlements|c|3",
  "private_data.entitlements|f|2",
  "private_data.entitlements|p|1",
  "private_data.entitlements|u|1",
  "private_data.idempotency_records|c|7",
  "private_data.idempotency_records|f|2",
  "private_data.idempotency_records|p|1",
  "private_data.memberships|c|3",
  "private_data.memberships|f|1",
  "private_data.memberships|p|1",
  "private_data.memberships|x|1",
  "private_data.organization_principals|c|1",
  "private_data.organization_principals|f|2",
  "private_data.organization_principals|p|1",
  "private_data.organizations|c|3",
  "private_data.organizations|p|1",
  "private_data.organizations|u|1",
  "private_data.principals|c|3",
  "private_data.principals|p|1",
  "private_data.principals|u|1",
  "private_data.resource_id_registry|c|5",
  "private_data.resource_id_registry|f|1",
  "private_data.resource_id_registry|p|1",
  "private_data.resource_id_registry|u|1",
  "private_data.theses|c|7",
  "private_data.theses|f|5",
  "private_data.theses|p|1",
  "shared_data.evidence|c|7",
  "shared_data.evidence|f|1",
  "shared_data.evidence|p|1",
  "shared_data.evidence|u|1",
  "shared_data.exchanges|c|4",
  "shared_data.exchanges|p|1",
  "shared_data.exchanges|u|1",
  "shared_data.financial_facts|c|13",
  "shared_data.financial_facts|f|2",
  "shared_data.financial_facts|p|1",
  "shared_data.financial_facts|x|1",
  "shared_data.issuers|c|3",
  "shared_data.issuers|p|1",
  "shared_data.listings|c|4",
  "shared_data.listings|f|2",
  "shared_data.listings|p|1",
  "shared_data.metric_definitions|c|7",
  "shared_data.metric_definitions|p|1",
  "shared_data.rights_grants|c|2",
  "shared_data.rights_grants|f|1",
  "shared_data.rights_grants|p|1",
  "shared_data.rights_policies|c|3",
  "shared_data.rights_policies|p|1",
  "shared_data.schema_migrations|c|1",
  "shared_data.schema_migrations|p|1",
  "shared_data.schema_migrations|u|1",
  "shared_data.securities|c|4",
  "shared_data.securities|f|1",
  "shared_data.securities|p|1",
  "shared_data.share_classes|c|2",
  "shared_data.share_classes|f|1",
  "shared_data.share_classes|p|1",
  "shared_data.symbol_history|c|4",
  "shared_data.symbol_history|f|1",
  "shared_data.symbol_history|p|1",
  "shared_data.symbol_history|x|1",
] as const;

const ORGANIZATION_ALPHA = "10000000-0000-4000-8000-000000000001";
const ORGANIZATION_BETA = "10000000-0000-4000-8000-000000000002";
const PRINCIPAL_ALPHA = "20000000-0000-4000-8000-000000000001";
const PRINCIPAL_BETA = "20000000-0000-4000-8000-000000000002";
const PRINCIPAL_INACTIVE = "20000000-0000-4000-8000-000000000003";
const PRINCIPAL_NO_MEMBERSHIP = "20000000-0000-4000-8000-000000000004";
const PRINCIPAL_EXPIRED = "20000000-0000-4000-8000-000000000005";
const PRINCIPAL_FUTURE = "20000000-0000-4000-8000-000000000006";

interface AcceptanceImageConfig {
  schemaVersion: 1;
  repository: "docker.io/library/postgres";
  tag: "17.11-bookworm";
  indexDigest: `sha256:${string}`;
  reference: string;
  mediaType: "application/vnd.oci.image.index.v1+json";
  expectedServerVersion: "17.11";
  expectedServerVersionNumber: 170011;
  databaseName: typeof CLEAN_BOOTSTRAP_DATABASE_NAME;
  workflowSha256: string;
  fixtureSha256: string;
  verifiedOn: string;
  runner: {
    label: "ubuntu-24.04";
    os: "linux";
    architecture: "amd64";
  };
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RuntimeAuthPsqlInvocation {
  environment: Readonly<Record<string, string>>;
  command: readonly string[];
}

export interface RuntimeAuthPsqlInvocationOptions {
  readonly requireScram?: boolean;
  readonly verboseErrors?: boolean;
}

export interface RuntimeAuthBestEffortOperation {
  label: string;
  run: () => Promise<void>;
}

export interface RuntimeAuthOperationFailure {
  label: string;
  error: unknown;
}

export interface PsqlFailureExpectation {
  label: string;
  sqlState: string;
  message: string;
}

interface PrivateVisibility {
  principalIds: string;
  membershipIds: string;
  associationIds: string;
  organizationIds: string;
  entitlementIds: string;
  thesisIds: string;
  alertIds: string;
  idempotencyIds: string;
  registryIds: string;
  evidenceIds: string;
}

export interface AcceptanceArtifacts {
  config: unknown;
  workflow: string;
  fixture: string;
}

export function generateRuntimeAuthPassword(): string {
  return randomBytes(32).toString("base64url");
}

export function renderRuntimeAuthProvisioningSql(password: string): string {
  assertRuntimeAuthPassword(password);
  return `BEGIN;
SET LOCAL log_statement = 'none';
SET LOCAL log_min_error_statement = 'panic';
SET LOCAL log_duration = off;
SET LOCAL log_min_duration_statement = -1;
SET LOCAL log_min_duration_sample = -1;
SET LOCAL log_statement_sample_rate = 0;
SET LOCAL log_transaction_sample_rate = 0;
SET LOCAL password_encryption = 'scram-sha-256';
CREATE ROLE ${RUNTIME_AUTH_LOGIN_ROLE}
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOINHERIT
  NOBYPASSRLS
  CONNECTION LIMIT 1
  PASSWORD '${password}';
GRANT ${RUNTIME_AUTH_CAPABILITY_ROLE}
  TO ${RUNTIME_AUTH_LOGIN_ROLE}
  WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
COMMIT;
`;
}

export function renderRuntimeAuthPassfile(password: string): string {
  assertRuntimeAuthPassword(password);
  return `127.0.0.1:5432:${CLEAN_BOOTSTRAP_DATABASE_NAME}:${RUNTIME_AUTH_LOGIN_ROLE}:${password}\n`;
}

export function renderRuntimeAuthCleanupSql(): string {
  return `BEGIN;
DROP ROLE IF EXISTS ${RUNTIME_AUTH_LOGIN_ROLE};
COMMIT;
`;
}

export function renderRuntimeAuthBackendDrainSql(): string {
  return `DO $runtime_auth_backend_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '5 seconds';
BEGIN
  LOOP
    PERFORM pg_catalog.pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_stat_activity
      WHERE usename = '${RUNTIME_AUTH_LOGIN_ROLE}'
        AND backend_type = 'client backend'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'ephemeral runtime login backend did not drain'
        USING ERRCODE = '55000';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.05);
  END LOOP;
END;
$runtime_auth_backend_drain$;
`;
}

export function buildRuntimeAuthPsqlInvocation(
  passfile: typeof RUNTIME_AUTH_PASSFILE | typeof RUNTIME_AUTH_WRONG_PASSFILE,
  options: RuntimeAuthPsqlInvocationOptions = {},
): RuntimeAuthPsqlInvocation {
  const { requireScram = true, verboseErrors = false } = options;
  const environment: Record<string, string> = {
    PGPASSFILE: passfile,
    PGSSLMODE: "disable",
    PGCONNECT_TIMEOUT: "5",
  };
  if (requireScram) {
    // libpq treats an empty PGREQUIREAUTH as configured during request
    // enforcement, so the negative-password probe must omit it entirely.
    environment.PGREQUIREAUTH = "scram-sha-256";
  }

  return Object.freeze({
    environment: Object.freeze(environment),
    command: Object.freeze([
      "psql",
      "--no-psqlrc",
      "--no-password",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      ...(verboseErrors ? ["--set=VERBOSITY=verbose"] : []),
      "--host=127.0.0.1",
      "--port=5432",
      `--username=${RUNTIME_AUTH_LOGIN_ROLE}`,
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ]),
  });
}

export function assertRuntimeWrongPasswordRejection(
  result: CommandResult,
): void {
  if (result.exitCode === 0) {
    throw new Error(
      "Wrong-password runtime authentication unexpectedly succeeded",
    );
  }
  if (result.exitCode !== 2) {
    throw new Error(
      "Wrong-password runtime authentication returned an unexpected exit code",
    );
  }
  if (result.stdout.trim() !== "") {
    throw new Error(
      "Wrong-password runtime authentication returned unexpected output",
    );
  }

  const diagnostic = result.stderr.toLowerCase().replace(/\s+/g, " ");
  if (
    !diagnostic.includes(
      `fatal: password authentication failed for user "${RUNTIME_AUTH_LOGIN_ROLE}"`,
    )
  ) {
    throw new Error(
      "Wrong-password runtime authentication did not return the expected rejection",
    );
  }
}

export async function collectRuntimeAuthOperationFailures(
  operations: readonly RuntimeAuthBestEffortOperation[],
): Promise<RuntimeAuthOperationFailure[]> {
  const failures: RuntimeAuthOperationFailure[] = [];
  for (const operation of operations) {
    try {
      await operation.run();
    } catch (error) {
      failures.push({ label: operation.label, error });
    }
  }
  return failures;
}

export async function runRuntimeAuthCommandWithDrain<T>(
  runCommand: () => Promise<T>,
  drainBackends: () => Promise<void>,
): Promise<T> {
  let result: T;
  try {
    result = await runCommand();
  } catch (commandError) {
    try {
      await drainBackends();
    } catch (drainError) {
      throw new AggregateError(
        [commandError, drainError],
        "Runtime-auth command and backend drain both failed",
        { cause: drainError },
      );
    }
    throw commandError;
  }

  await drainBackends();
  return result;
}

function throwRuntimeAuthOperationFailures(
  failures: readonly RuntimeAuthOperationFailure[],
  message: string,
): void {
  if (failures.length === 0) return;

  const errors = failures.map(
    ({ label, error }) => new Error(`${label} failed`, { cause: error }),
  );
  throw new AggregateError(errors, message, { cause: errors[0] });
}

export async function checkPostgresAcceptanceHarness(
  root = repositoryRoot,
): Promise<string[]> {
  const config = JSON.parse(
    await readFile(
      join(root, "packages", "db", "acceptance", "postgres-image.json"),
      "utf8",
    ),
  ) as unknown;
  const workflow = await readFile(
    join(root, ".github", "workflows", "postgres-acceptance.yml"),
    "utf8",
  );
  const fixture = await readFile(
    join(root, "packages", "db", "acceptance", "synthetic-fixture.sql"),
    "utf8",
  );
  return inspectPostgresAcceptanceHarness({ config, workflow, fixture });
}

export function inspectPostgresAcceptanceHarness(
  artifacts: AcceptanceArtifacts,
): string[] {
  const violations: string[] = [];
  let config: AcceptanceImageConfig | undefined;
  try {
    config = parseImageConfig(artifacts.config);
  } catch (error) {
    violations.push(
      error instanceof Error ? error.message : "Invalid image config",
    );
  }

  if (config) {
    if (normalizedSha256(artifacts.workflow) !== config.workflowSha256) {
      violations.push("workflow differs from its reviewed SHA-256");
    }
    if (normalizedSha256(artifacts.fixture) !== config.fixtureSha256) {
      violations.push("synthetic fixture differs from its reviewed SHA-256");
    }
    requireText(
      artifacts.workflow,
      `image: ${config.reference}`,
      "workflow image must match the immutable declaration",
      violations,
    );
    requireText(
      artifacts.workflow,
      `POSTGRES_DB: ${config.databaseName}`,
      "workflow database must match the fixed acceptance target",
      violations,
    );
  }
  requireText(
    artifacts.workflow,
    "runs-on: ubuntu-24.04",
    "acceptance must use the fixed Ubuntu 24.04 runner",
    violations,
  );
  requireText(
    artifacts.workflow,
    "RESEARCH_COCKPIT_PG_CONTAINER_ID: ${{ job.services.postgres.id }}",
    "workflow must pass only the GitHub service container ID",
    violations,
  );
  requireText(
    artifacts.workflow,
    "POSTGRES_HOST_AUTH_METHOD: scram-sha-256",
    "acceptance service must require SCRAM for host authentication",
    violations,
  );
  requireText(
    artifacts.workflow,
    "POSTGRES_INITDB_ARGS: --auth-host=scram-sha-256",
    "acceptance service must initialize loopback host rules with SCRAM",
    violations,
  );
  requireText(
    artifacts.workflow,
    "pnpm --filter @research-cockpit/db acceptance:postgres:ci",
    "workflow must invoke the reviewed package acceptance command",
    violations,
  );
  violations.push(...inspectEvidenceUploadStep(artifacts.workflow));
  for (const triggerPath of [
    "package.json",
    "packages/db/**",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
  ]) {
    requireText(
      artifacts.workflow,
      `- ${triggerPath}`,
      `workflow must rerun when ${triggerPath} changes`,
      violations,
    );
  }
  for (const [pattern, message] of [
    [/^\s*ports\s*:/im, "workflow must not publish a database port"],
    [/DATABASE_URL/i, "workflow must not construct a database URL"],
    [
      /localhost|127\.0\.0\.1/i,
      "workflow must not address PostgreSQL through the host",
    ],
    [
      /postgres:(?:latest|17)(?:\s|$)/i,
      "workflow must not use a mutable PostgreSQL tag",
    ],
  ] as const) {
    if (pattern.test(artifacts.workflow)) violations.push(message);
  }

  for (const marker of [
    "SET SESSION AUTHORIZATION research_cockpit_test_seed;",
    "BEGIN;",
    "COMMIT;",
    "RESET SESSION AUTHORIZATION;",
    "INSERT INTO private_data.resource_id_registry",
    "INSERT INTO private_data.theses",
    "INSERT INTO private_data.alert_rules",
    "synthetic.full",
    "synthetic.display-only",
    "synthetic.expired",
    "synthetic.denied",
  ]) {
    requireText(
      artifacts.fixture,
      marker,
      `synthetic fixture is missing ${marker}`,
      violations,
    );
  }
  if (/\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(artifacts.fixture)) {
    violations.push("synthetic fixture must remain insert-only");
  }
  if (/\bCOPY\b[\s\S]*?\bFROM\b/i.test(artifacts.fixture)) {
    violations.push("synthetic fixture must not import external data");
  }
  if (/https?:\/\//i.test(artifacts.fixture)) {
    violations.push("synthetic fixture must not contain network locations");
  }
  violations.push(...inspectInsertOnlyFixture(artifacts.fixture));
  const registryPosition = artifacts.fixture.indexOf(
    "INSERT INTO private_data.resource_id_registry",
  );
  for (const table of ["theses", "alert_rules"] as const) {
    const livePosition = artifacts.fixture.indexOf(
      `INSERT INTO private_data.${table}`,
    );
    if (registryPosition < 0 || livePosition < registryPosition) {
      violations.push(`resource registry rows must precede ${table}`);
    }
  }
  return violations;
}

export async function runPostgresAcceptance(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (environment.CI !== "true" || environment.GITHUB_ACTIONS !== "true") {
    throw new Error(
      "Live PostgreSQL acceptance is restricted to the isolated GitHub Actions job",
    );
  }
  const containerId = environment.RESEARCH_COCKPIT_PG_CONTAINER_ID;
  if (!containerId) {
    throw new Error("GitHub service container ID is required");
  }
  await verifyCheckedOutCommit(environment);

  const violations = await checkPostgresAcceptanceHarness();
  if (violations.length > 0) {
    throw new Error(
      `PostgreSQL acceptance harness violations:\n- ${violations.join("\n- ")}`,
    );
  }
  const config = parseImageConfig(
    JSON.parse(await readFile(imageConfigPath, "utf8")) as unknown,
  );
  const bootstrap = await renderReviewedCleanBootstrap({
    databaseName: config.databaseName,
    containerId,
  });

  await verifyContainerIdentity(containerId, config);
  const toolVersions = await verifyToolVersions(
    containerId,
    config.expectedServerVersion,
    config.expectedServerVersionNumber,
  );
  await verifyPristineTarget(containerId);
  const rollbackProbe = injectBootstrapFailure(bootstrap);
  await expectPsqlFailure(containerId, rollbackProbe, {
    label: "injected clean-bootstrap rollback",
    sqlState: "22012",
    message: "division by zero",
  });
  await verifyPristineTarget(containerId);
  await psql(containerId, bootstrap);
  await verifyMigrationLedger(containerId);
  await expectPsqlFailure(containerId, bootstrap, {
    label: "clean-bootstrap replay",
    sqlState: "P0001",
    message: "clean bootstrap requires an empty application target",
  });
  await verifyMigrationLedger(containerId);

  await psql(containerId, await readFile(syntheticFixturePath, "utf8"));
  await verifyCatalogContract(containerId);
  await verifyBackupCapability(containerId);
  await verifyContextCleanup(containerId);
  await verifyTenantIsolation(containerId);
  await verifyOperationRights(containerId);
  await verifyWriteDenials(containerId);
  await verifyAuthenticatedRuntimeSession(containerId);

  await verifyCheckedOutCommit(environment);
  const sourceHashes = await collectAcceptanceSourceHashes(config);
  const evidence = buildPostgresAcceptanceEvidence({
    githubEnvironment: environment,
    reviewedImageReference: config.reference,
    reviewedImageIndexDigest: config.indexDigest,
    toolVersions,
    sourceHashes,
    completedAt: new Date().toISOString(),
  });
  const writtenEvidence = await writePostgresAcceptanceEvidence(
    evidence,
    environment,
  );

  process.stdout.write(
    `PostgreSQL acceptance evidence SHA-256: ${writtenEvidence.sha256}\n` +
      "PostgreSQL 17.11 clean-bootstrap, impersonated-capability, and container-local SCRAM runtime acceptance passed; the success-only run record was written.\n",
  );
}

async function verifyCheckedOutCommit(
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const expectedCommit = environment.GITHUB_SHA;
  if (expectedCommit === undefined || !/^[0-9a-f]{40}$/.test(expectedCommit)) {
    throw new Error("A canonical GitHub checkout commit is required");
  }
  const result = await executeGit(["rev-parse", "HEAD"]);
  assertSuccess(result, "resolve the checked-out commit");
  if (result.stdout.trim() !== expectedCommit) {
    throw new Error("The checked-out commit does not match GITHUB_SHA");
  }
  const status = await executeGit([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  assertSuccess(status, "verify the acceptance checkout is clean");
  if (status.stdout.trim().length > 0) {
    throw new Error("PostgreSQL acceptance requires a clean checkout");
  }
}

async function collectAcceptanceSourceHashes(
  config: AcceptanceImageConfig,
): Promise<PostgresAcceptanceSourceHashes> {
  const [
    workflowSha256,
    fixtureSha256,
    migrationManifestSha256,
    acceptanceRunnerSha256,
  ] = await Promise.all([
    exactFileSha256(workflowPath),
    exactFileSha256(syntheticFixturePath),
    exactFileSha256(migrationManifestPath),
    exactFileSha256(acceptanceRunnerPath),
  ]);
  if (
    workflowSha256 !== config.workflowSha256 ||
    fixtureSha256 !== config.fixtureSha256
  ) {
    throw new Error("Reviewed acceptance source bytes changed during the run");
  }
  return Object.freeze({
    workflowSha256,
    fixtureSha256,
    migrationManifestSha256,
    acceptanceRunnerSha256,
  });
}

async function exactFileSha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function verifyBackupCapability(containerId: string): Promise<void> {
  const visibility = parseJsonObject(
    await psqlScalar(
      containerId,
      `SET SESSION AUTHORIZATION research_cockpit_backup;
SELECT pg_catalog.json_build_object(
  'organizations', (SELECT count(*) FROM private_data.organizations),
  'evidence', (SELECT count(*) FROM shared_data.evidence)
)::text;
RESET SESSION AUTHORIZATION;`,
    ),
  );
  assertJsonEqual(
    visibility,
    { organizations: 2, evidence: 5 },
    "backup synthetic-read capability",
  );

  await expectPsqlFailure(
    containerId,
    `SET SESSION AUTHORIZATION research_cockpit_backup;
BEGIN;
INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000098',
  'backup-write-probe',
  'Backup write probe',
  transaction_timestamp()
);
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
    {
      label: "backup write",
      sqlState: "42501",
      message: "permission denied for table organizations",
    },
  );
}

async function verifyPristineTarget(containerId: string): Promise<void> {
  const state = parseJsonObject(
    await psqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'applicationSchemas', count(*) FILTER (
    WHERE namespace.nspname IN ('private_data', 'shared_data')
  ),
  'capabilityRoles', (
    SELECT count(*)
    FROM pg_catalog.pg_roles
    WHERE rolname = ANY (ARRAY[
      'research_cockpit_backup',
      'research_cockpit_owner',
      'research_cockpit_runtime',
      'research_cockpit_test_seed'
    ])
  )
)::text
FROM pg_catalog.pg_namespace AS namespace;`,
    ),
  );
  assertJsonEqual(
    state,
    { applicationSchemas: 0, capabilityRoles: 0 },
    "pristine target and bootstrap rollback",
  );
}

export function injectBootstrapFailure(bootstrap: string): string {
  const finalCommit = /\nCOMMIT;\n?$/;
  if (!finalCommit.test(bootstrap)) {
    throw new Error("Reviewed bootstrap final COMMIT is missing");
  }
  const injected = bootstrap.replace(finalCommit, "\nSELECT 1 / 0;\nCOMMIT;\n");
  if (injected === bootstrap) {
    throw new Error("Reviewed bootstrap rollback probe was not injected");
  }
  return injected;
}

async function verifyContainerIdentity(
  containerId: string,
  config: AcceptanceImageConfig,
): Promise<void> {
  const result = await executeDocker([
    "inspect",
    "--format",
    "{{.Config.Image}}",
    containerId,
  ]);
  assertSuccess(result, "inspect the PostgreSQL service container");
  assertEqual(
    result.stdout.trim(),
    config.reference,
    "service image reference",
  );
}

async function verifyToolVersions(
  containerId: string,
  expectedVersion: string,
  expectedVersionNumber: number,
): Promise<PostgresAcceptanceToolVersions> {
  const serverVersionNumber = await psqlScalar(
    containerId,
    "SHOW server_version_num;",
  );
  assertEqual(
    serverVersionNumber,
    String(expectedVersionNumber),
    "server version number",
  );
  const versions: {
    postgres?: string;
    psql?: string;
    pgDump?: string;
    pgRestore?: string;
  } = {};
  for (const tool of ["postgres", "psql", "pg_dump", "pg_restore"] as const) {
    const result = await dockerExec(containerId, [tool, "--version"]);
    assertSuccess(result, `${tool} version`);
    if (
      !new RegExp(`\\b${escapeRegExp(expectedVersion)}\\b`).test(result.stdout)
    ) {
      throw new Error(`${tool} does not report PostgreSQL ${expectedVersion}`);
    }
    const observed = result.stdout.trim();
    if (tool === "postgres") versions.postgres = observed;
    if (tool === "psql") versions.psql = observed;
    if (tool === "pg_dump") versions.pgDump = observed;
    if (tool === "pg_restore") versions.pgRestore = observed;
  }
  if (
    versions.postgres === undefined ||
    versions.psql === undefined ||
    versions.pgDump === undefined ||
    versions.pgRestore === undefined
  ) {
    throw new Error("PostgreSQL tool-version collection was incomplete");
  }
  return Object.freeze({
    postgres: versions.postgres,
    psql: versions.psql,
    pgDump: versions.pgDump,
    pgRestore: versions.pgRestore,
  });
}

async function verifyMigrationLedger(containerId: string): Promise<void> {
  const actual = splitLines(
    await psqlScalar(
      containerId,
      `SELECT migration_id || '|' || file_name || '|' || sha256
FROM shared_data.schema_migrations
ORDER BY migration_id;`,
    ),
  );
  const expected = [
    "0001|0001_schemas_context_and_ledger.sql|e46088d6915fda15fdbc281c48463b7f9478effc90d8aa26d5fcfe84cf6c4890",
    "0002|0002_canonical_entities.sql|41e8164fb29c1d823f4bc65b600dbea6ed5e96d0256f77c7604baf8c2ff6c1ef",
    "0003|0003_temporal_constraints_and_indexes.sql|c3d9dc4c015b3727e98f66e0ab4440a0fcd95821e1863fcf2953f82dc2601dc8",
    "0004|0004_row_security_and_runtime_grants.sql|179188d037fc671c891f0d2d81f5df4748d839a943a2734a7f176f6759271282",
    "0005|0005_non_reusable_resource_ids.sql|a537000c692ea246e8bce9dd5aaa73a576127455aa0ba412db5cbfdf3161889a",
    "0006|0006_null_safe_request_context.sql|1b6ab85eff6dab4a9016278233a333b9d1f819b1d29828c916ad314198146c07",
    "0007|0007_database_privilege_lockdown.sql|7887f8066cff3b0bf22397a2f5ee19352c1c678a7619b6588a5c95e28430c0e6",
  ];
  assertJsonEqual(actual, expected, "migration ledger");
}

async function verifyCatalogContract(containerId: string): Promise<void> {
  const roles = splitLines(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname <> 'postgres'
  AND pg_catalog.left(rolname, 3) <> 'pg_'
ORDER BY rolname;`,
    ),
  );
  assertJsonEqual(
    roles,
    EXPECTED_CAPABILITY_ROLE_ATTRIBUTE_ROWS,
    "capability role attributes",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
WHERE granted_role.rolname LIKE 'research_cockpit_%'
   OR member_role.rolname LIKE 'research_cockpit_%';`,
    ),
    "0",
    "capability role membership edges",
  );

  const schemas = splitLines(
    await psqlScalar(
      containerId,
      `SELECT nspname || '|' || pg_catalog.pg_get_userbyid(nspowner)
FROM pg_catalog.pg_namespace
WHERE nspname <> 'information_schema'
  AND pg_catalog.left(nspname, 3) <> 'pg_'
ORDER BY nspname;`,
    ),
  );
  assertJsonEqual(
    schemas,
    [
      "private_data|research_cockpit_owner",
      "public|pg_database_owner",
      "shared_data|research_cockpit_owner",
    ],
    "complete non-system schema inventory and ownership",
  );

  const relationState = splitLines(
    await psqlScalar(
      containerId,
      `SELECT namespace.nspname || '.' || class.relname || '|' ||
  class.relkind::text || '|' || pg_catalog.pg_get_userbyid(class.relowner) || '|' ||
  class.relrowsecurity || '|' || class.relforcerowsecurity
FROM pg_catalog.pg_class AS class
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND class.relkind IN ('r', 'p', 'v', 'm', 'f', 'S', 'c')
ORDER BY namespace.nspname, class.relname;`,
    ),
  );
  assertJsonEqual(
    relationState,
    APPLICATION_TABLES.map(
      (table) =>
        `${table}|r|research_cockpit_owner|${
          table === "shared_data.schema_migrations"
            ? `${CATALOG_FALSE}|${CATALOG_FALSE}`
            : `${CATALOG_TRUE}|${CATALOG_TRUE}`
        }`,
    ),
    "application table and prohibited relation-kind inventory, ownership, and RLS state",
  );

  const tablePrivileges = splitLines(
    await psqlScalar(
      containerId,
      `SELECT namespace.nspname || '.' || class.relname || '|' ||
  CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_class AS class
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    class.relacl,
    pg_catalog.acldefault('r', class.relowner)
  )
) AS privilege
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND class.relkind = 'r'
  AND privilege.grantee <> class.relowner
ORDER BY 1;`,
    ),
  );
  const expectedTablePrivileges = [
    ...APPLICATION_TABLES.map(
      (table) => `${table}|research_cockpit_backup|SELECT`,
    ),
    ...RUNTIME_SELECT_TABLES.map(
      (table) => `${table}|research_cockpit_runtime|SELECT`,
    ),
    ...PROTECTED_TABLES.flatMap((table) => [
      `${table}|research_cockpit_test_seed|INSERT|${CATALOG_FALSE}`,
      `${table}|research_cockpit_test_seed|SELECT|${CATALOG_FALSE}`,
    ]),
  ]
    .map((line) =>
      line.endsWith(`|${CATALOG_FALSE}`) ? line : `${line}|${CATALOG_FALSE}`,
    )
    .sort();
  assertJsonEqual(
    tablePrivileges,
    expectedTablePrivileges,
    "exact capability table ACLs",
  );

  const schemaPrivileges = splitLines(
    await psqlScalar(
      containerId,
      `SELECT namespace.nspname || '|' ||
  CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_namespace AS namespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    namespace.nspacl,
    pg_catalog.acldefault('n', namespace.nspowner)
  )
) AS privilege
WHERE namespace.nspname <> 'information_schema'
  AND pg_catalog.left(namespace.nspname, 3) <> 'pg_'
  AND privilege.grantee <> namespace.nspowner
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    schemaPrivileges,
    ["private_data", "shared_data"].flatMap((schema) =>
      [
        "research_cockpit_backup",
        "research_cockpit_runtime",
        "research_cockpit_test_seed",
      ].map((role) => `${schema}|${role}|USAGE|${CATALOG_FALSE}`),
    ),
    "exact capability schema ACLs",
  );

  const databasePrivileges = splitLines(
    await psqlScalar(
      containerId,
      `SELECT CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_database AS database
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    database.datacl,
    pg_catalog.acldefault('d', database.datdba)
  )
) AS privilege
WHERE database.datname = pg_catalog.current_database()
  AND privilege.grantee <> database.datdba
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    databasePrivileges,
    [`PUBLIC|CONNECT|${CATALOG_FALSE}`],
    "exact acceptance-database non-owner ACLs",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_attribute AS attribute
JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS privilege
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
  AND privilege.grantee <> class.relowner;`,
    ),
    "0",
    "column-level capability ACLs",
  );

  const routinePrivileges = splitLines(
    await psqlScalar(
      containerId,
      `SELECT namespace.nspname || '.' || procedure.proname || '|' ||
  CASE privilege.grantee
    WHEN 0 THEN 'PUBLIC'
    ELSE pg_catalog.pg_get_userbyid(privilege.grantee)
  END || '|' || privilege.privilege_type || '|' || privilege.is_grantable
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(
  coalesce(
    procedure.proacl,
    pg_catalog.acldefault('f', procedure.proowner)
  )
) AS privilege
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND privilege.grantee <> procedure.proowner
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    routinePrivileges,
    RUNTIME_EXECUTE_ROUTINES.map(
      (routine) =>
        `${routine}|research_cockpit_runtime|EXECUTE|${CATALOG_FALSE}`,
    ).sort(),
    "exact capability routine ACLs",
  );

  const routineOwners = splitLines(
    await psqlScalar(
      containerId,
      `SELECT namespace.nspname || '.' || procedure.proname || '|' ||
  pg_catalog.pg_get_userbyid(procedure.proowner)
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
  AND procedure.proname = ANY (ARRAY[
    'current_channel',
    'current_data_classification',
    'current_organization_id',
    'current_principal_id',
    'current_purpose',
    'current_territory',
    'guard_live_resource_identity',
    'guard_resource_id_registry',
    'has_active_entitlement',
    'has_active_membership',
    'rights_allow_current_use',
    'set_request_context',
    'tombstone_resource_id_after_delete'
  ])
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    routineOwners,
    OWNED_APPLICATION_ROUTINES.map(
      (routine) => `${routine}|research_cockpit_owner`,
    ),
    "application routine ownership",
  );

  const policies = splitLines(
    await psqlScalar(
      containerId,
      `SELECT namespace.nspname || '.' || class.relname || '|' ||
  policy.polname || '|' ||
  CASE policy.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END || '|' ||
  CASE pg_catalog.cardinality(policy.polroles)
    WHEN 1 THEN pg_catalog.pg_get_userbyid(policy.polroles[1])
    ELSE '<invalid-role-count>'
  END
FROM pg_catalog.pg_policy AS policy
JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
ORDER BY 1;`,
    ),
  );
  assertJsonEqual(
    policies,
    await expectedPolicyCatalogLines(),
    "exact RLS policy table, command, and role bindings",
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT namespace.nspname || '|' || extension.extversion
FROM pg_catalog.pg_extension AS extension
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = extension.extnamespace
WHERE extension.extname = 'btree_gist';`,
    ).then((value) => value.split("|")[0] ?? ""),
    "shared_data",
    "btree_gist extension schema",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT namespace.nspname || '.' || class.relname || '|' ||
  constraint_row.contype::text || '|' || count(*)
FROM pg_catalog.pg_constraint AS constraint_row
JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
WHERE namespace.nspname IN ('private_data', 'shared_data')
GROUP BY namespace.nspname, class.relname, constraint_row.contype
ORDER BY 1;`,
      ),
    ),
    EXPECTED_CONSTRAINT_COUNTS,
    "complete application constraint type counts",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT class.relname || '|' || constraint_row.conname
FROM pg_catalog.pg_constraint AS constraint_row
JOIN pg_catalog.pg_class AS class ON class.oid = constraint_row.conrelid
WHERE constraint_row.conname IN (
  'memberships_no_overlap',
  'symbol_history_no_system_overlap',
  'financial_facts_no_system_overlap',
  'theses_require_live_registered_id',
  'alert_rules_require_live_registered_id'
)
ORDER BY 1;`,
      ),
    ),
    [
      "alert_rules|alert_rules_require_live_registered_id",
      "financial_facts|financial_facts_no_system_overlap",
      "memberships|memberships_no_overlap",
      "symbol_history|symbol_history_no_system_overlap",
      "theses|theses_require_live_registered_id",
    ],
    "reviewed exclusion and live-state constraints",
  );
  assertJsonEqual(
    splitLines(
      await psqlScalar(
        containerId,
        `SELECT namespace.nspname || '.' || class.relname || '|' ||
  trigger.tgname || '|' || trigger.tgenabled::text || '|' || trigger.tgtype || '|' ||
  function_namespace.nspname || '.' || procedure.proname || '|' ||
  coalesce(
    pg_catalog.pg_get_expr(trigger.tgqual, trigger.tgrelid),
    '<none>'
  ) || '|' || pg_catalog.encode(trigger.tgargs, 'hex')
FROM pg_catalog.pg_trigger AS trigger
JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
JOIN pg_catalog.pg_proc AS procedure ON procedure.oid = trigger.tgfoid
JOIN pg_catalog.pg_namespace AS function_namespace
  ON function_namespace.oid = procedure.pronamespace
WHERE NOT trigger.tgisinternal
  AND namespace.nspname IN ('private_data', 'shared_data')
ORDER BY 1;`,
      ),
    ),
    [
      "private_data.alert_rules|alert_rules_identity_immutable|O|19|private_data.guard_live_resource_identity|<none>|",
      "private_data.alert_rules|alert_rules_tombstone_after_delete|O|9|private_data.tombstone_resource_id_after_delete|<none>|616c65727400",
      "private_data.resource_id_registry|resource_id_registry_append_only|O|27|private_data.guard_resource_id_registry|<none>|",
      "private_data.theses|theses_identity_immutable|O|19|private_data.guard_live_resource_identity|<none>|",
      "private_data.theses|theses_tombstone_after_delete|O|9|private_data.tombstone_resource_id_after_delete|<none>|74686573697300",
    ],
    "exact non-internal application trigger bindings",
  );
}

async function expectedPolicyCatalogLines(): Promise<string[]> {
  const sql = (await loadMigrationFiles())
    .map((migration) => migration.sql)
    .join("\n");
  const declaredPolicies = sql.match(/\bCREATE\s+POLICY\b/gi)?.length ?? 0;
  const lines = [
    ...sql.matchAll(
      /CREATE\s+POLICY\s+([a-z][a-z0-9_]*)\s+ON\s+([a-z_]+\.[a-z_]+)\s+FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\s+TO\s+(research_cockpit_(?:runtime|test_seed|backup))/gi,
    ),
  ].map((match) => {
    const [, policy, table, command, role] = match;
    if (!policy || !table || !command || !role) {
      throw new Error("Unable to parse a reviewed RLS policy declaration");
    }
    return `${table.toLowerCase()}|${policy.toLowerCase()}|${command.toUpperCase()}|${role.toLowerCase()}`;
  });
  if (lines.length !== declaredPolicies) {
    throw new Error(
      `Parsed ${lines.length} of ${declaredPolicies} reviewed RLS policies`,
    );
  }
  return lines.sort();
}

async function verifyContextCleanup(containerId: string): Promise<void> {
  const missing = parseJsonObject(
    await psqlScalar(
      containerId,
      runtimeWithoutContextSql(`SELECT pg_catalog.json_build_object(
  'privateRows',
    (SELECT count(*) FROM private_data.alert_rules) +
    (SELECT count(*) FROM private_data.entitlements) +
    (SELECT count(*) FROM private_data.idempotency_records) +
    (SELECT count(*) FROM private_data.memberships) +
    (SELECT count(*) FROM private_data.organization_principals) +
    (SELECT count(*) FROM private_data.organizations) +
    (SELECT count(*) FROM private_data.principals) +
    (SELECT count(*) FROM private_data.resource_id_registry) +
    (SELECT count(*) FROM private_data.theses),
  'sharedRows',
    (SELECT count(*) FROM shared_data.evidence) +
    (SELECT count(*) FROM shared_data.exchanges) +
    (SELECT count(*) FROM shared_data.financial_facts) +
    (SELECT count(*) FROM shared_data.issuers) +
    (SELECT count(*) FROM shared_data.listings) +
    (SELECT count(*) FROM shared_data.metric_definitions) +
    (SELECT count(*) FROM shared_data.rights_grants) +
    (SELECT count(*) FROM shared_data.rights_policies) +
    (SELECT count(*) FROM shared_data.securities) +
    (SELECT count(*) FROM shared_data.share_classes) +
    (SELECT count(*) FROM shared_data.symbol_history)
)::text;`),
    ),
  );
  assertJsonEqual(
    missing,
    { privateRows: 0, sharedRows: 0 },
    "missing context visibility",
  );

  const cleanup = splitLines(
    await psqlScalar(containerId, contextCleanupSql()),
  );
  assertJsonEqual(
    cleanup,
    ["cleared", "cleared", "cleared"],
    "context cleanup",
  );

  const malformed = await psqlScalar(containerId, malformedContextSql());
  assertEqual(malformed, "cleared", "malformed context side effects");
  for (const [label, arguments_, message] of [
    [
      "null principal",
      `NULL::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', 'api', 'demo_only', 'synthetic'`,
      "principal and organization context are required",
    ],
    [
      "null organization",
      `'${PRINCIPAL_ALPHA}'::uuid, NULL::uuid,
  'display', 'api', 'demo_only', 'synthetic'`,
      "principal and organization context are required",
    ],
    [
      "null purpose",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  NULL::text, 'api', 'demo_only', 'synthetic'`,
      "unsupported data purpose",
    ],
    [
      "null channel",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', NULL::text, 'demo_only', 'synthetic'`,
      "unsupported data channel",
    ],
    [
      "null territory",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', 'api', NULL::text, 'synthetic'`,
      "the static harness accepts synthetic demo context only",
    ],
    [
      "null classification",
      `'${PRINCIPAL_ALPHA}'::uuid, '${ORGANIZATION_ALPHA}'::uuid,
  'display', 'api', 'demo_only', NULL::text`,
      "the static harness accepts synthetic demo context only",
    ],
  ] as const) {
    await expectPsqlFailure(
      containerId,
      `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
CALL private_data.set_request_context(${arguments_});
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
      { label, sqlState: "P0001", message },
    );
  }
  await expectPsqlFailure(
    containerId,
    `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
SELECT pg_catalog.set_config('app.principal_id', 'not-a-uuid', true);
SELECT private_data.current_principal_id();
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
    {
      label: "malformed direct context",
      sqlState: "22P02",
      message: "invalid input syntax for type uuid",
    },
  );
}

async function verifyTenantIsolation(containerId: string): Promise<void> {
  const alpha = await privateVisibility(
    containerId,
    PRINCIPAL_ALPHA,
    ORGANIZATION_ALPHA,
  );
  assertJsonEqual(
    alpha,
    {
      principalIds: PRINCIPAL_ALPHA,
      membershipIds: `${ORGANIZATION_ALPHA}|${PRINCIPAL_ALPHA}|owner`,
      associationIds: `${ORGANIZATION_ALPHA}|${PRINCIPAL_ALPHA}`,
      organizationIds: ORGANIZATION_ALPHA,
      entitlementIds: `${ORGANIZATION_ALPHA}|30000000-0000-4000-8000-000000000001`,
      thesisIds: `${ORGANIZATION_ALPHA}|40000000-0000-4000-8000-000000000001|Synthetic Alpha thesis.`,
      alertIds: `${ORGANIZATION_ALPHA}|40000000-0000-4000-8000-000000000002|above`,
      idempotencyIds: `${ORGANIZATION_ALPHA}|synthetic-alpha-key`,
      registryIds: `${ORGANIZATION_ALPHA}|alert|40000000-0000-4000-8000-000000000002,${ORGANIZATION_ALPHA}|thesis|40000000-0000-4000-8000-000000000001`,
      evidenceIds: "evidence-display-only,evidence-full-v1",
    },
    "alpha tenant visibility",
  );
  const beta = await privateVisibility(
    containerId,
    PRINCIPAL_BETA,
    ORGANIZATION_BETA,
  );
  assertJsonEqual(
    beta,
    {
      principalIds: PRINCIPAL_BETA,
      membershipIds: `${ORGANIZATION_BETA}|${PRINCIPAL_BETA}|owner`,
      associationIds: `${ORGANIZATION_BETA}|${PRINCIPAL_BETA}`,
      organizationIds: ORGANIZATION_BETA,
      entitlementIds: `${ORGANIZATION_BETA}|30000000-0000-4000-8000-000000000002`,
      thesisIds: `${ORGANIZATION_BETA}|40000000-0000-4000-8000-000000000001|Synthetic Beta thesis.`,
      alertIds: `${ORGANIZATION_BETA}|40000000-0000-4000-8000-000000000002|below`,
      idempotencyIds: `${ORGANIZATION_BETA}|synthetic-beta-key`,
      registryIds: `${ORGANIZATION_BETA}|alert|40000000-0000-4000-8000-000000000002,${ORGANIZATION_BETA}|thesis|40000000-0000-4000-8000-000000000001`,
      evidenceIds: "evidence-display-only,evidence-full-v1",
    },
    "beta tenant visibility",
  );

  const directIsolation = parseJsonObject(
    await psqlScalar(
      containerId,
      runtimeContextSql(
        PRINCIPAL_ALPHA,
        ORGANIZATION_ALPHA,
        "display",
        "api",
        `SELECT pg_catalog.json_build_object(
  'foreignOrganization', (
    SELECT count(*) FROM private_data.organizations
    WHERE id = '${ORGANIZATION_BETA}'
  ),
  'foreignThesisJoin', (
    SELECT count(*)
    FROM private_data.theses AS thesis
    JOIN private_data.organizations AS organization
      ON organization.id = thesis.organization_id
    WHERE thesis.organization_id = '${ORGANIZATION_BETA}'
  ),
  'foreignExists', EXISTS (
    SELECT 1 FROM private_data.alert_rules
    WHERE organization_id = '${ORGANIZATION_BETA}'
  ),
  'foreignScalar', coalesce((
    SELECT slug FROM private_data.organizations
    WHERE id = '${ORGANIZATION_BETA}'
  ), '<hidden>'),
  'sameThesisIdVisible', (
    SELECT count(*) FROM private_data.theses
    WHERE id = '40000000-0000-4000-8000-000000000001'
  )
)::text;`,
      ),
    ),
  );
  assertJsonEqual(
    directIsolation,
    {
      foreignOrganization: 0,
      foreignThesisJoin: 0,
      foreignExists: false,
      foreignScalar: "<hidden>",
      sameThesisIdVisible: 1,
    },
    "direct, join, EXISTS, scalar, and duplicate-ID tenant isolation",
  );

  for (const [label, principal, expectedPrincipalRows] of [
    ["inactive", PRINCIPAL_INACTIVE, 0],
    ["no membership", PRINCIPAL_NO_MEMBERSHIP, 1],
    ["expired membership", PRINCIPAL_EXPIRED, 1],
    ["future membership", PRINCIPAL_FUTURE, 1],
  ] as const) {
    const visibility = await privateVisibility(
      containerId,
      principal,
      ORGANIZATION_ALPHA,
    );
    assertJsonEqual(
      visibility,
      {
        principalIds: expectedPrincipalRows === 1 ? principal : "<none>",
        membershipIds: "<none>",
        associationIds: "<none>",
        organizationIds: "<none>",
        entitlementIds: "<none>",
        thesisIds: "<none>",
        alertIds: "<none>",
        idempotencyIds: "<none>",
        registryIds: "<none>",
        evidenceIds: "<none>",
      },
      `${label} visibility`,
    );
  }

  const alternating = splitLines(
    await psqlScalar(containerId, alternatingPreparedStatementSql()),
  ).map((line) => parseJsonObject(line));
  assertJsonEqual(
    alternating,
    [
      { organization: ORGANIZATION_ALPHA, theses: 1 },
      { organization: ORGANIZATION_BETA, theses: 1 },
      { organization: ORGANIZATION_ALPHA, theses: 1 },
      { organization: ORGANIZATION_BETA, theses: 1 },
    ],
    "alternating prepared-statement tenant contexts",
  );
}

async function verifyOperationRights(containerId: string): Promise<void> {
  for (const expectation of [
    {
      purpose: "display",
      channel: "api",
      evidence: ["evidence-display-only", "evidence-full-v1"],
      facts:
        "fact-display-only|synthetic.display-only|1.0.0,fact-full-v1|synthetic.full|1.0.0",
    },
    {
      purpose: "derive",
      channel: "api",
      evidence: ["evidence-full-v1"],
      facts: "fact-full-v1|synthetic.full|1.0.0",
    },
    {
      purpose: "alert",
      channel: "local_alert",
      evidence: ["evidence-full-v1"],
      facts: "fact-full-v1|synthetic.full|1.0.0",
    },
  ] as const) {
    const actual = parseJsonObject(
      await psqlScalar(
        containerId,
        runtimeContextSql(
          PRINCIPAL_ALPHA,
          ORGANIZATION_ALPHA,
          expectation.purpose,
          expectation.channel,
          `SELECT pg_catalog.json_build_object(
  'evidence', (
    SELECT coalesce(
      pg_catalog.json_agg(id ORDER BY id),
      '[]'::json
    )
    FROM shared_data.evidence
  ),
  'facts', (SELECT coalesce(pg_catalog.string_agg(
    id || '|' || rights_policy_id || '|' || rights_policy_version,
    ',' ORDER BY id
  ), '<none>') FROM shared_data.financial_facts)
)::text;`,
        ),
      ),
    );
    assertJsonEqual(
      actual,
      { evidence: expectation.evidence, facts: expectation.facts },
      `${expectation.purpose}/${expectation.channel} rights visibility`,
    );
  }
}

async function verifyWriteDenials(containerId: string): Promise<void> {
  await expectPsqlFailure(
    containerId,
    runtimeContextSql(
      PRINCIPAL_ALPHA,
      ORGANIZATION_ALPHA,
      "display",
      "api",
      `INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000099',
  'runtime-write-probe',
  'Runtime write probe',
  transaction_timestamp()
);`,
    ),
    {
      label: "runtime write",
      sqlState: "42501",
      message: "permission denied for table organizations",
    },
  );
  for (const [label, sql, message] of [
    [
      "test-seed update",
      `UPDATE private_data.organizations
SET name = 'Mutation probe'
WHERE id = '${ORGANIZATION_ALPHA}';`,
      "permission denied for table organizations",
    ],
    [
      "test-seed delete",
      `DELETE FROM private_data.idempotency_records
WHERE organization_id = '${ORGANIZATION_ALPHA}';`,
      "permission denied for table idempotency_records",
    ],
    [
      "test-seed truncate",
      "TRUNCATE TABLE private_data.audit_events;",
      "permission denied for table audit_events",
    ],
    [
      "test-seed ledger read",
      "SELECT count(*) FROM shared_data.schema_migrations;",
      "permission denied for table schema_migrations",
    ],
  ] as const) {
    await expectPsqlFailure(
      containerId,
      `SET SESSION AUTHORIZATION research_cockpit_test_seed;
BEGIN;
${sql}
ROLLBACK;
RESET SESSION AUTHORIZATION;`,
      { label, sqlState: "42501", message },
    );
  }

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*) FROM private_data.organizations
WHERE id = '10000000-0000-4000-8000-000000000099';`,
    ),
    "0",
    "failed runtime write rollback",
  );
}

async function verifyAuthenticatedRuntimeSession(
  containerId: string,
): Promise<void> {
  await verifyRuntimeAuthResidueAbsent(containerId);

  const password = generateRuntimeAuthPassword();
  let wrongPassword = generateRuntimeAuthPassword();
  while (wrongPassword === password) {
    wrongPassword = generateRuntimeAuthPassword();
  }

  let probeFailed = false;
  let probeError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;
  try {
    await provisionRuntimeAuthLogin(containerId, password);
    await verifyRuntimeAuthRoleCatalog(containerId);
    await writeRuntimeAuthPassfile(
      containerId,
      RUNTIME_AUTH_PASSFILE,
      renderRuntimeAuthPassfile(password),
    );
    await writeRuntimeAuthPassfile(
      containerId,
      RUNTIME_AUTH_WRONG_PASSFILE,
      renderRuntimeAuthPassfile(wrongPassword),
    );
    await verifyRuntimeWrongPasswordRejection(containerId);
    await verifyRuntimeLoginBeforeSetRole(containerId);
    await verifyRuntimeRoleEscalationDenials(containerId);
    await verifyRuntimeAuthenticatedContext(containerId);
    await verifyRuntimeAuthenticatedWriteDenial(containerId);
  } catch (error) {
    probeFailed = true;
    probeError = error;
  } finally {
    try {
      throwRuntimeAuthOperationFailures(
        await collectRuntimeAuthOperationFailures([
          {
            label: "runtime-auth cleanup",
            run: () => cleanupRuntimeAuthProbe(containerId),
          },
          {
            label: "runtime-auth residue verification",
            run: () => verifyRuntimeAuthResidueAbsent(containerId),
          },
        ]),
        "Authenticated runtime cleanup and residue verification failed",
      );
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (probeFailed && cleanupFailed) {
    throw new AggregateError(
      [probeError, cleanupError],
      "Authenticated runtime probe and mandatory cleanup both failed",
      { cause: probeError },
    );
  }
  if (probeFailed) throw probeError;
  if (cleanupFailed) throw cleanupError;
}

async function verifyRuntimeAuthResidueAbsent(
  containerId: string,
): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    {
      label: "verify ephemeral runtime login is absent",
      run: async () => {
        assertEqual(
          await psqlScalar(
            containerId,
            `SELECT count(*)
FROM pg_catalog.pg_roles
WHERE rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
          ),
          "0",
          "ephemeral runtime login residue",
        );
      },
    },
  ];

  for (const path of [RUNTIME_AUTH_PASSFILE, RUNTIME_AUTH_WRONG_PASSFILE]) {
    operations.push(
      {
        label: `verify runtime-auth passfile is absent: ${path}`,
        run: async () => {
          const regularPath = await dockerExec(containerId, [
            "test",
            "!",
            "-e",
            path,
          ]);
          assertSuccess(regularPath, "verify runtime-auth passfile is absent");
        },
      },
      {
        label: `verify runtime-auth passfile symlink is absent: ${path}`,
        run: async () => {
          const symlinkPath = await dockerExec(containerId, [
            "test",
            "!",
            "-L",
            path,
          ]);
          assertSuccess(
            symlinkPath,
            "verify runtime-auth passfile symlink is absent",
          );
        },
      },
    );
  }

  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated runtime residue verification failed",
  );
}

async function provisionRuntimeAuthLogin(
  containerId: string,
  password: string,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    renderRuntimeAuthProvisioningSql(password),
  );
  assertSensitiveCommandSuccess(result, "provision ephemeral runtime login");
}

async function verifyRuntimeAuthRoleCatalog(
  containerId: string,
): Promise<void> {
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT rolname || '|' || rolcanlogin || '|' || rolsuper || '|' ||
  rolcreatedb || '|' || rolcreaterole || '|' || rolreplication || '|' ||
  rolinherit || '|' || rolbypassrls || '|' || rolconnlimit || '|' ||
  (rolpassword LIKE 'SCRAM-SHA-256$%')
FROM pg_catalog.pg_authid
WHERE rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
    ),
    `${RUNTIME_AUTH_LOGIN_ROLE}|true|false|false|false|false|false|false|1|true`,
    "ephemeral runtime login attributes and SCRAM verifier",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT granted_role.rolname || '|' || member_role.rolname || '|' ||
  membership.admin_option || '|' || membership.inherit_option || '|' ||
  membership.set_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE granted_role.rolname = '${RUNTIME_AUTH_LOGIN_ROLE}'
   OR member_role.rolname = '${RUNTIME_AUTH_LOGIN_ROLE}';`,
    ),
    `${RUNTIME_AUTH_CAPABILITY_ROLE}|${RUNTIME_AUTH_LOGIN_ROLE}|false|false|true`,
    "ephemeral runtime login membership",
  );

  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*)
FROM pg_catalog.pg_db_role_setting
WHERE setrole = (
  SELECT oid FROM pg_catalog.pg_roles
  WHERE rolname = '${RUNTIME_AUTH_LOGIN_ROLE}'
);`,
    ),
    "0",
    "ephemeral runtime login role settings",
  );
}

async function writeRuntimeAuthPassfile(
  containerId: string,
  path: typeof RUNTIME_AUTH_PASSFILE | typeof RUNTIME_AUTH_WRONG_PASSFILE,
  contents: string,
): Promise<void> {
  const install = await dockerExec(containerId, [
    "install",
    "--mode=0600",
    "/dev/null",
    path,
  ]);
  assertSensitiveCommandSuccess(install, "create runtime-auth passfile");
  const write = await dockerExec(
    containerId,
    ["dd", `of=${path}`, "status=none"],
    contents,
  );
  assertSensitiveCommandSuccess(write, "write runtime-auth passfile");
  const regularFile = await dockerExec(containerId, ["test", "-f", path]);
  assertSuccess(regularFile, "verify runtime-auth passfile type");
  const symlink = await dockerExec(containerId, ["test", "!", "-L", path]);
  assertSuccess(symlink, "verify runtime-auth passfile is not a symlink");
  const mode = await dockerExec(containerId, ["stat", "--format=%a", path]);
  assertSuccess(mode, "inspect runtime-auth passfile mode");
  assertEqual(mode.stdout.trim(), "600", "runtime-auth passfile mode");
}

async function verifyRuntimeWrongPasswordRejection(
  containerId: string,
): Promise<void> {
  const result = await runtimeAuthenticatedPsql(
    containerId,
    RUNTIME_AUTH_WRONG_PASSFILE,
    "SELECT 1;",
    { requireScram: false },
  );
  assertRuntimeWrongPasswordRejection(result);
}

async function verifyRuntimeLoginBeforeSetRole(
  containerId: string,
): Promise<void> {
  const identity = parseJsonObject(
    await runtimeAuthenticatedPsqlScalar(
      containerId,
      `SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'clientAddress', pg_catalog.inet_client_addr()::text,
  'serverAddress', pg_catalog.inet_server_addr()::text,
  'ssl', EXISTS (
    SELECT 1
    FROM pg_catalog.pg_stat_ssl
    WHERE pid = pg_catalog.pg_backend_pid() AND ssl
  ),
  'runtimeMember', pg_catalog.pg_has_role(
    session_user, '${RUNTIME_AUTH_CAPABILITY_ROLE}', 'MEMBER'
  ),
  'runtimeUsage', pg_catalog.pg_has_role(
    session_user, '${RUNTIME_AUTH_CAPABILITY_ROLE}', 'USAGE'
  ),
  'runtimeSet', pg_catalog.pg_has_role(
    session_user, '${RUNTIME_AUTH_CAPABILITY_ROLE}', 'SET'
  )
)::text;`,
    ),
  );
  assertJsonEqual(
    identity,
    {
      sessionUser: RUNTIME_AUTH_LOGIN_ROLE,
      currentUser: RUNTIME_AUTH_LOGIN_ROLE,
      systemUser: `scram-sha-256:${RUNTIME_AUTH_LOGIN_ROLE}`,
      clientAddress: "127.0.0.1",
      serverAddress: "127.0.0.1",
      ssl: false,
      runtimeMember: true,
      runtimeUsage: false,
      runtimeSet: true,
    },
    "authenticated runtime login identity before SET ROLE",
  );

  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    "SELECT count(*) FROM private_data.organizations;",
    {
      label: "runtime login data access before SET ROLE",
      sqlState: "42501",
      message: "permission denied for schema private_data",
    },
  );
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    `CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);`,
    {
      label: "runtime login context call before SET ROLE",
      sqlState: "42501",
      message: "permission denied for schema private_data",
    },
  );
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    "CREATE TEMPORARY TABLE runtime_auth_escape (id integer);",
    {
      label: "runtime login temporary table before SET ROLE",
      sqlState: "42501",
      message: "permission denied to create temporary tables",
    },
  );
}

async function verifyRuntimeRoleEscalationDenials(
  containerId: string,
): Promise<void> {
  for (const role of RUNTIME_AUTH_FORBIDDEN_SET_ROLES) {
    await expectRuntimeAuthenticatedPsqlFailure(
      containerId,
      `SET ROLE ${role};`,
      {
        label: `runtime login SET ROLE ${role}`,
        sqlState: "42501",
        message: "permission denied to set role",
      },
    );
  }
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    "SET SESSION AUTHORIZATION postgres;",
    {
      label: "runtime login SET SESSION AUTHORIZATION postgres",
      sqlState: "42501",
      message: "permission denied to set session authorization",
    },
  );
}

async function verifyRuntimeAuthenticatedContext(
  containerId: string,
): Promise<void> {
  const resetState = (label: string) => `SELECT CASE
  WHEN current_user = session_user
    AND ${requestContextClearedExpression()}
  THEN '${label}-cleared'
  ELSE '${label}-leaked'
END;`;
  const result = splitLines(
    await runtimeAuthenticatedPsqlScalar(
      containerId,
      `BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
SELECT pg_catalog.json_build_object(
  'organizations', (SELECT count(*) FROM private_data.organizations),
  'evidence', (SELECT count(*) FROM shared_data.evidence),
  'theses', (SELECT count(*) FROM private_data.theses)
)::text;
ROLLBACK;
${resetState("missing-context")}
BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);
SELECT pg_catalog.json_build_object(
  'sessionUser', session_user,
  'currentUser', current_user,
  'systemUser', system_user,
  'organizations', (
    SELECT count(*) FROM private_data.organizations
  ),
  'foreignOrganizations', (
    SELECT count(*) FROM private_data.organizations
    WHERE id = '${ORGANIZATION_BETA}'
  ),
  'theses', (SELECT count(*) FROM private_data.theses),
  'foreignTheses', (
    SELECT count(*) FROM private_data.theses
    WHERE organization_id = '${ORGANIZATION_BETA}'
  )
)::text;
COMMIT;
${resetState("commit")}
BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_BETA}', '${ORGANIZATION_BETA}',
  'derive', 'api', 'demo_only', 'synthetic'
);
ROLLBACK;
${resetState("rollback")}
BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'alert', 'local_alert', 'demo_only', 'synthetic'
);
DO $handled_runtime_auth_error$
BEGIN
  BEGIN
    PERFORM 1 / 0;
  EXCEPTION WHEN division_by_zero THEN
    NULL;
  END;
END;
$handled_runtime_auth_error$;
COMMIT;
${resetState("error")}`,
    ),
  );
  if (result.length !== 6 || !result[0] || !result[2]) {
    throw new Error("Authenticated runtime context probe returned wrong shape");
  }
  assertJsonEqual(
    parseJsonObject(result[0]),
    { organizations: 0, evidence: 0, theses: 0 },
    "authenticated runtime missing-context visibility",
  );
  assertEqual(
    result[1] ?? "",
    "missing-context-cleared",
    "authenticated runtime missing-context rollback",
  );
  assertJsonEqual(
    parseJsonObject(result[2]),
    {
      sessionUser: RUNTIME_AUTH_LOGIN_ROLE,
      currentUser: RUNTIME_AUTH_CAPABILITY_ROLE,
      systemUser: `scram-sha-256:${RUNTIME_AUTH_LOGIN_ROLE}`,
      organizations: 1,
      foreignOrganizations: 0,
      theses: 1,
      foreignTheses: 0,
    },
    "authenticated runtime tenant read",
  );
  assertJsonEqual(
    result.slice(3),
    ["commit-cleared", "rollback-cleared", "error-cleared"],
    "authenticated runtime role and context cleanup",
  );
}

async function verifyRuntimeAuthenticatedWriteDenial(
  containerId: string,
): Promise<void> {
  await expectRuntimeAuthenticatedPsqlFailure(
    containerId,
    `BEGIN;
SET LOCAL ROLE ${RUNTIME_AUTH_CAPABILITY_ROLE};
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);
INSERT INTO private_data.organizations (id, slug, name, created_at)
VALUES (
  '10000000-0000-4000-8000-000000000097',
  'authenticated-runtime-write-probe',
  'Authenticated runtime write probe',
  transaction_timestamp()
);`,
    {
      label: "authenticated runtime write",
      sqlState: "42501",
      message: "permission denied for table organizations",
    },
  );
  assertEqual(
    await psqlScalar(
      containerId,
      `SELECT count(*) FROM private_data.organizations
WHERE id = '10000000-0000-4000-8000-000000000097';`,
    ),
    "0",
    "failed authenticated runtime write rollback",
  );
}

async function cleanupRuntimeAuthProbe(containerId: string): Promise<void> {
  const operations: RuntimeAuthBestEffortOperation[] = [
    ...[RUNTIME_AUTH_PASSFILE, RUNTIME_AUTH_WRONG_PASSFILE].map((path) => ({
      label: `remove runtime-auth passfile: ${path}`,
      run: async () => {
        const remove = await dockerExec(containerId, ["rm", "-f", "--", path]);
        assertSuccess(remove, "remove runtime-auth passfile");
      },
    })),
    {
      label: "drop ephemeral runtime login",
      run: async () => {
        await psql(containerId, renderRuntimeAuthCleanupSql());
      },
    },
  ];

  throwRuntimeAuthOperationFailures(
    await collectRuntimeAuthOperationFailures(operations),
    "Authenticated runtime cleanup failed",
  );
}

async function runtimeAuthenticatedPsqlScalar(
  containerId: string,
  sql: string,
): Promise<string> {
  const result = await runtimeAuthenticatedPsql(
    containerId,
    RUNTIME_AUTH_PASSFILE,
    sql,
  );
  assertSuccess(result, "execute authenticated runtime SQL");
  return result.stdout.trim();
}

async function expectRuntimeAuthenticatedPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
): Promise<void> {
  const result = await runtimeAuthenticatedPsql(
    containerId,
    RUNTIME_AUTH_PASSFILE,
    sql,
    { verboseErrors: true },
  );
  assertExpectedPsqlFailure(result, expectation);
}

async function runtimeAuthenticatedPsql(
  containerId: string,
  passfile: typeof RUNTIME_AUTH_PASSFILE | typeof RUNTIME_AUTH_WRONG_PASSFILE,
  sql: string,
  options: RuntimeAuthPsqlInvocationOptions = {},
): Promise<CommandResult> {
  const invocation = buildRuntimeAuthPsqlInvocation(passfile, options);
  return runRuntimeAuthCommandWithDrain(
    () =>
      dockerExecWithEnvironment(
        containerId,
        invocation.environment,
        invocation.command,
        sql,
      ),
    () => waitForRuntimeAuthBackendDrain(containerId),
  );
}

async function waitForRuntimeAuthBackendDrain(
  containerId: string,
): Promise<void> {
  await psql(containerId, renderRuntimeAuthBackendDrainSql());
}

function assertSensitiveCommandSuccess(
  result: CommandResult,
  operation: string,
): void {
  if (result.exitCode !== 0) {
    throw new Error(`${operation} failed with exit ${result.exitCode}`);
  }
}

async function privateVisibility(
  containerId: string,
  principalId: string,
  organizationId: string,
): Promise<PrivateVisibility> {
  return parseJsonObject(
    await psqlScalar(
      containerId,
      runtimeContextSql(
        principalId,
        organizationId,
        "display",
        "api",
        `SELECT pg_catalog.json_build_object(
  'principalIds', (SELECT coalesce(
    pg_catalog.string_agg(id::text, ',' ORDER BY id), '<none>'
  ) FROM private_data.principals),
  'membershipIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || principal_id::text || '|' || role,
    ',' ORDER BY organization_id, principal_id, active_from
  ), '<none>') FROM private_data.memberships),
  'associationIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || principal_id::text,
    ',' ORDER BY organization_id, principal_id
  ), '<none>') FROM private_data.organization_principals),
  'organizationIds', (SELECT coalesce(
    pg_catalog.string_agg(id::text, ',' ORDER BY id), '<none>'
  ) FROM private_data.organizations),
  'entitlementIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || id::text,
    ',' ORDER BY organization_id, id
  ), '<none>') FROM private_data.entitlements),
  'thesisIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || id::text || '|' || claim,
    ',' ORDER BY organization_id, id
  ), '<none>') FROM private_data.theses),
  'alertIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || id::text || '|' || operator,
    ',' ORDER BY organization_id, id
  ), '<none>') FROM private_data.alert_rules),
  'idempotencyIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || idempotency_key,
    ',' ORDER BY organization_id, idempotency_key
  ), '<none>') FROM private_data.idempotency_records),
  'registryIds', (SELECT coalesce(pg_catalog.string_agg(
    organization_id::text || '|' || resource_type || '|' || resource_id::text,
    ',' ORDER BY organization_id, resource_type, resource_id
  ), '<none>') FROM private_data.resource_id_registry),
  'evidenceIds', (SELECT coalesce(
    pg_catalog.string_agg(id, ',' ORDER BY id), '<none>'
  ) FROM shared_data.evidence)
)::text;`,
      ),
    ),
  ) as unknown as PrivateVisibility;
}

function runtimeContextSql(
  principalId: string,
  organizationId: string,
  purpose: "display" | "derive" | "alert",
  channel: "api" | "local_alert",
  statement: string,
): string {
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
CALL private_data.set_request_context(
  '${principalId}',
  '${organizationId}',
  '${purpose}',
  '${channel}',
  'demo_only',
  'synthetic'
);
${statement}
COMMIT;
RESET SESSION AUTHORIZATION;`;
}

function runtimeWithoutContextSql(statement: string): string {
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
${statement}
ROLLBACK;
RESET SESSION AUTHORIZATION;`;
}

function contextCleanupSql(): string {
  const cleanupProbe = `SELECT CASE
  WHEN ${requestContextClearedExpression()} THEN 'cleared'
  ELSE 'leaked'
END;`;
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'display', 'api', 'demo_only', 'synthetic'
);
COMMIT;
${cleanupProbe}
BEGIN;
CALL private_data.set_request_context(
  '${PRINCIPAL_BETA}', '${ORGANIZATION_BETA}',
  'derive', 'api', 'demo_only', 'synthetic'
);
ROLLBACK;
${cleanupProbe}
BEGIN;
CALL private_data.set_request_context(
  '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
  'alert', 'local_alert', 'demo_only', 'synthetic'
);
DO $handled_error$
BEGIN
  BEGIN
    PERFORM 1 / 0;
  EXCEPTION WHEN division_by_zero THEN
    NULL;
  END;
END;
$handled_error$;
COMMIT;
${cleanupProbe}
RESET SESSION AUTHORIZATION;`;
}

function malformedContextSql(): string {
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
BEGIN;
DO $malformed_context$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    CALL private_data.set_request_context(
      '${PRINCIPAL_ALPHA}', '${ORGANIZATION_ALPHA}',
      'unsupported', 'api', 'demo_only', 'synthetic'
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unsupported data purpose' THEN
      RAISE;
    END IF;
    rejected := true;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'malformed context was accepted';
  END IF;
END;
$malformed_context$;
SELECT CASE WHEN
    ${requestContextClearedExpression()}
  THEN 'cleared' ELSE 'leaked' END;
ROLLBACK;
RESET SESSION AUTHORIZATION;`;
}

function requestContextClearedExpression(): string {
  const settings = [
    "principal_id",
    "organization_id",
    "purpose",
    "channel",
    "territory",
    "data_classification",
  ];
  const cleared = settings
    .map(
      (setting) =>
        `coalesce(nullif(pg_catalog.current_setting('app.${setting}', true), ''), '<null>') = '<null>'`,
    )
    .join(" AND\n    ");
  return cleared;
}

function alternatingPreparedStatementSql(): string {
  const executeFor = (principal: string, organization: string) => `BEGIN;
CALL private_data.set_request_context(
  '${principal}', '${organization}',
  'display', 'api', 'demo_only', 'synthetic'
);
EXECUTE tenant_visibility;
COMMIT;`;
  return `SET SESSION AUTHORIZATION research_cockpit_runtime;
PREPARE tenant_visibility AS
SELECT pg_catalog.json_build_object(
  'organization', (SELECT id FROM private_data.organizations),
  'theses', (SELECT count(*) FROM private_data.theses)
)::text;
${executeFor(PRINCIPAL_ALPHA, ORGANIZATION_ALPHA)}
${executeFor(PRINCIPAL_BETA, ORGANIZATION_BETA)}
${executeFor(PRINCIPAL_ALPHA, ORGANIZATION_ALPHA)}
${executeFor(PRINCIPAL_BETA, ORGANIZATION_BETA)}
DEALLOCATE tenant_visibility;
RESET SESSION AUTHORIZATION;`;
}

async function psqlScalar(containerId: string, sql: string): Promise<string> {
  const result = await psql(containerId, sql);
  return result.stdout.trim();
}

async function psql(containerId: string, sql: string): Promise<CommandResult> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    sql,
  );
  assertSuccess(result, "execute reviewed PostgreSQL acceptance SQL");
  return result;
}

async function expectPsqlFailure(
  containerId: string,
  sql: string,
  expectation: PsqlFailureExpectation,
): Promise<void> {
  const result = await dockerExec(
    containerId,
    [
      "psql",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
      "--username=postgres",
      `--dbname=${CLEAN_BOOTSTRAP_DATABASE_NAME}`,
    ],
    sql,
  );
  assertExpectedPsqlFailure(result, expectation);
}

export function assertExpectedPsqlFailure(
  result: CommandResult,
  expectation: PsqlFailureExpectation,
): void {
  if (result.exitCode === 0) {
    throw new Error(`${expectation.label} unexpectedly succeeded`);
  }
  if (!result.stderr.includes(expectation.sqlState)) {
    throw new Error(
      `${expectation.label} failed with the wrong SQLSTATE: ${result.stderr.trim()}`,
    );
  }
  if (
    !result.stderr.toLowerCase().includes(expectation.message.toLowerCase())
  ) {
    throw new Error(
      `${expectation.label} failed for the wrong reason: ${result.stderr.trim()}`,
    );
  }
}

async function dockerExec(
  containerId: string,
  command: readonly string[],
  input?: string,
): Promise<CommandResult> {
  return executeDocker(
    ["exec", ...(input === undefined ? [] : ["-i"]), containerId, ...command],
    input,
  );
}

async function dockerExecWithEnvironment(
  containerId: string,
  environment: Readonly<Record<string, string>>,
  command: readonly string[],
  input?: string,
): Promise<CommandResult> {
  const environmentArguments = Object.entries(environment).flatMap(
    ([name, value]) => ["--env", `${name}=${value}`],
  );
  return executeDocker(
    [
      "exec",
      ...(input === undefined ? [] : ["-i"]),
      ...environmentArguments,
      containerId,
      ...command,
    ],
    input,
  );
}

async function executeDocker(
  arguments_: readonly string[],
  input?: string,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", arguments_, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(input);
  });
}

async function executeGit(
  arguments_: readonly string[],
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", arguments_, {
      cwd: repositoryRoot,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function parseImageConfig(value: unknown): AcceptanceImageConfig {
  if (!isRecord(value))
    throw new Error("PostgreSQL image config must be an object");
  const expectedKeys = [
    "schemaVersion",
    "repository",
    "tag",
    "indexDigest",
    "reference",
    "mediaType",
    "expectedServerVersion",
    "expectedServerVersionNumber",
    "databaseName",
    "workflowSha256",
    "fixtureSha256",
    "verifiedOn",
    "runner",
  ];
  if (!sameStrings(Object.keys(value).sort(), expectedKeys.sort())) {
    throw new Error(
      "PostgreSQL image config contains missing or unexpected fields",
    );
  }
  if (!isRecord(value.runner)) {
    throw new Error("PostgreSQL image runner config must be an object");
  }
  if (
    value.schemaVersion !== 1 ||
    value.repository !== "docker.io/library/postgres" ||
    value.tag !== "17.11-bookworm" ||
    value.indexDigest !==
      "sha256:84560e3b9c6874893fc4e2854f5dc3e7c1a37bc9d1dfd7a8c641310ae22ba5ad" ||
    value.reference !== EXPECTED_IMAGE_REFERENCE ||
    value.mediaType !== "application/vnd.oci.image.index.v1+json" ||
    value.expectedServerVersion !== EXPECTED_SERVER_VERSION ||
    value.expectedServerVersionNumber !== 170011 ||
    value.databaseName !== CLEAN_BOOTSTRAP_DATABASE_NAME ||
    value.workflowSha256 !==
      "f49462e77c9a902954cef053d741d73429e1c3c25519eed69b65a75c1e673239" ||
    value.fixtureSha256 !==
      "69974bf2996cbdd0078d509db933fe89d670005e177b7f57187df54b201b99bf" ||
    typeof value.verifiedOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedOn) ||
    value.runner.label !== "ubuntu-24.04" ||
    value.runner.os !== "linux" ||
    value.runner.architecture !== "amd64" ||
    !sameStrings(
      Object.keys(value.runner).sort(),
      ["label", "os", "architecture"].sort(),
    )
  ) {
    throw new Error("PostgreSQL image config does not match the reviewed pin");
  }
  return value as unknown as AcceptanceImageConfig;
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) throw new Error("Expected a PostgreSQL JSON object");
  return parsed;
}

function assertRuntimeAuthPassword(password: string): void {
  if (
    password.length !== 43 ||
    !BASE64URL_RUNTIME_AUTH_PASSWORD.test(password)
  ) {
    throw new Error(
      "Runtime-auth password must be a 32-byte base64url value without padding",
    );
  }
}

function assertSuccess(result: CommandResult, operation: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${operation} failed with exit ${result.exitCode}: ${result.stderr.trim()}`,
    );
  }
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label} mismatch: expected ${expected}, received ${actual}`,
    );
  }
}

function assertJsonEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function requireText(
  value: string,
  marker: string,
  message: string,
  violations: string[],
): void {
  if (!value.includes(marker)) violations.push(message);
}

function inspectEvidenceUploadStep(workflow: string): string[] {
  const violations: string[] = [];
  const uploadSteps = workflowStepBlocks(workflow).filter((step) =>
    /^\s*uses:\s*actions\/upload-artifact(?:@|\s|$)/m.test(step),
  );
  if (uploadSteps.length !== 1) {
    violations.push(
      "workflow must define exactly one PostgreSQL evidence upload step",
    );
    return violations;
  }

  const uploadStep = uploadSteps[0];
  if (!uploadStep) return violations;
  for (const [line, message] of [
    [
      "      - name: Upload PostgreSQL acceptance evidence",
      "evidence upload step must retain its reviewed identity",
    ],
    [
      "        if: ${{ success() }}",
      "evidence upload must run only after successful acceptance",
    ],
    [
      `        uses: ${EXPECTED_UPLOAD_ARTIFACT_ACTION} # v7.0.1`,
      "evidence upload action must use the reviewed immutable SHA",
    ],
    [
      `          name: ${EXPECTED_EVIDENCE_ARTIFACT_NAME}`,
      "evidence artifact name must include the commit SHA and run attempt",
    ],
    [
      `          path: ${EXPECTED_EVIDENCE_ARTIFACT_PATH}`,
      "evidence upload path must be the exact runner-temporary evidence file",
    ],
    [
      "          if-no-files-found: error",
      "evidence upload must fail when the evidence file is missing",
    ],
    [
      "          retention-days: 30",
      "evidence artifact retention must be exactly 30 days",
    ],
  ] as const) {
    if (!uploadStep.split("\n").includes(line)) violations.push(message);
  }
  if (/^\s*continue-on-error\s*:/m.test(uploadStep)) {
    violations.push("evidence upload must not continue on error");
  }
  return violations;
}

function workflowStepBlocks(workflow: string): string[] {
  const lines = workflow.replaceAll("\r\n", "\n").split("\n");
  const steps: string[] = [];
  let step: string[] | undefined;
  for (const line of lines) {
    if (/^ {6}- /.test(line)) {
      if (step) steps.push(step.join("\n"));
      step = [line];
    } else if (step) {
      step.push(line);
    }
  }
  if (step) steps.push(step.join("\n"));
  return steps;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedSha256(value: string): string {
  return createHash("sha256")
    .update(value.replaceAll("\r\n", "\n"))
    .digest("hex");
}

function inspectInsertOnlyFixture(sql: string): string[] {
  const violations: string[] = [];
  const visible = maskSqlQuotedContent(sql);
  if (visible.includes("\\")) {
    violations.push("synthetic fixture must not contain psql meta-commands");
  }
  const statements = visible
    .split(";")
    .map((statement) => statement.trim().replace(/\s+/g, " "))
    .filter((statement) => statement.length > 0);
  if (
    statements[0] !== "SET SESSION AUTHORIZATION research_cockpit_test_seed"
  ) {
    violations.push(
      "synthetic fixture must assume test-seed authorization first",
    );
  }
  if (statements[1] !== "BEGIN") {
    violations.push(
      "synthetic fixture must open exactly one transaction second",
    );
  }
  if (statements.at(-2) !== "COMMIT") {
    violations.push("synthetic fixture must commit after its final insert");
  }
  if (statements.at(-1) !== "RESET SESSION AUTHORIZATION") {
    violations.push("synthetic fixture must reset authorization last");
  }

  const allowedTables = [
    "private_data.organizations",
    "private_data.principals",
    "private_data.organization_principals",
    "private_data.memberships",
    "private_data.entitlements",
    "shared_data.rights_policies",
    "shared_data.rights_grants",
    "shared_data.issuers",
    "shared_data.securities",
    "shared_data.share_classes",
    "shared_data.exchanges",
    "shared_data.listings",
    "shared_data.symbol_history",
    "shared_data.evidence",
    "shared_data.financial_facts",
    "shared_data.metric_definitions",
    "private_data.resource_id_registry",
    "private_data.theses",
    "private_data.alert_rules",
    "private_data.idempotency_records",
    "private_data.audit_events",
  ] as const;
  const inserts = statements.slice(2, -2);
  const actualTables: string[] = [];
  for (const statement of inserts) {
    const table = /^INSERT INTO ([a-z_]+\.[a-z_]+) \(/i.exec(statement)?.[1];
    if (!table) {
      violations.push(
        "synthetic fixture may contain only direct INSERT statements",
      );
      continue;
    }
    actualTables.push(table.toLowerCase());
  }
  if (!sameStrings(actualTables, allowedTables)) {
    violations.push(
      "synthetic fixture table order must match the reviewed allowlist",
    );
  }
  return violations;
}
