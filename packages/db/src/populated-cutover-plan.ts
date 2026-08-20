import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUTHENTICATED_MIGRATION_OWNER_ROLE,
  AUTHENTICATED_MIGRATOR_LOGIN_ROLE,
  snapshotAuthenticatedMigrationPlan,
  type AuthenticatedMigrationPlan,
} from "./authenticated-migration-plan";
import {
  snapshotPrivacyRetentionPlanV1,
  type PrivacyRetentionPlanV1,
} from "./privacy-retention-plan";

export const POPULATED_CUTOVER_PLAN_VERSION = 1 as const;
export const POPULATED_CUTOVER_PLAN_RELATIVE_DIRECTORY =
  "populated-cutover-plans/v1" as const;
export const POPULATED_CUTOVER_PLAN_MANIFEST_FILE = "manifest.json" as const;
export const POPULATED_CUTOVER_PLAN_PLATFORM_FILE =
  "platform-bootstrap.sql" as const;
export const POPULATED_CUTOVER_PLAN_APPLICATION_DIRECTORY =
  "application" as const;
export const POPULATED_CUTOVER_PLAN_APPLICATION_FILES = Object.freeze([
  "application/0001_expand_capture_and_backfill.sql",
  "application/0002_validate_and_contract.sql",
] as const);
export const POPULATED_CUTOVER_PLAN_MIGRATION_IDS = Object.freeze([
  "populated-cutover-v1-0001",
  "populated-cutover-v1-0002",
] as const);
export const POPULATED_CUTOVER_PLAN_PHASES = Object.freeze([
  "expand_capture_backfill",
  "validate_contract",
] as const);
export const POPULATED_CUTOVER_PLAN_PLATFORM_SHA256 =
  "63524caa33c8c05e4ea653fbfcbf23e29f43028af34f8d3b297abdb1048dfc0c" as const;
export const POPULATED_CUTOVER_PLAN_APPLICATION_SHA256 = Object.freeze([
  "c7d876614be5bcfe4a7339e75cf14046c63a4bb4ea5d4d109a1ab582f3c70431",
  "60b38c8f2c91363408e2c3544b68181234d19bccf4a72de5d54023ba42ba7f64",
] as const);
export const POPULATED_CUTOVER_PLAN_MANIFEST_SHA256 =
  "7aa43475461ab2c0b27dc2cbada9290ee1959495ee08d4137e2e8cfe81677dec" as const;
export const POPULATED_CUTOVER_FIXTURE_RELATIVE_FILE =
  "acceptance/populated-cutover-fixture.sql" as const;
export const POPULATED_CUTOVER_FIXTURE_SHA256 =
  "f30651fd5b847a6d1b365830c32335c98ff8106f49200dc40b4f33494a583198" as const;

export const POPULATED_CUTOVER_DATABASE_NAME =
  "research_cockpit_b14_populated_cutover_test" as const;
export const POPULATED_CUTOVER_CAPABILITY_ROLE =
  "research_cockpit_populated_cutover" as const;
export const POPULATED_CUTOVER_ACCEPTANCE_LOGIN_ROLE =
  "research_cockpit_b14_populated_cutover_login" as const;
export const POPULATED_CUTOVER_ADVISORY_LOCK_KEY =
  "818476709640328254" as const;
export const POPULATED_CUTOVER_CLAIM_BATCH_ROWS = 32 as const;
export const POPULATED_CUTOVER_CONTRACT_MAX_ATTEMPTS = 3 as const;
export const POPULATED_CUTOVER_CONTRACT_DEADLINE_MILLISECONDS = 10_000 as const;
export const POPULATED_CUTOVER_INJECTED_FAILURE_SQLSTATE = "22012" as const;
export const POPULATED_CUTOVER_CAPTURE_CHANGED_SQLSTATE = "P0001" as const;
export const POPULATED_CUTOVER_BASE_IDENTITY_MARKER =
  "b14-populated-cutover-base-identity-ok" as const;
export const POPULATED_CUTOVER_EXPAND_IDENTITY_MARKER =
  "b14-populated-cutover-expand-identity-ok" as const;
export const POPULATED_CUTOVER_CONTRACT_BARRIER_MARKER =
  "b14-populated-cutover-contract-barrier-ok" as const;
export const POPULATED_CUTOVER_CONTRACT_IDENTITY_MARKER =
  "b14-populated-cutover-contract-identity-ok" as const;
export const POPULATED_CUTOVER_ROLE_RESET_MARKER =
  "b14-populated-cutover-role-reset-ok" as const;

export const POPULATED_CUTOVER_BASE_MANIFEST_FILE =
  "../../migration-plans/v2/application-manifest.json" as const;
export const POPULATED_CUTOVER_BASE_MANIFEST_SHA256 =
  "633edec9283a7767a37a1b5c67d5376036fa1d422d884288e28019caae74fb35" as const;
export const POPULATED_CUTOVER_BASE_SELECTED_IDS = Object.freeze([
  "v2-0001",
  "v2-0002",
  "v2-0003",
  "v2-0004",
  "v2-0006",
] as const);
export const POPULATED_CUTOVER_BASE_SELECTED_FILES = Object.freeze([
  "0001_request_context_and_ledger.sql",
  "0002_canonical_entities.sql",
  "0003_temporal_constraints_and_indexes.sql",
  "0004_row_security_and_runtime_grants.sql",
  "0006_null_safe_request_context.sql",
] as const);
export const POPULATED_CUTOVER_BASE_SELECTED_SHA256 = Object.freeze([
  "37d69e26b370e6a0c9f191e6f46a8d59579612f67c16f918e2ed78a5eb399e2f",
  "272dce4b0d91e96f58442896621b2d570e8e027fbfc843f83de5f36c005154f6",
  "d7a1a3d1991cb0a531a1643111fb8192dfad546efa4aa4913d0d8f8f34fed4d2",
  "ecaf289311eea9a58d8c4e4f342e9f7e40f86f0b05fdebc9d50975aa672930eb",
  "b3da4be6401accbd0140f0fe9a85d04d4093a06448eab129aa1c9c78be363f91",
] as const);
export const POPULATED_CUTOVER_BASE_EXCLUDED_ID = "v2-0005" as const;
export const POPULATED_CUTOVER_BASE_EXCLUDED_FILE =
  "0005_non_reusable_resource_ids.sql" as const;
export const POPULATED_CUTOVER_BASE_EXCLUDED_SHA256 =
  "703205835c4689350ec0d49d4377adaa08dc2abdcc63bf669dda8dee7049d61d" as const;
export const POPULATED_CUTOVER_BASE_EXCLUDED_REASON =
  "replaced_by_audited_populated_cutover" as const;

export const POPULATED_CUTOVER_TARGET_MANIFEST_FILE =
  "../../privacy-retention-plans/v1/manifest.json" as const;
