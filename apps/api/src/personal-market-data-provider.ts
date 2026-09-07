import type {
  PersonalMarketDataDailyBarDto,
  PersonalMarketDataIdentityDto,
  PersonalMarketDataProviderDto,
  PersonalMarketDataQuoteDto,
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";

export const PERSONAL_MARKET_DATA_TIINGO_TOKEN_ENVIRONMENT_KEY =
  "PERSONAL_MARKET_DATA_TIINGO_TOKEN" as const;

export type PersonalMarketDataProviderErrorCode =
  | "not_configured"
  | "credentials_invalid"
  | "rate_limited"
  | "not_covered"
  | "upstream_unavailable"
  | "invalid_response"
  | "aborted";

export interface PersonalMarketDataProvider {
  close(): void;
  getStatus(): PersonalMarketDataStatusDto;
  loadOverview(
    identity: PersonalMarketDataIdentityDto,
    range: PersonalMarketDataRangeDto,
    signal?: AbortSignal,
  ): Promise<PersonalMarketOverviewDto>;
  status(): PersonalMarketDataStatusDto;
}

export interface TiingoPersonalMarketDataProviderDependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
}

const ERROR_MESSAGE = "Personal market data is unavailable.";
const TIINGO_ORIGIN = "https://api.tiingo.com";
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_EOD_BARS = 4_096;
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const FRESHNESS_WINDOW_MILLISECONDS = 36 * 60 * 60 * 1_000;
const MAX_FUTURE_CLOCK_SKEW_MILLISECONDS = 5 * 60 * 1_000;
const PROVIDER_SYMBOL = /^[A-Z0-9][A-Z0-9-]{0,31}$/u;
const SECURITY_SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,31}$/u;
const EXCHANGE_MIC = /^[A-Z0-9]{4}$/u;
const PLAIN_TEXT = /^[^\p{Cc}\p{Cf}\p{Cs}]+$/u;
const PROVIDER_ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/u;

const TIINGO_PROVIDER = Object.freeze({
  attribution: "Tiingo",
  export: "prohibited",
  historyFeed: "tiingo_eod_composite",
  id: "tiingo",
  name: "Tiingo",
  persistence: "none",
  quoteFeed: "tiingo_iex_derived_reference",
  redistribution: "prohibited",
  retention: "active_owner_session_memory_only",
}) satisfies PersonalMarketDataProviderDto;

interface NormalizedBar {
  readonly dto: PersonalMarketDataDailyBarDto;
  readonly rawClose: number;
  readonly sourceTime: string;
  readonly splitFactor: number;
}

interface RequestContext {
  readonly controller: AbortController;
  readonly externalSignal: AbortSignal | undefined;
  readonly timedOut: () => boolean;
}

export class PersonalMarketDataProviderError extends Error {
  public readonly code: PersonalMarketDataProviderErrorCode;

  public constructor(code: PersonalMarketDataProviderErrorCode) {
    super(ERROR_MESSAGE);
    this.code = code;
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "PersonalMarketDataProviderError",
    });
  }
}

export function createTiingoPersonalMarketDataProvider(
  token?: string,
  dependencies: TiingoPersonalMarketDataProviderDependencies = {},
): PersonalMarketDataProvider {
  const fetchImplementation = dependencies.fetch ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());
  if (typeof fetchImplementation !== "function" || typeof now !== "function") {
    throw new TypeError(ERROR_MESSAGE);
  }
  return new TiingoPersonalMarketDataProvider(token, fetchImplementation, now);
}

class TiingoPersonalMarketDataProvider implements PersonalMarketDataProvider {
  readonly #activeRequests = new Set<AbortController>();
  readonly #fetch: typeof globalThis.fetch;
  readonly #invalidCredential: boolean;
  readonly #now: () => Date;
  readonly #tokenBytes: Uint8Array | undefined;
  #closed = false;

