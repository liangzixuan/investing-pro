import {
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "@research-cockpit/contracts";
import { annualComparisonMemberships } from "../../src/clerk-trial/test-canonical-annual-comparison-fixture";
import type { SharedNativeFixture } from "./fixture";
import { valuationFollowupOriginal } from "./valuation-scenario-followup-fixture";

export const comparisonFollowupQuestion =
  "Does this comparison change my ONE research? Café 東京 📈";
export const comparisonFollowupDueOn = "2026-12-31";
export const comparisonFollowupNote =
  "Independent comparison Watchlist draft Café 東京 📈";

/** Independent literal oracle. No product formatter or captured source packet is used. */
export function comparisonFollowupCheck(preparedAt: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(preparedAt) ||
    new Date(preparedAt).toISOString() !== preparedAt
  )
    throw new Error("Invalid invented comparison capture clock");
  return (
    "Question: Does this comparison change my ONE research? Café 東京 📈" +
    " | Comparison reference: listing-zero / listing-one; captured " +
    preparedAt +
    ". Full criteria, statements and source evidence not included."
  );
}

export function comparisonFollowupOriginal(
  base: SharedNativeFixture,
): ResearchFollowupsPayload {
  return valuationFollowupOriginal(base);
}

/** Only the authored canonical timestamp and generated entry ID vary. */
export function comparisonFollowupExpected(
  base: SharedNativeFixture,
  entry: { readonly id: string; readonly check: string },
): ResearchFollowupsPayload | null {
  const clock = entry.check.match(
    /; captured (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\. Full criteria, statements and source evidence not included\.$/u,
  )?.[1];
  if (!clock) return null;
  let check: string;
  try {
    check = comparisonFollowupCheck(clock);
  } catch {
    return null;
  }
  const { note: _note, ...listing } = annualComparisonMemberships.right;
  void _note;
  return parseResearchFollowupsPayload({
    ...comparisonFollowupOriginal(base),
    entries: [
      ...comparisonFollowupOriginal(base).entries,
      {
        id: entry.id,
        listing,
        catalogSnapshotSha256: base.researchCoverage.catalogSnapshotSha256,
        check,
        dueOn: comparisonFollowupDueOn,
        status: "open",
        completedOn: null,
        result: "",
      },
    ],
  });
}
