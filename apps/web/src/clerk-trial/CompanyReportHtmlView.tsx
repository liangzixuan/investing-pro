import {
  derivePersonalSecAnnualFinancialReview,
  type PersonalSecAnnualFinancialReviewRow,
} from "@research-cockpit/personal-financial-analytics";
import type { PreparedCompanyReport } from "./managed-company-report";

type Value = PersonalSecAnnualFinancialReviewRow["value"];
type Source = NonNullable<
  PreparedCompanyReport["evidence"][keyof PreparedCompanyReport["evidence"]]
>;

function SourceState({ source }: { readonly source: Source | null }) {
  return (
    <>
      <p>{source?.response ? "Loaded admitted response." : "Not loaded."}</p>
      {source?.showingPrevious && (
        <p className="warning">
          Retained previous response. The latest attempt did not confirm newer
          evidence; original dates still apply.
        </p>
      )}
      {source?.error && (
        <p className="warning">The latest source attempt failed.</p>
      )}
      {source?.response && <p>Response origin: {source.responseOrigin}.</p>}
    </>
  );
}

function ValueDetails({
  value,
  references = true,
}: {
  readonly value: Value;
  readonly references?: boolean;
}) {
  return (
    <>
      {value.status === "available" ? (
        <>
          <p className="amount">USD {value.value}</p>
          <p>
            {"asOfDate" in value ? (
              <>As of {value.asOfDate}.</>
            ) : (
              <>
                Period {value.startDate} to {value.endDate}.
              </>
            )}
          </p>
          <p>
            {value.currentUseEligible
              ? "Within current-use limits at the original load."
              : "Historical value; outside current-use limits at the original load."}
          </p>
          <p>Accession: {value.accessionNumber}.</p>
        </>
      ) : (
        <p>Unavailable. Reason: {value.reason}.</p>
      )}
      {references && <References value={value} />}
    </>
  );
}

