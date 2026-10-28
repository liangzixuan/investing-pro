import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS } from "@research-cockpit/contracts";
import type { ManagedAnnualReport } from "./managed-annual-report";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import type {
  AppliedValuationRevenueBasis,
  PreparedValuationRevenueBasis,
} from "./managed-valuation-revenue-basis";

export interface ManagedValuationRevenueBasisActions {
  prepare: (concept: string) => {
    preview: PreparedValuationRevenueBasis | null;
    reason: string | null;
  };
  isCurrent: (preview: PreparedValuationRevenueBasis) => boolean;
  apply: (preview: PreparedValuationRevenueBasis) => {
    applied: boolean;
    message: string;
  };
  retirePreview: () => void;
  getApplied: () => AppliedValuationRevenueBasis | null;
}
export interface RevenueBasisReviewOptions {
  model: ManagedValuationWorkbench;
  annual: ManagedAnnualReport;
  selection: ManagedResearchSelection;
  actions: ManagedValuationRevenueBasisActions;
  disabled: boolean;
}
interface ReviewCommands {
  canAct: () => boolean;
  actions: ManagedValuationRevenueBasisActions;
  concept: string;
  preview: PreparedValuationRevenueBasis | null;
  setConcept: (value: string) => void;
  setPreview: (value: PreparedValuationRevenueBasis | null) => void;
  setMessage: (value: string) => void;
}
function chooseBasis(commands: ReviewCommands, value: string) {
  if (!commands.canAct()) return;
  if (!allowedBasis(value)) return;
  commands.actions.retirePreview();
  commands.setConcept(value);
  commands.setPreview(null);
  commands.setMessage("");
}
function allowedBasis(value: string) {
  return (
    value === "" ||
    PERSONAL_SEC_ANNUAL_REVENUE_CONCEPTS.some((item) => item === value)
  );
}
function prepareBasis(commands: ReviewCommands) {
  if (!commands.canAct()) return;
  const result = commands.actions.prepare(commands.concept);
  commands.setPreview(result.preview);
  commands.setMessage(result.reason ?? "");
}
function applyBasis(commands: ReviewCommands) {
  if (!commands.canAct()) return;
  if (!commands.preview) return;
  if (!commands.actions.isCurrent(commands.preview)) return;
  const result = commands.actions.apply(commands.preview);
  commands.setPreview(null);
  commands.setMessage(result.message);
}
export function useValuationRevenueBasisReview({
  model,
  annual,
  selection,
  actions,
  disabled,
}: RevenueBasisReviewOptions) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const sourceState = useSyncExternalStore(
    annual.subscribe,
    annual.getSnapshot,
    annual.getSnapshot,
  );
  const [concept, setConcept] = useState("");
  const [preview, setPreview] = useState<PreparedValuationRevenueBasis | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const live = useRef(false);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const previewElement = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      actionsRef.current.retirePreview();
    };
  }, []);
  useLayoutEffect(() => {
    actionsRef.current.retirePreview();
    setConcept("");
    setPreview(null);
    setMessage("");
  }, [model, selection]);
  useLayoutEffect(() => {
    if (preview) previewElement.current?.focus();
  }, [preview]);
  const commandContext = {
    model,
    annual,
    selection,
    disabled,
    state,
    sourceState,
  };
  const latestCommandContext = useRef(commandContext);
  latestCommandContext.current = commandContext;
  const canAct = () => {
    if (!live.current) return false;
    if (latestCommandContext.current !== commandContext) return false;
    if (disabled) return false;
    if (model.getSnapshot() !== state) return false;
    return annual.getSnapshot() === sourceState;
  };
  const commands = {
    canAct,
    actions,
    concept,
    preview,
    setConcept,
    setPreview,
    setMessage,
  };
  return {
    sourceState,
    concept,
    preview,
    message,
    previewElement,
    current: preview !== null && actions.isCurrent(preview),
    applied: actions.getApplied(),
    choose: (value: string) => chooseBasis(commands, value),
    prepare: () => prepareBasis(commands),
    apply: () => applyBasis(commands),
  };
}
