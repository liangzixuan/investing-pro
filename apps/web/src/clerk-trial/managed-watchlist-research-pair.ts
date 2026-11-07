import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import {
  companyReportBlock,
  companyReportIsCurrent,
  prepareCompanyReport,
  type CompanyReportEvidence,
} from "./managed-company-report";
import {
  createPassiveCompanyResearchCapture,
  type CompanyResearchSide,
  type PassiveCompanyResearchCapture,
} from "./passive-company-research";
import { watchlistFilingsIdentity } from "./managed-watchlist-filings";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type {
  ManagedResearchVisit,
  ResearchWatchlistState,
} from "./managed-workspace";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";

/** The workspace supplies resource/route admission; revisions never own membership. */
export interface WatchlistResearchPairContext {
  readonly session: object | null;
  readonly catalog: ManagedCatalogSnapshotDto | null;
  readonly draft: MainWatchlistPayload | null;
  readonly fileEpochs: readonly unknown[];
  readonly revision: unknown;
  readonly retire: boolean;
  readonly canStart: boolean;
  readonly available: boolean;
}
export interface WatchlistResearchPairMember {
  readonly handle: symbol;
  readonly listing: ManagedEodIdentity;
}
type PairMembers = readonly [
  WatchlistResearchPairMember,
  WatchlistResearchPairMember,
];
export interface WatchlistResearchReading {
  readonly kind: "watchlist_research_reading";
  readonly members: PairMembers;
  readonly left: PassiveCompanyResearchCapture | null;
  readonly right: PassiveCompanyResearchCapture | null;
}
export interface ManagedWatchlistResearchPairState {
  readonly memberships: readonly WatchlistResearchPairMember[];
  readonly selected: readonly WatchlistResearchPairMember[];
  readonly preview: PairMembers | null;
  readonly reading: WatchlistResearchReading | null;
  readonly activeSide: CompanyResearchSide | null;
  readonly canStart: boolean;
  readonly canCapture: boolean;
  readonly reason: string | null;
}
export interface PendingWatchlistResearchVisit {
  readonly kind: "watchlist_research_visit";
  readonly selection: ManagedResearchSelection;
}
export interface WatchlistResearchPairOptions {
  readonly readContext: () => WatchlistResearchPairContext;
  readonly readVisit: () => ManagedResearchVisit | null;
  readonly readEvidence: (
    selection: ManagedResearchSelection,
  ) => CompanyReportEvidence;
  readonly readWatchlist: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  readonly valuation: ManagedValuationWorkbench;
  readonly now?: () => Date;
}
const same = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);
const emptyMembers: readonly WatchlistResearchPairMember[] = Object.freeze([]);
const idle = (): ManagedWatchlistResearchPairState =>
  Object.freeze({
    memberships: emptyMembers,
    selected: emptyMembers,
    preview: null,
    reading: null,
    activeSide: null,
    canStart: false,
    canCapture: false,
    reason: null,
  });
const validSide = (side: CompanyResearchSide) =>
  side === "left" || side === "right";

