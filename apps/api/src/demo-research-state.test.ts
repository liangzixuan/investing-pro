import type { Clock, IdGenerator } from "@research-cockpit/research-state";
import { describe, expect, it } from "vitest";

import {
  createDemoResearchStateComposition,
  DEMO_ALERT_ID,
  DEMO_ALPHA_INACTIVE_PRINCIPAL_ID,
  DEMO_ALPHA_NO_MEMBER_PRINCIPAL_ID,
  DEMO_ALPHA_OWNER_PRINCIPAL_ID,
  DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID,
  DEMO_ALPHA_VIEWER_PRINCIPAL_ID,
  DEMO_BETA_OWNER_PRINCIPAL_ID,
  DEMO_CONTEXT_AUTHORITY_HEADER_NAMES,
  DEMO_ORGANIZATION_ALPHA_ID,
  DEMO_ORGANIZATION_BETA_ID,
  DEMO_PERSONA_HEADER_NAME,
  DEMO_PERSONA_SELECTORS,
  DEMO_RESEARCH_INSTRUMENT_ID,
  DEMO_THESIS_ID,
  createDemoResearchStateTestHarness,
  hasDemoContextAuthorityHeader,
  isExactDemoLoopbackRemoteAddress,
  resolveDemoActor,
  type DemoPersonaSelector,
  type DemoResearchStateComposition,
  type DemoResearchStateTestHarness,
} from "./demo-research-state";

const NOW = "2026-08-20T12:00:00.000Z";
const ONE_MILLISECOND_BEFORE_INACTIVE = "2026-08-20T11:59:59.999Z";

