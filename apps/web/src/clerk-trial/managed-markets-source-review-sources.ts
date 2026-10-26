import type { ManagedBlsCalendar } from "./managed-bls-calendar";
import type { ManagedBeaReleaseAgenda } from "./managed-bea-release-agenda";
import type { ManagedFedAnnouncements } from "./managed-fed-announcements";
import type { ManagedMarkets } from "./managed-markets";
import { ManagedMarketsSourceReview } from "./managed-markets-source-review";
import type {
  MarketsSourceReviewPort,
  MarketsSourceView,
} from "./managed-markets-source-review-types";

/** Tokens follow source activity, not a freshness threshold or a common clock. */
function tokenReader() {
  let fields: readonly unknown[] = [];
  let token = Symbol();
  return (next: readonly unknown[]) => {
    if (
      next.length !== fields.length ||
      next.some((value, index) => value !== fields[index])
    ) {
      fields = next;
      token = Symbol();
    }
    return token;
  };
}
function pricePort(
  markets: ManagedMarkets,
  index: number,
): MarketsSourceReviewPort {
  const token = tokenReader();
  const read = (): MarketsSourceView => {
    const state = markets.getSnapshot(),
      row = state.rows[index];
    const response = row?.response,
      last = response?.rows.at(-1);
    return {
      token: token([
        state.active,
        state.catalogSnapshotSha256,
        state.catalogChanged,
        state.selectedListingId,
        markets.getReadToken(row?.listing.listingId ?? ""),
        row?.listing,
        row?.response,
        row?.showingPrevious,
        row?.running,
        row?.error,
        row?.message,
      ]),
      label: row
        ? `${row.listing.symbol} price history`
        : `Company board history ${index + 1}`,
      identity: row?.listing ?? null,
      eligible:
        state.active &&
        !state.resolving &&
        !state.catalogChanged &&
        row !== undefined,
      busy: state.running || state.resolving,
      loaded: response != null,
      empty: false,
      evidence: response
        ? `${row?.showingPrevious ? "Previous history. " : ""}Trading date ${last?.date}; raw USD close. Window ${response.window.startDate} to ${response.window.endDate}. Request ${response.requestStartedAt} to ${response.completedAt}.`
        : "No history loaded. Resolve the current board listings before requesting prices.",
    };
  };
  return {
    id: `price-${index}`,
    read,
    subscribe: markets.subscribe,
    cancel: () => markets.cancel(),
    load: () => {
      const row = markets.getSnapshot().rows[index];
      return row
        ? markets.loadListing(row.listing.listingId)
        : Promise.resolve("not_started");
    },
  };
}
interface Packet {
  readonly fetchedAt: string;
}
function packetPort<T extends Packet>(
  id: string,
  label: string,
  model: {
    subscribe: (listener: () => void) => () => void;
    load: MarketsSourceReviewPort["load"];
    cancel: () => void;
  },
  snapshot: () => {
    readonly packet: T | null;
    readonly busy: boolean;
    readonly previous: boolean;
  },
  count: (packet: T) => number,
  qualification: (packet: T) => string,
): MarketsSourceReviewPort {
  const token = tokenReader();
  return {
    id,
    subscribe: model.subscribe,
    load: () => model.load(),
    cancel: () => model.cancel(),
    read: () => {
      const state = snapshot(),
        packet = state.packet;
      return {
        token: token([packet, state.busy, state.previous]),
        label,
        identity: null,
        eligible: true,
        busy: state.busy,
        loaded: packet !== null,
        empty: packet !== null && count(packet) === 0,
        evidence: packet
          ? `${state.previous ? "Previous packet. " : ""}Retrieved UTC ${packet.fetchedAt}. ${qualification(packet)}`
          : "Not loaded. No source read has been confirmed.",
      };
    },
  };
}
export function createManagedMarketsSourceReview(
  markets: ManagedMarkets,
  bls: ManagedBlsCalendar,
  bea: ManagedBeaReleaseAgenda,
  fed: ManagedFedAnnouncements,
  available: () => boolean,
) {
  const ports: MarketsSourceReviewPort[] = [0, 1, 2].map((index) =>
    pricePort(markets, index),
  );
  ports.push(
    packetPort(
      "bls",
      "BLS release calendar",
      bls,
      () => {
        const s = bls.getSnapshot();
        return {
          packet: s.calendar,
          busy: s.busy,
          previous: s.showingPrevious,
        };
      },
      (p) => p.events.length,
      (p) =>
        `${p.events.length} scheduled releases; window ${p.window.fromInclusive} (inclusive) to ${p.window.toExclusive} (exclusive).`,
    ),
  );
  ports.push(
    packetPort(
      "bea",
      "BEA release agenda",
      bea,
      () => {
        const s = bea.getSnapshot();
        return { packet: s.agenda, busy: s.busy, previous: s.showingPrevious };
      },
      (p) => p.events.length,
      (p) =>
        `${p.events.length} scheduled releases; window ${p.window.fromInclusive} (inclusive) to ${p.window.toExclusive} (exclusive).`,
    ),
  );
  ports.push(
    packetPort(
      "fed",
      "Federal Reserve announcements",
      fed,
      () => {
        const s = fed.getSnapshot();
        return {
          packet: s.announcements,
          busy: s.busy,
          previous: s.showingPrevious,
        };
      },
      (p) => p.items.length,
      (p) =>
        `${p.items.length} displayed announcements of ${p.availableItemCount} available; publication times remain in the source panel.`,
    ),
  );
  return new ManagedMarketsSourceReview(ports, available);
}
