import { isProxy } from "node:util/types";

export const CONNECTED_SOURCE_POLICY_SCHEMA_VERSION = "1.0.0" as const;
export const CONNECTED_SOURCE_POLICY_PROFILE =
  "personal_single_user_local_connected" as const;
export const CONNECTED_SOURCE_POLICY_OPERATIONS = Object.freeze([
  "fetch_metadata",
  "fetch_snapshot",
  "fetch_history",
] as const);
export const CONNECTED_SOURCE_POLICY_STATUSES = Object.freeze([
  "disabled",
  "ready",
  "killed",
  "expired",
  "revoked",
  "incompatible",
  "budget_exhausted",
] as const);
export const CONNECTED_SOURCE_POLICY_HARD_LIMITS = Object.freeze({
  requestByteLimit: 1_048_576,
  requestLimit: 10_000,
  responseByteLimit: 1_048_576,
} as const);
export const CONNECTED_SOURCE_POLICY_NOT_PROVEN = Object.freeze([
  "real_provider_terms_license_entitlement_or_source_policy_accuracy",
  "provider_bill_cap_invoice_reconciliation_or_provider_side_request_cancellation",
  "hostile_secret_adapter_or_transport_retention_prevention_after_invocation",
  "injected_secret_and_transport_adapters_are_a_credential_confidentiality_trust_boundary",
  "hostile_adapters_may_retain_transform_or_exfiltrate_credential_bytes_and_core_cannot_generically_detect_it",
  "network_tls_dns_provider_identity_response_authenticity_or_availability",
  "downstream_cache_history_export_retention_deletion_or_termination_enforcement",
  "multi_user_tenancy_shared_service_or_enterprise_authorization_safety",
] as const);

export type ConnectedSourceOperation =
  (typeof CONNECTED_SOURCE_POLICY_OPERATIONS)[number];
export type ConnectedSourcePolicyStatusValue =
  (typeof CONNECTED_SOURCE_POLICY_STATUSES)[number];

export interface ConnectedSourceBudget {
  readonly currency: string;
  readonly estimatedSpendMicrounitsLimit: number;
  readonly requestByteLimit: number;
  readonly requestLimit: number;
  readonly responseByteLimit: number;
  readonly storageByteLimit: number;
}

export interface ConnectedSourceIntendedUse {
  readonly attributionSupported: boolean;
  readonly cacheSeconds: number;
  readonly deletionSupported: boolean;
  readonly derivation: "none" | "owner_local";
  readonly device: string;
  readonly display: "none" | "owner_local";
  readonly export: "none" | "owner_local";
  readonly geography: string;
  readonly historyDays: number;
  readonly purpose: string;
  readonly retentionSeconds: number;
  readonly terminationSupported: boolean;
}

export type ConnectedSourcePolicyConfig =
  | Readonly<{
      enabled: false;
      profile: typeof CONNECTED_SOURCE_POLICY_PROFILE;
      schemaVersion: typeof CONNECTED_SOURCE_POLICY_SCHEMA_VERSION;
    }>
  | Readonly<{
      budgets: ConnectedSourceBudget;
      enabled: true;
      intendedUse: ConnectedSourceIntendedUse;
      profile: typeof CONNECTED_SOURCE_POLICY_PROFILE;
      schemaVersion: typeof CONNECTED_SOURCE_POLICY_SCHEMA_VERSION;
      secretReference: string;
      sourceId: string;
    }>;

export interface ConnectedSourceProviderPolicy {
  readonly entitlement: string;
  readonly product: string;
  readonly providerId: string;
  readonly tier: string;
}

export interface ConnectedSourceLegalPolicy {
  readonly licenseUri: string;
  readonly licenseVersion: string;
  readonly termsUri: string;
  readonly termsVersion: string;
}

export interface ConnectedSourceValidityPolicy {
  readonly effectiveAt: string;
  readonly expiresAt: string;
  readonly reviewAt: string;
  readonly revokedAt: string | null;
}

export interface ConnectedSourceUseScopePolicy {
  readonly devices: readonly string[];
  readonly geographies: readonly string[];
  readonly purposes: readonly string[];
}

export interface ConnectedSourceControlsPolicy {
  readonly attribution: Readonly<{
    required: boolean;
    text: string | null;
  }>;
  readonly cache: Readonly<{
    maxSeconds: number;
    mode: "prohibited" | "owner_local";
  }>;
  readonly deletion: Readonly<{
    deadlineSeconds: number;
    required: boolean;
  }>;
  readonly derivation: Readonly<{
    mode: "prohibited" | "owner_local";
  }>;
  readonly display: Readonly<{
    mode: "prohibited" | "owner_local";
  }>;
  readonly export: Readonly<{
    mode: "prohibited" | "owner_local";
  }>;
  readonly history: Readonly<{
    maxDays: number;
    mode: "prohibited" | "owner_local";
  }>;
  readonly retention: Readonly<{
    maxSeconds: number;
  }>;
  readonly termination: Readonly<{
    deleteOnExpiry: boolean;
    deleteOnIncompatibility: boolean;
    deleteOnRevocation: boolean;
  }>;
}

export interface ConnectedSourceAllowlistEntry {
  readonly host: string;
  readonly operations: readonly ConnectedSourceOperation[];
}

export interface ConnectedSourcePolicyDocument {
  readonly allowlist: readonly ConnectedSourceAllowlistEntry[];
  readonly controls: ConnectedSourceControlsPolicy;
  readonly legal: ConnectedSourceLegalPolicy;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly profile: typeof CONNECTED_SOURCE_POLICY_PROFILE;
  readonly provider: ConnectedSourceProviderPolicy;
  readonly schemaVersion: typeof CONNECTED_SOURCE_POLICY_SCHEMA_VERSION;
  readonly sourceId: string;
  readonly useScope: ConnectedSourceUseScopePolicy;
  readonly validity: ConnectedSourceValidityPolicy;
}

export type ConnectedSourceStatusReason =
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
  | "BUDGET_EXHAUSTED";

export interface ConnectedSourceBudgetStatus {
  readonly currency: string;
  readonly estimatedSpendMicrounits: Readonly<{
    limit: number;
    used: number;
  }>;
  readonly requestBytes: Readonly<{ limit: number; used: number }>;
  readonly requests: Readonly<{ limit: number; used: number }>;
  readonly responseBytes: Readonly<{ limit: number; used: number }>;
  readonly storageBytes: Readonly<{ limit: number; used: number }>;
}

export interface ConnectedSourcePolicyStatus {
  readonly budget: ConnectedSourceBudgetStatus | null;
  readonly policyId: string | null;
  readonly policyVersion: string | null;
  readonly profile: typeof CONNECTED_SOURCE_POLICY_PROFILE;
  readonly reasonCode: ConnectedSourceStatusReason | null;
  readonly schemaVersion: typeof CONNECTED_SOURCE_POLICY_SCHEMA_VERSION;
  readonly sourceId: string | null;
  readonly status: ConnectedSourcePolicyStatusValue;
}

export type ConnectedSourcePolicyConfigParseResult =
  | Readonly<{
      config: ConnectedSourcePolicyConfig;
      status: "parsed";
    }>
  | Readonly<{
      reasonCode: "CONFIG_INVALID";
      status: "rejected";
    }>;

export type ConnectedSourcePolicyAdmissionResult =
  | Readonly<{
      policyStatus: ConnectedSourcePolicyStatus;
      status: "admitted";
    }>
  | Readonly<{
      policyStatus: ConnectedSourcePolicyStatus;
      reasonCode:
        | "DISABLED"
        | "KILLED"
        | "POLICY_INVALID"
        | "POLICY_REPLAYED"
        | "POLICY_ALREADY_ADMITTED"
        | "POLICY_INCOMPATIBLE"
        | "POLICY_EXPIRED"
        | "POLICY_REVOKED";
      status: "rejected";
    }>;

export type ConnectedSourceKillResult = Readonly<{
  policyStatus: ConnectedSourcePolicyStatus;
  status: "already_killed" | "killed";
}>;

export interface ConnectedSourceAuthorizationInput {
  readonly host: string;
  readonly operation: ConnectedSourceOperation;
  readonly sourceId: string;
}

export type ConnectedSourceAuthorizationResult =
  | Readonly<{
      host: string;
      operation: ConnectedSourceOperation;
      sourceId: string;
      status: "authorized";
    }>
  | Readonly<{
      reasonCode:
        | "INPUT_INVALID"
        | "DISABLED"
        | "NOT_READY"
        | "SOURCE_NOT_ADMITTED"
        | "HOST_NOT_ALLOWED"
        | "OPERATION_NOT_ALLOWED";
      status: "denied";
    }>;

