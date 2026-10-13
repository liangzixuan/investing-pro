import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualPairDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualEvidence } from "@research-cockpit/personal-financial-analytics";
import { parseSecAnnualEvidenceResponse } from "../../lib/sec-annual-evidence-response";
import { annualNoteExcerpt } from "../../clerk-trial/managed-annual-note";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import { cashGeneration, cashRow } from "./sec-annual-cash-fixture";
import { request, response, row } from "./sec-annual-evidence-fixture";

const contractRevenue = "RevenueFromContractWithCustomerExcludingAssessedTax";
const labels = {
  Revenues: "Revenue",
  RevenueFromContractWithCustomerExcludingAssessedTax:
    "Customer contract revenue, excluding assessed tax",
  SalesRevenueNet: "Net sales revenue",
} as const;
const missingText = "Missing from this report&#x27;s loaded evidence.";
type Wire = PersonalSecAnnualEvidenceResponseDto;

async function admitted(wire: Wire): Promise<Wire> {
  const result = await parseSecAnnualEvidenceResponse(
    wire,
    request(),
    new AbortController().signal,
  );
  expect(result).not.toBeNull();
  return result!;
}

function render(wire: Wire) {
  return renderToStaticMarkup(
    <SecAnnualEvidenceResult response={wire} appearance="financial" />,
  );
}

function visible(html: string) {
  return html.split('<details class="managed-annual-provenance">')[0]!;
}

function sourceStatus(concept: string, status: string) {
  return `data-annual-source-basis="${concept}"><dt>${concept}</dt><dd>${status}</dd>`;
}

