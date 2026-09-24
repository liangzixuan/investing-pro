import type {
  AssessmentReason,
  PersonalSecQuarterAssessmentInputDto,
  PersonalSecQuarterPredicateDto,
  PersonalSecQuarterWitnessDto,
  PredicateObserved,
  ProfileId,
  QuarterContextRecord,
  QuarterPrimaryOccurrence,
  QuarterRawAttribute,
  QuarterSourceRecord,
  QuarterTableObservation,
  QuarterUnitRecord,
  QuarterXmlObservation,
} from "@research-cockpit/contracts";

const XBRLI = "http://www.xbrl.org/2003/instance";
const XBRLDI = "http://xbrl.org/2006/xbrldi";
const ISO4217 = "http://www.xbrl.org/2003/iso4217";
const XMLNS = "http://www.w3.org/2000/xmlns/";
const HTML = "http://www.w3.org/1999/xhtml";
const IX = "http://www.xbrl.org/2013/inlineXBRL";
const DAY = 86_400_000;
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const DATE_TEXT = `(${MONTHS.join("|")}) ([0-9]{1,2}), ([0-9]{4})`;
const INCOME_HEADING =
  /^(?:condensed )?(?:consolidated )?(?:statements of (?:income|operations|earnings)|income statements)(?: \(unaudited\))?$/u;
const CASH_HEADING =
  /^(?:condensed )?(?:consolidated )?statements of cash flows(?: \(unaudited\))?$/u;
const BALANCE_HEADING =
  /^(?:condensed )?(?:consolidated )?balance sheets(?: \(unaudited\))?$/u;
const SECTION = /^(?:item 1[.:]? )?financial statements(?: \(unaudited\))?$/u;
const NOTES =
  /^notes to (?:the )?(?:condensed )?(?:consolidated )?financial statements/u;
const REVENUE = /^(?:total )?(?:revenue|revenues|net sales)$/u;
const NET = "net (?:income|loss|income \\(loss\\)|\\(loss\\) income)";
const FOREIGN =
  /\b(?:cad|eur|gbp|jpy|cny|rmb|aud|nzd|hkd|chf|euros?|yen|yuan|renminbi|rupees?|pounds?|percent|percentages?|billions?|trillions?)\b|[%\u20ac\u00a3\u00a5\u20b9]/u;

