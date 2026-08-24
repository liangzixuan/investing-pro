import { createHash } from "node:crypto";
import {
  access,
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  FILING_PAYLOAD_CUSTODY_ALGORITHM,
  FILING_PAYLOAD_CUSTODY_CLAIM,
  FILING_PAYLOAD_CUSTODY_ERROR_CODES,
  FILING_PAYLOAD_CUSTODY_FAULT_PHASES,
  FILING_PAYLOAD_CUSTODY_FIXTURE,
  FILING_PAYLOAD_CUSTODY_LIMITS,
  FILING_PAYLOAD_CUSTODY_RETENTION_POLICY,
  FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION,
  FilingPayloadCustodyError,
  createFileSystemFilingPayloadCustodyBoundary,
  createFileSystemFilingPayloadCustodyTestHarness,
  createSyntheticFilingPayloadFixture,
  createSyntheticInMemoryFilingPayloadKeyStore,
  type FilingPayloadCustodyBoundary,
  type FilingPayloadCustodyClock,
  type FilingPayloadCustodyEntropy,
  type FilingPayloadCustodyErrorCode,
  type FilingPayloadCustodyFaultPhase,
  type FilingPayloadCustodyOptions,
  type FilingPayloadCustodyReceipt,
  type FilingPayloadKeyStore,
  type FilingPayloadStageCommand,
} from "./payload-custody";

const ERROR_CANARY = "synthetic-custody-secret-canary";
const CREATED_AT = "2026-08-20T12:00:00.000Z";
const SOURCE_BINDING_SHA256 = sha256(
  new TextEncoder().encode("cycle2c-synthetic-source-binding-v1"),
);
const EXPECTED_CHECKS = Object.freeze([
  "exact_single_nonempty_synthetic_payload_and_owned_byte_snapshot",
  "closed_size_digest_retention_and_algorithm_inputs",
  "recomputed_sha256_matches_declared_content_identity",
  "exact_replay_idempotency_and_same_hash_metadata_conflict_rejection",
  "random_per_payload_aes_256_gcm_dek_and_nonce_uniqueness",
  "aad_binds_schema_content_hash_size_and_retention_identity",
  "no_plaintext_staging_and_payload_key_audit_domain_separation",
  "opaque_internal_paths_and_link_device_reparse_escape_rejection",
  "atomic_stage_commit_or_bounded_zero_visible_record",
  "failure_injection_rollback_and_orphan_cleanup",
  "read_reauthenticates_tag_metadata_and_plaintext_sha256",
  "trusted_clock_active_expiry_boundary_and_no_caller_extension",
  "read_expire_delete_serialization_and_terminal_no_resurrection",
  "logical_key_forget_decrypt_denial_and_idempotent_cleanup",
  "aggregate_value_free_audit_error_and_canary_leakage_rejection",
  "no_network_parser_database_api_web_queue_and_cycle2a_schema_check_nonclaim_source_set_artifact_preservation",
] as const);
const EXPECTED_NONCLAIMS = Object.freeze([
  "real_filing_rights_approval_counsel_identity_or_legal_validity",
  "cycle2b_external_manifest_authority_or_phaseb_admission",
  "sec_source_authenticity_or_declared_digest_provenance",
  "real_payload_presence_100_filing_completeness_or_batch_atomicity",
  "edgar_fetch_dns_tls_ssrf_rate_limits_or_malware_scanning",
  "production_kms_hsm_key_custody_rotation_attestation_or_recovery",
  "physical_media_secure_erasure_memory_zeroization_or_cryptographic_erasure",
  "backup_replica_snapshot_cache_temp_log_or_third_party_deletion",
  "legal_hold_dsar_offboarding_or_regulatory_retention_execution",
  "multi_process_cross_host_object_store_or_distributed_consistency",
  "power_loss_filesystem_durability_disaster_recovery_or_restore",
  "database_api_web_queue_or_b15_v15_composition",
  "general_xbrl_ixbrl_ten_fact_parser_or_lineage_correctness",
  "dual_parser_ground_truth_2000_assertions_or_quality_thresholds",
  "production_network_secret_tenant_load_slo_or_operational_readiness",
  "real_data_admission_or_production_use",
] as const);

type Sha256 = `sha256:${string}`;
const BYTE_HOOKS = [
  "buffer",
  "byteLength",
  "toStringTag",
  "constructor",
  "species",
  "iterator",
  "set",
] as const;

interface ClockHarness {
  readonly clock: FilingPayloadCustodyClock;
  readonly get: () => number;
  readonly set: (value: string | number) => void;
}

interface EntropyHarness {
  readonly calls: () => readonly Uint8Array[];
  readonly entropy: FilingPayloadCustodyEntropy;
}

interface KeyStoreHarness {
  readonly failForget: (count?: number) => void;
  readonly keyIds: () => readonly string[];
  readonly keyStore: FilingPayloadKeyStore;
  readonly putSideEffectThenThrow: () => void;
  readonly readKey: (keyId: string) => Uint8Array | undefined;
}

interface BoundaryHarness {
  readonly boundary: FilingPayloadCustodyBoundary;
  readonly clock: ClockHarness;
  readonly entropy: EntropyHarness;
  readonly keyStore: KeyStoreHarness;
  readonly workspaceDirectory: string;
}

