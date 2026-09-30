import { Capacitor } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { ClerkTrialApp } from "./ClerkTrialApp";
import { NativeTrialApp } from "./NativeTrialApp";
import { TrialFrame } from "./TrialFrame";
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
const stagingPreview =
  config.environment === "production" &&
  window.location.origin ===
    "https://investment-device-preview.appwrite.network";
if (
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
    <TrialFrame>
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
