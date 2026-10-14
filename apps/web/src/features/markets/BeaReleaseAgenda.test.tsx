import {
  PERSONAL_BEA_CALENDAR_SOURCE,
  parseManagedEconomicCalendar,
  type PersonalEconomicCalendarDto,
} from "@research-cockpit/contracts";
import React, { type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  BeaReleaseAgenda,
  type BeaReleaseAgendaProps,
} from "./BeaReleaseAgenda";

import { projectBeaReleaseView } from "./bea-release-view";

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
  it("places an optional note action after loaded date controls and before releases, without adding it to the local default or unloaded agenda", () => {
    const noteAction = <div data-note-slot="bea">Note controls</div>;
    const agenda = fixture();
    const input = props({
      agenda,
      noteAction,
      filterView: {
        view: projectBeaReleaseView(agenda, "", ""),
        resetNotice: false,
        onDateChange: vi.fn(),
        onQueryChange: vi.fn(),
      },
    });
    const html = renderToStaticMarkup(<BeaReleaseAgenda {...input} />);
    expect(html.indexOf('id="managed-bea-release-date-count"')).toBeLessThan(
      html.indexOf('data-note-slot="bea"'),
    );
    expect(html.indexOf('data-note-slot="bea"')).toBeLessThan(
      html.indexOf('class="bea-agenda-days"'),
    );
    expect(
      renderToStaticMarkup(
        <BeaReleaseAgenda {...props({ noteAction, agenda: null })} />,
      ),
    ).not.toContain("data-note-slot");
    expect(renderToStaticMarkup(<BeaReleaseAgenda {...props()} />)).toBe(
      renderToStaticMarkup(
        <BeaReleaseAgenda {...props({ noteAction: undefined })} />,
      ),
    );
    expect(input.onLoad).not.toHaveBeenCalled();
    const empty = renderToStaticMarkup(
      <BeaReleaseAgenda
        {...props({ noteAction, agenda: { ...fixture(), events: [] } })}
      />,
    );
    expect(empty.indexOf('data-note-slot="bea"')).toBeLessThan(
      empty.indexOf('class="bea-agenda-empty"'),
    );
  });
  it("makes only an opted-in heading focusable and preserves the local heading markup", () => {
    const headingRef = React.createRef<HTMLHeadingElement>();
    const input = props({ headingRef });
    const heading = nodes(BeaReleaseAgenda(input)).find(
      (node) => node.type === "h2",
    );
    expect(heading?.props).toMatchObject({
      id: "bea-agenda-title",
      ref: headingRef,
      tabIndex: -1,
    });
    expect(input.onLoad).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(<BeaReleaseAgenda {...props()} />)).toContain(
      '<h2 id="bea-agenda-title">Economic calendar</h2>',
    );
  });
  it("offers explicit cancellation during a refresh and keeps the previous packet's dates visible", () => {
    const onCancel = vi.fn();
    const view = BeaReleaseAgenda(
      props({
        busy: true,
        showingPrevious: true,
        message: "Refreshing BEA agenda…",
        onCancel,
      }),
    );
    expect(text(view)).toContain("Previous agenda");
    expect(text(view)).toContain("Tue, Oct 20, 2026, 2:00 PM EDT");
    const cancel = nodes(view).find(
      (node) => node.type === "button" && text(node) === "Cancel agenda",
    );
    expect(cancel?.props.disabled).not.toBe(true);
    (cancel?.props.onClick as () => void)();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(text(BeaReleaseAgenda(props({ onCancel })))).not.toContain(
      "Cancel agenda",
    );
  });
  it("describes session availability without local-access wording", () => {
    const view = BeaReleaseAgenda(props({ enabled: false, agenda: null }));
    expect(text(view)).toContain("when your session is ready");
    expect(text(view)).not.toContain("local access");
  });
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
      const view = BeaReleaseAgenda(props({ error: "unavailable" }));
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

