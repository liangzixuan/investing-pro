import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";
import type { ManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";

export const MANAGED_FILINGS_PAGE_SIZE = 25;

export type ManagedFilingsScope = "all" | "after-annual";

export interface ManagedFilingsFilter {
  readonly response: ManagedSecFilingsResponseDto;
  readonly baseline: ManagedFilingsAnnualBaseline | null;
  readonly scope: ManagedFilingsScope;
  readonly form: string;
  readonly page: number;
  readonly resetNotice: "filings-replaced" | "annual-baseline-changed" | null;
}

export function initialManagedFilingsFilter(
  response: ManagedSecFilingsResponseDto,
  baseline: ManagedFilingsAnnualBaseline | null = null,
): ManagedFilingsFilter {
  return {
    response,
    baseline,
    scope: "all",
    form: "",
    page: 0,
    resetNotice: null,
  };
}

export function bindManagedFilingsFilter(
  current: ManagedFilingsFilter,
  response: ManagedSecFilingsResponseDto,
  baseline: ManagedFilingsAnnualBaseline | null = null,
): ManagedFilingsFilter {
  if (current.response !== response)
    return {
      ...initialManagedFilingsFilter(response, baseline),
      resetNotice:
        current.form !== "" || current.page !== 0 || current.scope !== "all"
          ? "filings-replaced"
          : null,
    };
  if (current.baseline?.response === baseline?.response) return current;
  if (current.scope === "all") return { ...current, baseline };
  return {
    ...current,
    baseline,
    scope: "all",
    page: 0,
    resetNotice: "annual-baseline-changed",
  };
}

export function projectManagedFilingsFilter(selection: ManagedFilingsFilter) {
  const loaded = selection.response.issuer.filings;
  // Admitted forms contain ASCII only, so default sorting is codepoint order.
  const forms = [...new Set(loaded.map((filing) => filing.form))].sort();
  const matching = loaded.filter((filing) => matchesFilters(filing, selection));
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
