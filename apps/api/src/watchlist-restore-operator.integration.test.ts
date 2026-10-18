import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as ArtifactModule from "./restore-operator-artifact";
import {
  admitRestoreOperatorArtifact,
  restoreOperatorEvidenceDigest,
  WATCHLIST_RESTORE_ARCHIVE,
} from "./restore-operator-artifact";
import {
  createFileRestoreOperatorJournal,
  type RestoreOperatorIntent,
} from "./restore-operator-journal";
import {
  createWatchlistRestoreOperator,
  WATCHLIST_RESTORE_OPERATOR_PLAN_SHA256,
  type WatchlistRestoreOperatorResult,
} from "./watchlist-restore-operator";
import { WATCHLIST_RESTORE_OPERATOR_BUILD_PROOF as BUILD } from "./watchlist-restore-operator-function";
import {
  WATCHLIST_RESTORE_PROOF_PHASES,
  WATCHLIST_RESTORE_PROOF_TARGET as TARGET,
} from "./watchlist-restore-proof-data";
import {
  ARCHIVE,
  DEPLOYMENT,
  KEY,
  RESTORATION,
  watchlistRestoreOperatorFixture,
  type OfflineRequest,
} from "./test-watchlist-restore-operator-fixture";

// Public CI cannot include the pinned local archive. Only its byte admission is
// replaced. SDK, transport, journal, schema, receipts and proof decoders are real.
// Invented provider replies and copied rows do not establish cloud restore behavior.
vi.mock("./restore-operator-artifact", async (importOriginal) => {
  const actual = await importOriginal<typeof ArtifactModule>();
  return {
    ...actual,
    admitRestoreOperatorArtifact: vi.fn((bytes: Uint8Array) =>
      Buffer.from(bytes),
    ),
  };
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
  vi.mocked(admitRestoreOperatorArtifact).mockClear();
});

async function setup(corruptRestoredReceipt = false) {
  const root = await mkdtemp(join(tmpdir(), "watchlist-restore-integration-"));
  cleanup.push(async () => {
    const checked = resolve(root);
    expect(checked.startsWith(resolve(tmpdir()) + sep)).toBe(true);
    expect(checked.split(sep).at(-1)).toMatch(
      /^watchlist-restore-integration-/u,
    );
    await rm(checked, { recursive: true, force: true });
  });
  const fixture = watchlistRestoreOperatorFixture({ corruptRestoredReceipt });
  cleanup.push(() => fixture.transport.close());
  const directory = join(root, "one-use-attempt");
  const journal = createFileRestoreOperatorJournal({ directory });
  const intent: RestoreOperatorIntent = {
    attemptId: "invented-integration-attempt",
    controllerRevision: "a".repeat(40),
    reviewedPlanSha256: WATCHLIST_RESTORE_OPERATOR_PLAN_SHA256,
    approvalRecordSha256: "b".repeat(64),
    expiresAt: "2026-10-18T01:00:00.000Z",
    endpoint: TARGET.endpoint,
    projectId: TARGET.project,
    archiveSha256: WATCHLIST_RESTORE_ARCHIVE.sha256,
    buildProof: BUILD,
  };
  const archive = Buffer.from("invented test-only archive bytes");
  const operator = createWatchlistRestoreOperator({
    intent,
    review: {
      controllerRevision: intent.controllerRevision,
      reviewedPlanSha256: intent.reviewedPlanSha256,
      approvalRecordSha256: intent.approvalRecordSha256,
      allowanceAccepted: true,
      retentionAccepted: true,
      maximumAdditionalSpend: 0,
    },
    archive,
    journal,
    key: KEY,
    transportFactory: () => fixture.transport,
    now: () => Date.parse("2026-10-18T00:00:00.000Z"),
    wait: fixture.wait,
  });
  const document = async (filename: string): Promise<Record<string, unknown>> =>
    JSON.parse(await readFile(join(directory, filename), "utf8")) as Record<
      string,
      unknown
    >;
  return {
    ...fixture,
    fixture,
    directory,
    intent,
    archive,
    operator,
    document,
  };
}

type Integration = Awaited<ReturnType<typeof setup>>;