declare const budgetReservationCapabilityBrand: unique symbol;
export type ConnectedSourceBudgetReservationCapability = Readonly<{
  [budgetReservationCapabilityBrand]: true;
}>;

export interface ConnectedSourceBudgetReservationInput extends ConnectedSourceAuthorizationInput {
  readonly maximumEstimatedSpendMicrounits: number;
  readonly maximumResponseBytes: number;
  readonly maximumStorageBytes: number;
  readonly replayKey: string;
  readonly requestBytes: number;
}

export type ConnectedSourceBudgetReservationResult =
  | Readonly<{
      budget: ConnectedSourceBudgetStatus;
      reservation: ConnectedSourceBudgetReservationCapability;
      status: "reserved";
    }>
  | Readonly<{
      budget: ConnectedSourceBudgetStatus | null;
      reasonCode:
        | "INPUT_INVALID"
        | "DISABLED"
        | "NOT_READY"
        | "SOURCE_NOT_ADMITTED"
        | "HOST_NOT_ALLOWED"
        | "OPERATION_NOT_ALLOWED"
        | "DEPENDENCY_UNAVAILABLE"
        | "REPLAYED"
        | "BUDGET_EXCEEDED";
      status: "denied";
    }>;

declare const admittedOperationCapabilityBrand: unique symbol;
export type ConnectedSourceAdmittedOperationCapability = Readonly<{
  [admittedOperationCapabilityBrand]: true;
}>;

declare const responseCapabilityBrand: unique symbol;
export type ConnectedSourceResponseCapability = Readonly<{
  [responseCapabilityBrand]: true;
}>;

export interface ConnectedSourceExecutionInput {
  readonly payload: Uint8Array;
  readonly reservation: ConnectedSourceBudgetReservationCapability;
}

export type ConnectedSourceExecutionResult =
  | Readonly<{
      budget: ConnectedSourceBudgetStatus;
      response: ConnectedSourceResponseCapability;
      responseByteLength: number;
      status: "succeeded";
    }>
  | Readonly<{
      budget: ConnectedSourceBudgetStatus | null;
      reasonCode:
        | "INPUT_INVALID"
        | "RESERVATION_INVALID"
        | "RESERVATION_REPLAYED"
        | "NOT_READY"
        | "SECRET_UNAVAILABLE"
        | "SECRET_INVALID"
        | "SECRET_DELETE_FAILED"
        | "TRANSPORT_UNAVAILABLE"
        | "TRANSPORT_FAILED"
        | "TRANSPORT_RESULT_INVALID"
        | "BUDGET_OVERRUN"
        | "KILLED_DURING_EXECUTION";
      status: "denied" | "failed";
    }>;

type ConnectedSourceExecutionFailureReason = Extract<
  ConnectedSourceExecutionResult,
  { reasonCode: string }
>["reasonCode"];

export interface ConnectedSourceClock {
  now(): string;
}

export interface CapturedOwnerLocalSecret {
  readonly bytes: Uint8Array;
}

export interface OwnerLocalSecretAdapter {
  capture(reference: string): Promise<CapturedOwnerLocalSecret>;
  delete(captured: CapturedOwnerLocalSecret): Promise<void> | void;
}

export interface ConnectedSourceTransportRequest {
  readonly host: string;
  readonly maximumEstimatedSpendMicrounits: number;
  readonly maximumResponseBytes: number;
  readonly maximumStorageBytes: number;
  readonly operation: ConnectedSourceOperation;
  readonly replayKey: string;
  readonly requestByteLength: number;
  readonly sourceId: string;
}

export interface ConnectedSourceTransportResult {
  readonly body: Uint8Array;
  readonly estimatedSpendMicrounits: number;
  readonly storageBytes: number;
}

export interface ConnectedSourceTransportAdapter {
  /**
   * This injected adapter is a credential-confidentiality trust boundary. It
   * must neither retain nor transform credential material into any response.
   * The provider-neutral core cannot generically detect hostile exfiltration.
   */
  execute(
    capability: ConnectedSourceAdmittedOperationCapability,
    request: ConnectedSourceTransportRequest,
    payload: Uint8Array,
    credential: Uint8Array,
  ): Promise<ConnectedSourceTransportResult>;
}

declare const transportCapabilityBrand: unique symbol;
export type ConnectedSourceTransportCapability = Readonly<{
  [transportCapabilityBrand]: true;
}>;

export interface ConnectedSourcePolicyDependencies {
  readonly clock?: ConnectedSourceClock;
  readonly secretAdapter?: OwnerLocalSecretAdapter;
  readonly transportCapability?: ConnectedSourceTransportCapability;
}

export interface ConnectedSourcePolicy {
  admitSourcePolicy(policy: unknown): ConnectedSourcePolicyAdmissionResult;
  authorizeOperation(input: unknown): ConnectedSourceAuthorizationResult;
  execute(input: unknown): Promise<ConnectedSourceExecutionResult>;
  kill(): ConnectedSourceKillResult;
  reserveBudget(input: unknown): ConnectedSourceBudgetReservationResult;
  status(): ConnectedSourcePolicyStatus;
}

export class ConnectedSourcePolicyConfigurationError extends Error {
  public constructor() {
    super("Connected source policy configuration is invalid.");
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "ConnectedSourcePolicyConfigurationError",
    });
  }
}

interface DependencySnapshot {
  readonly clockNow?: () => string;
  readonly secretCapture?: (
    reference: string,
  ) => Promise<CapturedOwnerLocalSecret>;
  readonly secretDelete?: (
    captured: CapturedOwnerLocalSecret,
  ) => Promise<void> | void;
  readonly transportExecute?: ConnectedSourceTransportAdapter["execute"];
}

interface BudgetUsage {
  estimatedSpendMicrounits: number;
  requestBytes: number;
  requests: number;
  responseBytes: number;
  storageBytes: number;
}

interface TerminalState {
  readonly reasonCode: ConnectedSourceStatusReason;
  readonly status: Exclude<
    ConnectedSourcePolicyStatusValue,
    "disabled" | "ready"
  >;
}

interface RegistryState {
  readonly admissions: Set<object>;
  readonly config: ConnectedSourcePolicyConfig;
  readonly dependencies: DependencySnapshot;
  readonly replayKeys: Set<string>;
  readonly reservations: Set<object>;
  readonly responses: Set<object>;
  readonly usage: BudgetUsage;
  generation: number;
  policy?: ConnectedSourcePolicyDocument;
  terminal?: TerminalState;
}

interface ReservationState {
  readonly generation: number;
  readonly registry: RegistryState;
  readonly request: ConnectedSourceTransportRequest;
  state: "reserved" | "in_flight" | "consumed";
}

interface AdmittedOperationState {
  active: boolean;
  readonly registry: RegistryState;
}

interface ResponseState {
  readonly bytes: Uint8Array;
  readonly registry: RegistryState;
}

interface ParsedAuthorizationInput {
  readonly host: string;
  readonly operation: ConnectedSourceOperation;
  readonly sourceId: string;
}

interface ParsedReservationInput extends ParsedAuthorizationInput {
  readonly maximumEstimatedSpendMicrounits: number;
  readonly maximumResponseBytes: number;
  readonly maximumStorageBytes: number;
  readonly replayKey: string;
  readonly requestBytes: number;
}

interface ParsedTransportResult {
  readonly body: Uint8Array;
  readonly estimatedSpendMicrounits: number;
  readonly storageBytes: number;
}

const transportCapabilities = new WeakMap<
  object,
  ConnectedSourceTransportAdapter["execute"]
>();
const budgetReservations = new WeakMap<object, ReservationState>();
const admittedOperations = new WeakMap<object, AdmittedOperationState>();
const responseCapabilities = new WeakMap<object, ResponseState>();

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_TAG_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
);
const TYPED_ARRAY_BUFFER_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
);
const TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
);
const ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
);

export function parseConnectedSourcePolicyConfig(
  value: unknown,
): ConnectedSourcePolicyConfigParseResult {
  try {
    const config = parseConfig(value);
    return Object.freeze({ config, status: "parsed" as const });
  } catch {
    return Object.freeze({
      reasonCode: "CONFIG_INVALID" as const,
      status: "rejected" as const,
    });
  }
}

