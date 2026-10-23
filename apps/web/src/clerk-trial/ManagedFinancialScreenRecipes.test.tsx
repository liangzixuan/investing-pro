import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import {
  ManagedFinancialScreenRecipes,
  ScreenRecipeReviewView,
} from "./ManagedFinancialScreenRecipes";
import { ManagedFinancialScreen } from "./managed-financial-screen";
import {
  formatManagedFinancialScreenRecipe,
  parseManagedFinancialScreenRecipe,
} from "./managed-financial-screen-recipe";
import { eodSelection } from "./eod-history-fixture";
import { DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA } from "./managed-financial-screen-results";
function preview() {
  const listing = eodSelection.listing,
    previous = { ...listing, symbol: "OLD", issuerName: "Old company name" };
  const member = { handle: Symbol(), listing };
  const model = new ManagedFinancialScreen(
    { resolve: vi.fn(), annualReport: vi.fn() },
    vi.fn(),
  );
  const current = {
    ...model.getSnapshot(),
    catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
    selected: [member],
  };
  const document = formatManagedFinancialScreenRecipe({
    name: "Exact criteria",
    capturedAt: "2026-10-23T00:00:00.000Z",
    catalogSnapshotSha256: "sha256:" + "a".repeat(64),
    criteria: DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
    listings: [previous],
  })!;
  return {
    file: parseManagedFinancialScreenRecipe(document.text)!,
    current,
    rows: [{ previous, current: member, status: "metadata_changed" as const }],
    canApply: true,
  };
}
it("shows the complete file/current criteria, catalog claims and all identity fields before explicit Apply", () => {
  const review = preview();
  const html = renderToStaticMarkup(
    <ScreenRecipeReviewView review={review} onApply={vi.fn()} />,
  );
  for (const text of [
    "Screen recipe review",
    "File criteria and sort",
    "Current applied criteria and sort",
    "Current selection in order",
    "unverified claims",
    "not current source authority",
    "Apply recipe definition",
    "OLD",
    "ZERO",
    "Old company name",
    review.current.catalogSnapshotSha256,
    review.file.catalogSnapshotSha256,
    "Issuer ID",
    "Security ID",
    "Share class ID",
    "Listing ID",
    "Exchange MIC",
    "Country",
    "Instrument type",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).toContain("No numerical criteria.");
  expect(html).toContain("No financial reports have been read");
  expect(html).toContain(
    "Run, research, Back and Watchlist Review and Save remain separate",
  );
});
it("shows missing current identity and refuses the entire Apply control", () => {
  const value = preview();
  const html = renderToStaticMarkup(
    <ScreenRecipeReviewView
      review={{
        ...value,
        canApply: false,
        rows: [{ ...value.rows[0]!, current: null, status: "missing" }],
      }}
      onApply={vi.fn()}
    />,
  );
  expect(html).toContain("Missing from the current cohort.");
  expect(html).toMatch(
    /<button[^>]*disabled=""[^>]*>Apply recipe definition<\/button>/u,
  );
});

it("keeps closed recipe fields outside the applied-criteria visibility boundary", () => {
  const model = new ManagedFinancialScreen(
    { resolve: vi.fn(), annualReport: vi.fn() },
    vi.fn(),
  );
  const html = renderToStaticMarkup(
    <ManagedFinancialScreenRecipes model={model} onApplied={vi.fn()} />,
  );
  expect(html).toContain('id="managed-screen-recipes"');
  expect(html).toContain('id="managed-screen-recipe-name"');
  expect(html).toContain('id="managed-screen-recipe-file"');
  expect(html.match(/class="managed-screen-recipe-field"/gu)).toHaveLength(2);
  expect(html).not.toContain('class="managed-screen-clause"');
});
