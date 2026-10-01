import { isPersonalSecUserAgent } from "./personal-sec-quarterly-evidence-provider";

export interface ManagedSecAnnualConfiguration {
  readonly userAgent: string;
}

/** A separate server input; null explicitly closes annual-source admission. */
export function validateManagedSecAnnualConfiguration(
  input: unknown,
): Readonly<ManagedSecAnnualConfiguration> | null {
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
