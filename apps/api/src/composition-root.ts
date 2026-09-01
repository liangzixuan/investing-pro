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

const LOCAL_API_PRIVATE_ENVIRONMENT_KEYS = [
  PERSONAL_OWNER_BOOTSTRAP_ENVIRONMENT_KEY,
  "PERSONAL_FILING_QUALITY_RESULT_PATH",
  "PERSONAL_FILING_QUALITY_RESULT_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_PATH",
  "PERSONAL_FILING_DOSSIER_RELEASE_BUNDLE_SHA256",
  "PERSONAL_FILING_DOSSIER_RELEASE_APPROVAL_PATH",
] as const;

export class LocalApiCompositionError extends Error {
  readonly code:
    | "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE"
    | "PERSONAL_CONFIGURATION_REQUIRES_DOSSIER_MODE"
    | "PERSONAL_CONFIGURATION_REQUIRES_FACT_RELEASE_MODE"
    | "PERSONAL_DOSSIER_UNAVAILABLE"
    | "PERSONAL_FACT_RELEASE_UNAVAILABLE"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_INVALID"
    | "PERSONAL_OWNER_SESSION_CONFIGURATION_REQUIRED"
    | "PERSONAL_READINESS_UNAVAILABLE";

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
