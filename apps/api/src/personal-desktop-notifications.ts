import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type PersonalDesktopNotificationStatus =
  | "not_submitted"
  | "submission_unconfirmed"
  | "observed_shown"
  | "delivery_uncertain";

export type PersonalDesktopNotificationObservation = {
  status: PersonalDesktopNotificationStatus;
  reason:
    | "unsupported_platform"
    | "adapter_closed"
    | "already_aborted"
    | "delivery_in_progress"
    | "helper_exit_unconfirmed"
    | "invalid_attempt_id"
    | "spawn_failed"
    | "helper_failed_before_submission"
    | "cancelled_before_submission"
    | "callback_shown"
    | "call_returned"
    | "unconfirmed_delivery";
  submissionAttempted: boolean;
  submissionReturned: boolean;
  shown: boolean;
  clicked: boolean;
  closed: boolean;
  cleanup: boolean;
  timedOut: boolean;
  aborted: boolean;
  protocolError: boolean;
  helperFailed: boolean;
  processClosed: boolean;
  exitCode: number | null;
  userRead: "unknown";
};

export type PersonalDesktopNotifications = {
  notify(signal?: AbortSignal): Promise<PersonalDesktopNotificationObservation>;
  close(): Promise<void>;
};

// These limits include compilation time. Neither the requested balloon duration
// nor a shown callback establishes how long Windows displays it or who reads it.
export const PERSONAL_DESKTOP_NOTIFICATION_LIMITS = Object.freeze({
  timeoutMs: 35_000,
  cancelGraceMs: 1_500,
  exitGraceMs: 1_500,
  stdoutBytes: 16_384,
  stderrBytes: 4_096,
  events: 64,
});

const helperPath = fileURLToPath(
  new URL("../native/personal-desktop-notification.ps1", import.meta.url),
);
const executable =
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

type Spawn = typeof spawn;
type Dependencies = {
  spawn?: Spawn;
  platform?: NodeJS.Platform;
  randomId?: () => string;
};

type EventName =
  | "ready"
  | "submission_attempted"
  | "submission_call_returned"
  | "balloon_shown"
  | "balloon_closed"
  | "balloon_clicked"
  | "cancelled"
  | "deadline"
  | "helper_failed"
  | "cleanup";
type NativeEvent = { attemptId: string; event: EventName; at: string };
const events = new Set<EventName>([
  "ready",
  "submission_attempted",
  "submission_call_returned",
  "balloon_shown",
  "balloon_closed",
  "balloon_clicked",
  "cancelled",
  "deadline",
  "helper_failed",
  "cleanup",
]);

function emptyObservation(): PersonalDesktopNotificationObservation {
  return {
    status: "not_submitted",
    reason: "unconfirmed_delivery",
    submissionAttempted: false,
    submissionReturned: false,
    shown: false,
    clicked: false,
    closed: false,
    cleanup: false,
    timedOut: false,
    aborted: false,
    protocolError: false,
    helperFailed: false,
    processClosed: true,
    exitCode: null,
    userRead: "unknown",
  };
}

