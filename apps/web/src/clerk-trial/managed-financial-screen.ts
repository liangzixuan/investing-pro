import {
  parseManagedCatalogResolveResponse,
  type ManagedEodIdentity,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import {
  ManagedAnnualReportError,
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
  type ManagedApi,
} from "./managed-api";
import {
  ManagedAnnualReport,
  type ManagedAnnualReportSeed,
  type ManagedAnnualReportState,
} from "./managed-annual-report";
import { ManagedSecAccess } from "./managed-sec-access";
import type { ManagedResearchSelection } from "./managed-research-selection";
import { MANAGED_FINANCIAL_SCREEN_LISTING_IDS } from "./managed-financial-screen-cohort";
import {
  DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
  evaluateManagedFinancialScreenRow,
  validateManagedFinancialScreenCriteria,
  type ManagedFinancialScreenCriteria,
  type ManagedFinancialScreenRow,
} from "./managed-financial-screen-results";

export interface ManagedFinancialScreenMember {
  readonly handle: symbol;
  readonly listing: ManagedEodIdentity;
}
export interface ManagedFinancialScreenResultRow {
  readonly handle: symbol;
  readonly member: ManagedFinancialScreenMember;
  readonly report: ManagedAnnualReportState | null;
  readonly evaluation: ManagedFinancialScreenRow | null;
  readonly failure: string | null;
}
export interface ManagedFinancialScreenRun {
  readonly handle: symbol;
  readonly criteria: ManagedFinancialScreenCriteria;
  readonly criteriaRevision: symbol;
  readonly selectionRevision: symbol;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly status: "running" | "completed" | "cancelled" | "stopped";
  readonly rows: readonly ManagedFinancialScreenResultRow[];
}
export interface ManagedFinancialScreenReportCapture {
  readonly run: ManagedFinancialScreenRun;
  readonly row: ManagedFinancialScreenResultRow;
  readonly response: PersonalSecAnnualCanonicalResponseDto;
}
export interface ManagedFinancialScreenReportHandoff {
  readonly selection: ManagedResearchSelection;
  readonly seed: ManagedAnnualReportSeed & {
    readonly provenance: "financial-screen";
  };
}
interface Pending {
  readonly kind: "universe" | "waiting" | "reading";
  readonly member: ManagedFinancialScreenMember | null;
  readonly cancel: () => void;
}
export interface ManagedFinancialScreenState {
  readonly active: boolean;
  readonly canRead: boolean;
  readonly catalogSnapshotSha256: `sha256:${string}` | null;
  readonly memberships: readonly ManagedFinancialScreenMember[];
  readonly selected: readonly ManagedFinancialScreenMember[];
  readonly criteria: ManagedFinancialScreenCriteria;
  readonly criteriaRevision: symbol;
  readonly selectionRevision: symbol;
  readonly criteriaStaged: boolean;
  readonly pending: Pending | null;
  readonly run: ManagedFinancialScreenRun | null;
  readonly shortlist: readonly ManagedFinancialScreenResultRow[];
  readonly catalogChanged: boolean;
  readonly message: string;
  readonly error: boolean;
}
interface Operation {
  readonly controller: AbortController;
}
const empty = (): ManagedFinancialScreenState =>
  Object.freeze({
    active: false,
    canRead: false,
    catalogSnapshotSha256: null,
    memberships: Object.freeze([]),
    selected: Object.freeze([]),
    criteria: DEFAULT_MANAGED_FINANCIAL_SCREEN_CRITERIA,
    criteriaRevision: Symbol(),
    selectionRevision: Symbol(),
    criteriaStaged: false,
    pending: null,
    run: null,
    shortlist: Object.freeze([]),
    catalogChanged: false,
    message: "",
    error: false,
  });

/** Abort a wait without waiting for an adapter that ignores its signal. */
function cancellable<T>(task: Promise<T>, signal: AbortSignal) {
  return new Promise<T | undefined>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      resolve(undefined);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    task.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(
          error instanceof Error ? error : new TrialApiError("unavailable"),
        );
      },
    );
  });
}
function pause(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}
function validListingIds(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 18 &&
    new Set<unknown>(value).size === value.length &&
    Array.from<unknown>(value).every(
      (id) =>
        typeof id === "string" && /^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(id),
    )
  );
}

/** One explicit, finite annual cohort run. No saved draft or source cache is owned here. */
export class ManagedFinancialScreen {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private operation: Operation | null = null;
  private reader: ManagedAnnualReport | null = null;
  private lastDispatch: number | null = null;
  private retired = false;
  private blocked = false;
  private readonly listingIds: readonly string[];

