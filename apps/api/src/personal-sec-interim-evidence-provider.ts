import { createHash } from "node:crypto";
import {
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS as LIMITS,
  type PersonalSecInterimCanonicalEvidenceDto,
  type PersonalSecInterimSourceDto,
  type PersonalSecInterimFilingDto,
} from "@research-cockpit/contracts";
import { selectPersonalSecInterimTarget } from "@research-cockpit/personal-financial-analytics";
import { createPersonalSecInterimCanonicalEvidence } from "./personal-sec-interim-canonical-evidence";
import {
  normalizePersonalSecInterimStatementCompanyFacts,
  unavailablePersonalSecInterimStatementCompanyFacts,
} from "./personal-sec-interim-statement-company-facts";
import {
  decodePersonalSecSourceUtf8,
  fetchPersonalSecSourceBytes,
  isPersonalSecClock,
  isPersonalSecUserAgent,
  normalizePersonalSecSubmissions,
  parsePersonalSecSourceJson,
  PersonalSecSourceError,
} from "./personal-sec-quarterly-evidence-provider";
import {
  PersonalSecRequestSchedulerError,
  sharedPersonalSecRequestScheduler,
  type PersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";

export type PersonalSecInterimEvidenceProviderErrorCode =
  "not_configured" | "invalid_request" | "busy" | "aborted";

export interface PersonalSecInterimEvidenceProvider {
  status(): Readonly<{ configured: boolean }>;
  loadEvidence(
    cik: string,
    signal?: AbortSignal,
  ): Promise<PersonalSecInterimCanonicalEvidenceDto>;
  close(): void;
}

export interface SecPersonalInterimEvidenceProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  readonly scheduler?: PersonalSecRequestScheduler;
}

const MESSAGE = "Personal SEC interim evidence is unavailable.";
type SourceResult<T> = Readonly<{
  source: PersonalSecInterimSourceDto;
  value?: T;
}>;

export class PersonalSecInterimEvidenceProviderError extends Error {
  public constructor(
    public readonly code: PersonalSecInterimEvidenceProviderErrorCode,
  ) {
    super(MESSAGE);
    this.name = "PersonalSecInterimEvidenceProviderError";
  }
}

export function createSecPersonalInterimEvidenceProvider(
  userAgent?: string,
  dependencies: SecPersonalInterimEvidenceProviderDependencies = {},
): PersonalSecInterimEvidenceProvider {
  return new SecPersonalInterimEvidenceProvider(userAgent, dependencies);
}

class SecPersonalInterimEvidenceProvider implements PersonalSecInterimEvidenceProvider {
  readonly #userAgent: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #scheduler: PersonalSecRequestScheduler;
  #active: AbortController | undefined;
  #closed = false;

