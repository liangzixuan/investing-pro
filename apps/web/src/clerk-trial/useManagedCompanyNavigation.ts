import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  NavigationType,
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router";
import {
  managedCompanyHref,
  parseManagedCompanyRoute,
} from "./managed-company-route";
import type {
  ManagedDiscoveryState,
  ManagedWorkspace,
} from "./managed-workspace";

type WorkspaceView = ManagedDiscoveryState["view"];
interface ReturnLocation {
  scope: string;
  view: WorkspaceView;
}
export interface ManagedCompanyNavigation {
  invalid: boolean;
  returnFocus: number;
  open: (action: () => void) => void;
  section: (section: "annual" | "eod") => void;
  view: (view: WorkspaceView) => boolean;
  back: () => void;
  hasCompanyRoute: () => boolean;
}

function returnLocation(state: unknown, scope: string): ReturnLocation | null {
  if (!state || typeof state !== "object" || !("companyReturn" in state))
    return null;
  const value = state.companyReturn;
  if (
    !value ||
    typeof value !== "object" ||
    !("scope" in value) ||
    !("view" in value)
  )
    return null;
  return value.scope === scope &&
    (value.view === "markets" ||
      value.view === "discover" ||
      value.view === "watchlist")
    ? { scope, view: value.view }
    : null;
}

/** URL navigation shares the session's existing workspace; it owns no research data. */
export function useManagedCompanyNavigation(
  workspace: ManagedWorkspace,
): ManagedCompanyNavigation {
  const location = useLocation();
  const navigate = useNavigate();
  const action = useNavigationType();
  const [scope] = useState(() => crypto.randomUUID());
  const [returnFocus, setReturnFocus] = useState(0);
  const pendingNavigation = useRef(false);
  const appliedKey = useRef<string | null>(null);
  const previous = useRef<{ company: boolean; origin: ReturnLocation | null }>({
    company: false,
    origin: null,
  });
  const discovery = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const route =
    location.pathname === "/"
      ? parseManagedCompanyRoute(new URLSearchParams(location.search))
      : { kind: "invalid" as const };

  useLayoutEffect(() => {
    const parsed =
      location.pathname === "/"
        ? parseManagedCompanyRoute(new URLSearchParams(location.search))
        : { kind: "invalid" as const };
    const prior = previous.current;
    previous.current = {
      company: parsed.kind !== "none",
      origin: returnLocation(location.state, scope),
    };
    appliedKey.current = location.key;
    pendingNavigation.current = false;
    void workspace.setCompanyRoute(parsed.kind === "company" ? parsed : null);
    if (prior.company && parsed.kind === "none") {
      if (action === NavigationType.Pop && prior.origin)
        workspace.setView(prior.origin.view);
      setReturnFocus((value) => value + 1);
    }
  }, [
    action,
    location.key,
    location.pathname,
    location.search,
    location.state,
    scope,
    workspace,
  ]);

  // A catalog/session refusal closes the URL too. It never reapplies an unchanged URL.
  useEffect(() => {
    const current = workspace.getSnapshot();
    if (
      route.kind === "company" &&
      appliedKey.current === location.key &&
      !pendingNavigation.current &&
      !current.research &&
      !current.companyRoute
    ) {
      pendingNavigation.current = true;
      void navigate("/", { replace: true, state: null });
    }
  }, [discovery, location.key, navigate, route.kind, workspace]);

  const open = useCallback(
    (openResearch: () => void) => {
      if (pendingNavigation.current) return;
      openResearch();
      const current = workspace.getSnapshot();
      if (!current.research) return;
      const href = managedCompanyHref(
        current.research.selection.listing.listingId,
        current.research.section,
      );
      if (location.pathname + location.search === href) return;
      const replacing = route.kind !== "none";
      const origin = replacing
        ? returnLocation(location.state, scope)
        : { scope, view: current.view };
      pendingNavigation.current = true;
      void navigate(href, {
        replace: replacing,
        state: origin ? { companyReturn: origin } : null,
      });
    },
    [
      location.pathname,
      location.search,
      location.state,
      navigate,
      route.kind,
      scope,
      workspace,
    ],
  );

  const section = useCallback(
    (next: "annual" | "eod") => {
      if (pendingNavigation.current) return;
      if (next === "annual") workspace.switchToAnnual();
      else workspace.switchToEod();
      const current = workspace.getSnapshot().research;
      if (!current) return;
      const href = managedCompanyHref(
        current.selection.listing.listingId,
        current.section,
      );
      if (location.pathname + location.search === href) return;
      pendingNavigation.current = true;
      const state: unknown = location.state;
      void navigate(href, { replace: true, state });
    },
    [location.pathname, location.search, location.state, navigate, workspace],
  );

  const view = useCallback(
    (next: WorkspaceView) => {
      if (pendingNavigation.current) return false;
      pendingNavigation.current = true;
      workspace.setView(next);
      if (route.kind !== "none")
        void navigate("/", { replace: true, state: null });
      else pendingNavigation.current = false;
      return true;
    },
    [navigate, route.kind, workspace],
  );

  const back = useCallback(() => {
    if (pendingNavigation.current) return;
    pendingNavigation.current = true;
    workspace.closeResearch();
    if (route.kind === "company" && returnLocation(location.state, scope)) {
      void navigate(-1);
    } else {
      workspace.setView("markets");
      void navigate("/", { replace: true, state: null });
    }
  }, [location.state, navigate, route.kind, scope, workspace]);

  const hasCompanyRoute = useCallback(
    () => route.kind !== "none" || pendingNavigation.current,
    [route.kind],
  );

  return {
    invalid: route.kind === "invalid",
    returnFocus,
    open,
    section,
    view,
    back,
    hasCompanyRoute,
  };
}
