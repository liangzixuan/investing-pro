import type {
  AlertWriteRequestDto,
  AlertWriteResponseDto,
  ProblemDetailsDto,
  ThesisWriteRequestDto,
  ThesisWriteResponseDto,
} from "@research-cockpit/contracts";
import Fastify, {
  type FastifyInstance,
  type InjectOptions,
  type LightMyRequestResponse,
} from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDemoResearchStateTestHarness,
  DEMO_ALERT_ID,
  DEMO_ALPHA_OWNER_PRINCIPAL_ID,
  DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID,
  DEMO_BETA_OWNER_PRINCIPAL_ID,
  DEMO_ORGANIZATION_ALPHA_ID,
  DEMO_ORGANIZATION_BETA_ID,
  DEMO_PERSONA_SELECTORS,
  DEMO_RESEARCH_INSTRUMENT_ID,
  DEMO_THESIS_ID,
  type DemoResearchStateComposition,
  type DemoResearchStateTestHarness,
} from "./demo-research-state";
import { registerResearchStateRoutes } from "./research-state-routes";

const NOW = "2026-08-20T12:00:00.000Z";
const JUST_BEFORE_NOW = "2026-08-20T11:59:59.999Z";
const OTHER_RESOURCE_ID = "99999999-9999-4999-8999-999999999999";
const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("bounded synthetic research-state write routes", () => {
  it("isolates identical thesis and alert IDs behind resolved organizations", async () => {
    const { app, snapshotForTesting } = await harness();

    const alphaThesis = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "alpha.thesis-1",
      payload: thesisPayload("Alpha replacement secret."),
    });
    const betaThesis = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.betaOwner,
      key: "beta.thesis-1",
      payload: thesisPayload("Beta replacement secret."),
    });
    const alphaAlert = await putAlert(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaResearcher,
      key: "alpha.alert-1",
      payload: alertPayload("alpha_replacement", "31.125"),
    });
    const betaAlert = await putAlert(app, {
      persona: DEMO_PERSONA_SELECTORS.betaOwner,
      key: "beta.alert-1",
      payload: alertPayload("beta_replacement", "42.250"),
    });

    for (const response of [alphaThesis, betaThesis, alphaAlert, betaAlert]) {
      expect(response.statusCode).toBe(200);
      expect(response.headers.etag).toBe('"2"');
      expect(response.payload).not.toMatch(
        /organizationId|principalId|createdBy|updatedBy|audit/i,
      );
    }
    expect(alphaThesis.payload).not.toContain("Beta replacement secret.");
    expect(betaThesis.payload).not.toContain("Alpha replacement secret.");
    expect(alphaAlert.payload).not.toContain("beta_replacement");
    expect(betaAlert.payload).not.toContain("alpha_replacement");

    expect(alphaThesis.json<ThesisWriteResponseDto>()).toEqual({
      schemaVersion: "1.0.0",
      synthetic: true,
      id: DEMO_THESIS_ID,
      ...thesisPayload("Alpha replacement secret."),
      version: 2,
      createdAt: "2026-08-15T21:00:00.000Z",
      updatedAt: NOW,
    });
    expect(betaAlert.json<AlertWriteResponseDto>()).toEqual({
      schemaVersion: "1.0.0",
      synthetic: true,
      id: DEMO_ALERT_ID,
      ...alertPayload("beta_replacement", "42.250"),
      version: 2,
      createdAt: "2026-08-15T21:00:00.000Z",
      updatedAt: NOW,
    });

    const snapshot = await snapshotForTesting();
    expect(
      snapshot.theses.find(
        (record) => record.organizationId === DEMO_ORGANIZATION_ALPHA_ID,
      )?.claim,
    ).toBe("Alpha replacement secret.");
    expect(
      snapshot.theses.find(
        (record) => record.organizationId === DEMO_ORGANIZATION_BETA_ID,
      )?.claim,
    ).toBe("Beta replacement secret.");
  });

  it("scopes one idempotency key independently across organizations with identical resource IDs", async () => {
    const { app, snapshotForTesting } = await harness();
    const sharedKey = "shared.org-key-1";
    const [alpha, beta] = await Promise.all([
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: sharedKey,
        payload: thesisPayload("Alpha shared-key replacement."),
      }),
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.betaOwner,
        key: sharedKey,
        payload: thesisPayload("Beta shared-key replacement."),
      }),
    ]);

    expect(alpha.statusCode).toBe(200);
    expect(beta.statusCode).toBe(200);
    expect(alpha.json<ThesisWriteResponseDto>().id).toBe(DEMO_THESIS_ID);
    expect(beta.json<ThesisWriteResponseDto>().id).toBe(DEMO_THESIS_ID);
    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(2);
    expect(
      snapshot.idempotency.map((record) => record.organizationId).sort(),
    ).toEqual([DEMO_ORGANIZATION_ALPHA_ID, DEMO_ORGANIZATION_BETA_ID].sort());
    expect(
      snapshot.idempotency.every((record) => record.key === sharedKey),
    ).toBe(true);
    expect(snapshot.audit).toHaveLength(2);
  });

  it("scopes one idempotency key independently across principals and still arbitrates versions", async () => {
    const { app, snapshotForTesting } = await harness();
    const sharedKey = "shared.principal-key-1";
    const owner = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: sharedKey,
      payload: thesisPayload("Owner principal update."),
    });
    const researcher = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaResearcher,
      key: sharedKey,
      ifMatch: '"2"',
      payload: thesisPayload("Researcher principal update."),
    });

    expect(owner.statusCode).toBe(200);
    expect(owner.headers.etag).toBe('"2"');
    expect(researcher.statusCode).toBe(200);
    expect(researcher.headers.etag).toBe('"3"');
    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(2);
    expect(
      snapshot.idempotency.map((record) => record.principalId).sort(),
    ).toEqual(
      [
        DEMO_ALPHA_OWNER_PRINCIPAL_ID,
        DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID,
      ].sort(),
    );
    expect(
      snapshot.idempotency.every(
        (record) =>
          record.organizationId === DEMO_ORGANIZATION_ALPHA_ID &&
          record.key === sharedKey,
      ),
    ).toBe(true);
    expect(
      snapshot.theses.find(
        (record) => record.organizationId === DEMO_ORGANIZATION_ALPHA_ID,
      )?.version,
    ).toBe(3);
  });

  it("scopes one principal's idempotency key independently across thesis and alert paths", async () => {
    const { app, snapshotForTesting } = await harness();
    const sharedKey = "shared.path-key-1";
    const [thesis, alert] = await Promise.all([
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: sharedKey,
        payload: thesisPayload("Cross-path thesis update."),
      }),
      putAlert(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: sharedKey,
        payload: alertPayload("cross_path_metric", "64.125"),
      }),
    ]);

    expect(thesis.statusCode).toBe(200);
    expect(alert.statusCode).toBe(200);
    expect(thesis.headers.etag).toBe('"2"');
    expect(alert.headers.etag).toBe('"2"');
    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(2);
    expect(
      snapshot.idempotency.every((record) => record.key === sharedKey),
    ).toBe(true);
    expect(
      snapshot.idempotency.map((record) => record.operation).sort(),
    ).toEqual([`alert.save:${DEMO_ALERT_ID}`, `thesis.save:${DEMO_THESIS_ID}`]);
    expect(snapshot.audit).toHaveLength(2);
  });

  it.each([
    ["viewer", DEMO_PERSONA_SELECTORS.alphaViewer, "127.0.0.1"],
    ["inactive", DEMO_PERSONA_SELECTORS.alphaInactive, "127.0.0.1"],
    ["no member", DEMO_PERSONA_SELECTORS.alphaNoMember, "127.0.0.1"],
    ["nonloopback", DEMO_PERSONA_SELECTORS.alphaOwner, "203.0.113.8"],
  ])(
    "denies a %s without any state effect",
    async (_label, persona, remote) => {
      const { app, snapshotForTesting } = await harness();
      const before = await snapshotForTesting();

      const response = await putThesis(app, {
        persona,
        key: "denied.write-1",
        payload: thesisPayload("Denied payload canary."),
        remoteAddress: remote,
      });

      expectGenericProblem(response, 403);
      expect(await snapshotForTesting()).toEqual(before);
    },
  );

  it("re-evaluates authorization before an exact replay when membership expires", async () => {
    let now = JUST_BEFORE_NOW;
    const { app, snapshotForTesting } = await harness({
      clock: { now: () => now },
    });
    const command = {
      persona: DEMO_PERSONA_SELECTORS.alphaInactive,
      key: "expiring.replay-1",
      payload: thesisPayload("Pre-expiry accepted update."),
    } as const;

    const first = await putThesis(app, command);
    expect(first.statusCode).toBe(200);
    const afterFirst = await snapshotForTesting();
    expect(afterFirst.idempotency).toHaveLength(1);
    expect(afterFirst.audit).toHaveLength(1);

    now = NOW;
    const replayAfterExpiry = await putThesis(app, command);
    expectGenericProblem(replayAfterExpiry, 403);
    expect(replayAfterExpiry.payload).not.toContain(
      "Pre-expiry accepted update.",
    );
    expect(await snapshotForTesting()).toEqual(afterFirst);
  });

  it("does not trust a forwarded loopback address from a nonloopback peer", async () => {
    const { app, snapshotForTesting } = await harness();
    const before = await snapshotForTesting();
    const response = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "forwarded.loopback-1",
      payload: thesisPayload("Forwarded-address canary."),
      remoteAddress: "203.0.113.8",
      extraHeaders: { "x-forwarded-for": "127.0.0.1" },
    });

    expectGenericProblem(response, 403);
    expect(response.payload).not.toContain("Forwarded-address canary.");
    expect(await snapshotForTesting()).toEqual(before);
  });

  it("rejects unresolved request authority before parsing while leaving role authorization in the service", async () => {
    const { app, snapshotForTesting } = await harness();
    const before = await snapshotForTesting();
    const unknownWithMalformedJson = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": "unknown-persona",
        "idempotency-key": "parser.unknown-1",
        "if-match": '"1"',
      },
      payload: '{"parser-secret-canary":',
      remoteAddress: "127.0.0.1",
    });
    const nonloopbackWithOversizedBody = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "idempotency-key": "parser.nonloopback-1",
        "if-match": '"1"',
      },
      payload: JSON.stringify({
        parserSecretCanary: "x".repeat(385 * 1_024),
      }),
      remoteAddress: "203.0.113.8",
    });
    const authorityHeaderWithWrongContentType = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "text/plain",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "x-principal-id": DEMO_ALPHA_OWNER_PRINCIPAL_ID,
        "idempotency-key": "parser.authority-1",
        "if-match": '"1"',
      },
      payload: "authority-parser-secret-canary",
      remoteAddress: "127.0.0.1",
    });

    for (const response of [
      unknownWithMalformedJson,
      nonloopbackWithOversizedBody,
      authorityHeaderWithWrongContentType,
    ])
      expectGenericProblem(response, 403);
    expect(unknownWithMalformedJson.payload).not.toContain(
      "parser-secret-canary",
    );
    expect(nonloopbackWithOversizedBody.payload).not.toContain(
      "parserSecretCanary",
    );
    expect(authorityHeaderWithWrongContentType.payload).not.toContain(
      "authority-parser-secret-canary",
    );

    const authorizedMalformedJson = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "idempotency-key": "parser.owner-1",
        "if-match": '"1"',
      },
      payload: '{"authorized-parser-canary":',
      remoteAddress: "127.0.0.1",
    });
    const viewerMalformedJson = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaViewer,
        "idempotency-key": "parser.viewer-1",
        "if-match": '"1"',
      },
      payload: '{"viewer-parser-canary":',
      remoteAddress: "127.0.0.1",
    });
    expectGenericProblem(authorizedMalformedJson, 400);
    expectGenericProblem(viewerMalformedJson, 400);
    expect(authorizedMalformedJson.payload).not.toContain(
      "authorized-parser-canary",
    );
    expect(viewerMalformedJson.payload).not.toContain("viewer-parser-canary");
    expect(await snapshotForTesting()).toEqual(before);
  });

  it("rejects missing, unknown, duplicate, and context-authority persona inputs", async () => {
    const { app, snapshotForTesting } = await harness();
    const before = await snapshotForTesting();
    const base = {
      "content-type": "application/json",
      "idempotency-key": "persona.reject-1",
      "if-match": '"1"',
    };
    const attempts = [
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: base,
        payload: thesisPayload("Missing persona."),
        remoteAddress: "127.0.0.1",
      }),
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: { ...base, "x-demo-persona": "unknown-persona" },
        payload: thesisPayload("Unknown persona."),
        remoteAddress: "127.0.0.1",
      }),
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          ...base,
          "x-demo-persona": [
            DEMO_PERSONA_SELECTORS.alphaOwner,
            DEMO_PERSONA_SELECTORS.betaOwner,
          ],
        },
        payload: thesisPayload("Duplicate persona."),
        remoteAddress: "127.0.0.1",
      }),
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          ...base,
          "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
          "x-organization-id": DEMO_ORGANIZATION_BETA_ID,
        },
        payload: thesisPayload("Forged organization."),
        remoteAddress: "127.0.0.1",
      }),
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          ...base,
          "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
          "x-role": "owner",
        },
        payload: thesisPayload("Forged role."),
        remoteAddress: "127.0.0.1",
      }),
    ];

    for (const response of await Promise.all(attempts))
      expectGenericProblem(response, 403);
    expect(await snapshotForTesting()).toEqual(before);
  });

  it("rejects malformed preconditions, duplicate headers, queries, content types, IDs, and bodies", async () => {
    const { app, snapshotForTesting } = await harness();
    const before = await snapshotForTesting();
    const badIfMatches = [
      'W/"1"',
      "*",
      '"1", "2"',
      '"0"',
      '"9007199254740992"',
      "1",
    ];

    for (const ifMatch of badIfMatches) {
      const response = await putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: `bad.ifmatch-${badIfMatches.indexOf(ifMatch)}`,
        ifMatch,
        payload: thesisPayload("Malformed precondition."),
      });
      expectGenericProblem(response, 400);
    }

    const missingIfMatch = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "idempotency-key": "missing.match-1",
      },
      payload: thesisPayload("Missing precondition."),
      remoteAddress: "127.0.0.1",
    });
    expectGenericProblem(missingIfMatch, 428);

    const malformedAttempts = [
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          "content-type": "application/json",
          "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
          "idempotency-key": ["duplicate.key-1", "duplicate.key-1"],
          "if-match": '"1"',
        },
        payload: thesisPayload("Duplicate key."),
        remoteAddress: "127.0.0.1",
      }),
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          "content-type": "application/json",
          "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
          "idempotency-key": "duplicate.match-1",
          "if-match": ['"1"', '"1"'],
        } as never,
        payload: thesisPayload("Duplicate match."),
        remoteAddress: "127.0.0.1",
      }),
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          "content-type": ["application/json", "application/json"],
          "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
          "idempotency-key": "duplicate.content-1",
          "if-match": '"1"',
        } as never,
        payload: thesisPayload("Duplicate content type."),
        remoteAddress: "127.0.0.1",
      }),
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: "query.reject-1",
        url: `/v1/theses/${DEMO_THESIS_ID}?organizationId=${DEMO_ORGANIZATION_BETA_ID}`,
        payload: thesisPayload("Query tenant."),
      }),
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: "uuid.reject-1",
        url: "/v1/theses/not-a-uuid",
        payload: thesisPayload("Bad id."),
      }),
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          "content-type": "text/plain",
          "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
          "idempotency-key": "content.reject-1",
          "if-match": '"1"',
        },
        payload: JSON.stringify(thesisPayload("Wrong content type.")),
        remoteAddress: "127.0.0.1",
      }),
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: "body.extra-1",
        payload: {
          ...thesisPayload("Extra identity."),
          organizationId: DEMO_ORGANIZATION_BETA_ID,
        },
      }),
    ];
    for (const response of await Promise.all(malformedAttempts))
      expectGenericProblem(response, 400);

    expect(await snapshotForTesting()).toEqual(before);
  });

  it("rejects missing or malformed idempotency keys and oversized personas without effects", async () => {
    const { app, snapshotForTesting } = await harness();
    const before = await snapshotForTesting();
    const missingKey = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "if-match": '"1"',
      },
      payload: thesisPayload("Missing key canary."),
      remoteAddress: "127.0.0.1",
    });
    expectGenericProblem(missingKey, 400);
    expect(missingKey.payload).not.toContain("Missing key canary.");

    for (const [index, key] of [
      "short",
      "contains space",
      "comma,key",
      "x".repeat(129),
    ].entries()) {
      const response = await putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key,
        payload: thesisPayload(`Malformed key canary ${index}.`),
      });
      expectGenericProblem(response, 400);
      expect(response.payload).not.toContain(`Malformed key canary ${index}.`);
    }

    const oversizedPersona = await putThesis(app, {
      persona: `synp_${"x".repeat(1_024)}`,
      key: "oversized.persona-1",
      payload: thesisPayload("Oversized persona canary."),
    });
    expectGenericProblem(oversizedPersona, 403);
    expect(oversizedPersona.payload).not.toContain("Oversized persona canary.");
    expect(await snapshotForTesting()).toEqual(before);
  });

  it("accepts a thesis body with every text field at its schema maximum", async () => {
    const { app, snapshotForTesting } = await harness();
    const payload: ThesisWriteRequestDto = {
      instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
      claim: `maximum-body-canary-${"c".repeat(3_980)}`,
      evidence: "e".repeat(8_000),
      risks: "r".repeat(8_000),
      invalidation: "i".repeat(4_000),
    };
    expect(payload.claim).toHaveLength(4_000);

    const response = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "maximum.body-1",
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBe('"2"');
    const dto = response.json<ThesisWriteResponseDto>();
    expect(dto.claim).toBe(payload.claim);
    expect(dto.evidence).toHaveLength(8_000);
    expect(dto.risks).toHaveLength(8_000);
    expect(dto.invalidation).toHaveLength(4_000);
    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.audit).toHaveLength(1);
  });

  it("accepts schema-max Unicode text sent as raw surrogate-pair escapes", async () => {
    const { app, snapshotForTesting } = await harness();
    const escapedAstral = "\\ud83d\\ude00";
    const rawPayload = [
      '{"instrumentId":"',
      DEMO_RESEARCH_INSTRUMENT_ID,
      '","claim":"',
      escapedAstral.repeat(4_000),
      '","evidence":"',
      escapedAstral.repeat(8_000),
      '","risks":"',
      escapedAstral.repeat(8_000),
      '","invalidation":"',
      escapedAstral.repeat(4_000),
      '"}',
    ].join("");
    expect(rawPayload.length).toBeGreaterThan(256 * 1_024);
    expect(rawPayload.length).toBeLessThan(384 * 1_024);

    const response = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "idempotency-key": "unicode.escaped-1",
        "if-match": '"1"',
      },
      payload: rawPayload,
      remoteAddress: "127.0.0.1",
    });

    expect(response.statusCode).toBe(200);
    const dto = response.json<ThesisWriteResponseDto>();
    expect(Array.from(dto.claim)).toHaveLength(4_000);
    expect(Array.from(dto.evidence)).toHaveLength(8_000);
    expect(Array.from(dto.risks)).toHaveLength(8_000);
    expect(Array.from(dto.invalidation)).toHaveLength(4_000);
    expect(dto.claim).toBe("😀".repeat(4_000));
    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.audit).toHaveLength(1);
  });

  it("rejects a body over 384 KiB with a value-free problem and no effect", async () => {
    const { app, snapshotForTesting } = await harness();
    const before = await snapshotForTesting();
    const response = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "transport.limit-1",
      payload: thesisPayload(
        `transport-limit-secret-canary-${"x".repeat(385 * 1_024)}`,
      ),
    });

    expectGenericProblem(response, 400);
    expect(response.payload).not.toContain("transport-limit-secret-canary");
    expect(await snapshotForTesting()).toEqual(before);
  });

  it("enforces the exact thesis and alert payload field constraints", async () => {
    const thesisMutations: Array<NonNullable<InjectOptions["payload"]>> = [
      { ...thesisPayload("Valid"), claim: "" },
      { ...thesisPayload("Valid"), claim: "x".repeat(4_001) },
      { ...thesisPayload("Valid"), evidence: "x".repeat(8_001) },
      { ...thesisPayload("Valid"), risks: "x".repeat(8_001) },
      { ...thesisPayload("Valid"), invalidation: "x".repeat(4_001) },
      { ...thesisPayload("Valid"), evidence: "unsafe\u0000control" },
      { ...thesisPayload("Valid"), instrumentId: "bad instrument" },
      { instrumentId: DEMO_RESEARCH_INSTRUMENT_ID, claim: "missing fields" },
    ];
    const alertMutations: Array<NonNullable<InjectOptions["payload"]>> = [
      { ...alertPayload(), metricKey: "UPPER_CASE" },
      { ...alertPayload(), metricKey: `a${"x".repeat(64)}` },
      { ...alertPayload(), operator: "equal" },
      { ...alertPayload(), threshold: "1e6" },
      { ...alertPayload(), threshold: "x".repeat(65) },
      { ...alertPayload(), instrumentId: "bad instrument" },
      { ...alertPayload(), principalId: DEMO_ALPHA_OWNER_PRINCIPAL_ID },
    ];

    for (const [index, payload] of thesisMutations.entries()) {
      const { app, snapshotForTesting } = await harness();
      const before = await snapshotForTesting();
      const response = await putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: `bad.thesis-${index}`,
        payload,
      });
      expectGenericProblem(response, 400);
      expect(await snapshotForTesting()).toEqual(before);
    }
    for (const [index, payload] of alertMutations.entries()) {
      const { app, snapshotForTesting } = await harness();
      const before = await snapshotForTesting();
      const response = await putAlert(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: `bad.alert-${index}`,
        payload,
      });
      expectGenericProblem(response, 400);
      expect(await snapshotForTesting()).toEqual(before);
    }
  });

  it("counts thesis safe-text limits in Unicode code points", async () => {
    const exactBoundary = "😀".repeat(4_000);
    expect(exactBoundary).toHaveLength(8_000);
    expect(Array.from(exactBoundary)).toHaveLength(4_000);
    const acceptedHarness = await harness();
    const accepted = await putThesis(acceptedHarness.app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "unicode.boundary-1",
      payload: thesisPayload(exactBoundary),
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json<ThesisWriteResponseDto>().claim).toBe(exactBoundary);

    const rejectedHarness = await harness();
    const before = await rejectedHarness.snapshotForTesting();
    const rejected = await putThesis(rejectedHarness.app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "unicode.overbound-1",
      payload: thesisPayload("😀".repeat(4_001)),
    });
    expectGenericProblem(rejected, 400);
    expect(rejected.payload).not.toContain("😀");
    expect(await rejectedHarness.snapshotForTesting()).toEqual(before);
  });

  it("replays one exact operation and rejects conflicts, stale versions, and superseded replays", async () => {
    const { app, snapshotForTesting } = await harness();
    const command = {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "thesis.replay-1",
      payload: thesisPayload("Replay result."),
    } as const;
    const first = await putThesis(app, command);
    const replay = await putThesis(app, command);
    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(replay.payload).toBe(first.payload);
    expect(replay.headers.etag).toBe(first.headers.etag);

    const changedPayload = await putThesis(app, {
      ...command,
      payload: thesisPayload("Changed replay."),
    });
    const changedVersion = await putThesis(app, {
      ...command,
      ifMatch: '"2"',
    });
    const stale = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "thesis.stale-1",
      payload: thesisPayload("Stale update."),
    });
    expectGenericProblem(changedPayload, 409);
    expectGenericProblem(changedVersion, 409);
    expectGenericProblem(stale, 412);

    const later = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "thesis.later-1",
      ifMatch: '"2"',
      payload: thesisPayload("Later successful update."),
    });
    expect(later.statusCode).toBe(200);
    expect(later.headers.etag).toBe('"3"');
    const supersededReplay = await putThesis(app, command);
    expectGenericProblem(supersededReplay, 409);
    expect(supersededReplay.payload).not.toContain("Replay result.");

    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(2);
    expect(snapshot.audit).toHaveLength(2);
    expect(
      snapshot.theses.find(
        (record) => record.organizationId === DEMO_ORGANIZATION_ALPHA_ID,
      )?.version,
    ).toBe(3);
  });

  it("allows exactly one of two concurrent stale writers", async () => {
    const { app, snapshotForTesting } = await harness();
    const responses = await Promise.all([
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: "concurrent.left-1",
        payload: thesisPayload("Concurrent left."),
      }),
      putThesis(app, {
        persona: DEMO_PERSONA_SELECTORS.alphaOwner,
        key: "concurrent.right-1",
        payload: thesisPayload("Concurrent right."),
      }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 412,
    ]);
    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.audit).toHaveLength(1);
  });

  it("settles concurrent matching replays with one mutation and one audit", async () => {
    const { app, snapshotForTesting } = await harness();
    const command = {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "concurrent.replay-1",
      payload: thesisPayload("Concurrent replay."),
    } as const;
    const responses = await Promise.all([
      putThesis(app, command),
      putThesis(app, command),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 200,
    ]);
    expect(responses[1]?.payload).toBe(responses[0]?.payload);
    const snapshot = await snapshotForTesting();
    expect(snapshot.idempotency).toHaveLength(1);
    expect(snapshot.audit).toHaveLength(1);
  });

  it("rolls back tentative resource and idempotency writes on an internal audit failure", async () => {
    const { app, snapshotForTesting } = await harness({
      ids: { next: () => "invalid-server-generated-id" },
    });
    const before = await snapshotForTesting();
    const response = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: "rollback.audit-1",
      payload: thesisPayload("Rollback payload secret."),
    });

    expectGenericProblem(response, 500);
    expect(response.payload).not.toContain("invalid-server-generated-id");
    expect(response.payload).not.toContain("Rollback payload secret.");
    expect(await snapshotForTesting()).toEqual(before);
  });

  it("keeps audits payload-free and request contexts separate after success and denial", async () => {
    const { app, snapshotForTesting } = await harness();
    const alphaPayloadSecret = "alpha-payload-secret-canary";
    const betaPayloadSecret = "beta-payload-secret-canary";
    const callerTraceSecret = "caller-trace-secret-canary";
    const alphaKey = "audit.alpha-key";
    const betaKey = "audit.beta-key";

    const alpha = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.alphaOwner,
      key: alphaKey,
      payload: thesisPayload(alphaPayloadSecret),
      extraHeaders: { "x-trace-id": callerTraceSecret },
    });
    const deniedWithoutPersona = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "idempotency-key": "audit.missing-1",
        "if-match": '"1"',
      },
      payload: thesisPayload("missing-persona-secret"),
      remoteAddress: "127.0.0.1",
    });
    const beta = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.betaOwner,
      key: betaKey,
      payload: thesisPayload(betaPayloadSecret),
    });
    expect(alpha.statusCode).toBe(200);
    expectGenericProblem(deniedWithoutPersona, 403);
    expect(beta.statusCode).toBe(200);

    const snapshot = await snapshotForTesting();
    expect(snapshot.audit).toHaveLength(2);
    expect(snapshot.audit.map((event) => event.organizationId)).toEqual([
      DEMO_ORGANIZATION_ALPHA_ID,
      DEMO_ORGANIZATION_BETA_ID,
    ]);
    expect(snapshot.audit.map((event) => event.principalId)).toEqual([
      DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      DEMO_BETA_OWNER_PRINCIPAL_ID,
    ]);
    expect(
      snapshot.audit.every((event) =>
        /^audit-[0-9a-f-]{36}$/.test(event.requestId),
      ),
    ).toBe(true);
    expect(new Set(snapshot.audit.map((event) => event.requestId)).size).toBe(
      2,
    );
    const auditJson = JSON.stringify(snapshot.audit);
    for (const forbidden of [
      alphaPayloadSecret,
      betaPayloadSecret,
      callerTraceSecret,
      alphaKey,
      betaKey,
      DEMO_PERSONA_SELECTORS.alphaOwner,
      DEMO_PERSONA_SELECTORS.betaOwner,
    ])
      expect(auditJson).not.toContain(forbidden);
    const idempotencyJson = JSON.stringify(snapshot.idempotency);
    expect(idempotencyJson).not.toContain(alphaPayloadSecret);
    expect(idempotencyJson).not.toContain(betaPayloadSecret);
  });

  it("returns a generic tenant-scoped 404 without leaking either canary", async () => {
    const { app, snapshotForTesting } = await harness();
    const before = await snapshotForTesting();
    const response = await putThesis(app, {
      persona: DEMO_PERSONA_SELECTORS.betaOwner,
      key: "missing.record-1",
      url: `/v1/theses/${OTHER_RESOURCE_ID}`,
      payload: thesisPayload("Missing record."),
    });
    expectGenericProblem(response, 404);
    expect(response.payload).not.toMatch(/Alpha synthetic|Beta synthetic/i);
    expect(response.payload).not.toContain(OTHER_RESOURCE_ID);
    expect(response.payload).not.toContain("Missing record.");
    expect(await snapshotForTesting()).toEqual(before);
  });
});

