import {
  PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import { getManagedAnnualView } from "./managed-annual-view";
import { TrialApiError } from "./api";
import {
  isOwnedSecAnnualCanonicalResponse,
  parseSecAnnualCanonicalResponse,
} from "../lib/sec-annual-canonical-response";
import {
  ManagedSecCooldownError,
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  type ManagedApi,
} from "./managed-api";

import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  ManagedSecAccess,
  managedSecCooldownMessage,
} from "./managed-sec-access";

export interface ManagedAnnualReportSeed {
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly showingPrevious: boolean;
}

export interface ManagedAnnualReportState {
  readonly selection: ManagedResearchSelection | null;
  readonly response: PersonalSecAnnualCanonicalResponseDto | null;
  readonly view: PersonalSecAnnualCanonicalView | null;
  readonly responseOrigin: "request" | "watchlist-comparison" | null;
  readonly showingPrevious: boolean;
  readonly running: boolean;
  readonly checkingSeed: boolean;
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
const empty = (): ManagedAnnualReportState => ({
  selection: null,
  response: null,
  view: null,
  responseOrigin: null,
  showingPrevious: false,
  running: false,
  checkingSeed: false,
  catalogChanged: false,
  message: "",
  error: false,
});

function matchesSelection(
  response: PersonalSecAnnualCanonicalResponseDto,
  selected: ManagedResearchSelection,
) {
  const security = response.security;
  const listing = selected.listing;
  return (
    response.catalogSnapshotSha256 === selected.catalogSnapshotSha256 &&
    security.listingId === listing.listingId &&
    security.symbol === listing.symbol &&
    security.issuerId === listing.issuerId &&
    security.issuerName === listing.issuerName &&
    security.securityName === listing.securityName &&
    security.country === listing.country &&
    security.exchangeMic === listing.exchangeMic &&
    (selected.cik === null || security.cik === selected.cik)
  );
}

async function parseReportSeed(
  selection: ManagedResearchSelection,
  seed: ManagedAnnualReportSeed,
  signal: AbortSignal,
): Promise<ManagedAnnualReportSeed> {
  if (
    selection.origin !== "watchlist" ||
    selection.cik !== null ||
    typeof seed.showingPrevious !== "boolean"
  )
    throw new TrialApiError("invalid_response");
  const showingPrevious = seed.showingPrevious;
  const response = await parseSecAnnualCanonicalResponse(
    seed.response,
    {
      schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listingId: selection.listing.listingId,
      symbol: selection.listing.symbol,
    },
    signal,
  );
  if (!response || !matchesSelection(response, selection))
    throw new TrialApiError("invalid_response");
  return Object.freeze({ response, showingPrevious });
}

function deriveReportView(response: PersonalSecAnnualCanonicalResponseDto) {
  try {
    const view = getManagedAnnualView(response);
    if (view === null) throw new TrialApiError("invalid_response");
    return view;
  } catch {
    throw new TrialApiError("invalid_response");
  }
}

function errorMessage(error: unknown, showingPrevious: boolean): string {
  if (showingPrevious)
    return error instanceof ManagedAnnualReportError
      ? "The annual report refresh timed out. Try refreshing again when you are ready."
      : "The annual report refresh failed. Try refreshing again when you are ready.";
  if (error instanceof ManagedCatalogChangedError)
    return "The catalog changed. Refresh the catalog and choose the company again.";
  if (error instanceof ManagedAnnualReportError)
    return error.code === "not_configured"
      ? "Annual reports are not configured on the service yet."
      : "The annual report timed out. Load again when you are ready.";
  if (error instanceof TrialApiError && error.code === "invalid_response")
    return "The annual report could not be validated. No report or values were retained.";
  return "The annual report could not be loaded. Try again when you are ready.";
}

/** Owns one explicit annual read. It never writes or reconciles a watchlist. */
export class ManagedAnnualReport {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private lifetime = Symbol();
  private retired = false;

