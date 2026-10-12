import {
  membershipMatchesResult,
  type ManagedEodHistoryResponseDto,
  type ManagedEodIdentity,
} from "@research-cockpit/contracts";
import {
  changeManagedPriceComparisonInterval,
  defaultManagedPriceComparisonInterval,
  deriveLoadedPriceComparisonHistory,
  deriveManagedPriceComparison,
  type ManagedPriceComparisonHistory,
  type ManagedPriceComparisonInterval,
  type ManagedPriceComparisonLoadedRow,
  type ManagedPriceComparisonResult,
} from "./managed-price-comparison";
import type {
  ManagedWatchlistPriceHandle,
  ManagedWatchlistPriceRow,
  ManagedWatchlistPricesState,
} from "./managed-watchlist-prices";

export type ManagedWatchlistComparisonSide = "left" | "right";
export interface ManagedWatchlistComparisonSource {
  readonly handle: ManagedWatchlistPriceHandle;
  readonly listing: ManagedEodIdentity;
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly response: ManagedEodHistoryResponseDto | null;
}
export interface ManagedWatchlistComparisonSelection extends ManagedPriceComparisonInterval {
  readonly left: ManagedWatchlistComparisonSource | null;
  readonly right: ManagedWatchlistComparisonSource | null;
  readonly hadHistory: boolean;
  readonly resetNotice: boolean;
  readonly refusal: "duplicate" | "selection_unavailable" | null;
}
export type ManagedWatchlistComparisonReason =
  | "both_required"
  | "left_required"
  | "right_required"
  | "duplicate"
  | "selection_unavailable"
  | "history_unavailable"
  | null;
export interface ManagedWatchlistComparisonProjection {
  readonly selection: ManagedWatchlistComparisonSelection;
  readonly left: ManagedWatchlistPriceRow | null;
  readonly right: ManagedWatchlistPriceRow | null;
  readonly history: ManagedPriceComparisonHistory;
  readonly comparison: ManagedPriceComparisonResult;
  readonly reason: ManagedWatchlistComparisonReason;
}

export function createManagedWatchlistComparisonSelection(): ManagedWatchlistComparisonSelection {
  return {
    left: null,
    right: null,
    startDate: "",
    endDate: "",
    hadHistory: false,
    resetNotice: false,
    refusal: null,
  };
}

function sameListing(left: ManagedEodIdentity, right: ManagedEodIdentity) {
  return membershipMatchesResult({ ...left, note: "" }, right);
}

function captureSource(
  row: ManagedWatchlistPriceRow,
): ManagedWatchlistComparisonSource | null {
  const selection = row.history.selection;
  if (
    !selection ||
    row.history.catalogChanged ||
    !sameListing(row.listing, selection.listing)
  )
    return null;
  return {
    handle: row.handle,
    listing: row.listing,
    catalogSnapshotSha256: selection.catalogSnapshotSha256,
    response: row.history.response,
  };
}

function currentRow(
  source: ManagedWatchlistComparisonSource | null,
  prices: ManagedWatchlistPricesState,
): ManagedWatchlistPriceRow | null {
  if (!source || !prices.active || prices.catalogChanged) return null;
  const row = prices.rows.find((item) => item.handle === source.handle);
  if (!row || !sameListing(source.listing, row.listing)) return null;
  const next = captureSource(row);
  return next?.catalogSnapshotSha256 === source.catalogSnapshotSha256
    ? row
    : null;
}

function reconcileSource(
  source: ManagedWatchlistComparisonSource | null,
  prices: ManagedWatchlistPricesState,
): ManagedWatchlistComparisonSource | null {
  const row = currentRow(source, prices);
  if (!row) return null;
  return source?.response === row.history.response
    ? source
    : captureSource(row);
}

function loadedRow(
  row: ManagedWatchlistPriceRow | null,
): ManagedPriceComparisonLoadedRow | null {
  const response = row?.history.response;
  if (
    !row ||
    !response ||
    response.catalogSnapshotSha256 !==
      row.history.selection?.catalogSnapshotSha256 ||
    !sameListing(row.listing, response.security)
  )
    return null;
  return {
    listing: row.listing,
    response,
    showingPrevious: row.history.showingPrevious,
  };
}

function pairHistory(
  left: ManagedWatchlistPriceRow | null,
  right: ManagedWatchlistPriceRow | null,
): ManagedPriceComparisonHistory {
  const first = loadedRow(left);
  const second = loadedRow(right);
  if (!first || !second) return { status: "unavailable" };
  return deriveLoadedPriceComparisonHistory([first, second]);
}

