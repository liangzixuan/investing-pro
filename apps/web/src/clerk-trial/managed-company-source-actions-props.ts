import type { ComponentProps } from "react";
import type { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import type {
  ManagedWorkspace,
  ManagedResearchVisit,
} from "./managed-workspace";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";

type SourceActions = Pick<
  ComponentProps<typeof ManagedCompanyResearch>,
  | "filingsFollowupActions"
  | "holdingFollowupActions"
  | "holdingPosition"
  | "snapshotLoad"
  | "onLoadSnapshot"
  | "onCancelSnapshot"
  | "onRequestSource"
  | "onCancelSource"
  | "onSection"
>;

/** Bind source requests, cancellation and section navigation to one rendered visit. */
export function managedCompanySourceActionsProps(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
  navigation: ManagedCompanyNavigation | undefined,
): SourceActions {
  return {
    filingsFollowupActions: filingQuestionActions(workspace, visit),
    ...(visit.selection.origin === "portfolio"
      ? holdingQuestionActions(workspace, visit, navigation)
      : {}),
    snapshotLoad: workspace.companySnapshotLoad,
    onLoadSnapshot: async () => {
      if (navigation?.invalid || navigation?.isPending()) return;
      await workspace.loadCompanySnapshot(visit);
    },
    onCancelSnapshot: () => workspace.cancelCompanySnapshot(visit),
    onRequestSource: requestCompanySource(workspace, visit, navigation),
    onCancelSource: cancelCompanySource(workspace, visit, navigation),
    onSection: selectCompanySourceSection(workspace, visit, navigation),
  };
}

function requestCompanySource(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
  navigation: ManagedCompanyNavigation | undefined,
): SourceActions["onRequestSource"] {
  return async (section) => {
    if (
      navigation?.isPending() ||
      navigation?.invalid ||
      workspace.getSnapshot().research?.selection !== visit.selection
    )
      return;
    const reading = workspace.requestResearchSource(visit, section);
    const current = workspace.getSnapshot().research;
    if (current?.selection === visit.selection && current.section === section)
      navigation?.section(section);
    await reading;
  };
}

function cancelCompanySource(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
  navigation: ManagedCompanyNavigation | undefined,
): SourceActions["onCancelSource"] {
  return (section) => {
    if (navigation?.invalid) return;
    workspace.cancelResearchSource(visit, section);
  };
}

function selectCompanySourceSection(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
  navigation: ManagedCompanyNavigation | undefined,
): SourceActions["onSection"] {
  return (section) => {
    if (workspace.getSnapshot().research?.selection !== visit.selection) return;
    if (navigation) navigation.section(section);
    else if (section === "interim") workspace.switchToInterim();
    else if (section === "annual") workspace.switchToAnnual();
    else if (section === "eod") workspace.switchToEod();
    else if (section === "filings") workspace.switchToFilings();
  };
}

function filingQuestionActions(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
): NonNullable<SourceActions["filingsFollowupActions"]> {
  return {
    model: workspace.followups,
    getContext: (response, filing) =>
      workspace.captureFilingsFollowup(visit.selection, response, filing),
    canLoad: (response, filing) =>
      workspace.canLoadFilingsFollowups(visit.selection, response, filing),
    load: (response, filing, current) =>
      workspace.loadFilingsFollowups(
        visit.selection,
        response,
        filing,
        current,
      ),
  };
}

function holdingQuestionActions(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
  navigation: ManagedCompanyNavigation | undefined,
): Pick<SourceActions, "holdingFollowupActions" | "holdingPosition"> {
  const active = () =>
    !navigation?.invalid &&
    !navigation?.isPending() &&
    workspace.getSnapshot().research?.selection === visit.selection;
  return {
    holdingPosition: workspace.getHoldingResearchPosition(visit.selection),
    holdingFollowupActions: {
      model: workspace.followups,
      getContext: () =>
        active()
          ? workspace.captureHoldingFollowup(visit.selection)
          : {
              port: null,
              reason: "Return to this holding's current company visit first.",
            },
      canLoad: () =>
        active() && workspace.canLoadHoldingFollowups(visit.selection),
      load: async (current) => {
        if (!active()) return;
        await workspace.loadHoldingFollowups(
          visit.selection,
          () => active() && current(),
        );
      },
      reviewExisting: reviewHoldingQuestion(
        workspace,
        visit,
        navigation,
        active,
      ),
    },
  };
}

function reviewHoldingQuestion(
  workspace: ManagedWorkspace,
  visit: ManagedResearchVisit,
  navigation: ManagedCompanyNavigation | undefined,
  active: () => boolean,
): () => void {
  return () => {
    if (!active()) return;
    workspace.reviewHoldingFollowup(
      visit.selection,
      navigation && (() => navigation.view("followups")),
    );
  };
}
