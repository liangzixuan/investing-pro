import {
  normalizePersonalSavedDcfAssumptions,
  PERSONAL_SAVED_DCF_MODEL_VERSION,
  type PersonalSavedDcfAssumptionsDto,
  type PersonalSavedDcfBindingDto,
  type PersonalSavedDcfEntryDto,
  type PersonalSavedDcfIdentityDto,
  type PersonalSavedDcfPayloadDto,
  type PersonalSavedDcfPutRequestDto,
  type PersonalSavedDcfResolvedDto,
} from "@research-cockpit/contracts";
import {
  calculatePersonalFcffDcfValuation,
  PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS,
  PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
  PERSONAL_FCFF_DCF_FORMULA_SET_VERSION,
  PERSONAL_FCFF_DCF_SCHEMA_VERSION,
  type PersonalFcffDcfAssumptions,
  type PersonalFcffDcfInput,
} from "@research-cockpit/personal-market-analytics";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type * as SavedDcfApiModule from "../../lib/personal-saved-dcf-assumptions-api";

import {
  createPersonalFcffDcfAssumptionDraft,
  type PersonalFcffDcfAssumptionDraft,
  type PersonalFcffDcfValuationProps,
} from "./PersonalFcffDcfValuation";
import type { PersonalSavedDcfAssumptionsControlsProps } from "./PersonalSavedDcfAssumptionsControls";
import {
  PersonalSavedFcffDcfValuation,
  type PersonalSavedFcffDcfValuationProps,
} from "./PersonalSavedFcffDcfValuation";

