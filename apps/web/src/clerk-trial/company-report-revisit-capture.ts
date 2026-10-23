import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ResearchWatchlistState } from "./managed-workspace";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import type { CompanyEvidenceModels } from "./useCompanySnapshotEvidence";
import type { CompanyReportRevisitTarget } from "./company-report-revisit";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import {
  companyReportBlock,
  prepareCompanyReport,
} from "./managed-company-report";

export interface CompanyReportRevisitProps extends CompanyEvidenceModels {
  valuation?: ManagedValuationWorkbench;
  readWatchlist: (
    selection: ManagedResearchSelection,
  ) => ResearchWatchlistState;
  target: () => CompanyReportRevisitTarget | null;
}
function sourceSnapshots(props: CompanyReportRevisitProps) {
  return {
    price: props.price.getSnapshot(),
    annual: props.annual.getSnapshot(),
    filings: props.filings.getSnapshot(),
    valuation: props.valuation?.getSnapshot(),
  };
}
function sourceSnapshotsCurrent(
  props: CompanyReportRevisitProps,
  source: ReturnType<typeof sourceSnapshots>,
) {
  if (props.price.getSnapshot() !== source.price) return false;
  if (props.annual.getSnapshot() !== source.annual) return false;
  if (props.filings.getSnapshot() !== source.filings) return false;
  return props.valuation?.getSnapshot() === source.valuation;
}
/** Capture live models without starting a source or saved operation. */
export function captureCompanyReportRevisit(props: CompanyReportRevisitProps) {
  const target = props.target();
  if (!target) return null;
  if (!target.isCurrent()) return null;
  const source = sourceSnapshots(props);
  const watchlist = props.readWatchlist(props.selection);
  const evidence = companySnapshotEvidence(
    props.selection,
    source.price,
    source.annual,
    source.filings,
  );
  const calculation = source.valuation?.calculation ?? null;
  return {
    report: prepareCompanyReport(
      props.selection,
      evidence,
      watchlist,
      undefined,
      calculation,
    ),
    reason: companyReportBlock(
      props.selection,
      evidence,
      watchlist,
      calculation,
    ),
    isCurrent: () => {
      if (!target.isCurrent()) return false;
      return sourceSnapshotsCurrent(props, source);
    },
    append: target.append,
  };
}
