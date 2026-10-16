import { describe, expect, it, vi } from "vitest";
import { normalizeWatchlistNote } from "@research-cockpit/contracts";
import type { AuthoredValuationScenario } from "@research-cockpit/personal-market-analytics";
import {
  ManagedValuationWorkbench,
  type DcfField,
  type ExitField,
} from "./managed-valuation-workbench";
import {
  appendValuationNote,
  isValuationNoteCurrent,
  prepareValuationNote,
  type ValuationNoteCapture,
  type PreparedValuationNote,
} from "./valuation-note";
import type { ManagedResearchSelection } from "./managed-research-selection";

const selection: ManagedResearchSelection = {
  catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
  listing: {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-example",
    issuerName: "Example issuer",
    listingId: "listing-example",
    securityId: "security-example",
    securityName: "Example common",
    shareClassId: "class-example",
    shareClassName: "Example class",
    symbol: "EXAMPLE",
  },
  cik: "0000000001",
  origin: "watchlist",
};
function fixture() {
  const workbench = new ManagedValuationWorkbench();
  workbench.activate(selection);
  for (const [field, value] of Object.entries({
    startingUnleveredCashFlowUsd: "100.125",
    enterpriseToEquityBridgeUsd: "-20.25",
    dilutedShares: "10",
    waccPercent: "10",
    terminalGrowthPercent: "2",
  }))
    workbench.setDcfField(field as DcfField, value);
  for (const [field, value] of Object.entries({
    baseRevenue: "1000.125",
    cash: "20.25",
    debt: "10.125",
    dilutedShares: "10",
    discountRatePercent: "10",
  }))
    workbench.setExitField(field as ExitField, value);
  for (const scenario of ["conservative", "base", "expansion"] as const) {
    workbench.setDcfScenario(scenario, "5.125");
    workbench.setExitScenario(scenario, "annualRevenueGrowthPercent", "5.125");
    workbench.setExitScenario(scenario, "targetEbitdaMarginPercent", "20.25");
    workbench.setExitScenario(scenario, "exitMultiple", "10.25");
  }
  const capture = workbench.calculate()!;
  const apply = vi.fn();
  const options: ValuationNoteCapture = {
    capture,
    model: "dcf",
    scenario: "base",
    note: "  Cafe\u0301 😀 thesis  ",
    isCurrent: () => true,
    apply,
  };
  return { workbench, capture, apply, options };
}

