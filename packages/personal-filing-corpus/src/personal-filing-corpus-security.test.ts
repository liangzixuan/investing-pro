import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  PERSONAL_FILING_CORPUS_LIMITS,
  PersonalFilingCorpusError,
  verifyPersonalFilingCorpusManifest,
  type PersonalFilingCorpusInput,
} from "./personal-filing-corpus";

type JsonRecord = Record<string, unknown>;

describe("personal filing corpus security boundary", () => {
  it("accepts exactly one argument with exactly two enumerable data properties", () => {
    const valid = buildDocuments();
    expectFailure(
      () =>
        Reflect.apply(verifyPersonalFilingCorpusManifest, undefined, [
          valid,
          valid,
        ]),
      "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest({
          ...valid,
          ignored: true,
        } as PersonalFilingCorpusInput),
      "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );

    const accessor = {
      get declaration(): Uint8Array {
        throw new Error("ACCESSOR_CANARY");
      },
      manifest: valid.manifest,
    };
    expectFailure(
      () => verifyPersonalFilingCorpusManifest(accessor),
      "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );
  });

  it("owns ArrayBuffer-backed Uint8Array snapshots and rejects hostile carriers", () => {
    const valid = buildDocuments();
    const subclass = new (class extends Uint8Array {})(valid.manifest);
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest({
          declaration: valid.declaration,
          manifest: subclass,
        }),
      "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );

    const proxy = new Proxy(valid.manifest, {
      getPrototypeOf() {
        throw new Error("PROXY_CANARY");
      },
    });
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest({
          declaration: valid.declaration,
          manifest: proxy,
        }),
      "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );

    const shared = new Uint8Array(new SharedArrayBuffer(valid.manifest.length));
    shared.set(valid.manifest);
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest({
          declaration: valid.declaration,
          manifest: shared,
        }),
      "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );
  });

  it("rejects oversized, malformed UTF-8, noncanonical, and duplicate-key documents", () => {
    const valid = buildDocuments();
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest({
          declaration: valid.declaration,
          manifest: new Uint8Array(
            PERSONAL_FILING_CORPUS_LIMITS.manifestBytes + 1,
          ),
        }),
      "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
    );
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest({
          declaration: new Uint8Array([0xc3, 0x28, 0x0a]),
          manifest: valid.manifest,
        }),
      "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
    );

    const declarationText = new TextDecoder().decode(valid.declaration);
    const duplicate = declarationText.replace(
      '"singleUser":true',
      '"singleUser":true,"singleUser":true',
    );
    for (const declaration of [
      new TextEncoder().encode(declarationText.trimEnd()),
      new TextEncoder().encode(` ${declarationText}`),
      new TextEncoder().encode(duplicate),
    ]) {
      expectFailure(
        () =>
          verifyPersonalFilingCorpusManifest({
            declaration,
            manifest: valid.manifest,
          }),
        "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
      );
    }

    const prettyManifest = new TextEncoder().encode(
      `${JSON.stringify(JSON.parse(new TextDecoder().decode(valid.manifest)), null, 2)}\n`,
    );
    expectFailure(
      () => verifyPersonalFilingCorpusManifest(bindRawManifest(prettyManifest)),
      "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
    );
  });

  it("enforces bounded JSON structure before closed-schema validation", () => {
    let nested: unknown = "leaf";
    for (
      let depth = 0;
      depth <= PERSONAL_FILING_CORPUS_LIMITS.documentDepth;
      depth += 1
    ) {
      nested = [nested];
    }
    const declaration = canonicalBytes(nested);
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest({
          declaration,
          manifest: buildDocuments().manifest,
        }),
      "PERSONAL_FILING_CORPUS_DECLARATION_INVALID",
    );

    const manyNodesManifest = canonicalBytes(
      Array.from(
        { length: PERSONAL_FILING_CORPUS_LIMITS.documentNodes + 1 },
        () => null,
      ),
    );
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest(bindRawManifest(manyNodesManifest)),
      "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
    );

    const tooManyStringCodePoints = canonicalBytes(
      "x".repeat(PERSONAL_FILING_CORPUS_LIMITS.aggregateStringCodePoints + 1),
    );
    expectFailure(
      () =>
        verifyPersonalFilingCorpusManifest(
          bindRawManifest(tooManyStringCodePoints),
        ),
      "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
    );
  });

  it("rejects duplicate identities, bad ordering, and invalid amendment lineage", () => {
    const mutations: Array<(documents: MutableDocuments) => void> = [
      (documents) => {
        documents.manifest.entries.push({
          ...documents.manifest.entries[0]!,
          accession: "0001234567-26-000002",
          sourceLocator: "sec-edgar:0001234567-26-000002",
        });
      },
      (documents) => {
        documents.manifest.entries.unshift({
          ...documents.manifest.entries[0]!,
          accession: "0001234567-26-000002",
          contentSha256: `sha256:${"b".repeat(64)}`,
          sourceLocator: "sec-edgar:0001234567-26-000002",
        });
      },
      (documents) => {
        documents.manifest.entries[0]!.form = "10-K/A";
        documents.manifest.entries[0]!.amendmentOf = "0001234567-25-000999";
      },
      (documents) => {
        documents.manifest.entries.push({
          ...filingEntry(2, 456),
          acceptedAt: "2026-08-24T17:00:00.000Z",
          amendmentOf: "0001234567-26-000001",
          form: "10-K/A",
        });
      },
      (documents) => {
        documents.manifest.entries[0]!.cik = "0007654321";
      },
    ];
    for (const mutate of mutations) {
      const documents = mutableDocuments();
      mutate(documents);
      expectFailure(
        () => verifyMutable(documents),
        "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
      );
    }
  });

  it("rejects count, declared-byte, time, provenance, and metadata limit drift", () => {
    const mutations: Array<(documents: MutableDocuments) => void> = [
      (documents) => {
        documents.manifest.entries = [];
      },
      (documents) => {
        documents.manifest.entries = Array.from({ length: 101 }, (_, index) =>
          filingEntry(index + 1, 1),
        );
      },
      (documents) => {
        documents.manifest.entries[0]!.contentBytes =
          PERSONAL_FILING_CORPUS_LIMITS.entryContentBytes + 1;
      },
      (documents) => {
        documents.manifest.entries = Array.from({ length: 17 }, (_, index) =>
          filingEntry(
            index + 1,
            PERSONAL_FILING_CORPUS_LIMITS.entryContentBytes,
          ),
        );
      },
      (documents) => {
        documents.manifest.entries[0]!.availableAt = "2026-08-28T18:00:00.000Z";
      },
      (documents) => {
        documents.manifest.entries[0]!.source = "local_cache";
      },
      (documents) => {
        documents.manifest.entries[0]!.sourceLocator =
          "sec-edgar:0001234567-26-999999";
      },
      (documents) => {
        documents.manifest.entries[0]!.taxonomy = "../../unsafe";
      },
    ];
    for (const mutate of mutations) {
      const documents = mutableDocuments();
      mutate(documents);
      expectFailure(
        () => verifyMutable(documents),
        "PERSONAL_FILING_CORPUS_MANIFEST_INVALID",
      );
    }
  });

  it("returns aggregate-only immutable records and emits no input-bearing logs", () => {
    const documents = buildDocuments();
    const consoleSpies = [
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];
    const result = verifyPersonalFilingCorpusManifest(documents);

    expect(Object.keys(result).sort()).toEqual([
      "claim",
      "corpusId",
      "corpusVersion",
      "declarationSha256",
      "filingCount",
      "frozenAt",
      "manifestSha256",
      "profile",
      "retentionDays",
      "schemaVersion",
      "status",
      "totalDeclaredBytes",
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    vi.restoreAllMocks();
  });

  it("uses fixed value-free errors for adversarial input", () => {
    const secret = "SECRET_ACCESSION_CANARY_847219";
    const declaration = new TextEncoder().encode(`{"${secret}":true}\n`);
    try {
      verifyPersonalFilingCorpusManifest({
        declaration,
        manifest: buildDocuments().manifest,
      });
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonalFilingCorpusError);
      expect((error as Error).message).toBe(
        "Personal filing corpus verification failed.",
      );
      expect((error as Error).message).not.toContain(secret);
      expect(String(error)).not.toContain(secret);
      expect(Object.keys(error as object).sort()).toEqual(["code", "name"]);
    }
  });

  it("replaces forged exported errors from hostile carrier traps", () => {
    const secret = "SECRET_FORGED_ERROR_CANARY_981274";
    const forged = new PersonalFilingCorpusError(
      secret as "PERSONAL_FILING_CORPUS_INVALID_INPUT",
    );
    forged.message = secret;
    Object.assign(forged, { secret });
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw forged;
        },
      },
    ) as unknown as PersonalFilingCorpusInput;

    try {
      verifyPersonalFilingCorpusManifest(hostile);
      throw new Error("expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonalFilingCorpusError);
      expect(error).not.toBe(forged);
      expect((error as PersonalFilingCorpusError).code).toBe(
        "PERSONAL_FILING_CORPUS_INVALID_INPUT",
      );
      expect((error as Error).message).toBe(
        "Personal filing corpus verification failed.",
      );
      expect(String(error)).not.toContain(secret);
      expect(Object.keys(error as object).sort()).toEqual(["code", "name"]);
    }
  });
});

