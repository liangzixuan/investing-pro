export type DataMode = "synthetic";
export type QualityState = "verified_fixture" | "restated_fixture";
export type MetricUnit =
  "USD_MILLIONS" | "USD_PER_SHARE" | "MILLIONS_SHARES" | "PERCENT" | "RATIO";

export interface InstrumentDto {
  id: string;
  symbol: string;
  name: string;
  description: string;
  exchangeLabel: string;
  sector: string;
  industry: string;
  country: string;
  currency: "USD";
  isSynthetic: true;
}

export interface MetricDto {
  key: string;
  label: string;
  category:
    "scale" | "growth" | "profitability" | "cash" | "leverage" | "market";
  value: string;
  displayValue: string;
  unit: MetricUnit;
  definitionId: string;
  definitionVersion: string;
  formula: string;
  formulaInputs: string[];
  evidenceIds: string[];
  qualityState: QualityState;
  asOf: string;
}

export interface HistoricalPointDto {
  period: string;
  revenue: string;
  ebitda: string;
  revenueDisplay: string;
  ebitdaDisplay: string;
  evidenceIds: string[];
}

export interface TimelineEventDto {
  id: string;
  occurredAt: string;
  kind: "filing" | "restatement";
  title: string;
  summary: string;
  evidenceIds: string[];
}

export interface EvidencePassportDto {
  id: string;
  title: string;
  sourceType: "synthetic_filing" | "synthetic_price_record";
  documentId: string;
  locator: string;
  excerpt: string;
  contentHash: string;
  /** Underlying synthetic source-publication time. */
  availableAt: string;
  /** Half-open public-knowledge interval; not database system time. */
  knownFrom: string;
  knownTo: string | null;
  rightsPolicyId: string;
  rightsPolicyVersion: string;
  synthetic: true;
}

export interface OmissionSummaryDto {
  hasOmissions: boolean;
  /** Exact in memory; nullable when a future repository cannot disclose a count. */
  count: number | null;
  reasonCode: "RIGHTS_DENIED";
  explanation: string;
}

export interface ValuationDefaultsDto {
  baseRevenue: string;
  cash: string;
  debt: string;
  dilutedShares: string;
  evidenceIds: string[];
  modelVersion: "exit-multiple-v1";
}

export interface DossierDto {
  schemaVersion: "1.0.0";
  dataMode: DataMode;
  demoDisclosure: string;
  requestedKnownAt: string;
  generatedAt: string;
  instrument: InstrumentDto;
  metrics: MetricDto[];
  history: HistoricalPointDto[];
  timeline: TimelineEventDto[];
  evidence: EvidencePassportDto[];
  valuationDefaults: ValuationDefaultsDto;
  omissions: OmissionSummaryDto;
}

export interface PersonalFilingReadinessDto {
  schemaVersion: "1.0.0";
  profile: "personal_single_user_local";
  status: "quality_gate_ready";
  dataPlane: "disabled";
}

export type PersonalSecurityMasterContentKindDto =
  "owner_local_source" | "synthetic_engineering";

export type PersonalSecurityMasterInstrumentTypeDto = "adr" | "common_stock";

export type PersonalSecurityMasterSearchMatchKindDto =
  | "current_symbol_exact"
  | "current_symbol_prefix"
  | "former_symbol_exact"
  | "former_symbol_prefix"
  | "name_exact"
  | "name_token_prefix"
  | "name_contains";

export interface PersonalSecurityMasterCoverageDto {
  readonly activeEligibleSecurities: number;
  readonly activeListings: number;
  readonly admittedSourceRecords: number;
  readonly basis:
    | "owner_declared_snapshot_only"
    | "synthetic_engineering_only_not_real_universe";
  readonly eligibleSecurityBand:
    "at_least_3000" | "from_1000_to_2999" | "under_1000";
  readonly formerTickerEntries: number;
  readonly ineligibleSourceRecords: number;
  readonly inactiveSecurities: number;
  readonly issuers: number;
  readonly providerMappings: number;
  readonly quarantinedSourceRecords: number;
  readonly sourceRecords: number;
  readonly staleSourceRecords: number;
  readonly shareClasses: number;
  readonly totalSecurities: number;
  readonly unsupportedSourceRecords: number;
}