export const POPULATED_CUTOVER_TARGET_MANIFEST_SHA256 =
  "28f0b9f0a3fb5981fc5c96cf9f5544e189fdc63a5e9c72c20fda1e01f8f702d7" as const;
export const POPULATED_CUTOVER_TARGET_POLICY_FILE =
  "../../privacy-retention-plans/v1/policy.json" as const;
export const POPULATED_CUTOVER_TARGET_POLICY_SHA256 =
  "6bc14df7cd812a5e41107f7db4ad099d634cd24ac71eea36e528289bd5990b32" as const;
export const POPULATED_CUTOVER_TARGET_APPLICATION_FILE =
  "../../privacy-retention-plans/v1/application/0001_keyed_resource_identifier_lifecycle.sql" as const;
export const POPULATED_CUTOVER_TARGET_APPLICATION_SHA256 =
  "87df05b88653621b1999343786de0c3a60d0f5e7468348dc24269d6ae493af62" as const;

const EXPAND_ALLOCATION_MARKER =
  "-- __POPULATED_CUTOVER_TARGET_ALLOCATION_FUNCTION__";
const CONTRACT_FINALIZATION_MARKER =
  "-- __POPULATED_CUTOVER_TARGET_FINALIZATION__";
const CONTRACT_EPOCH_MARKER = "__POPULATED_CUTOVER_EXPECTED_CAPTURE_EPOCH__";
const TARGET_FINALIZATION_START =
  "CREATE OR REPLACE FUNCTION private_data.guard_live_resource_identity()";
const TARGET_IDENTITY_TRIGGER_INSERTION_ANCHOR =
  "CREATE FUNCTION private_data.guard_resource_privacy_domain()";
const TARGET_ALLOCATION_START =
  "CREATE FUNCTION private_data.allocate_resource_identifier(";
const TARGET_ALLOCATION_END =
  "CREATE FUNCTION private_data.delete_live_resource_by_allocation(";
const EXCLUDED_IDENTITY_TRIGGERS_START =
  "CREATE TRIGGER theses_identity_immutable";
const EXCLUDED_IDENTITY_TRIGGERS_END =
  "CREATE TRIGGER theses_tombstone_after_delete";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const reviewedPlanRoot = join(
  packageRoot,
  "populated-cutover-plans",
  `v${POPULATED_CUTOVER_PLAN_VERSION}`,
);
const reviewedFixtureFile = join(
  packageRoot,
  "acceptance",
  "populated-cutover-fixture.sql",
);

export interface PopulatedCutoverManifestMigrationReferenceV1 {
  readonly id: string;
  readonly file: string;
  readonly sha256: string;
}

export interface PopulatedCutoverManifestEntryV1 extends PopulatedCutoverManifestMigrationReferenceV1 {
  readonly phase: (typeof POPULATED_CUTOVER_PLAN_PHASES)[number];
}

export interface PopulatedCutoverPlanManifestV1 {
  readonly schemaVersion: 1;
  readonly planVersion: 1;
  readonly algorithm: "sha256";
  readonly platform: Readonly<{ file: string; sha256: string }>;
  readonly base: Readonly<{
    planVersion: 2;
    manifestFile: string;
    manifestSha256: string;
    selectedMigrations: readonly PopulatedCutoverManifestMigrationReferenceV1[];
    excludedMigration: Readonly<
      PopulatedCutoverManifestMigrationReferenceV1 & { reason: string }
    >;
  }>;
  readonly target: Readonly<{
    privacyPlanVersion: 1;
    manifestFile: string;
    manifestSha256: string;
    policyFile: string;
    policySha256: string;
    applicationFile: string;
    applicationSha256: string;
  }>;
  readonly migrations: readonly PopulatedCutoverManifestEntryV1[];
}

export interface PopulatedCutoverPlanFileV1 {
  readonly file: (typeof POPULATED_CUTOVER_PLAN_APPLICATION_FILES)[number];
  readonly sql: string;
}

export interface PopulatedCutoverPlanV1 {
  readonly platformSql: string;
  readonly manifest: PopulatedCutoverPlanManifestV1;
  readonly applicationFiles: readonly PopulatedCutoverPlanFileV1[];
}

export interface PopulatedCutoverLedgerRowV1 {
  readonly migrationId: string;
  readonly fileName: string;
  readonly sha256: string;
}

export interface PopulatedCutoverFixtureResourceV1 {
  readonly organizationId: string;
  readonly privacyDomainId: string;
  readonly resourceType: "thesis" | "alert";
  readonly resourceId: string;
  readonly allocationId: string;
}

export const POPULATED_CUTOVER_FIXTURE_IDS_V1 = deepFreeze({
  organizations: {
    alpha: "14000000-0000-4000-8000-000000000001",
    beta: "14000000-0000-4000-8000-000000000002",
  },
  principals: {
    alpha: "14000000-0000-4000-8000-000000000101",
    beta: "14000000-0000-4000-8000-000000000102",
  },
  privacyDomains: {
    alpha: "14000000-0000-4000-8000-000000000301",
    beta: "14000000-0000-4000-8000-000000000302",
  },
  keyReferences: {
    alpha: "14000000-0000-4000-8000-000000000401",
    beta: "14000000-0000-4000-8000-000000000402",
  },
  resources: {
    alphaThesis: "14000000-0000-4000-8000-000000000201",
    alphaDeletedAlert: "14000000-0000-4000-8000-000000000202",
    betaThesis: "14000000-0000-4000-8000-000000000203",
    betaAlert: "14000000-0000-4000-8000-000000000204",
    alphaConcurrentThesis: "14000000-0000-4000-8000-000000000205",
    alphaPostContractThesis: "14000000-0000-4000-8000-000000000206",
  },
  allocations: {
    alphaThesis: "14000000-0000-4000-8000-000000000501",
    alphaDeletedAlert: "14000000-0000-4000-8000-000000000502",
    betaThesis: "14000000-0000-4000-8000-000000000503",
    betaAlert: "14000000-0000-4000-8000-000000000504",
    alphaConcurrentThesis: "14000000-0000-4000-8000-000000000505",
    alphaPostContractThesis: "14000000-0000-4000-8000-000000000506",
  },
} as const);

