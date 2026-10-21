import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type {
  ManagedPortfolioDto,
  ManagedPortfolioPayload,
  ManagedCatalogSnapshotDto,
} from "@research-cockpit/contracts";
import { ManagedWorkspace } from "./managed-workspace";
import type { ManagedApi } from "./managed-api";
import { eodSelection } from "./eod-history-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { ManagedPortfolioDraftRecovery } from "./managed-portfolio-draft-recovery";
import {
  formatManagedPortfolioDraftFile,
  parseManagedPortfolioDraftFile,
} from "./managed-portfolio-draft-file";
import { PortfolioLedgerDetails } from "./ManagedPortfolioLedgerDetails";
import type { ManagedPortfolioDraftFileDeliveryAdapter } from "./portfolio-draft-file-delivery";

const scope = `sha256:${"c".repeat(64)}`;
const time = "2026-10-21T10:00:00.000Z";
const identity = eodSelection.listing;
const digest = eodSelection.catalogSnapshotSha256;
const snapshot: ManagedCatalogSnapshotDto = {
  schemaVersion: "1.0.0",
  profile: "personal_single_user_managed_security_master",
  snapshotSha256: digest,
  catalogId: "invented",
  catalogVersion: "one",
  asOf: time,
  acquiredAt: time,
  generatedAt: time,
  contentKind: "synthetic_engineering",
  attribution: "Invented engineering catalog",
  sources: [],
  excludedCandidates: [],
  coverage: {
    activeEligibleSecurities: 1,
    activeListings: 1,
    admittedSourceRecords: 1,
    basis: "synthetic_engineering_only_not_real_universe",
    eligibleSecurityBand: "under_1000",
    formerTickerEntries: 0,
    ineligibleSourceRecords: 0,
    inactiveSecurities: 0,
    issuers: 1,
    providerMappings: 0,
    quarantinedSourceRecords: 0,
    sourceRecords: 1,
    staleSourceRecords: 0,
    shareClasses: 1,
    totalSecurities: 1,
    unsupportedSourceRecords: 0,
  },
};
function ledger(cash = "1000.00"): ManagedPortfolioPayload {
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: digest,
    basisMethod: "fifo_with_opening_pool",
    identities: [identity],
    opening: { asOfDate: "2026-10-01", cashUsd: cash, holdings: [] },
    transactions: [],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const disposals: (() => void)[] = [];
afterEach(() => {
  for (const close of disposals.splice(0).reverse()) close();
});
async function fixture(empty = false) {
  let stored: ManagedPortfolioDto = empty
    ? { version: 0, payload: null }
    : { version: 3, payload: ledger() };
  const unexpected = vi.fn(() =>
    Promise.reject(new Error("Unexpected unrelated request")),
  );
  const api: ManagedApi = {
    load: unexpected,
    save: unexpected,
    loadFollowups: unexpected,
    saveFollowups: unexpected,
    loadValuationAssumptions: unexpected,
    saveValuationAssumptions: unexpected,
    search: unexpected,
    eodHistory: unexpected,
    annualReport: unexpected,
    recentFilings: unexpected,
    monetaryAnnouncements: unexpected,
    blsCalendar: unexpected,
    economicCalendar: unexpected,
    status: vi.fn(() => Promise.resolve({ snapshot })),
    resolve: vi.fn<ManagedApi["resolve"]>((request) =>
      Promise.resolve({
        snapshotSha256: request.snapshotSha256,
        results: request.listingIds.map((listingId) => ({
          listingId,
          listing: identity,
        })),
      }),
    ),
    loadPortfolio: vi.fn(() => Promise.resolve(structuredClone(stored))),
    savePortfolio: vi.fn<ManagedApi["savePortfolio"]>((command) => {
      stored = {
        version: command.expectedVersion + 1,
        payload: command.payload,
      };
      return Promise.resolve({
        version: stored.version,
        payload: command.payload,
        replayed: false,
      });
    }),
  };
  const workspace = new ManagedWorkspace(
    api,
    {
      userId: "invented-file-user",
      sessionId: "invented-file-session",
      getToken: vi.fn(),
      signOut: vi.fn(),
    },
    undefined,
    { researchCoverage: inventedManagedResearchCoverage },
  );
  await workspace.refreshCatalog();
  workspace.setView("portfolio");
  await workspace.portfolio.coordinator.load();
  let active = true;
  const deliver = vi.fn<ManagedPortfolioDraftFileDeliveryAdapter["deliver"]>(
    () => Promise.resolve("written"),
  );
  const recovery = new ManagedPortfolioDraftRecovery({
    workspace,
    accountScope: Promise.resolve(scope),
    delivery: { deliver },
    routeActive: () => active,
    now: () => time,
  });
  await Promise.resolve();
  disposals.push(
    () => workspace.sessionOwner.dispose(),
    () => recovery.dispose(),
  );
  return {
    workspace,
    recovery,
    api,
    deliver,
    unexpected,
    leave: () => {
      active = false;
      recovery.reconcile();
    },
  };
}
function file(value = ledger("750.00"), baseVersion = 1) {
  const document = formatManagedPortfolioDraftFile({
    accountScope: scope,
    capturedAt: time,
    baseVersion,
    draft: value,
  })!;
  const bytes = new TextEncoder().encode(document.text).buffer;
  return {
    size: bytes.byteLength,
    arrayBuffer: vi.fn(() => Promise.resolve(bytes)),
  };
}
it("reviews/cancels locally, restores against the current base, revokes same-identity approval and saves only explicitly", async () => {
  const f = await fixture();
  const model = f.workspace.portfolio;
  await model.reviewCatalog();
  model.applyReview();
  expect(model.canSavePayload()).toBe(true);
  const before = model.coordinator.getSnapshot();
  const reads = vi.mocked(f.api.loadPortfolio).mock.calls.length;
  const resolves = vi.mocked(f.api.resolve).mock.calls.length;
  await f.recovery.readFile(file());
  expect(f.recovery.getSnapshot().phase).toBe("review");
  expect(model.coordinator.getSnapshot().draft).toBe(before.draft);
  f.recovery.cancel();
  expect(model.coordinator.getSnapshot().draft).toBe(before.draft);
  await f.recovery.readFile(file());
  expect(f.recovery.restoreDraft()).toBe(true);
  const restored = model.coordinator.getSnapshot();
  expect(restored.saved).toBe(before.saved);
  expect(restored.baseVersion).toBe(3);
  expect(restored.draft?.ledger?.opening.cashUsd).toBe("750.00");
  expect(restored.dirty).toBe(true);
  expect(model.canSavePayload()).toBe(false);
  expect(f.api.loadPortfolio).toHaveBeenCalledTimes(reads);
  expect(f.api.resolve).toHaveBeenCalledTimes(resolves);
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
  expect(f.unexpected).not.toHaveBeenCalled();
  await model.reviewCatalog();
  model.applyReview();
  expect(model.canSavePayload()).toBe(true);
  await model.coordinator.save();
  expect(f.api.savePortfolio).toHaveBeenCalledOnce();
  expect(vi.mocked(f.api.savePortfolio).mock.calls[0]![0].expectedVersion).toBe(
    3,
  );
});
it("restores into an explicitly loaded, uninitialized portfolio without trusting a file base", async () => {
  const f = await fixture(true);
  await f.recovery.readFile(file(ledger(), 42));
  expect(f.recovery.restoreDraft()).toBe(true);
  expect(f.workspace.portfolio.coordinator.getSnapshot().baseVersion).toBe(0);
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft?.ledger).toEqual(
    ledger(),
  );
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
});
it.each(["draft", "form", "load", "catalog", "route", "retirement"] as const)(
  "withdraws review after %s changes",
  async (change) => {
    const f = await fixture();
    await f.recovery.readFile(file());
    expect(f.recovery.getSnapshot().phase).toBe("review");
    const m = f.workspace.portfolio;
    if (change === "draft")
      m.replace(m.coordinator.getSnapshot().draft!, ledger("800.00"));
    if (change === "form")
      m.setPendingEditor(m.coordinator.getSnapshot().draft!, true);
    if (change === "load") await m.coordinator.load();
    if (change === "catalog") await f.workspace.refreshCatalog();
    if (change === "route") f.leave();
    if (change === "retirement") f.workspace.sessionOwner.dispose();
    expect(f.recovery.getSnapshot().preview).toBeNull();
    expect(f.recovery.restoreDraft()).toBe(false);
    expect(f.api.savePortfolio).not.toHaveBeenCalled();
  },
);
it("fences a cancelled late read and refuses advertised oversize before arrayBuffer", async () => {
  const f = await fixture();
  const bytes = deferred<ArrayBuffer>();
  const selected = file();
  const pending = f.recovery.readFile({
    ...selected,
    arrayBuffer: () => bytes.promise,
  });
  f.recovery.cancel();
  bytes.resolve(await selected.arrayBuffer());
  await pending;
  expect(f.recovery.getSnapshot().preview).toBeNull();
  const arrayBuffer = vi.fn();
  await f.recovery.readFile({ size: 266241, arrayBuffer });
  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(f.recovery.getSnapshot().message).toContain("invalid");
});
it("captures only applied edits, and cancels delivery when the draft changes", async () => {
  const f = await fixture();
  const m = f.workspace.portfolio;
  m.replace(m.coordinator.getSnapshot().draft!, ledger("850.00"));
  m.setPendingEditor(m.coordinator.getSnapshot().draft!, true);
  expect(f.recovery.getSnapshot().canExport).toBe(false);
  m.setPendingEditor(m.coordinator.getSnapshot().draft!, false);
  const done = deferred<"written">();
  let context:
    | Parameters<ManagedPortfolioDraftFileDeliveryAdapter["deliver"]>[1]
    | undefined;
  f.deliver.mockImplementationOnce(async (_doc, ctx) => {
    context = ctx;
    return done.promise;
  });
  const operation = f.recovery.exportDraft();
  expect(f.deliver).toHaveBeenCalledOnce();
  expect(
    parseManagedPortfolioDraftFile(f.deliver.mock.calls[0]![0].text, scope)
      ?.draft.opening.cashUsd,
  ).toBe("850.00");
  m.replace(m.coordinator.getSnapshot().draft!, ledger("840.00"));
  expect(context?.signal.aborted).toBe(true);
  done.resolve("written");
  await operation;
  expect(f.recovery.getSnapshot().message).not.toContain("file saved");
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
});
it("renders every imported balance, identity and activity with original decimal spelling and order", () => {
  const value: ManagedPortfolioPayload = {
    ...ledger(),
    opening: {
      asOfDate: "2026-10-01",
      cashUsd: null,
      holdings: [
        {
          listingId: identity.listingId,
          shares: "2.000000",
          totalCostBasisUsd: null,
          confirmedOn: "2026-10-01",
        },
      ],
    },
    transactions: [
      {
        id: "split-first",
        date: "2026-10-02",
        type: "split",
        listingId: identity.listingId,
        ratioNumerator: "3",
        ratioDenominator: "2",
      },
      {
        id: "sell-second",
        date: "2026-10-02",
        type: "sell",
        listingId: identity.listingId,
        shares: "1.000000",
        grossUsd: "150.00",
        feeUsd: "1.00",
      },
    ],
  };
  const markup = renderToStaticMarkup(
    createElement(PortfolioLedgerDetails, { ledger: value }),
  );
  expect(markup).toContain("Unknown");
  expect(markup).toContain("2.000000 shares");
  expect(markup).toContain("3 for 2");
  expect(markup).toContain("150.00");
  expect(markup).toContain(identity.issuerId);
  expect(markup.indexOf("split-first")).toBeLessThan(
    markup.indexOf("sell-second"),
  );
});

