import {
  useResearchDraftSetFiles,
  createResearchDraftSetActions,
  type ResearchDraftSetFilesProps,
} from "./useResearchDraftSetFiles";
import { useResearchDraftSetFileFocus } from "./useResearchDraftSetFileFocus";
import {
  ResearchDraftSetFileControls,
  ResearchDraftSetFileReview,
  ResearchDraftSetFileStatus,
} from "./ResearchDraftSetFilePanels";
import "./managed-research-draft-set.css";
export type { ResearchDraftSetFilesProps } from "./useResearchDraftSetFiles";
export function ManagedResearchDraftSetFiles(
  props: ResearchDraftSetFilesProps,
) {
  const view = useResearchDraftSetFiles(props),
    focus = useResearchDraftSetFileFocus(view.state, view.isCurrent),
    actions = createResearchDraftSetActions(
      view,
      focus.requested,
      focus.reading,
    );
  return (
    <details
      id="managed-research-draft-set-files"
      className="managed-valuation-input-files"
    >
      <summary>Research draft-set files</summary>
      <p>
        Choose loaded resource drafts, inspect their complete contents, then
        save one private JSON file. Omitted resources are listed explicitly. The
        file contains your notes, ledger, checks and staged assumptions in plain
        text.
      </p>
      <p>
        Selecting a file reads it locally. Compare and restore one resource at a
        time, keeping its current saved base. Catalog review, Review and each
        Save remain separate. The file excludes unapplied forms, the valuation
        editor, calculations, prices and source packets.
      </p>
      <ResearchDraftSetFileControls {...view} actions={actions} focus={focus} />
      <ResearchDraftSetFileReview {...view} actions={actions} focus={focus} />
      <ResearchDraftSetFileStatus state={view.state} />
    </details>
  );
}
