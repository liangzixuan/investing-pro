import { describe, expect, it, vi } from "vitest";
import {
  parseManagedMonetaryAnnouncements,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import type { ManagedApi } from "./managed-api";
import { ManagedFedAnnouncements } from "./managed-fed-announcements";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";

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
  const announcements = parseManagedMonetaryAnnouncements(
    fedAnnouncementsFixture(),
  )!;
  const read = vi
    .fn<ManagedApi["monetaryAnnouncements"]>()
    .mockResolvedValue(announcements);
  const retire = vi.fn();
  return {
    model: new ManagedFedAnnouncements(read, retire),
    read,
    retire,
    announcements,
  };
}

describe("managed Fed announcements lifetime", () => {
  it("does not start a read when a busy notification leaves the foreground", async () => {
    const { model, read } = fixture();
    model.subscribe(() => {
      if (model.getSnapshot().busy) model.leave();
    });
    await model.load();
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().busy).toBe(false);
  });
  it("loads only explicitly, deduplicates pending clicks and preserves a verified empty feed", async () => {
    const { model, read } = fixture();
    model.leave();
    await model.load();
    model.enter();
    expect(read).not.toHaveBeenCalled();
    const held = deferred<PersonalMonetaryAnnouncementsDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    await model.load();
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot()).toMatchObject({
      busy: true,
      announcements: null,
    });
    const empty = {
      ...fedAnnouncementsFixture(),
      availableItemCount: 0,
      items: [],
    };
    held.resolve(empty);
    await pending;
    expect(model.getSnapshot()).toMatchObject({
      busy: false,
      announcements: empty,
      error: null,
    });
    model.leave();
    model.enter();
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot().announcements).toBe(empty);
  });

  it.each(["unavailable", "invalid_response"] as const)(
    "keeps the exact validated previous packet after %s and replaces it only after a successful refresh",
    async (code) => {
      const { model, read, announcements } = fixture();
      await model.load();
      read.mockRejectedValueOnce(new TrialApiError(code));
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        busy: false,
        showingPrevious: true,
        error: code,
      });
      expect(model.getSnapshot().announcements).toBe(announcements);
      expect(model.getSnapshot().announcements?.fetchedAt).toBe(
        "2026-10-20T18:00:00.000Z",
      );
      const next = { ...announcements, availableItemCount: 0, items: [] };
      read.mockResolvedValueOnce(next);
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        announcements: next,
        showingPrevious: false,
        error: null,
      });
      expect(read).toHaveBeenCalledTimes(3);
    },
  );

  it.each(["cancel", "leave"] as const)(
    "%s retains accepted data and fences a late authentication failure while a new read completes",
    async (boundary) => {
      const { model, read, retire, announcements } = fixture();
      await model.load();
      const old = deferred<PersonalMonetaryAnnouncementsDto>();
      const next = deferred<PersonalMonetaryAnnouncementsDto>();
      read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
      const pendingOld = model.load();
      expect(model.getSnapshot()).toMatchObject({
        busy: true,
        showingPrevious: true,
        announcements,
      });
      model[boundary]();
      expect(read.mock.calls[1]![0].aborted).toBe(true);
      expect(model.getSnapshot()).toMatchObject({
        busy: false,
        showingPrevious: true,
        announcements,
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
      const replacement = {
        ...announcements,
        availableItemCount: 0,
        items: [],
      };
      next.resolve(replacement);
      await pendingNext;
      expect(model.getSnapshot()).toMatchObject({
        busy: false,
        announcements: replacement,
      });
    },
  );

  it("retirement clears retained data and fences a late successful refresh and old load action", async () => {
    const { model, read } = fixture();
    await model.load();
    const held = deferred<PersonalMonetaryAnnouncementsDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    model.retire();
    const retired = model.getSnapshot();
    expect(retired).toMatchObject({
      announcements: null,
      busy: false,
      error: null,
      showingPrevious: false,
    });
    expect(read.mock.calls[1]![0].aborted).toBe(true);
    held.resolve(fedAnnouncementsFixture());
    await pending;
    model.enter();
    await model.load();
    expect(model.getSnapshot()).toBe(retired);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "clears the announcements and calls shared retirement on current %s",
    async (code) => {
      const { model, read, retire } = fixture();
      await model.load();
      const error = new TrialApiError(code);
      read.mockRejectedValueOnce(error);
      await model.load();
      expect(retire).toHaveBeenCalledExactlyOnceWith(error);
      expect(model.getSnapshot()).toMatchObject({
        announcements: null,
        busy: false,
      });
      await model.load();
      expect(read).toHaveBeenCalledTimes(2);
    },
  );
});

function acceptedFeed(empty = false, fetchedAt = "2026-10-21T18:00:00.000Z") {
  const original = fedAnnouncementsFixture();
  const response = parseManagedMonetaryAnnouncements({
    ...original,
    fetchedAt,
    items: empty ? [] : original.items,
    availableItemCount: empty ? 0 : original.availableItemCount,
  });
  if (!response)
    throw new Error("The invented feed must pass the real parser.");
  return response;
}

async function comparisonFixture() {
  const context = fixture();
  await context.model.load();
  const current = acceptedFeed();
  context.read.mockResolvedValueOnce(current);
  await context.model.load();
  const comparison = context.model.getSnapshot().refreshComparison!;
  expect(comparison.previous).toBe(context.announcements);
  expect(comparison.current).toBe(current);
  return { ...context, current, comparison };
}

describe("managed Fed accepted refresh comparison", () => {
  it.each([false, true])(
    "starts without a pair and admits its first packet without a comparison (empty=%s)",
    async (empty) => {
      const { model, read } = fixture();
      expect(model.getSnapshot().refreshComparison).toBeNull();
      expect(read).not.toHaveBeenCalled();
      const first = acceptedFeed(empty);
      read.mockResolvedValueOnce(first);
      await model.load();
      expect(model.getSnapshot().announcements).toBe(first);
      expect(model.getSnapshot().refreshComparison).toBeNull();
      expect(read).toHaveBeenCalledOnce();
    },
  );

  it("publishes each replacement and pair atomically, including equal objects and empty transitions", async () => {
    const { model, read, announcements } = fixture();
    const observed: ReturnType<typeof model.getSnapshot>[] = [];
    model.subscribe(() => observed.push(model.getSnapshot()));
    await model.load();
    const equal = acceptedFeed(false, announcements.fetchedAt);
    const empty = acceptedFeed(true);
    for (const current of [equal, equal, empty, announcements]) {
      const previous = model.getSnapshot().announcements;
      read.mockResolvedValueOnce(current);
      await model.load();
      const comparison = model.getSnapshot().refreshComparison!;
      expect(comparison.previous).toBe(previous);
      expect(comparison.current).toBe(current);
      expect(comparison.newUrls).toEqual(
        previous === empty ? announcements.items.map((item) => item.url) : [],
      );
    }
    for (const state of observed) {
      if (state.announcements && state.announcements !== announcements)
        expect(state.refreshComparison?.current).toBe(state.announcements);
      if (state.refreshComparison)
        expect(state.refreshComparison.current).toBe(state.announcements);
    }
    expect(read).toHaveBeenCalledTimes(5);
  });

  it.each(["unavailable", "invalid_response"] as const)(
    "retains the exact accepted pair during a pending read and %s without advancing the baseline",
    async (code) => {
      const { model, read, current, comparison } = await comparisonFixture();
      const held = deferred<PersonalMonetaryAnnouncementsDto>();
      read.mockReturnValueOnce(held.promise);
      const pending = model.load();
      await model.load();
      expect(model.getSnapshot().refreshComparison).toBe(comparison);
      expect(model.getSnapshot().showingPrevious).toBe(true);
      held.reject(new TrialApiError(code));
      await pending;
      expect(model.getSnapshot().refreshComparison).toBe(comparison);
      expect(model.getSnapshot().announcements).toBe(current);
      expect(model.getSnapshot().error).toBe(code);
      const next = acceptedFeed(true);
      read.mockResolvedValueOnce(next);
      await model.load();
      expect(model.getSnapshot().refreshComparison?.previous).toBe(current);
      expect(model.getSnapshot().refreshComparison?.current).toBe(next);
      expect(read).toHaveBeenCalledTimes(4);
    },
  );

  it.each(["cancel", "leave"] as const)(
    "%s retains the pair across late success and late auth while a newer read completes",
    async (boundary) => {
      const { model, read, retire, current, comparison } =
        await comparisonFixture();
      const lateSuccess = deferred<PersonalMonetaryAnnouncementsDto>();
      const lateAuth = deferred<PersonalMonetaryAnnouncementsDto>();
      const next = deferred<PersonalMonetaryAnnouncementsDto>();
      read
        .mockReturnValueOnce(lateSuccess.promise)
        .mockReturnValueOnce(lateAuth.promise)
        .mockReturnValueOnce(next.promise);
      const successRun = model.load();
      model[boundary]();
      expect(read.mock.calls[2]![0].aborted).toBe(true);
      model.enter();
      expect(model.getSnapshot().refreshComparison).toBe(comparison);
      const authRun = model.load();
      model[boundary]();
      expect(read.mock.calls[3]![0].aborted).toBe(true);
      model.enter();
      expect(read).toHaveBeenCalledTimes(4);
      const nextRun = model.load();
      lateSuccess.resolve(acceptedFeed(true));
      lateAuth.reject(new TrialApiError("unauthenticated"));
      await Promise.all([successRun, authRun]);
      expect(retire).not.toHaveBeenCalled();
      expect(model.getSnapshot().busy).toBe(true);
      expect(model.getSnapshot().refreshComparison).toBe(comparison);
      const replacement = acceptedFeed(false, "2026-10-23T18:00:00.000Z");
      next.resolve(replacement);
      await nextRun;
      expect(model.getSnapshot().refreshComparison?.previous).toBe(current);
      expect(model.getSnapshot().refreshComparison?.current).toBe(replacement);
      expect(read).toHaveBeenCalledTimes(5);
    },
  );

  it("ordinary leave and enter preserve the exact comparison without another read", async () => {
    const { model, read, comparison } = await comparisonFixture();
    model.leave();
    model.enter();
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "clears both accepted packets for current %s",
    async (code) => {
      const { model, read, retire } = await comparisonFixture();
      const error = new TrialApiError(code);
      read.mockRejectedValueOnce(error);
      await model.load();
      const retired = model.getSnapshot();
      expect(retired.announcements).toBeNull();
      expect(retired.refreshComparison).toBeNull();
      expect(retire).toHaveBeenCalledExactlyOnceWith(error);
      model.enter();
      await model.load();
      expect(model.getSnapshot()).toBe(retired);
      expect(read).toHaveBeenCalledTimes(3);
    },
  );

  it("clears the pair on retirement and ignores a late successful packet", async () => {
    const { model, read } = await comparisonFixture();
    const held = deferred<PersonalMonetaryAnnouncementsDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    model.retire();
    const retired = model.getSnapshot();
    expect(retired.refreshComparison).toBeNull();
    expect(retired.announcements).toBeNull();
    held.resolve(acceptedFeed());
    await pending;
    expect(model.getSnapshot()).toBe(retired);
  });

  it("keeps the pair when a busy subscriber leaves before the read starts", async () => {
    const { model, read, comparison } = await comparisonFixture();
    model.subscribe(() => {
      if (model.getSnapshot().busy) model.leave();
    });
    await model.load();
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    expect(model.getSnapshot().busy).toBe(false);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not restore accepted state after a success subscriber retires the session", async () => {
    const { model, read, current } = await comparisonFixture();
    const next = acceptedFeed(true);
    let retired: ReturnType<typeof model.getSnapshot> | null = null;
    model.subscribe(() => {
      const state = model.getSnapshot();
      if (state.announcements === next) {
        expect(state.refreshComparison?.previous).toBe(current);
        expect(state.refreshComparison?.current).toBe(next);
        model.retire();
        retired = model.getSnapshot();
      }
    });
    read.mockResolvedValueOnce(next);
    await model.load();
    expect(retired).not.toBeNull();
    expect(model.getSnapshot()).toBe(retired);
    expect(model.getSnapshot().announcements).toBeNull();
    expect(model.getSnapshot().refreshComparison).toBeNull();
  });

  it("preserves a new operation opened during cancellation publication when old work settles", async () => {
    const { model, read, current, comparison } = await comparisonFixture();
    const old = deferred<PersonalMonetaryAnnouncementsDto>();
    const next = deferred<PersonalMonetaryAnnouncementsDto>();
    read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const oldRun = model.load();
    let nextRun = Promise.resolve();
    let started = false;
    model.subscribe(() => {
      if (!started && !model.getSnapshot().busy) {
        started = true;
        nextRun = model.load();
      }
    });
    model.cancel();
    expect(started).toBe(true);
    expect(model.getSnapshot().busy).toBe(true);
    old.resolve(acceptedFeed(true));
    await oldRun;
    expect(model.getSnapshot().busy).toBe(true);
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    const replacement = acceptedFeed(false, "2026-10-24T18:00:00.000Z");
    next.resolve(replacement);
    await nextRun;
    expect(model.getSnapshot().refreshComparison?.previous).toBe(current);
    expect(model.getSnapshot().refreshComparison?.current).toBe(replacement);
    expect(read).toHaveBeenCalledTimes(4);
  });
});