describe("managed BEA release-date presentation", () => {
  function view(
    selectedDate = "",
    overrides: Partial<BeaReleaseAgendaProps> = {},
    query = "",
  ) {
    const input = props(overrides);
    return BeaReleaseAgenda({
      ...input,
      filterView: overrides.filterView ?? {
        view: projectBeaReleaseView(input.agenda, selectedDate, query),
        resetNotice: false,
        onDateChange: vi.fn(),
        onQueryChange: vi.fn(),
      },
    });
  }
  it("intersects the series query with the date while keeping every loaded date option and raw series", () => {
    const agenda = fixture();
    const current = view("2026-10-30", { agenda }, "  SyNtHeTiC   SeCoNd  ");
    expect(
      nodes(current)
        .filter((node) => node.type === "li")
        .map(text),
    ).toEqual(["8:30 AM EDT Synthetic second series"]);
    expect(text(current)).toContain("1 of 4 loaded BEA releases.");
    expect(
      nodes(current)
        .filter((node) => node.type === "option")
        .map((node) => node.props.value),
    ).toEqual(["", "2026-10-29", "2026-10-30", "2026-11-02"]);
    expect(
      nodes(current).find((node) => node.type === "input")?.props.value,
    ).toBe("  SyNtHeTiC   SeCoNd  ");
    expect(text(current)).toContain("Tue, Oct 20, 2026, 2:00 PM EDT");
  });

  it("keeps search and Clear mounted while paused and delegates exact raw input without moving focus", () => {
    const agenda = fixture();
    const onQueryChange = vi.fn();
    const onDateChange = vi.fn();
    const focused = { focus: vi.fn(), scrollIntoView: vi.fn() };
    vi.stubGlobal("document", { activeElement: focused });
    try {
      const filterView = {
        view: projectBeaReleaseView(agenda, "2026-10-30", " first "),
        resetNotice: false,
        onDateChange,
        onQueryChange,
      };
      const input = props({ agenda, enabled: false, busy: true, filterView });
      const current = BeaReleaseAgenda(input);
      const search = nodes(current).find((node) => node.type === "input")!;
      expect(search.props).toMatchObject({
        id: "managed-bea-release-search",
        type: "search",
        value: " first ",
        "aria-describedby":
          "managed-bea-release-search-help managed-bea-release-date-count",
      });
      expect(search.props.disabled).not.toBe(true);
      expect(text(current)).toContain(
        "Search series names in this loaded window.",
      );
      (search.props.onChange as React.ChangeEventHandler<HTMLInputElement>)({
        currentTarget: { value: "  Cafe\u0301 東京  " },
      } as React.ChangeEvent<HTMLInputElement>);
      expect(onQueryChange).toHaveBeenLastCalledWith("  Cafe\u0301 東京  ");
      const clear = nodes(current).find(
        (node) => node.type === "button" && text(node) === "Clear search",
      )!;
      (clear.props.onClick as () => void)();
      expect(onQueryChange).toHaveBeenLastCalledWith("");
      expect(onDateChange).not.toHaveBeenCalled();
      expect(input.onLoad).not.toHaveBeenCalled();
      const emptyQuery = BeaReleaseAgenda({
        ...input,
        filterView: {
          ...filterView,
          view: projectBeaReleaseView(agenda, "2026-10-30", ""),
        },
      });
      expect(
        nodes(emptyQuery).find(
          (node) => node.type === "button" && text(node) === "Clear search",
        ),
      ).toBeDefined();
      expect(
        nodes(emptyQuery).find((node) => node.type === "select")?.props.value,
      ).toBe("2026-10-30");
      expect(document.activeElement).toBe(focused);
      expect(focused.focus).not.toHaveBeenCalled();
      expect(focused.scrollIntoView).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("distinguishes no matching loaded releases from a verified empty packet", () => {
    const current = view("2026-10-30", {}, "November");
    expect(text(current)).toContain("0 of 4 loaded BEA releases.");
    expect(text(current)).toContain(
      "No loaded releases match these filters. Change the date or clear the search.",
    );
    expect(text(current)).not.toContain("No BEA releases are listed");
    expect(nodes(current).filter((node) => node.type === "li")).toHaveLength(0);
    const empty = view(
      "",
      { agenda: { ...fixture(), events: [] } },
      "November",
    );
    expect(text(empty)).toContain(
      "No BEA releases are listed in this loaded 30-day window.",
    );
    expect(text(empty)).not.toContain("match these filters");
  });

  it("rejects an unbound view and its callbacks without changing the current local presentation", () => {
    const agenda = fixture();
    const other = { ...fixture(), events: [] };
    const onQueryChange = vi.fn();
    const onDateChange = vi.fn();
    const input = props({
      agenda,
      filterView: {
        view: projectBeaReleaseView(other, "", "missing"),
        resetNotice: true,
        onQueryChange,
        onDateChange,
      },
    });
    const html = renderToStaticMarkup(<BeaReleaseAgenda {...input} />);
    expect(html).toBe(
      renderToStaticMarkup(<BeaReleaseAgenda {...props({ agenda })} />),
    );
    expect(html).not.toContain("managed-bea-release-search");
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(onDateChange).not.toHaveBeenCalled();
  });

  it("offers Eastern ISO date keys and exact counts without altering the local profile", () => {
    expect(parseManagedEconomicCalendar(fixture())).not.toBeNull();
    const managed = view();
    const select = nodes(managed).find((node) => node.type === "select")!;
    expect(select.props).toMatchObject({
      id: "managed-bea-release-date",
      value: "",
      "aria-describedby":
        "managed-bea-release-date-help managed-bea-release-date-count",
    });
    expect(
      nodes(managed).filter((node) => node.type === "label")[0]?.props.htmlFor,
    ).toBe(select.props.id);
    expect(
      nodes(select)
        .filter((node) => node.type === "option")
        .map((node) => [node.props.value, text(node)]),
    ).toEqual([
      ["", "All loaded dates"],
      ["2026-10-29", "Thu, Oct 29, 2026 ( 1 )"],
      ["2026-10-30", "Fri, Oct 30, 2026 ( 2 )"],
      ["2026-11-02", "Mon, Nov 2, 2026 ( 1 )"],
    ]);
    expect(text(managed)).toContain("4 of 4 loaded BEA releases.");
    const local = BeaReleaseAgenda(props());
    expect(nodes(local).some((node) => node.type === "select")).toBe(false);
    expect(nodes(local).filter((node) => node.type === "li")).toHaveLength(4);
    expect(text(local)).not.toContain("loaded BEA releases.");
  });
  it("filters only rendered groups and preserves simultaneous series, provenance and failure warnings", () => {
    const agenda = fixture();
    const before = structuredClone(agenda);
    const managed = view("2026-10-30", {
      agenda,
      showingPrevious: true,
      error: "unavailable",
    });
    expect(
      nodes(managed)
        .filter((node) => node.type === "li")
        .map(text),
    ).toEqual([
      "8:30 AM EDT Synthetic first series",
      "8:30 AM EDT Synthetic second series",
    ]);
    expect(text(managed)).toContain("2 of 4 loaded BEA releases.");
    expect(text(managed)).toContain("Tue, Oct 20, 2026, 2:00 PM EDT");
    expect(text(managed)).toContain(
      "Thu, Nov 19, 2026, 1:00 PM EST (end excluded)",
    );
    expect(text(managed)).toContain("Previous agenda");
    expect(text(managed)).toContain("could not be loaded");
    expect(nodes(managed).find((node) => node.type === "a")?.props.href).toBe(
      PERSONAL_BEA_CALENDAR_SOURCE.scheduleUrl,
    );
    expect(agenda).toEqual(before);
  });
  it("uses Eastern boundaries across the spring clock change", () => {
    const agenda = parseManagedEconomicCalendar({
      ...fixture(),
      fetchedAt: "2026-03-01T00:00:00.000Z",
      window: {
        fromInclusive: "2026-03-01T00:00:00.000Z",
        toExclusive: "2026-03-31T00:00:00.000Z",
      },
      events: [
        {
          series: "Previous Eastern day",
          scheduledAt: "2026-03-08T04:30:00.000Z",
        },
        {
          series: "Before spring change",
          scheduledAt: "2026-03-08T06:30:00.000Z",
        },
        {
          series: "After spring change",
          scheduledAt: "2026-03-08T07:30:00.000Z",
        },
      ],
    });
    expect(agenda).not.toBeNull();
    const managed = view("2026-03-08", { agenda });
    expect(
      nodes(managed)
        .filter((node) => node.type === "li")
        .map(text),
    ).toEqual([
      "1:30 AM EST Before spring change",
      "3:30 AM EDT After spring change",
    ]);
    expect(text(managed)).toContain("2 of 3 loaded BEA releases.");
    expect(
      nodes(managed)
        .filter((node) => node.type === "option")
        .map((node) => node.props.value),
    ).toEqual(["", "2026-03-07", "2026-03-08"]);
  });
  it("keeps verified empty and unloaded states distinct and announces a replacement reset", () => {
    const agenda = { ...fixture(), events: [] };
    const empty = view("", {
      agenda,
      filterView: {
        view: projectBeaReleaseView(agenda, "", ""),
        resetNotice: true,
        onDateChange: vi.fn(),
        onQueryChange: vi.fn(),
      },
    });
    expect(text(empty)).toContain("0 of 0 loaded BEA releases.");
    expect(text(empty)).toContain(
      "No BEA releases are listed in this loaded 30-day window.",
    );
    expect(text(empty)).toContain(
      "Agenda response changed; showing all loaded releases.",
    );
    const status = nodes(empty).find(
      (node) => node.props.id === "managed-bea-release-date-count",
    );
    expect(status?.props).toMatchObject({
      role: "status",
      "aria-live": "polite",
    });
    expect(
      nodes(view("", { agenda: null })).some((node) => node.type === "select"),
    ).toBe(false);
  });
  it("preserves the admitted maximum event set and long labels, and safely falls back from an unknown date", () => {
    const events = Array.from({ length: 512 }, (_, i) => ({
      series: `Invented ${String(i).padStart(3, "0")} ${"x".repeat(240)}`,
      scheduledAt:
        i < 256 ? "2026-10-30T12:30:00.000Z" : "2026-11-02T13:30:00.000Z",
    }));
    const agenda = parseManagedEconomicCalendar({ ...fixture(), events });
    expect(agenda).not.toBeNull();
    const managed = view("2026-11-02", { agenda });
    expect(text(managed)).toContain("256 of 512 loaded BEA releases.");
    expect(nodes(managed).filter((node) => node.type === "li")).toHaveLength(
      256,
    );
    expect(text(managed)).toContain(events[511]!.series);
    expect(
      nodes(view("foreign-date", { agenda })).filter(
        (node) => node.type === "li",
      ),
    ).toHaveLength(512);
  });
});
