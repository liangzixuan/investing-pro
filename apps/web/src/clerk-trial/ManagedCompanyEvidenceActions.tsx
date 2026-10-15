import type { ReactNode } from "react";
import { managedFilingsStatus } from "./managed-company-filings";
import {
  useCompanySnapshotEvidence,
  type CompanyEvidenceModels,
} from "./useCompanySnapshotEvidence";
import "./managed-company-snapshot.css";

type Section = "eod" | "annual" | "filings";
type SourceState = {
  readonly running: boolean;
  readonly showingPrevious: boolean;
  readonly error: boolean;
  readonly message: string;
};

export function ManagedCompanyEvidenceActions({
  navigationPending,
  onRequest,
  onCancel,
  onOpen,
  ...models
}: CompanyEvidenceModels & {
  navigationPending: boolean;
  onRequest: (section: Section) => void;
  onCancel: (section: Section) => void;
  onOpen: (section: Section) => void;
}) {
  const evidence = useCompanySnapshotEvidence(models);
  const price = evidence.price;
  const annual = evidence.annual;
  const filings = evidence.filings;
  const priceSupported = models.price.hasPriceCoverage(
    models.selection.listing,
  );
  const range = price?.selectedRange ?? "1m";
  const rangeLabel = range === "1y" ? "One year" : "One month";
  return (
    <section
      className="managed-company-evidence-actions"
      aria-label="Company research sources"
    >
      <h3>Research sources</h3>
      <p>
        Load each source explicitly. Inspect keeps its original source dates.
      </p>
      <div className="managed-evidence-action-grid">
        <SourceCard
          navigationPending={navigationPending}
          title="Price"
          section="eod"
          state={price}
          loaded={Boolean(price?.response)}
          completedAt={price?.response?.completedAt}
          requestLabel={`${price?.response?.range === range ? "Refresh" : "Load"} Price · ${rangeLabel}`}
          supported={priceSupported}
          onRequest={onRequest}
          onCancel={onCancel}
          onOpen={onOpen}
        >
          {priceSupported ? (
            <>
              <p>Requested range: {rangeLabel}. Change it in Price.</p>
              {price?.response && (
                <p>
                  Loaded range:{" "}
                  {price.response.range === "1y" ? "One year" : "One month"}.
                  Raw closes are unadjusted and are not live quotes.
                </p>
              )}
            </>
          ) : (
            !price?.message && (
              <p>
                Price history is not available for this listing in this
                workspace.
              </p>
            )
          )}
        </SourceCard>
        <SourceCard
          navigationPending={navigationPending}
          title="Annual"
          section="annual"
          state={annual}
          loaded={Boolean(annual?.response)}
          completedAt={annual?.response?.evidence.generation.completedAt}
          requestLabel={annual?.response ? "Refresh Annual" : "Load Annual"}
          onRequest={onRequest}
          onCancel={onCancel}
          onOpen={onOpen}
        >
          <p>
            Financial values keep their own availability and refusal reasons in
            Annual.
          </p>
        </SourceCard>
        <SourceCard
          navigationPending={navigationPending}
          title="Filings"
          section="filings"
          state={filings}
          loaded={Boolean(filings?.response)}
          completedAt={filings?.response?.completedAt}
          requestLabel={filings?.response ? "Refresh Filings" : "Load Filings"}
          onRequest={onRequest}
          onCancel={onCancel}
          onOpen={onOpen}
        >
          {filings?.response ? (
            <p>
              {filings.response.issuer.status !== "available"
                ? managedFilingsStatus(filings.response.issuer.status)
                : filings.response.issuer.filings.length === 0
                  ? "No matching filings in the checked source object."
                  : `${filings.response.issuer.filings.length} observed filings.`}
            </p>
          ) : (
            <p>Recent SEC filing metadata; filing bodies are not loaded.</p>
          )}
        </SourceCard>
      </div>
    </section>
  );
}

function SourceCard({
  navigationPending,
  title,
  section,
  state,
  loaded,
  completedAt,
  requestLabel,
  supported = true,
  onRequest,
  onCancel,
  onOpen,
  children,
}: {
  navigationPending: boolean;
  title: string;
  section: Section;
  state: SourceState | null;
  loaded: boolean;
  completedAt: string | undefined;
  requestLabel: string;
  supported?: boolean;
  onRequest: (section: Section) => void;
  onCancel: (section: Section) => void;
  onOpen: (section: Section) => void;
  children: ReactNode;
}) {
  const running = state?.running ?? false;
  return (
    <section aria-label={`${title} source`} aria-busy={running}>
      <h4>{title}</h4>
      <p className="managed-evidence-source-state">
        {!supported
          ? "Unsupported listing."
          : running
            ? loaded
              ? "Loading source. Previous response remains visible."
              : "Loading source…"
            : loaded
              ? state?.showingPrevious
                ? "Previous response retained."
                : "Source response loaded."
              : state?.error
                ? "Source load failed."
                : "Not loaded."}
      </p>
      {completedAt && (
        <p>
          Original load completed{" "}
          <time dateTime={completedAt}>{completedAt}</time>.
        </p>
      )}
      {children}
      {state?.message && (
        <p role={state.error ? "alert" : "status"} aria-live="polite">
          {state.message}
        </p>
      )}
      <div className="trial-actions">
        {supported && (
          <button
            disabled={running || navigationPending}
            onClick={() => onRequest(section)}
          >
            {running ? `Loading ${title}…` : requestLabel}
          </button>
        )}
        {running && (
          <button className="trial-secondary" onClick={() => onCancel(section)}>
            Cancel {title}
          </button>
        )}
        <button
          className="trial-secondary"
          disabled={navigationPending}
          onClick={() => onOpen(section)}
        >
          Inspect {title}
        </button>
      </div>
    </section>
  );
}
