import { createHash } from "node:crypto";
import { ProofFailure } from "./appwrite-storage-proof-phase";

export type ProofRow = Readonly<Record<string, unknown>>;
export function requireValuationProof(value: unknown): asserts value {
  if (!value) throw new ProofFailure("unexpected_result");
}
export function valuationProofHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function sdkStringifier(value: PropertyDescriptor): boolean {
  return (
    value.enumerable === false &&
    value.configurable === true &&
    value.writable === true &&
    typeof value.value === "function"
  );
}
export function valuationProofRow(value: unknown): ProofRow {
  requireValuationProof(value !== null && typeof value === "object");
  const prototype: unknown = Object.getPrototypeOf(value);
  requireValuationProof(prototype === Object.prototype || prototype === null);
  const fields = Object.getOwnPropertyDescriptors(value);
  requireValuationProof(Reflect.ownKeys(fields).length <= 15);
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(fields)) {
    requireValuationProof(typeof key === "string");
    const field = fields[key]!;
    if (key === "toString" && sdkStringifier(field)) continue;
    requireValuationProof(key !== "__proto__");
    requireValuationProof(field.enumerable && "value" in field);
    result[key] = field.value;
  }
  return Object.freeze(result);
}
export function valuationProofApplicationTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
    return false;
  if (!Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
}
export function valuationProofMetadataTime(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/u.exec(
      value,
    );
  if (!match) return false;
  return valuationProofApplicationTime(
    `${match[1]}.${(match[2] ?? "").padEnd(3, "0").slice(0, 3)}Z`,
  );
}
export function valuationProofFingerprint(row: ProofRow | undefined): string {
  requireValuationProof(row);
  return valuationProofHash(
    JSON.stringify(
      Object.fromEntries(
        Object.keys(row)
          .sort()
          .map((key) => [key, row[key]]),
      ),
    ),
  );
}
