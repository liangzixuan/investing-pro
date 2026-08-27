import { createHash } from "node:crypto";

import {
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES,
  FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
  createFilingParserArchivePairCustodyProtocol,
  createSyntheticFilingParserArchivePairFixture,
  type FilingParserArchivePairCustodyProtocol,
  type FilingParserArchivePairCustodyResult,
} from "@research-cockpit/filing-payload-custody";
import {
  FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
  FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
  type FilingParserQualityCompositionCommitResult,
  type FilingParserQualityCompositionCommittedResult,
  type FilingParserQualityCompositionEvaluatedResult,
  type FilingParserQualityCompositionProtocol,
  type FilingParserQualityCompositionQuarantinedResult,
  type FilingParserQualityCompositionRevealResult,
} from "@research-cockpit/filing-parser-quality-composition";

import { createFilingParserQualityCompositionProtocolForTest } from "../../filing-parser-quality-composition/src/filing-parser-quality-composition";
import {
  StaticDirectExecutionBoundary,
  buildDirectResultForTest,
  buildFilingParserQualityCompositionTestHarness,
} from "../../filing-parser-quality-composition/src/test-filing-parser-quality-composition-builder";
import {
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
  FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  createFilingParserCustodyQualityCompositionProtocolForTest,
  type FilingParserCustodyQualityCompositionCommittedResult,
  type FilingParserCustodyQualityCompositionEvaluatedResult,
  type FilingParserCustodyQualityCompositionProtocol,
} from "./filing-parser-custody-quality-composition";

type Sha256 = `sha256:${string}`;
type CustodyTransform = (
  result: FilingParserArchivePairCustodyResult,
) => FilingParserArchivePairCustodyResult;
type QualityCommitTransform = (
  result: FilingParserQualityCompositionCommitResult,
) => FilingParserQualityCompositionCommitResult;
type QualityRevealTransform = (
  result: FilingParserQualityCompositionRevealResult,
) => FilingParserQualityCompositionRevealResult;

const TEXT_ENCODER = new TextEncoder();
const SOURCE_CONTEXT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-source-context:v1\u0000",
);
const CUSTODY_ROLE_SOURCE_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-role-source:v1\u0000",
);
const CUSTODY_RECEIPT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-receipt:v1\u0000",
);
const CUSTODY_PAIR_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-archive-custody-pair:v1\u0000",
);
const COMMITMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-commitment:v1\u0000",
);
const EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-custody-quality-evaluation:v1\u0000",
);
const QUALITY_MEASUREMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-measurement:v1\u0000",
);
const QUALITY_PROJECTION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-quality-projection:v1\u0000",
);
const QUALITY_COMPOSITION_COMMITMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-quality-composition-commitment:v1\u0000",
);
const QUALITY_PRECOMMITMENT_COMMITMENT_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-precommitment:v1\u0000",
);
const QUALITY_PRECOMMITMENT_EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-quality-precommitment-evaluation:v1\u0000",
);
const QUALITY_COMPOSITION_EVALUATION_DOMAIN = TEXT_ENCODER.encode(
  "research-cockpit:synthetic-filing-parser-quality-composition-evaluation:v1\u0000",
);

export interface CustodyCall {
  readonly amendmentArgument: unknown;
  readonly amendmentSnapshot: Uint8Array;
  readonly originalArgument: unknown;
  readonly originalSnapshot: Uint8Array;
  readonly sourceContextSha256: unknown;
}

export interface QualityCommitCall {
  readonly amendmentArgument: unknown;
  readonly amendmentSnapshot: Uint8Array;
  readonly declaredReferenceSha256: unknown;
  readonly originalArgument: unknown;
  readonly originalSnapshot: Uint8Array;
  readonly planArgument: unknown;
  readonly planSnapshot: Uint8Array;
}

export class RecordingCustodyProtocol implements FilingParserArchivePairCustodyProtocol {
  public readonly calls: CustodyCall[] = [];
  public lastResult: FilingParserArchivePairCustodyResult | undefined;

