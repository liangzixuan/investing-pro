import type {
  DossierDto,
  PersonalFilingReadinessDto,
  PersonalFilingSelectedFactsDto,
  ProblemDetailsDto,
} from "@research-cockpit/contracts";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3100";
const ownerSessionPath = "/v1/personal-filing/session" as const;
const ownerBootstrapSecretPattern = /^[0-9a-f]{64}$/u;
const literalLoopbackHttpOriginPattern =
  /^http:\/\/(?:127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})$/u;

const ownerSessionRequestOptions = Object.freeze({
  cache: "no-store",
  credentials: "include",
  redirect: "error",
  referrerPolicy: "no-referrer",
} satisfies Pick<
  RequestInit,
  "cache" | "credentials" | "redirect" | "referrerPolicy"
>);

const personalFilingReadinessKeys = [
  "dataPlane",
  "profile",
  "schemaVersion",
  "status",
] as const;

const personalFactKeys = [
  "assets",
  "cash",
  "debt",
  "diluted_shares",
  "free_cash_flow",
  "gross_profit",
  "net_income",
  "operating_cash_flow",
  "operating_income",
  "revenue",
] as const;
const selectedFactsKeys = [
  "facts",
  "profile",
  "schemaVersion",
  "status",
] as const;
const selectedFactKeys = [
  "key",
  "periodEnd",
  "periodStart",
  "unit",
  "value",
] as const;
const canonicalDecimal = /^(?:0|-?[1-9][0-9]{0,25})(?:\.[0-9]{0,11}[1-9])?$/u;
const isoDate = /^\d{4}-\d{2}-\d{2}$/u;

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
  const personalBaseUrl = getPersonalApiBaseUrl();
  if (personalBaseUrl === null) return false;
  const url = new URL("/v1/personal-filing/readiness", personalBaseUrl);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
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

export async function fetchPersonalFilingSelectedFacts(
  signal: AbortSignal,
): Promise<PersonalFilingSelectedFactsDto | null> {
  const personalBaseUrl = getPersonalApiBaseUrl();
  if (personalBaseUrl === null) return null;
  const url = new URL("/v1/personal-filing/selected-facts", personalBaseUrl);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) return null;
    return parsePersonalFilingSelectedFacts(await response.json());
  } catch {
    if (signal.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return null;
  }
}

export function fetchOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(ownerSessionPath, { method: "GET", signal });
}

export function bootstrapOwnerSession(
  bootstrapSecret: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (!ownerBootstrapSecretPattern.test(bootstrapSecret)) {
    return Promise.resolve(false);
  }
  return requestOwnerSession(`${ownerSessionPath}/bootstrap`, {
    method: "POST",
    headers: {
      "X-Research-Cockpit-Bootstrap": bootstrapSecret,
      "X-Research-Cockpit-Intent": "bootstrap",
    },
    signal,
  });
}

export function logoutOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(`${ownerSessionPath}/logout`, {
    method: "POST",
    headers: { "X-Research-Cockpit-Intent": "logout" },
    signal,
  });
}

export function rotateOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(`${ownerSessionPath}/rotate`, {
    method: "POST",
    headers: { "X-Research-Cockpit-Intent": "rotate" },
    signal,
  });
}

export function revokeOwnerSession(signal: AbortSignal): Promise<boolean> {
  return requestOwnerSession(`${ownerSessionPath}/revoke`, {
    method: "POST",
    headers: { "X-Research-Cockpit-Intent": "revoke" },
    signal,
  });
}

async function requestOwnerSession(
  path: string,
  options: Pick<RequestInit, "headers" | "method" | "signal">,
): Promise<boolean> {
  const signal = options.signal;
  const personalBaseUrl = getPersonalApiBaseUrl();
  if (personalBaseUrl === null) return false;
  try {
    const response = await fetch(new URL(path, personalBaseUrl), {
      ...ownerSessionRequestOptions,
      ...options,
    });
    return response.status === 204;
  } catch {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    return false;
  }
}

function getPersonalApiBaseUrl(): string | null {
  if (hasControllingServiceWorker()) return null;
  const match = literalLoopbackHttpOriginPattern.exec(apiBaseUrl);
  if (match?.[0] !== apiBaseUrl) return null;

  const port = Number(match[1]);
  return port >= 1 && port <= 65_535 ? apiBaseUrl : null;
}

function hasControllingServiceWorker(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    return navigator.serviceWorker?.controller != null;
  } catch {
    return true;
  }
}

function parsePersonalFilingSelectedFacts(
  value: unknown,
): PersonalFilingSelectedFactsDto | null {
  if (!hasExactKeys(value, selectedFactsKeys)) return null;
  if (
    value.schemaVersion !== "1.0.0" ||
    value.profile !== "personal_single_user_local" ||
    value.status !== "selected_facts_released" ||
    !Array.isArray(value.facts) ||
    value.facts.length < 1 ||
    value.facts.length > personalFactKeys.length
  ) {
    return null;
  }

  const facts: PersonalFilingSelectedFactsDto["facts"][number][] = [];
  let previousIndex = -1;
  for (const rawFact of value.facts) {
    if (!hasExactKeys(rawFact, selectedFactKeys)) return null;
    const keyIndex = personalFactKeys.indexOf(
      rawFact.key as (typeof personalFactKeys)[number],
    );
    if (
      keyIndex <= previousIndex ||
      typeof rawFact.value !== "string" ||
      !canonicalDecimal.test(rawFact.value) ||
      typeof rawFact.periodEnd !== "string" ||
      !isRealIsoDate(rawFact.periodEnd) ||
      !isValidFactContract(rawFact, keyIndex)
    ) {
      return null;
    }
    previousIndex = keyIndex;
    facts.push(
      Object.freeze({
        key: rawFact.key,
        periodEnd: rawFact.periodEnd,
        periodStart: rawFact.periodStart,
        unit: rawFact.unit,
        value: rawFact.value,
      }) as PersonalFilingSelectedFactsDto["facts"][number],
    );
  }

  return Object.freeze({
    schemaVersion: "1.0.0",
    profile: "personal_single_user_local",
    status: "selected_facts_released",
    facts: Object.freeze(facts),
  });
}

function isValidFactContract(
  fact: Record<string, unknown>,
  keyIndex: number,
): boolean {
  if (keyIndex < 0) return false;
  const key = personalFactKeys[keyIndex];
  const instant = key === "assets" || key === "cash" || key === "debt";
  const expectedUnit = key === "diluted_shares" ? "shares" : "USD";
  if (fact.unit !== expectedUnit) return false;
  if (instant) return fact.periodStart === null;
  return (
    typeof fact.periodStart === "string" &&
    isRealIsoDate(fact.periodStart) &&
    fact.periodStart < (fact.periodEnd as string)
  );
}

function isRealIsoDate(value: string): boolean {
  if (!isoDate.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(instant.getTime()) &&
    instant.toISOString() === `${value}T00:00:00.000Z`
  );
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    actual.every((key, index) => key === keys[index])
  );
}
