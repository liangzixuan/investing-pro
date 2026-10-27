import { getManagedInterimView } from "./managed-interim-view";
import type { ManagedInterimView } from "./managed-interim-view";
import { interimReportReferences } from "./managed-interim-report-references";
import {
  assertPersonalSecJsonUniqueKeys,
  membershipMatchesResult,
  parseManagedCatalogResolveResponse,
  parseManagedEodHistoryResponse,
  parseManagedSecFilingsResponse,
  type ManagedEodIdentity,
  type ManagedEodHistoryResponseDto,
  type ManagedSecFilingsResponseDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecInterimStatements } from "@research-cockpit/personal-financial-analytics";
import { parseSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
import type { PersonalSecInterimCanonicalResponseDto } from "@research-cockpit/contracts";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import type { PreparedCompanyReport } from "./managed-company-report";
import {
  formatCompanyReportDocument,
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  COMPANY_REPORT_VALUATION_MAX_BYTES,
} from "./managed-company-report-document";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  draftFileEncoder,
  requireDraftFile as requireArchive,
  requiredDraftFileHash,
  requiredDraftFileRecord as record,
  requiredDraftFileText,
  requiredDraftFileTime,
} from "./managed-watchlist-draft-file-validation";

export const COMPANY_REPORT_ARCHIVE_MAX_BYTES =
  COMPANY_REPORT_DOCUMENT_MAX_BYTES;
export interface CompanyReportSourceProvenance {
  readonly source: "price" | "annual" | "interim" | "filings";
  readonly status: "loaded" | "not_loaded";
  readonly retainedPrevious: boolean;
  readonly lastAttemptFailed: boolean;
  readonly responseOrigin: string | null;
  readonly fields: readonly Readonly<{ label: string; value: string }>[];
  readonly references: readonly Readonly<{ label: string; url: string }>[];
}
export interface CompanyReportRevisitSnapshot {
  readonly preparedAt: string;
  readonly listing: ManagedEodIdentity;
  readonly catalogSnapshotSha256: string;
  readonly selectionCik: string | null;
  readonly note: string | null;
  readonly sources: readonly CompanyReportSourceProvenance[];
}
export interface CompanyReportArchive extends CompanyReportRevisitSnapshot {
  readonly kind: "company_report_archive";
  readonly schemaVersion: "6.0.0";
  readonly byteLength: number;
  readonly interim: Readonly<{
    response: PersonalSecInterimCanonicalResponseDto;
    statements: ManagedInterimView["statements"];
  }> | null;
  /** Opaque file-reported calculations; never admitted as live financial values. */
  readonly unverifiedAppendix: string;
}
const archives = new WeakSet<CompanyReportArchive>();
const ENVELOPE = [
  "purpose",
  "schemaVersion",
  "preparedAt",
  "scope",
  "catalogSnapshotSha256",
  "selectionCik",
  "listing",
  "authoredResearch",
  "valuation",
  "valuationPrice",
  "sources",
] as const;
const SCOPE = [
  "sourceEvidence",
  "sourceDates",
  "retainedPrevious",
  "priceBasis",
  "financials",
  "valuation",
  "authoredResearch",
  "retention",
] as const;
const LOADED = [
  "status",
  "retainedPrevious",
  "lastAttemptFailed",
  "responseOrigin",
  "response",
] as const;
type Envelope = Record<(typeof ENVELOPE)[number], unknown>;
type SourceKey = CompanyReportSourceProvenance["source"];
type Loaded = Record<(typeof LOADED)[number], unknown>;
type Header = Omit<CompanyReportRevisitSnapshot, "sources">;

