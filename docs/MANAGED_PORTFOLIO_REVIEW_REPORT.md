# Portfolio review report

This source candidate extends [dated holdings review](MANAGED_PORTFOLIO.md#review-holdings-at-one-observed-close-date)
into a readable private file. Android 1.39 contains the dated review but does not
include this report. Integration, native runtime checks and delivery are pending.

## Capture, inspect and save

Load Portfolio and complete the current catalog identity review. Apply or reset
pending forms. Open **Dated holdings review**, explicitly load holding closes and
choose an observed date. When loading has stopped, choose **Capture holdings
report**. Capture makes no source request or online Save.

Inspect the complete captured ledger, exact identities, authored holdings and
cash, selected date, qualified or unavailable values, and original source
provenance. Retained history keeps its warning and original request dates. A date
before the authored balances can leave values unavailable. The report does not
substitute a later price, infer unknown cash or calculate returns.

Choose **Save report (HTML)** after reading the capture. Android asks for one
chosen document; the browser requests a download. Cancel stops pending delivery.
A browser download request alone does not establish a durable file. Keep this
file private: it contains authored balances and activity.

**Close captured report** clears the temporary preview. A changed date, refresh,
ledger, form, catalog, save/recovery state, navigation or session withdraws it and
cancels a pending delivery. Exact-company Research and Back retain the ledger;
reopen the review and load explicitly before a new capture. Portfolio Review and
Save remain independent actions.

## File and calculation boundaries

The standalone HTML contains readable values and the complete captured ledger
and raw admitted source packets in a JSON appendix. Text is escaped. The file has
no scripts, remote assets or source requests. It uses its own Portfolio report
purpose, timestamped filename and fixed content policy. Its UTF-8 size cannot
exceed 8 MiB.

The file keeps raw USD closes separate from authored shares and cash. Per-line
half-up rounding, exact-date refusal and incomplete totals use the accepted
holdings-review calculation. Capture time describes the report; it does not
renew any source date. A reference value is not an execution quote, adjusted
performance or advice.

This report is not a restorable Portfolio draft file or proof of an online saved
version. No report store, new financial feed, coverage expansion, API/site release
or automatic file delivery is added. The existing chosen-document writer serves
a distinct strict Portfolio HTML policy; company-report and draft-file policies
remain separate.
