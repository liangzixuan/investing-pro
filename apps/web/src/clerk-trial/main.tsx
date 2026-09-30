import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { ClerkTrialApp } from "./ClerkTrialApp";
import { NativeTrialApp } from "./NativeTrialApp";
import { validateTrialConfig } from "./config";
import "./trial.css";

declare const __INVESTMENT_CLERK_TRIAL_CONFIG__: unknown;

const container = document.getElementById("root");
if (!container) throw new Error("Missing trial root.");
const config = validateTrialConfig(__INVESTMENT_CLERK_TRIAL_CONFIG__);
const native = Capacitor.isNativePlatform();
if (native && config.environment === "production") {
  throw new Error("The production Clerk profile supports web only.");
}
if (native && Capacitor.getPlatform() !== "android") {
  throw new Error("The installed trial supports Android only.");
}
const App = native ? NativeTrialApp : ClerkTrialApp;
createRoot(container).render(<App config={config} />);
