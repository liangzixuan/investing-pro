const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tokenHexPattern = /^[0-9a-f]{64}$/;

export const RESOURCE_IDENTIFIER_TOKEN_SCHEME_V1 = "hmac-sha256-v1" as const;
export const RESOURCE_IDENTIFIER_TOKEN_BYTES_V1 = 32 as const;
export const RESOURCE_IDENTIFIER_TOKEN_FRAME_PREFIX_V1 =
  "research-cockpit/resource-id/v1\0" as const;
export const RESOURCE_IDENTIFIER_TYPES_V1 = Object.freeze([
  "thesis",
  "alert",
] as const);

export type ResourceIdentifierTypeV1 =
  (typeof RESOURCE_IDENTIFIER_TYPES_V1)[number];
export type ResourceIdentifierTokenV1 = string & {
  readonly __resourceIdentifierTokenV1: unique symbol;
};

export interface ResourceIdentifierTokenMacProviderV1 {
  macSha256(message: Uint8Array): Uint8Array | Promise<Uint8Array>;
}

export interface ResourceIdentifierTokenInputV1 {
  readonly privacyDomainId: string;
  readonly resourceType: ResourceIdentifierTypeV1;
  readonly resourceId: string;
}

/**
 * Encode the exact, unambiguous v1 MAC input. The external provider receives
 * only this framed identifier; the HMAC key never crosses this boundary.
 */
export function encodeResourceIdentifierTokenMessageV1(
  input: ResourceIdentifierTokenInputV1,
): Uint8Array {
  assertExactKeys(
    input,
    ["privacyDomainId", "resourceType", "resourceId"],
    "resource identifier token input",
  );
  const prefix = new TextEncoder().encode(
    RESOURCE_IDENTIFIER_TOKEN_FRAME_PREFIX_V1,
  );
  const domain = parseCanonicalUuid(input.privacyDomainId, "privacyDomainId");
  const resource = parseCanonicalUuid(input.resourceId, "resourceId");
  const typeTag = resourceTypeTag(input.resourceType);
  const message = new Uint8Array(
    prefix.byteLength + domain.byteLength + 1 + resource.byteLength,
  );
  let offset = 0;
  message.set(prefix, offset);
  offset += prefix.byteLength;
  message.set(domain, offset);
  offset += domain.byteLength;
  message[offset] = typeTag;
  message.set(resource, offset + 1);
  return message;
}

/**
 * Derive a stable pseudonymous token through a trusted external MAC adapter.
 * SQL can validate only the resulting shape and uniqueness, not HMAC truth.
 */
export async function deriveResourceIdentifierToken(
  provider: ResourceIdentifierTokenMacProviderV1,
  input: ResourceIdentifierTokenInputV1,
): Promise<ResourceIdentifierTokenV1> {
  assertExactKeys(provider, ["macSha256"], "resource token MAC provider");
  if (typeof provider.macSha256 !== "function") {
    throw new Error("Resource token MAC provider must expose macSha256");
  }
  const macSha256 = provider.macSha256.bind(provider);
  const message = encodeResourceIdentifierTokenMessageV1({
    privacyDomainId: input.privacyDomainId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  });
  const suppliedMac = await macSha256(message);
  if (!(suppliedMac instanceof Uint8Array)) {
    throw new Error("Resource token MAC provider must return bytes");
  }
  const mac = new Uint8Array(suppliedMac);
  if (mac.byteLength !== RESOURCE_IDENTIFIER_TOKEN_BYTES_V1) {
    throw new Error(
      `Resource token MAC must contain exactly ${RESOURCE_IDENTIFIER_TOKEN_BYTES_V1} bytes`,
    );
  }
  return bytesToHex(mac) as ResourceIdentifierTokenV1;
}

export function assertResourceIdentifierTokenV1(
  value: unknown,
  label = "resource identifier token",
): asserts value is ResourceIdentifierTokenV1 {
  if (typeof value !== "string" || !tokenHexPattern.test(value)) {
    throw new Error(`${label} must be exactly 32 lowercase hexadecimal bytes`);
  }
}

function resourceTypeTag(value: unknown): number {
  if (value === "thesis") return 1;
  if (value === "alert") return 2;
  throw new Error("Resource identifier type must be thesis or alert");
}

function parseCanonicalUuid(value: unknown, label: string): Uint8Array {
  if (typeof value !== "string" || !canonicalUuidPattern.test(value)) {
    throw new Error(`${label} must be a canonical lowercase UUID`);
  }
  const compact = value.replaceAll("-", "");
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function assertExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${label} contains missing or unexpected fields`);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
