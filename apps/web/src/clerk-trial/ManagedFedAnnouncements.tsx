import { useLayoutEffect, useRef, useSyncExternalStore, type Ref } from "react";
import { FedMonetaryAnnouncements } from "../features/markets/FedMonetaryAnnouncements";
import type { ManagedFedAnnouncements as Model } from "./managed-fed-announcements";
import {
  ManagedFedAnnouncementNoteAction,
  type ManagedFedAnnouncementNoteContext,
} from "./ManagedFedAnnouncementNoteAction";

export function ManagedFedAnnouncements({
  model,
  headingRef,
  noteContext,
}: {
  model: Model;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  noteContext: ManagedFedAnnouncementNoteContext;
}) {
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
      headingRef={headingRef}
      noteAction={
        <ManagedFedAnnouncementNoteAction {...noteContext} state={state} />
      }
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