type SavedRecord = Readonly<{
  version: number;
  payload: PersonalSavedDcfPayloadDto;
}>;

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
  fetch: vi.fn<(signal: AbortSignal) => Promise<SavedRecord | null>>(),
  put: vi.fn<
    (
      version: number,
      request: PersonalSavedDcfPutRequestDto,
      signal: AbortSignal,
    ) => Promise<SavedRecord>
  >(),
  resolve:
    vi.fn<
      (
        version: number,
        identity: PersonalSavedDcfIdentityDto,
        binding: PersonalSavedDcfBindingDto,
        signal: AbortSignal,
      ) => Promise<PersonalSavedDcfResolvedDto>
    >(),
}));
const components = vi.hoisted(() => ({
  Dcf: () => null,
  Controls: () => null,
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
vi.mock("@/lib/personal-saved-dcf-assumptions-api", async () => ({
  ...(await vi.importActual<typeof SavedDcfApiModule>(
    "../../lib/personal-saved-dcf-assumptions-api",
  )),
  fetchPersonalSavedDcfAssumptions: client.fetch,
  putPersonalSavedDcfAssumptions: client.put,
  resolvePersonalSavedDcfAssumptions: client.resolve,
}));
vi.mock("./PersonalFcffDcfValuation", async (original) => ({
  ...(await original()),
  PersonalFcffDcfValuation: components.Dcf,
}));
vi.mock("./PersonalSavedDcfAssumptionsControls", () => ({
  PersonalSavedDcfAssumptionsControls: components.Controls,
}));

let current = true;
let props: PersonalSavedFcffDcfValuationProps;
const noProviderFetch = vi.fn();
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
  client.resolve.mockReset().mockResolvedValue(resolved(entry()));
  current = true;
  props = wrapperProps();
  noProviderFetch.mockReset().mockImplementation(() => {
    throw new Error("Unexpected provider or unmocked request");
  });
  vi.stubGlobal("fetch", noProviderFetch);
});
afterEach(() => {
  hooks.unmount();
  expect(noProviderFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("saved DCF assumption controller", () => {
  it("starts without reading, writing, restoring or loading any sources", () => {
    const view = render();
    expect(view.dcf).toMatchObject({
      annualFinancials: null,
      marketOverview: null,
      valuationHistory: null,
      selection: props.selection,
    });
    expect(view.draft).toEqual(
      createPersonalFcffDcfAssumptionDraft(
        PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
      ),
    );
    expect(view.controls.loaded).toBe(false);
    view.controls.onSave();
    view.controls.onRestore();
    view.controls.onClear(identity().listingId);
    expect(client.fetch).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.resolve).not.toHaveBeenCalled();
  });

  it("makes initial Load usable after effect replay without reviving old callbacks or automatic requests", async () => {
    const beforeReplay = render();
    expect(hooks.hasScheduledRender()).toBe(false);
    hooks.replayCommittedEffects();
    expect(hooks.hasScheduledRender()).toBe(true);
    beforeReplay.controls.onLoad();
    expect(client.fetch).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.resolve).not.toHaveBeenCalled();

    const replayed = render();
    expect(replayed.draft).toEqual(beforeReplay.draft);
    expect(replayed.controls).toMatchObject({ loaded: false, busy: false });
    replayed.controls.onLoad();
    expect(client.fetch).toHaveBeenCalledTimes(1);
    await flush();
    expect(render().controls).toMatchObject({ loaded: true, busy: false });
    beforeReplay.controls.onLoad();
    beforeReplay.controls.onSave();
    beforeReplay.controls.onRestore();
    expect(client.fetch).toHaveBeenCalledTimes(1);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.resolve).not.toHaveBeenCalled();
  });

  it("keeps settled metadata and the raw draft across idle effect replay while retiring prior actions", async () => {
    await load(record());
    edit({ waccPercent: "12.3400", forecastYears: "9" });
    const beforeReplay = render();
    hooks.replayCommittedEffects();
    expect(hooks.hasScheduledRender()).toBe(true);
    const replayed = render();
    expect(replayed.draft).toEqual(beforeReplay.draft);
    expect(replayed.controls).toMatchObject({
      loaded: true,
      busy: false,
      entries: beforeReplay.controls.entries,
      count: 1,
      canSave: true,
      canRestore: true,
    });
    beforeReplay.controls.onLoad();
    beforeReplay.controls.onSave();
    beforeReplay.controls.onRestore();
    beforeReplay.controls.onClear(identity().listingId);
    expect(client.fetch).toHaveBeenCalledTimes(1);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.resolve).not.toHaveBeenCalled();
    replayed.controls.onSave();
    await flush();
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(render().draft).toEqual(beforeReplay.draft);
    expect(render().controls.draftIsSaved).toBe(true);
  });

  it.each(["load", "save", "restore", "clear"] as const)(
    "recovers an interrupted %s after effect replay and ignores its late response during a newer Load",
    async (action) => {
      if (action !== "load") await load(record());
      edit({ waccPercent: "13.1250", forecastYears: "9" });
      const pendingRecord = deferred<SavedRecord>();
      const pendingResolve = deferred<PersonalSavedDcfResolvedDto>();
      if (action === "load")
        client.fetch.mockReturnValueOnce(pendingRecord.promise);
      else if (action === "restore")
        client.resolve.mockReturnValueOnce(pendingResolve.promise);
      else client.put.mockReturnValueOnce(pendingRecord.promise);
      const retained = render();
      invoke(retained.controls, action);
      const signal =
        action === "load"
          ? client.fetch.mock.lastCall![0]
          : action === "restore"
            ? client.resolve.mock.lastCall![3]
            : client.put.mock.lastCall![2];
      const busy = render();
      expect(busy.controls.busy).toBe(true);
      const requestsBeforeReplay =
        client.fetch.mock.calls.length +
        client.put.mock.calls.length +
        client.resolve.mock.calls.length;

      hooks.replayCommittedEffects();
      expect(signal.aborted).toBe(true);
      expect(hooks.hasScheduledRender()).toBe(true);
      const replayed = render();
      expect(replayed.controls).toMatchObject({
        loaded: false,
        busy: false,
        canSave: false,
        canRestore: false,
      });
      expect(replayed.draft).toEqual(retained.draft);
      invoke(retained.controls, action);
      busy.controls.onLoad();
      replayed.controls.onSave();
      replayed.controls.onRestore();
      replayed.controls.onClear(identity().listingId);
      expect(
        client.fetch.mock.calls.length +
          client.put.mock.calls.length +
          client.resolve.mock.calls.length,
      ).toBe(requestsBeforeReplay);

      const readsBeforeReload = client.fetch.mock.calls.length;
      const reload = deferred<SavedRecord | null>();
      client.fetch.mockReturnValueOnce(reload.promise);
      replayed.controls.onLoad();
      expect(client.fetch).toHaveBeenCalledTimes(readsBeforeReload + 1);
      const reloadSignal = client.fetch.mock.lastCall![0];
      expect(reloadSignal.aborted).toBe(false);
      const waitingForReload = render();
      expect(waitingForReload.controls.busy).toBe(true);
      pendingRecord.resolve(
        action === "clear"
          ? record([], 2)
          : record([entry(identity("stale"))], 9),
      );
      pendingResolve.resolve(resolved(entry()));
      await flush();
      expect(render().controls).toMatchObject({
        busy: true,
        loaded: false,
        message: waitingForReload.controls.message,
      });
      expect(reloadSignal.aborted).toBe(false);
      expect(render().draft).toEqual(retained.draft);

      reload.resolve(record([entry(identity("fresh"))], 8));
      await flush();
      const settled = render();
      expect(settled.controls).toMatchObject({
        loaded: true,
        busy: false,
        count: 1,
      });
      expect(settled.controls.entries[0]?.listingId).toBe(
        identity("fresh").listingId,
      );
      expect(settled.draft).toEqual(retained.draft);
      expect(client.fetch).toHaveBeenCalledTimes(readsBeforeReload + 1);
      expect(props.savedContext.onSessionUnavailable).not.toHaveBeenCalled();
    },
  );

  it("reads only explicitly and never applies loaded assumptions", async () => {
    client.fetch.mockResolvedValue(
      record([entry(identity(), assumptions({ waccPercent: "12" }))]),
    );
    edit({ waccPercent: "11.2500", forecastYears: "8" });
    const before = render().draft;
    render().controls.onLoad();
    expect(client.fetch).toHaveBeenCalledTimes(1);
    await flush();
    const view = render();
    expect(view.controls.loaded).toBe(true);
    expect(view.controls.count).toBe(1);
    expect(view.controls.canRestore).toBe(true);
    expect(view.draft).toEqual(before);
    expect(client.resolve).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });

  it("saves all seven latest inputs before rerender with no provider sources", async () => {
    const loaded = await load();
    const submitted = draft({
      forecastYears: "10",
      taxShieldRatePercent: "-0",
      waccPercent: "11.25",
      terminalGrowthPercent: "-2",
      scenarios: growth("-50", "0.125", "50"),
    });
    loaded.dcf.assumptionControl!.onChange(() => submitted);
    loaded.controls.onSave();
    await flush();
    expect(client.put).toHaveBeenCalledTimes(1);
    const [version, request] = client.put.mock.calls[0]!;
    expect(version).toBe(0);
    expect(request).toEqual({
      operation: "save",
      listingId: identity().listingId,
      context: binding(),
      payload: {
        schemaVersion: 1,
        entries: [entry(identity(), { ...submitted, forecastYears: 10 })],
      },
    });
    expect(render().draft).toEqual(submitted);
    expect(render().controls.draftIsSaved).toBe(true);
    expect(client.resolve).not.toHaveBeenCalled();
  });

  it("keeps newer raw edits when an earlier save settles", async () => {
    const pending = deferred<SavedRecord>();
    client.put.mockReturnValue(pending.promise);
    await load();
    edit({ waccPercent: "12" });
    render().controls.onSave();
    const submitted = client.put.mock.calls[0]![1].payload;
    edit({ waccPercent: "-", forecastYears: "" });
    pending.resolve({ version: 1, payload: submitted });
    await flush();
    const view = render();
    expect(view.draft.waccPercent).toBe("-");
    expect(view.draft.forecastYears).toBe("");
    expect(view.controls.loaded).toBe(true);
    expect(view.controls.draftIsSaved).toBe(false);
    expect(client.put).toHaveBeenCalledTimes(1);
  });

  it("restores all seven normalized inputs only after the explicit version-bound resolve", async () => {
    const saved = entry(
      identity(),
      assumptions({
        forecastYears: 9,
        taxShieldRatePercent: "15.25",
        waccPercent: "12.125",
        terminalGrowthPercent: "-1",
        scenarios: growth("-10", "2.5", "12"),
      }),
    );
    await load(record([saved], 7));
    client.resolve.mockResolvedValue(resolved(saved, 7));
    edit({ waccPercent: "20", forecastYears: "" });
    render().controls.onRestore();
    expect(client.resolve).toHaveBeenCalledWith(
      7,
      identity(),
      binding(),
      expect.any(AbortSignal),
    );
    await flush();
    expect(render().draft).toEqual(
      createPersonalFcffDcfAssumptionDraft(saved.assumptions),
    );
    expect(render().controls.draftIsSaved).toBe(true);
    expect(client.put).not.toHaveBeenCalled();
  });

  it.each(["edit", "reset", "edit away and back"] as const)(
    "cancels pending restore application after %s",
    async (action) => {
      await load(
        record([entry(identity(), assumptions({ waccPercent: "16" }))]),
      );
      edit({ waccPercent: "14" });
      const pending = deferred<PersonalSavedDcfResolvedDto>();
      client.resolve.mockReturnValue(pending.promise);
      render().controls.onRestore();
      if (action === "reset")
        render().dcf.assumptionControl!.onChange(() => draft());
      else {
        edit({ waccPercent: "15" });
        if (action === "edit away and back") edit({ waccPercent: "14" });
      }
      const changed = render().draft;
      pending.resolve(
        resolved(entry(identity(), assumptions({ waccPercent: "16" }))),
      );
      await flush();
      expect(render().draft).toEqual(changed);
      expect(client.resolve).toHaveBeenCalledTimes(1);
      expect(client.put).not.toHaveBeenCalled();
    },
  );

  it("clears one orphan/unsupported set, preserving another entry and the raw draft", async () => {
    const orphan = { ...entry(identity("orphan")), modelVersion: "2.0.0" };
    const retained = entry();
    await load(record([orphan, retained], 5));
    edit({ waccPercent: "13.3333" });
    const before = render().draft;
    props = {
      ...props,
      savedContext: {
        ...props.savedContext,
        identity: null,
        watchlistBinding: null,
      },
    };
    // The same loaded collection remains clearable without selected-member admission.
    const view = render();
    expect(view.controls.canSave).toBe(false);
    expect(view.controls.canRestore).toBe(false);
    view.controls.onClear(orphan.identity.listingId);
    await flush();
    expect(client.put).toHaveBeenCalledWith(
      5,
      {
        operation: "clear",
        listingId: orphan.identity.listingId,
        context: null,
        payload: { schemaVersion: 1, entries: [retained] },
      },
      expect.any(AbortSignal),
    );
    expect(render().draft).toEqual(before);
  });

  it("keeps Reset separate from durable Clear", async () => {
    const saved = entry(identity(), assumptions({ waccPercent: "15" }));
    await load(record([saved]));
    edit({ waccPercent: "17" });
    render().dcf.assumptionControl!.onChange(() => draft());
    expect(client.put).not.toHaveBeenCalled();
    expect(render().controls.canRestore).toBe(true);
    edit({ waccPercent: "18" });
    render().controls.onClear(identity().listingId);
    await flush();
    expect(render().draft.waccPercent).toBe("18");
    expect(render().controls.count).toBe(0);
  });

  it("does not restore an unsupported model but permits its explicit removal", async () => {
    const unsupported = { ...entry(), modelVersion: "2.0.0" };
    const view = await load(record([unsupported]));
    expect(view.controls.canRestore).toBe(false);
    expect(view.controls.entries[0]?.modelSupported).toBe(false);
    view.controls.onRestore();
    expect(client.resolve).not.toHaveBeenCalled();
    view.controls.onClear(identity().listingId);
    await flush();
    expect(client.put).toHaveBeenCalledTimes(1);
    expect(render().controls.count).toBe(0);
  });

  it("enforces capacity without eviction and permits replacement at capacity", async () => {
    const entries = Array.from({ length: 20 }, (_, i) =>
      entry(identity(`other-${i}`)),
    );
    let view = await load(record(entries));
    expect(view.controls.canSave).toBe(false);
    view.controls.onSave();
    expect(client.put).not.toHaveBeenCalled();
    client.fetch.mockResolvedValue(record([entry(), ...entries.slice(1)], 2));
    view.controls.onLoad();
    await flush();
    view = render();
    expect(view.controls.canSave).toBe(true);
    edit({ waccPercent: "14" });
    render().controls.onSave();
    await flush();
    const saved = client.put.mock.calls[0]![1].payload.entries;
    expect(saved).toHaveLength(20);
    expect(saved.slice(1)).toEqual(entries.slice(1));
    expect(saved[0]?.assumptions.waccPercent).toBe("14.0000");
  });

  it.each([
    "",
    "-",
    "2.",
    "+2",
    "02",
    "1e1",
    " 2",
    "2 ",
    "2.00000",
    "9".repeat(65),
  ])("does not save incomplete or non-model decimal %j", async (value) => {
    await load();
    edit({ waccPercent: value });
    const view = render();
    expect(view.controls.canSave).toBe(false);
    view.controls.onSave();
    expect(client.put).not.toHaveBeenCalled();
    expect(view.draft.waccPercent).toBe(value);
  });

  it.each(["", "05", "5.0", "5e0", " 5", "5 ", "4", "11", "9007199254740993"])(
    "rejects raw horizon %j before numeric materialization",
    async (value) => {
      await load();
      edit({ forecastYears: value });
      const view = render();
      expect(view.controls.canSave).toBe(false);
      view.controls.onSave();
      expect(client.put).not.toHaveBeenCalled();
    },
  );

  it.each(["load", "save", "restore", "clear"] as const)(
    "admits one %s and rejects duplicate, busy and retained callbacks",
    async (action) => {
      if (action !== "load") await load(record());
      const pendingRecord = deferred<SavedRecord>();
      const pendingResolve = deferred<PersonalSavedDcfResolvedDto>();
      client.fetch.mockReturnValue(pendingRecord.promise);
      client.put.mockReturnValue(pendingRecord.promise);
      client.resolve.mockReturnValue(pendingResolve.promise);
      client.fetch.mockClear();
      const retained = render().controls;
      invoke(retained, action);
      invoke(retained, action);
      const busy = render().controls;
      expect(busy.busy).toBe(true);
      busy.onLoad();
      busy.onSave();
      busy.onRestore();
      busy.onClear(identity().listingId);
      expect(
        client.fetch.mock.calls.length +
          client.put.mock.calls.length +
          client.resolve.mock.calls.length,
      ).toBe(1);
      pendingRecord.resolve(action === "clear" ? record([], 2) : record());
      pendingResolve.resolve(resolved(entry()));
      await flush();
      expect(render().controls.busy).toBe(false);
      invoke(retained, action);
      expect(
        client.fetch.mock.calls.length +
          client.put.mock.calls.length +
          client.resolve.mock.calls.length,
      ).toBe(1);
    },
  );

  it("retires stale metadata and callbacks after a note-only watchlist version change without resetting inputs", async () => {
    await load(record());
    edit({ waccPercent: "12.3400" });
    const before = render();
    props = {
      ...props,
      savedContext: {
        ...props.savedContext,
        contextKey: "company-example-watchlist-4",
        watchlistBinding: { ...binding(), watchlistVersion: 4 },
      },
    };
    let view = render();
    expect(view.draft).toEqual(before.draft);
    expect(view.controls.loaded).toBe(false);
    before.controls.onLoad();
    before.controls.onSave();
    before.controls.onRestore();
    before.controls.onClear(identity().listingId);
    before.dcf.assumptionControl!.onChange(() => draft({ waccPercent: "29" }));
    expect(client.fetch).toHaveBeenCalledTimes(1);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.resolve).not.toHaveBeenCalled();
    expect(render().draft).toEqual(before.draft);
    view = await load(record());
    view.controls.onSave();
    await flush();
    expect(client.put.mock.calls[0]?.[1].context).toEqual({
      ...binding(),
      watchlistVersion: 4,
    });
  });

  it.each(["load", "save", "restore", "clear"] as const)(
    "ignores late %s settlement after a catalog/context change and a newer load",
    async (action) => {
      if (action !== "load") await load(record());
      edit({ waccPercent: "13.125" });
      const pendingRecord = deferred<SavedRecord>();
      const pendingResolve = deferred<PersonalSavedDcfResolvedDto>();
      client.fetch.mockReturnValue(pendingRecord.promise);
      client.put.mockReturnValue(pendingRecord.promise);
      client.resolve.mockReturnValue(pendingResolve.promise);
      invoke(render().controls, action);
      const signal =
        action === "load"
          ? client.fetch.mock.lastCall![0]
          : action === "restore"
            ? client.resolve.mock.lastCall![3]
            : client.put.mock.lastCall![2];
      props = {
        ...props,
        savedContext: {
          ...props.savedContext,
          contextKey: "new-catalog",
          watchlistBinding: {
            ...binding(),
            catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
          },
        },
      };
      expect(render().controls.loaded).toBe(false);
      expect(signal.aborted).toBe(true);
      await load(record([entry(identity("new"))], 8));
      const afterNewLoad = render();
      pendingRecord.resolve(record([entry(identity("stale"))], 6));
      pendingResolve.resolve(
        resolved(entry(identity(), assumptions({ waccPercent: "25" }))),
      );
      await flush();
      expect(render().controls).toMatchObject({
        message: afterNewLoad.controls.message,
        entries: afterNewLoad.controls.entries,
        count: 1,
        loaded: true,
        busy: false,
      });
      expect(render().draft.waccPercent).toBe("13.125");
    },
  );

  it.each(["load", "save", "restore", "clear"] as const)(
    "aborts %s on company disposal and cannot revive A after A→B→A",
    async (action) => {
      if (action !== "load") await load(record());
      const pendingRecord = deferred<SavedRecord>();
      const pendingResolve = deferred<PersonalSavedDcfResolvedDto>();
      client.fetch.mockReturnValue(pendingRecord.promise);
      client.put.mockReturnValue(pendingRecord.promise);
      client.resolve.mockReturnValue(pendingResolve.promise);
      const retained = render();
      invoke(retained.controls, action);
      const signal =
        action === "load"
          ? client.fetch.mock.lastCall![0]
          : action === "restore"
            ? client.resolve.mock.lastCall![3]
            : client.put.mock.lastCall![2];
      hooks.unmount();
      expect(signal.aborted).toBe(true);
      hooks.reset();
      props = {
        ...wrapperProps(),
        selection: identity("beta"),
        savedContext: {
          ...wrapperProps().savedContext,
          contextKey: "company-beta",
          identity: identity("beta"),
        },
      };
      expect(render().draft).toEqual(draft());
      hooks.unmount();
      hooks.reset();
      props = wrapperProps();
      const returned = render();
      pendingRecord.resolve(
        record([entry(identity(), assumptions({ waccPercent: "25" }))], 9),
      );
      pendingResolve.resolve(
        resolved(entry(identity(), assumptions({ waccPercent: "25" }))),
      );
      await flush();
      const callCount =
        client.fetch.mock.calls.length +
        client.put.mock.calls.length +
        client.resolve.mock.calls.length;
      invoke(retained.controls, action);
      retained.dcf.assumptionControl!.onChange(() =>
        draft({ waccPercent: "29" }),
      );
      expect(render().draft).toEqual(returned.draft);
      expect(render().controls.loaded).toBe(false);
      expect(
        client.fetch.mock.calls.length +
          client.put.mock.calls.length +
          client.resolve.mock.calls.length,
      ).toBe(callCount);
    },
  );

  it("does not admit callbacks when the root lifetime is stale before another render", async () => {
    const view = await load(record());
    current = false;
    view.controls.onLoad();
    view.controls.onSave();
    view.controls.onRestore();
    view.controls.onClear(identity().listingId);
    view.dcf.assumptionControl!.onChange(() => draft({ waccPercent: "24" }));
    expect(client.fetch).toHaveBeenCalledTimes(1);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.resolve).not.toHaveBeenCalled();
    expect(render().draft).toEqual(view.draft);
  });

  it.each(["conflict", "unavailable", "invalid_response"] as const)(
    "preserves draft after save %s and requires explicit reload before any retry",
    async (code) => {
      await load(record());
      edit({ waccPercent: "17.75" });
      const retained = render().controls;
      client.put.mockRejectedValue(new PersonalWorkspaceApiError(code));
      retained.onSave();
      await flush();
      const failed = render();
      expect(failed.controls.loaded).toBe(false);
      expect(failed.controls.message).toMatch(/reload/i);
      expect(failed.draft.waccPercent).toBe("17.75");
      expect(client.fetch).toHaveBeenCalledTimes(1);
      retained.onSave();
      failed.controls.onSave();
      failed.controls.onRestore();
      failed.controls.onClear(identity().listingId);
      expect(client.put).toHaveBeenCalledTimes(1);
      expect(client.resolve).not.toHaveBeenCalled();
      client.fetch.mockRejectedValue(
        new PersonalWorkspaceApiError("unavailable"),
      );
      failed.controls.onLoad();
      await flush();
      expect(render().controls.loaded).toBe(false);
      expect(render().draft.waccPercent).toBe("17.75");
      client.fetch.mockResolvedValue(record([], 4));
      render().controls.onLoad();
      await flush();
      expect(render().controls.loaded).toBe(true);
      expect(render().draft.waccPercent).toBe("17.75");
      expect(client.put).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a resolved entry that differs from the exact loaded seven-input set", async () => {
    await load(record());
    edit({ waccPercent: "19" });
    client.resolve.mockResolvedValue(
      resolved(entry(identity(), assumptions({ waccPercent: "20" }))),
    );
    render().controls.onRestore();
    await flush();
    expect(render().draft.waccPercent).toBe("19");
    expect(render().controls.loaded).toBe(false);
    expect(render().controls.message).toMatch(/reload/i);
  });

  it("reports session loss once to the owner and cannot apply a stale session error after remount", async () => {
    await load(record());
    client.put.mockRejectedValue(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    render().controls.onSave();
    await flush();
    expect(props.savedContext.onSessionUnavailable).toHaveBeenCalledTimes(1);
    expect(render().controls.loaded).toBe(false);
    const pending = deferred<SavedRecord | null>();
    client.fetch.mockReturnValue(pending.promise);
    render().controls.onLoad();
    hooks.unmount();
    hooks.reset();
    props = {
      ...wrapperProps(),
      savedContext: {
        ...wrapperProps().savedContext,
        workspaceKey: "new-session",
      },
    };
    render();
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(props.savedContext.onSessionUnavailable).not.toHaveBeenCalled();
    expect(render().controls.loaded).toBe(false);
  });

  it.each([
    ["exchangeMic", "XNAS"],
    ["instrumentType", "adr"],
    ["issuerId", "issuer-other"],
    ["issuerName", "Other issuer"],
    ["listingId", "lst-other"],
    ["securityId", "security-other"],
    ["securityName", "Other common stock"],
    ["shareClassId", "class-other"],
    ["shareClassName", "Other class"],
    ["symbol", "OTH"],
  ] as const)(
    "never restores a saved identity with a different %s",
    async (field, value) => {
      const different = { ...identity(), [field]: value };
      const view = await load(record([entry(different)]));
      expect(view.controls.canRestore).toBe(false);
      view.controls.onRestore();
      expect(client.resolve).not.toHaveBeenCalled();
      expect(view.controls.entries[0]?.isCurrentCompany).toBe(false);
      if (field !== "listingId") {
        expect(view.controls.canSave).toBe(false);
        view.controls.onSave();
        expect(client.put).not.toHaveBeenCalled();
      }
    },
  );
});

