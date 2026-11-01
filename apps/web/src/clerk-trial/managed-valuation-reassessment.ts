import {
  membershipMatchesResult,
  type ValuationAssumptionEntry,
  type ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationAssumptions } from "./managed-valuation-assumptions";
import { type ManagedConfirmedValuationCapture } from "./managed-valuation-assumptions";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import {
  evaluateValuationInputs,
  type ManagedValuationCalculation,
  type ManagedValuationSnapshot,
} from "./managed-valuation-workbench";
import type { SaveState } from "./save-coordinator";

export interface ManagedValuationReassessmentBaseline {
  readonly capture: ManagedConfirmedValuationCapture;
  readonly capturedAt: string;
}
export interface ManagedValuationReassessmentReading {
  readonly savedCalculation: ManagedValuationCalculation;
  readonly revisedCalculation: ManagedValuationCalculation;
  readonly evaluatedAt: string;
}
export interface ManagedValuationReassessmentState {
  readonly baseline: ManagedValuationReassessmentBaseline | null;
  readonly reading: ManagedValuationReassessmentReading | null;
  readonly active: boolean;
}

function sameOwner(
  left: ManagedResearchSelection,
  right: ManagedResearchSelection | null,
) {
  return (
    right !== null &&
    left.catalogSnapshotSha256 === right.catalogSnapshotSha256 &&
    left.cik === right.cik &&
    membershipMatchesResult({ ...left.listing, note: "" }, right.listing)
  );
}

/** A passive saved baseline beside the one existing editable valuation workbench. */
export class ManagedValuationReassessment {
  private state: ManagedValuationReassessmentState = Object.freeze({
    baseline: null,
    reading: null,
    active: false,
  });
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: (() => void)[];
  private owner: ManagedResearchSelection | null = null;
  private replacement: object | null = null;
  private observedEditor: ManagedValuationSnapshot;
  private paused = false;
  private retired = false;
  private calculating = false;

