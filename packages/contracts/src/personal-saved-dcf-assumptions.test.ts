import { describe, expect, it, vi } from "vitest";
import {
  isPersonalSavedDcfAssumptions,
  isPersonalSavedDcfBinding,
  isPersonalSavedDcfEntry,
  isPersonalSavedDcfIdentity,
  isPersonalSavedDcfPayload,
  isPersonalSavedDcfPutRequest,
  isPersonalSavedDcfResolved,
  isPersonalSavedDcfResolveRequest,
  isPersonalSavedDcfSupportedEntry,
  normalizePersonalSavedDcfAssumptions,
  PERSONAL_SAVED_DCF_MAXIMUM_PAYLOAD_BYTES,
  type PersonalSavedDcfAssumptionsDto,
  type PersonalSavedDcfEntryDto,
  type PersonalSavedDcfIdentityDto,
} from "./personal-saved-dcf-assumptions";

const digest = `sha256:${"a".repeat(64)}` as const;
const context = { catalogSnapshotSha256: digest, watchlistVersion: 4 };
function assumptions(): PersonalSavedDcfAssumptionsDto {
  return {
    forecastYears: 5,
    taxShieldRatePercent: "21",
    waccPercent: "10",
    terminalGrowthPercent: "2.5",
    scenarios: {
      conservative: { annualFcfProxyGrowthPercent: "0" },
      base: { annualFcfProxyGrowthPercent: "5" },
      expansion: { annualFcfProxyGrowthPercent: "10" },
    },
  };
}
function identity(index = 1): PersonalSavedDcfIdentityDto {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `ISS-${index}`,
    issuerName: `Issuer ${index}`,
    listingId: `LST-${index}`,
    securityId: `SEC-${index}`,
    securityName: `Security ${index}`,
    shareClassId: `SHR-${index}`,
    shareClassName: "Common",
    symbol: `S${index}`,
  };
}
function entry(index = 1): PersonalSavedDcfEntryDto {
  return {
    identity: identity(index),
    createdAgainstCatalogSnapshotSha256: digest,
    modelVersion: "1.0.0",
    assumptions: normalizePersonalSavedDcfAssumptions(assumptions())!,
  };
}
const payload = (entries = [entry()]) => ({ schemaVersion: 1, entries });

