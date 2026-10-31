import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { MANAGED_BLS_CALENDAR_SOURCE } from "@research-cockpit/contracts";
import type { ManagedMarketsBriefingReading as Reading } from "./managed-markets-briefing";
import { ManagedMarketsBriefingReading } from "./ManagedMarketsBriefingReading";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { economicCalendarFixture } from "./economic-calendar-fixture";
import { fedAnnouncementsFixture } from "./fed-announcements-fixture";
import { cpiHeadlinesFixture } from "./cpi-headlines-fixture";

function fixture(): Reading {
  const cpi = cpiHeadlinesFixture(),
    bea = economicCalendarFixture(),
    fed = fedAnnouncementsFixture();
  const common = {
    busy: false,
    showingPrevious: false,
    error: null,
    message: "Accepted source packet",
  };
  return {
    board: {
      active: true,
      catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      selectedListingId: eodSelection.listing.listingId,
      resolving: false,
      running: false,
      catalogChanged: false,
      error: false,
      message: "Three-listing board retained",
      rows: [
        {
          listing: eodSelection.listing,
          response: eodResponse(),
          showingPrevious: false,
          running: false,
          error: false,
          message: "Price history loaded",
        },
        {
          listing: {
            ...eodSelection.listing,
            listingId: "listing-other",
            symbol: "OTHER",
            shareClassName: "Class C",
            shareClassId: "class-other",
          },
          response: null,
          showingPrevious: false,
          running: false,
          error: false,
          message: "Not loaded",
        },
      ],
    },
    pass: {
      phase: "complete",
      rows: [
        {
          id: "cpi",
          label: "Published CPI headlines",
          identity: null,
          eligible: true,
          busy: false,
          loaded: true,
          evidence: "Retrieved 2026-10-28T19:00:00.000Z",
          selected: true,
          mode: "load",
          outcome: "checked",
        },
      ],
      plan: [
        {
          id: "cpi",
          label: "Published CPI headlines",
          identity: null,
          eligible: true,
          busy: false,
          loaded: false,
          evidence: "No packet before Start",
          selected: true,
          mode: "load",
          outcome: "not_attempted",
        },
      ],
      message: "Selected reads complete",
      canPreview: true,
      canStart: false,
    },
    bls: {
      ...common,
      calendar: { ...bea, source: MANAGED_BLS_CALENDAR_SOURCE },
    },
    bea: { ...common, agenda: bea, refreshComparison: null },
    fed: { ...common, announcements: fed, refreshComparison: null },
    cpi: { ...common, headlines: cpi },
    selected: {
      kind: "cpi",
      packet: cpi,
      item: cpi.items[0]!,
      showingPrevious: false,
    },
    entry: {
      id: "invented-briefing-check",
      catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
      listing: eodSelection.listing,
      check:
        "Question: Inspect the complete dated evidence | Source citation retained in full.",
      dueOn: "2026-11-03",
      result: "",
      status: "open",
      completedOn: null,
    },
    selection: { date: "2026-10-30", source: "bls", title: "household" },
  };
}
function render(reading = fixture()) {
  return load(
    renderToStaticMarkup(<ManagedMarketsBriefingReading reading={reading} />),
  );
}
it("shows every retained board close, listing field, source item and original clock without source or edit controls", () => {
  const reading = fixture(),
    $ = render(reading),
    text = $.text();
  expect($("#managed-markets-briefing-heading").text()).toBe(
    "Retained Markets briefing",
  );
  expect($("button,input,select,textarea,form")).toHaveLength(0);
  expect(
    $("table tbody tr")
      .map((_, row) => $(row).text())
      .get(),
  ).toEqual(["2026-09-18100.25", "2026-09-19101.5"]);
  for (const value of Object.values(eodSelection.listing))
    expect(text).toContain(value);
  for (const value of [
    "listing-other",
    "Class C",
    eodResponse().requestStartedAt,
    eodResponse().completedAt,
    eodResponse().window.startDate,
    eodResponse().window.endDate,
  ])
    expect(text).toContain(value);
  for (const item of [
    ...reading.bls.calendar!.events,
    ...reading.bea.agenda!.events,
  ]) {
    expect(text).toContain(item.series);
    expect(text).toContain(item.scheduledAt);
  }
  for (const item of [
    ...reading.fed.announcements!.items,
    ...reading.cpi.headlines!.items,
  ]) {
    expect(text).toContain(item.title);
    expect($(`a[href='${item.url}']`).length).toBeGreaterThan(0);
  }
  expect(text).toContain(reading.cpi.headlines!.feedUpdatedAt!);
  expect(text).toContain("2026-10-02T09:45:10.1200+05:30");
  expect(text).toContain("2026-10-01T07:15:22.123456-04:00");
  expect(text).toContain("invented-cpi-unknown");
  expect(text).toContain("Publication time: Unknown");
  expect(text).toContain("Feed updated time: Unknown");
  expect(text).toContain(reading.entry.check);
  expect(text).toContain("Authored UTC due date: 2026-11-03");
  expect(text).toContain("date 2026-10-30; source bls; title filter household");
  expect($("[data-briefing-selected='cpi']").text()).toContain(
    reading.cpi.headlines!.items[0]!.title,
  );
});
it("keeps partial outcomes and original plan separate from retained unselected packets", () => {
  const initial = fixture();
  const row = initial.pass.rows[0]!;
  const reading: Reading = {
    ...initial,
    pass: {
      ...initial.pass,
      phase: "stopped",
      message: "Source unavailable; remaining work not attempted",
      rows: [
        { ...row, id: "bls", label: "BLS", outcome: "failed" },
        { ...row, id: "bea", label: "BEA", outcome: "not_attempted" },
        { ...row, id: "fed", label: "Fed", outcome: "cancelled" },
        { ...row, id: "cpi", selected: false, outcome: "retained" },
      ],
    },
    cpi: {
      ...initial.cpi,
      showingPrevious: true,
      error: "unavailable",
      message: "Keep the previous CPI packet",
    },
  };
  const $ = render(reading);
  expect($("[data-briefing-source='bls'] [data-source-outcome]").text()).toBe(
    "Failed",
  );
  expect($("[data-briefing-source='bea'] [data-source-outcome]").text()).toBe(
    "Not attempted",
  );
  expect($("[data-briefing-source='fed'] [data-source-outcome]").text()).toBe(
    "Cancelled",
  );
  expect($("ul > [data-briefing-source='cpi']").text()).toContain(
    "Not selected in this passRetained previous evidence",
  );
  expect($("ol > [data-briefing-source='cpi']").text()).toContain(
    "No packet before Start",
  );
  expect($.text()).toContain("Retained previous packet");
  expect($.text()).toContain(initial.cpi.headlines!.fetchedAt);
});
it("renders source text literally, keeps unknown selected clocks, and does not merge a schedule with a similarly titled headline", () => {
  const initial = fixture(),
    cpi = initial.cpi.headlines!;
  const title = 'Invented <script>alert("quoted")</script> & headline';
  const packet = {
    ...cpi,
    availableItemCount: 1,
    items: [{ ...cpi.items[0]!, title, publishedAt: null, updatedAt: null }],
  };
  const reading: Reading = {
    ...initial,
    cpi: { ...initial.cpi, headlines: packet },
    selected: {
      kind: "cpi",
      packet,
      item: packet.items[0]!,
      showingPrevious: true,
    },
    bls: {
      ...initial.bls,
      calendar: {
        ...initial.bls.calendar!,
        events: [{ series: title, scheduledAt: "2026-10-30T12:30:00.000Z" }],
      },
    },
  };
  const $ = render(reading);
  expect($("script")).toHaveLength(0);
  expect($("[data-briefing-selected]").text()).toContain(title);
  expect($("[data-briefing-selected]").text()).toContain(
    "Feed published time: Unknown",
  );
  expect($("h4").filter((_, e) => $(e).text() === title)).toHaveLength(2);
  expect($.text()).toContain(
    "Selected item belongs to the retained previous packet",
  );
});
it("distinguishes admitted empty sources from sources that were never loaded", () => {
  const initial = fixture();
  const $ = render({
    ...initial,
    bls: { ...initial.bls, calendar: null },
    bea: { ...initial.bea, agenda: { ...initial.bea.agenda!, events: [] } },
    fed: { ...initial.fed, announcements: null },
    cpi: {
      ...initial.cpi,
      headlines: {
        ...initial.cpi.headlines!,
        items: [],
        availableItemCount: 0,
      },
    },
  });
  expect($.text()).toContain("BLS was not loaded");
  expect($.text()).toContain("Checked: no scheduled releases");
  expect($.text()).toContain("Federal Reserve announcements were not loaded");
  expect($.text()).toContain("All 0 admitted of 0 available");
  expect($.text()).toContain("Checked: no items were returned");
});