async function harness(
  options: Parameters<typeof createDemoResearchStateTestHarness>[0] = {},
): Promise<{
  app: FastifyInstance;
  composition: DemoResearchStateComposition;
  snapshotForTesting: DemoResearchStateTestHarness["snapshotForTesting"];
}> {
  const app = Fastify({
    logger: false,
    bodyLimit: 384 * 1_024,
    genReqId: () => `trace-${globalThis.crypto.randomUUID()}`,
  });
  apps.push(app);
  const testHarness = createDemoResearchStateTestHarness({
    clock: options.clock ?? { now: () => NOW },
    ...(options.ids ? { ids: options.ids } : {}),
  });
  const { composition } = testHarness;
  await registerResearchStateRoutes(app, composition);
  await app.ready();
  return {
    app,
    composition,
    snapshotForTesting: testHarness.snapshotForTesting,
  };
}

async function putThesis(
  app: FastifyInstance,
  input: {
    persona: string;
    key: string;
    payload: NonNullable<InjectOptions["payload"]>;
    ifMatch?: string;
    url?: string;
    remoteAddress?: string;
    extraHeaders?: Record<string, string>;
  },
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "PUT",
    url: input.url ?? `/v1/theses/${DEMO_THESIS_ID}`,
    headers: {
      "content-type": "application/json",
      "x-demo-persona": input.persona,
      "idempotency-key": input.key,
      "if-match": input.ifMatch ?? '"1"',
      ...input.extraHeaders,
    },
    payload: input.payload,
    remoteAddress: input.remoteAddress ?? "127.0.0.1",
  });
}

