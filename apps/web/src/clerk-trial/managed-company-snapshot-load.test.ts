import { describe, expect, it, vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedSecCooldownError,
} from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { ManagedSecAccess } from "./managed-sec-access";
import { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { annualReportPacket } from "./test-annual-report-fixture";
import {
  createManagedResearchCoverageFixture,
  inventedManagedResearchCoverage,
} from "./test-managed-research-coverage-fixture";
import type { ManagedResearchSelection } from "./managed-research-selection";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { resolve, promise };
}
async function fixture(covered = true) {
  const packet = await annualReportPacket();
  const readPrice = vi
    .fn<ManagedApi["eodHistory"]>()
    .mockResolvedValue(eodResponse());
  const readAnnual = vi
    .fn<ManagedApi["annualReport"]>()
    .mockResolvedValue(packet);
  const readFilings = vi
    .fn<ManagedApi["recentFilings"]>()
    .mockResolvedValue(filingsResponse());
  const access = new ManagedSecAccess();
  const coverage = covered
    ? inventedManagedResearchCoverage
    : createManagedResearchCoverageFixture([]);
  const price = new ManagedEodHistory(
    readPrice,
    vi.fn(),
    undefined,
    covered ? [eodSelection.listing] : [],
  );
  const annual = new ManagedAnnualReport(readAnnual, vi.fn(), access, {
    coverage,
  });
  const filings = new ManagedCompanyFilings(readFilings, vi.fn(), access, {
    coverage,
  });
  const model = new ManagedCompanySnapshotLoad(price, annual, filings);
  return {
    model,
    price,
    annual,
    filings,
    readPrice,
    readAnnual,
    readFilings,
    access,
    packet,
  };
}
function noReads(f: Awaited<ReturnType<typeof fixture>>) {
  expect(f.readPrice).not.toHaveBeenCalled();
  expect(f.readAnnual).not.toHaveBeenCalled();
  expect(f.readFilings).not.toHaveBeenCalled();
}
const admitted = () => true;

