import { describe, expect, it, vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import { ManagedSecCooldownError } from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedInterimReport } from "./managed-interim-report";
import { ManagedSecAccess } from "./managed-sec-access";
import { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import {
  ManagedCompanySourcePass,
  type CompanySourcePassPreview,
} from "./managed-company-source-pass";
import {
  companySourceOrder,
  type CompanySnapshotLoadSource,
} from "./managed-company-snapshot-load-sources";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { annualReportPacket } from "./test-annual-report-fixture";
import {
  buildInterimFixture,
  sealFixture,
} from "../../android-tests/managed-workspace/interim-report-packet";
import {
  createManagedResearchCoverageFixture,
  inventedManagedResearchCoverage,
} from "./test-managed-research-coverage-fixture";
const admitted = () => true;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
async function fixture(supported = true) {
  const annualPacket = await annualReportPacket();
  const interimPacket = await buildInterimFixture(annualPacket);
  const readPrice = vi
    .fn<ManagedApi["eodHistory"]>()
    .mockResolvedValue(eodResponse());
  const readAnnual = vi
    .fn<ManagedApi["annualReport"]>()
    .mockResolvedValue(annualPacket);
  const readFilings = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockResolvedValue(filingsResponse());
  const readInterim = vi
    .fn<ManagedApi["interimReport"]>()
    .mockResolvedValue(interimPacket);
  const access = new ManagedSecAccess();
  const coverage = supported
    ? inventedManagedResearchCoverage
    : createManagedResearchCoverageFixture([]);
  const price = new ManagedEodHistory(
    readPrice,
    vi.fn(),
    undefined,
    supported ? [eodSelection.listing] : [],
  );
  const annual = new ManagedAnnualReport(readAnnual, vi.fn(), access, {
    coverage,
  });
  const filings = new ManagedCompanyFilings(readFilings, vi.fn(), access, {
    coverage,
  });
  const interim = new ManagedInterimReport(readInterim, vi.fn(), access, {
    coverage,
    interimIssuers: [eodSelection.cik!],
  });
  const loader = new ManagedCompanySnapshotLoad(
    price,
    annual,
    filings,
    interim,
  );
  const pass = new ManagedCompanySourcePass(
    loader,
    price,
    annual,
    filings,
    interim,
  );
  return {
    loader,
    pass,
    price,
    annual,
    filings,
    interim,
    readPrice,
    readAnnual,
    readFilings,
    readInterim,
    annualPacket,
    interimPacket,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function noReads(f: Fixture) {
  for (const read of [f.readPrice, f.readAnnual, f.readFilings, f.readInterim])
    expect(read).not.toHaveBeenCalled();
}
function prepare(
  f: Fixture,
  names: readonly CompanySnapshotLoadSource[] = companySourceOrder,
) {
  const handle = f.pass.prepare(eodSelection, admitted, names);
  expect(handle).not.toBeNull();
  return handle!;
}
describe("reviewed company source pass", () => {
  it("previews and cancels without opening a model or reading a source", async () => {
    const f = await fixture();
    const models = [f.price, f.annual, f.filings, f.interim];
    const before = models.map((model) => model.getSnapshot());
    const first = prepare(f, ["eod", "annual", "filings"]);
    expect(first.names).toEqual(["eod", "annual", "filings"]);
    expect(
      first.rows.map((row) => [row.id, row.selected, row.disposition]),
    ).toEqual([
      ["eod", true, "missing"],
      ["annual", true, "missing"],
      ["filings", true, "missing"],
      ["interim", false, "not_attempted"],
    ]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.rows)).toBe(true);
    f.pass.cancel();
    await f.pass.start(first);
    noReads(f);
    models.forEach((model, index) =>
      expect(model.getSnapshot()).toBe(before[index]),
    );
  });
  it("keeps the original missing-source action at three sources", async () => {
    const f = await fixture();
    await f.loader.start(eodSelection, admitted);
    expect(f.readPrice).toHaveBeenCalledTimes(1);
    expect(f.readAnnual).toHaveBeenCalledTimes(1);
    expect(f.readFilings).toHaveBeenCalledTimes(1);
    expect(f.readInterim).not.toHaveBeenCalled();
    expect(f.interim.getSnapshot().selection).toBeNull();
    expect(f.loader.getSnapshot().outcomes.interim).toBe("not_attempted");
  });
  it("runs only declared reads in canonical order with one pending read", async () => {
    const f = await fixture();
    const price = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    const interim =
      deferred<Awaited<ReturnType<ManagedApi["interimReport"]>>>();
    f.readPrice.mockReturnValue(price.promise);
    f.readInterim.mockReturnValue(interim.promise);
    const handle = prepare(f, ["interim", "eod"]);
    expect(handle.names).toEqual(["eod", "interim"]);
    const pending = f.pass.start(handle);
    expect(f.readPrice).toHaveBeenCalledTimes(1);
    expect(f.readInterim).not.toHaveBeenCalled();
    price.resolve(eodResponse());
    await vi.waitFor(() => expect(f.readInterim).toHaveBeenCalledTimes(1));
    interim.resolve(f.interimPacket);
    await pending;
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
    expect(f.pass.getSnapshot().phase).toBe("finished");
    expect(f.pass.getSnapshot().rows.map((row) => row.disposition)).toEqual([
      "loaded",
      "not_attempted",
      "not_attempted",
      "loaded",
    ]);
    expect(
      f.pass.getSnapshot().rows.map((row) => row.evidence.completedAt),
    ).toEqual([
      eodResponse().completedAt,
      null,
      null,
      f.interimPacket.evidence.generation.completedAt,
    ]);
  });
  it("runs all four independently and accepts available empty Filings", async () => {
    const f = await fixture();
    f.readFilings.mockResolvedValue(filingsResponse(0));
    await f.pass.start(prepare(f, ["interim", "filings", "annual", "eod"]));
    expect(f.pass.getSnapshot().rows.map((row) => row.disposition)).toEqual([
      "loaded",
      "loaded",
      "loaded",
      "loaded",
    ]);
    expect(f.readPrice.mock.invocationCallOrder[0]).toBeLessThan(
      f.readAnnual.mock.invocationCallOrder[0]!,
    );
    expect(f.readAnnual.mock.invocationCallOrder[0]).toBeLessThan(
      f.readFilings.mock.invocationCallOrder[0]!,
    );
    expect(f.readFilings.mock.invocationCallOrder[0]).toBeLessThan(
      f.readInterim.mock.invocationCallOrder[0]!,
    );
  });
  it.each([[], ["unknown"], ["eod", "eod"], null])(
    "refuses malformed declared names %j without reads",
    async (names) => {
      const f = await fixture();
      const invalid = names as readonly CompanySnapshotLoadSource[];
      expect(f.pass.prepare(eodSelection, admitted, invalid)).toBeNull();
      await f.loader.startReviewed(eodSelection, admitted, invalid);
      noReads(f);
    },
  );
  it("rejects forged, replaced and replayed handles", async () => {
    const f = await fixture();
    const first = prepare(f, ["interim"]);
    await f.pass.start({ ...first });
    noReads(f);
    const second = prepare(f, ["interim"]);
    await f.pass.start(first);
    noReads(f);
    await f.pass.start(second);
    await f.pass.start(second);
    expect(f.readInterim).toHaveBeenCalledTimes(1);
  });
  it("consumes the handle before synchronous start notifications", async () => {
    const f = await fixture();
    const handle = prepare(f, ["interim"]);
    f.pass.subscribe(() => {
      if (f.pass.getSnapshot().phase === "running") void f.pass.start(handle);
    });
    await f.pass.start(handle);
    expect(f.readInterim).toHaveBeenCalledTimes(1);
  });
  it.each(["price", "annual", "filings", "interim"] as const)(
    "retires preview on any exact %s state change, including out and back",
    async (name) => {
      const f = await fixture();
      const handle = prepare(f, ["interim"]);
      f[name].open({ ...eodSelection, origin: "route" });
      f[name].open(eodSelection);
      await f.pass.start(handle);
      noReads(f);
      expect(f.pass.getSnapshot().phase).toBe("invalidated");
    },
  );
  it("retires an out-and-back staged Price range without refreshing retained data", async () => {
    const f = await fixture();
    f.price.open(eodSelection);
    const handle = prepare(f, ["interim"]);
    f.price.selectRange("1y");
    f.price.selectRange("1m");
    await f.pass.start(handle);
    noReads(f);
  });
  it.each(["visit", "session", "catalog"])(
    "retires a refused %s closure permanently after reconciliation",
    async () => {
      const f = await fixture();
      let current = true;
      const handle = f.pass.prepare(eodSelection, () => current, ["interim"])!;
      current = false;
      f.pass.reconcile();
      current = true;
      f.pass.reconcile();
      await f.pass.start(handle);
      noReads(f);
    },
  );
  it("captures the full mutable selection and rejects its changed origin", async () => {
    const f = await fixture();
    const selection = { ...eodSelection, listing: { ...eodSelection.listing } };
    const handle = f.pass.prepare(selection, admitted, ["interim"])!;
    selection.origin = "route";
    await f.pass.start(handle);
    noReads(f);
  });
  it("retains old-range and refused packets with their original clocks", async () => {
    const f = await fixture();
    f.price.open(eodSelection);
    await f.price.load();
    f.price.selectRange("1y");
    f.annual.open(eodSelection);
    f.readAnnual.mockResolvedValue(
      await annualReportPacket("left", { mode: "source-unavailable" }),
    );
    await f.annual.load();
    const oldPrice = f.price.getSnapshot().response,
      oldAnnual = f.annual.getSnapshot().response;
    f.readPrice.mockClear();
    f.readAnnual.mockClear();
    await f.pass.start(prepare(f, ["eod", "annual", "interim"]));
    expect(f.price.getSnapshot().response).toBe(oldPrice);
    expect(f.annual.getSnapshot().response).toBe(oldAnnual);
    expect(f.readPrice).not.toHaveBeenCalled();
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.pass.getSnapshot().rows.map((row) => row.disposition)).toEqual([
      "retained",
      "retained",
      "not_attempted",
      "loaded",
    ]);
    expect(f.pass.getSnapshot().rows[0]!.evidence.completedAt).toBe(
      oldPrice!.completedAt,
    );
    expect(f.pass.getSnapshot().rows[1]!.evidence.completedAt).toBe(
      oldAnnual!.evidence.generation.completedAt,
    );
  });
  it("skips unsupported sources without opening or requesting them", async () => {
    const f = await fixture(false);
    await f.pass.start(prepare(f));
    noReads(f);
    expect(f.pass.getSnapshot().rows.map((row) => row.disposition)).toEqual([
      "unsupported",
      "unsupported",
      "unsupported",
      "unsupported",
    ]);
    for (const model of [f.price, f.annual, f.filings, f.interim])
      expect(model.getSnapshot().selection).toBeNull();
  });
  it("stops after a failure and leaves remaining sources unattempted", async () => {
    const f = await fixture();
    f.readAnnual.mockRejectedValue(new TrialApiError("unavailable"));
    await f.pass.start(prepare(f));
    expect(f.pass.getSnapshot().rows.map((row) => row.disposition)).toEqual([
      "loaded",
      "failed",
      "not_attempted",
      "not_attempted",
    ]);
    expect(f.readFilings).not.toHaveBeenCalled();
    expect(f.readInterim).not.toHaveBeenCalled();
  });
  it("stops the shared SEC queue on cooldown and never resumes it", async () => {
    const f = await fixture();
    f.readAnnual.mockRejectedValue(
      new ManagedSecCooldownError(new Date(Date.now() + 60000).toISOString()),
    );
    await f.pass.start(prepare(f));
    f.pass.reconcile();
    expect(f.readAnnual).toHaveBeenCalledTimes(1);
    expect(f.readFilings).not.toHaveBeenCalled();
    expect(f.readInterim).not.toHaveBeenCalled();
    expect(f.pass.getSnapshot().message).toContain("SEC requests are shared");
  });
  it("retains a refused Interim packet with its original completion clock", async () => {
    const f = await fixture();
    const packet = structuredClone(f.interimPacket);
    const unavailable = {
      ...packet.evidence,
      generation: {
        ...packet.evidence.generation,
        sources: {
          ...packet.evidence.generation.sources,
          companyFacts: {
            ...packet.evidence.generation.sources.companyFacts,
            status: "upstream_unavailable" as const,
            fetchedAt: null,
            sha256: null,
            bytes: null,
          },
        },
      },
      facts: {
        ...packet.evidence.facts,
        observations: [],
        scans: packet.evidence.facts.scans.map((scan) => ({
          ...scan,
          scan: {
            status: "source_unavailable" as const,
            absence: null,
            coverage: null,
          },
        })),
      },
    };
    f.readInterim.mockResolvedValue({
      ...packet,
      evidence: await sealFixture(unavailable),
    });
    await f.pass.start(prepare(f, ["interim"]));
    expect(f.interim.getSnapshot().response).not.toBeNull();
    expect(f.pass.getSnapshot().rows[3]).toMatchObject({
      disposition: "failed",
      evidence: { completedAt: packet.evidence.generation.completedAt },
    });
  });
  it.each(["eod", "interim"] as const)(
    "cancels only the owned %s read and fences late settlement",
    async (source) => {
      const f = await fixture();
      const heldPrice =
        deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      const heldInterim =
        deferred<Awaited<ReturnType<ManagedApi["interimReport"]>>>();
      if (source === "eod") f.readPrice.mockReturnValue(heldPrice.promise);
      else f.readInterim.mockReturnValue(heldInterim.promise);
      const pending = f.pass.start(
        prepare(
          f,
          source === "eod" ? ["eod", "annual", "interim"] : ["interim"],
        ),
      );
      const read = source === "eod" ? f.readPrice : f.readInterim;
      expect(read).toHaveBeenCalledTimes(1);
      const signal = read.mock.calls[0]![1];
      f.pass.cancel();
      expect(signal.aborted).toBe(true);
      heldPrice.resolve(eodResponse());
      heldInterim.resolve(f.interimPacket);
      await pending;
      expect(f.pass.getSnapshot().phase).toBe("cancelled");
      expect(
        f.pass.getSnapshot().rows.find((row) => row.id === source)?.disposition,
      ).toBe("cancelled");
      expect(f.readAnnual).not.toHaveBeenCalled();
      expect(
        f[source === "eod" ? "price" : "interim"].getSnapshot().response,
      ).toBeNull();
    },
  );
  it("cancels before transport when the source running notification is reentrant", async () => {
    const f = await fixture();
    f.interim.subscribe(() => {
      if (f.interim.getSnapshot().running) f.pass.cancel();
    });
    await f.pass.start(prepare(f, ["interim"]));
    noReads(f);
  });
  it("does not cancel a legacy operation while idle or while refusing a busy preview", async () => {
    const f = await fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    f.readPrice.mockReturnValue(held.promise);
    const pending = f.loader.start(eodSelection, admitted);
    expect(f.pass.prepare(eodSelection, admitted, ["interim"])).toBeNull();
    f.pass.cancel();
    f.pass.clear();
    f.pass.reconcile();
    expect(f.readPrice.mock.calls[0]![1].aborted).toBe(false);
    held.resolve(eodResponse());
    await pending;
  });
  it("preserves a legacy replacement started during owned cancellation", async () => {
    const f = await fixture();
    const first = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    const second = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    f.readPrice
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const pending = f.pass.start(prepare(f, ["eod", "interim"]));
    const replacement = { pending: Promise.resolve(), started: false };
    f.price.subscribe(() => {
      if (!replacement.started && !f.price.getSnapshot().running) {
        replacement.started = true;
        replacement.pending = f.loader.start(eodSelection, admitted);
      }
    });
    f.pass.cancel();
    expect(f.readPrice.mock.calls[0]![1].aborted).toBe(true);
    expect(f.readPrice.mock.calls[1]![1].aborted).toBe(false);
    f.pass.clear();
    expect(f.readPrice.mock.calls[1]![1].aborted).toBe(false);
    first.resolve(eodResponse());
    await pending;
    second.resolve(eodResponse());
    await replacement.pending;
  });
  it("freezes completed rows and retires them without renewing clocks after a manual refresh", async () => {
    const f = await fixture();
    await f.pass.start(prepare(f, ["eod"]));
    const result = f.pass.getSnapshot().rows;
    f.readPrice.mockResolvedValue(eodResponse("1y"));
    f.price.selectRange("1y");
    await f.price.load();
    expect(f.pass.getSnapshot().phase).toBe("invalidated");
    expect(f.pass.getSnapshot().rows).toBe(result);
    expect(result[0]!.evidence.completedAt).toBe(eodResponse().completedAt);
    expect(Object.isFrozen(result[0]!.evidence)).toBe(true);
  });
  it("rejects a preview whose admission callback clears the pass during Run", async () => {
    const f = await fixture();
    let clear = false;
    const handle = f.pass.prepare(eodSelection, () => {
      if (clear) f.pass.clear();
      return true;
    }, ["interim"])!;
    clear = true;
    await f.pass.start(handle);
    noReads(f);
  });
  it("rejects a forged handle without consuming the owned preview", async () => {
    const f = await fixture();
    const handle = prepare(f, ["interim"]);
    await f.pass.start({} as CompanySourcePassPreview);
    expect(f.pass.getSnapshot().preview).toBe(handle);
    await f.pass.start(handle);
    expect(f.readInterim).toHaveBeenCalledTimes(1);
  });
  it("keeps retained and unsupported outcomes visible after an earlier source failure", async () => {
    const f = await fixture();
    f.interim.open(eodSelection);
    await f.interim.load();
    const response = f.interim.getSnapshot().response;
    f.readInterim.mockClear();
    f.readPrice.mockRejectedValue(new TrialApiError("unavailable"));
    await f.pass.start(prepare(f));
    expect(f.pass.getSnapshot().rows[3]).toMatchObject({
      disposition: "retained",
      evidence: { completedAt: response!.evidence.generation.completedAt },
    });
    expect(f.readInterim).not.toHaveBeenCalled();
  });
  it("does not publish a preview after its admission callback clears the context", async () => {
    const f = await fixture();
    expect(
      f.pass.prepare(eodSelection, () => {
        f.pass.clear();
        return true;
      }, ["interim"]),
    ).toBeNull();
    expect(f.pass.getSnapshot().phase).toBe("idle");
    noReads(f);
  });
  it("cancels a Run announcement before the loader can start", async () => {
    const f = await fixture();
    const handle = prepare(f, ["interim"]);
    f.pass.subscribe(() => {
      if (f.pass.getSnapshot().phase === "running") f.pass.clear();
    });
    await f.pass.start(handle);
    noReads(f);
    expect(f.loader.getSnapshot().message).toBe("");
  });
  it("preserves replacement work started from a terminal loader listener before pass settlement", async () => {
    const f = await fixture();
    const replacement =
      deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    f.readAnnual.mockReturnValue(replacement.promise);
    const next = { started: false, pending: Promise.resolve() };
    f.loader.subscribe(() => {
      if (
        next.started ||
        f.loader.getSnapshot().running ||
        !f.loader.getSnapshot().message.includes("finished")
      )
        return;
      next.started = true;
      next.pending = f.loader.start(eodSelection, admitted);
      f.pass.cancel();
    });
    await f.pass.start(prepare(f, ["eod"]));
    expect(f.readAnnual).toHaveBeenCalledTimes(1);
    expect(f.readAnnual.mock.calls[0]![1].aborted).toBe(false);
    expect(f.pass.getSnapshot().rows[0]!.disposition).toBe("loaded");
    replacement.resolve(f.annualPacket);
    await next.pending;
  });
  it("protects replacement work and original result clocks when an earlier loader listener reenters", async () => {
    const f = await fixture();
    const replacement =
      deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    f.readPrice
      .mockResolvedValueOnce(eodResponse())
      .mockReturnValueOnce(replacement.promise);
    const next = { started: false, pending: Promise.resolve() };
    f.loader.subscribe(() => {
      if (
        next.started ||
        f.loader.getSnapshot().running ||
        !f.loader.getSnapshot().message.includes("finished")
      )
        return;
      next.started = true;
      f.price.open(eodSelection);
      next.pending = f.loader.start(eodSelection, admitted);
      pass.cancel();
    });
    const pass = new ManagedCompanySourcePass(
      f.loader,
      f.price,
      f.annual,
      f.filings,
      f.interim,
    );
    const handle = pass.prepare(eodSelection, admitted, ["eod"])!;
    await pass.start(handle);
    expect(f.readPrice).toHaveBeenCalledTimes(2);
    expect(f.readPrice.mock.calls[1]![1].aborted).toBe(false);
    expect(pass.getSnapshot().rows[0]).toMatchObject({
      disposition: "loaded",
      evidence: { completedAt: eodResponse().completedAt },
    });
    replacement.resolve(eodResponse());
    await next.pending;
  });
  it.each(["cancel", "clear"] as const)(
    "preserves a new reviewed pass prepared or started during %s callbacks",
    async (action) => {
      for (const startReplacement of [false, true]) {
        const f = await fixture();
        const first = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
        const second =
          deferred<Awaited<ReturnType<ManagedApi["interimReport"]>>>();
        f.readPrice.mockReturnValue(first.promise);
        f.readInterim.mockReturnValue(second.promise);
        const pending = f.pass.start(prepare(f, ["eod", "annual"]));
        const next = {
          started: false,
          handle: null as CompanySourcePassPreview | null,
          pending: Promise.resolve(),
        };
        const original = { outcomes: f.loader.getSnapshot().outcomes };
        f.loader.subscribe(() => {
          const load = f.loader.getSnapshot();
          if (
            next.started ||
            load.running ||
            !load.message.includes("cancelled")
          )
            return;
          next.started = true;
          original.outcomes = load.outcomes;
          next.handle = f.pass.prepare(eodSelection, admitted, ["interim"]);
          if (startReplacement) next.pending = f.pass.start(next.handle!);
        });
        f.pass[action]();
        expect(next.handle).not.toBeNull();
        expect(f.pass.getSnapshot().phase).toBe(
          startReplacement ? "running" : "preview",
        );
        expect(f.pass.getSnapshot().preview).toBe(
          startReplacement ? null : next.handle,
        );
        expect(f.readPrice.mock.calls[0]![1].aborted).toBe(true);
        expect(original.outcomes.eod).toBe("cancelled");
        expect(original.outcomes.annual).toBe("not_attempted");
        expect(Object.isFrozen(original.outcomes)).toBe(true);
        if (startReplacement)
          expect(f.readInterim.mock.calls[0]![1].aborted).toBe(false);
        first.resolve(eodResponse());
        await pending;
        expect(f.pass.getSnapshot().phase).toBe(
          startReplacement ? "running" : "preview",
        );
        if (!startReplacement) next.pending = f.pass.start(next.handle!);
        second.resolve(f.interimPacket);
        await next.pending;
        expect(f.pass.getSnapshot().phase).toBe("finished");
        expect(f.readPrice).toHaveBeenCalledTimes(1);
        expect(f.readAnnual).not.toHaveBeenCalled();
        expect(f.readInterim).toHaveBeenCalledTimes(1);
      }
    },
  );
  it("keeps preview classifications when cancelling Run before the loader starts", async () => {
    const f = await fixture();
    await f.pass.start(prepare(f, ["eod"]));
    const handle = prepare(f, ["eod", "interim"]);
    f.pass.subscribe(() => {
      if (f.pass.getSnapshot().phase === "running") f.pass.cancel();
    });
    await f.pass.start(handle);
    expect(f.readPrice).toHaveBeenCalledTimes(1);
    expect(f.readInterim).not.toHaveBeenCalled();
    expect(f.pass.getSnapshot().phase).toBe("cancelled");
    expect(f.pass.getSnapshot().rows.map((row) => row.disposition)).toEqual([
      "retained",
      "not_attempted",
      "not_attempted",
      "not_attempted",
    ]);
    expect(f.pass.getSnapshot().rows[0]!.evidence.completedAt).toBe(
      eodResponse().completedAt,
    );
  });
});
