import { afterEach, describe, expect, it, vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import {
  ManagedCatalogChangedError,
  ManagedInterimReportError,
} from "./managed-api";
import { TrialApiError } from "./api";
import { ManagedInterimReport } from "./managed-interim-report";
import { buildInterimFixture } from "../../android-tests/managed-workspace/interim-report-packet";
import { createManagedResearchCoverageFixture } from "./test-managed-research-coverage-fixture";
import type { ManagedResearchSelection } from "./managed-research-selection";
afterEach(() => vi.restoreAllMocks());
async function fixture() {
  const packet = await buildInterimFixture();
  const s = packet.security;
  const selection: ManagedResearchSelection = {
    catalogSnapshotSha256: packet.catalogSnapshotSha256,
    cik: s.cik,
    origin: "watchlist",
    listing: {
      ...s,
      instrumentType: "common_stock",
      securityId: "security:c",
      shareClassId: "class:c",
      shareClassName: "Class C",
    },
  };
  const coverage = createManagedResearchCoverageFixture(
    [{ listing: selection.listing, cik: s.cik }],
    packet.catalogSnapshotSha256,
  );
  const read = vi.fn<ManagedApi["interimReport"]>().mockResolvedValue(packet),
    readError = vi.fn();
  const model = new ManagedInterimReport(read, readError, undefined, {
    coverage,
    interimIssuers: [s.cik],
  });
  return { packet, selection, read, readError, model };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe("explicit interim report visit", () => {
  it("opens without a request and admits all32 concepts with distinct same-end periods", async () => {
    const f = await fixture();
    f.model.open(f.selection);
    expect(f.read).not.toHaveBeenCalled();
    await f.model.load();
    const state = f.model.getSnapshot();
    expect(state.response).toEqual(f.packet);
    expect(
      state.view?.statements.statements.flatMap((s) => s.rows),
    ).toHaveLength(32);
    const revenue = state.view?.statements.statements[0]?.rows[0];
    expect(revenue?.cells.map((c) => c.period.startDate)).toEqual([
      "2026-04-01",
      "2026-01-01",
    ]);
    expect(state.running).toBe(false);
  });
  it.each([
    new ManagedInterimReportError("request_timeout"),
    new TrialApiError("unavailable"),
  ])(
    "retains exact old clocks only for a transient refresh failure %s",
    async (error) => {
      const f = await fixture();
      f.model.open(f.selection);
      await f.model.load();
      const old = f.model.getSnapshot();
      f.read.mockRejectedValueOnce(error);
      await f.model.load();
      expect(f.model.getSnapshot()).toMatchObject({
        response: old.response,
        view: old.view,
        showingPrevious: true,
        error: true,
        running: false,
      });
      expect(f.model.getSnapshot().response?.evidence.generation).toBe(
        old.response!.evidence.generation,
      );
    },
  );
  it.each([
    new TrialApiError("invalid_response"),
    new ManagedCatalogChangedError(),
    new ManagedInterimReportError("not_configured"),
  ])("clears old results for fail-closed error %s", async (error) => {
    const f = await fixture();
    f.model.open(f.selection);
    await f.model.load();
    f.read.mockRejectedValueOnce(error);
    await f.model.load();
    expect(f.model.getSnapshot().response).toBeNull();
    expect(f.model.getSnapshot().view).toBeNull();
    expect(f.model.getSnapshot().error).toBe(true);
  });
  it("refuses changed share-class identity despite an otherwise valid graph", async () => {
    const f = await fixture();
    f.read.mockResolvedValueOnce({
      ...f.packet,
      security: { ...f.packet.security, securityName: "Other share class" },
    });
    f.model.open(f.selection);
    await f.model.load();
    expect(f.model.getSnapshot().response).toBeNull();
    expect(f.model.getSnapshot().error).toBe(true);
  });
  it("fences old completion after cancel then a new load", async () => {
    const f = await fixture(),
      old = deferred<typeof f.packet>();
    f.read.mockReturnValueOnce(old.promise);
    f.model.open(f.selection);
    const pending = f.model.load();
    const signal = f.read.mock.calls[0]![1];
    f.model.cancel();
    expect(signal.aborted).toBe(true);
    await f.model.load();
    const current = f.model.getSnapshot();
    old.resolve(f.packet);
    await pending;
    expect(f.model.getSnapshot()).toBe(current);
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it.each(["close", "retire"] as const)(
    "fences late completion after %s",
    async (action) => {
      const f = await fixture(),
        held = deferred<typeof f.packet>();
      f.read.mockReturnValueOnce(held.promise);
      f.model.open(f.selection);
      const pending = f.model.load();
      f.model[action]();
      const closed = f.model.getSnapshot();
      held.resolve(f.packet);
      await pending;
      expect(f.model.getSnapshot()).toBe(closed);
      expect(closed.response).toBeNull();
    },
  );
  it("prevents a loading listener from dispatching after it closes the visit", async () => {
    const f = await fixture();
    f.model.open(f.selection);
    f.model.subscribe(() => {
      if (f.model.getSnapshot().running) f.model.close();
    });
    await f.model.load();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.model.getSnapshot().selection).toBeNull();
  });
  it("keeps a newer visit when an accepted-response listener opens it", async () => {
    const f = await fixture();
    f.model.open(f.selection);
    let changed = false;
    f.model.subscribe(() => {
      if (f.model.getSnapshot().response && !changed) {
        changed = true;
        f.model.open({ ...f.selection, origin: "route" });
      }
    });
    await f.model.load();
    expect(f.model.getSnapshot().selection?.origin).toBe("route");
    expect(f.model.getSnapshot().response).toBeNull();
  });
  it("retires on session access failure and cannot reopen", async () => {
    const f = await fixture();
    f.read.mockRejectedValueOnce(new TrialApiError("unauthenticated"));
    f.model.open(f.selection);
    await f.model.load();
    expect(f.readError).toHaveBeenCalledOnce();
    f.model.open(f.selection);
    await f.model.load();
    expect(f.read).toHaveBeenCalledOnce();
    expect(f.model.getSnapshot().selection).toBeNull();
  });
});
