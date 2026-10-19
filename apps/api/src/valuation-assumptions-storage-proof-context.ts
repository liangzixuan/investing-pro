import {
  encodeValuationAssumptionsPayload,
  type ManagedValuationAssumptionsCommand,
} from "@research-cockpit/contracts";
import { AppwriteException } from "node-appwrite";
import { createAppwriteValuationAssumptionsRepository } from "./appwrite-valuation-assumptions-repository";
import {
  StorageProofPhase,
  type ProofActor,
  type ProofStoreHooks,
} from "./appwrite-storage-proof-phase";
import type { AppwriteRowLocation } from "./appwrite-versioned-row-store";
import {
  VALUATION_PROOF_COMMAND_PINS,
  VALUATION_PROOF_LIMITS,
  VALUATION_PROOF_PRINCIPALS,
  VALUATION_PROOF_ROWS,
  VALUATION_PROOF_TARGET,
  valuationProofData,
  valuationProofLocation,
  type ValuationProofCommandName,
  type ValuationProofOwner,
  type ValuationProofPhase,
} from "./valuation-assumptions-proof-data";
import {
  ValuationAssumptionsRepositoryError,
  type ValuationAssumptionsReceipt,
  type ValuationAssumptionsRepositoryErrorCode,
} from "./valuation-assumptions-repository";
import type { ValuationProofOperation } from "./valuation-assumptions-storage-proof-types";
import {
  requireValuationProof as requireProof,
  valuationProofApplicationTime as applicationTime,
  valuationProofFingerprint,
  valuationProofHash,
  valuationProofMetadataTime as metadataTime,
  valuationProofRow,
  type ProofRow,
} from "./valuation-assumptions-storage-proof-evidence";

type Catalog = "original" | "revised" | "rebound" | "overflow";
export interface ValuationProofAction {
  readonly owner: ValuationProofOwner;
  readonly name: ValuationProofCommandName;
  readonly hooks?: ProofStoreHooks;
  readonly actor?: ProofActor;
  readonly catalog?: Catalog;
  readonly negativeClock?: boolean;
}
type Outcome =
  | { readonly ok: true; readonly receipt: ValuationAssumptionsReceipt }
  | { readonly ok: false; readonly error: unknown };
const METADATA = [
  "$id",
  "$sequence",
  "$databaseId",
  "$tableId",
  "$createdAt",
  "$updatedAt",
  "$permissions",
];
const CURRENT_FIELDS = [
  "ownerId",
  "resourceId",
  "version",
  "payloadJson",
  "digestSha256",
  "createdAt",
  "updatedAt",
];
const RECEIPT_FIELDS = [
  "ownerId",
  "resourceId",
  "keyDigest",
  "requestDigest",
  "version",
  "digestSha256",
  "committedAt",
];
const A_COMMANDS = [
  "create",
  "stale-winner",
  "prestage-winner",
  "overlap-winner",
  "unknown",
  "historical-edit",
  "catalog-reviewed",
  "remove",
] as const;
const A_PREDECESSOR: Record<ValuationProofPhase, number> = {
  schema: 0,
  preflight: 0,
  "create-isolation": 0,
  stale: 1,
  prestage: 2,
  overlap: 3,
  rollback: 4,
  unknown: 4,
  capacity: 0,
  "domain-guards": 5,
  "historical-edit-and-catalog-review": 5,
  reopen: 7,
  remove: 7,
  "reopen-empty": 8,
};
export function valuationRepositoryCode(
  error: unknown,
): ValuationAssumptionsRepositoryErrorCode | null {
  return error instanceof ValuationAssumptionsRepositoryError
    ? error.code
    : null;
}
export function valuationRowAbsent(error: unknown): boolean {
  if (!(error instanceof AppwriteException)) return false;
  return error.code === 404 && error.type === "row_not_found";
}

/** One invocation's admitted observations. No rows survive between phases. */
export class ValuationProofContext {
  readonly data = valuationProofData();
  readonly lifetime: StorageProofPhase;
  readonly rows = new Map<string, ProofRow>();
  readonly absent = new Set<string>();
  readonly checks: string[] = [];
  private readonly firstCurrent = new Set<ValuationProofOwner>();
  private readonly createdTimes = new Map<ValuationProofOwner, string>();
  repositoryError: ValuationAssumptionsRepositoryErrorCode | null = null;
  observedVersion: number | null = null;
  operation: ValuationProofOperation | undefined;
  metadataCount = 0;

