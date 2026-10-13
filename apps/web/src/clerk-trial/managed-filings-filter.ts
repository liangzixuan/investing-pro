import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";
import type { ManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";
import type { ManagedFilingsRefreshComparison } from "./managed-filings-refresh-comparison";

export const MANAGED_FILINGS_PAGE_SIZE = 25;

export type ManagedFilingsScope = "all" | "after-annual";
export type ManagedFilingsRefreshView = "all" | "new";

export interface ManagedFilingsFilter {
  readonly response: ManagedSecFilingsResponseDto;
  readonly baseline: ManagedFilingsAnnualBaseline | null;
  readonly scope: ManagedFilingsScope;
  readonly refreshComparison: ManagedFilingsRefreshComparison | null;
  readonly refreshView: ManagedFilingsRefreshView;
  readonly form: string;
  readonly page: number;
  readonly resetNotice:
    | "filings-replaced"
    | "annual-baseline-changed"
    | "refresh-comparison-changed"
    | "annual-and-refresh-comparison-changed"
    | null;
}

function currentComparison(
  response: ManagedSecFilingsResponseDto,
  comparison: ManagedFilingsRefreshComparison | null,
) {
  return response.issuer.status === "available" &&
    comparison?.current === response
    ? comparison
    : null;
}

export function initialManagedFilingsFilter(
  response: ManagedSecFilingsResponseDto,
  baseline: ManagedFilingsAnnualBaseline | null = null,
  comparison: ManagedFilingsRefreshComparison | null = null,
): ManagedFilingsFilter {
  return {
    response,
    baseline,
    scope: "all",
    refreshComparison: currentComparison(response, comparison),
    refreshView: "all",
    form: "",
    page: 0,
    resetNotice: null,
  };
}

export function bindManagedFilingsFilter(
  current: ManagedFilingsFilter,
  response: ManagedSecFilingsResponseDto,
  baseline: ManagedFilingsAnnualBaseline | null = null,
  comparison: ManagedFilingsRefreshComparison | null = null,
): ManagedFilingsFilter {
  if (current.response !== response)
    return {
      ...initialManagedFilingsFilter(response, baseline, comparison),
      resetNotice:
        current.form !== "" ||
        current.page !== 0 ||
        current.scope !== "all" ||
        current.refreshView !== "all"
          ? "filings-replaced"
          : null,
    };
  return bindFilterInputs(
    current,
    baseline,
    currentComparison(response, comparison),
  );
}

function bindFilterInputs(
  current: ManagedFilingsFilter,
  baseline: ManagedFilingsAnnualBaseline | null,
  comparison: ManagedFilingsRefreshComparison | null,
): ManagedFilingsFilter {
  const annualChanged = current.baseline?.response !== baseline?.response;
  const refreshChanged = current.refreshComparison !== comparison;
  if (!annualChanged && !refreshChanged) return current;
  const resetAnnual = annualChanged && current.scope === "after-annual";
  const resetRefresh = refreshChanged && current.refreshView === "new";
  return {
    ...current,
    baseline,
    refreshComparison: comparison,
    scope: resetAnnual ? "all" : current.scope,
    refreshView: resetRefresh ? "all" : current.refreshView,
    page: resetAnnual || resetRefresh ? 0 : current.page,
    resetNotice: changedInputNotice(
      resetAnnual,
      resetRefresh,
      current.resetNotice,
    ),
  };
}

function changedInputNotice(
  annual: boolean,
  refresh: boolean,
  previous: ManagedFilingsFilter["resetNotice"],
): ManagedFilingsFilter["resetNotice"] {
  if (annual && refresh) return "annual-and-refresh-comparison-changed";
  if (annual) return "annual-baseline-changed";
  if (refresh) return "refresh-comparison-changed";
  return previous;
}

export function projectManagedFilingsFilter(selection: ManagedFilingsFilter) {
  const loaded = selection.response.issuer.filings;
  // Admitted forms contain ASCII only, so default sorting is codepoint order.
  const forms = [...new Set(loaded.map((filing) => filing.form))].sort();
  const newAccessions =
    selection.refreshView === "new"
      ? new Set(selection.refreshComparison?.newAccessions)
      : null;
  const matching = loaded.filter(
    (filing) =>
      (!newAccessions || newAccessions.has(filing.accessionNumber)) &&
      matchesFilters(filing, selection),
  );
  return {
    forms,
    loadedCount: loaded.length,
    matchingCount: matching.length,
    pages: Math.max(1, Math.ceil(matching.length / MANAGED_FILINGS_PAGE_SIZE)),
    rows: matching.slice(
      selection.page * MANAGED_FILINGS_PAGE_SIZE,
      (selection.page + 1) * MANAGED_FILINGS_PAGE_SIZE,
    ),
  };
}

function matchesFilters(
  filing: ManagedSecFilingsResponseDto["issuer"]["filings"][number],
  selection: ManagedFilingsFilter,
) {
  if (selection.form && filing.form !== selection.form) return false;
  if (selection.scope === "all") return true;
  const target = selection.baseline?.target;
  return (
    target !== undefined &&
    filing.filingDate > target.filedDate &&
    filing.accessionNumber !== target.accessionNumber
  );
}

export function selectManagedFilingsScope(
  current: ManagedFilingsFilter,
  captured: ManagedFilingsFilter,
  scope: ManagedFilingsScope,
): ManagedFilingsFilter {
  if (current !== captured || scope === current.scope) return current;
  if (scope !== "all" && (scope !== "after-annual" || !current.baseline))
    return current;
  return { ...current, scope, page: 0, resetNotice: null };
}

export function selectManagedFilingsRefreshView(
  current: ManagedFilingsFilter,
  captured: ManagedFilingsFilter,
  view: ManagedFilingsRefreshView,
): ManagedFilingsFilter {
  if (current !== captured || view === current.refreshView) return current;
  if (view !== "all" && (view !== "new" || !current.refreshComparison))
    return current;
  return { ...current, refreshView: view, page: 0, resetNotice: null };
}

export function selectManagedFilingsForm(
  current: ManagedFilingsFilter,
  captured: ManagedFilingsFilter,
  form: string,
): ManagedFilingsFilter {
  if (current !== captured || form === current.form) return current;
  if (form !== "" && !projectManagedFilingsFilter(current).forms.includes(form))
    return current;
  return { ...current, form, page: 0, resetNotice: null };
}

export function selectManagedFilingsPage(
  current: ManagedFilingsFilter,
  captured: ManagedFilingsFilter,
  page: number,
): ManagedFilingsFilter {
  if (current !== captured || !Number.isSafeInteger(page)) return current;
  if (page < 0 || page >= projectManagedFilingsFilter(current).pages)
    return current;
  if (page === current.page) return current;
  return { ...current, page, resetNotice: null };
}
