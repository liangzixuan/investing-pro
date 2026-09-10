import type {
  PersonalSecIssuerFilingsDto,
  PersonalSecRecentFilingDto,
} from "@research-cockpit/contracts";

import {
  sharedPersonalSecRequestScheduler,
  type PersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";

export type PersonalSecFilingsProviderErrorCode =
  "not_configured" | "invalid_request" | "busy" | "aborted";

export interface PersonalSecFilingsProvider {
  status(): Readonly<{ configured: boolean }>;
  loadFilings(
    ciks: readonly string[],
    fromDate: string,
    throughDate: string,
    signal?: AbortSignal,
  ): Promise<readonly PersonalSecIssuerFilingsDto[]>;
  close(): void;
}

export interface SecPersonalFilingsProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  readonly scheduler?: PersonalSecRequestScheduler;
}

const MESSAGE = "Personal watchlist filing data is unavailable.";
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_RECENT_ROWS = 10_000;
const MAX_RETURNED_FILINGS = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const REQUEST_INTERVAL_MS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

export class PersonalSecFilingsProviderError extends Error {
  public constructor(
    public readonly code: PersonalSecFilingsProviderErrorCode,
  ) {
    super(MESSAGE);
    this.name = "PersonalSecFilingsProviderError";
  }
}

class IssuerResponseError extends Error {
  public constructor(
    public readonly status: PersonalSecIssuerFilingsDto["status"],
  ) {
    super(MESSAGE);
  }
}

class SourceNumber {
  public constructor(public readonly lexeme: string) {}
}

export function createSecPersonalFilingsProvider(
  userAgent?: string,
  dependencies: SecPersonalFilingsProviderDependencies = {},
): PersonalSecFilingsProvider {
  return new SecPersonalFilingsProvider(userAgent, dependencies);
}

class SecPersonalFilingsProvider implements PersonalSecFilingsProvider {
  readonly #userAgent: string | undefined;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #scheduler: PersonalSecRequestScheduler;
  #closed = false;
  #active: AbortController | undefined;
  #requestHasRun = false;

  public constructor(
    userAgent: string | undefined,
    dependencies: SecPersonalFilingsProviderDependencies,
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
    ) {
      throw new TypeError(MESSAGE);
    }
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