  public constructor(
    private readonly inner: FilingParserArchivePairCustodyProtocol,
    private readonly transform?: CustodyTransform,
  ) {}

  public async custodyAndRead(
    sourceContextSha256: unknown,
    originalArchive: unknown,
    amendmentArchive: unknown,
  ): Promise<FilingParserArchivePairCustodyResult> {
    this.calls.push({
      amendmentArgument: amendmentArchive,
      amendmentSnapshot: snapshotBytes(amendmentArchive),
      originalArgument: originalArchive,
      originalSnapshot: snapshotBytes(originalArchive),
      sourceContextSha256,
    });
    const result = await this.inner.custodyAndRead(
      sourceContextSha256,
      originalArchive,
      amendmentArchive,
    );
    this.lastResult = this.transform?.(result) ?? result;
    return this.lastResult;
  }
}

export class DeferredCustodyProtocol implements FilingParserArchivePairCustodyProtocol {
  public readonly calls: CustodyCall[] = [];
  public readonly started: Promise<void>;
  readonly #inner: FilingParserArchivePairCustodyProtocol;
  readonly #releasePromise: Promise<void>;
  readonly #resolveRelease: () => void;
  readonly #resolveStarted: () => void;

  public constructor(inner: FilingParserArchivePairCustodyProtocol) {
    this.#inner = inner;
    let resolveRelease = (): void => undefined;
    let resolveStarted = (): void => undefined;
    this.#releasePromise = new Promise((resolve) => {
      resolveRelease = resolve;
    });
    this.started = new Promise((resolve) => {
      resolveStarted = resolve;
    });
    this.#resolveRelease = resolveRelease;
    this.#resolveStarted = resolveStarted;
  }

  public release(): void {
    this.#resolveRelease();
  }

  public async custodyAndRead(
    sourceContextSha256: unknown,
    originalArchive: unknown,
    amendmentArchive: unknown,
  ): Promise<FilingParserArchivePairCustodyResult> {
    this.calls.push({
      amendmentArgument: amendmentArchive,
      amendmentSnapshot: snapshotBytes(amendmentArchive),
      originalArgument: originalArchive,
      originalSnapshot: snapshotBytes(originalArchive),
      sourceContextSha256,
    });
    this.#resolveStarted();
    await this.#releasePromise;
    return this.#inner.custodyAndRead(
      sourceContextSha256,
      originalArchive,
      amendmentArchive,
    );
  }
}

export class RecordingQualityProtocol implements FilingParserQualityCompositionProtocol {
  public readonly commitCalls: QualityCommitCall[] = [];
  public readonly revealCalls: Array<{
    readonly capability: unknown;
    readonly referenceArgument: unknown;
    readonly referenceSnapshot: Uint8Array;
  }> = [];

  public constructor(
    private readonly inner: FilingParserQualityCompositionProtocol,
    private readonly commitTransform?: QualityCommitTransform,
    private readonly revealTransform?: QualityRevealTransform,
  ) {}

  public async commit(
    plan: unknown,
    declaredReferenceSha256: unknown,
    originalArchive: unknown,
    amendmentArchive: unknown,
  ): Promise<FilingParserQualityCompositionCommitResult> {
    this.commitCalls.push({
      amendmentArgument: amendmentArchive,
      amendmentSnapshot: snapshotBytes(amendmentArchive),
      declaredReferenceSha256,
      originalArgument: originalArchive,
      originalSnapshot: snapshotBytes(originalArchive),
      planArgument: plan,
      planSnapshot: snapshotBytes(plan),
    });
    const result = await this.inner.commit(
      plan,
      declaredReferenceSha256,
      originalArchive,
      amendmentArchive,
    );
    return this.commitTransform?.(result) ?? result;
  }

  public reveal(
    capability: unknown,
    declaredReference: unknown,
  ): FilingParserQualityCompositionRevealResult {
    this.revealCalls.push({
      capability,
      referenceArgument: declaredReference,
      referenceSnapshot: snapshotBytes(declaredReference),
    });
    const result = this.inner.reveal(capability, declaredReference);
    return this.revealTransform?.(result) ?? result;
  }
}

