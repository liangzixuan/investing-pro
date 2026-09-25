# Engineering audit

Reviewed September 24, 2026 against the owner's current global AGENTS.md.
Scope: application structure, existing dependencies, release workflow, active
planning documents, Spec Kit and FinanceDatabase. This is a source/document audit,
with a bounded public directory sample. It is not a full security, performance or
provider-entitlement assessment. The accepted app remains a77; no application
code or release policy was changed by this audit.

## Verdict

The project partly follows the principles. It already uses established libraries,
separates several domain engines and preserves a working release during changes.
Its main weaknesses are accumulated orchestration, coupled data requests,
executable release history and too much historical material in active guidance.
The next Markets-home layer should correct those seams without replacing the app.

| Owner principle                                      | Finding                                                                                                                                                                                         | Action                                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do not preserve backward compatibility               | Saved financial-view payloads still accept versions 1 and 2. Release inventory accepts only additions/modifications, preventing ordinary removal of old code.                                   | Change current interfaces and callers together. When retiring a saved format, use a deliberate data-preserving migration; do not retain an old runtime API solely for compatibility. Enable normal deletion in the reviewed release-process redesign. |
| Simplest implementation meeting current requirements | Ordinary product changes require a separate nine-file generated routing closure and exact historical commit arithmetic. Active guidance had 1,084 lines.                                        | Keep the feature spec small; shorten active guidance now. Review a release design based on current source identity, relevant changes and test evidence, rather than every old case's generated code.                                                  |
| Grow in working end-to-end layers                    | Isolated accepted runtime/rollback is useful. Recent parser increments produced no admitted quarters in four retained real files.                                                               | Keep the working app. Deliver the bounded market-page-to-company journey before broader layers; keep the parser investigation parked.                                                                                                                 |
| Modular components and separated concerns            | Domain packages and Fastify route modules are useful. The 4,331-line discovery component owns many resource lifetimes, saved mutations and navigation. Quote/history share one failure outcome. | Extract only the shell/current-company/data coordination needed for Markets home; keep tested panels. Separate quote availability from EOD history.                                                                                                   |
| Established maintained libraries                     | Next/React, Fastify, ECharts and decimal.js are already direct dependencies.                                                                                                                    | Use them for routing, transport, charts and decimal arithmetic. A new UI framework or Python web service is unnecessary for the next layer.                                                                                                           |
| Check existing dependencies before custom code       | Installed Next types expose routing/links; installed ECharts types include datasets, line/candlestick series, zoom and accessibility options. Existing charts already use ECharts.              | Reuse those capabilities. A library's numeric operations do not replace financial definitions, provenance checks or safe source parsing.                                                                                                              |
| Durable architecture                                 | Current personal company routes redirect to Discover; selection lives in component state. Symbol handling is tailored to admitted U.S. equities.                                                | Build direct routes around a shared workspace lifetime and stable listing identity. Introduce new asset types and explicit provider mappings with their first working flow, rather than casting them as stocks.                                       |
| Study proven products                                | The earlier notebook brief diverged from the intended portal. The September 24 roadmap now adopts the owner's Investing.com reference.                                                          | Use market-board, chart, instrument-page and secondary-panel conventions. Spec Kit supplies an established feature workflow; FinanceDatabase supplies directory candidates.                                                                           |

## Findings that affect the next outcome

### 1. EOD history is coupled to quote access

