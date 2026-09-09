import {
  PERSONAL_WATCHLIST_FILINGS_LIMITS,
  type PersonalWatchlistFilingsRequestDto,
  type PersonalWatchlistFilingsResponseDto,
} from "@research-cockpit/contracts";

import {
  PersonalWorkspaceApiError,
  requestPersonalWorkspace,
} from "./personal-workspace-api";

export const PERSONAL_WATCHLIST_FILINGS_PATH =
  "/v1/personal-filing/workspace/watchlist-filings";
const limits = PERSONAL_WATCHLIST_FILINGS_LIMITS;
const identifier = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const cikPattern = /^(?!0000000000)[0-9]{10}$/u;
const statuses = [
  "available",
  "not_covered",
  "rate_limited",
  "upstream_unavailable",
  "invalid_response",
];

export function personalSecFilingUrl(
  cik: string,
  accessionNumber: string,
): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${accessionNumber}-index.htm`;
}

export async function fetchPersonalWatchlistFilings(
  input: PersonalWatchlistFilingsRequestDto,
  signal: AbortSignal,
): Promise<PersonalWatchlistFilingsResponseDto> {
  if (
    !keys(input, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "watchlistVersion",
      "listingIds",
      "lookbackDays",
    ]) ||
    input.schemaVersion !== "1.0.0" ||
    !matches(input.catalogSnapshotSha256, /^sha256:[a-f0-9]{64}$/u) ||
    !integer(input.watchlistVersion, 1) ||
    !selectedIds(input.listingIds) ||
    !lookback(input.lookbackDays)
  ) {
    throw new PersonalWorkspaceApiError("invalid_request");
  }
  const response = await requestPersonalWorkspace(
    PERSONAL_WATCHLIST_FILINGS_PATH,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    },
  );
  if (!response.ok) throw await responseError(response);
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  if (
    !isResponse(value) ||
    value.catalogSnapshotSha256 !== input.catalogSnapshotSha256 ||
    value.watchlistVersion !== input.watchlistVersion ||
    value.lookbackDays !== input.lookbackDays ||
    !sameIds(value.selectedListingIds, input.listingIds)
  ) {
    throw new PersonalWorkspaceApiError("invalid_response");
  }
  return value;
}

function isResponse(
  value: unknown,
): value is PersonalWatchlistFilingsResponseDto {
  if (
    !keys(value, [
      "schemaVersion",
      "catalogSnapshotSha256",
      "watchlistVersion",
      "lookbackDays",
      "fromDate",
      "throughDate",
      "fetchedAt",
      "totalWatchlistListings",
      "selectedListingIds",
      "issuers",
      "matchingFilings",
      "truncated",
      "filings",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    !matches(value.catalogSnapshotSha256, /^sha256:[a-f0-9]{64}$/u) ||
    !integer(value.watchlistVersion, 1) ||
    !lookback(value.lookbackDays) ||
    !date(value.fromDate) ||
    !date(value.throughDate) ||
    !instant(value.fetchedAt) ||
    value.throughDate !== value.fetchedAt.slice(0, 10) ||
    Date.parse(value.throughDate) - Date.parse(value.fromDate) !==
      (value.lookbackDays - 1) * 86_400_000 ||
    !integer(value.totalWatchlistListings, 1, 10_000) ||
    !selectedIds(value.selectedListingIds) ||
    value.selectedListingIds.length > value.totalWatchlistListings ||
    !Array.isArray(value.issuers) ||
    value.issuers.length < 1 ||
    value.issuers.length > value.selectedListingIds.length ||
    !integer(value.matchingFilings, 0) ||
    typeof value.truncated !== "boolean" ||
    !Array.isArray(value.filings) ||
    value.filings.length > limits.responseFilings
  )
    return false;
  const selected = new Set<string>();
  const issuers = new Map<
    string,
    PersonalWatchlistFilingsResponseDto["issuers"][number]
  >();
  let matchingFilings = 0;
  for (const issuer of value.issuers) {
    if (
      !keys(issuer, [
        "cik",
        "status",
        "fetchedAt",
        "sourceUrl",
        "olderHistoryAvailable",
        "matchingFilings",
        "truncated",
        "listings",
      ]) ||
      !matches(issuer.cik, cikPattern) ||
      issuers.has(issuer.cik) ||
      typeof issuer.status !== "string" ||
      !statuses.includes(issuer.status) ||
      !instant(issuer.fetchedAt) ||
      issuer.sourceUrl !==
        `https://data.sec.gov/submissions/CIK${issuer.cik}.json` ||
      typeof issuer.olderHistoryAvailable !== "boolean" ||
      typeof issuer.truncated !== "boolean" ||
      !integer(issuer.matchingFilings, 0, 10_000) ||
      issuer.truncated !== issuer.matchingFilings > limits.responseFilings ||
      !listings(issuer.listings) ||
      (issuer.status !== "available" &&
        (issuer.matchingFilings !== 0 ||
          issuer.truncated ||
          issuer.olderHistoryAvailable))
    )
      return false;
    for (const listing of issuer.listings) {
      if (
        !value.selectedListingIds.includes(listing.listingId) ||
        selected.has(listing.listingId)
      )
        return false;
      selected.add(listing.listingId);
    }
    matchingFilings += issuer.matchingFilings;
    issuers.set(
      issuer.cik,
      issuer as unknown as PersonalWatchlistFilingsResponseDto["issuers"][number],
    );
  }
  if (
    selected.size !== value.selectedListingIds.length ||
    matchingFilings !== value.matchingFilings ||
    value.filings.length !==
      Math.min(limits.responseFilings, matchingFilings) ||
    value.truncated !==
      (matchingFilings > value.filings.length ||
        [...issuers.values()].some((issuer) => issuer.truncated))
  )
    return false;
  const accessions = new Set<string>();
  const displayedCounts = new Map<string, number>();
  for (const filing of value.filings) {
    if (
      !keys(filing, [
        "cik",
        "accessionNumber",
        "form",
        "filingDate",
        "reportDate",
        "sourceUrl",
        "listings",
      ]) ||
      !matches(filing.cik, cikPattern) ||
      !matches(filing.accessionNumber, /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u) ||
      !matches(filing.form, /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u) ||
      filing.form !== filing.form.trim() ||
      !date(filing.filingDate) ||
      filing.filingDate < value.fromDate ||
      filing.filingDate > value.throughDate ||
      (filing.reportDate !== null && !date(filing.reportDate)) ||
      filing.sourceUrl !==
        personalSecFilingUrl(filing.cik, filing.accessionNumber) ||
      !listings(filing.listings)
    )
      return false;
    const issuer = issuers.get(filing.cik);
    const key = `${filing.cik}:${filing.accessionNumber}`;
    if (
      !issuer ||
      issuer.status !== "available" ||
      accessions.has(key) ||
      filing.listings.length !== issuer.listings.length ||
      !filing.listings.every((listing, index) =>
        sameListing(listing, issuer.listings[index]),
      )
    )
      return false;
    accessions.add(key);
    displayedCounts.set(filing.cik, (displayedCounts.get(filing.cik) ?? 0) + 1);
  }
  return [...issuers.values()].every(
    (issuer) =>
      (displayedCounts.get(issuer.cik) ?? 0) <= issuer.matchingFilings,
  );
}

