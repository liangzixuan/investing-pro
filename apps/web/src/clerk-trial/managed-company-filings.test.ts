import { ManagedAnnualReport } from "./managed-annual-report";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseManagedSecFilingsResponse,
  type ManagedSecFilingsResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
  ManagedSecFilingsError,
  type ManagedApi,
} from "./managed-api";
import {
  captureManagedCompanyFilingsSeed,
  ManagedCompanyFilings,
} from "./managed-company-filings";
import { ManagedSecAccess } from "./managed-sec-access";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture(access = new ManagedSecAccess()) {
  const read = vi.fn<ManagedApi["recentFilings"]>();
  const readError = vi.fn();
  const model = new ManagedCompanyFilings(read, readError, access, {
    compareRefresh: true,
  });
  model.open(filingsSelection);
  return { read, readError, model, access };
}
afterEach(() => vi.useRealTimers());
describe("explicit company SEC filings", () => {
  it("admits invented packets and makes only the fixed identity request on explicit load", async () => {
    const { model, read } = fixture();
    const wire = filingsResponse();
    read.mockResolvedValue(wire);
    expect(read).not.toHaveBeenCalled();
    await model.load();
    const request = read.mock.calls[0]![0];
    expect(request).toEqual({
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: filingsSelection.catalogSnapshotSha256,
      listingId: "listing-zero",
      symbol: "ZERO",
    });
    expect(parseManagedSecFilingsResponse(wire, request)).not.toBeNull();
    expect(model.getSnapshot().response).toEqual(wire);
    expect(model.getSnapshot().response).not.toBe(wire);
    expect(Object.isFrozen(model.getSnapshot().response?.issuer.filings)).toBe(
      true,
    );
    expect(model.getSnapshot()).toMatchObject({
      running: false,
      showingPrevious: false,
      error: false,
    });
  });
  it("retains the original packet during refresh, cancellation and late completion without another read", async () => {
    const { model, read } = fixture();
    read.mockResolvedValueOnce(filingsResponse());
    await model.load();
    const previous = model.getSnapshot().response;
    const held = deferred<ManagedSecFilingsResponseDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    await model.load();
    expect(read).toHaveBeenCalledTimes(2);
    expect(model.getSnapshot()).toMatchObject({
      response: previous,
      running: true,
      showingPrevious: true,
    });
    model.cancel();
    expect(read.mock.calls[1]![1].aborted).toBe(true);
    held.resolve(filingsResponse(0));
    await pending;
    expect(model.getSnapshot()).toMatchObject({
      response: previous,
      running: false,
      showingPrevious: true,
    });
  });
  it.each(["rate_limited", "upstream_unavailable"] as const)(
    "retains previous source dates after a checked %s attempt without inventing a cooldown",
    async (status) => {
      const { model, read, access } = fixture();
      read.mockResolvedValueOnce(filingsResponse());
      await model.load();
      const previous = model.getSnapshot().response;
      const failed = filingsResponse(0, status);
      read.mockResolvedValueOnce(failed);
      await model.load();
      expect(model.getSnapshot().response).toBe(previous);
      expect(model.getSnapshot().lastCheck).toEqual(failed);
      expect(model.getSnapshot()).toMatchObject({
        showingPrevious: true,
        error: true,
      });
      expect(access.getNextAllowedAt()).toBeNull();
      read.mockResolvedValueOnce(filingsResponse(1));
      await model.load();
      expect(read).toHaveBeenCalledTimes(3);
    },
  );
  it.each(["available", "not_covered", "invalid_response"] as const)(
    "replaces old entries with an admitted empty %s response",
    async (status) => {
      const { model, read } = fixture();
      read
        .mockResolvedValueOnce(filingsResponse())
        .mockResolvedValueOnce(filingsResponse(0, status));
      await model.load();
      await model.load();
      expect(model.getSnapshot().response?.issuer).toMatchObject({
        status,
        filings: [],
      });
      expect(model.getSnapshot().showingPrevious).toBe(false);
    },
  );
  it.each([
    new ManagedSecFilingsError("request_timeout"),
    new ManagedSecFilingsError("unavailable"),
    new TrialApiError("unavailable"),
  ])("retains a packet after transient transport failure %s", async (error) => {
    const { model, read } = fixture();
    read.mockResolvedValueOnce(filingsResponse()).mockRejectedValueOnce(error);
    await model.load();
    const previous = model.getSnapshot().response;
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: previous,
      showingPrevious: true,
      error: true,
    });
  });
  it.each(["shareClassId", "securityId", "symbol", "cik"] as const)(
    "clears old content after a mismatched %s",
    async (field) => {
      const { model, read } = fixture();
      const wire = filingsResponse();
      read.mockResolvedValueOnce(wire);
      await model.load();
      read.mockResolvedValueOnce({
        ...wire,
        security: {
          ...wire.security,
          [field]: field === "cik" ? "0000000002" : "OTHER",
        },
      });
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        response: null,
        lastCheck: null,
        error: true,
      });
    },
  );
  it("closes on authentication failure and clears catalog refusal while fencing stale operations", async () => {
    const { model, read, readError } = fixture();
    read.mockRejectedValueOnce(new ManagedCatalogChangedError());
    await model.load();
    await model.load();
    expect(read).toHaveBeenCalledOnce();
    expect(model.getSnapshot().catalogChanged).toBe(true);
    model.open(filingsSelection);
    const held = deferred<ManagedSecFilingsResponseDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    model.close();
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(readError).not.toHaveBeenCalled();
    expect(model.getSnapshot().selection).toBeNull();
    model.open(filingsSelection);
    read.mockRejectedValueOnce(new TrialApiError("access_denied"));
    await model.load();
    expect(readError).toHaveBeenCalledOnce();
    model.open(filingsSelection);
    expect(model.getSnapshot().selection).toBeNull();
  });
  it("checks budget errors, uses the longest deadline, and rejects cancelled, retired and malformed deadlines", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-12T00:00:00.000Z");
    const { model, read, access } = fixture();
    const signal = new AbortController();
    access.recordCooldown(
      new ManagedSecCooldownError("2026-10-12T00:02:00.000Z"),
      signal.signal,
    );
    access.recordCooldown(
      new ManagedSecCooldownError("2026-10-12T00:01:00.000Z"),
      signal.signal,
    );
    await model.load();
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().message).toContain("00:02:00.000Z");
    signal.abort();
    expect(() =>
      access.recordCooldown(
        new ManagedSecCooldownError("2026-10-12T00:03:00.000Z"),
        signal.signal,
      ),
    ).toThrow();
    expect(access.getNextAllowedAt()).toBe("2026-10-12T00:02:00.000Z");
    vi.setSystemTime("2026-10-12T00:02:01.000Z");
    read.mockRejectedValueOnce(new ManagedSecCooldownError("invalid"));
    await model.load();
    expect(model.getSnapshot().error).toBe(true);
    expect(access.getNextAllowedAt()).toBeNull();
    access.retire();
    expect(() =>
      access.recordCooldown(
        new ManagedSecCooldownError("2026-10-12T00:03:00.000Z"),
        new AbortController().signal,
      ),
    ).toThrow();
  });
  it("cannot let a late cancelled or retired budget error block another view", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-12T00:00:00.000Z");
    for (const retire of [false, true]) {
      const { model, read, access } = fixture();
      const held = deferred<ManagedSecFilingsResponseDto>();
      read.mockReturnValue(held.promise);
      const pending = model.load();
      if (retire) model.retire();
      else model.cancel();
      held.reject(new ManagedSecCooldownError("2026-10-12T00:02:00.000Z"));
      await pending;
      expect(access.getNextAllowedAt()).toBeNull();
    }
  });
});

