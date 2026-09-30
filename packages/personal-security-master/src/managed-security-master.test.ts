import { describe, expect, expectTypeOf, it } from "vitest";

import {
  MANAGED_SECURITY_MASTER_CLAIM,
  MANAGED_SECURITY_MASTER_PROFILE,
  PERSONAL_SECURITY_MASTER_PROFILE,
  PersonalSecurityMasterError,
  admitManagedSecurityMasterSnapshot,
  admitPersonalSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  measurePersonalSecurityMasterSearchP95,
  screenPersonalSecurityMaster,
  searchPersonalSecurityMaster,
  type ManagedSecurityMasterCatalog,
  type PersonalSecurityMasterCatalog,
} from "./index";
import {
  admissionFromDocument,
  bindRawSnapshot,
  buildMutableSecurityMasterDocument,
  type MutableSecurityMasterDocument,
} from "./test-personal-security-master-builder";

function managedDocument(): MutableSecurityMasterDocument {
  const document = buildMutableSecurityMasterDocument();
  document.profile = MANAGED_SECURITY_MASTER_PROFILE;
  document.provenance.sourceLocator = `managed-composite-manifest:${String(document.provenance.sourceRevision)}`;
  Object.assign(document.sourcePolicyCompatibility, {
    cache: "permitted_managed",
    display: "permitted_managed",
    export: "permitted_with_attribution",
    localOnly: false,
    policyProfile: "personal_single_user_managed_connected",
    redistribution: "permitted_with_attribution",
    retention: "permitted_managed",
    rightsBasis: "reviewed_redistributable_source",
    search: "permitted_managed",
  });
  return document;
}

function expectFailure(action: () => unknown, code: string) {
  try {
    action();
    expect.fail("Admission unexpectedly succeeded");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalSecurityMasterError);
    expect(error).toMatchObject({
      code,
      message: "Personal security master operation failed.",
    });
  }
}

const invalidSnapshot = "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID";

