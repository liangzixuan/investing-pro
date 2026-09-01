import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  ConnectedSourceClock,
  ConnectedSourcePolicyConfig,
  ConnectedSourcePolicyDocument,
} from "@research-cockpit/connected-source-policy";

import {
  CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY,
  CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY,
  CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY,
  loadConnectedSourcePolicyAdministration,
  type ConnectedSourcePolicyAdministration,
  type ConnectedSourcePolicyEnvironment,
} from "./connected-source-policy-composition";

export const TEST_CONNECTED_SOURCE_NOW = "2026-09-01T12:00:00.000Z";
export const TEST_CONNECTED_SOURCE_SECRET_REFERENCE =
  "owner-local-ref:v1:synthetic:primary";

export const TEST_CONNECTED_SOURCE_CLOCK: ConnectedSourceClock = Object.freeze({
  now: () => TEST_CONNECTED_SOURCE_NOW,
});

export interface TestConnectedSourcePolicyFixture {
  readonly administration: ConnectedSourcePolicyAdministration;
  readonly bundlePath: string;
  readonly config: ConnectedSourcePolicyConfig;
  readonly directory: string;
  readonly environment: ConnectedSourcePolicyEnvironment;
  readonly policy: ConnectedSourcePolicyDocument;
}

export async function createTestConnectedSourcePolicyFixture(): Promise<TestConnectedSourcePolicyFixture> {
  const directory = await mkdtemp(join(tmpdir(), "connected-source-policy-"));
  const bundlePath = join(directory, "connected-source-policy.bundle.json");
  const config = validConnectedSourcePolicyConfig();
  const policy = validConnectedSourcePolicyDocument();
  const bytes = new TextEncoder().encode(
    `${canonicalJson({
      config,
      policy,
      schemaVersion: "1.0.0",
    })}\n`,
  );
  await writeFile(bundlePath, bytes, { flag: "wx", mode: 0o600 });
  const environment = Object.freeze({
    [CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY]: bundlePath,
    [CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY]: sha256(bytes),
    [CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY]:
      TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
  });
  const administration = await loadConnectedSourcePolicyAdministration(
    environment,
    TEST_CONNECTED_SOURCE_CLOCK,
  );
  if (administration === undefined) {
    throw new Error("Test connected source policy did not compose.");
  }
  return {
    administration,
    bundlePath,
    config,
    directory,
    environment,
    policy,
  };
}

export function validConnectedSourcePolicyConfig(): ConnectedSourcePolicyConfig {
  return {
    budgets: {
      currency: "USD",
      estimatedSpendMicrounitsLimit: 5_000_000,
      requestByteLimit: 1_000_000,
      requestLimit: 100,
      responseByteLimit: 1_000_000,
      storageByteLimit: 0,
    },
    enabled: true,
    intendedUse: {
      attributionSupported: true,
      cacheSeconds: 300,
      deletionSupported: true,
      derivation: "owner_local",
      device: "owner_workstation",
      display: "owner_local",
      export: "none",
      geography: "US",
      historyDays: 30,
      purpose: "personal_research",
      retentionSeconds: 600,
      terminationSupported: true,
    },
    profile: "personal_single_user_local_connected",
    schemaVersion: "1.0.0",
    secretReference: TEST_CONNECTED_SOURCE_SECRET_REFERENCE,
    sourceId: "connected_source_primary",
  };
}

export function validConnectedSourcePolicyDocument(): ConnectedSourcePolicyDocument {
  return {
    allowlist: [
      {
        host: "source.example.invalid",
        operations: ["fetch_metadata", "fetch_snapshot", "fetch_history"],
      },
    ],
    controls: {
      attribution: {
        required: true,
        text: "Example source attribution.",
      },
      cache: { maxSeconds: 300, mode: "owner_local" },
      deletion: { deadlineSeconds: 60, required: true },
      derivation: { mode: "owner_local" },
      display: { mode: "owner_local" },
      export: { mode: "prohibited" },
      history: { maxDays: 30, mode: "owner_local" },
      retention: { maxSeconds: 600 },
      termination: {
        deleteOnExpiry: true,
        deleteOnIncompatibility: true,
        deleteOnRevocation: true,
      },
    },
    legal: {
      licenseUri: "https://example.invalid/license",
      licenseVersion: "license_v1",
      termsUri: "https://example.invalid/terms",
      termsVersion: "terms_v1",
    },
    policyId: "connected_policy_primary",
    policyVersion: "policy_v1",
    profile: "personal_single_user_local_connected",
    provider: {
      entitlement: "owner_entitlement",
      product: "example_product",
      providerId: "example_provider",
      tier: "personal_tier",
    },
    schemaVersion: "1.0.0",
    sourceId: "connected_source_primary",
    useScope: {
      devices: ["owner_workstation"],
      geographies: ["US"],
      purposes: ["personal_research"],
    },
    validity: {
      effectiveAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2027-08-01T00:00:00.000Z",
      reviewAt: "2027-01-01T00:00:00.000Z",
      revokedAt: null,
    },
  };
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError("Invalid fixture.");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError("Invalid fixture.");
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
