import { readFileSync } from "node:fs";
import {
  isPersonalSecQuarterAssessmentResponse,
  type PersonalSecQuarterAssessmentRequestDto,
  type PersonalSecQuarterAssessmentResponseDto,
} from "@research-cockpit/contracts";
import { describe, expect, it } from "vitest";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import { admitPersonalSecurityMasterSnapshot } from "@research-cockpit/personal-security-master";
import { createSecPersonalQuarterAssessmentProvider } from "./personal-sec-quarter-assessment-provider";
import {
  buildMutableTestSecurityMasterDocument,
  bindTestSecurityMasterDocument,
} from "./test-personal-security-master-builder";
import {
  bootstrapTestPersonalOwnerSession,
  createTestPersonalOwnerSession,
} from "./test-personal-owner-session-builder";
import { buildPersonalWorkspaceApp } from "./workspace-app";

const directory = new URL(
  "../../../fixtures/synthetic/sec-quarter-assessment/",
  import.meta.url,
);
const raw = (name: string) => readFileSync(new URL(name, directory), "utf8");
const request = JSON.parse(
  raw("request.json"),
) as PersonalSecQuarterAssessmentRequestDto;
const target = {
  catalogSnapshotSha256: request.catalogSnapshotSha256,
  security: {
    country: "US" as const,
    exchangeMic: "XNAS",
    issuerId: "fixture:example-issuer",
    issuerName: "Example Corporation",
    listingId: request.listingId,
    securityName: "Example Corporation Common Stock",
    symbol: request.symbol,
    cik: "0000999999",
  },
};

async function assess(
  document = raw("filing.xhtml.txt"),
  facts = raw("company-facts.json"),
) {
  const sources = [raw("submissions.json"), facts, document];
  let gets = 0;
  const provider = createSecPersonalQuarterAssessmentProvider(
    "SyntheticResearch owner@example.test",
    {
      fetch: () =>
        Promise.resolve(
          new Response(sources[gets++], {
            headers: {
              "Content-Type": gets === 3 ? "text/html" : "application/json",
            },
          }),
        ),
      scheduler: {
        wait: (signal) => {
          signal.throwIfAborted();
          return Promise.resolve();
        },
      },
    },
  );
  try {
    const assessment = await provider.assess(target, request.selection);
    const response = { schemaVersion: "1.0.0" as const, ...target, assessment };
    expect(gets).toBe(3);
    expect(isPersonalSecQuarterAssessmentResponse(response, request)).toBe(
      true,
    );
    if (assessment.stage !== "assessment")
      throw new Error(`Unexpected refusal: ${assessment.reason}`);
    return assessment;
  } finally {
    provider.close();
  }
}

