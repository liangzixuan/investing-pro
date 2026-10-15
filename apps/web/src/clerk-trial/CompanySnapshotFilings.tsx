import type { ManagedCompanyFilingsState } from "./managed-company-filings";
import { managedFilingsStatus } from "./managed-company-filings";
import {
  FilingsPacketSummary,
  FilingsPacketSource,
} from "./ManagedFilingsPacket";

export function CompanySnapshotFilings({
  state,
  onOpen,
}: {
  state: ManagedCompanyFilingsState | null;
  onOpen: () => void;
}) {
  const response = state?.response;
  return (
    <section aria-label="Snapshot filings">
      <h3>Filings</h3>
      {response ? (
        <>
          {response.issuer.status !== "available" && (
            <p>{managedFilingsStatus(response.issuer.status)}</p>
          )}
          <FilingsPacketSummary response={response} />
          <p>
            SEC Submissions · source checked {response.issuer.fetchedAt};
            request started {response.requestStartedAt}; completed{" "}
            {response.completedAt}.
          </p>
          {(state?.running || state?.showingPrevious) && (
            <p className="discovery-warning">
              Showing previous filings metadata. This refresh has not confirmed
              a newer list.
            </p>
          )}
          <FilingsPacketSource response={response} />
        </>
      ) : (
        <p>
          No filing metadata loaded for this company. Open Filings to request it
          explicitly.
        </p>
      )}
      <button className="trial-secondary" onClick={onOpen}>
        Open Filings section
      </button>
    </section>
  );
}
