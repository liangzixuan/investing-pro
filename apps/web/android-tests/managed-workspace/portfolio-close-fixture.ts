import type { ManagedNativeFixture } from "./fixture";
import {
  managedEodHistoryWindow,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRequestDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";

/** Invented raw closes on the fixture's authored day and its previous calendar day. */
export function portfolioCloseFixturePacket(
  request: ManagedEodHistoryRequestDto,
  security: ManagedEodIdentity,
  now = Date.now(),
) {
  const requestStartedAt = new Date(now).toISOString();
  const date = requestStartedAt.slice(0, 10);
  const previous = new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const packet = parseManagedEodHistoryResponse(
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: request.catalogSnapshotSha256,
      security,
      range: "1m",
      provider: "Tiingo",
      currency: "USD",
      priceBasis: "raw_close",
      window: managedEodHistoryWindow(requestStartedAt, "1m"),
      requestStartedAt,
      completedAt: new Date(now + 1000).toISOString(),
      rows: [
        { date: previous, close: "100.25" },
        { date, close: "110.25" },
      ],
    },
    request,
  );
  if (!packet) throw new Error("Invalid invented Portfolio close packet");
  return packet;
}

/** Fixed two-read native journey; all existing fixture resources remain independent. */
export function createPortfolioCloseNativeFixture(
  base: ManagedNativeFixture,
): ManagedNativeFixture {
  let reads = 0,
    aborted = 0,
    settled = 0;
  let catalogDigest: string | null = null;
  let held: (() => void) | null = null;
  const listeners = new Set<() => void>();
  let snapshot = base.getSnapshot();
  const publish = () => {
    snapshot = {
      ...base.getSnapshot(),
      eod: reads,
      eodAborted: aborted,
      eodLateResolved: settled,
    };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const security = base.priceCoverage.find(
    (listing) => listing.listingId === "listing-zero",
  );
  if (!security) throw new Error("Missing invented Portfolio close listing");
  return {
    ...base,
    api: {
      ...base.api,
      status: async (signal) => {
        const result = await base.api.status(signal);
        catalogDigest = result.snapshot.snapshotSha256;
        return result;
      },
      eodHistory: (request, signal) => {
        if (
          signal.aborted ||
          held ||
          reads >= 2 ||
          request.catalogSnapshotSha256 !== catalogDigest ||
          request.listingId !== security.listingId ||
          request.range !== "1m"
        )
          return Promise.reject(
            new Error("Unexpected invented Portfolio close request"),
          );
        const packet = portfolioCloseFixturePacket(request, security);
        reads += 1;
        publish();
        if (reads === 1) return Promise.resolve(packet);
        return new Promise((resolve) => {
          const onAbort = () => {
            aborted += 1;
            publish();
          };
          signal.addEventListener("abort", onAbort, { once: true });
          // Deliberately settle after abort so the real review must refuse the late packet.
          held = () => {
            signal.removeEventListener("abort", onAbort);
            resolve(packet);
          };
        });
      },
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    settleCancelledEod: () => {
      if (!held || reads !== 2 || aborted !== 1 || settled !== 0)
        throw new Error(
          "Only the cancelled Portfolio close refresh may settle",
        );
      const finish = held;
      held = null;
      settled += 1;
      publish();
      finish();
    },
  };
}
