import type * as React from "react";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  type MainWatchlistPayload,
  type ManagedCatalogSnapshotDto,
  type ManagedResearchFollowupsDto,
} from "@research-cockpit/contracts";
import {
  annualComparisonCashRows,
  annualComparisonMemberships as members,
  annualComparisonResponse,
  annualComparisonRows,
  viewOf,
} from "./test-canonical-annual-comparison-fixture";
import { TrialApiError } from "./api";
import { eodSelection } from "./eod-history-fixture";
import type { ManagedApi } from "./managed-api";
import { ManagedWorkspace } from "./managed-workspace";
import { ManagedWatchlistAnnualComparison } from "./ManagedWatchlistAnnualComparison";
import { ManagedWatchlistAnnualComparisonNoteAction } from "./ManagedWatchlistAnnualComparisonNoteAction";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import { prepareCompanyReport } from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import type { TrialSession } from "./session";

// Node element/SSR harness: drives actual component callbacks with retained hook
// state. It does not establish browser DOM, focus, disclosure or native behavior.
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  stateIndex: 0,
  refIndex: 0,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useId: () => "cash-margin-comparison",
  useLayoutEffect: () => undefined,
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useRef: (value: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: value }),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] =
          typeof next === "function"
            ? (next as (prior: unknown) => unknown)(hooks.states[index])
            : next;
      },
    ];
  },
}));

const digest = `sha256:${"a".repeat(64)}` as const;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented-cash-comparison",
  catalogVersion: "invented-version",
  acquiredAt: "2026-09-19T00:00:00.000Z",
  generatedAt: "2026-09-20T00:00:00.000Z",
  asOf: "2026-09-20T00:00:00.000Z",
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
    issuers: 2,
    providerMappings: 2,
    quarantinedSourceRecords: 0,
    sourceRecords: 2,
    staleSourceRecords: 0,
    shareClasses: 2,
    totalSecurities: 2,
    unsupportedSourceRecords: 0,
  },
};
type Side = "left" | "right";
type Packet = Awaited<ReturnType<typeof annualComparisonResponse>>;

