import { describe, expect, it, vi } from "vitest";
import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  parseManagedSecAnnualCanonicalRequest,
  type PersonalSecAnnualCanonicalEvidenceDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { serializePersonalSecAnnualCanonicalGeneration } from "@research-cockpit/personal-financial-analytics";
import { createPersonalSecAnnualCanonicalEvidence } from "./personal-sec-annual-canonical-evidence";
import {
  CIK,
  capacityFixture,
  fixture,
  sha,
} from "./test-personal-sec-annual-canonical-builder";
import {
  encodePersonalSecAnnualCanonicalResponse,
  PersonalSecAnnualCanonicalResponseError,
} from "./personal-sec-annual-canonical-response";

const catalog = `sha256:${"a".repeat(64)}` as const;
const request = parseManagedSecAnnualCanonicalRequest({
  schemaVersion: "6.0.0",
  catalogSnapshotSha256: catalog,
  listingId: "listing-invented-a",
  symbol: "ZERO",
})!;
const security: PersonalSecAnnualCanonicalResponseDto["security"] = {
  country: "US",
  exchangeMic: "XNAS",
  issuerId: "issuer-invented",
  issuerName: 'Invented café "Research" 公司',
  listingId: request.listingId,
  securityName: "Invented common shares",
  symbol: request.symbol,
  cik: CIK,
};
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
function evidence() {
  return createPersonalSecAnnualCanonicalEvidence(fixture().input);
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function failure(run: () => unknown, code: string) {
  try {
    run();
    expect.fail("Expected complete response refusal.");
  } catch (error) {
    expect(error).toBeInstanceOf(PersonalSecAnnualCanonicalResponseError);
    expect(error).toMatchObject({ code, message: code });
  }
}

describe("canonical annual response encoding", () => {
  it("encodes the exact normalized and filing-joined graph once, with explicit public identity and UTF-8 size", () => {
    const { input, companyText, submissionsText } = fixture();
    const graph = createPersonalSecAnnualCanonicalEvidence(input);
    const before = JSON.stringify(graph);
    const privateGetter = vi.fn(() => "not public");
    const listing = { ...security, privateProviderMapping: "not public" };
    Object.defineProperty(listing, "privateCredentials", {
      enumerable: true,
      get: privateGetter,
    });
    const result = encodePersonalSecAnnualCanonicalResponse(
      request,
      catalog,
      listing,
      graph,
    );
    expect(privateGetter).not.toHaveBeenCalled();
    expect(result.response).toEqual({
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: catalog,
      security,
      evidence: graph,
    });
    expect(result.response.evidence).toBe(graph);
    expect(result.response.security === listing).toBe(false);
    expect(Object.keys(result.response)).toEqual([
      "schemaVersion",
      "catalogSnapshotSha256",
      "security",
      "evidence",
    ]);
    expect(Object.keys(result.response.security)).toHaveLength(8);
    expect(privateGetter).not.toHaveBeenCalled();
    expect(result.body).not.toContain("private");
    expect(result.body).toBe(JSON.stringify(result.response));
    expect(JSON.parse(result.body)).toEqual(result.response);
    expect(result.byteLength).toBe(Buffer.byteLength(result.body, "utf8"));
    expect(result.byteLength).toBeGreaterThan(result.body.length);
    expect(result.byteLength).toBeLessThan(
      MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes,
    );
    expect(result.body.match(/"observations":/gu)).toHaveLength(1);
    expect(result.body).toContain(
      '"value":"900719925474099312345.000000000000000001"',
    );
    expect(result.body).toContain(
      '"value":"-900719925474099312345.000000000000000001"',
    );
    expect(result.body).toContain('"value":"-7.5"');
    expect(graph.facts.observations[0]!.sourceLocator).toBe(
      "/facts/us-gaap/Revenues/units/USD/0",
    );
    for (const row of graph.facts.observations)
      expect(row.filing.status).toBe("matched");
    expect(graph.generation.sources.companyFacts.sha256).toBe(sha(companyText));
    expect(graph.generation.sources.submissions.sha256).toBe(
      sha(submissionsText),
    );
    expect(JSON.stringify(graph)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.response)).toBe(true);
    expect(Object.isFrozen(result.response.security)).toBe(true);
    expect(Object.isFrozen(listing)).toBe(false);
  });

  it.each(["version", "extra", "getter", "inherited"] as const)(
    "refuses malformed requests: %s",
    (kind) => {
      const input = { ...request };
      const getter = vi.fn(() => request.symbol);
      if (kind === "version") Object.assign(input, { schemaVersion: "5.0.0" });
      if (kind === "extra") Object.assign(input, { cik: CIK });
      if (kind === "getter")
        Object.defineProperty(input, "symbol", {
          enumerable: true,
          get: getter,
        });
      failure(
        () =>
          encodePersonalSecAnnualCanonicalResponse(
            kind === "inherited"
              ? (Object.create(input) as typeof input)
              : input,
            catalog,
            security,
            evidence(),
          ),
        "invalid_request",
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );

  it("refuses a request captured against a different catalog", () => {
    failure(
      () =>
        encodePersonalSecAnnualCanonicalResponse(
          request,
          `sha256:${"b".repeat(64)}`,
          security,
          evidence(),
        ),
      "catalog_changed",
    );
  });

  it.each([
    ["listingId", "listing-invented-b"],
    ["symbol", "ONE"],
    ["country", "CA"],
    ["exchangeMic", "nasdaq"],
    ["issuerId", "UPPERCASE"],
    ["cik", "0000000000"],
    ["issuerName", " trailing "],
    ["issuerName", "Cafe\u0301"],
    ["securityName", "hidden\u200bname"],
    ["securityName", "x".repeat(513)],
  ])(
    "refuses mismatched or malformed catalog identity %s=%s",
    (field, value) => {
      failure(
        () =>
          encodePersonalSecAnnualCanonicalResponse(
            request,
            catalog,
            { ...security, [field]: value },
            evidence(),
          ),
        "invalid_identity",
      );
    },
  );

  it.each(["getter", "inherited", "nonenumerable"] as const)(
    "refuses unsafe public catalog fields without reading them: %s",
    (kind) => {
      const listing = { ...security };
      const getter = vi.fn(() => security.cik);
      if (kind === "getter")
        Object.defineProperty(listing, "cik", {
          enumerable: true,
          get: getter,
        });
      if (kind === "nonenumerable")
        Object.defineProperty(listing, "cik", { enumerable: false });
      failure(
        () =>
          encodePersonalSecAnnualCanonicalResponse(
            request,
            catalog,
            kind === "inherited"
              ? (Object.create(listing) as typeof listing)
              : listing,
            evidence(),
          ),
        "invalid_identity",
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );

  it("refuses evidence for another CIK even when both identities are well formed", () => {
    failure(
      () =>
        encodePersonalSecAnnualCanonicalResponse(
          request,
          catalog,
          { ...security, cik: "0000000043" },
          evidence(),
        ),
      "invalid_evidence",
    );
  });

  it.each([
    "mutable",
    "row value",
    "row id",
    "generation",
    "extra",
    "getter",
  ] as const)("refuses malformed, unowned or tampered evidence: %s", (kind) => {
    const graph = structuredClone(
      evidence(),
    ) as Mutable<PersonalSecAnnualCanonicalEvidenceDto>;
    const getter = vi.fn(() => "unread");
    if (kind === "row value") {
      graph.facts.observations[0]!.value = "1";
      graph.generation.sha256 = sha(
        serializePersonalSecAnnualCanonicalGeneration(graph),
      );
    }
    if (kind === "row id")
      graph.facts.observations[0]!.id = `sec-fact:${"f".repeat(64)}`;
    if (kind === "generation")
      graph.generation.sha256 = `sha256:${"f".repeat(64)}`;
    if (kind === "extra") Object.assign(graph, { income: {} });
    if (kind === "getter")
      Object.defineProperty(graph, "cik", { enumerable: true, get: getter });
    if (kind !== "mutable" && kind !== "getter") freeze(graph);
    failure(
      () =>
        encodePersonalSecAnnualCanonicalResponse(
          request,
          catalog,
          security,
          graph,
        ),
      "invalid_evidence",
    );
    expect(getter).not.toHaveBeenCalled();
    if (kind === "mutable") expect(Object.isFrozen(graph)).toBe(false);
  });

  it("retains a complete bounded packet with every concept and all 50 selected rows", () => {
    const graph = createPersonalSecAnnualCanonicalEvidence(
      capacityFixture(false, 50).input,
    );
    expect(graph.facts.observations).toHaveLength(1600);
    const result = encodePersonalSecAnnualCanonicalResponse(
      request,
      catalog,
      security,
      graph,
    );
    expect(result.response.evidence).toBe(graph);
    const parsed = JSON.parse(
      result.body,
    ) as PersonalSecAnnualCanonicalResponseDto;
    expect(parsed.evidence).toEqual(graph);
    expect(parsed.evidence.facts.scans.map((item) => item.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => entry.concept),
    );
    expect(result.byteLength).toBeLessThanOrEqual(2_097_152);
    for (const scan of parsed.evidence.facts.scans)
      expect(scan.scan).toMatchObject({
        coverage: { selected: 50, returned: 50, omittedSelected: 0 },
      });
  });

  it("refuses the whole 32-by-100 escaped metadata packet without clipping or mutating any source or canonical row", () => {
    const { input, companyText } = capacityFixture(true);
    const sourceBefore = JSON.stringify(input);
    const graph = createPersonalSecAnnualCanonicalEvidence(input);
    const before = JSON.stringify(graph);
    expect(graph.facts.observations).toHaveLength(3200);
    expect(
      graph.facts.observations.every(
        (row) =>
          row.filingFocusPeriod?.length === 32 && row.frame?.length === 128,
      ),
    ).toBe(true);
    expect(Buffer.byteLength(companyText)).toBeLessThan(8 * 1024 * 1024);
    const actualBody = JSON.stringify({
      schemaVersion: "6.0.0",
      catalogSnapshotSha256: catalog,
      security,
      evidence: graph,
    });
    expect(Buffer.byteLength(actualBody)).toBeGreaterThan(2_097_152);
    failure(
      () =>
        encodePersonalSecAnnualCanonicalResponse(
          request,
          catalog,
          security,
          graph,
        ),
      "response_too_large",
    );
    expect(JSON.stringify(graph)).toBe(before);
    expect(JSON.stringify(input)).toBe(sourceBefore);
    expect(graph.facts.scans).toHaveLength(32);
    for (const scan of graph.facts.scans)
      expect(scan.scan).toMatchObject({
        coverage: { selected: 100, returned: 100, omittedSelected: 0 },
      });
    expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes).toBe(2_097_152);
  });
});
