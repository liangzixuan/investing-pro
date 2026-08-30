import type { FastifyInstance } from "fastify";

import { resolveApiMode } from "./api-mode";
import { buildApp, buildPersonalReadinessApp } from "./app";
import { resolveDemoApiListenOptions } from "./listen-options";
import { loadPersonalQualityReadiness } from "./personal-quality-readiness";

export type LocalApiEnvironment = Readonly<Record<string, string | undefined>>;

export class LocalApiCompositionError extends Error {
  readonly code:
    | "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE"
    | "PERSONAL_READINESS_UNAVAILABLE";

  constructor(code: LocalApiCompositionError["code"]) {
    super("The requested local API composition is unavailable.");
    this.name = "LocalApiCompositionError";
    this.code = code;
  }
}

export async function createConfiguredApp(
  environment: LocalApiEnvironment,
): Promise<FastifyInstance> {
  const mode = resolveApiMode(environment);
  const listenOptions = resolveDemoApiListenOptions(environment);
  const hasPersonalConfiguration =
    environment.PERSONAL_FILING_QUALITY_RESULT_PATH !== undefined ||
    environment.PERSONAL_FILING_QUALITY_RESULT_SHA256 !== undefined;

  if (mode === "synthetic_demo") {
    if (hasPersonalConfiguration) {
      throw new LocalApiCompositionError(
        "PERSONAL_CONFIGURATION_REQUIRES_EXPLICIT_MODE",
      );
    }
    return buildApp(listenOptions);
  }

  const readiness = await loadPersonalQualityReadiness(environment);
  if (readiness === undefined) {
    throw new LocalApiCompositionError("PERSONAL_READINESS_UNAVAILABLE");
  }
  return buildPersonalReadinessApp(readiness, listenOptions);
}
