import type { PersonalSecurityMasterScreenRowDto } from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => {
  const states: unknown[] = [],
    refs: { current: unknown }[] = [],
    effects: { deps: readonly unknown[]; cleanup?: () => void }[] = [];
  let si = 0,
    ri = 0,
    ei = 0;
  let pending: (() => void)[] = [];
  return {
    begin() {
      si = ri = ei = 0;
    },
    run() {
      pending.splice(0).forEach((fn) => fn());
    },
    reset() {
      states.length = refs.length = effects.length = 0;
      pending = [];
    },
    cleanup() {
      effects.forEach((e) => e.cleanup?.());
      effects.length = 0;
    },
    useState<T>(this: void, initial: T) {
      const index = si++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value: T) => {
          states[index] = value;
        },
      ];
    },
    useRef<T>(this: void, initial: T) {
      const index = ri++;
      return refs[index] ?? (refs[index] = { current: initial });
    },
    useEffect(
      this: void,
      fn: () => void | (() => void),
      deps: readonly unknown[],
    ) {
      const index = ei++;
      const old = effects[index];
      if (old && old.deps.every((v, i) => Object.is(v, deps[i]))) return;
      pending.push(() => {
        old?.cleanup?.();
        const cleanup = fn();
        effects[index] = { deps, ...(cleanup ? { cleanup } : {}) };
      });
    },
  };
});
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("react", () => ({
  useState: h.useState,
  useRef: h.useRef,
  useEffect: h.useEffect,
}));
vi.mock("@/lib/personal-workspace-api", () => ({
  fetchPersonalSecurityMasterListing: api.fetch,
  PersonalWorkspaceApiError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));
import {
  useWorkspaceCompanyRoute,
  type WorkspaceCompanyRouteInput,
} from "./useWorkspaceCompanyRoute";
let input: WorkspaceCompanyRouteInput;
let current = true;
let complete: ReturnType<typeof vi.fn<() => boolean>>;
const digest = "sha256:" + "a".repeat(64);
function row(id = "listing-one"): PersonalSecurityMasterScreenRowDto {
  return {
    country: "US",
    cik: "0000000001",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-one",
    issuerName: "One",
    listingId: id,
    securityId: "security-one",
    securityName: "One Common",
    shareClassId: "class-one",
    shareClassName: "Common",
    symbol: "ONE",
  };
}
const result = (
  listing: PersonalSecurityMasterScreenRowDto | null = row(),
  snapshotSha256 = digest,
) => ({ listing, snapshot: { snapshotSha256 } });
function render() {
  h.begin();
  const status = useWorkspaceCompanyRoute(input);
  h.run();
  return status;
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  h.reset();
  api.fetch.mockReset().mockResolvedValue(result());
  current = true;
  complete = vi.fn(() => true);
  input = {
    route: { kind: "company", listingId: "listing-one" },
    enabled: true,
    catalogSnapshotSha256: digest,
    sessionKey: 1,
    selectedListingId: null,
    isCurrent: () => current,
    onActivityStart: vi.fn(() => complete),
    onSessionUnavailable: vi.fn(),
    onView: vi.fn(),
    onResolved: vi.fn(),
  };
});
afterEach(() => h.cleanup());
describe("company route resolution", () => {
  it("finishes a pending lookup after an unrelated workspace replacement with the same catalog and session", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    api.fetch.mockReturnValueOnce(pending.promise);
    let oldWorkspaceCurrent = true;
    input = { ...input, isCurrent: () => oldWorkspaceCurrent };
    render();
    oldWorkspaceCurrent = false;
    input = { ...input, isCurrent: () => true };
    render();
    pending.resolve(result());
    await flush();
    expect(input.onResolved).toHaveBeenCalledOnce();
    expect(api.fetch).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(render()).toBe("ready");
  });
  it("does not consume activity twice when a current selection callback throws", async () => {
    input = {
      ...input,
      onResolved: vi.fn(() => {
        throw new Error("selection unavailable");
      }),
    };
    render();
    await flush();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(render()).toBe("unavailable");
    expect(input.onSessionUnavailable).not.toHaveBeenCalled();
  });
  it("uses the most recent catalog and session identity after a late old lookup", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    api.fetch.mockReturnValueOnce(pending.promise);
    render();
    input = {
      ...input,
      sessionKey: 2,
      catalogSnapshotSha256: "sha256:" + "b".repeat(64),
    };
    api.fetch.mockResolvedValue(result(row(), input.catalogSnapshotSha256!));
    render();
    await flush();
    expect(input.onResolved).toHaveBeenCalledTimes(1);
    pending.resolve(result());
    await flush();
    expect(input.onResolved).toHaveBeenCalledTimes(1);
  });
  it("resolves exact listing and snapshot once without provider acquisition", async () => {
    render();
    await flush();
    expect(api.fetch).toHaveBeenCalledExactlyOnceWith(
      "listing-one",
      expect.any(AbortSignal),
    );
    const resolved = vi.mocked(input.onResolved).mock.calls[0];
    expect(resolved?.[0]).toEqual(row());
    expect(typeof resolved?.[1]).toBe("function");
    expect(resolved?.[1]()).toBe(true);
    expect(complete).toHaveBeenCalledOnce();
    expect(render()).toBe("ready");
  });
  it("does not repeat lookup when a current selected listing already matches", () => {
    input = { ...input, selectedListingId: "listing-one" };
    render();
    expect(api.fetch).not.toHaveBeenCalled();
    expect(render()).toBe("ready");
  });
  it.each([false, true])(
    "defers lookup while readiness or catalog is missing (%s)",
    (enabled) => {
      input = { ...input, enabled, catalogSnapshotSha256: null };
      render();
      expect(api.fetch).not.toHaveBeenCalled();
    },
  );
  it("shows missing catalog membership without guessing an identity", async () => {
    api.fetch.mockResolvedValue(result(null));
    render();
    await flush();
    expect(render()).toBe("missing");
    expect(input.onResolved).not.toHaveBeenCalled();
  });
  it.each(["snapshot", "identity"])("refuses a mismatched %s", async (kind) => {
    api.fetch.mockResolvedValue(
      kind === "snapshot"
        ? result(row(), "sha256:" + "b".repeat(64))
        : result(row("wrong")),
    );
    render();
    await flush();
    expect(render()).toBe("unavailable");
    expect(input.onResolved).not.toHaveBeenCalled();
  });
  it("retires a delayed response when the route changes", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    api.fetch.mockReturnValueOnce(pending.promise);
    render();
    const signal = api.fetch.mock.calls[0]?.[1] as AbortSignal;
    input = { ...input, route: { kind: "markets" } };
    render();
    pending.resolve(result());
    await flush();
    expect(signal.aborted).toBe(true);
    expect(input.onResolved).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
  it("rejects an old completion immediately on session retirement before rerender", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    api.fetch.mockReturnValueOnce(pending.promise);
    render();
    current = false;
    pending.resolve(result());
    await flush();
    expect(input.onResolved).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });
  it("retires old work across cleanup and identical-props setup", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    api.fetch.mockReturnValueOnce(pending.promise);
    render();
    h.cleanup();
    render();
    await flush();
    expect(input.onResolved).toHaveBeenCalledTimes(1);
    pending.resolve(result());
    await flush();
    expect(input.onResolved).toHaveBeenCalledTimes(1);
  });
  it("requires successful one-use activity completion before publishing", async () => {
    complete.mockReturnValue(false);
    render();
    await flush();
    expect(input.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(input.onResolved).not.toHaveBeenCalled();
  });
  it("uses the latest view callback after route setup changes view state", async () => {
    const pending = deferred<ReturnType<typeof result>>();
    api.fetch.mockReturnValueOnce(pending.promise);
    const old = input.onResolved;
    render();
    input = { ...input, onResolved: vi.fn() };
    render();
    pending.resolve(result());
    await flush();
    expect(old).not.toHaveBeenCalled();
    expect(input.onResolved).toHaveBeenCalledOnce();
  });
});
