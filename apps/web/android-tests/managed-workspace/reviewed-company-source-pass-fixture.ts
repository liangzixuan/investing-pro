import type { SharedNativeFixture } from "./fixture";
import { reviewedCompanyPassEvidence } from "./reviewed-company-source-pass-evidence";
import { ReviewedCompanySourcePassStore } from "./reviewed-company-source-pass-store";

export interface ReviewedCompanySourcePassControls {
  readonly settleCancelledAnnual: () => void;
  readonly getSnapshot: () => Readonly<{
    order: readonly string[];
    aborted: number;
    late: number;
  }>;
  readonly subscribe: (listener: () => void) => () => void;
}

/** One held invented Annual read exercises Cancel and a later explicitly reviewed continuation. */
export async function createReviewedCompanySourcePassNativeFixture(
  base: SharedNativeFixture,
) {
  const evidence = await reviewedCompanyPassEvidence(base);
  const store = new ReviewedCompanySourcePassStore(base, evidence);
  return {
    ...base,
    api: {
      ...base.api,
      load: store.load,
      eodHistory: store.eodHistory,
      annualReport: store.annualReport,
      recentFilings: store.recentFilings,
      interimReport: store.interimReport,
      save: store.save,
    },
    financialReview: null,
    interimReview: evidence.metadata,
    reviewedCompanySourcePass: store.controls,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
  };
}
