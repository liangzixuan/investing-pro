import { createHash } from "node:crypto";
import {
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS as LIMITS,
  type PersonalSecInterimCanonicalEvidenceDto,
  type PersonalSecInterimSourceDto,
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
  ): Promise<PersonalSecInterimCanonicalEvidenceDto> {
    if (this.#closed || signal?.aborted === true) fail("aborted");
    if (this.#userAgent === undefined) fail("not_configured");
    if (typeof cik !== "string" || !/^\d{10}$/u.test(cik) || /^0+$/u.test(cik))
      fail("invalid_request");
    if (this.#active !== undefined) fail("busy");
    let lastTime = -Infinity;
    const capture = (): string => {
      const now = this.#now();
      if (!isPersonalSecClock(now) || now.getTime() < lastTime)
        fail("invalid_request");
      lastTime = now.getTime();
      return now.toISOString();
    };
    const cutoffAt = capture();
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    this.#active = controller;
    try {
      // Select solely from the bounded current Submissions packet before facts.
      // Source-provided document/history URLs are never fetched.
      const submissions = await this.#load(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        controller.signal,
        (value) => normalizePersonalSecSubmissions(value, cik),
        capture,
      );
      const filings =
        submissions.value === undefined
          ? []
          : [...submissions.value.filings].map(([accessionNumber, filing]) => {
              if (filing.form === null) fail("invalid_request");
              return {
                accessionNumber,
                form: filing.form,
                filedDate: filing.filedDate,
                reportDate: filing.reportDate,
                acceptedAt: filing.acceptedAt,
              };
            });
      const target =
        submissions.value === undefined
          ? Object.freeze({
              status: "unresolved",
              reason: "submissions_unavailable",
            } as const)
          : selectPersonalSecInterimTarget(
              filings,
              cutoffAt,
              submissions.source.fetchedAt!,
            );
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
      const targetScan =
        submissions.value === undefined
          ? null
          : Object.freeze({
              currentFilings: filings.length,
              interimFilings: filings.filter(
                (filing) => filing.form === "10-Q" || filing.form === "10-Q/A",
              ).length,
              olderHistoryAvailable: submissions.value.olderHistoryAvailable,
            });
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
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (this.#active === controller) this.#active = undefined;
    }
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