export function createConnectedSourceTransportCapability(
  adapter: ConnectedSourceTransportAdapter,
): ConnectedSourceTransportCapability {
  try {
    const descriptors = exactDescriptors(adapter, ["execute"]);
    const execute = descriptors.execute?.value as unknown;
    if (typeof execute !== "function") configurationFail();
    const bound = (
      ...args: Parameters<ConnectedSourceTransportAdapter["execute"]>
    ) =>
      Reflect.apply(
        execute,
        adapter,
        args,
      ) as Promise<ConnectedSourceTransportResult>;
    const capability = Object.freeze({}) as ConnectedSourceTransportCapability;
    transportCapabilities.set(capability, bound);
    return capability;
  } catch (error) {
    if (error instanceof ConnectedSourcePolicyConfigurationError) throw error;
    configurationFail();
  }
}

export function isConnectedSourceAdmittedOperationCapability(
  value: unknown,
): value is ConnectedSourceAdmittedOperationCapability {
  if (typeof value !== "object" || value === null) return false;
  try {
    const state = admittedOperations.get(value);
    return Object.isFrozen(value) && state !== undefined && state.active;
  } catch {
    return false;
  }
}

export function readConnectedSourceResponse(
  capability: ConnectedSourceResponseCapability,
): readonly number[] | undefined {
  if (typeof capability !== "object" || capability === null) return undefined;
  try {
    const state = responseCapabilities.get(capability);
    if (state === undefined) return undefined;
    responseCapabilities.delete(capability);
    state.registry.responses.delete(capability);
    const copy = Object.freeze(Array.from(state.bytes));
    state.bytes.fill(0);
    return copy;
  } catch {
    return undefined;
  }
}

export function createConnectedSourcePolicy(
  configValue: unknown,
  dependenciesValue?: ConnectedSourcePolicyDependencies,
): ConnectedSourcePolicy {
  const parsed = parseConnectedSourcePolicyConfig(configValue);
  if (parsed.status !== "parsed") configurationFail();
  const dependencies = snapshotDependencies(dependenciesValue);
  const state: RegistryState = {
    admissions: new Set(),
    config: parsed.config,
    dependencies,
    generation: 0,
    replayKeys: new Set(),
    reservations: new Set(),
    responses: new Set(),
    usage: {
      estimatedSpendMicrounits: 0,
      requestBytes: 0,
      requests: 0,
      responseBytes: 0,
      storageBytes: 0,
    },
  };
  return Object.freeze({
    admitSourcePolicy: (policy: unknown) => admitSourcePolicy(state, policy),
    authorizeOperation: (input: unknown) => authorizeOperation(state, input),
    execute: (input: unknown) => executeReservation(state, input),
    kill: () => killRegistry(state),
    reserveBudget: (input: unknown) => reserveBudget(state, input),
    status: () => registryStatus(state),
  });
}

function parseConfig(value: unknown): ConnectedSourcePolicyConfig {
  if (value === undefined) {
    return Object.freeze({
      enabled: false as const,
      profile: CONNECTED_SOURCE_POLICY_PROFILE,
      schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
    });
  }
  const enabledDescriptor = ownDataDescriptor(value, "enabled");
  if (enabledDescriptor === undefined) configurationFail();
  if (enabledDescriptor.value === false) {
    const descriptors = exactDescriptors(value, [
      "enabled",
      "profile",
      "schemaVersion",
    ]);
    if (
      descriptors.profile?.value !== CONNECTED_SOURCE_POLICY_PROFILE ||
      descriptors.schemaVersion?.value !==
        CONNECTED_SOURCE_POLICY_SCHEMA_VERSION
    ) {
      configurationFail();
    }
    return Object.freeze({
      enabled: false as const,
      profile: CONNECTED_SOURCE_POLICY_PROFILE,
      schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
    });
  }
  if (enabledDescriptor.value !== true) configurationFail();
  const descriptors = exactDescriptors(value, [
    "budgets",
    "enabled",
    "intendedUse",
    "profile",
    "schemaVersion",
    "secretReference",
    "sourceId",
  ]);
  if (
    descriptors.profile?.value !== CONNECTED_SOURCE_POLICY_PROFILE ||
    descriptors.schemaVersion?.value !== CONNECTED_SOURCE_POLICY_SCHEMA_VERSION
  ) {
    configurationFail();
  }
  const sourceId = strictToken(descriptors.sourceId?.value, 128);
  const secretReference = strictSecretReference(
    descriptors.secretReference?.value,
  );
  const budgets = parseBudget(descriptors.budgets?.value);
  const intendedUse = parseIntendedUse(descriptors.intendedUse?.value);
  return Object.freeze({
    budgets,
    enabled: true as const,
    intendedUse,
    profile: CONNECTED_SOURCE_POLICY_PROFILE,
    schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
    secretReference,
    sourceId,
  });
}

function parseBudget(value: unknown): ConnectedSourceBudget {
  const descriptors = exactDescriptors(value, [
    "currency",
    "estimatedSpendMicrounitsLimit",
    "requestByteLimit",
    "requestLimit",
    "responseByteLimit",
    "storageByteLimit",
  ]);
  return Object.freeze({
    currency: strictCurrency(descriptors.currency?.value),
    estimatedSpendMicrounitsLimit: strictNonnegativeInteger(
      descriptors.estimatedSpendMicrounitsLimit?.value,
    ),
    requestByteLimit: strictBoundedPositiveInteger(
      descriptors.requestByteLimit?.value,
      CONNECTED_SOURCE_POLICY_HARD_LIMITS.requestByteLimit,
    ),
    requestLimit: strictBoundedPositiveInteger(
      descriptors.requestLimit?.value,
      CONNECTED_SOURCE_POLICY_HARD_LIMITS.requestLimit,
    ),
    responseByteLimit: strictBoundedPositiveInteger(
      descriptors.responseByteLimit?.value,
      CONNECTED_SOURCE_POLICY_HARD_LIMITS.responseByteLimit,
    ),
    storageByteLimit: strictNonnegativeInteger(
      descriptors.storageByteLimit?.value,
    ),
  });
}

function parseIntendedUse(value: unknown): ConnectedSourceIntendedUse {
  const descriptors = exactDescriptors(value, [
    "attributionSupported",
    "cacheSeconds",
    "deletionSupported",
    "derivation",
    "device",
    "display",
    "export",
    "geography",
    "historyDays",
    "purpose",
    "retentionSeconds",
    "terminationSupported",
  ]);
  const attributionSupported = strictBoolean(
    descriptors.attributionSupported?.value,
  );
  const deletionSupported = strictBoolean(descriptors.deletionSupported?.value);
  const terminationSupported = strictBoolean(
    descriptors.terminationSupported?.value,
  );
  return Object.freeze({
    attributionSupported,
    cacheSeconds: strictNonnegativeInteger(descriptors.cacheSeconds?.value),
    deletionSupported,
    derivation: strictUseMode(descriptors.derivation?.value),
    device: strictToken(descriptors.device?.value, 64),
    display: strictUseMode(descriptors.display?.value),
    export: strictUseMode(descriptors.export?.value),
    geography: strictGeography(descriptors.geography?.value),
    historyDays: strictNonnegativeInteger(descriptors.historyDays?.value),
    purpose: strictToken(descriptors.purpose?.value, 64),
    retentionSeconds: strictNonnegativeInteger(
      descriptors.retentionSeconds?.value,
    ),
    terminationSupported,
  });
}

function snapshotDependencies(
  value: ConnectedSourcePolicyDependencies | undefined,
): DependencySnapshot {
  if (value === undefined) return Object.freeze({});
  const descriptors = subsetDescriptors(value, [
    "clock",
    "secretAdapter",
    "transportCapability",
  ]);
  const snapshot: {
    clockNow?: () => string;
    secretCapture?: (reference: string) => Promise<CapturedOwnerLocalSecret>;
    secretDelete?: (captured: CapturedOwnerLocalSecret) => Promise<void> | void;
    transportExecute?: ConnectedSourceTransportAdapter["execute"];
  } = {};
  if (descriptors.clock !== undefined) {
    const clock = descriptors.clock.value as unknown;
    const clockDescriptors = exactDescriptors(clock, ["now"]);
    const now = clockDescriptors.now?.value as unknown;
    if (typeof now !== "function") configurationFail();
    snapshot.clockNow = () => Reflect.apply(now, clock, []) as string;
  }
  if (descriptors.secretAdapter !== undefined) {
    const adapter = descriptors.secretAdapter.value as unknown;
    const adapterDescriptors = exactDescriptors(adapter, ["capture", "delete"]);
    const capture = adapterDescriptors.capture?.value as unknown;
    const deleteCaptured = adapterDescriptors.delete?.value as unknown;
    if (typeof capture !== "function" || typeof deleteCaptured !== "function")
      configurationFail();
    snapshot.secretCapture = (reference) =>
      Promise.resolve(
        Reflect.apply(capture, adapter, [
          reference,
        ]) as CapturedOwnerLocalSecret,
      );
    snapshot.secretDelete = (captured) =>
      Reflect.apply(deleteCaptured, adapter, [
        captured,
      ]) as Promise<void> | void;
  }
  if (descriptors.transportCapability !== undefined) {
    const capability = descriptors.transportCapability.value as unknown;
    if (
      typeof capability !== "object" ||
      capability === null ||
      isProxy(capability)
    )
      configurationFail();
    const execute = transportCapabilities.get(capability);
    if (execute === undefined || !Object.isFrozen(capability))
      configurationFail();
    snapshot.transportExecute = execute;
  }
  return Object.freeze(snapshot);
}

