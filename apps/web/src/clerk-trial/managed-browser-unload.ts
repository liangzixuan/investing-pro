import type { SaveCoordinator } from "./save-coordinator";

/** Bind the browser warning to this mounted session without saving or copying its draft. */
export function bindManagedBrowserUnload<P>(
  coordinator: Pick<SaveCoordinator<P>, "getSnapshot" | "subscribe">,
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
) {
  let disposed = false;
  let attached = false;
  const needsWarning = () => {
    const current = coordinator.getSnapshot();
    return (
      current.phase !== "retired" &&
      current.phase !== "signing_out" &&
      (current.dirty ||
        current.uncertain ||
        current.phase === "saving" ||
        current.phase === "reconciling")
    );
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
  const unsubscribe = coordinator.subscribe(sync);
  sync();
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    if (attached) target.removeEventListener("beforeunload", beforeUnload);
    attached = false;
  };
}
