/** Complete source observations for the new accession-evidence mode. */
import type { PersonalSecQuarterlyConcept } from "./personal-sec-quarterly-evidence";
import type {
  PersonalSecFilingContextIssue,
  PersonalSecFilingReportingConcept,
} from "./personal-sec-filing-context";
import type {
  PersonalSecQuarterAssessmentSelectionDto,
  Sha256,
} from "./personal-sec-quarter-assessment";

export interface QuarterQName {
  readonly raw: string;
  readonly namespace: string | null;
  readonly localName: string | null;
}
export interface QuarterRawAttribute {
  readonly name: string;
  readonly namespace: string | null;
  readonly localName: string | null;
  readonly value: string;
}
export interface QuarterSourceTextRun {
  readonly beforeChildIndex: number;
  readonly text: string;
}
export interface QuarterXmlObservation {
  readonly elementOrdinal: number;
  readonly name: QuarterQName;
  readonly attributes: readonly QuarterRawAttribute[];
  readonly qnameAttributes: readonly Readonly<{
    name: string;
    value: QuarterQName;
  }>[];
  readonly textQName: QuarterQName | null;
  readonly textRuns: readonly QuarterSourceTextRun[];
  readonly children: readonly QuarterXmlObservation[];
}
export interface QuarterContextRecord {
  readonly id: string;
  readonly xmlId: string;
  readonly elementOrdinal: number;
  readonly root: QuarterXmlObservation;
}
export interface QuarterUnitRecord {
  readonly id: string;
  readonly xmlId: string;
  readonly elementOrdinal: number;
  readonly root: QuarterXmlObservation;
}
export type QuarterPrimaryFailureReason =
  | PersonalSecFilingContextIssue
  | "invalid_input"
  | "source_hash_mismatch"
  | "aggregate_candidate_limit"
  | "metadata_limit"
  | "structural_limit";
export type QuarterPrimaryOccurrenceIssue = PersonalSecFilingContextIssue;
export interface QuarterPrimaryOccurrence {
  readonly id: string;
  readonly elementOrdinal: number;
  readonly locator: string;
  readonly factId: string | null;
  readonly concept: QuarterQName;
  readonly rawContextRef: string | null;
  readonly contextRecordId: string | null;
  readonly rawUnitRef: string | null;
  readonly unitRecordId: string | null;
  readonly rawText: string;
  readonly format: QuarterQName | null;
  readonly sign: string | null;
  readonly scale: string | null;
  readonly decimals: string | null;
  readonly precision: string | null;
  readonly value: string | null;
  readonly issues: readonly QuarterPrimaryOccurrenceIssue[];
  readonly elementRecordId: string | null;
  readonly actualTableOrdinal: number | null;
  readonly actualRowOrdinal: number | null;
  readonly actualCellOrdinal: number | null;
}
export interface QuarterConceptPopulation {
  readonly concept: PersonalSecQuarterlyConcept;
  readonly occurrences: readonly QuarterPrimaryOccurrence[];
}
export interface QuarterReportingObservation {
  readonly id: string;
  readonly elementOrdinal: number;
  readonly locator: string;
  readonly factId: string | null;
  readonly concept: QuarterQName;
  readonly rawContextRef: string | null;
  readonly contextRecordId: string | null;
  readonly rawText: string;
  readonly format: QuarterQName | null;
  readonly value: string | null;
  readonly issues: readonly (
    PersonalSecFilingContextIssue | "invalid_metadata_value"
  )[];
  readonly elementRecordId: string | null;
}
export interface QuarterReportingMetadata {
  readonly fields: readonly Readonly<{
    concept: PersonalSecFilingReportingConcept;
    status: "observed" | "missing" | "conflicting" | "unsupported";
    value: string | null;
    observationIds: readonly string[];
  }>[];
  readonly observations: readonly QuarterReportingObservation[];
}
export interface QuarterSourceRecord {
  readonly id: string;
  readonly elementOrdinal: number;
  readonly endElementOrdinal: number;
  readonly name: QuarterQName;
  readonly attributes: readonly QuarterRawAttribute[];
  readonly parentRecordId: string | null;
  readonly parentElementOrdinal: number | null;
  readonly childIndex: number;
  readonly elementChildCount: number;
  readonly descendantTableCount: number;
  readonly descendantTableOrdinals: readonly number[] | null;
  readonly textRuns: readonly QuarterSourceTextRun[] | null;
  readonly childRecordIds: readonly string[];
  readonly childrenComplete: boolean;
  readonly actualTableOrdinal: number | null;
  readonly actualRowOrdinal: number | null;
  readonly actualCellOrdinal: number | null;
}
export interface QuarterSiblingWindow {
  readonly parentRecordId: string;
  readonly firstChildIndex: number;
  readonly childRecordIds: readonly string[];
}
export type QuarterTableReason =
  "nested_table" | "unsupported_geometry" | "unsupported_source_structure";
