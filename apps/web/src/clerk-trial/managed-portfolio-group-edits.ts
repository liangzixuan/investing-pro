import {
  parsePortfolioPayload,
  projectPersonalPortfolioLedger,
  type ManagedPortfolioPayload,
  type PersonalPortfolioLedgerProjection,
} from "@research-cockpit/contracts";
import type { PortfolioGroupEditLease } from "./managed-portfolio";
import type { ManagedWorkspace } from "./managed-workspace";

export type GroupEditProjection = Extract<
  PersonalPortfolioLedgerProjection,
  { status: "valid" }
>;
export interface ManagedPortfolioGroupEditsState {
  readonly phase: "idle" | "editing" | "preview" | "applied" | "retired";
  readonly baseline: ManagedPortfolioPayload | null;
  readonly candidate: ManagedPortfolioPayload | null;
  readonly before: GroupEditProjection | null;
  readonly after: GroupEditProjection | null;
  readonly evaluationDay: string | null;
  readonly formPending: boolean;
  readonly message: string;
}
const empty = (
  phase: ManagedPortfolioGroupEditsState["phase"] = "idle",
  message = "",
): ManagedPortfolioGroupEditsState =>
  Object.freeze({
    phase,
    baseline: null,
    candidate: null,
    before: null,
    after: null,
    evaluationDay: null,
    formPending: false,
    message,
  });
const stale =
  "The Portfolio, catalog or visit changed. Start a new edit group.";