describe("Cycle 2c synthetic filing-payload custody security boundary", () => {
  it("pins the sole bounded claim, exact threat checks, nonclaims, and closed constants", () => {
    expect(FILING_PAYLOAD_CUSTODY_CLAIM).toBe(
      "bounded_synthetic_filing_payload_integrity_custody_and_logical_key_unavailability",
    );
    expect(EXPECTED_CHECKS).toHaveLength(16);
    expect(EXPECTED_NONCLAIMS).toHaveLength(16);
    expect(new Set(EXPECTED_CHECKS).size).toBe(EXPECTED_CHECKS.length);
    expect(new Set(EXPECTED_NONCLAIMS).size).toBe(EXPECTED_NONCLAIMS.length);
    expect(FILING_PAYLOAD_CUSTODY_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_PAYLOAD_CUSTODY_LIMITS).toEqual({
      auditBytes: 8_192,
      payloadBytes: 1_048_576,
      syntheticFixtureBytes: 4_096,
    });
    expect(FILING_PAYLOAD_CUSTODY_ALGORITHM).toEqual({
      aadDomain: "research-cockpit:filing-payload-custody:aes-256-gcm:v1\0",
      keyBytes: 32,
      name: "aes-256-gcm",
      nonceBytes: 12,
      tagBytes: 16,
    });
    expect(FILING_PAYLOAD_CUSTODY_RETENTION_POLICY).toEqual({
      class: "synthetic_payload_24h_audit_retained",
      payloadMilliseconds: 86_400_000,
    });
    expect(FILING_PAYLOAD_CUSTODY_ERROR_CODES).toEqual([
      "invalid_input",
      "hash_mismatch",
      "state_conflict",
      "retention_active",
      "payload_expired",
      "payload_unavailable",
      "resurrection_blocked",
      "record_invalid",
      "key_store_failure",
      "io_failure",
      "cleanup_failure",
      "closed",
    ]);
    expect(FILING_PAYLOAD_CUSTODY_FAULT_PHASES).toEqual([
      "key_created",
      "ciphertext_written",
      "audit_written",
      "before_publish",
      "published",
      "before_key_forget",
      "key_forgotten",
      "before_audit_update",
      "audit_updated",
      "ciphertext_deleted",
      "before_close_cleanup",
    ]);
  });

  it("creates exact fresh synthetic fixture snapshots and owns caller bytes before work", async () => {
    const first = createSyntheticFilingPayloadFixture();
    const second = createSyntheticFilingPayloadFixture();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(first).toHaveLength(FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength);
    expect(sha256(first)).toBe(FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256);
    first.fill(0);
    expect(sha256(second)).toBe(FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256);

    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent);
      const payload = createSyntheticFilingPayloadFixture();
      const expected = Uint8Array.from(payload);
      const staged = harness.boundary.stage(stageCommand(payload));
      payload.fill(0);
      const receipt = await staged;
      expect(
        await harness.boundary.read({ payloadId: receipt.payloadId }),
      ).toEqual(expected);
      await harness.boundary.close();
    });
  });

  it("rejects nonclosed configuration and commands, alien views, detached bytes, and accessors value-free", async () => {
    await withEmptyParent(async (parent) => {
      const clock = clockHarness();
      const entropy = entropyHarness("invalid-input");
      const keyStore = keyStoreHarness();
      const accessor = vi.fn(() => clock.clock);
      const symbol = Symbol("forbidden");
      const validOptions = options(
        parent,
        clock.clock,
        entropy.entropy,
        keyStore.keyStore,
      );
      const optionsWithAccessor = {
        entropy: entropy.entropy,
        keyStore: keyStore.keyStore,
        workspaceParentDirectory: parent,
      } as Record<string, unknown>;
      Object.defineProperty(optionsWithAccessor, "clock", {
        enumerable: true,
        get: accessor,
      });
      const invalidOptions: unknown[] = [
        null,
        [],
        { ...validOptions, extra: ERROR_CANARY },
        { ...validOptions, [symbol]: ERROR_CANARY },
        optionsWithAccessor,
        { ...validOptions, workspaceParentDirectory: "relative" },
        {
          ...validOptions,
          workspaceParentDirectory: `${parent}\n${ERROR_CANARY}`,
        },
        { ...validOptions, clock: { now: 42 } },
        { ...validOptions, entropy: { bytes: 42 } },
        { ...validOptions, keyStore: { ...keyStore.keyStore, read: 42 } },
        throwingProxy(validOptions, "getPrototypeOf"),
        throwingProxy(validOptions, "ownKeys"),
        throwingProxy(validOptions, "getOwnPropertyDescriptor"),
      ];
      for (const candidate of invalidOptions) {
        await expectCustodyFailure(
          () =>
            createFileSystemFilingPayloadCustodyBoundary(candidate as never),
          "invalid_input",
        );
      }
      expect(accessor).not.toHaveBeenCalled();

      const hookAccessor = vi.fn(() => {
        throw new Error(ERROR_CANARY);
      });
      const hooksWithAccessor = {} as Record<string, unknown>;
      Object.defineProperty(hooksWithAccessor, "afterPhase", {
        enumerable: true,
        get: hookAccessor,
      });
      for (const hooks of [
        hooksWithAccessor,
        throwingProxy({}, "getPrototypeOf"),
        throwingProxy({}, "ownKeys"),
        throwingProxy(
          { afterPhase: () => undefined },
          "getOwnPropertyDescriptor",
        ),
      ]) {
        await expectCustodyFailure(
          () =>
            createFileSystemFilingPayloadCustodyTestHarness(
              validOptions,
              hooks,
            ),
          "invalid_input",
        );
      }
      expect(hookAccessor).not.toHaveBeenCalled();

      const harness = await createBoundaryHarness(parent);
      const detachedBuffer = new ArrayBuffer(8);
      const detached = new Uint8Array(detachedBuffer);
      structuredClone(detachedBuffer, { transfer: [detachedBuffer] });
      class AlienBytes extends Uint8Array {}
      const validCommand = stageCommand(createSyntheticFilingPayloadFixture());
      const commandAccessor = vi.fn(() => validCommand.payload);
      const withAccessor = { ...validCommand } as Record<string, unknown>;
      Object.defineProperty(withAccessor, "payload", {
        enumerable: true,
        get: commandAccessor,
      });
      const invalidCommands: unknown[] = [
        null,
        [],
        { ...validCommand, extra: ERROR_CANARY },
        { ...validCommand, [symbol]: ERROR_CANARY },
        withAccessor,
        { ...validCommand, payload: new ArrayBuffer(4) },
        { ...validCommand, payload: new Uint16Array(2) },
        { ...validCommand, payload: detached },
        { ...validCommand, payload: new AlienBytes(validCommand.payload) },
        {
          ...validCommand,
          payload: new Uint8Array(new SharedArrayBuffer(4_096)),
        },
        { ...validCommand, payload: new Uint8Array(0) },
        { ...validCommand, payload: new Uint8Array(4_097) },
        { ...validCommand, fixtureId: `${validCommand.fixtureId}-other` },
        {
          ...validCommand,
          retentionClass: `${validCommand.retentionClass}-other`,
        },
        { ...validCommand, sourceBindingSha256: "sha256:UPPER" },
        throwingProxy(validCommand, "getPrototypeOf"),
        throwingProxy(validCommand, "ownKeys"),
        throwingProxy(validCommand, "getOwnPropertyDescriptor"),
      ];
      for (const candidate of invalidCommands) {
        await expectCustodyFailure(
          () => harness.boundary.stage(candidate as never),
          "invalid_input",
        );
      }
      const wrongPayload = createSyntheticFilingPayloadFixture();
      wrongPayload[0] = (wrongPayload[0] ?? 0) ^ 0xff;
      await expectCustodyFailure(
        () => harness.boundary.stage(stageCommand(wrongPayload)),
        "hash_mismatch",
      );
      expect(commandAccessor).not.toHaveBeenCalled();
      expect(
        await readdir(join(harness.workspaceDirectory, "records")),
      ).toEqual([]);
      await harness.boundary.close();
    });
  });

  it("uses intrinsic metadata and allocation for the public stage payload byte role", async () => {
    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent);
      const payload = createSyntheticFilingPayloadFixture();

      const shared = new Uint8Array(new SharedArrayBuffer(payload.byteLength));
      Uint8Array.prototype.set.call(shared, payload);
      shadowByteMetadata(shared, payload.byteLength);
      await expectCustodyFailure(
        () => harness.boundary.stage(stageCommand(shared)),
        "invalid_input",
      );

      await expectCustodyFailure(
        () =>
          harness.boundary.stage(stageCommand(rePrototypedSharedCopy(payload))),
        "invalid_input",
      );

      for (const carrier of rePrototypedNonUint8Copies(payload)) {
        await expectCustodyFailure(
          () => harness.boundary.stage(stageCommand(carrier)),
          "invalid_input",
        );
      }

      const oversized = new Uint8Array(
        FILING_PAYLOAD_CUSTODY_LIMITS.payloadBytes + 1,
      );
      Uint8Array.prototype.set.call(oversized, payload);
      shadowByteMetadata(oversized, payload.byteLength);
      await expectCustodyFailure(
        () => harness.boundary.stage(stageCommand(oversized)),
        "invalid_input",
      );

      let prototypeTrapCalls = 0;
      const proxy = new Proxy(payload.slice(), {
        getPrototypeOf() {
          prototypeTrapCalls += 1;
          throw new Error(ERROR_CANARY);
        },
      });
      await expectCustodyFailure(
        () => harness.boundary.stage(stageCommand(proxy)),
        "invalid_input",
      );
      expect(prototypeTrapCalls).toBe(0);

      for (const hook of BYTE_HOOKS) {
        let hookCalls = 0;
        const carrier = withTypedArrayAllocationHook(payload, hook, () => {
          hookCalls += 1;
        });
        await expect(
          harness.boundary.stage(stageCommand(carrier)),
        ).resolves.toMatchObject({ state: "available" });
        expect(hookCalls, hook).toBe(0);
      }
      const ordinary = await harness.boundary.stage(stageCommand(payload));
      expect(
        await harness.boundary.read({ payloadId: ordinary.payloadId }),
      ).toEqual(payload);
      await harness.boundary.close();
    });
  });

  it("snapshots nested adapter method references at initialization", async () => {
    await withEmptyParent(async (parent) => {
      const clock = clockHarness();
      const entropy = entropyHarness("mutable-options");
      const keyStore = keyStoreHarness();
      const mutableClock = { now: clock.clock.now };
      const mutableEntropy = { bytes: entropy.entropy.bytes };
      const mutableKeyStore = {
        forget: keyStore.keyStore.forget,
        putIfAbsent: keyStore.keyStore.putIfAbsent,
        read: keyStore.keyStore.read,
      };
      const initialized = await createFileSystemFilingPayloadCustodyTestHarness(
        options(parent, mutableClock, mutableEntropy, mutableKeyStore),
      );
      mutableClock.now = () => {
        throw new Error(ERROR_CANARY);
      };
      mutableEntropy.bytes = () => {
        throw new Error(ERROR_CANARY);
      };
      mutableKeyStore.putIfAbsent = () => {
        throw new Error(ERROR_CANARY);
      };
      mutableKeyStore.read = () => {
        throw new Error(ERROR_CANARY);
      };
      mutableKeyStore.forget = () => {
        throw new Error(ERROR_CANARY);
      };

      const receipt = await initialized.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      expect(receipt.createdAt).toBe(CREATED_AT);
      expect(
        await initialized.boundary.read({ payloadId: receipt.payloadId }),
      ).toEqual(createSyntheticFilingPayloadFixture());
      await initialized.boundary.close();
    });
  });

  it("hardens every entropy byte result before using caller-controlled metadata", async () => {
    for (const carrierKind of [
      "shared",
      "oversized",
      "reproto_shared",
      "reproto_int8",
      "reproto_uint8_clamped",
      "reproto_wider",
      "proxy",
      "subclass",
      "detached",
    ] as const) {
      for (let targetCall = 0; targetCall < 5; targetCall += 1) {
        await withEmptyParent(async (parent) => {
          let prototypeTrapCalls = 0;
          const entropy = entropyCarrierHarness((source, call) =>
            call === targetCall
              ? hostileDependencyCarrier(source, carrierKind, () => {
                  prototypeTrapCalls += 1;
                })
              : source,
          );
          const harness = await createBoundaryHarness(parent, { entropy });
          await expectCustodyFailure(
            () =>
              harness.boundary.stage(
                stageCommand(createSyntheticFilingPayloadFixture()),
              ),
            "invalid_input",
          );
          expect(
            prototypeTrapCalls,
            `${carrierKind}:${String(targetCall)}`,
          ).toBe(0);
          expect(entropy.calls()).toHaveLength(targetCall + 1);
          await harness.boundary.close();
        });
      }
    }

    for (const hook of BYTE_HOOKS) {
      await withEmptyParent(async (parent) => {
        let hookCalls = 0;
        const entropy = entropyCarrierHarness((source) =>
          withTypedArrayAllocationHook(source, hook, () => {
            hookCalls += 1;
          }),
        );
        const harness = await createBoundaryHarness(parent, { entropy });
        const receipt = await harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        expect(
          await harness.boundary.read({ payloadId: receipt.payloadId }),
        ).toEqual(createSyntheticFilingPayloadFixture());
        expect(entropy.calls()).toHaveLength(5);
        expect(hookCalls, hook).toBe(0);
        await harness.boundary.close();
      });
    }
  });

  it("hardens every key-store read byte result before decryption", async () => {
    for (const carrierKind of [
      "shared",
      "oversized",
      "reproto_shared",
      "reproto_int8",
      "reproto_uint8_clamped",
      "reproto_wider",
      "proxy",
      "subclass",
      "detached",
    ] as const) {
      await withEmptyParent(async (parent) => {
        let prototypeTrapCalls = 0;
        const keyStore = keyStoreReadCarrierHarness((source) =>
          hostileDependencyCarrier(source, carrierKind, () => {
            prototypeTrapCalls += 1;
          }),
        );
        const harness = await createBoundaryHarness(parent, { keyStore });
        const receipt = await harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        await expectCustodyFailure(
          () => harness.boundary.read({ payloadId: receipt.payloadId }),
          "key_store_failure",
        );
        expect(prototypeTrapCalls).toBe(0);
        await harness.boundary.close();
      });
    }

    for (const hook of BYTE_HOOKS) {
      await withEmptyParent(async (parent) => {
        let hookCalls = 0;
        const keyStore = keyStoreReadCarrierHarness((source) =>
          withTypedArrayAllocationHook(source, hook, () => {
            hookCalls += 1;
          }),
        );
        const harness = await createBoundaryHarness(parent, { keyStore });
        const payload = createSyntheticFilingPayloadFixture();
        const receipt = await harness.boundary.stage(stageCommand(payload));
        expect(
          await harness.boundary.read({ payloadId: receipt.payloadId }),
        ).toEqual(payload);
        expect(hookCalls, hook).toBe(0);
        await harness.boundary.close();
      });
    }
  });

  it("owns all retained entropy and external key-read results after each API returns", async () => {
    await withEmptyParent(async (parent) => {
      const retainedEntropy: Uint8Array[] = [];
      const entropy = entropyCarrierHarness((source) => {
        retainedEntropy.push(source);
        return source;
      });
      const retainedKeyReads: Uint8Array[] = [];
      const keyStore = keyStoreReadCarrierHarness((source) => {
        retainedKeyReads.push(source);
        return source;
      });
      const harness = await createBoundaryHarness(parent, {
        entropy,
        keyStore,
      });
      const payload = createSyntheticFilingPayloadFixture();

      const receipt = await harness.boundary.stage(stageCommand(payload));
      const expectedReceipt = structuredClone(receipt);
      const originalEntropy = retainedEntropy.map((source) =>
        Uint8Array.from(source),
      );
      expect(retainedEntropy).toHaveLength(5);
      retainedEntropy.forEach((source, index) => {
        source.fill(0xa5);
        expect(source, String(index)).not.toEqual(originalEntropy[index]);
      });

      const retrieved = await harness.boundary.read({
        payloadId: receipt.payloadId,
      });
      const expectedRetrieved = Uint8Array.from(retrieved);
      expect(retrieved).toEqual(payload);
      expect(retainedKeyReads).toHaveLength(1);
      const retainedKeyRead = retainedKeyReads[0];
      if (retainedKeyRead === undefined) throw new Error();
      const originalKeyRead = Uint8Array.from(retainedKeyRead);
      retainedKeyRead.fill(0xa5);

      expect(retainedKeyRead).not.toEqual(originalKeyRead);
      expect(receipt).toStrictEqual(expectedReceipt);
      expect(retrieved).toEqual(expectedRetrieved);
      await harness.boundary.close();
    });
  });

  it("keeps the exported synthetic key-store adapter closed, owned-copy, and value-free", async () => {
    const store = createSyntheticInMemoryFilingPayloadKeyStore();
    const keyId = `key_${"a".repeat(32)}`;
    const key = new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes).fill(
      0x5a,
    );
    expect(await store.putIfAbsent(keyId, key)).toBe(true);
    key.fill(0);
    expect(await store.read(keyId)).toEqual(
      new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes).fill(0x5a),
    );
    const firstRead = await store.read(keyId);
    firstRead?.fill(0);
    expect(await store.read(keyId)).toEqual(
      new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes).fill(0x5a),
    );
    expect(
      await store.putIfAbsent(
        keyId,
        new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes).fill(0x33),
      ),
    ).toBe(false);

    const invalidCalls: Array<() => unknown> = [
      () => store.read(Symbol(ERROR_CANARY) as never),
      () => store.forget(Symbol(ERROR_CANARY) as never),
      () =>
        store.putIfAbsent(
          Symbol(ERROR_CANARY) as never,
          new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes),
        ),
      () => store.read(ERROR_CANARY),
      () => store.forget(ERROR_CANARY),
      () =>
        store.putIfAbsent(
          `key_${"b".repeat(32)}`,
          new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes - 1),
        ),
      () =>
        store.putIfAbsent(
          `key_${"c".repeat(32)}`,
          new Uint8Array(new SharedArrayBuffer(32)),
        ),
    ];
    for (const call of invalidCalls) {
      await expectCustodyFailure(call, "key_store_failure");
    }
    expect(await store.forget(keyId)).toBe("forgotten");
    expect(await store.forget(keyId)).toBe("missing");
    expect(await store.read(keyId)).toBeUndefined();
  });

  it("hardens the exported key-store key byte role with intrinsic metadata and allocation", async () => {
    const store = createSyntheticInMemoryFilingPayloadKeyStore();
    const key = new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes).fill(
      0x5a,
    );

    const shared = new Uint8Array(new SharedArrayBuffer(key.byteLength));
    Uint8Array.prototype.set.call(shared, key);
    shadowByteMetadata(shared, key.byteLength);
    await expectCustodyFailure(
      () => store.putIfAbsent(`key_${"d".repeat(32)}`, shared),
      "key_store_failure",
    );

    await expectCustodyFailure(
      () =>
        store.putIfAbsent(`key_${"c".repeat(32)}`, rePrototypedSharedCopy(key)),
      "key_store_failure",
    );

    for (const carrier of rePrototypedNonUint8Copies(key)) {
      await expectCustodyFailure(
        () => store.putIfAbsent(`key_${"c".repeat(32)}`, carrier),
        "key_store_failure",
      );
    }

    for (const kind of ["subclass", "detached"] as const) {
      let trapCalls = 0;
      const carrier = hostileDependencyCarrier(key, kind, () => {
        trapCalls += 1;
      });
      await expectCustodyFailure(
        () => store.putIfAbsent(`key_${"c".repeat(32)}`, carrier),
        "key_store_failure",
      );
      expect(trapCalls, kind).toBe(0);
    }

    const oversized = new Uint8Array(key.byteLength + 1);
    Uint8Array.prototype.set.call(oversized, key);
    shadowByteMetadata(oversized, key.byteLength);
    await expectCustodyFailure(
      () => store.putIfAbsent(`key_${"e".repeat(32)}`, oversized),
      "key_store_failure",
    );

    let prototypeTrapCalls = 0;
    const proxy = new Proxy(key.slice(), {
      getPrototypeOf() {
        prototypeTrapCalls += 1;
        throw new Error(ERROR_CANARY);
      },
    });
    await expectCustodyFailure(
      () => store.putIfAbsent(`key_${"f".repeat(32)}`, proxy),
      "key_store_failure",
    );
    expect(prototypeTrapCalls).toBe(0);

    for (const [index, hook] of BYTE_HOOKS.entries()) {
      let hookCalls = 0;
      const carrier = withTypedArrayAllocationHook(key, hook, () => {
        hookCalls += 1;
      });
      const keyId = `key_${String(index + 1).repeat(32)}`;
      expect(await store.putIfAbsent(keyId, carrier)).toBe(true);
      expect(await store.read(keyId)).toEqual(key);
      expect(hookCalls, hook).toBe(0);
    }

    const ordinaryKeyId = `key_${"8".repeat(32)}`;
    expect(await store.putIfAbsent(ordinaryKeyId, key)).toBe(true);
    expect(await store.read(ordinaryKeyId)).toEqual(key);
  });

  it("stages AES-GCM ciphertext into distinct payload, key, and audit domains without plaintext or key leakage", async () => {
    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent, {
        entropy: entropyHarness("domain-separation"),
      });
      const payload = createSyntheticFilingPayloadFixture();
      const receipt = await harness.boundary.stage(stageCommand(payload));
      const paths = recordPaths(harness.workspaceDirectory, receipt.payloadId);
      const ciphertext = await readFile(paths.ciphertext);
      const auditBytes = await readFile(paths.availableAudit);
      const workspaceFiles = await recursiveFiles(harness.workspaceDirectory);
      const workspaceBytes = await Promise.all(
        workspaceFiles.map((path) => readFile(path)),
      );

      expect(ciphertext).not.toEqual(payload);
      expect(sha256(ciphertext)).toBe(
        (await harness.boundary.inspectAudit({ payloadId: receipt.payloadId }))
          .ciphertextSha256,
      );
      expect(paths.ciphertext).toContain(
        `${join("payload", "ciphertext.bin")}`,
      );
      expect(paths.availableAudit).toContain(
        `${join("audit", "available.json")}`,
      );
      expect(
        JSON.stringify(JSON.parse(auditBytes.toString("utf8"))),
      ).not.toContain(ERROR_CANARY);
      for (const keyId of harness.keyStore.keyIds()) {
        const key = harness.keyStore.readKey(keyId);
        expect(key).toBeDefined();
        if (key === undefined) throw new Error("Expected synthetic test key");
        expect(workspaceBytes.some((bytes) => containsBytes(bytes, key))).toBe(
          false,
        );
      }
      expect(JSON.stringify(receipt)).not.toMatch(/keyId|nonce|authTag|path/iu);
      await harness.boundary.close();
    });
  });

  it("uses distinct object identities, DEKs, nonces, AAD, and ciphertext across independent boundaries", async () => {
    await withEmptyParent(async (firstParent) => {
      await withEmptyParent(async (secondParent) => {
        const first = await createBoundaryHarness(firstParent, {
          entropy: entropyHarness("first-boundary"),
        });
        const second = await createBoundaryHarness(secondParent, {
          entropy: entropyHarness("second-boundary"),
        });
        const firstReceipt = await first.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        const secondReceipt = await second.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        const firstAudit = await first.boundary.inspectAudit({
          payloadId: firstReceipt.payloadId,
        });
        const secondAudit = await second.boundary.inspectAudit({
          payloadId: secondReceipt.payloadId,
        });
        expect(firstReceipt.payloadId).not.toBe(secondReceipt.payloadId);
        expect(firstAudit.aadSha256).not.toBe(secondAudit.aadSha256);
        expect(firstAudit.ciphertextSha256).not.toBe(
          secondAudit.ciphertextSha256,
        );
        expect(first.keyStore.keyIds()).not.toEqual(second.keyStore.keyIds());
        const firstRawAudit = await readAudit(
          recordPaths(first.workspaceDirectory, firstReceipt.payloadId)
            .availableAudit,
        );
        const secondRawAudit = await readAudit(
          recordPaths(second.workspaceDirectory, secondReceipt.payloadId)
            .availableAudit,
        );
        expect(firstRawAudit.nonce).not.toBe(secondRawAudit.nonce);
        expect(firstRawAudit.keyId).not.toBe(secondRawAudit.keyId);
        await first.boundary.close();
        await second.boundary.close();
      });
    });
  });

  it("serializes exact replay and metadata conflict and blocks resurrection", async () => {
    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent);
      const command = stageCommand(createSyntheticFilingPayloadFixture());
      const [first, replay] = await Promise.all([
        harness.boundary.stage(command),
        harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        ),
      ]);
      expect(replay).toEqual(first);
      expect(
        await readdir(join(harness.workspaceDirectory, "records")),
      ).toEqual([first.payloadId]);
      await expectCustodyFailure(
        () =>
          harness.boundary.stage({
            ...stageCommand(createSyntheticFilingPayloadFixture()),
            sourceBindingSha256: sha256(
              new TextEncoder().encode("different-binding"),
            ),
          }),
        "state_conflict",
      );
      harness.clock.set(Date.parse(first.payloadExpiresAt));
      const expired = await harness.boundary.expire({
        payloadId: first.payloadId,
      });
      expect(expired.state).toBe("logical_key_unavailability");
      await expectCustodyFailure(
        () =>
          harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        "resurrection_blocked",
      );
      await harness.boundary.close();
    });
  });

  it("authenticates an exact replay before acknowledging the existing available record", async () => {
    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent, {
        entropy: entropyHarness("replay-ciphertext-mutation"),
      });
      const command = stageCommand(createSyntheticFilingPayloadFixture());
      const receipt = await harness.boundary.stage(command);
      const paths = recordPaths(harness.workspaceDirectory, receipt.payloadId);
      const ciphertext = await readFile(paths.ciphertext);
      ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff;
      await writeFile(paths.ciphertext, ciphertext);

      await expectCustodyFailure(
        () =>
          harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        "record_invalid",
      );
      await expectCustodyFailure(
        () => harness.boundary.read({ payloadId: receipt.payloadId }),
        "record_invalid",
      );
      await expectOnlyPublishedRecord(harness, receipt);
      await harness.boundary.close();
    });

    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent, {
        entropy: entropyHarness("replay-missing-key"),
      });
      const receipt = await harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      const keyId = harness.keyStore.keyIds()[0];
      if (keyId === undefined) throw new Error("Missing synthetic key ID.");
      expect(await harness.keyStore.keyStore.forget(keyId)).toBe("forgotten");

      await expectCustodyFailure(
        () =>
          harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        "payload_unavailable",
      );
      await expectOnlyPublishedRecord(harness, receipt);
      await harness.boundary.close();
    });

    await withEmptyParent(async (parent) => {
      const keyStore = keyStoreHarness();
      const harness = await createBoundaryHarness(parent, {
        entropy: entropyHarness("replay-wrong-key"),
        keyStore,
      });
      const receipt = await harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      const keyId = keyStore.keyIds()[0];
      if (keyId === undefined) throw new Error("Missing synthetic key ID.");
      expect(await keyStore.keyStore.forget(keyId)).toBe("forgotten");
      expect(
        await keyStore.keyStore.putIfAbsent(
          keyId,
          new Uint8Array(FILING_PAYLOAD_CUSTODY_ALGORITHM.keyBytes).fill(0xa5),
        ),
      ).toBe(true);

      await expectCustodyFailure(
        () =>
          harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        "record_invalid",
      );
      await expectOnlyPublishedRecord(harness, receipt);
      await harness.boundary.close();
    });
  });

  it("enforces the half-open retention boundary, monotonic trusted time, logical key unavailability, and idempotent cleanup", async () => {
    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent);
      const receipt = await harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      const expiresAt = Date.parse(receipt.payloadExpiresAt);
      harness.clock.set(expiresAt - 1);
      expect(
        await harness.boundary.read({ payloadId: receipt.payloadId }),
      ).toEqual(createSyntheticFilingPayloadFixture());
      await expectCustodyFailure(
        () => harness.boundary.expire({ payloadId: receipt.payloadId }),
        "retention_active",
      );
      harness.clock.set(expiresAt);
      await expectCustodyFailure(
        () => harness.boundary.read({ payloadId: receipt.payloadId }),
        "payload_expired",
      );
      harness.clock.set(expiresAt - 1);
      await expectCustodyFailure(
        () => harness.boundary.read({ payloadId: receipt.payloadId }),
        "invalid_input",
      );
      harness.clock.set(expiresAt);
      const transitioned = await harness.boundary.expire({
        payloadId: receipt.payloadId,
      });
      expect(transitioned).toMatchObject({
        payloadId: receipt.payloadId,
        state: "logical_key_unavailability",
        transitionedAt: receipt.payloadExpiresAt,
        version: 2,
      });
      expect(
        await harness.boundary.expire({ payloadId: receipt.payloadId }),
      ).toEqual(transitioned);
      await expectCustodyFailure(
        () => harness.boundary.read({ payloadId: receipt.payloadId }),
        "payload_unavailable",
      );
      const paths = recordPaths(harness.workspaceDirectory, receipt.payloadId);
      expect(await pathExists(paths.ciphertext)).toBe(false);
      expect(await pathExists(paths.availableAudit)).toBe(true);
      expect(await pathExists(paths.logicalUnavailableAudit)).toBe(true);
      expect(paths.logicalUnavailableAudit).not.toMatch(/eras(?:e|ed|ure)/iu);
      expect(harness.keyStore.keyIds()).toEqual([]);
      await harness.boundary.close();
    });
  });

  it("rejects near-maximum timestamps and observed clock rollback value-free before side effects", async () => {
    await withEmptyParent(async (parent) => {
      const maximumDateMilliseconds = 8_640_000_000_000_000;
      const clock = clockHarness(
        maximumDateMilliseconds -
          FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.payloadMilliseconds +
          1,
      );
      const harness = await createBoundaryHarness(parent, { clock });
      await expectCustodyFailure(
        () =>
          harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        "invalid_input",
      );
      expect(harness.keyStore.keyIds()).toEqual([]);
      expect(
        await readdir(join(harness.workspaceDirectory, "records")),
      ).toEqual([]);
      await harness.boundary.close();
    });
  });

  it("rolls back every staging fault and retries key cleanup after side-effecting adapter failure", async () => {
    const stages = [
      "key_created",
      "ciphertext_written",
      "audit_written",
      "before_publish",
      "published",
    ] as const satisfies readonly FilingPayloadCustodyFaultPhase[];
    for (const phase of stages) {
      await withEmptyParent(async (parent) => {
        let injected = false;
        const harness = await createBoundaryHarness(parent, {
          afterPhase: (observed) => {
            if (observed === phase && !injected) {
              injected = true;
              throw new Error(`${ERROR_CANARY}:${phase}`);
            }
          },
          entropy: entropyHarness(`stage-fault:${phase}`),
        });
        await expectCustodyFailure(
          () =>
            harness.boundary.stage(
              stageCommand(createSyntheticFilingPayloadFixture()),
            ),
          "io_failure",
        );
        expect(injected).toBe(true);
        expect(harness.keyStore.keyIds()).toEqual([]);
        expect(
          await readdir(join(harness.workspaceDirectory, ".staging")),
        ).toEqual([]);
        expect(
          await readdir(join(harness.workspaceDirectory, "records")),
        ).toEqual([]);
        await harness.boundary.close();
        expect(await readdir(parent)).toEqual([]);
      });
    }

    await withEmptyParent(async (parent) => {
      const keyStore = keyStoreHarness();
      keyStore.putSideEffectThenThrow();
      const harness = await createBoundaryHarness(parent, { keyStore });
      await expectCustodyFailure(
        () =>
          harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        "io_failure",
      );
      expect(keyStore.keyIds()).toEqual([]);
      await harness.boundary.close();
    });

    await withEmptyParent(async (parent) => {
      let forgetCalls = 0;
      const foreignCollisionKeyStore: FilingPayloadKeyStore = {
        forget: () => {
          forgetCalls += 1;
          return "forgotten";
        },
        putIfAbsent: () => false,
        read: () => undefined,
      };
      const clock = clockHarness();
      const entropy = entropyHarness("foreign-key-collision");
      const boundary = await createFileSystemFilingPayloadCustodyBoundary(
        options(parent, clock.clock, entropy.entropy, foreignCollisionKeyStore),
      );
      await expectCustodyFailure(
        () =>
          boundary.stage(stageCommand(createSyntheticFilingPayloadFixture())),
        "key_store_failure",
      );
      expect(forgetCalls).toBe(0);
      await boundary.close();
      expect(forgetCalls).toBe(0);
    });

    await withEmptyParent(async (parent) => {
      const keyStore = keyStoreHarness();
      keyStore.failForget();
      let injected = false;
      const harness = await createBoundaryHarness(parent, {
        afterPhase: (phase) => {
          if (phase === "published" && !injected) {
            injected = true;
            throw new Error(ERROR_CANARY);
          }
        },
        keyStore,
      });
      await expectCustodyFailure(
        () =>
          harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          ),
        "cleanup_failure",
      );
      expect(keyStore.keyIds()).toHaveLength(1);
      await harness.boundary.close();
      expect(keyStore.keyIds()).toEqual([]);
      expect(await readdir(parent)).toEqual([]);
    });
  });

  it("resumes every key-first expiry fault to one authenticated terminal state without resurrection", async () => {
    const phases = [
      "before_key_forget",
      "key_forgotten",
      "before_audit_update",
      "audit_updated",
      "ciphertext_deleted",
    ] as const satisfies readonly FilingPayloadCustodyFaultPhase[];
    for (const phase of phases) {
      await withEmptyParent(async (parent) => {
        let injected = false;
        const harness = await createBoundaryHarness(parent, {
          afterPhase: (observed) => {
            if (observed === phase && !injected) {
              injected = true;
              throw new Error(`${ERROR_CANARY}:${phase}`);
            }
          },
          entropy: entropyHarness(`expiry-fault:${phase}`),
        });
        const receipt = await harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        harness.clock.set(receipt.payloadExpiresAt);
        await expectCustodyFailure(
          () => harness.boundary.expire({ payloadId: receipt.payloadId }),
          phase === "before_key_forget" || phase === "key_forgotten"
            ? "key_store_failure"
            : "io_failure",
        );
        expect(injected).toBe(true);
        if (phase !== "before_key_forget") {
          harness.clock.set(Date.parse(receipt.payloadExpiresAt) + 60_000);
        }
        const retried = await harness.boundary.expire({
          payloadId: receipt.payloadId,
        });
        expect(retried.state).toBe("logical_key_unavailability");
        expect(retried.version).toBe(2);
        expect(retried.transitionedAt).toBe(receipt.payloadExpiresAt);
        expect(harness.keyStore.keyIds()).toEqual([]);
        expect(
          await pathExists(
            recordPaths(harness.workspaceDirectory, receipt.payloadId)
              .ciphertext,
          ),
        ).toBe(false);
        await expectCustodyFailure(
          () => harness.boundary.read({ payloadId: receipt.payloadId }),
          "payload_unavailable",
        );
        await harness.boundary.close();
      });
    }
  });

  it("maps close faults value-free and retries owned-key and workspace cleanup", async () => {
    await withEmptyParent(async (parent) => {
      let injected = false;
      const harness = await createBoundaryHarness(parent, {
        afterPhase: (phase) => {
          if (phase === "before_close_cleanup" && !injected) {
            injected = true;
            throw new Error(ERROR_CANARY);
          }
        },
      });
      await harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      await expectCustodyFailure(
        () => harness.boundary.close(),
        "cleanup_failure",
      );
      expect(harness.keyStore.keyIds()).toHaveLength(1);
      expect(await pathExists(harness.workspaceDirectory)).toBe(true);
      await harness.boundary.close();
      expect(harness.keyStore.keyIds()).toEqual([]);
      expect(await pathExists(harness.workspaceDirectory)).toBe(false);
      await harness.boundary.close();
    });
  });

  it("rejects canonical audit identity tamper before key forget and never reports false logical unavailability", async () => {
    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent);
      const receipt = await harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      const paths = recordPaths(harness.workspaceDirectory, receipt.payloadId);
      const originalBytes = await readFile(paths.availableAudit);
      const originalAudit = await readAudit(paths.availableAudit);
      const originalKeyId = String(originalAudit.keyId);
      const tamperedAudit = {
        ...originalAudit,
        keyId: `key_${"f".repeat(32)}`,
      };
      await writeCanonicalJson(paths.availableAudit, tamperedAudit);
      harness.clock.set(receipt.payloadExpiresAt);
      await expectCustodyFailure(
        () => harness.boundary.expire({ payloadId: receipt.payloadId }),
        "record_invalid",
      );
      expect(harness.keyStore.readKey(originalKeyId)).toBeDefined();
      expect(await pathExists(paths.ciphertext)).toBe(true);
      expect(await pathExists(paths.logicalUnavailableAudit)).toBe(false);

      await writeFile(paths.availableAudit, originalBytes);
      const transitioned = await harness.boundary.expire({
        payloadId: receipt.payloadId,
      });
      expect(transitioned.state).toBe("logical_key_unavailability");
      expect(harness.keyStore.keyIds()).toEqual([]);
      await harness.boundary.close();
    });
  });

  it("rejects ciphertext, tag, canonical-audit, oversized-file, extra-entry, and hard-link mutation without leaking values", async () => {
    const mutations: ReadonlyArray<{
      readonly apply: (paths: ReturnType<typeof recordPaths>) => Promise<void>;
      readonly name: string;
    }> = [
      {
        name: "ciphertext-byte",
        apply: async (paths) => {
          const value = await readFile(paths.ciphertext);
          value[0] = (value[0] ?? 0) ^ 0xff;
          await writeFile(paths.ciphertext, value);
        },
      },
      {
        name: "auth-tag",
        apply: async (paths) => {
          const audit = await readAudit(paths.availableAudit);
          await writeCanonicalJson(paths.availableAudit, {
            ...audit,
            authTag: "A".repeat(22),
          });
        },
      },
      {
        name: "oversized-audit",
        apply: (paths) =>
          writeFile(
            paths.availableAudit,
            new Uint8Array(FILING_PAYLOAD_CUSTODY_LIMITS.auditBytes + 1),
          ),
      },
      {
        name: "oversized-ciphertext",
        apply: (paths) =>
          writeFile(
            paths.ciphertext,
            new Uint8Array(FILING_PAYLOAD_CUSTODY_FIXTURE.byteLength + 1),
          ),
      },
      {
        name: "extra-entry",
        apply: (paths) =>
          writeFile(join(paths.record, "audit", ERROR_CANARY), ERROR_CANARY),
      },
      {
        name: "hard-link",
        apply: (paths) =>
          link(
            paths.ciphertext,
            join(paths.record, "..", "foreign-hardlink.bin"),
          ),
      },
    ];
    for (const mutation of mutations) {
      await withEmptyParent(async (parent) => {
        const harness = await createBoundaryHarness(parent, {
          entropy: entropyHarness(`mutation:${mutation.name}`),
        });
        const receipt = await harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        await mutation.apply(
          recordPaths(harness.workspaceDirectory, receipt.payloadId),
        );
        await expectCustodyFailure(
          () => harness.boundary.read({ payloadId: receipt.payloadId }),
          "record_invalid",
        );
        await harness.boundary.close();
      });
    }
  });

  it("rejects staging and record-directory symlink or junction swaps before any write escapes", async () => {
    for (const domain of [".staging", "records"] as const) {
      await withEmptyParent(async (parent) => {
        await withEmptyParent(async (externalParent) => {
          const externalTarget = join(externalParent, "outside-custody");
          await mkdir(externalTarget, { mode: 0o700 });
          const harness = await createBoundaryHarness(parent, {
            entropy: entropyHarness(`link-swap:${domain}`),
          });
          const domainPath = join(harness.workspaceDirectory, domain);
          await rm(domainPath, { recursive: true });
          await symlink(
            externalTarget,
            domainPath,
            process.platform === "win32" ? "junction" : "dir",
          );
          await expectCustodyFailure(
            () =>
              harness.boundary.stage(
                stageCommand(createSyntheticFilingPayloadFixture()),
              ),
            "record_invalid",
          );
          expect(await readdir(externalTarget)).toEqual([]);
          expect(harness.keyStore.keyIds()).toEqual([]);
        });
      });
    }
  });

  it("requires an empty private parent and creates only private opaque custody paths", async () => {
    await withEmptyParent(async (nonemptyParent) => {
      await writeFile(join(nonemptyParent, ERROR_CANARY), ERROR_CANARY);
      const clock = clockHarness();
      const entropy = entropyHarness("nonempty-parent");
      const keyStore = keyStoreHarness();
      await expectCustodyFailure(
        () =>
          createFileSystemFilingPayloadCustodyBoundary(
            options(
              nonemptyParent,
              clock.clock,
              entropy.entropy,
              keyStore.keyStore,
            ),
          ),
        "io_failure",
      );
    });

    if (process.platform !== "win32") {
      await withEmptyParent(async (publicParent) => {
        await chmod(publicParent, 0o755);
        const clock = clockHarness();
        const entropy = entropyHarness("public-parent");
        const keyStore = keyStoreHarness();
        await expectCustodyFailure(
          () =>
            createFileSystemFilingPayloadCustodyBoundary(
              options(
                publicParent,
                clock.clock,
                entropy.entropy,
                keyStore.keyStore,
              ),
            ),
          "io_failure",
        );
      });
    }

    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent);
      const receipt = await harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      expect(receipt.payloadId).toMatch(/^payload_[0-9a-f]{32}$/u);
      expect(harness.workspaceDirectory).not.toContain(
        FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId,
      );
      if (process.platform !== "win32") {
        for (const path of [
          harness.workspaceDirectory,
          join(harness.workspaceDirectory, ".staging"),
          join(harness.workspaceDirectory, "records"),
          recordPaths(harness.workspaceDirectory, receipt.payloadId).record,
          join(
            recordPaths(harness.workspaceDirectory, receipt.payloadId).record,
            "payload",
          ),
          join(
            recordPaths(harness.workspaceDirectory, receipt.payloadId).record,
            "audit",
          ),
        ]) {
          expect((await lstat(path)).mode & 0o777).toBe(0o700);
        }
        for (const path of [
          recordPaths(harness.workspaceDirectory, receipt.payloadId).ciphertext,
          recordPaths(harness.workspaceDirectory, receipt.payloadId)
            .availableAudit,
        ]) {
          expect((await lstat(path)).mode & 0o777).toBe(0o600);
        }
      }
      await harness.boundary.close();
      expect(await readdir(parent)).toEqual([]);
      await expectCustodyFailure(
        () => harness.boundary.read({ payloadId: receipt.payloadId }),
        "closed",
      );
    });
  });

  it.runIf(process.platform !== "win32")(
    "rejects POSIX directory and file permission widening after publication",
    async () => {
      const tamperCases: ReadonlyArray<{
        readonly originalMode: number;
        readonly select: (
          harness: BoundaryHarness,
          receipt: FilingPayloadCustodyReceipt,
        ) => string;
        readonly widenedMode: number;
      }> = [
        {
          originalMode: 0o700,
          select: (harness) => harness.workspaceDirectory,
          widenedMode: 0o755,
        },
        {
          originalMode: 0o700,
          select: (harness) => join(harness.workspaceDirectory, "records"),
          widenedMode: 0o755,
        },
        {
          originalMode: 0o700,
          select: (harness, receipt) =>
            join(
              recordPaths(harness.workspaceDirectory, receipt.payloadId).record,
              "audit",
            ),
          widenedMode: 0o755,
        },
        {
          originalMode: 0o600,
          select: (harness, receipt) =>
            recordPaths(harness.workspaceDirectory, receipt.payloadId)
              .ciphertext,
          widenedMode: 0o644,
        },
        {
          originalMode: 0o600,
          select: (harness, receipt) =>
            recordPaths(harness.workspaceDirectory, receipt.payloadId)
              .availableAudit,
          widenedMode: 0o644,
        },
      ];
      for (const tamper of tamperCases) {
        await withEmptyParent(async (parent) => {
          const harness = await createBoundaryHarness(parent, {
            entropy: entropyHarness(`mode:${String(tamper.widenedMode)}`),
          });
          const receipt = await harness.boundary.stage(
            stageCommand(createSyntheticFilingPayloadFixture()),
          );
          const path = tamper.select(harness, receipt);
          await chmod(path, tamper.widenedMode);
          await expectCustodyFailure(
            () => harness.boundary.read({ payloadId: receipt.payloadId }),
            "record_invalid",
          );
          await chmod(path, tamper.originalMode);
          await harness.boundary.close();
        });
      }
    },
  );

  it.runIf(process.platform !== "win32")(
    "normalizes inaccessible filesystem-domain failures without paths or canaries",
    async () => {
      await withEmptyParent(async (parent) => {
        const harness = await createBoundaryHarness(parent, {
          entropy: entropyHarness("inaccessible-records"),
        });
        const records = join(harness.workspaceDirectory, "records");
        await chmod(records, 0o000);
        try {
          await expectCustodyFailure(
            () =>
              harness.boundary.stage(
                stageCommand(createSyntheticFilingPayloadFixture()),
              ),
            "record_invalid",
          );
        } finally {
          await chmod(records, 0o700);
        }
        await harness.boundary.close();
      });

      await withEmptyParent(async (parent) => {
        const harness = await createBoundaryHarness(parent, {
          entropy: entropyHarness("inaccessible-audit"),
        });
        const receipt = await harness.boundary.stage(
          stageCommand(createSyntheticFilingPayloadFixture()),
        );
        const auditDirectory = join(
          recordPaths(harness.workspaceDirectory, receipt.payloadId).record,
          "audit",
        );
        await chmod(auditDirectory, 0o000);
        try {
          await expectCustodyFailure(
            () => harness.boundary.read({ payloadId: receipt.payloadId }),
            "record_invalid",
          );
        } finally {
          await chmod(auditDirectory, 0o700);
        }
        await harness.boundary.close();
      });
    },
  );

  it("returns only frozen aggregate public audit and value-free errors with no payload, key, path, or canary", async () => {
    await withEmptyParent(async (parent) => {
      const harness = await createBoundaryHarness(parent);
      const receipt = await harness.boundary.stage(
        stageCommand(createSyntheticFilingPayloadFixture()),
      );
      const audit = await harness.boundary.inspectAudit({
        payloadId: receipt.payloadId,
      });
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(Object.isFrozen(audit)).toBe(true);
      expect(Object.keys(receipt).sort()).toEqual(
        [
          "algorithm",
          "byteLength",
          "claim",
          "contentSha256",
          "createdAt",
          "fixtureId",
          "payloadExpiresAt",
          "payloadId",
          "retentionClass",
          "schemaVersion",
          "sourceBindingSha256",
          "state",
          "transitionedAt",
          "version",
        ].sort(),
      );
      expect(Object.keys(audit).sort()).toEqual(
        [...Object.keys(receipt), "aadSha256", "ciphertextSha256"].sort(),
      );
      const serialized = JSON.stringify({ audit, receipt });
      expect(serialized).not.toMatch(/authTag|keyId|nonce|workspace|path/iu);
      expect(serialized).not.toContain(ERROR_CANARY);
      expect(serialized).not.toContain(
        Buffer.from(createSyntheticFilingPayloadFixture()).toString("base64"),
      );
      await expectCustodyFailure(
        () =>
          harness.boundary.inspectAudit({
            payloadId: `${receipt.payloadId}${ERROR_CANARY}`,
          }),
        "invalid_input",
      );
      await harness.boundary.close();
    });
  });
});

