import {
  MANAGED_ECONOMIC_CALENDAR_LIMITS,
  parseManagedEconomicCalendar,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";

import {
  createBeaReleaseProvider,
  type BeaReleaseProvider,
} from "./bea-release-provider";

export class ManagedEconomicCalendarServiceError extends Error {
  constructor(readonly code: "unavailable" | "request_timeout") {
    super(code);
    this.name = "ManagedEconomicCalendarServiceError";
  }
}

export interface ManagedEconomicCalendarService {
  load(signal: AbortSignal): Promise<PersonalEconomicCalendarDto>;
  assertActive(signal: AbortSignal): void;
}

/** Abort retires the result even when the awaited dependency ignores its signal. */
export async function awaitManagedEconomicCalendar<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let stop: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () =>
      reject(new ManagedEconomicCalendarServiceError("request_timeout"));
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

/** One explicit source read per invocation; entry time includes bridge and auth. */
export function createManagedEconomicCalendarService(options: {
  readonly startedAt: number;
  readonly monotonic?: () => number;
  readonly createProvider?: () => BeaReleaseProvider;
}): ManagedEconomicCalendarService {
  const monotonic = options.monotonic ?? (() => performance.now());
  const elapsed = () => monotonic() - options.startedAt;
  const active = (signal: AbortSignal) => {
    const duration = elapsed();
    if (
      signal.aborted ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration >= MANAGED_ECONOMIC_CALENDAR_LIMITS.operationMs
    )
      throw new ManagedEconomicCalendarServiceError("request_timeout");
  };
  let used = false;
  return {
    assertActive: active,
    async load(signal) {
      active(signal);
      if (used) throw new ManagedEconomicCalendarServiceError("unavailable");
      used = true;
      const controller = new AbortController();
      const lifetime = AbortSignal.any([signal, controller.signal]);
      const timer = setTimeout(
        () => controller.abort(),
        Math.max(1, MANAGED_ECONOMIC_CALENDAR_LIMITS.operationMs - elapsed()),
      );
      timer.unref();
      let provider: BeaReleaseProvider | undefined;
      try {
        active(lifetime);
        provider = (options.createProvider ?? createBeaReleaseProvider)();
        active(lifetime);
        const result = parseManagedEconomicCalendar(
          await awaitManagedEconomicCalendar(provider.load(lifetime), lifetime),
        );
        active(lifetime);
        if (!result)
          throw new ManagedEconomicCalendarServiceError("unavailable");
        return result;
      } catch {
        active(lifetime);
        throw new ManagedEconomicCalendarServiceError("unavailable");
      } finally {
        clearTimeout(timer);
        controller.abort();
        provider?.close();
      }
    },
  };
}
