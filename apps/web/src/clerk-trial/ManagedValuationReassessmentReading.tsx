import type { RefObject } from "react";
import {
  MANAGED_VALUATION_DCF_MODEL_VERSION,
  MANAGED_VALUATION_EXIT_MODEL_VERSION,
} from "@research-cockpit/contracts";
import type { ManagedValuationReassessmentState } from "./managed-valuation-reassessment";
import { ValuationAssumptionReview } from "./ValuationAssumptionReview";
import { ManagedValuationResults } from "./ManagedValuationResults";
import type { ManagedValuationCalculation } from "./managed-valuation-workbench";

type Baseline = NonNullable<ManagedValuationReassessmentState["baseline"]>;

function BaselineTimes({ baseline }: { baseline: Baseline }) {
  return (
    <dl>
      <div>
        <dt>Saved resource version</dt>
        <dd>{baseline.capture.saved.version}</dd>
      </div>
      <div>
        <dt>Baseline captured at (UTC)</dt>
        <dd>{baseline.capturedAt}</dd>
      </div>
    </dl>
  );
}

export function ManagedValuationBaselineReading({
  baseline,
  headingRef,
}: {
  baseline: Baseline;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section aria-labelledby="managed-valuation-reassessment-heading">
      <h4
        id="managed-valuation-reassessment-heading"
        tabIndex={-1}
        ref={headingRef}
      >
        Saved reassessment baseline
      </h4>
      <BaselineTimes baseline={baseline} />
      <p>
        These are confirmed saved inputs. Capture leaves the editor unchanged.
        No historical calculation, Price packet, Annual reference or source
        timestamp is stored with these assumptions.
      </p>
      <ValuationAssumptionReview entry={baseline.capture.entry} />
    </section>
  );
}

function CalculationInputs({
  calculation,
}: {
  calculation: ManagedValuationCalculation;
}) {
  return (
    <ValuationAssumptionReview
      entry={{
        catalogSnapshotSha256: calculation.owner.catalogSnapshotSha256,
        listing: calculation.owner.listing,
        cik: calculation.owner.cik,
        dcf: {
          modelVersion: MANAGED_VALUATION_DCF_MODEL_VERSION,
          inputs: calculation.dcfDraft,
        },
        exit: {
          modelVersion: MANAGED_VALUATION_EXIT_MODEL_VERSION,
          inputs: calculation.exitDraft,
        },
      }}
    />
  );
}

export function ManagedValuationReassessmentReading({
  baseline,
  reading,
  headingRef,
}: {
  baseline: Baseline;
  reading: NonNullable<ManagedValuationReassessmentState["reading"]>;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section
      id="managed-valuation-reassessment-reading"
      aria-labelledby="managed-valuation-reassessment-results-heading"
    >
      <h4
        id="managed-valuation-reassessment-results-heading"
        tabIndex={-1}
        ref={headingRef}
      >
        Saved and revised valuation
      </h4>
      <BaselineTimes baseline={baseline} />
      <p>Evaluated at (UTC): {reading.evaluatedAt}</p>
      <p>
        The saved inputs were evaluated at this Calculate action's time. This is
        not a historical calculated result. Both sides retain the exact raw
        inputs and independent model results from this evaluation.
      </p>
      <p>
        Price and Annual source context is not retained in this paired reading.
        Inspect the existing source panels for their current evidence, original
        timestamps and qualifications. Neither side supplies a historical source
        timestamp.
      </p>
      <div className="managed-valuation-comparison">
        <section aria-label="Saved inputs evaluated now">
          <h5>Saved inputs evaluated now</h5>
          <ValuationAssumptionReview entry={baseline.capture.entry} />
          <ManagedValuationResults calculation={reading.savedCalculation} />
        </section>
        <section aria-label="Revised authored inputs">
          <h5>Revised authored inputs</h5>
          <CalculationInputs calculation={reading.revisedCalculation} />
          <ManagedValuationResults calculation={reading.revisedCalculation} />
        </section>
      </div>
      <p>
        Note and dated-check actions use the current revised calculation.
        Review, Stage and each resource's Save remain separate actions.
      </p>
    </section>
  );
}