it("withdraws a pending file read on an invalid root route even while Portfolio workspace flags are unchanged", async () => {
  const f = await fixture();
  const before = f.workspace.portfolio.coordinator.getSnapshot().draft;
  const selected = file();
  const bytes = deferred<ArrayBuffer>();
  const pending = f.recovery.readFile({
    ...selected,
    arrayBuffer: () => bytes.promise,
  });
  f.leave();
  expect(f.workspace.getSnapshot()).toMatchObject({
    view: "portfolio",
    research: null,
    companyRoute: null,
  });
  bytes.resolve(await selected.arrayBuffer());
  await pending;
  expect(f.recovery.getSnapshot().preview).toBeNull();
  expect(f.recovery.restoreDraft()).toBe(false);
  expect(f.workspace.portfolio.coordinator.getSnapshot().draft).toBe(before);
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
});
it("rejects restoration if a subscriber changes the draft while file review is clearing", async () => {
  const f = await fixture();
  await f.recovery.readFile(file());
  let changed = false;
  const unsubscribe = f.recovery.subscribe(() => {
    if (!changed && f.recovery.getSnapshot().phase === "idle") {
      changed = true;
      const model = f.workspace.portfolio;
      model.replace(model.coordinator.getSnapshot().draft!, ledger("900.00"));
    }
  });
  expect(f.recovery.restoreDraft()).toBe(false);
  unsubscribe();
  expect(
    f.workspace.portfolio.coordinator.getSnapshot().draft?.ledger?.opening
      .cashUsd,
  ).toBe("900.00");
  expect(f.api.savePortfolio).not.toHaveBeenCalled();
});
