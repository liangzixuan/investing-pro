import { validateApiOrigin } from "./api";

export interface ClerkTrialConfig {
  publishableKey: string;
  apiOrigin: string;
  frontendApiOrigin: string;
}

export function validateTrialConfig(
  config: ClerkTrialConfig,
): ClerkTrialConfig {
  if (!/^pk_(?:test|live)_[A-Za-z0-9_-]+$/u.test(config.publishableKey)) {
    throw new Error("The trial requires its public Clerk configuration.");
  }
  return {
    publishableKey: config.publishableKey,
    apiOrigin: validateApiOrigin(config.apiOrigin),
    frontendApiOrigin: validateApiOrigin(config.frontendApiOrigin),
  };
}
