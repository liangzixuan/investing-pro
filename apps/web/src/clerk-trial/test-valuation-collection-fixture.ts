import { vi } from "vitest";
import type { ManagedApi } from "./managed-api";
import type {
  ValuationAssumptionEntry,
  ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";
import {
  valuationFileFixture,
  scope,
} from "./test-valuation-draft-recovery-fixture";
import { ManagedValuationCollectionDraftRecovery } from "./managed-valuation-collection-recovery";
import { formatManagedValuationCollectionDraftFile } from "./managed-valuation-collection-draft-file";
export { scope, deferred } from "./test-valuation-draft-recovery-fixture";
export const time = "2026-10-30T00:00:00.000Z";
export async function collectionFixture() {
  const f = await valuationFileFixture();
  f.recovery.dispose();
  const first = structuredClone(f.workspace.valuation.captureInputs()!.entry);
  const second: ValuationAssumptionEntry = {
    ...structuredClone(first),
    cik: null,
    listing: {
      ...first.listing,
      listingId: "invented-second-listing",
      securityId: "invented-second-security",
      symbol: "TWO",
    },
    exit: {
      ...first.exit,
      inputs: {
        ...first.exit.inputs,
        baseRevenue: " unfinished 1.. 😀 ",
        cash: "",
        debt: " 000.0 ",
      },
    },
  };
  const payload: ValuationAssumptionsPayload = {
    schemaVersion: 1,
    entries: [first, second],
  };
  let stored = { version: 1, payload: structuredClone(payload) };
  f.api.loadValuationAssumptions = vi.fn<
    ManagedApi["loadValuationAssumptions"]
  >(() => Promise.resolve(structuredClone(stored)));
  f.api.saveValuationAssumptions = vi.fn<
    ManagedApi["saveValuationAssumptions"]
  >((command) => {
    stored = {
      version: command.expectedVersion + 1,
      payload: structuredClone(command.payload),
    };
    return Promise.resolve({ ...structuredClone(stored), replayed: false });
  });
  f.api.resolve = vi.fn<ManagedApi["resolve"]>((request) =>
    Promise.resolve({
      snapshotSha256: request.snapshotSha256,
      results: request.listingIds.map((listingId) => ({
        listingId,
        listing:
          payload.entries.find((row) => row.listing.listingId === listingId)
            ?.listing ?? null,
      })),
    }),
  );
  await f.workspace.valuationAssumptions.coordinator.load();
  let active = true;
  const recovery = new ManagedValuationCollectionDraftRecovery({
    workspace: f.workspace,
    accountScope: Promise.resolve(scope),
    delivery: { deliver: f.deliver },
    routeActive: () => active,
    now: () => time,
  });
  await Promise.resolve();
  return {
    ...f,
    recovery,
    payload,
    setStored: (version: number, next: ValuationAssumptionsPayload) => {
      stored = { version, payload: structuredClone(next) };
    },
    active: (value: boolean) => {
      active = value;
      recovery.reconcile();
    },
    close: () => {
      recovery.dispose();
      f.close();
    },
  };
}
export function collectionFile(
  payload: ValuationAssumptionsPayload,
  accountScope = scope,
) {
  const document = formatManagedValuationCollectionDraftFile({
    accountScope,
    capturedAt: time,
    payload,
  });
  if (!document) throw new Error("Invented collection file refused");
  const bytes = new TextEncoder().encode(document.text).buffer;
  return {
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
}
