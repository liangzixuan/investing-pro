import {
  membershipMatchesResult,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import {
  calculateAuthoredPriceComparison,
  type AuthoredValuationScenario,
} from "@research-cockpit/personal-market-analytics";
import type { ManagedEodHistoryState } from "./managed-eod-history";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  captureValuationCalculationGuard,
  VALUATION_SCENARIOS,
  type ManagedValuationCalculation,
} from "./managed-valuation-workbench";

export type ManagedValuationPriceReason =
  | "price_not_loaded"
  | "price_pending"
  | "price_range_staged"
  | "price_catalog_changed"
  | "price_identity_mismatch"
  | "price_invalid";

export interface ManagedValuationPriceRow {
  readonly model: "dcf" | "exit";
  readonly scenario: AuthoredValuationScenario;
  readonly modelValuePerShareUsd: string | null;
  readonly result:
    | ReturnType<typeof calculateAuthoredPriceComparison>
    | Readonly<{ status: "unavailable"; reason: string }>;
}

export interface ManagedValuationPriceContext {
  readonly selection: ManagedResearchSelection;
  readonly calculation: ManagedValuationCalculation;
  readonly reference: Readonly<{
    readonly response: ManagedEodHistoryResponseDto;
    readonly rawCloseUsd: string;
    readonly date: string;
    readonly showingPrevious: boolean;
  }> | null;
  readonly reason: ManagedValuationPriceReason | null;
  readonly rows: readonly ManagedValuationPriceRow[];
}

interface SourceCapture {
  readonly response: unknown;
  readonly fingerprint: string;
  readonly reference: ManagedValuationPriceContext["reference"];
  readonly reason: ManagedValuationPriceReason | null;
}
interface Capture {
  readonly context: ManagedValuationPriceContext;
  readonly price: ManagedEodHistoryState | null;
  readonly source: SourceCapture;
  retired: boolean;
}
const cache = new WeakMap<ManagedValuationCalculation, Capture>();
const captures = new WeakMap<ManagedValuationPriceContext, Capture>();

/** No source reads. Admit a live workbench capture and an explicitly loaded Price state. */
export function resolveManagedValuationPrice(
  selection: ManagedResearchSelection,
  calculation: ManagedValuationCalculation | null,
  price: ManagedEodHistoryState | null,
): ManagedValuationPriceContext | null {
  try {
    if (
      !calculation ||
      !captureValuationCalculationGuard(calculation)?.() ||
      !selectionMatches(selection, calculation.owner, false)
    )
      return null;
    const currentSelection = copySelection(selection);
    const source = captureSource(currentSelection, price);
    const previous = cache.get(calculation);
    if (previous?.price === price) {
      if (
        sameSource(previous.source, source) &&
        selectionMatches(currentSelection, previous.context.selection) &&
        !previous.retired
      )
        return previous.context;
      previous.retired = true;
    }
    const context: ManagedValuationPriceContext = Object.freeze({
      selection: currentSelection,
      calculation,
      reference: source.reference,
      reason: source.reason,
      rows: Object.freeze([
        ...modelRows("dcf", calculation, source),
        ...modelRows("exit", calculation, source),
      ]),
    });
    const capture = { context, price, source, retired: false };
    cache.set(calculation, capture);
    captures.set(context, capture);
    return context;
  } catch {
    return null;
  }
}

/**
 * Check an opaque, immutable capture without requiring its workbench to remain open.
 * Report/note callers separately enforce their visit, revision and session lifetimes.
 * A changed source invalidates this capture permanently once observed here.
 */
export function managedValuationPriceContextIsOwned(
  context: ManagedValuationPriceContext,
  selection: ManagedResearchSelection,
  calculation: ManagedValuationCalculation | null,
  price: ManagedEodHistoryState | null,
): boolean {
  try {
    const capture = captures.get(context);
    if (
      !capture ||
      capture.retired ||
      context.calculation !== calculation ||
      capture.price !== price ||
      !selectionMatches(selection, context.selection)
    )
      return false;
    if (!sameSource(capture.source, captureSource(context.selection, price))) {
      capture.retired = true;
      return false;
    }
    return true;
  } catch {
    const capture = captures.get(context);
    if (capture) capture.retired = true;
    return false;
  }
}

function modelRows(
  model: "dcf" | "exit",
  calculation: ManagedValuationCalculation,
  source: SourceCapture,
): ManagedValuationPriceRow[] {
  const result =
    model === "dcf" ? calculation.dcfResult : calculation.exitResult;
  return VALUATION_SCENARIOS.map((scenario) => {
    const scenarioResult =
      result.status === "available" ? result.scenarios[scenario] : null;
    const modelValuePerShareUsd =
      scenarioResult?.status === "available"
        ? "valuePerShareUsd" in scenarioResult
          ? scenarioResult.valuePerShareUsd
          : scenarioResult.valuePerShare
        : null;
    const refusal =
      result.status === "unavailable"
        ? result.reason
        : scenarioResult?.status === "unavailable"
          ? scenarioResult.reason
          : source.reason;
    return Object.freeze({
      model,
      scenario,
      modelValuePerShareUsd,
      result: refusal
        ? Object.freeze({ status: "unavailable" as const, reason: refusal })
        : calculateAuthoredPriceComparison(
            modelValuePerShareUsd,
            source.reference?.rawCloseUsd,
          ),
    });
  });
}

