import {
  membershipMatchesResult,
  type ResearchFollowup,
} from "@research-cockpit/contracts";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import type { ManagedResearchSelection } from "./managed-research-selection";

export interface ManagedResearchFollowupContext {
  readonly entry: ResearchFollowup;
  readonly editable: boolean;
  readonly dirty: boolean;
  readonly reason: string | null;
  readonly isCurrent: () => boolean;
  readonly editAssessment: (raw: string) => void;
}

/** A visit capability edits only the captured entry in the existing draft. */
export function captureResearchFollowupContext(options: {
  readonly model: ManagedResearchFollowups;
  readonly selection: ManagedResearchSelection;
  readonly owner: {
    readonly id: string;
    readonly selection: ManagedResearchSelection;
  } | null;
  readonly isVisitCurrent: () => boolean;
  readonly canEditVisit: () => boolean;
}): ManagedResearchFollowupContext | null {
  const { model, selection, owner } = options;
  if (
    selection.origin !== "followups" ||
    selection.cik !== null ||
    !owner ||
    !companyEvidenceSelectionMatches(selection, owner.selection)
  )
    return null;
  const saved = model.coordinator.getSnapshot();
  const draft = saved.draft;
  const entry = model.currentEntry(owner.id);
  if (
    !draft ||
    !entry ||
    !draft.entries.includes(entry) ||
    entry.catalogSnapshotSha256 !== selection.catalogSnapshotSha256 ||
    !membershipMatchesResult({ ...entry.listing, note: "" }, selection.listing)
  )
    return null;
  const draftIsCurrent = () =>
    model.getSnapshot().catalogSnapshotSha256 ===
      selection.catalogSnapshotSha256 &&
    model.coordinator.getSnapshot().draft === draft &&
    model.currentEntry(owner.id) === entry;
  let retired = false;
  const isCurrent = () => {
    if (retired || !options.isVisitCurrent() || !draftIsCurrent())
      retired = true;
    return !retired;
  };
  if (!isCurrent()) return null;
  const canEdit = () =>
    isCurrent() && model.canEdit() && options.canEditVisit();
  const editable = canEdit();
  return Object.freeze({
    entry,
    editable,
    dirty: saved.dirty,
    reason: editable
      ? null
      : "Assessment editing is paused. Finish the pending action or Follow-ups recovery first.",
    isCurrent,
    editAssessment(raw: string) {
      if (!editable || !canEdit()) return;
      // Retire before notifications can reenter this callback.
      retired = true;
      model.edit(entry, "result", raw);
    },
  });
}
