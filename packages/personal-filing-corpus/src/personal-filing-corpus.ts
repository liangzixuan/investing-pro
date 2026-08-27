import { createHash } from "node:crypto";

export const PERSONAL_FILING_CORPUS_SCHEMA_VERSION = "1.0.0" as const;
export const PERSONAL_FILING_CORPUS_PROFILE =
  "personal_single_user_local" as const;
export const PERSONAL_FILING_CORPUS_CLAIM =
  "bounded_content_addressed_manifest_verified_for_personal_single_user_local_use" as const;

export const PERSONAL_FILING_CORPUS_CHECKS = Object.freeze([
  "owned_bounded_canonical_json_declaration_and_manifest_snapshots",
  "duplicate_json_property_and_noncanonical_byte_rejection",
  "closed_personal_single_user_local_no_redistribution_declaration",
  "declaration_to_exact_manifest_sha256_binding",
  "one_to_100_sorted_unique_filing_metadata_entries",
  "unique_accession_and_declared_content_sha256_identity",
  "closed_cik_form_time_media_taxonomy_source_and_amendment_metadata",
  "bounded_per_entry_and_aggregate_declared_content_bytes",
  "explicit_bounded_retention_and_user_managed_local_deletion",
  "whole_input_atomic_verification_or_value_free_rejection",
  "aggregate_only_immutable_verified_record",
  "deterministic_exact_byte_replay_and_mutation_rejection",
] as const);

export const PERSONAL_FILING_CORPUS_NOT_PROVEN = Object.freeze([
  "raw_payload_presence_or_declared_content_sha256_byte_equality",
  "sec_source_authenticity_sec_attestation_or_complete_filing_provenance",
  "legal_opinion_rights_authority_data_steward_or_external_approval",
  "network_fetch_dns_tls_ssrf_rate_limit_malware_or_archive_safety",
  "parser_correctness_fact_normalization_adjudication_or_quality_thresholds",
  "retention_enforcement_backup_deletion_or_cryptographic_erasure",
  "multi_user_identity_tenancy_authorization_or_shared_service_safety",
  "commercial_redistribution_production_kms_queue_load_slo_or_incident_readiness",
  "database_api_web_composition_or_b15_v15",
  "fitness_for_any_profile_other_than_declared_personal_single_user_local_use",
] as const);

export const PERSONAL_FILING_CORPUS_LIMITS = Object.freeze({
  aggregateStringCodePoints: 262_144,
  declarationBytes: 8_192,
  documentDepth: 8,
  documentNodes: 4_096,
  entries: 100,
  entryContentBytes: 67_108_864,
  manifestBytes: 524_288,
  retentionDays: 3_650,
  totalDeclaredContentBytes: 1_073_741_824,
});

export const PERSONAL_FILING_CORPUS_FAILURE_CODES = Object.freeze([
  "PERSONAL_FILING_CORPUS_INVALID_INPUT",
  "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
  "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
  "PERSONAL_FILING_CORPUS_SCOPE_MISMATCH",
] as const);

export type PersonalFilingCorpusFailureCode =
  (typeof PERSONAL_FILING_CORPUS_FAILURE_CODES)[number];

export class PersonalFilingCorpusError extends Error {
  public constructor(public readonly code: PersonalFilingCorpusFailureCode) {
    super("Personal filing corpus verification failed.");
    this.name = "PersonalFilingCorpusError";
  }
}

class InternalPersonalFilingCorpusFailure extends Error {
  public constructor(public readonly code: PersonalFilingCorpusFailureCode) {
    super();
  }
}

export interface PersonalFilingCorpusInput {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
}

export interface PersonalFilingCorpusRecord {
  readonly claim: typeof PERSONAL_FILING_CORPUS_CLAIM;
  readonly corpusId: string;
  readonly corpusVersion: typeof PERSONAL_FILING_CORPUS_SCHEMA_VERSION;
  readonly declarationSha256: `sha256:${string}`;
  readonly filingCount: number;
  readonly frozenAt: string;
  readonly manifestSha256: `sha256:${string}`;
  readonly profile: typeof PERSONAL_FILING_CORPUS_PROFILE;
  readonly retentionDays: number;
  readonly schemaVersion: typeof PERSONAL_FILING_CORPUS_SCHEMA_VERSION;
  readonly status: "verified_for_personal_use";
  readonly totalDeclaredBytes: number;
}

type FilingForm = "10-K" | "10-K/A" | "10-Q" | "10-Q/A";

interface InputSnapshot {
  readonly declaration: Uint8Array;
  readonly manifest: Uint8Array;
}

