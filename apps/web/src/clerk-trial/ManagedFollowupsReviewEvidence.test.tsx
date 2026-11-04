import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { sourceConnectedFixture } from "./test-source-connected-workspace-fixture";
import {
  FollowupEvidenceReading,
  ManagedFollowupEvidenceCapture,
  ManagedFollowupsReviewEvidence,
} from "./ManagedFollowupsReviewEvidence";
import { OfflineResearchReading } from "./ManagedScreenResearchReading";

const hooks = vi.hoisted(() => ({
  direct: false,
  index: 0,
  slots: [] as unknown[],
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  const { createValuationDraftTestHooks } =
    await import("./valuation-draft-files-test-hooks");
  const direct = createValuationDraftTestHooks(hooks);
  return {
    ...actual,
    useRef: (v: unknown) =>
      hooks.direct ? direct.useRef(v) : actual.useRef(v),
    useState: (v: unknown) =>
      hooks.direct ? direct.useState(v) : actual.useState(v),
    useLayoutEffect: (f: () => void, d?: React.DependencyList) =>
      hooks.direct
        ? direct.useLayoutEffect(f, d)
        : actual.useLayoutEffect(f, d),
    useSyncExternalStore: (
      s: () => () => void,
      g: () => unknown,
      ss: () => unknown,
    ) => (hooks.direct ? g() : actual.useSyncExternalStore(s, g, ss)),
  };
});
const fixtures: Awaited<ReturnType<typeof sourceConnectedFixture>>[] = [];
beforeEach(() => {
  hooks.direct = false;
  hooks.index = 0;
  hooks.slots = [];
  hooks.effects = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
});
afterEach(() => {
  fixtures.splice(0).forEach((f) => f.dispose());
  hooks.direct = false;
  vi.useRealTimers();
});
async function setup() {
  const f = await sourceConnectedFixture();
  fixtures.push(f);
  f.start();
  await f.open();
  await f.run();
  return f;
}
type Props = {
  children?: React.ReactNode;
  id?: string;
  disabled?: boolean;
  onClick?: () => void;
  ref?: React.RefObject<HTMLHeadingElement | null>;
};
function nodes(n: React.ReactNode): React.ReactElement<Props>[] {
  return React.isValidElement<Props>(n)
    ? [n, ...React.Children.toArray(n.props.children).flatMap(nodes)]
    : [];
}
function capture(f: Awaited<ReturnType<typeof setup>>, blocked = false) {
  hooks.direct = true;
  hooks.index = 0;
  const tree = ManagedFollowupEvidenceCapture({
    workspace: f.workspace,
    navigationPending: blocked,
  });
  hooks.direct = false;
  const all = nodes(tree);
  return {
    tree,
    button: all.find(
      (e) => e.props.id === "managed-followups-evidence-capture",
    )!,
    heading: all.find(
      (e) => e.props.id === "managed-followups-evidence-capture-heading",
    )!,
  };
}
function commit(frame: ReturnType<typeof capture>, focus = vi.fn()) {
  frame.heading.props.ref!.current = {
    isConnected: true,
    focus,
  } as unknown as HTMLHeadingElement;
  hooks.effects.splice(0).forEach((f) => f());
  return focus;
}
it("presents complete detached source packets, raw closes, statements, pass outcomes and independent clocks without live controls", async () => {
  const f = await setup(),
    reading = f.capture();
  const original = JSON.stringify(reading);
  const html = renderToStaticMarkup(
    <OfflineResearchReading.Provider value={true}>
      <FollowupEvidenceReading reading={reading} />
    </OfflineResearchReading.Provider>,
  );
  const $ = load(html);
  const complete = $("details")
    .filter(
      (_i, e) =>
        $(e).children("summary").text() === "Complete retained check reading",
    )
    .children("pre")
    .text();
  expect(JSON.parse(complete)).toEqual(reading);
  expect($("button,input,textarea,select")).toHaveLength(0);
  expect($("script")).toHaveLength(0);
  expect($("[aria-label='Captured Price'] tbody tr")).toHaveLength(
    reading.evidence.price!.response!.rows.length,
  );
  reading.evidence.price!.response!.rows.forEach((row) => {
    expect($("[aria-label='Captured Price']").text()).toContain(row.date);
    expect($("[aria-label='Captured Price']").text()).toContain(row.close);
  });
  expect(html).toContain("Standardized annual statements");
  expect(html).toContain("9007199254740993.123456789012345678");
  expect($("[aria-label='Captured Interim'] table").length).toBeGreaterThan(0);
  expect(
    $("[aria-label='Captured Filings'] > ol a")
      .map((_i, e) => $(e).attr("href"))
      .get(),
  ).toEqual(
    reading.evidence.filings!.response!.issuer.filings.map((f) => f.sourceUrl),
  );
  expect(html).toContain(reading.capturedAt);
  expect(html).toContain(reading.evidence.price!.response!.completedAt);
  expect(html).toContain(
    reading.evidence.annual!.response!.evidence.generation.completedAt,
  );
  expect(html).toContain(
    reading.evidence.interim!.response!.evidence.generation.completedAt,
  );
  expect(JSON.stringify(reading)).toBe(original);
  for (const fn of [
    f.api.eodHistory,
    f.api.annualReport,
    f.api.recentFilings,
    f.api.interimReport,
  ])
    expect(fn).toHaveBeenCalledOnce();
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("shows every chosen check at Finish including uncaptured checks and escaped full questions", async () => {
  const f = await setup();
  f.capture();
  f.workspace.returnFromResearch();
  f.review.finish(f.review.getSnapshot());
  const $ = load(
    renderToStaticMarkup(
      <ManagedFollowupsReviewEvidence workspace={f.workspace} />,
    ),
  );
  const rows = $("[data-followup-evidence-id]");
  expect(
    rows.map((_i, e) => $(e).attr("data-followup-evidence-id")).get(),
  ).toEqual(f.review.getSnapshot().chosen.map((r) => r.entry.id));
  expect(rows.eq(0).find("article")).toHaveLength(1);
  expect(rows.eq(1).text()).toContain("No source reading was retained");
  expect(rows.eq(2).text()).toContain("No source reading was retained");
  expect($("script,button")).toHaveLength(0);
  expect(rows.text()).toContain("<script>escaped</script>");
  expect(f.api.saveFollowups).not.toHaveBeenCalled();
});
it("captures only from the current enabled callback and focuses only after its committed reading", async () => {
  const f = await setup();
  const first = capture(f);
  const focus = commit(first);
  expect(focus).not.toHaveBeenCalled();
  expect(first.button.props.disabled).toBe(false);
  first.button.props.onClick!();
  expect(focus).not.toHaveBeenCalled();
  const installed = f.workspace.reviewEvidence.getSnapshot();
  expect(installed.selected!.reading).not.toBeNull();
  commit(capture(f), focus);
  expect(focus).toHaveBeenCalledOnce();
  first.button.props.onClick!();
  expect(f.workspace.reviewEvidence.getSnapshot()).toBe(installed);
  const blocked = capture(f, true);
  expect(blocked.button.props.disabled).toBe(true);
  blocked.button.props.onClick!();
  expect(f.workspace.reviewEvidence.getSnapshot()).toBe(installed);
  commit(blocked, focus);
  expect(focus).toHaveBeenCalledOnce();
});
it("does not focus a capture retired by synchronous subscriber navigation", async () => {
  const f = await setup();
  const frame = capture(f);
  const focus = commit(frame);
  const off = f.workspace.reviewEvidence.subscribe(() => {
    if (f.workspace.reviewEvidence.getSnapshot().selected?.reading)
      f.workspace.setView("markets");
  });
  frame.button.props.onClick!();
  off();
  expect(f.workspace.reviewEvidence.getSnapshot().phase).toBe("inactive");
  hooks.effects.splice(0).forEach((e) => e());
  expect(focus).not.toHaveBeenCalled();
});
