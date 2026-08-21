import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  FILING_CORPUS_ADMISSION_CHECKS,
  FILING_CORPUS_ADMISSION_CLAIM,
  FILING_CORPUS_ADMISSION_COUNT,
  FILING_CORPUS_ADMISSION_NOT_PROVEN,
  FilingCorpusAdmissionError,
  verifyFilingCorpusAdmission,
  type FilingCorpusAdmissionInput,
} from "./corpus-admission";

const APPROVAL_DOMAIN = new TextEncoder().encode(
  "research-cockpit:filing-corpus-approval:v1\u0000",
);
const EVALUATED_AT = "2026-08-20T12:00:00.000Z";

describe("Cycle 2b filing corpus admission", () => {
  it("admits one exact 100-entry metadata inventory with distinct signed approvals", () => {
    const fixture = buildAdmissionFixture();

    const first = verifyFilingCorpusAdmission(fixture.input);
    const replay = verifyFilingCorpusAdmission(cloneInput(fixture.input));

    expect(first).toEqual({
      adjudicationProtocolSha256: sha256(fixture.input.adjudicationProtocol),
      authorityKeysSha256: sha256(fixture.input.authorityKeys),
      candidateManifestSha256: sha256(fixture.input.candidateManifest),
      claim: FILING_CORPUS_ADMISSION_CLAIM,
      corpusId: "public_filing_corpus.v1",
      corpusVersion: "1.0.0",
      evaluatedAt: EVALUATED_AT,
      filingCount: FILING_CORPUS_ADMISSION_COUNT,
      manifestSha256: sha256(fixture.input.manifest),
      rightsApprovalSha256: sha256(fixture.input.rightsApproval),
      schemaVersion: "1.0.0",
      selectionPlanSha256: sha256(fixture.input.selectionPlan),
      status: "admitted",
      stewardApprovalSha256: sha256(fixture.input.stewardApproval),
      validUntil: "2026-12-31T00:00:00.000Z",
    });
    expect(replay).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(
      /accession|approval-body|content-i|private|publicKey|signature/u,
    );
  });

  it("rejects duplicate weighting, noncanonical JSON, signature tampering, and inactive approval", () => {
    const duplicate = buildAdmissionFixture({ duplicateContentHash: true });
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(duplicate.input),
      "FILING_CORPUS_DOCUMENT_INVALID",
    );

    const noncanonical = buildAdmissionFixture();
    noncanonical.input.authorityKeys = Uint8Array.from(
      Buffer.from(
        Buffer.from(noncanonical.input.authorityKeys)
          .toString("utf8")
          .replace('{"keys":', '{ "keys":'),
        "utf8",
      ),
    );
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(noncanonical.input),
      "FILING_CORPUS_AUTHORITY_INVALID",
    );

    const bomPrefixed = buildAdmissionFixture();
    bomPrefixed.input.selectionPlan = Uint8Array.from([
      0xef,
      0xbb,
      0xbf,
      ...bomPrefixed.input.selectionPlan,
    ]);
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(bomPrefixed.input),
      "FILING_CORPUS_DOCUMENT_INVALID",
    );

    const tampered = buildAdmissionFixture({ tamperRightsSignature: true });
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(tampered.input),
      "FILING_CORPUS_SIGNATURE_INVALID",
    );

    const expired = buildAdmissionFixture();
    expired.input.evaluatedAt = "2027-01-01T00:00:00.000Z";
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(expired.input),
      "FILING_CORPUS_APPROVAL_INACTIVE",
    );
  });

  it("rejects nonclosed or accessor input before reading document bytes", () => {
    const fixture = buildAdmissionFixture();
    const extra = { ...fixture.input, organizationId: "caller-controlled" };
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(extra),
      "FILING_CORPUS_INVALID_INPUT",
    );

    const accessor = { ...fixture.input };
    Object.defineProperty(accessor, "manifest", {
      enumerable: true,
      get: () => {
        throw new Error("must not escape");
      },
    });
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(accessor),
      "FILING_CORPUS_INVALID_INPUT",
    );

    const symbol = { ...fixture.input, [Symbol("hidden")]: true };
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(symbol),
      "FILING_CORPUS_INVALID_INPUT",
    );
  });

  it("rejects canonical documents outside the fixed depth budget", () => {
    const fixture = buildAdmissionFixture();
    let nested: unknown = "leaf";
    for (let depth = 0; depth < 34; depth += 1) nested = [nested];
    fixture.input.selectionPlan = documentBytes(nested);
    expectAdmissionFailure(
      () => verifyFilingCorpusAdmission(fixture.input),
      "FILING_CORPUS_DOCUMENT_INVALID",
    );
  });

  it("pins the exact bounded claim, checks, and nonclaims", () => {
    expect(FILING_CORPUS_ADMISSION_CLAIM).toBe(
      "fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission",
    );
    expect(FILING_CORPUS_ADMISSION_CHECKS).toHaveLength(16);
    expect(FILING_CORPUS_ADMISSION_CHECKS[1]).toBe(
      "fixed_100_accession_content_hash_inventory",
    );
    expect(FILING_CORPUS_ADMISSION_CHECKS[11]).toBe(
      "whole_manifest_atomic_accept_or_value_free_rejection",
    );
    expect(FILING_CORPUS_ADMISSION_NOT_PROVEN).toEqual([
      "legal_opinion_validity_counsel_identity_authentication_or_revocation_freshness",
      "sec_source_authenticity_or_sec_attestation",
      "raw_payload_presence_byte_hash_validation_ingestion_custody_retention_crypto_erasure_or_backup_deletion",
      "external_fetch_edgar_dns_tls_ssrf_or_rate_limits",
      "malware_scanning_or_zero_day_safety",
      "ten_fact_normalization_or_parser_correctness",
      "independently_adjudicated_ground_truth_or_2000_assertions",
      "precision_recall_quality_or_zero_silent_critical_failures",
      "dual_parser_independence_or_conflict_quarantine",
      "general_xbrl_ixbrl_taxonomy_or_plugins",
      "correction_supersession_lineage_execution",
      "production_key_kms_hsm_custody_or_rotation",
      "queue_scheduler_retry_exactly_once_or_load_slo",
      "database_api_web_composition_or_b15_v15",
      "representativeness_beyond_exact_approved_selection_plan",
      "real_data_beyond_exact_approved_manifest_or_production_admission",
    ]);
  });
});

