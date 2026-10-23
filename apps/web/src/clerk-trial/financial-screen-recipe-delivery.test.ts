import { afterEach, describe, expect, it, vi } from "vitest";
import { eodSelection } from "./eod-history-fixture";
import {
  formatManagedFinancialScreenRecipe,
  type ManagedFinancialScreenRecipeDocument,
} from "./managed-financial-screen-recipe";
import {
  browserFinancialScreenRecipeAdapter,
  createNativeFinancialScreenRecipeAdapter,
  type InvestmentFinancialScreenRecipePlugin,
} from "./financial-screen-recipe-delivery";

const TIME = "2026-10-23T01:02:03.456Z";
const HANDLE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const FAILURE = "Screen recipe file unavailable";

function recipe() {
  const document = formatManagedFinancialScreenRecipe({
    name: "Cash discipline 零 café 😀",
    capturedAt: TIME,
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    criteria: {
      clauses: [{ field: "operatingIncome", operator: "gte", value: "0.00" }],
      sort: { field: "operatingIncome", direction: "desc" },
    },
    listings: [eodSelection.listing],
  });
  if (!document) throw new Error("Invalid invented screen recipe");
  return document;
}

function context() {
  const controller = new AbortController();
  return { controller, signal: controller.signal, isCurrent: () => true };
}

