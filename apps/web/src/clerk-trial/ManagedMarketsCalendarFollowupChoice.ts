import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { CalendarSourceCapture } from "./managed-calendar-followup";
import type { MarketsDayEntry } from "./markets-day-view";
import type { ManagedMarketsCalendarFollowupProps } from "./ManagedMarketsCalendarFollowup";
interface Choice {
  capture: CalendarSourceCapture | null;
  revision: number;
  reason: string | null;
}
interface Render {
  props: ManagedMarketsCalendarFollowupProps;
  choice: Choice;
}
interface Interaction {
  render: Render;
  committed: RefObject<Render | null>;
  focusFrom: RefObject<HTMLElement | null>;
  publish: (choice: Choice) => void;
}
function current(interaction: Interaction) {
  if (interaction.committed.current !== interaction.render) return false;
  if (!interaction.render.props.isCurrent()) return false;
  return !interaction.render.props.navigationPending;
}
function activeElement() {
  if (typeof document === "undefined") return null;
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}
function keepChoice(
  interaction: Interaction,
  entry: MarketsDayEntry,
  selectionIsCurrent: () => boolean,
) {
  if (!current(interaction) || !selectionIsCurrent()) return;
  const { props, choice } = interaction.render;
  const result = props.workspace.captureMarketsCalendarSource(
    entry.key,
    selectionIsCurrent,
  );
  if (!current(interaction) || !selectionIsCurrent()) return;
  interaction.committed.current = null;
  if (!result.capture) {
    interaction.publish({ ...choice, reason: result.reason });
    return;
  }
  interaction.focusFrom.current = activeElement();
  interaction.publish({
    capture: result.capture,
    revision: choice.revision + 1,
    reason: null,
  });
}
function restoreFocus(interaction: Interaction) {
  if (!current(interaction)) return;
  if (interaction.focusFrom.current?.isConnected)
    interaction.focusFrom.current.focus({ preventScroll: true });
}
export function useCalendarSourceChoice(
  props: ManagedMarketsCalendarFollowupProps,
) {
  const [choice, setChoice] = useState<Choice>({
    capture: null,
    revision: 0,
    reason: null,
  });
  const render = { props, choice };
  const committed = useRef<Render | null>(null);
  const focusFrom = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  const interaction: Interaction = {
    render,
    committed,
    focusFrom,
    publish: setChoice,
  };
  return {
    choice,
    onKeepCheck: (entry: MarketsDayEntry, selectionIsCurrent: () => boolean) =>
      keepChoice(interaction, entry, selectionIsCurrent),
    onClose: () => restoreFocus(interaction),
  };
}
