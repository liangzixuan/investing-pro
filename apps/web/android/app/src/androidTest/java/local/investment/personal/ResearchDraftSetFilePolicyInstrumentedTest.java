package local.investment.personal;

import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.nio.charset.StandardCharsets;

/** Native framing/scope coherence and real byte boundaries; shared codecs own nested domain admission. */
@RunWith(AndroidJUnit4.class)
public class ResearchDraftSetFilePolicyInstrumentedTest {
    private static final String TIME="2026-10-30T03:00:00.000Z";
    private static final String NAME="Investment-research-draft-set-2026-10-30T03-00-00-000Z.json";
    private static final String SCOPE="sha256:"+"a".repeat(64);
    private JSONObject metadata() throws Exception {return new JSONObject().put("operationId","aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee").put("capturedAt",TIME);}
    private JSONObject member(String key) throws Exception {
        JSONObject payload;
        if(key.equals("watchlist"))payload=new JSONObject().put("schemaVersion",1).put("name","My Watchlist").put("snapshotSha256",SCOPE).put("memberships",new JSONArray());
        else if(key.equals("portfolio"))payload=new JSONObject().put("schemaVersion",3).put("name","My Portfolio").put("currency","USD").put("snapshotSha256",SCOPE).put("basisMethod","fifo_with_opening_pool").put("identities",new JSONArray()).put("opening",new JSONObject().put("asOfDate","2000-01-01").put("cashUsd","1.00").put("holdings",new JSONArray())).put("transactions",new JSONArray());
        else payload=new JSONObject().put("schemaVersion",1).put("entries",new JSONArray());
        JSONObject content=new JSONObject().put("format",key.equals("valuation")?"investment-valuation-collection-draft":"investment-"+key+"-draft").put("version",1).put("accountScope",SCOPE).put("capturedAt","2026-10-29T18:00:00.000Z");
        if(key.equals("valuation"))content.put("payload",payload);else content.put("baseVersion",3).put("draft",payload);
        return content;
    }
    private JSONObject content() throws Exception {
        JSONObject members=new JSONObject();for(String key:new String[]{"watchlist","portfolio","followups","valuation"})members.put(key,member(key));
        return new JSONObject().put("format","investment-research-draft-set").put("version",1).put("accountScope",SCOPE).put("capturedAt",TIME).put("members",members).put("omitted",new JSONArray());
    }
    private boolean accepts(JSONObject content){return ResearchDraftSetFilePolicy.INSTANCE.acceptsText(NAME,content.toString()+"\n");}
    @Test public void admitsFullAndSelectedInventoryWithFixedMetadata() throws Exception {
        assertEquals(NAME,ResearchDraftSetFilePolicy.INSTANCE.filename(metadata()));assertEquals("application/json",ResearchDraftSetFilePolicy.INSTANCE.getMimeType());
        JSONObject frame=content();for(String key:new String[]{"watchlist","portfolio","followups","valuation"})frame.getJSONObject("members").put(key,JSONObject.NULL);int framingBytes=(frame.toString()+"\n").getBytes(StandardCharsets.UTF_8).length;assertEquals(277,framingBytes);
        assertEquals(3*266240+262347+framingBytes-16-4,ResearchDraftSetFilePolicy.INSTANCE.getMaxBytes());assertEquals(1061324,ResearchDraftSetFilePolicy.INSTANCE.getMaxBytes());assertTrue(accepts(content()));
        JSONObject subset=content();subset.getJSONObject("members").put("watchlist",JSONObject.NULL).put("portfolio",JSONObject.NULL).put("followups",JSONObject.NULL);subset.put("omitted",new JSONArray().put("watchlist").put("portfolio").put("followups"));assertTrue(accepts(subset));
        assertEquals(262347,ValuationCollectionDraftFilePolicy.INSTANCE.getMaxBytes());assertEquals(131072,ValuationDraftFilePolicy.INSTANCE.getMaxBytes());
    }
    @Test public void rejectsInvalidMetadataTimeAndEnvelope() throws Exception {
        for(String key:new String[]{"filename","baseVersion","version","accountScope"})assertNull(ResearchDraftSetFilePolicy.INSTANCE.filename(metadata().put(key,"unexpected")));
        for(String key:new String[]{"operationId","capturedAt"}){JSONObject value=metadata();value.remove(key);assertNull(ResearchDraftSetFilePolicy.INSTANCE.filename(value));}
        for(String time:new String[]{"2026-02-29T03:00:00.000Z","2026-10-30T24:00:00.000Z","2026-10-30T03:60:00.000Z","2026-10-30T03:00:60.000Z","2026-10-30T03:00:00Z","2026-10-30T03:00:00.000+00:00","../private"})assertNull(ResearchDraftSetFilePolicy.INSTANCE.filename(metadata().put("capturedAt",time)));
        assertEquals("Investment-research-draft-set-2028-02-29T03-00-00-000Z.json",ResearchDraftSetFilePolicy.INSTANCE.filename(metadata().put("capturedAt","2028-02-29T03:00:00.000Z")));
        String text=content().toString();
        for(String value:new String[]{text.replace("investment-research-draft-set","investment-watchlist-draft"),text.replace("\"version\":1","\"version\":2"),text.replace("\"version\":1","\"version\":1.0"),text.replace("\"version\":1","\"version\":1,\"ver\\u0073ion\":1"),text.replace("\"omitted\":[]","\"omitted\":[],\"extra\":true"),text+"{}"})assertFalse(ResearchDraftSetFilePolicy.INSTANCE.acceptsText(NAME,value));
        assertFalse(ResearchDraftSetFilePolicy.INSTANCE.acceptsText("../private.json",text));assertFalse(accepts(content().put("capturedAt","2026-10-31T03:00:00.000Z")));
    }
    @Test public void rejectsNestedScopeShapeAndOmissionContradictions() throws Exception {
        JSONObject mismatch=content();mismatch.getJSONObject("members").getJSONObject("portfolio").put("accountScope","sha256:"+"b".repeat(64));assertFalse(accepts(mismatch));
        for(String key:new String[]{"watchlist","portfolio","followups","valuation"}){
            JSONObject wrong=content();wrong.getJSONObject("members").getJSONObject(key).put("format","unsupported");assertFalse(accepts(wrong));
            wrong=content();wrong.getJSONObject("members").getJSONObject(key).put("extra",true);assertFalse(accepts(wrong));
            wrong=content();wrong.getJSONObject("members").getJSONObject(key).put("capturedAt","2026-02-29T03:00:00.000Z");assertFalse(accepts(wrong));
            wrong=content();wrong.getJSONObject("members").put(key,"nested strings are refused");assertFalse(accepts(wrong));
        }
        JSONObject missing=content();missing.getJSONObject("members").remove("valuation");assertFalse(accepts(missing));
        JSONObject unknown=content();unknown.getJSONObject("members").put("unknown",JSONObject.NULL);assertFalse(accepts(unknown));
        assertFalse(accepts(content().put("omitted",new JSONArray().put("watchlist"))));
        JSONObject empty=content();for(String key:new String[]{"watchlist","portfolio","followups","valuation"})empty.getJSONObject("members").put(key,JSONObject.NULL);empty.put("omitted",new JSONArray().put("watchlist").put("portfolio").put("followups").put("valuation"));assertFalse(accepts(empty));
        JSONObject wrongOrder=content();wrongOrder.getJSONObject("members").put("watchlist",JSONObject.NULL).put("portfolio",JSONObject.NULL);wrongOrder.put("omitted",new JSONArray().put("portfolio").put("watchlist"));assertFalse(accepts(wrongOrder));
        JSONObject wrongBase=content();wrongBase.getJSONObject("members").getJSONObject("portfolio").put("baseVersion",-1);assertFalse(accepts(wrongBase));
        JSONObject duplicate=content();String value=duplicate.toString().replace("\"baseVersion\":3","\"baseVersion\":3,\"baseVersion\":3");assertFalse(ResearchDraftSetFilePolicy.INSTANCE.acceptsText(NAME,value));
    }
    @Test public void enforcesWholeFileActualUtf8BoundWithoutClipping() throws Exception {
        int cap=ResearchDraftSetFilePolicy.INSTANCE.getMaxBytes();String text=content()+"\n";String exact=text+" ".repeat(cap-text.getBytes(StandardCharsets.UTF_8).length);
        assertTrue(ResearchDraftSetFilePolicy.INSTANCE.acceptsText(NAME,exact));assertEquals(cap,ChosenDocumentPolicyKt.strictDocumentBytes(exact,cap).length);
        for(String value:new String[]{exact+" ","零".repeat(cap/3+1),"\ud800","\udc00"}){
            try{ChosenDocumentPolicyKt.strictDocumentBytes(value,cap);fail("Invalid or oversized text must be refused before opening the destination");}catch(Exception expected){assertTrue(expected instanceof IllegalArgumentException||expected instanceof java.nio.charset.CharacterCodingException);}
        }
        assertFalse(ResearchDraftSetFilePolicy.INSTANCE.acceptsText(NAME," ".repeat(cap+1)));assertEquals(text,new String(ChosenDocumentPolicyKt.strictDocumentBytes(text,cap),StandardCharsets.UTF_8));
    }
}
