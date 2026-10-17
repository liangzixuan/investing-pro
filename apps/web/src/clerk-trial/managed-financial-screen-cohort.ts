/** Named reviewed catalog cohort. Resolve current identities explicitly before use. */
export const MANAGED_FINANCIAL_SCREEN_CATALOG_SHA256 =
  "sha256:5852beb972fdb7e1a93669d51996b3cca431f006b741c697c1952f7e14d3d5a0" as const;

/** 18 listings, 17 issuers. Select only one Alphabet listing per run. */
export const MANAGED_FINANCIAL_SCREEN_LISTING_IDS: readonly string[] =
  Object.freeze([
    "oid-listing-fdc1a316c06e4efca10b09944c908bbc", // AAPL
    "oid-listing-df5875b9129b425eb7a71639d386bf0f", // AFL
    "oid-listing-ca6320aaed1546b4b60a39cfac5216c6", // AIG
    "oid-listing-aaa05639eb514de0b4e50eca8e2772a8", // ALCO
    "oid-listing-e2f6df3fdcf14a7c8dad342145ed2865", // AMD
    "oid-listing-7caea5222b61491bbdf4e108858bec02", // AP
    "oid-listing-761dd788312e43ec94fa70152b714ef2", // AVD
    "oid-listing-1c349e39481c4ac3a809de85320ac624", // AXP
    "oid-listing-34697b1c4cea41238c7142c2fd450af6", // BKTI
    "oid-listing-44bc5fe9c57246a3adef40bbcbcb88a7", // GOOG
    "oid-listing-5acae2cd933a4a32a3ac19e428ab27ce", // GOOGL
    "oid-listing-4d7eaeadda75432580d22693b0b0550d", // HWM
    "oid-listing-f2b374cd393c440da682a6117d0f0722", // LNG
    "oid-listing-fa59842c214846238f516e08f48d0dd6", // MATX
    "oid-listing-eac65ef4a5d24849a600626df89fc761", // MSFT
    "oid-listing-ec4641726d8e48a1b1eee268a2134d00", // SWKS
    "oid-listing-aab6d6f78b3442a3a6260edef5df0819", // UHAL
    "oid-listing-f4cdc0dadb6844d382c8efa99a85022f", // UNM
  ]);
