import {
  PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
  type PersonalSecInterimCanonicalEvidenceDto as Evidence,
} from "@research-cockpit/contracts";
import { assertPersonalSecInterimCanonicalEvidence } from "./personal-sec-interim-evidence";
/** Deterministic content binding; excludes only generation.sha256. This does not compute or verify SHA-256. */
export function serializePersonalSecInterimCanonicalGeneration(
  evidence: Evidence,
): string {
  assertPersonalSecInterimCanonicalEvidence(evidence);
  const source = (s: Evidence["generation"]["sources"]["companyFacts"]) => [
    s.status,
    s.sourceUrl,
    s.fetchedAt,
    s.sha256,
    s.bytes,
  ];
  const target =
    evidence.target.status === "target"
      ? [
          "target",
          evidence.target.accessionNumber,
          evidence.target.form,
          evidence.target.filedDate,
          evidence.target.reportDate,
          evidence.target.acceptedAt,
        ]
      : ["unresolved", evidence.target.reason];
  const scans = evidence.facts.scans.map((item) => {
    const scan = item.scan;
    if (scan.status !== "available")
      return [item.concept, scan.status, null, null];
    const { full, selected, otherAccessions, returned, omittedSelected } =
      scan.coverage;
    return [
      item.concept,
      scan.status,
      scan.absence,
      [
        [
          full.candidateRows,
          full.inspectedRows,
          full.invalidRows,
          full.duplicateRows,
          full.uniqueObservations,
        ],
        selected,
        otherAccessions,
        returned,
        omittedSelected,
      ],
    ];
  });
  const observations = evidence.facts.observations.map((row) => [
    row.id,
    row.taxonomy,
    row.concept,
    row.unit,
    row.value,
    row.startDate,
    row.endDate,
    row.durationDays,
    row.periodBasis,
    row.filingFocusYear,
    row.filingFocusPeriod,
    row.frame,
    row.accessionNumber,
    row.form,
    row.filedDate,
    row.sourceLocator,
    [
      row.filing.status,
      row.filing.form,
      row.filing.filedDate,
      row.filing.reportDate,
      row.filing.acceptedAt,
      row.filing.sourceUrl,
    ],
  ]);
  return JSON.stringify([
    "personal-sec-interim-canonical-evidence",
    PERSONAL_SEC_INTERIM_CANONICAL_VERSION,
    evidence.cik,
    [
      evidence.generation.definitionVersion,
      evidence.generation.cutoffAt,
      evidence.generation.completedAt,
      source(evidence.generation.sources.companyFacts),
      source(evidence.generation.sources.submissions),
    ],
    target,
    evidence.targetScan === null
      ? null
      : [
          evidence.targetScan.currentFilings,
          evidence.targetScan.interimFilings,
          evidence.targetScan.olderHistoryAvailable,
        ],
    [evidence.facts.registryVersion, scans, observations],
  ]);
}