describe("demo research-state composition", () => {
  it("freezes the public non-secret selectors and shared fixture identities", () => {
    expect(DEMO_PERSONA_HEADER_NAME).toBe("x-demo-persona");
    expect(DEMO_PERSONA_SELECTORS).toEqual({
      alphaOwner: "synp_7f33c6a91d20",
      alphaResearcher: "synp_b4108e2c753d",
      alphaViewer: "synp_0d94f6b821ae",
      betaOwner: "synp_e62a1c9074bf",
      alphaInactive: "synp_5a6d91c20ef4",
      alphaNoMember: "synp_c8e2475b109d",
    });
    expect(Object.isFrozen(DEMO_PERSONA_SELECTORS)).toBe(true);
    expect(DEMO_ORGANIZATION_ALPHA_ID).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(DEMO_ORGANIZATION_BETA_ID).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(DEMO_THESIS_ID).toBe("66666666-6666-4666-8666-666666666666");
    expect(DEMO_ALERT_ID).toBe("77777777-7777-4777-8777-777777777777");
    expect(DEMO_RESEARCH_INSTRUMENT_ID).toBe("instrument.synthetic.syn1");
  });

  it("resolves every exact selector to its fixed server-side actor identity", () => {
    const expectations: ReadonlyArray<
      readonly [DemoPersonaSelector, string, string]
    > = [
      [
        DEMO_PERSONA_SELECTORS.alphaOwner,
        DEMO_ORGANIZATION_ALPHA_ID,
        DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      ],
      [
        DEMO_PERSONA_SELECTORS.alphaResearcher,
        DEMO_ORGANIZATION_ALPHA_ID,
        DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID,
      ],
      [
        DEMO_PERSONA_SELECTORS.alphaViewer,
        DEMO_ORGANIZATION_ALPHA_ID,
        DEMO_ALPHA_VIEWER_PRINCIPAL_ID,
      ],
      [
        DEMO_PERSONA_SELECTORS.betaOwner,
        DEMO_ORGANIZATION_BETA_ID,
        DEMO_BETA_OWNER_PRINCIPAL_ID,
      ],
      [
        DEMO_PERSONA_SELECTORS.alphaInactive,
        DEMO_ORGANIZATION_ALPHA_ID,
        DEMO_ALPHA_INACTIVE_PRINCIPAL_ID,
      ],
      [
        DEMO_PERSONA_SELECTORS.alphaNoMember,
        DEMO_ORGANIZATION_ALPHA_ID,
        DEMO_ALPHA_NO_MEMBER_PRINCIPAL_ID,
      ],
    ];

    for (const [selector, organizationId, principalId] of expectations) {
      const actor = resolveDemoActor({
        personaSelector: selector,
        remoteAddress: "127.0.0.1",
        requestHeaders: {},
      });
      expect(actor).toMatchObject({
        organizationId,
        principalId,
        synthetic: true,
      });
      expect(actor?.requestId).toMatch(
        /^audit-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("creates a fresh server-owned audit request id and never retains a global actor", () => {
    const first = resolveAlphaOwner();
    const second = resolveAlphaOwner();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
    expect(first?.requestId).not.toBe(second?.requestId);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(second)).toBe(true);

    expect(() => {
      if (first) first.organizationId = DEMO_ORGANIZATION_BETA_ID;
    }).toThrow(TypeError);
    expect(resolveAlphaOwner()?.organizationId).toBe(
      DEMO_ORGANIZATION_ALPHA_ID,
    );
  });

  it("requires an exact loopback remote and exact scalar selector", () => {
    for (const remoteAddress of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
      expect(isExactDemoLoopbackRemoteAddress(remoteAddress)).toBe(true);
      expect(
        resolveDemoActor({
          personaSelector: DEMO_PERSONA_SELECTORS.alphaOwner,
          remoteAddress,
          requestHeaders: {},
        }),
      ).not.toBeNull();
    }

    for (const remoteAddress of [
      "localhost",
      "127.0.0.2",
      "0.0.0.0",
      "::",
      " 127.0.0.1",
      undefined,
      null,
    ]) {
      expect(isExactDemoLoopbackRemoteAddress(remoteAddress)).toBe(false);
      expect(
        resolveDemoActor({
          personaSelector: DEMO_PERSONA_SELECTORS.alphaOwner,
          remoteAddress,
          requestHeaders: {},
        }),
      ).toBeNull();
    }

    for (const personaSelector of [
      "unknown-selector",
      ` ${DEMO_PERSONA_SELECTORS.alphaOwner}`,
      [DEMO_PERSONA_SELECTORS.alphaOwner],
      undefined,
      null,
    ]) {
      expect(
        resolveDemoActor({
          personaSelector,
          remoteAddress: "127.0.0.1",
          requestHeaders: {},
        }),
      ).toBeNull();
    }
  });

  it("rejects every context-authority header by case-insensitive presence", () => {
    expect(DEMO_CONTEXT_AUTHORITY_HEADER_NAMES).toEqual([
      "x-organization-id",
      "x-principal-id",
      "x-membership-role",
      "x-tenant-id",
      "x-role",
    ]);

    for (const header of DEMO_CONTEXT_AUTHORITY_HEADER_NAMES) {
      const mixedCase = header.toUpperCase();
      expect(hasDemoContextAuthorityHeader({ [mixedCase]: undefined })).toBe(
        true,
      );
      expect(
        resolveDemoActor({
          personaSelector: DEMO_PERSONA_SELECTORS.alphaOwner,
          remoteAddress: "127.0.0.1",
          requestHeaders: { [mixedCase]: "caller-controlled" },
        }),
      ).toBeNull();
    }
    expect(
      hasDemoContextAuthorityHeader({
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "x-trace-id": "caller-trace-only",
      }),
    ).toBe(false);
  });

  it("seeds identical resource ids for both tenants with distinct canaries", async () => {
    const testHarness = harness();
    const snapshot = await testHarness.snapshotForTesting();

    expect(snapshot.memberships).toHaveLength(5);
    expect(snapshot.theses).toHaveLength(2);
    expect(snapshot.alerts).toHaveLength(2);
    expect(new Set(snapshot.theses.map((record) => record.id))).toEqual(
      new Set([DEMO_THESIS_ID]),
    );
    expect(new Set(snapshot.alerts.map((record) => record.id))).toEqual(
      new Set([DEMO_ALERT_ID]),
    );
    expect(snapshot.theses.map((record) => record.claim).sort()).toEqual([
      "Alpha synthetic thesis canary.",
      "Beta synthetic thesis canary.",
    ]);
    expect(snapshot.alerts.map((record) => record.metricKey).sort()).toEqual([
      "alpha_metric_canary",
      "beta_metric_canary",
    ]);
    expect(snapshot.theses.every((record) => record.version === 1)).toBe(true);
    expect(snapshot.alerts.every((record) => record.version === 1)).toBe(true);
    expect(snapshot.idempotency).toEqual([]);
    expect(snapshot.audit).toEqual([]);
    expect(snapshot.deletedResources).toEqual([]);
  });

  it("keeps test snapshot access outside the production composition", () => {
    const composition = createDemoResearchStateComposition({
      clock: new FixedClock(NOW),
      ids: new SequentialIds(),
    });
    expect(Object.keys(composition).sort()).toEqual([
      "resolveActor",
      "service",
    ]);
    expect("unitOfWork" in composition).toBe(false);
    expect("snapshotForTesting" in composition).toBe(false);
  });

  it("uses the injected clock and id generator for an atomic service write", async () => {
    const clock = new FixedClock(NOW);
    const ids = new SequentialIds();
    const testHarness = createDemoResearchStateTestHarness({ clock, ids });
    const { composition } = testHarness;
    const actor = requireActor(composition, DEMO_PERSONA_SELECTORS.alphaOwner);

    const updated = await composition.service.saveThesis(actor, {
      id: DEMO_THESIS_ID,
      payload: {
        instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
        claim: "Alpha updated synthetic thesis.",
        evidence: "Alpha updated synthetic evidence.",
        risks: "Alpha updated synthetic risk.",
        invalidation: "Alpha updated synthetic invalidation.",
      },
      expectedVersion: 1,
      idempotencyKey: "cycle1c.alpha.update-1",
    });

    expect(updated).toMatchObject({
      organizationId: DEMO_ORGANIZATION_ALPHA_ID,
      updatedBy: DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      updatedAt: NOW,
      version: 2,
    });
    const snapshot = await testHarness.snapshotForTesting();
    expect(snapshot.audit).toHaveLength(1);
    expect(snapshot.audit[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      requestId: actor.requestId,
      organizationId: DEMO_ORGANIZATION_ALPHA_ID,
      principalId: DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      action: "thesis.updated",
    });
    expect(snapshot.idempotency).toHaveLength(1);
  });

  it("keeps factory instances and tenant records independent", async () => {
    const leftHarness = harness();
    const rightHarness = harness();
    const { composition: left } = leftHarness;
    const { composition: right } = rightHarness;
    const alpha = requireActor(left, DEMO_PERSONA_SELECTORS.alphaResearcher);
    const beta = requireActor(left, DEMO_PERSONA_SELECTORS.betaOwner);

    await left.service.saveAlert(alpha, {
      id: DEMO_ALERT_ID,
      payload: {
        instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
        metricKey: "alpha_updated_metric",
        operator: "below",
        threshold: "10.5",
      },
      expectedVersion: 1,
      idempotencyKey: "cycle1c.alpha.alert-1",
    });

    expect((await left.service.getAlert(alpha, DEMO_ALERT_ID)).version).toBe(2);
    expect((await left.service.getAlert(beta, DEMO_ALERT_ID)).version).toBe(1);

    const rightAlpha = requireActor(right, DEMO_PERSONA_SELECTORS.alphaOwner);
    expect(
      (await right.service.getAlert(rightAlpha, DEMO_ALERT_ID)).version,
    ).toBe(1);
    expect((await rightHarness.snapshotForTesting()).audit).toEqual([]);
  });

  it("resolves inactive and no-member personas but lets the service deny them", async () => {
    const testHarness = harness();
    const { composition } = testHarness;
    for (const selector of [
      DEMO_PERSONA_SELECTORS.alphaInactive,
      DEMO_PERSONA_SELECTORS.alphaNoMember,
    ]) {
      const actor = requireActor(composition, selector);
      await expect(
        composition.service.saveThesis(actor, {
          id: DEMO_THESIS_ID,
          payload: {
            instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
            claim: "This write must remain denied.",
            evidence: "This evidence must not persist.",
            risks: "This risk must not persist.",
            invalidation: "This invalidation must not persist.",
          },
          expectedVersion: 1,
          idempotencyKey: `denied.${selector}`,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    const snapshot = await testHarness.snapshotForTesting();
    expect(snapshot.theses.every((record) => record.version === 1)).toBe(true);
    expect(snapshot.idempotency).toEqual([]);
    expect(snapshot.audit).toEqual([]);
  });

  it("allows the expiring member before its half-open end and denies replay exactly at it", async () => {
    const clock = new MutableClock(ONE_MILLISECOND_BEFORE_INACTIVE);
    const testHarness = createDemoResearchStateTestHarness({
      clock,
      ids: new SequentialIds(),
    });
    const { composition } = testHarness;
    const actor = requireActor(
      composition,
      DEMO_PERSONA_SELECTORS.alphaInactive,
    );
    const command = {
      id: DEMO_THESIS_ID,
      payload: {
        instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
        claim: "Pre-expiry synthetic thesis update.",
        evidence: "Pre-expiry synthetic evidence update.",
        risks: "Pre-expiry synthetic risk update.",
        invalidation: "Pre-expiry synthetic invalidation update.",
      },
      expectedVersion: 1,
      idempotencyKey: "cycle1c.expiring.replay-1",
    } as const;

    await expect(
      composition.service.saveThesis(actor, command),
    ).resolves.toMatchObject({
      updatedAt: ONE_MILLISECOND_BEFORE_INACTIVE,
      version: 2,
    });
    const beforeBoundary = await testHarness.snapshotForTesting();

    clock.value = NOW;
    await expect(
      composition.service.saveThesis(actor, command),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await testHarness.snapshotForTesting()).toEqual(beforeBoundary);
  });
});

class FixedClock implements Clock {
  constructor(private readonly value: string) {}
  now(): string {
    return this.value;
  }
}

class MutableClock implements Clock {
  constructor(public value: string) {}
  now(): string {
    return this.value;
  }
}

class SequentialIds implements IdGenerator {
  private current = 1;
  next(): string {
    const suffix = String(this.current++).padStart(12, "0");
    return `00000000-0000-4000-8000-${suffix}`;
  }
}

function harness(): DemoResearchStateTestHarness {
  return createDemoResearchStateTestHarness({
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
  });
}

function resolveAlphaOwner() {
  return resolveDemoActor({
    personaSelector: DEMO_PERSONA_SELECTORS.alphaOwner,
    remoteAddress: "127.0.0.1",
    requestHeaders: {},
  });
}

function requireActor(
  composition: DemoResearchStateComposition,
  personaSelector: DemoPersonaSelector,
) {
  const actor = composition.resolveActor({
    personaSelector,
    remoteAddress: "127.0.0.1",
    requestHeaders: {},
  });
  if (!actor) throw new Error("Expected the fixed demo persona to resolve.");
  return actor;
}