  public constructor(
    token: string | undefined,
    fetchImplementation: typeof globalThis.fetch,
    now: () => Date,
  ) {
    this.#fetch = fetchImplementation;
    this.#now = now;
    const tokenState = prepareToken(token);
    this.#tokenBytes = tokenState.bytes;
    this.#invalidCredential = tokenState.invalid;
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#tokenBytes?.fill(0);
    for (const controller of this.#activeRequests) controller.abort();
    this.#activeRequests.clear();
  }

  public getStatus(): PersonalMarketDataStatusDto {
    return this.status();
  }

  public status(): PersonalMarketDataStatusDto {
    return Object.freeze({
      profile: "personal_single_user_local_market_data",
      provider: TIINGO_PROVIDER,
      schemaVersion: "1.0.0",
      status:
        !this.#closed &&
        (this.#tokenBytes !== undefined || this.#invalidCredential)
          ? "configured"
          : "not_configured",
    });
  }

  public async loadOverview(
    identity: PersonalMarketDataIdentityDto,
    range: PersonalMarketDataRangeDto,
    signal?: AbortSignal,
  ): Promise<PersonalMarketOverviewDto> {
    if (this.#closed || this.#tokenBytes === undefined) {
      fail(this.#invalidCredential ? "credentials_invalid" : "not_configured");
    }
    if (this.#invalidCredential) fail("credentials_invalid");
    if (signal?.aborted === true) fail("aborted");

    const security = normalizeIdentity(identity);
    const providerSymbol = security.symbol.replaceAll(".", "-");
    if (!PROVIDER_SYMBOL.test(providerSymbol)) fail("not_covered");
    const ingestedAtDate = this.#readClock();
    const ingestedAt = ingestedAtDate.toISOString();
    const dates = rangeDates(range, ingestedAtDate);
    const quoteUrl = tiingoQuoteUrl(providerSymbol);
    const historyUrl = tiingoHistoryUrl(
      providerSymbol,
      dates.startDate,
      dates.endDate,
    );
    const context = this.#startRequest(signal);

    try {
      const authorization = `Token ${new TextDecoder().decode(
        this.#tokenBytes,
      )}`;
      const [quoteValue, historyValue] = await Promise.all([
        this.#requestJson(quoteUrl, authorization, context),
        this.#requestJson(historyUrl, authorization, context),
      ]);
      if (this.#closed || context.externalSignal?.aborted === true) {
        fail("aborted");
      }
      const bars = normalizeHistory(
        historyValue,
        dates.startDate,
        dates.endDate,
      );
      const quote = normalizeQuote(
        quoteValue,
        providerSymbol,
        bars,
        ingestedAtDate,
        ingestedAt,
      );
      return Object.freeze({
        history: Object.freeze({
          bars: Object.freeze(bars.map(({ dto }) => dto)),
          endDate: dates.endDate,
          range,
          startDate: dates.startDate,
        }),
        profile: "personal_single_user_local_market_data",
        provider: TIINGO_PROVIDER,
        quote,
        schemaVersion: "1.0.0",
        security,
        status: "available",
      });
    } catch (error) {
      if (
        this.#closed ||
        context.externalSignal?.aborted === true ||
        (context.controller.signal.aborted && !context.timedOut())
      ) {
        fail("aborted");
      }
      if (error instanceof PersonalMarketDataProviderError) throw error;
      fail("upstream_unavailable");
    } finally {
      this.#finishRequest(context.controller);
    }
  }

  #readClock(): Date {
    try {
      const value = this.#now();
      if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
        fail("upstream_unavailable");
      }
      return new Date(value.getTime());
    } catch (error) {
      if (error instanceof PersonalMarketDataProviderError) throw error;
      fail("upstream_unavailable");
    }
  }

  #startRequest(externalSignal: AbortSignal | undefined): RequestContext {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = (): void => controller.abort();
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MILLISECONDS);
    timeout.unref?.();
    this.#activeRequests.add(controller);
    requestCleanups.set(controller, () => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    });
    return Object.freeze({
      controller,
      externalSignal,
      timedOut: () => timedOut,
    });
  }

  #finishRequest(controller: AbortController): void {
    requestCleanups.get(controller)?.();
    requestCleanups.delete(controller);
    this.#activeRequests.delete(controller);
    if (!controller.signal.aborted) controller.abort();
  }

  async #requestJson(
    url: URL,
    authorization: string,
    context: RequestContext,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(url.href, {
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          Authorization: authorization,
        },
        method: "GET",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: context.controller.signal,
      });
    } catch {
      if (
        this.#closed ||
        context.externalSignal?.aborted === true ||
        (context.controller.signal.aborted && !context.timedOut())
      ) {
        fail("aborted");
      }
      fail("upstream_unavailable");
    }
    if (
      response === undefined ||
      typeof response.status !== "number" ||
      typeof response.ok !== "boolean"
    ) {
      fail("invalid_response");
    }
    if (!response.ok) fail(httpErrorCode(response.status));
    try {
      return await readBoundedJson(response);
    } catch (error) {
      if (
        this.#closed ||
        context.externalSignal?.aborted === true ||
        (context.controller.signal.aborted && !context.timedOut())
      ) {
        fail("aborted");
      }
      if (error instanceof PersonalMarketDataProviderError) throw error;
      fail("invalid_response");
    }
  }
}