export const POPULATED_CUTOVER_FIXTURE_RESOURCES_V1 = deepFreeze({
  alphaThesis: {
    organizationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.organizations.alpha,
    privacyDomainId: POPULATED_CUTOVER_FIXTURE_IDS_V1.privacyDomains.alpha,
    resourceType: "thesis",
    resourceId: POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaThesis,
    allocationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.allocations.alphaThesis,
  },
  alphaDeletedAlert: {
    organizationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.organizations.alpha,
    privacyDomainId: POPULATED_CUTOVER_FIXTURE_IDS_V1.privacyDomains.alpha,
    resourceType: "alert",
    resourceId: POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaDeletedAlert,
    allocationId:
      POPULATED_CUTOVER_FIXTURE_IDS_V1.allocations.alphaDeletedAlert,
  },
  betaThesis: {
    organizationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.organizations.beta,
    privacyDomainId: POPULATED_CUTOVER_FIXTURE_IDS_V1.privacyDomains.beta,
    resourceType: "thesis",
    resourceId: POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.betaThesis,
    allocationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.allocations.betaThesis,
  },
  betaAlert: {
    organizationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.organizations.beta,
    privacyDomainId: POPULATED_CUTOVER_FIXTURE_IDS_V1.privacyDomains.beta,
    resourceType: "alert",
    resourceId: POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.betaAlert,
    allocationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.allocations.betaAlert,
  },
  alphaConcurrentThesis: {
    organizationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.organizations.alpha,
    privacyDomainId: POPULATED_CUTOVER_FIXTURE_IDS_V1.privacyDomains.alpha,
    resourceType: "thesis",
    resourceId:
      POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaConcurrentThesis,
    allocationId:
      POPULATED_CUTOVER_FIXTURE_IDS_V1.allocations.alphaConcurrentThesis,
  },
  alphaPostContractThesis: {
    organizationId: POPULATED_CUTOVER_FIXTURE_IDS_V1.organizations.alpha,
    privacyDomainId: POPULATED_CUTOVER_FIXTURE_IDS_V1.privacyDomains.alpha,
    resourceType: "thesis",
    resourceId:
      POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaPostContractThesis,
    allocationId:
      POPULATED_CUTOVER_FIXTURE_IDS_V1.allocations.alphaPostContractThesis,
  },
} as const satisfies Record<string, PopulatedCutoverFixtureResourceV1>);

export async function loadPopulatedCutoverPlanV1(
  root = reviewedPlanRoot,
): Promise<PopulatedCutoverPlanV1> {
  const entries = (await readdir(root, { withFileTypes: true }))
    .map((entry) =>
      entry.isDirectory()
        ? `directory:${entry.name}`
        : entry.isFile()
          ? `file:${entry.name}`
          : `unsupported:${entry.name}`,
    )
    .sort(compareText);
  const expected = [
    `directory:${POPULATED_CUTOVER_PLAN_APPLICATION_DIRECTORY}`,
    `file:${POPULATED_CUTOVER_PLAN_MANIFEST_FILE}`,
    `file:${POPULATED_CUTOVER_PLAN_PLATFORM_FILE}`,
  ].sort(compareText);
  if (!sameStrings(entries, expected)) {
    throw new Error(
      "Populated cutover plan root contains missing or unexpected entries",
    );
  }

  const applicationRoot = join(
    root,
    POPULATED_CUTOVER_PLAN_APPLICATION_DIRECTORY,
  );
  const applicationEntries = (
    await readdir(applicationRoot, { withFileTypes: true })
  )
    .map((entry) => {
      if (!entry.isFile()) {
        throw new Error(
          "Populated cutover application directory may contain only files",
        );
      }
      return entry.name;
    })
    .sort(compareText);
  const expectedApplicationEntries =
    POPULATED_CUTOVER_PLAN_APPLICATION_FILES.map((file) =>
      file.slice(`${POPULATED_CUTOVER_PLAN_APPLICATION_DIRECTORY}/`.length),
    );
  if (!sameStrings(applicationEntries, expectedApplicationEntries)) {
    throw new Error(
      "Populated cutover application inventory differs from the reviewed plan",
    );
  }

  const [platformSql, manifestText, ...applicationSql] = await Promise.all([
    readFile(join(root, POPULATED_CUTOVER_PLAN_PLATFORM_FILE), "utf8"),
    readFile(join(root, POPULATED_CUTOVER_PLAN_MANIFEST_FILE), "utf8"),
    ...POPULATED_CUTOVER_PLAN_APPLICATION_FILES.map((file) =>
      readFile(join(root, file), "utf8"),
    ),
  ]);
  if (sha256(manifestText) !== POPULATED_CUTOVER_PLAN_MANIFEST_SHA256) {
    throw new Error(
      "Populated cutover manifest checksum differs from the reviewed source",
    );
  }
  const manifest = parsePopulatedCutoverPlanManifestV1(
    JSON.parse(manifestText) as unknown,
  );
  await validateExternalBindings(root, manifest);
  return snapshotPopulatedCutoverPlanV1({
    platformSql,
    manifest,
    applicationFiles: POPULATED_CUTOVER_PLAN_APPLICATION_FILES.map(
      (file, index) => ({ file, sql: applicationSql[index] ?? "" }),
    ),
  });
}

export function snapshotPopulatedCutoverPlanV1(
  plan: PopulatedCutoverPlanV1,
): PopulatedCutoverPlanV1 {
  const snapshot = Object.freeze({
    platformSql: plan.platformSql,
    manifest: parsePopulatedCutoverPlanManifestV1(
      structuredClone(plan.manifest),
    ),
    applicationFiles: Object.freeze(
      plan.applicationFiles.map((entry) => Object.freeze({ ...entry })),
    ),
  });
  validatePlan(snapshot);
  return snapshot;
}