interface PersonalDeclaration {
  readonly corpusId: string;
  readonly corpusVersion: typeof PERSONAL_FILING_CORPUS_SCHEMA_VERSION;
  readonly manifestSha256: `sha256:${string}`;
  readonly retentionDays: number;
}

interface ManifestEntry {
  readonly accession: string;
  readonly acceptedAt: number;
  readonly availableAt: number;
  readonly cik: string;
  readonly form: FilingForm;
}

interface PersonalManifest {
  readonly corpusId: string;
  readonly corpusVersion: typeof PERSONAL_FILING_CORPUS_SCHEMA_VERSION;
  readonly filingCount: number;
  readonly frozenAt: string;
  readonly totalDeclaredBytes: number;
}

const HASH = /^sha256:[0-9a-f]{64}$/u;
const ACCESSION = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const CIK = /^[0-9]{10}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const SAFE_ID = /^[a-z][a-z0-9._:-]{2,127}$/u;
const TAXONOMY = /^[a-z][a-z0-9.-]{2,63}$/u;
const FORMS = ["10-K", "10-K/A", "10-Q", "10-Q/A"] as const;
const MEDIA_TYPES = [
  "application/xml",
  "application/zip",
  "text/html",
  "text/plain",
] as const;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);

export function verifyPersonalFilingCorpusManifest(
  input: PersonalFilingCorpusInput,
): PersonalFilingCorpusRecord {
  try {
    if (arguments.length !== 1) fail("PERSONAL_FILING_CORPUS_INVALID_INPUT");
    const snapshot = snapshotInput(input);
    const declarationSha256 = sha256(snapshot.declaration);
    const manifestSha256 = sha256(snapshot.manifest);
    const declaration = validateDeclaration(
      parseCanonicalDocument(
        snapshot.declaration,
        PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
        "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
      ),
    );
    if (declaration.manifestSha256 !== manifestSha256) {
      fail("PERSONAL_FILING_CORPUS_SCOPE_MISMATCH");
    }
    const manifest = validateManifest(
      parseCanonicalDocument(
        snapshot.manifest,
        PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
        "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
      ),
    );
    if (
      declaration.corpusId !== manifest.corpusId ||
      declaration.corpusVersion !== manifest.corpusVersion
    ) {
      fail("PERSONAL_FILING_CORPUS_SCOPE_MISMATCH");
    }

    return Object.freeze({
      claim: PERSONAL_FILING_CORPUS_CLAIM,
      corpusId: manifest.corpusId,
      corpusVersion: manifest.corpusVersion,
      declarationSha256,
      filingCount: manifest.filingCount,
      frozenAt: manifest.frozenAt,
      manifestSha256,
      profile: PERSONAL_FILING_CORPUS_PROFILE,
      retentionDays: declaration.retentionDays,
      schemaVersion: PERSONAL_FILING_CORPUS_SCHEMA_VERSION,
      status: "verified_for_personal_use",
      totalDeclaredBytes: manifest.totalDeclaredBytes,
    });
  } catch (error) {
    throw new PersonalFilingCorpusError(
      error instanceof InternalPersonalFilingCorpusFailure
        ? error.code
        : "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );
  }
}

function snapshotInput(value: unknown): InputSnapshot {
  if (!isExactDataObject(value, ["declaration", "manifest"])) {
    fail("PERSONAL_FILING_CORPUS_INVALID_INPUT");
  }
  const record = value as Record<string, unknown>;
  return Object.freeze({
    declaration: byteSnapshot(
      record.declaration,
      PERSONAL_FILING_CORPUS_LIMITS.declarationBytes,
      "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
    ),
    manifest: byteSnapshot(
      record.manifest,
      PERSONAL_FILING_CORPUS_LIMITS.manifestBytes,
      "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
    ),
  });
}

function byteSnapshot(
  value: unknown,
  maximumBytes: number,
  oversizeCode: PersonalFilingCorpusFailureCode,
): Uint8Array {
  try {
    if (typeof value !== "object" || value === null) {
      fail("PERSONAL_FILING_CORPUS_INVALID_INPUT");
    }
    const bytes = value as Uint8Array;
    const tag = TYPED_ARRAY_TO_STRING_TAG_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR?.get?.call(bytes) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      bytes,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get?.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      Object.getPrototypeOf(bytes) !== Uint8Array.prototype ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      fail("PERSONAL_FILING_CORPUS_INVALID_INPUT");
    }
    if (byteLength > maximumBytes) fail(oversizeCode);
    const snapshot = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(snapshot, bytes);
    return snapshot;
  } catch (error) {
    if (error instanceof InternalPersonalFilingCorpusFailure) throw error;
    fail("PERSONAL_FILING_CORPUS_INVALID_INPUT");
  }
}

