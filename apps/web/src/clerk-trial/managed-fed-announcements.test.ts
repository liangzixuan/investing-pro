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
