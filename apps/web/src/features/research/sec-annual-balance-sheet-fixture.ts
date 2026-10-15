import type {
  PersonalSecAnnualBalanceSheetDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualBalanceSheetMetric,
  PersonalSecAnnualBalanceSheetMetricEvidenceDto,
  PersonalSecAnnualBalanceSheetObservationDto,
  PersonalSecAnnualBalanceSheetResolutionInput,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualBalanceSheet } from "@research-cockpit/personal-financial-analytics";
import {
  compareObservations,
  hash,
} from "../../lib/sec-annual-response-validation";
import { row, response } from "./sec-annual-evidence-fixture";

type Context = Omit<
  PersonalSecAnnualBalanceSheetResolutionInput,
  "balanceSheet"
>;

/** Invented reported totals for component tests and isolated previews. */
export function balanceSheetRow(
  metric: PersonalSecAnnualBalanceSheetMetric,
  value: string,
  changes: Partial<
    Omit<PersonalSecAnnualBalanceSheetObservationDto, "metric" | "concept">
  > = {},
): PersonalSecAnnualBalanceSheetObservationDto {
  const pair =
    metric === "total_assets"
      ? { metric, concept: "Assets" as const }
      : metric === "total_liabilities"
        ? { metric, concept: "Liabilities" as const }
        : { metric, concept: "StockholdersEquity" as const };
  return {
    ...row(),
    ...pair,
    value,
    startDate: null,
    durationDays: null,
    frame: "CY2025Q4I",
    sourceLocator: `/facts/us-gaap/${pair.concept}/units/USD/0`,
    ...changes,
  };
}

export async function balanceSheet(
  input: Context,
  rows: readonly PersonalSecAnnualBalanceSheetObservationDto[] = [],
): Promise<PersonalSecAnnualBalanceSheetDto> {
  const metric = async (
    name: PersonalSecAnnualBalanceSheetMetric,
  ): Promise<PersonalSecAnnualBalanceSheetMetricEvidenceDto> => {
    if (input.generation.sources.companyFacts.status !== "available")
      return {
        scan: { status: "source_unavailable", absence: null, coverage: null },
        observations: [],
      };
    const all = await Promise.all(
      rows
        .filter((item) => item.metric === name)
        .map(async (item) => {
          const fields = Object.fromEntries(
            Object.entries(item).filter(
              ([key]) => !["id", "sourceLocator", "filing"].includes(key),
            ),
          );
          return {
            ...item,
            id: `sec-fact:${(await hash(JSON.stringify(fields))).slice(7)}` as const,
          };
        }),
    );
    const target = input.target;
    const selected =
      target.status === "target"
        ? all
            .filter((item) => item.accessionNumber === target.accessionNumber)
            .sort(compareObservations)
        : [];
    const observations = selected.length > 100 ? [] : selected;
    return {
      scan: {
        status: "available",
        absence: all.length === 0 ? "concept_missing" : null,
        coverage: {
          full: {
            candidateRows: all.length,
            inspectedRows: all.length,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: all.length,
          },
          selected: target.status === "target" ? selected.length : null,
          otherAccessions:
            target.status === "target" ? all.length - selected.length : null,
          returned: observations.length,
          omittedSelected:
            target.status === "target"
              ? selected.length - observations.length
              : null,
        },
      },
      observations,
    };
  };
  const balances = {
    totalAssets: await metric("total_assets"),
    totalLiabilities: await metric("total_liabilities"),
    shareholdersEquity: await metric("shareholders_equity"),
  };
  return {
    ...balances,
    resolution: resolvePersonalSecAnnualBalanceSheet({
      cik: input.cik,
      generation: input.generation,
      target: input.target,
      balanceSheet: balances,
    }),
  };
}

export async function balanceSheetResponse(
  rows: readonly PersonalSecAnnualBalanceSheetObservationDto[],
  cutoffAt?: string,
): Promise<PersonalSecAnnualEvidenceResponseDto> {
  const base = await response(undefined, cutoffAt);
  return {
    ...base,
    evidence: {
      ...base.evidence,
      balanceSheet: await balanceSheet(base.evidence, rows),
    },
  };
}