function options(
  workspaceParentDirectory: string,
  clock: FilingPayloadCustodyClock,
  entropy: FilingPayloadCustodyEntropy,
  keyStore: FilingPayloadKeyStore,
): FilingPayloadCustodyOptions {
  return {
    clock,
    entropy,
    keyStore,
    workspaceParentDirectory,
  };
}

async function createBoundaryHarness(
  parent: string,
  overrides: {
    readonly afterPhase?: (phase: FilingPayloadCustodyFaultPhase) => void;
    readonly clock?: ClockHarness;
    readonly entropy?: EntropyHarness;
    readonly keyStore?: KeyStoreHarness;
  } = {},
): Promise<BoundaryHarness> {
  const clock = overrides.clock ?? clockHarness();
  const entropy = overrides.entropy ?? entropyHarness("default-boundary");
  const keyStore = overrides.keyStore ?? keyStoreHarness();
  const testHarness = await createFileSystemFilingPayloadCustodyTestHarness(
    options(parent, clock.clock, entropy.entropy, keyStore.keyStore),
    overrides.afterPhase === undefined
      ? {}
      : { afterPhase: overrides.afterPhase },
  );
  return {
    boundary: testHarness.boundary,
    clock,
    entropy,
    keyStore,
    workspaceDirectory: testHarness.workspaceDirectory,
  };
}

