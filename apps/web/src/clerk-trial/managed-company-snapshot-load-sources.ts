import type {
  ManagedAnnualReport,
  ManagedAnnualReportState,
} from "./managed-annual-report";
import type {
  ManagedCompanyFilings,
  ManagedCompanyFilingsState,
} from "./managed-company-filings";
import type {
  ManagedEodHistory,
  ManagedEodHistoryState,
} from "./managed-eod-history";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";

export type CompanySnapshotLoadSource = "eod" | "annual" | "filings";
export interface SnapshotSourceState {
  readonly selection: ManagedResearchSelection | null;
  readonly response: unknown;
  readonly running: boolean;
  readonly catalogChanged: boolean;
  readonly error: boolean;
  readonly showingPrevious: boolean;
  readonly message: string;
}
interface SnapshotSourceModel {
  readonly getSnapshot: () => SnapshotSourceState;
  readonly subscribe: (listener: () => void) => () => void;
  open(selection: ManagedResearchSelection): void;
  load(): Promise<void>;
  cancel(): void;
}
export interface SnapshotLoadSource {
  readonly name: CompanySnapshotLoadSource;
  readonly label: string;
  readonly model: SnapshotSourceModel;
  readonly covered: (selection: ManagedResearchSelection) => boolean;
  readonly accepted: () => boolean;
}
export const snapshotSourceRange = (state: SnapshotSourceState) =>
  "selectedRange" in state ? state.selectedRange : null;
function checkingSeed(state: SnapshotSourceState) {
  return "checkingSeed" in state && state.checkingSeed === true;
}
function freshResponse(state: SnapshotSourceState) {
  if (state.response === null) return false;
  if (state.error) return false;
  return !state.showingPrevious;
}
function acceptedPrice(state: ManagedEodHistoryState) {
  if (!freshResponse(state)) return false;
  return state.response?.range === state.selectedRange;
}
function availableAnnualSources(
  response: PersonalSecAnnualCanonicalResponseDto | null,
) {
  if (!response) return false;
  const evidence = response.evidence;
  if (evidence.target.status !== "target") return false;
  if (evidence.generation.sources.companyFacts.status !== "available")
    return false;
  return evidence.generation.sources.submissions.status === "available";
}
function acceptedAnnual(state: ManagedAnnualReportState) {
  if (!freshResponse(state)) return false;
  if (state.view === null) return false;
  if (state.checkingSeed) return false;
  return availableAnnualSources(state.response);
}
function acceptedFilings(state: ManagedCompanyFilingsState) {
  if (!freshResponse(state)) return false;
  return state.response?.issuer.status === "available";
}
function priceSource(price: ManagedEodHistory): SnapshotLoadSource {
  return {
    name: "eod",
    label: "Price",
    model: price,
    covered: (selection) => price.hasPriceCoverage(selection.listing),
    accepted: () => acceptedPrice(price.getSnapshot()),
  };
}
function annualSource(annual: ManagedAnnualReport): SnapshotLoadSource {
  return {
    name: "annual",
    label: "Annual",
    model: annual,
    covered: (selection) => annual.hasCoverage(selection),
    accepted: () => acceptedAnnual(annual.getSnapshot()),
  };
}
function filingsSource(filings: ManagedCompanyFilings): SnapshotLoadSource {
  return {
    name: "filings",
    label: "Filings",
    model: filings,
    covered: (selection) => filings.hasCoverage(selection),
    accepted: () => acceptedFilings(filings.getSnapshot()),
  };
}
/** Fixed source order and each actual model's independent response eligibility. */
export function companySnapshotLoadSources(
  price: ManagedEodHistory,
  annual: ManagedAnnualReport,
  filings: ManagedCompanyFilings,
): readonly SnapshotLoadSource[] {
  return [priceSource(price), annualSource(annual), filingsSource(filings)];
}
export function snapshotSourceIdle(state: SnapshotSourceState) {
  if (state.running) return false;
  if (checkingSeed(state)) return false;
  return !state.catalogChanged;
}
export function snapshotSourceVisitMatches(
  selection: ManagedResearchSelection,
  state: SnapshotSourceState,
) {
  if (state.selection === null) return true;
  return companyEvidenceSelectionMatches(selection, state.selection);
}
export function snapshotOpeningMatches(
  selection: ManagedResearchSelection,
  state: SnapshotSourceState,
) {
  if (state.running) return false;
  if (state.catalogChanged) return false;
  if (state.response !== null) return false;
  return snapshotSourceVisitMatches(selection, state);
}
export function snapshotSourceRefused(
  source: SnapshotLoadSource,
  state: SnapshotSourceState,
) {
  if (state.error) return true;
  if (state.response === null) return false;
  return !source.accepted();
}
export function snapshotSourceAlreadyPresent(
  source: SnapshotLoadSource,
  selection: ManagedResearchSelection,
) {
  if (source.model.getSnapshot().response !== null) return true;
  return !source.covered(selection);
}
function stoppedReason(state: SnapshotSourceState) {
  if (state.response === null) return state.message;
  if (state.error) return state.message;
  if (state.catalogChanged) return state.message;
  return "The response was retained, but its source is unavailable. Inspect the original source details.";
}
export function snapshotSourceStopMessage(
  source: SnapshotLoadSource,
  state: SnapshotSourceState,
) {
  return `${source.label} stopped. ${stoppedReason(state)}`;
}
