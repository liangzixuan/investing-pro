import {
  PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
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

export interface ManagedAnnualReportState {
  readonly selection: ManagedResearchSelection | null;
  readonly response: PersonalSecAnnualEvidenceResponseDto | null;
  readonly showingPrevious: boolean;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
const empty = (): ManagedAnnualReportState => ({
  selection: null,
  response: null,
  showingPrevious: false,
  running: false,
  catalogChanged: false,
  message: "",
  error: false,
});

function matchesSelection(
  response: PersonalSecAnnualEvidenceResponseDto,
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
  open(selection: ManagedResearchSelection) {
    if (this.retired) return;
    this.close();
    this.update({
      selection: Object.freeze({
        ...selection,
        listing: Object.freeze({ ...selection.listing }),
      }),
      message: "Load the observed annual report when you are ready.",
    });
  }
  close() {
    this.operation?.abort();
    this.operation = null;
    this.state = empty();
    for (const listener of this.listeners) listener();
  }
  retire() {
    this.retired = true;
    this.close();
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    this.update({
      running: false,
      showingPrevious: this.state.response !== null,
      error: false,
      message: this.state.response
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
      const response = await this.loadReport(
        {
          schemaVersion: PERSONAL_SEC_ANNUAL_EVIDENCE_SCHEMA_VERSION,
          catalogSnapshotSha256: selection.catalogSnapshotSha256,
          listingId: selection.listing.listingId,
          symbol: selection.listing.symbol,
        },
        operation.signal,
      );
      if (!current()) return;
      if (!matchesSelection(response, selection))
        throw new TrialApiError("invalid_response");
      this.update({
        response,
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
        this.update({
          response: showingPrevious ? this.state.response : null,
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
