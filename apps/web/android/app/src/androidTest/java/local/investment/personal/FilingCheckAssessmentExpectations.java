package local.investment.personal;

import static org.junit.Assert.*;
import android.content.Context;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;
import local.investment.personal.ReportRevisitPage.Script;

/** Independent invented text and complete resource/readback assertions for this journey. */
final class FilingCheckAssessmentExpectations {
    static final String ID = "00000000-0000-4000-8000-000000000001";
    static final String QUESTION = "Does the filing change the original capacity thesis? Café 東京 📈";
    static final String RAW = "My assessment: capacity needs another review. <script>invented</script> & Café 東京 📈";
    static final String NOTE = "Independent unsaved filing assessment note · Café 東京 📈";
    static final String CITATION = "Observed SEC filing reference: ZERO (XNAS); CIK 0000000001; Form 10-Q; accession 0000000001-26-000001; filed 2026-09-19; report date 2026-06-30; filing index https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. " +
        "Source: SEC Submissions; requested window 2026-06-23 to 2026-09-20; original request started 2026-09-20T00:00:00.000Z; retrieved 2026-09-20T00:00:01.000Z; completed 2026-09-20T00:00:02.000Z. " +
        "Only the current recent-filings object was checked; older continuation files were not loaded; complete window coverage is not established. " +
        "The source lists older continuation files. Filing contents were not fetched. Evidence dates are unchanged; this action does not refresh sources.";
    static final String RESULT = RAW + " " + CITATION;
    static final String C = "JSON.parse(document.querySelector('#fixture-diagnostics').textContent)";
    static final String F = "JSON.parse(document.querySelector('#fixture-followups-diagnostics').textContent)";
    static final String R = "JSON.parse(document.querySelector('#fixture-followups-draft').textContent)";
    static final String D = "JSON.parse(document.querySelector('#fixture-filing-check-assessment').textContent)";
    static final String FILE = "JSON.parse(document.querySelector('#fixture-followups-report').textContent)";
    static final String PREVIEW = "[aria-label='Cited assessment preview']";
    static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    record Original(String savedWatchlist, String unsavedWatchlist, String followups) {}
    record Completion(String status, String date) {
        static Completion open() { return new Completion("open", null); }
    }
    private record Sources(int sessions, int resolves, int filings) {}
    private record Resource(int loads, int saves) {}
    enum Phase {
        INITIAL(new Sources(1,0,0),new Resource(0,0)),
        LOADED(new Sources(1,0,0),new Resource(1,0)),
        RESEARCH(new Sources(1,1,0),new Resource(1,0)),
        FILINGS(new Sources(1,1,1),new Resource(1,0)),
        SAVED(new Sources(1,1,1),new Resource(1,1)),
        FRESH(new Sources(2,1,1),new Resource(1,1)),
        RELOADED(new Sources(2,1,1),new Resource(2,1));
        final Sources sources;
        final Resource resource;
        Phase(Sources sources, Resource resource) { this.sources=sources;this.resource=resource; }
    }
    static Script boundary(String sourceSha, Phase phase) {
        return new Script("location.origin==='https://localhost'&&location.hash===''&&window.Capacitor?.getPlatform()==='android'&&document.querySelector('meta[name=investment-build-sha]')?.content===" + JSONObject.quote(sourceSha) +
            "&&document.querySelector('meta[name=investment-android-test]')?.content==='managed-workspace'&&document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content===" + JSONObject.quote(CSP) +
            "&&"+C+".load==="+phase.sources.sessions()+"&&"+C+".status==="+phase.sources.sessions()+"&&"+C+".marketsResolve==="+phase.sources.sessions()+"&&"+C+".resolve==="+phase.sources.resolves()+"&&"+C+".filings==="+phase.sources.filings()+
            "&&"+C+".save===0&&"+C+".eod===0&&"+C+".annual===0&&"+C+".interim===0&&"+C+".interimReport===0&&"+C+".cpi===0&&"+C+".marketsEod===0&&"+C+".calendar===0&&"+C+".fed===0&&"+C+".search===0&&"+C+".interimPortfolioLoad===0&&"+C+".interimPortfolioSave===0&&"+C+".interimFollowupsLoad===0&&"+C+".interimFollowupsSave===0&&"+C+".token===0&&"+C+".signOut===0"+
            "&&"+F+".load==="+phase.resource.loads()+"&&"+F+".save==="+phase.resource.saves()+"&&"+F+".commits==="+phase.resource.saves()+"&&"+F+".replays===0&&"+F+".failures===0&&"+F+".held===0&&"+F+".aborted===0&&"+F+".token===0&&"+F+".signOut===0&&"+D+".rejected===0");
    }
    static String unchangedWatchlist(Original original) {
        return D+".watchlist.canonical==="+JSONObject.quote(original.unsavedWatchlist())+"&&"+D+".watchlist.dirty===true&&"+C+".save===0";
    }
    static String wholePayload(Original original, String result, Completion completion) {
        return "(()=>{const expected=JSON.parse("+JSONObject.quote(original.followups())+");expected.entries[0].result="+JSONObject.quote(result)+";expected.entries[0].status="+JSONObject.quote(completion.status())+";expected.entries[0].completedOn="+(completion.date()==null?"null":JSONObject.quote(completion.date()))+";return "+D+".followups.canonical===JSON.stringify(expected);})()";
    }
    static Script completePreview() {
        return new Script("(()=>{const p=document.querySelector("+JSONObject.quote(PREVIEW)+"),t=document.querySelector('#filings-assessment-result');if(!p||!t)return false;const identity=Object.fromEntries([...p.querySelectorAll(':scope>dl>div')].map(d=>[d.querySelector('dt').textContent,d.querySelector('dd').textContent]));return t.readOnly&&t.value==="+JSONObject.quote(RESULT)+"&&document.activeElement===document.querySelector('#filings-assessment-preview-heading')&&p.querySelector('.filings-assessment-authored')?.textContent==="+JSONObject.quote(RAW)+"&&p.querySelector('.filings-assessment-citation')?.textContent==="+JSONObject.quote(CITATION)+
            "&&identity.Check==="+JSONObject.quote(ID)+"&&identity.Question==="+JSONObject.quote(QUESTION)+"&&identity.State==='open'&&identity['Completed on']==='Not completed'&&identity['Due date (UTC)']==='2000-01-01'&&identity.Symbol==='ZERO'&&identity.Listing==='listing-zero'&&identity.Security==='Zero Class A · security-zero'&&identity['Share class']==='Class A · class-zero'&&identity.Exchange==='XNAS'&&identity.Catalog==='sha256:'+'a'.repeat(64)&&identity.Issuer==='issuer-zero'&&identity.Company==='Zero Company'&&identity.Country==='US'&&identity['Instrument type']==='common_stock'&&p.textContent.includes('2026-09-20T00:00:01.000Z')&&p.textContent.includes('2026-09-20T00:00:02.000Z')&&p.textContent.includes('current recent-filings')&&document.querySelector('#filings-assessment-apply')?.disabled===false;})()");
    }
    static void inspectHtml(Context context, ReportRevisitPage page, String canonical, String capture) throws Exception {
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context);assertEquals(1,outputs.length);
        WatchlistTestDocuments.Output output=outputs[0];assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY,output.uri.getAuthority());
        assertTrue(output.name.matches("Investment-followups-review-[0-9]{8}T[0-9]{9}Z\\.html"));
        assertEquals(page.read(new Script(FILE+".filename")),output.name);
        byte[] bytes;
        try(InputStream input=context.getContentResolver().openInputStream(output.uri)) { assertNotNull(input);bytes=input.readNBytes(InvestmentFollowupsReviewReportPlugin.MAX_REPORT_BYTES+1); }
        assertTrue(bytes.length>0&&bytes.length<=InvestmentFollowupsReviewReportPlugin.MAX_REPORT_BYTES);assertEquals(output.size,bytes.length);
        assertEquals(Integer.parseInt(page.read(new Script("String("+FILE+".byteLength)"))),bytes.length);
        String html=new String(bytes,StandardCharsets.UTF_8);assertArrayEquals(bytes,html.getBytes(StandardCharsets.UTF_8));
        assertTrue(FollowupsReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name,html));
        assertTrue(html.contains("&lt;script&gt;invented&lt;/script&gt; &amp; Café 東京 📈"));assertFalse(html.contains("<script>"));
        JSONObject observed=new JSONObject(page.read(new Script("JSON.stringify((()=>{const d=new DOMParser().parseFromString("+JSONObject.quote(html)+",'text/html');return {title:d.title,appendix:d.querySelector('pre')?.textContent,active:d.querySelectorAll('script,form,a,img,iframe,object').length,entries:[...d.querySelectorAll('section.fact')].map(s=>({values:[...s.querySelectorAll('dd')].map(e=>e.textContent),text:[...s.querySelectorAll('p.note')].map(e=>e.textContent)}))};})())")));
        assertEquals("Follow-ups review report",observed.getString("title"));assertEquals(0,observed.getInt("active"));assertEquals(capture,observed.getString("appendix"));
        JSONObject report=new JSONObject(capture);assertEquals("followups_review",report.getString("kind"));assertEquals(2,report.getInt("baseVersion"));assertFalse(report.getBoolean("dirty"));
        String actual=page.read(new Script("JSON.stringify(JSON.parse("+JSONObject.quote(capture)+").draft)"));assertEquals(canonical,actual);
        JSONArray entries=new JSONObject(canonical).getJSONArray("entries"),reading=observed.getJSONArray("entries");assertEquals(entries.length(),reading.length());
        for(int index=0;index<entries.length();index++) verifyReadingEntry(entries.getJSONObject(index),reading.getJSONObject(index));
    }
    private static void verifyReadingEntry(JSONObject entry,JSONObject reading) throws Exception {
        JSONObject listing=entry.getJSONObject("listing");JSONArray values=new JSONArray().put(entry.getString("id")).put(entry.getString("catalogSnapshotSha256"));
        for(String key:new String[]{"country","exchangeMic","instrumentType","issuerId","issuerName","listingId","securityId","securityName","shareClassId","shareClassName","symbol"})values.put(listing.getString(key));
        values.put(entry.getString("status")).put(entry.getString("dueOn")).put(entry.isNull("completedOn")?"Not completed":entry.getString("completedOn"));
        assertEquals(values.toString(),reading.getJSONArray("values").toString());
        assertEquals(new JSONArray().put(entry.getString("check")).put(entry.getString("result")).toString(),reading.getJSONArray("text").toString());
    }
}
