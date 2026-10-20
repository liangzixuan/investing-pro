import { expect, it, vi } from "vitest";
import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
} from "@research-cockpit/contracts";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { ManagedBlsCalendar } from "./managed-bls-calendar";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
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
    await model.load();
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
