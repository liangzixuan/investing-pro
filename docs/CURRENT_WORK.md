# Current work

Updated October 18, 2026. This is the current capability and delivery record.
The [roadmap](PRODUCT_ROADMAP.md) defines the broader InvestingPro goal.
[Historical work notes](WORK_HISTORY_20261017.md) preserve earlier implementation
and test reports; their pending labels do not describe current status.

## Current capability and delivery status

The website and API publish product
`f43796794320286fd9c1ce02d7472c454519953e`, with production controller
`dc781e41a751e6de0d8c73fff5ec8c3cf89aa1fe`. The October 18
[production promotion](https://github.com/liangzixuan/investing-pro/actions/runs/39117654678)
passed all 12 job steps. Its receipts and fresh metadata confirm the matching
API/site pair and unchanged settings. Matching Android 1.28.0, code 29, was
prepared with the existing production signer. On October 18 the owner reported
a successful 1.27-to-1.28 update and passes for all four requested physical
checks. This accepts the reported upgrade and checklist; no independent device
inspection or per-step logs were collected.

| Capability                        | Current source and scope                                                                                                                            | Delivery or acceptance still needed                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markets and Price                 | AAPL, GOOG and GOOGL: three listings for two issuers. Dated raw USD closes; no adjusted-return or live-quote claim.                                 | Broader lawful coverage and complete market discovery.                                                                                                     |
| Annual statements and screening   | Canonical Annual 6 explorer and explicit screening are published on the website/API. Defined cohort: 18 listings across 17 issuers.                 | Matching Android update and requested checks passed by owner report. Quarterly, TTM, custom-taxonomy and broader statement coverage remain open.           |
| Filings                           | Separate admitted scope of three issuers.                                                                                                           | Screening or Annual eligibility does not establish Filings eligibility.                                                                                    |
| Screening comparison              | Published website/API source connects two loaded results, three statement groups, independent sources, either company's research and retained Back. | Requested Android screen/comparison/research Back check passed by owner report. Sustained use and controlled recovery remain open.                         |
| Valuation and dated price context | Authored DCF/exit models and dated raw-price comparisons are integrated through PR187.                                                              | Editable assumptions are session-only. A saved note or captured report is not an editable saved model.                                                     |
| Research studies and reports      | Website/API publish Price studies, explicit complete-note Preview/Append and company JSON/HTML capture. Report format 5 retains Annual 6 evidence.  | Matching Android update passed by owner report. Export/file delivery and sustained use remain separate; the physical checklist did not test every feature. |
| Watchlist and Follow-ups          | Independent drafts, explicit Review/Save and conflict/uncertain-save recovery exist.                                                                | Controlled real-account recovery and isolated backup/restore remain open; in-memory tests are not cloud persistence proof.                                 |
| Managed Portfolio                 | Authored schema-3 ledger, holdings/cash, Review/Save/recovery and research return are integrated in source.                                         | Production storage remains disabled pending configuration and persistence qualification. Price history and returns are not a delivered managed capability. |
| Daily use and access              | Owner reports successful update, sign-in/reopen, saved-work presence, research Back, keyboard, background/reopen and force-stop/reopen checks.      | Screen-reader use, durable draft restoration, sustained production use and controlled cloud recovery remain open.                                          |

Source and native checks establish their stated cases. The owner report adds its
requested physical checklist only. Full InvestingPro parity, controlled account
recovery and sustained use remain open.
The full goal still includes broader company discovery, news and calendars,
quarterly/TTM financials, peer research and comparable portfolio returns.

## Selected next outcome: daily-use reliability and recovery

The matching website/API release and owner-reported Android upgrade/checklist
are accepted within their recorded scopes. Next qualify controlled storage
recovery, backup/restore and accessibility. Use the
[release readiness plan](MANAGED_RELEASE_READINESS.md) for the separate acceptance
requirements; the update report does not close these remaining checks.

Staging run `39112966766`, attempt 1, passed its deployed-origin BrowserStack
checks. Production promoted that exact accepted archive without rebuilding or
repeating staging/browser checks. A fresh metadata observation confirmed both
new pointers and settings; no restore was needed. The recorded API-to-website
switch sequence spanned about 5 minutes 47 seconds. This is not a measurement of
client downtime, authenticated use or provider health.

The owner resumed browser testing on October 18 and separately approved this
production sequence. Both operations are complete; preserve original approvals,
rejections and receipts without replaying consumed actions. Keep unchanged
source/native/staging evidence closed and use Chrome for any newly authorized
browser work. No browser permission is pending for the completed release.

After this delivery outcome, align Price, Annual and Filings eligibility across
one useful named company universe. Then complete editable valuation persistence
and managed Portfolio storage/recovery. New portfolio-history work is deferred
while its source-contract assessment remains useful preparation. Ticker additions
are coverage fixes; selected metric rows are small increments.

## Compatibility and saved work

The live API uses Annual 6 and report format 5. Older Annual 5 clients, including
delivered Android 1.27, cannot load Annual against it. The owner approved a
web-first cutover with older Android clients closed until a supported upgrade.
The owner reports the phone upgraded from 1.27 to matching Android 1.28. The
reported checks cover normal sign-in/reopen, existing saved Watchlist and
Follow-ups presence, the requested Annual/screen/comparison/research Back check,
and native Back, keyboard, background/reopen and force-stop/reopen. These results
are owner-reported; the installed code and signer were not independently read.

Save wanted Watchlist and Follow-ups drafts before reloading or updating.
Valuation inputs are temporary and clear on reload, session retirement or
sign-out. Saving the Watchlist preserves an authored note, not the editable
workbench. Do not import or modify the separate local research vault.

Before a device upgrade, restoring the prior API and website together can restore
prior-client compatibility. After a newer APK is installed, an old-API-only
rollback can leave Annual incompatible. A retained APK is not an automatic
in-place downgrade. Preserve each release pair; do not uninstall or clear data.

## Verification and status maintenance

Reuse passing evidence only for its unchanged source, configuration and scope.
Preserve failed outcomes and qualify final-main results separately from PR checks.
The existing boundary checker remains in force. Replace a fragile source-string
check when a demonstrated failure warrants a focused behavioral or structural
replacement; preserve its security and architectural protection. No current
checker regression or sampled financial-calculation defect was demonstrated by
the October 17 review, so no broad checker or calculation refactor is selected.

Update this table when source integration, deployment or acceptance changes. Keep
workflow details in the feature guides and historical evidence in dated records;
do not append another list of stale "next" candidates here.
