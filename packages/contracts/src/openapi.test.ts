import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type {
  AlertWriteRequestDto,
  AlertWriteResponseDto,
  ThesisWriteRequestDto,
  ThesisWriteResponseDto,
} from "./index";

const OPENAPI_URL = new URL("../openapi/openapi.yaml", import.meta.url);
const PERSONA_SELECTORS = [
  "synp_7f33c6a91d20",
  "synp_b4108e2c753d",
  "synp_0d94f6b821ae",
  "synp_e62a1c9074bf",
  "synp_5a6d91c20ef4",
  "synp_c8e2475b109d",
] as const;
const WRITE_STATUSES = ["200", "400", "403", "404", "409", "412", "428", "500"];
const WRITE_ROUTES = [
  {
    path: "/v1/theses/{thesisId}",
    pathParameter: "#/components/parameters/ThesisId",
    requestSchema: "#/components/schemas/ThesisWriteRequest",
    responseSchema: "#/components/schemas/ThesisWriteResponse",
  },
  {
    path: "/v1/alerts/{alertId}",
    pathParameter: "#/components/parameters/AlertId",
    requestSchema: "#/components/schemas/AlertWriteRequest",
    responseSchema: "#/components/schemas/AlertWriteResponse",
  },
] as const;
const REQUIRED_HEADER_REFS = [
  "#/components/parameters/XDemoPersona",
  "#/components/parameters/IfMatch",
  "#/components/parameters/IdempotencyKey",
];
const FORBIDDEN_AUTHORITY_HEADERS = [
  "X-Organization-Id",
  "X-Principal-Id",
  "X-Membership-Role",
  "X-Tenant-Id",
  "X-Role",
] as const;
const FORBIDDEN_REQUEST_FIELDS = [
  "organizationId",
  "principalId",
  "role",
  "id",
  "version",
  "expectedVersion",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "idempotencyKey",
  "audit",
];
const SAFE_TEXT_PATTERN =
  "pattern: '^(?=[\\s\\S]*\\S)[^\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]*$'";
const UUID_PATTERN_SOURCE =
  'pattern: "^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[1-8][0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$"';

