function plainRecord(value: unknown): value is object {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}
function dataField(field: PropertyDescriptor | undefined): boolean {
  if (!field?.enumerable) return false;
  return Object.hasOwn(field, "value");
}
function recordField(
  key: PropertyKey,
  descriptors: Record<string, PropertyDescriptor>,
): boolean {
  if (typeof key !== "string") return false;
  return dataField(descriptors[key]);
}
export function record(
  value: unknown,
  keys?: readonly string[],
): Record<string, unknown> {
  check(plainRecord(value));
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  check(actual.every((key) => recordField(key, descriptors)));
  if (keys) {
    check(actual.length === keys.length);
    check(keys.every((key) => Object.hasOwn(descriptors, key)));
  }
  return value as Record<string, unknown>;
}
function arrayLength(value: unknown[], maximum: number): number {
  const length = Object.getOwnPropertyDescriptor(value, "length");
  check(length);
  check(Object.hasOwn(length, "value"));
  check(integer(length.value, 0, maximum));
  return length.value;
}
function arrayField(
  key: PropertyKey,
  descriptors: Record<string, PropertyDescriptor>,
  length: number,
): boolean {
  if (key === "length") return true;
  if (typeof key !== "string") return false;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) return false;
  if (Number(key) >= length) return false;
  return dataField(descriptors[key]);
}
export function array(value: unknown, maximum: number): readonly unknown[] {
  check(Array.isArray(value));
  check(Object.getPrototypeOf(value) === Array.prototype);
  const length = arrayLength(value, maximum);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  check(keys.length === length + 1);
  check(keys.every((key) => arrayField(key, descriptors, length)));
  return value;
}
export function check(condition: unknown): asserts condition {
  if (!condition)
    throw new TypeError("Invalid canonical interim statement evidence.");
}
export function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
export function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
export function sourceText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value.trim() === value &&
    /^[\x20-\x7E]+$/u.test(value)
  );
}
export function form(value: unknown): value is string {
  return (
    sourceText(value, 40) &&
    /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u.test(value)
  );
}
export function date(value: unknown): value is string {
  return (
    matches(value, /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
export function timestamp(
  value: unknown,
  milliseconds = true,
): value is string {
  return (
    matches(
      value,
      milliseconds
        ? /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u
        : /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().replace(".000Z", "Z") ===
      value.replace(".000Z", "Z")
  );
}
export function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function freeze<T>(value: T): T {
  if (value === null) return value;
  if (typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
