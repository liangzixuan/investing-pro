import {
  MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS,
  parseManagedMonetaryAnnouncements,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";

import {
  createFedMonetaryAnnouncementsProvider,
  type FedMonetaryAnnouncementsProvider,
} from "./fed-monetary-announcements-provider";

export class ManagedMonetaryAnnouncementsServiceError extends Error {
  constructor(readonly code: "unavailable" | "request_timeout") {
    super(code);
    this.name = "ManagedMonetaryAnnouncementsServiceError";
  }
}

export interface ManagedMonetaryAnnouncementsService {
  load(signal: AbortSignal): Promise<PersonalMonetaryAnnouncementsDto>;
  assertActive(signal: AbortSignal): void;
}

/** Abort retires the result even when the awaited dependency ignores its signal. */
export async function awaitManagedMonetaryAnnouncements<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let stop: () => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () =>
      reject(new ManagedMonetaryAnnouncementsServiceError("request_timeout"));
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
export function createManagedMonetaryAnnouncementsService(options: {
  readonly startedAt: number;
  readonly monotonic?: () => number;
  readonly createProvider?: () => FedMonetaryAnnouncementsProvider;
}): ManagedMonetaryAnnouncementsService {
  const monotonic = options.monotonic ?? (() => performance.now());
  const elapsed = () => monotonic() - options.startedAt;
  const active = (signal: AbortSignal) => {
    const duration = elapsed();
    if (
      signal.aborted ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration >= MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS.operationMs
    )
      throw new ManagedMonetaryAnnouncementsServiceError("request_timeout");
  };
  let used = false;
  return {
    assertActive: active,
    async load(signal) {
      active(signal);
      if (used)
        throw new ManagedMonetaryAnnouncementsServiceError("unavailable");
      used = true;
      const controller = new AbortController();
      const lifetime = AbortSignal.any([signal, controller.signal]);
      const timer = setTimeout(
        () => controller.abort(),
        Math.max(
          1,
          MANAGED_MONETARY_ANNOUNCEMENTS_LIMITS.operationMs - elapsed(),
        ),
      );
      timer.unref();
      let provider: FedMonetaryAnnouncementsProvider | undefined;
      try {
        active(lifetime);
        provider = (
          options.createProvider ?? createFedMonetaryAnnouncementsProvider
        )();
        active(lifetime);
        const result = parseManagedMonetaryAnnouncements(
          await awaitManagedMonetaryAnnouncements(
            provider.load(lifetime),
            lifetime,
          ),
        );
        active(lifetime);
        if (!result)
          throw new ManagedMonetaryAnnouncementsServiceError("unavailable");
        return result;
      } catch {
        active(lifetime);
        throw new ManagedMonetaryAnnouncementsServiceError("unavailable");
      } finally {
        clearTimeout(timer);
        controller.abort();
        provider?.close();
      }
    },
  };
}
