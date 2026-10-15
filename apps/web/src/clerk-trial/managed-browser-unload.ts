import type { ManagedSessionOwner } from "./managed-session-owner";

/** Bind the browser warning to this mounted session without saving or copying its draft. */
export function bindManagedBrowserUnload(
  owner: Pick<ManagedSessionOwner, "getSnapshot" | "subscribe">,
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
) {
  let disposed = false;
  let attached = false;
  const needsWarning = () => {
    const current = owner.getSnapshot();
    return current.phase === "active" && current.needsLeaveReview;
  };
  const beforeUnload = (event: Event) => {
    if (!disposed && needsWarning()) event.preventDefault();
  };
  const sync = () => {
    if (disposed) return;
    const needed = needsWarning();
    if (needed === attached) return;
    attached = needed;
    if (needed) target.addEventListener("beforeunload", beforeUnload);
    else target.removeEventListener("beforeunload", beforeUnload);
  };
  const unsubscribe = owner.subscribe(sync);
  sync();
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    if (attached) target.removeEventListener("beforeunload", beforeUnload);
    attached = false;
  };
}
