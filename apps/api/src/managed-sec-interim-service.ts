import {
  parseManagedSecInterimCanonicalRequest,
  type PersonalSecInterimCanonicalRequestDto,
  type PersonalSecInterimCanonicalResponseDto,
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
import { MANAGED_SEC_INTERIM_ISSUERS } from "./managed-sec-issuers";
import { createManagedSecSourceFetch } from "./managed-sec-source-fetch";
import { createSecPersonalInterimEvidenceProvider } from "./personal-sec-interim-evidence-provider";
import { encodePersonalSecInterimCanonicalResponse } from "./personal-sec-interim-canonical-response";
import type { PersonalSecRequestScheduler } from "./personal-sec-request-scheduler";
import type { WatchlistPrincipal } from "./watchlist-repository";

export class ManagedSecInterimServiceError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "catalog_changed"
      | "not_configured"
      | "unavailable"
      | "request_timeout"
      | "rate_limited",
    readonly nextAllowedAt?: string,
  ) {
    super(code);
    this.name = "ManagedSecInterimServiceError";
  }
}
export interface ManagedSecInterimService {
  load(
    request: PersonalSecInterimCanonicalRequestDto,
    principal: WatchlistPrincipal,
    signal: AbortSignal,
  ): Promise<PersonalSecInterimCanonicalResponseDto>;
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
/** Noncooperative awaits lose authority on abort, including every late completion. */
export async function awaitManagedSecInterim<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let stop: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () => reject(new ManagedSecInterimServiceError("request_timeout"));
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
      if (signal.aborted)
        throw new ManagedSecInterimServiceError("request_timeout");
      const elapsed = monotonic() - options.startedAt;
      if (!Number.isFinite(elapsed))
        throw new ManagedSecInterimServiceError("request_timeout");
      if (elapsed < 0 || elapsed >= limit)
        throw new ManagedSecInterimServiceError("request_timeout");
    },
  };
}
function admitRequest(
  input: PersonalSecInterimCanonicalRequestDto,
  catalog: ManagedSecurityMasterCatalog,
) {
  const request = parseManagedSecInterimCanonicalRequest(input);
  if (request === null)
    throw new ManagedSecInterimServiceError("invalid_request");
  if (request.catalogSnapshotSha256 !== catalog.snapshotSha256)
    throw new ManagedSecInterimServiceError("catalog_changed");
  const listing = admitListing(catalog, request);
  return { request, listing };
}
/** A current request cannot choose or broaden its catalog issuer. */
function admitListing(
  catalog: ManagedSecurityMasterCatalog,
  request: PersonalSecInterimCanonicalRequestDto,
) {
  const listing = lookupPersonalSecurityMasterListing(
    catalog,
    request.listingId,
  );
  if (listing === null)
    throw new ManagedSecInterimServiceError("invalid_request");
  if (listing.symbol !== request.symbol)
    throw new ManagedSecInterimServiceError("invalid_request");
  if (!MANAGED_SEC_INTERIM_ISSUERS.includes(listing.cik))
    throw new ManagedSecInterimServiceError("invalid_request");
  return listing;
}

