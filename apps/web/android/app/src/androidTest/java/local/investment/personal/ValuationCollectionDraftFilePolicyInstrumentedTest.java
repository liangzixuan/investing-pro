package local.investment.personal;

import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.nio.charset.StandardCharsets;

/** Native framing and actual-byte limits; the shared collection codec owns nested domain admission. */
@RunWith(AndroidJUnit4.class)
public class ValuationCollectionDraftFilePolicyInstrumentedTest {
    private static final String TIME="2026-10-29T18:00:00.000Z";
    private static final String NAME="Investment-valuation-collection-draft-2026-10-29T18-00-00-000Z.json";
    private static final String SCOPE="sha256:"+"a".repeat(64);
    private JSONObject metadata() throws Exception {
        return new JSONObject().put("operationId","aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee").put("capturedAt",TIME);
    }
    private String content() {
        return "{\"format\":\"investment-valuation-collection-draft\",\"version\":1,\"accountScope\":\""+SCOPE+"\",\"capturedAt\":\""+TIME+"\",\"payload\":{\"schemaVersion\":1,\"entries\":[]}}\n";
    }
    @Test public void derivesFixedCollectionFilenameAndKeepsEditorPolicy() throws Exception {
        assertEquals(NAME,ValuationCollectionDraftFilePolicy.INSTANCE.filename(metadata()));
        assertEquals("application/json",ValuationCollectionDraftFilePolicy.INSTANCE.getMimeType());
        assertEquals(262347,ValuationCollectionDraftFilePolicy.INSTANCE.getMaxBytes());
        assertTrue(ValuationCollectionDraftFilePolicy.INSTANCE.acceptsText(NAME,content()));
        assertEquals(131072,ValuationDraftFilePolicy.INSTANCE.getMaxBytes());
        assertEquals("Investment-valuation-inputs-draft-2026-10-29T18-00-00-000Z.json",ValuationDraftFilePolicy.INSTANCE.filename(metadata()));
        assertFalse(ValuationDraftFilePolicy.INSTANCE.acceptsText(NAME,content()));
    }
    @Test public void rejectsUnknownMetadataAndInvalidUtcDates() throws Exception {
        for(String key:new String[]{"filename","baseVersion","version","payload"})
            assertNull(ValuationCollectionDraftFilePolicy.INSTANCE.filename(metadata().put(key,"private")));
        for(String key:new String[]{"operationId","capturedAt"}) {
            JSONObject value=metadata();value.remove(key);assertNull(ValuationCollectionDraftFilePolicy.INSTANCE.filename(value));
        }
        for(String time:new String[]{"2026-02-29T18:00:00.000Z","2026-10-29T24:00:00.000Z","2026-10-29T18:60:00.000Z","2026-10-29T18:00:60.000Z","2026-10-29T18:00:00Z","2026-10-29T18:00:00.000+00:00","../private"})
            assertNull(ValuationCollectionDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt",time)));
        assertEquals("Investment-valuation-collection-draft-2028-02-29T18-00-00-000Z.json",ValuationCollectionDraftFilePolicy.INSTANCE.filename(metadata().put("capturedAt","2028-02-29T18:00:00.000Z")));
    }
    @Test public void rejectsWrongEnvelopeBeforeDestinationWrite() {
        String text=content();
        for(String value:new String[]{
            text.replace("investment-valuation-collection-draft","investment-valuation-inputs-draft"),
            text.replace("\"version\":1","\"version\":2"),text.replace("\"version\":1","\"version\":1.0"),
            text.replace("\"version\":1","\"version\":1,\"version\":1"),
            text.replace("\"version\":1","\"version\":1,\"ver\\u0073ion\":1"),
            text.replace("\"version\":1","\"version\":1,\"baseVersion\":7"),
            text.replace("\"payload\":{","\"entry\":{"),text.replace(SCOPE,"foreign"),
            text.replace(TIME,"2026-10-30T18:00:00.000Z"),text+"{}"
        }) assertFalse(value,ValuationCollectionDraftFilePolicy.INSTANCE.acceptsText(NAME,value));
        for(String payload:new String[]{"[]","null","\"raw\"","1"})
            assertFalse(ValuationCollectionDraftFilePolicy.INSTANCE.acceptsText(NAME,text.replace("{\"schemaVersion\":1,\"entries\":[]}",payload)));
        assertFalse(ValuationCollectionDraftFilePolicy.INSTANCE.acceptsText("../private.json",text));
    }
    @Test public void enforcesActualUtf8ByteLimitWithoutClipping() throws Exception {
        int cap=ValuationCollectionDraftFilePolicy.INSTANCE.getMaxBytes();
        String exact=content()+" ".repeat(cap-content().getBytes(StandardCharsets.UTF_8).length);
        assertTrue(ValuationCollectionDraftFilePolicy.INSTANCE.acceptsText(NAME,exact));
        assertEquals(cap,ChosenDocumentPolicyKt.strictDocumentBytes(exact,cap).length);
        assertFalse(ValuationCollectionDraftFilePolicy.INSTANCE.acceptsText(NAME,exact+" "));
        for(String text:new String[]{exact+" ","零".repeat(cap/3+1),"\ud800","\udc00"}) {
            try {ChosenDocumentPolicyKt.strictDocumentBytes(text,cap);fail("Invalid or over-cap text must be refused before opening the destination");}
            catch(Exception expected) { assertTrue(expected instanceof IllegalArgumentException || expected instanceof java.nio.charset.CharacterCodingException); }
        }
        String unicode=content().replace("\"entries\":[]","\"raw\":\"  Café 東京 📈  \",\"entries\":[]");
        byte[] bytes=ChosenDocumentPolicyKt.strictDocumentBytes(unicode,cap);
        assertEquals(unicode,new String(bytes,StandardCharsets.UTF_8));
    }
}