export function normalizeQuarterText(text: string): string {
  return text
    .replace(/[\t\n\r \u00a0]+/gu, " ")
    .trim()
    .replace(/[A-Z]/gu, (c) => c.toLowerCase());
}
function originalText(node: QuarterXmlObservation): string {
  let text = "";
  for (let i = 0; i <= node.children.length; i++) {
    text += node.textRuns
      .filter((r) => r.beforeChildIndex === i)
      .map((r) => r.text)
      .join("");
    const child = node.children[i];
    if (child) text += originalText(child);
  }
  return text;
}
function blankDirect(node: QuarterXmlObservation): boolean {
  return node.textRuns.every((r) => normalizeQuarterText(r.text) === "");
}
function attributesOnly(
  node: QuarterXmlObservation,
  names: readonly string[],
): boolean {
  return node.attributes.every(
    (a) =>
      a.namespace === XMLNS || (a.namespace === null && names.includes(a.name)),
  );
}
function named(
  node: QuarterXmlObservation,
  name: string,
  namespace = XBRLI,
): boolean {
  return node.name.namespace === namespace && node.name.localName === name;
}
function attr(
  attributes: readonly QuarterRawAttribute[],
  name: string,
): string | null {
  return (
    attributes.find((a) => a.namespace === null && a.name === name)?.value ??
    null
  );
}
export function quarterDate(value: string): boolean {
  if (!/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u.test(value)) return false;
  const n = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
}
function shiftDay(value: string, days: number): string {
  return new Date(Date.parse(`${value}T00:00:00.000Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
}
function shiftMonth(value: string, months: number): string {
  const d = new Date(`${value}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function dateMatch(match: RegExpMatchArray): string | null {
  const month = MONTHS.indexOf(match[1] ?? "") + 1;
  const value = `${match[3]}-${String(month).padStart(2, "0")}-${(match[2] ?? "").padStart(2, "0")}`;
  return quarterDate(value) ? value : null;
}
export interface QuarterContext {
  readonly cik: string;
  readonly kind: "duration" | "instant";
  readonly startDate: string | null;
  readonly endDate: string;
  readonly dimensioned: boolean;
}
/** Positive structural exclusions require the entire context grammar to pass. */
export function readQuarterContext(
  record: QuarterContextRecord | undefined,
): QuarterContext | null {
  if (!record) return null;
  const root = record.root;
  if (
    !named(root, "context") ||
    !attributesOnly(root, ["id"]) ||
    attr(root.attributes, "id") !== record.xmlId ||
    !blankDirect(root)
  )
    return null;
  const entity = root.children.filter((n) => named(n, "entity"));
  const periods = root.children.filter((n) => named(n, "period"));
  const scenarios = root.children.filter((n) => named(n, "scenario"));
  if (
    entity.length !== 1 ||
    periods.length !== 1 ||
    scenarios.length > 1 ||
    root.children.length !== 2 + scenarios.length
  )
    return null;
  const e = entity[0]!,
    p = periods[0]!;
  if (
    !attributesOnly(e, []) ||
    !blankDirect(e) ||
    !attributesOnly(p, []) ||
    !blankDirect(p)
  )
    return null;
  const identifiers = e.children.filter((n) => named(n, "identifier"));
  const segments = e.children.filter((n) => named(n, "segment"));
  if (
    identifiers.length !== 1 ||
    segments.length > 1 ||
    e.children.length !== 1 + segments.length
  )
    return null;
  const identifier = identifiers[0]!;
  const rawCik = originalText(identifier).trim();
  if (
    identifier.children.length ||
    !attributesOnly(identifier, ["scheme"]) ||
    attr(identifier.attributes, "scheme") !== "http://www.sec.gov/CIK" ||
    !/^[0-9]{1,10}$/u.test(rawCik) ||
    /^0+$/u.test(rawCik)
  )
    return null;
  let dimensioned = false;
  const dimensions = new Set<string>();
  for (const container of [...segments, ...scenarios]) {
    if (
      !attributesOnly(container, []) ||
      !blankDirect(container) ||
      container.children.length === 0
    )
      return null;
    for (const member of container.children) {
      const dimension = member.qnameAttributes.find(
        (a) => a.name === "dimension",
      )?.value;
      if (
        !attributesOnly(member, ["dimension"]) ||
        !dimension?.namespace ||
        !dimension.localName ||
        dimension.raw !== attr(member.attributes, "dimension")
      )
        return null;
      const dimensionKey = `${dimension.namespace}#${dimension.localName}`;
      if (dimensions.has(dimensionKey)) return null;
      dimensions.add(dimensionKey);
      if (named(member, "explicitMember", XBRLDI)) {
        if (
          member.children.length ||
          !member.textQName?.namespace ||
          !member.textQName.localName ||
          member.textQName.raw !== originalText(member).trim()
        )
          return null;
      } else if (named(member, "typedMember", XBRLDI)) {
        if (
          !blankDirect(member) ||
          member.children.length !== 1 ||
          !member.children[0]!.name.namespace ||
          !member.children[0]!.name.localName ||
          !originalText(member.children[0]!).trim() ||
          member.children[0]!.children.length ||
          !attributesOnly(member.children[0]!, [])
        )
          return null;
      } else return null;
      dimensioned = true;
    }
  }
  const dateNodes = p.children;
  if (
    dateNodes.some(
      (n) =>
        !attributesOnly(n, []) ||
        n.children.length ||
        !quarterDate(originalText(n).trim()),
    )
  )
    return null;
  if (dateNodes.length === 1 && named(dateNodes[0]!, "instant"))
    return {
      cik: rawCik.padStart(10, "0"),
      kind: "instant",
      startDate: null,
      endDate: originalText(dateNodes[0]!).trim(),
      dimensioned,
    };
  if (
    dateNodes.length !== 2 ||
    !named(dateNodes[0]!, "startDate") ||
    !named(dateNodes[1]!, "endDate")
  )
    return null;
  const startDate = originalText(dateNodes[0]!).trim(),
    endDate = originalText(dateNodes[1]!).trim();
  return startDate <= endDate
    ? {
        cik: rawCik.padStart(10, "0"),
        kind: "duration",
        startDate,
        endDate,
        dimensioned,
      }
    : null;
}
export function readQuarterUnit(
  record: QuarterUnitRecord | undefined,
): "USD" | "other" | null {
  if (
    !record ||
    !named(record.root, "unit") ||
    !attributesOnly(record.root, ["id"]) ||
    attr(record.root.attributes, "id") !== record.xmlId ||
    !blankDirect(record.root) ||
    record.root.children.length !== 1
  )
    return null;
  const measure = record.root.children[0]!;
  if (
    !named(measure, "measure") ||
    !attributesOnly(measure, []) ||
    measure.children.length ||
    !measure.textQName?.namespace ||
    !measure.textQName.localName ||
    measure.textQName.raw !== originalText(measure).trim()
  )
    return null;
  return measure.textQName.namespace === ISO4217 &&
    measure.textQName.localName === "USD"
    ? "USD"
    : "other";
}
export function canonicalQuarterDecimal(raw: string): string | null {
  if (raw.length > 256 || !/^-?[0-9]+(?:\.[0-9]+)?$/u.test(raw)) return null;
  const negative = raw.startsWith("-");
  const [integer = "", fraction = ""] = (negative ? raw.slice(1) : raw).split(
    ".",
  );
  const whole = integer.replace(/^0+(?=[0-9])/u, "");
  const tail = fraction.replace(/0+$/u, "");
  const number = whole + (tail ? `.${tail}` : "");
  const result = (negative && number !== "0" ? "-" : "") + number;
  return result.length <= 64 ? result : null;
}
function scaleDecimal(value: string, scale: number): string | null {
  const negative = value.startsWith("-");
  const [whole = "", fraction = ""] = (negative ? value.slice(1) : value).split(
    ".",
  );
  const digits =
    whole + fraction + "0".repeat(Math.max(0, scale - fraction.length));
  const point = whole.length + scale;
  return canonicalQuarterDecimal(
    (negative ? "-" : "") +
      digits.slice(0, point) +
      (point < digits.length ? `.${digits.slice(point)}` : ""),
  );
}
export interface QuarterCalendar {
  readonly start: string;
  readonly end: string;
  readonly fiscalStart: string;
  readonly fiscalEnd: string;
  readonly year: number;
  readonly slot: 1 | 2 | 3;
  readonly predicateIds: readonly string[];
}
type Cell = QuarterTableObservation["rows"][number]["cells"][number];
export class QuarterProfiles {
  readonly predicates: PersonalSecQuarterPredicateDto[] = [];
  readonly records: Map<string, QuarterSourceRecord>;
  readonly contexts: Map<string, QuarterContextRecord>;
  readonly units: Map<string, QuarterUnitRecord>;
  readonly anchors: readonly QuarterSourceRecord[];
  private readonly textCache = new Map<string, string | null>();
  readonly calendar: QuarterCalendar | null;
  readonly globalReasons: AssessmentReason[] = [];
  private identity: Extract<PredicateObserved, { kind: "identity" }> | null =
    null;
  constructor(readonly input: PersonalSecQuarterAssessmentInputDto) {
    const primary = input.evidence.primary;
    this.records = new Map(
      primary.structure?.records.map((r) => [r.id, r]) ?? [],
    );
    this.contexts = new Map(primary.contexts.map((r) => [r.id, r]));
    this.units = new Map(primary.units.map((r) => [r.id, r]));
    this.anchors = (primary.structure?.anchorRecordIds ?? []).flatMap(
      (id) => this.records.get(id) ?? [],
    );
    this.readIdentity();
    this.calendar = this.readCalendar();
  }
  text(id: string, active = new Set<string>()): string | null {
    if (this.textCache.has(id)) return this.textCache.get(id)!;
    const record = this.records.get(id);
    if (!record?.childrenComplete || record.textRuns === null || active.has(id))
      return null;
    active.add(id);
    let result = "";
    for (let i = 0; i <= record.elementChildCount; i++) {
      result += record.textRuns
        .filter((r) => r.beforeChildIndex === i)
        .map((r) => r.text)
        .join("");
      if (i < record.elementChildCount) {
        const child = record.childRecordIds[i];
        const text = child ? this.text(child, active) : null;
        if (text === null) {
          active.delete(id);
          return null;
        }
        result += text;
      }
      if (result.length > 4096) {
        active.delete(id);
        return null;
      }
    }
    active.delete(id);
    this.textCache.set(id, result);
    return result;
  }
  norm(id: string): string | null {
    const text = this.text(id);
    return text === null ? null : normalizeQuarterText(text);
  }
  private predicate(
    profile: ProfileId,
    refs: readonly string[],
    reason: AssessmentReason | null,
    observed: PredicateObserved | null,
    contradicted = false,
  ): string {
    const id = `p:${this.predicates.length}`;
    this.predicates.push({
      id,
      profile,
      version: "1.0.0",
      state: reason
        ? contradicted
          ? "contradicted"
          : "unresolved"
        : "supported",
      evidenceIds: [...new Set(refs)],
      reasons: reason ? [reason] : [],
      observed: reason ? null : observed,
    });
    return id;
  }
  private readIdentity(): void {
    const metadata = this.input.evidence.primary.reportingMetadata;
    const required = [
      "DocumentType",
      "DocumentPeriodEndDate",
      "DocumentFiscalYearFocus",
      "DocumentFiscalPeriodFocus",
    ];
    const refs: string[] = [],
      values: string[] = [];
    let reason: AssessmentReason | null = null;
    if (this.input.selection.form !== "10-Q") reason = "unsupported_amendment";
    for (const concept of required) {
      const observations =
        metadata?.observations.filter((o) => o.concept.localName === concept) ??
        [];
      const current = observations.filter((o) => {
        const context = readQuarterContext(
          this.contexts.get(o.contextRecordId ?? ""),
        );
        return (
          !context ||
          (context.cik === this.input.cik &&
            !context.dimensioned &&
            context.endDate === this.input.selection.reportDate)
        );
      });
      refs.push(...current.map((o) => o.id));
      if (
        !current.length ||
        current.some(
          (o) =>
            o.issues.length ||
            o.value === null ||
            !/^http:\/\/xbrl\.sec\.gov\/dei\/(2024|2025|2026)$/u.test(
              o.concept.namespace ?? "",
            ) ||
            !readQuarterContext(this.contexts.get(o.contextRecordId ?? "")),
        )
      )
        reason ??= "report_identity_unresolved";
      const unique = [...new Set(current.map((o) => o.value))];
      if (unique.length > 1) reason ??= "report_metadata_conflict";
      values.push(unique[0] ?? "");
    }
    const [form, end, year, quarter] = values;
    if (
      form !== "10-Q" ||
      end !== this.input.selection.reportDate ||
      !/^[1-9][0-9]{3}$/u.test(year ?? "") ||
      !/^Q[1-3]$/u.test(quarter ?? "")
    )
      reason ??=
        quarter === "Q4" ? "unsupported_q4" : "report_identity_unresolved";
    const periodCaptions = this.anchors.filter((r) =>
      /^for the quarterly period ended /u.test(this.norm(r.id) ?? ""),
    );
    const coverRecords = new Map(this.anchors.map((r) => [r.id, r]));
    for (const period of periodCaptions) {
      const container = this.records.get(period.parentRecordId ?? "");
      if (container?.childrenComplete)
        for (const id of container.childRecordIds) {
          const record = this.records.get(id);
          if (record) coverRecords.set(id, record);
        }
    }
    const cover = [...coverRecords.values()].filter((r) =>
      /(?:quarterly|transition) report/u.test(this.norm(r.id) ?? ""),
    );
    const quarterly = cover.filter((r) =>
      /^(?:\u2611|\u2612|\[x\]) quarterly report\b/u.test(
        this.norm(r.id) ?? "",
      ),
    );
    const transition = cover.filter((r) =>
      /^(?:\u2610|\[ \]) transition report\b/u.test(this.norm(r.id) ?? ""),
    );
    if (
      quarterly.length !== 1 ||
      transition.length !== 1 ||
      cover.some((r) =>
        /^(?:\u2611|\u2612|\[x\]) transition report\b/u.test(
          this.norm(r.id) ?? "",
        ),
      )
    )
      reason ??= "report_identity_unresolved";
    const coverRefs = [...quarterly, ...transition].map((r) => r.id);
    if (
      !periodCaptions.length ||
      periodCaptions.some((r) => {
        const match = new RegExp(
          `^for the quarterly period ended ${DATE_TEXT}[.]?$`,
          "u",
        ).exec(this.norm(r.id) ?? "");
        return !match || dateMatch(match) !== end;
      })
    )
      reason ??= "report_identity_unresolved";
    coverRefs.push(...periodCaptions.map((r) => r.id));
    const coverParents = [
      ...new Set(coverRefs.map((id) => this.records.get(id)?.parentRecordId)),
    ];
    const coverParent =
      coverParents.length === 1 && coverParents[0]
        ? this.records.get(coverParents[0])
        : null;
    if (
      !coverParent?.childrenComplete ||
      coverParent.textRuns?.some((r) => normalizeQuarterText(r.text) !== "") ||
      coverParent.childRecordIds.some(
        (id) => !coverRefs.includes(id) && this.norm(id) !== "",
      )
    )
      reason ??= "report_identity_unresolved";
    if (coverParent) coverRefs.push(coverParent.id);
    refs.push(...coverRefs);
    reason ??= this.visible(coverRefs).reason;
    if (!reason)
      this.identity = {
        kind: "identity",
        form: "10-Q",
        reportDate: end!,
        fiscalYear: Number(year),
        fiscalQuarter: Number(quarter!.slice(1)) as 1 | 2 | 3,
      };
    this.predicate("report_identity_v1", refs, reason, this.identity);
    if (reason) this.globalReasons.push(reason);
  }
  private readCalendar(): QuarterCalendar | null {
    const anchors = this.anchors
      .map((r) => ({ r, text: this.norm(r.id) }))
      .filter(
        (x): x is { r: QuarterSourceRecord; text: string } => x.text !== null,
      );
    const exceptions = anchors.filter(({ text }) =>
      /(?:fiscal (?:year|calendar)|quarter)[^.]{0,100}(?:52|53|13)[ -]weeks?|(?:52|53)[ -]week fiscal/u.test(
        text,
      ),
    );
    const transition = anchors.filter(({ text }) =>
      /(?:fiscal year|reporting period)[^.]{0,100}(?:stub|transition|change in fiscal)|(?:\u2611|\u2612) transition report/u.test(
        text,
      ),
    );
    let reason: AssessmentReason | null = exceptions.length
      ? "unsupported_week_calendar"
      : transition.length
        ? "unsupported_transition_period"
        : null;
    const refs = [...exceptions, ...transition].map(({ r }) => r.id);
    const identity = this.identity;
    if (!identity) reason ??= "fiscal_slot_unresolved";
    const boundaries: { date: string; ref: string }[] = [];
    for (const { r, text } of anchors) {
      for (const match of text.matchAll(
        new RegExp(
          `^our fiscal year ending ${DATE_TEXT} consists of (?:12|twelve) calendar months\\.$`,
          "gu",
        ),
      )) {
        const date = dateMatch(match);
        if (date && date >= (this.input.selection.reportDate ?? ""))
          boundaries.push({ date, ref: r.id });
      }
      const scoped = new RegExp(
        `^these (?:unaudited )?(?:condensed )?(?:consolidated )?financial statements are for the current fiscal year ending ${DATE_TEXT}\\.$`,
        "u",
      ).exec(text);
      const date = scoped ? dateMatch(scoped) : null;
      if (date && date >= (this.input.selection.reportDate ?? ""))
        boundaries.push({ date, ref: r.id });
    }
    const ends = [...new Set(boundaries.map((b) => b.date))];
    refs.push(...boundaries.map((b) => b.ref));
    if (ends.length === 0) reason ??= "fiscal_boundary_unresolved";
    if (ends.length > 1) reason ??= "fiscal_boundary_conflict";
    const fiscalEnd = ends[0];
    const fiscalStart = fiscalEnd
      ? shiftMonth(shiftDay(fiscalEnd, 1), -12)
      : null;
    const start =
      identity && fiscalStart
        ? shiftMonth(fiscalStart, (identity.fiscalQuarter - 1) * 3)
        : null;
    const end =
      identity && fiscalStart
        ? shiftDay(shiftMonth(fiscalStart, identity.fiscalQuarter * 3), -1)
        : null;
    if (
      !fiscalStart?.endsWith("-01") ||
      end !== identity?.reportDate ||
      ![
        Number(fiscalStart?.slice(0, 4)),
        Number(fiscalEnd?.slice(0, 4)),
      ].includes(identity?.fiscalYear ?? 0)
    )
      reason ??= "fiscal_calendar_unresolved";
    const slotWord = identity
      ? ["", "first", "second", "third"][identity.fiscalQuarter]
      : "missing";
    const slot = anchors.filter(({ text }) =>
      new RegExp(
        `^(?:these (?:unaudited )?(?:condensed )?(?:consolidated )?financial statements cover|we report) the ${slotWord} quarter of fiscal year ${identity?.fiscalYear}\\.$`,
        "u",
      ).test(text),
    );
    if (!slot.length) reason ??= "fiscal_slot_unresolved";
    refs.push(...slot.map(({ r }) => r.id));
    const direct = anchors.filter(({ text }) => {
      const match = new RegExp(
        `^our fiscal year ending ${DATE_TEXT} consists of (?:12|twelve) calendar months\\.$`,
        "u",
      ).exec(text);
      return match !== null && dateMatch(match) === fiscalEnd;
    });
    let method: ProfileId = "calendar_direct_boundary_v1";
    let opening: string | null = null,
      closing: string | null = null;
    if (direct.length) refs.push(...direct.map(({ r }) => r.id));
    else {
      method = "calendar_fiscal_ytd_roles_v1";
      const basis = anchors.filter(({ text }) =>
        /^these (?:unaudited )?(?:condensed )?(?:consolidated )?financial statements have been prepared for interim financial reporting in accordance with generally accepted accounting principles and the rules and regulations of the securities and exchange commission\.$/u.test(
          text,
        ),
      );
      refs.push(...basis.map(({ r }) => r.id));
      const roles = this.cashRoles(
        identity?.fiscalQuarter ?? 0,
        fiscalStart,
        identity?.reportDate ?? null,
      );
      refs.push(...roles.refs);
      opening = roles.opening;
      closing = roles.closing;
      if (!basis.length || !opening || !closing)
        reason ??= "fiscal_ytd_role_unresolved";
    }
    const visibility = this.visible(refs);
    if (visibility.reason) reason ??= visibility.reason;
    if (reason || !identity || !start || !end || !fiscalStart || !fiscalEnd) {
      const held = reason ?? "fiscal_calendar_unresolved";
      this.globalReasons.push(held);
      this.predicate(method, refs, held, null);
      return null;
    }
    const id = this.predicate(method, refs, null, {
      kind: "calendar",
      fiscalYearStart: fiscalStart,
      fiscalYearEnd: fiscalEnd,
      quarterStart: start,
      quarterEnd: end,
      slot: identity.fiscalQuarter,
      yearLabel: identity.fiscalYear,
      openingCashContextRef: opening,
      closingCashContextRef: closing,
    });
    return {
      start,
      end,
      fiscalStart,
      fiscalEnd,
      year: identity.fiscalYear,
      slot: identity.fiscalQuarter,
      predicateIds: [this.predicates[0]!.id, id],
    };
  }
  private cashRoles(
    slot: number,
    fiscalStart: string | null,
    reportEnd: string | null,
  ): { refs: string[]; opening: string | null; closing: string | null } {
    const refs: string[] = [];
    type Role = { contextRef: string; ownership: string; row: number };
    const openings: Role[] = [],
      closings: Role[] = [];
    const structure = this.input.evidence.primary.structure;
    for (const fact of structure?.supplementaryFacts ?? []) {
      if (
        !/^(?:CashAndCashEquivalentsAtCarryingValue|CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents|CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations)$/u.test(
          fact.concept.localName ?? "",
        ) ||
        !supportedGaap(fact.concept.namespace) ||
        fact.issues.length
      )
        continue;
      const cell = this.locateCell(fact.elementRecordId);
      const context = readQuarterContext(
        this.contexts.get(fact.contextRecordId ?? ""),
      );
      const caption = cell ? this.caption(cell.table, CASH_HEADING) : null;
      if (
        !cell ||
        !context ||
        context.kind !== "instant" ||
        context.dimensioned ||
        context.cik !== this.input.cik ||
        !caption
      )
        continue;
      const tableRecord = this.records.get(cell.table.tableRecordId)!;
      const section = this.anchors
        .filter(
          (r) =>
            r.elementOrdinal < tableRecord.elementOrdinal &&
            (SECTION.test(this.norm(r.id) ?? "") ||
              NOTES.test(this.norm(r.id) ?? "")),
        )
        .at(-1);
      const notes = this.anchors.find(
        (r) =>
          r.elementOrdinal > tableRecord.endElementOrdinal &&
          NOTES.test(this.norm(r.id) ?? ""),
      );
      if (!section || !SECTION.test(this.norm(section.id) ?? "") || !notes)
        continue;
      const group = this.principalGroup(
        section.elementOrdinal,
        notes.elementOrdinal,
      );
      if (!group?.includes(cell.table.tableRecordId)) continue;
      const labelRecord = this.label(cell.table, cell.row, cell.cell);
      const label = labelRecord.text;
      const isOpening =
        /^cash(?: and cash equivalents)?(?:,? restricted cash(?: and restricted cash equivalents)?)?,? (?:at )?beginning of (?:the )?(?:fiscal )?year$/u.test(
          label,
        );
      const isClosing =
        /^cash(?: and cash equivalents)?(?:,? restricted cash(?: and restricted cash equivalents)?)?,? (?:at )?end of (?:the )?(?:period|year)$/u.test(
          label,
        );
      if (!isOpening && !isClosing) continue;
      const headers = this.headers(
        cell.table,
        cell.row,
        cell.cell,
        slot * 3,
        reportEnd ?? "",
      );
      if (headers.reason) continue;
      refs.push(
        fact.id,
        cell.table.tableRecordId,
        cell.table.rows[cell.row]!.rowRecordId,
        cell.cell.cellRecordId,
        ...headers.year,
        ...headers.duration,
        ...caption.heading,
        ...caption.captions,
        ...labelRecord.refs,
        section.id,
        notes.id,
        ...group,
      );
      const role: Role = {
        contextRef: fact.contextRecordId!,
        ownership: JSON.stringify([
          cell.table.tableRecordId,
          cell.cell.columnStart,
          cell.cell.columnSpan,
          headers.year,
          headers.duration,
          section.id,
          notes.id,
          fact.concept.namespace,
          fact.concept.localName,
        ]),
        row: cell.row,
      };
      if (
        isOpening &&
        fiscalStart &&
        shiftDay(context.endDate, 1) === fiscalStart
      )
        openings.push(role);
      if (isClosing && context.endDate === reportEnd) closings.push(role);
    }
    const sameRollForward =
      openings.length === 1 &&
      closings.length === 1 &&
      openings[0]!.ownership === closings[0]!.ownership &&
      openings[0]!.row < closings[0]!.row;
    return {
      refs,
      opening: sameRollForward ? openings[0]!.contextRef : null,
      closing: sameRollForward ? closings[0]!.contextRef : null,
    };
  }
  private locateCell(
    elementId: string,
  ): { table: QuarterTableObservation; row: number; cell: Cell } | null {
    const element = this.records.get(elementId);
    if (
      !element ||
      element.actualCellOrdinal === null ||
      element.actualTableOrdinal === null
    )
      return null;
    for (const table of this.input.evidence.primary.structure?.tables ?? []) {
      if (
        table.status !== "complete" ||
        this.records.get(table.tableRecordId)?.actualTableOrdinal !==
          element.actualTableOrdinal
      )
        continue;
      for (let row = 0; row < table.rows.length; row++) {
        if (
          this.records.get(table.rows[row]!.rowRecordId)?.actualRowOrdinal !==
          element.actualRowOrdinal
        )
          continue;
        const cell = table.rows[row]!.cells.find(
          (c) =>
            this.records.get(c.cellRecordId)?.actualCellOrdinal ===
            element.actualCellOrdinal,
        );
        if (cell) return { table, row, cell };
      }
    }
    return null;
  }
  private label(
    table: QuarterTableObservation,
    row: number,
    amount: Cell,
  ): { text: string; refs: string[] } {
    const refs = table.rows[row]!.cells.filter(
      (c) => c.columnStart + c.columnSpan <= amount.columnStart,
    )
      .map((c) => c.cellRecordId)
      .filter((id) => {
        const text = this.norm(id);
        return text !== null && text !== "" && !/^[$()]$/u.test(text);
      });
    return { text: refs.map((id) => this.norm(id)).join(" "), refs };
  }
  private caption(
    table: QuarterTableObservation,
    pattern = INCOME_HEADING,
  ): { heading: string[]; captions: string[] } | null {
    const tableRecord = this.records.get(table.tableRecordId)!;
    const inTable = table.rows
      .slice(0, 3)
      .flatMap((r) => r.cells.map((c) => c.cellRecordId))
      .filter((id) => pattern.test(this.norm(id) ?? ""));
    if (inTable.length === 1) return { heading: inTable, captions: [] };
    let target = tableRecord;
    for (let depth = 0; depth < 4; depth++) {
      for (const window of this.input.evidence.primary.structure
        ?.siblingWindows ?? []) {
        const index = window.childRecordIds.indexOf(target.id);
        if (index <= 0) continue;
        const before = window.childRecordIds.slice(0, index);
        const head = before
          .map((id) => pattern.test(this.norm(id) ?? ""))
          .lastIndexOf(true);
        if (head < 0) continue;
        const following = before.slice(head + 1);
        if (
          following.some((id) => {
            const text = this.norm(id);
            return (
              text === null ||
              (text !== "" &&
                !unitScale(text).matched &&
                !/^(?:\(unaudited\)|(?:three|six|nine) months ended.*)$/u.test(
                  text,
                ))
            );
          })
        )
          continue;
        return {
          heading: [before[head]!],
          captions: following.filter((id) => this.norm(id) !== ""),
        };
      }
      const parent = target.parentRecordId
        ? this.records.get(target.parentRecordId)
        : null;
      if (
        !parent?.childrenComplete ||
        parent.descendantTableCount !== 1 ||
        parent.descendantTableOrdinals?.[0] !==
          tableRecord.actualTableOrdinal ||
        parent.childRecordIds.some(
          (id) => id !== target.id && this.norm(id) !== "",
        )
      )
        break;
      target = parent;
    }
    return null;
  }
  private headers(
    table: QuarterTableObservation,
    row: number,
    cell: Cell,
    months: number,
    end: string,
  ): { reason: AssessmentReason | null; year: string[]; duration: string[] } {
    const firstData = this.firstDataRow(table);
    const headerRows = table.rows.slice(
      0,
      Math.min(row, firstData < 0 ? row : firstData),
    );
    const overlapping = headerRows
      .flatMap((r) => r.cells)
      .filter((c) => overlaps(c, cell));
    const year: Cell[] = [],
      duration: Cell[] = [];
    let reason: AssessmentReason | null = null;
    for (const header of overlapping) {
      const text = this.norm(header.cellRecordId);
      if (text === null) {
        reason = "current_column_unresolved";
        continue;
      }
      const years = [...text.matchAll(/\b(20[0-9]{2}|19[0-9]{2})\b/gu)].map(
        (m) => m[1],
      );
      if (years.length) {
        if (years.length !== 1 || years[0] !== end.slice(0, 4))
          reason = "column_ownership_conflict";
        else year.push(header);
      }
      const words: Readonly<Record<string, number>> = {
        three: 3,
        six: 6,
        nine: 9,
        twelve: 12,
      };
      const durations = [
        ...text.matchAll(
          /\b(three|six|nine|twelve|[0-9]+)[ -]months? ended\b/gu,
        ),
      ].map((m) => words[m[1]!] ?? Number(m[1]));
      if (durations.length) {
        if (durations.length !== 1 || durations[0] !== months)
          reason = "column_ownership_conflict";
        else duration.push(header);
      }
      for (const match of text.matchAll(new RegExp(DATE_TEXT, "gu")))
        if (dateMatch(match) !== end) reason = "column_ownership_conflict";
      for (const match of text.matchAll(
        new RegExp(`(${MONTHS.join("|")}) ([0-9]{1,2})(?![0-9])`, "gu"),
      )) {
        if (
          MONTHS.indexOf(match[1]!) + 1 !== Number(end.slice(5, 7)) ||
          Number(match[2]) !== Number(end.slice(8, 10))
        )
          reason = "column_ownership_conflict";
      }
    }
    if (
      year.length !== 1 ||
      duration.length !== 1 ||
      !covers(year[0]!, cell) ||
      !covers(duration[0]!, cell)
    )
      reason ??= "current_column_unresolved";
    return {
      reason,
      year: year.map((c) => c.cellRecordId),
      duration: duration.map((c) => c.cellRecordId),
    };
  }
  private firstDataRow(table: QuarterTableObservation): number {
    const numericNodes = [...this.records.values()].filter(
      (r) => r.name.namespace === IX && r.name.localName === "nonFraction",
    );
    return table.rows.findIndex((row) =>
      numericNodes.some((element) => {
        const sourceRow = this.records.get(row.rowRecordId);
        return (
          element &&
          sourceRow &&
          element.actualTableOrdinal === sourceRow.actualTableOrdinal &&
          element.actualRowOrdinal === sourceRow.actualRowOrdinal
        );
      }),
    );
  }
  private visible(refs: readonly string[]): {
    reason: AssessmentReason | null;
    paths: string[];
  } {
    const structure = this.input.evidence.primary.structure;
    if (!structure || structure.status !== "complete")
      return { reason: "static_visibility_unresolved", paths: [] };
    const document = structure.document;
    if (document.scripts.length)
      return { reason: "static_script_unresolved", paths: [] };
    if (
      document.styleElements ||
      document.stylesheetLinks ||
      document.processingInstructions.length ||
      document.eventAttributeCount
    )
      return { reason: "static_visibility_unresolved", paths: [] };
    const paths = new Set<string>();
    const descend = (
      source: QuarterSourceRecord,
      visiting = new Set<string>(),
    ): boolean => {
      if (
        visiting.has(source.id) ||
        !source.childrenComplete ||
        source.textRuns === null ||
        !staticNode(source)
      )
        return false;
      visiting.add(source.id);
      paths.add(source.id);
      for (const id of source.childRecordIds) {
        const child = this.records.get(id);
        if (!child || !descend(child, visiting)) return false;
      }
      visiting.delete(source.id);
      return true;
    };
    for (const ref of refs) {
      const source =
        this.records.get(ref) ??
        this.records.get(
          this.input.evidence.primary.structure?.supplementaryFacts.find(
            (f) => f.id === ref,
          )?.elementRecordId ?? "",
        );
      if (!source || (source.name.localName !== "table" && !descend(source)))
        return { reason: "static_visibility_unresolved", paths: [...paths] };
      let node: QuarterSourceRecord | undefined = source;
      const seen = new Set<string>();
      while (node) {
        if (seen.has(node.id) || !staticNode(node))
          return { reason: "static_visibility_unresolved", paths: [...paths] };
        seen.add(node.id);
        paths.add(node.id);
        if (node.parentRecordId === null) {
          if (
            node.parentElementOrdinal !== null ||
            node.name.localName !== "html"
          )
            return {
              reason: "static_visibility_unresolved",
              paths: [...paths],
            };
          break;
        }
        node = this.records.get(node.parentRecordId);
        if (!node)
          return { reason: "static_visibility_unresolved", paths: [...paths] };
      }
    }
    return { reason: null, paths: [...paths] };
  }
  witness(
    fact: QuarterPrimaryOccurrence,
    companyFactsRefs: readonly string[],
  ): {
    witness: PersonalSecQuarterWitnessDto | null;
    reasons: AssessmentReason[];
    predicateIds: string[];
  } {
    const reasons = [...this.globalReasons],
      ids: string[] = [];
    const located = fact.elementRecordId
      ? this.locateCell(fact.elementRecordId)
      : null;
    if (!located)
      return {
        witness: null,
        reasons: [...reasons, "principal_witness_unresolved"],
        predicateIds: ids,
      };
    const { table, row, cell } = located,
      tableRecord = this.records.get(table.tableRecordId)!;
    const caption = this.caption(table);
    const preceding = this.anchors
      .filter(
        (r) =>
          r.elementOrdinal < tableRecord.elementOrdinal &&
          (SECTION.test(this.norm(r.id) ?? "") ||
            NOTES.test(this.norm(r.id) ?? "")),
      )
      .at(-1);
    const followingNotes = this.anchors.find(
      (r) =>
        r.elementOrdinal > tableRecord.endElementOrdinal &&
        NOTES.test(this.norm(r.id) ?? ""),
    );
    const group =
      preceding && followingNotes
        ? this.principalGroup(
            preceding.elementOrdinal,
            followingNotes.elementOrdinal,
          )
        : null;
    const names = this.registrantNames();
    const consolidation = this.anchors.filter((r) => {
      const match =
        /^the accompanying (?:unaudited )?(?:condensed )?consolidated financial statements include the accounts of (.+) and its (?:wholly[- ]owned |majority[- ]owned )?subsidiaries\.(?: all intercompany transactions are eliminated\.)?$/u.exec(
          this.norm(r.id) ?? "",
        );
      return match && names.some((name) => name.name === match[1]);
    });
    const consolidatedHeading = caption?.heading.some((id) =>
      /\bconsolidated\b/u.test(this.norm(id) ?? ""),
    );
    let statementReason: AssessmentReason | null = !caption
      ? "caption_ownership_unresolved"
      : !preceding ||
          !SECTION.test(this.norm(preceding.id) ?? "") ||
          !followingNotes ||
          !group
        ? "principal_statement_unresolved"
        : !consolidatedHeading && !consolidation.length
          ? "consolidation_scope_unresolved"
          : null;
    const statementRefs = [
      ...new Set([
        ...(caption?.heading ?? []),
        ...consolidation.map((r) => r.id),
        ...(consolidation.length ? names.map((name) => name.ref) : []),
        ...(preceding ? [preceding.id] : []),
        ...(followingNotes ? [followingNotes.id] : []),
        ...(group ?? []),
      ]),
    ];
    statementReason ??= this.visible(statementRefs).reason;
    ids.push(
      this.predicate("principal_statement_v1", statementRefs, statementReason, {
        kind: "statement",
        tableRef: table.tableRecordId,
        headingRefs: caption?.heading ?? [],
        consolidationRefs: consolidation.map((r) => r.id),
        sectionRefs: [preceding?.id, followingNotes?.id].filter(
          (id): id is string => id !== undefined,
        ),
      }),
    );
    if (statementReason) reasons.push(statementReason);
    const headers = this.headers(
      table,
      row,
      cell,
      3,
      this.input.selection.reportDate ?? "",
    );
    const label = this.label(table, row, cell);
    const adjacent: Cell[] = [];
    const cells = table.rows[row]!.cells;
    const index = cells.indexOf(cell);
    let display = this.text(cell.cellRecordId) ?? "";
    for (let i = index - 1; i >= Math.max(0, index - 2); i--) {
      const c = cells[i]!,
        text = this.norm(c.cellRecordId);
      if (
        !text ||
        !/^(?:\$|usd|\(|\$\s*\()$/u.test(text) ||
        c.columnStart + c.columnSpan !==
          (adjacent[0]?.columnStart ?? cell.columnStart)
      )
        break;
      adjacent.unshift(c);
      display = this.text(c.cellRecordId) + display;
    }
    const next = cells[index + 1];
    if (
      next &&
      this.norm(next.cellRecordId) === ")" &&
      next.columnStart === cell.columnStart + cell.columnSpan
    ) {
      adjacent.push(next);
      display += this.text(next.cellRecordId);
    }
    let columnReason = headers.reason;
    for (const a of adjacent) {
      const h = this.headers(
        table,
        row,
        a,
        3,
        this.input.selection.reportDate ?? "",
      );
      if (h.reason === "column_ownership_conflict")
        columnReason ??= "adjacent_cell_ownership_conflict";
    }
    columnReason ??= this.visible([
      cell.cellRecordId,
      ...headers.year,
      ...headers.duration,
      ...adjacent.map((c) => c.cellRecordId),
    ]).reason;
    ids.push(
      this.predicate(
        "standalone_column_v1",
        [
          cell.cellRecordId,
          ...headers.year,
          ...headers.duration,
          ...adjacent.map((c) => c.cellRecordId),
        ],
        columnReason,
        {
          kind: "column",
          numericCellRef: cell.cellRecordId,
          yearHeaderRefs: headers.year,
          durationHeaderRefs: headers.duration,
          adjacentCellRefs: adjacent.map((c) => c.cellRecordId),
        },
      ),
    );
    if (columnReason) reasons.push(columnReason);
    const revenue = fact.concept.localName !== "NetIncomeLoss";
    const registrantNames = names.map((name) => name.name);
    const parent = new RegExp(`^${NET} attributable to (.+)$`, "u").exec(
      label.text,
    );
    const explicit =
      parent &&
      ["the parent", "the company", ...registrantNames].includes(parent[1]!);
    const wholly = consolidation.filter((r) =>
      /\bwholly[- ]owned subsidiaries\b/u.test(this.norm(r.id) ?? ""),
    );
    const contrary = this.anchors.some((r) =>
      /(?:non[- ]?controlling|minority|participating|majority[- ]owned|variable interest entit)/u.test(
        this.norm(r.id) ?? "",
      ),
    );
    const ordinaryNet = new RegExp(`^${NET}$`, "u").test(label.text);
    const common =
      /common (?:share|stock)|per share|eps|continuing operations/u.test(
        label.text,
      );
    let scopeReason: AssessmentReason | null = revenue
      ? REVENUE.test(label.text) && this.wholeStatementRow(table, row, cell)
        ? null
        : "whole_revenue_scope_unresolved"
      : common
        ? /continuing/u.test(label.text)
          ? "unsupported_continuing_income"
          : "unsupported_common_share_numerator"
        : this.wholeStatementRow(table, row, cell) &&
            (explicit || (ordinaryNet && wholly.length && !contrary))
          ? null
          : "parent_attribution_unresolved";
    const scopeRefs = revenue
      ? [...statementRefs]
      : explicit
        ? [...statementRefs]
        : wholly.map((r) => r.id);
    scopeReason ??= this.visible([...label.refs, ...scopeRefs]).reason;
    const attribution = revenue
      ? "whole_revenue"
      : explicit
        ? "parent_explicit"
        : "wholly_owned";
    ids.push(
      this.predicate(
        revenue
          ? "whole_revenue_v1"
          : explicit
            ? "parent_income_explicit_v1"
            : "parent_income_wholly_owned_v1",
        [table.rows[row]!.rowRecordId, ...label.refs, ...scopeRefs],
        scopeReason,
        {
          kind: "scope",
          rowRef: table.rows[row]!.rowRecordId,
          labelCellRefs: label.refs,
          scopeRefs,
          attribution,
        },
      ),
    );
    if (scopeReason) reasons.push(scopeReason);
    const firstData = this.firstDataRow(table);
    const captionRefs = [
      ...(caption?.captions ?? []).filter(
        (id) => unitScale(this.norm(id) ?? "").matched,
      ),
      ...table.rows
        .slice(0, firstData < 0 ? row : firstData)
        .flatMap((r) => r.cells.map((c) => c.cellRecordId))
        .filter((id) => unitScale(this.norm(id) ?? "").matched),
    ];
    const scales = captionRefs.map((id) => unitScale(this.norm(id) ?? ""));
    const scale = [...new Set(scales.map((s) => s.scale))];
    const parsed = parseDisplay(display);
    const value =
      parsed && scale.length === 1 && scale[0] !== null
        ? scaleDecimal(parsed.value, scale[0]!)
        : null;
    let unitReason: AssessmentReason | null =
      readQuarterUnit(this.units.get(fact.unitRecordId ?? "")) !== "USD" ||
      !scales.length ||
      scale.length !== 1 ||
      scale[0] === null
        ? "display_unit_unresolved"
        : !parsed
          ? "display_amount_unresolved"
          : value !== fact.value
            ? "display_amount_mismatch"
            : null;
    unitReason ??= this.visible([
      cell.cellRecordId,
      ...adjacent.map((c) => c.cellRecordId),
      ...captionRefs,
    ]).reason;
    ids.push(
      this.predicate(
        "signed_usd_display_v1",
        [
          fact.id,
          cell.cellRecordId,
          ...adjacent.map((c) => c.cellRecordId),
          ...captionRefs,
          ...(fact.unitRecordId ? [fact.unitRecordId] : []),
        ],
        unitReason,
        unitReason || !parsed || value === null
          ? null
          : {
              kind: "display",
              numericCellRef: cell.cellRecordId,
              adjacentCellRefs: adjacent.map((c) => c.cellRecordId),
              unitRef: fact.unitRecordId!,
              captionRefs,
              text: display,
              scalePower10: scale[0] as 0 | 3 | 6,
              value,
            },
      ),
    );
    if (unitReason) reasons.push(unitReason);
    const visibleRefs = [
      fact.elementRecordId!,
      cell.cellRecordId,
      table.rows[row]!.rowRecordId,
      ...label.refs,
      ...headers.year,
      ...headers.duration,
      ...adjacent.map((c) => c.cellRecordId),
      ...captionRefs,
      ...statementRefs,
      ...scopeRefs,
    ];
    const visibility = this.visible(visibleRefs);
    ids.push(
      this.predicate(
        "static_source_path_v1",
        [...visibleRefs, "p:document"],
        visibility.reason,
        {
          kind: "static",
          pathRefs: visibility.paths,
          documentProfileRef: "p:document",
          uninterpretedScriptRefs: [],
          sourceInterpretation: "static_markup_only",
        },
      ),
    );
    if (visibility.reason) reasons.push(visibility.reason);
    if (
      reasons.length ||
      !this.calendar ||
      !parsed ||
      value === null ||
      companyFactsRefs.length === 0 ||
      !fact.contextRecordId ||
      !fact.unitRecordId
    )
      return {
        witness: null,
        reasons: [...new Set(reasons)],
        predicateIds: ids,
      };
    return {
      reasons: [],
      predicateIds: ids,
      witness: {
        id: `w:${fact.id}`,
        primaryRef: fact.id,
        companyFactsRefs: [...companyFactsRefs],
        concept: fact.concept
          .localName as PersonalSecQuarterWitnessDto["concept"],
        contextRef: fact.contextRecordId,
        unitRef: fact.unitRecordId,
        tableRef: table.tableRecordId,
        rowRef: table.rows[row]!.rowRecordId,
        labelCellRefs: label.refs,
        numericCellRef: cell.cellRecordId,
        adjacentCellRefs: adjacent.map((c) => c.cellRecordId),
        yearHeaderRefs: headers.year,
        durationHeaderRefs: headers.duration,
        captionRefs,
        scopeRefs,
        visibilityRefs: visibility.paths,
        predicateIds: [...this.calendar.predicateIds, ...ids],
        period: { startDate: this.calendar.start, endDate: this.calendar.end },
        value,
        display: {
          text: display,
          scalePower10: scale[0] as 0 | 3 | 6,
          signConvention: parsed.sign,
        },
      },
    };
  }
  private principalGroup(start: number, end: number): string[] | null {
    const tables = [...this.records.values()].filter(
      (r) =>
        r.name.localName === "table" &&
        r.elementOrdinal > start &&
        r.endElementOrdinal < end,
    );
    const kinds = [INCOME_HEADING, CASH_HEADING, BALANCE_HEADING];
    const refs: string[] = [];
    for (const kind of kinds) {
      const matching = tables.flatMap((record) => {
        const table = this.input.evidence.primary.structure?.tables.find(
          (t) => t.tableRecordId === record.id,
        ) ?? {
          tableRecordId: record.id,
          status: "complete" as const,
          reasons: [],
          rowRecordIds: [],
          rows: [],
        };
        const caption = this.caption(table, kind);
        return caption ? [{ record, caption }] : [];
      });
      if (matching.length !== 1) return null;
      refs.push(
        matching[0]!.record.id,
        ...matching[0]!.caption.heading,
        ...matching[0]!.caption.captions,
      );
    }
    return refs;
  }
  private registrantNames(): { name: string; ref: string }[] {
    const observations = (
      this.input.evidence.primary.structure?.supplementaryFacts ?? []
    ).filter((fact) => fact.concept.localName === "EntityRegistrantName");
    const eligible = observations.filter((fact) => {
      const context = readQuarterContext(
        this.contexts.get(fact.contextRecordId ?? ""),
      );
      return (
        !context ||
        (context.cik === this.input.cik &&
          !context.dimensioned &&
          context.endDate === this.input.selection.reportDate)
      );
    });
    if (
      eligible.some(
        (fact) =>
          !/^http:\/\/xbrl\.sec\.gov\/dei\/(2024|2025|2026)$/u.test(
            fact.concept.namespace ?? "",
          ) ||
          fact.issues.length ||
          !readQuarterContext(this.contexts.get(fact.contextRecordId ?? "")) ||
          !normalizeQuarterText(fact.rawText),
      )
    )
      return [];
    if (
      new Set(eligible.map((fact) => normalizeQuarterText(fact.rawText)))
        .size !== 1
    )
      return [];
    return eligible.map((fact) => ({
      name: normalizeQuarterText(fact.rawText),
      ref: fact.elementRecordId,
    }));
  }
  private wholeStatementRow(
    table: QuarterTableObservation,
    row: number,
    cell: Cell,
  ): boolean {
    const first = this.firstDataRow(table);
    for (let index = 0; index < row; index++) {
      const sourceRow = table.rows[index]!;
      if (
        index >= first &&
        sourceRow.cells.some((c) => {
          const record = this.records.get(c.cellRecordId)!;
          return [...this.records.values()].some(
            (r) =>
              r.elementOrdinal > record.elementOrdinal &&
              r.elementOrdinal <= record.endElementOrdinal &&
              r.name.namespace === IX &&
              r.name.localName === "nonFraction",
          );
        })
      )
        continue;
      for (const header of sourceRow.cells) {
        const text = this.norm(header.cellRecordId);
        if (text === null) return false;
        if (
          text === "" ||
          INCOME_HEADING.test(text) ||
          unitScale(text).scale !== null ||
          /^(?:\(unaudited\)|[$()]|(?:three|six|nine) months ended|(?:19|20)[0-9]{2})$/u.test(
            text,
          )
        )
          continue;
        if (new RegExp(`^${DATE_TEXT}$`, "u").test(text)) continue;
        // An inherited category or geographical qualifier changes the row's scope.
        if (header.columnStart < cell.columnStart || overlaps(header, cell))
          return false;
      }
    }
    return true;
  }
}
export function supportedGaap(namespace: string | null): boolean {
  const match =
    /^http:\/\/fasb\.org\/us-gaap\/(20[0-9]{2})(?:-([0-9]{2})-([0-9]{2}))?$/u.exec(
      namespace ?? "",
    );
  return Boolean(
    match &&
    Number(match[1]) >= 2009 &&
    (!match[2] || quarterDate(`${match[1]}-${match[2]}-${match[3]}`)),
  );
}
function overlaps(a: Cell, b: Cell): boolean {
  return (
    a.columnStart < b.columnStart + b.columnSpan &&
    b.columnStart < a.columnStart + a.columnSpan
  );
}
function covers(a: Cell, b: Cell): boolean {
  return (
    a.columnStart <= b.columnStart &&
    a.columnStart + a.columnSpan >= b.columnStart + b.columnSpan
  );
}
function unitScale(text: string): {
  matched: boolean;
  scale: 0 | 3 | 6 | null;
} {
  const matched =
    FOREIGN.test(text) ||
    /\b(?:thousands?|millions?|dollars?|usd)\b|\$/u.test(text);
  if (!matched || FOREIGN.test(text)) return { matched, scale: null };
  const exact =
    /^\(?\s*(?:(?:amounts |dollars )?in |\$ in )?(thousands|millions|dollars|u\.s\. dollars|usd)(?:,? except (?:per share|per-share|share and per share|share and per-share) (?:data|amounts))?\s*\)?$/u.exec(
      text,
    );
  return {
    matched,
    scale: !exact
      ? null
      : exact[1] === "thousands"
        ? 3
        : exact[1] === "millions"
          ? 6
          : 0,
  };
}
function parseDisplay(
  text: string,
): { value: string; sign: "unsigned" | "minus" | "parentheses" } | null {
  let value = text.replace(/[\t\n\r \u00a0]/gu, "");
  value = value.replace(/^(?:\$|USD)/u, "");
  let sign: "unsigned" | "minus" | "parentheses" = "unsigned";
  if (value.startsWith("(") && value.endsWith(")")) {
    sign = "parentheses";
    value = value.slice(1, -1).replace(/^\$/u, "");
  } else if (value.startsWith("-")) {
    sign = "minus";
    value = value.slice(1);
  }
  if (!/^(?:[0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:\.[0-9]+)?$/u.test(value))
    return null;
  const canonical = canonicalQuarterDecimal(
    (sign === "unsigned" ? "" : "-") + value.replace(/,/gu, ""),
  );
  return canonical === null ? null : { value: canonical, sign };
}
function staticNode(node: QuarterSourceRecord): boolean {
  const local = node.name.localName;
  if (node.name.namespace === IX) {
    if (local !== "nonFraction" && local !== "nonNumeric") return false;
  } else if (
    (node.name.namespace !== null && node.name.namespace !== HTML) ||
    !/^(?:html|body|div|p|span|b|strong|i|em|u|table|thead|tbody|tfoot|tr|td|th|br|hr)$/u.test(
      local ?? "",
    )
  )
    return false;
  for (const a of node.attributes) {
    if (
      a.namespace === XMLNS ||
      (a.namespace === "http://www.w3.org/XML/1998/namespace" &&
        a.localName === "lang")
    )
      continue;
    if (
      a.namespace !== null ||
      !/^(?:id|class|lang|style|colspan|rowspan|align|valign|width|height|name|contextRef|unitRef|format|sign|scale|decimals|precision)$/u.test(
        a.name,
      )
    )
      return false;
    if (a.name === "style" && !staticStyle(a.value)) return false;
    if (
      (a.name === "height" || a.name === "width") &&
      !/^(?:[1-9][0-9]*(?:\.[0-9]+)?%?)$/u.test(a.value)
    )
      return false;
  }
  return true;
}
/** Deliberately finite declaration grammar; unsupported syntax is a hold. */
export function staticStyle(style: string): boolean {
  if (/[\\{}@]|\/\*|var\(|url\(|calc\(/iu.test(style)) return false;
  const seen = new Set<string>();
  for (const raw of style.split(";")) {
    if (!raw.trim()) continue;
    const match = /^\s*([a-z-]+)\s*:\s*([^:]+?)\s*$/iu.exec(raw);
    if (!match) return false;
    const key = match[1]!.toLowerCase(),
      value = match[2]!
        .toLowerCase()
        .replace(/\s*!important\s*$/u, "")
        .trim();
    if (seen.has(key)) return false;
    seen.add(key);
    if (
      key === "display" &&
      /^(?:block|inline|inline-block|table|inline-table|table-row|table-cell|table-row-group)$/u.test(
        value,
      )
    )
      continue;
    if (key === "position" && /^(?:static|relative)$/u.test(value)) continue;
    if (key === "visibility" && value === "visible") continue;
    if (key === "opacity" && value === "1") continue;
    if (
      key === "font-size" &&
      /^(?:[1-9][0-9]*(?:\.[0-9]+)?)(?:px|pt)$/u.test(value)
    )
      continue;
    if (key === "font-weight" && /^(?:normal|bold|[1-9]00)$/u.test(value))
      continue;
    if (key === "font-style" && /^(?:normal|italic|oblique)$/u.test(value))
      continue;
    if (
      key === "font-family" &&
      /^(?:[a-z][a-z -]*|'[a-z][a-z -]*'|"[a-z][a-z -]*")(?:,\s*(?:[a-z][a-z -]*|'[a-z][a-z -]*'|"[a-z][a-z -]*"))*$/u.test(
        value,
      )
    )
      continue;
    if (key === "white-space" && /^(?:normal|pre-wrap|nowrap)$/u.test(value))
      continue;
    if (key === "text-align" && /^(?:left|center|right|justify)$/u.test(value))
      continue;
    if (
      key === "vertical-align" &&
      /^(?:top|middle|bottom|baseline)$/u.test(value)
    )
      continue;
    if (key === "border-collapse" && /^(?:collapse|separate)$/u.test(value))
      continue;
    if (key === "table-layout" && value === "auto") continue;
    if (key === "z-index" && /^[0-9]+$/u.test(value)) continue;
    if (
      /^(?:padding|margin)(?:-(?:top|right|bottom|left))?$|^(?:width|border-spacing|text-indent)$/u.test(
        key,
      ) &&
      /^(?:0|auto|[0-9]+(?:\.[0-9]+)?(?:px|pt|in|%))(?: (?:0|auto|[0-9]+(?:\.[0-9]+)?(?:px|pt|in|%))){0,3}$/u.test(
        value,
      )
    )
      continue;
    if (
      /^(?:border|border-top|border-right|border-bottom|border-left)$/u.test(
        key,
      ) &&
      /^(?:0|[0-9]+(?:\.[0-9]+)?(?:px|pt)) (?:solid|double|none) (?:black|#[0-9a-f]{3}|#[0-9a-f]{6})$/u.test(
        value,
      )
    )
      continue;
    if (
      (key === "color" || key === "background-color") &&
      colorSupported(value, key === "color")
    )
      continue;
    return false;
  }
  return true;
}
function colorSupported(value: string, foreground: boolean): boolean {
  if (value === (foreground ? "black" : "white")) return true;
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/u.test(value)) return false;
  const hex =
    value.length === 4
      ? value
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")
      : value.slice(1);
  return [0, 2, 4]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
    .every((n) => (foreground ? n <= 64 : n >= 192));
}
