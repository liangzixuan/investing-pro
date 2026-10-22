import { expect, it, vi } from "vitest";
import {
  createNativeFollowupsDraftFileAdapter,
  type InvestmentFollowupsDraftFilePlugin,
} from "./followups-draft-file-delivery";
import { formatManagedFollowupsDraftFile } from "./managed-followups-draft-file";
const document = formatManagedFollowupsDraftFile({
  accountScope: `sha256:${"c".repeat(64)}`,
  capturedAt: "2026-10-21T10:00:00.000Z",
  baseVersion: 7,
  draft: { schemaVersion: 1, entries: [] },
})!;
function fixture() {
  const plugin: InvestmentFollowupsDraftFilePlugin = {
    choose: vi.fn(() =>
      Promise.resolve({
        status: "chosen" as const,
        handle: "11111111-1111-4111-8111-111111111111",
      }),
    ),
    write: vi.fn(() => Promise.resolve({ status: "written" as const })),
    cancel: vi.fn(async () => {}),
  };
  return { plugin, adapter: createNativeFollowupsDraftFileAdapter(plugin) };
}
it("delivers the exact Followups file through existing choose/write transaction with matching framing metadata", async () => {
  const { plugin, adapter } = fixture();
  const context = {
    signal: new AbortController().signal,
    isCurrent: () => true,
  };
  expect(await adapter.deliver(document, context)).toBe("written");
  const choice = vi.mocked(plugin.choose).mock.calls[0]![0];
  expect(Object.keys(choice).sort()).toEqual([
    "baseVersion",
    "capturedAt",
    "operationId",
  ]);
  expect(choice.operationId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(choice.capturedAt).toBe(document.capturedAt);
  expect(choice.baseVersion).toBe(7);
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
          "investment-followups-draft",
          "investment-watchlist-draft",
        ),
      },
      context,
    ),
  ).rejects.toThrow("Follow-ups draft file unavailable");
  await expect(
    adapter.deliver({ ...document, baseVersion: 8 }, context),
  ).rejects.toThrow();
  expect(plugin.choose).not.toHaveBeenCalled();
});
