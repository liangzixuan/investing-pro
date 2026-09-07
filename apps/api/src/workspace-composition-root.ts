import type { FastifyInstance } from "fastify";
import { LocalResearchVault } from "@research-cockpit/local-research-vault";

import { resolveDemoApiListenOptions } from "./listen-options";
import {
  PersonalOwnerSessionAuthority,
  PersonalOwnerSessionConfigurationError,
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
} from "./personal-owner-session";
import {
  loadPersonalSecurityMasterCatalog,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY,
} from "./security-master-composition-root";
import {
  PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY,
  PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY,
} from "./vault-composition-root";
import { buildPersonalWorkspaceApp } from "./workspace-app";

export const PERSONAL_WORKSPACE_API_MODE = "personal_workspace" as const;

export type PersonalWorkspaceApiEnvironment = Readonly<
  Record<string, string | undefined>
>;
type MutablePersonalWorkspaceApiEnvironment = Record<
  string,
  string | undefined
>;

const capturedPersonalWorkspaceApiEnvironments = new WeakSet<object>();
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
] as const;
const PERSONAL_WORKSPACE_PRIVATE_ENVIRONMENT_KEYS = [
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY,
  PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY,
  PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY,
  PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY,
  ...FORBIDDEN_PRIVATE_CONFIGURATION_KEYS,
] as const;

export class PersonalWorkspaceApiCompositionError extends Error {
  readonly code:
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED"
    | "PERSONAL_WORKSPACE_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION"
    | "PERSONAL_WORKSPACE_MODE_REQUIRED"
    | "PERSONAL_WORKSPACE_UNAVAILABLE"
    | "SECURITY_MASTER_CONFIGURATION_REQUIRED"
    | "VAULT_CONFIGURATION_REQUIRED"
    | "VAULT_STARTUP_ACTION_INVALID";

  constructor(code: PersonalWorkspaceApiCompositionError["code"]) {
    super("The personal workspace API composition is unavailable.");
    this.name = "PersonalWorkspaceApiCompositionError";
    this.code = code;
  }
}

export function capturePersonalWorkspaceApiEnvironment(
  environment: MutablePersonalWorkspaceApiEnvironment,
): PersonalWorkspaceApiEnvironment {
  const captured: MutablePersonalWorkspaceApiEnvironment = {
    HOST: environment.HOST,
    PORT: environment.PORT,
    RESEARCH_COCKPIT_MODE: environment.RESEARCH_COCKPIT_MODE,
  };
  for (const key of PERSONAL_WORKSPACE_PRIVATE_ENVIRONMENT_KEYS) {
    captured[key] = environment[key];
    delete environment[key];
  }
  capturedPersonalWorkspaceApiEnvironments.add(captured);
  return captured;
}

export function disposeCapturedPersonalWorkspaceApiEnvironment(
  environment: PersonalWorkspaceApiEnvironment,
): void {
  if (!capturedPersonalWorkspaceApiEnvironments.has(environment)) return;
  for (const key of PERSONAL_WORKSPACE_PRIVATE_ENVIRONMENT_KEYS) {
    delete (environment as MutablePersonalWorkspaceApiEnvironment)[key];
  }
  capturedPersonalWorkspaceApiEnvironments.delete(environment);
}

export function createPersonalWorkspaceConfiguredApp(
  environment: PersonalWorkspaceApiEnvironment,
): Promise<FastifyInstance> {
  try {
    return preparePersonalWorkspaceConfiguredApp(environment);
  } catch (error) {
    return Promise.reject(
      error instanceof Error
        ? error
        : new Error("The personal workspace API composition is unavailable."),
    );
  } finally {
    disposeCapturedPersonalWorkspaceApiEnvironment(environment);
  }
}

async function preparePersonalWorkspaceConfiguredApp(
  environment: PersonalWorkspaceApiEnvironment,
): Promise<FastifyInstance> {
  if (environment.RESEARCH_COCKPIT_MODE !== PERSONAL_WORKSPACE_API_MODE) {
    throw new PersonalWorkspaceApiCompositionError(
      "PERSONAL_WORKSPACE_MODE_REQUIRED",
    );
  }
  if (
    FORBIDDEN_PRIVATE_CONFIGURATION_KEYS.some(
      (key) => environment[key] !== undefined,
    )
  ) {
    throw new PersonalWorkspaceApiCompositionError(
      "PERSONAL_WORKSPACE_MODE_REJECTS_OTHER_PRIVATE_CONFIGURATION",
    );
  }

  const snapshotPath =
    environment[PERSONAL_SECURITY_MASTER_SNAPSHOT_PATH_ENVIRONMENT_KEY];
  const expectedSnapshotSha256 =
    environment[PERSONAL_SECURITY_MASTER_SNAPSHOT_SHA256_ENVIRONMENT_KEY];
  if (snapshotPath === undefined || expectedSnapshotSha256 === undefined) {
    throw new PersonalWorkspaceApiCompositionError(
      "SECURITY_MASTER_CONFIGURATION_REQUIRED",
    );
  }
  const vaultRoot = environment[PERSONAL_VAULT_ROOT_ENVIRONMENT_KEY];
  if (vaultRoot === undefined) {
    throw new PersonalWorkspaceApiCompositionError(
      "VAULT_CONFIGURATION_REQUIRED",
    );
  }
  const vaultStartup = environment[PERSONAL_VAULT_STARTUP_ENVIRONMENT_KEY];
  if (vaultStartup !== "initialize" && vaultStartup !== "open") {
    throw new PersonalWorkspaceApiCompositionError(
      "VAULT_STARTUP_ACTION_INVALID",
    );
  }
  const bootstrapSecret = environment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY];
  if (bootstrapSecret === undefined) {
    throw new PersonalWorkspaceApiCompositionError(
      "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    );
  }

  let ownerSession: PersonalOwnerSessionAuthority;
  try {
    ownerSession = PersonalOwnerSessionAuthority.create(bootstrapSecret);
  } catch (error) {
    if (error instanceof PersonalOwnerSessionConfigurationError) {
      throw new PersonalWorkspaceApiCompositionError(
        "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      );
    }
    throw error;
  }

  let vault: LocalResearchVault | undefined;
  try {
    const catalog = await loadPersonalSecurityMasterCatalog(
      snapshotPath,
      expectedSnapshotSha256,
    );
    const startupOptions = { startupRootPath: vaultRoot };
    vault =
      vaultStartup === "initialize"
        ? await LocalResearchVault.initialize(startupOptions)
        : await LocalResearchVault.open(startupOptions);
    return await buildPersonalWorkspaceApp(
      catalog,
      vault,
      ownerSession,
      resolveDemoApiListenOptions(environment),
    );
  } catch (error) {
    vault?.close();
    ownerSession.close();
    if (error instanceof PersonalWorkspaceApiCompositionError) throw error;
    throw new PersonalWorkspaceApiCompositionError(
      "PERSONAL_WORKSPACE_UNAVAILABLE",
    );
  }
}
