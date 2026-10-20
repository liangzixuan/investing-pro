# Current work

Updated October 19, 2026. This is the current capability and delivery record.
The [roadmap](PRODUCT_ROADMAP.md) defines the broader InvestingPro goal.
[Historical work notes](WORK_HISTORY_20261017.md) preserve earlier implementation
and test reports; their pending labels do not describe current status.

## Current capability and delivery status

The website publishes product and controller
`6ca5e0dbc648914eb36401f008d56809e56b0a60`. Its
[tested archive promotion](https://github.com/liangzixuan/investing-pro/actions/runs/39195520174)
passed after staging and BrowserStack acceptance. Fresh deployment metadata and
the served public entry page match the accepted archive. This publishes explicit
Watchlist draft-file capture, review and local restoration. The API retains
`f43796794320286fd9c1ce02d7472c454519953e`; no API or saved-data change was needed.
The October 18
[production promotion](https://github.com/liangzixuan/investing-pro/actions/runs/39117654678)
passed all 12 job steps. Its receipts and fresh metadata confirm the matching
API/site pair and unchanged settings. Matching Android 1.28.0, code 29, was
prepared with the existing production signer. Matching Android 1.29.0, code 30,
is also prepared from `6ca5e0db`. Its package, production signer and bundled source
marker passed artifact review. Installation and physical acceptance of 1.29
remain open. On October 18 the owner reported
a successful 1.27-to-1.28 update and passes for all four requested physical
checks. This accepts the reported upgrade and checklist; no independent device
inspection or per-step logs were collected.

| Capability                        | Current source and scope                                                                                                                            | Delivery or acceptance still needed                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markets and Price                 | AAPL, GOOG and GOOGL: three listings for two issuers. Dated raw USD closes; no adjusted-return or live-quote claim.                                 | Broader lawful coverage and complete market discovery.                                                                                                     |
| Annual statements and screening   | Canonical Annual 6 explorer and explicit screening are published on the website/API. Defined cohort: 18 listings across 17 issuers.                 | Matching Android update and requested checks passed by owner report. Quarterly, TTM, custom-taxonomy and broader statement coverage remain open.           |
| Filings                           | Merged source independently admits 17 issuers; the published API retains three.                                                                     | Expanded API/client delivery remains open. Screening or Annual eligibility does not establish Filings eligibility.                                         |
| Screening comparison              | Published website/API source connects two loaded results, three statement groups, independent sources, either company's research and retained Back. | Requested Android screen/comparison/research Back check passed by owner report. Sustained use and controlled recovery remain open.                         |
| Valuation and dated price context | Authored DCF/exit models and dated raw-price comparisons are integrated. The source candidate adds explicit saved-input review, Save and restore.   | Published inputs remain session-only. New storage defaults disabled; provisioning, real persistence and matching delivery remain open.                     |
| Research studies and reports      | Website/API publish Price studies, explicit complete-note Preview/Append and company JSON/HTML capture. Report format 5 retains Annual 6 evidence.  | Matching Android update passed by owner report. Export/file delivery and sustained use remain separate; the physical checklist did not test every feature. |
| Watchlist and Follow-ups          | Independent drafts, explicit Review/Save and conflict/uncertain-save recovery exist.                                                                | Controlled real-account recovery and isolated backup/restore remain open; in-memory tests are not cloud persistence proof.                                 |
| Managed Portfolio                 | Authored schema-3 ledger, holdings/cash, Review/Save/recovery and research return are integrated in source.                                         | Production storage remains disabled pending configuration and persistence qualification. Price history and returns are not a delivered managed capability. |
| Daily use and access              | Owner reports successful update, sign-in/reopen, saved-work presence, research Back, keyboard, background/reopen and force-stop/reopen checks.      | Screen-reader use, durable draft restoration, sustained production use and controlled cloud recovery remain open.                                          |

Source and native checks establish their stated cases. The owner report adds its
requested physical checklist only. Full InvestingPro parity, controlled account
recovery and sustained use remain open.
The full goal still includes broader company discovery, news and calendars,
quarterly/TTM financials, peer research and comparable portfolio returns.

## Selected next outcome: editable saved valuation inputs

Coherent company research is merged through PR199 at `abf1646`. Its PR and main checks pass, including
58 synthetic Android cases and the exact-main source proof. Six of 159 PR frames
were reviewed and reused for the identical main tree. Expanded Filings delivery
remains separate; the live API still admits three Filings issuers.

PR200 merges explicit saved valuation inputs at `aa27ebdd`: Load,
complete input review, Stage, independent Review and Save, then fresh-session
read, complete comparison, explicit Use and Calculate. Its PR checks pass,
including 59 synthetic Android cases and review of four retained screens.
Automatic main checks and their source proof pass for that revision. The
[valuation guide](MANAGED_VALUATION_WORKBENCH.md) defines the workflow and bounds.
The fourth saved resource defaults to disabled on the server. No new live
storage, provisioning, persistence qualification or release is accepted yet.

The [private valuation storage proof](MANAGED_VALUATION_STORAGE_PROOF.md) prepares
the next storage layer with invented identities and inputs. Its fixed phases
check schema readiness, competing saves, replay, rollback, uncertain commits,
the exact payload ceiling and fresh reads. Local tests and a reviewed private
bundle pass within their recorded scopes. Cloud provisioning and execution
remain separate; the application storage switch stays disabled.

The first authorized storage attempt created the isolated schema, then stopped
at metadata admission before function deployment or row writes. The service
returned empty description fields that the strict inspector did not recognize.
The source correction accepts those empty fields at database, table and column
level while retaining all schema and access checks. The retained cloud metadata
passes the corrected inspector locally; an executed persistence proof remains open.

The website draft-file release, matching Android artifact and owner-reported
earlier Android upgrade/checklist are accepted within their recorded scopes.
Controlled storage recovery and accessibility remain open. Use the
[release readiness plan](MANAGED_RELEASE_READINESS.md) for the separate acceptance
requirements; the update report does not close these remaining checks.

The [isolated Watchlist restore proof](MANAGED_WATCHLIST_RESTORE_PROOF.md)
prepares fixed invented-data checks around Appwrite's native backup service.
The owner deferred this optional cloud drill on October 18. Its execution stays
disabled; source checks do not establish an executed restore or owner backup.
The website now includes [Watchlist draft files](MANAGED_WATCHLIST_DRAFT_FILES.md):
explicit file capture, complete review and local restoration, followed by
independent catalog review and the normal online Save. This does not provide
automatic draft storage or confirmed-record recovery. Source and synthetic native
qualification and matching Android artifact review passed. Real file delivery
and physical acceptance remain separate.

The merged research-source increment aligns independent Price, Annual and Filings eligibility
across the named screening cohort. It reuses the current source cards, explicit
reads, captured Annual handoff, cited-note actions, normal Save and retained Back
state. Price remains limited to its three qualified listings. Expanded Filings
requires its own API admission and delivery; the current live API still admits
three issuers. Captured-source parser qualification does not activate that scope.
Affected model, view and native-fixture tests pass for the candidate. These include
the complete AMD screening, captured Annual, explicit Filings, note Preview/Append,
Review/Save and retained Back flow with invented financial values. Request and
captured-response checks also reject a different issuer's evidence when the known
listing selection has no CIK. Source integration and release checks remain separate.

Staging run `39195015502`, attempt 1, passed its deployed-origin BrowserStack
checks. Production run `39195520174` promoted that exact archive without a rebuild
or repeated staging/browser test. Fresh metadata confirms the new website and
retained API; the public entry page matches the archive. No restore was needed.
These checks do not establish authenticated saves or physical file delivery.

The owner resumed browser testing on October 18 and separately approved this
production sequence. Both operations are complete; preserve original approvals,
rejections and receipts without replaying consumed actions. Keep unchanged
source/native/staging evidence closed and use Chrome for any newly authorized
browser work. No browser permission is pending for the completed release.

Complete editable valuation persistence, then managed Portfolio storage/recovery.
New portfolio-history work is deferred
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
