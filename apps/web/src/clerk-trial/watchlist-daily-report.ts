import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedFilingsReviewState } from "./managed-filings-review";
import type {
  SavedScenarioPlan,
  SavedScenarioReading,
} from "./managed-watchlist-valuation-review";
import type { SaveState } from "./save-coordinator";
import {
  companyFollowupsReadout,
  companyWatchlistReadout,
} from "./managed-company-research-checks";
import type { WatchlistDailyReportSource } from "./watchlist-daily-report-controller";

type GroupRow = ManagedFilingsReviewState["rows"][number];
type PassiveMemberRow<T extends { readonly member: GroupRow["member"] }> = Omit<
  T,
  "member"
> & { readonly member: Pick<T["member"], "listing"> };
type Daily = NonNullable<ManagedFilingsReviewState["daily"]>;
type Plan = NonNullable<Daily["plan"]>;
type PassiveDaily = Omit<Daily, "plan" | "outcomes"> & {
  readonly plan: {
    readonly names: Plan["names"];
    readonly rows: readonly PassiveMemberRow<Plan["rows"][number]>[];
  } | null;
  readonly outcomes: readonly PassiveMemberRow<Daily["outcomes"][number]>[];
};
function passiveMember<T extends { readonly member: GroupRow["member"] }>(
  row: T,
): PassiveMemberRow<T> {
  const { member, ...data } = row;
  return { ...data, member: { listing: member.listing } };
}
export type DailyReportResource = ReturnType<typeof resource>;
export interface PreparedWatchlistDailyReport {
  readonly kind: "watchlist_daily_review";
  readonly preparedAt: string;
  readonly daily: PassiveDaily;
  readonly rows: readonly {
    readonly evidence: PassiveMemberRow<GroupRow>;
    readonly watchlist: ReturnType<typeof companyWatchlistReadout>;
    readonly check: ReturnType<typeof companyFollowupsReadout>;
  }[];
  readonly scenarios: {
    readonly capturedAt: string;
    readonly collectionVersion: number;
    readonly catalog: SavedScenarioPlan["collection"]["catalog"];
    readonly rows: SavedScenarioPlan["rows"];
    readonly evaluatedAt: string | null;
    readonly outcomes: SavedScenarioReading["rows"] | null;
  } | null;
  readonly resources: {
    readonly watchlist: DailyReportResource;
    readonly followups: DailyReportResource;
    readonly valuationInputs: DailyReportResource;
  };
}
const reports = new WeakSet<object>();
export function isPreparedWatchlistDailyReport(
  value: unknown,
): value is PreparedWatchlistDailyReport {
  return typeof value === "object" && value !== null && reports.has(value);
}
function resource(state: SaveState<unknown>) {
  return {
    phase: state.phase,
    savedVersion: state.saved?.version ?? null,
    baseVersion: state.baseVersion,
    dirty: state.dirty,
    latestLoaded: state.latestLoaded,
    conflict: state.conflict,
    uncertain: state.uncertain,
    replayPending: state.replayPending,
  };
}
function validText(value: unknown): boolean {
  if (typeof value === "string") return !/\p{Cs}/u.test(value);
  return (
    value === null ||
    typeof value !== "object" ||
    Object.values(value).every(validText)
  );
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function settled(state: SaveState<unknown>) {
  return (
    state.phase === "idle" &&
    !state.conflict &&
    !state.uncertain &&
    !state.replayPending
  );
}
/** Detached reading authority belongs to this workspace and one observed state generation. */
export class ManagedWatchlistDailyReportContext implements WatchlistDailyReportSource {
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: (() => void)[];
  private fence: readonly unknown[];
  private generation = 0;
  private retired = false;
  constructor(
    private readonly w: ManagedWorkspace,
    private readonly available: () => boolean,
  ) {
    this.fence = this.readFence();
    this.unsubscribe = [
      w,
      w.sessionOwner,
      w.filingsReview,
      w.coordinator,
      w.followups,
      w.followups.coordinator,
      w.valuationAssumptions,
      w.valuationAssumptions.coordinator,
      w.watchlistValuationReview,
    ].map((source) => source.subscribe(() => this.reconcile()));
    this.unsubscribe.push(
      w.valuation.subscribeDraftFileActivity(() => this.reconcile()),
    );
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private readFence(): readonly unknown[] {
    const w = this.w,
      route = w.getSnapshot();
    return [
      this.available(),
      route.view,
      route.snapshot,
      route.research,
      route.companyRoute,
      w.sessionOwner.getSnapshot(),
      w.filingsReview.getSnapshot(),
      w.coordinator.getSnapshot(),
      w.followups.getSnapshot(),
      w.followups.coordinator.getSnapshot(),
      w.valuationAssumptions.getSnapshot(),
      w.valuationAssumptions.coordinator.getSnapshot(),
      w.watchlistValuationReview.getSnapshot(),
      w.getWatchlistDraftFileActivityRevision(),
      w.followups.getDraftFileActivityRevision(),
      w.valuation.getDraftFileActivityRevision(),
      w.getResearchDraftSetRoute().blocked,
    ];
  }
  private reconcile() {
    const next = this.readFence();
    if (next.some((value, i) => value !== this.fence[i])) {
      this.fence = next;
      this.generation++;
      for (const listener of this.listeners) listener();
    }
  }
  private ready() {
    const w = this.w,
      group = w.filingsReview.getSnapshot();
    return (
      !this.retired &&
      this.available() &&
      w.sessionOwner.getSnapshot().phase === "active" &&
      group.active &&
      !group.catalogChanged &&
      group.daily?.phase === "finished" &&
      group.rows.length > 0 &&
      group.rows.length <= 5 &&
      group.rows.length === group.chosen.length &&
      group.rows.every(
        (r, i) =>
          r.member === group.chosen[i] &&
          !!r.filings.selection &&
          !r.filings.running &&
          !r.price?.running,
      ) &&
      w.coordinator.getSnapshot().latestLoaded &&
      !!w.coordinator.getSnapshot().draft &&
      [
        w.coordinator.getSnapshot(),
        w.followups.coordinator.getSnapshot(),
        w.valuationAssumptions.coordinator.getSnapshot(),
      ].every(settled)
    );
  }
  capture = () => {
    this.w.watchlistValuationReview.reconcile();
    this.reconcile();
    if (!this.ready()) return null;
    const w = this.w,
      generation = this.generation;
    let valid = true;
    const current = () => {
      if (!valid) return false;
      this.reconcile();
      valid = this.ready() && this.generation === generation;
      return valid;
    };
    const group = w.filingsReview.getSnapshot();
    const scenario = w.watchlistValuationReview.getSnapshot();
    const plan = scenario.plan;
    const preparedAt = new Date().toISOString();
    const data: PreparedWatchlistDailyReport = {
      kind: "watchlist_daily_review",
      preparedAt,
      daily: {
        phase: "finished",
        plan: group.daily!.plan
          ? {
              names: group.daily!.plan.names,
              rows: group.daily!.plan.rows.map(passiveMember),
            }
          : null,
        outcomes: group.daily!.outcomes.map(passiveMember),
      },
      rows: group.rows.map((row) => ({
        evidence: passiveMember(row),
        watchlist: companyWatchlistReadout(w, row.filings.selection!),
        check: companyFollowupsReadout(w, row.filings.selection!),
      })),
      scenarios: plan
        ? {
            capturedAt: plan.capturedAt,
            collectionVersion: plan.collection.saved.version,
            catalog: plan.collection.catalog,
            rows: plan.rows,
            evaluatedAt: scenario.reading?.evaluatedAt ?? null,
            outcomes: scenario.reading?.rows ?? null,
          }
        : null,
      resources: {
        watchlist: resource(w.coordinator.getSnapshot()),
        followups: resource(w.followups.coordinator.getSnapshot()),
        valuationInputs: resource(
          w.valuationAssumptions.coordinator.getSnapshot(),
        ),
      },
    };
    let report: PreparedWatchlistDailyReport;
    try {
      if (!validText(data)) return null;
      report = freeze(structuredClone(data));
    } catch {
      return null;
    }
    if (!current()) return null;
    reports.add(report);
    return Object.freeze({ report, current });
  };
  retire() {
    if (this.retired) return;
    this.retired = true;
    this.generation++;
    this.unsubscribe.forEach((stop) => stop());
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }
}
