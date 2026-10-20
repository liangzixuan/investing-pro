import {
  MANAGED_BLS_CALENDAR_LIMITS,
  parseManagedBlsCalendar,
  type ManagedBlsCalendarDto,
} from "@research-cockpit/contracts";

import {
  createBlsReleaseProvider,
  type BlsReleaseProvider,
} from "./bls-release-provider";

import {
  ManagedEconomicCalendarServiceError,
  awaitManagedEconomicCalendar,
} from "./managed-economic-calendar-service";
export interface ManagedBlsCalendarService {
  load(signal: AbortSignal): Promise<ManagedBlsCalendarDto>;
  assertActive(signal: AbortSignal): void;
}

/** One explicit source read per invocation; entry time includes bridge and auth. */
export function createManagedBlsCalendarService(options: {
  readonly startedAt: number;
  readonly monotonic?: () => number;
  readonly createProvider?: () => BlsReleaseProvider;
}): ManagedBlsCalendarService {
  const monotonic = options.monotonic ?? (() => performance.now());
  const elapsed = () => monotonic() - options.startedAt;
  const active = (signal: AbortSignal) => {
    const duration = elapsed();
    if (signal.aborted)
      throw new ManagedEconomicCalendarServiceError("request_timeout");
    if (!Number.isFinite(duration))
      throw new ManagedEconomicCalendarServiceError("request_timeout");
    if (duration < 0 || duration >= MANAGED_BLS_CALENDAR_LIMITS.operationMs)
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
        Math.max(1, MANAGED_BLS_CALENDAR_LIMITS.operationMs - elapsed()),
      );
      timer.unref();
      let provider: BlsReleaseProvider | undefined;
      try {
        active(lifetime);
        provider = (options.createProvider ?? createBlsReleaseProvider)();
        active(lifetime);
        const result = parseManagedBlsCalendar(
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