interface MutableDocuments {
  declaration: JsonRecord;
  manifest: JsonRecord & { entries: JsonRecord[] };
}

function buildDocuments(): PersonalFilingCorpusInput {
  return toBytes(mutableDocuments());
}

function mutableDocuments(): MutableDocuments {
  return {
    declaration: {
      commercialUse: "prohibited",
      corpusId: "personal-filings-2026",
      corpusVersion: "1.0.0",
      deleteOnRequest: true,
      deletionMode: "user_managed_local_delete",
      localOnly: true,
      manifestSha256: `sha256:${"0".repeat(64)}`,
      profile: "personal_single_user_local",
      purpose: "personal_offline_filing_research_only",
      redistribution: "prohibited",
      retentionDays: 365,
      schemaVersion: "1.0.0",
      singleUser: true,
    },
    manifest: {
      corpusId: "personal-filings-2026",
      corpusVersion: "1.0.0",
      entries: [filingEntry(1, 12_345)],
      frozenAt: "2026-08-27T18:00:00.000Z",
      profile: "personal_single_user_local",
      schemaVersion: "1.0.0",
    },
  };
}

function filingEntry(sequence: number, contentBytes: number): JsonRecord {
  const accession = `0001234567-26-${String(sequence).padStart(6, "0")}`;
  return {
    acceptedAt: "2026-08-25T17:00:00.000Z",
    accession,
    amendmentOf: null,
    availableAt: "2026-08-25T17:00:01.000Z",
    cik: "0001234567",
    contentBytes,
    contentSha256: sha256(
      new TextEncoder().encode(`declared-content-${sequence}`),
    ),
    form: "10-K",
    mediaType: "text/html",
    source: "sec_edgar",
    sourceLocator: `sec-edgar:${accession}`,
    taxonomy: "us-gaap-2026",
  };
}

function verifyMutable(documents: MutableDocuments) {
  return verifyPersonalFilingCorpusManifest(toBytes(documents));
}

function toBytes(documents: MutableDocuments): PersonalFilingCorpusInput {
  const manifest = canonicalBytes(documents.manifest);
  documents.declaration.manifestSha256 = sha256(manifest);
  return {
    declaration: canonicalBytes(documents.declaration),
    manifest,
  };
}

function bindRawManifest(manifest: Uint8Array): PersonalFilingCorpusInput {
  const declaration = mutableDocuments().declaration;
  declaration.manifestSha256 = sha256(manifest);
  return { declaration: canonicalBytes(declaration), manifest };
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function expectFailure(
  callback: () => unknown,
  code: PersonalFilingCorpusError["code"],
): void {
  try {
    callback();
    throw new Error("expected verification to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalFilingCorpusError);
    expect((error as PersonalFilingCorpusError).code).toBe(code);
    expect((error as Error).message).toBe(
      "Personal filing corpus verification failed.",
    );
  }
}