  public async loadFilings(
    ciks: readonly string[],
    fromDate: string,
    throughDate: string,
    signal?: AbortSignal,
  ): Promise<readonly PersonalSecIssuerFilingsDto[]> {
    if (this.#closed || signal?.aborted === true) fail("aborted");
    if (this.#userAgent === undefined) fail("not_configured");
    const now = this.#now();
    if (
      !validClock(now) ||
      !isArray(ciks) ||
      ciks.length < 1 ||
      ciks.length > 20 ||
      [...ciks].some(
        (cik) =>
          typeof cik !== "string" ||
          !/^\d{10}$/u.test(cik) ||
          Number(cik) === 0,
      ) ||
      new Set(ciks).size !== ciks.length ||
      !validDate(fromDate) ||
      !validDate(throughDate) ||
      throughDate < fromDate ||
      throughDate > now.toISOString().slice(0, 10) ||
      (Date.parse(throughDate) - Date.parse(fromDate)) / DAY_MS + 1 > 90
    ) {
      fail("invalid_request");
    }
    if (this.#active !== undefined) fail("busy");
    const requestedCiks = [...ciks];
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    this.#active = controller;
    try {
      const issuers: PersonalSecIssuerFilingsDto[] = [];
      for (const cik of requestedCiks) {
        if (controller.signal.aborted) fail("aborted");
        // This adapter remains below four requests/second even across batches.
        // A shared scheduler also bounds aggregate SEC traffic across providers.
        if (this.#requestHasRun)
          await delay(REQUEST_INTERVAL_MS, controller.signal);
        try {
          await this.#scheduler.wait(controller.signal);
        } catch {
          if (this.#closed || controller.signal.aborted) fail("aborted");
          fail("busy");
        }
        if (this.#closed || controller.signal.aborted) fail("aborted");
        this.#requestHasRun = true;
        issuers.push(
          await this.#loadIssuer(cik, fromDate, throughDate, controller.signal),
        );
      }
      if (this.#closed || controller.signal.aborted) fail("aborted");
      return Object.freeze(issuers);
    } finally {
      signal?.removeEventListener("abort", onAbort);
      if (this.#active === controller) this.#active = undefined;
    }
  }

  async #loadIssuer(
    cik: string,
    fromDate: string,
    throughDate: string,
    signal: AbortSignal,
  ): Promise<PersonalSecIssuerFilingsDto> {
    // Only the documented submissions endpoint is fetched. Files, primary
    // documents, and arbitrary URLs returned by SEC are never followed.
    // https://www.sec.gov/search-filings/edgar-application-programming-interfaces
    const sourceUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let result: Omit<
      PersonalSecIssuerFilingsDto,
      "cik" | "sourceUrl" | "fetchedAt"
    >;
    try {
      const response = await withAbort(
        this.#fetch(sourceUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": this.#userAgent!,
          },
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
        (response.url !== "" && response.url !== sourceUrl)
      ) {
        if (response instanceof Response)
          void response.body?.cancel().catch(() => undefined);
        throw new IssuerResponseError("invalid_response");
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        throw new IssuerResponseError(
          response.status === 404
            ? "not_covered"
            : response.status === 429
              ? "rate_limited"
              : "upstream_unavailable",
        );
      }
      const text = await readBoundedText(response, controller.signal);
      result = normalizeIssuer(parseJson(text), cik, fromDate, throughDate);
      if (controller.signal.aborted)
        throw new IssuerResponseError("upstream_unavailable");
    } catch (error) {
      if (this.#closed || signal.aborted) fail("aborted");
      result = {
        status:
          error instanceof IssuerResponseError
            ? error.status
            : "upstream_unavailable",
        olderHistoryAvailable: false,
        matchingFilings: 0,
        truncated: false,
        filings: Object.freeze([]),
      };
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
    const fetchedAt = this.#now();
    if (!validClock(fetchedAt)) fail("invalid_request");
    return Object.freeze({
      cik,
      sourceUrl,
      fetchedAt: fetchedAt.toISOString(),
      ...result,
    });
  }
}

function normalizeIssuer(
  value: unknown,
  cik: string,
  fromDate: string,
  throughDate: string,
): Omit<PersonalSecIssuerFilingsDto, "cik" | "sourceUrl" | "fetchedAt"> {
  if (
    !isRecord(value) ||
    normalizeCik(value.cik) !== cik ||
    !isRecord(value.filings) ||
    !isRecord(value.filings.recent) ||
    (value.filings.files !== undefined && !Array.isArray(value.filings.files))
  )
    throw new IssuerResponseError("invalid_response");
  const recent = value.filings.recent;
  const accessions = recent.accessionNumber;
  const forms = recent.form;
  const filingDates = recent.filingDate;
  const reportDates = recent.reportDate;
  if (
    !Array.isArray(accessions) ||
    accessions.length > MAX_RECENT_ROWS ||
    !Array.isArray(forms) ||
    forms.length !== accessions.length ||
    !Array.isArray(filingDates) ||
    filingDates.length !== accessions.length ||
    !Array.isArray(reportDates) ||
    reportDates.length !== accessions.length
  )
    throw new IssuerResponseError("invalid_response");
  const normalized = new Map<string, PersonalSecRecentFilingDto>();
  for (let index = 0; index < accessions.length; index += 1) {
    const accessionNumber: unknown = accessions[index];
    const form: unknown = forms[index];
    const filingDate: unknown = filingDates[index];
    const rawReportDate: unknown = reportDates[index];
    const reportDate =
      rawReportDate === "" || rawReportDate === null ? null : rawReportDate;
    if (
      typeof accessionNumber !== "string" ||
      !/^\d{10}-\d{2}-\d{6}$/u.test(accessionNumber) ||
      typeof form !== "string" ||
      form !== form.trim() ||
      !/^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u.test(form) ||
      !validDate(filingDate) ||
      (reportDate !== null && !validDate(reportDate))
    )
      throw new IssuerResponseError("invalid_response");
    const previous = normalized.get(accessionNumber);
    if (previous !== undefined) {
      if (
        previous.form !== form ||
        previous.filingDate !== filingDate ||
        previous.reportDate !== reportDate
      ) {
        throw new IssuerResponseError("invalid_response");
      }
      continue;
    }
    normalized.set(
      accessionNumber,
      Object.freeze({
        cik,
        accessionNumber,
        form,
        filingDate,
        reportDate,
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${accessionNumber}-index.htm`,
      }),
    );
  }
  const matching = [...normalized.values()]
    .filter(
      (filing) =>
        filing.filingDate >= fromDate && filing.filingDate <= throughDate,
    )
    .sort((left, right) =>
      left.filingDate === right.filingDate
        ? left.accessionNumber.localeCompare(right.accessionNumber)
        : right.filingDate.localeCompare(left.filingDate),
    );
  return {
    status: "available",
    olderHistoryAvailable:
      Array.isArray(value.filings.files) && value.filings.files.length > 0,
    matchingFilings: matching.length,
    truncated: matching.length > MAX_RETURNED_FILINGS,
    filings: Object.freeze(matching.slice(0, MAX_RETURNED_FILINGS)),
  };
}

function normalizeCik(value: unknown): string | undefined {
  const text = value instanceof SourceNumber ? value.lexeme : value;
  return typeof text === "string" &&
    /^\d{1,10}$/u.test(text) &&
    Number(text) !== 0
    ? text.padStart(10, "0")
    : undefined;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): boolean {
  return Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    // Preserve numeric lexemes so a fractional or unsafe source CIK cannot
    // round into the requested identity. Keep numbers distinct from strings so
    // numeric form labels or dates cannot become accepted text accidentally.
    return JSON.parse(
      text,
      (_key: string, value: unknown, context?: { source?: string }) =>
        typeof value === "number"
          ? new SourceNumber(context?.source ?? "")
          : value,
    );
  } catch {
    throw new IssuerResponseError("invalid_response");
  }
}

function fail(code: PersonalSecFilingsProviderErrorCode): never {
  throw new PersonalSecFilingsProviderError(code);
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
        onAbort = () => reject(new PersonalSecFilingsProviderError("aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort !== undefined) signal.removeEventListener("abort", onAbort);
  }
}

async function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await withAbort(
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, milliseconds);
      }),
      signal,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedText(
  response: Response,
  signal: AbortSignal,
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(declaredLength) ||
      !Number.isSafeInteger(Number(declaredLength)) ||
      Number(declaredLength) > MAX_RESPONSE_BYTES)
  ) {
    void response.body?.cancel().catch(() => undefined);
    throw new IssuerResponseError("invalid_response");
  }
  if (response.body === null) throw new IssuerResponseError("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await withAbort(reader.read(), signal);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array))
        throw new IssuerResponseError("invalid_response");
      size += result.value.byteLength;
      if (size > MAX_RESPONSE_BYTES)
        throw new IssuerResponseError("invalid_response");
      chunks.push(result.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (size === 0) throw new IssuerResponseError("invalid_response");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new IssuerResponseError("invalid_response");
  }
}
