import type { WatchlistMembership } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  sourceCurrent,
  retired,
  type Interaction,
} from "./ManagedCalendarFollowupFormLifetime";

type Saved = ReturnType<
  ManagedWorkspace["followups"]["coordinator"]["getSnapshot"]
>;
function watchlistMembers(workspace: ManagedWorkspace) {
  return workspace.coordinator.getSnapshot().draft?.memberships ?? [];
}
function previewContext(interaction: Interaction) {
  const { capture, workspace } = interaction.host.props;
  const member = interaction.host.state.member;
  if (!capture || !member) return { port: null, reason: null };
  return workspace.captureMarketsCalendarFollowup(capture, member);
}
function currentPreview(interaction: Interaction) {
  const value = interaction.host.state.preview;
  if (value?.isCurrent() !== true) return null;
  if (interaction.lifetime.preview !== value) return null;
  return value;
}
function existingEntry(saved: Saved, member: WatchlistMembership | null) {
  if (!member) return null;
  return (
    saved.draft?.entries.find(
      (entry) => entry.listing.listingId === member.listingId,
    ) ?? null
  );
}
function canPreview(
  interaction: Interaction,
  context: ReturnType<typeof previewContext>,
  current: boolean,
) {
  if (!current || interaction.lifetime.loading) return false;
  return context.port?.isCurrent() === true;
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
export function calendarFormDisplay(interaction: Interaction) {
  const { workspace } = interaction.host.props;
  const state = interaction.host.state;
  const saved = workspace.followups.coordinator.getSnapshot();
  const context = previewContext(interaction);
  const current = sourceCurrent(interaction.host.props);
  const preview = currentPreview(interaction);
  return {
    state,
    saved,
    members: watchlistMembers(workspace),
    canChoose: current && workspace.canEdit(),
    current,
    existing: existingEntry(saved, state.member),
    preview,
    canPreview: canPreview(interaction, context, current),
    canLoad: canLoad(interaction),
    message: message(interaction, preview !== null, context.reason),
  };
}
export type CalendarFollowupDisplay = ReturnType<typeof calendarFormDisplay>;
