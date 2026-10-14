import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS as LIMITS,
  type PersonalSecAnnualCashMetricEvidenceDto,
  type PersonalSecAnnualLiquidityMetricEvidenceDto,
  type PersonalSecAnnualEvidenceDto,
  type PersonalSecAnnualMetricCountsDto,
  type PersonalSecAnnualResolutionInput,
  type PersonalSecAnnualSourceDto,
  type PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualRefusalReason,
  resolvePersonalSecAnnualEvidence,
  resolvePersonalSecAnnualCashGeneration,
  resolvePersonalSecAnnualLiquidity,
  selectPersonalSecAnnualTarget,
  serializePersonalSecAnnualGeneration,
} from "@research-cockpit/personal-financial-analytics";

import {
  normalizePersonalSecAnnualCompanyFacts,
  unavailablePersonalSecAnnualCashMetric,
  unavailablePersonalSecAnnualLiquidityMetric,
  type PersonalSecAnnualCashSourceMetric,
  type PersonalSecAnnualLiquiditySourceMetric,
} from "./personal-sec-annual-company-facts";
import {
  decodePersonalSecSourceUtf8,
  fetchPersonalSecSourceBytes,
  isPersonalSecClock,
  isPersonalSecUserAgent,
  type normalizePersonalSecCompanyFacts,
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

export type PersonalSecAnnualEvidenceProviderErrorCode =
  "not_configured" | "invalid_request" | "busy" | "aborted";

export interface PersonalSecAnnualEvidenceProvider {
  status(): Readonly<{ configured: boolean }>;
  loadEvidence(
    cik: string,
    signal?: AbortSignal,
  ): Promise<PersonalSecAnnualEvidenceDto>;
  close(): void;
}

export interface SecPersonalAnnualEvidenceProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  readonly scheduler?: PersonalSecRequestScheduler;
}

const MESSAGE = "Personal SEC annual evidence is unavailable.";
type RawObservation = ReturnType<
  typeof normalizePersonalSecCompanyFacts
>["observations"][number];
type Submissions = ReturnType<typeof normalizePersonalSecSubmissions>;
type SourceResult<T> = Readonly<{
  source: PersonalSecAnnualSourceDto;
  value?: T;
}>;

export class PersonalSecAnnualEvidenceProviderError extends Error {
  public constructor(
    public readonly code: PersonalSecAnnualEvidenceProviderErrorCode,
  ) {
    super(MESSAGE);
    this.name = "PersonalSecAnnualEvidenceProviderError";
  }
}

export function createSecPersonalAnnualEvidenceProvider(
  userAgent?: string,
  dependencies: SecPersonalAnnualEvidenceProviderDependencies = {},
): PersonalSecAnnualEvidenceProvider {
  return new SecPersonalAnnualEvidenceProvider(userAgent, dependencies);
}

class SecPersonalAnnualEvidenceProvider implements PersonalSecAnnualEvidenceProvider {
  readonly #userAgent: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #scheduler: PersonalSecRequestScheduler;
  #active: AbortController | undefined;
  #closed = false;