describe("valuation note preview capability", () => {
  it.each(["dcf", "exit"] as const)(
    "includes exact selected %s assumptions, results, units, methodology and version; preserves original note bytes",
    (model) => {
      const { options, capture, apply } = fixture();
      const result = prepareValuationNote({ ...options, model });
      expect(result.reason).toBeNull();
      const preview = result.preview!;
      expect(preview.note).toBe(`${options.note} ${preview.excerpt}`);
      expect(preview.excerpt).toContain(
        "EXAMPLE (XNAS), listing listing-example",
      );
      expect(preview.excerpt).toContain(selection.catalogSnapshotSha256);
      expect(preview.excerpt).toContain("base scenario");
      expect(preview.excerpt).toContain(
        "not reported financial facts or current prices",
      );
      expect(preview.excerpt).toContain("All money is USD");
      expect(preview.excerpt).toContain("5.125%");
      expect(preview.excerpt).toContain("half-up");
      if (model === "dcf" && capture.dcfResult.status === "available") {
        expect(preview.excerpt).toContain(
          "starting unlevered cash flow 100.125",
        );
        expect(preview.excerpt).toContain(
          "signed enterprise-to-equity bridge -20.25",
        );
        expect(preview.excerpt).toContain(capture.dcfResult.modelVersion);
        expect(preview.excerpt).toContain(
          capture.dcfResult.scenarios.base.equityValueUsd,
        );
        expect(preview.excerpt).toContain(
          capture.dcfResult.scenarios.base.terminalValueUsd,
        );
      }
      if (model === "exit" && capture.exitResult.status === "available") {
        expect(preview.excerpt).toContain(
          "base revenue 1000.125; cash 20.25; debt 10.125",
        );
        expect(preview.excerpt).toContain(
          "target EBITDA margin 20.25%; exit multiple 10.25x",
        );
        expect(preview.excerpt).toContain(capture.exitResult.modelVersion);
        expect(preview.excerpt).toContain(
          capture.exitResult.scenarios.base.yearNRevenue,
        );
        expect(preview.excerpt).toContain("Interim cash flows excluded");
      }
      expect([...preview.note].length).toBeLessThanOrEqual(2000);
      expect(preview.note).not.toMatch(/[\r\n]/u);
      expect(apply).not.toHaveBeenCalled();
      expect(Object.isFrozen(preview)).toBe(true);
      expect(appendValuationNote(preview).appended).toBe(true);
      expect(apply).toHaveBeenCalledExactlyOnceWith(preview.note);
      expect(isValuationNoteCurrent(preview)).toBe(false);
      expect(appendValuationNote(preview).appended).toBe(false);
    },
  );

  it("validates the entire raw note at exactly 2000 code points, with no truncation or rewriting", () => {
    const { options } = fixture();
    const excerpt = prepareValuationNote({ ...options, note: "" }).preview!
      .excerpt;
    const prefix = `Cafe\u0301 ${"😀".repeat(2000 - [...excerpt].length - 7)}`;
    const exact = prepareValuationNote({ ...options, note: prefix });
    expect(exact.reason).toBeNull();
    expect([...exact.preview!.note]).toHaveLength(2000);
    expect(exact.preview!.note).toBe(`${prefix} ${excerpt}`);
    expect(
      prepareValuationNote({ ...options, note: `${prefix}😀` }).preview,
    ).toBeNull();
    expect(
      prepareValuationNote({ ...options, note: "x".repeat(2000) }).preview,
    ).toBeNull();
  });

  it.each([
    "draft\n",
    "draft\rnext",
    "draft\u0000next",
    "draft\u200bnext",
    "draft\ud800",
  ])("refuses forbidden whole-note content %j", (note) => {
    const { options, apply } = fixture();
    const result = prepareValuationNote({ ...options, note });
    expect(result.preview).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses an already appended complete suffix and preserves all authored outcomes", () => {
    const { options, capture } = fixture();
    const before = JSON.stringify(capture);
    const preview = prepareValuationNote(options).preview!;
    const result = prepareValuationNote({ ...options, note: preview.note });
    expect(result.preview).toBeNull();
    expect(result.reason).toContain("already at the end");
    expect(JSON.stringify(capture)).toBe(before);
    expect(normalizeWatchlistNote(preview.note)).not.toBeNull();
  });

  it.each([
    "edit",
    "recalculate",
    "Back",
    "other company",
    "catalog",
    "retire",
  ])("permanently stales a preview on %s", (event) => {
    const { options, workbench, apply } = fixture();
    const preview = prepareValuationNote(options).preview!;
    if (event === "edit") workbench.setDcfField("waccPercent", "11");
    if (event === "recalculate") workbench.calculate();
    if (event === "Back") workbench.activate(null);
    if (event === "other company")
      workbench.activate({
        ...selection,
        listing: { ...selection.listing, listingId: "other" },
      });
    if (event === "catalog")
      workbench.activate({
        ...selection,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      });
    if (event === "retire") workbench.retire();
    expect(isValuationNoteCurrent(preview)).toBe(false);
    workbench.activate(selection);
    expect(appendValuationNote(preview).appended).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });

  it("checks external note/model/visit/session guards at prepare and append, with permanent refusal", () => {
    const { options, apply } = fixture();
    let current = false;
    const guarded = { ...options, isCurrent: () => current };
    expect(prepareValuationNote(guarded).preview).toBeNull();
    current = true;
    const preview = prepareValuationNote(guarded).preview!;
    current = false;
    expect(isValuationNoteCurrent(preview)).toBe(false);
    current = true;
    expect(appendValuationNote(preview).appended).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(
      prepareValuationNote({
        ...options,
        isCurrent: () => {
          throw new Error("retired");
        },
      }).preview,
    ).toBeNull();
  });

  it("rejects forged captures/previews and malformed model/scenario values", () => {
    const { options } = fixture();
    expect(
      prepareValuationNote({
        ...options,
        capture: { ...options.capture },
      }).preview,
    ).toBeNull();
    expect(
      appendValuationNote({ note: "forged" } as PreparedValuationNote).appended,
    ).toBe(false);
    for (const scenario of ["__proto__", "constructor", {}, null])
      expect(
        prepareValuationNote({
          ...options,
          scenario: scenario as AuthoredValuationScenario,
        }).preview,
      ).toBeNull();
    expect(
      prepareValuationNote({ ...options, model: "unknown" as "dcf" }).preview,
    ).toBeNull();
  });

  it("consumes the capability before apply, including reentrant or throwing callbacks", () => {
    const { options } = fixture();
    const apply = vi.fn(() => {
      expect(appendValuationNote(preview).appended).toBe(false);
      throw new Error("apply failed");
    });
    const preview: PreparedValuationNote = prepareValuationNote({
      ...options,
      apply,
    }).preview!;
    expect(appendValuationNote(preview).appended).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(appendValuationNote(preview).appended).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("keeps nonpositive equity unavailable and refuses an invalid model without affecting the other", () => {
    const { options, workbench } = fixture();
    workbench.setDcfField("enterpriseToEquityBridgeUsd", "999999999");
    workbench.setExitField("debt", "999999999");
    const capture = workbench.calculate()!;
    for (const model of ["dcf", "exit"] as const)
      expect(
        prepareValuationNote({ ...options, capture, model }).preview!.excerpt,
      ).toContain("unavailable (nonpositive_equity_value");
    workbench.setDcfField("startingUnleveredCashFlowUsd", "");
    const invalid = workbench.calculate()!;
    expect(
      prepareValuationNote({ ...options, capture: invalid }).preview,
    ).toBeNull();
    expect(
      prepareValuationNote({ ...options, capture: invalid, model: "exit" })
        .preview,
    ).not.toBeNull();
  });
});
