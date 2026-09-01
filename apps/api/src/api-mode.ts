export type ApiMode =
  | "synthetic_demo"
  | "personal_readiness"
  | "personal_fact_release"
  | "personal_dossier"
  | "personal_single_user_local_connected";

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
  if (
    value !== "synthetic_demo" &&
    value !== "personal_readiness" &&
    value !== "personal_fact_release" &&
    value !== "personal_dossier" &&
    value !== "personal_single_user_local_connected"
  ) {
    throw new ApiModeError();
  }
  return value;
}
