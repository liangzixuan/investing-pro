import { performance } from "node:perf_hooks";

import { PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS } from "@research-cockpit/contracts";

export class PersonalSecQuarterOperationError extends Error {
  public constructor(public readonly code: "aborted" | "operation_deadline") {
    super("The SEC quarter assessment operation ended.");
    this.name = "PersonalSecQuarterOperationError";
  }
}

/** One deadline includes scheduler wait, transport, worker and synchronous work.
 * Checks around synchronous work detect overruns; the timer cannot preempt it.
 */
export class PersonalSecQuarterOperation {
  readonly #controller = new AbortController();
  readonly #now: () => number;
  readonly #started: number;
  readonly #parent: AbortSignal | undefined;
  readonly #timer: ReturnType<typeof setTimeout>;
  #last: number;
  #expired = false;
  #disposed = false;

  public constructor(
    signal?: AbortSignal,
    monotonicNow: () => number = () => performance.now(),
  ) {
    this.#now = monotonicNow;
    this.#started = this.#last = this.#now();
    if (!Number.isFinite(this.#started))
      throw new TypeError("Invalid SEC operation clock.");
    this.#parent = signal;
    signal?.addEventListener("abort", this.#abort, { once: true });
    if (signal?.aborted) this.#abort();
    this.#timer = setTimeout(() => {
      this.#expired = true;
      this.#controller.abort();
    }, PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS.operationDeadlineMs);
    this.#timer.unref();
  }

  public get signal(): AbortSignal {
    return this.#controller.signal;
  }

  public check(): void {
    const now = this.#now();
    if (!Number.isFinite(now) || now < this.#last) {
      this.#controller.abort();
      throw new TypeError("Invalid SEC operation clock.");
    }
    this.#last = now;
    if (
      now - this.#started >=
      PERSONAL_SEC_QUARTER_ASSESSMENT_LIMITS.operationDeadlineMs
    ) {
      this.#expired = true;
      this.#controller.abort();
    }
    if (this.#expired)
      throw new PersonalSecQuarterOperationError("operation_deadline");
    if (this.#disposed || this.#controller.signal.aborted)
      throw new PersonalSecQuarterOperationError("aborted");
  }

  public dispose(): void {
    this.#disposed = true;
    clearTimeout(this.#timer);
    this.#parent?.removeEventListener("abort", this.#abort);
  }

  readonly #abort = (): void => {
    this.#controller.abort();
  };
}
