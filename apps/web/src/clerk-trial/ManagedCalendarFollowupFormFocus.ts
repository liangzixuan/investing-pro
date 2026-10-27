import { useLayoutEffect, useRef, type RefObject } from "react";
import type { CalendarFollowupPreview } from "./managed-calendar-followup";
import type { CalendarFormProps } from "./ManagedCalendarFollowupFormState";
function focusHeading(ref: RefObject<HTMLHeadingElement | null>) {
  ref.current?.focus({ preventScroll: true });
  ref.current?.scrollIntoView({ block: "nearest" });
}
function focusSource(
  props: CalendarFormProps,
  ref: RefObject<HTMLHeadingElement | null>,
) {
  if (!props.capture) return;
  if (!props.isCurrent()) return;
  if (props.navigationPending) return;
  focusHeading(ref);
}
function focusPreview(
  preview: CalendarFollowupPreview | null,
  ref: RefObject<HTMLHeadingElement | null>,
) {
  if (preview) focusHeading(ref);
}
export function useCalendarFormFocus(
  props: CalendarFormProps,
  preview: CalendarFollowupPreview | null,
) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previewHeading = useRef<HTMLHeadingElement | null>(null);
  useLayoutEffect(() => focusPreview(preview, previewHeading), [preview]);
  useLayoutEffect(() => focusSource(props, heading), [props.capture]);
  return { heading, previewHeading };
}
