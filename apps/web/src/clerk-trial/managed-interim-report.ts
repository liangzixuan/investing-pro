import {
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  type PersonalSecInterimCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedInterimReportError,
  ManagedSecCooldownError,
  type ManagedApi,
} from "./managed-api";
import {
  isOwnedSecInterimCanonicalResponse,
  parseSecInterimCanonicalResponse,
} from "../lib/sec-interim-canonical-response";
import {
  getManagedInterimView,
  type ManagedInterimView,
} from "./managed-interim-view";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  MANAGED_RESEARCH_COVERAGE,
  getManagedResearchCoverageCik,
  type ManagedResearchCoverage,
} from "./managed-research-eligibility";
import {
  hasManagedInterimCoverage,
  MANAGED_INTERIM_ISSUERS,
} from "./managed-interim-coverage";
import {
  ManagedSecAccess,
  managedSecCooldownMessage,
} from "./managed-sec-access";
export interface ManagedInterimReportState {
  readonly selection: ManagedResearchSelection | null;
  readonly supported: boolean;
  readonly response: PersonalSecInterimCanonicalResponseDto | null;
  readonly view: ManagedInterimView | null;
  readonly responseOrigin: "request" | null;
  readonly showingPrevious: boolean;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
const empty = (): ManagedInterimReportState => ({
  selection: null,
  supported: false,
  response: null,
  view: null,
  responseOrigin: null,
  showingPrevious: false,
  running: false,
  catalogChanged: false,
  message: "",
  error: false,
});
function matches(
  response: PersonalSecInterimCanonicalResponseDto,
  selection: ManagedResearchSelection,
  knownCik: string | null,
) {
  const s = response.security,
    l = selection.listing;
  if (knownCik === null || s.cik !== knownCik) return false;
  if (response.catalogSnapshotSha256 !== selection.catalogSnapshotSha256)
    return false;
  if (selection.cik !== null && s.cik !== selection.cik) return false;
  return (
    [
      "listingId",
      "symbol",
      "issuerId",
      "issuerName",
      "securityName",
      "country",
      "exchangeMic",
    ] as const
  ).every((key) => s[key] === l[key]);
}
function failureMessage(error: unknown, previous: boolean) {
  if (error instanceof ManagedCatalogChangedError)
    return "The catalog changed. Refresh it and choose the company again.";
  if (error instanceof TrialApiError && error.code === "invalid_response")
    return "The interim report could not be validated. No interim response was retained.";
  if (
    error instanceof ManagedInterimReportError &&
    error.code === "not_configured"
  )
    return "Interim reports are not configured on the service yet.";
  if (previous)
    return "The interim refresh failed. The previous report and its original source clocks remain; refresh explicitly when ready.";
  return "The interim report could not be loaded. Try again when ready.";
}
function authenticationFailure(error: unknown): error is TrialApiError {
  return (
    error instanceof TrialApiError &&
    ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
  );
}
function mayRetain(error: unknown) {
  return (
    (error instanceof ManagedInterimReportError &&
      error.code === "request_timeout") ||
    (error instanceof TrialApiError && error.code === "unavailable")
  );
}
/** A separate explicit CompanyFacts-only interim read; never loads or saves a resource. */
export class ManagedInterimReport {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private lifetime = Symbol();
  private retired = false;
  private readonly coverage: ManagedResearchCoverage;
  private readonly issuers: readonly string[];
  constructor(
    private readonly loadReport: ManagedApi["interimReport"],
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedSecAccess(),
    options: {
      readonly coverage?: ManagedResearchCoverage;
      readonly interimIssuers?: readonly string[];
    } = {},
  ) {
    this.coverage = options.coverage ?? MANAGED_RESEARCH_COVERAGE;
    this.issuers = Object.freeze([
      ...(options.interimIssuers ?? MANAGED_INTERIM_ISSUERS),
    ]);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  hasCoverage(selection: ManagedResearchSelection) {
    return hasManagedInterimCoverage(selection, this.coverage, this.issuers);
  }
  private update(next: Partial<ManagedInterimReportState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  open(selection: ManagedResearchSelection) {
    if (this.retired) return;
    const lifetime = this.closeVisit();
    if (this.retired || this.lifetime !== lifetime) return;
    const captured = Object.freeze({
      ...selection,
      listing: Object.freeze({ ...selection.listing }),
    });
    const supported = this.hasCoverage(captured);
    this.update({
      selection: captured,
      supported,
      message: supported
        ? "Load the latest observed 10-Q in the admitted submissions window when ready."
        : "Interim report reads are not admitted for this exact listing in this workspace.",
    });
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
  close() {
    this.closeVisit();
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
    if (this.retired || this.lifetime !== lifetime || this.operation !== null)
      return;
    this.update({
      running: false,
      showingPrevious: this.state.response !== null,
      error: false,
      message: this.state.response
        ? "Interim refresh cancelled. The previous report keeps its original clocks."
        : "Interim load cancelled. Load again when ready.",
    });
  }
  private readySelection() {
    if (this.retired || this.operation) return null;
    if (!this.state.supported || this.state.catalogChanged) return null;
    return this.state.selection;
  }
  private coolingDown() {
    const deadline = this.access.getNextAllowedAt();
    if (!deadline) return false;
    this.update({
      showingPrevious: this.state.response !== null,
      error: false,
      message: managedSecCooldownMessage(
        deadline,
        this.state.response !== null,
      ),
    });
    return true;
  }
  async load() {
    const selection = this.readySelection();
    if (!selection) return;
    if (this.coolingDown()) return;
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
        ? "Refreshing the interim report…"
        : "Loading the observed interim report…",
    });
    try {
      await this.read(selection, operation, current);
    } catch (error) {
      if (current()) this.failed(error, operation);
    } finally {
      if (current()) {
        this.operation = null;
        this.update({ running: false });
      }
    }
  }
  private async read(
    selection: ManagedResearchSelection,
    operation: AbortController,
    current: () => boolean,
  ) {
    if (!current()) return;
    const request = {
      schemaVersion: PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
      catalogSnapshotSha256: selection.catalogSnapshotSha256,
      listingId: selection.listing.listingId,
      symbol: selection.listing.symbol,
    };
    const candidate = await this.loadReport(request, operation.signal);
    if (!current()) return;
    const response = isOwnedSecInterimCanonicalResponse(candidate)
      ? candidate
      : await parseSecInterimCanonicalResponse(
          candidate,
          request,
          operation.signal,
        );
    if (!current()) return;
    if (
      !response ||
      !matches(
        response,
        selection,
        getManagedResearchCoverageCik(selection, this.coverage),
      )
    )
      throw new TrialApiError("invalid_response");
    const view = getManagedInterimView(response);
    if (!view) throw new TrialApiError("invalid_response");
    if (!current()) return;
    this.update({
      response,
      view,
      responseOrigin: "request",
      showingPrevious: false,
      error: false,
      message:
        "Interim report loaded. Original source clocks and exact reported periods are retained. Refresh explicitly to check again.",
    });
  }
  private failed(error: unknown, operation: AbortController) {
    if (authenticationFailure(error)) {
      this.readError(error);
      this.retire();
      return;
    }
    if (error instanceof ManagedSecCooldownError) {
      this.cooldown(error, operation);
      return;
    }
    const previous = this.state.response !== null && mayRetain(error);
    this.update({
      ...(previous ? {} : { response: null, view: null, responseOrigin: null }),
      showingPrevious: previous,
      error: true,
      catalogChanged: error instanceof ManagedCatalogChangedError,
      message: failureMessage(error, previous),
    });
  }
  private cooldown(error: ManagedSecCooldownError, operation: AbortController) {
    try {
      const deadline = this.access.recordCooldown(error, operation.signal);
      this.update({
        showingPrevious: this.state.response !== null,
        error: false,
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
        message: failureMessage(new TrialApiError("invalid_response"), false),
      });
    }
  }
}
