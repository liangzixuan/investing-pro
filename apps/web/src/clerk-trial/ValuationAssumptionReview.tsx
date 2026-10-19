import {
  MANAGED_VALUATION_DCF_MODEL_VERSION,
  MANAGED_VALUATION_EXIT_MODEL_VERSION,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { valuationScenarioLabels } from "./ManagedValuationResults";
import { VALUATION_SCENARIOS } from "./managed-valuation-workbench";
import type { ManagedValuationSnapshot } from "./managed-valuation-workbench";
import {
  dcfFields,
  exitFields,
  exitScenarioFields,
} from "./valuation-input-labels";

export function ValuationRawInputs({
  dcf,
  exit,
}: {
  readonly dcf: ValuationAssumptionEntry["dcf"]["inputs"];
  readonly exit: ValuationAssumptionEntry["exit"]["inputs"];
}) {
  const value = (label: string, text: string) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd className="managed-valuation-raw">
        {text === "" ? <em>Empty</em> : text}
      </dd>
    </div>
  );
  return (
    <>
      <h5>Cash flow DCF inputs</h5>
      <dl>{dcfFields.map(([key, label]) => value(label, dcf[key]))}</dl>
      {VALUATION_SCENARIOS.map((scenario) => (
        <dl key={scenario}>
          {value(
            `${valuationScenarioLabels[scenario]} annual cash flow growth (%)`,
            dcf.scenarios[scenario].annualCashFlowGrowthPercent,
          )}
        </dl>
      ))}
      <h5>Exit EBITDA multiple inputs</h5>
      <dl>{exitFields.map(([key, label]) => value(label, exit[key]))}</dl>
      {VALUATION_SCENARIOS.map((scenario) => (
        <div key={scenario}>
          <h6>{valuationScenarioLabels[scenario]}</h6>
          <dl>
            {exitScenarioFields.map(([key, label]) =>
              value(label, exit.scenarios[scenario][key]),
            )}
          </dl>
        </div>
      ))}
    </>
  );
}

export function ValuationAssumptionReview({
  entry,
}: {
  readonly entry: ValuationAssumptionEntry;
}) {
  return (
    <section aria-label={`Complete assumptions for ${entry.listing.symbol}`}>
      <ListingIdentity member={entry.listing} />
      <dl>
        {Object.entries(identityLabels).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{entry.listing[key as keyof typeof entry.listing]}</dd>
          </div>
        ))}
        <div>
          <dt>Catalog snapshot SHA-256</dt>
          <dd>{entry.catalogSnapshotSha256}</dd>
        </div>
        <div>
          <dt>SEC CIK</dt>
          <dd>{entry.cik ?? "Not specified"}</dd>
        </div>
        <div>
          <dt>DCF model</dt>
          <dd>{entry.dcf.modelVersion}</dd>
        </div>
        <div>
          <dt>Exit model</dt>
          <dd>{entry.exit.modelVersion}</dd>
        </div>
      </dl>
      <ValuationRawInputs dcf={entry.dcf.inputs} exit={entry.exit.inputs} />
    </section>
  );
}

export function ValuationEditorReview({
  editor,
}: {
  readonly editor: ManagedValuationSnapshot;
}) {
  const owner = editor.owner;
  if (!owner) return <p>The editor has no company inputs.</p>;
  return (
    <>
      {editor.inputIssue && (
        <p>{editor.inputIssue} The last accepted text is shown below.</p>
      )}
      <ValuationAssumptionReview
        entry={{
          catalogSnapshotSha256: owner.catalogSnapshotSha256,
          listing: owner.listing,
          cik: owner.cik,
          dcf: {
            modelVersion: MANAGED_VALUATION_DCF_MODEL_VERSION,
            inputs: editor.dcfDraft,
          },
          exit: {
            modelVersion: MANAGED_VALUATION_EXIT_MODEL_VERSION,
            inputs: editor.exitDraft,
          },
        }}
      />
    </>
  );
}
