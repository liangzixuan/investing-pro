import { createHash } from "node:crypto";

import {
  encodeMainWatchlistPayload,
  encodeResearchFollowupsPayload,
  parseManagedResearchFollowupsCommand,
  parseResearchFollowupsPayload,
  type ResearchFollowup,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import {
  admitPersonalSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  type PersonalSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import { AppwriteException, TablesDB } from "node-appwrite";
import { MockAgent } from "undici";
import { describe, expect, it, vi } from "vitest";

import {
  createAppwriteResearchFollowupsRepository,
  type AppwriteResearchFollowupsRepositoryOptions,
} from "./appwrite-research-followups-repository";
import { createAppwriteTransport } from "./appwrite-transport";
import { appwriteVersionedRowStore } from "./appwrite-versioned-row-store";
import { createAppwriteWatchlistRepository } from "./appwrite-watchlist-repository";
import {
  ResearchFollowupsRepositoryError,
  type PutResearchFollowupsCommand,
} from "./research-followups-repository";
import { AtomicStore, type Input } from "./test-appwrite-atomic-store";
import {
  bindTestSecurityMasterDocument,
  buildMutableTestSecurityMasterDocument,
  type MutableSecurityMasterDocument,
} from "./test-personal-security-master-builder";

const OWNER = { userId: "synthetic-owner" };
const OTHER = { userId: "synthetic-other" };
const TIME = "2026-10-15T12:00:00.000Z";
const ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function catalog(change?: (value: MutableSecurityMasterDocument) => void) {
  const value = buildMutableTestSecurityMasterDocument(3);
  change?.(value);
  return admitPersonalSecurityMasterSnapshot(
    bindTestSecurityMasterDocument(value),
  );
}

function entry(
  current: PersonalSecurityMasterCatalog,
  listingId = "lst-00000",
  id = ID,
): ResearchFollowup {
  const result = lookupPersonalSecurityMasterListing(current, listingId);
  if (result === null) throw new Error("Missing invented catalog listing");
  return {
    id,
    catalogSnapshotSha256: current.snapshotSha256,
    listing: {
      country: result.country,
      exchangeMic: result.exchangeMic,
      instrumentType: result.instrumentType,
      issuerId: result.issuerId,
      issuerName: result.issuerName,
      listingId: result.listingId,
      securityId: result.securityId,
      securityName: result.securityName,
      shareClassId: result.shareClassId,
      shareClassName: result.shareClassName,
      symbol: result.symbol,
    },
    check: "Review capacity and the dated filing · Café 東京 📈",
    dueOn: "2026-12-31",
    status: "open",
    completedOn: null,
    result: "",
  };
}

function fixture(current = catalog()) {
  const store = new AtomicStore();
  let actualTime = TIME;
  const options: AppwriteResearchFollowupsRepositoryOptions = {
    store,
    databaseId: "synthetic-followups",
    followupsTableId: "followups",
    receiptsTableId: "receipts",
    catalog: current,
    now: () => new Date(actualTime),
  };
  const repository = createAppwriteResearchFollowupsRepository(options);
  const command = (
    expectedVersion = 0,
    key = "first",
    entries: readonly ResearchFollowup[] = [entry(current)],
  ): PutResearchFollowupsCommand => ({
    expectedVersion,
    idempotencyKey: `invented-followup-${key}`,
    payload: { schemaVersion: 1, entries },
  });
  return {
    store,
    options,
    repository,
    command,
    current: () => store.current(OWNER.userId, "followups"),
    setTime(value: string) {
      actualTime = value;
    },
  };
}

function changedCatalog() {
  return catalog((value) => {
    value.issuers[0]!.issuerName = "Reviewed issuer name";
    value.records[0]!.securityName = "Reviewed security name";
  });
}

function missingCatalog() {
  return catalog((value) => {
    for (const record of value.records) {
      const listing = record.shareClasses[0]!.listings[0]!;
      const previousId = listing.listingId;
      listing.listingId = `${String(previousId)}-current`;
      for (const period of listing.tickerHistory)
        period.listingId = listing.listingId;
      for (const mapping of value.providerMappings)
        if (
          mapping.mappingKind === "listing" &&
          mapping.targetId === previousId
        )
          mapping.targetId = listing.listingId;
    }
  });
}

function updateStoredPayload(
  row: Record<string, unknown>,
  change: (payload: ResearchFollowupsPayload) => void,
) {
  const payload = JSON.parse(
    row.payloadJson as string,
  ) as ResearchFollowupsPayload;
  change(payload);
  row.payloadJson = JSON.stringify(payload);
  row.digestSha256 = hash(row.payloadJson as string);
}

describe("Appwrite research follow-ups repository", () => {
  it("reads absence without creating rows, then captures canonical private data and preserves CAS", async () => {
    const f = fixture();
    expect(await f.repository.get(OWNER)).toBeNull();
    expect(f.store.rows.size).toBe(0);
    const first = f.command();
    const receipt = await f.repository.put(OWNER, first);
    const json = encodeResearchFollowupsPayload(first.payload);
    const digest = hash(json);
    expect(receipt).toEqual({
      id: "main",
      version: 1,
      digestSha256: digest,
      committedAt: TIME,
      replayed: false,
    });
    expect(f.current()).toMatchObject({
      ownerId: OWNER.userId,
      resourceId: "main",
      payloadJson: json,
      digestSha256: digest,
      version: 1,
      createdAt: TIME,
      updatedAt: TIME,
      $permissions: [],
      $id:
        "f" +
        hash(
          JSON.stringify([OWNER.userId, "research-followups", "main"]),
        ).slice(0, 32),
    });
    const storedReceipt = f.store.receipts()[0]!;
    expect(storedReceipt).toMatchObject({
      $id:
        "r" +
        hash(
          JSON.stringify([
            OWNER.userId,
            "research-followups",
            "main",
            first.idempotencyKey,
          ]),
        ).slice(0, 32),
      keyDigest: hash(first.idempotencyKey),
      requestDigest: hash(
        JSON.stringify({
          expectedVersion: 0,
          resource: "research-followups",
          id: "main",
          operation: "put",
          payloadSha256: digest,
        }),
      ),
      resourceId: "main",
      $permissions: [],
    });
    expect(f.current()).not.toHaveProperty("watchlistId");
    const read = await f.repository.get(OWNER);
    expect(read?.payload).toEqual(first.payload);
    for (const value of [
      read,
      read?.payload,
      read?.payload.entries,
      read?.payload.entries[0],
      read?.payload.entries[0]?.listing,
      receipt,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    const updated = {
      ...entry(f.options.catalog as PersonalSecurityMasterCatalog),
      check: "Changed exact check",
    };
    await f.repository.put(OWNER, f.command(1, "second", [updated]));
    expect(f.current().version).toBe(2);
    expect(f.store.receipts()).toHaveLength(2);
    expect(
      f.store.calls.filter((call) => call.operation === "incrementRowColumn"),
    ).toMatchObject([{ input: { column: "version", value: 1, max: 2 } }]);
    for (const call of f.store.calls.filter(
      (call) => call.operation === "updateRow",
    ))
      expect((call.input as Input<"updateRow">).data).not.toHaveProperty(
        "version",
      );
    expect(
      f.store.calls
        .filter((call) => call.operation === "createRow")
        .every(
          (call) => (call.input as Input<"createRow">).permissions.length === 0,
        ),
    ).toBe(true);
  });

  it("keeps principal and resource namespaces separate even with shared tables and keys", async () => {
    const f = fixture();
    const shared = createAppwriteResearchFollowupsRepository({
      ...f.options,
      followupsTableId: "watchlists",
    });
    const watchlist = createAppwriteWatchlistRepository({
      ...f.options,
      watchlistsTableId: "watchlists",
    });
    const first = f.command();
    const followup = first.payload.entries[0]!;
    const watchlistPayload = {
      schemaVersion: 1 as const,
      name: "My Watchlist" as const,
      snapshotSha256: f.options.catalog.snapshotSha256,
      memberships: [{ ...followup.listing, note: "Separate invented note" }],
    };
    await watchlist.put(OWNER, { ...first, payload: watchlistPayload });
    await shared.put(OWNER, first);
    await shared.put(OTHER, first);
    expect(f.store.rows.size).toBe(6);
    expect(new Set([...f.store.rows.values()].map((row) => row.$id)).size).toBe(
      6,
    );
    const oldRow = [...f.store.rows.values()].find(
      (row) => row.watchlistId === "main" && row.payloadJson,
    );
    expect(oldRow?.$id).toBe(
      "w" + hash(JSON.stringify([OWNER.userId, "main"])).slice(0, 32),
    );
    expect(
      f.store.receipts().find((row) => row.watchlistId === "main")
        ?.requestDigest,
    ).toBe(
      hash(
        JSON.stringify({
          expectedVersion: 0,
          id: "main",
          operation: "put",
          payloadSha256: hash(encodeMainWatchlistPayload(watchlistPayload)),
        }),
      ),
    );
    expect(await shared.get(OWNER)).toMatchObject({ payload: first.payload });
    expect(await shared.get(OTHER)).toMatchObject({ payload: first.payload });
    const ownerRow = [...f.store.rows.values()].find(
      (row) =>
        row.resourceId === "main" &&
        row.ownerId === OWNER.userId &&
        row.payloadJson,
    )!;
    ownerRow.ownerId = OTHER.userId;
    await expect(shared.get(OWNER)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("saves a stale retained identity with a new current entry without consulting watchlist storage", async () => {
    const f = fixture();
    const original = f.command();
    await f.repository.put(OWNER, original);
    const current = missingCatalog();
    const repository = createAppwriteResearchFollowupsRepository({
      ...f.options,
      catalog: current,
    });
    const retained = {
      ...original.payload.entries[0]!,
      check: "Retained missing listing is still authored",
      result: "Saved result",
    };
    const fresh = entry(current, "lst-00001-current", OTHER_ID);
    const input = f.command(1, "mixed", [retained, fresh]);
    expect(await repository.put(OWNER, input)).toMatchObject({ version: 2 });
    expect((await repository.get(OWNER))?.payload).toEqual(input.payload);
    const locations = f.store.calls.filter(
      (call) =>
        call.operation === "getRow" ||
        call.operation === "createRow" ||
        call.operation === "updateRow",
    );
    expect(
      locations.every((call) =>
        ["followups", "receipts"].includes(
          (call.input as Input<"getRow">).tableId,
        ),
      ),
    ).toBe(true);
    await repository.put(OWNER, f.command(2, "remove", []));
    expect((await repository.get(OWNER))?.payload.entries).toEqual([]);
  });

  it("permits only exact current-catalog metadata review for the same stable identity", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const current = changedCatalog();
    const repository = createAppwriteResearchFollowupsRepository({
      ...f.options,
      catalog: current,
    });
    const revised = entry(current);
    expect(
      await repository.put(OWNER, f.command(1, "review", [revised])),
    ).toMatchObject({ version: 2 });
    expect((await repository.get(OWNER))?.payload.entries[0]).toEqual(revised);
  });

  it.each([
    ["exchangeMic", "XNYS"],
    ["instrumentType", "common_stock"],
    ["listingId", "lst-00001"],
    ["issuerId", "iss-00001"],
    ["securityId", "sec-00001"],
    ["shareClassId", "shr-00001"],
  ] as const)(
    "refuses retained stable %s reassignment before a transaction",
    async (field, value) => {
      const f = fixture();
      await f.repository.put(OWNER, f.command());
      const retained = structuredClone(f.command().payload.entries[0]!);
      Object.assign(retained.listing, { [field]: value });
      const start = f.store.calls.length;
      await expect(
        f.repository.put(OWNER, f.command(1, "rebind", [retained])),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(f.store.calls.slice(start).map((call) => call.operation)).toEqual([
        "getRow",
        "getRow",
      ]);
      expect(f.current().version).toBe(1);
    },
  );

  it("rejects rebinding an existing ID even to a fully admitted different listing", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    await expect(
      f.repository.put(
        OWNER,
        f.command(1, "rebind", [
          entry(
            f.options.catalog as PersonalSecurityMasterCatalog,
            "lst-00001",
          ),
        ]),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const newId = entry(
      f.options.catalog as PersonalSecurityMasterCatalog,
      "lst-00001",
      OTHER_ID,
    );
    await expect(
      f.repository.put(OWNER, f.command(1, "new-id", [newId])),
    ).resolves.toMatchObject({ version: 2 });
  });

  it.each([
    "new-stale",
    "changed-digest",
    "forged-name",
    "duplicate-listing",
    "invalid-country",
  ] as const)("refuses %s without a transaction", async (kind) => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const current = changedCatalog();
    const repository = createAppwriteResearchFollowupsRepository({
      ...f.options,
      catalog: current,
    });
    const old = f.command().payload.entries[0]!;
    const revised = structuredClone(entry(current));
    let entries: ResearchFollowup[] = [revised];
    if (kind === "new-stale") entries = [{ ...old, id: OTHER_ID }];
    if (kind === "changed-digest")
      entries = [{ ...old, catalogSnapshotSha256: current.snapshotSha256 }];
    if (kind === "forged-name")
      Object.assign(revised.listing, { issuerName: "Not the catalog name" });
    if (kind === "duplicate-listing")
      entries = [revised, { ...revised, id: OTHER_ID }];
    if (kind === "invalid-country")
      Object.assign(revised.listing, { country: "CA" });
    const before = f.store.calls.length;
    await expect(
      repository.put(OWNER, f.command(1, kind, entries)),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(
      f.store.calls
        .slice(before)
        .some((call) => call.operation === "createTransaction"),
    ).toBe(false);
    expect(f.current().version).toBe(1);
  });

  it("accepts today's completion, preserves future retained fields on read, and rejects changed future completion", async () => {
    const f = fixture();
    const completed: ResearchFollowup = {
      ...entry(f.options.catalog as PersonalSecurityMasterCatalog),
      status: "completed",
      completedOn: "2026-10-15",
      result: "Authored conclusion",
    };
    await f.repository.put(OWNER, f.command(0, "complete", [completed]));
    const future: ResearchFollowup = {
      ...completed,
      completedOn: "2026-10-16",
    };
    const before = f.store.calls.length;
    await expect(
      f.repository.put(OWNER, f.command(1, "future", [future])),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(f.store.calls.slice(before).map((call) => call.operation)).toEqual([
      "getRow",
      "getRow",
    ]);
    await f.repository.put(
      OWNER,
      f.command(1, "result", [
        { ...completed, result: "Updated authored result" },
      ]),
    );
    f.setTime("2026-10-14T12:00:00.000Z");
    expect(
      (await f.repository.get(OWNER))?.payload.entries[0]?.completedOn,
    ).toBe("2026-10-15");
    const rollbackStart = f.store.calls.length;
    await expect(
      f.repository.put(OWNER, f.command(2, "rollback-clock", [completed])),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(
      f.store.calls.slice(rollbackStart).map((call) => call.operation),
    ).toEqual(["getRow", "getRow"]);
    f.setTime(TIME);
    const reopen: ResearchFollowup = {
      ...completed,
      status: "open",
      completedOn: null,
    };
    await f.repository.put(OWNER, f.command(2, "reopen", [reopen]));
    await expect(
      f.repository.put(OWNER, f.command(3, "future-again", [future])),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect((await f.repository.get(OWNER))?.payload.entries[0]).toEqual(reopen);
  });

  it("allows an unchanged retained future completion field when the storage clock is valid", async () => {
    const f = fixture();
    const completed: ResearchFollowup = {
      ...entry(f.options.catalog as PersonalSecurityMasterCatalog),
      status: "completed",
      completedOn: "2026-10-16",
    };
    f.setTime("2026-10-16T12:00:00.000Z");
    await f.repository.put(OWNER, f.command(0, "complete", [completed]));
    // Model a previously valid completion and monotonic storage timestamps after a day-clock correction.
    f.current().createdAt = "2026-10-14T12:00:00.000Z";
    f.current().updatedAt = "2026-10-14T12:00:00.000Z";
    f.setTime(TIME);
    await expect(
      f.repository.put(
        OWNER,
        f.command(1, "retained", [
          { ...completed, result: "Unchanged completion date" },
        ]),
      ),
    ).resolves.toMatchObject({ version: 2, committedAt: TIME });
  });

  it.each(["2026-10-16", "9999-12-31"])(
    "refuses a new future completion %s before transaction creation",
    async (completedOn) => {
      const f = fixture();
      const completed: ResearchFollowup = {
        ...f.command().payload.entries[0]!,
        status: "completed",
        completedOn,
      };
      await expect(
        f.repository.put(OWNER, f.command(0, "future-new", [completed])),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(f.store.calls.map((call) => call.operation)).toEqual([
        "getRow",
        "getRow",
      ]);
      expect(f.store.rows.size).toBe(0);
    },
  );

  it("replays the exact old receipt before catalog and clock checks after newer shared versions", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const second = f.command(1, "second", [
      { ...f.command().payload.entries[0]!, result: "Version two" },
    ]);
    const receipt = await f.repository.put(OWNER, second);
    await f.repository.put(
      OWNER,
      f.command(2, "third", [
        { ...second.payload.entries[0]!, result: "Version three" },
      ]),
    );
    f.setTime("2026-10-01T00:00:00.000Z");
    const changed = createAppwriteResearchFollowupsRepository({
      ...f.options,
      catalog: missingCatalog(),
    });
    const before = f.store.calls.length;
    expect(await changed.put(OWNER, second)).toEqual({
      ...receipt,
      replayed: true,
    });
    expect(f.store.calls.slice(before).map((call) => call.operation)).toEqual([
      "getRow",
    ]);
    expect((await changed.get(OWNER))?.version).toBe(3);
    await expect(
      changed.put(OWNER, {
        ...second,
        payload: { ...second.payload, entries: [] },
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict" });
  });

  it("captures the exact command before the first await", async () => {
    const f = fixture();
    const input = structuredClone(f.command());
    f.store.beforeRead = () => {
      Object.assign(input, {
        expectedVersion: 9,
        idempotencyKey: "mutated-command-key",
      });
      Object.assign(input.payload.entries[0]!, {
        check: "Mutated after capture",
      });
      Object.assign(input.payload.entries[0]!.listing, { symbol: "CHANGED" });
      return Promise.resolve();
    };
    expect(await f.repository.put(OWNER, input)).toMatchObject({ version: 1 });
    expect((await f.repository.get(OWNER))?.payload).toEqual(
      f.command().payload,
    );
  });

  it.each(["extra", "accessor", "hole", "oversize"] as const)(
    "rejects %s command before I/O",
    async (kind) => {
      const f = fixture();
      const input = structuredClone(f.command());
      if (kind === "extra") Object.assign(input, { ownerId: OTHER.userId });
      if (kind === "accessor")
        Object.defineProperty(input, "expectedVersion", {
          enumerable: true,
          get: () => {
            throw new Error("Must not read accessor");
          },
        });
      if (kind === "hole") Reflect.deleteProperty(input.payload.entries, 0);
      if (kind === "oversize")
        Object.assign(input.payload.entries[0]!, {
          result: "x".repeat(262_145),
        });
      await expect(f.repository.put(OWNER, input)).rejects.toBeInstanceOf(
        ResearchFollowupsRepositoryError,
      );
      expect(f.store.calls).toHaveLength(0);
    },
  );

  it("rejects an over-byte-cap combination of individually valid entries before any storage read", async () => {
    const f = fixture();
    const entries = Array.from({ length: 20 }, (_, index) => {
      const original = f.command().payload.entries[0]!;
      return {
        ...original,
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        listing: {
          ...original.listing,
          listingId: `listing-${index}`,
          issuerName: "😀".repeat(512),
          securityName: "😀".repeat(512),
          shareClassName: "😀".repeat(512),
        },
        check: "😀".repeat(500),
        result: "😀".repeat(2000),
      };
    });
    for (const value of entries)
      expect(
        parseResearchFollowupsPayload({ schemaVersion: 1, entries: [value] }),
      ).not.toBeNull();
    const command = f.command(0, "over-byte-cap", entries);
    expect(
      Buffer.byteLength(JSON.stringify(command.payload), "utf8"),
    ).toBeGreaterThan(262_144);
    await expect(f.repository.put(OWNER, command)).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(f.store.calls).toHaveLength(0);
  });

  it.each([
    "payload",
    "canonical",
    "digest",
    "version",
    "table",
    "row",
    "owner",
    "resource",
    "permissions",
    "extra",
    "time",
    "metadata-time",
    "current-identity",
  ] as const)("rejects malformed stored %s", async (kind) => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const row = f.current();
    if (kind === "payload") row.payloadJson = "{";
    if (kind === "canonical") {
      row.payloadJson = " " + String(row.payloadJson);
      row.digestSha256 = hash(row.payloadJson as string);
    }
    if (kind === "digest") row.digestSha256 = "0".repeat(64);
    if (kind === "version") row.version = Number.MAX_SAFE_INTEGER + 1;
    if (kind === "table") row.$tableId = "foreign";
    if (kind === "row") row.$id = "foreign";
    if (kind === "owner") row.ownerId = OTHER.userId;
    if (kind === "resource") row.resourceId = "other";
    if (kind === "permissions") row.$permissions = ['read("any")'];
    if (kind === "extra") row.extra = "unknown";
    if (kind === "time") row.updatedAt = "2026-02-30T12:00:00.000Z";
    if (kind === "metadata-time")
      row.$createdAt = "2026-02-30T12:00:00.000000+00:00";
    if (kind === "current-identity")
      updateStoredPayload(row, (payload) =>
        Object.assign(payload.entries[0]!.listing, {
          issuerName: "Forged catalog identity",
        }),
      );
    await expect(f.repository.get(OWNER)).rejects.toMatchObject({
      name: "ResearchFollowupsRepositoryError",
      code: "invalid_response",
    });
  });

  it.each([
    "ownerId",
    "resourceId",
    "keyDigest",
    "requestDigest",
    "digestSha256",
    "version",
    "committedAt",
    "$permissions",
    "extra",
  ] as const)("refuses forged receipt %s", async (field) => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    f.store.receipts()[0]![field] =
      field === "$permissions" ? ['read("any")'] : "invalid";
    await expect(f.repository.put(OWNER, f.command())).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(f.current().version).toBe(1);
  });

  it.each(["version", "digestSha256"] as const)(
    "rejects shape-valid mismatched receipt %s",
    async (field) => {
      const f = fixture();
      await f.repository.put(OWNER, f.command());
      f.store.receipts()[0]![field] = field === "version" ? 2 : "0".repeat(64);
      await expect(f.repository.put(OWNER, f.command())).rejects.toMatchObject({
        code: "invalid_response",
      });
    },
  );

  it("rechecks receipt before declaring a stale version and opens no transaction", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const before = f.store.calls.length;
    await expect(
      f.repository.put(OWNER, f.command(0, "stale")),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(f.store.calls.slice(before).map((call) => call.operation)).toEqual([
      "getRow",
      "getRow",
      "getRow",
    ]);
    expect(f.store.transactions.size).toBe(0);
  });

  it("requires a matching current version before classifying retained entries", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    const forged = {
      ...f.command().payload.entries[0]!,
      catalogSnapshotSha256: `sha256:${"0".repeat(64)}` as const,
    };
    const before = f.store.calls.length;
    await expect(
      f.repository.put(OWNER, f.command(0, "wrong-base", [forged])),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(f.store.calls.slice(before).map((call) => call.operation)).toEqual([
      "getRow",
      "getRow",
      "getRow",
    ]);
  });

  it.each([false, true])(
    "keeps one atomic winner for competing creation, identical=%s",
    async (same) => {
      const f = fixture();
      const a = f.command();
      const b = same
        ? a
        : f.command(0, "other", [
            { ...a.payload.entries[0]!, check: "Other authored command" },
          ]);
      const outcomes = await Promise.allSettled([
        f.repository.put(OWNER, a),
        f.repository.put(OWNER, b),
      ]);
      expect(
        outcomes.filter((value) => value.status === "fulfilled"),
      ).toHaveLength(same ? 2 : 1);
      const failure = outcomes.find((value) => value.status === "rejected");
      if (!same)
        expect(failure).toMatchObject({ reason: { code: "conflict" } });
      expect(f.current().version).toBe(1);
      expect(f.store.receipts()).toHaveLength(1);
    },
  );

  it("uses the receipt if a same-key commit occurs between receipt and current lookup", async () => {
    const f = fixture();
    const get = f.store.getRow.bind(f.store);
    let reads = 0;
    const spy = vi
      .spyOn(f.store, "getRow")
      .mockImplementation(async (input) => {
        if (++reads === 2) await f.repository.put(OWNER, f.command());
        return get(input);
      });
    try {
      expect(await f.repository.put(OWNER, f.command())).toMatchObject({
        version: 1,
        replayed: true,
      });
      expect(f.store.receipts()).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it.each([false, true])(
    "reconciles a late CAS maximum using the exact receipt, same-key=%s",
    async (same) => {
      const f = fixture();
      await f.repository.put(OWNER, f.command());
      const input = f.command(1, "loser");
      f.store.beforeIncrement = () =>
        f.repository
          .put(OWNER, same ? input : f.command(1, "winner"))
          .then(() => undefined);
      const result = f.repository.put(OWNER, input);
      if (same)
        await expect(result).resolves.toMatchObject({
          version: 2,
          replayed: true,
        });
      else await expect(result).rejects.toMatchObject({ code: "conflict" });
      expect(f.current().version).toBe(2);
      expect(f.store.receipts()).toHaveLength(2);
    },
  );

  it("preserves the primary finite error when staging and rollback fail", async () => {
    const f = fixture();
    f.store.fail = {
      operation: "createRow",
      error: new AppwriteException("Private upstream record", 403),
    };
    f.store.rollbackFails = true;
    await expect(f.repository.put(OWNER, f.command())).rejects.toMatchObject({
      code: "access_denied",
      message: "access_denied",
    });
    expect(f.store.rows.size).toBe(0);
    expect(f.store.calls.at(-1)?.input).toMatchObject({ rollback: true });
  });

  it.each(["lost-after", "malformed-after"] as const)(
    "retains %s commit uncertainty then replays without another transaction",
    async (outcome) => {
      const f = fixture();
      f.store.commitOutcome = outcome;
      await expect(f.repository.put(OWNER, f.command())).rejects.toMatchObject({
        code: "commit_unknown",
      });
      const before = f.store.calls.length;
      f.store.commitOutcome = "normal";
      await expect(f.repository.put(OWNER, f.command())).resolves.toMatchObject(
        { version: 1, replayed: true },
      );
      expect(f.store.calls.slice(before).map((call) => call.operation)).toEqual(
        ["getRow"],
      );
      expect(
        f.store.calls.filter(
          (call) =>
            call.operation === "updateTransaction" &&
            (call.input as Input<"updateTransaction">).rollback,
        ),
      ).toHaveLength(0);
    },
  );

  it("does not roll back an uncertain unacknowledged commit, and allows only one later winner", async () => {
    const f = fixture();
    f.store.commitOutcome = "lost-before";
    await expect(f.repository.put(OWNER, f.command())).rejects.toMatchObject({
      code: "commit_unknown",
    });
    const pending = [...f.store.transactions.keys()][0]!;
    f.store.commitOutcome = "normal";
    await f.repository.put(OWNER, f.command());
    await expect(
      f.store.updateTransaction({ transactionId: pending, commit: true }),
    ).rejects.toMatchObject({ code: 409 });
    expect(f.store.receipts()).toHaveLength(1);
  });

  it.each(["same", "different", "advanced"] as const)(
    "reconciles only a typed commit limit against %s evidence",
    async (kind) => {
      const f = fixture();
      await f.repository.put(OWNER, f.command());
      const input = f.command(1, "target");
      f.store.beforeCommit = async () => {
        const winner =
          kind === "same"
            ? input
            : kind === "different"
              ? { ...input, payload: { ...input.payload, entries: [] } }
              : f.command(1, "winner");
        await f.repository.put(OWNER, winner);
        throw new AppwriteException(
          "Private response",
          400,
          "attribute_limit_exceeded",
        );
      };
      const result = f.repository.put(OWNER, input);
      if (kind === "same")
        await expect(result).resolves.toMatchObject({
          version: 2,
          replayed: true,
        });
      else
        await expect(result).rejects.toMatchObject({
          code: kind === "different" ? "idempotency_conflict" : "conflict",
        });
      expect(f.current().version).toBe(2);
      expect(
        f.store.calls.filter(
          (call) =>
            call.operation === "updateTransaction" &&
            (call.input as Input<"updateTransaction">).rollback,
        ),
      ).toHaveLength(0);
    },
  );

  it.each(["no-advance", "receipt-unreadable", "current-unreadable"] as const)(
    "preserves typed-limit uncertainty with %s",
    async (kind) => {
      const f = fixture();
      await f.repository.put(OWNER, f.command());
      f.store.beforeCommit = () => {
        const failRead = () => {
          f.store.fail = {
            operation: "getRow",
            error: new AppwriteException("Private", 503),
          };
        };
        if (kind === "receipt-unreadable") failRead();
        if (kind === "current-unreadable")
          f.store.beforeRead = () => {
            failRead();
            return Promise.resolve();
          };
        throw new AppwriteException("Private", 400, "attribute_limit_exceeded");
      };
      await expect(
        f.repository.put(OWNER, f.command(1, "target")),
      ).rejects.toMatchObject({ code: "commit_unknown" });
      expect(f.current().version).toBe(1);
    },
  );

  it("does not call an unrelated increment400 a conflict without observed advance", async () => {
    const f = fixture();
    await f.repository.put(OWNER, f.command());
    f.store.fail = {
      operation: "incrementRowColumn",
      error: new AppwriteException("Invalid column", 400),
    };
    await expect(
      f.repository.put(OWNER, f.command(1, "invalid")),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(f.current().version).toBe(1);
  });

  it.each(["database_not_found", "table_not_found", "general_route_not_found"])(
    "does not treat %s404 as absence",
    async (type) => {
      const f = fixture();
      f.store.fail = {
        operation: "getRow",
        error: new AppwriteException("Private", 404, type),
      };
      await expect(f.repository.get(OWNER)).rejects.toMatchObject({
        code: "unavailable",
      });
    },
  );

  it("validates trusted table configuration and principal before I/O", async () => {
    const f = fixture();
    expect(() =>
      createAppwriteResearchFollowupsRepository({
        ...f.options,
        receiptsTableId: "followups",
      }),
    ).toThrow("invalid_request");
    expect(() =>
      createAppwriteResearchFollowupsRepository({
        ...f.options,
        databaseId: "../other",
      }),
    ).toThrow("invalid_request");
    await expect(
      f.repository.put({ userId: "../owner" }, f.command()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const forgedPrincipal = { ...OWNER, ownerId: "forged" };
    await expect(f.repository.get(forgedPrincipal)).rejects.toMatchObject({
      code: "invalid_request",
    });
    expect(f.store.calls).toHaveLength(0);
  });

  it.each(["success", "malformed-commit", "aborted-commit"] as const)(
    "keeps the real bounded SDK transport path explicit for %s",
    async (outcome) => {
      const f = fixture();
      // The production transport owns destroy(); this mock exposes only close().
      class OwnedMockAgent extends MockAgent {
        override destroy(): Promise<void> {
          return this.close();
        }
      }
      const dispatcher = new OwnedMockAgent();
      dispatcher.disableNetConnect();
      const controller = new AbortController();
      const transport = createAppwriteTransport({
        endpoint: "https://synthetic.invalid/v1",
        dispatcher,
        signal: controller.signal,
      });
      const pool = dispatcher.get("https://synthetic.invalid");
      const paths: string[] = [];
      const sdkCall = vi.spyOn(transport.client, "call");
      const base = "/v1/tablesdb/synthetic-followups/tables";
      const currentId =
        "f" +
        hash(
          JSON.stringify([OWNER.userId, "research-followups", "main"]),
        ).slice(0, 32);
      const receiptId =
        "r" +
        hash(
          JSON.stringify([
            OWNER.userId,
            "research-followups",
            "main",
            f.command().idempotencyKey,
          ]),
        ).slice(0, 32);
      const replies = [
        {
          method: "GET",
          path: `${base}/receipts/rows/${receiptId}`,
          code: 404,
          data: {
            message: "Invented absent",
            code: 404,
            type: "row_not_found",
          },
        },
        {
          method: "GET",
          path: `${base}/followups/rows/${currentId}`,
          code: 404,
          data: {
            message: "Invented absent",
            code: 404,
            type: "row_not_found",
          },
        },
        {
          method: "POST",
          path: "/v1/tablesdb/transactions",
          code: 200,
          data: { $id: "synthetic-transaction", status: "pending" },
        },
        { method: "POST", path: `${base}/followups/rows`, code: 200, data: {} },
        { method: "POST", path: `${base}/receipts/rows`, code: 200, data: {} },
        {
          method: "PATCH",
          path: "/v1/tablesdb/transactions/synthetic-transaction",
          code: 200,
          data:
            outcome === "malformed-commit"
              ? "{"
              : { $id: "synthetic-transaction", status: "committed" },
        },
      ];
      for (const [index, reply] of replies.entries())
        pool
          .intercept({ method: reply.method, path: reply.path })
          .reply((request) => {
            paths.push(request.path);
            if (index === 5 && outcome === "aborted-commit")
              queueMicrotask(() => controller.abort());
            return {
              statusCode: reply.code,
              data: reply.data,
              responseOptions: {
                headers: { "content-type": "application/json" },
              },
            };
          });
      try {
        transport.client
          .setProject("synthetic-project")
          .setKey("invented-execution-key");
        const repository = createAppwriteResearchFollowupsRepository({
          ...f.options,
          store: appwriteVersionedRowStore(new TablesDB(transport.client)),
        });
        const result = repository.put(OWNER, f.command());
        if (outcome === "success")
          await expect(result).resolves.toMatchObject({
            version: 1,
            replayed: false,
          });
        else
          await expect(result).rejects.toMatchObject({
            code: "commit_unknown",
            message: "commit_unknown",
          });
        expect(paths).toEqual(replies.map((value) => value.path));
        for (const index of [3, 4])
          expect(sdkCall.mock.calls[index]?.[3]).toMatchObject({
            transactionId: "synthetic-transaction",
            permissions: [],
            data: { ownerId: OWNER.userId, resourceId: "main", version: 1 },
          });
        expect(transport.snapshot().requests).toBe(6);
        dispatcher.assertNoPendingInterceptors();
      } finally {
        await transport.close();
        sdkCall.mockRestore();
        expect(paths).toEqual(replies.map((value) => value.path));
      }
    },
  );

  it("uses the frozen strict command contract directly", () => {
    const f = fixture();
    const parsed = parseManagedResearchFollowupsCommand(f.command());
    expect(parsed).not.toBeNull();
    expect(parsed?.payload).toEqual(f.command().payload);
    expect(Object.isFrozen(parsed?.payload.entries[0]?.listing)).toBe(true);
  });
});
