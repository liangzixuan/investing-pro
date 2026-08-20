import type {
  DossierDto,
  ThesisWriteResponseDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app";
import {
  DEMO_PERSONA_SELECTORS,
  DEMO_RESEARCH_INSTRUMENT_ID,
  DEMO_THESIS_ID,
} from "./demo-research-state";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe("demo REST API", () => {
  it("returns the post-restatement dossier with provenance headers", async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/instruments/SYN1/dossier?knownAt=2026-08-15T21%3A00%3A00Z",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-data-as-of"]).toBe("2026-08-15T21:00:00.000Z");
    expect(response.headers.etag).toMatch(/^W\/"[a-f0-9]{64}"$/);
    const body = response.json<DossierDto>();
    expect(body.dataMode).toBe("synthetic");
    expect(body.metrics.find((metric) => metric.key === "revenue")?.value).toBe(
      "116.400",
    );
  });

  it("does not serialize the restricted synthetic estimate", async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/instruments/SYN1/dossier",
    });

    expect(response.payload).not.toContain(
      "restricted_forward_revenue_estimate",
    );
    expect(response.payload).not.toContain("135.0");
    expect(response.payload).not.toContain("restricted-estimate");
    expect(response.json<DossierDto>().omissions.count).toBe(1);
  });

  it("returns problem details for invalid dates and denied evidence", async () => {
    const app = await buildApp();
    apps.push(app);
    const invalid = await app.inject({
      method: "GET",
      url: "/v1/instruments/SYN1/dossier?knownAt=yesterday",
    });
    const denied = await app.inject({
      method: "GET",
      url: "/v1/evidence/evidence.synthetic.restricted-estimate",
    });

    expect(invalid.statusCode).toBe(400);
    expect(invalid.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(denied.statusCode).toBe(404);
  });

  it("sets security and trace headers", async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-trace-id"]).toMatch(/^trace-/);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("does not trust a caller-supplied trace identifier", async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
      headers: { "x-trace-id": "caller-secret-trace-canary" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-trace-id"]).toMatch(/^trace-/);
    expect(response.headers["x-trace-id"]).not.toBe(
      "caller-secret-trace-canary",
    );
    expect(response.payload).not.toContain("caller-secret-trace-canary");
  });

  it("keeps browser CORS preflight restricted to GET", async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/theses/66666666-6666-4666-8666-666666666666",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "PUT",
        "access-control-request-headers":
          "content-type,x-demo-persona,if-match,idempotency-key",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toBe("GET");
    expect(response.headers["access-control-allow-headers"]).toBe(
      "Accept, Content-Type, X-Trace-Id",
    );
    expect(response.headers["access-control-allow-methods"]).not.toContain(
      "PUT",
    );
    expect(response.headers["access-control-allow-headers"]).not.toContain(
      "X-Demo-Persona",
    );

    const disallowed = await app.inject({
      method: "OPTIONS",
      url: "/health/ready",
      headers: {
        origin: "https://untrusted.example",
        "access-control-request-method": "GET",
      },
    });
    expect(disallowed.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("binds an actual ephemeral server only to the selected loopback", async () => {
    const app = await buildApp();
    apps.push(app);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string")
      throw new Error("Expected an IP socket address.");

    expect(address.address).toBe("127.0.0.1");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/health/live`,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "alive",
      mode: "synthetic_demo",
    });
  });

  it("wires a fresh composed write state into every app instance", async () => {
    const payload = {
      instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
      claim: "App composition canary.",
      evidence: "App composition evidence.",
      risks: "App composition risk.",
      invalidation: "App composition invalidation.",
    };
    const write = async (app: Awaited<ReturnType<typeof buildApp>>) =>
      app.inject({
        method: "PUT",
        url: `/v1/theses/${DEMO_THESIS_ID}`,
        headers: {
          "content-type": "application/json",
          "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
          "idempotency-key": "app.composition-1",
          "if-match": '"1"',
        },
        payload,
        remoteAddress: "127.0.0.1",
      });

    const firstApp = await buildApp();
    const secondApp = await buildApp();
    apps.push(firstApp, secondApp);
    const [first, second] = await Promise.all([
      write(firstApp),
      write(secondApp),
    ]);

    for (const response of [first, second]) {
      expect(response.statusCode).toBe(200);
      expect(response.headers.etag).toBe('"2"');
      expect(response.headers["x-trace-id"]).toMatch(/^trace-/);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json<ThesisWriteResponseDto>()).toMatchObject({
        schemaVersion: "1.0.0",
        synthetic: true,
        id: DEMO_THESIS_ID,
        claim: payload.claim,
        version: 2,
      });
    }
  });

  it("accepts the maximum schema-valid thesis body under a bounded transport cap", async () => {
    const app = await buildApp();
    apps.push(app);
    const response = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "idempotency-key": "app.maximum-body-1",
        "if-match": '"1"',
      },
      payload: {
        instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
        claim: "c".repeat(4_000),
        evidence: "e".repeat(8_000),
        risks: "r".repeat(8_000),
        invalidation: "i".repeat(4_000),
      },
      remoteAddress: "127.0.0.1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBe('"2"');
    expect(response.json<ThesisWriteResponseDto>()).toMatchObject({
      version: 2,
      claim: "c".repeat(4_000),
      evidence: "e".repeat(8_000),
      risks: "r".repeat(8_000),
      invalidation: "i".repeat(4_000),
    });

    const oversized = await app.inject({
      method: "PUT",
      url: `/v1/theses/${DEMO_THESIS_ID}`,
      headers: {
        "content-type": "application/json",
        "x-demo-persona": DEMO_PERSONA_SELECTORS.alphaOwner,
        "idempotency-key": "app.oversized-body-1",
        "if-match": '"2"',
      },
      payload: {
        instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
        claim: `transport-limit-canary-${"x".repeat(450_000)}`,
        evidence: "Synthetic evidence.",
        risks: "Synthetic risks.",
        invalidation: "Synthetic invalidation.",
      },
      remoteAddress: "127.0.0.1",
    });
    expect(oversized.statusCode).toBe(400);
    expect(oversized.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(oversized.payload).not.toContain("transport-limit-canary");
  });
});