export interface FilingParserCustodyQualityCompositionTestHarness {
  readonly amendmentArchive: Uint8Array;
  readonly custody: FilingParserArchivePairCustodyProtocol;
  readonly declaredReference: Uint8Array;
  readonly declaredReferenceSha256: Sha256;
  readonly directBoundary: StaticDirectExecutionBoundary;
  readonly originalArchive: Uint8Array;
  readonly plan: Uint8Array;
  readonly protocol: FilingParserCustodyQualityCompositionProtocol;
  readonly quality: RecordingQualityProtocol;
}

export interface TestHarnessOptions {
  readonly custody?: FilingParserArchivePairCustodyProtocol;
  readonly custodyTransform?: CustodyTransform;
  readonly invocationTag?: string;
  readonly qualityCommitTransform?: QualityCommitTransform;
  readonly qualityRevealTransform?: QualityRevealTransform;
}

export function buildFilingParserCustodyQualityCompositionTestHarness(
  options: TestHarnessOptions = {},
): FilingParserCustodyQualityCompositionTestHarness {
  const qualityHarness = buildFilingParserQualityCompositionTestHarness();
  const archives = createSyntheticFilingParserArchivePairFixture();
  const normalization = retargetNormalizationArchiveDigests(
    qualityHarness.normalization,
    archives.originalArchive,
    archives.amendmentArchive,
  );
  const directBoundary = new StaticDirectExecutionBoundary(
    buildDirectResultForTest(
      normalization,
      archives.originalArchive,
      archives.amendmentArchive,
      options.invocationTag ?? "cycle2o-test",
    ),
  );
  const innerQuality =
    createFilingParserQualityCompositionProtocolForTest(directBoundary);
  const quality = new RecordingQualityProtocol(
    innerQuality,
    options.qualityCommitTransform,
    options.qualityRevealTransform,
  );
  const custody =
    options.custody ??
    new RecordingCustodyProtocol(
      createFilingParserArchivePairCustodyProtocol(),
      options.custodyTransform,
    );
  return Object.freeze({
    amendmentArchive: archives.amendmentArchive,
    custody,
    declaredReference: qualityHarness.declaredReference,
    declaredReferenceSha256: qualityHarness.declaredReferenceSha256,
    directBoundary,
    originalArchive: archives.originalArchive,
    plan: qualityHarness.plan,
    protocol: createFilingParserCustodyQualityCompositionProtocolForTest(
      custody,
      quality,
    ),
    quality,
  });
}

function retargetNormalizationArchiveDigests(
  normalization: Record<string, unknown>,
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
): Record<string, unknown> {
  if (
    !Array.isArray(normalization.factVersions) ||
    normalization.factVersions.length !== 20
  )
    throw new TypeError("unexpected normalization fixture");
  const originalArchiveSha256 = sha256(originalArchive);
  const amendmentArchiveSha256 = sha256(amendmentArchive);
  return {
    ...normalization,
    factVersions: normalization.factVersions.map((value, index) => {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new TypeError("unexpected normalization fact fixture");
      return {
        ...(value as Record<string, unknown>),
        sourceContentSha256:
          index < 10 ? originalArchiveSha256 : amendmentArchiveSha256,
      };
    }),
  };
}

export function createStaticAuthenticatedCustodyProtocol(
  seed = "static",
): RecordingCustodyProtocol {
  const inner: FilingParserArchivePairCustodyProtocol = Object.freeze({
    custodyAndRead: (
      sourceContextSha256: unknown,
      originalArchive: unknown,
      amendmentArchive: unknown,
    ): Promise<FilingParserArchivePairCustodyResult> =>
      Promise.resolve(
        buildAuthenticatedCustodyResult(
          requireHash(sourceContextSha256),
          snapshotBytes(originalArchive),
          snapshotBytes(amendmentArchive),
          seed,
        ),
      ),
  });
  return new RecordingCustodyProtocol(inner);
}

