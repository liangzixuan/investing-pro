import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS,
  handoffAuthenticatedSyntheticFilingParserResults,
  type FilingParserNormalizationHandoffResult,
} from "./filing-parser-normalization-handoff";
import {
  buildSignedSyntheticHandoffEnvelope,
  buildSyntheticFilingParserNormalizationHandoffFixture,
  canonicalSyntheticHandoffJsonBytes,
  decodeSyntheticHandoffEnvelope,
  type SyntheticFilingParserNormalizationHandoffFixture,
} from "./test-filing-parser-normalization-handoff-builder";

type JsonRecord = Record<string, unknown>;

const ERROR_CANARY = "CYCLE2I_SECRET_CANARY";

describe("Cycle 2i parser-normalization handoff security boundary", () => {
  it("fails closed on signature, supplied key, key ID, and image identity changes", () => {
    const signatureFixture = fixture();
    const signatureEnvelope = envelope(signatureFixture.originalEnvelope);
    const signature = String(signatureEnvelope.signature);
    signatureEnvelope.signature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expectQuarantined(
      call(signatureFixture, {
        originalEnvelope: canonicalSyntheticHandoffJsonBytes(signatureEnvelope),
      }),
    );

    const wrongKeyFixture = fixture();
    const otherKeyFixture = fixture();
    expectQuarantined(
      call(wrongKeyFixture, {
        options: {
          ...wrongKeyFixture.options,
          publicKeySpki: otherKeyFixture.options.publicKeySpki,
        },
      }),
    );
    const keyIdFixture = fixture();
    expectQuarantined(
      call(keyIdFixture, {
        options: {
          ...keyIdFixture.options,
          expectedKeyId: "cycle2i-wrong-ed25519-v1",
        },
      }),
    );
    const imageFixture = fixture();
    expectQuarantined(
      call(imageFixture, {
        options: {
          ...imageFixture.options,
          expectedImageSha256: `sha256:${"b".repeat(64)}`,
        },
      }),
    );
  });

  it("recomputes each archive digest and binds it to payload and document", () => {
    const archiveFixture = fixture();
    archiveFixture.originalArchive[0] =
      (archiveFixture.originalArchive[0] ?? 0) ^ 0xff;
    expectQuarantined(call(archiveFixture));

    const documentFixture = fixture();
    const original = envelope(documentFixture.originalEnvelope);
    const document = documentOf(original);
    document.contentSha256 = `sha256:${"f".repeat(64)}`;
    expectQuarantined(
      call(documentFixture, {
        originalEnvelope: signedEnvelope(documentFixture, "original", document),
      }),
    );
  });

  it("rejects swapped signed roles and signed downstream-invalid chronology", () => {
    const roleFixture = fixture();
    expectQuarantined(
      handoffAuthenticatedSyntheticFilingParserResults(
        roleFixture.amendmentArchive,
        roleFixture.originalArchive,
        roleFixture.amendmentEnvelope,
        roleFixture.originalEnvelope,
        roleFixture.options,
      ),
    );

    const chronologyFixture = fixture();
    const amendment = documentOf(envelope(chronologyFixture.amendmentEnvelope));
    amendment.amendmentOf = null;
    expectQuarantined(
      call(chronologyFixture, {
        amendmentEnvelope: signedEnvelope(
          chronologyFixture,
          "amendment",
          amendment,
        ),
      }),
    );
  });

  it("never synthesizes or repairs missing, extra, or malformed signed facts", () => {
    for (const mutation of [
      (facts: unknown[]) => facts.splice(0, 1),
      (facts: unknown[]) => facts.push(structuredClone(facts[0])),
      (facts: unknown[]) => {
        record(facts[0]).value = "not-a-decimal";
      },
    ]) {
      const current = fixture();
      const original = documentOf(envelope(current.originalEnvelope));
      const facts = array(original.facts);
      mutation(facts);
      expectQuarantined(
        call(current, {
          originalEnvelope: signedEnvelope(current, "original", original),
        }),
      );
    }
  });

  it("requires canonical closed envelopes and exactly five boundary arguments", () => {
    const current = fixture();
    const extra = envelope(current.originalEnvelope);
    extra.unexpected = ERROR_CANARY;
    expectQuarantined(
      call(current, {
        originalEnvelope: canonicalSyntheticHandoffJsonBytes(extra),
      }),
    );
    const missing = envelope(current.originalEnvelope);
    delete missing.signature;
    expectQuarantined(
      call(current, {
        originalEnvelope: canonicalSyntheticHandoffJsonBytes(missing),
      }),
    );
    const parsed = envelope(current.originalEnvelope);
    expectQuarantined(
      call(current, {
        originalEnvelope: new TextEncoder().encode(
          `${JSON.stringify(parsed, null, 2)}\n`,
        ),
      }),
    );
    const canonical = new TextDecoder().decode(current.originalEnvelope);
    expectQuarantined(
      call(current, {
        originalEnvelope: new TextEncoder().encode(
          canonical.replace(
            '"synthetic":true}\n',
            '"synthetic":true,"synthetic":true}\n',
          ),
        ),
      }),
    );
    expectQuarantined(
      Reflect.apply(handoffAuthenticatedSyntheticFilingParserResults, null, [
        current.originalArchive,
        current.amendmentArchive,
        current.originalEnvelope,
        current.amendmentEnvelope,
      ]),
    );
    expectQuarantined(
      Reflect.apply(handoffAuthenticatedSyntheticFilingParserResults, null, [
        current.originalArchive,
        current.amendmentArchive,
        current.originalEnvelope,
        current.amendmentEnvelope,
        current.options,
        ERROR_CANARY,
      ]),
    );
  });

  it("uses intrinsic carrier metadata and copy paths without caller hooks", () => {
    const current = fixture();
    const hooks = [
      current.originalArchive,
      current.amendmentArchive,
      current.originalEnvelope,
      current.amendmentEnvelope,
      current.options.publicKeySpki,
    ];
    for (const bytes of hooks) {
      Object.defineProperties(bytes, {
        buffer: {
          configurable: true,
          get: () => {
            throw new Error(ERROR_CANARY);
          },
        },
        byteLength: {
          configurable: true,
          get: () => {
            throw new Error(ERROR_CANARY);
          },
        },
        constructor: {
          configurable: true,
          get: () => {
            throw new Error(ERROR_CANARY);
          },
        },
        set: {
          configurable: true,
          value: () => {
            throw new Error(ERROR_CANARY);
          },
        },
        [Symbol.iterator]: {
          configurable: true,
          value: () => {
            throw new Error(ERROR_CANARY);
          },
        },
      });
    }
    expect(call(current).status).toBe("normalized");
  });

  it("rejects proxy, subclass, shared, alternate, detached, and oversized carriers", () => {
    const proxyFixture = fixture();
    const getPrototypeOf = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    expectQuarantined(
      call(proxyFixture, {
        originalArchive: new Proxy(proxyFixture.originalArchive, {
          getPrototypeOf,
        }),
      }),
    );
    expect(getPrototypeOf).not.toHaveBeenCalled();

    class BytesSubclass extends Uint8Array {}
    const subclassFixture = fixture();
    expectQuarantined(
      call(subclassFixture, {
        originalArchive: new BytesSubclass(subclassFixture.originalArchive),
      }),
    );

    const sharedFixture = fixture();
    const sharedBacking = new SharedArrayBuffer(
      sharedFixture.originalArchive.byteLength,
    );
    new Uint8Array(sharedBacking).set(sharedFixture.originalArchive);
    Object.setPrototypeOf(sharedBacking, ArrayBuffer.prototype);
    expectQuarantined(
      call(sharedFixture, {
        originalArchive: new Uint8Array(sharedBacking),
      }),
    );

    const alternateFixture = fixture();
    const alternate = new Int8Array(alternateFixture.originalArchive.length);
    alternate.set(alternateFixture.originalArchive);
    Object.setPrototypeOf(alternate, Uint8Array.prototype);
    expectQuarantined(call(alternateFixture, { originalArchive: alternate }));

    const detachedFixture = fixture();
    const detached = Uint8Array.from(detachedFixture.originalArchive);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    expectQuarantined(call(detachedFixture, { originalArchive: detached }));

    const oversizedFixture = fixture();
    expectQuarantined(
      call(oversizedFixture, {
        originalArchive: new Uint8Array(
          FILING_PARSER_NORMALIZATION_HANDOFF_LIMITS.archiveBytes + 1,
        ),
      }),
    );
  });

  it("rejects non-canonical and non-Ed25519 DER SPKI bytes", () => {
    const trailingFixture = fixture();
    const trailingSpki = new Uint8Array(
      trailingFixture.options.publicKeySpki.byteLength + 1,
    );
    trailingSpki.set(trailingFixture.options.publicKeySpki);
    expectQuarantined(
      call(trailingFixture, {
        options: {
          ...trailingFixture.options,
          publicKeySpki: trailingSpki,
        },
      }),
    );

    const wrongAlgorithmFixture = fixture();
    const { publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    expectQuarantined(
      call(wrongAlgorithmFixture, {
        options: {
          ...wrongAlgorithmFixture.options,
          publicKeySpki: Uint8Array.from(
            publicKey.export({ format: "der", type: "spki" }),
          ),
        },
      }),
    );
  });

  it("rejects strict-option accessors without invoking or disclosing them", () => {
    const current = fixture();
    const accessor = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const options = {
      expectedImageSha256: current.options.expectedImageSha256,
      expectedKeyId: current.options.expectedKeyId,
      publicKeySpki: current.options.publicKeySpki,
    } as Record<string, unknown>;
    Object.defineProperty(options, "expectedKeyId", {
      configurable: true,
      enumerable: true,
      get: accessor,
    });
    const result = call(current, { options });
    expectQuarantined(result);
    expect(accessor).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(ERROR_CANARY);
  });

  it("rejects proxy options before any caller metadata trap can run", () => {
    const current = fixture();
    const ownKeys = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const getOwnPropertyDescriptor = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const getPrototypeOf = vi.fn(() => {
      throw new Error(ERROR_CANARY);
    });
    const options = new Proxy(current.options, {
      getOwnPropertyDescriptor,
      getPrototypeOf,
      ownKeys,
    });
    expectQuarantined(call(current, { options }));
    expect(ownKeys).not.toHaveBeenCalled();
    expect(getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(getPrototypeOf).not.toHaveBeenCalled();
  });

  it("returns one deeply frozen empty value-free quarantine for every failure", () => {
    const current = fixture();
    const result = call(current, {
      originalEnvelope: new TextEncoder().encode(ERROR_CANARY),
    });
    expect(result).toEqual({
      claim:
        "bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff",
      code: "handoff_quarantined",
      normalization: null,
      provenance: null,
      schemaVersion: "1.0.0",
      status: "quarantined",
      synthetic: true,
    });
    expect(Object.isFrozen(result)).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(ERROR_CANARY);
    expect(serialized).not.toMatch(
      /"document"|"facts"|"signature"|sha256:[0-9a-f]|"keyId"|"imageSha256"/iu,
    );
  });
});

function fixture(): SyntheticFilingParserNormalizationHandoffFixture {
  return buildSyntheticFilingParserNormalizationHandoffFixture();
}

function call(
  current: SyntheticFilingParserNormalizationHandoffFixture,
  overrides: {
    readonly amendmentArchive?: unknown;
    readonly amendmentEnvelope?: unknown;
    readonly options?: unknown;
    readonly originalArchive?: unknown;
    readonly originalEnvelope?: unknown;
  } = {},
): FilingParserNormalizationHandoffResult {
  return handoffAuthenticatedSyntheticFilingParserResults(
    overrides.originalArchive ?? current.originalArchive,
    overrides.amendmentArchive ?? current.amendmentArchive,
    overrides.originalEnvelope ?? current.originalEnvelope,
    overrides.amendmentEnvelope ?? current.amendmentEnvelope,
    overrides.options ?? current.options,
  );
}

function signedEnvelope(
  current: SyntheticFilingParserNormalizationHandoffFixture,
  role: "amendment" | "original",
  document: JsonRecord,
): Uint8Array {
  return buildSignedSyntheticHandoffEnvelope(
    document,
    role === "original" ? current.originalArchive : current.amendmentArchive,
    current.privateKey,
    current.options,
  );
}

function envelope(bytes: Uint8Array): JsonRecord {
  return decodeSyntheticHandoffEnvelope(bytes);
}

function documentOf(value: JsonRecord): JsonRecord {
  return record(record(value.payload).document);
}

function record(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError();
  return value as JsonRecord;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError();
  return value;
}

function expectQuarantined(result: unknown): void {
  const candidate = record(result);
  expect(candidate.status).toBe("quarantined");
  expect(candidate.code).toBe("handoff_quarantined");
  expect(candidate.normalization).toBeNull();
  expect(candidate.provenance).toBeNull();
}
