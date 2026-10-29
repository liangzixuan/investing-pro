import type { ManagedApi } from "../../src/clerk-trial/managed-api";
import {
  annualComparisonResponse,
  annualComparisonOperatingRows,
  annualComparisonBalanceRows,
} from "../../src/clerk-trial/test-canonical-annual-comparison-fixture";
import type { SharedNativeFixture } from "./fixture";
import { createScreenComparisonNativeFixture } from "./screen-comparison-fixture";

export const screenComparisonReportClocks = Object.freeze({
  left: "2026-09-20T00:00:00.000Z",
  right: "2026-09-21T03:04:05.000Z",
});
type Refusal =
  | "price"
  | "filings"
  | "interim"
  | "cpi"
  | "bls"
  | "bea"
  | "fed"
  | "search"
  | "resourceLoad"
  | "resourceSave";
type Refusals = Readonly<Record<Refusal, number>>;
export interface ScreenComparisonReportNativeMetadata {
  readonly packets: readonly Awaited<
    ReturnType<typeof annualComparisonResponse>
  >[];
  readonly getSnapshot: () => Refusals;
  readonly subscribe: (listener: () => void) => () => void;
}

/** A separate synthetic report journey; the earlier comparison fixture stays exact. */
export async function createScreenComparisonReportNativeFixture(
  base: SharedNativeFixture,
) {
  const screen = await createScreenComparisonNativeFixture(base);
  const packets = await Promise.all(
    (["left", "right"] as const).map((side) =>
      annualComparisonResponse(side, {
        cutoffAt: screenComparisonReportClocks[side],
        operatingRows: annualComparisonOperatingRows(side),
        balanceRows: annualComparisonBalanceRows(side),
      }),
    ),
  );
  let refused: Refusals = {
    price: 0,
    filings: 0,
    interim: 0,
    cpi: 0,
    bls: 0,
    bea: 0,
    fed: 0,
    search: 0,
    resourceLoad: 0,
    resourceSave: 0,
  };
  const listeners = new Set<() => void>();
  const refuse = (operation: Refusal): Promise<never> => {
    refused = { ...refused, [operation]: refused[operation] + 1 };
    for (const listener of listeners) listener();
    return Promise.reject(
      new Error(`Unexpected invented comparison report ${operation}`),
    );
  };
  const api: ManagedApi = {
    ...screen.api,
    annualReport: async (input, signal) => {
      // The established dispatcher retains exact request ownership and real pacing.
      const admitted = await screen.api.annualReport(input, signal);
      const packet = packets.find(
        (row) => row.security.listingId === admitted.security.listingId,
      );
      if (!packet)
        throw new Error("Unknown invented comparison report listing");
      return structuredClone(packet);
    },
    eodHistory: () => refuse("price"),
    recentFilings: () => refuse("filings"),
    interimReport: () => refuse("interim"),
    cpiHeadlines: () => refuse("cpi"),
    blsCalendar: () => refuse("bls"),
    economicCalendar: () => refuse("bea"),
    monetaryAnnouncements: () => refuse("fed"),
    search: () => refuse("search"),
    loadPortfolio: () => refuse("resourceLoad"),
    loadFollowups: () => refuse("resourceLoad"),
    loadValuationAssumptions: () => refuse("resourceLoad"),
    savePortfolio: () => refuse("resourceSave"),
    saveFollowups: () => refuse("resourceSave"),
    saveValuationAssumptions: () => refuse("resourceSave"),
    save: () => refuse("resourceSave"),
  };
  return {
    ...screen,
    api,
    screenComparisonReport: Object.freeze({
      packets,
      getSnapshot: () => refused,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  };
}
