import { expect, it, vi } from "vitest";
import {
  createNativePortfolioDraftFileAdapter,
  type InvestmentPortfolioDraftFilePlugin,
} from "./portfolio-draft-file-delivery";
import { formatManagedPortfolioDraftFile } from "./managed-portfolio-draft-file";
const document = formatManagedPortfolioDraftFile({
  accountScope: `sha256:${"c".repeat(64)}`,
  capturedAt: "2026-10-21T10:00:00.000Z",
  baseVersion: 7,
  draft: {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    basisMethod: "fifo_with_opening_pool",
    identities: [],
    opening: { asOfDate: "2026-10-01", cashUsd: null, holdings: [] },
    transactions: [],
  },
})!;
function fixture() {
  const plugin: InvestmentPortfolioDraftFilePlugin = {
    choose: vi.fn(() =>
      Promise.resolve({
        status: "chosen" as const,
        handle: "11111111-1111-4111-8111-111111111111",
      }),
    ),
    write: vi.fn(() => Promise.resolve({ status: "written" as const })),
    cancel: vi.fn(async () => {}),
  };
  return { plugin, adapter: createNativePortfolioDraftFileAdapter(plugin) };
}
it("delivers the exact Portfolio file through existing choose/write transaction with matching framing metadata", async () => {
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
          "investment-portfolio-draft",
          "investment-watchlist-draft",
        ),
      },
      context,
    ),
  ).rejects.toThrow("Portfolio draft file unavailable");
  await expect(
    adapter.deliver({ ...document, baseVersion: 8 }, context),
  ).rejects.toThrow();
  expect(plugin.choose).not.toHaveBeenCalled();
});
