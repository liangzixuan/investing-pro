import { describe, expect, it, vi } from "vitest";
import { ManagedMarketsSourceReview } from "./managed-markets-source-review";
import type {
  MarketsSourceReviewPort,
  MarketsSourceView,
} from "./managed-markets-source-review-types";
import type { ManagedSourceReadResult } from "./managed-source-read-result";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** A source owns its activity token and never lets cancelled work replace a packet. */
function source(
  id: string,
  order: string[],
  initial: Partial<MarketsSourceView> = {},
) {
  let view: MarketsSourceView = Object.freeze({
    token: Symbol(),
    label: id,
    identity: null,
    eligible: true,
    busy: false,
    loaded: false,
    empty: false,
    evidence: "Not loaded.",
    ...initial,
  });
  let generation = 0;
  const listeners = new Set<() => void>();
  const replies: Promise<ManagedSourceReadResult>[] = [];
  const change = (patch: Partial<MarketsSourceView>) => {
    view = Object.freeze({ ...view, ...patch, token: Symbol() });
    for (const listener of listeners) listener();
  };
  const load = vi.fn<MarketsSourceReviewPort["load"]>(async () => {
    const owned = ++generation;
    order.push(id);
    change({ busy: true });
    const result = await (replies.shift() ?? Promise.resolve("accepted"));
    if (owned !== generation) return result;
    if (result === "accepted") {
      change({
        busy: false,
        loaded: true,
        evidence: `${id} retrieved UTC 2026-10-26T12:00:00Z.`,
      });
    } else change({ busy: false });
    return result;
  });
  const cancel = vi.fn(() => {
    generation++;
    change({ busy: false });
  });
  const port: MarketsSourceReviewPort = {
    id,
    read: () => view,
    load,
    cancel,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    port,
    load,
    cancel,
    change,
    reply: (value: Promise<ManagedSourceReadResult>) => replies.push(value),
  };
}

