import {
  CONNECTED_SOURCE_POLICY_OPERATIONS,
  CONNECTED_SOURCE_POLICY_PROFILE,
  CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
  type ConnectedSourcePolicyConfig,
  type ConnectedSourcePolicyDocument,
} from "./connected-source-policy";

export const SYNTHETIC_CONNECTED_SOURCE_NOW =
  "2026-09-01T12:00:00.000Z" as const;

export function buildSyntheticConnectedSourcePolicyConfig(): ConnectedSourcePolicyConfig {
  return {
    budgets: {
      currency: "USD",
      estimatedSpendMicrounitsLimit: 10_000,
      requestByteLimit: 10_000,
      requestLimit: 4,
      responseByteLimit: 20_000,
      storageByteLimit: 20_000,
    },
    enabled: true,
    intendedUse: {
      attributionSupported: true,
      cacheSeconds: 300,
      deletionSupported: true,
      derivation: "owner_local",
      device: "owner_local_device",
      display: "owner_local",
      export: "owner_local",
      geography: "US",
      historyDays: 365,
      purpose: "personal_investment_research",
      retentionSeconds: 86_400,
      terminationSupported: true,
    },
    profile: CONNECTED_SOURCE_POLICY_PROFILE,
    schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
    secretReference: "owner-local-ref:v1:synthetic:primary",
    sourceId: "synthetic_source",
  };
}

export function buildSyntheticConnectedSourcePolicyDocument(): ConnectedSourcePolicyDocument {
  return {
    allowlist: [
      {
        host: "source.example.invalid",
        operations: [...CONNECTED_SOURCE_POLICY_OPERATIONS],
      },
    ],
    controls: {
      attribution: {
        required: true,
        text: "Synthetic source attribution.",
      },
      cache: { maxSeconds: 300, mode: "owner_local" },
      deletion: { deadlineSeconds: 3_600, required: true },
      derivation: { mode: "owner_local" },
      display: { mode: "owner_local" },
      export: { mode: "owner_local" },
      history: { maxDays: 365, mode: "owner_local" },
      retention: { maxSeconds: 86_400 },
      termination: {
        deleteOnExpiry: true,
        deleteOnIncompatibility: true,
        deleteOnRevocation: true,
      },
    },
    legal: {
      licenseUri: "https://legal.example.invalid/license/v1",
      licenseVersion: "synthetic-v1",
      termsUri: "https://legal.example.invalid/terms/v1",
      termsVersion: "synthetic-v1",
    },
    policyId: "synthetic_connected_source_policy",
    policyVersion: "1.0.0",
    profile: CONNECTED_SOURCE_POLICY_PROFILE,
    provider: {
      entitlement: "synthetic_entitlement",
      product: "synthetic_product",
      providerId: "synthetic_provider",
      tier: "synthetic_tier",
    },
    schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
    sourceId: "synthetic_source",
    useScope: {
      devices: ["owner_local_device"],
      geographies: ["US"],
      purposes: ["personal_investment_research"],
    },
    validity: {
      effectiveAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      reviewAt: "2026-12-01T00:00:00.000Z",
      revokedAt: null,
    },
  };
}

export function buildSyntheticConnectedSourceReservationInput(
  replayKey = "request:1",
) {
  return {
    host: "source.example.invalid",
    maximumEstimatedSpendMicrounits: 500,
    maximumResponseBytes: 1_000,
    maximumStorageBytes: 1_000,
    operation: "fetch_snapshot" as const,
    replayKey,
    requestBytes: 3,
    sourceId: "synthetic_source",
  };
}
