import { createHash } from "node:crypto";
import {
  encodePortfolioPayload,
  parseManagedPortfolioCommand,
  type ManagedPortfolioCommand,
  type ManagedPortfolioPayload,
  type PersonalPortfolioIdentity,
  type PersonalPortfolioLedgerActivity,
} from "@research-cockpit/contracts";
import {
  admitManagedSecurityMasterSnapshot,
  lookupPersonalSecurityMasterListing,
  type ManagedSecurityMasterCatalog,
} from "@research-cockpit/personal-security-master";

export const PORTFOLIO_PROOF_TARGET = Object.freeze({
  endpoint: "https://nyc.cloud.appwrite.io/v1",
  project: "6abac57a0007b7c1a671",
  databaseId: "investment_managed_portfolio_v1",
  currentTableId: "portfolios",
  receiptsTableId: "receipts",
});
export const PORTFOLIO_PROOF_PHASES = Object.freeze([
  "preflight",
  "create",
  "isolation",
  "stale",
  "prestage",
  "overlap",
  "rollback",
  "unknown",
  "reopen",
  "capacity",
  "domain-guards",
] as const);
export type PortfolioProofPhase = (typeof PORTFOLIO_PROOF_PHASES)[number];
/** Proposed ceilings. Actual phase call counts require separate qualification. */
export const PORTFOLIO_PROOF_LIMITS = Object.freeze({
  preflight: 17,
  create: 16,
  isolation: 12,
  stale: 16,
  prestage: 20,
  overlap: 20,
  rollback: 12,
  unknown: 12,
  reopen: 2,
  capacity: 12,
  "domain-guards": 16,
} as const satisfies Record<PortfolioProofPhase, number>);
export const PORTFOLIO_PROOF_PRINCIPALS = freeze({
  a: { userId: "proof-portfolio-20261016-a" },
  b: { userId: "proof-portfolio-20261016-b" },
  size: { userId: "proof-portfolio-20261016-size" },
} as const);
export type PortfolioProofOwner = keyof typeof PORTFOLIO_PROOF_PRINCIPALS;
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
  | "future"
  | "rebind"
  | "stale-catalog";
export type PortfolioProofCommandName = ACommandName | "capacity";
export interface PortfolioProofCommands {
  readonly a: Readonly<Record<ACommandName, ManagedPortfolioCommand>>;
  readonly b: Readonly<{ create: ManagedPortfolioCommand }>;
  readonly size: Readonly<{ capacity: ManagedPortfolioCommand }>;
}
export const PORTFOLIO_PROOF_CLOCKS = Object.freeze({
  successful: "actual_function_utc",
  refused: "2000-01-01T00:00:00.000Z",
  futureActivityDate: "9999-12-31",
} as const);

const AS_OF = "2026-10-16T00:00:00.000Z";
const SOURCE = "proof-portfolio-invented-source";
const SOURCE_TEXT =
  "Invented Portfolio proof identities; no real issuers or provider data.\n";
const POLICY_TEXT =
  "Synthetic Portfolio proof data authored for internal qualification.\n";
type CatalogVariant = "original" | "revised" | "rebound";
type Json =
  | null
  | string
  | number
  | boolean
  | readonly Json[]
  | { readonly [key: string]: Json };

/** These constructors accept only source-owned variants, never request data. */
function identity(
  index: number,
  variant: CatalogVariant,
): PersonalPortfolioIdentity {
  const suffix = String(index).padStart(2, "0");
  const id = (kind: string) =>
    `proof-portfolio-${kind}-${suffix}-`.padEnd(128, "x");
  const name = (kind: string) => {
    const prefix = `Invented ${kind} ${suffix} · Café 東京 📈 `;
    return prefix + "𐐀".repeat(128 - [...prefix].length);
  };
  return {
    country: "US",
    exchangeMic: index % 2 === 0 ? "XNAS" : "XNYS",
    instrumentType: "common_stock",
    issuerId: id("issuer"),
    issuerName:
      variant === "revised" && index === 0
        ? "Revised invented issuer · 東京"
        : name("issuer"),
    listingId: id("listing"),
    securityId:
      variant === "rebound" && index === 0
        ? id("rebound-security")
        : id("security"),
    securityName: name("security"),
    shareClassId: id("class"),
    shareClassName: name("class"),
    symbol:
      variant === "revised" && index === 0 ? "REVISEDP00" : `PROOF${suffix}`,
  };
}