export function parsePopulatedCutoverPlanManifestV1(
  value: unknown,
): PopulatedCutoverPlanManifestV1 {
  assertRecord(value, "Populated cutover manifest must be an object");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "planVersion",
      "algorithm",
      "platform",
      "base",
      "target",
      "migrations",
    ],
    "populated cutover manifest",
  );
  if (
    value.schemaVersion !== 1 ||
    value.planVersion !== 1 ||
    value.algorithm !== "sha256"
  ) {
    throw new Error("Populated cutover manifest version is unsupported");
  }

  assertRecord(value.platform, "Populated cutover platform is malformed");
  assertExactKeys(value.platform, ["file", "sha256"], "cutover platform");
  if (
    value.platform.file !== POPULATED_CUTOVER_PLAN_PLATFORM_FILE ||
    value.platform.sha256 !== POPULATED_CUTOVER_PLAN_PLATFORM_SHA256
  ) {
    throw new Error("Populated cutover platform binding is unsupported");
  }

  assertRecord(value.base, "Populated cutover base is malformed");
  assertExactKeys(
    value.base,
    [
      "planVersion",
      "manifestFile",
      "manifestSha256",
      "selectedMigrations",
      "excludedMigration",
    ],
    "cutover base",
  );
  if (
    value.base.planVersion !== 2 ||
    value.base.manifestFile !== POPULATED_CUTOVER_BASE_MANIFEST_FILE ||
    value.base.manifestSha256 !== POPULATED_CUTOVER_BASE_MANIFEST_SHA256 ||
    !Array.isArray(value.base.selectedMigrations) ||
    value.base.selectedMigrations.length !==
      POPULATED_CUTOVER_BASE_SELECTED_IDS.length
  ) {
    throw new Error("Populated cutover base binding is unsupported");
  }
  const selectedMigrations = value.base.selectedMigrations.map((entry, index) =>
    parseMigrationReference(
      entry,
      POPULATED_CUTOVER_BASE_SELECTED_IDS[index] ?? "",
      POPULATED_CUTOVER_BASE_SELECTED_FILES[index] ?? "",
      POPULATED_CUTOVER_BASE_SELECTED_SHA256[index] ?? "",
      `cutover base migration ${index}`,
    ),
  );
  const excludedMigration = parseExcludedMigration(
    value.base.excludedMigration,
  );

  assertRecord(value.target, "Populated cutover target is malformed");
  assertExactKeys(
    value.target,
    [
      "privacyPlanVersion",
      "manifestFile",
      "manifestSha256",
      "policyFile",
      "policySha256",
      "applicationFile",
      "applicationSha256",
    ],
    "cutover target",
  );
  if (
    value.target.privacyPlanVersion !== 1 ||
    value.target.manifestFile !== POPULATED_CUTOVER_TARGET_MANIFEST_FILE ||
    value.target.manifestSha256 !== POPULATED_CUTOVER_TARGET_MANIFEST_SHA256 ||
    value.target.policyFile !== POPULATED_CUTOVER_TARGET_POLICY_FILE ||
    value.target.policySha256 !== POPULATED_CUTOVER_TARGET_POLICY_SHA256 ||
    value.target.applicationFile !==
      POPULATED_CUTOVER_TARGET_APPLICATION_FILE ||
    value.target.applicationSha256 !==
      POPULATED_CUTOVER_TARGET_APPLICATION_SHA256
  ) {
    throw new Error("Populated cutover target binding is unsupported");
  }

  if (
    !Array.isArray(value.migrations) ||
    value.migrations.length !== POPULATED_CUTOVER_PLAN_APPLICATION_FILES.length
  ) {
    throw new Error("Populated cutover migration inventory is malformed");
  }
  const migrations = value.migrations.map((entry, index) => {
    assertRecord(entry, `Populated cutover migration ${index} is malformed`);
    assertExactKeys(
      entry,
      ["id", "phase", "file", "sha256"],
      `cutover migration ${index}`,
    );
    if (
      entry.id !== POPULATED_CUTOVER_PLAN_MIGRATION_IDS[index] ||
      entry.phase !== POPULATED_CUTOVER_PLAN_PHASES[index] ||
      entry.file !== POPULATED_CUTOVER_PLAN_APPLICATION_FILES[index] ||
      entry.sha256 !== POPULATED_CUTOVER_PLAN_APPLICATION_SHA256[index]
    ) {
      throw new Error(`Populated cutover migration ${index} is unsupported`);
    }
    return Object.freeze({
      id: entry.id,
      phase: entry.phase,
      file: entry.file,
      sha256: entry.sha256,
    }) as PopulatedCutoverManifestEntryV1;
  });

  return Object.freeze({
    schemaVersion: 1,
    planVersion: 1,
    algorithm: "sha256",
    platform: Object.freeze({
      file: POPULATED_CUTOVER_PLAN_PLATFORM_FILE,
      sha256: POPULATED_CUTOVER_PLAN_PLATFORM_SHA256,
    }),
    base: Object.freeze({
      planVersion: 2,
      manifestFile: POPULATED_CUTOVER_BASE_MANIFEST_FILE,
      manifestSha256: POPULATED_CUTOVER_BASE_MANIFEST_SHA256,
      selectedMigrations: Object.freeze(selectedMigrations),
      excludedMigration,
    }),
    target: Object.freeze({
      privacyPlanVersion: 1,
      manifestFile: POPULATED_CUTOVER_TARGET_MANIFEST_FILE,
      manifestSha256: POPULATED_CUTOVER_TARGET_MANIFEST_SHA256,
      policyFile: POPULATED_CUTOVER_TARGET_POLICY_FILE,
      policySha256: POPULATED_CUTOVER_TARGET_POLICY_SHA256,
      applicationFile: POPULATED_CUTOVER_TARGET_APPLICATION_FILE,
      applicationSha256: POPULATED_CUTOVER_TARGET_APPLICATION_SHA256,
    }),
    migrations: Object.freeze(migrations),
  });
}

export function expectedPopulatedCutoverBaseLedgerRowsV1(
  plan: PopulatedCutoverPlanV1,
): readonly PopulatedCutoverLedgerRowV1[] {
  const snapshot = snapshotPopulatedCutoverPlanV1(plan);
  return Object.freeze(
    snapshot.manifest.base.selectedMigrations.map((entry) =>
      Object.freeze({
        migrationId: entry.id,
        fileName: entry.file,
        sha256: entry.sha256,
      }),
    ),
  );
}

export function expectedPopulatedCutoverLedgerRowsV1(
  plan: PopulatedCutoverPlanV1,
): readonly PopulatedCutoverLedgerRowV1[] {
  const snapshot = snapshotPopulatedCutoverPlanV1(plan);
  const rows = [
    ...expectedPopulatedCutoverBaseLedgerRowsV1(snapshot),
    ...snapshot.manifest.migrations.map((entry) =>
      Object.freeze({
        migrationId: entry.id,
        fileName: entry.file,
        sha256: entry.sha256,
      }),
    ),
  ];
  rows.sort((left, right) => compareText(left.migrationId, right.migrationId));
  return Object.freeze(rows);
}

export function renderPopulatedCutoverPlatformMigration(
  plan: PopulatedCutoverPlanV1,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "cutover platform injectFailure");
  const snapshot = snapshotPopulatedCutoverPlanV1(plan);
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint);`,
    stripTransaction(snapshot.platformSql),
  ];
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push("COMMIT;", "");
  return lines.join("\n");
}

export function renderPopulatedCutoverBaseMigration(
  authenticatedPlan: AuthenticatedMigrationPlan,
  cutoverPlan: PopulatedCutoverPlanV1,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "cutover base injectFailure");
  const base = snapshotAuthenticatedMigrationPlan(authenticatedPlan);
  const cutover = snapshotPopulatedCutoverPlanV1(cutoverPlan);
  assertBaseAndTargetBindings(base, undefined, cutover);
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint);`,
    `SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};`,
    renderBasePreflight(),
  ];
  for (const selected of cutover.manifest.base.selectedMigrations) {
    const index = base.manifest.migrations.findIndex(
      (entry) => entry.id === selected.id,
    );
    const migration = base.applicationFiles[index];
    if (
      index < 0 ||
      !migration ||
      migration.file !== selected.file ||
      base.manifest.migrations[index]?.sha256 !== selected.sha256
    ) {
      throw new Error(`Missing populated cutover base ${selected.id}`);
    }
    lines.push(
      `-- populated cutover base ${selected.id}: ${selected.file}`,
      migration.sql.trimEnd(),
      "INSERT INTO shared_data.schema_migrations (migration_id, file_name, sha256)",
      `VALUES ('${selected.id}', '${selected.file}', '${selected.sha256}');`,
    );
  }
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push(
    renderOwnerIdentityAssertion(POPULATED_CUTOVER_BASE_IDENTITY_MARKER),
    "COMMIT;",
    renderRoleResetAssertion(),
    "",
  );
  return lines.join("\n");
}

