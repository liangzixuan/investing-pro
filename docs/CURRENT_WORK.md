# Current work

Updated October 20, 2026. This is the current capability and delivery record.
The [roadmap](PRODUCT_ROADMAP.md) defines the broader InvestingPro goal.
[Historical work notes](WORK_HISTORY_20261017.md) preserve earlier implementation
and test reports; their pending labels do not describe current status.

## Current capability and delivery status

The website and API publish source
`61f077ca09a00c7fd00d4a7dc1a9463bbfe178c9`. The October 20
[tested archive promotion](https://github.com/liangzixuan/investing-pro/actions/runs/39469586266)
passed all 12 job steps on its original attempt. It reused the exact archive and
BrowserStack acceptance from
[staging run 39454170915](https://github.com/liangzixuan/investing-pro/actions/runs/39454170915),
attempt 1. Fresh metadata and the public entry page/source marker match the
accepted release.

The published website now supports explicit Load, complete Stage/Review/Save,
then fresh-session load, comparison, Use and Calculate for editable valuation
inputs. Its separate storage is enabled and qualified by the private proof with
invented data. The release made no owner-row QA requests and did not test an
authenticated owner Save. Filings now admits 17 issuers in production.

Portfolio storage is also enabled. Its private invented-data qualification
passed the fixed persistence and recovery phases. The API-only enablement reused
the accepted source archive; the active API is ready and live, and its downloaded
source matches that archive. The website already contains the matching Portfolio
workflow. No authenticated owner Portfolio Save was exercised during release.

Android 1.30.0, code 31, packages the same accepted product source with the
existing production signer. The single offline build, package/version/signature
checks and complete bundled source/configuration/asset verification passed. The
verified APK is provided locally; prior 1.28 and 1.29 APKs are unchanged. It adds
matching saved valuation inputs, enabled Portfolio and expanded Filings while
retaining Watchlist draft files. The owner reported "Phone check passed" for the
requested 1.30 checklist on October 20. This accepts the overall checklist by owner report. No per-item
breakdown or independent installed-version, signer or device inspection was
provided. Conditional file and wanted-record Save steps are not separately
evidenced; sustained daily use remains open.

On October 18 the owner reported a successful 1.27-to-1.28 update and passes for
all four requested physical checks. This accepts that reported upgrade and
checklist only. No independent device inspection or per-step logs were collected.
The earlier 1.29 file workflow was not physically accepted; 1.30 carries that
workflow forward. The 1.30 overall phone report does not provide a separate
per-step file-workflow result or retroactive 1.29 acceptance.

| Capability                        | Current source and scope                                                                                                                                                                                                                                       | Delivery or acceptance still needed                                                                                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markets and Price                 | AAPL, GOOG and GOOGL: three listings for two issuers. Dated raw USD closes; no adjusted-return or live-quote claim.                                                                                                                                            | Broader lawful coverage and complete market discovery.                                                                                                                                                                        |
| Annual statements and screening   | Canonical Annual 6 explorer and explicit screening are published on the website/API. Defined cohort: 18 listings across 17 issuers.                                                                                                                            | Android 1.28 update and requested checks passed by owner report. Quarterly, TTM, custom-taxonomy and broader statement coverage remain open.                                                                                  |
| Filings                           | The published API independently admits 17 issuers. The website and Android 1.30 connect explicit Filings reads to company research.                                                                                                                            | The overall Android 1.30 phone checklist passed by owner report; per-feature use is not separately evidenced. Screening or Annual eligibility does not establish Filings eligibility.                                         |
| Screening comparison              | Published website/API source connects two loaded results, three statement groups, independent sources, either company's research and retained Back.                                                                                                            | Requested Android screen/comparison/research Back check passed by owner report. Sustained use and controlled recovery remain open.                                                                                            |
| Valuation and dated price context | Website and Android 1.30 contain authored DCF/exit models, dated raw-price comparisons and saved-input Load/Stage/Review/Save, fresh-session comparison, Use and Calculate. Production storage is enabled; private invented-data persistence proof passed.     | Authenticated owner Save was not exercised during release. The overall Android 1.30 phone checklist passed by owner report; per-feature use is not separately evidenced. Unsaved editor inputs remain in memory.              |
| Research studies and reports      | Website/API publish Price studies, explicit complete-note Preview/Append and company JSON/HTML capture. Report format 5 retains Annual 6 evidence.                                                                                                             | Earlier Android update passed by owner report. Export/file delivery and sustained use remain separate; the physical checklist did not test every feature.                                                                     |
| Watchlist and Follow-ups          | Independent drafts, explicit Review/Save and conflict/uncertain-save recovery exist. The website and Android 1.30 contain Watchlist draft-file capture, review and restoration.                                                                                | Controlled real-account recovery and isolated backup/restore remain open. The overall Android 1.30 checklist passed by owner report; conditional file operations are not separately evidenced.                                |
| Managed Portfolio                 | The website/API and Android 1.30 contain opening balances, an authored schema-3 ledger and manual splits, holdings/cash, independent Review/Save/recovery and retained research return. Production storage is enabled after private persistence qualification. | Authenticated owner Save was not exercised during release. The overall Android 1.30 phone checklist passed by owner report; per-feature use is not separately evidenced. Price history and returns are separate capabilities. |
| Daily use and access              | Owner reports successful update, sign-in/reopen, saved-work presence, research Back, keyboard, background/reopen and force-stop/reopen checks on 1.28.                                                                                                         | Screen-reader use, durable draft restoration, sustained production use and controlled cloud recovery remain open.                                                                                                             |

Source and native checks establish their stated cases. The owner report adds its
requested physical checklist only. Full InvestingPro parity, controlled account
recovery and sustained use remain open. The full goal still includes broader
company discovery, news and calendars, quarterly/TTM financials, peer research
and comparable portfolio returns.

## Selected next outcome: daily use and coherent company coverage

Continue daily use of the delivered Android 1.30 saved valuation and enabled
[managed Portfolio workflow](MANAGED_PORTFOLIO.md). The requested phone checklist
passed overall by owner report on October 20. Next, align a useful named universe
across independently eligible Price, Annual and Filings sources; retain each
source's separate admission and provenance.
The website/API workflow includes opening balances, an authored transaction
ledger and manual splits, exact holdings and cash, independent Review and Save,
conflict and uncertain-save recovery, and return from company research. Reuse
the accepted shared source and unchanged passing evidence. The signed package is
verified. The overall phone report adds owner-reported acceptance; it provides
no per-step details or independent device inspection. Authenticated owner Save
was not tested during release, and specific conditional steps are not separately
evidenced by this concise reply. Sustained daily use remains open.

Keep this outcome ahead of portfolio history, additional metrics, cosmetic work
or tooling increments. Provider quotes, broker synchronization, market value,
performance, benchmarks and tax accounting remain separate capabilities. Ticker
additions are coverage fixes; selected metric rows do not complete this workflow.

A November personal release remains conditional on a usable Portfolio workflow,
matching phone delivery and acceptance, and sustained daily use. The current
website release and overall phone-check report do not establish sustained use.
Use the [release readiness plan](MANAGED_RELEASE_READINESS.md) for their separate
acceptance requirements.

## EOD admission source candidate

A source correction stages the existing guarded version increment and reservation
update together through Appwrite's transaction operations API. Normal admission
uses four calls instead of five. It retains the two-second deadline, quota limits,
acknowledged commit requirement and uncertain-outcome refusal. This source change
is not deployed and does not expand Price eligibility. Source tests do not
establish hosted timing or additional provider qualification. See the
[EOD guide](MANAGED_EOD_HISTORY.md#shared-request-budget).

## Independent source candidate: BLS release calendar

The independent [BLS calendar candidate](MANAGED_BLS_CALENDAR.md)
extends roadmap M3 with explicit loading of scheduled labor, employment and
inflation releases. It adds loaded search/date filters, an official source link
and BLS entries in the existing Markets day view. It retains prior accepted
data on failed refresh or Cancel and makes no navigation-triggered request or
saved-record write. It is not deployed or included in the delivered Android 1.30
package. The 1.30 phone report does not accept this later source candidate or
establish sustained daily use.

## Delivered saved valuation inputs

The [valuation guide](MANAGED_VALUATION_WORKBENCH.md) describes the published
workflow and its limits. Explicit saved-input reads preserve the current editor.
Complete staging and draft review precede Save; fresh-session use requires a
complete comparison and explicit replacement of the editor. Calculate remains
a separate action. Watchlist, Follow-ups and Portfolio save independently.

The [private valuation storage proof](MANAGED_VALUATION_STORAGE_PROOF.md) passed
its fixed cloud phases with invented identities and inputs, including competing
saves, replay, rollback, uncertain commits, payload limits and fresh reads. The
schema inspector correction accepts empty description fields while retaining
schema and access checks. Production valuation storage is now enabled. Default
source configuration still leaves this storage disabled for other deployments.
The proof and release checks do not establish an authenticated owner Save.

The website's [Watchlist draft files](MANAGED_WATCHLIST_DRAFT_FILES.md) provide
explicit capture, complete review and local restoration, followed by independent
catalog review and the normal online Save. They do not provide automatic draft
storage or confirmed-record recovery. The optional
[isolated Watchlist restore proof](MANAGED_WATCHLIST_RESTORE_PROOF.md) remains
deferred; its source checks do not establish an executed cloud restore.

## Compatibility and saved work

The live API retains Annual 6 and report format 5. Price remains three listings
for two issuers. Older Annual 5 clients, including Android 1.27, cannot load
Annual against it. The owner reports an upgrade to Android 1.28 and the four
requested checks: normal sign-in/reopen, existing saved Watchlist and Follow-ups
presence, Annual/screen/comparison/research Back, and native Back, keyboard,
background/reopen and force-stop/reopen. These results are owner-reported; the
installed code and signer were not independently read. They do not cover the
new saved-input workflow or the physical 1.30 upgrade; the separate overall
1.30 phone-check report is recorded above.

Save wanted drafts before reloading or updating. The valuation editor and
unsaved valuation draft remain in memory and clear on reload, session retirement
or sign-out. Confirmed saved valuation inputs remain in their separate resource;
load, compare and explicitly use them to reopen the editor. A saved Watchlist
note or captured report does not save editable workbench inputs. Do not import
or modify the separate local research vault.

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
