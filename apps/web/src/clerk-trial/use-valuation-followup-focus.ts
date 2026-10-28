import { useLayoutEffect, useRef } from "react";
import type { useValuationFollowupReview } from "./use-valuation-followup-review";

type Controls = ReturnType<typeof useValuationFollowupReview>;
function ownsFocus(
  source: HTMLButtonElement | null,
): source is HTMLButtonElement {
  if (!source?.isConnected) return false;
  return source.ownerDocument.activeElement === source;
}
function focusPreview(controls: Controls, heading: HTMLHeadingElement | null) {
  const source = controls.lifetime.focusFrom;
  controls.lifetime.focusFrom = null;
  if (!controls.preview) return;
  if (!ownsFocus(source)) return;
  heading?.focus({ preventScroll: true });
  heading?.scrollIntoView({ block: "nearest" });
}
function cancelAndRestore(
  controls: Controls,
  source: HTMLButtonElement,
  previewButton: HTMLButtonElement | null,
) {
  const restore = source.ownerDocument.activeElement === source;
  if (!controls.cancel()) return;
  if (restore) previewButton?.focus({ preventScroll: true });
}
export function useValuationFollowupFocus(controls: Controls) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previewButton = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(
    () => focusPreview(controls, heading.current),
    [controls.preview, controls.lifetime],
  );
  return {
    heading,
    previewButton,
    cancel: (event: { currentTarget: HTMLButtonElement }) =>
      cancelAndRestore(controls, event.currentTarget, previewButton.current),
    toggle: (event: { currentTarget: { open: boolean } }) => {
      if (!event.currentTarget.open) controls.cancel();
    },
  };
}
