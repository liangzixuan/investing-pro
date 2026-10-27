import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedCompanyFilings } from "./managed-company-filings";
import type { ManagedEodHistory } from "./managed-eod-history";
import type { ManagedInterimReport } from "./managed-interim-report";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type {
  CompanySourceOutcome,
  CompanySourceOutcomes,
  ManagedCompanySnapshotLoad,
} from "./managed-company-snapshot-load";
import { CompanySnapshotLoadOperation } from "./managed-company-snapshot-load-operation";
import {
  companySnapshotLoadSources,
  reviewedSourceNames,
  type CompanySnapshotLoadSource,
  type SnapshotLoadSource,
  type SnapshotSourceState,
} from "./managed-company-snapshot-load-sources";

export type CompanySourceDisposition = CompanySourceOutcome | "missing";
export interface CompanySourcePassRow {
  readonly id: CompanySnapshotLoadSource;
  readonly name: CompanySnapshotLoadSource;
  readonly label: string;
  readonly selected: boolean;
  readonly disposition: CompanySourceDisposition;
  readonly evidence: Readonly<{ completedAt: string | null; message: string }>;
}
export interface CompanySourcePassPreview {
  readonly selection: ManagedResearchSelection;
  readonly names: readonly CompanySnapshotLoadSource[];
  readonly rows: readonly CompanySourcePassRow[];
}
export interface ManagedCompanySourcePassState {
  readonly preview: CompanySourcePassPreview | null;
  readonly phase:
    "idle" | "preview" | "running" | "finished" | "cancelled" | "invalidated";
  readonly rows: readonly CompanySourcePassRow[];
  readonly message: string;
}
interface ReviewedPlan {
  readonly handle: CompanySourcePassPreview;
  readonly operation: CompanySnapshotLoadOperation;
}
interface PassRun {
  readonly owner: object;
  readonly plan: ReviewedPlan;
  started: boolean;
}
function completedAt(state: SnapshotSourceState): string | null {
  const response = state.response;
  if (!response || typeof response !== "object") return null;
  if ("completedAt" in response && typeof response.completedAt === "string")
    return response.completedAt;
  if (!("evidence" in response)) return null;
  const evidence = response.evidence;
  if (!evidence || typeof evidence !== "object" || !("generation" in evidence))
    return null;
  const generation = evidence.generation;
  return generation &&
    typeof generation === "object" &&
    "completedAt" in generation &&
    typeof generation.completedAt === "string"
    ? generation.completedAt
    : null;
}
/** Owns only a reviewed plan. All source reads use the existing bounded loader. */
export class ManagedCompanySourcePass {
  private state: ManagedCompanySourcePassState = Object.freeze({
    preview: null,
    phase: "idle",
    rows: Object.freeze([]),
    message: "",
  });
  private readonly sources: readonly SnapshotLoadSource[];
  private readonly listeners = new Set<() => void>();
  private plan: ReviewedPlan | null = null;
  private run: PassRun | null = null;
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
  private rows(
    selection: ManagedResearchSelection,
    names: readonly CompanySnapshotLoadSource[],
    running: boolean,
    outcomes: CompanySourceOutcomes = this.loader.getSnapshot().outcomes,
    states?: readonly SnapshotSourceState[],
  ) {
    return Object.freeze(
      this.sources.map((source, index) => {
        const state = states?.[index] ?? source.model.getSnapshot();
        const selected = names.includes(source.name);
        let disposition: CompanySourceDisposition = selected
          ? "missing"
          : "not_attempted";
        if (state.response !== null) disposition = "retained";
        else if (!source.covered(selection)) disposition = "unsupported";
        if (running && selected) disposition = outcomes[source.name];
        return Object.freeze({
          id: source.name,
          name: source.name,
          label: source.label,
          selected,
          disposition,
          evidence: Object.freeze({
            completedAt: completedAt(state),
            message: state.message,
          }),
        });
      }),
    );
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
    const result = this.loader.getReviewedResult(run.owner);
    const load = result?.state ?? this.loader.getSnapshot();
    if (!result && !this.loader.ownsReviewed(run.owner)) return;
    if (!run.started && !load.running) return;
    if (load.running) run.started = true;
    const { selection, names } = run.plan.handle;
    const rows = this.rows(
      selection,
      names,
      true,
      load.outcomes,
      result?.sources,
    );
    if (!load.running) {
      this.run = null;
      this.tokens = this.sourceTokens();
    }
    this.publish({
      preview: null,
      phase: load.running ? "running" : "finished",
      rows,
      message: load.message,
    });
  }
  prepare(
    selection: ManagedResearchSelection,
    admitted: () => boolean,
    names: readonly CompanySnapshotLoadSource[],
  ): CompanySourcePassPreview | null {
    if (this.preparing || this.run || this.loader.getSnapshot().running)
      return null;
    this.preparing = true;
    try {
      const revision = this.revision;
      this.plan = null;
      const valid = reviewedSourceNames(names);
      if (!valid) {
        this.invalidate();
        return null;
      }
      const operation = new CompanySnapshotLoadOperation(
        this.sources,
        selection,
        admitted,
      );
      const allowed = operation.admitted();
      if (revision !== this.revision) return null;
      if (!allowed || !operation.unchanged() || !operation.canStart()) {
        this.invalidate();
        return null;
      }
      const handle = Object.freeze({
        selection: operation.captured,
        names: valid,
        rows: this.rows(operation.captured, valid, false),
      });
      const plan = { handle, operation };
      this.plan = plan;
      this.tokens = this.sourceTokens();
      this.publish({
        preview: handle,
        phase: "preview",
        rows: handle.rows,
        message: "Review the selected missing sources, then run this pass.",
      });
      return this.plan === plan ? handle : null;
    } finally {
      this.preparing = false;
    }
  }
  async start(handle: CompanySourcePassPreview): Promise<void> {
    const plan = this.plan;
    if (!plan || plan.handle !== handle || this.run) return;
    // Consume before admission callbacks or notifications can reenter start.
    this.plan = null;
    const run: PassRun = { owner: Object.freeze({}), plan, started: false };
    this.run = run;
    const allowed = plan.operation.admitted();
    if (this.run !== run) return;
    if (
      !allowed ||
      !plan.operation.unchanged() ||
      !plan.operation.canStart() ||
      this.loader.getSnapshot().running
    ) {
      this.run = null;
      this.invalidate();
      return;
    }
    this.publish({
      preview: null,
      phase: "running",
      rows: handle.rows,
      message: "Starting reviewed company source pass…",
    });
    if (this.run !== run) return;
    const stillAllowed = plan.operation.admitted();
    if (this.run !== run) return;
    if (!stillAllowed || !plan.operation.unchanged()) {
      this.run = null;
      this.invalidate();
      return;
    }
    await this.loader.startReviewed(
      handle.selection,
      () => this.run === run && plan.operation.admitted(),
      handle.names,
      run.owner,
    );
    if (this.run === run) {
      const result = this.loader.getReviewedResult(run.owner);
      this.run = null;
      this.tokens = this.sourceTokens();
      this.publish({
        preview: null,
        phase: "finished",
        rows: this.rows(
          handle.selection,
          handle.names,
          true,
          result?.state.outcomes,
          result?.sources,
        ),
        message: result?.state.message ?? this.loader.getSnapshot().message,
      });
    }
  }
  cancel() {
    const run = this.run;
    const hadPreview = this.plan !== null;
    if (!run && !hadPreview) return;
    const revision = ++this.revision;
    this.plan = null;
    this.run = null;
    if (run) this.loader.cancelReviewed(run.owner);
    if (revision !== this.revision) return;
    const result = run ? this.loader.getReviewedResult(run.owner) : null;
    const rows = run
      ? result
        ? this.rows(
            run.plan.handle.selection,
            run.plan.handle.names,
            true,
            result.state.outcomes,
            result.sources,
          )
        : Object.freeze(
            run.plan.handle.rows.map((row) =>
              Object.freeze({
                ...row,
                disposition:
                  row.disposition === "missing"
                    ? ("not_attempted" as const)
                    : row.disposition,
              }),
            ),
          )
      : this.state.rows;
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
    this.publish({
      preview: null,
      phase: "idle",
      rows: Object.freeze([]),
      message: "",
    });
  }
  reconcile() {
    this.observed();
    const plan = this.plan;
    if (
      plan &&
      (!plan.operation.admitted() ||
        !plan.operation.unchanged() ||
        !plan.operation.canStart())
    )
      this.invalidate();
    const run = this.run;
    if (run && !run.plan.operation.admitted()) this.cancel();
  }
}
