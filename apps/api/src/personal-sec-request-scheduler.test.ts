import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSecPersonalFinancialProvider } from "./personal-sec-financial-provider";
import { createSecPersonalFilingsProvider } from "./personal-sec-filings-provider";
import { createSecPersonalQuarterlyEvidenceProvider } from "./personal-sec-quarterly-evidence-provider";
import {
  createPersonalSecRequestScheduler,
  PERSONAL_SEC_REQUEST_SCHEDULER_LIMITS,
  sharedPersonalSecRequestScheduler,
} from "./personal-sec-request-scheduler";

const NOW = new Date("2026-09-10T12:00:00.000Z");
const USER_AGENT = "PersonalResearch/1.0 owner@example.test";
const CIK = "0000000042";
const FROM = "2026-09-01";
const THROUGH = "2026-09-10";

function scheduler() {
  return createPersonalSecRequestScheduler({ now: () => Date.now() });
}

function signal() {
  return new AbortController().signal;
}

function assertSpaced(starts: readonly number[]) {
  for (let index = 1; index < starts.length; index++) {
    expect(starts[index]! - starts[index - 1]!).toBeGreaterThanOrEqual(220);
  }
}

function sourceFetch(starts: number[]) {
  return vi.fn<typeof fetch>((input) => {
    starts.push(Date.now());
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("/frames/")) {
      const parts = new URL(url).pathname.split("/");
      return Promise.resolve(
        Response.json({
          taxonomy: "us-gaap",
          tag: parts[5],
          ccp: "CY2025",
          uom: "USD",
          pts: 0,
          data: [],
        }),
      );
    }
    if (url.includes("/companyfacts/")) {
      return Promise.resolve(
        Response.json({
          cik: url.match(/CIK(\d{10})/u)?.[1],
          facts: { "us-gaap": {} },
        }),
      );
    }
    return Promise.resolve(
      Response.json({
        cik: url.match(/CIK(\d{10})/u)?.[1],
        filings: {
          recent: {
            accessionNumber: [],
            form: [],
            filingDate: [],
            reportDate: [],
          },
          files: [],
        },
      }),
    );
  });
}

