import { vi } from "vitest";
import {
  isMainWatchlistPayload,
  type MainWatchlistPayload,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { createScreenComparisonReportFixture } from "./screen-comparison-report-fixture";
import { ManagedResearchFollowups } from "./managed-research-followups";
import { SaveCoordinator } from "./save-coordinator";
import type { ManagedApi } from "./managed-api";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  ManagedScreenComparisonFollowupContext,
  type ScreenComparisonFollowupHost,
} from "./managed-screen-comparison-followup-context";
import type { PreparedScreenComparisonReport } from "./screen-comparison-report";
import { prepareScreenComparisonFollowup } from "./managed-screen-comparison-followup";

function signal() {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: () => {
      for (const listener of listeners) listener();
    },
  };
}
export function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
export const followupId = (n: number) =>
  "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
type ComparisonScreenFixture = Awaited<
  ReturnType<typeof createScreenComparisonReportFixture>
>;
function comparisonSession() {
  return {
    userId: "invented-comparison-user",
    sessionId: "invented-comparison-session",
    getToken: vi.fn(),
    signOut: vi.fn(),
  };
}
function watchlistPayload(
  report: PreparedScreenComparisonReport,
): MainWatchlistPayload {
  return {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: report.catalogSnapshotSha256,
    memberships: [report.left, report.right].map((company) => ({
      ...company.listing,
      note: "Saved original note",
    })),
  };
}
async function watchlistFixture(
  report: PreparedScreenComparisonReport,
  session: ReturnType<typeof comparisonSession>,
) {
  const payload = watchlistPayload(report);
  const watchlistSave = vi.fn();
  const watchlist = new SaveCoordinator<MainWatchlistPayload>(
    {
      mode: "managed",
      empty: () => null,
      copy: (value) => structuredClone(value),
      capture: (value) =>
        isMainWatchlistPayload(value) ? structuredClone(value) : null,
      load: () => Promise.resolve({ version: 1, payload }),
      save: watchlistSave,
    },
    session,
    {
      loadPrompt: "Load",
      retired: "Retired",
      signedOut: "Signed out",
      signOutFailed: "Retry",
      invalidDraft: "Invalid",
      saveRejected: "Rejected",
      accessDenied: "Denied",
      loadFailed: "Failed",
    },
  );
  await watchlist.load();
  watchlist.replaceDraft({
    ...watchlist.getSnapshot().draft!,
    memberships: watchlist
      .getSnapshot()
      .draft!.memberships.map((member, index) => ({
        ...member,
        note: index === 0 ? "Keep this unsaved Watchlist note." : member.note,
      })),
  });
  return { watchlist, watchlistSave };
}
function followupStore(entries: readonly ResearchFollowup[]) {
  let stored: { version: number; payload: ResearchFollowupsPayload } = {
    version: 0,
    payload: { schemaVersion: 1, entries },
  };
  const api = {
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(stored))),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockImplementation((command) => {
        stored = {
          version: command.expectedVersion + 1,
          payload: structuredClone(command.payload),
        };
        return Promise.resolve({ ...structuredClone(stored), replayed: false });
      }),
    resolve: vi.fn<ManagedApi["resolve"]>(),
  };
  return { api, stored: () => stored };
}
function followupsFixture(
  report: PreparedScreenComparisonReport,
  watchlist: SaveCoordinator<MainWatchlistPayload>,
  session: ReturnType<typeof comparisonSession>,
  entries: readonly ResearchFollowup[],
) {
  const store = followupStore(entries);
  let next = 100;
  const followups = new ManagedResearchFollowups(store.api, session, {
    getCreationContext: () => ({
      draft: watchlist.getSnapshot().draft,
      catalogSnapshotSha256: report.catalogSnapshotSha256,
    }),
    onRetire: vi.fn(),
    newEntryId: () => followupId(next++),
  });
  return { ...store, followups };
}
function comparisonHost(
  screen: ComparisonScreenFixture,
  report: PreparedScreenComparisonReport,
  watchlist: SaveCoordinator<MainWatchlistPayload>,
  followups: ManagedResearchFollowups,
) {
  const updates = signal(),
    sessions = signal();
  const state = {
    available: true,
    navigation: 0,
    view: 0,
    catalog: { snapshotSha256: report.catalogSnapshotSha256 } as NonNullable<
      ReturnType<ScreenComparisonFollowupHost["revision"]>["catalog"]
    >,
    sessionPhase: "active",
    fileReview: false,
  };
  // Unit host; source and save models are real. Root integration tests use ManagedWorkspace itself.
  const workspace = {
    subscribe: updates.subscribe,
    financialScreen: screen.model,
    coordinator: watchlist,
    followups,
    canEdit: () => watchlist.canEdit(),
    watchlistFileCatalogReviewRequired: () => state.fileReview,
    sessionOwner: {
      subscribe: sessions.subscribe,
      getSnapshot: () => ({ phase: state.sessionPhase }),
    },
  } as unknown as ManagedWorkspace;
  const host: ScreenComparisonFollowupHost = {
    workspace,
    available: () => state.available && !state.fileReview,
    memberReady: (member) =>
      watchlist.canEdit() &&
      watchlist.getSnapshot().draft!.memberships.includes(member),
    revision: () => ({
      navigation: state.navigation,
      view: state.view,
      catalog: state.catalog,
    }),
  };
  return { host, state, updates, sessions };
}
function comparisonActions(context: ManagedScreenComparisonFollowupContext) {
  const form = { current: true, source: true };
  const capture = () =>
    context.capture(new Date().toISOString(), () => form.source).capture!;
  const source = capture();
  const port = (side = "left", captured = source) =>
    context.capturePort(captured, side).port!;
  const prepare = (
    question = "What could change the next research decision? Café 東京 😀",
    dueOn = "2026-12-31",
    side = "left",
  ) =>
    prepareScreenComparisonFollowup(
      port(side),
      { question, dueOn },
      () => form.current,
    );
  return { form, capture, source, port, prepare };
}
export async function comparisonFollowupFixture(
  loadFollowups = true,
  entries: readonly ResearchFollowup[] = [],
  screenOptions: Parameters<typeof createScreenComparisonReportFixture>[0] = {},
) {
  const screen = await createScreenComparisonReportFixture(screenOptions);
  const report = screen.capture()!.report;
  const session = comparisonSession();
  const { watchlist, watchlistSave } = await watchlistFixture(report, session);
  const { api, followups, stored } = followupsFixture(
    report,
    watchlist,
    session,
    entries,
  );
  if (loadFollowups) await followups.coordinator.load();
  const { host, state, updates, sessions } = comparisonHost(
    screen,
    report,
    watchlist,
    followups,
  );
  const context = new ManagedScreenComparisonFollowupContext(host);
  const actions = comparisonActions(context);
  return {
    screen,
    report,
    api,
    followups,
    watchlist,
    watchlistSave,
    context,
    host,
    state,
    updates,
    sessions,
    ...actions,
    stored,
  };
}

export function disposeComparisonFollowupFixture(
  f: Awaited<ReturnType<typeof comparisonFollowupFixture>>,
) {
  f.context.retire();
  f.followups.retire();
  f.watchlist.retire();
  f.screen.model.retire();
}
