import { createHash } from "node:crypto";
import {
  encodeValuationAssumptionsPayload,
  parseManagedValuationAssumptionsCommand,
  parseValuationAssumptionEntry,
  parseValuationAssumptionsPayload,
  type ManagedValuationAssumptionsCommand,
} from "@research-cockpit/contracts";
import {
  admitManagedSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
} from "@research-cockpit/personal-security-master";
import { describe, expect, it } from "vitest";
import { createAppwriteValuationAssumptionsRepository } from "./appwrite-valuation-assumptions-repository";
import type { ManagedValuationAssumptionsCatalog } from "./managed-workspace-catalog";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  VALUATION_PROOF_CATALOG_PINS,
  VALUATION_PROOF_CLOCKS,
  VALUATION_PROOF_COMMAND_PINS,
  VALUATION_PROOF_COMMANDS_SHA256,
  VALUATION_PROOF_LIMITS,
  VALUATION_PROOF_PHASES,
  VALUATION_PROOF_PLAN_SHA256,
  VALUATION_PROOF_PRINCIPALS,
  VALUATION_PROOF_ROWS,
  VALUATION_PROOF_ROWS_SHA256,
  VALUATION_PROOF_SNAPSHOTS,
  VALUATION_PROOF_TARGET,
  valuationProofData,
  valuationProofLocation,
} from "./valuation-assumptions-proof-data";

const data = valuationProofData();
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const TIME = "2026-10-19T12:00:00.000Z";
const A = VALUATION_PROOF_PRINCIPALS.a;
const expectedCatalogHashes = {
  original: "42695bf99035d952a35e4491d121a3ae864a34258ea1a6063ca9388f2be0fe42",
  revised: "73d6f483239fdd37b9445736ed984bb87d2a68449528f2efc14ab56d901505ea",
  rebound: "a24c2d5fb6a2330e5c396b818fe643d4f83766293f440f3e730be264961c0e32",
  overflow: "514705ff9db27f7021885f287d5f913e2ea23872c57031d3814e0196f201f50b",
};
function fixture() {
  const store = new AtomicStore();
  const repository = (catalog: ManagedValuationAssumptionsCatalog) =>
    createAppwriteValuationAssumptionsRepository({
      store,
      catalog,
      databaseId: VALUATION_PROOF_TARGET.databaseId,
      assumptionsTableId: VALUATION_PROOF_TARGET.currentTableId,
      receiptsTableId: VALUATION_PROOF_TARGET.receiptsTableId,
      now: () => new Date(TIME),
    });
  return {
    store,
    original: repository(data.catalog),
    revised: repository(data.revisedCatalog),
  };
}
async function seedVersionFive(f: ReturnType<typeof fixture>) {
  for (const name of [
    "create",
    "stale-winner",
    "prestage-winner",
    "overlap-winner",
    "unknown",
  ] as const)
    await f.original.put(A, data.commands.a[name]);
}
function deeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(deeplyFrozen);
}
function namedCommand(owner: string, name: string) {
  const commands = data.commands[
    owner as keyof typeof data.commands
  ] as Readonly<Record<string, ManagedValuationAssumptionsCommand>>;
  return (
    commands[name] ??
    data.domainCommands.find((item) => item.name === name)!.command
  );
}
function invalidCommand(name: string): ManagedValuationAssumptionsCommand {
  return data.invalidCommands.find((item) => item.name === name)!
    .command as ManagedValuationAssumptionsCommand;
}