export function renderPopulatedCutoverExpandMigration(
  authenticatedPlan: AuthenticatedMigrationPlan,
  privacyPlan: PrivacyRetentionPlanV1,
  cutoverPlan: PopulatedCutoverPlanV1,
  injectFailure = false,
): string {
  assertBoolean(injectFailure, "cutover expand injectFailure");
  const base = snapshotAuthenticatedMigrationPlan(authenticatedPlan);
  const privacy = snapshotPrivacyRetentionPlanV1(privacyPlan);
  const cutover = snapshotPopulatedCutoverPlanV1(cutoverPlan);
  assertBaseAndTargetBindings(base, privacy, cutover);
  const entry = cutover.manifest.migrations[0];
  const migration = cutover.applicationFiles[0];
  if (!entry || !migration) throw new Error("Cutover expand source is absent");
  const targetSql = privacy.applicationFiles[0]?.sql;
  if (!targetSql) throw new Error("B13 target SQL is absent");
  const expandSql = replaceExactlyOnce(
    migration.sql,
    EXPAND_ALLOCATION_MARKER,
    extractTargetAllocationFunction(targetSql),
  );
  const lines = [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint);`,
    `SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};`,
    renderPhasePreflight(
      expectedPopulatedCutoverBaseLedgerRowsV1(cutover),
      "expand",
    ),
    `-- populated cutover migration ${entry.id}: ${entry.file}`,
    expandSql.trimEnd(),
    renderExpandedSourcePopulationAssertion(),
  ];
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push(
    renderLedgerInsert(entry),
    renderOwnerIdentityAssertion(POPULATED_CUTOVER_EXPAND_IDENTITY_MARKER),
    "COMMIT;",
    renderRoleResetAssertion(),
    "",
  );
  return lines.join("\n");
}

export function renderPopulatedCutoverContractBarrier(
  authenticatedPlan: AuthenticatedMigrationPlan,
  privacyPlan: PrivacyRetentionPlanV1,
  cutoverPlan: PopulatedCutoverPlanV1,
  expectedCaptureEpoch: number,
): string {
  assertCaptureEpoch(expectedCaptureEpoch);
  const base = snapshotAuthenticatedMigrationPlan(authenticatedPlan);
  const privacy = snapshotPrivacyRetentionPlanV1(privacyPlan);
  const cutover = snapshotPopulatedCutoverPlanV1(cutoverPlan);
  assertBaseAndTargetBindings(base, privacy, cutover);
  const migration = cutover.applicationFiles[1];
  if (!migration) throw new Error("Cutover contract source is absent");
  const { barrier } = splitContractSql(migration.sql);
  const barrierSql = replaceExactlyOnce(
    barrier,
    CONTRACT_EPOCH_MARKER,
    String(expectedCaptureEpoch),
  );
  return [
    "BEGIN;",
    `SELECT pg_catalog.pg_advisory_xact_lock(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint);`,
    `SET LOCAL ROLE ${AUTHENTICATED_MIGRATION_OWNER_ROLE};`,
    renderPhasePreflight(
      [
        ...expectedPopulatedCutoverBaseLedgerRowsV1(cutover),
        ledgerRow(cutover.manifest.migrations[0]),
      ],
      "contract",
    ),
    barrierSql.trimEnd(),
    `SELECT '${POPULATED_CUTOVER_CONTRACT_BARRIER_MARKER}';`,
    "",
  ].join("\n");
}

export function renderPopulatedCutoverContractFinalize(
  authenticatedPlan: AuthenticatedMigrationPlan,
  privacyPlan: PrivacyRetentionPlanV1,
  cutoverPlan: PopulatedCutoverPlanV1,
  expectedCaptureEpoch: number,
  injectFailure = false,
): string {
  assertCaptureEpoch(expectedCaptureEpoch);
  assertBoolean(injectFailure, "cutover contract injectFailure");
  const base = snapshotAuthenticatedMigrationPlan(authenticatedPlan);
  const privacy = snapshotPrivacyRetentionPlanV1(privacyPlan);
  const cutover = snapshotPopulatedCutoverPlanV1(cutoverPlan);
  assertBaseAndTargetBindings(base, privacy, cutover);
  const entry = cutover.manifest.migrations[1];
  const migration = cutover.applicationFiles[1];
  const targetSql = privacy.applicationFiles[0]?.sql;
  if (!entry || !migration || !targetSql) {
    throw new Error("Cutover contract or B13 target source is absent");
  }
  const { barrier, finalize } = splitContractSql(migration.sql);
  const repeatedBarrier = replaceExactlyOnce(
    barrier,
    CONTRACT_EPOCH_MARKER,
    String(expectedCaptureEpoch),
  );
  const finalization = replaceExactlyOnce(
    finalize,
    CONTRACT_FINALIZATION_MARKER,
    extractTargetFinalizationWithoutAllocation(
      targetSql,
      extractExcludedIdentityTriggers(base, cutover),
    ),
  );
  const lines = [
    renderOpenContractIdentityAssertion(),
    `SELECT pg_catalog.pg_advisory_xact_lock(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint);`,
    renderPhasePreflight(
      [
        ...expectedPopulatedCutoverBaseLedgerRowsV1(cutover),
        ledgerRow(cutover.manifest.migrations[0]),
      ],
      "contract",
    ),
    repeatedBarrier.trimEnd(),
    finalization.trimEnd(),
  ];
  if (injectFailure) lines.push(renderInjectedFailure());
  lines.push(
    renderLedgerInsert(entry),
    renderOwnerIdentityAssertion(POPULATED_CUTOVER_CONTRACT_IDENTITY_MARKER),
    "COMMIT;",
    renderRoleResetAssertion(),
    "",
  );
  return lines.join("\n");
}

export function renderPopulatedCutoverContractMigration(
  authenticatedPlan: AuthenticatedMigrationPlan,
  privacyPlan: PrivacyRetentionPlanV1,
  cutoverPlan: PopulatedCutoverPlanV1,
  expectedCaptureEpoch: number,
  injectFailure = false,
): string {
  return [
    renderPopulatedCutoverContractBarrier(
      authenticatedPlan,
      privacyPlan,
      cutoverPlan,
      expectedCaptureEpoch,
    ).trimEnd(),
    renderPopulatedCutoverContractFinalize(
      authenticatedPlan,
      privacyPlan,
      cutoverPlan,
      expectedCaptureEpoch,
      injectFailure,
    ),
  ].join("\n");
}

export async function loadPopulatedCutoverFixture(): Promise<string> {
  const sql = await readFile(reviewedFixtureFile, "utf8");
  validateFixture(sql);
  return sql;
}

export function renderPopulatedCutoverFixture(fixtureSql: string): string {
  validateFixture(fixtureSql);
  return [
    "BEGIN;",
    "SET LOCAL ROLE research_cockpit_test_seed;",
    fixtureSql.trimEnd(),
    "COMMIT;",
    "",
  ].join("\n");
}

export function renderPopulatedCutoverSharedAdvisorySql(): string {
  return `SELECT pg_catalog.pg_advisory_xact_lock_shared(${POPULATED_CUTOVER_ADVISORY_LOCK_KEY}::bigint);`;
}

export function renderPopulatedCutoverConcurrentLegacyInsert(): string {
  const ids = POPULATED_CUTOVER_FIXTURE_IDS_V1;
  return `INSERT INTO private_data.theses (
  organization_id, id, instrument_id, claim, evidence_note, risks,
  invalidation, created_by, created_at, updated_by, updated_at
) VALUES (
  '${ids.organizations.alpha}',
  '${ids.resources.alphaConcurrentThesis}',
  'listing-cutover-synthetic',
  'Captured concurrent legacy thesis.',
  'Synthetic populated-cutover fixture evidence.',
  'Synthetic fixture risk.',
  'Synthetic fixture invalidation.',
  '${ids.principals.alpha}',
  '2026-08-01T02:00:00Z',
  '${ids.principals.alpha}',
  '2026-08-01T02:00:00Z'
);`;
}

export function renderPopulatedCutoverPostContractInsert(): string {
  const ids = POPULATED_CUTOVER_FIXTURE_IDS_V1;
  return `INSERT INTO private_data.theses (
  organization_id, id, instrument_id, claim, evidence_note, risks,
  invalidation, created_by, created_at, updated_by, updated_at,
  registered_allocation_id
) VALUES (
  '${ids.organizations.alpha}',
  '${ids.resources.alphaPostContractThesis}',
  'listing-cutover-synthetic',
  'Post-contract keyed thesis.',
  'Synthetic populated-cutover fixture evidence.',
  'Synthetic fixture risk.',
  'Synthetic fixture invalidation.',
  '${ids.principals.alpha}',
  '2026-08-01T03:00:00Z',
  '${ids.principals.alpha}',
  '2026-08-01T03:00:00Z',
  '${ids.allocations.alphaPostContractThesis}'
);`;
}

export function renderCreatePopulatedCutoverDatabaseSql(): string {
  return `DO $populated_cutover_database_create_preflight$
