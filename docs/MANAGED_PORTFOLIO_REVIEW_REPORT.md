# Portfolio review report

Android 1.40 extends [dated holdings review](MANAGED_PORTFOLIO.md#review-holdings-at-one-observed-close-date)
into a readable private file. Original required source checks, the complete
synthetic native 81-case gate and guarded APK verification passed. The signed
update is provided locally; no physical-device acceptance is claimed.

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

## Compare a saved report with current holdings

This workflow is accepted in source and provided in Android 1.64. Its evidence and delivery limits are recorded in [Current work](CURRENT_WORK.md).

Choose one saved Portfolio HTML report and explicitly read it. Inspect its full
ledger, holdings, selected close date and original source packets. The reader
extracts and validates the data appendix locally. It does not open the file as
a webpage or load its resources. A private copy is unverified evidence, not proof
of authenticity, source freshness or a saved Portfolio version.

Load and review current holdings independently, choose an observed close date,
then capture the current report. Inspect both complete records before Compare.
The comparison keeps every exact listing from either side, with separate share
classes and explicit identity conflicts. Raw shares, confirmation dates, closes,
USD values, composition, cash and totals retain their own dates and qualifications.
An absent holding or unavailable value is never treated as zero. The comparison
does not calculate returns, choose a later price or alter the current ledger.

Research is available only for an exact current holding. Back preserves authored
drafts; reopen the review and capture again after navigation or a source change.
Changing the file or retiring the current capture withdraws the comparison.
Cancelled and late reads cannot replace the active result. File reading adds no
online Save, draft import, background request or report store.

## Keep a private comparison report

This workflow is accepted in source and provided in Android 1.65. Its evidence
and delivery limits are recorded in [Current work](CURRENT_WORK.md).

After comparing a saved report with current holdings, choose **Capture comparison
report**. Inspect the complete saved and current records, every listing in the
comparison, raw shares and values, cash, ledger, composition and source packets.
The saved filename and unverified-file qualification remain visible. Each side
keeps its own capture time, close date and source dates. Missing values and absent
holdings remain distinct; the report does not calculate returns.

Choose **Save comparison report (HTML)** separately. Android asks for one chosen
document. The browser requests a download; that request alone does not prove a
durable file. The complete UTF-8 document must fit within 8 MiB. Larger reports
are refused without clipping. The file has a distinct purpose and strict content
policy, with no scripts or external assets. It cannot serve as a single Portfolio
report or a recoverable draft.

Changing the chosen file, current capture, source, date, ledger, form, catalog,
navigation or session retires the report and cancels unfinished delivery.
Restoring earlier values cannot renew the capture. Close and Cancel affect only
this report. Current drafts, online Save and Research/Back retain their existing
ownership. Keep the file private: it contains both full authored records.