function catalogSnapshot(variant: CatalogVariant): string {
  const identities = Array.from({ length: 20 }, (_, i) => identity(i, variant));
  const records = identities
    .map((item) => ({
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
          listings: [
            {
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
            },
          ],
        },
      ],
    }))
    .sort((a, b) =>
      a.securityId < b.securityId ? -1 : a.securityId > b.securityId ? 1 : 0,
    );
  const sourceHash = `sha256:${hash(SOURCE_TEXT)}`;
  return (
    canonical({
      asOf: AS_OF,
      catalogId: "proof-portfolio-catalog",
      catalogVersion:
        variant === "original"
          ? "1.0.0"
          : variant === "revised"
            ? "1.0.1"
            : "1.0.2",
      generatedAt: AS_OF,
      issuers: identities.map((item, i) => ({
        cik: String(i + 1).padStart(10, "0"),
        issuerId: item.issuerId,
        issuerName: item.issuerName,
      })),
      profile: "personal_single_user_managed_security_master",
      provenance: {
        acquiredAt: AS_OF,
        artifacts: [
          {
            acquiredAt: AS_OF,
            artifactId: "proof-portfolio-invented-artifact",
            contentSha256: sourceHash,
            mediaType: "text/plain",
            sourceUri:
              "https://example.invalid/portfolio-proof/invented-identities.txt",
            sourceVersion: "1.0.0",
          },
        ],
        attribution: SOURCE_TEXT.trim(),
        contentKind: "synthetic_engineering",
        sourceId: SOURCE,
        sourceLocator: `managed-composite-manifest:${sourceHash}`,
        sourceRevision: sourceHash,
      },
      providerMappings: identities.flatMap((item, i) => [
        {
          mappingId: `proof-portfolio-map-${String(i).padStart(2, "0")}-class`,
          mappingKind: "share_class",
          providerId: "proof-portfolio-invented-provider",
          providerSecurityId: `invented-class-${String(i).padStart(2, "0")}`,
          targetId: item.shareClassId,
        },
        {
          mappingId: `proof-portfolio-map-${String(i).padStart(2, "0")}-listing`,
          mappingKind: "listing",
          providerId: "proof-portfolio-invented-provider",
          providerSecurityId: `invented-listing-${String(i).padStart(2, "0")}`,
          targetId: item.listingId,
        },
      ]),
      records,
      schemaVersion: "1.0.0",
      sourceCoverage: {
        admittedRecords: 20,
        ineligibleRecords: 0,
        quarantinedRecords: 0,
        sourceRecords: 20,
        staleRecords: 0,
        unsupportedRecords: 0,
      },
      sourcePolicyCompatibility: {
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
        policyId: "proof-portfolio-synthetic-policy",
        policyProfile: "personal_single_user_managed_connected",
        policySchemaVersion: "1.0.0",
        policyVersion: "1.0.0",
        redistribution: "permitted_with_attribution",
        retention: "permitted_managed",
        reviewedAt: AS_OF,
        revocationCheck:
          "offline_snapshot_only_cannot_discover_later_revocation",
        revokedAt: null,
        rightsBasis: "reviewed_redistributable_source",
        search: "permitted_managed",
        sourceId: SOURCE,
      },
    }) + "\n"
  );
}

