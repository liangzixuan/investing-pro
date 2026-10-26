import { describe, expect, it, vi } from "vitest";
import {
  parseManagedEconomicCalendar,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedSourceReadResult } from "./managed-source-read-result";
import type { ManagedApi } from "./managed-api";
import { ManagedBeaReleaseAgenda } from "./managed-bea-release-agenda";
import { economicCalendarFixture } from "./economic-calendar-fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const agenda = parseManagedEconomicCalendar(economicCalendarFixture())!;
  const read = vi
    .fn<ManagedApi["economicCalendar"]>()
    .mockResolvedValue(agenda);
  const retire = vi.fn();
  return {
    model: new ManagedBeaReleaseAgenda(read, retire),
    read,
    retire,
    agenda,
  };
}

describe("managed BEA agenda lifetime", () => {
  it("loads only explicitly, deduplicates pending clicks and preserves a verified empty window", async () => {
    const { model, read } = fixture();
    model.leave();
    await model.load();
    model.enter();
    expect(read).not.toHaveBeenCalled();
    const held = deferred<PersonalEconomicCalendarDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    await model.load();
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot()).toMatchObject({ busy: true, agenda: null });
    expect(model.getSnapshot().refreshComparison).toBeNull();
    const empty = { ...economicCalendarFixture(), events: [] };
    held.resolve(empty);
    await pending;
    expect(model.getSnapshot()).toMatchObject({
      busy: false,
      agenda: empty,
      error: null,
    });
    model.leave();
    model.enter();
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot().agenda).toBe(empty);
  });

  it.each(["unavailable", "invalid_response"] as const)(
    "keeps the exact validated previous packet after %s and replaces it only after a successful refresh",
    async (code) => {
      const { model, read, agenda } = fixture();
      await model.load();
      read.mockRejectedValueOnce(new TrialApiError(code));
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        busy: false,
        showingPrevious: true,
        error: code,
      });
      expect(model.getSnapshot().agenda).toBe(agenda);
      expect(model.getSnapshot().agenda?.fetchedAt).toBe(
        "2026-10-20T18:00:00.000Z",
      );
      expect(model.getSnapshot().refreshComparison).toBeNull();
      const next = { ...agenda, events: [] };
      read.mockResolvedValueOnce(next);
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        agenda: next,
        showingPrevious: false,
        error: null,
      });
      expect(read).toHaveBeenCalledTimes(3);
      expect(model.getSnapshot().refreshComparison).toMatchObject({
        previous: agenda,
        current: next,
        addedEvents: [],
      });
    },
  );

  it.each(["cancel", "leave"] as const)(
    "%s retains accepted data and fences a late authentication failure while a new read completes",
    async (boundary) => {
      const { model, read, retire, agenda } = fixture();
      await model.load();
      const old = deferred<PersonalEconomicCalendarDto>();
      const next = deferred<PersonalEconomicCalendarDto>();
      read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
      const pendingOld = model.load();
      expect(model.getSnapshot()).toMatchObject({
        busy: true,
        showingPrevious: true,
        agenda,
      });
      model[boundary]();
      expect(read.mock.calls[1]![0].aborted).toBe(true);
      expect(model.getSnapshot()).toMatchObject({
        busy: false,
        showingPrevious: true,
        agenda,
      });
      if (boundary === "leave") {
        await model.load();
        expect(read).toHaveBeenCalledTimes(2);
        model.enter();
      }
      const pendingNext = model.load();
      old.reject(new TrialApiError("unauthenticated"));
      await pendingOld;
      expect(model.getSnapshot().busy).toBe(true);
      expect(retire).not.toHaveBeenCalled();
      const replacement = { ...agenda, events: [] };
      next.resolve(replacement);
      await pendingNext;
      expect(model.getSnapshot()).toMatchObject({
        busy: false,
        agenda: replacement,
      });
    },
  );

  it("retirement clears retained data and fences a late successful refresh and old load action", async () => {
    const { model, read } = fixture();
    await model.load();
    const held = deferred<PersonalEconomicCalendarDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    model.retire();
    const retired = model.getSnapshot();
    expect(retired).toMatchObject({
      agenda: null,
      busy: false,
      error: null,
      showingPrevious: false,
      refreshComparison: null,
    });
    expect(read.mock.calls[1]![0].aborted).toBe(true);
    held.resolve(economicCalendarFixture());
    await pending;
    model.enter();
    await model.load();
    expect(model.getSnapshot()).toBe(retired);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "clears the agenda and calls shared retirement on current %s",
    async (code) => {
      const { model, read, retire } = fixture();
      await model.load();
      const error = new TrialApiError(code);
      read.mockRejectedValueOnce(error);
      expect(await model.load()).toBe("retired");
      expect(retire).toHaveBeenCalledExactlyOnceWith(error);
      expect(model.getSnapshot()).toMatchObject({ agenda: null, busy: false });
      expect(model.getSnapshot().refreshComparison).toBeNull();
      await model.load();
      expect(read).toHaveBeenCalledTimes(2);
    },
  );

  it("retains the exact last accepted comparison through held, rejected and cancelled attempts, then compares only accepted responses", async () => {
    const { model, read, agenda } = fixture();
    await model.load();
    const replacement = parseManagedEconomicCalendar({
      ...economicCalendarFixture(),
      events: [agenda.events[0]!],
    })!;
    read.mockResolvedValueOnce(replacement);
    await model.load();
    const pair = model.getSnapshot().refreshComparison!;
    expect(pair.previous).toBe(agenda);
    expect(pair.current).toBe(replacement);
    for (const error of [
      new TrialApiError("unavailable"),
      new TrialApiError("invalid_response"),
    ]) {
      read.mockRejectedValueOnce(error);
      await model.load();
      expect(model.getSnapshot().refreshComparison).toBe(pair);
    }
    const held = deferred<PersonalEconomicCalendarDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    expect(model.getSnapshot().refreshComparison).toBe(pair);
    model.cancel();
    held.resolve(agenda);
    await pending;
    expect(model.getSnapshot().refreshComparison).toBe(pair);
    model.leave();
    model.enter();
    expect(model.getSnapshot().refreshComparison).toBe(pair);
    read.mockResolvedValueOnce(agenda);
    await model.load();
    expect(model.getSnapshot().refreshComparison!.previous).toBe(replacement);
    expect(model.getSnapshot().refreshComparison!.current).toBe(agenda);
    expect(model.getSnapshot().refreshComparison!.addedEvents).toEqual([
      agenda.events[1],
    ]);
    expect(read).toHaveBeenCalledTimes(6);
    model.retire();
    expect(model.getSnapshot().refreshComparison).toBeNull();
  });
});