  constructor(readonly phase: ValuationProofPhase) {
    this.lifetime = new StorageProofPhase(VALUATION_PROOF_LIMITS[phase], true);
  }
  check(...names: string[]): void {
    requireProof(this.checks.length + names.length <= 20);
    requireProof(names.every((name) => /^[a-z0-9_]{1,100}$/u.test(name)));
    this.checks.push(...names);
  }
  command(owner: ValuationProofOwner, name: ValuationProofCommandName) {
    const commands: Readonly<
      Partial<
        Record<ValuationProofCommandName, ManagedValuationAssumptionsCommand>
      >
    > = this.data.commands[owner];
    const command = commands[name];
    requireProof(command);
    return command;
  }
  pin(owner: ValuationProofOwner, name: ValuationProofCommandName) {
    const pin = VALUATION_PROOF_COMMAND_PINS.find(
      (item) => item.owner === owner && item.name === name,
    );
    requireProof(pin);
    return pin;
  }
  target(input: AppwriteRowLocation) {
    const row = VALUATION_PROOF_ROWS.find(
      (item) =>
        item.databaseId === input.databaseId &&
        item.tableId === input.tableId &&
        item.rowId === input.rowId,
    );
    requireProof(row);
    return row;
  }
  private expectedFirst(owner: ValuationProofOwner): number {
    if (this.phase === "preflight") return 0;
    if (this.phase === "create-isolation") return 0;
    if (owner === "a") return A_PREDECESSOR[this.phase];
    if (this.phase === "capacity") return 0;
    return 1;
  }
  private first(owner: ValuationProofOwner, version: number): void {
    if (this.firstCurrent.has(owner)) return;
    requireProof(version === this.expectedFirst(owner));
    this.firstCurrent.add(owner);
  }
  private inspectMetadata(input: AppwriteRowLocation, row: ProofRow): void {
    requireProof(row.$id === input.rowId);
    requireProof(row.$databaseId === input.databaseId);
    requireProof(row.$tableId === input.tableId);
    requireProof(typeof row.$sequence === "string");
    requireProof(/^\d{1,20}$/u.test(row.$sequence));
    requireProof(metadataTime(row.$createdAt));
    requireProof(metadataTime(row.$updatedAt));
    requireProof(Array.isArray(row.$permissions));
    requireProof(Reflect.ownKeys(row.$permissions).length === 1);
    requireProof(row.$permissions.length === 0);
  }
  private inspectCurrent(owner: ValuationProofOwner, row: ProofRow): void {
    requireProof(applicationTime(row.createdAt));
    requireProof(applicationTime(row.updatedAt));
    requireProof(row.createdAt <= row.updatedAt);
    this.creationTime(owner, row);
    const name =
      owner === "a"
        ? A_COMMANDS[(row.version as number) - 1]
        : owner === "b"
          ? "create"
          : "capacity";
    requireProof(name);
    const command = this.command(owner, name);
    requireProof(row.version === command.expectedVersion + 1);
    const payload = encodeValuationAssumptionsPayload(command.payload);
    requireProof(row.payloadJson === payload);
    requireProof(row.digestSha256 === valuationProofHash(payload));
    this.first(owner, row.version);
    this.observedVersion = row.version;
  }
  private creationTime(owner: ValuationProofOwner, row: ProofRow): void {
    requireProof(typeof row.createdAt === "string");
    if (row.version === 1) requireProof(row.createdAt === row.updatedAt);
    const previous = this.createdTimes.get(owner);
    if (previous !== undefined) requireProof(row.createdAt === previous);
    this.createdTimes.set(owner, row.createdAt);
  }
  private inspectReceipt(
    location: (typeof VALUATION_PROOF_ROWS)[number],
    row: ProofRow,
  ): void {
    requireProof(location.name);
    requireProof(location.expectedPresentAfterProof);
    const pin = this.pin(location.owner, location.name);
    requireProof(row.keyDigest === pin.keySha256);
    requireProof(row.requestDigest === pin.requestSha256);
    requireProof(row.version === pin.expectedVersion + 1);
    requireProof(row.digestSha256 === pin.payloadSha256);
    requireProof(applicationTime(row.committedAt));
  }
  private inspect(input: AppwriteRowLocation, value: unknown): void {
    this.lifetime.assertRunning();
    const location = this.target(input),
      row = valuationProofRow(value);
    const fields = location.name === null ? CURRENT_FIELDS : RECEIPT_FIELDS;
    requireProof(
      Object.keys(row).sort().join(",") ===
        [...METADATA, ...fields].sort().join(","),
    );
    this.inspectMetadata(input, row);
    requireProof(
      row.ownerId === VALUATION_PROOF_PRINCIPALS[location.owner].userId,
    );
    requireProof(row.resourceId === "main");
    requireProof(Number.isSafeInteger(row.version));
    requireProof((row.version as number) > 0);
    if (location.name === null) this.inspectCurrent(location.owner, row);
    else this.inspectReceipt(location, row);
    this.rows.set(
      input.rowId,
      Object.freeze({ ...row, $permissions: Object.freeze([]) }),
    );
    this.absent.delete(input.rowId);
  }
  private readError(input: AppwriteRowLocation, error: unknown): void {
    this.lifetime.assertRunning();
    const location = this.target(input);
    if (!valuationRowAbsent(error)) return;
    this.absent.add(input.rowId);
    this.rows.delete(input.rowId);
    if (location.name === null) this.first(location.owner, 0);
  }
  store(hooks: ProofStoreHooks = {}, actor: ProofActor = "writer") {
    requireProof(this.operation);
    return this.lifetime.store(
      this.operation.newStore(),
      {
        ...hooks,
        visit: (input) => {
          this.target(input);
        },
        read: (input, value) => this.inspect(input, value),
        readError: (input, error) => this.readError(input, error),
      },
      actor,
    );
  }
  repository(
    action: Pick<
      ValuationProofAction,
      "catalog" | "actor" | "hooks" | "negativeClock"
    > = {},
  ) {
    const catalogs = {
      original: this.data.catalog,
      revised: this.data.revisedCatalog,
      rebound: this.data.reboundCatalog,
      overflow: this.data.overflowCatalog,
    };
    return createAppwriteValuationAssumptionsRepository({
      store: this.store(action.hooks, action.actor),
      databaseId: VALUATION_PROOF_TARGET.databaseId,
      assumptionsTableId: VALUATION_PROOF_TARGET.currentTableId,
      receiptsTableId: VALUATION_PROOF_TARGET.receiptsTableId,
      catalog: catalogs[action.catalog ?? "original"],
      ...(action.negativeClock
        ? { now: () => new Date("2000-01-01T00:00:00.000Z") }
        : {}),
    });
  }
  put(action: ValuationProofAction): Promise<Outcome> {
    return this.putValue(action, this.command(action.owner, action.name));
  }
  putValue(
    action: Pick<
      ValuationProofAction,
      "owner" | "catalog" | "actor" | "hooks" | "negativeClock"
    >,
    value: unknown,
  ): Promise<Outcome> {
    const task = this.repository(action)
      .put(
        VALUATION_PROOF_PRINCIPALS[action.owner],
        value as ManagedValuationAssumptionsCommand,
      )
      .then(
        (receipt) => ({ ok: true as const, receipt }),
        (error: unknown) => ({ ok: false as const, error }),
      );
    this.lifetime.actors.push(task);
    return task;
  }
  async success(action: ValuationProofAction) {
    const result = await this.lifetime.bounded(this.put(action));
    if (!result.ok) throw result.error;
    const pin = this.pin(action.owner, action.name);
    requireProof(!result.receipt.replayed);
    requireProof(result.receipt.version === pin.expectedVersion + 1);
    requireProof(result.receipt.digestSha256 === pin.payloadSha256);
    requireProof(applicationTime(result.receipt.committedAt));
    return result.receipt;
  }
  async refuse(
    task: Promise<Outcome>,
    expected: ValuationAssumptionsRepositoryErrorCode,
  ) {
    const result = await this.lifetime.bounded(task);
    this.repositoryError = result.ok
      ? null
      : valuationRepositoryCode(result.error);
    requireProof(!result.ok);
    requireProof(this.repositoryError === expected);
  }
  async read(
    owner: ValuationProofOwner,
    version: number,
    catalog: Catalog = "original",
  ) {
    const record = await this.repository({ catalog, actor: "read" }).get(
      VALUATION_PROOF_PRINCIPALS[owner],
    );
    if (version === 0) requireProof(record === null);
    else requireProof(record?.version === version);
    this.observedVersion = version;
  }
  async receipt(owner: ValuationProofOwner, name: ValuationProofCommandName) {
    await this.store({}, "inspection").getRow(
      valuationProofLocation(owner, name),
    );
  }
  joined(owner: ValuationProofOwner, name: ValuationProofCommandName): void {
    const current = this.rows.get(valuationProofLocation(owner).rowId);
    const receipt = this.rows.get(valuationProofLocation(owner, name).rowId);
    requireProof(current && receipt);
    requireProof(current.version === receipt.version);
    requireProof(current.digestSha256 === receipt.digestSha256);
    requireProof(current.updatedAt === receipt.committedAt);
  }
  async replay(action: ValuationProofAction) {
    const result = await this.lifetime.bounded(
      this.put({ ...action, actor: "replay" }),
    );
    requireProof(result.ok);
    requireProof(result.receipt.replayed);
    const pin = this.pin(action.owner, action.name);
    requireProof(result.receipt.version === pin.expectedVersion + 1);
    requireProof(result.receipt.digestSha256 === pin.payloadSha256);
    const row = this.rows.get(
      valuationProofLocation(action.owner, action.name).rowId,
    );
    requireProof(row);
    requireProof(row.committedAt === result.receipt.committedAt);
    return result.receipt;
  }
  async requireAbsent(input: AppwriteRowLocation): Promise<void> {
    this.absent.delete(input.rowId);
    try {
      await this.store({}, "inspection").getRow(input);
    } catch (error) {
      if (!valuationRowAbsent(error)) throw error;
    }
    requireProof(this.absent.has(input.rowId));
  }
  fingerprint(owner: ValuationProofOwner): string {
    return valuationProofFingerprint(
      this.rows.get(valuationProofLocation(owner).rowId),
    );
  }
}
