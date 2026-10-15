import { describe, expect, it, vi } from "vitest";
import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualOperatingHistory,
  resolvePersonalSecAnnualOperatingResults,
} from "@research-cockpit/personal-financial-analytics";
import {
  operatingResponse,
  operatingRow,
} from "../features/research/sec-annual-operating-fixture";
import { request, row } from "../features/research/sec-annual-evidence-fixture";
import { parseSecAnnualEvidenceResponse } from "./sec-annual-evidence-response";
type Wire = PersonalSecAnnualEvidenceResponseDto;
const parse = (value: unknown, signal = new AbortController().signal) =>
  parseSecAnnualEvidenceResponse(value, request(), signal);

describe("strict Annual operating response", () => {
  it("retains all comparative periods and their original filing metadata for operating history", async () => {
    const periods = [2025, 2024, 2023].map((year) => ({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      durationDays: year === 2024 ? 366 : 365,
      frame: `CY${year}`,
    }));
    const wire = await operatingResponse(
      periods.map((period, index) =>
        operatingRow(["-25.125", "0", "60"][index], {
          ...period,
          sourceLocator: `/facts/us-gaap/OperatingIncomeLoss/units/USD/${index}`,
        }),
      ),
      periods.map((period, index) =>
        row("Revenues", ["1000", "800", "600"][index], {
          ...period,
          sourceLocator: `/facts/us-gaap/Revenues/units/USD/${index}`,
        }),
      ),
    );
    const actual = await parse(wire);
    expect(actual).toEqual(wire);
    expect(actual).not.toBe(wire);
    expect(actual!.evidence.generation).toEqual(wire.evidence.generation);
    expect(actual!.evidence.target).toEqual(wire.evidence.target);
    expect(
      actual!.evidence.operatingResults.operatingIncome.observations,
    ).toHaveLength(3);
    expect(actual!.evidence.observations).toHaveLength(3);
    const history = resolvePersonalSecAnnualOperatingHistory(
      actual!.evidence,
      "Revenues",
    );
    expect(history).toMatchObject({
      status: "available",
      periods: [
        {
          endDate: "2025-12-31",
          operatingIncome: "-25.125",
          revenue: "1000",
          operatingMarginPercent: "-2.51",
        },
        {
          endDate: "2024-12-31",
          operatingIncome: "0",
          revenue: "800",
          operatingMarginPercent: "0",
        },
        {
          endDate: "2023-12-31",
          operatingIncome: "60",
          revenue: "600",
          operatingMarginPercent: "10",
        },
      ],
      stoppedReason: null,
    });
    for (const observation of [
      ...actual!.evidence.observations,
      ...actual!.evidence.operatingResults.operatingIncome.observations,
    ]) {
      expect(observation.filing.reportDate).toBe("2025-12-31");
      expect(Object.isFrozen(observation.filing)).toBe(true);
    }
  });

  it("owns and freezes exact negative operating results without requiring net income", async () => {
    const wire = await operatingResponse(
      [operatingRow("-25.125")],
      [row("Revenues", "1000")],
    );
    const actual = await parse(wire);
    expect(actual).toEqual(wire);
    expect(actual).not.toBe(wire);
    expect(actual?.evidence.operatingResults.resolution).toMatchObject({
      operatingIncome: { status: "available", value: "-25.125" },
    });
    expect(
      actual?.evidence.operatingResults.resolution.margins.find(
        (basis) => basis.concept === "Revenues",
      ),
    ).toMatchObject({
      revenue: { status: "available", value: "1000" },
      operatingMargin: { status: "available", value: "-2.51", unit: "percent" },
    });
    expect(
      actual?.evidence.resolution.bases.find((b) => b.concept === "Revenues")
        ?.status,
    ).not.toBe("eligible");
    expect(
      Object.isFrozen(
        actual?.evidence.operatingResults.operatingIncome.observations[0]
          ?.filing,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(actual?.evidence.operatingResults.resolution.margins),
    ).toBe(true);
  });

  it.each([
    ["old schema", (v: Wire) => ({ ...v, schemaVersion: "3.0.0" })],
    [
      "old definition",
      (v: Wire) => ({
        ...v,
        evidence: {
          ...v.evidence,
          generation: { ...v.evidence.generation, definitionVersion: "3.0.0" },
        },
      }),
    ],
    [
      "missing section",
      (v: Wire) => ({
        ...v,
        evidence: Object.fromEntries(
          Object.entries(v.evidence).filter(
            ([key]) => key !== "operatingResults",
          ),
        ),
      }),
    ],
    ["extra section key", (v: Wire) => patch(v, { extra: true })],
    [
      "forged income",
      (v: Wire) =>
        result(v, {
          operatingIncome: {
            ...v.evidence.operatingResults.resolution.operatingIncome,
            value: "999",
          },
        }),
    ],
    [
      "forged margin",
      (v: Wire) =>
        result(v, {
          margins: v.evidence.operatingResults.resolution.margins.map((b) => ({
            ...b,
            operatingMargin: { ...b.operatingMargin, value: "99" },
          })),
        }),
    ],
    [
      "omitted basis",
      (v: Wire) =>
        result(v, {
          margins: v.evidence.operatingResults.resolution.margins.slice(1),
        }),
    ],
    [
      "reordered basis",
      (v: Wire) =>
        result(v, {
          margins: [
            ...v.evidence.operatingResults.resolution.margins,
          ].reverse(),
        }),
    ],
    ["wrong metric", (v: Wire) => source(v, { metric: "net_income" })],
    ["wrong concept", (v: Wire) => source(v, { concept: "NetIncomeLoss" })],
    ["wrong USD", (v: Wire) => source(v, { unit: "EUR" })],
    [
      "foreign accession",
      (v: Wire) => source(v, { accessionNumber: "0000000001-25-000001" }),
    ],
    [
      "cross section ID",
      (v: Wire) => source(v, { id: v.evidence.observations[0]!.id }),
    ],
    ["altered source amount", (v: Wire) => source(v, { value: "251" })],
    ["noncanonical source", (v: Wire) => source(v, { value: "250.0" })],
    ["oversized source", (v: Wire) => source(v, { value: "1".repeat(65) })],
    [
      "foreign locator",
      (v: Wire) =>
        source(v, { sourceLocator: "/facts/us-gaap/Revenues/units/USD/0" }),
    ],
    [
      "uninspected locator",
      (v: Wire) =>
        source(v, {
          sourceLocator: "/facts/us-gaap/OperatingIncomeLoss/units/USD/1",
        }),
    ],
    [
      "wrong filing metadata",
      (v: Wire) =>
        source(v, {
          filing: {
            ...v.evidence.operatingResults.operatingIncome.observations[0]!
              .filing,
            reportDate: "2024-12-31",
          },
        }),
    ],
    [
      "extra scan key",
      (v: Wire) =>
        patch(v, {
          operatingIncome: {
            ...v.evidence.operatingResults.operatingIncome,
            scan: {
              ...v.evidence.operatingResults.operatingIncome.scan,
              extra: true,
            },
          },
        }),
    ],
    [
      "false absence",
      (v: Wire) =>
        patch(v, {
          operatingIncome: {
            ...v.evidence.operatingResults.operatingIncome,
            scan: {
              ...v.evidence.operatingResults.operatingIncome.scan,
              absence: "concept_missing",
            },
          },
        }),
    ],
  ] as const)("refuses %s", async (_name, mutate) =>
    expect(await parse(mutate(await operatingResponse()))).toBeNull(),
  );

  it("rejects rehashed results with a forged reported value", async () => {
    const wire = await operatingResponse();
    const changed = source(wire, { value: "251" }) as Wire;
    const forged = {
      ...changed,
      evidence: {
        ...changed.evidence,
        operatingResults: {
          ...changed.evidence.operatingResults,
          resolution: resolvePersonalSecAnnualOperatingResults(
            changed.evidence,
          ),
        },
      },
    };
    expect(await parse(forged)).toBeNull();
  });

  it("retains independent results when the operating concept is absent", async () => {
    const wire = await operatingResponse([]);
    expect(
      (await parse(wire))?.evidence.operatingResults.resolution.operatingIncome,
    ).toMatchObject({ status: "unavailable", reason: "concept_missing" });
    expect((await parse(wire))?.evidence.resolution).toEqual(
      wire.evidence.resolution,
    );
  });

  it("keeps source ownership while asynchronous hashing is pending", async () => {
    const wire = await operatingResponse();
    const original = structuredClone(wire);
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi
      .spyOn(crypto.subtle, "digest")
      .mockImplementation(async (...args) => {
        await held;
        return digest(...args);
      });
    try {
      const pending = parse(wire);
      Object.assign(
        wire.evidence.operatingResults.operatingIncome.observations[0]!,
        { value: "251" },
      );
      release();
      expect(await pending).toEqual(original);
    } finally {
      release();
      spy.mockRestore();
    }
  });
});

function patch(v: Wire, changes: Record<string, unknown>) {
  return {
    ...v,
    evidence: {
      ...v.evidence,
      operatingResults: { ...v.evidence.operatingResults, ...changes },
    },
  };
}
function result(v: Wire, changes: Record<string, unknown>) {
  return patch(v, {
    resolution: { ...v.evidence.operatingResults.resolution, ...changes },
  });
}
function source(v: Wire, changes: Record<string, unknown>) {
  const item = v.evidence.operatingResults.operatingIncome;
  return patch(v, {
    operatingIncome: {
      ...item,
      observations: [{ ...item.observations[0], ...changes }],
    },
  });
}
