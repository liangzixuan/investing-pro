import { describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualBalanceSheet } from "@research-cockpit/personal-financial-analytics";
import {
  balanceSheetResponse,
  balanceSheetRow,
} from "../features/research/sec-annual-balance-sheet-fixture";
import { request } from "../features/research/sec-annual-evidence-fixture";
import { parseSecAnnualEvidenceResponse } from "./sec-annual-evidence-response";

type Wire = PersonalSecAnnualEvidenceResponseDto;
const fixture = () =>
  balanceSheetResponse([
    balanceSheetRow("total_assets", "120"),
    balanceSheetRow("total_liabilities", "140"),
    balanceSheetRow("shareholders_equity", "-20"),
  ]);
const parse = (value: unknown, signal = new AbortController().signal) =>
  parseSecAnnualEvidenceResponse(value, request(), signal);
function section(v: Wire, patch: object) {
  return {
    ...v,
    evidence: {
      ...v.evidence,
      balanceSheet: { ...v.evidence.balanceSheet, ...patch },
    },
  };
}
function asset(v: Wire) {
  return v.evidence.balanceSheet.totalAssets.observations[0]!;
}
function metric(v: Wire, patch: object) {
  return section(v, {
    totalAssets: { ...v.evidence.balanceSheet.totalAssets, ...patch },
  });
}
function row(v: Wire, patch: object) {
  return metric(v, { observations: [{ ...asset(v), ...patch }] });
}

