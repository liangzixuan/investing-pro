import type { ValuationAssumptionEntry } from "@research-cockpit/contracts";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import { companyEvidenceSelectionMatches } from "./managed-company-snapshot";
import type { ManagedResearchSelection } from "./managed-research-selection";
import {
  captureValuationCalculationGuard,
  type ManagedValuationCalculation,
  type ManagedValuationInputCapture,
  type ManagedValuationBaseRevenueCapture,
  type ManagedValuationWorkbench,
} from "./managed-valuation-workbench";
import {
  ANNUAL_REVENUE_BASIS_STALE as stale,
  annualRevenueSourceExcerpt,
  resolveAnnualRevenueBasis,
  type AnnualRevenueBasisSource,
} from "./managed-valuation-revenue-source";
export {
  resolveAnnualRevenueBasis,
  type AnnualRevenueBasisSource,
} from "./managed-valuation-revenue-source";

export interface PreparedValuationRevenueBasis {
  readonly selection: ManagedResearchSelection;
  readonly source: AnnualRevenueBasisSource;
  readonly before: ValuationAssumptionEntry;
  readonly after: ValuationAssumptionEntry;
  readonly beforeRevenue: string;
  readonly afterRevenue: string;
  readonly excerpt: string;
}
export interface AppliedValuationRevenueBasis {
  readonly selection: ManagedResearchSelection;
  readonly source: AnnualRevenueBasisSource;
  readonly baseRevenue: string;
  readonly excerpt: string;
}
export interface ValuationRevenueBasisInput {
  readonly selection: ManagedResearchSelection;
  readonly annual: ManagedAnnualReportState;
  readonly concept: string;
  readonly isCurrent: () => boolean;
}
interface PreviewCapture {
  readonly handle: PreparedValuationRevenueBasis;
  readonly inputs: ManagedValuationInputCapture;
  readonly field: ManagedValuationBaseRevenueCapture;
  readonly current: () => boolean;
}
interface AppliedDraftCapture {
  readonly field: ManagedValuationBaseRevenueCapture;
  readonly inputs: ManagedValuationInputCapture;
}
function safelyCurrent(current: () => boolean) {
  try {
    return current() === true;
  } catch {
    return false;
  }
}
function copySelection(selection: ManagedResearchSelection) {
  return Object.freeze({
    ...selection,
    listing: Object.freeze({ ...selection.listing }),
  });
}

/** One opaque source authority becomes permanently retired after its first refusal. */
class AppliedBasisOwnership {
  private retired = false;
  private checking = false;
  constructor(private readonly current: () => boolean) {}
  isCurrent() {
    if (this.retired) return false;
    if (this.checking) return false;
    this.checking = true;
    const current = safelyCurrent(this.current);
    this.checking = false;
    if (!current) this.retired = true;
    return current;
  }
}
const appliedCaptures = new WeakMap<
  AppliedValuationRevenueBasis,
  AppliedBasisOwnership
>();
function ownedSource(context: AppliedValuationRevenueBasis) {
  return appliedCaptures.get(context)?.isCurrent() ?? false;
}
export function annualRevenueBasisContextIsOwned(
  context: AppliedValuationRevenueBasis,
  selection: ManagedResearchSelection,
  calculation: ManagedValuationCalculation | null,
): boolean {
  if (!appliedCaptures.has(context)) return false;
  if (!companyEvidenceSelectionMatches(selection, context.selection))
    return false;
  if (!ownedSource(context)) return false;
  if (!calculation) return false;
  if (!companyEvidenceSelectionMatches(selection, calculation.owner))
    return false;
  if (calculation.exitDraft.baseRevenue !== context.baseRevenue) return false;
  return captureValuationCalculationGuard(calculation)?.() === true;
}
export function annualRevenueBasisExcerpt(
  context: AppliedValuationRevenueBasis,
): string | null {
  return ownedSource(context) ? context.excerpt : null;
}

function completePreview(
  selection: ManagedResearchSelection,
  source: AnnualRevenueBasisSource,
  inputs: ManagedValuationInputCapture,
  field: ManagedValuationBaseRevenueCapture,
): PreparedValuationRevenueBasis {
  const before = inputs.entry;
  const after = Object.freeze({
    ...before,
    exit: Object.freeze({
      ...before.exit,
      inputs: Object.freeze({
        ...before.exit.inputs,
        baseRevenue: source.value,
      }),
    }),
  });
  return Object.freeze({
    selection,
    source,
    before,
    after,
    beforeRevenue: field.value,
    afterRevenue: source.value,
    excerpt: annualRevenueSourceExcerpt(selection, source),
  });
}

