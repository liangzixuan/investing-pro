import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { BeaReleaseAgenda } from "../features/markets/BeaReleaseAgenda";
import type { ManagedBeaReleaseAgenda as Model } from "./managed-bea-release-agenda";

export function ManagedBeaReleaseAgenda({ model }: { model: Model }) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const load = useRef<HTMLButtonElement>(null);
  const restoreLoad = useRef(false);
  useLayoutEffect(() => {
    if (!state.busy && restoreLoad.current) {
      restoreLoad.current = false;
      load.current?.focus();
    }
  }, [state.busy]);
  return (
    <BeaReleaseAgenda
      {...state}
      className="trial-panel"
      enabled
      loadButtonRef={load}
      onLoad={() => void model.load()}
      onCancel={(event) => {
        restoreLoad.current = document.activeElement === event.currentTarget;
        model.cancel();
      }}
    />
  );
}
