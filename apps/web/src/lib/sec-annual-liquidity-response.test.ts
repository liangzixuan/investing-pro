import { describe, expect, it, vi } from "vitest";
import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  type PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualLiquidity } from "@research-cockpit/personal-financial-analytics";
import {
  liquidity,
  liquidityResponse,
  liquidityRow,
} from "../features/research/sec-annual-liquidity-fixture";
import {
  cashGeneration,
  cashRow,
} from "../features/research/sec-annual-cash-fixture";
import {
  request,
  response,
  row as incomeRow,
} from "../features/research/sec-annual-evidence-fixture";
import { annualComparisonResponse } from "../clerk-trial/annual-comparison-fixture";
import { parseSecAnnualEvidenceResponse } from "./sec-annual-evidence-response";

type Wire = PersonalSecAnnualEvidenceResponseDto;
const fixture = () =>
  liquidityResponse([
    liquidityRow("current_assets", "120"),
    liquidityRow("current_liabilities", "80"),
  ]);
const parse = (value: unknown, signal = new AbortController().signal) =>
  parseSecAnnualEvidenceResponse(value, request(), signal);

describe("strict Annual liquidity response boundary", () => {
  it("owns and deeply freezes exact balances, working capital and the rounded multiple", async () => {
    const wire = await fixture();
    const actual = await parse(wire);
    expect(actual).toEqual(wire);
    expect(actual).not.toBe(wire);
    expect(actual?.evidence.liquidity.resolution).toMatchObject({
      currentAssets: {
        status: "available",
        unit: "USD",
        value: "120",
        asOfDate: "2025-12-31",
      },
      currentLiabilities: { status: "available", unit: "USD", value: "80" },
      workingCapital: { status: "available", unit: "USD", value: "40" },
      currentRatio: { status: "available", unit: "multiple", value: "1.50" },
    });
    expect(
      Object.isFrozen(
        actual?.evidence.liquidity.currentAssets.observations[0]?.filing,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        actual?.evidence.liquidity.resolution.currentRatio.observationIds,
      ),
    ).toBe(true);
  });

  it.each([
    ["v2 response", (v: Wire) => ({ ...v, schemaVersion: "2.0.0" })],
    [
      "v2 definition",
      (v: Wire) => ({
        ...v,
        evidence: {
          ...v.evidence,
          generation: { ...v.evidence.generation, definitionVersion: "2.0.0" },
        },
      }),
    ],
    [
      "missing liquidity",
      (v: Wire) => ({
        ...v,
        evidence: Object.fromEntries(
          Object.entries(v.evidence).filter(([key]) => key !== "liquidity"),
        ),
      }),
    ],
    [
      "extra liquidity field",
      (v: Wire) => liquidityPatch(v, { subtotal: "40" }),
    ],
    [
      "extra scan key",
      (v: Wire) =>
        metricPatch(v, {
          scan: { ...v.evidence.liquidity.currentAssets.scan, extra: true },
        }),
    ],
    [
      "wrong concept",
      (v: Wire) => rowPatch(v, { concept: "LiabilitiesCurrent" }),
    ],
    [
      "cash concept",
      (v: Wire) =>
        rowPatch(v, { concept: "NetCashProvidedByUsedInOperatingActivities" }),
    ],
    [
      "wrong metric",
      (v: Wire) => rowPatch(v, { metric: "current_liabilities" }),
    ],
    [
      "extra observation field",
      (v: Wire) => rowPatch(v, { balanceDate: "2025-12-31" }),
    ],
    [
      "cross-section ID",
      (v: Wire) => rowPatch(v, { id: v.evidence.observations[0]!.id }),
    ],
    ["altered exact amount", (v: Wire) => rowPatch(v, { value: "121" })],
    ["noncanonical amount", (v: Wire) => rowPatch(v, { value: "120.0" })],
    ["oversized amount", (v: Wire) => rowPatch(v, { value: "1".repeat(65) })],
    [
      "wrong concept locator",
      (v: Wire) =>
        rowPatch(v, {
          sourceLocator: "/facts/us-gaap/LiabilitiesCurrent/units/USD/0",
        }),
    ],
    [
      "locator outside inspected rows",
      (v: Wire) =>
        rowPatch(v, {
          sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/1",
        }),
    ],
    [
      "locator at candidate bound",
      (v: Wire) =>
        rowPatch(v, {
          sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/10000",
        }),
    ],
    [
      "other accession",
      (v: Wire) => rowPatch(v, { accessionNumber: "0000000001-25-000001" }),
    ],
    [
      "wrong filing source",
      (v: Wire) =>
        rowPatch(v, {
          filing: {
            ...asset(v).filing,
            sourceUrl:
              "https://www.sec.gov/Archives/edgar/data/2/0000000001-26-000001-index.htm",
          },
        }),
    ],
    [
      "wrong target report date",
      (v: Wire) =>
        rowPatch(v, {
          filing: { ...asset(v).filing, reportDate: "2024-12-31" },
        }),
    ],
    [
      "invented ratio",
      (v: Wire) => resultPatch(v, "currentRatio", { value: "1.51" }),
    ],
    [
      "wrong ratio unit",
      (v: Wire) => resultPatch(v, "currentRatio", { unit: "USD" }),
    ],
    [
      "invented difference",
      (v: Wire) => resultPatch(v, "workingCapital", { value: "41" }),
    ],
    [
      "wrong balance date",
      (v: Wire) => resultPatch(v, "currentAssets", { asOfDate: "2024-12-31" }),
    ],
    [
      "false current-use flag",
      (v: Wire) =>
        resultPatch(v, "currentAssets", { currentUseEligible: false }),
    ],
    [
      "missing operand evidence",
      (v: Wire) => resultPatch(v, "workingCapital", { observationIds: [] }),
    ],
    [
      "fake unavailable reason",
      (v: Wire) =>
        resultPatch(v, "currentRatio", {
          status: "unavailable",
          reason: "concept_missing",
        }),
    ],
    [
      "false inspected count",
      (v: Wire) =>
        metricPatch(v, {
          scan: {
            status: "available",
            absence: null,
            coverage: {
              ...coverage(v),
              full: { ...coverage(v).full, inspectedRows: 2 },
            },
          },
        }),
    ],
    [
      "false returned count",
      (v: Wire) =>
        metricPatch(v, {
          scan: {
            status: "available",
            absence: null,
            coverage: { ...coverage(v), returned: 0 },
          },
        }),
    ],
    [
      "null selected count with target",
      (v: Wire) =>
        metricPatch(v, {
          scan: {
            status: "available",
            absence: null,
            coverage: { ...coverage(v), selected: null },
          },
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
    [
      "failed scan with provisional rows",
      (v: Wire) =>
        metricPatch(v, {
          scan: { status: "candidate_limit", absence: null, coverage: null },
        }),
    ],
    [
      "false source failure",
      (v: Wire) =>
        metricPatch(v, {
          scan: { status: "source_unavailable", absence: null, coverage: null },
          observations: [],
        }),
    ],
  ] as const)("rejects %s", async (_label, change) => {
    expect(await parse(change(await fixture()))).toBeNull();
  });

  it("rejects a v2 captured request before decoding a v3 packet", async () => {
    const requested = request();
    Object.assign(requested, { schemaVersion: "2.0.0" });
    expect(
      await parseSecAnnualEvidenceResponse(
        await fixture(),
        requested,
        new AbortController().signal,
      ),
    ).toBeNull();
  });

  it("rejects a forged liquidity hash even when every resolved observation reference agrees", async () => {
    const wire = await fixture();
    Object.assign(asset(wire), { id: `sec-fact:${"e".repeat(64)}` });
    recompute(wire);
    expect(await parse(wire)).toBeNull();
  });

  it("honors cancellation while hashing the new liquidity rows", async () => {
    const wire = await fixture();
    const controller = new AbortController();
    const original = crypto.subtle.digest.bind(crypto.subtle);
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const digest = vi
      .spyOn(crypto.subtle, "digest")
      .mockImplementation(async (...args) => {
        if (
          new TextDecoder()
            .decode(args[1])
            .startsWith('{"metric":"current_assets"')
        ) {
          entered();
          await gate;
        }
        return original(...args);
      });
    try {
      const pending = parse(wire, controller.signal);
      await started;
      controller.abort();
      release();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      release();
      digest.mockRestore();
    }
  });

  it("keeps prior balance dates as evidence but resolves only the exact selected report date", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "120"),
      liquidityRow("current_assets", "999", {
        endDate: "2024-12-31",
        frame: "CY2024Q4I",
        sourceLocator: "/facts/us-gaap/AssetsCurrent/units/USD/1",
      }),
      liquidityRow("current_liabilities", "80"),
    ]);
    const actual = await parse(wire);
    expect(actual?.evidence.liquidity.currentAssets.observations).toHaveLength(
      2,
    );
    expect(actual?.evidence.liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      value: "120",
    });
    const reversed = structuredClone(wire);
    Object.assign(reversed.evidence.liquidity.currentAssets, {
      observations: [
        ...reversed.evidence.liquidity.currentAssets.observations,
      ].reverse(),
    });
    expect(await parse(reversed)).toBeNull();
  });

  it("keeps a valid duration observation inspectable while withholding its instant balance", async () => {
    const wire = await liquidityResponse([
      liquidityRow("current_assets", "120", {
        startDate: "2025-01-01",
        durationDays: 365,
      }),
      liquidityRow("current_liabilities", "80"),
    ]);
    const actual = await parse(wire);
    expect(
      actual?.evidence.liquidity.currentAssets.observations[0]?.startDate,
    ).toBe("2025-01-01");
    expect(actual?.evidence.liquidity.resolution.currentAssets).toMatchObject({
      status: "unavailable",
      reason: "invalid_instant_period",
    });
    expect(
      actual?.evidence.liquidity.resolution.currentLiabilities,
    ).toMatchObject({ status: "available", value: "80" });
    expect(await parse(rowPatch(wire, { durationDays: null }))).toBeNull();
  });

  it.each(["invalid_response", "candidate_limit"] as const)(
    "retains income, cash and the other balance after a %s scan",
    async (status) => {
      const wire = await fixture();
      Object.assign(wire.evidence, {
        cashGeneration: await cashGeneration(wire.evidence, [
          cashRow("operating_cash_flow", "1000"),
          cashRow("ppe_purchases", "250"),
        ]),
      });
      Object.assign(wire.evidence.liquidity, {
        currentAssets: {
          scan: { status, absence: null, coverage: null },
          observations: [],
        },
      });
      recompute(wire);
      const actual = await parse(wire);
      expect(actual?.evidence.resolution).toEqual(wire.evidence.resolution);
      expect(
        actual?.evidence.cashGeneration.resolution
          .operatingCashFlowLessPpePurchases,
      ).toMatchObject({ status: "available", value: "750" });
      expect(actual?.evidence.liquidity.resolution.currentAssets).toMatchObject(
        { status: "unavailable", reason: status },
      );
      expect(
        actual?.evidence.liquidity.resolution.currentLiabilities,
      ).toMatchObject({ status: "available", value: "80" });
    },
  );

  it("admits liquidity independently when the income scan is refused", async () => {
    const wire = structuredClone(
      await annualComparisonResponse("left", { mode: "income-invalid" }),
    );
    Object.assign(wire.evidence, {
      liquidity: await liquidity(wire.evidence, [
        liquidityRow("current_assets", "120"),
        liquidityRow("current_liabilities", "80"),
      ]),
    });
    const actual = await parse(wire);
    expect(actual?.evidence.completeness.status).toBe("refused");
    expect(actual?.evidence.liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: "40",
    });
    expect(actual?.evidence.liquidity.resolution.currentRatio).toMatchObject({
      status: "available",
      value: "1.50",
    });
  });

  it.each(["concept_missing", "usd_missing", "empty_usd"] as const)(
    "accepts truthful %s without inventing zero",
    async (absence) => {
      const wire = await liquidityResponse([
        liquidityRow("current_liabilities", "80"),
      ]);
      Object.assign(wire.evidence.liquidity.currentAssets.scan, { absence });
      recompute(wire);
      expect(
        (await parse(wire))?.evidence.liquidity.resolution.currentAssets,
      ).toMatchObject({ status: "unavailable", reason: absence });
    },
  );

  it("retains signed reported amounts while independently refusing unsupported calculation signs", async () => {
    const actual = await parse(
      await liquidityResponse([
        liquidityRow("current_assets", "-120"),
        liquidityRow("current_liabilities", "80"),
      ]),
    );
    expect(actual?.evidence.liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      value: "-120",
    });
    expect(actual?.evidence.liquidity.resolution.workingCapital).toMatchObject({
      status: "unavailable",
      reason: "unsupported_sign",
    });
    expect(actual?.evidence.liquidity.resolution.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "unsupported_sign",
    });
  });

  it("admits zero liabilities for the difference while retaining the ratio refusal", async () => {
    const actual = await parse(
      await liquidityResponse([
        liquidityRow("current_assets", "120"),
        liquidityRow("current_liabilities", "0"),
      ]),
    );
    expect(actual?.evidence.liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: "120",
    });
    expect(actual?.evidence.liquidity.resolution.currentRatio).toMatchObject({
      status: "unavailable",
      reason: "nonpositive_current_liabilities",
    });
  });

  it("admits derived strings longer than a source decimal without clipping", async () => {
    const large = "9".repeat(64),
      tiny = `0.${"0".repeat(61)}1`;
    const ratio = (
      await parse(
        await liquidityResponse([
          liquidityRow("current_assets", large),
          liquidityRow("current_liabilities", tiny),
        ]),
      )
    )?.evidence.liquidity.resolution.currentRatio;
    expect(ratio?.status).toBe("available");
    if (ratio?.status === "available")
      expect(ratio.value).toBe(`${large}${"0".repeat(62)}.00`);
    const difference = (
      await parse(
        await liquidityResponse([
          liquidityRow("current_assets", tiny),
          liquidityRow("current_liabilities", large),
        ]),
      )
    )?.evidence.liquidity.resolution.workingCapital;
    expect(difference?.status).toBe("available");
    if (difference?.status === "available") {
      expect(difference.value.length).toBe(128);
      expect(difference.value).toBe(`-${"9".repeat(63)}8.${"9".repeat(62)}`);
    }
  });

  it("preserves historical values with their original qualification and generation clocks", async () => {
    const wire = await liquidityResponse(
      [
        liquidityRow("current_assets", "120"),
        liquidityRow("current_liabilities", "80"),
      ],
      "2028-09-20T00:00:00.000Z",
    );
    const actual = await parse(wire);
    expect(actual?.evidence.liquidity.resolution.currentAssets).toMatchObject({
      status: "available",
      value: "120",
      currentUseEligible: false,
      asOfDate: "2025-12-31",
    });
    expect(actual?.evidence.generation).toEqual(wire.evidence.generation);
  });

  it("admits all600 income, cash and instant observations inside the unchanged full-packet byte cap", async () => {
    const rows = (["current_assets", "current_liabilities"] as const).flatMap(
      (metric) =>
        Array.from({ length: 100 }, (_, index) => {
          const row = liquidityRow(metric, "9".repeat(64), {
            frame: `FRAME${index}`,
          });
          return {
            ...row,
            sourceLocator: row.sourceLocator.replace(/\/0$/u, `/${index}`),
          };
        }),
    );
    const income = (["Revenues", "NetIncomeLoss"] as const).flatMap((concept) =>
      Array.from({ length: 100 }, (_, index) =>
        incomeRow(concept, "9".repeat(64), {
          frame: `FRAME${index}`,
          sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
        }),
      ),
    );
    const cash = (["operating_cash_flow", "ppe_purchases"] as const).flatMap(
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
    const wire = await response(income);
    Object.assign(wire.evidence, {
      cashGeneration: await cashGeneration(wire.evidence, cash),
      liquidity: await liquidity(wire.evidence, rows),
    });
    expect(new TextEncoder().encode(JSON.stringify(wire)).length).toBeLessThan(
      MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
    );
    const actual = await parse(wire);
    expect(actual?.evidence.liquidity.currentAssets.observations).toHaveLength(
      100,
    );
    expect(
      actual?.evidence.liquidity.currentLiabilities.observations,
    ).toHaveLength(100);
    expect(actual?.evidence.observations).toHaveLength(200);
    expect(
      actual?.evidence.cashGeneration.operatingCashFlow.observations,
    ).toHaveLength(100);
    expect(
      actual?.evidence.cashGeneration.ppePurchases.observations,
    ).toHaveLength(100);
    expect(actual?.evidence.liquidity.resolution.workingCapital).toMatchObject({
      status: "available",
      value: "0",
    });
    expect(actual?.evidence.liquidity.resolution.currentRatio).toMatchObject({
      status: "available",
      value: "1.00",
    });
  });

  it("accepts a fully withheld selected overflow, rejecting a clipped provisional value", async () => {
    const wire = await fixture();
    Object.assign(wire.evidence.liquidity.currentAssets, {
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
    recompute(wire);
    expect(
      (await parse(wire))?.evidence.liquidity.resolution.currentAssets,
    ).toMatchObject({
      status: "unavailable",
      reason: "selected_report_overflow",
    });
    const original = await fixture();
    expect(
      await parse(metricPatch(wire, { observations: [asset(original)] })),
    ).toBeNull();
  });

  it.each([false, true])(
    "owns liquidity before asynchronous hashing and respects cancellation=%s",
    async (cancel) => {
      const wire = await fixture(),
        expected = structuredClone(wire);
      const controller = new AbortController();
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

function asset(v: Wire) {
  return v.evidence.liquidity.currentAssets.observations[0]!;
}
function liquidityPatch(v: Wire, patch: object) {
  return {
    ...v,
    evidence: {
      ...v.evidence,
      liquidity: { ...v.evidence.liquidity, ...patch },
    },
  };
}
function metricPatch(v: Wire, patch: object) {
  return liquidityPatch(v, {
    currentAssets: { ...v.evidence.liquidity.currentAssets, ...patch },
  });
}
function rowPatch(v: Wire, patch: object) {
  return metricPatch(v, { observations: [{ ...asset(v), ...patch }] });
}
function resultPatch(
  v: Wire,
  key: "currentAssets" | "currentRatio" | "workingCapital",
  patch: object,
) {
  return liquidityPatch(v, {
    resolution: {
      ...v.evidence.liquidity.resolution,
      [key]: { ...v.evidence.liquidity.resolution[key], ...patch },
    },
  });
}
function coverage(v: Wire) {
  const scan = v.evidence.liquidity.currentAssets.scan;
  if (scan.status !== "available")
    throw new Error("Expected complete invented scan");
  return scan.coverage;
}
function recompute(v: Wire) {
  Object.assign(v.evidence.liquidity, {
    resolution: resolvePersonalSecAnnualLiquidity(v.evidence),
  });
}
