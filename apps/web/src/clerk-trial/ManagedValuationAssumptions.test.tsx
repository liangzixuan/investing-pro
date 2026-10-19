import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ManagedCatalogSnapshotDto,
  ManagedValuationAssumptionsDto,
} from "@research-cockpit/contracts";
import type { ManagedApi } from "./managed-api";
import { TrialApiError } from "./api";
import { eodSelection } from "./eod-history-fixture";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { ManagedValuationAssumptions as AssumptionsModel } from "./managed-valuation-assumptions";
import { ManagedValuationAssumptions } from "./ManagedValuationAssumptions";

const hooks = vi.hoisted(() => ({
  index: 0,
  slots: [] as unknown[],
  cleanup: () => {},
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useRef: <T,>(initial: T) => {
    const index = hooks.index++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [
      hooks.slots[index],
      (next: unknown) => {
        hooks.slots[index] = next;
      },
    ];
  },
  useLayoutEffect: (effect: () => () => void) => {
    hooks.cleanup = effect();
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
}));
beforeEach(() => {
  hooks.index = 0;
  hooks.slots = [];
});
const catalog: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: eodSelection.catalogSnapshotSha256,
  catalogId: "invented-valuation-ui",
  catalogVersion: "invented-v1",
  acquiredAt: "2026-10-01T00:00:00.000Z",
  generatedAt: "2026-10-01T00:00:00.000Z",
  asOf: "2026-10-01T00:00:00.000Z",
  contentKind: "synthetic_engineering",
  attribution: "Invented UI catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 1,
    activeListings: 1,
    admittedSourceRecords: 1,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 1,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === "function")
    return elements(
      (node.type as (props: unknown) => React.ReactNode)(node.props),
    );
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
function savedApi(initial: ManagedValuationAssumptionsDto) {
  let stored = structuredClone(initial);
  const api: Pick<
    ManagedApi,
    "loadValuationAssumptions" | "saveValuationAssumptions" | "resolve"
  > = {
    loadValuationAssumptions: vi
      .fn<ManagedApi["loadValuationAssumptions"]>()
      .mockImplementation(() => Promise.resolve(structuredClone(stored))),
    saveValuationAssumptions: vi
      .fn<ManagedApi["saveValuationAssumptions"]>()
      .mockImplementation((command) => {
        stored = {
          version: command.expectedVersion + 1,
          payload: structuredClone(command.payload),
        };
        return Promise.resolve({ ...structuredClone(stored), replayed: false });
      }),
    resolve: vi.fn<ManagedApi["resolve"]>().mockImplementation((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: eodSelection.listing,
        })),
      }),
    ),
  };
  return { api, stored: () => structuredClone(stored) };
}
function renderControls(
  model: AssumptionsModel,
  workbench: ManagedValuationWorkbench,
) {
  const render = (navigationPending = false) => {
    hooks.index = 0;
    const node = ManagedValuationAssumptions({
      model,
      workbench,
      navigationPending,
    });
    const all = elements(node);
    const control = (id: string) => {
      const match = all.find(
        (entry) => entry.type === "button" && entry.props.id === id,
      );
      if (!match) throw new Error(`Missing button ${id}`);
      return match.props as { disabled: boolean; onClick: () => void };
    };
    const click = (id: string) => {
      const button = control(id);
      expect(button.disabled).toBeFalsy();
      button.onClick();
    };
    return { node, html: renderToStaticMarkup(node), control, click, all };
  };
  return render;
}
function fixture(
  initial: ManagedValuationAssumptionsDto = {
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  },
) {
  const { api, stored } = savedApi(initial);
  let key = 0;
  const workbench = new ManagedValuationWorkbench();
  workbench.activate(eodSelection);
  const model = new AssumptionsModel(
    api,
    {
      userId: "invented-user",
      sessionId: "invented-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    workbench,
    {
      getCatalogSnapshot: () => catalog,
      onRetire: vi.fn(),
      newKey: () => `invented-input-key-${++key}`,
    },
  );
  const render = renderControls(model, workbench);
  const settle = () =>
    vi.waitFor(() =>
      expect(model.coordinator.getSnapshot().phase).toBe("idle"),
    );
  return {
    api,
    model,
    workbench,
    render,
    settle,
    stored,
  };
}
async function stage(f: ReturnType<typeof fixture>) {
  f.render().click("managed-valuation-load");
  await f.settle();
  f.render().click("managed-valuation-stage-review");
  await vi.waitFor(() =>
    expect(f.model.getSnapshot().stageReview).not.toBeNull(),
  );
  f.render().click("managed-valuation-stage");
}
async function save(f: ReturnType<typeof fixture>) {
  f.render().click("managed-valuation-review");
  f.render().click("managed-valuation-save");
  await f.settle();
}

describe("saved valuation input controls", () => {
  it("starts closed without a request, stages complete raw text, saves separately and restores after a fresh read", async () => {
    const f = fixture();
    f.workbench.setDcfField("waccPercent", " 1.. 😀 ");
    f.workbench.setExitField("horizonYears", "");
    f.workbench.setExitScenario("expansion", "exitMultiple", "12.00");
    const first = f.render();
    expect(first.all[0]!.props.open).toBeUndefined();
    expect(f.api.loadValuationAssumptions).not.toHaveBeenCalled();
    expect(first.control("managed-valuation-save").disabled).toBe(true);
    await stage(f);
    expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
    expect(f.workbench.hasDraft()).toBe(true);
    expect(f.render().control("managed-valuation-save").disabled).toBe(true);
    f.render().click("managed-valuation-review");
    const review = f.render();
    expect(review.html).toContain("Complete valuation draft for Save");
    expect(review.html).toContain(" 1.. 😀 ");
    expect(review.html).toContain("12.00");
    expect(review.html).toContain("<em>Empty</em>");
    expect(review.html).toContain("authored-cash-flow-dcf-v1");
    expect(review.html).toContain(eodSelection.catalogSnapshotSha256);
    review.click("managed-valuation-save");
    await f.settle();
    expect(f.workbench.hasDraft()).toBe(false);
    expect(f.workbench.getSnapshot().calculation).toBeNull();
    hooks.slots = [];
    const reopened = fixture(f.stored());
    reopened.workbench.setDcfField("waccPercent", "22");
    reopened.workbench.calculate();
    reopened.render().click("managed-valuation-load");
    await reopened.settle();
    const chooser = reopened.render();
    const restore = chooser.all.find(
      (node) =>
        node.type === "button" &&
        React.Children.toArray(node.props.children as React.ReactNode)
          .filter((child): child is string => typeof child === "string")
          .join("") === "Review saved inputs for ZERO",
    )!;
    (restore.props.onClick as () => void)();
    expect(reopened.workbench.getSnapshot().dcfDraft.waccPercent).toBe("22");
    expect(reopened.render().html).toContain(
      "Compare before replacing the editor",
    );
    reopened.render().click("managed-valuation-use-inputs");
    expect(reopened.workbench.getSnapshot().dcfDraft.waccPercent).toBe(
      " 1.. 😀 ",
    );
    expect(
      reopened.workbench.getSnapshot().exitDraft.scenarios.expansion
        .exitMultiple,
    ).toBe("12.00");
    expect(reopened.workbench.getSnapshot().calculation).toBeNull();
    expect(reopened.api.saveValuationAssumptions).not.toHaveBeenCalled();
    expect(reopened.api.resolve).not.toHaveBeenCalled();
  });

  it("shows every complete raw field without clipping or executing markup", async () => {
    const f = fixture();
    const raw = "<script>saved</script>\n" + "9".repeat(475);
    f.workbench.setDcfField("startingUnleveredCashFlowUsd", raw);
    await stage(f);
    f.render().click("managed-valuation-review");
    const html = f.render().html;
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      "&lt;script&gt;saved&lt;/script&gt;\n" + "9".repeat(475),
    );
    for (const label of [
      "Starting unlevered cash flow",
      "Enterprise-to-equity bridge",
      "Diluted shares",
      "Forecast years",
      "WACC",
      "Terminal growth",
      "Starting revenue",
      "Cash (full USD)",
      "Debt (full USD)",
      "Horizon years",
      "Discount rate",
      "Conservative annual cash flow growth",
      "Base annual cash flow growth",
      "Expansion annual cash flow growth",
      "Annual revenue growth",
      "Target EBITDA margin",
      "Exit EBITDA multiple",
    ])
      expect(html).toContain(label);
  });

  it("refuses a stale Save handler after draft changes and requires a new review", async () => {
    const f = fixture();
    await stage(f);
    f.render().click("managed-valuation-review");
    const stale = f.render().control("managed-valuation-save");
    f.workbench.setDcfField("waccPercent", "11");
    await f.model.prepareStage();
    f.model.stageCurrent();
    stale.onClick();
    expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
    expect(f.render().control("managed-valuation-save").disabled).toBe(true);
  });

  it.each(["navigation", "pending navigation", "unmount", "retire"])(
    "refuses a captured action after %s",
    async (kind) => {
      const f = fixture();
      await stage(f);
      f.render().click("managed-valuation-review");
      const stale = f.render().control("managed-valuation-save");
      if (kind === "navigation") f.workbench.activate(null);
      if (kind === "pending navigation") {
        f.render(true);
        f.render(false);
      }
      if (kind === "unmount") hooks.cleanup();
      if (kind === "retire") f.model.retire();
      stale.onClick();
      expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
    },
  );

  it("keeps uncertain saves locked to the original command and exposes explicit reconciliation", async () => {
    const f = fixture();
    await stage(f);
    vi.mocked(f.api.saveValuationAssumptions).mockRejectedValueOnce(
      new TrialApiError("commit_unknown"),
    );
    await save(f);
    const view = f.render();
    expect(view.control("managed-valuation-load").disabled).toBe(true);
    expect(view.control("managed-valuation-save").disabled).toBe(true);
    const original = vi.mocked(f.api.saveValuationAssumptions).mock
      .calls[0]![0];
    view.click("managed-valuation-reconcile");
    await f.settle();
    expect(vi.mocked(f.api.saveValuationAssumptions).mock.calls[1]![0]).toEqual(
      original,
    );
    expect(f.api.loadValuationAssumptions).toHaveBeenCalledOnce();
  });

  it("identifies the old confirmation after a conflict and compares the fresh saved version before choosing", async () => {
    const f = fixture();
    f.workbench.setDcfField("waccPercent", "11");
    await stage(f);
    vi.mocked(f.api.saveValuationAssumptions).mockRejectedValueOnce(
      new TrialApiError("conflict"),
    );
    await save(f);
    const conflict = f.render();
    expect(conflict.html).toContain(
      "Previously confirmed inputs (version 0); load latest to compare",
    );
    expect(conflict.html).not.toContain("Latest saved inputs");
    expect(
      conflict.control("managed-valuation-use-saved-version").disabled,
    ).toBe(true);
    expect(conflict.control("managed-valuation-keep-draft").disabled).toBe(
      true,
    );
    const remote = new ManagedValuationWorkbench();
    remote.activate(eodSelection);
    remote.setDcfField("waccPercent", "22");
    vi.mocked(f.api.loadValuationAssumptions).mockResolvedValueOnce({
      version: 5,
      payload: { schemaVersion: 1, entries: [remote.captureInputs()!.entry] },
    });
    conflict.click("managed-valuation-load");
    await f.settle();
    const compare = f.render();
    expect(compare.html).toContain("Latest saved inputs (version 5)");
    expect(compare.html).toContain("Retained valuation draft");
    expect(compare.html).toContain('class="managed-valuation-raw">11</dd>');
    expect(compare.html).toContain('class="managed-valuation-raw">22</dd>');
    compare.click("managed-valuation-keep-draft");
    expect(f.model.coordinator.getSnapshot()).toMatchObject({
      baseVersion: 5,
      dirty: true,
      conflict: false,
    });
    expect(f.render().control("managed-valuation-save").disabled).toBe(true);
    expect(f.api.saveValuationAssumptions).toHaveBeenCalledOnce();
    expect(f.workbench.getSnapshot().dcfDraft.waccPercent).toBe("11");
  });

  it("blocks staging for a rejected oversized input and blocks all actions during navigation", async () => {
    const f = fixture();
    f.render().click("managed-valuation-load");
    await f.settle();
    f.workbench.setDcfField("waccPercent", "1".repeat(513));
    expect(f.render().control("managed-valuation-stage-review").disabled).toBe(
      true,
    );
    const pending = f.render(true);
    expect(pending.control("managed-valuation-load").disabled).toBe(true);
    expect(pending.control("managed-valuation-review").disabled).toBe(true);
    expect(pending.control("managed-valuation-save").disabled).toBe(true);
  });
});
