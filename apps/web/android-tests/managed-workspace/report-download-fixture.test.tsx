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
import type { CompanyReportHtmlDocument } from "../../src/clerk-trial/managed-company-report-html";

type HtmlCapability = NonNullable<
  Extract<
    CompanyReportDeliveryAdapter,
    {
      destination: "browser_download";
    }
  >["html"]
>;

// Controller seam only; actual detached HTML rendering/ownership is browser QA.
function htmlCapability() {
  const document: CompanyReportHtmlDocument = Object.freeze({
    purpose: "investment.company-research-html",
    filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.html",
    text: "<!doctype html><html><body>Invented controller fixture</body></html>",
    byteLength: new TextEncoder().encode(
      "<!doctype html><html><body>Invented controller fixture</body></html>",
    ).byteLength,
  });
  return {
    document,
    format: vi.fn<HtmlCapability["format"]>(() => document),
    deliver: vi
      .fn<HtmlCapability["deliver"]>()
      .mockResolvedValue("download_requested"),
  };
}

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
    expect(html).not.toContain("Download report (HTML)");
    expect(html).toContain("Choose a destination");
    await model.start("json");
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
      const pending = model.start("json");
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
      await model.start("json");
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
          financials: {
            cashGeneration: { resolution: unknown };
            liquidity: { resolution: unknown };
          };
          response: {
            evidence: {
              generation: { completedAt: unknown };
              facts: { observations: unknown };
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
      parsed.sources.annual.financials.cashGeneration.resolution,
    ).toBeDefined();
    expect(parsed.sources.annual.financials.liquidity.resolution).toBeDefined();
    expect(
      Array.isArray(parsed.sources.annual.response.evidence.facts.observations),
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
    const operation = model.start("json");
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
      await model.start("json");
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
    const pending = model.start("json");
    await model.start("json");
    expect(deliver).toHaveBeenCalledOnce();
    expect(model.getSnapshot().busy).toBe(true);
    const context = deliver.mock.calls[0]![1];
    model.retire();
    const calls = listener.mock.calls.length;
    expect(context.signal.aborted).toBe(true);
    expect(context.isCurrent()).toBe(false);
    settle("download_requested");
    await pending;
    await model.start("json");
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
      const pending = model.start("json");
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
    await model.start("json");
    expect(model.getSnapshot()).toEqual({
      busy: false,
      message:
        "Report download could not be requested. Check your downloads before trying again.",
    });
    expect(deliver).toHaveBeenCalledOnce();
    await model.start("json");
    expect(deliver).toHaveBeenCalledTimes(2);
    model.retire();
    const oversized = new PreparedReportDelivery(
      { ...f.report, note: "x".repeat(17000) },
      { deliver, destination: "browser_download" },
      () => true,
    );
    await oversized.start("json");
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

describe("shared JSON and HTML report ownership", () => {
  it("formats and requests HTML synchronously from the captured report without changing either draft or requesting sources", async () => {
    const f = await fixture();
    const drafts = [
      f.workspace.coordinator.getSnapshot(),
      f.workspace.followups.coordinator.getSnapshot(),
    ];
    const calls = f.source.getSnapshot();
    const html = htmlCapability();
    const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>();
    const model = new PreparedReportDelivery(
      f.report,
      { destination: "browser_download", deliver, html },
      f.isCurrent,
    );
    const pending = model.start("html");
    expect(html.format).toHaveBeenCalledExactlyOnceWith(f.report);
    expect(html.deliver).toHaveBeenCalledOnce();
    expect(html.deliver.mock.calls[0]![0]).toBe(html.document);
    expect(html.deliver.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    expect(html.deliver.mock.calls[0]![1].isCurrent()).toBe(true);
    expect(deliver).not.toHaveBeenCalled();
    expect(model.getSnapshot().busy).toBe(true);
    await pending;
    expect(model.getSnapshot()).toEqual({
      busy: false,
      message: `Download requested for ${html.document.filename}.`,
    });
    expect([
      f.workspace.coordinator.getSnapshot(),
      f.workspace.followups.coordinator.getSnapshot(),
    ]).toEqual(drafts);
    expect(f.source.getSnapshot()).toEqual(calls);
    model.retire();
    f.workspace.coordinator.retire();
  });

  it.each(["json", "html"] as const)(
    "shares one pending lock when %s starts first",
    async (first) => {
      const f = await fixture();
      const html = htmlCapability();
      let settle!: (result: "download_requested") => void;
      const pendingResult = new Promise<"download_requested">((resolve) => {
        settle = resolve;
      });
      const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>(
        () => pendingResult,
      );
      html.deliver.mockImplementation(() => pendingResult);
      const model = new PreparedReportDelivery(
        f.report,
        { destination: "browser_download", deliver, html },
        f.isCurrent,
      );
      const pending = model.start(first);
      await model.start(first === "json" ? "html" : "json");
      await model.start(first);
      expect(model.getSnapshot()).toEqual({ busy: true, message: "" });
      expect(deliver).toHaveBeenCalledTimes(first === "json" ? 1 : 0);
      expect(html.format).toHaveBeenCalledTimes(first === "html" ? 1 : 0);
      expect(html.deliver).toHaveBeenCalledTimes(first === "html" ? 1 : 0);
      settle("download_requested");
      await pending;
      expect(model.getSnapshot().busy).toBe(false);
      model.retire();
      f.workspace.coordinator.retire();
    },
  );

  it("allocates the lock before a formatter or pending subscriber can reenter either format", async () => {
    const f = await fixture();
    const html = htmlCapability();
    const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>();
    const model = new PreparedReportDelivery(
      f.report,
      { destination: "browser_download", deliver, html },
      f.isCurrent,
    );
    const nested: Promise<void>[] = [];
    model.subscribe(() => {
      if (model.getSnapshot().busy)
        nested.push(model.start("json"), model.start("html"));
    });
    html.format.mockImplementation(() => {
      expect(model.getSnapshot().busy).toBe(true);
      nested.push(model.start("json"), model.start("html"));
      return html.document;
    });
    await model.start("html");
    await Promise.all(nested);
    expect(html.format).toHaveBeenCalledOnce();
    expect(html.deliver).toHaveBeenCalledOnce();
    expect(deliver).not.toHaveBeenCalled();
    model.retire();
    f.workspace.coordinator.retire();
  });

  it.each(["note", "source", "close", "session", "owner"] as const)(
    "fences actual %s invalidation during HTML formatting before activation",
    async (kind) => {
      const f = await fixture();
      const html = htmlCapability();
      const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>();
      const model = new PreparedReportDelivery(
        f.report,
        { destination: "browser_download", deliver, html },
        f.isCurrent,
      );
      html.format.mockImplementation(() => {
        if (kind === "note")
          f.workspace.note("listing-zero", "changed while rendering");
        if (kind === "source") f.workspace.switchToEod();
        if (kind === "close") f.workspace.closeResearch();
        if (kind === "session") f.workspace.coordinator.retire();
        if (kind === "owner") model.retire();
        return html.document;
      });
      await model.start("html");
      expect(html.format).toHaveBeenCalledOnce();
      expect(html.deliver).not.toHaveBeenCalled();
      expect(deliver).not.toHaveBeenCalled();
      expect(model.getSnapshot()).toEqual({ busy: false, message: "" });
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

  it("rechecks a synchronous pending subscriber before starting the HTML formatter", async () => {
    const f = await fixture();
    const html = htmlCapability();
    const model = new PreparedReportDelivery(
      f.report,
      { destination: "browser_download", deliver: vi.fn(), html },
      f.isCurrent,
    );
    model.subscribe(() => {
      if (model.getSnapshot().busy)
        f.workspace.note("listing-zero", "changed on pending publication");
    });
    await model.start("html");
    expect(html.format).not.toHaveBeenCalled();
    expect(html.deliver).not.toHaveBeenCalled();
    expect(model.getSnapshot()).toEqual({ busy: false, message: "" });
    model.retire();
    f.workspace.coordinator.retire();
  });

  it.each(["refusal", "throw"] as const)(
    "clears the shared lock on HTML %s while leaving JSON available for an explicit action",
    async (kind) => {
      const f = await fixture();
      const html = htmlCapability();
      html.format.mockImplementation(() => {
        if (kind === "throw") throw new Error("private formatting detail");
        return null;
      });
      const deliver = vi
        .fn<CompanyReportDeliveryAdapter["deliver"]>()
        .mockResolvedValue("download_requested");
      const model = new PreparedReportDelivery(
        f.report,
        { destination: "browser_download", deliver, html },
        f.isCurrent,
      );
      await model.start("html");
      expect(model.getSnapshot()).toEqual({
        busy: false,
        message:
          kind === "refusal"
            ? "Report file unavailable: the complete document cannot be prepared within its limits."
            : "Report download could not be requested. Check your downloads before trying again.",
      });
      expect(html.deliver).not.toHaveBeenCalled();
      expect(deliver).not.toHaveBeenCalled();
      await model.start("json");
      expect(deliver).toHaveBeenCalledExactlyOnceWith(
        formatCompanyReportDocument(f.report),
        expect.any(Object),
      );
      expect(html.format).toHaveBeenCalledOnce();
      model.retire();
      f.workspace.coordinator.retire();
    },
  );

  it.each(["cancelled", "failure", "native outcome"] as const)(
    "reports HTML %s without claiming a saved file",
    async (kind) => {
      const f = await fixture();
      const html = htmlCapability();
      if (kind === "failure")
        html.deliver.mockRejectedValue(new Error("private transport detail"));
      else
        html.deliver.mockResolvedValue(
          kind === "cancelled"
            ? "cancelled"
            : ("written" as "download_requested"),
        );
      const model = new PreparedReportDelivery(
        f.report,
        { destination: "browser_download", deliver: vi.fn(), html },
        f.isCurrent,
      );
      await model.start("html");
      expect(model.getSnapshot()).toEqual({
        busy: false,
        message:
          kind === "cancelled"
            ? "Report download cancelled."
            : "Report download could not be requested. Check your downloads before trying again.",
      });
      model.retire();
      f.workspace.coordinator.retire();
    },
  );

  it.each(["success", "failure"] as const)(
    "aborts HTML ownership and suppresses late %s",
    async (kind) => {
      const f = await fixture();
      const html = htmlCapability();
      let settle!: () => void;
      html.deliver.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            settle = () =>
              kind === "success"
                ? resolve("download_requested")
                : reject(new Error("private detail"));
          }),
      );
      const model = new PreparedReportDelivery(
        f.report,
        { destination: "browser_download", deliver: vi.fn(), html },
        f.isCurrent,
      );
      const listener = vi.fn();
      model.subscribe(listener);
      const pending = model.start("html");
      const context = html.deliver.mock.calls[0]![1];
      model.retire();
      const count = listener.mock.calls.length;
      expect(context.signal.aborted).toBe(true);
      expect(context.isCurrent()).toBe(false);
      settle();
      await pending;
      expect(model.getSnapshot()).toEqual({ busy: false, message: "" });
      expect(listener).toHaveBeenCalledTimes(count);
      f.workspace.coordinator.retire();
    },
  );

  it("refuses unknown, unsupported, stale and native HTML before any formatter or transport", async () => {
    const f = await fixture();
    const html = htmlCapability();
    const deliver = vi.fn<CompanyReportDeliveryAdapter["deliver"]>();
    const browser = new PreparedReportDelivery(
      f.report,
      { destination: "browser_download", deliver, html },
      f.isCurrent,
    );
    for (const format of [undefined, null, "xml", "HTML", ""])
      await browser.start(format as "json");
    const unsupported = new PreparedReportDelivery(
      f.report,
      { destination: "browser_download", deliver },
      f.isCurrent,
    );
    await unsupported.start("html");
    // Runtime refusal also ignores a forged extra HTML property on native adapters.
    const native = new PreparedReportDelivery(
      f.report,
      {
        destination: "system_document",
        deliver,
        html,
      } as CompanyReportDeliveryAdapter,
      f.isCurrent,
    );
    await native.start("html");
    f.workspace.note("listing-zero", "changed before formatting");
    await browser.start("html");
    expect(html.format).not.toHaveBeenCalled();
    expect(html.deliver).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
    for (const model of [browser, unsupported, native]) {
      expect(model.getSnapshot()).toEqual({ busy: false, message: "" });
      model.retire();
    }
    f.workspace.coordinator.retire();
  });

  it("renders both browser actions disabled until mounted ownership and omits unsupported HTML", async () => {
    const f = await fixture();
    const html = htmlCapability();
    const markup = renderToStaticMarkup(
      <ManagedCompanyReportDelivery
        report={f.report}
        delivery={{ destination: "browser_download", deliver: vi.fn(), html }}
        isCurrent={f.isCurrent}
      />,
    );
    expect(markup).toContain("Download report (HTML)");
    expect(markup).toContain("Download report (JSON)");
    expect(markup.match(/disabled=""/gu)).toHaveLength(2);
    expect(html.format).not.toHaveBeenCalled();
    expect(html.deliver).not.toHaveBeenCalled();
    const unsupported = renderToStaticMarkup(
      <ManagedCompanyReportDelivery
        report={f.report}
        delivery={{ destination: "browser_download", deliver: vi.fn() }}
        isCurrent={f.isCurrent}
      />,
    );
    expect(unsupported).not.toContain("Download report (HTML)");
    f.workspace.coordinator.retire();
  });
});
