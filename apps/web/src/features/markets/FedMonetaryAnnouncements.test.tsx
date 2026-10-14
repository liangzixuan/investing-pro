import {
  PERSONAL_FED_MONETARY_SOURCE,
  type PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  FedMonetaryAnnouncements,
  type FedMonetaryAnnouncementsProps,
} from "./FedMonetaryAnnouncements";
import { projectFedAnnouncementView } from "./fed-announcement-view";

function fixture(): PersonalMonetaryAnnouncementsDto {
  return {
    schemaVersion: "1.0.0",
    source: PERSONAL_FED_MONETARY_SOURCE,
    fetchedAt: "2026-11-03T18:00:00.000Z",
    availableItemCount: 3,
    items: [
      {
        title: "Synthetic November announcement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261102a.htm",
        publishedAt: "2026-11-02T18:00:00.000Z",
      },
      {
        title: "Synthetic October announcement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261030a.htm",
        publishedAt: "2026-10-30T18:00:00.000Z",
      },
      {
        title: "Synthetic undated announcement",
        url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261029a.htm",
        publishedAt: null,
      },
    ],
  };
}
function props(
  overrides: Partial<FedMonetaryAnnouncementsProps> = {},
): FedMonetaryAnnouncementsProps {
  return {
    announcements: fixture(),
    busy: false,
    error: null,
    enabled: true,
    onLoad: vi.fn(),
    ...overrides,
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
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node))
    return node.map(text).join(" ").replace(/\s+/gu, " ");
  return React.isValidElement<{ children?: ReactNode }>(node)
    ? text(node.props.children)
    : "";
}
describe("Federal Reserve announcements presentation", () => {
  it("keeps note controls mounted in an initially closed native disclosure after the list", () => {
    const noteAction = (
      <div data-note-action="disclosure">Current note controls</div>
    );
    const announcements = fixture();
    const input = props({
      announcements,
      noteAction,
      filterView: {
        view: projectFedAnnouncementView(announcements, ""),
        resetNotice: false,
        onQueryChange: vi.fn(),
      },
    });
    const view = FedMonetaryAnnouncements(input);
    const disclosure = nodes(view).find(
      (node) => node.props.id === "managed-fed-note-disclosure",
    )!;
    expect(disclosure.type).toBe("details");
    expect(disclosure.key).toBeNull();
    expect(disclosure.props.open).toBeUndefined();
    expect(disclosure.props.defaultOpen).toBeUndefined();
    expect(disclosure.props.onToggle).toBeUndefined();
    const summary = nodes(disclosure).find((node) => node.type === "summary")!;
    expect(summary.props.id).toBe("managed-fed-note-disclosure-toggle");
    expect(text(summary)).toBe("Add an announcement to a note");
    expect(nodes(disclosure)).toContain(noteAction);
    expect(
      nodes(disclosure).some(
        (node) =>
          node.type === "time" || node.type === "li" || node.type === "input",
      ),
    ).toBe(false);
    const html = renderToStaticMarkup(view);
    expect(html.indexOf("</ul>")).toBeLessThan(
      html.indexOf('id="managed-fed-note-disclosure"'),
    );
    expect(html.indexOf('id="managed-fed-title-search"')).toBeLessThan(
      html.indexOf('id="managed-fed-note-disclosure"'),
    );
    expect(html).toContain('data-note-action="disclosure"');
    expect(html).not.toContain("<details open");
  });
  it.each([
    { busy: true, showingPrevious: true, error: "invalid_response" as const },
    { announcements: { ...fixture(), items: [], availableItemCount: 0 } },
  ])(
    "keeps loaded notices and empty results outside note tools for %j",
    (change) => {
      const view = FedMonetaryAnnouncements(
        props({
          ...change,
          noteAction: (
            <div data-note-action="disclosure">Current note controls</div>
          ),
        }),
      );
      const disclosure = nodes(view).find(
        (node) => node.props.id === "managed-fed-note-disclosure",
      )!;
      expect(disclosure.props.open).toBeUndefined();
      expect(
        nodes(disclosure).filter(
          (node) => node.props.role === "alert" || node.type === "time",
        ),
      ).toHaveLength(0);
      expect(renderToStaticMarkup(view)).toContain(
        'data-note-action="disclosure"',
      );
      expect(nodes(view).filter((node) => node.type === "li")).toHaveLength(
        change.announcements ? 0 : 3,
      );
    },
  );
  it("shows a labelled reading search, exact matching title/link/date and full-feed metadata", () => {
    const announcements = fixture();
    const onQueryChange = vi.fn();
    const view = FedMonetaryAnnouncements(
      props({
        announcements,
        busy: true,
        showingPrevious: true,
        filterView: {
          view: projectFedAnnouncementView(announcements, "undated"),
          resetNotice: false,
          onQueryChange,
        },
        newlyObservedUrls: announcements.items.map((item) => item.url),
        refreshSummary: <p>Full-feed comparison count: 3 of 3</p>,
      }),
    );
    const elements = nodes(view);
    const rows = elements.filter((node) => node.type === "li");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toBe(announcements.items[2]!.url);
    expect(text(rows[0])).toContain(
      "Synthetic undated announcement Unknown publication time Newly observed in this refresh",
    );
    const input = elements.find(
      (node) => node.props.id === "managed-fed-title-search",
    )!;
    expect(input.props.disabled).toBeUndefined();
    expect(input.props.value).toBe("undated");
    (
      input.props.onChange as (event: {
        currentTarget: { value: string };
      }) => void
    )({ currentTarget: { value: "October" } });
    const clear = elements.find(
      (node) => node.type === "button" && text(node) === "Clear title search",
    )!;
    (clear.props.onClick as () => void)();
    expect(onQueryChange.mock.calls).toEqual([["October"], [""]]);
    const html = renderToStaticMarkup(view);
    expect(html).toContain('for="managed-fed-title-search"');
    expect(html).toContain(
      'aria-describedby="managed-fed-title-search-help managed-fed-title-count"',
    );
    expect(html).toContain("Loaded 3 of 3 announcements from this feed.");
    expect(html).toContain(announcements.fetchedAt);
    expect(html).toContain("1 of 3 loaded announcements.");
    expect(html).toContain("Full-feed comparison count: 3 of 3");
    expect(html).toContain("Previous announcements.");
    expect(html).toContain(PERSONAL_FED_MONETARY_SOURCE.directoryUrl);
  });
  it("separates no matches from an empty feed and announces replacement reset", () => {
    const announcements = fixture();
    const filtered = props({
      announcements,
      filterView: {
        view: projectFedAnnouncementView(announcements, "absent"),
        resetNotice: true,
        onQueryChange: vi.fn(),
      },
    });
    const html = renderToStaticMarkup(FedMonetaryAnnouncements(filtered));
    expect(html).toContain("No loaded announcements match this title search.");
    expect(html).not.toContain("No announcements were listed");
    expect(html).toContain("0 of 3 loaded announcements.");
    expect(html).toContain(
      "Feed response changed; showing all loaded announcements.",
    );
    expect(html).not.toContain('class="fed-announcements-list"');
    const empty = { ...announcements, items: [], availableItemCount: 0 };
    const emptyHtml = renderToStaticMarkup(
      FedMonetaryAnnouncements(
        props({
          announcements: empty,
          filterView: {
            view: projectFedAnnouncementView(empty, ""),
            resetNotice: true,
            onQueryChange: vi.fn(),
          },
        }),
      ),
    );
    expect(emptyHtml).toContain(
      "No announcements were listed in this loaded feed.",
    );
    expect(emptyHtml).not.toContain("No loaded announcements match");
  });
  it("does not apply a view for another response or opt a local presenter into search", () => {
    const announcements = fixture();
    const view = FedMonetaryAnnouncements(
      props({
        announcements,
        filterView: {
          view: projectFedAnnouncementView(fixture(), "absent"),
          resetNotice: false,
          onQueryChange: vi.fn(),
        },
      }),
    );
    expect(nodes(view).filter((node) => node.type === "li")).toHaveLength(3);
    expect(renderToStaticMarkup(view)).not.toContain(
      "managed-fed-title-search",
    );
    expect(renderToStaticMarkup(FedMonetaryAnnouncements(props()))).toContain(
      "Showing 3 of 3 announcements from this feed.",
    );
  });
  it("places comparison before the full current list and marks only matching rows after their publication time", () => {
    const announcements = fixture();
    const input = props({
      announcements,
      refreshSummary: <div data-comparison="test">Compared feeds</div>,
      newlyObservedUrls: [
        announcements.items[2]!.url,
        "https://absent.invalid",
      ],
      noteAction: <div data-note-action="test">Current note action</div>,
    });
    const view = FedMonetaryAnnouncements(input);
    const rows = nodes(view).filter((node) => node.type === "li");
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.key)).toEqual(
      announcements.items.map((item) => item.url),
    );
    expect(
      rows.map((row) => text(row).includes("Newly observed in this refresh")),
    ).toEqual([false, false, true]);
    expect(text(rows[2])).toContain(
      "Unknown publication time Newly observed in this refresh",
    );
    const html = renderToStaticMarkup(view);
    expect(html.indexOf(announcements.fetchedAt)).toBeLessThan(
      html.indexOf('data-comparison="test"'),
    );
    expect(html.indexOf('data-comparison="test"')).toBeLessThan(
      html.indexOf("<ul"),
    );
    expect(html.indexOf("</ul>")).toBeLessThan(
      html.indexOf('data-note-action="test"'),
    );
    expect(
      nodes(view)
        .filter((node) => node.type === "a")
        .slice(1)
        .map((node) => node.props.href),
    ).toEqual(announcements.items.map((item) => item.url));
    expect(input.onLoad).not.toHaveBeenCalled();
  });
  it("keeps an empty comparison before its empty result and omits comparison before loading", () => {
    const refreshSummary = (
      <div data-comparison="empty">0 of 0 displayed links</div>
    );
    const empty = renderToStaticMarkup(
      <FedMonetaryAnnouncements
        {...props({
          refreshSummary,
          announcements: { ...fixture(), items: [], availableItemCount: 0 },
        })}
      />,
    );
    expect(empty.indexOf('data-comparison="empty"')).toBeLessThan(
      empty.indexOf("No announcements were listed"),
    );
    expect(
      renderToStaticMarkup(
        <FedMonetaryAnnouncements
          {...props({ refreshSummary, announcements: null })}
        />,
      ),
    ).not.toContain("data-comparison");
  });
  it("keeps default local markup when comparison presentation is omitted", () => {
    const input = props();
    const original = renderToStaticMarkup(
      <FedMonetaryAnnouncements {...input} />,
    );
    expect(original).toBe(
      renderToStaticMarkup(
        <FedMonetaryAnnouncements
          {...input}
          refreshSummary={null}
          newlyObservedUrls={[]}
        />,
      ),
    );
    expect(original).not.toContain("fed-announcements-new");
    expect(original).not.toContain("Compared loaded feeds");
  });
  it("places the managed note slot after the list, keeps it for an empty packet and omits it before loading", () => {
    const noteAction = <div data-note-action="test">Managed note action</div>;
    const loaded = renderToStaticMarkup(
      <FedMonetaryAnnouncements {...props({ noteAction })} />,
    );
    expect(loaded.indexOf("</ul>")).toBeLessThan(
      loaded.indexOf('data-note-action="test"'),
    );
    const empty = renderToStaticMarkup(
      <FedMonetaryAnnouncements
        {...props({
          noteAction,
          announcements: { ...fixture(), items: [], availableItemCount: 0 },
        })}
      />,
    );
    expect(empty).toContain("No announcements were listed");
    expect(empty).toContain('data-note-action="test"');
    expect(
      renderToStaticMarkup(
        <FedMonetaryAnnouncements
          {...props({ noteAction, announcements: null })}
        />,
      ),
    ).not.toContain('data-note-action="test"');
    const absent = props();
    expect(renderToStaticMarkup(<FedMonetaryAnnouncements {...absent} />)).toBe(
      renderToStaticMarkup(
        <FedMonetaryAnnouncements {...absent} noteAction={null} />,
      ),
    );
  });
  it("makes only an opted-in heading focusable and preserves the local heading markup", () => {
    const headingRef = React.createRef<HTMLHeadingElement>();
    const input = props({ headingRef });
    const heading = nodes(FedMonetaryAnnouncements(input)).find(
      (node) => node.type === "h2",
    );
    expect(heading?.props).toMatchObject({
      id: "fed-announcements-title",
      ref: headingRef,
      tabIndex: -1,
    });
    expect(input.onLoad).not.toHaveBeenCalled();
    expect(
      renderToStaticMarkup(<FedMonetaryAnnouncements {...props()} />),
    ).toContain(
      '<h2 id="fed-announcements-title">Federal Reserve announcements</h2>',
    );
  });
  it("requires an explicit load and names the source and feed scope", () => {
    const input = props({ announcements: null });
    const view = FedMonetaryAnnouncements(input);
    expect(text(view)).toContain("Federal Reserve announcements");
    expect(text(view)).toContain(
      "Monetary policy · Announcements from this feed.",
    );
    expect(text(view)).toContain(PERSONAL_FED_MONETARY_SOURCE.name);
    expect(text(view)).not.toContain("No announcements were listed");
    const button = nodes(view).find((node) => node.type === "button")!;
    expect(button.props.type).toBe("button");
    expect(text(button)).toBe("Load announcements");
    expect(input.onLoad).not.toHaveBeenCalled();
    (button.props.onClick as () => void)();
    expect(input.onLoad).toHaveBeenCalledTimes(1);
  });
  it("distinguishes publication from loading, converts each date to Eastern time and preserves null", () => {
    const view = FedMonetaryAnnouncements(props());
    expect(text(view)).toContain(
      "Showing 3 of 3 announcements from this feed. Loaded",
    );
    expect(text(view)).toContain("Nov 3, 2026, 1:00 PM EST");
    expect(text(view)).toContain("Published Nov 2, 2026, 1:00 PM EST");
    expect(text(view)).toContain("Published Oct 30, 2026, 2:00 PM EDT");
    expect(text(view)).toContain("Unknown publication time");
    expect(
      nodes(view)
        .filter((node) => node.type === "time")
        .map((node) => node.props.dateTime),
    ).toEqual([
      fixture().fetchedAt,
      fixture().items[0]!.publishedAt,
      fixture().items[1]!.publishedAt,
    ]);
    expect(text(nodes(view).find((node) => node.type === "button"))).toBe(
      "Refresh announcements",
    );
  });
  it("uses ordinary safe source links in validated item order without requesting articles", () => {
    const input = props();
    const links = nodes(FedMonetaryAnnouncements(input)).filter(
      (node) => node.type === "a",
    );
    expect(links.map((link) => link.props.href)).toEqual([
      PERSONAL_FED_MONETARY_SOURCE.directoryUrl,
      ...fixture().items.map((item) => item.url),
    ]);
    for (const link of links)
      expect(link.props).toMatchObject({
        target: "_blank",
        rel: "noopener noreferrer",
      });
    expect(input.onLoad).not.toHaveBeenCalled();
  });
  it("renders hostile titles as escaped text, without article descriptions or HTML", () => {
    const title =
      '<img src="https://untrusted.invalid/x" onerror="alert(1)"> & policy';
    const announcements = {
      ...fixture(),
      availableItemCount: 1,
      items: [{ ...fixture().items[0]!, title }],
    };
    const html = renderToStaticMarkup(
      <FedMonetaryAnnouncements {...props({ announcements })} />,
    );
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp; policy");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });
  it("shows the source count separately from the ten returned items", () => {
    const announcements = {
      ...fixture(),
      availableItemCount: 15,
      items: Array.from({ length: 10 }, (_, i) => ({
        ...fixture().items[0]!,
        title: `Synthetic announcement ${i}`,
        url: `https://www.federalreserve.gov/newsevents/pressreleases/monetary202609${String(i + 1).padStart(2, "0")}a.htm`,
      })),
    };
    const view = FedMonetaryAnnouncements(props({ announcements }));
    expect(text(view)).toContain(
      "Showing 10 of 15 announcements from this feed",
    );
    expect(nodes(view).filter((node) => node.type === "li")).toHaveLength(10);
  });
  it("distinguishes a successful empty feed from idle and a failed request", () => {
    const view = FedMonetaryAnnouncements(
      props({
        announcements: { ...fixture(), availableItemCount: 0, items: [] },
      }),
    );
    expect(text(view)).toContain("Showing 0 of 0 announcements");
    expect(text(view)).toContain(
      "No announcements were listed in this loaded feed",
    );
    expect(
      nodes(view).filter((node) => node.props.role === "alert"),
    ).toHaveLength(0);
    const failure = FedMonetaryAnnouncements(
      props({ announcements: null, error: "invalid_response" }),
    );
    expect(text(failure)).toContain("could not be verified");
    expect(text(failure)).not.toContain("No announcements were listed");
  });
  it("keeps prior items and the exact loaded time visible after refresh failure", () => {
    const view = FedMonetaryAnnouncements(
      props({ error: "provider_unavailable" }),
    );
    expect(text(view)).toContain(
      "previously loaded announcements are still shown below",
    );
    expect(
      nodes(view).filter((node) => node.props.role === "alert"),
    ).toHaveLength(1);
    expect(nodes(view).filter((node) => node.type === "li")).toHaveLength(3);
    expect(
      nodes(view).find((node) => node.type === "time")?.props.dateTime,
    ).toBe(fixture().fetchedAt);
  });
  it.each([{ busy: true }, { enabled: false }])(
    "disables loading without removing retained data for %j",
    (change) => {
      const view = FedMonetaryAnnouncements(props(change));
      expect(
        nodes(view).find((node) => node.type === "button")?.props.disabled,
      ).toBe(true);
      expect(nodes(view).filter((node) => node.type === "li")).toHaveLength(3);
      if ("busy" in change) {
        expect(text(view)).toContain("Loading announcements…");
        expect(
          nodes(view).some((node) => node.props["aria-busy"] === true),
        ).toBe(true);
      }
    },
  );
});
