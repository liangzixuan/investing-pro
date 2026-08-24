import {
  createHash,
  generateKeyPairSync,
  sign as ed25519Sign,
  type KeyObject,
} from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  FILING_CORPUS_ADMISSION_CHECKS,
  FILING_CORPUS_ADMISSION_CLAIM,
  FILING_CORPUS_ADMISSION_COUNT,
  FILING_CORPUS_ADMISSION_NOT_PROVEN,
  FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
  FilingCorpusAdmissionError,
  verifyFilingCorpusAdmission,
  type FilingCorpusAdmissionFailureCode,
  type FilingCorpusAdmissionInput,
} from "./corpus-admission";

const JSON_CANARY = "rejected-metadata-canary";
const RIGHTS_KEY_ID = "cycle2b-synthetic-rights-key-v1";
const STEWARD_KEY_ID = "cycle2b-synthetic-steward-key-v1";
const CORPUS_ID = "cycle2b-synthetic-candidate-v1";
const EVALUATED_AT = "2026-08-20T12:00:00.000Z";
const APPROVAL_DOMAIN = new TextEncoder().encode(
  "research-cockpit:filing-corpus-approval:v1\u0000",
);
const MANIFEST_PATHS = Object.freeze({
  adjudicationProtocol: "config/filing-corpus/v1/adjudication-protocol.json",
  authorityKeys: "config/filing-corpus/v1/authority-keys.json",
  candidateManifest: "config/filing-corpus/v1/candidate-manifest.json",
  rightsApproval: "config/filing-corpus/v1/rights-approval.json",
  selectionPlan: "config/filing-corpus/v1/selection-plan.json",
  stewardApproval: "config/filing-corpus/v1/steward-approval.json",
});
const rightsKeyPair = generateKeyPairSync("ed25519");
const stewardKeyPair = generateKeyPairSync("ed25519");

type DocumentName = "manifest" | keyof typeof MANIFEST_PATHS;
type JsonRecord = Record<string, unknown>;

interface SecurityHarness {
  readonly documents: Record<DocumentName, JsonRecord>;
  readonly input: FilingCorpusAdmissionInput;
}

interface HarnessOptions {
  readonly rightsRevokedAt?: string | null;
  readonly stewardRevokedAt?: string | null;
}

const DOCUMENT_BYTE_ROLES = [
  ["adjudicationProtocol", 65_536, "FILING_CORPUS_DOCUMENT_INVALID"],
  ["authorityKeys", 16_384, "FILING_CORPUS_AUTHORITY_INVALID"],
  ["candidateManifest", 524_288, "FILING_CORPUS_DOCUMENT_INVALID"],
  ["manifest", 65_536, "FILING_CORPUS_DOCUMENT_INVALID"],
  ["rightsApproval", 16_384, "FILING_CORPUS_APPROVAL_INVALID"],
  ["selectionPlan", 65_536, "FILING_CORPUS_DOCUMENT_INVALID"],
  ["stewardApproval", 16_384, "FILING_CORPUS_APPROVAL_INVALID"],
] as const satisfies readonly (readonly [
  DocumentName,
  number,
  FilingCorpusAdmissionFailureCode,
])[];

