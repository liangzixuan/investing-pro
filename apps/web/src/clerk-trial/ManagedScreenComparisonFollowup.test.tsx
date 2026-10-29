import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedScreenComparisonFollowupView } from "./ManagedScreenComparisonFollowup";
import { emptyScreenComparisonFollowup } from "./use-screen-comparison-followup-state";
import { ScreenComparisonFollowupReview } from "./use-screen-comparison-followup-state";
import type { ScreenComparisonFollowupControls } from "./use-screen-comparison-followup-review";
import {
  comparisonFollowupFixture,
  disposeComparisonFollowupFixture,
} from "./managed-screen-comparison-followup-fixture";
import { identityLabels } from "./ManagedListingIdentity";

vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => "comparison-check-ui",
    useLayoutEffect: () => {},
    useRef: (current: unknown) => ({ current }),
  };
});
const fixtures: Awaited<ReturnType<typeof comparisonFollowupFixture>>[] = [];
afterEach(() => {
  fixtures.splice(0).forEach(disposeComparisonFollowupFixture);
  vi.restoreAllMocks();
});
async function fixture(preview = false) {
  const f = await comparisonFollowupFixture();
  fixtures.push(f);
  const state = {
    ...emptyScreenComparisonFollowup(),
    open: preview,
    capture: preview ? f.source : null,
    side: preview ? "right" : "",
    question: "Does this comparison change my research? Café 東京 📈",
    dueOn: "2026-12-31",
    preview: preview
      ? f.prepare(
          "Does this comparison change my research? Café 東京 📈",
          "2026-12-31",
          "right",
        ).preview
      : null,
  };
  const controls: ScreenComparisonFollowupControls = {
    state,
    destinations: preview ? f.context.destinations(f.source) : [],
    saved: f.followups.coordinator.getSnapshot(),
    disabled: !state.open,
    canCapture: state.open,
    canLoad: false,
    canPrepare: preview,
    readinessReason: null,
    canReview: false,
    setOpen: vi.fn(),
    capture: vi.fn(),
    edit: vi.fn(),
    load: vi.fn(),
    prepare: vi.fn(),
    create: vi.fn(),
    review: vi.fn(),
    cancel: vi.fn(() => true),
  };
  return {
    ...f,
    controls,
    view: () => ManagedScreenComparisonFollowupView({ controls }),
  };
}
type Element = React.ReactElement<Record<string, unknown>>;
function nodes(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      nodes,
    ),
  ];
}
function byId(tree: React.ReactNode, id: string) {
  const node = nodes(tree).find((element) => element.props.id === id);
  if (!node) throw new Error(`Missing ${id}`);
  return node.props;
}