describe("shared SEC request scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("grants FIFO permits at least 220 ms apart without a burst after idle", async () => {
    expect(PERSONAL_SEC_REQUEST_SCHEDULER_LIMITS).toEqual({
      minimumIntervalMs: 220,
      queuedRequests: 64,
    });
    const queue = scheduler();
    const granted: number[] = [];
    const starts: number[] = [];
    const requests = [1, 2, 3].map(async (id) => {
      await queue.wait(signal());
      granted.push(id);
      starts.push(Date.now());
    });
    await vi.runAllTimersAsync();
    await Promise.all(requests);
    expect(granted).toEqual([1, 2, 3]);
    assertSpaced(starts);
    await vi.advanceTimersByTimeAsync(10_000);
    const later = [4, 5].map(async (id) => {
      await queue.wait(signal());
      granted.push(id);
      starts.push(Date.now());
    });
    await vi.runAllTimersAsync();
    await Promise.all(later);
    expect(granted).toEqual([1, 2, 3, 4, 5]);
    assertSpaced(starts);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts cooldown after synchronous consumer work instead of bunching overdue permits", async () => {
    const queue = scheduler();
    const starts: number[] = [];
    const first = (async () => {
      await queue.wait(signal());
      // Model blocking synchronous setup before the actual fetch dispatch.
      vi.setSystemTime(Date.now() + 500);
      starts.push(Date.now());
    })();
    const second = (async () => {
      await queue.wait(signal());
      starts.push(Date.now());
    })();
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);
    expect(starts).toHaveLength(2);
    assertSpaced(starts);
  });

  it("removes a cancelled waiter without consuming its future slot or leaking listeners", async () => {
    const queue = scheduler();
    await queue.wait(signal());
    await vi.advanceTimersByTimeAsync(0);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const cancelled = expect(
      queue.wait(controller.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    const granted = vi.fn();
    const next = queue.wait(signal()).then(granted);
    controller.abort();
    await cancelled;
    expect(remove).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(219);
    expect(granted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await next;
    expect(granted).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds the queue and releases capacity and timers when all waiters cancel", async () => {
    const queue = scheduler();
    await queue.wait(signal());
    await vi.advanceTimersByTimeAsync(0);
    const controllers = Array.from({ length: 64 }, () => new AbortController());
    const pending = controllers.map((controller) =>
      expect(queue.wait(controller.signal)).rejects.toMatchObject({
        code: "aborted",
      }),
    );
    await expect(queue.wait(signal())).rejects.toMatchObject({ code: "busy" });
    for (const controller of controllers) controller.abort();
    await Promise.all(pending);
    expect(vi.getTimerCount()).toBe(0);
    const admitted = queue.wait(signal());
    await vi.runAllTimersAsync();
    await admitted;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an already aborted signal without reserving a slot", async () => {
    const queue = scheduler();
    const controller = new AbortController();
    controller.abort();
    await expect(queue.wait(controller.signal)).rejects.toMatchObject({
      code: "aborted",
    });
    const granted = vi.fn();
    await queue.wait(signal()).then(granted);
    expect(granted).toHaveBeenCalledOnce();
    expect(Date.now()).toBe(NOW.getTime());
    await vi.runAllTimersAsync();
  });

  it("removes the abort listener when a permit is granted", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await scheduler().wait(controller.signal);
    expect(remove).toHaveBeenCalledOnce();
    controller.abort();
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits a full interval after a test clock rewinds", async () => {
    const queue = scheduler();
    await queue.wait(signal());
    await vi.runAllTimersAsync();
    vi.setSystemTime(NOW.getTime() - 10_000);
    const granted = vi.fn();
    const next = queue.wait(signal()).then(granted);
    await vi.advanceTimersByTimeAsync(219);
    expect(granted).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await next;
    await vi.runAllTimersAsync();
  });

  it("fails closed on an invalid injected clock", async () => {
    const queue = createPersonalSecRequestScheduler({ now: () => Number.NaN });
    await expect(queue.wait(signal())).rejects.toMatchObject({ code: "busy" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("paces all three default SEC providers together, including refresh and fresh instances", async () => {
    const queue = scheduler();
    const wait = vi
      .spyOn(sharedPersonalSecRequestScheduler, "wait")
      .mockImplementation((current) => queue.wait(current));
    const starts: number[] = [];
    const fetch = sourceFetch(starts);
    const annual = createSecPersonalFinancialProvider(USER_AGENT, { fetch });
    const filings = createSecPersonalFilingsProvider(USER_AGENT, { fetch });
    const quarterly = createSecPersonalQuarterlyEvidenceProvider(USER_AGENT, {
      fetch,
    });
    const first = annual.loadSnapshot(2025);
    const second = filings.loadFilings([CIK, "0000000007"], FROM, THROUGH);
    const evidenceLoad = quarterly.loadEvidence(CIK);
    await vi.runAllTimersAsync();
    const [snapshot, rows, evidence] = await Promise.all([
      first,
      second,
      evidenceLoad,
    ]);
    expect(snapshot.frames.every((frame) => frame.status === "available")).toBe(
      true,
    );
    expect(rows.every((row) => row.status === "available")).toBe(true);
    expect(evidence.sources.companyFacts.status).toBe("available");
    expect(evidence.sources.submissions.status).toBe("available");
    expect(starts).toHaveLength(11);
    const refresh = annual.loadSnapshot(2025, undefined, true);
    filings.close();
    const replacement = createSecPersonalFilingsProvider(USER_AGENT, { fetch });
    const third = replacement.loadFilings([CIK], FROM, THROUGH);
    await vi.runAllTimersAsync();
    await Promise.all([refresh, third]);
    expect(starts).toHaveLength(19);
    expect(wait).toHaveBeenCalledTimes(19);
    assertSpaced(starts);
    const count = fetch.mock.calls.length;
    await annual.loadSnapshot(2025);
    expect(fetch).toHaveBeenCalledTimes(count);
    annual.close();
    replacement.close();
    quarterly.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["annual", "filings"] as const)(
    "cancels queued %s work before any fetch and releases provider busy state",
    async (kind) => {
      const queue = scheduler();
      await queue.wait(signal());
      await vi.advanceTimersByTimeAsync(0);
      const fetch = sourceFetch([]);
      const controller = new AbortController();
      const annual = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      const filings = createSecPersonalFilingsProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      const load = (abort?: AbortSignal) =>
        kind === "annual"
          ? annual.loadSnapshot(2025, abort)
          : filings.loadFilings([CIK], FROM, THROUGH, abort);
      const pending = load(controller.signal);
      const rejected = expect(pending).rejects.toMatchObject({
        code: "aborted",
      });
      controller.abort();
      await rejected;
      await vi.runAllTimersAsync();
      expect(fetch).not.toHaveBeenCalled();
      const retry = load();
      await vi.runAllTimersAsync();
      await retry;
      expect(fetch).toHaveBeenCalledTimes(kind === "annual" ? 7 : 1);
      annual.close();
      filings.close();
    },
  );

  it.each(["annual", "filings"] as const)(
    "closes queued %s work without cancelling another scheduler consumer",
    async (kind) => {
      const queue = scheduler();
      await queue.wait(signal());
      await vi.advanceTimersByTimeAsync(0);
      const fetch = sourceFetch([]);
      const annual = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      const filings = createSecPersonalFilingsProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      const pending =
        kind === "annual"
          ? annual.loadSnapshot(2025)
          : filings.loadFilings([CIK], FROM, THROUGH);
      const rejected = expect(pending).rejects.toMatchObject({
        code: "aborted",
      });
      const otherConsumer = vi.fn();
      const other = queue.wait(signal()).then(otherConsumer);
      if (kind === "annual") annual.close();
      else filings.close();
      await rejected;
      await vi.runAllTimersAsync();
      await other;
      expect(fetch).not.toHaveBeenCalled();
      expect(otherConsumer).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      annual.close();
      filings.close();
    },
  );

  it.each(["annual", "filings"] as const)(
    "starts the %s transport deadline after scheduler admission",
    async (kind) => {
      let release: (() => void) | undefined;
      const queue = {
        wait: vi
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve) => {
                release = resolve;
              }),
          )
          .mockResolvedValue(undefined),
      };
      const fetch = sourceFetch([]);
      fetch.mockImplementationOnce(
        () => new Promise<Response>(() => undefined),
      );
      const annual = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      const filings = createSecPersonalFilingsProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      const pending =
        kind === "annual"
          ? annual.loadSnapshot(2025)
          : filings.loadFilings([CIK], FROM, THROUGH);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(fetch).not.toHaveBeenCalled();
      release!();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledOnce();
      const activeSignal = fetch.mock.calls[0]?.[1]?.signal;
      await vi.advanceTimersByTimeAsync(9_999);
      expect(activeSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(activeSignal?.aborted).toBe(true);
      await vi.runAllTimersAsync();
      const result = await pending;
      if ("frames" in result)
        expect(result.frames[0]?.status).toBe("upstream_unavailable");
      else expect(result[0]?.status).toBe("upstream_unavailable");
      annual.close();
      filings.close();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(["annual", "filings"] as const)(
    "maps scheduler saturation to the %s provider busy error",
    async (kind) => {
      const queue = scheduler();
      await queue.wait(signal());
      const controllers = Array.from(
        { length: 64 },
        () => new AbortController(),
      );
      const pending = controllers.map((controller) =>
        expect(queue.wait(controller.signal)).rejects.toMatchObject({
          code: "aborted",
        }),
      );
      const fetch = sourceFetch([]);
      const annual = createSecPersonalFinancialProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      const filings = createSecPersonalFilingsProvider(USER_AGENT, {
        fetch,
        scheduler: queue,
      });
      await expect(
        kind === "annual"
          ? annual.loadSnapshot(2025)
          : filings.loadFilings([CIK], FROM, THROUGH),
      ).rejects.toMatchObject({
        code: "busy",
        name:
          kind === "annual"
            ? "PersonalSecFinancialProviderError"
            : "PersonalSecFilingsProviderError",
      });
      expect(fetch).not.toHaveBeenCalled();
      for (const controller of controllers) controller.abort();
      await Promise.all(pending);
      await vi.runAllTimersAsync();
      annual.close();
      filings.close();
    },
  );
});