describe("saved DCF assumption normalization", () => {
  it("normalizes all six rates exactly and copies/freezes only the new result", () => {
    const source = assumptions();
    const before = JSON.stringify(source);
    const result = normalizePersonalSavedDcfAssumptions(source)!;
    expect(result).toEqual({
      forecastYears: 5,
      taxShieldRatePercent: "21.0000",
      waccPercent: "10.0000",
      terminalGrowthPercent: "2.5000",
      scenarios: {
        conservative: { annualFcfProxyGrowthPercent: "0.0000" },
        base: { annualFcfProxyGrowthPercent: "5.0000" },
        expansion: { annualFcfProxyGrowthPercent: "10.0000" },
      },
    });
    expect(isPersonalSavedDcfAssumptions(result)).toBe(true);
    expect(isPersonalSavedDcfAssumptions(source)).toBe(false);
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(source.scenarios)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.scenarios)).toBe(true);
    for (const item of Object.values(result.scenarios))
      expect(Object.isFrozen(item)).toBe(true);
    expect(normalizePersonalSavedDcfAssumptions(result)).toEqual(result);
  });

  it.each(["-0", "-0.0", "-0.0000", "0", "0.0000"])(
    "canonicalizes signed zero %s without changing the raw input",
    (value) => {
      const source = {
        ...assumptions(),
        taxShieldRatePercent: value,
        terminalGrowthPercent: value,
        scenarios: {
          conservative: { annualFcfProxyGrowthPercent: value },
          base: { annualFcfProxyGrowthPercent: value },
          expansion: { annualFcfProxyGrowthPercent: value },
        },
      };
      const normalized = normalizePersonalSavedDcfAssumptions(source)!;
      expect(normalized.taxShieldRatePercent).toBe("0.0000");
      expect(normalized.terminalGrowthPercent).toBe("0.0000");
      expect(
        Object.values(normalized.scenarios).map(
          (s) => s.annualFcfProxyGrowthPercent,
        ),
      ).toEqual(["0.0000", "0.0000", "0.0000"]);
      expect(source.taxShieldRatePercent).toBe(value);
    },
  );

  it.each([
    { forecastYears: 5 },
    { forecastYears: 10 },
    { taxShieldRatePercent: "0" },
    { taxShieldRatePercent: "50" },
    { waccPercent: "1", terminalGrowthPercent: "-2" },
    { waccPercent: "30" },
    { terminalGrowthPercent: "-2" },
    { terminalGrowthPercent: "5" },
    { waccPercent: "5.0001", terminalGrowthPercent: "5" },
  ])("admits exact inclusive bounds and a one-unit WACC gap %#", (change) => {
    expect(
      normalizePersonalSavedDcfAssumptions({ ...assumptions(), ...change }),
    ).not.toBeNull();
  });

  it.each([
    { forecastYears: 4 },
    { forecastYears: 11 },
    { forecastYears: 5.1 },
    { forecastYears: "5" },
    { forecastYears: Infinity },
    { forecastYears: NaN },
    { forecastYears: Number.MAX_SAFE_INTEGER + 1 },
    { taxShieldRatePercent: "-0.0001" },
    { taxShieldRatePercent: "50.0001" },
    { waccPercent: "0.9999" },
    { waccPercent: "30.0001" },
    { terminalGrowthPercent: "-2.0001" },
    { terminalGrowthPercent: "5.0001" },
    { waccPercent: "5", terminalGrowthPercent: "5" },
    { waccPercent: "4.9999", terminalGrowthPercent: "5" },
  ])(
    "rejects invalid horizons, adjacent out-of-bounds values and nonpositive discount gap %#",
    (change) => {
      expect(
        normalizePersonalSavedDcfAssumptions({ ...assumptions(), ...change }),
      ).toBeNull();
    },
  );

  it.each(["-50", "50", "5.4321"])("admits all scenario ties at %s", (rate) => {
    expect(
      normalizePersonalSavedDcfAssumptions({
        ...assumptions(),
        scenarios: {
          conservative: { annualFcfProxyGrowthPercent: rate },
          base: { annualFcfProxyGrowthPercent: rate },
          expansion: { annualFcfProxyGrowthPercent: rate },
        },
      }),
    ).not.toBeNull();
  });
  it.each([
    [-50.0001, 0, 1],
    [-1, 0, 50.0001],
    [1, 0, 2],
    [0, 2, 1],
  ])("rejects scenario bounds/order %j", (low, middle, high) => {
    expect(
      normalizePersonalSavedDcfAssumptions({
        ...assumptions(),
        scenarios: {
          conservative: { annualFcfProxyGrowthPercent: String(low) },
          base: { annualFcfProxyGrowthPercent: String(middle) },
          expansion: { annualFcfProxyGrowthPercent: String(high) },
        },
      }),
    ).toBeNull();
  });

  it.each([
    "",
    "-",
    "2.",
    ".5",
    "+1",
    "01",
    " 1",
    "1 ",
    "1e1",
    "NaN",
    "Infinity",
    "1.00000",
    "0.00000",
    "1,000",
    "１",
    "9".repeat(65),
    "9".repeat(64),
    2,
    null,
  ])("rejects incomplete, lossy or nonordinary rate %#", (value) => {
    expect(
      normalizePersonalSavedDcfAssumptions({
        ...assumptions(),
        taxShieldRatePercent: value,
      }),
    ).toBeNull();
  });

  it("rejects extra/hidden/accessor fields at every structural level without invoking getters", () => {
    const read = vi.fn(() => "10");
    const getter = { ...assumptions() };
    Object.defineProperty(getter, "waccPercent", {
      get: read,
      enumerable: true,
    });
    const hidden = { ...assumptions() };
    Object.defineProperty(hidden, Symbol("provider"), { value: "price" });
    const inherited = Object.assign(
      Object.create({ provider: "price" }) as object,
      assumptions(),
    );
    for (const value of [
      getter,
      hidden,
      inherited,
      { ...assumptions(), price: "100" },
      {
        ...assumptions(),
        scenarios: {
          ...assumptions().scenarios,
          bull: { annualFcfProxyGrowthPercent: "20" },
        },
      },
      {
        ...assumptions(),
        scenarios: {
          ...assumptions().scenarios,
          base: { annualFcfProxyGrowthPercent: "5", output: "100" },
        },
      },
    ])
      expect(normalizePersonalSavedDcfAssumptions(value)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(
      normalizePersonalSavedDcfAssumptions(
        Object.assign(Object.create(null) as object, assumptions()),
      ),
    ).not.toBeNull();
  });
});

