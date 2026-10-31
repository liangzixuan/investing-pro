import { ReviewFilingsEvidenceFixtureControls } from "./review-filings-evidence-fixture-controls";
import { PortfolioHeldDueChecksFixtureControls } from "./portfolio-held-due-checks-fixture-controls";
import { PortfolioComparisonReportFixtureDiagnostics } from "./portfolio-comparison-report-fixture-diagnostics";
import { PortfolioReportComparisonFixtureControls } from "./portfolio-report-comparison-fixture-controls";
import { PortfolioScreenSelectionFixtureControls } from "./portfolio-screen-selection-fixture-controls";
import { ReportComparisonCheckFixtureControls } from "./report-comparison-check-fixture-controls";
import { CompanyResearchChecksFixtureControls } from "./company-research-checks-fixture-controls";
import { ResearchDraftSetFixtureControls } from "./research-draft-set-fixture-controls";
import { createNativeResearchDraftSetFileSession } from "./native-research-draft-set-file-fixture";
import { ValuationCollectionRecoveryFixtureControls } from "./valuation-collection-recovery-fixture-controls";
import { createNativeValuationCollectionDraftFileSession } from "./native-valuation-collection-file-fixture";
import { ReviewCompletionFixtureDiagnostics } from "./review-check-completion-fixture-diagnostics";
import { FilingAssessmentFixtureDiagnostics } from "./filing-check-assessment-fixture-diagnostics";
import { useSyncExternalStore } from "react";
import { ReviewedCompanySourcePassFixtureControls } from "./reviewed-company-source-pass-fixture-controls";
import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  calendarFollowupWatchlistNote,
  calendarFollowupExpected,
  calendarFollowupOriginal,
} from "./calendar-followup-fixture";
import { MarketsSourceReviewFixtureControls } from "./markets-source-review-fixture-controls";
import { HoldingFollowupFixtureControls } from "./holding-followup-fixture-controls";
import { App } from "@capacitor/app";
import { CompanySnapshotLoadingFixtureControls } from "./company-snapshot-loading-fixture-controls";
import { useLayoutEffect, useState } from "react";
import { ManagedWorkspaceRouter } from "../../src/clerk-trial/ManagedWorkspaceScreen";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { TrialFrame } from "../../src/clerk-trial/TrialFrame";
import type { TrialSession } from "../../src/clerk-trial/session";
import { createNativeDraftFileSession } from "./native-draft-file-session";
import { createNativeValuationDraftFileSession } from "./native-valuation-draft-file-fixture";
import {
  fixture,
  scenario,
  nativeReport,
  nativeExport,
  nativePortfolioReviewReport,
  nativePortfolioComparisonReport,
  nativeFollowupsReviewReport,
  nativeScreenComparisonReport,
  nativeDraftFile,
  nativeValuationDraftFile,
  nativeValuationCollectionDraftFile,
  nativeResearchDraftSetFile,
  nativeScreenRecipe,
} from "./native-fixture-environment";
import { nativeFixtureRouterPorts } from "./native-fixture-router-ports";
import { FixtureDraftDiagnostics } from "./fixture-draft-diagnostics";
import { ReportRevisitFixtureControls } from "./report-revisit-fixture-controls";
import { PortfolioReviewReportFixtureControls } from "./portfolio-review-report-fixture-controls";
import { ScreenComparisonFollowupFixtureDiagnostics } from "./screen-comparison-followup-fixture-diagnostics";
import { ScreenComparisonReportFixtureControls } from "./screen-comparison-report-fixture-controls";
import { FollowupsReviewReportFixtureControls } from "./followups-review-report-fixture-controls";
import { PortfolioFixtureControls } from "./portfolio-fixture-controls";
import { FollowupsFixtureControls } from "./followups-fixture-controls";
interface Props {
  session: TrialSession;
  onFreshSession: (session: TrialSession) => void;
}
interface MountedProps {
  workspace: ManagedWorkspace | null;
  onFreshSession: (session: TrialSession) => void;
}
function useFixtureWorkspace(session: TrialSession) {
  const [workspace, setWorkspace] = useState<ManagedWorkspace | null>(null);
  useLayoutEffect(() => {
    const current = new ManagedWorkspace(fixture.api, session, undefined, {
      researchCoverage: fixture.researchCoverage,
      ...(fixture.interimReview
        ? { interimIssuers: fixture.interimReview.issuers }
        : {}),
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
      ...(fixture.screenComparison
        ? { financialScreenListingIds: fixture.screenComparison.listingIds }
        : {}),
      ...(fixture.financialScreen
        ? { financialScreenListingIds: fixture.financialScreen.listingIds }
        : {}),
    });
    if (
      scenario === "portfolio-screen-selection" ||
      scenario === "portfolio-report-comparison" ||
      scenario === "portfolio-comparison-report"
    )
      current.setView("portfolio");
    if (
      scenario === "portfolio-held-due-checks" ||
      scenario === "review-filings-evidence"
    )
      current.setView("followups");
    setWorkspace(current);
    if (
      scenario !== "review-filings-evidence" &&
      scenario !== "portfolio-held-due-checks" &&
      scenario !== "holding-followup" &&
      scenario !== "portfolio-screen-selection" &&
      scenario !== "company-research-checks" &&
      scenario !== "report-comparison-check" &&
      scenario !== "portfolio-composition-review"
    )
      void current.coordinator.load();
    void current.refreshCatalog();
    return () => current.sessionOwner.dispose();
  }, [session]);

  return workspace;
}
function CalendarFollowupFixtureControls({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const followups = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  const feed = useSyncExternalStore(
    workspace.announcements.subscribe,
    workspace.announcements.getSnapshot,
  );
  return (
    <aside aria-label="Invented calendar follow-up controls">
      <button
        id="fixture-calendar-followup-author-note"
        disabled={watchlist.baseVersion !== 1 || watchlist.dirty}
        onClick={() =>
          workspace.note("listing-zero", calendarFollowupWatchlistNote)
        }
      >
        Author independent invented calendar note
      </button>
      <pre id="fixture-calendar-followup-evidence" hidden>
        {JSON.stringify({
          watchlist: watchlist.draft,
          encodedWatchlist: watchlist.draft
            ? encodeMainWatchlistPayload(watchlist.draft)
            : null,
          followups: followups.draft,
          encodedFollowups: followups.draft
            ? encodeResearchFollowupsPayload(followups.draft)
            : null,
          originalEncodedFollowups: encodeResearchFollowupsPayload(
            calendarFollowupOriginal(fixture),
          ),
          expectedEncodedFollowups: followups.draft?.entries[2]
            ? encodeResearchFollowupsPayload(
                calendarFollowupExpected(
                  fixture,
                  followups.draft.entries[2].id,
                ),
              )
            : null,
          feed: feed.announcements,
        })}
      </pre>
    </aside>
  );
}

function DraftAndRevisitControls({
  workspace,
}: Pick<MountedProps, "workspace">) {
  return (
    <>
      {workspace && <FixtureDraftDiagnostics workspace={workspace} />}
      {workspace && scenario === "markets-calendar-followup" && (
        <CalendarFollowupFixtureControls workspace={workspace} />
      )}
      {workspace && fixture.sourceReview && (
        <MarketsSourceReviewFixtureControls
          workspace={workspace}
          controls={fixture.sourceReview}
        />
      )}
      {workspace &&
        fixture.reviewedCompanySourcePass &&
        fixture.interimReview && (
          <ReviewedCompanySourcePassFixtureControls
            workspace={workspace}
            controls={fixture.reviewedCompanySourcePass}
            metadata={fixture.interimReview}
          />
        )}
      {workspace && fixture.companySnapshotLoading && (
        <CompanySnapshotLoadingFixtureControls workspace={workspace} />
      )}
      <ReportRevisitFixtureControls workspace={workspace} scenario={scenario} />
    </>
  );
}
function NativeDeliveryControls({
  workspace,
}: Pick<MountedProps, "workspace">) {
  return (
    <>
      {workspace && fixture.screenComparisonFollowup && (
        <ScreenComparisonFollowupFixtureDiagnostics
          workspace={workspace}
          fixture={fixture}
        />
      )}
      {workspace && nativeScreenComparisonReport && (
        <ScreenComparisonReportFixtureControls workspace={workspace} />
      )}
      {workspace &&
        nativePortfolioReviewReport &&
        scenario !== "portfolio-report-comparison" &&
        scenario !== "portfolio-comparison-report" && (
          <PortfolioReviewReportFixtureControls workspace={workspace} />
        )}
      {workspace && fixture.reviewCompletion && nativeFollowupsReviewReport && (
        <ReviewCompletionFixtureDiagnostics
          workspace={workspace}
          fixture={fixture}
          report={nativeFollowupsReviewReport}
        />
      )}
      {workspace && fixture.filingAssessment && nativeFollowupsReviewReport && (
        <FilingAssessmentFixtureDiagnostics
          workspace={workspace}
          fixture={fixture}
          report={nativeFollowupsReviewReport}
        />
      )}
      {workspace &&
        nativeFollowupsReviewReport &&
        !fixture.filingAssessment &&
        !fixture.reviewCompletion && (
          <FollowupsReviewReportFixtureControls workspace={workspace} />
        )}
      {workspace && nativeReport && (
        <nativeReport.Controls workspace={workspace} />
      )}
      {workspace && nativeExport && (
        <nativeExport.Controls workspace={workspace} />
      )}
    </>
  );
}
function ResourceControls({ workspace, onFreshSession }: MountedProps) {
  return (
    <>
      {workspace &&
        (scenario === "holding-followup" ||
          scenario === "portfolio-composition-review") && (
          <HoldingFollowupFixtureControls
            workspace={workspace}
            onFreshSession={onFreshSession}
          />
        )}
      {workspace && fixture.portfolio && (
        <PortfolioFixtureControls
          workspace={workspace}
          onFreshSession={onFreshSession}
        />
      )}
      {workspace && fixture.followups && (
        <FollowupsFixtureControls
          workspace={workspace}
          onFreshSession={onFreshSession}
        />
      )}
    </>
  );
}
export function FixtureSession({ session, onFreshSession }: Props) {
  const workspace = useFixtureWorkspace(session);
  const [researchDraftSetFileSession] = useState(() =>
    createNativeResearchDraftSetFileSession(
      nativeResearchDraftSetFile,
      session,
    ),
  );
  const [collectionFileSession] = useState(() =>
    createNativeValuationCollectionDraftFileSession(
      nativeValuationCollectionDraftFile,
      session,
    ),
  );
  const [draftFileSession] = useState(() =>
    createNativeDraftFileSession(nativeDraftFile, session),
  );
  const [valuationDraftFileSession] = useState(() =>
    createNativeValuationDraftFileSession(nativeValuationDraftFile, session),
  );

  return (
    <>
      <TrialFrame managed compact>
        {workspace ? (
          <ManagedWorkspaceRouter
            workspace={workspace}
            androidBack={App}
            {...nativeFixtureRouterPorts()}
            {...draftFileSession.routerProps}
            {...valuationDraftFileSession.routerProps}
            {...collectionFileSession.routerProps}
            {...researchDraftSetFileSession.routerProps}
            {...nativeScreenRecipe.routerProps}
          />
        ) : (
          <p role="status">Loading your workspace…</p>
        )}
      </TrialFrame>
      {fixture.interimReview && (
        <pre id="fixture-interim-report-metadata" hidden>
          {JSON.stringify(fixture.interimReview)}
        </pre>
      )}
      <DraftAndRevisitControls workspace={workspace} />
      <NativeDeliveryControls workspace={workspace} />
      <draftFileSession.Controls
        workspace={workspace}
        onFreshSession={onFreshSession}
      />
      <valuationDraftFileSession.Controls />
      <collectionFileSession.Controls />
      <researchDraftSetFileSession.Controls />
      {workspace && fixture.researchDraftSet && (
        <ResearchDraftSetFixtureControls
          workspace={workspace}
          onFreshSession={onFreshSession}
        />
      )}
      {workspace && fixture.collectionRecovery && (
        <ValuationCollectionRecoveryFixtureControls
          workspace={workspace}
          onFreshSession={onFreshSession}
        />
      )}
      <nativeScreenRecipe.Controls />
      {workspace && fixture.reportComparisonCheck && (
        <ReportComparisonCheckFixtureControls workspace={workspace} />
      )}
      {workspace && fixture.companyResearchChecks && (
        <CompanyResearchChecksFixtureControls workspace={workspace} />
      )}
      {workspace && fixture.portfolioScreenSelection && (
        <PortfolioScreenSelectionFixtureControls
          workspace={workspace}
          fixture={fixture.portfolioScreenSelection}
        />
      )}
      {workspace &&
        fixture.portfolioReportComparison &&
        nativePortfolioReviewReport && (
          <PortfolioReportComparisonFixtureControls
            workspace={workspace}
            fixture={fixture.portfolioReportComparison}
            delivery={nativePortfolioReviewReport}
          />
        )}
      {nativePortfolioComparisonReport && (
        <PortfolioComparisonReportFixtureDiagnostics
          delivery={nativePortfolioComparisonReport}
        />
      )}
      {workspace && fixture.reviewFilingsEvidence && (
        <ReviewFilingsEvidenceFixtureControls
          workspace={workspace}
          fixture={fixture.reviewFilingsEvidence}
        />
      )}
      {workspace && fixture.portfolioHeldDueChecks && (
        <PortfolioHeldDueChecksFixtureControls
          workspace={workspace}
          fixture={fixture.portfolioHeldDueChecks}
        />
      )}
      <ResourceControls workspace={workspace} onFreshSession={onFreshSession} />
    </>
  );
}