function parseEvents(
  stdout: string,
  attemptId: string,
): {
  observation: PersonalDesktopNotificationObservation;
  cancelled: boolean;
} {
  const rows: unknown[] = stdout.trim()
    ? stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line) as unknown)
    : [];
  if (rows.length > PERSONAL_DESKTOP_NOTIFICATION_LIMITS.events) {
    throw new Error("Invalid notification protocol.");
  }
  const observation = emptyObservation();
  let ready = false;
  let deadline = false;
  let cancelled = false;
  let previousAt: string | null = null;
  for (const raw of rows) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Invalid notification protocol.");
    }
    const row = raw as NativeEvent;
    if (
      Object.keys(row).length !== 3 ||
      row.attemptId !== attemptId ||
      !events.has(row.event) ||
      typeof row.at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,7}Z$/.test(row.at) ||
      !Number.isFinite(Date.parse(row.at)) ||
      new Date(row.at).toISOString() !== `${row.at.slice(0, 23)}Z` ||
      observation.cleanup
    ) {
      throw new Error("Invalid notification protocol.");
    }
    const preciseAt = `${row.at.slice(0, -1).padEnd(27, "0")}Z`;
    if (previousAt !== null && preciseAt < previousAt) {
      throw new Error("Invalid notification protocol.");
    }
    previousAt = preciseAt;
    switch (row.event) {
      case "ready":
        if (ready || observation.helperFailed || cancelled || deadline) {
          throw new Error("Invalid notification protocol.");
        }
        ready = true;
        break;
      case "submission_attempted":
        if (
          !ready ||
          observation.submissionAttempted ||
          observation.helperFailed ||
          cancelled ||
          deadline
        ) {
          throw new Error("Invalid notification protocol.");
        }
        observation.submissionAttempted = true;
        break;
      case "submission_call_returned":
        if (
          !observation.submissionAttempted ||
          observation.submissionReturned ||
          observation.helperFailed ||
          cancelled ||
          deadline
        ) {
          throw new Error("Invalid notification protocol.");
        }
        observation.submissionReturned = true;
        break;
      case "balloon_shown":
      case "balloon_closed":
      case "balloon_clicked":
        if (!observation.submissionAttempted) {
          throw new Error("Invalid notification protocol.");
        }
        if (row.event === "balloon_shown") observation.shown = true;
        if (row.event === "balloon_closed") observation.closed = true;
        if (row.event === "balloon_clicked") observation.clicked = true;
        break;
      case "cancelled":
        if (!ready || cancelled || deadline) {
          throw new Error("Invalid notification protocol.");
        }
        cancelled = true;
        break;
      case "deadline":
        if (!ready || deadline || cancelled) {
          throw new Error("Invalid notification protocol.");
        }
        deadline = true;
        break;
      case "helper_failed":
        if (observation.helperFailed) {
          throw new Error("Invalid notification protocol.");
        }
        observation.helperFailed = true;
        break;
      case "cleanup":
        if (!deadline && !cancelled && !observation.helperFailed) {
          throw new Error("Invalid notification protocol.");
        }
        observation.cleanup = true;
        break;
    }
  }
  return { observation, cancelled };
}