function day(now: Date) {
  return Number.isFinite(now.getTime()) ? now.toISOString().slice(0, 10) : null;
}
function sameRegistry(a: ManagedPortfolioPayload, b: ManagedPortfolioPayload) {
  return (
    a.schemaVersion === 3 &&
    a.snapshotSha256 === b.snapshotSha256 &&
    a.name === b.name &&
    a.currency === b.currency &&
    a.basisMethod === b.basisMethod &&
    JSON.stringify(a.identities) === JSON.stringify(b.identities)
  );
}
/** Temporary authored edits. Only the explicit, single-use apply writes a Portfolio draft. */
export class ManagedPortfolioGroupEdits {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private lease: PortfolioGroupEditLease | null = null;
  private context: (() => boolean) | null = null;
  private route: (() => boolean) | null = null;
  private unsubscribe: (() => void)[] = [];
  private disposed = false;
  private busy = false;
  constructor(
    private readonly workspace: ManagedWorkspace,
    private readonly routeActive: () => boolean = () => true,
    private readonly now: () => Date = () => new Date(),
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedPortfolioGroupEditsState>) {
    this.state = Object.freeze({ ...this.state, ...next });
    for (const listener of this.listeners) listener();
  }
  private detach() {
    this.unsubscribe.splice(0).forEach((off) => off());
  }
  private release() {
    const lease = this.lease;
    this.lease = null;
    this.context = null;
    this.route = null;
    this.detach();
    if (lease) this.workspace.portfolio.cancelGroupedEdits(lease);
  }
  private retire(message = stale) {
    this.settle("retired", message);
  }
  private settle(phase: "idle" | "retired", message = "") {
    if (this.busy) return;
    this.busy = true;
    try {
      this.release();
      this.state = empty(phase, message);
      this.update({});
    } finally {
      this.busy = false;
    }
  }
  private current() {
    if (this.disposed || this.busy || !this.lease || !this.context)
      return false;
    if (!this.context()) {
      this.retire();
      return false;
    }
    return true;
  }
  private reconcile = () => {
    if (!this.busy && this.lease && !this.context?.()) this.retire();
  };
  start() {
    if (this.disposed || this.busy || this.lease || !this.routeActive())
      return false;
    const route = this.workspace.capturePortfolioGroupEditsRoute();
    if (!route) {
      this.update({
        message:
          "Open Portfolio in an active session before starting an edit group.",
      });
      return false;
    }
    const model = this.workspace.portfolio;
    const lease = model.beginGroupedEdits();
    if (!lease || !lease.draft.ledger) {
      const saved = model.coordinator.getSnapshot();
      const state = model.getSnapshot();
      const message =
        !saved.latestLoaded ||
        !saved.draft?.ledger ||
        !saved.saved ||
        saved.baseVersion !== saved.saved.version
          ? "Load the latest Portfolio and finish its setup before starting an edit group."
          : saved.phase !== "idle" ||
              saved.conflict ||
              saved.uncertain ||
              saved.replayPending
            ? "Finish the Portfolio save or recovery before starting an edit group."
            : state.pendingEditor || state.review || state.reviewing
              ? "Apply or reset the Portfolio form and finish its identity review first."
              : model.hasDraftFileActivity()
                ? "Finish or cancel the Portfolio file operation first."
                : "Review Portfolio identities against the current catalog and correct its ledger before starting a group.";
      this.update({ message });
      return false;
    }
    this.lease = lease;
    this.route = route;
    const saved = model.coordinator.getSnapshot();
    const portfolio = model.getSnapshot();
    const session = this.workspace.sessionOwner.getSnapshot();
    const view = this.workspace.getSnapshot();
    const fileActivity = model.getDraftFileActivityRevision();
    let retired = false;
    this.context = () => {
      if (
        !model.ownsGroupedEdits(lease) ||
        model.coordinator.getSnapshot() !== saved ||
        model.getSnapshot() !== portfolio ||
        this.workspace.sessionOwner.getSnapshot() !== session ||
        this.workspace.getSnapshot() !== view ||
        model.getDraftFileActivityRevision() !== fileActivity ||
        !route() ||
        !this.routeActive()
      )
        retired = true;
      return !retired;
    };
    this.unsubscribe = [
      model.subscribe(this.reconcile),
      model.coordinator.subscribe(this.reconcile),
      this.workspace.subscribe(this.reconcile),
      this.workspace.sessionOwner.subscribe(this.reconcile),
    ];
    if (!this.current()) {
      this.release();
      return false;
    }
    const candidate = parsePortfolioPayload(lease.draft.ledger);
    if (!candidate || candidate.schemaVersion !== 3) {
      this.retire();
      return false;
    }
    this.state = Object.freeze({
      ...empty("editing"),
      baseline: lease.draft.ledger,
      candidate,
    });
    this.update({});
    return this.state.phase === "editing" && this.current();
  }
  replaceCandidate(
    expectedCandidate: ManagedPortfolioPayload,
    value: ManagedPortfolioPayload,
  ) {
    if (
      !this.current() ||
      this.state.phase !== "editing" ||
      this.state.candidate !== expectedCandidate
    )
      return false;
    const candidate = parsePortfolioPayload(value),
      baseline = this.state.baseline,
      today = day(this.now());
    if (
      !candidate ||
      !baseline ||
      !today ||
      !sameRegistry(candidate, baseline) ||
      projectPersonalPortfolioLedger(candidate, today).status !== "valid"
    ) {
      this.update({
        message:
          "The complete edit group is invalid. Correct the ledger before continuing.",
      });
      return false;
    }
    this.update({
      candidate,
      formPending: false,
      before: null,
      after: null,
      evaluationDay: null,
      message: "",
    });
    return true;
  }
  setEditorPending(
    expectedCandidate: ManagedPortfolioPayload,
    pending: boolean,
  ) {
    if (
      !this.current() ||
      this.state.phase !== "editing" ||
      this.state.candidate !== expectedCandidate ||
      this.state.formPending === pending
    )
      return;
    this.update({ formPending: pending, message: "" });
  }
  preview() {
    if (
      !this.current() ||
      this.state.phase !== "editing" ||
      this.state.formPending
    )
      return false;
    const { baseline, candidate } = this.state;
    const evaluationDay = day(this.now());
    if (!baseline || !candidate || !evaluationDay) return false;
    const before = projectPersonalPortfolioLedger(baseline, evaluationDay);
    const after = projectPersonalPortfolioLedger(candidate, evaluationDay);
    if (
      before.status !== "valid" ||
      after.status !== "valid" ||
      !sameRegistry(candidate, baseline)
    )
      return false;
    if (JSON.stringify(baseline) === JSON.stringify(candidate)) {
      this.update({ message: "Make a change before previewing the group." });
      return false;
    }
    this.update({
      phase: "preview",
      before,
      after,
      evaluationDay,
      message: "",
    });
    return true;
  }
  edit() {
    if (!this.current() || this.state.phase !== "preview") return false;
    this.update({
      phase: "editing",
      before: null,
      after: null,
      evaluationDay: null,
      message: "",
    });
    return true;
  }
  apply(expectedState: ManagedPortfolioGroupEditsState) {
    if (
      !this.current() ||
      this.state !== expectedState ||
      this.state.phase !== "preview" ||
      !this.state.candidate ||
      !this.state.evaluationDay ||
      !this.lease
    )
      return false;
    if (day(this.now()) !== this.state.evaluationDay) {
      this.update({
        phase: "editing",
        before: null,
        after: null,
        evaluationDay: null,
        message: "The UTC day changed. Preview the group again.",
      });
      return false;
    }
    const lease = this.lease,
      route = this.route,
      candidate = this.state.candidate;
    const evaluationDay = this.state.evaluationDay;
    this.busy = true;
    this.detach();
    this.lease = null;
    this.context = null;
    this.route = null;
    const installed = this.workspace.portfolio.applyGroupedEdits(
      lease,
      candidate,
      evaluationDay,
    );
    this.workspace.portfolio.cancelGroupedEdits(lease);
    const success =
      installed !== null &&
      !this.disposed &&
      this.routeActive() &&
      route?.() === true &&
      this.workspace.portfolio.coordinator.getSnapshot().draft === installed;
    this.busy = false;
    this.state = empty(
      success ? "applied" : "retired",
      success
        ? "Edit group applied to the Portfolio draft. Review and Save Portfolio separately."
        : stale,
    );
    this.update({});
    return success;
  }
  cancel() {
    this.settle("idle");
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.state = empty("retired", stale);
    this.listeners.clear();
  }
}