BEGIN
  IF pg_catalog.current_database() <> 'postgres'
    OR session_user <> current_user
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION
      'populated cutover database creation requires maintenance superuser';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datname = '${POPULATED_CUTOVER_DATABASE_NAME}'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'bounded populated cutover target must be absent';
  END IF;
END;
$populated_cutover_database_create_preflight$;
CREATE DATABASE ${POPULATED_CUTOVER_DATABASE_NAME}
  OWNER postgres TEMPLATE template0 ENCODING 'UTF8';
`;
}

export function renderDropPopulatedCutoverDatabaseSql(): string {
  return `DO $populated_cutover_database_drop_preflight$
BEGIN
  IF pg_catalog.current_database() <> 'postgres'
    OR session_user <> current_user
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolsuper
    )
  THEN
    RAISE EXCEPTION
      'populated cutover database cleanup requires maintenance superuser';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_database
    WHERE datname = '${POPULATED_CUTOVER_DATABASE_NAME}'
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_activity
    WHERE datname = '${POPULATED_CUTOVER_DATABASE_NAME}'
  ) THEN
    RAISE EXCEPTION
      'bounded populated cutover target is absent or has active backends';
  END IF;
END;
$populated_cutover_database_drop_preflight$;
DROP DATABASE ${POPULATED_CUTOVER_DATABASE_NAME};
`;
}

function validatePlan(plan: PopulatedCutoverPlanV1): void {
  const manifest = parsePopulatedCutoverPlanManifestV1(plan.manifest);
  if (
    sha256(plan.platformSql) !== POPULATED_CUTOVER_PLAN_PLATFORM_SHA256 ||
    manifest.platform.sha256 !== POPULATED_CUTOVER_PLAN_PLATFORM_SHA256 ||
    !plan.platformSql.includes(POPULATED_CUTOVER_DATABASE_NAME) ||
    !plan.platformSql.includes(
      `CREATE ROLE ${POPULATED_CUTOVER_CAPABILITY_ROLE}`,
    )
  ) {
    throw new Error("Populated cutover platform differs from reviewed source");
  }
  if (plan.applicationFiles.length !== manifest.migrations.length) {
    throw new Error("Populated cutover application inventory is incomplete");
  }
  for (const [index, entry] of manifest.migrations.entries()) {
    const application = plan.applicationFiles[index];
    if (
      !application ||
      application.file !== entry.file ||
      sha256(application.sql) !== entry.sha256 ||
      entry.sha256 !== POPULATED_CUTOVER_PLAN_APPLICATION_SHA256[index] ||
      /^(?:(?:BEGIN|COMMIT|ROLLBACK);|\\[^\n]*)$/im.test(application.sql)
    ) {
      throw new Error(`Populated cutover application ${index} is unsupported`);
    }
  }
  if (
    countOccurrences(
      plan.applicationFiles[0]?.sql ?? "",
      EXPAND_ALLOCATION_MARKER,
    ) !== 1 ||
    countOccurrences(
      plan.applicationFiles[1]?.sql ?? "",
      CONTRACT_FINALIZATION_MARKER,
    ) !== 1 ||
    countOccurrences(
      plan.applicationFiles[1]?.sql ?? "",
      CONTRACT_EPOCH_MARKER,
    ) !== 1
  ) {
    throw new Error("Populated cutover composition markers are not exact");
  }
}

async function validateExternalBindings(
  root: string,
  manifest: PopulatedCutoverPlanManifestV1,
): Promise<void> {
  const [baseManifest, targetManifest, targetPolicy, targetApplication] =
    await Promise.all([
      readFile(join(root, manifest.base.manifestFile)),
      readFile(join(root, manifest.target.manifestFile)),
      readFile(join(root, manifest.target.policyFile)),
      readFile(join(root, manifest.target.applicationFile)),
    ]);
  if (
    sha256(baseManifest) !== manifest.base.manifestSha256 ||
    sha256(targetManifest) !== manifest.target.manifestSha256 ||
    sha256(targetPolicy) !== manifest.target.policySha256 ||
    sha256(targetApplication) !== manifest.target.applicationSha256
  ) {
    throw new Error("Populated cutover external binding checksum changed");
  }
}

function assertBaseAndTargetBindings(
  base: AuthenticatedMigrationPlan,
  privacy: PrivacyRetentionPlanV1 | undefined,
  cutover: PopulatedCutoverPlanV1,
): void {
  for (const selected of cutover.manifest.base.selectedMigrations) {
    const index = base.manifest.migrations.findIndex(
      (entry) => entry.id === selected.id,
    );
    const entry = base.manifest.migrations[index];
    const file = base.applicationFiles[index];
    if (
      !entry ||
      !file ||
      entry.file !== selected.file ||
      entry.sha256 !== selected.sha256 ||
      sha256(file.sql) !== selected.sha256
    ) {
      throw new Error(`Populated cutover base binding changed: ${selected.id}`);
    }
  }
  const excluded = cutover.manifest.base.excludedMigration;
  const excludedIndex = base.manifest.migrations.findIndex(
    (entry) => entry.id === excluded.id,
  );
  if (
    base.manifest.migrations[excludedIndex]?.file !== excluded.file ||
    base.manifest.migrations[excludedIndex]?.sha256 !== excluded.sha256
  ) {
    throw new Error("Populated cutover excluded v2-0005 binding changed");
  }
  if (privacy !== undefined) {
    const target = privacy.applicationFiles[0];
    if (
      !target ||
      sha256(target.sql) !== cutover.manifest.target.applicationSha256
    ) {
      throw new Error("Populated cutover B13 target binding changed");
    }
  }
}

function renderBasePreflight(): string {
  return `DO $populated_cutover_base_preflight$
