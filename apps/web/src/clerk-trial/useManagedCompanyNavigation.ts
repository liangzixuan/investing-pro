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
  pending: boolean;
  isPending: () => boolean;
  returnFocus: number;
  open: (action: () => void) => void;
  section: (section: "annual" | "interim" | "eod" | "filings") => void;
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
      value.view === "followups" ||
      value.view === "portfolio" ||
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
  const [pending, setPending] = useState(false);
  const setNavigationPending = useCallback((value: boolean) => {
    pendingNavigation.current = value;
    setPending(value);
  }, []);
  const isPending = useCallback(() => pendingNavigation.current, []);
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
    if (workspace.portfolio.getSnapshot().pendingEditor) {
      if (parsed.kind !== "none")
        void navigate("/", { replace: true, state: null });
      return;
    }
    const prior = previous.current;
    previous.current = {
      company: parsed.kind !== "none",
      origin: returnLocation(location.state, scope),
    };
    appliedKey.current = location.key;
    setNavigationPending(false);
    workspace.setNavigationBlocked(parsed.kind !== "none");
    void workspace.setCompanyRoute(parsed.kind === "company" ? parsed : null);
    if (prior.company && parsed.kind === "none") {
      if (action === NavigationType.Pop && prior.origin) {
        const resumed =
          prior.origin.view === "followups" &&
          workspace.resumeMarketsBriefingFollowup();
        if (!resumed) workspace.setView(prior.origin.view);
      }
      setReturnFocus((value) => value + 1);
    }
  }, [
    action,
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigate,
    scope,
    setNavigationPending,
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
      workspace.setNavigationBlocked(true);
      setNavigationPending(true);
      void navigate("/", { replace: true, state: null });
    }
  }, [
    discovery,
    location.key,
    navigate,
    route.kind,
    setNavigationPending,
    workspace,
  ]);

  const open = useCallback(
    (openResearch: () => void) => {
      if (pendingNavigation.current || !workspace.canNavigate()) return;
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
      workspace.setNavigationBlocked(true);
      setNavigationPending(true);
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
      setNavigationPending,
      workspace,
    ],
  );

  const section = useCallback(
    (next: "annual" | "interim" | "eod" | "filings") => {
      if (pendingNavigation.current || !workspace.canNavigate()) return;
      if (next === "annual") workspace.switchToAnnual();
      else if (next === "interim") workspace.switchToInterim();
      else if (next === "eod") workspace.switchToEod();
      else if (next === "filings") workspace.switchToFilings();
      else return;
      const current = workspace.getSnapshot().research;
      if (!current) return;
      const href = managedCompanyHref(
        current.selection.listing.listingId,
        current.section,
      );
      if (location.pathname + location.search === href) return;
      workspace.setNavigationBlocked(true);
      setNavigationPending(true);
      const state: unknown = location.state;
      void navigate(href, { replace: true, state });
    },
    [
      location.pathname,
      location.search,
      location.state,
      navigate,
      setNavigationPending,
      workspace,
    ],
  );

  const view = useCallback(
    (next: WorkspaceView) => {
      if (pendingNavigation.current || !workspace.canNavigate()) return false;
      workspace.setNavigationBlocked(true);
      setNavigationPending(true);
      workspace.setView(next);
      if (route.kind !== "none")
        void navigate("/", { replace: true, state: null });
      else {
        setNavigationPending(false);
        workspace.setNavigationBlocked(false);
      }
      return true;
    },
    [navigate, route.kind, setNavigationPending, workspace],
  );

  const back = useCallback(() => {
    if (pendingNavigation.current || !workspace.canNavigate()) return;
    workspace.setNavigationBlocked(true);
    setNavigationPending(true);
    workspace.closeResearch();
    if (route.kind === "company" && returnLocation(location.state, scope)) {
      void navigate(-1);
    } else {
      workspace.setView("markets");
      void navigate("/", { replace: true, state: null });
    }
  }, [
    location.state,
    navigate,
    route.kind,
    scope,
    setNavigationPending,
    workspace,
  ]);

  const hasCompanyRoute = useCallback(
    () => route.kind !== "none" || pendingNavigation.current,
    [route.kind],
  );

  return {
    invalid: route.kind === "invalid",
    pending,
    isPending,
    returnFocus,
    open,
    section,
    view,
    back,
    hasCompanyRoute,
  };
}
