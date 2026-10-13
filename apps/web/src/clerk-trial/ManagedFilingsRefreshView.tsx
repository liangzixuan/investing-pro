import type { ManagedFilingsRefreshView as RefreshView } from "./managed-filings-filter";

export function ManagedFilingsRefreshView({
  value,
  available,
  onSelect,
}: {
  value: RefreshView;
  available: boolean;
  onSelect: (value: RefreshView) => void;
}) {
  return (
    <div className="managed-filings-filter">
      <label htmlFor="managed-filings-refresh-view">Refresh view</label>
      <select
        id="managed-filings-refresh-view"
        className="managed-filings-form-select"
        value={value}
        aria-describedby="managed-filings-refresh-help"
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (next === "all" || (next === "new" && available)) onSelect(next);
        }}
      >
        <option value="all">All loaded filings</option>
        <option value="new" disabled={!available}>
          Newly observed
        </option>
      </select>
      <p id="managed-filings-refresh-help" className="managed-filings-scope">
        {available
          ? "Filter the displayed response to accessions absent from the previous loaded list. This does not establish when a filing was published."
          : "Newly observed filtering needs two available lists from this company visit. An explicit Refresh filings can supply the next list."}
      </p>
    </div>
  );
}
