import { describe, expect, it, vi } from "vitest";
import {
  isPersonalSavedManualPeerBinding,
  isPersonalSavedManualPeerGroup,
  isPersonalSavedManualPeerIdentity,
  isPersonalSavedManualPeerPayload,
  isPersonalSavedManualPeerPutRequest,
  isPersonalSavedManualPeerResolved,
  isPersonalSavedManualPeerResolveRequest,
  PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS,
  type PersonalSavedManualPeerGroupDto,
  type PersonalSavedManualPeerIdentityDto,
} from "./personal-saved-manual-peer-group";

const digest = `sha256:${"a".repeat(64)}` as const;
const context = { catalogSnapshotSha256: digest, watchlistVersion: 4 };
function identity(index = 1): PersonalSavedManualPeerIdentityDto {
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
function group(): PersonalSavedManualPeerGroupDto {
  return {
    createdAgainstCatalogSnapshotSha256: digest,
    primary: identity(),
    peers: [identity(3), identity(2)],
  };
}
const payload = () => ({ schemaVersion: 1, group: group() });

describe("saved manual peer group admission", () => {
  it("preserves full identity, ordered peers and caller ownership without provider inputs", () => {
    const source = payload(),
      before = structuredClone(source);
    expect(isPersonalSavedManualPeerPayload(source)).toBe(true);
    expect(source).toEqual(before);
    expect(Object.isFrozen(source.group)).toBe(false);
    expect(source.group.peers.map((p) => p.listingId)).toEqual([
      "LST-3",
      "LST-2",
    ]);
    expect(
      isPersonalSavedManualPeerPayload({ schemaVersion: 1, group: null }),
    ).toBe(true);
  });
  it.each([1, 2, 3])("admits exactly %i distinct peers", (count) => {
    expect(
      isPersonalSavedManualPeerGroup({
        ...group(),
        peers: Array.from({ length: count }, (_, i) => identity(i + 2)),
      }),
    ).toBe(true);
  });
  it("rejects empty, oversized, duplicate listing or issuer samples including the primary", () => {
    for (const peers of [
      [],
      [2, 3, 4, 5].map(identity),
      [identity(), identity(2)],
      [identity(2), identity(2)],
      [{ ...identity(2), issuerId: identity().issuerId }],
      [identity(2), { ...identity(3), issuerId: identity(2).issuerId }],
    ])
      expect(isPersonalSavedManualPeerGroup({ ...group(), peers })).toBe(false);
  });
  it.each(PERSONAL_SAVED_MANUAL_PEER_IDENTITY_FIELDS)(
    "requires the complete %s field",
    (field) => {
      const incomplete: Record<string, unknown> = { ...identity() };
      delete incomplete[field];
      expect(isPersonalSavedManualPeerIdentity(incomplete)).toBe(false);
      expect(
        isPersonalSavedManualPeerGroup({ ...group(), primary: incomplete }),
      ).toBe(false);
      expect(
        isPersonalSavedManualPeerGroup({ ...group(), peers: [incomplete] }),
      ).toBe(false);
    },
  );
  it("preserves admitted Unicode codepoint bounds and rejects noncanonical identity text", () => {
    const maximum = "😀".repeat(512);
    expect(
      isPersonalSavedManualPeerIdentity({
        ...identity(),
        issuerName: maximum,
        symbol: "A".repeat(15),
      }),
    ).toBe(true);
    for (const change of [
      { issuerName: maximum + "x" },
      { issuerName: " Leading" },
      { securityName: "Trailing " },
      { shareClassName: "" },
      { issuerName: "bad\u0000text" },
      { issuerName: "bad\u200btext" },
      { issuerName: "\ud800" },
      { country: "CA" },
      { exchangeMic: "nas" },
      { instrumentType: "etf" },
      { symbol: "a" },
      { symbol: "A".repeat(16) },
      { listingId: "x".repeat(129) },
    ])
      expect(
        isPersonalSavedManualPeerIdentity({ ...identity(), ...change }),
      ).toBe(false);
  });
  it("rejects unknown fields, hidden metadata, accessors and non-plain records without evaluating them", () => {
    const getter = vi.fn(() => "secret");
    const accessor = Object.defineProperty({ ...identity() }, "issuerName", {
      get: getter,
      enumerable: true,
    });
    for (const item of [
      { ...identity(), note: "private" },
      Object.defineProperty({ ...identity() }, "hidden", { value: 1 }),
      { ...identity(), [Symbol("hidden")]: true },
      accessor,
      Object.assign(Object.create({ extra: true }) as object, identity()),
    ])
      expect(isPersonalSavedManualPeerIdentity(item)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    expect(
      isPersonalSavedManualPeerGroup({ ...group(), quote: { price: "1" } }),
    ).toBe(false);
    expect(
      isPersonalSavedManualPeerPayload({ ...payload(), export: true }),
    ).toBe(false);
    expect(
      isPersonalSavedManualPeerPayload({ schemaVersion: 2, group: null }),
    ).toBe(false);
  });
  it("rejects sparse peers, extra array keys, accessors and altered array prototypes", () => {
    const alteredPrototype: unknown = Object.setPrototypeOf(
      [identity(2)],
      null,
    );
    const sparse = Array<unknown>(2);
    sparse[0] = identity(2);
    const getter = vi.fn(() => identity(2));
    const accessor = Object.defineProperty([identity(2)], "0", {
      get: getter,
      enumerable: true,
    });
    for (const peers of [
      sparse,
      Object.assign([identity(2)], { provider: true }),
      Object.assign([identity(2)], { [Symbol("x")]: true }),
      accessor,
      alteredPrototype,
    ])
      expect(isPersonalSavedManualPeerGroup({ ...group(), peers })).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });
  it("binds Save provenance and permits only a null group/context for Clear", () => {
    expect(
      isPersonalSavedManualPeerPutRequest({
        operation: "save",
        payload: payload(),
        context,
      }),
    ).toBe(true);
    expect(
      isPersonalSavedManualPeerPutRequest({
        operation: "clear",
        payload: { schemaVersion: 1, group: null },
        context: null,
      }),
    ).toBe(true);
    for (const request of [
      { operation: "save", payload: payload(), context: null },
      {
        operation: "save",
        payload: { schemaVersion: 1, group: null },
        context,
      },
      {
        operation: "save",
        payload: payload(),
        context: {
          ...context,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        },
      },
      { operation: "clear", payload: payload(), context: null },
      {
        operation: "clear",
        payload: { schemaVersion: 1, group: null },
        context,
      },
      { operation: "save", payload: payload(), context, provider: "extra" },
    ])
      expect(isPersonalSavedManualPeerPutRequest(request)).toBe(false);
  });
  it("strictly admits resolve bindings while retaining historical group provenance", () => {
    const fresh = {
      ...context,
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
    };
    expect(
      isPersonalSavedManualPeerResolveRequest({
        ...fresh,
        primary: identity(),
        expectedVersion: 2,
      }),
    ).toBe(true);
    expect(
      isPersonalSavedManualPeerResolved({
        ...fresh,
        schemaVersion: "1.0.0",
        savedPeerGroupVersion: 2,
        group: group(),
      }),
    ).toBe(true);
    for (const version of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1, "1"]) {
      expect(
        isPersonalSavedManualPeerBinding({
          ...context,
          watchlistVersion: version,
        }),
      ).toBe(false);
      expect(
        isPersonalSavedManualPeerResolveRequest({
          ...context,
          primary: identity(),
          expectedVersion: version,
        }),
      ).toBe(false);
      expect(
        isPersonalSavedManualPeerResolved({
          ...context,
          schemaVersion: "1.0.0",
          savedPeerGroupVersion: version,
          group: group(),
        }),
      ).toBe(false);
    }
    expect(isPersonalSavedManualPeerBinding({ ...context, extra: true })).toBe(
      false,
    );
    expect(
      isPersonalSavedManualPeerResolved({
        ...context,
        schemaVersion: "2.0.0",
        savedPeerGroupVersion: 1,
        group: group(),
      }),
    ).toBe(false);
    expect(
      isPersonalSavedManualPeerResolved({
        ...context,
        schemaVersion: "1.0.0",
        savedPeerGroupVersion: 1,
        group: null,
      }),
    ).toBe(false);
  });
});
