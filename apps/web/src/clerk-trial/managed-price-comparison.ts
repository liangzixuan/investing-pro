import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
import {
  calculatePersonalRawCloseChange,
  type PersonalRawCloseChangeResult,
} from "@research-cockpit/personal-market-analytics";
import type { ManagedMarketsRow, ManagedMarketsState } from "./managed-markets";

export type ManagedPriceComparisonState = Pick<
  ManagedMarketsState,
  "active" | "rows" | "catalogChanged"
>;

type LoadedRow = Pick<ManagedMarketsRow, "listing" | "showingPrevious"> & {
  readonly response: ManagedEodHistoryResponseDto;
};
type ComparedRow = LoadedRow & {
  readonly firstClose: string;
  readonly lastClose: string;
  readonly change: Extract<
    PersonalRawCloseChangeResult,
    { status: "available" }
  >;
};
export type ManagedPriceComparisonResult =
  | null
  | { readonly status: "unavailable" }
  | {
      readonly status: "insufficient_history";
      readonly sharedDateCount: number;
      readonly firstDate: string | null;
      readonly rows: readonly LoadedRow[];
    }
  | {
      readonly status: "available";
      readonly sharedDateCount: number;
      readonly firstDate: string;
      readonly lastDate: string;
      readonly rows: readonly ComparedRow[];
    };

/** Project the board's complete, already validated cohort without retaining another snapshot. */
export function deriveManagedPriceComparison(
  state: ManagedPriceComparisonState,
): ManagedPriceComparisonResult {
  if (!state.active || state.catalogChanged) return null;
  if (state.rows.length !== 3) return { status: "unavailable" };
  const rows: LoadedRow[] = [];
  for (const row of state.rows) {
    if (!row.response) return { status: "unavailable" };
    rows.push({
      listing: row.listing,
      response: row.response,
      showingPrevious: row.showingPrevious,
    });
  }
  const dates = rows.map(
    (row) => new Set(row.response.rows.map((item) => item.date)),
  );
  const sharedDates = rows[0]!.response.rows
    .map((row) => row.date)
    .filter((date) => dates.every((loaded) => loaded.has(date)));
  if (sharedDates.length < 2)
    return {
      status: "insufficient_history",
      sharedDateCount: sharedDates.length,
      firstDate: sharedDates[0] ?? null,
      rows,
    };
  const firstDate = sharedDates[0]!;
  const lastDate = sharedDates.at(-1)!;
  return {
    status: "available",
    sharedDateCount: sharedDates.length,
    firstDate,
    lastDate,
    rows: rows.map((row) => compareLoadedRow(row, firstDate, lastDate)),
  };
}

function compareLoadedRow(
  row: LoadedRow,
  firstDate: string,
  lastDate: string,
): ComparedRow {
  const first = row.response.rows.find((item) => item.date === firstDate)!;
  const last = row.response.rows.find((item) => item.date === lastDate)!;
  const change = calculatePersonalRawCloseChange({ rows: [first, last] });
  if (change.status !== "available")
    throw new Error("Two shared observations are required.");
  return { ...row, firstClose: first.close, lastClose: last.close, change };
}
