import { useLayoutEffect } from "react";
import {
  emptyValuationFollowupForm,
  valuationFollowupFormOwned,
  type ValuationFollowupInteraction,
  type ValuationFollowupLifetime,
  type ValuationFollowupRender,
} from "./valuation-followup-review-state";

function sameHost(
  current: ValuationFollowupRender,
  host: ValuationFollowupRender,
) {
  return (
    current.owner === host.owner &&
    current.actions.model === host.actions.model &&
    current.valuation === host.valuation
  );
}
function valuationCurrent(render: ValuationFollowupRender) {
  return (
    render.valuation.getSnapshot() === render.valuationState &&
    render.valuation.getDraftFileActivityRevision() === render.draftFileActivity
  );
}
export function valuationFollowupFormCurrent(
  i: ValuationFollowupInteraction,
  token: object,
) {
  const current = i.committed.current;
  if (current === null) return false;
  if (!sameHost(current, i.render)) return false;
  if (current.navigationPending) return false;
  return i.lifetime.token === token && valuationCurrent(i.render);
}
export function valuationFollowupResourcesCurrent(
  render: ValuationFollowupRender,
) {
  return (
    render.actions.model.getSnapshot() === render.state &&
    render.actions.model.coordinator.getSnapshot() === render.saved
  );
}
export function valuationFollowupActionCurrent(
  i: ValuationFollowupInteraction,
) {
  return (
    i.committed.current === i.render &&
    valuationFollowupFormCurrent(i, i.render.token) &&
    valuationFollowupResourcesCurrent(i.render)
  );
}
export function valuationFollowupCanMutate(i: ValuationFollowupInteraction) {
  return valuationFollowupActionCurrent(i) && !i.lifetime.busy;
}
export function valuationFollowupCanStart(i: ValuationFollowupInteraction) {
  return valuationFollowupCanMutate(i) && i.lifetime.loading === null;
}
export function retireValuationFollowup(lifetime: ValuationFollowupLifetime) {
  lifetime.token = {};
  const preview = lifetime.preview;
  lifetime.preview = null;
  lifetime.loading = null;
  lifetime.loadingCurrent = null;
  lifetime.focusFrom = null;
  preview?.cancel();
}
function fencePublishedLifetime(lifetime: ValuationFollowupLifetime) {
  if (lifetime.creating) return;
  if (lifetime.preview && !lifetime.preview.isCurrent())
    retireValuationFollowup(lifetime);
  if (lifetime.loadingCurrent && !lifetime.loadingCurrent())
    retireValuationFollowup(lifetime);
}
function subscribeLifetime(i: ValuationFollowupInteraction) {
  const fence = () => fencePublishedLifetime(i.lifetime);
  const releases = [
    i.render.valuation.subscribe(fence),
    i.render.valuation.subscribeDraftFileActivity(fence),
    i.render.actions.model.subscribe(fence),
    i.render.actions.model.coordinator.subscribe(fence),
  ];
  return () => {
    releases.forEach((release) => release());
    retireValuationFollowup(i.lifetime);
  };
}
function commitInteraction(i: ValuationFollowupInteraction) {
  i.committed.current = i.render;
  return () => {
    if (i.committed.current === i.render) i.committed.current = null;
  };
}
function ownInteraction(i: ValuationFollowupInteraction) {
  i.render.token = i.lifetime.token;
  if (!valuationFollowupFormOwned(i.form.current, i.render))
    i.publish(emptyValuationFollowupForm(i.render));
  return subscribeLifetime(i);
}
function fenceNavigation(i: ValuationFollowupInteraction) {
  if (!i.render.navigationPending) return;
  retireValuationFollowup(i.lifetime);
  i.render.token = i.lifetime.token;
}
function fenceRenderedPreview(i: ValuationFollowupInteraction) {
  const preview = i.render.form.preview;
  if (!preview) return;
  if (i.lifetime.preview !== preview) return;
  if (preview.isCurrent()) return;
  retireValuationFollowup(i.lifetime);
  i.render.token = i.lifetime.token;
}
export function useValuationFollowupLifetime(i: ValuationFollowupInteraction) {
  const { render, lifetime } = i;
  useLayoutEffect(() => commitInteraction(i));
  useLayoutEffect(
    () => ownInteraction(i),
    [render.owner, render.actions.model, render.valuation, lifetime],
  );
  useLayoutEffect(
    () => fenceNavigation(i),
    [render.navigationPending, lifetime],
  );
  useLayoutEffect(() => fenceRenderedPreview(i));
}
