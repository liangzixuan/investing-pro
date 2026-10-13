import { describe, expect, it, vi } from "vitest";
import { MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS } from "@research-cockpit/contracts";
import {
  cashResponse,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import { request } from "../features/research/sec-annual-evidence-fixture";
import { parseSecAnnualEvidenceResponse } from "./sec-annual-evidence-response";

const signal = () => new AbortController().signal;
const fixture = () =>
  cashResponse([
    cashRow("operating_cash_flow", "12345678901234567890.12"),
    cashRow("ppe_purchases", "20.01"),
  ]);
type Wire = Awaited<ReturnType<typeof fixture>>;

describe("strict Annual cash response boundary", () => {
  it("accepts and deeply freezes independent exact amounts and the recomputed difference", async () => {
    const wire = await fixture();
    const actual = await parseSecAnnualEvidenceResponse(
      wire,
      request(),
      signal(),
    );
    expect(actual).toEqual(wire);
    expect(
      actual?.evidence.cashGeneration.resolution
        .operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "12345678901234567870.11" });
    expect(
      Object.isFrozen(
        actual?.evidence.cashGeneration.operatingCashFlow.observations[0]
          ?.filing,
      ),
    ).toBe(true);
  });
  it.each([
    ["old schema", (v: Wire) => ({ ...v, schemaVersion: "1.0.0" })],
    [
      "old definition",
      (v: Wire) => ({
        ...v,
        evidence: {
          ...v.evidence,
          generation: { ...v.evidence.generation, definitionVersion: "1.0.0" },
        },
      }),
    ],
    [
      "missing cash",
      (v: Wire) => ({
        ...v,
        evidence: Object.fromEntries(
          Object.entries(v.evidence).filter(
            ([key]) => key !== "cashGeneration",
          ),
        ),
      }),
    ],
    ["cash extra key", (v: Wire) => cashPatch(v, { arbitrary: 1 })],
    [
      "invented calculated value",
      (v: Wire) =>
        cashPatch(v, {
          resolution: {
            ...v.evidence.cashGeneration.resolution,
            operatingCashFlowLessPpePurchases: {
              ...v.evidence.cashGeneration.resolution
                .operatingCashFlowLessPpePurchases,
              value: "0",
            },
          },
        }),
    ],
    [
      "forged current-use flag",
      (v: Wire) =>
        cashPatch(v, {
          resolution: {
            ...v.evidence.cashGeneration.resolution,
            operatingCashFlow: {
              ...v.evidence.cashGeneration.resolution.operatingCashFlow,
              currentUseEligible: false,
            },
          },
        }),
    ],
    [
      "false complete counts",
      (v: Wire) =>
        metricPatch(v, {
          scan: {
            status: "available",
            absence: null,
            coverage: {
              ...coverage(v),
              full: { ...coverage(v).full, candidateRows: 2 },
            },
          },
        }),
    ],
    [
      "overflow with provisional rows",
      (v: Wire) =>
        metricPatch(v, {
          scan: { status: "candidate_limit", absence: null, coverage: null },
        }),
    ],
    [
      "absent concept with rows",
      (v: Wire) =>
        metricPatch(v, {
          scan: {
            status: "available",
            absence: "concept_missing",
            coverage: coverage(v),
          },
        }),
    ],
    ["wrong concept", (v: Wire) => rowPatch(v, { concept: "NetIncomeLoss" })],
    ["wrong metric", (v: Wire) => rowPatch(v, { metric: "ppe_purchases" })],
    [
      "cross-section ID",
      (v: Wire) => rowPatch(v, { id: v.evidence.observations[0]!.id }),
    ],
    ["altered exact value", (v: Wire) => rowPatch(v, { value: "3" })],
    [
      "wrong locator",
      (v: Wire) =>
        rowPatch(v, {
          sourceLocator:
            "/facts/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment/units/USD/0",
        }),
    ],
    [
      "locator beyond scan",
      (v: Wire) =>
        rowPatch(v, {
          sourceLocator:
            "/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/1",
        }),
    ],
    [
      "wrong filing",
      (v: Wire) =>
        rowPatch(v, {
          filing: {
            ...v.evidence.cashGeneration.operatingCashFlow.observations[0]!
              .filing,
            reportDate: "2024-12-31",
          },
        }),
    ],
    [
      "unsupported observation key",
      (v: Wire) => rowPatch(v, { valueUSD: "100" }),
    ],
  ] as const)("rejects %s", async (_label, forge) => {
    expect(
      await parseSecAnnualEvidenceResponse(
        forge(await fixture()),
        request(),
        signal(),
      ),
    ).toBeNull();
  });
  it("owns cash observations before asynchronous hashing", async () => {
    const wire = await fixture();
    const expected = structuredClone(wire);
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
      const pending = parseSecAnnualEvidenceResponse(wire, request(), signal());
      Object.assign(
        wire.evidence.cashGeneration.operatingCashFlow.observations[0]!,
        { value: "999" },
      );
      release();
      expect(await pending).toEqual(expected);
    } finally {
      digest.mockRestore();
    }
  });
  it("accepts both full selected cash packets within the existing response limit without clipping", async () => {
    const rows = (["operating_cash_flow", "ppe_purchases"] as const).flatMap(
      (metric) =>
        Array.from({ length: 100 }, (_, index) => {
          const item = cashRow(metric, "9".repeat(64), {
            frame: `FRAME${index}`,
          });
          return {
            ...item,
            sourceLocator: item.sourceLocator.replace(/\/0$/u, `/${index}`),
          };
        }),
    );
    const wire = await cashResponse(rows);
    expect(new TextEncoder().encode(JSON.stringify(wire)).length).toBeLessThan(
      MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
    );
    const actual = await parseSecAnnualEvidenceResponse(
      wire,
      request(),
      signal(),
    );
    expect(
      actual?.evidence.cashGeneration.operatingCashFlow.observations,
    ).toHaveLength(100);
    expect(
      actual?.evidence.cashGeneration.ppePurchases.observations,
    ).toHaveLength(100);
    expect(
      actual?.evidence.cashGeneration.resolution
        .operatingCashFlowLessPpePurchases,
    ).toMatchObject({ status: "available", value: "0" });
  });
});

function cashPatch(v: Wire, patch: object) {
  return {
    ...v,
    evidence: {
      ...v.evidence,
      cashGeneration: { ...v.evidence.cashGeneration, ...patch },
    },
  };
}
function metricPatch(v: Wire, patch: object) {
  return cashPatch(v, {
    operatingCashFlow: {
      ...v.evidence.cashGeneration.operatingCashFlow,
      ...patch,
    },
  });
}
function rowPatch(v: Wire, patch: object) {
  return metricPatch(v, {
    observations: [
      {
        ...v.evidence.cashGeneration.operatingCashFlow.observations[0]!,
        ...patch,
      },
    ],
  });
}
function coverage(v: Wire) {
  const scan = v.evidence.cashGeneration.operatingCashFlow.scan;
  if (scan.status !== "available")
    throw new Error("Expected complete invented scan");
  return scan.coverage;
}
