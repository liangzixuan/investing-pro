import { describe, expect, it } from "vitest";

import type { RightsPolicy } from "./model";
import {
  evaluateProjectionAuthorization,
  GetOperationProjection,
  projectOperation,
} from "./projection-contract";

const NOW = "2026-08-15T21:00:00.000Z";
const scope = {
  instrumentId: "instrument.synthetic.syn1",
  publicKnownAt: NOW,
  systemRecordedAt: NOW,
} as const;
const context = { territory: "demo_only", evaluatedAt: NOW } as const;

const allOperationsPolicy: RightsPolicy = {
  id: "rights.synthetic.all-operations",
  version: "1.0.0",
  classification: "synthetic",
  grants: [
    { purpose: "display", channel: "api", allowed: true },
    { purpose: "derive", channel: "api", allowed: true },
    { purpose: "alert", channel: "local_alert", allowed: true },
  ],
  territory: "demo_only",
  expiresAt: null,
};

function candidate(policy = allOperationsPolicy) {
  return {
    rowId: "fact.1",
    instrumentId: scope.instrumentId,
    value: { key: "revenue" },
    rightsPolicyId: policy.id,
    rightsPolicyVersion: policy.version,
  };
}

function projectionInput(overrides: Record<string, unknown> = {}) {
  return {
    scope,
    operation: "display_api",
    context,
    candidates: [candidate()],
    policies: [allOperationsPolicy],
    completeness: {
      state: "unknown",
      reason: "rls_filtered",
    },
    ...overrides,
  };
}

describe("operation-scoped projection authorization", () => {
  it("evaluates only the requested exact purpose/channel tuple", () => {
    const displayOnly: RightsPolicy = {
      ...allOperationsPolicy,
      grants: [{ purpose: "display", channel: "api", allowed: true }],
    };

    expect(
      evaluateProjectionAuthorization({
        operation: "display_api",
        rightsPolicyId: displayOnly.id,
        rightsPolicyVersion: displayOnly.version,
        policies: [displayOnly],
        context,
      }),
    ).toMatchObject({ outcome: "allow", reason: "exact_grant" });
    expect(
      evaluateProjectionAuthorization({
        operation: "derive_api",
        rightsPolicyId: displayOnly.id,
        rightsPolicyVersion: displayOnly.version,
        policies: [displayOnly],
        context,
      }),
    ).toMatchObject({ outcome: "deny", reason: "rights_not_granted" });
  });

  it("resolves the frozen policy ID/version in core", () => {
    const permissiveDifferentVersion = {
      ...allOperationsPolicy,
      version: "2.0.0",
    };
    const decision = evaluateProjectionAuthorization({
      operation: "display_api",
      rightsPolicyId: allOperationsPolicy.id,
      rightsPolicyVersion: "1.0.0",
      policies: [permissiveDifferentVersion],
      context,
    });

    expect(decision).toMatchObject({
      outcome: "deny",
      reason: "missing_or_invalid_policy",
    });
  });

  it("fails closed when an exact policy pair is duplicated", () => {
    const decision = evaluateProjectionAuthorization({
      operation: "display_api",
      rightsPolicyId: allOperationsPolicy.id,
      rightsPolicyVersion: allOperationsPolicy.version,
      policies: [allOperationsPolicy, { ...allOperationsPolicy }],
      context,
    });

    expect(decision.outcome).toBe("deny");
    expect(decision.reason).toBe("missing_or_invalid_policy");
  });

  it("denies malformed, ambiguous, expired, and wrong-territory grants", () => {
    const ambiguous = {
      ...allOperationsPolicy,
      grants: [
        ...allOperationsPolicy.grants,
        { purpose: "display", channel: "api", allowed: true },
      ],
    };
    const cases = [
      { ...allOperationsPolicy, expiresAt: NOW },
      { ...allOperationsPolicy, territory: "elsewhere" },
      ambiguous,
      { ...allOperationsPolicy, unexpected: true },
      {
        ...allOperationsPolicy,
        grants: [
          {
            purpose: {
              toString: () => {
                throw new Error("must not coerce an untrusted grant");
              },
            },
            channel: "api",
            allowed: true,
          },
        ],
      },
    ];

    for (const policy of cases) {
      expect(
        evaluateProjectionAuthorization({
          operation: "display_api",
          rightsPolicyId: allOperationsPolicy.id,
          rightsPolicyVersion: allOperationsPolicy.version,
          policies: [policy],
          context,
        }).outcome,
      ).toBe("deny");
    }
  });

  it("denies invalid operation, context, and reference inputs", () => {
    expect(
      evaluateProjectionAuthorization({
        operation: "export_api",
        rightsPolicyId: allOperationsPolicy.id,
        rightsPolicyVersion: allOperationsPolicy.version,
        policies: [allOperationsPolicy],
        context,
      }).reason,
    ).toBe("invalid_operation");
    expect(
      evaluateProjectionAuthorization({
        operation: "display_api",
        rightsPolicyId: allOperationsPolicy.id,
        rightsPolicyVersion: allOperationsPolicy.version,
        policies: [allOperationsPolicy],
        context: { ...context, evaluatedAt: "2026-02-31T00:00:00Z" },
      }).reason,
    ).toBe("invalid_context");
    expect(
      evaluateProjectionAuthorization({
        operation: "display_api",
        rightsPolicyId: "",
        rightsPolicyVersion: allOperationsPolicy.version,
        policies: [allOperationsPolicy],
        context,
      }).reason,
    ).toBe("invalid_policy_reference");
  });
});

