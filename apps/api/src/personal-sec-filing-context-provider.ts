import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_FILING_CONTEXT_LIMITS,
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecFilingContextInspectionDto,
  type PersonalSecFilingContextSelectionDto,
  type PersonalSecFilingContextUnavailableReason,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";

import {
  createPersonalSecFilingContextParser,
  PersonalSecFilingContextParserError,
  type PersonalSecFilingContextParser,
} from "./personal-sec-filing-context-parser";
import {
  decodePersonalSecSourceUtf8,
  fetchPersonalSecSourceBytes,
  isPersonalSecClock,
  isPersonalSecUserAgent,
  normalizePersonalSecCompanyFacts,
  normalizePersonalSecSubmissions,
  parsePersonalSecSourceJson,
  PersonalSecSourceError,
  retainPersonalSecQuarterlyObservations,
} from "./personal-sec-quarterly-evidence-provider";
import {
  PersonalSecRequestSchedulerError,
  sharedPersonalSecRequestScheduler,
  type PersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";

export type PersonalSecFilingContextProviderErrorCode =
  "not_configured" | "invalid_request" | "busy" | "aborted";

export class PersonalSecFilingContextProviderError extends Error {
  public constructor(
    public readonly code: PersonalSecFilingContextProviderErrorCode,
  ) {
    super("Personal SEC filing context is unavailable.");
    this.name = "PersonalSecFilingContextProviderError";
  }
}

export interface PersonalSecFilingContextProvider {
  status(): Readonly<{ configured: boolean }>;
  loadContext(
    cik: string,
    selection: PersonalSecFilingContextSelectionDto,
    signal?: AbortSignal,
  ): Promise<PersonalSecFilingContextInspectionDto>;
  close(): void;
}

export interface SecPersonalFilingContextProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  readonly scheduler?: PersonalSecRequestScheduler;
  readonly parser?: PersonalSecFilingContextParser;
}

const SELECTION_FIELDS = Object.freeze([
  "id",
  "metric",
  "taxonomy",
  "concept",
  "unit",
  "value",
  "startDate",
  "endDate",
  "accessionNumber",
  "form",
  "filedDate",
] as const);
type InspectionStage = Extract<
  PersonalSecFilingContextInspectionDto,
  { status: "unavailable" }
>["stage"];

export function createSecPersonalFilingContextProvider(
  userAgent?: string,
  dependencies: SecPersonalFilingContextProviderDependencies = {},
): PersonalSecFilingContextProvider {
  return new SecPersonalFilingContextProvider(userAgent, dependencies);
}

class SecPersonalFilingContextProvider implements PersonalSecFilingContextProvider {
  readonly #userAgent: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #scheduler: PersonalSecRequestScheduler;
  readonly #parser: PersonalSecFilingContextParser;
  #active: AbortController | undefined;
  #closed = false;

  public constructor(
    userAgent: string | undefined,
    dependencies: SecPersonalFilingContextProviderDependencies,
  ) {
    this.#userAgent = isPersonalSecUserAgent(userAgent) ? userAgent : undefined;
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
    this.#scheduler =
      dependencies.scheduler ?? sharedPersonalSecRequestScheduler;
    this.#parser =
      dependencies.parser ?? createPersonalSecFilingContextParser();
    if (
      typeof this.#fetch !== "function" ||
      typeof this.#now !== "function" ||
      typeof this.#scheduler.wait !== "function" ||
      typeof this.#parser.parse !== "function" ||
      typeof this.#parser.close !== "function"
    )
      throw new TypeError("Invalid SEC filing context dependency.");
  }

  public status(): Readonly<{ configured: boolean }> {
    return Object.freeze({
      configured: !this.#closed && this.#userAgent !== undefined,
    });
  }

  public close(): void {
    this.#closed = true;
    this.#active?.abort();
    this.#parser.close();
  }