describe("Cycle 2b filing corpus admission security boundary", () => {
  it("admits only aggregate metadata and replays deterministically", () => {
    const harness = buildHarness();

    const first = verifyFilingCorpusAdmission(harness.input);
    const second = verifyFilingCorpusAdmission(cloneInput(harness.input));

    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).toMatchObject({
      claim: FILING_CORPUS_ADMISSION_CLAIM,
      corpusId: CORPUS_ID,
      corpusVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
      evaluatedAt: EVALUATED_AT,
      filingCount: FILING_CORPUS_ADMISSION_COUNT,
      schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
      status: "admitted",
      validUntil: "2026-12-31T00:00:00.000Z",
    });
    expect(Object.keys(first).sort()).toEqual(
      [
        "adjudicationProtocolSha256",
        "authorityKeysSha256",
        "candidateManifestSha256",
        "claim",
        "corpusId",
        "corpusVersion",
        "evaluatedAt",
        "filingCount",
        "manifestSha256",
        "rightsApprovalSha256",
        "schemaVersion",
        "selectionPlanSha256",
        "status",
        "stewardApprovalSha256",
        "validUntil",
      ].sort(),
    );
    expect(first.authorityKeysSha256).toBe(sha256(harness.input.authorityKeys));
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("0000000001-25-000001");
    expect(serialized).not.toContain(RIGHTS_KEY_ID);
    expect(serialized).not.toContain(STEWARD_KEY_ID);
    expect(serialized).not.toContain("signature");
    expect(serialized).not.toContain("publicKeySpki");
    expect(serialized).not.toContain(JSON_CANARY);
    expect(FILING_CORPUS_ADMISSION_CHECKS).toHaveLength(16);
    expect(FILING_CORPUS_ADMISSION_NOT_PROVEN).toHaveLength(16);
  });

  it("rejects nonclosed input objects, symbols, accessors, and alien byte views value-free", () => {
    const harness = buildHarness();
    const accessor = vi.fn(() => harness.input.manifest);
    const iterator = vi.fn((): ArrayIterator<number> => {
      throw new Error(JSON_CANARY);
    });
    class AdversarialBytes extends Uint8Array {
      public override [Symbol.iterator](): ArrayIterator<number> {
        return iterator();
      }
    }
    const detachedBuffer = new ArrayBuffer(8);
    const detached = new Uint8Array(detachedBuffer);
    structuredClone(detachedBuffer, { transfer: [detachedBuffer] });
    const withAccessor = { ...harness.input } as Record<string, unknown>;
    Object.defineProperty(withAccessor, "manifest", {
      enumerable: true,
      get: accessor,
    });
    const withSymbol = {
      ...harness.input,
      [Symbol("forbidden")]: JSON_CANARY,
    };
    const invalid: unknown[] = [
      null,
      [],
      { ...harness.input, extra: JSON_CANARY },
      withSymbol,
      withAccessor,
      { ...harness.input, manifest: new ArrayBuffer(8) },
      { ...harness.input, manifest: new Uint16Array(4) },
      { ...harness.input, manifest: detached },
      { ...harness.input, manifest: new AdversarialBytes([1, 2, 3]) },
      {
        ...harness.input,
        manifest: new Uint8Array(new SharedArrayBuffer(8)),
      },
      { ...harness.input, evaluatedAt: "2026-08-20T12:00:00Z" },
    ];

    for (const value of invalid) {
      expectAdmissionFailure(
        () => verifyFilingCorpusAdmission(value as never),
        "FILING_CORPUS_INVALID_INPUT",
      );
    }
    expect(accessor).not.toHaveBeenCalled();
    expect(iterator).not.toHaveBeenCalled();
  });

  it("uses intrinsic metadata and preserves exact per-role oversize codes", () => {
    const harness = buildHarness();

    for (const [role, maximumBytes, oversizeCode] of DOCUMENT_BYTE_ROLES) {
      const original = harness.input[role];
      const shared = new Uint8Array(new SharedArrayBuffer(original.byteLength));
      shared.set(original);
      Object.defineProperties(shared, {
        buffer: { value: new ArrayBuffer(original.byteLength) },
        byteLength: { value: original.byteLength },
      });
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            [role]: shared,
          }),
        "FILING_CORPUS_INVALID_INPUT",
      );

      for (const [, carrier] of rePrototypedNonUint8Copies(original)) {
        expectAdmissionFailure(
          () =>
            verifyFilingCorpusAdmission({
              ...harness.input,
              [role]: carrier,
            }),
          "FILING_CORPUS_INVALID_INPUT",
        );
      }

      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            [role]: rePrototypedSharedCopy(original),
          }),
        "FILING_CORPUS_INVALID_INPUT",
      );

      const oversized = new Uint8Array(maximumBytes + 1);
      oversized.set(original);
      Object.defineProperties(oversized, {
        buffer: { value: new ArrayBuffer(original.byteLength) },
        byteLength: { value: original.byteLength },
      });
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            [role]: oversized,
          }),
        oversizeCode,
      );
    }
  });

  it("does not invoke caller metadata, iterator, allocation, or instance hooks for any document role", () => {
    const harness = buildHarness();

    for (const [role] of DOCUMENT_BYTE_ROLES) {
      for (const hook of [
        "buffer",
        "byteLength",
        "toStringTag",
        "constructor",
        "species",
        "iterator",
        "set",
      ] as const) {
        let calls = 0;
        const carrier = Uint8Array.from(harness.input[role]);
        if (hook === "constructor") {
          Object.defineProperty(carrier, "constructor", {
            get() {
              calls += 1;
              throw new Error(JSON_CANARY);
            },
          });
        } else if (hook === "species") {
          const constructor = {};
          Object.defineProperty(constructor, Symbol.species, {
            get() {
              calls += 1;
              throw new Error(JSON_CANARY);
            },
          });
          Object.defineProperty(carrier, "constructor", {
            value: constructor,
          });
        } else {
          Object.defineProperty(
            carrier,
            hook === "iterator"
              ? Symbol.iterator
              : hook === "toStringTag"
                ? Symbol.toStringTag
                : hook,
            {
              get() {
                calls += 1;
                throw new Error(JSON_CANARY);
              },
            },
          );
        }

        expect(
          verifyFilingCorpusAdmission({
            ...harness.input,
            [role]: carrier,
          }),
        ).toMatchObject({ status: "admitted" });
        expect(calls, `${role}:${hook}`).toBe(0);
      }
    }
  });

  it("owns all seven retained document sources after admission returns", () => {
    const harness = buildHarness();
    const retained = Object.fromEntries(
      DOCUMENT_BYTE_ROLES.map(([role]) => [
        role,
        Uint8Array.from(harness.input[role]),
      ]),
    ) as Record<DocumentName, Uint8Array>;
    const admitted = verifyFilingCorpusAdmission({
      ...harness.input,
      ...retained,
    });
    const expected = structuredClone(admitted);
    const originals = Object.fromEntries(
      DOCUMENT_BYTE_ROLES.map(([role]) => [
        role,
        Uint8Array.from(retained[role]),
      ]),
    ) as Record<DocumentName, Uint8Array>;

    for (const [role] of DOCUMENT_BYTE_ROLES) {
      retained[role].fill(0xa5);
      expect(retained[role], role).not.toEqual(originals[role]);
    }

    expect(admitted).toStrictEqual(expected);
    expect(admitted.status).toBe("admitted");
    expect(Object.isFrozen(admitted)).toBe(true);
  });

  it("rejects proxies, subclasses, and detached carriers in every document role", () => {
    const harness = buildHarness();
    class DocumentSubclass extends Uint8Array {}

    for (const [role] of DOCUMENT_BYTE_ROLES) {
      let prototypeTrapCalls = 0;
      const proxy = new Proxy(harness.input[role], {
        getPrototypeOf() {
          prototypeTrapCalls += 1;
          throw new Error(JSON_CANARY);
        },
      });
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            [role]: proxy,
          }),
        "FILING_CORPUS_INVALID_INPUT",
      );
      expect(prototypeTrapCalls, role).toBe(0);

      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            [role]: new DocumentSubclass(harness.input[role]),
          }),
        "FILING_CORPUS_INVALID_INPUT",
      );

      const detached = harness.input[role].slice();
      structuredClone(detached.buffer, { transfer: [detached.buffer] });
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            [role]: detached,
          }),
        "FILING_CORPUS_INVALID_INPUT",
      );
    }

    expect(verifyFilingCorpusAdmission(harness.input)).toMatchObject({
      status: "admitted",
    });
  });

  it("rejects noncanonical, duplicate-key, malformed UTF-8, and oversized documents", () => {
    const harness = buildHarness();
    const selectionText = new TextDecoder().decode(harness.input.selectionPlan);
    const duplicateKey = selectionText.replace(
      /^\{/u,
      `{"schemaVersion":"${FILING_CORPUS_ADMISSION_SCHEMA_VERSION}",`,
    );
    const cases: Array<{
      bytes: Uint8Array;
      code: FilingCorpusAdmissionFailureCode;
      name: DocumentName;
    }> = [
      {
        name: "selectionPlan",
        bytes: new TextEncoder().encode(` ${selectionText}`),
        code: "FILING_CORPUS_DOCUMENT_INVALID",
      },
      {
        name: "selectionPlan",
        bytes: new TextEncoder().encode(selectionText.trimEnd()),
        code: "FILING_CORPUS_DOCUMENT_INVALID",
      },
      {
        name: "selectionPlan",
        bytes: new TextEncoder().encode(`${selectionText}\n`),
        code: "FILING_CORPUS_DOCUMENT_INVALID",
      },
      {
        name: "selectionPlan",
        bytes: new Uint8Array([0xff, 0xfe, 0xfd]),
        code: "FILING_CORPUS_DOCUMENT_INVALID",
      },
      {
        name: "selectionPlan",
        bytes: new TextEncoder().encode(`\ufeff${selectionText}`),
        code: "FILING_CORPUS_DOCUMENT_INVALID",
      },
      {
        name: "selectionPlan",
        bytes: new TextEncoder().encode(duplicateKey),
        code: "FILING_CORPUS_DOCUMENT_INVALID",
      },
      {
        name: "selectionPlan",
        bytes: new Uint8Array(65_537),
        code: "FILING_CORPUS_DOCUMENT_INVALID",
      },
      {
        name: "authorityKeys",
        bytes: new TextEncoder().encode("{}\n"),
        code: "FILING_CORPUS_AUTHORITY_INVALID",
      },
      {
        name: "rightsApproval",
        bytes: new TextEncoder().encode("{}\n"),
        code: "FILING_CORPUS_APPROVAL_INVALID",
      },
    ];

    for (const candidate of cases) {
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            [candidate.name]: candidate.bytes,
          }),
        candidate.code,
      );
    }
  });

  it("rejects inventory duplication, weighting, malformed identity, ordering, amendment, and scope", () => {
    const mutations: Array<{
      code: FilingCorpusAdmissionFailureCode;
      mutate: (candidate: JsonRecord) => void;
    }> = [
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          entries(candidate).pop();
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          entries(candidate).push(cloneJson(entry(candidate, 99)));
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          entry(candidate, 1).accession = entry(candidate, 0).accession;
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          entry(candidate, 1).contentSha256 = entry(candidate, 0).contentSha256;
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          entry(candidate, 0).cik = "9999999999";
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          const filingEntries = entries(candidate);
          const first = entry(candidate, 0);
          const second = entry(candidate, 1);
          filingEntries[0] = second;
          filingEntries[1] = first;
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          entry(candidate, 0).form = "10-K/A";
          entry(candidate, 0).amendmentOf = "0000009999-25-009999";
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (candidate) => {
          entry(candidate, 0).availableAt = "2026-02-03T00:00:00.000Z";
        },
      },
      {
        code: "FILING_CORPUS_SCOPE_MISMATCH",
        mutate: (candidate) => {
          candidate.selectionPlanSha256 = hashText("wrong-plan");
        },
      },
      {
        code: "FILING_CORPUS_SCOPE_MISMATCH",
        mutate: (candidate) => {
          candidate.adjudicationProtocolSha256 = hashText("wrong-protocol");
        },
      },
    ];

    for (const mutation of mutations) {
      const harness = buildHarness();
      const candidate = cloneJson(harness.documents.candidateManifest);
      mutation.mutate(candidate);
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            candidateManifest: jsonDocument(candidate),
          }),
        mutation.code,
      );
    }
  });

  it("rejects unfrozen or incoherent selection and adjudication controls", () => {
    const selectionMutations: Array<(selection: JsonRecord) => void> = [
      (selection) => {
        selection.targetCount = 99;
      },
      (selection) => {
        selection.eligibleForms = ["10-K", "10-Q", "10-K/A", "10-Q/A"];
      },
      (selection) => {
        selection.exclusions = [
          { count: 3, reasonCode: "outside-time-window" },
          { count: 2, reasonCode: "duplicate-accession" },
        ];
      },
      (selection) => {
        selection.candidateUniverseCount = 104;
      },
      (selection) => {
        exclusion(selection, 0).count = 0;
      },
      (selection) => {
        selection.frozenAt = "2024-12-31T23:59:59.999Z";
      },
      (selection) => {
        selection.strata = [{ id: "all-filings", targetCount: 99 }];
      },
    ];
    for (const mutate of selectionMutations) {
      const harness = buildHarness();
      const selection = cloneJson(harness.documents.selectionPlan);
      mutate(selection);
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            selectionPlan: jsonDocument(selection),
          }),
        "FILING_CORPUS_DOCUMENT_INVALID",
      );
    }

    const protocolMutations: Array<(protocol: JsonRecord) => void> = [
      (protocol) => {
        protocol.blindedToParserResults = false;
      },
      (protocol) => {
        protocol.assertionTarget = 1_999;
      },
      (protocol) => {
        protocol.factKeys = (protocol.factKeys as string[]).slice(0, 9);
      },
      (protocol) => {
        protocol.metrics = [...(protocol.metrics as string[])].reverse();
      },
      (protocol) => {
        (protocol.thresholds as JsonRecord).maximumSilentCriticalFailures = 1;
      },
    ];
    for (const mutate of protocolMutations) {
      const harness = buildHarness();
      const protocol = cloneJson(harness.documents.adjudicationProtocol);
      mutate(protocol);
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            adjudicationProtocol: jsonDocument(protocol),
          }),
        "FILING_CORPUS_DOCUMENT_INVALID",
      );
    }
  });

  it("rejects malformed supplied authority material, inactive approvals, and role confusion", () => {
    const authorityMutations: Array<(authority: JsonRecord) => void> = [
      (authority) => {
        authority.schemaVersion = "2.0.0";
      },
      (authority) => {
        key(authority, 1).role = "rights_authority";
      },
      (authority) => {
        key(authority, 1).keyId = RIGHTS_KEY_ID;
      },
      (authority) => {
        key(authority, 1).publicKeySpki = key(authority, 0).publicKeySpki;
      },
      (authority) => {
        key(authority, 0).algorithm = "rsa";
      },
      (authority) => {
        key(authority, 0).publicKeySpki = "not-base64";
      },
      (authority) => {
        key(authority, 0).validTo = key(authority, 0).validFrom;
      },
    ];
    for (const mutate of authorityMutations) {
      const harness = buildHarness();
      const authority = cloneJson(harness.documents.authorityKeys);
      mutate(authority);
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            authorityKeys: jsonDocument(authority),
          }),
        "FILING_CORPUS_AUTHORITY_INVALID",
      );
    }

    const harness = buildHarness();
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission({
          ...harness.input,
          evaluatedAt: "2026-12-31T00:00:00.000Z",
        }),
      "FILING_CORPUS_APPROVAL_INACTIVE",
    );
    const revoked = buildHarness({
      rightsRevokedAt: "2026-08-20T12:00:00.000Z",
    });
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(revoked.input),
      "FILING_CORPUS_APPROVAL_INACTIVE",
    );
  });

  it("binds approvals to authority validity, every scope digest, and canonical signatures", () => {
    const harness = buildHarness();
    for (const field of [
      "adjudicationProtocolSha256",
      "authorityKeysSha256",
      "candidateManifestSha256",
      "selectionPlanSha256",
    ] as const) {
      const wrongScope = cloneJson(harness.documents.rightsApproval);
      wrongScope[field] = hashText(`wrong-${field}`);
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            rightsApproval: jsonDocument(wrongScope),
          }),
        "FILING_CORPUS_SCOPE_MISMATCH",
      );
    }

    const wrongPurpose = cloneJson(harness.documents.rightsApproval);
    wrongPurpose.purpose = "production_ingestion";
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission({
          ...harness.input,
          rightsApproval: jsonDocument(wrongPurpose),
        }),
      "FILING_CORPUS_APPROVAL_INVALID",
    );

    const badSignature = cloneJson(harness.documents.rightsApproval);
    badSignature.signature = mutateBase64UrlCharacter(
      badSignature.signature as string,
    );
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission({
          ...harness.input,
          rightsApproval: jsonDocument(badSignature),
        }),
      "FILING_CORPUS_SIGNATURE_INVALID",
    );

    const wrongKey = signApproval(
      cloneJson(harness.documents.rightsApproval),
      stewardKeyPair.privateKey,
    );
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission({
          ...harness.input,
          rightsApproval: jsonDocument(wrongKey),
        }),
      "FILING_CORPUS_SIGNATURE_INVALID",
    );

    const alias = cloneJson(harness.documents.rightsApproval);
    alias.signature = nonCanonicalBase64UrlAlias(alias.signature as string);
    const aliasBytes = jsonDocument(alias);
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission(
          replaceDocumentAndRebindManifest(
            harness,
            "rightsApproval",
            aliasBytes,
          ),
        ),
      "FILING_CORPUS_APPROVAL_INVALID",
    );

    const revoked = buildHarness({
      rightsRevokedAt: "2026-08-20T11:00:00.000Z",
    });
    const alteredAuthority = cloneJson(revoked.documents.authorityKeys);
    key(alteredAuthority, 0).revokedAt = null;
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission(
          replaceDocumentAndRebindManifest(
            revoked,
            "authorityKeys",
            jsonDocument(alteredAuthority),
          ),
        ),
      "FILING_CORPUS_SCOPE_MISMATCH",
    );
  });

  it("rejects approval separation failures and an altered signed retention scope", () => {
    const harness = buildHarness();
    const sameApproval = cloneJson(harness.documents.stewardApproval);
    sameApproval.approvalId = harness.documents.rightsApproval.approvalId;
    const resignedSameApproval = signApproval(
      sameApproval,
      stewardKeyPair.privateKey,
    );
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission({
          ...harness.input,
          stewardApproval: jsonDocument(resignedSameApproval),
        }),
      "FILING_CORPUS_SCOPE_MISMATCH",
    );

    const differentRetention = cloneJson(harness.documents.stewardApproval);
    differentRetention.retentionClass = "different-retention-class";
    const resignedRetention = signApproval(
      differentRetention,
      stewardKeyPair.privateKey,
    );
    expectAdmissionFailure(
      () =>
        verifyFilingCorpusAdmission({
          ...harness.input,
          stewardApproval: jsonDocument(resignedRetention),
        }),
      "FILING_CORPUS_SCOPE_MISMATCH",
    );
  });

  it("requires the exact checks, nonclaims, file order, hashes, and claim", () => {
    const mutations: Array<{
      code: FilingCorpusAdmissionFailureCode;
      mutate: (manifest: JsonRecord) => void;
    }> = [
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (manifest) => {
          (manifest.checks as string[])[0] = "weakened-check";
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (manifest) => {
          (manifest.nonclaims as string[]).pop();
        },
      },
      {
        code: "FILING_CORPUS_DOCUMENT_INVALID",
        mutate: (manifest) => {
          manifest.claim = "broader-production-claim";
        },
      },
      {
        code: "FILING_CORPUS_SCOPE_MISMATCH",
        mutate: (manifest) => {
          const files = manifestFiles(manifest);
          const first = manifestFile(manifest, 0);
          const second = manifestFile(manifest, 1);
          files[0] = second;
          files[1] = first;
        },
      },
      {
        code: "FILING_CORPUS_SCOPE_MISMATCH",
        mutate: (manifest) => {
          manifestFile(manifest, 0).sha256 = hashText("wrong-file");
        },
      },
    ];

    for (const mutation of mutations) {
      const harness = buildHarness();
      const manifest = cloneJson(harness.documents.manifest);
      mutation.mutate(manifest);
      expectAdmissionFailure(
        () =>
          verifyFilingCorpusAdmission({
            ...harness.input,
            manifest: jsonDocument(manifest),
          }),
        mutation.code,
      );
    }
  });

  it("keeps every failure atomic, aggregate-only, and free of rejected values", () => {
    const harness = buildHarness();
    const approval = cloneJson(harness.documents.rightsApproval);
    approval.approvalId = JSON_CANARY;
    const error = captureAdmissionError(() =>
      verifyFilingCorpusAdmission({
        ...harness.input,
        rightsApproval: jsonDocument(approval),
      }),
    );

    expect(error).toBeInstanceOf(FilingCorpusAdmissionError);
    expect(error.message).toBe("Filing corpus admission failed.");
    expect(String(error)).toBe(
      "FilingCorpusAdmissionError: Filing corpus admission failed.",
    );
    expect(String(error)).not.toContain(JSON_CANARY);
    expect(JSON.stringify(error)).not.toContain(JSON_CANARY);
    expect(error).not.toHaveProperty("record");
    expect(error).not.toHaveProperty("partial");
    expect(error).not.toHaveProperty("accession");
  });
});

