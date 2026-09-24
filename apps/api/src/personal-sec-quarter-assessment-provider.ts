import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS as LIMITS,
  isPersonalSecQuarterAssessmentSelection,
  isPersonalSecQuarterAssessmentTarget,
  isPersonalSecQuarterEvidence,
  personalSecQuarterBundlePayload,
  type AcquisitionReason,
  type AcquisitionStage,
  type PersonalSecQuarterAssessmentDto,
  type PersonalSecQuarterAssessmentSelectionDto,
  type PersonalSecQuarterAssessmentTargetDto,
  type PersonalSecQuarterEvidenceDto,
  type PersonalSecQuarterSourceDto,
  type PersonalSecQuarterSubmissionDto,
} from "@research-cockpit/contracts";
import { assessPersonalSecQuarterEvidence } from "@research-cockpit/personal-financial-analytics";

import {
  createPersonalSecFilingContextParser,
  PersonalSecFilingContextParserError,
  type PersonalSecPrimaryParser,
} from "./personal-sec-filing-context-parser";
import { selectedPersonalSecPrimaryDocument } from "./personal-sec-primary-document";
import { projectPersonalSecQuarterCompanyFacts } from "./personal-sec-quarter-assessment-company-facts";
import {
  PersonalSecQuarterOperation,
  PersonalSecQuarterOperationError,
} from "./personal-sec-quarter-operation";
import {
  decodePersonalSecSourceUtf8,
  fetchPersonalSecSourceBytes,
  isPersonalSecClock,
  isPersonalSecUserAgent,
  normalizePersonalSecSubmissions,
  PersonalSecSourceError,
} from "./personal-sec-quarterly-evidence-provider";
import {
  PersonalSecRequestSchedulerError,
  sharedPersonalSecRequestScheduler,
  type PersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";
import {
  parsePersonalSecSourceJsonStrict,
  PersonalSecQuarterSourceProjectionError,
} from "./personal-sec-source-json";

export class PersonalSecQuarterAssessmentProviderError extends Error {
  public constructor(
    public readonly code:
      "not_configured" | "invalid_request" | "busy" | "aborted",
  ) {
    super("The SEC quarter assessment is unavailable.");
    this.name = "PersonalSecQuarterAssessmentProviderError";
  }
}

export interface PersonalSecQuarterAssessmentProvider {
  status(): Readonly<{ configured: boolean }>;
  assess(
    target: PersonalSecQuarterAssessmentTargetDto,
    selection: PersonalSecQuarterAssessmentSelectionDto,
    signal?: AbortSignal,
  ): Promise<PersonalSecQuarterAssessmentDto>;
  close(): void;
}

export interface SecPersonalQuarterAssessmentDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  readonly monotonicNow?: () => number;
  readonly scheduler?: PersonalSecRequestScheduler;
  readonly parser?: PersonalSecPrimaryParser;
}

export function createSecPersonalQuarterAssessmentProvider(
  userAgent?: string,
  dependencies: SecPersonalQuarterAssessmentDependencies = {},
): PersonalSecQuarterAssessmentProvider {
  return new SecPersonalQuarterAssessmentProvider(userAgent, dependencies);
}

class SecPersonalQuarterAssessmentProvider implements PersonalSecQuarterAssessmentProvider {
  readonly #userAgent: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #monotonicNow: (() => number) | undefined;
  readonly #scheduler: PersonalSecRequestScheduler;
  readonly #parser: PersonalSecPrimaryParser;
  #active: AbortController | undefined;
  #closed = false;

