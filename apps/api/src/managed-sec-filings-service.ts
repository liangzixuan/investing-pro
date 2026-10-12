import {
  managedSecFilingsWindow,
  parseManagedSecFilingsRequest,
  parseManagedSecFilingsResponse,
  type ManagedSecFilingsErrorCode,
  type ManagedSecFilingsRequestDto,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";

import {
  ManagedSecAdmissionError,
  type ManagedSecAdmissionOperation,
} from "./managed-sec-admission";
import type { ManagedSecConfiguration } from "./managed-sec-config";
import { MANAGED_SEC_ISSUERS } from "./managed-sec-issuers";
import { createSecPersonalFilingsProvider } from "./personal-sec-filings-provider";
import type { PersonalSecRequestScheduler } from "./personal-sec-request-scheduler";
import type { WatchlistPrincipal } from "./watchlist-repository";

export class ManagedSecFilingsServiceError extends Error {
  constructor(
    readonly code: ManagedSecFilingsErrorCode | "rate_limited",
    readonly nextAllowedAt?: string,
  ) {
    super(code);
    this.name = "ManagedSecFilingsServiceError";
  }
}
export interface ManagedSecFilingsService {
  load(
    request: ManagedSecFilingsRequestDto,
    principal: WatchlistPrincipal,
    signal: AbortSignal,
  ): Promise<ManagedSecFilingsResponseDto>;
  assertActive(signal: AbortSignal): void;
}
interface Options {
  readonly configuration: Readonly<ManagedSecConfiguration> | null;
  readonly catalog: ManagedSecurityMasterCatalog;
  readonly enteredAt: string;
  readonly startedAt: number;
  readonly openAdmission: (
    signal: AbortSignal,
    remainingMs: number,
  ) => ManagedSecAdmissionOperation;
  readonly monotonic?: () => number;
  readonly now?: () => Date;
  readonly fetch?: typeof globalThis.fetch;
  readonly scheduler?: PersonalSecRequestScheduler;
}
interface Clock {
  monotonic(): number;
  now(): Date;
  active(signal: AbortSignal, limit: number): void;
}

/** Retires noncooperative work without giving its late result any authority. */
export async function awaitManagedSecFilings<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let stop: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () => reject(new ManagedSecFilingsServiceError("request_timeout"));
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

function clockFor(options: Options): Clock {
  const monotonic = options.monotonic ?? (() => performance.now());
  return {
    monotonic,
    now: options.now ?? (() => new Date()),
    active(signal, limit) {
      const elapsed = monotonic() - options.startedAt;
      if (
        signal.aborted ||
        !Number.isFinite(elapsed) ||
        elapsed < 0 ||
        elapsed >= limit
      )
        throw new ManagedSecFilingsServiceError("request_timeout");
    },
  };
}
function selected(options: Options, input: ManagedSecFilingsRequestDto) {
  const request = parseManagedSecFilingsRequest(input);
  if (!request) throw new ManagedSecFilingsServiceError("invalid_request");
  if (request.catalogSnapshotSha256 !== options.catalog.snapshotSha256)
    throw new ManagedSecFilingsServiceError("catalog_changed");
  const listing = lookupPersonalSecurityMasterListing(
    options.catalog,
    request.listingId,
  );
  if (
    !listing ||
    listing.symbol !== request.symbol ||
    !MANAGED_SEC_ISSUERS.includes(listing.cik)
  )
    throw new ManagedSecFilingsServiceError("invalid_request");
  const window = managedSecFilingsWindow(options.enteredAt);
  if (!window) throw new ManagedSecFilingsServiceError("invalid_request");
  return { request, listing, window };
}

async function reserve(
  options: Options,
  clock: Clock,
  principal: WatchlistPrincipal,
  signal: AbortSignal,
): Promise<void> {
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  const remaining = Math.max(
    1,
    Math.floor(2_000 - (clock.monotonic() - options.startedAt)),
  );
  const timer = setTimeout(() => controller.abort(), remaining);
  timer.unref();
  let operation: ManagedSecAdmissionOperation | undefined;
  try {
    clock.active(combined, 2_000);
    operation = options.openAdmission(combined, remaining);
    await awaitManagedSecFilings(
      operation.admission.reserve(principal, options.enteredAt, combined),
      combined,
    );
  } catch (error) {
    if (
      error instanceof ManagedSecAdmissionError &&
      error.code === "rate_limited"
    )
      throw new ManagedSecFilingsServiceError(
        "rate_limited",
        error.nextAllowedAt,
      );
    if (error instanceof ManagedSecFilingsServiceError) throw error;
    throw new ManagedSecFilingsServiceError("unavailable");
  } finally {
    try {
      await operation?.close();
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  clock.active(signal, 2_000);
}

/** One authenticated operation, sharing the existing Annual CAS admission row. */
export function createManagedSecFilingsService(
  options: Options,
): ManagedSecFilingsService {
  const clock = clockFor(options);
  let used = false;
  return {
    assertActive: (signal) => clock.active(signal, 10_000),
    async load(input, principal, signal) {
      clock.active(signal, 2_000);
      if (used) throw new ManagedSecFilingsServiceError("invalid_request");
      used = true;
      const target = selected(options, input);
      if (!options.configuration)
        throw new ManagedSecFilingsServiceError("not_configured");
      const contact = options.configuration.userAgent;
      await reserve(options, clock, principal, signal);
      return loadSelected(options, clock, contact, target, signal);
    },
  };
}

async function loadSelected(
  options: Options,
  clock: Clock,
  contact: string,
  target: ReturnType<typeof selected>,
  signal: AbortSignal,
): Promise<ManagedSecFilingsResponseDto> {
  const deadline = Math.min(
    clock.monotonic() + 7_500,
    options.startedAt + 9_500,
  );
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  const guard = () => {
    clock.active(combined, 9_500);
    if (clock.monotonic() >= deadline)
      throw new ManagedSecFilingsServiceError("request_timeout");
  };
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(1, deadline - clock.monotonic()),
  );
  timer.unref();
  const provider = createSecPersonalFilingsProvider(contact, {
    fetch: fixedSecFilingsFetch(
      target.listing.cik,
      contact,
      options.fetch ?? globalThis.fetch,
      guard,
    ),
    now: () => {
      guard();
      return clock.now();
    },
    ...(options.scheduler === undefined
      ? {}
      : { scheduler: options.scheduler }),
  });
  try {
    const issuers = await awaitManagedSecFilings(
      provider.loadFilings(
        [target.listing.cik],
        target.window.fromDate,
        target.window.throughDate,
        combined,
      ),
      combined,
    );
    guard();
    const result = parseManagedSecFilingsResponse(
      {
        schemaVersion: target.request.schemaVersion,
        catalogSnapshotSha256: target.request.catalogSnapshotSha256,
        security: identity(target.listing),
        window: target.window,
        requestStartedAt: options.enteredAt,
        completedAt: clock.now().toISOString(),
        issuer: issuers.length === 1 ? issuers[0] : null,
      },
      target.request,
    );
    if (!result) throw new ManagedSecFilingsServiceError("unavailable");
    return result;
  } catch {
    if (combined.aborted || clock.monotonic() >= deadline)
      throw new ManagedSecFilingsServiceError("request_timeout");
    throw new ManagedSecFilingsServiceError("unavailable");
  } finally {
    clearTimeout(timer);
    provider.close();
    controller.abort();
  }
}

function identity(
  listing: ReturnType<typeof selected>["listing"],
): ManagedSecFilingsResponseDto["security"] {
  return {
    country: listing.country,
    exchangeMic: listing.exchangeMic,
    instrumentType: listing.instrumentType,
    issuerId: listing.issuerId,
    issuerName: listing.issuerName,
    listingId: listing.listingId,
    securityId: listing.securityId,
    securityName: listing.securityName,
    shareClassId: listing.shareClassId,
    shareClassName: listing.shareClassName,
    symbol: listing.symbol,
    cik: listing.cik,
  };
}

function validHeaders(
  value: HeadersInit | undefined,
  contact: string,
): boolean {
  const headers = new Headers(value);
  return (
    [...headers].length === 2 &&
    headers.get("user-agent") === contact &&
    headers.get("accept") === "application/json"
  );
}
function validRequest(init: RequestInit | undefined, contact: string): boolean {
  return (
    init?.method === "GET" &&
    init.redirect === "error" &&
    init.credentials === "omit" &&
    init.cache === "no-store" &&
    init.referrerPolicy === "no-referrer" &&
    validHeaders(init.headers, contact) &&
    init.body === undefined &&
    init.signal?.aborted === false
  );
}
/** The unchanged provider retains truthful HTTP failure and current-object coverage statuses. */
function fixedSecFilingsFetch(
  cik: string,
  contact: string,
  fetch: typeof globalThis.fetch,
  guard: () => void,
): typeof globalThis.fetch {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  let used = false;
  return async (input, init) => {
    guard();
    if (
      used ||
      typeof input !== "string" ||
      input !== url ||
      !validRequest(init, contact)
    )
      throw new ManagedSecFilingsServiceError("unavailable");
    used = true;
    const response = await fetch(input, init);
    try {
      guard();
    } catch (error) {
      if (response instanceof Response)
        void response.body?.cancel().catch(() => undefined);
      throw error;
    }
    return response;
  };
}