describe("managed Annual revenue-basis readability", () => {
  it("gives all three eligible bases distinct headings without changing source identities or pairs", async () => {
    const wire = await admitted(
      await response([
        row(),
        row(contractRevenue, "950"),
        row("SalesRevenueNet", "900"),
        row("NetIncomeLoss", "100"),
      ]),
    );
    const before = JSON.stringify(wire);
    const action = vi.fn((pair: PersonalSecAnnualPairDto) => (
      <button aria-label={`Add ${pair.concept} annual evidence to note draft`}>
        Add to note draft
      </button>
    ));
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={wire}
        appearance="financial"
        renderPairAction={action}
      />,
    );
    for (const [concept, label] of Object.entries(labels)) {
      expect(visible(html)).toContain(
        `aria-label="Annual revenue basis ${concept}"><h4>${label}</h4>`,
      );
      expect(html).toContain(sourceStatus(concept, "eligible"));
    }
    expect(visible(html)).not.toContain("managed-annual-missing-bases");
    expect(action.mock.calls.map(([pair]) => pair)).toEqual(
      wire.evidence.resolution.bases.flatMap((basis) => basis.pairs),
    );
    for (const [index, [pair]] of action.mock.calls.entries())
      expect(pair).toBe(wire.evidence.resolution.bases[index]!.pairs[0]);
    expect(JSON.stringify(wire)).toBe(before);
  });

  it("keeps two genuinely missing bases visible as compact rows before cash", async () => {
    const wire = await admitted(await response());
    const html = render(wire);
    const shown = visible(html);
    expect(shown).toContain("<h4>Other revenue bases</h4>");
    for (const concept of [contractRevenue, "SalesRevenueNet"] as const) {
      expect(shown).toContain(
        `data-annual-missing-basis="${concept}"><dt>${labels[concept]}</dt><dd>${missingText}</dd>`,
      );
      expect(shown).not.toContain(
        `aria-label="Annual revenue basis ${concept}"`,
      );
      expect(html).toContain(sourceStatus(concept, "missing"));
    }
    expect(shown.indexOf("Other revenue bases")).toBeLessThan(
      shown.indexOf('aria-label="Annual cash generation"'),
    );
    expect(shown).toContain("<td>1000</td>");
    expect(shown).toContain("<td>100</td>");
    expect(shown).toContain(
      'aria-label="Annual financial results" tabindex="0"',
    );
    const provenance = html.slice(shown.length);
    expect(provenance).toContain("Revenue basis source status");
    expect(provenance).toContain(sourceStatus("Revenues", "eligible"));
    for (const observation of wire.evidence.observations)
      expect(provenance).toContain(observation.id);
  });

  it("names an all-missing list without implying another revenue basis, while retaining independent cash", async () => {
    const base = await response([]);
    const wire = await admitted({
      ...base,
      evidence: {
        ...base.evidence,
        cashGeneration: await cashGeneration(base.evidence, [
          cashRow("operating_cash_flow", "120.125"),
          cashRow("ppe_purchases", "20.025"),
        ]),
      },
    });
    const html = render(wire);
    expect(visible(html)).toContain("<h4>Revenue bases</h4>");
    expect(visible(html)).not.toContain("Other revenue bases");
    expect(visible(html).match(/data-annual-missing-basis=/gu)).toHaveLength(3);
    expect(visible(html)).not.toContain("<table");
    expect(visible(html)).toContain(
      'class="sec-annual-cash-amount">100.1</span>',
    );
    for (const concept of Object.keys(labels))
      expect(html).toContain(sourceStatus(concept, "missing"));
  });

  it("keeps a rejected pair's reason, original input and unavailable section visible", async () => {
    const wire = await admitted(await response([row()]));
    const html = render(wire);
    expect(visible(html)).toContain(
      'aria-label="Annual revenue basis Revenues"><h4>Revenue</h4>',
    );
    expect(visible(html)).toContain(
      "NetIncomeLoss is missing for this filing and exact period.",
    );
    expect(visible(html)).toContain("Inspect annual pair inputs · Revenues");
    expect(html).toContain(wire.evidence.observations[0]!.id);
    expect(visible(html)).not.toContain('data-annual-missing-basis="Revenues"');
    expect(html).toContain(sourceStatus("Revenues", "rejected"));
  });

  it.each(["invalid_response", "candidate_limit"] as const)(
    "does not present an income scan %s refusal as missing revenue",
    async (incomeScanStatus) => {
      const base = await response([]);
      const input = {
        ...base.evidence,
        incomeScanStatus,
        completeness: {
          status: "refused",
          reason: "source_unavailable",
        } as const,
        coverage: null,
      };
      const wire = await admitted({
        ...base,
        evidence: {
          ...input,
          resolution: resolvePersonalSecAnnualEvidence(input),
        },
      });
      const html = render(wire);
      expect(visible(html)).not.toContain("managed-annual-missing-bases");
      expect(visible(html)).not.toContain(missingText);
      expect(visible(html)).toContain("Revenue and net income withheld.");
      for (const concept of Object.keys(labels)) {
        expect(visible(html)).toContain(
          `aria-label="Annual revenue basis ${concept}"`,
        );
        expect(html).toContain(sourceStatus(concept, "withheld"));
      }
    },
  );

  it("retains historical reported amounts and current-use refusal", async () => {
    const wire = await admitted(
      await response(undefined, "2027-09-20T00:00:00.000Z"),
    );
    const shown = visible(render(wire));
    expect(shown).toContain("<h4>Revenue</h4>");
    expect(shown).toContain("<td>1000</td>");
    expect(shown).toContain(
      "Revenue and income are unavailable under the current-use policy",
    );
    expect(shown).toContain(
      "outside the current-use policy at its original load",
    );
    expect(shown).not.toContain('data-annual-missing-basis="Revenues"');
  });

  it("uses replacement basis status and pairs without keeping stale results or changing note content", async () => {
    const first = await admitted(await response());
    const second = await admitted(
      await response([
        row("SalesRevenueNet", "900"),
        row("NetIncomeLoss", "90"),
      ]),
    );
    const action = vi.fn((pair: PersonalSecAnnualPairDto) => (
      <button>{annualNoteExcerpt(second, pair, false)}</button>
    ));
    const firstHtml = render(first);
    const nextHtml = renderToStaticMarkup(
      <SecAnnualEvidenceResult
        response={second}
        appearance="financial"
        renderPairAction={action}
      />,
    );
    expect(visible(firstHtml)).toContain(
      'data-annual-missing-basis="SalesRevenueNet"',
    );
    expect(visible(nextHtml)).not.toContain(
      'data-annual-missing-basis="SalesRevenueNet"',
    );
    expect(visible(nextHtml)).toContain(
      'aria-label="Annual revenue basis SalesRevenueNet"><h4>Net sales revenue</h4>',
    );
    expect(visible(nextHtml)).toContain('data-annual-missing-basis="Revenues"');
    expect(visible(nextHtml)).not.toContain("<td>1000</td>");
    expect(action).toHaveBeenCalledTimes(1);
    const pair = second.evidence.resolution.bases.find(
      (basis) => basis.concept === "SalesRevenueNet",
    )!.pairs[0]!;
    expect(action.mock.calls[0]![0]).toBe(pair);
    expect(annualNoteExcerpt(second, pair, false)).toContain("SalesRevenueNet");
    expect(annualNoteExcerpt(second, pair, false)).not.toContain(
      "Net sales revenue",
    );
    expect(
      nextHtml.match(/aria-label="Annual financial results" tabindex="0"/gu),
    ).toHaveLength(1);
    expect(render(first)).toBe(firstHtml);
  });

  it("preserves the local profile's exact concept headings, order and full missing explanations", async () => {
    const wire = await admitted(await response());
    const html = renderToStaticMarkup(
      <SecAnnualEvidenceResult response={wire} />,
    );
    const positions = wire.evidence.resolution.bases.map((basis) => {
      expect(html).toContain(`<h4>${basis.concept}</h4>`);
      return html.indexOf(`aria-label="Annual revenue basis ${basis.concept}"`);
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).toContain(
      "Unknown: this revenue basis is missing for the observed report.",
    );
    expect(html).not.toContain("managed-annual-missing-bases");
    expect(html).not.toContain("managed-annual-basis-sources");
  });
});