const requestCleanups = new WeakMap<AbortController, () => void>();

function prepareToken(token: string | undefined): Readonly<{
  bytes: Uint8Array | undefined;
  invalid: boolean;
}> {
  if (token === undefined || token.length === 0) {
    return Object.freeze({ bytes: undefined, invalid: false });
  }
  if (
    token !== token.trim() ||
    token.length > 512 ||
    !/^[\x21-\x7E]+$/u.test(token)
  ) {
    return Object.freeze({ bytes: undefined, invalid: true });
  }
  return Object.freeze({
    bytes: new TextEncoder().encode(token),
    invalid: false,
  });
}

function normalizeIdentity(
  value: PersonalMarketDataIdentityDto,
): PersonalMarketDataIdentityDto {
  if (
    !isRecord(value) ||
    value.country !== "US" ||
    !validPlainText(value.issuerName, 1, 512) ||
    !validPlainText(value.securityName, 1, 512) ||
    !validPlainText(value.listingId, 1, 256) ||
    typeof value.exchangeMic !== "string" ||
    !EXCHANGE_MIC.test(value.exchangeMic) ||
    typeof value.symbol !== "string" ||
    !SECURITY_SYMBOL.test(value.symbol)
  ) {
    fail("not_covered");
  }
  return Object.freeze({
    country: "US",
    exchangeMic: value.exchangeMic,
    issuerName: value.issuerName,
    listingId: value.listingId,
    securityName: value.securityName,
    symbol: value.symbol,
  });
}

function validPlainText(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimumLength &&
    value.length <= maximumLength &&
    value === value.trim() &&
    value === value.normalize("NFC") &&
    PLAIN_TEXT.test(value)
  );
}

function tiingoQuoteUrl(providerSymbol: string): URL {
  const url = new URL(
    `/iex/${encodeURIComponent(providerSymbol)}`,
    TIINGO_ORIGIN,
  );
  assertAllowedUrl(url, `/iex/${providerSymbol}`, false);
  return url;
}

function tiingoHistoryUrl(
  providerSymbol: string,
  startDate: string,
  endDate: string,
): URL {
  const url = new URL(
    `/tiingo/daily/${encodeURIComponent(providerSymbol)}/prices`,
    TIINGO_ORIGIN,
  );
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  assertAllowedUrl(url, `/tiingo/daily/${providerSymbol}/prices`, true);
  if (
    url.searchParams.size !== 2 ||
    url.searchParams.get("startDate") !== startDate ||
    url.searchParams.get("endDate") !== endDate
  ) {
    fail("not_covered");
  }
  return url;
}

function assertAllowedUrl(
  url: URL,
  expectedPath: string,
  allowDateQuery: boolean,
): void {
  if (
    url.origin !== TIINGO_ORIGIN ||
    url.protocol !== "https:" ||
    url.host !== "api.tiingo.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== expectedPath ||
    url.hash !== "" ||
    (!allowDateQuery && url.search !== "")
  ) {
    fail("not_covered");
  }
}

