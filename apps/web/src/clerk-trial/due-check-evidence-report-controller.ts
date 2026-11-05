import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isPreparedDueCheckEvidenceReport,
  type PreparedDueCheckEvidenceReport,
} from "./due-check-evidence-report";
import type {
  DueCheckEvidenceReportDeliveryAdapter,
  DueCheckEvidenceReportHtmlDocument,
} from "./due-check-evidence-report-ports";
export interface DueCheckEvidenceReportCapture {
  readonly report: PreparedDueCheckEvidenceReport;
  readonly current: () => boolean;
}
export interface DueCheckEvidenceReportSource {
  readonly capture: () => DueCheckEvidenceReportCapture | null;
  readonly subscribe: (listener: () => void) => () => void;
}
export interface DueCheckEvidenceReportState {
  readonly report: PreparedDueCheckEvidenceReport | null;
  readonly saving: boolean;
  readonly message: string;
}
type Formatter = (
  report: PreparedDueCheckEvidenceReport,
) => DueCheckEvidenceReportHtmlDocument | null;
const idle = (): DueCheckEvidenceReportState =>
  Object.freeze({ report: null, saving: false, message: "" });
/** One mounted capture and owned delivery. Callbacks cannot overwrite a replacement operation. */
export class DueCheckEvidenceReportController {
  private state = idle();
  private capture: DueCheckEvidenceReportCapture | null = null;
  private operation: AbortController | null = null;
  private revision = 0;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly source: DueCheckEvidenceReportSource,
    private readonly delivery:
      DueCheckEvidenceReportDeliveryAdapter | undefined,
    private readonly format: Formatter,
  ) {
    this.unsubscribe = source.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(state: DueCheckEvidenceReportState) {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }
  private current(
    capture = this.capture,
  ): capture is DueCheckEvidenceReportCapture {
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
    if (!isPreparedDueCheckEvidenceReport(capture.report)) return null;
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
        "The finished review could not be captured. Finish the review and try again.",
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
      message: "Due-check evidence report save cancelled.",
    });
  }
  private deliveryCurrent(
    operation: AbortController,
    capture: DueCheckEvidenceReportCapture,
  ) {
    if (this.operation !== operation || operation.signal.aborted) return false;
    return this.current(capture);
  }
  private async deliver(
    capture: DueCheckEvidenceReportCapture,
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
    return "Due-check evidence report written to the chosen document.";
  if (result === "download_requested")
    return "Due-check evidence report download requested. Check the browser destination.";
  return "Due-check evidence report save cancelled.";
}
