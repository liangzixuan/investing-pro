import {
  PERSONAL_FINANCIAL_COMPARISON_IDENTITY_FIELDS,
  isPersonalFinancialComparisonSelectionPayload,
  isPersonalFinancialComparisonSelectionBinding,
  isPersonalFinancialComparisonSelectionPutRequest,
  isPersonalFinancialComparisonSelectionResolved,
  type PersonalFinancialComparisonSelectionBindingDto,
  type PersonalFinancialComparisonSelectionPayloadDto,
  type PersonalFinancialComparisonSelectionResolvedDto,
  type PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_FINANCIAL_COMPARISON_SELECTION_PATH =
  "/v1/personal-filing/workspace/financial-screen/saved-comparison";
const recordId = "financial-comparison-selection";
const bareDigest = /^[0-9a-f]{64}$/u;
const identityKeys = PERSONAL_FINANCIAL_COMPARISON_IDENTITY_FIELDS;

export interface PersonalFinancialComparisonSelection {
  readonly version: number;
  readonly payload: PersonalFinancialComparisonSelectionPayloadDto;
}

export { isPersonalFinancialComparisonSelectionPayload };

/** Compare all admitted identity fields and order, never ticker alone. */
export function samePersonalFinancialComparisonMembers(
  first: readonly PersonalSecurityMasterScreenRowDto[],
  second: readonly PersonalSecurityMasterScreenRowDto[],
): boolean {
  return (
    first.length === second.length &&
    first.every((member, index) => {
      const other = second[index];
      return (
        other !== undefined &&
        identityKeys.every((key) => member[key] === other[key])
      );
    })
  );
}

export async function fetchPersonalFinancialComparisonSelection(
  signal: AbortSignal,
): Promise<PersonalFinancialComparisonSelection | null> {
  const response = await requestPersonalWorkspace(
    PERSONAL_FINANCIAL_COMPARISON_SELECTION_PATH,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    },
  );
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
    !isPersonalFinancialComparisonSelectionPayload(value.payload) ||
    response.headers.get("ETag") !== versionEtag(value.version)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return { version: value.version, payload: value.payload };
}

export async function savePersonalFinancialComparisonSelection(
  currentVersion: number,
  payload: PersonalFinancialComparisonSelectionPayloadDto,
  context: PersonalFinancialComparisonSelectionBindingDto | null,
  signal: AbortSignal,
): Promise<PersonalFinancialComparisonSelection> {
  if (
    !integer(currentVersion, 0, Number.MAX_SAFE_INTEGER - 1) ||
    !isPersonalFinancialComparisonSelectionPutRequest({ payload, context })
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const submitted = structuredClone({ payload, context });
  let idempotencyKey: string;
  try {
    idempotencyKey = `financial-comparison-${globalThis.crypto.randomUUID()}`;
  } catch {
    throw new PersonalWorkspaceApiError("unavailable");
  }
  const creating = currentVersion === 0;
  const response = await requestPersonalWorkspace(
    PERSONAL_FINANCIAL_COMPARISON_SELECTION_PATH,
    {
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
    },
  );
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
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return { version: currentVersion + 1, payload: submitted.payload };
}

export async function resolvePersonalFinancialComparisonSelection(
  currentVersion: number,
  context: PersonalFinancialComparisonSelectionBindingDto,
  signal: AbortSignal,
): Promise<PersonalFinancialComparisonSelectionResolvedDto> {
  if (
    !integer(currentVersion, 1) ||
    !isPersonalFinancialComparisonSelectionBinding(context)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const submitted = { ...context, expectedVersion: currentVersion };
  const response = await requestPersonalWorkspace(
    `${PERSONAL_FINANCIAL_COMPARISON_SELECTION_PATH}/resolve`,
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
    !isPersonalFinancialComparisonSelectionResolved(value) ||
    value.catalogSnapshotSha256 !== submitted.catalogSnapshotSha256 ||
    value.watchlistVersion !== submitted.watchlistVersion ||
    value.savedSelectionVersion !== currentVersion
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
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