describe("explicit missing company sources", () => {
  it("owns one stable observable state and sequentially requests Price, Annual then Filings once", async () => {
    const f = await fixture();
    const price = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    const annual = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    const filings =
      deferred<Awaited<ReturnType<ManagedApi["recentFilings"]>>>();
    f.readPrice.mockReturnValue(price.promise);
    f.readAnnual.mockReturnValue(annual.promise);
    f.readFilings.mockReturnValue(filings.promise);
    const changed = vi.fn();
    const unsubscribe = f.model.subscribe(changed);
    const initial = f.model.getSnapshot();
    expect(initial).toBe(f.model.getSnapshot());
    noReads(f);
    const pending = f.model.start(eodSelection, admitted);
    await f.model.start(eodSelection, admitted);
    expect(f.readPrice).toHaveBeenCalledTimes(1);
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.model.getSnapshot()).toMatchObject({
      running: true,
      active: "eod",
    });
    price.resolve(eodResponse());
    await vi.waitFor(() => expect(f.readAnnual).toHaveBeenCalledTimes(1));
    expect(f.readFilings).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().active).toBe("annual");
    annual.resolve(f.packet);
    await vi.waitFor(() => expect(f.readFilings).toHaveBeenCalledTimes(1));
    expect(f.model.getSnapshot().active).toBe("filings");
    filings.resolve(filingsResponse(0));
    await pending;
    expect(f.model.getSnapshot()).toMatchObject({
      running: false,
      active: null,
    });
    expect(f.price.getSnapshot().response?.completedAt).toBe(
      eodResponse().completedAt,
    );
    expect(f.annual.getSnapshot().response).toBe(f.packet);
    expect(f.filings.getSnapshot().response?.issuer.filings).toHaveLength(0);
    const notices = changed.mock.calls.length;
    unsubscribe();
    f.model.clear();
    expect(changed).toHaveBeenCalledTimes(notices);
  });
  it("keeps all admitted inherited retained responses and source dates without refreshing", async () => {
    const f = await fixture();
    const selected: ManagedResearchSelection = {
      ...eodSelection,
      origin: "watchlist",
      cik: null,
    };
    f.price.open(selected, { response: eodResponse(), showingPrevious: true });
    f.annual.open(selected, { response: f.packet, showingPrevious: true });
    f.filings.open(selected, {
      response: filingsResponse(),
      showingPrevious: true,
    });
    await vi.waitFor(() =>
      expect(f.annual.getSnapshot().checkingSeed).toBe(false),
    );
    const previous = [
      f.price.getSnapshot(),
      f.annual.getSnapshot(),
      f.filings.getSnapshot(),
    ];
    await f.model.start(selected, admitted);
    noReads(f);
    expect([
      f.price.getSnapshot(),
      f.annual.getSnapshot(),
      f.filings.getSnapshot(),
    ]).toEqual(previous);
    expect(f.model.getSnapshot().message).toContain(
      "No eligible missing sources",
    );
  });
  it("skips unsupported sources without opening them or making requests", async () => {
    const f = await fixture(false);
    await f.model.start(eodSelection, admitted);
    noReads(f);
    for (const source of [f.price, f.annual, f.filings])
      expect(source.getSnapshot().selection).toBeNull();
    expect(f.model.getSnapshot().running).toBe(false);
  });
  it("keeps the staged Price range and refuses an already active source", async () => {
    const f = await fixture();
    f.price.open(eodSelection);
    f.price.selectRange("1y");
    f.readPrice.mockResolvedValue(eodResponse("1y"));
    await f.model.start(eodSelection, admitted);
    expect(f.readPrice.mock.calls[0]![0].range).toBe("1y");
    expect(f.price.getSnapshot().selectedRange).toBe("1y");
    const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    f.readPrice.mockReturnValue(held.promise);
    const manual = f.price.load();
    const count = f.readPrice.mock.calls.length;
    await f.model.start(eodSelection, admitted);
    expect(f.readPrice).toHaveBeenCalledTimes(count);
    expect(f.readPrice.mock.calls.at(-1)![1].aborted).toBe(false);
    f.model.cancel();
    expect(f.readPrice.mock.calls.at(-1)![1].aborted).toBe(false);
    held.resolve(eodResponse("1y"));
    await manual;
  });
  it("does not start Price while an inherited Annual seed is still being checked", async () => {
    const f = await fixture();
    const selected: ManagedResearchSelection = {
      ...eodSelection,
      origin: "watchlist",
      cik: null,
    };
    f.annual.open(selected, { response: f.packet, showingPrevious: false });
    expect(f.annual.getSnapshot().checkingSeed).toBe(true);
    await f.model.start(selected, admitted);
    noReads(f);
    await vi.waitFor(() =>
      expect(f.annual.getSnapshot().checkingSeed).toBe(false),
    );
  });
  it.each(["origin", "cik", "catalog", "shareClass"] as const)(
    "refuses an existing selection with changed %s instead of replacing it",
    async (field) => {
      const f = await fixture();
      const foreign = { ...eodSelection, listing: { ...eodSelection.listing } };
      if (field === "origin") foreign.origin = "watchlist";
      if (field === "cik") foreign.cik = "0000000002";
      if (field === "catalog")
        foreign.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      if (field === "shareClass") foreign.listing.shareClassId = "other-class";
      f.price.open(foreign);
      const before = f.price.getSnapshot();
      await f.model.start(eodSelection, admitted);
      noReads(f);
      expect(f.price.getSnapshot()).toBe(before);
    },
  );
});

describe("partial source outcomes", () => {
  it.each([
    new TrialApiError("unavailable"),
    new ManagedCatalogChangedError(),
    new ManagedEodCooldownError(new Date(Date.now() + 60_000).toISOString()),
  ])(
    "stops after a failed, changed-catalog or deferred Price request",
    async (error) => {
      const f = await fixture();
      f.readPrice.mockRejectedValue(error);
      await f.model.start(eodSelection, admitted);
      expect(f.readPrice).toHaveBeenCalledTimes(1);
      expect(f.readAnnual).not.toHaveBeenCalled();
      expect(f.readFilings).not.toHaveBeenCalled();
      expect(f.model.getSnapshot().running).toBe(false);
      expect(f.model.getSnapshot().message).toContain(
        f.price.getSnapshot().message,
      );
    },
  );
  it("stops on SEC cooldown even though the model error flag is false and never resumes itself", async () => {
    const f = await fixture();
    f.readAnnual.mockRejectedValue(
      new ManagedSecCooldownError(new Date(Date.now() + 60_000).toISOString()),
    );
    await f.model.start(eodSelection, admitted);
    expect(f.price.getSnapshot().response).not.toBeNull();
    expect(f.annual.getSnapshot()).toMatchObject({
      response: null,
      error: false,
      running: false,
    });
    expect(f.model.getSnapshot().message).toContain("SEC requests are shared");
    expect(f.readFilings).not.toHaveBeenCalled();
    await f.model.start(eodSelection, admitted);
    expect(f.readPrice).toHaveBeenCalledTimes(1);
    expect(f.readAnnual).toHaveBeenCalledTimes(1);
    expect(f.readFilings).not.toHaveBeenCalled();
  });
  it("stops on an admitted Annual provider refusal without discarding its evidence", async () => {
    const f = await fixture();
    const refused = await annualReportPacket("left", {
      mode: "source-unavailable",
    });
    f.readAnnual.mockResolvedValue(refused);
    await f.model.start(eodSelection, admitted);
    expect(f.annual.getSnapshot()).toMatchObject({
      response: refused,
      error: false,
      running: false,
    });
    expect(f.readFilings).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().message).toContain("Annual stopped");
    expect(f.model.getSnapshot().message).toContain("source is unavailable");
  });
  it("continues past an Annual packet with individually unavailable financial cells", async () => {
    const f = await fixture();
    f.readAnnual.mockResolvedValue(
      await annualReportPacket("left", { mode: "income-invalid" }),
    );
    await f.model.start(eodSelection, admitted);
    expect(f.readFilings).toHaveBeenCalledTimes(1);
    expect(f.model.getSnapshot().message).toContain("finished");
  });
  it("keeps a refused Filings packet separate from successful empty filings", async () => {
    const f = await fixture();
    f.readFilings.mockResolvedValue(filingsResponse(0, "rate_limited"));
    await f.model.start(eodSelection, admitted);
    expect(f.filings.getSnapshot().response?.issuer.status).toBe(
      "rate_limited",
    );
    expect(f.model.getSnapshot().message).toContain("Filings stopped");
    expect(f.model.getSnapshot().message).not.toContain("finished");
  });
});