describe("managed security master admission", () => {
  it("keeps exact distinct public catalog types and immutable managed declarations", () => {
    const catalog = admitManagedSecurityMasterSnapshot(
      admissionFromDocument(managedDocument()),
    );
    expectTypeOf(catalog).toEqualTypeOf<ManagedSecurityMasterCatalog>();
    expectTypeOf<ManagedSecurityMasterCatalog>().not.toExtend<PersonalSecurityMasterCatalog>();
    expectTypeOf(
      admitPersonalSecurityMasterSnapshot,
    ).returns.toEqualTypeOf<PersonalSecurityMasterCatalog>();
    expect(catalog).toMatchObject({
      claim: MANAGED_SECURITY_MASTER_CLAIM,
      profile: MANAGED_SECURITY_MASTER_PROFILE,
      status: "admitted_for_personal_managed_search",
      coverage: {
        basis: "synthetic_engineering_only_not_real_universe",
        activeEligibleSecurities: 2,
      },
      provenance: { contentKind: "synthetic_engineering" },
      sourcePolicyCompatibility: {
        localOnly: false,
        export: "permitted_with_attribution",
        redistribution: "permitted_with_attribution",
      },
    });
    for (const value of [
      catalog,
      catalog.coverage,
      catalog.provenance,
      catalog.provenance.artifacts,
      catalog.sourcePolicyCompatibility,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it("labels a declared redistributable source as a reviewed snapshot only", () => {
    const document = managedDocument();
    document.provenance.contentKind = "redistributable_source";
    const catalog = admitManagedSecurityMasterSnapshot(
      admissionFromDocument(document),
    );
    expect(catalog.coverage.basis).toBe("reviewed_snapshot_only");
    expect(catalog.coverage.eligibleSecurityBand).toBe("under_1000");
    expect(catalog.provenance.contentKind).toBe("redistributable_source");
  });

  it("rejects both complete cross-profile snapshots and profile-only relabeling", () => {
    const local = buildMutableSecurityMasterDocument();
    const managed = managedDocument();
    expectFailure(
      () => admitManagedSecurityMasterSnapshot(admissionFromDocument(local)),
      invalidSnapshot,
    );
    expectFailure(
      () => admitPersonalSecurityMasterSnapshot(admissionFromDocument(managed)),
      invalidSnapshot,
    );
    local.profile = MANAGED_SECURITY_MASTER_PROFILE;
    managed.profile = PERSONAL_SECURITY_MASTER_PROFILE;
    expectFailure(
      () => admitManagedSecurityMasterSnapshot(admissionFromDocument(local)),
      invalidSnapshot,
    );
    expectFailure(
      () => admitPersonalSecurityMasterSnapshot(admissionFromDocument(managed)),
      invalidSnapshot,
    );
  });

  it.each([
    ["cache", "permitted_owner_local"],
    ["display", "permitted_owner_local"],
    ["export", "prohibited"],
    ["localOnly", true],
    ["policyProfile", "personal_single_user_local_connected"],
    ["redistribution", "prohibited"],
    ["retention", "permitted_owner_local"],
    ["rightsBasis", "owner_reviewed_rights_compatible"],
    ["search", "permitted_owner_local"],
  ])("rejects a local policy value in managed %s", (key, value) => {
    const document = managedDocument();
    document.sourcePolicyCompatibility[String(key)] = value;
    expectFailure(
      () => admitManagedSecurityMasterSnapshot(admissionFromDocument(document)),
      invalidSnapshot,
    );
  });

  it.each([
    ["attribution", "optional"],
    ["policyDocumentSha256", "sha256:invalid"],
    ["sourceId", "another-source"],
    ["revokedAt", "2026-08-01T00:00:00.000Z"],
    ["expiresAt", "2026-09-01T18:00:00.000Z"],
    ["reviewedAt", "2026-09-01T17:01:00.000Z"],
  ])(
    "preserves common policy and chronology validation for %s",
    (key, value) => {
      const document = managedDocument();
      document.sourcePolicyCompatibility[String(key)] = value;
      expectFailure(
        () =>
          admitManagedSecurityMasterSnapshot(admissionFromDocument(document)),
        invalidSnapshot,
      );
    },
  );

  it.each([
    ["contentKind", "owner_local_source"],
    [
      "sourceLocator",
      `owner-local-composite-manifest:sha256:${"c".repeat(64)}`,
    ],
    ["sourceLocator", `managed-composite-manifest:sha256:${"a".repeat(64)}`],
    ["attribution", ""],
  ])("rejects mismatched managed provenance %s", (key, value) => {
    const document = managedDocument();
    document.provenance[String(key)] = value;
    expectFailure(
      () => admitManagedSecurityMasterSnapshot(admissionFromDocument(document)),
      invalidSnapshot,
    );
  });

  it("preserves digest, canonical-byte and closed-key validation", () => {
    const admission = admissionFromDocument(managedDocument());
    expectFailure(
      () =>
        admitManagedSecurityMasterSnapshot({
          ...admission,
          expectedSha256: `sha256:${"0".repeat(64)}`,
        }),
      "PERSONAL_SECURITY_MASTER_DIGEST_MISMATCH",
    );
    const withoutLf = admission.snapshot.slice(0, -1);
    expectFailure(
      () => admitManagedSecurityMasterSnapshot(bindRawSnapshot(withoutLf)),
      invalidSnapshot,
    );
    const extra = managedDocument();
    extra.sourcePolicyCompatibility.unreviewedPermission = true;
    expectFailure(
      () => admitManagedSecurityMasterSnapshot(admissionFromDocument(extra)),
      invalidSnapshot,
    );
  });

  it("preserves the complete identity graph checks", () => {
    const document = managedDocument();
    document.records[1]!.securityId = document.records[0]!.securityId;
    expectFailure(
      () => admitManagedSecurityMasterSnapshot(admissionFromDocument(document)),
      invalidSnapshot,
    );
  });

  it("shares deterministic local search and exact lookup without exposing mutable input", () => {
    const local = admitPersonalSecurityMasterSnapshot(
      admissionFromDocument(buildMutableSecurityMasterDocument()),
    );
    const admission = admissionFromDocument(managedDocument());
    const managed = admitManagedSecurityMasterSnapshot(admission);
    const query = { query: "alpha", limit: 25 };
    const expected = searchPersonalSecurityMaster(local, query);
    expect(searchPersonalSecurityMaster(managed, query)).toEqual(expected);
    expect(expected.results.length).toBeGreaterThan(0);
    const first = expected.results[0]!;
    expect(
      lookupPersonalSecurityMasterListing(managed, first.listingId),
    ).toEqual(lookupPersonalSecurityMasterListing(local, first.listingId));
    expect(
      lookupPersonalSecurityMasterListing(managed, "missing-listing"),
    ).toBeNull();
    admission.snapshot.fill(0);
    expect(searchPersonalSecurityMaster(managed, query)).toEqual(expected);
    const result = searchPersonalSecurityMaster(managed, query);
    expect(Object.isFrozen(result.results[0])).toBe(true);
    expectFailure(
      () => searchPersonalSecurityMaster({ ...managed }, query),
      "PERSONAL_SECURITY_MASTER_SEARCH_INVALID",
    );
    expectFailure(
      () =>
        lookupPersonalSecurityMasterListing({ ...managed }, first.listingId),
      "PERSONAL_SECURITY_MASTER_LOOKUP_INVALID",
    );
  });

  it("keeps screen and measurement runtime authority local-only", () => {
    const managed = admitManagedSecurityMasterSnapshot(
      admissionFromDocument(managedDocument()),
    );
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        get() {
          reads += 1;
          throw new Error("must not read");
        },
      },
    );
    expectFailure(
      () =>
        Reflect.apply(screenPersonalSecurityMaster, undefined, [
          managed,
          hostile,
        ]),
      "PERSONAL_SECURITY_MASTER_SCREEN_INVALID",
    );
    expectFailure(
      () =>
        Reflect.apply(measurePersonalSecurityMasterSearchP95, undefined, [
          managed,
          hostile,
        ]),
      "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
    );
    expect(reads).toBe(0);
  });

  it.each([
    admitPersonalSecurityMasterSnapshot,
    admitManagedSecurityMasterSnapshot,
  ])("rejects wrong public-entry arity before touching input", (admit) => {
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          reads += 1;
          throw new Error("must not read");
        },
      },
    );
    for (const args of [[], [hostile, "managed"]]) {
      expectFailure(
        () => Reflect.apply(admit, undefined, args),
        "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
      );
    }
    expect(reads).toBe(0);
  });
});
