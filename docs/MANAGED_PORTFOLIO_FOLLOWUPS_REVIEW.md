# Review due checks for current holdings

Android 1.66 provides this workflow from accepted main
`558a08705061f02c0834fb762d1fa5bd4c166cc1`. [Current work](CURRENT_WORK.md) records
source, automated checks, client delivery and their limits separately.

## Review current holdings

In Follow-ups, explicitly load the latest Portfolio and Follow-ups versions.
Preparing a review uses the current applied drafts. It does not save either
resource or fetch company evidence. Finish pending forms, identity reviews,
recovery and file operations before preparing the selection.

Inspect every current holding and check. The readout keeps full listing and
share-class identity, exact shares, confirmation dates, complete questions and
results, raw due dates, the assessed UTC day and both resources' save states.
An open check is eligible when it is due today or overdue and its full listing
identity and catalog match a current holding. Later, completed, invalid-date,
non-held and mismatched checks remain inspectable. A holding with no check is
also visible. Each held share class can have its own eligible check.

Choose one to five checks in an explicit order, inspect the complete selection,
then start one review. An empty, duplicated, oversized or stale selection cannot
start. The whole selection must be valid before the review changes. An unrelated
active review is not replaced implicitly.

Use the existing Research and Back actions, write an assessment, complete or
reopen the current check, then continue or finish. Completion preserves the
chosen order. Save Follow-ups separately and load it again to verify the saved
result. Portfolio and unrelated authored drafts remain unchanged.

## Lifetime and unavailable states

Unloaded resources, a Portfolio that has not been set up, an invalid ledger and
valid empty holdings have distinct readouts. Missing data is not treated as an
empty Portfolio. A closed position is not a current holding.

Changes to the Portfolio, catalog, session, file activity or review inputs retire
the prepared selection. Restoring old values does not revive it. Navigation and
late or reentrant actions cannot start a stale review or move focus. An owned
Research visit and return, assessment and completion retain the running review;
an external replacement of its sources retires it. Loads do not prepare, select,
start or move focus automatically.

This workflow adds no provider, financial calculation, API route, persistence
resource or background monitoring. Existing source requests stay explicit.
