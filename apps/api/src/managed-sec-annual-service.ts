import {
  parseManagedSecAnnualEvidenceRequest,
  type PersonalSecAnnualEvidenceRequestDto,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";

import {
  ManagedSecAnnualAdmissionError,
  type ManagedSecAnnualAdmission,
} from "./managed-sec-annual-admission";
import type { ManagedSecAnnualConfiguration } from "./managed-sec-annual-config";
import { createSecPersonalAnnualEvidenceProvider } from "./personal-sec-annual-evidence-provider";
import type { PersonalSecRequestScheduler } from "./personal-sec-request-scheduler";
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
    request: PersonalSecAnnualEvidenceRequestDto,
    principal: WatchlistPrincipal,
    signal: AbortSignal,
  ): Promise<PersonalSecAnnualEvidenceResponseDto>;
  assertActive(signal: AbortSignal): void;
}
export interface ManagedSecAnnualAdmissionOperation {
  readonly admission: ManagedSecAnnualAdmission;
  close(): Promise<void>;
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
  readonly configuration: Readonly<ManagedSecAnnualConfiguration> | null;
  readonly catalog: ManagedSecurityMasterCatalog;
  readonly enteredAt: string;
  readonly startedAt: number;
  readonly openAdmission: (
    signal: AbortSignal,
    remainingMs: number,
  ) => ManagedSecAnnualAdmissionOperation;
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
      const request = parseManagedSecAnnualEvidenceRequest(input);
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
        !["0000320193", "0001652044"].includes(listing.cik)
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
      let operation: ManagedSecAnnualAdmissionOperation | undefined;
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
          error instanceof ManagedSecAnnualAdmissionError &&
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
      const fetch = fixedSecFetch(
        listing.cik,
        contact,
        options.fetch ?? globalThis.fetch,
        controller,
        guard,
      );
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
        return Object.freeze({
          schemaVersion: request.schemaVersion,
          catalogSnapshotSha256: request.catalogSnapshotSha256,
          security: Object.freeze({
            country: listing.country,
            exchangeMic: listing.exchangeMic,
            issuerName: listing.issuerName,
            issuerId: listing.issuerId,
            listingId: listing.listingId,
            securityName: listing.securityName,
            symbol: listing.symbol,
            cik: listing.cik,
          }),
          evidence,
        });
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

/** Accepted proof latch, with issuer fixed by the server's admitted catalog. */
function fixedSecFetch(
  cik: string,
  contact: string,
  fetch: typeof globalThis.fetch,
  controller: AbortController,
  guard: () => void,
): typeof globalThis.fetch {
  const urls = [
    `https://data.sec.gov/submissions/CIK${cik}.json`,
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
  ];
  let count = 0;
  const stop = (): never => {
    controller.abort();
    throw new ManagedSecAnnualServiceError("unavailable");
  };
  return async (input, init) => {
    guard();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const headers = new Headers(init?.headers);
    if (
      count >= 2 ||
      url !== urls[count] ||
      init?.method !== "GET" ||
      init.redirect !== "error" ||
      init.credentials !== "omit" ||
      init.cache !== "no-store" ||
      headers.get("user-agent") !== contact ||
      headers.get("accept") !== "application/json" ||
      init.body !== undefined ||
      init.signal?.aborted !== false
    )
      stop();
    count++;
    const requestSignal = init!.signal!;
    const bodyFailed = () => controller.abort();
    requestSignal.addEventListener("abort", bodyFailed, { once: true });
    const release = () =>
      requestSignal.removeEventListener("abort", bodyFailed);
    try {
      const response = await fetch(input, init);
      if (!(response instanceof Response)) stop();
      try {
        guard();
      } catch (error) {
        void response.body?.cancel().catch(() => undefined);
        throw error;
      }
      if (
        !response.ok ||
        response.redirected ||
        (response.url !== "" && response.url !== url)
      ) {
        void response.body?.cancel().catch(() => undefined);
        stop();
      }
      if (response.body === null) {
        release();
        return response;
      }
      const reader = response.body.getReader();
      const body = new ReadableStream<Uint8Array>(
        {
          async pull(stream) {
            try {
              const part = await reader.read();
              if (part.done) {
                release();
                reader.releaseLock();
                stream.close();
              } else stream.enqueue(part.value);
            } catch {
              bodyFailed();
              release();
              stream.error(new Error("Managed SEC body failed"));
            }
          },
          cancel() {
            release();
            void reader.cancel().catch(() => undefined);
          },
        },
        { highWaterMark: 0 },
      );
      return new Response(body, {
        status: response.status,
        headers: response.headers,
      });
    } catch {
      release();
      return stop();
    }
  };
}
