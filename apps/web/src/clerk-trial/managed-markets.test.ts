import {
  parseManagedEodHistoryResponse,
  type ManagedCatalogResolveResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import { ManagedEodAccess } from "./managed-eod-access";
import { ManagedEodHistory } from "./managed-eod-history";
import {
  MANAGED_MARKETS_COHORT,
  ManagedMarkets,
  type ManagedMarketsCohortEntry,
} from "./managed-markets";

const digest = eodSelection.catalogSnapshotSha256;
const cohort: readonly ManagedMarketsCohortEntry[] = [
  eodSelection.listing,
  {
    ...eodSelection.listing,
    issuerId: "issuer-pair",
    issuerName: "Pair Company",
    listingId: "listing-pair-c",
    securityId: "security-pair-c",
    securityName: "Pair Class C",
    shareClassId: "class-pair-c",
    shareClassName: "Class C",
    symbol: "PAIR",
  },
  {
    ...eodSelection.listing,
    issuerId: "issuer-pair",
    issuerName: "Pair Company",
    listingId: "listing-pair-a",
    securityId: "security-pair-a",
    securityName: "Pair Class A",
    shareClassId: "class-pair-a",
    shareClassName: "Class A",
    symbol: "PAIRA",
  },
];
const ids = cohort.map((listing) => listing.listingId);
const resolved = (
  snapshotSha256: string = digest,
): ManagedCatalogResolveResponse => ({
  snapshotSha256,
  results: cohort.map((listing) => ({ listingId: listing.listingId, listing })),
});
const request = (index: number): ManagedEodHistoryRequestDto => ({
  catalogSnapshotSha256: digest,
  listingId: ids[index]!,
  range: "1m",
});
function packet(captured: ManagedEodHistoryRequestDto, close = "101.5") {
  const response = parseManagedEodHistoryResponse(
    {
      ...eodResponse(),
      catalogSnapshotSha256: captured.catalogSnapshotSha256,
      security: cohort.find(
        (listing) => listing.listingId === captured.listingId,
      ),
      rows: [{ date: "2026-09-19", close }],
    },
    captured,
  );
  if (!response) throw new Error("Invalid invented board fixture");
  return response;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function settle() {
  for (let index = 0; index < 6; index++) await Promise.resolve();
}
function setup() {
  const resolve = vi
    .fn<ManagedApi["resolve"]>()
    .mockImplementation((captured) =>
      Promise.resolve(resolved(captured.snapshotSha256)),
    );
  const read = vi
    .fn<ManagedApi["eodHistory"]>()
    .mockImplementation((captured) => Promise.resolve(packet(captured)));
  const access = new ManagedEodAccess(read);
  const onReadError = vi.fn();
  const onCatalogChanged = vi.fn();
  const model = new ManagedMarkets(
    { resolve },
    access,
    onReadError,
    onCatalogChanged,
    cohort,
  );
  return { model, resolve, read, access, onReadError, onCatalogChanged };
}
async function ready() {
  const fixture = setup();
  fixture.model.enter(digest);
  await settle();
  expect(fixture.model.getSnapshot().rows).toHaveLength(3);
  return fixture;
}
afterEach(() => vi.useRealTimers());

describe("ManagedMarkets", () => {
  it("declares three distinct production listings with separate Alphabet share classes", () => {
    expect(MANAGED_MARKETS_COHORT.map((listing) => listing.symbol)).toEqual([
      "AAPL",
      "GOOG",
      "GOOGL",
    ]);
    expect(
      new Set(MANAGED_MARKETS_COHORT.map((listing) => listing.listingId)).size,
    ).toBe(3);
    expect(MANAGED_MARKETS_COHORT[1]!.issuerId).toBe(
      MANAGED_MARKETS_COHORT[2]!.issuerId,
    );
    expect(MANAGED_MARKETS_COHORT[1]!.shareClassId).not.toBe(
      MANAGED_MARKETS_COHORT[2]!.shareClassId,
    );
  });

  it("resolves the bounded cohort only after catalog admission and never auto-loads prices", async () => {
    const { model, resolve, read } = setup();
    model.enter(null);
    await model.load();
    expect(resolve).not.toHaveBeenCalled();
    model.enter(digest);
    await settle();
    model.enter(digest);
    model.select(ids[1]!);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0]![0]).toEqual({
      snapshotSha256: digest,
      listingIds: ids,
    });
    expect(read).not.toHaveBeenCalled();
    expect(model.getSnapshot().rows.every((row) => row.response === null)).toBe(
      true,
    );
    expect(model.selection()).toEqual({
      catalogSnapshotSha256: digest,
      listing: cohort[1],
      origin: "markets",
      cik: null,
    });
    model.select("not-admitted");
    expect(model.getSnapshot().selectedListingId).toBe(ids[1]);
    expect(model.selection("not-admitted")).toBeNull();
  });

  it.each([
    "missing",
    "null",
    "duplicate",
    "extra",
    "reordered",
    "digest",
  ] as const)(
    "refuses %s cohort resolution before any price request",
    async (kind) => {
      const { model, resolve, read } = setup();
      const good = resolved();
      const bad = {
        ...good,
        ...(kind === "digest"
          ? { snapshotSha256: `sha256:${"b".repeat(64)}` }
          : {}),
        results:
          kind === "missing"
            ? good.results.slice(0, 2)
            : kind === "null"
              ? good.results.map((row, index) =>
                  index === 1 ? { ...row, listing: null } : row,
                )
              : kind === "duplicate"
                ? [good.results[0]!, good.results[0]!, good.results[2]!]
                : kind === "extra"
                  ? [...good.results, good.results[0]!]
                  : kind === "reordered"
                    ? [...good.results].reverse()
                    : good.results,
      };
      resolve.mockResolvedValueOnce(bad);
      model.enter(digest);
      await settle();
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        rows: [],
        error: true,
        resolving: false,
      });
      expect(read).not.toHaveBeenCalled();
      await model.resolve();
      expect(model.getSnapshot().rows).toHaveLength(3);
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each(
    Object.keys(eodSelection.listing) as (keyof ManagedMarketsCohortEntry)[],
  )("joins resolved %s exactly before enabling prices", async (key) => {
    const { model, resolve, read } = setup();
    const changed = { ...cohort[1], [key]: `${cohort[1]![key]}-other` };
    resolve.mockResolvedValueOnce({
      ...resolved(),
      results: resolved().results.map((row, index) =>
        index === 1 ? { ...row, listing: changed } : row,
      ),
    } as ManagedCatalogResolveResponse);
    model.enter(digest);
    await settle();
    await model.load();
    expect(model.getSnapshot().rows).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["listingId", "securityId", "shareClassId", "symbol"] as const)(
    "rejects duplicate fixture %s without permitting a broader cohort",
    (key) => {
      const { access, resolve } = setup();
      const repeated = cohort.map((listing, index) =>
        index === 1 ? { ...listing, [key]: cohort[0]![key] } : listing,
      );
      expect(
        () =>
          new ManagedMarkets({ resolve }, access, vi.fn(), vi.fn(), repeated),
      ).toThrow();
      expect(
        () =>
          new ManagedMarkets(
            { resolve },
            access,
            vi.fn(),
            vi.fn(),
            cohort.slice(0, 2),
          ),
      ).toThrow();
    },
  );

  it("admits each of at most three price reads only after the previous read settles", async () => {
    const { model, read } = await ready();
    const first = deferred<ManagedEodHistoryResponseDto>();
    const second = deferred<ManagedEodHistoryResponseDto>();
    read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const loading = model.load();
    void model.load();
    expect(read).toHaveBeenCalledTimes(1);
    model.select(ids[2]!);
    expect(read).toHaveBeenCalledTimes(1);
    first.resolve(packet(request(0)));
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(model.getSnapshot().rows[0]!.response?.rows[0]!.close).toBe("101.5");
    expect(model.getSnapshot().rows[1]!.running).toBe(true);
    expect(model.getSnapshot().rows[2]!.response).toBeNull();
    second.resolve(packet(request(1)));
    await loading;
    expect(read.mock.calls.map(([captured]) => captured)).toEqual(
      ids.map((_, index) => request(index)),
    );
    expect(model.getSnapshot()).toMatchObject({
      running: false,
      error: false,
      selectedListingId: ids[2],
    });
  });

  it("retains complete previous snapshots during refresh and replaces each only on valid success", async () => {
    const { model, read } = await ready();
    await model.load();
    const previous = model.getSnapshot().rows.map((row) => row.response);
    const held = deferred<ManagedEodHistoryResponseDto>();
    read.mockReturnValueOnce(held.promise);
    const loading = model.load();
    expect(model.getSnapshot().rows[0]).toMatchObject({
      response: previous[0],
      showingPrevious: true,
      running: true,
    });
    expect(model.getSnapshot().rows[0]!.response).toBe(previous[0]);
    const replacement = packet(request(0), "123.75");
    held.resolve(replacement);
    await loading;
    expect(model.getSnapshot().rows[0]!.response).toBe(replacement);
    expect(model.getSnapshot().rows[0]!.showingPrevious).toBe(false);
  });

  it("cancel preserves completed and previous rows, aborts the active read and ignores its late success", async () => {
    const { model, read } = await ready();
    await model.load();
    const previous = model.getSnapshot().rows.map((row) => row.response);
    const held = deferred<ManagedEodHistoryResponseDto>();
    const replacement = packet(request(0), "122");
    read.mockResolvedValueOnce(replacement).mockReturnValueOnce(held.promise);
    const loading = model.load();
    await settle();
    expect(read).toHaveBeenCalledTimes(5);
    model.cancel();
    expect(read.mock.calls[4]![1].aborted).toBe(true);
    expect(model.getSnapshot().rows[0]!.response).toBe(replacement);
    expect(model.getSnapshot().rows[0]!.showingPrevious).toBe(false);
    expect(model.getSnapshot().rows[1]).toMatchObject({
      response: previous[1],
      showingPrevious: true,
      running: false,
    });
    expect(model.getSnapshot().rows[2]!.response).toBe(previous[2]);
    expect(model.getSnapshot().rows[2]).toMatchObject({
      showingPrevious: true,
      message: "Not requested. Previous history retained.",
    });
    const cancelled = model.getSnapshot();
    held.resolve(packet(request(1), "200"));
    await loading;
    expect(model.getSnapshot()).toBe(cancelled);
    expect(read).toHaveBeenCalledTimes(5);
  });

  it.each([
    new ManagedEodHistoryError("request_timeout"),
    new ManagedEodHistoryError("unavailable"),
    new TrialApiError("unavailable"),
  ])(
    "keeps dated previous values on %s and continues independent rows",
    async (error) => {
      const { model, read } = await ready();
      await model.load();
      const previous = model.getSnapshot().rows[0]!.response;
      read.mockRejectedValueOnce(error);
      await model.load();
      expect(model.getSnapshot().rows[0]).toMatchObject({
        response: previous,
        showingPrevious: true,
        error: true,
      });
      expect(model.getSnapshot().rows[0]!.response).toBe(previous);
      expect(
        model
          .getSnapshot()
          .rows.slice(1)
          .every((row) => row.response && !row.error),
      ).toBe(true);
      expect(read).toHaveBeenCalledTimes(6);
      expect(model.getSnapshot().message).toContain("row errors");
    },
  );

  it.each([
    new ManagedEodHistoryError("unsupported_listing"),
    new TrialApiError("invalid_response"),
    new ManagedEodCooldownError("not-a-time"),
    new Error("unknown"),
  ])(
    "clears only the affected snapshot on %s and leaves other rows usable",
    async (error) => {
      const { model, read } = await ready();
      await model.load();
      read.mockRejectedValueOnce(error);
      await model.load();
      expect(model.getSnapshot().rows[0]).toMatchObject({
        response: null,
        showingPrevious: false,
        error: true,
      });
      expect(
        model
          .getSnapshot()
          .rows.slice(1)
          .every((row) => row.response && !row.error),
      ).toBe(true);
      expect(read).toHaveBeenCalledTimes(6);
    },
  );

  it.each(["source_rate_limited", "not_configured"] as const)(
    "stops remaining admissions at %s with unrequested prior rows dated and marked previous",
    async (code) => {
      const { model, read } = await ready();
      await model.load();
      const previous = model.getSnapshot().rows.map((row) => row.response);
      read.mockRejectedValueOnce(new ManagedEodHistoryError(code));
      await model.load();
      expect(read).toHaveBeenCalledTimes(4);
      expect(model.getSnapshot().rows[0]).toMatchObject({
        response: code === "source_rate_limited" ? previous[0] : null,
        showingPrevious: code === "source_rate_limited",
        error: true,
      });
      expect(model.getSnapshot().message).toContain(
        code === "source_rate_limited"
          ? "no reset time was provided"
          : "not configured",
      );
      expect(model.getSnapshot().rows[1]!.response).toBe(previous[1]);
      expect(model.getSnapshot().rows[2]!.response).toBe(previous[2]);
      expect(
        model
          .getSnapshot()
          .rows.slice(1)
          .every(
            (row) =>
              row.showingPrevious &&
              row.message === "Not requested. Previous history retained.",
          ),
      ).toBe(true);
    },
  );

  it("shares a checked cooldown with panels across board visits without auto-loading after expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
    const { model, read, access } = await ready();
    await model.load();
    const previous = model.getSnapshot().rows[0]!.response;
    read.mockRejectedValueOnce(
      new ManagedEodCooldownError("2026-09-20T00:01:00.000Z"),
    );
    await model.load();
    expect(read).toHaveBeenCalledTimes(4);
    expect(model.getSnapshot().rows[0]).toMatchObject({
      response: previous,
      showingPrevious: true,
      error: false,
    });
    const panel = new ManagedEodHistory(read, vi.fn(), access);
    panel.open(eodSelection);
    await panel.load();
    expect(read).toHaveBeenCalledTimes(4);
    model.leave();
    model.enter(digest);
    await settle();
    await model.load();
    expect(read).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(60_000);
    expect(read).toHaveBeenCalledTimes(4);
    await model.load();
    expect(read).toHaveBeenCalledTimes(7);
  });

  it.each(["unauthenticated", "access_denied", "origin_denied"] as const)(
    "retires all snapshots and stops the queue on %s",
    async (code) => {
      const { model, read, onReadError } = await ready();
      await model.load();
      const failure = new TrialApiError(code);
      read.mockRejectedValueOnce(failure);
      await model.load();
      expect(onReadError).toHaveBeenCalledWith(failure);
      expect(model.getSnapshot()).toMatchObject({
        active: false,
        rows: [],
        selectedListingId: null,
        running: false,
      });
      model.enter(digest);
      await model.load();
      expect(read).toHaveBeenCalledTimes(4);
    },
  );

  it.each([
    new ManagedCatalogChangedError(),
    new ManagedEodHistoryError("catalog_changed"),
  ])(
    "clears the complete board and notifies its owner on %s",
    async (error) => {
      const { model, read, onCatalogChanged } = await ready();
      await model.load();
      read.mockRejectedValueOnce(error);
      await model.load();
      expect(model.getSnapshot()).toMatchObject({
        rows: [],
        catalogChanged: true,
        running: false,
      });
      expect(model.selection()).toBeNull();
      expect(onCatalogChanged).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledTimes(4);
    },
  );

  it.each(["leave", "retire", "catalogChanged"] as const)(
    "%s aborts pending prices and ignores late account errors",
    async (action) => {
      const { model, read, onReadError } = await ready();
      const held = deferred<ManagedEodHistoryResponseDto>();
      read.mockReturnValueOnce(held.promise);
      const loading = model.load();
      model[action]();
      expect(read.mock.calls[0]![1].aborted).toBe(true);
      const cleared = model.getSnapshot();
      held.reject(new TrialApiError("unauthenticated"));
      await loading;
      expect(model.getSnapshot()).toBe(cleared);
      expect(onReadError).not.toHaveBeenCalled();
      expect(read).toHaveBeenCalledTimes(1);
    },
  );

  it("a new digest retires old resolution and ignores stale success before any prices", async () => {
    const { model, resolve, read } = setup();
    const held = deferred<ManagedCatalogResolveResponse>();
    resolve.mockReturnValueOnce(held.promise);
    model.enter(digest);
    const nextDigest = `sha256:${"b".repeat(64)}` as const;
    model.enter(nextDigest);
    await settle();
    expect(resolve.mock.calls[0]![1].aborted).toBe(true);
    expect(model.getSnapshot().catalogSnapshotSha256).toBe(nextDigest);
    held.resolve(resolved());
    await settle();
    expect(model.getSnapshot().catalogSnapshotSha256).toBe(nextDigest);
    expect(read).not.toHaveBeenCalled();
    model.leave();
    model.enter(nextDigest);
    await settle();
    expect(model.getSnapshot().rows.every((row) => row.response === null)).toBe(
      true,
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("does not accept a late resolver account refusal after leaving", async () => {
    const { model, resolve, onReadError } = setup();
    const held = deferred<ManagedCatalogResolveResponse>();
    resolve.mockReturnValueOnce(held.promise);
    model.enter(digest);
    model.leave();
    held.reject(new TrialApiError("unauthenticated"));
    await settle();
    expect(model.getSnapshot().rows).toEqual([]);
    expect(onReadError).not.toHaveBeenCalled();
  });
});