function parsePolicyDocument(value: unknown): ConnectedSourcePolicyDocument {
  const descriptors = exactDescriptors(value, [
    "allowlist",
    "controls",
    "legal",
    "policyId",
    "policyVersion",
    "profile",
    "provider",
    "schemaVersion",
    "sourceId",
    "useScope",
    "validity",
  ]);
  if (
    descriptors.profile?.value !== CONNECTED_SOURCE_POLICY_PROFILE ||
    descriptors.schemaVersion?.value !== CONNECTED_SOURCE_POLICY_SCHEMA_VERSION
  ) {
    policyFail();
  }
  const validity = parseValidity(descriptors.validity?.value);
  const legal = parseLegal(descriptors.legal?.value);
  if (legal.licenseUri === legal.termsUri) policyFail();
  return Object.freeze({
    allowlist: parseAllowlist(descriptors.allowlist?.value),
    controls: parseControls(descriptors.controls?.value),
    legal,
    policyId: strictPolicyToken(descriptors.policyId?.value, 128),
    policyVersion: strictPolicyToken(descriptors.policyVersion?.value, 64),
    profile: CONNECTED_SOURCE_POLICY_PROFILE,
    provider: parseProvider(descriptors.provider?.value),
    schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
    sourceId: strictPolicySourceId(descriptors.sourceId?.value),
    useScope: parseUseScope(descriptors.useScope?.value),
    validity,
  });
}

function parseProvider(value: unknown): ConnectedSourceProviderPolicy {
  const descriptors = exactDescriptors(value, [
    "entitlement",
    "product",
    "providerId",
    "tier",
  ]);
  return Object.freeze({
    entitlement: strictPolicyToken(descriptors.entitlement?.value, 128),
    product: strictPolicyToken(descriptors.product?.value, 128),
    providerId: strictPolicyToken(descriptors.providerId?.value, 128),
    tier: strictPolicyToken(descriptors.tier?.value, 128),
  });
}

function parseLegal(value: unknown): ConnectedSourceLegalPolicy {
  const descriptors = exactDescriptors(value, [
    "licenseUri",
    "licenseVersion",
    "termsUri",
    "termsVersion",
  ]);
  return Object.freeze({
    licenseUri: strictHttpsUri(descriptors.licenseUri?.value),
    licenseVersion: strictPolicyToken(descriptors.licenseVersion?.value, 64),
    termsUri: strictHttpsUri(descriptors.termsUri?.value),
    termsVersion: strictPolicyToken(descriptors.termsVersion?.value, 64),
  });
}

function parseValidity(value: unknown): ConnectedSourceValidityPolicy {
  const descriptors = exactDescriptors(value, [
    "effectiveAt",
    "expiresAt",
    "reviewAt",
    "revokedAt",
  ]);
  const effectiveAt = strictInstant(descriptors.effectiveAt?.value);
  const reviewAt = strictInstant(descriptors.reviewAt?.value);
  const expiresAt = strictInstant(descriptors.expiresAt?.value);
  const revokedValue = descriptors.revokedAt?.value as unknown;
  const revokedAt = revokedValue === null ? null : strictInstant(revokedValue);
  const effective = Date.parse(effectiveAt);
  const review = Date.parse(reviewAt);
  const expires = Date.parse(expiresAt);
  const revoked = revokedAt === null ? null : Date.parse(revokedAt);
  if (
    effective >= review ||
    review >= expires ||
    (revoked !== null && (revoked < effective || revoked >= expires))
  ) {
    policyFail();
  }
  return Object.freeze({ effectiveAt, expiresAt, reviewAt, revokedAt });
}

function parseUseScope(value: unknown): ConnectedSourceUseScopePolicy {
  const descriptors = exactDescriptors(value, [
    "devices",
    "geographies",
    "purposes",
  ]);
  return Object.freeze({
    devices: parseSortedTokenArray(descriptors.devices?.value, 32, 64),
    geographies: parseSortedStringArray(
      descriptors.geographies?.value,
      32,
      strictGeography,
    ),
    purposes: parseSortedTokenArray(descriptors.purposes?.value, 32, 64),
  });
}

function parseControls(value: unknown): ConnectedSourceControlsPolicy {
  const descriptors = exactDescriptors(value, [
    "attribution",
    "cache",
    "deletion",
    "derivation",
    "display",
    "export",
    "history",
    "retention",
    "termination",
  ]);
  const attributionDescriptors = exactDescriptors(
    descriptors.attribution?.value,
    ["required", "text"],
  );
  const attributionRequired = strictPolicyBoolean(
    attributionDescriptors.required?.value,
  );
  const attributionTextValue = attributionDescriptors.text?.value as unknown;
  const attributionText =
    attributionTextValue === null
      ? null
      : strictDisplayText(attributionTextValue);
  if (attributionRequired !== (attributionText !== null)) policyFail();

  const cacheDescriptors = exactDescriptors(descriptors.cache?.value, [
    "maxSeconds",
    "mode",
  ]);
  const historyDescriptors = exactDescriptors(descriptors.history?.value, [
    "maxDays",
    "mode",
  ]);
  const deletionDescriptors = exactDescriptors(descriptors.deletion?.value, [
    "deadlineSeconds",
    "required",
  ]);
  const retentionDescriptors = exactDescriptors(descriptors.retention?.value, [
    "maxSeconds",
  ]);
  const terminationDescriptors = exactDescriptors(
    descriptors.termination?.value,
    ["deleteOnExpiry", "deleteOnIncompatibility", "deleteOnRevocation"],
  );
  return Object.freeze({
    attribution: Object.freeze({
      required: attributionRequired,
      text: attributionText,
    }),
    cache: Object.freeze({
      maxSeconds: strictPolicyNonnegativeInteger(
        cacheDescriptors.maxSeconds?.value,
      ),
      mode: strictPolicyControlMode(cacheDescriptors.mode?.value),
    }),
    deletion: Object.freeze({
      deadlineSeconds: strictPolicyNonnegativeInteger(
        deletionDescriptors.deadlineSeconds?.value,
      ),
      required: strictPolicyBoolean(deletionDescriptors.required?.value),
    }),
    derivation: parseModeControl(descriptors.derivation?.value),
    display: parseModeControl(descriptors.display?.value),
    export: parseModeControl(descriptors.export?.value),
    history: Object.freeze({
      maxDays: strictPolicyNonnegativeInteger(
        historyDescriptors.maxDays?.value,
      ),
      mode: strictPolicyControlMode(historyDescriptors.mode?.value),
    }),
    retention: Object.freeze({
      maxSeconds: strictPolicyNonnegativeInteger(
        retentionDescriptors.maxSeconds?.value,
      ),
    }),
    termination: Object.freeze({
      deleteOnExpiry: strictPolicyBoolean(
        terminationDescriptors.deleteOnExpiry?.value,
      ),
      deleteOnIncompatibility: strictPolicyBoolean(
        terminationDescriptors.deleteOnIncompatibility?.value,
      ),
      deleteOnRevocation: strictPolicyBoolean(
        terminationDescriptors.deleteOnRevocation?.value,
      ),
    }),
  });
}

function parseModeControl(
  value: unknown,
): Readonly<{ mode: "prohibited" | "owner_local" }> {
  const descriptors = exactDescriptors(value, ["mode"]);
  return Object.freeze({
    mode: strictPolicyControlMode(descriptors.mode?.value),
  });
}

function parseAllowlist(
  value: unknown,
): readonly ConnectedSourceAllowlistEntry[] {
  const entries = arrayValues(value, 1, 32);
  const parsed: ConnectedSourceAllowlistEntry[] = [];
  let priorHost = "";
  for (const entry of entries) {
    const descriptors = exactDescriptors(entry, ["host", "operations"]);
    const host = strictHost(descriptors.host?.value);
    if (host <= priorHost) policyFail();
    priorHost = host;
    const operations = parseOperations(descriptors.operations?.value);
    parsed.push(Object.freeze({ host, operations }));
  }
  return Object.freeze(parsed);
}