export interface PersonalSecurityMasterSnapshotReceiptDto {
  readonly asOf: string;
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly claim: "bounded_exact_owner_local_security_master_snapshot_admitted";
  readonly coverage: PersonalSecurityMasterCoverageDto;
  readonly generatedAt: string;
  readonly profile: "personal_single_user_local_security_master";
  readonly provenance: Readonly<{
    acquiredAt: string;
    artifacts: readonly Readonly<{
      acquiredAt: string;
      artifactId: string;
      contentSha256: `sha256:${string}`;
      mediaType:
        | "application/json"
        | "application/zip"
        | "text/csv"
        | "text/html"
        | "text/plain";
      sourceUri: string;
      sourceVersion: string;
    }>[];
    attribution: string;
    contentKind: PersonalSecurityMasterContentKindDto;
    sourceId: string;
    sourceRevision: `sha256:${string}`;
  }>;
  readonly schemaVersion: "1.0.0";
  readonly snapshotSha256: `sha256:${string}`;
  readonly sourcePolicyCompatibility: Readonly<{
    attribution: "required";
    cache: "permitted_owner_local";
    decision: "compatible";
    deleteOnRequest: true;
    display: "permitted_owner_local";
    effectiveAt: string;
    expiresAt: string;
    export: "prohibited";
    intendedUse: "personal_security_research";
    localOnly: true;
    operation: "fetch_snapshot";
    policyDocumentSha256: `sha256:${string}`;
    policyId: string;
    policyProfile: "personal_single_user_local_connected";
    policySchemaVersion: "1.0.0";
    policyVersion: string;
    redistribution: "prohibited";
    retention: "permitted_owner_local";
    reviewedAt: string;
    revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation";
    revokedAt: null;
    rightsBasis: "owner_reviewed_rights_compatible";
    search: "permitted_owner_local";
    sourceId: string;
  }>;
  readonly status: "admitted_for_personal_local_search";
}

export interface PersonalSecurityMasterStatusDto {
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
}

export interface PersonalSecurityMasterSearchResultDto {
  readonly cik: string;
  readonly country: "US";
  readonly exchangeMic: string;
  readonly instrumentType: PersonalSecurityMasterInstrumentTypeDto;
  readonly issuerId: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly matchKind: PersonalSecurityMasterSearchMatchKindDto;
  readonly matchedValue: string;
  readonly securityId: string;
  readonly securityName: string;
  readonly shareClassId: string;
  readonly shareClassName: string;
  readonly symbol: string;
}

export interface PersonalSecurityMasterSearchResponseDto {
  readonly limitApplied: number;
  readonly normalizedQuery: string;
  readonly results: readonly PersonalSecurityMasterSearchResultDto[];
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
  readonly totalMatches: number;
}

export type PersonalSecurityMasterScreenClauseDto =
  | Readonly<{
      field: "identity_text";
      operator: "matches";
      value: string;
    }>
  | Readonly<{
      field: "exchange_mic";
      operator: "in";
      values: readonly string[];
    }>
  | Readonly<{
      field: "instrument_type";
      operator: "in";
      values: readonly PersonalSecurityMasterInstrumentTypeDto[];
    }>
  | Readonly<{
      field: "cik";
      operator: "equals";
      value: string;
    }>;

export interface PersonalSecurityMasterScreenQueryDto {
  readonly clauses: readonly PersonalSecurityMasterScreenClauseDto[];
  readonly operator: "and";
}

export type PersonalSecurityMasterScreenSortFieldDto =
  "cik" | "exchange_mic" | "instrument_type" | "issuer_name" | "symbol";

export type PersonalSecurityMasterScreenSortDirectionDto = "asc" | "desc";

export interface PersonalSecurityMasterScreenSortDto {
  readonly direction: PersonalSecurityMasterScreenSortDirectionDto;
  readonly field: PersonalSecurityMasterScreenSortFieldDto;
}

export interface PersonalSecurityMasterScreenPageDto {
  readonly limit: number;
  readonly offset: number;
}

export interface PersonalSecurityMasterScreenRequestDto {
  readonly page: PersonalSecurityMasterScreenPageDto;
  readonly query: PersonalSecurityMasterScreenQueryDto;
  readonly schemaVersion: "1.0.0";
  readonly snapshotSha256: `sha256:${string}`;
  readonly sort: PersonalSecurityMasterScreenSortDto;
}