interface FixtureOptions {
  readonly duplicateContentHash?: boolean;
  readonly tamperRightsSignature?: boolean;
}

function buildAdmissionFixture(options: FixtureOptions = {}): {
  input: Mutable<FilingCorpusAdmissionInput>;
} {
  const rightsKeys = generateKeyPairSync("ed25519");
  const stewardKeys = generateKeyPairSync("ed25519");
  const selectionPlan = {
    acceptanceWindow: {
      from: "2025-01-01T00:00:00.000Z",
      toExclusive: "2027-01-01T00:00:00.000Z",
    },
    candidateUniverseCount: 130,
    candidateUniverseSha256: sha256Text("candidate-universe"),
    eligibleForms: ["10-K", "10-K/A", "10-Q", "10-Q/A"],
    exclusions: [
      { count: 10, reasonCode: "duplicate_content" },
      { count: 20, reasonCode: "outside_window" },
    ],
    frozenAt: "2025-12-01T00:00:00.000Z",
    planId: "public_filing_selection.v1",
    planVersion: "1.0.0",
    schemaVersion: "1.0.0",
    selectionMethod: "predeclared_stratified_content_hash_v1",
    selectionSeedSha256: sha256Text("selection-seed"),
    strata: [
      { id: "annual", targetCount: 50 },
      { id: "quarterly", targetCount: 50 },
    ],
    targetCount: 100,
  };
  const adjudicationProtocol = {
    assertionTarget: 2_000,
    blindedToParserResults: true,
    factKeys: [
      "assets",
      "cash",
      "debt",
      "diluted_shares",
      "free_cash_flow",
      "gross_profit",
      "net_income",
      "operating_cash_flow",
      "operating_income",
      "revenue",
    ],
    frozenAt: "2025-12-01T00:00:00.000Z",
    independentAdjudicators: 2,
    metrics: [
      "document_success",
      "fact_precision",
      "fact_recall",
      "unit_date_tolerance",
      "silent_critical_failure",
      "quarantine_rate",
    ],
    protocolId: "public_filing_adjudication.v1",
    protocolVersion: "1.0.0",
    resolution: "independent_then_blinded_resolution",
    schemaVersion: "1.0.0",
    thresholds: {
      dateToleranceDays: 0,
      documentSuccessMinimum: "0.95",
      factPrecisionMinimum: "0.99",
      factRecallMinimum: "0.99",
      maximumQuarantineRate: "0.05",
      maximumSilentCriticalFailures: 0,
      unitTolerancePolicy: "exact_canonical_unit.v1",
    },
  };
  const selectionPlanBytes = documentBytes(selectionPlan);
  const adjudicationProtocolBytes = documentBytes(adjudicationProtocol);
  const entries = Array.from({ length: 100 }, (_, index) => {
    const ordinal = index + 1;
    const cik = String(1_000_000_000 + ordinal);
    const contentSha256 =
      options.duplicateContentHash === true && ordinal === 100
        ? sha256Text("content-99")
        : sha256Text(`content-${ordinal}`);
    return {
      accession: `${cik}-26-${String(ordinal).padStart(6, "0")}`,
      acceptedAt: "2026-01-01T00:00:00.000Z",
      amendmentOf: null,
      availableAt: "2026-01-02T00:00:00.000Z",
      cik,
      contentBytes: "100",
      contentSha256,
      form: ordinal <= 50 ? "10-K" : "10-Q",
      mediaType: "application/zip",
      selectionStratumId: ordinal <= 50 ? "annual" : "quarterly",
      taxonomyFamily: "us-gaap",
      taxonomyVersion: "2026",
    };
  });
  const candidateManifest = {
    adjudicationProtocolSha256: sha256(adjudicationProtocolBytes),
    corpusId: "public_filing_corpus.v1",
    corpusVersion: "1.0.0",
    entries,
    frozenAt: "2026-02-01T00:00:00.000Z",
    schemaVersion: "1.0.0",
    selectionPlanSha256: sha256(selectionPlanBytes),
  };
  const candidateManifestBytes = documentBytes(candidateManifest);
  const authorityKeys = {
    keys: [
      authorityRecord(
        "rights-key.v1",
        "rights_authority",
        rightsKeys.publicKey,
      ),
      authorityRecord("steward-key.v1", "data_steward", stewardKeys.publicKey),
    ],
    schemaVersion: "1.0.0",
  };
  const authorityKeysBytes = documentBytes(authorityKeys);
  const approvalScope = {
    adjudicationProtocolSha256: sha256(adjudicationProtocolBytes),
    aiUse: "prohibited",
    algorithm: "ed25519",
    approvalVersion: "1.0.0",
    authorityKeysSha256: sha256(authorityKeysBytes),
    candidateManifestSha256: sha256(candidateManifestBytes),
    corpusId: "public_filing_corpus.v1",
    corpusVersion: "1.0.0",
    derivedUse: "quality_metrics_only",
    expiresAt: "2026-12-31T00:00:00.000Z",
    issuedAt: "2026-02-02T00:00:00.000Z",
    purpose: "offline_parser_quality_evaluation_only",
    redistribution: "prohibited",
    retentionClass: "controlled_public_filing_corpus.v1",
    schemaVersion: "1.0.0",
    selectionPlanSha256: sha256(selectionPlanBytes),
  };
  const rightsApproval = signedApproval(
    {
      ...approvalScope,
      approvalId: "rights_approval.v1",
      keyId: "rights-key.v1",
      role: "rights_authority",
    },
    rightsKeys.privateKey,
  );
  if (options.tamperRightsSignature === true) {
    rightsApproval.signature = `${
      rightsApproval.signature.startsWith("A") ? "B" : "A"
    }${rightsApproval.signature.slice(1)}`;
  }
  const stewardApproval = signedApproval(
    {
      ...approvalScope,
      approvalId: "steward_approval.v1",
      keyId: "steward-key.v1",
      role: "data_steward",
    },
    stewardKeys.privateKey,
  );
  const rightsApprovalBytes = documentBytes(rightsApproval);
  const stewardApprovalBytes = documentBytes(stewardApproval);
  const files = [
    {
      path: "config/filing-corpus/v1/adjudication-protocol.json",
      sha256: sha256(adjudicationProtocolBytes),
    },
    {
      path: "config/filing-corpus/v1/authority-keys.json",
      sha256: sha256(authorityKeysBytes),
    },
    {
      path: "config/filing-corpus/v1/candidate-manifest.json",
      sha256: sha256(candidateManifestBytes),
    },
    {
      path: "config/filing-corpus/v1/rights-approval.json",
      sha256: sha256(rightsApprovalBytes),
    },
    {
      path: "config/filing-corpus/v1/selection-plan.json",
      sha256: sha256(selectionPlanBytes),
    },
    {
      path: "config/filing-corpus/v1/steward-approval.json",
      sha256: sha256(stewardApprovalBytes),
    },
  ];
  const manifestBytes = documentBytes({
    checks: [...FILING_CORPUS_ADMISSION_CHECKS],
    claim: FILING_CORPUS_ADMISSION_CLAIM,
    corpusId: "public_filing_corpus.v1",
    corpusVersion: "1.0.0",
    files,
    filingCount: 100,
    nonclaims: [...FILING_CORPUS_ADMISSION_NOT_PROVEN],
    schemaVersion: "1.0.0",
  });
  return {
    input: {
      adjudicationProtocol: adjudicationProtocolBytes,
      authorityKeys: authorityKeysBytes,
      candidateManifest: candidateManifestBytes,
      evaluatedAt: EVALUATED_AT,
      manifest: manifestBytes,
      rightsApproval: rightsApprovalBytes,
      selectionPlan: selectionPlanBytes,
      stewardApproval: stewardApprovalBytes,
    },
  };
}

