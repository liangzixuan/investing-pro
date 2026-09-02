import type { FastifyInstance } from "fastify";

import { resolveApiMode } from "./api-mode";
import {
  buildApp,
  buildPersonalDossierApp,
  buildPersonalFactReleaseApp,
  buildPersonalReadinessApp,
} from "./app";
import { resolveDemoApiListenOptions } from "./listen-options";
import {
  PersonalOwnerSessionAuthority,
  PersonalOwnerSessionConfigurationError,
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
} from "./personal-owner-session";
import { loadPersonalQualityReadiness } from "./personal-quality-readiness";
import { loadPersonalDossierRelease } from "./personal-dossier-release";
import { loadPersonalSelectedFactRelease } from "./personal-selected-fact-release";

export type LocalApiEnvironment = Readonly<Record<string, string | undefined>>;

type MutableLocalApiEnvironment = Record<string, string | undefined>;

const capturedLocalApiEnvironments = new WeakSet<object>();

const CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY =
  "CONNECTED_SOURCE_POLICY_BUNDLE_PATH" as const;
const CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY =
  "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256" as const;
const CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY =
  "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE" as const;

const LOCAL_API_PRIVATE_ENVIRONMENT_KEYS = [
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
  CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY,
  CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY,
  CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY,
  "PERSONAL_FILING_QUALITY_RESULT_PATH",
  "PERSONAL_FILING_QUALITY_RESULT_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
  "PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH",
  "PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256",
  "RESEARCH_COCKPIT_VAULT_ROOT",
  "RESEARCH_COCKPIT_VAULT_STARTUP",
] as const;

export class LocalApiCompositionError extends Error {
  readonly code:
    | "CONNECTED_CONFIGURATION_REQUIRES_EXPLICIT_MODE"
    | "CONNECTED_MODE_REQUIRES_CONNECTED_ENTRYPOINT"
    | "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE"
    | "PERSONAL_CONFIGURATION_REQUIRES_DOSSIER_MODE"
    | "PERSONAL_CONFIGURATION_REQUIRES_FACT_RELEASE_MODE"
    | "PERSONAL_DOSSIER_UNAVAILABLE"
    | "PERSONAL_FACT_RELEASE_UNAVAILABLE"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED"
    | "PERSONAL_READINESS_UNAVAILABLE"
    | "SECURITY_MASTER_CONFIGURATION_REQUIRES_SECURITY_MASTER_ENTRYPOINT"
    | "SECURITY_MASTER_MODE_REQUIRES_SECURITY_MASTER_ENTRYPOINT"
    | "VAULT_CONFIGURATION_REQUIRES_VAULT_ENTRYPOINT"
    | "VAULT_MODE_REQUIRES_VAULT_ENTRYPOINT";

  constructor(code: LocalApiCompositionError["code"]) {
    super("The requested local API composition is unavailable.");
    this.name = "LocalApiCompositionError";
    this.code = code;
  }
}

export function captureLocalApiEnvironment(
  environment: MutableLocalApiEnvironment,
): LocalApiEnvironment {
  const captured = {
    HOST: environment.HOST,
    PORT: environment.PORT,
    RESEARCH_COCKPIT_MODE: environment.RESEARCH_COCKPIT_MODE,
    RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET:
      environment.RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET,
    CONNECTED_SOURCE_POLICY_BUNDLE_PATH:
      environment.CONNECTED_SOURCE_POLICY_BUNDLE_PATH,
    CONNECTED_SOURCE_POLICY_BUNDLE_SHA256:
      environment.CONNECTED_SOURCE_POLICY_BUNDLE_SHA256,
    CONNECTED_SOURCE_POLICY_SECRET_REFERENCE:
      environment.CONNECTED_SOURCE_POLICY_SECRET_REFERENCE,
    PERSONAL_FILING_QUALITY_RESULT_PATH:
      environment.PERSONAL_FILING_QUALITY_RESULT_PATH,
    PERSONAL_FILING_QUALITY_RESULT_SHA256:
      environment.PERSONAL_FILING_QUALITY_RESULT_SHA256,
    PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH:
      environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH,
    PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256:
      environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256,
    PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH:
      environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH,
    PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH:
      environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH,
    PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256:
      environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256,
    PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH:
      environment.PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH,
    PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH:
      environment.PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH,
    PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256:
      environment.PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256,
    RESEARCH_COCKPIT_VAULT_ROOT: environment.RESEARCH_COCKPIT_VAULT_ROOT,
    RESEARCH_COCKPIT_VAULT_STARTUP: environment.RESEARCH_COCKPIT_VAULT_STARTUP,
  };
  for (const key of LOCAL_API_PRIVATE_ENVIRONMENT_KEYS) {
    delete environment[key];
  }
  capturedLocalApiEnvironments.add(captured);
  return captured;
}

