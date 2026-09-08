import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type {
  AlertWriteRequestDto,
  AlertWriteResponseDto,
  ConnectedSourceBudgetQuantityDto,
  ConnectedSourceBudgetStatusDto,
  ConnectedSourcePolicyStatusDto,
  PersonalAnnualFinancialsDto,
  PersonalFilingDossierDto,
  PersonalFilingDossierEvidenceDto,
  PersonalFilingDossierFactDto,
  PersonalFilingReadinessDto,
  PersonalFilingSelectedFactDto,
  PersonalFilingSelectedFactsDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
  PersonalSecurityMasterSearchResponseDto,
  PersonalSecurityMasterSnapshotReceiptDto,
  PersonalSecurityMasterStatusDto,
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
const PERSONAL_FILING_FACT_KEYS = [
  "assets",
  "cash",
  "debt",
  "diluted_shares",
  "free_cash_flow",
  "gross_profit",
  "net_income",
  "operating_cash_flow",
  "operating_income",
  "revenue",
] as const;
const PERSONAL_ANNUAL_FINANCIAL_REPORTED_KEYS = [
  "accounts_receivable",
  "assets",
  "capital_expenditures",
  "cash",
  "cost_of_revenue",
  "current_assets",
  "current_liabilities",
  "debt",
  "depreciation_and_amortization",
  "ebitda",
  "financing_cash_flow",
  "free_cash_flow",
  "gross_profit",
  "income_tax_expense",
  "intangibles",
  "inventory",
  "investing_cash_flow",
  "liabilities",
  "net_income",
  "operating_cash_flow",
  "operating_expenses",
  "operating_income",
  "pretax_income",
  "property_plant_equipment_net",
  "research_and_development",
  "revenue",
  "selling_general_and_administrative",
  "share_based_compensation",
  "shareholders_equity",
  "interest_expense",
] as const;
const CONNECTED_SOURCE_POLICY_STATUSES = [
  "disabled",
  "ready",
  "killed",
  "expired",
  "revoked",
  "incompatible",
  "budget_exhausted",
] as const;
const CONNECTED_SOURCE_POLICY_REASON_CODES = [
  "NOT_EXPLICITLY_ENABLED",
  "OWNER_KILL_SWITCH",
  "POLICY_NOT_ADMITTED",
  "POLICY_NOT_EFFECTIVE",
  "POLICY_REVIEW_DUE",
  "POLICY_EXPIRED",
  "POLICY_REVOKED",
  "POLICY_INCOMPATIBLE",
  "CLOCK_UNAVAILABLE",
  "CLOCK_INVALID",
  "BUDGET_EXHAUSTED",
  "null",
] as const;

describe("local API OpenAPI contract", () => {
  it("exposes only the exact local API routes", async () => {
    const source = await openApiSource();
    expect(source).toContain("openapi: 3.1.0");
    expect(source).toContain("  version: 0.8.0");
    expect(source).toContain("  - url: http://127.0.0.1:3100");
    expect(source).not.toContain("0.0.0.0");
    expect(topLevelPaths(source)).toEqual([
      "/health/live",
      "/health/ready",
      "/v1/instruments/{symbol}/dossier",
      "/v1/evidence/{evidenceId}",
      "/v1/personal-filing/session",
      "/v1/personal-filing/session/bootstrap",
      "/v1/personal-filing/session/rotate",
      "/v1/personal-filing/session/logout",
      "/v1/personal-filing/session/revoke",
      "/v1/personal-filing/readiness",
      "/v1/personal-filing/selected-facts",
      "/v1/personal-filing/dossier",
      "/v1/personal-filing/security-master/status",
      "/v1/personal-filing/security-master/search",
      "/v1/personal-filing/market-data/status",
      "/v1/personal-filing/market-data/overview",
      "/v1/personal-filing/market-data/annual-financials",
      "/v1/personal-filing/connected-source-policy/status",
      "/v1/personal-filing/connected-source-policy/kill",
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

  it("freezes the body-free possession-bound local owner-session contract", async () => {
    const source = await openApiSource();
    const paths = [
      ["/v1/personal-filing/session", "get"],
      ["/v1/personal-filing/session/bootstrap", "post"],
      ["/v1/personal-filing/session/rotate", "post"],
      ["/v1/personal-filing/session/logout", "post"],
      ["/v1/personal-filing/session/revoke", "post"],
    ] as const;

    for (const [path, method] of paths) {
      const route = pathSection(source, path);
      expect(route.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim())).toEqual(
        [`${method}:`],
      );
      expect(statuses(route)).toEqual(["204", "403"]);
      expect(route).not.toContain("requestBody:");
      expect(route).not.toContain("in: query");
      expect(route).toContain("#/components/headers/PrivateNoStore");
      expect(route).toContain("#/components/headers/PragmaNoCache");
      expect(route).toContain(
        "#/components/responses/PersonalSessionForbidden",
      );
    }

    const bootstrap = pathSection(
      source,
      "/v1/personal-filing/session/bootstrap",
    );
    expect(parameterRefs(bootstrap)).toEqual([
      "#/components/parameters/XResearchCockpitBootstrap",
    ]);
    expect(bootstrap).toContain("const: bootstrap");
    expect(bootstrap).not.toContain("PersonalOwnerSession: []");
    expect(bootstrap).toContain(
      "#/components/headers/PersonalOwnerSessionCookie",
    );

    for (const [path, intent] of [
      ["/v1/personal-filing/session/rotate", "rotate"],
      ["/v1/personal-filing/session/logout", "logout"],
      ["/v1/personal-filing/session/revoke", "revoke"],
    ] as const) {
      const route = pathSection(source, path);
      expect(route).toContain("PersonalOwnerSession: []");
      expect(route).toContain(`const: ${intent}`);
    }

    const security = boundedSection(
      source,
      "    PersonalOwnerSession:",
      "  parameters:",
    );
    expect(security).toContain("type: apiKey");
    expect(security).toContain("in: cookie");
    expect(security).toContain("name: research_cockpit_owner_session");
    expect(security).toContain("Path=/v1/personal-filing");

    const bootstrapParameter = componentSection(
      source,
      "XResearchCockpitBootstrap",
      "ThesisId",
    );
    expect(bootstrapParameter).toContain("name: X-Research-Cockpit-Bootstrap");
    expect(bootstrapParameter).toContain("minLength: 64");
    expect(bootstrapParameter).toContain("maxLength: 64");
    expect(bootstrapParameter).toContain('pattern: "^[0-9a-f]{64}$"');

    const sessionHeaders = boundedSection(
      source,
      "    PersonalOwnerSessionCookie:",
      "  responses:",
    );
    expect(sessionHeaders).toContain("HttpOnly");
    expect(sessionHeaders).toContain("SameSite=Strict");
    expect(sessionHeaders).toContain("Domain, Expires, and Max-Age are absent");
    expect(sessionHeaders).toContain("Max-Age=0");
  });

  it("freezes the coarse local-only personal-filing readiness route", async () => {
    const source = await openApiSource();
    const route = pathSection(source, "/v1/personal-filing/readiness");
    const normalizedRoute = route.replace(/\s+/g, " ");

    expect(route.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim())).toEqual([
      "get:",
    ]);
    expect(statuses(route)).toEqual(["200", "403", "404"]);
    expect(parameterRefs(route)).toEqual([]);
    expect(route).not.toContain("parameters:");
    expect(route).not.toContain("requestBody:");
    expect(route).not.toContain("in: query");
    expect(route).toContain(
      '$ref: "#/components/schemas/PersonalFilingReadiness"',
    );
    expect(route.match(/#\/components\/headers\/PrivateNoStore/g)).toHaveLength(
      3,
    );
    expect(route.match(/#\/components\/headers\/PragmaNoCache/g)).toHaveLength(
      3,
    );
    expect(route.match(/#\/components\/schemas\/ProblemDetails/g)).toHaveLength(
      2,
    );
    expect(normalizedRoute).toContain(
      "Local-only, value-free readiness boundary",
    );
    expect(normalizedRoute).toContain("data plane remains disabled");
    expect(normalizedRoute).toContain(
      "exact configured loopback Host authority",
    );
    expect(route).toContain("PersonalOwnerSession: []");
    expect(normalizedRoute).toContain("HEAD is not exposed");
    expect(normalizedRoute).toContain(
      "no private facts, labels, values, metrics,",
    );
    expect(normalizedRoute).toContain(
      "hashes, identifiers, timestamps, source or owner-local paths",
    );

    const schema = schemaSection(
      source,
      "PersonalFilingReadiness",
      "PersonalFilingSelectedFacts",
    );
    expect(schema).toContain("additionalProperties: false");
    expect(requiredKeys(schema)).toEqual([
      "schemaVersion",
      "profile",
      "status",
      "dataPlane",
    ]);
    expect(schemaKeys(schema)).toEqual(requiredKeys(schema));
    expect(schema).toContain('const: "1.0.0"');
    expect(schema).toContain("const: personal_single_user_local");
    expect(schema).toContain("const: quality_gate_ready");
    expect(schema).toContain("const: disabled");

    const headers = boundedSection(
      source,
      "    PrivateNoStore:",
      "  responses:",
    );
    expect(headers).toContain("const: private, no-store");
    expect(headers).toContain("const: no-cache");
  });

  it("freezes the closed personal selected-fact release contract", async () => {
    const source = await openApiSource();
    const route = pathSection(source, "/v1/personal-filing/selected-facts");
    const normalizedRoute = route.replace(/\s+/g, " ");

    expect(route.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim())).toEqual([
      "get:",
    ]);
    expect(statuses(route)).toEqual(["200", "403", "404"]);
    expect(parameterRefs(route)).toEqual([]);
    expect(route).not.toContain("parameters:");
    expect(route).not.toContain("requestBody:");
    expect(route).not.toContain("in: query");
    expect(route).toContain(
      '$ref: "#/components/schemas/PersonalFilingSelectedFacts"',
    );
    expect(route.match(/#\/components\/headers\/PrivateNoStore/g)).toHaveLength(
      3,
    );
    expect(route.match(/#\/components\/headers\/PragmaNoCache/g)).toHaveLength(
      3,
    );
    expect(route.match(/#\/components\/schemas\/ProblemDetails/g)).toHaveLength(
      2,
    );
    expect(normalizedRoute).toContain("caller-supplied selection");
    expect(normalizedRoute).toContain("HEAD is not exposed");
    expect(normalizedRoute).toContain("unique fact keys in canonical order");
    expect(route).toContain("PersonalOwnerSession: []");

    const outer = schemaSection(
      source,
      "PersonalFilingSelectedFacts",
      "PersonalFilingSelectedFact",
    );
    expect(outer).toContain("additionalProperties: false");
    expect(requiredKeys(outer)).toEqual([
      "schemaVersion",
      "profile",
      "status",
      "facts",
    ]);
    expect(schemaKeys(outer)).toEqual(requiredKeys(outer));
    expect(outer).toContain('const: "1.0.0"');
    expect(outer).toContain("const: personal_single_user_local");
    expect(outer).toContain("const: selected_facts_released");
    expect(outer).toContain("minItems: 1");
    expect(outer).toContain("maxItems: 10");
    expect(outer).toContain(
      '$ref: "#/components/schemas/PersonalFilingSelectedFact"',
    );

    const fact = schemaSection(
      source,
      "PersonalFilingSelectedFact",
      "PersonalFilingDossier",
    );
    expect(fact).toContain("additionalProperties: false");
    expect(requiredKeys(fact)).toEqual([
      "key",
      "value",
      "unit",
      "periodStart",
      "periodEnd",
    ]);
    expect(schemaKeys(fact)).toEqual(requiredKeys(fact));
    const key = boundedSection(fact, "        key:", "        value:");
    expect(listValues(key, /^ {12}- ([a-z_]+)$/gm)).toEqual(
      PERSONAL_FILING_FACT_KEYS,
    );
    const unit = boundedSection(fact, "        unit:", "        periodStart:");
    expect(listValues(unit, /^ {12}- ([A-Za-z]+)$/gm)).toEqual([
      "USD",
      "shares",
    ]);
    expect(fact).toContain("maxLength: 40");
    expect(fact).toContain(
      'pattern: "^-?(?:0|[1-9][0-9]{0,25})(?:\\\\.[0-9]{0,11}[1-9])?$"',
    );
    expect(fact.match(/format: date/g)).toHaveLength(2);
    expect(fact).toContain('            - "null"');
  });

  it("freezes the authenticated atomic personal-dossier contract", async () => {
    const source = await openApiSource();
    const route = pathSection(source, "/v1/personal-filing/dossier");
    const normalizedRoute = route.replace(/\s+/g, " ");

    expect(route.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim())).toEqual([
      "get:",
    ]);
    expect(statuses(route)).toEqual(["200", "403", "404"]);
    expect(parameterRefs(route)).toEqual([]);
    expect(route).not.toContain("parameters:");
    expect(route).not.toContain("requestBody:");
    expect(route).not.toContain("in: query");
    expect(route).toContain("PersonalOwnerSession: []");
    expect(route).toContain(
      '$ref: "#/components/schemas/PersonalFilingDossier"',
    );
    expect(route.match(/#\/components\/headers\/PrivateNoStore/g)).toHaveLength(
      3,
    );
    expect(route.match(/#\/components\/headers\/PragmaNoCache/g)).toHaveLength(
      3,
    );
    expect(normalizedRoute).toContain("One atomic response");
    expect(normalizedRoute).toContain("known-at lineage");
    expect(normalizedRoute).toContain("graph closure before release");
    expect(normalizedRoute).toContain("HEAD is not exposed");

    const outer = schemaSection(
      source,
      "PersonalFilingDossier",
      "PersonalFilingDossierFact",
    );
    expect(outer).toContain("additionalProperties: false");
    expect(requiredKeys(outer)).toEqual([
      "asOf",
      "chart",
      "dataMode",
      "evidence",
      "facts",
      "lineage",
      "omissions",
      "profile",
      "schemaVersion",
      "status",
      "valuationInputs",
    ]);
    expect(schemaKeys(outer)).toEqual(requiredKeys(outer));
    expect(outer).toContain("const: personal");
    expect(outer).toContain("const: personal_single_user_local");
    expect(outer).toContain("const: personal_dossier_released");

    const fact = schemaSection(
      source,
      "PersonalFilingDossierFact",
      "PersonalFilingDossierEvidence",
    );
    expect(requiredKeys(fact)).toEqual([
      "evidenceId",
      "id",
      "key",
      "knownFrom",
      "knownToExclusive",
      "label",
      "periodEnd",
      "periodStart",
      "unit",
      "value",
      "version",
    ]);
    expect(schemaKeys(fact)).toEqual(requiredKeys(fact));
    expect(fact).toContain("format: date-time");
    expect(fact).toContain('            - "null"');

    const evidence = schemaSection(
      source,
      "PersonalFilingDossierEvidence",
      "PersonalFilingDossierDerivationOperand",
    );
    expect(requiredKeys(evidence)).toContain("derivationFormula");
    expect(requiredKeys(evidence)).toContain("derivationOperands");
    expect(evidence).toContain("oneOf:");
    expect(evidence).toContain("Direct personal filing evidence");
    expect(evidence).toContain("Derived free-cash-flow evidence");
    expect(evidence).toContain("maxItems: 0");
    expect(evidence).toContain("prefixItems:");
    expect(evidence).toContain("const: minuend");
    expect(evidence).toContain("const: subtrahend");
    expect(evidence).toContain("items: false");
    expect(evidence).toContain("minItems: 2");
    expect(evidence).toContain("maxItems: 2");
    expect(evidence).toContain(
      "operating_cash_flow_minus_capital_expenditures",
    );
    expect(evidence.match(/format: date-time/g)).toHaveLength(2);

    const operand = schemaSection(
      source,
      "PersonalFilingDossierDerivationOperand",
      "PersonalFilingDossierLineage",
    );
    expect(requiredKeys(operand)).toEqual([
      "concept",
      "periodEnd",
      "periodStart",
      "role",
      "unit",
      "value",
    ]);
    expect(schemaKeys(operand)).toEqual(requiredKeys(operand));
    expect(operand).toContain("- minuend");
    expect(operand).toContain("- subtrahend");

    const chart = schemaSection(
      source,
      "PersonalFilingDossierChart",
      "PersonalFilingDossierChartReady",
    );
    expect(chart).toContain("PersonalFilingDossierChartReady");
    expect(chart).toContain("PersonalFilingDossierChartUnsupported");
    const unsupportedChart = schemaSection(
      source,
      "PersonalFilingDossierChartUnsupported",
      "PersonalFilingDossierChartSeries",
    );
    expect(unsupportedChart).toContain("NO_OWNER_APPROVED_CHART_FACTS");
  });

  it("freezes the offline owner-local security-master contract", async () => {
    const source = await openApiSource();
    const statusRoute = pathSection(
      source,
      "/v1/personal-filing/security-master/status",
    );
    const searchRoute = pathSection(
      source,
      "/v1/personal-filing/security-master/search",
    );
    const normalizedStatus = statusRoute.replace(/\s+/g, " ");
    const normalizedSearch = searchRoute.replace(/\s+/g, " ");

    expect(
      statusRoute.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim()),
    ).toEqual(["get:"]);
    expect(statuses(statusRoute)).toEqual(["200", "403"]);
    expect(statusRoute).not.toContain("parameters:");
    expect(statusRoute).not.toContain("requestBody:");
    expect(statusRoute).toContain("PersonalOwnerSession: []");
    expect(statusRoute).toContain(
      '$ref: "#/components/schemas/PersonalSecurityMasterStatus"',
    );
    expect(normalizedStatus).toContain("local snapshot path");
    expect(normalizedStatus).toContain("raw policy document");
    expect(normalizedStatus).toContain("performs no network fetch");
    expect(normalizedStatus).toContain("HEAD is not exposed");

    expect(
      searchRoute.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim()),
    ).toEqual(["get:"]);
    expect(statuses(searchRoute)).toEqual(["200", "400", "403"]);
    expect(searchRoute).not.toContain("requestBody:");
    expect(searchRoute).toContain("PersonalOwnerSession: []");
    expect(searchRoute).toContain("name: q");
    expect(searchRoute).toContain("name: limit");
    expect(searchRoute.indexOf("name: q")).toBeLessThan(
      searchRoute.indexOf("name: limit"),
    );
    expect(searchRoute).toContain("maxLength: 128");
    expect(searchRoute).toContain("maximum: 25");
    expect(searchRoute).toContain("default: 10");
    expect(normalizedSearch).toContain("unknown, missing, repeated, reordered");
    expect(normalizedSearch).toContain("canonical encodeURIComponent encoding");
    expect(normalizedSearch).toContain("surrogate, bidi, or NUL");
    expect(normalizedSearch).toContain("Content-Length");
    expect(normalizedSearch).toContain("Transfer-Encoding");
    expect(normalizedSearch).toContain("provider mappings");
    expect(normalizedSearch).toContain("HEAD is not exposed");
    expect(
      searchRoute.match(/#\/components\/headers\/PrivateNoStore/g),
    ).toHaveLength(3);
    expect(
      searchRoute.match(/#\/components\/headers\/PragmaNoCache/g),
    ).toHaveLength(3);

    const status = schemaSection(
      source,
      "PersonalSecurityMasterStatus",
      "PersonalSecurityMasterSearchResponse",
    );
    expect(requiredKeys(status)).toEqual(["snapshot"]);
    expect(schemaKeys(status)).toEqual(["snapshot"]);
    expect(status).toContain(
      '$ref: "#/components/schemas/PersonalSecurityMasterSnapshotReceipt"',
    );

    const search = schemaSection(
      source,
      "PersonalSecurityMasterSearchResponse",
      "PersonalSecurityMasterSearchResult",
    );
    expect(requiredKeys(search)).toEqual([
      "limitApplied",
      "normalizedQuery",
      "results",
      "snapshot",
      "totalMatches",
    ]);
    expect(schemaKeys(search)).toEqual(requiredKeys(search));
    expect(search).toContain("maxItems: 25");
    expect(search).toContain("maximum: 25");
    expect(
      boundedSection(search, "        normalizedQuery:", "        results:"),
    ).toContain("maxLength: 512");

    const result = schemaSection(
      source,
      "PersonalSecurityMasterSearchResult",
      "PersonalSecurityMasterSnapshotReceipt",
    );
    expect(requiredKeys(result)).toEqual([
      "cik",
      "country",
      "exchangeMic",
      "instrumentType",
      "issuerId",
      "issuerName",
      "listingId",
      "matchKind",
      "matchedValue",
      "securityId",
      "securityName",
      "shareClassId",
      "shareClassName",
      "symbol",
    ]);
    expect(schemaKeys(result)).toEqual(requiredKeys(result));
    expect(result).not.toContain("providerSecurityId");
    expect(result).not.toContain("providerMappings");
    expect(result).not.toContain("tickerHistory");
    expect(
      listValues(
        boundedSection(result, "        matchKind:", "        matchedValue:"),
        /^ {12}- ([a-z_]+)$/gm,
      ),
    ).toEqual([
      "current_symbol_exact",
      "current_symbol_prefix",
      "former_symbol_exact",
      "former_symbol_prefix",
      "name_exact",
      "name_token_prefix",
      "name_contains",
    ]);

    const receipt = schemaSection(
      source,
      "PersonalSecurityMasterSnapshotReceipt",
      "PersonalSecurityMasterCoverage",
    );
    expect(requiredKeys(receipt)).toEqual([
      "asOf",
      "catalogId",
      "catalogVersion",
      "claim",
      "coverage",
      "generatedAt",
      "profile",
      "provenance",
      "schemaVersion",
      "snapshotSha256",
      "sourcePolicyCompatibility",
      "status",
    ]);
    expect(schemaKeys(receipt)).toEqual(requiredKeys(receipt));
    expect(receipt).not.toContain("sourceLocator:");
    expect(receipt).not.toContain("records:");
    expect(receipt).toContain(
      "bounded_exact_owner_local_security_master_snapshot_admitted",
    );
    expect(receipt).toContain("personal_single_user_local_security_master");
    expect(receipt).toContain("admitted_for_personal_local_search");

    const coverage = schemaSection(
      source,
      "PersonalSecurityMasterCoverage",
      "PersonalSecurityMasterProvenanceReceipt",
    );
    expect(requiredKeys(coverage)).toEqual([
      "activeEligibleSecurities",
      "activeListings",
      "admittedSourceRecords",
      "basis",
      "eligibleSecurityBand",
      "formerTickerEntries",
      "ineligibleSourceRecords",
      "inactiveSecurities",
      "issuers",
      "providerMappings",
      "quarantinedSourceRecords",
      "sourceRecords",
      "staleSourceRecords",
      "shareClasses",
      "totalSecurities",
      "unsupportedSourceRecords",
    ]);
    expect(schemaKeys(coverage)).toEqual(requiredKeys(coverage));

    const provenance = schemaSection(
      source,
      "PersonalSecurityMasterProvenanceReceipt",
      "PersonalSecurityMasterProvenanceArtifact",
    );
    expect(requiredKeys(provenance)).toEqual([
      "acquiredAt",
      "artifacts",
      "attribution",
      "contentKind",
      "sourceId",
      "sourceRevision",
    ]);
    expect(schemaKeys(provenance)).toEqual(requiredKeys(provenance));
    expect(provenance).not.toContain("sourceLocator");
    expect(provenance).toContain("maxItems: 16");

    const artifact = schemaSection(
      source,
      "PersonalSecurityMasterProvenanceArtifact",
      "PersonalSecurityMasterSourcePolicyCompatibility",
    );
    expect(requiredKeys(artifact)).toEqual([
      "acquiredAt",
      "artifactId",
      "contentSha256",
      "mediaType",
      "sourceUri",
      "sourceVersion",
    ]);
    expect(schemaKeys(artifact)).toEqual(requiredKeys(artifact));
    expect(
      listValues(
        boundedSection(artifact, "        mediaType:", "        sourceUri:"),
        /^ {12}- ([a-z/]+)$/gm,
      ),
    ).toEqual([
      "application/json",
      "application/zip",
      "text/csv",
      "text/html",
      "text/plain",
    ]);
    expect(artifact).toContain('pattern: "^https://"');

    const policy = schemaSection(
      source,
      "PersonalSecurityMasterSourcePolicyCompatibility",
      "ConnectedSourcePolicyStatus",
    );
    expect(requiredKeys(policy)).toEqual([
      "attribution",
      "cache",
      "decision",
      "deleteOnRequest",
      "display",
      "effectiveAt",
      "expiresAt",
      "export",
      "intendedUse",
      "localOnly",
      "operation",
      "policyDocumentSha256",
      "policyId",
      "policyProfile",
      "policySchemaVersion",
      "policyVersion",
      "redistribution",
      "retention",
      "reviewedAt",
      "revocationCheck",
      "revokedAt",
      "rightsBasis",
      "search",
      "sourceId",
    ]);
    expect(schemaKeys(policy)).toEqual(requiredKeys(policy));
    const normalizedPolicy = policy.replace(/\s+/g, " ");
    expect(normalizedPolicy).toContain("not the raw policy document");
    expect(normalizedPolicy).toContain(
      "does not activate a connected provider",
    );
  });

  it("freezes the authenticated memory-only personal market-data contract", async () => {
    const source = await openApiSource();
    const statusRoute = pathSection(
      source,
      "/v1/personal-filing/market-data/status",
    );
    const overviewRoute = pathSection(
      source,
      "/v1/personal-filing/market-data/overview",
    );
    const normalizedOverview = overviewRoute.replace(/\s+/g, " ");

    expect(
      statusRoute.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim()),
    ).toEqual(["get:"]);
    expect(statuses(statusRoute)).toEqual(["200", "403"]);
    expect(statusRoute).not.toContain("requestBody:");
    expect(statusRoute).toContain("PersonalOwnerSession: []");
    expect(statusRoute).toContain(
      '$ref: "#/components/schemas/PersonalMarketDataStatus"',
    );
    expect(statusRoute.replace(/\s+/g, " ")).toContain(
      "never exposes or fingerprints the token",
    );

    expect(
      overviewRoute.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim()),
    ).toEqual(["post:"]);
    expect(statuses(overviewRoute)).toEqual([
      "200",
      "400",
      "403",
      "404",
      "424",
      "429",
      "502",
      "503",
    ]);
    expect(overviewRoute).not.toContain("in: query");
    expect(overviewRoute).toContain("PersonalOwnerSession: []");
    expect(overviewRoute).toContain(
      '$ref: "#/components/schemas/PersonalMarketOverviewRequest"',
    );
    expect(overviewRoute).toContain(
      '$ref: "#/components/schemas/PersonalMarketOverview"',
    );
    expect(normalizedOverview).toContain("fixed-host Tiingo IEX and EOD");
    expect(normalizedOverview).toContain(
      "only in active process/browser memory",
    );
    expect(
      overviewRoute.match(/#\/components\/headers\/PrivateNoStore/g),
    ).toHaveLength(8);
    expect(
      overviewRoute.match(/#\/components\/headers\/PragmaNoCache/g),
    ).toHaveLength(8);

    const status = schemaSection(
      source,
      "PersonalMarketDataStatus",
      "PersonalMarketDataProvider",
    );
    expect(requiredKeys(status)).toEqual([
      "profile",
      "provider",
      "schemaVersion",
      "status",
    ]);
    expect(schemaKeys(status)).toEqual(requiredKeys(status));
    expect(status).toContain("personal_single_user_local_market_data");
    expect(status).toContain("not_configured");

    const provider = schemaSection(
      source,
      "PersonalMarketDataProvider",
      "PersonalMarketOverviewRequest",
    );
    expect(requiredKeys(provider)).toEqual([
      "attribution",
      "export",
      "historyFeed",
      "id",
      "name",
      "persistence",
      "quoteFeed",
      "redistribution",
      "retention",
    ]);
    expect(schemaKeys(provider)).toEqual(requiredKeys(provider));
    expect(provider).toContain("active_owner_session_memory_only");
    expect(provider).toContain("tiingo_iex_derived_reference");
    expect(provider).not.toContain("token:");

    const request = schemaSection(
      source,
      "PersonalMarketOverviewRequest",
      "PersonalMarketOverview",
    );
    expect(requiredKeys(request)).toEqual(["listingId", "symbol", "range"]);
    expect(schemaKeys(request)).toEqual(requiredKeys(request));
    expect(listValues(request, /^ {12}- ([a-z0-9]+)$/gm)).toContain("10y");

    const overview = schemaSection(
      source,
      "PersonalMarketOverview",
      "PersonalMarketDataIdentity",
    );
    expect(requiredKeys(overview)).toEqual([
      "history",
      "profile",
      "provider",
      "quote",
      "schemaVersion",
      "security",
      "status",
    ]);
    expect(schemaKeys(overview)).toEqual(requiredKeys(overview));

    const history = schemaSection(
      source,
      "PersonalMarketDataHistory",
      "PersonalMarketDataDailyBar",
    );
    expect(requiredKeys(history)).toEqual([
      "bars",
      "endDate",
      "range",
      "startDate",
    ]);
    expect(schemaKeys(history)).toEqual(requiredKeys(history));
    expect(history).toContain("maxItems: 4096");

    const bar = schemaSection(
      source,
      "PersonalMarketDataDailyBar",
      "PersonalMarketDataAdjustedOhlcv",
    );
    expect(requiredKeys(bar)).toEqual([
      "adjusted",
      "date",
      "dividendCash",
      "raw",
      "splitFactor",
    ]);
    expect(schemaKeys(bar)).toEqual(requiredKeys(bar));

    const adjusted = schemaSection(
      source,
      "PersonalMarketDataAdjustedOhlcv",
      "PersonalMarketDataRawOhlcv",
    );
    const raw = schemaSection(
      source,
      "PersonalMarketDataRawOhlcv",
      "PersonalAnnualFinancialsRequest",
    );
    expect(requiredKeys(adjusted)).toEqual([
      "close",
      "high",
      "low",
      "open",
      "volume",
    ]);
    expect(schemaKeys(adjusted)).toEqual(requiredKeys(adjusted));
    expect(adjusted).toContain(
      'pattern: "^(?:0|[1-9][0-9]*)(?:\\\\.[0-9]+)?$"',
    );
    expect(requiredKeys(raw)).toEqual(requiredKeys(adjusted));
    expect(schemaKeys(raw)).toEqual(requiredKeys(raw));
    expect(raw).toContain('pattern: "^(?:0|[1-9][0-9]*)$"');
  });

  it("freezes the exact personal annual-financials contract", async () => {
    const source = await openApiSource();
    const route = pathSection(
      source,
      "/v1/personal-filing/market-data/annual-financials",
    );
    const normalizedRoute = route.replace(/\s+/g, " ");

    expect(route.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim())).toEqual([
      "post:",
    ]);
    expect(statuses(route)).toEqual([
      "200",
      "400",
      "402",
      "403",
      "404",
      "424",
      "429",
      "502",
      "503",
    ]);
    expect(route).not.toContain("in: query");
    expect(route).toContain("PersonalOwnerSession: []");
    expect(route).toContain(
      '$ref: "#/components/schemas/PersonalAnnualFinancialsRequest"',
    );
    expect(route).toContain(
      '$ref: "#/components/schemas/PersonalAnnualFinancials"',
    );
    expect(normalizedRoute).toContain("one to ten annual periods");
    expect(normalizedRoute).toContain("descending fiscal-year order");
    expect(normalizedRoute).toContain("unknown rather than synthesized");
    expect(normalizedRoute).toContain("only in active process/browser memory");
    expect(normalizedRoute).toContain("not entitled to the fundamentals feed");
    expect(route.match(/#\/components\/headers\/PrivateNoStore/g)).toHaveLength(
      9,
    );
    expect(route.match(/#\/components\/headers\/PragmaNoCache/g)).toHaveLength(
      9,
    );

    const request = schemaSection(
      source,
      "PersonalAnnualFinancialsRequest",
      "PersonalAnnualFinancials",
    );
    expect(requiredKeys(request)).toEqual(["listingId", "symbol"]);
    expect(schemaKeys(request)).toEqual(requiredKeys(request));
    expect(request).toContain("additionalProperties: false");

    const response = schemaSection(
      source,
      "PersonalAnnualFinancials",
      "PersonalAnnualFinancialsProvider",
    );
    expect(requiredKeys(response)).toEqual([
      "asOf",
      "coverage",
      "profile",
      "provider",
      "schemaVersion",
      "security",
      "status",
      "years",
    ]);
    expect(schemaKeys(response)).toEqual(requiredKeys(response));
    expect(response).toContain("additionalProperties: false");
    expect(response).toContain("personal_single_user_local_fundamentals");
    expect(response).toContain('const: "1.0.0"');
    expect(response).toContain("const: available");
    expect(response).toContain("minItems: 1");
    expect(response).toContain("maxItems: 10");
    expect(response.replace(/\s+/g, " ")).toContain(
      "ordered by fiscalYear descending",
    );

    const provider = schemaSection(
      source,
      "PersonalAnnualFinancialsProvider",
      "PersonalAnnualFinancialsCoverage",
    );
    expect(requiredKeys(provider)).toEqual([
      "attribution",
      "export",
      "id",
      "name",
      "persistence",
      "redistribution",
      "retention",
      "revisionBasis",
      "statementFeed",
      "valueCurrency",
    ]);
    expect(schemaKeys(provider)).toEqual(requiredKeys(provider));
    expect(provider).toContain("additionalProperties: false");
    expect(provider).toContain("const: Tiingo");
    expect(provider).toContain("const: active_owner_session_memory_only");
    expect(provider).toContain("const: provider_most_recent");
    expect(provider).toContain("const: tiingo_fundamentals_statements");
    expect(provider).toContain("const: USD");
    expect(provider).not.toContain("token:");

    const coverage = schemaSection(
      source,
      "PersonalAnnualFinancialsCoverage",
      "PersonalAnnualFinancialYear",
    );
    expect(requiredKeys(coverage)).toEqual([
      "earliestFiscalYear",
      "knownReportedCells",
      "latestFiscalYear",
      "missingFiscalYears",
      "requestedAnnualYears",
      "returnedAnnualYears",
      "status",
      "unknownReportedCells",
    ]);
    expect(schemaKeys(coverage)).toEqual(requiredKeys(coverage));
    expect(coverage).toContain("additionalProperties: false");
    expect(coverage).toContain("const: 10");
    expect(coverage).toContain("maxItems: 9");
    expect(coverage).toContain("uniqueItems: true");
    expect(listValues(coverage, /^ {12}- (complete|partial)$/gm)).toEqual([
      "complete",
      "partial",
    ]);

    const year = schemaSection(
      source,
      "PersonalAnnualFinancialYear",
      "PersonalAnnualFinancialReportedValues",
    );
    expect(requiredKeys(year)).toEqual(["fiscalYear", "periodEnd", "reported"]);
    expect(schemaKeys(year)).toEqual(requiredKeys(year));
    expect(year).toContain("additionalProperties: false");
    expect(year).toContain("format: date");
    expect(year).not.toContain("format: date-time");

    const reported = schemaSection(
      source,
      "PersonalAnnualFinancialReportedValues",
      "PersonalAnnualFinancialReportedCell",
    );
    const reportedRequired = listValues(
      boundedSection(reported, "      required:", "      properties:"),
      /^ {8}- ([a-z][a-z_]*)$/gm,
    );
    const reportedProperties = listValues(
      reported.slice(reported.indexOf("      properties:")),
      /^ {8}([a-z][a-z_]*):$/gm,
    );
    expect(reported).toContain("additionalProperties: false");
    expect(reportedRequired).toEqual(PERSONAL_ANNUAL_FINANCIAL_REPORTED_KEYS);
    expect(reportedProperties).toEqual(reportedRequired);
    expect(
      reported.match(
        /#\/components\/schemas\/PersonalAnnualFinancialReportedCell/g,
      ),
    ).toHaveLength(30);

    const cell = schemaSection(
      source,
      "PersonalAnnualFinancialReportedCell",
      "InstrumentId",
    );
    expect(cell.match(/^ {8}- type: object$/gm)).toHaveLength(2);
    expect(cell.match(/additionalProperties: false/g)).toHaveLength(2);
    expect(listValues(cell, /^ {12}- ([a-z]+)$/gm)).toEqual([
      "status",
      "value",
      "reason",
      "status",
      "value",
    ]);
    expect(listValues(cell, /^ {12}([a-z]+):$/gm)).toEqual([
      "status",
      "value",
      "reason",
      "status",
      "value",
    ]);
    expect(cell).toContain("const: known");
    expect(cell).toContain("const: unknown");
    expect(cell).toContain("const: not_supplied_by_provider");
    expect(cell).toContain(
      'pattern: "^(?:0|-?[1-9][0-9]*|-?(?:0|[1-9][0-9]*)\\\\.[0-9]*[1-9])$"',
    );
    expect(cell).toContain('type: "null"');
  });

  it("freezes the exact authenticated connected source-policy administration contract", async () => {
    const source = await openApiSource();
    const statusRoute = pathSection(
      source,
      "/v1/personal-filing/connected-source-policy/status",
    );
    const killRoute = pathSection(
      source,
      "/v1/personal-filing/connected-source-policy/kill",
    );

    expect(
      statusRoute.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim()),
    ).toEqual(["get:"]);
    expect(statuses(statusRoute)).toEqual(["200", "403"]);
    expect(parameterRefs(statusRoute)).toEqual([]);
    expect(statusRoute).not.toContain("parameters:");
    expect(statusRoute).not.toContain("requestBody:");
    expect(statusRoute).not.toContain("in: query");
    expect(statusRoute).toContain("PersonalOwnerSession: []");
    expect(statusRoute).toContain("HEAD is not exposed");
    expect(statusRoute).toContain(
      '$ref: "#/components/schemas/ConnectedSourcePolicyStatus"',
    );
    expect(
      statusRoute.match(/#\/components\/headers\/PrivateNoStore/g),
    ).toHaveLength(2);
    expect(
      statusRoute.match(/#\/components\/headers\/PragmaNoCache/g),
    ).toHaveLength(2);

    expect(
      killRoute.match(/^ {4}[a-z]+:/gm)?.map((line) => line.trim()),
    ).toEqual(["post:"]);
    expect(statuses(killRoute)).toEqual(["204", "403"]);
    expect(parameterRefs(killRoute)).toEqual([]);
    expect(killRoute.match(/^ {8}- name:/gm)).toHaveLength(1);
    expect(killRoute).not.toContain("requestBody:");
    expect(killRoute).not.toContain("in: path");
    expect(killRoute).not.toContain("in: query");
    expect(killRoute).toContain("PersonalOwnerSession: []");
    expect(killRoute).toContain("name: X-Research-Cockpit-Intent");
    expect(killRoute).toContain("in: header");
    expect(killRoute).toContain("required: true");
    expect(killRoute).toContain("const: connected-source-policy-kill");
    expect(
      killRoute.match(/#\/components\/headers\/PrivateNoStore/g),
    ).toHaveLength(2);
    expect(
      killRoute.match(/#\/components\/headers\/PragmaNoCache/g),
    ).toHaveLength(2);
    expect(
      boundedSection(killRoute, '        "204":', '        "403":'),
    ).not.toContain("content:");

    const statusSchema = schemaSection(
      source,
      "ConnectedSourcePolicyStatus",
      "ConnectedSourceBudgetStatus",
    );
    expect(statusSchema).toContain("additionalProperties: false");
    expect(requiredKeys(statusSchema)).toEqual([
      "schemaVersion",
      "profile",
      "status",
      "reasonCode",
      "sourceId",
      "policyId",
      "policyVersion",
      "budget",
    ]);
    expect(schemaKeys(statusSchema)).toEqual(requiredKeys(statusSchema));
    expect(statusSchema).toContain('const: "1.0.0"');
    expect(statusSchema).toContain(
      "const: personal_single_user_local_connected",
    );
    expect(
      listValues(
        boundedSection(statusSchema, "        status:", "        reasonCode:"),
        /^ {12}- ([a-z_]+)$/gm,
      ),
    ).toEqual(CONNECTED_SOURCE_POLICY_STATUSES);
    expect(
      listValues(
        boundedSection(
          statusSchema,
          "        reasonCode:",
          "        sourceId:",
        ),
        /^ {12}- ([A-Z_]+|null)$/gm,
      ),
    ).toEqual(CONNECTED_SOURCE_POLICY_REASON_CODES);
    for (const [field, nextField, maximumLength, pattern] of [
      ["sourceId", "policyId", 128, '"^[A-Za-z][A-Za-z0-9._:-]*$"'],
      ["policyId", "policyVersion", 128, '"^[A-Za-z0-9][A-Za-z0-9._:-]*$"'],
      ["policyVersion", "budget", 64, '"^[A-Za-z0-9][A-Za-z0-9._:-]*$"'],
    ] as const) {
      const fieldSchema = boundedSection(
        statusSchema,
        `        ${field}:`,
        `        ${nextField}:`,
      );
      expect(fieldSchema).toContain('- "null"');
      expect(fieldSchema).toContain("minLength: 1");
      expect(fieldSchema).toContain(`maxLength: ${maximumLength}`);
      expect(fieldSchema).toContain(`pattern: ${pattern}`);
    }
    const budgetProperty = statusSchema.slice(
      statusSchema.indexOf("        budget:"),
    );
    expect(budgetProperty).toContain("oneOf:");
    expect(budgetProperty).toContain(
      '$ref: "#/components/schemas/ConnectedSourceBudgetStatus"',
    );
    expect(budgetProperty).toContain('type: "null"');

    const budgetSchema = schemaSection(
      source,
      "ConnectedSourceBudgetStatus",
      "ConnectedSourceBudgetQuantity",
    );
    expect(budgetSchema).toContain("additionalProperties: false");
    expect(requiredKeys(budgetSchema)).toEqual([
      "currency",
      "estimatedSpendMicrounits",
      "requestBytes",
      "requests",
      "responseBytes",
      "storageBytes",
    ]);
    expect(schemaKeys(budgetSchema)).toEqual(requiredKeys(budgetSchema));
    expect(budgetSchema).toContain('pattern: "^[A-Z]{3}$"');
    expect(
      budgetSchema.match(
        /#\/components\/schemas\/ConnectedSourceBudgetQuantity/g,
      ),
    ).toHaveLength(2);
    expect(
      budgetSchema.match(
        /#\/components\/schemas\/ConnectedSourceByteBudgetQuantity/g,
      ),
    ).toHaveLength(2);
    expect(
      budgetSchema.match(
        /#\/components\/schemas\/ConnectedSourceRequestCountBudgetQuantity/g,
      ),
    ).toHaveLength(1);

    const quantitySchema = schemaSection(
      source,
      "ConnectedSourceBudgetQuantity",
      "ConnectedSourceByteBudgetQuantity",
    );
    const byteQuantitySchema = schemaSection(
      source,
      "ConnectedSourceByteBudgetQuantity",
      "ConnectedSourceRequestCountBudgetQuantity",
    );
    const requestCountQuantitySchema = schemaSection(
      source,
      "ConnectedSourceRequestCountBudgetQuantity",
      "PersonalMarketDataStatus",
    );
    for (const exactQuantitySchema of [
      quantitySchema,
      byteQuantitySchema,
      requestCountQuantitySchema,
    ]) {
      expect(exactQuantitySchema).toContain("additionalProperties: false");
      expect(requiredKeys(exactQuantitySchema)).toEqual(["limit", "used"]);
      expect(schemaKeys(exactQuantitySchema)).toEqual(
        requiredKeys(exactQuantitySchema),
      );
      expect(exactQuantitySchema.match(/minimum: 0/g)).toHaveLength(2);
    }
    expect(quantitySchema.match(/maximum: 9007199254740991/g)).toHaveLength(2);
    expect(byteQuantitySchema.match(/maximum: 1048576/g)).toHaveLength(2);
    expect(requestCountQuantitySchema.match(/maximum: 10000/g)).toHaveLength(2);

    const publicStatusSurface = `${statusRoute}\n${statusSchema}`.toLowerCase();
    for (const forbidden of [
      "provider",
      "credential",
      "secret",
      "legal",
      "license",
      "terms",
      "entitlement",
    ]) {
      expect(publicStatusSurface, forbidden).not.toContain(forbidden);
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
    const alert = schemaSection(
      source,
      "AlertWriteResponse",
      "PersonalFilingReadiness",
    );
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
    const personalFilingReadiness = {
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "quality_gate_ready",
      dataPlane: "disabled",
    } satisfies PersonalFilingReadinessDto;
    const personalFilingSelectedFact = {
      key: "revenue",
      value: "120000000",
      unit: "USD",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    } satisfies PersonalFilingSelectedFactDto;
    const personalFilingSelectedFacts = {
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "selected_facts_released",
      facts: [personalFilingSelectedFact],
    } satisfies PersonalFilingSelectedFactsDto;
    const personalFilingDossierFact = {
      evidenceId: "evidence-0001",
      id: "fact-0001",
      key: "revenue",
      knownFrom: "2026-02-20T20:00:01.000Z",
      knownToExclusive: null,
      label: "Revenue",
      periodEnd: "2025-12-31",
      periodStart: "2025-01-01",
      unit: "USD",
      value: "120000000",
      version: "current",
    } satisfies PersonalFilingDossierFactDto;
    const personalFilingDossierEvidence = {
      derivationFormula: null,
      derivationOperands: [],
      factId: "fact-0001",
      id: "evidence-0001",
      sourceAcceptedAt: "2026-02-20T20:00:00.000Z",
      sourceAccession: "0000000000-26-000001",
      sourceAvailableAt: "2026-02-20T20:00:01.000Z",
      sourceConcept: "sample:Revenue",
      sourceContentSha256:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sourceDocumentSha256:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      taxonomy: "sample-gaap-2026",
    } satisfies PersonalFilingDossierEvidenceDto;
    const personalFilingDossier = {
      asOf: "2026-02-20T20:00:01.000Z",
      chart: {
        reasonCode: "NO_OWNER_APPROVED_CHART_FACTS",
        status: "unsupported",
      },
      dataMode: "personal",
      evidence: [personalFilingDossierEvidence],
      facts: [personalFilingDossierFact],
      lineage: {
        events: [],
        scope: "issuer_filing_versions_within_exact_frozen_manifest_only",
        status: "root_only_no_in_corpus_amendment",
      },
      omissions: {
        count: null,
        explanation:
          "The dossier contains only the exact owner-fixed fact scope.",
        hasOmissions: true,
        reasonCode: "OWNER_FIXED_SCOPE",
      },
      profile: "personal_single_user_local",
      schemaVersion: "1.0.0",
      status: "personal_dossier_released",
      valuationInputs: {
        reasonCode: "REQUIRED_FACTS_NOT_RELEASED",
        status: "unsupported",
      },
    } satisfies PersonalFilingDossierDto;
    const personalSecurityMasterSnapshot = {
      asOf: "2026-09-01T18:00:00.000Z",
      catalogId: "personal-security-master-2026-09",
      catalogVersion: "1.0.0",
      claim: "bounded_exact_owner_local_security_master_snapshot_admitted",
      coverage: {
        activeEligibleSecurities: 2,
        activeListings: 2,
        admittedSourceRecords: 2,
        basis: "synthetic_engineering_only_not_real_universe",
        eligibleSecurityBand: "under_1000",
        formerTickerEntries: 1,
        ineligibleSourceRecords: 5,
        inactiveSecurities: 0,
        issuers: 2,
        providerMappings: 2,
        quarantinedSourceRecords: 3,
        sourceRecords: 17,
        staleSourceRecords: 4,
        shareClasses: 2,
        totalSecurities: 2,
        unsupportedSourceRecords: 3,
      },
      generatedAt: "2026-09-01T17:30:00.000Z",
      profile: "personal_single_user_local_security_master",
      provenance: {
        acquiredAt: "2026-09-01T17:00:00.000Z",
        artifacts: [
          {
            acquiredAt: "2026-09-01T16:00:00.000Z",
            artifactId: "synthetic-component-a",
            contentSha256:
              "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            mediaType: "application/json",
            sourceUri: "https://example.invalid/security-master-component.json",
            sourceVersion: "synthetic-component-v1",
          },
        ],
        attribution: "Synthetic engineering fixture; not a real source.",
        contentKind: "synthetic_engineering",
        sourceId: "synthetic-security-source",
        sourceRevision:
          "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      },
      schemaVersion: "1.0.0",
      snapshotSha256:
        "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      sourcePolicyCompatibility: {
        attribution: "required",
        cache: "permitted_owner_local",
        decision: "compatible",
        deleteOnRequest: true,
        display: "permitted_owner_local",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2027-01-01T00:00:00.000Z",
        export: "prohibited",
        intendedUse: "personal_security_research",
        localOnly: true,
        operation: "fetch_snapshot",
        policyDocumentSha256:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        policyId: "synthetic-security-policy",
        policyProfile: "personal_single_user_local_connected",
        policySchemaVersion: "1.0.0",
        policyVersion: "1.0.0",
        redistribution: "prohibited",
        retention: "permitted_owner_local",
        reviewedAt: "2026-08-01T00:00:00.000Z",
        revocationCheck:
          "offline_snapshot_only_cannot_discover_later_revocation",
        revokedAt: null,
        rightsBasis: "owner_reviewed_rights_compatible",
        search: "permitted_owner_local",
        sourceId: "synthetic-security-source",
      },
      status: "admitted_for_personal_local_search",
    } satisfies PersonalSecurityMasterSnapshotReceiptDto;
    const personalSecurityMasterStatus = {
      snapshot: personalSecurityMasterSnapshot,
    } satisfies PersonalSecurityMasterStatusDto;
    const personalSecurityMasterSearch = {
      limitApplied: 10,
      normalizedQuery: "ZERO",
      results: [
        {
          cik: "0000000001",
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "adr",
          issuerId: "iss-00000",
          issuerName: "Zéro Alpha Holdings",
          listingId: "lst-00000",
          matchKind: "name_token_prefix",
          matchedValue: "Zéro Alpha Holdings",
          securityId: "sec-00000",
          securityName: "Zéro Alpha Security",
          shareClassId: "shr-00000",
          shareClassName: "Zéro Alpha ADR",
          symbol: "S00000",
        },
      ],
      snapshot: personalSecurityMasterSnapshot,
      totalMatches: 1,
    } satisfies PersonalSecurityMasterSearchResponseDto;
    const personalMarketProvider = {
      attribution: "Tiingo",
      export: "prohibited",
      historyFeed: "tiingo_eod_composite",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      quoteFeed: "tiingo_iex_derived_reference",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
    } as const;
    const personalMarketStatus = {
      profile: "personal_single_user_local_market_data",
      provider: personalMarketProvider,
      schemaVersion: "1.0.0",
      status: "configured",
    } satisfies PersonalMarketDataStatusDto;
    const personalMarketOverview = {
      history: {
        bars: [
          {
            adjusted: {
              close: "101.25",
              high: "102",
              low: "99.5",
              open: "100",
              volume: "1234567.5",
            },
            date: "2026-09-04",
            dividendCash: "0.25",
            raw: {
              close: "101.25",
              high: "102",
              low: "99.5",
              open: "100",
              volume: "1234567",
            },
            splitFactor: "1",
          },
        ],
        endDate: "2026-09-07",
        range: "1m",
        startDate: "2026-08-07",
      },
      profile: "personal_single_user_local_market_data",
      provider: personalMarketProvider,
      quote: {
        change: "1.25",
        changePercent: "1.25",
        currency: "USD",
        freshness: "current",
        ingestedAt: "2026-09-07T15:00:01.000Z",
        kind: "derived_realtime_reference",
        previousClose: "100",
        price: "101.25",
        sourceTime: "2026-09-07T15:00:00.000Z",
      },
      schemaVersion: "1.0.0",
      security: {
        country: "US",
        exchangeMic: "XNAS",
        issuerName: "Zero Alpha Holdings",
        listingId: "lst-00000",
        securityName: "Zero Alpha Common Stock",
        symbol: "ZERO",
      },
      status: "available",
    } satisfies PersonalMarketOverviewDto;
    const knownAnnualFinancialCell = {
      status: "known",
      value: "120000000",
    } as const;
    const unknownAnnualFinancialCell = {
      reason: "not_supplied_by_provider",
      status: "unknown",
      value: null,
    } as const;
    const personalAnnualFinancials = {
      asOf: "2026-09-07T15:00:01.000Z",
      coverage: {
        earliestFiscalYear: 2025,
        knownReportedCells: 29,
        latestFiscalYear: 2025,
        missingFiscalYears: [],
        requestedAnnualYears: 10,
        returnedAnnualYears: 1,
        status: "partial",
        unknownReportedCells: 1,
      },
      profile: "personal_single_user_local_fundamentals",
      provider: {
        attribution: "Tiingo",
        export: "prohibited",
        id: "tiingo",
        name: "Tiingo",
        persistence: "none",
        redistribution: "prohibited",
        retention: "active_owner_session_memory_only",
        revisionBasis: "provider_most_recent",
        statementFeed: "tiingo_fundamentals_statements",
        valueCurrency: "USD",
      },
      schemaVersion: "1.0.0",
      security: personalMarketOverview.security,
      status: "available",
      years: [
        {
          fiscalYear: 2025,
          periodEnd: "2026-02-20",
          reported: {
            accounts_receivable: knownAnnualFinancialCell,
            assets: knownAnnualFinancialCell,
            capital_expenditures: knownAnnualFinancialCell,
            cash: knownAnnualFinancialCell,
            cost_of_revenue: knownAnnualFinancialCell,
            current_assets: knownAnnualFinancialCell,
            current_liabilities: knownAnnualFinancialCell,
            debt: knownAnnualFinancialCell,
            depreciation_and_amortization: knownAnnualFinancialCell,
            ebitda: knownAnnualFinancialCell,
            financing_cash_flow: knownAnnualFinancialCell,
            free_cash_flow: knownAnnualFinancialCell,
            gross_profit: knownAnnualFinancialCell,
            income_tax_expense: knownAnnualFinancialCell,
            intangibles: knownAnnualFinancialCell,
            inventory: knownAnnualFinancialCell,
            investing_cash_flow: knownAnnualFinancialCell,
            liabilities: knownAnnualFinancialCell,
            net_income: knownAnnualFinancialCell,
            operating_cash_flow: knownAnnualFinancialCell,
            operating_expenses: knownAnnualFinancialCell,
            operating_income: knownAnnualFinancialCell,
            pretax_income: knownAnnualFinancialCell,
            property_plant_equipment_net: knownAnnualFinancialCell,
            research_and_development: knownAnnualFinancialCell,
            revenue: knownAnnualFinancialCell,
            selling_general_and_administrative: knownAnnualFinancialCell,
            share_based_compensation: knownAnnualFinancialCell,
            shareholders_equity: knownAnnualFinancialCell,
            interest_expense: unknownAnnualFinancialCell,
          },
        },
      ],
    } satisfies PersonalAnnualFinancialsDto;
    const connectedSourceBudgetQuantity = {
      limit: 100,
      used: 25,
    } satisfies ConnectedSourceBudgetQuantityDto;
    const connectedSourceBudget = {
      currency: "USD",
      estimatedSpendMicrounits: connectedSourceBudgetQuantity,
      requestBytes: connectedSourceBudgetQuantity,
      requests: connectedSourceBudgetQuantity,
      responseBytes: connectedSourceBudgetQuantity,
      storageBytes: connectedSourceBudgetQuantity,
    } satisfies ConnectedSourceBudgetStatusDto;
    const connectedSourcePolicyStatus = {
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local_connected",
      status: "ready",
      reasonCode: null,
      sourceId: "connected-source-primary",
      policyId: "owner-policy-primary",
      policyVersion: "v1",
      budget: connectedSourceBudget,
    } satisfies ConnectedSourcePolicyStatusDto;
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
    expect(Object.keys(personalFilingReadiness)).toEqual([
      "schemaVersion",
      "profile",
      "status",
      "dataPlane",
    ]);
    expect(Object.keys(personalFilingSelectedFact)).toEqual([
      "key",
      "value",
      "unit",
      "periodStart",
      "periodEnd",
    ]);
    expect(Object.keys(personalFilingSelectedFacts)).toEqual([
      "schemaVersion",
      "profile",
      "status",
      "facts",
    ]);
    expect(Object.keys(personalFilingDossierFact)).toEqual([
      "evidenceId",
      "id",
      "key",
      "knownFrom",
      "knownToExclusive",
      "label",
      "periodEnd",
      "periodStart",
      "unit",
      "value",
      "version",
    ]);
    expect(Object.keys(personalFilingDossierEvidence)).toEqual([
      "derivationFormula",
      "derivationOperands",
      "factId",
      "id",
      "sourceAcceptedAt",
      "sourceAccession",
      "sourceAvailableAt",
      "sourceConcept",
      "sourceContentSha256",
      "sourceDocumentSha256",
      "taxonomy",
    ]);
    expect(Object.keys(personalFilingDossier)).toEqual([
      "asOf",
      "chart",
      "dataMode",
      "evidence",
      "facts",
      "lineage",
      "omissions",
      "profile",
      "schemaVersion",
      "status",
      "valuationInputs",
    ]);
    expect(Object.keys(personalSecurityMasterStatus)).toEqual(["snapshot"]);
    expect(Object.keys(personalSecurityMasterSnapshot)).toEqual([
      "asOf",
      "catalogId",
      "catalogVersion",
      "claim",
      "coverage",
      "generatedAt",
      "profile",
      "provenance",
      "schemaVersion",
      "snapshotSha256",
      "sourcePolicyCompatibility",
      "status",
    ]);
    expect(Object.keys(personalSecurityMasterSearch)).toEqual([
      "limitApplied",
      "normalizedQuery",
      "results",
      "snapshot",
      "totalMatches",
    ]);
    expect(Object.keys(personalSecurityMasterSearch.results[0] ?? {})).toEqual([
      "cik",
      "country",
      "exchangeMic",
      "instrumentType",
      "issuerId",
      "issuerName",
      "listingId",
      "matchKind",
      "matchedValue",
      "securityId",
      "securityName",
      "shareClassId",
      "shareClassName",
      "symbol",
    ]);
    expect(personalSecurityMasterSearch).not.toHaveProperty("providerMappings");
    expect(Object.keys(personalMarketStatus)).toEqual([
      "profile",
      "provider",
      "schemaVersion",
      "status",
    ]);
    expect(Object.keys(personalMarketOverview)).toEqual([
      "history",
      "profile",
      "provider",
      "quote",
      "schemaVersion",
      "security",
      "status",
    ]);
    expect(Object.keys(personalMarketOverview.history.bars[0] ?? {})).toEqual([
      "adjusted",
      "date",
      "dividendCash",
      "raw",
      "splitFactor",
    ]);
    expect(Object.keys(personalAnnualFinancials)).toEqual([
      "asOf",
      "coverage",
      "profile",
      "provider",
      "schemaVersion",
      "security",
      "status",
      "years",
    ]);
    expect(
      Object.keys(personalAnnualFinancials.years[0]?.reported ?? {}),
    ).toEqual(PERSONAL_ANNUAL_FINANCIAL_REPORTED_KEYS);
    expect(Object.keys(connectedSourceBudgetQuantity)).toEqual([
      "limit",
      "used",
    ]);
    expect(Object.keys(connectedSourceBudget)).toEqual([
      "currency",
      "estimatedSpendMicrounits",
      "requestBytes",
      "requests",
      "responseBytes",
      "storageBytes",
    ]);
    expect(Object.keys(connectedSourcePolicyStatus)).toEqual([
      "schemaVersion",
      "profile",
      "status",
      "reasonCode",
      "sourceId",
      "policyId",
      "policyVersion",
      "budget",
    ]);
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
