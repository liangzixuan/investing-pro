import {
  parseManagedSecAnnualCanonicalRequest,
  type PersonalSecAnnualCanonicalRequestDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";

import {
  ManagedSecAdmissionError,
  type ManagedSecAdmissionOperation,
} from "./managed-sec-admission";
import { MANAGED_SEC_ANNUAL_ISSUERS } from "./managed-sec-issuers";
import type { ManagedSecConfiguration } from "./managed-sec-config";
import { createSecPersonalAnnualEvidenceProvider } from "./personal-sec-annual-evidence-provider";
import { encodePersonalSecAnnualCanonicalResponse } from "./personal-sec-annual-canonical-response";
import type { PersonalSecRequestScheduler } from "./personal-sec-request-scheduler";
import { createManagedSecSourceFetch } from "./managed-sec-source-fetch";
import type { WatchlistPrincipal } from "./watchlist-repository";

export class ManagedSecAnnualServiceError extends Error {
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
    this.name = "ManagedSecAnnualServiceError";
  }
}
export interface ManagedSecAnnualService {
  load(
    request: PersonalSecAnnualCanonicalRequestDto,
    principal: WatchlistPrincipal,
    signal: AbortSignal,
  ): Promise<PersonalSecAnnualCanonicalResponseDto>;
  assertActive(signal: AbortSignal): void;
}

/** Retires an await without granting any later completion authority. */
export async function awaitManagedSecAnnual<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let stop: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () => reject(new ManagedSecAnnualServiceError("request_timeout"));
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

/** The entry timestamps are captured before bridge/auth, never refreshed here. */
export function createManagedSecAnnualService(options: {
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
}): ManagedSecAnnualService {
  const monotonic = options.monotonic ?? (() => performance.now());
  const now = options.now ?? (() => new Date());
  const active = (signal: AbortSignal, limit: number) => {
    const elapsed = monotonic() - options.startedAt;
    if (
      signal.aborted ||
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed >= limit
    )
      throw new ManagedSecAnnualServiceError("request_timeout");
  };
  return {
    assertActive: (signal) => active(signal, 10_000),
    async load(input, principal, signal) {
      active(signal, 2_000);
      const request = parseManagedSecAnnualCanonicalRequest(input);
      if (request === null)
        throw new ManagedSecAnnualServiceError("invalid_request");
      if (request.catalogSnapshotSha256 !== options.catalog.snapshotSha256)
        throw new ManagedSecAnnualServiceError("catalog_changed");
      const listing = lookupPersonalSecurityMasterListing(
        options.catalog,
        request.listingId,
      );
      if (
        listing === null ||
        listing.symbol !== request.symbol ||
        !MANAGED_SEC_ANNUAL_ISSUERS.includes(listing.cik)
      )
        throw new ManagedSecAnnualServiceError("invalid_request");
      if (options.configuration === null)
        throw new ManagedSecAnnualServiceError("not_configured");
      const contact = options.configuration.userAgent;
      const admissionController = new AbortController();
      const admissionSignal = AbortSignal.any([
        signal,
        admissionController.signal,
      ]);
      const remaining = Math.max(
        1,
        Math.floor(2_000 - (monotonic() - options.startedAt)),
      );
      const admissionTimer = setTimeout(
        () => admissionController.abort(),
        remaining,
      );
      admissionTimer.unref();
      let operation: ManagedSecAdmissionOperation | undefined;
      try {
        active(admissionSignal, 2_000);
        operation = options.openAdmission(admissionSignal, remaining);
        await awaitManagedSecAnnual(
          operation.admission.reserve(
            principal,
            options.enteredAt,
            admissionSignal,
          ),
          admissionSignal,
        );
      } catch (error) {
        if (
          error instanceof ManagedSecAdmissionError &&
          error.code === "rate_limited"
        )
          throw new ManagedSecAnnualServiceError(
            "rate_limited",
            error.nextAllowedAt,
          );
        if (error instanceof ManagedSecAnnualServiceError) throw error;
        throw new ManagedSecAnnualServiceError("unavailable");
      } finally {
        try {
          await operation?.close();
        } finally {
          clearTimeout(admissionTimer);
          admissionController.abort();
        }
      }
      active(signal, 2_000);
      const providerDeadline = Math.min(
        monotonic() + 7_500,
        options.startedAt + 9_500,
      );
      const controller = new AbortController();
      const providerSignal = AbortSignal.any([signal, controller.signal]);
      const guard = () => {
        if (providerSignal.aborted || monotonic() >= providerDeadline)
          throw new ManagedSecAnnualServiceError("request_timeout");
      };
      const timer = setTimeout(
        () => controller.abort(),
        Math.max(1, providerDeadline - monotonic()),
      );
      timer.unref();
      const fetch = createManagedSecSourceFetch({
        cik: listing.cik,
        contact,
        fetch: options.fetch ?? globalThis.fetch,
        controller,
        guard,
      });
      const provider = createSecPersonalAnnualEvidenceProvider(contact, {
        fetch,
        now: () => {
          guard();
          return now();
        },
        ...(options.scheduler === undefined
          ? {}
          : { scheduler: options.scheduler }),
      });
      try {
        const evidence = await awaitManagedSecAnnual(
          provider.loadEvidence(listing.cik, providerSignal),
          providerSignal,
        );
        guard();
        const prepared = encodePersonalSecAnnualCanonicalResponse(
          request,
          options.catalog.snapshotSha256,
          listing,
          evidence,
        );
        guard();
        return prepared.response;
      } catch {
        if (signal.aborted || monotonic() >= providerDeadline)
          throw new ManagedSecAnnualServiceError("request_timeout");
        throw new ManagedSecAnnualServiceError("unavailable");
      } finally {
        clearTimeout(timer);
        provider.close();
        controller.abort();
      }
    },
  };
}
