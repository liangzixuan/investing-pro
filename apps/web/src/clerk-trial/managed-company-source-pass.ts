import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedCompanyFilings } from "./managed-company-filings";
import type { ManagedEodHistory } from "./managed-eod-history";
import type { ManagedInterimReport } from "./managed-interim-report";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import {
  companySnapshotLoadSources,
  type CompanySnapshotLoadSource,
  type SnapshotLoadSource,
} from "./managed-company-snapshot-load-sources";
import {
  CompanySourcePassRun,
  ReviewedCompanySourcePlan,
  type CompanySourcePassObservation,
} from "./managed-company-source-pass-plan";
import {
  idleCompanySourcePass,
  type CompanySourcePassPreview,
  type ManagedCompanySourcePassState,
} from "./managed-company-source-pass-state";
export type {
  CompanySourceDisposition,
  CompanySourcePassRow,
  CompanySourcePassPreview,
  ManagedCompanySourcePassState,
} from "./managed-company-source-pass-state";

/** Owns only a reviewed plan. All source reads use the existing bounded loader. */
export class ManagedCompanySourcePass {
  private state = idleCompanySourcePass();
  private readonly sources: readonly SnapshotLoadSource[];
  private readonly listeners = new Set<() => void>();
  private plan: ReviewedCompanySourcePlan | null = null;
  private run: CompanySourcePassRun | null = null;
  private preparing = false;
  private revision = 0;
  private tokens: readonly unknown[];
  constructor(
    private readonly loader: ManagedCompanySnapshotLoad,
    price: ManagedEodHistory,
    annual: ManagedAnnualReport,
    filings: ManagedCompanyFilings,
    interim: ManagedInterimReport,
  ) {
    this.sources = companySnapshotLoadSources(price, annual, filings, interim);
    this.tokens = this.sourceTokens();
    for (const source of this.sources)
      source.model.subscribe(() => this.observed());
    loader.subscribe(() => this.loaderChanged());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private sourceTokens() {
    return this.sources.map((source) => source.model.getSnapshot());
  }
  private publish(next: ManagedCompanySourcePassState) {
    const revision = ++this.revision;
    this.state = Object.freeze(next);
    for (const listener of this.listeners) {
      if (revision !== this.revision) return;
      listener();
    }
  }
  private observed() {
    const tokens = this.sourceTokens();
    if (tokens.every((token, index) => token === this.tokens[index])) return;
    this.tokens = tokens;
    if (this.run) {
      this.loaderChanged();
      return;
    }
    if (this.plan || this.state.phase === "finished") this.invalidate();
  }
  private invalidate() {
    this.plan = null;
    this.publish({
      ...this.state,
      preview: null,
      phase: "invalidated",
      message: "Company visit or source state changed. Preview a new pass.",
    });
  }
  private loaderChanged() {
    const run = this.run;
    if (!run) return;
    const observation = run.observe(this.loader);
    if (observation) this.publishRun(run, observation);
  }
  private publishRun(
    run: CompanySourcePassRun,
    observation: CompanySourcePassObservation,
  ) {
    const load = observation.state;
    if (!load.running) this.releaseRun();
    this.publish({
      preview: null,
      phase: load.running ? "running" : "finished",
      rows: run.rows(this.sources, observation),
      message: load.message,
    });
  }
  private releaseRun() {
    this.run = null;
    this.tokens = this.sourceTokens();
  }
  private busy() {
    if (this.preparing) return true;
    if (this.run) return true;
    return this.loader.getSnapshot().running;
  }
  prepare(
    selection: ManagedResearchSelection,
    admitted: () => boolean,
    names: readonly CompanySnapshotLoadSource[],
  ): CompanySourcePassPreview | null {
    if (this.busy()) return null;
    this.preparing = true;
    try {
      return this.capturePreview(selection, admitted, names);
    } finally {
      this.preparing = false;
    }
  }
  private capturePreview(
    selection: ManagedResearchSelection,
    admitted: () => boolean,
    names: readonly CompanySnapshotLoadSource[],
  ) {
    const revision = this.revision;
    this.plan = null;
    const plan = ReviewedCompanySourcePlan.capture(
      this.sources,
      selection,
      admitted,
      names,
    );
    if (!plan) return this.refusePreview();
    const allowed = plan.admitted();
    if (revision !== this.revision) return null;
    if (!allowed) return this.refusePreview();
    if (!plan.ready()) return this.refusePreview();
    return this.publishPreview(plan);
  }
  private refusePreview() {
    this.invalidate();
    return null;
  }
  private publishPreview(plan: ReviewedCompanySourcePlan) {
    this.plan = plan;
    this.tokens = this.sourceTokens();
    const handle = plan.handle;
    this.publish({
      preview: handle,
      phase: "preview",
      rows: handle.rows,
      message: "Review the selected missing sources, then run this pass.",
    });
    return this.plan === plan ? handle : null;
  }
  private claim(handle: CompanySourcePassPreview) {
    const plan = this.plan;
    if (!plan) return null;
    if (plan.handle !== handle) return null;
    if (this.run) return null;
    // Consume before admission callbacks or notifications can reenter start.
    this.plan = null;
    const run = new CompanySourcePassRun(plan);
    this.run = run;
    return run;
  }
  private refuseRun() {
    this.run = null;
    this.invalidate();
    return false;
  }
  private admitRun(run: CompanySourcePassRun) {
    const allowed = run.plan.admitted();
    if (this.run !== run) return false;
    if (!allowed) return this.refuseRun();
    return true;
  }
  private readyToStart(run: CompanySourcePassRun) {
    if (!this.admitRun(run)) return false;
    if (!run.plan.ready()) return this.refuseRun();
    if (this.loader.getSnapshot().running) return this.refuseRun();
    return true;
  }
  private announce(run: CompanySourcePassRun) {
    this.publish({
      preview: null,
      phase: "running",
      rows: run.plan.handle.rows,
      message: "Starting reviewed company source pass…",
    });
  }
  private readyToRun(run: CompanySourcePassRun) {
    if (this.run !== run) return false;
    if (!this.admitRun(run)) return false;
    if (!run.plan.unchanged()) return this.refuseRun();
    if (this.loader.getSnapshot().running) return this.refuseRun();
    return true;
  }
  async start(handle: CompanySourcePassPreview): Promise<void> {
    const run = this.claim(handle);
    if (!run) return;
    if (!this.readyToStart(run)) return;
    this.announce(run);
    if (!this.readyToRun(run)) return;
    await this.loader.startReviewed(
      handle.selection,
      () => this.run === run && run.plan.admitted(),
      handle.names,
      run.owner,
    );
    this.finishRun(run);
  }
  private finishRun(run: CompanySourcePassRun) {
    if (this.run !== run) return;
    const result = run.result(this.loader);
    this.releaseRun();
    this.publish({
      preview: null,
      phase: "finished",
      rows: run.rows(this.sources, result),
      message: result.state.message,
    });
  }
  private cancelledRows(run: CompanySourcePassRun | null) {
    return run ? run.cancelledRows(this.sources, this.loader) : this.state.rows;
  }
  cancel() {
    const run = this.run;
    if (!run && this.plan === null) return;
    const revision = ++this.revision;
    this.plan = null;
    this.run = null;
    if (run) this.loader.cancelReviewed(run.owner);
    if (revision !== this.revision) return;
    const rows = this.cancelledRows(run);
    this.tokens = this.sourceTokens();
    this.publish({
      preview: null,
      phase: "cancelled",
      rows,
      message:
        "Company source pass cancelled. No remaining sources were requested.",
    });
  }
  clear() {
    const run = this.run;
    const revision = ++this.revision;
    this.plan = null;
    this.run = null;
    if (run) this.loader.cancelReviewed(run.owner);
    if (revision !== this.revision) return;
    this.tokens = this.sourceTokens();
    this.publish(idleCompanySourcePass());
  }
  private reconcilePlan(plan: ReviewedCompanySourcePlan) {
    if (!plan.admitted()) {
      this.invalidate();
      return;
    }
    if (!plan.ready()) this.invalidate();
  }
  reconcile() {
    this.observed();
    if (this.plan) this.reconcilePlan(this.plan);
    const run = this.run;
    if (run && !run.plan.admitted()) this.cancel();
  }
}