function stageCommand(payload: Uint8Array): FilingPayloadStageCommand {
  return {
    contentSha256: FILING_PAYLOAD_CUSTODY_FIXTURE.contentSha256,
    fixtureId: FILING_PAYLOAD_CUSTODY_FIXTURE.fixtureId,
    payload,
    retentionClass: FILING_PAYLOAD_CUSTODY_RETENTION_POLICY.class,
    sourceBindingSha256: SOURCE_BINDING_SHA256,
  };
}

function clockHarness(initial: string | number = CREATED_AT): ClockHarness {
  let value = typeof initial === "string" ? Date.parse(initial) : initial;
  return {
    clock: { now: () => new Date(value) },
    get: () => value,
    set: (next: string | number) => {
      value = typeof next === "string" ? Date.parse(next) : next;
    },
  };
}

function entropyHarness(seed: string): EntropyHarness {
  let call = 0;
  const calls: Uint8Array[] = [];
  return {
    calls: () => calls.map((value) => Uint8Array.from(value)),
    entropy: {
      bytes: (length: number): Uint8Array => {
        const output = new Uint8Array(length);
        let offset = 0;
        while (offset < length) {
          const digest = createHash("sha256")
            .update(`${seed}:${String(call)}:${String(offset)}`)
            .digest();
          const remaining = Math.min(digest.byteLength, length - offset);
          output.set(digest.subarray(0, remaining), offset);
          offset += remaining;
        }
        call += 1;
        calls.push(Uint8Array.from(output));
        return output;
      },
    },
  };
}

