import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  type MainWatchlistPayload,
  type ManagedEodHistoryResponseDto,
  type ManagedWatchlistDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";

export const priceStudiesNoteDraft =
  "Price studies draft ZERO XNAS raw close studies: Loaded-window raw close change: 10.0000% (3 observed closes; 2026-09-17 through 2026-09-19; Raw price change excludes dividends and split adjustments.); Maximum observed drawdown: 0.0000% (3 observed closes; 2026-09-17 through 2026-09-19; Nonnegative decline magnitude; peak 2026-09-17, trough 2026-09-17.). Tiingo raw USD closes, unadjusted for splits/dividends; observed gaps are not filled. Loaded 1m window 2026-08-20 through 2026-09-20; requested 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:01.000Z. Formula set 1.0.0; derived percentages rounded half-up to 4 decimal places. Descriptive observations, not a recommendation or forecast.";

type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter = "load" | "save" | "eod";

function readOrderMatches(state: State) {
  if (state.eod === 0) return state.save === 0 && state.load === 1;
  return state.save === 1 && state.load === 2;
}

/** Two explicit reads of the existing invented packet, around one exact whole-list Save. */
export function createPriceStudiesNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const overrides: Partial<Record<Counter, number>> = {};
  let snapshot: State = base.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    snapshot = { ...base.getSnapshot(), ...overrides };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const count = (key: Counter) => {
    overrides[key] = snapshot[key] + 1;
    publish();
  };
  let saved: ManagedWatchlistDto | null = null;
  let original: MainWatchlistPayload | null = null;
  let packet: ManagedEodHistoryResponseDto | null = null;
  const api: ManagedApi = {
    ...base.api,
    load: async (signal) => {
      count("load");
      if (!saved) {
        saved = structuredClone(await base.api.load(signal));
        original = structuredClone(saved.payload);
      }
      return structuredClone(saved);
    },
    eodHistory: (request, signal) => {
      if (
        signal.aborted ||
        request.catalogSnapshotSha256 !== original?.snapshotSha256 ||
        request.listingId !== "listing-zero" ||
        request.range !== "1m" ||
        snapshot.status !== 1 ||
        snapshot.marketsResolve !== 1 ||
        snapshot.eod >= 2 ||
        !readOrderMatches(snapshot)
      )
        throw new Error("Unexpected invented price studies read or order");
      count("eod");
      if (packet) return Promise.resolve(structuredClone(packet));
      return base.api.eodHistory(request, signal).then((response) => {
        packet = structuredClone(response);
        return structuredClone(packet);
      });
    },
    save: (command, signal) => {
      const captured = parseManagedWatchlistCommand(command);
      const expected = original && {
        ...original,
        memberships: original.memberships.map((member, index) =>
          index === 0 ? { ...member, note: priceStudiesNoteDraft } : member,
        ),
      };
      if (
        signal.aborted ||
        !expected ||
        snapshot.eod !== 1 ||
        snapshot.load !== 1 ||
        snapshot.annual !== 0 ||
        snapshot.filings !== 0 ||
        saved?.version !== 1 ||
        captured?.expectedVersion !== 1 ||
        encodeMainWatchlistPayload(captured.payload) !==
          encodeMainWatchlistPayload(expected)
      ) {
        count("save");
        return Promise.reject(new Error("Unexpected fixture operation: save"));
      }
      count("save");
      saved = { version: 2, payload: structuredClone(captured.payload) };
      return Promise.resolve({ ...structuredClone(saved), replayed: false });
    },
  };
  return {
    ...base,
    api,
    financialReview: null,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