function sameListing(
  left: { listingId: string; symbol: string; issuerName: string },
  right: { listingId: string; symbol: string; issuerName: string } | undefined,
) {
  return (
    right !== undefined &&
    left.listingId === right.listingId &&
    left.symbol === right.symbol &&
    left.issuerName === right.issuerName
  );
}
function listings(
  value: unknown,
): value is PersonalWatchlistFilingsResponseDto["issuers"][number]["listings"] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= limits.selectedListings &&
    value.every(
      (listing) =>
        keys(listing, ["listingId", "symbol", "issuerName"]) &&
        matches(listing.listingId, identifier) &&
        matches(listing.symbol, /^[A-Z0-9][A-Z0-9.-]{0,14}$/u) &&
        displayText(listing.issuerName, 512),
    ) &&
    new Set(value.map((listing: { listingId: string }) => listing.listingId))
      .size === value.length
  );
}
function sameIds(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}
function selectedIds(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= limits.selectedListings &&
    value.every((id) => matches(id, identifier)) &&
    new Set(value).size === value.length
  );
}
function lookback(value: unknown): value is 7 | 30 | 90 {
  return value === 7 || value === 30 || value === 90;
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
function displayText(value: unknown, limit: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    [...value].length <= limit &&
    value === value.trim().normalize("NFC") &&
    !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)
  );
}
function date(value: unknown): value is string {
  return (
    matches(value, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function instant(value: unknown): value is string {
  return (
    matches(
      value,
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
async function responseError(
  response: Response,
): Promise<PersonalWorkspaceApiError> {
  if (response.status === 401 || response.status === 403)
    return new PersonalWorkspaceApiError("session_unavailable");
  if (response.status === 409) return new PersonalWorkspaceApiError("conflict");
  if (response.status === 400)
    return new PersonalWorkspaceApiError("invalid_request");
  if (response.status === 429)
    return new PersonalWorkspaceApiError("rate_limited");
  if (response.status === 502)
    return new PersonalWorkspaceApiError("provider_unavailable");
  if (response.status === 503) {
    try {
      const problem: unknown = await response.json();
      if (
        typeof problem === "object" &&
        problem !== null &&
        "code" in problem &&
        problem.code === "not_configured"
      )
        return new PersonalWorkspaceApiError("not_configured");
    } catch {
      /* Never display source errors. */
    }
  }
  return new PersonalWorkspaceApiError("unavailable");
}