describe("saved assumption parity with the unchanged DCF engine", () => {
  it("pins the supported model version and independently checked model limits", () => {
    expect(PERSONAL_SAVED_DCF_MODEL_VERSION).toBe(
      PERSONAL_FCFF_DCF_FORMULA_SET_VERSION,
    );
    expect(PERSONAL_FCFF_DCF_SCHEMA_VERSION).toBe("1.0.0");
    expect(PERSONAL_FCFF_DCF_ASSUMPTION_BOUNDS).toEqual({
      annualFcfProxyGrowthPercent: { minimum: "-50", maximum: "50" },
      forecastYears: { minimum: 5, maximum: 10 },
      taxShieldRatePercent: { minimum: "0", maximum: "50" },
      terminalGrowthPercent: { minimum: "-2", maximum: "5" },
      waccPercent: { minimum: "1", maximum: "30" },
    });
  });

  it.each([
    ["illustrative inputs", assumptions()],
    [
      "negative zeros and tied growth",
      assumptions({
        taxShieldRatePercent: "-0.0000",
        terminalGrowthPercent: "-0",
        scenarios: growth("-0", "0.0", "0.0000"),
      }),
    ],
    [
      "minimum horizon and rates",
      assumptions({
        forecastYears: 5,
        taxShieldRatePercent: "0",
        terminalGrowthPercent: "-2",
        waccPercent: "1",
        scenarios: growth("-50", "-50", "-50"),
      }),
    ],
    [
      "maximum horizon and rates",
      assumptions({
        forecastYears: 10,
        taxShieldRatePercent: "50",
        terminalGrowthPercent: "5",
        waccPercent: "30",
        scenarios: growth("50", "50", "50"),
      }),
    ],
    [
      "smallest supported positive discount spread",
      assumptions({
        waccPercent: "5.0001",
        terminalGrowthPercent: "5",
        scenarios: growth("-0.0001", "0", "0.0001"),
      }),
    ],
    [
      "four-place signed values",
      assumptions({
        forecastYears: 7,
        taxShieldRatePercent: "21.1234",
        waccPercent: "12.4321",
        terminalGrowthPercent: "-1.4321",
        scenarios: growth("-12.4321", "3.5678", "12.1234"),
      }),
    ],
  ] as const)(
    "preserves every computed section after canonical roundtrip: %s",
    (_label, raw) => {
      const canonical = normalizePersonalSavedDcfAssumptions(raw);
      expect(canonical).not.toBeNull();
      const before = calculatePersonalFcffDcfValuation(completeInput(raw));
      const after = calculatePersonalFcffDcfValuation(
        completeInput(canonical!),
      );
      expect(before.status).toBe("available");
      expect(after.status).toBe("available");
      if (before.status !== "available" || after.status !== "available")
        throw new Error("Expected complete synthetic model results");
      expect(after.assumptions).toEqual(canonical);
      expect({ ...after, assumptions: before.assumptions }).toEqual(before);
      expect(normalizePersonalSavedDcfAssumptions(canonical)).toEqual(
        canonical,
      );
      expect(Object.isFrozen(canonical?.scenarios.base)).toBe(true);
    },
  );

  it.each([
    ["tax_shield_rate_out_of_bounds", { taxShieldRatePercent: "-0.0001" }],
    ["tax_shield_rate_out_of_bounds", { taxShieldRatePercent: "50.0001" }],
    ["wacc_out_of_bounds", { waccPercent: "0.9999" }],
    ["wacc_out_of_bounds", { waccPercent: "30.0001" }],
    ["terminal_growth_out_of_bounds", { terminalGrowthPercent: "-2.0001" }],
    ["terminal_growth_out_of_bounds", { terminalGrowthPercent: "5.0001" }],
    ["forecast_years_out_of_bounds", { forecastYears: 4 }],
    ["forecast_years_out_of_bounds", { forecastYears: 11 }],
    [
      "scenario_growth_out_of_bounds",
      { scenarios: growth("-50.0001", "0", "50") },
    ],
    [
      "scenario_growth_out_of_bounds",
      { scenarios: growth("-50", "0", "50.0001") },
    ],
    ["scenario_growth_not_ordered", { scenarios: growth("1", "0", "2") }],
    ["scenario_growth_not_ordered", { scenarios: growth("0", "2", "1") }],
    [
      "discount_rate_not_above_terminal_growth",
      { waccPercent: "5", terminalGrowthPercent: "5" },
    ],
  ] as const)(
    "rejects current inputs independently while preserving engine reason %s",
    (reason, patch) => {
      const input = assumptions(patch);
      expect(normalizePersonalSavedDcfAssumptions(input)).toBeNull();
      expect(
        calculatePersonalFcffDcfValuation(completeInput(input)),
      ).toMatchObject({ status: "unavailable", reason });
      expect(
        calculatePersonalFcffDcfValuation({
          assumptions: input,
          selection: null,
          market: null,
          valuation: null,
          annuals: null,
        }),
      ).toMatchObject({ reason: "selection_not_loaded" });
    },
  );
});

