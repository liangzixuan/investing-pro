import type { PreparedCompanyReport } from "./managed-company-report";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  assertCompanyReportArchiveSize,
  decodeCompanyReportArchive,
  companyReportArchiveMatches,
  type CompanyReportArchive,
} from "./managed-company-report-archive";
import { prepareCompanyReportRevisitNote } from "./company-report-revisit-note";

export interface CompanyReportRevisitTarget {
  readonly isCurrent: () => boolean;
  readonly append: (note: string, expectedNote: string) => boolean;
}
export interface CompanyReportRevisitCapture {
  readonly report: PreparedCompanyReport | null;
  readonly reason: string | null;
  readonly isCurrent: () => boolean;
  readonly append: (note: string, expectedNote: string) => boolean;
}
export interface CompanyReportRevisitOptions {
  readonly selection: ManagedResearchSelection;
  readonly active: () => boolean;
  readonly capture: () => CompanyReportRevisitCapture | null;
  readonly now?: () => Date;
}
export interface CompanyReportRevisitState {
  readonly phase: "idle" | "reading" | "review" | "retired";
  readonly archive: CompanyReportArchive | null;
  readonly current: PreparedCompanyReport | null;
  readonly assessment: string;
  readonly preview: { readonly note: string; readonly excerpt: string } | null;
  readonly message: string;
}
const initial: CompanyReportRevisitState = Object.freeze({
  phase: "idle",
  archive: null,
  current: null,
  assessment: "",
  preview: null,
  message: "",
});
const changed =
  "The company, source or draft changed. Capture the current report and preview again.";
const unavailable =
  "Open this company with a current Watchlist draft before selecting a report.";
const invalid =
  "Select a complete format 5 company report JSON for this exact company. The file was not accepted.";

