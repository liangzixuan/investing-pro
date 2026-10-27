import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type {
  ResearchFollowup,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  prepareCalendarFollowup,
  type CalendarFollowupPreview,
  type CalendarSourceCapture,
} from "./managed-calendar-followup";

export interface CalendarFormProps {
  workspace: ManagedWorkspace;
  capture: CalendarSourceCapture | null;
  isCurrent: () => boolean;
  navigationPending: boolean;
  onReview: (entry: ResearchFollowup) => void;
  onManageWatchlist: () => void;
  onClose: () => void;
}
interface Form {
  open: boolean;
  member: WatchlistMembership | null;
  question: string;
  dueOn: string;
  preview: CalendarFollowupPreview | null;
  created: ResearchFollowup | null;
  message: string | null;
}
interface Lifetime {
  token: object;
  preview: CalendarFollowupPreview | null;
  loading: object | null;
  busy: boolean;
}
interface Host {
  props: CalendarFormProps;
  state: Form;
  token: object;
}
interface Interaction {
  host: Host;
  committed: RefObject<Host | null>;
  form: RefObject<Form>;
  lifetime: Lifetime;
  publish: (next: Form) => void;
}
const retired =
  "This source, company, question, date or draft changed. Choose the current context and preview it again.";
function sourceCurrent(props: CalendarFormProps) {
  return (
    props.isCurrent() &&
    !props.navigationPending &&
    props.capture?.isCurrent() === true
  );
}
function formCurrent(interaction: Interaction, token: object) {
  const host = interaction.committed.current;
  if (!host || !host.state.open) return false;
  if (host.props.workspace !== interaction.host.props.workspace) return false;
  if (host.props.capture !== interaction.host.props.capture) return false;
  if (interaction.lifetime.token !== token) return false;
  return sourceCurrent(host.props);
}
function actionCurrent(interaction: Interaction) {
  return (
    interaction.committed.current === interaction.host &&
    formCurrent(interaction, interaction.host.token)
  );
}
function retire(lifetime: Lifetime) {
  lifetime.token = {};
  lifetime.preview?.cancel();
  lifetime.preview = null;
  lifetime.loading = null;
}
function edit(interaction: Interaction, change: Partial<Form>) {
  if (!actionCurrent(interaction) || interaction.lifetime.busy) return;
  retire(interaction.lifetime);
  interaction.publish({
    ...interaction.form.current,
    ...change,
    preview: null,
    created: null,
    message: null,
  });
}
function preview(interaction: Interaction) {
  if (
    !actionCurrent(interaction) ||
    interaction.lifetime.loading ||
    interaction.lifetime.busy
  )
    return;
  const { capture, workspace } = interaction.host.props;
  const member = interaction.form.current.member;
  if (!capture || !member) return;
  interaction.lifetime.busy = true;
  retire(interaction.lifetime);
  const token = interaction.lifetime.token;
  const current = () => formCurrent(interaction, token);
  try {
    const context = workspace.captureMarketsCalendarFollowup(capture, member);
    const result = context.port
      ? prepareCalendarFollowup(
          context.port,
          interaction.form.current.question,
          interaction.form.current.dueOn,
          current,
        )
      : { preview: null, reason: context.reason };
    if (!current()) {
      result.preview?.cancel();
      return;
    }
    interaction.lifetime.preview = result.preview;
    interaction.publish({
      ...interaction.form.current,
      preview: result.preview,
      message: result.reason,
      created: null,
    });
  } finally {
    interaction.lifetime.busy = false;
  }
}
function create(interaction: Interaction, value: CalendarFollowupPreview) {
  if (
    !actionCurrent(interaction) ||
    interaction.lifetime.busy ||
    interaction.lifetime.preview !== value
  )
    return;
  interaction.lifetime.busy = true;
  interaction.lifetime.preview = null;
  try {
    const entry = value.create();
    if (!formCurrent(interaction, interaction.host.token)) return;
    retire(interaction.lifetime);
    interaction.publish({
      ...interaction.form.current,
      preview: null,
      created: entry,
      message: entry
        ? "Created in the Follow-ups draft. Review the check, then Save follow-ups separately. My Watchlist is unchanged."
        : retired,
    });
  } finally {
    interaction.lifetime.busy = false;
  }
}
async function load(interaction: Interaction) {
  if (
    !actionCurrent(interaction) ||
    interaction.lifetime.loading ||
    interaction.lifetime.busy
  )
    return;
  const { capture, workspace } = interaction.host.props;
  const member = interaction.form.current.member;
  if (
    !capture ||
    !member ||
    !workspace.canLoadMarketsCalendarFollowups(capture, member)
  )
    return;
  retire(interaction.lifetime);
  const token = interaction.lifetime.token;
  const request = {};
  interaction.lifetime.loading = request;
  const current = () =>
    formCurrent(interaction, token) && interaction.lifetime.loading === request;
  interaction.publish({
    ...interaction.form.current,
    preview: null,
    message: null,
  });
  let message: string | null = null;
  try {
    await workspace.loadMarketsCalendarFollowups(capture, member, current);
  } catch {
    message =
      "Follow-ups could not be loaded. Your selected company, question and due date are retained.";
  } finally {
    if (current()) {
      interaction.lifetime.loading = null;
      interaction.publish({ ...interaction.form.current, message });
    }
  }
}
function toggle(interaction: Interaction, open: boolean) {
  if (
    interaction.committed.current !== interaction.host ||
    interaction.host.token !== interaction.lifetime.token
  )
    return;
  if (
    !interaction.host.props.isCurrent() ||
    interaction.host.props.navigationPending
  )
    return;
  retire(interaction.lifetime);
  interaction.publish({
    ...interaction.form.current,
    open,
    preview: null,
    message: null,
  });
  if (!open) interaction.host.props.onClose();
}
function review(interaction: Interaction, entry: ResearchFollowup | null) {
  if (!entry || !actionCurrent(interaction) || interaction.lifetime.busy)
    return;
  interaction.lifetime.busy = true;
  retire(interaction.lifetime);
  try {
    interaction.host.props.onReview(entry);
  } finally {
    interaction.lifetime.busy = false;
  }
}
function canLoad(interaction: Interaction) {
  const { props, state } = interaction.host;
  if (!sourceCurrent(props) || interaction.lifetime.loading) return false;
  if (!props.capture || !state.member) return false;
  return props.workspace.canLoadMarketsCalendarFollowups(
    props.capture,
    state.member,
  );
}
function message(
  interaction: Interaction,
  validPreview: boolean,
  reason: string | null,
) {
  const { state, props } = interaction.host;
  if (state.preview && !validPreview) return retired;
  if (state.message) return state.message;
  if (props.capture && !sourceCurrent(props)) return retired;
  return reason;
}
function display(interaction: Interaction) {
  const { workspace, capture } = interaction.host.props;
  const state = interaction.host.state;
  const saved = workspace.followups.coordinator.getSnapshot();
  const members = workspace.coordinator.getSnapshot().draft?.memberships ?? [];
  const member = state.member;
  const context =
    capture && member
      ? workspace.captureMarketsCalendarFollowup(capture, member)
      : null;
  const current = sourceCurrent(interaction.host.props);
  const value = state.preview;
  const validPreview =
    value?.isCurrent() === true && interaction.lifetime.preview === value;
  const existing = member
    ? (saved.draft?.entries.find(
        (entry) => entry.listing.listingId === member.listingId,
      ) ?? null)
    : null;
  return {
    state,
    saved,
    members,
    canChoose: current && workspace.canEdit(),
    current,
    existing,
    preview: validPreview ? value : null,
    canPreview:
      current &&
      !interaction.lifetime.loading &&
      context?.port?.isCurrent() === true,
    canLoad: canLoad(interaction),
    message: message(interaction, validPreview, context?.reason ?? null),
  };
}
function useLifetime(interaction: Interaction) {
  const { host, committed, lifetime } = interaction;
  useLayoutEffect(() => {
    committed.current = host;
    return () => {
      if (committed.current === host) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    host.token = lifetime.token;
    return () => retire(lifetime);
  }, [host.props.workspace, host.props.capture, lifetime]);
  const stalePreview = host.state.preview && !host.state.preview.isCurrent();
  useLayoutEffect(() => {
    if (stalePreview && lifetime.preview === host.state.preview) {
      retire(lifetime);
      if (committed.current === host) host.token = lifetime.token;
    }
  }, [stalePreview, lifetime]);
}
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
  const shown = display(interaction);
  return {
    ...shown,
    edit: (field: "question" | "dueOn", value: string) =>
      edit(interaction, { [field]: value }),
    choose: (listingId: string) => {
      const member =
        shown.members.find((item) => item.listingId === listingId) ?? null;
      if (props.workspace.canEdit()) edit(interaction, { member });
    },
    prepare: () => preview(interaction),
    create: () => {
      if (shown.preview) create(interaction, shown.preview);
    },
    load: () => {
      void load(interaction);
    },
    toggle: (open: boolean) => toggle(interaction, open),
    cancel: () => toggle(interaction, false),
    review: () => review(interaction, state.created ?? shown.existing),
    manageWatchlist: () => {
      if (actionCurrent(interaction)) props.onManageWatchlist();
    },
  };
}
export type CalendarFollowupControls = ReturnType<
  typeof useCalendarFollowupForm
>;