function parseOperations(value: unknown): readonly ConnectedSourceOperation[] {
  const values = arrayValues(
    value,
    1,
    CONNECTED_SOURCE_POLICY_OPERATIONS.length,
  );
  const operations: ConnectedSourceOperation[] = [];
  let previous = -1;
  for (const operation of values) {
    const index = CONNECTED_SOURCE_POLICY_OPERATIONS.indexOf(
      operation as ConnectedSourceOperation,
    );
    if (index <= previous) policyFail();
    operations.push(CONNECTED_SOURCE_POLICY_OPERATIONS[index]!);
    previous = index;
  }
  return Object.freeze(operations);
}

function authorizeOperation(
  state: RegistryState,
  value: unknown,
): ConnectedSourceAuthorizationResult {
  let input: ParsedAuthorizationInput;
  try {
    input = parseAuthorizationInput(value);
  } catch {
    return deniedAuthorization("INPUT_INVALID");
  }
  return authorizeParsedOperation(state, input);
}

function parseAuthorizationInput(value: unknown): ParsedAuthorizationInput {
  const descriptors = exactDescriptors(value, [
    "host",
    "operation",
    "sourceId",
  ]);
  return Object.freeze({
    host: strictHost(descriptors.host?.value),
    operation: strictOperation(descriptors.operation?.value),
    sourceId: strictPolicySourceId(descriptors.sourceId?.value),
  });
}

function authorizeParsedOperation(
  state: RegistryState,
  input: ParsedAuthorizationInput,
): ConnectedSourceAuthorizationResult {
  const policyStatus = registryStatus(state);
  if (policyStatus.status === "disabled") {
    return deniedAuthorization("DISABLED");
  }
  if (policyStatus.status !== "ready" || state.policy === undefined) {
    return deniedAuthorization("NOT_READY");
  }
  if (input.sourceId !== state.policy.sourceId) {
    return deniedAuthorization("SOURCE_NOT_ADMITTED");
  }
  const allowlistEntry = state.policy.allowlist.find(
    (entry) => entry.host === input.host,
  );
  if (allowlistEntry === undefined) {
    return deniedAuthorization("HOST_NOT_ALLOWED");
  }
  if (!allowlistEntry.operations.includes(input.operation)) {
    return deniedAuthorization("OPERATION_NOT_ALLOWED");
  }
  return Object.freeze({
    host: input.host,
    operation: input.operation,
    sourceId: input.sourceId,
    status: "authorized" as const,
  });
}

function deniedAuthorization(
  reasonCode: Extract<
    ConnectedSourceAuthorizationResult,
    { status: "denied" }
  >["reasonCode"],
): ConnectedSourceAuthorizationResult {
  return Object.freeze({ reasonCode, status: "denied" as const });
}

function reserveBudget(
  state: RegistryState,
  value: unknown,
): ConnectedSourceBudgetReservationResult {
  let input: ParsedReservationInput;
  try {
    const descriptors = exactDescriptors(value, [
      "host",
      "maximumEstimatedSpendMicrounits",
      "maximumResponseBytes",
      "maximumStorageBytes",
      "operation",
      "replayKey",
      "requestBytes",
      "sourceId",
    ]);
    input = Object.freeze({
      host: strictHost(descriptors.host?.value),
      maximumEstimatedSpendMicrounits: strictPolicyNonnegativeInteger(
        descriptors.maximumEstimatedSpendMicrounits?.value,
      ),
      maximumResponseBytes: strictPolicyNonnegativeInteger(
        descriptors.maximumResponseBytes?.value,
      ),
      maximumStorageBytes: strictPolicyNonnegativeInteger(
        descriptors.maximumStorageBytes?.value,
      ),
      operation: strictOperation(descriptors.operation?.value),
      replayKey: strictPolicyToken(descriptors.replayKey?.value, 128),
      requestBytes: strictPolicyPositiveInteger(
        descriptors.requestBytes?.value,
      ),
      sourceId: strictPolicySourceId(descriptors.sourceId?.value),
    });
  } catch {
    return deniedReservation(state, "INPUT_INVALID");
  }

  const authorization = authorizeParsedOperation(state, input);
  if (authorization.status === "denied") {
    return deniedReservation(state, authorization.reasonCode);
  }
  const { dependencies } = state;
  if (
    dependencies.secretCapture === undefined ||
    dependencies.secretDelete === undefined ||
    dependencies.transportExecute === undefined
  ) {
    return deniedReservation(state, "DEPENDENCY_UNAVAILABLE");
  }
  if (state.replayKeys.has(input.replayKey)) {
    return deniedReservation(state, "REPLAYED");
  }

  if (!state.config.enabled) {
    return deniedReservation(state, "DISABLED");
  }
  const limit = state.config.budgets;
  if (
    wouldExceed(state.usage.requests, 1, limit.requestLimit) ||
    wouldExceed(
      state.usage.requestBytes,
      input.requestBytes,
      limit.requestByteLimit,
    ) ||
    wouldExceed(
      state.usage.responseBytes,
      input.maximumResponseBytes,
      limit.responseByteLimit,
    ) ||
    wouldExceed(
      state.usage.storageBytes,
      input.maximumStorageBytes,
      limit.storageByteLimit,
    ) ||
    wouldExceed(
      state.usage.estimatedSpendMicrounits,
      input.maximumEstimatedSpendMicrounits,
      limit.estimatedSpendMicrounitsLimit,
    )
  ) {
    terminateRegistry(state, "budget_exhausted", "BUDGET_EXHAUSTED");
    return deniedReservation(state, "BUDGET_EXCEEDED");
  }

  state.replayKeys.add(input.replayKey);
  state.usage.requests += 1;
  state.usage.requestBytes += input.requestBytes;
  state.usage.responseBytes += input.maximumResponseBytes;
  state.usage.storageBytes += input.maximumStorageBytes;
  state.usage.estimatedSpendMicrounits += input.maximumEstimatedSpendMicrounits;

  const request = Object.freeze({
    host: input.host,
    maximumEstimatedSpendMicrounits: input.maximumEstimatedSpendMicrounits,
    maximumResponseBytes: input.maximumResponseBytes,
    maximumStorageBytes: input.maximumStorageBytes,
    operation: input.operation,
    replayKey: input.replayKey,
    requestByteLength: input.requestBytes,
    sourceId: input.sourceId,
  });
  const capability = Object.freeze(
    {},
  ) as ConnectedSourceBudgetReservationCapability;
  const reservation: ReservationState = {
    generation: state.generation,
    registry: state,
    request,
    state: "reserved",
  };
  budgetReservations.set(capability, reservation);
  state.reservations.add(capability);
  return Object.freeze({
    budget: budgetStatus(state),
    reservation: capability,
    status: "reserved" as const,
  });
}

function deniedReservation(
  state: RegistryState,
  reasonCode: Extract<
    ConnectedSourceBudgetReservationResult,
    { status: "denied" }
  >["reasonCode"],
): ConnectedSourceBudgetReservationResult {
  return Object.freeze({
    budget: state.config.enabled ? budgetStatus(state) : null,
    reasonCode,
    status: "denied" as const,
  });
}