export function buildAuthenticatedCustodyResult(
  sourceContextSha256: Sha256,
  originalArchive: Uint8Array,
  amendmentArchive: Uint8Array,
  seed: string,
): FilingParserArchivePairCustodyResult {
  const originalReceipt = custodyReceipt(
    sourceContextSha256,
    "original",
    originalArchive,
    seed,
  );
  const amendmentReceipt = custodyReceipt(
    sourceContextSha256,
    "amendment",
    amendmentArchive,
    seed,
  );
  const receipts = Object.freeze([originalReceipt, amendmentReceipt] as const);
  return {
    amendmentArchive: Uint8Array.from(amendmentArchive),
    audit: {
      cleanupCount: 1,
      readbackCount: 2,
      stagedArchiveCount: 2,
      zeroResidue: true,
    },
    claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
    custodyPairBindingSha256: domainSha256(CUSTODY_PAIR_DOMAIN, {
      claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
      receipts,
      schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
      sourceContextSha256,
    }),
    originalArchive: Uint8Array.from(originalArchive),
    receipts,
    schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
    status: "readback",
    synthetic: true,
  };
}

export function recomputeSourceContext(
  committed: FilingParserCustodyQualityCompositionCommittedResult,
): Sha256 {
  return domainSha256(SOURCE_CONTEXT_DOMAIN, {
    amendmentArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.amendment.contentSha256,
    claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
    declaredReferenceSha256: committed.declaredReferenceSha256,
    originalArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.original.contentSha256,
    planSha256: committed.planSha256,
    schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  });
}

export function recomputeCustodyPairBinding(
  committed: FilingParserCustodyQualityCompositionCommittedResult,
): Sha256 {
  return domainSha256(CUSTODY_PAIR_DOMAIN, {
    claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
    receipts: committed.custody.receipts,
    schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
    sourceContextSha256: committed.custody.sourceContextSha256,
  });
}

export function recomputeCustodyReceipt(
  receipt: FilingParserCustodyQualityCompositionCommittedResult["custody"]["receipts"][number],
): Sha256 {
  return domainSha256(CUSTODY_RECEIPT_DOMAIN, {
    aadSha256: receipt.aadSha256,
    byteLength: receipt.byteLength,
    ciphertextSha256: receipt.ciphertextSha256,
    contentSha256: receipt.contentSha256,
    readbackSha256: receipt.readbackSha256,
    role: receipt.role,
    sourceBindingSha256: receipt.sourceBindingSha256,
  });
}

export function recomputeCustodyCompositionCommitment(
  committed: FilingParserCustodyQualityCompositionCommittedResult,
): Sha256 {
  return domainSha256(COMMITMENT_DOMAIN, {
    candidateCommitmentSha256: committed.candidateCommitmentSha256,
    candidateObservationsSha256: committed.candidateObservationsSha256,
    claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
    custody: committed.custody,
    declaredReferenceSha256: committed.declaredReferenceSha256,
    planSha256: committed.planSha256,
    quality: committed.quality,
    qualityCompositionCommitmentSha256:
      committed.qualityCompositionCommitmentSha256,
    schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  });
}

export function recomputeCustodyCompositionEvaluation(
  evaluated: FilingParserCustodyQualityCompositionEvaluatedResult,
): Sha256 {
  return domainSha256(EVALUATION_DOMAIN, {
    candidateCommitmentSha256: evaluated.candidateCommitmentSha256,
    candidateObservationsSha256: evaluated.candidateObservationsSha256,
    claim: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_CLAIM,
    custody: evaluated.custody,
    custodyCompositionCommitmentSha256:
      evaluated.custodyCompositionCommitmentSha256,
    declaredReferenceSha256: evaluated.declaredReferenceSha256,
    measurementEvaluationSha256: evaluated.measurement.evaluationSha256,
    planSha256: evaluated.planSha256,
    quality: evaluated.quality,
    qualityCompositionCommitmentSha256:
      evaluated.qualityCompositionCommitmentSha256,
    qualityCompositionEvaluationBindingSha256:
      evaluated.qualityCompositionEvaluationBindingSha256,
    qualityEvaluationBindingSha256: evaluated.qualityEvaluationBindingSha256,
    schemaVersion: FILING_PARSER_CUSTODY_QUALITY_COMPOSITION_SCHEMA_VERSION,
  });
}

