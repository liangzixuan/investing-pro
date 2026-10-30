import { TrialApiError } from "./api";
import { afterEach, expect, it, vi } from "vitest";
import {
  collectionFixture,
  collectionFile,
  scope,
  deferred,
} from "./test-valuation-collection-fixture";
import { parseManagedValuationCollectionDraftFile } from "./managed-valuation-collection-draft-file";
import type { ValuationCollectionDraftContext } from "./managed-valuation-assumptions";
type Fixture = Awaited<ReturnType<typeof collectionFixture>>;
const opened: Fixture[] = [];
afterEach(() => {
  for (const f of opened.splice(0)) f.close();
});
async function fixture() {
  const f = await collectionFixture();
  opened.push(f);
  return f;
}
it("captures the whole staged collection, inspects before chosen delivery, preserves unrelated editor and saved base", async () => {
  const f = await fixture(),
    model = f.workspace.valuationAssumptions;
  const draft = { ...f.payload, entries: [...f.payload.entries].reverse() };
  model.coordinator.replaceDraft(draft);
  f.workspace.valuation.setExitField("baseRevenue", "unrelated editor");
  f.workspace.valuation.calculate();
  const editor = f.workspace.valuation.getSnapshot(),
    saved = model.coordinator.getSnapshot();
  expect(f.recovery.captureDraft()).toBe(true);
  expect(f.deliver).not.toHaveBeenCalled();
  expect(f.recovery.getSnapshot().preview?.payload).toEqual(draft);
  expect(model.canSavePayload()).toBe(false);
  await f.recovery.saveFile();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(
    parseManagedValuationCollectionDraftFile(
      f.deliver.mock.calls[0]![0].text,
      scope,
    )?.payload,
  ).toEqual(draft);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(model.coordinator.getSnapshot()).toBe(saved);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("recovers all entries into a newer saved base and requires explicit catalog review, Save and fresh Load", async () => {
  const f = await fixture(),
    captured = { ...f.payload, entries: [...f.payload.entries].reverse() };
  const file = collectionFile(captured);
  const model = f.workspace.valuationAssumptions;
  f.setStored(9, { schemaVersion: 1, entries: [] });
  await model.coordinator.load();
  f.workspace.valuation.setDcfField("waccPercent", "unrelated");
  f.workspace.valuation.calculate();
  const editor = f.workspace.valuation.getSnapshot(),
    before = model.coordinator.getSnapshot();
  await f.recovery.readFile(file);
  expect(f.recovery.getSnapshot().preview?.payload).toEqual(captured);
  expect(f.recovery.restoreDraft()).toBe(true);
  expect(f.recovery.restoreDraft()).toBe(false);
  expect(model.coordinator.getSnapshot()).toMatchObject({
    baseVersion: 9,
    dirty: true,
    draft: captured,
  });
  expect(model.coordinator.getSnapshot().saved).toBe(before.saved);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(model.canSavePayload()).toBe(false);
  expect(f.api.resolve).not.toHaveBeenCalled();
  await model.reviewCatalog();
  expect(model.applyCatalogReview()).toBe(true);
  expect(model.canSavePayload()).toBe(true);
  await model.coordinator.save();
  expect(f.api.saveValuationAssumptions).toHaveBeenCalledOnce();
  await model.coordinator.load();
  expect(model.coordinator.getSnapshot().draft).toEqual(captured);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(f.unexpected).not.toHaveBeenCalled();
});
it("refuses forged or unowned contexts before touching the resource or editor", async () => {
  const f = await fixture(),
    model = f.workspace.valuationAssumptions,
    before = model.coordinator.getSnapshot(),
    editor = f.workspace.valuation.getSnapshot(),
    owner = {};
  model.beginCollectionFileActivity(owner);
  for (const context of [
    {},
    { draft: before.draft },
    { ...model.getDraftFileContext(owner)! },
  ])
    expect(
      model.restoreFileDraft(
        context as ValuationCollectionDraftContext,
        { schemaVersion: 1, entries: [] },
        owner,
      ),
    ).toBe(false);
  const issued = model.getDraftFileContext(owner)!;
  model.endCollectionFileActivity(owner);
  expect(
    model.restoreFileDraft(issued, { schemaVersion: 1, entries: [] }, owner),
  ).toBe(false);
  expect(model.coordinator.getSnapshot()).toBe(before);
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
});
it.each(["draft ABA", "route ABA", "save", "session", "file activity"])(
  "retires delayed reads on %s",
  async (cause) => {
    const f = await fixture(),
      model = f.workspace.valuationAssumptions,
      wait = deferred<ArrayBuffer>(),
      original = model.coordinator.getSnapshot().draft!,
      file = collectionFile(f.payload);
    const pending = f.recovery.readFile({
      size: file.size,
      arrayBuffer: () => wait.promise,
    });
    if (cause === "draft ABA") {
      model.coordinator.replaceDraft({ schemaVersion: 1, entries: [] });
      model.coordinator.replaceDraft(original);
    }
    if (cause === "route ABA") {
      f.active(false);
      f.active(true);
    }
    if (cause === "save") await model.coordinator.load();
    if (cause === "session") f.workspace.sessionOwner.retire("test");
    if (cause === "file activity") {
      const activity = {};
      f.workspace.valuation.beginDraftFileActivity(activity);
      f.workspace.valuation.endDraftFileActivity(activity);
    }
    wait.resolve(await file.arrayBuffer());
    await pending;
    expect(f.recovery.getSnapshot().preview).toBeNull();
    expect(f.recovery.restoreDraft()).toBe(false);
  },
);
it("consumes before reentrant notifications and preserves the intervening draft", async () => {
  const f = await fixture(),
    model = f.workspace.valuationAssumptions;
  await f.recovery.readFile(collectionFile({ schemaVersion: 1, entries: [] }));
  let fired = false;
  const later = { ...f.payload, entries: [f.payload.entries[1]!] };
  const unsubscribe = f.recovery.subscribe(() => {
    if (!fired && f.recovery.getSnapshot().phase === "idle") {
      fired = true;
      model.coordinator.replaceDraft(later);
      expect(f.recovery.restoreDraft()).toBe(false);
    }
  });
  expect(f.recovery.restoreDraft()).toBe(false);
  unsubscribe();
  expect(model.coordinator.getSnapshot().draft).toEqual(later);
});
it("does not report an exact commit after a listener changes and restores draft text", async () => {
  const f = await fixture(),
    model = f.workspace.valuationAssumptions;
  const target = {
    schemaVersion: 1 as const,
    entries: [f.payload.entries[1]!],
  };
  await f.recovery.readFile(collectionFile(target));
  let fired = false;
  const unsubscribe = model.coordinator.subscribe(() => {
    if (!fired && model.coordinator.getSnapshot().draft?.entries.length === 1) {
      fired = true;
      model.coordinator.replaceDraft({ schemaVersion: 1, entries: [] });
      model.coordinator.replaceDraft(target);
    }
  });
  expect(f.recovery.restoreDraft()).toBe(false);
  unsubscribe();
  expect(model.coordinator.getSnapshot().draft).toEqual(target);
});
it("cancellation and a late chosen-document completion cannot revive capture", async () => {
  const f = await fixture(),
    result = deferred<"written">();
  f.deliver.mockImplementationOnce(() => result.promise);
  const before = f.workspace.valuationAssumptions.coordinator.getSnapshot();
  expect(f.recovery.captureDraft()).toBe(true);
  const saving = f.recovery.saveFile();
  f.recovery.cancel();
  const [, context] = f.deliver.mock.calls[0]!;
  expect(context.signal.aborted).toBe(true);
  result.resolve("written");
  await saving;
  expect(f.recovery.getSnapshot().phase).toBe("idle");
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    before,
  );
});
it("refuses foreign and mismatched files without changing draft/editor/base", async () => {
  const f = await fixture(),
    before = f.workspace.valuationAssumptions.coordinator.getSnapshot(),
    editor = f.workspace.valuation.getSnapshot();
  await f.recovery.readFile(
    collectionFile(f.payload, `sha256:${"d".repeat(64)}`),
  );
  const file = collectionFile(f.payload);
  await f.recovery.readFile({ ...file, size: file.size + 1 });
  expect(f.recovery.getSnapshot().preview).toBeNull();
  expect(f.workspace.valuationAssumptions.coordinator.getSnapshot()).toBe(
    before,
  );
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
});

it("does not acknowledge an older staged editor capture after collection restore and Save", async () => {
  const f = await fixture(),
    model = f.workspace.valuationAssumptions;
  f.workspace.valuation.setExitField("cash", "12.00");
  await model.prepareStage();
  expect(model.stageCurrent()).toBe(true);
  const staged = model.coordinator.getSnapshot().draft!;
  const editor = f.workspace.valuation.getSnapshot();
  const acknowledge = vi.spyOn(f.workspace.valuation, "acknowledgeSavedInputs");
  await f.recovery.readFile(collectionFile(staged));
  expect(f.recovery.restoreDraft()).toBe(true);
  await model.coordinator.save();
  expect(acknowledge).not.toHaveBeenCalled();
  expect(f.workspace.valuation.getSnapshot()).toBe(editor);
  expect(f.workspace.valuation.getSnapshot().dirty).toBe(true);
});
it("recovers a delivered collection in a new workspace/session lifetime", async () => {
  const first = await fixture();
  first.workspace.valuationAssumptions.coordinator.replaceDraft({
    ...first.payload,
    entries: [...first.payload.entries].reverse(),
  });
  expect(first.recovery.captureDraft()).toBe(true);
  await first.recovery.saveFile();
  const document = first.deliver.mock.calls[0]![0];
  first.close();
  const fresh = await fixture();
  fresh.setStored(5, { schemaVersion: 1, entries: [] });
  await fresh.workspace.valuationAssumptions.coordinator.load();
  const bytes = new TextEncoder().encode(document.text).buffer;
  await fresh.recovery.readFile({
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  });
  expect(fresh.recovery.restoreDraft()).toBe(true);
  expect(
    fresh.workspace.valuationAssumptions.coordinator.getSnapshot(),
  ).toMatchObject({
    baseVersion: 5,
    draft: { entries: [first.payload.entries[1], first.payload.entries[0]] },
  });
});
it.each(["conflict", "commit_unknown"] as const)(
  "refuses file work during %s save recovery",
  async (code) => {
    const f = await fixture(),
      model = f.workspace.valuationAssumptions;
    model.coordinator.replaceDraft(f.payload);
    vi.mocked(f.api.saveValuationAssumptions).mockRejectedValueOnce(
      new TrialApiError(code),
    );
    await model.coordinator.save();
    const before = model.coordinator.getSnapshot();
    expect(f.recovery.getSnapshot().canImport).toBe(false);
    expect(f.recovery.captureDraft()).toBe(false);
    await f.recovery.readFile(collectionFile(f.payload));
    expect(model.coordinator.getSnapshot()).toBe(before);
  },
);
it("does not revive an imported preview after catalog replacement or a pending base load", async () => {
  const f = await fixture();
  await f.recovery.readFile(collectionFile(f.payload));
  await f.workspace.refreshCatalog();
  expect(f.recovery.restoreDraft()).toBe(false);
  const wait = deferred<{ version: number; payload: typeof f.payload }>();
  vi.mocked(f.api.loadValuationAssumptions).mockReturnValueOnce(wait.promise);
  const loading = f.workspace.valuationAssumptions.coordinator.load();
  expect(f.recovery.getSnapshot().canImport).toBe(false);
  wait.resolve({ version: 4, payload: f.payload });
  await loading;
  expect(f.recovery.restoreDraft()).toBe(false);
});
