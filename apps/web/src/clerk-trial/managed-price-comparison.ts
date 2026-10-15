import {
  membershipMatchesResult,
  type ManagedEodHistoryResponseDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import {
  calculatePersonalRawCloseChange,
  comparePersonalRawCloseChange,
  type PersonalRawCloseChangeResult,
} from "@research-cockpit/personal-market-analytics";
import type { ManagedMarketsRow, ManagedMarketsState } from "./managed-markets";

export type ManagedPriceComparisonState = Pick<
  ManagedMarketsState,
  "active" | "rows" | "catalogChanged"
>;
export type ManagedPriceComparisonOrder = "board" | "highest" | "lowest";
export interface ManagedPriceComparisonInterval {
  readonly startDate: string;
  readonly endDate: string;
}

export type ManagedPriceComparisonHistory =
  | null
  | { readonly status: "unavailable" }
  | {
      readonly status: "loaded";
      readonly rows: readonly LoadedRow[];
      readonly sharedDates: readonly string[];
    };

export interface ManagedPriceComparisonSelection extends ManagedPriceComparisonInterval {
  readonly sources: Pick<ManagedMarketsState, "active" | "catalogChanged"> & {
    readonly rows: readonly Pick<ManagedMarketsRow, "listing" | "response">[];
  };
  readonly hadHistory: boolean;
  readonly resetNotice: boolean;
}

export interface ManagedPriceComparisonLoadedRow {
  readonly listing: ManagedEodIdentity;
  readonly showingPrevious: boolean;
  readonly response: ManagedEodHistoryResponseDto;
}
type LoadedRow = ManagedPriceComparisonLoadedRow;
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
      readonly status: "interval_required";
      readonly reason: "start_required" | "end_required";
      readonly sharedDateCount: number;
      readonly rows: readonly LoadedRow[];
    }
  | {
      readonly status: "insufficient_history";
      readonly sharedDateCount: number;
      readonly firstDate: string | null;
      readonly rows: readonly LoadedRow[];
    }
  | {
      readonly status: "available";
      readonly sharedDateCount: number;
      readonly intervalDateCount: number;
      readonly firstDate: string;
      readonly lastDate: string;
      readonly rows: readonly ComparedRow[];
    };

/** Reorder only the complete projection; source rows and board selection stay untouched. */
export function orderManagedPriceComparison(
  comparison: ManagedPriceComparisonResult,
  order: ManagedPriceComparisonOrder,
): ManagedPriceComparisonResult {
  if (comparison?.status !== "available" || order === "board")
    return comparison;
  const direction = order === "highest" ? -1 : 1;
  return {
    ...comparison,
    rows: [...comparison.rows].sort((left, right) => {
      const change = comparePersonalRawCloseChange(
        { firstClose: left.firstClose, lastClose: left.lastClose },
        { firstClose: right.firstClose, lastClose: right.lastClose },
      );
      return (
        change * direction ||
        compareText(left.listing.symbol, right.listing.symbol) ||
        compareText(left.listing.exchangeMic, right.listing.exchangeMic) ||
        compareText(left.listing.listingId, right.listing.listingId)
      );
    }),
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Project the board's complete, already validated cohort without retaining another snapshot. */
export function deriveManagedPriceComparisonHistory(
  state: ManagedPriceComparisonState,
): ManagedPriceComparisonHistory {
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
  return deriveLoadedPriceComparisonHistory(rows);
}

/** Intersect already-admitted histories; each caller owns its complete set. */
export function deriveLoadedPriceComparisonHistory(
  rows: readonly ManagedPriceComparisonLoadedRow[],
): Exclude<ManagedPriceComparisonHistory, null> {
  if (rows.length < 2 || rows.some((row) => row.response.range !== "1m"))
    return { status: "unavailable" };
  const dates = rows.map(
    (row) => new Set(row.response.rows.map((item) => item.date)),
  );
  const sharedDates = rows[0]!.response.rows
    .map((row) => row.date)
    .filter((date) => dates.every((loaded) => loaded.has(date)));
  return { status: "loaded", rows, sharedDates };
}

export function defaultManagedPriceComparisonInterval(
  history: ManagedPriceComparisonHistory,
): ManagedPriceComparisonInterval {
  const dates = history?.status === "loaded" ? history.sharedDates : [];
  return {
    startDate: dates.length >= 2 ? dates[0]! : "",
    endDate: dates.length >= 2 ? dates.at(-1)! : "",
  };
}

export function deriveManagedPriceComparison(
  history: ManagedPriceComparisonHistory,
  interval: ManagedPriceComparisonInterval,
): ManagedPriceComparisonResult {
  if (!history || history.status === "unavailable") return history;
  const { rows, sharedDates } = history;
  if (sharedDates.length < 2)
    return {
      status: "insufficient_history",
      sharedDateCount: sharedDates.length,
      firstDate: sharedDates[0] ?? null,
      rows,
    };
  const firstIndex = sharedDates.indexOf(interval.startDate);
  const lastIndex = sharedDates.indexOf(interval.endDate);
  if (firstIndex < 0 || lastIndex <= firstIndex)
    return {
      status: "interval_required",
      reason: firstIndex < 0 ? "start_required" : "end_required",
      sharedDateCount: sharedDates.length,
      rows,
    };
  const firstDate = sharedDates[firstIndex]!;
  const lastDate = sharedDates[lastIndex]!;
  return {
    status: "available",
    sharedDateCount: sharedDates.length,
    intervalDateCount: lastIndex - firstIndex + 1,
    firstDate,
    lastDate,
    rows: rows.map((row) => compareLoadedRow(row, firstDate, lastDate)),
  };
}

export function createManagedPriceComparisonSelection(
  state: ManagedPriceComparisonState,
  history: ManagedPriceComparisonHistory,
  replaced = false,
): ManagedPriceComparisonSelection {
  const interval = defaultManagedPriceComparisonInterval(history);
  return {
    sources: {
      active: state.active,
      catalogChanged: state.catalogChanged,
      rows: state.rows.map(({ listing, response }) => ({ listing, response })),
    },
    ...interval,
    hadHistory: history?.status === "loaded",
    resetNotice: replaced && interval.startDate !== "",
  };
}

export function sameManagedPriceComparisonSources(
  selection: ManagedPriceComparisonSelection,
  state: ManagedPriceComparisonState,
): boolean {
  const previous = selection.sources;
  return (
    previous.active === state.active &&
    previous.catalogChanged === state.catalogChanged &&
    previous.rows.length === state.rows.length &&
    previous.rows.every((row, index) => {
      const next = state.rows[index]!;
      return (
        row.response === next.response &&
        membershipMatchesResult({ ...row.listing, note: "" }, next.listing)
      );
    })
  );
}

export function changeManagedPriceComparisonInterval<
  Selection extends ManagedPriceComparisonInterval & {
    readonly resetNotice: boolean;
  },
>(
  selection: Selection,
  history: ManagedPriceComparisonHistory,
  field: keyof ManagedPriceComparisonInterval,
  date: string,
): Selection {
  if (history?.status !== "loaded" || history.sharedDates.length < 2)
    return selection;
  const dates = history.sharedDates;
  const allowed =
    field === "startDate"
      ? dates.slice(0, -1)
      : dates.slice(1).filter((value) => value > selection.startDate);
  if (date !== "" && !allowed.includes(date)) return selection;
  if (field === "endDate")
    return { ...selection, endDate: date, resetNotice: false };
  return {
    ...selection,
    startDate: date,
    endDate: selection.endDate > date ? selection.endDate : "",
    resetNotice: false,
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
