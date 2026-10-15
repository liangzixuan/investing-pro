import { createHash } from "node:crypto";
import {
  encodeResearchFollowupsPayload,
  parseResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  FOLLOWUPS_PROOF_CATALOG_HASH,
  FOLLOWUPS_PROOF_REVISED_HASH,
  FOLLOWUPS_PROOF_REVISED_SNAPSHOT,
  FOLLOWUPS_PROOF_SNAPSHOT,
  FOLLOWUPS_PROOF_COMMAND_PINS,
  FOLLOWUPS_PROOF_ROWS,
  FOLLOWUPS_PROOF_PRINCIPALS,
  FOLLOWUPS_PROOF_PLAN_SHA256,
  FOLLOWUPS_PROOF_PHASES,
  FOLLOWUPS_PROOF_LIMITS,
  FOLLOWUPS_PROOF_EXPECTED_CALLS,
  FOLLOWUPS_PROOF_TARGET,
  followupsProofData,
} from "./research-followups-proof-data";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
describe("fixed invented proof bytes", () => {
  it("fixes three new principals and all18 locations outside the consumed cohort", () => {
    expect(
      Object.values(FOLLOWUPS_PROOF_PRINCIPALS).map(({ userId }) => userId),
    ).toEqual([
      "proof-followups-observed-v3-a",
      "proof-followups-observed-v3-b",
      "proof-followups-observed-v3-size",
    ]);
    const previous = new Set(
      FOLLOWUPS_PROOF_ROWS.map(({ owner, name }) => {
        const namespace = [
          `proof-followups-b03a64a-${owner}`,
          "research-followups",
          "main",
        ];
        return (
          (name ? "r" : "f") +
          hash(
            JSON.stringify(
              name
                ? [...namespace, `proof-followups-b03a64a-${name}-v1`]
                : namespace,
            ),
          ).slice(0, 32)
        );
      }),
    );
    expect(previous.size).toBe(18);
    expect(FOLLOWUPS_PROOF_ROWS).toHaveLength(18);
    expect(
      FOLLOWUPS_PROOF_ROWS.every(({ rowId }) => !previous.has(rowId)),
    ).toBe(true);
  });
  it("binds a disjoint v3 cohort and a different compiled plan from consumed v2", () => {
    const consumedPrincipals = {
      a: "proof-followups-prestage-v2-a",
      b: "proof-followups-prestage-v2-b",
      size: "proof-followups-prestage-v2-size",
    } as const;
    const consumedRows = FOLLOWUPS_PROOF_ROWS.map((row) => {
      const namespace = [
        consumedPrincipals[row.owner],
        "research-followups",
        "main",
      ];
      return {
        ...row,
        rowId:
          (row.name ? "r" : "f") +
          hash(
            JSON.stringify(
              row.name
                ? [...namespace, `proof-followups-b03a64a-${row.name}-v1`]
                : namespace,
            ),
          ).slice(0, 32),
      };
    });
    expect(new Set(consumedRows.map(({ rowId }) => rowId)).size).toBe(18);
    const consumedIds = new Set(consumedRows.map(({ rowId }) => rowId));
    expect(
      FOLLOWUPS_PROOF_ROWS.every(({ rowId }) => !consumedIds.has(rowId)),
    ).toBe(true);
    const consumedUserIds = new Set<string>(Object.values(consumedPrincipals));
    expect(
      Object.values(FOLLOWUPS_PROOF_PRINCIPALS).every(
        ({ userId }) => !consumedUserIds.has(userId),
      ),
    ).toBe(true);
    expect(
      FOLLOWUPS_PROOF_ROWS.filter(({ tableId }) => tableId === "followups"),
    ).toHaveLength(3);
    expect(
      FOLLOWUPS_PROOF_ROWS.filter(({ tableId }) => tableId === "receipts"),
    ).toHaveLength(15);
    expect(FOLLOWUPS_PROOF_ROWS.map(({ owner }) => owner)).toEqual([
      "a",
      "b",
      "size",
      ...Array<string>(9).fill("a"),
      "b",
      ...Array<string>(5).fill("size"),
    ]);
    expect(
      FOLLOWUPS_PROOF_ROWS.every(({ rowId }) =>
        /^[fr][a-f0-9]{32}$/u.test(rowId),
      ),
    ).toBe(true);
    expect(FOLLOWUPS_PROOF_PHASES).toHaveLength(11);
    expect(
      Object.values(FOLLOWUPS_PROOF_LIMITS).reduce(
        (sum, limit) => sum + limit,
        0,
      ),
    ).toBe(156);
    expect(
      Object.values(FOLLOWUPS_PROOF_EXPECTED_CALLS).reduce(
        (sum, calls) => sum + calls,
        0,
      ),
    ).toBe(128);
    const plan = {
      version: 1,
      target: FOLLOWUPS_PROOF_TARGET,
      phases: FOLLOWUPS_PROOF_PHASES,
      limits: FOLLOWUPS_PROOF_LIMITS,
      calls: FOLLOWUPS_PROOF_EXPECTED_CALLS,
      rows: FOLLOWUPS_PROOF_ROWS,
      commands: FOLLOWUPS_PROOF_COMMAND_PINS,
      catalog: FOLLOWUPS_PROOF_CATALOG_HASH,
      revised: FOLLOWUPS_PROOF_REVISED_HASH,
      successfulClock: "actual_function_utc",
      refusedClock: "2000-01-01T00:00:00.000Z",
      refusedCompletion: "9999-12-31",
    };
    expect(hash(JSON.stringify(plan))).toBe(FOLLOWUPS_PROOF_PLAN_SHA256);
    expect(hash(JSON.stringify({ ...plan, rows: consumedRows }))).not.toBe(
      FOLLOWUPS_PROOF_PLAN_SHA256,
    );
  });
  it("admits both exact canonical snapshots and independently binds all command bytes and request digests", () => {
    const { commands, catalog, revisedCatalog } = followupsProofData();
    expect(Buffer.byteLength(FOLLOWUPS_PROOF_SNAPSHOT)).toBe(78842);
    expect(FOLLOWUPS_PROOF_SNAPSHOT.endsWith("\n")).toBe(true);
    expect(`sha256:${hash(FOLLOWUPS_PROOF_SNAPSHOT)}`).toBe(
      FOLLOWUPS_PROOF_CATALOG_HASH,
    );
    expect(`sha256:${hash(FOLLOWUPS_PROOF_REVISED_SNAPSHOT)}`).toBe(
      FOLLOWUPS_PROOF_REVISED_HASH,
    );
    expect(catalog.snapshotSha256).not.toBe(revisedCatalog.snapshotSha256);
    for (const pin of FOLLOWUPS_PROOF_COMMAND_PINS) {
      const command = commands[pin.name];
      const bytes = JSON.stringify(command),
        payload = encodeResearchFollowupsPayload(command.payload);
      expect(Buffer.byteLength(bytes), pin.name).toBe(pin.commandBytes);
      expect(hash(bytes), pin.name).toBe(pin.commandSha256);
      expect(hash(payload), pin.name).toBe(pin.payloadSha256);
      expect(
        hash(
          JSON.stringify({
            expectedVersion: command.expectedVersion,
            resource: "research-followups",
            id: "main",
            operation: "put",
            payloadSha256: hash(payload),
          }),
        ),
        pin.name,
      ).toBe(pin.requestSha256);
    }
    expect(commands.future.payload.entries[0]?.completedOn).toBe("9999-12-31");
    expect(FOLLOWUPS_PROOF_ROWS).toHaveLength(18);
    expect(new Set(FOLLOWUPS_PROOF_ROWS.map((row) => row.rowId)).size).toBe(18);
  });
  it("separates admitted current-catalog capacity from a saved-shape byte-only boundary", () => {
    const { commands, over } = followupsProofData();
    expect(
      Buffer.byteLength(
        encodeResearchFollowupsPayload(commands.capacity.payload),
      ),
    ).toBe(250191);
    expect(Buffer.byteLength(JSON.stringify(over))).toBe(262145);
    expect(parseResearchFollowupsPayload(over)).toBeNull();
    const exact = structuredClone(over);
    exact.entries.at(-1)!.listing.issuerName = exact.entries
      .at(-1)!
      .listing.issuerName.slice(0, -1);
    expect(Buffer.byteLength(JSON.stringify(exact))).toBe(262144);
    expect(parseResearchFollowupsPayload(exact)).not.toBeNull();
  });
});