function buildHarness(options: HarnessOptions = {}): SecurityHarness {
  const selectionPlan: JsonRecord = {
    acceptanceWindow: {
      from: "2025-01-01T00:00:00.000Z",
      toExclusive: "2026-01-01T00:00:00.000Z",
    },
    candidateUniverseCount: 105,
    candidateUniverseSha256: hashText("synthetic-candidate-universe"),
    eligibleForms: ["10-K", "10-K/A", "10-Q", "10-Q/A"],
    exclusions: [
      { count: 2, reasonCode: "duplicate-accession" },
      { count: 3, reasonCode: "outside-time-window" },
    ],
    frozenAt: "2026-01-02T00:00:00.000Z",
    planId: "cycle2b-synthetic-selection-plan",
    planVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    selectionMethod: "predeclared_stratified_content_hash_v1",
    selectionSeedSha256: hashText("synthetic-selection-seed"),
    strata: [{ id: "all-filings", targetCount: 100 }],
    targetCount: FILING_CORPUS_ADMISSION_COUNT,
  };
  const adjudicationProtocol: JsonRecord = {
    assertionTarget: 2_000,
    blindedToParserResults: true,
    factKeys: [
      "assets",
      "cash",
      "equity",
      "liabilities",
      "net-income",
      "operating-income",
      "revenue",
      "shares",
      "tax-expense",
      "working-capital",
    ],
    frozenAt: "2026-01-02T00:00:00.000Z",
    independentAdjudicators: 2,
    metrics: [
      "document_success",
      "fact_precision",
      "fact_recall",
      "unit_date_tolerance",
      "silent_critical_failure",
      "quarantine_rate",
    ],
    protocolId: "cycle2b-synthetic-adjudication-protocol",
    protocolVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    resolution: "independent_then_blinded_resolution",
    schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    thresholds: {
      dateToleranceDays: 0,
      documentSuccessMinimum: "1",
      factPrecisionMinimum: "1",
      factRecallMinimum: "1",
      maximumQuarantineRate: "0",
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact-unit-and-currency",
    },
  };
  const selectionPlanBytes = jsonDocument(selectionPlan);
  const adjudicationProtocolBytes = jsonDocument(adjudicationProtocol);
  const candidateManifest: JsonRecord = {
    adjudicationProtocolSha256: sha256(adjudicationProtocolBytes),
    corpusId: CORPUS_ID,
    corpusVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    entries: Array.from({ length: FILING_CORPUS_ADMISSION_COUNT }, (_, index) =>
      syntheticEntry(index),
    ),
    frozenAt: "2026-02-02T00:00:00.000Z",
    schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    selectionPlanSha256: sha256(selectionPlanBytes),
  };
  const candidateManifestBytes = jsonDocument(candidateManifest);
  const authorityKeys: JsonRecord = {
    keys: [
      authorityKey(
        "rights_authority",
        RIGHTS_KEY_ID,
        rightsKeyPair.publicKey,
        options.rightsRevokedAt ?? null,
      ),
      authorityKey(
        "data_steward",
        STEWARD_KEY_ID,
        stewardKeyPair.publicKey,
        options.stewardRevokedAt ?? null,
      ),
    ],
    schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
  };
  const authorityKeysBytes = jsonDocument(authorityKeys);
  const approvalScope = {
    adjudicationProtocolSha256: sha256(adjudicationProtocolBytes),
    aiUse: "prohibited",
    approvalVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    authorityKeysSha256: sha256(authorityKeysBytes),
    candidateManifestSha256: sha256(candidateManifestBytes),
    corpusId: CORPUS_ID,
    corpusVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    derivedUse: "quality_metrics_only",
    expiresAt: "2026-12-31T00:00:00.000Z",
    issuedAt: "2026-02-03T00:00:00.000Z",
    purpose: "offline_parser_quality_evaluation_only",
    redistribution: "prohibited",
    retentionClass: "cycle2b-offline-evaluation-only",
    schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    selectionPlanSha256: sha256(selectionPlanBytes),
  };
  const rightsApproval = signApproval(
    {
      ...approvalScope,
      algorithm: "ed25519",
      approvalId: "cycle2b-synthetic-rights-approval",
      keyId: RIGHTS_KEY_ID,
      role: "rights_authority",
    },
    rightsKeyPair.privateKey,
  );
  const stewardApproval = signApproval(
    {
      ...approvalScope,
      algorithm: "ed25519",
      approvalId: "cycle2b-synthetic-steward-approval",
      keyId: STEWARD_KEY_ID,
      role: "data_steward",
    },
    stewardKeyPair.privateKey,
  );
  const rightsApprovalBytes = jsonDocument(rightsApproval);
  const stewardApprovalBytes = jsonDocument(stewardApproval);
  const documents = {
    adjudicationProtocol,
    authorityKeys,
    candidateManifest,
    manifest: admissionManifest({
      adjudicationProtocol: adjudicationProtocolBytes,
      authorityKeys: authorityKeysBytes,
      candidateManifest: candidateManifestBytes,
      rightsApproval: rightsApprovalBytes,
      selectionPlan: selectionPlanBytes,
      stewardApproval: stewardApprovalBytes,
    }),
    rightsApproval,
    selectionPlan,
    stewardApproval,
  };
  return {
    documents,
    input: {
      adjudicationProtocol: adjudicationProtocolBytes,
      authorityKeys: authorityKeysBytes,
      candidateManifest: candidateManifestBytes,
      evaluatedAt: EVALUATED_AT,
      manifest: jsonDocument(documents.manifest),
      rightsApproval: rightsApprovalBytes,
      selectionPlan: selectionPlanBytes,
      stewardApproval: stewardApprovalBytes,
    },
  };
}

