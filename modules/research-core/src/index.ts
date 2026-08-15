export { evaluateLocalAlert } from "./alerts";
export {
  buildDossier,
  composeDossier,
  DEFAULT_KNOWN_AT,
  GetDossier,
  getEvidencePassport,
  getEvidencePassportFromSnapshot,
  PRE_RESTATEMENT_KNOWN_AT,
} from "./dossier";
export type {
  AuthorizationClock,
  CompleteSyntheticSnapshotRepository,
} from "./dossier";
export { syntheticFixture } from "./fixture";
export { evaluateMetrics } from "./metric-engine";
export type {
  FinancialFact,
  HistoricalPointRecord,
  InstrumentEvidenceBinding,
  ResearchSnapshot,
  RightsPolicy,
  TimelineEventRecord,
} from "./model";
export {
  evaluateProjectionAuthorization,
  GetOperationProjection,
  PROJECTION_OPERATIONS,
  projectOperation,
} from "./projection-contract";
export type {
  OperationProjection,
  OperationProjectionInput,
  OperationProjectionQuery,
  OperationProjectionRequest,
  OperationProjectionSourceResult,
  OperationScopedProjectionSource,
  ProjectionAuthorizationContext,
  ProjectionAuthorizationDecision,
  ProjectionAuthorizationInput,
  ProjectionAuthorizationContextProvider,
  ProjectionCandidate,
  ProjectionOmissionSummary,
  ProjectionOperation,
  ProjectionScope,
  RepositoryProjectionCompleteness,
} from "./projection-contract";
export { calculateValuation } from "./valuation";
