package local.investment.personal;

import static org.junit.Assert.*;
import android.content.Context;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;

/** Owns one captured report and checks its complete source evidence and actual chosen bytes. */
final class PortfolioCompositionReportEvidence {
    record Request(Context context, ReportRevisitPage page) {}
    record CapturedReport(String archive) {}
    private record SourceEvidence(JSONObject report, JSONObject source, int index) {}
    private record ChosenBytes(WatchlistTestDocuments.Output output, byte[] raw) {}
    private record HtmlEvidence(WatchlistTestDocuments.Output output, String html) {}
    private static final String FILE="JSON.parse(document.querySelector('#fixture-portfolio-report').textContent)";
    private final Request request;
    private final ReportRevisitPage page;
    PortfolioCompositionReportEvidence(Request request) { this.request=request;this.page=request.page(); }
    private Context context() { return request.context(); }
    void assertCaptured(CapturedReport capture) throws Exception {
        String archive=capture.archive();
        page.await(new Check("whole captured ledger and composition equal independent handwritten expectations",new Script(
            "(()=>{"+PortfolioCompositionExpectations.EXACT+"const r="+archive+";return same(r.ledger,"+PortfolioCompositionExpectations.ledger()+") && same(r.review.composition,"+PortfolioCompositionExpectations.composition()+") && r.review.balancesOn==='2026-10-04' && r.review.asOfDate===document.querySelector('#managed-portfolio-close-date').value && r.sourceRows.length===2 && r.sourceRows.every((row,i)=>same(row.response.security,r.ledger.identities[i]));})()")));
        JSONObject report=new JSONObject(archive);assertEquals("portfolio_holdings_review",report.getString("kind"));
        for(int index=0;index<2;index++)assertSource(report,index);
    }
    private void assertSource(JSONObject report,int index) throws Exception {
        JSONObject source=report.getJSONArray("sourceRows").getJSONObject(index).getJSONObject("response");
        SourceEvidence evidence=new SourceEvidence(report,source,index);
        inspectSourceIdentity(evidence);
        inspectPriceConvention(evidence);
        inspectRawValues(evidence);
        inspectObservedDate(evidence);
        inspectOriginalClocks(evidence);
    }
    private void inspectSourceIdentity(SourceEvidence evidence) throws Exception {
        JSONObject source=evidence.source();int index=evidence.index();
        assertEquals(index==0?"listing-zero":"listing-zero-c",source.getJSONObject("security").getString("listingId"));
        assertEquals(index==0?"class-zero":"class-zero-c",source.getJSONObject("security").getString("shareClassId"));
    }
    private void inspectPriceConvention(SourceEvidence evidence) throws Exception {
        JSONObject source=evidence.source();
        assertEquals("Tiingo",source.getString("provider"));assertEquals("raw_close",source.getString("priceBasis"));assertEquals("USD",source.getString("currency"));
    }
    private void inspectRawValues(SourceEvidence evidence) throws Exception {
        JSONObject source=evidence.source();int index=evidence.index();
        assertEquals(2,source.getJSONArray("rows").length());assertEquals(index==0?"20":"40",source.getJSONArray("rows").getJSONObject(0).getString("close"));
        assertEquals(index==0?"25":"50",source.getJSONArray("rows").getJSONObject(1).getString("close"));
    }
    private void inspectObservedDate(SourceEvidence evidence) throws Exception {
        JSONObject report=evidence.report(),source=evidence.source();
        assertEquals(report.getJSONObject("review").getString("asOfDate"),source.getJSONArray("rows").getJSONObject(1).getString("date"));
    }
    private void inspectOriginalClocks(SourceEvidence evidence) throws Exception {
        JSONObject report=evidence.report(),source=evidence.source();
        assertNotEquals(report.getString("preparedAt"),source.getString("requestStartedAt"));assertNotEquals(report.getString("preparedAt"),source.getString("completedAt"));
        assertTrue(source.getString("requestStartedAt").matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z"));
    }
    void assertWritten(CapturedReport capture) throws Exception {
        var output=chosenOutput();
        assertChosenMetadata(output);
        byte[] raw=readCompleteBoundedBytes(output);
        assertWriterBoundary(raw);
        assertCompleteByteCount(new ChosenBytes(output,raw));
        String html=new String(raw,StandardCharsets.UTF_8);
        HtmlEvidence evidence=new HtmlEvidence(output,html);
        assertPassiveEnvelope(evidence);
        assertCompositionValues(evidence);
        assertWholeAppendix(evidence,capture);
    }
    private WatchlistTestDocuments.Output chosenOutput() throws Exception {
        WatchlistTestDocuments.Output[] outputs=WatchlistTestDocuments.outputs(context());assertEquals(1,outputs.length);return outputs[0];
    }
    private void assertChosenMetadata(WatchlistTestDocuments.Output output) throws Exception {
        assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY,output.uri.getAuthority());assertEquals(page.read(new Script(FILE+".filename")),output.name);assertTrue(output.name.matches("Investment-portfolio-review-[0-9]{8}T[0-9]{9}Z\\.html"));
    }
    private byte[] readCompleteBoundedBytes(WatchlistTestDocuments.Output output) throws Exception {
        byte[] raw;
        try(InputStream input=context().getContentResolver().openInputStream(output.uri)){assertNotNull(input);raw=input.readNBytes(InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES+1);}
        return raw;
    }
    private void assertWriterBoundary(byte[] raw) {
        assertTrue(raw.length>0);assertTrue(raw.length<=InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES);
    }
    private void assertCompleteByteCount(ChosenBytes bytes) throws Exception {
        WatchlistTestDocuments.Output output=bytes.output();byte[] raw=bytes.raw();
        assertEquals(output.size,raw.length);assertEquals(Integer.parseInt(page.read(new Script("String("+FILE+".byteLength)"))),raw.length);
    }
    private void assertPassiveEnvelope(HtmlEvidence evidence) {
        WatchlistTestDocuments.Output output=evidence.output();String html=evidence.html();
        assertTrue(PortfolioReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name,html));assertFalse(html.contains("<script>"));
    }
    private void assertCompositionValues(HtmlEvidence evidence) {
        String html=evidence.html();
        assertTrue(html.contains("25.00%"));assertTrue(html.contains("50.00%"));assertTrue(html.contains("USD 200.00"));
    }
    private void assertWholeAppendix(HtmlEvidence evidence,CapturedReport capture) {
        String html=evidence.html(),archive=capture.archive();
        assertTrue("Every original ledger field, complete composition and source clock survives actual readback",html.contains(archive.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")));
    }
}