  public constructor(
    userAgent: string | undefined,
    dependencies: SecPersonalInterimEvidenceProviderDependencies,
  ) {
    this.#userAgent = isPersonalSecUserAgent(userAgent) ? userAgent : undefined;
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
    this.#scheduler =
      dependencies.scheduler ?? sharedPersonalSecRequestScheduler;
    assertProviderFunctionType(typeof this.#fetch);
    assertProviderFunctionType(typeof this.#now);
    assertProviderFunctionType(typeof this.#scheduler.wait);
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
  ): Promise<PersonalSecInterimCanonicalEvidenceDto> {
    this.#admit(cik, signal);
    const clock = sourceCapture(this.#now);
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    this.#active = controller;
    try {
      return await this.#captureEvidence(cik, controller, clock);
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (this.#active === controller) this.#active = undefined;
    }
  }

  #assertOpen(signal?: AbortSignal): void {
    if (this.#closed) fail("aborted");
    if (signal?.aborted === true) fail("aborted");
  }
  #admit(cik: string, signal?: AbortSignal): void {
    this.#assertOpen(signal);
    if (this.#userAgent === undefined) fail("not_configured");
    assertCik(cik);
    if (this.#active !== undefined) fail("busy");
  }
  async #captureEvidence(
    cik: string,
    controller: AbortController,
    clock: SourceClock,
  ): Promise<PersonalSecInterimCanonicalEvidenceDto> {
    const { cutoffAt, capture } = clock;
    // Select solely from the bounded current Submissions packet before facts.
    // Source-provided document/history URLs are never fetched.
    const submissions = await this.#load(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      controller.signal,
      (value) => normalizePersonalSecSubmissions(value, cik),
      capture,
    );
    const filings = capturedFilings(submissions);
    const target = capturedTarget(submissions, filings, cutoffAt);
    const facts = await this.#load(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      controller.signal,
      (value) =>
        normalizePersonalSecInterimStatementCompanyFacts(
          value,
          cik,
          targetAccession(target),
        ),
      capture,
    );
    if (controller.signal.aborted || this.#closed) fail("aborted");
    const completedAt = capture();
    const targetScan = capturedScan(submissions, filings);
    return createPersonalSecInterimCanonicalEvidence({
      cik,
      generation: {
        definitionVersion: PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
        cutoffAt,
        completedAt,
        sources: {
          companyFacts: facts.source,
          submissions: submissions.source,
        },
      },
      target,
      targetScan,
      facts:
        facts.value ??
        unavailablePersonalSecInterimStatementCompanyFacts(
          "source_unavailable",
        ),
      submissions: submissions.value,
    });
  }

  async #load<T>(
    sourceUrl: string,
    signal: AbortSignal,
    normalize: (value: unknown) => T,
    capture: () => string,
  ): Promise<SourceResult<T>> {
    let metadata: Pick<
      PersonalSecInterimSourceDto,
      "fetchedAt" | "sha256" | "bytes"
    > = { fetchedAt: null, sha256: null, bytes: null };
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
      metadata = {
        fetchedAt: capture(),
        sha256: sha256(bytes),
        bytes: bytes.byteLength,
      };
      const value = normalize(
        parsePersonalSecSourceJson(decodePersonalSecSourceUtf8(bytes)),
      );
      return Object.freeze({
        source: Object.freeze({ status: "available", sourceUrl, ...metadata }),
        value,
      });
    } catch (error) {
      if (signal.aborted || this.#closed) fail("aborted");
      if (error instanceof PersonalSecInterimEvidenceProviderError) throw error;
      if (error instanceof PersonalSecRequestSchedulerError) fail(error.code);
      return Object.freeze({
        source: Object.freeze({
          status:
            error instanceof PersonalSecSourceError
              ? error.status
              : "upstream_unavailable",
          sourceUrl,
          ...metadata,
        }),
      });
    }
  }
}

interface SourceClock {
  readonly cutoffAt: string;
  readonly capture: () => string;
}
function sourceCapture(readClock: () => Date): SourceClock {
  let lastTime = -Infinity;
  const capture = (): string => {
    const now = readClock();
    if (!isPersonalSecClock(now) || now.getTime() < lastTime)
      fail("invalid_request");
    lastTime = now.getTime();
    return now.toISOString();
  };
  return { cutoffAt: capture(), capture };
}
function assertProviderFunctionType(type: string): void {
  if (type !== "function") throw new TypeError(MESSAGE);
}
function assertCik(cik: string): void {
  if (typeof cik !== "string") fail("invalid_request");
  if (!/^\d{10}$/u.test(cik)) fail("invalid_request");
  if (/^0+$/u.test(cik)) fail("invalid_request");
}
type SubmissionsResult = SourceResult<
  ReturnType<typeof normalizePersonalSecSubmissions>
>;
function capturedFilings(
  submissions: SubmissionsResult,
): readonly PersonalSecInterimFilingDto[] {
  if (submissions.value === undefined) return [];
  return [...submissions.value.filings].map(([accessionNumber, filing]) => {
    if (filing.form === null) fail("invalid_request");
    return {
      accessionNumber,
      form: filing.form,
      filedDate: filing.filedDate,
      reportDate: filing.reportDate,
      acceptedAt: filing.acceptedAt,
    };
  });
}
function capturedTarget(
  submissions: SubmissionsResult,
  filings: readonly PersonalSecInterimFilingDto[],
  cutoffAt: string,
): PersonalSecInterimCanonicalEvidenceDto["target"] {
  if (submissions.value === undefined)
    return Object.freeze({
      status: "unresolved",
      reason: "submissions_unavailable",
    } as const);
  return selectPersonalSecInterimTarget(
    filings,
    cutoffAt,
    submissions.source.fetchedAt!,
  );
}
function capturedScan(
  submissions: SubmissionsResult,
  filings: readonly PersonalSecInterimFilingDto[],
): PersonalSecInterimCanonicalEvidenceDto["targetScan"] {
  if (submissions.value === undefined) return null;
  return Object.freeze({
    currentFilings: filings.length,
    interimFilings: filings.filter(
      (filing) => filing.form === "10-Q" || filing.form === "10-Q/A",
    ).length,
    olderHistoryAvailable: submissions.value.olderHistoryAvailable,
  });
}

function targetAccession(
  target: PersonalSecInterimCanonicalEvidenceDto["target"],
): string | null {
  return target.status === "target" ? target.accessionNumber : null;
}
function sha256(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function fail(code: PersonalSecInterimEvidenceProviderErrorCode): never {
  throw new PersonalSecInterimEvidenceProviderError(code);
}