export interface QuarterTableObservation {
  readonly tableRecordId: string;
  readonly status: "complete" | "unsupported";
  readonly reasons: readonly QuarterTableReason[];
  readonly rowRecordIds: readonly string[];
  readonly rows: readonly Readonly<{
    rowRecordId: string;
    cells: readonly Readonly<{
      cellRecordId: string;
      columnStart: number;
      columnSpan: number;
      rowSpan: number;
    }>[];
  }>[];
}
export interface QuarterSupplementaryFact {
  readonly id: string;
  readonly elementOrdinal: number;
  readonly elementRecordId: string;
  readonly concept: QuarterQName;
  readonly rawContextRef: string | null;
  readonly contextRecordId: string | null;
  readonly rawUnitRef: string | null;
  readonly unitRecordId: string | null;
  readonly format: QuarterQName | null;
  readonly rawText: string;
  readonly sign: string | null;
  readonly scale: string | null;
  readonly decimals: string | null;
  readonly precision: string | null;
  readonly issues: readonly QuarterPrimaryOccurrenceIssue[];
}
export interface QuarterDocumentObservations {
  readonly elementCount: number;
  readonly styleElements: number;
  readonly stylesheetLinks: number;
  readonly processingInstructions: readonly Readonly<{
    locator: string;
    target: string;
  }>[];
  readonly scripts: readonly Readonly<{
    elementOrdinal: number;
    name: QuarterQName;
    attributes: readonly QuarterRawAttribute[];
    inlineTextCharacters: number;
    lastDocumentElementOrdinal: number;
  }>[];
  readonly eventAttributeCount: number;
}
export interface QuarterStructureProjection {
  readonly profileVersion: "sparse-source-1.0.0";
  readonly status: "complete" | "unsupported";
  readonly reasons: readonly QuarterTableReason[];
  readonly document: QuarterDocumentObservations;
  readonly records: readonly QuarterSourceRecord[];
  readonly siblingWindows: readonly QuarterSiblingWindow[];
  readonly tables: readonly QuarterTableObservation[];
  readonly supplementaryFacts: readonly QuarterSupplementaryFact[];
  readonly anchorRecordIds: readonly string[];
}
export interface PersonalSecQuarterPrimaryEvidenceDto {
  readonly schemaVersion: "1.0.0";
  readonly mode: "accession_evidence";
  readonly documentSha256: Sha256;
  readonly documentBytes: number;
  readonly cik: string;
  readonly selection: PersonalSecQuarterAssessmentSelectionDto;
  readonly status: "complete" | "unavailable";
  readonly reason: QuarterPrimaryFailureReason | null;
  readonly concepts: readonly QuarterConceptPopulation[];
  readonly contexts: readonly QuarterContextRecord[];
  readonly units: readonly QuarterUnitRecord[];
  readonly reportingMetadata: QuarterReportingMetadata | null;
  readonly structure: QuarterStructureProjection | null;
}
