/** CPI boundary admission reads descriptors, never caller property getters. */
function recordDescriptors(value: unknown): PropertyDescriptorMap | null {
  if (value === null || typeof value !== "object") return null;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  return Object.getOwnPropertyDescriptors(value);
}
function ownData(
  field: PropertyDescriptor | undefined,
): field is PropertyDescriptor & { value: unknown } {
  if (!field) return false;
  return Object.hasOwn(field, "value");
}
export function readCpiDataRecord(
  value: unknown,
  names: readonly string[],
): Record<string, unknown> | null {
  try {
    const fields = recordDescriptors(value);
    if (!fields) return null;
    if (Reflect.ownKeys(fields).length !== names.length) return null;
    return Object.fromEntries(
      names.map((name) => [name, requiredField(fields, name)]),
    );
  } catch {
    return null;
  }
}
function requiredField(fields: PropertyDescriptorMap, name: string): unknown {
  const field = fields[name];
  if (!field?.enumerable) throw new Error("Invalid CPI field");
  if (!Object.hasOwn(field, "value")) throw new Error("Invalid CPI field");
  return field.value;
}
interface CpiArrayShape {
  readonly value: readonly unknown[];
  readonly length: number;
}
function arrayShape(
  value: unknown,
  expectedLength: number,
): CpiArrayShape | null {
  if (!Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")
    ?.value as unknown;
  if (length !== expectedLength) return null;
  if (Reflect.ownKeys(value).length !== expectedLength + 1) return null;
  return { value, length: expectedLength };
}
export function readCpiDataArray(
  value: unknown,
  expectedLength: number,
): readonly unknown[] | null {
  const shape = arrayShape(value, expectedLength);
  if (!shape) return null;
  const values: unknown[] = [];
  for (let index = 0; index < shape.length; index++) {
    const field = Object.getOwnPropertyDescriptor(shape.value, index);
    if (!ownData(field)) return null;
    values.push(field.value);
  }
  return values;
}
