import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SecAnnualOperatingResults,
  SecAnnualOperatingSourceBody,
} from "./SecAnnualOperatingResults";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";
import {
  operatingResponse,
  operatingRow,
} from "./sec-annual-operating-fixture";
import { row, request } from "./sec-annual-evidence-fixture";
import { parseSecAnnualEvidenceResponse } from "../../lib/sec-annual-evidence-response";
import { annualOperatingNoteExcerpt } from "../../clerk-trial/managed-annual-operating-note";

describe("Annual operating result presentation and note", () => {
  it("reuses the complete source body inside the closed company disclosure", async () => {
    const packet = await operatingResponse(
      [operatingRow("-25.125")],
      [row("Revenues", "1000")],
    );
    const body = renderToStaticMarkup(
      <SecAnnualOperatingSourceBody response={packet} />,
    );
    const company = renderToStaticMarkup(
      <SecAnnualOperatingResults response={packet} />,
    );
    expect(company).toContain(
      `<summary>Operating sources and calculation inputs</summary>${body}</details>`,
    );
    expect(body).not.toContain("sec-annual-operating-source");
    for (const observation of [
      ...packet.evidence.operatingResults.operatingIncome.observations,
      ...packet.evidence.observations.filter(
        (value) => value.metric === "revenue",
      ),
    ]) {
      expect(body).toContain(observation.id);
      expect(body).toContain(observation.concept);
      expect(body).toContain(observation.value);
    }
    for (const text of [
      "Scanned 1 rows: 0 invalid, 0 identical duplicates.",
      "Returned 1 of 1 selected-filing observations; 0 omitted.",
      "2026-09-20T00:00:00.000Z",
      "2026-09-20T00:00:01.000Z",
      "Revenues margin references:",
      "Current use requires a report within 485 days",
    ])
      expect(body).toContain(text);
  });

  it("shows exact negative results, named basis, inputs and original clocks without net income", async () => {
    const wire = await operatingResponse(
      [operatingRow("-25.125")],
      [row("Revenues", "1000")],
    );
    const parsed = await parseSecAnnualEvidenceResponse(
      wire,
      request(),
      new AbortController().signal,
    );
    expect(parsed).not.toBeNull();
    const action = vi.fn(() => <button>Add chosen operating evidence</button>);
    const html = renderToStaticMarkup(
      <SecAnnualOperatingResults
        response={parsed!}
        renderOperatingAction={action}
      />,
    );
    expect(action).toHaveBeenCalledTimes(3);
    for (const text of [
      "-25.125",
      "-2.51%",
      "OperatingIncomeLoss",
      "Revenues",
      "2025-01-01",
      "2025-12-31",
      "2026-09-20T00:00:01.000Z",
      "Operating sources and calculation inputs",
      "App calculation",
    ])
      expect(html).toContain(text);
    expect(html).toContain('class="sec-annual-operating"');
    expect(html).not.toContain('class="sec-annual-liquidity"');
    expect(html).not.toContain("sec-annual-liquidity-source");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    const basis = parsed!.evidence.operatingResults.resolution.margins.find(
      (b) => b.concept === "Revenues",
    )!;
    const text = annualOperatingNoteExcerpt(parsed!, basis, true)!;
    expect(text).toContain(
      "(OperatingIncomeLoss) USD -25.125; reported revenue (Revenues) USD 1000",
    );
    expect(text).toContain("operating margin -2.51%");
    expect(text).toContain("Retained previous report.");
    expect(text).toContain("0000000001-26-000001-index.htm");
    expect([...text].length).toBeLessThan(2000);
    expect(annualOperatingNoteExcerpt(parsed!, { ...basis }, false)).toBeNull();
  });

  it("keeps independent reported income visible when every margin lacks positive revenue", async () => {
    const packet = await operatingResponse(
      [operatingRow("-1")],
      [row("Revenues", "0")],
    );
    const html = renderToStaticMarkup(
      <SecAnnualOperatingResults response={packet} />,
    );
    expect(html).toContain("-1");
    expect(html).toContain(
      "Operating margin requires revenue greater than zero.",
    );
    expect(
      annualOperatingNoteExcerpt(
        packet,
        packet.evidence.operatingResults.resolution.margins[1]!,
        false,
      ),
    ).toBeNull();
  });

  it("uses original historical eligibility in both profiles without a fresh wall clock", async () => {
    const packet = await operatingResponse(
      [operatingRow()],
      undefined,
      "2028-09-20T00:00:00.000Z",
    );
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2035-01-01T00:00:00.000Z"));
      for (const appearance of ["evidence", "financial"] as const) {
        const html = renderToStaticMarkup(
          <SecAnnualEvidenceResult response={packet} appearance={appearance} />,
        );
        expect(html).toContain('aria-label="Annual operating results"');
        expect(html).toContain(
          "Historical value; outside current-use limits at this load.",
        );
        expect(html).not.toContain("2035");
      }
      const text = annualOperatingNoteExcerpt(
        packet,
        packet.evidence.operatingResults.resolution.margins[1]!,
        false,
      )!;
      expect(text).toContain(
        "Historical evidence; current-use policy at original load: unavailable.",
      );
      expect(text).not.toContain("2035");
    } finally {
      vi.useRealTimers();
    }
  });
});