describe("Cycle 1c OpenAPI contract", () => {
  it("exposes only the two exact update-only research-state routes", async () => {
    const source = await openApiSource();
    expect(source).toContain("openapi: 3.1.0");
    expect(source).toContain("  version: 0.2.0");
    expect(source).toContain("  - url: http://127.0.0.1:3100");
    expect(source).not.toContain("0.0.0.0");
    expect(topLevelPaths(source)).toEqual([
      "/health/live",
      "/health/ready",
      "/v1/instruments/{symbol}/dossier",
      "/v1/evidence/{evidenceId}",
      "/v1/theses/{thesisId}",
      "/v1/alerts/{alertId}",
    ]);

    for (const route of WRITE_ROUTES) {
      const routeSource = pathSection(source, route.path);
      const normalizedRouteSource = routeSource.replace(/\s+/g, " ");
      expect(
        routeSource.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim()),
      ).toEqual(["put:"]);
      expect(routeSource).not.toContain("in: query");
      expect(statuses(routeSource)).toEqual(WRITE_STATUSES);
      expect(parameterRefs(routeSource)).toEqual([
        route.pathParameter,
        ...REQUIRED_HEADER_REFS,
      ]);
      expect(routeSource).toContain(`$ref: "${route.requestSchema}"`);
      expect(routeSource).toContain(`$ref: "${route.responseSchema}"`);
      expect(routeSource).toContain('$ref: "#/components/headers/VersionETag"');
      expect(routeSource).toContain(
        '$ref: "#/components/headers/ServerTraceId"',
      );
      expect(routeSource).toContain('$ref: "#/components/headers/NoStore"');
      expect(routeSource).toContain("Content-Type header is required");
      expect(routeSource).toContain("optional charset=utf-8 parameter");
      expect(routeSource).toContain("request body is capped at 384 KiB");
      expect(normalizedRouteSource).toContain(
        "after context resolution, an oversized body returns the same value-free 400 shape",
      );
      expect(normalizedRouteSource).toContain(
        "Authorization is re-evaluated before an idempotent replay",
      );
      expect(normalizedRouteSource).toContain(
        "A missing, duplicated, malformed, or unresolved persona, a non-loopback peer, or a caller authority header returns 403 before body parsing",
      );
      expect(normalizedRouteSource).toContain(
        "A resolved context reaches input validation; viewer, inactive, and no-membership denial occurs in the service only after syntactically valid input and before existence, version, or idempotency evaluation",
      );
      for (const header of FORBIDDEN_AUTHORITY_HEADERS) {
        expect(routeSource).toContain(header);
      }
    }
  });

  it("publishes the exact non-secret persona selectors and strict write headers", async () => {
    const source = await openApiSource();
    for (const [schema, nextSchema] of [
      ["ThesisId", "AlertId"],
      ["AlertId", "XDemoPersona"],
    ] as const) {
      const pathIdSource = componentSection(source, schema, nextSchema);
      expect(pathIdSource).toContain("format: uuid");
      expect(pathIdSource).toContain(UUID_PATTERN_SOURCE);
    }
    const personaSource = componentSection(source, "XDemoPersona", "IfMatch");
    expect(personaSource).toContain("name: X-Demo-Persona");
    expect(personaSource).toContain("required: true");
    expect(personaSource).toContain(
      "public, non-secret synthetic persona selector",
    );
    expect(listValues(personaSource, /^ {10}- (synp_[a-z0-9]+)$/gm)).toEqual(
      PERSONA_SELECTORS,
    );

    const ifMatchSource = componentSection(source, "IfMatch", "IdempotencyKey");
    expect(ifMatchSource).toContain("name: If-Match");
    expect(ifMatchSource).toContain("required: true");
    expect(ifMatchSource).toContain("positive JavaScript-safe integer");
    expect(ifMatchSource).toContain("pattern: '^\"[1-9][0-9]*\"$'");
    expect(ifMatchSource).toContain("maxLength: 18");

    const keySource = boundedSection(
      source,
      "    IdempotencyKey:",
      "  headers:",
    );
    expect(keySource).toContain("name: Idempotency-Key");
    expect(keySource).toContain("required: true");
    expect(keySource).toContain("minLength: 8");
    expect(keySource).toContain("maxLength: 128");
    expect(keySource).toContain('pattern: "^[A-Za-z0-9._:-]+$"');
    expect(keySource).toContain("scoped by resolved organization,");
    expect(keySource).toContain("resolved principal, and operation");
    expect(keySource).toContain("another path or resource is a separate scope");
    expect(keySource.replace(/\s+/g, " ")).toContain(
      "one identical key may be used independently on a thesis path and an alert path; both valid operations can succeed and retain separate records",
    );

    const etagSource = boundedSection(
      source,
      "    VersionETag:",
      "  responses:",
    );
    expect(etagSource).toContain("Strong quoted positive safe-integer");
    expect(etagSource).toContain("pattern: '^\"[1-9][0-9]*\"$'");
    expect(etagSource).toContain("maxLength: 18");
    expect(etagSource).toContain("A caller X-Trace-Id is ignored");
    expect(etagSource).toContain("never becomes request or audit identity");
    expect(etagSource).toContain("const: no-store");
  });

  it("keeps request bodies exact and excludes caller-supplied authority", async () => {
    const source = await openApiSource();
    const thesis = schemaSection(
      source,
      "ThesisWriteRequest",
      "AlertWriteRequest",
    );
    const alert = schemaSection(
      source,
      "AlertWriteRequest",
      "ThesisWriteResponse",
    );

    expect(schemaKeys(thesis)).toEqual([
      "instrumentId",
      "claim",
      "evidence",
      "risks",
      "invalidation",
    ]);
    expect(requiredKeys(thesis)).toEqual(schemaKeys(thesis));
    expect(schemaKeys(alert)).toEqual([
      "instrumentId",
      "metricKey",
      "operator",
      "threshold",
    ]);
    expect(requiredKeys(alert)).toEqual(schemaKeys(alert));
    expect(thesis).toContain("additionalProperties: false");
    expect(alert).toContain("additionalProperties: false");
    for (const [schema, nextSchema] of [
      ["ThesisClaim", "ThesisEvidence"],
      ["ThesisEvidence", "ThesisRisks"],
      ["ThesisRisks", "ThesisInvalidation"],
      ["ThesisInvalidation", "ResourceVersion"],
    ] as const) {
      expect(schemaSection(source, schema, nextSchema)).toContain(
        SAFE_TEXT_PATTERN,
      );
      expect(schemaSection(source, schema, nextSchema)).toContain(
        "length limit counts Unicode code points",
      );
    }
    for (const field of FORBIDDEN_REQUEST_FIELDS) {
      expect(thesis).not.toMatch(new RegExp(`(?:^|\\n)\\s*(?:- )?${field}:?`));
      expect(alert).not.toMatch(new RegExp(`(?:^|\\n)\\s*(?:- )?${field}:?`));
    }
  });

  it("freezes value-free problem statuses and identity-free response shapes", async () => {
    const source = await openApiSource();
    const thesis = schemaSection(
      source,
      "ThesisWriteResponse",
      "AlertWriteResponse",
    );
    const alert = schemaSection(source, "AlertWriteResponse", "InstrumentId");
    const common = ["schemaVersion", "synthetic", "id", "instrumentId"];
    const tail = ["version", "createdAt", "updatedAt"];
    expect(schemaKeys(thesis)).toEqual([
      ...common,
      "claim",
      "evidence",
      "risks",
      "invalidation",
      ...tail,
    ]);
    expect(schemaKeys(alert)).toEqual([
      ...common,
      "metricKey",
      "operator",
      "threshold",
      ...tail,
    ]);
    expect(requiredKeys(thesis)).toEqual(schemaKeys(thesis));
    expect(requiredKeys(alert)).toEqual(schemaKeys(alert));
    for (const field of [
      "organizationId",
      "principalId",
      "createdBy",
      "updatedBy",
      "audit",
      "idempotencyKey",
    ]) {
      expect(thesis).not.toContain(field);
      expect(alert).not.toContain(field);
    }
    expect(source).toContain("The response is deliberately value-free.");
    expect(source).toContain("An unexpected value-free internal failure.");
    expect(source).toContain(
      "already used with a different body or If-Match value",
    );
    expect(source).toContain(
      "different path or resource are in a separate operation scope",
    );
    expect(source).toContain("does not disclose the current version");
    expect(source).toContain("does not disclose another scope");
    expect(source).toContain("no rejected value, resolved identity or");
    expect(source).toContain(
      "replay also conflicts after the recorded resource version is",
    );
    const problem = terminalSchemaSection(source, "ProblemDetails");
    expect(requiredKeys(problem)).toEqual([
      "type",
      "title",
      "status",
      "detail",
      "instance",
      "traceId",
    ]);
    expect(schemaKeys(problem)).toEqual(requiredKeys(problem));
  });

  it("keeps the TypeScript DTO keys aligned with the OpenAPI schemas", () => {
    const thesisRequest = {
      instrumentId: "instrument.synthetic.syn1",
      claim: "Synthetic claim",
      evidence: "Synthetic evidence",
      risks: "Synthetic risks",
      invalidation: "Synthetic invalidation",
    } satisfies ThesisWriteRequestDto;
    const alertRequest = {
      instrumentId: "instrument.synthetic.syn1",
      metricKey: "ebitda_margin",
      operator: "below",
      threshold: "15.0",
    } satisfies AlertWriteRequestDto;
    const thesisResponse = {
      schemaVersion: "1.0.0",
      synthetic: true,
      id: "66666666-6666-4666-8666-666666666666",
      ...thesisRequest,
      version: 2,
      createdAt: "2026-08-15T21:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
    } satisfies ThesisWriteResponseDto;
    const alertResponse = {
      schemaVersion: "1.0.0",
      synthetic: true,
      id: "77777777-7777-4777-8777-777777777777",
      ...alertRequest,
      version: 2,
      createdAt: "2026-08-15T21:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
    } satisfies AlertWriteResponseDto;

    expect(Object.keys(thesisRequest)).toEqual([
      "instrumentId",
      "claim",
      "evidence",
      "risks",
      "invalidation",
    ]);
    expect(Object.keys(alertRequest)).toEqual([
      "instrumentId",
      "metricKey",
      "operator",
      "threshold",
    ]);
    expect(Object.keys(thesisResponse)).not.toContain("organizationId");
    expect(Object.keys(alertResponse)).not.toContain("principalId");
  });
});