BEGIN
  IF pg_catalog.current_database() <> '${POPULATED_CUTOVER_DATABASE_NAME}'
    OR session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    OR session_user = current_user
  THEN
    RAISE EXCEPTION 'populated cutover base identity is invalid';
  END IF;
  IF pg_catalog.to_regclass('shared_data.schema_migrations') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = class.relnamespace
      WHERE namespace.nspname IN ('shared_data', 'private_data')
        AND class.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'populated cutover base requires a pristine application target';
  END IF;
END;
$populated_cutover_base_preflight$;`;
}

function renderPhasePreflight(
  rows: readonly PopulatedCutoverLedgerRowV1[],
  phase: "expand" | "contract",
): string {
  const values = rows
    .map((row) => `('${row.migrationId}', '${row.fileName}', '${row.sha256}')`)
    .join(",\n      ");
  const phaseCheck =
    phase === "expand"
      ? `IF pg_catalog.to_regclass(
      'private_data.resource_identifier_cutover_work'
    ) IS NOT NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'populated cutover expand requires populated pre-0005 state';
  END IF;`
      : `IF pg_catalog.to_regclass(
      'private_data.resource_identifier_cutover_work'
    ) IS NULL
    OR pg_catalog.to_regclass(
      'private_data.resource_identifier_cutover_control'
    ) IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'populated cutover contract requires expanded capture state';
  END IF;`;
  return `DO $populated_cutover_${phase}_preflight$
BEGIN
  IF pg_catalog.current_database() <> '${POPULATED_CUTOVER_DATABASE_NAME}'
    OR session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    OR session_user = current_user
  THEN
    RAISE EXCEPTION 'populated cutover ${phase} identity is invalid';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM shared_data.schema_migrations) <>
      ${rows.length}
    OR EXISTS (
      (VALUES
        ${values}
      )
      EXCEPT
      SELECT migration_id, file_name, sha256::text
      FROM shared_data.schema_migrations
    )
    OR EXISTS (
      SELECT migration_id, file_name, sha256::text
      FROM shared_data.schema_migrations
      EXCEPT
      (VALUES
        ${values}
      )
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'populated cutover ${phase} ledger is not exact';
  END IF;
  ${phaseCheck}
END;
$populated_cutover_${phase}_preflight$;`;
}

function renderExpandedSourcePopulationAssertion(): string {
  return `DO $populated_cutover_expanded_source_population$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private_data.theses)
    OR NOT EXISTS (SELECT 1 FROM private_data.alert_rules)
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'populated cutover expand requires populated pre-0005 state';
  END IF;
END;
$populated_cutover_expanded_source_population$;`;
}

function renderOpenContractIdentityAssertion(): string {
  return `DO $populated_cutover_open_contract_identity$
BEGIN
  IF pg_catalog.current_database() <> '${POPULATED_CUTOVER_DATABASE_NAME}'
    OR session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
    OR session_user = current_user
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'populated cutover finalize requires its open barrier transaction';
  END IF;
END;
$populated_cutover_open_contract_identity$;`;
}

function renderOwnerIdentityAssertion(marker: string): string {
  return `DO $populated_cutover_owner_identity$
BEGIN
  IF session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> '${AUTHENTICATED_MIGRATION_OWNER_ROLE}'
  THEN
    RAISE EXCEPTION 'populated cutover owner identity changed';
  END IF;
END;
$populated_cutover_owner_identity$;
SELECT '${marker}';`;
}

function renderRoleResetAssertion(): string {
  return `DO $populated_cutover_role_reset$
BEGIN
  IF session_user <> '${AUTHENTICATED_MIGRATOR_LOGIN_ROLE}'
    OR current_user <> session_user
  THEN
    RAISE EXCEPTION 'populated cutover role did not reset';
  END IF;
END;
$populated_cutover_role_reset$;
SELECT '${POPULATED_CUTOVER_ROLE_RESET_MARKER}';`;
}

function renderLedgerInsert(entry: PopulatedCutoverManifestEntryV1): string {
  return `INSERT INTO shared_data.schema_migrations (migration_id, file_name, sha256)
