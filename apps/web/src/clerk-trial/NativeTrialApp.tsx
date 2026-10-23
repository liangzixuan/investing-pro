import {
  createNativeFinancialScreenRecipeAdapter,
  type InvestmentFinancialScreenRecipePlugin,
} from "./financial-screen-recipe-delivery";
import {
  createNativeValuationDraftFileAdapter,
  type InvestmentValuationDraftFilePlugin,
} from "./valuation-draft-file-delivery";
import {
  createNativePortfolioDraftFileAdapter,
  type InvestmentPortfolioDraftFilePlugin,
} from "./portfolio-draft-file-delivery";
import {
  createNativeFollowupsDraftFileAdapter,
  type InvestmentFollowupsDraftFilePlugin,
} from "./followups-draft-file-delivery";
import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
  type InvestmentCompanyReportHtmlPlugin,
} from "./native-company-report";
import { registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ClerkTrialConfig } from "./config";
import { validateTrialConfig } from "./config";
import { NativeTrialSessionStore } from "./native-session";
import type { InvestmentAuthPlugin } from "./native-session";
import { TrialFrame } from "./TrialFrame";
import { TrialSessionScreen } from "./TrialScreen";
import { ManagedSessionScreen } from "./ManagedWorkspaceScreen";
import { ManagedEntry, ManagedSessionNotice } from "./ManagedEntry";
import {
  createNativeWatchlistExportAdapter,
  type InvestmentWatchlistExportPlugin,
} from "./native-watchlist-export";
import {
  createNativeWatchlistDraftFileAdapter,
  type InvestmentWatchlistDraftFilePlugin,
} from "./native-watchlist-draft-file";

export function NativeTrialApp({ config }: { config: ClerkTrialConfig }) {
  const checked = validateTrialConfig(config);
  const managed = checked.environment === "production";
  const [store, setStore] = useState<NativeTrialSessionStore | null>(null);
  useEffect(() => {
    const next = new NativeTrialSessionStore(
      registerPlugin<InvestmentAuthPlugin>("InvestmentAuth"),
    );
    setStore(next);
    void next.start();
    return () => next.dispose();
  }, []);
  return store ? (
    <NativeSession
      store={store}
      apiOrigin={checked.apiOrigin}
      managed={managed}
    />
  ) : (
    <TrialFrame managed={managed}>
      {managed ? (
        <ManagedEntry
          title="Opening Investment"
          message="Checking the installed session…"
          busy
        />
      ) : (
        <p role="status">Checking the installed session…</p>
      )}
    </TrialFrame>
  );
}

function NativeSession({
  store,
  apiOrigin,
  managed,
}: {
  store: NativeTrialSessionStore;
  apiOrigin: string;
  managed: boolean;
}) {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const session = store.session();
  const exportDelivery = useMemo(
    () =>
      managed
        ? createNativeWatchlistExportAdapter(
            registerPlugin<InvestmentWatchlistExportPlugin>(
              "InvestmentWatchlistExport",
            ),
          )
        : undefined,
    [managed],
  );
  const reportDelivery = useMemo(
    () =>
      managed
        ? createNativeCompanyReportAdapter(
            registerPlugin<InvestmentCompanyReportPlugin>(
              "InvestmentCompanyReport",
            ),
            registerPlugin<InvestmentCompanyReportHtmlPlugin>(
              "InvestmentCompanyReportHtml",
            ),
          )
        : undefined,
    [managed],
  );
  const draftFileDelivery = useMemo(
    () =>
      managed
        ? createNativeWatchlistDraftFileAdapter(
            registerPlugin<InvestmentWatchlistDraftFilePlugin>(
              "InvestmentWatchlistDraftFile",
            ),
          )
        : undefined,
    [managed],
  );
  const portfolioDraftFileDelivery = useMemo(
    () =>
      managed
        ? createNativePortfolioDraftFileAdapter(
            registerPlugin<InvestmentPortfolioDraftFilePlugin>(
              "InvestmentPortfolioDraftFile",
            ),
          )
        : undefined,
    [managed],
  );
  const followupsDraftFileDelivery = useMemo(
    () =>
      managed
        ? createNativeFollowupsDraftFileAdapter(
            registerPlugin<InvestmentFollowupsDraftFilePlugin>(
              "InvestmentFollowupsDraftFile",
            ),
          )
        : undefined,
    [managed],
  );
  const valuationDraftFileDelivery = useMemo(
    () =>
      managed
        ? createNativeValuationDraftFileAdapter(
            registerPlugin<InvestmentValuationDraftFilePlugin>(
              "InvestmentValuationDraftFile",
            ),
          )
        : undefined,
    [managed],
  );
  const financialScreenRecipeDelivery = useMemo(
    () =>
      managed
        ? createNativeFinancialScreenRecipeAdapter(
            registerPlugin<InvestmentFinancialScreenRecipePlugin>(
              "InvestmentFinancialScreenRecipe",
            ),
          )
        : undefined,
    [managed],
  );
  const signInMessage =
    state.message ||
    (state.auth.status === "loading"
      ? "Checking your session…"
      : managed
        ? "Sign in to open your shared watchlist."
        : "Use the secure Clerk sign-in flow to join the trial.");
  const signInButton = (
    <button
      type="button"
      disabled={state.busy || state.auth.status === "loading"}
      onClick={() => {
        void store.signIn();
      }}
    >
      {state.signOutUnconfirmed ? "Sign in again" : "Sign in with Clerk"}
    </button>
  );
  return (
    <TrialFrame managed={managed} compact={managed && Boolean(session)}>
      {session ? (
        <>
          {state.message &&
            (managed ? (
              <ManagedSessionNotice>{state.message}</ManagedSessionNotice>
            ) : (
              <p role="status" className="trial-status">
                {state.message}
              </p>
            ))}
          {managed ? (
            <ManagedSessionScreen
              key={state.auth.generation}
              apiOrigin={apiOrigin}
              session={session}
              androidBack={App}
              {...(exportDelivery ? { exportDelivery } : {})}
              {...(draftFileDelivery ? { draftFileDelivery } : {})}
              {...(portfolioDraftFileDelivery
                ? { portfolioDraftFileDelivery }
                : {})}
              {...(followupsDraftFileDelivery
                ? { followupsDraftFileDelivery }
                : {})}
              {...(valuationDraftFileDelivery
                ? { valuationDraftFileDelivery }
                : {})}
              {...(financialScreenRecipeDelivery
                ? { financialScreenRecipeDelivery }
                : {})}
              {...(reportDelivery ? { reportDelivery } : {})}
            />
          ) : (
            <TrialSessionScreen
              key={state.auth.generation}
              apiOrigin={apiOrigin}
              session={session}
            />
          )}
        </>
      ) : managed ? (
        <ManagedEntry
          title="Sign in on this device"
          message={signInMessage}
          busy={state.busy || state.auth.status === "loading"}
          tone={
            state.signOutUnconfirmed || state.auth.status === "error"
              ? "warning"
              : "neutral"
          }
        >
          {signInButton}
        </ManagedEntry>
      ) : (
        <section
          className="trial-panel"
          aria-labelledby="native-sign-in-heading"
        >
          <h2 id="native-sign-in-heading">Sign in on this device</h2>
          <p role="status">{signInMessage}</p>
          {signInButton}
        </section>
      )}
    </TrialFrame>
  );
}