function resetSelection(
  left: ManagedWatchlistComparisonSource | null,
  right: ManagedWatchlistComparisonSource | null,
  prices: ManagedWatchlistPricesState,
  replaced: boolean,
): ManagedWatchlistComparisonSelection {
  const history = pairHistory(
    currentRow(left, prices),
    currentRow(right, prices),
  );
  const interval = defaultManagedPriceComparisonInterval(history);
  return {
    left,
    right,
    ...interval,
    hadHistory: history?.status === "loaded",
    resetNotice: replaced && interval.startDate !== "",
    refusal: null,
  };
}

/** Selected lifetimes alone govern resets; flags and unrelated rows do not. */
export function reconcileManagedWatchlistComparison(
  selection: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
): ManagedWatchlistComparisonSelection {
  const left = reconcileSource(selection.left, prices);
  const right = reconcileSource(selection.right, prices);
  if (left === selection.left && right === selection.right) return selection;
  return resetSelection(left, right, prices, selection.hadHistory);
}

function currentCapture(
  current: ManagedWatchlistComparisonSelection,
  captured: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
) {
  return (
    prices.active &&
    !prices.catalogChanged &&
    current === captured &&
    reconcileManagedWatchlistComparison(current, prices) === current
  );
}

function sameSource(
  left: ManagedWatchlistComparisonSource | null,
  right: ManagedWatchlistComparisonSource | null,
) {
  if (!left || !right) return left === right;
  return (
    left.handle === right.handle &&
    left.catalogSnapshotSha256 === right.catalogSnapshotSha256 &&
    left.response === right.response &&
    sameListing(left.listing, right.listing)
  );
}

function admitCandidate(
  candidate: ManagedWatchlistPriceRow | null,
  prices: ManagedWatchlistPricesState,
): ManagedWatchlistComparisonSource | "selection_unavailable" | null {
  if (!candidate) return null;
  const source = captureSource(candidate);
  const admitted = currentRow(source, prices);
  return source && admitted && source.response === admitted.history.response
    ? source
    : "selection_unavailable";
}

/** Call with the latest prices snapshot and the selection captured by the UI. */
export function selectManagedWatchlistComparisonRow(
  current: ManagedWatchlistComparisonSelection,
  captured: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
  side: ManagedWatchlistComparisonSide,
  candidate: ManagedWatchlistPriceRow | null,
): ManagedWatchlistComparisonSelection {
  if (!currentCapture(current, captured, prices)) return current;
  const source = admitCandidate(candidate, prices);
  if (source === "selection_unavailable")
    return { ...current, refusal: source };
  const other = current[side === "left" ? "right" : "left"];
  if (source && other && source.listing.listingId === other.listing.listingId)
    return { ...current, refusal: "duplicate" };
  if (sameSource(current[side], source))
    return current.refusal ? { ...current, refusal: null } : current;
  const next = { ...current, [side]: source };
  return resetSelection(next.left, next.right, prices, current.hadHistory);
}

export function changeManagedWatchlistComparisonInterval(
  current: ManagedWatchlistComparisonSelection,
  captured: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
  field: keyof ManagedPriceComparisonInterval,
  date: string,
): ManagedWatchlistComparisonSelection {
  if (!currentCapture(current, captured, prices)) return current;
  const history = pairHistory(
    currentRow(current.left, prices),
    currentRow(current.right, prices),
  );
  const next = changeManagedPriceComparisonInterval(
    current,
    history,
    field,
    date,
  );
  return next === current ? current : { ...next, refusal: null };
}

function comparisonReason(
  selection: ManagedWatchlistComparisonSelection,
  history: ManagedPriceComparisonHistory,
): ManagedWatchlistComparisonReason {
  if (selection.refusal) return selection.refusal;
  if (!selection.left && !selection.right) return "both_required";
  if (!selection.left) return "left_required";
  if (!selection.right) return "right_required";
  return history?.status === "unavailable" ? "history_unavailable" : null;
}

export function projectManagedWatchlistComparison(
  selection: ManagedWatchlistComparisonSelection,
  prices: ManagedWatchlistPricesState,
): ManagedWatchlistComparisonProjection {
  const current = reconcileManagedWatchlistComparison(selection, prices);
  const left = currentRow(current.left, prices);
  const right = currentRow(current.right, prices);
  const history =
    prices.active && !prices.catalogChanged ? pairHistory(left, right) : null;
  return {
    selection: current,
    left,
    right,
    history,
    comparison: deriveManagedPriceComparison(history, current),
    reason: comparisonReason(current, history),
  };
}
