import { describe, expect, it } from "vitest";

import { authorize } from "./authorization";
import { InMemoryResearchStateUnitOfWork } from "./in-memory";
import type {
  AlertRecord,
  AuditEvent,
  MembershipRole,
  OrganizationMembership,
  ResearchAction,
  SyntheticActorContext,
  ThesisRecord,
} from "./model";
import type { Clock, IdGenerator } from "./ports";
import { ResearchStateService } from "./service";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_A = "11111111-1111-4111-8111-111111111111";
const RESEARCHER_A = "22222222-2222-4222-8222-222222222222";
const VIEWER_A = "33333333-3333-4333-8333-333333333333";
const OWNER_B = "44444444-4444-4444-8444-444444444444";
const NO_MEMBER_A = "99999999-9999-4999-8999-999999999998";
const INSTRUMENT = "55555555-5555-4555-8555-555555555555";
const SHARED_THESIS_ID = "66666666-6666-4666-8666-666666666666";
const ALERT_ID = "77777777-7777-4777-8777-777777777777";
const NEW_THESIS_ID = "88888888-8888-4888-8888-888888888888";
const NOW = "2026-08-15T21:00:00Z";

const ownerA = actor(ORG_A, OWNER_A, "request.owner-a");
const researcherA = actor(ORG_A, RESEARCHER_A, "request.researcher-a");
const viewerA = actor(ORG_A, VIEWER_A, "request.viewer-a");
const ownerB = actor(ORG_B, OWNER_B, "request.owner-b");

describe("authorization", () => {
  const allActions: ResearchAction[] = [
    "thesis:read",
    "thesis:write",
    "thesis:delete",
    "alert:read",
    "alert:write",
    "alert:delete",
    "research:export",
  ];

  it.each<[MembershipRole, ResearchAction, boolean]>([
    ...allActions.map((action): [MembershipRole, ResearchAction, boolean] => [
      "owner",
      action,
      true,
    ]),
    ...allActions.map((action): [MembershipRole, ResearchAction, boolean] => [
      "researcher",
      action,
      true,
    ]),
    ["viewer", "thesis:read", true],
    ["viewer", "alert:read", true],
    ["viewer", "thesis:write", false],
    ["viewer", "thesis:delete", false],
    ["viewer", "alert:write", false],
    ["viewer", "alert:delete", false],
    ["viewer", "research:export", false],
  ])("applies the %s matrix for %s", (role, action, allowed) => {
    expect(
      authorize(ownerA, membership(ORG_A, OWNER_A, role), action, NOW).allowed,
    ).toBe(allowed);
  });

  it("uses half-open membership intervals and fails closed", () => {
    const bounded: OrganizationMembership = {
      ...membership(ORG_A, OWNER_A, "owner"),
      activeFrom: "2026-08-15T20:00:00Z",
      activeTo: "2026-08-15T22:00:00Z",
    };
    expect(
      authorize(ownerA, bounded, "thesis:read", bounded.activeFrom).allowed,
    ).toBe(true);
    expect(
      authorize(ownerA, bounded, "thesis:read", bounded.activeTo!).allowed,
    ).toBe(false);
    expect(
      authorize(ownerA, bounded, "thesis:read", "not-a-time").allowed,
    ).toBe(false);
    expect(authorize(ownerA, null, "thesis:read", NOW).allowed).toBe(false);
    expect(
      authorize(ownerA, membership(ORG_B, OWNER_A, "owner"), "thesis:read", NOW)
        .reason,
    ).toBe("TENANT_MISMATCH");
  });
});

