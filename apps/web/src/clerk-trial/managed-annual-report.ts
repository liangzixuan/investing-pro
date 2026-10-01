import type {
  PersonalSecAnnualEvidenceResponseDto,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedAnnualCooldownError,
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  type ManagedApi,
} from "./managed-api";

export interface AnnualReportSelection {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly listing: Omit<WatchlistMembership, "note">;
  readonly cik: string | null;
  readonly origin: "discover" | "watchlist";
}
export interface ManagedAnnualReportState {
  readonly selection: AnnualReportSelection | null;
  readonly response: PersonalSecAnnualEvidenceResponseDto | null;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
const empty = (): ManagedAnnualReportState => ({
  selection: null,
  response: null,
  running: false,
  catalogChanged: false,
  message: "",
  error: false,
});

function matchesSelection(
  response: PersonalSecAnnualEvidenceResponseDto,
  selected: AnnualReportSelection,
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

function errorMessage(error: unknown): string {
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
  private nextAllowedAt: string | null = null;

  constructor(
    private readonly loadReport: ManagedApi["annualReport"],
    private readonly readError: (error: TrialApiError) => void,
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
  open(selection: AnnualReportSelection) {
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
    this.nextAllowedAt = null;
    this.close();
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    this.update({
      running: false,
      response: null,
      error: false,
      message: "Annual report load cancelled. Load again when ready.",
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
    if (this.nextAllowedAt && Date.now() < Date.parse(this.nextAllowedAt)) {
      this.update({
        message: `Annual report requests are shared across your devices. Load again after ${this.nextAllowedAt}.`,
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
      response: null,
      error: false,
      message: `Loading the observed annual report for ${selection.listing.symbol}…`,
    });
    try {
      const response = await this.loadReport(
        {
          schemaVersion: "1.0.0",
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
      } else if (error instanceof ManagedAnnualCooldownError) {
        this.nextAllowedAt = error.nextAllowedAt;
        this.update({
          message: `Annual report requests are shared across your devices. Load again after ${error.nextAllowedAt}.`,
        });
      } else {
        this.update({
          error: true,
          message: errorMessage(error),
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
