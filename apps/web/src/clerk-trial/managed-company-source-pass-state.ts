import type { ManagedResearchSelection } from "./managed-research-selection";
import type {
  CompanySourceOutcome,
  CompanySourceOutcomes,
} from "./managed-company-snapshot-load";
import {
  snapshotSourceEvidence,
  type CompanySnapshotLoadSource,
  type SnapshotLoadSource,
  type SnapshotSourceState,
} from "./managed-company-snapshot-load-sources";

export type CompanySourceDisposition = CompanySourceOutcome | "missing";
export interface CompanySourcePassRow {
  readonly id: CompanySnapshotLoadSource;
  readonly name: CompanySnapshotLoadSource;
  readonly label: string;
  readonly selected: boolean;
  readonly disposition: CompanySourceDisposition;
  readonly evidence: Readonly<{ completedAt: string | null; message: string }>;
}
export interface CompanySourcePassPreview {
  readonly selection: ManagedResearchSelection;
  readonly names: readonly CompanySnapshotLoadSource[];
  readonly rows: readonly CompanySourcePassRow[];
}
export interface ManagedCompanySourcePassState {
  readonly preview: CompanySourcePassPreview | null;
  readonly phase:
    "idle" | "preview" | "running" | "finished" | "cancelled" | "invalidated";
  readonly rows: readonly CompanySourcePassRow[];
  readonly message: string;
}
export const idleCompanySourcePass = (): ManagedCompanySourcePassState =>
  Object.freeze({
    preview: null,
    phase: "idle",
    rows: Object.freeze([]),
    message: "",
  });
function sourceDisposition(
  source: SnapshotLoadSource,
  state: SnapshotSourceState,
  selection: ManagedResearchSelection,
  selected: boolean,
): CompanySourceDisposition {
  if (state.response !== null) return "retained";
  if (!source.covered(selection)) return "unsupported";
  return selected ? "missing" : "not_attempted";
}
/** Project only captured source evidence; this never opens or loads a model. */
export function companySourcePassRows(
  sources: readonly SnapshotLoadSource[],
  selection: ManagedResearchSelection,
  names: readonly CompanySnapshotLoadSource[],
  outcomes?: CompanySourceOutcomes,
  states?: readonly SnapshotSourceState[],
): readonly CompanySourcePassRow[] {
  return Object.freeze(
    sources.map((source, index) => {
      const state = states?.[index] ?? source.model.getSnapshot();
      const selected = names.includes(source.name);
      let disposition = sourceDisposition(source, state, selection, selected);
      if (selected && outcomes) disposition = outcomes[source.name];
      return Object.freeze({
        id: source.name,
        name: source.name,
        label: source.label,
        selected,
        disposition,
        evidence: snapshotSourceEvidence(state),
      });
    }),
  );
}
/** A cancelled announcement has no loader result and cannot inherit another run. */
export function unattemptedCompanySourcePassRows(
  preview: CompanySourcePassPreview,
): readonly CompanySourcePassRow[] {
  return Object.freeze(
    preview.rows.map((row) =>
      Object.freeze({
        ...row,
        disposition:
          row.disposition === "missing"
            ? ("not_attempted" as const)
            : row.disposition,
      }),
    ),
  );
}