export const PORTFOLIO_PROOF_SNAPSHOTS = Object.freeze({
  original: catalogSnapshot("original"),
  revised: catalogSnapshot("revised"),
  rebound: catalogSnapshot("rebound"),
});
export const PORTFOLIO_PROOF_CATALOG_PINS = freeze([
  {
    name: "original",
    bytes: 74599,
    sha256:
      "sha256:8df13e4cc880a162811cacce1cafb121787269f6795600e1dc8e862731e0ffad",
  },
  {
    name: "revised",
    bytes: 74210,
    sha256:
      "sha256:b9d768389cba36c4bf46fc00295e14294d677cfdbc598620ac6cc546ebf29c28",
  },
  {
    name: "rebound",
    bytes: 74599,
    sha256:
      "sha256:7dccf4de3ad379685d182a60e2bf103e83ac6cc1a56cb2324b93a69fc2a562e6",
  },
] as const);

function ledger(
  catalog: ManagedSecurityMasterCatalog,
  cashUsd: string | null,
): ManagedPortfolioPayload {
  const identities = [identity(0, "original"), identity(1, "original")].map(
    (item) => {
      const found = lookupPersonalSecurityMasterListing(
        catalog,
        item.listingId,
      );
      if (!found) throw new Error("Invalid Portfolio proof listing");
      return {
        country: found.country,
        exchangeMic: found.exchangeMic,
        instrumentType: found.instrumentType,
        issuerId: found.issuerId,
        issuerName: found.issuerName,
        listingId: found.listingId,
        securityId: found.securityId,
        securityName: found.securityName,
        shareClassId: found.shareClassId,
        shareClassName: found.shareClassName,
        symbol: found.symbol,
      };
    },
  );
  const first = identities[0]!.listingId,
    second = identities[1]!.listingId;
  const activity = (
    id: string,
    type: "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "fee",
    listingId: string | null,
    shares: string | null,
    grossUsd: string,
    feeUsd = "0.00",
  ) => ({
    id: `proof-portfolio-${id}`,
    date: "2026-10-02",
    type,
    listingId,
    shares,
    grossUsd,
    feeUsd,
  });
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: catalog.snapshotSha256,
    basisMethod: "fifo_with_opening_pool",
    identities,
    opening: {
      asOfDate: "2026-10-01",
      cashUsd,
      holdings: [
        {
          listingId: first,
          shares: "10.000000",
          totalCostBasisUsd: "100.00",
          confirmedOn: "2026-10-01",
        },
        {
          listingId: second,
          shares: "2.000000",
          totalCostBasisUsd: null,
          confirmedOn: "2026-10-01",
        },
      ],
    },
    transactions: [
      activity("deposit", "deposit", null, null, "200.00"),
      activity("buy", "buy", first, "2.000000", "60.00", "1.00"),
      {
        id: "proof-portfolio-manual-split",
        date: "2026-10-02",
        type: "split",
        listingId: first,
        ratioNumerator: "3",
        ratioDenominator: "2",
      },
      activity("known-sell", "sell", first, "3.000000", "45.00", "1.00"),
      activity("unknown-sell", "sell", second, "1.000000", "40.00"),
      activity("dividend", "dividend", first, null, "5.00"),
      activity("fee", "fee", null, null, "2.00"),
      activity("withdrawal", "withdrawal", null, null, "10.00"),
    ],
  };
}

function capacity(
  catalog: ManagedSecurityMasterCatalog,
): ManagedPortfolioPayload {
  const identities = Array.from({ length: 20 }, (_, i) =>
    identity(i, "original"),
  );
  const transactions: PersonalPortfolioLedgerActivity[] = Array.from(
    { length: 250 },
    (_, i) => ({
      id: `proof-portfolio-capacity-activity-${String(i).padStart(3, "0")}-`.padEnd(
        128,
        "x",
      ),
      date: "2026-10-02",
      type: "buy",
      listingId: identities[i % 20]!.listingId,
      shares: "0.000001",
      grossUsd: "0.01",
      feeUsd: "0.00",
    }),
  );
  return {
    schemaVersion: 3,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: catalog.snapshotSha256,
    basisMethod: "fifo_with_opening_pool",
    identities,
    opening: { asOfDate: "2026-10-01", cashUsd: "1000.00", holdings: [] },
    transactions,
  };
}

