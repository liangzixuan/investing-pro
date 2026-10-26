import type { PersonalMonetaryAnnouncementsDto } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import type { ManagedSourceReadResult } from "./managed-source-read-result";
import {
  compareManagedFedResponses,
  type ManagedFedRefreshComparison,
} from "./managed-fed-refresh-comparison";

export interface ManagedFedAnnouncementsState {
  readonly announcements: PersonalMonetaryAnnouncementsDto | null;
  readonly refreshComparison: ManagedFedRefreshComparison | null;
  readonly busy: boolean;
  readonly showingPrevious: boolean;
  readonly error: "invalid_response" | "unavailable" | null;
  readonly message: string;
}
const empty = (): ManagedFedAnnouncementsState => ({
  announcements: null,
  refreshComparison: null,
  busy: false,
  showingPrevious: false,
  error: null,
  message: "",
});

/** One session's explicit Fed feed reads, independent of catalog and watchlist work. */
export class ManagedFedAnnouncements {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private active = true;
  private retired = false;

  constructor(
    private readonly read: ManagedApi["monetaryAnnouncements"],
    private readonly readError: (error: TrialApiError) => void,
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedFedAnnouncementsState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  enter() {
    if (!this.retired) this.active = true;
  }
  leave() {
    this.active = false;
    this.cancel();
  }
  cancel() {
    if (!this.operation) return;
    this.operation.abort();
    this.operation = null;
    this.update({
      busy: false,
      showingPrevious: this.state.announcements !== null,
      error: null,
      message: this.state.announcements
        ? "Announcements refresh cancelled. Refresh again when ready."
        : "Announcements load cancelled. Load again when ready.",
    });
  }
  retire() {
    this.retired = true;
    this.active = false;
    this.operation?.abort();
    this.operation = null;
    this.state = empty();
    for (const listener of this.listeners) listener();
  }
  private canLoad() {
    return !this.retired && this.active && this.operation === null;
  }
  private current(operation: AbortController) {
    return (
      !this.retired &&
      this.active &&
      this.operation === operation &&
      !operation.signal.aborted
    );
  }
  private beginLoad() {
    const operation = new AbortController();
    this.operation = operation;
    this.update({
      busy: true,
      showingPrevious: this.state.announcements !== null,
      error: null,
      message: this.state.announcements
        ? "Refreshing Federal Reserve announcements…"
        : "Loading Federal Reserve announcements…",
    });
    return operation;
  }
  private failedRead(error: unknown) {
    if (sessionFailure(error)) {
      this.readError(error);
      this.retire();
      return;
    }
    this.update({
      showingPrevious: this.state.announcements !== null,
      error: responseError(error),
      message: "",
    });
  }
  private finishLoad(operation: AbortController) {
    if (!this.current(operation)) return;
    this.operation = null;
    this.update({ busy: false });
  }
  private readResult(
    operation: AbortController,
    result: ManagedSourceReadResult,
  ): ManagedSourceReadResult {
    if (this.retired) return "retired";
    if (!this.active || operation.signal.aborted) return "cancelled";
    return result;
  }
  async load(): Promise<ManagedSourceReadResult> {
    if (this.retired) return "retired";
    if (!this.canLoad()) return "not_started";
    const operation = this.beginLoad();
    let result: ManagedSourceReadResult = "cancelled";
    try {
      if (this.current(operation)) {
        const announcements = await this.read(operation.signal);
        if (this.current(operation)) {
          this.update({
            announcements,
            refreshComparison: compareManagedFedResponses(
              this.state.announcements,
              announcements,
            ),
            showingPrevious: false,
            message:
              "Federal Reserve announcements loaded. Refresh explicitly to check again.",
          });
          result = "accepted";
        }
      }
    } catch (error) {
      if (this.current(operation)) {
        this.failedRead(error);
        result = "failed";
      }
    } finally {
      this.finishLoad(operation);
    }
    return this.readResult(operation, result);
  }
}

function sessionFailure(error: unknown): error is TrialApiError {
  return (
    error instanceof TrialApiError &&
    ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
  );
}
function responseError(error: unknown): "invalid_response" | "unavailable" {
  if (!(error instanceof TrialApiError)) return "unavailable";
  return error.code === "invalid_response" ? "invalid_response" : "unavailable";
}