export interface PersonalSecurityMasterScreenRowDto {
  readonly cik: string;
  readonly country: "US";
  readonly exchangeMic: string;
  readonly instrumentType: PersonalSecurityMasterInstrumentTypeDto;
  readonly issuerId: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityId: string;
  readonly securityName: string;
  readonly shareClassId: string;
  readonly shareClassName: string;
  readonly symbol: string;
}

export interface PersonalSecurityMasterScreenResponseDto {
  readonly hasMore: boolean;
  readonly limitApplied: number;
  readonly offset: number;
  readonly rows: readonly PersonalSecurityMasterScreenRowDto[];
  readonly schemaVersion: "1.0.0";
  readonly snapshot: PersonalSecurityMasterSnapshotReceiptDto;
  readonly snapshotSha256: `sha256:${string}`;
  readonly totalMatches: number;
  readonly totalUniverse: number;
}

export type PersonalScreenerSavedColumnDto =
  "cik" | "exchange_mic" | "instrument_type" | "issuer_name" | "symbol";

export interface PersonalScreenerSavedViewDto {
  readonly columns: readonly PersonalScreenerSavedColumnDto[];
  readonly createdAgainstSnapshotSha256: `sha256:${string}`;
  readonly id: string;
  readonly name: string;
  readonly query: PersonalSecurityMasterScreenQueryDto;
  readonly sort: PersonalSecurityMasterScreenSortDto;
}

export interface PersonalScreenerSavedViewsPayloadDto {
  readonly schemaVersion: 1;
  readonly views: readonly PersonalScreenerSavedViewDto[];
}

export interface PersonalScreenerSavedViewsRecordDto {
  readonly createdAt: string;
  readonly id: "stock-screener-saved-views";
  readonly kind: "settings";
  readonly payload: PersonalScreenerSavedViewsPayloadDto;
  readonly payloadSha256: string;
  readonly profile: "personal_single_user_local_vault";
  readonly updatedAt: string;
  readonly version: number;
}

export interface PersonalScreenerSavedViewsMutationReceiptDto {
  readonly committedAt: string;
  readonly digestSha256: string;
  readonly id: "stock-screener-saved-views";
  readonly kind: "settings";
  readonly operation: "put";
  readonly profile: "personal_single_user_local_vault";
  readonly replayed: boolean;
  readonly version: number;
}

export type PersonalMarketDataRangeDto =
  "1m" | "3m" | "ytd" | "1y" | "5y" | "10y";

export interface PersonalMarketDataProviderDto {
  readonly attribution: "Tiingo";
  readonly export: "prohibited";
  readonly historyFeed: "tiingo_eod_composite";
  readonly id: "tiingo";
  readonly name: "Tiingo";
  readonly persistence: "none";
  readonly quoteFeed: "tiingo_iex_derived_reference";
  readonly redistribution: "prohibited";
  readonly retention: "active_owner_session_memory_only";
}

export interface PersonalMarketDataStatusDto {
  readonly profile: "personal_single_user_local_market_data";
  readonly provider: PersonalMarketDataProviderDto;
  readonly schemaVersion: "1.0.0";
  readonly status: "configured" | "not_configured";
}

export interface PersonalMarketDataIdentityDto {
  readonly country: "US";
  readonly exchangeMic: string;
  readonly issuerName: string;
  readonly listingId: string;
  readonly securityName: string;
  readonly symbol: string;
}

export interface PersonalMarketDataQuoteDto {
  readonly change: string | null;
  readonly changePercent: string | null;
  readonly currency: "USD";
  readonly freshness: "current" | "older_than_36_hours";
  readonly ingestedAt: string;
  readonly kind: "derived_realtime_reference" | "end_of_day_close";
  readonly previousClose: string | null;
  readonly price: string;
  readonly sourceTime: string;
}

export interface PersonalMarketDataOhlcvDto {
  readonly close: string;
  readonly high: string;
  readonly low: string;
  readonly open: string;
  readonly volume: string;
}

export interface PersonalMarketDataDailyBarDto {
  readonly adjusted: PersonalMarketDataOhlcvDto;
  readonly date: string;
  readonly dividendCash: string;
  readonly raw: PersonalMarketDataOhlcvDto;
  readonly splitFactor: string;
}

