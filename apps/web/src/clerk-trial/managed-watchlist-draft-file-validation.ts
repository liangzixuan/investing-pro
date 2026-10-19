export const draftFileEncoder = new TextEncoder();
const HASH = /^sha256:[0-9a-f]{64}$/u;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

/** Internal admission failures are caught by the public null/false boundary. */
export function requireDraftFile(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid Watchlist draft file");
}

function ownDataField(value: object, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  requireDraftFile(descriptor !== undefined);
  requireDraftFile(descriptor.enumerable === true);
  requireDraftFile(Object.hasOwn(descriptor, "value"));
  return descriptor.value as unknown;
}

/** Copy only exact plain own data fields, without reading a getter. */
export function requiredDraftFileRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): Record<Keys[number], unknown> {
  requireDraftFile(typeof value === "object");
  requireDraftFile(value !== null);
  requireDraftFile(Object.getPrototypeOf(value) === Object.prototype);
  requireDraftFile(Reflect.ownKeys(value).length === keys.length);
  const fields = new Map(keys.map((key) => [key, ownDataField(value, key)]));
  // Preserve field order for exact formatter-text checks while copying only
  // descriptor values; property reads must not invoke application getters.
  return Object.fromEntries(
    Object.keys(value).map((key) => [key, fields.get(key)]),
  ) as Record<Keys[number], unknown>;
}

/** Copy a bounded dense plain array; sparse, accessor and extra fields refuse. */
export function requiredDraftFileArray(
  value: unknown,
  maximum: number,
): unknown[] {
  requireDraftFile(Array.isArray(value));
  requireDraftFile(value.length <= maximum);
  requireDraftFile(Object.getPrototypeOf(value) === Array.prototype);
  requireDraftFile(Reflect.ownKeys(value).length === value.length + 1);
  return Array.from({ length: value.length }, (_, index) =>
    ownDataField(value, String(index)),
  );
}

export function requiredDraftFileHash(value: unknown): string {
  requireDraftFile(typeof value === "string");
  requireDraftFile(HASH.test(value));
  return value;
}

export function requiredDraftFileTime(value: unknown): string {
  requireDraftFile(typeof value === "string");
  requireDraftFile(TIME.test(value));
  const time = Date.parse(value);
  requireDraftFile(Number.isFinite(time));
  requireDraftFile(new Date(time).toISOString() === value);
  return value;
}

export function requiredDraftFileVersion(value: unknown): number {
  requireDraftFile(typeof value === "number");
  requireDraftFile(Number.isSafeInteger(value));
  requireDraftFile(value >= 0);
  return value;
}

/** Bounds apply to actual UTF-8 bytes, with no replacement of malformed UTF-16. */
export function requiredDraftFileText(value: unknown, maximum: number): string {
  requireDraftFile(typeof value === "string");
  requireDraftFile(value.length <= maximum);
  requireDraftFile(!/\p{Cs}/u.test(value));
  requireDraftFile(draftFileEncoder.encode(value).byteLength <= maximum);
  return value;
}
