import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "local.investment.personal",
  appName: "Investment",
  webDir: "dist/mobile",
  loggingBehavior: "none",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