  constructor(
    private readonly workbench: ManagedValuationWorkbench,
    private readonly assumptions: ManagedValuationAssumptions,
    private readonly options: { now(): string; available?(): boolean },
  ) {
    this.observedEditor = workbench.getSnapshot();
    this.unsubscribe = [
      workbench.subscribe(() => this.editorChanged()),
      workbench.subscribeDraftFileActivity(() => this.reconcile()),
      assumptions.subscribe(() => this.reconcile()),
    ];
  }
  getSnapshot = (): ManagedValuationReassessmentState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private available() {
    return !this.retired && (this.options.available?.() ?? true);
  }
  private baselineCurrent() {
    const baseline = this.state.baseline;
    return (
      baseline !== null &&
      this.assumptions.isConfirmedEntryCaptureCurrent(baseline.capture) &&
      this.replacement === this.workbench.getInputReplacementRevision() &&
      !this.workbench.getSnapshot().retired
    );
  }
  private liveOwner() {
    const editor = this.workbench.getSnapshot();
    return (
      this.owner !== null &&
      editor.editable &&
      sameOwner(this.owner, editor.owner) &&
      sameOwner(this.owner, editor.context)
    );
  }
  private publish(state: ManagedValuationReassessmentState) {
    const installed = Object.freeze(state);
    this.state = installed;
    for (const listener of [...this.listeners]) listener();
    return this.state === installed ? installed : null;
  }
  canCapture(
    entry: ValuationAssumptionEntry,
    expected: SaveState<ValuationAssumptionsPayload> = this.assumptions.coordinator.getSnapshot(),
  ) {
    return (
      this.available() &&
      !this.paused &&
      !this.calculating &&
      this.assumptions.canCaptureConfirmedEntry(entry, expected)
    );
  }
  capture(
    entry: ValuationAssumptionEntry,
    expected: SaveState<ValuationAssumptionsPayload> = this.assumptions.coordinator.getSnapshot(),
  ): ManagedValuationReassessmentState | null {
    if (!this.canCapture(entry, expected)) return null;
    const before = this.state,
      editor = this.workbench.getSnapshot();
    const capturedAt = this.options.now();
    if (
      !Number.isFinite(Date.parse(capturedAt)) ||
      before !== this.state ||
      editor !== this.workbench.getSnapshot() ||
      !this.canCapture(entry, expected)
    )
      return null;
    const capture = this.assumptions.captureConfirmedEntry(entry, expected);
    if (!capture || !editor.owner) return null;
    this.owner = editor.owner;
    this.replacement = this.workbench.getInputReplacementRevision();
    this.observedEditor = editor;
    const installed = this.publish({
      baseline: Object.freeze({ capture, capturedAt }),
      reading: null,
      active: true,
    });
    this.reconcile();
    return installed === this.state && this.state.active ? installed : null;
  }
  canCalculate(
    expected: ManagedValuationReassessmentState,
    editor: ManagedValuationSnapshot,
  ) {
    return (
      expected === this.state &&
      editor === this.workbench.getSnapshot() &&
      this.state.active &&
      !this.calculating &&
      !this.paused &&
      this.available() &&
      this.baselineCurrent() &&
      this.liveOwner() &&
      !editor.inputIssue
    );
  }
  calculate(
    expected: ManagedValuationReassessmentState,
    editor: ManagedValuationSnapshot,
  ): ManagedValuationReassessmentState | null {
    if (!this.canCalculate(expected, editor)) return null;
    const evaluatedAt = this.options.now();
    if (
      !Number.isFinite(Date.parse(evaluatedAt)) ||
      !this.canCalculate(expected, editor)
    )
      return null;
    const entry = expected.baseline!.capture.entry;
    // The baseline result is never registered by workbench.calculate.
    const savedCalculation = evaluateValuationInputs(
      Object.freeze({
        ...editor.owner!,
        catalogSnapshotSha256: entry.catalogSnapshotSha256,
        listing: entry.listing,
        cik: entry.cik,
      }),
      entry.dcf.inputs,
      entry.exit.inputs,
    );
    this.calculating = true;
    try {
      const revisedCalculation = this.workbench.calculate();
      const current = this.workbench.getSnapshot();
      if (
        !revisedCalculation ||
        expected !== this.state ||
        !this.available() ||
        !this.baselineCurrent() ||
        !this.liveOwner() ||
        this.paused ||
        current.calculation !== revisedCalculation ||
        current.dcfDraft !== editor.dcfDraft ||
        current.exitDraft !== editor.exitDraft ||
        current.inputIssue
      )
        return null;
      const installed = this.publish({
        ...expected,
        reading: Object.freeze({
          savedCalculation,
          revisedCalculation,
          evaluatedAt,
        }),
      });
      this.reconcile();
      if (
        installed !== this.state ||
        !this.state.active ||
        current !== this.workbench.getSnapshot()
      )
        return null;
      return installed;
    } finally {
      this.calculating = false;
    }
  }
  cancel(
    expected: ManagedValuationReassessmentState,
  ): ManagedValuationReassessmentState | null {
    if (expected !== this.state || this.retired) return null;
    this.owner = null;
    this.replacement = null;
    this.paused = false;
    return this.publish({ baseline: null, reading: null, active: false });
  }
  /** Call before the explicit owned Back closes the visit and source models. */
  pauseForOwnedBack(): void {
    if (!this.state.baseline || !this.baselineCurrent() || !this.liveOwner()) {
      this.invalidate();
      return;
    }
    this.paused = true;
    this.publish({ ...this.state, active: false });
  }
  canResumeOwned(selection: ManagedResearchSelection): boolean {
    return (
      !this.retired &&
      this.paused &&
      this.baselineCurrent() &&
      this.owner !== null &&
      sameOwner(this.owner, selection)
    );
  }
  resumeOwned(): ManagedValuationReassessmentState | null {
    const context = this.workbench.getSnapshot().context;
    if (
      !context ||
      !this.canResumeOwned(context) ||
      !this.liveOwner() ||
      !this.available()
    )
      return null;
    this.paused = false;
    const installed = this.publish({ ...this.state, active: true });
    this.reconcile();
    return installed === this.state && this.state.active ? installed : null;
  }
  reconcile(): void {
    if (!this.state.baseline) return;
    if (!this.baselineCurrent()) {
      this.invalidate();
      return;
    }
    const context = this.workbench.getSnapshot().context;
    if (this.owner && context && !sameOwner(this.owner, context)) {
      this.invalidate();
      return;
    }
    if (!this.paused && !this.liveOwner()) {
      this.invalidate();
      return;
    }
    const active = !this.paused && this.available() && this.liveOwner();
    if (active !== this.state.active) this.publish({ ...this.state, active });
  }
  invalidate(): void {
    this.owner = null;
    this.replacement = null;
    this.paused = false;
    if (this.state.baseline || this.state.reading || this.state.active)
      this.publish({ baseline: null, reading: null, active: false });
  }
  retire(): void {
    if (this.retired) return;
    this.retired = true;
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.invalidate();
  }
  private editorChanged() {
    const prior = this.observedEditor,
      current = this.workbench.getSnapshot();
    this.observedEditor = current;
    this.reconcile();
    if (!this.state.reading || this.paused) return;
    const inputsChanged =
      prior.dcfDraft !== current.dcfDraft ||
      prior.exitDraft !== current.exitDraft ||
      prior.inputIssue !== current.inputIssue;
    if (
      inputsChanged ||
      (!this.calculating && prior.calculation !== current.calculation)
    )
      this.publish({ ...this.state, reading: null });
  }
}
