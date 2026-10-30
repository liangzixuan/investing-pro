import { describe, expect, it, vi } from "vitest";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { eodResponse, eodSelection } from "./eod-history-fixture";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import {
  prepareCompanyReport,
  companyReportIsCurrent,
} from "./managed-company-report";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  formatCompanyReportDocument,
} from "./managed-company-report-document";
import { CompanyReportRevisit } from "./company-report-revisit";
import type { ResearchWatchlistState } from "./managed-workspace";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const now = () => new Date("2026-10-23T16:00:00.000Z");
async function fixture() {
  const readPrice = vi.fn().mockResolvedValue(eodResponse());
  const readOther = vi.fn();
  const price = new ManagedEodHistory(readPrice, vi.fn(), undefined, [
    eodSelection.listing,
  ]);
  const annual = new ManagedAnnualReport(readOther, vi.fn());
  const filings = new ManagedCompanyFilings(readOther, vi.fn());
  for (const model of [price, annual, filings]) model.open(eodSelection);
  await price.load();
  let note = "Current café 東京 thesis";
  let revision = Symbol();
  let active = true;
  let onAppend: (() => void) | undefined;
  const watchlist = (): ResearchWatchlistState => ({
    revision,
    member: { ...eodSelection.listing, note },
    canEdit: true,
    canAdd: false,
    reason: null,
  });
  const evidence = () =>
    companySnapshotEvidence(
      eodSelection,
      price.getSnapshot(),
      annual.getSnapshot(),
      filings.getSnapshot(),
      null,
    );
  const report = () =>
    prepareCompanyReport(eodSelection, evidence(), watchlist(), now)!;
  const exported = formatCompanyReportDocument({
    ...report(),
    preparedAt: "2026-10-20T12:00:00.000Z",
    note: "Earlier complete assessment",
  })!;
  const bytes = new TextEncoder().encode(exported.text).buffer;
  const file = (value = bytes) => ({
    size: value.byteLength,
    arrayBuffer: vi.fn().mockResolvedValue(value),
  });
  const append = vi.fn((next: string, expected: string) => {
    if (note !== expected) return false;
    note = next;
    revision = Symbol();
    onAppend?.();
    return true;
  });
  const controller = new CompanyReportRevisit({
    selection: eodSelection,
    active: () => active,
    now,
    capture: () => {
      const current = report();
      return {
        report: current,
        reason: null,
        isCurrent: () =>
          active &&
          companyReportIsCurrent(
            current,
            eodSelection,
            evidence(),
            watchlist(),
          ),
        append,
      };
    },
  });
  const preview = async () => {
    await controller.readFile(file());
    expect(controller.getSnapshot().archive).not.toBeNull();
    controller.captureCurrent();
    controller.setAssessment("The new filing still needs my review.");
    controller.prepareNote();
    expect(controller.getSnapshot().preview).not.toBeNull();
  };
  return {
    controller,
    price,
    readPrice,
    readOther,
    append,
    bytes,
    file,
    preview,
    note: () => note,
    changeDraft: () => {
      revision = Symbol();
    },
    setActive: (value: boolean) => {
      active = value;
    },
    onAppend: (callback: () => void) => {
      onAppend = callback;
    },
  };
}