async function packet(side: Side, replacement = false): Promise<Packet> {
  const current = annualComparisonRows(side).find(
    (row) => row.metric === "revenue",
  )!;
  const revenues =
    side === "left" ? ["1000", "500", "250"] : ["750", "400", "200"];
  return annualComparisonResponse(side, {
    rows: PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.map((concept, index) => ({
      ...current,
      concept,
      value: revenues[index]!,
    })),
    cashRows: annualComparisonCashRows(side).map((row) => ({
      ...row,
      value:
        side === "right"
          ? row.value
          : row.metric === "ppe_purchases"
            ? "20.025"
            : replacement
              ? "0"
              : "120.125",
    })),
    cutoffAt:
      side === "left" ? "2026-09-20T00:00:00.000Z" : "2026-09-21T00:00:00.000Z",
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

async function fixture() {
  const payload: MainWatchlistPayload = {
    schemaVersion: 1,
    name: "My Watchlist",
    snapshotSha256: digest,
    memberships: [members.left, members.right],
  };
  const followups: ManagedResearchFollowupsDto = {
    version: 1,
    payload: {
      schemaVersion: 1,
      entries: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          catalogSnapshotSha256: digest,
          listing: { ...eodSelection.listing },
          check: "Review cash source",
          dueOn: "2026-10-20",
          status: "open",
          completedOn: null,
          result: "",
        },
      ],
    },
  };
  const unexpected = () =>
    Promise.reject(new Error("Unexpected composed fixture request"));
  const api: ManagedApi = {
    loadPortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    savePortfolio: () =>
      Promise.reject(
        new Error("Portfolio requires an explicit fixture action"),
      ),
    annualReport: vi
      .fn<ManagedApi["annualReport"]>()
      .mockImplementation(unexpected),
    eodHistory: vi
      .fn<ManagedApi["eodHistory"]>()
      .mockImplementation(unexpected),
    recentFilings: vi
      .fn<ManagedApi["recentFilings"]>()
      .mockImplementation(unexpected),
    economicCalendar: vi
      .fn<ManagedApi["economicCalendar"]>()
      .mockImplementation(unexpected),
    monetaryAnnouncements: vi
      .fn<ManagedApi["monetaryAnnouncements"]>()
      .mockImplementation(unexpected),
    search: vi.fn<ManagedApi["search"]>().mockImplementation(unexpected),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation(unexpected),
    status: vi.fn<ManagedApi["status"]>().mockResolvedValue({ snapshot }),
    load: vi
      .fn<ManagedApi["load"]>()
      .mockResolvedValue({ version: 1, payload }),
    save: vi.fn<ManagedApi["save"]>().mockImplementation(unexpected),
    loadFollowups: vi
      .fn<ManagedApi["loadFollowups"]>()
      .mockResolvedValue(followups),
    saveFollowups: vi
      .fn<ManagedApi["saveFollowups"]>()
      .mockImplementation(unexpected),
  };
  const session: TrialSession = {
    userId: "invented-cash-user",
    sessionId: "invented-cash-session",
    getToken: vi.fn(),
    signOut: vi.fn<TrialSession["signOut"]>().mockResolvedValue(),
  };
  const workspace = new ManagedWorkspace(api, session);
  workspace.setView("watchlist");
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  await workspace.followups.coordinator.load();
  workspace.note(
    members.left.listingId,
    "  Unsaved cash thesis Café 東京 😀  ",
  );
  workspace.followups.edit(
    workspace.followups.coordinator.getSnapshot().draft!.entries[0]!,
    "check",
    "  Independent follow-up 東京 😀  ",
  );
  const draft = workspace.coordinator.getSnapshot().draft!;
  const followupDraft = workspace.followups.coordinator.getSnapshot().draft!;
  expect(draft.memberships[0]!.note).toBe(
    "  Unsaved cash thesis Café 東京 😀  ",
  );
  expect(followupDraft.entries[0]!.check).toBe(
    "  Independent follow-up 東京 😀  ",
  );
  return {
    api,
    session,
    workspace,
    model: workspace.annualComparison,
    draft,
    followupDraft,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

function render(f: Fixture) {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  const tree = ManagedWatchlistAnnualComparison({
    model: f.model,
    active: f.model.getSnapshot().active,
    editable: true,
    memberships: f.workspace.coordinator.getSnapshot().draft?.memberships ?? [],
    noteActions: {
      getAction: (capture, destination) =>
        f.workspace.getAnnualComparisonNoteAction(capture, destination),
      append: (capture, destination) =>
        f.workspace.appendAnnualComparisonToNote(capture, destination),
      review: () => {
        throw new Error("No note review is requested in this journey");
      },
    },
    onOpenReport: (capture) => f.workspace.openAnnualComparisonReport(capture),
  });
  return { tree, html: renderToStaticMarkup(tree) };
}
type SelectProps = {
  children?: ReactNode;
  id?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
};
function selectControl(
  node: ReactNode,
  suffix: string,
): React.ChangeEventHandler<HTMLSelectElement> | undefined {
  if (Array.isArray(node))
    return node
      .map((child: ReactNode) => selectControl(child, suffix))
      .find(Boolean);
  if (!isValidElement<SelectProps>(node)) return undefined;
  if (node.type === ManagedWatchlistAnnualComparisonNoteAction)
    return undefined;
  if (typeof node.type === "function")
    return selectControl(
      (node.type as (props: SelectProps) => ReactNode)(node.props),
      suffix,
    );
  if (node.type === "select" && node.props.id?.endsWith(suffix))
    return node.props.onChange;
  return selectControl(node.props.children, suffix);
}
function chooseBasis(f: Fixture, side: Side, value: string) {
  const change = selectControl(render(f).tree, `-${side}-basis`);
  expect(change).toBeTypeOf("function");
  change!({ currentTarget: { value } } as React.ChangeEvent<HTMLSelectElement>);
}
function cashRows(html: string) {
  return [
    ...html.matchAll(
      /<tr data-annual-comparison-cash-margin="([^"]+)">([\s\S]*?)<\/tr>/gu,
    ),
  ];
}
function assertRows(html: string, replacement = false) {
  const rows = cashRows(html);
  expect(rows.map((row) => row[1])).toEqual(
    PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS,
  );
  const margins = replacement
    ? ["-2.00", "-4.01", "-8.01"]
    : ["10.01", "20.02", "40.04"];
  rows.forEach((row, index) => {
    const cells = [...row[2]!.matchAll(/<td>([\s\S]*?)<\/td>/gu)].map(
      (cell) => cell[1]!,
    );
    expect(cells).toHaveLength(2);
    expect(cells[0]).toContain(`>${["1000", "500", "250"][index]}<`);
    expect(cells[1]).toContain(`>${["750", "400", "200"][index]}<`);
    expect(cells[0]).toContain(`>${margins[index]}%<`);
    expect(cells[1]).toContain(`>${["80.00", "150.00", "300.00"][index]}%<`);
    expect(cells[0]).toContain("2025-01-01 to 2025-12-31");
    expect(cells[1]).toContain("2024-07-01 to 2025-06-30");
    for (const cell of cells)
      expect(cell).toContain("Within current-use limits at this load.");
  });
}
function assertSources(html: string, packets: readonly Packet[]) {
  expect(html.match(/<summary>Cash margin inputs · /gu) ?? []).toHaveLength(6);
  expect(html).not.toMatch(
    /<details[^>]*class="[^"]*sec-annual-cash-margin-inputs[^"]*"[^>]*open/u,
  );
  for (const [index, packet] of packets.entries()) {
    const side = index === 0 ? "left" : "right";
    const start = html.indexOf(
      `data-annual-comparison-cash-margin-source="${side}"`,
    );
    const end = html.indexOf(
      `data-annual-comparison-liquidity-source="${side}"`,
      start,
    );
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const ownInputs = html.slice(start, end);
    expect(
      ownInputs.match(/<summary>Cash margin inputs · /gu) ?? [],
    ).toHaveLength(3);
    const { evidence } = packet;
    expect(viewOf(packet).income.resolution.currentTargetEligible).toBe(false);
    expect(
      viewOf(packet).operatingResults.resolution.operatingIncome.status,
    ).toBe("unavailable");
    for (const row of [
      ...evidence.facts.observations.filter(
        (row) =>
          PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some(
            (concept) => concept === row.concept,
          ) ||
          row.concept === "NetIncomeLoss" ||
          row.concept === "NetCashProvidedByUsedInOperatingActivities" ||
          row.concept === "PaymentsToAcquirePropertyPlantAndEquipment",
      ),
    ]) {
      expect(ownInputs).toContain(row.id);
      expect(ownInputs).toContain(row.sourceLocator);
      expect(ownInputs).toContain(row.accessionNumber);
    }
    for (const clock of [
      evidence.generation.cutoffAt,
      evidence.generation.completedAt,
      evidence.generation.sources.companyFacts.fetchedAt,
      evidence.generation.sources.submissions.fetchedAt,
    ])
      expect(ownInputs).toContain(clock);
    expect(ownInputs).not.toContain(
      index === 0 ? "0000000002-25-000001" : "0000000001-26-000001",
    );
    expect(ownInputs).not.toContain(
      index === 0 ? "2026-09-21T00:00:00.000Z" : "2026-09-20T00:00:00.000Z",
    );
  }
}
function assertDrafts(f: Fixture) {
  expect(f.workspace.coordinator.getSnapshot().dirty).toBe(true);
  expect(f.workspace.coordinator.getSnapshot().draft).toEqual(f.draft);
  expect(f.workspace.followups.coordinator.getSnapshot().dirty).toBe(true);
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
    f.followupDraft,
  );
}
function assertIo(f: Fixture, annual: number, catalogs = 1) {
  expect(f.api.annualReport).toHaveBeenCalledTimes(annual);
  expect(f.api.status).toHaveBeenCalledTimes(catalogs);
  expect(f.api.load).toHaveBeenCalledOnce();
  expect(f.api.loadFollowups).toHaveBeenCalledOnce();
  for (const call of [
    f.api.save,
    f.api.saveFollowups,
    f.api.eodHistory,
    f.api.recentFilings,
    f.api.economicCalendar,
    f.api.monetaryAnnouncements,
    f.api.search,
    f.api.resolve,
    f.session.getToken,
    f.session.signOut,
  ])
    expect(call).not.toHaveBeenCalled();
}

