import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PassiveCompanyResearchCapture } from "./managed-screen-research-review";
import { identityLabels } from "./ManagedListingIdentity";
import { CompanyReportDocumentView } from "./CompanyReportDocument";
import { ManagedValuationResults } from "./ManagedValuationResults";
import { ManagedValuationPriceContext } from "./ManagedValuationPriceContext";
import { CapturedPriceStudies } from "./ManagedPriceStudies";
import { AnnualSnapshot } from "./CompanySnapshotAnnual";
import { AnnualStatementsReportView } from "./AnnualStatementsReportView";
import { InterimStatementsReportView } from "./InterimStatementsReportView";
import {
  FilingsPacketSource,
  FilingsPacketSummary,
} from "./ManagedFilingsPacket";
import { ObservedRawCloseRange } from "./ObservedRawCloseRange";
import { CloseHistoryChart } from "../features/research/CloseHistoryChart";

type Evidence = PassiveCompanyResearchCapture["evidence"];
type SourceState = NonNullable<Evidence[keyof Evidence]>;
/** Offline reports serialize disclosure contents and use the complete raw table. */
export const OfflineResearchReading = createContext(false);

/** Serialize the complete retained value only while its disclosure is open. */
export function CapturedSourcePacket({
  label,
  value,
  children,
}: {
  readonly label: string;
  readonly value: Readonly<object>;
  readonly children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const offline = useContext(OfflineResearchReading);
  const text = useMemo(
    () => (open || offline ? JSON.stringify(value, null, 2) : null),
    [open, offline, value],
  );
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{label}</summary>
      {children}
      {(open || offline) && <pre>{text}</pre>}
    </details>
  );
}

/** A passive source state: no live loaders, authority checks or action callbacks. */
function SourceReading({
  name,
  state,
  children,
}: {
  name: string;
  state: SourceState | null;
  children?: ReactNode;
}) {
  return (
    <section aria-label={`Captured ${name}`}>
      <h4>{name}</h4>
      {!state ? (
        <p>No {name} source state was captured.</p>
      ) : (
        <>
          <p>{state.message || "No source message was recorded."}</p>
          {state.error && (
            <p className="discovery-warning">The last {name} request failed.</p>
          )}
          {("available" in state ? !state.available : !state.supported) && (
            <p>This source was unavailable for the captured company.</p>
          )}
          {state.showingPrevious && (
            <p className="discovery-warning">
              Showing retained previous evidence. The last request did not
              confirm newer source data.
            </p>
          )}
          {!state.response && <p>No {name} response was retained.</p>}
          <p>Response origin: {state.responseOrigin ?? "none"}.</p>
          {children}
          <CapturedSourcePacket
            label={`Complete ${name} state and source packets`}
            value={state}
          />
        </>
      )}
    </section>
  );
}