function plugin() {
  return {
    choose: vi
      .fn<InvestmentFinancialScreenRecipePlugin["choose"]>()
      .mockResolvedValue({ status: "chosen", handle: HANDLE }),
    write: vi
      .fn<InvestmentFinancialScreenRecipePlugin["write"]>()
      .mockResolvedValue({ status: "written" }),
    cancel: vi
      .fn<InvestmentFinancialScreenRecipePlugin["cancel"]>()
      .mockResolvedValue(undefined),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("screen recipe native delivery", () => {
  it("chooses with capture metadata only and writes the exact admitted definition", async () => {
    const bridge = plugin();
    const document = recipe();
    await expect(
      createNativeFinancialScreenRecipeAdapter(bridge).deliver(
        document,
        context(),
      ),
    ).resolves.toBe("written");
    expect(bridge.choose).toHaveBeenCalledTimes(1);
    const metadata = bridge.choose.mock.calls[0]![0];
    expect(Object.keys(metadata).sort()).toEqual(["capturedAt", "operationId"]);
    expect(metadata.capturedAt).toBe(TIME);
    expect(metadata.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(bridge.write).toHaveBeenCalledExactlyOnceWith({
      operationId: metadata.operationId,
      handle: HANDLE,
      text: document.text,
    });
    expect(bridge.cancel).toHaveBeenCalledExactlyOnceWith({
      operationId: metadata.operationId,
    });
  });

  it.each([
    "valuation-inputs-draft",
    "watchlist-draft",
    "portfolio-draft",
    "followups-draft",
  ])(
    "refuses %s documents before calling the recipe plugin",
    async (purpose) => {
      const original = recipe();
      const text = original.text.replace(
        "investment-financial-screen-recipe",
        `investment-${purpose}`,
      );
      const foreign = {
        ...original,
        text,
        byteLength: new TextEncoder().encode(text).byteLength,
        filename: original.filename.replace("financial-screen-recipe", purpose),
      };
      const bridge = plugin();
      await expect(
        createNativeFinancialScreenRecipeAdapter(bridge).deliver(
          foreign,
          context(),
        ),
      ).rejects.toThrow(FAILURE);
      expect(bridge.choose).not.toHaveBeenCalled();
      expect(bridge.write).not.toHaveBeenCalled();
    },
  );

  it.each([
    { capturedAt: "2026-10-24T01:02:03.456Z" },
    { filename: "private.json" },
    { mime: "text/html" },
    { byteLength: 1 },
    { purpose: "foreign" },
  ])("refuses a mismatched or extra document wrapper %j", async (fields) => {
    const bridge = plugin();
    const invalid = {
      ...recipe(),
      ...fields,
    } as ManagedFinancialScreenRecipeDocument;
    await expect(
      createNativeFinancialScreenRecipeAdapter(bridge).deliver(
        invalid,
        context(),
      ),
    ).rejects.toThrow(FAILURE);
    expect(bridge.choose).not.toHaveBeenCalled();
  });

  it("preserves system cancellation without writing", async () => {
    const bridge = plugin();
    bridge.choose.mockResolvedValue({ status: "cancelled" });
    await expect(
      createNativeFinancialScreenRecipeAdapter(bridge).deliver(
        recipe(),
        context(),
      ),
    ).resolves.toBe("cancelled");
    expect(bridge.write).not.toHaveBeenCalled();
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
  });

  it.each(["abort", "retire"] as const)(
    "does not open the chooser for an already %s context",
    async (mode) => {
      const current = context();
      if (mode === "abort") current.controller.abort();
      else current.isCurrent = () => false;
      const bridge = plugin();
      await expect(
        createNativeFinancialScreenRecipeAdapter(bridge).deliver(
          recipe(),
          current,
        ),
      ).resolves.toBe("cancelled");
      expect(bridge.choose).not.toHaveBeenCalled();
      expect(bridge.cancel).not.toHaveBeenCalled();
    },
  );

  it.each(["abort", "retire"] as const)(
    "fences a late chooser after %s and cancels the operation once",
    async (mode) => {
      const choice =
        deferred<
          Awaited<ReturnType<InvestmentFinancialScreenRecipePlugin["choose"]>>
        >();
      const bridge = plugin();
      bridge.choose.mockReturnValue(choice.promise);
      const current = context();
      const result = createNativeFinancialScreenRecipeAdapter(bridge).deliver(
        recipe(),
        current,
      );
      if (mode === "abort") current.controller.abort();
      else current.isCurrent = () => false;
      choice.resolve({ status: "chosen", handle: HANDLE });
      await expect(result).resolves.toBe("cancelled");
      expect(bridge.write).not.toHaveBeenCalled();
      expect(bridge.cancel).toHaveBeenCalledTimes(1);
    },
  );

  it("fences completion of a write after the context retires", async () => {
    const written = deferred<{ status: "written" }>();
    const started = deferred<void>();
    const bridge = plugin();
    bridge.write.mockImplementation(() => {
      started.resolve();
      return written.promise;
    });
    const current = context();
    const result = createNativeFinancialScreenRecipeAdapter(bridge).deliver(
      recipe(),
      current,
    );
    await started.promise;
    current.isCurrent = () => false;
    written.resolve({ status: "written" });
    await expect(result).resolves.toBe("cancelled");
    expect(bridge.write).toHaveBeenCalledTimes(1);
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
  });

  it("captures admitted text, refuses concurrent delivery and releases the chooser after completion", async () => {
    const choice =
      deferred<
        Awaited<ReturnType<InvestmentFinancialScreenRecipePlugin["choose"]>>
      >();
    const bridge = plugin();
    bridge.choose
      .mockReturnValueOnce(choice.promise)
      .mockResolvedValue({ status: "cancelled" });
    const adapter = createNativeFinancialScreenRecipeAdapter(bridge);
    const document = { ...recipe() };
    const originalText = document.text;
    const result = adapter.deliver(document, context());
    document.text = "changed after admission";
    await expect(adapter.deliver(recipe(), context())).rejects.toThrow(FAILURE);
    expect(bridge.choose).toHaveBeenCalledTimes(1);
    choice.resolve({ status: "chosen", handle: HANDLE });
    await expect(result).resolves.toBe("written");
    expect(bridge.write.mock.calls[0]![0].text).toBe(originalText);
    await expect(adapter.deliver(recipe(), context())).resolves.toBe(
      "cancelled",
    );
    expect(bridge.choose).toHaveBeenCalledTimes(2);
  });

  it("returns the fixed error on bridge failure and still clears its operation", async () => {
    const bridge = plugin();
    bridge.write.mockRejectedValue(new Error("private provider detail"));
    bridge.cancel.mockRejectedValue(new Error("private cleanup detail"));
    await expect(
      createNativeFinancialScreenRecipeAdapter(bridge).deliver(
        recipe(),
        context(),
      ),
    ).rejects.toThrow(FAILURE);
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
  });
});

function browser() {
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    click: vi.fn(),
    remove: vi.fn(),
  };
  const createObjectURL = vi
    .fn<(blob: Blob) => string>()
    .mockReturnValue("blob:invented-recipe");
  const revokeObjectURL = vi.fn();
  const frame = vi
    .fn<(callback: FrameRequestCallback) => number>()
    .mockReturnValue(1);
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("document", {
    createElement: vi.fn(() => anchor),
    body: { append: vi.fn() },
  });
  vi.stubGlobal("window", {
    requestAnimationFrame: frame,
    cancelAnimationFrame: vi.fn(),
  });
  return { anchor, createObjectURL, revokeObjectURL, frame };
}

describe("screen recipe browser download", () => {
  it("downloads the exact JSON filename and UTF-8 body and revokes its local URL", async () => {
    const stub = browser();
    const document = recipe();
    const result = browserFinancialScreenRecipeAdapter.deliver(
      document,
      context(),
    );
    expect(stub.anchor.download).toBe(document.filename);
    expect(stub.anchor.click).toHaveBeenCalledTimes(1);
    expect(stub.anchor.remove).toHaveBeenCalledTimes(1);
    const blob = stub.createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(await blob.text()).toBe(document.text);
    stub.frame.mock.calls[0]![0](0);
    await expect(result).resolves.toBe("download_requested");
    expect(stub.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:invented-recipe",
    );
  });

  it("refuses invalid recipe bytes without allocating a URL", async () => {
    const stub = browser();
    await expect(
      browserFinancialScreenRecipeAdapter.deliver(
        { ...recipe(), text: "{}" },
        context(),
      ),
    ).rejects.toThrow(FAILURE);
    expect(stub.createObjectURL).not.toHaveBeenCalled();
  });

  it("rechecks currentness before click and releases the unrequested download", async () => {
    const stub = browser();
    const current = context();
    current.isCurrent = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    await expect(
      browserFinancialScreenRecipeAdapter.deliver(recipe(), current),
    ).resolves.toBe("cancelled");
    expect(stub.anchor.click).not.toHaveBeenCalled();
    expect(stub.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(stub.anchor.remove).toHaveBeenCalledTimes(1);
  });

  it("cleans up an already requested browser download when its lifetime ends", async () => {
    const stub = browser();
    const current = context();
    const result = browserFinancialScreenRecipeAdapter.deliver(
      recipe(),
      current,
    );
    current.controller.abort();
    await expect(result).resolves.toBe("download_requested");
    stub.frame.mock.calls[0]![0](0);
    expect(stub.anchor.click).toHaveBeenCalledTimes(1);
    expect(stub.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
