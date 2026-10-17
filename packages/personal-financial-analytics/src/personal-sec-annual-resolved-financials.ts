import type {
  PersonalSecAnnualBalanceSheetResolutionDto,
  PersonalSecAnnualCashResolutionDto,
  PersonalSecAnnualLiquidityResolutionDto,
  PersonalSecAnnualOperatingResolutionDto,
} from "@research-cockpit/contracts";

/** Resolved cells only. Raw evidence and transport admission have separate owners. */
export interface PersonalSecAnnualResolvedFinancials {
  readonly cashGeneration: Readonly<{
    resolution: PersonalSecAnnualCashResolutionDto;
  }>;
  readonly liquidity: Readonly<{
    resolution: PersonalSecAnnualLiquidityResolutionDto;
  }>;
  readonly operatingResults: Readonly<{
    resolution: PersonalSecAnnualOperatingResolutionDto;
  }>;
  readonly balanceSheet: Readonly<{
    resolution: PersonalSecAnnualBalanceSheetResolutionDto;
  }>;
}
