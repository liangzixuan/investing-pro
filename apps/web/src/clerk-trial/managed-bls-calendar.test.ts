import { expect, it, vi } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
} from "@research-cockpit/contracts";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { ManagedBlsCalendar } from "./managed-bls-calendar";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import type { ManagedSourceReadResult } from "./managed-source-read-result";
const packet = () =>
  parseManagedBlsCalendar({
    ...economicCalendarFixture(),
    source: MANAGED_BLS_CALENDAR_SOURCE,
  })!;
function held<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { resolve, reject, promise };
}
it("makes explicit single reads, retains original accepted data on failed refresh/Cancel/leave, and fences late results", async () => {
  const read = vi.fn<ManagedApi["blsCalendar"]>().mockResolvedValue(packet());
  const error = vi.fn();
  const model = new ManagedBlsCalendar(read, error);
  model.enter();
  expect(read).not.toHaveBeenCalled();
  await model.load();
  const first = model.getSnapshot().calendar;
  read.mockRejectedValueOnce(new TrialApiError("invalid_response"));
  await model.load();
  expect(model.getSnapshot()).toMatchObject({
    calendar: first,
    showingPrevious: true,
    error: "invalid_response",
  });
  const pending = held<ReturnType<typeof packet>>();
  read.mockReturnValueOnce(pending.promise);
  const loading = model.load();
  await model.load();
  expect(read).toHaveBeenCalledTimes(3);
  model.leave();
  expect(read.mock.calls[2]![0].aborted).toBe(true);
  pending.resolve({ ...packet(), events: [] });
  await loading;
  expect(model.getSnapshot()).toMatchObject({
    calendar: first,
    busy: false,
    showingPrevious: true,
  });
  await model.load();
  model.enter();
  expect(read).toHaveBeenCalledTimes(3);
  await model.load();
  expect(model.getSnapshot().showingPrevious).toBe(false);
  expect(error).not.toHaveBeenCalled();
  model.retire();
  expect(model.getSnapshot().calendar).toBeNull();
});
it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
  "retires on current %s and never publishes late work",
  async (code) => {
    const read = vi
      .fn<ManagedApi["blsCalendar"]>()
      .mockResolvedValueOnce(packet())
      .mockRejectedValueOnce(new TrialApiError(code));
    const report = vi.fn();
    const model = new ManagedBlsCalendar(read, report);
    await model.load();
    expect(await model.load()).toBe("retired");
    expect(report).toHaveBeenCalledOnce();
    expect(model.getSnapshot().calendar).toBeNull();
    model.enter();
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
  },
);
it("ignores old session failure after cancellation and clears active reads on retirement", async () => {
  const old = held<ReturnType<typeof packet>>();
  const read = vi
    .fn<ManagedApi["blsCalendar"]>()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue(packet());
  const report = vi.fn();
  const model = new ManagedBlsCalendar(read, report);
  const loading = model.load();
  model.cancel();
  await model.load();
  old.reject(new TrialApiError("unauthenticated"));
  await loading;
  expect(report).not.toHaveBeenCalled();
  expect(model.getSnapshot().calendar).not.toBeNull();
  const late = held<ReturnType<typeof packet>>();
  read.mockReturnValueOnce(late.promise);
  const refresh = model.load();
  model.retire();
  late.resolve(packet());
  await refresh;
  expect(model.getSnapshot()).toMatchObject({ calendar: null, busy: false });
});

function resultFixture() {
  const calendar = packet();
  const read = vi.fn<ManagedApi["blsCalendar"]>().mockResolvedValue(calendar);
  return { model: new ManagedBlsCalendar(read, vi.fn()), read, calendar };
}

it("returns an accepted empty replacement but fails retained invalid and unavailable refreshes", async () => {
  const { model, read, calendar: original } = resultFixture();
  expect(await model.load()).toBe("accepted");
  const empty = { ...original, events: [] };
  read.mockResolvedValueOnce(empty);
  expect(await model.load()).toBe("accepted");
  expect(model.getSnapshot().calendar).toBe(empty);
  for (const error of [
    new TrialApiError("invalid_response"),
    new Error("offline"),
  ]) {
    read.mockRejectedValueOnce(error);
    expect(await model.load()).toBe("failed");
    expect(model.getSnapshot().calendar).toBe(empty);
    expect(model.getSnapshot().showingPrevious).toBe(true);
  }
});

it("reports busy and inactive refusal without letting a cancelled old read settle a new operation", async () => {
  const { model, read, calendar: original } = resultFixture();
  expect(await model.load()).toBe("accepted");
  const old = held<ReturnType<typeof packet>>();
  const next = held<ReturnType<typeof packet>>();
  read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const oldRun = model.load();
  expect(await model.load()).toBe("not_started");
  model.cancel();
  const nextRun = model.load();
  old.resolve({ ...original, events: [] });
  expect(await oldRun).toBe("cancelled");
  expect(model.getSnapshot()).toMatchObject({ busy: true, calendar: original });
  const replacement = { ...original, events: [] };
  next.resolve(replacement);
  expect(await nextRun).toBe("accepted");
  expect(model.getSnapshot().calendar).toBe(replacement);
  model.leave();
  expect(await model.load()).toBe("not_started");
  model.enter();
  const late = held<ReturnType<typeof packet>>();
  read.mockReturnValueOnce(late.promise);
  const lateRun = model.load();
  model.retire();
  late.resolve(original);
  expect(await lateRun).toBe("retired");
  expect(await model.load()).toBe("retired");
  expect(model.getSnapshot()).toMatchObject({ busy: false, calendar: null });
  expect(read).toHaveBeenCalledTimes(4);
});

it.each(["cancel", "leave", "retire"] as const)(
  "returns the %s outcome when a busy listener interrupts before dispatch",
  async (boundary) => {
    const { model, read } = resultFixture();
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
    const { model, read, calendar: original } = resultFixture();
    expect(await model.load()).toBe("accepted");
    const replacement = { ...original, events: [] };
    let interrupted = false;
    model.subscribe(() => {
      if (!interrupted && model.getSnapshot().calendar === replacement) {
        interrupted = true;
        model[boundary]();
      }
    });
    read.mockResolvedValueOnce(replacement);
    expect(await model.load()).toBe(
      boundary === "retire" ? "retired" : "cancelled",
    );
    expect(interrupted).toBe(true);
    expect(model.getSnapshot().calendar).toBe(
      boundary === "retire" ? null : replacement,
    );
    expect(model.getSnapshot().busy).toBe(false);
  },
);

it("reports retirement from the final busy notification without restoring accepted state", async () => {
  const { model, read, calendar: original } = resultFixture();
  const replacement = { ...original, events: [] };
  model.subscribe(() => {
    const state = model.getSnapshot();
    if (!state.busy && state.calendar === replacement) model.retire();
  });
  read.mockResolvedValueOnce(replacement);
  expect(await model.load()).toBe("retired");
  expect(model.getSnapshot().calendar).toBeNull();
});

it("preserves a new read started by a cancellation listener when the old read settles", async () => {
  const { model, read, calendar: original } = resultFixture();
  expect(await model.load()).toBe("accepted");
  const old = held<ReturnType<typeof packet>>();
  const next = held<ReturnType<typeof packet>>();
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
  expect(model.getSnapshot()).toMatchObject({ busy: true, calendar: original });
  const replacement = { ...original, events: [] };
  next.resolve(replacement);
  expect(await nextRun).toBe("accepted");
  expect(model.getSnapshot()).toMatchObject({
    busy: false,
    calendar: replacement,
  });
  expect(read).toHaveBeenCalledTimes(3);
});