async function executeReservation(
  state: RegistryState,
  value: unknown,
): Promise<ConnectedSourceExecutionResult> {
  let reservationCapability: object;
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = exactDescriptors(value, ["payload", "reservation"]);
    const candidate = descriptors.reservation?.value as unknown;
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      isProxy(candidate)
    ) {
      inputFail();
    }
    reservationCapability = candidate;
  } catch {
    return executionResult(state, "denied", "INPUT_INVALID");
  }

  const reservation = budgetReservations.get(reservationCapability);
  if (reservation === undefined || reservation.registry !== state) {
    return executionResult(state, "denied", "RESERVATION_INVALID");
  }
  if (reservation.state !== "reserved") {
    return executionResult(state, "denied", "RESERVATION_REPLAYED");
  }
  reservation.state = "in_flight";
  budgetReservations.delete(reservationCapability);
  state.reservations.delete(reservationCapability);
  const currentStatus = registryStatus(state);
  if (
    currentStatus.status !== "ready" ||
    reservation.generation !== state.generation
  ) {
    reservation.state = "consumed";
    return executionResult(state, "denied", "NOT_READY");
  }

  const generation = state.generation;
  let payload: Uint8Array;
  try {
    payload = byteSnapshot(
      descriptors.payload?.value,
      reservation.request.requestByteLength,
      reservation.request.requestByteLength,
    );
  } catch {
    reservation.state = "consumed";
    return executionResult(state, "denied", "INPUT_INVALID");
  }
  const secretCapture = state.dependencies.secretCapture;
  const secretDelete = state.dependencies.secretDelete;
  const transportExecute = state.dependencies.transportExecute;
  if (
    secretCapture === undefined ||
    secretDelete === undefined ||
    transportExecute === undefined ||
    !state.config.enabled
  ) {
    reservation.state = "consumed";
    payload.fill(0);
    return executionResult(state, "failed", "TRANSPORT_UNAVAILABLE");
  }

  let captured: CapturedOwnerLocalSecret | undefined;
  let credential: Uint8Array | undefined;
  let admittedCapability:
    ConnectedSourceAdmittedOperationCapability | undefined;
  let admittedState: AdmittedOperationState | undefined;
  let transportBody: Uint8Array | undefined;
  let parsedResult: ParsedTransportResult | undefined;
  let failure: ConnectedSourceExecutionFailureReason | undefined;
  let deleteFailed = false;

  try {
    try {
      captured = await secretCapture(state.config.secretReference);
    } catch {
      failure = "SECRET_UNAVAILABLE";
    }
    if (failure === undefined) {
      if (!registryStillReady(state, generation)) {
        failure = "KILLED_DURING_EXECUTION";
      } else {
        try {
          credential = snapshotCapturedSecret(captured);
        } catch {
          failure = "SECRET_INVALID";
        }
      }
    }
    if (failure === undefined && credential !== undefined) {
      admittedCapability = Object.freeze(
        {},
      ) as ConnectedSourceAdmittedOperationCapability;
      admittedState = { active: true, registry: state };
      admittedOperations.set(admittedCapability, admittedState);
      state.admissions.add(admittedCapability);
      let rawResult: unknown;
      try {
        rawResult = await transportExecute(
          admittedCapability,
          reservation.request,
          payload,
          credential,
        );
        if (!registryStillReady(state, generation)) {
          failure = "KILLED_DURING_EXECUTION";
        } else {
          try {
            parsedResult = parseTransportResult(rawResult, reservation.request);
            transportBody = parsedResult.body;
          } catch (error) {
            failure =
              error instanceof ConnectedSourceBudgetOverrunError
                ? "BUDGET_OVERRUN"
                : "TRANSPORT_RESULT_INVALID";
          }
        }
      } catch {
        failure = "TRANSPORT_FAILED";
      } finally {
        wipeRawTransportBody(rawResult);
        admittedState.active = false;
        admittedOperations.delete(admittedCapability);
        state.admissions.delete(admittedCapability);
      }
    }
  } finally {
    if (captured !== undefined) {
      try {
        await secretDelete(captured);
      } catch {
        deleteFailed = true;
      }
      wipeCapturedSecret(captured);
    }
    credential?.fill(0);
    payload.fill(0);
    reservation.state = "consumed";
  }

  if (!registryStillReady(state, generation)) {
    transportBody?.fill(0);
    return executionResult(state, "denied", "KILLED_DURING_EXECUTION");
  }
  if (deleteFailed) {
    transportBody?.fill(0);
    terminateRegistry(state, "incompatible", "POLICY_INCOMPATIBLE");
    return executionResult(state, "failed", "SECRET_DELETE_FAILED");
  }
  if (failure !== undefined) {
    transportBody?.fill(0);
    if (failure === "BUDGET_OVERRUN") {
      terminateRegistry(state, "budget_exhausted", "BUDGET_EXHAUSTED");
    }
    return executionResult(
      state,
      failure === "KILLED_DURING_EXECUTION" ? "denied" : "failed",
      failure,
    );
  }
  if (parsedResult === undefined || transportBody === undefined) {
    return executionResult(state, "failed", "TRANSPORT_RESULT_INVALID");
  }

  const request = reservation.request;
  if (
    transportBody.byteLength > request.maximumResponseBytes ||
    parsedResult.storageBytes > request.maximumStorageBytes ||
    parsedResult.estimatedSpendMicrounits >
      request.maximumEstimatedSpendMicrounits
  ) {
    transportBody.fill(0);
    terminateRegistry(state, "budget_exhausted", "BUDGET_EXHAUSTED");
    return executionResult(state, "failed", "BUDGET_OVERRUN");
  }

  state.usage.responseBytes -=
    request.maximumResponseBytes - transportBody.byteLength;
  state.usage.storageBytes -=
    request.maximumStorageBytes - parsedResult.storageBytes;
  state.usage.estimatedSpendMicrounits -=
    request.maximumEstimatedSpendMicrounits -
    parsedResult.estimatedSpendMicrounits;

  const response = Object.freeze({}) as ConnectedSourceResponseCapability;
  responseCapabilities.set(response, { bytes: transportBody, registry: state });
  state.responses.add(response);
  return Object.freeze({
    budget: budgetStatus(state),
    response,
    responseByteLength: transportBody.byteLength,
    status: "succeeded" as const,
  });
}

function registryStillReady(state: RegistryState, generation: number): boolean {
  return (
    state.generation === generation && registryStatus(state).status === "ready"
  );
}

function parseTransportResult(
  value: unknown,
  reservation: ConnectedSourceTransportRequest,
): ParsedTransportResult {
  const descriptors = exactDescriptors(value, [
    "body",
    "estimatedSpendMicrounits",
    "storageBytes",
  ]);
  const estimatedSpendMicrounits = strictPolicyNonnegativeInteger(
    descriptors.estimatedSpendMicrounits?.value,
  );
  const storageBytes = strictPolicyNonnegativeInteger(
    descriptors.storageBytes?.value,
  );
  const responseBytes = byteArrayLength(descriptors.body?.value, 0);
  if (
    responseBytes > reservation.maximumResponseBytes ||
    storageBytes > reservation.maximumStorageBytes ||
    estimatedSpendMicrounits > reservation.maximumEstimatedSpendMicrounits
  ) {
    throw new ConnectedSourceBudgetOverrunError();
  }
  return Object.freeze({
    body: byteSnapshot(
      descriptors.body?.value,
      responseBytes,
      reservation.maximumResponseBytes,
    ),
    estimatedSpendMicrounits,
    storageBytes,
  });
}

function snapshotCapturedSecret(
  value: CapturedOwnerLocalSecret | undefined,
): Uint8Array {
  const descriptors = exactDescriptors(value, ["bytes"]);
  return byteSnapshot(descriptors.bytes?.value, 1, 65_536);
}

function wipeCapturedSecret(value: CapturedOwnerLocalSecret): void {
  try {
    const descriptor = ownDataDescriptor(value, "bytes");
    if (descriptor !== undefined) wipeByteArray(descriptor.value);
  } catch {
    // A hostile adapter can retain or obstruct its own bytes; this is a nonclaim.
  }
}

function wipeByteArray(value: unknown): void {
  try {
    if (
      typeof value === "object" &&
      value !== null &&
      !isProxy(value) &&
      Object.getPrototypeOf(value) === Uint8Array.prototype
    ) {
      Uint8Array.prototype.fill.call(value, 0);
    }
  } catch {
    // Best-effort wipe only.
  }
}

function wipeRawTransportBody(value: unknown): void {
  try {
    const descriptor = ownDataDescriptor(value, "body");
    if (descriptor !== undefined) wipeByteArray(descriptor.value);
  } catch {
    // Best-effort wipe only; hostile transport retention is a nonclaim.
  }
}

function executionResult(
  state: RegistryState,
  status: "denied" | "failed",
  reasonCode: ConnectedSourceExecutionFailureReason,
): ConnectedSourceExecutionResult {
  return Object.freeze({
    budget: state.config.enabled ? budgetStatus(state) : null,
    reasonCode,
    status,
  });
}

function wouldExceed(used: number, amount: number, limit: number): boolean {
  return amount > limit - used;
}

function admitSourcePolicy(
  state: RegistryState,
  value: unknown,
): ConnectedSourcePolicyAdmissionResult {
  if (!state.config.enabled) {
    return rejectedAdmission(state, "DISABLED");
  }
  if (state.terminal?.status === "killed") {
    return rejectedAdmission(state, "KILLED");
  }
  let policy: ConnectedSourcePolicyDocument;
  try {
    policy = parsePolicyDocument(value);
  } catch {
    return rejectedAdmission(state, "POLICY_INVALID");
  }
  if (state.policy !== undefined) {
    return rejectedAdmission(
      state,
      state.policy.policyId === policy.policyId &&
        state.policy.policyVersion === policy.policyVersion
        ? "POLICY_REPLAYED"
        : "POLICY_ALREADY_ADMITTED",
    );
  }
  state.policy = policy;
  if (
    policy.sourceId !== state.config.sourceId ||
    !isCompatible(state.config, policy)
  ) {
    terminateRegistry(state, "incompatible", "POLICY_INCOMPATIBLE");
    return rejectedAdmission(state, "POLICY_INCOMPATIBLE");
  }
  const generation = state.generation;
  const instant = registryInstant(state);
  if (
    instant === undefined ||
    state.generation !== generation ||
    state.terminal !== undefined
  ) {
    return rejectedAdmission(state, admissionTerminalReason(state));
  }
  const policyState = evaluatePolicyTime(policy, instant);
  if (policyState !== null) {
    terminateRegistry(state, policyState.status, policyState.reasonCode);
    return rejectedAdmission(
      state,
      policyState.status === "expired"
        ? "POLICY_EXPIRED"
        : policyState.status === "revoked"
          ? "POLICY_REVOKED"
          : "POLICY_INCOMPATIBLE",
    );
  }
  if (state.generation !== generation || state.terminal !== undefined) {
    return rejectedAdmission(state, admissionTerminalReason(state));
  }
  return Object.freeze({
    policyStatus: statusResult(state, "ready", null, budgetStatus(state)),
    status: "admitted" as const,
  });
}

