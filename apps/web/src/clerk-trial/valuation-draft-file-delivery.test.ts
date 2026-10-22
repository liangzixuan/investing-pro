import { expect, it, vi } from "vitest";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { eodSelection } from "./eod-history-fixture";
import {
  createNativeValuationDraftFileAdapter,
  type InvestmentValuationDraftFilePlugin,
} from "./valuation-draft-file-delivery";
import { formatManagedValuationDraftFile } from "./managed-valuation-draft-file";
const editor = new ManagedValuationWorkbench();
editor.activate(eodSelection);
const document = formatManagedValuationDraftFile({
  accountScope: `sha256:${"c".repeat(64)}`,
  capturedAt: "2026-10-22T10:00:00.000Z",
  entry: editor.captureInputs()!.entry,
})!;
function fixture() {
  const plugin: InvestmentValuationDraftFilePlugin = {
    choose: vi.fn(() =>
      Promise.resolve({
        status: "chosen" as const,
        handle: "11111111-1111-4111-8111-111111111111",
      }),
    ),
    write: vi.fn(() => Promise.resolve({ status: "written" as const })),
    cancel: vi.fn(async () => {}),
  };
  return { plugin, adapter: createNativeValuationDraftFileAdapter(plugin) };
}
it("delivers the exact Valuation file through existing choose/write transaction with matching framing metadata", async () => {
  const { plugin, adapter } = fixture();
  const context = {
    signal: new AbortController().signal,
    isCurrent: () => true,
  };
  expect(await adapter.deliver(document, context)).toBe("written");
  const choice = vi.mocked(plugin.choose).mock.calls[0]![0];
  expect(Object.keys(choice).sort()).toEqual(["capturedAt", "operationId"]);
  expect(choice.operationId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(choice.capturedAt).toBe(document.capturedAt);
  expect(plugin.write).toHaveBeenCalledWith({
    operationId: choice.operationId,
    handle: "11111111-1111-4111-8111-111111111111",
    text: document.text,
  });
});
it("refuses a Watchlist format relabel or mismatched framing before opening the native chooser", async () => {
  const { plugin, adapter } = fixture();
  const context = {
    signal: new AbortController().signal,
    isCurrent: () => true,
  };
  await expect(
    adapter.deliver(
      {
        ...document,
        text: document.text.replace(
          "investment-valuation-inputs-draft",
          "investment-watchlist-draft",
        ),
      },
      context,
    ),
  ).rejects.toThrow("Valuation inputs file unavailable");
  await expect(
    adapter.deliver(
      { ...document, capturedAt: "2026-10-23T10:00:00.000Z" },
      context,
    ),
  ).rejects.toThrow();
  expect(plugin.choose).not.toHaveBeenCalled();
});