/** Explicit source choice and one-use input replacement; never calculates, reads or saves. */
export class ManagedValuationRevenueBasis {
  private preview: PreviewCapture | null = null;
  private applied: AppliedValuationRevenueBasis | null = null;
  private revision = 0;
  private applying = false;
  private preparing = false;
  constructor(private readonly model: ManagedValuationWorkbench) {
    model.subscribe(() => this.reconcile());
  }
  retirePreview() {
    this.revision++;
    this.preview = null;
  }
  invalidate() {
    this.retirePreview();
    this.applied = null;
  }
  reconcile() {
    const preview = this.preview;
    if (preview) this.isCurrent(preview.handle);
    if (this.applied && !ownedSource(this.applied)) this.applied = null;
  }
  getApplied(
    selection: ManagedResearchSelection,
  ): AppliedValuationRevenueBasis | null {
    this.reconcile();
    if (!this.applied) return null;
    return companyEvidenceSelectionMatches(selection, this.applied.selection)
      ? this.applied
      : null;
  }
  prepare(input: ValuationRevenueBasisInput): {
    preview: PreparedValuationRevenueBasis | null;
    reason: string | null;
  } {
    if (this.applying || this.preparing)
      return { preview: null, reason: stale };
    this.preparing = true;
    try {
      return this.capture(input);
    } finally {
      this.preparing = false;
    }
  }
  private capture(input: ValuationRevenueBasisInput) {
    this.retirePreview();
    const revision = this.revision;
    if (!safelyCurrent(input.isCurrent))
      return { preview: null, reason: stale };
    if (revision !== this.revision) return { preview: null, reason: stale };
    const snapshot = this.model.getSnapshot();
    if (!companyEvidenceSelectionMatches(input.selection, snapshot.owner))
      return { preview: null, reason: stale };
    if (!companyEvidenceSelectionMatches(input.selection, snapshot.context))
      return { preview: null, reason: stale };
    const resolved = resolveAnnualRevenueBasis(
      input.selection,
      input.annual,
      input.concept,
    );
    if (!resolved.source) return { preview: null, reason: resolved.reason };
    return this.captureInputs(input, resolved.source, revision);
  }
  private captureInputs(
    input: ValuationRevenueBasisInput,
    source: AnnualRevenueBasisSource,
    revision: number,
  ) {
    const inputs = this.model.captureInputs(),
      field = this.model.captureBaseRevenue();
    if (!inputs) return { preview: null, reason: stale };
    if (!field) return { preview: null, reason: stale };
    const selection = copySelection(input.selection);
    const handle = completePreview(selection, source, inputs, field);
    const current = () =>
      safelyCurrent(input.isCurrent) &&
      companyEvidenceSelectionMatches(input.selection, selection);
    const captured = { handle, inputs, field, current };
    if (this.inspectPreview(captured, revision) !== "current")
      return { preview: null, reason: stale };
    this.preview = captured;
    return { preview: handle, reason: null };
  }
  private inspectPreview(captured: PreviewCapture, revision: number) {
    const current = safelyCurrent(captured.current);
    if (revision !== this.revision) return "replaced";
    if (!current) return "stale";
    if (!this.model.isInputCaptureCurrent(captured.inputs)) return "stale";
    return "current";
  }
  isCurrent(preview: PreparedValuationRevenueBasis): boolean {
    const captured = this.preview;
    if (!captured) return false;
    if (captured.handle !== preview) return false;
    const state = this.inspectPreview(captured, this.revision);
    if (state === "replaced") return false;
    if (state === "current") return true;
    this.retirePreview();
    return false;
  }
  private claimPreview(preview: PreparedValuationRevenueBasis) {
    const captured = this.preview;
    if (!captured) return null;
    if (captured.handle !== preview) return null;
    if (this.applying) return null;
    this.preview = null;
    return captured;
  }
  apply(preview: PreparedValuationRevenueBasis): {
    applied: boolean;
    message: string;
  } {
    const captured = this.claimPreview(preview);
    if (!captured) return { applied: false, message: stale };
    const revision = ++this.revision;
    this.applying = true;
    try {
      return this.applyCaptured(captured, revision);
    } finally {
      this.applying = false;
    }
  }
  private applyCaptured(captured: PreviewCapture, revision: number) {
    if (this.inspectPreview(captured, revision) !== "current")
      return { applied: false, message: stale };
    this.applied = null;
    if (!this.model.setExitField("baseRevenue", captured.handle.source.value))
      return { applied: false, message: stale };
    return this.attachApplied(captured, revision);
  }
  private captureAppliedDraft(
    captured: PreviewCapture,
  ): AppliedDraftCapture | null {
    const field = this.model.captureBaseRevenueAfterApply(
      captured.field,
      captured.handle.source.value,
    );
    const inputs = this.model.captureInputs();
    if (!field) return null;
    if (!inputs) return null;
    if (JSON.stringify(inputs.entry) !== JSON.stringify(captured.handle.after))
      return null;
    return { field, inputs };
  }
  private attachmentCurrent(
    captured: PreviewCapture,
    draft: AppliedDraftCapture,
    revision: number,
  ) {
    if (!safelyCurrent(captured.current)) return false;
    if (revision !== this.revision) return false;
    if (!this.model.isInputCaptureCurrent(draft.inputs)) return false;
    return this.model.isBaseRevenueCaptureCurrent(draft.field);
  }
  private attachApplied(captured: PreviewCapture, revision: number) {
    const draft = this.captureAppliedDraft(captured);
    if (!draft) return { applied: false, message: stale };
    if (!this.attachmentCurrent(captured, draft, revision))
      return { applied: false, message: stale };
    this.recordApplied(captured, draft.field);
    return {
      applied: true,
      message:
        "Annual revenue applied to authored starting revenue. Calculate separately; no other input was changed.",
    };
  }
  private appliedContextCurrent(
    context: AppliedValuationRevenueBasis,
    field: ManagedValuationBaseRevenueCapture,
    sourceCurrent: () => boolean,
  ) {
    if (this.applied !== context) return false;
    if (!this.model.isBaseRevenueCaptureCurrent(field)) return false;
    return safelyCurrent(sourceCurrent);
  }
  private recordApplied(
    captured: PreviewCapture,
    field: ManagedValuationBaseRevenueCapture,
  ) {
    const context = Object.freeze({
      selection: captured.handle.selection,
      source: captured.handle.source,
      baseRevenue: field.value,
      excerpt: captured.handle.excerpt,
    });
    this.applied = context;
    appliedCaptures.set(
      context,
      new AppliedBasisOwnership(() =>
        this.appliedContextCurrent(context, field, captured.current),
      ),
    );
  }
}