export interface PersonalMarketOverviewDto {
  readonly history: Readonly<{
    bars: readonly PersonalMarketDataDailyBarDto[];
    endDate: string;
    range: PersonalMarketDataRangeDto;
    startDate: string;
  }>;
  readonly profile: "personal_single_user_local_market_data";
  readonly provider: PersonalMarketDataProviderDto;
  readonly quote: PersonalMarketDataQuoteDto;
  readonly schemaVersion: "1.0.0";
  readonly security: PersonalMarketDataIdentityDto;
  readonly status: "available";
}

export type PersonalAnnualFinancialReportedFieldKeyDto =
  | "accounts_receivable"
  | "assets"
  | "capital_expenditures"
  | "cash"
  | "cost_of_revenue"
  | "current_assets"
  | "current_liabilities"
  | "debt"
  | "depreciation_and_amortization"
  | "ebitda"
  | "financing_cash_flow"
  | "free_cash_flow"
  | "gross_profit"
  | "income_tax_expense"
  | "intangibles"
  | "inventory"
  | "investing_cash_flow"
  | "liabilities"
  | "net_income"
  | "operating_cash_flow"
  | "operating_expenses"
  | "operating_income"
  | "pretax_income"
  | "property_plant_equipment_net"
  | "research_and_development"
  | "revenue"
  | "selling_general_and_administrative"
  | "share_based_compensation"
  | "shareholders_equity"
  | "interest_expense";

export type PersonalAnnualFinancialReportedCellDto =
  | Readonly<{
      status: "known";
      value: string;
    }>
  | Readonly<{
      reason: "not_supplied_by_provider";
      status: "unknown";
      value: null;
    }>;

export type PersonalAnnualFinancialReportedValuesDto = Readonly<
  Record<
    PersonalAnnualFinancialReportedFieldKeyDto,
    PersonalAnnualFinancialReportedCellDto
  >
>;

export interface PersonalAnnualFinancialYearDto {
  readonly fiscalYear: number;
  readonly reported: PersonalAnnualFinancialReportedValuesDto;
  readonly statementDate: string;
}

export interface PersonalAnnualFinancialsProviderDto {
  readonly attribution: "Tiingo";
  readonly export: "prohibited";
  readonly id: "tiingo";
  readonly name: "Tiingo";
  readonly persistence: "none";
  readonly redistribution: "prohibited";
  readonly retention: "active_owner_session_memory_only";
  readonly revisionBasis: "provider_most_recent";
  readonly statementFeed: "tiingo_fundamentals_statements";
  readonly valueCurrency: "USD";
}

export interface PersonalAnnualFinancialsCoverageDto {
  readonly earliestFiscalYear: number;
  readonly knownReportedCells: number;
  readonly latestFiscalYear: number;
  readonly missingFiscalYears: readonly number[];
  readonly requestedAnnualYears: 10;
  readonly returnedAnnualYears: number;
  readonly status: "complete" | "partial";
  readonly unknownReportedCells: number;
}

export interface PersonalAnnualFinancialsDto {
  readonly asOf: string;
  readonly coverage: PersonalAnnualFinancialsCoverageDto;
  readonly profile: "personal_single_user_local_fundamentals";
  readonly provider: PersonalAnnualFinancialsProviderDto;
  readonly schemaVersion: "1.1.0";
  readonly security: PersonalMarketDataIdentityDto;
  readonly status: "available";
  readonly years: readonly PersonalAnnualFinancialYearDto[];
}

export type PersonalQuarterlyFinancialReportedFieldKeyDto =
  PersonalAnnualFinancialReportedFieldKeyDto;

export type PersonalQuarterlyFinancialReportedCellDto =
  PersonalAnnualFinancialReportedCellDto;

export type PersonalQuarterlyFinancialReportedValuesDto =
  PersonalAnnualFinancialReportedValuesDto;

export type PersonalQuarterlyFinancialsProviderDto =
  PersonalAnnualFinancialsProviderDto;

export interface PersonalFiscalQuarterDto {
  readonly fiscalQuarter: 1 | 2 | 3 | 4;
  readonly fiscalYear: number;
}

export interface PersonalQuarterlyFinancialQuarterDto extends PersonalFiscalQuarterDto {
  readonly reported: PersonalQuarterlyFinancialReportedValuesDto;
  readonly statementDate: string;
}

