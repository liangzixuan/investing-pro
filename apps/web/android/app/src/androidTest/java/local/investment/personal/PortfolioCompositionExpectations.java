package local.investment.personal;

import org.json.JSONArray;
import org.json.JSONObject;

/** Independent complete invented resource expectations; no product formatter/projection used. */
final class PortfolioCompositionExpectations {
    static final String QUESTION="Does Class C still fit this dated composition? Café 東京 📈";
    static final String DUE="2027-01-31";
    static final String EXACT="function same(a,b){if(a===b)return true;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;"+
        "if(Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}";
    enum Share { RETAINED, A, C }
    static JSONObject listing(Share share) throws Exception {
        return new JSONObject(switch(share) {
            case RETAINED -> "{\"country\":\"US\",\"exchangeMic\":\"XNAS\",\"instrumentType\":\"common_stock\",\"issuerId\":\"issuer-alfa\",\"issuerName\":\"Alfa Company\",\"listingId\":\"listing-alfa\",\"securityId\":\"security-alfa\",\"securityName\":\"Alfa Common Stock\",\"shareClassId\":\"class-alfa\",\"shareClassName\":\"Common Stock\",\"symbol\":\"ALFA\"}";
            case A -> "{\"country\":\"US\",\"exchangeMic\":\"XNAS\",\"instrumentType\":\"common_stock\",\"issuerId\":\"issuer-zero\",\"issuerName\":\"Zero Company\",\"listingId\":\"listing-zero\",\"securityId\":\"security-zero\",\"securityName\":\"Zero Class A\",\"shareClassId\":\"class-zero\",\"shareClassName\":\"Class A\",\"symbol\":\"ZERO\"}";
            case C -> "{\"country\":\"US\",\"exchangeMic\":\"XNAS\",\"instrumentType\":\"common_stock\",\"issuerId\":\"issuer-zero\",\"issuerName\":\"Zero Company\",\"listingId\":\"listing-zero-c\",\"securityId\":\"security-zero-c\",\"securityName\":\"Zero Class C\",\"shareClassId\":\"class-zero-c\",\"shareClassName\":\"Class C\",\"symbol\":\"ZERO.C\"}";
        });
    }
    static JSONObject ledger() throws Exception {
        JSONObject first=new JSONObject().put("listingId","listing-zero").put("shares","2.000000").put("totalCostBasisUsd","40.00").put("confirmedOn","2026-10-02");
        JSONObject second=new JSONObject().put("listingId","listing-zero-c").put("shares","1.000000").put("totalCostBasisUsd",JSONObject.NULL).put("confirmedOn","2026-10-03");
        return new JSONObject().put("schemaVersion",3).put("name","My Portfolio").put("currency","USD")
            .put("snapshotSha256","sha256:"+"a".repeat(64)).put("basisMethod","fifo_with_opening_pool")
            .put("identities",new JSONArray().put(listing(Share.A)).put(listing(Share.C)))
            .put("opening",new JSONObject().put("asOfDate","2026-10-04").put("cashUsd","100.00").put("holdings",new JSONArray().put(first).put(second)))
            .put("transactions",new JSONArray());
    }
    static JSONObject composition() throws Exception {
        return new JSONObject().put("status","available").put("reason",JSONObject.NULL).put("totalValueUsd","200.00")
            .put("cashUsd","100.00").put("cashPercent","50.00")
            .put("method","displayed_usd_cents_over_complete_total_percent_half_up_2dp")
            .put("holdings",new JSONArray()
                .put(new JSONObject().put("listingId","listing-zero").put("valueUsd","50.00").put("percent","25.00"))
                .put(new JSONObject().put("listingId","listing-zero-c").put("valueUsd","50.00").put("percent","25.00")));
    }
    static JSONObject followups(String id) throws Exception {
        String digest="sha256:"+"a".repeat(64);
        JSONObject retained=new JSONObject().put("id","10000000-0000-4000-8000-000000000001").put("listing",listing(Share.RETAINED))
            .put("catalogSnapshotSha256",digest).put("check","Keep this earlier ALFA assessment in original resource order.")
            .put("dueOn","2026-10-01").put("status","completed").put("completedOn","2026-10-04")
            .put("result","Original invented assessment Café 東京 remains complete.");
        JSONObject created=new JSONObject().put("id",id).put("listing",listing(Share.C)).put("catalogSnapshotSha256",digest)
            .put("check",QUESTION).put("dueOn",DUE).put("status","open").put("completedOn",JSONObject.NULL).put("result","");
        return new JSONObject().put("schemaVersion",1).put("entries",new JSONArray().put(retained).put(created));
    }
}