function command(
  owner: PortfolioProofOwner,
  name: PortfolioProofCommandName,
  expectedVersion: number,
  payload: ManagedPortfolioPayload,
): ManagedPortfolioCommand {
  const result = parseManagedPortfolioCommand({
    expectedVersion,
    idempotencyKey: `proof-portfolio-20261016-${owner}-${name}-v1`,
    payload,
  });
  if (!result)
    throw new Error(`Invalid fixed Portfolio proof command: ${owner}/${name}`);
  return result;
}

function assemble() {
  const admit = (name: CatalogVariant) => {
    const pin = PORTFOLIO_PROOF_CATALOG_PINS.find(
      (item) => item.name === name,
    )!;
    const bytes = PORTFOLIO_PROOF_SNAPSHOTS[name];
    if (Buffer.byteLength(bytes) !== pin.bytes)
      throw new Error("Invalid Portfolio proof catalog size");
    return admitManagedSecurityMasterSnapshot({
      snapshot: new Uint8Array(Buffer.from(bytes)),
      expectedSha256: pin.sha256,
    });
  };
  const catalog = admit("original"),
    revisedCatalog = admit("revised"),
    reboundCatalog = admit("rebound");
  const base = ledger(catalog, "1000.00");
  const future: ManagedPortfolioPayload = {
    ...base,
    opening: {
      ...base.opening,
      asOfDate: "9999-12-30",
      holdings: base.opening.holdings.map((item) => ({
        ...item,
        confirmedOn: "9999-12-30",
      })),
    },
    transactions: base.transactions.map((item) => ({
      ...item,
      date: PORTFOLIO_PROOF_CLOCKS.futureActivityDate,
    })),
  };
  const commands: PortfolioProofCommands = {
    a: {
      create: command("a", "create", 0, base),
      "stale-winner": command(
        "a",
        "stale-winner",
        1,
        ledger(catalog, "1100.00"),
      ),
      "stale-loser": command("a", "stale-loser", 1, base),
      "prestage-winner": command(
        "a",
        "prestage-winner",
        2,
        ledger(catalog, "1200.00"),
      ),
      "prestage-loser": command("a", "prestage-loser", 2, base),
      "overlap-winner": command(
        "a",
        "overlap-winner",
        3,
        ledger(catalog, "1300.00"),
      ),
      "overlap-loser": command("a", "overlap-loser", 3, base),
      rollback: command("a", "rollback", 4, base),
      unknown: command("a", "unknown", 4, ledger(catalog, "1400.00")),
      future: command("a", "future", 5, future),
      rebind: command("a", "rebind", 5, ledger(reboundCatalog, "1400.00")),
      "stale-catalog": command(
        "a",
        "stale-catalog",
        5,
        ledger(catalog, "1400.00"),
      ),
    },
    b: { create: command("b", "create", 0, ledger(catalog, null)) },
    size: { capacity: command("size", "capacity", 0, capacity(catalog)) },
  };
  const size = commands.size.capacity.payload;
  const overCapacityCommand = {
    ...commands.size.capacity,
    payload: {
      ...size,
      transactions: [
        ...size.transactions,
        { ...size.transactions[0]!, id: "proof-portfolio-activity-251" },
      ],
    },
  };
  return freeze({
    catalog,
    revisedCatalog,
    reboundCatalog,
    snapshots: PORTFOLIO_PROOF_SNAPSHOTS,
    commands,
    overCapacityCommand,
  });
}

