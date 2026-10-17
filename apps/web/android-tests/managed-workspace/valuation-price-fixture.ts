import {
  encodeMainWatchlistPayload,
  parseManagedEodHistoryRequest,
  parseManagedWatchlistCommand,
  type MainWatchlistPayload,
  type ManagedWatchlistDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import type { SharedNativeFixture } from "./fixture";

export const valuationPricePrefix = "Valuation price thesis";
const digest = `sha256:${"a".repeat(64)}`;
/** Independent literal pins for authored DCF140 against the last raw close110.000000000000000003. */
export const valuationPriceExpectedNote = [
  valuationPricePrefix,
  `Authored valuation: ZERO (XNAS), listing listing-zero, security security-zero, class class-zero, issuer issuer-zero, CIK unavailable, catalog ${digest}; base scenario.`,
  "All money is USD; shares are diluted shares; rates are percent. Assumptions are authored, not reported financial facts or current prices. Scenario context, not a recommendation.",
  "DCF authored-cash-flow-dcf-v1, schema 1.0.0: starting unlevered cash flow 100; signed enterprise-to-equity bridge 100; shares 10; years 5; WACC 10%; terminal growth 0%; annual cash-flow growth 10%.",
  "Enterprise value 1500.00; equity value 1400.00; value/share 140.00; explicit cash-flow present value 500.00; terminal present value 1000.00; terminal value 1610.51; terminal share of enterprise value 66.67%.",
  "Method: CF(t)=starting CF*(1+growth)^t; discount each year-end CF by (1+WACC)^t; terminal=final CF*(1+terminal growth)/(WACC-terminal growth); enterprise=sum of present values; equity=enterprise-signed bridge; value/share=equity/shares. Decimal arithmetic, half-up; money and value/share 2 decimals.",
  "Dated raw-close comparison: Tiingo raw USD 110.000000000000000003 on 2026-09-19; 1m window 2026-08-20 through 2026-09-20; source request 2026-09-20T00:00:00.000Z, completed 2026-09-20T00:00:01.000Z; loaded response. Displayed authored value/share 140.00; difference 27.27% = 100*(model/close-1), half-up to 2 decimals. Raw price is unadjusted for splits/dividends; equivalence with authored diluted shares is unverified. Dated scenario context, not a current quote or price target.",
].join(" ");
export interface NativeValuationPriceMetadata {
  readonly prefix: string;
  readonly expectedNote: string;
}
type State = ReturnType<SharedNativeFixture["getSnapshot"]>;
type Counter =
  | "load"
  | "save"
  | "eod"
  | "annual"
  | "filings"
  | "calendar"
  | "fed"
  | "search";

/** Existing invented raw packet, one explicit source read, exact whole-note Save and fresh read. */
export function createValuationPriceNativeFixture(base: SharedNativeFixture) {
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
  const unexpected = (operation: string): Promise<never> =>
    Promise.reject(
      new Error(`Unexpected valuation price operation: ${operation}`),
    );
  let saved: ManagedWatchlistDto | null = null;
  let original: MainWatchlistPayload | null = null;
  const api: ManagedApi = {
    ...base.api,
    load: async (signal) => {
      if (
        signal.aborted ||
        snapshot.load >= 2 ||
        (snapshot.load === 1 && snapshot.save !== 1)
      )
        return unexpected("load");
      count("load");
      if (!saved) {
        saved = structuredClone(await base.api.load(signal));
        original = structuredClone(saved.payload);
      }
      return structuredClone(saved);
    },
    eodHistory: (input, signal) => {
      const request = parseManagedEodHistoryRequest(input);
      if (
        signal.aborted ||
        request?.catalogSnapshotSha256 !== original?.snapshotSha256 ||
        request?.listingId !== "listing-zero" ||
        request.range !== "1m" ||
        snapshot.status !== 1 ||
        snapshot.marketsResolve !== 1 ||
        snapshot.load !== 1 ||
        snapshot.save !== 0 ||
        snapshot.eod !== 0 ||
        snapshot.annual !== 0 ||
        snapshot.filings !== 0
      )
        return unexpected("eodHistory");
      count("eod");
      return base.api.eodHistory(input, signal);
    },
    save: (command, signal) => {
      const captured = parseManagedWatchlistCommand(command);
      const expected = original && {
        ...original,
        memberships: original.memberships.map((member, index) =>
          index === 0
            ? { ...member, note: valuationPriceExpectedNote }
            : member,
        ),
      };
      if (
        signal.aborted ||
        !expected ||
        snapshot.eod !== 1 ||
        snapshot.annual !== 0 ||
        snapshot.filings !== 0 ||
        snapshot.load !== 1 ||
        snapshot.save !== 0 ||
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
    annualReport: () => {
      count("annual");
      return unexpected("annualReport");
    },
    recentFilings: () => {
      count("filings");
      return unexpected("recentFilings");
    },
    search: () => {
      count("search");
      return unexpected("search");
    },
    economicCalendar: () => {
      count("calendar");
      return unexpected("economicCalendar");
    },
    monetaryAnnouncements: () => {
      count("fed");
      return unexpected("monetaryAnnouncements");
    },
    loadPortfolio: () => unexpected("loadPortfolio"),
    savePortfolio: () => unexpected("savePortfolio"),
    loadFollowups: () => unexpected("loadFollowups"),
    saveFollowups: () => unexpected("saveFollowups"),
  };
  return {
    ...base,
    api,
    financialReview: null,
    valuationPrice: Object.freeze({
      prefix: valuationPricePrefix,
      expectedNote: valuationPriceExpectedNote,
    }),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