describe("fixed invented valuation storage proof data", () => {
  it("binds fourteen phase ceilings, fixed principals and exact plan identity", () => {
    expect(VALUATION_PROOF_TARGET.databaseId).toBe(
      "investment_managed_valuation_v1",
    );
    expect(
      Object.values(VALUATION_PROOF_PRINCIPALS).map((item) => item.userId),
    ).toEqual([
      "proof-valuation-v1-a",
      "proof-valuation-v1-b",
      "proof-valuation-v1-size",
    ]);
    expect(VALUATION_PROOF_PHASES).toEqual([
      "schema",
      "preflight",
      "create-isolation",
      "stale",
      "prestage",
      "overlap",
      "rollback",
      "unknown",
      "capacity",
      "domain-guards",
      "historical-edit-and-catalog-review",
      "reopen",
      "remove",
      "reopen-empty",
    ]);
    expect(
      VALUATION_PROOF_PHASES.map((phase) => VALUATION_PROOF_LIMITS[phase]),
    ).toEqual([2, 18, 18, 14, 19, 19, 10, 9, 8, 15, 18, 6, 9, 2]);
    expect(VALUATION_PROOF_COMMANDS_SHA256).toBe(
      "6c5189011120932b84c8a7922c31ef5ed5d57e64031472278065dbd8629b515c",
    );
    expect(VALUATION_PROOF_PLAN_SHA256).toBe(
      "d0e99610b6ff92c11268a7d32102c0deaa680eed1b30b4a4bba9f697fa6ee40c",
    );
    expect(VALUATION_PROOF_CLOCKS.successful).toBe("actual_function_utc");
  });

  it("derives eighteen unique locations and thirteen final rows with explicit key aliases", () => {
    expect(VALUATION_PROOF_ROWS).toHaveLength(18);
    expect(new Set(VALUATION_PROOF_ROWS.map((row) => row.rowId)).size).toBe(18);
    expect(
      VALUATION_PROOF_ROWS.filter((row) => row.expectedPresentAfterProof),
    ).toHaveLength(13);
    for (const row of VALUATION_PROOF_ROWS)
      expect(
        valuationProofLocation(row.owner, row.name ?? undefined).rowId,
      ).toBe(row.rowId);
    expect(valuationProofLocation("a", "consumed-key-changed")).toEqual(
      valuationProofLocation("a", "create"),
    );
    for (const variant of data.domainCommands)
      expect(valuationProofLocation("a", variant.name)).toEqual(
        valuationProofLocation("a", "catalog-refused"),
      );
    expect(valuationProofLocation("b", "create")).not.toEqual(
      valuationProofLocation("a", "create"),
    );
    expect(valuationProofLocation("a", "catalog-reviewed").rowId).toBe(
      "rd8ec93250e971d3ea121d84a2b8f4607",
    );
    expect(() => valuationProofLocation("b", "catalog-refused")).toThrow(
      "Unknown fixed valuation proof location",
    );
    expect(() => valuationProofLocation("size", "create")).toThrow();
    expect(() => valuationProofLocation("a", "capacity")).toThrow();
    expect(VALUATION_PROOF_ROWS_SHA256).toBe(
      "af4dc1fe30e0cd1e9f45c27dcaa0be86ce8b1bb371e39f4999ec0b87e14f85df",
    );
    expect(hash(JSON.stringify(VALUATION_PROOF_ROWS))).toBe(
      VALUATION_PROOF_ROWS_SHA256,
    );
  });

  it.each(VALUATION_PROOF_CATALOG_PINS)(
    "independently admits canonical $name source bytes without a catalog test port",
    (pin) => {
      const snapshot = VALUATION_PROOF_SNAPSHOTS[pin.name];
      expect(Buffer.byteLength(snapshot)).toBe(pin.bytes);
      expect(hash(snapshot)).toBe(expectedCatalogHashes[pin.name]);
      const catalog = admitManagedSecurityMasterSnapshot({
        snapshot: new TextEncoder().encode(snapshot),
        expectedSha256: pin.sha256 as `sha256:${string}`,
      });
      const count = pin.name === "overflow" ? 21 : 20;
      expect(catalog.status).toBe("admitted_for_personal_managed_search");
      expect(catalog.coverage).toMatchObject({
        activeListings: count,
        activeEligibleSecurities: count,
        issuers: count,
        providerMappings: count * 2,
        basis: "synthetic_engineering_only_not_real_universe",
      });
      const port = {
        original: data.catalog,
        revised: data.revisedCatalog,
        rebound: data.reboundCatalog,
        overflow: data.overflowCatalog,
      }[pin.name];
      for (const item of data.commands.size.capacity.payload.entries) {
        const found = lookupPersonalSecurityMasterListing(
          catalog,
          item.listing.listingId,
        )!;
        const { cik, ...listing } = port.lookup(item.listing.listingId)!;
        expect(cik).toBe(found.cik);
        for (const [key, value] of Object.entries(listing))
          expect(found[key as keyof typeof found]).toBe(value);
      }
      expect(port.lookup("unknown-fixed-listing")).toBeNull();
    },
  );

  it("separates reviewed display changes and a stable rebound without transferring raw input maps", () => {
    const before = data.commands.a["historical-edit"].payload.entries[0]!;
    const after = data.commands.a["catalog-reviewed"].payload.entries[0]!;
    expect(after.dcf).toEqual(before.dcf);
    expect(after.exit).toEqual(before.exit);
    expect(after.cik).toBe(before.cik);
    expect(after.catalogSnapshotSha256).toBe(
      data.revisedCatalog.snapshotSha256,
    );
    expect(after.listing).toEqual({
      ...before.listing,
      issuerName: "Revised invented issuer · 東京",
      symbol: "REVISED00",
    });
    const rebound = data.reboundCatalog.lookup(before.listing.listingId)!;
    expect(rebound.securityId).not.toBe(before.listing.securityId);
    expect(rebound.listingId).toBe(before.listing.listingId);
    expect(deeplyFrozen(data)).toBe(true);
    expect(deeplyFrozen(VALUATION_PROOF_ROWS)).toBe(true);
    expect(() =>
      Reflect.set(after.dcf.inputs, "waccPercent", "changed"),
    ).not.toThrow();
    expect(Reflect.set(after.dcf.inputs, "waccPercent", "changed")).toBe(false);
  });

  it.each(VALUATION_PROOF_COMMAND_PINS)(
    "binds full $owner/$name request, canonical payload and row key",
    (pin) => {
      const command = namedCommand(pin.owner, pin.name);
      expect(parseManagedValuationAssumptionsCommand(command)).toEqual(command);
      const payload = encodeValuationAssumptionsPayload(command.payload);
      expect(Buffer.byteLength(payload)).toBe(pin.payloadBytes);
      expect(hash(payload)).toBe(pin.payloadSha256);
      expect(hash(command.idempotencyKey)).toBe(pin.keySha256);
      expect(command.expectedVersion).toBe(pin.expectedVersion);
      expect(command.idempotencyKey).toBe(pin.idempotencyKey);
      expect(Buffer.byteLength(JSON.stringify(command))).toBe(pin.commandBytes);
      expect(hash(JSON.stringify(command))).toBe(pin.commandSha256);
      expect(
        hash(
          JSON.stringify({
            expectedVersion: command.expectedVersion,
            resource: "valuation-assumptions",
            id: "main",
            operation: "put",
            payloadSha256: hash(payload),
          }),
        ),
      ).toBe(pin.requestSha256);
      const namespace = [
        VALUATION_PROOF_PRINCIPALS[pin.owner].userId,
        "valuation-assumptions",
        "main",
        command.idempotencyKey,
      ];
      expect(valuationProofLocation(pin.owner, pin.name).rowId).toBe(
        `r${hash(JSON.stringify(namespace)).slice(0, 32)}`,
      );
    },
  );

  it("retains exact prepared 262144-byte Unicode capacity and isolates the one-byte overflow", () => {
    const payload = data.commands.size.capacity.payload;
    const text = encodeValuationAssumptionsPayload(payload);
    expect(Buffer.byteLength(text)).toBe(262144);
    expect(hash(text)).toBe(
      "60db8dfa71de789887cb4e7ac27cb5a8bbf9336e1c1abee0997def40ef3af240",
    );
    expect(
      new Set(payload.entries.map((item) => item.listing.listingId)).size,
    ).toBe(20);
    expect(text).toContain(" Café 東京 📈 unfinished:-. \\n");
    expect(parseValuationAssumptionsPayload(JSON.parse(text))).toEqual(payload);
    const overflow = invalidCommand("payload-bytes-262145").payload;
    expect(Buffer.byteLength(JSON.stringify(overflow))).toBe(262145);
    expect(
      overflow.entries.every((item) => parseValuationAssumptionEntry(item)),
    ).toBe(true);
    expect(parseValuationAssumptionsPayload(overflow)).toBeNull();
    const tooLong = invalidCommand("input-codepoints-513").payload.entries[0]!
      .dcf.inputs.startingUnleveredCashFlowUsd;
    expect([...tooLong]).toHaveLength(513);
    expect(tooLong.length).toBe(514);
    const twentyOne = invalidCommand("entries-21").payload;
    expect(
      new Set(twentyOne.entries.map((item) => item.listing.listingId)).size,
    ).toBe(21);
    expect(
      twentyOne.entries.every((item) => parseValuationAssumptionEntry(item)),
    ).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(twentyOne))).toBeLessThan(262144);
  });

  it.each(data.invalidCommands)(
    "refuses malformed $name before any store call",
    async ({ command }) => {
      const f = fixture();
      expect(parseManagedValuationAssumptionsCommand(command)).toBeNull();
      await expect(
        f.original.put(A, command as ManagedValuationAssumptionsCommand),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(f.store.calls).toEqual([]);
      expect(f.store.rows.size).toBe(0);
    },
  );

  it.each(data.domainCommands)(
    "refuses schema-valid $name at catalog policy without consuming the shared key",
    async (variant) => {
      const f = fixture();
      await seedVersionFive(f);
      const before = JSON.stringify([...f.store.rows]);
      const offset = f.store.calls.length;
      expect(variant.catalog).toBe("revised");
      expect(parseManagedValuationAssumptionsCommand(variant.command)).toEqual(
        variant.command,
      );
      await expect(f.revised.put(A, variant.command)).rejects.toMatchObject({
        code: "invalid_request",
      });
      expect(f.store.calls.slice(offset).map((call) => call.operation)).toEqual(
        ["getRow", "getRow"],
      );
      expect(JSON.stringify([...f.store.rows])).toBe(before);
    },
  );

  it("preserves original replay, historical edits, reviewed metadata and explicit removal through the actual local repository", async () => {
    const f = fixture();
    await seedVersionFive(f);
    expect((await f.revised.put(A, data.commands.a.create)).replayed).toBe(
      true,
    );
    await expect(
      f.revised.put(A, data.commands.a["consumed-key-changed"]),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect((await f.revised.get(A))?.version).toBe(5);
    expect(
      (await f.revised.put(A, data.commands.a["historical-edit"])).version,
    ).toBe(6);
    expect(
      (await f.revised.put(A, data.commands.a["catalog-reviewed"])).version,
    ).toBe(7);
    expect((await f.revised.put(A, data.commands.a.remove)).version).toBe(8);
    await f.original.put(VALUATION_PROOF_PRINCIPALS.b, data.commands.b.create);
    await f.original.put(
      VALUATION_PROOF_PRINCIPALS.size,
      data.commands.size.capacity,
    );
    expect((await f.revised.get(A))?.payload.entries).toEqual([]);
    expect(
      (await f.original.get(VALUATION_PROOF_PRINCIPALS.b))?.payload,
    ).toEqual(data.commands.b.create.payload);
    expect(
      (await f.original.get(VALUATION_PROOF_PRINCIPALS.size))?.payload,
    ).toEqual(data.commands.size.capacity.payload);
    expect(f.store.rows.size).toBe(13);
    expect([...f.store.rows.values()].map((row) => row.$id).sort()).toEqual(
      VALUATION_PROOF_ROWS.filter((row) => row.expectedPresentAfterProof)
        .map((row) => row.rowId)
        .sort(),
    );
  });
});
