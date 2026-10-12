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
import { ManagedCompanyFilings } from "./managed-company-filings";
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
  const model = new ManagedCompanyFilings(read, readError, access);
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