export function disposeCapturedLocalApiEnvironment(
  environment: LocalApiEnvironment,
): void {
  if (!capturedLocalApiEnvironments.has(environment)) return;
  for (const key of LOCAL_API_PRIVATE_ENVIRONMENT_KEYS) {
    delete (environment as MutableLocalApiEnvironment)[key];
  }
  capturedLocalApiEnvironments.delete(environment);
}

export function createConfiguredApp(
  environment: LocalApiEnvironment,
  runtimeSourceCommit?: string,
): Promise<FastifyInstance> {
  try {
    return prepareConfiguredApp(environment, runtimeSourceCommit);
  } catch (error) {
    return Promise.reject(
      error instanceof Error
        ? error
        : new Error("The requested local API composition is unavailable."),
    );
  } finally {
    disposeCapturedLocalApiEnvironment(environment);
  }
}

function prepareConfiguredApp(
  environment: LocalApiEnvironment,
  runtimeSourceCommit?: string,
): Promise<FastifyInstance> {
  const mode = resolveApiMode(environment);
  const listenOptions = resolveDemoApiListenOptions(environment);
  const hasPersonalConfiguration =
    environment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY] !== undefined ||
    environment.PERSONAL_FILING_QUALITY_RESULT_PATH !== undefined ||
    environment.PERSONAL_FILING_QUALITY_RESULT_SHA256 !== undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256 !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH !==
      undefined ||
    environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH !== undefined ||
    environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256 !== undefined ||
    environment.PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH !== undefined;
  const hasFactReleaseConfiguration =
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256 !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH !==
      undefined;
  const hasDossierConfiguration =
    environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH !== undefined ||
    environment.PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256 !== undefined ||
    environment.PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH !== undefined;
  const hasConnectedConfiguration = [
    CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY,
    CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY,
    CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY,
  ].some((key) => environment[key] !== undefined);
  const hasVaultConfiguration =
    environment.RESEARCH_COCKPIT_VAULT_ROOT !== undefined ||
    environment.RESEARCH_COCKPIT_VAULT_STARTUP !== undefined;
  const hasSecurityMasterConfiguration =
    environment.PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH !== undefined ||
    environment.PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256 !== undefined;
  if (mode === "personal_single_user_local_connected") {
    throw new LocalApiCompositionError(
      "CONNECTED_MODE_REQUIRES_CONNECTED_ENTRYPOINT",
    );
  }
  if (mode === "personal_single_user_local_vault") {
    throw new LocalApiCompositionError("VAULT_MODE_REQUIRES_VAULT_ENTRYPOINT");
  }
  if (mode === "personal_single_user_local_security_master") {
    throw new LocalApiCompositionError(
      "SECURITY_MASTER_MODE_REQUIRES_SECURITY_MASTER_ENTRYPOINT",
    );
  }
  if (hasConnectedConfiguration) {
    throw new LocalApiCompositionError(
      "CONNECTED_CONFIGURATION_REQUIRES_EXPLICIT_MODE",
    );
  }
  if (hasVaultConfiguration) {
    throw new LocalApiCompositionError(
      "VAULT_CONFIGURATION_REQUIRES_VAULT_ENTRYPOINT",
    );
  }
  if (hasSecurityMasterConfiguration) {
    throw new LocalApiCompositionError(
      "SECURITY_MASTER_CONFIGURATION_REQUIRES_SECURITY_MASTER_ENTRYPOINT",
    );
  }

  if (mode === "synthetic_demo") {
    if (hasPersonalConfiguration) {
      throw new LocalApiCompositionError(
        "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE",
      );
    }
    return buildApp(listenOptions);
  }
  if (mode === "personal_readiness" && hasFactReleaseConfiguration) {
    throw new LocalApiCompositionError(
      "PERSONAL_CONFIGURATION_REQUIRES_FACT_RELEASE_MODE",
    );
  }
  if (mode !== "personal_dossier" && hasDossierConfiguration) {
    throw new LocalApiCompositionError(
      "PERSONAL_CONFIGURATION_REQUIRES_DOSSIER_MODE",
    );
  }
  if (mode === "personal_dossier" && hasFactReleaseConfiguration) {
    throw new LocalApiCompositionError(
      "PERSONAL_CONFIGURATION_REQUIRES_FACT_RELEASE_MODE",
    );
  }

  const bootstrapSecret = environment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY];
  if (bootstrapSecret === undefined) {
    throw new LocalApiCompositionError(
      "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    );
  }
  let ownerSession: PersonalOwnerSessionAuthority;
  try {
    ownerSession = PersonalOwnerSessionAuthority.create(bootstrapSecret);
  } catch (error) {
    if (error instanceof PersonalOwnerSessionConfigurationError) {
      throw new LocalApiCompositionError(
        "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      );
    }
    throw error;
  }

  const compositionEnvironment = withoutOwnerBootstrap(environment);
  return completePersonalComposition(
    mode,
    compositionEnvironment,
    ownerSession,
    listenOptions,
    runtimeSourceCommit,
  );
}

async function completePersonalComposition(
  mode: "personal_dossier" | "personal_fact_release" | "personal_readiness",
  environment: LocalApiEnvironment,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: ReturnType<typeof resolveDemoApiListenOptions>,
  runtimeSourceCommit?: string,
): Promise<FastifyInstance> {
  try {
    if (mode === "personal_readiness") {
      const readiness = await loadPersonalQualityReadiness(environment);
      if (readiness === undefined) {
        throw new LocalApiCompositionError("PERSONAL_READINESS_UNAVAILABLE");
      }
      return buildPersonalReadinessApp(readiness, ownerSession, listenOptions);
    }

    if (mode === "personal_dossier") {
      const dossier = await loadPersonalDossierRelease(
        environment,
        runtimeSourceCommit,
      );
      if (dossier === undefined) {
        throw new LocalApiCompositionError("PERSONAL_DOSSIER_UNAVAILABLE");
      }
      return buildPersonalDossierApp(dossier, ownerSession, listenOptions);
    }

    const factRelease = await loadPersonalSelectedFactRelease(
      environment,
      runtimeSourceCommit,
    );
    if (factRelease === undefined) {
      throw new LocalApiCompositionError("PERSONAL_FACT_RELEASE_UNAVAILABLE");
    }
    return buildPersonalFactReleaseApp(
      factRelease,
      ownerSession,
      listenOptions,
    );
  } catch (error) {
    ownerSession.close();
    throw error;
  }
}

function withoutOwnerBootstrap(
  environment: LocalApiEnvironment,
): LocalApiEnvironment {
  const compositionEnvironment: MutableLocalApiEnvironment = {};
  for (const [key, value] of Object.entries(environment)) {
    if (key !== PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY) {
      compositionEnvironment[key] = value;
    }
  }
  return Object.freeze(compositionEnvironment);
}