describe("snapshot load ownership", () => {
  it.each(["cancel", "clear"] as const)(
    "%s stops the owned active request and fences a late response and remaining queue",
    async (action) => {
      const f = await fixture();
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      f.readPrice.mockReturnValue(held.promise);
      const pending = f.model.start(eodSelection, admitted);
      f.model[action]();
      expect(f.readPrice.mock.calls[0]![1].aborted).toBe(true);
      expect(f.model.getSnapshot()).toMatchObject({
        running: false,
        active: null,
      });
      held.resolve(eodResponse());
      await pending;
      expect(f.price.getSnapshot().response).toBeNull();
      expect(f.readAnnual).not.toHaveBeenCalled();
      expect(f.readFilings).not.toHaveBeenCalled();
    },
  );
  it("does not cancel a manual replacement after its owned request was cancelled", async () => {
    const f = await fixture();
    const own = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    const other = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    f.readPrice
      .mockReturnValueOnce(own.promise)
      .mockReturnValueOnce(other.promise);
    const pending = f.model.start(eodSelection, admitted);
    f.price.cancel();
    const manual = f.price.load();
    f.model.cancel();
    expect(f.readPrice.mock.calls[1]![1].aborted).toBe(false);
    own.resolve(eodResponse());
    await pending;
    expect(f.readAnnual).not.toHaveBeenCalled();
    other.resolve(eodResponse());
    await manual;
    expect(f.price.getSnapshot().response).not.toBeNull();
  });
  it("withdraws active work when another source changes selection", async () => {
    const f = await fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    f.readPrice.mockReturnValue(held.promise);
    const pending = f.model.start(eodSelection, admitted);
    f.annual.open({ ...eodSelection, origin: "route" });
    expect(f.readPrice.mock.calls[0]![1].aborted).toBe(true);
    held.resolve(eodResponse());
    await pending;
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });
  it("rechecks admission after awaits and cancels no remaining source", async () => {
    const f = await fixture();
    let current = true;
    const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
    f.readPrice.mockReturnValue(held.promise);
    const pending = f.model.start(eodSelection, () => current);
    current = false;
    held.resolve(eodResponse());
    await pending;
    expect(f.model.getSnapshot().running).toBe(false);
    expect(f.readAnnual).not.toHaveBeenCalled();
    expect(f.readFilings).not.toHaveBeenCalled();
  });
  it.each(["cancel", "admission", "selection"] as const)(
    "fences reentrant %s before the active source request",
    async (mode) => {
      const f = await fixture();
      let current = true;
      const unsubscribe = f.model.subscribe(() => {
        if (f.model.getSnapshot().active !== "eod") return;
        if (mode === "cancel") f.model.cancel();
        if (mode === "admission") current = false;
        if (mode === "selection")
          f.price.open({ ...eodSelection, origin: "route" });
      });
      await f.model.start(eodSelection, () => current);
      noReads(f);
      expect(f.model.getSnapshot().running).toBe(false);
      unsubscribe();
    },
  );
  it("cancels during a model's synchronous loading notification before transport starts", async () => {
    const f = await fixture();
    f.price.subscribe(() => {
      if (f.price.getSnapshot().running) f.model.cancel();
    });
    await f.model.start(eodSelection, admitted);
    noReads(f);
    expect(f.model.getSnapshot().running).toBe(false);
  });
  it("does not notify a later listener from a reentrantly cancelled operation", async () => {
    const f = await fixture();
    f.model.subscribe(() => {
      if (f.model.getSnapshot().running) f.model.cancel();
    });
    const later = vi.fn();
    f.model.subscribe(later);
    await f.model.start(eodSelection, admitted);
    expect(later).toHaveBeenCalledTimes(1);
    noReads(f);
  });
});