describe("context-bound research state", () => {
  it("isolates identical object IDs across organizations", async () => {
    const { service } = harness();
    await expect(
      service.getThesis(ownerA, SHARED_THESIS_ID),
    ).resolves.toMatchObject({
      organizationId: ORG_A,
      claim: "Organization A claim",
    });
    await expect(
      service.getThesis(ownerB, SHARED_THESIS_ID),
    ).resolves.toMatchObject({
      organizationId: ORG_B,
      claim: "Organization B claim",
    });
    await expect(service.listTheses(ownerA)).resolves.toHaveLength(1);
    await expect(service.listTheses(ownerB)).resolves.toHaveLength(1);

    const forged = actor(ORG_B, OWNER_A, "request.forged-a");
    await expect(
      service.getThesis(forged, SHARED_THESIS_ID),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets viewers read but denies every mutation and export", async () => {
    const { service, unitOfWork } = harness();
    await expect(
      service.getThesis(viewerA, SHARED_THESIS_ID),
    ).resolves.toBeTruthy();
    await expect(service.listAlerts(viewerA)).resolves.toHaveLength(1);
    const before = await unitOfWork.snapshotForTesting();

    await expect(
      service.saveThesis(viewerA, {
        id: NEW_THESIS_ID,
        payload: thesisPayload("Viewer write"),
        expectedVersion: null,
        idempotencyKey: "viewer.write-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.deleteAlert(viewerA, {
        id: ALERT_ID,
        expectedVersion: 1,
        idempotencyKey: "viewer.delete-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.exportResearch(viewerA)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      unitOfWork.run(viewerA, (repositories) =>
        repositories.theses.delete(SHARED_THESIS_ID, 1),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await unitOfWork.snapshotForTesting()).toEqual(before);
  });

  it.each<[string, SyntheticActorContext, OrganizationMembership[]]>([
    ["viewer", viewerA, [membership(ORG_A, VIEWER_A, "viewer")]],
    [
      "inactive owner",
      ownerA,
      [
        {
          ...membership(ORG_A, OWNER_A, "owner"),
          activeTo: NOW,
        },
      ],
    ],
    [
      "actor without membership",
      actor(ORG_A, NO_MEMBER_A, "request.no-member"),
      [],
    ],
  ])(
    "denies direct unit-of-work mutations for a %s",
    async (_label, subject, memberships) => {
      const clock = new MutableClock(NOW);
      const unitOfWork = new InMemoryResearchStateUnitOfWork(
        {
          memberships,
          theses: [thesisRecord(ORG_A, OWNER_A, "Protected thesis")],
          alerts: [alertRecord()],
        },
        clock,
      );
      const before = await unitOfWork.snapshotForTesting();
      const proposedThesis: ThesisRecord = {
        ...thesisRecord(ORG_A, subject.principalId, "Unauthorized write"),
        id: NEW_THESIS_ID,
        createdBy: subject.principalId,
        updatedBy: subject.principalId,
      };
      const proposedAlert: AlertRecord = {
        ...alertRecord(),
        id: "99999999-9999-4999-8999-999999999997",
        createdBy: subject.principalId,
        updatedBy: subject.principalId,
      };

      await expect(
        unitOfWork.run(subject, (repositories) =>
          repositories.theses.delete(SHARED_THESIS_ID, 1),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        unitOfWork.run(subject, (repositories) =>
          repositories.alerts.delete(ALERT_ID, 1),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        unitOfWork.run(subject, (repositories) =>
          repositories.theses.put(proposedThesis, null),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        unitOfWork.run(subject, (repositories) =>
          repositories.alerts.put(proposedAlert, null),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      expect(await unitOfWork.snapshotForTesting()).toEqual(before);
    },
  );

  it("creates and updates with optimistic versions and immutable creators", async () => {
    const { service, unitOfWork, clock } = harness();
    const created = await service.saveThesis(ownerA, {
      id: NEW_THESIS_ID,
      payload: thesisPayload("Initial claim"),
      expectedVersion: null,
      idempotencyKey: "thesis.create-1",
    });
    expect(created).toMatchObject({
      organizationId: ORG_A,
      createdBy: OWNER_A,
      updatedBy: OWNER_A,
      version: 1,
    });

    clock.value = "2026-08-16T21:00:00Z";
    const updated = await service.saveThesis(researcherA, {
      id: NEW_THESIS_ID,
      payload: thesisPayload("Reviewed claim"),
      expectedVersion: 1,
      idempotencyKey: "thesis.update-1",
    });
    expect(updated).toMatchObject({
      claim: "Reviewed claim",
      createdBy: OWNER_A,
      createdAt: NOW,
      updatedBy: RESEARCHER_A,
      version: 2,
    });

    const snapshot = await unitOfWork.snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(2);
    expect(snapshot.audit.map((event) => event.action)).toEqual([
      "thesis.created",
      "thesis.updated",
    ]);
    expect(snapshot.audit[0]?.retentionUntil).toBe("2026-11-13T21:00:00.000Z");
  });

  it("replays matching keys and rejects changed requests without side effects", async () => {
    const { service, unitOfWork } = harness();
    const command = {
      id: NEW_THESIS_ID,
      payload: thesisPayload("Idempotent claim"),
      expectedVersion: null,
      idempotencyKey: "thesis.replay-1",
    } as const;
    const first = await service.saveThesis(ownerA, command);
    const replay = await service.saveThesis(ownerA, command);
    expect(replay).toEqual(first);
    let snapshot = await unitOfWork.snapshotForTesting();
    expect(snapshot.audit).toHaveLength(1);
    expect(snapshot.idempotency).toHaveLength(1);

    await expect(
      service.saveThesis(ownerA, {
        ...command,
        payload: thesisPayload("Changed request"),
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    snapshot = await unitOfWork.snapshotForTesting();
    expect(
      snapshot.theses.find((item) => item.id === NEW_THESIS_ID)?.claim,
    ).toBe("Idempotent claim");
    expect(snapshot.audit).toHaveLength(1);
  });

  it("fails an old replay after the referenced resource advances", async () => {
    const { service, unitOfWork } = harness();
    const original = {
      id: NEW_THESIS_ID,
      payload: thesisPayload("Original response metadata"),
      expectedVersion: null,
      idempotencyKey: "thesis.original-1",
    } as const;
    await service.saveThesis(ownerA, original);
    await service.saveThesis(ownerA, {
      id: NEW_THESIS_ID,
      payload: thesisPayload("Later version"),
      expectedVersion: 1,
      idempotencyKey: "thesis.later-1",
    });
    const beforeReplay = await unitOfWork.snapshotForTesting();

    await expect(service.saveThesis(ownerA, original)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    expect(await unitOfWork.snapshotForTesting()).toEqual(beforeReplay);
  });

  it("allows an idempotency key to be reused exactly at its 24-hour boundary", async () => {
    const { service, unitOfWork, clock } = harness();
    const key = "thesis.ttl-key1";
    await service.saveThesis(ownerA, {
      id: NEW_THESIS_ID,
      payload: thesisPayload("Before expiry"),
      expectedVersion: null,
      idempotencyKey: key,
    });
    clock.value = "2026-08-16T21:00:00Z";
    const updated = await service.saveThesis(ownerA, {
      id: NEW_THESIS_ID,
      payload: thesisPayload("At expiry"),
      expectedVersion: 1,
      idempotencyKey: key,
    });
    expect(updated).toMatchObject({ claim: "At expiry", version: 2 });
    const snapshot = await unitOfWork.snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.idempotency[0]?.resourceVersion).toBe(2);
    expect(snapshot.audit).toHaveLength(2);
  });

  it("serializes concurrent writers so only one stale update wins", async () => {
    const { service, unitOfWork } = harness();
    const results = await Promise.allSettled([
      service.saveThesis(ownerA, {
        id: SHARED_THESIS_ID,
        payload: thesisPayload("Concurrent left"),
        expectedVersion: 1,
        idempotencyKey: "concurrent.left-1",
      }),
      service.saveThesis(ownerA, {
        id: SHARED_THESIS_ID,
        payload: thesisPayload("Concurrent right"),
        expectedVersion: 1,
        idempotencyKey: "concurrent.right-1",
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "VERSION_CONFLICT" },
    });
    const snapshot = await unitOfWork.snapshotForTesting();
    expect(
      snapshot.theses.find(
        (item) => item.organizationId === ORG_A && item.id === SHARED_THESIS_ID,
      )?.version,
    ).toBe(2);
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.audit).toHaveLength(1);
  });

  it("rolls back resource and idempotency writes when audit creation fails", async () => {
    const { unitOfWork, clock } = harness();
    const service = new ResearchStateService(unitOfWork, clock, {
      next: () => "invalid-generated-id",
    });
    const before = await unitOfWork.snapshotForTesting();
    await expect(
      service.saveThesis(ownerA, {
        id: NEW_THESIS_ID,
        payload: thesisPayload("Must roll back"),
        expectedVersion: null,
        idempotencyKey: "rollback.audit-1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await unitOfWork.snapshotForTesting()).toEqual(before);
  });

  it("rolls back when the transaction result cannot be defensively cloned", async () => {
    const { unitOfWork } = harness();
    const before = await unitOfWork.snapshotForTesting();

    await expect(
      unitOfWork.run(ownerA, async (repositories) => {
        await repositories.theses.delete(SHARED_THESIS_ID, 1);
        return () => "functions are not structured-cloneable";
      }),
    ).rejects.toBeTruthy();

    expect(await unitOfWork.snapshotForTesting()).toEqual(before);
  });

  it("rejects unknown fields, wrong runtime types, and impossible clock dates without side effects", async () => {
    const { service, unitOfWork, clock } = harness();
    const attempts: Array<() => Promise<unknown>> = [
      () =>
        service.saveThesis(ownerA, {
          id: NEW_THESIS_ID,
          payload: {
            ...thesisPayload("Unknown field"),
            secretPayload: "must not persist",
          } as never,
          expectedVersion: null,
          idempotencyKey: "invalid.extra-1",
        }),
      () =>
        service.saveThesis(ownerA, {
          id: NEW_THESIS_ID,
          payload: {
            ...thesisPayload("Wrong type"),
            claim: 123,
          } as never,
          expectedVersion: null,
          idempotencyKey: "invalid.type-1",
        }),
      () =>
        service.saveAlert(ownerA, {
          id: "99999999-9999-4999-8999-999999999999",
          payload: { ...alertPayload(), threshold: 20.5 } as never,
          expectedVersion: null,
          idempotencyKey: "invalid.alert-type-1",
        }),
      () => {
        clock.value = "2026-02-31T21:00:00Z";
        return service.saveThesis(ownerA, {
          id: NEW_THESIS_ID,
          payload: thesisPayload("Impossible clock"),
          expectedVersion: null,
          idempotencyKey: "invalid.clock-1",
        });
      },
    ];

    for (const attempt of attempts) {
      const before = await unitOfWork.snapshotForTesting();
      await expect(attempt()).rejects.toMatchObject({ code: "INVALID_INPUT" });
      clock.value = NOW;
      expect(await unitOfWork.snapshotForTesting()).toEqual(before);
    }
  });

  it("counts astral thesis text maxima as Unicode code points", async () => {
    const { service, unitOfWork } = harness();
    const symbol = "🔬";
    const payload = {
      instrumentId: INSTRUMENT,
      claim: symbol.repeat(4_000),
      evidence: symbol.repeat(8_000),
      risks: symbol.repeat(8_000),
      invalidation: symbol.repeat(4_000),
    };

    expect([...payload.claim]).toHaveLength(4_000);
    expect(payload.claim).toHaveLength(8_000);
    expect([...payload.evidence]).toHaveLength(8_000);
    expect(payload.evidence).toHaveLength(16_000);

    const updated = await service.saveThesis(ownerA, {
      id: SHARED_THESIS_ID,
      payload,
      expectedVersion: 1,
      idempotencyKey: "unicode.maximum-1",
    });
    expect(updated).toMatchObject({ ...payload, version: 2 });

    const snapshot = await unitOfWork.snapshotForTesting();
    expect(
      snapshot.theses.find((item) => item.id === SHARED_THESIS_ID),
    ).toMatchObject({
      claim: payload.claim,
      evidence: payload.evidence,
      risks: payload.risks,
      invalidation: payload.invalidation,
      version: 2,
    });
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.audit).toHaveLength(1);
  });

  it.each<["claim" | "evidence" | "risks" | "invalidation", number]>([
    ["claim", 4_001],
    ["evidence", 8_001],
    ["risks", 8_001],
    ["invalidation", 4_001],
  ])(
    "rejects astral %s text above its Unicode code-point limit without side effects",
    async (field, length) => {
      const { service, unitOfWork } = harness();
      const before = await unitOfWork.snapshotForTesting();
      const payload = thesisPayload("Valid claim");
      payload[field] = "🔬".repeat(length);

      await expect(
        service.saveThesis(ownerA, {
          id: SHARED_THESIS_ID,
          payload,
          expectedVersion: 1,
          idempotencyKey: `unicode.over-${field}`,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(await unitOfWork.snapshotForTesting()).toEqual(before);
    },
  );

  it("rejects duplicate audit identifiers and rolls back the enclosing mutation", async () => {
    const { unitOfWork, clock } = harness();
    const duplicateAuditId = "00000000-0000-4000-8000-000000000123";
    const service = new ResearchStateService(unitOfWork, clock, {
      next: () => duplicateAuditId,
    });
    await service.saveThesis(ownerA, {
      id: NEW_THESIS_ID,
      payload: thesisPayload("First audited mutation"),
      expectedVersion: null,
      idempotencyKey: "audit.duplicate-1",
    });
    const afterFirst = await unitOfWork.snapshotForTesting();

    await expect(
      service.saveThesis(ownerA, {
        id: NEW_THESIS_ID,
        payload: thesisPayload("Must roll back"),
        expectedVersion: 1,
        idempotencyKey: "audit.duplicate-2",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    expect(await unitOfWork.snapshotForTesting()).toEqual(afterFirst);
  });

  it("rejects cross-tenant repository envelopes and payload-bearing audit metadata", async () => {
    const { unitOfWork } = harness();
    const before = await unitOfWork.snapshotForTesting();
    await expect(
      unitOfWork.run(ownerA, (repositories) =>
        repositories.theses.put(
          {
            ...thesisRecord(ORG_B, OWNER_A, "Cross-tenant write"),
            id: NEW_THESIS_ID,
            updatedBy: OWNER_A,
          },
          null,
        ),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const payloadBearingEvent = {
      id: "00000000-0000-4000-8000-000000000999",
      organizationId: ORG_A,
      principalId: OWNER_A,
      requestId: ownerA.requestId,
      action: "thesis.updated",
      resourceType: "thesis",
      resourceId: SHARED_THESIS_ID,
      resourceVersion: 1,
      occurredAt: NOW,
      retentionUntil: "2026-11-13T21:00:00Z",
      retentionClass: "security_audit_90d",
      secretPayload: "must never persist",
    } as AuditEvent;
    await expect(
      unitOfWork.run(ownerA, (repositories) =>
        repositories.audit.append(payloadBearingEvent),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await unitOfWork.snapshotForTesting()).toEqual(before);
  });

  it("hard-deletes payload, safely replays deletion, and exports only its tenant", async () => {
    const secret = "payload-secret-must-disappear";
    const { service, unitOfWork } = harness({
      theses: [
        thesisRecord(ORG_A, OWNER_A, secret),
        thesisRecord(ORG_B, OWNER_B, "Organization B claim"),
      ],
    });
    const command = {
      id: SHARED_THESIS_ID,
      expectedVersion: 1,
      idempotencyKey: "thesis.delete-1",
    } as const;
    await expect(service.deleteThesis(ownerA, command)).resolves.toEqual({
      id: SHARED_THESIS_ID,
      deletedVersion: 1,
    });
    await expect(service.deleteThesis(ownerA, command)).resolves.toEqual({
      id: SHARED_THESIS_ID,
      deletedVersion: 1,
    });
    await expect(
      service.getThesis(ownerA, SHARED_THESIS_ID),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const exported = await service.exportResearch(ownerA);
    expect(exported.organizationId).toBe(ORG_A);
    expect(exported.theses).toEqual([]);
    expect(exported.alerts.every((item) => item.organizationId === ORG_A)).toBe(
      true,
    );
    const snapshot = await unitOfWork.snapshotForTesting();
    expect(
      snapshot.theses.some(
        (item) => item.organizationId === ORG_B && item.id === SHARED_THESIS_ID,
      ),
    ).toBe(true);
    expect(JSON.stringify(snapshot.audit)).not.toContain(secret);
    expect(JSON.stringify(snapshot.idempotency)).not.toContain(secret);
    expect(JSON.stringify(snapshot.deletedResources)).not.toContain(secret);
    expect(snapshot.deletedResources).toEqual([
      {
        organizationId: ORG_A,
        resourceType: "thesis",
        resourceId: SHARED_THESIS_ID,
        deletedVersion: 1,
        deletedAt: NOW,
      },
    ]);
    expect(snapshot.audit.map((event) => event.action)).toEqual([
      "thesis.deleted",
      "research.exported",
    ]);
  });

  it("retains a payload-free tombstone and permanently rejects resource-ID reuse", async () => {
    const { service } = harness();
    const deletion = {
      id: SHARED_THESIS_ID,
      expectedVersion: 1,
      idempotencyKey: "thesis.delete-old",
    } as const;
    await service.deleteThesis(ownerA, deletion);
    await expect(
      service.saveThesis(ownerA, {
        id: SHARED_THESIS_ID,
        payload: thesisPayload("Replacement must not be created"),
        expectedVersion: null,
        idempotencyKey: "thesis.recreate-1",
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(service.deleteThesis(ownerA, deletion)).resolves.toEqual({
      id: SHARED_THESIS_ID,
      deletedVersion: 1,
    });
    await expect(
      service.deleteThesis(ownerA, {
        ...deletion,
        idempotencyKey: "thesis.delete-fresh",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("retains an alert tombstone and rejects alert-ID reuse after deletion", async () => {
    const { service, unitOfWork } = harness();
    const deletion = {
      id: ALERT_ID,
      expectedVersion: 1,
      idempotencyKey: "alert.delete-old",
    } as const;

    await service.deleteAlert(ownerA, deletion);
    await expect(
      service.saveAlert(ownerA, {
        id: ALERT_ID,
        payload: { ...alertPayload(), threshold: "99.0" },
        expectedVersion: null,
        idempotencyKey: "alert.recreate-1",
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await expect(service.deleteAlert(ownerA, deletion)).resolves.toEqual({
      id: ALERT_ID,
      deletedVersion: 1,
    });
    await expect(
      service.deleteAlert(ownerA, {
        ...deletion,
        idempotencyKey: "alert.delete-fresh",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(
      (await unitOfWork.snapshotForTesting()).deletedResources,
    ).toContainEqual({
      organizationId: ORG_A,
      resourceType: "alert",
      resourceId: ALERT_ID,
      deletedVersion: 1,
      deletedAt: NOW,
    });
  });

  it("applies the same isolation, validation, idempotency, and deletion rules to alerts", async () => {
    const { service, unitOfWork } = harness();
    await expect(service.getAlert(ownerA, ALERT_ID)).resolves.toMatchObject({
      threshold: "20.50",
    });
    await expect(service.getAlert(ownerB, ALERT_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.saveAlert(ownerA, {
        id: "99999999-9999-4999-8999-999999999999",
        payload: { ...alertPayload(), threshold: "1e6" },
        expectedVersion: null,
        idempotencyKey: "alert.invalid-1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    const updated = await service.saveAlert(ownerA, {
      id: ALERT_ID,
      payload: { ...alertPayload(), threshold: "21.125" },
      expectedVersion: 1,
      idempotencyKey: "alert.update-1",
    });
    expect(updated.version).toBe(2);
    await service.deleteAlert(ownerA, {
      id: ALERT_ID,
      expectedVersion: 2,
      idempotencyKey: "alert.delete-1",
    });
    const snapshot = await unitOfWork.snapshotForTesting();
    expect(snapshot.alerts).toEqual([]);
    expect(snapshot.audit.map((event) => event.action)).toEqual([
      "alert.updated",
      "alert.deleted",
    ]);
  });

  it("returns defensive copies rather than mutable storage references", async () => {
    const { service } = harness();
    const first = await service.getThesis(ownerA, SHARED_THESIS_ID);
    first.claim = "mutated outside repository";
    const second = await service.getThesis(ownerA, SHARED_THESIS_ID);
    expect(second.claim).toBe("Organization A claim");
  });

  it("rejects invalid seed intervals before exposing a repository", () => {
    expect(
      () =>
        new InMemoryResearchStateUnitOfWork(
          {
            memberships: [
              {
                ...membership(ORG_A, OWNER_A, "owner"),
                activeFrom: "2026-08-16T00:00:00Z",
                activeTo: "2026-08-15T00:00:00Z",
              },
            ],
          },
          new MutableClock(NOW),
        ),
    ).toThrow(/half-open/i);
  });
});

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

function harness(
  override: {
    theses?: ThesisRecord[];
    alerts?: AlertRecord[];
  } = {},
): {
  unitOfWork: InMemoryResearchStateUnitOfWork;
  service: ResearchStateService;
  clock: MutableClock;
} {
  const clock = new MutableClock(NOW);
  const unitOfWork = new InMemoryResearchStateUnitOfWork(
    {
      memberships: [
        membership(ORG_A, OWNER_A, "owner"),
        membership(ORG_A, RESEARCHER_A, "researcher"),
        membership(ORG_A, VIEWER_A, "viewer"),
        membership(ORG_B, OWNER_B, "owner"),
      ],
      theses: override.theses ?? [
        thesisRecord(ORG_A, OWNER_A, "Organization A claim"),
        thesisRecord(ORG_B, OWNER_B, "Organization B claim"),
      ],
      alerts: override.alerts ?? [alertRecord()],
    },
    clock,
  );
  return {
    unitOfWork,
    service: new ResearchStateService(unitOfWork, clock, new SequentialIds()),
    clock,
  };
}

function actor(
  organizationId: string,
  principalId: string,
  requestId: string,
): SyntheticActorContext {
  return { organizationId, principalId, requestId, synthetic: true };
}

function membership(
  organizationId: string,
  principalId: string,
  role: MembershipRole,
): OrganizationMembership {
  return {
    organizationId,
    principalId,
    role,
    activeFrom: "2026-01-01T00:00:00Z",
    activeTo: null,
  };
}

function thesisPayload(claim: string) {
  return {
    instrumentId: INSTRUMENT,
    claim,
    evidence: "Synthetic evidence note",
    risks: "Synthetic risk note",
    invalidation: "Synthetic invalidation rule",
  };
}

function thesisRecord(
  organizationId: string,
  principalId: string,
  claim: string,
): ThesisRecord {
  return {
    id: SHARED_THESIS_ID,
    organizationId,
    ...thesisPayload(claim),
    createdBy: principalId,
    createdAt: NOW,
    updatedBy: principalId,
    updatedAt: NOW,
    version: 1,
  };
}

function alertPayload() {
  return {
    instrumentId: INSTRUMENT,
    metricKey: "ebitda_margin",
    operator: "above" as const,
    threshold: "20.50",
  };
}

function alertRecord(): AlertRecord {
  return {
    id: ALERT_ID,
    organizationId: ORG_A,
    ...alertPayload(),
    createdBy: OWNER_A,
    createdAt: NOW,
    updatedBy: OWNER_A,
    updatedAt: NOW,
    version: 1,
  };
}