const SELECTION_KEYS = [
  "catalogSnapshotSha256",
  "listing",
  "cik",
  "origin",
] as const;
const LISTING_KEYS = [
  "country",
  "exchangeMic",
  "instrumentType",
  "issuerId",
  "issuerName",
  "listingId",
  "securityId",
  "securityName",
  "shareClassId",
  "shareClassName",
  "symbol",
] as const;
const STATE_KEYS = [
  "selection",
  "available",
  "selectedRange",
  "response",
  "responseOrigin",
  "showingPrevious",
  "running",
  "catalogChanged",
  "message",
  "error",
] as const;

/** Copy only own data descriptors; never execute caller accessors. */
function data<const K extends readonly string[]>(
  raw: unknown,
  keys: K,
): Record<K[number], unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const prototype: unknown = Object.getPrototypeOf(raw);
  if (prototype !== Object.prototype && prototype !== null) return null;
  if (Reflect.ownKeys(raw).length !== keys.length) return null;
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
      return null;
    entries.push([key, descriptor.value]);
  }
  return Object.fromEntries(entries) as Record<K[number], unknown>;
}

function selectionMatches(
  raw: unknown,
  expected: ManagedResearchSelection,
  includeOrigin = true,
): boolean {
  const selection = data(raw, SELECTION_KEYS);
  const listing = selection && data(selection.listing, LISTING_KEYS);
  return Boolean(
    selection &&
    listing &&
    selection.catalogSnapshotSha256 === expected.catalogSnapshotSha256 &&
    (!includeOrigin || selection.origin === expected.origin) &&
    selection.cik === expected.cik &&
    LISTING_KEYS.every((key) => listing[key] === expected.listing[key]),
  );
}

function copySelection(
  selection: ManagedResearchSelection,
): ManagedResearchSelection {
  return Object.freeze({
    catalogSnapshotSha256: selection.catalogSnapshotSha256,
    listing: Object.freeze({ ...selection.listing }),
    cik: selection.cik,
    origin: selection.origin,
  });
}

function captureSource(
  selection: ManagedResearchSelection,
  price: ManagedEodHistoryState | null,
): SourceCapture {
  try {
    return inspectSource(selection, price);
  } catch {
    return {
      response: price,
      fingerprint: "invalid-source",
      reference: null,
      reason: "price_invalid",
    };
  }
}

function inspectSource(
  selection: ManagedResearchSelection,
  price: ManagedEodHistoryState | null,
): SourceCapture {
  if (price === null)
    return {
      response: null,
      fingerprint: "missing",
      reference: null,
      reason: "price_not_loaded",
    };
  const state = data(price, STATE_KEYS);
  if (
    !state ||
    ![
      state.available,
      state.showingPrevious,
      state.running,
      state.catalogChanged,
      state.error,
    ].every((value) => typeof value === "boolean") ||
    typeof state.message !== "string" ||
    (state.selectedRange !== "1m" && state.selectedRange !== "1y") ||
    (state.responseOrigin !== null &&
      state.responseOrigin !== "company" &&
      state.responseOrigin !== "markets" &&
      state.responseOrigin !== "watchlist")
  )
    return {
      response: null,
      fingerprint: "invalid-state",
      reference: null,
      reason: "price_invalid",
    };
  const range: unknown =
    state.response && typeof state.response === "object"
      ? Object.getOwnPropertyDescriptor(state.response, "range")?.value
      : null;
  const response =
    range === "1m" || range === "1y"
      ? parseManagedEodHistoryResponse(state.response, {
          catalogSnapshotSha256: selection.catalogSnapshotSha256,
          listingId: selection.listing.listingId,
          range,
        })
      : null;
  const identity = selectionMatches(state.selection, selection);
  const reason: ManagedValuationPriceReason | null = state.catalogChanged
    ? "price_catalog_changed"
    : !identity
      ? "price_identity_mismatch"
      : state.running
        ? "price_pending"
        : response && response.range !== state.selectedRange
          ? "price_range_staged"
          : !state.available || (state.response !== null && !response)
            ? "price_invalid"
            : !response
              ? "price_not_loaded"
              : !membershipMatchesResult(
                    { ...selection.listing, note: "" },
                    response.security,
                  )
                ? "price_identity_mismatch"
                : null;
  const latest = response?.rows.at(-1);
  return {
    response: state.response,
    fingerprint: JSON.stringify({
      identity,
      available: state.available,
      selectedRange: state.selectedRange,
      response,
      responseOrigin: state.responseOrigin,
      showingPrevious: state.showingPrevious,
      running: state.running,
      catalogChanged: state.catalogChanged,
      error: state.error,
      message: state.message,
    }),
    reference:
      reason === null && response && latest
        ? Object.freeze({
            response,
            rawCloseUsd: latest.close,
            date: latest.date,
            showingPrevious: state.showingPrevious as boolean,
          })
        : null,
    reason: reason ?? (latest ? null : "price_invalid"),
  };
}

function sameSource(left: SourceCapture, right: SourceCapture): boolean {
  return (
    left.response === right.response && left.fingerprint === right.fingerprint
  );
}
