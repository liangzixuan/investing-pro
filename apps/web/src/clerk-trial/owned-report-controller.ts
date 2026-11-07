import type {
  TextDocumentDeliveryContext,
  TextDocumentDeliveryResult,
} from "./document-delivery";

export interface OwnedReportCapture<Report> {
  readonly report: Report;
  readonly current: () => boolean;
}
export interface OwnedReportSource<Report> {
  readonly capture: () => OwnedReportCapture<Report> | null;
  readonly subscribe: (listener: () => void) => () => void;
}
export interface OwnedReportState<Report> {
  readonly report: Report | null;
  readonly saving: boolean;
  readonly message: string;
}
export interface OwnedReportDelivery<Document> {
  readonly deliver: (
    document: Document,
    context: TextDocumentDeliveryContext,
  ) => Promise<TextDocumentDeliveryResult>;
}
export interface OwnedReportMessages {
  readonly withdrawn: string;
  readonly captureUnavailable: string;
  readonly prepared: string;
  readonly cancelled: string;
  readonly formatUnavailable: string;
  readonly preparing: string;
  readonly saveFailed: string;
  readonly written: string;
  readonly downloadRequested: string;
}
export interface OwnedReportOptions<Report, Document> {
  readonly admit: (report: unknown) => report is Report;
  readonly format: (report: Report) => Document | null;
  readonly messages: OwnedReportMessages;
}
const idle = <Report>(): OwnedReportState<Report> =>
  Object.freeze({ report: null, saving: false, message: "" });
/** One mounted capture and owned delivery. Callbacks cannot overwrite a replacement operation. */
export class OwnedReportController<Report, Document> {
  private state = idle<Report>();
  private capture: OwnedReportCapture<Report> | null = null;
  private operation: AbortController | null = null;
  private revision = 0;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  constructor(
    private readonly source: OwnedReportSource<Report>,
    private readonly delivery: OwnedReportDelivery<Document> | undefined,
    private readonly options: OwnedReportOptions<Report, Document>,
  ) {
    this.unsubscribe = source.subscribe(() => this.reconcile());
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(state: OwnedReportState<Report>) {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }
  private current(
    capture = this.capture,
  ): capture is OwnedReportCapture<Report> {
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
      this.withdraw(this.options.messages.withdrawn);
  }
  private readCapture(revision: number) {
    const capture = this.source.capture();
    if (!capture) return null;
    if (!this.options.admit(capture.report)) return null;
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
      this.withdraw(this.options.messages.captureUnavailable);
      return;
    }
    this.capture = capture;
    ++this.revision;
    this.publish({
      report: capture.report,
      saving: false,
      message: this.options.messages.prepared,
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
      message: this.options.messages.cancelled,
    });
  }
  private deliveryCurrent(
    operation: AbortController,
    capture: OwnedReportCapture<Report>,
  ) {
    if (this.operation !== operation || operation.signal.aborted) return false;
    return this.current(capture);
  }
  private async deliver(
    capture: OwnedReportCapture<Report>,
    context: TextDocumentDeliveryContext,
  ) {
    if (!context.isCurrent()) return;
    const document = this.options.format(capture.report);
    if (!context.isCurrent()) return;
    if (!document) throw new Error(this.options.messages.formatUnavailable);
    const result = await this.delivery!.deliver(document, context);
    if (!context.isCurrent()) return;
    this.publish({
      report: capture.report,
      saving: false,
      message: deliveryMessage(result, this.options.messages),
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
        message: this.options.messages.preparing,
      });
      await this.deliver(capture, context);
    } catch {
      if (context.isCurrent())
        this.publish({
          report: capture.report,
          saving: false,
          message: this.options.messages.saveFailed,
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
function deliveryMessage(
  result: TextDocumentDeliveryResult,
  messages: OwnedReportMessages,
) {
  if (result === "written") return messages.written;
  if (result === "download_requested") return messages.downloadRequested;
  return messages.cancelled;
}
