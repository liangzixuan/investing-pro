import { describe, expect, it } from "vitest";
import type { PersonalSecurityMasterScreenRowDto } from "./index";
import {
  isPersonalFinancialComparisonIdentity,
  isPersonalFinancialComparisonMembers,
  isPersonalFinancialComparisonSelectionPayload,
  isPersonalFinancialComparisonSelectionPutRequest,
  isPersonalFinancialComparisonSelectionResolveRequest,
  isPersonalFinancialComparisonSelectionResolved,
} from "./personal-financial-comparison-selection";

const digest = `sha256:${"a".repeat(64)}`;
const context = { catalogSnapshotSha256: digest, watchlistVersion: 7 };
function identity(index: number): PersonalSecurityMasterScreenRowDto {
  return {
    cik: String(index).padStart(10, "0"),
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `ISS-${index}`,
    issuerName: `Issuer ${index}`,
    listingId: `LST-${index}`,
    securityId: `SEC-${index}`,
    securityName: `Security ${index}`,
    shareClassId: `SHR-${index}`,
    shareClassName: `Class ${index}`,
    symbol: `S${index}`,
  };
}
function payload() {
  return {
    schemaVersion: 1,
    selection: {
      createdAgainstCatalogSnapshotSha256: digest,
      members: [identity(2), identity(1)],
    },
  };
}

describe("saved financial comparison contract", () => {
  it("admits two or three ordered full identities and clear without rewriting strings", () => {
    const original = payload();
    original.selection.members[0] = {
      ...original.selection.members[0]!,
      symbol: "S".repeat(32),
      issuerName: ` ${"é".repeat(498)} `,
    };
    const serialized = JSON.stringify(original);
    expect(isPersonalFinancialComparisonSelectionPayload(original)).toBe(true);
    expect(
      isPersonalFinancialComparisonSelectionPutRequest({
        payload: original,
        context,
      }),
    ).toBe(true);
    expect(JSON.stringify(original)).toBe(serialized);
    expect(
      isPersonalFinancialComparisonMembers([
        ...original.selection.members,
        identity(3),
      ]),
    ).toBe(true);
    expect(
      isPersonalFinancialComparisonSelectionPutRequest({
        payload: { schemaVersion: 1, selection: null },
        context: null,
      }),
    ).toBe(true);
  });

  it.each(
    [
      [],
      [identity(1)],
      [identity(1), identity(2), identity(3), identity(4)],
      [identity(1), identity(1)],
      [identity(1), { ...identity(2), issuerId: "ISS-1" }],
      [identity(1), { ...identity(2), cik: "0000000001" }],
    ].map((members) => ({ members })),
  )(
    "rejects invalid cardinality or duplicate listing/issuer/CIK %#",
    ({ members }) => {
      expect(isPersonalFinancialComparisonMembers(members)).toBe(false);
    },
  );

  it("rejects sparse, decorated, accessor and nonstandard arrays without reading accessors", () => {
    const sparse = [identity(1)];
    sparse.length = 3;
    sparse[2] = identity(2);
    const extra = Object.assign([identity(1), identity(2)], {
      prices: ["secret"],
    });
    const symbol = [identity(1), identity(2)];
    Object.defineProperty(symbol, Symbol("provider"), { value: "secret" });
    const accessor = [identity(1), identity(2)];
    Object.defineProperty(accessor, "1", {
      get: () => {
        throw new Error("must not run");
      },
    });
    const inherited = [identity(1), identity(2)];
    Object.setPrototypeOf(inherited, {});
    for (const members of [
      sparse,
      new Array(2),
      extra,
      symbol,
      accessor,
      inherited,
    ])
      expect(isPersonalFinancialComparisonMembers(members)).toBe(false);
    expect(
      isPersonalFinancialComparisonMembers(
        Object.freeze([identity(1), identity(2)]),
      ),
    ).toBe(true);
  });

  it.each([
    { cik: "123" },
    { country: "CA" },
    { exchangeMic: "nasdaq" },
    { instrumentType: "fund" },
    { issuerId: "" },
    { listingId: "x".repeat(129) },
    { securityId: "bad id" },
    { shareClassId: false },
    { issuerName: "" },
    { securityName: "x".repeat(501) },
    { shareClassName: "hidden\u0000" },
    { symbol: "s1" },
    { symbol: "S".repeat(33) },
    { note: "private" },
    { metrics: {} },
    { cik: 1 },
  ])("rejects malformed or extra full-identity fields %#", (change) => {
    expect(
      isPersonalFinancialComparisonIdentity({ ...identity(1), ...change }),
    ).toBe(false);
  });

  it("rejects hidden own keys and accessors on exact records", () => {
    const member = identity(1);
    Object.defineProperty(member, Symbol("provider"), { value: "private" });
    expect(isPersonalFinancialComparisonIdentity(member)).toBe(false);
    const source = payload();
    Object.defineProperty(source, "selection", {
      get: () => {
        throw new Error("must not run");
      },
    });
    expect(isPersonalFinancialComparisonSelectionPayload(source)).toBe(false);
    expect(
      isPersonalFinancialComparisonSelectionPayload(
        Object.assign(Object.create(null) as object, payload()),
      ),
    ).toBe(true);
  });

  it("requires the exact save binding and an explicit null context for clear", () => {
    const p = payload();
    for (const input of [
      { payload: p },
      { payload: p, context: null },
      { payload: p, context: { ...context, watchlistVersion: 0 } },
      {
        payload: p,
        context: {
          ...context,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
      },
      { payload: p, context, prices: [] },
      { payload: { ...p, schemaVersion: 2 }, context },
      {
        payload: { ...p, selection: { ...p.selection, notes: "hidden" } },
        context,
      },
      { payload: { schemaVersion: 1, selection: null }, context },
    ])
      expect(isPersonalFinancialComparisonSelectionPutRequest(input)).toBe(
        false,
      );
    expect(
      isPersonalFinancialComparisonSelectionPayload({
        ...p,
        selection: {
          ...p.selection,
          createdAgainstCatalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
      }),
    ).toBe(true);
  });

  it("admits exact positive resolve bindings and response identities independently of stored provenance", () => {
    const request = { ...context, expectedVersion: 4 };
    const response = {
      ...context,
      schemaVersion: "1.0.0",
      savedSelectionVersion: 4,
      members: payload().selection.members,
    };
    expect(isPersonalFinancialComparisonSelectionResolveRequest(request)).toBe(
      true,
    );
    expect(isPersonalFinancialComparisonSelectionResolved(response)).toBe(true);
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "4", null]) {
      expect(
        isPersonalFinancialComparisonSelectionResolveRequest({
          ...request,
          expectedVersion: value,
        }),
      ).toBe(false);
      expect(
        isPersonalFinancialComparisonSelectionResolved({
          ...response,
          savedSelectionVersion: value,
        }),
      ).toBe(false);
    }
    expect(
      isPersonalFinancialComparisonSelectionResolveRequest({
        ...request,
        extra: true,
      }),
    ).toBe(false);
    expect(
      isPersonalFinancialComparisonSelectionResolved({
        ...response,
        prices: [],
      }),
    ).toBe(false);
    expect(
      isPersonalFinancialComparisonSelectionResolved({
        ...response,
        members: [identity(1)],
      }),
    ).toBe(false);
  });
});
