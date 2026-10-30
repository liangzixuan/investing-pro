import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedResearchFollowupContext } from "./managed-research-followup-context";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedWorkspace } from "./managed-workspace";
import type { SaveCoordinator, SaveState } from "./save-coordinator";
import {
  companyFollowupsReadout,
  companyPortfolioReadout,
  companyWatchlistReadout,
  type CompanyResearchCheckAttachment,
  type CompanyResearchChecksContext,
  type CompanyResearchResource,
} from "./managed-company-research-checks";

interface AttachmentOwner {
  readonly selection: ManagedResearchSelection;
  readonly companyCurrent: () => boolean;
  entry: ResearchFollowup;
  saved: ReturnType<
    ManagedWorkspace["followups"]["coordinator"]["getSnapshot"]
  >;
  model: ReturnType<ManagedWorkspace["followups"]["getSnapshot"]>;
  readonly activity: object;
  retired: boolean;
}
interface Port {
  readonly workspace: ManagedWorkspace;
  readonly current: (
    selection: ManagedResearchSelection,
  ) => (() => boolean) | null;
  readonly ready: (selection: ManagedResearchSelection) => boolean;
  readonly publish: () => void;
}
function idle(saved: SaveState<unknown>) {
  return (
    saved.phase === "idle" &&
    !saved.conflict &&
    !saved.uncertain &&
    !saved.replayPending
  );
}
/** One explicit association; captured actions keep shorter, single-use lifetimes. */
export class ManagedCompanyResearchChecks {
  private owner: AttachmentOwner | null = null;
  private writing = false;
  constructor(private readonly port: Port) {}

