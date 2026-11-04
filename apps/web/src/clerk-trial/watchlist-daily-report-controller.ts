import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";
import {
  isPreparedWatchlistDailyReport,
  type PreparedWatchlistDailyReport,
} from "./watchlist-daily-report";
import type {
  WatchlistDailyReportDeliveryAdapter,
  WatchlistDailyReportHtmlDocument,
} from "./watchlist-daily-report-ports";
export interface WatchlistDailyReportCapture {
  readonly report: PreparedWatchlistDailyReport;
  readonly current: () => boolean;
}
export interface WatchlistDailyReportSource {
  readonly capture: () => WatchlistDailyReportCapture | null;
  readonly subscribe: (listener: () => void) => () => void;
}
export interface WatchlistDailyReportState {
  readonly report: PreparedWatchlistDailyReport | null;
  readonly saving: boolean;
  readonly message: string;
}
type Formatter = (
  report: PreparedWatchlistDailyReport,
) => WatchlistDailyReportHtmlDocument | null;
const idle = (): WatchlistDailyReportState =>
  Object.freeze({ report: null, saving: false, message: "" });
/** One mounted capture and owned delivery. Callbacks cannot overwrite a replacement operation. */
export class WatchlistDailyReportController {
  private state = idle();
  private capture: WatchlistDailyReportCapture | null = null;
  private operation: AbortController | null = null;
  private revision = 0;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly source: WatchlistDailyReportSource,
    private readonly delivery: WatchlistDailyReportDeliveryAdapter | undefined,
    private readonly format: Formatter,
  ) {
    this.unsubscribe = source.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(state: WatchlistDailyReportState) {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }
  private current(
    capture = this.capture,
  ): capture is WatchlistDailyReportCapture {
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
    if (this.capture && !this.current())
      this.withdraw(
        "The captured daily review is no longer current. Capture it again after review.",
      );
  }
  private readCapture(revision: number) {
    const capture = this.source.capture();
    if (!capture) return null;
    if (!isPreparedWatchlistDailyReport(capture.report)) return null;
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
        "The complete daily review could not be captured. Review the finished daily review and its admission and complete-size limits; nothing was clipped.",
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
      message: "Daily review report save cancelled.",
    });
  }
  private deliveryCurrent(
    operation: AbortController,
    capture: WatchlistDailyReportCapture,
  ) {
    if (this.operation !== operation || operation.signal.aborted) return false;
    return this.current(capture);
  }
  private async deliver(
    capture: WatchlistDailyReportCapture,
    context: TextDocumentDeliveryContext,
  ) {
    if (!context.isCurrent()) return;
    const document = this.format(capture.report);
    if (!context.isCurrent()) return;
    if (!document) throw new Error("Complete daily review report unavailable.");
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
        message: "Preparing the complete daily review HTML report…",
      });
      await this.deliver(capture, context);
    } catch {
      if (context.isCurrent())
        this.publish({
          report: capture.report,
          saving: false,
          message:
            "The complete daily review report could not be saved. No draft was changed.",
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
    return "Daily review report written to the chosen document.";
  if (result === "download_requested")
    return "Daily review report download requested. Check the browser destination.";
  return "Daily review report save cancelled.";
}