function render() {
  hooks.beginRender();
  const tree = PersonalSavedFcffDcfValuation(props);
  hooks.commit();
  const dcf = find<PersonalFcffDcfValuationProps>(tree, components.Dcf);
  if (dcf === undefined || dcf.props.assumptionControl === undefined)
    throw new Error("Expected controlled real DCF seam");
  const controls = find<PersonalSavedDcfAssumptionsControlsProps>(
    dcf.props.savedAssumptionsControls,
    components.Controls,
  );
  if (controls === undefined)
    throw new Error("Expected saved assumption controls");
  return {
    dcf: dcf.props,
    controls: controls.props,
    draft: dcf.props.assumptionControl.value,
  };
}
function find<P>(
  node: unknown,
  type: unknown,
): React.ReactElement<P> | undefined {
  if (Array.isArray(node))
    return node
      .map((child) => find<P>(child, type))
      .find((child) => child !== undefined);
  if (!React.isValidElement<{ children?: React.ReactNode }>(node))
    return undefined;
  if (node.type === type) return node as React.ReactElement<P>;
  return find<P>(node.props.children, type);
}
function edit(patch: Partial<PersonalFcffDcfAssumptionDraft>) {
  render().dcf.assumptionControl!.onChange((value) => ({ ...value, ...patch }));
}
function invoke(
  controls: PersonalSavedDcfAssumptionsControlsProps,
  action: "load" | "save" | "restore" | "clear",
) {
  if (action === "load") controls.onLoad();
  else if (action === "save") controls.onSave();
  else if (action === "restore") controls.onRestore();
  else controls.onClear(identity().listingId);
}
async function load(value: SavedRecord | null = null) {
  client.fetch.mockResolvedValue(value);
  render().controls.onLoad();
  await flush();
  return render();
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
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
function identity(suffix = "example"): PersonalSavedDcfIdentityDto {
  return {
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: `issuer-${suffix}`,
    issuerName: `Synthetic ${suffix}`,
    listingId: `lst-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: `Synthetic ${suffix} common stock`,
    shareClassId: `class-${suffix}`,
    shareClassName: "Common stock",
    symbol:
      suffix === "example"
        ? "EXM"
        : `S${suffix.replaceAll("-", "").toUpperCase()}`,
  };
}
function binding(): PersonalSavedDcfBindingDto {
  return {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    watchlistVersion: 3,
  };
}
function wrapperProps(): PersonalSavedFcffDcfValuationProps {
  return {
    annualFinancials: null,
    marketOverview: null,
    selection: identity(),
    valuationHistory: null,
    savedContext: {
      workspaceKey: "session-1",
      contextKey: "company-example-watchlist-3",
      enabled: true,
      identity: identity(),
      watchlistBinding: binding(),
      isCurrent: () => current,
      onSessionUnavailable: vi.fn(),
    },
  };
}
function growth(conservative: string, base: string, expansion: string) {
  return {
    conservative: { annualFcfProxyGrowthPercent: conservative },
    base: { annualFcfProxyGrowthPercent: base },
    expansion: { annualFcfProxyGrowthPercent: expansion },
  };
}
function assumptions(
  patch: Partial<PersonalFcffDcfAssumptions> = {},
): PersonalFcffDcfAssumptions {
  return {
    ...structuredClone(PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS),
    ...patch,
  };
}
function draft(
  patch: Partial<PersonalFcffDcfAssumptionDraft> = {},
): PersonalFcffDcfAssumptionDraft {
  return {
    ...createPersonalFcffDcfAssumptionDraft(
      PERSONAL_FCFF_DCF_DEFAULT_ASSUMPTIONS,
    ),
    ...patch,
  };
}
function entry(
  company = identity(),
  values: PersonalSavedDcfAssumptionsDto = assumptions(),
): PersonalSavedDcfEntryDto {
  const canonical = normalizePersonalSavedDcfAssumptions(values);
  if (canonical === null) throw new Error("Invalid test assumptions");
  return {
    identity: company,
    createdAgainstCatalogSnapshotSha256: binding().catalogSnapshotSha256,
    modelVersion: "1.0.0",
    assumptions: canonical,
  };
}
function record(
  entries: readonly PersonalSavedDcfEntryDto[] = [entry()],
  version = 1,
): SavedRecord {
  return { version, payload: { schemaVersion: 1, entries } };
}
function resolved(
  value: PersonalSavedDcfEntryDto,
  version = 1,
): PersonalSavedDcfResolvedDto {
  return {
    schemaVersion: "1.0.0",
    ...binding(),
    savedAssumptionsVersion: version,
    entry: value,
  };
}
function completeInput(
  values: PersonalFcffDcfAssumptions,
): PersonalFcffDcfInput {
  const company = identity();
  const security = {
    country: company.country,
    exchangeMic: company.exchangeMic,
    issuerName: company.issuerName,
    listingId: company.listingId,
    securityName: company.securityName,
    symbol: company.symbol,
  };
  return {
    assumptions: values,
    selection: security,
    market: {
      priceCurrency: "USD",
      range: "1y",
      security,
      bars: [{ date: "2025-12-31", raw: { close: "90" } }],
    },
    valuation: {
      asOf: "2026-01-02T00:00:00.000Z",
      range: "1y",
      security,
      points: [
        {
          date: "2025-12-31",
          marketCapitalization: { status: "known", unit: "USD", value: "900" },
          enterpriseValue: { status: "known", unit: "USD", value: "1000" },
        },
      ],
    },
    annuals: {
      asOf: "2026-01-02T00:00:00.000Z",
      security,
      valueCurrency: "USD",
      years: [
        {
          fiscalYear: 2025,
          statementDate: "2025-12-31",
          reported: {
            free_cash_flow: { status: "known", value: "100" },
            interest_expense: { status: "known", value: "10" },
          },
        },
      ],
    },
  };
}