function syntheticEntry(index: number): JsonRecord {
  const sequence = index + 1;
  const cik = sequence.toString().padStart(10, "0");
  return {
    accession: `${cik}-25-${sequence.toString().padStart(6, "0")}`,
    acceptedAt: "2025-03-01T12:00:00.000Z",
    amendmentOf: null,
    availableAt: "2025-03-01T12:01:00.000Z",
    cik,
    contentBytes: String(1_000 + sequence),
    contentSha256: hashText(`synthetic-content-metadata-${sequence}`),
    form: "10-K",
    mediaType: "text/html",
    selectionStratumId: "all-filings",
    taxonomyFamily: "us-gaap",
    taxonomyVersion: "2025",
  };
}

function authorityKey(
  role: "data_steward" | "rights_authority",
  keyId: string,
  publicKey: KeyObject,
  revokedAt: string | null,
): JsonRecord {
  return {
    algorithm: "ed25519",
    keyId,
    publicKeySpki: publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64"),
    revokedAt,
    role,
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
  };
}

function signApproval(value: JsonRecord, privateKey: KeyObject): JsonRecord {
  const unsigned = { ...value };
  delete unsigned.signature;
  const payload = concatBytes(
    APPROVAL_DOMAIN,
    new TextEncoder().encode(canonicalJson(unsigned)),
  );
  return {
    ...unsigned,
    signature: ed25519Sign(null, payload, privateKey).toString("base64url"),
  };
}