function admissionTerminalReason(
  state: RegistryState,
): Extract<
  ConnectedSourcePolicyAdmissionResult,
  { status: "rejected" }
>["reasonCode"] {
  if (state.terminal?.status === "killed") return "KILLED";
  if (state.terminal?.status === "expired") return "POLICY_EXPIRED";
  if (state.terminal?.status === "revoked") return "POLICY_REVOKED";
  return "POLICY_INCOMPATIBLE";
}

function rejectedAdmission(
  state: RegistryState,
  reasonCode: Extract<
    ConnectedSourcePolicyAdmissionResult,
    { status: "rejected" }
  >["reasonCode"],
): ConnectedSourcePolicyAdmissionResult {
  return Object.freeze({
    policyStatus: registryStatus(state),
    reasonCode,
    status: "rejected" as const,
  });
}

function killRegistry(state: RegistryState): ConnectedSourceKillResult {
  const alreadyKilled = state.terminal?.status === "killed";
  if (!alreadyKilled) {
    terminateRegistry(state, "killed", "OWNER_KILL_SWITCH", true);
  }
  return Object.freeze({
    policyStatus: registryStatus(state),
    status: alreadyKilled ? ("already_killed" as const) : ("killed" as const),
  });
}

function registryStatus(state: RegistryState): ConnectedSourcePolicyStatus {
  if (!state.config.enabled) {
    return statusResult(state, "disabled", "NOT_EXPLICITLY_ENABLED", null);
  }
  if (state.terminal !== undefined) {
    return statusResult(
      state,
      state.terminal.status,
      state.terminal.reasonCode,
      budgetStatus(state),
    );
  }
  if (state.policy === undefined) {
    return statusResult(
      state,
      "incompatible",
      "POLICY_NOT_ADMITTED",
      budgetStatus(state),
    );
  }
  const instant = registryInstant(state);
  if (instant === undefined || state.terminal !== undefined) {
    const terminal = state.terminal ?? {
      reasonCode: "CLOCK_INVALID" as const,
      status: "incompatible" as const,
    };
    return statusResult(
      state,
      terminal.status,
      terminal.reasonCode,
      budgetStatus(state),
    );
  }
  const policyState = evaluatePolicyTime(state.policy, instant);
  if (policyState !== null) {
    terminateRegistry(state, policyState.status, policyState.reasonCode);
    return statusResult(
      state,
      policyState.status,
      policyState.reasonCode,
      budgetStatus(state),
    );
  }
  return statusResult(state, "ready", null, budgetStatus(state));
}

function statusResult(
  state: RegistryState,
  status: ConnectedSourcePolicyStatusValue,
  reasonCode: ConnectedSourceStatusReason | null,
  budget: ConnectedSourceBudgetStatus | null,
): ConnectedSourcePolicyStatus {
  return Object.freeze({
    budget,
    policyId: state.policy?.policyId ?? null,
    policyVersion: state.policy?.policyVersion ?? null,
    profile: CONNECTED_SOURCE_POLICY_PROFILE,
    reasonCode,
    schemaVersion: CONNECTED_SOURCE_POLICY_SCHEMA_VERSION,
    sourceId: state.config.enabled ? state.config.sourceId : null,
    status,
  });
}

function registryInstant(state: RegistryState): number | undefined {
  const now = state.dependencies.clockNow;
  if (now === undefined) {
    terminateRegistry(state, "incompatible", "CLOCK_UNAVAILABLE");
    return undefined;
  }
  try {
    const value = now();
    const instant = strictInstantValue(value);
    if (instant === undefined) throw new TypeError();
    return Date.parse(instant);
  } catch {
    terminateRegistry(state, "incompatible", "CLOCK_INVALID");
    return undefined;
  }
}

function evaluatePolicyTime(
  policy: ConnectedSourcePolicyDocument,
  instant: number,
): TerminalState | null {
  const revokedAt =
    policy.validity.revokedAt === null
      ? null
      : Date.parse(policy.validity.revokedAt);
  if (revokedAt !== null && instant >= revokedAt) {
    return { reasonCode: "POLICY_REVOKED", status: "revoked" };
  }
  if (instant >= Date.parse(policy.validity.expiresAt)) {
    return { reasonCode: "POLICY_EXPIRED", status: "expired" };
  }
  if (instant < Date.parse(policy.validity.effectiveAt)) {
    return { reasonCode: "POLICY_NOT_EFFECTIVE", status: "incompatible" };
  }
  if (instant >= Date.parse(policy.validity.reviewAt)) {
    return { reasonCode: "POLICY_REVIEW_DUE", status: "incompatible" };
  }
  return null;
}

function isCompatible(
  config: Extract<ConnectedSourcePolicyConfig, { enabled: true }>,
  policy: ConnectedSourcePolicyDocument,
): boolean {
  const use = config.intendedUse;
  const controls = policy.controls;
  return (
    policy.useScope.purposes.includes(use.purpose) &&
    policy.useScope.geographies.includes(use.geography) &&
    policy.useScope.devices.includes(use.device) &&
    (!controls.attribution.required || use.attributionSupported) &&
    (use.display === "none" || controls.display.mode === "owner_local") &&
    (use.derivation === "none" || controls.derivation.mode === "owner_local") &&
    (use.cacheSeconds === 0 || controls.cache.mode === "owner_local") &&
    use.cacheSeconds <= controls.cache.maxSeconds &&
    (use.historyDays === 0 || controls.history.mode === "owner_local") &&
    use.historyDays <= controls.history.maxDays &&
    (use.export === "none" || controls.export.mode === "owner_local") &&
    use.retentionSeconds <= controls.retention.maxSeconds &&
    (!controls.deletion.required || use.deletionSupported) &&
    (!(
      controls.termination.deleteOnExpiry ||
      controls.termination.deleteOnIncompatibility ||
      controls.termination.deleteOnRevocation
    ) ||
      use.terminationSupported)
  );
}

function terminateRegistry(
  state: RegistryState,
  status: TerminalState["status"],
  reasonCode: ConnectedSourceStatusReason,
  force = false,
): void {
  if (state.terminal !== undefined && !force) return;
  state.terminal = Object.freeze({ reasonCode, status });
  state.generation += 1;
  for (const capability of state.admissions) {
    const admission = admittedOperations.get(capability);
    if (admission !== undefined) admission.active = false;
    admittedOperations.delete(capability);
  }
  state.admissions.clear();
  for (const capability of state.reservations) {
    const reservation = budgetReservations.get(capability);
    if (reservation !== undefined) reservation.state = "consumed";
    budgetReservations.delete(capability);
  }
  state.reservations.clear();
  for (const capability of state.responses) {
    const response = responseCapabilities.get(capability);
    response?.bytes.fill(0);
    responseCapabilities.delete(capability);
  }
  state.responses.clear();
}

function budgetStatus(state: RegistryState): ConnectedSourceBudgetStatus {
  if (!state.config.enabled) configurationFail();
  const { budgets } = state.config;
  return Object.freeze({
    currency: budgets.currency,
    estimatedSpendMicrounits: budgetQuantity(
      state.usage.estimatedSpendMicrounits,
      budgets.estimatedSpendMicrounitsLimit,
    ),
    requestBytes: budgetQuantity(
      state.usage.requestBytes,
      budgets.requestByteLimit,
    ),
    requests: budgetQuantity(state.usage.requests, budgets.requestLimit),
    responseBytes: budgetQuantity(
      state.usage.responseBytes,
      budgets.responseByteLimit,
    ),
    storageBytes: budgetQuantity(
      state.usage.storageBytes,
      budgets.storageByteLimit,
    ),
  });
}

