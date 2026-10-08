import { useEffect, useMemo, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { createPath, Navigate, useLocation, useNavigate } from "react-router";
import { PersonalWorkspaceClient } from "../features/workspace/PersonalWorkspaceClient";
import { parseWorkspaceRoute } from "../features/workspace/workspace-route";
import { bindAndroidBack } from "./android-back";
import thirdPartyNotices from "../../mobile/third-party-notices.txt?raw";

export function MobileWorkspaceRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [backUnavailable, setBackUnavailable] = useState(false);
  const navigation = useMemo(
    () => ({
      href: (path: string) => `#${path}`,
      navigate: (path: string) => {
        void navigate(path, { replace: createPath(location) === path });
      },
    }),
    [navigate, location],
  );
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    return bindAndroidBack(
      App,
      ({ canGoBack }) => {
        if (canGoBack) return navigate(-1);
        return App.exitApp();
      },
      () => setBackUnavailable(true),
    );
  }, [navigate]);

  if (location.pathname === "/") return <Navigate to="/markets" replace />;
  const route = parseWorkspaceRoute(
    location.pathname,
    new URLSearchParams(location.search).get("view"),
  );
  return (
    <>
      <aside
        className="mobile-connection-notice"
        aria-label="Connection status"
      >
        <strong>Not connected to your computer</strong>
        <p>
          Phone access is being prepared. This build cannot load or save your
          research.
        </p>
        {backUnavailable && (
          <p>Use the on-screen navigation while Android Back is unavailable.</p>
        )}
      </aside>
      <PersonalWorkspaceClient
        authMode="account"
        route={route}
        navigation={navigation}
      />
      <details className="mobile-license-notices">
        <summary>Open-source notices</summary>
        <pre>{thirdPartyNotices}</pre>
      </details>
    </>
  );
}
