package local.investment.personal;

import java.util.Set;
import org.json.JSONObject;

/** Failure-only, closed metadata for the isolated invented report page. */
final class ReportRevisitReadObservation {
    private static final int MAX_OBSERVATION_BYTES = 8 * 1024;
    private static final String INVENTED_NAME = "Investment-research-ZERO-XNAS-20261015T000000000Z.json";
    private static final Set<String> NAMES = Set.of("", "other", INVENTED_NAME);
    private static final Set<String> TYPES = Set.of("", "other", "application/json", "text/plain");
    private static final String FLAGS = "rootPresent outerPresent outerOpen companyHeadingExpected headingPresent headingExpected archivePresent currentPresent notePresent annualProvenancePresent sourceCikPresent preparedAtPresent sourceCompletedAtPresent appendixPresent observationFailed";
    private static final String COUNTERS = "load status annual eod filings save resolve marketsResolve marketsEod token signOut";
    private static final String SCRIPT = """
        );let observation;
        try {
          const key='__reportRevisitReadObservation';
          if (!window[key]) {
            const state={events:0,count:0,nonzero:false,name:'',type:'',size:0};
            window[key]=state;
            document.addEventListener('change',event=>{
              try {
                const input=event.target;
                if (!(input instanceof HTMLInputElement) || !input.matches('.managed-report-revisit input[type=file]')) return;
                const files=input.files, file=files?.[0];
                state.events=Math.min(32,state.events+1);
                state.count=Math.min(8,files?.length??0);
                state.nonzero=state.count>0;
                state.name=file ? (file.name==='Investment-research-ZERO-XNAS-20261015T000000000Z.json' ? file.name : 'other') : '';
                state.type=file ? (['','application/json','text/plain'].includes(file.type) ? file.type : 'other') : '';
                state.size=file && Number.isSafeInteger(file.size) && file.size>=0 && file.size<=2147483647 ? file.size : -1;
              } catch { state.events=-1; }
            },{capture:true,passive:true});
          }
          const report=document.querySelector('.managed-company-report');
          const outer=document.querySelector('.managed-report-revisit');
          const section=document.querySelector('[aria-label="Archived report"]');
          const text=section?.textContent??'';
          const note=section?.querySelector('.managed-company-report-note');
          const heading=document.querySelector('#managed-report-revisit-heading');
          const status=outer?.querySelector('[role=status]')?.textContent??'';
          const messages=['','Reading selected report…','File accepted for this company. Its contents and claims remain unverified.',
            'Select a complete format 5 company report JSON for this exact company. The file was not accepted.',
            'The company, source or draft changed. Capture the current report and preview again.',
            'Open this company with a current Watchlist draft before selecting a report.'];
          const number=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000 ? value : -1;
          let fixture={};
          try {fixture=JSON.parse(document.querySelector('#fixture-diagnostics')?.textContent??'{}');} catch {}
          const counters={};
          for (const key of ['load','status','annual','eod','filings','save','resolve','marketsResolve','marketsEod','token','signOut']) counters[key]=number(fixture[key]);
          const input=outer?.querySelector('input[type=file]');
          observation={rootPresent:!!report,outerPresent:!!outer,outerOpen:outer?.open===true,
            companyHeadingExpected:document.querySelector('#managed-company-heading')?.textContent==='Company research · ZERO',
            headingPresent:!!heading,headingExpected:heading?.textContent==='Reopened report · ZERO',
            archivePresent:!!section,currentPresent:!!document.querySelector('[aria-label="Current report capture"]'),
            notePresent:!!note,noteLength:Math.min(16384,note?.textContent?.length??0),
            annualProvenancePresent:!!document.querySelector('[aria-label="Archived report annual provenance"]'),
            sourceCikPresent:text.includes('0000000001'),preparedAtPresent:text.includes('2026-10-15T00:00:00.000Z'),
            sourceCompletedAtPresent:text.includes('2026-09-20T00:00:02.000Z'),
            identityMask:['US','XNAS','common_stock','issuer-zero','Zero Company','listing-zero','security-zero','Zero Class A','class-zero','Class A','ZERO'].reduce((mask,value,index)=>mask|(text.includes(value)?1<<index:0),0),
            appendixPresent:!!outer?.querySelector('textarea[readonly]'),statusCode:messages.indexOf(status),
            inputCount:Math.min(8,input?.files?.length??0),inputValueEmpty:input?.value==='',
            observationFailed:false,counters,file:window[key]};
        } catch { observation={observationFailed:true}; }
        return {passed,observation};})()
        """;
    record Result(boolean passed, String observation) {}
    private ReportRevisitReadObservation() {}
    static String wrap(String predicate) { return "(()=>{const passed=Boolean(" + predicate + SCRIPT; }
    static Result decode(String value) {
        try {
            JSONObject result = new JSONObject(value);
            Object passed = result.get("passed");
            if (!(passed instanceof Boolean)) return new Result(false, "invalid passed field");
            return new Result((Boolean)passed, safeObservation(result.optJSONObject("observation")));
        } catch (Exception invalid) {
            return new Result(false, "invalid callback object");
        }
    }
    private static String safeObservation(JSONObject source) {
        try {
            if (source == null) return "missing observation";
            if (source.opt("observationFailed") == Boolean.TRUE) return "observation failed";
            JSONObject safe = new JSONObject();
            for (String key : FLAGS.split(" ")) copyBoolean(source, safe, key);
            copyInteger(source, safe, "noteLength", 0, 16384);
            copyInteger(source, safe, "identityMask", 0, 2047);
            copyInteger(source, safe, "statusCode", -1, 5);
            copyInteger(source, safe, "inputCount", 0, 8);
            copyBoolean(source, safe, "inputValueEmpty");
            safe.put("counters", safeCounters(source.getJSONObject("counters")));
            safe.put("file", safeFile(source.getJSONObject("file")));
            String text = safe.toString();
            if (text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_OBSERVATION_BYTES)
                return "observation exceeded bound";
            return text;
        } catch (Exception invalid) {
            return "invalid observation fields";
        }
    }
    private static JSONObject safeCounters(JSONObject source) throws Exception {
        JSONObject safe = new JSONObject();
        for (String key : COUNTERS.split(" ")) copyInteger(source, safe, key, -1, 1000000);
        return safe;
    }
    private static JSONObject safeFile(JSONObject source) throws Exception {
        JSONObject safe = new JSONObject();
        copyInteger(source, safe, "events", -1, 32);
        copyInteger(source, safe, "count", 0, 8);
        copyInteger(source, safe, "size", -1, Integer.MAX_VALUE);
        copyBoolean(source, safe, "nonzero");
        Object name = source.get("name"), type = source.get("type");
        if (!NAMES.contains(name)) throw new IllegalArgumentException();
        if (!TYPES.contains(type)) throw new IllegalArgumentException();
        safe.put("name", name);
        safe.put("type", type);
        return safe;
    }
    private static void copyBoolean(JSONObject source, JSONObject target, String key) throws Exception {
        Object value = source.get(key);
        if (!(value instanceof Boolean)) throw new IllegalArgumentException();
        target.put(key, value);
    }
    private static void copyInteger(JSONObject source, JSONObject target, String key, long minimum, long maximum) throws Exception {
        Object value = source.get(key);
        if (!(value instanceof Number)) throw new IllegalArgumentException();
        double number = ((Number)value).doubleValue();
        if (!Double.isFinite(number) || number != Math.rint(number) || number < minimum || number > maximum)
            throw new IllegalArgumentException();
        target.put(key, ((Number)value).longValue());
    }
}