function admissionManifest(
  documents: Readonly<Record<Exclude<DocumentName, "manifest">, Uint8Array>>,
): JsonRecord {
  return {
    checks: [...FILING_CORPUS_ADMISSION_CHECKS],
    claim: FILING_CORPUS_ADMISSION_CLAIM,
    corpusId: CORPUS_ID,
    corpusVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
    files: [
      fileRecord(
        MANIFEST_PATHS.adjudicationProtocol,
        documents.adjudicationProtocol,
      ),
      fileRecord(MANIFEST_PATHS.authorityKeys, documents.authorityKeys),
      fileRecord(MANIFEST_PATHS.candidateManifest, documents.candidateManifest),
      fileRecord(MANIFEST_PATHS.rightsApproval, documents.rightsApproval),
      fileRecord(MANIFEST_PATHS.selectionPlan, documents.selectionPlan),
      fileRecord(MANIFEST_PATHS.stewardApproval, documents.stewardApproval),
    ],
    filingCount: FILING_CORPUS_ADMISSION_COUNT,
    nonclaims: [...FILING_CORPUS_ADMISSION_NOT_PROVEN],
    schemaVersion: FILING_CORPUS_ADMISSION_SCHEMA_VERSION,
  };
}

function fileRecord(path: string, bytes: Uint8Array): JsonRecord {
  return { path, sha256: sha256(bytes) };
}

