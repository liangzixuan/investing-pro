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
  compareManagedFilingsResponses,
  type ManagedFilingsRefreshComparison,
} from "./managed-filings-refresh-comparison";

import {
  ManagedSecAccess,
  managedSecCooldownMessage,
} from "./managed-sec-access";

export interface ManagedCompanyFilingsState {
  readonly selection: ManagedResearchSelection | null;

  readonly response: ManagedSecFilingsResponseDto | null;

  readonly responseOrigin: "request" | "watchlist" | null;

  readonly refreshComparison: ManagedFilingsRefreshComparison | null;

  readonly lastCheck: ManagedSecFilingsResponseDto | null;

  readonly showingPrevious: boolean;

  readonly running: boolean;

  readonly catalogChanged: boolean;

  readonly message: string;

  readonly error: boolean;
}

export interface ManagedCompanyFilingsSeed {
  readonly response: ManagedSecFilingsResponseDto;
  readonly showingPrevious: boolean;
}

function checkedResponse(
  selection: ManagedResearchSelection,
  response: ManagedSecFilingsResponseDto,
) {
  const checked = parseManagedSecFilingsResponse(response, {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: selection.catalogSnapshotSha256,
    listingId: selection.listing.listingId,
    symbol: selection.listing.symbol,
  });
  return checked &&
    membershipMatchesResult(
      { ...selection.listing, note: "" },
      checked.security,
    ) &&
    (selection.cik === null || checked.security.cik === selection.cik)
    ? checked
    : null;
}

/** A local handoff is independently decoded and never falls back to a request. */
export function captureManagedCompanyFilingsSeed(
  selection: ManagedResearchSelection,
  seed: ManagedCompanyFilingsSeed,
): ManagedCompanyFilingsSeed | null {
  try {
    if (
      selection.origin !== "watchlist" ||
      typeof seed.showingPrevious !== "boolean"
    )
      return null;
    const response = checkedResponse(selection, seed.response);
    return response
      ? Object.freeze({ response, showingPrevious: seed.showingPrevious })
      : null;
  } catch {
    return null;
  }
}

const empty = (): ManagedCompanyFilingsState => ({
  selection: null,
  response: null,
  responseOrigin: null,
  refreshComparison: null,
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

  private lifetime = Symbol();

  private retired = false;

  private readonly compareRefresh: boolean;

  constructor(
    private readonly read: ManagedApi["recentFilings"],

    private readonly readError: (error: TrialApiError) => void,

    private readonly access = new ManagedSecAccess(),

    options: { readonly compareRefresh?: boolean } = {},
  ) {
    this.compareRefresh = options.compareRefresh === true;
  }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(next: Partial<ManagedCompanyFilingsState>) {
    this.state = { ...this.state, ...next };

    for (const listener of this.listeners) listener();
  }

  open(selection: ManagedResearchSelection, seed?: ManagedCompanyFilingsSeed) {
    if (this.retired) return;
    const lifetime = this.closeVisit();
    if (this.retired || this.lifetime !== lifetime) return;
    const captured = Object.freeze({
      ...selection,
      listing: Object.freeze({ ...selection.listing }),
    });
    const admitted =
      seed === undefined
        ? null
        : captureManagedCompanyFilingsSeed(captured, seed);
    if (this.retired || this.lifetime !== lifetime) return;
    this.update({
      selection: seed !== undefined && admitted === null ? null : captured,
      response: admitted?.response ?? null,
      responseOrigin: admitted ? "watchlist" : null,
      lastCheck: admitted?.response ?? null,
      showingPrevious: admitted?.showingPrevious ?? false,
      error:
        seed !== undefined &&
        (admitted === null || admitted.response.issuer.status !== "available"),
      message: admitted
        ? admitted.response.issuer.status === "available"
          ? "The loaded watchlist filings are available in this company visit. Refresh explicitly to check again."
          : managedFilingsStatus(admitted.response.issuer.status)
        : seed !== undefined
          ? "The loaded watchlist filings could not be validated. Return to the watchlist and choose the company again."
          : "Load SEC filings from the last 90 days when you are ready.",
    });
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
    this.operation = null;
    operation.abort();
    if (this.lifetime !== lifetime || this.operation || this.retired) return;

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
    const checked = checkedResponse(selection, response);
    if (!checked) throw new TrialApiError("invalid_response");

    const previous =
      this.state.response !== null &&
      ["rate_limited", "upstream_unavailable"].includes(checked.issuer.status);

    this.update({
      response: previous ? this.state.response : checked,
      responseOrigin: previous ? this.state.responseOrigin : "request",
      refreshComparison: previous
        ? this.state.refreshComparison
        : this.compareRefresh
          ? compareManagedFilingsResponses(this.state.response, checked)
          : null,
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
      responseOrigin: previous ? this.state.responseOrigin : null,
      refreshComparison: previous ? this.state.refreshComparison : null,
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
      if (!current()) return;
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
