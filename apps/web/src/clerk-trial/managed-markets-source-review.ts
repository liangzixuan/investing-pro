import type { ManagedSourceReadResult } from "./managed-source-read-result";
import type {
  ManagedMarketsSourceReviewState,
  MarketsSourceOutcome,
  MarketsSourceReviewPort,
  MarketsSourceView,
  MarketsSourceReviewRow,
} from "./managed-markets-source-review-types";

interface ReviewOperation {
  readonly tokens: Map<string, unknown>;
  readonly queue: readonly MarketsSourceReviewPort[];
  active: MarketsSourceReviewPort | null;
  finished: boolean;
}

/** One explicit, non-persistent pass through the existing source authorities. */
export class ManagedMarketsSourceReview {
  private state: ManagedMarketsSourceReviewState;
  private readonly listeners = new Set<() => void>();
  private readonly choices = new Map<string, boolean>();
  private readonly outcomes = new Map<string, MarketsSourceOutcome>();
  private readonly observedTokens = new Map<string, unknown>();
  private readonly unsubscribe: (() => void)[];
  private plan: readonly MarketsSourceReviewRow[] = [];
  private previewTokens: Map<string, unknown> | null = null;
  private operation: ReviewOperation | null = null;
  private retired = false;
  private cancelling = false;
  private revision = 0;