async function retainedAndReplacement(
  f: Fixture,
  left: Packet,
  replacement: Packet,
) {
  const selected = f.model.getSnapshot().left.selected!;
  vi.mocked(f.api.annualReport).mockRejectedValueOnce(
    new TrialApiError("unavailable"),
  );
  await f.model.load("left", selected);
  expect(f.model.getSnapshot().left.report).toMatchObject({
    response: left,
    showingPrevious: true,
    error: true,
  });
  expect(f.model.getSnapshot().left.report.response).toBe(left);
  assertRows(render(f).html);
  assertDrafts(f);
  assertIo(f, 3);
  const held = deferred<Packet>();
  vi.mocked(f.api.annualReport).mockReturnValueOnce(held.promise);
  const loading = f.model.load("left", selected);
  f.model.getSnapshot().pending!.cancel();
  expect(vi.mocked(f.api.annualReport).mock.calls[3]![1].aborted).toBe(true);
  held.resolve(replacement);
  await loading;
  expect(f.model.getSnapshot().left.report.response).toBe(left);
  assertRows(render(f).html);
  assertIo(f, 4);
  vi.mocked(f.api.annualReport).mockResolvedValueOnce(replacement);
  await f.model.load("left", selected);
  expect(f.model.getSnapshot().left.report.response).toBe(replacement);
  expect(
    f.model.canAdmitReport({ side: "left", member: selected, response: left }),
  ).toBe(false);
  assertRows(render(f).html, true);
  assertDrafts(f);
  assertIo(f, 5);
}
async function reportAndBack(f: Fixture, replacement: Packet) {
  const pair = f.model.getSnapshot();
  f.workspace.openAnnualComparisonReport({
    side: "left",
    member: pair.left.selected!,
    response: replacement,
  });
  await vi.waitFor(() =>
    expect(f.workspace.annual.getSnapshot().checkingSeed).toBe(false),
  );
  expect(f.workspace.annual.getSnapshot().response).toEqual(replacement);
  const selection = f.workspace.getSnapshot().research!.selection;
  const evidence = companySnapshotEvidence(
    selection,
    f.workspace.eod.getSnapshot(),
    f.workspace.annual.getSnapshot(),
    f.workspace.filings.getSnapshot(),
  );
  const report = prepareCompanyReport(
    selection,
    evidence,
    f.workspace.getResearchWatchlist(selection),
    () => new Date("2026-10-16T00:00:00.000Z"),
  );
  expect(report).not.toBeNull();
  const document = formatCompanyReportDocument(report!);
  expect(document).not.toBeNull();
  const captured: unknown = JSON.parse(document!.text);
  expect(captured).toHaveProperty("sources.annual.response", replacement);
  expect(captured).toHaveProperty("sources.price.status", "not_loaded");
  expect(captured).toHaveProperty("sources.filings.status", "not_loaded");
  expect(captured).toHaveProperty(
    "authoredResearch.note",
    f.draft.memberships[0]!.note,
  );
  f.workspace.closeResearch();
  for (const side of ["left", "right"] as const) {
    expect(f.model.getSnapshot()[side].selected).toBe(pair[side].selected);
    expect(f.model.getSnapshot()[side].report.response).toBe(
      pair[side].report.response,
    );
  }
  assertRows(render(f).html, true);
  assertDrafts(f);
  assertIo(f, 5);
}
async function clearBoundaries(f: Fixture, replacement: Packet, right: Packet) {
  const stale = f.model.getSnapshot().left.selected!;
  f.model.select("left", f.model.getSnapshot(), null);
  await f.model.load("left", stale);
  expect(f.model.getSnapshot().left.report.response).toBeNull();
  assertIo(f, 5);
  f.model.select(
    "left",
    f.model.getSnapshot(),
    f.model.getSnapshot().memberships[0]!,
  );
  vi.mocked(f.api.annualReport).mockResolvedValueOnce(replacement);
  await f.model.load("left", f.model.getSnapshot().left.selected!);
  f.workspace.remove(members.left.listingId);
  expect(f.model.getSnapshot().left.selected).toBeNull();
  expect(f.model.getSnapshot().left.report.response).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toEqual(
    f.followupDraft,
  );
  f.workspace.coordinator.replaceDraft(f.draft);
  const held = deferred<Packet>();
  vi.mocked(f.api.annualReport).mockReturnValueOnce(held.promise);
  const loading = f.model.load("right", f.model.getSnapshot().right.selected!);
  vi.mocked(f.api.status).mockResolvedValueOnce({
    snapshot: { ...snapshot, snapshotSha256: `sha256:${"b".repeat(64)}` },
  });
  await f.workspace.refreshCatalog();
  expect(vi.mocked(f.api.annualReport).mock.calls[6]![1].aborted).toBe(true);
  held.resolve(right);
  await loading;
  for (const side of ["left", "right"] as const)
    expect(f.model.getSnapshot()[side].report.response).toBeNull();
  assertDrafts(f);
  assertIo(f, 7, 2);
  await f.workspace.refreshCatalog();
  f.model.select(
    "left",
    f.model.getSnapshot(),
    f.model.getSnapshot().memberships[0]!,
  );
  const late = deferred<Packet>();
  vi.mocked(f.api.annualReport).mockReturnValueOnce(late.promise);
  const retiring = f.model.load("left", f.model.getSnapshot().left.selected!);
  f.workspace.sessionOwner.retire();
  expect(vi.mocked(f.api.annualReport).mock.calls[7]![1].aborted).toBe(true);
  late.resolve(replacement);
  await retiring;
  expect(f.model.getSnapshot()).toMatchObject({
    active: false,
    pending: null,
    memberships: [],
    left: { selected: null, report: { response: null } },
    right: { selected: null, report: { response: null } },
  });
  expect(f.workspace.coordinator.getSnapshot().draft).toBeNull();
  expect(f.workspace.followups.coordinator.getSnapshot().draft).toBeNull();
  assertIo(f, 8, 3);
}

