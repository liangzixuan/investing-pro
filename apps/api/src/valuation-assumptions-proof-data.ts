import { createHash } from "node:crypto";
import {
  MANAGED_VALUATION_DCF_MODEL_VERSION,
  MANAGED_VALUATION_EXIT_MODEL_VERSION,
  encodeValuationAssumptionsPayload,
  parseManagedValuationAssumptionsCommand,
  parseValuationAssumptionEntry,
  type ManagedValuationAssumptionsCommand,
  type ValuationAssumptionEntry,
  type ValuationAssumptionsPayload,
} from "@research-cockpit/contracts";
import {
  admitManagedSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";
import type { ManagedValuationAssumptionsCatalog } from "./managed-workspace-catalog";
import {
  VALUATION_PROOF_CREATE_OPERATIONS,
  VALUATION_PROOF_SCHEMA_SHA256,
  VALUATION_PROOF_TARGET,
} from "./valuation-assumptions-proof-schema";

export { VALUATION_PROOF_TARGET } from "./valuation-assumptions-proof-schema";
export const VALUATION_PROOF_PHASES = Object.freeze([
  "schema",
  "preflight",
  "create-isolation",
  "stale",
  "prestage",
  "overlap",
  "rollback",
  "unknown",
  "capacity",
  "domain-guards",
  "historical-edit-and-catalog-review",
  "reopen",
  "remove",
  "reopen-empty",
] as const);
export type ValuationProofPhase = (typeof VALUATION_PROOF_PHASES)[number];
/** Source-derived ceilings; remote counts and persistence remain unqualified. */
export const VALUATION_PROOF_LIMITS = Object.freeze({
  schema: 2,
  preflight: 18,
  "create-isolation": 18,
  stale: 14,
  prestage: 19,
  overlap: 19,
  rollback: 10,
  unknown: 9,
  capacity: 8,
  "domain-guards": 15,
  "historical-edit-and-catalog-review": 18,
  reopen: 6,
  remove: 9,
  "reopen-empty": 2,
} as const satisfies Record<ValuationProofPhase, number>);
export const VALUATION_PROOF_PRINCIPALS = freeze({
  a: { userId: "proof-valuation-v1-a" },
  b: { userId: "proof-valuation-v1-b" },
  size: { userId: "proof-valuation-v1-size" },
} as const);
export type ValuationProofOwner = keyof typeof VALUATION_PROOF_PRINCIPALS;
type ACommandName =
  | "create"
  | "stale-winner"
  | "stale-loser"
  | "prestage-winner"
  | "prestage-loser"
  | "overlap-winner"
  | "overlap-loser"
  | "rollback"
  | "unknown"
  | "historical-edit"
  | "catalog-reviewed"
  | "remove"
  | "consumed-key-changed";
export type ValuationProofDomainName =
  | "foreign-cik"
  | "invented-listing"
  | "stable-rebound"
  | "stale-new-listing"
  | "unreviewed-display";
export type ValuationProofCommandName =
  ACommandName | "capacity" | "catalog-refused" | ValuationProofDomainName;
export interface ValuationProofCommands {
  readonly a: Readonly<
    Record<ACommandName, ManagedValuationAssumptionsCommand>
  >;
  readonly b: Readonly<{ create: ManagedValuationAssumptionsCommand }>;
  readonly size: Readonly<{ capacity: ManagedValuationAssumptionsCommand }>;
}
export const VALUATION_PROOF_CLOCKS = Object.freeze({
  successful: "actual_function_utc",
  refused: "2000-01-01T00:00:00.000Z",
} as const);
type CatalogVariant = "original" | "revised" | "rebound" | "overflow";
type Entry = ValuationAssumptionEntry;
type Payload = ValuationAssumptionsPayload;
type Command = ManagedValuationAssumptionsCommand;
type Json =
  | null
  | string
  | number
  | boolean
  | readonly Json[]
  | { readonly [key: string]: Json };
type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K];
};
const AS_OF = "2026-10-19T00:00:00.000Z";
const SOURCE = "capacity-valuation-invented-source";
const SOURCE_TEXT =
  "Invented valuation capacity identities; no real issuer, provider or owner data.\n";
