import { useRef, useState } from "react";
import {
  useLifetime,
  type CalendarFormProps,
  type Form,
  type Host,
  type Interaction,
  type Lifetime,
} from "./ManagedCalendarFollowupFormLifetime";
import { calendarFormDisplay } from "./ManagedCalendarFollowupFormSelectors";
import { calendarFormActions } from "./ManagedCalendarFollowupFormActions";
export type { CalendarFormProps } from "./ManagedCalendarFollowupFormLifetime";

export function useCalendarFollowupForm(props: CalendarFormProps) {
  const [state, setState] = useState<Form>({
    open: props.capture !== null,
    member: null,
    question: "",
    dueOn: "",
    preview: null,
    created: null,
    message: null,
  });
  const form = useRef(state);
  const lifetime = useRef<Lifetime>({
    token: {},
    preview: null,
    loading: null,
    busy: false,
  }).current;
  const committed = useRef<Host | null>(null);
  const interaction: Interaction = {
    host: { props, state, token: lifetime.token },
    committed,
    form,
    lifetime,
    publish: (next) => {
      form.current = next;
      setState(next);
    },
  };
  useLifetime(interaction);
  const shown = calendarFormDisplay(interaction);
  return { ...shown, ...calendarFormActions(interaction, shown) };
}
export type CalendarFollowupControls = ReturnType<
  typeof useCalendarFollowupForm
>;
