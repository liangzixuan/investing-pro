import { describe, expect, it } from "vitest";
import { createFixture } from "./fixture";
import { parseValuationAssumptionsPayload } from "@research-cockpit/contracts";

const signal = () => new AbortController().signal;
async function loadedFresh() {
  const fixture = await createFixture("valuation-collection-recovery"),
    controls = fixture.collectionRecovery!;
  await fixture.api.loadValuationAssumptions(signal());
  controls.nextSession();
  await fixture.api.loadValuationAssumptions(signal());
  return { fixture, controls };
}
async function review(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return fixture.api.resolve(
    {
      snapshotSha256: fixture.researchCoverage.catalogSnapshotSha256,
      listingIds: fixture.collectionRecovery!.captured.entries.map(
        (e) => e.listing.listingId,
      ),
    },
    signal(),
  );
}
const key = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
describe("invented native valuation collection recovery transport", () => {
  it("keeps two complete raw maps, order, identities and blank values through exact Save and fresh Load", async () => {
    const { fixture, controls } = await loadedFresh();
    expect(controls.captured.entries.map((e) => e.listing.listingId)).toEqual([
      "listing-zero",
      "listing-one",
    ]);
    expect(parseValuationAssumptionsPayload(controls.captured)).toEqual(
      controls.captured,
    );
    expect(
      controls.captured.entries.map(
        (e) => e.dcf.inputs.startingUnleveredCashFlowUsd,
      ),
    ).toEqual(["  1.. Café 東京 📈  ", ""]);
    expect(controls.saved()).toEqual({ version: 7, payload: controls.newer });
    await review(fixture);
    const receipt = await fixture.api.saveValuationAssumptions(
      { expectedVersion: 7, idempotencyKey: key, payload: controls.reviewed },
      signal(),
    );
    expect(receipt).toEqual({
      version: 8,
      payload: controls.reviewed,
      replayed: false,
    });
    controls.nextSession();
    expect(await fixture.api.loadValuationAssumptions(signal())).toEqual({
      version: 8,
      payload: controls.reviewed,
    });
    expect(controls.getSnapshot()).toEqual({
      session: 2,
      load: 3,
      save: 1,
      review: 1,
      company: 0,
      rejected: 0,
    });
  });
  it.each(["old-base", "reordered", "changed-raw", "unreviewed", "extra-key"])(
    "refuses %s without saving a partial collection",
    async (kind) => {
      const { fixture, controls } = await loadedFresh();
      if (kind !== "unreviewed") await review(fixture);
      let payload = structuredClone(controls.reviewed);
      if (kind === "reordered")
        payload = { ...payload, entries: [...payload.entries].reverse() };
      if (kind === "changed-raw")
        payload = {
          ...payload,
          entries: payload.entries.map((entry, index) =>
            index === 0
              ? {
                  ...entry,
                  dcf: {
                    ...entry.dcf,
                    inputs: {
                      ...entry.dcf.inputs,
                      startingUnleveredCashFlowUsd: "normalized",
                    },
                  },
                }
              : entry,
          ),
        };
      const input = {
        expectedVersion: kind === "old-base" ? 3 : 7,
        idempotencyKey: key,
        payload,
        ...(kind === "extra-key" ? { extra: true } : {}),
      };
      await expect(
        fixture.api.saveValuationAssumptions(input, signal()),
      ).rejects.toThrow("Unexpected invented");
      expect(controls.saved()).toEqual({ version: 7, payload: controls.newer });
      expect(controls.getSnapshot().save).toBe(0);
    },
  );
  it("refuses implicit extra Load, source reads and unrelated writes", async () => {
    const fixture = await createFixture("valuation-collection-recovery"),
      controls = fixture.collectionRecovery!;
    await fixture.api.loadValuationAssumptions(signal());
    await expect(
      fixture.api.loadValuationAssumptions(signal()),
    ).rejects.toThrow("Unexpected invented");
    expect(() => fixture.api.loadPortfolio(signal())).toThrow(
      "Unexpected invented",
    );
    expect(() => fixture.api.saveFollowups({} as never, signal())).toThrow(
      "Unexpected invented",
    );
    expect(() => fixture.api.annualReport({} as never, signal())).toThrow(
      "Unexpected invented",
    );
    expect(controls.getSnapshot().save).toBe(0);
  });
});

