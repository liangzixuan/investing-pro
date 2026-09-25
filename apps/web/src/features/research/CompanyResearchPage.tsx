import type { ComponentProps } from "react";
import {
  PersonalCompanyResearchWorkspace,
  type PersonalCompanyResearchWorkspaceProps,
} from "./PersonalCompanyResearchWorkspace";
import { PersonalCompanyOverview } from "./PersonalCompanyOverview";
import { PersonalMarketOverview } from "./PersonalMarketOverview";
import { PersonalAnnualFinancials } from "./PersonalAnnualFinancials";
import { PersonalQuarterlyFinancials } from "./PersonalQuarterlyFinancials";
import { PersonalFinancialQualityScorecard } from "./PersonalFinancialQualityScorecard";
import { PersonalValuationHistory } from "./PersonalValuationHistory";
import { PersonalHistoricalMultipleValuation } from "./PersonalHistoricalMultipleValuation";
import { PersonalSavedFcffDcfValuation } from "./PersonalSavedFcffDcfValuation";
import { PersonalSavedManualPeerGroupControls } from "./PersonalSavedManualPeerGroupControls";
import { PersonalManualPeerComparison } from "./PersonalManualPeerComparison";
import { PersonalSecAnnualEvidence } from "./PersonalSecAnnualEvidence";
import { PersonalSecQuarterlyEvidence } from "./PersonalSecQuarterlyEvidence";

export interface CompanyResearchPageProps extends Omit<
  PersonalCompanyResearchWorkspaceProps,
  "sections" | "overview"
> {
  readonly overview: ComponentProps<typeof PersonalCompanyOverview>;
  readonly market: ComponentProps<typeof PersonalMarketOverview>;
  readonly annual: ComponentProps<typeof PersonalAnnualFinancials>;
  readonly quarterly: ComponentProps<typeof PersonalQuarterlyFinancials>;
  readonly quality: ComponentProps<typeof PersonalFinancialQualityScorecard>;
  readonly valuation: ComponentProps<typeof PersonalValuationHistory>;
  readonly historicalMultiple: ComponentProps<
    typeof PersonalHistoricalMultipleValuation
  >;
  readonly dcf: ComponentProps<typeof PersonalSavedFcffDcfValuation>;
  readonly savedPeers: ComponentProps<
    typeof PersonalSavedManualPeerGroupControls
  >;
  readonly peers: ComponentProps<typeof PersonalManualPeerComparison>;
  readonly secAnnual: ComponentProps<typeof PersonalSecAnnualEvidence>;
  readonly secQuarterly: ComponentProps<typeof PersonalSecQuarterlyEvidence>;
}

export function CompanyResearchPage({
  overview,
  market,
  annual,
  quarterly,
  quality,
  valuation,
  historicalMultiple,
  dcf,
  savedPeers,
  peers,
  secAnnual,
  secQuarterly,
  ...workspace
}: CompanyResearchPageProps) {
  return (
    <PersonalCompanyResearchWorkspace
      {...workspace}
      overview={<PersonalCompanyOverview {...overview} />}
      sections={{
        price: <PersonalMarketOverview {...market} />,
        financials: (
          <>
            <PersonalAnnualFinancials {...annual} />
            <PersonalQuarterlyFinancials {...quarterly} />
            <PersonalFinancialQualityScorecard {...quality} />
          </>
        ),
        valuation: (
          <>
            <PersonalValuationHistory {...valuation} />
            <PersonalHistoricalMultipleValuation {...historicalMultiple} />
            <PersonalSavedFcffDcfValuation {...dcf} />
          </>
        ),
        peers: (
          <>
            <PersonalSavedManualPeerGroupControls {...savedPeers} />
            <PersonalManualPeerComparison {...peers} />
          </>
        ),
        sec: (
          <>
            <PersonalSecAnnualEvidence {...secAnnual} />
            <PersonalSecQuarterlyEvidence {...secQuarterly} />
          </>
        ),
      }}
    />
  );
}
