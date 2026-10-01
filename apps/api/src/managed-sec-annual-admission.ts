import type { AppwriteWatchlistStore } from "./appwrite-watchlist-repository";
import type { WatchlistPrincipal } from "./watchlist-repository";

export const MANAGED_SEC_ADMISSION_LIMITS = Object.freeze({
  spacingMs: 20_000,
  deadlineMs: 2_000,
  transactionTtlSeconds: 60,
  maxRequests: 6,
});
export type ManagedSecAnnualAdmissionStore = Pick<
  AppwriteWatchlistStore,
  | "getRow"
  | "createTransaction"
  | "incrementRowColumn"
  | "updateRow"
  | "updateTransaction"
>;
export class ManagedSecAnnualAdmissionError extends Error {
  constructor(
    readonly code: "rate_limited" | "unavailable",
    readonly nextAllowedAt?: string,
  ) {
    super(code);
    this.name = "ManagedSecAnnualAdmissionError";
  }
}
export interface ManagedSecAnnualAdmission {
  reserve(
    principal: WatchlistPrincipal,
    enteredAt: string,
    signal: AbortSignal,
  ): Promise<Readonly<{ version: number; nextAllowedAt: string }>>;
}
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u;
const ROW_KEYS = [
  "$id",
  "$sequence",
  "$tableId",
  "$databaseId",
  "$createdAt",
  "$updatedAt",
  "$permissions",
  "ownerId",
  "version",
  "nextAllowedAt",
].sort();
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function utc(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function metadataTime(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value,
    );
  const normalized = match
    ? `${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`
    : "";
  return utc(normalized) ? Date.parse(normalized) : NaN;
}

/** One pre-provisioned private row. Only an acknowledged, timely CAS grants work. */
export function createManagedSecAnnualAdmission(options: {
  readonly store: ManagedSecAnnualAdmissionStore;
  readonly databaseId: string;
  readonly tableId: string;
  readonly rowId: string;
  readonly now?: () => Date;
}): ManagedSecAnnualAdmission {
  const { store, databaseId, tableId, rowId } = options;
  const now = options.now ?? (() => new Date());
  if (![databaseId, tableId, rowId].every((id) => ID.test(id)))
    throw new ManagedSecAnnualAdmissionError("unavailable");
  const location = { databaseId, tableId, rowId };
  return {
    async reserve(principal, enteredAt, signal) {
      let transactionId: string | undefined;
      let commitStarted = false;
      const fail: () => never = () => {
        throw new ManagedSecAnnualAdmissionError("unavailable");
      };
      const entry = utc(enteredAt) ? Date.parse(enteredAt) : NaN;
      const active = () => {
        const current = now().getTime();
        if (
          signal.aborted ||
          !Number.isFinite(entry) ||
          !Number.isFinite(current) ||
          current < entry ||
          current - entry >= MANAGED_SEC_ADMISSION_LIMITS.deadlineMs
        )
          fail();
      };
      try {
        active();
        if (
          !object(principal) ||
          Object.keys(principal).join() !== "userId" ||
          typeof principal.userId !== "string" ||
          !ID.test(principal.userId)
        )
          fail();
        const ownerId = principal.userId;
        const row = await store.getRow(location);
        active();
        if (
          !object(row) ||
          Object.keys(row).sort().join() !== ROW_KEYS.join() ||
          row.$id !== rowId ||
          row.$databaseId !== databaseId ||
          row.$tableId !== tableId ||
          row.ownerId !== ownerId ||
          typeof row.$sequence !== "string" ||
          !/^[0-9]+$/u.test(row.$sequence) ||
          !Array.isArray(row.$permissions) ||
          row.$permissions.length !== 0 ||
          typeof row.version !== "number" ||
          !Number.isSafeInteger(row.version) ||
          row.version < 1 ||
          row.version >= Number.MAX_SAFE_INTEGER ||
          !utc(row.nextAllowedAt)
        )
          fail();
        const created = metadataTime(row.$createdAt),
          updated = metadataTime(row.$updatedAt);
        const next = Date.parse(row.nextAllowedAt);
        // Each hosted clock is assumed within one second of UTC. Observed
        // chronology outside that allowance denies work; it cannot prove skew.
        if (
          !Number.isFinite(created) ||
          !Number.isFinite(updated) ||
          created > updated ||
          updated > entry + 2_000 ||
          next < updated - 2_000 ||
          next > entry + MANAGED_SEC_ADMISSION_LIMITS.spacingMs + 2_000
        )
          fail();
        if (entry < next)
          throw new ManagedSecAnnualAdmissionError(
            "rate_limited",
            row.nextAllowedAt,
          );
        const version = row.version;
        const nextAllowedAt = new Date(
          entry + MANAGED_SEC_ADMISSION_LIMITS.spacingMs,
        ).toISOString();
        if (!utc(nextAllowedAt)) fail();
        const transaction = await store.createTransaction({
          ttl: MANAGED_SEC_ADMISSION_LIMITS.transactionTtlSeconds,
        });
        if (
          !object(transaction) ||
          typeof transaction.$id !== "string" ||
          !ID.test(transaction.$id)
        )
          fail();
        transactionId = transaction.$id;
        active();
        if (transaction.status !== "pending") fail();
        await store.incrementRowColumn({
          ...location,
          transactionId,
          column: "version",
          value: 1,
          max: version + 1,
        });
        active();
        await store.updateRow({
          ...location,
          transactionId,
          data: { nextAllowedAt },
        });
        active();
        commitStarted = true;
        const committed = await store.updateTransaction({
          transactionId,
          commit: true,
        });
        active();
        if (
          !object(committed) ||
          committed.$id !== transactionId ||
          committed.status !== "committed"
        )
          fail();
        return Object.freeze({ version: version + 1, nextAllowedAt });
      } catch (error) {
        if (transactionId !== undefined && !commitStarted) {
          try {
            await store.updateTransaction({ transactionId, rollback: true });
          } catch {
            /* Pending transaction expires; no permit is returned. */
          }
        }
        if (error instanceof ManagedSecAnnualAdmissionError) throw error;
        throw new ManagedSecAnnualAdmissionError("unavailable");
      }
    },
  };
}
