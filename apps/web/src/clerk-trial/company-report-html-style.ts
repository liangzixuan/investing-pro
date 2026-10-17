/** Fixed offline document stylesheet; no application assets or dynamic CSS. */
export const COMPANY_REPORT_HTML_STYLE = `html { color-scheme: light; background: #f4f3ef; color: #202a35; font-family: system-ui, sans-serif; line-height: 1.6; }
body { margin: 0; padding: clamp(16px, 4vw, 48px); }
main { max-width: 76ch; margin: 0 auto; padding: clamp(16px, 4vw, 40px); background: #fff; border: 1px solid #d8dde1; }
h1, h2, h3 { line-height: 1.25; overflow-wrap: anywhere; }
h1 { font-size: 1.9rem; margin-top: 0; }
h2 { margin-top: 2rem; font-size: 1.35rem; }
h3 { font-size: 1.05rem; }
p, dd, li, pre { overflow-wrap: anywhere; }
dl { display: grid; grid-template-columns: minmax(0, 12rem) minmax(0, 1fr); gap: 8px 20px; }
dt { font-weight: 600; }
dd { margin: 0; min-width: 0; }
small { display: block; }
.fact { border-top: 1px solid #d8dde1; padding: 8px 0 16px; }
.amount { font-weight: 650; font-variant-numeric: tabular-nums; }
.note, pre { white-space: pre-wrap; }
.warning { border-left: 3px solid #8a5a12; padding-left: 12px; }
summary { min-height: 44px; display: list-item; align-content: center; cursor: pointer; font-weight: 600; overflow-wrap: anywhere; }
summary:focus-visible { outline: 2px solid #244e76; outline-offset: 3px; }
pre { padding: 12px; border: 1px solid #d8dde1; font-size: .85rem; }
.managed-valuation-results { min-width: 0; }
.managed-valuation-table { max-width: 100%; overflow-x: auto; margin-block: 16px; }
.managed-valuation-table table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.managed-valuation-table :is(th, td) { padding: 8px; border-bottom: 1px solid #d8dde1; text-align: right; overflow-wrap: anywhere; }
.managed-valuation-table :is(th, td):first-child { text-align: left; }
.managed-valuation-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.managed-valuation-facts > div { min-width: 0; }
.managed-valuation-facts dd { margin-top: 4px; }
.managed-annual-statement-report { min-width: 0; }
.managed-annual-statement-report :is(h4, h5, strong, span, th, td) { overflow-wrap: anywhere; }
.managed-annual-statement-report .managed-annual-statement-table { max-width: 100%; overflow-x: auto; margin-block: 20px; }
.managed-annual-statement-report table { width: 100%; min-width: 36rem; table-layout: fixed; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.managed-annual-statement-report :is(th, td) { padding: 10px; vertical-align: top; border: 1px solid #d8dde1; text-align: left; white-space: normal; }
.managed-annual-statement-report caption { text-align: left; font-weight: 650; padding-block: 8px; }
.managed-annual-statement-report th:first-child { width: 42%; }
.managed-annual-statement-report small { margin-block: 6px; font-weight: 400; }
.managed-annual-statement-report .managed-annual-statement-amount { display: block; white-space: normal; }
.managed-annual-statement-report details { margin-block: 12px; padding: 8px; border: 1px solid #d8dde1; }
.managed-annual-statement-report dl { display: block; }
.managed-annual-statement-report dl > div { display: grid; grid-template-columns: minmax(0, 10rem) minmax(0, 1fr); gap: 4px 12px; padding-block: 4px; }
.managed-annual-statement-report .managed-annual-statement-observation { border-top: 1px solid #d8dde1; margin-block: 12px; }
@media (max-width: 520px) { dl { grid-template-columns: minmax(0, 1fr); gap: 4px; } dd { margin-bottom: 12px; } }
@media print { html { background: #fff; } body, main { padding: 0; border: 0; } h2, h3 { break-after: avoid; } .fact { break-inside: avoid; } }
`;
export const COMPANY_REPORT_HTML_STYLE_HASH =
  "sha256-8+LGJbYZC9u5y4gOTj4VCeCJ5UJ5eXPMvI/k/+nIGdM=";
export const COMPANY_REPORT_HTML_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src '" +
  COMPANY_REPORT_HTML_STYLE_HASH +
  "'";