const DATA = assemble();
export function portfolioProofData() {
  return DATA;
}
export const PORTFOLIO_PROOF_COMMAND_PINS = freeze([
  {
    owner: "a",
    name: "create",
    expectedVersion: 0,
    idempotencyKey: "proof-portfolio-20261016-a-create-v1",
    keySha256:
      "37559b244b121bf80601d167a2199714f706b64b998f313fab30fd1e640bd120",
    payloadBytes: 6453,
    payloadSha256:
      "5b752453aa3fc0c8aeda403c132f16d53ca2218c07ca00a199cf7ce699d09b0a",
    commandBytes: 6541,
    commandSha256:
      "6867a7c9bad6a0852c7e2e26d3a53d7951bc2b4404f4d39b91b1c65320cc3959",
    requestSha256:
      "e2ade242de831aa179ce7df000ef161fa1aa735091a51205735fbacb24e71dae",
  },
  {
    owner: "a",
    name: "stale-winner",
    expectedVersion: 1,
    idempotencyKey: "proof-portfolio-20261016-a-stale-winner-v1",
    keySha256:
      "4885906682d605a0067657acf63a716593750789c2ac893d9cf7861c8738397c",
    payloadBytes: 6453,
    payloadSha256:
      "748a642cdc20e1843a1cfc16e4f304d71fd442a28d96f5f256eb10408eca8a13",
    commandBytes: 6547,
    commandSha256:
      "3fe620ae9f0f172d57dc0997d8330a9c4bbb45d7380d4bdec351cd5ac5885976",
    requestSha256:
      "ee1bfa233ea685a286a67991fd1c7c37fd7d2f1d3a2288294eaf197f54bfaea2",
  },
  {
    owner: "a",
    name: "stale-loser",
    expectedVersion: 1,
    idempotencyKey: "proof-portfolio-20261016-a-stale-loser-v1",
    keySha256:
      "4d3697f11e9c53776394a106c281ebf20f65c34f628e86363a258f8f25ef41ab",
    payloadBytes: 6453,
    payloadSha256:
      "5b752453aa3fc0c8aeda403c132f16d53ca2218c07ca00a199cf7ce699d09b0a",
    commandBytes: 6546,
    commandSha256:
      "421cb5c3051787409eec8f78fdaaf4ecf8f0c64b4bac2c899828bc8f9dbff95b",
    requestSha256:
      "e9aab06e1b3daa658c0653fe9a729875c16b36637a6efee1e71e9ce1428b27b3",
  },
  {
    owner: "a",
    name: "prestage-winner",
    expectedVersion: 2,
    idempotencyKey: "proof-portfolio-20261016-a-prestage-winner-v1",
    keySha256:
      "c532c9064c8e9f53b2714e8afc1c9f6dfb22dad7bc04c3947e1f6bec01a84bb6",
    payloadBytes: 6453,
    payloadSha256:
      "44db904e415f7162b229a906d368478c207c9ac1988219b2fab3d1a0e0083f26",
    commandBytes: 6550,
    commandSha256:
      "c3fa3ea259c1757325d696ec9c78976388aad3dae76f64bfcb82e446a3a91129",
    requestSha256:
      "2d956829d437c148a75ea6b6ee5103cb77c48e1fa1ae2ade9f338150d99fdaa9",
  },
  {
    owner: "a",
    name: "prestage-loser",
    expectedVersion: 2,
    idempotencyKey: "proof-portfolio-20261016-a-prestage-loser-v1",
    keySha256:
      "0f34ba5f2b8be710b780d3c241c3cfedd024f7462d0ebeacd5d1b697063f8726",
    payloadBytes: 6453,
    payloadSha256:
      "5b752453aa3fc0c8aeda403c132f16d53ca2218c07ca00a199cf7ce699d09b0a",
    commandBytes: 6549,
    commandSha256:
      "f83d2a9c1e1a8236f58be8762d5dc7b0b2455f7ba3360e8cef929a353c8d1dff",
    requestSha256:
      "8ab71a916a7d0760a4836bc3f98edbe15a73afbbd479c917c4e2030066d8ebbb",
  },
  {
    owner: "a",
    name: "overlap-winner",
    expectedVersion: 3,
    idempotencyKey: "proof-portfolio-20261016-a-overlap-winner-v1",
    keySha256:
      "97ec36f7c4678deee3dee05a25cc76b5cde7d28a32e57daabc8959d3e5ed7032",
    payloadBytes: 6453,
    payloadSha256:
      "e4962db183586a88f5a4c36d42fc65b2ff46863da8c8caba329ad02fd8450075",
    commandBytes: 6549,
    commandSha256:
      "d08727e204f430cfe00c329c413a579f1e280a2c070b6e984fe3d28256c79630",
    requestSha256:
      "9c4b45d067e155a422fe9640d087adad453f2c67a72426bb9de0d24c5086b04c",
  },
  {
    owner: "a",
    name: "overlap-loser",
    expectedVersion: 3,
    idempotencyKey: "proof-portfolio-20261016-a-overlap-loser-v1",
    keySha256:
      "2148bd39cd5d9a912af8f1ed3bb259f70464a31c4ea7b1c1fb1b7ddb5fbeb74f",
    payloadBytes: 6453,
    payloadSha256:
      "5b752453aa3fc0c8aeda403c132f16d53ca2218c07ca00a199cf7ce699d09b0a",
    commandBytes: 6548,
    commandSha256:
      "f8cb2c716e278064031cbc7f7fd2052d04fe3bab54e4c2c2a9c16c31089083ac",
    requestSha256:
      "03c13722f9b772115ae7780eebd43dde12da5504dc7ea744166a5266bf6fb9e8",
  },
  {
    owner: "a",
    name: "rollback",
    expectedVersion: 4,
    idempotencyKey: "proof-portfolio-20261016-a-rollback-v1",
    keySha256:
      "440bac675d7880c39e6f884ab41f15df740e910b2fe5e17f5fbd98c3dcb0baae",
    payloadBytes: 6453,
    payloadSha256:
      "5b752453aa3fc0c8aeda403c132f16d53ca2218c07ca00a199cf7ce699d09b0a",
    commandBytes: 6543,
    commandSha256:
      "95e98448c8b3af4e9ebcd1d3ee8fcb29d68eed9fc00f5ded68556eb11a477489",
    requestSha256:
      "fc5c609a5ec1c475ab8e3f8f286d06fd09623e6b9014a85fcdc8e9461d82d1d8",
  },
  {
    owner: "a",
    name: "unknown",
    expectedVersion: 4,
    idempotencyKey: "proof-portfolio-20261016-a-unknown-v1",
    keySha256:
      "05875da1679becc38000dce0caec69dfba2b55915cf94e5c07f18499ecf28426",
    payloadBytes: 6453,
    payloadSha256:
      "3ed55be1bcd535dff18572764c592623239a7fc7f08e4ee80bad8c672e2e12dc",
    commandBytes: 6542,
    commandSha256:
      "a8ecd0b25362e2be9db05f7a76a58c732d645d900ac367a927b49e921b933123",
    requestSha256:
      "dcbff7692ca18dd237c760026bcb42e2f9b748f454ec06538fe27c6b6611768f",
  },
  {
    owner: "a",
    name: "future",
    expectedVersion: 5,
    idempotencyKey: "proof-portfolio-20261016-a-future-v1",
    keySha256:
      "f03b0597f7d34c061cc3c08dae9dc97b86cf939c9ebe3d5273f8ab3bc0a30c8d",
    payloadBytes: 6453,
    payloadSha256:
      "0e6766a519962fdab12bcbccb2198d9ee12aecf98095b65c1fffc1315859209e",
    commandBytes: 6541,
    commandSha256:
      "310571995104bfe9320274319deb8f51676d1168b218b4894e7d85afbb84f244",
    requestSha256:
      "4b2e0057dacfbed60abcd941bbc41210ed97598e7bc6d6863b4850cf2c6439cf",
  },
  {
    owner: "a",
    name: "rebind",
    expectedVersion: 5,
    idempotencyKey: "proof-portfolio-20261016-a-rebind-v1",
    keySha256:
      "cb8d381e82b611647a706494addf49f365b5803dabbcaa8cfd124da6c8159c85",
    payloadBytes: 6453,
    payloadSha256:
      "5f9a9ff0f97356bc120b8e65ade59a7d6461a258ec42a3bb499a325919263de8",
    commandBytes: 6541,
    commandSha256:
      "2e53e0a098dfa9a6c507b2da860ba7660a01cf278e3dfbaa61f48d117f2f777b",
    requestSha256:
      "66f659635d181cb40894a3e4165e61458f081c6c4adadc04cd92d02292474823",
  },
  {
    owner: "a",
    name: "stale-catalog",
    expectedVersion: 5,
    idempotencyKey: "proof-portfolio-20261016-a-stale-catalog-v1",
    keySha256:
      "b11d417e463414a30ac8e53971316ea92d5de1e12f7ed216f8522aebbe914087",
    payloadBytes: 6453,
    payloadSha256:
      "3ed55be1bcd535dff18572764c592623239a7fc7f08e4ee80bad8c672e2e12dc",
    commandBytes: 6548,
    commandSha256:
      "e0889c3a2776623a345e9558886203607d6cbd89b2f92eb78f97458e7d7ba917",
    requestSha256:
      "13d71cdad4e6a1bf8f88df38764780eef40157068db130f854c82f008bd477cc",
  },
  {
    owner: "b",
    name: "create",
    expectedVersion: 0,
    idempotencyKey: "proof-portfolio-20261016-b-create-v1",
    keySha256:
      "45aec6e95a301fac314c7855b6093688398cb7428d289932fadec287ce5704cd",
    payloadBytes: 6448,
    payloadSha256:
      "e13e6ca72dc647d8edb35add7e7f9232e2d2a1210b4cf6b61627df4f416d7699",
    commandBytes: 6536,
    commandSha256:
      "7e156176ae13eea525956f7d63c5815469bf7d94886f3afb9e1594fc8af155e7",
    requestSha256:
      "ae9aab8e08d68850aecf1c14d3d97b47bdf3236bbe72cd2eb66c1aa87b999494",
  },
  {
    owner: "size",
    name: "capacity",
    expectedVersion: 0,
    idempotencyKey: "proof-portfolio-20261016-size-capacity-v1",
    keySha256:
      "e08477559cfe889ebb2e63cfebce3d3def78c09a5b83a93a087b7eda3c07592a",
    payloadBytes: 132270,
    payloadSha256:
      "47f8aa14e836de89795979ded4f5393458a09b460ec3b6f833c40af5398ebe2c",
    commandBytes: 132363,
    commandSha256:
      "5eb3ee178f7c65b8b7e37c2ab9f1e74a61fe9ffd9052bfc278ba51296e666c33",
    requestSha256:
      "8cbd90aa326b25be393da9ea7b808ef0822fceed15beedac28e08333f62515e2",
  },
] as const);
verifyCommandPins();

