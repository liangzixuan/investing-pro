import { describe, expect, it, vi } from "vitest";

import {
  PERSONAL_SECURITY_MASTER_LIMITS,
  PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN,
  PersonalSecurityMasterError,
  admitPersonalSecurityMasterSnapshot,
  measurePersonalSecurityMasterSearchP95,
  searchPersonalSecurityMaster,
  type PersonalSecurityMasterAdmissionInput,
} from "./personal-security-master";
import {
  admissionFromDocument,
  bindRawSnapshot,
  buildMutableSecurityMasterDocument,
  buildSecurityMasterAdmission,
  canonicalBytes,
} from "./test-personal-security-master-builder";

describe("personal security master security boundary", () => {
  it("requires one exact data-only admission object", () => {
    const admission = buildSecurityMasterAdmission();
    expectFailure(
      () =>
        Reflect.apply(admitPersonalSecurityMasterSnapshot, undefined, [
          admission,
          admission,
        ]),
      "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
    );
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot({
          ...admission,
          ignored: true,
        } as PersonalSecurityMasterAdmissionInput),
      "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
    );
    const accessor = {
      expectedSha256: admission.expectedSha256,
      get snapshot(): Uint8Array {
        throw new Error("SECRET_ACCESSOR_CANARY");
      },
    };
    expectFailure(
      () => admitPersonalSecurityMasterSnapshot(accessor),
      "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
    );
  });

  it("owns ArrayBuffer bytes, rejects hostile carriers, and wipes its copy", () => {
    const admission = buildSecurityMasterAdmission();
    const original = new Uint8Array(admission.snapshot);
    const fill = vi
      .spyOn(Uint8Array.prototype, "fill")
      .mockImplementation(() => {
        throw new Error("HOSTILE_FILL_CANARY");
      });
    admitPersonalSecurityMasterSnapshot(admission);
    // The captured intrinsic wipes the unobservable owned copy in `finally`.
    expect(fill).not.toHaveBeenCalled();
    expect(admission.snapshot).toEqual(original);
    fill.mockRestore();

    const subclass = new (class extends Uint8Array {})(admission.snapshot);
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot({
          expectedSha256: admission.expectedSha256,
          snapshot: subclass,
        }),
      "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
    );
    const shared = new Uint8Array(
      new SharedArrayBuffer(admission.snapshot.length),
    );
    shared.set(admission.snapshot);
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot({
          expectedSha256: admission.expectedSha256,
          snapshot: shared,
        }),
      "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
    );
    const proxy = new Proxy(admission.snapshot, {
      getPrototypeOf() {
        throw new Error("SECRET_PROXY_CANARY");
      },
    });
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot({
          expectedSha256: admission.expectedSha256,
          snapshot: proxy,
        }),
      "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
    );
  });

  it("rejects digest mismatch before admitting content", () => {
    const admission = buildSecurityMasterAdmission();
    admission.snapshot[10] = admission.snapshot[10]! ^ 1;
    expectFailure(
      () => admitPersonalSecurityMasterSnapshot(admission),
      "PERSONAL_SECURITY_MASTER_DIGEST_MISMATCH",
    );
  });

  it("rejects malformed UTF-8, non-LF, pretty, duplicate-key, and BOM JSON", () => {
    const admission = buildSecurityMasterAdmission();
    const text = new TextDecoder().decode(admission.snapshot);
    const duplicateKey = text.replace(
      '"schemaVersion":"1.0.0"',
      '"schemaVersion":"1.0.0","schemaVersion":"1.0.0"',
    );
    const pretty = `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
    const variants = [
      new Uint8Array([0xc3, 0x28, 0x0a]),
      new TextEncoder().encode(text.trimEnd()),
      new TextEncoder().encode(pretty),
      new TextEncoder().encode(duplicateKey),
      new Uint8Array([0xef, 0xbb, 0xbf, ...admission.snapshot]),
    ];
    for (const snapshot of variants) {
      expectFailure(
        () => admitPersonalSecurityMasterSnapshot(bindRawSnapshot(snapshot)),
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
      );
    }
  });

  it("rejects provenance URLs containing query strings", () => {
    const document = buildMutableSecurityMasterDocument();
    (document.provenance.artifacts as Record<string, unknown>[])[0]!.sourceUri =
      "https://example.invalid/source.json?api_key=secret";
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(admissionFromDocument(document)),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );
  });

  it("enforces byte, depth, string, array, and row bounds", () => {
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(
          bindRawSnapshot(
            new Uint8Array(PERSONAL_SECURITY_MASTER_LIMITS.snapshotBytes + 1),
          ),
        ),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );

    let nested: unknown = "leaf";
    for (
      let depth = 0;
      depth <= PERSONAL_SECURITY_MASTER_LIMITS.documentDepth;
      depth += 1
    ) {
      nested = [nested];
    }
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(
          bindRawSnapshot(canonicalBytes(nested)),
        ),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(
          bindRawSnapshot(
            canonicalBytes(
              "x".repeat(
                PERSONAL_SECURITY_MASTER_LIMITS.maximumStringCodePoints + 1,
              ),
            ),
          ),
        ),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );

    const tooManyArtifacts = buildMutableSecurityMasterDocument();
    const artifact = (
      tooManyArtifacts.provenance.artifacts as Record<string, unknown>[]
    )[0]!;
    tooManyArtifacts.provenance.artifacts = Array.from(
      { length: PERSONAL_SECURITY_MASTER_LIMITS.provenanceArtifacts + 1 },
      (_, index) => ({
        ...artifact,
        artifactId: `artifact-${String(index).padStart(2, "0")}`,
      }),
    );
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(
          admissionFromDocument(tooManyArtifacts),
        ),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );

    const tooManyRows = buildMutableSecurityMasterDocument();
    tooManyRows.records = Array.from(
      { length: PERSONAL_SECURITY_MASTER_LIMITS.records + 1 },
      () => null,
    ) as unknown as typeof tooManyRows.records;
    expectFailure(
      () =>
        admitPersonalSecurityMasterSnapshot(admissionFromDocument(tooManyRows)),
      "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
    );
  });

  it("rejects bidi, format, surrogate, and control characters", () => {
    for (const dangerous of ["\u0000", "\u202e", "\u200d", "\ud800"]) {
      const document = buildMutableSecurityMasterDocument();
      document.issuers[0]!.issuerName = `Issuer${dangerous}Name`;
      expectFailure(
        () =>
          admitPersonalSecurityMasterSnapshot(admissionFromDocument(document)),
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
      );
    }
  });

  it("rejects empty or over-expanded normalized admitted names", () => {
    const overExpanded = "\uFDFA".repeat(128);
    const mutations = [
      (document: ReturnType<typeof buildMutableSecurityMasterDocument>) => {
        document.issuers[0]!.issuerName = overExpanded;
      },
      (document: ReturnType<typeof buildMutableSecurityMasterDocument>) => {
        document.records[0]!.securityName = overExpanded;
      },
      (document: ReturnType<typeof buildMutableSecurityMasterDocument>) => {
        document.records[0]!.shareClasses[0]!.shareClassName = overExpanded;
      },
      (document: ReturnType<typeof buildMutableSecurityMasterDocument>) => {
        document.issuers[0]!.issuerName = "---";
      },
      (document: ReturnType<typeof buildMutableSecurityMasterDocument>) => {
        document.issuers[0]!.issuerName = "x".repeat(129);
      },
    ];
    for (const mutate of mutations) {
      const document = buildMutableSecurityMasterDocument();
      mutate(document);
      expectFailure(
        () =>
          admitPersonalSecurityMasterSnapshot(admissionFromDocument(document)),
        "PERSONAL_SECURITY_MASTER_SNAPSHOT_INVALID",
      );
    }
  });

  it("fails closed for forged catalogs and malformed search inputs", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    for (const input of [
      { limit: 0, query: "S00000" },
      {
        limit: PERSONAL_SECURITY_MASTER_LIMITS.searchResultCap + 1,
        query: "S",
      },
      { limit: 1, query: "   " },
      { limit: 1, query: "x".repeat(129) },
      { limit: 1, query: "\uFDFA".repeat(128) },
      { limit: 1, query: "safe\u202edanger" },
      { extra: true, limit: 1, query: "S" },
    ]) {
      expectFailure(
        () => searchPersonalSecurityMaster(catalog, input),
        "PERSONAL_SECURITY_MASTER_SEARCH_INVALID",
      );
    }
    expectFailure(
      () =>
        searchPersonalSecurityMaster({ ...catalog }, { limit: 1, query: "S" }),
      "PERSONAL_SECURITY_MASTER_SEARCH_INVALID",
    );
  });

  it("fails closed for malformed measurement declarations and clocks", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    expectFailure(
      () =>
        measurePersonalSecurityMasterSearchP95(catalog, {
          hardwareProfile: "",
          iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
          queries: measurementQueries(),
          resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
        }),
      "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
    );
    expectFailure(
      () =>
        measurePersonalSecurityMasterSearchP95(
          catalog,
          {
            hardwareProfile: "test-clock",
            iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
            queries: measurementQueries(),
            resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
          },
          () => Number.NaN,
        ),
      "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
    );

    let clockCalls = 0;
    expectFailure(
      () =>
        measurePersonalSecurityMasterSearchP95(
          catalog,
          {
            hardwareProfile: "overflow-test-clock",
            iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
            queries: measurementQueries(),
            resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
          },
          () => {
            clockCalls += 1;
            return clockCalls === 1 ? -Number.MAX_VALUE : Number.MAX_VALUE;
          },
        ),
      "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
    );

    for (const input of [
      {
        hardwareProfile: "invalid-iterations",
        iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations - 1,
        queries: measurementQueries(),
        resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
      },
      {
        hardwareProfile: "invalid-result-limit",
        iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
        queries: measurementQueries(),
        resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit - 1,
      },
      {
        hardwareProfile: "duplicate-normalized-query",
        iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
        queries: [...measurementQueries().slice(0, -1), " s00000 "],
        resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
      },
      {
        hardwareProfile: "invalid-query-count",
        iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
        queries: measurementQueries().slice(0, -1),
        resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
      },
    ]) {
      expectFailure(
        () => measurePersonalSecurityMasterSearchP95(catalog, input),
        "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
      );
    }
  });

  it("captures an exact dense measurement query array without calling overrides", () => {
    const catalog = admitPersonalSecurityMasterSnapshot(
      buildSecurityMasterAdmission(),
    );
    const hostileArrays = [
      (() => {
        const queries = measurementQueries();
        Object.defineProperty(queries, "map", {
          value: () => ["S00000"],
        });
        return queries;
      })(),
      (() => {
        const queries = measurementQueries();
        Object.defineProperty(queries, "0", {
          enumerable: true,
          get: () => "S00000",
        });
        return queries;
      })(),
      (() => {
        const queries = measurementQueries();
        Reflect.deleteProperty(queries, "0");
        return queries;
      })(),
    ];
    for (const queries of hostileArrays) {
      expectFailure(
        () =>
          measurePersonalSecurityMasterSearchP95(catalog, {
            hardwareProfile: "hostile-query-array",
            iterations: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.iterations,
            queries,
            resultLimit: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.resultLimit,
          }),
        "PERSONAL_SECURITY_MASTER_MEASUREMENT_INVALID",
      );
    }
  });

  it("uses fixed value-free errors and emits no input-bearing logs", () => {
    const secret = "SECRET_SECURITY_MASTER_CANARY_791243";
    const spies = [
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];
    try {
      admitPersonalSecurityMasterSnapshot(
        bindRawSnapshot(new TextEncoder().encode(`{"${secret}":true}\n`)),
      );
      throw new Error("expected operation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonalSecurityMasterError);
      expect(String(error)).not.toContain(secret);
      expect((error as Error).message).toBe(
        "Personal security master operation failed.",
      );
      expect(Object.keys(error as object).sort()).toEqual(["code", "name"]);
      expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("replaces forged exported errors from hostile carrier traps", () => {
    const secret = "SECRET_FORGED_SECURITY_MASTER_ERROR_193842";
    const forged = new PersonalSecurityMasterError(
      secret as "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
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
    ) as PersonalSecurityMasterAdmissionInput;
    try {
      admitPersonalSecurityMasterSnapshot(hostile);
      throw new Error("expected operation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PersonalSecurityMasterError);
      expect(error).not.toBe(forged);
      expect((error as PersonalSecurityMasterError).code).toBe(
        "PERSONAL_SECURITY_MASTER_INVALID_INPUT",
      );
      expect(String(error)).not.toContain(secret);
      expect(Object.keys(error as object).sort()).toEqual(["code", "name"]);
    }
  });
});

function measurementQueries(): string[] {
  return Array.from(
    { length: PERSONAL_SECURITY_MASTER_MEASUREMENT_PLAN.queryCount },
    (_, index) => `S${String(index).padStart(5, "0")}`,
  );
}

function expectFailure(
  callback: () => unknown,
  code: PersonalSecurityMasterError["code"],
): void {
  try {
    callback();
    throw new Error("expected operation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalSecurityMasterError);
    expect((error as PersonalSecurityMasterError).code).toBe(code);
    expect((error as Error).message).toBe(
      "Personal security master operation failed.",
    );
  }
}
