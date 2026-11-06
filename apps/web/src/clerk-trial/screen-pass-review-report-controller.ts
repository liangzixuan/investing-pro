import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isPreparedScreenPassReviewReport,
  type PreparedScreenPassReviewReport,
} from "./screen-pass-review-report";
import type {
  ScreenPassReviewReportDeliveryAdapter,
  ScreenPassReviewReportHtmlDocument,
} from "./screen-pass-review-report-ports";
export interface ScreenPassReviewReportCapture {
  readonly report: PreparedScreenPassReviewReport;
  readonly current: () => boolean;
}
export interface ScreenPassReviewReportSource {
  readonly capture: () => ScreenPassReviewReportCapture | null;
  readonly subscribe: (listener: () => void) => () => void;
}
export interface ScreenPassReviewReportState {
  readonly report: PreparedScreenPassReviewReport | null;
  readonly saving: boolean;
  readonly message: string;
}
type Formatter = (
  report: PreparedScreenPassReviewReport,
) => ScreenPassReviewReportHtmlDocument | null;
const idle = (): ScreenPassReviewReportState =>
  Object.freeze({ report: null, saving: false, message: "" });
/** One mounted capture and owned delivery. Callbacks cannot overwrite a replacement operation. */
export class ScreenPassReviewReportController {
  private state = idle();
  private capture: ScreenPassReviewReportCapture | null = null;
  private operation: AbortController | null = null;
  private revision = 0;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly source: ScreenPassReviewReportSource,
    private readonly delivery:
      ScreenPassReviewReportDeliveryAdapter | undefined,
    private readonly format: Formatter,
  ) {
    this.unsubscribe = source.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(state: ScreenPassReviewReportState) {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }
  private current(
    capture = this.capture,
  ): capture is ScreenPassReviewReportCapture {
    if (this.disposed || !capture) return false;
    if (this.capture !== capture) return false;
    const valid = capture.current();
    if (this.capture !== capture) return false;
    return !this.disposed && valid;
  }
  private withdraw(message: string) {
    const revision = ++this.revision;
    const operation = this.operation;
    this.operation = null;
    this.capture = null;
    operation?.abort();
    if (this.revision !== revision) return;
    this.publish({ report: null, saving: false, message });
  }
  reconcile() {
    const capture = this.capture;
    if (capture && !this.current(capture) && this.capture === capture)
      this.withdraw("The captured review has changed. Prepare it again.");
  }
  private readCapture(revision: number) {
    const capture = this.source.capture();
    if (!capture) return null;
    if (!isPreparedScreenPassReviewReport(capture.report)) return null;
    if (!capture.current()) return null;
    if (this.disposed) return null;
    if (this.revision !== revision) return null;
    return capture;
  }
  prepare() {
    if (this.disposed) return;
    if (this.operation) return;
    const revision = this.revision;
    const capture = this.readCapture(revision);
    if (this.disposed) return;
    if (this.revision !== revision) return;
    if (!capture) {
      this.withdraw(
        "The settled comparison could not be captured. Prepare a current Annual-pass review first.",
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
    if (revision !== this.revision) return;
    const capture = this.capture;
    if (!this.current(capture)) {
      this.reconcile();
      return;
    }
    this.publish({
      report: capture.report,
      saving: false,
      message: "Annual-pass report save cancelled.",
    });
  }
  private deliveryCurrent(
    operation: AbortController,
    capture: ScreenPassReviewReportCapture,
  ) {
    if (this.operation !== operation || operation.signal.aborted) return false;
    const current = this.current(capture);
    return current && this.operation === operation && !operation.signal.aborted;
  }
  private async deliver(
    capture: ScreenPassReviewReportCapture,
    context: TextDocumentDeliveryContext,
  ) {
    if (!context.isCurrent()) return;
    const document = this.format(capture.report);
    if (!context.isCurrent()) return;
    if (!document) throw new Error("Complete review report unavailable.");
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
    if (!this.delivery) return;
    if (this.operation) return;
    if (!this.current(capture)) return;
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
        message: "Preparing the complete review report...",
      });
      await this.deliver(capture, context);
    } catch {
      if (context.isCurrent())
        this.publish({
          report: capture.report,
          saving: false,
          message:
            "The complete review report could not be saved. No draft was changed.",
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
function deliveryMessage(result: TextDocumentDeliveryResult) {
  if (result === "written")
    return "Annual-pass report written to the chosen document.";
  if (result === "download_requested")
    return "Annual-pass report download requested. Check the browser destination.";
  return "Annual-pass report save cancelled.";
}