VALUES ('${entry.id}', '${entry.file}', '${entry.sha256}');`;
}

function ledgerRow(
  entry: PopulatedCutoverManifestEntryV1 | undefined,
): PopulatedCutoverLedgerRowV1 {
  if (!entry) throw new Error("Populated cutover ledger entry is absent");
  return Object.freeze({
    migrationId: entry.id,
    fileName: entry.file,
    sha256: entry.sha256,
  });
}

function extractTargetAllocationFunction(sql: string): string {
  const start = sql.indexOf(TARGET_ALLOCATION_START);
  const end = sql.indexOf(TARGET_ALLOCATION_END);
  if (start < 0 || end <= start) {
    throw new Error("B13 target allocation function anchors changed");
  }
  return sql.slice(start, end).trimEnd();
}

function extractTargetFinalizationWithoutAllocation(
  sql: string,
  identityTriggers: string,
): string {
  const finalizationStart = sql.indexOf(TARGET_FINALIZATION_START);
  const allocationStart = sql.indexOf(TARGET_ALLOCATION_START);
  const allocationEnd = sql.indexOf(TARGET_ALLOCATION_END);
  if (
    finalizationStart < 0 ||
    allocationStart <= finalizationStart ||
    allocationEnd <= allocationStart
  ) {
    throw new Error("B13 target finalization anchors changed");
  }
  const finalizationWithoutAllocation = `${sql.slice(
    finalizationStart,
    allocationStart,
  )}${sql.slice(allocationEnd)}`;
  return replaceExactlyOnce(
    finalizationWithoutAllocation,
    TARGET_IDENTITY_TRIGGER_INSERTION_ANCHOR,
    `${identityTriggers.trimEnd()}\n\n${TARGET_IDENTITY_TRIGGER_INSERTION_ANCHOR}`,
  ).trimEnd();
}

function extractExcludedIdentityTriggers(
  base: AuthenticatedMigrationPlan,
  cutover: PopulatedCutoverPlanV1,
): string {
  const excluded = cutover.manifest.base.excludedMigration;
  const excludedIndex = base.manifest.migrations.findIndex(
    (entry) => entry.id === excluded.id,
  );
  const excludedSource = base.applicationFiles[excludedIndex];
  if (
    excludedIndex < 0 ||
    excludedSource?.file !== excluded.file ||
    sha256(excludedSource.sql) !== excluded.sha256
  ) {
    throw new Error("Populated cutover excluded v2-0005 source changed");
  }
  const start = excludedSource.sql.indexOf(EXCLUDED_IDENTITY_TRIGGERS_START);
  const end = excludedSource.sql.indexOf(EXCLUDED_IDENTITY_TRIGGERS_END);
  if (
    start < 0 ||
    end <= start ||
    countOccurrences(excludedSource.sql, EXCLUDED_IDENTITY_TRIGGERS_START) !==
      1 ||
    countOccurrences(excludedSource.sql, EXCLUDED_IDENTITY_TRIGGERS_END) !== 1
  ) {
    throw new Error("Populated cutover inherited identity triggers changed");
  }
  return excludedSource.sql.slice(start, end).trimEnd();
}

function splitContractSql(sql: string): {
  readonly barrier: string;
  readonly finalize: string;
} {
  const anchor = "DO $populated_cutover_invariants$";
  const index = sql.indexOf(anchor);
  if (index < 0 || countOccurrences(sql, anchor) !== 1) {
    throw new Error("Populated cutover contract split anchor changed");
  }
  return Object.freeze({
    barrier: sql.slice(0, index),
    finalize: sql.slice(index),
  });
}

function validateFixture(sql: string): void {
  if (
    typeof sql !== "string" ||
    sha256(sql) !== POPULATED_CUTOVER_FIXTURE_SHA256
  ) {
    throw new Error("Populated cutover fixture differs from reviewed source");
  }
  for (const resourceId of [
    POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaThesis,
    POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaDeletedAlert,
    POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.betaThesis,
    POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.betaAlert,
  ]) {
    if (countOccurrences(sql, resourceId) !== 1) {
      throw new Error("Populated cutover fixture resource inventory changed");
    }
  }
  if (
    sql.includes(
      POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaConcurrentThesis,
    ) ||
    sql.includes(
      POPULATED_CUTOVER_FIXTURE_IDS_V1.resources.alphaPostContractThesis,
    ) ||
    /resource_(?:id_registry|privacy_domains)/.test(sql)
  ) {
    throw new Error("Populated cutover fixture crosses the pre-0005 boundary");
  }
}

function parseMigrationReference(
  value: unknown,
  id: string,
  file: string,
  digest: string,
  label: string,
): PopulatedCutoverManifestMigrationReferenceV1 {
  assertRecord(value, `${label} must be an object`);
  assertExactKeys(value, ["id", "file", "sha256"], label);
  if (value.id !== id || value.file !== file || value.sha256 !== digest) {
    throw new Error(`${label} differs from its reviewed binding`);
  }
  return Object.freeze({ id, file, sha256: digest });
}

function parseExcludedMigration(
  value: unknown,
): Readonly<PopulatedCutoverManifestMigrationReferenceV1 & { reason: string }> {
  assertRecord(value, "Excluded populated cutover migration is malformed");
  assertExactKeys(
    value,
    ["id", "file", "sha256", "reason"],
    "excluded cutover migration",
  );
  if (
    value.id !== POPULATED_CUTOVER_BASE_EXCLUDED_ID ||
    value.file !== POPULATED_CUTOVER_BASE_EXCLUDED_FILE ||
    value.sha256 !== POPULATED_CUTOVER_BASE_EXCLUDED_SHA256 ||
    value.reason !== POPULATED_CUTOVER_BASE_EXCLUDED_REASON
  ) {
    throw new Error("Excluded populated cutover migration binding changed");
  }
  return Object.freeze({
    id: POPULATED_CUTOVER_BASE_EXCLUDED_ID,
    file: POPULATED_CUTOVER_BASE_EXCLUDED_FILE,
    sha256: POPULATED_CUTOVER_BASE_EXCLUDED_SHA256,
    reason: POPULATED_CUTOVER_BASE_EXCLUDED_REASON,
  });
}

function stripTransaction(sql: string): string {
  const match = /^BEGIN;\r?\n([\s\S]*)\r?\nCOMMIT;(?:\r?\n)?$/.exec(sql);
  if (!match?.[1]) {
    throw new Error("Populated cutover platform lacks its transaction wrapper");
  }
  return match[1];
}

function renderInjectedFailure(): string {
  return `-- deterministic B14 rollback probe; division_by_zero has SQLSTATE ${POPULATED_CUTOVER_INJECTED_FAILURE_SQLSTATE}
SELECT 1 / 0;`;
}

function replaceExactlyOnce(
  source: string,
  marker: string,
  replacement: string,
): string {
  if (countOccurrences(source, marker) !== 1) {
    throw new Error(`Populated cutover marker is not unique: ${marker}`);
  }
  return source.replace(marker, replacement);
}

function assertCaptureEpoch(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("Populated cutover capture epoch must be nonnegative");
  }
}

function assertBoolean(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
}

function assertExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  assertRecord(value, `${label} must be an object`);
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (!sameStrings(actual, expected)) {
    throw new Error(`${label} contains missing or unexpected fields`);
  }
}

function assertRecord(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function countOccurrences(value: string, target: string): number {
  if (target.length === 0) return 0;
  let count = 0;
  let index = 0;
  while ((index = value.indexOf(target, index)) >= 0) {
    count += 1;
    index += target.length;
  }
  return count;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return value;
}
