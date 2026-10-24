package local.investment.personal;

import static org.junit.Assert.*;

import android.content.Context;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Inspect only the actual chosen output through its real URI grant and complete byte bound. */
final class PortfolioReviewReportWrittenEvidence {
    record Request(Context context, ReportRevisitPage page, String archive) {}
    private static final String FILE = "JSON.parse(document.querySelector('#fixture-portfolio-report').textContent)";
    private final Request request;
    PortfolioReviewReportWrittenEvidence(Request request) { this.request = request; }
    void inspect() throws Exception {
        WatchlistTestDocuments.Output[] outputs = WatchlistTestDocuments.outputs(request.context);
        assertEquals(1, outputs.length);
        WatchlistTestDocuments.Output output = outputs[0];
        verifyChosenReportMetadata(output);
        byte[] bytes;
        try (InputStream input = request.context.getContentResolver().openInputStream(output.uri)) {
            assertNotNull("Actual chosen URI grant remains readable", input);
            bytes = input.readNBytes(InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES + 1);
        }
        verifyChosenReportBytes(output, bytes);
        String html = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(PortfolioReviewReportDocumentPolicy.INSTANCE.acceptsText(output.name, html));
        verifyWrittenEscaping(html);
        verifyWrittenContents(new WrittenReport(html, request));
    }
    private void verifyChosenReportMetadata(WatchlistTestDocuments.Output output) throws Exception {
        assertTrue(output.name.matches("Investment-portfolio-review-[0-9]{8}T[0-9]{9}Z\\.html"));
        assertEquals(request.page.read(new ReportRevisitPage.Script(FILE + ".filename")), output.name);
        assertEquals(SavedWatchlistTestDocumentsProvider.AUTHORITY, output.uri.getAuthority());
    }
    private void verifyChosenReportBytes(WatchlistTestDocuments.Output output, byte[] bytes) throws Exception {
        assertTrue(bytes.length > 0 && bytes.length <= InvestmentPortfolioReviewReportPlugin.MAX_REPORT_BYTES);
        assertEquals(output.size, bytes.length);
        assertEquals(Integer.parseInt(request.page.read(new ReportRevisitPage.Script("String(" + FILE + ".byteLength)"))), bytes.length);
    }
    private record WrittenReport(String html, Request request) {}
    private void verifyWrittenEscaping(CharSequence html) {
        assertTrue(html.toString().contains("Zero &lt;script&gt;alert(1)&lt;/script&gt; &amp; Company"));
        assertFalse(html.toString().contains("<script>"));
    }
    private void verifyWrittenContents(WrittenReport report) {
        String html = report.html;
        assertTrue(html.contains("USD 220.50") && html.contains("USD 948.00") && html.contains("USD 1168.50"));
        assertTrue(html.contains("Complete authored ledger") && html.contains("Complete report document and source packets"));
        // Preserve the entire actual written appendix, including every ledger value and source clock.
        assertTrue("Every captured ledger, raw packet and original clock survives the actual written appendix", html.contains(report.request.archive.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")));
    }

}