function row(review: ManagedMarketsSourceReview, id: string) {
  const result = review
    .getSnapshot()
    .rows.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Missing invented source ${id}`);
  return result;
}

describe("explicit Markets source review pass", () => {
  it("previews without reads and dispatches only selected eligible sources in declared order", async () => {
    const order: string[] = [];
    const missing = source("price-first", order);
    const retained = source("retained", order, {
      loaded: true,
      evidence: "Original UTC 2026-10-20T12:00:00Z.",
    });
    const refresh = source("refresh-third", order, {
      loaded: true,
      evidence: "Original UTC 2026-10-21T12:00:00Z.",
    });
    const ineligible = source("unadmitted", order, { eligible: false });
    const skipped = source("not-chosen", order);
    const review = new ManagedMarketsSourceReview(
      [
        missing.port,
        retained.port,
        refresh.port,
        ineligible.port,
        skipped.port,
      ],
      () => true,
    );
    review.choose(refresh.port.id, true);
    review.choose(skipped.port.id, false);
    review.choose(ineligible.port.id, true);
    review.preview();
    const plan = review.getSnapshot().plan;
    expect(plan.map((entry) => [entry.id, entry.mode, entry.evidence])).toEqual(
      [
        ["price-first", "load", "Not loaded."],
        ["refresh-third", "refresh", "Original UTC 2026-10-21T12:00:00Z."],
      ],
    );
    expect(Object.isFrozen(plan)).toBe(true);
    expect(plan.every(Object.isFrozen)).toBe(true);
    expect(order).toEqual([]);
    expect(review.getSnapshot().canStart).toBe(true);
    await review.start();
    expect(order).toEqual(["price-first", "refresh-third"]);
    expect(review.getSnapshot().phase).toBe("complete");
    expect(review.getSnapshot().plan).toBe(plan);
    expect(plan[0]?.mode).toBe("load");
    expect(row(review, "price-first").mode).toBe("refresh");
    expect(row(review, "retained")).toMatchObject({
      selected: false,
      outcome: "retained",
      evidence: "Original UTC 2026-10-20T12:00:00Z.",
    });
    expect(row(review, "not-chosen").outcome).toBe("not_attempted");
    expect(retained.load).not.toHaveBeenCalled();
    expect(ineligible.load).not.toHaveBeenCalled();
    expect(skipped.load).not.toHaveBeenCalled();
  });

  it("distinguishes newly checked empty, retained checked empty, and never checked", async () => {
    const order: string[] = [];
    const empty = source("new-empty", order, { empty: true });
    const retainedEmpty = source("retained-empty", order, {
      loaded: true,
      empty: true,
    });
    const never = source("never", order);
    const review = new ManagedMarketsSourceReview(
      [empty.port, retainedEmpty.port, never.port],
      () => true,
    );
    review.choose("never", false);
    review.preview();
    await review.start();
    expect(order).toEqual(["new-empty"]);
    expect(row(review, "new-empty").outcome).toBe("checked_empty");
    expect(row(review, "retained-empty").outcome).toBe("retained");
    expect(row(review, "never").outcome).toBe("not_attempted");
  });

  it.each(["failed", "not_started", "cancelled", "retired"] as const)(
    "stops after %s without treating a retained packet as a successful refresh",
    async (result) => {
      const order: string[] = [];
      const first = source("first", order);
      const refresh = source("refresh", order, {
        loaded: true,
        evidence: "Previous packet, original clock.",
      });
      const remaining = source("remaining", order);
      refresh.reply(Promise.resolve(result));
      const review = new ManagedMarketsSourceReview(
        [first.port, refresh.port, remaining.port],
        () => true,
      );
      review.choose("refresh", true);
      review.preview();
      const plan = review.getSnapshot().plan;
      await review.start();
      expect(order).toEqual(["first", "refresh"]);
      expect(review.getSnapshot()).toMatchObject({
        phase: "stopped",
        canStart: false,
      });
      expect(review.getSnapshot().plan).toBe(plan);
      expect(row(review, "first").outcome).toBe("checked");
      expect(row(review, "refresh")).toMatchObject({
        loaded: true,
        evidence: "Previous packet, original clock.",
        outcome: result === "cancelled" ? "cancelled" : "failed",
      });
      expect(row(review, "remaining").outcome).toBe("not_attempted");
      expect(remaining.load).not.toHaveBeenCalled();
    },
  );

  it("stops at checked cooldown refusal and does not infer expiry or retry", async () => {
    const order: string[] = [];
    const limited = source("limited-price", order, {
      evidence: "Checked shared cooldown. No provider reset supplied.",
    });
    const remaining = source("remaining", order);
    limited.reply(Promise.resolve("not_started"));
    const review = new ManagedMarketsSourceReview(
      [limited.port, remaining.port],
      () => true,
    );
    review.preview();
    await review.start();
    await review.start();
    review.reconcile();
    expect(order).toEqual(["limited-price"]);
    expect(row(review, "limited-price").outcome).toBe("failed");
    expect(row(review, "remaining").outcome).toBe("not_attempted");
    expect(remaining.load).not.toHaveBeenCalled();
  });

  it("contains a thrown source failure and does not dispatch the remaining sources", async () => {
    const order: string[] = [];
    const failed = source("throws", order);
    const next = source("next", order);
    failed.load.mockRejectedValueOnce(new Error("Invented unavailable source"));
    const review = new ManagedMarketsSourceReview(
      [failed.port, next.port],
      () => true,
    );
    review.preview();
    await expect(review.start()).resolves.toBeUndefined();
    expect(review.getSnapshot().phase).toBe("stopped");
    expect(row(review, "throws").outcome).toBe("failed");
    expect(next.load).not.toHaveBeenCalled();
  });

  it("refuses accepted results that did not produce an idle loaded packet", async () => {
    const order: string[] = [];
    const incomplete = source("incomplete", order);
    const next = source("next", order);
    incomplete.load.mockResolvedValueOnce("accepted");
    const review = new ManagedMarketsSourceReview(
      [incomplete.port, next.port],
      () => true,
    );
    review.preview();
    await review.start();
    expect(review.getSnapshot().phase).toBe("stopped");
    expect(row(review, "incomplete")).toMatchObject({
      loaded: false,
      outcome: "failed",
    });
    expect(next.load).not.toHaveBeenCalled();
  });

  it("keeps the original plan when cancelled; late old completion cannot settle a new pass", async () => {
    const order: string[] = [];
    const first = source("first", order);
    const next = source("next", order);
    const old = deferred<ManagedSourceReadResult>();
    const replacement = deferred<ManagedSourceReadResult>();
    first.reply(old.promise);
    first.reply(replacement.promise);
    const review = new ManagedMarketsSourceReview(
      [first.port, next.port],
      () => true,
    );
    review.preview();
    const originalPlan = review.getSnapshot().plan;
    const oldRun = review.start();
    review.cancel();
    expect(review.getSnapshot().phase).toBe("cancelled");
    expect(review.getSnapshot().plan).toBe(originalPlan);
    expect(first.cancel).toHaveBeenCalledOnce();
    expect(row(review, "first").outcome).toBe("cancelled");
    expect(row(review, "next").outcome).toBe("not_attempted");
    await review.start();
    expect(order).toEqual(["first"]);
    review.preview();
    const newRun = review.start();
    old.resolve("accepted");
    await oldRun;
    expect(review.getSnapshot().phase).toBe("running");
    expect(row(review, "first").outcome).toBe("running");
    expect(next.load).not.toHaveBeenCalled();
    replacement.resolve("accepted");
    await newRun;
    expect(order).toEqual(["first", "first", "next"]);
    expect(review.getSnapshot().phase).toBe("complete");
    expect(row(review, "first").outcome).toBe("checked");
  });

  it("keeps completed evidence and untouched remaining sources after a partial-pass cancellation", async () => {
    const order: string[] = [];
    const completed = source("completed", order);
    const active = source("active", order);
    const untouched = source("untouched", order);
    const held = deferred<ManagedSourceReadResult>();
    active.reply(held.promise);
    const review = new ManagedMarketsSourceReview(
      [completed.port, active.port, untouched.port],
      () => true,
    );
    review.preview();
    const plan = review.getSnapshot().plan;
    const running = review.start();
    await vi.waitFor(() => expect(active.load).toHaveBeenCalledOnce());
    const evidence = row(review, "completed").evidence;
    expect(row(review, "completed").outcome).toBe("checked");
    review.cancel();
    expect(review.getSnapshot().plan).toBe(plan);
    expect(row(review, "completed")).toMatchObject({
      loaded: true,
      outcome: "checked",
      evidence,
    });
    expect(row(review, "active").outcome).toBe("cancelled");
    expect(row(review, "untouched").outcome).toBe("not_attempted");
    held.resolve("accepted");
    await running;
    expect(review.getSnapshot().phase).toBe("cancelled");
    expect(row(review, "completed").evidence).toBe(evidence);
    expect(order).toEqual(["completed", "active"]);
    expect(completed.cancel).not.toHaveBeenCalled();
    expect(active.cancel).toHaveBeenCalledOnce();
    expect(untouched.load).not.toHaveBeenCalled();
  });

  it("retires the pass without cancelling an independent read started by the source settlement listener", async () => {
    const order: string[] = [];
    const first = source("first", order);
    const remaining = source("remaining", order);
    const independent = deferred<ManagedSourceReadResult>();
    first.reply(Promise.resolve("accepted"));
    first.reply(independent.promise);
    const review = new ManagedMarketsSourceReview(
      [first.port, remaining.port],
      () => true,
    );
    review.preview();
    let restarted = false;
    let independentRun =
      Promise.resolve<ManagedSourceReadResult>("not_started");
    first.port.subscribe(() => {
      const view = first.port.read();
      if (restarted) return;
      if (!view.loaded) return;
      if (view.busy) return;
      restarted = true;
      independentRun = first.port.load();
    });
    await review.start();
    expect(restarted).toBe(true);
    expect(review.getSnapshot()).toMatchObject({
      phase: "retired",
      canStart: false,
      plan: [],
    });
    expect(first.port.read().busy).toBe(true);
    expect(first.cancel).not.toHaveBeenCalled();
    expect(remaining.load).not.toHaveBeenCalled();
    independent.resolve("accepted");
    expect(await independentRun).toBe("accepted");
    expect(first.port.read().busy).toBe(false);
    expect(review.getSnapshot().phase).toBe("retired");
    expect(order).toEqual(["first", "first"]);
  });

  it("does not duplicate reads from a duplicate or reentrant Start", async () => {
    const order: string[] = [];
    const first = source("first", order);
    const next = source("next", order);
    const held = deferred<ManagedSourceReadResult>();
    first.reply(held.promise);
    const review = new ManagedMarketsSourceReview(
      [first.port, next.port],
      () => true,
    );
    review.preview();
    let reentered = false;
    review.subscribe(() => {
      if (!reentered && review.getSnapshot().phase === "running") {
        reentered = true;
        void review.start();
      }
    });
    const running = review.start();
    await review.start();
    expect(order).toEqual(["first"]);
    held.resolve("accepted");
    await running;
    expect(order).toEqual(["first", "next"]);
    expect(reentered).toBe(true);
  });

  it.each([
    "selected source",
    "unselected source",
    "selection",
    "context",
  ] as const)(
    "permanently retires a preview after a %s roundtrip before dispatch",
    async (boundary) => {
      const order: string[] = [];
      const selected = source("selected", order);
      const unselected = source("unselected", order, { loaded: true });
      let available = true;
      const review = new ManagedMarketsSourceReview(
        [selected.port, unselected.port],
        () => available,
      );
      review.preview();
      const changeSource = (target: typeof selected) => {
        const evidence = target.port.read().evidence;
        target.change({ evidence: "Intervening source activity." });
        target.change({ evidence });
      };
      const boundaries = {
        "selected source": () => changeSource(selected),
        "unselected source": () => changeSource(unselected),
        selection: () => {
          review.choose("selected", false);
          review.choose("selected", true);
        },
        context: () => {
          available = false;
          review.reconcile();
          available = true;
          review.reconcile();
        },
      };
      boundaries[boundary]();
      expect(review.getSnapshot().canStart).toBe(false);
      expect(review.getSnapshot().plan).toEqual([]);
      await review.start();
      expect(order).toEqual([]);
      review.preview();
      expect(review.getSnapshot().canStart).toBe(true);
    },
  );

  it("retires an active pass when an unselected source changes and ignores its late accepted result", async () => {
    const order: string[] = [];
    const first = source("first", order);
    const unselected = source("unselected", order, { loaded: true });
    const remaining = source("remaining", order);
    const held = deferred<ManagedSourceReadResult>();
    first.reply(held.promise);
    const review = new ManagedMarketsSourceReview(
      [first.port, unselected.port, remaining.port],
      () => true,
    );
    review.preview();
    const running = review.start();
    unselected.change({ evidence: "New independently retrieved packet." });
    expect(review.getSnapshot().phase).toBe("retired");
    expect(review.getSnapshot().plan).toEqual([]);
    expect(first.cancel).toHaveBeenCalledOnce();
    held.resolve("accepted");
    await running;
    expect(order).toEqual(["first"]);
    expect(remaining.load).not.toHaveBeenCalled();
    expect(review.getSnapshot().phase).toBe("retired");
  });

  it.each(["cancel", "navigation"] as const)(
    "does not dispatch when a Start notification listener requests %s",
    async (boundary) => {
      const order: string[] = [];
      const first = source("first", order);
      let available = true;
      const review = new ManagedMarketsSourceReview(
        [first.port],
        () => available,
      );
      review.preview();
      let interrupted = false;
      const interrupt = {
        cancel: () => review.cancel(),
        navigation: () => {
          available = false;
          review.reconcile();
        },
      };
      review.subscribe(() => {
        if (!interrupted && review.getSnapshot().phase === "running") {
          interrupted = true;
          interrupt[boundary]();
        }
      });
      await review.start();
      expect(interrupted).toBe(true);
      expect(order).toEqual([]);
      expect(first.load).not.toHaveBeenCalled();
      expect(review.getSnapshot().phase).toBe(
        boundary === "cancel" ? "cancelled" : "retired",
      );
    },
  );

  it("clears the original plan on choice changes and replaces it only on a new explicit preview", () => {
    const order: string[] = [];
    const first = source("first", order);
    const second = source("second", order);
    const review = new ManagedMarketsSourceReview(
      [first.port, second.port],
      () => true,
    );
    review.preview();
    const plan = review.getSnapshot().plan;
    review.choose("second", false);
    expect(review.getSnapshot().plan).toEqual([]);
    expect(review.getSnapshot().canStart).toBe(false);
    review.preview();
    expect(review.getSnapshot().plan).not.toBe(plan);
    expect(review.getSnapshot().plan.map((entry) => entry.id)).toEqual([
      "first",
    ]);
    expect(order).toEqual([]);
  });

  it("does not resume after permanent session retirement or later source activity", async () => {
    const order: string[] = [];
    const first = source("first", order);
    const review = new ManagedMarketsSourceReview([first.port], () => true);
    review.preview();
    review.retire();
    first.change({ loaded: true });
    review.choose("first", true);
    review.preview();
    await review.start();
    expect(review.getSnapshot()).toMatchObject({
      phase: "retired",
      rows: [],
      plan: [],
      canStart: false,
      canPreview: false,
    });
    expect(order).toEqual([]);
  });
});
