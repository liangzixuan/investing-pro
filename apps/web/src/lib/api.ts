import type {
  DossierDto,
  PersonalFilingReadinessDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3100";

const personalFilingReadinessKeys = [
  "dataPlane",
  "profile",
  "schemaVersion",
  "status",
] as const;

function isPersonalFilingReadinessDto(
  value: unknown,
): value is PersonalFilingReadinessDto {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value).sort();
  if (
    keys.length !== personalFilingReadinessKeys.length ||
    !keys.every((key, index) => key === personalFilingReadinessKeys[index])
  ) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === "1.0.0" &&
    candidate.profile === "personal_single_user_local" &&
    candidate.status === "quality_gate_ready" &&
    candidate.dataPlane === "disabled"
  );
}

export async function fetchDossier(
  symbol: string,
  knownAt: string,
  signal: AbortSignal,
): Promise<DossierDto> {
  const url = new URL(
    `/v1/instruments/${encodeURIComponent(symbol)}/dossier`,
    apiBaseUrl,
  );
  url.searchParams.set("knownAt", knownAt);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const problem = (await response.json()) as ProblemDetailsDto;
    throw new Error(problem.detail || problem.title);
  }
  return (await response.json()) as DossierDto;
}

export async function fetchPersonalFilingReadiness(
  signal: AbortSignal,
): Promise<boolean> {
  const url = new URL("/v1/personal-filing/readiness", apiBaseUrl);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!response.ok) return false;

    return isPersonalFilingReadinessDto(await response.json());
  } catch {
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return false;
  }
}