`apps/api/src/personal-market-data-provider.ts:571` begins `loadOverview`;
the `Promise.all` at lines 606-609 requires both IEX quote and EOD history.
The [price-screen guide](./PERSONAL_PRICE_VALUATION_SCREEN.md#acquisition-and-lifetime)
already records that a quote entitlement failure can prevent otherwise available
EOD data. Range changes also request both through this combined operation.

Separate the operations and their availability states in the next data layer.
An EOD market board must work when EOD is available and quotes are denied. Update
the relevant API/client callers together, with cancellation, source identity and
partial-failure tests. No new feed entitlement is assumed by this recommendation.

### 2. URL navigation and resource lifetime need a clear boundary

`apps/web/app/research/[symbol]/page.tsx:22` redirects the personal workspace to
Discover. The 4,331-line `SecurityDiscoveryWorkspace.tsx` combines selection,
navigation, watchlist mutations and many asynchronous resource guards. Its size
and responsibility count indicate change risk, not a measured race or speed defect.

Use the existing Next router and a shared client layout for workspace/session
lifetime. Keep page-specific presentation and resource coordination in separate
modules. Direct company navigation must resolve the actual listing and preserve
drafts/current guards; a new URL alone is insufficient. Avoid a wholesale rewrite.

### 3. Release history has become a live development constraint

`scripts/release-classification.ts:109` accepts only `A` and `M` inventory entries.
Its `assertCount`/`inspectRelease` path validates fixed total/first-parent commit
counts and walks every prior case back to a14. The
[release guide](./RELEASE_CLASSIFICATION.md) requires a separate nine-output
closure and forbids merges in the classified sequence.

At this audit, the two generated verifier sources contain 34,438 and 33,159 lines.
Three generated workflow files are 404,283, 193,091 and 412,631 bytes. These are
file measurements, not measured CI runtime or proof that every line is redundant.

A durable replacement should preserve current artifact/source binding, financial
and security behavior tests, native/hosted outcomes and rollback. Historical
receipts can remain immutable records. Normal product releases should not need
new branches of executable historical routing. Acceptance for that maintenance
change must include file deletion/rename, ordinary Git history, correct affected
checks, explicit required-job failure handling and retained raw evidence.

Do not delete checks, increase size limits or bypass the current gate during the
Markets-home work. Prepare the workflow replacement as a bounded change; a broad
CI rewrite is not a prerequisite for the first useful page.

### 4. Old payload support needs an explicit retirement decision

`packages/contracts/src/personal-financial-screener.ts:335` exposes the union of
saved-view payload versions 1 and 2. That is actual compatibility behavior, unlike
an immutable old test receipt. The owner no longer requires compatibility layers.
Retire obsolete schemas when that workflow is changed, with an explicit migration
that preserves saved criteria/columns. Deleting owner data is not simplification.
This audit did not read or modify the owner's saved records.

### 5. The initial market board needs an explicit coverage boundary

A subsequent bounded source probe resolved AAPL, MSFT and WMT through the local
admitted catalog, but found no matches for JPM, XOM or JNJ. The three admitted
listings each returned 22 history bars and an IEX-derived reference through the
existing overview route. The missing catalog identities were never submitted to
the provider, so this does not establish a Tiingo coverage failure.

Start with the declared verified cohort and record catalog admission separately
from provider availability. FinanceDatabase can supply candidates for later
admission; its directory size does not establish this app's usable coverage.
The first [source-probe record](../specs/001-markets-home/plan.md#initial-source-probe-september-24)
also records unverified refresh limits, date labeling and partial-feed behavior.

## Toolkit decisions and applied improvements

### Spec Kit: adopt the feature workflow and templates

The [v1.0.11 templates](https://github.com/github/spec-kit/tree/v1.0.11/templates)
organize prioritized user stories, a technical plan and tasks around observable
outcomes. The first manual adaptation is
[specs/001-markets-home](../specs/001-markets-home/spec.md), with plan/tasks beside
it. [The adoption note](../specs/README.md) records exact upstream sources,
license and changes. No CLI, generated agent skills or branch scripts were run.

Use AGENTS.md and the product roadmap as the principles instead of maintaining
another constitution. Consolidate small research/contracts/run notes in the plan.
Remove already-satisfied setup/authentication examples. Required tests remain
explicit; a convergence review is not a release pass. The official
[existing-project guide](https://github.github.io/spec-kit/guides/existing-projects.html)
supports starting with one bounded feature rather than retroactively specifying
the entire codebase. Its compatibility examples do not override this owner's rules.

### FinanceDatabase: adopt selectively as directory input

The [project](https://github.com/JerBouma/FinanceDatabase) provides instrument
metadata, not current prices or fundamentals. Version 2.4.0 and main revision
`d0b95bd51f9c594c81bac0b20c7ab6cbd084c51e` were reviewed. A bounded read inspected
642 records across seven CSV prefixes (265,404 bytes); no broad coverage rate
can be inferred from those convenience samples.

The samples contain useful MIC/identifier fields and equity delisting flags,
but the equities category also includes rights, units, warrants and ETF/ETN
entries. Other sampled asset schemas lack per-record dates and delisting fields.
The primary-listing helper uses absence of a dot in the symbol, which cannot
establish our listing identity. The Python package also brings FinanceToolkit;
installing it solely for CSV discovery is unnecessary.

Use a pinned, attributed directory snapshot and the existing import workflow or
standard CSV tooling for a selected cohort. Keep source asset classification,
currency/MIC, identifiers, delisting information and unresolved mappings explicit.
Do not fabricate a CIK or reuse the current dot-to-hyphen mapping for all assets.
Provider access and allowed display/retention remain separate. Do not promote the
entire directory into the owner's catalog or add a Python service. The existing
supported cohort can supply the first Markets-home layer while this broader
directory integration is prepared.

### Active guidance shortened

`CURRENT_WORK.md` now contains the next outcome, current/parked status and working
loop. Its previous delivery narrative is preserved in
[DELIVERY_HISTORY.md](./DELIVERY_HISTORY.md), with the archived text verified
against the pre-edit copy. Existing release requirements remain in the active
loop and release guide. The feature spec/task list owns upcoming work; history
does not become another active queue.

## Evidence and limits

Independent source reports and public sample evidence are in workspace
`tmp/engineering-audit-20260924/`: `architecture-audit.md`, `spec-kit-fit.md`,
`finance-database-fit.md` and `finance-database-public-samples.json`.
The inventory uses the current working source; the parked compact changes remain
unreleased. New specs are planning artifacts, not a delivered market page.

No new package, provider acquisition through configured credentials, login,
owner-record write, application build, commit or release was performed for this
audit. Formatting, link/history checks and independent document review validate
these changes. Application behavior will be verified when its code changes.

After completing the audit, T001 used the existing configured local API for three
public-listing overview requests. That subsequent development step returned the
results above and retained only operational outcomes and public identities.
Its source-derived upstream bound is six requests, not an instrumented count.
No owner records were changed, and no new build, commit or release followed.
