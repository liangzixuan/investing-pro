import { renderToStaticMarkup } from "react-dom/server";
import type { ValuationAssumptionEntry } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentValuationDraftFilePlugin } from "../../src/clerk-trial/valuation-draft-file-delivery";
import type { TrialSession } from "../../src/clerk-trial/session";
import { formatManagedValuationDraftFile } from "../../src/clerk-trial/managed-valuation-draft-file";
import { ManagedValuationDraftRecovery } from "../../src/clerk-trial/managed-valuation-draft-recovery";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { createFixture } from "./fixture";
import {
  createNativeValuationDraftFileFixture,
  createNativeValuationDraftFileSession,
} from "./native-valuation-draft-file-fixture";
import {
  dcfFields,
  exitFields,
  exitScenarioFields,
} from "../../src/clerk-trial/valuation-input-labels";

const workspaces: ManagedWorkspace[] = [];
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    workspace.sessionOwner.dispose();
});
function nativeFixture() {
  const plugin: InvestmentValuationDraftFilePlugin = {
    choose: vi
      .fn<InvestmentValuationDraftFilePlugin["choose"]>()
      .mockResolvedValue({
        status: "chosen",
        handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
    write: vi
      .fn<InvestmentValuationDraftFilePlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentValuationDraftFilePlugin["cancel"]>()
      .mockResolvedValue(),
  };
  return { plugin, native: createNativeValuationDraftFileFixture(plugin) };
}
async function document() {
  const fixture = await createFixture("saved-valuation");
  return formatManagedValuationDraftFile({
    accountScope: `sha256:${"a".repeat(64)}`,
    capturedAt: "2026-10-22T12:00:00.000Z",
    entry: fixture.savedValuation!.expected,
  })!;
}
function deliveryContext() {
  return { signal: new AbortController().signal, isCurrent: () => true };
}
const account: TrialSession = {
  userId: "invented-valuation-file-account",
  sessionId: "invented-valuation-file-session",
  getToken: vi.fn(),
  signOut: vi.fn(),
};

function authorExpected(
  workspace: ManagedWorkspace,
  expected: ValuationAssumptionEntry,
) {
  for (const [key] of dcfFields)
    workspace.valuation.setDcfField(key, expected.dcf.inputs[key]);
  for (const [key] of exitFields)
    workspace.valuation.setExitField(key, expected.exit.inputs[key]);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    workspace.valuation.setDcfScenario(
      scenario,
      expected.dcf.inputs.scenarios[scenario].annualCashFlowGrowthPercent,
    );
    for (const [key] of exitScenarioFields)
      workspace.valuation.setExitScenario(
        scenario,
        key,
        expected.exit.inputs.scenarios[scenario][key],
      );
  }
}

async function startRecovery() {
  const fixture = await createFixture("saved-valuation");
  const workspace = new ManagedWorkspace(
    fixture.api,
    fixture.session,
    undefined,
    {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    },
  );
  workspaces.push(workspace);
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  workspace.note("listing-zero", "Independent file recovery note");
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  const source = fixture.savedValuation!.expected;
  const expected = {
    ...source,
    exit: { ...source.exit, inputs: { ...source.exit.inputs, cash: "101.00" } },
  };
  authorExpected(workspace, expected);
  const note = workspace.coordinator.getSnapshot();
  const resource = workspace.valuationAssumptions.coordinator.getSnapshot();
  const native = nativeFixture();
  const scoped = createNativeValuationDraftFileSession(
    native.native,
    fixture.session,
  );
  const selection = workspace.getSnapshot().research!.selection;
  const controller = new ManagedValuationDraftRecovery({
    workspace,
    accountScope: scoped.routerProps.draftFileScope!,
    delivery: scoped.routerProps.valuationDraftFileDelivery,
    selection: () => selection,
    routeActive: () => true,
    now: () => "2026-10-22T12:00:00.000Z",
  });
  return { fixture, workspace, expected, note, resource, native, controller };
}

function assertRecoveryIsolation({
  workspace,
  fixture,
  resource,
  note,
}: Awaited<ReturnType<typeof startRecovery>>) {
  expect(workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    resource,
  );
  expect(workspace.coordinator.getSnapshot()).toBe(note);
  expect(fixture.savedValuation!.getSnapshot()).toEqual({
    load: 0,
    save: 0,
    resolve: 0,
  });
  expect(fixture.getSnapshot()).toMatchObject({
    load: 1,
    status: 1,
    save: 0,
    annual: 0,
    eod: 0,
    filings: 0,
    resolve: 0,
    token: 0,
    signOut: 0,
  });
}

describe("invented native valuation file fixture", () => {
  it("observes one completed exact write through the existing real adapter contract", async () => {
    const f = nativeFixture();
    const file = await document();
    await expect(
      f.native.delivery.deliver(file, deliveryContext()),
    ).resolves.toBe("written");
    expect(f.native.getSnapshot()).toEqual({
      choices: 1,
      writes: 1,
      text: file.text,
    });
    expect(f.plugin.choose).toHaveBeenCalledOnce();
    expect(f.plugin.write).toHaveBeenCalledOnce();
    expect(f.plugin.cancel).toHaveBeenCalledOnce();
    const choice = vi.mocked(f.plugin.choose).mock.calls[0]![0];
    expect(choice.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(choice).toEqual({
      operationId: choice.operationId,
      capturedAt: file.capturedAt,
    });
    const Controls = f.native.Controls;
    const markup = renderToStaticMarkup(<Controls />);
    expect(markup).toContain('id="fixture-valuation-file-protocol" hidden');
    expect(markup).toContain("Invented native valuation file diagnostics");
    expect(markup).not.toContain("content://");
    expect(markup).not.toContain("operationId");
  });
  it("retains the first capture after a later native cancellation or failed write", async () => {
    const f = nativeFixture();
    const file = await document();
    await f.native.delivery.deliver(file, deliveryContext());
    vi.mocked(f.plugin.choose).mockResolvedValueOnce({ status: "cancelled" });
    await expect(
      f.native.delivery.deliver(file, deliveryContext()),
    ).resolves.toBe("cancelled");
    vi.mocked(f.plugin.write).mockRejectedValueOnce(
      new Error("invented write failure"),
    );
    await expect(
      f.native.delivery.deliver(file, deliveryContext()),
    ).rejects.toThrow("Valuation inputs file unavailable");
    expect(f.native.getSnapshot()).toEqual({
      choices: 3,
      writes: 1,
      text: file.text,
    });
    expect(f.plugin.write).toHaveBeenCalledTimes(2);
    expect(f.plugin.cancel).toHaveBeenCalledTimes(3);
  });
  it("adds no props outside its scenario and retains one account/backend scope per keyed session", async () => {
    const inactive = createNativeValuationDraftFileSession(null, account);
    expect(inactive.routerProps).toEqual({});
    expect(inactive.Controls()).toBeNull();
    const { native } = nativeFixture();
    const first = createNativeValuationDraftFileSession(native, account);
    const fresh = createNativeValuationDraftFileSession(native, {
      ...account,
      sessionId: "invented-fresh-session",
    });
    const other = createNativeValuationDraftFileSession(native, {
      ...account,
      userId: "invented-other-account",
    });
    expect(first.routerProps.valuationDraftFileDelivery).toBe(native.delivery);
    expect(first.Controls).toBe(native.Controls);
    expect(first.routerProps.draftFileScope).toBe(
      first.routerProps.draftFileScope,
    );
    expect(first.routerProps.draftFileScope).not.toBe(
      fresh.routerProps.draftFileScope,
    );
    expect(await first.routerProps.draftFileScope).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    expect(await fresh.routerProps.draftFileScope).toBe(
      await first.routerProps.draftFileScope,
    );
    expect(await other.routerProps.draftFileScope).not.toBe(
      await first.routerProps.draftFileScope,
    );
    expect(Object.keys(first.routerProps).sort()).toEqual([
      "draftFileScope",
      "valuationDraftFileDelivery",
    ]);
  });
  it("round-trips both complete editor maps with local Cancel and explicit restore/Calculate without a saved read", async () => {
    const f = await startRecovery();
    const { workspace, expected, controller, native } = f;
    try {
      await vi.waitFor(() =>
        expect(controller.getSnapshot().canExport).toBe(true),
      );
      await controller.exportInputs();
      expect(native.native.getSnapshot()).toMatchObject({
        choices: 1,
        writes: 1,
      });
      const text = native.native.getSnapshot().text;
      workspace.valuation.setDcfField("startingUnleveredCashFlowUsd", "200.00");
      workspace.valuation.setExitField("cash", "102.00");
      const current = workspace.valuation.getSnapshot();
      const bytes = new TextEncoder().encode(text);
      const file = {
        size: bytes.byteLength,
        arrayBuffer: () => Promise.resolve(Uint8Array.from(bytes).buffer),
      };
      await controller.readFile(file);
      expect(controller.getSnapshot().preview?.entry).toEqual(expected);
      expect(controller.getSnapshot().currentEditor).toBe(current);
      controller.cancel();
      expect(workspace.valuation.getSnapshot()).toBe(current);
      await controller.readFile(file);
      expect(controller.restore()).toBe(true);
      expect(workspace.valuation.getSnapshot()).toMatchObject({
        dcfDraft: expected.dcf.inputs,
        exitDraft: expected.exit.inputs,
        dirty: true,
        calculation: null,
      });
      assertRecoveryIsolation(f);
      const calculated = workspace.valuation.calculate()!;
      expect(calculated.dcfResult).toMatchObject({
        scenarios: { base: { valuePerShareUsd: "140.00" } },
      });
      expect(calculated.exitResult).toMatchObject({
        scenarios: { base: { valuePerShare: "19.01" } },
      });
      assertRecoveryIsolation(f);
    } finally {
      controller.dispose();
    }
  });
});
