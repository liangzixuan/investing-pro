import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import { describe, expect, it, vi } from "vitest";

import type { PersonalDesktopNotifications } from "./personal-desktop-notifications";
import type { PersonalFilingMonitor } from "./personal-filing-monitor";
import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import { buildTestSecurityMasterAdmission } from "./test-personal-security-master-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";

describe("workspace filing monitor lifecycle", () => {
  it("starts on readiness and awaits the worker and native adapter before closing storage", async () => {
    const calls: string[] = [];
    let finishWorker!: () => void;
    let finishNative!: () => void;
    let workerClosing!: () => void;
    let nativeClosing!: () => void;
    const workerStarted = new Promise<void>((resolve) => {
      workerClosing = resolve;
    });
    const nativeStarted = new Promise<void>((resolve) => {
      nativeClosing = resolve;
    });
    const workerDone = new Promise<void>((resolve) => {
      finishWorker = resolve;
    });
    const nativeDone = new Promise<void>((resolve) => {
      finishNative = resolve;
    });
    const f = await fixture(
      calls,
      async () => {
        calls.push("worker-closing");
        workerClosing();
        await workerDone;
        calls.push("worker-closed");
      },
      async () => {
        calls.push("native-closing");
        nativeClosing();
        await nativeDone;
        calls.push("native-closed");
      },
    );
    expect(calls).toEqual([]);
    await f.app.ready();
    expect(calls).toEqual(["worker-started"]);
    const closing = f.app.close();
    await workerStarted;
    expect(calls).toEqual(["worker-started", "worker-closing"]);
    finishWorker();
    await nativeStarted;
    expect(calls).not.toContain("vault-closed");
    finishNative();
    await closing;
    expect(calls).toEqual([
      "worker-started",
      "worker-closing",
      "worker-closed",
      "native-closing",
      "native-closed",
      "vault-closed",
    ]);
    expect(f.owner.isLocalAccessEnabled()).toBe(false);
  });

  it("still disposes the native adapter, vault and owner after a worker-close failure", async () => {
    const calls: string[] = [];
    const f = await fixture(
      calls,
      () => {
        calls.push("worker-failed");
        return Promise.reject(new Error("synthetic-close-failure"));
      },
      () => {
        calls.push("native-closed");
        return Promise.resolve();
      },
    );
    await f.app.ready();
    await expect(f.app.close()).rejects.toThrow("synthetic-close-failure");
    expect(calls).toEqual([
      "worker-started",
      "worker-failed",
      "native-closed",
      "vault-closed",
    ]);
    expect(f.owner.isLocalAccessEnabled()).toBe(false);
  });
});

async function fixture(
  calls: string[],
  closeWorker: () => Promise<void>,
  closeNative: () => Promise<void>,
) {
  const catalog = admitPersonalSecurityMasterSnapshot(
    buildTestSecurityMasterAdmission(),
  );
  const vault = {
    profile: LOCAL_RESEARCH_VAULT_PROFILE,
    close: () => {
      calls.push("vault-closed");
    },
  } as unknown as LocalResearchVault;
  const owner = PersonalOwnerSessionAuthority.createForLocalAccess();
  const monitor = {
    start: () => {
      calls.push("worker-started");
    },
    close: closeWorker,
    get: vi.fn(),
    configure: vi.fn(),
    pause: vi.fn(),
    acknowledge: vi.fn(),
    reset: vi.fn(),
    tick: vi.fn(),
  } as unknown as PersonalFilingMonitor;
  const notifications = {
    notify: vi.fn(),
    close: closeNative,
  } as unknown as PersonalDesktopNotifications;
  const app = await buildPersonalWorkspaceApp(
    catalog,
    vault,
    owner,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    monitor,
    notifications,
  );
  return { app, owner };
}
