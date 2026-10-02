import {
  MANAGED_EOD_HISTORY_LIMITS,
  managedEodHistoryWindow,
  parseManagedEodHistoryRequest,
  parseManagedEodHistoryResponse,
  type ManagedEodErrorCode,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
  type PersonalMarketDataIdentityDto,
} from "@research-cockpit/contracts";
import {
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import {
  ManagedEodAdmissionError,
  type ManagedEodAdmission,
} from "./managed-eod-admission";
import {
  MANAGED_EOD_MAPPING_CANDIDATES,
  MANAGED_EOD_MAPPING_SNAPSHOT,
  validateManagedEodConfiguration,
  type ManagedEodConfiguration,
} from "./managed-eod-config";
import {
  createTiingoPersonalMarketDataProvider,
  type TiingoPersonalMarketDataProviderDependencies,
} from "./personal-market-data-provider";
import type { WatchlistPrincipal } from "./watchlist-repository";

export class ManagedEodServiceError extends Error {
  constructor(
    readonly code: ManagedEodErrorCode | "rate_limited",
    readonly nextAllowedAt?: string,
  ) {
    super(code);
    this.name = "ManagedEodServiceError";
  }
}
export interface ManagedEodService {
  load(
    request: ManagedEodHistoryRequestDto,
    principal: WatchlistPrincipal,
    signal: AbortSignal,
  ): Promise<ManagedEodHistoryResponseDto>;
  assertActive(signal: AbortSignal): void;
}
export interface ManagedEodAdmissionOperation {
  readonly admission: ManagedEodAdmission;
  close(): Promise<void>;
}
export async function awaitManagedEod<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let stop: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () => reject(new ManagedEodServiceError("request_timeout"));
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

/** One explicit history read after durable shared admission; no quote, retry or persistence. */
export function createManagedEodService(options: {
  readonly configuration: Readonly<ManagedEodConfiguration> | null;
  readonly token: string | undefined;
  readonly catalog: ManagedSecurityMasterCatalog;
  readonly enteredAt: string;
  readonly startedAt: number;
  readonly openAdmission: (
    signal: AbortSignal,
    remainingMs: number,
  ) => ManagedEodAdmissionOperation;
  readonly monotonic?: () => number;
  readonly now?: () => Date;
  readonly fetch?: TiingoPersonalMarketDataProviderDependencies["fetch"];
}): ManagedEodService {
  const configuration = validateManagedEodConfiguration(options.configuration);
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
      throw new ManagedEodServiceError("request_timeout");
  };
  return {
    assertActive: (signal) => active(signal, 10_000),
    async load(input, principal, signal) {
      active(signal, 2_000);
      const request = parseManagedEodHistoryRequest(input);
      if (!request) throw new ManagedEodServiceError("invalid_request");
      if (request.catalogSnapshotSha256 !== options.catalog.snapshotSha256)
        throw new ManagedEodServiceError("catalog_changed");
      const listing = lookupPersonalSecurityMasterListing(
        options.catalog,
        request.listingId,
      );
      const mapping = MANAGED_EOD_MAPPING_CANDIDATES.find(
        (candidate) => candidate.security.listingId === request.listingId,
      );
      if (
        !listing ||
        !mapping ||
        options.catalog.snapshotSha256 !== MANAGED_EOD_MAPPING_SNAPSHOT ||
        mapping.cik !== listing.cik ||
        Object.entries(mapping.security).some(
          ([key, value]) => listing[key as keyof typeof listing] !== value,
        ) ||
        mapping.providerSymbol !== listing.symbol ||
        mapping.providerSymbol.includes(".")
      )
        throw new ManagedEodServiceError("unsupported_listing");
      if (!configuration || !options.token)
        throw new ManagedEodServiceError("not_configured");
      if (!configuration.enabledSymbols.includes(mapping.providerSymbol))
        throw new ManagedEodServiceError("unsupported_listing");
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
      let operation: ManagedEodAdmissionOperation | undefined;
      try {
        try {
          active(admissionSignal, 2_000);
          operation = options.openAdmission(admissionSignal, remaining);
          await awaitManagedEod(
            operation.admission.reserve(
              principal,
              options.enteredAt,
              admissionSignal,
            ),
            admissionSignal,
          );
        } finally {
          if (operation)
            await awaitManagedEod(operation.close(), admissionSignal);
        }
      } catch (error) {
        if (
          error instanceof ManagedEodAdmissionError &&
          error.code === "rate_limited"
        )
          throw new ManagedEodServiceError("rate_limited", error.nextAllowedAt);
        if (error instanceof ManagedEodServiceError) throw error;
        throw new ManagedEodServiceError("unavailable");
      } finally {
        clearTimeout(admissionTimer);
        admissionController.abort();
      }
      active(signal, 2_000);
      const providerDeadline = Math.min(
        monotonic() + 7_500,
        options.startedAt + 9_500,
      );
      const controller = new AbortController();
      const providerSignal = AbortSignal.any([signal, controller.signal]);
      const guard = () => {
        active(providerSignal, 9_500);
        if (monotonic() >= providerDeadline)
          throw new ManagedEodServiceError("request_timeout");
      };
      const timer = setTimeout(
        () => controller.abort(),
        Math.max(1, providerDeadline - monotonic()),
      );
      timer.unref();
      let source:
        ReturnType<typeof createTiingoPersonalMarketDataProvider> | undefined;
      try {
        guard();
        const startedDate = now();
        const requestStartedAt = startedDate.toISOString();
        const window = managedEodHistoryWindow(requestStartedAt);
        if (
          !window ||
          Date.parse(requestStartedAt) < Date.parse(options.enteredAt)
        )
          throw new ManagedEodServiceError("unavailable");
        source = createTiingoPersonalMarketDataProvider(options.token, {
          ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
          now: () => {
            guard();
            return new Date(startedDate);
          },
          maximumResponseBytes: MANAGED_EOD_HISTORY_LIMITS.sourceBytes,
        });
        const security: PersonalMarketDataIdentityDto = {
          country: listing.country,
          exchangeMic: listing.exchangeMic,
          issuerName: listing.issuerName,
          listingId: listing.listingId,
          securityName: listing.securityName,
          symbol: listing.symbol,
        };
        const overview = await awaitManagedEod(
          source.loadOverview(security, "1m", false, providerSignal),
          providerSignal,
        );
        guard();
        if (overview.history.status === "unavailable")
          throw new ManagedEodServiceError(
            overview.history.reason === "rate_limited"
              ? "source_rate_limited"
              : "unavailable",
          );
        if (
          overview.quote.status !== "not_requested" ||
          overview.history.value.range !== "1m" ||
          overview.history.value.currency !== mapping.currency ||
          overview.ingestedAt !== requestStartedAt ||
          Object.entries(security).some(
            ([key, value]) =>
              overview.security[key as keyof PersonalMarketDataIdentityDto] !==
              value,
          ) ||
          overview.window.startDate !== window.startDate ||
          overview.window.endDate !== window.endDate
        )
          throw new ManagedEodServiceError("unavailable");
        const result = parseManagedEodHistoryResponse(
          {
            schemaVersion: "1.0.0",
            catalogSnapshotSha256: request.catalogSnapshotSha256,
            security: mapping.security,
            range: "1m",
            provider: "Tiingo",
            currency: mapping.currency,
            priceBasis: "raw_close",
            window,
            requestStartedAt: overview.ingestedAt,
            completedAt: now().toISOString(),
            rows: overview.history.value.bars.map((bar) => ({
              date: bar.date,
              close: bar.raw.close,
            })),
          },
          request,
        );
        guard();
        if (!result) throw new ManagedEodServiceError("unavailable");
        return result;
      } catch (error) {
        if (
          signal.aborted ||
          controller.signal.aborted ||
          monotonic() >= providerDeadline
        )
          throw new ManagedEodServiceError("request_timeout");
        if (error instanceof ManagedEodServiceError) throw error;
        throw new ManagedEodServiceError("unavailable");
      } finally {
        clearTimeout(timer);
        source?.close();
        controller.abort();
      }
    },
  };
}
