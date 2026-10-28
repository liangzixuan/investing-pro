import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  parseValuationAssumptionEntry,
  type MainWatchlistPayload,
  type ManagedWatchlistDto,
} from "@research-cockpit/contracts";
import {
  createSavedValuationNativeFixture,
  savedValuationInputs,
  type SharedNativeFixture,
} from "./fixture";

export const annualRevenueModelPrefix = "Revenue basis thesis";
export const annualRevenueModelCitation = [
  "Annual revenue basis for authored starting revenue: ZERO (XNAS); Revenues USD 1000, 2025-01-01 to 2025-12-31.",
  "10-K filed 2026-02-01; accession 0000000001-26-000001; https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm.",
  "Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z.",
  "Current-use policy at original load: eligible.",
  "Chosen reported revenue supplies authored starting revenue only. No other assumption or DCF cash flow is inferred; source dates are unchanged.",
].join(" ");
export const annualRevenueModelExpectedNote = [
  annualRevenueModelPrefix,
  `Authored valuation: ZERO (XNAS), listing listing-zero, security security-zero, class class-zero, issuer issuer-zero, CIK unavailable, catalog sha256:${"a".repeat(64)}; base scenario.`,
  "All money is USD; shares are diluted shares; rates are percent. Assumptions are authored, not reported financial facts or current prices. Scenario context, not a recommendation.",
  "Exit multiple authored-exit-multiple-v1, engine exit-multiple-v1, schema 1.0.0: base revenue 1000; cash 100.00; debt 200.00; shares 100.00; years 5; discount 10.00%; annual revenue growth 10.00%; target EBITDA margin 20.00%; exit multiple 10.00x.",
  "Final revenue 1610.510; final EBITDA 322.102; terminal enterprise value 3221.020; present enterprise value 2000.000; equity value 1900.000; value/share 19.00.",
  "Method: revenue=base revenue*(1+growth)^years; EBITDA=revenue*margin; terminal enterprise=EBITDA*exit multiple; discount year-end terminal enterprise by (1+discount)^years; equity=present enterprise+cash-debt; value/share=equity/shares. Interim cash flows excluded. Decimal arithmetic, half-up; money 3 decimals; value/share 2 decimals.",
  annualRevenueModelCitation,
].join(" ");

/** One explicit Annual read, exact authored raw maps and two independent RAM resources. */
export function createAnnualRevenueModelBasisNativeFixture(
  base: SharedNativeFixture,
) {
  if (!savedValuationInputs) throw new Error("Missing invented authored maps");
  const expected = parseValuationAssumptionEntry({
    ...savedValuationInputs,
    exit: {
      ...savedValuationInputs.exit,
      inputs: { ...savedValuationInputs.exit.inputs, baseRevenue: "1000" },
    },
  });
  if (!expected)
    throw new Error("Invalid invented Annual revenue model inputs");
  const savedInputs = createSavedValuationNativeFixture(base, expected);
  const listeners = new Set<() => void>();
  let loads = 0,
    saves = 0;
  let saved: ManagedWatchlistDto | null = null;
  let original: MainWatchlistPayload | null = null;
  let snapshot = base.getSnapshot();
  const publish = () => {
    snapshot = { ...base.getSnapshot(), load: loads, save: saves };
    for (const listener of listeners) listener();
  };
  base.subscribe(publish);
  const refuse = (): never => {
    throw new Error("Unexpected invented Annual revenue model basis operation");
  };
  return {
    ...savedInputs,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    api: {
      ...savedInputs.api,
      load: async (signal: AbortSignal) => {
        if (signal.aborted || loads >= 2 || (loads === 1 && saves !== 1))
          return refuse();
        loads++;
        publish();
        if (!saved) {
          saved = structuredClone(await base.api.load(signal));
          original = structuredClone(saved.payload);
        }
        return structuredClone(saved);
      },
      save: (
        input: Parameters<SharedNativeFixture["api"]["save"]>[0],
        signal: AbortSignal,
      ) => {
        const command = parseManagedWatchlistCommand(input);
        const wanted = original && {
          ...original,
          memberships: original.memberships.map((member, index) =>
            index === 0
              ? { ...member, note: annualRevenueModelExpectedNote }
              : member,
          ),
        };
        if (
          signal.aborted ||
          !command ||
          !wanted ||
          loads !== 1 ||
          saves !== 0 ||
          command.expectedVersion !== 1 ||
          saved?.version !== 1 ||
          snapshot.annual !== 1 ||
          savedInputs.savedValuation.getSnapshot().save !== 1 ||
          encodeMainWatchlistPayload(command.payload) !==
            encodeMainWatchlistPayload(wanted)
        )
          return refuse();
        saved = { version: 2, payload: structuredClone(command.payload) };
        saves++;
        publish();
        return Promise.resolve({ ...structuredClone(saved), replayed: false });
      },
      annualReport: (
        input: Parameters<SharedNativeFixture["api"]["annualReport"]>[0],
        signal: AbortSignal,
      ) => {
        if (
          signal.aborted ||
          loads !== 1 ||
          saves !== 0 ||
          snapshot.annual !== 0
        )
          return refuse();
        return base.api.annualReport(input, signal);
      },
      eodHistory: refuse,
      recentFilings: refuse,
      search: refuse,
      economicCalendar: refuse,
      monetaryAnnouncements: refuse,
      loadPortfolio: refuse,
      savePortfolio: refuse,
      loadFollowups: refuse,
      saveFollowups: refuse,
    },
  };
}
