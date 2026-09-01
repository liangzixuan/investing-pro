import type {
  DossierDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";

export {
  bootstrapOwnerSession,
  fetchOwnerSession,
  fetchPersonalFilingDossier,
  fetchPersonalFilingReadiness,
  fetchPersonalFilingSelectedFacts,
  logoutOwnerSession,
  parsePersonalFilingDossier,
  revokeOwnerSession,
  rotateOwnerSession,
} from "./personal-api";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3100";

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
