import type { CapacitorConfig } from "@capacitor/cli";
import { capacitorClientProfile } from "./client-profile";

const profile = capacitorClientProfile(process.env.INVESTMENT_CLIENT_PROFILE);
const config: CapacitorConfig = {
  appId: profile.appId,
  appName: profile.appName,
  webDir: profile.webDir,
  loggingBehavior: "none",
  server: { hostname: "localhost", androidScheme: "https" },
  android: {
    minWebViewVersion: 111,
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
