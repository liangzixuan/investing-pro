import {
  membershipMatchesResult,
  parseManagedCatalogResolveResponse,
  parseManagedValuationAssumptions,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  parseValuationAssumptionEntry,
  parseValuationAssumptionsPayload,
  type ManagedCatalogSnapshotDto,
  type ValuationAssumptionEntry,
  type ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { getManagedResearchCoverageCik } from "./managed-research-eligibility";
import type {
  ManagedValuationInputCapture,
  ManagedValuationSnapshot,
  ManagedValuationWorkbench,
} from "./managed-valuation-workbench";
import {
  SaveCoordinator,
  type SaveCopyProfile,
  type SaveCommand,
  type SaveState,
  type VersionedPayload,
} from "./save-coordinator";
import type { TrialSession } from "./session";

type Entry = ValuationAssumptionEntry;
type Payload = ValuationAssumptionsPayload;
type Listing = Entry["listing"];
function immutableConfirmedData<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(immutableConfirmedData);
    Object.freeze(value);
  }
  return value;
}

export interface ManagedConfirmedValuationCapture {
  readonly entry: Entry;
  readonly saved: VersionedPayload<Payload>;
  readonly catalog: ManagedCatalogSnapshotDto;
}

export interface ValuationCollectionDraftContext {
  readonly saved: VersionedPayload<Payload>;
  readonly draft: Payload;
  readonly baseVersion: number;
  readonly save: SaveState<Payload>;
  readonly editorFileRevision: object;
  readonly catalog: ManagedCatalogSnapshotDto;
}
export interface ValuationStageReview {
  readonly capture: ManagedValuationInputCapture;
  readonly previous: Entry | null;
  readonly payload: Payload;
  readonly draft: Payload;
  readonly catalog: ManagedCatalogSnapshotDto;
}
export interface ValuationRestoreReview {
  readonly entry: Entry;
  readonly current: ManagedValuationSnapshot;
  readonly saved: VersionedPayload<Payload>;
  readonly catalog: ManagedCatalogSnapshotDto;
}
export interface ValuationCatalogReview {
  readonly draft: Payload;
  readonly catalog: ManagedCatalogSnapshotDto;
  readonly entries: readonly Readonly<{
    previous: Entry;
    entry: Entry | null;
    status: "current" | "update" | "missing" | "rebound" | "issuer_mismatch";
  }>[];
}
export interface ManagedValuationAssumptionsState {
  readonly catalogSnapshotSha256: string | null;
  readonly reviewing: boolean;
  readonly stageReview: ValuationStageReview | null;
  readonly restoreReview: ValuationRestoreReview | null;
  readonly catalogReview: ValuationCatalogReview | null;
  readonly message: string;
}
const SAVE_COPY: Readonly<SaveCopyProfile> = Object.freeze({
  loadPrompt: "Load saved valuation assumptions to begin.",
  retired: "This session has ended. Local saved assumptions have been cleared.",
  signedOut: "Signed out. Local saved assumptions have been cleared.",
  signOutFailed:
    "Local assumptions have been cleared. Sign-out could not be confirmed.",
  invalidDraft:
    "Review the complete assumptions and their catalog identities before saving.",
  saveRejected: "The save was rejected. Your assumptions draft is unchanged.",
  accessDenied:
    "This session cannot access saved assumptions. Local data has been cleared.",
  loadFailed: "Saved assumptions could not be loaded. Your draft is unchanged.",
});
const stableKeys = [
  "listingId",
  "issuerId",
  "securityId",
  "shareClassId",
  "exchangeMic",
  "country",
  "instrumentType",
] as const;
function sameStableIdentity(left: Listing, right: Listing): boolean {
  return stableKeys.every((key) => left[key] === right[key]);
}
function sameListing(left: Listing, right: Listing): boolean {
  return membershipMatchesResult({ ...left, note: "" }, right);
}
function sameStableEntry(left: Entry, right: Entry): boolean {
  if (!sameStableIdentity(left.listing, right.listing)) return false;
  if (left.cik === null || right.cik === null) return true;
  return left.cik === right.cik;
}
function sameMetadata(left: Entry, right: Entry): boolean {
  if (left.catalogSnapshotSha256 !== right.catalogSnapshotSha256) return false;
  if (left.cik !== right.cik) return false;
  return sameListing(left.listing, right.listing);
}
function copyPayload(value: Payload): Payload {
  const payload = parseValuationAssumptionsPayload(value);
  if (!payload) throw new TypeError("Invalid valuation assumptions");
  return payload;
}
function knownIssuerMatches(entry: Entry): boolean {
  if (entry.cik === null) return true;
  const known = getManagedResearchCoverageCik({
    catalogSnapshotSha256: entry.catalogSnapshotSha256,
    listing: entry.listing,
    cik: entry.cik,
    origin: "route",
  });
  return known === null || known === entry.cik;
}
function matchesContext(
  entry: Entry,
  current: ManagedValuationSnapshot,
): boolean {
  const context = current.context;
  if (!context || current.retired) return false;
  if (entry.catalogSnapshotSha256 !== context.catalogSnapshotSha256)
    return false;
  if (!sameListing(entry.listing, context.listing)) return false;
  if (entry.cik !== null && context.cik !== null) {
    if (entry.cik !== context.cik) return false;
  }
  return knownIssuerMatches(entry);
}
function upsert(draft: Payload, entry: Entry): Payload | null {
  const index = draft.entries.findIndex(
    (item) => item.listing.listingId === entry.listing.listingId,
  );
  const entries = [...draft.entries];
  if (index < 0) entries.push(entry);
  else entries[index] = entry;
  return parseValuationAssumptionsPayload({ schemaVersion: 1, entries });
}
function catalogEntry(
  previous: Entry,
  listing: Listing | null,
  catalog: ManagedCatalogSnapshotDto,
): ValuationCatalogReview["entries"][number] {
  if (!listing)
    return Object.freeze({ previous, entry: null, status: "missing" });
  if (!sameStableIdentity(previous.listing, listing))
    return Object.freeze({ previous, entry: null, status: "rebound" });
  const entry = parseValuationAssumptionEntry({
    ...previous,
    listing,
    catalogSnapshotSha256: catalog.snapshotSha256,
  });
  if (!entry || !knownIssuerMatches(entry))
    return Object.freeze({ previous, entry: null, status: "issuer_mismatch" });
  return Object.freeze({
    previous,
    entry,
    status: sameMetadata(previous, entry) ? "current" : "update",
  });
}

