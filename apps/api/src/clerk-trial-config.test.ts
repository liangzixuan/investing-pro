import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { validateClerkTrialFunctionConfiguration } from "./clerk-trial-config";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwtKey = keys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const web = "https://investment-clerk-6abac57a.appwrite.network";
const productionWeb = "https://app.investingpro.app";
const native = "https://localhost";

function development() {
  return {
    environment: "development",
    auth: {
      issuer: "https://allowed-lobster-3386.clerk.accounts.dev",
      jwtKey,
      allowedSubject: "user_syntheticOwner" as string | null,
      authorizedParties: [web, native],
      nativeOrigin: native,
    },
    allowedOrigins: [web, native],
  };
}
function production() {
  return {
    environment: "production",
    auth: {
      issuer: "https://clerk.investingpro.app",
      jwtKey,
      allowedSubject: null as string | null,
      authorizedParties: [productionWeb],
    },
    allowedOrigins: [productionWeb],
  };
}

describe("explicit Clerk function profiles", () => {
  it("derives separate fixed synthetic storage while keeping development native admission", () => {
    const dev = validateClerkTrialFunctionConfiguration(development());
    const prod = validateClerkTrialFunctionConfiguration(production());
    expect(dev.storage).toEqual({
      endpoint: "https://nyc.cloud.appwrite.io/v1",
      projectId: "6abac57a0007b7c1a671",
      databaseId: "investment_clerk_trial_v1",
      watchlistsTableId: "watchlists",
      receiptsTableId: "receipts",
    });
    expect(prod.storage).toEqual({
      ...dev.storage,
      databaseId: "investment_clerk_prod_trial_v1",
    });
    expect(dev.auth.nativeOrigin).toBe(native);
    expect(prod.auth).not.toHaveProperty("nativeOrigin");
    expect(prod.auth.allowedSubject).toBeNull();
  });

  it("allows an explicit web-only development profile with closed account admission", () => {
    const input = development();
    const checked = validateClerkTrialFunctionConfiguration({
      ...input,
      auth: {
        issuer: input.auth.issuer,
        jwtKey,
        allowedSubject: null,
        authorizedParties: [web],
      },
      allowedOrigins: [web],
    });
    expect(checked.auth.allowedSubject).toBeNull();
    expect(checked.auth).not.toHaveProperty("nativeOrigin");
  });

  it("checks equal origin sets without changing their explicit order", () => {
    const input = development();
    input.auth.authorizedParties.reverse();
    const checked = validateClerkTrialFunctionConfiguration(input);
    expect(checked.auth.authorizedParties).toEqual([native, web]);
    expect(checked.allowedOrigins).toEqual([web, native]);
  });

  it.each(["allowedOrigins", "authorizedParties"])(
    "rejects sparse %s before copying or building configuration",
    (field) => {
      const input = production();
      const sparse = new Array<string>(1);
      if (field === "allowedOrigins") input.allowedOrigins = sparse;
      else input.auth.authorizedParties = sparse;
      expect(() => validateClerkTrialFunctionConfiguration(input)).toThrow(
        "Invalid Clerk function configuration",
      );
    },
  );

  it("copies and freezes checked nested values before callers can mutate input", () => {
    const input = development();
    const checked = validateClerkTrialFunctionConfiguration(input);
    input.auth.issuer = "https://changed.clerk.accounts.dev";
    input.auth.allowedSubject = null;
    input.auth.jwtKey = "changed";
    input.auth.authorizedParties.splice(0, 2, "https://other.invalid");
    input.allowedOrigins.splice(0, 2, "https://other.invalid");
    expect(checked.auth.issuer).toBe(
      "https://allowed-lobster-3386.clerk.accounts.dev",
    );
    expect(checked.auth.allowedSubject).toBe("user_syntheticOwner");
    expect(checked.auth.jwtKey).toBe(jwtKey);
    expect(checked.auth.authorizedParties).toEqual([web, native]);
    expect(checked.allowedOrigins).toEqual([web, native]);
    expect(Object.isFrozen(checked)).toBe(true);
    expect(Object.isFrozen(checked.auth)).toBe(true);
    expect(Object.isFrozen(checked.auth.authorizedParties)).toBe(true);
    expect(Object.isFrozen(checked.allowedOrigins)).toBe(true);
    expect(Object.isFrozen(checked.storage)).toBe(true);
  });

  it("rejects an invalid subject before inspecting invalid origin arrays", () => {
    const input = development();
    input.auth.allowedSubject = "email@example.invalid";
    let iteratorReads = 0;
    Object.defineProperty(input.allowedOrigins, Symbol.iterator, {
      get() {
        iteratorReads += 1;
        throw new Error("Origin array must remain unread");
      },
    });
    expect(() => validateClerkTrialFunctionConfiguration(input)).toThrow(
      "Invalid Clerk function configuration",
    );
    expect(iteratorReads).toBe(0);
  });

  it("rejects invalid origins before inspecting invalid authorized parties", () => {
    const input = development();
    input.allowedOrigins = ["https://other.invalid"];
    let iteratorReads = 0;
    Object.defineProperty(input.auth.authorizedParties, Symbol.iterator, {
      get() {
        iteratorReads += 1;
        throw new Error("Authorized parties must remain unread");
      },
    });
    expect(() => validateClerkTrialFunctionConfiguration(input)).toThrow(
      "Invalid Clerk function configuration",
    );
    expect(iteratorReads).toBe(0);
  });

  it("rejects unequal origin sets before reading an invalid native exception", () => {
    const input = development();
    input.allowedOrigins = [web];
    input.auth.nativeOrigin = "http://localhost";
    let nativeReads = 0;
    input.auth = new Proxy(input.auth, {
      get(target, key, receiver): unknown {
        if (key === "nativeOrigin") nativeReads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    expect(() => validateClerkTrialFunctionConfiguration(input)).toThrow(
      "Invalid Clerk function configuration",
    );
    expect(nativeReads).toBe(0);
  });

  it("rejects an invalid native exception before reading an invalid signing key", () => {
    const input = development();
    input.auth.nativeOrigin = "http://localhost";
    input.auth.jwtKey = "not a public key";
    let keyReads = 0;
    input.auth = new Proxy(input.auth, {
      get(target, key, receiver): unknown {
        if (key === "jwtKey") keyReads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    expect(() => validateClerkTrialFunctionConfiguration(input)).toThrow(
      "Invalid Clerk function configuration",
    );
    expect(keyReads).toBe(0);
  });

  it.each([
    ["null", null],
    ["array", []],
    [
      "missing selector",
      { auth: production().auth, allowedOrigins: [productionWeb] },
    ],
    ["unknown selector", { ...production(), environment: "preview" }],
    [
      "caller database",
      { ...production(), databaseId: "investment_clerk_trial_v1" },
    ],
    ["caller storage", { ...production(), storage: {} }],
    [
      "missing auth",
      { environment: "production", allowedOrigins: [productionWeb] },
    ],
    ["null auth", { ...production(), auth: null }],
    [
      "unknown auth field",
      {
        ...production(),
        auth: { ...production().auth, secretKey: "synthetic" },
      },
    ],
    [
      "missing key",
      {
        ...production(),
        auth: {
          issuer: "https://clerk.investingpro.app",
          allowedSubject: null,
          authorizedParties: [productionWeb],
        },
      },
    ],
    [
      "undefined subject",
      {
        ...development(),
        auth: { ...development().auth, allowedSubject: undefined },
      },
    ],
    [
      "malformed subject",
      {
        ...development(),
        auth: {
          ...development().auth,
          allowedSubject: "email@example.invalid",
        },
      },
    ],
    [
      "production subject",
      {
        ...production(),
        auth: { ...production().auth, allowedSubject: "user_syntheticOwner" },
      },
    ],
    [
      "production native origin",
      { ...production(), auth: { ...production().auth, nativeOrigin: native } },
    ],
    [
      "production native property",
      {
        ...production(),
        auth: { ...production().auth, nativeOrigin: undefined },
      },
    ],
    [
      "development issuer in production",
      {
        ...production(),
        auth: { ...production().auth, issuer: development().auth.issuer },
      },
    ],
    [
      "production issuer in development",
      {
        ...development(),
        auth: { ...development().auth, issuer: production().auth.issuer },
      },
    ],
    [
      "different development instance",
      {
        ...development(),
        auth: {
          ...development().auth,
          issuer: "https://other.clerk.accounts.dev",
        },
      },
    ],
    [
      "issuer path",
      {
        ...development(),
        auth: {
          ...development().auth,
          issuer: "https://fixture.clerk.accounts.dev/path",
        },
      },
    ],
    [
      "issuer credentials",
      {
        ...development(),
        auth: {
          ...development().auth,
          issuer: "https://owner@fixture.clerk.accounts.dev",
        },
      },
    ],
    [
      "issuer suffix",
      {
        ...development(),
        auth: {
          ...development().auth,
          issuer: "https://fixture.clerk.accounts.dev.other.invalid",
        },
      },
    ],
    ["empty origins", { ...production(), allowedOrigins: [] }],
    ["wildcard origin", { ...production(), allowedOrigins: ["*"] }],
    ["origin path", { ...production(), allowedOrigins: [`${productionWeb}/`] }],
    [
      "extra production origin",
      { ...production(), allowedOrigins: [productionWeb, native] },
    ],
    [
      "extra production party",
      {
        ...production(),
        auth: {
          ...production().auth,
          authorizedParties: [productionWeb, native],
        },
      },
    ],
    [
      "duplicate development origin",
      { ...development(), allowedOrigins: [web, web] },
    ],
    [
      "duplicate development party",
      {
        ...development(),
        auth: { ...development().auth, authorizedParties: [web, web] },
      },
    ],
    ["mismatched origin sets", { ...development(), allowedOrigins: [web] }],
    [
      "unreviewed development web",
      { ...development(), allowedOrigins: ["https://other.invalid", native] },
    ],
    [
      "native-only development",
      {
        ...development(),
        auth: { ...development().auth, authorizedParties: [native] },
        allowedOrigins: [native],
      },
    ],
    [
      "native exception without origin",
      {
        ...development(),
        auth: { ...development().auth, authorizedParties: [web] },
        allowedOrigins: [web],
      },
    ],
    [
      "wrong native exception",
      {
        ...development(),
        auth: { ...development().auth, nativeOrigin: "http://localhost" },
      },
    ],
  ])(
    "rejects %s without configuration details in the error",
    (_name, input) => {
      expect(() => validateClerkTrialFunctionConfiguration(input)).toThrow(
        "Invalid Clerk function configuration",
      );
    },
  );

  it.each([
    null,
    7,
    "-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----\n",
    `${jwtKey}\u0000`,
    `${jwtKey}extra`,
    "x".repeat(8193),
    keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    generateKeyPairSync("ec", { namedCurve: "prime256v1" })
      .publicKey.export({ type: "spki", format: "pem" })
      .toString(),
  ])(
    "rejects malformed, non-public or unsupported signing key %#",
    (invalidKey) => {
      expect(() =>
        validateClerkTrialFunctionConfiguration({
          ...production(),
          auth: { ...production().auth, jwtKey: invalidKey },
        }),
      ).toThrow("Invalid Clerk function configuration");
    },
  );

  it("rejects inherited, symbolic and accessor configuration fields without reading accessors", () => {
    expect(() =>
      validateClerkTrialFunctionConfiguration(Object.create(production())),
    ).toThrow();
    expect(() =>
      validateClerkTrialFunctionConfiguration({
        ...production(),
        [Symbol("extra")]: true,
      }),
    ).toThrow();
    let reads = 0;
    const input = production();
    Object.defineProperty(input.auth, "issuer", {
      get() {
        reads += 1;
        return "https://clerk.investingpro.app";
      },
    });
    expect(() => validateClerkTrialFunctionConfiguration(input)).toThrow();
    expect(reads).toBe(0);
  });
});
