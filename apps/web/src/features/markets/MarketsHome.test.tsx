import type {
  PersonalMarketOverviewDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import React, { type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MarketsBoardView,
  MarketsHome,
  projectMarketBoard,
  type MarketsBoardViewProps,
} from "./MarketsHome";

const onAnnouncementsLoad = vi.hoisted(() => vi.fn());
const announcementsHook = vi.hoisted(() =>
  vi.fn(() => ({
    announcements: null,
    busy: false,
    error: null,
    onLoad: onAnnouncementsLoad,
  })),
);
vi.mock("./useFedMonetaryAnnouncements", () => ({
  useFedMonetaryAnnouncements: announcementsHook,
}));
const onAgendaLoad = vi.hoisted(() => vi.fn());
const agendaHook = vi.hoisted(() =>
  vi.fn(() => ({
    agenda: null,
    busy: false,
    error: null,
    onLoad: onAgendaLoad,
  })),
);
const boardHook = vi.hoisted(() =>
  vi.fn(() => ({
    snapshot: null,
    selectedListingId: null,
    busy: false,
    attempted: false,
    error: null,
    nextRefreshAt: null,
    draft: { kind: "default" as const },
    canLoad: true,
    isSnapshotCurrent: () => false,
    onModeChange: vi.fn(),
    onToggleWatchlist: vi.fn(),
    onSelect: vi.fn(() => true),
    onLoad: vi.fn(),
  })),
);
vi.mock("./useBeaReleaseAgenda", () => ({ useBeaReleaseAgenda: agendaHook }));
vi.mock("./useMarketsSnapshot", () => ({ useMarketsSnapshot: boardHook }));
import { PriceHistoryChart } from "../research/PriceHistoryChart";
import {
  marketBoardCohortKey,
  type MarketBoardDefinition,
  type MarketBoardSnapshot,
} from "./market-board-loader";
import { MarketBoardPicker } from "./MarketBoardPicker";
vi.mock("../research/PriceHistoryChart", () => ({
  PriceHistoryChart: () => null,
}));
const digest = `sha256:${"a".repeat(64)}` as const;
function identity(symbol: string): PersonalSecurityMasterScreenRowDto {
  return {
    cik: "0000000001",
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${symbol}`,
    issuerName: `Synthetic ${symbol}`,
    listingId: `listing-${symbol}`,
    securityId: `security-${symbol}`,
    securityName: "Common stock",
    shareClassId: `class-${symbol}`,
    shareClassName: "Common",
    symbol,
  };
}
function overview(symbol: string): PersonalMarketOverviewDto {
  const row = identity(symbol);
  const window = {
    range: "1m",
    startDate: "2026-08-24",
    endDate: "2026-09-24",
  } as const;
  return {
    schemaVersion: "2.0.0",
    profile: "personal_single_user_local_market_data",
    ingestedAt: "2026-09-24T23:00:00.000Z",
    security: {
      country: row.country,
      exchangeMic: row.exchangeMic,
      issuerName: row.issuerName,
      listingId: row.listingId,
      securityName: row.securityName,
      symbol,
    },
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      historyFeed: "tiingo_eod_composite",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      quoteFeed: "tiingo_iex_derived_reference",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
    },
    window,
    quote: { status: "not_requested" },
    history: {
      status: "available",
      value: { ...window, currency: "USD", bars: [] },
    },
  };
}
function populated(
  symbol: string,
  price: string,
  previousDate = "2026-09-22",
): PersonalMarketOverviewDto {
  const value = overview(symbol);
  const bar = (date: string, close: string) => ({
    date,
    raw: { open: close, high: close, low: close, close, volume: "10" },
    adjusted: { open: close, high: close, low: close, close, volume: "10" },
    splitFactor: "1",
    dividendCash: "0",
  });
  return {
    ...value,
    history: {
      status: "available",
      value: {
        ...value.window,
        currency: "USD",
        bars: [bar(previousDate, "100"), bar("2026-09-23", price)],
      },
    },
  };
}
function board(): MarketBoardSnapshot {
  return {
    definition: { kind: "default" },
    cohortKey: marketBoardCohortKey({ kind: "default" }, digest),
    snapshotSha256: digest,
    loadedAt: "2026-09-24T23:00:00.000Z",
    stoppedBy: null,
    rows: [
      ["AAPL", "110"],
      ["MSFT", "90"],
      ["WMT", "120"],
    ].map(([symbol, price]) => ({
      symbol: symbol!,
      identity: identity(symbol!),
      overview: populated(symbol!, price!),
      error: null,
    })),
  };
}
function props(
  overrides: Partial<MarketsBoardViewProps> = {},
): MarketsBoardViewProps {
  return {
    active: true,
    enabled: true,
    catalogSnapshotSha256: digest,
    sessionKey: 1,
    providerStatus: {
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local_market_data",
      status: "configured",
      provider: overview("AAPL").provider,
    },
    isCurrent: () => true,
    isActive: () => true,
    watchlist: { status: "available", members: [] },
    isWatchlistCurrent: () => true,
    onActivityStart: () => () => true,
    onSessionUnavailable: vi.fn(),
    onOpenCompany: vi.fn(),
    snapshot: board(),
    draft: { kind: "default" },
    canLoad: true,
    isSnapshotCurrent: () => true,
    selectedListingId: "listing-AAPL",
    busy: false,
    attempted: true,
    error: null,
    nextRefreshAt: null,
    order: "board",
    onOrder: vi.fn(),
    onSelect: vi.fn(),
    onLoad: vi.fn(),
    onModeChange: vi.fn(),
    onToggleWatchlist: vi.fn(),
    ...overrides,
  };
}
function comparisonBoard(): MarketBoardSnapshot {
  const snapshot = board();
  return {
    ...snapshot,
    rows: snapshot.rows.map((row) => {
      const member = row.identity!;
      const listingId = member.listingId.toLowerCase();
      return {
        ...row,
        identity: {
          ...member,
          listingId,
          issuerId: member.issuerId.toLowerCase(),
          securityId: member.securityId.toLowerCase(),
          shareClassId: member.shareClassId.toLowerCase(),
        },
        overview: {
          ...row.overview!,
          security: { ...row.overview!.security, listingId },
        },
      };
    }),
  };
}
function nodes(
  node: ReactNode,
): ReactElement<{ children?: ReactNode; [key: string]: unknown }>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (
    !React.isValidElement<{ children?: ReactNode; [key: string]: unknown }>(
      node,
    )
  )
    return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: ReactNode): string {
  if (node === null || typeof node === "boolean" || node === undefined)
    return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node))
    return node.map(text).join(" ").replace(/\s+/gu, " ");
  if (React.isValidElement<{ children?: ReactNode }>(node))
    return text(node.props.children);
  return "";
}
function button(node: ReactNode, label: string) {
  const found = nodes(node).find(
    (element) =>
      (element.type === "button" || element.type === "a") &&
      text(element.props.children) === label,
  );
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}
describe("Markets board presentation", () => {
  it("compares the complete loaded cohort in its original order while the board ranks gainers", () => {
    const input = props({ order: "gainers", snapshot: comparisonBoard() });
    const html = renderToStaticMarkup(<MarketsBoardView {...input} />);
    const comparison = html.slice(
      html.indexOf('class="markets-cohort-comparison"'),
    );
    expect(comparison).toContain("Compare this board");
    expect(comparison).toContain("2026-09-22");
    expect(comparison).toContain("2026-09-23");
    expect(comparison).toContain("2 shared observations");
    const rows = comparison.slice(
      comparison.indexOf("<tbody>"),
      comparison.indexOf("</tbody>"),
    );
    expect(rows.indexOf("AAPL")).toBeLessThan(rows.indexOf("MSFT"));
    expect(rows.indexOf("MSFT")).toBeLessThan(rows.indexOf("WMT"));
    expect(rows).toContain("10.0000%");
    expect(rows).toContain("-10.0000%");
    expect(rows).toContain("20.0000%");
    expect(input.onLoad).not.toHaveBeenCalled();
    expect(input.onOpenCompany).not.toHaveBeenCalled();
  });
  it("keeps shared-date results while refreshing or showing a same-cohort refresh error", () => {
    const snapshot = comparisonBoard();
    for (const state of [{ busy: true }, { error: "unavailable" }]) {
      const html = renderToStaticMarkup(
        <MarketsBoardView {...props({ snapshot, ...state })} />,
      );
      expect(html).toContain("Compare this board");
      expect(html).toContain("2 shared observations");
      expect(html).toContain("2026-09-24T23:00:00.000Z");
      expect(html).toContain("20.0000%");
    }
  });
  it("replaces the entire comparison with an unavailable state after a partial board result", () => {
    const snapshot = comparisonBoard();
    const rows = snapshot.rows.map((row) =>
      row.symbol === "MSFT"
        ? { ...row, overview: null, error: "unavailable" as const }
        : row,
    );
    const html = renderToStaticMarkup(
      <MarketsBoardView {...props({ snapshot: { ...snapshot, rows } })} />,
    );
    const comparison = html.slice(
      html.indexOf('class="markets-cohort-comparison"'),
    );
    expect(comparison).toContain("No subset was compared.");
    expect(comparison).not.toContain('class="markets-cohort-table"');
    expect(comparison).not.toContain("shared observations");
  });
  it("withholds comparison results for unloaded, changed-draft and changed-catalog boards", () => {
    const variants: Partial<MarketsBoardViewProps>[] = [
      { snapshot: null },
      { draft: { kind: "watchlist", members: [identity("NEW")] } },
      { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
    ];
    for (const variant of variants) {
      const input = props(variant);
      const html = renderToStaticMarkup(<MarketsBoardView {...input} />);
      expect(html).not.toContain("Compare this board");
      expect(input.onLoad).not.toHaveBeenCalled();
    }
  });
  it("removes the watchlist comparison when its exact members retire", () => {
    const snapshot = comparisonBoard();
    const draft: MarketBoardDefinition = {
      kind: "watchlist",
      members: snapshot.rows.map((row) => {
        const member = row.identity!;
        return {
          country: member.country,
          exchangeMic: member.exchangeMic,
          instrumentType: member.instrumentType,
          issuerId: member.issuerId,
          issuerName: member.issuerName,
          listingId: member.listingId,
          securityId: member.securityId,
          securityName: member.securityName,
          shareClassId: member.shareClassId,
          shareClassName: member.shareClassName,
          symbol: member.symbol,
        };
      }),
    };
    const input = props({
      draft,
      snapshot: {
        ...snapshot,
        definition: draft,
        cohortKey: marketBoardCohortKey(draft, digest),
      },
    });
    expect(renderToStaticMarkup(<MarketsBoardView {...input} />)).toContain(
      "2 shared observations",
    );
    expect(
      renderToStaticMarkup(
        <MarketsBoardView {...input} isWatchlistCurrent={() => false} />,
      ),
    ).not.toContain("Compare this board");
    expect(input.onLoad).not.toHaveBeenCalled();
  });
  it("offers independent public-source panels when Tiingo is unconfigured and the catalog is absent", () => {
    const input = props({ catalogSnapshotSha256: null, providerStatus: null });
    const html = renderToStaticMarkup(<MarketsHome {...input} />);
    expect(html).toContain("Economic calendar");
    expect(html).toContain("Load agenda");
    expect(agendaHook).toHaveBeenLastCalledWith(input);
    expect(announcementsHook).toHaveBeenLastCalledWith(input);
    expect(html).toContain("Federal Reserve announcements");
    expect(html).toContain("Load announcements");
    expect(onAnnouncementsLoad).not.toHaveBeenCalled();
    expect(boardHook).toHaveBeenLastCalledWith({ ...input, enabled: false });
    expect(onAgendaLoad).not.toHaveBeenCalled();
  });
  it("keeps the public-source panels mounted inside the same hidden Markets lifetime while Research is active", () => {
    const input = props({ active: false });
    const html = renderToStaticMarkup(<MarketsHome {...input} />);
    expect(html).toContain('<div hidden="">');
    expect(html).toContain("Economic calendar");
    expect(agendaHook).toHaveBeenLastCalledWith(input);
    expect(announcementsHook).toHaveBeenLastCalledWith(input);
    expect(html).toContain("Federal Reserve announcements");
    expect(html).toContain("Load announcements");
    expect(onAnnouncementsLoad).not.toHaveBeenCalled();
  });
  it("withholds the chart when a selected overview fails exact identity projection", () => {
    const snapshot = board();
    const rows = snapshot.rows.map((row) =>
      row.symbol === "AAPL" && row.overview !== null
        ? {
            ...row,
            overview: {
              ...row.overview,
              security: { ...row.overview.security, listingId: "wrong" },
            },
          }
        : row,
    );
    const view = MarketsBoardView(props({ snapshot: { ...snapshot, rows } }));
    expect(
      nodes(view).find((node) => node.type === PriceHistoryChart),
    ).toBeUndefined();
    expect(text(view)).toContain("The data could not be verified.");
  });
  it("explains one-bar change unavailability while retaining the valid closing price", () => {
    const snapshot = board();
    const rows = snapshot.rows.map((row) =>
      row.overview?.history.status === "available"
        ? {
            ...row,
            overview: {
              ...row.overview,
              history: {
                status: "available" as const,
                value: {
                  ...row.overview.history.value,
                  bars: row.overview.history.value.bars.slice(1),
                },
              },
            },
          }
        : row,
    );
    const view = MarketsBoardView(props({ snapshot: { ...snapshot, rows } }));
    expect(text(view)).toContain("Needs two dated observations");
    expect(text(view)).toContain("110");
  });
  it("preserves native link destinations and modifier-click behavior", () => {
    const input = props();
    const link = button(MarketsBoardView(input), "Open company research");
    expect(link.type).toBe("a");
    expect(link.props.href).toBe("/company/listing-AAPL");
    const preventDefault = vi.fn();
    (
      link.props.onClick as (event: {
        button: number;
        ctrlKey: boolean;
        preventDefault: () => void;
      }) => void
    )({ button: 0, ctrlKey: true, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(input.onOpenCompany).not.toHaveBeenCalled();
  });

  it("projects only the admitted six-field identity and narrow bar fields", () => {
    const value = projectMarketBoard(board());
    expect(value?.ranking.status).toBe("available");
    expect(value?.rows[0]).toMatchObject({
      status: "available",
      rawClose: "110",
      adjustedChangePercent: "10.0000",
      previousDate: "2026-09-22",
      latestDate: "2026-09-23",
    });
  });
  it("labels source observation dates separately from its later load timestamp", () => {
    const view = MarketsBoardView(props());
    const content = text(view);
    expect(content).toContain("2026-09-22 to 2026-09-23");
    expect(content).toContain("2026-09-24T23:00:00.000Z");
    expect(content).toContain("Tiingo EOD · cached snapshot");
    expect(content).toContain("This board does not represent the whole market");
    expect(content).toContain("AAPL, MSFT and WMT");
  });
  it("keeps the declared board order until a ranking is selected", () => {
    const rows = nodes(MarketsBoardView(props()))
      .filter((element) => element.type === "tr")
      .slice(1);
    expect(rows.map((row) => text(row.props.children).split(" ")[0])).toEqual([
      "AAPL",
      "MSFT",
      "WMT",
    ]);
  });
  it.each([
    ["gainers", ["WMT", "AAPL", "MSFT"]],
    ["losers", ["MSFT", "AAPL", "WMT"]],
  ] as const)(
    "orders %s by the same dated adjusted closes",
    (order, expected) => {
      const rows = nodes(MarketsBoardView(props({ order })))
        .filter((element) => element.type === "tr")
        .slice(1);
      expect(rows.map((row) => text(row.props.children).split(" ")[0])).toEqual(
        expected,
      );
    },
  );
  it("disables mixed-date ranking and keeps the input order", () => {
    const snapshot = board();
    const rows = snapshot.rows.map((row) =>
      row.symbol === "MSFT"
        ? { ...row, overview: populated("MSFT", "90", "2026-09-21") }
        : row,
    );
    const view = MarketsBoardView(
      props({ snapshot: { ...snapshot, rows }, order: "gainers" }),
    );
    expect(text(view)).toContain("Rows stay dated and unranked");
    expect(button(view, "Gainers").props.disabled).toBe(true);
    expect(
      nodes(view)
        .filter((node) => node.type === "tr")
        .slice(1)
        .map((row) => text(row.props.children).split(" ")[0]),
    ).toEqual(["AAPL", "MSFT", "WMT"]);
  });
  it("leaves a failed row visible without replacing its missing price or change with zero", () => {
    const snapshot = board();
    const rows = snapshot.rows.map((row) =>
      row.symbol === "MSFT"
        ? {
            ...row,
            overview: {
              ...overview("MSFT"),
              history: {
                status: "unavailable",
                reason: "not_covered",
              } as const,
            },
            error: "not_covered" as const,
          }
        : row,
    );
    const view = MarketsBoardView(props({ snapshot: { ...snapshot, rows } }));
    const failed = nodes(view)
      .filter((node) => node.type === "tr")
      .find((node) => text(node).startsWith("MSFT"));
    expect(text(failed)).toContain("No EOD coverage");
    expect(text(failed)).toContain("Unavailable");
    expect(text(failed)).not.toContain("0%");
    expect(text(view)).toContain("2 of 3");
  });
  it("keeps EOD visible if the independent quote was refused", () => {
    const snapshot = board();
    const rows = snapshot.rows.map((row) => ({
      ...row,
      overview:
        row.overview === null
          ? null
          : {
              ...row.overview,
              quote: {
                status: "unavailable",
                reason: "access_denied",
              } as const,
            },
    }));
    expect(
      text(MarketsBoardView(props({ snapshot: { ...snapshot, rows } }))),
    ).toContain("3 of 3");
  });
  it("uses the selected cached history without fetching on chart selection", () => {
    const input = props();
    const view = MarketsBoardView(input);
    const chart = nodes(view).find((node) => node.type === PriceHistoryChart);
    expect(chart?.props.symbol).toBe("AAPL");
    expect(chart?.props.mode).toBe("adjusted");
    const chosen = nodes(view).find(
      (node) => node.props["aria-label"] === "View chart for MSFT",
    );
    (chosen?.props.onClick as () => void)();
    expect(input.onSelect).toHaveBeenCalledWith("listing-MSFT");
    expect(input.onLoad).not.toHaveBeenCalled();
  });
  it("opens the exact catalog identity from the selected company action", () => {
    const input = props();
    const action = button(MarketsBoardView(input), "Open company research");
    const origin = {} as HTMLButtonElement;
    (
      action.props.onClick as (event: {
        currentTarget: HTMLButtonElement;
        preventDefault: () => void;
      }) => void
    )({ currentTarget: origin, preventDefault: vi.fn() });
    expect(input.onOpenCompany).toHaveBeenCalledWith(
      identity("AAPL"),
      origin,
      input.snapshot?.rows[0]?.overview,
    );
    expect(input.onLoad).not.toHaveBeenCalled();
  });
  it.each([
    { active: false },
    { enabled: false },
    { isCurrent: () => false },
    { isActive: () => false },
    { isSnapshotCurrent: () => false },
  ])("rejects company actions from an inactive context", (override) => {
    const input = props(override);
    const action = button(MarketsBoardView(input), "Open company research");
    (
      action.props.onClick as (event: {
        currentTarget: HTMLButtonElement;
        preventDefault: () => void;
      }) => void
    )({ currentTarget: {} as HTMLButtonElement, preventDefault: vi.fn() });
    expect(input.onOpenCompany).not.toHaveBeenCalled();
  });
  it("shows the prior snapshot while an explicit refresh is pending", () => {
    const view = MarketsBoardView(props({ busy: true }));
    expect(text(view)).toContain("Loading board…");
    expect(text(view)).toContain("110");
    expect(button(view, "Loading board…").props.disabled).toBe(true);
  });
  it("explains a local refresh deferral without claiming missing provider observations", () => {
    const view = MarketsBoardView(
      props({
        snapshot: null,
        attempted: true,
        error: "refresh_deferred",
        nextRefreshAt: Date.parse("2026-09-24T23:15:00.000Z"),
      }),
    );
    expect(text(view)).toContain("A recent board load used this refresh slot");
    expect(text(view)).toContain("Not loaded");
    expect(text(view)).toContain("Catalog identity not loaded");
    expect(text(view)).not.toContain("No EOD observations");
    expect(text(view)).not.toContain("Checking catalog identity");
    expect(nodes(view).some((node) => node.props.role === "alert")).toBe(false);
  });
  it("explains a failed refresh while retaining dated values", () => {
    const view = MarketsBoardView(props({ error: "unavailable" }));
    expect(text(view)).toContain("The current board result is shown below");
    expect(text(view)).toContain("110");
  });
  it("describes an initial all-failed result without claiming a prior snapshot", () => {
    const snapshot = board();
    const view = MarketsBoardView(
      props({
        snapshot: {
          ...snapshot,
          rows: snapshot.rows.map((row) => ({
            ...row,
            overview: null,
            error: "unavailable",
          })),
        },
        error: "unavailable",
      }),
    );
    expect(text(view)).toContain("The current board result is shown below");
    expect(text(view)).not.toContain("previous");
    expect(text(view)).not.toContain("110");
    expect(nodes(view).some((node) => node.props.role === "alert")).toBe(true);
  });
  it("does not render a company action for unresolved seeds", () => {
    const snapshot = board();
    const rows = snapshot.rows.map((row) => ({
      ...row,
      identity: null,
      overview: null,
      error: "not_in_catalog" as const,
    }));
    const view = MarketsBoardView(props({ snapshot: { ...snapshot, rows } }));
    expect(text(view)).toContain("No unique current catalog listing");
    expect(
      nodes(view).filter(
        (node) => node.type === "button" && text(node).startsWith("Research "),
      ),
    ).toHaveLength(0);
  });
  it("offers one explicit Load and passes picker actions without acquiring prices", () => {
    const input = props({ snapshot: null });
    const view = MarketsBoardView(input);
    const picker = nodes(view).find((node) => node.type === MarketBoardPicker);
    expect(picker?.props.draft).toBe(input.draft);
    expect(picker?.props.onModeChange).toBe(input.onModeChange);
    expect(picker?.props.onToggleWatchlist).toBe(input.onToggleWatchlist);
    expect(input.onLoad).not.toHaveBeenCalled();
    (button(view, "Load board").props.onClick as () => void)();
    expect(input.onLoad).toHaveBeenCalledOnce();
  });
  it("labels the exact watchlist cohort and renders distinct venues with stable listing keys", () => {
    const first = identity("SAME");
    const second = {
      ...first,
      listingId: "listing-other",
      exchangeMic: "XNYS",
    };
    const draft: MarketBoardDefinition = {
      kind: "watchlist",
      members: [first, second],
    };
    const input = props({
      draft,
      snapshot: {
        ...board(),
        definition: draft,
        cohortKey: marketBoardCohortKey(draft, digest),
        rows: [first, second].map((member) => ({
          symbol: member.symbol,
          identity: member,
          overview: null,
          error: "not_covered",
        })),
      },
    });
    const view = MarketsBoardView(input);
    expect(text(view)).toContain("My Watchlist selection");
    expect(text(nodes(view).find((node) => node.type === "caption"))).toContain(
      "SAME, SAME",
    );
    expect(
      nodes(view)
        .filter((node) => node.type === "tr")
        .slice(1)
        .map((node) => node.key),
    ).toEqual(["listing-SAME", "listing-other"]);
  });
  it("never relabels a retained default snapshot under a changed watchlist draft", () => {
    const draft: MarketBoardDefinition = {
      kind: "watchlist",
      members: [identity("NEW")],
    };
    const view = MarketsBoardView(props({ draft }));
    expect(text(nodes(view).find((node) => node.type === "tbody"))).toContain(
      "NEW",
    );
    expect(
      text(nodes(view).find((node) => node.type === "tbody")),
    ).not.toContain("110");
    expect(
      nodes(view).find((node) => node.type === PriceHistoryChart),
    ).toBeUndefined();
    expect(nodes(view).filter((node) => node.type === "a")).toHaveLength(0);
    expect(button(view, "Load board")).toBeDefined();
  });
  it("withholds prices when the snapshot definition and cohort key disagree", () => {
    const snapshot = {
      ...board(),
      definition: { kind: "watchlist" as const, members: [identity("AAPL")] },
    };
    const view = MarketsBoardView(props({ snapshot }));
    expect(text(view)).toContain("No snapshot is loaded.");
    expect(
      nodes(view).find((node) => node.type === PriceHistoryChart),
    ).toBeUndefined();
  });
  it("withholds a retired watchlist snapshot even if its draft key still matches", () => {
    const draft: MarketBoardDefinition = {
      kind: "watchlist",
      members: [identity("AAPL")],
    };
    const snapshot = {
      ...board(),
      definition: draft,
      cohortKey: marketBoardCohortKey(draft, digest),
      rows: board().rows.slice(0, 1),
    };
    const view = MarketsBoardView(
      props({ draft, snapshot, isWatchlistCurrent: () => false }),
    );
    expect(text(view)).toContain("No snapshot is loaded.");
    expect(
      nodes(view).find((node) => node.type === PriceHistoryChart),
    ).toBeUndefined();
  });
  it("rejects queued company and chart actions when the hook retires their snapshot", () => {
    let current = true;
    const input = props({ isSnapshotCurrent: () => current });
    const view = MarketsBoardView(input);
    const company = button(view, "Open company research");
    const chart = nodes(view).find(
      (node) => node.props["aria-label"] === "View chart for MSFT",
    );
    const gainers = button(view, "Gainers");
    current = false;
    (company.props.onClick as (event: unknown) => void)({
      currentTarget: {},
      preventDefault: vi.fn(),
    });
    (chart?.props.onClick as () => void)();
    (gainers.props.onClick as () => void)();
    expect(input.onOpenCompany).not.toHaveBeenCalled();
    expect(input.onSelect).not.toHaveBeenCalled();
    expect(input.onOrder).not.toHaveBeenCalled();
  });
  it("opens an admitted company without handing over invalid price history", () => {
    const snapshot = board();
    const first = snapshot.rows[0]!;
    const rows = [
      {
        ...first,
        overview: {
          ...first.overview!,
          security: { ...first.overview!.security, listingId: "wrong" },
        },
      },
      ...snapshot.rows.slice(1),
    ];
    const input = props({ snapshot: { ...snapshot, rows } });
    const company = button(MarketsBoardView(input), "Open company research");
    const origin = {} as HTMLAnchorElement;
    (company.props.onClick as (event: unknown) => void)({
      currentTarget: origin,
      preventDefault: vi.fn(),
    });
    expect(input.onOpenCompany).toHaveBeenCalledWith(
      identity("AAPL"),
      origin,
      null,
    );
  });
  it("shows zero-company guidance and disables loading without fabricating seed rows", () => {
    const view = MarketsBoardView(
      props({
        draft: { kind: "watchlist", members: [] },
        snapshot: null,
        canLoad: false,
      }),
    );
    expect(nodes(view).filter((node) => node.type === "tr")).toHaveLength(1);
    expect(button(view, "Load board").props.disabled).toBe(true);
    expect(text(nodes(view).find((node) => node.type === "caption"))).toContain(
      "no companies selected",
    );
  });
});
