import { expect, it, vi } from "vitest";
import {
  createNativeResearchDraftSetFileAdapter,
  type InvestmentResearchDraftSetFilePlugin,
} from "./research-draft-set-file-delivery";
import { draftSetDocument } from "./test-research-draft-set-file-fixture";
import { deferred } from "./test-valuation-draft-recovery-fixture";
function fixture() {
  const plugin: InvestmentResearchDraftSetFilePlugin = {
    choose: vi.fn(() =>
      Promise.resolve({
        status: "chosen" as const,
        handle: "11111111-1111-4111-8111-111111111111",
      }),
    ),
    write: vi.fn(() => Promise.resolve({ status: "written" as const })),
    cancel: vi.fn(() => Promise.resolve()),
  };
  return { plugin, adapter: createNativeResearchDraftSetFileAdapter(plugin) };
}
it("writes the exact full draft set through the existing chosen document transaction", async () => {
  const f = fixture(),
    document = draftSetDocument();
  expect(
    await f.adapter.deliver(document, {
      signal: new AbortController().signal,
      isCurrent: () => true,
    }),
  ).toBe("written");
  const options = vi.mocked(f.plugin.choose).mock.calls[0]![0];
  expect(Object.keys(options).sort()).toEqual(["capturedAt", "operationId"]);
  expect(options.capturedAt).toBe(document.capturedAt);
  expect(f.plugin.write).toHaveBeenCalledWith({
    operationId: options.operationId,
    handle: "11111111-1111-4111-8111-111111111111",
    text: document.text,
  });
});
it("refuses a mismatched nested document before choosing a destination", async () => {
  const f = fixture(),
    document = draftSetDocument();
  await expect(
    f.adapter.deliver(
      {
        ...document,
        text: document.text.replace("investment-portfolio-draft", "other"),
      },
      { signal: new AbortController().signal, isCurrent: () => true },
    ),
  ).rejects.toThrow();
  expect(f.plugin.choose).not.toHaveBeenCalled();
});
it("cancels the exact chosen operation when its captured lifetime expires before writing", async () => {
  const f = fixture(),
    pending = deferred<{ status: "chosen"; handle: string }>();
  vi.mocked(f.plugin.choose).mockReturnValueOnce(pending.promise);
  let current = true;
  const operation = f.adapter.deliver(draftSetDocument(), {
    signal: new AbortController().signal,
    isCurrent: () => current,
  });
  current = false;
  pending.resolve({
    status: "chosen",
    handle: "11111111-1111-4111-8111-111111111111",
  });
  await expect(operation).resolves.toBe("cancelled");
  expect(f.plugin.write).not.toHaveBeenCalled();
  expect(f.plugin.cancel).toHaveBeenCalledOnce();
});