async function reserveRead(
  options: Options,
  principal: WatchlistPrincipal,
  signal: AbortSignal,
  clock: Clock,
): Promise<void> {
  const controller = new AbortController();
  const admissionSignal = AbortSignal.any([signal, controller.signal]);
  const remaining = Math.max(
    1,
    Math.floor(2_000 - (clock.monotonic() - options.startedAt)),
  );
  const timer = setTimeout(() => controller.abort(), remaining);
  timer.unref();
  let operation: ManagedSecAdmissionOperation | undefined;
  try {
    clock.active(admissionSignal, 2_000);
    operation = options.openAdmission(admissionSignal, remaining);
    await awaitManagedSecInterim(
      operation.admission.reserve(
        principal,
        options.enteredAt,
        admissionSignal,
      ),
      admissionSignal,
    );
  } catch (error) {
    throw admissionFailure(error);
  } finally {
    try {
      await operation?.close();
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
}
function admissionFailure(error: unknown): ManagedSecInterimServiceError {
  if (
    error instanceof ManagedSecAdmissionError &&
    error.code === "rate_limited"
  )
    return new ManagedSecInterimServiceError(
      "rate_limited",
      error.nextAllowedAt,
    );
  if (error instanceof ManagedSecInterimServiceError) return error;
  return new ManagedSecInterimServiceError("unavailable");
}
class ProviderLifetime {
  readonly controller = new AbortController();
  readonly signal: AbortSignal;
  readonly deadline: number;
  readonly startedAt: number;
  readonly timer: ReturnType<typeof setTimeout>;
  timedOut = false;
  constructor(
    readonly clock: Clock,
    options: Options,
    signal: AbortSignal,
  ) {
    this.startedAt = options.startedAt;
    this.deadline = Math.min(
      clock.monotonic() + 7_500,
      options.startedAt + 9_500,
    );
    this.signal = AbortSignal.any([signal, this.controller.signal]);
    this.timer = setTimeout(
      () => {
        this.timedOut = true;
        this.controller.abort();
      },
      Math.max(1, this.deadline - clock.monotonic()),
    );
    this.timer.unref();
  }
  readonly guard = () => {
    if (this.signal.aborted)
      throw new ManagedSecInterimServiceError("request_timeout");
    if (this.clockExpired())
      throw new ManagedSecInterimServiceError("request_timeout");
  };
  clockExpired(): boolean {
    const current = this.clock.monotonic();
    if (!Number.isFinite(current)) return true;
    return current < this.startedAt || current >= this.deadline;
  }
  close(): void {
    clearTimeout(this.timer);
    this.controller.abort();
  }
  failure(signal: AbortSignal): ManagedSecInterimServiceError {
    if (signal.aborted)
      return new ManagedSecInterimServiceError("request_timeout");
    if (this.timedOut)
      return new ManagedSecInterimServiceError("request_timeout");
    if (this.clockExpired())
      return new ManagedSecInterimServiceError("request_timeout");
    return new ManagedSecInterimServiceError("unavailable");
  }
}
/** Original entry timestamps govern the2s admission and10s service; never reset. */
export function createManagedSecInterimService(
  options: Options,
): ManagedSecInterimService {
  const clock = clockFor(options);
  return {
    assertActive: (signal) => clock.active(signal, 10_000),
    async load(input, principal, signal) {
      clock.active(signal, 2_000);
      const admitted = admitRequest(input, options.catalog);
      if (options.configuration === null)
        throw new ManagedSecInterimServiceError("not_configured");
      const contact = options.configuration.userAgent;
      await reserveRead(options, principal, signal, clock);
      clock.active(signal, 2_000);
      const lifetime = new ProviderLifetime(clock, options, signal);
      const fetch = createManagedSecSourceFetch({
        cik: admitted.listing.cik,
        contact,
        fetch: options.fetch ?? globalThis.fetch,
        controller: lifetime.controller,
        guard: lifetime.guard,
      });
      const provider = createSecPersonalInterimEvidenceProvider(contact, {
        fetch,
        now: () => {
          lifetime.guard();
          return clock.now();
        },
        ...(options.scheduler === undefined
          ? {}
          : { scheduler: options.scheduler }),
      });
      try {
        const evidence = await awaitManagedSecInterim(
          provider.loadEvidence(admitted.listing.cik, lifetime.signal),
          lifetime.signal,
        );
        lifetime.guard();
        const encoded = encodePersonalSecInterimCanonicalResponse(
          admitted.request,
          options.catalog.snapshotSha256,
          admitted.listing,
          evidence,
        );
        lifetime.guard();
        return encoded.response;
      } catch {
        throw lifetime.failure(signal);
      } finally {
        provider.close();
        lifetime.close();
      }
    },
  };
}
