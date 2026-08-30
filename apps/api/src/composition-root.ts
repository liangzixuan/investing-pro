import type { FastifyInstance } from "fastify";

import { resolveApiMode } from "./api-mode";
import {
  buildApp,
  buildPersonalFactReleaseApp,
  buildPersonalReadinessApp,
} from "./app";
import { resolveDemoApiListenOptions } from "./listen-options";
import { loadPersonalQualityReadiness } from "./personal-quality-readiness";
import { loadPersonalSelectedFactRelease } from "./personal-selected-fact-release";

export type LocalApiEnvironment = Readonly<Record<string, string | undefined>>;

export class LocalApiCompositionError extends Error {
  readonly code:
    | "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE"
    | "PERSONAL_CONFIGURATION_REQUIRES_FACT_RELEASE_MODE"
    | "PERSONAL_FACT_RELEASE_UNAVAILABLE"
    | "PERSONAL_READINESS_UNAVAILABLE";

  constructor(code: LocalApiCompositionError["code"]) {
    super("The requested local API composition is unavailable.");
    this.name = "LocalApiCompositionError";
    this.code = code;
  }
}

export async function createConfiguredApp(
  environment: LocalApiEnvironment,
  runtimeSourceCommit?: string,
): Promise<FastifyInstance> {
  const mode = resolveApiMode(environment);
  const listenOptions = resolveDemoApiListenOptions(environment);
  const hasPersonalConfiguration =
    environment.PERSONAL_FILING_QUALITY_RESULT_PATH !== undefined ||
    environment.PERSONAL_FILING_QUALITY_RESULT_SHA256 !== undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256 !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH !==
      undefined;
  const hasFactReleaseConfiguration =
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256 !==
      undefined ||
    environment.PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH !==
      undefined;

  if (mode === "synthetic_demo") {
    if (hasPersonalConfiguration) {
      throw new LocalApiCompositionError(
        "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE",
      );
    }
    return buildApp(listenOptions);
  }

  if (mode === "personal_readiness") {
    if (hasFactReleaseConfiguration) {
      throw new LocalApiCompositionError(
        "PERSONAL_CONFIGURATION_REQUIRES_FACT_RELEASE_MODE",
      );
    }
    const readiness = await loadPersonalQualityReadiness(environment);
    if (readiness === undefined) {
      throw new LocalApiCompositionError("PERSONAL_READINESS_UNAVAILABLE");
    }
    return buildPersonalReadinessApp(readiness, listenOptions);
  }

  const factRelease = await loadPersonalSelectedFactRelease(
    environment,
    runtimeSourceCommit,
  );
  if (factRelease === undefined) {
    throw new LocalApiCompositionError("PERSONAL_FACT_RELEASE_UNAVAILABLE");
  }
  return buildPersonalFactReleaseApp(factRelease, listenOptions);
}
