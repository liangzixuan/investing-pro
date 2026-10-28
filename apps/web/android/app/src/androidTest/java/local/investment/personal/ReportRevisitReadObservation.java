package local.investment.personal;

import java.util.Set;
import org.json.JSONObject;

/** Failure-only, closed metadata for the isolated invented report page. */
final class ReportRevisitReadObservation {
    private static final int MAX_OBSERVATION_BYTES = 8 * 1024;
    private static final String INVENTED_NAME = "Investment-research-ZERO-XNAS-20261015T000000000Z.json";
    private static final Set<String> NAMES = Set.of("", "other", INVENTED_NAME);
    private static final Set<String> TYPES = Set.of("", "other", "application/json", "text/plain");
    private static final Set<String> WRITER_PHASES = Set.of("missing", "idle", "preparing", "choosing", "written", "cancelled", "failed");
    private static final Set<String> WRITER_NAMES = Set.of("", INVENTED_NAME);
    private static final String FLAGS = "rootPresent outerPresent outerOpen companyHeadingExpected headingPresent headingExpected archivePresent currentPresent notePresent annualProvenancePresent sourceCikPresent preparedAtPresent sourceCompletedAtPresent appendixPresent observationFailed";
    private static final String COUNTERS = "load status annual eod filings save resolve marketsResolve marketsEod token signOut";
    private static final String SYNTHETIC_FACTS = """
        (() => {
          try {
            if (location.origin !== 'https://localhost' ||
                document.querySelector('meta[name="investment-android-test"]')?.content !== 'managed-workspace') return null;
            const scenario = document.querySelector('meta[name="investment-android-test-scenario"]')?.content;
            if (!['reviewed-company-source-pass','valuation-scenario-followup'].includes(scenario)) return null;
            const read = id => {
              const text = document.getElementById(id)?.textContent;
              if (typeof text !== 'string' || text.length > 262144) return null;
              const value = JSON.parse(text);
              return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
            };
            const code = (value, allowed) => allowed.includes(value) ? value : 'other';
            const sourceNames = ['eod','annual','filings','interim'];
            const route = (() => {
              if (location.pathname !== '/' || location.hash !== '') return 'other';
              const p = new URLSearchParams(location.search);
              if ([...p.keys()].length === 0) return 'root';
              if ([...p.keys()].length !== 2 || p.getAll('company').length !== 1 ||
                  p.get('company') !== 'listing-zero' || p.getAll('section').length !== 1) return 'other';
              return ({annual:'company_annual',interim:'company_interim',price:'company_price',filings:'company_filings'})[p.get('section')] ?? 'other';
            })();
            if (scenario === 'reviewed-company-source-pass') {
              const evidence = read('fixture-company-pass-evidence');
              const pass = evidence?.pass;
              if (!pass || !Array.isArray(pass.rows) || pass.rows.length > 4) return null;
              const names = pass.preview === null ? [] : pass.preview?.names;
              if (!Array.isArray(names) || names.length > 4) return null;
              const choices = [...document.querySelectorAll('.managed-company-source-pass input[type=checkbox]')];
              const button = [...document.querySelectorAll('.managed-company-source-pass button')].find(b => b.textContent === 'Preview company source pass');
              const messages = [
                '', 'Review the selected missing sources, then run this pass.',
                'Company visit or source state changed. Preview a new pass.',
                'Starting reviewed company source pass…',
                'Company source pass cancelled. No remaining sources were requested.',
                'Missing-source load finished. Existing evidence kept its original source dates.',
                'No eligible missing sources to load. Existing evidence was kept.'
              ];
              const messageCodes = ['empty','review','invalidated','starting','cancelled','finished','no_missing'];
              const index = messages.indexOf(pass.message);
              return {scenario,route,sourcePass:{
                phase:code(pass.phase,['idle','preview','running','finished','cancelled','invalidated']),
                previewPresent:pass.preview !== null,
                listingExpected:pass.preview?.selection?.listing?.listingId === 'listing-zero',
                choicesMask:choices.length === 4 ? choices.reduce((m,c,i) => m | (c.checked ? 1 << i : 0),0) : -1,
                names:names.map(name => code(name,sourceNames)),
                rows:pass.rows.map(row => ({name:code(row.name,sourceNames),selected:row.selected === true,
                  disposition:code(row.disposition,['missing','not_attempted','retained','unsupported','running','loaded','failed','cancelled'])})),
                message:index < 0 ? 'other' : messageCodes[index],
                buttonPresent:button !== undefined,
                buttonDisabled:button === undefined || button.disabled === true
              }};
            }
            const followups = read('fixture-followups-draft'), watchlist = read('fixture-workspace-draft');
            const canonical = document.getElementById('fixture-valuation-followup-canonical');
            if (!followups || !watchlist || !canonical ||
                typeof followups.dirty !== 'boolean' || typeof watchlist.dirty !== 'boolean') return null;
            const phase = value => code(value,['idle','loading','saving','reconciling','signing_out','retired']);
            const version = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000 ? value : -1;
            const count = (value,max) => value === null ? -1 : Array.isArray(value) && value.length <= max ? value.length : -1;
            return {scenario,route,
              followups:{phase:phase(followups.phase),baseVersion:version(followups.baseVersion),dirty:followups.dirty,entryCount:count(followups.entries,20)},
              watchlist:{phase:phase(watchlist.phase),baseVersion:version(watchlist.baseVersion),dirty:watchlist.dirty,entryCount:count(watchlist.memberships,1000)},
              canonicalPresent:true,canonicalNull:canonical.textContent === 'null'};
          } catch { return null; }
        })()
        """;
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
            'Select a complete format 6 company report JSON for this exact company. The file was not accepted.',
            'The company, source or draft changed. Capture the current report and preview again.',
            'Open this company with a current Watchlist draft before selecting a report.'];
          const number=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000 ? value : -1;
          let fixture={};
          try {fixture=JSON.parse(document.querySelector('#fixture-diagnostics')?.textContent??'{}');} catch {}
          const counters={};
          for (const key of ['load','status','annual','eod','filings','save','resolve','marketsResolve','marketsEod','token','signOut']) counters[key]=number(fixture[key]);
          const input=outer?.querySelector('input[type=file]');
          const writerElement=document.querySelector('#fixture-revisit-file');
          let writer={present:false,phase:'missing',filename:'',byteLength:0};
          if (writerElement) {
            const writerText=writerElement.textContent??'';
            if (writerText.length>256) throw new Error();
            const value=JSON.parse(writerText);
            if (value===null || typeof value!=='object' || Array.isArray(value)) throw new Error();
            if (Object.keys(value).length!==3) throw new Error();
            if (!['idle','preparing','choosing','written','cancelled','failed'].includes(value.phase)) throw new Error();
            if (!['','Investment-research-ZERO-XNAS-20261015T000000000Z.json'].includes(value.filename)) throw new Error();
            if (!Number.isSafeInteger(value.byteLength) || value.byteLength<0 || value.byteLength>5996544) throw new Error();
            writer={present:true,phase:value.phase,filename:value.filename,byteLength:value.byteLength};
          }
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
            observationFailed:false,counters,file:window[key],writer};
        } catch { observation={observationFailed:true}; }
        return {passed,observation,syntheticFacts:
        """ + SYNTHETIC_FACTS + """
        };})()
        """;
    record Result(boolean passed, String observation) {}
    private record IntegerRange(long minimum, long maximum) {
        boolean contains(double value) { return value >= minimum && value <= maximum; }
    }
    private ReportRevisitReadObservation() {}
    static String wrap(String predicate) { return "(()=>{const passed=Boolean(" + predicate + SCRIPT; }
    static Result decode(String value) {
        try {
            JSONObject result = new JSONObject(value);
            Object passed = result.get("passed");
            if (!(passed instanceof Boolean)) return new Result(false, "invalid passed field");
            String observation = safeObservation(result.optJSONObject("observation"));
            String facts = safeSyntheticFacts(result.opt("syntheticFacts"));
            if (facts != null) {
                String expanded = observation + "; syntheticFacts=" + facts;
                if (expanded.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= MAX_OBSERVATION_BYTES)
                    observation = expanded;
            }
            return new Result((Boolean)passed, observation);
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
            copyInteger(source, safe, "noteLength", new IntegerRange(0, 16384));
            copyInteger(source, safe, "identityMask", new IntegerRange(0, 2047));
            copyInteger(source, safe, "statusCode", new IntegerRange(-1, 5));
            copyInteger(source, safe, "inputCount", new IntegerRange(0, 8));
            copyBoolean(source, safe, "inputValueEmpty");
            safe.put("counters", safeCounters(source.getJSONObject("counters")));
            safe.put("file", safeFile(source.getJSONObject("file")));
            safe.put("writer", safeWriter(source.getJSONObject("writer")));
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
        for (String key : COUNTERS.split(" ")) copyInteger(source, safe, key, new IntegerRange(-1, 1000000));
        return safe;
    }
    private static JSONObject safeFile(JSONObject source) throws Exception {
        JSONObject safe = new JSONObject();
        copyInteger(source, safe, "events", new IntegerRange(-1, 32));
        copyInteger(source, safe, "count", new IntegerRange(0, 8));
        copyInteger(source, safe, "size", new IntegerRange(-1, Integer.MAX_VALUE));
        copyBoolean(source, safe, "nonzero");
        Object name = source.get("name"), type = source.get("type");
        if (!NAMES.contains(name)) throw new IllegalArgumentException();
        if (!TYPES.contains(type)) throw new IllegalArgumentException();
        safe.put("name", name);
        safe.put("type", type);
        return safe;
    }
    private static JSONObject safeWriter(JSONObject source) throws Exception {
        if (source.length() != 4) throw new IllegalArgumentException();
        JSONObject safe = new JSONObject();
        copyBoolean(source, safe, "present");
        Object phase = source.get("phase"), filename = source.get("filename");
        if (!WRITER_PHASES.contains(phase)) throw new IllegalArgumentException();
        if (!WRITER_NAMES.contains(filename)) throw new IllegalArgumentException();
        safe.put("phase", phase);
        safe.put("filename", filename);
        copyInteger(source, safe, "byteLength", new IntegerRange(0, 5996544));
        requireWriterPresence(safe);
        return safe;
    }
    private static void requireWriterPresence(JSONObject source) throws Exception {
        Object phase = source.get("phase");
        if (source.getBoolean("present")) {
            if ("missing".equals(phase)) throw new IllegalArgumentException();
            return;
        }
        if (!"missing".equals(phase)) throw new IllegalArgumentException();
        if (!"".equals(source.get("filename"))) throw new IllegalArgumentException();
        if (source.getLong("byteLength") != 0) throw new IllegalArgumentException();
    }
    private static String safeSyntheticFacts(Object value) {
        if (!(value instanceof JSONObject)) return null;
        try { return boundedSyntheticFacts((JSONObject)value); }
        catch (Exception malformed) { return null; }
    }
    private static String boundedSyntheticFacts(JSONObject source) throws Exception {
        String text = syntheticFactsEnvelope(source).toString();
        return text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= MAX_OBSERVATION_BYTES ? text : null;
    }
    private static JSONObject syntheticFactsEnvelope(JSONObject source) throws Exception {
        JSONObject safe = new JSONObject();
        copyCode(source, safe, "scenario", Set.of("reviewed-company-source-pass", "valuation-scenario-followup"));
        copyCode(source, safe, "route", Set.of("root", "company_annual", "company_interim", "company_price", "company_filings", "other"));
        if ("reviewed-company-source-pass".equals(source.get("scenario")))
            return sourcePassEnvelope(source, safe);
        return followupsEnvelope(source, safe);
    }
    private static JSONObject sourcePassEnvelope(JSONObject source, JSONObject safe) throws Exception {
        if (source.length() != 3) throw new IllegalArgumentException();
        safe.put("sourcePass", safeSourcePassFacts(source.getJSONObject("sourcePass")));
        return safe;
    }
    private static JSONObject followupsEnvelope(JSONObject source, JSONObject safe) throws Exception {
        if (source.length() != 6) throw new IllegalArgumentException();
        safe.put("followups", safeResourceFacts(source.getJSONObject("followups"), 20));
        safe.put("watchlist", safeResourceFacts(source.getJSONObject("watchlist"), 1000));
        copyBoolean(source, safe, "canonicalPresent");
        copyBoolean(source, safe, "canonicalNull");
        return safe;
    }
    private static JSONObject safeSourcePassFacts(JSONObject source) throws Exception {
        if (source.length() != 9) throw new IllegalArgumentException();
        JSONObject safe = new JSONObject();
        copyCode(source, safe, "phase", Set.of("idle", "preview", "running", "finished", "cancelled", "invalidated", "other"));
        copyBoolean(source, safe, "previewPresent");
        copyBoolean(source, safe, "listingExpected");
        copyInteger(source, safe, "choicesMask", new IntegerRange(-1, 15));
        safe.put("names", safeSourceNames(source.getJSONArray("names")));
        safe.put("rows", safeSourceRows(source.getJSONArray("rows")));
        copyCode(source, safe, "message", Set.of("empty", "review", "invalidated", "starting", "cancelled", "finished", "no_missing", "other"));
        copyBoolean(source, safe, "buttonPresent");
        copyBoolean(source, safe, "buttonDisabled");
        return safe;
    }
    private static org.json.JSONArray safeSourceNames(org.json.JSONArray names) throws Exception {
        if (names.length() > 4) throw new IllegalArgumentException();
        org.json.JSONArray safe = new org.json.JSONArray();
        Set<String> sourceCodes = Set.of("eod", "annual", "filings", "interim", "other");
        for (int index = 0; index < names.length(); index++)
            safe.put(safeSourceName(names.get(index), sourceCodes));
        return safe;
    }
    private static Object safeSourceName(Object value, Set<String> allowed) {
        if (!allowed.contains(value)) throw new IllegalArgumentException();
        return value;
    }
    private static org.json.JSONArray safeSourceRows(org.json.JSONArray rows) throws Exception {
        if (rows.length() > 4) throw new IllegalArgumentException();
        org.json.JSONArray safe = new org.json.JSONArray();
        for (int index = 0; index < rows.length(); index++)
            safe.put(safeSourceRow(rows.getJSONObject(index)));
        return safe;
    }
    private static JSONObject safeSourceRow(JSONObject source) throws Exception {
        if (source.length() != 3) throw new IllegalArgumentException();
        JSONObject safe = new JSONObject();
        copyCode(source, safe, "name", Set.of("eod", "annual", "filings", "interim", "other"));
        copyBoolean(source, safe, "selected");
        copyCode(source, safe, "disposition", Set.of("missing", "not_attempted", "retained", "unsupported", "running", "loaded", "failed", "cancelled", "other"));
        return safe;
    }
    private static JSONObject safeResourceFacts(JSONObject source, int maximumEntries) throws Exception {
        if (source.length() != 4) throw new IllegalArgumentException();
        JSONObject safe = new JSONObject();
        copyCode(source, safe, "phase", Set.of("idle", "loading", "saving", "reconciling", "signing_out", "retired", "other"));
        copyInteger(source, safe, "baseVersion", new IntegerRange(-1, 1000000));
        copyBoolean(source, safe, "dirty");
        copyInteger(source, safe, "entryCount", new IntegerRange(-1, maximumEntries));
        return safe;
    }
    private static void copyCode(JSONObject source, JSONObject target, String key, Set<String> allowed) throws Exception {
        Object value = source.get(key);
        if (!(value instanceof String) || !allowed.contains(value)) throw new IllegalArgumentException();
        target.put(key, value);
    }
    private static void copyBoolean(JSONObject source, JSONObject target, String key) throws Exception {
        Object value = source.get(key);
        if (!(value instanceof Boolean)) throw new IllegalArgumentException();
        target.put(key, value);
    }
    private static void copyInteger(JSONObject source, JSONObject target, String key, IntegerRange range) throws Exception {
        Object value = source.get(key);
        if (!(value instanceof Number)) throw new IllegalArgumentException();
        double number = ((Number)value).doubleValue();
        if (!Double.isFinite(number) || number != Math.rint(number))
            throw new IllegalArgumentException();
        if (!range.contains(number)) throw new IllegalArgumentException();
        target.put(key, ((Number)value).longValue());
    }
}