  public async loadContext(
    cik: string,
    requested: PersonalSecFilingContextSelectionDto,
    signal?: AbortSignal,
  ): Promise<PersonalSecFilingContextInspectionDto> {
    if (this.#closed || signal?.aborted) fail("aborted");
    if (this.#userAgent === undefined) fail("not_configured");
    if (
      typeof cik !== "string" ||
      !/^(?!0000000000)\d{10}$/u.test(cik) ||
      !isPersonalSecFilingContextSelection(requested)
    )
      fail("invalid_request");
    this.#timestamp();
    if (this.#active !== undefined) fail("busy");
    // Snapshot browser input before the first await. IDs alone are never proof.
    const selection = Object.freeze({ ...requested });
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    this.#active = controller;
    let stage: InspectionStage = "company_facts";
    try {
      const companyFactsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
      const facts = normalizePersonalSecCompanyFacts(
        parsePersonalSecSourceJson(
          decodePersonalSecSourceUtf8(
            await this.#get(companyFactsUrl, controller.signal, false),
          ),
        ),
        cik,
      );
      const companyFacts = Object.freeze({
        sourceUrl: companyFactsUrl,
        fetchedAt: this.#timestamp(),
      });
      const selected = retainPersonalSecQuarterlyObservations(
        facts.observations,
      ).find((row) =>
        SELECTION_FIELDS.every((field) => row[field] === selection[field]),
      );
      if (selected === undefined)
        return unavailable(cik, stage, "selection_changed_or_not_retained");

      stage = "submissions";
      const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
      const rawSubmissions = parsePersonalSecSourceJson(
        decodePersonalSecSourceUtf8(
          await this.#get(submissionsUrl, controller.signal, false),
        ),
      );
      const current = normalizePersonalSecSubmissions(rawSubmissions, cik);
      const submissions = Object.freeze({
        sourceUrl: submissionsUrl,
        fetchedAt: this.#timestamp(),
      });
      const filing = current.filings.get(selected.accessionNumber);
      if (filing === undefined)
        return unavailable(cik, stage, "accession_not_in_current_submissions");
      if (
        filing.form !== selected.form ||
        filing.filedDate !== selected.filedDate
      )
        return unavailable(cik, stage, "submission_metadata_conflict");
      const primaryDocument = selectedPrimaryDocument(
        rawSubmissions,
        selected.accessionNumber,
      );
      if (primaryDocument === null)
        return unavailable(cik, stage, "primary_document_unavailable");
      const observation: PersonalSecQuarterlyObservationDto = Object.freeze({
        ...selected,
        filing: Object.freeze({ status: "matched", ...filing }),
      });

      stage = "document";
      const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${selected.accessionNumber.replaceAll("-", "")}/${primaryDocument}`;
      const document = await this.#get(sourceUrl, controller.signal, true);
      // Validate encoding without retaining a second raw representation.
      decodePersonalSecSourceUtf8(document);
      const proof = Object.freeze({
        sourceUrl,
        fetchedAt: this.#timestamp(),
        sha256:
          `sha256:${createHash("sha256").update(document).digest("hex")}` as const,
        bytes: document.byteLength,
      });
      stage = "parser";
      if (controller.signal.aborted || this.#closed) fail("aborted");
      const analysis = await untilAborted(
        this.#parser.parse({ document, cik, selection }, controller.signal),
        controller.signal,
      );
      if (controller.signal.aborted || this.#closed) fail("aborted");
      return Object.freeze({
        status: "available",
        cik,
        observation,
        companyFacts,
        submissions,
        document: proof,
        analysis,
      });
    } catch (error) {
      if (controller.signal.aborted || this.#closed) fail("aborted");
      if (error instanceof PersonalSecFilingContextProviderError) throw error;
      if (error instanceof PersonalSecRequestSchedulerError) fail(error.code);
      if (error instanceof PersonalSecSourceError)
        return unavailable(cik, stage, error.status);
      if (error instanceof PersonalSecFilingContextParserError) {
        if (error.code === "busy") fail("busy");
        if (error.code === "aborted") fail("aborted");
        return unavailable(
          cik,
          "parser",
          error.code === "timeout"
            ? "parser_timeout"
            : error.code === "invalid_request"
              ? "invalid_output"
              : error.code,
        );
      }
      return unavailable(
        cik,
        stage,
        stage === "parser" ? "worker_failed" : "upstream_unavailable",
      );
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (this.#active === controller) this.#active = undefined;
    }
  }

  #timestamp(): string {
    const now = this.#now();
    if (!isPersonalSecClock(now)) fail("invalid_request");
    return now.toISOString();
  }

  #get(
    sourceUrl: string,
    signal: AbortSignal,
    document: boolean,
  ): Promise<Uint8Array> {
    return fetchPersonalSecSourceBytes({
      sourceUrl,
      signal,
      fetch: this.#fetch,
      scheduler: this.#scheduler,
      userAgent: this.#userAgent!,
      maximumBytes: document
        ? PERSONAL_SEC_FILING_CONTEXT_LIMITS.documentBytes
        : PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.responseBytes,
      accept: document
        ? "text/html, application/xhtml+xml, application/xml, text/xml"
        : "application/json",
      mediaTypes: document
        ? ["text/html", "application/xhtml+xml", "application/xml", "text/xml"]
        : ["application/json"],
    });
  }
}

export function isPersonalSecFilingContextSelection(
  value: unknown,
): value is PersonalSecFilingContextSelectionDto {
  if (
    !record(value) ||
    Object.keys(value).length !== SELECTION_FIELDS.length ||
    !SELECTION_FIELDS.every((field) => Object.hasOwn(value, field))
  )
    return false;
  return (
    typeof value.id === "string" &&
    /^sec-fact:[a-f0-9]{64}$/u.test(value.id) &&
    (value.metric === "revenue" || value.metric === "net_income") &&
    value.taxonomy === "us-gaap" &&
    typeof value.concept === "string" &&
    PERSONAL_SEC_QUARTERLY_CONCEPTS.some(
      (concept) => concept === value.concept,
    ) &&
    (value.metric === "net_income") === (value.concept === "NetIncomeLoss") &&
    value.unit === "USD" &&
    typeof value.value === "string" &&
    value.value.length <=
      PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.decimalCharacters &&
    /^-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/u.test(value.value) &&
    value.value !== "-0" &&
    date(value.startDate) &&
    date(value.endDate) &&
    value.startDate <= value.endDate &&
    typeof value.accessionNumber === "string" &&
    /^\d{10}-\d{2}-\d{6}$/u.test(value.accessionNumber) &&
    (value.form === "10-Q" || value.form === "10-Q/A") &&
    date(value.filedDate)
  );
}

function selectedPrimaryDocument(
  value: unknown,
  accession: string,
): string | null {
  if (!record(value) || !record(value.filings) || !record(value.filings.recent))
    return null;
  const { accessionNumber, primaryDocument } = value.filings.recent;
  if (
    !Array.isArray(accessionNumber) ||
    !Array.isArray(primaryDocument) ||
    accessionNumber.length !== primaryDocument.length
  )
    return null;
  let selected: string | null = null;
  for (let index = 0; index < accessionNumber.length; index++) {
    if (accessionNumber[index] !== accession) continue;
    const basename: unknown = primaryDocument[index];
    if (
      typeof basename !== "string" ||
      basename.length > 255 ||
      basename.includes("..") ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:htm|html|xhtml|xml)$/iu.test(basename)
    )
      return null;
    if (selected !== null && selected !== basename) return null;
    selected = basename;
  }
  return selected;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value))
    return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

function unavailable(
  cik: string,
  stage: "company_facts" | "submissions" | "document" | "parser",
  reason: PersonalSecFilingContextUnavailableReason,
): PersonalSecFilingContextInspectionDto {
  return Object.freeze({ cik, status: "unavailable", stage, reason });
}

function fail(code: PersonalSecFilingContextProviderErrorCode): never {
  throw new PersonalSecFilingContextProviderError(code);
}

async function untilAborted<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) fail("aborted");
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        abort = () =>
          reject(new PersonalSecFilingContextProviderError("aborted"));
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    if (abort !== undefined) signal.removeEventListener("abort", abort);
  }
}