function stageResponseMatches(
  value: unknown,
  request: Parameters<ManagedApi["resolve"]>[0],
  entry: Entry,
): boolean {
  const resolved = parseManagedCatalogResolveResponse(value, request);
  if (!resolved) return false;
  const listing = resolved.results[0]?.listing;
  if (!listing) return false;
  return sameListing(entry.listing, listing);
}
function catalogReviewFromResponse(
  value: unknown,
  request: Parameters<ManagedApi["resolve"]>[0],
  draft: Payload,
  catalog: ManagedCatalogSnapshotDto,
): ValuationCatalogReview {
  const result = parseManagedCatalogResolveResponse(value, request);
  if (!result) throw new TrialApiError("invalid_response");
  const entries = Object.freeze(
    result.results.map((row, index) =>
      catalogEntry(draft.entries[index]!, row.listing, catalog),
    ),
  );
  return Object.freeze({ draft, catalog, entries });
}

/** Explicit authored-input persistence; source reads and calculation stay independent. */
export class ManagedValuationAssumptions {
  readonly coordinator: SaveCoordinator<Payload>;
  readonly sessionResource: Pick<
    SaveCoordinator<Payload>,
    "getSnapshot" | "subscribe" | "retire"
  >;
  private readonly listeners = new Set<() => void>();
  private readonly approvals = new Map<string, Entry>();
  private state: Readonly<ManagedValuationAssumptionsState>;
  private resourceState: SaveState<Payload>;
  private retired = false;
  private operation: AbortController | null = null;
  private transition = {};
  private observedDraft: Payload | null = null;
  private stagedCapture: ManagedValuationInputCapture | null = null;
  private confirmedRevision = {};
  private readonly confirmedCaptures = new WeakMap<
    ManagedConfirmedValuationCapture,
    {
      entry: Entry;
      saved: VersionedPayload<Payload>;
      catalog: ManagedCatalogSnapshotDto;
      revision: object;
      editorFile: object;
      collectionFile: object;
    }
  >();
  private readonly collectionActivities = new Set<object>();
  private collectionFileActivityRevision = {};
  private readonly fileContexts =
    new WeakSet<ValuationCollectionDraftContext>();
  private fileRestore: { draft: Payload | null } | null = null;

