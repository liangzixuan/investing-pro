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
  followupsProofData,
} from "./research-followups-proof-data";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
describe("fixed invented proof bytes", () => {
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