it("runs the actual collection controller over the strict native fixture through fresh sessions and newer-base Save", async () => {
  const { ManagedWorkspace } =
    await import("../../src/clerk-trial/managed-workspace");
  const { ManagedValuationCollectionDraftRecovery } =
    await import("../../src/clerk-trial/managed-valuation-collection-recovery");
  const fixture = await createFixture("valuation-collection-recovery"),
    controls = fixture.collectionRecovery!;
  const scope = `sha256:${"c".repeat(64)}`;
  let text = "",
    session = fixture.session;
  async function mount() {
    const workspace = new ManagedWorkspace(fixture.api, session, undefined, {
      researchCoverage: fixture.researchCoverage,
      marketsCohort: fixture.marketsCohort,
      priceCoverage: fixture.priceCoverage,
    });
    await workspace.coordinator.load();
    await workspace.refreshCatalog();
    const member = workspace.coordinator.getSnapshot().draft!.memberships[0]!;
    workspace.openWatchlistAnnual(member);
    await workspace.setCompanyRoute({
      kind: "company",
      listingId: member.listingId,
      section: "annual",
    });
    await workspace.valuationAssumptions.coordinator.load();
    const editor = workspace.valuation.getSnapshot(),
      context = editor.context!;
    const { savedValuationInputs } = await import("./fixture");
    expect(
      workspace.valuation.restoreDraftInputs(
        {
          ...savedValuationInputs!,
          listing: context.listing,
          cik: context.cik,
          catalogSnapshotSha256: context.catalogSnapshotSha256,
        },
        editor,
      ),
    ).toBe(true);
    expect(workspace.valuation.calculate()).not.toBeNull();
    const recovery = new ManagedValuationCollectionDraftRecovery({
      workspace,
      accountScope: Promise.resolve(scope),
      delivery: {
        deliver: (document) => {
          text = document.text;
          return Promise.resolve("written" as const);
        },
      },
      routeActive: () => true,
      now: () => "2026-10-29T18:00:00.000Z",
    });
    await Promise.resolve();
    return {
      workspace,
      recovery,
      close: () => {
        recovery.dispose();
        workspace.sessionOwner.dispose();
      },
    };
  }
  const first = await mount();
  first.workspace.valuationAssumptions.coordinator.replaceDraft(
    controls.captured,
  );
  expect(first.recovery.captureDraft()).toBe(true);
  await first.recovery.saveFile();
  const file: unknown = JSON.parse(text);
  expect(file).toMatchObject({ payload: controls.captured });
  first.close();
  session = controls.nextSession();
  const second = await mount(),
    editor = second.workspace.valuation.getSnapshot(),
    model = second.workspace.valuationAssumptions;
  const before = model.coordinator.getSnapshot();
  const bytes = new TextEncoder().encode(text);
  await second.recovery.readFile({
    size: bytes.length,
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  });
  expect(second.recovery.getSnapshot().phase).toBe("review");
  expect(second.recovery.restoreDraft()).toBe(true);
  expect(model.coordinator.getSnapshot().saved).toBe(before.saved);
  expect(model.coordinator.getSnapshot().baseVersion).toBe(7);
  expect(second.workspace.valuation.getSnapshot()).toBe(editor);
  expect(model.canSavePayload()).toBe(false);
  await model.reviewCatalog();
  expect(model.applyCatalogReview()).toBe(true);
  expect(model.canSavePayload()).toBe(true);
  await model.coordinator.save();
  expect(model.coordinator.getSnapshot().saved).toEqual({
    version: 8,
    payload: controls.reviewed,
  });
  expect(second.workspace.valuation.getSnapshot()).toBe(editor);
  second.close();
  session = controls.nextSession();
  const third = await mount();
  expect(
    third.workspace.valuationAssumptions.coordinator.getSnapshot().draft,
  ).toEqual(controls.reviewed);
  third.close();
  expect(controls.getSnapshot()).toEqual({
    session: 2,
    load: 3,
    save: 1,
    review: 1,
    company: 0,
    rejected: 0,
  });
  expect(fixture.getSnapshot()).toMatchObject({
    load: 3,
    status: 3,
    marketsResolve: 3,
    save: 0,
    annual: 0,
    eod: 0,
  });
});
