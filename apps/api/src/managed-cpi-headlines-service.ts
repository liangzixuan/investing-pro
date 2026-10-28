import {
  MANAGED_CPI_HEADLINES_LIMITS,
  parseManagedCpiHeadlines,
  type ManagedCpiHeadlinesDto,
} from "@research-cockpit/contracts";

import {
  createCpiHeadlinesProvider,
  type CpiHeadlinesProvider,
} from "./cpi-headlines-provider";

export class ManagedCpiHeadlinesServiceError extends Error {
  constructor(readonly code: "unavailable" | "request_timeout") {
    super(code);
    this.name = "ManagedCpiHeadlinesServiceError";
  }
}

export interface ManagedCpiHeadlinesService {
  load(signal: AbortSignal): Promise<ManagedCpiHeadlinesDto>;
  assertActive(signal: AbortSignal): void;
}

/** Abort retires the result even when the awaited dependency ignores its signal. */
export async function awaitManagedCpiHeadlines<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let stop: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () => reject(new ManagedCpiHeadlinesServiceError("request_timeout"));
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

/** Captured entry clock owns both admissibility and the remaining timer budget. */
class CpiInvocationBudget {
  constructor(private readonly clock: { readonly elapsed: () => number }) {}
  assertActive = (signal: AbortSignal) => {
    const duration = this.clock.elapsed();
    if (signal.aborted)
      throw new ManagedCpiHeadlinesServiceError("request_timeout");
    this.assertDuration(duration);
  };
  private assertDuration(duration: number) {
    if (!Number.isFinite(duration))
      throw new ManagedCpiHeadlinesServiceError("request_timeout");
    if (duration < 0)
      throw new ManagedCpiHeadlinesServiceError("request_timeout");
    if (duration >= MANAGED_CPI_HEADLINES_LIMITS.operationMs)
      throw new ManagedCpiHeadlinesServiceError("request_timeout");
  }
  remainingMs() {
    return Math.max(
      1,
      MANAGED_CPI_HEADLINES_LIMITS.operationMs - this.clock.elapsed(),
    );
  }
}
/** One explicit source read per invocation; entry time includes bridge and auth. */
export function createManagedCpiHeadlinesService(options: {
  readonly startedAt: number;
  readonly monotonic?: () => number;
  readonly createProvider?: () => CpiHeadlinesProvider;
}): ManagedCpiHeadlinesService {
  const monotonic = options.monotonic ?? (() => performance.now());
  const elapsed = () => monotonic() - options.startedAt;
  const budget = new CpiInvocationBudget({ elapsed });
  let used = false;
  return {
    assertActive: budget.assertActive,
    async load(signal) {
      budget.assertActive(signal);
      if (used) throw new ManagedCpiHeadlinesServiceError("unavailable");
      used = true;
      const controller = new AbortController();
      const lifetime = AbortSignal.any([signal, controller.signal]);
      const timer = setTimeout(() => controller.abort(), budget.remainingMs());
      timer.unref();
      let provider: CpiHeadlinesProvider | undefined;
      try {
        budget.assertActive(lifetime);
        provider = (options.createProvider ?? createCpiHeadlinesProvider)();
        budget.assertActive(lifetime);
        const result = parseManagedCpiHeadlines(
          await awaitManagedCpiHeadlines(provider.load(lifetime), lifetime),
        );
        budget.assertActive(lifetime);
        if (!result) throw new ManagedCpiHeadlinesServiceError("unavailable");
        return result;
      } catch {
        budget.assertActive(lifetime);
        throw new ManagedCpiHeadlinesServiceError("unavailable");
      } finally {
        clearTimeout(timer);
        controller.abort();
        provider?.close();
      }
    },
  };
}
