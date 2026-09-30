import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { ClerkTrialApp } from "./ClerkTrialApp";
import { NativeTrialApp } from "./NativeTrialApp";
import type { ClerkTrialConfig } from "./config";
import "./trial.css";

declare const __INVESTMENT_CLERK_TRIAL_CONFIG__: ClerkTrialConfig;

const container = document.getElementById("root");
if (!container) throw new Error("Missing trial root.");
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() !== "android") {
  throw new Error("The installed trial supports Android only.");
}
const App =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    ? NativeTrialApp
    : ClerkTrialApp;
createRoot(container).render(
  <App config={__INVESTMENT_CLERK_TRIAL_CONFIG__} />,
);
