import React from "react";
import { describe, expect, it } from "vitest";

import { PersonalDossier } from "./PersonalDossier";
import { buildPersonalDossierFixture } from "./test-personal-dossier-builder";

describe("PersonalDossier", () => {
  it("renders one personal graph with linked evidence, lineage, chart, valuation, and omissions", () => {
    const text = textContent(
      PersonalDossier({ dossier: buildPersonalDossierFixture() }),
    );

    expect(text).toContain("Personal filing dossier");
    expect(text).toContain("Current admitted facts");
    expect(text).toContain("1200");
    expect(text).toContain("Admitted filing chart");
    expect(text).toContain("1100");
    expect(text).toContain("Restatement lineage");
    expect(text).toContain("1100");
    expect(text).toContain("1200");
    expect(text).toContain("Prior evidence");
    expect(text).toContain("Valuation inputs");
    expect(text).toContain("Evidence passports");
    expect(text).toContain("0000000001-25-000002");
    expect(text).toContain("Exact hidden counts are not disclosed");
    expect(text).not.toContain("Synthetic demo");
    expect(text).not.toContain("Northwind Robotics");
  });

  it("renders explicit unsupported chart and valuation states without fallback values", () => {
    const dossier = buildPersonalDossierFixture();
    const unsupported = {
      ...dossier,
      chart: {
        status: "unsupported",
        reasonCode: "NO_OWNER_APPROVED_CHART_FACTS",
      },
      valuationInputs: {
        status: "unsupported",
        reasonCode: "REQUIRED_FACTS_NOT_RELEASED",
      },
    } as const;

    const text = textContent(PersonalDossier({ dossier: unsupported }));

    expect(text).toContain("Chart unavailable");
    expect(text).toContain("No owner-approved chart facts");
    expect(text).toContain("Valuation unavailable");
    expect(text).toContain("Required facts are outside");
    expect(text).not.toContain("exit-multiple-v1");
  });
});

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  if (typeof value.type === "function") {
    const Component = value.type as (
      props: Record<string, unknown>,
    ) => React.ReactNode;
    return textContent(Component(value.props as Record<string, unknown>));
  }
  return textContent((value.props as { children?: unknown }).children);
}