describe("RLS-aware projection completeness", () => {
  it("never claims zero omissions for an RLS-filtered view", () => {
    const result = projectOperation(projectionInput());

    expect(result.rows).toEqual([{ key: "revenue" }]);
    expect(result.completeness).toEqual({
      state: "unknown",
      reason: "rls_filtered",
    });
    expect(result.omissions).toEqual({
      hasOmissions: true,
      count: null,
      reason: "source_completeness_unknown",
    });
  });

  it("does not expose a count even when incompleteness is known", () => {
    const result = projectOperation(
      projectionInput({
        completeness: { state: "known_incomplete", reason: "source_gap" },
      }),
    );

    expect(result.completeness).toEqual({
      state: "known_incomplete",
      reason: "source_gap",
    });
    expect(result.omissions).toEqual({
      hasOmissions: true,
      count: null,
      reason: "source_incomplete_or_rights_denied",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /expectedRowCount|missingRowCount/,
    );
  });

  it("projects each operation independently", () => {
    const displayDeriveOnly = {
      ...allOperationsPolicy,
      grants: [
        { purpose: "display", channel: "api", allowed: true },
        { purpose: "derive", channel: "api", allowed: true },
      ],
    } satisfies RightsPolicy;
    const base = projectionInput({
      candidates: [candidate(displayDeriveOnly)],
      policies: [displayDeriveOnly],
    });

    expect(projectOperation(base).rows).toHaveLength(1);
    expect(
      projectOperation({ ...base, operation: "derive_api" }).rows,
    ).toHaveLength(1);
    expect(
      projectOperation({ ...base, operation: "alert_local_alert" }).rows,
    ).toEqual([]);
  });

  it("does not return denied row identifiers or decision details", () => {
    const deniedPolicy = { ...allOperationsPolicy, grants: [] };
    const serialized = JSON.stringify(
      projectOperation(
        projectionInput({
          candidates: [candidate(deniedPolicy)],
          policies: [deniedPolicy],
        }),
      ),
    );

    expect(serialized).not.toContain("fact.1");
    expect(serialized).not.toContain("rowDecisions");
    expect(serialized).not.toContain("rights_denied");
  });

  it("returns defensive value, scope, and completeness copies", () => {
    const value = { key: "revenue" };
    const input = projectionInput({
      candidates: [{ ...candidate(), value }],
    });
    const result = projectOperation(input);

    value.key = "outside-mutation";
    (input.scope as { instrumentId: string }).instrumentId = "outside";
    expect(result.rows).toEqual([{ key: "revenue" }]);
    expect(result.scope?.instrumentId).toBe("instrument.synthetic.syn1");
  });

  it("loads candidates through the core-owned operation-scoped seam", async () => {
    const queries: unknown[] = [];
    const useCase = new GetOperationProjection(
      {
        load: (query) => {
          queries.push(query);
          return Promise.resolve({
            scope: query.scope,
            operation: query.operation,
            candidates: [candidate()],
            policies: [allOperationsPolicy],
            completeness: {
              state: "unknown" as const,
              reason: "rls_filtered" as const,
            },
          });
        },
      },
      { current: () => context },
    );

    const result = await useCase.execute({
      scope,
      operation: "display_api",
    });

    expect(queries).toEqual([{ scope, operation: "display_api", context }]);
    expect(result?.rows).toEqual([{ key: "revenue" }]);
    expect(result?.omissions).toMatchObject({
      hasOmissions: true,
      count: null,
    });
  });

  it.each([
    [
      "instrument",
      { ...scope, instrumentId: "instrument.synthetic.foreign" },
      "display_api",
    ],
    [
      "public cutoff",
      { ...scope, publicKnownAt: "2026-08-14T21:00:00.000Z" },
      "display_api",
    ],
    [
      "system cutoff",
      { ...scope, systemRecordedAt: "2026-08-14T21:00:00.000Z" },
      "display_api",
    ],
    ["operation", scope, "derive_api"],
  ] as const)(
    "fails closed when a source returns a mismatched %s",
    async (_label, returnedScope, returnedOperation) => {
      const useCase = new GetOperationProjection(
        {
          load: () =>
            Promise.resolve({
              scope: returnedScope,
              operation: returnedOperation,
              candidates: [candidate()],
              policies: [allOperationsPolicy],
              completeness: {
                state: "known_incomplete" as const,
                reason: "source_gap" as const,
              },
            }),
        },
        { current: () => context },
      );

      const result = await useCase.execute({
        scope,
        operation: "display_api",
      });

      expect(result).toMatchObject({
        scope: null,
        operation: null,
        rows: [],
        omissions: { hasOmissions: true, count: null },
      });
    },
  );

  it("uses a trusted clock instead of a historical cutoff for expiry", async () => {
    const expiredPolicy = {
      ...allOperationsPolicy,
      expiresAt: "2026-08-15T20:00:00.000Z",
    };
    const useCase = new GetOperationProjection(
      {
        load: (query) =>
          Promise.resolve({
            scope: query.scope,
            operation: query.operation,
            candidates: [candidate(expiredPolicy)],
            policies: [expiredPolicy],
            completeness: {
              state: "unknown" as const,
              reason: "rls_filtered" as const,
            },
          }),
      },
      { current: () => context },
    );

    const result = await useCase.execute({
      scope: {
        ...scope,
        publicKnownAt: "2026-08-14T21:00:00.000Z",
        systemRecordedAt: "2026-08-14T21:00:00.000Z",
      },
      operation: "display_api",
    });

    expect(result?.rows).toEqual([]);
    expect(result?.omissions).toMatchObject({
      hasOmissions: true,
      count: null,
    });
  });

  it("rejects a projection cutoff later than the trusted clock before loading", async () => {
    let loads = 0;
    const useCase = new GetOperationProjection(
      {
        load: () => {
          loads += 1;
          return Promise.resolve(null);
        },
      },
      { current: () => context },
    );

    const result = await useCase.execute({
      scope: {
        ...scope,
        systemRecordedAt: "2026-08-15T21:00:00.001Z",
      },
      operation: "display_api",
    });

    expect(loads).toBe(0);
    expect(result).toMatchObject({
      scope: null,
      rows: [],
      omissions: { hasOmissions: true, count: null },
    });
  });
});

describe("projection input hardening", () => {
  it.each([
    ["duplicate row IDs", { candidates: [candidate(), candidate()] }],
    ["unknown operation", { operation: "export_api" }],
    ["malformed scope", { scope: { ...scope, publicKnownAt: "not-a-date" } }],
    [
      "foreign-instrument candidate",
      {
        candidates: [
          { ...candidate(), instrumentId: "instrument.synthetic.foreign" },
        ],
      },
    ],
    [
      "extra candidate field",
      { candidates: [{ ...candidate(), unexpected: true }] },
    ],
    [
      "caller-asserted complete coverage",
      { completeness: { state: "complete", expectedRowCount: 1 } },
    ],
    ["extra top-level field", { unexpected: true }],
  ] as const)("fails closed for %s", (_label, override) => {
    const result = projectOperation(projectionInput(override));

    expect(result).toEqual({
      scope: null,
      operation: null,
      rows: [],
      completeness: {
        state: "unknown",
        reason: "not_independently_established",
      },
      omissions: {
        hasOmissions: true,
        count: null,
        reason: "invalid_projection_input",
      },
    });
  });

  it("fails closed when an authorized value cannot be cloned", () => {
    const result = projectOperation(
      projectionInput({
        candidates: [{ ...candidate(), value: () => "not cloneable" }],
      }),
    );

    expect(result.rows).toEqual([]);
    expect(result.omissions.reason).toBe("invalid_projection_input");
  });
});
