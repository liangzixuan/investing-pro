import { parsePublishableKey } from "@clerk/shared/keys";

export interface ClerkTrialConfig {
  readonly environment: "development" | "production";
  readonly publishableKey: string;
  readonly apiOrigin: string;
  readonly frontendApiOrigin: string;
}

const fields = [
  "environment",
  "publishableKey",
  "apiOrigin",
  "frontendApiOrigin",
];
const invalidConfig = () =>
  new Error("Invalid public Clerk trial configuration.");

function checkedPublishableKey(publishableKey: unknown) {
  if (
    typeof publishableKey !== "string" ||
    publishableKey.length === 0 ||
    publishableKey.length > 512
  )
    throw invalidConfig();
  const key = parsePublishableKey(publishableKey);
  if (!key) throw invalidConfig();
  const validHost =
    key.instanceType === "production"
      ? key.frontendApi === "clerk.investingpro.app"
      : /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.clerk\.accounts\.dev$/u.test(
          key.frontendApi,
        );
  if (!validHost) throw invalidConfig();
  return key;
}

export function trialFrontendApiOrigin(publishableKey: unknown): string {
  const key = checkedPublishableKey(publishableKey);
  return `https://${key.frontendApi}`;
}

export function validateTrialConfig(config: unknown): ClerkTrialConfig {
  if (typeof config !== "object" || config === null || Array.isArray(config))
    throw invalidConfig();
  const keys = Reflect.ownKeys(config);
  if (
    keys.length !== fields.length ||
    keys.some((key) => typeof key !== "string" || !fields.includes(key))
  )
    throw invalidConfig();
  const { environment, publishableKey, apiOrigin, frontendApiOrigin } =
    config as Record<string, unknown>;
  if (
    (environment !== "development" && environment !== "production") ||
    typeof publishableKey !== "string"
  )
    throw invalidConfig();
  const key = checkedPublishableKey(publishableKey);
  const derivedOrigin = `https://${key.frontendApi}`;
  const expectedApiOrigin =
    environment === "production"
      ? "https://api.investingpro.app"
      : "https://investment-clerk-api-6abac57a.appwrite.network";
  if (
    key.instanceType !== environment ||
    frontendApiOrigin !== derivedOrigin ||
    apiOrigin !== expectedApiOrigin
  ) {
    throw invalidConfig();
  }
  return {
    environment,
    publishableKey,
    apiOrigin: expectedApiOrigin,
    frontendApiOrigin: derivedOrigin,
  };
}