function PriceReading({ state }: { state: Evidence["price"] }) {
  const offline = useContext(OfflineResearchReading);
  const response = state?.response;
  return (
    <SourceReading name="Price" state={state}>
      {response && (
        <>
          <p>
            Window {response.window.startDate} to {response.window.endDate}.
            Request started {response.requestStartedAt}; completed{" "}
            {response.completedAt}.
          </p>
          <p>
            Tiingo · raw USD closes, unadjusted for splits or dividends; not a
            live quote.
          </p>
          <ObservedRawCloseRange response={response} />
          {!offline && (
            <CloseHistoryChart
              rows={response.rows}
              symbol={response.security.symbol}
            />
          )}
          <details>
            <summary>All captured raw closes</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">Trading date</th>
                  <th scope="col">Raw close · USD</th>
                </tr>
              </thead>
              <tbody>
                {response.rows.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.close}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </SourceReading>
  );
}

function FinancialSources({ evidence }: { evidence: Evidence }) {
  const annual = evidence.annual;
  const interim = evidence.interim;
  return (
    <>
      <SourceReading name="Annual" state={annual}>
        {annual?.response && (
          <AnnualSnapshot response={annual.response} view={annual.view} />
        )}
        {annual?.response && annual.view && (
          <AnnualStatementsReportView
            evidence={annual.response.evidence}
            statements={annual.view.statements}
          />
        )}
      </SourceReading>
      <SourceReading name="Interim" state={interim}>
        {interim?.response && interim.view && (
          <InterimStatementsReportView
            evidence={interim.response.evidence}
            statements={interim.view.statements}
          />
        )}
      </SourceReading>
    </>
  );
}

function FilingsReading({ state }: { state: Evidence["filings"] }) {
  return (
    <SourceReading name="Filings" state={state}>
      {state?.response && (
        <>
          <FilingsPacketSummary response={state.response} />
          <FilingsPacketSource response={state.response} />
          {state.response.issuer.status === "available" && (
            <ol>
              {state.response.issuer.filings.map((filing) => (
                <li key={filing.accessionNumber}>
                  <a href={filing.sourceUrl} target="_blank" rel="noreferrer">
                    Form {filing.form} · {filing.filingDate} ·{" "}
                    {filing.accessionNumber}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {state?.lastCheck && (
        <CapturedSourcePacket
          label="Last Filings source check"
          value={state.lastCheck}
        >
          <FilingsPacketSource response={state.lastCheck} />
        </CapturedSourcePacket>
      )}
      {state?.refreshComparison && (
        <CapturedSourcePacket
          label="Captured Filings refresh comparison"
          value={state.refreshComparison}
        />
      )}
    </SourceReading>
  );
}

export function ManagedScreenResearchReading({
  capture,
}: {
  capture: PassiveCompanyResearchCapture;
}) {
  const { selection, evidence } = capture;
  const offline = useContext(OfflineResearchReading);
  return (
    <article
      aria-label={`${capture.side} retained company research`}
      data-research-reading-side={capture.side}
    >
      <h3>
        {selection.listing.symbol} · {selection.listing.shareClassName}
      </h3>
      <p>
        Reading captured at {capture.capturedAt}. Capture preserves source dates
        and does not refresh, calculate or save.
      </p>
      <dl>
        {Object.entries(identityLabels).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{selection.listing[key as keyof typeof identityLabels]}</dd>
          </div>
        ))}
        <div>
          <dt>CIK</dt>
          <dd>{selection.cik ?? "Not established"}</dd>
        </div>
        <div>
          <dt>Catalog snapshot</dt>
          <dd>{selection.catalogSnapshotSha256}</dd>
        </div>
      </dl>
      <section aria-label="Captured thesis">
        <h4>Authored thesis at capture</h4>
        <p className="note managed-screen-research-raw">
          {capture.note === null
            ? "No watchlist thesis was available at capture."
            : capture.note === ""
              ? "The captured thesis was empty."
              : capture.note}
        </p>
      </section>
      <section aria-label="Captured valuation">
        <h4>Authored valuation at capture</h4>
        {capture.valuation ? (
          <>
            <p>
              Evaluated at {capture.evaluatedAt ?? "Not recorded"}. Reading
              captured separately at {capture.capturedAt}.
            </p>
            <ManagedValuationResults calculation={capture.valuation} />
            {capture.valuationPrice && (
              <ManagedValuationPriceContext context={capture.valuationPrice} />
            )}
          </>
        ) : (
          <p>No authored valuation calculation was captured.</p>
        )}
      </section>
      <PriceReading state={evidence.price} />
      {capture.priceStudies && (
        <CapturedPriceStudies
          studies={capture.priceStudies}
          showingPrevious={evidence.price?.showingPrevious ?? false}
        />
      )}
      <FinancialSources evidence={evidence} />
      <FilingsReading state={evidence.filings} />
      <details>
        <summary>Complete retained report document (JSON)</summary>
        <CompanyReportDocumentView
          document={capture.document}
          id={`${offline ? "paired-report" : "managed-screen-research"}-document-${capture.side}`}
        />
      </details>
    </article>
  );
}