function rangeDates(
  range: PersonalMarketDataRangeDto,
  now: Date,
): Readonly<{ endDate: string; startDate: string }> {
  const endDate = formatUtcDate(now);
  let start: Date;
  switch (range) {
    case "1m":
      start = subtractCalendar(now, 0, 1);
      break;
    case "3m":
      start = subtractCalendar(now, 0, 3);
      break;
    case "ytd":
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      break;
    case "1y":
      start = subtractCalendar(now, 1, 0);
      break;
    case "5y":
      start = subtractCalendar(now, 5, 0);
      break;
    case "10y":
      start = subtractCalendar(now, 10, 0);
      break;
    default:
      fail("not_covered");
  }
  return Object.freeze({ endDate, startDate: formatUtcDate(start) });
}

function subtractCalendar(date: Date, years: number, months: number): Date {
  const sourceYear = date.getUTCFullYear();
  const sourceMonth = date.getUTCMonth();
  const targetMonthOrdinal = sourceMonth - months;
  const targetYear = sourceYear - years + Math.floor(targetMonthOrdinal / 12);
  const targetMonth = ((targetMonthOrdinal % 12) + 12) % 12;
  const targetDay = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(declaredLength)) {
      fail("invalid_response");
    }
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength > MAX_RESPONSE_BYTES
    ) {
      fail("invalid_response");
    }
  }
  if (response.body === null) fail("invalid_response");
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) fail("invalid_response");
      totalBytes += result.value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The value-free response error below is authoritative.
        }
        fail("invalid_response");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof PersonalMarketDataProviderError) throw error;
    fail("invalid_response");
  } finally {
    reader.releaseLock();
  }
  if (totalBytes === 0) fail("invalid_response");
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("invalid_response");
  }
}

function normalizeHistory(
  value: unknown,
  startDate: string,
  endDate: string,
): readonly NormalizedBar[] {
  if (!Array.isArray(value)) fail("invalid_response");
  if (value.length === 0) fail("not_covered");
  if (value.length > MAX_EOD_BARS) fail("invalid_response");
  const normalized: NormalizedBar[] = [];
  let previousDate: string | undefined;
  for (const candidate of value) {
    if (!isRecord(candidate)) fail("invalid_response");
    const date = normalizeTiingoDate(candidate.date);
    if (
      date.date < startDate ||
      date.date > endDate ||
      (previousDate !== undefined && date.date <= previousDate)
    ) {
      fail("invalid_response");
    }
    previousDate = date.date;

    const raw = normalizeOhlcv(candidate, "");
    const adjusted = normalizeOhlcv(candidate, "adj");
    const dividendCash = finiteNumber(candidate.divCash, {
      minimum: 0,
    });
    const splitFactor = finiteNumber(candidate.splitFactor, {
      minimumExclusive: 0,
    });
    const dto = Object.freeze({
      adjusted: adjusted.dto,
      date: date.date,
      dividendCash: decimalString(dividendCash),
      raw: raw.dto,
      splitFactor: decimalString(splitFactor),
    }) satisfies PersonalMarketDataDailyBarDto;
    normalized.push(
      Object.freeze({
        dto,
        rawClose: raw.close,
        sourceTime: usEquityRegularSessionCloseInstant(date.date),
        splitFactor,
      }),
    );
  }
  return Object.freeze(normalized);
}