describe("complete comparison dated-check controls", () => {
  it("starts in a closed disclosure and opens only through its explicit summary action", async () => {
    const f = await fixture();
    const tree = f.view();
    const $ = load(renderToStaticMarkup(tree));
    expect($("#screen-comparison-followup").attr("open")).toBeUndefined();
    expect($("#screen-comparison-followup-toggle").text()).toBe(
      "Keep a dated comparison check",
    );
    expect(
      $("#screen-comparison-followup-company option")
        .map((_, element) => $(element).attr("value"))
        .get(),
    ).toEqual([""]);
    expect(
      $("#screen-comparison-followup-question").attr("maxlength"),
    ).toBeUndefined();
    expect(
      $("#screen-comparison-followup-capture").attr("disabled"),
    ).toBeDefined();
    const event = { preventDefault: vi.fn() };
    (
      byId(tree, "screen-comparison-followup-toggle").onClick as (click: {
        preventDefault: () => void;
      }) => void
    )(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(f.controls.setOpen).toHaveBeenCalledExactlyOnceWith(true);
    expect(f.api.saveFollowups).not.toHaveBeenCalled();
  });

  it("renders the full exact saved check, selected identity, UTC date and all six immutable statement tables", async () => {
    const f = await fixture(true);
    const preview = f.controls.state.preview!;
    const $ = load(renderToStaticMarkup(f.view()));
    expect($("#screen-comparison-followup").attr("open")).toBeDefined();
    expect($("#screen-comparison-followup-check").text()).toBe(preview.check);
    expect(
      $("#screen-comparison-followup-check").attr("readonly"),
    ).toBeDefined();
    expect($.text()).toContain(
      `${[...preview.check].length} / 500 Unicode characters.`,
    );
    expect($.text()).toContain("Due date (UTC): 2026-12-31");
    for (const [key, label] of Object.entries(identityLabels)) {
      const value = preview.listing[key as keyof typeof identityLabels];
      expect(
        $("dt")
          .filter((_, element) => $(element).text() === label)
          .first()
          .next("dd")
          .text(),
      ).toBe(value);
    }
    expect(
      $("dt")
        .filter((_, element) => $(element).text() === "Catalog snapshot")
        .first()
        .next("dd")
        .text(),
    ).toBe(preview.catalogSnapshotSha256);
    const context = $("#screen-comparison-followup-context");
    for (const label of ["Income statement", "Balance sheet", "Cash flow"])
      expect(
        context.find("h4").filter((_, element) => $(element).text() === label),
      ).toHaveLength(2);
    expect(context.find("pre").text()).toBe(
      JSON.stringify(preview.comparison, null, 2),
    );
    expect($.text()).toContain(
      "Complete criteria, statements and source packets are excluded from the saved check.",
    );
    expect($.text()).toContain("Save follow-ups remains separate.");
    expect(
      $("button").filter(
        (_, element) => $(element).text() === "Save comparison report (HTML)",
      ),
    ).toHaveLength(0);
    expect(f.followups.coordinator.getSnapshot().draft!.entries).toEqual([]);
  });

  it("keeps the destination empty and exposes exact ineligible-member reasons without replacing raw invalid inputs", async () => {
    const f = await fixture(true);
    f.controls.state = {
      ...f.controls.state,
      side: "",
      question: "raw\nquestion😀",
      dueOn: "2026-02-29",
      preview: null,
    };
    f.controls.destinations = f.controls.destinations.map((row) =>
      row.side === "right"
        ? {
            ...row,
            eligible: false,
            reason: "This exact member is not editable.",
          }
        : row,
    );
    const $ = load(renderToStaticMarkup(f.view()));
    expect(
      $("#screen-comparison-followup-company option[selected]").attr("value"),
    ).toBe("");
    expect(
      $("#screen-comparison-followup-company option[value=right]").attr(
        "disabled",
      ),
    ).toBeDefined();
    expect($("#screen-comparison-followup-destinations").text()).toContain(
      "This exact member is not editable.",
    );
    expect($("#screen-comparison-followup-question").text()).toBe(
      "raw\nquestion😀",
    );
    expect($("#screen-comparison-followup-due").attr("value")).toBe(
      "2026-02-29",
    );
    expect($("#screen-comparison-followup-due").attr("aria-invalid")).toBe(
      "true",
    );
    expect($("#screen-comparison-followup-context")).toHaveLength(0);
  });

  it("explains the post-Save latest-Load gate without offering to reload an existing draft", async () => {
    const f = await fixture(true);
    expect(f.controls.state.preview!.create()).not.toBeNull();
    await f.followups.coordinator.save();
    expect(f.followups.coordinator.getSnapshot().latestLoaded).toBe(false);
    const loads = f.api.loadFollowups.mock.calls.length;
    Object.defineProperty(f.host.workspace, "screenComparisonFollowup", {
      value: f.context,
    });
    const review = new ScreenComparisonFollowupReview({
      workspace: f.host.workspace,
      routeActive: () => true,
      navigationPending: false,
      onReview: vi.fn(),
    });
    review.setOpen(true);
    review.capture();
    review.edit("side", "right");
    review.edit("question", "Keep my authored question");
    review.edit("dueOn", "2026-12-31");
    f.controls.state = review.getSnapshot();
    f.controls.saved = f.followups.coordinator.getSnapshot();
    f.controls.canPrepare = review.canPrepare();
    f.controls.canLoad = review.canLoad();
    f.controls.readinessReason = review.readinessReason();
    expect(f.controls.readinessReason).toBe(
      f.context.capturePort(f.controls.state.capture!, "right").reason,
    );
    expect(f.controls.readinessReason).toBeTruthy();
    const $ = load(renderToStaticMarkup(f.view()));
    expect(
      $("#screen-comparison-followup-preview").attr("disabled"),
    ).toBeDefined();
    expect($("#screen-comparison-followup-readiness").text()).toContain(
      f.controls.readinessReason,
    );
    expect($("#screen-comparison-followup-readiness").text()).toContain(
      "Open Follow-ups to load the saved version or finish recovery.",
    );
    expect($("#screen-comparison-followup-load")).toHaveLength(0);
    expect($("#screen-comparison-followup-question").text()).toBe(
      "Keep my authored question",
    );
    expect(f.api.loadFollowups).toHaveBeenCalledTimes(loads);
    expect(f.api.saveFollowups).toHaveBeenCalledOnce();
    review.dispose();
  });
});
