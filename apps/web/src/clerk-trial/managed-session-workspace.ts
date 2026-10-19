import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import { createManagedApi, type ManagedApi } from "./managed-api";
import type { ManagedResearchCoverage } from "./managed-research-eligibility";
import { ManagedWorkspace } from "./managed-workspace";
import type { TrialSession } from "./session";

export interface ManagedSessionWorkspaceOptions {
  session: TrialSession;
  apiOrigin: string;
  api?: ManagedApi;
  marketsCohort?: readonly ManagedEodIdentity[];
  priceCoverage?: readonly ManagedEodIdentity[];
  financialScreenListingIds?: readonly string[];
  researchCoverage?: ManagedResearchCoverage;
}

/** Compose one session's API and fixed source policies. */
export function createManagedSessionWorkspace(
  initial: ManagedSessionWorkspaceOptions,
): ManagedWorkspace {
  return new ManagedWorkspace(
    initial.api ?? createManagedApi(initial.apiOrigin, initial.session),
    initial.session,
    undefined,
    {
      ...(initial.researchCoverage
        ? { researchCoverage: initial.researchCoverage }
        : {}),
      ...(initial.marketsCohort
        ? { marketsCohort: initial.marketsCohort }
        : {}),
      ...(initial.priceCoverage
        ? { priceCoverage: initial.priceCoverage }
        : {}),
      ...(initial.financialScreenListingIds
        ? { financialScreenListingIds: initial.financialScreenListingIds }
        : {}),
    },
  );
}