  constructor(
    private readonly loadReport: ManagedApi["annualReport"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedSecAccess(),
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedAnnualReportState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  open(selection: ManagedResearchSelection, seed?: ManagedAnnualReportSeed) {
    if (this.retired) return;
    const lifetime = this.closeVisit();
    if (this.retired || this.lifetime !== lifetime) return;
    const captured = Object.freeze({
      ...selection,
      listing: Object.freeze({ ...selection.listing }),
    });
    const operation = seed === undefined ? null : new AbortController();
    this.operation = operation;
    this.update({
      selection: captured,
      running: operation !== null,
      checkingSeed: operation !== null,
      message: operation
        ? "Checking the loaded watchlist comparison report…"
        : "Load the observed annual report when you are ready.",
    });
    if (operation && seed !== undefined)
      void this.acceptSeed(captured, seed, operation);
  }
  private async acceptSeed(
    selection: ManagedResearchSelection,
    seed: ManagedAnnualReportSeed,
    operation: AbortController,
  ) {
    const current = () =>
      !this.retired &&
      this.operation === operation &&
      this.state.selection === selection &&
      !operation.signal.aborted;
    try {
      if (!current()) return;
      const accepted = await parseReportSeed(selection, seed, operation.signal);
      if (!current()) return;
      const view = deriveReportView(accepted.response);
      if (!current()) return;
      this.update({
        ...accepted,
        view,
        responseOrigin: "watchlist-comparison",
        message:
          "The loaded watchlist comparison report is available in this company visit. Refresh explicitly to check again.",
      });
    } catch {
      if (!current()) return;
      this.update({
        error: true,
        message:
          "The loaded watchlist comparison report could not be validated. Load the annual report when you are ready.",
      });
    } finally {
      if (current()) {
        this.operation = null;
        this.update({ running: false, checkingSeed: false });
      }
    }
  }
  close() {
    this.closeVisit();
  }
  private closeVisit() {
    const lifetime = Symbol();
    this.lifetime = lifetime;
    const operation = this.operation;
    this.operation = null;
    this.state = empty();
    operation?.abort();
    if (this.lifetime === lifetime)
      for (const listener of this.listeners) listener();
    return lifetime;
  }
  retire() {
    this.retired = true;
    this.close();
  }
  cancel() {
    const operation = this.operation;
    if (!operation) return;
    const lifetime = this.lifetime;
    const checkingSeed = this.state.checkingSeed;
    this.operation = null;
    operation.abort();
    if (this.retired || this.lifetime !== lifetime || this.operation !== null)
      return;
    this.update({
      running: false,
      checkingSeed: false,
      showingPrevious: this.state.response !== null,
      error: false,
      message: checkingSeed
        ? "Checking the loaded report was cancelled. Load the annual report when you are ready."
        : this.state.response
          ? "Annual report refresh cancelled. Refresh again when ready."
          : "Annual report load cancelled. Load again when ready.",
    });
  }
  async load() {
    const selection = this.state.selection;
    if (
      this.retired ||
      !selection ||
      this.operation ||
      this.state.catalogChanged
    )
      return;
    const nextAllowedAt = this.access.getNextAllowedAt();
    if (nextAllowedAt) {
      this.update({
        showingPrevious: this.state.response !== null,
        message: managedSecCooldownMessage(
          nextAllowedAt,
          this.state.response !== null,
        ),
        error: false,
      });
      return;
    }
    const operation = new AbortController();
    this.operation = operation;
    const current = () =>
      !this.retired &&
      this.operation === operation &&
      this.state.selection === selection &&
      !operation.signal.aborted;
    this.update({
      running: true,
      showingPrevious: this.state.response !== null,
      error: false,
      message: this.state.response
        ? `Refreshing the annual report for ${selection.listing.symbol}…`
        : `Loading the observed annual report for ${selection.listing.symbol}…`,
    });
    try {
      if (!current()) return;
      const candidate = await this.loadReport(
        {
          schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
          catalogSnapshotSha256: selection.catalogSnapshotSha256,
          listingId: selection.listing.listingId,
          symbol: selection.listing.symbol,
        },
        operation.signal,
      );
      if (!current()) return;
      // The production API admits and freezes within its existing request lifetime.
      // Unowned adapters still need complete closed-shape and hash admission.
      const response = isOwnedSecAnnualCanonicalResponse(candidate)
        ? candidate
        : await parseSecAnnualCanonicalResponse(
            candidate,
            {
              schemaVersion: PERSONAL_SEC_ANNUAL_CANONICAL_VERSION,
              catalogSnapshotSha256: selection.catalogSnapshotSha256,
              listingId: selection.listing.listingId,
              symbol: selection.listing.symbol,
            },
            operation.signal,
          );
      if (!current()) return;
      if (!response || !matchesSelection(response, selection))
        throw new TrialApiError("invalid_response");
      const view = deriveReportView(response);
      if (!current()) return;
      this.update({
        response,
        view,
        responseOrigin: "request",
        showingPrevious: false,
        message: `Annual report loaded for ${selection.listing.symbol}. Refresh explicitly to check again.`,
      });
    } catch (error) {
      if (!current()) return;
      if (
        error instanceof TrialApiError &&
        ["unauthenticated", "access_denied", "origin_denied"].includes(
          error.code,
        )
      ) {
        this.readError(error);
        this.retire();
      } else if (error instanceof ManagedSecCooldownError) {
        try {
          const deadline = this.access.recordCooldown(error, operation.signal);
          this.update({
            showingPrevious: this.state.response !== null,
            message: managedSecCooldownMessage(
              deadline,
              this.state.response !== null,
            ),
          });
        } catch {
          this.update({
            response: null,
            view: null,
            responseOrigin: null,
            showingPrevious: false,
            error: true,
            message: errorMessage(new TrialApiError("invalid_response"), false),
          });
        }
      } else {
        const showingPrevious =
          this.state.response !== null &&
          ((error instanceof ManagedAnnualReportError &&
            error.code === "request_timeout") ||
            (error instanceof TrialApiError && error.code === "unavailable"));
        const retained = showingPrevious
          ? {
              response: this.state.response,
              view: this.state.view,
              responseOrigin: this.state.responseOrigin,
            }
          : { response: null, view: null, responseOrigin: null };
        this.update({
          ...retained,
          showingPrevious,
          error: true,
          message: errorMessage(error, showingPrevious),
          catalogChanged: error instanceof ManagedCatalogChangedError,
        });
      }
    } finally {
      if (current()) {
        this.operation = null;
        this.update({ running: false });
      }
    }
  }
}
