import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
} from "../../src/clerk-trial/native-company-report";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createFixture } from "./fixture";
import { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";
import { companySnapshotEvidence } from "../../src/clerk-trial/managed-company-snapshot";
import {
  companyReportIsCurrent,
  prepareCompanyReport,
} from "../../src/clerk-trial/managed-company-report";
import { PreparedReportDelivery } from "../../src/clerk-trial/prepared-report-delivery";
import { ManagedCompanyReportDelivery } from "../../src/clerk-trial/ManagedCompanyReportDelivery";
import { formatCompanyReportDocument } from "../../src/clerk-trial/managed-company-report-document";
import type { CompanyReportDeliveryAdapter } from "../../src/clerk-trial/company-report-delivery";

async function fixture() {
  const source = await createFixture("company-snapshot");
  const workspace = new ManagedWorkspace(
    source.api,
    source.session,
    undefined,
    { priceCoverage: source.priceCoverage },
  );
  await workspace.coordinator.load();
  await workspace.refreshCatalog();
  workspace.setView("watchlist");
  const note = "Unsaved Café 東京 📈\nExact whitespace  ";
  workspace.note("listing-zero", note);
  workspace.openWatchlistAnnual(
    workspace.coordinator.getSnapshot().draft!.memberships[0]!,
  );
  const selection = workspace.getSnapshot().research!.selection;
  await workspace.annual.load();
  const evidence = () =>
    companySnapshotEvidence(
      selection,
      workspace.eod.getSnapshot(),
      workspace.annual.getSnapshot(),
      workspace.filings.getSnapshot(),
    );
  const report = prepareCompanyReport(
    selection,
    evidence(),
    workspace.getResearchWatchlist(selection),
    () => new Date("2026-10-15T00:00:00.000Z"),
  )!;
  const isCurrent = () =>
    companyReportIsCurrent(
      report,
      selection,
      evidence(),
      workspace.getResearchWatchlist(selection),
    );
  return { source, workspace, selection, report, isCurrent, note, evidence };
}

describe("explicit company report download in the real workspace", () => {
  it("saves through the native destination capability without calling browser transport or Save", async () => {
    const f = await fixture();
    const deliver = vi
      .fn<CompanyReportDeliveryAdapter["deliver"]>()
      .mockResolvedValue("written");
    const delivery: CompanyReportDeliveryAdapter = {
      destination: "system_document",
      deliver,
    };
    const model = new PreparedReportDelivery(f.report, delivery, f.isCurrent);
    const html = renderToStaticMarkup(
      <ManagedCompanyReportDelivery
        report={f.report}
        delivery={delivery}
        isCurrent={f.isCurrent}
      />,
    );
    expect(html).toContain("Save report (JSON)");
    expect(html).not.toContain("Download report (JSON)");
    expect(html).toContain("Choose a destination");
    await model.start();
    expect(deliver).toHaveBeenCalledOnce();
    expect(model.getSnapshot().message).toBe(
      `Saved report ${deliver.mock.calls[0]![0].filename} to the chosen document.`,
    );
    expect(f.source.getSnapshot()).toMatchObject({
      annual: 1,
      save: 0,
      eod: 0,
      filings: 0,
    });
    model.retire();
    f.workspace.coordinator.retire();
  });
  it.each(["note", "retire"])(
    "rechecks actual %s state after the native picker returns before writing",
    async (kind) => {
      const f = await fixture();
      let choose!: (value: { status: "chosen"; handle: string }) => void;
      const plugin: InvestmentCompanyReportPlugin = {
        choose: vi.fn<InvestmentCompanyReportPlugin["choose"]>(
          () =>
            new Promise((resolve) => {
              choose = resolve;
            }),
        ),
        write: vi.fn().mockResolvedValue({ status: "written" }),
        cancel: vi.fn().mockResolvedValue(undefined),
      };
      const model = new PreparedReportDelivery(
        f.report,
        createNativeCompanyReportAdapter(plugin),
        f.isCurrent,
      );
      const pending = model.start();
      if (kind === "note")
        f.workspace.note("listing-zero", "changed while choosing");
      else f.workspace.coordinator.retire();
      choose({
        status: "chosen",
        handle: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      });
      await pending;
      expect(plugin.write).not.toHaveBeenCalled();
      expect(plugin.cancel).toHaveBeenCalledOnce();
      expect(model.getSnapshot()).toEqual({ busy: false, message: "" });
      model.retire();
      f.workspace.coordinator.retire();
    },
  );
  it.each(["cancelled", "reject", "download_requested"] as const)(
    "reports native %s truthfully and refuses a browser outcome from the native capability",
    async (kind) => {
      const f = await fixture();
      const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>();
      if (kind === "reject")
        deliver.mockRejectedValue(new Error("private native exception"));
      else deliver.mockResolvedValue(kind);
      const model = new PreparedReportDelivery(
        f.report,
        { destination: "system_document", deliver },
        f.isCurrent,
      );
      await model.start();
      expect(model.getSnapshot()).toEqual({
        busy: false,
        message:
          kind === "cancelled"
            ? "Report save cancelled."
            : "Report could not be saved. Check the chosen destination before trying again.",
      });
      expect(deliver).toHaveBeenCalledOnce();
      model.retire();
      f.workspace.coordinator.retire();
    },
  );

  it("keeps the native journey's separate original source clocks in the complete document", async () => {
    const f = await fixture();
    f.workspace.switchToEod();
    await f.workspace.eod.load();
    f.workspace.switchToFilings();
    await f.workspace.filings.load();
    const report = prepareCompanyReport(
      f.selection,
      f.evidence(),
      f.workspace.getResearchWatchlist(f.selection),
    )!;
    const document = formatCompanyReportDocument(report)!;
    const parsed = JSON.parse(document.text) as {
      sources: {
        price: { response: { completedAt: unknown } };
        annual: {
          response: {
            evidence: {
              generation: { completedAt: unknown };
              cashGeneration: { resolution: unknown };
              liquidity: { resolution: unknown };
              observations: unknown;
            };
          };
        };
        filings: {
          response: {
            completedAt: unknown;
            issuer: { filings: unknown };
            window: { fromDate: unknown };
          };
        };
      };
    };
    expect(parsed.sources.price.response.completedAt).toBe(
      "2026-09-20T00:00:01.000Z",
    );
    expect(parsed.sources.annual.response.evidence.generation.completedAt).toBe(
      "2026-09-20T00:00:02.000Z",
    );
    expect(parsed.sources.filings.response.completedAt).toBe(
      "2026-09-20T00:00:02.000Z",
    );
    expect(
      parsed.sources.annual.response.evidence.cashGeneration.resolution,
    ).toBeDefined();
    expect(
      parsed.sources.annual.response.evidence.liquidity.resolution,
    ).toBeDefined();
    expect(
      Array.isArray(parsed.sources.annual.response.evidence.observations),
    ).toBe(true);
    expect(Array.isArray(parsed.sources.filings.response.issuer.filings)).toBe(
      true,
    );
    expect(parsed.sources.filings.response.window.fromDate).toBe("2026-06-23");
    expect(f.source.getSnapshot()).toMatchObject({
      annual: 1,
      eod: 1,
      filings: 1,
      save: 0,
    });
    f.workspace.coordinator.retire();
  });
  it("delivers the exact prepared unsaved draft in the initiating task without a source request or Save", async () => {
    const f = await fixture();
    const before = structuredClone(f.workspace.coordinator.getSnapshot().draft);
    const deliver = vi
      .fn<CompanyReportDeliveryAdapter["deliver"]>()
      .mockResolvedValue("download_requested");
    const model = new PreparedReportDelivery(
      f.report,
      { deliver, destination: "browser_download" },
      f.isCurrent,
    );
    const operation = model.start();
    expect(deliver).toHaveBeenCalledOnce();
    expect(deliver.mock.calls[0]![0]).toEqual(
      formatCompanyReportDocument(f.report),
    );
    const document = deliver.mock.calls[0]![0];
    expect(document.text).toContain(JSON.stringify(f.note));
    expect(document.filename).toBe(
      "Investment-research-ZERO-XNAS-20261015T000000000Z.json",
    );
    expect(deliver.mock.calls[0]![1].isCurrent()).toBe(true);
    await operation;
    expect(model.getSnapshot()).toEqual({
      busy: false,
      message: `Download requested for ${document.filename}.`,
    });
    expect(f.workspace.coordinator.getSnapshot().draft).toEqual(before);
    expect(f.source.getSnapshot()).toMatchObject({
      annual: 1,
      eod: 0,
      filings: 0,
      save: 0,
      token: 0,
    });
    model.retire();
    f.workspace.coordinator.retire();
  });

  it.each(["note", "source", "close", "retire"])(
    "checks actual %s state even before React renders again",
    async (kind) => {
      const f = await fixture();
      const deliver = vi
        .fn<CompanyReportDeliveryAdapter["deliver"]>()
        .mockResolvedValue("download_requested");
      const model = new PreparedReportDelivery(
        f.report,
        { deliver, destination: "browser_download" },
        f.isCurrent,
      );
      if (kind === "note")
        f.workspace.note("listing-zero", f.note + " changed");
      if (kind === "source") f.workspace.switchToEod(); // Initializing a new source changes the capture without reading it.
      if (kind === "close") f.workspace.closeResearch();
      if (kind === "retire") f.workspace.coordinator.retire();
      expect(f.isCurrent()).toBe(false);
      await model.start();
      expect(deliver).not.toHaveBeenCalled();
      expect(f.source.getSnapshot()).toMatchObject({
        annual: 1,
        eod: 0,
        filings: 0,
        save: 0,
      });
      model.retire();
      f.workspace.coordinator.retire();
    },
  );

  it("refuses duplicate clicks, aborts mounted ownership and suppresses late completion", async () => {
    const f = await fixture();
    let settle!: (outcome: "download_requested") => void;
    const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const model = new PreparedReportDelivery(
      f.report,
      { deliver, destination: "browser_download" },
      f.isCurrent,
    );
    const listener = vi.fn();
    model.subscribe(listener);
    const pending = model.start();
    await model.start();
    expect(deliver).toHaveBeenCalledOnce();
    expect(model.getSnapshot().busy).toBe(true);
    const context = deliver.mock.calls[0]![1];
    model.retire();
    const calls = listener.mock.calls.length;
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    settle("download_requested");
    await pending;
    await model.start();
    expect(listener).toHaveBeenCalledTimes(calls);
    expect(model.getSnapshot()).toEqual({ busy: false, message: "" });
    expect(deliver).toHaveBeenCalledOnce();
    f.workspace.coordinator.retire();
  });

  it.each(["download_requested", "reject"])(
    "does not report a stale %s result after an intervening edit",
    async (outcome) => {
      const f = await fixture();
      let settle!: () => void;
      const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>(
        () =>
          new Promise((resolve, reject) => {
            settle = () =>
              outcome === "reject"
                ? reject(new Error("private detail"))
                : resolve("download_requested");
          }),
      );
      const model = new PreparedReportDelivery(
        f.report,
        { deliver, destination: "browser_download" },
        f.isCurrent,
      );
      const pending = model.start();
      f.workspace.note("listing-zero", "changed");
      expect(deliver.mock.calls[0]![1].isCurrent()).toBe(false);
      settle();
      await pending;
      expect(model.getSnapshot()).toEqual({ busy: false, message: "" });
      model.retire();
      f.workspace.coordinator.retire();
    },
  );

  it("bounds failures, permits only explicit retry and refuses an oversized complete document", async () => {
    const f = await fixture();
    const deliver = vi
      .fn<CompanyReportDeliveryAdapter["deliver"]>()
      .mockRejectedValue(new Error("private exception"));
    const model = new PreparedReportDelivery(
      f.report,
      { deliver, destination: "browser_download" },
      f.isCurrent,
    );
    await model.start();
    expect(model.getSnapshot()).toEqual({
      busy: false,
      message:
        "Report download could not be requested. Check your downloads before trying again.",
    });
    expect(deliver).toHaveBeenCalledOnce();
    await model.start();
    expect(deliver).toHaveBeenCalledTimes(2);
    model.retire();
    const oversized = new PreparedReportDelivery(
      { ...f.report, note: "x".repeat(17000) },
      { deliver, destination: "browser_download" },
      () => true,
    );
    await oversized.start();
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(oversized.getSnapshot().message).toContain("complete document");
    oversized.retire();
    f.workspace.coordinator.retire();
  });

  it("describes the unsaved-draft destination and waits for mounted ownership before enabling delivery", async () => {
    const f = await fixture();
    const deliver = vi
      .fn<CompanyReportDeliveryAdapter["deliver"]>()
      .mockResolvedValue("download_requested");
    const html = renderToStaticMarkup(
      <ManagedCompanyReportDelivery
        report={f.report}
        delivery={{ deliver, destination: "browser_download" }}
        isCurrent={f.isCurrent}
      />,
    );
    expect(html).toContain("Download report (JSON)");
    expect(html).toContain("including unsaved edits");
    expect(html).toContain("does not update with later edits");
    expect(html).toContain('disabled=""');
    expect(deliver).not.toHaveBeenCalled();
    f.workspace.coordinator.retire();
  });
});
