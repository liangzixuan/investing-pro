import type { ManagedEodIdentity } from "@research-cockpit/contracts";
import type {
  ManagedFinancialScreen,
  ManagedFinancialScreenMember,
  ManagedFinancialScreenState,
} from "./managed-financial-screen";
import {
  formatManagedFinancialScreenRecipe,
  parseManagedFinancialScreenRecipe,
  MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES,
  type ManagedFinancialScreenRecipeContent,
} from "./managed-financial-screen-recipe";
import type { ManagedFinancialScreenRecipeDeliveryAdapter } from "./financial-screen-recipe-delivery";

interface Options {
  readonly model: ManagedFinancialScreen;
  readonly delivery: ManagedFinancialScreenRecipeDeliveryAdapter;
  readonly routeActive: () => boolean;
  readonly now?: () => string;
}
export interface ScreenRecipeIdentityReview {
  readonly previous: ManagedEodIdentity;
  readonly current: ManagedFinancialScreenMember | null;
  readonly status:
    "same" | "metadata_changed" | "identity_changed" | "missing" | "uncovered";
}
export interface ScreenRecipeReview {
  readonly file: ManagedFinancialScreenRecipeContent;
  readonly current: ManagedFinancialScreenState;
  readonly rows: readonly ScreenRecipeIdentityReview[];
  readonly canApply: boolean;
}
export interface ScreenRecipesState {
  readonly name: string;
  readonly phase: "idle" | "exporting" | "reading" | "review";
  readonly review: ScreenRecipeReview | null;
  readonly canCapture: boolean;
  readonly canImport: boolean;
  readonly message: string;
}
export interface ScreenRecipeFileSelection {
  readonly handle: symbol;
}
interface FileSelection {
  readonly token: ScreenRecipeFileSelection;
  readonly screen: ManagedFinancialScreenState;
}
interface Operation {
  readonly screen: ManagedFinancialScreenState;
  readonly controller: AbortController;
}
const stableKeys = [
  "listingId",
  "issuerId",
  "securityId",
  "shareClassId",
  "exchangeMic",
  "country",
  "instrumentType",
] as const;
function identityStatus(
  previous: ManagedEodIdentity,
  current: ManagedFinancialScreenMember | null,
  model: ManagedFinancialScreen,
): ScreenRecipeIdentityReview["status"] {
  if (!current) return "missing";
  if (stableKeys.some((key) => current.listing[key] !== previous[key]))
    return "identity_changed";
  if (!model.hasCoverage(current)) return "uncovered";
  return Object.keys(previous).some(
    (key) =>
      previous[key as keyof ManagedEodIdentity] !==
      current.listing[key as keyof ManagedEodIdentity],
  )
    ? "metadata_changed"
    : "same";
}
function reviewIdentity(
  previous: ManagedEodIdentity,
  screen: ManagedFinancialScreenState,
  model: ManagedFinancialScreen,
): ScreenRecipeIdentityReview {
  const current =
    screen.memberships.find(
      (member) => member.listing.listingId === previous.listingId,
    ) ?? null;
  return Object.freeze({
    previous,
    current,
    status: identityStatus(previous, current, model),
  });
}
function readRecipe(bytes: ArrayBuffer, size: number) {
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength !== size) return null;
  return parseManagedFinancialScreenRecipe(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
  );
}
function validSize(size: number) {
  return (
    Number.isSafeInteger(size) &&
    size > 0 &&
    size <= MANAGED_FINANCIAL_SCREEN_RECIPE_MAX_BYTES
  );
}