/** The caller must reserve an attempt durably before calling notify. */
export function createPersonalDesktopNotifications(
  dependencies: Dependencies = {},
): PersonalDesktopNotifications {
  const spawnChild = dependencies.spawn ?? spawn;
  const platform = dependencies.platform ?? process.platform;
  const randomId = dependencies.randomId ?? randomUUID;
  let closed = false;
  let active: {
    controller: AbortController;
    result: Promise<PersonalDesktopNotificationObservation>;
  } | null = null;
  let terminationUnconfirmed = false;

  async function notify(
    signal?: AbortSignal,
  ): Promise<PersonalDesktopNotificationObservation> {
    if (
      closed ||
      platform !== "win32" ||
      signal?.aborted ||
      active !== null ||
      terminationUnconfirmed
    ) {
      const reason = closed
        ? "adapter_closed"
        : platform !== "win32"
          ? "unsupported_platform"
          : signal?.aborted
            ? "already_aborted"
            : active !== null
              ? "delivery_in_progress"
              : "helper_exit_unconfirmed";
      return {
        ...emptyObservation(),
        reason,
        aborted: closed || signal?.aborted === true,
      };
    }
    const attemptId = randomId();
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        attemptId,
      )
    ) {
      return {
        ...emptyObservation(),
        reason: "invalid_attempt_id",
      };
    }
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    signal?.addEventListener("abort", forwardAbort, { once: true });
    const result = deliver(attemptId, controller.signal);
    const current = { controller, result };
    active = current;
    try {
      const observation = await result;
      terminationUnconfirmed ||= !observation.processClosed;
      return observation;
    } finally {
      signal?.removeEventListener("abort", forwardAbort);
      if (active === current) active = null;
    }
  }

  function deliver(
    attemptId: string,
    signal: AbortSignal,
  ): Promise<PersonalDesktopNotificationObservation> {
    return new Promise((resolveResult) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawnChild(
          executable,
          [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-STA",
            "-File",
            helperPath,
            "-AttemptId",
            attemptId,
          ],
          {
            shell: false,
            windowsHide: true,
            cwd: dirname(helperPath),
            stdio: ["pipe", "pipe", "pipe"],
            env: {
              SystemRoot: "C:\\Windows",
              WINDIR: "C:\\Windows",
              TEMP: tmpdir(),
              TMP: tmpdir(),
            },
          },
        );
      } catch {
        resolveResult({ ...emptyObservation(), reason: "spawn_failed" });
        return;
      }
      let stdout = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let started = false;
      let spawnError = false;
      let timedOut = false;
      let protocolError = false;
      let aborted = false;
      let settled = false;
      let stopping = false;
      let forceTimer: ReturnType<typeof setTimeout> | undefined;
      let collectionTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = (exitCode: number | null, processClosed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearTimeout(forceTimer);
        clearTimeout(collectionTimer);
        signal.removeEventListener("abort", onAbort);
        let observation = emptyObservation();
        let cancelled = false;
        try {
          ({ observation, cancelled } = parseEvents(stdout, attemptId));
        } catch {
          protocolError = true;
        }
        observation = {
          ...observation,
          status: "delivery_uncertain",
          reason: "unconfirmed_delivery",
          timedOut,
          aborted,
          protocolError: protocolError || stderrBytes > 0,
          processClosed,
          exitCode,
        };
        if (!observation.protocolError && observation.shown) {
          observation.status = "observed_shown";
          observation.reason = "callback_shown";
        } else if (spawnError && !started) {
          observation.status = "not_submitted";
          observation.reason = "spawn_failed";
        } else if (
          !observation.protocolError &&
          !observation.submissionAttempted &&
          (observation.helperFailed ||
            (cancelled && observation.cleanup && processClosed))
        ) {
          observation.status = "not_submitted";
          observation.reason = observation.helperFailed
            ? "helper_failed_before_submission"
            : "cancelled_before_submission";
        } else if (
          !observation.protocolError &&
          observation.submissionReturned &&
          observation.cleanup &&
          processClosed &&
          exitCode === 0 &&
          !timedOut &&
          !observation.helperFailed
        ) {
          observation.status = "submission_unconfirmed";
          observation.reason = "call_returned";
        }
        resolveResult(observation);
      };
      const stop = () => {
        if (stopping || settled) return;
        stopping = true;
        try {
          child.stdin.end("cancel\n");
        } catch {
          /* The owned-child fallback remains active. */
        }
        if (settled) return;
        forceTimer = setTimeout(() => {
          try {
            child.kill();
          } catch {
            /* Missing closure remains explicit. */
          }
          if (settled) return;
          collectionTimer = setTimeout(
            () => finish(null, false),
            PERSONAL_DESKTOP_NOTIFICATION_LIMITS.exitGraceMs,
          );
        }, PERSONAL_DESKTOP_NOTIFICATION_LIMITS.cancelGraceMs);
      };
      const onAbort = () => {
        aborted = true;
        stop();
      };
      const timeout = setTimeout(() => {
        timedOut = true;
        stop();
      }, PERSONAL_DESKTOP_NOTIFICATION_LIMITS.timeoutMs);
      child.once("spawn", () => {
        started = true;
      });
      child.once("error", () => {
        spawnError = true;
        stop();
      });
      child.stdin.on("error", () => {
        stop();
      });
      const outputFailed = () => {
        protocolError = true;
        stop();
      };
      child.stdout.on("error", outputFailed);
      child.stderr.on("error", outputFailed);
      child.stdout.on("data", (chunk: Buffer) => {
        if (settled) return;
        stdoutBytes += chunk.length;
        if (stdoutBytes > PERSONAL_DESKTOP_NOTIFICATION_LIMITS.stdoutBytes) {
          protocolError = true;
          stop();
        } else stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (settled) return;
        stderrBytes += chunk.length;
        if (stderrBytes > PERSONAL_DESKTOP_NOTIFICATION_LIMITS.stderrBytes) {
          protocolError = true;
          stop();
        }
      });
      child.once("close", (code) => finish(code, true));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }

  return {
    notify,
    async close() {
      closed = true;
      const current = active;
      current?.controller.abort();
      if (current) {
        const observation = await current.result;
        terminationUnconfirmed ||= !observation.processClosed;
      }
      if (terminationUnconfirmed) {
        throw new Error(
          "The desktop notification helper did not confirm exit.",
        );
      }
    },
  };
}