  public constructor(
    userAgent: string | undefined,
    dependencies: SecPersonalAnnualEvidenceProviderDependencies,
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
  ): Promise<PersonalSecAnnualEvidenceDto> {
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
              return { accessionNumber, ...filing, form: filing.form };
            });
      const target =
        submissions.value === undefined
          ? Object.freeze({
              status: "unresolved",
              reason: "submissions_unavailable",
            } as const)
          : selectPersonalSecAnnualTarget(
              filings,
              cutoffAt,
              submissions.source.fetchedAt!,
            );
      const facts = await this.#load(
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
        controller.signal,
        (value) =>
          normalizePersonalSecAnnualCompanyFacts(
            value,
            cik,
            targetAccession(target),
          ),
        capture,
      );
      if (controller.signal.aborted || this.#closed) fail("aborted");
      const completedAt = capture();
      const income = facts.value?.income;
      const incomeScanStatus =
        facts.value?.incomeScanStatus ?? "source_unavailable";
      const all = income?.observations ?? [];
      const selected =
        target.status === "target"
          ? all.filter((row) => row.accessionNumber === target.accessionNumber)
          : null;
      const selectedCounts = selected === null ? null : counts(selected);
      const targetScan =
        submissions.value === undefined
          ? null
          : Object.freeze({
              currentFilings: filings.length,
              annualFilings: filings.filter(
                (filing) => filing.form === "10-K" || filing.form === "20-F",
              ).length,
              olderHistoryAvailable: submissions.value.olderHistoryAvailable,
            });
      const generation = Object.freeze({
        definitionVersion: PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
        cutoffAt,
        completedAt,
        sources: Object.freeze({
          companyFacts: facts.source,
          submissions: submissions.source,
        }),
      });
      const history = retainPersonalSecQuarterlyObservations(all);
      const boundGeneration = Object.freeze({
        ...generation,
        sha256: sha256(
          serializePersonalSecAnnualGeneration({
            cik,
            generation,
            target,
            targetScan,
          }),
        ),
      });
      const preliminaryCoverage =
        income === undefined
          ? null
          : Object.freeze({
              full: Object.freeze({
                ...counts(all),
                inspectedRows: income.inspectedRows,
                invalidRows: income.invalidRows,
                duplicateRows: income.duplicateRows,
                uniqueObservations: all.length,
                conceptsWithoutUsd: income.conceptsWithoutUsd,
              }),
              selected: selectedCounts,
              otherAccessions:
                selected === null
                  ? null
                  : counts(
                      all.filter(
                        (row) =>
                          row.accessionNumber !== targetAccession(target),
                      ),
                    ),
              returned: counts([]),
              omittedSelected: selectedCounts,
              history: Object.freeze({
                returned: counts(history),
                truncated: history.length < all.length,
              }),
            });
      const reason = getPersonalSecAnnualRefusalReason({
        generation: boundGeneration,
        target,
        incomeScanStatus,
        coverage: preliminaryCoverage,
      });
      const observations = Object.freeze(
        reason === null
          ? selected!.map((row): PersonalSecQuarterlyObservationDto =>
              Object.freeze({
                ...row,
                filing: joinFiling(row, submissions.value),
              }),
            )
          : [],
      );
      const returned = counts(observations);
      const input: PersonalSecAnnualResolutionInput = Object.freeze({
        cik,
        generation: boundGeneration,
        target,
        targetScan,
        incomeScanStatus,
        completeness:
          reason === null
            ? Object.freeze({ status: "complete", reason: null })
            : Object.freeze({ status: "refused", reason }),
        coverage:
          preliminaryCoverage === null
            ? null
            : Object.freeze({
                ...preliminaryCoverage,
                returned,
                omittedSelected:
                  selectedCounts === null
                    ? null
                    : Object.freeze({
                        observations:
                          selectedCounts.observations - returned.observations,
                        revenue: selectedCounts.revenue - returned.revenue,
                        netIncome:
                          selectedCounts.netIncome - returned.netIncome,
                      }),
              }),
        observations,
      });
      const cashGeneration = Object.freeze({
        operatingCashFlow: joinCashMetric(
          facts.value?.operatingCashFlow,
          submissions.value,
        ),
        ppePurchases: joinCashMetric(
          facts.value?.ppePurchases,
          submissions.value,
        ),
      });
      const liquidity = Object.freeze({
        currentAssets: joinLiquidityMetric(
          facts.value?.currentAssets,
          submissions.value,
        ),
        currentLiabilities: joinLiquidityMetric(
          facts.value?.currentLiabilities,
          submissions.value,
        ),
      });
      return Object.freeze({
        ...input,
        resolution: resolvePersonalSecAnnualEvidence(input),
        cashGeneration: Object.freeze({
          ...cashGeneration,
          resolution: resolvePersonalSecAnnualCashGeneration({
            cik,
            generation: boundGeneration,
            target,
            cashGeneration,
          }),
        }),
        liquidity: Object.freeze({
          ...liquidity,
          resolution: resolvePersonalSecAnnualLiquidity({
            cik,
            generation: boundGeneration,
            target,
            liquidity,
          }),
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
    capture: () => string,
  ): Promise<SourceResult<T>> {
    let metadata: Pick<
      PersonalSecAnnualSourceDto,
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
      if (error instanceof PersonalSecAnnualEvidenceProviderError) throw error;
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
  target: PersonalSecAnnualResolutionInput["target"],
): string | null {
  return target.status === "target" ? target.accessionNumber : null;
}

function counts(
  rows: readonly Pick<RawObservation, "metric">[],
): PersonalSecAnnualMetricCountsDto {
  const revenue = rows.filter((row) => row.metric === "revenue").length;
  return Object.freeze({
    observations: rows.length,
    revenue,
    netIncome: rows.length - revenue,
  });
}

function joinFiling(
  row: Pick<RawObservation, "accessionNumber" | "form" | "filedDate">,
  submissions: Submissions | undefined,
): PersonalSecQuarterlyObservationDto["filing"] {
  const filing = submissions?.filings.get(row.accessionNumber);
  return filing === undefined
    ? Object.freeze({
        status:
          submissions === undefined
            ? "submissions_unavailable"
            : "not_in_current_submissions",
        form: null,
        filedDate: null,
        reportDate: null,
        acceptedAt: null,
        sourceUrl: null,
      })
    : Object.freeze({
        ...filing,
        status:
          filing.form === row.form && filing.filedDate === row.filedDate
            ? "matched"
            : "metadata_conflict",
      });
}

function joinCashMetric(
  source: PersonalSecAnnualCashSourceMetric | undefined,
  submissions: Submissions | undefined,
): PersonalSecAnnualCashMetricEvidenceDto {
  const metric =
    source ?? unavailablePersonalSecAnnualCashMetric("source_unavailable");
  return Object.freeze({
    scan: metric.scan,
    observations: Object.freeze(
      metric.observations.map((row) =>
        Object.freeze({
          ...row,
          filing: joinFiling(row, submissions),
        }),
      ),
    ),
  });
}

function joinLiquidityMetric(
  source: PersonalSecAnnualLiquiditySourceMetric | undefined,
  submissions: Submissions | undefined,
): PersonalSecAnnualLiquidityMetricEvidenceDto {
  const metric =
    source ?? unavailablePersonalSecAnnualLiquidityMetric("source_unavailable");
  return Object.freeze({
    scan: metric.scan,
    observations: Object.freeze(
      metric.observations.map((row) =>
        Object.freeze({
          ...row,
          filing: joinFiling(row, submissions),
        }),
      ),
    ),
  });
}

function sha256(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function fail(code: PersonalSecAnnualEvidenceProviderErrorCode): never {
  throw new PersonalSecAnnualEvidenceProviderError(code);
}
