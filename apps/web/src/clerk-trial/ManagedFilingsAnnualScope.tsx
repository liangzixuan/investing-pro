import { getPersonalSecAnnualSourceUtilityAge } from "@research-cockpit/personal-financial-analytics";
import type { ManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";
import type { ManagedFilingsScope } from "./managed-filings-filter";

export function ManagedFilingsAnnualScope({
  baseline,
  scope,
  available,
  onScope,
  previous,
  fromComparison,
  fromDate,
  throughDate,
}: {
  baseline: ManagedFilingsAnnualBaseline | null;
  scope: ManagedFilingsScope;
  available: boolean;
  onScope: (scope: ManagedFilingsScope) => void;
  previous: boolean;
  fromComparison: boolean;
  fromDate: string;
  throughDate: string;
}) {
  return (
    <div className="managed-filings-filter">
      <label htmlFor="managed-filings-date">Filing date</label>
      <select
        id="managed-filings-date"
        className="managed-filings-form-select"
        value={scope}
        aria-describedby="managed-filings-date-help"
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === "all" || value === "after-annual") onScope(value);
        }}
      >
        <option value="all">All loaded filings</option>
        {baseline && (
          <option value="after-annual">Filed after Annual report</option>
        )}
      </select>
      <p id="managed-filings-date-help" className="managed-filings-scope">
        {!available
          ? "Date filtering is unavailable for this filings response."
          : baseline
            ? `Annual report filed ${baseline.target.filedDate}. Same-day filings remain in All loaded filings.`
            : "Date filtering needs a loaded Annual report with a resolved filing for this company."}
      </p>
      {baseline && previous && (
        <p className="managed-filings-warning">
          Previous Annual report retained; newer evidence was not confirmed.
        </p>
      )}
      {baseline && (
        <details className="managed-filings-annual-context">
          <summary>Annual baseline and date limits</summary>
          <AnnualBaseline
            {...{ baseline, fromComparison, fromDate, throughDate }}
          />
        </details>
      )}
    </div>
  );
}

function AnnualBaseline({
  baseline: { response, target },
  fromComparison,
  fromDate,
  throughDate,
}: {
  baseline: ManagedFilingsAnnualBaseline;
  fromComparison: boolean;
  fromDate: string;
  throughDate: string;
}) {
  const { generation } = response.evidence;
  const utilityAge = getPersonalSecAnnualSourceUtilityAge(generation, target);
  return (
    <div className="managed-filings-annual-details">
      <p>
        <a
          href={`https://www.sec.gov/Archives/edgar/data/${response.evidence.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`}
          target="_blank"
          rel="noreferrer"
        >
          Annual baseline · Form {target.form}
          <span className="managed-filings-accession">
            {target.accessionNumber}
          </span>
        </a>
        Filed {target.filedDate} · Report ending {target.reportDate}
      </p>
      <p className="managed-filings-source">
        Annual cutoff {generation.cutoffAt} · Completed {generation.completedAt}
        . Submissions captured{" "}
        {generation.sources.submissions.fetchedAt ?? "Not captured"}.
        {fromComparison && " Loaded from the watchlist comparison."}
      </p>
      {utilityAge?.withinWindow === false && (
        <p className="managed-filings-scope">
          This Annual report is outside the current-use age limits. Its original
          filing date still supplies this filter.
        </p>
      )}
      <p className="managed-filings-scope">
        Only later filed dates are included; the Annual filing itself is
        excluded. Filing dates do not establish an order within the same day.
        The filter uses loaded metadata and does not assess a filing's
        significance.
      </p>
      {target.filedDate < fromDate && (
        <p className="managed-filings-scope">
          This Annual filing predates the loaded window, which starts {fromDate}
          . Filings between those dates are outside this response.
        </p>
      )}
      {target.filedDate > throughDate && (
        <p className="managed-filings-scope">
          The loaded window ends {throughDate}, before this Annual filing. This
          response cannot show later-dated filings.
        </p>
      )}
    </div>
  );
}