/** Private visit state. File admission never loads a source model or restores a draft. */
export class CompanyReportRevisit {
  private state = initial;
  private listeners = new Set<() => void>();
  private reading: {
    abort: AbortController;
    capture: CompanyReportRevisitCapture;
  } | null = null;
  private comparison: CompanyReportRevisitCapture | null = null;
  private retired = false;
  private mutation = 0;
  constructor(private readonly options: CompanyReportRevisitOptions) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<CompanyReportRevisitState>) {
    this.mutation++;
    this.state = Object.freeze({ ...this.state, ...next });
    for (const listener of this.listeners) listener();
  }
  private stopRead() {
    this.reading?.abort.abort();
    this.reading = null;
  }
  private active() {
    return !this.retired && this.options.active();
  }
  comparisonIsCurrent() {
    return this.active() && this.comparison?.isCurrent() === true;
  }
  reconcile() {
    if (this.retired) return;
    if (!this.options.active()) {
      if (this.state !== initial) this.clear();
      return;
    }
    if (this.reading && !this.reading.capture.isCurrent()) {
      this.stopRead();
      this.update({ phase: "idle", message: changed });
    }
    if (this.comparison && !this.comparison.isCurrent()) {
      this.comparison = null;
      this.update({ current: null, preview: null, message: changed });
    }
  }
  async readFile(file: {
    readonly size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
  }) {
    if (!this.active()) return;
    this.stopRead();
    this.comparison = null;
    const capture = this.options.capture();
    const starting = this.mutation + 1;
    this.update({ ...initial, message: capture ? "" : unavailable });
    if (
      this.mutation !== starting ||
      !this.active() ||
      !capture ||
      !capture.isCurrent()
    )
      return;
    const size = file.size;
    try {
      assertCompanyReportArchiveSize(size);
    } catch {
      this.update({ message: invalid });
      return;
    }
    const operation = { abort: new AbortController(), capture };
    this.reading = operation;
    this.update({ phase: "reading", message: "Reading selected report…" });
    if (!this.readIsCurrent(operation)) return this.finishStaleRead(operation);
    try {
      const bytes = await file.arrayBuffer();
      if (!this.readIsCurrent(operation))
        return this.finishStaleRead(operation);
      const archive = await decodeCompanyReportArchive(
        bytes,
        size,
        operation.abort.signal,
      );
      if (!this.readIsCurrent(operation))
        return this.finishStaleRead(operation);
      this.reading = null;
      if (
        !archive ||
        !companyReportArchiveMatches(archive, this.options.selection)
      ) {
        this.update({ phase: "idle", message: invalid });
        return;
      }
      this.update({
        phase: "review",
        archive,
        message:
          "File accepted for this company. Its contents and claims remain unverified.",
      });
    } catch {
      if (!this.readIsCurrent(operation))
        return this.finishStaleRead(operation);
      this.reading = null;
      this.update({ phase: "idle", message: invalid });
    }
  }
  private readIsCurrent(
    operation: NonNullable<CompanyReportRevisit["reading"]>,
  ) {
    return (
      this.reading === operation &&
      !operation.abort.signal.aborted &&
      this.active() &&
      operation.capture.isCurrent()
    );
  }
  private finishStaleRead(
    operation: NonNullable<CompanyReportRevisit["reading"]>,
  ) {
    if (this.reading !== operation || this.retired) return;
    this.stopRead();
    if (!this.active()) this.clear();
    else this.update({ phase: "idle", message: changed });
  }
  captureCurrent() {
    if (!this.active() || !this.state.archive || this.reading) return;
    const capture = this.options.capture();
    if (!capture?.isCurrent()) return;
    const report = capture.report;
    if (!report) {
      this.update({
        current: null,
        preview: null,
        message:
          capture.reason ??
          "Load a source or calculate valuation, then capture the current report.",
      });
      return;
    }
    this.comparison = capture;
    this.update({
      current: report,
      preview: null,
      message:
        "Current report captured. Review both notes and each source's original dates before writing your assessment.",
    });
  }
  setAssessment(assessment: string) {
    if (!this.active() || !this.state.archive) return;
    this.update({ assessment, preview: null, message: "" });
  }
  prepareNote() {
    if (!this.comparisonIsCurrent()) {
      this.reconcile();
      return;
    }
    const { archive, current, assessment } = this.state;
    if (!archive || !current) return;
    const proposal = prepareCompanyReportRevisitNote({
      archive,
      current,
      assessment,
      assessedAt: (this.options.now?.() ?? new Date()).toISOString(),
    });
    this.update({
      preview: proposal.preview,
      message:
        proposal.reason ??
        "Review the complete note before appending. Save remains a separate action.",
    });
  }
  append() {
    const { preview, current } = this.state;
    const comparison = this.comparison;
    if (
      !preview ||
      !current ||
      current.note === null ||
      !comparison ||
      !this.comparisonIsCurrent()
    ) {
      this.reconcile();
      return false;
    }
    // Consume before invoking the draft boundary: its notification can re-enter us.
    this.comparison = null;
    this.state = Object.freeze({ ...this.state, current: null, preview: null });
    const applying = ++this.mutation;
    let appended = false;
    try {
      appended = comparison.append(preview.note, current.note);
    } catch {
      /* Refuse a failed draft boundary without replay. */
    }
    if (!this.active() || this.mutation !== applying) return appended;
    this.update({
      message: appended
        ? "Comparison added to the Watchlist note draft. Review and Save My Watchlist separately."
        : changed,
    });
    return appended;
  }
  clear() {
    if (this.retired) return;
    if (this.state === initial && !this.reading && !this.comparison) return;
    this.stopRead();
    this.comparison = null;
    this.mutation++;
    this.state = initial;
    for (const listener of this.listeners) listener();
  }
  dispose() {
    this.stopRead();
    this.comparison = null;
    this.retired = true;
    this.mutation++;
    this.state = Object.freeze({ ...initial, phase: "retired" });
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }
}
