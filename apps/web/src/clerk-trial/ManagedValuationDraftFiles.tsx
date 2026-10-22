import {
  useValuationDraftFiles,
  createValuationDraftFileActions,
  type ValuationDraftFilesProps,
} from "./useValuationDraftFiles";
import { useValuationDraftFileFocus } from "./useValuationDraftFileFocus";
import {
  ValuationDraftFileControls,
  ValuationDraftFileReview,
  ValuationDraftFileStatus,
} from "./ValuationDraftFilePanels";

export function ManagedValuationDraftFiles(props: ValuationDraftFilesProps) {
  const view = useValuationDraftFiles(props);
  const focus = useValuationDraftFileFocus(view.state, view.isCurrent);
  const actions = createValuationDraftFileActions(view, focus.requested);
  const current = view.isCurrent();
  return (
    <details
      id="managed-valuation-draft-files"
      className="managed-valuation-input-files"
    >
      <summary>Valuation inputs files</summary>
      <p>
        Keep a file copy of both complete editor models before leaving. The JSON
        file contains listing identities and your raw assumptions in plain text.
        Store it privately. It does not replace a saved-record backup.
      </p>
      <p>
        Selecting a file reads it locally for comparison before explicit
        restore. Restoring changes only the editor. It does not calculate, stage
        or save online. Empty and invalid numeric text within the editor limits
        can be kept in the file. Loading saved inputs is not required.
      </p>
      <ValuationDraftFileControls
        state={view.state}
        input={focus.input}
        current={current}
        actions={actions}
      />
      <ValuationDraftFileReview
        state={view.state}
        heading={focus.heading}
        current={current}
        actions={actions}
      />
      <ValuationDraftFileStatus state={view.state} />
    </details>
  );
}