export interface PortfolioProofRow {
  readonly owner: PortfolioProofOwner;
  readonly name: PortfolioProofCommandName | null;
  readonly databaseId: string;
  readonly tableId: "portfolios" | "receipts";
  readonly rowId: string;
  readonly expectedPresentAfterProof: boolean;
}
function row(
  owner: PortfolioProofOwner,
  name: PortfolioProofCommandName | null,
  key?: string,
): PortfolioProofRow {
  const namespace = [
    PORTFOLIO_PROOF_PRINCIPALS[owner].userId,
    "portfolio",
    "main",
  ];
  return {
    owner,
    name,
    databaseId: PORTFOLIO_PROOF_TARGET.databaseId,
    tableId: name === null ? "portfolios" : "receipts",
    rowId:
      (name === null ? "p" : "r") +
      hash(
        JSON.stringify(key === undefined ? namespace : [...namespace, key]),
      ).slice(0, 32),
    expectedPresentAfterProof:
      name === null ||
      [
        "create",
        "stale-winner",
        "prestage-winner",
        "overlap-winner",
        "unknown",
        "capacity",
      ].includes(name),
  };
}
export const PORTFOLIO_PROOF_ROWS: readonly PortfolioProofRow[] = freeze([
  row("a", null),
  row("b", null),
  row("size", null),
  ...PORTFOLIO_PROOF_COMMAND_PINS.map((pin) =>
    row(pin.owner, pin.name, pin.idempotencyKey),
  ),
]);
export function portfolioProofLocation(
  owner: PortfolioProofOwner,
  name?: PortfolioProofCommandName,
) {
  const found = PORTFOLIO_PROOF_ROWS.find(
    (item) => item.owner === owner && item.name === (name ?? null),
  );
  if (!found) throw new Error("Unknown fixed Portfolio proof location");
  return Object.freeze({
    databaseId: found.databaseId,
    tableId: found.tableId,
    rowId: found.rowId,
  });
}
export const PORTFOLIO_PROOF_ROWS_SHA256 =
  "986fd52045ebcec50704002b1f65264b389f041f68404b84a68903d6272d9753";
