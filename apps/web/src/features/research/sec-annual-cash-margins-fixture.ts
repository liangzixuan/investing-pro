import type {
  PersonalSecAnnualCashObservationDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { request, response, row } from "./sec-annual-evidence-fixture";
import { cashGeneration, cashRow } from "./sec-annual-cash-fixture";
import { parseSecAnnualEvidenceResponse } from "../../lib/sec-annual-evidence-response";

export interface CashMarginsFixtureOptions {
  readonly revenueRows?: readonly PersonalSecQuarterlyObservationDto[];
  readonly cashRows?: readonly PersonalSecAnnualCashObservationDto[];
  readonly cutoffAt?: string;
}

/** Invented source packet, admitted through the real Annual v5 decoder. */
export async function cashMarginsResponse(
  options: CashMarginsFixtureOptions = {},
): Promise<PersonalSecAnnualEvidenceResponseDto> {
  const base = await response(
    [
      ...(options.revenueRows ?? [
        row("Revenues", "1000"),
        row("RevenueFromContractWithCustomerExcludingAssessedTax", "500"),
        row("SalesRevenueNet", "800"),
      ]),
    ],
    options.cutoffAt,
  );
  const packet = {
    ...base,
    evidence: {
      ...base.evidence,
      cashGeneration: await cashGeneration(
        base.evidence,
        options.cashRows ?? [
          cashRow("operating_cash_flow", "120.125"),
          cashRow("ppe_purchases", "20.025"),
        ],
      ),
    },
  };
  const admitted = await parseSecAnnualEvidenceResponse(
    packet,
    request(),
    new AbortController().signal,
  );
  if (!admitted) throw new Error("Invalid invented cash margin packet");
  return admitted;
}
