import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS as LIMITS,
  type PersonalSecQuarterlyConcept,
  type PersonalSecQuarterlyEvidenceDto,
  type PersonalSecQuarterlyObservationDto,
  type PersonalSecQuarterlySourceStatus,
} from "@research-cockpit/contracts";

import {
  PersonalSecRequestSchedulerError,
  sharedPersonalSecRequestScheduler,
  type PersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";

export type PersonalSecQuarterlyEvidenceProviderErrorCode =
  "not_configured" | "invalid_request" | "busy" | "aborted";

export interface PersonalSecQuarterlyEvidenceProvider {
  status(): Readonly<{ configured: boolean }>;
  loadEvidence(
    cik: string,
    signal?: AbortSignal,
  ): Promise<PersonalSecQuarterlyEvidenceDto>;
  close(): void;
}

export interface SecPersonalQuarterlyEvidenceProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  readonly scheduler?: PersonalSecRequestScheduler;
}

const MESSAGE = "Personal SEC quarterly evidence is unavailable.";
const DAY_MS = 86_400_000;

export class PersonalSecQuarterlyEvidenceProviderError extends Error {
  public constructor(
    public readonly code: PersonalSecQuarterlyEvidenceProviderErrorCode,
  ) {
    super(MESSAGE);
    this.name = "PersonalSecQuarterlyEvidenceProviderError";
  }
}

class SourceError extends Error {
  public constructor(
    public readonly status: Exclude<
      PersonalSecQuarterlySourceStatus,
      "available"
    >,
  ) {
    super(MESSAGE);
  }
}

class SourceNumber {
  public constructor(public readonly lexeme: string) {}
}

type RawObservation = Omit<PersonalSecQuarterlyObservationDto, "filing">;
type FilingMetadata = Omit<
  PersonalSecQuarterlyObservationDto["filing"],
  "status"
>;
type SourceResult<T> =
  | { readonly status: "available"; readonly value: T }
  | { readonly status: Exclude<PersonalSecQuarterlySourceStatus, "available"> };

interface Facts {
  readonly observations: readonly RawObservation[];
  readonly inspectedRows: number;
  readonly invalidRows: number;
  readonly duplicateRows: number;
  readonly conceptsWithoutUsd: readonly PersonalSecQuarterlyConcept[];
}

interface Submissions {
  readonly filings: ReadonlyMap<string, FilingMetadata>;
  readonly olderHistoryAvailable: boolean;
}

export function createSecPersonalQuarterlyEvidenceProvider(
  userAgent?: string,
  dependencies: SecPersonalQuarterlyEvidenceProviderDependencies = {},
): PersonalSecQuarterlyEvidenceProvider {
  return new SecPersonalQuarterlyEvidenceProvider(userAgent, dependencies);
}

class SecPersonalQuarterlyEvidenceProvider implements PersonalSecQuarterlyEvidenceProvider {
  readonly #userAgent: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #scheduler: PersonalSecRequestScheduler;
  #active: AbortController | undefined;
  #closed = false;

  public constructor(
    userAgent: string | undefined,
    dependencies: SecPersonalQuarterlyEvidenceProviderDependencies,
  ) {
    this.#userAgent = validUserAgent(userAgent) ? userAgent : undefined;
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
    this.#scheduler =
      dependencies.scheduler ?? sharedPersonalSecRequestScheduler;
    if (
      typeof this.#fetch !== "function" ||
      typeof this.#now !== "function" ||
      typeof this.#scheduler.wait !== "function"
    )
      throw new TypeError(MESSAGE);
  }

  public status(): Readonly<{ configured: boolean }> {
    return Object.freeze({
      configured: !this.#closed && this.#userAgent !== undefined,
    });
  }

  public close(): void {
    this.#closed = true;
    this.#active?.abort();
  }

