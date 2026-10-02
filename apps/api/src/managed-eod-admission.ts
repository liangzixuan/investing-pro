import type { AppwriteWatchlistStore } from "./appwrite-watchlist-repository";
import type { WatchlistPrincipal } from "./watchlist-repository";

export const MANAGED_EOD_ADMISSION_LIMITS = Object.freeze({
  deadlineMs: 2_000,
  transactionTtlSeconds: 60,
  maxRequests: 6,
  reservationsBytes: 8_192,
  reservationChargeBytes: 1_048_576,
  clockGuardMs: 4_000,
});
const WINDOWS = [
  { duration: 60 * 60 * 1_000 + 4_000, limit: 24 },
  { duration: 24 * 60 * 60 * 1_000 + 4_000, limit: 128 },
  { duration: 31 * 24 * 60 * 60 * 1_000 + 4_000, limit: 256 },
] as const;
export type ManagedEodAdmissionStore = Pick<
  AppwriteWatchlistStore,
  | "getRow"
  | "createTransaction"
  | "incrementRowColumn"
  | "updateRow"
  | "updateTransaction"
>;
export class ManagedEodAdmissionError extends Error {
  constructor(
    readonly code: "rate_limited" | "unavailable",
    readonly nextAllowedAt?: string,
  ) {
    super(code);
    this.name = "ManagedEodAdmissionError";
  }
}
export interface ManagedEodAdmission {
  reserve(
    principal: WatchlistPrincipal,
    enteredAt: string,
    signal: AbortSignal,
  ): Promise<Readonly<{ version: number; reservedAt: string }>>;
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
  "reservationsJson",
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
function fail(): never {
  throw new ManagedEodAdmissionError("unavailable");
}

/** Shared provider reservations contain timestamps only; every acknowledged permit is charged permanently. */
export function createManagedEodAdmission(options: {
  readonly store: ManagedEodAdmissionStore;
  readonly databaseId: string;
  readonly tableId: string;
  readonly rowId: string;
  readonly now?: () => Date;
}): ManagedEodAdmission {
  const { store, databaseId, tableId, rowId } = options;
  const now = options.now ?? (() => new Date());
  if (![databaseId, tableId, rowId].every((id) => ID.test(id))) fail();
  const location = { databaseId, tableId, rowId };
  return {
    async reserve(principal, enteredAt, signal) {
      let transactionId: string | undefined;
      let commitStarted = false;
      const entry = utc(enteredAt) ? Date.parse(enteredAt) : NaN;
      const active = () => {
        const current = now().getTime();
        if (
          signal.aborted ||
          !Number.isSafeInteger(entry) ||
          entry <= 0 ||
          !Number.isFinite(current) ||
          current < entry ||
          current - entry >= MANAGED_EOD_ADMISSION_LIMITS.deadlineMs
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
        const row = await store.getRow(location);
        active();
        if (
          !object(row) ||
          Object.keys(row).sort().join() !== ROW_KEYS.join() ||
          row.$id !== rowId ||
          row.$databaseId !== databaseId ||
          row.$tableId !== tableId ||
          row.ownerId !== principal.userId ||
          typeof row.$sequence !== "string" ||
          !/^[0-9]+$/u.test(row.$sequence) ||
          !Array.isArray(row.$permissions) ||
          row.$permissions.length !== 0 ||
          typeof row.version !== "number" ||
          !Number.isSafeInteger(row.version) ||
          row.version < 1 ||
          row.version >= Number.MAX_SAFE_INTEGER ||
          typeof row.reservationsJson !== "string" ||
          Buffer.byteLength(row.reservationsJson) >
            MANAGED_EOD_ADMISSION_LIMITS.reservationsBytes
        )
          fail();
        const parsed: unknown = JSON.parse(row.reservationsJson);
        if (
          !Array.isArray(parsed) ||
          parsed.length > 256 ||
          JSON.stringify(parsed) !== row.reservationsJson
        )
          fail();
        const timestamps: number[] = [];
        for (const value of parsed as unknown[]) {
          if (
            typeof value !== "number" ||
            !Number.isSafeInteger(value) ||
            value <= 0 ||
            value > entry ||
            (timestamps.length > 0 &&
              value < timestamps[timestamps.length - 1]!)
          )
            fail();
          timestamps.push(value);
        }
        const created = metadataTime(row.$createdAt),
          updated = metadataTime(row.$updatedAt);
        // Clock drift never creates a permit. A backwards reservation clock denies
        // admission; the four-second window guard assumes bounded hosted skew.
        if (
          !Number.isFinite(created) ||
          !Number.isFinite(updated) ||
          created > updated ||
          updated > entry + 2_000 ||
          (timestamps.length > 0 &&
            timestamps[timestamps.length - 1]! > updated + 2_000)
        )
          fail();
        const retained = timestamps.filter(
          (time) => time > entry - WINDOWS[2].duration,
        );
        let retryAt = 0;
        for (const window of WINDOWS) {
          const inWindow = retained.filter(
            (time) => time > entry - window.duration,
          );
          if (inWindow.length >= window.limit)
            retryAt = Math.max(
              retryAt,
              inWindow[inWindow.length - window.limit]! + window.duration,
            );
        }
        if (retryAt > 0) {
          const nextAllowedAt = new Date(retryAt).toISOString();
          if (!utc(nextAllowedAt) || retryAt <= entry) fail();
          throw new ManagedEodAdmissionError("rate_limited", nextAllowedAt);
        }
        retained.push(entry);
        const reservationsJson = JSON.stringify(retained);
        if (
          retained.length > 256 ||
          Buffer.byteLength(reservationsJson) >
            MANAGED_EOD_ADMISSION_LIMITS.reservationsBytes
        )
          fail();
        const version = row.version;
        const transaction = await store.createTransaction({
          ttl: MANAGED_EOD_ADMISSION_LIMITS.transactionTtlSeconds,
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
          data: { reservationsJson },
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
        return Object.freeze({ version: version + 1, reservedAt: enteredAt });
      } catch (error) {
        if (transactionId !== undefined && !commitStarted) {
          try {
            await store.updateTransaction({ transactionId, rollback: true });
          } catch {
            /* No permit; an unacknowledged rollback expires with its transaction. */
          }
        }
        if (error instanceof ManagedEodAdmissionError) throw error;
        return fail();
      }
    },
  };
}