it("keeps the greatest checked SEC deadline when current Annual and Filings responses arrive out of order, then clears on retirement", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-10-12T00:00:00.000Z");
  const { model, read, access } = fixture();
  const annualRead = vi.fn<ManagedApi["annualReport"]>();
  const annual = new ManagedAnnualReport(annualRead, vi.fn(), access);
  annual.open(filingsSelection);
  const first = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
  const second = deferred<ManagedSecFilingsResponseDto>();
  annualRead.mockReturnValueOnce(first.promise);
  read.mockReturnValueOnce(second.promise);
  const annualPending = annual.load();
  const filingsPending = model.load();
  first.reject(new ManagedSecCooldownError("2026-10-12T00:02:00.000Z"));
  await annualPending;
  second.reject(new ManagedSecCooldownError("2026-10-12T00:01:00.000Z"));
  await filingsPending;
  expect(model.getSnapshot().message).toContain("2026-10-12T00:02:00.000Z");
  await model.load();
  await annual.load();
  expect(read).toHaveBeenCalledOnce();
  expect(annualRead).toHaveBeenCalledOnce();
  access.retire();
  expect(access.getNextAllowedAt()).toBeNull();
});

describe("owned watchlist filings handoff", () => {
  const selection = {
    ...filingsSelection,
    origin: "watchlist" as const,
    cik: null,
  };
  it("decodes an independent frozen copy with original coverage, clocks and retained qualification without a read", () => {
    const { model, read } = fixture();
    const packet = filingsResponse();
    const wire = {
      ...packet,
      issuer: { ...packet.issuer, filings: [...packet.issuer.filings] },
    };
    const seed = { response: wire, showingPrevious: true };
    model.open(selection, seed);
    expect(read).not.toHaveBeenCalled();
    const state = model.getSnapshot();
    expect(state.response).toEqual(wire);
    expect(state.response).not.toBe(wire);
    expect(state.response?.issuer.filings).not.toBe(wire.issuer.filings);
    expect(Object.isFrozen(state.response?.issuer.filings)).toBe(true);
    expect(state).toMatchObject({
      responseOrigin: "watchlist",
      showingPrevious: true,
      running: false,
      error: false,
    });
    wire.issuer.filings.splice(0);
    expect(state.response?.issuer.filings).toHaveLength(26);
  });
  it.each([
    "available",
    "not_covered",
    "invalid_response",
    "rate_limited",
    "upstream_unavailable",
  ] as const)(
    "preserves a checked %s seed's source status without a request",
    (status) => {
      const { model, read } = fixture();
      const response = filingsResponse(0, status);
      model.open(selection, { response, showingPrevious: false });
      expect(model.getSnapshot()).toMatchObject({
        response,
        responseOrigin: "watchlist",
        error: status !== "available",
        showingPrevious: false,
      });
      expect(read).not.toHaveBeenCalled();
    },
  );
  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)(
    "refuses mismatched %s even when a wire packet is otherwise admitted",
    async (field) => {
      const { model, read } = fixture();
      const changed = {
        ...selection,
        listing: {
          ...selection.listing,
          [field]: field === "instrumentType" ? ("adr" as const) : "OTHER",
        },
      };
      model.open(changed, {
        response: filingsResponse(),
        showingPrevious: false,
      });
      expect(model.getSnapshot()).toMatchObject({
        selection: null,
        response: null,
        responseOrigin: null,
        error: true,
      });
      await model.load();
      expect(read).not.toHaveBeenCalled();
    },
  );
  it("refuses malformed seed bytes, old catalog, wrong CIK/origin and nonboolean qualification without fallback", async () => {
    const { model, read } = fixture();
    const response = filingsResponse();
    const seed = { response, showingPrevious: false };
    expect(
      captureManagedCompanyFilingsSeed(
        { ...selection, cik: "0000000002" },
        seed,
      ),
    ).toBeNull();
    expect(captureManagedCompanyFilingsSeed(filingsSelection, seed)).toBeNull();
    expect(
      captureManagedCompanyFilingsSeed(
        { ...selection, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
        seed,
      ),
    ).toBeNull();
    for (const invalid of [
      { ...seed, showingPrevious: null },
      { ...seed, response: { ...response, extra: true } },
      { ...seed, response: { ...response, completedAt: "not-a-date" } },
    ]) {
      model.open(selection, invalid as unknown as typeof seed);
      expect(model.getSnapshot().selection).toBeNull();
      expect(model.getSnapshot().response).toBeNull();
      await model.load();
    }
    expect(read).not.toHaveBeenCalled();
  });
  it("retains watchlist origin through failed refresh and replaces it only after a checked request", async () => {
    const { model, read } = fixture();
    model.open(selection, {
      response: filingsResponse(),
      showingPrevious: false,
    });
    const original = model.getSnapshot().response;
    read.mockRejectedValueOnce(new ManagedSecFilingsError("unavailable"));
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: original,
      responseOrigin: "watchlist",
      showingPrevious: true,
    });
    read.mockResolvedValueOnce(filingsResponse(0));
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      responseOrigin: "request",
      showingPrevious: false,
    });
    expect(model.getSnapshot().response?.issuer.filings).toEqual([]);
    model.close();
    expect(model.getSnapshot().responseOrigin).toBeNull();
  });
  it("keeps a newer open published during the internal close notification", () => {
    const { model } = fixture();
    const newer = {
      ...selection,
      listing: {
        ...selection.listing,
        listingId: "listing-one",
        symbol: "ONE",
      },
    };
    let replaced = false;
    model.subscribe(() => {
      if (!replaced && model.getSnapshot().selection === null) {
        replaced = true;
        model.open(newer);
      }
    });
    model.open(selection, {
      response: filingsResponse(),
      showingPrevious: false,
    });
    expect(model.getSnapshot().selection).toEqual(newer);
    expect(model.getSnapshot().response).toBeNull();
  });
  it.each(["close", "retire"] as const)(
    "does not resurrect a seed when internal close notifies %s",
    (method) => {
      const { model } = fixture();
      let stopped = false;
      model.subscribe(() => {
        if (!stopped && model.getSnapshot().selection === null) {
          stopped = true;
          model[method]();
        }
      });
      model.open(selection, {
        response: filingsResponse(),
        showingPrevious: false,
      });
      expect(model.getSnapshot().selection).toBeNull();
      expect(model.getSnapshot().response).toBeNull();
    },
  );
  it("does not dispatch a source read after running publication synchronously closes the visit", async () => {
    const { model, read } = fixture();
    model.subscribe(() => {
      if (model.getSnapshot().running) model.close();
    });
    await model.load();
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().selection).toBeNull();
  });
  it("preserves a newer seeded visit installed by an aborted request's listener", async () => {
    const { model, read } = fixture();
    const held = deferred<ManagedSecFilingsResponseDto>();
    const newer = {
      ...selection,
      listing: {
        ...selection.listing,
        listingId: "listing-one",
        symbol: "ONE",
      },
    };
    const newerPacket = filingsResponse(1, "available", newer);
    read.mockImplementationOnce((_request, signal) => {
      signal.addEventListener(
        "abort",
        () =>
          model.open(newer, { response: newerPacket, showingPrevious: false }),
        { once: true },
      );
      return held.promise;
    });
    const pending = model.load();
    model.cancel();
    held.resolve(filingsResponse());
    await pending;
    expect(model.getSnapshot()).toMatchObject({
      selection: newer,
      response: newerPacket,
      responseOrigin: "watchlist",
      showingPrevious: false,
    });
    expect(read).toHaveBeenCalledOnce();
  });
});