function replaceDocumentAndRebindManifest(
  harness: SecurityHarness,
  name: Exclude<DocumentName, "manifest">,
  bytes: Uint8Array,
): FilingCorpusAdmissionInput {
  const manifest = cloneJson(harness.documents.manifest);
  const file = (manifest.files as JsonRecord[]).find(
    (candidate) => candidate.path === MANIFEST_PATHS[name],
  );
  if (file === undefined) throw new Error("security harness failed");
  file.sha256 = sha256(bytes);
  return {
    ...harness.input,
    [name]: bytes,
    manifest: jsonDocument(manifest),
  };
}

function cloneInput(
  input: FilingCorpusAdmissionInput,
): FilingCorpusAdmissionInput {
  return {
    adjudicationProtocol: Uint8Array.from(input.adjudicationProtocol),
    authorityKeys: Uint8Array.from(input.authorityKeys),
    candidateManifest: Uint8Array.from(input.candidateManifest),
    evaluatedAt: input.evaluatedAt,
    manifest: Uint8Array.from(input.manifest),
    rightsApproval: Uint8Array.from(input.rightsApproval),
    selectionPlan: Uint8Array.from(input.selectionPlan),
    stewardApproval: Uint8Array.from(input.stewardApproval),
  };
}

function entries(candidate: JsonRecord): JsonRecord[] {
  return candidate.entries as JsonRecord[];
}

