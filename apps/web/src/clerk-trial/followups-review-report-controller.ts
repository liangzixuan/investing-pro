import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import type { PreparedFollowupsReviewReport } from "./followups-review-report";
import type {
  FollowupsReviewReportDeliveryAdapter,
  FollowupsReviewReportHtmlDocument,
} from "./followups-review-report-ports";

export interface FollowupsReviewReportCapture {
  readonly report: PreparedFollowupsReviewReport;
  readonly current: () => boolean;
}
export interface FollowupsReviewReportSource {
  readonly capture: () => FollowupsReviewReportCapture | null;
  readonly subscribe: (listener: () => void) => () => void;
}
export interface FollowupsReviewReportState {
  readonly report: PreparedFollowupsReviewReport | null;
  readonly saving: boolean;
  readonly message: string;
}
export const emptyFollowupsReviewReport = (): FollowupsReviewReportState =>
  Object.freeze({ report: null, saving: false, message: "" });
type Formatter = (
  report: PreparedFollowupsReviewReport,
) => FollowupsReviewReportHtmlDocument | null;
const staleMessage =
  "The captured report is no longer current. Capture the Follow-ups draft again.";

/** One explicit captured draft and one owned file operation. */
export class FollowupsReviewReportController {
  private state = emptyFollowupsReviewReport();
  private capture: FollowupsReviewReportCapture | null = null;
  private operation: AbortController | null = null;
  private disposed = false;
  private notifying = 0;
  private transitioning = 0;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly source: FollowupsReviewReportSource,
    private readonly delivery: FollowupsReviewReportDeliveryAdapter | undefined,
    private readonly format: Formatter,
  ) {
    this.unsubscribe = source.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: FollowupsReviewReportState) {
    this.state = Object.freeze(next);
    this.notifying++;
    try {
      for (const listener of this.listeners) listener();
    } finally {
      this.notifying--;
    }
  }
  private current(capture = this.capture) {
    return (
      !this.disposed &&
      capture !== null &&
      this.capture === capture &&
      capture.current()
    );
  }
  reconcile = () => {
    if (this.capture && !this.current()) this.withdraw(staleMessage);
  };
  private withdraw(message: string) {
    const operation = this.operation;
    this.operation = null;
    this.capture = null;
    this.transitioning++;
    try {
      operation?.abort();
      this.update({ report: null, saving: false, message });
    } finally {
      this.transitioning--;
    }
  }
  private interactionBlocked() {
    if (this.disposed) return true;
    if (this.operation) return true;
    return this.callbackActive();
  }
  private callbackActive() {
    if (this.notifying) return true;
    return this.transitioning > 0;
  }
  prepare() {
    if (this.interactionBlocked()) return;
    const capture = this.source.capture();
    if (!capture || !capture.current()) {
      this.withdraw(
        "Load a current valid Follow-ups draft and finish any save or identity review before capture.",
      );
      return;
    }
    this.capture = capture;
    this.update({
      report: capture.report,
      saving: false,
      message:
        "Captured the complete Follow-ups draft. Save follow-ups remains separate.",
    });
  }
  private ownsReportWork() {
    return this.capture !== null || this.operation !== null;
  }
  private emptyPublishedReport() {
    if (this.state.report) return false;
    if (this.state.saving) return false;
    return !this.state.message;
  }
  close() {
    if (this.disposed) return;
    if (!this.ownsReportWork() && this.emptyPublishedReport()) return;
    this.withdraw("");
  }
  cancel() {
    const operation = this.operation;
    if (!operation) return;
    this.operation = null;
    this.transitioning++;
    try {
      operation.abort();
      if (!this.current()) return this.reconcile();
      this.update({
        ...this.state,
        saving: false,
        message: "Report save cancelled. The Follow-ups draft is unchanged.",
      });
    } finally {
      this.transitioning--;
    }
  }
  private deliveryCurrent(
    operation: AbortController,
    capture: FollowupsReviewReportCapture,
  ) {
    return (
      this.operation === operation &&
      !operation.signal.aborted &&
      this.current(capture)
    );
  }
  private async deliverCapture(
    capture: FollowupsReviewReportCapture,
    context: TextDocumentDeliveryContext,
  ) {
    if (!context.isCurrent()) return;
    const document = this.format(capture.report);
    if (!context.isCurrent()) return;
    if (!document) throw new Error("Follow-ups report unavailable");
    const delivery = this.delivery;
    if (!delivery) return;
    const result = await delivery.deliver(document, context);
    if (!context.isCurrent()) return;
    this.update({
      report: capture.report,
      saving: false,
      message: deliveryMessage(result),
    });
  }
  private startDelivery(capture: FollowupsReviewReportCapture) {
    const operation = new AbortController();
    this.operation = operation;
    const context = {
      signal: operation.signal,
      isCurrent: () => this.deliveryCurrent(operation, capture),
    };
    this.update({
      report: capture.report,
      saving: true,
      message: "Preparing the captured HTML report…",
    });
    return { operation, context };
  }
  private deliveryFailed(
    capture: FollowupsReviewReportCapture,
    context: TextDocumentDeliveryContext,
  ) {
    if (!context.isCurrent()) return;
    this.update({
      report: capture.report,
      saving: false,
      message:
        "The Follow-ups report could not be saved. Check the chosen destination before trying again.",
    });
  }
  async save() {
    if (this.interactionBlocked()) return;
    if (!this.delivery) return;
    if (!this.current()) return this.reconcile();
    const capture = this.capture!;
    const { operation, context } = this.startDelivery(capture);
    try {
      await this.deliverCapture(capture, context);
    } catch {
      this.deliveryFailed(capture, context);
    } finally {
      if (this.operation === operation) this.operation = null;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.operation?.abort();
    this.operation = null;
    this.capture = null;
    this.listeners.clear();
    this.state = emptyFollowupsReviewReport();
  }
}
function deliveryMessage(result: TextDocumentDeliveryResult) {
  if (result === "written")
    return "Follow-ups report written to the chosen document.";
  if (result === "download_requested")
    return "Follow-ups report download requested. Check the browser destination.";
  return "Report save cancelled. The Follow-ups draft is unchanged.";
}