describe("visit-owned successful refresh comparison", () => {
  async function compared() {
    const f = fixture();
    f.read
      .mockResolvedValueOnce(filingsResponse(1))
      .mockResolvedValueOnce(filingsResponse(2));
    await f.model.load();
    const first = f.model.getSnapshot().response!;
    expect(f.model.getSnapshot().refreshComparison).toBeNull();
    await f.model.load();
    const comparison = f.model.getSnapshot().refreshComparison!;
    expect(comparison.previous).toBe(first);
    expect(comparison.current).toBe(f.model.getSnapshot().response);
    return { ...f, comparison };
  }

  it("advances exactly one successful packet at a time, including equal and empty replacements", async () => {
    const { model, read, comparison } = await compared();
    expect(comparison.newAccessions).toEqual(["0000000001-26-000002"]);
    read.mockResolvedValueOnce(filingsResponse(3));
    await model.load();
    const next = model.getSnapshot().refreshComparison!;
    expect(next.previous).toBe(comparison.current);
    expect(next.newAccessions).toEqual(["0000000001-26-000003"]);
    read.mockResolvedValueOnce(filingsResponse(3));
    await model.load();
    const equal = model.getSnapshot().refreshComparison!;
    expect(equal.previous).toBe(next.current);
    expect(equal.current).toEqual(next.current);
    expect(equal.current).not.toBe(next.current);
    expect(equal.newAccessions).toEqual([]);
    read.mockResolvedValueOnce(filingsResponse(0));
    await model.load();
    const empty = model.getSnapshot().refreshComparison!;
    expect(empty.previous).toBe(equal.current);
    expect(empty.newAccessions).toEqual([]);
    read.mockResolvedValueOnce(filingsResponse(1));
    await model.load();
    expect(model.getSnapshot().refreshComparison).toMatchObject({
      previous: empty.current,
      current: model.getSnapshot().response,
      newAccessions: ["0000000001-26-000001"],
    });
    expect(read).toHaveBeenCalledTimes(6);
  });

  it.each([0, 2])(
    "starts a seeded visit with one %i-row baseline and no read or carried pair",
    async (count) => {
      const { model, read } = await compared();
      model.open(
        { ...filingsSelection, origin: "watchlist", cik: null },
        { response: filingsResponse(count), showingPrevious: true },
      );
      const seed = model.getSnapshot().response;
      expect(model.getSnapshot().refreshComparison).toBeNull();
      expect(model.getSnapshot().showingPrevious).toBe(true);
      expect(read).toHaveBeenCalledTimes(2);
      read.mockResolvedValueOnce(filingsResponse(3));
      await model.load();
      expect(model.getSnapshot().refreshComparison?.previous).toBe(seed);
      expect(model.getSnapshot().refreshComparison?.newAccessions).toHaveLength(
        3 - count,
      );
      model.close();
      model.open(filingsSelection);
      read.mockResolvedValueOnce(filingsResponse(1));
      await model.load();
      expect(model.getSnapshot().refreshComparison).toBeNull();
    },
  );

  it.each(["rate_limited", "upstream_unavailable"] as const)(
    "keeps the pair through checked %s without using lastCheck as the next baseline",
    async (status) => {
      const { model, read, comparison } = await compared();
      const failed = filingsResponse(0, status);
      read.mockResolvedValueOnce(failed);
      await model.load();
      expect(model.getSnapshot().refreshComparison).toBe(comparison);
      expect(model.getSnapshot().lastCheck).toEqual(failed);
      read.mockResolvedValueOnce(filingsResponse(3));
      await model.load();
      expect(model.getSnapshot().refreshComparison?.previous).toBe(
        comparison.current,
      );
      expect(model.getSnapshot().refreshComparison?.newAccessions).toEqual([
        "0000000001-26-000003",
      ]);
    },
  );

  it.each([
    new ManagedSecFilingsError("request_timeout"),
    new ManagedSecFilingsError("unavailable"),
    new TrialApiError("unavailable"),
  ])("retains the exact pair after transient %s", async (error) => {
    const { model, read, comparison } = await compared();
    read.mockRejectedValueOnce(error);
    await model.load();
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    expect(model.getSnapshot().response).toBe(comparison.current);
    expect(model.getSnapshot().showingPrevious).toBe(true);
  });

  it("retains pending/Cancel and ignores a cancelled reply after another successful refresh", async () => {
    const { model, read, comparison } = await compared();
    const held = deferred<ManagedSecFilingsResponseDto>();
    read.mockReturnValueOnce(held.promise);
    const pending = model.load();
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    await model.load();
    expect(read).toHaveBeenCalledTimes(3);
    model.cancel();
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    read.mockResolvedValueOnce(filingsResponse(3));
    await model.load();
    const accepted = model.getSnapshot().refreshComparison;
    held.resolve(filingsResponse(0));
    await pending;
    expect(model.getSnapshot().refreshComparison).toBe(accepted);
    expect(read.mock.calls[2]![1].aborted).toBe(true);
  });

  it("retains the pair through a checked cooldown and blocks a read until that deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-12T00:00:00.000Z");
    const { model, read, comparison } = await compared();
    read.mockRejectedValueOnce(
      new ManagedSecCooldownError("2026-10-12T00:02:00.000Z"),
    );
    await model.load();
    await model.load();
    expect(read).toHaveBeenCalledTimes(3);
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    vi.setSystemTime("2026-10-12T00:02:01.000Z");
    read.mockResolvedValueOnce(filingsResponse(3));
    await model.load();
    expect(model.getSnapshot().refreshComparison?.previous).toBe(
      comparison.current,
    );
  });

  it.each(["not_covered", "invalid_response"] as const)(
    "clears comparison on admitted %s and establishes a fresh next baseline",
    async (status) => {
      const { model, read } = await compared();
      read.mockResolvedValueOnce(filingsResponse(0, status));
      await model.load();
      expect(model.getSnapshot().refreshComparison).toBeNull();
      read.mockResolvedValueOnce(filingsResponse(3));
      await model.load();
      expect(model.getSnapshot().refreshComparison).toBeNull();
      expect(model.getSnapshot().response?.issuer.filings).toHaveLength(3);
    },
  );

  it.each([
    new TrialApiError("invalid_response"),
    new ManagedCatalogChangedError(),
    new ManagedSecFilingsError("not_configured"),
    new ManagedSecCooldownError("invalid"),
    new TrialApiError("access_denied"),
  ])("clears the pair with unusable evidence on %s", async (error) => {
    const { model, read } = await compared();
    read.mockRejectedValueOnce(error);
    await model.load();
    expect(model.getSnapshot().response).toBeNull();
    expect(model.getSnapshot().refreshComparison).toBeNull();
  });

  it.each(["catalog", "issuer", "share class"] as const)(
    "does not retain a pair when a current packet changes %s",
    async (field) => {
      const { model, read } = await compared();
      const response = filingsResponse();
      read.mockResolvedValueOnce({
        ...response,
        ...(field === "catalog"
          ? { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const }
          : {
              security: {
                ...response.security,
                ...(field === "issuer"
                  ? { cik: "0000000002" }
                  : { shareClassId: "other-class" }),
              },
            }),
      });
      await model.load();
      expect(model.getSnapshot().response).toBeNull();
      expect(model.getSnapshot().refreshComparison).toBeNull();
    },
  );

  it.each(["close", "retire"] as const)(
    "clears both packets on %s and rejects a late refresh",
    async (method) => {
      const { model, read } = await compared();
      const held = deferred<ManagedSecFilingsResponseDto>();
      read.mockReturnValueOnce(held.promise);
      const pending = model.load();
      model[method]();
      held.resolve(filingsResponse(4));
      await pending;
      expect(model.getSnapshot().response).toBeNull();
      expect(model.getSnapshot().refreshComparison).toBeNull();
    },
  );

  it("cannot overwrite a new seeded visit during comparison publication", async () => {
    const { model, read } = fixture();
    read.mockResolvedValueOnce(filingsResponse(1));
    await model.load();
    const seed = filingsResponse(0);
    model.subscribe(() => {
      if (model.getSnapshot().refreshComparison)
        model.open(
          { ...filingsSelection, origin: "watchlist" },
          { response: seed, showingPrevious: true },
        );
    });
    read.mockResolvedValueOnce(filingsResponse(2));
    await model.load();
    expect(model.getSnapshot()).toMatchObject({
      response: seed,
      responseOrigin: "watchlist",
      refreshComparison: null,
      showingPrevious: true,
      running: false,
    });
  });
});