export interface PersonalQuarterlyFinancialsCoverageDto {
  readonly earliestFiscalQuarter: 1 | 2 | 3 | 4;
  readonly earliestFiscalYear: number;
  readonly knownReportedCells: number;
  readonly latestFiscalQuarter: 1 | 2 | 3 | 4;
  readonly latestFiscalYear: number;
  readonly missingFiscalQuarters: readonly PersonalFiscalQuarterDto[];
  readonly requestedQuarterlyPeriods: 16;
  readonly returnedQuarterlyPeriods: number;
  readonly status: "complete" | "partial";
  readonly unknownReportedCells: number;
}

export interface PersonalQuarterlyFinancialsDto {
  readonly asOf: string;
  readonly coverage: PersonalQuarterlyFinancialsCoverageDto;
  readonly profile: "personal_single_user_local_fundamentals";
  readonly provider: PersonalQuarterlyFinancialsProviderDto;
  readonly quarters: readonly PersonalQuarterlyFinancialQuarterDto[];
  readonly schemaVersion: "1.0.0";
  readonly security: PersonalMarketDataIdentityDto;
  readonly status: "available";
}

export type PersonalValuationMoneyCellDto =
  | Readonly<{
      status: "known";
      unit: "USD";
      value: string;
    }>
  | Readonly<{
      reason: "not_supplied_by_provider";
      status: "unknown";
      unit: "USD";
      value: null;
    }>;

export type PersonalValuationRatioCellDto =
  | Readonly<{
      status: "known";
      unit: "ratio";
      value: string;
    }>
  | Readonly<{
      reason: "not_supplied_by_provider";
      status: "unknown";
      unit: "ratio";
      value: null;
    }>;

export interface PersonalValuationHistoryPointDto {
  readonly date: string;
  readonly enterpriseValue: PersonalValuationMoneyCellDto;
  readonly marketCapitalization: PersonalValuationMoneyCellDto;
  readonly priceToBook: PersonalValuationRatioCellDto;
  readonly priceToEarnings: PersonalValuationRatioCellDto;
  readonly trailingPeg1Y: PersonalValuationRatioCellDto;
}

export interface PersonalValuationHistorySeriesDto {
  readonly endDate: string;
  readonly latestPoint: PersonalValuationHistoryPointDto;
  readonly points: readonly PersonalValuationHistoryPointDto[];
  readonly range: PersonalMarketDataRangeDto;
  readonly startDate: string;
}

export interface PersonalValuationHistoryCoverageDto {
  readonly knownCells: number;
  readonly observationCount: number;
  readonly status: "complete" | "partial";
  readonly unknownCells: number;
}

export interface PersonalValuationHistoryProviderDto {
  readonly attribution: "Tiingo";
  readonly export: "prohibited";
  readonly id: "tiingo";
  readonly name: "Tiingo";
  readonly persistence: "none";
  readonly redistribution: "prohibited";
  readonly retention: "active_owner_session_memory_only";
  readonly revisionBasis: "provider_most_recent";
  readonly valuationFeed: "tiingo_fundamentals_daily";
  readonly valueCurrency: "USD";
}

export interface PersonalValuationHistoryDto {
  readonly asOf: string;
  readonly coverage: PersonalValuationHistoryCoverageDto;
  readonly history: PersonalValuationHistorySeriesDto;
  readonly profile: "personal_single_user_local_valuation";
  readonly provider: PersonalValuationHistoryProviderDto;
  readonly schemaVersion: "1.0.0";
  readonly security: PersonalMarketDataIdentityDto;
  readonly status: "available";
}

export interface PersonalFilingSelectedFactDto {
  readonly key:
    | "assets"
    | "cash"
    | "debt"
    | "diluted_shares"
    | "free_cash_flow"
    | "gross_profit"
    | "net_income"
    | "operating_cash_flow"
    | "operating_income"
    | "revenue";
  readonly value: string;
  readonly unit: "USD" | "shares";
  readonly periodStart: string | null;
  readonly periodEnd: string;
}

export interface PersonalFilingSelectedFactsDto {
  readonly schemaVersion: "1.0.0";
  readonly profile: "personal_single_user_local";
  readonly status: "selected_facts_released";
  readonly facts: readonly PersonalFilingSelectedFactDto[];
}

export type PersonalFilingDossierFactKeyDto =
  | "assets"
  | "cash"
  | "debt"
  | "diluted_shares"
  | "free_cash_flow"
  | "gross_profit"
  | "net_income"
  | "operating_cash_flow"
  | "operating_income"
  | "revenue";