  constructor(
    private readonly api: Pick<ManagedApi, "resolve" | "annualReport">,
    private readonly readError: (error: TrialApiError) => void,
    private readonly access = new ManagedSecAccess(),
    listingIds: readonly string[] = MANAGED_FINANCIAL_SCREEN_LISTING_IDS,
  ) {
    if (!validListingIds(listingIds))
      throw new TypeError(
        "A financial screen requires at most 18 exact listings.",
      );
    this.listingIds = Object.freeze([...listingIds]);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(next: Partial<ManagedFinancialScreenState>) {
    this.state = Object.freeze({ ...this.state, ...next });
    for (const listener of this.listeners) listener();
  }
  private accepts(captured: ManagedFinancialScreenState) {
    return (
      !this.retired &&
      this.state === captured &&
      captured.active &&
      captured.canRead &&
      !captured.catalogChanged
    );
  }
  private current(operation: Operation) {
    return (
      !this.retired &&
      this.state.active &&
      this.state.canRead &&
      this.operation === operation &&
      !operation.controller.signal.aborted
    );
  }
  private pending(
    operation: Operation,
    kind: Pending["kind"],
    member: ManagedFinancialScreenMember | null,
  ) {
    return Object.freeze({
      kind,
      member,
      cancel: () => {
        if (this.operation === operation) this.cancel();
      },
    });
  }
  reconcile(
    digest: `sha256:${string}` | null,
    active: boolean,
    canRead: boolean,
  ) {
    if (this.retired) return;
    if (digest !== this.state.catalogSnapshotSha256) {
      this.cancel();
      if (this.retired) return;
      this.blocked = false;
      this.state = empty();
    }
    if ((!active || !canRead) && this.operation) this.cancel();
    if (this.retired) return;
    if (
      this.state.active !== active ||
      this.state.canRead !== (canRead && active && !!digest && !this.blocked) ||
      this.state.catalogSnapshotSha256 !== digest
    )
      this.update({
        active,
        canRead: canRead && active && !!digest && !this.blocked,
        catalogSnapshotSha256: digest,
      });
  }
  async loadUniverse(captured: ManagedFinancialScreenState) {
    const digest = captured.catalogSnapshotSha256;
    if (
      !this.accepts(captured) ||
      !digest ||
      this.operation ||
      captured.memberships.length
    )
      return;
    const operation = { controller: new AbortController() };
    this.operation = operation;
    this.update({
      pending: this.pending(operation, "universe", null),
      error: false,
      message: "Resolving the financial screen listings…",
    });
    const request = {
      snapshotSha256: digest,
      listingIds: [...this.listingIds],
    };
    try {
      if (!this.current(operation)) return;
      const value = await cancellable(
        this.api.resolve(request, operation.controller.signal),
        operation.controller.signal,
      );
      if (!this.current(operation)) return;
      const checked = parseManagedCatalogResolveResponse(value, request);
      if (!checked || checked.results.some((row) => !row.listing))
        throw new TrialApiError("invalid_response");
      const memberships = Object.freeze(
        checked.results.map((row) =>
          Object.freeze({
            handle: Symbol(),
            listing: Object.freeze({ ...row.listing! }),
          }),
        ),
      );
      const issuers = new Set<string>();
      const selected = memberships.filter((member) => {
        if (issuers.has(member.listing.issuerId)) return false;
        issuers.add(member.listing.issuerId);
        return true;
      });
      if (selected.length > 17) throw new TrialApiError("invalid_response");
      this.update({
        memberships,
        selected: Object.freeze(selected),
        selectionRevision: Symbol(),
        message: "Choose criteria and exact listings, then Run the screen.",
      });
    } catch (error) {
      if (!this.current(operation)) return;
      if (!this.failBoundary(error))
        this.update({
          error: true,
          message: "The screen listings could not be validated.",
        });
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.update({ pending: null });
      }
    }
  }
  setCriteria(captured: ManagedFinancialScreenState, value: unknown) {
    if (!this.accepts(captured)) return;
    const criteria = validateManagedFinancialScreenCriteria(value);
    if (!criteria) return;
    this.cancel();
    if (
      this.retired ||
      this.operation ||
      this.state.criteriaRevision !== captured.criteriaRevision ||
      this.state.selectionRevision !== captured.selectionRevision
    )
      return;
    this.update({
      criteria,
      criteriaRevision: Symbol(),
      criteriaStaged: false,
    });
  }
  stageCriteria(captured: ManagedFinancialScreenState) {
    if (!this.accepts(captured)) return;
    this.cancel();
    if (
      this.retired ||
      this.operation ||
      this.state.criteriaRevision !== captured.criteriaRevision ||
      this.state.selectionRevision !== captured.selectionRevision
    )
      return;
    this.update({ criteriaRevision: Symbol(), criteriaStaged: true });
  }
  select(
    captured: ManagedFinancialScreenState,
    member: ManagedFinancialScreenMember,
    selected: boolean,
  ) {
    if (
      !this.accepts(captured) ||
      !captured.memberships.includes(member) ||
      typeof selected !== "boolean" ||
      captured.selected.includes(member) === selected
    )
      return;
    if (
      selected &&
      (captured.selected.length >= 17 ||
        captured.selected.some(
          (row) => row.listing.issuerId === member.listing.issuerId,
        ))
    ) {
      this.update({
        message: "Choose only one exact listing for each issuer.",
      });
      return;
    }
    this.cancel();
    if (
      this.retired ||
      this.operation ||
      this.state.criteriaRevision !== captured.criteriaRevision ||
      this.state.selectionRevision !== captured.selectionRevision
    )
      return;
    this.update({
      selected: Object.freeze(
        selected
          ? [...captured.selected, member]
          : captured.selected.filter((row) => row !== member),
      ),
      selectionRevision: Symbol(),
    });
  }
  private failBoundary(error: unknown) {
    if (
      error instanceof TrialApiError &&
      ["unauthenticated", "access_denied", "origin_denied"].includes(error.code)
    ) {
      this.retire();
      this.readError(error);
      return true;
    }
    if (error instanceof ManagedCatalogChangedError) {
      const digest = this.state.catalogSnapshotSha256;
      const active = this.state.active;
      this.cancel();
      this.blocked = true;
      this.state = empty();
      this.update({
        catalogSnapshotSha256: digest,
        active,
        catalogChanged: true,
        message: "The catalog changed. Refresh it before screening again.",
        error: true,
      });
      return true;
    }
    return false;
  }
  private async waitForDispatch(
    operation: Operation,
    member: ManagedFinancialScreenMember,
  ) {
    while (this.current(operation)) {
      const cooldown = this.access.getNextAllowedAt();
      const delay = Math.max(
        this.lastDispatch === null
          ? 0
          : this.lastDispatch + 20_000 - performance.now(),
        cooldown ? Date.parse(cooldown) - Date.now() : 0,
      );
      if (delay <= 0) return;
      this.update({ pending: this.pending(operation, "waiting", member) });
      if (this.current(operation))
        await pause(delay, operation.controller.signal);
    }
  }
  private finish(status: ManagedFinancialScreenRun["status"]) {
    if (this.state.run?.status === "running")
      this.update({
        run: Object.freeze({
          ...this.state.run,
          status,
          completedAt: new Date().toISOString(),
        }),
      });
  }
  cancel() {
    const operation = this.operation;
    if (!operation) return;
    this.operation = null;
    const reader = this.reader;
    this.reader = null;
    const run =
      this.state.run?.status === "running"
        ? Object.freeze({
            ...this.state.run,
            status: "cancelled" as const,
            completedAt: new Date().toISOString(),
          })
        : this.state.run;
    const cancelled = Object.freeze({
      ...this.state,
      run,
      pending: null,
      message:
        "Screening cancelled. Captured results and staged choices are retained.",
    });
    this.state = cancelled;
    operation.controller.abort();
    reader?.cancel();
    if (!this.retired && this.state === cancelled)
      for (const listener of this.listeners) listener();
  }
  async run(captured: ManagedFinancialScreenState) {
    if (
      !this.accepts(captured) ||
      captured.criteriaStaged ||
      this.operation ||
      !captured.selected.length
    )
      return;
    const operation = { controller: new AbortController() };
    this.operation = operation;
    const run: ManagedFinancialScreenRun = Object.freeze({
      handle: Symbol(),
      criteria: captured.criteria,
      criteriaRevision: captured.criteriaRevision,
      selectionRevision: captured.selectionRevision,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "running",
      rows: Object.freeze(
        captured.selected.map((member) =>
          Object.freeze({
            handle: Symbol(),
            member,
            report: null,
            evaluation: null,
            failure: null,
          }),
        ),
      ),
    });
    this.update({
      run,
      shortlist: Object.freeze([]),
      error: false,
      message: "Running the selected annual financial screen…",
    });
    try {
      for (const row of run.rows) {
        await this.waitForDispatch(operation, row.member);
        if (!this.current(operation)) return;
        let failure: unknown = null;
        const reader = new ManagedAnnualReport(
          async (request, signal) => {
            if (!this.current(operation)) throw new TrialApiError("aborted");
            this.lastDispatch = performance.now();
            try {
              return await this.api.annualReport(request, signal);
            } catch (error) {
              failure = error;
              throw error;
            }
          },
          (error) => {
            this.retire();
            this.readError(error);
          },
          this.access,
        );
        this.reader = reader;
        reader.open({
          listing: row.member.listing,
          catalogSnapshotSha256: captured.catalogSnapshotSha256!,
          cik: null,
          origin: "screening",
        });
        this.update({
          pending: this.pending(operation, "reading", row.member),
        });
        if (!this.current(operation)) {
          reader.retire();
          return;
        }
        await cancellable(reader.load(), operation.controller.signal);
        if (!this.current(operation)) {
          reader.retire();
          return;
        }
        const report = Object.freeze({ ...reader.getSnapshot() });
        const evaluation = report.response
          ? evaluateManagedFinancialScreenRow(report.response, run.criteria)
          : null;
        const sourceFailure = report.response
          ? Object.entries(report.response.evidence.generation.sources)
              .filter(([, source]) => source.status !== "available")
              .map(([kind, source]) => `${kind}:${source.status}`)
              .join(", ")
          : "";
        const result = Object.freeze({
          ...row,
          report,
          evaluation,
          failure:
            failure instanceof TrialApiError
              ? failure.code
              : failure instanceof ManagedAnnualReportError
                ? failure.code
                : failure instanceof ManagedCatalogChangedError
                  ? "catalog_changed"
                  : failure instanceof ManagedSecCooldownError
                    ? "rate_limited"
                    : report.response === null
                      ? "report_unavailable"
                      : sourceFailure || null,
        });
        this.reader = null;
        reader.retire();
        this.update({
          run: Object.freeze({
            ...this.state.run!,
            rows: Object.freeze(
              this.state.run!.rows.map((item) =>
                item === row ? result : item,
              ),
            ),
          }),
        });
        if (!this.current(operation)) return;
        if (this.failBoundary(failure)) return;
        if (
          failure instanceof ManagedAnnualReportError &&
          failure.code === "not_configured"
        ) {
          this.finish("stopped");
          this.blocked = true;
          this.update({ canRead: false, error: true, message: report.message });
          return;
        }
      }
      if (this.current(operation)) {
        this.finish("completed");
        this.update({
          message:
            "Screening complete. Inspect the original dates, values and source context before shortlisting.",
        });
      }
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.reader = null;
        this.update({ pending: null });
      }
    }
  }
  toggleShortlist(
    captured: ManagedFinancialScreenState,
    row: ManagedFinancialScreenResultRow,
  ) {
    if (
      !this.accepts(captured) ||
      captured.criteriaStaged ||
      captured.pending !== null ||
      captured.run?.criteriaRevision !== captured.criteriaRevision ||
      captured.run?.selectionRevision !== captured.selectionRevision ||
      !captured.run?.rows.includes(row) ||
      !row.report?.response
    )
      return;
    this.update({
      shortlist: Object.freeze(
        captured.shortlist.includes(row)
          ? captured.shortlist.filter((item) => item !== row)
          : [...captured.shortlist, row],
      ),
    });
  }
  canAdmitReport(capture: ManagedFinancialScreenReportCapture) {
    return (
      !this.retired &&
      this.state.active &&
      this.state.canRead &&
      !this.state.pending &&
      !this.state.catalogChanged &&
      !this.state.criteriaStaged &&
      capture?.run?.criteriaRevision === this.state.criteriaRevision &&
      capture?.run?.selectionRevision === this.state.selectionRevision &&
      capture?.run === this.state.run &&
      !!capture.run &&
      capture.run.rows.includes(capture.row) &&
      this.state.memberships.includes(capture.row.member) &&
      !!capture.row.report?.response &&
      capture.row.report.response === capture.response
    );
  }
  admitReport(
    capture: ManagedFinancialScreenReportCapture,
  ): ManagedFinancialScreenReportHandoff | null {
    if (!this.canAdmitReport(capture)) return null;
    const handle = capture.run.handle;
    this.cancel();
    if (
      this.retired ||
      !this.state.active ||
      this.state.run?.handle !== handle ||
      !this.state.run.rows.includes(capture.row)
    )
      return null;
    return Object.freeze({
      selection: Object.freeze({
        listing: Object.freeze({ ...capture.row.member.listing }),
        catalogSnapshotSha256: this.state.catalogSnapshotSha256!,
        cik: capture.response.security.cik,
        origin: "screening",
      }),
      seed: Object.freeze({
        response: capture.response,
        showingPrevious: false,
        provenance: "financial-screen",
      }),
    });
  }
  retire() {
    if (this.retired) return;
    this.retired = true;
    const reader = this.reader;
    this.cancel();
    reader?.retire();
    this.reader = null;
    this.update(empty());
  }
}