function readableScreenDefinition(screen: ManagedFinancialScreenState) {
  if (!screen.active || !screen.canRead) return false;
  if (screen.catalogChanged || screen.criteriaStaged) return false;
  return screen.pending === null && screen.run?.status !== "running";
}
function prepareRecipeReview(
  file: ManagedFinancialScreenRecipeContent,
  current: ManagedFinancialScreenState,
  model: ManagedFinancialScreen,
): ScreenRecipeReview {
  const rows = Object.freeze(
    file.listings.map((listing) => reviewIdentity(listing, current, model)),
  );
  const canApply = rows.every(
    (row) => row.status === "same" || row.status === "metadata_changed",
  );
  return Object.freeze({ file, current, rows, canApply });
}
/** Transient recipe IO owns no source reads, saved resources or persisted definition. */
export class ManagedFinancialScreenRecipes {
  private state: ScreenRecipesState = Object.freeze({
    name: "",
    phase: "idle",
    review: null,
    canCapture: false,
    canImport: false,
    message: "",
  });
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private operation: Operation | null = null;
  private selection: FileSelection | null = null;
  private transition = {};
  constructor(private readonly options: Options) {
    this.publish({});
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    this.unsubscribe ??= this.options.model.subscribe(this.reconcile);
    this.reconcile();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.clear("");
      }
    };
  };
  private context() {
    if (!this.listeners.size || !this.options.routeActive()) return null;
    const screen = this.options.model.getSnapshot();
    if (!readableScreenDefinition(screen)) return null;
    return screen.memberships.some((member) =>
      this.options.model.hasCoverage(member),
    )
      ? screen
      : null;
  }
  private same(screen: ManagedFinancialScreenState) {
    return this.context() === screen;
  }
  private current(operation: Operation) {
    return (
      this.operation === operation &&
      !operation.controller.signal.aborted &&
      this.same(operation.screen)
    );
  }
  private document(
    screen: ManagedFinancialScreenState,
    name = this.state.name,
  ) {
    if (
      !screen.selected.length ||
      screen.selected.some((member) => !this.options.model.hasCoverage(member))
    )
      return null;
    return formatManagedFinancialScreenRecipe({
      name,
      capturedAt: this.options.now?.() ?? new Date().toISOString(),
      catalogSnapshotSha256: screen.catalogSnapshotSha256!,
      criteria: screen.criteria,
      listings: screen.selected.map((member) => member.listing),
    });
  }
  private publish(patch: Partial<ScreenRecipesState>) {
    const context = this.context();
    const phase = patch.phase ?? this.state.phase;
    const available = context !== null && this.operation === null;
    const next = Object.freeze({
      ...this.state,
      ...patch,
      canCapture:
        available &&
        this.document(context, patch.name ?? this.state.name) !== null,
      canImport:
        context !== null && (this.operation === null || phase === "review"),
    });
    if (
      Object.keys(next).every(
        (key) =>
          next[key as keyof ScreenRecipesState] ===
          this.state[key as keyof ScreenRecipesState],
      )
    )
      return;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
  private clear(message: string, patch: Partial<ScreenRecipesState> = {}) {
    const transition = {};
    this.transition = transition;
    const operation = this.operation;
    this.operation = null;
    this.selection = null;
    operation?.controller.abort();
    this.publish({ phase: "idle", review: null, message, ...patch });
    return transition;
  }
  private operationChanged() {
    return this.operation !== null && !this.current(this.operation);
  }
  private selectionChanged() {
    return this.selection !== null && !this.same(this.selection.screen);
  }
  reconcile = () => {
    if (this.operationChanged() || this.selectionChanged())
      this.clear(
        "The screen or session changed. Select the recipe again to review it.",
      );
    else this.publish({});
  };
  setName(name: string, captured = this.state) {
    if (!this.listeners.size || captured !== this.state) return;
    this.clear("", { name });
  }
  cancel = (captured = this.state) => {
    if (captured === this.state)
      this.clear(
        "Recipe action cancelled. The current definition is unchanged.",
      );
  };
  cancelFileSelection(token: ScreenRecipeFileSelection | null) {
    if (this.selection?.token === token) this.cancel();
  }
  private settledTransition(transition: object) {
    return this.transition === transition && this.operation === null;
  }
  chooseFile(captured = this.state): ScreenRecipeFileSelection | null {
    if (captured !== this.state) return null;
    const transition = this.clear("");
    const screen = this.context();
    if (!screen) return null;
    if (!this.settledTransition(transition)) return null;
    const token = Object.freeze({ handle: Symbol() });
    this.selection = { token, screen };
    return token;
  }
  private finish(operation: Operation, message: string) {
    if (this.current(operation)) this.clear(message);
    else this.reconcile();
  }
  async capture(captured = this.state) {
    if (captured !== this.state) return;
    this.reconcile();
    const screen = this.context();
    if (!this.state.canCapture || !screen) return;
    const document = this.document(screen);
    if (!document) return;
    const operation = { screen, controller: new AbortController() };
    this.operation = operation;
    this.publish({ phase: "exporting", message: "" });
    try {
      if (!this.current(operation)) return;
      const result = await this.options.delivery.deliver(document, {
        signal: operation.controller.signal,
        isCurrent: () => this.current(operation),
      });
      const messages = {
        written: "Screen recipe saved. It contains the definition only.",
        download_requested:
          "Screen recipe download requested. Check your chosen destination.",
        cancelled:
          "Recipe save cancelled. The current definition is unchanged.",
      };
      this.finish(operation, messages[result]);
    } catch {
      this.finish(
        operation,
        "The recipe could not be saved. Check the chosen destination before trying again.",
      );
    }
  }
  private beginRead(token: ScreenRecipeFileSelection | null): Operation | null {
    const selection = this.selection;
    if (!selection) return null;
    if (selection.token !== token || this.operation) return null;
    if (!this.same(selection.screen)) return null;
    this.selection = null;
    const operation = {
      screen: selection.screen,
      controller: new AbortController(),
    };
    this.operation = operation;
    this.publish({ phase: "reading", review: null, message: "" });
    return operation;
  }
  private reviewBytes(operation: Operation, bytes: ArrayBuffer, size: number) {
    if (!this.current(operation)) {
      this.reconcile();
      return;
    }
    const content = readRecipe(bytes, size);
    if (!content) throw new Error("recipe");
    const review = prepareRecipeReview(
      content,
      operation.screen,
      this.options.model,
    );
    this.publish({
      phase: "review",
      review,
      message: review.canApply
        ? "Review the complete file and current definition. Applying does not run the screen."
        : "The complete recipe cannot be applied because a listing is missing, changed or outside current Annual coverage.",
    });
  }
  private async readSelectedFile(
    operation: Operation,
    file: Pick<File, "size" | "arrayBuffer">,
  ) {
    if (!this.current(operation)) return;
    if (!validSize(file.size)) throw new Error("size");
    const size = file.size,
      bytes = await file.arrayBuffer();
    this.reviewBytes(operation, bytes, size);
  }
  async readFile(
    file: Pick<File, "size" | "arrayBuffer">,
    token: ScreenRecipeFileSelection | null,
  ) {
    const operation = this.beginRead(token);
    if (!operation) {
      this.reconcile();
      return;
    }
    try {
      await this.readSelectedFile(operation, file);
    } catch {
      this.finish(
        operation,
        "This recipe is invalid or exceeds 64 KiB. The current definition is unchanged.",
      );
    }
  }
  private reviewedOperation(review: ScreenRecipeReview): Operation | null {
    if (this.state.review !== review || !review.canApply) return null;
    const operation = this.operation;
    if (!operation) return null;
    return this.current(operation) ? operation : null;
  }
  apply(review: ScreenRecipeReview): boolean {
    const operation = this.reviewedOperation(review);
    if (!operation) {
      this.reconcile();
      return false;
    }
    const transition = this.clear("");
    if (!this.settledTransition(transition)) return false;
    if (!this.same(operation.screen)) return false;
    const accepted = this.options.model.applyRecipeDefinition(
      operation.screen,
      review.file.criteria,
      review.rows.map((row) => row.current!),
    );
    if (this.transition === transition)
      this.publish({
        message: accepted
          ? "Recipe definition applied. Run the screen explicitly to load reports."
          : "The screen changed before Apply. Select the recipe again.",
      });
    return accepted;
  }
}
