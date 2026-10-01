import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { ClerkTrialApp } from "./ClerkTrialApp";
import { NativeTrialApp } from "./NativeTrialApp";
import { TrialFrame } from "./TrialFrame";
import { validateTrialConfig } from "./config";
import "./trial.css";

declare const __INVESTMENT_CLERK_TRIAL_CONFIG__: unknown;
declare const __INVESTMENT_CLIENT_TARGET__: unknown;

const container = document.getElementById("root");
if (!container) throw new Error("Missing trial root.");
const config = validateTrialConfig(__INVESTMENT_CLERK_TRIAL_CONFIG__);
const native = Capacitor.isNativePlatform();
const target = __INVESTMENT_CLIENT_TARGET__;
if (
  target !== "web" &&
  target !== "android-trial" &&
  target !== "android-managed"
) {
  throw new Error("Invalid compiled client target.");
}
if (target === "web") {
  if (native)
    throw new Error("The web client cannot start as an installed app.");
} else if (
  !native ||
  Capacitor.getPlatform() !== "android" ||
  window.location.origin !== "https://localhost" ||
  config.environment !==
    (target === "android-managed" ? "production" : "development")
) {
  throw new Error(
    "The installed client requires its matching Android profile and origin.",
  );
}
const stagingPreview =
  target === "web" &&
  config.environment === "production" &&
  window.location.origin ===
    "https://investment-device-preview.appwrite.network";
if (
  target === "web" &&
  config.environment === "production" &&
  !stagingPreview &&
  window.location.origin !== "https://app.investingpro.app"
) {
  throw new Error(
    "The production Clerk profile requires its approved web origin.",
  );
}
const App = native ? NativeTrialApp : ClerkTrialApp;
createRoot(container).render(
  stagingPreview ? (
    <TrialFrame managed>
      <section aria-labelledby="staging-preview-heading">
        <h2 id="staging-preview-heading">Staging preview</h2>
        <p>Sign-in is available on the production site.</p>
        <p>This preview does not start a session or load saved data.</p>
      </section>
    </TrialFrame>
  ) : (
    <App config={config} />
  ),
);
