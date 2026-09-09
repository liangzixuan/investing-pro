import {
  isPersonalPortfolioPayload,
  type PersonalPortfolioPayload,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH =
  "/v1/personal-filing/workspace/portfolio/main" as const;
const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export type PersonalPortfolioRecord = Readonly<{
  profile: "personal_single_user_local_vault";
  kind: "portfolio";
  id: "main";
  version: number;
  payload: PersonalPortfolioPayload;
  payloadSha256: string;
  createdAt: string;
  updatedAt: string;
}>;

export type PersonalPortfolioMutationReceipt = Readonly<{
  profile: "personal_single_user_local_vault";
  operation: "put";
  kind: "portfolio";
  id: "main";
  version: number;
  digestSha256: string;
  committedAt: string;
  replayed: boolean;
}>;

export async function fetchPersonalPortfolio(
  signal?: AbortSignal,
): Promise<PersonalPortfolioRecord | null> {
  const response = await requestPersonalWorkspace(
    PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
    {
      headers: { Accept: "application/json" },
      method: "GET",
      ...(signal === undefined ? {} : { signal }),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw responseError(response.status);
  const value = await readJson(response);
  if (
    response.status !== 200 ||
    !isRecord(value) ||
    !matchesEtag(response, value.version)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return Object.freeze({ ...value, payload: copyPayload(value.payload) });
}

export async function savePersonalPortfolio(
  payload: PersonalPortfolioPayload,
  version: number | null,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<PersonalPortfolioMutationReceipt> {
  if (
    !isPersonalPortfolioPayload(
      payload,
      new Date().toISOString().slice(0, 10),
    ) ||
    (version !== null &&
      (!isPositiveInteger(version) || version > 999_999_999_999_999)) ||
    typeof idempotencyKey !== "string" ||
    !IDEMPOTENCY.test(idempotencyKey)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const creating = version === null;
  const response = await requestPersonalWorkspace(
    PERSONAL_WORKSPACE_MAIN_PORTFOLIO_PATH,
    {
      body: JSON.stringify({ payload }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(creating
          ? { "If-None-Match": "*" }
          : { "If-Match": `"v${String(version)}"` }),
        "X-Research-Cockpit-Idempotency-Key": idempotencyKey,
        "X-Research-Cockpit-Intent": creating
          ? "personal-vault-create"
          : "personal-vault-update",
      },
      method: "POST",
      ...(signal === undefined ? {} : { signal }),
    },
  );
  if (!response.ok) throw responseError(response.status);
  const value = await readJson(response);
  if (
    response.status !== (creating ? 201 : 200) ||
    !isReceipt(value) ||
    value.version !== (version ?? 0) + 1 ||
    !matchesEtag(response, value.version)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return Object.freeze({ ...value });
}

async function readJson(response: Response): Promise<unknown> {
  if (
    response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() !== "application/json"
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
}

function matchesEtag(response: Response, version: number): boolean {
  return response.headers.get("etag") === `"v${String(version)}"`;
}

function isRecord(value: unknown): value is PersonalPortfolioRecord {
  if (
    !hasKeys(value, [
      "profile",
      "kind",
      "id",
      "version",
      "payload",
      "payloadSha256",
      "createdAt",
      "updatedAt",
    ])
  )
    return false;
  return (
    value.profile === "personal_single_user_local_vault" &&
    value.kind === "portfolio" &&
    value.id === "main" &&
    isPositiveInteger(value.version) &&
    isPersonalPortfolioPayload(value.payload) &&
    typeof value.payloadSha256 === "string" &&
    DIGEST.test(value.payloadSha256) &&
    isInstant(value.createdAt) &&
    isInstant(value.updatedAt) &&
    value.updatedAt >= value.createdAt
  );
}

function isReceipt(value: unknown): value is PersonalPortfolioMutationReceipt {
  if (
    !hasKeys(value, [
      "profile",
      "operation",
      "kind",
      "id",
      "version",
      "digestSha256",
      "committedAt",
      "replayed",
    ])
  )
    return false;
  return (
    value.profile === "personal_single_user_local_vault" &&
    value.kind === "portfolio" &&
    value.id === "main" &&
    value.operation === "put" &&
    isPositiveInteger(value.version) &&
    typeof value.digestSha256 === "string" &&
    DIGEST.test(value.digestSha256) &&
    isInstant(value.committedAt) &&
    typeof value.replayed === "boolean"
  );
}

function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    INSTANT.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function hasKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",")
  );
}

function copyPayload(
  payload: PersonalPortfolioPayload,
): PersonalPortfolioPayload {
  return Object.freeze({
    ...payload,
    holdings: Object.freeze(
      payload.holdings.map((holding) =>
        Object.freeze({
          ...holding,
          identity: Object.freeze({ ...holding.identity }),
        }),
      ),
    ),
  });
}

function responseError(status: number): PersonalWorkspaceApiError {
  if (status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (status === 409) return new PersonalWorkspaceApiError("conflict");
  if (status === 400) return new PersonalWorkspaceApiError("invalid_request");
  return new PersonalWorkspaceApiError("unavailable");
}
