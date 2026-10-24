import type { PreparedPortfolioReviewReport } from "./portfolio-review-report";
import type { PortfolioReviewReportHtmlDocument } from "./portfolio-review-report-html";
import type { PortfolioReviewReportDeliveryAdapter } from "./portfolio-review-report-delivery";

export interface PortfolioReviewReportCapture {
  readonly report: PreparedPortfolioReviewReport;
  readonly current: () => boolean;
}
export interface PortfolioReviewReportSource {
  readonly capture: () => PortfolioReviewReportCapture | null;
  readonly subscribe: (listener: () => void) => () => void;
}
export interface PortfolioReviewReportState {
  readonly report: PreparedPortfolioReviewReport | null;
  readonly saving: boolean;
  readonly message: string;
}
export const emptyPortfolioReviewReport = (): PortfolioReviewReportState =>
  Object.freeze({ report: null, saving: false, message: "" });

type Formatter = (
  report: PreparedPortfolioReviewReport,
) => PortfolioReviewReportHtmlDocument | null;

/** One mounted report capture. Source changes withdraw preview and pending delivery. */
export class PortfolioReviewReportController {
  private state = emptyPortfolioReviewReport();
  private capture: PortfolioReviewReportCapture | null = null;
  private operation: AbortController | null = null;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly source: PortfolioReviewReportSource,
    private readonly delivery: PortfolioReviewReportDeliveryAdapter | undefined,
    private readonly format: Formatter,
  ) {
    this.unsubscribe = source.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: PortfolioReviewReportState) {
    this.state = Object.freeze(next);
    for (const listener of this.listeners) listener();
  }
  private current(capture = this.capture) {
    return (
      !this.disposed &&
      capture !== null &&
      this.capture === capture &&
      capture.current()
    );
  }
  reconcile() {
    if (!this.capture || this.current()) return;
    this.withdraw(
      "The captured report is no longer current. Capture it again after reviewing the holdings.",
    );
  }
  private withdraw(message: string) {
    this.operation?.abort();
    this.operation = null;
    this.capture = null;
    this.update({ report: null, saving: false, message });
  }
  prepare() {
    if (this.disposed || this.operation) return;
    const capture = this.source.capture();
    if (!capture || !capture.current()) {
      this.withdraw(
        "A report needs a current completed holdings review and an observed close date.",
      );
      return;
    }
    this.capture = capture;
    this.update({
      report: capture.report,
      saving: false,
      message:
        "Captured for review. No source request or Portfolio Save was made.",
    });
  }
  close() {
    if (this.disposed) return;
    this.withdraw("");
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    if (!this.current()) return this.reconcile();
    this.update({
      ...this.state,
      saving: false,
      message: "Report save cancelled. The Portfolio draft is unchanged.",
    });
  }
  async save() {
    const capture = this.capture;
    if (!this.current(capture) || !capture || this.operation || !this.delivery)
      return;
    const operation = new AbortController();
    this.operation = operation;
    const current = () =>
      this.operation === operation &&
      !operation.signal.aborted &&
      this.current(capture);
    this.update({
      report: capture.report,
      saving: true,
      message: "Preparing the captured HTML report…",
    });
    try {
      const document = this.format(capture.report);
      if (!current()) return;
      if (!document) throw new Error("Portfolio report unavailable");
      const result = await this.delivery.deliver(document, {
        signal: operation.signal,
        isCurrent: current,
      });
      if (!current()) return;
      const message =
        result === "written"
          ? "Portfolio report written to the chosen document."
          : result === "download_requested"
            ? "Portfolio report download requested. Check the browser destination."
            : "Report save cancelled. The Portfolio draft is unchanged.";
      this.update({ report: capture.report, saving: false, message });
    } catch {
      if (current())
        this.update({
          report: capture.report,
          saving: false,
          message:
            "The Portfolio report could not be saved. The draft is unchanged.",
        });
    } finally {
      if (this.operation === operation) this.operation = null;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.withdraw("");
    this.listeners.clear();
  }
}
