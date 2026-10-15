import type { PreparedCompanyReport } from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";

const idle = { busy: false, message: "" };

/** Owns one mounted report's explicit file handoff; retirement cannot undo a received file. */
export class PreparedReportDelivery {
  private state = idle;
  private listeners = new Set<() => void>();
  private pending: AbortController | null = null;
  private retired = false;

  constructor(
    readonly report: PreparedCompanyReport,
    readonly delivery: CompanyReportDeliveryAdapter,
    private readonly isCurrent: () => boolean,
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(busy: boolean, message: string) {
    this.state = { busy, message };
    for (const listener of this.listeners) listener();
  }

  async start(): Promise<void> {
    if (this.retired || this.pending || !this.isCurrent()) return;
    const document = formatCompanyReportDocument(this.report);
    if (!document) {
      this.publish(
        false,
        "Report file unavailable: the complete document cannot be prepared within its limits.",
      );
      return;
    }
    const operation = new AbortController();
    this.pending = operation;
    const current = () =>
      !this.retired &&
      this.pending === operation &&
      !operation.signal.aborted &&
      this.isCurrent();
    this.publish(true, "");
    try {
      // Keep delivery in the initiating click task, before the first await.
      const outcome = await this.delivery.deliver(document, {
        signal: operation.signal,
        isCurrent: current,
      });
      if (!current()) return;
      const native = this.delivery.destination === "system_document";
      if (
        (outcome === "written" && !native) ||
        (outcome === "download_requested" && native)
      )
        throw new Error();
      this.publish(
        false,
        outcome === "written"
          ? `Saved report ${document.filename} to the chosen document.`
          : outcome === "download_requested"
            ? `Download requested for ${document.filename}.`
            : native
              ? "Report save cancelled."
              : "Report download cancelled.",
      );
    } catch {
      if (current())
        this.publish(
          false,
          this.delivery.destination === "system_document"
            ? "Report could not be saved. Check the chosen destination before trying again."
            : "Report download could not be requested. Check your downloads before trying again.",
        );
    } finally {
      if (this.pending === operation) {
        this.pending = null;
        if (!this.retired && this.state.busy) this.publish(false, "");
      }
    }
  }

  retire() {
    this.retired = true;
    const operation = this.pending;
    this.pending = null;
    this.listeners.clear();
    this.state = idle;
    operation?.abort();
  }
}
