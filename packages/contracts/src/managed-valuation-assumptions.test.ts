import { describe, expect, it } from "vitest";
import {
  EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
  MANAGED_VALUATION_ASSUMPTIONS_LIMITS,
  encodeValuationAssumptionsPayload,
  parseManagedValuationAssumptions,
  parseManagedValuationAssumptionsCommand,
  parseManagedValuationAssumptionsReceipt,
  parseValuationAssumptionEntry,
  parseValuationAssumptionsPayload,
} from "./managed-valuation-assumptions";

function entry() {
  const dcfScenario = () => ({ annualCashFlowGrowthPercent: "" });
  const exitScenario = () => ({
    annualRevenueGrowthPercent: "",
    targetEbitdaMarginPercent: "",
    exitMultiple: "",
  });
  return {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
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
    cik: null,
    dcf: {
      modelVersion: "authored-cash-flow-dcf-v1",
      inputs: {
        startingUnleveredCashFlowUsd: " 1e3 invalid\n",
        enterpriseToEquityBridgeUsd: "-0.00",
        dilutedShares: "",
        forecastYears: "5",
        waccPercent: "１０",
        terminalGrowthPercent: "",
        scenarios: {
          conservative: dcfScenario(),
          base: dcfScenario(),
          expansion: dcfScenario(),
        },
      },
    },
    exit: {
      modelVersion: "authored-exit-multiple-v1",
      inputs: {
        baseRevenue: "",
        cash: "",
        debt: "",
        dilutedShares: "",
        horizonYears: "5",
        discountRatePercent: "",
        scenarios: {
          conservative: exitScenario(),
          base: exitScenario(),
          expansion: exitScenario(),
        },
      },
    },
  };
}
const payload = () => ({ schemaVersion: 1, entries: [entry()] });
const command = () => ({
  expectedVersion: 3,
  idempotencyKey: "valuation-command-key-0001",
  payload: payload(),
});

