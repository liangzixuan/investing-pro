package local.investment.personal;
import static org.junit.Assert.*;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Object keys are unordered; arrays and raw values remain exact. */
final class PortfolioReportComparisonExpectations {
    static void assertWholeJson(Object expected,Object actual) throws Exception {
        if(expected instanceof JSONObject a&&actual instanceof JSONObject b){
            Set<String> left=keys(a),right=keys(b);assertEquals(left,right);
            for(String key:left)assertWholeJson(a.get(key),b.get(key));
        }else if(expected instanceof JSONArray a&&actual instanceof JSONArray b){
            assertEquals(a.length(),b.length());
            for(int i=0;i<a.length();i++)assertWholeJson(a.get(i),b.get(i));
        }else assertEquals(expected,actual);
    }
    private static Set<String> keys(JSONObject o){Set<String> result=new HashSet<>();Iterator<String> i=o.keys();while(i.hasNext())result.add(i.next());return result;}
    static JSONObject sourceRow(JSONObject report,String id) throws Exception {
        JSONArray rows=report.getJSONArray("sourceRows");
        for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);if(r.getJSONObject("holding").getJSONObject("identity").getString("listingId").equals(id))return r;}
        return null;
    }
    static JSONObject compositionRow(JSONObject report,String id) throws Exception {
        JSONArray rows=report.getJSONObject("review").getJSONObject("composition").getJSONArray("holdings");
        for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);if(r.getString("listingId").equals(id))return r;}
        throw new AssertionError("Complete composition row missing: "+id);
    }
}