/** The reported file size is checked before reading any file bytes. */
export function assertCompanyReportArchiveSize(size: number): void {
  requireArchive(Number.isSafeInteger(size));
  requireArchive(size > 0);
  requireArchive(size <= COMPANY_REPORT_ARCHIVE_MAX_BYTES);
}
export async function decodeCompanyReportArchive(
  bytes: ArrayBuffer,
  expectedSize: number,
  signal: AbortSignal,
): Promise<CompanyReportArchive | null> {
  signal.throwIfAborted();
  try {
    assertCompanyReportArchiveSize(expectedSize);
    requireArchive(bytes instanceof ArrayBuffer);
    requireArchive(bytes.byteLength === expectedSize);
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    return await parseCompanyReportArchive(text, signal);
  } catch {
    signal.throwIfAborted();
    return null;
  }
}
function decodedEnvelope(text: string): Envelope {
  requiredDraftFileText(text, COMPANY_REPORT_ARCHIVE_MAX_BYTES);
  assertCompanyReportArchiveSize(draftFileEncoder.encode(text).byteLength);
  assertPersonalSecJsonUniqueKeys(text);
  const value: unknown = JSON.parse(text);
  finiteJson(value);
  const envelope = record(value, ENVELOPE);
  requireArchive(envelope.purpose === "investment.company-research");
  requireArchive(envelope.schemaVersion === "6.0.0");
  const scope = record(envelope.scope, SCOPE);
  for (const field of Object.values(scope)) requiredDraftFileText(field, 2_048);
  return envelope;
}
/** Reject escaped malformed Unicode and nonfinite numbers, including in appendices. */
function finiteJson(value: unknown): void {
  if (typeof value === "string") {
    requireArchive(!/\p{Cs}/u.test(value));
    return;
  }
  if (typeof value === "number") {
    requireArchive(Number.isFinite(value));
    return;
  }
  if (value === null) return;
  if (typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    requireArchive(!/\p{Cs}/u.test(key));
    finiteJson(child);
  }
}
function header(envelope: Envelope): Header {
  const catalogSnapshotSha256 = requiredDraftFileHash(
    envelope.catalogSnapshotSha256,
  );
  const listingId = record(envelope.listing, [
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
  ]).listingId;
  requireArchive(typeof listingId === "string");
  const resolved = parseManagedCatalogResolveResponse(
    {
      snapshotSha256: catalogSnapshotSha256,
      results: [{ listingId, listing: envelope.listing }],
    },
    { snapshotSha256: catalogSnapshotSha256, listingIds: [listingId] },
  );
  const listing = resolved?.results[0]?.listing;
  requireArchive(listing !== null && listing !== undefined);
  const selectionCik = cik(envelope.selectionCik);
  const authored = record(envelope.authoredResearch, ["status", "note"]);
  requireArchive(
    authored.status ===
      (authored.note === null ? "not_in_watchlist" : "watchlist_draft"),
  );
  const note =
    authored.note === null
      ? null
      : requiredDraftFileText(authored.note, 16_384);
  requireArchive(
    draftFileEncoder.encode(JSON.stringify(note)).byteLength <= 16_384,
  );
  return Object.freeze({
    preparedAt: requiredDraftFileTime(envelope.preparedAt),
    catalogSnapshotSha256,
    listing,
    selectionCik,
    note,
  });
}
function cik(value: unknown): string | null {
  if (value === null) return null;
  requireArchive(typeof value === "string");
  requireArchive(/^(?!0000000000)[0-9]{10}$/u.test(value));
  return value;
}
function loadedSource(
  value: unknown,
  key: SourceKey,
): Loaded | CompanyReportSourceProvenance {
  requireArchive(value !== null && typeof value === "object");
  const status = Object.getOwnPropertyDescriptor(value, "status")
    ?.value as unknown;
  if (status === "not_loaded") {
    const missing = record(value, ["status", "lastAttemptFailed"]);
    requireArchive(typeof missing.lastAttemptFailed === "boolean");
    return provenance(
      key,
      {
        status: "not_loaded",
        retainedPrevious: false,
        lastAttemptFailed: missing.lastAttemptFailed,
        responseOrigin: null,
      },
      [],
      [],
    );
  }
  const extras = {
    price: ["studies"],
    annual: ["statements", "financials"],
    interim: ["statements"],
    filings: [],
  };
  const fields = record(value, [...LOADED, ...extras[key]]);
  requireArchive(fields.status === "loaded");
  requireArchive(typeof fields.retainedPrevious === "boolean");
  requireArchive(typeof fields.lastAttemptFailed === "boolean");
  const origins = {
    price: ["markets", "watchlist", "company"],
    annual: ["request", "watchlist-comparison", "financial-screen"],
    interim: ["request"],
    filings: ["request", "watchlist"],
  };
  requireArchive(origins[key].includes(fields.responseOrigin as string));
  validateAppendixShape(fields, key);
  return fields as Loaded;
}
function validateAppendixShape(
  fields: Record<string, unknown>,
  key: SourceKey,
): void {
  if (key === "annual") {
    requireArchive(
      fields.statements !== null && typeof fields.statements === "object",
    );
    record(fields.financials, [
      "income",
      "cashGeneration",
      "liquidity",
      "operatingResults",
      "balanceSheet",
      "cashMargins",
      "financialReview",
    ]);
  }
  if (key !== "price") return;
  const studies = fields.studies as Record<string, unknown>;
  if (studies?.status === "available") {
    record(studies, ["status", "scope", "calculation"]);
    return;
  }
  const unavailable = record(studies, ["status", "reason"]);
  requireArchive(unavailable.status === "unavailable");
  requireArchive(unavailable.reason === "unsupported_price_values");
}
function provenance(
  key: SourceKey,
  flags: Omit<
    CompanyReportSourceProvenance,
    "source" | "fields" | "references"
  >,
  fields: readonly Readonly<{ label: string; value: string }>[],
  references: readonly Readonly<{ label: string; url: string }>[],
): CompanyReportSourceProvenance {
  return Object.freeze({
    ...flags,
    source: key,
    fields: Object.freeze(fields.map((value) => Object.freeze({ ...value }))),
    references: Object.freeze(
      references.map((value) => Object.freeze({ ...value })),
    ),
  });
}
function loadedProvenance(
  key: SourceKey,
  source: Loaded,
  fields: readonly Readonly<{ label: string; value: string }>[],
  references: readonly Readonly<{ label: string; url: string }>[] = [],
): CompanyReportSourceProvenance {
  return provenance(
    key,
    {
      status: "loaded",
      retainedPrevious: source.retainedPrevious as boolean,
      lastAttemptFailed: source.lastAttemptFailed as boolean,
      responseOrigin: source.responseOrigin as string,
    },
    fields,
    references,
  );
}
function matchesListing(expected: Header, candidate: ManagedEodIdentity): void {
  requireArchive(
    membershipMatchesResult({ ...expected.listing, note: "" }, candidate),
  );
}
function pricePacket(
  source: Loaded,
  expected: Header,
): ManagedEodHistoryResponseDto {
  const raw = source.response as ManagedEodHistoryResponseDto;
  const response = parseManagedEodHistoryResponse(raw, {
    catalogSnapshotSha256: expected.catalogSnapshotSha256 as `sha256:${string}`,
    listingId: expected.listing.listingId,
    range: raw?.range,
  });
  requireArchive(response !== null);
  matchesListing(expected, response.security);
  return response;
}
function filingsPacket(
  source: Loaded,
  expected: Header,
): ManagedSecFilingsResponseDto {
  const response = parseManagedSecFilingsResponse(source.response, {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: expected.catalogSnapshotSha256 as `sha256:${string}`,
    listingId: expected.listing.listingId,
    symbol: expected.listing.symbol,
  });
  requireArchive(response !== null);
  matchesListing(expected, response.security);
  selectedCikMatches(response.security.cik, expected);
  return response;
}
/** A null visit claim remains null; a known claim must match the admitted source. */
function selectedCikMatches(sourceCik: string, expected: Header): void {
  if (expected.selectionCik === null) return;
  requireArchive(sourceCik === expected.selectionCik);
}
function annualIdentity(
  response:
    | PersonalSecAnnualCanonicalResponseDto
    | PersonalSecInterimCanonicalResponseDto,
  expected: Header,
): void {
  const source = response.security;
  for (const key of [
    "listingId",
    "symbol",
    "country",
    "exchangeMic",
    "issuerId",
    "issuerName",
    "securityName",
  ] as const)
    requireArchive(source[key] === expected.listing[key]);
  selectedCikMatches(source.cik, expected);
}
async function annualPacket(
  source: Loaded,
  expected: Header,
  signal: AbortSignal,
): Promise<PersonalSecAnnualCanonicalResponseDto> {
  const response = await parseSecAnnualCanonicalResponse(
    source.response,
    {
      schemaVersion: "6.0.0",
      catalogSnapshotSha256:
        expected.catalogSnapshotSha256 as `sha256:${string}`,
      listingId: expected.listing.listingId,
      symbol: expected.listing.symbol,
    },
    signal,
  );
  requireArchive(response !== null);
  annualIdentity(response, expected);
  return response;
}
async function interimPacket(
  source: Loaded,
  expected: Header,
  signal: AbortSignal,
): Promise<PersonalSecInterimCanonicalResponseDto> {
  const response = await parseSecInterimCanonicalResponse(
    source.response,
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256:
        expected.catalogSnapshotSha256 as `sha256:${string}`,
      listingId: expected.listing.listingId,
      symbol: expected.listing.symbol,
    },
    signal,
  );
  requireArchive(response !== null);
  annualIdentity(response, expected);
  const raw = source as Loaded & { statements: unknown };
  requireArchive(
    JSON.stringify(raw.statements) ===
      JSON.stringify(
        interimReportReferences(
          resolvePersonalSecInterimStatements(response.evidence),
        ),
      ),
  );
  return response;
}
function interimProvenance(
  source: Loaded,
  response: PersonalSecInterimCanonicalResponseDto,
): CompanyReportSourceProvenance {
  const { generation, target } = response.evidence;
  const fields = [
    { label: "Source CIK", value: response.security.cik },
    { label: "Cutoff", value: generation.cutoffAt },
    { label: "Completed", value: generation.completedAt },
    { label: "Canonical generation", value: generation.sha256 },
    { label: "Filing target", value: JSON.stringify(target) },
  ];
  const references = Object.entries(generation.sources).map(
    ([label, value]) => {
      fields.push({
        label: `${label} source capture`,
        value: `${value.status}; fetched ${value.fetchedAt ?? "not captured"}; SHA ${value.sha256 ?? "none"}; bytes ${value.bytes ?? "none"}`,
      });
      return { label, url: value.sourceUrl };
    },
  );
  return loadedProvenance("interim", source, fields, references);
}
function priceProvenance(
  source: Loaded,
  response: ManagedEodHistoryResponseDto,
): CompanyReportSourceProvenance {
  return loadedProvenance("price", source, [
    {
      label: "Provider and basis",
      value: "Tiingo; raw USD closes; unadjusted",
    },
    {
      label: "Window",
      value: `${response.range}: ${response.window.startDate} through ${response.window.endDate}`,
    },
    { label: "Requested", value: response.requestStartedAt },
    { label: "Completed", value: response.completedAt },
  ]);
}
function annualProvenance(
  source: Loaded,
  response:
    | PersonalSecAnnualCanonicalResponseDto
    | PersonalSecInterimCanonicalResponseDto,
): CompanyReportSourceProvenance {
  const { generation, target } = response.evidence;
  const fields = [
    { label: "Source CIK", value: response.security.cik },
    { label: "Cutoff", value: generation.cutoffAt },
    { label: "Completed", value: generation.completedAt },
    { label: "Canonical generation", value: generation.sha256 },
    { label: "Filing target", value: JSON.stringify(target) },
  ];
  const references = Object.entries(generation.sources).map(
    ([label, value]) => {
      fields.push({
        label: `${label} source capture`,
        value: `${value.status}; fetched ${value.fetchedAt ?? "not captured"}; SHA ${value.sha256 ?? "none"}; bytes ${value.bytes ?? "none"}`,
      });
      return { label, url: value.sourceUrl };
    },
  );
  return loadedProvenance("annual", source, fields, references);
}
function filingsProvenance(
  source: Loaded,
  response: ManagedSecFilingsResponseDto,
): CompanyReportSourceProvenance {
  return loadedProvenance(
    "filings",
    source,
    [
      { label: "Source CIK", value: response.security.cik },
      { label: "Requested", value: response.requestStartedAt },
      { label: "Completed", value: response.completedAt },
      {
        label: "Window",
        value: `${response.window.fromDate} through ${response.window.throughDate}`,
      },
      {
        label: "Issuer source",
        value: `${response.issuer.status}; fetched ${response.issuer.fetchedAt ?? "not captured"}`,
      },
      {
        label: "Issuer coverage",
        value: `matching ${response.issuer.matchingFilings}; truncated ${response.issuer.truncated}; older history available ${response.issuer.olderHistoryAvailable}`,
      },
      ...response.issuer.filings.map((filing) => ({
        label: "Filing",
        value: `${filing.form}; accession ${filing.accessionNumber}; filed ${filing.filingDate}; report ${filing.reportDate ?? "unavailable"}`,
      })),
    ],
    [
      { label: "SEC submissions", url: response.issuer.sourceUrl },
      ...response.issuer.filings.map((filing) => ({
        label: `${filing.form} ${filing.accessionNumber}`,
        url: filing.sourceUrl,
      })),
    ],
  );
}
async function admittedSources(
  envelope: Envelope,
  expected: Header,
  signal: AbortSignal,
): Promise<{
  sources: readonly CompanyReportSourceProvenance[];
  interim: CompanyReportArchive["interim"];
}> {
  const values = record(envelope.sources, [
    "price",
    "annual",
    "interim",
    "filings",
  ]);
  const result: CompanyReportSourceProvenance[] = [];
  let interim: CompanyReportArchive["interim"] = null;
  for (const key of ["price", "annual", "interim", "filings"] as const) {
    signal.throwIfAborted();
    const source = loadedSource(values[key], key);
    if (source.status === "not_loaded") {
      result.push(source as CompanyReportSourceProvenance);
      continue;
    }
    if (key === "interim") {
      const response = await interimPacket(source as Loaded, expected, signal);
      interim = Object.freeze({
        response,
        statements: getManagedInterimView(response)!.statements,
      });
      result.push(interimProvenance(source as Loaded, response));
    } else
      result.push(await admitSource(key, source as Loaded, expected, signal));
  }
  return { sources: consistentSources(result), interim };
}
function consistentSources(
  sources: readonly CompanyReportSourceProvenance[],
): readonly CompanyReportSourceProvenance[] {
  const ciks = sources.flatMap((source) =>
    source.fields
      .filter((field) => field.label === "Source CIK")
      .map((field) => field.value),
  );
  requireArchive(new Set(ciks).size <= 1);
  return Object.freeze(sources);
}
async function admitSource(
  key: Exclude<SourceKey, "interim">,
  source: Loaded,
  expected: Header,
  signal: AbortSignal,
): Promise<CompanyReportSourceProvenance> {
  if (key === "price")
    return priceProvenance(source, pricePacket(source, expected));
  if (key === "filings")
    return filingsProvenance(source, filingsPacket(source, expected));
  return annualProvenance(source, await annualPacket(source, expected, signal));
}
function appendix(envelope: Envelope): string {
  const { valuation, valuationPrice } = envelope;
  for (const value of [valuation, valuationPrice]) {
    if (value === null) continue;
    requireArchive(typeof value === "object");
    requireArchive(!Array.isArray(value));
  }
  requireArchive(
    draftFileEncoder.encode(JSON.stringify({ valuation, valuationPrice }))
      .byteLength <= COMPANY_REPORT_VALUATION_MAX_BYTES,
  );
  const sources = envelope.sources as Record<string, Record<string, unknown>>;
  return JSON.stringify({
    valuation,
    valuationPrice,
    annual: {
      statements: sources.annual?.statements ?? null,
      financials: sources.annual?.financials ?? null,
    },
    interim: { statements: sources.interim?.statements ?? null },
    priceStudies: sources.price?.studies ?? null,
  });
}
/** Structural and canonical hash checks establish a readable archive, not file authenticity or freshness. */
export async function parseCompanyReportArchive(
  text: string,
  signal: AbortSignal,
): Promise<CompanyReportArchive | null> {
  signal.throwIfAborted();
  try {
    const envelope = decodedEnvelope(text);
    const expected = header(envelope);
    const admitted = await admittedSources(envelope, expected, signal);
    signal.throwIfAborted();
    const result: CompanyReportArchive = Object.freeze({
      ...expected,
      sources: admitted.sources,
      interim: admitted.interim,
      kind: "company_report_archive",
      schemaVersion: "6.0.0",
      byteLength: draftFileEncoder.encode(text).byteLength,
      unverifiedAppendix: appendix(envelope),
    });
    archives.add(result);
    return result;
  } catch {
    signal.throwIfAborted();
    return null;
  }
}
export function companyReportArchiveMatches(
  archive: CompanyReportArchive,
  selection: ManagedResearchSelection,
): boolean {
  if (!archives.has(archive)) return false;
  if (archive.selectionCik !== selection.cik) return false;
  return membershipMatchesResult(
    { ...archive.listing, note: "" },
    selection.listing,
  );
}
/** Projection only; the existing formatter enforces live decoder-owned source captures. */
export function projectCurrentCompanyReport(
  report: PreparedCompanyReport,
): CompanyReportRevisitSnapshot | null {
  try {
    const document = formatCompanyReportDocument(report);
    if (!document) return null;
    const envelope = decodedEnvelope(document.text);
    const expected = header(envelope);
    const values = record(envelope.sources, [
      "price",
      "annual",
      "interim",
      "filings",
    ]);
    const sources = (["price", "annual", "interim", "filings"] as const).map(
      (key) => projectSource(key, values[key], expected),
    );
    return Object.freeze({ ...expected, sources: consistentSources(sources) });
  } catch {
    return null;
  }
}
function projectSource(
  key: SourceKey,
  value: unknown,
  expected: Header,
): CompanyReportSourceProvenance {
  const source = loadedSource(value, key);
  if (source.status === "not_loaded")
    return source as CompanyReportSourceProvenance;
  const loaded = source as Loaded;
  if (key === "price")
    return priceProvenance(loaded, pricePacket(loaded, expected));
  if (key === "filings")
    return filingsProvenance(loaded, filingsPacket(loaded, expected));
  if (key === "interim") {
    const response = loaded.response as PersonalSecInterimCanonicalResponseDto;
    annualIdentity(response, expected);
    return interimProvenance(loaded, response);
  }
  const response = loaded.response as PersonalSecAnnualCanonicalResponseDto;
  annualIdentity(response, expected);
  return annualProvenance(loaded, response);
}

/** Only archives owned by completed canonical re-admission expose captured values. */
export function archivedInterimEvidence(
  snapshot: CompanyReportRevisitSnapshot,
) {
  const archive = snapshot as CompanyReportArchive;
  return archives.has(archive) ? archive.interim : null;
}