  public constructor(
    userAgent: string | undefined,
    dependencies: SecPersonalQuarterAssessmentDependencies,
  ) {
    this.#userAgent = isPersonalSecUserAgent(userAgent) ? userAgent : undefined;
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
    this.#monotonicNow = dependencies.monotonicNow;
    this.#scheduler =
      dependencies.scheduler ?? sharedPersonalSecRequestScheduler;
    this.#parser =
      dependencies.parser ?? createPersonalSecFilingContextParser();
    if (
      typeof this.#fetch !== "function" ||
      typeof this.#now !== "function" ||
      (this.#monotonicNow !== undefined &&
        typeof this.#monotonicNow !== "function") ||
      typeof this.#scheduler.wait !== "function" ||
      typeof this.#parser.parseAccessionEvidence !== "function" ||
      typeof this.#parser.close !== "function"
    )
      throw new TypeError("Invalid SEC quarter assessment dependency.");
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

  public async assess(
    requestedTarget: PersonalSecQuarterAssessmentTargetDto,
    requestedSelection: PersonalSecQuarterAssessmentSelectionDto,
    signal?: AbortSignal,
  ): Promise<PersonalSecQuarterAssessmentDto> {
    if (this.#closed || signal?.aborted) fail("aborted");
    if (this.#userAgent === undefined) fail("not_configured");
    if (
      !isPersonalSecQuarterAssessmentTarget(requestedTarget) ||
      !isPersonalSecQuarterAssessmentSelection(requestedSelection)
    )
      fail("invalid_request");
    if (this.#active !== undefined) fail("busy");
    const target = Object.freeze({
      ...requestedTarget,
      security: Object.freeze({ ...requestedTarget.security }),
    });
    const selection = Object.freeze({ ...requestedSelection });
    const cik = target.security.cik;
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    const operation = new PersonalSecQuarterOperation(
      controller.signal,
      this.#monotonicNow,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    this.#active = controller;
    const sources: PersonalSecQuarterSourceDto[] = [];
    let stage: AcquisitionStage = "submissions";
    const unavailable = (
      reason: AcquisitionReason,
    ): PersonalSecQuarterAssessmentDto =>
      Object.freeze({
        status: "unavailable",
        cik,
        selection,
        stage,
        reason,
        sources: Object.freeze([...sources]),
      });
    let totalBytes = 0;
    const get = async (
      id: PersonalSecQuarterSourceDto["id"],
      sourceUrl: string,
    ): Promise<Uint8Array> => {
      operation.check();
      const retrievalStartedAt = this.#timestamp();
      const primary = id === "primary";
      const bytes = await fetchPersonalSecSourceBytes({
        sourceUrl,
        fetch: this.#fetch,
        scheduler: {
          wait: async (signal) => {
            operation.check();
            await this.#scheduler.wait(signal);
            operation.check();
          },
        },
        userAgent: this.#userAgent!,
        signal: operation.signal,
        maximumBytes: primary
          ? LIMITS.primaryBytes
          : id === "submissions"
            ? LIMITS.submissionsBytes
            : LIMITS.companyFactsBytes,
        accept: primary
          ? "text/html, application/xhtml+xml, application/xml, text/xml"
          : "application/json",
        mediaTypes: primary
          ? [
              "text/html",
              "application/xhtml+xml",
              "application/xml",
              "text/xml",
            ]
          : ["application/json"],
      });
      operation.check();
      totalBytes += bytes.byteLength;
      if (
        sources.length >= LIMITS.sourceGets ||
        totalBytes >
          LIMITS.submissionsBytes +
            LIMITS.companyFactsBytes +
            LIMITS.primaryBytes
      )
        throw new PersonalSecSourceError("response_too_large");
      // The digest describes received bytes before any UTF-8 or JSON decoding.
      const sha256 =
        `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const;
      const retrievalCompletedAt = this.#timestamp();
      if (retrievalCompletedAt < retrievalStartedAt) fail("invalid_request");
      sources.push(
        Object.freeze({
          id,
          sourceUrl,
          sha256,
          bytes: bytes.byteLength,
          retrievalStartedAt,
          retrievalCompletedAt,
        }),
      );
      operation.check();
      return bytes;
    };
    try {
      operation.check();
      if (selection.form === "10-Q/A" || selection.reportDate === null) {
        return Object.freeze({
          status: "held",
          cik,
          selection,
          stage: "selection",
          reason:
            selection.form === "10-Q/A"
              ? "unsupported_amendment"
              : "report_date_unresolved",
          sources: Object.freeze([]),
        });
      }
      const raw = parsePersonalSecSourceJsonStrict(
        decodePersonalSecSourceUtf8(
          await get(
            "submissions",
            `https://data.sec.gov/submissions/CIK${cik}.json`,
          ),
        ),
      );
      operation.check();
      const current = normalizePersonalSecSubmissions(raw, cik);
      const filing = current.filings.get(selection.accessionNumber);
      if (filing === undefined)
        return unavailable("accession_not_in_current_submissions");
      if (
        filing.form !== selection.form ||
        filing.filedDate !== selection.filedDate ||
        filing.reportDate !== selection.reportDate
      )
        return unavailable("submission_metadata_conflict");
      const primaryDocument = selectedPersonalSecPrimaryDocument(
        raw,
        selection.accessionNumber,
      );
      if (primaryDocument === null)
        return unavailable("primary_document_unavailable");
      const matchingRowIndices = selectedSubmissionRows(
        raw,
        selection.accessionNumber,
      );
      if (matchingRowIndices.length === 0)
        return unavailable("submission_metadata_conflict");
      const submission: PersonalSecQuarterSubmissionDto = Object.freeze({
        id: "submissions:selected",
        sourceId: "submissions",
        rowIndex: matchingRowIndices[0]!,
        matchingRowIndices,
        accessionNumber: selection.accessionNumber,
        form: "10-Q",
        filedDate: selection.filedDate,
        reportDate: selection.reportDate,
        acceptedAt: filing.acceptedAt,
        primaryDocument,
      });
      operation.check();
      stage = "company_facts";
      const companyFacts = projectPersonalSecQuarterCompanyFacts(
        await get(
          "company_facts",
          `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
        ),
        cik,
        selection.accessionNumber,
      );
      operation.check();
      stage = "document";
      const document = await get(
        "primary",
        `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${selection.accessionNumber.replaceAll("-", "")}/${primaryDocument}`,
      );
      decodePersonalSecSourceUtf8(document);
      operation.check();
      stage = "parser";
      // New parser mode settles cancellation only after its owned child closes.
      const primary = await this.#parser.parseAccessionEvidence(
        { document, cik, selection },
        operation.signal,
      );
      operation.check();
      if (primary.status !== "complete")
        return unavailable(primary.reason ?? "invalid_output");
      stage = "assembly";
      const evidence: PersonalSecQuarterEvidenceDto = Object.freeze({
        schemaVersion: "1.0.0",
        submission,
        companyFacts,
        primary,
      });
      if (!isPersonalSecQuarterEvidence(evidence))
        return unavailable("invalid_evidence_graph");
      operation.check();
      const result = assessPersonalSecQuarterEvidence({
        cik,
        selection,
        sources,
        evidence,
      });
      operation.check();
      if (result.status === "unavailable") return unavailable(result.reason);
      const acceptedAt = this.#timestamp();
      if (sources.some((source) => source.retrievalCompletedAt > acceptedAt))
        fail("invalid_request");
      const bundleId = `sha256:${createHash("sha256")
        .update(personalSecQuarterBundlePayload(target, selection, sources))
        .digest("hex")}` as const;
      const assessment: PersonalSecQuarterAssessmentDto = Object.freeze({
        status: result.analysis.pair.status,
        cik,
        selection,
        stage: "assessment",
        acceptedAt,
        bundleId,
        sources: Object.freeze([...sources]),
        evidence,
        analysis: result.analysis,
      });
      const serialized = JSON.stringify({
        schemaVersion: "1.0.0",
        ...target,
        assessment,
      });
      operation.check();
      if (Buffer.byteLength(serialized, "utf8") > LIMITS.finalResponseBytes)
        return unavailable("output_too_large");
      return assessment;
    } catch (error) {
      if (controller.signal.aborted || this.#closed) fail("aborted");
      try {
        operation.check();
      } catch (deadlineError) {
        if (
          deadlineError instanceof PersonalSecQuarterOperationError &&
          deadlineError.code === "operation_deadline"
        )
          return unavailable("operation_deadline");
        throw deadlineError;
      }
      if (error instanceof PersonalSecQuarterAssessmentProviderError)
        throw error;
      if (error instanceof PersonalSecQuarterSourceProjectionError)
        return unavailable(error.code);
      if (error instanceof PersonalSecSourceError)
        return unavailable(error.status);
      if (error instanceof PersonalSecRequestSchedulerError) fail(error.code);
      if (error instanceof PersonalSecFilingContextParserError) {
        if (error.code === "busy" || error.code === "aborted") fail(error.code);
        return unavailable(
          error.code === "timeout"
            ? "parser_timeout"
            : error.code === "invalid_request"
              ? "invalid_output"
              : error.code,
        );
      }
      return unavailable(
        stage === "assembly" ? "invalid_evidence_graph" : "invalid_response",
      );
    } finally {
      operation.dispose();
      signal?.removeEventListener("abort", abort);
      if (this.#active === controller) this.#active = undefined;
    }
  }

  #timestamp(): string {
    const now = this.#now();
    if (!isPersonalSecClock(now)) fail("invalid_request");
    return now.toISOString();
  }
}

function selectedSubmissionRows(
  raw: unknown,
  accession: string,
): readonly number[] {
  const recent = (
    raw as { filings: { recent: { accessionNumber: readonly unknown[] } } }
  ).filings.recent;
  return Object.freeze(
    recent.accessionNumber.flatMap((value, index) =>
      value === accession ? [index] : [],
    ),
  );
}

function fail(code: PersonalSecQuarterAssessmentProviderError["code"]): never {
  throw new PersonalSecQuarterAssessmentProviderError(code);
}
