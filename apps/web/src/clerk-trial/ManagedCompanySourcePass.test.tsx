import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedCompanySourcePass } from "./ManagedCompanySourcePass";
import { ManagedCompanySourcePass as PassModel } from "./managed-company-source-pass";
import { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedInterimReport } from "./managed-interim-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
const local = vi.hoisted(() => ({ selected: ["eod", "annual", "filings"] }));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
  useState: () => [
    local.selected,
    (value: string[]) => {
      local.selected = value;
    },
  ],
}));
afterEach(() => {
  local.selected = ["eod", "annual", "filings"];
});
function fixture() {
  const read = vi.fn();
  const options = { coverage: inventedManagedResearchCoverage };
  const price = new ManagedEodHistory(read, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(read, vi.fn(), undefined, options);
  const filings = new ManagedCompanyFilings(read, vi.fn(), undefined, options);
  const interim = new ManagedInterimReport(read, vi.fn(), undefined, options);
  const loader = new ManagedCompanySnapshotLoad(
    price,
    annual,
    filings,
    interim,
  );
  const model = new PassModel(loader, price, annual, filings, interim);
  const props = {
    model,
    navigationPending: false,
    onPreview: vi.fn((names: Parameters<PassModel["prepare"]>[2]) => {
      model.prepare(eodSelection, () => true, names);
    }),
    onRun: vi.fn((preview: Parameters<PassModel["start"]>[0]) =>
      model.start(preview),
    ),
    onCancel: vi.fn(() => model.cancel()),
    onClear: vi.fn(() => model.clear()),
  };
  return { props, read };
}
function find(
  tree: React.ReactNode,
  predicate: (node: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> {
  for (const child of React.Children.toArray(tree)) {
    if (!React.isValidElement<Record<string, unknown>>(child)) continue;
    if (predicate(child)) return child;
    if (child.props.children) {
      try {
        return find(child.props.children as React.ReactNode, predicate);
      } catch {
        /* Continue through siblings. */
      }
    }
  }
  throw new Error("Expected rendered control");
}
describe("reviewed company source controls", () => {
  it("defaults to three sources, previews without reads, and requires a new preview after opting into Interim", () => {
    const { props, read } = fixture();
    let tree = ManagedCompanySourcePass(props);
    const interim = find(
      tree,
      (node) => node.type === "input" && node.props.checked === false,
    );
    const preview = find(
      tree,
      (node) =>
        node.type === "button" &&
        node.props.children === "Preview company source pass",
    );
    (preview.props.onClick as () => void)();
    expect(props.onPreview).toHaveBeenCalledWith(["eod", "annual", "filings"]);
    expect(read).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(<ManagedCompanySourcePass {...props} />);
    expect(html).toContain("Read order: Price → Annual → Filings");
    expect(html).toContain("Not selected");
    (interim.props.onChange as (event: unknown) => void)({
      target: { checked: true },
    });
    expect(props.onClear).toHaveBeenCalledOnce();
    expect(props.model.getSnapshot().preview).toBeNull();
    tree = ManagedCompanySourcePass(props);
    (
      find(
        tree,
        (node) =>
          node.type === "button" &&
          node.props.children === "Preview company source pass",
      ).props.onClick as () => void
    )();
    expect(props.onPreview).toHaveBeenLastCalledWith([
      "eod",
      "annual",
      "filings",
      "interim",
    ]);
    expect(read).not.toHaveBeenCalled();
  });
  it("keeps Cancel enabled when navigation is pending and Run unavailable", () => {
    const { props } = fixture();
    props.onPreview(["eod"]);
    props.navigationPending = true;
    const tree = ManagedCompanySourcePass(props);
    expect(
      find(
        tree,
        (node) =>
          node.type === "button" &&
          node.props.children === "Run reviewed company source pass",
      ).props.disabled,
    ).toBe(true);
    const cancel = find(
      tree,
      (node) =>
        node.type === "button" &&
        node.props.children === "Cancel reviewed company source pass",
    );
    expect(cancel.props.disabled).toBeUndefined();
    (cancel.props.onClick as () => void)();
    expect(props.model.getSnapshot().phase).toBe("cancelled");
  });
});