/** Session-only complete readings. No source request, editor or persistence authority. */
export class ManagedWatchlistResearchPair {
  private state = idle();
  private retired = false;
  private generation = 0;
  private lifetime: readonly unknown[] = [];
  private fence: readonly unknown[] = [];
  private resource: WatchlistResearchPairContext | null = null;
  private pending: {
    token: PendingWatchlistResearchVisit;
    side: CompanyResearchSide;
  } | null = null;
  private owner: {
    visit: ManagedResearchVisit;
    side: CompanyResearchSide;
    previous: ManagedResearchVisit | null;
  } | null = null;
  private returning: ManagedResearchVisit | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly options: WatchlistResearchPairOptions) {
    this.reconcile();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: ManagedWatchlistResearchPairState) {
    const installed = Object.freeze(next);
    this.state = installed;
    ++this.generation;
    for (const listener of this.listeners) listener();
    return this.state === installed ? installed : null;
  }
  private context() {
    const generation = this.generation;
    const resource = this.options.readContext();
    const visit = this.options.readVisit();
    const valuation = this.options.valuation.getSnapshot();
    const valuationFile = this.options.valuation.getDraftFileActivityRevision();
    const fileActive = this.options.valuation.hasDraftFileActivity();
    const evidence = visit ? this.options.readEvidence(visit.selection) : null;
    const watchlist = visit
      ? this.options.readWatchlist(visit.selection)
      : null;
    if (generation !== this.generation) return null;
    return {
      resource,
      visit,
      valuation,
      valuationFile,
      fileActive,
      evidence,
      watchlist,
      fence: [
        resource.revision,
        resource.canStart,
        resource.available,
        resource.retire,
        visit,
        valuation,
        valuationFile,
        fileActive,
        evidence?.price,
        evidence?.annual,
        evidence?.interim,
        evidence?.filings,
        watchlist?.revision,
        watchlist?.member,
        watchlist?.canAdd,
        watchlist?.canEdit,
        watchlist?.reason,
      ],
    };
  }
  private block(
    context: NonNullable<ReturnType<ManagedWatchlistResearchPair["context"]>>,
  ) {
    if (!this.owner || context.visit !== this.owner.visit)
      return "Open a company from this pair before capturing its reading.";
    if (!context.resource.available || context.fileActive)
      return "Finish resource operations and file review before capturing this reading.";
    if (!context.evidence || !context.watchlist)
      return "Current company evidence is unavailable.";
    if (context.valuation.inputIssue) return context.valuation.inputIssue;
    if (
      context.valuation.owner &&
      !companyEvidenceSelectionMatches(
        context.visit.selection,
        context.valuation.owner,
      )
    )
      return "Stage or discard the other company's valuation inputs before capturing this reading.";
    if (
      context.valuation.calculation &&
      !this.options.valuation.captureCalculationMetadata(
        context.valuation.calculation,
      )
    )
      return "Calculate the current authored inputs before capturing their result.";
    return companyReportBlock(
      context.visit.selection,
      context.evidence,
      context.watchlist,
      context.valuation.calculation,
    );
  }
  reconcile() {
    if (this.retired) return;
    const context = this.context();
    if (!context) return;
    const { resource } = context;
    this.resource = resource;
    const admitted =
      !!resource.session &&
      !!resource.catalog &&
      !!resource.draft &&
      !resource.retire &&
      isMainWatchlistPayload(resource.draft) &&
      resource.draft.snapshotSha256 === resource.catalog.snapshotSha256;
    const lifetime = [
      resource.session,
      resource.catalog,
      resource.catalog?.snapshotSha256,
      ...resource.fileEpochs,
      context.valuationFile,
    ];
    const epochChanged = !same(lifetime, this.lifetime);
    const members = admitted
      ? resource.draft.memberships.map((member, index) => {
          const previous = this.state.memberships[index];
          return !epochChanged &&
            previous &&
            membershipMatchesResult(member, previous.listing)
            ? previous
            : Object.freeze({
                handle: Symbol(member.listingId),
                listing: watchlistFilingsIdentity(member),
              });
        })
      : [];
    const changedMembers = !same(members, this.state.memberships);
    const memberships = changedMembers
      ? Object.freeze(members)
      : this.state.memberships;
    this.lifetime = lifetime;
    if (this.owner?.previous && context.visit === this.owner.visit)
      this.owner.previous = null;
    if (this.returning && context.visit === null) this.returning = null;
    const foreign =
      !!this.state.reading &&
      !this.pending &&
      (this.owner
        ? context.visit !== this.owner.visit &&
          context.visit !== this.owner.previous
        : !!context.visit && context.visit !== this.returning);
    const ended = !admitted || epochChanged || changedMembers || foreign;
    let next = this.state;
    if (ended) {
      this.pending = null;
      this.owner = null;
      this.returning = null;
      next = { ...idle(), memberships };
    }
    const reason = this.pending
      ? "Opening the selected company…"
      : next.reading
        ? this.block(context)
        : resource.canStart && admitted
          ? null
          : "Load and review My Watchlist before starting a research pair.";
    const canCapture =
      !!next.reading && !!this.owner && !this.pending && reason === null;
    const canStart =
      !!next.preview &&
      !next.reading &&
      admitted &&
      resource.canStart &&
      resource.available;
    const changed = !same(context.fence, this.fence);
    this.fence = context.fence;
    if (
      changed ||
      next.memberships !== this.state.memberships ||
      next.reading !== this.state.reading ||
      next.preview !== this.state.preview ||
      next.selected !== this.state.selected ||
      this.state.canCapture !== canCapture ||
      this.state.canStart !== canStart ||
      this.state.reason !== reason ||
      this.state.activeSide !== (this.owner?.side ?? null)
    ) {
      this.publish({
        ...next,
        activeSide: this.owner?.side ?? null,
        canCapture,
        canStart,
        reason,
      });
    }
  }
  private current(expected: ManagedWatchlistResearchPairState) {
    this.reconcile();
    return !this.retired && expected === this.state;
  }
  private installed(next: ManagedWatchlistResearchPairState) {
    const installed = this.publish(next);
    this.reconcile();
    return installed && installed === this.state ? installed : null;
  }
  select(
    expected: ManagedWatchlistResearchPairState,
    member: WatchlistResearchPairMember,
  ) {
    if (
      !this.current(expected) ||
      expected.reading ||
      !this.resource?.canStart ||
      !this.resource.available ||
      !expected.memberships.includes(member)
    )
      return null;
    const selected = expected.selected.includes(member)
      ? expected.selected.filter((value) => value !== member)
      : expected.selected.length < 2
        ? [...expected.selected, member]
        : null;
    if (!selected) return null;
    return this.installed({
      ...expected,
      selected: Object.freeze(selected),
      preview: null,
      canStart: false,
    });
  }
  preview(expected: ManagedWatchlistResearchPairState) {
    if (
      !this.current(expected) ||
      expected.reading ||
      expected.selected.length !== 2 ||
      !this.resource?.canStart ||
      !this.resource.available
    )
      return null;
    const preview = Object.freeze([
      expected.selected[0]!,
      expected.selected[1]!,
    ] as const);
    return this.installed({ ...expected, preview, canStart: true });
  }
  cancelPreview(expected: ManagedWatchlistResearchPairState) {
    if (!this.current(expected) || expected.reading || !expected.preview)
      return null;
    return this.installed({ ...expected, preview: null, canStart: false });
  }
  start(expected: ManagedWatchlistResearchPairState) {
    if (
      !this.current(expected) ||
      !expected.canStart ||
      !expected.preview ||
      expected.reading ||
      this.options.readVisit() ||
      this.retired ||
      this.state !== expected
    )
      return null;
    return this.installed({
      ...expected,
      preview: null,
      canStart: false,
      reading: Object.freeze({
        kind: "watchlist_research_reading",
        members: expected.preview,
        left: null,
        right: null,
      }),
      reason: "Open a company from this pair before capturing its reading.",
    });
  }
  prepareOpen(
    expected: ManagedWatchlistResearchPairState,
    side: CompanyResearchSide,
  ): PendingWatchlistResearchVisit | null {
    if (
      !this.current(expected) ||
      !expected.reading ||
      !validSide(side) ||
      !this.resource?.available ||
      this.pending
    )
      return null;
    const resource = this.resource;
    const member = expected.reading.members[side === "left" ? 0 : 1];
    const current = resource.draft?.memberships.find((value) =>
      membershipMatchesResult(value, member.listing),
    );
    if (!current || !resource.catalog) return null;
    const token = Object.freeze({
      kind: "watchlist_research_visit" as const,
      selection: Object.freeze({
        listing: watchlistFilingsIdentity(current),
        catalogSnapshotSha256: resource.catalog.snapshotSha256,
        cik: null,
        origin: "watchlist" as const,
      }),
    });
    this.pending = { token, side };
    this.owner = null;
    this.returning = null;
    const installed = this.installed({
      ...expected,
      activeSide: null,
      canCapture: false,
      reason: "Opening the selected company…",
    });
    return installed && this.pending?.token === token ? token : null;
  }
  isOpeningCurrent(token: PendingWatchlistResearchVisit) {
    this.reconcile();
    return (
      !this.retired && !!this.state.reading && this.pending?.token === token
    );
  }
  commitOpen(
    token: PendingWatchlistResearchVisit,
    visit: ManagedResearchVisit | undefined,
  ) {
    if (!this.isOpeningCurrent(token)) return false;
    const pending = this.pending!;
    if (
      !visit ||
      this.options.readVisit() !== visit ||
      !companyEvidenceSelectionMatches(token.selection, visit.selection)
    ) {
      if (this.pending === pending) this.invalidate();
      return false;
    }
    if (this.pending !== pending) return false;
    this.pending = null;
    this.owner = { visit, side: pending.side, previous: null };
    this.reconcile();
    return (
      !this.retired &&
      this.owner?.visit === visit &&
      this.options.readVisit() === visit &&
      !!this.state.reading
    );
  }
  continueVisit(previous: ManagedResearchVisit, next: ManagedResearchVisit) {
    if (
      this.retired ||
      !this.owner ||
      this.owner.visit !== previous ||
      !companyEvidenceSelectionMatches(previous.selection, next.selection)
    )
      return false;
    const current = this.options.readVisit();
    if (
      (current !== previous && current !== next) ||
      this.retired ||
      this.owner?.visit !== previous
    )
      return false;
    this.owner = {
      ...this.owner,
      visit: next,
      previous: current === previous ? previous : null,
    };
    this.reconcile();
    return !this.retired && this.owner?.visit === next && !!this.state.reading;
  }
  ownedBack(visit: ManagedResearchVisit) {
    this.reconcile();
    if (
      this.retired ||
      this.pending ||
      !this.owner ||
      this.owner.visit !== visit ||
      this.options.readVisit() !== visit ||
      !this.state.reading
    )
      return false;
    this.owner = null;
    this.returning = visit;
    return (
      this.installed({
        ...this.state,
        activeSide: null,
        canCapture: false,
        reason: "Open a company from this pair before capturing its reading.",
      }) !== null
    );
  }
  capture(
    expected: ManagedWatchlistResearchPairState,
    visit: ManagedResearchVisit,
  ) {
    if (
      !this.current(expected) ||
      !expected.canCapture ||
      !expected.reading ||
      !this.owner
    )
      return null;
    const owner = this.owner;
    const generation = this.generation;
    const context = this.context();
    if (
      !context ||
      context.visit !== visit ||
      !context.evidence ||
      !context.watchlist ||
      this.block(context)
    )
      return null;
    const report = prepareCompanyReport(
      visit.selection,
      context.evidence,
      context.watchlist,
      this.options.now,
      context.valuation.calculation,
    );
    if (!report) return null;
    const metadata = report.valuation
      ? this.options.valuation.captureCalculationMetadata(report.valuation)
      : null;
    if (report.valuation && !metadata) return null;
    const reading = createPassiveCompanyResearchCapture(
      report,
      owner.side,
      metadata?.evaluatedAt ?? null,
    );
    this.reconcile();
    const fresh = this.context();
    if (
      !reading ||
      !fresh ||
      generation !== this.generation ||
      this.owner !== owner ||
      fresh.visit !== visit ||
      !fresh.evidence ||
      !fresh.watchlist ||
      this.block(fresh) ||
      !same(fresh.fence, context.fence) ||
      !companyReportIsCurrent(
        report,
        visit.selection,
        fresh.evidence,
        fresh.watchlist,
        fresh.valuation.calculation,
      )
    )
      return null;
    return this.installed({
      ...expected,
      reading: Object.freeze({ ...expected.reading, [owner.side]: reading }),
    });
  }
  clearSide(
    expected: ManagedWatchlistResearchPairState,
    side: CompanyResearchSide,
  ) {
    if (
      !this.current(expected) ||
      !expected.reading ||
      !validSide(side) ||
      !this.resource?.available ||
      this.pending
    )
      return null;
    return this.installed({
      ...expected,
      reading: Object.freeze({ ...expected.reading, [side]: null }),
    });
  }
  end(expected: ManagedWatchlistResearchPairState) {
    if (!this.current(expected)) return null;
    return this.invalidate();
  }
  foreignClose() {
    return this.invalidate();
  }
  invalidate() {
    if (this.retired) return null;
    if (
      !this.pending &&
      !this.owner &&
      !this.returning &&
      !this.state.reading &&
      !this.state.preview &&
      this.state.selected.length === 0
    )
      return this.state;
    this.pending = null;
    this.owner = null;
    this.returning = null;
    const next = {
      ...idle(),
      memberships: this.state.memberships,
      reason: this.resource?.canStart
        ? null
        : "Load and review My Watchlist before starting a research pair.",
    };
    return this.installed(next);
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.pending = null;
    this.owner = null;
    this.returning = null;
    this.publish(idle());
    this.listeners.clear();
  }
}