describe("cash margin comparison through the real workspace", () => {
  it("keeps independent decoded bases and both drafts through retained reads, Cancel, replacement, report Back and lifetime clearing", async () => {
    hooks.states = [];
    hooks.refs = [];
    const f = await fixture();
    try {
      const left = await packet("left"),
        right = await packet("right"),
        replacement = await packet("left", true);
      const unloaded = cashRows(render(f).html);
      expect(unloaded).toHaveLength(3);
      expect(
        unloaded.every(
          (row) => (row[2]!.match(/Not loaded/gu) ?? []).length === 2,
        ),
      ).toBe(true);
      for (const [side, index, response] of [
        ["left", 0, left],
        ["right", 1, right],
      ] as const) {
        const selected = f.model.getSnapshot().memberships[index]!;
        f.model.select(side, f.model.getSnapshot(), selected);
        vi.mocked(f.api.annualReport).mockResolvedValueOnce(response);
        await f.model.load(side, selected);
      }
      const original = render(f).html;
      assertRows(original);
      assertSources(original, [left, right]);
      assertDrafts(f);
      assertIo(f, 2);
      chooseBasis(f, "left", "SalesRevenueNet");
      chooseBasis(f, "right", "Revenues");
      const changed = render(f).html;
      expect(cashRows(changed).map((row) => row[0])).toEqual(
        cashRows(original).map((row) => row[0]),
      );
      expect(changed).toContain("revenue/net-income pair unavailable");
      expect(changed).toContain(
        'data-annual-comparison-selected-basis="left">Selected basis: Net sales revenue',
      );
      expect(changed).toContain(
        'data-annual-comparison-selected-basis="right">Selected basis: Revenue',
      );
      f.workspace.setView("discover");
      f.workspace.setView("watchlist");
      assertRows(render(f).html);
      assertDrafts(f);
      assertIo(f, 2);
      await retainedAndReplacement(f, left, replacement);
      assertSources(render(f).html, [replacement, right]);
      await reportAndBack(f, replacement);
      await clearBoundaries(f, replacement, right);
    } finally {
      f.workspace.sessionOwner.dispose();
    }
  });
});
