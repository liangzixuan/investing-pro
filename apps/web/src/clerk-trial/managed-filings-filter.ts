import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";

export const MANAGED_FILINGS_PAGE_SIZE = 25;

export interface ManagedFilingsFilter {
  readonly response: ManagedSecFilingsResponseDto;
  readonly form: string;
  readonly page: number;
  readonly resetNotice: boolean;
}

export function initialManagedFilingsFilter(
  response: ManagedSecFilingsResponseDto,
): ManagedFilingsFilter {
  return { response, form: "", page: 0, resetNotice: false };
}

export function bindManagedFilingsFilter(
  current: ManagedFilingsFilter,
  response: ManagedSecFilingsResponseDto,
): ManagedFilingsFilter {
  if (current.response === response) return current;
  return {
    ...initialManagedFilingsFilter(response),
    resetNotice: current.form !== "" || current.page !== 0,
  };
}

export function projectManagedFilingsFilter(selection: ManagedFilingsFilter) {
  const loaded = selection.response.issuer.filings;
  // Admitted forms contain ASCII only, so default sorting is codepoint order.
  const forms = [...new Set(loaded.map((filing) => filing.form))].sort();
  const matching = selection.form
    ? loaded.filter((filing) => filing.form === selection.form)
    : loaded;
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

export function selectManagedFilingsForm(
  current: ManagedFilingsFilter,
  captured: ManagedFilingsFilter,
  form: string,
): ManagedFilingsFilter {
  if (current !== captured || form === current.form) return current;
  if (form !== "" && !projectManagedFilingsFilter(current).forms.includes(form))
    return current;
  return { ...current, form, page: 0, resetNotice: false };
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
  return { ...current, page, resetNotice: false };
}
