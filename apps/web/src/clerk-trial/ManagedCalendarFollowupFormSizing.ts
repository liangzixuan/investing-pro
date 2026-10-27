import { useLayoutEffect, useRef } from "react";
interface Sizing {
  node: HTMLTextAreaElement;
  view: Window;
  active: boolean;
  width: number;
  frame: number | null;
}
function fitCompleteCheck(node: HTMLTextAreaElement) {
  node.style.height = "0px";
  const border = node.offsetHeight - node.clientHeight;
  node.style.height = `${Math.ceil(node.scrollHeight + border)}px`;
}
function fit(sizing: Sizing) {
  if (!sizing.active) return;
  const width = sizing.node.getBoundingClientRect().width;
  if (width <= 0) return;
  // Ignore notifications caused only by our own height update.
  if (width === sizing.width) return;
  sizing.width = width;
  fitCompleteCheck(sizing.node);
}
function schedule(sizing: Sizing) {
  if (!sizing.active) return;
  if (sizing.frame !== null) return;
  sizing.frame = sizing.view.requestAnimationFrame(() => {
    sizing.frame = null;
    fit(sizing);
  });
}
function stop(sizing: Sizing) {
  sizing.active = false;
  if (sizing.frame !== null) sizing.view.cancelAnimationFrame(sizing.frame);
}
function observeWidth(sizing: Sizing, resize: () => void) {
  if (typeof ResizeObserver === "undefined") {
    sizing.view.addEventListener("resize", resize);
    return () => sizing.view.removeEventListener("resize", resize);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(sizing.node);
  return () => observer.disconnect();
}
function observeCheck(node: HTMLTextAreaElement, view: Window) {
  const sizing: Sizing = { node, view, active: true, width: -1, frame: null };
  fit(sizing);
  const stopObserving = observeWidth(sizing, () => schedule(sizing));
  return () => {
    stop(sizing);
    stopObserving();
  };
}
export function useCompleteCheckSize(check: string | null) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    if (check === null) return;
    const node = ref.current;
    if (!node) return;
    const view = node.ownerDocument.defaultView;
    if (!view) return;
    return observeCheck(node, view);
  }, [check]);
  return ref;
}
