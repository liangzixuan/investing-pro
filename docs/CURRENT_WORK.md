# Current work

Updated October 18, 2026. This is the current capability and delivery record.
The [roadmap](PRODUCT_ROADMAP.md) defines the broader InvestingPro goal.
[Historical work notes](WORK_HISTORY_20261017.md) preserve earlier implementation
and test reports; their pending labels do not describe current status.

## Current capability and delivery status

The last verified website/API release is product `c270131`, with production
controller `ac6f180`. Android 1.27.0, code 28, was delivered; installation and
physical use are unverified. Source integration through PR188 is at
`f43796794320286fd9c1ce02d7472c454519953e`. These are different delivery states.

| Capability                        | Current source and scope                                                                                                                                | Delivery or acceptance still needed                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markets and Price                 | AAPL, GOOG and GOOGL: three listings for two issuers. Dated raw USD closes; no adjusted-return or live-quote claim.                                     | Broader lawful coverage and complete market discovery.                                                                                                     |
| Annual statements and screening   | Canonical Annual 6 explorer and explicit screening are integrated. Defined cohort: 18 listings across 17 issuers.                                       | Matching API/website/Android release. Quarterly, TTM, custom-taxonomy and broader statement coverage remain open.                                          |
| Filings                           | Separate admitted scope of three issuers.                                                                                                               | Screening or Annual eligibility does not establish Filings eligibility.                                                                                    |
| Screening comparison              | PR188 is merged. Two loaded results, three statement groups, independent sources, either company's research and Back retain the screen and drafts.      | All four final-main jobs pass (177 listed steps); 51 native tests pass and six bounded exact-tree PR frames were reviewed. Publication is separate.        |
| Valuation and dated price context | Authored DCF/exit models and dated raw-price comparisons are integrated through PR187.                                                                  | Editable assumptions are session-only. A saved note or captured report is not an editable saved model.                                                     |
| Research studies and reports      | Price studies, explicit complete-note Preview/Append and company JSON/HTML capture are integrated. Candidate report format 5 retains Annual 6 evidence. | Matching release and affected delivery acceptance. Captured reports do not establish browser file delivery or live provider health.                        |
| Watchlist and Follow-ups          | Independent drafts, explicit Review/Save and conflict/uncertain-save recovery exist.                                                                    | Controlled real-account recovery and isolated backup/restore remain open; in-memory tests are not cloud persistence proof.                                 |
| Managed Portfolio                 | Authored schema-3 ledger, holdings/cash, Review/Save/recovery and research return are integrated in source.                                             | Production storage remains disabled pending configuration and persistence qualification. Price history and returns are not a delivered managed capability. |
| Daily use and access              | Synthetic web/native checks exercise the recorded boundaries.                                                                                           | Screen-reader use, physical upgrade, process-death restoration, sustained production use and cloud recovery remain unverified.                             |

Source and native checks establish their stated cases. They do not establish full
InvestingPro parity, production account recovery or physical-device acceptance.
The full goal still includes broader company discovery, news and calendars,
quarterly/TTM financials, peer research and comparable portfolio returns.

## Selected next outcome: coordinated release and daily-use acceptance

Prepare one matching API, website and Android release from a verified source
revision. Use the [release readiness plan](MANAGED_RELEASE_READINESS.md) for its
acceptance matrix, compatibility checks and rollback boundaries. Product source
has passed all final-main checks; artifact qualification remains separate. Record API upload,
website promotion, signed package delivery and device upgrade separately.

Matching local API and website artifacts and signed Android 1.28.0, code 29, are
prepared. They have not replaced the verified live release or delivered 1.27
package. Reuse unchanged local qualification; staging and delivery remain open.

Use the current task's browser authorization. The owner explicitly resumed
browser testing on October 18; older browser-stop labels do not override that
instruction. The site release workflow activates staging and invokes BrowserStack
even when production promotion is disabled. Run it only within the authorized
scope and actual tool permissions. A tool rejection remains a separate blocker;
preserve its reason and do not retry the action through an indirect route. Do not
ask for the same browser permission again. Keep the existing release checks and
the owner's selected browser. Independent source/API/CLI work can continue.

After this delivery outcome, align Price, Annual and Filings eligibility across
one useful named company universe. Then complete editable valuation persistence
and managed Portfolio storage/recovery. New portfolio-history work is deferred
while its source-contract assessment remains useful preparation. Ticker additions
are coverage fixes; selected metric rows are small increments.

## Compatibility and saved work

The live Annual 5 API requires matching clients. Android 1.26 cannot load Annual
against it; delivered 1.27 supports that live version. The phone's installed
version is unverified, so no phone failure is asserted. The candidate uses Annual
6 and report format 5; prepare and review matching API, website and Android
artifacts together. Do not activate a candidate API alone.

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
