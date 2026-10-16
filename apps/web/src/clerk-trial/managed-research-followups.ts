import {
  isMainWatchlistPayload,
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
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { groupResearchFollowupsByDueDate } from "./managed-research-followups-date";
import { SaveCoordinator } from "./save-coordinator";
import { MANAGED_FOLLOWUPS_SAVE_COPY } from "./save-coordinator-copy";
import type { TrialSession } from "./session";

type Listing = Omit<WatchlistMembership, "note">;
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

  constructor(
    private readonly api: Pick<
      ManagedApi,
      "loadFollowups" | "saveFollowups" | "resolve"
    >,
    session: TrialSession,
    private readonly options: {
      getCreationContext(): FollowupsCreationContext;
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
        copy: copyDraft,
        capture,
        load: async (signal) => {
          if (this.retired || signal.aborted)
            throw new TrialApiError("aborted");
          const result = parseManagedResearchFollowups(
            await api.loadFollowups(signal),
          );
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
      this.observedDraft = saved.draft;
      if (this.retired) return;
      if (changed || saved.phase !== "idle") this.cancelReview();
      this.update({
        selectedId: saved.draft?.entries.some(
          (entry) => entry.id === this.state.selectedId,
        )
          ? this.state.selectedId
          : null,
      });
    });
  }

  getSnapshot = (): Readonly<ManagedResearchFollowupsState> => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedResearchFollowupsState>) {
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
    this.retired = true;
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
  private owns(entry: ResearchFollowup) {
    return this.canEdit() && this.currentEntry(entry.id) === entry;
  }
  private replace(entry: ResearchFollowup, next: ResearchFollowup | null) {
    if (!this.owns(entry)) return;
    const draft = this.coordinator.getSnapshot().draft!;
    this.coordinator.replaceDraft({
      ...draft,
      entries: draft.entries.flatMap((current) =>
        current === entry ? (next ? [next] : []) : [current],
      ),
    });
  }
  add(member: WatchlistMembership, dueOn: string) {
    const draft = this.coordinator.getSnapshot().draft;
    const context = this.options.getCreationContext();
    const creationDraft = context.draft;
    const digest = this.state.catalogSnapshotSha256;
    if (
      !this.canEdit() ||
      !draft ||
      !digest ||
      !creationDraft?.memberships.includes(member) ||
      creationDraft.snapshotSha256 !== digest ||
      context.catalogSnapshotSha256 !== digest ||
      draft.entries.length >= MANAGED_RESEARCH_FOLLOWUPS_LIMITS.entries ||
      draft.entries.some(
        (entry) => entry.listing.listingId === member.listingId,
      )
    )
      return;
    const listing: Listing = {
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
    };
    if (
      !isMainWatchlistPayload({
        ...creationDraft,
        memberships: [{ ...member, note: "" }],
      })
    )
      return;
    const id = this.newEntryId();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        id,
      ) ||
      draft.entries.some((entry) => entry.id === id)
    )
      return;
    const current = this.options.getCreationContext();
    if (
      !this.canEdit() ||
      this.coordinator.getSnapshot().draft !== draft ||
      current.draft !== creationDraft ||
      !current.draft.memberships.includes(member) ||
      current.draft.snapshotSha256 !== digest ||
      !membershipMatchesResult(member, listing) ||
      current.catalogSnapshotSha256 !== digest ||
      this.state.catalogSnapshotSha256 !== digest
    )
      return;
    this.coordinator.replaceDraft({
      ...draft,
      entries: [
        ...draft.entries,
        {
          id,
          listing,
          catalogSnapshotSha256: digest,
          check: "",
          dueOn,
          status: "open",
          completedOn: null,
          result: "",
        },
      ],
    });
    if (this.currentEntry(id)) this.update({ selectedId: id, message: "" });
  }
  edit(
    entry: ResearchFollowup,
    field: "check" | "result" | "dueOn",
    raw: string,
  ) {
    if (["check", "result", "dueOn"].includes(field))
      this.replace(entry, { ...entry, [field]: raw });
  }
  remove(entry: ResearchFollowup) {
    this.replace(entry, null);
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
    this.replace(entry, { ...entry, status: "completed", completedOn: day });
  }
  reopen(entry: ResearchFollowup) {
    if (entry.status === "completed")
      this.replace(entry, { ...entry, status: "open", completedOn: null });
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
