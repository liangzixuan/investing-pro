import type {
  PersonalSecAnnualOperatingObservationDto,
  PersonalSecAnnualOperatingResultsDto,
  PersonalSecAnnualResolutionInput,
} from "@research-cockpit/contracts";
import { resolvePersonalSecAnnualOperatingResults } from "@research-cockpit/personal-financial-analytics";
import {
  compareObservations,
  hash,
} from "../../lib/sec-annual-response-validation";
import { row, response } from "./sec-annual-evidence-fixture";

/** Invented operating-income facts; no source fetch or persistence. */
export function operatingRow(
  value = "250",
  changes: Partial<PersonalSecAnnualOperatingObservationDto> = {},
): PersonalSecAnnualOperatingObservationDto {
  return {
    ...row(),
    metric: "operating_income",
    concept: "OperatingIncomeLoss",
    value,
    sourceLocator: "/facts/us-gaap/OperatingIncomeLoss/units/USD/0",
    ...changes,
  };
}

export async function operatingResults(
  input: PersonalSecAnnualResolutionInput,
  rows: readonly PersonalSecAnnualOperatingObservationDto[] = [],
): Promise<PersonalSecAnnualOperatingResultsDto> {
  if (input.generation.sources.companyFacts.status !== "available") {
    const operatingIncome = {
      scan: {
        status: "source_unavailable" as const,
        absence: null,
        coverage: null,
      },
      observations: [],
    };
    return {
      operatingIncome,
      resolution: resolvePersonalSecAnnualOperatingResults({
        ...input,
        operatingResults: { operatingIncome },
      }),
    };
  }
  const all = await Promise.all(
    rows.map(async (item) => {
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
  const operatingIncome = {
    scan: {
      status: "available" as const,
      absence: all.length ? null : ("concept_missing" as const),
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
          target.status === "target" ? all.length - observations.length : null,
        returned: observations.length,
        omittedSelected: target.status === "target" ? 0 : null,
      },
    },
    observations,
  };
  return {
    operatingIncome,
    resolution: resolvePersonalSecAnnualOperatingResults({
      ...input,
      operatingResults: { operatingIncome },
    }),
  };
}

export async function operatingResponse(
  rows = [operatingRow()],
  incomeRows = [row(), row("NetIncomeLoss", "100")],
  cutoffAt?: string,
) {
  const base = await response(incomeRows, cutoffAt);
  return {
    ...base,
    evidence: {
      ...base.evidence,
      operatingResults: await operatingResults(base.evidence, rows),
    },
  };
}
