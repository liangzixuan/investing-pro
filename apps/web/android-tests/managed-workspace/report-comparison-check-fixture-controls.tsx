import { useRef, useState, useSyncExternalStore } from "react";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { fixture } from "./native-fixture-environment";
import { savedValuationInputs } from "./fixture";
import { NativeReportRevisitFixture } from "./native-report-revisit-fixture";
import {
  reportCheckNote,
  reportCheckIndependentResult,
  reportComparisonCheckExpected,
} from "./report-comparison-check-fixture-data";
export function ReportComparisonCheckFixtureControls({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const control = fixture.reportComparisonCheck!;
  const counts = useSyncExternalStore(control.subscribe, control.getSnapshot),
    view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot),
    watchlist = useSyncExternalStore(
      workspace.coordinator.subscribe,
      workspace.coordinator.getSnapshot,
    ),
    portfolio = useSyncExternalStore(
      workspace.portfolio.coordinator.subscribe,
      workspace.portfolio.coordinator.getSnapshot,
    ),
    followups = useSyncExternalStore(
      workspace.followups.coordinator.subscribe,
      workspace.followups.coordinator.getSnapshot,
    ),
    followupsLocal = useSyncExternalStore(
      workspace.followups.subscribe,
      workspace.followups.getSnapshot,
    ),
    annual = useSyncExternalStore(
      workspace.annual.subscribe,
      workspace.annual.getSnapshot,
    ),
    editor = useSyncExternalStore(
      workspace.valuation.subscribe,
      workspace.valuation.getSnapshot,
    );
  const [captured, setCaptured] = useState(false),
    baseline = useRef<{
      selection: NonNullable<typeof view.research>["selection"];
      section: string;
      response: typeof annual.response;
      watchlist: typeof watchlist.draft;
      portfolio: typeof portfolio.draft;
      editor: typeof editor;
    } | null>(null);
  const loaded =
    watchlist.baseVersion === 7 &&
    portfolio.baseVersion === 3 &&
    followups.baseVersion === 1;
  return (
    <aside aria-label="Invented report check journey controls">
      <NativeReportRevisitFixture />
      <button
        id="fixture-report-check-author"
        disabled={!loaded || watchlist.dirty || !editor.context}
        onClick={() => {
          workspace.note("listing-zero", reportCheckNote);
          workspace.portfolio.coordinator.replaceDraft({
            ledger: {
              ...control.data.portfolio,
              opening: {
                ...control.data.portfolio.opening,
                cashUsd: "1500.00",
              },
            },
          });
          workspace.followups.edit(
            followups.draft!.entries[1]!,
            "result",
            reportCheckIndependentResult,
          );
          const context = workspace.valuation.getSnapshot().context!,
            input = {
              ...savedValuationInputs!,
              listing: context.listing,
              cik: context.cik,
              catalogSnapshotSha256: context.catalogSnapshotSha256,
            };
          if (
            !workspace.valuation.restoreDraftInputs(
              input,
              workspace.valuation.getSnapshot(),
            ) ||
            !workspace.valuation.calculate()
          )
            throw new Error("Invented report check valuation setup refused");
        }}
      >
        Author independent invented report-check drafts
      </button>
      <button
        id="fixture-report-check-capture"
        disabled={
          !watchlist.dirty || !annual.response || !view.research || captured
        }
        onClick={() => {
          if (!view.research || !annual.response) return;
          baseline.current = {
            selection: view.research.selection,
            section: view.research.section,
            response: annual.response,
            watchlist: watchlist.draft,
            portfolio: portfolio.draft,
            editor,
          };
          setCaptured(true);
        }}
      >
        Record invented comparison visit observations
      </button>
      <pre id="fixture-report-comparison-check" hidden>
        {JSON.stringify({
          counts,
          captured,
          view: view.view,
          route: view.companyRoute,
          selection: view.research?.selection ?? null,
          watchlist,
          portfolio,
          followups,
          followupsLocal,
          editor,
          annual,
          attached: view.research
            ? (workspace.getCompanyResearchChecks(view.research.selection)
                ?.attachment?.entry.id ?? null)
            : null,
          canonical: followups.draft
            ? encodeResearchFollowupsPayload(followups.draft)
            : null,
          expectedCanonical: followups.draft?.entries[0]?.completedOn
            ? encodeResearchFollowupsPayload(
                reportComparisonCheckExpected(
                  fixture,
                  followups.draft.entries[0].result,
                  followups.draft.entries[0].completedOn,
                ),
              )
            : null,
          sameSelection:
            captured &&
            view.research?.selection === baseline.current?.selection,
          sameSection:
            captured && view.research?.section === baseline.current?.section,
          sameResponse:
            captured && annual.response === baseline.current?.response,
          sameWatchlist:
            captured && watchlist.draft === baseline.current?.watchlist,
          samePortfolio:
            captured && portfolio.draft === baseline.current?.portfolio,
          sameEditor: captured && editor === baseline.current?.editor,
        })}
      </pre>
    </aside>
  );
}
