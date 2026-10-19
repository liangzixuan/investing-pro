import { createHash } from "node:crypto";
import { MockAgent } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeValuationAssumptionsPayload } from "@research-cockpit/contracts";
import { createValuationAssumptionsProofFunction } from "./valuation-assumptions-proof-entry";
import {
  VALUATION_PROOF_PLAN_SHA256,
  VALUATION_PROOF_PRINCIPALS,
  VALUATION_PROOF_TARGET,
  valuationProofData,
  valuationProofLocation,
} from "./valuation-assumptions-proof-data";
import type { ValuationProofReport } from "./valuation-assumptions-storage-proof-types";
import type { createAppwriteTransport } from "./appwrite-transport";
import type * as TransportModule from "./appwrite-transport";

const mock = vi.hoisted(() => ({
  agent: undefined as MockAgent | undefined,
  opened: [] as ReturnType<typeof createAppwriteTransport>[],
}));
vi.mock("./appwrite-transport", async (original) => {
  const actual = await original<typeof TransportModule>();
  return {
    ...actual,
    createAppwriteTransport: (
      options: Parameters<typeof createAppwriteTransport>[0],
    ) => {
      if (!mock.agent) throw new Error("Test dispatcher missing");
      const transport = actual.createAppwriteTransport({
        ...options,
        dispatcher: mock.agent,
      });
      mock.opened.push(transport);
      return transport;
    },
  };
});
class OwnedMockAgent extends MockAgent {
  override destroy(): Promise<void> {
    return this.close();
  }
}
const BUILD = "d".repeat(64);
const KEY = "invented-wire-proof-authority";
const TIME = "2026-10-19T00:00:00.000Z";
function currentRow() {
  const payloadJson = encodeValuationAssumptionsPayload(
    valuationProofData().commands.a.remove.payload,
  );
  return {
    $id: valuationProofLocation("a").rowId,
    $databaseId: VALUATION_PROOF_TARGET.databaseId,
    $tableId: VALUATION_PROOF_TARGET.currentTableId,
    $sequence: "1",
    $createdAt: TIME,
    $updatedAt: TIME,
    $permissions: [],
    ownerId: VALUATION_PROOF_PRINCIPALS.a.userId,
    resourceId: "main",
    version: 8,
    payloadJson,
    digestSha256: createHash("sha256").update(payloadJson).digest("hex"),
    createdAt: TIME,
    updatedAt: TIME,
  };
}
async function reopen(row: Record<string, unknown>) {
  const agent = new OwnedMockAgent();
  agent.disableNetConnect();
  mock.agent = agent;
  const location = valuationProofLocation("a");
  agent
    .get(new URL(VALUATION_PROOF_TARGET.endpoint).origin)
    .intercept({
      path: `/v1/tablesdb/${location.databaseId}/tables/${location.tableId}/rows/${location.rowId}`,
      method: "GET",
      headers: {
        "x-appwrite-project": VALUATION_PROOF_TARGET.project,
        "x-appwrite-key": KEY,
      },
    })
    .reply(200, row, { headers: { "content-type": "application/json" } })
    .delay(1);
  const responses: { body: unknown; status: number; headers: unknown }[] = [];
  await createValuationAssumptionsProofFunction(BUILD)({
    req: {
      method: "POST",
      path: "/proof/reopen-empty",
      queryString: "",
      bodyText: "",
      bodyBinary: Buffer.alloc(0),
      headers: { "x-appwrite-key": KEY },
    },
    res: {
      json: (body, status, headers) => {
        responses.push({ body, status, headers });
      },
    },
  });
  agent.assertNoPendingInterceptors();
  expect(responses).toHaveLength(1);
  expect(mock.opened).toHaveLength(1);
  expect(mock.opened[0]!.snapshot()).toMatchObject({
    requests: 1,
    closed: true,
  });
  expect(responses[0]!.headers).toEqual({ "cache-control": "no-store" });
  expect(JSON.stringify(responses)).not.toContain(KEY);
  return responses[0]!;
}
afterEach(async () => {
  for (const transport of mock.opened) await transport.close();
  mock.opened = [];
  mock.agent = undefined;
});

describe("complete valuation proof entry through the real SDK and bounded transport", () => {
  it("admits a fresh canonical empty collection from exactly one fixed GET", async () => {
    const row = currentRow();
    const response = await reopen(row);
    expect(response.status).toBe(200);
    const report = response.body as ValuationProofReport;
    expect(report).toMatchObject({
      buildProof: BUILD,
      planSha256: VALUATION_PROOF_PLAN_SHA256,
      phase: "reopen-empty",
      outcome: "passed",
      failure: "none",
      operationCount: 1,
      metadataCount: 0,
      httpDispatches: 1,
      closed: true,
      observedVersion: 8,
      currentRecords: [
        {
          rowId: row.$id,
          version: 8,
          digestSha256: row.digestSha256,
          createdAt: TIME,
          updatedAt: TIME,
        },
      ],
      receipts: [],
    });
    expect(report.checks).toContain(
      "fresh_invocation_empty_collection_retained",
    );
    expect(report.rowFingerprints).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain(row.ownerId);
    expect(JSON.stringify(report)).not.toContain("payloadJson");
    expect(Object.isFrozen(report)).toBe(true);
  });
  it.each([
    { ownerId: "different-invented-principal" },
    { digestSha256: "0".repeat(64) },
    { extra: "unadmitted wire property" },
  ])(
    "refuses an invalid returned row without retry or leaked contents: %j",
    async (patch) => {
      const response = await reopen({ ...currentRow(), ...patch });
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        outcome: "failed",
        failure: "operation_failed",
        repositoryError: "unavailable",
        operationCount: 1,
        httpDispatches: 1,
        closed: true,
        currentRecords: [],
      });
      expect(JSON.stringify(response.body)).not.toContain(
        "different-invented-principal",
      );
      expect(JSON.stringify(response.body)).not.toContain(
        "unadmitted wire property",
      );
    },
  );
});
