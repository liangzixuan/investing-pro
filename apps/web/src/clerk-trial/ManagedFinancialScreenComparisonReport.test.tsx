import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comparisonCaptureReady,
  createScreenComparisonReportSource,
  ScreenComparisonReportView,
} from "./ManagedFinancialScreenComparisonReport";
import { ScreenComparisonReportController } from "./screen-comparison-report-controller";
import type {
  ScreenComparisonReportHtmlDocument,
  ScreenComparisonReportDeliveryAdapter,
} from "./screen-comparison-report-ports";
import { createScreenComparisonReportFixture } from "./screen-comparison-report-fixture";

vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => "comparison-report-ui",
    useLayoutEffect: () => {},
    useRef: (value: unknown) => ({ current: value }),
  };
});
const retire = new Set<() => void>();
afterEach(() => {
  for (const close of retire) close();
  retire.clear();
  vi.useRealTimers();
});
type Element = React.ReactElement<Record<string, unknown>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function text(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return React.isValidElement<Record<string, unknown>>(node)
    ? React.Children.toArray(node.props.children as React.ReactNode)
        .map(text)
        .join("")
    : "";
}
function button(tree: React.ReactNode, label: string) {
  const found = elements(tree).find(
    (node) =>
      node.type === "button" &&
      text(node.props.children as React.ReactNode) === label,
  );
  if (!found) throw new Error(`Missing button ${label}`);
  return found.props as { disabled?: boolean; onClick: () => void };
}
async function fixture() {
  const data = await createScreenComparisonReportFixture();
  const html: ScreenComparisonReportHtmlDocument = {
    purpose: "investment.screen-comparison-html",
    filename: "Investment-screen-comparison-20260920T000020000Z.html",
    text: "<p>invented adapter document</p>",
    byteLength: 32,
  };
  const format = vi.fn(() => html);
  const delivery = {
    deliver: vi
      .fn<ScreenComparisonReportDeliveryAdapter["deliver"]>()
      .mockResolvedValue("written"),
  };
  const controller = new ScreenComparisonReportController(
    { capture: data.capture, subscribe: data.model.subscribe },
    delivery,
    format,
  );
  retire.add(() => {
    controller.dispose();
    data.model.retire();
  });
  const view = (
    ready = comparisonCaptureReady(data.model, data.model.getSnapshot()),
  ) =>
    ScreenComparisonReportView({
      controller,
      state: controller.getSnapshot(),
      ready,
      delivery,
    });
  return { ...data, format, delivery, controller, view };
}

