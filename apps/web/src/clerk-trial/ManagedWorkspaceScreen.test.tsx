import { ManagedFinancialDiscovery } from "./ManagedFinancialDiscovery";
import {
  createManagedResearchCoverageFixture,
  inventedManagedResearchCoverage,
} from "./test-managed-research-coverage-fixture";
import { viewOf } from "../features/research/test-canonical-annual-ui-fixture";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeMainWatchlistPayload,
  parseManagedEconomicCalendar,
  PERSONAL_BEA_CALENDAR_SOURCE,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace, listingIdentity } from "./managed-workspace";
import {
  ManagedSessionScreen,
  ManagedWorkspaceScreen,
} from "./ManagedWorkspaceScreen";
import { TrialApiError } from "./api";
import { TrialFrame } from "./TrialFrame";
import { ManagedEntry, ManagedSessionNotice } from "./ManagedEntry";
import { WorkspaceSearch } from "../features/workspace/WorkspaceSearch";
import type { AndroidBackAdapter } from "../mobile/android-back";
import {
  response as annualResponse,
  annualComparativeRows,
} from "../features/research/test-canonical-annual-ui-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import {
  cashResponse,
  cashRow,
} from "../features/research/test-canonical-annual-cash-ui-fixture";
import {
  liquidityResponse,
  liquidityRow,
} from "../features/research/test-canonical-annual-liquidity-ui-fixture";
import { annualLiquidityNoteExcerpt } from "./managed-annual-liquidity-note";
import { annualCashNoteExcerpt } from "./managed-annual-cash-note";
import { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import { ManagedCompanyEvidenceActions } from "./ManagedCompanyEvidenceActions";
import { ManagedMarkets } from "./ManagedMarkets";
import { ManagedMarketsBoard } from "./ManagedMarketsBoard";
import { ManagedMarketsNavigation } from "./ManagedMarketsNavigation";
import { ManagedMarketsDayView } from "./ManagedMarketsDayView";
import { ManagedBeaReleaseAgenda } from "./ManagedBeaReleaseAgenda";
import { ManagedFedAnnouncements } from "./ManagedFedAnnouncements";
import { ManagedResearchNote } from "./ManagedResearchNote";
import { ManagedPortfolio } from "./ManagedPortfolio";
import { ManagedPortfolioEntry } from "./ManagedPortfolioEntry";
import { ManagedFollowupsEntry } from "./ManagedFollowupsEntry";
import { ManagedResearchFollowups } from "./ManagedResearchFollowups";
import { ManagedNoteEditor } from "./ManagedNoteEditor";
import { ManagedWatchlistComparison } from "./ManagedWatchlistComparison";
import { ManagedWatchlistFilings } from "./ManagedWatchlistFilings";
import { ManagedWatchlistAnnualComparison } from "./ManagedWatchlistAnnualComparison";
import {
  annualComparisonMemberships,
  annualComparisonResponse,
} from "./test-canonical-annual-comparison-fixture";
import { projectAnnualComparison } from "./managed-annual-comparison-display";
import {
  getAnnualComparisonNoteEvidence,
  type AnnualComparisonNoteCapture,
} from "./managed-watchlist-annual-comparison-note";
import {
  createManagedWatchlistComparisonSelection,
  selectManagedWatchlistComparisonRow,
} from "./managed-watchlist-comparison";
import { ManagedUnsavedWatchlistReview } from "./ManagedUnsavedWatchlistReview";
import {
  ManagedWatchlistEditor,
  type ManagedWatchlistEditorHandle,
} from "./ManagedWatchlistEditor";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { projectBeaReleaseView } from "../features/markets/bea-release-view";
import { projectManagedBeaUpdatesView } from "./managed-bea-updates-view";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { projectFedAnnouncementView } from "../features/markets/fed-announcement-view";
import { projectManagedFedUpdatesView } from "./managed-fed-updates-view";
import { filingsResponse } from "./sec-filings-fixture";
import { ManagedCompanyFilings } from "./ManagedCompanyFilings";
import {
  initialManagedFilingsFilter,
  projectManagedFilingsFilter,
  selectManagedFilingsRefreshView,
} from "./managed-filings-filter";
import type { ManagedCompanyNavigation } from "./useManagedCompanyNavigation";

// Run the screen's actual listener effect explicitly; model and binder stay real.
const mounted = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | void>,
  layoutEffects: [] as Array<() => void>,
  refs: [] as Array<{ current: unknown }>,
  cleanups: [] as Array<() => void>,
  direct: false,
  refIndex: 0,
  screenState: [] as unknown[],
  screenStateIndex: 0,
  editorDirect: false,
  editorState: [] as unknown[],
  editorStateIndex: 0,
  editorRefs: [] as Array<{ current: unknown }>,
  editorRefIndex: 0,
  editorEffects: [] as Array<() => void>,
  trackEffectDependencies: false,
  effectIndex: 0,
  effectSlots: [] as Array<{
    dependencies: React.DependencyList | undefined;
    cleanup: (() => void) | undefined;
  }>,
  effectEventIndex: 0,
  effectEvents: [] as Array<{
    callback: (...args: never[]) => unknown;
    invoke: (...args: never[]) => unknown;
  }>,
  effectEventCommits: [] as Array<() => void>,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useEffect: (
      effect: () => (() => void) | void,
      dependencies?: React.DependencyList,
    ) => {
      if (mounted.editorDirect) return mounted.editorEffects.push(effect);
      if (!mounted.trackEffectDependencies) return mounted.effects.push(effect);
      const index = mounted.effectIndex++;
      const prior = mounted.effectSlots[index];
      if (
        prior &&
        dependencies &&
        prior.dependencies &&
        dependencies.length === prior.dependencies.length &&
        dependencies.every((value, at) =>
          Object.is(value, prior.dependencies![at]),
        )
      )
        return;
      mounted.effects.push(() => {
        prior?.cleanup?.();
        const cleanup = effect();
        mounted.effectSlots[index] = {
          dependencies,
          cleanup: cleanup || undefined,
        };
        return cleanup;
      });
    },
    useEffectEvent: <T extends (...args: never[]) => unknown>(
      callback: T,
    ): T => {
      // Existing SSR tests also mount their queued effects manually after rendering.
      if (!mounted.trackEffectDependencies) return callback;
      const index = mounted.effectEventIndex++;
      const slot = (mounted.effectEvents[index] ??= {
        callback,
        invoke: (...args: never[]) =>
          mounted.effectEvents[index]!.callback(...args),
      });
      // React updates Effect Events at commit, not during an abandoned render.
      mounted.effectEventCommits.push(() => {
        slot.callback = callback;
      });
      return slot.invoke as T;
    },
    useLayoutEffect: (
      effect: () => (() => void) | void,
      dependencies: React.DependencyList,
    ) =>
      mounted.editorDirect
        ? mounted.editorEffects.push(effect)
        : mounted.direct
          ? mounted.layoutEffects.push(effect)
          : actual.useLayoutEffect(effect, dependencies),
    useImperativeHandle: (
      ref: React.Ref<ManagedWatchlistEditorHandle>,
      create: () => ManagedWatchlistEditorHandle,
      dependencies: React.DependencyList,
    ) => {
      if (!mounted.editorDirect)
        return actual.useImperativeHandle(ref, create, dependencies);
      if (typeof ref === "function") ref(create());
      else if (ref) ref.current = create();
    },
    useRef: (value: unknown) => {
      if (mounted.editorDirect)
        return (mounted.editorRefs[mounted.editorRefIndex++] ??= {
          current: value,
        });
      if (mounted.direct) {
        if (mounted.refIndex === 0) mounted.screenStateIndex = 0;
        const index = mounted.refIndex++;
        return (mounted.refs[index] ??= { current: value });
      }
      const ref = actual.useRef(value);
      mounted.refs.push(ref);
      return ref;
    },
    useState: (value: unknown) => {
      if (mounted.editorDirect) {
        const index = mounted.editorStateIndex++;
        if (!(index in mounted.editorState)) mounted.editorState[index] = value;
        return [
          mounted.editorState[index],
          (next: unknown) => (mounted.editorState[index] = next),
        ];
      }
      if (mounted.direct) {
        const index = mounted.screenStateIndex++;
        if (index >= 5) return [value, vi.fn()];
        if (!(index in mounted.screenState)) mounted.screenState[index] = value;
        return [
          mounted.screenState[index],
          (next: unknown) => {
            mounted.screenState[index] =
              typeof next === "function"
                ? (next as (previous: unknown) => unknown)(
                    mounted.screenState[index],
                  )
                : next;
          },
        ];
      }
      return actual.useState(value);
    },
    useCallback: (callback: () => void, dependencies: React.DependencyList) =>
      mounted.direct ? callback : actual.useCallback(callback, dependencies),
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      getSnapshot: () => unknown,
      getServerSnapshot: () => unknown,
    ) =>
      mounted.direct || mounted.editorDirect
        ? getSnapshot()
        : actual.useSyncExternalStore(
            subscribe,
            getSnapshot,
            getServerSnapshot,
          ),
  };
});
beforeEach(() => {
  mounted.effects.length = 0;
  mounted.layoutEffects.length = 0;
  mounted.refs.length = 0;
  mounted.cleanups.length = 0;
  mounted.direct = false;
  mounted.refIndex = 0;
  mounted.screenState = [];
  mounted.screenStateIndex = 0;
  mounted.editorDirect = false;
  mounted.editorState = [];
  mounted.editorRefs = [];
  mounted.editorEffects = [];
  mounted.trackEffectDependencies = false;
  mounted.effectIndex = 0;
  mounted.effectSlots = [];
  mounted.effectEventIndex = 0;
  mounted.effectEvents = [];
  mounted.effectEventCommits = [];
});
afterEach(() => {
  for (const cleanup of mounted.cleanups) cleanup();
  vi.unstubAllGlobals();
  mounted.direct = false;
  mounted.editorDirect = false;
});

function nativeBackFixture() {
  let listener!: (event: { canGoBack: boolean }) => void;
  let registered!: (handle: { remove: () => Promise<void> }) => void;
  const remove = vi.fn<() => Promise<void>>().mockResolvedValue();
  const addListener = vi
    .fn<AndroidBackAdapter["addListener"]>()
    .mockImplementation((_name, callback) => {
      listener = callback;
      return new Promise<{ remove: () => Promise<void> }>((resolve) => {
        registered = resolve;
      });
    });
  const adapter: AndroidBackAdapter & { exitApp: () => Promise<void> } = {
    addListener,
    exitApp: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };
  const historyBack = vi.fn();
  vi.stubGlobal("window", { history: { back: historyBack } });
  return {
    adapter,
    addListener,
    remove,
    historyBack,
    press: (canGoBack: boolean) => listener({ canGoBack }),
    ready: () => registered({ remove }),
  };
}
function mountEffects() {
  for (const effect of mounted.effects) {
    const cleanup = effect();
    if (cleanup) mounted.cleanups.push(cleanup);
  }
}
function committedNativeScreen(workspace: ManagedWorkspace) {
  mounted.direct = true;
  mounted.trackEffectDependencies = true;
  return {
    render(adapter: AndroidBackAdapter, navigation: ManagedCompanyNavigation) {
      mounted.refIndex = 0;
      mounted.effectIndex = 0;
      mounted.effectEventIndex = 0;
      return ManagedWorkspaceScreen({
        workspace,
        androidBack: adapter,
        navigation,
      });
    },
    commit() {
      for (const event of mounted.effectEventCommits.splice(0)) event();
      for (const layout of mounted.layoutEffects.splice(0)) layout();
      for (const effect of mounted.effects.splice(0)) {
        const cleanup = effect();
        if (cleanup) mounted.cleanups.push(cleanup);
      }
    },
    discard() {
      mounted.effectEventCommits.length = 0;
      mounted.layoutEffects.length = 0;
      mounted.effects.length = 0;
    },
  };
}

const payload: MainWatchlistPayload = {
  name: "My Watchlist",
  schemaVersion: 1,
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  memberships: [
    {
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: "issuer-one",
      issuerName: "Invented issuer",
      listingId: "listing-one",
      securityId: "security-one",
      securityName: "Common stock",
      shareClassId: "class-one",
      shareClassName: "Class A",
      symbol: "DEMO",
      note: "Private research note",
    },
  ],
};
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: `sha256:${"a".repeat(64)}`,
  catalogId: "synthetic-catalog",
  catalogVersion: "synthetic-version",
  acquiredAt: "2026-09-29T00:00:00.000Z",
  generatedAt: "2026-09-30T00:00:00.000Z",
  asOf: "2026-09-30T12:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 2,
    activeListings: 2,
    admittedSourceRecords: 2,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 2,
    quarantinedSourceRecords: 0,
    sourceRecords: 2,
    staleSourceRecords: 0,
    shareClasses: 2,
    totalSecurities: 2,
    unsupportedSourceRecords: 0,
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture(
  initial = payload,
  priceCoverage = [eodSelection.listing, ...payload.memberships],
) {
  const api: ManagedApi = {
    loadValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions read"),
      ),
    saveValuationAssumptions: () =>
      Promise.reject(
        new Error("Unexpected invented valuation assumptions write"),
      ),
    loadPortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    savePortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockRejectedValue(
        new Error("Follow-ups require an explicit fixture action"),
      ),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockRejectedValue(
        new Error("Follow-ups require an explicit fixture action"),
      ),
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockRejectedValue(new Error("Unexpected announcements read")),
    blsCalendar: vi.fn(),
    economicCalendar: vi.fn(),
    eodHistory: vi.fn(),
    recentFilings: vi.fn<ManagedApi["recentFilings"]>(),
    annualReport: vi.fn(),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockResolvedValue({ version: 1, payload: initial }),
    save: vi.fn(),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn(),
    resolve: vi.fn(),
  };
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "synthetic-user",
      sessionId: "synthetic-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    undefined,
    {
      researchCoverage: initial.memberships.some(
        (member) =>
          member.symbol === "ONE" && member.issuerName === "One Company",
      )
        ? inventedManagedResearchCoverage
        : createManagedResearchCoverageFixture([
            { listing: eodSelection.listing, cik: "0000000001" },
            ...payload.memberships.map((listing) => ({
              listing,
              cik: "0000000001",
            })),
          ]),
      priceCoverage,
    },
  );
  workspace.setView("discover");
  return {
    workspace,
    api,
    html: (androidBack?: AndroidBackAdapter) =>
      renderToStaticMarkup(
        <ManagedWorkspaceScreen
          workspace={workspace}
          {...(androidBack ? { androidBack } : {})}
        />,
      ),
  };
}
function elements(
  node: React.ReactNode,
): React.ReactElement<{ children?: React.ReactNode }>[] {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  const board =
    node.type === ManagedMarketsBoard
      ? elements(
          ManagedMarketsBoard(
            node.props as React.ComponentProps<typeof ManagedMarketsBoard>,
          ),
        )
      : [];
  return [
    node,
    ...board,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}

function watchlistEditor(node: React.ReactNode) {
  return elements(node).find(
    (entry) => entry.type === ManagedWatchlistEditor,
  ) as
    | React.ReactElement<React.ComponentProps<typeof ManagedWatchlistEditor>>
    | undefined;
}

function editorElements(node: React.ReactNode) {
  const child = watchlistEditor(node);
  if (!child) return [];
  mounted.editorStateIndex = 0;
  mounted.editorRefIndex = 0;
  mounted.editorEffects = [];
  mounted.editorDirect = true;
  try {
    const expand = (node: React.ReactNode): ReturnType<typeof elements> => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(node))
        return [];
      const rendered =
        typeof node.type === "function" &&
        node.type !== ManagedNoteEditor &&
        node.type !== ManagedWatchlistComparison &&
        node.type !== ManagedWatchlistFilings
          ? expand(
              (
                node.type as (props: {
                  children?: React.ReactNode;
                }) => React.ReactNode
              )(node.props),
            )
          : [];
      return [
        node,
        ...rendered,
        ...React.Children.toArray(node.props.children).flatMap(expand),
      ];
    };
    return expand(ManagedWatchlistEditor(child.props));
  } finally {
    mounted.editorDirect = false;
  }
}

function commitReturnFocus(
  workspace: ManagedWorkspace,
  beforeCommit?: (screen: React.ReactNode) => void,
  androidBack?: AndroidBackAdapter,
) {
  const direct = mounted.direct;
  const effectIndex = mounted.effects.length;
  mounted.direct = true;
  mounted.refIndex = 0;
  const screen = ManagedWorkspaceScreen({
    workspace,
    ...(androidBack ? { androidBack } : {}),
  });
  mounted.direct = direct;
  beforeCommit?.(screen);
  // The first Screen effect restores focus; native listener registration stays mounted.
  mounted.effects[effectIndex]!();
}

function noteReviewScreen(
  workspace: ManagedWorkspace,
  navigation?: ManagedCompanyNavigation,
) {
  const layoutStart = mounted.layoutEffects.length;
  const effectStart = mounted.effects.length;
  mounted.direct = true;
  mounted.refIndex = 0;
  const screen = ManagedWorkspaceScreen({
    workspace,
    ...(navigation ? { navigation } : {}),
  });
  mounted.direct = false;
  return {
    screen,
    commit: () => {
      for (const effect of mounted.layoutEffects.slice(layoutStart)) effect();
    },
    returnFocus: () => mounted.effects[effectStart]!(),
    bindReview: (
      reviewNote = vi.fn<ManagedWatchlistEditorHandle["reviewNote"]>(
        () => true,
      ),
    ) => {
      const ref = watchlistEditor(screen)!.props
        .ref as React.RefObject<ManagedWatchlistEditorHandle>;
      ref.current = { reviewNote, focusFirstInvalidNote: vi.fn() };
      return reviewNote;
    },
  };
}

async function comparisonNoteReviewFixture(
  kind: "price" | AnnualComparisonNoteCapture["group"],
) {
  const listings =
    kind === "price"
      ? [eodSelection.listing, payload.memberships[0]!]
      : [annualComparisonMemberships.left, annualComparisonMemberships.right];
  const initial = {
    ...payload,
    memberships: listings.map((listing, index) => ({
      ...listing,
      note: index === 0 ? "Keep first thesis" : "Fresh café 東京 📈 thesis",
    })),
  };
  const f = fixture(initial, initial.memberships);
  await f.workspace.coordinator.load();
  await f.workspace.refreshCatalog();
  f.workspace.setView("watchlist");
  if (kind === "price") {
    const priceResponse = (listingId: string) => {
      const { note: _note, ...security } = initial.memberships.find(
        (member) => member.listingId === listingId,
      )!;
      void _note;
      return { ...eodResponse(), security };
    };
    for (const row of f.workspace.watchlistPrices.getSnapshot().rows) {
      vi.mocked(f.api.eodHistory).mockResolvedValueOnce(
        priceResponse(row.listing.listingId),
      );
      await f.workspace.loadWatchlistPrice(row.handle);
    }
    const prices = f.workspace.watchlistPrices.getSnapshot();
    expect(prices.rows.every((row) => row.history.response !== null)).toBe(
      true,
    );
    let selection = createManagedWatchlistComparisonSelection();
    for (const [side, row] of [
      ["left", prices.rows[0]!],
      ["right", prices.rows[1]!],
    ] as const)
      selection = selectManagedWatchlistComparisonRow(
        selection,
        selection,
        prices,
        side,
        row,
      );
    const capture = {
      selection,
      leftShowingPrevious: false,
      rightShowingPrevious: false,
    };
    const actions = (screen: React.ReactNode) =>
      watchlistEditor(screen)!.props.comparisonNoteActions;
    return {
      ...f,
      initial,
      append: (screen: React.ReactNode) =>
        actions(screen).append(selection, prices.rows[1]!.listing),
      canAppend: (screen: React.ReactNode) =>
        actions(screen).getAction(selection, prices.rows[1]!.listing).canAppend,
      review: (
        screen: React.ReactNode,
        member: WatchlistMembership,
        current: () => boolean,
      ) => actions(screen).review(capture, member, current),
      sourceState: () =>
        f.workspace.watchlistPrices
          .getSnapshot()
          .rows.map((row) => row.history.response),
      replaceSource: async () => {
        const row = f.workspace.watchlistPrices.getSnapshot().rows[0]!;
        vi.mocked(f.api.eodHistory).mockResolvedValueOnce(
          priceResponse(row.listing.listingId),
        );
        await f.workspace.loadWatchlistPrice(row.handle);
      },
    };
  }
  const model = f.workspace.annualComparison;
  for (const [side, index] of [
    ["left", 0],
    ["right", 1],
  ] as const) {
    const member = model.getSnapshot().memberships[index]!;
    model.select(side, model.getSnapshot(), member);
    vi.mocked(f.api.annualReport).mockResolvedValueOnce(
      await annualComparisonResponse(side),
    );
    await model.load(side, member);
  }
  const state = model.getSnapshot();
  const capture: AnnualComparisonNoteCapture = {
    group: kind,
    left: {
      member: state.left.selected!,
      response: state.left.report.response!,
      selectedBasis: projectAnnualComparison(
        state.left.report.response,
        state.left.report.response === null
          ? null
          : viewOf(state.left.report.response),
      ).selectedBasis,
      showingPrevious: false,
    },
    right: {
      member: state.right.selected!,
      response: state.right.report.response!,
      selectedBasis: projectAnnualComparison(
        state.right.report.response,
        state.right.report.response === null
          ? null
          : viewOf(state.right.report.response),
      ).selectedBasis,
      showingPrevious: false,
    },
  };
  const actions = (screen: React.ReactNode) =>
    (
      elements(screen).find(
        (node) => node.type === ManagedWatchlistAnnualComparison,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedWatchlistAnnualComparison>
      >
    ).props.noteActions;
  return {
    ...f,
    initial,
    append: (screen: React.ReactNode) =>
      actions(screen).append(capture, state.right.selected),
    canAppend: (screen: React.ReactNode) =>
      actions(screen).getAction(capture, state.right.selected).canAppend,
    review: (
      screen: React.ReactNode,
      member: WatchlistMembership,
      current: () => boolean,
    ) => actions(screen).review(capture, member, current),
    sourceState: () => [
      model.getSnapshot().left.report.response,
      model.getSnapshot().right.report.response,
    ],
    replaceSource: async () => {
      vi.mocked(f.api.annualReport).mockResolvedValueOnce(
        await annualComparisonResponse("left"),
      );
      await model.load("left", model.getSnapshot().left.selected!);
    },
  };
}

function comparisonReaderFixture(workspace: ManagedWorkspace) {
  const page = { body: {}, activeElement: {} as unknown };
  vi.stubGlobal("document", page);
  const summary = {
    isConnected: true,
    getClientRects: () => [{}],
    focus: vi.fn(() => {
      page.activeElement = summary;
    }),
    scrollIntoView: vi.fn(),
  };
  const reader = {
    isConnected: true,
    getClientRects: () => [{}],
    open: false,
    querySelector: () => summary,
  };
  const field = { dataset: { managedNoteListingId: "" }, value: "" };
  const panel = {
    isConnected: true,
    getClientRects: () => [{}],
    querySelector: (selector: string) =>
      selector.startsWith("textarea") ? field : reader,
  };
  const render = () => {
    const root = noteReviewScreen(workspace);
    const nodes = editorElements(root.screen);
    const note = nodes.find(
      (node) => node.type === ManagedNoteEditor,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedNoteEditor>>;
    field.dataset.managedNoteListingId = note.props.listingId;
    field.value = note.props.note;
    mounted.editorRefs[0]!.current = panel;
    return {
      ...root,
      nodes,
      note,
      commit: () => {
        for (const effect of mounted.editorEffects) effect();
        root.commit();
      },
    };
  };
  const first = render();
  first.commit();
  const scope = first.nodes.find(
    (node) =>
      (node.props as { id?: string }).id === "managed-watchlist-search-scope",
  ) as React.ReactElement<React.ComponentProps<"select">>;
  scope.props.onChange!({
    target: { value: "notes" },
  } as React.ChangeEvent<HTMLSelectElement>);
  const search = first.nodes.find(
    (node) => (node.props as { id?: string }).id === "managed-watchlist-search",
  ) as React.ReactElement<React.ComponentProps<"input">>;
  search.props.onChange!({
    target: { value: "Keep first" },
  } as React.ChangeEvent<HTMLInputElement>);
  render().commit();
  return { render, page, summary, reader };
}

async function returnedFocusFixture() {
  const { workspace, api } = fixture();
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-one", "Keep this responsive return draft");
  const before = workspace.coordinator.getSnapshot().draft;
  const document = {
    activeElement: null as unknown,
    defaultView: null as unknown,
  };
  let rectangle = { top: 355, bottom: 399, left: 30, right: 155 };
  const navigation = {
    getBoundingClientRect: () => ({ top: 773, bottom: 844 }),
    contains: vi.fn(() => false),
  };
  const target = {
    isConnected: true,
    ownerDocument: document,
    getClientRects: vi.fn(() => [{}]),
    getBoundingClientRect: vi.fn(() => rectangle),
    closest: () => ({ querySelector: () => navigation }),
    focus: vi.fn(() => {
      document.activeElement = target;
    }),
    scrollIntoView: vi.fn(),
  };
  let frame: FrameRequestCallback | undefined;
  const view = {
    innerHeight: 844,
    innerWidth: 320,
    visualViewport: { offsetTop: 0, offsetLeft: 0, height: 844, width: 308 },
    getComputedStyle: vi.fn(() => ({ position: "fixed" })),
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 42;
    }),
    cancelAnimationFrame: vi.fn(),
  };
  document.defaultView = view;
  const nav: ManagedCompanyNavigation = {
    pending: false,
    isPending: () => false,
    invalid: false,
    returnFocus: 1,
    hasCompanyRoute: () => false,
    open: (action) => action(),
    section: vi.fn(),
    view: vi.fn<ManagedCompanyNavigation["view"]>().mockReturnValue(true),
    back: vi.fn(),
  };
  const render = (current = workspace) => {
    mounted.direct = true;
    mounted.refIndex = 0;
    const index = mounted.effects.length;
    ManagedWorkspaceScreen({ workspace: current, navigation: nav });
    return () => mounted.effects[index]!();
  };
  const commit = render();
  mounted.refs[0]!.current = target;
  mounted.refs[2]!.current = target;
  return {
    workspace,
    api,
    before,
    document,
    target,
    navigation,
    view,
    render,
    commit,
    offscreen: () => {
      rectangle = { top: 1198, bottom: 1242, left: 30, right: 155 };
    },
    covered: () => {
      rectangle = { top: 760, bottom: 804, left: 30, right: 155 };
    },
    placeAt: (top: number) => {
      rectangle = { ...rectangle, top, bottom: top + 44 };
    },
    frame: () => frame?.(0),
  };
}

