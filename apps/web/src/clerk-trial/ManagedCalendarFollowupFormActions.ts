import type {
  ResearchFollowup,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  prepareCalendarFollowup,
  type CalendarFollowupPreparation,
  type CalendarFollowupPreview,
  type CalendarSourceCapture,
} from "./managed-calendar-followup";
import {
  actionCurrent,
  formCurrent,
  idleAction,
  preparationReady,
  retire,
  retired,
  type Form,
  type Interaction,
} from "./ManagedCalendarFollowupFormLifetime";
import type { CalendarFollowupDisplay } from "./ManagedCalendarFollowupFormSelectors";

interface Selection {
  capture: CalendarSourceCapture;
  member: WatchlistMembership;
}
function sourceSelection(interaction: Interaction): Selection | null {
  const capture = interaction.host.props.capture;
  const member = interaction.form.current.member;
  if (!capture || !member) return null;
  return { capture, member };
}
function edit(interaction: Interaction, change: Partial<Form>) {
  if (!idleAction(interaction)) return;
  retire(interaction.lifetime);
  interaction.publish({
    ...interaction.form.current,
    ...change,
    preview: null,
    created: null,
    message: null,
  });
}
function prepareValue(
  interaction: Interaction,
  selection: Selection,
  current: () => boolean,
) {
  const context =
    interaction.host.props.workspace.captureMarketsCalendarFollowup(
      selection.capture,
      selection.member,
    );
  if (!context.port) return { preview: null, reason: context.reason };
  return prepareCalendarFollowup(
    context.port,
    interaction.form.current.question,
    interaction.form.current.dueOn,
    current,
  );
}
function publishPreview(
  interaction: Interaction,
  result: CalendarFollowupPreparation,
  current: () => boolean,
) {
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
}
function preview(interaction: Interaction) {
  if (!preparationReady(interaction)) return;
  const selection = sourceSelection(interaction);
  if (!selection) return;
  interaction.lifetime.busy = true;
  retire(interaction.lifetime);
  const token = interaction.lifetime.token;
  const current = () => formCurrent(interaction, token);
  try {
    publishPreview(
      interaction,
      prepareValue(interaction, selection, current),
      current,
    );
  } finally {
    interaction.lifetime.busy = false;
  }
}
function publishCreation(
  interaction: Interaction,
  entry: ResearchFollowup | null,
) {
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
}
function create(interaction: Interaction, value: CalendarFollowupPreview) {
  if (!idleAction(interaction)) return;
  if (interaction.lifetime.preview !== value) return;
  interaction.lifetime.busy = true;
  interaction.lifetime.preview = null;
  try {
    publishCreation(interaction, value.create());
  } finally {
    interaction.lifetime.busy = false;
  }
}
function loadSelection(interaction: Interaction) {
  if (!preparationReady(interaction)) return null;
  const selection = sourceSelection(interaction);
  if (!selection) return null;
  if (
    !interaction.host.props.workspace.canLoadMarketsCalendarFollowups(
      selection.capture,
      selection.member,
    )
  )
    return null;
  return selection;
}
function finishLoad(
  interaction: Interaction,
  current: () => boolean,
  message: string | null,
) {
  if (!current()) return;
  interaction.lifetime.loading = null;
  interaction.publish({ ...interaction.form.current, message });
}
async function load(interaction: Interaction) {
  const selection = loadSelection(interaction);
  if (!selection) return;
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
    await interaction.host.props.workspace.loadMarketsCalendarFollowups(
      selection.capture,
      selection.member,
      current,
    );
  } catch {
    message =
      "Follow-ups could not be loaded. Your selected company, question and due date are retained.";
  } finally {
    finishLoad(interaction, current, message);
  }
}
function toggleAllowed(interaction: Interaction) {
  if (interaction.committed.current !== interaction.host) return false;
  if (interaction.host.token !== interaction.lifetime.token) return false;
  if (!interaction.host.props.isCurrent()) return false;
  return !interaction.host.props.navigationPending;
}
function toggle(interaction: Interaction, open: boolean) {
  if (!toggleAllowed(interaction)) return;
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
  if (!entry) return;
  if (!idleAction(interaction)) return;
  interaction.lifetime.busy = true;
  retire(interaction.lifetime);
  try {
    interaction.host.props.onReview(entry);
  } finally {
    interaction.lifetime.busy = false;
  }
}
function chooseMember(
  interaction: Interaction,
  shown: CalendarFollowupDisplay,
  listingId: string,
) {
  const member =
    shown.members.find((item) => item.listingId === listingId) ?? null;
  if (interaction.host.props.workspace.canEdit()) edit(interaction, { member });
}
function createPreview(
  interaction: Interaction,
  shown: CalendarFollowupDisplay,
) {
  if (shown.preview) create(interaction, shown.preview);
}
function manageWatchlist(interaction: Interaction) {
  if (actionCurrent(interaction)) interaction.host.props.onManageWatchlist();
}
export function calendarFormActions(
  interaction: Interaction,
  shown: CalendarFollowupDisplay,
) {
  return {
    edit: (field: "question" | "dueOn", value: string) =>
      edit(interaction, { [field]: value }),
    choose: (listingId: string) => chooseMember(interaction, shown, listingId),
    prepare: () => preview(interaction),
    create: () => createPreview(interaction, shown),
    load: () => {
      void load(interaction);
    },
    toggle: (open: boolean) => toggle(interaction, open),
    cancel: () => toggle(interaction, false),
    review: () =>
      review(interaction, interaction.host.state.created ?? shown.existing),
    manageWatchlist: () => manageWatchlist(interaction),
  };
}
