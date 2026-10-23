package local.investment.personal;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class FinancialScreenRecipePolicyInstrumentedTest {
    private static final String TIME = "2026-10-23T01:02:03.456Z";
    private static final String FILENAME = "Investment-financial-screen-recipe-2026-10-23T01-02-03-456Z.json";
    private static final String HASH = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private JSONObject metadata() throws Exception {
        return new JSONObject().put("operationId", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
            .put("capturedAt", TIME);
    }

    private String content() {
        return "{\"format\":\"investment-financial-screen-recipe\",\"version\":1,"
            + "\"name\":\"Cash discipline 零 café 😀\",\"capturedAt\":\"" + TIME + "\","
            + "\"catalogSnapshotSha256\":\"" + HASH + "\","
            + "\"criteria\":{\"clauses\":[{\"field\":\"operatingIncome\",\"operator\":\"gte\",\"value\":\"0.00\"}],"
            + "\"sort\":{\"field\":\"operatingIncome\",\"direction\":\"desc\"}},"
            + "\"listings\":[{\"country\":\"US\",\"exchangeMic\":\"XNAS\",\"instrumentType\":\"common_stock\","
            + "\"issuerId\":\"issuer-zero\",\"issuerName\":\"Zero Company\",\"listingId\":\"listing-zero\","
            + "\"securityId\":\"security-zero\",\"securityName\":\"Zero Class A\",\"shareClassId\":\"class-zero\","
            + "\"shareClassName\":\"Class A\",\"symbol\":\"ZERO\"}]}\n";
    }

    @Test
    public void acceptsFixedRecipeMetadataAndCurrentBody() throws Exception {
        assertEquals(FILENAME, FinancialScreenRecipePolicy.INSTANCE.filename(metadata()));
        assertTrue(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME, content()));
        byte[] bytes = ChosenDocumentPolicyKt.strictDocumentBytes(content(), 65536);
        assertEquals(content(), new String(bytes, StandardCharsets.UTF_8));
        // Native framing does not duplicate the shared codec's financial validation.
        assertTrue(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME,
            content().replace("\"value\":\"0.00\"", "\"value\":\"not a decimal\"")));
    }

    @Test
    public void rejectsUnknownCrossPurposeAndMismatchedDestinationMetadata() throws Exception {
        for (String key : new String[] { "filename", "purpose", "baseVersion", "accountScope", "version" }) {
            assertNull(FinancialScreenRecipePolicy.INSTANCE.filename(metadata().put(key, "foreign")));
        }
        for (String key : new String[] { "operationId", "capturedAt" }) {
            JSONObject missing = metadata();
            missing.remove(key);
            assertNull(FinancialScreenRecipePolicy.INSTANCE.filename(missing));
        }
        assertNull(FinancialScreenRecipePolicy.INSTANCE.filename(metadata().put("capturedAt", 123)));
        for (String purpose : new String[] { "valuation-inputs-draft", "watchlist-draft", "portfolio-draft", "followups-draft" }) {
            assertFalse(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME,
                content().replace("investment-financial-screen-recipe", "investment-" + purpose)));
            assertFalse(FinancialScreenRecipePolicy.INSTANCE.acceptsText(
                FILENAME.replace("financial-screen-recipe", purpose), content()));
        }
        assertFalse(FinancialScreenRecipePolicy.INSTANCE.acceptsText("../private.json", content()));
        assertFalse(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME.replace("01-02-03", "01-02-04"), content()));
    }

    @Test
    public void rejectsVersionTimestampAndNonClosedRecipeFraming() {
        String original = content();
        for (String value : new String[] {
            original.replace("\"version\":1", "\"version\":2"),
            original.replace("\"version\":1", "\"version\":1.0"),
            original.replace("\"version\":1", "\"version\":1e0"),
            original.replace("\"version\":1", "\"version\":\"1\""),
            original.replace("\"version\":1,", ""),
            original.replace("\"version\":1", "\"version\":1,\"version\":1"),
            original.replace("\"version\":1", "\"version\":1,\"results\":[]"),
            original.replace("\"version\":1", "\"version\":1,\"notes\":[]"),
            original.replace("\"version\":1", "\"version\":1,\"accountScope\":\"foreign\""),
            original.replace(TIME, "2026-10-24T01:02:03.456Z"),
            original.replace(HASH, "foreign"),
            original.replace("\"name\":\"Cash discipline 零 café 😀\"", "\"name\":null"),
            original.replace("\"criteria\":{", "\"criteria\":[],\"extra\":{"),
            original.replace("\"listings\":[", "\"listings\":{},\"extra\":["),
            original + "{}", "[" + original + "]", ""
        }) assertFalse(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME, value));
    }

    @Test
    public void sharedWriterEnforcesExactUtf8LimitAndRejectsMalformedText() {
        String original = content();
        int originalBytes = original.getBytes(StandardCharsets.UTF_8).length;
        String exact = original + " ".repeat(65536 - originalBytes);
        assertTrue(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME, exact));
        assertEquals(65536, ChosenDocumentPolicyKt.strictDocumentBytes(exact, 65536).length);
        String ascii = original.replace("零 café 😀", "raw");
        String exactAscii = ascii + " ".repeat(65536 - ascii.length());
        assertTrue(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME, exactAscii));
        assertFalse(FinancialScreenRecipePolicy.INSTANCE.acceptsText(FILENAME, exactAscii + " "));
        for (String value : new String[] { exact + " ", "零".repeat(21846), original.replace("零", "\ud800") }) {
            try {
                ChosenDocumentPolicyKt.strictDocumentBytes(value, 65536);
                fail("Expected recipe UTF-8 byte refusal before opening a destination");
            } catch (Exception expected) {
                // ChosenDocumentWriter runs this unchanged encoder before policy and stream access.
            }
        }
    }

    @Test
    public void validatesCalendarBoundariesAndKeepsMimeAndOptionsFixed() throws Exception {
        assertEquals("application/json", FinancialScreenRecipePolicy.INSTANCE.getMimeType());
        assertEquals(65536, FinancialScreenRecipePolicy.INSTANCE.getMaxBytes());
        assertEquals("Screen recipe file unavailable", FinancialScreenRecipePolicy.INSTANCE.getFailureMessage());
        for (String key : new String[] { "mime", "mimeType", "extension", "text" }) {
            assertNull(FinancialScreenRecipePolicy.INSTANCE.filename(metadata().put(key, "text/html")));
        }
        for (String time : new String[] {
            "2026-02-29T01:02:03.456Z", "2100-02-29T01:02:03.456Z", "2026-04-31T01:02:03.456Z",
            "2026-00-23T01:02:03.456Z", "2026-13-23T01:02:03.456Z", "2026-10-00T01:02:03.456Z",
            "2026-10-23T24:02:03.456Z", "2026-10-23T01:60:03.456Z", "2026-10-23T01:02:60.456Z",
            "2026-10-23T01:02:03Z", "2026-10-23T01:02:03.456+00:00", "../private"
        }) assertNull(FinancialScreenRecipePolicy.INSTANCE.filename(metadata().put("capturedAt", time)));
        for (String time : new String[] { "2028-02-29T23:59:59.999Z", "2000-02-29T00:00:00.000Z", "2026-04-30T01:02:03.456Z" }) {
            assertEquals("Investment-financial-screen-recipe-" + time.replace(':', '-').replace('.', '-') + ".json",
                FinancialScreenRecipePolicy.INSTANCE.filename(metadata().put("capturedAt", time)));
        }
    }
}