async function recoveryFocusFixture(navigation?: ManagedCompanyNavigation) {
  const { workspace, api } = fixture();
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-one", "Keep this recovery draft");
  vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
  await workspace.coordinator.save();
  vi.mocked(api.load).mockResolvedValueOnce({
    version: 2,
    payload: { ...payload, memberships: [] },
  });
  await workspace.coordinator.load();

  const body = {};
  const document = { body, activeElement: body };
  const heading = {
    isConnected: true,
    ownerDocument: document,
    getClientRects: vi.fn(() => [{}]),
    focus: vi.fn(() => {
      document.activeElement = heading;
    }),
  };
  const panel = {
    isConnected: true,
    hidden: false,
    contains: (target: unknown) => target === heading,
  };
  function render(currentNavigation = navigation) {
    mounted.direct = true;
    mounted.refIndex = 0;
    mounted.layoutEffects.length = 0;
    const screen = ManagedWorkspaceScreen({
      workspace,
      ...(currentNavigation ? { navigation: currentNavigation } : {}),
    });
    mounted.direct = false;
    for (const node of elements(screen)) {
      const props = node.props as {
        id?: string;
        "aria-labelledby"?: string;
        ref?: React.RefObject<unknown>;
      };
      if (props.id === "managed-watchlist-heading" && props.ref)
        props.ref.current = heading;
      if (props["aria-labelledby"] === "managed-watchlist-heading" && props.ref)
        props.ref.current = panel;
    }
    return screen;
  }
  function choose(label: "Use saved version" | "Keep my draft") {
    const screen = render();
    const button = elements(screen).find(
      (node) => node.type === "button" && node.props.children === label,
    ) as React.ReactElement<React.ComponentProps<"button">>;
    expect(button).toBeDefined();
    const opener = { ownerDocument: document };
    document.activeElement = opener;
    return () =>
      button.props.onClick!({
        currentTarget: opener,
      } as React.MouseEvent<HTMLButtonElement>);
  }
  function commit(currentNavigation = navigation) {
    const screen = render(currentNavigation);
    for (const effect of mounted.layoutEffects) effect();
    return screen;
  }
  return { workspace, api, heading, panel, document, choose, commit };
}

async function noteFocusFixture() {
  const { workspace, api } = fixture({
    ...payload,
    memberships: [
      payload.memberships[0]!,
      {
        ...payload.memberships[0]!,
        listingId: "listing-two",
        securityId: "security-two",
        shareClassId: "class-two",
        shareClassName: "Class B",
        note: "Keep the other draft",
      },
    ],
  });
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-one", "First\ninvalid");
  workspace.note("listing-two", "Second\ninvalid");
  const fields = workspace.coordinator
    .getSnapshot()
    .draft!.memberships.map((member) => ({
      dataset: { managedNoteListingId: member.listingId },
      value: member.note,
      disabled: false,
      isConnected: true,
      getClientRects: vi.fn(() => [{}]),
      focus: vi.fn(),
    }));
  const panel = {
    isConnected: true,
    hidden: false,
    querySelectorAll: vi.fn(() => fields),
    querySelector: vi.fn(() => fields[0]),
  };
  const render = () => {
    mounted.direct = true;
    mounted.refIndex = 0;
    const screen = ManagedWorkspaceScreen({ workspace });
    mounted.direct = false;
    const nodes = elements(screen);
    const section = nodes.find(
      (node) =>
        node.type === "section" &&
        (node.props as React.ComponentProps<"section">)["aria-labelledby"] ===
          "managed-watchlist-heading",
    ) as React.ReactElement<React.ComponentProps<"section">> | undefined;
    if (section) {
      const reference = section.props.ref as { current: HTMLElement | null };
      reference.current = panel as unknown as HTMLElement;
    }
    const editor = editorElements(screen);
    const note = editor.find((entry) => entry.type === ManagedNoteEditor) as
      | React.ReactElement<React.ComponentProps<typeof ManagedNoteEditor>>
      | undefined;
    panel.querySelector.mockImplementation(() =>
      fields.find(
        (field) => field.dataset.managedNoteListingId === note?.props.listingId,
      ),
    );
    if (mounted.editorRefs[0]) mounted.editorRefs[0].current = panel;
    return nodes;
  };
  const nodes = render();
  const button = nodes.find(
    (node) =>
      node.type === "button" &&
      (node.props as React.ComponentProps<"button">).id ===
        "managed-note-validation-focus",
  ) as React.ReactElement<React.ComponentProps<"button">>;
  return {
    workspace,
    api,
    fields,
    panel,
    focus: () => {
      render();
      button.props.onClick!({} as React.MouseEvent<HTMLButtonElement>);
      render();
      for (const effect of mounted.editorEffects) effect();
    },
  };
}