it("returns an accepted empty replacement but fails retained invalid and unavailable refreshes", async () => {
  const { model, read, agenda: original } = fixture();
  expect(await model.load()).toBe("accepted");
  const empty = { ...original, events: [] };
  read.mockResolvedValueOnce(empty);
  expect(await model.load()).toBe("accepted");
  expect(model.getSnapshot().agenda).toBe(empty);
  for (const error of [
    new TrialApiError("invalid_response"),
    new Error("offline"),
  ]) {
    read.mockRejectedValueOnce(error);
    expect(await model.load()).toBe("failed");
    expect(model.getSnapshot().agenda).toBe(empty);
    expect(model.getSnapshot().showingPrevious).toBe(true);
  }
});

it("reports busy and inactive refusal without letting a cancelled old read settle a new operation", async () => {
  const { model, read, agenda: original } = fixture();
  expect(await model.load()).toBe("accepted");
  const old = deferred<PersonalEconomicCalendarDto>();
  const next = deferred<PersonalEconomicCalendarDto>();
  read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const oldRun = model.load();
  expect(await model.load()).toBe("not_started");
  model.cancel();
  const nextRun = model.load();
  old.resolve({ ...original, events: [] });
  expect(await oldRun).toBe("cancelled");
  expect(model.getSnapshot()).toMatchObject({ busy: true, agenda: original });
  const replacement = { ...original, events: [] };
  next.resolve(replacement);
  expect(await nextRun).toBe("accepted");
  expect(model.getSnapshot().agenda).toBe(replacement);
  model.leave();
  expect(await model.load()).toBe("not_started");
  model.enter();
  const late = deferred<PersonalEconomicCalendarDto>();
  read.mockReturnValueOnce(late.promise);
  const lateRun = model.load();
  model.retire();
  late.resolve(original);
  expect(await lateRun).toBe("retired");
  expect(await model.load()).toBe("retired");
  expect(model.getSnapshot()).toMatchObject({ busy: false, agenda: null });
  expect(read).toHaveBeenCalledTimes(4);
});

it.each(["cancel", "leave", "retire"] as const)(
  "returns the %s outcome when a busy listener interrupts before dispatch",
  async (boundary) => {
    const { model, read } = fixture();
    model.subscribe(() => {
      if (model.getSnapshot().busy) model[boundary]();
    });
    expect(await model.load()).toBe(
      boundary === "retire" ? "retired" : "cancelled",
    );
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().busy).toBe(false);
  },
);

it.each(["cancel", "leave", "retire"] as const)(
  "does not report accepted after a response listener requests %s",
  async (boundary) => {
    const { model, read, agenda: original } = fixture();
    expect(await model.load()).toBe("accepted");
    const replacement = { ...original, events: [] };
    let interrupted = false;
    model.subscribe(() => {
      if (!interrupted && model.getSnapshot().agenda === replacement) {
        interrupted = true;
        model[boundary]();
      }
    });
    read.mockResolvedValueOnce(replacement);
    expect(await model.load()).toBe(
      boundary === "retire" ? "retired" : "cancelled",
    );
    expect(interrupted).toBe(true);
    expect(model.getSnapshot().agenda).toBe(
      boundary === "retire" ? null : replacement,
    );
    expect(model.getSnapshot().busy).toBe(false);
  },
);

it("reports retirement from the final busy notification without restoring accepted state", async () => {
  const { model, read, agenda: original } = fixture();
  const replacement = { ...original, events: [] };
  model.subscribe(() => {
    const state = model.getSnapshot();
    if (!state.busy && state.agenda === replacement) model.retire();
  });
  read.mockResolvedValueOnce(replacement);
  expect(await model.load()).toBe("retired");
  expect(model.getSnapshot().agenda).toBeNull();
});

it("preserves a new read started by a cancellation listener when the old read settles", async () => {
  const { model, read, agenda: original } = fixture();
  expect(await model.load()).toBe("accepted");
  const old = deferred<PersonalEconomicCalendarDto>();
  const next = deferred<PersonalEconomicCalendarDto>();
  read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const oldRun = model.load();
  let nextRun = Promise.resolve<ManagedSourceReadResult>("not_started");
  let started = false;
  model.subscribe(() => {
    if (!started && !model.getSnapshot().busy) {
      started = true;
      nextRun = model.load();
    }
  });
  model.cancel();
  expect(started).toBe(true);
  old.resolve({ ...original, events: [] });
  expect(await oldRun).toBe("cancelled");
  expect(model.getSnapshot()).toMatchObject({ busy: true, agenda: original });
  const replacement = { ...original, events: [] };
  next.resolve(replacement);
  expect(await nextRun).toBe("accepted");
  expect(model.getSnapshot()).toMatchObject({
    busy: false,
    agenda: replacement,
  });
  expect(read).toHaveBeenCalledTimes(3);
});
