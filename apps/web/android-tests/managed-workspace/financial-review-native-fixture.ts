import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  type ManagedWatchlistDto,
  type MainWatchlistPayload,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "../../src/clerk-trial/api";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import { financialReviewResponse } from "../../src/clerk-trial/financial-review-fixture";
import { proposeFinancialReviewNote } from "../../src/clerk-trial/managed-financial-review-note";
import type { SharedNativeFixture, ManagedNativeFixture } from "./fixture";

type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter =
  | "load"
  | "save"
  | "status"
  | "annual"
  | "refreshFailed"
  | "aborted"
  | "lateResolved"
  | "eod"
  | "filings"
  | "search"
  | "calendar"
  | "fed";

/** One fixed invented journey; no transport, storage, credential or source fallback. */
export async function createFinancialReviewNativeFixture(
  base: SharedNativeFixture,
): Promise<ManagedNativeFixture> {
  const packet = await financialReviewResponse();
  const latePacket = await financialReviewResponse({
    operatingIncome: "999.875",
  });
  const prefix = "Financial review thesis · Café 東京 📈";
  const expectedNote = proposeFinancialReviewNote(
    prefix,
    packet,
    ["operatingIncome", "shareholdersEquity"],
    false,
  ).note;
  if (!expectedNote) throw new Error("Invalid invented financial review note");
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
  const unexpected = (key: Counter): Promise<never> => {
    count(key);
    return Promise.reject(
      new Error(`Unexpected financial review operation: ${key}`),
    );
  };
  let saved: ManagedWatchlistDto | null = null;
  let original: MainWatchlistPayload | null = null;
  let pending: ((value: PersonalSecAnnualEvidenceResponseDto) => void) | null =
    null;
  const unrelatedReads = () =>
    snapshot.eod !== 0 ||
    snapshot.marketsEod !== 0 ||
    snapshot.filings !== 0 ||
    snapshot.search !== 0 ||
    snapshot.resolve !== 0 ||
    snapshot.calendar !== 0 ||
    snapshot.fed !== 0 ||
    snapshot.token !== 0 ||
    snapshot.signOut !== 0;
  const api: ManagedApi = {
    ...base.api,
    load: async (signal) => {
      count("load");
      if (
        signal.aborted ||
        snapshot.load > 2 ||
        (snapshot.load === 2 && (snapshot.save !== 1 || saved?.version !== 2))
      )
        throw new Error("Unexpected financial review watchlist read");
      if (snapshot.load === 1) {
        // This is the user's first explicit load, never a construction-time seed read.
        saved = structuredClone(await base.api.load(signal));
        original = structuredClone(saved.payload);
      }
      if (!saved) throw new Error("Load the invented watchlist first");
      return structuredClone(saved);
    },
    status: (signal) => {
      count("status");
      if (snapshot.status === 1) return base.api.status(signal);
      if (
        snapshot.status !== 2 ||
        snapshot.annual !== 4 ||
        !pending ||
        snapshot.save !== 1 ||
        snapshot.load !== 2 ||
        snapshot.aborted !== 1 ||
        snapshot.lateResolved !== 1
      )
        throw new Error("Hold fourth financial review read before retirement");
      return Promise.reject(new TrialApiError("unauthenticated"));
    },
    save: (command, signal) => {
      const captured = parseManagedWatchlistCommand(command);
      const expected: MainWatchlistPayload | null = original
        ? {
            ...original,
            memberships: [
              original.memberships[1]!,
              { ...original.memberships[0]!, note: expectedNote },
            ],
          }
        : null;
      if (
        signal.aborted ||
        !expected ||
        snapshot.save !== 0 ||
        snapshot.load !== 1 ||
        snapshot.status !== 1 ||
        snapshot.annual !== 3 ||
        snapshot.refreshFailed !== 1 ||
        snapshot.aborted !== 1 ||
        snapshot.lateResolved !== 1 ||
        pending ||
        unrelatedReads() ||
        saved?.version !== 1 ||
        captured?.expectedVersion !== 1 ||
        encodeMainWatchlistPayload(captured.payload) !==
          encodeMainWatchlistPayload(expected)
      )
        return unexpected("save");
      count("save");
      saved = { version: 2, payload: structuredClone(captured.payload) };
      return Promise.resolve({ ...structuredClone(saved), replayed: false });
    },
    annualReport: (request, signal) => {
      if (
        signal.aborted ||
        pending ||
        request.schemaVersion !== "5.0.0" ||
        request.catalogSnapshotSha256 !== original?.snapshotSha256 ||
        request.listingId !== "listing-zero" ||
        request.symbol !== "ZERO" ||
        snapshot.status !== 1 ||
        snapshot.annual >= 4 ||
        (snapshot.annual === 2 && snapshot.refreshFailed !== 1) ||
        (snapshot.annual === 3 &&
          (snapshot.save !== 1 ||
            snapshot.load !== 2 ||
            snapshot.aborted !== 1 ||
            snapshot.lateResolved !== 1))
      )
        throw new Error("Unexpected financial review Annual request or order");
      count("annual");
      if (snapshot.annual === 1)
        return Promise.resolve(structuredClone(packet));
      if (snapshot.annual === 2) {
        count("refreshFailed");
        return Promise.reject(new TrialApiError("unavailable"));
      }
      signal.addEventListener("abort", () => count("aborted"), { once: true });
      // Ignore abort deliberately: the real model must fence this changed late source.
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
    eodHistory: () => unexpected("eod"),
    recentFilings: () => unexpected("filings"),
    search: () => unexpected("search"),
    economicCalendar: () => unexpected("calendar"),
    monetaryAnnouncements: () => unexpected("fed"),
  };
  return {
    ...base,
    api,
    financialReview: {
      prefix,
      expectedNote,
      generation: structuredClone(packet.evidence.generation),
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    settleCancelledRead: () => {
      if (
        !pending ||
        snapshot.aborted !== snapshot.lateResolved + 1 ||
        ![3, 4].includes(snapshot.annual) ||
        (snapshot.annual === 4 && snapshot.status !== 2)
      )
        throw new Error("Only an aborted financial review read may settle");
      const resolve = pending;
      pending = null;
      resolve(structuredClone(latePacket));
      void Promise.resolve().then(() => count("lateResolved"));
    },
    enableRefreshScenario: () => {
      throw new Error(
        "Financial review uses its fixed explicit source sequence",
      );
    },
    failRefresh: () => {
      throw new Error(
        "Financial review fails only its second explicit source read",
      );
    },
  };
}
