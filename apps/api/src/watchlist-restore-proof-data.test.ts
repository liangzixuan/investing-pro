import { createHash } from "node:crypto";
import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  WATCHLIST_RESTORE_PROOF_COMMAND_PINS,
  WATCHLIST_RESTORE_PROOF_LIMITS,
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_PLAN_SHA256,
  WATCHLIST_RESTORE_PROOF_PRINCIPAL,
  WATCHLIST_RESTORE_PROOF_ROWS,
  WATCHLIST_RESTORE_PROOF_TARGET,
  watchlistRestoreProofData,
  watchlistRestoreProofLocation,
} from "./watchlist-restore-proof-data";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
describe("closed Watchlist restore proof data", () => {
  it("binds distinct fixed databases, eight known locations and four finite phases", () => {
    expect(WATCHLIST_RESTORE_PROOF_TARGET).toEqual({
      endpoint: "https://nyc.cloud.appwrite.io/v1",
      project: "6abac57a0007b7c1a671",
      sourceDatabaseId: "investment_backup_watchlist_v1",
      restoredDatabaseId: "investment_restore_watchlist_v1",
      currentTableId: "watchlists",
      receiptsTableId: "receipts",
    });
    expect(WATCHLIST_RESTORE_PROOF_PHASES).toEqual([
      "preflight",
      "seed",
      "verify-restored",
      "verify-source",
    ]);
    expect(
      Object.values(WATCHLIST_RESTORE_PROOF_LIMITS).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(51);
    expect(WATCHLIST_RESTORE_PROOF_ROWS).toHaveLength(8);
    expect(
      new Set(
        WATCHLIST_RESTORE_PROOF_ROWS.map((row) =>
          JSON.stringify([row.databaseId, row.tableId, row.rowId]),
        ),
      ).size,
    ).toBe(8);
    for (const side of ["source", "restored"] as const) {
      expect(watchlistRestoreProofLocation(side).rowId).toBe(
        "w" +
          hash(
            JSON.stringify([WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId, "main"]),
          ).slice(0, 32),
      );
      for (const version of [1, 2, 3] as const) {
        const key =
          watchlistRestoreProofData().commands[version - 1]!.idempotencyKey;
        expect(watchlistRestoreProofLocation(side, version).rowId).toBe(
          "r" +
            hash(
              JSON.stringify([
                WATCHLIST_RESTORE_PROOF_PRINCIPAL.userId,
                "main",
                key,
              ]),
            ).slice(0, 32),
        );
      }
    }
    expect(WATCHLIST_RESTORE_PROOF_PLAN_SHA256).toMatch(/^[a-f0-9]{64}$/u);
  });
  it("has canonical independent notes/order, exact command digests and fixed application times", () => {
    const data = watchlistRestoreProofData();
    expect(data.commands).toHaveLength(3);
    for (const [index, command] of data.commands.entries()) {
      const pin = WATCHLIST_RESTORE_PROOF_COMMAND_PINS[index]!;
      const payload = encodeMainWatchlistPayload(command.payload);
      expect(isMainWatchlistPayload(command.payload)).toBe(true);
      expect(pin).toMatchObject({
        version: index + 1,
        expectedVersion: index,
        payloadJson: payload,
        payloadBytes: Buffer.byteLength(payload),
        keySha256: hash(command.idempotencyKey),
        payloadSha256: hash(payload),
        commandSha256: hash(JSON.stringify(command)),
        requestSha256: hash(
          JSON.stringify({
            expectedVersion: index,
            id: "main",
            operation: "put",
            payloadSha256: hash(payload),
          }),
        ),
        committedAt: `2026-10-18T00:00:0${index + 1}.000Z`,
      });
      expect(command.payload.memberships).toHaveLength(2);
      expect(command.payload.memberships[0]!.note).toContain("café 東京 📈 · ");
    }
    expect(
      data.commands[1]!.payload.memberships.map((member) => member.listingId),
    ).toEqual(
      data.commands[0]!.payload.memberships.map(
        (member) => member.listingId,
      ).reverse(),
    );
    expect(Object.isFrozen(data.commands[0]!.payload.memberships[0])).toBe(
      true,
    );
    expect(() => {
      (
        data.commands[0]!.payload.memberships[0]! as unknown as Record<
          string,
          unknown
        >
      ).note = "changed";
    }).toThrow();
  });
});
