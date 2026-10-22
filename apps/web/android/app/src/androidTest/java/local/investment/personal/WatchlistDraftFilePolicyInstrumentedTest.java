package local.investment.personal;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class WatchlistDraftFilePolicyInstrumentedTest {
    private static final String TIME = "2026-10-18T18:00:00.000Z";
    private static final String FILENAME = "Investment-watchlist-draft-2026-10-18T18-00-00-000Z.json";
    private static final String PORTFOLIO_FILENAME = "Investment-portfolio-draft-2026-10-18T18-00-00-000Z.json";
    private static final String FOLLOWUPS_FILENAME = "Investment-followups-draft-2026-10-18T18-00-00-000Z.json";
    private static final String SCOPE = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private JSONObject metadata() throws Exception {
        return new JSONObject().put("operationId", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
            .put("capturedAt", TIME).put("baseVersion", 3);
    }

    private String content() {
        return "{\"format\":\"investment-watchlist-draft\",\"version\":1,"
            + "\"accountScope\":\"" + SCOPE + "\",\"capturedAt\":\"" + TIME + "\","
            + "\"baseVersion\":3,\"draft\":{\"rawNote\":\"  Raw unconfirmed note\\n零 café 😀  \"}}\n";
    }

    private String portfolioContent() {
        // Native framing deliberately leaves the whole raw ledger to the shared codec.
        return content().replace("investment-watchlist-draft", "investment-portfolio-draft")
            .replace("rawNote", "rawLedger");
    }

    @Test
    public void derivesOnlyTheFixedFilenameAndMimeFromCaptureMetadata() throws Exception {
        assertEquals(FILENAME, WatchlistDraftFilePolicy.INSTANCE.filename(metadata()));
        assertEquals("application/json", WatchlistDraftFilePolicy.INSTANCE.getMimeType());
        assertEquals(266240, WatchlistDraftFilePolicy.INSTANCE.getMaxBytes());
        assertTrue(WatchlistDraftFilePolicy.INSTANCE.acceptsText(FILENAME, content()));
        assertEquals(FILENAME, WatchlistDraftFilePolicy.INSTANCE.filename(metadata().put("baseVersion", 0)));
        assertEquals(FILENAME, WatchlistDraftFilePolicy.INSTANCE.filename(metadata().put("baseVersion", 9007199254740991L)));
        assertEquals(FOLLOWUPS_FILENAME, FollowupsDraftFilePolicy.INSTANCE.filename(metadata()));
        assertEquals("application/json", FollowupsDraftFilePolicy.INSTANCE.getMimeType());
        assertEquals(266240, FollowupsDraftFilePolicy.INSTANCE.getMaxBytes());
        assertTrue(FollowupsDraftFilePolicy.INSTANCE.acceptsText(FOLLOWUPS_FILENAME,
            portfolioContent().replace("investment-portfolio-draft", "investment-followups-draft")));
        assertEquals(PORTFOLIO_FILENAME, PortfolioDraftFilePolicy.INSTANCE.filename(metadata()));
        assertEquals("application/json", PortfolioDraftFilePolicy.INSTANCE.getMimeType());
        assertEquals(266240, PortfolioDraftFilePolicy.INSTANCE.getMaxBytes());
        assertTrue(PortfolioDraftFilePolicy.INSTANCE.acceptsText(PORTFOLIO_FILENAME, portfolioContent()));
        assertEquals(PORTFOLIO_FILENAME, PortfolioDraftFilePolicy.INSTANCE.filename(metadata().put("baseVersion", 0)));
        assertEquals(PORTFOLIO_FILENAME, PortfolioDraftFilePolicy.INSTANCE.filename(metadata().put("baseVersion", 9007199254740991L)));
    }

    @Test
    public void rejectsCallerFilenameUnknownMetadataAndInvalidBaseVersions() throws Exception {
        assertNull(WatchlistDraftFilePolicy.INSTANCE.filename(metadata().put("filename", "private.json")));
        assertNull(WatchlistDraftFilePolicy.INSTANCE.filename(metadata().put("version", 3)));
        assertNull(PortfolioDraftFilePolicy.INSTANCE.filename(metadata().put("filename", "private.json")));
        assertNull(FollowupsDraftFilePolicy.INSTANCE.filename(metadata().put("filename", "private.json")));
        assertNull(FollowupsDraftFilePolicy.INSTANCE.filename(metadata().put("version", 1)));
        assertNull(PortfolioDraftFilePolicy.INSTANCE.filename(metadata().put("version", 3)));
        JSONObject missingOperation = metadata();
        missingOperation.remove("operationId");
        assertNull(PortfolioDraftFilePolicy.INSTANCE.filename(missingOperation));
        assertNull(FollowupsDraftFilePolicy.INSTANCE.filename(missingOperation));
        for (Object value : new Object[] { -1, 0.5, 9007199254740992L, "3", JSONObject.NULL }) {
            assertNull(WatchlistDraftFilePolicy.INSTANCE.filename(metadata().put("baseVersion", value)));
            assertNull(PortfolioDraftFilePolicy.INSTANCE.filename(metadata().put("baseVersion", value)));
            assertNull(FollowupsDraftFilePolicy.INSTANCE.filename(metadata().put("baseVersion", value)));
        }
    }

    @Test
    public void validatesRealUtcCalendarTimeWithoutNormalizingTheName() throws Exception {
        for (String value : new String[] {
            "2026-02-29T18:00:00.000Z", "2026-10-18T24:00:00.000Z",
            "2026-10-18T18:60:00.000Z", "2026-10-18T18:00:60.000Z",
            "2026-10-18T18:00:00Z", "2026-10-18T18:00:00.000+00:00", "../private"
        }) {
            assertNull(WatchlistDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt", value)));
            assertNull(PortfolioDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt", value)));
            assertNull(FollowupsDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt", value)));
        }
        assertEquals("Investment-watchlist-draft-2028-02-29T18-00-00-000Z.json",
            WatchlistDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt", "2028-02-29T18:00:00.000Z")));
        assertEquals("Investment-followups-draft-2028-02-29T18-00-00-000Z.json",
            FollowupsDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt", "2028-02-29T18:00:00.000Z")));
        assertEquals("Investment-portfolio-draft-2028-02-29T18-00-00-000Z.json",
            PortfolioDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt", "2028-02-29T18:00:00.000Z")));
    }

    @Test
    public void rejectsDifferentFramingAndFilenameBeforeWriting() {
        String current = content();
        for (String value : new String[] {
            current.replace("investment-watchlist-draft", "saved-watchlist"),
            current.replace("\"version\":1", "\"version\":2"),
            current.replace("\"baseVersion\":3", "\"baseVersion\":-1"),
            current.replace("\"baseVersion\":3", "\"baseVersion\":3.5"),
            current.replace(SCOPE, "foreign"), current.replace(TIME, "2026-10-19T18:00:00.000Z"),
            current.replace("\"draft\":{", "\"draft\":[] ,\"other\": {"),
            current.replace("\"version\":1", "\"version\":1,\"version\":1"),
            current.replace("\"version\":1", "\"version\":1,\"extra\":true"), current + "{}"
        }) {
            assertFalse(WatchlistDraftFilePolicy.INSTANCE.acceptsText(FILENAME, value));
            assertFalse(PortfolioDraftFilePolicy.INSTANCE.acceptsText(PORTFOLIO_FILENAME,
                value.replace("investment-watchlist-draft", "investment-portfolio-draft")));
            assertFalse(FollowupsDraftFilePolicy.INSTANCE.acceptsText(FOLLOWUPS_FILENAME,
                value.replace("investment-watchlist-draft", "investment-followups-draft")));
        }
        assertFalse(WatchlistDraftFilePolicy.INSTANCE.acceptsText("../private.json", current));
        assertFalse(PortfolioDraftFilePolicy.INSTANCE.acceptsText("../private.json", portfolioContent()));
        assertFalse(PortfolioDraftFilePolicy.INSTANCE.acceptsText(PORTFOLIO_FILENAME, current));
        assertFalse(FollowupsDraftFilePolicy.INSTANCE.acceptsText(FOLLOWUPS_FILENAME, current));
        assertFalse(FollowupsDraftFilePolicy.INSTANCE.acceptsText(FOLLOWUPS_FILENAME, portfolioContent()));
        assertFalse(FollowupsDraftFilePolicy.INSTANCE.acceptsText("../private.json",
            portfolioContent().replace("investment-portfolio-draft", "investment-followups-draft")));
        for (String draft : new String[] { "[]", "null", "\"raw\"", "1" }) {
            String value = "{\"format\":\"investment-portfolio-draft\",\"version\":1,"
                + "\"accountScope\":\"" + SCOPE + "\",\"capturedAt\":\"" + TIME + "\","
                + "\"baseVersion\":3,\"draft\":" + draft + "}";
            assertFalse(PortfolioDraftFilePolicy.INSTANCE.acceptsText(PORTFOLIO_FILENAME, value));
            assertFalse(FollowupsDraftFilePolicy.INSTANCE.acceptsText(FOLLOWUPS_FILENAME,
                value.replace("investment-portfolio-draft", "investment-followups-draft")));
        }
    }

    @Test
    public void inheritedWriterEncodingRejectsOversizeAndMalformedUtf16() {
        assertEquals(3, ChosenDocumentPolicyKt.strictDocumentBytes("零", 3).length);
        int maximum = PortfolioDraftFilePolicy.INSTANCE.getMaxBytes();
        String ascii = portfolioContent().replace("零 café 😀", "raw");
        String exactLimit = ascii + " ".repeat(maximum - ascii.length());
        assertTrue(PortfolioDraftFilePolicy.INSTANCE.acceptsText(PORTFOLIO_FILENAME, exactLimit));
        String followups = exactLimit.replace("investment-portfolio-draft", "investment-followups-draft");
        assertTrue(FollowupsDraftFilePolicy.INSTANCE.acceptsText(FOLLOWUPS_FILENAME, followups));
        assertFalse(FollowupsDraftFilePolicy.INSTANCE.acceptsText(FOLLOWUPS_FILENAME, followups + " "));
        assertEquals(maximum, ChosenDocumentPolicyKt.strictDocumentBytes(exactLimit, maximum).length);
        assertFalse(PortfolioDraftFilePolicy.INSTANCE.acceptsText(PORTFOLIO_FILENAME, exactLimit + " "));
        for (String value : new String[] { exactLimit + " ", "零".repeat(maximum / 3 + 1), "\ud800" }) {
            try {
                ChosenDocumentPolicyKt.strictDocumentBytes(value, maximum);
                fail("Expected Portfolio writer byte or UTF-16 refusal");
            } catch (Exception expected) {
                // The common writer rejects these bytes before opening the chosen stream.
            }
        }
        for (String value : new String[] { "零零", "\ud800" }) {
            try {
                ChosenDocumentPolicyKt.strictDocumentBytes(value, 3);
                fail("Expected bounded UTF-8 refusal");
            } catch (Exception expected) {
                // No provider output stream is opened before the shared encoder succeeds.
            }
        }
    }
}
