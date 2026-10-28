import {
  parseManagedCpiHeadlines,
  type ManagedCpiHeadlinesDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import type { ManagedSourceReadResult } from "./managed-source-read-result";

export interface ManagedCpiHeadlinesState {
  readonly headlines: ManagedCpiHeadlinesDto | null;
  readonly busy: boolean;
  readonly showingPrevious: boolean;
  readonly error: "invalid_response" | "unavailable" | null;
  readonly message: string;
}
const empty = (): ManagedCpiHeadlinesState => ({
  headlines: null,
  busy: false,
  showingPrevious: false,
  error: null,
  message: "",
});
/** Manual fixed-source metadata, retained only for this active session. */
export class ManagedCpiHeadlines {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: AbortController | null = null;
  private active = true;
  private retired = false;
  constructor(
    private readonly read: ManagedApi["cpiHeadlines"],
    private readonly readError: (error: TrialApiError) => void,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedCpiHeadlinesState>) {
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
    const operation = this.operation;
    this.operation = null;
    this.update({
      busy: false,
      showingPrevious: this.state.headlines !== null,
      error: null,
      message:
        "CPI headlines read cancelled. Retained source clocks are unchanged.",
    });
    operation.abort();
  }
  retire() {
    this.retired = true;
    this.active = false;
    const operation = this.operation;
    this.operation = null;
    operation?.abort();
    this.state = empty();
    for (const listener of this.listeners) listener();
  }
  private current(operation: AbortController) {
    return (
      !this.retired &&
      this.active &&
      this.operation === operation &&
      !operation.signal.aborted
    );
  }
  async load(): Promise<ManagedSourceReadResult> {
    if (this.retired) return "retired";
    if (!this.active || this.operation) return "not_started";
    const operation = new AbortController();
    this.operation = operation;
    this.update({
      busy: true,
      showingPrevious: this.state.headlines !== null,
      error: null,
      message: "Loading published CPI headlines…",
    });
    let result: ManagedSourceReadResult = "cancelled";
    try {
      if (this.current(operation)) {
        const value = await this.read(operation.signal);
        if (this.current(operation)) {
          const parsed = parseManagedCpiHeadlines(value);
          if (!parsed) throw new TrialApiError("invalid_response");
          const headlines = Object.freeze({
            ...parsed,
            source: Object.freeze({ ...parsed.source }),
            items: Object.freeze(
              parsed.items.map((item) => Object.freeze({ ...item })),
            ),
          });
          this.update({
            headlines,
            showingPrevious: false,
            error: null,
            message: "CPI headlines loaded. Refresh explicitly to check again.",
          });
          result = "accepted";
        }
      }
    } catch (error) {
      if (this.current(operation)) {
        if (
          error instanceof TrialApiError &&
          ["unauthenticated", "access_denied", "origin_denied"].includes(
            error.code,
          )
        ) {
          this.readError(error);
          this.retire();
          result = "retired";
        } else {
          this.update({
            showingPrevious: this.state.headlines !== null,
            error:
              error instanceof TrialApiError &&
              error.code === "invalid_response"
                ? "invalid_response"
                : "unavailable",
            message:
              "The CPI headlines read failed. Any previous packet keeps its original clocks.",
          });
          result = "failed";
        }
      }
    } finally {
      if (this.current(operation)) {
        this.operation = null;
        this.update({ busy: false });
      }
    }
    if (this.retired) return "retired";
    return !this.active || operation.signal.aborted ? "cancelled" : result;
  }
}