  public async loadEvidence(
    cik: string,
    signal?: AbortSignal,
  ): Promise<PersonalSecQuarterlyEvidenceDto> {
    if (this.#closed || signal?.aborted === true) fail("aborted");
    if (this.#userAgent === undefined) fail("not_configured");
    if (
      !validClock(this.#now()) ||
      typeof cik !== "string" ||
      !/^\d{10}$/u.test(cik) ||
      /^0+$/u.test(cik)
    )
      fail("invalid_request");
    if (this.#active !== undefined) fail("busy");
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    this.#active = controller;
    try {
      // Fixed SEC routes only: no source-provided files/URLs or older pagination.
      // https://www.sec.gov/search-filings/edgar-application-programming-interfaces
      const companyFactsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
      const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
      const facts = await this.#load(
        companyFactsUrl,
        controller.signal,
        (value) => normalizeFacts(value, cik),
      );
      const submissions = await this.#load(
        submissionsUrl,
        controller.signal,
        (value) => normalizeSubmissions(value, cik),
      );
      if (controller.signal.aborted || this.#closed) fail("aborted");
      const fetchedAt = this.#now();
      if (!validClock(fetchedAt)) fail("invalid_request");
      const sourceFacts =
        facts.status === "available" ? facts.value : undefined;
      const observations = retainPersonalSecQuarterlyObservations(
        sourceFacts?.observations ?? [],
      ).map((row): PersonalSecQuarterlyObservationDto =>
        Object.freeze({ ...row, filing: joinFiling(row, submissions) }),
      );
      return Object.freeze({
        cik,
        fetchedAt: fetchedAt.toISOString(),
        sources: Object.freeze({
          companyFacts: Object.freeze({
            status: facts.status,
            sourceUrl: companyFactsUrl,
          }),
          submissions: Object.freeze({
            status: submissions.status,
            sourceUrl: submissionsUrl,
          }),
        }),
        olderHistoryAvailable:
          submissions.status === "available" &&
          submissions.value.olderHistoryAvailable,
        coverage: Object.freeze({
          inspectedRows: sourceFacts?.inspectedRows ?? 0,
          invalidRows: sourceFacts?.invalidRows ?? 0,
          duplicateRows: sourceFacts?.duplicateRows ?? 0,
          availableObservations: sourceFacts?.observations.length ?? 0,
          returnedObservations: observations.length,
          truncated:
            (sourceFacts?.observations.length ?? 0) > observations.length,
          conceptsWithoutUsd:
            sourceFacts?.conceptsWithoutUsd ?? Object.freeze([]),
        }),
        observations: Object.freeze(observations),
        ttm: Object.freeze({
          status: "unavailable",
          reason: "period_and_revision_not_admitted",
        }),
      });
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (this.#active === controller) this.#active = undefined;
    }
  }

  async #load<T>(
    sourceUrl: string,
    signal: AbortSignal,
    normalize: (value: unknown) => T,
  ): Promise<SourceResult<T>> {
    try {
      const bytes = await fetchPersonalSecSourceBytes({
        sourceUrl,
        fetch: this.#fetch,
        scheduler: this.#scheduler,
        userAgent: this.#userAgent!,
        signal,
        maximumBytes: LIMITS.responseBytes,
        accept: "application/json",
      });
      const value = normalize(parseJson(decodePersonalSecSourceUtf8(bytes)));
      return { status: "available", value };
    } catch (error) {
      if (signal.aborted || this.#closed) fail("aborted");
      if (error instanceof PersonalSecRequestSchedulerError) fail(error.code);
      return {
        status:
          error instanceof SourceError ? error.status : "upstream_unavailable",
      };
    }
  }
}

/** Shared bounded transport; callers construct fixed SEC URLs, never browser URLs. */
export async function fetchPersonalSecSourceBytes(input: {
  readonly sourceUrl: string;
  readonly fetch: typeof globalThis.fetch;
  readonly scheduler: PersonalSecRequestScheduler;
  readonly userAgent: string;
  readonly signal: AbortSignal;
  readonly maximumBytes: number;
  readonly accept: string;
  readonly mediaTypes?: readonly string[];
}): Promise<Uint8Array> {
  try {
    await input.scheduler.wait(input.signal);
  } catch (error) {
    if (input.signal.aborted)
      throw new PersonalSecRequestSchedulerError("aborted");
    if (error instanceof PersonalSecRequestSchedulerError) throw error;
    throw new PersonalSecRequestSchedulerError("busy");
  }
  if (input.signal.aborted)
    throw new PersonalSecRequestSchedulerError("aborted");
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  input.signal.addEventListener("abort", onAbort, { once: true });
  // Queuing does not consume this per-request transport deadline.
  const timeout = setTimeout(() => controller.abort(), LIMITS.requestTimeoutMs);
  try {
    const response = await withAbort(
      input.fetch(input.sourceUrl, {
        method: "GET",
        headers: { Accept: input.accept, "User-Agent": input.userAgent },
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: controller.signal,
      }),
      controller.signal,
    );
    if (
      !(response instanceof Response) ||
      response.redirected ||
      (response.url !== "" && response.url !== input.sourceUrl)
    ) {
      if (response instanceof Response)
        void response.body?.cancel().catch(() => undefined);
      throw new SourceError("invalid_response");
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      throw new SourceError(
        response.status === 404
          ? "not_covered"
          : response.status === 429
            ? "rate_limited"
            : "upstream_unavailable",
      );
    }
    if (input.mediaTypes !== undefined) {
      const media = response.headers.get("content-type")?.toLowerCase();
      const match = media?.match(
        /^([^;\s]+)(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/u,
      );
      if (
        match === null ||
        match === undefined ||
        !input.mediaTypes.includes(match[1]!)
      ) {
        void response.body?.cancel().catch(() => undefined);
        throw new SourceError("invalid_response");
      }
    }
    const bytes = await readBoundedBytes(
      response,
      controller.signal,
      input.maximumBytes,
    );
    if (controller.signal.aborted)
      throw new SourceError("upstream_unavailable");
    return bytes;
  } catch (error) {
    if (input.signal.aborted)
      throw new PersonalSecRequestSchedulerError("aborted");
    if (error instanceof SourceError) throw error;
    throw new SourceError("upstream_unavailable");
  } finally {
    clearTimeout(timeout);
    input.signal.removeEventListener("abort", onAbort);
  }
}

/** The inspector revalidates against the same complete retained row set as the panel. */
export function retainPersonalSecQuarterlyObservations(
  observations: readonly RawObservation[],
): readonly RawObservation[] {
  const counts = { revenue: 0, net_income: 0 };
  return Object.freeze(
    observations.filter(
      (row) => counts[row.metric]++ < LIMITS.observationsPerMetric,
    ),
  );
}

export {
  SourceError as PersonalSecSourceError,
  parseJson as parsePersonalSecSourceJson,
  normalizeFacts as normalizePersonalSecCompanyFacts,
  normalizeSubmissions as normalizePersonalSecSubmissions,
  validClock as isPersonalSecClock,
  validUserAgent as isPersonalSecUserAgent,
};

function normalizeFacts(value: unknown, cik: string): Facts {
  if (
    !isRecord(value) ||
    normalizeCik(value.cik) !== cik ||
    !isRecord(value.facts)
  )
    throw new SourceError("invalid_response");
  const taxonomy = value.facts["us-gaap"];
  if (taxonomy !== undefined && !isRecord(taxonomy))
    throw new SourceError("invalid_response");
  const candidates: {
    concept: PersonalSecQuarterlyConcept;
    rows: readonly unknown[];
  }[] = [];
  const conceptsWithoutUsd: PersonalSecQuarterlyConcept[] = [];
  let inspectedRows = 0;
  for (const concept of PERSONAL_SEC_QUARTERLY_CONCEPTS) {
    const entry = taxonomy?.[concept];
    if (entry === undefined) {
      conceptsWithoutUsd.push(concept);
      continue;
    }
    if (!isRecord(entry) || !isRecord(entry.units))
      throw new SourceError("invalid_response");
    const rows = entry.units.USD;
    if (rows === undefined) {
      conceptsWithoutUsd.push(concept);
      continue;
    }
    if (!Array.isArray(rows)) throw new SourceError("invalid_response");
    inspectedRows += rows.length;
    if (inspectedRows > LIMITS.candidateRows)
      throw new SourceError("candidate_limit");
    if (rows.length === 0) conceptsWithoutUsd.push(concept);
    candidates.push({ concept, rows });
  }
  let invalidRows = 0;
  let duplicateRows = 0;
  const unique = new Map<string, RawObservation>();
  for (const { concept, rows } of candidates) {
    for (const [index, raw] of rows.entries()) {
      const row = normalizeObservation(raw, concept, index);
      if (row === null) {
        invalidRows += 1;
        continue;
      }
      if (unique.has(row.id)) {
        duplicateRows += 1;
        continue;
      }
      unique.set(row.id, row);
    }
  }
  const observations = [...unique.values()].sort(
    (a, b) =>
      b.endDate.localeCompare(a.endDate) ||
      (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
      b.filedDate.localeCompare(a.filedDate) ||
      a.accessionNumber.localeCompare(b.accessionNumber) ||
      a.concept.localeCompare(b.concept) ||
      a.id.localeCompare(b.id),
  );
  return {
    observations: Object.freeze(observations),
    inspectedRows,
    invalidRows,
    duplicateRows,
    conceptsWithoutUsd: Object.freeze(conceptsWithoutUsd),
  };
}

function normalizeObservation(
  value: unknown,
  concept: PersonalSecQuarterlyConcept,
  index: number,
): RawObservation | null {
  if (!isRecord(value)) return null;
  const startDate =
    value.start === undefined || value.start === null ? null : value.start;
  const endDate = value.end;
  const decimal = normalizeDecimal(value.val);
  const filingFocusYear =
    value.fy === undefined || value.fy === null ? null : sourceYear(value.fy);
  const filingFocusPeriod = optionalText(value.fp, 32);
  const frame = optionalText(value.frame, 128);
  if (
    (startDate !== null && !validDate(startDate)) ||
    !validDate(endDate) ||
    (startDate !== null && startDate > endDate) ||
    decimal === null ||
    filingFocusYear === undefined ||
    filingFocusPeriod === undefined ||
    frame === undefined ||
    !validAccession(value.accn) ||
    !validForm(value.form) ||
    !validDate(value.filed)
  )
    return null;
  const fields = {
    metric:
      concept === "NetIncomeLoss"
        ? ("net_income" as const)
        : ("revenue" as const),
    taxonomy: "us-gaap" as const,
    concept,
    unit: "USD" as const,
    value: decimal,
    startDate,
    endDate,
    durationDays:
      startDate === null
        ? null
        : (Date.parse(endDate) - Date.parse(startDate)) / DAY_MS + 1,
    periodBasis: "unresolved" as const,
    filingFocusYear,
    filingFocusPeriod,
    frame,
    accessionNumber: value.accn,
    form: value.form,
    filedDate: value.filed,
  };
  return Object.freeze({
    id: `sec-fact:${createHash("sha256").update(JSON.stringify(fields)).digest("hex")}`,
    ...fields,
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
  });
}

function normalizeSubmissions(value: unknown, cik: string): Submissions {
  if (
    !isRecord(value) ||
    normalizeCik(value.cik) !== cik ||
    !isRecord(value.filings) ||
    !isRecord(value.filings.recent) ||
    (value.filings.files !== undefined && !Array.isArray(value.filings.files))
  )
    throw new SourceError("invalid_response");
  const recent = value.filings.recent;
  const accessions = recent.accessionNumber;
  if (!Array.isArray(accessions)) throw new SourceError("invalid_response");
  if (accessions.length > LIMITS.submissionRows)
    throw new SourceError("candidate_limit");
  const forms = recent.form;
  const filedDates = recent.filingDate;
  const reportDates = recent.reportDate;
  const acceptedDates = recent.acceptanceDateTime;
  if (
    !Array.isArray(forms) ||
    !Array.isArray(filedDates) ||
    !Array.isArray(reportDates) ||
    forms.length !== accessions.length ||
    filedDates.length !== accessions.length ||
    reportDates.length !== accessions.length ||
    (acceptedDates !== undefined &&
      (!Array.isArray(acceptedDates) ||
        acceptedDates.length !== accessions.length))
  )
    throw new SourceError("invalid_response");
  const filings = new Map<string, FilingMetadata>();
  for (let index = 0; index < accessions.length; index += 1) {
    const accession: unknown = accessions[index];
    const form: unknown = forms[index];
    const filedDate: unknown = filedDates[index];
    const rawReport: unknown = reportDates[index];
    const reportDate =
      rawReport === "" || rawReport === null ? null : rawReport;
    const rawAccepted: unknown = acceptedDates?.[index];
    const acceptedAt =
      rawAccepted === undefined || rawAccepted === null || rawAccepted === ""
        ? null
        : rawAccepted;
    if (
      !validAccession(accession) ||
      !validForm(form) ||
      !validDate(filedDate) ||
      (reportDate !== null && !validDate(reportDate)) ||
      (acceptedAt !== null && !validAcceptedAt(acceptedAt))
    )
      throw new SourceError("invalid_response");
    const row = Object.freeze({
      form,
      filedDate,
      reportDate,
      acceptedAt,
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${accession}-index.htm`,
    });
    const previous = filings.get(accession);
    if (
      previous !== undefined &&
      JSON.stringify(previous) !== JSON.stringify(row)
    )
      throw new SourceError("invalid_response");
    filings.set(accession, row);
  }
  return {
    filings,
    olderHistoryAvailable:
      Array.isArray(value.filings.files) && value.filings.files.length > 0,
  };
}

function joinFiling(
  row: RawObservation,
  submissions: SourceResult<Submissions>,
): PersonalSecQuarterlyObservationDto["filing"] {
  const found =
    submissions.status === "available"
      ? submissions.value.filings.get(row.accessionNumber)
      : undefined;
  return found === undefined
    ? Object.freeze({
        status:
          submissions.status === "available"
            ? "not_in_current_submissions"
            : "submissions_unavailable",
        form: null,
        filedDate: null,
        reportDate: null,
        acceptedAt: null,
        sourceUrl: null,
      })
    : Object.freeze({
        status:
          found.form === row.form && found.filedDate === row.filedDate
            ? "matched"
            : "metadata_conflict",
        ...found,
      });
}

function normalizeDecimal(value: unknown): string | null {
  // JSON reviver source text preserves unsafe integers and exponent literals.
  // Do not accept strings or convert through IEEE-754 arithmetic.
  if (!(value instanceof SourceNumber) || value.lexeme.length > 256)
    return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(
    value.lexeme,
  );
  if (match === null) return null;
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000)
    return null;
  const integer = match[2]!;
  const fraction = match[3] ?? "";
  const rawDigits = integer + fraction;
  const leading = /^0*/u.exec(rawDigits)![0].length;
  const digits = rawDigits.slice(leading).replace(/0+$/u, "");
  if (digits === "") return "0";
  const point = integer.length + exponent - leading;
  const sign = match[1]!;
  const length =
    sign.length +
    (point <= 0
      ? 2 - point + digits.length
      : point >= digits.length
        ? point
        : digits.length + 1);
  if (length > LIMITS.decimalCharacters) return null;
  return (
    sign +
    (point <= 0
      ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + "0".repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`)
  );
}

function normalizeCik(value: unknown): string | undefined {
  const text = value instanceof SourceNumber ? value.lexeme : value;
  return typeof text === "string" &&
    /^\d{1,10}$/u.test(text) &&
    !/^0+$/u.test(text)
    ? text.padStart(10, "0")
    : undefined;
}

function sourceYear(value: unknown): number | undefined {
  return value instanceof SourceNumber &&
    /^\d{4}$/u.test(value.lexeme) &&
    Number(value.lexeme) >= 1000
    ? Number(value.lexeme)
    : undefined;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" &&
    value.length <= max &&
    /^[\x20-\x7E]+$/u.test(value) &&
    value === value.trim()
    ? value
    : undefined;
}

function validAccession(value: unknown): value is string {
  return typeof value === "string" && /^\d{10}-\d{2}-\d{6}$/u.test(value);
}

function validForm(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u.test(value)
  );
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    value >= "1000-01-01" &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
  );
}

function validAcceptedAt(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  )
    return false;
  const time = Date.parse(value);
  return (
    value >= "1000-01-01" &&
    Number.isFinite(time) &&
    new Date(time).toISOString() ===
      (value.length === 20 ? value.replace("Z", ".000Z") : value)
  );
}

function validUserAgent(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    /^[\x20-\x7E]{8,256}$/u.test(value) &&
    /\S+@[^\s@]+\.[^\s@]+/u.test(value)
  );
}

function validClock(value: Date): boolean {
  return (
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getUTCFullYear() >= 2010 &&
    value.getUTCFullYear() <= 9998
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof SourceNumber)
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(
      text,
      (_key: string, value: unknown, context?: { source?: string }) =>
        typeof value === "number"
          ? new SourceNumber(context?.source ?? "")
          : value,
    );
  } catch {
    throw new SourceError("invalid_response");
  }
}

function fail(code: PersonalSecQuarterlyEvidenceProviderErrorCode): never {
  throw new PersonalSecQuarterlyEvidenceProviderError(code);
}

async function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) fail("aborted");
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        onAbort = () =>
          reject(new PersonalSecQuarterlyEvidenceProviderError("aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort !== undefined) signal.removeEventListener("abort", onAbort);
  }
}

async function readBoundedBytes(
  response: Response,
  signal: AbortSignal,
  maximumBytes: number,
): Promise<Uint8Array> {
  const length = response.headers.get("content-length");
  if (
    length !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(length) || !Number.isSafeInteger(Number(length)))
  ) {
    void response.body?.cancel().catch(() => undefined);
    throw new SourceError("invalid_response");
  }
  if (length !== null && Number(length) > maximumBytes) {
    void response.body?.cancel().catch(() => undefined);
    throw new SourceError("response_too_large");
  }
  if (response.body === null) throw new SourceError("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await withAbort(reader.read(), signal);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array))
        throw new SourceError("invalid_response");
      size += result.value.byteLength;
      if (size > maximumBytes) throw new SourceError("response_too_large");
      chunks.push(result.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (size === 0) throw new SourceError("invalid_response");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function decodePersonalSecSourceUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SourceError("invalid_response");
  }
}
