import { useState, type RefObject } from "react";
import { ManagedWatchlistDraftFiles } from "./ManagedWatchlistDraftFiles";
import { ManagedWatchlistExport } from "./ManagedWatchlistExport";
import { createManagedWatchlistDraftAccountScope } from "./managed-watchlist-draft-recovery";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";
import type { ManagedWorkspace } from "./managed-workspace";
import type { TrialSession } from "./session";
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";

interface SessionOptions {
  apiOrigin: string;
  session: TrialSession;
  draftFileDelivery?: ManagedWatchlistDraftFileDeliveryAdapter;
}

/** The mounted account session owns one scope, shared by browser and native. */
export function useWatchlistDraftFileSession(initial: SessionOptions) {
  const delivery = initial.draftFileDelivery;
  const [scope] = useState(() => {
    if (!delivery) return undefined;
    return createManagedWatchlistDraftAccountScope(
      initial.apiOrigin,
      initial.session.userId,
    );
  });
  if (!scope) return {};
  if (!delivery) return {};
  return { draftFileScope: scope, draftFileDelivery: delivery };
}

interface EntryProps {
  workspace: ManagedWorkspace;
  scope: Promise<string> | undefined;
  delivery: ManagedWatchlistDraftFileDeliveryAdapter | undefined;
  routeActive: () => boolean;
  heading: RefObject<HTMLHeadingElement | null>;
}

function focusRestoredWatchlist({ workspace, heading }: EntryProps) {
  if (workspace.getSnapshot().view !== "watchlist") return;
  if (workspace.sessionOwner.getSnapshot().phase !== "active") return;
  heading.current?.focus();
}

function ManagedWatchlistDraftFilesEntry(props: EntryProps) {
  if (!props.scope) return null;
  return (
    <ManagedWatchlistDraftFiles
      workspace={props.workspace}
      accountScope={props.scope}
      delivery={props.delivery}
      routeActive={props.routeActive}
      onRestored={() => focusRestoredWatchlist(props)}
    />
  );
}

interface FilesProps extends EntryProps {
  exportDelivery: WatchlistExportDeliveryAdapter | undefined;
}

/** Keep confirmed-record export and unconfirmed draft transfer distinct within the file tools. */
export function ManagedWatchlistFiles(props: FilesProps) {
  return (
    <>
      <ManagedWatchlistExport
        workspace={props.workspace}
        delivery={props.exportDelivery}
        routeActive={props.routeActive}
      />
      <ManagedWatchlistDraftFilesEntry {...props} />
    </>
  );
}
