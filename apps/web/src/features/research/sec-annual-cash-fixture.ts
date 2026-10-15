import type {
  PersonalSecAnnualCashGenerationDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualCashMetricEvidenceDto,
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualCashResolutionInput,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualCashGeneration } from "@research-cockpit/personal-financial-analytics";
import {
  compareObservations,
  hash,
} from "../../lib/sec-annual-response-validation";
import { row, response } from "./sec-annual-evidence-fixture";

type Context = Omit<PersonalSecAnnualCashResolutionInput, "cashGeneration">;

/** Invented cash inputs shared by component tests and isolated previews. */
export function cashRow(
  metric: "operating_cash_flow" | "ppe_purchases",
  value: string,
  changes: Partial<
    Omit<PersonalSecAnnualCashObservationDto, "metric" | "concept">
  > = {},
): PersonalSecAnnualCashObservationDto {
  const pair =
    metric === "operating_cash_flow"
      ? {
          metric,
          concept: "NetCashProvidedByUsedInOperatingActivities" as const,
        }
      : {
          metric,
          concept: "PaymentsToAcquirePropertyPlantAndEquipment" as const,
        };
  return {
    ...row(),
    ...pair,
    value,
    sourceLocator: `/facts/us-gaap/${pair.concept}/units/USD/0`,
    ...changes,
  };
}

export async function cashGeneration(
  input: Context,
  rows: readonly PersonalSecAnnualCashObservationDto[] = [],
): Promise<PersonalSecAnnualCashGenerationDto> {
  const metric = async (
    name: "operating_cash_flow" | "ppe_purchases",
  ): Promise<PersonalSecAnnualCashMetricEvidenceDto> => {
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
  const cash = {
    operatingCashFlow: await metric("operating_cash_flow"),
    ppePurchases: await metric("ppe_purchases"),
  };
  return {
    ...cash,
    resolution: resolvePersonalSecAnnualCashGeneration({
      ...input,
      cashGeneration: cash,
    }),
  };
}

/** Same-filing invented comparatives; current cash and note references stay unchanged. */
export function annualCashHistoryRows(): PersonalSecAnnualCashObservationDto[] {
  return [
    cashRow("operating_cash_flow", "120.125"),
    cashRow("ppe_purchases", "20.025"),
    ...(
      [
        ["2024-01-01", "2024-12-31", 366, "-50", "0"],
        ["2023-01-01", "2023-12-31", 365, "500", "750"],
      ] as const
    ).flatMap(
      ([startDate, endDate, durationDays, operating, purchases], index) =>
        (
          [
            ["operating_cash_flow", operating],
            ["ppe_purchases", purchases],
          ] as const
        ).map(([metric, value]) => {
          const observation = cashRow(metric, value, {
            startDate,
            endDate,
            durationDays,
            frame: `CY${endDate.slice(0, 4)}`,
          });
          return {
            ...observation,
            sourceLocator: observation.sourceLocator.replace(
              /\/0$/u,
              `/${index + 1}`,
            ),
          };
        }),
    ),
  ];
}

export async function cashResponse(
  rows: readonly PersonalSecAnnualCashObservationDto[],
  cutoffAt?: string,
): Promise<PersonalSecAnnualEvidenceResponseDto> {
  const base = await response(undefined, cutoffAt);
  return {
    ...base,
    evidence: {
      ...base.evidence,
      cashGeneration: await cashGeneration(base.evidence, rows),
    },
  };
}