describe("private report revisit read and whole-note lifecycle", () => {
  it("reads without source requests, captures explicitly, previews the whole note and consumes append before notification", async () => {
    const f = await fixture();
    await f.preview();
    const state = f.controller.getSnapshot();
    expect(state.archive?.note).toBe("Earlier complete assessment");
    expect(state.current?.note).toBe("Current café 東京 thesis");
    const candidate = state.preview!.note;
    expect(candidate).toContain("Current café 東京 thesis");
    expect(candidate).toContain("2026-10-20T12:00:00.000Z");
    expect(candidate).toContain("The new filing still needs my review.");
    f.onAppend(() => {
      expect(f.controller.getSnapshot().preview).toBeNull();
      expect(f.controller.append()).toBe(false);
    });
    expect(f.controller.append()).toBe(true);
    expect(f.note()).toBe(candidate);
    expect(f.controller.append()).toBe(false);
    expect(f.append).toHaveBeenCalledOnce();
    expect(f.readPrice).toHaveBeenCalledOnce();
    expect(f.readOther).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().message).toContain(
      "Save My Watchlist separately",
    );
  });
  it.each(["draft", "source"] as const)(
    "refuses a %s replacement even when content is equal",
    async (kind) => {
      const f = await fixture();
      await f.preview();
      if (kind === "draft") f.changeDraft();
      else await f.price.load();
      expect(f.controller.append()).toBe(false);
      expect(f.append).not.toHaveBeenCalled();
      expect(f.note()).toBe("Current café 東京 thesis");
      expect(f.controller.getSnapshot().preview).toBeNull();
      expect(f.controller.getSnapshot().archive?.note).toBe(
        "Earlier complete assessment",
      );
      f.controller.captureCurrent();
      expect(f.controller.getSnapshot().current).not.toBeNull();
    },
  );
  it("clears an old preview on assessment edits and refuses the complete oversized proposal", async () => {
    const f = await fixture();
    await f.preview();
    f.controller.setAssessment("x".repeat(2_000));
    expect(f.controller.getSnapshot().preview).toBeNull();
    f.controller.prepareNote();
    expect(f.controller.getSnapshot().preview).toBeNull();
    expect(f.controller.getSnapshot().message).toContain("Nothing was clipped");
    expect(f.controller.append()).toBe(false);
    expect(f.append).not.toHaveBeenCalled();
  });
  it("checks advertised bytes before reading and refuses false actual bytes", async () => {
    const f = await fixture();
    for (const size of [0, -1, COMPANY_REPORT_DOCUMENT_MAX_BYTES + 1, 1.5]) {
      const file = { size, arrayBuffer: vi.fn() };
      await f.controller.readFile(file);
      expect(file.arrayBuffer).not.toHaveBeenCalled();
      expect(f.controller.getSnapshot().archive).toBeNull();
    }
    await f.controller.readFile({ ...f.file(), size: f.bytes.byteLength - 1 });
    expect(f.controller.getSnapshot().archive).toBeNull();
  });
  it.each(["clear", "dispose", "draft", "source"] as const)(
    "fences late file completion after %s",
    async (action) => {
      const f = await fixture();
      const pending = deferred<ArrayBuffer>();
      const reading = f.controller.readFile({
        size: f.bytes.byteLength,
        arrayBuffer: () => pending.promise,
      });
      if (action === "clear") f.controller.clear();
      if (action === "dispose") f.controller.dispose();
      if (action === "draft") f.changeDraft();
      if (action === "source") await f.price.load();
      pending.resolve(f.bytes);
      await reading;
      expect(f.controller.getSnapshot().archive).toBeNull();
      expect(f.controller.getSnapshot().current).toBeNull();
      expect(f.append).not.toHaveBeenCalled();
    },
  );
  it("retains a newer selected report after an older read completes", async () => {
    const f = await fixture();
    const pending = deferred<ArrayBuffer>();
    const old = f.controller.readFile({
      size: f.bytes.byteLength,
      arrayBuffer: () => pending.promise,
    });
    await f.controller.readFile(f.file());
    const accepted = f.controller.getSnapshot();
    pending.resolve(new Uint8Array([0]).buffer);
    await old;
    expect(f.controller.getSnapshot()).toBe(accepted);
  });
  it("makes repeated inactive reconciliation and clear idempotent", async () => {
    const f = await fixture();
    await f.preview();
    const changed = vi.fn();
    f.controller.subscribe(changed);
    f.setActive(false);
    f.controller.reconcile();
    const cleared = f.controller.getSnapshot();
    expect(changed).toHaveBeenCalledOnce();
    for (let index = 0; index < 10; index++) {
      f.controller.reconcile();
      f.controller.clear();
    }
    expect(changed).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot()).toBe(cleared);
    expect(cleared.archive).toBeNull();
  });
  it.each(["reset", "reading"] as const)(
    "does not start file reading after a subscriber clears at %s",
    async (phase) => {
      const f = await fixture();
      let once = true;
      f.controller.subscribe(() => {
        const state = f.controller.getSnapshot();
        if (
          once &&
          (phase === "reset"
            ? state.phase === "idle"
            : state.phase === "reading")
        ) {
          once = false;
          f.controller.clear();
        }
      });
      const selected = f.file();
      await f.controller.readFile(selected);
      expect(selected.arrayBuffer).not.toHaveBeenCalled();
      expect(f.controller.getSnapshot().phase).toBe("idle");
    },
  );
  it.each(["reset", "reading"] as const)(
    "does not read after synchronous disposal at %s",
    async (phase) => {
      const f = await fixture();
      let once = true;
      f.controller.subscribe(() => {
        const state = f.controller.getSnapshot();
        if (
          once &&
          (phase === "reset"
            ? state.phase === "idle"
            : state.phase === "reading")
        ) {
          once = false;
          f.controller.dispose();
        }
      });
      const selected = f.file();
      await f.controller.readFile(selected);
      expect(selected.arrayBuffer).not.toHaveBeenCalled();
      expect(f.controller.getSnapshot().phase).toBe("retired");
    },
  );
  it("does not supersede a newer reentrant file selection during reset notification", async () => {
    const f = await fixture();
    let once = true;
    const newer = f.file();
    let pending: Promise<void> | undefined;
    f.controller.subscribe(() => {
      if (once) {
        once = false;
        pending = f.controller.readFile(newer);
      }
    });
    const original = f.file();
    await f.controller.readFile(original);
    await pending;
    expect(original.arrayBuffer).not.toHaveBeenCalled();
    expect(newer.arrayBuffer).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot().archive?.note).toBe(
      "Earlier complete assessment",
    );
  });
  it("preserves a synchronous clear during append without an old status", async () => {
    const f = await fixture();
    await f.preview();
    f.onAppend(() => f.controller.clear());
    expect(f.controller.append()).toBe(true);
    expect(f.controller.getSnapshot().archive).toBeNull();
    expect(f.controller.getSnapshot().message).toBe("");
  });
});

