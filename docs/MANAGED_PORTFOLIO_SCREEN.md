# Screen companies held in Portfolio

This source increment connects the current authored Portfolio to the existing
Annual financial screen in Discover. Implementation and verification are in
progress. It uses the existing 18-listing cohort for 17 issuers and adds no
financial calculation, provider, storage resource or background request.

## Prepare the current holdings

Load Portfolio explicitly. Finish or reset pending forms and resolve its current
catalog review, save, conflict or recovery state. Applied unsaved ledger changes
can supply the holdings; saving is a separate action. The existing ledger
projection supplies positive holdings, exact shares and confirmation dates.
Sold-out registered listings are not holdings.

Open Discover and select **Load screening cohort**. This resolves catalog
identities without reading Annual reports. Open **Portfolio companies** to
review every holding's complete identity, shares, confirmation date and screening
eligibility. A holding outside this cohort or without Annual coverage remains
visible with its exclusion reason. An identity mismatch blocks application
until the existing Portfolio identity review is resolved.

If the Portfolio holds more than one eligible share class for an issuer, choose
one explicitly. No share class is chosen by default for that issuer, and an
unheld class cannot replace a held class. Unique eligible holdings are included
in their existing projection order.

If holdings or the cohort change, use **Reset share-class choices** to clear a
previous choice. This cancels its preview and changes only the local choices.
Choose any current duplicate class again before preparing a fresh preview.

## Preview and apply companies

**Preview Portfolio selection** shows the complete replacement selection and
every excluded holding with its reason. Empty, invalid, unloaded or wholly
unsupported Portfolio contents cannot clear the current screen selection.
Staged criteria and pending screen or Portfolio operations must be resolved
before Preview or Apply.

**Apply companies** changes the complete selection once. A changed selection
clears the prior run, comparison and shortlist. An identical ordered selection
keeps them. Applied criteria, sorting and raw criteria form values remain
unchanged, as do the Portfolio draft and its saved base.

Relevant changes to the source draft, catalog, choices, screen, route, session
or file activity retire a preview. Returning to earlier values does not restore
its authority. Cancel and a stale Apply leave both resources unchanged.

## Run and continue research

Select **Run screen** separately. The existing finite sequential reader requests
only the selected exact listings, with its current pacing and cancellation
rules. Inspect evidence, open company Research and use Back to return to the
retained screen and original source dates. These actions use the loaded packets.

Return to Portfolio to continue editing the same draft. Its Save remains
independent. The existing portable recipe can preserve an applied selection
when explicitly requested; this workflow adds no saved selection format.

## Design and verification scope

The controls extend the existing complete-preview and atomic-apply pattern used
by [screen recipes](MANAGED_FINANCIAL_SCREEN_RECIPES.md), with a separate Run.
Precision Desk uses wrapping identities, full readouts, labelled sections,
44-pixel controls, visible focus and stacked narrow layouts. Focus changes only
after the current initiating action commits.

Verification must cover exact projection and exclusion reasons, explicit class
choice, atomic selection, unchanged criteria and Portfolio, retired previews,
reentrant notifications and the full invented-data research journey. Source,
native, browser, APK delivery and physical-phone acceptance remain separate.
The browser stop remains in effect; no new browser acceptance is claimed.