const POLICY_TEXT =
  "Synthetic engineering data for offline valuation capacity qualification.\n";
const RAW = " Café 東京 📈 unfinished:-. \n";
const SCENARIOS = ["conservative", "base", "expansion"] as const;
const DCF_FIELDS = [
  "startingUnleveredCashFlowUsd",
  "enterpriseToEquityBridgeUsd",
  "dilutedShares",
  "forecastYears",
  "waccPercent",
  "terminalGrowthPercent",
] as const;
const EXIT_FIELDS = [
  "baseRevenue",
  "cash",
  "debt",
  "dilutedShares",
  "horizonYears",
  "discountRatePercent",
] as const;
const EXIT_SCENARIO_FIELDS = [
  "annualRevenueGrowthPercent",
  "targetEbitdaMarginPercent",
  "exitMultiple",
] as const;
const CREATE_KEY = "proof-valuation-v1-create";
const DOMAIN_KEY = "proof-valuation-v1-a-catalog-refused";

function identityId(index: number, kind: string): string {
  const suffix = String(index).padStart(2, "0");
  return `capacity-valuation-${kind}-${suffix}-`.padEnd(128, "x");
}
function identityName(index: number, kind: string): string {
  const prefix = `Invented ${kind} ${String(index).padStart(2, "0")} · Café 東京 📈 `;
  return prefix + "𐐀".repeat(128 - [...prefix].length);
}
function variantIdentity(
  item: Entry["listing"],
  variant: CatalogVariant,
  index: number,
): Entry["listing"] {
  if (index !== 0) return item;
  if (variant === "revised")
    return {
      ...item,
      issuerName: "Revised invented issuer · 東京",
      symbol: "REVISED00",
    };
  if (variant === "rebound")
    return { ...item, securityId: identityId(index, "rebound-security") };
  return item;
}
function identity(
  index: number,
  variant: CatalogVariant = "original",
): Entry["listing"] {
  return variantIdentity(
    {
      country: "US",
      exchangeMic: index % 2 === 0 ? "XNAS" : "XNYS",
      instrumentType: "common_stock",
      issuerId: identityId(index, "issuer"),
      issuerName: identityName(index, "issuer"),
      listingId: identityId(index, "listing"),
      securityId: identityId(index, "security"),
      securityName: identityName(index, "security"),
      shareClassId: identityId(index, "class"),
      shareClassName: identityName(index, "class"),
      symbol: `CAP${String(index).padStart(2, "0")}`,
    },
    variant,
    index,
  );
}
function provenance() {
  const digest = `sha256:${hash(SOURCE_TEXT)}`;
  return {
    acquiredAt: AS_OF,
    artifacts: [
      {
        acquiredAt: AS_OF,
        artifactId: "capacity-valuation-invented-artifact",
        contentSha256: digest,
        mediaType: "text/plain",
        sourceUri: "https://example.invalid/valuation-capacity/invented.txt",
        sourceVersion: "1.0.0",
      },
    ],
    attribution: SOURCE_TEXT.trim(),
    contentKind: "synthetic_engineering",
    sourceId: SOURCE,
    sourceLocator: `managed-composite-manifest:${digest}`,
    sourceRevision: digest,
  };
}
function sourcePolicy() {
  return {
    attribution: "required",
    cache: "permitted_managed",
    decision: "compatible",
    deleteOnRequest: true,
    display: "permitted_managed",
    effectiveAt: AS_OF,
    expiresAt: "9999-12-31T23:59:59.999Z",
    export: "permitted_with_attribution",
    intendedUse: "personal_security_research",
    localOnly: false,
    operation: "fetch_snapshot",
    policyDocumentSha256: `sha256:${hash(POLICY_TEXT)}`,
    policyId: "capacity-valuation-synthetic-policy",
    policyProfile: "personal_single_user_managed_connected",
    policySchemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    redistribution: "permitted_with_attribution",
    retention: "permitted_managed",
    reviewedAt: AS_OF,
    revocationCheck: "offline_snapshot_only_cannot_discover_later_revocation",
    revokedAt: null,
    rightsBasis: "reviewed_redistributable_source",
    search: "permitted_managed",
    sourceId: SOURCE,
  };
}
function sourceMappings(items: readonly Entry["listing"][]) {
  return items.flatMap((item, index) => [
    {
      mappingId: `capacity-valuation-map-${String(index).padStart(2, "0")}-class`,
      mappingKind: "share_class",
      providerId: "capacity-valuation-invented-provider",
      providerSecurityId: `invented-class-${String(index).padStart(2, "0")}`,
      targetId: item.shareClassId,
    },
    {
      mappingId: `capacity-valuation-map-${String(index).padStart(2, "0")}-listing`,
      mappingKind: "listing",
      providerId: "capacity-valuation-invented-provider",
      providerSecurityId: `invented-listing-${String(index).padStart(2, "0")}`,
      targetId: item.listingId,
    },
  ]);
}
function sourceRecord(item: Entry["listing"]) {
  const listing = {
    active: true,
    country: item.country,
    currentSymbol: item.symbol,
    exchangeMic: item.exchangeMic,
    exchangeMicType: "operating",
    listingId: item.listingId,
    securityId: item.securityId,
    shareClassId: item.shareClassId,
    tickerHistory: [
      {
        listingId: item.listingId,
        symbol: item.symbol,
        timeBasis: "prospective_snapshot_observed",
        validFrom: AS_OF,
        validTo: null,
      },
    ],
  };
  return {
    active: true,
    eligibility: "eligible",
    instrumentType: item.instrumentType,
    issuerId: item.issuerId,
    securityId: item.securityId,
    securityName: item.securityName,
    shareClasses: [
      {
        active: true,
        securityId: item.securityId,
        shareClassId: item.shareClassId,
        shareClassName: item.shareClassName,
        listings: [listing],
      },
    ],
  };
}
function catalogSnapshot(variant: CatalogVariant): string {
  const count = variant === "overflow" ? 21 : 20;
  const items = Array.from({ length: count }, (_, index) =>
    identity(index, variant),
  );
  const versions = {
    original: "1.0.0",
    revised: "1.0.1",
    rebound: "1.0.2",
    overflow: "1.0.0",
  };
  return (
    canonical({
      asOf: AS_OF,
      catalogId: "capacity-valuation-invented-catalog",
      catalogVersion: versions[variant],
      generatedAt: AS_OF,
      issuers: items.map((item, index) => ({
        cik: String(index + 1).padStart(10, "0"),
        issuerId: item.issuerId,
        issuerName: item.issuerName,
      })),
      profile: "personal_single_user_managed_security_master",
      provenance: provenance(),
      providerMappings: sourceMappings(items),
      records: items.map(sourceRecord),
      schemaVersion: "1.0.0",
      sourceCoverage: {
        admittedRecords: count,
        ineligibleRecords: 0,
        quarantinedRecords: 0,
        sourceRecords: count,
        staleRecords: 0,
        unsupportedRecords: 0,
      },
      sourcePolicyCompatibility: sourcePolicy(),
    }) + "\n"
  );
}
export const VALUATION_PROOF_SNAPSHOTS = Object.freeze({
  original: catalogSnapshot("original"),
  revised: catalogSnapshot("revised"),
  rebound: catalogSnapshot("rebound"),
  overflow: catalogSnapshot("overflow"),
});
function project(catalog: ManagedSecurityMasterCatalog, listingId: string) {
  const item = lookupPersonalSecurityMasterListing(catalog, listingId);
  if (!item) return null;
  return Object.freeze({
    country: item.country,
    exchangeMic: item.exchangeMic,
    instrumentType: item.instrumentType,
    issuerId: item.issuerId,
    issuerName: item.issuerName,
    listingId: item.listingId,
    securityId: item.securityId,
    securityName: item.securityName,
    shareClassId: item.shareClassId,
    shareClassName: item.shareClassName,
    symbol: item.symbol,
    cik: item.cik,
  });
}
function admittedPort(
  variant: CatalogVariant,
): ManagedValuationAssumptionsCatalog {
  const snapshot = VALUATION_PROOF_SNAPSHOTS[variant];
  const catalog = admitManagedSecurityMasterSnapshot({
    snapshot: new TextEncoder().encode(snapshot),
    expectedSha256: `sha256:${hash(snapshot)}`,
  });
  return Object.freeze({
    snapshotSha256: catalog.snapshotSha256,
    lookup: (id: string) => project(catalog, id),
  });
}
function dcfInputs() {
  return {
    ...Object.fromEntries(DCF_FIELDS.map((field) => [field, RAW])),
    scenarios: Object.fromEntries(
      SCENARIOS.map((name) => [name, { annualCashFlowGrowthPercent: RAW }]),
    ),
  };
}
function exitInputs() {
  return {
    ...Object.fromEntries(EXIT_FIELDS.map((field) => [field, RAW])),
    scenarios: Object.fromEntries(
      SCENARIOS.map((name) => [
        name,
        Object.fromEntries(EXIT_SCENARIO_FIELDS.map((field) => [field, RAW])),
      ]),
    ),
  };
}
function rawEntry(
  catalog: ManagedValuationAssumptionsCatalog,
  index = 0,
): Entry {
  const found = catalog.lookup(identity(index).listingId);
  if (!found) throw new Error("Missing fixed valuation proof identity");
  const { cik, ...listing } = found;
  const entry = parseValuationAssumptionEntry({
    catalogSnapshotSha256: catalog.snapshotSha256,
    listing,
    cik,
    dcf: {
      modelVersion: MANAGED_VALUATION_DCF_MODEL_VERSION,
      inputs: dcfInputs(),
    },
    exit: {
      modelVersion: MANAGED_VALUATION_EXIT_MODEL_VERSION,
      inputs: exitInputs(),
    },
  });
  if (!entry) throw new Error("Invalid fixed valuation proof entry");
  return entry;
}
function payload(
  catalog: ManagedValuationAssumptionsCatalog,
  text: string,
): Payload {
  const entry = copy(rawEntry(catalog));
  entry.dcf.inputs.startingUnleveredCashFlowUsd = text;
  return freeze({ schemaVersion: 1, entries: [entry] });
}
function command(
  expectedVersion: number,
  payload: Payload,
  key: string,
): Command {
  const result = parseManagedValuationAssumptionsCommand({
    expectedVersion,
    idempotencyKey: key,
    payload,
  });
  if (!result) throw new Error("Invalid fixed valuation proof command");
  return result;
}
function aCommands(
  catalog: ManagedValuationAssumptionsCatalog,
  revised: ManagedValuationAssumptionsCatalog,
): ValuationProofCommands["a"] {
  const changed = (version: number, name: ACommandName) =>
    command(
      version,
      payload(catalog, `${RAW}${name}`),
      `proof-valuation-v1-a-${name}`,
    );
  const historical = payload(catalog, `${RAW}historical-edit`);
  const current = copy(historical);
  const replacement = rawEntry(revised);
  current.entries[0]!.listing = copy(replacement.listing);
  current.entries[0]!.catalogSnapshotSha256 = replacement.catalogSnapshotSha256;
  return {
    create: command(0, payload(catalog, `${RAW}a/create`), CREATE_KEY),
    "stale-winner": changed(1, "stale-winner"),
    "stale-loser": changed(1, "stale-loser"),
    "prestage-winner": changed(2, "prestage-winner"),
    "prestage-loser": changed(2, "prestage-loser"),
    "overlap-winner": changed(3, "overlap-winner"),
    "overlap-loser": changed(3, "overlap-loser"),
    rollback: changed(4, "rollback"),
    unknown: changed(4, "unknown"),
    "historical-edit": command(
      5,
      historical,
      "proof-valuation-v1-a-historical-edit",
    ),
    "catalog-reviewed": command(
      6,
      current,
      "proof-valuation-v1-a-catalog-review",
    ),
    remove: command(
      7,
      { schemaVersion: 1, entries: [] },
      "proof-valuation-v1-a-remove",
    ),
    "consumed-key-changed": command(
      5,
      payload(catalog, `${RAW}changed consumed key`),
      CREATE_KEY,
    ),
  };
}
interface RawLocation {
  readonly map: Record<string, unknown>;
  readonly key: string;
}
function entryRawLocations(item: Mutable<Entry>): RawLocation[] {
  return [
    ...DCF_FIELDS.map((key) => ({ map: item.dcf.inputs, key })),
    ...EXIT_FIELDS.map((key) => ({ map: item.exit.inputs, key })),
    ...SCENARIOS.flatMap((name) => [
      {
        map: item.dcf.inputs.scenarios[name],
        key: "annualCashFlowGrowthPercent",
      },
      ...EXIT_SCENARIO_FIELDS.map((key) => ({
        map: item.exit.inputs.scenarios[name],
        key,
      })),
    ]),
  ];
}
function rawText({ map, key }: RawLocation): string {
  const value = map[key];
  if (typeof value !== "string")
    throw new Error("Invalid fixed valuation raw coordinate");
  return value;
}
function rawLocations(value: Mutable<Payload>): RawLocation[] {
  return value.entries.flatMap(entryRawLocations);
}
function smallCapacity(
  catalog: ManagedValuationAssumptionsCatalog,
  count: number,
): Payload {
  return freeze({
    schemaVersion: 1,
    entries: Array.from({ length: count }, (_, index) =>
      rawEntry(catalog, index),
    ),
  });
}
function capacity(catalog: ManagedValuationAssumptionsCatalog): Payload {
  const value = copy(smallCapacity(catalog, 20));
  let remaining = 262144 - Buffer.byteLength(JSON.stringify(value));
  for (const location of rawLocations(value)) {
    const text = rawText(location);
    const append = Math.min(512 - [...text].length, remaining);
    location.map[location.key] = text + "x".repeat(append);
    remaining -= append;
  }
  if (remaining !== 0) throw new Error("Unachievable fixed valuation capacity");
  return command(0, value, "proof-valuation-v1-size-capacity").payload;
}
export interface ValuationProofDomainCommand {
  readonly name: ValuationProofDomainName;
  readonly catalog: "revised";
  readonly command: Command;
}
function domainCommands(
  catalog: ManagedValuationAssumptionsCatalog,
  revised: ManagedValuationAssumptionsCatalog,
  rebound: ManagedValuationAssumptionsCatalog,
): readonly ValuationProofDomainCommand[] {
  const original = rawEntry(catalog);
  const foreign = { ...original, cik: "0000000999" };
  const invented = { ...original, listing: identity(20), cik: "0000000021" };
  const display = { ...original, listing: rawEntry(revised).listing };
  const entries = {
    "foreign-cik": foreign,
    "invented-listing": invented,
    "stable-rebound": rawEntry(rebound),
    "stale-new-listing": rawEntry(catalog, 1),
    "unreviewed-display": display,
  };
  return (Object.entries(entries) as [ValuationProofDomainName, Entry][]).map(
    ([name, entry]) => ({
      name,
      catalog: "revised",
      command: command(5, { schemaVersion: 1, entries: [entry] }, DOMAIN_KEY),
    }),
  );
}
function byteOverflow(value: Payload): Payload {
  const payload = copy(value);
  const location = rawLocations(payload).find(
    (item) => [...rawText(item)].length < 512,
  );
  if (!location) throw new Error("Missing fixed valuation overflow coordinate");
  location.map[location.key] = rawText(location) + "x";
  return freeze(payload);
}
function invalidEntryVariants(catalog: ManagedValuationAssumptionsCatalog) {
  const entry = rawEntry(catalog);
  const tooLong = copy(entry);
  tooLong.dcf.inputs.startingUnleveredCashFlowUsd = "📈" + "x".repeat(512);
  const malformed = copy(entry);
  malformed.exit.inputs.cash = "\uD800";
  return {
    "input-codepoints-513": tooLong,
    "malformed-unicode": malformed,
    "unknown-model-field": { ...entry, dcf: { ...entry.dcf, extra: "refuse" } },
    "unknown-model-version": {
      ...entry,
      exit: { ...entry.exit, modelVersion: "unknown-v1" },
    },
    "missing-model-field": {
      ...entry,
      dcf: { modelVersion: MANAGED_VALUATION_DCF_MODEL_VERSION, inputs: {} },
    },
  };
}
function invalidCommands(
  catalog: ManagedValuationAssumptionsCatalog,
  overflow: ManagedValuationAssumptionsCatalog,
  size: Command,
) {
  const base = {
    expectedVersion: 0,
    idempotencyKey: "proof-valuation-v1-invalid",
  };
  const malformedEntries = Object.entries(invalidEntryVariants(catalog)).map(
    ([name, entry]) => ({
      name,
      command: { ...base, payload: { schemaVersion: 1, entries: [entry] } },
    }),
  );
  const one = rawEntry(catalog);
  return [
    ...malformedEntries,
    {
      name: "payload-bytes-262145",
      command: { ...base, payload: byteOverflow(size.payload) },
    },
    {
      name: "entries-21",
      command: { ...base, payload: smallCapacity(overflow, 21) },
    },
    {
      name: "duplicate-listing",
      command: { ...base, payload: { schemaVersion: 1, entries: [one, one] } },
    },
    { name: "unknown-command-field", command: { ...size, extra: true } },
    { name: "negative-version", command: { ...size, expectedVersion: -1 } },
    { name: "invalid-key", command: { ...size, idempotencyKey: "short" } },
    { name: "malformed-envelope", command: null },
  ];
}
function assemble() {
  const catalog = admittedPort("original"),
    revisedCatalog = admittedPort("revised");
  const reboundCatalog = admittedPort("rebound"),
    overflowCatalog = admittedPort("overflow");
  const commands: ValuationProofCommands = {
    a: aCommands(catalog, revisedCatalog),
    b: { create: command(0, payload(catalog, `${RAW}b/create`), CREATE_KEY) },
    size: {
      capacity: command(
        0,
        capacity(catalog),
        "proof-valuation-v1-size-capacity",
      ),
    },
  };
  return freeze({
    catalog,
    revisedCatalog,
    reboundCatalog,
    overflowCatalog,
    snapshots: VALUATION_PROOF_SNAPSHOTS,
    commands,
    domainCommands: domainCommands(catalog, revisedCatalog, reboundCatalog),
    invalidCommands: invalidCommands(
      catalog,
      overflowCatalog,
      commands.size.capacity,
    ),
  });
}
const DATA = assemble();
export function valuationProofData() {
  return DATA;
}
export const VALUATION_PROOF_CATALOG_PINS = freeze(
  (Object.entries(VALUATION_PROOF_SNAPSHOTS) as [CatalogVariant, string][]).map(
    ([name, text]) => ({
      name,
      bytes: Buffer.byteLength(text),
      sha256: `sha256:${hash(text)}`,
    }),
  ),
);
interface NamedCommand {
  readonly owner: ValuationProofOwner;
  readonly name: ValuationProofCommandName;
  readonly command: Command;
}
function namedCommands(): readonly NamedCommand[] {
  const normal = (
    Object.entries(DATA.commands) as [
      ValuationProofOwner,
      Readonly<Partial<Record<ValuationProofCommandName, Command>>>,
    ][]
  ).flatMap(([owner, commands]) =>
    (Object.entries(commands) as [ValuationProofCommandName, Command][]).map(
      ([name, command]) => ({ owner, name, command }),
    ),
  );
  return [
    ...normal,
    ...DATA.domainCommands.map(({ name, command }) => ({
      owner: "a" as const,
      name,
      command,
    })),
  ];
}
function commandPin({ owner, name, command }: NamedCommand) {
  const payload = encodeValuationAssumptionsPayload(command.payload);
  const text = JSON.stringify(command);
  const request = {
    expectedVersion: command.expectedVersion,
    resource: "valuation-assumptions",
    id: "main",
    operation: "put",
    payloadSha256: hash(payload),
  };
  return {
    owner,
    name,
    expectedVersion: command.expectedVersion,
    idempotencyKey: command.idempotencyKey,
    keySha256: hash(command.idempotencyKey),
    payloadBytes: Buffer.byteLength(payload),
    payloadSha256: hash(payload),
    commandBytes: Buffer.byteLength(text),
    commandSha256: hash(text),
    requestSha256: hash(JSON.stringify(request)),
  };
}
export const VALUATION_PROOF_COMMAND_PINS = freeze(
  namedCommands().map(commandPin),
);
export interface ValuationProofRow {
  readonly owner: ValuationProofOwner;
  readonly name: ValuationProofCommandName | null;
  readonly databaseId: string;
  readonly tableId: string;
  readonly rowId: string;
  readonly expectedPresentAfterProof: boolean;
}
const WINNERS = new Set<ValuationProofCommandName>([
  "create",
  "stale-winner",
  "prestage-winner",
  "overlap-winner",
  "unknown",
  "historical-edit",
  "catalog-reviewed",
  "remove",
  "capacity",
]);
function row(
  owner: ValuationProofOwner,
  name: ValuationProofCommandName | null,
  key?: string,
): ValuationProofRow {
  const namespace = [
    VALUATION_PROOF_PRINCIPALS[owner].userId,
    "valuation-assumptions",
    "main",
  ];
  return {
    owner,
    name,
    databaseId: VALUATION_PROOF_TARGET.databaseId,
    tableId:
      name === null
        ? VALUATION_PROOF_TARGET.currentTableId
        : VALUATION_PROOF_TARGET.receiptsTableId,
    rowId:
      (name === null ? "v" : "r") +
      hash(
        JSON.stringify(key === undefined ? namespace : [...namespace, key]),
      ).slice(0, 32),
    expectedPresentAfterProof: name === null || WINNERS.has(name),
  };
}
function rows(): readonly ValuationProofRow[] {
  const manifest = [row("a", null), row("b", null), row("size", null)];
  for (const pin of VALUATION_PROOF_COMMAND_PINS) {
    const item = row(pin.owner, pin.name, pin.idempotencyKey);
    if (manifest.some((existing) => existing.rowId === item.rowId)) continue;
    const name = DATA.domainCommands.some((entry) => entry.name === pin.name)
      ? "catalog-refused"
      : pin.name;
    manifest.push({ ...item, name });
  }
  return freeze(manifest);
}
export const VALUATION_PROOF_ROWS = rows();
export function valuationProofLocation(
  owner: ValuationProofOwner,
  name?: ValuationProofCommandName,
) {
  if (name === "catalog-refused")
    return fixedLocation(row(owner, name, DOMAIN_KEY));
  if (name === undefined) return fixedLocation(row(owner, null));
  const pin = VALUATION_PROOF_COMMAND_PINS.find(
    (item) => item.owner === owner && item.name === name,
  );
  if (!pin) throw new Error("Unknown fixed valuation proof location");
  return fixedLocation(row(owner, name, pin.idempotencyKey));
}
function fixedLocation(value: ValuationProofRow) {
  if (!VALUATION_PROOF_ROWS.some((item) => item.rowId === value.rowId))
    throw new Error("Unknown fixed valuation proof location");
  return Object.freeze({
    databaseId: value.databaseId,
    tableId: value.tableId,
    rowId: value.rowId,
  });
}
export const VALUATION_PROOF_ROWS_SHA256 = hash(
  JSON.stringify(VALUATION_PROOF_ROWS),
);
export const VALUATION_PROOF_COMMANDS_SHA256 = hash(
  JSON.stringify(VALUATION_PROOF_COMMAND_PINS),
);
export const VALUATION_PROOF_PLAN_SHA256 = hash(
  JSON.stringify({
    version: 1,
    target: VALUATION_PROOF_TARGET,
    schemaSha256: VALUATION_PROOF_SCHEMA_SHA256,
    createOperationsSha256: hash(
      JSON.stringify(VALUATION_PROOF_CREATE_OPERATIONS),
    ),
    phases: VALUATION_PROOF_PHASES,
    limits: VALUATION_PROOF_LIMITS,
    principals: VALUATION_PROOF_PRINCIPALS,
    rows: VALUATION_PROOF_ROWS,
    commands: VALUATION_PROOF_COMMAND_PINS,
    catalogs: VALUATION_PROOF_CATALOG_PINS,
    clocks: VALUATION_PROOF_CLOCKS,
    invalidCommandsSha256: hash(JSON.stringify(DATA.invalidCommands)),
  }),
);
function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function canonical(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((item: Json) => canonical(item)).join(",")}]`;
  const record = value as { readonly [key: string]: Json };
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key]!)}`)
    .join(",")}}`;
}
function copy<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
