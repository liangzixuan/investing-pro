import type { ManagedEodIdentity } from "@research-cockpit/contracts";

export const MANAGED_EOD_TOKEN_ENVIRONMENT_KEY =
  "MANAGED_EOD_TIINGO_TOKEN" as const;
export const MANAGED_EOD_BUDGET = Object.freeze({
  databaseId: "investment_managed_watchlist_v1",
  tableId: "tiingo_eod_budget",
  rowId: "managed-eod-v1",
});
export const MANAGED_EOD_MAPPING_SNAPSHOT =
  "sha256:0ff96ab386a9f1ce4ecab834706aa8da6d9b8ee9efd97f9f79908d616b43a3e4" as const;
export type ManagedEodSymbol = "AAPL" | "GOOG" | "GOOGL";
export interface ManagedEodConfiguration {
  readonly enabledSymbols: readonly ManagedEodSymbol[];
}
interface Mapping {
  readonly security: ManagedEodIdentity;
  readonly cik: string;
  readonly providerSymbol: ManagedEodSymbol;
  readonly currency: "USD";
}
/** Candidates only. Public configuration enables each tuple after separate provider/currency acceptance. */
export const MANAGED_EOD_MAPPING_CANDIDATES: readonly Mapping[] = Object.freeze(
  [
    {
      security: {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-2744343830e3421ab970a3e5f4e4a719",
        issuerName: "Alphabet Inc.",
        listingId: "oid-listing-5acae2cd933a4a32a3ac19e428ab27ce",
        securityId: "oid-security-0377495156384622865c558c1bf79449",
        securityName: "Class A Common Stock, $0.001 par value",
        shareClassId: "oid-share-class-75f07939ba714dbcbfac6a097deba503",
        shareClassName: "Class A Common Stock, $0.001 par value",
        symbol: "GOOGL",
      },
      cik: "0001652044",
      providerSymbol: "GOOGL",
      currency: "USD",
    },
    {
      security: {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-0e4ae79b2a6b4443b11946c6b9171c45",
        issuerName: "Apple Inc.",
        listingId: "oid-listing-fdc1a316c06e4efca10b09944c908bbc",
        securityId: "oid-security-2c607f13eb744e61a209f61b7a1e172d",
        securityName: "Common Stock, $0.00001 par value per share",
        shareClassId: "oid-share-class-de665b6392eb4a03b7ec2c09ba97dc1c",
        shareClassName: "Common Stock, $0.00001 par value per share",
        symbol: "AAPL",
      },
      cik: "0000320193",
      providerSymbol: "AAPL",
      currency: "USD",
    },
    {
      security: {
        country: "US",
        exchangeMic: "XNAS",
        instrumentType: "common_stock",
        issuerId: "oid-issuer-2744343830e3421ab970a3e5f4e4a719",
        issuerName: "Alphabet Inc.",
        listingId: "oid-listing-44bc5fe9c57246a3adef40bbcbcb88a7",
        securityId: "oid-security-b3826929532e4221a42d3c753046c7c8",
        securityName: "Class C Capital Stock, $0.001 par value",
        shareClassId: "oid-share-class-f81365021c5a4909aa983603a54f634d",
        shareClassName: "Class C Capital Stock, $0.001 par value",
        symbol: "GOOG",
      },
      cik: "0001652044",
      providerSymbol: "GOOG",
      currency: "USD",
    },
  ].map((mapping) =>
    Object.freeze({ ...mapping, security: Object.freeze(mapping.security) }),
  ) as Mapping[],
);

/** Null explicitly disables only EOD; public configuration never contains a key. */
export function validateManagedEodConfiguration(
  input: unknown,
): Readonly<ManagedEodConfiguration> | null {
  if (input === null) return null;
  const invalid = (): never => {
    throw new Error("Invalid managed EOD configuration");
  };
  if (
    !input ||
    typeof input !== "object" ||
    Object.getPrototypeOf(input) !== Object.prototype ||
    Reflect.ownKeys(input).length !== 1
  )
    return invalid();
  const descriptor = Object.getOwnPropertyDescriptor(input, "enabledSymbols");
  if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value"))
    return invalid();
  const value: unknown = descriptor.value;
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 3 ||
    Reflect.ownKeys(value).length !== value.length + 1
  )
    return invalid();
  const symbols: ManagedEodSymbol[] = [];
  for (let index = 0; index < value.length; index++) {
    const item = Object.getOwnPropertyDescriptor(value, index);
    if (!item?.enumerable || !Object.hasOwn(item, "value")) return invalid();
    const symbol: unknown = item.value;
    if (symbol !== "AAPL" && symbol !== "GOOG" && symbol !== "GOOGL")
      return invalid();
    if (symbols.includes(symbol)) return invalid();
    symbols.push(symbol);
  }
  return Object.freeze({ enabledSymbols: Object.freeze(symbols) });
}