function References({ value }: { readonly value: Value }) {
  return (
    <>
      <p>Agreeing observation references:</p>
      {value.observationIds.length ? (
        <ul>
          {value.observationIds.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      ) : (
        <p>None.</p>
      )}
    </>
  );
}

function Fact({ row }: { readonly row: PersonalSecAnnualFinancialReviewRow }) {
  return (
    <section className="fact">
      <h3>{row.label}</h3>
      <p>
        {row.operands ? "App calculation · USD" : "Reported · USD"}
        {row.sign === null ? "" : ` · Amount sign: ${row.sign}`}
      </p>
      <ValueDetails value={row.value} references={false} />
      <details>
        <summary>Inputs and references: {row.label}</summary>
        <References value={row.value} />
        {row.key === "operatingCashFlowLessPpePurchases" && (
          <>
            <h4>Reported calculation inputs</h4>
            <p>Operating cash flow</p>
            <ValueDetails value={row.operands.operatingCashFlow} />
            <p>Less PP&amp;E purchases</p>
            <ValueDetails value={row.operands.ppePurchases} />
          </>
        )}
        {row.key === "workingCapital" && (
          <>
            <h4>Reported calculation inputs</h4>
            <p>Current assets</p>
            <ValueDetails value={row.operands.currentAssets} />
            <p>Less current liabilities</p>
            <ValueDetails value={row.operands.currentLiabilities} />
          </>
        )}
      </details>
    </section>
  );
}

function Annual({ report }: { readonly report: PreparedCompanyReport }) {
  const source = report.evidence.annual;
  const packet = source?.response;
  if (!packet)
    return (
      <section>
        <h2>Annual financial facts</h2>
        <SourceState source={source} />
        <p>No Annual facts are inferred from another source.</p>
      </section>
    );
  const { target, generation } = packet.evidence;
  return (
    <section>
      <h2>Annual financial facts</h2>
      <SourceState source={source} />
      <p>
        Five independent facts from the captured Annual report. Signs describe
        amounts and do not rate the company. Flows and balances keep their own
        dates. Parent equity excludes noncontrolling interests.
      </p>
      {derivePersonalSecAnnualFinancialReview(packet.evidence).map((row) => (
        <Fact key={row.key} row={row} />
      ))}
      <h3>Original Annual filing and source dates</h3>
      {target.status === "target" ? (
        <dl>
          <dt>Form</dt>
          <dd>{target.form}</dd>
          <dt>Report date</dt>
          <dd>{target.reportDate}</dd>
          <dt>Filed date</dt>
          <dd>{target.filedDate}</dd>
          <dt>Accepted time</dt>
          <dd>{target.acceptedAt ?? "Not supplied"}</dd>
          <dt>Accession</dt>
          <dd>{target.accessionNumber}</dd>
        </dl>
      ) : (
        <p>Annual filing unresolved. Reason: {target.reason}.</p>
      )}
      <dl>
        <dt>Original cutoff</dt>
        <dd>{generation.cutoffAt}</dd>
        <dt>Original completion</dt>
        <dd>{generation.completedAt}</dd>
        <dt>Generation digest</dt>
        <dd>{generation.sha256}</dd>
      </dl>
      {(["companyFacts", "submissions"] as const).map((key) => (
        <section key={key}>
          <h4>{key === "companyFacts" ? "Company Facts" : "Submissions"}</h4>
          <dl>
            <dt>Source status</dt>
            <dd>{generation.sources[key].status}</dd>
            <dt>Original capture</dt>
            <dd>{generation.sources[key].fetchedAt ?? "Not captured"}</dd>
            <dt>Source address</dt>
            <dd>{generation.sources[key].sourceUrl}</dd>
            <dt>Source digest</dt>
            <dd>{generation.sources[key].sha256 ?? "Not available"}</dd>
          </dl>
        </section>
      ))}
      <p>
        All admitted source observations, source pointers and coverage limits
        remain in the complete JSON appendix. Preparation does not renew source
        dates or current-use eligibility.
      </p>
    </section>
  );
}

/** Passive document content only: no hooks, handlers, source requests or URL attributes. */
export function CompanyReportHtmlView({
  report,
  jsonText,
}: {
  readonly report: PreparedCompanyReport;
  readonly jsonText: string;
}) {
  const { listing } = report.selection;
  const price = report.evidence.price;
  const filings = report.evidence.filings;
  return (
    <main>
      <h1>Company research report</h1>
      <p>
        {listing.symbol} · {listing.exchangeMic} · {listing.issuerName}
      </p>
      <dl>
        <dt>Security</dt>
        <dd>{listing.securityName}</dd>
        <dt>Share class</dt>
        <dd>{listing.shareClassName}</dd>
        <dt>Country / instrument</dt>
        <dd>
          {listing.country} · {listing.instrumentType}
        </dd>
        <dt>Listing identifier</dt>
        <dd>{listing.listingId}</dd>
        <dt>Issuer identifier</dt>
        <dd>{listing.issuerId}</dd>
        <dt>Security identifier</dt>
        <dd>{listing.securityId}</dd>
        <dt>Share-class identifier</dt>
        <dd>{listing.shareClassId}</dd>
        <dt>CIK</dt>
        <dd>{report.selection.cik ?? "Not supplied"}</dd>
        <dt>Catalog snapshot</dt>
        <dd>{report.selection.catalogSnapshotSha256}</dd>
        <dt>Original preparation time</dt>
        <dd>{report.preparedAt}</dd>
      </dl>
      <p>
        Loaded admitted evidence only, not complete issuer history. Preparation
        and export do not refresh sources. This report provides no investment
        rating or recommendation.
      </p>
      <section>
        <h2>Authored research</h2>
        {report.note === null ? (
          <p>
            This company was not in the watchlist draft when the report was
            prepared.
          </p>
        ) : report.note === "" ? (
          <p>The watchlist draft note was empty.</p>
        ) : (
          <>
            <p>Watchlist draft note, including unsaved edits:</p>
            <p className="note">{report.note}</p>
          </>
        )}
        <p>
          Authored claims and links are not verified. This document does not
          establish that the note was saved. Downloaded copies do not update
          after later edits.
        </p>
      </section>
      <Annual report={report} />
      <section>
        <h2>Captured Price source</h2>
        <SourceState source={price} />
        {price?.response && (
          <dl>
            <dt>Provider / basis</dt>
            <dd>
              {price.response.provider} · raw USD closes, unadjusted for splits
              or dividends; not live quotes.
            </dd>
            <dt>Loaded range</dt>
            <dd>{price.response.range === "1y" ? "One year" : "One month"}</dd>
            <dt>Requested window</dt>
            <dd>
              {price.response.window.startDate} to{" "}
              {price.response.window.endDate}
            </dd>
            <dt>Reported closes</dt>
            <dd>{price.response.rows.length}</dd>
            <dt>Original request</dt>
            <dd>{price.response.requestStartedAt}</dd>
            <dt>Original completion</dt>
            <dd>{price.response.completedAt}</dd>
          </dl>
        )}
      </section>
      <section>
        <h2>Captured Filings source</h2>
        <SourceState source={filings} />
        {filings?.response && (
          <>
            <dl>
              <dt>Source status</dt>
              <dd>{filings.response.issuer.status}</dd>
              <dt>Recent-list window</dt>
              <dd>
                {filings.response.window.fromDate} to{" "}
                {filings.response.window.throughDate} ·{" "}
                {filings.response.window.lookbackDays} days
              </dd>
              <dt>Original request</dt>
              <dd>{filings.response.requestStartedAt}</dd>
              <dt>Original capture</dt>
              <dd>{filings.response.issuer.fetchedAt ?? "Not captured"}</dd>
              <dt>Original completion</dt>
              <dd>{filings.response.completedAt}</dd>
              <dt>Matching filings</dt>
              <dd>{filings.response.issuer.matchingFilings}</dd>
              <dt>Returned filings</dt>
              <dd>{filings.response.issuer.filings.length}</dd>
              <dt>Truncated</dt>
              <dd>{filings.response.issuer.truncated ? "Yes" : "No"}</dd>
              <dt>Older history listed</dt>
              <dd>
                {filings.response.issuer.olderHistoryAvailable ? "Yes" : "No"}
              </dd>
            </dl>
            <p>
              Only the captured recent list was checked. Older continuation
              files and filing contents were not loaded; complete history is not
              established.
            </p>
          </>
        )}
      </section>
      <section>
        <h2>Complete captured report document</h2>
        <p>
          The appendix contains the complete admitted JSON packets and exact
          decoded authored note, including whitespace. It is evidence for this
          captured report, not an import or restore control.
        </p>
        <details>
          <summary>Complete captured JSON</summary>
          <pre>{jsonText}</pre>
        </details>
      </section>
    </main>
  );
}
