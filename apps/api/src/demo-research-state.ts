import {
  InMemoryResearchStateUnitOfWork,
  ResearchStateService,
  type AlertRecord,
  type Clock,
  type IdGenerator,
  type InMemoryResearchStateSnapshot,
  type OrganizationMembership,
  type SyntheticActorContext,
  type ThesisRecord,
} from "@research-cockpit/research-state";

export const DEMO_PERSONA_HEADER_NAME = "x-demo-persona" as const;

/** Public fixture selectors for choosing a synthetic persona; never credentials. */
export const DEMO_PERSONA_SELECTORS = Object.freeze({
  alphaOwner: "synp_7f33c6a91d20",
  alphaResearcher: "synp_b4108e2c753d",
  alphaViewer: "synp_0d94f6b821ae",
  betaOwner: "synp_e62a1c9074bf",
  alphaInactive: "synp_5a6d91c20ef4",
  alphaNoMember: "synp_c8e2475b109d",
} as const);

export type DemoPersonaSelector =
  (typeof DEMO_PERSONA_SELECTORS)[keyof typeof DEMO_PERSONA_SELECTORS];

export const DEMO_ORGANIZATION_ALPHA_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as const;
export const DEMO_ORGANIZATION_BETA_ID =
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as const;

export const DEMO_ALPHA_OWNER_PRINCIPAL_ID =
  "11111111-1111-4111-8111-111111111111" as const;
export const DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID =
  "22222222-2222-4222-8222-222222222222" as const;
export const DEMO_ALPHA_VIEWER_PRINCIPAL_ID =
  "33333333-3333-4333-8333-333333333333" as const;
export const DEMO_BETA_OWNER_PRINCIPAL_ID =
  "44444444-4444-4444-8444-444444444444" as const;
export const DEMO_ALPHA_INACTIVE_PRINCIPAL_ID =
  "55555555-5555-4555-8555-555555555555" as const;
export const DEMO_ALPHA_NO_MEMBER_PRINCIPAL_ID =
  "88888888-8888-4888-8888-888888888888" as const;

export const DEMO_RESEARCH_INSTRUMENT_ID = "instrument.synthetic.syn1" as const;
export const DEMO_THESIS_ID = "66666666-6666-4666-8666-666666666666" as const;
export const DEMO_ALERT_ID = "77777777-7777-4777-8777-777777777777" as const;

export const DEMO_CONTEXT_AUTHORITY_HEADER_NAMES = Object.freeze([
  "x-organization-id",
  "x-principal-id",
  "x-membership-role",
  "x-tenant-id",
  "x-role",
] as const);

const ACTIVE_FROM = "2000-01-01T00:00:00.000Z";
const INACTIVE_AT = "2026-08-20T12:00:00.000Z";
const SEEDED_AT = "2026-08-15T21:00:00.000Z";

interface DemoPersonaIdentity {
  readonly organizationId: string;
  readonly principalId: string;
}

export interface DemoActorResolutionInput {
  readonly personaSelector: unknown;
  readonly remoteAddress: unknown;
  readonly requestHeaders: Readonly<Record<string, unknown>>;
}

export interface DemoResearchStateOptions {
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}

export interface DemoResearchStateComposition {
  readonly service: ResearchStateService;
  readonly resolveActor: (
    input: DemoActorResolutionInput,
  ) => SyntheticActorContext | null;
}

export interface DemoResearchStateTestHarness {
  readonly composition: DemoResearchStateComposition;
  readonly snapshotForTesting: () => Promise<InMemoryResearchStateSnapshot>;
}

export function createDemoResearchStateComposition(
  options: DemoResearchStateOptions = {},
): DemoResearchStateComposition {
  return createDemoResearchState(options).composition;
}

export function createDemoResearchStateTestHarness(
  options: DemoResearchStateOptions = {},
): DemoResearchStateTestHarness {
  const state = createDemoResearchState(options);
  return {
    composition: state.composition,
    snapshotForTesting: () => state.unitOfWork.snapshotForTesting(),
  };
}

function createDemoResearchState(options: DemoResearchStateOptions): {
  readonly composition: DemoResearchStateComposition;
  readonly unitOfWork: InMemoryResearchStateUnitOfWork;
} {
  const clock: Clock = options.clock ?? {
    now: () => new Date().toISOString(),
  };
  const ids: IdGenerator = options.ids ?? {
    next: () => globalThis.crypto.randomUUID(),
  };
  const unitOfWork = new InMemoryResearchStateUnitOfWork(
    {
      memberships: demoMemberships(),
      theses: demoTheses(),
      alerts: demoAlerts(),
    },
    clock,
  );

  return {
    composition: {
      service: new ResearchStateService(unitOfWork, clock, ids),
      resolveActor: resolveDemoActor,
    },
    unitOfWork,
  };
}

export function resolveDemoActor(
  input: DemoActorResolutionInput,
): SyntheticActorContext | null {
  if (
    !isExactDemoLoopbackRemoteAddress(input.remoteAddress) ||
    hasDemoContextAuthorityHeader(input.requestHeaders) ||
    typeof input.personaSelector !== "string"
  ) {
    return null;
  }

  const identity = demoPersonaIdentity(input.personaSelector);
  if (!identity) return null;

  return Object.freeze({
    organizationId: identity.organizationId,
    principalId: identity.principalId,
    requestId: `audit-${globalThis.crypto.randomUUID()}`,
    synthetic: true,
  });
}

