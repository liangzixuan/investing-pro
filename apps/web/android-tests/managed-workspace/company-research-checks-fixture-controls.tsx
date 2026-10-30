import { useRef, useState, useSyncExternalStore } from "react";
import { encodeResearchFollowupsPayload } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { fixture } from "./native-fixture-environment";
import { savedValuationInputs } from "./fixture";
import {
  companyCheckNote,
  companyCheckIndependentResult,
  companyChecksExpected,
} from "./company-research-checks-fixture-data";
export function CompanyResearchChecksFixtureControls({
  workspace,
}: {
  workspace: ManagedWorkspace;
}) {
  const control = fixture.companyResearchChecks!;
  const counts = useSyncExternalStore(control.subscribe, control.getSnapshot);
  const view = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const watchlist = useSyncExternalStore(
    workspace.coordinator.subscribe,
    workspace.coordinator.getSnapshot,
  );
  const portfolio = useSyncExternalStore(
    workspace.portfolio.coordinator.subscribe,
    workspace.portfolio.coordinator.getSnapshot,
  );
  const followups = useSyncExternalStore(
    workspace.followups.coordinator.subscribe,
    workspace.followups.coordinator.getSnapshot,
  );
  const followupsLocal = useSyncExternalStore(
    workspace.followups.subscribe,
    workspace.followups.getSnapshot,
  );
  const filings = useSyncExternalStore(
    workspace.filings.subscribe,
    workspace.filings.getSnapshot,
  );
  const editor = useSyncExternalStore(
    workspace.valuation.subscribe,
    workspace.valuation.getSnapshot,
  );
  const [captured, setCaptured] = useState(false);
  const baseline = useRef<{
    selection: NonNullable<typeof view.research>["selection"];
    section: string;
    response: typeof filings.response;
    watchlist: typeof watchlist.draft;
    portfolio: typeof portfolio.draft;
    editor: typeof editor;
  } | null>(null);
  const loaded =
    watchlist.baseVersion === 7 &&
    portfolio.baseVersion === 3 &&
    followups.baseVersion === 1;
  return (
    <aside aria-label="Invented company research check controls">
      <button
        id="fixture-company-checks-author"
        disabled={!loaded || watchlist.dirty || !editor.context}
        onClick={() => {
          workspace.note("listing-zero", companyCheckNote);
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
            companyCheckIndependentResult,
          );
          const context = workspace.valuation.getSnapshot().context!;
          const input = {
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
            throw new Error("Invented company valuation setup refused");
        }}
      >
        Author independent invented drafts
      </button>
      <button
        id="fixture-company-checks-capture"
        disabled={
          !watchlist.dirty || !filings.response || !view.research || captured
        }
        onClick={() => {
          if (!view.research || !filings.response) return;
          baseline.current = {
            selection: view.research.selection,
            section: view.research.section,
            response: filings.response,
            watchlist: watchlist.draft,
            portfolio: portfolio.draft,
            editor,
          };
          setCaptured(true);
        }}
      >
        Capture invented visit observations
      </button>
      <pre id="fixture-company-research-checks" hidden>
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
          filings,
          attached: view.research
            ? (workspace.getCompanyResearchChecks(view.research.selection)
                ?.attachment?.entry.id ?? null)
            : null,
          expectedCanonical: followups.draft?.entries[0]?.completedOn
            ? encodeResearchFollowupsPayload(
                companyChecksExpected(
                  fixture,
                  followups.draft.entries[0].completedOn,
                ),
              )
            : null,
          canonical: followups.draft
            ? encodeResearchFollowupsPayload(followups.draft)
            : null,
          sameSelection:
            captured &&
            view.research?.selection === baseline.current?.selection,
          sameSection:
            captured && view.research?.section === baseline.current?.section,
          sameResponse:
            captured && filings.response === baseline.current?.response,
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