function entropyCarrierHarness(
  transform: (source: Uint8Array, call: number) => Uint8Array,
): EntropyHarness {
  const base = entropyHarness("hostile-carrier");
  let call = 0;
  return {
    calls: base.calls,
    entropy: {
      bytes: (length: number): Uint8Array => {
        const result = transform(base.entropy.bytes(length), call);
        call += 1;
        return result;
      },
    },
  };
}

function hostileDependencyCarrier(
  source: Uint8Array,
  kind:
    | "shared"
    | "oversized"
    | "reproto_shared"
    | "reproto_int8"
    | "reproto_uint8_clamped"
    | "reproto_wider"
    | "proxy"
    | "subclass"
    | "detached",
  onProxyTrap: () => void,
): Uint8Array {
  if (kind === "shared") {
    const shared = new Uint8Array(new SharedArrayBuffer(source.byteLength));
    Uint8Array.prototype.set.call(shared, source);
    shadowByteMetadata(shared, source.byteLength);
    return shared;
  }
  if (kind === "oversized") {
    const oversized = new Uint8Array(source.byteLength + 1);
    Uint8Array.prototype.set.call(oversized, source);
    shadowByteMetadata(oversized, source.byteLength);
    return oversized;
  }
  if (kind === "reproto_shared") return rePrototypedSharedCopy(source);
  if (
    kind === "reproto_int8" ||
    kind === "reproto_uint8_clamped" ||
    kind === "reproto_wider"
  ) {
    return rePrototypedNonUint8Copy(source, kind);
  }
  if (kind === "subclass") {
    class ByteSubclass extends Uint8Array {}
    return new ByteSubclass(source);
  }
  if (kind === "detached") {
    const detached = new Uint8Array(source);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    return detached;
  }
  return new Proxy(source, {
    getPrototypeOf() {
      onProxyTrap();
      throw new Error(ERROR_CANARY);
    },
  });
}

