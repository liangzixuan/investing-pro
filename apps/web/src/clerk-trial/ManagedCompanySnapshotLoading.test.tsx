import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedCompanySnapshotLoading } from "./ManagedCompanySnapshotLoading";
import { ManagedCompanySnapshotLoad } from "./managed-company-snapshot-load";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedInterimReport } from "./managed-interim-report";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";

vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
    getSnapshot(),
}));

describe("explicit company snapshot loading controls", () => {
  it("renders without reads, explains partial loads and preserves enabled Cancel during navigation", async () => {
    let finish!: (value: ReturnType<typeof eodResponse>) => void;
    const readPrice = vi.fn(
      () =>
        new Promise<ReturnType<typeof eodResponse>>((resolve) => {
          finish = resolve;
        }),
    );
    const readAnnual = vi.fn();
    const readFilings = vi.fn();
    const price = new ManagedEodHistory(readPrice, vi.fn(), undefined, [
      eodSelection.listing,
    ]);
    const options = { coverage: inventedManagedResearchCoverage };
    const annual = new ManagedAnnualReport(
      readAnnual,
      vi.fn(),
      undefined,
      options,
    );
    const filings = new ManagedCompanyFilings(
      readFilings,
      vi.fn(),
      undefined,
      options,
    );
    const interim = new ManagedInterimReport(
      vi.fn(),
      vi.fn(),
      undefined,
      options,
    );
    const model = new ManagedCompanySnapshotLoad(
      price,
      annual,
      filings,
      interim,
    );
    const props = {
      model,
      navigationPending: false,
      onLoad: vi.fn(() => model.start(eodSelection, () => true)),
      onCancel: vi.fn(() => model.cancel()),
    };
    const render = () =>
      renderToStaticMarkup(<ManagedCompanySnapshotLoading {...props} />);
    expect(render()).toContain("Loaded responses keep their original dates");
    expect(render()).toContain("later explicit load may be needed");
    expect(readPrice).not.toHaveBeenCalled();
    expect(readAnnual).not.toHaveBeenCalled();
    expect(readFilings).not.toHaveBeenCalled();
    const tree = ManagedCompanySnapshotLoading(props) as React.ReactElement<{
      children: React.ReactNode;
    }>;
    const actions = React.Children.toArray(tree.props.children).find(
      (node) => React.isValidElement(node) && node.type === "div",
    ) as React.ReactElement<{ children: React.ReactNode }>;
    const load = React.Children.toArray(
      actions.props.children,
    )[0] as React.ReactElement<{ onClick: () => void }>;
    load.props.onClick();
    expect(props.onLoad).toHaveBeenCalledOnce();
    expect(readPrice).toHaveBeenCalledOnce();
    props.navigationPending = true;
    const html = render();
    expect(html).toContain("Loading company sources…");
    expect(html).toMatch(/<button disabled="">Loading company sources/);
    expect(html).toMatch(
      /<button class="trial-secondary">Cancel company source load/,
    );
    props.onCancel();
    finish(eodResponse());
    await props.onLoad.mock.results[0]!.value;
    expect(model.getSnapshot().running).toBe(false);
    expect(readAnnual).not.toHaveBeenCalled();
    expect(readFilings).not.toHaveBeenCalled();
  });
});