describe("captured screening comparison controls", () => {
  it("admits only the current complete pair and refuses stale or absent choices", async () => {
    const f = await fixture();
    const state = f.model.getSnapshot();
    expect(comparisonCaptureReady(f.model, state)).toBe(true);
    f.choose("right", null);
    expect(comparisonCaptureReady(f.model, state)).toBe(false);
    expect(comparisonCaptureReady(f.model, f.model.getSnapshot())).toBe(false);
    f.choose("right", f.rows[1]!);
    expect(comparisonCaptureReady(f.model, f.model.getSnapshot())).toBe(true);
    f.model.reconcile(state.catalogSnapshotSha256, false, false);
    expect(comparisonCaptureReady(f.model, f.model.getSnapshot())).toBe(false);
  });

  it("captures both complete statement sets before a separate HTML save without another read", async () => {
    const f = await fixture();
    const pair = f.model.getSnapshot().comparison;
    const reads = f.read.mock.calls.length;
    button(f.view(), "Capture comparison report").onClick();
    expect(f.controller.getSnapshot().report).not.toBeNull();
    expect(f.delivery.deliver).not.toHaveBeenCalled();
    expect(f.format).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(f.view());
    const $ = load(html);
    expect($("#managed-screen-comparison-report-captured").length).toBe(1);
    for (const label of ["Income statement", "Balance sheet", "Cash flow"])
      expect($("h4").filter((_, node) => $(node).text() === label).length).toBe(
        2,
      );
    expect($.text()).toContain(pair.left!.member.listing.shareClassId);
    expect($.text()).toContain(pair.right!.member.listing.shareClassId);
    expect($.text()).toContain("8 MiB");
    button(f.view(), "Save comparison report (HTML)").onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.delivery.deliver).toHaveBeenCalledTimes(1);
    expect(f.format).toHaveBeenCalledTimes(1);
    expect(f.read.mock.calls.length).toBe(reads);
    expect(f.model.getSnapshot().comparison).toBe(pair);
  });

  it("keeps disabled capture and save controls harmless even if a stale handler is called", async () => {
    const f = await fixture();
    const prepare = vi.spyOn(f.controller, "prepare");
    const capture = button(f.view(false), "Capture comparison report");
    expect(capture.disabled).toBe(true);
    capture.onClick();
    expect(prepare).not.toHaveBeenCalled();
    f.controller.prepare();
    const save = button(f.view(false), "Save comparison report (HTML)");
    expect(save.disabled).toBe(true);
    save.onClick();
    expect(f.delivery.deliver).not.toHaveBeenCalled();
  });

  it("Close aborts a pending document save and ignores its late completion while retaining the pair", async () => {
    const f = await fixture();
    let complete!: (result: "written") => void;
    f.delivery.deliver.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    f.controller.prepare();
    const pair = f.model.getSnapshot().comparison;
    button(f.view(), "Save comparison report (HTML)").onClick();
    const context = f.delivery.deliver.mock.calls[0]![1];
    expect(f.controller.getSnapshot().saving).toBe(true);
    button(f.view(), "Close comparison report").onClick();
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    complete("written");
    await Promise.resolve();
    await Promise.resolve();
    expect(f.controller.getSnapshot().report).toBeNull();
    expect(f.controller.getSnapshot().message).toBe("");
    expect(f.model.getSnapshot().comparison).toBe(pair);
  });
  it("refuses capture before pending navigation settles without touching the model", async () => {
    const f = await fixture();
    const capture = vi.spyOn(f.model, "captureComparisonReport");
    const source = createScreenComparisonReportSource(f.model, () => false);
    expect(source.capture()).toBeNull();
    expect(capture).not.toHaveBeenCalled();
    expect(f.read).toHaveBeenCalledTimes(2);
  });

  it("retires a capture on a live pending-route guard and never revives its late save after return", async () => {
    const f = await fixture();
    let active = true;
    let complete!: (result: "written") => void;
    f.delivery.deliver.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const controller = new ScreenComparisonReportController(
      createScreenComparisonReportSource(f.model, () => active),
      f.delivery,
      f.format,
    );
    retire.add(() => controller.dispose());
    controller.prepare();
    const first = controller.getSnapshot().report;
    const save = controller.save();
    const context = f.delivery.deliver.mock.calls[0]![1];
    active = false;
    expect(context.isCurrent()).toBe(false);
    controller.reconcile();
    expect(context.signal.aborted).toBe(true);
    active = true;
    expect(context.isCurrent()).toBe(false);
    complete("written");
    await save;
    expect(controller.getSnapshot().report).toBeNull();
    controller.prepare();
    expect(controller.getSnapshot().report).not.toBeNull();
    expect(controller.getSnapshot().report).not.toBe(first);
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it("does not save or close a replacement report through a stale reviewed snapshot", async () => {
    const f = await fixture();
    f.controller.prepare();
    const stale = f.view();
    f.controller.prepare();
    const replacement = f.controller.getSnapshot().report;
    button(stale, "Save comparison report (HTML)").onClick();
    button(stale, "Close comparison report").onClick();
    expect(f.delivery.deliver).not.toHaveBeenCalled();
    expect(f.format).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().report).toBe(replacement);
    button(f.view(), "Save comparison report (HTML)").onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.delivery.deliver).toHaveBeenCalledTimes(1);
  });
});