function keyStoreHarness(): KeyStoreHarness {
  const keys = new Map<string, Uint8Array>();
  let forgetFailures = 0;
  let throwAfterPut = false;
  return {
    failForget: (count = 1) => {
      forgetFailures = count;
    },
    keyIds: () => [...keys.keys()].sort(),
    keyStore: {
      forget: (keyId: string): "forgotten" | "missing" => {
        if (forgetFailures > 0) {
          forgetFailures -= 1;
          throw new Error(ERROR_CANARY);
        }
        const value = keys.get(keyId);
        if (value === undefined) return "missing";
        value.fill(0);
        keys.delete(keyId);
        return "forgotten";
      },
      putIfAbsent: (keyId: string, key: Uint8Array): boolean => {
        if (keys.has(keyId)) return false;
        keys.set(keyId, Uint8Array.from(key));
        if (throwAfterPut) {
          throwAfterPut = false;
          throw new Error(ERROR_CANARY);
        }
        return true;
      },
      read: (keyId: string): Uint8Array | undefined => {
        const value = keys.get(keyId);
        return value === undefined ? undefined : Uint8Array.from(value);
      },
    },
    putSideEffectThenThrow: () => {
      throwAfterPut = true;
    },
    readKey: (keyId: string): Uint8Array | undefined => {
      const value = keys.get(keyId);
      return value === undefined ? undefined : Uint8Array.from(value);
    },
  };
}

