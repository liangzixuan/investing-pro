import { useLayoutEffect, type RefObject } from "react";
import type {
  ResearchFollowup,
  WatchlistMembership,
} from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type {
  CalendarFollowupPreview,
  CalendarSourceCapture,
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
export interface Form {
  open: boolean;
  member: WatchlistMembership | null;
  question: string;
  dueOn: string;
  preview: CalendarFollowupPreview | null;
  created: ResearchFollowup | null;
  message: string | null;
}
export interface Lifetime {
  token: object;
  preview: CalendarFollowupPreview | null;
  loading: object | null;
  busy: boolean;
}
export interface Host {
  props: CalendarFormProps;
  state: Form;
  token: object;
}
export interface Interaction {
  host: Host;
  committed: RefObject<Host | null>;
  form: RefObject<Form>;
  lifetime: Lifetime;
  publish: (next: Form) => void;
}
export const retired =
  "This source, company, question, date or draft changed. Choose the current context and preview it again.";
export function sourceCurrent(props: CalendarFormProps) {
  return (
    props.isCurrent() &&
    !props.navigationPending &&
    props.capture?.isCurrent() === true
  );
}
export function formCurrent(interaction: Interaction, token: object) {
  const host = interaction.committed.current;
  if (!host || !host.state.open) return false;
  if (host.props.workspace !== interaction.host.props.workspace) return false;
  if (host.props.capture !== interaction.host.props.capture) return false;
  if (interaction.lifetime.token !== token) return false;
  return sourceCurrent(host.props);
}
export function actionCurrent(interaction: Interaction) {
  return (
    interaction.committed.current === interaction.host &&
    formCurrent(interaction, interaction.host.token)
  );
}
export function retire(lifetime: Lifetime) {
  lifetime.token = {};
  lifetime.preview?.cancel();
  lifetime.preview = null;
  lifetime.loading = null;
}
export function idleAction(interaction: Interaction) {
  if (!actionCurrent(interaction)) return false;
  return !interaction.lifetime.busy;
}
export function preparationReady(interaction: Interaction) {
  if (!idleAction(interaction)) return false;
  return interaction.lifetime.loading === null;
}
export function useLifetime(interaction: Interaction) {
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