function validateDeclaration(value: unknown): PersonalDeclaration {
  const code = "PERSONAL_FILING_CORPUS_DECLARATION_INVALID" as const;
  const record = exactRecord(
    value,
    [
      "commercialUse",
      "corpusId",
      "corpusVersion",
      "deleteOnRequest",
      "deletionMode",
      "localOnly",
      "manifestSha256",
      "profile",
      "purpose",
      "redistribution",
      "retentionDays",
      "schemaVersion",
      "singleUser",
    ],
    code,
  );
  if (
    record.schemaVersion !== PERSONAL_FILING_CORPUS_SCHEMA_VERSION ||
    record.profile !== PERSONAL_FILING_CORPUS_PROFILE ||
    record.purpose !== "personal_offline_filing_research_only" ||
    record.singleUser !== true ||
    record.localOnly !== true ||
    record.commercialUse !== "prohibited" ||
    record.redistribution !== "prohibited" ||
    record.deleteOnRequest !== true ||
    record.deletionMode !== "user_managed_local_delete" ||
    typeof record.corpusId !== "string" ||
    !SAFE_ID.test(record.corpusId) ||
    record.corpusVersion !== PERSONAL_FILING_CORPUS_SCHEMA_VERSION ||
    typeof record.manifestSha256 !== "string" ||
    !HASH.test(record.manifestSha256) ||
    !Number.isInteger(record.retentionDays) ||
    (record.retentionDays as number) < 1 ||
    (record.retentionDays as number) >
      PERSONAL_FILING_CORPUS_LIMITS.retentionDays
  ) {
    fail(code);
  }
  return Object.freeze({
    corpusId: record.corpusId,
    corpusVersion: record.corpusVersion,
    manifestSha256: record.manifestSha256 as `sha256:${string}`,
    retentionDays: record.retentionDays as number,
  });
}

function validateManifest(value: unknown): PersonalManifest {
  const code = "PERSONAL_FILING_CORPUS_MANIFEST_INVALID" as const;
  const record = exactRecord(
    value,
    [
      "corpusId",
      "corpusVersion",
      "entries",
      "frozenAt",
      "profile",
      "schemaVersion",
    ],
    code,
  );
  if (
    record.schemaVersion !== PERSONAL_FILING_CORPUS_SCHEMA_VERSION ||
    record.profile !== PERSONAL_FILING_CORPUS_PROFILE ||
    typeof record.corpusId !== "string" ||
    !SAFE_ID.test(record.corpusId) ||
    record.corpusVersion !== PERSONAL_FILING_CORPUS_SCHEMA_VERSION ||
    typeof record.frozenAt !== "string" ||
    !Array.isArray(record.entries) ||
    record.entries.length < 1 ||
    record.entries.length > PERSONAL_FILING_CORPUS_LIMITS.entries
  ) {
    fail(code);
  }
  const frozenAt = parseInstant(record.frozenAt, code);
  const entriesByAccession = new Map<string, ManifestEntry>();
  const contentHashes = new Set<string>();
  let previousAccession = "";
  let totalDeclaredBytes = 0;

  for (const rawEntry of record.entries) {
    const entry = exactRecord(
      rawEntry,
      [
        "acceptedAt",
        "accession",
        "amendmentOf",
        "availableAt",
        "cik",
        "contentBytes",
        "contentSha256",
        "form",
        "mediaType",
        "source",
        "sourceLocator",
        "taxonomy",
      ],
      code,
    );
    if (
      typeof entry.accession !== "string" ||
      !ACCESSION.test(entry.accession) ||
      entry.accession <= previousAccession ||
      typeof entry.cik !== "string" ||
      !CIK.test(entry.cik) ||
      entry.accession.slice(0, 10) !== entry.cik ||
      !isFilingForm(entry.form) ||
      typeof entry.acceptedAt !== "string" ||
      typeof entry.availableAt !== "string" ||
      typeof entry.contentSha256 !== "string" ||
      !HASH.test(entry.contentSha256) ||
      contentHashes.has(entry.contentSha256) ||
      !Number.isInteger(entry.contentBytes) ||
      (entry.contentBytes as number) < 1 ||
      (entry.contentBytes as number) >
        PERSONAL_FILING_CORPUS_LIMITS.entryContentBytes ||
      !isMediaType(entry.mediaType) ||
      entry.source !== "sec_edgar" ||
      entry.sourceLocator !== `sec-edgar:${entry.accession}` ||
      typeof entry.taxonomy !== "string" ||
      !TAXONOMY.test(entry.taxonomy) ||
      (entry.amendmentOf !== null &&
        (typeof entry.amendmentOf !== "string" ||
          !ACCESSION.test(entry.amendmentOf)))
    ) {
      fail(code);
    }
    const acceptedAt = parseInstant(entry.acceptedAt, code);
    const availableAt = parseInstant(entry.availableAt, code);
    if (acceptedAt > availableAt || availableAt > frozenAt) fail(code);

    const amendment = entry.form.endsWith("/A");
    if (amendment !== (entry.amendmentOf !== null)) fail(code);
    if (entry.amendmentOf !== null) {
      const predecessor = entriesByAccession.get(entry.amendmentOf);
      if (
        predecessor === undefined ||
        predecessor.cik !== entry.cik ||
        predecessor.form !== entry.form.slice(0, -2) ||
        predecessor.acceptedAt >= acceptedAt ||
        predecessor.availableAt > availableAt
      ) {
        fail(code);
      }
    }

    totalDeclaredBytes += entry.contentBytes as number;
    if (
      totalDeclaredBytes >
      PERSONAL_FILING_CORPUS_LIMITS.totalDeclaredContentBytes
    ) {
      fail(code);
    }
    const manifestEntry = Object.freeze({
      accession: entry.accession,
      acceptedAt,
      availableAt,
      cik: entry.cik,
      form: entry.form,
    });
    entriesByAccession.set(entry.accession, manifestEntry);
    contentHashes.add(entry.contentSha256);
    previousAccession = entry.accession;
  }

  return Object.freeze({
    corpusId: record.corpusId,
    corpusVersion: record.corpusVersion,
    filingCount: record.entries.length,
    frozenAt: record.frozenAt,
    totalDeclaredBytes,
  });
}

