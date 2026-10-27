package local.investment.personal;

import static org.junit.Assert.*;
import org.json.JSONObject;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;

/** Fixed invented periods and whole draft observations; no financial calculation in this oracle. */
final class InterimStatementsEvidence {
    static final String DIAGNOSTICS = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    static final String DRAFT = "JSON.parse(document.querySelector('#fixture-workspace-draft').textContent)";
    static final String METADATA = "JSON.parse(document.querySelector('#fixture-interim-report-metadata').textContent)";
    static final String PROTOCOL = "JSON.parse(document.querySelector('#fixture-report-protocol').textContent)";
    static final String PREFIX = "Thèse café 📈";
    static final String REVENUE = "RevenueFromContractWithCustomerExcludingAssessedTax";
    static final String CASH = "NetCashProvidedByUsedInOperatingActivities";
    record DraftCapture(String origin, String memberships, String completeNote) {}
    enum Stage {
        STARTUP(0, 0, 1), LOADED(1, 0, 1), SAVED(1, 1, 1), RELOADED(1, 1, 2);
        final int reports, saves, loads;
        Stage(int reports, int saves, int loads) { this.reports = reports; this.saves = saves; this.loads = loads; }
    }
    enum Cell {
        REVENUE_QUARTER(REVENUE, "duration", "2026-04-01", "40"),
        REVENUE_LONGER(REVENUE, "duration", "2026-01-01", "75"),
        OPERATING_CASH(CASH, "duration", "2026-01-01", "9"),
        ASSETS("Assets", "instant", null, "120");
        final String concept, period, amount;
        Cell(String concept, String kind, String start, String amount) {
            this.concept = concept;
            this.period = "[" + JSONObject.quote(kind) + "," + (start == null ? "null" : JSONObject.quote(start)) + ",\"2026-06-30\"]";
            this.amount = amount;
        }
        String selector() { return "#managed-interim-report [data-interim-cell-key=" + JSONObject.quote("[" + JSONObject.quote(concept) + "," + JSONObject.quote(period) + "]") + "]"; }
    }
    static Script counts(Stage stage) {
        return new Script("(() => {const d=" + DIAGNOSTICS + ";return d.load===" + stage.loads + "&&d.status===1&&d.save===" + stage.saves + "&&d.interimReport===" + stage.reports +
            "&&d.marketsResolve===1&&['annual','eod','filings','search','resolve','marketsEod','calendar','fed','token','signOut','interimPortfolioLoad','interimPortfolioSave','interimFollowupsLoad','interimFollowupsSave'].every(k=>d[k]===0);})()");
    }
    static Script cell(Cell cell) {
        return new Script("(() => {const r=document.querySelector(" + JSONObject.quote(cell.selector()) + ");return r?.querySelector('[data-interim-value]')?.textContent===" + JSONObject.quote("USD " + cell.amount) +
            "&&r.querySelector('input[type=checkbox]')?.disabled===false&&r.textContent.includes('2026-06-30');})()");
    }
    static Script income() {
        return new Script("(() => {const rows=[...document.querySelectorAll('#interim-table-income [data-interim-concept=\"" + REVENUE + "\"] tbody tr')];" +
            "return rows.length===2&&new Set(rows.map(r=>r.dataset.interimCellKey)).size===2&&" + cell(Cell.REVENUE_QUARTER).expression() + "&&" + cell(Cell.REVENUE_LONGER).expression() +
            "&&rows.every(r=>r.textContent.includes('Quarter/YTD classification not established.'))&&![...document.querySelectorAll('#interim-table-income [data-interim-value]')].some(c=>c.textContent==='USD 35');})()");
    }
    static Script originalClocks() {
        return new Script("(() => {const t=document.querySelector('#managed-interim-report [aria-label=\"Original interim filing and source clocks\"]')?.textContent??'';return " +
            "['2026-06-30','2026-07-30','0000000001-26-000002','2026-08-01T12:00:00.000Z','2026-08-01T12:00:01.000Z','2026-08-01T12:00:02.000Z','2026-08-01T12:00:03.000Z'," +
            "'CompanyFacts','No older history file was requested.'].every(x=>t.includes(x));})()");
    }
    static DraftCapture capture(ReportRevisitPage page) throws Exception {
        String note = page.read(new Script(METADATA + ".expectedNote"));
        assertEquals(1793, note.codePointCount(0, note.length()));
        assertTrue(note.startsWith(PREFIX + " Interim CompanyFacts-only: ZERO; Zero Company; Zero Class A; XNAS; listing listing-zero; issuer issuer-zero; CIK 0000000001;"));
        assertTrue(note.contains(REVENUE + ": USD 40; Reported duration: 2026-04-01 to 2026-06-30 (91 days)"));
        assertTrue(note.contains(CASH + ": USD 9; Reported duration: 2026-01-01 to 2026-06-30 (181 days)"));
        assertTrue(note.contains("Assets: USD 120; As of 2026-06-30"));
        assertTrue(note.endsWith("No source refresh or quarter/YTD inference."));
        assertFalse(note.contains(": USD 35;"));
        return new DraftCapture(page.read(new Script("String(performance.timeOrigin)")), page.read(new Script("JSON.stringify(" + DRAFT + ".memberships)")), note);
    }
    static Script completePreview(DraftCapture draft) {
        return new Script("(() => {const f=document.querySelector('#managed-interim-note-preview');return f?.readOnly===true&&f.value===" + JSONObject.quote(draft.completeNote) +
            "&&[...f.value].length===1793&&f.wrap!=='off'&&f.scrollHeight>=f.clientHeight&&document.querySelector('#interim-note-append')?.disabled===false;})()");
    }
    static Script exactDraft(DraftCapture captured, Stage stage) {
        return new Script("(() => {const d=" + DRAFT + ",expected=JSON.parse(" + JSONObject.quote(captured.memberships) + ");expected[0].note=" + JSONObject.quote(captured.completeNote) +
            ";const a=d.memberships;return Array.isArray(a)&&a.length===2&&expected.length===2&&a.every((row,i)=>Object.keys(row).length===Object.keys(expected[i]).length&&Object.keys(expected[i]).every(k=>Object.hasOwn(row,k)&&row[k]===expected[i][k]))" +
            "&&d.dirty===" + (stage == Stage.LOADED ? "true" : "false") + "&&d.baseVersion===" + (stage == Stage.LOADED ? 1 : 2) + ";})()");
    }
    static Check readyInterimSection() {
        return new Check("the committed Annual route retains the prefix and enables the exact Interim tab before one click", new Script(
            "(() => {const b=document.querySelector('.managed-company-sections button[aria-label=\"Interim section for ZERO\"]'),r=b?.getBoundingClientRect();return document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'" +
            "&&new URL(location.href).searchParams.get('company')==='listing-zero'&&new URL(location.href).searchParams.get('section')==='annual'" +
            "&&document.querySelector('.managed-company-sections button[aria-label=\"Annual section for ZERO\"]')?.getAttribute('aria-pressed')==='true'" +
            "&&document.querySelector('#managed-research-note')?.value==="+JSONObject.quote(PREFIX)+"&&"+counts(Stage.STARTUP).expression()+
            "&&b?.disabled===false&&b.textContent==='Interim'&&r.width>0&&r.height>0&&getComputedStyle(b).visibility==='visible';})()")).nativeReady();
    }

    static Check readyBack() {
        return new Check("exact current Interim route and visible enabled Back are ready before the single hardware press", new Script(
            "(() => {const b=document.querySelector('.managed-company-visit .trial-toolbar > button'),r=b?.getBoundingClientRect();return document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO'" +
            "&&new URL(location.href).searchParams.get('company')==='listing-zero'&&new URL(location.href).searchParams.get('section')==='interim'&&document.querySelector('#managed-interim-report')?.getAttribute('aria-busy')==='false'" +
            "&&b?.disabled===false&&b.textContent==='Back to workspace'&&r.width>0&&r.height>0&&getComputedStyle(b).visibility==='visible';})()")).nativeReady();
    }
}