export interface PersonalFilingDossierFactDto {
  readonly evidenceId: `evidence-${string}`;
  readonly id: `fact-${string}`;
  readonly key: PersonalFilingDossierFactKeyDto;
  readonly knownFrom: string;
  readonly knownToExclusive: string | null;
  readonly label: string;
  readonly periodEnd: string;
  readonly periodStart: string | null;
  readonly unit: "USD" | "shares";
  readonly value: string;
  readonly version: "current" | "superseded";
}

export interface PersonalFilingDossierDerivationOperandDto<
  Role extends "minuend" | "subtrahend" = "minuend" | "subtrahend",
> {
  readonly concept: string;
  readonly periodEnd: string;
  readonly periodStart: string;
  readonly role: Role;
  readonly unit: "USD";
  readonly value: string;
}

interface PersonalFilingDossierEvidenceBaseDto {
  readonly factId: `fact-${string}`;
  readonly id: `evidence-${string}`;
  readonly sourceAcceptedAt: string;
  readonly sourceAccession: string;
  readonly sourceAvailableAt: string;
  readonly sourceContentSha256: `sha256:${string}`;
  readonly sourceDocumentSha256: `sha256:${string}`;
  readonly taxonomy: string;
}

export type PersonalFilingDossierEvidenceDto =
  | (PersonalFilingDossierEvidenceBaseDto &
      Readonly<{
        derivationFormula: null;
        derivationOperands: readonly [];
        sourceConcept: string;
      }>)
  | (PersonalFilingDossierEvidenceBaseDto &
      Readonly<{
        derivationFormula: "operating_cash_flow_minus_capital_expenditures";
        derivationOperands: readonly [
          PersonalFilingDossierDerivationOperandDto<"minuend">,
          PersonalFilingDossierDerivationOperandDto<"subtrahend">,
        ];
        sourceConcept: null;
      }>);

export interface PersonalFilingDossierLineageEventDto {
  readonly effectiveAt: string;
  readonly key: PersonalFilingDossierFactKeyDto;
  readonly predecessorFactId: `fact-${string}`;
  readonly successorFactId: `fact-${string}`;
}

export interface PersonalFilingDossierLineageDto {
  readonly events: readonly PersonalFilingDossierLineageEventDto[];
  readonly scope: "issuer_filing_versions_within_exact_frozen_manifest_only";
  readonly status:
    "amendment_supersession_observed" | "root_only_no_in_corpus_amendment";
}

export interface PersonalFilingDossierChartPointDto {
  readonly factId: `fact-${string}`;
}

export interface PersonalFilingDossierChartSeriesDto {
  readonly key: PersonalFilingDossierFactKeyDto;
  readonly label: string;
  readonly points: readonly PersonalFilingDossierChartPointDto[];
  readonly unit: "USD" | "shares";
}

export type PersonalFilingDossierChartDto =
  | Readonly<{
      reasonCode: "NO_OWNER_APPROVED_CHART_FACTS";
      status: "unsupported";
    }>
  | Readonly<{
      series: readonly PersonalFilingDossierChartSeriesDto[];
      status: "ready";
    }>;

export type PersonalFilingDossierValuationInputsDto =
  | Readonly<{
      reasonCode: "INPUT_OUT_OF_DOMAIN" | "REQUIRED_FACTS_NOT_RELEASED";
      status: "unsupported";
    }>
  | Readonly<{
      baseRevenueFactId: `fact-${string}`;
      cashFactId: `fact-${string}`;
      debtFactId: `fact-${string}`;
      dilutedSharesFactId: `fact-${string}`;
      modelVersion: "exit-multiple-v1";
      status: "ready";
    }>;

export interface PersonalFilingDossierOmissionsDto {
  readonly count: null;
  readonly explanation: string;
  readonly hasOmissions: boolean;
  readonly reasonCode: "OWNER_FIXED_SCOPE";
}

export interface PersonalFilingDossierDto {
  readonly asOf: string;
  readonly chart: PersonalFilingDossierChartDto;
  readonly dataMode: "personal";
  readonly evidence: readonly PersonalFilingDossierEvidenceDto[];
  readonly facts: readonly PersonalFilingDossierFactDto[];
  readonly lineage: PersonalFilingDossierLineageDto;
  readonly omissions: PersonalFilingDossierOmissionsDto;
  readonly profile: "personal_single_user_local";
  readonly schemaVersion: "1.0.0";
  readonly status: "personal_dossier_released";
  readonly valuationInputs: PersonalFilingDossierValuationInputsDto;
}

