import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  request,
  response,
} from "../features/research/sec-annual-evidence-fixture";
import { ManagedAnnualReport as Panel } from "./ManagedAnnualReport";
import {
  ManagedAnnualReport,
  type AnnualReportSelection,
} from "./managed-annual-report";
import {
  ManagedAnnualCooldownError,
  ManagedCatalogChangedError,
  type ManagedApi,
} from "./managed-api";
import { TrialApiError } from "./api";

const selection: AnnualReportSelection = {
  catalogSnapshotSha256: request().catalogSnapshotSha256,
  origin: "discover",
  cik: "0000000001",
  listing: {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-zero",
    issuerName: "Zero Company",
    listingId: "listing-zero",
    securityId: "security-zero",
    securityName: "Zero Class A",
    shareClassId: "class-zero",
    shareClassName: "Class A",
    symbol: "ZERO",
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const load = vi.fn<ManagedApi["annualReport"]>();
  const readError = vi.fn();
  const model = new ManagedAnnualReport(load, readError);
  return {
    model,
    load,
    readError,
    html: () =>
      renderToStaticMarkup(
        <Panel model={model} onBack={() => model.close()} />,
      ),
  };
}
afterEach(() => vi.useRealTimers());

describe("managed annual read", () => {
  it("opens without loading, captures its selection and renders the shared report after explicit Load", async () => {
    const { model, load, html } = fixture();
    const input = structuredClone(selection);
    model.open(input);
    expect(load).not.toHaveBeenCalled();
    expect(html()).toContain("Load annual report");
    expect(html()).toContain("Back to workspace");
    Object.assign(input.listing, { symbol: "MUTATED" });
    load.mockResolvedValue(await response());
    await model.load();
    expect(load).toHaveBeenCalledExactlyOnceWith(
      request(),
      expect.any(AbortSignal),
    );
    expect(html()).toContain("Refresh annual report");
    expect(html()).toContain("Inspect selected-report evidence");
  });

  it("coalesces duplicate loads, aborts on Cancel and fences an uncooperative late result", async () => {
    const { model, load, html } = fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    load.mockReturnValue(held.promise);
    model.open(selection);
    const pending = model.load();
    await model.load();
    expect(load).toHaveBeenCalledOnce();
    expect(html()).toContain("Cancel annual report");
    model.cancel();
    expect(load.mock.calls[0]![1].aborted).toBe(true);
    held.resolve(await response());
    await pending;
    expect(model.getSnapshot().response).toBeNull();
    expect(html()).toContain("cancelled");
  });

  it("fences A-to-B-to-A responses and Back discards the report", async () => {
    const { model, load } = fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    load.mockReturnValueOnce(held.promise);
    model.open(selection);
    const pending = model.load();
    model.open({
      ...selection,
      listing: { ...selection.listing, symbol: "OTHER" },
    });
    model.open(selection);
    held.resolve(await response());
    await pending;
    expect(model.getSnapshot().response).toBeNull();
    load.mockResolvedValue(await response());
    await model.load();
    model.close();
    expect(model.getSnapshot().selection).toBeNull();
    expect(model.getSnapshot().response).toBeNull();
  });

  it.each([
    "issuerId",
    "issuerName",
    "securityName",
    "country",
    "exchangeMic",
    "listingId",
    "symbol",
    "cik",
  ] as const)("rejects changed selected identity %s", async (field) => {
    const { model, load } = fixture();
    const wire = await response();
    load.mockResolvedValue({
      ...wire,
      security: { ...wire.security, [field]: "OTHER" },
    });
    model.open(selection);
    await model.load();
    expect(model.getSnapshot().response).toBeNull();
    expect(model.getSnapshot().message).toContain("could not be validated");
  });

  it("keeps shared cooldown across selection changes, and only an explicit later Load retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
    const { model, load } = fixture();
    load.mockRejectedValueOnce(
      new ManagedAnnualCooldownError("2026-10-01T00:00:20.000Z"),
    );
    model.open(selection);
    await model.load();
    expect(model.getSnapshot().message).toContain("2026-10-01T00:00:20.000Z");
    model.close();
    model.open(selection);
    await model.load();
    expect(load).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledOnce();
    load.mockResolvedValue(await response());
    await model.load();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("requires a new selection after catalog_changed", async () => {
    const { model, load, html } = fixture();
    load.mockRejectedValue(new ManagedCatalogChangedError());
    model.open(selection);
    await model.load();
    await model.load();
    expect(load).toHaveBeenCalledOnce();
    expect(html()).toContain("Refresh the catalog");
    expect(html()).toMatch(
      /<button[^>]*disabled=""[^>]*>Load annual report<\/button>/u,
    );
  });

  it.each(["unauthenticated", "access_denied"] as const)(
    "retires synchronously for %s",
    async (code) => {
      const { model, load, readError } = fixture();
      load.mockRejectedValue(new TrialApiError(code));
      model.open(selection);
      await model.load();
      expect(readError).toHaveBeenCalledExactlyOnceWith(
        new TrialApiError(code),
      );
      expect(model.getSnapshot().selection).toBeNull();
      model.open(selection);
      await model.load();
      expect(load).toHaveBeenCalledOnce();
    },
  );

  it("retirement clears immediately and a late auth failure does not retire another session", async () => {
    const { model, load, readError } = fixture();
    const held = deferred<Awaited<ReturnType<ManagedApi["annualReport"]>>>();
    load.mockReturnValue(held.promise);
    model.open(selection);
    const pending = model.load();
    model.retire();
    expect(load.mock.calls[0]![1].aborted).toBe(true);
    expect(model.getSnapshot().selection).toBeNull();
    held.reject(new TrialApiError("unauthenticated"));
    await pending;
    expect(readError).not.toHaveBeenCalled();
  });
});