  constructor(
    private readonly sources: readonly MarketsSourceReviewPort[],
    private readonly available: () => boolean,
  ) {
    if (
      sources.length > 6 ||
      new Set(sources.map((s) => s.id)).size !== sources.length
    )
      throw new Error("A review requires unique bounded sources.");
    for (const source of sources)
      this.observedTokens.set(source.id, source.read().token);
    this.state = Object.freeze({
      phase: "draft",
      rows: [],
      plan: [],
      message: "Preview selected source reads before starting.",
      canPreview: false,
      canStart: false,
    });
    this.unsubscribe = sources.map((source) =>
      source.subscribe(() => this.observed()),
    );
    this.publish();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private views() {
    return this.sources.map((source) => ({ source, view: source.read() }));
  }
  private selected(source: MarketsSourceReviewPort, view: MarketsSourceView) {
    return view.eligible && (this.choices.get(source.id) ?? !view.loaded);
  }
  private tokensCurrent(tokens: Map<string, unknown>) {
    return this.views().every(
      ({ source, view }) => tokens.get(source.id) === view.token,
    );
  }
  private publish(phase = this.state.phase, message = this.state.message) {
    const revision = this.revision;
    const views = this.retired ? [] : this.views();
    const actionable =
      !this.retired &&
      this.available() &&
      phase !== "running" &&
      views.every(({ view }) => !view.busy);
    const rows = views.map(({ source, view }) => {
      return Object.freeze({
        id: source.id,
        label: view.label,
        identity: view.identity,
        eligible: view.eligible,
        busy: view.busy,
        loaded: view.loaded,
        evidence: view.evidence,
        selected: this.selected(source, view),
        mode: view.loaded ? ("refresh" as const) : ("load" as const),
        outcome:
          this.outcomes.get(source.id) ??
          (view.loaded ? "retained" : "not_attempted"),
      });
    });
    this.state = Object.freeze({
      phase,
      rows: Object.freeze(rows),
      plan: this.plan,
      message,
      canPreview: actionable && rows.some((row) => row.selected),
      canStart:
        actionable &&
        phase === "preview" &&
        this.previewTokens !== null &&
        this.tokensCurrent(this.previewTokens),
    });
    for (const listener of this.listeners) {
      if (revision !== this.revision) break;
      listener();
    }
  }
  private observed() {
    if (this.retired) return;
    const changed = this.views().filter(
      ({ source, view }) => this.observedTokens.get(source.id) !== view.token,
    );
    if (!changed.length) return;
    for (const { source, view } of changed)
      this.observedTokens.set(source.id, view.token);
    if (this.cancelling) return;
    if (
      this.operation &&
      changed.every(({ source }) => source === this.operation?.active) &&
      this.available()
    ) {
      if (this.operation.finished) {
        this.invalidate(false);
        return;
      }
      if (changed.some(({ view }) => !view.busy))
        this.operation.finished = true;
      this.publish();
      return;
    }
    for (const { source } of changed) this.choices.delete(source.id);
    this.invalidate();
  }
  private cancelOwned() {
    const operation = this.operation;
    this.operation = null;
    if (!operation?.active) return;
    this.cancelling = true;
    try {
      operation.active.cancel();
    } finally {
      this.cancelling = false;
    }
  }
  invalidate(cancelOwned = true) {
    if (this.retired) return;
    this.revision++;
    this.previewTokens = null;
    this.plan = [];
    if (cancelOwned) this.cancelOwned();
    else this.operation = null;
    this.outcomes.clear();
    this.publish(
      "retired",
      "Source context changed. Preview a new plan before starting.",
    );
  }
  reconcile() {
    if (!this.available()) {
      if (this.state.phase !== "retired") this.invalidate();
    } else this.publish();
  }
  retire() {
    if (this.retired) return;
    this.invalidate();
    this.retired = true;
    this.choices.clear();
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.publish("retired", "Source review ended with this session.");
  }
  choose(id: string, selected: boolean) {
    if (this.retired || !this.available()) return;
    const source = this.sources.find((source) => source.id === id);
    if (!source || !source.read().eligible || source.read().busy) return;
    this.revision++;
    this.previewTokens = null;
    this.plan = [];
    this.cancelOwned();
    this.outcomes.clear();
    this.choices.set(id, selected);
    this.publish(
      "draft",
      "Selection changed. Preview the selected source reads.",
    );
  }
  preview() {
    this.observed();
    this.publish();
    if (!this.state.canPreview) return;
    this.revision++;
    this.outcomes.clear();
    this.plan = Object.freeze(
      this.state.rows.filter(
        (row) => row.selected && row.eligible && !row.busy,
      ),
    );
    this.previewTokens = new Map(
      this.views().map(({ source, view }) => [source.id, view.token]),
    );
    this.publish(
      "preview",
      "Review the selected Load and Refresh actions, then start explicitly.",
    );
  }
  cancel() {
    if (!this.operation && this.state.phase !== "preview") return;
    this.revision++;
    this.previewTokens = null;
    if (this.operation?.active)
      this.outcomes.set(this.operation.active.id, "cancelled");
    this.cancelOwned();
    this.publish(
      "cancelled",
      "Source review cancelled. Completed packets remain; remaining reads were not attempted.",
    );
  }
  private ready(operation: ReviewOperation) {
    if (this.operation !== operation) return false;
    if (this.available() && this.tokensCurrent(operation.tokens)) return true;
    this.invalidate();
    return false;
  }
  private async read(
    operation: ReviewOperation,
    source: MarketsSourceReviewPort,
  ) {
    if (!this.ready(operation)) return false;
    if (!source.read().eligible || source.read().busy) {
      this.invalidate();
      return false;
    }
    operation.active = source;
    operation.finished = false;
    this.outcomes.set(source.id, "running");
    this.publish("running", `Reading ${source.read().label}…`);
    if (!this.ready(operation)) return false;
    let result: ManagedSourceReadResult;
    try {
      result = await source.load();
    } catch {
      result = "failed";
    }
    if (this.operation !== operation) return false;
    operation.tokens.set(source.id, source.read().token);
    if (!this.ready(operation)) return false;
    const view = source.read();
    operation.active = null;
    if (result === "accepted" && view.loaded && !view.busy) {
      this.outcomes.set(source.id, view.empty ? "checked_empty" : "checked");
      this.publish();
      return this.ready(operation);
    }
    this.outcomes.set(
      source.id,
      result === "cancelled" ? "cancelled" : "failed",
    );
    this.operation = null;
    this.publish(
      "stopped",
      `${view.label} did not complete. Inspect its source panel; remaining reads were not attempted.`,
    );
    return false;
  }
  async start() {
    this.observed();
    this.publish();
    if (!this.state.canStart || !this.previewTokens || this.operation) return;
    const queue = this.plan.map((row) =>
      this.sources.find((source) => source.id === row.id)!,
    );
    const operation: ReviewOperation = {
      tokens: new Map(this.previewTokens),
      queue,
      active: null,
      finished: false,
    };
    this.operation = operation;
    this.previewTokens = null;
    this.outcomes.clear();
    this.publish("running", "Reading the selected sources in order…");
    for (const source of queue)
      if (!(await this.read(operation, source))) return;
    if (!this.ready(operation)) return;
    this.operation = null;
    this.publish(
      "complete",
      "Selected reads completed. Each source keeps its own dates and qualifications.",
    );
  }
}