  private ownerCurrent(owner: AttachmentOwner): boolean {
    if (owner.retired || this.owner !== owner) return false;
    if (this.writing) return false;
    const model = this.port.workspace.followups;
    owner.retired =
      !owner.companyCurrent() ||
      model.coordinator.getSnapshot() !== owner.saved ||
      model.getSnapshot() !== owner.model ||
      model.getDraftFileActivityRevision() !== owner.activity ||
      model.currentEntry(owner.entry.id) !== owner.entry;
    return !owner.retired;
  }
  private actionCurrent(selection: ManagedResearchSelection) {
    const workspace = this.port.workspace;
    const route = workspace.getResearchDraftSetRoute();
    const sources = [
      workspace.annual,
      workspace.interim,
      workspace.filings,
      workspace.eod,
    ] as const;
    const captured = sources.map((source) => source.getSnapshot());
    const resources = [
      workspace.coordinator,
      workspace.portfolio.coordinator,
      workspace.valuationAssumptions.coordinator,
    ] as const;
    const saved = resources.map((resource) => resource.getSnapshot());
    const watchlistActivity = workspace.getWatchlistDraftFileActivityRevision();
    const portfolioActivity =
      workspace.portfolio.getDraftFileActivityRevision();
    const followupsActivity =
      workspace.followups.getDraftFileActivityRevision();
    let retired = false;
    return () => {
      if (retired) return false;
      const current = workspace.getResearchDraftSetRoute();
      retired =
        current.research !== route.research ||
        current.navigation !== route.navigation ||
        current.view !== route.view ||
        current.companyRoute !== route.companyRoute ||
        current.blocked ||
        workspace.getSnapshot().research?.selection !== selection ||
        workspace.sessionOwner.getSnapshot().phase !== "active" ||
        workspace.getWatchlistDraftFileActivityRevision() !==
          watchlistActivity ||
        workspace.portfolio.getDraftFileActivityRevision() !==
          portfolioActivity ||
        workspace.followups.getDraftFileActivityRevision() !==
          followupsActivity ||
        sources.some(
          (source, index) => source.getSnapshot() !== captured[index],
        ) ||
        resources.some(
          (resource, index) => resource.getSnapshot() !== saved[index],
        );
      return !retired;
    };
  }
  private editsReady(selection: ManagedResearchSelection) {
    const w = this.port.workspace;
    const f = w.followups.getSnapshot();
    const p = w.portfolio.getSnapshot();
    const view = w.getSnapshot();
    const saved = w.followups.coordinator.getSnapshot();
    return (
      this.port.ready(selection) &&
      w.followups.canEdit() &&
      saved.latestLoaded &&
      saved.saved !== null &&
      saved.baseVersion === saved.saved.version &&
      [
        w.coordinator.getSnapshot(),
        w.portfolio.coordinator.getSnapshot(),
        saved,
        w.valuationAssumptions.coordinator.getSnapshot(),
      ].every(idle) &&
      !view.read &&
      !view.review &&
      !view.reviewing &&
      !f.review &&
      !f.reviewing &&
      !p.review &&
      !p.reviewing &&
      !p.pendingEditor &&
      !w.hasWatchlistDraftFileActivity() &&
      !w.portfolio.hasDraftFileActivity() &&
      !w.followups.hasDraftFileActivity() &&
      !w.watchlistFileCatalogReviewRequired() &&
      ![w.annual, w.interim, w.filings, w.eod].some(
        (source) => source.getSnapshot().running,
      )
    );
  }
  private resource<P, V>(
    selection: ManagedResearchSelection,
    coordinator: SaveCoordinator<P>,
    readout: Pick<CompanyResearchResource<P, V>, "status" | "value" | "reason">,
    fileReady: () => boolean,
  ): CompanyResearchResource<P, V> {
    const saved = coordinator.getSnapshot();
    const current = this.actionCurrent(selection);
    const available = () =>
      current() &&
      this.port.ready(selection) &&
      fileReady() &&
      coordinator.getSnapshot() === saved &&
      idle(saved) &&
      saved.draft === null &&
      saved.saved === null &&
      !saved.dirty;
    const canLoad = available();
    let consumed = false;
    return Object.freeze({
      ...readout,
      saved,
      canLoad,
      load: async () => {
        if (consumed || !canLoad || !available()) return;
        consumed = true;
        // The independent resource owns completion, including after navigation.
        await coordinator.load();
      },
    });
  }
  capture(
    selection: ManagedResearchSelection,
  ): CompanyResearchChecksContext | null {
    const w = this.port.workspace;
    const companyCurrent = this.port.current(selection);
    if (!companyCurrent || !companyCurrent()) return null;
    const followups = companyFollowupsReadout(w, selection);
    const owner = this.owner;
    const attachment =
      owner && this.ownerCurrent(owner) ? this.handle(owner) : null;
    const current = this.actionCurrent(selection);
    const saved = w.followups.coordinator.getSnapshot();
    const model = w.followups.getSnapshot();
    const activity = w.followups.getDraftFileActivityRevision();
    const attachReady = () =>
      !this.writing &&
      this.owner === owner &&
      current() &&
      companyCurrent() &&
      selection.origin !== "followups" &&
      !attachment &&
      followups.status === "ready" &&
      saved === w.followups.coordinator.getSnapshot() &&
      model === w.followups.getSnapshot() &&
      activity === w.followups.getDraftFileActivityRevision() &&
      this.editsReady(selection);
    const canAttach = attachReady();
    let consumed = false;
    return Object.freeze({
      watchlist: this.resource(
        selection,
        w.coordinator,
        companyWatchlistReadout(w, selection),
        () => !w.hasWatchlistDraftFileActivity(),
      ),
      portfolio: this.resource(
        selection,
        w.portfolio.coordinator,
        companyPortfolioReadout(w, selection),
        () =>
          !w.portfolio.hasDraftFileActivity() &&
          !w.portfolio.getSnapshot().pendingEditor,
      ),
      followups: this.resource(
        selection,
        w.followups.coordinator,
        followups,
        () => !w.followups.hasDraftFileActivity(),
      ),
      attachment,
      canAttach,
      reason:
        canAttach || attachment
          ? null
          : selection.origin === "followups"
            ? "This visit already belongs to its Follow-ups check."
            : "Load a matching check and finish pending actions, catalog review or draft recovery before using it.",
      attach: (entry: ResearchFollowup) => {
        if (
          consumed ||
          !canAttach ||
          !attachReady() ||
          entry !== followups.value
        )
          return null;
        consumed = true;
        const next: AttachmentOwner = {
          selection,
          companyCurrent,
          entry,
          saved,
          model,
          activity,
          retired: false,
        };
        this.owner = next;
        this.port.publish();
        return this.ownerCurrent(next) ? this.handle(next) : null;
      },
    });
  }
  private handle(owner: AttachmentOwner): CompanyResearchCheckAttachment {
    const current = this.actionCurrent(owner.selection);
    const entry = owner.entry;
    return Object.freeze({
      entry,
      isCurrent: () =>
        current() && this.ownerCurrent(owner) && owner.entry === entry,
    });
  }
  context(
    selection: ManagedResearchSelection,
  ): ManagedResearchFollowupContext | null {
    const owner = this.owner;
    if (!owner || owner.selection !== selection || !this.ownerCurrent(owner))
      return null;
    const entry = owner.entry;
    const saved = owner.saved;
    const actionCurrent = this.actionCurrent(selection);
    let consumed = false;
    const isCurrent = () =>
      !consumed &&
      actionCurrent() &&
      this.ownerCurrent(owner) &&
      owner.entry === entry &&
      owner.saved === saved;
    const editable = isCurrent() && this.editsReady(selection);
    return Object.freeze({
      entry,
      editable,
      dirty: saved.dirty,
      reason: editable
        ? null
        : "Assessment editing is paused. Finish the pending action or draft recovery first.",
      isCurrent,
      editAssessment: (raw: string) => {
        if (!editable || !isCurrent() || !this.editsReady(selection)) return;
        consumed = true;
        this.writing = true;
        const inputRevision = this.port.workspace.followups.getInputRevision();
        try {
          const installed = this.port.workspace.followups.edit(
            entry,
            "result",
            raw,
          );
          const model = this.port.workspace.followups;
          if (
            !installed ||
            model.coordinator.getSnapshot().draft !== installed ||
            !owner.companyCurrent() ||
            !actionCurrent() ||
            model.getInputRevision() !== inputRevision ||
            model.getDraftFileActivityRevision() !== owner.activity
          ) {
            owner.retired = true;
            return;
          }
          const next = model.currentEntry(entry.id);
          if (!next || next.result !== raw) {
            owner.retired = true;
            return;
          }
          owner.entry = next;
          owner.saved = model.coordinator.getSnapshot();
          owner.model = model.getSnapshot();
        } finally {
          this.writing = false;
          this.port.publish();
        }
      },
    });
  }
  reviewEntry(
    selection: ManagedResearchSelection,
  ): CompanyResearchCheckAttachment | null {
    const owner = this.owner;
    return owner &&
      owner.selection === selection &&
      this.ownerCurrent(owner) &&
      this.editsReady(selection)
      ? this.handle(owner)
      : null;
  }
  clear() {
    if (this.owner) this.owner.retired = true;
    this.owner = null;
  }
}