function budgetQuantity(
  used: number,
  limit: number,
): Readonly<{ limit: number; used: number }> {
  return Object.freeze({ limit, used });
}

function exactDescriptors(
  value: unknown,
  keys: readonly string[],
): Record<string, PropertyDescriptor> {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      isProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      inputFail();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    const expected = [...keys].sort();
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      ownKeys.length !== expected.length ||
      (ownKeys as string[]).sort().some((key, index) => key !== expected[index])
    ) {
      inputFail();
    }
    for (const key of expected) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        inputFail();
      }
    }
    return descriptors;
  } catch (error) {
    if (error instanceof ConnectedSourcePolicyValidationError) throw error;
    inputFail();
  }
}

function subsetDescriptors(
  value: unknown,
  keys: readonly string[],
): Record<string, PropertyDescriptor | undefined> {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      isProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      inputFail();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const allowed = new Set(keys);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== "string" || !allowed.has(key))) {
      inputFail();
    }
    for (const key of ownKeys as string[]) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        inputFail();
      }
    }
    return descriptors;
  } catch (error) {
    if (error instanceof ConnectedSourcePolicyValidationError) throw error;
    inputFail();
  }
}

function ownDataDescriptor(
  value: unknown,
  key: string,
): PropertyDescriptor | undefined {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      isProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    ) {
      return undefined;
    }
    return descriptor;
  } catch {
    return undefined;
  }
}

function arrayValues(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): readonly unknown[] {
  try {
    if (
      isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      inputFail();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      string,
      PropertyDescriptor
    >;
    const lengthDescriptor = descriptors.length;
    const length = lengthDescriptor?.value as unknown;
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < minimumLength ||
      length > maximumLength
    ) {
      inputFail();
    }
    const expected = [
      ...Array.from({ length }, (_, index) => String(index)),
      "length",
    ].sort();
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some((key) => typeof key !== "string") ||
      ownKeys.length !== expected.length ||
      (ownKeys as string[]).sort().some((key, index) => key !== expected[index])
    ) {
      inputFail();
    }
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        inputFail();
      }
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof ConnectedSourcePolicyValidationError) throw error;
    inputFail();
  }
}

function byteSnapshot(
  value: unknown,
  minimumBytes: number,
  maximumBytes: number,
): Uint8Array {
  try {
    const byteLength = byteArrayLength(value, minimumBytes);
    if (byteLength > maximumBytes) inputFail();
    const copy = new Uint8Array(byteLength);
    Uint8Array.prototype.set.call(copy, value as Uint8Array);
    return copy;
  } catch (error) {
    if (error instanceof ConnectedSourcePolicyValidationError) throw error;
    inputFail();
  }
}

function byteArrayLength(value: unknown, minimumBytes: number): number {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      isProxy(value) ||
      TYPED_ARRAY_TAG_DESCRIPTOR?.get === undefined ||
      TYPED_ARRAY_BUFFER_DESCRIPTOR?.get === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR?.get === undefined ||
      ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR?.get === undefined
    ) {
      inputFail();
    }
    const tag = TYPED_ARRAY_TAG_DESCRIPTOR.get.call(value) as unknown;
    const buffer = TYPED_ARRAY_BUFFER_DESCRIPTOR.get.call(value) as unknown;
    const byteLength = TYPED_ARRAY_BYTE_LENGTH_DESCRIPTOR.get.call(
      value,
    ) as unknown;
    const backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_DESCRIPTOR.get.call(
      buffer,
    ) as unknown;
    if (
      tag !== "Uint8Array" ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype ||
      typeof buffer !== "object" ||
      buffer === null ||
      isProxy(buffer) ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype ||
      typeof byteLength !== "number" ||
      typeof backingByteLength !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      byteLength < minimumBytes
    ) {
      inputFail();
    }
    return byteLength;
  } catch (error) {
    if (error instanceof ConnectedSourcePolicyValidationError) throw error;
    inputFail();
  }
}

function parseSortedTokenArray(
  value: unknown,
  maximumItems: number,
  maximumTokenLength: number,
): readonly string[] {
  return parseSortedStringArray(value, maximumItems, (candidate) =>
    strictPolicyToken(candidate, maximumTokenLength),
  );
}

function parseSortedStringArray(
  value: unknown,
  maximumItems: number,
  parser: (value: unknown) => string,
): readonly string[] {
  const values = arrayValues(value, 1, maximumItems);
  const result: string[] = [];
  let previous: string | undefined;
  for (const valueItem of values) {
    const parsed = parser(valueItem);
    if (previous !== undefined && parsed <= previous) policyFail();
    previous = parsed;
    result.push(parsed);
  }
  return Object.freeze(result);
}

function strictToken(value: unknown, maximumLength: number): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength ||
    !/^[A-Za-z][A-Za-z0-9._:-]*$/.test(value)
  ) {
    configurationFail();
  }
  return value;
}

function strictPolicyToken(value: unknown, maximumLength: number): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  ) {
    policyFail();
  }
  return value;
}

function strictPolicySourceId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !/^[A-Za-z][A-Za-z0-9._:-]*$/.test(value)
  ) {
    policyFail();
  }
  return value;
}

function strictSecretReference(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^owner-local-ref:v1:[a-z][a-z0-9_-]{0,31}:[a-z][a-z0-9_-]{0,63}$/.test(
      value,
    )
  ) {
    configurationFail();
  }
  return value;
}

function strictCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
    configurationFail();
  }
  return value;
}

function strictGeography(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{2}$/.test(value)) {
    policyFail();
  }
  return value;
}

function strictBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") configurationFail();
  return value;
}

function strictPolicyBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") policyFail();
  return value;
}

function strictUseMode(value: unknown): "none" | "owner_local" {
  if (value !== "none" && value !== "owner_local") configurationFail();
  return value;
}

function strictPolicyControlMode(value: unknown): "prohibited" | "owner_local" {
  if (value !== "prohibited" && value !== "owner_local") policyFail();
  return value;
}

function strictNonnegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    configurationFail();
  }
  return value;
}

function strictPositiveInteger(value: unknown): number {
  const parsed = strictNonnegativeInteger(value);
  if (parsed < 1) configurationFail();
  return parsed;
}

function strictBoundedPositiveInteger(value: unknown, maximum: number): number {
  const parsed = strictPositiveInteger(value);
  if (parsed > maximum) configurationFail();
  return parsed;
}

function strictPolicyNonnegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    policyFail();
  }
  return value;
}

function strictPolicyPositiveInteger(value: unknown): number {
  const parsed = strictPolicyNonnegativeInteger(value);
  if (parsed < 1) policyFail();
  return parsed;
}

function strictOperation(value: unknown): ConnectedSourceOperation {
  const operation = CONNECTED_SOURCE_POLICY_OPERATIONS.find(
    (candidate) => candidate === value,
  );
  if (operation === undefined) policyFail();
  return operation;
}

function strictHost(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 3 ||
    value.length > 253 ||
    value.includes("xn--") ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)
  ) {
    policyFail();
  }
  return value;
}

function strictHttpsUri(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    value.length > 2_048 ||
    !/^[\x21-\x7E]+$/.test(value) ||
    value.includes("%")
  ) {
    policyFail();
  }
  try {
    const uri = new URL(value);
    if (
      uri.protocol !== "https:" ||
      uri.username !== "" ||
      uri.password !== "" ||
      uri.port !== "" ||
      uri.search !== "" ||
      uri.hash !== "" ||
      uri.pathname === "/" ||
      uri.href !== value ||
      strictHost(uri.hostname) !== uri.hostname
    ) {
      policyFail();
    }
    return value;
  } catch (error) {
    if (error instanceof ConnectedSourcePolicyValidationError) throw error;
    policyFail();
  }
}

function strictInstant(value: unknown): string {
  const parsed = strictInstantValue(value);
  if (parsed === undefined) policyFail();
  return parsed;
}

function strictInstantValue(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return undefined;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  try {
    return new Date(milliseconds).toISOString() === value ? value : undefined;
  } catch {
    return undefined;
  }
}

function strictDisplayText(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 240 ||
    value.trim() !== value ||
    value.normalize("NFC") !== value ||
    /[\p{Cc}\p{Cf}\p{Cs}]/u.test(value) ||
    Array.from(value).length > 240
  ) {
    policyFail();
  }
  return value;
}

class ConnectedSourcePolicyValidationError extends Error {}

class ConnectedSourceBudgetOverrunError extends Error {}

function inputFail(): never {
  throw new ConnectedSourcePolicyValidationError();
}

function policyFail(): never {
  throw new ConnectedSourcePolicyValidationError();
}

function configurationFail(): never {
  throw new ConnectedSourcePolicyConfigurationError();
}
