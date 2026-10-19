import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedFilingsResults } from "./ManagedFilingsResults";
import { ManagedFilingsSource } from "./ManagedFilingsSource";
import { ManagedCompanyFilings } from "./ManagedCompanyFilings";
import { ManagedCompanyFilings as Model } from "./managed-company-filings";
import type { ManagedApi } from "./managed-api";
import type { ManagedFilingsNoteActions } from "./ManagedFilingsNoteAction";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
import { ManagedAnnualReport as AnnualModel } from "./managed-annual-report";
import { response as annualResponse } from "../features/research/test-canonical-annual-ui-fixture";
import {
  getManagedFilingsAnnualBaseline,
  type ManagedFilingsAnnualBaseline,
} from "./managed-filings-annual-baseline";
import { ManagedFilingsRefreshView } from "./ManagedFilingsRefreshView";
import { ManagedFilingsAnnualScope } from "./ManagedFilingsAnnualScope";
import { TrialApiError } from "./api";
import {
  managedSecFilingsWindow,
  parseManagedSecFilingsResponse,
} from "@research-cockpit/contracts";
import {
  compareManagedFilingsResponses,
  type ManagedFilingsRefreshComparison,
} from "./managed-filings-refresh-comparison";
const hooks = vi.hoisted<{ state: unknown; direct: boolean }>(() => ({
  state: undefined,
  direct: false,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (!hooks.direct) return actual.useState(initial);
      hooks.state ??=
        typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [
        hooks.state,
        (next: unknown) => {
          hooks.state =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(hooks.state)
              : next;
        },
      ];
    },
  };
});
interface NodeProps {
  children?: React.ReactNode;
  onClick?: () => void;
  "aria-disabled"?: boolean;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  value?: string;
  disabled?: boolean;
}
function elements(node: React.ReactNode): React.ReactElement<NodeProps>[] {
  if (!React.isValidElement<NodeProps>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
function page(
  response = filingsResponse(),
  noteActions?: ManagedFilingsNoteActions,
  baseline: ManagedFilingsAnnualBaseline | null = null,
  refreshComparison: ManagedFilingsRefreshComparison | null = null,
) {
  hooks.direct = true;
  const node = ManagedFilingsResults({
    response,
    baseline,
    refreshComparison,
    ...(noteActions ? { noteActions } : {}),
  });
  hooks.direct = false;
  return {
    html: renderToStaticMarkup(node),
    buttons: elements(node).filter((element) => element.type === "button"),
    select: elements(node).find((element) => element.type === "select")!,
    node,
    source: elements(node).find(
      (element) => element.type === ManagedFilingsSource,
    ) as React.ReactElement<React.ComponentProps<typeof ManagedFilingsSource>>,
    refreshView: elements(node).find(
      (element) => element.type === ManagedFilingsRefreshView,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedFilingsRefreshView>
    >,
    dateScope: elements(node).find(
      (element) => element.type === ManagedFilingsAnnualScope,
    ) as React.ReactElement<
      React.ComponentProps<typeof ManagedFilingsAnnualScope>
    >,
  };
}
afterEach(() => {
  hooks.state = undefined;
});
describe("company SEC filings presentation", () => {
  it("keeps the compact source identity visible and complete routine metadata in a closed native disclosure", () => {
    for (const count of [0, 26]) {
      const response = filingsResponse(count);
      const html = renderToStaticMarkup(
        <ManagedFilingsSource response={response} />,
      );
      const detail = html.match(
        /<details class="managed-filings-source-details">(.*?)<\/details>/u,
      )![1]!;
      const outside = html.replace(/<details\b.*?<\/details>/u, "");
      expect(detail).toContain(
        "<summary>Filings source and coverage</summary>",
      );
      expect(detail).toContain(
        "<dt>Request started</dt><dd>2026-10-12T00:00:00.000Z</dd>",
      );
      expect(detail).toContain(
        "<dt>Completed</dt><dd>2026-10-12T00:00:01.000Z</dd>",
      );
      expect(detail).toContain(
        "Only the SEC current recent-filings object was checked.",
      );
      expect(detail).toContain("Older continuation files were not loaded");
      expect(detail).toContain("The source lists older continuation files.");
      expect(outside).toContain("2026-07-15 to 2026-10-12");
      expect(outside).toContain("90 days · CIK 0000000001");
      expect(outside).toContain(`href="${response.issuer.sourceUrl}"`);
      expect(outside).toContain("Retrieved 2026-10-12T00:00:00.500Z");
      expect(outside).toContain(
        "Current recent-filings object only; complete 90-day coverage is not established.",
      );
      expect(outside).not.toContain("Request started");
      expect(outside).not.toContain("Completed");
      expect(outside).not.toContain("continuation files");
      expect(html).not.toMatch(/<details[^>]*\sopen/u);
      expect(html).not.toContain('role="status"');
    }
  });

  it("keeps the exact truncation warning outside the closed source disclosure", () => {
    const response = filingsResponse(1000);
    const packet = parseManagedSecFilingsResponse(
      {
        ...response,
        issuer: { ...response.issuer, matchingFilings: 1004, truncated: true },
      },
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: filingsSelection.catalogSnapshotSha256,
        listingId: filingsSelection.listing.listingId,
        symbol: filingsSelection.listing.symbol,
      },
    );
    expect(packet).not.toBeNull();
    if (!packet) throw new Error("Invalid invented truncation packet.");
    const html = renderToStaticMarkup(
      <ManagedFilingsSource response={packet} />,
    );
    const outside = html.replace(/<details\b.*?<\/details>/u, "");
    expect(outside).toContain('class="managed-filings-warning"');
    expect(outside).toContain(
      "Showing 1000 of 1004 matching entries retained from the current source object. The response limit truncated this list.",
    );
    expect(html).not.toMatch(/<details[^>]*\sopen/u);
  });

  it("keeps one uncontrolled source disclosure in the same slot through filters, retention and response replacement", () => {
    const response = filingsResponse(51);
    const original = page(response);
    original.buttons[1]!.props.onClick!();
    const paged = page(response);
    paged.select.props.onChange!({ currentTarget: { value: "8-K" } });
    const filtered = page(response);
    const retained = page(response);
    const empty = filingsResponse(0);
    const next = {
      ...empty,
      requestStartedAt: "2026-10-13T00:00:00.000Z",
      completedAt: "2026-10-13T00:00:01.000Z",
      window: managedSecFilingsWindow("2026-10-13T00:00:00.000Z")!,
      issuer: { ...empty.issuer, fetchedAt: "2026-10-13T00:00:00.500Z" },
    };
    const parsed = parseManagedSecFilingsResponse(next, {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: filingsSelection.catalogSnapshotSha256,
      listingId: filingsSelection.listing.listingId,
      symbol: filingsSelection.listing.symbol,
    });
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("Invalid invented replacement packet.");
    const replacement = page(parsed);
    const sourceElement = original.source;
    const disclosure = (source: typeof sourceElement) => {
      const rendered: React.ReactElement<{ children?: React.ReactNode }> =
        ManagedFilingsSource(source.props);
      const node = React.Children.toArray(rendered.props.children).find(
        (child) => React.isValidElement(child) && child.type === "details",
      );
      if (!React.isValidElement<React.ComponentProps<"details">>(node))
        throw new Error("Missing source disclosure.");
      return node;
    };
    const first = disclosure(sourceElement);
    for (const shown of [paged, filtered, retained, replacement]) {
      expect(shown.source.type).toBe(sourceElement.type);
      expect(shown.source.key).toBe(sourceElement.key);
      const current = disclosure(shown.source);
      expect(current.type).toBe("details");
      expect(current.key).toBe(first.key);
      expect(current.props.open).toBeUndefined();
      expect(current.props.onToggle).toBeUndefined();
      expect(current.props.ref).toBeUndefined();
      expect(current.props.className).toBe("managed-filings-source-details");
    }
    expect(retained.source.props.response).toBe(response);
    expect(replacement.source.props.response).toBe(parsed);
    const updated = renderToStaticMarkup(replacement.source);
    expect(updated).toContain("Retrieved 2026-10-13T00:00:00.500Z");
    expect(updated).toContain("<dd>2026-10-13T00:00:01.000Z</dd>");
    expect(updated).not.toContain("2026-10-12T");
    // This checks React structure. Actual native open state and focus need DOM QA.
  });

  it("uses an enabled native select and filters exact loaded rows before paging", () => {
    const response = filingsResponse();
    let shown = page(response);
    expect(shown.html).toContain(
      '<label for="managed-filings-form">Form</label>',
    );
    expect(shown.select.props.disabled).toBeUndefined();
    expect(
      elements(shown.select)
        .filter((node) => node.type === "option")
        .map((node) => node.props.value),
    ).toEqual(["", "10-Q", "8-K"]);
    shown.select.props.onChange!({ currentTarget: { value: "10-Q" } });
    shown = page(response);
    expect(shown.html).toContain("1 of 26 loaded filings · Page 1 of 1");
    expect(shown.html.match(/<li>/gu)).toHaveLength(1);
    expect(shown.html).toContain("0000000001-26-000001-index.htm");
    expect(shown.html).not.toContain("0000000001-26-000002-index.htm");
    expect(shown.buttons.every((button) => button.props["aria-disabled"])).toBe(
      true,
    );
    shown.select.props.onChange!({ currentTarget: { value: "8-K" } });
    shown = page(response);
    expect(shown.html).toContain("25 of 26 loaded filings · Page 1 of 1");
    expect(shown.html.match(/<li>/gu)).toHaveLength(25);
    expect(shown.html).not.toContain("0000000001-26-000001-index.htm");
    shown.select.props.onChange!({ currentTarget: { value: "" } });
    expect(page(response).html).toContain(
      "26 of 26 loaded filings · Page 1 of 2",
    );
  });

  it("keeps form, select and page handlers bound to the current rendered selection", () => {
    const response = filingsResponse(51);
    const original = page(response);
    original.buttons[1]!.props.onClick!();
    let shown = page(response);
    expect(shown.html).toContain("Page 2 of 3");
    shown.select.props.onChange!({ currentTarget: { value: "10-Q" } });
    original.buttons[1]!.props.onClick!();
    original.select.props.onChange!({ currentTarget: { value: "8-K" } });
    shown = page(response);
    expect(shown.html).toContain("1 of 51 loaded filings · Page 1 of 1");
    shown.select.props.onChange!({ currentTarget: { value: "10-q" } });
    expect(page(response).html).toBe(shown.html);
    const replacement = filingsResponse(51);
    const reset = page(replacement);
    shown.select.props.onChange!({ currentTarget: { value: "8-K" } });
    shown.buttons[1]!.props.onClick!();
    expect(page(replacement).html).toBe(reset.html);
    expect(reset.select.type).toBe(shown.select.type);
    expect(reset.select.key).toBe(shown.select.key);
    expect(reset.node.type).toBe(shown.node.type);
    expect(reset.html).toContain(
      "Filings response changed; showing All forms, all filing dates and All loaded filings from page one.",
    );
  });

  it("shows reset notice for a changed response but never for initial mount or unchanged defaults", () => {
    const response = filingsResponse();
    const initial = page(response);
    expect(initial.html).not.toContain("Filings response changed;");
    expect(page(filingsResponse()).html).not.toContain(
      "Filings response changed;",
    );
    const before = page(response);
    before.select.props.onChange!({ currentTarget: { value: "8-K" } });
    const empty = filingsResponse(0);
    const after = page(empty);
    expect(after.html).toContain("0 of 0 loaded filings · Page 1 of 1");
    expect(after.html).toContain("No matching filings were observed");
    expect(after.html).toContain(
      "Filings response changed; showing All forms, all filing dates and All loaded filings from page one.",
    );
    expect(after.select.props.value).toBe("");
    expect(after.select.props.disabled).toBeUndefined();
    expect(
      elements(after.select).filter((node) => node.type === "option"),
    ).toHaveLength(1);
    hooks.state = undefined; // A section/visit remount starts a new presentation state.
    expect(page(response).html).toBe(initial.html);
  });

  it("keeps original row and response identity for note actions and never appends through filtering", () => {
    const response = filingsResponse();
    const actions: ManagedFilingsNoteActions = {
      getAction: vi.fn(() => ({ canAppend: true, reason: null })),
      append: vi.fn(() => ({ appended: true, message: "Added to draft." })),
    };
    page(response, actions).select.props.onChange!({
      currentTarget: { value: "8-K" },
    });
    vi.mocked(actions.getAction).mockClear();
    const shown = page(response, actions);
    expect(shown.html.match(/Add reference to note draft/gu)).toHaveLength(25);
    const calls = vi.mocked(actions.getAction).mock.calls;
    expect(calls).toHaveLength(25);
    for (const [index, [packet, row]] of calls.entries()) {
      expect(packet).toBe(response);
      expect(row).toBe(response.issuer.filings[index + 1]);
    }
    expect(actions.append).not.toHaveBeenCalled();
  });

  it("preserves choice during pending, Cancel and retained failed refresh without extra reads", async () => {
    const read = vi
      .fn<ManagedApi["recentFilings"]>()
      .mockResolvedValueOnce(filingsResponse(51));
    const model = new Model(read, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
    });
    model.open(filingsSelection);
    await model.load();
    const response = model.getSnapshot().response!;
    page(response).select.props.onChange!({ currentTarget: { value: "8-K" } });
    page(response).buttons[1]!.props.onClick!();
    const selected = page(response).html;
    expect(selected).toContain("50 of 51 loaded filings · Page 2 of 2");
    let release!: (value: ReturnType<typeof filingsResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = model.load();
    expect(model.getSnapshot().running).toBe(true);
    expect(page(model.getSnapshot().response!).html).toBe(selected);
    model.cancel();
    expect(page(model.getSnapshot().response!).html).toBe(selected);
    release(filingsResponse(0));
    await pending;
    expect(model.getSnapshot().response).toBe(response);
    read.mockResolvedValueOnce(filingsResponse(0, "upstream_unavailable"));
    await model.load();
    expect(model.getSnapshot().showingPrevious).toBe(true);
    expect(page(model.getSnapshot().response!).html).toBe(selected);
    expect(read).toHaveBeenCalledTimes(3);
    read.mockResolvedValueOnce(filingsResponse(0));
    await model.load();
    expect(page(model.getSnapshot().response!).html).toContain(
      "Filings response changed; showing All forms, all filing dates and All loaded filings from page one.",
    );
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("shows exact source dates, accession links and 25 local rows with guarded focusable pagination", () => {
    const response = filingsResponse();
    let shown = page(response);
    expect(shown.html).toContain(
      'aria-label="SEC filings results" tabindex="0"',
    );
    expect(shown.html.match(/<li>/gu)).toHaveLength(25);
    expect(shown.html).toContain("26 of 26 loaded filings · Page 1 of 2");
    expect(shown.html).toContain("Retrieved 2026-10-12T00:00:00.500Z");
    expect(shown.html).toContain("2026-07-15 to 2026-10-12");
    expect(shown.html).toContain("Report date");
    expect(shown.html).toContain("Not reported");
    expect(shown.html).toContain(
      "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    );
    expect(shown.html).toContain("complete coverage");
    expect(shown.html).toContain("older continuation files");
    expect(shown.buttons[0]!.props["aria-disabled"]).toBe(true);
    shown.buttons[0]!.props.onClick!();
    expect(page(response).html).toBe(shown.html);
    shown.buttons[1]!.props.onClick!();
    shown = page(response);
    expect(shown.html.match(/<li>/gu)).toHaveLength(1);
    expect(shown.html).toContain("Page 2 of 2");
    expect(shown.html).toContain("0000000001-26-000026");
    expect(shown.html).not.toContain("0000000001-26-000001-index.htm");
    expect(shown.buttons[1]!.props["aria-disabled"]).toBe(true);
    shown.buttons[1]!.props.onClick!();
    expect(page(response).html).toBe(shown.html);
    shown.buttons[0]!.props.onClick!();
    expect(page(response).html).toContain("Page 1 of 2");
  });
  it("resets paging on replacement while keeping the same unkeyed results host and controls", () => {
    const response = filingsResponse(51);
    page(response).buttons[1]!.props.onClick!();
    expect(page(response).html).toContain("Page 2 of 3");
    const replacement = filingsResponse(1);
    const before = page(response).node;
    const after = page(replacement).node;
    expect(after.type).toBe(before.type);
    expect(after.key).toBeNull();
    expect(page(replacement).html).toContain("Page 1 of 1");
    expect(page(replacement).buttons).toHaveLength(2);
  });
  it("separates available-empty from failed source attempts and never labels failures retrieved", async () => {
    for (const status of [
      "available",
      "not_covered",
      "invalid_response",
      "rate_limited",
      "upstream_unavailable",
    ] as const) {
      hooks.state = undefined;
      const read = vi
        .fn<ManagedApi["recentFilings"]>()
        .mockResolvedValue(filingsResponse(0, status));
      const model = new Model(read, vi.fn(), undefined, {
        coverage: inventedManagedResearchCoverage,
      });
      model.open(filingsSelection);
      await model.load();
      const html = renderToStaticMarkup(
        <ManagedCompanyFilings
          model={model}
          annual={
            new AnnualModel(vi.fn(), vi.fn(), undefined, {
              coverage: inventedManagedResearchCoverage,
            })
          }
        />,
      );
      if (status === "available")
        expect(html).toContain("No matching filings were observed");
      else {
        const outside = html.replace(/<details\b.*?<\/details>/gu, "");
        expect(html).not.toContain("No matching filings");
        expect(html).toContain("Checked 2026-10-12T00:00:00.500Z");
        expect(html).not.toContain("Retrieved");
        expect(html).toContain("contents were not successfully validated");
        expect(outside).toContain("Checked 2026-10-12T00:00:00.500Z");
        expect(outside).toContain("Source contents were not validated");
        expect(outside).toContain(
          "complete 90-day coverage is not established",
        );
        expect(html).toContain(
          "Form filtering is unavailable for this response.",
        );
      }
      expect(html).toContain('id="managed-filings-form"');
      expect(html.match(/<option /gu)).toHaveLength(4);
      expect(html).toContain(
        '<option value="new" disabled="">Newly observed</option>',
      );
      expect(html).not.toMatch(/<select[^>]*\sdisabled/gu);
      expect(html).not.toContain("Append");
      expect(read).toHaveBeenCalledOnce();
    }
  });
  it("shows previous source metadata separately from the latest failed check", async () => {
    const read = vi
      .fn<ManagedApi["recentFilings"]>()
      .mockResolvedValueOnce(filingsResponse());
    const model = new Model(read, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
    });
    model.open(filingsSelection);
    await model.load();
    read.mockResolvedValueOnce({
      ...filingsResponse(0, "upstream_unavailable"),
      completedAt: "2026-10-12T00:00:02.000Z",
    });
    await model.load();
    const html = renderToStaticMarkup(
      <ManagedCompanyFilings
        model={model}
        annual={
          new AnnualModel(vi.fn(), vi.fn(), undefined, {
            coverage: inventedManagedResearchCoverage,
          })
        }
      />,
    );
    expect(html).toContain(
      "Showing the previous filings response, completed 2026-10-12T00:00:01.000Z",
    );
    expect(html).toContain(
      "Latest source attempt checked 2026-10-12T00:00:00.500Z; completed 2026-10-12T00:00:02.000Z",
    );
    expect(html).toContain("26 of 26 loaded filings");
    const outside = html.replace(/<details\b.*?<\/details>/gu, "");
    expect(outside).toContain(
      "Showing the previous filings response, completed 2026-10-12T00:00:01.000Z",
    );
    expect(outside).toContain(
      "Latest source attempt checked 2026-10-12T00:00:00.500Z; completed 2026-10-12T00:00:02.000Z",
    );
  });
});

describe("filings after the current Annual report", () => {
  async function loaded() {
    const annualRead = vi
      .fn<ManagedApi["annualReport"]>()
      .mockResolvedValue(await annualResponse());
    const annual = new AnnualModel(annualRead, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
    });
    const filingsRead = vi
      .fn<ManagedApi["recentFilings"]>()
      .mockResolvedValue(filingsResponse());
    const filings = new Model(filingsRead, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
    });
    annual.open(filingsSelection);
    filings.open(filingsSelection);
    await annual.load();
    await filings.load();
    const baseline = getManagedFilingsAnnualBaseline(
      annual.getSnapshot(),
      filings.getSnapshot(),
    )!;
    expect(baseline).not.toBeNull();
    return {
      annual,
      filings,
      annualRead,
      filingsRead,
      baseline,
      response: filings.getSnapshot().response!,
    };
  }

  it("uses the admitted Annual target, keeps original row note actions and combines date with Form without a read", async () => {
    const { baseline, response, annualRead, filingsRead } = await loaded();
    const actions: ManagedFilingsNoteActions = {
      getAction: vi.fn(() => ({ canAppend: true, reason: null })),
      append: vi.fn(() => ({ appended: true, message: "Added to draft." })),
    };
    let shown = page(response, actions, baseline);
    expect(shown.html).toContain("Annual report filed 2026-02-01");
    expect(shown.html).toContain(
      "Same-day filings remain in All loaded filings",
    );
    expect(shown.html).toContain("Annual baseline and date limits");
    expect(shown.html).toContain(
      "This Annual filing predates the loaded window",
    );
    shown.dateScope.props.onScope("after-annual");
    vi.mocked(actions.getAction).mockClear();
    shown = page(response, actions, baseline);
    expect(shown.html).toContain("25 of 26 loaded filings · Page 1 of 1");
    expect(shown.dateScope.props.scope).toBe("after-annual");
    expect(
      vi.mocked(actions.getAction).mock.calls.map(([, row]) => row),
    ).toEqual(response.issuer.filings.slice(1));
    for (const [packet, row] of vi.mocked(actions.getAction).mock.calls) {
      expect(packet).toBe(response);
      expect(response.issuer.filings).toContain(row);
    }
    shown.select.props.onChange!({ currentTarget: { value: "10-Q" } });
    shown = page(response, actions, baseline);
    expect(shown.html).toContain("0 of 26 loaded filings");
    expect(shown.html).toContain(
      "No later-dated filings match these filters in this loaded response",
    );
    expect(shown.html).toContain(
      "does not establish that no subsequent filings exist",
    );
    expect(shown.html).toContain("Older continuation files were not loaded");
    expect(annualRead).toHaveBeenCalledOnce();
    expect(filingsRead).toHaveBeenCalledOnce();
    expect(actions.append).not.toHaveBeenCalled();
  });

  it("announces an Annual replacement, preserves Form and refuses stale date handlers", async () => {
    const { baseline, response } = await loaded();
    let shown = page(response, undefined, baseline);
    shown.select.props.onChange!({ currentTarget: { value: "8-K" } });
    shown = page(response, undefined, baseline);
    shown.dateScope.props.onScope("after-annual");
    const stale = page(response, undefined, baseline);
    const replacement = { ...baseline, response: { ...baseline.response } };
    const reset = page(response, undefined, replacement);
    expect(reset.dateScope.props.scope).toBe("all");
    expect(reset.select.props.value).toBe("8-K");
    expect(reset.html).toContain(
      "Annual baseline changed; showing all filing dates from page one. Your Form and Refresh view filters are unchanged.",
    );
    stale.dateScope.props.onScope("after-annual");
    expect(page(response, undefined, replacement).html).toBe(reset.html);
    reset.dateScope.props.onScope("after-annual");
    const selected = page(response, undefined, replacement);
    expect(selected.dateScope.props.scope).toBe("after-annual");
    const lost = page(response);
    expect(lost.dateScope.props.baseline).toBeNull();
    expect(lost.dateScope.props.scope).toBe("all");
    selected.dateScope.props.onScope("after-annual");
    expect(page(response).html).toBe(lost.html);
  });

  it("renders current model context, original clocks and retained/historical qualifications", async () => {
    const { annual, filings, annualRead, filingsRead } = await loaded();
    annualRead.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await annual.load();
    let html = renderToStaticMarkup(
      <ManagedCompanyFilings model={filings} annual={annual} />,
    );
    expect(html).toContain(
      "Previous Annual report retained; newer evidence was not confirmed.",
    );
    expect(html).toContain("Annual cutoff 2026-09-20T00:00:00.000Z");
    expect(html).toContain("Completed 2026-09-20T00:00:02.000Z");
    expect(html).toContain("0000000001-26-000001");
    annualRead.mockResolvedValueOnce(
      await annualResponse(undefined, "2028-09-20T00:00:00.000Z"),
    );
    await annual.load();
    html = renderToStaticMarkup(
      <ManagedCompanyFilings model={filings} annual={annual} />,
    );
    expect(html).toContain("outside the current-use age limits");
    expect(html).toContain("Annual cutoff 2028-09-20T00:00:00.000Z");
    expect(html).not.toContain("Previous Annual report retained");
    expect(filingsRead).toHaveBeenCalledOnce();
    annual.close();
    html = renderToStaticMarkup(
      <ManagedCompanyFilings model={filings} annual={annual} />,
    );
    expect(html).toContain("Date filtering needs a loaded Annual report");
    expect(html).not.toContain("Annual baseline and date limits");
    expect(html).toContain("26 of 26 loaded filings");
  });
});

describe("consecutive loaded filing lists", () => {
  function checked(response = filingsResponse()) {
    const parsed = parseManagedSecFilingsResponse(response, {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: filingsSelection.catalogSnapshotSha256,
      listingId: filingsSelection.listing.listingId,
      symbol: filingsSelection.listing.symbol,
    });
    expect(parsed).not.toBeNull();
    return parsed!;
  }

  function later(count: number) {
    return checked({
      ...filingsResponse(count),
      requestStartedAt: "2026-10-13T00:00:00.000Z",
      completedAt: "2026-10-13T00:00:01.000Z",
      window: managedSecFilingsWindow("2026-10-13T00:00:00.000Z")!,
      issuer: {
        ...filingsResponse(count).issuer,
        fetchedAt: "2026-10-13T00:00:00.500Z",
      },
    });
  }

  function panel(model: Model) {
    return renderToStaticMarkup(
      <ManagedCompanyFilings
        model={model}
        annual={
          new AnnualModel(vi.fn(), vi.fn(), undefined, {
            coverage: inventedManagedResearchCoverage,
          })
        }
      />,
    );
  }

  it("makes no comparison claim on the first packet or in single-packet mode", async () => {
    for (const compareRefresh of [false, true]) {
      const read = vi
        .fn<ManagedApi["recentFilings"]>()
        .mockResolvedValueOnce(checked(filingsResponse(1)))
        .mockResolvedValueOnce(later(2));
      const model = new Model(read, vi.fn(), undefined, {
        coverage: inventedManagedResearchCoverage,
        compareRefresh,
      });
      model.open(filingsSelection);
      await model.load();
      expect(panel(model)).not.toContain("managed-filings-refresh-count");
      expect(panel(model)).not.toContain("Compared loaded lists");
      await model.load();
      if (compareRefresh)
        expect(panel(model)).toContain(
          "1 of 2 filings in the displayed response.",
        );
      else expect(panel(model)).not.toContain("Compared loaded lists");
      expect(read).toHaveBeenCalledTimes(2);
    }
  });

  it("rejects a stale pair even when the replacement has equal contents", () => {
    const current = later(2);
    const comparison = compareManagedFilingsResponses(
      checked(filingsResponse(1)),
      current,
    )!;
    expect(page(current, undefined, null, comparison).html).toContain(
      "Compared loaded lists",
    );
    const replacement = checked(current);
    expect(replacement).not.toBe(current);
    const html = page(replacement, undefined, null, comparison).html;
    expect(html).not.toContain("Compared loaded lists");
    expect(html).not.toContain("managed-filings-refresh-count");
    expect(html).toContain("2 of 2 loaded filings");
    const unavailable = checked(filingsResponse(0, "invalid_response"));
    expect(page(unavailable, undefined, null, comparison).html).not.toContain(
      "Compared loaded lists",
    );
  });

  it("keeps the count across pages and Form filters while marking only current rows", () => {
    const current = later(51);
    const comparison = compareManagedFilingsResponses(
      checked(filingsResponse(26)),
      current,
    )!;
    const actions: ManagedFilingsNoteActions = {
      getAction: vi.fn(() => ({ canAppend: true, reason: null })),
      append: vi.fn(() => ({ appended: true, message: "Added to draft." })),
    };
    let shown = page(current, actions, null, comparison);
    const count =
      "Newly observed in this refresh: 25 of 51 filings in the displayed response.";
    expect(shown.html).toContain(count);
    expect(shown.html).not.toContain("data-filings-new-accession");
    shown.buttons[1]!.props.onClick!();
    vi.mocked(actions.getAction).mockClear();
    shown = page(current, actions, null, comparison);
    expect(shown.html).toContain(count);
    expect(shown.html.match(/data-filings-new-accession=/gu)).toHaveLength(24);
    const calls = vi.mocked(actions.getAction).mock.calls;
    expect(calls).toHaveLength(25);
    for (const [index, [packet, row]] of calls.entries()) {
      expect(packet).toBe(current);
      expect(row).toBe(current.issuer.filings[index + 25]);
    }
    shown.buttons[1]!.props.onClick!();
    shown = page(current, actions, null, comparison);
    expect(shown.html.match(/data-filings-new-accession=/gu)).toHaveLength(1);
    expect(shown.html).toContain(
      'data-filings-new-accession="0000000001-26-000051"',
    );
    shown.select.props.onChange!({ currentTarget: { value: "10-Q" } });
    shown = page(current, actions, null, comparison);
    expect(shown.html).toContain(count);
    expect(shown.html).not.toContain("data-filings-new-accession");
    expect(shown.html).toContain("1 of 51 loaded filings · Page 1 of 1");
    expect(actions.append).not.toHaveBeenCalled();
  });

  it("keeps the full count when the Annual date scope hides the newly observed row", async () => {
    const original = filingsResponse(1);
    const current = checked({
      ...original,
      requestStartedAt: "2026-02-02T00:00:00.000Z",
      completedAt: "2026-02-02T00:00:01.000Z",
      window: managedSecFilingsWindow("2026-02-02T00:00:00.000Z")!,
      issuer: {
        ...original.issuer,
        fetchedAt: "2026-02-02T00:00:00.500Z",
        filings: original.issuer.filings.map((row) => ({
          ...row,
          filingDate: "2026-02-01",
          reportDate: "2025-12-31",
        })),
      },
    });
    const comparison = compareManagedFilingsResponses(
      checked(filingsResponse(0)),
      current,
    )!;
    const report = await annualResponse();
    const target = report.evidence.target;
    expect(target.status).toBe("target");
    if (target.status !== "target") throw new Error("Expected Annual target");
    const baseline: ManagedFilingsAnnualBaseline = {
      response: report,
      target,
    };
    const shown = page(current, undefined, baseline, comparison);
    shown.dateScope.props.onScope("after-annual");
    const filtered = page(current, undefined, baseline, comparison).html;
    expect(filtered).toContain("0 of 1 loaded filings");
    expect(filtered).toContain(
      "Newly observed in this refresh: 1 of 1 filings in the displayed response.",
    );
    expect(filtered).not.toContain("data-filings-new-accession");
  });

  it("keeps both original clocks, windows and incomplete-list limits in one closed disclosure", () => {
    const previous = checked({
      ...filingsResponse(1000),
      issuer: {
        ...filingsResponse(1000).issuer,
        matchingFilings: 1002,
        truncated: true,
      },
    });
    const current = later(2);
    const comparison = compareManagedFilingsResponses(previous, current)!;
    const html = page(current, undefined, null, comparison).html;
    expect(
      html.match(/<summary>Compared loaded lists<\/summary>/gu),
    ).toHaveLength(1);
    expect(html).toContain("<details><summary>Compared loaded lists</summary>");
    expect(html).toContain('aria-label="Previous loaded list"');
    expect(html).toContain('aria-label="Current loaded list"');
    for (const packet of [previous, current]) {
      expect(html).toContain(packet.requestStartedAt);
      expect(html).toContain(packet.completedAt);
      expect(html).toContain(packet.issuer.fetchedAt);
      expect(html).toContain(
        `${packet.window.fromDate} to ${packet.window.throughDate}`,
      );
      expect(html).toContain(`href="${packet.issuer.sourceUrl}"`);
    }
    expect(html).toContain("1000 of 1002 matching entries");
    expect(html).toContain("This list was truncated.");
    expect(html).toContain("This list was not truncated.");
    expect(html).toContain("Listed by the source; not loaded.");
    expect(html).toContain(
      "Different windows and response limits can affect which accessions appear in each list.",
    );
    expect(html).toContain(
      "This does not establish when they were published or that either list is complete.",
    );
    expect(html.indexOf("Retrieved 2026-10-13T00:00:00.500Z")).toBeLessThan(
      html.indexOf("<details>"),
    );
  });

  it("shows zero for an equal or empty accepted replacement without implying no filings exist", () => {
    const previous = checked(filingsResponse(2));
    for (const current of [checked(previous), checked(filingsResponse(0))]) {
      const comparison = compareManagedFilingsResponses(previous, current)!;
      const html = page(current, undefined, null, comparison).html;
      expect(html).toContain(
        `Newly observed in this refresh: 0 of ${current.issuer.filings.length} filings in the displayed response.`,
      );
      expect(html).not.toContain("data-filings-new-accession");
      expect(html).toContain("Compared loaded lists");
      expect(html).toContain("either list is complete");
    }
  });

  it("retains the displayed pair through pending, Cancel and failure, then clears it on invalid evidence", async () => {
    const read = vi
      .fn<ManagedApi["recentFilings"]>()
      .mockResolvedValueOnce(checked(filingsResponse(1)))
      .mockResolvedValueOnce(later(2));
    const model = new Model(read, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
      compareRefresh: true,
    });
    model.open(filingsSelection);
    await model.load();
    await model.load();
    const comparison = model.getSnapshot().refreshComparison!;
    expect(comparison).not.toBeNull();
    let release!: (value: ReturnType<typeof filingsResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = model.load();
    for (const cancelled of [false, true]) {
      if (cancelled) model.cancel();
      expect(model.getSnapshot().refreshComparison).toBe(comparison);
      expect(panel(model)).toContain(
        "1 of 2 filings in the displayed response.",
      );
      expect(panel(model)).toContain(
        "This attempt has not confirmed newer filings",
      );
      expect(panel(model)).toContain(comparison.previous.completedAt);
      expect(panel(model)).toContain(comparison.current.completedAt);
    }
    release(later(0));
    await pending;
    read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await model.load();
    expect(model.getSnapshot().refreshComparison).toBe(comparison);
    expect(panel(model)).toContain("1 of 2 filings in the displayed response.");
    read.mockResolvedValueOnce(checked(filingsResponse(0, "invalid_response")));
    await model.load();
    expect(panel(model)).not.toContain("Compared loaded lists");
    expect(panel(model)).not.toContain("managed-filings-refresh-count");
    expect(read).toHaveBeenCalledTimes(5);
  });

  it("exposes a guarded native refresh selector before a comparison exists", () => {
    const current = checked(filingsResponse(2));
    const shown = page(current);
    const child = ManagedFilingsRefreshView(shown.refreshView.props);
    const select = elements(child).find((node) => node.type === "select")!;
    expect(shown.html).toContain(
      '<label for="managed-filings-refresh-view">Refresh view</label>',
    );
    expect(shown.html).toContain(
      'aria-describedby="managed-filings-refresh-help"',
    );
    expect(select.props.disabled).toBeUndefined();
    expect(
      elements(select)
        .filter((node) => node.type === "option")
        .map((node) => [node.props.value, node.props.disabled]),
    ).toEqual([
      ["all", undefined],
      ["new", true],
    ]);
    expect(shown.html).toContain(
      "needs two available lists from this company visit",
    );
    select.props.onChange!({ currentTarget: { value: "new" } });
    select.props.onChange!({ currentTarget: { value: "forged" } });
    expect(page(current).html).toBe(shown.html);
  });

  it("finds original newly observed rows beyond page one and composes Form without changing note inputs", () => {
    const laterPacket = later(51);
    const current = checked({
      ...laterPacket,
      issuer: {
        ...laterPacket.issuer,
        filings: laterPacket.issuer.filings.map((row, index) =>
          index >= 26 ? { ...row, filingDate: "2026-10-10" } : row,
        ),
      },
    });
    const comparison = compareManagedFilingsResponses(
      checked(filingsResponse(26)),
      current,
    )!;
    const actions: ManagedFilingsNoteActions = {
      getAction: vi.fn(() => ({ canAppend: true, reason: null })),
      append: vi.fn(() => ({ appended: true, message: "Added to draft." })),
    };
    let shown = page(current, actions, null, comparison);
    shown.buttons[1]!.props.onClick!();
    shown = page(current, actions, null, comparison);
    shown.refreshView.props.onSelect("new");
    vi.mocked(actions.getAction).mockClear();
    shown = page(current, actions, null, comparison);
    expect(shown.html).toContain("25 of 51 loaded filings · Page 1 of 1");
    expect(shown.html).toContain(
      "Newly observed in this refresh: 25 of 51 filings in the displayed response.",
    );
    expect(shown.html.match(/data-filings-new-accession=/gu)).toHaveLength(25);
    expect(shown.html.match(/<dd>2026-10-10<\/dd>/gu)).toHaveLength(25);
    const calls = vi.mocked(actions.getAction).mock.calls;
    expect(calls).toHaveLength(25);
    for (const [index, [packet, row]] of calls.entries()) {
      expect(packet).toBe(current);
      expect(row).toBe(current.issuer.filings[index + 26]);
    }
    expect(actions.append).not.toHaveBeenCalled();
    shown.select.props.onChange!({ currentTarget: { value: "10-Q" } });
    shown = page(current, actions, null, comparison);
    expect(shown.html).toContain("0 of 51 loaded filings");
    expect(shown.html).toContain(
      "No newly observed filings match these filters in this loaded response.",
    );
    expect(shown.html).toContain(
      "This does not establish that no new SEC filings exist.",
    );
    expect(shown.html).toContain(
      "Newly observed in this refresh: 25 of 51 filings",
    );
    shown.select.props.onChange!({ currentTarget: { value: "8-K" } });
    expect(page(current, actions, null, comparison).html).toContain(
      "25 of 51 loaded filings",
    );
    expect(actions.append).not.toHaveBeenCalled();
  });

  it.each([0, 2])(
    "keeps zero-new filtering available for a %i-row admitted comparison with qualified empty text",
    (count) => {
      const previous = checked(filingsResponse(2));
      const current = checked(filingsResponse(count));
      const comparison = compareManagedFilingsResponses(previous, current)!;
      page(current, undefined, null, comparison).refreshView.props.onSelect(
        "new",
      );
      const shown = page(current, undefined, null, comparison);
      expect(shown.refreshView.props.value).toBe("new");
      expect(shown.refreshView.props.available).toBe(true);
      expect(shown.html).toContain(
        `0 of ${count} loaded filings · Page 1 of 1`,
      );
      expect(shown.html).toContain(
        "No newly observed filings match these filters in this loaded response.",
      );
      expect(shown.html).toContain(
        "This does not establish that no new SEC filings exist.",
      );
      expect(shown.html).toContain("Compared loaded lists");
      expect(shown.html).not.toContain("No matching filings were observed");
    },
  );

  it("keeps Refresh view through Annual-only replacement and announces simultaneous resets accurately", async () => {
    const report = await annualResponse();
    const target = report.evidence.target;
    if (target.status !== "target") throw new Error("Expected Annual target");
    const baseline = { response: report, target };
    const current = later(51);
    const comparison = compareManagedFilingsResponses(
      checked(filingsResponse(0)),
      current,
    )!;
    let shown = page(current, undefined, baseline, comparison);
    shown.refreshView.props.onSelect("new");
    shown = page(current, undefined, baseline, comparison);
    shown.select.props.onChange!({ currentTarget: { value: "8-K" } });
    shown = page(current, undefined, baseline, comparison);
    shown.dateScope.props.onScope("after-annual");
    shown = page(current, undefined, baseline, comparison);
    shown.buttons[1]!.props.onClick!();
    const stale = page(current, undefined, baseline, comparison);
    expect(stale.html).toContain("Page 2 of 2");
    const replacement = { ...baseline, response: { ...report } };
    shown = page(current, undefined, replacement, comparison);
    expect(shown.refreshView.props.value).toBe("new");
    expect(shown.select.props.value).toBe("8-K");
    expect(shown.dateScope.props.scope).toBe("all");
    expect(shown.html).toContain(
      "Your Form and Refresh view filters are unchanged.",
    );
    stale.refreshView.props.onSelect("all");
    expect(page(current, undefined, replacement, comparison).html).toBe(
      shown.html,
    );
    shown.dateScope.props.onScope("after-annual");
    const both = page(current, undefined, baseline, null);
    expect(both.refreshView.props.value).toBe("all");
    expect(both.dateScope.props.scope).toBe("all");
    expect(both.select.props.value).toBe("8-K");
    expect(both.html).toContain(
      "Annual baseline and loaded-list comparison changed;",
    );
  });

  it("resets and fences captured refresh handlers when only the comparison changes or is lost", () => {
    const current = later(51);
    const comparison = compareManagedFilingsResponses(
      checked(filingsResponse(26)),
      current,
    )!;
    let shown = page(current, undefined, null, comparison);
    shown.select.props.onChange!({ currentTarget: { value: "8-K" } });
    shown = page(current, undefined, null, comparison);
    shown.refreshView.props.onSelect("new");
    const stale = page(current, undefined, null, comparison);
    const nextPair = compareManagedFilingsResponses(
      checked(filingsResponse(50)),
      current,
    )!;
    const reset = page(current, undefined, null, nextPair);
    expect(reset.refreshView.props.value).toBe("all");
    expect(reset.select.props.value).toBe("8-K");
    expect(reset.html).toContain("Loaded-list comparison changed;");
    expect(reset.html).toContain(
      "Your Form and Filing date filters are unchanged.",
    );
    stale.refreshView.props.onSelect("new");
    stale.select.props.onChange!({ currentTarget: { value: "10-Q" } });
    stale.buttons[1]!.props.onClick!();
    expect(page(current, undefined, null, nextPair).html).toBe(reset.html);
    reset.refreshView.props.onSelect("new");
    const selected = page(current, undefined, null, nextPair);
    expect(selected.html).toContain("1 of 51 loaded filings");
    const lost = page(current);
    selected.refreshView.props.onSelect("new");
    expect(page(current).html).toBe(lost.html);
    expect(lost.refreshView.props.available).toBe(false);
    expect(lost.html).not.toContain("Compared loaded lists");
    expect(lost.html).not.toContain("data-filings-new-accession");
    expect(lost.node.type).toBe(selected.node.type);
  });

  it("retains new-only paging through pending, Cancel and failure, then resets on equal-content successful replacement", async () => {
    const read = vi
      .fn<ManagedApi["recentFilings"]>()
      .mockResolvedValueOnce(checked(filingsResponse(1)))
      .mockResolvedValueOnce(later(51));
    const model = new Model(read, vi.fn(), undefined, {
      coverage: inventedManagedResearchCoverage,
      compareRefresh: true,
    });
    model.open(filingsSelection);
    await model.load();
    await model.load();
    const current = model.getSnapshot().response!;
    const comparison = model.getSnapshot().refreshComparison!;
    page(current, undefined, null, comparison).refreshView.props.onSelect(
      "new",
    );
    page(current, undefined, null, comparison).buttons[1]!.props.onClick!();
    const selected = page(current, undefined, null, comparison);
    expect(selected.html).toContain("50 of 51 loaded filings · Page 2 of 2");
    let release!: (value: ReturnType<typeof filingsResponse>) => void;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = model.load();
    const retained = () =>
      page(
        model.getSnapshot().response!,
        undefined,
        null,
        model.getSnapshot().refreshComparison,
      );
    expect(retained().html).toBe(selected.html);
    model.cancel();
    expect(retained().html).toBe(selected.html);
    release(later(0));
    await pending;
    expect(retained().html).toBe(selected.html);
    read.mockRejectedValueOnce(new TrialApiError("unavailable"));
    await model.load();
    expect(retained().html).toBe(selected.html);
    expect(panel(model)).toContain(
      "This attempt has not confirmed newer filings",
    );
    read.mockResolvedValueOnce(checked(current));
    await model.load();
    const reset = retained();
    expect(reset.refreshView.props.value).toBe("all");
    expect(reset.html).toContain(
      "Filings response changed; showing All forms, all filing dates and All loaded filings from page one.",
    );
    selected.refreshView.props.onSelect("new");
    selected.buttons[1]!.props.onClick!();
    expect(retained().html).toBe(reset.html);
    expect(read).toHaveBeenCalledTimes(5);
  });
});