describe("read-only comparison capture", () => {
  it("captures exact references without mutating state, time, sources or draft", async () => {
    const f = await fixture();
    expect(f.controller.captureComparison()).toBeNull();
    await f.controller.readFile(f.file());
    expect(f.controller.captureComparison()).toBeNull();
    f.controller.captureCurrent();
    f.controller.setAssessment("  Raw authored comparison 📈  ");
    const state = f.controller.getSnapshot();
    const capture = f.controller.captureComparison()!;
    expect(capture.archive).toBe(state.archive);
    expect(capture.current).toBe(state.current);
    expect(capture.assessment).toBe(state.assessment);
    expect(capture.isCurrent()).toBe(true);
    expect(Object.isFrozen(capture)).toBe(true);
    expect(f.controller.getSnapshot()).toBe(state);
    expect(f.append).not.toHaveBeenCalled();
    expect(f.readPrice).toHaveBeenCalledOnce();
    expect(f.readOther).not.toHaveBeenCalled();
  });
  it.each([
    "assessment",
    "capture",
    "clear",
    "dispose",
    "draft",
    "source",
    "active",
    "note",
  ] as const)(
    "permanently retires captured comparison after %s",
    async (kind) => {
      const f = await fixture();
      await f.preview();
      const capture = f.controller.captureComparison()!;
      if (kind === "assessment") {
        f.controller.setAssessment("Changed");
        f.controller.setAssessment(capture.assessment);
      } else if (kind === "capture") f.controller.captureCurrent();
      else if (kind === "clear") f.controller.clear();
      else if (kind === "dispose") f.controller.dispose();
      else if (kind === "draft") f.changeDraft();
      else if (kind === "source") await f.price.load();
      else if (kind === "note") f.controller.prepareNote();
      else f.setActive(false);
      expect(capture.isCurrent()).toBe(false);
      f.setActive(true);
      expect(capture.isCurrent()).toBe(false);
      expect(f.append).not.toHaveBeenCalled();
    },
  );
  it("rejects reentrant mutation during current-owner validation", async () => {
    const f = await fixture();
    await f.preview();
    const captured = f.controller.captureComparison()!;
    let mutate = false;
    const controller = new CompanyReportRevisit({
      selection: eodSelection,
      now,
      active: () => {
        if (mutate) {
          mutate = false;
          controller.setAssessment("Changed during capture");
        }
        return true;
      },
      capture: () => ({
        report: captured.current,
        reason: null,
        isCurrent: () => true,
        append: f.append,
      }),
    });
    await controller.readFile(f.file());
    controller.captureCurrent();
    mutate = true;
    expect(controller.captureComparison()).toBeNull();
    expect(f.append).not.toHaveBeenCalled();
  });
});
