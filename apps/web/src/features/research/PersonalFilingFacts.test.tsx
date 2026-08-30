import type { PersonalFilingSelectedFactsDto } from "@research-cockpit/contracts";
import React from "react";
import { describe, expect, it } from "vitest";

import { PersonalFilingFacts } from "./PersonalFilingFacts";

describe("PersonalFilingFacts", () => {
  it("labels the private projection as read-only and separate from the demo", () => {
    const release = {
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "selected_facts_released",
      facts: [
        {
          key: "assets",
          value: "1000",
          unit: "USD",
          periodStart: null,
          periodEnd: "2025-12-31",
        },
        {
          key: "free_cash_flow",
          value: "125.5",
          unit: "USD",
          periodStart: "2025-01-01",
          periodEnd: "2025-12-31",
        },
      ],
    } satisfies PersonalFilingSelectedFactsDto;

    const text = textContent(PersonalFilingFacts({ release }));

    expect(text).toContain("Owner-approved local filing snapshot");
    expect(text).toContain("Read-only and memory-only");
    expect(text).toContain("fictional dossier below");
    expect(text).toContain("Assets");
    expect(text).toContain("1000");
    expect(text).toContain("At 2025-12-31");
    expect(text).toContain("Free cash flow");
    expect(text).toContain("125.5");
    expect(text).toContain("2025-01-01 — 2025-12-31");
  });
});

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  return textContent((value.props as { children?: unknown }).children);
}
