import {
  isMainWatchlistPayload,
  isPersonalPortfolioIdentity,
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  membershipMatchesResult,
  normalizeResearchFollowupCheck,
  normalizeResearchFollowupResult,
  parseManagedCatalogResolveResponse,
  parseManagedResearchFollowups,
  parseManagedResearchFollowupsReceipt,
  parseResearchFollowupsPayload,
  type MainWatchlistPayload,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  holdingPositionsMatch,
  type HoldingFollowupPosition,
} from "./managed-holding-followup";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import {
  groupResearchFollowupsByDueDate,
  isResearchFollowupDueDate,
} from "./managed-research-followups-date";
import { SaveCoordinator, type VersionedPayload } from "./save-coordinator";
import { MANAGED_FOLLOWUPS_SAVE_COPY } from "./save-coordinator-copy";
import type { TrialSession } from "./session";

type Listing = Omit<WatchlistMembership, "note">;
interface CreationSource {
  readonly listing: Listing;
  readonly digest: `sha256:${string}`;
  readonly isCurrent: () => boolean;
}
export interface HoldingCreationContext {
  readonly position: HoldingFollowupPosition;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly isCurrent: () => boolean;
}
export interface HoldingCheckCapture {
  readonly position: HoldingFollowupPosition;
  readonly check: string;
  readonly dueOn: string;
}
interface HoldingCheckOwner {
  readonly source: HoldingCreationContext;
  readonly saved: ReturnType<
    ManagedResearchFollowups["coordinator"]["getSnapshot"]
  >;
  readonly model: Readonly<ManagedResearchFollowupsState>;
  readonly activity: object;
}

export type FollowupsFilter = "open" | "completed" | "all";
export interface FollowupIdentityReview {
  readonly entry: ResearchFollowup;
  readonly listing: Listing | null;
  readonly status: "current" | "update" | "missing" | "rebound";
}
export interface FollowupsCatalogReview {
  readonly draft: ResearchFollowupsPayload;
  readonly snapshotSha256: `sha256:${string}`;
  readonly entries: readonly FollowupIdentityReview[];
}
export interface ManagedResearchFollowupsState {
  readonly selectedId: string | null;
  readonly assessmentTime: number | null;
  readonly filter: FollowupsFilter;
  readonly catalogSnapshotSha256: `sha256:${string}` | null;
  readonly reviewing: boolean;
  readonly review: FollowupsCatalogReview | null;
  readonly message: string;
}
export interface FollowupsCreationContext {
  readonly draft: MainWatchlistPayload | null;
  readonly catalogSnapshotSha256: string | null;
}
export interface FollowupsReviewContext {
  readonly scope: object;
  readonly draft: ResearchFollowupsPayload;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly assessedOn: string;
}
export interface FollowupsDraftFileContext {
  readonly saved: VersionedPayload<ResearchFollowupsPayload>;
  readonly draft: ResearchFollowupsPayload;
  readonly baseVersion: number;
  readonly catalog: string | null;
}
export interface NextCheckCapture {
  readonly member: WatchlistMembership;
  readonly listing: Listing;
  readonly watchlist: MainWatchlistPayload;
  readonly followups: ResearchFollowupsPayload;
  readonly digest: `sha256:${string}`;
  readonly check: string;
  readonly dueOn: string;
}
export interface NextCheckPreparation {
  readonly capture: NextCheckCapture | null;
  readonly reason: string | null;
}

function catalogDigest(value: string | null): `sha256:${string}` | null {
  return value !== null && /^sha256:[0-9a-f]{64}$/u.test(value)
    ? (value as `sha256:${string}`)
    : null;
}

