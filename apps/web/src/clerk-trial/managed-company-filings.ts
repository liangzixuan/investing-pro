import {
  membershipMatchesResult,
  parseManagedSecFilingsResponse,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";

import { TrialApiError } from "./api";

import {
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
  ManagedSecFilingsError,
  type ManagedApi,
} from "./managed-api";

import type { ManagedResearchSelection } from "./managed-research-selection";

import {
  ManagedSecAccess,
  managedSecCooldownMessage,
} from "./managed-sec-access";

export interface ManagedCompanyFilingsState {
  readonly selection: ManagedResearchSelection | null;

  readonly response: ManagedSecFilingsResponseDto | null;

  readonly lastCheck: ManagedSecFilingsResponseDto | null;

  readonly showingPrevious: boolean;

  readonly running: boolean;

  readonly catalogChanged: boolean;

  readonly message: string;

  readonly error: boolean;
}

const empty = (): ManagedCompanyFilingsState => ({
  selection: null,
  response: null,
  lastCheck: null,
  showingPrevious: false,
  running: false,
  catalogChanged: false,
  message: "",
  error: false,
});

function isTransient(error: unknown) {
  return (
    (error instanceof ManagedSecFilingsError &&
      ["request_timeout", "unavailable"].includes(error.code)) ||
    (error instanceof TrialApiError && error.code === "unavailable")
  );
}

function failureMessage(error: unknown) {
  if (error instanceof ManagedCatalogChangedError)
    return "The catalog changed. Refresh the catalog and choose the company again.";

  if (
    error instanceof ManagedSecFilingsError &&
    error.code === "not_configured"
  )
    return "SEC filings are not configured on the service yet.";

  if (error instanceof TrialApiError && error.code === "invalid_response")
    return "The filings response could not be validated. No filings were retained.";

  return "The filings request failed. Load or refresh again when you are ready.";
}

export function managedFilingsStatus(
  status: ManagedSecFilingsResponseDto["issuer"]["status"],
) {
  const labels = {
    available: "Filings loaded. Refresh explicitly to check again.",

    not_covered: "SEC filings are not covered for this issuer by this source.",

    rate_limited: "The SEC source limited this request. Try refreshing later.",

    upstream_unavailable:
      "The SEC source is unavailable. Try refreshing later.",

    invalid_response:
      "The SEC source response could not be validated. No filings from this attempt are shown.",
  };

  return labels[status];
}

/** One explicit issuer read per company visit. Watchlist state remains separate. */

export class ManagedCompanyFilings {
  private state = empty();

  private readonly listeners = new Set<() => void>();

  private operation: AbortController | null = null;

  private retired = false;

  constructor(
    private readonly read: ManagedApi["recentFilings"],

    private readonly readError: (error: TrialApiError) => void,

    private readonly access = new ManagedSecAccess(),
  ) {}

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(next: Partial<ManagedCompanyFilingsState>) {
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
      message: "Load SEC filings from the last 90 days when you are ready.",
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
      message: "Filings request cancelled. Load or refresh again when ready.",
    });
  }

  private accept(
    response: ManagedSecFilingsResponseDto,
    selection: ManagedResearchSelection,
  ) {
    const checked = parseManagedSecFilingsResponse(response, {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: selection.catalogSnapshotSha256,

      listingId: selection.listing.listingId,
      symbol: selection.listing.symbol,
    });

    if (
      !checked ||
      !membershipMatchesResult(
        { ...selection.listing, note: "" },
        checked.security,
      ) ||
      (selection.cik !== null && checked.security.cik !== selection.cik)
    )
      throw new TrialApiError("invalid_response");

    const previous =
      this.state.response !== null &&
      ["rate_limited", "upstream_unavailable"].includes(checked.issuer.status);

    this.update({
      response: previous ? this.state.response : checked,
      lastCheck: checked,
      showingPrevious: previous,
      error: checked.issuer.status !== "available",
      message: managedFilingsStatus(checked.issuer.status),
    });
  }

  private fail(error: unknown, signal: AbortSignal) {
    if (
      error instanceof TrialApiError &&
      ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
    ) {
      this.readError(error);
      this.retire();
      return;
    }

    if (error instanceof ManagedSecCooldownError) {
      try {
        const deadline = this.access.recordCooldown(error, signal);

        this.update({
          showingPrevious: this.state.response !== null,
          message: managedSecCooldownMessage(
            deadline,
            this.state.response !== null,
          ),
        });

        return;
      } catch (invalid) {
        error = invalid;
      }
    }

    const previous = this.state.response !== null && isTransient(error);

    this.update({
      response: previous ? this.state.response : null,
      lastCheck: previous ? this.state.lastCheck : null,
      showingPrevious: previous,
      error: true,
      catalogChanged: error instanceof ManagedCatalogChangedError,
      message: failureMessage(error),
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

    const deadline = this.access.getNextAllowedAt();

    if (deadline) {
      this.update({
        showingPrevious: this.state.response !== null,
        error: false,
        message: managedSecCooldownMessage(
          deadline,
          this.state.response !== null,
        ),
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
      message: `Loading SEC filings for ${selection.listing.symbol}…`,
    });

    try {
      const response = await this.read(
        {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256: selection.catalogSnapshotSha256,
          listingId: selection.listing.listingId,
          symbol: selection.listing.symbol,
        },
        operation.signal,
      );

      if (current()) this.accept(response, selection);
    } catch (error) {
      if (current()) this.fail(error, operation.signal);
    } finally {
      if (current()) {
        this.operation = null;
        this.update({ running: false });
      }
    }
  }
}