function entry(candidate: JsonRecord, index: number): JsonRecord {
  const value = entries(candidate)[index];
  if (value === undefined) throw new Error("security harness failed");
  return value;
}

function key(authority: JsonRecord, index: number): JsonRecord {
  const value = (authority.keys as JsonRecord[])[index];
  if (value === undefined) throw new Error("security harness failed");
  return value;
}

function exclusion(selection: JsonRecord, index: number): JsonRecord {
  const value = (selection.exclusions as JsonRecord[])[index];
  if (value === undefined) throw new Error("security harness failed");
  return value;
}

function manifestFiles(manifest: JsonRecord): JsonRecord[] {
  return manifest.files as JsonRecord[];
}

function manifestFile(manifest: JsonRecord, index: number): JsonRecord {
  const value = manifestFiles(manifest)[index];
  if (value === undefined) throw new Error("security harness failed");
  return value;
}

function expectAdmissionFailure(
  action: () => unknown,
  code: FilingCorpusAdmissionFailureCode,
): void {
  const error = captureAdmissionError(action);
  expect(error).toBeInstanceOf(FilingCorpusAdmissionError);
  expect(error).toMatchObject({
    code,
    message: "Filing corpus admission failed.",
    name: "FilingCorpusAdmissionError",
  });
  expect(String(error)).not.toContain(JSON_CANARY);
}

