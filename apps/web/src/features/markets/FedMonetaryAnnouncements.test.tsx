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
