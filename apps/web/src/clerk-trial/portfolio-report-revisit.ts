import {
  PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES,
  parsePortfolioReportArchive,
} from "./portfolio-report-archive";
import {
  comparePortfolioReports,
  type PortfolioReportComparison,
} from "./portfolio-report-comparison";
import type { PreparedPortfolioReviewReport } from "./portfolio-review-report";
import type {
  PortfolioReviewReportCapture,
  PortfolioReviewReportController,
} from "./portfolio-review-report-controller";

export interface PortfolioReportFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface PortfolioReportRevisitState {
  readonly filename: string;
  readonly reading: boolean;
  readonly saved: PreparedPortfolioReviewReport | null;
  readonly comparison: PortfolioReportComparison | null;
  readonly message: string;
}
const empty = (): PortfolioReportRevisitState =>
  Object.freeze({
    filename: "",
    reading: false,
    saved: null,
    comparison: null,
    message: "",
  });

/** One mounted local archive; all current evidence remains owned by its capture. */
export class PortfolioReportRevisit {
  private state = empty();
  private file: PortfolioReportFile | null = null;
  private scope: (() => boolean) | null = null;
  private capture: PortfolioReviewReportCapture | null = null;
  private operation = 0;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(private readonly reports: PortfolioReviewReportController) {
    this.unsubscribe = reports.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: PortfolioReportRevisitState) {
    this.state = Object.freeze(next);
    for (const listener of this.listeners) listener();
  }
  reconcile() {
    if (this.disposed) return;
    if (this.file && !this.scope?.()) {
      this.operation += 1;
      this.file = null;
      this.scope = null;
      this.update({
        ...this.state,
        filename: "",
        reading: false,
        message:
          "The file selection changed context. Choose it again to read it.",
      });
    }
    if (this.capture && !this.capture.current()) {
      this.capture = null;
      this.update({
        ...this.state,
        comparison: null,
        message:
          "The current capture changed. Capture the holdings again before comparing.",
      });
    }
  }
  choose(file: PortfolioReportFile) {
    if (this.disposed) return;
    this.operation += 1;
    this.capture = null;
    this.file = null;
    this.scope = null;
    if (
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      file.size > PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES
    ) {
      this.update({
        ...empty(),
        message: "Choose a Portfolio HTML report no larger than 8 MiB.",
      });
      return;
    }
    this.file = file;
    this.scope = this.reports.captureReadScope();
    this.update({
      ...empty(),
      filename: file.name,
      message: "Selected locally. Choose Read saved report to inspect it.",
    });
  }
  private owns(operation: number, file: PortfolioReportFile) {
    return (
      !this.disposed &&
      this.operation === operation &&
      this.file === file &&
      this.scope?.() === true
    );
  }
  async read() {
    this.reconcile();
    const file = this.file;
    if (this.disposed || !file || this.state.reading) return false;
    const operation = ++this.operation;
    this.capture = null;
    this.update({
      ...this.state,
      saved: null,
      comparison: null,
      reading: true,
      message: "Reading the chosen Portfolio HTML report…",
    });
    if (!this.owns(operation, file)) {
      this.reconcile();
      return false;
    }
    try {
      const bytes = await file.arrayBuffer();
      if (!this.owns(operation, file)) {
        this.reconcile();
        return false;
      }
      if (bytes.byteLength !== file.size)
        throw new TypeError("File size changed");
      const saved = parsePortfolioReportArchive(bytes);
      if (!this.owns(operation, file)) {
        this.reconcile();
        return false;
      }
      this.update({
        ...this.state,
        saved,
        reading: false,
        message:
          "Saved report read locally. Its dates and source qualifications remain unchanged.",
      });
      return this.owns(operation, file) && this.state.saved === saved;
    } catch {
      if (!this.owns(operation, file)) {
        this.reconcile();
        return false;
      }
      if (this.owns(operation, file))
        this.update({
          ...this.state,
          reading: false,
          message:
            "This file could not be read as a Portfolio report. Choose an unchanged report saved by this app.",
        });
      return false;
    }
  }
  clear() {
    if (this.disposed) return;
    this.operation += 1;
    this.file = null;
    this.scope = null;
    this.capture = null;
    this.update(empty());
  }
  compare() {
    this.reconcile();
    const saved = this.state.saved;
    const capture = this.reports.captureCurrent();
    if (this.disposed || this.state.reading || !saved || !capture) return false;
    const comparison = comparePortfolioReports(saved, capture.report);
    if (!capture.current() || this.state.saved !== saved) return false;
    this.capture = capture;
    this.update({
      ...this.state,
      comparison,
      message:
        "Compared the two complete captures. No Portfolio data was changed.",
    });
    return (
      this.capture === capture &&
      capture.current() &&
      this.state.comparison === comparison
    );
  }
  ownsSaved(saved: PreparedPortfolioReviewReport) {
    return (
      !this.disposed && this.state.saved === saved && this.scope?.() === true
    );
  }
  ownsComparison(comparison: PortfolioReportComparison) {
    return (
      !this.disposed &&
      this.state.comparison === comparison &&
      this.capture?.current() === true
    );
  }
  research(listingId: string, action: () => void) {
    this.reconcile();
    const row = this.state.comparison?.rows.find(
      (entry) => entry.listingId === listingId,
    );
    if (
      !this.capture?.current() ||
      !row?.current ||
      row.status === "identity-conflict"
    )
      return;
    action();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.operation += 1;
    this.file = null;
    this.scope = null;
    this.capture = null;
    this.unsubscribe();
    this.update(empty());
    this.listeners.clear();
  }
}
