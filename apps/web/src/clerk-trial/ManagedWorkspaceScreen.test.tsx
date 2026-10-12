import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeMainWatchlistPayload,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
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
} from "../features/research/sec-annual-evidence-fixture";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { ManagedCompanyResearch } from "./ManagedCompanyResearch";
import { ManagedMarkets } from "./ManagedMarkets";
import { ManagedResearchNote } from "./ManagedResearchNote";
import { ManagedNoteEditor } from "./ManagedNoteEditor";
import {
  ManagedWatchlistEditor,
  type ManagedWatchlistEditorHandle,
} from "./ManagedWatchlistEditor";
import { economicCalendarFixture } from "./economic-calendar-fixture";
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
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useEffect: (effect: () => (() => void) | void) =>
      mounted.editorDirect
        ? mounted.editorEffects.push(effect)
        : mounted.effects.push(effect),
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
        if (index >= 2) return [value, vi.fn()];
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
      mounted.direct
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
function fixture(initial = payload) {
  const api: ManagedApi = {
    economicCalendar: vi.fn(),
    eodHistory: vi.fn(),
    annualReport: vi.fn(),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockResolvedValue({ version: 1, payload: initial }),
    save: vi.fn(),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    search: vi.fn(),
    resolve: vi.fn(),
  };
  const workspace = new ManagedWorkspace(api, {
    userId: "synthetic-user",
    sessionId: "synthetic-session",
    getToken: vi.fn(),
    signOut: vi.fn(),
  });
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
  return [
    node,
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
        typeof node.type === "function" && node.type !== ManagedNoteEditor
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
    workspace.setView("watchlist");
    expect(html()).not.toContain("bea-release-agenda");
    workspace.setView("markets");
    expect(html()).toContain("Invented October release");
    expect(read).toHaveBeenCalledTimes(2);
    workspace.coordinator.retire();
    expect(html()).not.toContain("bea-release-agenda");
    expect(workspace.agenda.getSnapshot().agenda).toBeNull();
  });
  it("binds the Price action to the captured visit and latest shared note without saving or loading", async () => {
    const { workspace, api } = fixture({
      ...payload,
      memberships: [
        { ...eodSelection.listing, note: "Original thesis" },
        payload.memberships[0]!,
      ],
    });
    const prices = eodResponse();
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
    expect(captured.getAction(prices, prices.rows[0]!).canAppend).toBe(true);
    company().props.onNote("x".repeat(2000));
    expect(
      company().props.priceNoteActions.getAction(prices, prices.rows[0]!)
        .canAppend,
    ).toBe(false);
    company().props.onNote("  Latest Cafe\u0301 thesis  ");
    const other = workspace.coordinator.getSnapshot().draft!.memberships[1];
    expect(captured.append(prices, prices.rows[0]!)).toEqual({
      appended: true,
      message:
        "Price comparison added to the note draft. Review and save all changes in My Watchlist.",
    });
    const note =
      workspace.coordinator.getSnapshot().draft!.memberships[0]!.note;
    expect(note.startsWith("  Latest Cafe\u0301 thesis   ")).toBe(true);
    expect(note).toContain(prices.rows[0]!.close);
    expect(note).toContain(prices.rows.at(-1)!.close);
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
    expect(actions.append(prices, prices.rows[0]!).appended).toBe(false);
    workspace.switchToEod();
    await workspace.eod.load();
    expect(actions.append(prices, prices.rows[0]!).appended).toBe(false);
    workspace.closeResearch();
    workspace.openWatchlistEod(member);
    vi.mocked(api.eodHistory).mockResolvedValueOnce(next);
    await workspace.eod.load();
    expect(actions.append(next, next.rows[0]!).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.save).not.toHaveBeenCalled();
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
    const pair = report.evidence.resolution.bases.flatMap(
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
    const pair = report.evidence.resolution.bases.flatMap(
      (basis) => basis.pairs,
    )[0]!;
    const draft = workspace.coordinator.getSnapshot().draft;
    await workspace.annual.load();
    expect(actions.append(report, pair).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    workspace.closeResearch();
    workspace.openWatchlistAnnual(draft!.memberships[0]!);
    const nextPair = next.evidence.resolution.bases.flatMap(
      (basis) => basis.pairs,
    )[0]!;
    expect(actions.append(next, nextPair).appended).toBe(false);
    expect(workspace.coordinator.getSnapshot().draft).toBe(draft);
    expect(api.annualReport).toHaveBeenCalledTimes(2);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
  });

  it("coordinates company section, Back and watchlist review through URL navigation", async () => {
    const { workspace, api } = fixture();
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    workspace.openWatchlistEod(
      workspace.coordinator.getSnapshot().draft!.memberships[0]!,
    );
    const navigation: ManagedCompanyNavigation = {
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

  it("uses the route Back action while company metadata is still pending", async () => {
    const { workspace, api } = fixture();
    const native = nativeBackFixture();
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: "listing-one",
      section: "annual",
    });
    const navigation: ManagedCompanyNavigation = {
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
    expect(focus).toHaveBeenCalledOnce();
    expect(workspace.coordinator.getSnapshot().dirty).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
    expect(api.annualReport).not.toHaveBeenCalled();
    expect(api.eodHistory).not.toHaveBeenCalled();
    mounted.direct = false;
    expect(html()).toContain("Edited from the watchlist row");
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
    ["annual", "screen"],
    ["eod", "screen"],
    ["annual", "native"],
    ["eod", "native"],
  ] as const)(
    "retains local watchlist search through %s research and %s Back, then saves the full draft",
    async (start, back) => {
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
      searchInput(first).props.onChange!({
        target: { value: "OTHER" },
      } as React.ChangeEvent<HTMLInputElement>);
      expect(searchInput(first).props.value).toBe("OTHER");
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
      expect(api.load).toHaveBeenCalledOnce();
      expect(api.status).toHaveBeenCalledOnce();
      const returnedEditor = editorElements(render());
      expect(searchInput(render()).props.value).toBe("OTHER");
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
      expect(searchInput(render()).props.value).toBe("OTHER");
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
    section("Price").onClick();
    expect(workspace.eod.getSnapshot()).toBe(priceState);
    section("Annual").onClick();
    expect(section("Annual")["aria-pressed"]).toBe(true);
    expect(section("Price")["aria-pressed"]).toBe(false);
    expect(html()).not.toContain('class="managed-eod-history"');
    expect(api.annualReport).not.toHaveBeenCalled();
    await workspace.annual.load();
    const annualState = workspace.annual.getSnapshot();
    const annualHtml = html();
    expect(annualHtml).toContain(report.evidence.generation.completedAt);
    expect(annualHtml.match(/Back to workspace/gu)).toHaveLength(1);
    expect(annualHtml.match(/id="managed-company-heading"/gu)).toHaveLength(1);
    section("Annual").onClick();
    expect(workspace.annual.getSnapshot()).toBe(annualState);
    for (let visit = 0; visit < 2; visit++) {
      section("Price").onClick();
      expect(html()).toBe(priceHtml);
      expect(workspace.eod.getSnapshot()).toBe(priceState);
      section("Annual").onClick();
      expect(html()).toBe(annualHtml);
      expect(workspace.annual.getSnapshot()).toBe(annualState);
      expect(company().props.research.selection).toBe(identity);
    }
    expect(api.eodHistory).toHaveBeenCalledOnce();
    expect(api.annualReport).toHaveBeenCalledOnce();
    expect(api.save).not.toHaveBeenCalled();
    expect(mounted.refs[0]!.current).toBe(origin);
    company().props.onBack();
    expect(workspace.getSnapshot().research).toBeNull();
    expect(workspace.eod.getSnapshot().response).toBeNull();
    expect(workspace.annual.getSnapshot().response).toBeNull();
    expect(origin.focus).not.toHaveBeenCalled();
    commitReturnFocus(workspace);
    expect(origin.focus).toHaveBeenCalledOnce();
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