describe("managed workspace screen", () => {
  function beaNoteContext(
    workspace: ManagedWorkspace,
    navigation?: ManagedCompanyNavigation,
  ) {
    mounted.direct = true;
    mounted.refIndex = 0;
    const screen = ManagedWorkspaceScreen({
      workspace,
      ...(navigation ? { navigation } : {}),
    });
    mounted.direct = false;
    const agenda = elements(screen).find(
      (node) => node.type === ManagedBeaReleaseAgenda,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedBeaReleaseAgenda>
    >;
    return agenda.props.noteContext;
  }

  it("keeps a searched BEA reference through exact-note Review outside a search and whole-draft Save/reload", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [
        { ...payload.memberships[0]!, note: "Keep first thesis" },
        {
          ...payload.memberships[0]!,
          listingId: "listing-two",
          securityId: "security-two",
          shareClassId: "class-two",
          shareClassName: "Class B",
          symbol: "TWO",
          note: "Saved second thesis",
        },
      ],
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    const page = { body: {}, activeElement: {} as unknown };
    vi.stubGlobal("document", page);
    const summary = {
      isConnected: true,
      getClientRects: () => [{}],
      focus: vi.fn(() => {
        page.activeElement = summary;
      }),
      scrollIntoView: vi.fn(),
    };
    const reader = {
      isConnected: true,
      getClientRects: () => [{}],
      open: false,
      querySelector: () => summary,
    };
    const field = { dataset: { managedNoteListingId: "" }, value: "" };
    const panel = {
      isConnected: true,
      getClientRects: () => [{}],
      querySelector: (selector: string) =>
        selector.startsWith("textarea") ? field : reader,
    };
    const render = () => {
      const root = noteReviewScreen(workspace);
      const nodes = editorElements(root.screen);
      const note = nodes.find(
        (node) => node.type === ManagedNoteEditor,
      ) as React.ReactElement<React.ComponentProps<typeof ManagedNoteEditor>>;
      field.dataset.managedNoteListingId = note.props.listingId;
      field.value = note.props.note;
      mounted.editorRefs[0]!.current = panel;
      return {
        nodes,
        note,
        commit: () => {
          for (const effect of mounted.editorEffects) effect();
          root.commit();
        },
      };
    };
    const initial = render();
    initial.commit();
    const scope = initial.nodes.find(
      (node) =>
        (node.props as { id?: string }).id === "managed-watchlist-search-scope",
    ) as React.ReactElement<React.ComponentProps<"select">>;
    scope.props.onChange!({
      target: { value: "notes" },
    } as React.ChangeEvent<HTMLSelectElement>);
    const search = initial.nodes.find(
      (node) =>
        (node.props as { id?: string }).id === "managed-watchlist-search",
    ) as React.ReactElement<React.ComponentProps<"input">>;
    search.props.onChange!({
      target: { value: "Keep first" },
    } as React.ChangeEvent<HTMLInputElement>);
    render().commit();
    workspace.note("listing-two", "  Fresh Cafe\u0301 東京 🧭 thesis");
    workspace.move("listing-two", -1);
    workspace.setView("markets");
    const priorAgenda = parseManagedEconomicCalendar({
      ...economicCalendarFixture(),
      fetchedAt: "2026-10-20T17:59:00.000Z",
      window: {
        fromInclusive: "2026-10-20T17:59:00.000Z",
        toExclusive: "2026-11-19T17:59:00.000Z",
      },
      events: [economicCalendarFixture().events[0]!],
    })!;
    vi.mocked(api.economicCalendar).mockResolvedValueOnce(priorAgenda);
    await workspace.agenda.load();
    vi.mocked(api.economicCalendar).mockResolvedValueOnce(
      economicCalendarFixture(),
    );
    await workspace.agenda.load();
    const response = workspace.agenda.getSnapshot().agenda!;
    const pair = workspace.agenda.getSnapshot().refreshComparison!;
    expect(pair.previous).toBe(priorAgenda);
    expect(pair.current).toBe(response);
    expect(pair.addedEvents[0]).toBe(response.events[1]);
    const beforeSearch = workspace.coordinator.getSnapshot().draft!;
    const updates = projectManagedBeaUpdatesView(
      projectBeaReleaseView(response, "2026-11-02", "  nOvEmBeR   release  "),
      pair,
      "new",
    );
    const view = updates.view;
    expect(updates).toMatchObject({ refreshView: "new", available: true });
    expect(view.visibleCount).toBe(1);
    expect(view.groups).toHaveLength(2);
    expect(view.visibleGroups[0]!.events).toEqual([response.events[1]!]);
    const selectedEvent = view.visibleGroups[0]!.events[0]!;
    expect(selectedEvent).toBe(response.events[1]);
    expect(response.events.indexOf(selectedEvent)).toBe(1);
    expect(workspace.coordinator.getSnapshot().draft).toBe(beforeSearch);
    expect(api.economicCalendar).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
    const capture = {
      response,
      event: selectedEvent,
      showingPrevious: false,
    };
    const before = workspace.coordinator.getSnapshot().draft!;
    const context = beaNoteContext(workspace);
    expect(context.members).toBe(before.memberships);
    expect(context.active && context.editable).toBe(true);
    expect(context.actions.getAction(capture, null).canAppend).toBe(false);
    expect(
      context.actions.append(capture, before.memberships[0]!).appended,
    ).toBe(true);
    const expected =
      "  Fresh Cafe\u0301 東京 🧭 thesis Scheduled BEA release: Invented November release. Scheduled time: Mon, Nov 2, 2026, 8:30 AM EST (America/New_York); 2026-11-02T13:30:00.000Z (UTC). " +
      `Source: U.S. Bureau of Economic Analysis; official schedule ${PERSONAL_BEA_CALENDAR_SOURCE.scheduleUrl}. ` +
      "Original agenda retrieved at: 2026-10-20T18:00:00.000Z (UTC). Loaded window: 2026-10-20T18:00:00.000Z inclusive to 2026-11-19T18:00:00.000Z exclusive (UTC). Only schedule metadata was loaded; forecasts and released values were not supplied. Scheduled times may change; this reference does not confirm a release or company relevance. Evidence dates are unchanged; this action does not refresh sources.";
    const after = workspace.coordinator.getSnapshot().draft!;
    expect(after).toEqual({
      ...before,
      memberships: [
        { ...before.memberships[0]!, note: expected },
        before.memberships[1]!,
      ],
    });
    context.onReview(after.memberships[0]!);
    expect(workspace.getSnapshot().view).toBe("watchlist");
    render().commit();
    const selected = render();
    selected.commit();
    expect(selected.note.props).toMatchObject({
      listingId: "listing-two",
      note: expected,
    });
    expect(
      selected.nodes.find(
        (node) =>
          (node.props as { id?: string }).id === "managed-watchlist-search",
      )?.props,
    ).toMatchObject({ value: "Keep first" });
    expect(
      selected.nodes.find(
        (node) =>
          (node.props as { id?: string }).id ===
          "managed-watchlist-search-scope",
      )?.props,
    ).toMatchObject({ value: "notes" });
    expect(reader.open).toBe(true);
    expect(summary.focus).toHaveBeenCalledOnce();
    expect(summary.scrollIntoView).toHaveBeenCalledOnce();
    expect(page.activeElement).toBe(summary);
    expect(workspace.coordinator.getSnapshot().draft).toBe(after);
    expect(api.save).not.toHaveBeenCalled();
    vi.mocked(api.save).mockImplementationOnce((command) =>
      Promise.resolve({
        version: 2,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.save();
    const saved = vi.mocked(api.save).mock.calls[0]![0].payload;
    expect(saved).toEqual({
      ...after,
      memberships: [
        { ...after.memberships[0]!, note: expected.trim().normalize("NFC") },
        after.memberships[1]!,
      ],
    });
    vi.mocked(api.load).mockResolvedValueOnce({ version: 2, payload: saved });
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      draft: saved,
      baseVersion: 2,
      dirty: false,
    });
    expect(workspace.agenda.getSnapshot().agenda).toBe(response);
    expect(workspace.agenda.getSnapshot().refreshComparison).toBe(pair);
    expect(api.economicCalendar).toHaveBeenCalledTimes(2);
    expect(api.load).toHaveBeenCalledTimes(2);
    expect(api.save).toHaveBeenCalledOnce();
    for (const read of [
      api.eodHistory,
      api.annualReport,
      api.recentFilings,
      api.monetaryAnnouncements,
    ])
      expect(read).not.toHaveBeenCalled();
  });

  it("fences BEA note callbacks on hidden or invalid Markets routes", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("markets");
    vi.mocked(api.economicCalendar).mockResolvedValueOnce(
      economicCalendarFixture(),
    );
    await workspace.agenda.load();
    const response = workspace.agenda.getSnapshot().agenda!;
    const capture = {
      response,
      event: response.events[0]!,
      showingPrevious: false,
    };
    const draft = workspace.coordinator.getSnapshot().draft!;
    let route = false;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => route,
      open: (action) => action(),
      section: vi.fn(),
      back: vi.fn(),
      view: vi.fn(() => false),
    };
    const context = beaNoteContext(workspace, navigation);
    route = true;
    expect(
      context.actions.getAction(capture, draft.memberships[0]!).canAppend,
    ).toBe(false);
    expect(
      context.actions.append(capture, draft.memberships[0]!).appended,
    ).toBe(false);
    context.onReview(draft.memberships[0]!);
    expect(navigation.view).not.toHaveBeenCalled();
    route = false;
    const invalid = beaNoteContext(workspace, { ...navigation, invalid: true });
    expect(invalid.active).toBe(false);
    expect(
      invalid.actions.append(capture, draft.memberships[0]!).appended,
    ).toBe(false);
    invalid.onReview(draft.memberships[0]!);
    expect(navigation.view).not.toHaveBeenCalled();
    workspace.openWatchlistAnnual(draft.memberships[0]!);
    expect(beaNoteContext(workspace).active).toBe(false);
    expect(
      context.actions.append(capture, draft.memberships[0]!).appended,
    ).toBe(false);
    context.onReview(draft.memberships[0]!);
    expect(navigation.view).not.toHaveBeenCalled();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
  });

  it("blocks BEA Review during a pending request and discards callbacks after retirement", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("markets");
    vi.mocked(api.economicCalendar).mockResolvedValueOnce(
      economicCalendarFixture(),
    );
    await workspace.agenda.load();
    const response = workspace.agenda.getSnapshot().agenda!;
    const capture = {
      response,
      event: response.events[0]!,
      showingPrevious: false,
    };
    const destination =
      workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    const context = beaNoteContext(workspace);
    const pending = deferred<ReturnType<typeof economicCalendarFixture>>();
    vi.mocked(api.economicCalendar).mockReturnValueOnce(pending.promise);
    const load = workspace.agenda.load();
    context.onReview(destination);
    expect(workspace.getSnapshot().view).toBe("markets");
    expect(context.actions.append(capture, destination).appended).toBe(false);
    workspace.agenda.cancel();
    expect(
      context.actions.getAction(
        { ...capture, showingPrevious: true },
        destination,
      ).canAppend,
    ).toBe(true);
    workspace.coordinator.retire();
    expect(context.actions.getAction(capture, destination).canAppend).toBe(
      false,
    );
    expect(context.actions.append(capture, destination).appended).toBe(false);
    context.onReview(destination);
    pending.resolve(economicCalendarFixture());
    await load;
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(workspace.agenda.getSnapshot().agenda).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  function fedNoteContext(
    workspace: ManagedWorkspace,
    navigation?: ManagedCompanyNavigation,
  ) {
    mounted.direct = true;
    mounted.refIndex = 0;
    const screen = ManagedWorkspaceScreen({
      workspace,
      ...(navigation ? { navigation } : {}),
    });
    mounted.direct = false;
    const fed = elements(screen).find(
      (node) => node.type === ManagedFedAnnouncements,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedFedAnnouncements>
    >;
    return fed.props.noteContext;
  }

  it("adds a newly observed current Fed reference and preserves the complete draft through Review, Save and reload", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [
        payload.memberships[0]!,
        {
          ...payload.memberships[0]!,
          listingId: "listing-two",
          securityId: "security-two",
          shareClassId: "class-two",
          shareClassName: "Class B",
          note: "Keep this other thesis",
        },
      ],
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("markets");
    const current = fedAnnouncementsFixture();
    const previous = {
      ...current,
      fetchedAt: "2026-10-19T19:00:00.000Z",
      availableItemCount: 1,
      items: [current.items[0]!],
    };
    vi.mocked(api.monetaryAnnouncements)
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce(current);
    await workspace.announcements.load();
    expect(workspace.announcements.getSnapshot().refreshComparison).toBeNull();
    await workspace.announcements.load();
    const comparison = workspace.announcements.getSnapshot().refreshComparison!;
    expect(comparison.previous).toBe(previous);
    expect(comparison.current).toBe(current);
    expect(comparison.newUrls).toEqual([current.items[1]!.url]);
    workspace.note("listing-two", "  Latest Café 東京 😀 thesis");
    workspace.move("listing-two", -1);
    const before = workspace.coordinator.getSnapshot().draft!;
    const response = workspace.announcements.getSnapshot().announcements!;
    const readingView = projectManagedFedUpdatesView(
      projectFedAnnouncementView(response, "without a publication"),
      comparison,
      "new",
    ).view;
    expect(readingView.response).toBe(response);
    expect(readingView.visibleItems).toEqual([response.items[1]]);
    expect(readingView.visibleItems[0]).toBe(response.items[1]);
    const capture = {
      response,
      item: readingView.visibleItems[0]!,
      showingPrevious: false,
    };
    const context = fedNoteContext(workspace);
    expect(context.active).toBe(true);
    expect(context.editable).toBe(true);
    expect(context.members).toBe(before.memberships);
    expect(context.actions.getAction(capture, null).canAppend).toBe(false);
    expect(context.actions.append(capture, context.members[0]!).appended).toBe(
      true,
    );
    const after = workspace.coordinator.getSnapshot().draft!;
    expect(after.memberships[0]!.note).toContain(
      "  Latest Café 東京 😀 thesis Observed Federal Reserve announcement: Invented announcement without a publication time.",
    );
    expect(after.memberships[0]!.note).toContain(
      "Source publication time: unknown.",
    );
    expect(after.memberships[0]!.note).toContain(
      "Original feed retrieved at: 2026-10-20T18:00:00.000Z (UTC).",
    );
    expect(after.memberships[1]).toEqual(before.memberships[1]);
    expect(after.memberships.map((member) => member.listingId)).toEqual(
      before.memberships.map((member) => member.listingId),
    );
    expect(api.save).not.toHaveBeenCalled();
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    context.onReview(after.memberships[0]!);
    expect(workspace.getSnapshot().view).toBe("watchlist");
    const returned = noteReviewScreen(workspace);
    const reviewNote = returned.bindReview();
    returned.commit();
    expect(reviewNote).toHaveBeenCalledOnce();
    expect(reviewNote.mock.calls[0]![0].member).toBe(after.memberships[0]);
    expect(reviewNote.mock.calls[0]![0].isCurrent()).toBe(true);
    expect(focus).not.toHaveBeenCalled();
    expect(workspace.coordinator.getSnapshot().draft).toBe(after);
    expect(api.save).not.toHaveBeenCalled();
    vi.mocked(api.save).mockImplementationOnce((command) =>
      Promise.resolve({
        version: 2,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.save();
    const savedPayload = vi.mocked(api.save).mock.calls[0]![0].payload;
    expect(savedPayload.memberships).toEqual(
      after.memberships.map((member) => ({
        ...member,
        note: member.note.trim().normalize("NFC"),
      })),
    );
    vi.mocked(api.load).mockResolvedValueOnce({
      version: 2,
      payload: savedPayload,
    });
    await workspace.coordinator.load();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(savedPayload);
    expect(workspace.coordinator.getSnapshot().baseVersion).toBe(2);
    expect(workspace.coordinator.getSnapshot().dirty).toBe(false);
    expect(workspace.announcements.getSnapshot().refreshComparison).toBe(
      comparison,
    );
    expect(api.save).toHaveBeenCalledOnce();
    expect(api.load).toHaveBeenCalledTimes(2);
    expect(api.monetaryAnnouncements).toHaveBeenCalledTimes(2);
    expect(api.economicCalendar).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.recentFilings).not.toHaveBeenCalled();
  });

  it("refuses Fed note and Review callbacks during pending or invalid routes and hidden company research", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("markets");
    vi.mocked(api.monetaryAnnouncements).mockResolvedValueOnce(
      fedAnnouncementsFixture(),
    );
    await workspace.announcements.load();
    const response = workspace.announcements.getSnapshot().announcements!;
    const capture = {
      response,
      item: response.items[0]!,
      showingPrevious: false,
    };
    const draft = workspace.coordinator.getSnapshot().draft!;
    let route = false;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => route,
      open: (action) => action(),
      section: vi.fn(),
      back: vi.fn(),
      view: vi.fn(() => false),
    };
    const context = fedNoteContext(workspace, navigation);
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    route = true;
    expect(
      context.actions.getAction(capture, draft.memberships[0]!).canAppend,
    ).toBe(false);
    expect(
      context.actions.append(capture, draft.memberships[0]!).appended,
    ).toBe(false);
    context.onReview(draft.memberships[0]!);
    expect(navigation.view).not.toHaveBeenCalled();
    route = false;
    const invalid = fedNoteContext(workspace, { ...navigation, invalid: true });
    expect(invalid.active).toBe(false);
    expect(
      invalid.actions.append(capture, draft.memberships[0]!).appended,
    ).toBe(false);
    invalid.onReview(draft.memberships[0]!);
    expect(navigation.view).not.toHaveBeenCalled();
    context.onReview(draft.memberships[0]!);
    expect(navigation.view).toHaveBeenCalledExactlyOnceWith("watchlist");
    expect(focus).not.toHaveBeenCalled();
    workspace.openWatchlistAnnual(draft.memberships[0]!);
    expect(fedNoteContext(workspace).active).toBe(false);
    expect(
      context.actions.append(capture, draft.memberships[0]!).appended,
    ).toBe(false);
    context.onReview(draft.memberships[0]!);
    expect(navigation.view).toHaveBeenCalledOnce();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
  });

  it("blocks Review while a feed request is pending and fences all note callbacks on retirement", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("markets");
    vi.mocked(api.monetaryAnnouncements).mockResolvedValueOnce(
      fedAnnouncementsFixture(),
    );
    await workspace.announcements.load();
    const response = workspace.announcements.getSnapshot().announcements!;
    const capture = {
      response,
      item: response.items[0]!,
      showingPrevious: false,
    };
    const destination =
      workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    const context = fedNoteContext(workspace);
    const pending = deferred<ReturnType<typeof fedAnnouncementsFixture>>();
    vi.mocked(api.monetaryAnnouncements).mockReturnValueOnce(pending.promise);
    const load = workspace.announcements.load();
    context.onReview(destination);
    expect(workspace.getSnapshot().view).toBe("markets");
    expect(context.actions.append(capture, destination).appended).toBe(false);
    workspace.announcements.cancel();
    expect(
      context.actions.getAction(
        { ...capture, showingPrevious: true },
        destination,
      ).canAppend,
    ).toBe(true);
    workspace.coordinator.retire();
    expect(context.actions.getAction(capture, destination).canAppend).toBe(
      false,
    );
    expect(context.actions.append(capture, destination).appended).toBe(false);
    context.onReview(destination);
    pending.resolve(fedAnnouncementsFixture());
    await load;
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(workspace.announcements.getSnapshot().announcements).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  function companyReview(screen: React.ReactNode) {
    const company = elements(screen).find(
      (node) => node.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    return company.props.onReview;
  }

  it.each(["current", "selection-retires", "user-focus"] as const)(
    "composes exact-note Review with the real editor outside a retained search: %s",
    async (mode) => {
      const raw = `  e\u0301 東京 🧭\n${"full raw ".repeat(260)}  `;
      const { workspace, api } = fixture({
        ...payload,
        memberships: [
          { ...payload.memberships[0]!, note: "Keep first thesis" },
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            securityId: "security-two",
            shareClassId: "class-two",
            symbol: "TWO",
            note: raw,
          },
        ],
      });
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      const draft = workspace.coordinator.getSnapshot().draft!;
      const origin = {};
      const page = { body: {}, activeElement: origin as unknown };
      vi.stubGlobal("document", page);
      const summary = {
        isConnected: true,
        getClientRects: () => [{}],
        focus: vi.fn(() => {
          page.activeElement = summary;
        }),
        scrollIntoView: vi.fn(),
      };
      const reader = {
        isConnected: true,
        getClientRects: () => [{}],
        open: false,
        querySelector: () => summary,
      };
      const field = { dataset: { managedNoteListingId: "" }, value: "" };
      const panel = {
        isConnected: true,
        getClientRects: () => [{}],
        querySelector: (selector: string) =>
          selector.startsWith("textarea") ? field : reader,
      };
      const render = () => {
        const root = noteReviewScreen(workspace);
        const nodes = editorElements(root.screen);
        const note = nodes.find(
          (node) => node.type === ManagedNoteEditor,
        ) as React.ReactElement<React.ComponentProps<typeof ManagedNoteEditor>>;
        field.dataset.managedNoteListingId = note.props.listingId;
        field.value = note.props.note;
        mounted.editorRefs[0]!.current = panel;
        return {
          nodes,
          note,
          commit: () => {
            for (const effect of mounted.editorEffects) effect();
            root.commit();
          },
        };
      };
      const first = render();
      first.commit();
      const scope = first.nodes.find(
        (node) =>
          (node.props as { id?: string }).id ===
          "managed-watchlist-search-scope",
      ) as React.ReactElement<React.ComponentProps<"select">>;
      scope.props.onChange!({
        target: { value: "notes" },
      } as React.ChangeEvent<HTMLSelectElement>);
      const search = first.nodes.find(
        (node) =>
          (node.props as { id?: string }).id === "managed-watchlist-search",
      ) as React.ReactElement<React.ComponentProps<"input">>;
      search.props.onChange!({
        target: { value: "Keep first" },
      } as React.ChangeEvent<HTMLInputElement>);
      render().commit();
      workspace.openWatchlistAnnual(draft.memberships[1]!);
      companyReview(noteReviewScreen(workspace).screen)();
      const returned = render();
      returned.commit();
      if (mode === "selection-retires") {
        const original = workspace.selectWatchlistFilingsMember.bind(workspace);
        vi.spyOn(workspace, "selectWatchlistFilingsMember").mockImplementation(
          (member) => {
            original(member);
            if (member === draft.memberships[1]) workspace.coordinator.retire();
          },
        );
      }
      if (mode === "user-focus") page.activeElement = {};
      const selected = render();
      selected.commit();
      expect(selected.note.props).toMatchObject({
        listingId: "listing-two",
        note: raw,
        id: "managed-note-1",
      });
      expect(
        selected.nodes.find(
          (node) =>
            (node.props as { id?: string }).id === "managed-watchlist-search",
        )?.props,
      ).toMatchObject({ value: "Keep first" });
      expect(
        selected.nodes.find(
          (node) =>
            (node.props as { id?: string }).id ===
            "managed-watchlist-search-scope",
        )?.props,
      ).toMatchObject({ value: "notes" });
      expect(
        selected.nodes.some(
          (node) =>
            React.Children.toArray(node.props.children)
              .filter((child) => typeof child === "string")
              .join("") === "Selected TWO is outside this search.",
        ),
      ).toBe(true);
      expect(reader.open).toBe(mode === "current");
      expect(summary.focus).toHaveBeenCalledTimes(mode === "current" ? 1 : 0);
      expect(summary.scrollIntoView).toHaveBeenCalledTimes(
        mode === "current" ? 1 : 0,
      );
      if (mode === "current") {
        expect(page.activeElement).toBe(summary);
        expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      }
      for (const read of [
        api.annualReport,
        api.recentFilings,
        api.eodHistory,
        api.monetaryAnnouncements,
        api.economicCalendar,
        api.save,
      ])
        expect(read).not.toHaveBeenCalled();
    },
  );

  it("waits for the company URL return, consumes its focus once, and preserves later Back focus", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    let route = true;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => route,
      open: (action) => action(),
      section: vi.fn(),
      back: vi.fn(),
      view: vi.fn<ManagedCompanyNavigation["view"]>((view) => {
        workspace.setView(view);
        return true;
      }),
    };
    const first = noteReviewScreen(workspace, navigation);
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    const target = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    companyReview(first.screen)();
    const pending = noteReviewScreen(workspace, navigation);
    const reviewNote = pending.bindReview();
    pending.commit();
    expect(reviewNote).not.toHaveBeenCalled();
    route = false;
    const beforeSignal = noteReviewScreen(workspace, navigation);
    beforeSignal.commit();
    expect(reviewNote).not.toHaveBeenCalled();
    navigation.returnFocus = 1;
    const returned = noteReviewScreen(workspace, navigation);
    returned.commit();
    returned.returnFocus();
    expect(reviewNote).toHaveBeenCalledOnce();
    expect(reviewNote.mock.calls[0]![0].member).toBe(target);
    expect(reviewNote.mock.calls[0]![0].isCurrent()).toBe(true);
    expect(focus).not.toHaveBeenCalled();
    const repeated = noteReviewScreen(workspace, navigation);
    repeated.commit();
    repeated.returnFocus();
    expect(reviewNote).toHaveBeenCalledOnce();
    expect(focus).not.toHaveBeenCalled();
    navigation.returnFocus = 2;
    const ordinary = noteReviewScreen(workspace, navigation);
    ordinary.commit();
    ordinary.returnFocus();
    expect(focus).toHaveBeenCalledOnce();
    expect(reviewNote.mock.calls[0]![0].isCurrent()).toBe(false);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it.each(["invalid", "uncertain"] as const)(
    "reviews a current company note when it is %s",
    async (mode) => {
      const { workspace, api } = fixture();
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
      workspace.note(
        "listing-one",
        mode === "invalid"
          ? `  e\u0301 東京 🧭\n${"raw ".repeat(510)}  `
          : "Keep the uncertain draft",
      );
      if (mode === "uncertain") {
        vi.mocked(api.save).mockRejectedValueOnce(
          new TrialApiError("commit_unknown"),
        );
        await workspace.coordinator.save();
        expect(workspace.canEdit()).toBe(false);
      }
      const draft = workspace.coordinator.getSnapshot().draft!;
      companyReview(noteReviewScreen(workspace).screen)();
      const returned = noteReviewScreen(workspace);
      const reviewNote = returned.bindReview();
      returned.commit();
      expect(reviewNote).toHaveBeenCalledOnce();
      expect(reviewNote.mock.calls[0]![0].member).toBe(draft.memberships[0]);
      expect(reviewNote.mock.calls[0]![0].isCurrent()).toBe(true);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(api.save).toHaveBeenCalledTimes(mode === "uncertain" ? 1 : 0);
      expect(api.annualReport).not.toHaveBeenCalled();
    },
  );

  it("does not restore navigation focus when its pending company Review becomes stale before the return signal", async () => {
    const { workspace } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    let route = true;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => route,
      open: (action) => action(),
      section: vi.fn(),
      back: vi.fn(),
      view: (view) => {
        workspace.setView(view);
        return true;
      },
    };
    const first = noteReviewScreen(workspace, navigation);
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    companyReview(first.screen)();
    workspace.note("listing-one", "User edits before the return commits");
    const movedFocus = {};
    vi.stubGlobal("document", { activeElement: movedFocus, body: {} });
    const cancelled = noteReviewScreen(workspace, navigation);
    const reviewNote = cancelled.bindReview();
    cancelled.commit();
    route = false;
    navigation.returnFocus = 1;
    const returned = noteReviewScreen(workspace, navigation);
    returned.commit();
    returned.returnFocus();
    expect(reviewNote).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(movedFocus);
    navigation.returnFocus = 2;
    const laterBack = noteReviewScreen(workspace, navigation);
    laterBack.commit();
    laterBack.returnFocus();
    expect(focus).toHaveBeenCalledOnce();
  });

  it.each(["draft", "retired", "view", "route", "catalog"] as const)(
    "cancels a queued Review after %s changes",
    async (change) => {
      const { workspace, api } = fixture();
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("markets");
      const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      const navigation: ManagedCompanyNavigation = {
        pending: false,
        isPending: () => false,
        invalid: false,
        returnFocus: 0,
        hasCompanyRoute: () => false,
        open: (action) => action(),
        section: vi.fn(),
        back: vi.fn(),
        view: (view) => {
          workspace.setView(view);
          return true;
        },
      };
      fedNoteContext(workspace, navigation).onReview(member);
      if (change === "draft")
        workspace.note(
          member.listingId,
          "Replacement must not receive old focus",
        );
      if (change === "retired") workspace.coordinator.retire();
      if (change === "view") workspace.setView("discover");
      if (change === "route") navigation.invalid = true;
      if (change === "catalog") {
        vi.mocked(api.status).mockResolvedValueOnce({
          snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
        });
        await workspace.refreshCatalog();
      }
      const returned = noteReviewScreen(workspace, navigation);
      const reviewNote = vi.fn<ManagedWatchlistEditorHandle["reviewNote"]>(
        () => true,
      );
      mounted.refs[5]!.current = { reviewNote, focusFirstInvalidNote: vi.fn() };
      returned.commit();
      expect(reviewNote).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it("rechecks the draft after view navigation and never hands off a replaced member", async () => {
    const { workspace } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("markets");
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => false,
      open: (action) => action(),
      section: vi.fn(),
      back: vi.fn(),
      view: (view) => {
        workspace.setView(view);
        workspace.note(member.listingId, "Changed during navigation");
        return true;
      },
    };
    fedNoteContext(workspace, navigation).onReview(member);
    const returned = noteReviewScreen(workspace, navigation);
    const reviewNote = returned.bindReview();
    returned.commit();
    expect(reviewNote).not.toHaveBeenCalled();
  });

  it("explains a company without a current note without handing another note to Review", async () => {
    const { workspace, api } = fixture();
    const listing = {
      ...payload.memberships[0]!,
      listingId: "listing-other",
      securityId: "security-other",
      cik: "0000000001",
      matchKind: "current_symbol_exact" as const,
      matchedValue: "DEMO",
    };
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [listing],
      totalMatches: 1,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    });
    await workspace.coordinator.load();
    await workspace.search();
    workspace.openDiscoveryAnnual(listing);
    const first = noteReviewScreen(workspace);
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    companyReview(first.screen)();
    const returned = noteReviewScreen(workspace);
    const reviewNote = returned.bindReview();
    returned.commit();
    expect(
      elements(returned.screen).some(
        (node) =>
          node.props.children ===
          "No current note is available for this company.",
      ),
    ).toBe(true);
    expect(reviewNote).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledOnce();
    expect(workspace.getSnapshot().view).toBe("watchlist");
    expect(api.save).not.toHaveBeenCalled();
  });

  function marketsNavigation(
    workspace: ManagedWorkspace,
    navigation?: ManagedCompanyNavigation,
  ) {
    mounted.direct = true;
    mounted.refIndex = 0;
    const screen = ManagedWorkspaceScreen({
      workspace,
      ...(navigation ? { navigation } : {}),
    });
    mounted.direct = false;
    const nodes = elements(screen);
    const board = nodes.find(
      (node) => node.type === ManagedMarkets,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedMarkets>>;
    const nav = board.props.sectionNavigation as React.ReactElement<
      React.ComponentProps<typeof ManagedMarketsNavigation>
    >;
    expect(nav.type).toBe(ManagedMarketsNavigation);
    const agenda = nodes.find(
      (node) => node.type === ManagedBeaReleaseAgenda,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedBeaReleaseAgenda>
    >;
    const fed = nodes.find(
      (node) => node.type === ManagedFedAnnouncements,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedFedAnnouncements>
    >;
    expect(nav.props.targets.board.ref).toBe(board.props.headingRef);
    expect(nav.props.targets.calendar.ref).toBe(agenda.props.headingRef);
    expect(nav.props.targets.announcements.ref).toBe(fed.props.headingRef);
    const day = nodes.find(
      (node) => node.type === ManagedMarketsDayView,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedMarketsDayView>>;
    expect(day.props.agenda).toBe(workspace.agenda);
    expect(day.props.announcements).toBe(workspace.announcements);
    expect(day.props.navigation.targets).toBe(nav.props.targets);
    expect(day.props.navigation.isCurrent).toBe(nav.props.isCurrent);
    expect(day.props.headingRef).toBe(nav.props.targets.day.ref);
    return nav.props;
  }

  it("keeps Markets jumps current through explicit loads and pending refresh without changing data or draft", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "Unsaved Markets note: Café 😀");
    workspace.setView("markets");
    const draft = workspace.coordinator.getSnapshot().draft;
    const nav = marketsNavigation(workspace);
    expect(nav.isCurrent()).toBe(true);
    expect(api.economicCalendar).not.toHaveBeenCalled();
    expect(api.monetaryAnnouncements).not.toHaveBeenCalled();
    vi.mocked(api.economicCalendar).mockResolvedValue(
      economicCalendarFixture(),
    );
    vi.mocked(api.monetaryAnnouncements).mockResolvedValue(
      fedAnnouncementsFixture(),
    );
    await workspace.agenda.load();
    await workspace.announcements.load();
    const agenda = workspace.agenda.getSnapshot().agenda;
    const announcements = workspace.announcements.getSnapshot().announcements;
    let release!: (value: ReturnType<typeof economicCalendarFixture>) => void;
    vi.mocked(api.economicCalendar).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = workspace.agenda.load();
    expect(workspace.agenda.getSnapshot().busy).toBe(true);
    expect(nav.isCurrent()).toBe(true);
    expect(marketsNavigation(workspace).isCurrent()).toBe(true);
    expect(workspace.agenda.getSnapshot().agenda).toBe(agenda);
    expect(workspace.announcements.getSnapshot().announcements).toBe(
      announcements,
    );
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    workspace.agenda.cancel();
    release(economicCalendarFixture());
    await pending;
    expect(nav.isCurrent()).toBe(true);
    expect(workspace.agenda.getSnapshot().agenda).toBe(agenda);
    expect(api.economicCalendar).toHaveBeenCalledTimes(2);
    expect(api.monetaryAnnouncements).toHaveBeenCalledOnce();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("refuses a previous Markets jump as soon as navigation or company research starts", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("markets");
    let pendingRoute = false;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      invalid: false,
      returnFocus: 1,
      hasCompanyRoute: () => pendingRoute,
      open: (action) => action(),
      section: vi.fn(),
      view: vi.fn(() => true),
      back: vi.fn(),
    };
    const nav = marketsNavigation(workspace, navigation);
    expect(nav.isCurrent()).toBe(true);
    pendingRoute = true;
    expect(nav.isCurrent()).toBe(false);
    pendingRoute = false;
    expect(
      marketsNavigation(workspace, {
        ...navigation,
        invalid: true,
      }).isCurrent(),
    ).toBe(false);
    workspace.setView("watchlist");
    expect(nav.isCurrent()).toBe(false);
    workspace.setView("markets");
    expect(nav.isCurrent()).toBe(true);
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    expect(workspace.getSnapshot().research).not.toBeNull();
    expect(nav.isCurrent()).toBe(false);
    expect(api.economicCalendar).not.toHaveBeenCalled();
    expect(api.monetaryAnnouncements).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("refuses the previous Markets jump immediately after shared retirement", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    workspace.setView("markets");
    const nav = marketsNavigation(workspace);
    expect(nav.isCurrent()).toBe(true);
    workspace.coordinator.retire();
    expect(nav.isCurrent()).toBe(false);
    expect(api.economicCalendar).not.toHaveBeenCalled();
    expect(api.monetaryAnnouncements).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("keeps explicitly loaded Fed metadata separate from the calendar and clears it on retirement", async () => {
    const { workspace, api, html } = fixture();
    workspace.setView("markets");
    const read = vi
      .mocked(api.monetaryAnnouncements)
      .mockResolvedValue(fedAnnouncementsFixture());
    expect(html()).toContain("Load announcements");
    expect(read).not.toHaveBeenCalled();
    await workspace.announcements.load();
    const loaded = html();
    expect(loaded).toContain("Invented monetary policy announcement");
    expect(loaded).toContain("Unknown publication time");
    expect(loaded).toContain('dateTime="2026-10-20T18:00:00.000Z"');
    expect(loaded).toContain('dateTime="2026-10-19T18:00:00.000Z"');
    expect(loaded).not.toContain("local access");
    expect(api.economicCalendar).not.toHaveBeenCalled();
    expect(loaded).not.toContain("Compared loaded feeds");
    const previous = workspace.announcements.getSnapshot().announcements!;
    const current = {
      ...fedAnnouncementsFixture(),
      fetchedAt: "2026-10-21T18:00:00.000Z",
    };
    read.mockResolvedValueOnce(current);
    await workspace.announcements.load();
    const comparison = workspace.announcements.getSnapshot().refreshComparison!;
    expect(comparison.previous).toBe(previous);
    expect(comparison.current).toBe(current);
    expect(comparison.newUrls).toEqual([]);
    expect(html()).toContain("Compared loaded feeds");
    expect(html()).toContain(
      "Newly observed in this refresh: 0 of 2 links in the loaded feed.",
    );
    read.mockRejectedValueOnce(new TrialApiError("invalid_response"));
    await workspace.announcements.load();
    expect(html()).toContain("Previous announcements");
    expect(html()).toContain("could not be verified");
    expect(workspace.announcements.getSnapshot().refreshComparison).toBe(
      comparison,
    );
    expect(html()).toContain('dateTime="2026-10-20T18:00:00.000Z"');
    expect(html()).toContain('dateTime="2026-10-21T18:00:00.000Z"');
    workspace.setView("watchlist");
    expect(html()).not.toContain("fed-announcements");
    workspace.setView("markets");
    expect(html()).toContain("Invented monetary policy announcement");
    expect(read).toHaveBeenCalledTimes(3);
    expect(workspace.announcements.getSnapshot().refreshComparison).toBe(
      comparison,
    );
    workspace.coordinator.retire();
    expect(html()).not.toContain("fed-announcements");
    expect(workspace.announcements.getSnapshot().announcements).toBeNull();
    expect(workspace.announcements.getSnapshot().refreshComparison).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });
  it("shows the explicitly loaded dated agenda in Markets and hides it after shared retirement", async () => {
    const { workspace, api, html } = fixture();
    workspace.setView("markets");
    const read = vi
      .mocked(api.economicCalendar)
      .mockResolvedValue(economicCalendarFixture());
    expect(html()).toContain("Load agenda");
    expect(read).not.toHaveBeenCalled();
    await workspace.agenda.load();
    const loaded = html();
    expect(loaded).toContain("Refresh agenda");
    expect(loaded).toContain('id="managed-bea-release-date"');
    expect(loaded).toContain('value="2026-10-30"');
    expect(loaded).toContain('value="2026-11-02"');
    expect(loaded).toContain("2 of 2 loaded BEA releases.");
    expect(loaded).toContain("Invented October release");
    expect(loaded).toContain("8:30 AM EDT");
    expect(loaded).toContain("8:30 AM EST");
    expect(loaded).toContain('dateTime="2026-10-20T18:00:00.000Z"');
    expect(loaded).not.toContain("local access");
    read.mockRejectedValueOnce(new TrialApiError("invalid_response"));
    await workspace.agenda.load();
    const previous = html();
    expect(previous).toContain("Previous agenda");
    expect(previous).toContain("could not be verified");
    expect(previous).toContain("Invented October release");
    expect(previous).toContain("2 of 2 loaded BEA releases.");
    workspace.setView("watchlist");
    expect(html()).not.toContain("bea-release-agenda");
    workspace.setView("markets");
    expect(html()).toContain("Invented October release");
    expect(read).toHaveBeenCalledTimes(2);
    workspace.coordinator.retire();
    expect(html()).not.toContain("bea-release-agenda");
    expect(workspace.agenda.getSnapshot().agenda).toBeNull();
    expect(html()).not.toContain('id="managed-bea-release-date"');
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });
  it("keeps Annual, the shared note and Back usable for a listing outside declared price coverage", async () => {
    const { workspace, api, html } = fixture(payload, []);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistEod(member);
    const selected = workspace.getSnapshot().research!.selection;
    const unavailable = html();
    expect(unavailable).toContain(
      "Price history is not available for this listing in this workspace.",
    );
    expect(unavailable).toContain('aria-label="Annual section for DEMO"');
    expect(unavailable).toContain("Back to workspace");
    expect(unavailable).toContain("Private research note");
    expect(unavailable).not.toContain("Load one-month close history");
    expect(unavailable).not.toContain("Tiingo");
    await workspace.eod.load();
    workspace.noteResearch(
      selected,
      "Updated unsupported-price company thesis",
    );
    workspace.switchToAnnual();
    expect(html()).toContain("Load annual report");
    expect(workspace.getSnapshot().research!.selection).toBe(selected);
    workspace.switchToEod();
    expect(html()).toContain("Updated unsupported-price company thesis");
    expect(workspace.eod.getSnapshot().available).toBe(false);
    workspace.closeResearch();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.getSnapshot().view).toBe("watchlist");
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Updated unsupported-price company thesis");
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("binds the Price action to the captured visit and latest shared note without saving or loading", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Original thesis" },
        payload.memberships[0]!,
      ],
    });
    const prices = {
      ...eodResponse(),
      rows: [
        { date: "2026-09-17", close: "100" },
        { date: "2026-09-18", close: "110" },
        { date: "2026-09-19", close: "90" },
      ],
    };
    vi.mocked(api.eodHistory).mockResolvedValue(prices);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    await workspace.eod.load();
    const company = () => {
      mounted.direct = true;
      mounted.refIndex = 0;
      const node = ManagedWorkspaceScreen({ workspace });
      mounted.direct = false;
      return elements(node).find(
        (element) => element.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const captured = company().props.priceNoteActions;
    expect(
      captured.getAction(prices, prices.rows[0]!, prices.rows[1]!).canAppend,
    ).toBe(true);
    company().props.onNote("x".repeat(2000));
    expect(
      company().props.priceNoteActions.getAction(
        prices,
        prices.rows[0]!,
        prices.rows[1]!,
      ).canAppend,
    ).toBe(false);
    company().props.onNote("  Latest Cafe\u0301 thesis  ");
    const other = workspace.coordinator.getSnapshot().draft!.memberships[1];
    expect(captured.append(prices, prices.rows[0]!, prices.rows[1]!)).toEqual({
      appended: true,
      message:
        "Price comparison added to the note draft. Review and save all changes in My Watchlist.",
    });
    const note =
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note;
    expect(note.startsWith("  Latest Cafe\u0301 thesis   ")).toBe(true);
    expect(note).toContain(prices.rows[0]!.close);
    expect(note).toContain(
      "2026-09-17 USD 100 to 2026-09-18 USD 110; raw close change +$10 (+10.0000%).",
    );
    expect(note).not.toContain("USD 90");
    expect(workspace.eod.getSnapshot().response).toBe(prices);
    expect(note).toContain(prices.completedAt);
    expect(workspace.coordinator.getSnapshot().draft!.memberships[1]).toEqual(
      other,
    );
    expect(api.eodHistory).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
  });

  it("refuses Price callbacks captured before replacement, section change or a reopened visit", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [{ ...eodSelection.listing, note: "Keep thesis" }],
    });
    const prices = eodResponse();
    const next = eodResponse();
    vi.mocked(api.eodHistory)
      .mockResolvedValueOnce(prices)
      .mockResolvedValueOnce(next);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistEod(member);
    await workspace.eod.load();
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    const actions = company.props.priceNoteActions;
    const draft = workspace.coordinator.getSnapshot().draft;
    workspace.switchToAnnual();
    expect(
      actions.append(prices, prices.rows[0]!, prices.rows.at(-1)!).appended,
    ).toBe(false);
    workspace.switchToEod();
    await workspace.eod.load();
    expect(
      actions.append(prices, prices.rows[0]!, prices.rows.at(-1)!).appended,
    ).toBe(false);
    workspace.closeResearch();
    workspace.openWatchlistEod(member);
    vi.mocked(api.eodHistory).mockResolvedValueOnce(next);
    await workspace.eod.load();
    expect(
      actions.append(next, next.rows[0]!, next.rows.at(-1)!).appended,
    ).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.save).not.toHaveBeenCalled();
  });
  it("wires Filings through the real company panel and fences captured actions after the visit changes", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    workspace.switchToFilings();
    const selection = workspace.getSnapshot().research!.selection;
    vi.mocked(api.recentFilings).mockResolvedValue(
      filingsResponse(2, "available", selection),
    );
    await workspace.filings.load();
    const response = workspace.filings.getSnapshot().response!;
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    mounted.direct = false;
    const panel = elements(ManagedCompanyResearch(company.props)).find(
      (element) => element.type === ManagedCompanyFilings,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedCompanyFilings>>;
    expect(panel.props.noteActions).toBe(company.props.filingsNoteActions);
    expect(panel.props.followupActions).toBe(
      company.props.filingsFollowupActions,
    );
    expect(panel.props.followupActions!.model).toBe(workspace.followups);
    expect(api.loadFollowups).not.toHaveBeenCalled();
    const followupPort = panel.props.followupActions!.getContext(
      response,
      response.issuer.filings[1]!,
    ).port!;
    expect(followupPort.isCurrent()).toBe(true);
    expect(followupPort.response).toBe(response);
    expect(panel.props.annual).toBe(workspace.annual);
    const actions = panel.props.noteActions!;
    const row = response.issuer.filings[1]!;
    workspace.noteResearch(selection, "Latest thesis");
    expect(actions.getAction(response, row).canAppend).toBe(true);
    expect(html()).toContain("Add reference to note draft");
    expect(actions.append(response, row).appended).toBe(true);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toContain("Latest thesis Observed SEC filing reference:");
    expect(actions.getAction(response, row).reason).toContain(
      "already in the note draft",
    );
    const draft = workspace.coordinator.getSnapshot().draft;
    workspace.closeResearch();
    workspace.openWatchlistAnnual(draft!.memberships[0]!);
    workspace.switchToFilings();
    await workspace.filings.load();
    const next = workspace.filings.getSnapshot().response!;
    expect(actions.append(next, next.issuer.filings[1]!).appended).toBe(false);
    expect(followupPort.isCurrent()).toBe(false);
    expect(
      panel.props.followupActions!.getContext(next, next.issuer.filings[1]!)
        .port,
    ).toBeNull();
    expect(api.loadFollowups).not.toHaveBeenCalled();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.recentFilings).toHaveBeenCalledTimes(2);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });
  it("carries a loaded Annual baseline into Filings without another read and keeps the full note Save", async () => {
    const { workspace, api, html } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Existing thesis" },
        payload.memberships[0]!,
      ],
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const original = workspace.coordinator.getSnapshot().draft!;
    vi.mocked(api.annualReport).mockResolvedValueOnce(await annualResponse());
    workspace.openWatchlistAnnual(original.memberships[0]!);
    await workspace.annual.load();
    const report = workspace.annual.getSnapshot().response;
    workspace.switchToFilings();
    expect(api.recentFilings).not.toHaveBeenCalled();
    const selection = workspace.getSnapshot().research!.selection;
    vi.mocked(api.recentFilings).mockResolvedValueOnce(
      filingsResponse(2, "available", selection),
    );
    await workspace.filings.load();
    expect(html()).toContain("Annual report filed 2026-02-01");
    expect(html()).toContain("Filed after Annual report");
    expect(workspace.coordinator.getSnapshot().draft).toBe(original);
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    mounted.direct = false;
    const response = workspace.filings.getSnapshot().response!;
    expect(
      company.props.filingsNoteActions.append(
        response,
        response.issuer.filings[1]!,
      ).appended,
    ).toBe(true);
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft.memberships[0]!.note).toContain(
      "Existing thesis Observed SEC filing reference:",
    );
    expect(draft.memberships[1]).toEqual(original.memberships[1]);
    expect(api.save).not.toHaveBeenCalled();
    vi.mocked(api.save).mockImplementationOnce((command) =>
      Promise.resolve({
        version: 2,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.save();
    expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(draft);
    expect(api.save).toHaveBeenCalledOnce();
    workspace.switchToAnnual();
    expect(workspace.annual.getSnapshot().response).toBe(report);
    workspace.switchToFilings();
    expect(workspace.filings.getSnapshot().response).toBe(response);
    expect(html()).toContain("Annual report filed 2026-02-01");
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.recentFilings).toHaveBeenCalledOnce();
    expect(api.eodHistory).not.toHaveBeenCalled();
    workspace.closeResearch();
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(workspace.filings.getSnapshot().response).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(draft);
  });
  it("filters a company refresh from its watchlist handoff and saves only the filtered current reference", async () => {
    const { workspace, api, html } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Existing thesis" },
        payload.memberships[0]!,
      ],
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    const original = workspace.coordinator.getSnapshot().draft!;
    workspace.selectWatchlistFilingsMember(original.memberships[0]!);
    const selected = workspace.watchlistFilings.getSnapshot();
    vi.mocked(api.recentFilings).mockResolvedValueOnce(
      filingsResponse(1, "available", selected.filings.selection!),
    );
    await workspace.watchlistFilings.load(selected.selected!);
    const seed = workspace.watchlistFilings.getSnapshot().filings.response!;
    workspace.openWatchlistFilings({
      member: selected.selected!,
      response: seed,
    });
    expect(workspace.filings.getSnapshot().refreshComparison).toBeNull();
    expect(html()).not.toContain("Compared loaded lists");
    const selection = workspace.getSnapshot().research!.selection;
    vi.mocked(api.recentFilings).mockResolvedValueOnce(
      filingsResponse(2, "available", selection),
    );
    await workspace.filings.load();
    const current = workspace.filings.getSnapshot().response!;
    expect(html()).toContain(
      "Newly observed in this refresh: 1 of 2 filings in the displayed response.",
    );
    expect(html()).toContain(
      'data-filings-new-accession="0000000001-26-000002"',
    );
    const pair = workspace.filings.getSnapshot().refreshComparison;
    const allFilings = initialManagedFilingsFilter(current, null, pair);
    const newlyObserved = selectManagedFilingsRefreshView(
      allFilings,
      allFilings,
      "new",
    );
    const filtered = projectManagedFilingsFilter(newlyObserved);
    expect(filtered.rows).toEqual([current.issuer.filings[1]!]);
    expect(filtered.rows[0]).toBe(current.issuer.filings[1]);
    expect(filtered.matchingCount).toBe(1);
    expect(filtered.loadedCount).toBe(2);
    expect(workspace.coordinator.getSnapshot().draft).toBe(original);
    expect(api.recentFilings).toHaveBeenCalledTimes(2);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    workspace.switchToAnnual();
    workspace.switchToFilings();
    expect(workspace.filings.getSnapshot().refreshComparison).toBe(pair);
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    mounted.direct = false;
    expect(
      company.props.filingsNoteActions.append(seed, seed.issuer.filings[0]!)
        .appended,
    ).toBe(false);
    workspace.noteResearch(selection, "Latest thesis after filtering");
    expect(
      company.props.filingsNoteActions.append(current, filtered.rows[0]!)
        .appended,
    ).toBe(true);
    const draft = workspace.coordinator.getSnapshot().draft!;
    expect(draft.memberships[0]!.note).toContain(
      "Latest thesis after filtering Observed SEC filing reference:",
    );
    expect(draft.memberships[0]!.note).toContain("0000000001-26-000002");
    expect(draft.memberships[0]!.note).not.toContain("Newly observed");
    expect(draft.memberships[1]).toEqual(original.memberships[1]);
    expect(api.save).not.toHaveBeenCalled();
    workspace.closeResearch();
    expect(workspace.filings.getSnapshot().refreshComparison).toBeNull();
    expect(workspace.watchlistFilings.getSnapshot().filings.response).toBe(
      seed,
    );
    expect(
      workspace.watchlistFilings.getSnapshot().filings.refreshComparison,
    ).toBeNull();
    vi.mocked(api.save).mockImplementationOnce((command) =>
      Promise.resolve({
        version: 2,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.save();
    expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(draft);
    expect(api.save).toHaveBeenCalledOnce();
    expect(api.recentFilings).toHaveBeenCalledTimes(2);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });
  it("updates comparative Annual action capacity after typing and appends to the latest shared draft without saving", async () => {
    const { workspace, api, html } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Original thesis" },
        payload.memberships[0]!,
      ],
    });
    const report = await annualResponse(annualComparativeRows());
    vi.mocked(api.annualReport).mockResolvedValue(report);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    await workspace.annual.load();
    const company = () => {
      mounted.direct = true;
      mounted.refIndex = 0;
      const node = ManagedWorkspaceScreen({ workspace });
      mounted.direct = false;
      return elements(node).find(
        (element) => element.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const pair = viewOf(report).income.resolution.bases.flatMap(
      (basis) => basis.pairs,
    )[0]!;
    const captured = company().props.annualNoteActions;
    expect(captured.getAction(report, pair).canAppend).toBe(true);
    company().props.onNote("x".repeat(2000));
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Add Revenues annual evidence to note draft"/u,
    );
    expect(html()).toContain(
      "The complete note must fit within 2,000 characters",
    );
    const oversizedDraft = workspace.coordinator.getSnapshot().draft;
    expect(captured.append(report, pair).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(oversizedDraft);
    expect(api.save).not.toHaveBeenCalled();
    company().props.onNote("  Latest Cafe\u0301 thesis  ");
    expect(html()).toMatch(
      /<button class="trial-secondary" aria-label="Add Revenues annual evidence to note draft"/u,
    );
    const other = workspace.coordinator.getSnapshot().draft!.memberships[1];
    expect(captured.append(report, pair)).toEqual({
      appended: true,
      message:
        "Annual evidence added to the note draft. Review and save all changes in My Watchlist.",
    });
    const note =
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note;
    expect(
      note.startsWith("  Latest Cafe\u0301 thesis   Observed Annual report:"),
    ).toBe(true);
    expect(note).toContain("Revenues revenue USD 1000");
    expect(note).toContain(
      "Reported net margin 10% to 10%, change 0 percentage points.",
    );
    expect(note).toContain(report.evidence.generation.completedAt);
    expect(workspace.coordinator.getSnapshot().draft!.memberships[1]).toEqual(
      other,
    );
    expect(workspace.annual.getSnapshot().response).toBe(report);
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
  });

  it("rejects comparative Annual note callbacks captured before response replacement or closing the visit", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [{ ...eodSelection.listing, note: "Keep my thesis" }],
    });
    const report = await annualResponse(annualComparativeRows());
    const next = await annualResponse(
      annualComparativeRows(),
      "2026-09-21T00:00:00.000Z",
    );
    vi.mocked(api.annualReport)
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce(next);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    await workspace.annual.load();
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    const actions = company.props.annualNoteActions;
    const pair = viewOf(report).income.resolution.bases.flatMap(
      (basis) => basis.pairs,
    )[0]!;
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.annual.load();
    expect(actions.append(report, pair).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    workspace.closeResearch();
    workspace.openWatchlistAnnual(draft!.memberships[0]!);
    const nextPair = viewOf(next).income.resolution.bases.flatMap(
      (basis) => basis.pairs,
    )[0]!;
    expect(actions.append(next, nextPair).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.annualReport).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("wires cash generation to the latest shared note and updates guarded capacity without saving", async () => {
    const { workspace, api, html } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Original thesis" },
        payload.memberships[0]!,
      ],
    });
    const report = await cashResponse([
      cashRow("operating_cash_flow", "120.125"),
      cashRow("ppe_purchases", "20"),
    ]);
    vi.mocked(api.annualReport).mockResolvedValue(report);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    await workspace.annual.load();
    const company = () => {
      mounted.direct = true;
      mounted.refIndex = 0;
      const node = ManagedWorkspaceScreen({ workspace });
      mounted.direct = false;
      return elements(node).find(
        (element) => element.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const captured = company().props.annualCashNoteActions;
    expect(captured.getAction(report).canAppend).toBe(true);
    company().props.onNote("x".repeat(2000));
    expect(html()).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*>Add cash generation to note draft<\/button>/u,
    );
    const tooLong = workspace.coordinator.getSnapshot().draft;
    expect(captured.append(report).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(tooLong);
    company().props.onNote("  Latest Cafe\u0301 thesis  ");
    const other = workspace.coordinator.getSnapshot().draft!.memberships[1];
    expect(captured.append(report).appended).toBe(true);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe(
      "  Latest Cafe\u0301 thesis   " + annualCashNoteExcerpt(report, false),
    );
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1],
    ).toStrictEqual(other);
    expect(captured.getAction(report)).toEqual({
      canAppend: false,
      reason:
        "This exact cash-generation reference is already in the note draft.",
    });
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("fences cash-note callbacks after response replacement and a reopened visit", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [{ ...eodSelection.listing, note: "Keep my thesis" }],
    });
    const report = await cashResponse([
      cashRow("operating_cash_flow", "123"),
      cashRow("ppe_purchases", "23"),
    ]);
    const next = structuredClone(report);
    vi.mocked(api.annualReport)
      .mockResolvedValueOnce(report)
      .mockResolvedValue(next);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    await workspace.annual.load();
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    mounted.direct = false;
    const actions = company.props.annualCashNoteActions;
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.annual.load();
    expect(actions.append(report).appended).toBe(false);
    workspace.closeResearch();
    workspace.openWatchlistAnnual(member);
    await workspace.annual.load();
    expect(actions.append(next).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.annualReport).toHaveBeenCalledTimes(3);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("wires liquidity to the latest shared note and updates guarded capacity without saving", async () => {
    const { workspace, api, html } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Original thesis" },
        payload.memberships[0]!,
      ],
    });
    const report = await liquidityResponse([
      liquidityRow("current_assets", "120.125"),
      liquidityRow("current_liabilities", "20"),
    ]);
    vi.mocked(api.annualReport).mockResolvedValue(report);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    await workspace.annual.load();
    const company = () => {
      mounted.direct = true;
      mounted.refIndex = 0;
      const node = ManagedWorkspaceScreen({ workspace });
      mounted.direct = false;
      return elements(node).find(
        (element) => element.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const captured = company().props.annualLiquidityNoteActions;
    expect(captured.getAction(report).canAppend).toBe(true);
    company().props.onNote("x".repeat(2000));
    expect(html()).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*>Add liquidity to note draft<\/button>/u,
    );
    const tooLong = workspace.coordinator.getSnapshot().draft;
    expect(captured.append(report).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(tooLong);
    company().props.onNote("  Latest Cafe\u0301 thesis  ");
    const other = workspace.coordinator.getSnapshot().draft!.memberships[1];
    expect(captured.append(report).appended).toBe(true);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe(
      "  Latest Cafe\u0301 thesis   " +
        annualLiquidityNoteExcerpt(report, false),
    );
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[1],
    ).toStrictEqual(other);
    expect(captured.getAction(report)).toEqual({
      canAppend: false,
      reason: "This exact liquidity reference is already in the note draft.",
    });
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("fences liquidity-note callbacks after response replacement and a reopened visit", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [{ ...eodSelection.listing, note: "Keep my thesis" }],
    });
    const report = await liquidityResponse([
      liquidityRow("current_assets", "123"),
      liquidityRow("current_liabilities", "23"),
    ]);
    const next = structuredClone(report);
    vi.mocked(api.annualReport)
      .mockResolvedValueOnce(report)
      .mockResolvedValue(next);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    await workspace.annual.load();
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    mounted.direct = false;
    const actions = company.props.annualLiquidityNoteActions;
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.annual.load();
    expect(actions.append(report).appended).toBe(false);
    workspace.closeResearch();
    workspace.openWatchlistAnnual(member);
    await workspace.annual.load();
    expect(actions.append(next).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.annualReport).toHaveBeenCalledTimes(3);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("binds recipe delivery to the current Discover route before a navigation render commits", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const delivery = { deliver: vi.fn() };
    let pending = false;
    let companyRoute = false;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => pending,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => companyRoute,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn(() => false),
      back: vi.fn(),
    };
    mounted.direct = true;
    const nodes = elements(
      ManagedWorkspaceScreen({
        workspace,
        navigation,
        financialScreenRecipeDelivery: delivery,
      }),
    );
    const discovery = nodes.find(
      (node) => node.type === ManagedFinancialDiscovery,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedFinancialDiscovery>
    >;
    expect(discovery.props.recipeDelivery).toBe(delivery);
    const current = discovery.props.recipesRouteActive;
    const draft = workspace.coordinator.getSnapshot().draft;
    expect(current()).toBe(true);
    pending = true;
    expect(current()).toBe(false);
    pending = false;
    companyRoute = true;
    expect(current()).toBe(false);
    companyRoute = false;
    navigation.invalid = true;
    expect(current()).toBe(false);
    navigation.invalid = false;
    workspace.setView("watchlist");
    expect(current()).toBe(false);
    workspace.setView("discover");
    expect(current()).toBe(true);
    workspace.sessionOwner.dispose();
    expect(current()).toBe(false);
    expect(delivery.deliver).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(draft?.memberships).toEqual(payload.memberships);
    mounted.direct = false;
  });

  it("refuses retained callbacks before source reads, identity resolve or local review changes while navigation is pending", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    vi.mocked(api.loadFollowups).mockResolvedValueOnce({
      version: 0,
      payload: { schemaVersion: 1, entries: [] },
    });
    await workspace.followups.coordinator.load();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.followups.add(member, "2026-10-15");
    const entry =
      workspace.followups.coordinator.getSnapshot().draft!.entries[0]!;
    workspace.setView("followups");
    workspace.openWatchlistEod(member);
    let pending = false;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => pending,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => true,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn(() => false),
      back: vi.fn(),
    };
    mounted.direct = true;
    const nodes = elements(ManagedWorkspaceScreen({ workspace, navigation }));
    const company = nodes.find(
      (node) => node.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    const followups = nodes.find(
      (node) => node.type === ManagedFollowupsEntry,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedFollowupsEntry>>;
    const search = nodes.find(
      (node) => node.type === WorkspaceSearch,
    ) as React.ReactElement<React.ComponentProps<typeof WorkspaceSearch>>;
    const before = [
      workspace.getSnapshot(),
      workspace.coordinator.getSnapshot(),
      workspace.followups.coordinator.getSnapshot(),
    ];
    const local = [...mounted.screenState];
    const refs = mounted.refs.map((ref) => ref.current);
    const request = vi.spyOn(workspace, "requestResearchSource");
    const snapshotLoad = vi.spyOn(workspace, "loadCompanySnapshot");
    const prepare = vi.spyOn(workspace, "prepareFollowupResearch");
    pending = true; // The ref changes before the disabled render is committed.
    await company.props.onRequestSource("annual");
    await company.props.onLoadSnapshot();
    expect(snapshotLoad).not.toHaveBeenCalled();
    company.props.onReview();
    followups.props.onResearch(entry, {} as HTMLButtonElement);
    search.props.onSearch({} as HTMLFormElement);
    expect(request).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(navigation.view).not.toHaveBeenCalled();
    expect(navigation.section).not.toHaveBeenCalled();
    expect(mounted.screenState).toEqual(local);
    expect(mounted.refs.map((ref) => ref.current)).toEqual(refs);
    expect([
      workspace.getSnapshot(),
      workspace.coordinator.getSnapshot(),
      workspace.followups.coordinator.getSnapshot(),
    ]).toEqual(before);
    for (const method of [
      "resolve",
      "search",
      "annualReport",
      "eodHistory",
      "recentFilings",
      "save",
      "saveFollowups",
    ] as const)
      expect(api[method]).not.toHaveBeenCalled();
    mounted.direct = false;
  });

  it("renders pending company controls without disabling draft editing or the selected source's direct Load", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const navigation: ManagedCompanyNavigation = {
      pending: true,
      isPending: () => true,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => true,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn(() => false),
      back: vi.fn(),
    };
    mounted.direct = true;
    const nodes = elements(ManagedWorkspaceScreen({ workspace, navigation }));
    const company = nodes.find(
      (node) => node.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    expect(company.props.navigationPending).toBe(true);
    const tree = elements(ManagedCompanyResearch(company.props));
    const nav = tree.find((node) => node.type === "nav")!;
    const sections = elements(nav).filter((node) => node.type === "button");
    expect(sections).toHaveLength(3);
    expect(
      sections.every(
        (node) => (node.props as React.ComponentProps<"button">).disabled,
      ),
    ).toBe(true);
    const note = tree.find(
      (node) => node.type === ManagedResearchNote,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedResearchNote>>;
    const noteTree = elements(ManagedResearchNote(note.props));
    expect(
      (
        noteTree.find((node) => node.type === ManagedNoteEditor)!
          .props as React.ComponentProps<typeof ManagedNoteEditor>
      ).disabled,
    ).toBe(false);
    const draft = workspace.coordinator.getSnapshot().draft;
    mounted.direct = false;
    const html = renderToStaticMarkup(
      <ManagedCompanyResearch {...company.props} />,
    );
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Back to workspace<\/button>/u,
    );
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Review in My Watchlist<\/button>/u,
    );
    expect(html).toMatch(
      /<button(?![^>]*disabled)[^>]*>Load one-month close history<\/button>/u,
    );
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("wires one explicit overview source request before route blocking without changing the draft", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [{ ...eodSelection.listing, note: "Thesis · Café 東京 📈" }],
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const draft = workspace.coordinator.getSnapshot().draft!;
    workspace.openWatchlistEod(draft.memberships[0]!);
    vi.mocked(api.annualReport).mockResolvedValueOnce(await annualResponse());
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => true,
      invalid: false,
      returnFocus: 0,
      open: vi.fn<ManagedCompanyNavigation["open"]>((action) => action()),
      back: vi.fn(),
      section: vi.fn((section) => {
        expect(workspace.getSnapshot().research?.section).toBe(section);
        expect(workspace.annual.getSnapshot().running).toBe(true);
        workspace.setNavigationBlocked(true);
      }),
      view: vi.fn(() => false),
    };
    mounted.direct = true;
    const company = elements(
      ManagedWorkspaceScreen({ workspace, navigation }),
    ).find(
      (entry) => entry.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    mounted.direct = false;
    const overview = elements(ManagedCompanyResearch(company.props)).find(
      (entry) => entry.type === ManagedCompanyEvidenceActions,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyEvidenceActions>
    >;
    expect(overview.props.price).toBe(workspace.eod);
    expect(overview.props.annual).toBe(workspace.annual);
    expect(overview.props.filings).toBe(workspace.filings);
    expect(overview.props.onCancel).toBe(company.props.onCancelSource);
    expect(api.annualReport).not.toHaveBeenCalled();
    const request = vi.spyOn(workspace, "requestResearchSource");
    overview.props.onRequest("annual");
    expect(request).toHaveBeenCalledExactlyOnceWith(
      company.props.research,
      "annual",
    );
    await request.mock.results[0]!.value;
    expect(navigation.section).toHaveBeenCalledExactlyOnceWith("annual");
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(workspace.annual.getSnapshot().response).not.toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.recentFilings).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("fences retained overview request and Cancel callbacks after reopening the same company", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [{ ...eodSelection.listing, note: "Keep exact thesis" }],
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const draft = workspace.coordinator.getSnapshot().draft!;
    const member = draft.memberships[0]!;
    workspace.openWatchlistEod(member);
    const completions: Array<
      (value: Awaited<ReturnType<ManagedApi["annualReport"]>>) => void
    > = [];
    vi.mocked(api.annualReport).mockImplementation(
      () => new Promise((resolve) => completions.push(resolve)),
    );
    mounted.direct = true;
    const company = elements(ManagedWorkspaceScreen({ workspace })).find(
      (entry) => entry.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    mounted.direct = false;
    const first = company.props.onRequestSource("annual");
    workspace.closeResearch();
    workspace.openWatchlistAnnual(member);
    const second = workspace.annual.load();
    expect(api.annualReport).toHaveBeenCalledTimes(2);
    const oldSignal = vi.mocked(api.annualReport).mock.calls[0]![1];
    const newSignal = vi.mocked(api.annualReport).mock.calls[1]![1];
    await company.props.onRequestSource("filings");
    company.props.onCancelSource("annual");
    expect(oldSignal.aborted).toBe(true);
    expect(newSignal.aborted).toBe(false);
    expect(workspace.getSnapshot().research?.section).toBe("annual");
    expect(api.recentFilings).not.toHaveBeenCalled();
    const response = await annualResponse();
    completions[0]!(response);
    completions[1]!(response);
    await Promise.all([first, second]);
    expect(workspace.annual.getSnapshot().response).not.toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.save).not.toHaveBeenCalled();
  });

  it("coordinates company section, Back and watchlist review through URL navigation", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => true,
      invalid: false,
      returnFocus: 0,
      open: vi.fn<ManagedCompanyNavigation["open"]>((action) => action()),
      back: vi.fn(),
      section: vi.fn(),
      view: vi.fn<ManagedCompanyNavigation["view"]>((view) => {
        workspace.setView(view);
        return true;
      }),
    };
    mounted.direct = true;
    const node = ManagedWorkspaceScreen({ workspace, navigation });
    const company = elements(node).find(
      (element) => element.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    company.props.onNote("Unsent from the company link");
    company.props.onSection("annual");
    expect(navigation.section).toHaveBeenCalledExactlyOnceWith("annual");
    company.props.onBack();
    expect(navigation.back).toHaveBeenCalledOnce();
    company.props.onReview();
    expect(navigation.view).toHaveBeenCalledExactlyOnceWith("watchlist");
    expect(workspace.getSnapshot().research).toBeNull();
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Unsent from the company link");
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("ignores a retained company's section, Back and review callbacks after that visit closes", async () => {
    const { workspace } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistEod(member);
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => true,
      invalid: false,
      returnFocus: 0,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn<ManagedCompanyNavigation["view"]>().mockReturnValue(true),
      back: vi.fn(),
    };
    mounted.direct = true;
    const company = elements(
      ManagedWorkspaceScreen({ workspace, navigation }),
    ).find(
      (node) => node.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    workspace.closeResearch();
    workspace.openWatchlistAnnual(member);
    const current = workspace.getSnapshot().research;
    company.props.onSection("eod");
    company.props.onBack();
    company.props.onReview();
    expect(navigation.section).not.toHaveBeenCalled();
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.view).not.toHaveBeenCalled();
    expect(workspace.getSnapshot().research).toBe(current);
  });

  it("keeps focus, the draft and search untouched when a route transition rejects a view action", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => true,
      invalid: false,
      returnFocus: 0,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn<ManagedCompanyNavigation["view"]>().mockReturnValue(false),
      back: vi.fn(),
    };
    mounted.direct = true;
    const nodes = elements(ManagedWorkspaceScreen({ workspace, navigation }));
    const company = nodes.find(
      (node) => node.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    const search = nodes.find(
      (node) => node.type === WorkspaceSearch,
    ) as React.ReactElement<React.ComponentProps<typeof WorkspaceSearch>>;
    const original = { isConnected: true, focus: vi.fn() };
    const focus = vi.fn();
    mounted.refs[0]!.current = original;
    mounted.refs[2]!.current = { focus };
    const visit = workspace.getSnapshot().research;
    const draft = workspace.coordinator.getSnapshot().draft;
    company.props.onReview();
    search.props.onSearch({} as HTMLFormElement);
    expect(navigation.view).toHaveBeenCalledTimes(2);
    expect(mounted.refs[0]!.current).toBe(original);
    expect(focus).not.toHaveBeenCalled();
    expect(workspace.getSnapshot().research).toBe(visit);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.search).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("lets navigation reject an opener before the model or focus origin changes", async () => {
    const { workspace } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => true,
      invalid: false,
      returnFocus: 0,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn<ManagedCompanyNavigation["view"]>().mockReturnValue(false),
      back: vi.fn(),
    };
    mounted.direct = true;
    const nodes = editorElements(
      ManagedWorkspaceScreen({ workspace, navigation }),
    );
    const opener = nodes.find(
      (node) =>
        node.type === "button" &&
        (node.props as React.ComponentProps<"button">)["aria-label"] ===
          "EOD close history for saved DEMO",
    ) as React.ReactElement<React.ComponentProps<"button">>;
    const origin = { isConnected: true, focus: vi.fn() };
    mounted.refs[0]!.current = origin;
    opener.props.onClick!({
      currentTarget: {},
    } as React.MouseEvent<HTMLButtonElement>);
    expect(navigation.open).toHaveBeenCalledOnce();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(mounted.refs[0]!.current).toBe(origin);
  });

  it("restores the connected opener after a URL Back transition", () => {
    const { workspace } = fixture();
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => true,
      invalid: false,
      returnFocus: 1,
      open: vi.fn<ManagedCompanyNavigation["open"]>((action) => action()),
      section: vi.fn(),
      view: vi.fn<ManagedCompanyNavigation["view"]>().mockReturnValue(true),
      back: vi.fn(),
    };
    mounted.direct = true;
    ManagedWorkspaceScreen({ workspace, navigation });
    const focus = vi.fn();
    mounted.refs[0]!.current = { isConnected: true, focus };
    mountEffects();
    expect(focus).toHaveBeenCalledOnce();
    expect(mounted.refs[0]!.current).toBeNull();
  });

  it("reveals the focused return target once if later responsive restoration moves it offscreen", async () => {
    const h = await returnedFocusFixture();
    h.commit();
    expect(h.target.focus).toHaveBeenCalledOnce();
    expect(h.target.scrollIntoView).not.toHaveBeenCalled();
    h.offscreen();
    h.frame();
    expect(h.target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    expect(h.view.requestAnimationFrame).toHaveBeenCalledOnce();
    expect(h.target.focus).toHaveBeenCalledOnce();
    expect(h.workspace.coordinator.getSnapshot().draft).toBe(h.before);
    expect(h.api.load).toHaveBeenCalledOnce();
    expect(h.api.status).toHaveBeenCalledOnce();
    expect(h.api.annualReport).not.toHaveBeenCalled();
    expect(h.api.eodHistory).not.toHaveBeenCalled();
    expect(h.api.recentFilings).not.toHaveBeenCalled();
    expect(h.api.save).not.toHaveBeenCalled();
  });

  it.each(["visible", "desktop sidebar"])(
    "does not scroll an already visible return target (%s)",
    async (layout) => {
      const h = await returnedFocusFixture();
      if (layout === "desktop sidebar") {
        h.covered();
        h.view.getComputedStyle.mockReturnValue({ position: "static" });
      }
      h.commit();
      h.frame();
      expect(h.target.focus).toHaveBeenCalledOnce();
      expect(h.target.scrollIntoView).not.toHaveBeenCalled();
    },
  );

  it("reveals an opener covered by the fixed mobile navigation", async () => {
    const h = await returnedFocusFixture();
    h.commit();
    h.covered();
    h.frame();
    expect(h.target.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("keeps a smaller visual viewport authoritative when navigation lies below it", async () => {
    const h = await returnedFocusFixture();
    h.view.visualViewport.height = 400;
    h.commit();
    h.placeAt(500);
    h.frame();
    expect(h.target.scrollIntoView).toHaveBeenCalledOnce();
  });

  it("focuses the visible fallback inside mobile navigation without scrolling when the opener is gone", async () => {
    const h = await returnedFocusFixture();
    mounted.refs[0]!.current = { isConnected: false, focus: vi.fn() };
    h.navigation.contains.mockReturnValue(true);
    h.commit();
    h.covered();
    h.frame();
    expect(h.target.focus).toHaveBeenCalledOnce();
    expect(h.target.scrollIntoView).not.toHaveBeenCalled();
  });

  it.each([
    "moved focus",
    "detached",
    "hidden",
    "new visit",
    "retired",
    "unmount",
  ])("discards a deferred return correction after %s", async (change) => {
    const h = await returnedFocusFixture();
    const cleanup = h.commit();
    h.offscreen();
    if (change === "moved focus") h.document.activeElement = {};
    if (change === "detached") h.target.isConnected = false;
    if (change === "hidden") h.target.getClientRects.mockReturnValue([]);
    if (change === "new visit") {
      h.workspace.openWatchlistAnnual(h.before!.memberships[0]!);
      h.workspace.closeResearch();
    }
    if (change === "retired") h.workspace.coordinator.retire();
    if (change === "unmount") cleanup?.();
    h.frame();
    expect(h.target.scrollIntoView).not.toHaveBeenCalled();
    expect(h.target.focus).toHaveBeenCalledOnce();
    expect(h.view.requestAnimationFrame).toHaveBeenCalledOnce();
    if (change === "unmount")
      expect(h.view.cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("cancels a prior workspace's return frame when its effect is replaced", async () => {
    const h = await returnedFocusFixture();
    const cleanup = h.commit();
    h.offscreen();
    cleanup?.();
    h.render(fixture().workspace);
    h.frame();
    expect(h.target.scrollIntoView).not.toHaveBeenCalled();
    expect(h.view.cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("uses the route Back action while company metadata is still pending", async () => {
    const { workspace, api } = fixture();
    const native = nativeBackFixture();
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-one",
      section: "annual",
    });
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => true,
      invalid: false,
      returnFocus: 0,
      open: vi.fn<ManagedCompanyNavigation["open"]>((action) => action()),
      section: vi.fn(),
      view: vi.fn<ManagedCompanyNavigation["view"]>().mockReturnValue(true),
      back: vi.fn(),
    };
    renderToStaticMarkup(
      <ManagedWorkspaceScreen
        workspace={workspace}
        navigation={navigation}
        androidBack={native.adapter}
      />,
    );
    vi.mocked(navigation.back).mockImplementation(() =>
      workspace.closeResearch(),
    );
    mountEffects();
    native.ready();
    native.press(true);
    native.press(true);
    expect(navigation.back).toHaveBeenCalledTimes(2);
    expect(native.historyBack).not.toHaveBeenCalled();
    expect(native.adapter.exitApp).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("shows a retryable unavailable company link without loading research", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    vi.mocked(api.resolve).mockResolvedValue({
      snapshotSha256: snapshot.snapshotSha256,
      results: [{ listingId: "listing-missing", listing: null }],
    });
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-missing",
      section: "eod",
    });
    expect(html()).toContain("Retry company link");
    expect(html()).toContain("This listing is not available");
    expect(api.resolve).toHaveBeenCalledTimes(1);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });
  it("shares the company note with the watchlist row and reviews all changes without saving", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    mounted.direct = true;
    const company = () => {
      mounted.refIndex = 0;
      return elements(ManagedWorkspaceScreen({ workspace })).find(
        (node) => node.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const note = () =>
      elements(ManagedCompanyResearch(company().props)).find(
        (node) => node.type === ManagedResearchNote,
      ) as React.ReactElement<React.ComponentProps<typeof ManagedResearchNote>>;
    const editor = () =>
      elements(ManagedResearchNote(note().props)).find(
        (node) => node.type === ManagedNoteEditor,
      ) as React.ReactElement<React.ComponentProps<typeof ManagedNoteEditor>>;
    const input = () =>
      elements(ManagedNoteEditor(editor().props)).find(
        (node) => node.type === "textarea",
      ) as React.ReactElement<React.ComponentProps<"textarea">>;
    expect(input().props.value).toBe("Private research note");
    expect(input().props.id).toBe("managed-research-note");
    expect(input().props.disabled).toBe(false);
    input().props.onChange!({
      target: { value: "  Shared research draft  " },
    } as React.ChangeEvent<HTMLTextAreaElement>);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("  Shared research draft  ");
    company().props.onSection("annual");
    expect(input().props.value).toBe("  Shared research draft  ");
    workspace.note("listing-one", "Edited from the watchlist row");
    expect(input().props.value).toBe("Edited from the watchlist row");
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    const review = elements(ManagedResearchNote(note().props)).find(
      (node) =>
        node.type === "button" &&
        node.props.children === "Review in My Watchlist",
    ) as React.ReactElement<React.ComponentProps<"button">>;
    review.props.onClick!({} as React.MouseEvent<HTMLButtonElement>);
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.getSnapshot().view).toBe("watchlist");
    const returned = noteReviewScreen(workspace);
    const reviewNote = returned.bindReview();
    returned.commit();
    expect(reviewNote).toHaveBeenCalledOnce();
    expect(reviewNote.mock.calls[0]![0].member).toBe(
      workspace.coordinator.getSnapshot().draft!.memberships[0],
    );
    expect(focus).not.toHaveBeenCalled();
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    mounted.direct = false;
    expect(html()).toContain("Edited from the watchlist row");
  });

  it.each(["price", "income", "cash", "liquidity"] as const)(
    "reviews the exact %s comparison destination outside search, including during Save",
    async (kind) => {
      const f = await comparisonNoteReviewFixture(kind);
      const ui = comparisonReaderFixture(f.workspace);
      const first = ui.render();
      first.commit();
      expect(first.note.props.listingId).toBe(
        f.initial.memberships[0]!.listingId,
      );
      expect(f.append(first.screen).appended).toBe(true);
      const draft = f.workspace.coordinator.getSnapshot().draft!;
      const target = draft.memberships[1]!;
      expect(draft.memberships[0]).toEqual(f.initial.memberships[0]);
      expect(target.note).toMatch(/^Fresh café 東京 📈 thesis /);
      const sources = f.sourceState();
      const writes = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
      vi.mocked(f.api.save).mockReturnValueOnce(writes.promise);
      const saving = f.workspace.coordinator.save();
      const savingDraft = f.workspace.coordinator.getSnapshot().draft!;
      const currentTarget = savingDraft.memberships[1]!;
      expect(savingDraft).toEqual(draft);
      expect(currentTarget).not.toBe(target);
      const pending = ui.render();
      pending.commit();
      expect(f.workspace.canEdit()).toBe(false);
      expect(f.canAppend(pending.screen)).toBe(false);
      expect(f.api.save).toHaveBeenCalledOnce();
      const command = vi.mocked(f.api.save).mock.calls[0]![0];
      expect(command.payload).toEqual(draft);
      f.review(pending.screen, currentTarget, () => true);
      ui.render().commit();
      const selected = ui.render();
      selected.commit();
      expect(selected.note.props).toMatchObject({
        listingId: target.listingId,
        note: target.note,
        disabled: true,
      });
      expect(
        selected.nodes.find(
          (node) =>
            (node.props as { id?: string }).id === "managed-watchlist-search",
        )?.props,
      ).toMatchObject({ value: "Keep first" });
      expect(
        selected.nodes.find(
          (node) =>
            (node.props as { id?: string }).id ===
            "managed-watchlist-search-scope",
        )?.props,
      ).toMatchObject({ value: "notes" });
      expect(
        selected.nodes.some(
          (node) =>
            React.Children.toArray(node.props.children)
              .filter((child) => typeof child === "string")
              .join("") === `Selected ${target.symbol} is outside this search.`,
        ),
      ).toBe(true);
      expect(ui.reader.open).toBe(true);
      expect(ui.summary.focus).toHaveBeenCalledOnce();
      expect(ui.summary.scrollIntoView).toHaveBeenCalledOnce();
      expect(ui.page.activeElement).toBe(ui.summary);
      expect(f.workspace.coordinator.getSnapshot().draft).toBe(savingDraft);
      expect(f.sourceState()).toEqual(sources);
      f.sourceState().forEach((response, index) =>
        expect(response).toBe(sources[index]),
      );
      writes.resolve({ version: 2, payload: command.payload, replayed: false });
      await saving;
      vi.mocked(f.api.load).mockResolvedValueOnce({
        version: 2,
        payload: command.payload,
      });
      await f.workspace.coordinator.load();
      expect(f.workspace.coordinator.getSnapshot()).toMatchObject({
        baseVersion: 2,
        dirty: false,
        draft: command.payload,
      });
      expect(f.api.eodHistory).toHaveBeenCalledTimes(kind === "price" ? 2 : 0);
      expect(f.api.annualReport).toHaveBeenCalledTimes(
        kind === "price" ? 0 : 2,
      );
      for (const call of [
        f.api.recentFilings,
        f.api.economicCalendar,
        f.api.monetaryAnnouncements,
        f.api.resolve,
        f.api.search,
      ])
        expect(call).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["price", "choice"],
    ["income", "choice"],
    ["price", "response"],
    ["income", "response"],
    ["price", "member"],
    ["income", "member"],
    ["price", "retire"],
    ["income", "retire"],
  ] as const)(
    "fences queued %s comparison Review when its %s changes before the reader commits",
    async (kind, change) => {
      const f = await comparisonNoteReviewFixture(kind);
      const first = noteReviewScreen(f.workspace);
      first.commit();
      expect(f.append(first.screen).appended).toBe(true);
      const member =
        f.workspace.coordinator.getSnapshot().draft!.memberships[1]!;
      let currentChoice = true;
      f.review(first.screen, member, () => currentChoice);
      if (change === "choice") currentChoice = false;
      if (change === "response") await f.replaceSource();
      if (change === "member")
        f.workspace.note(
          member.listingId,
          "Later raw note must keep its focus",
        );
      if (change === "retire") f.workspace.coordinator.retire();
      const next = noteReviewScreen(f.workspace);
      const review = change === "retire" ? vi.fn() : next.bindReview();
      next.commit();
      expect(review).not.toHaveBeenCalled();
      expect(f.api.save).not.toHaveBeenCalled();
      if (change === "member")
        expect(
          f.workspace.coordinator.getSnapshot().draft!.memberships[1]!.note,
        ).toBe("Later raw note must keep its focus");
      if (change === "retire")
        expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
    },
  );

  it.each(["ready", "invalid", "pending", "becomes-pending"] as const)(
    "wires pair evidence to the current full draft with navigation %s",
    async (route) => {
      const invalid = route === "invalid";
      let pending = route === "pending";
      const refused = route !== "ready";
      const initial = {
        ...payload,
        memberships: [
          { ...eodSelection.listing, note: "First remains unchanged" },
          { ...payload.memberships[0]!, note: "Second raw café  東京" },
        ],
      };
      const { workspace, api } = fixture(initial, initial.memberships);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      for (const row of workspace.watchlistPrices.getSnapshot().rows) {
        const member = initial.memberships.find(
          (item) => item.listingId === row.listing.listingId,
        )!;
        const { note: _note, ...security } = member;
        void _note;
        vi.mocked(api.eodHistory).mockResolvedValueOnce({
          ...eodResponse(),
          security,
        });
        await workspace.loadWatchlistPrice(row.handle);
        expect(
          workspace.watchlistPrices
            .getSnapshot()
            .rows.find((item) => item.handle === row.handle)!.history.response,
        ).not.toBeNull();
      }
      const prices = workspace.watchlistPrices.getSnapshot();
      let selection = createManagedWatchlistComparisonSelection();
      for (const [side, row] of [
        ["left", prices.rows[0]!],
        ["right", prices.rows[1]!],
      ] as const)
        selection = selectManagedWatchlistComparisonRow(
          selection,
          selection,
          prices,
          side,
          row,
        );
      const navigation: ManagedCompanyNavigation = {
        pending: false,
        isPending: () => false,
        hasCompanyRoute: () => pending,
        invalid,
        returnFocus: 0,
        open: vi.fn(),
        section: vi.fn(),
        view: vi.fn(),
        back: vi.fn(),
      };
      mounted.direct = true;
      mounted.refIndex = 0;
      const editor = watchlistEditor(
        ManagedWorkspaceScreen({ workspace, navigation }),
      )!;
      const actions = editor.props.comparisonNoteActions;
      const destination = prices.rows[1]!.listing;
      expect(actions.getAction(selection, destination).canAppend).toBe(
        !invalid && !pending,
      );
      if (route === "becomes-pending") pending = true;
      workspace.note(destination.listingId, "Latest raw café  東京");
      const before = workspace.coordinator.getSnapshot().draft;
      expect(actions.getAction(selection, destination).canAppend).toBe(
        !refused,
      );
      expect(actions.append(selection, destination).appended).toBe(!refused);
      const after = workspace.coordinator.getSnapshot().draft!;
      if (refused) expect(after).toBe(before);
      else {
        expect(after.memberships[0]).toEqual(initial.memberships[0]);
        expect(after.memberships[1]!.note).toMatch(/^Latest raw café {2}東京 /);
        expect(after.memberships[1]!.note).toContain("Tiingo");
        vi.mocked(api.save).mockImplementationOnce((command) =>
          Promise.resolve({
            version: command.expectedVersion + 1,
            payload: command.payload,
            replayed: false,
          }),
        );
        expect(api.save).not.toHaveBeenCalled();
        await workspace.coordinator.save();
        expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(after);
      }
      expect(api.eodHistory).toHaveBeenCalledTimes(2);
      expect(api.search).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.recentFilings).not.toHaveBeenCalled();
      expect(api.economicCalendar).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["income", "ready"],
    ["cash", "ready"],
    ["liquidity", "ready"],
    ["income", "invalid"],
    ["cash", "invalid"],
    ["liquidity", "invalid"],
    ["income", "pending"],
    ["cash", "pending"],
    ["liquidity", "pending"],
    ["income", "becomes-pending"],
    ["cash", "becomes-pending"],
    ["liquidity", "becomes-pending"],
  ] as const)(
    "wires %s Annual comparison notes with navigation %s",
    async (group, route) => {
      let pending = route === "pending";
      const initial = {
        ...payload,
        memberships: [
          annualComparisonMemberships.left,
          {
            ...annualComparisonMemberships.right,
            note: "Fiscal company research",
          },
        ],
      };
      const { workspace, api } = fixture(initial);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      const model = workspace.annualComparison;
      for (const [side, index] of [
        ["left", 0],
        ["right", 1],
      ] as const) {
        const member = model.getSnapshot().memberships[index]!;
        model.select(side, model.getSnapshot(), member);
        vi.mocked(api.annualReport).mockResolvedValueOnce(
          await annualComparisonResponse(side),
        );
        await model.load(side, member);
      }
      const current = model.getSnapshot();
      const side = (key: "left" | "right") => ({
        member: current[key].selected!,
        response: current[key].report.response!,
        selectedBasis: projectAnnualComparison(
          current[key].report.response,
          current[key].report.response === null
            ? null
            : viewOf(current[key].report.response),
        ).selectedBasis,
        showingPrevious: current[key].report.showingPrevious,
      });
      const capture: AnnualComparisonNoteCapture = {
        group,
        left: side("left"),
        right: side("right"),
      };
      const navigation: ManagedCompanyNavigation = {
        pending: false,
        isPending: () => false,
        hasCompanyRoute: () => pending,
        invalid: route === "invalid",
        returnFocus: 0,
        open: vi.fn(),
        section: vi.fn(),
        view: vi.fn(),
        back: vi.fn(),
      };
      mounted.direct = true;
      mounted.refIndex = 0;
      const comparison = elements(
        ManagedWorkspaceScreen({ workspace, navigation }),
      ).find(
        (node) => node.type === ManagedWatchlistAnnualComparison,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedWatchlistAnnualComparison>
      >;
      expect(comparison.props.active).toBe(
        route === "ready" || route === "becomes-pending",
      );
      expect(comparison.props.editable).toBe(true);
      const actions = comparison.props.noteActions;
      const destination = current.right.selected!;
      expect(actions.getAction(capture, destination).canAppend).toBe(
        route === "ready" || route === "becomes-pending",
      );
      if (route === "becomes-pending") pending = true;
      const prose = "Latest exact Café 😀 comparison thesis";
      workspace.note(destination.listing.listingId, prose);
      const before = workspace.coordinator.getSnapshot().draft!;
      expect(actions.getAction(capture, destination).canAppend).toBe(
        route === "ready",
      );
      expect(actions.append(capture, destination).appended).toBe(
        route === "ready",
      );
      const after = workspace.coordinator.getSnapshot().draft!;
      if (route === "ready") {
        expect(after.memberships[0]).toEqual(before.memberships[0]);
        expect(after.memberships[1]!.note).toBe(
          prose + " " + getAnnualComparisonNoteEvidence(capture).excerpt,
        );
      } else expect(after).toBe(before);
      expect(api.annualReport).toHaveBeenCalledTimes(2);
      expect(api.save).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.recentFilings).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
    },
  );

  it.each([
    "ready",
    "invalid",
    "pending",
    "becomes-pending",
    "navigation-refuses",
  ] as const)(
    "opens a checked comparison report through the existing navigation owner: %s",
    async (route) => {
      let pending = route === "pending";
      const { workspace, api } = fixture({
        ...payload,
        memberships: [
          annualComparisonMemberships.left,
          {
            ...annualComparisonMemberships.right,
            note: "Fiscal company research",
          },
        ],
      });
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      const model = workspace.annualComparison;
      const member = model.getSnapshot().memberships[0]!;
      model.select("left", model.getSnapshot(), member);
      vi.mocked(api.annualReport).mockResolvedValueOnce(
        await annualComparisonResponse("left"),
      );
      await model.load("left", member);
      const response = model.getSnapshot().left.report.response!;
      const draftBeforeVisit = workspace.coordinator.getSnapshot().draft;
      const navigation: ManagedCompanyNavigation = {
        pending: false,
        isPending: () => false,
        hasCompanyRoute: () => pending,
        invalid: route === "invalid",
        returnFocus: 0,
        open: vi.fn<ManagedCompanyNavigation["open"]>((action) => {
          if (route !== "navigation-refuses") action();
        }),
        section: vi.fn(),
        view: vi.fn(),
        back: vi.fn(),
      };
      mounted.direct = true;
      mounted.refIndex = 0;
      const comparison = elements(
        ManagedWorkspaceScreen({ workspace, navigation }),
      ).find(
        (node) => node.type === ManagedWatchlistAnnualComparison,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedWatchlistAnnualComparison>
      >;
      const focus = vi.fn();
      const origin = {
        isConnected: true,
        focus,
      } as unknown as HTMLButtonElement;
      if (route === "becomes-pending") pending = true;
      comparison.props.onOpenReport({ side: "left", member, response }, origin);
      if (route === "ready") {
        expect(navigation.open).toHaveBeenCalledOnce();
        expect(workspace.getSnapshot().research?.section).toBe("annual");
        expect(mounted.refs[0]!.current).toBe(origin);
        await vi.waitFor(() =>
          expect(workspace.annual.getSnapshot().checkingSeed).toBe(false),
        );
        expect(workspace.annual.getSnapshot().response).toEqual(response);
        mounted.refIndex = 0;
        const company = elements(
          ManagedWorkspaceScreen({ workspace, navigation }),
        ).find((node) => node.type === ManagedCompanyResearch)!;
        mounted.direct = false;
        try {
          const report = renderToStaticMarkup(company);
          expect(report).toContain('aria-label="On this report"');
          expect(report).toContain(response.evidence.generation.completedAt);
        } finally {
          mounted.direct = true;
        }
        workspace.closeResearch();
        const effectIndex = mounted.effects.length;
        mounted.refIndex = 0;
        ManagedWorkspaceScreen({
          workspace,
          navigation: { ...navigation, returnFocus: 1 },
        });
        expect(focus).not.toHaveBeenCalled();
        mounted.effects[effectIndex]!();
        expect(focus).toHaveBeenCalledOnce();
        expect(mounted.refs[0]!.current).toBeNull();
        expect(model.getSnapshot().left.selected).toBe(member);
        expect(model.getSnapshot().left.report.response).toBe(response);
      } else {
        expect(workspace.getSnapshot().research).toBeNull();
        expect(mounted.refs[0]!.current).toBeNull();
        expect(focus).not.toHaveBeenCalled();
        expect(navigation.open).toHaveBeenCalledTimes(
          route === "navigation-refuses" ? 1 : 0,
        );
      }
      expect(api.annualReport).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
      expect(workspace.coordinator.getSnapshot().draft).toBe(draftBeforeVisit);
    },
  );

  it.each([
    "ready",
    "invalid",
    "pending",
    "becomes-pending",
    "navigation-refuses",
  ] as const)(
    "opens selected watchlist Filings through the navigation owner: %s",
    async (route) => {
      const { workspace, api } = fixture(payload);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      const selected =
        workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      workspace.selectWatchlistFilingsMember(selected);
      const model = workspace.watchlistFilings;
      const member = model.getSnapshot().selected!;
      vi.mocked(api.recentFilings).mockResolvedValueOnce(
        filingsResponse(2, "available", model.getSnapshot().filings.selection!),
      );
      await model.load(member);
      const response = model.getSnapshot().filings.response!;
      const draft = workspace.coordinator.getSnapshot().draft;
      let pending = route === "pending";
      const navigation: ManagedCompanyNavigation = {
        pending: false,
        isPending: () => false,
        hasCompanyRoute: () => pending,
        invalid: route === "invalid",
        returnFocus: 0,
        open: vi.fn<ManagedCompanyNavigation["open"]>((action) => {
          if (route !== "navigation-refuses") action();
        }),
        section: vi.fn(),
        view: vi.fn(),
        back: vi.fn(),
      };
      mounted.direct = true;
      mounted.refIndex = 0;
      const editor = elements(
        ManagedWorkspaceScreen({ workspace, navigation }),
      ).find(
        (node) => node.type === ManagedWatchlistEditor,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedWatchlistEditor>
      >;
      expect(editor.props.filings).toBe(model);
      const focus = vi.fn();
      const opener = {
        isConnected: true,
        focus,
      } as unknown as HTMLButtonElement;
      if (route === "becomes-pending") pending = true;
      editor.props.onViewFilings({ member, response }, opener);
      if (route === "ready") {
        expect(navigation.open).toHaveBeenCalledOnce();
        expect(workspace.getSnapshot().research?.section).toBe("filings");
        expect(workspace.filings.getSnapshot().response).toEqual(response);
        expect(mounted.refs[0]!.current).toBe(opener);
        workspace.closeResearch();
        const effectIndex = mounted.effects.length;
        mounted.refIndex = 0;
        ManagedWorkspaceScreen({
          workspace,
          navigation: { ...navigation, returnFocus: 1 },
        });
        mounted.effects[effectIndex]!();
        expect(focus).toHaveBeenCalledOnce();
        expect(model.getSnapshot().selected).toBe(member);
        expect(model.getSnapshot().filings.response).toBe(response);
      } else {
        expect(workspace.getSnapshot().research).toBeNull();
        expect(mounted.refs[0]!.current).toBeNull();
        expect(navigation.open).toHaveBeenCalledTimes(
          route === "navigation-refuses" ? 1 : 0,
        );
      }
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(api.recentFilings).toHaveBeenCalledOnce();
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
    },
  );

  it.each(["annual", "eod", "filings"] as const)(
    "opens watchlist companies in %s, keeps the first opener and saves all notes",
    async (section) => {
      const other = {
        ...payload.memberships[0]!,
        listingId: "listing-two",
        securityId: "security-two",
        shareClassId: "class-two",
        shareClassName: "Class B",
        symbol: "DEMB",
        note: "Other class note",
      };
      const { workspace, api } = fixture({
        ...payload,
        memberships: [...payload.memberships, other],
      });
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      mounted.direct = true;
      const render = () => {
        mounted.refIndex = 0;
        return ManagedWorkspaceScreen({ workspace });
      };
      const origin = { isConnected: true, focus: vi.fn() };
      const opener = editorElements(render()).find(
        (node) =>
          (node.props as { "aria-label"?: string })["aria-label"] ===
          "Annual report for saved DEMO",
      ) as React.ReactElement<{
        onClick: (event: { currentTarget: unknown }) => void;
      }>;
      opener.props.onClick({ currentTarget: origin });
      const company = () =>
        elements(render()).find(
          (node) => node.type === ManagedCompanyResearch,
        ) as React.ReactElement<
          React.ComponentProps<typeof ManagedCompanyResearch>
        >;
      company().props.onSection(section);
      company().props.onNote("First complete note: Café 😀");
      const before = company();
      const second = workspace.coordinator.getSnapshot().draft!.memberships[1]!;
      expect(before.props.canOpenCompany(before.props.research, second)).toBe(
        true,
      );
      before.props.onOpenCompany(before.props.research, second);
      const after = company();
      expect(after.props.research.section).toBe(section);
      expect(after.props.research.selection.listing.listingId).toBe(
        "listing-two",
      );
      expect(after.props.watchlist.member?.note).toBe("Other class note");
      expect(mounted.refs[0]!.current).toBe(origin);
      before.props.onOpenCompany(before.props.research, second);
      before.props.onNote("Stale note must not write");
      expect(workspace.getSnapshot().research).toBe(after.props.research);
      after.props.onNote("Second complete note");
      const latest = company();
      const first = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
      latest.props.onOpenCompany(latest.props.research, first);
      expect(company().props.watchlist.member?.note).toBe(
        "First complete note: Café 😀",
      );
      expect(company().props.research.section).toBe(section);
      expect(mounted.refs[0]!.current).toBe(origin);
      company().props.onBack();
      commitReturnFocus(workspace);
      expect(origin.focus).toHaveBeenCalledOnce();
      expect(workspace.getSnapshot().research).toBeNull();
      workspace.move("listing-two", -1);
      const expected = workspace.coordinator.getSnapshot().draft!;
      expect(expected.memberships.map((m) => [m.listingId, m.note])).toEqual([
        ["listing-two", "Second complete note"],
        ["listing-one", "First complete note: Café 😀"],
      ]);
      vi.mocked(api.save).mockResolvedValue({
        version: 2,
        payload: expected,
        replayed: false,
      });
      await workspace.coordinator.save();
      expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(expected);
      expect(workspace.coordinator.getSnapshot().saved?.payload).toEqual(
        expected,
      );
      for (const read of [
        api.annualReport,
        api.eodHistory,
        api.recentFilings,
        api.resolve,
      ])
        expect(read).not.toHaveBeenCalled();
    },
  );

  it("lets the navigation owner refuse a company change without replacing the opener", async () => {
    const { workspace } = fixture({
      ...payload,
      memberships: Object.values(annualComparisonMemberships),
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const members = workspace.coordinator.getSnapshot().draft!.memberships;
    workspace.openWatchlistAnnual(members[0]!);
    const visit = workspace.getSnapshot().research!;
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      invalid: false,
      returnFocus: 0,
      hasCompanyRoute: () => true,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn(),
      back: vi.fn(),
    };
    mounted.direct = true;
    mounted.refIndex = 0;
    const company = elements(
      ManagedWorkspaceScreen({ workspace, navigation }),
    ).find(
      (node) => node.type === ManagedCompanyResearch,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedCompanyResearch>
    >;
    const original = { isConnected: true, focus: vi.fn() };
    mounted.refs[0]!.current = original;
    company.props.onOpenCompany(visit, members[1]!);
    expect(navigation.open).toHaveBeenCalledOnce();
    expect(workspace.getSnapshot().research).toBe(visit);
    expect(mounted.refs[0]!.current).toBe(original);
  });

  it("adds from a captured discovery visit and fences old note and review controls", async () => {
    const { workspace, api, html } = fixture({ ...payload, memberships: [] });
    const listing = {
      ...payload.memberships[0]!,
      cik: "0000000001",
      matchKind: "current_symbol_exact" as const,
      matchedValue: "DEMO",
    };
    vi.mocked(api.search).mockResolvedValue({
      snapshot,
      results: [listing],
      totalMatches: 1,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    });
    await workspace.coordinator.load();
    await workspace.search();
    workspace.openDiscoveryAnnual(listing);
    mounted.direct = true;
    const company = () => {
      mounted.refIndex = 0;
      return elements(ManagedWorkspaceScreen({ workspace })).find(
        (node) => node.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    };
    const first = company();
    expect(first.props.watchlist.canAdd).toBe(true);
    expect(first.props.watchlist.member).toBeNull();
    workspace.setQuery("Search changed after opening the visit");
    first.props.onAdd();
    expect(company().props.watchlist.member?.note).toBe("");
    company().props.onNote("Draft before reviewing");
    mounted.direct = false;
    const output = html();
    expect(output).toContain('for="managed-research-note"');
    expect(output).toContain("In watchlist draft");
    expect(output).toContain("review and save all changes in My Watchlist.");
    expect(output).toContain("Draft before reviewing");
    const before = workspace.coordinator.getSnapshot().draft;
    workspace.openWatchlistAnnual(before!.memberships[0]!);
    const replacement = workspace.getSnapshot().research;
    first.props.onNote("Stale control must not write");
    first.props.onAdd();
    first.props.onReview();
    expect(workspace.getSnapshot().research).toBe(replacement);
    expect(workspace.coordinator.getSnapshot().draft).toBe(before);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("shows a read-only research note and recovery guidance during an uncertain save", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    workspace.note("listing-one", "Keep the uncertain draft");
    vi.mocked(api.save).mockRejectedValue(new TrialApiError("commit_unknown"));
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot().uncertain).toBe(true);
    const output = html();
    expect(output).toMatch(
      /<textarea\b[^>]*id="managed-research-note"[^>]*disabled=""/u,
    );
    expect(output).toContain("Keep the uncertain draft");
    expect(output).toContain("Review in My Watchlist");
    expect(output).not.toContain("Save research note");
  });
  it("moves focus to persistent watchlist navigation when leaving the board action", () => {
    const { workspace } = fixture();
    workspace.setView("markets");
    mounted.direct = true;
    const node = ManagedWorkspaceScreen({ workspace });
    const focus = vi.fn();
    mounted.refs[2]!.current = { focus };
    const board = elements(node).find(
      (element) => element.type === ManagedMarkets,
    )!;
    (board.props as React.ComponentProps<typeof ManagedMarkets>).onWatchlist();
    expect(workspace.getSnapshot().view).toBe("watchlist");
    expect(focus).toHaveBeenCalledOnce();
    expect(workspace.markets.getSnapshot().active).toBe(false);
  });
  it.each([
    ["annual", "screen", "identity"],
    ["eod", "screen", "identity"],
    ["annual", "native", "identity"],
    ["eod", "native", "identity"],
    ["annual", "screen", "notes"],
    ["eod", "screen", "notes"],
    ["annual", "native", "notes"],
    ["eod", "native", "notes"],
  ] as const)(
    "retains local watchlist search through %s research and %s Back in %s scope, then saves the full draft",
    async (start, back, scope) => {
      const native = back === "native" ? nativeBackFixture() : null;
      const { workspace, api } = fixture({
        ...payload,
        memberships: [
          payload.memberships[0]!,
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            symbol: "OTHER",
          },
        ],
      });
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      workspace.setQuery("DEMO");
      workspace.note("listing-one", "Keep the navigation draft");
      workspace.move("listing-two", -1);
      const draft = workspace.coordinator.getSnapshot().draft;
      mounted.direct = true;
      const render = () => {
        mounted.refIndex = 0;
        return ManagedWorkspaceScreen({
          workspace,
          ...(native ? { androidBack: native.adapter } : {}),
        });
      };
      const first = render();
      if (native) {
        mountEffects();
        native.ready();
      }
      const label = `${start === "annual" ? "Annual report" : "EOD close history"} for saved DEMO`;
      const choice = editorElements(first).find(
        (node) =>
          (node.props as { "data-watchlist-selection"?: string })[
            "data-watchlist-selection"
          ] === "listing-one",
      ) as React.ReactElement<React.ComponentProps<"button">>;
      choice.props.onClick!({} as React.MouseEvent<HTMLButtonElement>);
      const searchInput = (screen: React.ReactNode) =>
        editorElements(screen).find(
          (node) =>
            (node.props as React.ComponentProps<"input">).id ===
            "managed-watchlist-search",
        ) as React.ReactElement<React.ComponentProps<"input">>;
      const searchScope = (screen: React.ReactNode) =>
        editorElements(screen).find(
          (node) =>
            (node.props as React.ComponentProps<"select">).id ===
            "managed-watchlist-search-scope",
        ) as React.ReactElement<React.ComponentProps<"select">>;
      expect(searchScope(first).props.value).toBe("identity");
      if (scope === "notes")
        searchScope(first).props.onChange!({
          target: { value: scope },
        } as React.ChangeEvent<HTMLSelectElement>);
      const query = scope === "notes" ? "private research" : "OTHER";
      searchInput(first).props.onChange!({
        target: { value: query },
      } as React.ChangeEvent<HTMLInputElement>);
      expect(searchInput(first).props.value).toBe(query);
      expect(searchScope(first).props.value).toBe(scope);
      const assertNoteContext = () => {
        const contexts = editorElements(render()).filter(
          (node) =>
            (node.props as { "data-watchlist-note-context"?: string })[
              "data-watchlist-note-context"
            ],
        );
        expect(contexts).toHaveLength(scope === "notes" ? 1 : 0);
        if (scope === "notes") {
          expect(contexts[0]!.props).toMatchObject({
            "data-watchlist-note-context": "listing-two",
          });
          expect(renderToStaticMarkup(contexts[0])).toContain(
            "Note: Private research note",
          );
        }
      };
      assertNoteContext();
      const opener = editorElements(first).find(
        (node) =>
          node.type === "button" &&
          (node.props as { "aria-label"?: string })["aria-label"] === label,
      ) as React.ReactElement<{
        onClick: (event: { currentTarget: unknown }) => void;
      }>;
      expect(opener).toBeDefined();
      const origin = { isConnected: true, focus: vi.fn() };
      opener.props.onClick({ currentTarget: origin });
      const company = () =>
        elements(render()).find(
          (node) => node.type === ManagedCompanyResearch,
        ) as React.ReactElement<
          React.ComponentProps<typeof ManagedCompanyResearch>
        >;
      const selection = company().props.research.selection;
      const opposite = start === "annual" ? "eod" : "annual";
      company().props.onSection(opposite);
      expect(company().props.research.section).toBe(opposite);
      expect(company().props.research.selection).toBe(selection);
      expect(workspace.annual.getSnapshot().selection?.listing.listingId).toBe(
        "listing-one",
      );
      expect(workspace.eod.getSnapshot().selection?.listing.listingId).toBe(
        "listing-one",
      );
      expect(mounted.refs[0]!.current).toBe(origin);
      company().props.onSection(start);
      expect(company().props.research.section).toBe(start);
      expect(company().props.research.selection).toBe(selection);
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(workspace.getSnapshot().query).toBe("DEMO");
      expect(
        watchlistEditor(render())!.props.memberships.map(
          (member) => member.note,
        ),
      ).toEqual(["Private research note", "Keep the navigation draft"]);
      expect(
        editorElements(render())
          .filter((node) => node.type === ManagedNoteEditor)
          .map((node) => (node.props as { note: string }).note),
      ).toEqual(["Keep the navigation draft"]);
      expect(origin.focus).not.toHaveBeenCalled();
      const current = company();
      const watchlistPane = (screen: React.ReactNode) =>
        elements(screen).find(
          (node) =>
            node.type === "section" &&
            (node.props as React.ComponentProps<"section">)[
              "aria-labelledby"
            ] === "managed-watchlist-heading",
        ) as React.ReactElement<React.ComponentProps<"section">>;
      expect(watchlistPane(render()).props.hidden).toBe(true);
      if (native) native.press(false);
      else current.props.onBack();
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.eod.getSnapshot().selection).toBeNull();
      expect(origin.focus).not.toHaveBeenCalled();
      expect(mounted.refs[0]!.current).toBe(origin);
      commitReturnFocus(
        workspace,
        (screen) => {
          expect(watchlistPane(screen).props.hidden).toBe(false);
          expect(origin.focus).not.toHaveBeenCalled();
        },
        native?.adapter,
      );
      expect(origin.focus).toHaveBeenCalledOnce();
      expect(mounted.refs[0]!.current).toBeNull();
      expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
      expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.save).not.toHaveBeenCalled();
      expect(api.search).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
      expect(api.recentFilings).not.toHaveBeenCalled();
      expect(api.load).toHaveBeenCalledOnce();
      expect(api.status).toHaveBeenCalledOnce();
      const returnedEditor = editorElements(render());
      expect(searchInput(render()).props.value).toBe(query);
      expect(searchScope(render()).props.value).toBe(scope);
      assertNoteContext();
      expect(
        returnedEditor
          .filter(
            (node) =>
              (node.props as { "data-watchlist-selection"?: string })[
                "data-watchlist-selection"
              ],
          )
          .map(
            (node) =>
              (node.props as { "data-watchlist-selection": string })[
                "data-watchlist-selection"
              ],
          ),
      ).toEqual(["listing-two"]);
      expect(
        returnedEditor.find((node) => node.type === ManagedNoteEditor)?.props,
      ).toMatchObject({
        listingId: "listing-one",
        id: "managed-note-1",
        note: "Keep the navigation draft",
      });
      vi.mocked(api.save).mockImplementation((command) =>
        Promise.resolve({
          version: 2,
          payload: command.payload,
          replayed: false,
        }),
      );
      await workspace.coordinator.save();
      expect(api.save).toHaveBeenCalledOnce();
      expect(vi.mocked(api.save).mock.calls[0]![0].payload.memberships).toEqual(
        draft!.memberships,
      );
      expect(searchInput(render()).props.value).toBe(query);
      expect(searchScope(render()).props.value).toBe(scope);
      assertNoteContext();
      expect(api.load).toHaveBeenCalledOnce();
      expect(api.status).toHaveBeenCalledOnce();
      if (native) {
        native.press(false);
        expect(native.historyBack).not.toHaveBeenCalled();
        expect(native.adapter.exitApp).not.toHaveBeenCalled();
        expect(origin.focus).toHaveBeenCalledOnce();
      }
    },
  );
  it.each(["Use saved version", "Keep my draft"] as const)(
    "recomputes note-search results from the complete payload after %s",
    async (choice) => {
      const initial: MainWatchlistPayload = {
        ...payload,
        memberships: [
          payload.memberships[0]!,
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            symbol: "OTHER",
            note: "Second exact note",
          },
        ],
      };
      const { workspace, api } = fixture(initial);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      workspace.note("listing-one", "Café 東京 thesis draft");
      const draft = workspace.coordinator.getSnapshot().draft!;
      mounted.direct = true;
      const render = () => {
        mounted.refIndex = 0;
        mounted.screenStateIndex = 0;
        return ManagedWorkspaceScreen({ workspace });
      };
      const field = (id: string) =>
        editorElements(render()).find(
          (node) => (node.props as { id?: string }).id === id,
        ) as React.ReactElement<{
          value: string;
          onChange: (event: { target: { value: string } }) => void;
        }>;
      const matches = () =>
        editorElements(render())
          .map(
            (node) =>
              (node.props as { "data-watchlist-selection"?: string })[
                "data-watchlist-selection"
              ],
          )
          .filter(Boolean);
      field("managed-watchlist-search-scope").props.onChange({
        target: { value: "notes" },
      });
      field("managed-watchlist-search").props.onChange({
        target: { value: "CAFÉ" },
      });
      expect(matches()).toEqual(["listing-one"]);
      vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
      await workspace.coordinator.save();
      const latest: MainWatchlistPayload = {
        ...initial,
        memberships: [
          { ...initial.memberships[0]!, note: "Revised first note" },
          { ...initial.memberships[1]!, note: "Café saved on another device" },
        ],
      };
      vi.mocked(api.load).mockResolvedValueOnce({
        version: 3,
        payload: latest,
      });
      await workspace.coordinator.load();
      expect(matches()).toEqual(["listing-one"]);
      const button = elements(render()).find(
        (node) => node.type === "button" && node.props.children === choice,
      ) as React.ReactElement<React.ComponentProps<"button">>;
      button.props.onClick!({
        currentTarget: { ownerDocument: { activeElement: null } },
      } as React.MouseEvent<HTMLButtonElement>);
      expect(matches()).toEqual([
        choice === "Use saved version" ? "listing-two" : "listing-one",
      ]);
      const contexts = editorElements(render()).filter(
        (node) =>
          (node.props as { "data-watchlist-note-context"?: string })[
            "data-watchlist-note-context"
          ],
      );
      expect(contexts).toHaveLength(1);
      expect(renderToStaticMarkup(contexts[0])).toContain(
        choice === "Use saved version"
          ? "Note: Café saved on another device"
          : "Note: Café 東京 thesis draft",
      );
      expect(field("managed-watchlist-search-scope").props.value).toBe("notes");
      expect(field("managed-watchlist-search").props.value).toBe("CAFÉ");
      expect(workspace.coordinator.getSnapshot().draft).toEqual(
        choice === "Use saved version" ? latest : draft,
      );
      expect(
        editorElements(render()).find((node) => node.type === ManagedNoteEditor)
          ?.props,
      ).toMatchObject({
        listingId: "listing-one",
        note:
          choice === "Use saved version"
            ? "Revised first note"
            : "Café 東京 thesis draft",
      });
      expect(api.save).toHaveBeenCalledOnce();
      expect(vi.mocked(api.save).mock.calls[0]![0].payload).toEqual(draft);
      expect(api.load).toHaveBeenCalledTimes(2);
      expect(api.search).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
      expect(api.annualReport).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.recentFilings).not.toHaveBeenCalled();
      expect(api.economicCalendar).not.toHaveBeenCalled();
      workspace.coordinator.retire();
      expect(editorElements(render())).toEqual([]);
      expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    },
  );
  it("renders one company section and reuses both loaded packets through repeated button returns", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Keep this company note" },
      ],
    });
    const prices = eodResponse();
    const report = await annualResponse();
    vi.mocked(api.eodHistory).mockResolvedValue(prices);
    vi.mocked(api.annualReport).mockResolvedValue(report);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const draftBeforeSections = workspace.coordinator.getSnapshot().draft;
    mounted.direct = true;
    const render = () => {
      mounted.refIndex = 0;
      return ManagedWorkspaceScreen({ workspace });
    };
    const origin = { isConnected: true, focus: vi.fn() };
    const opener = editorElements(render()).find(
      (node) =>
        node.type === "button" &&
        (node.props as { "aria-label"?: string })["aria-label"] ===
          "EOD close history for saved ZERO",
    ) as React.ReactElement<{
      onClick: (event: { currentTarget: unknown }) => void;
    }>;
    opener.props.onClick({ currentTarget: origin });
    const company = () =>
      elements(render()).find(
        (node) => node.type === ManagedCompanyResearch,
      ) as React.ReactElement<
        React.ComponentProps<typeof ManagedCompanyResearch>
      >;
    const section = (name: "Price" | "Annual") => {
      const control = elements(ManagedCompanyResearch(company().props)).find(
        (node) =>
          node.type === "button" &&
          (node.props as { "aria-label"?: string })["aria-label"] ===
            `${name} section for ZERO`,
      ) as React.ReactElement<{ onClick: () => void; "aria-pressed": boolean }>;
      return control.props;
    };
    const html = () => {
      const node = company();
      mounted.direct = false;
      try {
        return renderToStaticMarkup(node);
      } finally {
        mounted.direct = true;
      }
    };
    const identity = company().props.research.selection;
    expect(html()).toContain("Company research · ZERO");
    for (const label of ["Zero Company", "Zero Class A", "Class A", "XNAS"])
      expect(html()).toContain(label);
    expect(section("Price")["aria-pressed"]).toBe(true);
    expect(section("Annual")["aria-pressed"]).toBe(false);
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    await workspace.eod.load();
    const priceState = workspace.eod.getSnapshot();
    const priceHtml = html();
    expect(priceHtml).toContain(prices.completedAt);
    expect(priceHtml).toContain(prices.window.startDate);
    expect(priceHtml).not.toContain('class="managed-annual-report"');
    expect(priceHtml).not.toContain('aria-label="On this report"');
    section("Price").onClick();
    expect(workspace.eod.getSnapshot()).toBe(priceState);
    section("Annual").onClick();
    expect(section("Annual")["aria-pressed"]).toBe(true);
    expect(section("Price")["aria-pressed"]).toBe(false);
    expect(html()).not.toContain('class="managed-eod-history"');
    expect(html()).not.toContain('aria-label="On this report"');
    expect(api.annualReport).not.toHaveBeenCalled();
    await workspace.annual.load();
    const annualState = workspace.annual.getSnapshot();
    const annualHtml = html();
    expect(annualHtml).toContain('aria-label="On this report"');
    expect(annualHtml).toContain(report.evidence.generation.completedAt);
    expect(annualHtml.match(/Back to workspace/gu)).toHaveLength(1);
    expect(annualHtml.match(/id="managed-company-heading"/gu)).toHaveLength(1);
    section("Annual").onClick();
    expect(workspace.annual.getSnapshot()).toBe(annualState);
    // Cross-section sources and snapshot gain Annual data; detail panels stay exact.
    const sourceActionsMarkup = (markup: string) =>
      markup.match(
        /<section class="managed-company-evidence-actions"[\s\S]*?<\/section>(?=<details class="managed-company-snapshot">)/u,
      )?.[0];
    const existingCompanyMarkup = (markup: string) =>
      markup
        .replace(sourceActionsMarkup(markup) ?? "", "")
        .replace(
          /<details class="managed-company-snapshot">[\s\S]*?<\/details>/u,
          "",
        );
    expect(priceHtml).toContain("No annual evidence loaded");
    expect(annualHtml).toContain('aria-label="Snapshot price"');
    expect(annualHtml).toContain(prices.completedAt);
    expect(annualHtml).toContain('aria-label="Snapshot annual"');
    expect(annualHtml).not.toContain("No annual evidence loaded");
    const actionsAfterAnnual = sourceActionsMarkup(annualHtml);
    expect(actionsAfterAnnual).toContain(
      report.evidence.generation.completedAt,
    );
    for (let visit = 0; visit < 2; visit++) {
      section("Price").onClick();
      expect(sourceActionsMarkup(html())).toBe(actionsAfterAnnual);
      expect(existingCompanyMarkup(html())).toBe(
        existingCompanyMarkup(priceHtml),
      );
      expect(html()).toContain(report.evidence.generation.completedAt);
      expect(workspace.eod.getSnapshot()).toBe(priceState);
      section("Annual").onClick();
      expect(html()).toBe(annualHtml);
      expect(workspace.annual.getSnapshot()).toBe(annualState);
      expect(company().props.research.selection).toBe(identity);
    }
    expect(api.eodHistory).toHaveBeenCalledOnce();
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draftBeforeSections);
    expect(mounted.refs[0]!.current).toBe(origin);
    company().props.onBack();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(origin.focus).not.toHaveBeenCalled();
    commitReturnFocus(workspace);
    expect(origin.focus).toHaveBeenCalledOnce();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draftBeforeSections);
  });
  it("opens EOD explicitly beside the unchanged draft and gates stale catalog entries", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "Draft survives close history");
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistEod(member);
    const output = html();
    expect(output).toContain("Company research · DEMO");
    expect(output).toContain("Load one-month close history");
    expect(output).toContain("Draft survives close history");
    expect(output).toContain("My Watchlist");
    expect(api.eodHistory).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    workspace.openWatchlistAnnual(member);
    expect(html()).not.toContain("Load one-month close history");
    expect(html()).toContain("Load annual report");
    vi.mocked(api.status).mockResolvedValue({
      snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
    });
    await workspace.refreshCatalog();
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="EOD close history for saved DEMO"/u,
    );
  });
  it.each([false, true])(
    "native Back consumes a pending EOD panel, restores focus and keeps the draft (history %s)",
    async (canGoBack) => {
      const native = nativeBackFixture();
      const { workspace, api } = fixture();
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.note("listing-one", "Keep my EOD draft");
      mounted.direct = true;
      ManagedWorkspaceScreen({ workspace, androidBack: native.adapter });
      mountEffects();
      native.ready();
      const focus = vi.fn();
      mounted.refs[0]!.current = { isConnected: true, focus };
      workspace.openWatchlistEod(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!,
      );
      const held = deferred<Awaited<ReturnType<ManagedApi["eodHistory"]>>>();
      vi.mocked(api.eodHistory).mockReturnValue(held.promise);
      const pending = workspace.eod.load();
      const before = workspace.coordinator.getSnapshot().draft;
      native.press(canGoBack);
      expect(vi.mocked(api.eodHistory).mock.calls[0]![1].aborted).toBe(true);
      expect(workspace.eod.getSnapshot()).toMatchObject({
        selection: null,
        response: null,
      });
      expect(workspace.coordinator.getSnapshot().draft).toBe(before);
      expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
      expect(focus).not.toHaveBeenCalled();
      commitReturnFocus(workspace, undefined, native.adapter);
      expect(focus).toHaveBeenCalledOnce();
      expect(native.historyBack).not.toHaveBeenCalled();
      held.resolve(eodResponse());
      await pending;
      expect(workspace.eod.getSnapshot().response).toBeNull();
      native.press(false);
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      native.press(true);
      expect(native.historyBack).not.toHaveBeenCalled();
      mounted.refIndex = 0;
      const leaveReview = ManagedWorkspaceScreen({
        workspace,
        androidBack: native.adapter,
      });
      expect(renderToStaticMarkup(leaveReview)).toContain(
        "Review local changes before leaving",
      );
      const confirm = elements(leaveReview).find(
        (node) =>
          (node.props as React.ComponentProps<"button">).id ===
          "managed-leave-confirm",
      );
      expect(confirm).toBeDefined();
      (confirm!.props as React.ComponentProps<"button">).onClick!(
        {} as React.MouseEvent<HTMLButtonElement>,
      );
      expect(native.historyBack).toHaveBeenCalledOnce();
      expect(api.save).not.toHaveBeenCalled();
    },
  );
  it("keeps the shared Search pending label and editable query by default", () => {
    const output = renderToStaticMarkup(
      <WorkspaceSearch
        query="DEMO"
        busy
        disabled={false}
        onChange={vi.fn()}
        onSearch={vi.fn()}
      />,
    );
    expect(output).toContain(
      '<button type="submit" disabled="">Searching…</button>',
    );
    const input = output.match(/<input\b[^>]*>/u)?.[0];
    expect(input).toBeDefined();
    expect(input).toContain('value="DEMO"');
    expect(input).not.toContain('disabled=""');
  });
  it.each([false, true])(
    "labels a pending catalog status read without calling it Search (existing receipt: %s)",
    async (hasSnapshot) => {
      const { workspace, api, html } = fixture();
      await workspace.coordinator.load();
      if (hasSnapshot) await workspace.refreshCatalog();
      workspace.setQuery("DEMO");
      workspace.note("listing-one", "Draft during catalog read");
      const status = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
      vi.mocked(api.status).mockReturnValueOnce(status.promise);
      const pending = workspace.refreshCatalog();
      const output = html();
      const label = hasSnapshot ? "Refreshing catalog…" : "Loading catalog…";
      expect(output).toContain(`disabled="">${label}</button>`);
      expect(output).toContain(
        '<button type="submit" disabled="">Search</button>',
      );
      expect(output).not.toContain("Searching…");
      const input = output.match(
        /<input\b[^>]*id="workspace-company-query"[^>]*>/u,
      )?.[0];
      expect(input).toBeDefined();
      expect(input).toContain('value="DEMO"');
      expect(input).not.toContain('disabled=""');
      expect(output).toContain("Draft during catalog read");
      expect(output).toContain("Unsaved changes");
      if (hasSnapshot) expect(output).toContain(snapshot.asOf);
      else expect(output).not.toContain("Catalog as of");
      status.resolve({ snapshot });
      await pending;
      expect(html()).toContain('<button type="submit">Search</button>');
      expect(html()).not.toContain(label);
    },
  );
  it("shows explicit startup catalog recovery with the same visible query and draft", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    vi.mocked(api.status).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await workspace.refreshCatalog();
    const failure =
      "The catalog could not be loaded. Select Refresh catalog to try again.";
    const failed = html();
    expect(failed).toContain(failure);
    expect(failed).toContain("Private research note");
    expect(failed).not.toContain("Catalog as of");
    expect(failed).toMatch(
      /<button(?![^>]*disabled=)[^>]*>Refresh catalog<\/button>/u,
    );
    workspace.setQuery("DEMO");
    workspace.note("listing-one", "Draft survives catalog recovery");
    const status = deferred<Awaited<ReturnType<ManagedApi["status"]>>>();
    vi.mocked(api.status).mockReturnValueOnce(status.promise);
    const pending = workspace.refreshCatalog();
    const recovering = html();
    expect(recovering).toContain("Loading catalog…");
    expect(recovering).toContain('value="DEMO"');
    expect(recovering).toContain("Draft survives catalog recovery");
    expect(recovering).toContain("Unsaved changes");
    expect(recovering).not.toContain("Catalog as of");
    status.resolve({ snapshot });
    await pending;
    const recovered = html();
    expect(recovered).not.toContain(failure);
    expect(recovered).toContain('value="DEMO"');
    expect(recovered).toContain("Draft survives catalog recovery");
    expect(recovered).toContain("Unsaved changes");
    expect(recovered).toContain(
      `2 available listings · Catalog as of ${snapshot.asOf}`,
    );
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.status).toHaveBeenCalledTimes(2);
    expect(api.search).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });
  it("keeps Search pending and recovery feedback distinct from the dated catalog", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setQuery("DEMO");
    workspace.note("listing-one", "Draft survives search failure");
    const search = deferred<Awaited<ReturnType<ManagedApi["search"]>>>();
    vi.mocked(api.search).mockReturnValueOnce(search.promise);
    const pending = workspace.search();
    const searching = html();
    expect(searching).toContain(
      '<button type="submit" disabled="">Searching…</button>',
    );
    expect(searching).toContain('disabled="">Refresh catalog</button>');
    expect(searching).not.toContain("Refreshing catalog…");
    const input = searching.match(
      /<input\b[^>]*id="workspace-company-query"[^>]*>/u,
    )?.[0];
    expect(input).toBeDefined();
    expect(input).not.toContain('disabled=""');
    search.reject(new TrialApiError("unavailable"));
    await pending;
    const failure =
      "The search could not be completed. Select Search to try again.";
    const failed = html();
    expect(failed).toContain(failure);
    expect(failed).not.toContain("The catalog could not be loaded.");
    expect(failed).toContain('<button type="submit">Search</button>');
    expect(failed).toContain('value="DEMO"');
    expect(failed).toContain("Draft survives search failure");
    expect(failed).toContain(snapshot.asOf);
    vi.mocked(api.search).mockResolvedValueOnce({
      snapshot,
      results: [],
      totalMatches: 0,
      limitApplied: 25,
      normalizedQuery: "DEMO",
    });
    await workspace.search();
    const recovered = html();
    expect(recovered).not.toContain(failure);
    expect(recovered).toContain("No matching listings in this catalog.");
    expect(recovered).toContain("Draft survives search failure");
    expect(recovered).toContain('value="DEMO"');
    expect(recovered).toContain(snapshot.asOf);
    expect(api.search).toHaveBeenCalledTimes(2);
    expect(api.status).toHaveBeenCalledTimes(1);
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });
  it("directs a failed catalog review to its own existing action", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    vi.mocked(api.resolve).mockRejectedValueOnce(
      new TrialApiError("unavailable"),
    );
    await workspace.reviewCatalog();
    const output = html();
    expect(output).toContain(
      "The catalog review could not be completed. Select Review catalog changes to try again.",
    );
    expect(output).toMatch(
      /<button(?![^>]*disabled=)[^>]*>Review catalog changes<\/button>/u,
    );
    expect(output).toContain(snapshot.asOf);
    expect(output).toContain("Private research note");
    expect(api.save).not.toHaveBeenCalled();
  });
  it("does not install native navigation for the browser screen", () => {
    const native = nativeBackFixture();
    fixture().html();
    mountEffects();
    expect(native.addListener).not.toHaveBeenCalled();
  });
  it("delivers Back to the committed company policy during delayed registration without a route-change subscription gap", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note(
      "listing-one",
      "Exact draft retained through one native Back",
    );
    const draft = workspace.coordinator.getSnapshot().draft!;
    const registration = deferred<{ remove: () => Promise<void> }>();
    const removal = deferred<void>();
    const remove = vi.fn(() => removal.promise);
    let nativeEvent!: (event: { canGoBack: boolean }) => void;
    const addListener = vi.fn<AndroidBackAdapter["addListener"]>(
      (_event, callback) => {
        nativeEvent = callback;
        return registration.promise;
      },
    );
    const adapter: AndroidBackAdapter = { addListener };
    const rootBack = vi.fn();
    const companyBack = vi.fn(() => workspace.closeResearch());
    const discardedBack = vi.fn();
    const root: ManagedCompanyNavigation = {
      invalid: false,
      pending: false,
      isPending: () => false,
      returnFocus: 0,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn(() => true),
      back: rootBack,
      hasCompanyRoute: () => false,
    };
    const screen = committedNativeScreen(workspace);
    screen.render(adapter, root);
    screen.commit();
    const registeredEvent = nativeEvent;
    workspace.openWatchlistAnnual(draft.memberships[0]!);
    const company = { ...root, back: companyBack, hasCompanyRoute: () => true };
    screen.render(adapter, company);
    screen.commit();
    // A pending render must not publish its handler to the native subscription.
    screen.render(adapter, { ...company, back: discardedBack });
    registeredEvent({ canGoBack: true });
    expect(companyBack).toHaveBeenCalledOnce();
    expect(rootBack).not.toHaveBeenCalled();
    expect(discardedBack).not.toHaveBeenCalled();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(addListener).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    for (const request of [
      api.annualReport,
      api.eodHistory,
      api.recentFilings,
      api.save,
    ])
      expect(request).not.toHaveBeenCalled();
    screen.discard();
    workspace.coordinator.retire();
    registeredEvent({ canGoBack: false });
    expect(companyBack).toHaveBeenCalledOnce();
    registration.resolve({ remove });
    await Promise.resolve();
    expect(remove).toHaveBeenCalledOnce();
    removal.resolve();
  });
  it("keeps pending navigation guarded and fences a replaced adapter while its native removal is delayed", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const draft = workspace.coordinator.getSnapshot().draft!;
    workspace.openWatchlistAnnual(draft.memberships[0]!);
    const visit = workspace.getSnapshot().research;
    const first = nativeBackFixture();
    const second = nativeBackFixture();
    const oldRemoval = deferred<void>();
    first.remove.mockImplementation(() => oldRemoval.promise);
    const pendingBack = vi.fn();
    const settledBack = vi.fn(() => workspace.closeResearch());
    const pending: ManagedCompanyNavigation = {
      invalid: false,
      pending: true,
      isPending: () => true,
      returnFocus: 0,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn(() => true),
      // The router's pending Back policy deliberately does not navigate.
      back: pendingBack,
      hasCompanyRoute: () => true,
    };
    const screen = committedNativeScreen(workspace);
    screen.render(first.adapter, pending);
    screen.commit();
    first.press(true);
    expect(pendingBack).toHaveBeenCalledOnce();
    expect(workspace.getSnapshot().research).toBe(visit);
    const settled = {
      ...pending,
      pending: false,
      isPending: () => false,
      back: settledBack,
    };
    screen.render(second.adapter, settled);
    screen.commit();
    first.press(true);
    expect(pendingBack).toHaveBeenCalledOnce();
    expect(settledBack).not.toHaveBeenCalled();
    first.ready();
    await Promise.resolve();
    expect(first.remove).toHaveBeenCalledOnce();
    // The replacement remains usable while the old removal promise is unresolved.
    second.press(true);
    expect(settledBack).toHaveBeenCalledOnce();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(first.addListener).toHaveBeenCalledOnce();
    expect(second.addListener).toHaveBeenCalledOnce();
    workspace.coordinator.retire();
    second.press(true);
    second.ready();
    await Promise.resolve();
    expect(settledBack).toHaveBeenCalledOnce();
    expect(second.remove).toHaveBeenCalledOnce();
    oldRemoval.resolve();
    for (const request of [
      api.annualReport,
      api.eodHistory,
      api.recentFilings,
      api.save,
    ])
      expect(request).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "consumes Annual Back before native history (%s), restores focus and preserves the draft",
    async (canGoBack) => {
      const native = nativeBackFixture();
      const initial = {
        ...payload,
        memberships: [
          payload.memberships[0]!,
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            symbol: "OTHER",
          },
        ],
      };
      const { workspace } = fixture(initial);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.note("listing-one", "Unsaved native note");
      workspace.move("listing-two", -1);
      mounted.direct = true;
      ManagedWorkspaceScreen({ workspace, androidBack: native.adapter });
      mountEffects();
      native.ready();
      const focus = vi.fn();
      mounted.refs[0]!.current = { isConnected: true, focus };
      workspace.openWatchlistAnnual(
        workspace.coordinator.getSnapshot().draft!.memberships[1]!,
      );
      const before = structuredClone(workspace.coordinator.getSnapshot().draft);
      native.press(canGoBack);
      expect(workspace.annual.getSnapshot().selection).toBeNull();
      expect(workspace.coordinator.getSnapshot().draft).toEqual(before);
      expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
      expect(focus).not.toHaveBeenCalled();
      commitReturnFocus(workspace, undefined, native.adapter);
      expect(focus).toHaveBeenCalledOnce();
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      native.press(false);
      expect(native.historyBack).not.toHaveBeenCalled();
      native.press(true);
      expect(native.historyBack).not.toHaveBeenCalled();
      mounted.refIndex = 0;
      const leaveReview = ManagedWorkspaceScreen({
        workspace,
        androidBack: native.adapter,
      });
      expect(renderToStaticMarkup(leaveReview)).toContain(
        "Review local changes before leaving",
      );
      const confirm = elements(leaveReview).find(
        (node) =>
          (node.props as React.ComponentProps<"button">).id ===
          "managed-leave-confirm",
      );
      expect(confirm).toBeDefined();
      (confirm!.props as React.ComponentProps<"button">).onClick!(
        {} as React.MouseEvent<HTMLButtonElement>,
      );
      expect(native.historyBack).toHaveBeenCalledOnce();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
    },
  );
  it("native Back aborts a pending read and fences its late result while restoring fallback focus", async () => {
    const native = nativeBackFixture();
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    mounted.direct = true;
    ManagedWorkspaceScreen({ workspace, androidBack: native.adapter });
    mountEffects();
    native.ready();
    const focus = vi.fn();
    mounted.refs[0]!.current = { isConnected: false, focus: vi.fn() };
    mounted.refs[1]!.current = { focus };
    workspace.openWatchlistAnnual(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    let complete!: (
      value: Awaited<ReturnType<ManagedApi["annualReport"]>>,
    ) => void;
    vi.mocked(api.annualReport).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const pending = workspace.annual.load();
    const signal = vi.mocked(api.annualReport).mock.calls[0]![1];
    native.press(false);
    expect(signal.aborted).toBe(true);
    expect(focus).not.toHaveBeenCalled();
    commitReturnFocus(workspace, undefined, native.adapter);
    expect(focus).toHaveBeenCalledOnce();
    complete(await annualResponse());
    await pending;
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(workspace.annual.getSnapshot().selection).toBeNull();
    expect(native.historyBack).not.toHaveBeenCalled();
  });
  it.each(["retire", "unmount"] as const)(
    "fences %s immediately and removes late registration once",
    async (reason) => {
      const native = nativeBackFixture();
      const { workspace, html } = fixture();
      await workspace.coordinator.load();
      html(native.adapter);
      mountEffects();
      if (reason === "retire") workspace.coordinator.retire();
      else mounted.cleanups[0]!();
      native.press(true);
      native.press(false);
      native.ready();
      await Promise.resolve();
      expect(native.historyBack).not.toHaveBeenCalled();
      expect(native.adapter.exitApp).not.toHaveBeenCalled();
      expect(native.remove).toHaveBeenCalledOnce();
      mounted.cleanups[0]!();
      expect(native.remove).toHaveBeenCalledOnce();
    },
  );
  it("keeps the watchlist mounted beside an explicit annual panel and gates old catalog entries", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "Draft survives Back");
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    const output = html();
    expect(output).toContain("Company research · DEMO");
    expect(output).toContain("Load annual report");
    expect(output).toContain("Back to workspace");
    expect(output).toContain("My Watchlist");
    expect(output).toContain("Draft survives Back");
    expect(output).toContain("Unsaved changes");
    expect(api.annualReport).not.toHaveBeenCalled();
    workspace.closeResearch();
    expect(html()).not.toContain("Load annual report");
    expect(html()).toContain("Draft survives Back");
    vi.mocked(api.status).mockResolvedValue({
      snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
    });
    await workspace.refreshCatalog();
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Annual report for saved DEMO"/u,
    );
    expect(html()).toContain(
      "before adding, saving or opening an annual report",
    );
  });
  it("renders the reused accessible search and full exact-listing editing controls", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    const output = html();
    expect(output).toContain('aria-label="Find a company"');
    expect(output).toContain('maxLength="128"');
    expect(output).toContain("Discover");
    expect(output).toContain("My Watchlist");
    expect(output).toContain("Invented issuer");
    expect(output).toContain("Class A");
    expect(output).toContain("XNAS");
    expect(output).toContain("Listing ID: listing-one");
    expect(output).toContain('for="managed-note-0"');
    expect(output).toContain("Private research note");
    expect(output).toContain('aria-label="Move DEMO up"');
    expect(output).toContain('aria-label="Remove DEMO"');
    expect(output).toContain("Save watchlist");
    expect(output).toContain("Review catalog changes");
    expect(output).toContain("Sign out this session");
    expect(output).toContain('aria-live="polite"');
  });

  it("reviews every raw draft change outside local search and retains it through research", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    const raw = `  Hidden draft Café 😀\n${"x".repeat(2001)}  `;
    workspace.note("listing-one", raw);
    const retained = workspace.coordinator.getSnapshot().draft;
    mounted.direct = true;
    const render = () => {
      mounted.refIndex = 0;
      mounted.screenStateIndex = 0;
      return ManagedWorkspaceScreen({ workspace });
    };
    const searchInput = () =>
      editorElements(render()).find(
        (node) =>
          (node.props as React.ComponentProps<"input">).id ===
          "managed-watchlist-search",
      ) as React.ReactElement<React.ComponentProps<"input">>;
    searchInput().props.onChange!({
      target: { value: "no matching listing" },
    } as React.ChangeEvent<HTMLInputElement>);
    expect(
      editorElements(render()).filter(
        (node) =>
          (node.props as { "data-watchlist-selection"?: string })[
            "data-watchlist-selection"
          ],
      ),
    ).toHaveLength(0);
    const review = () =>
      elements(render()).find(
        (node) => node.type === ManagedUnsavedWatchlistReview,
      ) as
        | React.ReactElement<
            React.ComponentProps<typeof ManagedUnsavedWatchlistReview>
          >
        | undefined;
    const output = renderToStaticMarkup(review());
    expect(output).toContain("1 changed listing");
    expect(output).toContain("Private research note");
    expect(output).toContain(raw);
    expect(review()!.props.state.draft).toBe(retained);
    workspace.openWatchlistAnnual(retained!.memberships[0]!);
    expect(workspace.getSnapshot().research).not.toBeNull();
    expect(renderToStaticMarkup(review())).toBe(output);
    workspace.closeResearch();
    expect(searchInput().props.value).toBe("no matching listing");
    expect(workspace.coordinator.getSnapshot().draft).toBe(retained);
    expect(renderToStaticMarkup(review())).toBe(output);
    workspace.coordinator.retire();
    expect(review()).toBeUndefined();
    expect(workspace.coordinator.getSnapshot().draft).toBeNull();
    expect(api.load).toHaveBeenCalledOnce();
    expect(api.status).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.search).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("compares real payloads after undo, rejected save and confirmed save without a reload", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.setView("watchlist");
    workspace.note("listing-one", "Changed note");
    workspace.note("listing-one", "Private research note");
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(html()).toContain(
      "No differences from last confirmed saved version 1.",
    );
    workspace.note("listing-one", "Changed note");
    const retained = structuredClone(workspace.coordinator.getSnapshot().draft);
    vi.mocked(api.save).mockRejectedValueOnce(
      new TrialApiError("invalid_request"),
    );
    await workspace.coordinator.save();
    expect(workspace.coordinator.getSnapshot().draft).toEqual(retained);
    expect(html()).toContain("Review unsaved changes · 1 changed listing");
    expect(html()).toContain("Private research note");
    const save = deferred<Awaited<ReturnType<ManagedApi["save"]>>>();
    vi.mocked(api.save).mockReturnValueOnce(save.promise);
    const saving = workspace.coordinator.save();
    const pending = html();
    expect(pending).toContain('id="managed-unsaved-review-summary"');
    expect(pending).toContain(
      "Saving the watchlist. This review updates when the save settles.",
    );
    expect(pending).not.toContain("data-managed-review-listing-id");
    save.resolve({ version: 2, payload: retained!, replayed: false });
    await saving;
    expect(workspace.coordinator.getSnapshot()).toMatchObject({
      dirty: false,
      latestLoaded: false,
    });
    expect(html()).toContain(
      "No differences from last confirmed saved version 2.",
    );
    expect(html()).not.toContain("data-managed-review-listing-id");
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(api.load).toHaveBeenCalledOnce();
    expect(api.status).toHaveBeenCalledOnce();
    expect(api.search).not.toHaveBeenCalled();
    expect(api.resolve).not.toHaveBeenCalled();
  });

  it.each(["conflict", "unavailable", "replayed"] as const)(
    "defers the ordinary comparison to real %s save recovery",
    async (outcome) => {
      const { workspace, api, html } = fixture();
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.note("listing-one", "Retained recovery draft");
      if (outcome === "replayed") {
        vi.mocked(api.save).mockImplementationOnce((command) =>
          Promise.resolve({
            version: 2,
            payload: command.payload,
            replayed: true,
          }),
        );
      } else {
        vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError(outcome));
      }
      await workspace.coordinator.save();
      const output = html();
      expect(output).toContain('id="managed-unsaved-review-summary"');
      expect(output).toContain(
        "Finish save recovery above before reviewing further changes.",
      );
      expect(output).not.toContain("data-managed-review-listing-id");
      expect(
        workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
      ).toBe("Retained recovery draft");
      expect(api.save).toHaveBeenCalledOnce();
      expect(api.load).toHaveBeenCalledOnce();
      expect(api.status).toHaveBeenCalledOnce();
    },
  );

  it("clears private notes, query and controls immediately on retirement", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    workspace.setQuery("Private search");
    workspace.coordinator.retire();
    const output = html();
    expect(output).not.toContain("Private research note");
    expect(output).not.toContain("Private search");
    expect(output).not.toContain("textarea");
    expect(output).not.toContain("managed-note-reading");
    expect(output).not.toContain("Find a company");
    expect(output).not.toContain("Save watchlist");
    expect(output).not.toContain("managed-unsaved-review");
    expect(output).toContain("local watchlist data has been cleared");
  });

  it("presents the latest saved notes before the explicit conflict choices", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    workspace.note("listing-one", "My changed draft");
    await workspace.coordinator.load();
    const output = html();
    expect(output).toContain("My changed draft");
    expect(output).toContain("Private research note");
    expect(output).toContain("Saved version 1");
    expect(output).toContain("Use saved version");
    expect(output).toContain("Keep my draft");
    expect(output).toContain("the next save replaces this saved version");
  });

  it.each(["Use saved version", "Keep my draft"] as const)(
    "returns keyboard focus to My Watchlist after %s removes its review",
    async (choice) => {
      const f = await recoveryFocusFixture();
      f.choose(choice)();
      expect(f.heading.focus).not.toHaveBeenCalled();
      // The focused recovery choice is removed by this commit.
      f.document.activeElement = f.document.body;
      const screen = f.commit();
      expect(
        elements(screen).some(
          (node) => node.type === "button" && node.props.children === choice,
        ),
      ).toBe(false);
      expect(f.heading.focus).toHaveBeenCalledOnce();
      const title = elements(screen).find(
        (node) =>
          (node.props as { id?: string }).id === "managed-watchlist-heading",
      );
      expect((title?.props as React.ComponentProps<"h2">).tabIndex).toBe(-1);
      f.commit();
      expect(f.heading.focus).toHaveBeenCalledOnce();
      expect(f.api.save).toHaveBeenCalledOnce();
      expect(f.api.load).toHaveBeenCalledTimes(2);
      const result = f.workspace.coordinator.getSnapshot();
      expect(result.conflict).toBe(false);
      expect(result.draft?.memberships).toHaveLength(
        choice === "Use saved version" ? 0 : 1,
      );
    },
  );

  it.each(["pending transition", "arriving valid route"] as const)(
    "does not restore recovery focus before the parent applies the %s",
    async (change) => {
      const hasCompanyRoute = vi.fn(() => false);
      const navigation: ManagedCompanyNavigation = {
        pending: false,
        isPending: () => false,
        hasCompanyRoute,
        invalid: false,
        returnFocus: 0,
        open: vi.fn(),
        section: vi.fn(),
        view: vi.fn(() => true),
        back: vi.fn(),
      };
      const f = await recoveryFocusFixture(navigation);
      f.choose("Keep my draft")();
      f.document.activeElement = f.document.body;
      // The child commits while the parent route effect has not updated the model.
      const discovery = f.workspace.getSnapshot();
      expect(discovery.view).toBe("watchlist");
      expect(discovery.companyRoute).toBeNull();
      expect(discovery.research).toBeNull();
      if (change === "pending transition")
        hasCompanyRoute.mockReturnValue(true);
      f.commit(
        change === "pending transition"
          ? navigation
          : { ...navigation, hasCompanyRoute: () => true },
      );
      expect(f.workspace.getSnapshot()).toBe(discovery);
      expect(f.heading.focus).not.toHaveBeenCalled();
      hasCompanyRoute.mockReturnValue(false);
      f.commit(navigation);
      expect(f.heading.focus).not.toHaveBeenCalled();
    },
  );

  it.each(["Use saved version", "Keep my draft"] as const)(
    "does not queue focus for %s during a pending or failed fresh read",
    async (choice) => {
      const f = await recoveryFocusFixture();
      const choose = f.choose(choice);
      const read = deferred<Awaited<ReturnType<ManagedApi["load"]>>>();
      vi.mocked(f.api.load).mockReturnValueOnce(read.promise);
      const pending = f.workspace.coordinator.load();
      const loading = f.workspace.coordinator.getSnapshot();
      choose();
      expect(f.workspace.coordinator.getSnapshot()).toBe(loading);
      f.document.activeElement = f.document.body;
      f.commit();
      read.reject(new TrialApiError("unavailable"));
      await pending;
      const failed = f.workspace.coordinator.getSnapshot();
      choose();
      expect(f.workspace.coordinator.getSnapshot()).toBe(failed);
      f.commit();
      await f.workspace.coordinator.load();
      f.commit();
      expect(f.heading.focus).not.toHaveBeenCalled();
      expect(f.api.save).toHaveBeenCalledOnce();
    },
  );

  it.each(["Use saved version", "Keep my draft"] as const)(
    "keeps existing focus when %s is invoked without owning it",
    async (choice) => {
      const f = await recoveryFocusFixture();
      const choose = f.choose(choice);
      f.document.activeElement = {};
      choose();
      f.document.activeElement = f.document.body;
      f.commit();
      expect(f.heading.focus).not.toHaveBeenCalled();
      expect(f.workspace.coordinator.getSnapshot().conflict).toBe(false);
    },
  );

  it.each([
    "focus moved",
    "panel hidden",
    "heading disconnected",
    "heading not visible",
    "view changed and returned",
    "draft changed",
    "session retired",
  ] as const)(
    "consumes the recovery focus request without stealing focus when %s before commit",
    async (change) => {
      const f = await recoveryFocusFixture();
      f.choose("Keep my draft")();
      f.document.activeElement = f.document.body;
      if (change === "focus moved") f.document.activeElement = {};
      if (change === "panel hidden") f.panel.hidden = true;
      if (change === "heading disconnected") f.heading.isConnected = false;
      if (change === "heading not visible")
        f.heading.getClientRects.mockReturnValue([]);
      if (change === "view changed and returned") {
        f.workspace.setView("discover");
        f.workspace.setView("watchlist");
      }
      if (change === "draft changed")
        f.workspace.note("listing-one", "A newer edit");
      if (change === "session retired") f.workspace.coordinator.retire();
      f.commit();
      expect(f.heading.focus).not.toHaveBeenCalled();
      f.document.activeElement = f.document.body;
      f.panel.hidden = false;
      f.heading.isConnected = true;
      f.heading.getClientRects.mockReturnValue([{}]);
      f.commit();
      expect(f.heading.focus).not.toHaveBeenCalled();
    },
  );

  it.each(["Use saved version", "Keep my draft"] as const)(
    "keeps the draft through failed repeat reads before the explicit %s action",
    async (choice) => {
      const initial: MainWatchlistPayload = {
        ...payload,
        memberships: [
          payload.memberships[0]!,
          {
            ...payload.memberships[0]!,
            listingId: "listing-two",
            securityId: "security-two",
            shareClassId: "class-two",
            shareClassName: "Class B",
            note: "Unchanged second note",
          },
        ],
      };
      const { workspace, api, html } = fixture(initial);
      await workspace.coordinator.load();
      await workspace.refreshCatalog();
      workspace.setView("watchlist");
      workspace.note("listing-one", "Retained draft note");
      const retained = structuredClone(
        workspace.coordinator.getSnapshot().draft!,
      );
      vi.mocked(api.save).mockRejectedValueOnce(new TrialApiError("conflict"));
      await workspace.coordinator.save();
      const latest: MainWatchlistPayload = {
        ...initial,
        memberships: [
          initial.memberships[1]!,
          { ...initial.memberships[0]!, note: "New saved note" },
        ],
      };
      vi.mocked(api.load).mockResolvedValueOnce({
        version: 3,
        payload: latest,
      });
      await workspace.coordinator.load();
      const reviewed = html();
      expect(reviewed).toContain("Review saved version 3 and my draft");
      expect(reviewed).toContain("New saved note");
      expect(reviewed).toContain("Retained draft note");
      expect(reviewed).toContain("Order differs");
      expect(reviewed.match(/data-managed-review-listing-id=/gu)).toHaveLength(
        2,
      );
      expect(reviewed).toContain(
        "Finish save recovery above before reviewing further changes.",
      );
      expect(reviewed.indexOf("Review saved version 3")).toBeLessThan(
        reviewed.indexOf("Use saved version"),
      );
      const repeat = deferred<Awaited<ReturnType<ManagedApi["load"]>>>();
      vi.mocked(api.load).mockReturnValueOnce(repeat.promise);
      const loading = workspace.coordinator.load();
      const pending = html();
      expect(pending).not.toContain("managed-version-review-heading");
      expect(pending).not.toContain("Use saved version");
      expect(pending).not.toContain("Keep my draft");
      expect(pending).toContain("Retained draft note");
      repeat.reject(new TrialApiError("unavailable"));
      await loading;
      const failed = html();
      expect(failed).not.toContain("managed-version-review-heading");
      expect(failed).not.toContain("Use saved version");
      expect(failed).not.toContain("Keep my draft");
      expect(failed).toContain("Retained draft note");
      expect(failed).toContain("could not be loaded");
      expect(workspace.coordinator.getSnapshot().draft).toEqual(retained);
      expect(api.save).toHaveBeenCalledTimes(1);
      vi.mocked(api.load).mockResolvedValueOnce({
        version: 4,
        payload: latest,
      });
      await workspace.coordinator.load();
      mounted.direct = true;
      mounted.refIndex = 0;
      const button = elements(ManagedWorkspaceScreen({ workspace })).find(
        (element) =>
          element.type === "button" && element.props.children === choice,
      ) as React.ReactElement<React.ComponentProps<"button">>;
      mounted.direct = false;
      expect(button).toBeDefined();
      button.props.onClick!({
        currentTarget: { ownerDocument: { activeElement: null } },
      } as React.MouseEvent<HTMLButtonElement>);
      expect(html()).not.toContain("managed-version-review-heading");
      expect(api.save).toHaveBeenCalledTimes(1);
      const chosen = workspace.coordinator.getSnapshot();
      expect(chosen).toMatchObject({ conflict: false, baseVersion: 4 });
      if (choice === "Use saved version") {
        expect(chosen.draft).toEqual(latest);
        expect(chosen.dirty).toBe(false);
      } else {
        expect(chosen.draft).toEqual(retained);
        expect(chosen.dirty).toBe(true);
        vi.mocked(api.save).mockImplementationOnce((command) =>
          Promise.resolve({
            version: 5,
            payload: command.payload,
            replayed: false,
          }),
        );
        await workspace.coordinator.save();
        expect(api.save).toHaveBeenCalledTimes(2);
        expect(vi.mocked(api.save).mock.calls[1]?.[0]).toMatchObject({
          expectedVersion: 4,
          payload: retained,
        });
        expect(vi.mocked(api.save).mock.calls[1]?.[0].idempotencyKey).not.toBe(
          vi.mocked(api.save).mock.calls[0]?.[0].idempotencyKey,
        );
      }
      workspace.coordinator.retire();
      const retired = html();
      expect(retired).not.toContain("New saved note");
      expect(retired).not.toContain("Retained draft note");
      expect(retired).not.toContain("Unchanged second note");
    },
  );

  it("uses product copy for managed mode while preserving the default DEMO frame", () => {
    const managed = renderToStaticMarkup(
      <TrialFrame managed>
        <p>Managed workspace</p>
      </TrialFrame>,
    );
    const demo = renderToStaticMarkup(
      <TrialFrame>
        <p>Demo workspace</p>
      </TrialFrame>,
    );
    expect(managed).toContain("Discover companies");
    expect(managed).not.toContain("Synthetic data only");
    expect(managed).toContain("Software licenses");
    expect(demo).toContain("Synthetic data only");
    expect(demo).toContain("isolated trial");
    for (const html of [managed, demo]) {
      expect(html.match(/<main[ >]/gu)).toHaveLength(1);
      expect(html.match(/<h1[ >]/gu)).toHaveLength(1);
      expect(html).not.toContain("managed-skip-link");
    }
  });

  it("places the active content landmark beyond shared controls with the skip link first", () => {
    const { workspace } = fixture();
    const html = renderToStaticMarkup(
      <TrialFrame managed compact>
        <ManagedSessionNotice>
          A new session is active. The earlier server sign-out remains
          unconfirmed.
        </ManagedSessionNotice>
        <ManagedWorkspaceScreen workspace={workspace} />
      </TrialFrame>,
    );
    expect(html.match(/<main[ >]/gu)).toHaveLength(1);
    expect(html.match(/<h1[ >]/gu)).toHaveLength(1);
    expect(html).toContain("earlier server sign-out remains unconfirmed");
    const content = html.match(/<main\b[\s\S]*?<\/main>/u)![0];
    expect(content).toContain('id="managed-workspace-content"');
    expect(content).toContain('tabindex="-1"');
    expect(content).toContain('id="managed-discover-heading"');
    expect(content).not.toContain('aria-label="Workspace"');
    expect(content).not.toContain('role="search"');
    expect(content).not.toContain('id="managed-signout-open"');
    expect(content).not.toContain("Software licenses");
    expect(
      html.match(/<(?:a|button|input|select|textarea)\b[^>]*>/u)?.[0],
    ).toBe('<a class="managed-skip-link" href="#managed-workspace-content">');
    expect(html).toContain("Skip to workspace content</a>");
  });

  it("keeps one main and one h1 during managed entry and workspace creation", () => {
    const { api } = fixture();
    const entry = renderToStaticMarkup(
      <TrialFrame managed>
        <ManagedEntry
          title="Sign in on this device"
          message="Session unavailable."
        >
          <button>Sign in with Clerk</button>
        </ManagedEntry>
      </TrialFrame>,
    );
    const loading = renderToStaticMarkup(
      <TrialFrame managed compact>
        <ManagedSessionScreen
          api={api}
          apiOrigin="https://api.example.invalid"
          session={{
            userId: "invented-loading-user",
            sessionId: "invented-loading-session",
            getToken: vi.fn(),
            signOut: vi.fn(),
          }}
        />
      </TrialFrame>,
    );
    for (const html of [entry, loading]) {
      expect(html.match(/<main[ >]/gu)).toHaveLength(1);
      expect(html.match(/<h1[ >]/gu)).toHaveLength(1);
      expect(html).not.toContain("managed-skip-link");
    }
    expect(entry).toContain("Session unavailable.");
    expect(loading).toContain('<p role="status">Loading your workspace…</p>');
    expect(api.load).not.toHaveBeenCalled();
    expect(api.status).not.toHaveBeenCalled();
  });

  it.each(["markets", "discover", "watchlist", "pending company"] as const)(
    "provides a content target for %s without a data load",
    async (view) => {
      const { workspace, api } = fixture();
      if (view === "pending company")
        await workspace.setCompanyRoute({
          kind: "company",
          listingId: "invented-pending-listing",
          section: "eod",
        });
      else workspace.setView(view);
      const html = renderToStaticMarkup(
        <TrialFrame managed compact>
          <ManagedWorkspaceScreen workspace={workspace} />
        </TrialFrame>,
      );
      expect(html.match(/<main[ >]/gu)).toHaveLength(1);
      expect(html).toContain(
        '<main class="managed-workspace-content" id="managed-workspace-content" tabindex="-1">',
      );
      expect(html).toContain("Skip to workspace content</a>");
      expect(api.load).not.toHaveBeenCalled();
      expect(api.status).not.toHaveBeenCalled();
      expect(api.resolve).not.toHaveBeenCalled();
      expect(api.eodHistory).not.toHaveBeenCalled();
      expect(api.annualReport).not.toHaveBeenCalled();
    },
  );

  it("bypasses into the same current content target without changing a draft, requests or navigation", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "Keep this unsaved draft");
    const navigation: ManagedCompanyNavigation = {
      pending: false,
      isPending: () => false,
      hasCompanyRoute: () => false,
      invalid: false,
      returnFocus: 0,
      open: vi.fn(),
      section: vi.fn(),
      view: vi.fn(),
      back: vi.fn(),
    };
    const content = {
      isConnected: true,
      getClientRects: () => [{}],
      focus: vi.fn(),
      scrollIntoView: vi.fn(),
    };
    const requestCounts = () =>
      (
        [
          "load",
          "save",
          "status",
          "search",
          "resolve",
          "annualReport",
          "eodHistory",
          "economicCalendar",
        ] as const
      ).map((name) => vi.mocked(api[name]).mock.calls.length);
    let previousRef: React.RefObject<HTMLElement | null> | undefined;
    for (const view of [
      "discover",
      "watchlist",
      "research",
      "invalid-link",
    ] as const) {
      if (view === "research")
        workspace.openWatchlistAnnual(
          workspace.coordinator.getSnapshot().draft!.memberships[0]!,
        );
      else if (view === "invalid-link") workspace.closeResearch();
      else workspace.setView(view);
      mounted.direct = true;
      mounted.refIndex = 0;
      const nodes = elements(
        ManagedWorkspaceScreen({
          workspace,
          navigation: { ...navigation, invalid: view === "invalid-link" },
        }),
      );
      mounted.direct = false;
      const main = nodes.find(
        (node) => node.type === "main",
      ) as React.ReactElement<React.ComponentProps<"main">>;
      const ref = main.props.ref as React.RefObject<HTMLElement | null>;
      if (previousRef) expect(ref).toBe(previousRef);
      previousRef = ref;
      ref.current = content as unknown as HTMLElement;
      const skip = nodes.find(
        (node) =>
          node.type === "a" &&
          (node.props as React.ComponentProps<"a">).className ===
            "managed-skip-link",
      ) as React.ReactElement<React.ComponentProps<"a">>;
      const preventDefault = vi.fn();
      const saved = workspace.coordinator.getSnapshot(),
        discovery = workspace.getSnapshot();
      const counts = requestCounts();
      expect(content.focus).toHaveBeenCalledTimes(0);
      skip.props.onClick!({
        preventDefault,
      } as unknown as React.MouseEvent<HTMLAnchorElement>);
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(content.focus).toHaveBeenCalledExactlyOnceWith({
        preventScroll: true,
      });
      expect(content.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        block: "start",
        behavior: "instant",
      });
      expect(workspace.coordinator.getSnapshot()).toBe(saved);
      expect(workspace.getSnapshot()).toBe(discovery);
      expect(requestCounts()).toEqual(counts);
      for (const name of ["open", "section", "view", "back"] as const)
        expect(navigation[name]).not.toHaveBeenCalled();
      content.focus.mockClear();
      content.scrollIntoView.mockClear();
    }
  });

  it.each([
    "missing",
    "disconnected",
    "hidden",
    "retired",
    "signing out",
  ] as const)(
    "does not use a retained skip action when its target is %s",
    async (condition) => {
      const { workspace, html } = fixture();
      const content = {
        isConnected: condition !== "disconnected",
        getClientRects: () => (condition === "hidden" ? [] : [{}]),
        focus: vi.fn(),
        scrollIntoView: vi.fn(),
      };
      mounted.direct = true;
      const nodes = elements(ManagedWorkspaceScreen({ workspace }));
      mounted.direct = false;
      const main = nodes.find(
        (node) => node.type === "main",
      ) as React.ReactElement<React.ComponentProps<"main">>;
      (main.props.ref as React.RefObject<HTMLElement | null>).current =
        condition === "missing" ? null : (content as unknown as HTMLElement);
      const skip = nodes.find(
        (node) => node.type === "a",
      ) as React.ReactElement<React.ComponentProps<"a">>;
      if (condition === "retired") workspace.coordinator.retire();
      const signingOut =
        condition === "signing out"
          ? workspace.coordinator.signOut()
          : undefined;
      const preventDefault = vi.fn();
      skip.props.onClick!({
        preventDefault,
      } as unknown as React.MouseEvent<HTMLAnchorElement>);
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(content.focus).not.toHaveBeenCalled();
      expect(content.scrollIntoView).not.toHaveBeenCalled();
      if (condition === "retired" || condition === "signing out")
        expect(html()).not.toContain("managed-skip-link");
      await signingOut;
    },
  );

  it("shows finite access failure without rendering saved data", async () => {
    const { workspace, api, html } = fixture();
    await workspace.coordinator.load();
    vi.mocked(api.load).mockRejectedValueOnce(
      new TrialApiError("access_denied"),
    );
    await workspace.coordinator.load();
    expect(html()).toContain("cannot access the shared watchlist");
    expect(html()).not.toContain("Private research note");
  });

  it("labels catalog identity changes for people and keeps confirmation accurate after saving", async () => {
    const { workspace, api, html } = fixture();
    const updatedSnapshot: ManagedCatalogSnapshotDto = {
      ...snapshot,
      snapshotSha256: `sha256:${"b".repeat(64)}`,
    };
    vi.mocked(api.status).mockResolvedValue({ snapshot: updatedSnapshot });
    vi.mocked(api.resolve).mockResolvedValue({
      snapshotSha256: updatedSnapshot.snapshotSha256,
      results: [
        {
          listingId: "listing-one",
          listing: {
            country: "US",
            exchangeMic: "XNYS",
            instrumentType: "adr",
            issuerId: "issuer-updated",
            issuerName: "Updated invented issuer",
            listingId: "listing-one",
            securityId: "security-updated",
            securityName: "Updated security",
            shareClassId: "class-updated",
            shareClassName: "Updated share class",
            symbol: "NEXT",
          },
        },
      ],
    });
    vi.mocked(api.save).mockImplementation((command) =>
      Promise.resolve({
        version: command.expectedVersion + 1,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    await workspace.reviewCatalog();
    const review = html();
    for (const [key, label] of [
      ["exchangeMic", "Exchange MIC"],
      ["instrumentType", "Instrument type"],
      ["issuerId", "Issuer ID"],
      ["issuerName", "Company name"],
      ["securityId", "Security ID"],
      ["securityName", "Security name"],
      ["shareClassId", "Share class ID"],
      ["shareClassName", "Share class name"],
      ["symbol", "Ticker"],
    ]) {
      expect(review).toContain(`<dt>${label}</dt>`);
      expect(review).not.toContain(`<dt>${key}</dt>`);
    }
    workspace.applyReview();
    expect(html()).toContain("Catalog changes applied.");
    expect(html()).toContain("Unsaved changes");
    await workspace.coordinator.save();
    expect(html()).toContain("Version 2 · Saved");
    expect(html()).toContain("Catalog changes applied.");
    expect(html()).not.toContain("Save the watchlist to share them");
    expect(html()).toContain("Private research note");
  });

  it("shows the same raw-note error in research and My Watchlist until explicit correction and save", async () => {
    const other = {
      ...payload.memberships[0]!,
      listingId: "listing-two",
      securityId: "security-two",
      shareClassId: "class-two",
      shareClassName: "Class B",
      note: "Keep the other draft",
    };
    const { workspace, api, html } = fixture({
      ...payload,
      memberships: [payload.memberships[0]!, other],
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[1]!,
    );
    const selection = workspace.getSnapshot().research!.selection;
    const raw = "Company draft\nneeds correction";
    workspace.noteResearch(selection, raw);
    const invalid = html();
    expect(invalid).toContain(
      `<p id="managed-research-note-reading-text" class="trial-saved-note">${raw}</p>`,
    );
    const tag = (markup: string, id: string) =>
      markup.match(new RegExp(`<textarea id="${id}"[^>]*>`, "u"))?.[0];
    expect(tag(invalid, "managed-note-0")).not.toContain('aria-invalid="true"');
    expect(tag(invalid, "managed-note-1")).toBeUndefined();
    expect(invalid).toContain("Note needs correction");
    mounted.direct = true;
    mounted.refIndex = 0;
    const screen = ManagedWorkspaceScreen({ workspace });
    const choice = editorElements(screen).find(
      (node) =>
        (node.props as { "data-watchlist-selection"?: string })[
          "data-watchlist-selection"
        ] === "listing-two",
    ) as React.ReactElement<React.ComponentProps<"button">>;
    choice.props.onClick!({} as React.MouseEvent<HTMLButtonElement>);
    const selectedEditors = editorElements(screen).filter(
      (node) => node.type === ManagedNoteEditor,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedNoteEditor>>[];
    mounted.direct = false;
    expect(selectedEditors).toHaveLength(1);
    expect(selectedEditors[0]!.props).toMatchObject({
      listingId: "listing-two",
      note: raw,
    });
    const selectedHtml = renderToStaticMarkup(selectedEditors[0]);
    expect(selectedHtml).toContain(
      `<p id="managed-note-1-reading-text" class="trial-saved-note">${raw}</p>`,
    );
    expect(tag(selectedHtml, "managed-note-1")).toContain(
      'aria-invalid="true"',
    );
    expect(tag(selectedHtml, "managed-note-1")).toContain(
      'aria-describedby="managed-watchlist-note-help managed-note-1-error"',
    );
    expect(tag(invalid, "managed-research-note")).toContain(
      'aria-invalid="true"',
    );
    expect(tag(invalid, "managed-research-note")).toContain(
      'aria-describedby="managed-research-note-help managed-research-note-error"',
    );
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(raw);
    workspace.switchToAnnual();
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(raw);
    expect(workspace.canSavePayload()).toBe(false);
    await workspace.coordinator.save();
    expect(api.save).not.toHaveBeenCalled();
    const corrected = "  Cafe\u0301 research  ";
    workspace.noteResearch(selection, corrected);
    expect(workspace.getResearchWatchlist(selection).member?.note).toBe(
      corrected,
    );
    const valid = html();
    expect(valid).toContain(
      `<p id="managed-research-note-reading-text" class="trial-saved-note">${corrected}</p>`,
    );
    expect(valid).not.toContain('aria-invalid="true"');
    expect(valid).not.toContain('id="managed-note-validation-focus"');
    expect(workspace.canSavePayload()).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
    vi.mocked(api.save).mockImplementation((command) =>
      Promise.resolve({
        version: 2,
        payload: command.payload,
        replayed: false,
      }),
    );
    await workspace.coordinator.save();
    expect(api.save).toHaveBeenCalledOnce();
    expect(workspace.coordinator.getSnapshot().draft!.memberships).toEqual([
      payload.memberships[0]!,
      { ...other, note: "Café research" },
    ]);
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("focuses the current first invalid listing after reorder, removal and correction", async () => {
    const { workspace, api, fields, focus } = await noteFocusFixture();
    focus();
    expect(fields[0]!.focus).toHaveBeenCalledOnce();
    expect(fields[1]!.focus).not.toHaveBeenCalled();
    workspace.note("listing-one", "Corrected first note");
    focus();
    expect(fields[1]!.focus).toHaveBeenCalledOnce();
    expect(workspace.canSavePayload()).toBe(false);
    workspace.note("listing-one", "First\ninvalid");
    workspace.move("listing-two", -1);
    focus();
    expect(fields[1]!.focus).toHaveBeenCalledTimes(2);
    workspace.remove("listing-two");
    focus();
    expect(fields[0]!.focus).toHaveBeenCalledTimes(2);
    workspace.note("listing-one", "Corrected draft");
    focus();
    expect(fields[0]!.focus).toHaveBeenCalledTimes(2);
    expect(fields[1]!.focus).toHaveBeenCalledTimes(2);
    expect(workspace.canSavePayload()).toBe(true);
    expect(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note,
    ).toBe("Corrected draft");
    expect(api.save).not.toHaveBeenCalled();
    expect(api.load).toHaveBeenCalledOnce();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("does not focus a stale, disabled, disconnected or hidden field", async () => {
    const { fields, panel, focus } = await noteFocusFixture();
    const field = fields[0]!;
    const note = field.value;
    field.value = "Older rendered value";
    focus();
    field.value = note;
    field.dataset.managedNoteListingId = "removed-listing";
    focus();
    field.dataset.managedNoteListingId = "listing-one";
    field.disabled = true;
    focus();
    field.disabled = false;
    field.isConnected = false;
    focus();
    field.isConnected = true;
    field.getClientRects.mockReturnValue([]);
    focus();
    field.getClientRects.mockReturnValue([{}]);
    panel.isConnected = false;
    focus();
    panel.isConnected = true;
    panel.hidden = true;
    focus();
    expect(field.focus).not.toHaveBeenCalled();
    expect(fields[1]!.focus).not.toHaveBeenCalled();
    panel.hidden = false;
    focus();
    expect(field.focus).toHaveBeenCalledOnce();
  });

  it("retires a captured focus action on navigation, company visits and session retirement", async () => {
    const { workspace, fields, focus } = await noteFocusFixture();
    workspace.setView("discover");
    focus();
    workspace.setView("watchlist");
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    focus();
    workspace.closeResearch();
    workspace.coordinator.retire();
    focus();
    expect(fields[0]!.focus).not.toHaveBeenCalled();
    expect(fields[1]!.focus).not.toHaveBeenCalled();
  });

  it("disables Save with an explanation for invalid notes, then enables it after correction", async () => {
    const { workspace, html } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.note("listing-one", "x".repeat(2001));
    expect(workspace.canSavePayload()).toBe(false);
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Save watchlist<\/button>/u,
    );
    expect(html()).toContain(
      "Use at most 2,000 characters per note, without control characters.",
    );
    workspace.note("listing-one", "Corrected note");
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
    expect(html()).not.toContain('id="managed-save-issue"');
  });

  it("enables Save at the exact canonical byte limit and explains one extra byte before dispatch", async () => {
    const memberships = Array.from({ length: 32 }, (_, index) => ({
      ...payload.memberships[0]!,
      listingId: `listing-${index}`,
      issuerName: "😀".repeat(128),
      securityName: "😀".repeat(128),
      shareClassName: "😀".repeat(128),
      note: "",
    }));
    const maximum = { ...payload, memberships };
    const bytes = () =>
      new TextEncoder().encode(encodeMainWatchlistPayload(maximum)).byteLength;
    let remaining = 262144 - bytes();
    for (const member of memberships) {
      const astral = Math.min(2000, Math.floor(remaining / 4));
      const ascii = Math.min(2000 - astral, remaining - astral * 4);
      member.note = "😀".repeat(astral) + "x".repeat(ascii);
      remaining -= astral * 4 + ascii;
    }
    expect(remaining).toBe(0);
    expect(bytes()).toBe(262144);
    const { workspace, api, html } = fixture(maximum);
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const last = memberships.at(-1)!;
    workspace.note(last.listingId, last.note);
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
    workspace.note(last.listingId, `${last.note}x`);
    expect(workspace.canSavePayload()).toBe(false);
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Save watchlist<\/button>/u,
    );
    expect(html()).toContain(
      "This watchlist is too large to save. Shorten notes or remove entries.",
    );
    expect(html()).not.toContain('aria-invalid="true"');
    expect(html()).not.toContain('id="managed-note-validation-focus"');
    await workspace.coordinator.save();
    expect(api.save).not.toHaveBeenCalled();
    workspace.note(last.listingId, last.note);
    expect(workspace.canSavePayload()).toBe(true);
    expect(html()).toContain("<button>Save watchlist</button>");
  });
});

it("restores Portfolio research opener focus and retains all three drafts without automatic source or save calls", async () => {
  const f = fixture();
  await f.workspace.coordinator.load();
  await f.workspace.refreshCatalog();
  f.api.loadPortfolio = vi
    .fn<ManagedApi["loadPortfolio"]>()
    .mockResolvedValue({ version: 0, payload: null });
  vi.mocked(f.api.loadFollowups).mockResolvedValue({
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  });
  vi.mocked(f.api.resolve).mockImplementation((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing: listingIdentity(payload.memberships[0]!),
      })),
    }),
  );
  await f.workspace.portfolio.coordinator.load();
  await f.workspace.followups.coordinator.load();
  f.workspace.note("listing-one", "Keep Watchlist raw note");
  f.workspace.followups.add(payload.memberships[0]!, "2026-10-30");
  f.workspace.setView("portfolio");
  f.workspace.portfolio.start("2026-10-01", "1000.00");
  await f.workspace.portfolio.register(
    listingIdentity(payload.memberships[0]!),
  );
  const draft = f.workspace.portfolio.coordinator.getSnapshot().draft!;
  const otherDrafts = [
    f.workspace.coordinator.getSnapshot().draft,
    f.workspace.followups.coordinator.getSnapshot().draft,
  ];
  mounted.direct = true;
  mounted.refIndex = 0;
  const portfolioReviewReportDelivery = { deliver: vi.fn() };
  const screen = ManagedWorkspaceScreen({
    workspace: f.workspace,
    portfolioReviewReportDelivery,
  });
  const entry = elements(screen).find(
    (node) => node.type === ManagedPortfolioEntry,
  ) as React.ReactElement<React.ComponentProps<typeof ManagedPortfolioEntry>>;
  expect(entry).toBeDefined();
  const portfolio = elements(ManagedPortfolioEntry(entry.props)).find(
    (node) => node.type === ManagedPortfolio,
  ) as React.ReactElement<React.ComponentProps<typeof ManagedPortfolio>>;
  expect(portfolio).toBeDefined();
  expect(portfolio.props.reviewReportDelivery).toBe(
    portfolioReviewReportDelivery,
  );
  expect(portfolioReviewReportDelivery.deliver).not.toHaveBeenCalled();
  const opener = { isConnected: true, focus: vi.fn() };
  portfolio.props.onResearch(
    draft,
    draft.ledger!.identities[0]!,
    opener as unknown as HTMLButtonElement,
  );
  mounted.refIndex = 0;
  const company = elements(
    ManagedWorkspaceScreen({ workspace: f.workspace }),
  ).find((node) => node.type === ManagedCompanyResearch) as React.ReactElement<
    React.ComponentProps<typeof ManagedCompanyResearch>
  >;
  company.props.onBack();
  commitReturnFocus(f.workspace);
  expect(opener.focus).toHaveBeenCalledOnce();
  expect(f.workspace.getSnapshot().view).toBe("portfolio");
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(draft);
  expect([
    f.workspace.coordinator.getSnapshot().draft,
    f.workspace.followups.coordinator.getSnapshot().draft,
  ]).toEqual(otherDrafts);
  expect(f.api.eodHistory).not.toHaveBeenCalled();
  expect(f.api.annualReport).not.toHaveBeenCalled();
  expect(f.api.recentFilings).not.toHaveBeenCalled();
  expect(f.api.save).not.toHaveBeenCalled();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});

it("keeps the readable Follow-ups report on the root route without source or save effects", async () => {
  const { workspace, api } = fixture();
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  vi.mocked(api.loadFollowups).mockResolvedValue({
    version: 1,
    payload: { schemaVersion: 1, entries: [] },
  });
  await workspace.followups.coordinator.load();
  workspace.setView("followups");
  const before = [
    workspace.coordinator.getSnapshot(),
    workspace.followups.coordinator.getSnapshot(),
  ] as const;
  let pending = false;
  const navigation: ManagedCompanyNavigation = {
    pending: false,
    isPending: () => pending,
    invalid: false,
    returnFocus: 0,
    hasCompanyRoute: () => false,
    open: vi.fn(),
    section: vi.fn(),
    view: vi.fn(() => false),
    back: vi.fn(),
  };
  const delivery = { deliver: vi.fn() };
  mounted.direct = true;
  mounted.refIndex = 0;
  const screen = ManagedWorkspaceScreen({
    workspace,
    navigation,
    followupsReviewReportDelivery: delivery,
  });
  const entry = elements(screen).find(
    (node) => node.type === ManagedFollowupsEntry,
  ) as React.ReactElement<React.ComponentProps<typeof ManagedFollowupsEntry>>;
  const followups = elements(ManagedFollowupsEntry(entry.props)).find(
    (node) => node.type === ManagedResearchFollowups,
  ) as React.ReactElement<
    React.ComponentProps<typeof ManagedResearchFollowups>
  >;
  expect(followups.props.followupsReviewReportDelivery).toBe(delivery);
  expect(followups.props.draftFileRouteActive?.()).toBe(true);
  pending = true;
  expect(followups.props.draftFileRouteActive?.()).toBe(false);
  pending = false;
  workspace.sessionOwner.dispose();
  expect(followups.props.draftFileRouteActive?.()).toBe(false);
  expect(delivery.deliver).not.toHaveBeenCalled();
  expect(api.eodHistory).not.toHaveBeenCalled();
  expect(api.annualReport).not.toHaveBeenCalled();
  expect(api.recentFilings).not.toHaveBeenCalled();
  expect(api.save).not.toHaveBeenCalled();
  expect(api.saveFollowups).not.toHaveBeenCalled();
  expect(before[0]?.draft?.memberships).toEqual(payload.memberships);
  expect(before[1]?.draft?.entries).toEqual([]);
  mounted.direct = false;
});
