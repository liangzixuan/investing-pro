import type { FastifyInstance } from "fastify";
import type { ConnectedSourceClock } from "@research-cockpit/connected-source-policy";

import { buildConnectedSourcePolicyApp } from "./connected-app";
import {
  CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY,
  CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY,
  CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY,
  ConnectedSourcePolicyCompositionError,
  loadConnectedSourcePolicyAdministration,
} from "./connected-source-policy-composition";
import { resolveDemoApiListenOptions } from "./listen-options";
import {
  PersonalOwnerSessionAuthority,
  PersonalOwnerSessionConfigurationError,
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
} from "./personal-owner-session";

export const CONNECTED_API_MODE =
  "personal_single_user_local_connected" as const;

export type ConnectedApiEnvironment = Readonly<
  Record<string, string | undefined>
>;
type MutableConnectedApiEnvironment = Record<string, string | undefined>;

const capturedConnectedApiEnvironments = new WeakSet<object>();
const OFFLINE_PRIVATE_ENVIRONMENT_KEYS = [
  "PERSONAL_FILING_QUALITY_RESULT_PATH",
  "PERSONAL_FILING_QUALITY_RESULT_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
  "RESEARCH_COCKPIT_VAULT_ROOT",
  "RESEARCH_COCKPIT_VAULT_STARTUP",
] as const;
const CONNECTED_PRIVATE_ENVIRONMENT_KEYS = [
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
  CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY,
  CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY,
  CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY,
  ...OFFLINE_PRIVATE_ENVIRONMENT_KEYS,
] as const;

export interface ConnectedApiDependencies {
  readonly connectedSourceClock?: ConnectedSourceClock;
}

export class ConnectedApiCompositionError extends Error {
  readonly code:
    | "CONNECTED_MODE_REQUIRED"
    | "CONNECTED_MODE_REJECTS_OFFLINE_CONFIGURATION"
    | "CONNECTED_SOURCE_POLICY_CONFIGURATION_REQUIRED"
    | "CONNECTED_SOURCE_POLICY_DEPENDENCY_INVALID"
    | "CONNECTED_SOURCE_POLICY_UNAVAILABLE"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED";

  constructor(code: ConnectedApiCompositionError["code"]) {
    super("The connected local API composition is unavailable.");
    this.name = "ConnectedApiCompositionError";
    this.code = code;
  }
}

export function captureConnectedApiEnvironment(
  environment: MutableConnectedApiEnvironment,
): ConnectedApiEnvironment {
  const captured: MutableConnectedApiEnvironment = {
    HOST: environment.HOST,
    PORT: environment.PORT,
    RESEARCH_COCKPIT_MODE: environment.RESEARCH_COCKPIT_MODE,
  };
  for (const key of CONNECTED_PRIVATE_ENVIRONMENT_KEYS) {
    captured[key] = environment[key];
    delete environment[key];
  }
  capturedConnectedApiEnvironments.add(captured);
  return captured;
}

export function disposeCapturedConnectedApiEnvironment(
  environment: ConnectedApiEnvironment,
): void {
  if (!capturedConnectedApiEnvironments.has(environment)) return;
  for (const key of CONNECTED_PRIVATE_ENVIRONMENT_KEYS) {
    delete (environment as MutableConnectedApiEnvironment)[key];
  }
  capturedConnectedApiEnvironments.delete(environment);
}

export function createConnectedConfiguredApp(
  environment: ConnectedApiEnvironment,
  dependencies: ConnectedApiDependencies = {},
): Promise<FastifyInstance> {
  try {
    return prepareConnectedConfiguredApp(environment, dependencies);
  } catch (error) {
    return Promise.reject(
      error instanceof Error
        ? error
        : new Error("The connected local API composition is unavailable."),
    );
  } finally {
    disposeCapturedConnectedApiEnvironment(environment);
  }
}