  constructor(
    private readonly api: Pick<
      ManagedApi,
      "loadValuationAssumptions" | "saveValuationAssumptions" | "resolve"
    >,
    session: TrialSession,
    private readonly workbench: ManagedValuationWorkbench,
    private readonly options: {
      getCatalogSnapshot(): ManagedCatalogSnapshotDto | null;
      onRetire(): void;
      newKey?: () => string;
    },
  ) {
    this.state = Object.freeze({
      catalogSnapshotSha256:
        options.getCatalogSnapshot()?.snapshotSha256 ?? null,
      reviewing: false,
      stageReview: null,
      restoreReview: null,
      catalogReview: null,
      message: "",
    });
    this.coordinator = new SaveCoordinator<Payload>(
      {
        mode: "managed",
        empty: () => null,
        copy: copyPayload,
        capture: (draft) => this.captureDraft(draft),
        load: (signal) => this.loadSaved(signal),
        save: (input, signal) => this.saveCaptured(input, signal),
      },
      session,
      SAVE_COPY,
      {
        ...(options.newKey ? { newKey: options.newKey } : {}),
        onRetire: () => this.close(),
      },
    );
    this.resourceState = this.resourceSnapshot();
    this.sessionResource = Object.freeze({
      getSnapshot: () => this.resourceState,
      subscribe: this.subscribe,
      retire: (message?: string) => this.retire(message),
    });
    this.coordinator.subscribe(() => this.resourceChanged());
    this.workbench.subscribe(() => this.editorChanged());
  }
  getSnapshot = (): Readonly<ManagedValuationAssumptionsState> => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private async loadSaved(signal: AbortSignal) {
    this.assertActive(signal);
    const result = parseManagedValuationAssumptions(
      await this.api.loadValuationAssumptions(signal),
    );
    if (!result) throw new TrialApiError("invalid_response");
    return result;
  }
  private async saveCaptured(input: SaveCommand<Payload>, signal: AbortSignal) {
    this.assertActive(signal);
    const command = parseManagedValuationAssumptionsCommand(input);
    if (!command) throw new TrialApiError("invalid_request");
    const result = parseManagedValuationAssumptionsReceipt(
      await this.api.saveValuationAssumptions(command, signal),
      command,
    );
    this.assertActive(signal);
    if (!result) throw new TrialApiError("invalid_response");
    this.acknowledge(command.payload);
    return result;
  }
  private assertActive(signal: AbortSignal): void {
    if (this.retired || signal.aborted) throw new TrialApiError("aborted");
  }
  private resourceSnapshot(): SaveState<Payload> {
    const state = this.coordinator.getSnapshot();
    const pending = this.hasReview() || this.state.reviewing;
    return Object.freeze({ ...state, dirty: state.dirty || pending });
  }
  private notify(): void {
    this.resourceState = this.resourceSnapshot();
    for (const listener of [...this.listeners]) listener();
  }
  private update(change: Partial<ManagedValuationAssumptionsState>): void {
    this.state = Object.freeze({ ...this.state, ...change });
    this.notify();
  }
  private hasReview(): boolean {
    if (this.state.stageReview || this.state.restoreReview) return true;
    return this.state.catalogReview !== null;
  }
  private clearReview(): object {
    const token = {};
    this.transition = token;
    const operation = this.operation;
    this.operation = null;
    this.state = Object.freeze({
      ...this.state,
      reviewing: false,
      stageReview: null,
      restoreReview: null,
      catalogReview: null,
    });
    operation?.abort();
    return token;
  }
  cancelReview(): void {
    if (this.retired) return;
    this.clearReview();
    this.update({
      message: "Review cancelled. Inputs and saved assumptions are unchanged.",
    });
  }
  private resourceChanged(): void {
    if (this.retired) return;
    const state = this.coordinator.getSnapshot();
    if (state.phase !== "idle" || state.saved !== this.resourceState.saved)
      this.confirmedRevision = {};
    if (this.fileRestore && this.fileRestore.draft === null)
      this.fileRestore.draft = state.draft;
    if (state.draft !== this.observedDraft || state.phase !== "idle")
      this.clearReview();
    this.observedDraft = state.draft;
    this.workbench.reconcileSavedInputs(state.saved?.payload ?? null);
    this.notify();
  }
  private editorChanged(): void {
    if (this.retired) return;
    if (!this.hasReview() && !this.operation) return;
    this.clearReview();
    this.update({
      message: "Inputs changed. Prepare a new review before continuing.",
    });
  }
  private close(): void {
    if (this.retired) return;
    this.retired = true;
    this.collectionActivities.clear();
    this.fileRestore = null;
    this.clearReview();
    this.approvals.clear();
    this.stagedCapture = null;
    this.workbench.retire();
    this.state = Object.freeze({
      ...this.state,
      catalogSnapshotSha256: null,
      message: "",
    });
    try {
      this.options.onRetire();
    } finally {
      this.notify();
    }
  }
  retire(message?: string): void {
    if (!this.retired) this.coordinator.retire(message);
  }
  syncCatalog(): void {
    if (this.retired) return;
    const digest = this.options.getCatalogSnapshot()?.snapshotSha256 ?? null;
    if (digest === this.state.catalogSnapshotSha256) return;
    this.confirmedRevision = {};
    this.clearReview();
    this.approvals.clear();
    this.update({ catalogSnapshotSha256: digest, message: "" });
  }
  private resourceEditable(): boolean {
    if (this.retired || !this.coordinator.canEdit()) return false;
    const state = this.coordinator.getSnapshot();
    if (!state.draft || state.baseVersion === null) return false;
    if (state.conflict || state.uncertain) return false;
    if (state.replayPending) return false;
    return true;
  }
  canEdit(): boolean {
    return (
      this.resourceEditable() &&
      this.operation === null &&
      !this.hasCollectionFileActivity()
    );
  }
  getCollectionFileActivityRevision() {
    return this.collectionFileActivityRevision;
  }
  hasCollectionFileActivity() {
    return this.collectionActivities.size > 0;
  }
  beginCollectionFileActivity(owner: object) {
    if (this.retired || this.collectionActivities.has(owner)) return;
    this.collectionActivities.add(owner);
    this.collectionFileActivityRevision = {};
    this.update({});
  }
  endCollectionFileActivity(owner: object) {
    if (this.collectionActivities.delete(owner)) {
      this.collectionFileActivityRevision = {};
      this.update({});
    }
  }
  getDraftFileContext(owner?: object): ValuationCollectionDraftContext | null {
    const save = this.coordinator.getSnapshot(),
      catalog = this.options.getCatalogSnapshot();
    if (
      !this.resourceEditable() ||
      this.operation ||
      this.hasReview() ||
      this.state.reviewing ||
      this.workbench.hasDraftFileActivity()
    )
      return null;
    if ([...this.collectionActivities].some((active) => active !== owner))
      return null;
    if (
      !save.saved ||
      !save.draft ||
      save.baseVersion === null ||
      !save.latestLoaded ||
      save.saved.version !== save.baseVersion ||
      !catalog
    )
      return null;
    const context = Object.freeze({
      saved: save.saved,
      draft: save.draft,
      baseVersion: save.baseVersion,
      save,
      catalog,
      editorFileRevision: this.workbench.getDraftFileActivityRevision(),
    });
    this.fileContexts.add(context);
    return context;
  }
  restoreFileDraft(
    captured: ValuationCollectionDraftContext,
    value: Payload,
    owner: object,
  ): boolean {
    if (
      !this.fileContexts.has(captured) ||
      !this.collectionActivities.has(owner)
    )
      return false;
    const payload = parseValuationAssumptionsPayload(value);
    const current = () => {
      const context = this.getDraftFileContext(owner);
      return (
        context !== null &&
        (
          [
            "saved",
            "draft",
            "baseVersion",
            "save",
            "catalog",
            "editorFileRevision",
          ] as const
        ).every((key) => context[key] === captured[key])
      );
    };
    if (!payload || !current()) return false;
    this.fileContexts.delete(captured);
    const token = this.clearReview();
    this.approvals.clear();
    this.stagedCapture = null;
    this.notify();
    if (this.transition !== token || !current()) return false;
    const committed = { draft: null as Payload | null };
    this.fileRestore = committed;
    try {
      this.coordinator.replaceDraft(payload);
      return (
        !this.retired &&
        committed.draft !== null &&
        this.coordinator.getSnapshot().draft === committed.draft
      );
    } finally {
      if (this.fileRestore === committed) this.fileRestore = null;
    }
  }
  private metadataApproved(entry: Entry): boolean {
    const previous = this.coordinator
      .getSnapshot()
      .saved?.payload.entries.find(
        (item) => item.listing.listingId === entry.listing.listingId,
      );
    if (previous && sameMetadata(previous, entry)) return true;
    const approved = this.approvals.get(entry.listing.listingId);
    if (!approved || !sameMetadata(approved, entry)) return false;
    return (
      entry.catalogSnapshotSha256 ===
      this.options.getCatalogSnapshot()?.snapshotSha256
    );
  }
  private captureDraft(draft: Payload): Payload | null {
    if (!this.canEdit() || this.hasReview()) return null;
    if (this.coordinator.getSnapshot().draft !== draft) return null;
    if (!draft.entries.every((entry) => this.metadataApproved(entry)))
      return null;
    return parseValuationAssumptionsPayload(draft);
  }
  canSavePayload(): boolean {
    const draft = this.coordinator.getSnapshot().draft;
    return draft !== null && this.captureDraft(draft) !== null;
  }
  private acknowledge(payload: Payload): void {
    const capture = this.stagedCapture;
    if (!capture) return;
    const entry = payload.entries.find(
      (item) => item.listing.listingId === capture.entry.listing.listingId,
    );
    if (JSON.stringify(entry) !== JSON.stringify(capture.entry)) return;
    this.stagedCapture = null;
    this.workbench.acknowledgeSavedInputs(capture);
  }
  private reviewCurrent(
    operation: AbortController,
    draft: Payload,
    catalog: ManagedCatalogSnapshotDto,
  ): boolean {
    if (!this.resourceEditable() || operation.signal.aborted) return false;
    if (this.operation !== operation) return false;
    if (this.coordinator.getSnapshot().draft !== draft) return false;
    return this.options.getCatalogSnapshot() === catalog;
  }
  private finishReview(operation: AbortController): void {
    if (this.operation !== operation) return;
    this.operation = null;
    if (!this.retired) this.update({ reviewing: false });
  }
  private reviewError(error: unknown): void {
    if (error instanceof TrialApiError) {
      if (
        ["unauthenticated", "access_denied", "origin_denied"].includes(
          error.code,
        )
      ) {
        this.coordinator.readError(error);
        return;
      }
    }
    this.update({
      message:
        "Catalog identity review could not finish. Your drafts are unchanged.",
    });
  }
  private currentStageInputs(): Pick<
    ValuationStageReview,
    "capture" | "draft" | "catalog"
  > | null {
    if (!this.canEdit()) return null;
    const capture = this.workbench.captureInputs();
    const draft = this.coordinator.getSnapshot().draft;
    const catalog = this.options.getCatalogSnapshot();
    if (!capture) return null;
    if (!draft || !catalog) return null;
    if (capture.entry.catalogSnapshotSha256 !== catalog.snapshotSha256)
      return null;
    if (!knownIssuerMatches(capture.entry)) return null;
    return { capture, draft, catalog };
  }
  async prepareStage(): Promise<void> {
    const current = this.currentStageInputs();
    if (!current) return;
    const { capture, draft, catalog } = current;
    const previous =
      draft.entries.find(
        (entry) => entry.listing.listingId === capture.entry.listing.listingId,
      ) ?? null;
    if (previous && !sameStableEntry(previous, capture.entry)) return;
    const payload = upsert(draft, capture.entry);
    if (!payload) return;
    this.clearReview();
    const operation = new AbortController();
    this.operation = operation;
    this.update({ reviewing: true, message: "" });
    await this.resolveStage(
      { capture, previous, payload, draft, catalog },
      operation,
    );
  }
  private async resolveStage(
    review: ValuationStageReview,
    operation: AbortController,
  ): Promise<void> {
    const { draft, catalog, capture } = review;
    const request = {
      snapshotSha256: catalog.snapshotSha256,
      listingIds: [capture.entry.listing.listingId],
    };
    try {
      if (!this.reviewCurrent(operation, draft, catalog)) return;
      const result = await this.api.resolve(request, operation.signal);
      if (!this.reviewCurrent(operation, draft, catalog)) return;
      if (!stageResponseMatches(result, request, capture.entry)) {
        this.update({
          message:
            "This listing no longer matches the current catalog identity. Your drafts are unchanged.",
        });
        return;
      }
      if (!this.workbench.isInputCaptureCurrent(capture)) return;
      this.update({ stageReview: Object.freeze(review) });
    } catch (error) {
      if (this.reviewCurrent(operation, draft, catalog))
        this.reviewError(error);
    } finally {
      this.finishReview(operation);
    }
  }
  private stageCurrentContext(review: ValuationStageReview): boolean {
    if (!this.canEdit()) return false;
    if (this.coordinator.getSnapshot().draft !== review.draft) return false;
    if (this.options.getCatalogSnapshot() !== review.catalog) return false;
    return this.workbench.isInputCaptureCurrent(review.capture);
  }
  stageCurrent(review = this.state.stageReview): boolean {
    if (!review || this.state.stageReview !== review) return false;
    if (!this.stageCurrentContext(review)) return false;
    const token = this.clearReview();
    this.notify();
    if (this.transition !== token || !this.stageCurrentContext(review))
      return false;
    this.approvals.set(
      review.capture.entry.listing.listingId,
      review.capture.entry,
    );
    this.stagedCapture = review.capture;
    this.coordinator.replaceDraft(review.payload);
    return !this.retired;
  }
  private restoreCurrent(review: ValuationRestoreReview): boolean {
    if (!this.canEdit()) return false;
    if (this.coordinator.getSnapshot().saved !== review.saved) return false;
    if (this.workbench.getSnapshot() !== review.current) return false;
    if (this.options.getCatalogSnapshot() !== review.catalog) return false;
    return matchesContext(review.entry, review.current);
  }
  private savedReview(entry: Entry): ValuationRestoreReview | null {
    const saved = this.coordinator.getSnapshot().saved;
    const catalog = this.options.getCatalogSnapshot();
    if (!saved || !catalog) return null;
    if (!saved.payload.entries.includes(entry)) return null;
    const current = this.workbench.getSnapshot();
    if (entry.catalogSnapshotSha256 !== catalog.snapshotSha256) return null;
    if (!matchesContext(entry, current)) return null;
    return Object.freeze({ entry, current, saved, catalog });
  }
  canCaptureConfirmedEntry(
    entry: Entry,
    expected = this.coordinator.getSnapshot(),
  ): boolean {
    if (expected !== this.coordinator.getSnapshot() || !this.canEdit())
      return false;
    if (
      expected.phase !== "idle" ||
      !expected.latestLoaded ||
      !expected.saved ||
      expected.baseVersion !== expected.saved.version ||
      this.state.reviewing ||
      this.workbench.hasDraftFileActivity()
    )
      return false;
    const current = this.workbench.getSnapshot();
    return (
      current.editable &&
      entry.cik === current.owner?.cik &&
      entry.cik === current.context?.cik &&
      this.savedReview(entry) !== null
    );
  }
  captureConfirmedEntry(
    entry: Entry,
    expected = this.coordinator.getSnapshot(),
  ): ManagedConfirmedValuationCapture | null {
    if (!this.canCaptureConfirmedEntry(entry, expected)) return null;
    const saved = expected.saved!,
      catalog = this.options.getCatalogSnapshot()!;
    const capture = Object.freeze({
      entry: immutableConfirmedData(structuredClone(entry)),
      saved: immutableConfirmedData(structuredClone(saved)),
      catalog: immutableConfirmedData(structuredClone(catalog)),
    });
    this.confirmedCaptures.set(capture, {
      entry,
      saved,
      catalog,
      revision: this.confirmedRevision,
      editorFile: this.workbench.getDraftFileActivityRevision(),
      collectionFile: this.collectionFileActivityRevision,
    });
    return this.isConfirmedEntryCaptureCurrent(capture) ? capture : null;
  }
  isConfirmedEntryCaptureCurrent(
    capture: ManagedConfirmedValuationCapture,
  ): boolean {
    const owned = this.confirmedCaptures.get(capture),
      state = this.coordinator.getSnapshot();
    if (!owned) return false;
    const current =
      !this.retired &&
      this.resourceEditable() &&
      state.phase === "idle" &&
      state.latestLoaded &&
      state.saved === owned.saved &&
      state.baseVersion === owned.saved.version &&
      owned.saved.payload.entries.includes(owned.entry) &&
      this.options.getCatalogSnapshot() === owned.catalog &&
      owned.revision === this.confirmedRevision &&
      owned.editorFile === this.workbench.getDraftFileActivityRevision() &&
      owned.collectionFile === this.collectionFileActivityRevision &&
      !this.workbench.hasDraftFileActivity() &&
      !this.hasCollectionFileActivity();
    if (!current) this.confirmedCaptures.delete(capture);
    return current;
  }
  reviewSavedInputs(entry: Entry): ValuationRestoreReview | null {
    if (!this.canEdit()) return null;
    const review = this.savedReview(entry);
    if (!review) return null;
    this.clearReview();
    this.update({ restoreReview: review, message: "" });
    return this.restoreCurrent(review) && this.state.restoreReview === review
      ? review
      : null;
  }
  useSavedInputs(review = this.state.restoreReview): boolean {
    if (!review || this.state.restoreReview !== review) return false;
    if (!this.restoreCurrent(review)) return false;
    const token = this.clearReview();
    this.notify();
    if (this.transition !== token || !this.restoreCurrent(review)) return false;
    return this.workbench.restoreInputs(review.entry, review.current);
  }
  remove(entry: Entry): boolean {
    const draft = this.coordinator.getSnapshot().draft;
    if (!this.canEdit() || !draft?.entries.includes(entry)) return false;
    const payload = copyPayload({
      schemaVersion: 1,
      entries: draft.entries.filter((item) => item !== entry),
    });
    const token = this.clearReview();
    this.notify();
    if (this.transition !== token || !this.canEdit()) return false;
    if (this.coordinator.getSnapshot().draft !== draft) return false;
    this.coordinator.replaceDraft(payload);
    return !this.retired;
  }
  private currentCatalogDraft(): Pick<
    ValuationCatalogReview,
    "draft" | "catalog"
  > | null {
    if (!this.canEdit()) return null;
    const draft = this.coordinator.getSnapshot().draft;
    const catalog = this.options.getCatalogSnapshot();
    return draft && catalog ? { draft, catalog } : null;
  }
  async reviewCatalog(): Promise<void> {
    const current = this.currentCatalogDraft();
    if (!current) return;
    const { draft, catalog } = current;
    this.clearReview();
    const operation = new AbortController();
    this.operation = operation;
    this.update({ reviewing: true, message: "" });
    const request = {
      snapshotSha256: catalog.snapshotSha256,
      listingIds: draft.entries.map((entry) => entry.listing.listingId),
    };
    try {
      if (!this.reviewCurrent(operation, draft, catalog)) return;
      const raw = request.listingIds.length
        ? await this.api.resolve(request, operation.signal)
        : { snapshotSha256: catalog.snapshotSha256, results: [] };
      if (!this.reviewCurrent(operation, draft, catalog)) return;
      const review = catalogReviewFromResponse(raw, request, draft, catalog);
      this.update({ catalogReview: review });
    } catch (error) {
      if (this.reviewCurrent(operation, draft, catalog))
        this.reviewError(error);
    } finally {
      this.finishReview(operation);
    }
  }
  private catalogPayload(review: ValuationCatalogReview): Payload | null {
    if (review.entries.some((row) => row.entry === null)) return null;
    return parseValuationAssumptionsPayload({
      schemaVersion: 1,
      entries: review.entries.map((row) => row.entry),
    });
  }
  private catalogActionCurrent(review: ValuationCatalogReview): boolean {
    if (!this.canEdit()) return false;
    if (this.coordinator.getSnapshot().draft !== review.draft) return false;
    return this.options.getCatalogSnapshot() === review.catalog;
  }
  applyCatalogReview(review = this.state.catalogReview): boolean {
    if (!review || this.state.catalogReview !== review) return false;
    if (!this.catalogActionCurrent(review)) return false;
    const payload = this.catalogPayload(review);
    if (!payload) return false;
    const token = this.clearReview();
    this.notify();
    if (this.transition !== token || !this.catalogActionCurrent(review))
      return false;
    for (const entry of payload.entries)
      this.approvals.set(entry.listing.listingId, entry);
    this.coordinator.replaceDraft(payload);
    return !this.retired;
  }
}
