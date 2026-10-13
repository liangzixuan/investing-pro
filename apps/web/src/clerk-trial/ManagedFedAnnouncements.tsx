import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { FedMonetaryAnnouncements } from "../features/markets/FedMonetaryAnnouncements";
import type { ManagedFedAnnouncements as Model } from "./managed-fed-announcements";

export function ManagedFedAnnouncements({ model }: { model: Model }) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const load = useRef<HTMLButtonElement>(null);
  const restoreLoad = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (state.busy || !restoreLoad.current) return;
    const cancel = restoreLoad.current;
    restoreLoad.current = null;
    const button = load.current;
    if (
      (document.activeElement === cancel ||
        document.activeElement === document.body) &&
      button?.isConnected &&
      !button.disabled &&
      !button.closest("[hidden], [inert]") &&
      button.getClientRects().length > 0
    )
      button.focus();
  }, [state.busy]);
  return (
    <FedMonetaryAnnouncements
      {...state}
      className="trial-panel"
      enabled
      loadButtonRef={load}
      onLoad={() => void model.load()}
      onCancel={(event) => {
        restoreLoad.current =
          document.activeElement === event.currentTarget
            ? event.currentTarget
            : null;
        model.cancel();
      }}
    />
  );
}
