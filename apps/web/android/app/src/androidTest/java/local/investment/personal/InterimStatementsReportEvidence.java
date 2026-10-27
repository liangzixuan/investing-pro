package local.investment.personal;

import static org.junit.Assert.*;
import android.content.Context;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;
import local.investment.personal.ReportRevisitPage.Element;
import local.investment.personal.InterimStatementsEvidence.DraftCapture;
import local.investment.personal.InterimStatementsEvidence.Stage;

/** One captured schema-six graph survives both actual chosen files and an explicit read-only reopen. */
final class InterimStatementsReportEvidence {
    record Request(Context context, ReportRevisitPage page, DraftCapture draft) {}
    private record Capture(String document, String filename) {}
    private final Request request;
    private static final String PROTOCOL=InterimStatementsEvidence.PROTOCOL;
    InterimStatementsReportEvidence(Request request) { this.request=request; }
    void captureWriteAndReopen() throws Exception {
        Capture captured=capture();
        saveJson(captured);
        saveHtml(captured);
        reopen(captured);
        request.page.await(new Check("file capture and read-only reopen leave the exact unsaved note and sources unchanged",new Script(InterimStatementsEvidence.counts(Stage.LOADED).expression()+"&&"+InterimStatementsEvidence.exactDraft(request.draft,Stage.LOADED).expression())));
    }
    private Capture capture() throws Exception {
        request.page.click(Element.css(".managed-company-report > summary"));
        request.page.click(Element.xpath("//details[contains(@class,'managed-company-report')]/div/button[normalize-space(.)='Prepare research report']"));
        request.page.await(new Check("one current capture contains the entire authored note",new Script("document.querySelector('#managed-prepared-report-heading')?.textContent==='Research report · ZERO'&&document.querySelector('.managed-company-report-note')?.textContent==="+JSONObject.quote(request.draft.completeNote()))));
        request.page.click(Element.css(".managed-report-document > summary"));
        request.page.await(new Check("schema-six JSON has one complete graph and exact full-period references",graph()));
        String document=request.page.read(new Script("document.querySelector('#managed-report-document').value"));
        JSONObject report=new JSONObject(document);
        assertEquals("6.0.0",report.getString("schemaVersion"));
        assertEquals(request.draft.completeNote(),report.getJSONObject("authoredResearch").getString("note"));
        String filename="Investment-research-ZERO-XNAS-"+report.getString("preparedAt").replaceAll("[-:.]","");
        request.page.click(Element.css(".managed-report-document > summary"));
        return new Capture(document,filename);
    }
    private Script graph() {
        return new Script("(() => {const f=document.querySelector('#managed-report-document');if(!f?.readOnly)return false;const d=JSON.parse(f.value),s=d.sources.interim,e=s.response.evidence,obs=e.facts.observations,ids=new Set(obs.map(x=>x.id)),rows=s.statements.statements.flatMap(x=>x.rows),cells=rows.flatMap(x=>x.cells),m="+InterimStatementsEvidence.METADATA+";"+
            "const revenue=rows.find(r=>r.concept==='RevenueFromContractWithCustomerExcludingAssessedTax').cells;return d.schemaVersion==='6.0.0'&&d.purpose==='investment.company-research'&&d.authoredResearch.note==="+JSONObject.quote(request.draft.completeNote())+
            "&&d.listing.listingId==='listing-zero'&&d.listing.symbol==='ZERO'&&d.listing.shareClassName==='Class A'&&s.response.schemaVersion==='1.0.0'&&s.retainedPrevious===false&&s.lastAttemptFailed===false"+
            "&&e.facts.scans.length===32&&obs.length===6&&ids.size===6&&s.statements.statements.length===3&&rows.length===32&&cells.length===6"+
            "&&JSON.stringify(rows.map(r=>r.concept))===JSON.stringify(e.facts.scans.map(r=>r.concept))&&rows.every(r=>r.cells.every(c=>obs.find(o=>o.id===c.observationIds[0])?.concept===r.concept))"+
            "&&[[\"RevenueFromContractWithCustomerExcludingAssessedTax\",\"2026-04-01\",\"40\"],[\"RevenueFromContractWithCustomerExcludingAssessedTax\",\"2026-01-01\",\"75\"],[\"NetIncomeLoss\",\"2026-04-01\",\"4\"],[\"NetIncomeLoss\",\"2026-01-01\",\"7\"],[\"Assets\",null,\"120\"],[\"NetCashProvidedByUsedInOperatingActivities\",\"2026-01-01\",\"9\"]].every(([concept,start,value])=>obs.some(o=>o.concept===concept&&o.startDate===start&&o.endDate===\"2026-06-30\"&&o.value===value))"+
            "&&JSON.stringify(e.generation)===JSON.stringify(m.generation)&&e.target.accessionNumber==='0000000001-26-000002'&&e.target.reportDate==='2026-06-30'&&e.target.filedDate==='2026-07-30'"+
            "&&f.value.split('\"observations\":').length===2&&revenue.length===2&&new Set(revenue.map(c=>c.periodKey)).size===2"+
            "&&revenue.some(c=>c.periodKey==='[\"duration\",\"2026-04-01\",\"2026-06-30\"]'&&obs.find(o=>o.id===c.observationIds[0]).value==='40')&&revenue.some(c=>c.periodKey==='[\"duration\",\"2026-01-01\",\"2026-06-30\"]'&&obs.find(o=>o.id===c.observationIds[0]).value==='75')"+
            "&&cells.every(c=>{const o=obs.find(o=>o.id===c.observationIds[0]);return Object.keys(c).length===4&&['periodKey','observationIds','status','reason'].every(k=>Object.hasOwn(c,k))&&c.status==='available'&&c.reason===null&&c.observationIds.length===1&&!!o&&c.periodKey===JSON.stringify([o.startDate===null?'instant':'duration',o.startDate,o.endDate]);})"+
            "&&['price','annual','filings'].every(k=>d.sources[k].status==='not_loaded');})()");
    }
    private void saveJson(Capture captured) throws Exception {
        request.page.click(Element.xpath("//div[contains(@class,'managed-report-delivery-actions')]/button[normalize-space(.)='Save report (JSON)']"));
        new WatchlistSystemPicker().saveToInventedRoot();
        request.page.await(new Check("one JSON native write settles without an online Save",new Script(PROTOCOL+".writesSettled===1&&!"+PROTOCOL+".protocolError")));
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(request.context);
        assertEquals(1,outputs.length);
        assertEquals(captured.filename+".json",outputs[0].name);
        assertEquals("application/json",request.context.getContentResolver().getType(outputs[0].uri));
        assertArrayEquals(captured.document.getBytes(StandardCharsets.UTF_8),WatchlistTestDocuments.readReport(request.context,outputs[0]));
    }
    private void saveHtml(Capture captured) throws Exception {
        request.page.click(Element.xpath("//div[contains(@class,'managed-report-delivery-actions')]/button[normalize-space(.)='Save report (HTML)']"));
        new WatchlistSystemPicker().saveToInventedRoot();
        request.page.await(new Check("the same captured graph is written once as passive HTML",new Script(PROTOCOL+".writesSettled===1&&"+PROTOCOL+".html.choicesStarted===1&&"+PROTOCOL+".html.writesSettled===1&&!"+PROTOCOL+".protocolError")));
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(request.context);
        assertEquals(2,outputs.length);
        WatchlistTestDocuments.Output html=null;
        for(WatchlistTestDocuments.Output output:outputs)if(output.name.equals(captured.filename+".html"))html=output;
        assertNotNull("The explicitly chosen HTML file exists",html);
        assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY,html.uri.getAuthority());
        assertEquals("text/html",request.context.getContentResolver().getType(html.uri));
        byte[] bytes;
        try(InputStream stream=request.context.getContentResolver().openInputStream(html.uri)){
            assertNotNull(stream);bytes=stream.readNBytes(InvestmentCompanyReportHtmlPlugin.MAX_REPORT_BYTES+1);
        }
        assertTrue(bytes.length>0&&bytes.length<=InvestmentCompanyReportHtmlPlugin.MAX_REPORT_BYTES);
        assertEquals(html.size,bytes.length);
        inspectHtml(new WrittenHtml(captured,StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString()));
    }
    private record WrittenHtml(Capture capture,String html) {}
    private void inspectHtml(WrittenHtml written) throws Exception {
        assertTrue(written.html.startsWith("<!doctype html>\n<html lang=\"en\">"));
        assertFalse(java.util.regex.Pattern.compile("<(?:script|img|iframe|object|embed|link|base|form|input|button|svg|math|video|audio|source)\\b",java.util.regex.Pattern.CASE_INSENSITIVE).matcher(written.html).find());
        JSONObject parsed=new JSONObject(request.page.read(new Script("(()=>{const doc=new DOMParser().parseFromString("+JSONObject.quote(written.html)+",'text/html');return JSON.stringify({csp:doc.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.content,purpose:doc.querySelector('meta[name=investment-report-purpose]')?.content,filename:doc.querySelector('meta[name=investment-report-filename]')?.content,format:doc.querySelector('meta[name=investment-report-format]')?.content,note:doc.querySelector('.note')?.textContent,json:doc.querySelector('details > pre')?.textContent,passive:[...doc.querySelectorAll('*')].every(n=>[...n.attributes].every(a=>!/^on/i.test(a.name)&&!['src','href','srcdoc','background','style'].includes(a.name))),periods:doc.querySelector('[aria-label=\"Captured interim reported-period views\"]')?.textContent});})()")));
        assertEquals("investment.company-research-html",parsed.getString("purpose"));
        assertEquals("1",parsed.getString("format"));
        assertEquals(written.capture.filename+".html",parsed.getString("filename"));
        assertEquals("default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src 'sha256-0prZMY8NvuxrM52UL/gsirqQ7bU+/xP67p90kVL2EMQ='",parsed.getString("csp"));
        assertTrue(parsed.getBoolean("passive"));
        assertEquals(request.draft.completeNote(),parsed.getString("note"));
        assertEquals("Whole JSON appendix matches the single captured graph",written.capture.document,parsed.getString("json"));
        String periods=parsed.getString("periods");
        for(String text:new String[]{"2026-04-01","2026-01-01","2026-06-30","USD 40","USD 75","USD 9","USD 120","Quarter/YTD classification not established."})assertTrue(periods.contains(text));
    }
    private void reopen(Capture captured) throws Exception {
        request.page.click(Element.css(".managed-report-revisit > summary"));
        new ReportRevisitTouch(request.page).fileChooser();
        new WatchlistSystemPicker().openInventedReportDocument(captured.filename+".json");
        request.page.await(new Check("reopened report is read-only and retains the original full note, periods and clocks",new Script("(()=>{const s=document.querySelector('[aria-label=\"Archived report\"]'),p=s?.querySelector('[aria-label=\"Archived report interim provenance\"]'),t=p?.textContent??'';return document.querySelector('#managed-report-revisit-heading')?.textContent==='Reopened report · ZERO'&&s?.querySelector('.managed-company-report-note')?.textContent==="+JSONObject.quote(request.draft.completeNote())+"&&s.querySelectorAll('input,textarea,button,a').length===0&&!!s.querySelector('[aria-label=\"Captured interim reported-period views\"]')&&['USD 40','USD 75','USD 9','USD 120','2026-04-01','2026-01-01','2026-06-30','Quarter/YTD classification not established.'].every(x=>s.querySelector('[aria-label=\"Captured interim reported-period views\"]').textContent.includes(x))&&['2026-06-30','2026-07-30','2026-08-01T12:00:00.000Z','2026-08-01T12:00:01.000Z','2026-08-01T12:00:02.000Z','2026-08-01T12:00:03.000Z','0000000001-26-000002'].every(x=>t.includes(x))&&document.querySelector('[aria-label=\"Current report capture\"]')===null;})()")));
    }
}
