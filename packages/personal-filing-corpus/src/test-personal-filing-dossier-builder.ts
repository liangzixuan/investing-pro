import { PERSONAL_FILING_FACT_KEYS } from "./personal-filing-fact-normalization";
import {
  PERSONAL_FILING_DOSSIER_PLAN_ROLE,
  PERSONAL_FILING_DOSSIER_PROFILE,
  PERSONAL_FILING_DOSSIER_SCHEMA_VERSION,
  PERSONAL_FILING_DOSSIER_SNAPSHOT_RULE,
  type PersonalFilingDossierInput,
} from "./personal-filing-dossier";
import { createPersonalFilingQualityMeasurementProtocol } from "./personal-filing-quality-measurement";
import { buildPersonalFilingQualityMeasurementFixture } from "./test-personal-filing-quality-measurement-builder";

export function buildPersonalFilingDossierInput(
  withAmendment = false,
  documentIndex = 0,
  selection: {
    readonly chartFactKeys?: readonly (typeof PERSONAL_FILING_FACT_KEYS)[number][];
    readonly factKeys?: readonly (typeof PERSONAL_FILING_FACT_KEYS)[number][];
  } = {},
): PersonalFilingDossierInput {
  const fixture = buildPersonalFilingQualityMeasurementFixture(
    withAmendment && documentIndex > 0,
  );
  const committed = createPersonalFilingQualityMeasurementProtocol().commit(
    fixture.commitInput,
  );
  if (committed.status !== "candidate_committed_for_personal_use") {
    throw new TypeError("Generated dossier fixture did not commit.");
  }
  return {
    ...fixture.commitInput,
    dossierPlan: {
      chartFactKeys: selection.chartFactKeys ?? ["operating_income", "revenue"],
      documentIndex,
      factKeys: selection.factKeys ?? PERSONAL_FILING_FACT_KEYS,
      profile: PERSONAL_FILING_DOSSIER_PROFILE,
      role: PERSONAL_FILING_DOSSIER_PLAN_ROLE,
      schemaVersion: PERSONAL_FILING_DOSSIER_SCHEMA_VERSION,
      snapshotRule: PERSONAL_FILING_DOSSIER_SNAPSHOT_RULE,
    },
    expectedBindings: {
      candidateCommitmentSha256: committed.candidateCommitmentSha256,
      candidateObservationsSha256: committed.candidateObservationsSha256,
      inputSetSha256: committed.inputSetSha256,
      ownerReviewedReferenceSha256: committed.ownerReviewedReferenceSha256,
      qualityPlanSha256: committed.qualityPlanSha256,
    },
  };
}

export function personalFilingDossierQuarantineFixture() {
  return {
    chart: null,
    evidence: [],
    facts: [],
    lineage: [],
    omissions: null,
    profile: PERSONAL_FILING_DOSSIER_PROFILE,
    role: "personal_dossier",
    schemaVersion: PERSONAL_FILING_DOSSIER_SCHEMA_VERSION,
    status: "quarantined",
    valuationInputs: null,
  };
}
