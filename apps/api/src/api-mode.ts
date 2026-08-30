export type ApiMode = "synthetic_demo" | "personal_readiness";

export type ApiModeEnvironment = Readonly<Record<string, string | undefined>>;

export class ApiModeError extends Error {
  readonly code = "INVALID_API_MODE" as const;

  constructor() {
    super("The API mode is invalid.");
    this.name = "ApiModeError";
  }
}

export function resolveApiMode(environment: ApiModeEnvironment): ApiMode {
  const value = environment.RESEARCH_COCKPIT_MODE ?? "synthetic_demo";
  if (value !== "synthetic_demo" && value !== "personal_readiness") {
    throw new ApiModeError();
  }
  return value;
}
