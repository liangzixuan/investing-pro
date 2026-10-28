import { afterEach, expect, it, vi } from "vitest";
import type { ValuationAssumptionEntry } from "@research-cockpit/contracts";
import {
  valuationFileFixture,
  inputFile,
  deferred,
  scope,
} from "./test-valuation-draft-recovery-fixture";
import { parseManagedValuationDraftFile } from "./managed-valuation-draft-file";

type Fixture = Awaited<ReturnType<typeof valuationFileFixture>>;
const open: Fixture[] = [];
afterEach(() => {
  for (const f of open.splice(0).reverse()) f.close();
});
async function fixture() {
  const f = await valuationFileFixture();
  open.push(f);
  return f;
}
function entry(
  f: Fixture,
  raw = "Unfinished raw assumption 😀",
): ValuationAssumptionEntry {
  const capture = f.workspace.valuation.captureInputs();
  if (!capture) throw new Error("Missing invented editor capture");
  const value = structuredClone(capture.entry);
  return {
    ...value,
    dcf: {
      ...value.dcf,
      inputs: { ...value.dcf.inputs, startingUnleveredCashFlowUsd: raw },
    },
  };
}

it("captures exact raw inputs without loading or changing any saved resource or calculation", async () => {
  const f = await fixture(),
    editor = f.workspace.valuation.getSnapshot();
  const saved = f.workspace.valuationAssumptions.coordinator.getSnapshot();
  expect(saved.saved).toBeNull();
  expect(f.recovery.getSnapshot().canExport).toBe(true);
  await f.recovery.exportInputs();
  expect(f.deliver).toHaveBeenCalledOnce();
  const [document, context] = f.deliver.mock.calls[0]!;
  expect(
    parseManagedValuationDraftFile(document.text, scope)?.entry.dcf.inputs
      .startingUnleveredCashFlowUsd,
  ).toBe(" 001.50 ");
  expect(context.signal.aborted).toBe(true);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    saved,
  );
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("reviews every raw input, cancels without change, then restores only the dirty editor", async () => {
  const f = await fixture(),
    before = f.workspace.valuation.getSnapshot();
  const save = f.workspace.valuationAssumptions.coordinator.getSnapshot();
  const raw = entry(f);
  await f.recovery.readFile(inputFile(raw));
  expect(f.recovery.getSnapshot()).toMatchObject({
    phase: "review",
    currentEditor: before,
    preview: { entry: raw },
  });
  expect(f.workspace.valuation.getSnapshot()).toBe(before);
  f.recovery.cancel();
  expect(f.workspace.valuation.getSnapshot()).toBe(before);
  await f.recovery.readFile(inputFile(raw));
  expect(f.recovery.restore()).toBe(true);
  const restored = f.workspace.valuation.getSnapshot();
  expect(restored).toMatchObject({
    dirty: true,
    calculation: null,
    inputIssue: null,
  });
  expect(restored.dcfDraft).toEqual(raw.dcf.inputs);
  expect(restored.exitDraft).toEqual(raw.exit.inputs);
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(save);
  expect(f.recovery.restore()).toBe(false);
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("clears previous calculation and rejects an older saved-input acknowledgement after file restore", async () => {
  const f = await fixture(),
    workbench = f.workspace.valuation;
  const old = workbench.captureInputs()!;
  workbench.calculate();
  const file = inputFile(entry(f));
  expect(workbench.getSnapshot().calculation).not.toBeNull();
  await f.recovery.readFile(file);
  expect(f.recovery.restore()).toBe(true);
  expect(workbench.acknowledgeSavedInputs(old)).toBe(false);
  expect(workbench.getSnapshot().dirty).toBe(true);
  expect(workbench.getSnapshot().calculation).toBeNull();
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("refuses capture after rejected oversized input while allowing an explicit reviewed replacement", async () => {
  const f = await fixture(),
    raw = entry(f),
    workbench = f.workspace.valuation;
  workbench.setDcfField("waccPercent", "x".repeat(513));
  const before = workbench.getSnapshot();
  expect(before.inputIssue).not.toBeNull();
  expect(f.recovery.getSnapshot().canExport).toBe(false);
  await f.recovery.exportInputs();
  expect(f.deliver).not.toHaveBeenCalled();
  await f.recovery.readFile(inputFile(raw));
  expect(f.recovery.getSnapshot().currentEditor).toBe(before);
  expect(f.recovery.restore()).toBe(true);
  expect(workbench.getSnapshot()).toMatchObject({
    inputIssue: null,
    dirty: true,
    calculation: null,
  });
});

it.each(["catalog", "listing", "cik", "account"])(
  "refuses %s mismatch without replacing or loading the editor",
  async (kind) => {
    const f = await fixture(),
      original = entry(f),
      before = f.workspace.valuation.getSnapshot();
    const changed =
      kind === "catalog"
        ? {
            ...original,
            catalogSnapshotSha256: `sha256:${"f".repeat(64)}` as const,
          }
        : kind === "listing"
          ? {
              ...original,
              listing: { ...original.listing, issuerName: "Other issuer name" },
            }
          : kind === "cik"
            ? { ...original, cik: "0000000002" }
            : original;
    await f.recovery.readFile(
      inputFile(
        changed,
        kind === "account" ? `sha256:${"f".repeat(64)}` : scope,
      ),
    );
    expect(f.recovery.getSnapshot().preview).toBeNull();
    expect(f.recovery.restore()).toBe(false);
    expect(f.workspace.valuation.getSnapshot()).toBe(before);
    expect(f.unexpected).not.toHaveBeenCalled();
  },
);

it("checks advertised size before a read and refuses size/byte mismatch without editor changes", async () => {
  const f = await fixture(),
    before = f.workspace.valuation.getSnapshot();
  const arrayBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(1)));
  for (const size of [0, -1, NaN, Infinity, 0.5, 128 * 1024 + 1])
    await f.recovery.readFile({ size, arrayBuffer });
  expect(arrayBuffer).not.toHaveBeenCalled();
  await f.recovery.readFile({ size: 2, arrayBuffer });
  expect(f.recovery.getSnapshot().preview).toBeNull();
  expect(f.workspace.valuation.getSnapshot()).toBe(before);
});

it("fences a late file read across edit-away-and-back and route departure", async () => {
  const f = await fixture(),
    slow = deferred<ArrayBuffer>(),
    file = inputFile(entry(f));
  const reading = f.recovery.readFile({
    size: file.size,
    arrayBuffer: () => slow.promise,
  });
  f.workspace.valuation.setDcfField("waccPercent", "10");
  f.workspace.valuation.setDcfField("waccPercent", "");
  slow.resolve(await file.arrayBuffer());
  await reading;
  expect(f.recovery.getSnapshot().preview).toBeNull();
  await f.recovery.readFile(file);
  expect(f.recovery.getSnapshot().phase).toBe("review");
  f.active(false);
  f.active(true);
  expect(f.recovery.restore()).toBe(false);
  expect(
    f.workspace.valuation.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd,
  ).toBe(" 001.50 ");
});

it("fences file review across online load and preserves independent saved inputs", async () => {
  const f = await fixture(),
    file = inputFile(entry(f));
  await f.recovery.readFile(file);
  const load = deferred<{
    version: number;
    payload: { schemaVersion: 1; entries: [] };
  }>();
  vi.mocked(f.api.loadValuationAssumptions).mockImplementation(
    () => load.promise,
  );
  const loading = f.workspace.valuationAssumptions.coordinator.load();
  expect(f.recovery.getSnapshot().preview).toBeNull();
  expect(f.recovery.getSnapshot().canImport).toBe(false);
  load.resolve({ version: 0, payload: { schemaVersion: 1, entries: [] } });
  await loading;
  expect(f.recovery.restore()).toBe(false);
  expect(
    f.workspace.valuation.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd,
  ).toBe(" 001.50 ");
  expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
});

it("rejects a reentrant edit during restore and a reentrant cancellation before file IO", async () => {
  const f = await fixture(),
    file = inputFile(entry(f));
  await f.recovery.readFile(file);
  let armed = true;
  const close = f.recovery.subscribe(() => {
    if (armed && f.recovery.getSnapshot().phase === "idle") {
      armed = false;
      f.workspace.valuation.setDcfField(
        "startingUnleveredCashFlowUsd",
        "Newer authored edit",
      );
    }
  });
  expect(f.recovery.restore()).toBe(false);
  close();
  expect(
    f.workspace.valuation.getSnapshot().dcfDraft.startingUnleveredCashFlowUsd,
  ).toBe("Newer authored edit");
  const cancel = f.recovery.subscribe(() => {
    if (f.recovery.getSnapshot().phase === "reading") f.recovery.cancel();
  });
  file.arrayBuffer.mockClear();
  await f.recovery.readFile(file);
  cancel();
  expect(file.arrayBuffer).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("retires delivery and read guards with the session and does not replay late completion", async () => {
  const f = await fixture(),
    delivered = deferred<"written">();
  f.deliver.mockImplementation(() => delivered.promise);
  const saving = f.recovery.exportInputs();
  const context = f.deliver.mock.calls[0]![1];
  expect(context.isCurrent()).toBe(true);
  f.workspace.sessionOwner.retire("Invented session ended");
  expect(context.isCurrent()).toBe(false);
  expect(context.signal.aborted).toBe(true);
  delivered.resolve("written");
  await saving;
  expect(f.recovery.getSnapshot()).toMatchObject({
    phase: "retired",
    preview: null,
    currentEditor: null,
    message: "",
  });
  expect(f.workspace.valuation.getSnapshot().retired).toBe(true);
});

it("preserves an unspecified CIK and refuses to infer a known issuer from the file", async () => {
  const f = await fixture(),
    raw = entry(f);
  expect(raw.cik).toBeNull();
  await f.recovery.readFile(inputFile(raw));
  expect(f.recovery.restore()).toBe(true);
  expect(f.workspace.valuation.getSnapshot().owner?.cik).toBeNull();
  await f.recovery.readFile(inputFile({ ...raw, cik: "0000000001" }));
  expect(f.recovery.getSnapshot().preview).toBeNull();
  expect(f.recovery.restore()).toBe(false);
  expect(f.workspace.valuation.getSnapshot().owner?.cik).toBeNull();
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("refuses export when retained owner and current same-listing visit have different CIK qualifications", async () => {
  const f = await fixture(),
    workbench = f.workspace.valuation;
  const view = f.workspace.getSnapshot();
  const unknown = view.research!.selection;
  const known = { ...unknown, cik: "0000000001" };
  let visit: NonNullable<typeof view.research> = {
    ...view.research!,
    selection: known,
  };
  const read = vi
    .spyOn(f.workspace, "getSnapshot")
    .mockImplementation(() => ({ ...view, research: visit }));
  workbench.activate(known);
  expect(workbench.getSnapshot()).toMatchObject({
    editable: true,
    owner: { cik: null },
    context: { cik: "0000000001" },
  });
  expect(f.recovery.getSnapshot().canExport).toBe(false);
  await f.recovery.exportInputs();
  expect(f.deliver).not.toHaveBeenCalled();
  const matching = { ...entry(f), cik: "0000000001" };
  await f.recovery.readFile(inputFile(matching));
  expect(f.recovery.restore()).toBe(true);
  expect(workbench.getSnapshot().owner?.cik).toBe("0000000001");
  expect(f.recovery.getSnapshot().canExport).toBe(true);
  visit = { ...visit, selection: unknown };
  workbench.activate(unknown);
  expect(f.recovery.getSnapshot().canExport).toBe(false);
  await f.recovery.exportInputs();
  expect(f.deliver).not.toHaveBeenCalled();
  expect(workbench.getSnapshot().owner?.cik).toBe("0000000001");
  read.mockRestore();
});

it("continues restored inputs through separate explicit Load, staging review, Stage and Save", async () => {
  const f = await fixture(),
    model = f.workspace.valuationAssumptions;
  const raw = entry(f, " Still unfinished raw input ");
  await f.recovery.readFile(inputFile(raw));
  expect(f.recovery.restore()).toBe(true);
  expect(f.api.loadValuationAssumptions).not.toHaveBeenCalled();
  expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
  vi.mocked(f.api.loadValuationAssumptions).mockResolvedValue({
    version: 0,
    payload: { schemaVersion: 1, entries: [] },
  });
  await model.coordinator.load();
  expect(f.workspace.valuation.getSnapshot().dcfDraft).toEqual(raw.dcf.inputs);
  await model.prepareStage();
  expect(model.getSnapshot().stageReview?.capture.entry).toEqual(raw);
  expect(model.coordinator.getSnapshot().draft?.entries).toEqual([]);
  expect(f.recovery.getSnapshot().canImport).toBe(false);
  expect(f.recovery.getSnapshot().canExport).toBe(false);
  expect(model.stageCurrent()).toBe(true);
  expect(model.coordinator.getSnapshot().draft?.entries).toEqual([raw]);
  expect(f.api.saveValuationAssumptions).not.toHaveBeenCalled();
  vi.mocked(f.api.saveValuationAssumptions).mockImplementation((command) =>
    Promise.resolve({
      version: 1,
      payload: command.payload,
      replayed: false,
    }),
  );
  await model.coordinator.save();
  expect(f.api.loadValuationAssumptions).toHaveBeenCalledOnce();
  expect(f.api.saveValuationAssumptions).toHaveBeenCalledOnce();
  expect(model.coordinator.getSnapshot()).toMatchObject({
    dirty: false,
    baseVersion: 1,
    saved: { version: 1, payload: { entries: [raw] } },
  });
  expect(f.workspace.valuation.getSnapshot()).toMatchObject({
    dirty: false,
    calculation: null,
  });
  expect(f.unexpected).not.toHaveBeenCalled();
});

it("keeps a replacement file read started by the old activity-end notification", async () => {
  const f = await fixture();
  const file = inputFile(entry(f));
  await f.recovery.readFile(file);
  const bytes = await file.arrayBuffer();
  const pending = deferred<ArrayBuffer>();
  const replacementFile = {
    size: file.size,
    arrayBuffer: vi.fn(() => pending.promise),
  };
  let armed = true;
  let replacement: Promise<void> | undefined;
  const stop = f.workspace.valuation.subscribeDraftFileActivity(() => {
    if (armed && !f.workspace.valuation.hasDraftFileActivity()) {
      armed = false;
      replacement = f.recovery.readFile(replacementFile);
    }
  });
  try {
    f.recovery.cancel();
    expect(replacementFile.arrayBuffer).toHaveBeenCalledOnce();
    expect(f.recovery.getSnapshot().phase).toBe("reading");
    expect(f.workspace.valuation.hasDraftFileActivity()).toBe(true);
  } finally {
    stop();
    pending.resolve(bytes);
    await replacement;
  }
  expect(f.recovery.getSnapshot().phase).toBe("review");
  expect(f.recovery.getSnapshot().preview?.entry).toEqual(entry(f));
});

it("closes disposal before activity-end listeners can start another file read", async () => {
  const f = await fixture();
  const file = inputFile(entry(f));
  await f.recovery.readFile(file);
  const bytes = await file.arrayBuffer();
  const pending = deferred<ArrayBuffer>();
  const replacementFile = {
    size: file.size,
    arrayBuffer: vi.fn(() => pending.promise),
  };
  let armed = true;
  let replacement: Promise<void> | undefined;
  const stop = f.workspace.valuation.subscribeDraftFileActivity(() => {
    if (armed && !f.workspace.valuation.hasDraftFileActivity()) {
      armed = false;
      replacement = f.recovery.readFile(replacementFile);
    }
  });
  try {
    f.recovery.dispose();
    expect(f.recovery.getSnapshot().phase).toBe("retired");
    expect(replacementFile.arrayBuffer).not.toHaveBeenCalled();
    expect(f.workspace.valuation.hasDraftFileActivity()).toBe(false);
  } finally {
    stop();
    pending.resolve(bytes);
    await replacement;
  }
  expect(f.recovery.getSnapshot().phase).toBe("retired");
  expect(f.workspace.valuation.hasDraftFileActivity()).toBe(false);
});

it("releases its file activity even when an idle subscriber throws", async () => {
  const f = await fixture();
  await f.recovery.readFile(inputFile(entry(f)));
  const stop = f.recovery.subscribe(() => {
    if (f.recovery.getSnapshot().phase === "idle")
      throw new Error("Invented listener failure");
  });
  try {
    expect(() => f.recovery.cancel()).toThrow("Invented listener failure");
    expect(f.workspace.valuation.hasDraftFileActivity()).toBe(false);
    expect(f.recovery.getSnapshot().preview).toBeNull();
  } finally {
    stop();
  }
});

it("releases its owned file marker if the begin notification fails", async () => {
  const f = await fixture();
  const file = inputFile(entry(f));
  const stop = f.workspace.valuation.subscribeDraftFileActivity(() => {
    if (f.workspace.valuation.hasDraftFileActivity())
      throw new Error("Invented begin listener failure");
  });
  try {
    await expect(f.recovery.readFile(file)).rejects.toThrow(
      "Invented begin listener failure",
    );
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(f.workspace.valuation.hasDraftFileActivity()).toBe(false);
    expect(f.recovery.getSnapshot().phase).toBe("idle");
    expect(f.recovery.getSnapshot().canImport).toBe(true);
  } finally {
    stop();
  }
});
