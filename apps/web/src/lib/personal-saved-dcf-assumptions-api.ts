import {
  PERSONAL_SAVED_DCF_IDENTITY_FIELDS,
  isPersonalSavedDcfPayload,
  isPersonalSavedDcfPutRequest,
  isPersonalSavedDcfResolveRequest,
  isPersonalSavedDcfResolved,
  type PersonalSavedDcfAssumptionsDto,
  type PersonalSavedDcfBindingDto,
  type PersonalSavedDcfEntryDto,
  type PersonalSavedDcfIdentityDto,
  type PersonalSavedDcfPayloadDto,
  type PersonalSavedDcfPutRequestDto,
  type PersonalSavedDcfResolvedDto,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_SAVED_DCF_PATH =
  "/v1/personal-filing/workspace/dcf-assumptions";
const recordId = "personal-dcf-assumptions";
const bareDigest = /^[0-9a-f]{64}$/u;

export interface PersonalSavedDcfAssumptions {
  readonly version: number;
  readonly payload: PersonalSavedDcfPayloadDto;
}

export function samePersonalSavedDcfIdentity(
  first: PersonalSavedDcfIdentityDto,
  second: PersonalSavedDcfIdentityDto,
): boolean {
  return PERSONAL_SAVED_DCF_IDENTITY_FIELDS.every(
    (key) => first[key] === second[key],
  );
}

export function samePersonalSavedDcfAssumptions(
  first: PersonalSavedDcfAssumptionsDto,
  second: PersonalSavedDcfAssumptionsDto,
): boolean {
  return (
    first.forecastYears === second.forecastYears &&
    first.taxShieldRatePercent === second.taxShieldRatePercent &&
    first.waccPercent === second.waccPercent &&
    first.terminalGrowthPercent === second.terminalGrowthPercent &&
    (["conservative", "base", "expansion"] as const).every(
      (name) =>
        first.scenarios[name].annualFcfProxyGrowthPercent ===
        second.scenarios[name].annualFcfProxyGrowthPercent,
    )
  );
}

export function samePersonalSavedDcfEntry(
  first: PersonalSavedDcfEntryDto,
  second: PersonalSavedDcfEntryDto,
): boolean {
  return (
    samePersonalSavedDcfIdentity(first.identity, second.identity) &&
    first.createdAgainstCatalogSnapshotSha256 ===
      second.createdAgainstCatalogSnapshotSha256 &&
    first.modelVersion === second.modelVersion &&
    samePersonalSavedDcfAssumptions(first.assumptions, second.assumptions)
  );
}

export async function fetchPersonalSavedDcfAssumptions(
  signal: AbortSignal,
): Promise<PersonalSavedDcfAssumptions | null> {
  const response = await requestPersonalWorkspace(PERSONAL_SAVED_DCF_PATH, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw responseError(response);
  const value = await readJson(response);
  if (
    response.status !== 200 ||
    !keys(value, [
      "createdAt",
      "id",
      "kind",
      "payload",
      "payloadSha256",
      "profile",
      "updatedAt",
      "version",
    ]) ||
    value.id !== recordId ||
    value.kind !== "settings" ||
    value.profile !== "personal_single_user_local_vault" ||
    !instant(value.createdAt) ||
    !instant(value.updatedAt) ||
    value.updatedAt < value.createdAt ||
    !integer(value.version, 1) ||
    !matches(value.payloadSha256, bareDigest) ||
    !isPersonalSavedDcfPayload(value.payload) ||
    response.headers.get("ETag") !== versionEtag(value.version)
  )
    throw new PersonalWorkspaceApiError("invalid_response");
  return { version: value.version, payload: value.payload };
}

export async function putPersonalSavedDcfAssumptions(
  currentVersion: number,
  request: PersonalSavedDcfPutRequestDto,
  signal: AbortSignal,
): Promise<PersonalSavedDcfAssumptions> {
  if (
    !integer(currentVersion, 0, Number.MAX_SAFE_INTEGER - 1) ||
    !isPersonalSavedDcfPutRequest(request) ||
    (request.operation === "clear" && currentVersion === 0)
  )
    throw new PersonalWorkspaceApiError("invalid_request");
  const submitted = structuredClone(request);
  let idempotencyKey: string;
  try {
    idempotencyKey = `saved-dcf-${globalThis.crypto.randomUUID()}`;
  } catch {
    throw new PersonalWorkspaceApiError("unavailable");
  }
  const creating = currentVersion === 0;
  const response = await requestPersonalWorkspace(PERSONAL_SAVED_DCF_PATH, {
    method: "POST",
    signal,
    body: JSON.stringify(submitted),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(creating
        ? { "If-None-Match": "*" }
        : { "If-Match": versionEtag(currentVersion) }),
      "X-Research-Cockpit-Idempotency-Key": idempotencyKey,
      "X-Research-Cockpit-Intent": creating
        ? "personal-vault-create"
        : "personal-vault-update",
    },
  });
  if (!response.ok) throw responseError(response);
  const value = await readJson(response);
  if (
    !keys(value, [
      "committedAt",
      "digestSha256",
      "id",
      "kind",
      "operation",
      "profile",
      "replayed",
      "version",
    ]) ||
    value.id !== recordId ||
    value.kind !== "settings" ||
    value.operation !== "put" ||
    value.profile !== "personal_single_user_local_vault" ||
    !instant(value.committedAt) ||
    !matches(value.digestSha256, bareDigest) ||
    typeof value.replayed !== "boolean" ||
    value.version !== currentVersion + 1 ||
    response.status !== (creating ? 201 : 200) ||
    response.headers.get("ETag") !== versionEtag(currentVersion + 1)
  )
    throw new PersonalWorkspaceApiError("invalid_response");
  return { version: currentVersion + 1, payload: submitted.payload };
}

export async function resolvePersonalSavedDcfAssumptions(
  currentVersion: number,
  identity: PersonalSavedDcfIdentityDto,
  context: PersonalSavedDcfBindingDto,
  signal: AbortSignal,
): Promise<PersonalSavedDcfResolvedDto> {
  const request = { ...context, identity, expectedVersion: currentVersion };
  if (!isPersonalSavedDcfResolveRequest(request))
    throw new PersonalWorkspaceApiError("invalid_request");
  const submitted = structuredClone(request);
  const response = await requestPersonalWorkspace(
    `${PERSONAL_SAVED_DCF_PATH}/resolve`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submitted),
      signal,
    },
  );
  if (!response.ok) throw responseError(response);
  const value = await readJson(response);
  if (
    response.status !== 200 ||
    !isPersonalSavedDcfResolved(value) ||
    value.catalogSnapshotSha256 !== submitted.catalogSnapshotSha256 ||
    value.watchlistVersion !== submitted.watchlistVersion ||
    value.savedAssumptionsVersion !== currentVersion ||
    !samePersonalSavedDcfIdentity(value.entry.identity, submitted.identity)
  )
    throw new PersonalWorkspaceApiError("invalid_response");
  return value;
}

function keys<const T extends readonly string[]>(
  value: unknown,
  expected: T,
): value is Record<T[number], unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
function integer(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
function instant(value: unknown): value is string {
  return (
    matches(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function versionEtag(version: number): string {
  return `"v${String(version)}"`;
}
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
}
function responseError(response: Response): PersonalWorkspaceApiError {
  const code =
    response.status === 401 || response.status === 403
      ? "session_unavailable"
      : response.status === 409
        ? "conflict"
        : response.status === 400
          ? "invalid_request"
          : response.status === 404
            ? "not_covered"
            : response.status === 429
              ? "rate_limited"
              : "unavailable";
  return new PersonalWorkspaceApiError(code);
}
