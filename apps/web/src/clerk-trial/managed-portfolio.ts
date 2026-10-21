import {
  MANAGED_PORTFOLIO_LIMITS,
  parseManagedCatalogResolveResponse,
  parseManagedPortfolio,
  parseManagedPortfolioCommand,
  parseManagedPortfolioReceipt,
  parsePortfolioPayload,
  projectPersonalPortfolioLedger,
  type ManagedCatalogSnapshotDto,
  type ManagedPortfolioPayload,
  type PersonalPortfolioIdentity,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import {
  SaveCoordinator,
  type SaveState,
  type VersionedPayload,
} from "./save-coordinator";
import { MANAGED_PORTFOLIO_SAVE_COPY } from "./save-coordinator-copy";
import type { TrialSession } from "./session";

/** Null ledger is loaded-but-uninitialized; a null coordinator draft is not loaded. */
export interface PortfolioDraft {
  readonly ledger: ManagedPortfolioPayload | null;
}
export interface PortfolioDraftFileContext {
  readonly saved: VersionedPayload<PortfolioDraft>;
  readonly draft: PortfolioDraft;
  readonly baseVersion: number;
  readonly catalog: ManagedCatalogSnapshotDto | null;
}
export interface PortfolioIdentityReview {
  readonly previous: PersonalPortfolioIdentity;
  readonly listing: PersonalPortfolioIdentity | null;
  readonly status: "current" | "update" | "missing" | "rebound";
}
export interface PortfolioCatalogReview {
  readonly draft: PortfolioDraft;
  readonly snapshotSha256: string;
  readonly entries: readonly PortfolioIdentityReview[];
}
export interface ManagedPortfolioState {
  readonly catalogSnapshotSha256: string | null;
  readonly pendingEditor: boolean;
  readonly reviewing: boolean;
  readonly review: PortfolioCatalogReview | null;
  readonly message: string;
}
type IdentityApproval = Readonly<{
  snapshotSha256: string;
  identities: readonly PersonalPortfolioIdentity[];
}>;

function sameStableIdentity(
  a: PersonalPortfolioIdentity,
  b: PersonalPortfolioIdentity,
) {
  return (
    a.listingId === b.listingId &&
    a.issuerId === b.issuerId &&
    a.securityId === b.securityId &&
    a.shareClassId === b.shareClassId &&
    a.exchangeMic === b.exchangeMic &&
    a.country === b.country &&
    a.instrumentType === b.instrumentType
  );
}
function sameIdentity(
  a: PersonalPortfolioIdentity,
  b: PersonalPortfolioIdentity,
) {
  return (
    sameStableIdentity(a, b) &&
    a.issuerName === b.issuerName &&
    a.securityName === b.securityName &&
    a.shareClassName === b.shareClassName &&
    a.symbol === b.symbol
  );
}
function sameRegistry(
  a: readonly PersonalPortfolioIdentity[],
  b: readonly PersonalPortfolioIdentity[],
) {
  return (
    a.length === b.length &&
    a.every((listing, index) => sameIdentity(listing, b[index]!))
  );
}
function copyDraft(payload: PortfolioDraft): PortfolioDraft {
  if (payload.ledger === null) return Object.freeze({ ledger: null });
  const ledger = parsePortfolioPayload(payload.ledger);
  if (!ledger) throw new TypeError("Invalid portfolio draft");
  return Object.freeze({ ledger });
}
function utcDay(clock: Date): string | null {
  if (!Number.isFinite(clock.getTime())) return null;
  const day = clock.toISOString().slice(0, 10);
  return /^[1-9]\d{3}-\d{2}-\d{2}$/u.test(day) ? day : null;
}

/** Authored ledger state; source reads and other saved resources remain independent. */
export class ManagedPortfolio {
  readonly coordinator: SaveCoordinator<PortfolioDraft>;
  readonly sessionResource: Pick<
    SaveCoordinator<PortfolioDraft>,
    "getSnapshot" | "subscribe" | "retire"
  >;
  private resourceState: SaveState<PortfolioDraft>;
  private state: Readonly<ManagedPortfolioState>;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => Date;
  private retired = false;
  private retireNotified = false;
  private operation: AbortController | null = null;
  private observedDraft: PortfolioDraft | null = null;
  private approval: IdentityApproval | null = null;

  constructor(
    private readonly api: Pick<
      ManagedApi,
      "loadPortfolio" | "savePortfolio" | "resolve"
    >,
    session: TrialSession,
    private readonly options: {
      getCatalogSnapshot(): ManagedCatalogSnapshotDto | null;
      onRetire(): void;
      newKey?: () => string;
      now?: () => Date;
    },
  ) {
    this.now = options.now ?? (() => new Date());
    this.state = Object.freeze({
      catalogSnapshotSha256:
        options.getCatalogSnapshot()?.snapshotSha256 ?? null,
      pendingEditor: false,
      reviewing: false,
      review: null,
      message: "",
    });
    this.coordinator = new SaveCoordinator<PortfolioDraft>(
      {
        mode: "managed",
        empty: () => null,
        copy: copyDraft,
        capture: (draft) => this.capture(draft),
        load: async (signal) => {
          if (this.retired || signal.aborted)
            throw new TrialApiError("aborted");
          if (this.state.pendingEditor)
            throw new TrialApiError("invalid_request");
          const result = parseManagedPortfolio(await api.loadPortfolio(signal));
          if (!result) throw new TrialApiError("invalid_response");
          return {
            version: result.version,
            payload: copyDraft({ ledger: result.payload }),
          };
        },
        save: async (captured, signal) => {
          if (this.retired || signal.aborted)
            throw new TrialApiError("aborted");
          // Reconcile the original command even after the current catalog or UTC day changes.
          const command = parseManagedPortfolioCommand({
            ...captured,
            payload: captured.payload.ledger,
          });
          if (!command) throw new TrialApiError("invalid_request");
          const result = parseManagedPortfolioReceipt(
            await api.savePortfolio(command, signal),
            command,
          );
          if (!result) throw new TrialApiError("invalid_response");
          return {
            version: result.version,
            payload: copyDraft({ ledger: result.payload }),
            replayed: result.replayed,
          };
        },
      },
      session,
      MANAGED_PORTFOLIO_SAVE_COPY,
      {
        ...(options.newKey ? { newKey: options.newKey } : {}),
        onRetire: () => {
          this.close();
          if (!this.retireNotified) {
            this.retireNotified = true;
            try {
              options.onRetire();
            } finally {
              this.notify();
            }
          }
        },
      },
    );
    this.resourceState = this.resourceSnapshot();
    this.sessionResource = Object.freeze({
      getSnapshot: () => this.resourceState,
      subscribe: this.subscribe,
      retire: (message?: string) => this.retire(message),
    });
    this.coordinator.subscribe(() => {
      const state = this.coordinator.getSnapshot();
      const changed = state.draft !== this.observedDraft;
      this.observedDraft = state.draft;
      if (this.retired) return;
      if (changed || state.phase !== "idle") this.clearReview();
      if (changed)
        this.state = Object.freeze({ ...this.state, pendingEditor: false });
      if (
        state.draft?.ledger &&
        this.approval &&
        !sameRegistry(state.draft.ledger.identities, this.approval.identities)
      )
        this.approval = null;
      this.update({});
    });
  }

  getSnapshot = (): Readonly<ManagedPortfolioState> => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private notify() {
    this.resourceState = this.resourceSnapshot();
    for (const listener of this.listeners) listener();
  }
  private resourceSnapshot(): SaveState<PortfolioDraft> {
    const state = this.coordinator.getSnapshot();
    return Object.freeze({
      ...state,
      dirty: state.dirty || this.state.pendingEditor,
    });
  }
  setPendingEditor(capturedDraft: PortfolioDraft, pending: boolean) {
    if (
      !this.canEdit() ||
      this.coordinator.getSnapshot().draft !== capturedDraft ||
      this.state.pendingEditor === pending
    )
      return;
    if (pending) this.clearReview();
    this.update({
      pendingEditor: pending,
      message: pending
        ? "Apply or reset the portfolio form before saving or leaving."
        : "",
    });
  }
  private update(next: Partial<ManagedPortfolioState>) {
    this.state = Object.freeze({ ...this.state, ...next });
    this.notify();
  }
  private clearReview() {
    const operation = this.operation;
    this.operation = null;
    this.state = Object.freeze({
      ...this.state,
      reviewing: false,
      review: null,
    });
    operation?.abort();
  }
  cancelReview() {
    if (this.retired) return;
    this.clearReview();
    this.update({
      message: "Identity check cancelled. Your draft is unchanged.",
    });
  }
  private close() {
    if (this.retired) return;
    this.retired = true;
    this.approval = null;
    this.clearReview();
    this.state = Object.freeze({
      catalogSnapshotSha256: null,
      pendingEditor: false,
      reviewing: false,
      review: null,
      message: "",
    });
  }
  retire(message?: string) {
    if (!this.retired) this.coordinator.retire(message);
  }
  syncCatalog() {
    if (this.retired) return;
    const digest = this.options.getCatalogSnapshot()?.snapshotSha256 ?? null;
    if (digest === this.state.catalogSnapshotSha256) return;
    this.approval = null;
    this.clearReview();
    this.update({ catalogSnapshotSha256: digest, message: "" });
  }
  canEdit() {
    const state = this.coordinator.getSnapshot();
    return (
      !this.retired &&
      this.coordinator.canEdit() &&
      state.draft !== null &&
      !state.conflict &&
      !state.uncertain &&
      !state.replayPending
    );
  }
  getDraftFileContext(requireFresh = true): PortfolioDraftFileContext | null {
    const state = this.coordinator.getSnapshot();
    const catalog = this.options.getCatalogSnapshot();
    if (
      !this.canEdit() ||
      this.state.pendingEditor ||
      this.operation ||
      this.state.review ||
      !state.saved ||
      !state.draft ||
      state.baseVersion === null ||
      (catalog?.snapshotSha256 ?? null) !== this.state.catalogSnapshotSha256
    )
      return null;
    if (
      requireFresh &&
      (!catalog ||
        !state.latestLoaded ||
        state.baseVersion !== state.saved.version)
    )
      return null;
    return {
      saved: state.saved,
      draft: state.draft,
      baseVersion: state.baseVersion,
      catalog,
    };
  }
  /** A file supplies a local ledger, never a save base or identity approval. */
  restoreFileDraft(
    captured: PortfolioDraftFileContext,
    value: ManagedPortfolioPayload,
  ) {
    const ledger = parsePortfolioPayload(value);
    const current = this.getDraftFileContext();
    if (
      !ledger ||
      !current ||
      current.saved !== captured.saved ||
      current.draft !== captured.draft ||
      current.baseVersion !== captured.baseVersion ||
      current.catalog !== captured.catalog
    )
      return false;
    this.approval = null;
    this.coordinator.replaceDraft({ ledger });
    return !this.retired;
  }
  getProjection() {
    const ledger = this.coordinator.getSnapshot().draft?.ledger;
    return this.retired || !ledger
      ? null
      : projectPersonalPortfolioLedger(ledger);
  }
  private identitiesApproved(ledger: ManagedPortfolioPayload, digest: string) {
    return (
      ledger.snapshotSha256 === digest &&
      (ledger.identities.length === 0 ||
        (this.approval?.snapshotSha256 === digest &&
          sameRegistry(ledger.identities, this.approval.identities)))
    );
  }
  private capture(draft: PortfolioDraft): PortfolioDraft | null {
    try {
      const snapshot = this.options.getCatalogSnapshot();
      const day = utcDay(this.now());
      const ledger = parsePortfolioPayload(draft.ledger);
      if (
        !snapshot ||
        !day ||
        !ledger ||
        this.state.pendingEditor ||
        this.operation ||
        projectPersonalPortfolioLedger(ledger, day).status !== "valid" ||
        !this.identitiesApproved(ledger, snapshot.snapshotSha256)
      )
        return null;
      if (
        this.options.getCatalogSnapshot() !== snapshot ||
        !this.canEdit() ||
        this.coordinator.getSnapshot().draft !== draft ||
        this.state.catalogSnapshotSha256 !== snapshot.snapshotSha256
      )
        return null;
      return Object.freeze({ ledger });
    } catch {
      return null;
    }
  }
  canSavePayload() {
    const draft = this.coordinator.getSnapshot().draft;
    return draft !== null && this.capture(draft) !== null;
  }
  start(openingDate: string, cashUsd: string | null) {
    const state = this.coordinator.getSnapshot();
    const snapshot = this.options.getCatalogSnapshot();
    if (
      !this.canEdit() ||
      !snapshot ||
      state.baseVersion !== 0 ||
      state.saved?.version !== 0 ||
      state.draft?.ledger !== null
    )
      return;
    const day = utcDay(this.now());
    const ledger = parsePortfolioPayload({
      schemaVersion: 3,
      name: "My Portfolio",
      currency: "USD",
      snapshotSha256: snapshot.snapshotSha256,
      basisMethod: "fifo_with_opening_pool",
      identities: [],
      opening: { asOfDate: openingDate, cashUsd, holdings: [] },
      transactions: [],
    });
    if (
      !ledger ||
      !day ||
      projectPersonalPortfolioLedger(ledger, day).status !== "valid"
    )
      return;
    if (
      this.options.getCatalogSnapshot() !== snapshot ||
      !this.canEdit() ||
      this.coordinator.getSnapshot().draft !== state.draft ||
      this.state.catalogSnapshotSha256 !== snapshot.snapshotSha256
    )
      return;
    this.coordinator.replaceDraft({ ledger });
  }
  replace(capturedDraft: PortfolioDraft, value: ManagedPortfolioPayload) {
    if (
      !this.canEdit() ||
      this.coordinator.getSnapshot().draft !== capturedDraft ||
      capturedDraft.ledger === null
    )
      return;
    const ledger = parsePortfolioPayload(value);
    if (!ledger) return;
    this.coordinator.replaceDraft({ ledger });
  }
  private reviewCurrent(
    operation: AbortController,
    draft: PortfolioDraft,
    snapshot: ManagedCatalogSnapshotDto,
  ) {
    const current = this.options.getCatalogSnapshot();
    return (
      current === snapshot &&
      current.snapshotSha256 === this.state.catalogSnapshotSha256 &&
      this.canEdit() &&
      this.operation === operation &&
      !operation.signal.aborted &&
      this.coordinator.getSnapshot().draft === draft
    );
  }
  private reviewError(error: unknown) {
    if (
      error instanceof TrialApiError &&
      ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
    )
      this.coordinator.readError(error);
    else
      this.update({
        review: null,
        message: "Identity check could not finish. Your draft is unchanged.",
      });
  }
  private finishReview(operation: AbortController) {
    if (this.operation !== operation) return;
    this.operation = null;
    this.update({ reviewing: false });
  }
  async register(listing: PersonalPortfolioIdentity) {
    const draft = this.coordinator.getSnapshot().draft;
    const snapshot = this.options.getCatalogSnapshot();
    if (
      !this.canEdit() ||
      !draft?.ledger ||
      !snapshot ||
      this.operation ||
      this.state.pendingEditor ||
      draft.ledger.identities.length >= MANAGED_PORTFOLIO_LIMITS.identities ||
      draft.ledger.identities.some(
        (entry) => entry.listingId === listing.listingId,
      )
    )
      return;
    const candidate = parsePortfolioPayload({
      ...draft.ledger,
      identities: [...draft.ledger.identities, listing],
    });
    if (!candidate) return;
    const capturedListing = candidate.identities.at(-1)!;
    const operation = new AbortController();
    this.operation = operation;
    this.update({ reviewing: true, review: null, message: "" });
    const request = {
      snapshotSha256: snapshot.snapshotSha256,
      listingIds: [capturedListing.listingId],
    };
    try {
      if (!this.reviewCurrent(operation, draft, snapshot)) return;
      const response = await this.api.resolve(request, operation.signal);
      if (!this.reviewCurrent(operation, draft, snapshot)) return;
      const result = parseManagedCatalogResolveResponse(response, request);
      if (!result) throw new TrialApiError("invalid_response");
      if (!this.reviewCurrent(operation, draft, snapshot)) return;
      const current = result.results[0]!.listing;
      if (!current || !sameIdentity(capturedListing, current)) {
        this.update({
          message:
            "This listing no longer matches the selected catalog identity. Your draft is unchanged.",
        });
        return;
      }
      if (this.identitiesApproved(draft.ledger, snapshot.snapshotSha256))
        this.approval = Object.freeze({
          snapshotSha256: snapshot.snapshotSha256,
          identities: candidate.identities,
        });
      else this.approval = null;
      this.coordinator.replaceDraft({ ledger: candidate });
    } catch (error) {
      if (this.reviewCurrent(operation, draft, snapshot))
        this.reviewError(error);
    } finally {
      this.finishReview(operation);
    }
  }
  async reviewCatalog() {
    const draft = this.coordinator.getSnapshot().draft;
    const snapshot = this.options.getCatalogSnapshot();
    if (
      !this.canEdit() ||
      !draft?.ledger ||
      !snapshot ||
      this.operation ||
      this.state.pendingEditor
    )
      return;
    const operation = new AbortController();
    this.operation = operation;
    this.update({ reviewing: true, review: null, message: "" });
    const request = {
      snapshotSha256: snapshot.snapshotSha256,
      listingIds: draft.ledger.identities.map((entry) => entry.listingId),
    };
    try {
      if (!this.reviewCurrent(operation, draft, snapshot)) return;
      const response = request.listingIds.length
        ? await this.api.resolve(request, operation.signal)
        : { snapshotSha256: snapshot.snapshotSha256, results: [] };
      if (!this.reviewCurrent(operation, draft, snapshot)) return;
      const result = request.listingIds.length
        ? parseManagedCatalogResolveResponse(response, request)
        : response;
      if (!result) throw new TrialApiError("invalid_response");
      if (!this.reviewCurrent(operation, draft, snapshot)) return;
      const entries = result.results.map(
        ({ listing }, index): PortfolioIdentityReview => {
          const previous = draft.ledger!.identities[index]!;
          const status =
            listing === null
              ? "missing"
              : !sameStableIdentity(previous, listing)
                ? "rebound"
                : draft.ledger!.snapshotSha256 === snapshot.snapshotSha256 &&
                    sameIdentity(previous, listing)
                  ? "current"
                  : "update";
          return Object.freeze({ previous, listing, status });
        },
      );
      this.update({
        review: Object.freeze({
          draft,
          snapshotSha256: snapshot.snapshotSha256,
          entries: Object.freeze(entries),
        }),
      });
    } catch (error) {
      if (this.reviewCurrent(operation, draft, snapshot))
        this.reviewError(error);
    } finally {
      this.finishReview(operation);
    }
  }
  applyReview() {
    const review = this.state.review;
    const snapshot = this.options.getCatalogSnapshot();
    if (
      !this.canEdit() ||
      this.operation ||
      this.state.pendingEditor ||
      !review ||
      !snapshot ||
      this.coordinator.getSnapshot().draft !== review.draft ||
      snapshot.snapshotSha256 !== review.snapshotSha256 ||
      this.state.catalogSnapshotSha256 !== review.snapshotSha256 ||
      review.entries.some(
        (entry) =>
          entry.listing === null ||
          entry.status === "missing" ||
          entry.status === "rebound",
      )
    )
      return;
    const ledger = parsePortfolioPayload({
      ...review.draft.ledger,
      snapshotSha256: review.snapshotSha256,
      identities: review.entries.map((entry) => entry.listing),
    });
    if (!ledger) return;
    this.approval = Object.freeze({
      snapshotSha256: review.snapshotSha256,
      identities: ledger.identities,
    });
    this.coordinator.replaceDraft({ ledger });
    if (!this.retired)
      this.update({
        message:
          "Portfolio identities reviewed in this draft. Save Portfolio to keep the changes.",
      });
  }
}
