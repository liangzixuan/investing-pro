import {
  MANAGED_BLS_CALENDAR_SOURCE,
  parseManagedBlsCalendar,
  parseManagedEconomicCalendar,
  parseManagedEodHistoryResponse,
  parseManagedMonetaryAnnouncements,
  type ManagedEodHistoryRequestDto,
  type ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import {
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import { ManagedBeaReleaseAgenda } from "./managed-bea-release-agenda";
import { ManagedBlsCalendar } from "./managed-bls-calendar";
import { ManagedEodAccess } from "./managed-eod-access";
import { ManagedFedAnnouncements } from "./managed-fed-announcements";
import { ManagedMarkets } from "./managed-markets";
import { createManagedMarketsSourceReview } from "./managed-markets-source-review-sources";

const digest = eodSelection.catalogSnapshotSha256;
const cohort = ["ZERO", "ONE", "TWO"].map((symbol, index) => ({
  ...eodSelection.listing,
  issuerId: `issuer-source-${index}`,
  issuerName: `Invented Source Company ${index}`,
  listingId: `listing-source-${index}`,
  securityId: `security-source-${index}`,
  securityName: `Invented Class ${index}`,
  shareClassId: `share-class-source-${index}`,
  shareClassName: `Class ${index}`,
  symbol,
}));
const allIds = ["price-0", "price-1", "price-2", "bls", "bea", "fed"];
function pricePacket(request: ManagedEodHistoryRequestDto) {
  const packet = parseManagedEodHistoryResponse(
    {
      ...eodResponse(),
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security: cohort.find((row) => row.listingId === request.listingId),
    },
    request,
  );
  if (!packet) throw new Error("Invalid invented source-review price packet");
  return packet;
}
function marketModels(order: string[]) {
  const resolve = vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: cohort.map((listing) => ({
        listingId: listing.listingId,
        listing,
      })),
    }),
  );
  const read = vi
    .fn<ManagedApi["eodHistory"]>()
    .mockImplementation((request) => {
      order.push(
        `price-${cohort.findIndex((row) => row.listingId === request.listingId)}`,
      );
      return Promise.resolve(pricePacket(request));
    });
  const markets = new ManagedMarkets(
    { resolve },
    new ManagedEodAccess(read),
    vi.fn(),
    vi.fn(),
    cohort,
  );
  return { markets, read, resolve };
}
function governmentModels(order: string[]) {
  const blsPacket = parseManagedBlsCalendar({
    ...economicCalendarFixture(),
    source: MANAGED_BLS_CALENDAR_SOURCE,
  })!;
  const beaPacket = parseManagedEconomicCalendar({
    ...economicCalendarFixture(),
    fetchedAt: "2026-10-21T19:00:00.000Z",
    window: {
      fromInclusive: "2026-10-21T19:00:00.000Z",
      toExclusive: "2026-11-20T19:00:00.000Z",
    },
  })!;
  const fedPacket = parseManagedMonetaryAnnouncements({
    ...fedAnnouncementsFixture(),
    fetchedAt: "2026-10-22T20:00:00.000Z",
  })!;
  const blsRead = vi.fn<ManagedApi["blsCalendar"]>().mockImplementation(() => {
    order.push("bls");
    return Promise.resolve(blsPacket);
  });
  const beaRead = vi
    .fn<ManagedApi["economicCalendar"]>()
    .mockImplementation(() => {
      order.push("bea");
      return Promise.resolve(beaPacket);
    });
  const fedRead = vi
    .fn<ManagedApi["monetaryAnnouncements"]>()
    .mockImplementation(() => {
      order.push("fed");
      return Promise.resolve(fedPacket);
    });
  return {
    bls: new ManagedBlsCalendar(blsRead, vi.fn()),
    bea: new ManagedBeaReleaseAgenda(beaRead, vi.fn()),
    fed: new ManagedFedAnnouncements(fedRead, vi.fn()),
    blsRead,
    beaRead,
    fedRead,
    blsPacket,
    beaPacket,
    fedPacket,
  };
}
async function settle() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}
async function fixture() {
  const order: string[] = [];
  const market = marketModels(order),
    government = governmentModels(order),
    available = { current: true };
  market.markets.enter(digest);
  await settle();
  expect(market.markets.getSnapshot().rows).toHaveLength(3);
  const review = createManagedMarketsSourceReview({
    markets: market.markets,
    bls: government.bls,
    bea: government.bea,
    fed: government.fed,
    available: () => available.current,
  });
  return { ...market, ...government, order, available, review };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function row(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  const result = f.review.getSnapshot().rows.find((entry) => entry.id === id);
  if (!result) throw new Error("Missing invented source-review row");
  return result;
}
function pendingFirstPrice(f: Awaited<ReturnType<typeof fixture>>) {
  const held = deferred<ManagedEodHistoryResponseDto>();
  f.read.mockImplementationOnce(() => {
    f.order.push("price-0");
    return held.promise;
  });
  f.review.preview();
  const running = f.review.start();
  expect(f.order).toEqual(["price-0"]);
  return { held, running };
}
const priceRequest = (index: number): ManagedEodHistoryRequestDto => ({
  catalogSnapshotSha256: digest,
  listingId: cohort[index]!.listingId,
  range: "1m",
});
async function expectCompletedManualBoard(
  f: Awaited<ReturnType<typeof fixture>>,
  manual: ReturnType<ManagedMarkets["load"]> | undefined,
  replacement: ManagedEodHistoryResponseDto,
) {
  await expect(manual).resolves.toBe("accepted");
  expect(f.order).toEqual([
    "price-0",
    "price-0-manual-board",
    "price-1",
    "price-2",
  ]);
  expect(f.read).toHaveBeenCalledTimes(4);
  expect(f.read.mock.calls.slice(1).map(([request]) => request)).toEqual(
    [0, 1, 2].map(priceRequest),
  );
  expect(
    f.read.mock.calls.slice(1).every(([, signal]) => !signal.aborted),
  ).toBe(true);
  expect(f.markets.getSnapshot().rows[0]!.response).toBe(replacement);
  expect(
    f.markets.getSnapshot().rows.map((entry) => entry.response?.security),
  ).toEqual(cohort);
  expect(f.markets.getSnapshot().running).toBe(false);
  expect(f.review.getSnapshot().phase).toBe("retired");
  expect(f.blsRead).not.toHaveBeenCalled();
  expect(f.beaRead).not.toHaveBeenCalled();
  expect(f.fedRead).not.toHaveBeenCalled();
}

afterEach(() => vi.useRealTimers());

describe("Markets source review through the real source models", () => {
  it("runs exactly six ordered reads without invalidating sibling price ports or retargeting selection", async () => {
    const f = await fixture();
    f.markets.select(cohort[2]!.listingId);
    const { held, running } = pendingFirstPrice(f);
    const plan = f.review.getSnapshot().plan;
    expect(Object.isFrozen(plan)).toBe(true);
    expect(plan.map((entry) => entry.mode)).toEqual(allIds.map(() => "load"));
    expect(plan.every((entry) => Object.isFrozen(entry))).toBe(true);
    await f.review.start();
    expect(f.order).toEqual(["price-0"]);
    held.resolve(pricePacket(priceRequest(0)));
    await running;
    expect(f.order).toEqual(allIds);
    expect(f.review.getSnapshot().phase).toBe("complete");
    expect(f.review.getSnapshot().plan).toBe(plan);
    expect(plan[0]!.evidence).toContain("No history loaded");
    expect(plan.map((entry) => entry.mode)).toEqual(allIds.map(() => "load"));
    expect(f.review.getSnapshot().rows.map((entry) => entry.outcome)).toEqual(
      allIds.map(() => "checked"),
    );
    expect(f.read.mock.calls.map(([request]) => request)).toEqual(
      [0, 1, 2].map(priceRequest),
    );
    expect(f.markets.getSnapshot().selectedListingId).toBe(
      cohort[2]!.listingId,
    );
    expect(row(f, "price-1").identity).toEqual(cohort[1]);
    expect(row(f, "price-0").evidence).toContain("Trading date 2026-09-19");
    expect(row(f, "price-0").evidence).toContain(
      "2026-09-20T00:00:00.000Z to 2026-09-20T00:00:01.000Z",
    );
    expect(row(f, "bls").evidence).toContain(f.blsPacket.fetchedAt);
    expect(row(f, "bea").evidence).toContain(f.beaPacket.fetchedAt);
    expect(row(f, "fed").evidence).toContain(f.fedPacket.fetchedAt);
    expect(f.fed.getSnapshot().announcements?.items[1]!.publishedAt).toBeNull();
  });

  it("waits for each government source before dispatching the next source", async () => {
    const f = await fixture();
    for (const id of allIds.slice(0, 3)) f.review.choose(id, false);
    const bls = deferred<typeof f.blsPacket>(),
      bea = deferred<typeof f.beaPacket>();
    f.blsRead.mockImplementationOnce(() => {
      f.order.push("bls");
      return bls.promise;
    });
    f.beaRead.mockImplementationOnce(() => {
      f.order.push("bea");
      return bea.promise;
    });
    f.review.preview();
    const running = f.review.start();
    expect(f.order).toEqual(["bls"]);
    expect(f.beaRead).not.toHaveBeenCalled();
    bls.resolve(f.blsPacket);
    await settle();
    expect(f.order).toEqual(["bls", "bea"]);
    expect(f.fedRead).not.toHaveBeenCalled();
    bea.resolve(f.beaPacket);
    await running;
    expect(f.order).toEqual(["bls", "bea", "fed"]);
    expect(f.review.getSnapshot().phase).toBe("complete");
    expect(f.read).not.toHaveBeenCalled();
  });

  it("keeps loaded and checked-empty packets out of a missing-only pass until explicit Refresh", async () => {
    const f = await fixture();
    await f.markets.loadListing(cohort[1]!.listingId);
    const empty = { ...f.blsPacket, events: [] };
    f.blsRead.mockResolvedValueOnce(empty);
    await f.bls.load();
    const previous = f.markets.getSnapshot().rows[1]!.response;
    f.order.length = 0;
    f.review.preview();
    expect(
      f.review
        .getSnapshot()
        .rows.filter((entry) => entry.selected)
        .map((entry) => entry.id),
    ).toEqual(["price-0", "price-2", "bea", "fed"]);
    await f.review.start();
    expect(f.order).toEqual(["price-0", "price-2", "bea", "fed"]);
    expect(row(f, "bls").outcome).toBe("retained");
    expect(row(f, "bls").evidence).toContain("0 scheduled releases");
    expect(f.markets.getSnapshot().rows[1]!.response).toBe(previous);
    expect(f.bls.getSnapshot().calendar).toBe(empty);
    for (const id of allIds) f.review.choose(id, id === "bls");
    f.blsRead.mockResolvedValueOnce(empty);
    f.review.preview();
    expect(row(f, "bls").mode).toBe("refresh");
    await f.review.start();
    expect(f.blsRead).toHaveBeenCalledTimes(2);
    expect(row(f, "bls").outcome).toBe("checked_empty");
  });

  it.each([
    [new ManagedEodHistoryError("request_timeout"), true],
    [new ManagedEodHistoryError("unsupported_listing"), false],
  ] as const)(
    "stops the queue on price %s and retains only its permitted history",
    async (failure, retained) => {
      const f = await fixture();
      await f.markets.loadListing(cohort[0]!.listingId);
      const previous = f.markets.getSnapshot().rows[0]!.response;
      f.order.length = 0;
      f.read.mockImplementationOnce(() => {
        f.order.push("price-0");
        return Promise.reject(failure);
      });
      f.review.choose("price-0", true);
      f.review.preview();
      await f.review.start();
      expect(f.order).toEqual(["price-0"]);
      expect(f.review.getSnapshot().phase).toBe("stopped");
      expect(row(f, "price-0").outcome).toBe("failed");
      expect(row(f, "price-1").outcome).toBe("not_attempted");
      expect(f.markets.getSnapshot().rows[0]!.response).toBe(
        retained ? previous : null,
      );
      expect(f.markets.getSnapshot().rows[0]!.showingPrevious).toBe(retained);
      expect(f.blsRead).not.toHaveBeenCalled();
    },
  );

  it("stops a checked cooldown without treating previous history as accepted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
    const f = await fixture();
    await f.markets.loadListing(cohort[0]!.listingId);
    const previous = f.markets.getSnapshot().rows[0]!.response;
    f.read.mockRejectedValueOnce(
      new ManagedEodCooldownError("2026-09-20T00:01:00.000Z"),
    );
    f.review.choose("price-0", true);
    f.review.preview();
    await f.review.start();
    expect(f.review.getSnapshot().phase).toBe("stopped");
    expect(row(f, "price-0").outcome).toBe("failed");
    expect(row(f, "price-1").outcome).toBe("not_attempted");
    expect(f.markets.getSnapshot().rows[0]).toMatchObject({
      response: previous,
      showingPrevious: true,
      error: false,
    });
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.blsRead).not.toHaveBeenCalled();
  });

  it("keeps successful earlier histories and retained BLS evidence when its refresh fails", async () => {
    const f = await fixture();
    await f.bls.load();
    const previous = f.bls.getSnapshot().calendar;
    f.order.length = 0;
    f.blsRead.mockImplementationOnce(() => {
      f.order.push("bls");
      return Promise.reject(new TrialApiError("invalid_response"));
    });
    f.review.choose("bls", true);
    f.review.preview();
    await f.review.start();
    expect(f.order).toEqual(["price-0", "price-1", "price-2", "bls"]);
    expect(f.review.getSnapshot().phase).toBe("stopped");
    expect(row(f, "bls").outcome).toBe("failed");
    expect(row(f, "bls").evidence).toContain("Previous packet");
    expect(f.bls.getSnapshot().calendar).toBe(previous);
    expect(row(f, "bea").outcome).toBe("not_attempted");
    expect(
      f.markets.getSnapshot().rows.every((entry) => entry.response !== null),
    ).toBe(true);
  });

  it("retires the preview after an intervening external source read", async () => {
    const f = await fixture();
    f.review.preview();
    expect(f.review.getSnapshot().canStart).toBe(true);
    await f.bls.load();
    expect(f.review.getSnapshot().phase).toBe("retired");
    expect(f.review.getSnapshot().canStart).toBe(false);
    await f.review.start();
    expect(f.read).not.toHaveBeenCalled();
    expect(f.order).toEqual(["bls"]);
  });

  it("cancels the active owned price when another source reads externally", async () => {
    const f = await fixture();
    const { held, running } = pendingFirstPrice(f);
    await f.bls.load();
    expect(f.review.getSnapshot().phase).toBe("retired");
    expect(f.read.mock.calls[0]![1].aborted).toBe(true);
    held.resolve(pricePacket(priceRequest(0)));
    await running;
    expect(f.order).toEqual(["price-0", "bls"]);
    expect(f.markets.getSnapshot().rows[0]!.response).toBeNull();
    expect(f.bls.getSnapshot().calendar).toBe(f.blsPacket);
    expect(f.beaRead).not.toHaveBeenCalled();
    expect(f.fedRead).not.toHaveBeenCalled();
  });

  it("retires an active calendar queue after an external exact price read", async () => {
    const f = await fixture();
    for (const id of allIds.slice(0, 3)) f.review.choose(id, false);
    const held = deferred<typeof f.blsPacket>();
    f.blsRead.mockImplementationOnce(() => {
      f.order.push("bls");
      return held.promise;
    });
    f.review.preview();
    const running = f.review.start();
    await f.markets.loadListing(cohort[2]!.listingId);
    expect(f.review.getSnapshot().phase).toBe("retired");
    expect(f.blsRead.mock.calls[0]![0].aborted).toBe(true);
    held.resolve(f.blsPacket);
    await running;
    expect(f.order).toEqual(["bls", "price-2"]);
    expect(f.bls.getSnapshot().calendar).toBeNull();
    expect(f.markets.getSnapshot().rows[2]!.response?.security).toEqual(
      cohort[2],
    );
    expect(f.beaRead).not.toHaveBeenCalled();
    expect(f.fedRead).not.toHaveBeenCalled();
  });

  it.each(["cancel", "view", "session"] as const)(
    "fences late reads after %s ends the pass",
    async (boundary) => {
      const f = await fixture();
      const { held, running } = pendingFirstPrice(f);
      if (boundary === "cancel") f.review.cancel();
      if (boundary === "view") {
        f.available.current = false;
        f.review.reconcile();
      }
      if (boundary === "session") {
        f.review.retire();
        f.markets.retire();
        f.bls.retire();
        f.bea.retire();
        f.fed.retire();
      }
      const ended = f.review.getSnapshot();
      expect(f.read.mock.calls[0]![1].aborted).toBe(true);
      held.resolve(pricePacket(priceRequest(0)));
      await running;
      expect(f.review.getSnapshot()).toBe(ended);
      expect(ended.phase).toBe(boundary === "cancel" ? "cancelled" : "retired");
      await f.review.start();
      expect(f.order).toEqual(["price-0"]);
      expect(f.blsRead).not.toHaveBeenCalled();
    },
  );

  it.each(["held", "immediate"] as const)(
    "leaves a %s manual restart at the final source notification outside the pass",
    async (settlement) => {
      const f = await fixture();
      for (const id of allIds.slice(0, 3)) f.review.choose(id, false);
      const replacement = { ...f.blsPacket, events: [] };
      const held = deferred<typeof replacement>();
      f.blsRead
        .mockImplementationOnce(() => {
          f.order.push("bls");
          return Promise.resolve(f.blsPacket);
        })
        .mockImplementationOnce(() => {
          f.order.push("bls-manual");
          return settlement === "held"
            ? held.promise
            : Promise.resolve(replacement);
        });
      const manualReads: ReturnType<typeof f.bls.load>[] = [];
      let restarted = false;
      f.bls.subscribe(() => {
        if (restarted) return;
        const snapshot = f.bls.getSnapshot();
        if (snapshot.busy || snapshot.calendar !== f.blsPacket) return;
        restarted = true;
        manualReads.push(f.bls.load());
      });
      f.review.preview();
      await f.review.start();
      expect(restarted).toBe(true);
      expect(f.review.getSnapshot().phase).toBe("retired");
      expect(f.order).toEqual(["bls", "bls-manual"]);
      expect(f.blsRead).toHaveBeenCalledTimes(2);
      expect(f.blsRead.mock.calls[1]![0].aborted).toBe(false);
      expect(f.beaRead).not.toHaveBeenCalled();
      expect(f.fedRead).not.toHaveBeenCalled();
      if (settlement === "held") {
        expect(f.bls.getSnapshot().busy).toBe(true);
        expect(f.bls.getSnapshot().calendar).toBe(f.blsPacket);
      }
      held.resolve(replacement);
      await expect(manualReads[0]).resolves.toBe("accepted");
      expect(f.bls.getSnapshot().calendar).toBe(replacement);
      expect(f.bls.getSnapshot().busy).toBe(false);
      expect(f.blsRead.mock.calls[1]![0].aborted).toBe(false);
      expect(f.review.getSnapshot().phase).toBe("retired");
    },
  );

  it.each(["held", "transient failure"] as const)(
    "retires the pass without cancelling a %s manual Price0 restart at global settlement",
    async (settlement) => {
      const f = await fixture();
      const firstPacket = pricePacket(priceRequest(0));
      const replacement = pricePacket(priceRequest(0));
      const held = deferred<ManagedEodHistoryResponseDto>();
      const completion = {
        held: () => held.promise,
        "transient failure": () =>
          Promise.reject<ManagedEodHistoryResponseDto>(
            new ManagedEodHistoryError("request_timeout"),
          ),
      };
      const expected = {
        held: { result: "accepted", packet: replacement },
        "transient failure": { result: "failed", packet: firstPacket },
      };
      f.read
        .mockImplementationOnce(() => {
          f.order.push("price-0");
          return Promise.resolve(firstPacket);
        })
        .mockImplementationOnce(() => {
          f.order.push("price-0-manual");
          return completion[settlement]();
        });
      const manualReads: ReturnType<typeof f.markets.loadListing>[] = [];
      let restarted = false;
      f.markets.subscribe(() => {
        const snapshot = f.markets.getSnapshot();
        if (restarted) return;
        if (snapshot.running) return;
        if (snapshot.rows[0]?.response !== firstPacket) return;
        restarted = true;
        manualReads.push(f.markets.loadListing(cohort[0]!.listingId));
      });
      f.review.preview();
      await f.review.start();
      expect(restarted).toBe(true);
      expect(f.review.getSnapshot().phase).toBe("retired");
      expect(f.order).toEqual(["price-0", "price-0-manual"]);
      expect(f.read).toHaveBeenCalledTimes(2);
      expect(f.read.mock.calls[1]![1].aborted).toBe(false);
      expect(f.blsRead).not.toHaveBeenCalled();
      expect(f.beaRead).not.toHaveBeenCalled();
      expect(f.fedRead).not.toHaveBeenCalled();
      if (settlement === "held") {
        expect(f.markets.getSnapshot().running).toBe(true);
        expect(f.markets.getSnapshot().rows[0]!.response).toBe(firstPacket);
      }
      held.resolve(replacement);
      await expect(manualReads[0]).resolves.toBe(expected[settlement].result);
      expect(f.markets.getSnapshot().rows[0]!.response).toBe(
        expected[settlement].packet,
      );
      expect(f.markets.getSnapshot().running).toBe(false);
      expect(f.read.mock.calls[1]![1].aborted).toBe(false);
      expect(f.review.getSnapshot().phase).toBe("retired");
      expect(f.order).toEqual(["price-0", "price-0-manual"]);
    },
  );

  it.each(["held", "immediate"] as const)(
    "does not cancel the %s independent whole-board load from the final Price0 notification",
    async (settlement) => {
      const f = await fixture();
      const firstPacket = pricePacket(priceRequest(0));
      const replacement = pricePacket(priceRequest(0));
      const held = deferred<ManagedEodHistoryResponseDto>();
      const completion = {
        held: () => held.promise,
        immediate: () => Promise.resolve(replacement),
      };
      f.read
        .mockImplementationOnce(() => {
          f.order.push("price-0");
          return Promise.resolve(firstPacket);
        })
        .mockImplementationOnce(() => {
          f.order.push("price-0-manual-board");
          return completion[settlement]();
        });
      const manualReads: ReturnType<typeof f.markets.load>[] = [];
      let restarted = false;
      f.markets.subscribe(() => {
        const snapshot = f.markets.getSnapshot();
        if (restarted) return;
        if (snapshot.running) return;
        if (snapshot.rows[0]?.response !== firstPacket) return;
        restarted = true;
        manualReads.push(f.markets.load());
      });
      f.review.preview();
      await f.review.start();
      expect(restarted).toBe(true);
      expect(f.review.getSnapshot().phase).toBe("retired");
      expect(
        f.read.mock.calls.slice(0, 2).map(([request]) => request.listingId),
      ).toEqual([cohort[0]!.listingId, cohort[0]!.listingId]);
      expect(f.read.mock.calls[1]![1].aborted).toBe(false);
      expect(f.blsRead).not.toHaveBeenCalled();
      expect(f.beaRead).not.toHaveBeenCalled();
      expect(f.fedRead).not.toHaveBeenCalled();
      if (settlement === "held") {
        expect(f.read).toHaveBeenCalledTimes(2);
        expect(f.markets.getSnapshot().running).toBe(true);
        expect(f.markets.getSnapshot().rows[0]!.response).toBe(firstPacket);
      }
      held.resolve(replacement);
      await expectCompletedManualBoard(f, manualReads[0], replacement);
    },
  );

  it("requires a new preview after board selection changes away and back", async () => {
    const f = await fixture();
    f.review.preview();
    f.markets.select(cohort[2]!.listingId);
    f.markets.select(cohort[0]!.listingId);
    expect(f.review.getSnapshot().canStart).toBe(false);
    expect(f.review.getSnapshot().phase).toBe("retired");
    await f.review.start();
    expect(f.read).not.toHaveBeenCalled();
  });
});
