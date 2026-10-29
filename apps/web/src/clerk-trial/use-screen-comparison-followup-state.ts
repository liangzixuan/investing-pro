import type { ResearchFollowup } from "@research-cockpit/contracts";
import type { ManagedWorkspace } from "./managed-workspace";
import type {
  ScreenComparisonFollowupCapture,
  ScreenComparisonFollowupPreview,
} from "./managed-screen-comparison-followup";
import { comparisonCaptureReady } from "./useManagedScreenComparisonReport";
import { prepareOwnedScreenComparisonFollowup } from "./use-screen-comparison-followup-preparation";

export interface ScreenComparisonFollowupProps {
  workspace: ManagedWorkspace;
  routeActive: () => boolean;
  navigationPending: boolean;
  onReview: (entry: ResearchFollowup, opener: HTMLButtonElement) => void;
}
export interface ScreenComparisonFollowupState {
  open: boolean;
  side: string;
  question: string;
  dueOn: string;
  capture: ScreenComparisonFollowupCapture | null;
  preview: ScreenComparisonFollowupPreview | null;
  created: ResearchFollowup | null;
  loading: boolean;
  message: string | null;
}
export const emptyScreenComparisonFollowup =
  (): ScreenComparisonFollowupState => ({
    open: false,
    side: "",
    question: "",
    dueOn: "",
    capture: null,
    preview: null,
    created: null,
    loading: false,
    message: null,
  });
const STALE =
  "This comparison or check is no longer current. Capture or preview the current context again. Your question and date are retained.";
const INACTIVE_ROUTE = "The comparison form is no longer on its active route.";

