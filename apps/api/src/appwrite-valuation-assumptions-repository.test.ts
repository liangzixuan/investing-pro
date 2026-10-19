import { createHash } from "node:crypto";
import { AppwriteException } from "node-appwrite";
import { describe, expect, it } from "vitest";
import {
  encodeValuationAssumptionsPayload,
  type ManagedValuationAssumptionsCommand,
  type ValuationAssumptionEntry,
} from "@research-cockpit/contracts";
import { createAppwriteValuationAssumptionsRepository } from "./appwrite-valuation-assumptions-repository";
import { createAppwriteResearchFollowupsRepository } from "./appwrite-research-followups-repository";
import { AtomicStore } from "./test-appwrite-atomic-store";
import {
  inventedValuationCatalog as catalog,
  valuationAssumptionEntry,
} from "./test-valuation-assumptions-fixture";
import {
  createManagedCatalogService,
  createManagedValuationAssumptionsCatalog,
  getManagedWorkspaceCatalog,
} from "./managed-workspace-catalog";

const owner = { userId: "invented-valuation-owner" };
const other = { userId: "invented-valuation-other" };
const time = "2026-10-19T12:00:00.000Z";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fixture() {
  const current = catalog();
  const store = new AtomicStore();
  let now = time;
  const options = {
    store,
    databaseId: "invented-valuations",
    assumptionsTableId: "assumptions",
    receiptsTableId: "receipts",
    catalog: current,
    now: () => new Date(now),
  };
  const repository = createAppwriteValuationAssumptionsRepository(options);
  const command = (
    expectedVersion = 0,
    key = "first",
    entries: readonly ValuationAssumptionEntry[] = [
      valuationAssumptionEntry(current),
    ],
  ): ManagedValuationAssumptionsCommand => ({
    expectedVersion,
    idempotencyKey: `invented-valuation-${key}`,
    payload: { schemaVersion: 1, entries },
  });
  return {
    current,
    store,
    options,
    repository,
    command,
    row: () => store.current(owner.userId, "assumptions"),
    setTime(value: string) {
      now = value;
    },
  };
}
function changedInput(
  entry: ValuationAssumptionEntry,
  text = "still invalid 1e",
) {
  return {
    ...entry,
    dcf: { ...entry.dcf, inputs: { ...entry.dcf.inputs, waccPercent: text } },
  };
}
describe("atomic managed valuation assumptions", () => {
  it("saves and reopens with the fixed catalog port while refusing a foreign CIK", async () => {
    const f = fixture();
    const current = createManagedValuationAssumptionsCatalog();
    const listingId = createManagedCatalogService()
      .search("AAPL")!
      .results.find((row) => row.symbol === "AAPL")!.listingId;
    const entry = valuationAssumptionEntry(current, listingId);
    const options = { ...f.options, catalog: current };
    const repository = createAppwriteValuationAssumptionsRepository(options);
    await expect(
      repository.put(
        owner,
        f.command(0, "foreign", [{ ...entry, cik: "9999999999" }]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.store.rows.size).toBe(0);
    const command = f.command(0, "public-catalog", [entry]);
    await repository.put(owner, command);
    const reopened = createAppwriteValuationAssumptionsRepository(options);
    expect((await reopened.get(owner))?.payload).toEqual(command.payload);
    expect(entry.cik).toBe("0000320193");
  });
  it("reads absence without a row, creates canonical frozen authored inputs and updates using increment CAS", async () => {
    const f = fixture();
    expect(await f.repository.get(owner)).toBeNull();
    expect(f.store.rows.size).toBe(0);
    const first = f.command();
    const receipt = await f.repository.put(owner, first);
    expect(receipt).toEqual({
      id: "main",
      version: 1,
      digestSha256: hash(encodeValuationAssumptionsPayload(first.payload)),
      committedAt: time,
      replayed: false,
    });
    expect(f.row()).toMatchObject({
      ownerId: owner.userId,
      resourceId: "main",
      version: 1,
      payloadJson: encodeValuationAssumptionsPayload(first.payload),
      $permissions: [],
      $id:
        "v" +
        hash(
          JSON.stringify([owner.userId, "valuation-assumptions", "main"]),
        ).slice(0, 32),
    });
    const saved = await f.repository.get(owner);
    expect(saved?.payload).toEqual(first.payload);
    expect(Object.isFrozen(saved)).toBe(true);
    expect(
      Object.isFrozen(saved?.payload.entries[0]?.dcf.inputs.scenarios.base),
    ).toBe(true);
    await f.repository.put(
      owner,
      f.command(1, "second", [changedInput(first.payload.entries[0]!)]),
    );
    expect(f.row().version).toBe(2);
    expect(
      f.store.calls.filter((call) => call.operation === "incrementRowColumn"),
    ).toMatchObject([{ input: { column: "version", value: 1, max: 2 } }]);
    for (const call of f.store.calls.filter(
      (call) => call.operation === "updateRow",
    ))
      expect(call.input).not.toHaveProperty("data.version");
    expect(f.store.receipts()).toHaveLength(2);
  });
  it("replays exact original receipt before newer version, changed catalog and rollback clock", async () => {
    const f = fixture(),
      first = f.command();
    const committed = await f.repository.put(owner, first);
    await f.repository.put(
      owner,
      f.command(1, "second", [changedInput(first.payload.entries[0]!)]),
    );
    f.setTime("2026-01-01T00:00:00.000Z");
    const fresh = createAppwriteValuationAssumptionsRepository({
      ...f.options,
      catalog: catalog("New display name"),
    });
    const calls = f.store.calls.length;
    expect(await fresh.put(owner, first)).toEqual({
      ...committed,
      replayed: true,
    });
    expect(f.store.calls.slice(calls).map((call) => call.operation)).toEqual([
      "getRow",
    ]);
    expect(f.row().version).toBe(2);
  });
  it("refuses changed content for a consumed key and stale version without mutation", async () => {
    const f = fixture(),
      first = f.command();
    await f.repository.put(owner, first);
    await expect(
      f.repository.put(
        owner,
        f.command(0, "first", [changedInput(first.payload.entries[0]!)]),
      ),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
    await expect(
      f.repository.put(owner, f.command(0, "stale")),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(f.row().version).toBe(1);
    expect(f.store.receipts()).toHaveLength(1);
  });
  it("keeps concurrent updates atomic and preserves the winning assumptions", async () => {
    const f = fixture();
    await f.repository.put(owner, f.command());
    const winner = f.command(1, "winner", [
      changedInput(valuationAssumptionEntry(f.current), "winner text"),
    ]);
    f.store.beforeCommit = async () => {
      await f.repository.put(owner, winner);
    };
    await expect(
      f.repository.put(owner, f.command(1, "loser")),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await f.repository.get(owner))?.payload).toEqual(winner.payload);
    expect(f.row().version).toBe(2);
    expect(f.store.receipts()).toHaveLength(2);
  });
  it("separates principal and fourth-kind namespaces even with shared tables and idempotency keys", async () => {
    const f = fixture(),
      input = f.command(0, "same", []);
    const followups = createAppwriteResearchFollowupsRepository({
      ...f.options,
      catalog: getManagedWorkspaceCatalog(),
      followupsTableId: "assumptions",
    });
    await followups.put(owner, {
      ...input,
      payload: { schemaVersion: 1, entries: [] },
    });
    await f.repository.put(owner, input);
    await f.repository.put(other, input);
    expect(f.store.rows.size).toBe(6);
    expect(new Set([...f.store.rows.values()].map((row) => row.$id)).size).toBe(
      6,
    );
    expect(await f.repository.get({ userId: "absent-owner" })).toBeNull();
    expect((await followups.get(owner))?.version).toBe(1);
    const receipt = f.store.receipts().find(
      (row) =>
        row.requestDigest ===
        hash(
          JSON.stringify({
            expectedVersion: 0,
            resource: "valuation-assumptions",
            id: "main",
            operation: "put",
            payloadSha256: hash(
              encodeValuationAssumptionsPayload(input.payload),
            ),
          }),
        ),
    )!;
    expect(receipt).toBeDefined();
    const valuationRow = [...f.store.rows.values()].find(
      (row) =>
        row.$id ===
        "v" +
          hash(
            JSON.stringify([owner.userId, "valuation-assumptions", "main"]),
          ).slice(0, 32),
    )!;
    valuationRow.ownerId = other.userId;
    await expect(f.repository.get(owner)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it.each(["exchangeMic", "issuerId", "securityId", "shareClassId"] as const)(
    "refuses a retained %s transfer before a transaction",
    async (field) => {
      const f = fixture(),
        entry = valuationAssumptionEntry(f.current);
      await f.repository.put(owner, f.command());
      const changed = {
        ...entry,
        listing: {
          ...entry.listing,
          [field]: field === "exchangeMic" ? "OTCM" : "foreign-id",
        },
      };
      const calls = f.store.calls.length;
      await expect(
        f.repository.put(owner, f.command(1, "transfer", [changed])),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(f.store.calls.slice(calls).map((call) => call.operation)).toEqual([
        "getRow",
        "getRow",
      ]);
      expect(f.row().version).toBe(1);
    },
  );
  it("requires fresh exact catalog/CIK claims but permits nullable claims", async () => {
    const f = fixture(),
      entry = valuationAssumptionEntry(f.current);
    await expect(
      f.repository.put(
        owner,
        f.command(0, "wrong-cik", [{ ...entry, cik: "9999999999" }]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      f.repository.put(
        owner,
        f.command(0, "stale", [
          { ...entry, catalogSnapshotSha256: `sha256:${"f".repeat(64)}` },
        ]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await f.repository.put(
      owner,
      f.command(0, "null", [{ ...entry, cik: null }]),
    );
    await expect(
      f.repository.put(
        owner,
        f.command(1, "wrong-upgrade", [{ ...entry, cik: "9999999999" }]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(
      await f.repository.put(owner, f.command(1, "known", [entry])),
    ).toMatchObject({ version: 2 });
  });
  it("retains historical authored inputs, requires exact catalog review and allows explicit removal", async () => {
    const f = fixture(),
      first = f.command();
    await f.repository.put(owner, first);
    const revised = catalog("Reviewed name");
    const repository = createAppwriteValuationAssumptionsRepository({
      ...f.options,
      catalog: revised,
    });
    const retained = changedInput(first.payload.entries[0]!);
    await repository.put(owner, f.command(1, "retained", [retained]));
    expect((await repository.get(owner))?.payload.entries[0]).toEqual(retained);
    const falseReview = {
      ...retained,
      catalogSnapshotSha256: revised.snapshotSha256,
    };
    await expect(
      repository.put(owner, f.command(2, "false-review", [falseReview])),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const reviewed = {
      ...retained,
      catalogSnapshotSha256: revised.snapshotSha256,
      listing: valuationAssumptionEntry(revised).listing,
    };
    await repository.put(owner, f.command(2, "reviewed", [reviewed]));
    expect((await repository.get(owner))?.payload.entries[0]?.dcf).toEqual(
      retained.dcf,
    );
    await repository.put(owner, f.command(3, "remove", []));
    expect((await repository.get(owner))?.payload.entries).toEqual([]);
  });
  it.each(["lost-before", "lost-after", "malformed-after"] as const)(
    "preserves %s commit uncertainty and permits explicit exact reconciliation",
    async (outcome) => {
      const f = fixture(),
        input = f.command();
      f.store.commitOutcome = outcome;
      await expect(f.repository.put(owner, input)).rejects.toMatchObject({
        code: "commit_unknown",
      });
      f.store.commitOutcome = "normal";
      const receipt = await f.repository.put(owner, input);
      expect(receipt).toMatchObject({
        version: 1,
        replayed: outcome !== "lost-before",
      });
      expect(f.store.receipts()).toHaveLength(1);
      expect(f.row().version).toBe(1);
    },
  );
  it("keeps primary precommit error when rollback fails and does not leak upstream data", async () => {
    const f = fixture();
    f.store.fail = {
      operation: "createRow",
      error: new AppwriteException("private upstream body", 403),
    };
    f.store.rollbackFails = true;
    await expect(f.repository.put(owner, f.command())).rejects.toMatchObject({
      code: "access_denied",
      message: "access_denied",
    });
    expect(f.store.rows.size).toBe(0);
  });
  it("rejects corrupt current bytes, claimed CIK and unsupported model versions", async () => {
    const f = fixture();
    await f.repository.put(owner, f.command());
    const row = f.row(),
      original = String(row.payloadJson);
    for (const mutate of [
      (value: Record<string, unknown>) => {
        value.cik = "9999999999";
      },
      (value: Record<string, unknown>) => {
        (value.dcf as Record<string, unknown>).modelVersion = "unsupported";
      },
    ]) {
      const value = JSON.parse(original) as {
        entries: Record<string, unknown>[];
      };
      mutate(value.entries[0]!);
      row.payloadJson = JSON.stringify(value);
      row.digestSha256 = hash(String(row.payloadJson));
      await expect(f.repository.get(owner)).rejects.toMatchObject({
        code: "invalid_response",
      });
    }
  });
  it("rejects bad principal/config/command before a store operation", async () => {
    const f = fixture();
    expect(() =>
      createAppwriteValuationAssumptionsRepository({
        ...f.options,
        receiptsTableId: "assumptions",
      }),
    ).toThrow("invalid_request");
    await expect(
      f.repository.get({ userId: "invalid user" }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      f.repository.put(owner, { ...f.command(), expectedVersion: -1 }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.store.calls).toEqual([]);
  });
});