/** Keep raw authored input, including invalid input, until explicit Save capture. */
function copyDraft(
  payload: ResearchFollowupsPayload,
): ResearchFollowupsPayload {
  return Object.freeze({
    ...payload,
    entries: Object.freeze(
      payload.entries.map((entry) =>
        Object.freeze({
          ...entry,
          listing: Object.freeze({ ...entry.listing }),
        }),
      ),
    ),
  });
}
function capture(payload: ResearchFollowupsPayload) {
  const entries: ResearchFollowup[] = [];
  for (const entry of payload.entries) {
    const check = normalizeResearchFollowupCheck(entry.check);
    const result = normalizeResearchFollowupResult(entry.result);
    if (check === null || result === null) return null;
    entries.push({ ...entry, check, result });
  }
  return parseResearchFollowupsPayload({ ...payload, entries });
}
function sameStableIdentity(previous: Listing, current: Listing) {
  return (
    previous.listingId === current.listingId &&
    previous.issuerId === current.issuerId &&
    previous.securityId === current.securityId &&
    previous.shareClassId === current.shareClassId &&
    previous.exchangeMic === current.exchangeMic &&
    previous.country === current.country &&
    previous.instrumentType === current.instrumentType
  );
}
function listingIdentity(member: WatchlistMembership): Listing {
  return Object.freeze({
    country: member.country,
    exchangeMic: member.exchangeMic,
    instrumentType: member.instrumentType,
    issuerId: member.issuerId,
    issuerName: member.issuerName,
    listingId: member.listingId,
    securityId: member.securityId,
    securityName: member.securityName,
    shareClassId: member.shareClassId,
    shareClassName: member.shareClassName,
    symbol: member.symbol,
  });
}

/** Independent authored plans; no watchlist save or financial source request. */
export class ManagedResearchFollowups {
  readonly coordinator: SaveCoordinator<ResearchFollowupsPayload>;
  private state: Readonly<ManagedResearchFollowupsState>;
  private readonly listeners = new Set<() => void>();
  private retired = false;
  private retireNotified = false;
  private operation: AbortController | null = null;
  private observedDraft: ResearchFollowupsPayload | null = null;
  private readonly newEntryId: () => string;
  private readonly nextChecks = new WeakSet<NextCheckCapture>();
  private readonly draftFileActivities = new Set<object>();
  private draftFileActivityRevision: object = {};
  private holdingInputRevision: object = {};
  private readonly holdingChecks = new WeakMap<
    HoldingCheckCapture,
    HoldingCheckOwner
  >();
  private initialHoldingCheckLoad: (() => boolean) | null = null;
  private creatingNextCheck = false;
  private initialNextCheckLoad: (() => boolean) | null = null;
  private reviewScope: object = Object.freeze({});
  private authoredInput: ResearchFollowupsPayload | null = null;
  private authoredOutput: ResearchFollowupsPayload | null = null;

  constructor(
    private readonly api: Pick<
      ManagedApi,
      "loadFollowups" | "saveFollowups" | "resolve"
    >,
    session: TrialSession,
    private readonly options: {
      getCreationContext(): FollowupsCreationContext;
      getHoldingCreationContext?: (
        position: HoldingFollowupPosition,
      ) => HoldingCreationContext | null;
      onRetire(): void;
      newKey?: () => string;
      newEntryId?: () => string;
    },
  ) {
    this.newEntryId = options.newEntryId ?? (() => crypto.randomUUID());
    this.state = Object.freeze({
      selectedId: null,
      assessmentTime: Date.now(),
      filter: "open",
      catalogSnapshotSha256: catalogDigest(
        options.getCreationContext().catalogSnapshotSha256,
      ),
      reviewing: false,
      review: null,
      message: "",
    });
    this.coordinator = new SaveCoordinator(
      {
        mode: "managed",
        empty: () => null,
        copy: (payload) => this.copyForReview(payload),
        capture,
        load: async (signal) => {
          const nextCheckLoad = this.initialNextCheckLoad;
          if (nextCheckLoad && !nextCheckLoad())
            throw new TrialApiError("aborted");
          if (this.retired || signal.aborted)
            throw new TrialApiError("aborted");
          const holdingLoad = this.initialHoldingCheckLoad;
          if (holdingLoad && !holdingLoad()) throw new TrialApiError("aborted");
          const loaded = await api.loadFollowups(signal);
          if (
            nextCheckLoad &&
            (this.initialNextCheckLoad !== nextCheckLoad || !nextCheckLoad())
          )
            throw new TrialApiError("aborted");
          if (
            holdingLoad &&
            (this.initialHoldingCheckLoad !== holdingLoad || !holdingLoad())
          )
            throw new TrialApiError("aborted");
          const result = parseManagedResearchFollowups(loaded);
          if (!result) throw new TrialApiError("invalid_response");
          return result;
        },
        save: async (command, signal) => {
          if (this.retired || signal.aborted)
            throw new TrialApiError("aborted");
          const result = parseManagedResearchFollowupsReceipt(
            await api.saveFollowups(command, signal),
            command,
          );
          if (!result) throw new TrialApiError("invalid_response");
          return result;
        },
      },
      session,
      MANAGED_FOLLOWUPS_SAVE_COPY,
      {
        ...(options.newKey ? { newKey: options.newKey } : {}),
        onRetire: () => {
          this.close();
          if (!this.retireNotified) {
            this.retireNotified = true;
            try {
              options.onRetire();
            } finally {
              for (const listener of this.listeners) listener();
            }
          }
        },
      },
    );
    this.coordinator.subscribe(() => {
      const saved = this.coordinator.getSnapshot();
      const changed = saved.draft !== this.observedDraft;
      const authored = changed && saved.draft === this.authoredOutput;
      this.authoredOutput = null;
      this.observedDraft = saved.draft;
      if (changed && !authored) this.endReviewScope();
      if (saved.phase !== "idle") this.endReviewScope();
      if (saved.conflict || saved.uncertain || saved.replayPending)
        this.endReviewScope();
      if (this.retired) return;
      if (changed || saved.phase !== "idle") this.cancelReview();
      this.update(
        {
          selectedId: saved.draft?.entries.some(
            (entry) => entry.id === this.state.selectedId,
          )
            ? this.state.selectedId
            : null,
        },
        true,
      );
    });
  }

