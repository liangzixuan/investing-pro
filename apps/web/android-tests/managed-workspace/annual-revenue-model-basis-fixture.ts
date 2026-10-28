import {
  encodeMainWatchlistPayload,
  parseManagedWatchlistCommand,
  parseValuationAssumptionEntry,
  type MainWatchlistPayload,
  type ManagedWatchlistDto,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import type {
  ManagedNativeFixture,
  SavedValuationNativeControls,
  SharedNativeFixture,
} from "./fixture";

type SavedFixture = ManagedNativeFixture & {
  readonly savedValuation: SavedValuationNativeControls;
};
type Api = SharedNativeFixture["api"];
export const annualRevenueModelPrefix = "Revenue basis thesis";
export const annualRevenueModelCitation = [
  "Annual revenue basis for authored starting revenue: ZERO (XNAS); Revenues USD 1000, 2025-01-01 to 2025-12-31.",
  "SEC source CIK 0000000001; 10-K filed 2026-02-01; accession 0000000001-26-000001; https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm.",
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

function refuse(): never {
  throw new Error("Unexpected invented Annual revenue model basis operation");
}
export function annualRevenueModelInputs(seed: ValuationAssumptionEntry) {
  const expected = parseValuationAssumptionEntry({
    ...seed,
    exit: {
      ...seed.exit,
      inputs: { ...seed.exit.inputs, baseRevenue: "1000" },
    },
  });
  if (!expected)
    throw new Error("Invalid invented Annual revenue model inputs");
  return expected;
}

/** Each resource has independent admission, a full command comparison and bounded RAM custody. */
class AnnualRevenueModelStore {
  private loads = 0;
  private saves = 0;
  private saved: ManagedWatchlistDto | null = null;
  private original: MainWatchlistPayload | null = null;
  private snapshot: ReturnType<SharedNativeFixture["getSnapshot"]>;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly base: SavedFixture) {
    this.snapshot = base.getSnapshot();
    base.subscribe(this.publish);
  }
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private readonly publish = () => {
    this.snapshot = {
      ...this.base.getSnapshot(),
      load: this.loads,
      save: this.saves,
    };
    for (const listener of this.listeners) listener();
  };
  private admitLoad(signal: AbortSignal) {
    if (signal.aborted) refuse();
    if (this.loads >= 2) refuse();
    if (this.loads === 1 && this.saves !== 1) refuse();
  }
  readonly load: Api["load"] = async (signal) => {
    this.admitLoad(signal);
    this.loads++;
    this.publish();
    if (!this.saved) {
      this.saved = structuredClone(await this.base.api.load(signal));
      this.original = structuredClone(this.saved.payload);
    }
    return structuredClone(this.saved);
  };
  private requireSaveState(signal: AbortSignal): MainWatchlistPayload {
    if (signal.aborted) return refuse();
    if (!this.original) return refuse();
    if (this.loads !== 1) refuse();
    if (this.saves !== 0) refuse();
    if (this.saved?.version !== 1) refuse();
    if (this.snapshot.annual !== 1) refuse();
    if (this.base.savedValuation.getSnapshot().save !== 1) refuse();
    return this.original;
  }
  private expectedPayload(
    original: MainWatchlistPayload,
  ): MainWatchlistPayload {
    return {
      ...original,
      memberships: original.memberships.map((member, index) =>
        index === 0
          ? { ...member, note: annualRevenueModelExpectedNote }
          : member,
      ),
    };
  }
  private captureSave(input: Parameters<Api["save"]>[0], signal: AbortSignal) {
    const original = this.requireSaveState(signal);
    const command = parseManagedWatchlistCommand(input);
    if (!command) return refuse();
    if (command.expectedVersion !== 1) return refuse();
    const expected = this.expectedPayload(original);
    if (
      encodeMainWatchlistPayload(command.payload) !==
      encodeMainWatchlistPayload(expected)
    )
      return refuse();
    return command;
  }
  readonly save: Api["save"] = (input, signal) => {
    const command = this.captureSave(input, signal);
    this.saved = { version: 2, payload: structuredClone(command.payload) };
    this.saves++;
    this.publish();
    return Promise.resolve({ ...structuredClone(this.saved), replayed: false });
  };
  private admitAnnual(signal: AbortSignal) {
    if (signal.aborted) refuse();
    if (this.loads !== 1) refuse();
    if (this.saves !== 0) refuse();
    if (this.snapshot.annual !== 0) refuse();
  }
  readonly annualReport: Api["annualReport"] = (input, signal) => {
    this.admitAnnual(signal);
    return this.base.api.annualReport(input, signal);
  };
}

/** Receive the already-created strict saved-input store; no runtime import cycle. */
export function createAnnualRevenueModelBasisNativeFixture(base: SavedFixture) {
  const store = new AnnualRevenueModelStore(base);
  return {
    ...base,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    api: {
      ...base.api,
      load: store.load,
      save: store.save,
      annualReport: store.annualReport,
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