function authorityRecord(
  keyId: string,
  role: "data_steward" | "rights_authority",
  publicKey: KeyObject,
): Record<string, unknown> {
  return {
    algorithm: "ed25519",
    keyId,
    publicKeySpki: publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64"),
    revokedAt: null,
    role,
    validFrom: "2025-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
  };
}

function signedApproval(
  unsigned: Record<string, unknown>,
  privateKey: KeyObject,
): Record<string, unknown> & { signature: string } {
  const payload = concatBytes(
    APPROVAL_DOMAIN,
    new TextEncoder().encode(canonicalJson(unsigned)),
  );
  return {
    ...unsigned,
    signature: sign(null, payload, privateKey).toString("base64url"),
  };
}

function cloneInput(
  input: FilingCorpusAdmissionInput,
): Mutable<FilingCorpusAdmissionInput> {
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

function expectAdmissionFailure(
  action: () => unknown,
  code: FilingCorpusAdmissionError["code"],
): void {
  try {
    action();
    throw new Error("expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(FilingCorpusAdmissionError);
    expect(error).toMatchObject({
      code,
      message: "Filing corpus admission failed.",
      name: "FilingCorpusAdmissionError",
    });
  }
}

function documentBytes(value: unknown): Uint8Array {
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
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256Text(value: string): `sha256:${string}` {
  return sha256(new TextEncoder().encode(value));
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(first.byteLength + second.byteLength);
  bytes.set(first, 0);
  bytes.set(second, first.byteLength);
  return bytes;
}

type Mutable<Value> = { -readonly [Key in keyof Value]: Value[Key] };