export interface ConnectedSourceBudgetQuantityDto {
  readonly limit: number;
  readonly used: number;
}

export interface ConnectedSourceBudgetStatusDto {
  readonly currency: string;
  readonly estimatedSpendMicrounits: ConnectedSourceBudgetQuantityDto;
  readonly requestBytes: ConnectedSourceBudgetQuantityDto;
  readonly requests: ConnectedSourceBudgetQuantityDto;
  readonly responseBytes: ConnectedSourceBudgetQuantityDto;
  readonly storageBytes: ConnectedSourceBudgetQuantityDto;
}

export interface ConnectedSourcePolicyStatusDto {
  readonly schemaVersion: "1.0.0";
  readonly profile: "personal_single_user_local_connected";
  readonly status:
    | "disabled"
    | "ready"
    | "killed"
    | "expired"
    | "revoked"
    | "incompatible"
    | "budget_exhausted";
  readonly reasonCode:
    | "NOT_EXPLICITLY_ENABLED"
    | "OWNER_KILL_SWITCH"
    | "POLICY_NOT_ADMITTED"
    | "POLICY_NOT_EFFECTIVE"
    | "POLICY_REVIEW_DUE"
    | "POLICY_EXPIRED"
    | "POLICY_REVOKED"
    | "POLICY_INCOMPATIBLE"
    | "CLOCK_UNAVAILABLE"
    | "CLOCK_INVALID"
    | "BUDGET_EXHAUSTED"
    | null;
  readonly sourceId: string | null;
  readonly policyId: string | null;
  readonly policyVersion: string | null;
  readonly budget: ConnectedSourceBudgetStatusDto | null;
}

export interface ValuationInputDto {
  baseRevenue: string;
  cash: string;
  debt: string;
  dilutedShares: string;
  annualRevenueGrowthPercent: string;
  targetEbitdaMarginPercent: string;
  discountRatePercent: string;
  exitMultiple: string;
  horizonYears: number;
}

export interface ValuationResultDto {
  schemaVersion: "1.0.0";
  modelVersion: "exit-multiple-v1";
  yearNRevenue: string;
  yearNEbitda: string;
  terminalEnterpriseValue: string;
  presentEnterpriseValue: string;
  equityValue: string;
  valuePerShare: string;
  formulaTrace: string[];
}

/**
 * Complete replacement payload for the bounded synthetic thesis update route.
 * Identity and tenancy come only from the server-resolved demo context;
 * version and idempotency come from strict precondition headers. None is
 * accepted in this body.
 */
export interface ThesisWriteRequestDto {
  instrumentId: string;
  claim: string;
  evidence: string;
  risks: string;
  invalidation: string;
}

/** Complete replacement payload for the bounded synthetic alert update route. */
export interface AlertWriteRequestDto {
  instrumentId: string;
  metricKey: string;
  operator: AlertOperator;
  threshold: string;
}

export interface ThesisWriteResponseDto {
  schemaVersion: "1.0.0";
  synthetic: true;
  id: string;
  instrumentId: string;
  claim: string;
  evidence: string;
  risks: string;
  invalidation: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertWriteResponseDto {
  schemaVersion: "1.0.0";
  synthetic: true;
  id: string;
  instrumentId: string;
  metricKey: string;
  operator: AlertOperator;
  threshold: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalThesisDto {
  schemaVersion: "1.0.0";
  instrumentId: string;
  claim: string;
  evidence: string;
  risks: string;
  invalidation: string;
  updatedAt: string;
}

export type AlertOperator = "above" | "below";

export interface LocalAlertRuleDto {
  schemaVersion: "1.0.0";
  id: string;
  instrumentId: string;
  metricKey: string;
  operator: AlertOperator;
  threshold: string;
  createdAt: string;
}

export interface AlertEvaluationDto {
  schemaVersion: "1.0.0";
  eventId: string;
  dedupeKey: string;
  ruleId: string;
  metricKey: string;
  metricValue: string;
  threshold: string;
  operator: AlertOperator;
  triggered: boolean;
  evaluatedAt: string;
  deliveryMode: "local_demo_only";
}

export interface ProblemDetailsDto {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId: string;
}
export * from "./personal-financial-screener";
export * from "./personal-watchlist-filings";