function assertSuccessIdentity(
  f: Integration,
  result: WatchlistRestoreOperatorResult,
) {
  expect(f.errors).toEqual([]);
  expect(result).toEqual({
    outcome: "passed",
    reason: "none",
    steps: 59,
    requests: 59,
    mutationMayHaveCommitted: true,
    closed: true,
    sourceAndDestinationQualified: true,
  });
  f.agent.assertNoPendingInterceptors();
  expect(f.transport.snapshot()).toMatchObject({
    steps: 59,
    requests: 59,
    closed: true,
  });
  expect(admitRestoreOperatorArtifact).toHaveBeenCalledExactlyOnceWith(
    f.archive,
    WATCHLIST_RESTORE_ARCHIVE,
  );
  expect(f.fixture.uploaded).toEqual(f.archive);
  expect(f.waits).toEqual([30000, 30000, 30000]);
}
function assertProofReports(f: Integration) {
  expect([...f.reports.keys()]).toEqual([...WATCHLIST_RESTORE_PROOF_PHASES]);
  expect(
    [...f.reports.values()].map((report) => report.operationCount),
  ).toEqual([8, 19, 18, 6]);
  for (const report of f.reports.values()) {
    expect(report).toMatchObject({
      outcome: "passed",
      failure: "none",
      closed: true,
      cleanupIncomplete: false,
      buildProof: BUILD,
    });
  }
}
function assertInventories(f: Integration) {
  expect(f.fixture.sourceBaseline).toHaveLength(3);
  expect(f.fixture.restoredBaseline).toHaveLength(3);
  expect(f.fixture.restoredBaseline).toEqual(
    f.fixture.sourceBaseline.map((row) => ({
      ...row,
      $databaseId: TARGET.restoredDatabaseId,
    })),
  );
  expect(f.rows(TARGET.sourceDatabaseId)).toEqual(f.fixture.sourceBaseline);
  const final = f.rows(TARGET.restoredDatabaseId);
  expect(final).toHaveLength(4);
  expect(final.find((row) => row.$tableId === "watchlists")?.version).toBe(3);
  expect(
    final
      .filter((row) => row.$tableId === "receipts")
      .map((row) => row.version)
      .sort(),
  ).toEqual([1, 2, 3]);
  expect(
    f.store.calls.filter(
      (call) =>
        call.operation === "updateTransaction" &&
        (call.input as { commit?: boolean }).commit,
    ),
  ).toHaveLength(3);
}
function originalResponse(observed: OfflineRequest, ordinal: number) {
  if (
    observed.path === "/v1/tablesdb/" + TARGET.sourceDatabaseId &&
    ordinal === 1
  )
    return { absent: "database_not_found" };
  if ([2, 45].includes(ordinal)) return { absent: "database_not_found" };
  if (ordinal === 3) return { absent: "function_not_found" };
  return observed.response;
}
async function auditDurableStep(f: Integration, index: number) {
  const ordinal = index + 1,
    observed = f.requests[index]!;
  const before = await f.document(`step-${ordinal}-before.json`);
  const received = await f.document(`step-${ordinal}-received.json`);
  expect(before).toMatchObject({
    ordinal,
    method: observed.method,
    path: observed.path,
  });
  expect(before.requestSha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(received.originalResult).toEqual(
    restoreOperatorEvidenceDigest(originalResponse(observed, ordinal)),
  );
  expect(received.transport).toMatchObject({
    requests: ordinal,
    steps: ordinal,
  });
  return before.label as string;
}
async function assertDurableIdentities(f: Integration, files: string[]) {
  const saved = await Promise.all(
    files.map((file) => readFile(join(f.directory, file), "utf8")),
  );
  const durable = saved.join("\n");
  for (const id of [DEPLOYMENT, ARCHIVE, RESTORATION])
    expect(durable).toContain(id);
  expect(durable).not.toContain(KEY);
}
async function assertDurableSuccess(
  f: Integration,
  result: WatchlistRestoreOperatorResult,
) {
  expect(await f.document("intent.json")).toEqual(f.intent);
  expect(await f.document("terminal.json")).toEqual(result);
  const files = await readdir(f.directory);
  expect(files).toHaveLength(120);
  const labels: string[] = [];
  for (let index = 0; index < f.requests.length; index++)
    labels.push(await auditDurableStep(f, index));
  expect(labels.filter((label) => label.startsWith("proof-"))).toEqual(
    WATCHLIST_RESTORE_PROOF_PHASES.map((phase) => "proof-" + phase),
  );
  await assertDurableIdentities(f, files);
}

// A successful run syncs 120 exclusive files, then audits every saved step.
// Give real disk IO a bounded budget; production request/lifetime limits stay fixed.
describe("offline one-use Watchlist restore operator integration", () => {
  it("joins real SDK receipts, full inventories, four proofs and durable results in 59 dispatches", async () => {
    const f = await setup();
    const result = await f.operator.run();
    assertSuccessIdentity(f, result);
    assertProofReports(f);
    assertInventories(f);
    await assertDurableSuccess(f, result);
    expect(await f.operator.run()).toMatchObject({
      outcome: "stopped",
      reason: "already_used",
      requests: 0,
    });
    expect(f.requests).toHaveLength(59);
  }, 30_000);

  it("stops after a restored historical receipt changes, before replay or the next Save", async () => {
    const f = await setup(true);
    const result = await f.operator.run();
    expect(f.errors).toEqual([]);
    expect(result).toMatchObject({
      outcome: "uncertain",
      reason: "step",
      mutationMayHaveCommitted: true,
      closed: true,
      sourceAndDestinationQualified: false,
    });
    expect([...f.reports.keys()]).toEqual(["preflight", "seed"]);
    expect(f.rows(TARGET.sourceDatabaseId)).toEqual(f.fixture.sourceBaseline);
    expect(f.rows(TARGET.restoredDatabaseId)).toHaveLength(3);
    expect(
      f
        .rows(TARGET.restoredDatabaseId)
        .find((row) => row.$tableId === "watchlists")?.version,
    ).toBe(2);
    expect(await f.document("terminal.json")).toEqual(result);
    expect(f.requests.at(-1)?.path).toBe(
      `/v1/tablesdb/${TARGET.restoredDatabaseId}/tables/receipts/rows`,
    );
    const received = await f.document(`step-${result.steps}-received.json`);
    expect(received.admission).toBe("refused");
    expect(received.originalResult).toEqual(
      restoreOperatorEvidenceDigest(f.requests.at(-1)!.response),
    );
    expect(f.transport.snapshot()).toMatchObject({
      closed: true,
      requests: result.requests,
    });
    expect(f.requests.length).toBeLessThan(59);
  }, 30_000);
});