describe("raw synthetic SEC quarter integration", () => {
  it("publishes the real complete assessment only through the authorized route with catalog-derived identity", async () => {
    const document = buildMutableTestSecurityMasterDocument(1);
    document.issuers[0]!.cik = target.security.cik;
    const admission = bindTestSecurityMasterDocument(document);
    const catalog = admitPersonalSecurityMasterSnapshot(admission);
    const owner = createTestPersonalOwnerSession();
    const sources = [
      raw("submissions.json"),
      raw("company-facts.json"),
      raw("filing.xhtml.txt"),
    ];
    let gets = 0;
    const provider = createSecPersonalQuarterAssessmentProvider(
      "SyntheticResearch owner@example.test",
      {
        fetch: () =>
          Promise.resolve(
            new Response(sources[gets++], {
              headers: {
                "Content-Type": gets === 3 ? "text/html" : "application/json",
              },
            }),
          ),
        scheduler: {
          wait: (signal) => {
            signal.throwIfAborted();
            return Promise.resolve();
          },
        },
      },
    );
    const vault = {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      close: () => undefined,
    } as unknown as LocalResearchVault;
    const app = await buildPersonalWorkspaceApp(
      catalog,
      vault,
      owner.authority,
      { host: "127.0.0.1", port: 3100 },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      provider,
    );
    try {
      const cookie = await bootstrapTestPersonalOwnerSession(app, owner.secret);
      const input = {
        ...request,
        catalogSnapshotSha256: catalog.snapshotSha256,
        listingId: "lst-00000",
        symbol: "S00000",
      };
      const response = await app.inject({
        method: "POST",
        url: "/v1/personal-filing/workspace/sec-quarter-assessment",
        remoteAddress: "127.0.0.1",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          host: "127.0.0.1:3100",
          origin: "http://127.0.0.1:3000",
          cookie,
        },
        payload: input,
      });
      expect(response.statusCode).toBe(200);
      expect(
        isPersonalSecQuarterAssessmentResponse(response.json(), input),
      ).toBe(true);
      expect(
        response.json<PersonalSecQuarterAssessmentResponseDto>().security,
      ).toMatchObject({
        issuerId: "iss-00000",
        listingId: "lst-00000",
        symbol: "S00000",
        cik: target.security.cik,
      });
      const decoded = response.json<PersonalSecQuarterAssessmentResponseDto>();
      if (decoded.assessment.stage !== "assessment")
        throw new Error("Missing assessment result.");
      expect(decoded.assessment.analysis.pair).toMatchObject({
        status: "supported_as_filed",
        revenue: "100000000",
        netIncome: "-20000000",
      });
      expect(gets).toBe(3);
      expect(response.payload).not.toContain(owner.secret);
    } finally {
      await app.close();
    }
  });
  it("supports both exact signed values through the real projector, worker, profiles and provider", async () => {
    const result = await assess();
    expect(result.status).toBe("supported_as_filed");
    expect(result.analysis.pair).toMatchObject({
      revenue: "100000000",
      netIncome: "-20000000",
      unit: "USD",
      period: { startDate: "2025-01-01", endDate: "2025-03-31" },
    });
    expect(result.analysis.ttm).toEqual({
      status: "unavailable",
      reason: "source_not_admitted",
    });
  });
  it("retains equal source duplicates and maps both to the actual statement witness", async () => {
    const facts = JSON.parse(raw("company-facts.json")) as {
      facts: {
        "us-gaap": { Revenues: { units: { USD: Record<string, unknown>[] } } };
      };
    };
    facts.facts["us-gaap"].Revenues.units.USD.push({
      ...facts.facts["us-gaap"].Revenues.units.USD[0],
    });
    const result = await assess(raw("filing.xhtml.txt"), JSON.stringify(facts));
    expect(result.status).toBe("supported_as_filed");
    expect(
      result.analysis.concepts.find((c) => c.concept === "Revenues")
        ?.companyFactsRefs,
    ).toHaveLength(2);
    expect(
      result.analysis.witnesses.find((w) => w.concept === "Revenues")
        ?.companyFactsRefs,
    ).toHaveLength(2);
  });
  it("keeps supported revenue when the parent income display is missing its negative sign", async () => {
    const document = raw("filing.xhtml.txt")
      .replace(
        '>(<ix:nonFraction name="us-gaap:NetIncomeLoss"',
        '><ix:nonFraction name="us-gaap:NetIncomeLoss"',
      )
      .replace(">20</ix:nonFraction>)", ">20</ix:nonFraction>");
    const result = await assess(document);
    expect(result.status).toBe("held");
    expect(result.analysis.metrics[0]).toMatchObject({
      status: "supported_as_filed",
      value: "100000000",
    });
    expect(result.analysis.metrics[1]).toMatchObject({
      status: "held",
      value: null,
    });
    expect(result.analysis.pair).toMatchObject({
      revenue: null,
      netIncome: null,
    });
  });
  it("blocks a conflicting hidden current fact even when the principal statement agrees with Company Facts", async () => {
    const conflict =
      '<ix:nonFraction name="us-gaap:Revenues" contextRef="current" unitRef="usd" scale="6" decimals="-6">101</ix:nonFraction>';
    const result = await assess(
      raw("filing.xhtml.txt").replace(
        "</ix:hidden>",
        `${conflict}</ix:hidden>`,
      ),
    );
    expect(result.status).toBe("conflicted");
    expect(result.analysis.metrics[0]).toMatchObject({
      status: "conflicted",
      value: null,
    });
    expect(result.analysis.metrics[0]!.reasons).toContain(
      "current_value_conflict",
    );
    expect(result.analysis.metrics[1]).toMatchObject({
      status: "supported_as_filed",
      value: "-20000000",
    });
  });
  it("holds current non-USD evidence instead of comparing it as USD", async () => {
    const result = await assess(
      raw("filing.xhtml.txt").replace(">iso4217:USD<", ">iso4217:EUR<"),
    );
    expect(result.status).toBe("held");
    expect(result.analysis.metrics[0]!.reasons).toContain("current_non_usd");
    expect(result.analysis.metrics[0]!.reasons).not.toContain(
      "current_value_conflict",
    );
  });
  it("holds a document whose script leaves static visibility unresolved", async () => {
    const result = await assess(
      raw("filing.xhtml.txt").replace(
        "</body>",
        '<script src="https://example.invalid/display.js"></script></body>',
      ),
    );
    expect(result.status).toBe("held");
    expect(result.analysis.pair.revenue).toBeNull();
    expect(result.analysis.pair.netIncome).toBeNull();
  });
});
