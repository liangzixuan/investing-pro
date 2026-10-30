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
export interface CompanyReportComparisonCapture {
  readonly archive: CompanyReportArchive;
  readonly current: PreparedCompanyReport;
  readonly assessment: string;
  readonly isCurrent: () => boolean;
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
interface CompanyReportRevisitFile {
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface ReportReadOperation {
  readonly abort: AbortController;
  readonly capture: CompanyReportRevisitCapture;
  readonly size: number;
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
  private reading: ReportReadOperation | null = null;
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
  /** Read-only ownership of the exact comparison; it cannot renew source dates. */
  captureComparison(): CompanyReportComparisonCapture | null {
    const state = this.state;
    const comparison = this.comparison;
    const revision = this.mutation;
    if (!state.archive || !state.current || !comparison) return null;
    let retired = false;
    const unchanged = () =>
      this.mutation === revision &&
      this.state === state &&
      this.comparison === comparison;
    const isCurrent = () => {
      if (retired) return false;
      if (
        !unchanged() ||
        !this.active() ||
        !comparison.isCurrent() ||
        !unchanged()
      ) {
        retired = true;
      }
      return !retired;
    };
    if (!isCurrent()) return null;
    return Object.freeze({
      archive: state.archive,
      current: state.current,
      assessment: state.assessment,
      isCurrent,
    });
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
  /** Each read stage revalidates ownership after observable notifications. */
  async readFile(file: CompanyReportRevisitFile) {
    const operation = this.beginRead(file);
    if (!operation) return;
    try {
      const bytes = await file.arrayBuffer();
      await this.admitRead(operation, bytes);
    } catch {
      this.rejectRead(operation);
    }
  }
  private resetForRead() {
    if (!this.active()) return null;
    this.stopRead();
    this.comparison = null;
    const capture = this.options.capture();
    const revision = this.mutation + 1;
    this.update({ ...initial, message: capture ? "" : unavailable });
    if (!capture) return null;
    return this.resetIsCurrent(revision, capture) ? capture : null;
  }
  private resetIsCurrent(
    revision: number,
    capture: CompanyReportRevisitCapture,
  ) {
    if (this.mutation !== revision) return false;
    if (!this.active()) return false;
    return capture.isCurrent();
  }
  private beginRead(file: CompanyReportRevisitFile) {
    const capture = this.resetForRead();
    if (!capture) return null;
    let size: number;
    try {
      size = file.size;
      assertCompanyReportArchiveSize(size);
    } catch {
      this.update({ message: invalid });
      return null;
    }
    const operation = { abort: new AbortController(), capture, size };
    this.reading = operation;
    this.update({ phase: "reading", message: "Reading selected report…" });
    if (this.readIsCurrent(operation)) return operation;
    this.finishStaleRead(operation);
    return null;
  }
  private async admitRead(operation: ReportReadOperation, bytes: ArrayBuffer) {
    if (!this.readIsCurrent(operation)) return this.finishStaleRead(operation);
    const archive = await decodeCompanyReportArchive(
      bytes,
      operation.size,
      operation.abort.signal,
    );
    this.completeRead(operation, archive);
  }
  private completeRead(
    operation: ReportReadOperation,
    archive: CompanyReportArchive | null,
  ) {
    if (!this.readIsCurrent(operation)) return this.finishStaleRead(operation);
    this.reading = null;
    if (!this.archiveMatches(archive)) {
      this.update({ phase: "idle", message: invalid });
      return;
    }
    this.update({
      phase: "review",
      archive,
      message:
        "File accepted for this company. Its contents and claims remain unverified.",
    });
  }
  private archiveMatches(archive: CompanyReportArchive | null) {
    if (!archive) return false;
    return companyReportArchiveMatches(archive, this.options.selection);
  }
  private rejectRead(operation: ReportReadOperation) {
    if (!this.readIsCurrent(operation)) return this.finishStaleRead(operation);
    this.reading = null;
    this.update({ phase: "idle", message: invalid });
  }
  private readIsCurrent(operation: ReportReadOperation) {
    return (
      this.reading === operation &&
      !operation.abort.signal.aborted &&
      this.active() &&
      operation.capture.isCurrent()
    );
  }
  private finishStaleRead(operation: ReportReadOperation) {
    if (this.reading !== operation || this.retired) return;
    this.stopRead();
    if (!this.active()) this.clear();
    else this.update({ phase: "idle", message: changed });
  }
  private canCaptureCurrent() {
    if (!this.active()) return false;
    if (!this.state.archive) return false;
    return this.reading === null;
  }
  captureCurrent() {
    if (!this.canCaptureCurrent()) return;
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
  private appendCapture() {
    if (!this.comparisonIsCurrent()) return null;
    const { preview, current } = this.state;
    if (!preview) return null;
    if (!current) return null;
    if (current.note === null) return null;
    return {
      comparison: this.comparison!,
      preview,
      previousNote: current.note,
    };
  }
  private applyNote(
    capture: NonNullable<ReturnType<CompanyReportRevisit["appendCapture"]>>,
  ) {
    try {
      return capture.comparison.append(
        capture.preview.note,
        capture.previousNote,
      );
    } catch {
      // A failed draft boundary is refused without replay.
      return false;
    }
  }
  private appendContinuationCurrent(revision: number) {
    if (!this.active()) return false;
    return this.mutation === revision;
  }
  append() {
    const capture = this.appendCapture();
    if (!capture) {
      this.reconcile();
      return false;
    }
    // Consume before invoking the draft boundary: its notification can re-enter us.
    this.comparison = null;
    this.state = Object.freeze({ ...this.state, current: null, preview: null });
    const applying = ++this.mutation;
    const appended = this.applyNote(capture);
    if (!this.appendContinuationCurrent(applying)) return appended;
    this.update({
      message: appended
        ? "Comparison added to the Watchlist note draft. Review and Save My Watchlist separately."
        : changed,
    });
    return appended;
  }
  private hasPrivateState() {
    if (this.state !== initial) return true;
    if (this.reading) return true;
    return this.comparison !== null;
  }
  clear() {
    if (this.retired) return;
    if (!this.hasPrivateState()) return;
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