function prepareConnectedConfiguredApp(
  environment: ConnectedApiEnvironment,
  dependencies: ConnectedApiDependencies,
): Promise<FastifyInstance> {
  if (environment.RESEARCH_COCKPIT_MODE !== CONNECTED_API_MODE) {
    throw new ConnectedApiCompositionError("CONNECTED_MODE_REQUIRED");
  }
  if (
    OFFLINE_PRIVATE_ENVIRONMENT_KEYS.some(
      (key) => environment[key] !== undefined,
    )
  ) {
    throw new ConnectedApiCompositionError(
      "CONNECTED_MODE_REJECTS_OFFLINE_CONFIGURATION",
    );
  }
  const listenOptions = resolveDemoApiListenOptions(environment);
  const connectedEnvironment = connectedSourceConfiguration(environment);
  if (
    !Object.values(connectedEnvironment).some((value) => value !== undefined)
  ) {
    disposeConnectedSourceConfiguration(connectedEnvironment);
    throw new ConnectedApiCompositionError(
      "CONNECTED_SOURCE_POLICY_CONFIGURATION_REQUIRED",
    );
  }
  const clock = dependencies.connectedSourceClock;
  if (clock === undefined) {
    disposeConnectedSourceConfiguration(connectedEnvironment);
    throw new ConnectedApiCompositionError(
      "CONNECTED_SOURCE_POLICY_DEPENDENCY_INVALID",
    );
  }
  const bootstrapSecret = environment[PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY];
  if (bootstrapSecret === undefined) {
    disposeConnectedSourceConfiguration(connectedEnvironment);
    throw new ConnectedApiCompositionError(
      "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED",
    );
  }

  let ownerSession: PersonalOwnerSessionAuthority;
  try {
    ownerSession = PersonalOwnerSessionAuthority.create(bootstrapSecret);
  } catch (error) {
    disposeConnectedSourceConfiguration(connectedEnvironment);
    if (error instanceof PersonalOwnerSessionConfigurationError) {
      throw new ConnectedApiCompositionError(
        "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID",
      );
    }
    throw error;
  }
  return completeConnectedComposition(
    connectedEnvironment,
    clock,
    ownerSession,
    listenOptions,
  );
}

async function completeConnectedComposition(
  environment: MutableConnectedApiEnvironment,
  clock: ConnectedSourceClock,
  ownerSession: PersonalOwnerSessionAuthority,
  listenOptions: ReturnType<typeof resolveDemoApiListenOptions>,
): Promise<FastifyInstance> {
  try {
    let administration;
    try {
      administration = await loadConnectedSourcePolicyAdministration(
        environment,
        clock,
      );
    } catch (error) {
      if (error instanceof ConnectedSourcePolicyCompositionError) {
        throw new ConnectedApiCompositionError(
          "CONNECTED_SOURCE_POLICY_UNAVAILABLE",
        );
      }
      throw error;
    }
    if (administration === undefined) {
      throw new ConnectedApiCompositionError(
        "CONNECTED_SOURCE_POLICY_UNAVAILABLE",
      );
    }
    return await buildConnectedSourcePolicyApp(
      administration,
      ownerSession,
      listenOptions,
    );
  } catch (error) {
    ownerSession.close();
    throw error;
  } finally {
    disposeConnectedSourceConfiguration(environment);
  }
}

function connectedSourceConfiguration(
  environment: ConnectedApiEnvironment,
): MutableConnectedApiEnvironment {
  return {
    [CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY]:
      environment[CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY],
    [CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY]:
      environment[CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY],
    [CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY]:
      environment[CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY],
  };
}

function disposeConnectedSourceConfiguration(
  environment: MutableConnectedApiEnvironment,
): void {
  delete environment[CONNECTED_SOURCE_POLICY_BUNDLE_PATH_KEY];
  delete environment[CONNECTED_SOURCE_POLICY_BUNDLE_SHA256_KEY];
  delete environment[CONNECTED_SOURCE_POLICY_SECRET_REFERENCE_KEY];
}
