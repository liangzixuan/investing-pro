import { registerPlugin } from "@capacitor/core";
import type { ManagedNativeFixture, SharedNativeFixture } from "./fixture";
import { createPortfolioNativeFixture } from "./portfolio-fixture";
import { createPortfolioCloseNativeFixture } from "./portfolio-close-fixture";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import {
  createNativePortfolioReviewReportAdapter,
  type InvestmentPortfolioReviewReportPlugin,
} from "../../src/clerk-trial/portfolio-review-report-delivery";

/** This fixed test scenario changes only invented display metadata and RAM resources. */
export function createPortfolioReviewReportNativeFixture(
  base: SharedNativeFixture,
): ManagedNativeFixture {
  const priceCoverage = base.priceCoverage.map((row) =>
    row.listingId === "listing-zero"
      ? { ...row, issuerName: "Zero <script>alert(1)</script> & Company" }
      : row,
  );
  return createPortfolioCloseNativeFixture(
    createPortfolioNativeFixture({ ...base, priceCoverage }),
  );
}

type PortfolioResourceState = ReturnType<
  ManagedWorkspace["portfolio"]["coordinator"]["getSnapshot"]
>;
type Ledger = NonNullable<
  NonNullable<PortfolioResourceState["draft"]>["ledger"]
>;
type Listing = Ledger["identities"][number];
function canAuthor(state: PortfolioResourceState) {
  if (state.phase !== "idle") return false;
  if (state.baseVersion !== 0) return false;
  return state.draft?.ledger === null;
}
function inventedReportLedger(ledger: Ledger, listing: Listing): Ledger {
  const date = new Date().toISOString().slice(0, 10);
  return {
    ...ledger,
    identities: [listing],
    opening: {
      ...ledger.opening,
      holdings: [
        {
          listingId: listing.listingId,
          shares: "1",
          totalCostBasisUsd: "50.00",
          confirmedOn: "2026-10-01",
        },
      ],
    },
    transactions: [
      {
        id: "invented-report-buy",
        date,
        type: "buy",
        listingId: listing.listingId,
        shares: "2.000000",
        grossUsd: "200.00",
        feeUsd: "1.00",
      },
      {
        id: "invented-report-sell",
        date,
        type: "sell",
        listingId: listing.listingId,
        shares: "1.000000",
        grossUsd: "150.00",
        feeUsd: "1.00",
      },
    ],
  };
}
function authoredReportLedger(state: PortfolioResourceState) {
  if (!state.dirty) return false;
  return state.draft?.ledger?.transactions.length === 2;
}
/** Explicit test setup uses the real ledger parser/model; this is not native text-entry evidence. */
export function authorInventedPortfolioReviewReportLedger(
  workspace: ManagedWorkspace,
  fixture: ManagedNativeFixture,
): boolean {
  if (!canAuthor(workspace.portfolio.coordinator.getSnapshot())) return false;
  const listing = fixture.priceCoverage.find(
    (row) => row.listingId === "listing-zero",
  );
  if (!listing) return false;
  workspace.portfolio.start("2026-10-01", "1000.00");
  const draft = workspace.portfolio.coordinator.getSnapshot().draft;
  if (!draft?.ledger) return false;
  workspace.portfolio.replace(
    draft,
    inventedReportLedger(draft.ledger, listing),
  );
  return authoredReportLedger(workspace.portfolio.coordinator.getSnapshot());
}

/** Real adapter and plugin; diagnostics contain only operation counts and metadata. */
export function createNativePortfolioReviewReportFixture() {
  const plugin = registerPlugin<InvestmentPortfolioReviewReportPlugin>(
    "InvestmentPortfolioReviewReport",
  );
  const listeners = new Set<() => void>();
  let state = {
    choices: 0,
    writes: 0,
    cancels: 0,
    filename: "",
    byteLength: 0,
  };
  const update = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const delivery = createNativePortfolioReviewReportAdapter({
    choose: async (options) => {
      update({ choices: state.choices + 1, filename: options.filename });
      return plugin.choose(options);
    },
    write: async (options) => {
      const result = await plugin.write(options);
      update({
        writes: state.writes + 1,
        byteLength: new TextEncoder().encode(options.text).byteLength,
      });
      return result;
    },
    cancel: async (options) => {
      await plugin.cancel(options);
      update({ cancels: state.cancels + 1 });
    },
  });
  return {
    delivery,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
