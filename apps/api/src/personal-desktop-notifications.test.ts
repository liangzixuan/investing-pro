import { type spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPersonalDesktopNotifications,
  PERSONAL_DESKTOP_NOTIFICATION_LIMITS as limits,
} from "./personal-desktop-notifications";

const attemptId = "6dcc447a-085f-4162-a0ca-e13429ba652b";
const instant = "2026-09-22T22:00:00.0000000Z";

class FakeChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn(() => true);
}

function fixture() {
  const child = new FakeChild();
  const start = vi.fn(() => child);
  const adapter = createPersonalDesktopNotifications({
    platform: "win32",
    randomId: () => attemptId,
    spawn: start as unknown as typeof spawn,
  });
  return { child, start, adapter };
}

function emit(child: FakeChild, names: string[]) {
  child.stdout.write(
    names
      .map((event) => JSON.stringify({ attemptId, event, at: instant }))
      .join("\n") + "\n",
  );
}

function started(child: FakeChild) {
  child.emit("spawn");
  emit(child, ["ready", "submission_attempted", "submission_call_returned"]);
}

function finish(child: FakeChild, names = ["deadline", "cleanup"], code = 0) {
  emit(child, names);
  child.emit("close", code);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("personal desktop notification delivery", () => {
  it("launches only its module-relative helper with fixed arguments and a minimal environment", async () => {
    const { adapter, child, start } = fixture();
    vi.stubEnv("PERSONAL_SEC_USER_AGENT", "must-not-inherit-contact");
    vi.stubEnv("PERSONAL_MARKET_DATA_TIINGO_TOKEN", "must-not-inherit-token");
    vi.stubEnv("NODE_OPTIONS", "must-not-inherit-options");
    const pending = adapter.notify();
    const [executable, args, options] = start.mock.calls[0] as unknown as [
      string,
      string[],
      Record<string, unknown>,
    ];
    const helper = fileURLToPath(
      new URL("../native/personal-desktop-notification.ps1", import.meta.url),
    );
    expect(executable).toBe(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    );
    expect(args).toEqual([
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-STA",
      "-File",
      helper,
      "-AttemptId",
      attemptId,
    ]);
    expect(isAbsolute(helper)).toBe(true);
    expect(options).toEqual({
      shell: false,
      windowsHide: true,
      cwd: dirname(helper),
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        SystemRoot: "C:\\Windows",
        WINDIR: "C:\\Windows",
        TEMP: tmpdir(),
        TMP: tmpdir(),
      },
    });
    started(child);
    finish(child);
    await pending;
    await adapter.close();
  });

  it("reports a shown callback and preserves closed/clicked as observations, never reading", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    started(child);
    emit(child, [
      "balloon_shown",
      "balloon_clicked",
      "balloon_closed",
      "balloon_closed",
    ]);
    finish(child);
    expect(await pending).toMatchObject({
      status: "observed_shown",
      reason: "callback_shown",
      submissionAttempted: true,
      submissionReturned: true,
      shown: true,
      closed: true,
      clicked: true,
      cleanup: true,
      processClosed: true,
      userRead: "unknown",
      protocolError: false,
    });
  });

  it("accepts a synchronous shown callback before the submission method returns", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    child.emit("spawn");
    emit(child, [
      "ready",
      "submission_attempted",
      "balloon_shown",
      "submission_call_returned",
    ]);
    finish(child);
    expect(await pending).toMatchObject({
      status: "observed_shown",
      protocolError: false,
    });
  });

  it("keeps a returned call without shown evidence unconfirmed", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    started(child);
    finish(child);
    expect(await pending).toMatchObject({
      status: "submission_unconfirmed",
      shown: false,
      userRead: "unknown",
    });
  });

  it("does not treat closed alone as display or read evidence", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    started(child);
    emit(child, ["balloon_closed"]);
    finish(child);
    expect(await pending).toMatchObject({
      status: "submission_unconfirmed",
      shown: false,
      closed: true,
      userRead: "unknown",
    });
  });

  it.each([
    ["before", ["helper_failed"], "not_submitted"],
    [
      "during",
      ["ready", "submission_attempted", "helper_failed", "cleanup"],
      "delivery_uncertain",
    ],
    [
      "after shown",
      [
        "ready",
        "submission_attempted",
        "balloon_shown",
        "helper_failed",
        "cleanup",
      ],
      "observed_shown",
    ],
  ])(
    "records helper failure %s submission without claiming retry safety after an attempt",
    async (_label, names, status) => {
      const { adapter, child } = fixture();
      const pending = adapter.notify();
      child.emit("spawn");
      emit(child, names);
      child.emit("close", 1);
      expect(await pending).toMatchObject({
        status,
        helperFailed: true,
        exitCode: 1,
      });
    },
  );

  it("returns not submitted for an unsupported platform without spawning", async () => {
    const start = vi.fn();
    const adapter = createPersonalDesktopNotifications({
      platform: "linux",
      spawn: start,
    });
    expect(await adapter.notify()).toMatchObject({
      status: "not_submitted",
      reason: "unsupported_platform",
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("does not spawn for an already aborted signal", async () => {
    const { adapter, start } = fixture();
    expect(await adapter.notify(AbortSignal.abort())).toMatchObject({
      status: "not_submitted",
      reason: "already_aborted",
      aborted: true,
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("does not spawn after close", async () => {
    const { adapter, start } = fixture();
    await adapter.close();
    expect(await adapter.notify()).toMatchObject({
      status: "not_submitted",
      reason: "adapter_closed",
    });
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects overlapping deliveries without starting another helper", async () => {
    const { adapter, start, child } = fixture();
    const pending = adapter.notify();
    expect(await adapter.notify()).toMatchObject({
      status: "not_submitted",
      reason: "delivery_in_progress",
    });
    expect(start).toHaveBeenCalledTimes(1);
    started(child);
    finish(child);
    await pending;
  });

  it("returns not submitted when spawn throws", async () => {
    const adapter = createPersonalDesktopNotifications({
      platform: "win32",
      spawn: vi.fn(() => {
        throw new Error("private-error");
      }),
    });
    expect(await adapter.notify()).toMatchObject({
      status: "not_submitted",
      reason: "spawn_failed",
    });
  });

  it("returns not submitted when the OS reports spawn failure before start", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    child.emit("error", new Error("private-error"));
    child.emit("close", -1);
    expect(await pending).toMatchObject({
      status: "not_submitted",
      reason: "spawn_failed",
    });
  });

  it("treats an error after start without terminal evidence as uncertain", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    child.emit("spawn");
    child.emit("error", new Error("private-error"));
    child.emit("close", 1);
    expect(await pending).toMatchObject({ status: "delivery_uncertain" });
  });

  it.each([
    ["invalid JSON", "not-json\n"],
    [
      "wrong identity",
      JSON.stringify({
        attemptId: "wrong",
        event: "helper_failed",
        at: instant,
      }),
    ],
    [
      "unknown event",
      JSON.stringify({ attemptId, event: "displayed", at: instant }),
    ],
    ["array row", "[]"],
    ["null row", "null"],
    [
      "extra data",
      JSON.stringify({
        attemptId,
        event: "helper_failed",
        at: instant,
        payload: "unwanted",
      }),
    ],
    [
      "invalid date",
      JSON.stringify({
        attemptId,
        event: "helper_failed",
        at: "2026-02-30T22:00:00.000Z",
      }),
    ],
    [
      "unbounded precision",
      JSON.stringify({
        attemptId,
        event: "helper_failed",
        at: "2026-09-22T22:00:00.00000001Z",
      }),
    ],
    [
      "non-UTC time",
      JSON.stringify({
        attemptId,
        event: "helper_failed",
        at: "2026-09-22T22:00:00.000+00:00",
      }),
    ],
  ])(
    "rejects %s without retaining diagnostics or raw callback data",
    async (_label, raw) => {
      const { adapter, child } = fixture();
      const pending = adapter.notify();
      child.emit("spawn");
      child.stdout.write(raw);
      child.emit("close", 0);
      const result = await pending;
      expect(result).toMatchObject({
        status: "delivery_uncertain",
        protocolError: true,
      });
      expect(result).not.toHaveProperty("events");
      expect(result).not.toHaveProperty("stderr");
    },
  );

  it.each([
    ["callback before attempt", ["ready", "balloon_shown"]],
    ["repeated ready", ["ready", "ready"]],
    [
      "repeated attempt",
      ["ready", "submission_attempted", "submission_attempted"],
    ],
    ["returned without attempt", ["ready", "submission_call_returned"]],
    [
      "repeated return",
      [
        "ready",
        "submission_attempted",
        "submission_call_returned",
        "submission_call_returned",
      ],
    ],
    ["attempt after failure", ["helper_failed", "submission_attempted"]],
    [
      "attempt after cancellation",
      ["ready", "cancelled", "submission_attempted"],
    ],
    ["attempt after deadline", ["ready", "deadline", "submission_attempted"]],
    ["event after cleanup", ["helper_failed", "cleanup", "ready"]],
    ["unexplained cleanup", ["ready", "cleanup"]],
  ])("rejects %s", async (_label, names) => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    child.emit("spawn");
    emit(child, names);
    child.emit("close", 0);
    expect(await pending).toMatchObject({
      status: "delivery_uncertain",
      protocolError: true,
    });
  });

  it("compares 100-nanosecond timestamps without truncating their order", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    child.emit("spawn");
    child.stdout.write(
      [
        { attemptId, event: "ready", at: "2026-09-22T22:00:00.0000002Z" },
        {
          attemptId,
          event: "submission_attempted",
          at: "2026-09-22T22:00:00.0000001Z",
        },
      ]
        .map((row) => JSON.stringify(row))
        .join("\n"),
    );
    child.emit("close", 0);
    expect(await pending).toMatchObject({
      status: "delivery_uncertain",
      protocolError: true,
    });
  });

  it("allows equal times represented at different accepted precision", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    child.emit("spawn");
    child.stdout.write(
      [
        { attemptId, event: "helper_failed", at: "2026-09-22T22:00:00.000Z" },
        { attemptId, event: "cleanup", at: "2026-09-22T22:00:00.0000000Z" },
      ]
        .map((row) => JSON.stringify(row))
        .join("\n"),
    );
    child.emit("close", 1);
    expect(await pending).toMatchObject({
      status: "not_submitted",
      protocolError: false,
    });
  });

  it("cancels cooperatively before submission and waits for helper exit", async () => {
    const { adapter, child } = fixture();
    const controller = new AbortController();
    const pending = adapter.notify(controller.signal);
    child.emit("spawn");
    emit(child, ["ready"]);
    controller.abort();
    expect(child.stdin.read()).toEqual(Buffer.from("cancel\n"));
    finish(child, ["cancelled", "cleanup"]);
    expect(await pending).toMatchObject({
      status: "not_submitted",
      reason: "cancelled_before_submission",
      aborted: true,
      processClosed: true,
    });
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("keeps a cancelled submitted notification uncertain without its terminal evidence", async () => {
    const { adapter, child } = fixture();
    const controller = new AbortController();
    const pending = adapter.notify(controller.signal);
    child.emit("spawn");
    emit(child, ["ready", "submission_attempted"]);
    controller.abort();
    child.emit("close", 1);
    expect(await pending).toMatchObject({
      status: "delivery_uncertain",
      aborted: true,
    });
  });

  it("close cancels and awaits its only active helper, then rejects new notifications", async () => {
    const { adapter, child, start } = fixture();
    const pending = adapter.notify();
    child.emit("spawn");
    emit(child, ["ready"]);
    let closed = false;
    const closing = adapter.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    expect(child.stdin.read()).toEqual(Buffer.from("cancel\n"));
    finish(child, ["cancelled", "cleanup"]);
    await pending;
    await closing;
    expect(closed).toBe(true);
    expect(await adapter.notify()).toMatchObject({
      status: "not_submitted",
      reason: "adapter_closed",
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("times out, cancels, and kills only the retained child after the grace period", async () => {
    vi.useFakeTimers();
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    started(child);
    await vi.advanceTimersByTimeAsync(limits.timeoutMs);
    expect(child.stdin.read()).toEqual(Buffer.from("cancel\n"));
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(limits.cancelGraceMs);
    expect(child.kill).toHaveBeenCalledTimes(1);
    child.emit("close", null);
    expect(await pending).toMatchObject({
      status: "delivery_uncertain",
      timedOut: true,
      processClosed: true,
    });
    await adapter.close();
  });

  it("keeps shown evidence while retaining a later timeout and missing cleanup", async () => {
    vi.useFakeTimers();
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    started(child);
    emit(child, ["balloon_shown"]);
    await vi.advanceTimersByTimeAsync(limits.timeoutMs + limits.cancelGraceMs);
    child.emit("close", null);
    expect(await pending).toMatchObject({
      status: "observed_shown",
      shown: true,
      timedOut: true,
      cleanup: false,
    });
  });

  it("bounds missing process closure and refuses further sends or a successful shutdown claim", async () => {
    vi.useFakeTimers();
    const { adapter, child, start } = fixture();
    child.kill.mockImplementation(() => {
      throw new Error("kill failure");
    });
    const pending = adapter.notify();
    child.emit("spawn");
    await vi.advanceTimersByTimeAsync(
      limits.timeoutMs + limits.cancelGraceMs + limits.exitGraceMs,
    );
    expect(await pending).toMatchObject({
      status: "delivery_uncertain",
      timedOut: true,
      processClosed: false,
    });
    expect(await adapter.notify()).toMatchObject({
      status: "not_submitted",
      reason: "helper_exit_unconfirmed",
    });
    await expect(adapter.close()).rejects.toThrow("did not confirm exit");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it.each(["stdout", "stderr"] as const)(
    "bounds %s without exposing its contents",
    async (stream) => {
      const { adapter, child } = fixture();
      const pending = adapter.notify();
      child.emit("spawn");
      child[stream].write("private-canary-".repeat(2_000));
      expect(child.stdin.read()).toEqual(Buffer.from("cancel\n"));
      child.emit("close", 1);
      const result = await pending;
      expect(result).toMatchObject({
        status: "delivery_uncertain",
        protocolError: true,
      });
      expect(JSON.stringify(result)).not.toContain("private-canary");
    },
  );

  it("does not ignore small stderr output beside otherwise valid shown callbacks", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    started(child);
    emit(child, ["balloon_shown"]);
    child.stderr.write("unexpected-error");
    finish(child);
    expect(await pending).toMatchObject({
      status: "delivery_uncertain",
      protocolError: true,
      shown: true,
    });
  });

  it.each(["stdout", "stderr"] as const)(
    "contains %s pipe errors and retires only its child",
    async (stream) => {
      const { adapter, child } = fixture();
      const pending = adapter.notify();
      started(child);
      child[stream].emit("error", new Error("private-pipe-error"));
      expect(child.stdin.read()).toEqual(Buffer.from("cancel\n"));
      child.emit("close", 1);
      const result = await pending;
      expect(result).toMatchObject({
        status: "delivery_uncertain",
        protocolError: true,
      });
      expect(JSON.stringify(result)).not.toContain("private-pipe-error");
    },
  );

  it("bounds callback count even when output is below its byte limit", async () => {
    const { adapter, child } = fixture();
    const pending = adapter.notify();
    started(child);
    emit(
      child,
      Array.from({ length: limits.events }, () => "balloon_closed"),
    );
    child.emit("close", 0);
    expect(await pending).toMatchObject({
      status: "delivery_uncertain",
      protocolError: true,
    });
  });

  it("uses fixed generic product text and a compile-only path in the shipped helper", async () => {
    const source = await readFile(
      new URL("../native/personal-desktop-notification.ps1", import.meta.url),
      "utf8",
    );
    expect(source).toContain('"Investment filing updates"');
    expect(source).toContain(
      '"New filing updates are available. Open Investment to review your inbox."',
    );
    expect(source).toContain("[switch]$ValidateOnly");
    expect(source).toContain("compiled_without_notification");
    expect(source).not.toContain("$Body");
    expect(source).not.toContain("$Title");
  });
});
