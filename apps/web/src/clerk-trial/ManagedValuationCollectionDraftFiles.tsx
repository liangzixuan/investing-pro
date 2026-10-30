import {
  useValuationCollectionDraftFiles,
  createValuationCollectionFileActions,
  type ValuationCollectionFilesProps,
} from "./useValuationCollectionDraftFiles";
import { useValuationCollectionDraftFileFocus } from "./useValuationCollectionDraftFileFocus";
import {
  ValuationCollectionFileControls,
  ValuationCollectionFileReview,
  ValuationCollectionFileCancel,
  ValuationCollectionFileStatus,
} from "./ValuationCollectionDraftFilePanels";
export type { ValuationCollectionFilesProps } from "./useValuationCollectionDraftFiles";
export function ManagedValuationCollectionDraftFiles(
  props: ValuationCollectionFilesProps,
) {
  const view = useValuationCollectionDraftFiles(props);
  const focus = useValuationCollectionDraftFileFocus(
    view.state,
    view.isCurrent,
  );
  const actions = createValuationCollectionFileActions(view, focus);
  return (
    <details
      id="managed-valuation-collection-files"
      className="managed-valuation-input-files"
    >
      <summary>Valuation collection files</summary>
      <p>
        Capture every staged valuation entry in order, inspect the complete
        collection, then save a private JSON file. It includes each listing and
        all text entered for both models, including unfinished inputs.
      </p>
      <p>
        This file excludes the current workbench editor, calculated results,
        prices and source packets. It does not stage the editor. Restore changes
        only the valuation draft and keeps its loaded online save base. Catalog
        review, Review and Save remain separate.
      </p>
      <ValuationCollectionFileControls
        {...view}
        focus={focus}
        actions={actions}
      />
      <ValuationCollectionFileReview
        {...view}
        focus={focus}
        actions={actions}
      />
      <ValuationCollectionFileCancel {...view} actions={actions} />
      <ValuationCollectionFileStatus state={view.state} />
    </details>
  );
}
