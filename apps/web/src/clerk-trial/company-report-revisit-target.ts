import {
  normalizeWatchlistNote,
  type MainWatchlistPayload,
} from "@research-cockpit/contracts";
import type { CompanyReportRevisitTarget } from "./company-report-revisit";
import type { ManagedResearchSelection } from "./managed-research-selection";
import type { ManagedSessionState } from "./managed-session-owner";
import type {
  ManagedResearchVisit,
  ResearchWatchlistState,
} from "./managed-workspace";
import type { SaveState } from "./save-coordinator";

interface ReportRevisitLifetime {
  readonly retired: boolean;
  readonly navigationBlocked: boolean;
  readonly operation: symbol;
  readonly navigation: number;
}
export interface CompanyReportRevisitTargetPort {
  readonly selection: ManagedResearchSelection;
  readonly routeActive: () => boolean;
  readonly watchlist: () => ResearchWatchlistState;
  readonly saved: () => SaveState<MainWatchlistPayload>;
  readonly session: () => Readonly<ManagedSessionState>;
  readonly sessionOwner: () => object;
  readonly visit: () => ManagedResearchVisit | null;
  readonly lifetime: () => ReportRevisitLifetime;
  readonly note: (note: string, expectedNote: string) => void;
}
interface ReportRevisitCapture {
  readonly port: CompanyReportRevisitTargetPort;
  readonly watchlist: ResearchWatchlistState;
  readonly saved: SaveState<MainWatchlistPayload>;
  readonly session: Readonly<ManagedSessionState>;
  readonly sessionOwner: object;
  readonly visit: ManagedResearchVisit | null;
  readonly lifetime: ReportRevisitLifetime;
}
function watchlistIsReady(watchlist: ResearchWatchlistState): boolean {
  if (watchlist.canEdit) return true;
  return watchlist.canAdd;
}
function workspaceRouteIsCurrent(
  port: CompanyReportRevisitTargetPort,
): boolean {
  const lifetime = port.lifetime();
  if (lifetime.retired) return false;
  if (lifetime.navigationBlocked) return false;
  return port.routeActive();
}
function sessionIsCurrent(capture: ReportRevisitCapture): boolean {
  // Resource dirty summaries can change inside this same workspace session.
  // The captured visit/operation and active owner still fence session retirement.
  return (
    capture.port.sessionOwner() === capture.sessionOwner &&
    capture.session.phase === "active" &&
    capture.port.session().phase === "active"
  );
}
function visitIsCurrent(capture: ReportRevisitCapture): boolean {
  if (capture.port.visit() !== capture.visit) return false;
  return capture.visit?.selection === capture.port.selection;
}
function operationIsCurrent(capture: ReportRevisitCapture): boolean {
  const lifetime = capture.port.lifetime();
  if (lifetime.operation !== capture.lifetime.operation) return false;
  return lifetime.navigation === capture.lifetime.navigation;
}
function targetIsCurrent(capture: ReportRevisitCapture): boolean {
  // Preserve the fresh catalog/member/readiness read before testing captured owners.
  const current = capture.port.watchlist();
  if (!workspaceRouteIsCurrent(capture.port)) return false;
  if (!sessionIsCurrent(capture)) return false;
  if (!visitIsCurrent(capture)) return false;
  if (!operationIsCurrent(capture)) return false;
  if (capture.port.saved() !== capture.saved) return false;
  return watchlistIsReady(current);
}
function appendCapturedNote(
  capture: ReportRevisitCapture,
  note: string,
  expectedNote: string,
): boolean {
  if (!targetIsCurrent(capture)) return false;
  if (!capture.watchlist.canEdit) return false;
  if (capture.watchlist.member?.note !== expectedNote) return false;
  if (normalizeWatchlistNote(note) === null) return false;
  capture.port.note(note, expectedNote);
  return (
    capture.port
      .saved()
      .draft?.memberships.find(
        (member) =>
          member.listingId === capture.port.selection.listing.listingId,
      )?.note === note
  );
}
/** Capture a whole-draft/visit target; append uses the existing note edit, never Save. */
export function captureCompanyReportRevisitTargetContext(
  port: CompanyReportRevisitTargetPort,
): CompanyReportRevisitTarget | null {
  const watchlist = port.watchlist();
  if (!watchlistIsReady(watchlist)) return null;
  if (!port.routeActive()) return null;
  const saved = port.saved();
  const session = port.session();
  const visit = port.visit();
  const lifetime = port.lifetime();
  const capture: ReportRevisitCapture = {
    port,
    watchlist,
    saved,
    session,
    sessionOwner: port.sessionOwner(),
    visit,
    lifetime,
  };
  let retired = false;
  const isCurrent = () => {
    if (retired) return false;
    retired = !targetIsCurrent(capture);
    return !retired;
  };
  return {
    isCurrent,
    append: (note, expectedNote) =>
      isCurrent() && appendCapturedNote(capture, note, expectedNote),
  };
}