export function isExactDemoLoopbackRemoteAddress(value: unknown): boolean {
  return (
    value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1"
  );
}

export function hasDemoContextAuthorityHeader(
  headers: Readonly<Record<string, unknown>>,
): boolean {
  const forbidden = new Set<string>(DEMO_CONTEXT_AUTHORITY_HEADER_NAMES);
  return Object.keys(headers).some((name) => forbidden.has(name.toLowerCase()));
}

function demoPersonaIdentity(selector: string): DemoPersonaIdentity | null {
  switch (selector) {
    case DEMO_PERSONA_SELECTORS.alphaOwner:
      return {
        organizationId: DEMO_ORGANIZATION_ALPHA_ID,
        principalId: DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      };
    case DEMO_PERSONA_SELECTORS.alphaResearcher:
      return {
        organizationId: DEMO_ORGANIZATION_ALPHA_ID,
        principalId: DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID,
      };
    case DEMO_PERSONA_SELECTORS.alphaViewer:
      return {
        organizationId: DEMO_ORGANIZATION_ALPHA_ID,
        principalId: DEMO_ALPHA_VIEWER_PRINCIPAL_ID,
      };
    case DEMO_PERSONA_SELECTORS.betaOwner:
      return {
        organizationId: DEMO_ORGANIZATION_BETA_ID,
        principalId: DEMO_BETA_OWNER_PRINCIPAL_ID,
      };
    case DEMO_PERSONA_SELECTORS.alphaInactive:
      return {
        organizationId: DEMO_ORGANIZATION_ALPHA_ID,
        principalId: DEMO_ALPHA_INACTIVE_PRINCIPAL_ID,
      };
    case DEMO_PERSONA_SELECTORS.alphaNoMember:
      return {
        organizationId: DEMO_ORGANIZATION_ALPHA_ID,
        principalId: DEMO_ALPHA_NO_MEMBER_PRINCIPAL_ID,
      };
    default:
      return null;
  }
}

function demoMemberships(): OrganizationMembership[] {
  return [
    membership(
      DEMO_ORGANIZATION_ALPHA_ID,
      DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      "owner",
    ),
    membership(
      DEMO_ORGANIZATION_ALPHA_ID,
      DEMO_ALPHA_RESEARCHER_PRINCIPAL_ID,
      "researcher",
    ),
    membership(
      DEMO_ORGANIZATION_ALPHA_ID,
      DEMO_ALPHA_VIEWER_PRINCIPAL_ID,
      "viewer",
    ),
    membership(
      DEMO_ORGANIZATION_BETA_ID,
      DEMO_BETA_OWNER_PRINCIPAL_ID,
      "owner",
    ),
    {
      organizationId: DEMO_ORGANIZATION_ALPHA_ID,
      principalId: DEMO_ALPHA_INACTIVE_PRINCIPAL_ID,
      role: "researcher",
      activeFrom: ACTIVE_FROM,
      activeTo: INACTIVE_AT,
    },
  ];
}

function membership(
  organizationId: string,
  principalId: string,
  role: OrganizationMembership["role"],
): OrganizationMembership {
  return {
    organizationId,
    principalId,
    role,
    activeFrom: ACTIVE_FROM,
    activeTo: null,
  };
}

function demoTheses(): ThesisRecord[] {
  return [
    thesis(
      DEMO_ORGANIZATION_ALPHA_ID,
      DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      "Alpha synthetic thesis canary.",
    ),
    thesis(
      DEMO_ORGANIZATION_BETA_ID,
      DEMO_BETA_OWNER_PRINCIPAL_ID,
      "Beta synthetic thesis canary.",
    ),
  ];
}

function thesis(
  organizationId: string,
  principalId: string,
  claim: string,
): ThesisRecord {
  const tenantLabel =
    organizationId === DEMO_ORGANIZATION_ALPHA_ID ? "Alpha" : "Beta";
  return {
    id: DEMO_THESIS_ID,
    organizationId,
    instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
    claim,
    evidence: `${tenantLabel} synthetic evidence canary.`,
    risks: `${tenantLabel} synthetic risk canary.`,
    invalidation: `${tenantLabel} synthetic invalidation canary.`,
    createdBy: principalId,
    createdAt: SEEDED_AT,
    updatedBy: principalId,
    updatedAt: SEEDED_AT,
    version: 1,
  };
}

function demoAlerts(): AlertRecord[] {
  return [
    alert(
      DEMO_ORGANIZATION_ALPHA_ID,
      DEMO_ALPHA_OWNER_PRINCIPAL_ID,
      "alpha_metric_canary",
      "11.125",
    ),
    alert(
      DEMO_ORGANIZATION_BETA_ID,
      DEMO_BETA_OWNER_PRINCIPAL_ID,
      "beta_metric_canary",
      "22.250",
    ),
  ];
}

function alert(
  organizationId: string,
  principalId: string,
  metricKey: string,
  threshold: string,
): AlertRecord {
  return {
    id: DEMO_ALERT_ID,
    organizationId,
    instrumentId: DEMO_RESEARCH_INSTRUMENT_ID,
    metricKey,
    operator: "above",
    threshold,
    createdBy: principalId,
    createdAt: SEEDED_AT,
    updatedBy: principalId,
    updatedAt: SEEDED_AT,
    version: 1,
  };
}
