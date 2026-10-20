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

Android 1.28.0, code 29, and the prepared 1.29.0, code 30, retain their earlier
feature sets. The 1.29 package, production signer and bundled source marker passed
artifact review; its physical upgrade and file workflow remain open. On October
18 the owner reported a successful 1.27-to-1.28 update and passes for all four
requested physical checks. This accepts that reported upgrade and checklist
only. No independent device inspection or per-step logs were collected. Matching
Android delivery of saved valuation inputs remains separate.

| Capability                        | Current source and scope                                                                                                                                                                                                                              | Delivery or acceptance still needed                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Markets and Price                 | AAPL, GOOG and GOOGL: three listings for two issuers. Dated raw USD closes; no adjusted-return or live-quote claim.                                                                                                                                   | Broader lawful coverage and complete market discovery.                                                                                                                               |
| Annual statements and screening   | Canonical Annual 6 explorer and explicit screening are published on the website/API. Defined cohort: 18 listings across 17 issuers.                                                                                                                   | Android 1.28 update and requested checks passed by owner report. Quarterly, TTM, custom-taxonomy and broader statement coverage remain open.                                         |
| Filings                           | The published API independently admits 17 issuers. The website connects explicit Filings reads to company research.                                                                                                                                   | Matching expanded Android delivery remains separate. Screening or Annual eligibility does not establish Filings eligibility.                                                         |
| Screening comparison              | Published website/API source connects two loaded results, three statement groups, independent sources, either company's research and retained Back.                                                                                                   | Requested Android screen/comparison/research Back check passed by owner report. Sustained use and controlled recovery remain open.                                                   |
| Valuation and dated price context | Published authored DCF/exit models, dated raw-price comparisons and explicit saved-input Load/Stage/Review/Save, fresh-session comparison, Use and Calculate. Separate production storage is enabled; private invented-data persistence proof passed. | Authenticated owner Save was not exercised during release. Matching Android saved-input UI/delivery and physical acceptance remain separate. Unsaved editor inputs remain in memory. |
| Research studies and reports      | Website/API publish Price studies, explicit complete-note Preview/Append and company JSON/HTML capture. Report format 5 retains Annual 6 evidence.                                                                                                    | Earlier Android update passed by owner report. Export/file delivery and sustained use remain separate; the physical checklist did not test every feature.                            |
| Watchlist and Follow-ups          | Independent drafts, explicit Review/Save and conflict/uncertain-save recovery exist. The website also publishes explicit Watchlist draft-file capture, review and restoration.                                                                        | Controlled real-account recovery and isolated backup/restore remain open. Android 1.29 file-workflow physical acceptance remains open.                                               |
| Managed Portfolio                 | Authored schema-3 ledger, holdings/cash, Review/Save/recovery and research return are integrated in source.                                                                                                                                           | Production storage remains disabled pending persistence qualification, configuration and delivery. Price history and returns are not a delivered managed capability.                 |
| Daily use and access              | Owner reports successful update, sign-in/reopen, saved-work presence, research Back, keyboard, background/reopen and force-stop/reopen checks on 1.28.                                                                                                | Screen-reader use, durable draft restoration, sustained production use and controlled cloud recovery remain open.                                                                    |

Source and native checks establish their stated cases. The owner report adds its
requested physical checklist only. Full InvestingPro parity, controlled account
recovery and sustained use remain open. The full goal still includes broader
company discovery, news and calendars, quarterly/TTM financials, peer research
and comparable portfolio returns.

## Selected next outcome: usable managed Portfolio

Deliver the smallest complete [managed Portfolio workflow](MANAGED_PORTFOLIO.md):
opening balances, an authored transaction ledger and manual splits, exact
holdings and cash, independent Review and Save, conflict and uncertain-save
recovery, and return from company research. Reuse the existing schema-3 ledger
and calculation engine. Production Portfolio storage remains disabled until
persistence qualification, configuration and matching delivery are complete.

Keep this outcome ahead of portfolio history, additional metrics, cosmetic work
or tooling increments. Provider quotes, broker synchronization, market value,
performance, benchmarks and tax accounting remain separate capabilities. Ticker
additions are coverage fixes; selected metric rows do not complete this workflow.

A November personal release remains conditional on a usable Portfolio workflow,
matching phone delivery and acceptance, and sustained daily use. The current
website release and earlier phone checklist do not establish those outcomes.
Use the [release readiness plan](MANAGED_RELEASE_READINESS.md) for their separate
acceptance requirements.

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
new saved-input website workflow or the physical 1.29 upgrade.

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
