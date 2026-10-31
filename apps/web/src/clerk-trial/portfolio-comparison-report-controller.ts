import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isPreparedPortfolioComparisonReport,
  type PreparedPortfolioComparisonReport,
} from "./portfolio-comparison-report";
import type {
  PortfolioComparisonReportDeliveryAdapter,
  PortfolioComparisonReportHtmlDocument,
} from "./portfolio-comparison-report-ports";

export interface PortfolioComparisonReportCapture {
  readonly report: PreparedPortfolioComparisonReport;
  readonly current: () => boolean;
}
export interface PortfolioComparisonReportSource {
  readonly capture: () => PortfolioComparisonReportCapture | null;
  readonly subscribe: (listener: () => void) => () => void;
}
export interface PortfolioComparisonReportState {
  readonly report: PreparedPortfolioComparisonReport | null;
  readonly saving: boolean;
  readonly message: string;
}
type Formatter = (
  report: PreparedPortfolioComparisonReport,
) => PortfolioComparisonReportHtmlDocument | null;
const idle = (): PortfolioComparisonReportState =>
  Object.freeze({ report: null, saving: false, message: "" });

/** One captured comparison and one abortable delivery, fenced around every callback. */
export class PortfolioComparisonReportController {
  private state = idle();
  private capture: PortfolioComparisonReportCapture | null = null;
  private operation: AbortController | null = null;
  private revision = 0;
  private disposed = false;
  private readonly retired = new WeakSet<object>();
  private readonly checking = new WeakSet<object>();
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly source: PortfolioComparisonReportSource,
    private readonly delivery:
      PortfolioComparisonReportDeliveryAdapter | undefined,
    private readonly format: Formatter,
  ) {
    this.unsubscribe = source.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(state: PortfolioComparisonReportState) {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }
  private valid(capture: PortfolioComparisonReportCapture) {
    if (this.retired.has(capture) || this.checking.has(capture)) return false;
    this.checking.add(capture);
    let valid: boolean;
    try {
      valid = capture.current() === true;
    } catch {
      valid = false;
    } finally {
      this.checking.delete(capture);
    }
    if (!valid) this.retired.add(capture);
    return valid && !this.retired.has(capture);
  }
  private current(
    capture = this.capture,
  ): capture is PortfolioComparisonReportCapture {
    if (this.disposed || !capture || this.capture !== capture) return false;
    const revision = this.revision;
    return (
      this.valid(capture) &&
      !this.disposed &&
      this.capture === capture &&
      this.revision === revision
    );
  }
  private withdraw(message: string) {
    const revision = ++this.revision;
    const operation = this.operation;
    this.operation = null;
    this.capture = null;
    operation?.abort();
    if (this.revision === revision)
      this.publish({ report: null, saving: false, message });
  }
  reconcile() {
    const capture = this.capture,
      revision = this.revision;
    if (
      capture &&
      !this.current(capture) &&
      this.capture === capture &&
      this.revision === revision
    )
      this.withdraw(
        "The captured Portfolio comparison is no longer current. Review and capture it again.",
      );
  }
  prepare() {
    if (this.disposed || this.operation) return;
    const revision = this.revision;
    let capture: PortfolioComparisonReportCapture | null = null;
    try {
      const candidate = this.source.capture();
      if (
        candidate &&
        isPreparedPortfolioComparisonReport(candidate.report) &&
        this.valid(candidate)
      )
        capture = candidate;
    } catch {
      capture = null;
    }
    if (this.disposed || this.revision !== revision) return;
    if (!capture) {
      this.withdraw(
        "The complete Portfolio comparison could not be captured. Review the current comparison and its complete-size limits; nothing was clipped.",
      );
      return;
    }
    this.capture = capture;
    ++this.revision;
    this.publish({
      report: capture.report,
      saving: false,
      message:
        "Captured for review. No source request or online Save was made.",
    });
  }
  close() {
    if (!this.disposed) this.withdraw("");
  }
  cancel() {
    const operation = this.operation;
    if (!operation) return;
    const revision = ++this.revision;
    this.operation = null;
    operation.abort();
    if (this.revision !== revision) return;
    const capture = this.capture;
    if (!this.current(capture)) {
      this.reconcile();
      return;
    }
    this.publish({
      report: capture.report,
      saving: false,
      message: "Portfolio comparison report save cancelled.",
    });
  }
  private deliveryCurrent(
    operation: AbortController,
    capture: PortfolioComparisonReportCapture,
  ) {
    if (this.operation !== operation || operation.signal.aborted) return false;
    const current = this.current(capture);
    return current && this.operation === operation && !operation.signal.aborted;
  }
  private async deliver(
    capture: PortfolioComparisonReportCapture,
    context: TextDocumentDeliveryContext,
  ) {
    if (!context.isCurrent()) return;
    const document = this.format(capture.report);
    if (!context.isCurrent()) return;
    if (!document)
      throw new Error("Complete Portfolio comparison report unavailable.");
    const result = await this.delivery!.deliver(document, context);
    if (!context.isCurrent()) return;
    this.publish({
      report: capture.report,
      saving: false,
      message: deliveryMessage(result),
    });
  }
  async save() {
    const capture = this.capture;
    if (!this.delivery || this.operation || !this.current(capture)) {
      this.reconcile();
      return;
    }
    const operation = new AbortController();
    this.operation = operation;
    ++this.revision;
    const context = {
      signal: operation.signal,
      isCurrent: () => this.deliveryCurrent(operation, capture),
    };
    try {
      this.publish({
        report: capture.report,
        saving: true,
        message: "Preparing the complete Portfolio comparison HTML report…",
      });
      await this.deliver(capture, context);
    } catch {
      if (context.isCurrent())
        this.publish({
          report: capture.report,
          saving: false,
          message:
            "The complete Portfolio comparison report could not be saved. No draft was changed.",
        });
    } finally {
      if (this.operation === operation) this.operation = null;
      this.reconcile();
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
function deliveryMessage(result: TextDocumentDeliveryResult) {
  if (result === "written")
    return "Portfolio comparison report written to the chosen document.";
  if (result === "download_requested")
    return "Portfolio comparison report download requested. Check the browser destination.";
  return "Portfolio comparison report save cancelled.";
}
