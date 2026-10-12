import { isPersonalSecUserAgent } from "./personal-sec-quarterly-evidence-provider";

export interface ManagedSecConfiguration {
  readonly userAgent: string;
}

/** A separate server input; null closes both managed SEC research routes. */
export function validateManagedSecConfiguration(
  input: unknown,
): Readonly<ManagedSecConfiguration> | null {
  if (input === null) return null;
  if (
    typeof input !== "object" ||
    Object.getPrototypeOf(input) !== Object.prototype ||
    Reflect.ownKeys(input).length !== 1
  )
    throw new Error("Invalid managed SEC configuration");
  const field = Object.getOwnPropertyDescriptor(input, "userAgent");
  if (
    field === undefined ||
    !("value" in field) ||
    typeof field.value !== "string" ||
    !isPersonalSecUserAgent(field.value)
  )
    throw new Error("Invalid managed SEC configuration");
  return Object.freeze({ userAgent: field.value });
}
