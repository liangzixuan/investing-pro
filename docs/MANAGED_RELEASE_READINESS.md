# Coordinated managed release readiness

Updated October 18, 2026. The selected outcome is one matching API, website and
Android release followed by explicit daily-use qualification. This plan does not
authorize deployment, browser work, signing-key access, resource provisioning or
installation. Use the actual task authorization for each operation.

## Candidate and current release

The product candidate is merged source
`f43796794320286fd9c1ce02d7472c454519953e` (PR188), tree
`b2d7ff4364180cf5131cc31a165691e15d81e98c`. Its PR checks and 51 synthetic native
tests pass. Six bounded native content frames were reviewed. The reviewed
maintenance warnings were accepted for that exact source merge only.

All four final-main jobs pass, covering 177 listed steps with the expected
platform-only skips. The actual main native run executed 51 tests with no
failures, errors or skips against the exact source. The six bounded exact-tree
PR frames are reused. This qualifies source within that scope; it does not
establish deployed or physical-device acceptance. Keep completed checks closed.

The verified live API and website remain on product `c270131`; signed Android
1.27.0, code 28, is delivered but physical installation is unverified. The
candidate has Annual canonical version 6 and company report format 5. Matching
local API and website artifacts and a signed Android 1.28.0, code 29, package are
prepared with recorded identities. This local qualification does not establish
staging acceptance, API activation, website promotion, package delivery or
physical installation. A future staging website archive needs its own matching
provenance and browser acceptance.

## Acceptance matrix

| Stage                                  | Required result                                                                                                                                  | Current limit and next action                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source qualification                   | Exact revision, applicable final-main jobs, reviewed diff and unchanged protections.                                                             | Product final-main checks are complete. Keep the immutable candidate and original failures; do not repeat unchanged checks.                                               |
| Offline artifacts                      | Clean exact-source API/site archives and signed APK with recorded hashes, version, package, signer and provenance.                               | Matching local artifacts are prepared. Retain their hashes and provenance; a future staging archive needs separate qualification.                                         |
| API and website compatibility          | Matching Annual/report contracts, session/origin boundaries, draft-retention guidance and reviewed prior deployment pairs.                       | Review the coordinated sequence before any upload or activation. No API-only rollout.                                                                                     |
| Website staging and browser acceptance | Existing mandatory deployed-origin checks for the same archive before promotion.                                                                 | Browser testing resumed October 18. Actual tool rejection still blocks the prepared staging dispatch. Preserve that reason; do not retry indirectly or weaken the checks. |
| Signed Android delivery                | Matching source/version/signer, prior APK retained and packaged behavior accepted.                                                               | Android 1.28.0, code 29, is signed and locally qualified. Delivery and installation remain open. Retain the prior 1.27 package.                                           |
| Controlled storage recovery            | Isolated invented-data load/edit/Save/fresh-read, conflict, uncertain-save reconciliation and expiry against the intended backend.               | Open. In-memory tests do not establish real-account recovery. Do not write QA records into owner resources.                                                               |
| Backup and restore                     | Isolated recovery of the intended data and receipts, with measured retained evidence.                                                            | Open. Preserve live records; use the reviewed qualification procedure and its actual authorization.                                                                       |
| Accessibility                          | Keyboard and screen-reader navigation through the affected complete workflow.                                                                    | Open. Native screenshots and source inspection do not establish screen-reader use.                                                                                        |
| Physical upgrade                       | Verify installed version, preserve wanted drafts, upgrade through the supported flow, reopen saved work and test native Back/session boundaries. | Open. No phone version or failure is inferred. Do not uninstall, clear data or assume APK downgrade support.                                                              |

## Operational sequence

1. Finish source qualification and select the immutable release revision.
2. Prepare the matching artifacts and verify their identities without activation.
   Keep private configuration and signing custody out of Git and logs. The
   configured build scripts and their clean-source checks remain authoritative.
3. Review a concrete deployment, compatibility and rollback record before any
   missing operational approval is requested. Use the established email channel
   once per unresolved request. Do not repeat an already answered request.
4. Use the current task's browser authorization and exact operational scope for
   the existing staging/browser gate. Browser testing resumed October 18. An
   actual tool rejection remains a separate restriction; preserve its reason and
   do not retry indirectly. Continue independent offline/API/CLI preparation.
5. Promote the accepted archive, deliver the matching signed package and record
   each result separately. Installation and daily-use acceptance stay explicit.

Before an APK upgrade, restore compatible API and website revisions together if
rollback is needed. After upgrade, an old API alone can be incompatible with the
new client. Keep all prior artifacts and the actual rollback identities. Never
equate a retained old APK with a safe automatic downgrade.

## Follow-on product work

After the delivery and daily-use outcome, align one useful named universe across
Price, Annual and Filings, with independent eligibility, dates and refusals. Then
complete saved editable valuation models and managed Portfolio persistence and
recovery. Existing Watchlist notes and captured reports do not provide editable
model storage. The original broader InvestingPro roadmap remains open.