function keyStoreReadCarrierHarness(
  transform: (source: Uint8Array) => Uint8Array,
): KeyStoreHarness {
  const base = keyStoreHarness();
  return {
    failForget: base.failForget,
    keyIds: base.keyIds,
    keyStore: {
      forget: base.keyStore.forget,
      putIfAbsent: base.keyStore.putIfAbsent,
      read: (keyId: string): Uint8Array | undefined => {
        const value = base.readKey(keyId);
        return value === undefined ? undefined : transform(value);
      },
    },
    putSideEffectThenThrow: base.putSideEffectThenThrow,
    readKey: base.readKey,
  };
}

function shadowByteMetadata(bytes: Uint8Array, byteLength: number): void {
  Object.defineProperties(bytes, {
    buffer: { value: new ArrayBuffer(byteLength) },
    byteLength: { value: byteLength },
  });
}

function withTypedArrayAllocationHook(
  source: Uint8Array,
  hook: (typeof BYTE_HOOKS)[number],
  onAccess: () => void,
): Uint8Array {
  const bytes = new Uint8Array(source);
  const failOnAccess = (): never => {
    onAccess();
    throw new Error("Caller-controlled allocation hook was accessed.");
  };
  if (hook === "species") {
    const constructor = {};
    Object.defineProperty(constructor, Symbol.species, { get: failOnAccess });
    Object.defineProperty(bytes, "constructor", { value: constructor });
  } else {
    Object.defineProperty(
      bytes,
      hook === "iterator"
        ? Symbol.iterator
        : hook === "toStringTag"
          ? Symbol.toStringTag
          : hook,
      { get: failOnAccess },
    );
  }
  return bytes;
}