  getSnapshot = (): Readonly<ManagedResearchFollowupsState> => this.state;
  getInputRevision() {
    return this.holdingInputRevision;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(
    next: Partial<ManagedResearchFollowupsState>,
    coordinatorPublication = false,
  ) {
    if (!coordinatorPublication) this.holdingInputRevision = {};
    this.state = Object.freeze({ ...this.state, ...next });
    for (const listener of this.listeners) listener();
  }
  private cancelReview() {
    const operation = this.operation;
    this.operation = null;
    this.state = Object.freeze({
      ...this.state,
      reviewing: false,
      review: null,
    });
    operation?.abort();
  }
  private close() {
    if (this.retired) return;
    this.endReviewScope();
    this.retired = true;
    this.draftFileActivities.clear();
    this.draftFileActivityRevision = {};
    this.cancelReview();
    this.state = Object.freeze({
      ...this.state,
      selectedId: null,
      assessmentTime: null,
      filter: "open",
      catalogSnapshotSha256: null,
      message: "",
    });
  }
  retire() {
    if (!this.retired) this.coordinator.retire();
  }
  syncCatalog(snapshotSha256: string | null) {
    if (this.retired) return;
    const digest = catalogDigest(snapshotSha256);
    if (digest === this.state.catalogSnapshotSha256) return;
    this.endReviewScope();
    this.cancelReview();
    this.update({ catalogSnapshotSha256: digest, message: "" });
  }
  canEdit() {
    const state = this.coordinator.getSnapshot();
    return (
      !this.retired &&
      this.coordinator.canEdit() &&
      state.draft !== null &&
      !state.conflict &&
      !state.replayPending &&
      !state.uncertain
    );
  }
  currentEntry(id: string): ResearchFollowup | null {
    return this.retired
      ? null
      : (this.coordinator
          .getSnapshot()
          .draft?.entries.find((entry) => entry.id === id) ?? null);
  }
  select(id: string | null) {
    if (!this.retired && (id === null || this.currentEntry(id)))
      this.update({ selectedId: id });
  }
  reassessDueDate(clock: Date) {
    if (this.retired) return;
    const previous = groupResearchFollowupsByDueDate(
      [],
      new Date(this.state.assessmentTime ?? NaN),
    )?.assessedOn;
    if (previous !== groupResearchFollowupsByDueDate([], clock)?.assessedOn)
      this.endReviewScope();
    const time = clock.getTime();
    this.update({
      assessmentTime: groupResearchFollowupsByDueDate([], clock) ? time : null,
    });
  }
  setFilter(filter: FollowupsFilter) {
    if (!this.retired && ["open", "completed", "all"].includes(filter))
      this.update({ filter });
  }
  canSavePayload() {
    const draft = this.coordinator.getSnapshot().draft;
    return !this.retired && draft !== null && capture(draft) !== null;
  }
  private endReviewScope() {
    this.reviewScope = Object.freeze({});
  }
  private copyForReview(payload: ResearchFollowupsPayload) {
    const authored = payload === this.authoredInput;
    this.authoredInput = null;
    this.authoredOutput = null;
    const copied = copyDraft(payload);
    if (authored) this.authoredOutput = copied;
    return copied;
  }
  private replaceAuthoredDraft(payload: ResearchFollowupsPayload) {
    this.authoredInput = payload;
    try {
      return this.coordinator.replaceDraft(payload);
    } finally {
      this.authoredInput = null;
      this.authoredOutput = null;
    }
  }
  getReviewContext(): FollowupsReviewContext | null {
    const saved = this.coordinator.getSnapshot();
    if (!this.canEdit() || this.operation || this.state.review) return null;
    if (!saved.draft || !saved.saved || !saved.latestLoaded) return null;
    if (saved.baseVersion !== saved.saved.version) return null;
    const digest = this.state.catalogSnapshotSha256;
    if (!digest) return null;
    const groups = groupResearchFollowupsByDueDate(
      [],
      new Date(this.state.assessmentTime ?? NaN),
    );
    if (!groups) return null;
    return Object.freeze({
      scope: this.reviewScope,
      draft: saved.draft,
      catalogSnapshotSha256: digest,
      assessedOn: groups.assessedOn,
    });
  }
  /** Local file operations retire readable-report captures without changing the draft. */
  hasDraftFileActivity() {
    return this.draftFileActivities.size > 0;
  }
  ownsDraftFileActivity(owner: object) {
    return (
      this.draftFileActivities.size === 1 && this.draftFileActivities.has(owner)
    );
  }
  getDraftFileActivityRevision() {
    return this.draftFileActivityRevision;
  }
  beginDraftFileActivity(operation: object) {
    if (this.retired || this.draftFileActivities.has(operation)) return;
    this.draftFileActivities.add(operation);
    this.draftFileActivityRevision = {};
    this.update({});
  }
  endDraftFileActivity(operation: object) {
    if (!this.draftFileActivities.delete(operation)) return;
    this.draftFileActivityRevision = {};
    this.update({});
  }
  getDraftFileContext(requireFresh = true): FollowupsDraftFileContext | null {
    const state = this.coordinator.getSnapshot();
    const catalog = this.options.getCreationContext().catalogSnapshotSha256;
    if (
      !this.canEdit() ||
      this.operation ||
      this.state.review ||
      !state.saved ||
      !state.draft ||
      state.baseVersion === null ||
      catalog !== this.state.catalogSnapshotSha256
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
  /** A reviewed file replaces only the local draft, never its online version. */
  restoreFileDraft(
    captured: FollowupsDraftFileContext,
    value: ResearchFollowupsPayload,
  ) {
    const draft = parseResearchFollowupsPayload(value);
    const current = this.getDraftFileContext();
    if (
      !draft ||
      !current ||
      current.saved !== captured.saved ||
      current.draft !== captured.draft ||
      current.baseVersion !== captured.baseVersion ||
      current.catalog !== captured.catalog
    )
      return false;
    const installed = this.coordinator.replaceDraft(draft);
    if (
      this.retired ||
      installed === null ||
      this.coordinator.getSnapshot().draft !== installed
    )
      return false;
    this.select(null);
    return (
      !this.retired &&
      installed !== null &&
      this.coordinator.getSnapshot().draft === installed
    );
  }
  private owns(entry: ResearchFollowup) {
    return this.canEdit() && this.currentEntry(entry.id) === entry;
  }
  private replace(
    entry: ResearchFollowup,
    next: ResearchFollowup | null,
    reviewSafe = false,
  ) {
    if (!this.owns(entry)) return;
    const draft = this.coordinator.getSnapshot().draft!;
    const payload = {
      ...draft,
      entries: draft.entries.flatMap((current) =>
        current === entry ? (next ? [next] : []) : [current],
      ),
    };
    return reviewSafe
      ? this.replaceAuthoredDraft(payload)
      : this.coordinator.replaceDraft(payload);
  }
  prepareNextCheck(
    member: WatchlistMembership,
    rawCheck: string,
    dueOn: string,
  ): NextCheckPreparation {
    const followups = this.coordinator.getSnapshot().draft;
    const context = this.options.getCreationContext();
    const digest = this.state.catalogSnapshotSha256;
    let reason: string | null = null;
    if (!followups)
      reason =
        "Load follow-ups for this check before creation. This explicit initial read keeps your thesis fields here.";
    else if (!this.canEdit())
      reason =
        "Follow-ups editing is paused. Finish its load, save or recovery decision first.";
    else if (
      !digest ||
      context.catalogSnapshotSha256 !== digest ||
      context.draft?.snapshotSha256 !== digest ||
      !context.draft.memberships.includes(member)
    )
      reason =
        "Use the exact company in the current watchlist draft and catalog.";
    else if (
      followups.entries.some(
        (entry) => entry.listing.listingId === member.listingId,
      )
    )
      reason =
        "This listing already has a follow-up. Open Follow-ups to review it; creation will not replace it.";
    else if (
      followups.entries.length >= MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries
    )
      reason =
        "Follow-ups already has 20 entries. Remove an entry there before creating another.";
    const check = normalizeResearchFollowupCheck(rawCheck);
    if (!reason && check === null)
      reason =
        "Next check needs 1–500 characters on one line, without unsupported characters. Shorten it here; no text is clipped.";
    if (!reason && !isResearchFollowupDueDate(dueOn))
      reason = "Choose a valid due date for this check.";
    if (reason) return { capture: null, reason };
    const capture: NextCheckCapture = Object.freeze({
      member,
      listing: listingIdentity(member),
      watchlist: context.draft!,
      followups: followups!,
      digest: digest!,
      check: check!,
      dueOn,
    });
    this.nextChecks.add(capture);
    return { capture, reason: null };
  }
  private nextCheckIsCurrent(capture: NextCheckCapture) {
    const context = this.options.getCreationContext();
    return (
      this.nextChecks.has(capture) &&
      this.canEdit() &&
      this.coordinator.getSnapshot().draft === capture.followups &&
      context.draft === capture.watchlist &&
      context.catalogSnapshotSha256 === capture.digest &&
      this.state.catalogSnapshotSha256 === capture.digest &&
      context.draft.memberships.includes(capture.member) &&
      context.draft.snapshotSha256 === capture.digest &&
      membershipMatchesResult(capture.member, capture.listing)
    );
  }
  canLoadForNextCheck(member: WatchlistMembership) {
    const saved = this.coordinator.getSnapshot();
    const context = this.options.getCreationContext();
    const digest = this.state.catalogSnapshotSha256;
    return (
      !this.retired &&
      this.coordinator.canEdit() &&
      saved.phase === "idle" &&
      saved.draft === null &&
      !saved.uncertain &&
      !saved.conflict &&
      digest !== null &&
      context.catalogSnapshotSha256 === digest &&
      context.draft?.snapshotSha256 === digest &&
      context.draft.memberships.includes(member)
    );
  }
  async loadForNextCheck(
    member: WatchlistMembership,
    isCurrent: () => boolean,
  ) {
    if (
      !this.canLoadForNextCheck(member) ||
      !isCurrent() ||
      !this.canLoadForNextCheck(member)
    )
      return;
    const context = this.options.getCreationContext();
    const current = () => {
      if (!isCurrent()) return false;
      const fresh = this.options.getCreationContext();
      return (
        !this.retired &&
        fresh.draft === context.draft &&
        fresh.catalogSnapshotSha256 === context.catalogSnapshotSha256 &&
        this.state.catalogSnapshotSha256 === context.catalogSnapshotSha256 &&
        fresh.draft?.memberships.includes(member) === true
      );
    };
    this.initialNextCheckLoad = current;
    try {
      await this.coordinator.load();
    } finally {
      if (this.initialNextCheckLoad === current)
        this.initialNextCheckLoad = null;
    }
  }
  createNextCheck(
    capture: NextCheckCapture,
    isCurrent: () => boolean,
  ): ResearchFollowup | null {
    if (this.creatingNextCheck) return null;
    this.creatingNextCheck = true;
    try {
      if (
        !this.nextCheckIsCurrent(capture) ||
        !isCurrent() ||
        !this.nextCheckIsCurrent(capture)
      )
        return null;
      return this.create(
        capture.member,
        capture.dueOn,
        capture.check,
        () =>
          this.nextCheckIsCurrent(capture) &&
          isCurrent() &&
          this.nextCheckIsCurrent(capture),
      );
    } finally {
      this.creatingNextCheck = false;
    }
  }
  add(member: WatchlistMembership, dueOn: string) {
    this.create(member, dueOn, "", () => true);
  }
  private watchlistCreationSource(
    member: WatchlistMembership,
  ): CreationSource | null {
    const context = this.options.getCreationContext();
    const draft = context.draft;
    const digest = this.state.catalogSnapshotSha256;
    if (
      !draft ||
      !digest ||
      context.catalogSnapshotSha256 !== digest ||
      draft.snapshotSha256 !== digest ||
      !draft.memberships.includes(member)
    )
      return null;
    if (
      !isMainWatchlistPayload({
        ...draft,
        memberships: [{ ...member, note: "" }],
      })
    )
      return null;
    const listing = listingIdentity(member);
    return {
      listing,
      digest,
      isCurrent: () => {
        const current = this.options.getCreationContext();
        return (
          current.draft === draft &&
          draft.memberships.includes(member) &&
          draft.snapshotSha256 === digest &&
          current.catalogSnapshotSha256 === digest &&
          membershipMatchesResult(member, listing)
        );
      },
    };
  }
  private create(
    member: WatchlistMembership,
    dueOn: string,
    check: string,
    admit: () => boolean,
  ): ResearchFollowup | null {
    if (!admit()) return null;
    const source = this.watchlistCreationSource(member);
    return source ? this.createListing(source, dueOn, check, admit) : null;
  }
  private listingCanBeCreated(
    draft: ResearchFollowupsPayload,
    source: CreationSource,
  ) {
    return (
      this.canEdit() &&
      this.coordinator.getSnapshot().draft === draft &&
      this.state.catalogSnapshotSha256 === source.digest &&
      source.isCurrent() &&
      isPersonalPortfolioIdentity(source.listing) &&
      draft.entries.length < MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries &&
      !draft.entries.some(
        (entry) => entry.listing.listingId === source.listing.listingId,
      )
    );
  }
  /** One UUID/capacity/identity mutation engine for separately admitted sources. */
  private createListing(
    source: CreationSource,
    dueOn: string,
    check: string,
    admit: () => boolean,
  ): ResearchFollowup | null {
    if (!admit()) return null;
    const draft = this.coordinator.getSnapshot().draft;
    if (!draft || !this.listingCanBeCreated(draft, source)) return null;
    const id = this.newEntryId();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        id,
      )
    )
      return null;
    if (
      !admit() ||
      !this.listingCanBeCreated(draft, source) ||
      draft.entries.some((entry) => entry.id === id)
    )
      return null;
    this.replaceAuthoredDraft({
      ...draft,
      entries: [
        ...draft.entries,
        {
          id,
          listing: source.listing,
          catalogSnapshotSha256: source.digest,
          check,
          dueOn,
          status: "open",
          completedOn: null,
          result: "",
        },
      ],
    });
    if (this.currentEntry(id)) this.update({ selectedId: id, message: "" });
    return this.currentEntry(id);
  }
  private holdingSource(position: HoldingFollowupPosition) {
    const source = this.options.getHoldingCreationContext?.(position);
    if (
      !source ||
      !source.isCurrent() ||
      !holdingPositionsMatch(position, source.position)
    )
      return null;
    return source.catalogSnapshotSha256 === this.state.catalogSnapshotSha256
      ? source
      : null;
  }
  private holdingReadinessIssue() {
    const saved = this.coordinator.getSnapshot();
    if (!saved.draft)
      return "Load Follow-ups here before previewing this check. Your question and due date stay here.";
    if (
      !this.canEdit() ||
      saved.phase !== "idle" ||
      !saved.latestLoaded ||
      !saved.saved ||
      saved.baseVersion !== saved.saved.version ||
      this.operation ||
      this.state.reviewing ||
      this.state.review ||
      this.hasDraftFileActivity()
    )
      return "Finish Follow-ups load, save, file or catalog recovery before previewing this check.";
    return null;
  }
  prepareHoldingCheck(
    position: HoldingFollowupPosition,
    rawCheck: string,
    dueOn: string,
  ): { capture: HoldingCheckCapture | null; reason: string | null } {
    const refuse = (reason: string) => ({ capture: null, reason });
    const source = this.holdingSource(position);
    if (!source)
      return refuse(
        "Return to the exact current positive holding before preparing this check.",
      );
    const issue = this.holdingReadinessIssue();
    if (issue) return refuse(issue);
    const saved = this.coordinator.getSnapshot();
    const draft = saved.draft!;
    if (
      draft.entries.some(
        (entry) => entry.listing.listingId === position.listing.listingId,
      )
    )
      return refuse(
        "This listing already has a follow-up. Open Follow-ups to review it; creation will not replace it.",
      );
    if (draft.entries.length >= MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries)
      return refuse(
        "Follow-ups already has 20 entries. Remove an entry there before creating another.",
      );
    const check = normalizeResearchFollowupCheck(rawCheck);
    if (check === null)
      return refuse(
        "Next check needs 1–500 characters on one line, without unsupported characters. No text is clipped.",
      );
    if (!isResearchFollowupDueDate(dueOn))
      return refuse("Choose a valid due date for this check.");
    const capture = Object.freeze({
      position: Object.freeze({
        ...source.position,
        listing: Object.freeze({ ...source.position.listing }),
      }),
      check,
      dueOn,
    });
    this.holdingChecks.set(capture, {
      source,
      saved,
      model: this.state,
      activity: this.draftFileActivityRevision,
    });
    return { capture, reason: null };
  }
  private holdingCaptureIsCurrent(
    capture: HoldingCheckCapture,
    owner: HoldingCheckOwner,
  ) {
    return (
      this.holdingReadinessIssue() === null &&
      this.coordinator.getSnapshot() === owner.saved &&
      this.state === owner.model &&
      this.draftFileActivityRevision === owner.activity &&
      owner.source.isCurrent() &&
      this.state.catalogSnapshotSha256 === owner.source.catalogSnapshotSha256 &&
      holdingPositionsMatch(capture.position, owner.source.position)
    );
  }
  createHoldingCheck(
    capture: HoldingCheckCapture,
    isCurrent: () => boolean,
  ): ResearchFollowup | null {
    if (this.creatingNextCheck) return null;
    const owner = this.holdingChecks.get(capture);
    this.holdingChecks.delete(capture);
    if (!owner) return null;
    this.creatingNextCheck = true;
    try {
      const current = () =>
        this.holdingCaptureIsCurrent(capture, owner) &&
        isCurrent() &&
        this.holdingCaptureIsCurrent(capture, owner);
      if (!current()) return null;
      return this.createListing(
        {
          listing: capture.position.listing,
          digest: owner.source.catalogSnapshotSha256,
          isCurrent: () => this.holdingCaptureIsCurrent(capture, owner),
        },
        capture.dueOn,
        capture.check,
        current,
      );
    } finally {
      this.creatingNextCheck = false;
    }
  }
  canLoadHoldingChecks(position: HoldingFollowupPosition) {
    const saved = this.coordinator.getSnapshot();
    return (
      this.holdingSource(position) !== null &&
      !this.retired &&
      this.coordinator.canEdit() &&
      saved.phase === "idle" &&
      saved.draft === null &&
      !saved.conflict &&
      !saved.uncertain &&
      !saved.replayPending &&
      !this.hasDraftFileActivity()
    );
  }
  async loadHoldingChecks(
    position: HoldingFollowupPosition,
    isCurrent: () => boolean,
  ): Promise<void> {
    if (
      !this.canLoadHoldingChecks(position) ||
      !isCurrent() ||
      !this.canLoadHoldingChecks(position)
    )
      return;
    const source = this.holdingSource(position);
    if (!source) return;
    const input = this.holdingInputRevision,
      activity = this.draftFileActivityRevision;
    let retired = false;
    const current = () => {
      retired ||=
        this.retired ||
        !source.isCurrent() ||
        !isCurrent() ||
        this.holdingInputRevision !== input ||
        this.draftFileActivityRevision !== activity ||
        this.hasDraftFileActivity() ||
        this.state.catalogSnapshotSha256 !== source.catalogSnapshotSha256;
      return !retired;
    };
    this.initialHoldingCheckLoad = current;
    try {
      await this.coordinator.load();
    } finally {
      if (this.initialHoldingCheckLoad === current)
        this.initialHoldingCheckLoad = null;
    }
  }
  edit(
    entry: ResearchFollowup,
    field: "check" | "result" | "dueOn",
    raw: string,
  ) {
    if (["check", "result", "dueOn"].includes(field))
      return this.replace(
        entry,
        { ...entry, [field]: raw },
        field === "result",
      );
  }
  remove(entry: ResearchFollowup) {
    this.replace(entry, null, true);
  }
  complete(entry: ResearchFollowup, capturedClock: Date) {
    if (!this.owns(entry) || entry.status !== "open") return;
    const day = groupResearchFollowupsByDueDate([], capturedClock)?.assessedOn;
    if (!day) {
      this.update({
        message: "Use a valid current UTC date before completing.",
      });
      return;
    }
    this.replace(
      entry,
      { ...entry, status: "completed", completedOn: day },
      true,
    );
  }
  reopen(entry: ResearchFollowup) {
    if (entry.status === "completed")
      this.replace(
        entry,
        { ...entry, status: "open", completedOn: null },
        true,
      );
  }
  async reviewCatalog() {
    const draft = this.coordinator.getSnapshot().draft;
    const digest = this.state.catalogSnapshotSha256;
    if (
      !this.canEdit() ||
      !draft ||
      !digest ||
      this.operation ||
      !draft.entries.length ||
      draft.entries.length > MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries
    )
      return;
    this.endReviewScope();
    const operation = new AbortController();
    this.operation = operation;
    const current = () =>
      this.canEdit() &&
      this.operation === operation &&
      !operation.signal.aborted &&
      this.coordinator.getSnapshot().draft === draft &&
      this.state.catalogSnapshotSha256 === digest;
    const request = {
      snapshotSha256: digest,
      listingIds: draft.entries.map((entry) => entry.listing.listingId),
    };
    this.update({ reviewing: true, review: null, message: "" });
    try {
      if (!current()) return;
      const response = await this.api.resolve(request, operation.signal);
      if (!current()) return;
      const result = parseManagedCatalogResolveResponse(response, request);
      if (!result) throw new TrialApiError("invalid_response");
      const entries = result.results.map(({ listing }, index) => {
        const entry = draft.entries[index]!;
        const status =
          listing === null
            ? "missing"
            : !sameStableIdentity(entry.listing, listing)
              ? "rebound"
              : entry.catalogSnapshotSha256 === digest &&
                  membershipMatchesResult(
                    { ...entry.listing, note: "" },
                    listing,
                  )
                ? "current"
                : "update";
        return Object.freeze({ entry, listing, status });
      });
      this.update({
        review: Object.freeze({
          draft,
          snapshotSha256: digest,
          entries: Object.freeze(entries),
        }),
      });
    } catch (error) {
      if (current()) {
        if (
          error instanceof TrialApiError &&
          ["unauthenticated", "access_denied", "origin_denied"].includes(
            error.code,
          )
        )
          this.coordinator.readError(error);
        else
          this.update({
            review: null,
            message:
              "Identity review could not finish. Your draft is unchanged.",
          });
      }
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.update({ reviewing: false });
      }
    }
  }
  applyReview() {
    const review = this.state.review;
    if (
      !this.canEdit() ||
      this.operation ||
      !review ||
      this.coordinator.getSnapshot().draft !== review.draft ||
      this.state.catalogSnapshotSha256 !== review.snapshotSha256
    )
      return;
    this.coordinator.replaceDraft({
      ...review.draft,
      entries: review.entries.map(({ entry, listing, status }) =>
        listing && (status === "current" || status === "update")
          ? {
              ...entry,
              listing,
              catalogSnapshotSha256: review.snapshotSha256,
            }
          : entry,
      ),
    });
    if (!this.retired)
      this.update({
        message:
          "Eligible identities updated in this draft. Missing or changed identities were retained. Review and save follow-ups.",
      });
  }
}