function parseCanonicalDocument(
  bytes: Uint8Array,
  maximumBytes: number,
  code: PersonalFilingCorpusFailureCode,
): unknown {
  if (bytes.byteLength < 3 || bytes.byteLength > maximumBytes) fail(code);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    fail(code);
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    fail(code);
  }
  try {
    assertJsonBudget(value, code);
    if (`${canonicalJson(value)}\n` !== text) fail(code);
  } catch (error) {
    if (error instanceof InternalPersonalFilingCorpusFailure) throw error;
    fail(code);
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (!isPlainRecord(value)) throw new TypeError();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function assertJsonBudget(
  root: unknown,
  code: PersonalFilingCorpusFailureCode,
): void {
  const stack: Array<{ depth: number; value: unknown }> = [
    { depth: 0, value: root },
  ];
  let nodes = 0;
  let stringCodePoints = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) fail(code);
    nodes += 1;
    if (
      nodes > PERSONAL_FILING_CORPUS_LIMITS.documentNodes ||
      current.depth > PERSONAL_FILING_CORPUS_LIMITS.documentDepth
    ) {
      fail(code);
    }
    if (typeof current.value === "string") {
      stringCodePoints += current.value.length;
    } else if (
      current.value === null ||
      typeof current.value === "boolean" ||
      (typeof current.value === "number" && Number.isSafeInteger(current.value))
    ) {
      continue;
    } else if (Array.isArray(current.value)) {
      for (const value of current.value) {
        stack.push({ depth: current.depth + 1, value });
      }
    } else {
      if (!isPlainRecord(current.value)) fail(code);
      for (const [key, value] of Object.entries(current.value)) {
        stringCodePoints += key.length;
        stack.push({ depth: current.depth + 1, value });
      }
    }
    if (
      stringCodePoints > PERSONAL_FILING_CORPUS_LIMITS.aggregateStringCodePoints
    ) {
      fail(code);
    }
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  code: PersonalFilingCorpusFailureCode,
): Record<string, unknown> {
  if (!isPlainRecord(value) || !exactKeys(Object.keys(value), keys)) fail(code);
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isExactDataObject(value: unknown, keys: readonly string[]): boolean {
  if (!isPlainRecord(value)) return false;
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => typeof key !== "string") ||
    !exactKeys(ownKeys as string[], keys) ||
    !exactKeys(Object.keys(descriptors), keys)
  ) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = descriptors[key];
    return (
      descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.enumerable === true
    );
  });
}

function exactKeys(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedExpected.every((key, index) => sortedActual[index] === key);
}

function isFilingForm(value: unknown): value is FilingForm {
  return FORMS.includes(value as FilingForm);
}

function isMediaType(value: unknown): boolean {
  return MEDIA_TYPES.includes(value as (typeof MEDIA_TYPES)[number]);
}

function parseInstant(
  value: string,
  code: PersonalFilingCorpusFailureCode,
): number {
  if (!ISO_UTC.test(value)) fail(code);
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== value) {
    fail(code);
  }
  return instant;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fail(code: PersonalFilingCorpusFailureCode): never {
  throw new InternalPersonalFilingCorpusFailure(code);
}