/** Transient form and event ownership only; the domain context admits every action. */
export class ScreenComparisonFollowupReview {
  private state = emptyScreenComparisonFollowup();
  private readonly listeners = new Set<() => void>();
  private releases: (() => void)[] = [];
  private alive = true;
  private busy = false;
  private creating = false;
  private formToken: object = {};
  private captureToken: object = {};
  private loading: object | null = null;
  private committed: object | null = null;
  readonly workspace: ManagedWorkspace;
  constructor(private props: ScreenComparisonFollowupProps) {
    this.workspace = props.workspace;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(state: ScreenComparisonFollowupState) {
    if (!this.alive) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private available() {
    return (
      this.alive &&
      !this.props.navigationPending &&
      this.props.routeActive() &&
      this.workspace.sessionOwner.getSnapshot().phase === "active"
    );
  }
  active() {
    return this.state.open && this.available();
  }
  setOpen(open: boolean) {
    if (!this.alive) return;
    if (open && !this.available()) return;
    if (open === this.state.open) return;
    this.captureToken = {};
    this.formToken = {};
    this.state.preview?.cancel();
    this.publish({
      ...this.state,
      open,
      side: "",
      capture: null,
      preview: null,
      message: null,
    });
  }
  currentDisclosure(token: object, state: ScreenComparisonFollowupState) {
    return this.committed === token && this.state === state && this.alive;
  }
  current(token: object, state: ScreenComparisonFollowupState) {
    return (
      this.committed === token &&
      this.state === state &&
      this.active() &&
      !this.busy
    );
  }
  commit(token: object, props: ScreenComparisonFollowupProps) {
    this.committed = token;
    this.props = props;
    if (this.active()) return;
    if (this.state.capture) return this.withdraw(INACTIVE_ROUTE);
    if (this.state.preview) this.withdraw(INACTIVE_ROUTE);
  }
  mount() {
    const w = this.workspace;
    this.releases = [
      w.subscribe,
      w.financialScreen.subscribe,
      w.coordinator.subscribe,
      w.followups.subscribe,
      w.followups.coordinator.subscribe,
      w.sessionOwner.subscribe,
    ].map((subscribe) => subscribe(() => this.fence()));
  }
  dispose() {
    this.alive = false;
    this.committed = null;
    this.captureToken = {};
    this.formToken = {};
    this.state.preview?.cancel();
    this.releases.forEach((release) => release());
    this.listeners.clear();
  }
  private withdraw(reason: string | null = null) {
    const capture = this.state.capture;
    const recorded =
      reason ??
      (capture
        ? this.workspace.screenComparisonFollowup.retirementReason(capture)
        : null);
    this.captureToken = {};
    this.formToken = {};
    this.state.preview?.cancel();
    this.publish({
      ...this.state,
      capture: null,
      preview: null,
      message: recorded === null ? STALE : STALE + " " + recorded,
    });
  }
  private fence() {
    if (this.creating) return;
    if (!this.alive) return;
    if (this.state.capture && !this.state.capture.isCurrent())
      return this.withdraw();
    if (this.state.preview && !this.state.preview.isCurrent()) {
      this.formToken = {};
      this.state.preview.cancel();
      this.publish({ ...this.state, preview: null, message: STALE });
      return;
    }
    const created = this.currentCreatedEntry();
    this.publish({ ...this.state, created });
  }
  private currentCreatedEntry() {
    const created = this.state.created;
    if (!created) return null;
    const draft = this.workspace.followups.coordinator.getSnapshot().draft;
    if (!draft) return null;
    return draft.entries.includes(created) ? created : null;
  }
  private idle() {
    return this.active() && !this.busy && !this.state.loading;
  }
  canCapture() {
    return (
      this.idle() &&
      comparisonCaptureReady(
        this.workspace.financialScreen,
        this.workspace.financialScreen.getSnapshot(),
      )
    );
  }
  capture() {
    if (!this.canCapture()) return;
    this.busy = true;
    this.formToken = {};
    this.captureToken = {};
    this.state.preview?.cancel();
    const token = this.captureToken;
    const current = () => this.active() && this.captureToken === token;
    try {
      const result = this.workspace.screenComparisonFollowup.capture(
        new Date().toISOString(),
        current,
      );
      if (!current()) return;
      if (result.capture && !result.capture.isCurrent()) return;
      this.publish({
        ...this.state,
        capture: result.capture,
        side: "",
        preview: null,
        created: null,
        message: result.reason,
      });
    } finally {
      this.busy = false;
      this.publish({ ...this.state });
    }
  }
  edit(field: "side" | "question" | "dueOn", value: string) {
    if (!this.active() || this.busy) return;
    this.formToken = {};
    this.state.preview?.cancel();
    this.publish({
      ...this.state,
      [field]: value,
      preview: null,
      created: null,
      message: null,
    });
  }
  destinations() {
    return this.state.capture
      ? this.workspace.screenComparisonFollowup.destinations(this.state.capture)
      : [];
  }
  canLoad() {
    if (!this.idle()) return false;
    if (!this.state.capture) return false;
    return this.workspace.screenComparisonFollowup.canLoad(
      this.state.capture,
      this.state.side,
    );
  }
  async load() {
    if (!this.canLoad() || !this.state.capture) return;
    const token = this.formToken,
      request = {},
      capture = this.state.capture,
      side = this.state.side;
    this.loading = request;
    const current = () =>
      this.active() && this.formToken === token && this.loading === request;
    this.publish({ ...this.state, loading: true, message: null });
    let message: string | null = null;
    try {
      await this.workspace.screenComparisonFollowup.load(
        capture,
        side,
        current,
      );
    } catch {
      message =
        "Follow-ups could not be loaded. Your question and date are retained.";
    } finally {
      if (this.alive && this.loading === request) {
        const owned = current();
        this.loading = null;
        this.publish({
          ...this.state,
          loading: false,
          message: owned ? message : this.state.message,
        });
      }
    }
  }
  canPrepare() {
    if (!this.idle()) return false;
    if (!this.state.capture) return false;
    return Boolean(
      this.workspace.screenComparisonFollowup.capturePort(
        this.state.capture,
        this.state.side,
      ).port,
    );
  }
  readinessReason() {
    if (!this.active()) return null;
    if (this.state.loading) return null;
    if (!this.state.capture) return null;
    if (this.state.side !== "left" && this.state.side !== "right") return null;
    return this.workspace.screenComparisonFollowup.capturePort(
      this.state.capture,
      this.state.side,
    ).reason;
  }
  prepare() {
    if (!this.canPrepare() || !this.state.capture) return;
    this.busy = true;
    this.state.preview?.cancel();
    this.formToken = {};
    const token = this.formToken;
    const current = () => this.active() && this.formToken === token;
    try {
      const prepared = prepareOwnedScreenComparisonFollowup(
        this.workspace.screenComparisonFollowup,
        this.state.capture,
        this.state,
        current,
      );
      if (!prepared) return;
      this.publish({
        ...this.state,
        preview: prepared.preview,
        created: null,
        message: prepared.reason,
      });
    } finally {
      this.busy = false;
      this.publish({ ...this.state });
    }
  }
  create(preview: ScreenComparisonFollowupPreview) {
    if (!this.active()) return;
    if (this.busy) return;
    if (this.state.preview !== preview) return;
    this.busy = this.creating = true;
    const token = this.formToken;
    try {
      const created = preview.create();
      if (!this.active() || this.formToken !== token) return;
      this.captureToken = {};
      this.formToken = {};
      this.publish({
        ...this.state,
        capture: null,
        preview: null,
        created,
        message: created
          ? "Created in the Follow-ups draft. Review it, then Save follow-ups separately."
          : STALE,
      });
    } finally {
      this.busy = this.creating = false;
      this.publish({ ...this.state });
    }
  }
  canReview() {
    return (
      this.active() &&
      Boolean(
        this.state.created &&
        this.workspace.followups.coordinator
          .getSnapshot()
          .draft?.entries.includes(this.state.created),
      )
    );
  }
  review(opener: HTMLButtonElement) {
    if (this.canReview() && this.state.created)
      this.props.onReview(this.state.created, opener);
  }
  cancel() {
    if (!this.active() || this.busy) return false;
    this.formToken = {};
    this.state.preview?.cancel();
    this.publish({ ...this.state, preview: null, message: null });
    return true;
  }
}
