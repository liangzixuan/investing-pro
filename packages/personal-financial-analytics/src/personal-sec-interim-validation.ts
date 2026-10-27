export function record(
  value: unknown,
  keys?: readonly string[],
): Record<string, unknown> {
  check(
    value !== null &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  check(
    actual.every(
      (key) =>
        typeof key === "string" &&
        descriptors[key]?.enumerable &&
        Object.hasOwn(descriptors[key], "value"),
    ),
  );
  if (keys)
    check(
      actual.length === keys.length &&
        keys.every((key) => Object.hasOwn(descriptors, key)),
    );
  return value as Record<string, unknown>;
}
export function array(value: unknown, maximum: number): readonly unknown[] {
  check(
    Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype,
  );
  const length = Object.getOwnPropertyDescriptor(value, "length");
  check(
    length &&
      Object.hasOwn(length, "value") &&
      integer(length.value, 0, maximum),
  );
  const descriptors = Object.getOwnPropertyDescriptors(value),
    keys = Reflect.ownKeys(descriptors);
  check(
    keys.length === length.value + 1 &&
      keys.every(
        (key) =>
          key === "length" ||
          (typeof key === "string" &&
            /^(?:0|[1-9][0-9]*)$/u.test(key) &&
            Number(key) < length.value &&
            descriptors[key]?.enumerable &&
            Object.hasOwn(descriptors[key], "value")),
      ),
  );
  return value as readonly unknown[];
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
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