function rePrototypedSharedCopy(source: Uint8Array): Uint8Array {
  const backing = new SharedArrayBuffer(source.byteLength);
  const bytes = new Uint8Array(backing);
  Uint8Array.prototype.set.call(bytes, source);
  Object.setPrototypeOf(backing, ArrayBuffer.prototype);
  return bytes;
}

function rePrototypedNonUint8Copies(source: Uint8Array): readonly Uint8Array[] {
  return [
    rePrototypedNonUint8Copy(source, "reproto_int8"),
    rePrototypedNonUint8Copy(source, "reproto_uint8_clamped"),
    rePrototypedNonUint8Copy(source, "reproto_wider"),
  ];
}

function rePrototypedNonUint8Copy(
  source: Uint8Array,
  kind: "reproto_int8" | "reproto_uint8_clamped" | "reproto_wider",
): Uint8Array {
  const paddedByteLength =
    Math.ceil(source.byteLength / Uint16Array.BYTES_PER_ELEMENT) *
    Uint16Array.BYTES_PER_ELEMENT;
  const view =
    kind === "reproto_int8"
      ? new Int8Array(source.byteLength)
      : kind === "reproto_uint8_clamped"
        ? new Uint8ClampedArray(source.byteLength)
        : new Uint16Array(paddedByteLength / Uint16Array.BYTES_PER_ELEMENT);
  Uint8Array.prototype.set.call(new Uint8Array(view.buffer), source);
  Object.setPrototypeOf(view, Uint8Array.prototype);
  return view as unknown as Uint8Array;
}

function recordPaths(
  workspace: string,
  payloadId: string,
): {
  readonly availableAudit: string;
  readonly ciphertext: string;
  readonly logicalUnavailableAudit: string;
  readonly record: string;
} {
  const record = join(workspace, "records", payloadId);
  return {
    availableAudit: join(record, "audit", "available.json"),
    ciphertext: join(record, "payload", "ciphertext.bin"),
    logicalUnavailableAudit: join(
      record,
      "audit",
      "logical-key-unavailability.json",
    ),
    record,
  };
}

async function expectOnlyPublishedRecord(
  harness: BoundaryHarness,
  receipt: FilingPayloadCustodyReceipt,
): Promise<void> {
  expect(await readdir(join(harness.workspaceDirectory, "records"))).toEqual([
    receipt.payloadId,
  ]);
  expect(await readdir(join(harness.workspaceDirectory, ".staging"))).toEqual(
    [],
  );
}

async function expectCustodyFailure(
  operation: () => unknown,
  code: FilingPayloadCustodyErrorCode,
): Promise<FilingPayloadCustodyError> {
  let error: unknown;
  try {
    await operation();
  } catch (value) {
    error = value;
  }
  expect(error).toBeInstanceOf(FilingPayloadCustodyError);
  expect((error as FilingPayloadCustodyError).code).toBe(code);
  expect(String(error)).toBe(
    "FilingPayloadCustodyError: FILING_PAYLOAD_CUSTODY_FAILURE",
  );
  expect(String(error)).not.toContain(ERROR_CANARY);
  return error as FilingPayloadCustodyError;
}

async function withEmptyParent<T>(
  operation: (parent: string) => Promise<T>,
): Promise<T> {
  const parent = await mkdtemp(join(tmpdir(), "rc-payload-custody-security-"));
  try {
    return await operation(parent);
  } finally {
    await rm(parent, { force: true, recursive: true });
  }
}

async function recursiveFiles(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await recursiveFiles(path)));
    else output.push(path);
  }
  return output;
}

async function readAudit(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function writeCanonicalJson(
  path: string,
  value: Record<string, unknown>,
): Promise<void> {
  await writeFile(path, `${canonicalJson(value)}\n`, "utf8");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (typeof value !== "object" || value === null)
    throw new Error("Unsupported synthetic canonical JSON value");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.byteLength === 0 || needle.byteLength > haystack.byteLength)
    return false;
  for (
    let offset = 0;
    offset <= haystack.byteLength - needle.byteLength;
    offset += 1
  ) {
    let equal = true;
    for (let index = 0; index < needle.byteLength; index += 1) {
      if (haystack[offset + index] !== needle[index]) {
        equal = false;
        break;
      }
    }
    if (equal) return true;
  }
  return false;
}

function throwingProxy<T extends object>(
  target: T,
  trap: "getOwnPropertyDescriptor" | "getPrototypeOf" | "ownKeys",
): T {
  return new Proxy(target, {
    getOwnPropertyDescriptor: (value, property) => {
      if (trap === "getOwnPropertyDescriptor") throw new Error(ERROR_CANARY);
      return Reflect.getOwnPropertyDescriptor(value, property);
    },
    getPrototypeOf: (value) => {
      if (trap === "getPrototypeOf") throw new Error(ERROR_CANARY);
      return Reflect.getPrototypeOf(value);
    },
    ownKeys: (value) => {
      if (trap === "ownKeys") throw new Error(ERROR_CANARY);
      return Reflect.ownKeys(value);
    },
  });
}

function sha256(value: Uint8Array): Sha256 {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