it("ends ownership before a synchronous listener starts a replacement at natural completion", async () => {
  const f = await fixture();
  const manualResponse =
    deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
  f.readPrice
    .mockResolvedValueOnce(eodResponse())
    .mockReturnValueOnce(manualResponse.promise);
  const replacement = { started: false, pending: Promise.resolve() };
  f.price.subscribe(() => {
    const state = f.price.getSnapshot();
    if (replacement.started || state.running || state.response === null) return;
    replacement.started = true;
    replacement.pending = f.price.load();
    f.model.cancel();
  });
  await f.model.start(eodSelection, admitted);
  expect(f.readPrice).toHaveBeenCalledTimes(2);
  expect(f.readPrice.mock.calls[1]![1].aborted).toBe(false);
  expect(f.readAnnual).not.toHaveBeenCalled();
  manualResponse.resolve(eodResponse());
  await replacement.pending;
});

it("preserves a valid new coordinator run started reentrantly during owned cancellation", async () => {
  const f = await fixture();
  const first = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
  const second = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
  f.readPrice
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const original = f.model.start(eodSelection, admitted);
  const replacement = { started: false, pending: Promise.resolve() };
  f.price.subscribe(() => {
    if (replacement.started || f.price.getSnapshot().running) return;
    replacement.started = true;
    replacement.pending = f.model.start(eodSelection, admitted);
  });
  f.model.cancel();
  expect(f.model.getSnapshot()).toMatchObject({ running: true, active: "eod" });
  expect(f.readPrice).toHaveBeenCalledTimes(2);
  expect(f.readPrice.mock.calls[0]![1].aborted).toBe(true);
  expect(f.readPrice.mock.calls[1]![1].aborted).toBe(false);
  first.resolve(eodResponse());
  await original;
  expect(f.model.getSnapshot().running).toBe(true);
  second.resolve(eodResponse());
  await replacement.pending;
  expect(f.model.getSnapshot().message).toContain("finished");
});

it("withdraws the group when Price range changes during its completion notification", async () => {
  const f = await fixture();
  f.price.subscribe(() => {
    const state = f.price.getSnapshot();
    if (!state.running && state.response !== null) f.price.selectRange("1y");
  });
  await f.model.start(eodSelection, admitted);
  expect(f.price.getSnapshot().response?.range).toBe("1m");
  expect(f.price.getSnapshot().selectedRange).toBe("1y");
  expect(f.readAnnual).not.toHaveBeenCalled();
});

it("rechecks admission at the synchronous model start before its transport call", async () => {
  const f = await fixture();
  await f.model.start(eodSelection, () => !f.price.getSnapshot().running);
  noReads(f);
  expect(f.price.getSnapshot().running).toBe(false);
  expect(f.model.getSnapshot().running).toBe(false);
});

it.each(["annual", "filings"] as const)(
  "cancels only its pending %s read and does not use its late response",
  async (source) => {
    const f = await fixture();
    const annual = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    const filings =
      deferred<Awaited<ReturnType<ManagedApi["recentFilings"]>>>();
    if (source === "annual") f.readAnnual.mockReturnValue(annual.promise);
    else f.readFilings.mockReturnValue(filings.promise);
    const pending = f.model.start(eodSelection, admitted);
    await vi.waitFor(() => expect(f.model.getSnapshot().active).toBe(source));
    const signal =
      source === "annual"
        ? f.readAnnual.mock.calls[0]![1]
        : f.readFilings.mock.calls[0]![1];
    f.model.cancel();
    expect(signal.aborted).toBe(true);
    expect(f.price.getSnapshot().response).not.toBeNull();
    annual.resolve(f.packet);
    filings.resolve(filingsResponse());
    await pending;
    expect(f[source].getSnapshot().response).toBeNull();
    if (source === "annual") expect(f.readFilings).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().running).toBe(false);
  },
);
