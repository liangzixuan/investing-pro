import { createHash } from "node:crypto";
export function digestSecCanonicalText(text: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}
export function freezeSecCanonicalGraph<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeSecCanonicalGraph(child);
    Object.freeze(value);
  }
  return value;
}
export function isSecCanonicalGraphFrozen(value: unknown): boolean {
  return (
    value === null ||
    typeof value !== "object" ||
    (Object.isFrozen(value) &&
      Object.values(value).every(isSecCanonicalGraphFrozen))
  );
}
/** Check raw descriptors before composition can flatten or invoke a supplied field. */
export function assertSecCanonicalRecord(
  value: unknown,
  expected: readonly string[],
  context: "annual" | "interim",
): void {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new TypeError(`Invalid canonical ${context} source input.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== expected.length ||
    !expected.every((key) => Object.hasOwn(descriptors, key)) ||
    !keys.every(
      (key) =>
        typeof key === "string" &&
        descriptors[key]?.enumerable &&
        Object.hasOwn(descriptors[key], "value"),
    )
  )
    throw new TypeError(`Invalid canonical ${context} source input.`);
}
export function assertSecCanonicalRows(
  value: unknown,
  maximum: number,
  context: "annual" | "interim",
): void {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
    throw new TypeError(`Invalid canonical ${context} source rows.`);
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !length ||
    !Object.hasOwn(length, "value") ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0 ||
    length.value > maximum
  )
    throw new TypeError(`Invalid canonical ${context} source rows.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== length.value + 1 ||
    !keys.every(
      (key) =>
        key === "length" ||
        (typeof key === "string" &&
          /^(?:0|[1-9][0-9]*)$/u.test(key) &&
          Number(key) < length.value &&
          descriptors[key]?.enumerable &&
          Object.hasOwn(descriptors[key], "value")),
    )
  )
    throw new TypeError(`Invalid canonical ${context} source rows.`);
  for (const row of value)
    assertSecCanonicalRecord(
      row,
      [
        "id",
        "taxonomy",
        "concept",
        "unit",
        "value",
        "startDate",
        "endDate",
        "durationDays",
        "periodBasis",
        "filingFocusYear",
        "filingFocusPeriod",
        "frame",
        "accessionNumber",
        "form",
        "filedDate",
        "sourceLocator",
      ],
      context,
    );
}