if (hash(JSON.stringify(PORTFOLIO_PROOF_ROWS)) !== PORTFOLIO_PROOF_ROWS_SHA256)
  throw new Error("Invalid Portfolio proof row manifest");
export const PORTFOLIO_PROOF_PLAN_SHA256 =
  "fc0d153f95e9d00ff485776bcfa04b8d74450f0a29cd9508a765d8dcb67ceaf0";
const planHash = hash(
  JSON.stringify({
    version: 1,
    target: PORTFOLIO_PROOF_TARGET,
    phases: PORTFOLIO_PROOF_PHASES,
    limits: PORTFOLIO_PROOF_LIMITS,
    principals: PORTFOLIO_PROOF_PRINCIPALS,
    rows: PORTFOLIO_PROOF_ROWS,
    commands: PORTFOLIO_PROOF_COMMAND_PINS,
    catalogs: PORTFOLIO_PROOF_CATALOG_PINS,
    clocks: PORTFOLIO_PROOF_CLOCKS,
  }),
);
if (planHash !== PORTFOLIO_PROOF_PLAN_SHA256)
  throw new Error("Invalid Portfolio proof plan");

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function verifyCommandPins(): void {
  for (const pin of PORTFOLIO_PROOF_COMMAND_PINS) {
    const commands: Readonly<
      Partial<Record<PortfolioProofCommandName, ManagedPortfolioCommand>>
    > = DATA.commands[pin.owner];
    const value = commands[pin.name];
    if (!value) throw new Error("Missing fixed Portfolio proof command");
    const payload = encodePortfolioPayload(value.payload),
      bytes = JSON.stringify(value);
    const request = JSON.stringify({
      expectedVersion: value.expectedVersion,
      resource: "portfolio",
      id: "main",
      operation: "put",
      payloadSha256: hash(payload),
    });
    if (
      value.expectedVersion !== pin.expectedVersion ||
      value.idempotencyKey !== pin.idempotencyKey ||
      hash(value.idempotencyKey) !== pin.keySha256 ||
      Buffer.byteLength(payload) !== pin.payloadBytes ||
      hash(payload) !== pin.payloadSha256 ||
      Buffer.byteLength(bytes) !== pin.commandBytes ||
      hash(bytes) !== pin.commandSha256 ||
      hash(request) !== pin.requestSha256
    ) {
      throw new Error(
        `Invalid fixed Portfolio proof pin: ${pin.owner}/${pin.name}`,
      );
    }
  }
}
function canonical(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${(value as readonly Json[]).map((item) => canonical(item)).join(",")}]`;
  const record = value as { readonly [key: string]: Json };
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key]!)}`)
    .join(",")}}`;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