async function putAlert(
  app: FastifyInstance,
  input: {
    persona: string;
    key: string;
    payload: NonNullable<InjectOptions["payload"]>;
    ifMatch?: string;
    url?: string;
    remoteAddress?: string;
  },
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "PUT",
    url: input.url ?? `/v1/alerts/${DEMO_ALERT_ID}`,
    headers: {
      "content-type": "application/json",
      "x-demo-persona": input.persona,
      "idempotency-key": input.key,
      "if-match": input.ifMatch ?? '"1"',
    },
    payload: input.payload,
    remoteAddress: input.remoteAddress ?? "127.0.0.1",
  });
}

function thesisPayload(claim: string): ThesisWriteRequestDto {
  return {
    instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
    claim,
    evidence: "Synthetic evidence note.",
    risks: "Synthetic risk note.",
    invalidation: "Synthetic invalidation condition.",
  };
}

function alertPayload(
  metricKey = "ebitda_margin",
  threshold = "20.50",
): AlertWriteRequestDto {
  return {
    instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
    metricKey,
    operator: "above",
    threshold,
  };
}

function expectGenericProblem(
  response: LightMyRequestResponse,
  status: ProblemDetailsDto["status"],
): void {
  expect(response.statusCode).toBe(status);
  expect(response.headers["content-type"]).toContain(
    "application/problem+json",
  );
  const problem = response.json<ProblemDetailsDto>();
  expect(Object.keys(problem).sort()).toEqual(
    ["type", "title", "status", "detail", "instance", "traceId"].sort(),
  );
  expect(problem.type).toBe(
    `https://research-cockpit.local/problems/${status}`,
  );
  expect(problem.status).toBe(status);
  expect(problem.instance).toMatch(/^\/v1\/(?:theses|alerts)\/:/);
  expect(problem.traceId).toMatch(/^trace-[0-9a-f-]{36}$/);
  expect(problem.detail).not.toMatch(
    /alpha|beta|persona|organization|principal|payload|version \d|idempotency-key/i,
  );
  const serialized = JSON.stringify(problem);
  for (const forbidden of [
    DEMO_ORGANIZATION_ALPHA_ID,
    DEMO_ORGANIZATION_BETA_ID,
    DEMO_ALPHA_OWNER_PRINCIPAL_ID,
    DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID,
    DEMO_BETA_OWNER_PRINCIPAL_ID,
    ...Object.values(DEMO_PERSONA_SELECTORS),
  ])
    expect(serialized).not.toContain(forbidden);
}
