import type { DossierDto } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app";

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
});
