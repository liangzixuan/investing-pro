import { expect, it } from "vitest";
import { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { eodSelection } from "./eod-history-fixture";

function editor() {
  const model = new ManagedValuationWorkbench();
  model.activate(eodSelection);
  model.setDcfField(
    "startingUnleveredCashFlowUsd",
    " Unfinished assumption 😀 ",
  );
  model.setExitScenario("expansion", "exitMultiple", "0x10");
  const capture = model.captureInputs()!;
  return { model, capture };
}
it("restores exact raw file inputs as dirty with no saved acknowledgement or calculation", () => {
  const { model, capture } = editor();
  model.calculate();
  const before = model.getSnapshot();
  expect(model.restoreDraftInputs(capture.entry, before)).toBe(true);
  expect(model.getSnapshot()).toMatchObject({
    dirty: true,
    calculation: null,
    inputIssue: null,
  });
  expect(model.getSnapshot().dcfDraft).toEqual(capture.entry.dcf.inputs);
  expect(model.getSnapshot().exitDraft).toEqual(capture.entry.exit.inputs);
  model.reconcileSavedInputs({ schemaVersion: 1, entries: [capture.entry] });
  expect(model.getSnapshot().dirty).toBe(true);
  expect(model.acknowledgeSavedInputs(capture)).toBe(false);
});
it("retains the distinct explicitly confirmed saved-input restore behavior", () => {
  const { model, capture } = editor();
  expect(model.restoreInputs(capture.entry, model.getSnapshot())).toBe(true);
  expect(model.getSnapshot().dirty).toBe(false);
  expect(model.getSnapshot().calculation).toBeNull();
});
it("requires exact CIK for local files in both known-to-unknown directions", () => {
  const { model, capture } = editor(),
    before = model.getSnapshot();
  expect(
    model.restoreDraftInputs({ ...capture.entry, cik: null }, before),
  ).toBe(false);
  expect(model.getSnapshot()).toBe(before);
  const unknown = new ManagedValuationWorkbench();
  unknown.activate({ ...eodSelection, cik: null });
  const unknownBefore = unknown.getSnapshot();
  expect(unknown.restoreDraftInputs(capture.entry, unknownBefore)).toBe(false);
  expect(unknown.getSnapshot()).toBe(unknownBefore);
});
it("does not replace a retained other-company editor or accept an old restored snapshot", () => {
  const { model, capture } = editor();
  const previous = model.getSnapshot();
  model.setDcfField("waccPercent", "9");
  model.setDcfField("waccPercent", "");
  expect(model.restoreDraftInputs(capture.entry, previous)).toBe(false);
  const listing = { ...eodSelection.listing, listingId: "listing-other" };
  model.activate({ ...eodSelection, listing });
  const retained = model.getSnapshot();
  expect(retained.editable).toBe(false);
  expect(
    model.restoreDraftInputs({ ...capture.entry, listing }, retained),
  ).toBe(false);
  expect(model.getSnapshot()).toBe(retained);
});
it("retains retirement and subscriber reentry fences", () => {
  const { model, capture } = editor();
  const stop = model.subscribe(() => model.retire());
  expect(model.restoreDraftInputs(capture.entry, model.getSnapshot())).toBe(
    false,
  );
  stop();
  expect(model.getSnapshot().retired).toBe(true);
  expect(model.restoreDraftInputs(capture.entry, model.getSnapshot())).toBe(
    false,
  );
});