async function openApiSource(): Promise<string> {
  return readFile(OPENAPI_URL, "utf8");
}

function topLevelPaths(source: string): string[] {
  return listValues(source, /^ {2}(\/[^:]+):$/gm);
}

function pathSection(source: string, path: string): string {
  const start = `  ${path}:`;
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`Missing OpenAPI path ${path}`);
  const nextPath = source.indexOf("\n  /", startIndex + start.length);
  const components = source.indexOf("\ncomponents:", startIndex + start.length);
  const candidates = [nextPath, components].filter((index) => index >= 0);
  const endIndex = Math.min(...candidates);
  return source.slice(startIndex, endIndex);
}

function componentSection(source: string, start: string, end: string): string {
  return boundedSection(source, `    ${start}:`, `    ${end}:`);
}

function schemaSection(source: string, start: string, end: string): string {
  return boundedSection(source, `    ${start}:`, `    ${end}:`);
}

function terminalSchemaSection(source: string, start: string): string {
  const marker = `    ${start}:`;
  const startIndex = source.indexOf(marker);
  if (startIndex < 0)
    throw new Error(`Missing terminal OpenAPI schema ${start}`);
  return source.slice(startIndex);
}

function boundedSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0)
    throw new Error(`Missing bounded OpenAPI section ${start} -> ${end}`);
  return source.slice(startIndex, endIndex);
}

function statuses(routeSource: string): string[] {
  return listValues(routeSource, /^ {8}"([0-9]{3})":$/gm);
}

function parameterRefs(routeSource: string): string[] {
  return listValues(routeSource, /^ {8}- \$ref: "([^"]+)"$/gm);
}

function requiredKeys(schemaSource: string): string[] {
  const requiredStart = schemaSource.indexOf("      required:\n");
  const propertiesStart = schemaSource.indexOf("      properties:\n");
  if (requiredStart < 0 || propertiesStart < 0)
    throw new Error("Schema must have required and properties blocks");
  return listValues(
    schemaSource.slice(requiredStart, propertiesStart),
    /^ {8}- ([A-Za-z][A-Za-z0-9]*)$/gm,
  );
}

function schemaKeys(schemaSource: string): string[] {
  const propertiesStart = schemaSource.indexOf("      properties:\n");
  if (propertiesStart < 0) throw new Error("Schema must have properties");
  return listValues(
    schemaSource.slice(propertiesStart),
    /^ {8}([A-Za-z][A-Za-z0-9]*):$/gm,
  );
}

function listValues(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => {
    const value = match[1];
    if (!value) throw new Error(`Pattern ${pattern} returned an empty value`);
    return value;
  });
}
