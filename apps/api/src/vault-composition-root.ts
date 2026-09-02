import type { FastifyInstance } from "fastify";
import { LocalResearchVault } from "@research-cockpit/local-research-vault";

import { resolveDemoApiListenOptions } from "./listen-options";
import {
  PersonalOwnerSessionAuthority,
  PersonalOwnerSessionConfigurationError,
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
} from "./personal-owner-session";
import { buildPersonalVaultApp } from "./vault-app";

export const VAULT_API_MODE = "personal_single_user_local_vault" as const;
export const PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY =
  "RESEARCH_COCKPIT_VAULT_ROOT" as const;
export const PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY =
  "RESEARCH_COCKPIT_VAULT_STARTUP" as const;

export type VaultApiEnvironment = Readonly<Record<string, string | undefined>>;
type MutableVaultApiEnvironment = Record<string, string | undefined>;

const capturedVaultApiEnvironments = new WeakSet<object>();
const FORBIDDEN_PRIVATE_CONFIGURATION_KEYS = [
  "CONNECTED_SOURCE_POLICY_BUNDLE_PATH",
  "CONNECTED_SOURCE_POLICY_BUNDLE_SHA256",
  "CONNECTED_SOURCE_POLICY_SECRET_REFERENCE",
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
] as const;
const VAULT_PRIVATE_ENVIRONMENT_KEYS = [
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
  PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY,
  PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY,
  ...FORBIDDEN_PRIVATE_CONFIGURATION_KEYS,
] as const;

export class VaultApiCompositionError extends Error {
  readonly code:
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED"
    | "VAULT_CONFIGURATION_REQUIRED"
    | "VAULT_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION"
    | "VAULT_MODE_REQUIRED"
    | "VAULT_STARTUP_ACTION_INVALID"
    | "VAULT_UNAVAILABLE";

  constructor(code: VaultApiCompositionError["code"]) {
    super("The personal vault API composition is unavailable.");
    this.name = "VaultApiCompositionError";
    this.code = code;
  }
}

export function captureVaultApiEnvironment(
  environment: MutableVaultApiEnvironment,
): VaultApiEnvironment {
  const captured: MutableVaultApiEnvironment = {
    HOST: environment.HOST,
    PORT: environment.PORT,
    RESEARCH_COCKPIT_MODE: environment.RESEARCH_COCKPIT_MODE,
  };
  for (const key of VAULT_PRIVATE_ENVIRONMENT_KEYS) {
    captured[key] = environment[key];
    delete environment[key];
  }
  capturedVaultApiEnvironments.add(captured);
  return captured;
}

export function disposeCapturedVaultApiEnvironment(
  environment: VaultApiEnvironment,
): void {
  if (!capturedVaultApiEnvironments.has(environment)) return;
  for (const key of VAULT_PRIVATE_ENVIRONMENT_KEYS) {
    delete (environment as MutableVaultApiEnvironment)[key];
  }
  capturedVaultApiEnvironments.delete(environment);
}

export function createVaultConfiguredApp(
  environment: VaultApiEnvironment,
): Promise<FastifyInstance> {
  try {
    return prepareVaultConfiguredApp(environment);
  } catch (error) {
    return Promise.reject(
      error instanceof Error
        ? error
        : new Error("The personal vault API composition is unavailable."),
    );
  } finally {
    disposeCapturedVaultApiEnvironment(environment);
  }
}

async function prepareVaultConfiguredApp(
  environment: VaultApiEnvironment,
): Promise<FastifyInstance> {
  if (environment.RESEARCH_COCKPIT_MODE !== VAULT_API_MODE) {
    throw new VaultApiCompositionError("VAULT_MODE_REQUIRED");
  }
  if (
    FORBIDDEN_PRIVATE_CONFIGURATION_KEYS.some(
      (key) => environment[key] !== undefined,
    )
  ) {
    throw new VaultApiCompositionError(
      "VAULT_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
    );
  }
  const startupRoot = environment[PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY];
  if (startupRoot === undefined) {
    throw new VaultApiCompositionError("VAULT_CONFIGURATION_REQUIRED");
  }
  const startupAction = environment[PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY];
  if (startupAction !== "initialize" && startupAction !== "open") {
    throw new VaultApiCompositionError("VAULT_STARTUP_ACTION_INVALID");
  }
  const bootstrapSecret = environment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY];
  if (bootstrapSecret === undefined) {
    throw new VaultApiCompositionError(
      "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    );
  }
  let ownerSession: PersonalOwnerSessionAuthority;
  try {
    ownerSession = PersonalOwnerSessionAuthority.create(bootstrapSecret);
  } catch (error) {
    if (error instanceof PersonalOwnerSessionConfigurationError) {
      throw new VaultApiCompositionError(
        "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      );
    }
    throw error;
  }
  let vault: LocalResearchVault | undefined;
  try {
    const startupOptions = { startupRootPath: startupRoot };
    vault =
      startupAction === "initialize"
        ? await LocalResearchVault.initialize(startupOptions)
        : await LocalResearchVault.open(startupOptions);
    return await buildPersonalVaultApp(
      vault,
      ownerSession,
      resolveDemoApiListenOptions(environment),
    );
  } catch (error) {
    vault?.close();
    ownerSession.close();
    if (error instanceof VaultApiCompositionError) throw error;
    throw new VaultApiCompositionError("VAULT_UNAVAILABLE");
  }
}
