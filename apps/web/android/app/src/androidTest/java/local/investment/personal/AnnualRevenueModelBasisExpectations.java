package local.investment.personal;

import org.json.JSONObject;

/** Exact invented source and authored values; no rendered text is inserted by these observations. */
final class AnnualRevenueModelBasisExpectations {
    static final String PREFIX = "Revenue basis thesis";
    static final String CITATION = "Annual revenue basis for authored starting revenue: ZERO (XNAS); Revenues USD 1000, 2025-01-01 to 2025-12-31. 10-K filed 2026-02-01; accession 0000000001-26-000001; https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Chosen reported revenue supplies authored starting revenue only. No other assumption or DCF cash flow is inferred; source dates are unchanged.";
    static final String NOTE = "Revenue basis thesis Authored valuation: ZERO (XNAS), listing listing-zero, security security-zero, class class-zero, issuer issuer-zero, CIK unavailable, catalog sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; base scenario. All money is USD; shares are diluted shares; rates are percent. Assumptions are authored, not reported financial facts or current prices. Scenario context, not a recommendation. Exit multiple authored-exit-multiple-v1, engine exit-multiple-v1, schema 1.0.0: base revenue 1000; cash 100.00; debt 200.00; shares 100.00; years 5; discount 10.00%; annual revenue growth 10.00%; target EBITDA margin 20.00%; exit multiple 10.00x. Final revenue 1610.510; final EBITDA 322.102; terminal enterprise value 3221.020; present enterprise value 2000.000; equity value 1900.000; value/share 19.00. Method: revenue=base revenue*(1+growth)^years; EBITDA=revenue*margin; terminal enterprise=EBITDA*exit multiple; discount year-end terminal enterprise by (1+discount)^years; equity=present enterprise+cash-debt; value/share=equity/shares. Interim cash flows excluded. Decimal arithmetic, half-up; money 3 decimals; value/share 2 decimals. Annual revenue basis for authored starting revenue: ZERO (XNAS); Revenues USD 1000, 2025-01-01 to 2025-12-31. 10-K filed 2026-02-01; accession 0000000001-26-000001; https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm. Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z; Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z. Current-use policy at original load: eligible. Chosen reported revenue supplies authored starting revenue only. No other assumption or DCF cash flow is inferred; source dates are unchanged.";
    static final String[][] FIELDS = {
            {"dcf-startingUnleveredCashFlowUsd", "100.00"}, {"dcf-enterpriseToEquityBridgeUsd", "100.00"},
            {"dcf-dilutedShares", "10.00"}, {"dcf-waccPercent", "10.00"}, {"dcf-terminalGrowthPercent", "0.00"},
            {"dcf-conservative", "0.00"}, {"dcf-base", "10.00"}, {"dcf-expansion", "20.00"},
            {"exit-baseRevenue", "1000.00"}, {"exit-cash", "100.00"}, {"exit-debt", "200.00"},
            {"exit-dilutedShares", "100.00"}, {"exit-discountRatePercent", "10.00"},
            {"exit-conservative-annualRevenueGrowthPercent", "0.00"}, {"exit-conservative-targetEbitdaMarginPercent", "20.00"}, {"exit-conservative-exitMultiple", "10.00"},
            {"exit-base-annualRevenueGrowthPercent", "10.00"}, {"exit-base-targetEbitdaMarginPercent", "20.00"}, {"exit-base-exitMultiple", "10.00"},
            {"exit-expansion-annualRevenueGrowthPercent", "20.00"}, {"exit-expansion-targetEbitdaMarginPercent", "20.00"}, {"exit-expansion-exitMultiple", "10.00"}
        };
    private AnnualRevenueModelBasisExpectations() {}

    static String sourceExact() {
        return "(()=>{const s=document.querySelector('[aria-label=\"Selected reported revenue source\"]');return s?.textContent.includes('Reported USD 1000; 2025-01-01 to 2025-12-31.')&&s.textContent.includes('Revenues')&&s.textContent.includes('10-K, filed 2026-02-01; accession 0000000001-26-000001.')&&s.textContent.includes('Original cutoff 2026-09-20T00:00:00.000Z; completed 2026-09-20T00:00:02.000Z. Company Facts captured 2026-09-20T00:00:01.000Z; Submissions captured 2026-09-20T00:00:02.000Z.')&&s.querySelector('a')?.href==='https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm';})()";
    }
    static String previewMapsExact(String before, String store) {
        return "(()=>{const b=JSON.parse("+JSONObject.quote(before)+"),s="+store+",p=document.querySelector('[aria-label=\"Complete starting revenue change preview\"]'),groups=[p?.querySelector('[aria-label=\"Current complete valuation inputs\"]'),p?.querySelector('[aria-label=\"Proposed complete valuation inputs\"]')];"+
            "const raw=e=>[...['startingUnleveredCashFlowUsd','enterpriseToEquityBridgeUsd','dilutedShares','forecastYears','waccPercent','terminalGrowthPercent'].map(k=>e.dcf.inputs[k]),...['conservative','base','expansion'].map(k=>e.dcf.inputs.scenarios[k].annualCashFlowGrowthPercent),...['baseRevenue','cash','debt','dilutedShares','horizonYears','discountRatePercent'].map(k=>e.exit.inputs[k]),...['conservative','base','expansion'].flatMap(n=>['annualRevenueGrowthPercent','targetEbitdaMarginPercent','exitMultiple'].map(k=>e.exit.inputs.scenarios[n][k]))];"+
            "const maps=[{dcf:{inputs:b.dcfDraft},exit:{inputs:b.exitDraft}},s.expected];return groups.every((g,i)=>g&&JSON.stringify([...g.querySelectorAll('.managed-valuation-raw')].map(n=>n.textContent))===JSON.stringify(raw(maps[i])))&&Object.values(s.expected.listing).every(v=>groups.every(g=>g.textContent.includes(v)))&&groups.every(g=>g.textContent.includes(s.expected.catalogSnapshotSha256)&&g.textContent.includes(s.expected.dcf.modelVersion)&&g.textContent.includes(s.expected.exit.modelVersion));})()";
    }
    static String onlyRevenueChanged(String before, String editor) {
        return "(()=>{const b=JSON.parse("+JSONObject.quote(before)+"),e="+editor+";b.exitDraft.baseRevenue='1000';return JSON.stringify(e)===JSON.stringify(b)&&e.calculation===null;})()";
    }
    static String savedRawOnly(String store, String resource) {
        return "(()=>{const s="+store+",r="+resource+",entry=r.saved?.payload.entries[0];return r.saved?.version===1&&r.saved.payload.entries.length===1&&JSON.stringify(entry)===JSON.stringify(s.expected)&&Object.keys(entry).sort().join('|')==='catalogSnapshotSha256|cik|dcf|exit|listing'&&Object.keys(entry.dcf).sort().join('|')==='inputs|modelVersion'&&Object.keys(entry.exit).sort().join('|')==='inputs|modelVersion'&&!JSON.stringify(entry).includes('Annual revenue basis')&&!JSON.stringify(entry).includes('2026-09-20');})()";
    }
}
