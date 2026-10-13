import type {
  PersonalSecAnnualLiquidityDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualLiquidityMetricEvidenceDto,
  PersonalSecAnnualLiquidityObservationDto,
  PersonalSecAnnualLiquidityResolutionInput,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualLiquidity } from "@research-cockpit/personal-financial-analytics";
import {
  compareObservations,
  hash,
} from "../../lib/sec-annual-response-validation";
import { row, response } from "./sec-annual-evidence-fixture";

type Context = Omit<PersonalSecAnnualLiquidityResolutionInput, "liquidity">;

/** Invented instant liquidity inputs shared by component tests and isolated previews. */
export function liquidityRow(
  metric: "current_assets" | "current_liabilities",
  value: string,
  changes: Partial<
    Omit<PersonalSecAnnualLiquidityObservationDto, "metric" | "concept">
  > = {},
): PersonalSecAnnualLiquidityObservationDto {
  const pair =
    metric === "current_assets"
      ? {
          metric,
          concept: "AssetsCurrent" as const,
        }
      : {
          metric,
          concept: "LiabilitiesCurrent" as const,
        };
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

export async function liquidity(
  input: Context,
  rows: readonly PersonalSecAnnualLiquidityObservationDto[] = [],
): Promise<PersonalSecAnnualLiquidityDto> {
  const metric = async (
    name: "current_assets" | "current_liabilities",
  ): Promise<PersonalSecAnnualLiquidityMetricEvidenceDto> => {
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
    const observations =
      target.status === "target"
        ? all
            .filter((item) => item.accessionNumber === target.accessionNumber)
            .sort(compareObservations)
        : [];
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
          selected: target.status === "target" ? observations.length : null,
          otherAccessions:
            target.status === "target"
              ? all.length - observations.length
              : null,
          returned: observations.length,
          omittedSelected: target.status === "target" ? 0 : null,
        },
      },
      observations,
    };
  };
  const balances = {
    currentAssets: await metric("current_assets"),
    currentLiabilities: await metric("current_liabilities"),
  };
  return {
    ...balances,
    resolution: resolvePersonalSecAnnualLiquidity({
      ...input,
      liquidity: balances,
    }),
  };
}

export async function liquidityResponse(
  rows: readonly PersonalSecAnnualLiquidityObservationDto[],
  cutoffAt?: string,
): Promise<PersonalSecAnnualEvidenceResponseDto> {
  const base = await response(undefined, cutoffAt);
  return {
    ...base,
    evidence: {
      ...base.evidence,
      liquidity: await liquidity(base.evidence, rows),
    },
  };
}