function captureAdmissionError(action: () => unknown): Error {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("expected filing corpus admission failure");
}

function nonCanonicalBase64UrlAlias(value: string): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = value.at(-1);
  if (last === undefined) throw new Error("security harness failed");
  const index = alphabet.indexOf(last);
  if (index < 0) throw new Error("security harness failed");
  const alias = alphabet[(index & ~3) | ((index + 1) & 3)];
  if (alias === undefined || alias === last)
    throw new Error("security harness failed");
  return `${value.slice(0, -1)}${alias}`;
}

function mutateBase64UrlCharacter(value: string): string {
  const first = value[0];
  if (first === undefined) throw new Error("security harness failed");
  return `${first === "A" ? "B" : "A"}${value.slice(1)}`;
}

function jsonDocument(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (!isRecord(value)) throw new TypeError();
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function hashText(value: string): `sha256:${string}` {
  return sha256(new TextEncoder().encode(value));
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const output = new Uint8Array(first.byteLength + second.byteLength);
  output.set(first, 0);
  output.set(second, first.byteLength);
  return output;
}

function rePrototypedSharedCopy(source: Uint8Array): Uint8Array {
  const backing = new SharedArrayBuffer(source.byteLength);
  const bytes = new Uint8Array(backing);
  Uint8Array.prototype.set.call(bytes, source);
  Object.setPrototypeOf(backing, ArrayBuffer.prototype);
  return bytes;
}

function rePrototypedNonUint8Copies(
  source: Uint8Array,
): ReadonlyArray<readonly [string, Uint8Array]> {
  const paddedByteLength =
    Math.ceil(source.byteLength / Uint16Array.BYTES_PER_ELEMENT) *
    Uint16Array.BYTES_PER_ELEMENT;
  const views = [
    ["int8", new Int8Array(source.byteLength)],
    ["uint8_clamped", new Uint8ClampedArray(source.byteLength)],
    [
      "wider",
      new Uint16Array(paddedByteLength / Uint16Array.BYTES_PER_ELEMENT),
    ],
  ] as const;
  return views.map(([kind, view]) => {
    Uint8Array.prototype.set.call(new Uint8Array(view.buffer), source);
    Object.setPrototypeOf(view, Uint8Array.prototype);
    return [kind, view as unknown as Uint8Array] as const;
  });
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
