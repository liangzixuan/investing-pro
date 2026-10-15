import {
  managedEodHistoryWindow,
  parseManagedEodHistoryResponse,
  type ManagedEodHistoryRange,
  type ManagedEodHistoryResponseDto,
} from "@research-cockpit/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompanySnapshotPrice } from "./CompanySnapshotPrice";
import { ManagedEodHistory as Panel } from "./ManagedEodHistory";
import { ObservedRawCloseRange } from "./ObservedRawCloseRange";
import { eodRequest, eodResponse, eodSelection } from "./eod-history-fixture";
import type { ManagedApi } from "./managed-api";
import { ManagedEodHistory } from "./managed-eod-history";

function admitted(
  rows: ManagedEodHistoryResponseDto["rows"],
  range: ManagedEodHistoryRange = "1m",
  requestStartedAt = "2026-09-20T00:00:00.000Z",
) {
  const response = parseManagedEodHistoryResponse(
    {
      ...eodResponse(range),
      rows,
      requestStartedAt,
      completedAt: requestStartedAt.replace("00.000Z", "01.000Z"),
      window: managedEodHistoryWindow(requestStartedAt, range),
    },
    eodRequest(range),
  );
  if (!response) throw new Error("Invalid invented observed-close packet");
  return response;
}
function render(response: ManagedEodHistoryResponseDto) {
  return renderToStaticMarkup(<ObservedRawCloseRange response={response} />);
}
function extreme(html: string, label: "Highest" | "Lowest") {
  const group = html.match(
    new RegExp(`<dt>${label} reported close · USD</dt><dd>(.*?)</dd>`, "u"),
  );
  if (!group?.[1]) throw new Error(`Missing ${label} reported close`);
  return group[1];
}

describe("observed raw-close range", () => {
  it.each(["1m", "1y"] as const)(
    "uses the actual %s packet and exact observed dates with sparse coverage limits",
    (range) => {
      const output = render(eodResponse(range));
      expect(output).toContain(
        'role="group" aria-label="Observed raw-close range"',
      );
      expect(extreme(output, "Highest")).toContain(
        '<span class="managed-observed-close-amount">101.5</span> <time dateTime="2026-09-19">2026-09-19</time>',
      );
      expect(extreme(output, "Lowest")).toContain(
        range === "1y"
          ? '<span class="managed-observed-close-amount">90.125</span> <time dateTime="2025-09-22">2025-09-22</time>'
          : '<span class="managed-observed-close-amount">100.25</span> <time dateTime="2026-09-18">2026-09-18</time>',
      );
      expect(output).toContain(
        range === "1y"
          ? "Loaded request range: One year. Among 3 reported closes from 2025-09-22 to 2026-09-19."
          : "Loaded request range: One month. Among 2 reported closes from 2026-09-18 to 2026-09-19.",
      );
      expect(output).toContain(
        "Missing trading dates may change these extremes.",
      );
      expect(output).toContain(
        "Raw closes are unadjusted for splits or dividends; these are not intraday highs or lows.",
      );
      expect(output).not.toContain("First of");
      expect(output).not.toContain("52-week");
    },
  );

  it("labels a single observed close without implying a full-window range", () => {
    const output = render(admitted([{ date: "2026-09-18", close: "12.125" }]));
    for (const label of ["Highest", "Lowest"] as const) {
      expect(extreme(output, label)).toContain(">12.125</span>");
      expect(extreme(output, label)).toContain(
        '<time dateTime="2026-09-18">2026-09-18</time>',
      );
    }
    expect(output).toContain(
      "Among 1 reported close from 2026-09-18 to 2026-09-18.",
    );
    expect(output).toContain(
      "Only one reported close is available; both values use that observation.",
    );
    expect(output).not.toContain("First of");
  });

  it("shows earliest dates and counts for separately tied highest and lowest closes", () => {
    const output = render(
      admitted([
        { date: "2026-08-21", close: "100.125" },
        { date: "2026-08-28", close: "200.25" },
        { date: "2026-09-01", close: "100.125" },
        { date: "2026-09-18", close: "200.25" },
      ]),
    );
    expect(extreme(output, "Highest")).toContain(">200.25</span>");
    expect(extreme(output, "Highest")).toContain('dateTime="2026-08-28"');
    expect(extreme(output, "Lowest")).toContain(">100.125</span>");
    expect(extreme(output, "Lowest")).toContain('dateTime="2026-08-21"');
    expect(
      output.match(/First of 2 reported dates at this close\./gu),
    ).toHaveLength(2);
  });

  it("explains a flat multi-date packet separately from a single observation", () => {
    const output = render(
      admitted([
        { date: "2026-08-21", close: "50.125" },
        { date: "2026-09-01", close: "50.125" },
        { date: "2026-09-18", close: "50.125" },
      ]),
    );
    for (const label of ["Highest", "Lowest"] as const) {
      expect(extreme(output, label)).toContain('dateTime="2026-08-21"');
      expect(extreme(output, label)).toContain(
        "First of 3 reported dates at this close.",
      );
    }
    expect(output).not.toContain("Only one reported close");
  });

  it("retains all 64 source characters for values that Number cannot distinguish", () => {
    const low = `1.${"0".repeat(61)}1`;
    const high = `1.${"0".repeat(61)}2`;
    expect(low).toHaveLength(64);
    expect(high).toHaveLength(64);
    const output = render(
      admitted([
        { date: "2026-08-21", close: high },
        { date: "2026-09-18", close: low },
      ]),
    );
    expect(extreme(output, "Highest")).toContain(`>${high}</span>`);
    expect(extreme(output, "Lowest")).toContain(`>${low}</span>`);
    expect(output).not.toContain("First of");
  });

  it("includes an early extreme beyond the latest 252 dates of an admitted maximum packet", () => {
    const start = Date.parse("2023-03-01T00:00:00.000Z");
    const rows = Array.from({ length: 367 }, (_, index) => ({
      date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
      close: index === 0 ? "999.125" : index === 1 ? "1.25" : "100",
    }));
    const output = render(admitted(rows, "1y", "2024-03-01T00:00:00.000Z"));
    expect(extreme(output, "Highest")).toContain(">999.125</span>");
    expect(extreme(output, "Highest")).toContain('dateTime="2023-03-01"');
    expect(extreme(output, "Lowest")).toContain(">1.25</span>");
    expect(extreme(output, "Lowest")).toContain('dateTime="2023-03-02"');
    expect(output).toContain(
      "Among 367 reported closes from 2023-03-01 to 2024-03-01.",
    );
  });

  it.each(["1m", "1y"] as const)(
    "reuses the exact summary in company Price and snapshot while staging the opposite range from %s",
    async (range) => {
      const response = eodResponse(range);
      const read = vi
        .fn<ManagedApi["eodHistory"]>()
        .mockResolvedValue(response);
      const model = new ManagedEodHistory(read, vi.fn(), undefined, [
        eodSelection.listing,
      ]);
      model.open(eodSelection);
      model.selectRange(range);
      await model.load();
      model.selectRange(range === "1m" ? "1y" : "1m");
      const loaded = model.getSnapshot().response;
      const onOpen = vi.fn();
      const summary = render(response);
      expect(renderToStaticMarkup(<Panel model={model} />)).toContain(summary);
      expect(
        renderToStaticMarkup(
          <CompanySnapshotPrice state={model.getSnapshot()} onOpen={onOpen} />,
        ),
      ).toContain(summary);
      expect(model.getSnapshot().response).toBe(loaded);
      expect(read).toHaveBeenCalledOnce();
      expect(onOpen).not.toHaveBeenCalled();
      model.retire();
    },
  );
});
