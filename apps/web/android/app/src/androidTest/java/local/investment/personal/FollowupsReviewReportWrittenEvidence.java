package local.investment.personal;

import static org.junit.Assert.*;

import android.content.Context;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;
import local.investment.personal.ReportRevisitPage.Script;

/** Full actual chosen-output readback; expected entries come from the original RAM resource. */
final class FollowupsReviewReportWrittenEvidence {
    record Request(Context context, ReportRevisitPage page, String original, String capture) {}
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-followups-report').textContent)";
    private final Request request;
    FollowupsReviewReportWrittenEvidence(Request request) { this.request = request; }

    void inspect() throws Exception {
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(request.context);
        assertEquals(1, outputs.length);
        WatchlistTestDocuments.Output output = outputs[0];
        assertTrue(output.name.matches("Investment-followups-review-[0-9]{8}T[0-9]{9}Z\\.html"));
        assertEquals(request.page.read(new Script(FILE + ".filename")), output.name);
        assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY, output.uri.getAuthority());
        byte[] bytes;
        try (InputStream input = request.context.getContentResolver().openInputStream(output.uri)) {
            assertNotNull("Actual chosen URI grant is readable", input);
            bytes = input.readNBytes(InvestmentFollowupsReviewReportPlugin.MAX_REPORT_BYTES + 1);
        }
        assertTrue(bytes.length > 0 && bytes.length <= InvestmentFollowupsReviewReportPlugin.MAX_REPORT_BYTES);
        assertEquals(output.size, bytes.length);
        assertEquals(Integer.parseInt(request.page.read(new Script("String(" + FILE + ".byteLength)"))), bytes.length);
        String html = new String(bytes, StandardCharsets.UTF_8);
        assertArrayEquals("All written UTF-8 bytes round trip without replacement", bytes, html.getBytes(StandardCharsets.UTF_8));
        assertTrue(FollowupsReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name, html));
        assertTrue("Complete captured appendix survives the actual native write", html.contains(escape(request.capture)));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt; &amp; Café 東京 📈"));
        assertTrue(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
        assertFalse(html.contains("<script>"));
        assertFalse(html.contains("<img "));
        verifyCompleteReadingDocument(html);
    }
    private static String escape(String text) { return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"); }
    private void verifyCompleteReadingDocument(String html) throws Exception {
        // DOMParser inspects the full readback as inert data. No expected value comes from the formatter.
        String decoded = request.page.read(new Script("JSON.stringify((()=>{const d=new DOMParser().parseFromString(" + JSONObject.quote(html) + ",'text/html');return {" +
            "title:d.title,appendix:d.querySelector('pre')?.textContent,active:d.querySelectorAll('script,form,a,img,iframe,object').length," +
            "entries:[...d.querySelectorAll('section.fact')].map(s=>({values:[...s.querySelectorAll('dd')].map(e=>e.textContent),text:[...s.querySelectorAll('p.note')].map(e=>e.textContent)}))};})())"));
        JSONObject observed = new JSONObject(decoded);
        assertEquals("Follow-ups review report", observed.getString("title"));
        assertEquals(0, observed.getInt("active"));
        assertEquals("Complete actual appendix equals the separately captured raw report", request.capture, observed.getString("appendix"));
        JSONObject original = new JSONObject(request.original);
        JSONObject archive = new JSONObject(observed.getString("appendix"));
        assertEquals(original.toString(), archive.getJSONObject("draft").toString());
        assertEquals("followups_review", archive.getString("kind"));
        assertEquals(0, archive.getInt("baseVersion"));
        assertTrue(archive.getBoolean("dirty"));
        JSONArray expected = original.getJSONArray("entries");
        JSONArray actual = observed.getJSONArray("entries");
        assertEquals(expected.length(), actual.length());
        for (int index = 0; index < expected.length(); index++) verifyEntry(expected.getJSONObject(index), actual.getJSONObject(index));
    }
    private void verifyEntry(JSONObject entry, JSONObject actual) throws Exception {
        JSONObject listing = entry.getJSONObject("listing");
        JSONArray values = new JSONArray().put(entry.getString("id")).put(entry.getString("catalogSnapshotSha256"));
        for (String key : new String[]{"country","exchangeMic","instrumentType","issuerId","issuerName","listingId","securityId","securityName","shareClassId","shareClassName","symbol"})
            values.put(listing.getString(key));
        values.put(entry.getString("status")).put(entry.getString("dueOn"))
            .put(entry.isNull("completedOn") ? "Not completed" : entry.getString("completedOn"));
        assertEquals("Every identity, catalog digest, state and original date is complete and ordered", values.toString(), actual.getJSONArray("values").toString());
        assertEquals(new JSONArray().put(entry.getString("check")).put(entry.getString("result")).toString(), actual.getJSONArray("text").toString());
    }
}