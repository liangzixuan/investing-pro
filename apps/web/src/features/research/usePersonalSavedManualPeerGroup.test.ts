import type {
  PersonalSavedManualPeerBindingDto,
  PersonalSavedManualPeerGroupDto,
  PersonalSavedManualPeerIdentityDto,
  PersonalSavedManualPeerPutRequestDto,
  PersonalSavedManualPeerResolvedDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SavedApi from "../../lib/personal-saved-manual-peer-group-api";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  usePersonalSavedManualPeerGroup,
  type PersonalSavedManualPeerContext,
} from "./usePersonalSavedManualPeerGroup";

type Record = {
  version: number;
  payload: { schemaVersion: 1; group: PersonalSavedManualPeerGroupDto | null };
};
const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{
    dependencies: readonly unknown[] | undefined;
    setup: () => void | (() => void);
    cleanup: (() => void) | undefined;
  }> = [];
  const pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let scheduledRender = false;
  return {
    beginRender() {
      scheduledRender = false;
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      effects.splice(0);
      pending.splice(0);
      stateIndex = refIndex = effectIndex = 0;
      scheduledRender = false;
    },
    commit() {
      pending.splice(0).forEach((run) => run());
    },
    replayCommittedEffects() {
      if (pending.length !== 0)
        throw new Error("Commit effects before replaying their lifetime.");
      effects.forEach((effect) => effect.cleanup?.());
      effects.forEach((effect) => {
        effect.cleanup = effect.setup() ?? undefined;
      });
    },
    hasScheduledRender() {
      return scheduledRender;
    },
    unmount() {
      pending.splice(0);
      effects.forEach((effect) => effect.cleanup?.());
    },
    useState(this: void, initial: unknown) {
      const index = stateIndex++;
      if (!(index in states))
        states[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        states[index],
        (next: unknown) => {
          const value =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(states[index])
              : next;
          if (!Object.is(value, states[index])) scheduledRender = true;
          states[index] = value;
        },
      ];
    },
    useRef<T>(this: void, initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useEffect(
      this: void,
      callback: () => void | (() => void),
      dependencies?: readonly unknown[],
    ) {
      const index = effectIndex++;
      const old = effects[index];
      if (
        old !== undefined &&
        dependencies !== undefined &&
        old.dependencies !== undefined &&
        dependencies.length === old.dependencies.length &&
        dependencies.every((value, i) => Object.is(value, old.dependencies![i]))
      )
        return;
      const effect = {
        dependencies: dependencies?.slice(),
        setup: callback,
        cleanup: old?.cleanup,
      };
      effects[index] = effect;
      pending.push(() => {
        effect.cleanup?.();
        effect.cleanup = callback() ?? undefined;
      });
    },
  };
});
const client = vi.hoisted(() => ({
  fetch: vi.fn<(signal: AbortSignal) => Promise<Record | null>>(),
  put: vi.fn<
    (
      version: number,
      request: PersonalSavedManualPeerPutRequestDto,
      signal: AbortSignal,
    ) => Promise<Record>
  >(),
  resolve:
    vi.fn<
      (
        version: number,
        identity: PersonalSavedManualPeerIdentityDto,
        binding: PersonalSavedManualPeerBindingDto,
        signal: AbortSignal,
      ) => Promise<PersonalSavedManualPeerResolvedDto>
    >(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: hooks.useState,
  useRef: hooks.useRef,
  useEffect: hooks.useEffect,
}));
vi.mock("@/lib/personal-workspace-api", async () =>
  vi.importActual("../../lib/personal-workspace-api"),
);
vi.mock("@/lib/personal-saved-manual-peer-group-api", async () => ({
  ...(await vi.importActual<typeof SavedApi>(
    "../../lib/personal-saved-manual-peer-group-api",
  )),
  fetchPersonalSavedManualPeerGroup: client.fetch,
  putPersonalSavedManualPeerGroup: client.put,
  resolvePersonalSavedManualPeerGroup: client.resolve,
}));

let context: PersonalSavedManualPeerContext;
let roster: PersonalSavedManualPeerGroupDto | null;
let generation = 0;
let current = true;
const restore =
  vi.fn<
    (group: PersonalSavedManualPeerGroupDto, generation: number) => boolean
  >();
const unavailable = vi.fn();
const unexpectedFetch = vi.fn();
const digest = `sha256:${"a".repeat(64)}` as const;
beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  client.fetch.mockReset().mockResolvedValue(null);
  client.put.mockReset().mockImplementation((version, request) =>
    Promise.resolve({
      version: version + 1,
      payload: structuredClone(request.payload),
    }),
  );
  client.resolve.mockReset().mockResolvedValue(resolved());
  generation = 0;
  current = true;
  roster = group();
  restore.mockReset().mockImplementation((value, captured) => {
    if (captured !== generation) return false;
    roster = structuredClone(value);
    generation += 1;
    return true;
  });
  context = {
    workspaceKey: "workspace-1",
    contextKey: "company-1",
    enabled: true,
    identity: identity("A"),
    watchlistBinding: { catalogSnapshotSha256: digest, watchlistVersion: 3 },
    isCurrent: () => current,
    onSessionUnavailable: unavailable,
    getSaveGroup: () => roster,
    getEditGeneration: () => generation,
    onRestore: restore,
  };
  unexpectedFetch.mockReset().mockImplementation(() => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", unexpectedFetch);
});
afterEach(() => {
  hooks.unmount();
  expect(unexpectedFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("explicit saved manual peer lifecycle", () => {
  it("publishes fresh controls after initial StrictMode replay without automatic IO", async () => {
    const initialView = render();
    hooks.replayCommittedEffects();
    expect(hooks.hasScheduledRender()).toBe(true);
    initialView.onLoad();
    expect(client.fetch).not.toHaveBeenCalled();
    const fresh = render();
    expect(fresh).toMatchObject({ loaded: false, busy: false, enabled: true });
    fresh.onLoad();
    await flush();
    expect(render().loaded).toBe(true);
    expect(client.fetch).toHaveBeenCalledTimes(1);
  });
  it("does no automatic IO on mount, roster edit or context change", () => {
    expect(render()).toMatchObject({
      loaded: false,
      canSave: false,
      canRestore: false,
      canClear: false,
      savedGroup: null,
    });
    roster = group(["C"]);
    generation++;
    render();
    context = { ...context, contextKey: "company-2" };
    render();
    expect(client.fetch).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.resolve).not.toHaveBeenCalled();
  });
  it("loads metadata without changing the current roster", async () => {
    roster = group(["C"]);
    const view = await load(record());
    expect(view).toMatchObject({
      loaded: true,
      savedGroup: group(),
      canSave: true,
      canRestore: true,
      canClear: true,
    });
    expect(roster).toEqual(group(["C"]));
    expect(restore).not.toHaveBeenCalled();
  });
  it("captures the latest ordered roster before render and keeps edits during Save", async () => {
    roster = null;
    const view = await load();
    expect(view.canSave).toBe(false);
    roster = group(["D", "B"]);
    generation++;
    const held = deferred<Record>();
    client.put.mockReturnValue(held.promise);
    view.onSave();
    expect(client.put.mock.calls[0]?.slice(0, 2)).toEqual([
      0,
      {
        operation: "save",
        payload: { schemaVersion: 1, group: group(["D", "B"]) },
        context: context.watchlistBinding,
      },
    ]);
    roster = group(["C"]);
    generation++;
    held.resolve(record(group(["D", "B"]), 1));
    await flush();
    expect(render().savedGroup).toEqual(group(["D", "B"]));
    expect(roster).toEqual(group(["C"]));
    expect(restore).not.toHaveBeenCalled();
  });
  it("rejects Save when the latest roster no longer qualifies", async () => {
    const view = await load();
    roster = null;
    generation++;
    view.onSave();
    expect(client.put).not.toHaveBeenCalled();
  });
  it("restores only after exact version, binding and complete group verification", async () => {
    roster = group(["C"]);
    const view = await load(record());
    view.onRestore();
    await flush();
    expect(restore).toHaveBeenCalledWith(group(), 0);
    expect(roster).toEqual(group());
    expect(render().message).toContain("sources are unloaded");
  });
  it("keeps loaded metadata visible while Restore waits and cancels after edit then undo", async () => {
    const view = await load(record());
    const held = deferred<PersonalSavedManualPeerResolvedDto>();
    client.resolve.mockReturnValue(held.promise);
    view.onRestore();
    expect(render()).toMatchObject({
      busy: true,
      loaded: true,
      savedGroup: group(),
      canRestore: false,
    });
    roster = group(["C"]);
    generation++;
    roster = group();
    generation++;
    held.resolve(resolved());
    await flush();
    expect(restore).not.toHaveBeenCalled();
    expect(render().message).toContain("peers changed");
    expect(render().canRestore).toBe(true);
  });
  it("keeps current peers when the atomic root guard refuses Restore", async () => {
    const view = await load(record());
    restore.mockReturnValue(false);
    view.onRestore();
    await flush();
    expect(render().message).toContain("current group was kept");
  });
  it("clears only the versioned saved slot and can save again", async () => {
    const view = await load(record());
    const before = roster;
    view.onClear();
    await flush();
    expect(client.put.mock.calls[0]?.slice(0, 2)).toEqual([
      5,
      {
        operation: "clear",
        payload: { schemaVersion: 1, group: null },
        context: null,
      },
    ]);
    const cleared = render();
    expect(cleared).toMatchObject({
      loaded: true,
      savedGroup: null,
      canClear: false,
      canSave: true,
    });
    expect(roster).toBe(before);
    expect(restore).not.toHaveBeenCalled();
    cleared.onSave();
    await flush();
    expect(client.put.mock.calls[1]?.[0]).toBe(6);
    expect(render().savedGroup).toEqual(group());
  });
  it("allows orphan metadata to be inspected and cleared without a binding", async () => {
    context = {
      ...context,
      identity: null,
      watchlistBinding: null,
      getSaveGroup: () => null,
    };
    const view = await load(record());
    expect(view).toMatchObject({
      savedGroup: group(),
      canSave: false,
      canRestore: false,
      canClear: true,
    });
    view.onRestore();
    expect(client.resolve).not.toHaveBeenCalled();
    view.onClear();
    await flush();
    expect(render().savedGroup).toBeNull();
  });
  it.each([
    "instrumentType",
    "securityId",
    "shareClassId",
    "shareClassName",
  ] as const)("rejects a primary with changed %s", async (field) => {
    const primary = {
      ...identity("A"),
      [field]: field === "instrumentType" ? "adr" : "replacement",
    } as PersonalSavedManualPeerIdentityDto;
    context = { ...context, identity: primary };
    const view = await load(record());
    expect(view.canRestore).toBe(false);
    view.onRestore();
    view.onSave();
    expect(client.resolve).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });
  it.each([
    "version",
    "watchlist",
    "catalog",
    "primary",
    "peer",
    "order",
    "provenance",
  ])(
    "rejects mismatched Restore %s and requires explicit recovery",
    async (field) => {
      const saved = group(["B", "C"]);
      const response = resolved(saved);
      const changed =
        field === "version"
          ? { ...response, savedPeerGroupVersion: 6 }
          : field === "watchlist"
            ? { ...response, watchlistVersion: 4 }
            : field === "catalog"
              ? {
                  ...response,
                  catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
                }
              : {
                  ...response,
                  group:
                    field === "primary"
                      ? { ...saved, primary: identity("D") }
                      : field === "peer"
                        ? { ...saved, peers: [identity("D"), identity("C")] }
                        : field === "order"
                          ? { ...saved, peers: [...saved.peers].reverse() }
                          : {
                              ...saved,
                              createdAgainstCatalogSnapshotSha256:
                                `sha256:${"b".repeat(64)}` as const,
                            },
                };
      client.resolve.mockResolvedValue(changed);
      const view = await load(record(saved));
      view.onRestore();
      await flush();
      expect(restore).not.toHaveBeenCalled();
      expect(render()).toMatchObject({
        loaded: false,
        savedGroup: null,
        busy: false,
      });
      expect(client.fetch).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["conflict", "invalid_response", "unavailable"] as const)(
    "invalidates metadata after %s without retrying or changing peers",
    async (code) => {
      const view = await load(record());
      const before = roster;
      client.put.mockRejectedValue(new PersonalWorkspaceApiError(code));
      view.onSave();
      await flush();
      const failed = render();
      expect(failed).toMatchObject({
        loaded: false,
        savedGroup: null,
        busy: false,
      });
      failed.onSave();
      failed.onRestore();
      expect(client.put).toHaveBeenCalledTimes(1);
      expect(client.fetch).toHaveBeenCalledTimes(1);
      expect(roster).toBe(before);
    },
  );
  it("retires old callbacks immediately and serializes actions before rerender", async () => {
    const view = await load(record());
    const held = deferred<Record>();
    client.put.mockReturnValue(held.promise);
    view.onSave();
    view.onClear();
    view.onRestore();
    view.onLoad();
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(client.fetch).toHaveBeenCalledTimes(1);
    expect(client.resolve).not.toHaveBeenCalled();
    held.resolve(record(group(), 6));
    await flush();
    view.onSave();
    expect(client.put).toHaveBeenCalledTimes(1);
  });
  it.each(["context", "identity", "binding", "workspace", "enabled"])(
    "aborts pending work on %s change and rejects A-B-A revival",
    async (field) => {
      const view = await load(record());
      const held = deferred<PersonalSavedManualPeerResolvedDto>();
      client.resolve.mockReturnValue(held.promise);
      view.onRestore();
      const prior = context;
      context =
        field === "context"
          ? { ...context, contextKey: "company-2" }
          : field === "identity"
            ? { ...context, identity: identity("D") }
            : field === "binding"
              ? {
                  ...context,
                  watchlistBinding: {
                    catalogSnapshotSha256: digest,
                    watchlistVersion: 4,
                  },
                }
              : field === "workspace"
                ? { ...context, workspaceKey: "workspace-2" }
                : { ...context, enabled: false };
      render();
      context = prior;
      render();
      held.resolve(resolved());
      await flush();
      expect(client.resolve.mock.calls[0]?.[3].aborted).toBe(true);
      expect(restore).not.toHaveBeenCalled();
      expect(render().loaded).toBe(false);
      view.onLoad();
      expect(client.fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("ignores context retirement before a rerender", async () => {
    const view = await load(record());
    const held = deferred<PersonalSavedManualPeerResolvedDto>();
    client.resolve.mockReturnValue(held.promise);
    view.onRestore();
    current = false;
    held.resolve(resolved());
    await flush();
    expect(restore).not.toHaveBeenCalled();
    expect(render().savedGroup).toBeNull();
  });
  it("clears metadata and reports session loss exactly once", async () => {
    const view = await load(record());
    client.put.mockRejectedValue(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    view.onClear();
    await flush();
    expect(unavailable).toHaveBeenCalledTimes(1);
    expect(render().loaded).toBe(false);
    expect(restore).not.toHaveBeenCalled();
  });
  it("retires pending work and retained callbacks on unmount", async () => {
    const view = await load(record());
    const held = deferred<PersonalSavedManualPeerResolvedDto>();
    client.resolve.mockReturnValue(held.promise);
    view.onRestore();
    hooks.unmount();
    held.resolve(resolved());
    await flush();
    view.onLoad();
    expect(client.resolve.mock.calls[0]?.[3].aborted).toBe(true);
    expect(restore).not.toHaveBeenCalled();
    expect(client.fetch).toHaveBeenCalledTimes(1);
  });
  it("recovers from StrictMode replay without reviving pending requests or old actions", async () => {
    const view = await load(record());
    const held = deferred<Record>();
    client.put.mockReturnValue(held.promise);
    view.onSave();
    hooks.replayCommittedEffects();
    const recovered = render();
    expect(recovered).toMatchObject({
      busy: false,
      loaded: false,
      savedGroup: null,
    });
    held.resolve(record(group(), 6));
    await flush();
    view.onLoad();
    expect(client.fetch).toHaveBeenCalledTimes(1);
    expect(render().loaded).toBe(false);
    recovered.onLoad();
    await flush();
    expect(render().loaded).toBe(true);
    expect(client.fetch).toHaveBeenCalledTimes(2);
  });
  it("retains verified idle metadata across replay but rejects callbacks from its former lifetime", async () => {
    const view = await load(record());
    hooks.replayCommittedEffects();
    view.onSave();
    expect(client.put).not.toHaveBeenCalled();
    const recovered = render();
    expect(recovered).toMatchObject({
      loaded: true,
      savedGroup: group(),
      busy: false,
    });
    recovered.onSave();
    await flush();
    expect(client.put).toHaveBeenCalledTimes(1);
  });
});

function render() {
  hooks.beginRender();
  const view = usePersonalSavedManualPeerGroup(context);
  hooks.commit();
  return view;
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function load(value: Record | null = null) {
  client.fetch.mockResolvedValue(value);
  render().onLoad();
  await flush();
  return render();
}
function identity(symbol: string): PersonalSavedManualPeerIdentityDto {
  return {
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: `issuer-${symbol}`,
    issuerName: `Synthetic ${symbol}`,
    listingId: `listing-${symbol}`,
    securityId: `security-${symbol}`,
    securityName: `Security ${symbol}`,
    shareClassId: `class-${symbol}`,
    shareClassName: "Common stock",
    symbol,
  };
}
function group(peers = ["B"]): PersonalSavedManualPeerGroupDto {
  return {
    createdAgainstCatalogSnapshotSha256: digest,
    primary: identity("A"),
    peers: peers.map(identity),
  };
}
function record(
  value: PersonalSavedManualPeerGroupDto | null = group(),
  version = 5,
): Record {
  return { version, payload: { schemaVersion: 1, group: value } };
}
function resolved(value = group()): PersonalSavedManualPeerResolvedDto {
  return {
    schemaVersion: "1.0.0",
    savedPeerGroupVersion: 5,
    watchlistVersion: 3,
    catalogSnapshotSha256: digest,
    group: value,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