describe("strict Annual balance-sheet response boundary", () => {
  it("owns three independent exact signed reported totals and their frozen references", async () => {
    const wire = await fixture();
    const actual = await parse(wire);
    expect(actual).toEqual(wire);
    expect(actual).not.toBe(wire);
    expect(actual?.evidence.balanceSheet.resolution).toMatchObject({
      totalAssets: {
        status: "available",
        unit: "USD",
        value: "120",
        asOfDate: "2025-12-31",
      },
      totalLiabilities: { status: "available", value: "140" },
      shareholdersEquity: { status: "available", value: "-20" },
    });
    expect(
      Object.isFrozen(
        actual?.evidence.balanceSheet.totalAssets.observations[0]?.filing,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        actual?.evidence.balanceSheet.resolution.shareholdersEquity
          .observationIds,
      ),
    ).toBe(true);
  });

  it.each<[string, (v: Wire) => unknown]>([
    ["old schema", (v) => ({ ...v, schemaVersion: "4.0.0" })],
    [
      "old definition",
      (v) => ({
        ...v,
        evidence: {
          ...v.evidence,
          generation: { ...v.evidence.generation, definitionVersion: "4.0.0" },
        },
      }),
    ],
    [
      "missing balance sheet",
      (v) => ({
        ...v,
        evidence: Object.fromEntries(
          Object.entries(v.evidence).filter(([key]) => key !== "balanceSheet"),
        ),
      }),
    ],
    ["extra metric", (v) => section(v, { derivedEquity: "-20" })],
    ["wrong concept", (v) => row(v, { concept: "AssetsCurrent" })],
    [
      "noncontrolling equity substitute",
      (v) =>
        row(v, {
          concept:
            "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        }),
    ],
    ["wrong metric", (v) => row(v, { metric: "current_assets" })],
    ["wrong unit", (v) => row(v, { unit: "shares" })],
    ["extra field", (v) => row(v, { derived: true })],
    ["changed amount with stale hash", (v) => row(v, { value: "121" })],
    ["noncanonical decimal", (v) => row(v, { value: "120.0" })],
    ["oversize decimal", (v) => row(v, { value: "1".repeat(65) })],
    ["negative zero", (v) => row(v, { value: "-0" })],
    [
      "other accession",
      (v) => row(v, { accessionNumber: "0000000001-25-000001" }),
    ],
    [
      "wrong source pointer",
      (v) =>
        row(v, { sourceLocator: "/facts/us-gaap/Liabilities/units/USD/0" }),
    ],
    [
      "outside inspected rows",
      (v) => row(v, { sourceLocator: "/facts/us-gaap/Assets/units/USD/1" }),
    ],
    [
      "candidate bound",
      (v) => row(v, { sourceLocator: "/facts/us-gaap/Assets/units/USD/10000" }),
    ],
    [
      "cross-section identity",
      (v) => row(v, { id: v.evidence.observations[0]!.id }),
    ],
    ["duplicate row", (v) => metric(v, { observations: [asset(v), asset(v)] })],
    [
      "wrong filing source",
      (v) =>
        row(v, {
          filing: {
            ...asset(v).filing,
            sourceUrl: "https://example.test/filing",
          },
        }),
    ],
    [
      "wrong joined report",
      (v) =>
        row(v, { filing: { ...asset(v).filing, reportDate: "2024-12-31" } }),
    ],
    [
      "forged result",
      (v) =>
        section(v, {
          resolution: {
            ...v.evidence.balanceSheet.resolution,
            totalAssets: {
              ...v.evidence.balanceSheet.resolution.totalAssets,
              value: "999",
            },
          },
        }),
    ],
    [
      "forged current use",
      (v) =>
        section(v, {
          resolution: {
            ...v.evidence.balanceSheet.resolution,
            totalAssets: {
              ...v.evidence.balanceSheet.resolution.totalAssets,
              currentUseEligible: false,
            },
          },
        }),
    ],
    [
      "forged reference",
      (v) =>
        section(v, {
          resolution: {
            ...v.evidence.balanceSheet.resolution,
            totalAssets: {
              ...v.evidence.balanceSheet.resolution.totalAssets,
              observationIds: [],
            },
          },
        }),
    ],
    [
      "forged utility age",
      (v) =>
        section(v, {
          resolution: {
            ...v.evidence.balanceSheet.resolution,
            utilityAge: null,
          },
        }),
    ],
    [
      "unavailable scan retaining rows",
      (v) =>
        metric(v, {
          scan: { status: "invalid_response", absence: null, coverage: null },
        }),
    ],
  ])("rejects %s without accepting a partial graph", async (_name, patch) => {
    expect(await parse(patch(await fixture()))).toBeNull();
  });

  it("withholds an entire selected overflow while preserving independent liability and equity values", async () => {
    const wire = await fixture();
    Object.assign(wire.evidence.balanceSheet.totalAssets, {
      observations: [],
      scan: {
        status: "available",
        absence: null,
        coverage: {
          full: {
            candidateRows: 101,
            inspectedRows: 101,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: 101,
          },
          selected: 101,
          otherAccessions: 0,
          returned: 0,
          omittedSelected: 101,
        },
      },
    });
    const { cik, generation, target, balanceSheet } = wire.evidence;
    Object.assign(balanceSheet, {
      resolution: resolvePersonalSecAnnualBalanceSheet({
        cik,
        generation,
        target,
        balanceSheet: {
          totalAssets: balanceSheet.totalAssets,
          totalLiabilities: balanceSheet.totalLiabilities,
          shareholdersEquity: balanceSheet.shareholdersEquity,
        },
      }),
    });
    expect((await parse(wire))?.evidence.balanceSheet.resolution).toMatchObject(
      {
        totalAssets: {
          status: "unavailable",
          reason: "selected_report_overflow",
        },
        totalLiabilities: { status: "available", value: "140" },
        shareholdersEquity: { status: "available", value: "-20" },
      },
    );
    expect(
      await parse(metric(wire, { observations: [asset(await fixture())] })),
    ).toBeNull();
  });

  it.each([false, true])(
    "owns the graph before asynchronous hashing and respects cancellation=%s",
    async (cancel) => {
      const wire = await fixture(),
        expected = structuredClone(wire),
        controller = new AbortController();
      const original = crypto.subtle.digest.bind(crypto.subtle);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const digest = vi
        .spyOn(crypto.subtle, "digest")
        .mockImplementationOnce(async (...args) => {
          await gate;
          return original(...args);
        });
      try {
        const pending = parse(wire, controller.signal);
        Object.assign(asset(wire), { value: "999" });
        if (cancel) controller.abort();
        release();
        if (cancel)
          await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        else expect(await pending).toEqual(expected);
      } finally {
        digest.mockRestore();
      }
    },
  );
});
