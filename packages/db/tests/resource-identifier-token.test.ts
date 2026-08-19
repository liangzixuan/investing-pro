import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  RESOURCE_IDENTIFIER_TOKEN_BYTES_V1,
  RESOURCE_IDENTIFIER_TOKEN_FRAME_PREFIX_V1,
  RESOURCE_IDENTIFIER_TOKEN_SCHEME_V1,
  deriveResourceIdentifierToken,
  encodeResourceIdentifierTokenMessageV1,
} from "../src/resource-identifier-token";

const input = {
  privacyDomainId: "33000000-0000-4000-8000-000000000001",
  resourceType: "thesis" as const,
  resourceId: "53000000-0000-4000-8000-000000000001",
};

describe("resource identifier token v1", () => {
  it("uses the fixed binary frame and a known HMAC-SHA256 vector", async () => {
    const message = encodeResourceIdentifierTokenMessageV1(input);

    expect(RESOURCE_IDENTIFIER_TOKEN_SCHEME_V1).toBe("hmac-sha256-v1");
    expect(RESOURCE_IDENTIFIER_TOKEN_BYTES_V1).toBe(32);
    expect(RESOURCE_IDENTIFIER_TOKEN_FRAME_PREFIX_V1).toBe(
      "research-cockpit/resource-id/v1\0",
    );
    expect(Buffer.from(message).toString("hex")).toBe(
      "72657365617263682d636f636b7069742f7265736f757263652d69642f763100" +
        "33000000000040008000000000000001" +
        "01" +
        "53000000000040008000000000000001",
    );

    const token = await deriveResourceIdentifierToken(
      {
        macSha256: (value) =>
          createHmac("sha256", Buffer.from("b13-test-key"))
            .update(value)
            .digest(),
      },
      input,
    );
    expect(token).toBe(
      "e546071f744f708d9055086fba228005fe29958e1a3c28d11fe114d27e50ff17",
    );
  });

  it("separates resource types and snapshots input before the provider awaits", async () => {
    let release: ((value: Uint8Array) => void) | undefined;
    let received: Uint8Array | undefined;
    const mutable = { ...input };
    const pending = deriveResourceIdentifierToken(
      {
        macSha256: (message) => {
          received = new Uint8Array(message);
          return new Promise<Uint8Array>((resolve) => {
            release = resolve;
          });
        },
      },
      mutable,
    );
    mutable.resourceId = "53000000-0000-4000-8000-000000000099";
    release?.(new Uint8Array(32).fill(7));

    await expect(pending).resolves.toBe("07".repeat(32));
    expect(Buffer.from(received ?? []).toString("hex")).toBe(
      Buffer.from(encodeResourceIdentifierTokenMessageV1(input)).toString(
        "hex",
      ),
    );
    expect(
      Buffer.from(
        encodeResourceIdentifierTokenMessageV1({
          ...input,
          resourceType: "alert",
        }),
      ).toString("hex"),
    ).not.toBe(Buffer.from(received ?? []).toString("hex"));
  });

  it("rejects ambiguous IDs, unexpected seams, and malformed MAC output", async () => {
    expect(() =>
      encodeResourceIdentifierTokenMessageV1({
        ...input,
        privacyDomainId: "A3000000-0000-4000-8000-000000000001",
      }),
    ).toThrow(/canonical lowercase uuid/i);
    expect(() =>
      encodeResourceIdentifierTokenMessageV1({
        ...input,
        resourceType: "other" as never,
      }),
    ).toThrow(/thesis or alert/i);
    await expect(
      deriveResourceIdentifierToken(
        { macSha256: () => new Uint8Array(31) },
        input,
      ),
    ).rejects.toThrow(/exactly 32/i);
    await expect(
      deriveResourceIdentifierToken(
        {
          macSha256: () => new Uint8Array(32),
          callerToken: "not-allowed",
        } as never,
        input,
      ),
    ).rejects.toThrow(/unexpected fields/i);
  });
});
