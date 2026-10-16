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
@media (max-width: 520px) { dl { grid-template-columns: minmax(0, 1fr); gap: 4px; } dd { margin-bottom: 12px; } }
@media print { html { background: #fff; } body, main { padding: 0; border: 0; } h2, h3 { break-after: avoid; } .fact { break-inside: avoid; } }
`;
export const COMPANY_REPORT_HTML_STYLE_HASH =
  "sha256-nXvxxaf/ke6b0nfJmPMax9636buDIOrAfSsh6vX+BgE=";
export const COMPANY_REPORT_HTML_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src '" +
  COMPANY_REPORT_HTML_STYLE_HASH +
  "'";
