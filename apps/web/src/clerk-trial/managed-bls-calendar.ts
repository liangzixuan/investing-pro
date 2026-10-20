import type { ManagedBlsCalendarDto } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
export interface ManagedBlsCalendarState {
  readonly calendar: ManagedBlsCalendarDto | null;
  readonly busy: boolean;
  readonly showingPrevious: boolean;
  readonly error: "invalid_response" | "unavailable" | null;
  readonly message: string;
}
const empty = (): ManagedBlsCalendarState => ({
  calendar: null,
  busy: false,
  showingPrevious: false,
  error: null,
  message: "",
});

/** One session's explicit BLS calendar reads, independent of catalog and watchlist work. */
export class ManagedBlsCalendar {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private active = true;
  private retired = false;

  constructor(
    private readonly read: ManagedApi["blsCalendar"],
    private readonly readError: (error: TrialApiError) => void,
  ) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedBlsCalendarState>) {
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
      showingPrevious: this.state.calendar !== null,
      error: null,
      message: this.state.calendar
        ? "Calendar refresh cancelled. Refresh again when ready."
        : "Calendar load cancelled. Load again when ready.",
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
  async load() {
    if (this.retired || !this.active || this.operation) return;
    const operation = new AbortController();
    this.operation = operation;
    const current = () =>
      !this.retired &&
      this.active &&
      this.operation === operation &&
      !operation.signal.aborted;
    this.update({
      busy: true,
      showingPrevious: this.state.calendar !== null,
      error: null,
      message: this.state.calendar
        ? "Refreshing BLS calendar…"
        : "Loading BLS calendar…",
    });
    try {
      if (!current()) return;
      const calendar = await this.read(operation.signal);
      if (!current()) return;
      this.update({
        calendar,
        showingPrevious: false,
        message: "BLS calendar loaded. Refresh explicitly to check again.",
      });
    } catch (error) {
      if (!current()) return;
      if (
        error instanceof TrialApiError &&
        ["unauthenticated", "access_denied", "origin_denied"].includes(
          error.code,
        )
      ) {
        this.readError(error);
        this.retire();
        return;
      }
      this.update({
        showingPrevious: this.state.calendar !== null,
        error:
          error instanceof TrialApiError && error.code === "invalid_response"
            ? "invalid_response"
            : "unavailable",
        message: "",
      });
    } finally {
      if (current()) {
        this.operation = null;
        this.update({ busy: false });
      }
    }
  }
}