function normalizeOhlcv(
  value: Record<string, unknown>,
  prefix: "" | "adj",
): Readonly<{
  close: number;
  dto: Readonly<{
    close: string;
    high: string;
    low: string;
    open: string;
    volume: string;
  }>;
}> {
  const open = finiteNumber(value[field(prefix, "Open")], {
    minimumExclusive: 0,
  });
  const high = finiteNumber(value[field(prefix, "High")], {
    minimumExclusive: 0,
  });
  const low = finiteNumber(value[field(prefix, "Low")], {
    minimumExclusive: 0,
  });
  const close = finiteNumber(value[field(prefix, "Close")], {
    minimumExclusive: 0,
  });
  const volume = finiteNumber(value[field(prefix, "Volume")], {
    integer: prefix === "",
    minimum: 0,
  });
  if (low > open || low > close || high < open || high < close || high < low) {
    fail("invalid_response");
  }
  return Object.freeze({
    close,
    dto: Object.freeze({
      close: decimalString(close),
      high: decimalString(high),
      low: decimalString(low),
      open: decimalString(open),
      volume: decimalString(volume),
    }),
  });
}

function field(
  prefix: "" | "adj",
  name: "Open" | "High" | "Low" | "Close" | "Volume",
): string {
  return prefix === "" ? name.toLowerCase() : `${prefix}${name}`;
}

function normalizeQuote(
  value: unknown,
  providerSymbol: string,
  bars: readonly NormalizedBar[],
  now: Date,
  ingestedAt: string,
): PersonalMarketDataQuoteDto {
  if (!Array.isArray(value) || value.length > 1) fail("invalid_response");
  if (value.length === 1) {
    const candidates: readonly unknown[] = value;
    const candidate: unknown = candidates[0];
    if (!isRecord(candidate)) fail("invalid_response");
    if (
      candidate.ticker !== providerSymbol ||
      !("tngoLast" in candidate) ||
      !("prevClose" in candidate)
    ) {
      fail("invalid_response");
    }
    const timestamp = normalizeIsoInstant(candidate.timestamp, now);
    const previousClose = nullablePositiveNumber(candidate.prevClose);
    if (candidate.tngoLast !== null) {
      const price = finiteNumber(candidate.tngoLast, {
        minimumExclusive: 0,
      });
      return quoteDto(
        price,
        previousClose,
        "derived_realtime_reference",
        timestamp,
        now,
        ingestedAt,
      );
    }
  }
  const latest = bars.at(-1);
  if (latest === undefined) fail("not_covered");
  const previous = bars.at(-2);
  const previousClose =
    previous === undefined
      ? null
      : finiteNumber(previous.rawClose / latest.splitFactor, {
          minimumExclusive: 0,
        });
  return quoteDto(
    latest.rawClose,
    previousClose,
    "end_of_day_close",
    latest.sourceTime,
    now,
    ingestedAt,
  );
}

function quoteDto(
  price: number,
  previousClose: number | null,
  kind: "derived_realtime_reference" | "end_of_day_close",
  sourceTime: string,
  now: Date,
  ingestedAt: string,
): PersonalMarketDataQuoteDto {
  const sourceMilliseconds = Date.parse(sourceTime);
  if (
    !Number.isFinite(sourceMilliseconds) ||
    sourceMilliseconds - now.getTime() > MAX_FUTURE_CLOCK_SKEW_MILLISECONDS
  ) {
    fail("invalid_response");
  }
  const change =
    previousClose === null
      ? null
      : computedDecimalString(price - previousClose);
  const changePercent =
    previousClose === null
      ? null
      : computedDecimalString(((price - previousClose) / previousClose) * 100);
  return Object.freeze({
    change,
    changePercent,
    currency: "USD",
    freshness:
      now.getTime() - sourceMilliseconds > FRESHNESS_WINDOW_MILLISECONDS
        ? "older_than_36_hours"
        : "current",
    ingestedAt,
    kind,
    previousClose: previousClose === null ? null : decimalString(previousClose),
    price: decimalString(price),
    sourceTime,
  });
}

function normalizeTiingoDate(value: unknown): Readonly<{
  date: string;
}> {
  const sourceTime = normalizeProviderUtcInstant(value);
  if (!sourceTime.endsWith("T00:00:00.000Z")) {
    fail("invalid_response");
  }
  return Object.freeze({ date: sourceTime.slice(0, 10) });
}