describe("managed editable valuation assumptions contract", () => {
  it("owns and deeply freezes both raw input maps without calculating or normalizing text", () => {
    const input = payload();
    const parsed = parseValuationAssumptionsPayload(input)!;
    expect(parsed).toEqual(input);
    expect(parsed.entries[0]!.dcf.inputs.startingUnleveredCashFlowUsd).toBe(
      " 1e3 invalid\n",
    );
    expect(parsed.entries[0]!.dcf.inputs.waccPercent).toBe("１０");
    expect(Object.isFrozen(parsed.entries[0]!.exit.inputs.scenarios.base)).toBe(
      true,
    );
    expect(Object.isFrozen(parsed.entries[0]!.listing)).toBe(true);
    input.entries[0]!.dcf.inputs.scenarios.base.annualCashFlowGrowthPercent =
      "90";
    expect(
      parsed.entries[0]!.dcf.inputs.scenarios.base.annualCashFlowGrowthPercent,
    ).toBe("");
    expect(JSON.parse(encodeValuationAssumptionsPayload(parsed))).toEqual(
      parsed,
    );
  });
  it("captures canonical field order independent of incoming object order, retaining entry order", () => {
    const first = entry();
    const second = {
      ...entry(),
      listing: { ...first.listing, listingId: "listing-one", symbol: "ONE" },
    };
    const ordered = parseValuationAssumptionsPayload({
      schemaVersion: 1,
      entries: [first, second],
    })!;
    const reversedKeys = Object.fromEntries(Object.entries(first).reverse());
    expect(
      encodeValuationAssumptionsPayload(
        parseValuationAssumptionsPayload({
          entries: [reversedKeys, second],
          schemaVersion: 1,
        })!,
      ),
    ).toBe(encodeValuationAssumptionsPayload(ordered));
    expect(
      encodeValuationAssumptionsPayload(
        parseValuationAssumptionsPayload({
          schemaVersion: 1,
          entries: [second, first],
        })!,
      ),
    ).not.toBe(encodeValuationAssumptionsPayload(ordered));
  });
  it.each(["", "0", "-", "not numeric", "😀".repeat(512)])(
    "retains bounded raw input %s",
    (value) => {
      const input = entry();
      input.exit.inputs.scenarios.base.exitMultiple = value;
      expect(
        parseValuationAssumptionEntry(input)?.exit.inputs.scenarios.base
          .exitMultiple,
      ).toBe(value);
    },
  );
  it.each([
    "x".repeat(513),
    "😀".repeat(513),
    "\ud800",
    "\udfff",
    "ok\ud800wrong",
  ])("refuses overlength or malformed Unicode without clipping", (value) => {
    const input = entry();
    input.dcf.inputs.waccPercent = value;
    expect(parseValuationAssumptionEntry(input)).toBeNull();
  });
  it.each([
    (input: ReturnType<typeof entry>) => ({ ...input, cik: "1" }),
    (input: ReturnType<typeof entry>) => ({ ...input, cik: undefined }),
    (input: ReturnType<typeof entry>) => ({ ...input, origin: "watchlist" }),
    (input: ReturnType<typeof entry>) => ({
      ...input,
      catalogSnapshotSha256: "wrong",
    }),
    (input: ReturnType<typeof entry>) => ({
      ...input,
      dcf: { ...input.dcf, modelVersion: "future-v2" },
    }),
    (input: ReturnType<typeof entry>) => ({
      ...input,
      exit: { ...input.exit, modelVersion: "future-v2" },
    }),
    (input: ReturnType<typeof entry>) => ({
      ...input,
      listing: { ...input.listing, note: "not allowed" },
    }),
    (input: ReturnType<typeof entry>) => ({
      ...input,
      dcf: { ...input.dcf, inputs: { ...input.dcf.inputs, waccPercent: 10 } },
    }),
    (input: ReturnType<typeof entry>) => ({
      ...input,
      exit: {
        ...input.exit,
        inputs: {
          ...input.exit.inputs,
          scenarios: { ...input.exit.inputs.scenarios, fourth: {} },
        },
      },
    }),
  ])("refuses a foreign shape/version/identity field", (alter) => {
    expect(parseValuationAssumptionEntry(alter(entry()))).toBeNull();
  });
  it("requires nullable CIK and accepts exactly ten digits", () => {
    expect(
      parseValuationAssumptionEntry({ ...entry(), cik: "0000000001" })?.cik,
    ).toBe("0000000001");
    const input: Record<string, unknown> = entry();
    delete input.cik;
    expect(parseValuationAssumptionEntry(input)).toBeNull();
  });
  it("rejects getters, prototypes and array holes without invoking getter/toJSON hooks", () => {
    let calls = 0;
    const input = entry();
    Object.defineProperty(input.dcf.inputs, "waccPercent", {
      enumerable: true,
      get: () => {
        calls++;
        return "10";
      },
    });
    expect(parseValuationAssumptionEntry(input)).toBeNull();
    const hook = {
      ...entry(),
      toJSON: () => {
        calls++;
        return entry();
      },
    };
    expect(parseValuationAssumptionEntry(hook)).toBeNull();
    expect(parseValuationAssumptionEntry(Object.create(entry()))).toBeNull();
    expect(
      parseValuationAssumptionsPayload({ schemaVersion: 1, entries: Array(1) }),
    ).toBeNull();
    const array = [entry()];
    Object.defineProperty(array, 0, {
      enumerable: true,
      get: () => {
        calls++;
        return entry();
      },
    });
    expect(
      parseValuationAssumptionsPayload({ schemaVersion: 1, entries: array }),
    ).toBeNull();
    expect(calls).toBe(0);
  });
  it("enforces unique listing identities, entry count and actual UTF8 payload bound", () => {
    expect(
      parseValuationAssumptionsPayload({
        schemaVersion: 1,
        entries: [entry(), entry()],
      }),
    ).toBeNull();
    const entries = Array.from({ length: 20 }, (_, index) => ({
      ...entry(),
      listing: { ...entry().listing, listingId: `listing-${index}` },
    }));
    expect(
      parseValuationAssumptionsPayload({ schemaVersion: 1, entries })?.entries,
    ).toHaveLength(20);
    expect(
      parseValuationAssumptionsPayload({
        schemaVersion: 1,
        entries: [...entries, entry()],
      }),
    ).toBeNull();
    for (const item of entries) {
      const raw = "😀".repeat(512);
      for (const key of [
        "baseRevenue",
        "cash",
        "debt",
        "dilutedShares",
        "discountRatePercent",
      ] as const)
        item.exit.inputs[key] = raw;
      for (const scenario of Object.values(item.exit.inputs.scenarios))
        scenario.exitMultiple = raw;
    }
    expect(
      new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, entries }))
        .byteLength,
    ).toBeGreaterThan(MANAGED_VALUATION_ASSUMPTIONS_LIMITS.payloadBytes);
    expect(
      parseValuationAssumptionsPayload({ schemaVersion: 1, entries }),
    ).toBeNull();
    expect(() =>
      encodeValuationAssumptionsPayload({ schemaVersion: 1, entries } as never),
    ).toThrow();
  });
  it("reads only an empty version0 and binds each receipt to exact command text/next version", () => {
    expect(
      parseManagedValuationAssumptions({
        version: 0,
        payload: EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
      })?.version,
    ).toBe(0);
    expect(
      parseManagedValuationAssumptions({ version: 0, payload: payload() }),
    ).toBeNull();
    const captured = parseManagedValuationAssumptionsCommand(command())!;
    expect(
      parseManagedValuationAssumptionsReceipt(
        { version: 4, payload: captured.payload, replayed: true },
        captured,
      )?.replayed,
    ).toBe(true);
    expect(
      parseManagedValuationAssumptionsReceipt(
        { version: 5, payload: captured.payload, replayed: false },
        captured,
      ),
    ).toBeNull();
    const changed = payload();
    changed.entries[0]!.dcf.inputs.waccPercent = "10";
    expect(
      parseManagedValuationAssumptionsReceipt(
        { version: 4, payload: changed, replayed: true },
        captured,
      ),
    ).toBeNull();
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER, Infinity])(
    "refuses unsafe command version %s",
    (expectedVersion) => {
      expect(
        parseManagedValuationAssumptionsCommand({
          ...command(),
          expectedVersion,
        }),
      ).toBeNull();
    },
  );
  it("refuses short/extra-key command envelopes and extra receipt fields", () => {
    expect(
      parseManagedValuationAssumptionsCommand({
        ...command(),
        idempotencyKey: "short",
      }),
    ).toBeNull();
    expect(
      parseManagedValuationAssumptionsCommand({
        ...command(),
        ownerId: "foreign",
      }),
    ).toBeNull();
    const captured = parseManagedValuationAssumptionsCommand(command())!;
    expect(
      parseManagedValuationAssumptionsReceipt(
        {
          version: 4,
          payload: captured.payload,
          replayed: true,
          ownerId: "foreign",
        },
        captured,
      ),
    ).toBeNull();
  });
});
