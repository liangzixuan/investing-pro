import {
  assertPersonalSecJsonUniqueKeys,
  isMainWatchlistPayload,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import {
  validateManagedFinancialScreenCriteria,
  type ManagedFinancialScreenCriteria,
} from "./managed-financial-screen-results";
import {
  draftFileEncoder,
  requireDraftFile,
  requiredDraftFileArray,
  requiredDraftFileHash,
  requiredDraftFileRecord,
  requiredDraftFileText,
  requiredDraftFileTime,
} from "./managed-watchlist-draft-file-validation";

export const MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES = 64 * 1024;
const FORMAT = "investment-financial-screen-recipe";
const MIME = "application/json";
const INPUT_KEYS = [
  "name",
  "capturedAt",
  "catalogSnapshotSha256",
  "criteria",
  "listings",
] as const;
const CONTENT_KEYS = ["format", "version", ...INPUT_KEYS] as const;
const DOCUMENT_KEYS = [
  "filename",
  "mime",
  "text",
  "byteLength",
  "capturedAt",
] as const;
const LISTING_KEYS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;

export interface ManagedFinancialScreenRecipeInput {
  readonly name: string;
  readonly capturedAt: string;
  readonly catalogSnapshotSha256: string;
  readonly criteria: ManagedFinancialScreenCriteria;
  readonly listings: readonly ManagedEodIdentity[];
}
export interface ManagedFinancialScreenRecipeContent extends ManagedFinancialScreenRecipeInput {
  readonly format: typeof FORMAT;
  readonly version: 1;
}
export interface ManagedFinancialScreenRecipeDocument {
  readonly filename: string;
  readonly mime: typeof MIME;
  readonly text: string;
  readonly byteLength: number;
  readonly capturedAt: string;
}

function requiredName(value: unknown): string {
  requireDraftFile(typeof value === "string");
  requireDraftFile(value.length <= 80 && value.trim().length > 0);
  requireDraftFile(!/[\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/u.test(value));
  return value;
}

function requiredCriteria(value: unknown): ManagedFinancialScreenCriteria {
  const fields = requiredDraftFileRecord(value, ["clauses", "sort"]);
  const clauses = requiredDraftFileArray(fields.clauses, 7).map((clause) =>
    requiredDraftFileRecord(clause, ["field", "operator", "value"]),
  );
  const sort = requiredDraftFileRecord(fields.sort, ["field", "direction"]);
  const criteria = validateManagedFinancialScreenCriteria({ clauses, sort });
  requireDraftFile(criteria !== null);
  return criteria;
}

function requiredListing(value: unknown): ManagedEodIdentity {
  const fields = requiredDraftFileRecord(value, LISTING_KEYS);
  const listing = Object.fromEntries(
    LISTING_KEYS.map((key) => [key, fields[key]]),
  );
  const projected: unknown = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: `sha256:${"0".repeat(64)}`,
    memberships: [{ ...listing, note: "" }],
  };
  requireDraftFile(isMainWatchlistPayload(projected));
  const member = projected.memberships[0]!;
  return Object.freeze({
    country: member.country,
    exchangeMic: member.exchangeMic,
    instrumentType: member.instrumentType,
    issuerId: member.issuerId,
    issuerName: member.issuerName,
    listingId: member.listingId,
    securityId: member.securityId,
    securityName: member.securityName,
    shareClassId: member.shareClassId,
    shareClassName: member.shareClassName,
    symbol: member.symbol,
  });
}

function requiredListings(value: unknown): readonly ManagedEodIdentity[] {
  const listings = requiredDraftFileArray(value, 17).map(requiredListing);
  requireDraftFile(listings.length > 0);
  requireDraftFile(
    new Set(listings.map((item) => item.listingId)).size === listings.length,
  );
  requireDraftFile(
    new Set(listings.map((item) => item.issuerId)).size === listings.length,
  );
  return Object.freeze(listings);
}

function requiredContent(value: unknown): ManagedFinancialScreenRecipeContent {
  const fields = requiredDraftFileRecord(value, CONTENT_KEYS);
  requireDraftFile(fields.format === FORMAT && fields.version === 1);
  return Object.freeze({
    format: FORMAT,
    version: 1,
    name: requiredName(fields.name),
    capturedAt: requiredDraftFileTime(fields.capturedAt),
    catalogSnapshotSha256: requiredDraftFileHash(fields.catalogSnapshotSha256),
    criteria: requiredCriteria(fields.criteria),
    listings: requiredListings(fields.listings),
  });
}

function documentFor(
  content: ManagedFinancialScreenRecipeContent,
): ManagedFinancialScreenRecipeDocument {
  const text = JSON.stringify(content) + "\n";
  const byteLength = draftFileEncoder.encode(text).byteLength;
  requireDraftFile(byteLength <= MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES);
  return Object.freeze({
    filename: `Investment-financial-screen-recipe-${content.capturedAt.replace(/[:.]/gu, "-")}.json`,
    mime: MIME,
    text,
    byteLength,
    capturedAt: content.capturedAt,
  });
}

/** Capture a portable definition only; source and current-cohort admission are separate. */
export function formatManagedFinancialScreenRecipe(
  input: ManagedFinancialScreenRecipeInput,
): ManagedFinancialScreenRecipeDocument | null {
  try {
    const fields = requiredDraftFileRecord(input, INPUT_KEYS);
    return documentFor(
      requiredContent({ format: FORMAT, version: 1, ...fields }),
    );
  } catch {
    return null;
  }
}

/** File clocks and catalog metadata are reported values, never current authority. */
export function parseManagedFinancialScreenRecipe(
  text: string,
): ManagedFinancialScreenRecipeContent | null {
  try {
    const admitted = requiredDraftFileText(
      text,
      MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES,
    );
    assertPersonalSecJsonUniqueKeys(admitted);
    return requiredContent(JSON.parse(admitted) as unknown);
  } catch {
    return null;
  }
}

/** Delivery accepts only canonical text with the exact matching document wrapper. */
export function isManagedFinancialScreenRecipeDocument(
  value: unknown,
): value is ManagedFinancialScreenRecipeDocument {
  try {
    const fields = requiredDraftFileRecord(value, DOCUMENT_KEYS);
    const text = requiredDraftFileText(
      fields.text,
      MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES,
    );
    const content = parseManagedFinancialScreenRecipe(text);
    requireDraftFile(content !== null);
    const expected = documentFor(content);
    return DOCUMENT_KEYS.every((key) => fields[key] === expected[key]);
  } catch {
    return false;
  }
}
