import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainWatchlistPayload } from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import type { ManagedWorkspace } from "./managed-workspace";
import { ManagedSessionScreen } from "./ManagedWorkspaceScreen";

const mounted = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  workspace: null as ManagedWorkspace | null,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (value: unknown) => [
    value,
    (next: ManagedWorkspace) => {
      mounted.workspace = next;
    },
  ],
  useLayoutEffect: (effect: () => (() => void) | void) =>
    mounted.effects.push(effect),
}));
let cleanup: (() => void) | undefined;
beforeEach(() => {
  mounted.effects.length = 0;
  mounted.workspace = null;
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("managed session browser warning lifetime", () => {
  it.each([true, false, undefined])(
    "binds only for the explicit browser opt-in %s",
    async (warnOnBrowserLeave) => {
      const target = new EventTarget();
      const add = vi.spyOn(target, "addEventListener");
      const remove = vi.spyOn(target, "removeEventListener");
      vi.stubGlobal("window", target);
      const payload: MainWatchlistPayload = {
        name: "My Watchlist",
        schemaVersion: 1,
        snapshotSha256: `sha256:${"a".repeat(64)}`,
        memberships: [],
      };
      const api: ManagedApi = {
        load: vi.fn().mockResolvedValue({ version: 1, payload }),
        save: vi.fn(),
        status: vi.fn().mockRejectedValue(new TrialApiError("unavailable")),
        search: vi.fn(),
        resolve: vi.fn(),
        eodHistory: vi.fn(),
        annualReport: vi.fn(),
      };
      const session = {
        userId: "invented-mounted-user",
        sessionId: "invented-mounted-session",
        getToken: vi.fn(),
        signOut: vi.fn(),
      };
      const html = renderToStaticMarkup(
        <ManagedSessionScreen
          session={session}
          apiOrigin="https://api.example.invalid"
          api={api}
          {...(warnOnBrowserLeave === undefined ? {} : { warnOnBrowserLeave })}
        />,
      );
      expect(html).toContain("Loading your workspace");
      expect(mounted.effects).toHaveLength(1);
      cleanup = mounted.effects[0]!() || undefined;
      await Promise.resolve();
      const coordinator = mounted.workspace!.coordinator;
      expect(add).not.toHaveBeenCalled();
      coordinator.replaceDraft(payload);
      const event = new Event("beforeunload", { cancelable: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(warnOnBrowserLeave === true);
      expect(add).toHaveBeenCalledTimes(warnOnBrowserLeave ? 1 : 0);
      const retained = add.mock.calls[0]?.[1] as EventListener | undefined;
      cleanup?.();
      cleanup = undefined;
      expect(remove).toHaveBeenCalledTimes(warnOnBrowserLeave ? 1 : 0);
      const stale = new Event("beforeunload", { cancelable: true });
      retained?.(stale);
      expect(stale.defaultPrevented).toBe(false);
      expect(coordinator.getSnapshot()).toMatchObject({
        phase: "retired",
        draft: null,
      });
      expect(api.load).toHaveBeenCalledTimes(1);
      expect(api.status).toHaveBeenCalledTimes(1);
      expect(api.save).not.toHaveBeenCalled();
      expect(session.signOut).not.toHaveBeenCalled();
      expect(session.getToken).not.toHaveBeenCalled();
    },
  );
});