describe("saved DCF identity and collection contract", () => {
  it("preserves exact eleven-field watchlist identities, including Unicode codepoint limits", () => {
    const value = {
      ...identity(),
      symbol: "S".repeat(15),
      issuerName: "😀".repeat(512),
      securityName: "e\u0301",
      shareClassName: "class A",
    };
    expect(isPersonalSavedDcfIdentity(value)).toBe(true);
    expect(value.securityName).toBe("e\u0301");
    expect(
      isPersonalSavedDcfIdentity({ ...value, issuerName: "😀".repeat(513) }),
    ).toBe(false);
  });
  it.each([
    { note: "private" },
    { cik: "0000000001" },
    { country: "CA" },
    { symbol: "S".repeat(16) },
    { symbol: "a" },
    { exchangeMic: "nasdaq" },
    { instrumentType: "fund" },
    { issuerId: "" },
    { listingId: "x".repeat(129) },
    { securityId: "bad id" },
    { shareClassId: null },
    { issuerName: " name" },
    { securityName: "name " },
    { shareClassName: "bad\u0000" },
    { issuerName: "hidden\u200b" },
    { securityName: "\ud800" },
  ])("rejects malformed membership identity %#", (change) => {
    expect(isPersonalSavedDcfIdentity({ ...identity(), ...change })).toBe(
      false,
    );
  });

  it("admits empty/twenty entries, rejects duplicates and caps UTF-8 data without coercion", () => {
    expect(isPersonalSavedDcfPayload(payload([]))).toBe(true);
    const maximum = payload(
      Array.from({ length: 20 }, (_, i) => ({
        ...entry(i),
        identity: {
          ...identity(i),
          issuerName: "😀".repeat(512),
          securityName: "😀".repeat(512),
          shareClassName: "😀".repeat(512),
        },
      })),
    );
    expect(isPersonalSavedDcfPayload(maximum)).toBe(true);
    expect(
      new TextEncoder().encode(JSON.stringify(maximum)).byteLength,
    ).toBeLessThan(PERSONAL_SAVED_DCF_MAXIMUM_PAYLOAD_BYTES);
    expect(
      isPersonalSavedDcfPayload(
        payload(Array.from({ length: 21 }, (_, i) => entry(i))),
      ),
    ).toBe(false);
    expect(isPersonalSavedDcfPayload(payload([entry(), entry()]))).toBe(false);
    // Separate listings of one issuer are distinct personal models, not a peer cohort.
    expect(
      isPersonalSavedDcfPayload(
        payload([
          entry(),
          {
            ...entry(2),
            identity: { ...identity(2), issuerId: identity().issuerId },
          },
        ]),
      ),
    ).toBe(true);
  });

  it("rejects sparse/decorated arrays, accessors and unsupported collection shapes", () => {
    const sparse = [entry()];
    sparse.length = 2;
    const extra = Object.assign([entry()], { quotes: [] });
    const symbol = [entry()];
    Object.defineProperty(symbol, Symbol("secret"), { value: "private" });
    const accessor = [entry()];
    const read = vi.fn(() => entry());
    Object.defineProperty(accessor, "0", { get: read });
    const inherited = [entry()];
    Object.setPrototypeOf(inherited, {});
    for (const entries of [sparse, extra, symbol, accessor, inherited])
      expect(isPersonalSavedDcfPayload({ schemaVersion: 1, entries })).toBe(
        false,
      );
    expect(read).not.toHaveBeenCalled();
    for (const value of [
      { ...payload(), schemaVersion: 2 },
      { ...payload(), history: [] },
      { schemaVersion: 1, entries: null },
    ])
      expect(isPersonalSavedDcfPayload(value)).toBe(false);
    expect(
      isPersonalSavedDcfPayload(
        payload(Object.freeze([entry()]) as PersonalSavedDcfEntryDto[]),
      ),
    ).toBe(true);
  });

  it("keeps a well-formed unsupported model readable and clearable without admitting it for save/resolve", () => {
    const unsupported = {
      ...entry(),
      modelVersion: "2.0.0",
      assumptions: {
        ...entry().assumptions,
        forecastYears: 20,
        waccPercent: "99.0000",
      },
    };
    expect(isPersonalSavedDcfEntry(unsupported)).toBe(true);
    expect(isPersonalSavedDcfSupportedEntry(unsupported)).toBe(false);
    expect(
      isPersonalSavedDcfEntry({ ...unsupported, modelVersion: "1.0.0" }),
    ).toBe(false);
    expect(
      isPersonalSavedDcfPutRequest({
        operation: "save",
        listingId: "LST-1",
        payload: payload([unsupported]),
        context,
      }),
    ).toBe(false);
    expect(
      isPersonalSavedDcfPutRequest({
        operation: "save",
        listingId: "LST-2",
        payload: payload([unsupported, entry(2)]),
        context,
      }),
    ).toBe(true);
    expect(
      isPersonalSavedDcfPutRequest({
        operation: "clear",
        listingId: "LST-1",
        payload: payload([]),
        context: null,
      }),
    ).toBe(true);
    for (const change of [
      { modelVersion: "latest" },
      { modelVersion: "01.0.0" },
      { modelVersion: "1.0" },
      { price: "100" },
      { assumptions: { ...unsupported.assumptions, waccPercent: "99" } },
      {
        assumptions: {
          ...unsupported.assumptions,
          taxShieldRatePercent: "-0.0000",
        },
      },
    ])
      expect(isPersonalSavedDcfEntry({ ...unsupported, ...change })).toBe(
        false,
      );
  });

  it("requires exact save/clear context and a canonical supported target", () => {
    const request = {
      operation: "save",
      listingId: "LST-1",
      payload: payload(),
      context,
    };
    expect(isPersonalSavedDcfPutRequest(request)).toBe(true);
    for (const value of [
      { ...request, context: null },
      { ...request, listingId: "LST-2" },
      { ...request, operation: "clear" },
      { ...request, context: { ...context, watchlistVersion: 0 } },
      {
        ...request,
        context: {
          ...context,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
      },
      {
        ...request,
        payload: payload([{ ...entry(), assumptions: assumptions() }]),
      },
      { ...request, result: {} },
      { operation: "clear", listingId: "LST-1", payload: payload([]), context },
    ])
      expect(isPersonalSavedDcfPutRequest(value)).toBe(false);
    expect(isPersonalSavedDcfBinding(context)).toBe(true);
  });

  it("admits exact positive resolve binding and allows historical entry provenance", () => {
    const request = { ...context, identity: identity(), expectedVersion: 5 };
    const response = {
      ...context,
      schemaVersion: "1.0.0",
      savedAssumptionsVersion: 5,
      entry: {
        ...entry(),
        createdAgainstCatalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      },
    };
    expect(isPersonalSavedDcfResolveRequest(request)).toBe(true);
    expect(isPersonalSavedDcfResolved(response)).toBe(true);
    for (const expectedVersion of [0, -1, 1.5, "5", NaN])
      expect(
        isPersonalSavedDcfResolveRequest({ ...request, expectedVersion }),
      ).toBe(false);
    expect(
      isPersonalSavedDcfResolved({
        ...response,
        entry: { ...response.entry, modelVersion: "2.0.0" },
      }),
    ).toBe(false);
    expect(isPersonalSavedDcfResolved({ ...response, price: "100" })).toBe(
      false,
    );
  });
});