function usEquityRegularSessionCloseInstant(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const dayOrdinal = Date.UTC(year, month - 1, day);
  const daylightStart = nthSundayOrdinal(year, 2, 2);
  const daylightEnd = nthSundayOrdinal(year, 10, 1);
  const utcHour =
    dayOrdinal >= daylightStart && dayOrdinal < daylightEnd ? 20 : 21;
  return new Date(Date.UTC(year, month - 1, day, utcHour)).toISOString();
}

function nthSundayOrdinal(year: number, zeroBasedMonth: number, nth: number) {
  const firstDay = Date.UTC(year, zeroBasedMonth, 1);
  const firstWeekday = new Date(firstDay).getUTCDay();
  const firstSunday = 1 + ((7 - firstWeekday) % 7);
  return Date.UTC(year, zeroBasedMonth, firstSunday + (nth - 1) * 7);
}

function normalizeIsoInstant(value: unknown, now: Date): string {
  const sourceTime = normalizeProviderUtcInstant(value);
  const milliseconds = Date.parse(sourceTime);
  if (milliseconds - now.getTime() > MAX_FUTURE_CLOCK_SKEW_MILLISECONDS) {
    fail("invalid_response");
  }
  return sourceTime;
}

function normalizeProviderUtcInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    !PROVIDER_ISO_INSTANT.test(value) ||
    !hasValidCalendarDatePrefix(value)
  ) {
    fail("invalid_response");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail("invalid_response");
  return new Date(milliseconds).toISOString();
}

function hasValidCalendarDatePrefix(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (
    !Number.isSafeInteger(year) ||
    !Number.isSafeInteger(month) ||
    !Number.isSafeInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  return (
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day
  );
}

function nullablePositiveNumber(value: unknown): number | null {
  return value === null ? null : finiteNumber(value, { minimumExclusive: 0 });
}

function finiteNumber(
  value: unknown,
  constraints: Readonly<{
    integer?: boolean;
    minimum?: number;
    minimumExclusive?: number;
  }> = {},
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Object.is(value, -0) ||
    (constraints.integer === true && !Number.isSafeInteger(value)) ||
    (constraints.minimum !== undefined && value < constraints.minimum) ||
    (constraints.minimumExclusive !== undefined &&
      value <= constraints.minimumExclusive)
  ) {
    fail("invalid_response");
  }
  return value;
}

function decimalString(value: number): string {
  const raw = String(value);
  if (!/[eE]/u.test(raw)) return raw;
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u.exec(raw);
  if (match === null) fail("invalid_response");
  const sign = match[1] ?? "";
  const integerDigits = match[2] ?? "";
  const fractionDigits = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isSafeInteger(exponent)) fail("invalid_response");
  const digits = `${integerDigits}${fractionDigits}`;
  const point = integerDigits.length + exponent;
  const expanded =
    point <= 0
      ? `0.${"0".repeat(-point)}${digits}`
      : point >= digits.length
        ? `${digits}${"0".repeat(point - digits.length)}`
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const canonical = canonicalizeDecimal(`${sign}${expanded}`);
  if (canonical.length > 512) fail("invalid_response");
  return canonical;
}

function computedDecimalString(value: number): string {
  if (!Number.isFinite(value)) fail("invalid_response");
  const rounded = Number(value.toPrecision(15));
  return decimalString(Object.is(rounded, -0) ? 0 : rounded);
}

function canonicalizeDecimal(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [rawInteger = "0", rawFraction = ""] = unsigned.split(".");
  const integer = rawInteger.replace(/^0+(?=\d)/u, "");
  const fraction = rawFraction.replace(/0+$/u, "");
  const magnitude = fraction.length === 0 ? integer : `${integer}.${fraction}`;
  return negative && magnitude !== "0" ? `-${magnitude}` : magnitude;
}

function httpErrorCode(status: number): PersonalMarketDataProviderErrorCode {
  if (status === 401 || status === 403) return "credentials_invalid";
  if (status === 404) return "not_covered";
  if (status === 429) return "rate_limited";
  return "upstream_unavailable";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: PersonalMarketDataProviderErrorCode): never {
  throw new PersonalMarketDataProviderError(code);
}
