import type { CapacitorConfig } from "@capacitor/cli";

const clerkTrial = process.env.INVESTMENT_CLIENT_PROFILE === "clerk-trial";
const config: CapacitorConfig = {
  appId: clerkTrial
    ? "local.investment.personal.clerktrial"
    : "local.investment.personal",
  appName: clerkTrial ? "Investment Trial" : "Investment",
  webDir: clerkTrial ? "dist/clerk-trial" : "dist/mobile",
  loggingBehavior: "none",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