export function forgeQualityMeasurementCandidateWithRecomputedBindings(
  evaluated: FilingParserQualityCompositionEvaluatedResult,
  candidateSha256: Sha256,
): FilingParserQualityCompositionEvaluatedResult {
  const measurementEvaluationSha256 = compactDomainSha256(
    QUALITY_MEASUREMENT_DOMAIN,
    {
      candidateSha256,
      counts: evaluated.measurement.counts,
      declaredReferenceSha256: evaluated.declaredReferenceSha256,
      failedThresholds: evaluated.measurement.failedThresholds,
      planSha256: evaluated.planSha256,
      syntheticPilotThresholdOutcome:
        evaluated.measurement.syntheticPilotThresholdOutcome,
    },
  );
  const qualityEvaluationBindingSha256 = domainSha256(
    QUALITY_PRECOMMITMENT_EVALUATION_DOMAIN,
    {
      candidateCommitmentSha256: evaluated.candidateCommitmentSha256,
      candidateObservationsSha256: evaluated.candidateObservationsSha256,
      measurementEvaluationSha256,
      planSha256: evaluated.planSha256,
    },
  );
  const evaluationBindingSha256 = compactDomainSha256(
    QUALITY_COMPOSITION_EVALUATION_DOMAIN,
    {
      candidateCommitmentSha256: evaluated.candidateCommitmentSha256,
      compositionCommitmentSha256: evaluated.compositionCommitmentSha256,
      declaredReferenceSha256: evaluated.declaredReferenceSha256,
      measurementEvaluationSha256,
      qualityEvaluationBindingSha256,
    },
  );
  return Object.freeze({
    ...evaluated,
    evaluationBindingSha256,
    measurement: Object.freeze({
      ...evaluated.measurement,
      candidateSha256,
      evaluationSha256: measurementEvaluationSha256,
    }),
    qualityEvaluationBindingSha256,
  });
}

export function forgeQualityCandidateObservationsWithRecomputedBindings(
  committed: FilingParserQualityCompositionCommittedResult,
  candidateObservationsSha256: Sha256,
): FilingParserQualityCompositionCommittedResult {
  const candidateCommitmentSha256 = domainSha256(
    QUALITY_PRECOMMITMENT_COMMITMENT_DOMAIN,
    {
      candidateObservationsSha256,
      claim:
        "bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation",
      declaredReferenceSha256: committed.declaredReferenceSha256,
      planSha256: committed.planSha256,
      schemaVersion: "1.0.0",
    },
  );
  return withRecomputedQualityCompositionCommitment({
    ...committed,
    candidateCommitmentSha256,
    candidateObservationsSha256,
  });
}

export function forgeQualityProjectionWithRecomputedBindings(
  committed: FilingParserQualityCompositionCommittedResult,
  index: 0 | 1,
  changes: Readonly<{
    observationSha256?: Sha256;
    sourceLifecycleBindingSha256s?: readonly [Sha256, Sha256];
  }>,
): FilingParserQualityCompositionCommittedResult {
  const current = committed.projectionReceipts[index];
  const receipt = {
    ...current,
    ...changes,
  };
  const projectionBindingSha256 = compactDomainSha256(
    QUALITY_PROJECTION_DOMAIN,
    {
      documentRole: receipt.documentRole,
      factCount: receipt.factCount,
      observationSha256: receipt.observationSha256,
      qualityDocumentId: receipt.qualityDocumentId,
      qualityDocumentSha256: receipt.qualityDocumentSha256,
      sourceArchiveSha256: receipt.sourceArchiveSha256,
      sourceDocumentSha256: receipt.sourceDocumentSha256,
      sourceLifecycleBindingSha256s: receipt.sourceLifecycleBindingSha256s,
    },
  );
  const projectionReceipts = Object.freeze(
    index === 0
      ? [
          Object.freeze({ ...receipt, projectionBindingSha256 }),
          committed.projectionReceipts[1],
        ]
      : [
          committed.projectionReceipts[0],
          Object.freeze({ ...receipt, projectionBindingSha256 }),
        ],
  ) as FilingParserQualityCompositionCommittedResult["projectionReceipts"];
  return withRecomputedQualityCompositionCommitment({
    ...committed,
    projectionReceipts,
  });
}

