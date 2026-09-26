import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import React, { type ReactNode, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  BeaReleaseAgenda,
  type BeaReleaseAgendaProps,
} from "./BeaReleaseAgenda";

function fixture(): PersonalEconomicCalendarDto {
  return {
    schemaVersion: "1.0.0",
    source: PERSONAL_BEA_CALENDAR_SOURCE,
    fetchedAt: "2026-10-20T18:00:00.000Z",
    window: {
      fromInclusive: "2026-10-20T18:00:00.000Z",
      toExclusive: "2026-11-19T18:00:00.000Z",
    },
    events: [
      {
        series: "Synthetic late release",
        scheduledAt: "2026-10-30T00:30:00.000Z",
      },
      {
        series: "Synthetic first series",
        scheduledAt: "2026-10-30T12:30:00.000Z",
      },
      {
        series: "Synthetic second series",
        scheduledAt: "2026-10-30T12:30:00.000Z",
      },
      {
        series: "Synthetic November release",
        scheduledAt: "2026-11-02T13:30:00.000Z",
      },
    ],
  };
}
function props(
  overrides: Partial<BeaReleaseAgendaProps> = {},
): BeaReleaseAgendaProps {
  return {
    agenda: fixture(),
    busy: false,
    enabled: true,
    error: null,
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
describe("BEA release agenda presentation", () => {
  it("requires an explicit load and names its source and limited scope", () => {
    const input = props({ agenda: null });
    const view = BeaReleaseAgenda(input);
    expect(text(view)).toMatch(/BEA releases · 30\s*-day agenda/u);
    expect(text(view)).toContain(
      "Forecasts and released values are not included",
    );
    const button = nodes(view).find((node) => node.type === "button");
    expect(text(button)).toBe("Load agenda");
    expect(input.onLoad).not.toHaveBeenCalled();
    (button?.props.onClick as () => void)();
    expect(input.onLoad).toHaveBeenCalledTimes(1);
    const links = nodes(view).filter((node) => node.type === "a");
    expect(links).toHaveLength(1);
    expect(links[0]?.props).toMatchObject({
      href: PERSONAL_BEA_CALENDAR_SOURCE.scheduleUrl,
      rel: "noopener noreferrer",
    });
  });
  it("groups by Eastern date, retains simultaneous series and applies daylight saving offsets per date", () => {
    const view = BeaReleaseAgenda(props());
    const groups = nodes(view).filter(
      (node) =>
        node.type === "section" && node.props.className === "bea-agenda-day",
    );
    expect(groups.map((node) => node.props["aria-label"])).toEqual([
      "Thu, Oct 29, 2026",
      "Fri, Oct 30, 2026",
      "Mon, Nov 2, 2026",
    ]);
    expect(text(groups[0])).toContain("8:30 PM EDT");
    expect(text(groups[1])).toContain("8:30 AM EDT");
    expect(text(groups[2])).toContain("8:30 AM EST");
    expect(nodes(groups[1]).filter((node) => node.type === "li")).toHaveLength(
      2,
    );
    expect(nodes(view).filter((node) => node.type === "a")).toHaveLength(1);
  });
  it("keeps the original window and loaded timestamp after a failed refresh", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));
      const view = BeaReleaseAgenda(props({ error: "provider_unavailable" }));
      expect(text(view)).toContain(
        "The previous loaded window is still shown below",
      );
      expect(text(view)).toContain("Tue, Oct 20, 2026, 2:00 PM EDT");
      expect(text(view)).toContain(
        "Thu, Nov 19, 2026, 1:00 PM EST (end excluded)",
      );
      expect(text(view)).not.toContain("2027");
      expect(
        nodes(view).filter((node) => node.props.role === "alert"),
      ).toHaveLength(1);
      expect(text(view)).toContain("Refresh agenda");
    } finally {
      vi.useRealTimers();
    }
  });
  it("distinguishes a verified empty window from an agenda that was never loaded", () => {
    const view = BeaReleaseAgenda(
      props({ agenda: { ...fixture(), events: [] } }),
    );
    expect(text(view)).toContain(
      "No BEA releases are listed in this loaded 30-day window",
    );
    expect(text(view)).toContain("Refresh agenda");
    expect(text(view)).not.toContain("Load scheduled BEA");
  });
  it.each([{ enabled: false }, { busy: true }])(
    "disables the action for %j without dropping accepted events",
    (change) => {
      const view = BeaReleaseAgenda(props(change));
      expect(
        nodes(view).find((node) => node.type === "button")?.props.disabled,
      ).toBe(true);
      expect(text(view)).toContain("Synthetic first series");
    },
  );
  it("shows an invalid response as a verification failure rather than an empty schedule", () => {
    const view = BeaReleaseAgenda(
      props({ agenda: null, error: "invalid_response" }),
    );
    expect(text(view)).toContain("could not be verified");
    expect(text(view)).not.toContain("No BEA releases are listed");
  });
});
