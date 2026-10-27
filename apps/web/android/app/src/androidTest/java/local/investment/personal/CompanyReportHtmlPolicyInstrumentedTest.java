package local.investment.personal;

import static org.junit.Assert.*;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class CompanyReportHtmlPolicyInstrumentedTest {
    private static final String FILENAME = "Investment-research-ZERO-XNAS-20261017T000000000Z.html";
    private static final String PURPOSE = "investment.company-research-html";
    private static final String CSP = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src 'sha256-0prZMY8NvuxrM52UL/gsirqQ7bU+/xP67p90kVL2EMQ='";
    private static final String STYLE =
        "html { color-scheme: light; background: #f4f3ef; color: #202a35; font-family: system-ui, sans-serif; line-height: 1.6; }\n" +
        "body { margin: 0; padding: clamp(16px, 4vw, 48px); }\n" +
        "main { max-width: 76ch; margin: 0 auto; padding: clamp(16px, 4vw, 40px); background: #fff; border: 1px solid #d8dde1; }\n" +
        "h1, h2, h3 { line-height: 1.25; overflow-wrap: anywhere; }\n" +
        "h1 { font-size: 1.9rem; margin-top: 0; }\n" +
        "h2 { margin-top: 2rem; font-size: 1.35rem; }\n" +
        "h3 { font-size: 1.05rem; }\n" +
        "p, dd, li, pre { overflow-wrap: anywhere; }\n" +
        "dl { display: grid; grid-template-columns: minmax(0, 12rem) minmax(0, 1fr); gap: 8px 20px; }\n" +
        "dt { font-weight: 600; }\n" +
        "dd { margin: 0; min-width: 0; }\n" +
        "small { display: block; }\n" +
        ".fact { border-top: 1px solid #d8dde1; padding: 8px 0 16px; }\n" +
        ".amount { font-weight: 650; font-variant-numeric: tabular-nums; }\n" +
        ".note, pre { white-space: pre-wrap; }\n" +
        ".warning { border-left: 3px solid #8a5a12; padding-left: 12px; }\n" +
        "summary { min-height: 44px; display: list-item; align-content: center; cursor: pointer; font-weight: 600; overflow-wrap: anywhere; }\n" +
        "summary:focus-visible { outline: 2px solid #244e76; outline-offset: 3px; }\n" +
        "pre { padding: 12px; border: 1px solid #d8dde1; font-size: .85rem; }\n" +
        ".managed-valuation-results { min-width: 0; }\n" +
        ".captured-price-studies { min-width: 0; }\n" +
        ".captured-price-studies .managed-price-studies-table-wrap { max-width: 100%; overflow-x: auto; margin-block: 16px; }\n" +
        ".captured-price-studies table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }\n" +
        ".captured-price-studies :is(th, td) { padding: 10px; border-bottom: 1px solid #d8dde1; text-align: left; vertical-align: top; overflow-wrap: anywhere; }\n" +
        ".managed-valuation-table { max-width: 100%; overflow-x: auto; margin-block: 16px; }\n" +
        ".managed-valuation-table table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }\n" +
        ".managed-valuation-table :is(th, td) { padding: 8px; border-bottom: 1px solid #d8dde1; text-align: right; overflow-wrap: anywhere; }\n" +
        ".managed-valuation-table :is(th, td):first-child { text-align: left; }\n" +
        ".managed-valuation-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n" +
        ".managed-valuation-facts > div { min-width: 0; }\n" +
        ".managed-valuation-facts dd { margin-top: 4px; }\n" +
        ".managed-annual-statement-report { min-width: 0; }\n" +
        ".managed-annual-statement-report :is(h4, h5, strong, span, th, td) { overflow-wrap: anywhere; }\n" +
        ".managed-annual-statement-report .managed-annual-statement-table { max-width: 100%; overflow-x: auto; margin-block: 20px; }\n" +
        ".managed-annual-statement-report table { width: 100%; min-width: 36rem; table-layout: fixed; border-collapse: collapse; font-variant-numeric: tabular-nums; }\n" +
        ".managed-annual-statement-report :is(th, td) { padding: 10px; vertical-align: top; border: 1px solid #d8dde1; text-align: left; white-space: normal; }\n" +
        ".managed-annual-statement-report caption { text-align: left; font-weight: 650; padding-block: 8px; }\n" +
        ".managed-annual-statement-report th:first-child { width: 42%; }\n" +
        ".managed-annual-statement-report small { margin-block: 6px; font-weight: 400; }\n" +
        ".managed-annual-statement-report .managed-annual-statement-amount { display: block; white-space: normal; }\n" +
        ".managed-annual-statement-report details { margin-block: 12px; padding: 8px; border: 1px solid #d8dde1; }\n" +
        ".managed-annual-statement-report dl { display: block; }\n" +
        ".managed-annual-statement-report dl > div { display: grid; grid-template-columns: minmax(0, 10rem) minmax(0, 1fr); gap: 4px 12px; padding-block: 4px; }\n" +
        ".managed-annual-statement-report .managed-annual-statement-observation { border-top: 1px solid #d8dde1; margin-block: 12px; }\n" +
        "@media (max-width: 520px) { dl { grid-template-columns: minmax(0, 1fr); gap: 4px; } dd { margin-bottom: 12px; } }\n" +
        "@media print { html { background: #fff; } body, main { padding: 0; border: 0; } h2, h3 { break-after: avoid; } .fact { break-inside: avoid; } }\n";

    private JSONObject metadata() throws Exception {
        return new JSONObject().put("operationId", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
            .put("purpose", PURPOSE).put("filename", FILENAME);
    }

    private String document() {
        return "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">"
            + "<meta http-equiv=\"Content-Security-Policy\" content=\"" + CSP + "\">"
            + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            + "<meta name=\"investment-report-format\" content=\"1\">"
            + "<meta name=\"investment-report-purpose\" content=\"" + PURPOSE + "\">"
            + "<meta name=\"investment-report-filename\" content=\"" + FILENAME + "\">"
            + "<title>Company research · ZERO</title><style>" + STYLE
            + "</style></head><body><main><p>invented note Café 東京 📈 &lt;script&gt;</p>"
            + "<details><summary>Complete captured JSON</summary><pre>{&quot;schemaVersion&quot;:&quot;6.0.0&quot;}</pre></details>"
            + "</main></body></html>\n";
    }

    @Test
    public void admitsTheFixedHtmlMetadataAndCompleteEnvelope() throws Exception {
        assertEquals(FILENAME, CompanyReportHtmlDocumentPolicy.INSTANCE.filename(metadata()));
        assertEquals("text/html", CompanyReportHtmlDocumentPolicy.INSTANCE.getMimeType());
        assertEquals(8388608, CompanyReportHtmlDocumentPolicy.INSTANCE.getMaxBytes());
        assertTrue(CompanyReportHtmlDocumentPolicy.INSTANCE.acceptsText(FILENAME, document()));
    }

    @Test
    public void refusesUnknownOptionsCrossFormatPurposeAndUnsafeFilename() throws Exception {
        for (String key : new String[] { "mimeType", "maxBytes", "text", "uri", "handle" })
            assertNull(CompanyReportHtmlDocumentPolicy.INSTANCE.filename(metadata().put(key, "caller value")));
        JSONObject missing = metadata();
        missing.remove("operationId");
        assertNull(CompanyReportHtmlDocumentPolicy.INSTANCE.filename(missing));
        assertNull(CompanyReportHtmlDocumentPolicy.INSTANCE.filename(metadata().put("purpose", "investment.company-research")));
        for (String name : new String[] {
            FILENAME.replace(".html", ".json"), "../" + FILENAME, "content://invented/" + FILENAME,
            FILENAME.replace("ZERO", "zero"), FILENAME + ".html", FILENAME.replace("ZERO", "<ZERO>"),
            FILENAME.replace("XNAS", "XNA"), "unrelated.html"
        }) {
            assertNull(CompanyReportHtmlDocumentPolicy.INSTANCE.filename(metadata().put("filename", name)));
            assertFalse(CompanyReportHtmlDocumentPolicy.INSTANCE.acceptsText(name, document()));
        }
        assertNull(CompanyReportDocumentPolicy.INSTANCE.filename(metadata()));
        assertFalse(CompanyReportDocumentPolicy.INSTANCE.acceptsText(FILENAME, document()));
    }

    @Test
    public void reusesTheJsonCalendarAndExactChosenIdentity() throws Exception {
        String leap = FILENAME.replace("20261017", "20240229");
        assertEquals(leap, CompanyReportHtmlDocumentPolicy.INSTANCE.filename(metadata().put("filename", leap)));
        assertTrue(CompanyReportHtmlDocumentPolicy.INSTANCE.acceptsText(leap, document().replace(FILENAME, leap)));
        for (String name : new String[] {
            FILENAME.replace("20261017", "20260229"), FILENAME.replace("20261017", "20261317"),
            FILENAME.replace("20261017", "20260431"), FILENAME.replace("T000000000", "T240000000"),
            FILENAME.replace("T000000000", "T006000000"), FILENAME.replace("T000000000", "T000060000")
        }) {
            assertNull(CompanyReportHtmlDocumentPolicy.INSTANCE.filename(metadata().put("filename", name)));
            assertFalse(CompanyReportHtmlDocumentPolicy.INSTANCE.acceptsText(name, document().replace(FILENAME, name)));
        }
        for (String name : new String[] {
            FILENAME.replace("ZERO", "ONE"), FILENAME.replace("XNAS", "XNYS"),
            FILENAME.replace("20261017", "20261018")
        }) {
            assertFalse(CompanyReportHtmlDocumentPolicy.INSTANCE.acceptsText(name, document()));
        }
    }

    @Test
    public void refusesChangedHeadCspStyleIdentityOrIncompleteEnvelope() {
        for (String text : new String[] {
            "", "\ufeff" + document(), document().replace("<!doctype html>", "<!DOCTYPE html>"),
            document().replace("lang=\"en\"", "lang=\"fr\""),
            document().replace("content=\"1\"", "content=\"2\""),
            document().replace(PURPOSE, "investment.company-research"),
            document().replace("<title>Company research · ZERO", "<title>Company research · ONE"),
            document().replace("script-src 'none'", "script-src 'unsafe-inline'"),
            document().replace("color-scheme: light", "color-scheme: dark"),
            document().replace("<meta charset=\"utf-8\">", "<meta charset=\"utf-8\"><meta name=\"extra\" content=\"1\">"),
            document().replace("</style></head><body><main>", "</style></head><body>"),
            document().replace("</main></body></html>\n", "</main></body>"),
            document() + "trailing"
        })
            assertFalse(CompanyReportHtmlDocumentPolicy.INSTANCE.acceptsText(FILENAME, text));
    }

    @Test
    public void inheritsTheEightMibStrictUtf8WriterBoundary() {
        int maximum = CompanyReportHtmlDocumentPolicy.INSTANCE.getMaxBytes();
        String document = document();
        int padding = maximum - document.getBytes(StandardCharsets.UTF_8).length;
        String bounded = document.replace("</main>", " ".repeat(padding) + "</main>");
        assertTrue(CompanyReportHtmlDocumentPolicy.INSTANCE.acceptsText(FILENAME, bounded));
        assertEquals(maximum, ChosenDocumentPolicyKt.strictDocumentBytes(bounded, maximum).length);
        try {
            ChosenDocumentPolicyKt.strictDocumentBytes(bounded.replace("</main>", " </main>"), maximum);
            fail("Expected complete UTF-8 byte refusal");
        } catch (Exception expected) {
            // The unchanged writer checks complete bytes before opening its destination.
        }
        assertEquals(3, ChosenDocumentPolicyKt.strictDocumentBytes("零", 3).length);
        for (String malformed : new String[] { "\ud800", "\udfff" }) {
            try {
                ChosenDocumentPolicyKt.strictDocumentBytes(document.replace("invented note", malformed), maximum);
                fail("Expected malformed UTF-16 refusal");
            } catch (Exception expected) {
                // No malformed replacement text can reach the chosen output.
            }
        }
    }
}