function withRecomputedQualityCompositionCommitment(
  committed: Omit<
    FilingParserQualityCompositionCommittedResult,
    "compositionCommitmentSha256"
  > &
    Pick<
      FilingParserQualityCompositionCommittedResult,
      "compositionCommitmentSha256"
    >,
): FilingParserQualityCompositionCommittedResult {
  const compositionCommitmentSha256 = compactDomainSha256(
    QUALITY_COMPOSITION_COMMITMENT_DOMAIN,
    {
      candidateCommitmentSha256: committed.candidateCommitmentSha256,
      candidateObservationsSha256: committed.candidateObservationsSha256,
      claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
      declaredReferenceSha256: committed.declaredReferenceSha256,
      planSha256: committed.planSha256,
      projectionReceipts: committed.projectionReceipts,
      schemaVersion: FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
      sourceExecution: committed.sourceExecution,
    },
  );
  return Object.freeze({ ...committed, compositionCommitmentSha256 });
}

export function qualityQuarantine(): FilingParserQualityCompositionQuarantinedResult {
  return Object.freeze({
    claim: FILING_PARSER_QUALITY_COMPOSITION_CLAIM,
    code: "quality_composition_quarantined" as const,
    schemaVersion: FILING_PARSER_QUALITY_COMPOSITION_SCHEMA_VERSION,
    status: "quarantined" as const,
    synthetic: true as const,
  });
}

function custodyReceipt(
  sourceContextSha256: Sha256,
  role: "amendment" | "original",
  archive: Uint8Array,
  seed: string,
) {
  const fixture = FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES[role];
  if (
    archive.byteLength !== fixture.byteLength ||
    sha256(archive) !== fixture.contentSha256
  )
    throw new TypeError();
  const sourceBindingSha256 = domainSha256(CUSTODY_ROLE_SOURCE_DOMAIN, {
    amendmentArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.amendment.contentSha256,
    claim: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_CLAIM,
    originalArchiveSha256:
      FILING_PARSER_ARCHIVE_PAIR_CUSTODY_FIXTURES.original.contentSha256,
    role,
    schemaVersion: FILING_PARSER_ARCHIVE_PAIR_CUSTODY_SCHEMA_VERSION,
    sourceContextSha256,
  });
  const preimage = Object.freeze({
    aadSha256: sha256(TEXT_ENCODER.encode(`${seed}:${role}:aad`)),
    byteLength: fixture.byteLength,
    ciphertextSha256: sha256(TEXT_ENCODER.encode(`${seed}:${role}:ciphertext`)),
    contentSha256: fixture.contentSha256,
    readbackSha256: fixture.contentSha256,
    role,
    sourceBindingSha256,
  });
  return Object.freeze({
    ...preimage,
    receiptSha256: domainSha256(CUSTODY_RECEIPT_DOMAIN, preimage),
  });
}

function snapshotBytes(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new TypeError();
  return Uint8Array.from(value);
}

function requireHash(value: unknown): Sha256 {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value))
    throw new TypeError();
  return value as Sha256;
}

function domainSha256(domain: Uint8Array, value: unknown): Sha256 {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(canonicalBytes(value))
    .digest("hex")}`;
}

function compactDomainSha256(domain: Uint8Array, value: unknown): Sha256 {
  return `sha256:${createHash("sha256")
    .update(domain)
    .update(TEXT_ENCODER.encode(canonicalJson(value)))
    .digest("hex")}`;
}

function sha256(value: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalBytes(value: unknown): Uint8Array {
  return TEXT_ENCODER.encode(`${canonicalJson(value)}\n`);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (typeof value !== "object" || value === null) throw new TypeError();
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
