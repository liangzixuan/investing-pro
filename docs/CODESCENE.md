# CodeScene reviews

Use CodeScene to identify maintenance risks in the Investment code already being
changed. Existing tests, security boundaries, CI and deployment acceptance remain
required. A code-health score is a maintainability signal, not proof of a defect
or a successful release.

## Working loop

Before a substantial change, retrieve the latest hosted analysis and record its
repository revision. Review the affected files' code health, change frequency and
refactoring targets. Compare that revision with the local work: hosted results
do not assess unpublished commits or uncommitted changes.

Prioritize findings that affect the planned feature or a frequently changed
component. Confirm each finding in current source, choose a small change that
preserves behavior, and run the relevant existing tests. Record deferred findings
in the feature plan when they matter; avoid broad cleanup to raise a score.

During PR review, inspect CodeScene's findings alongside test results. Start with
the provider's Bare Minimum profile and Check Run annotations. Keep it advisory
for release decisions. Verify execution on the next substantive Investment PR
before claiming that automatic reviews work. Do not create a dummy PR or weaken
an existing check for setup.

Use CodeScene's native GitHub integration. It does not need another build/test
workflow or a copy of the local token in GitHub. The Appwrite release verifier's
existing workflow inventory stays unchanged.

## Credentials and reports

The project is [Investment, 85364](https://codescene.io/projects/85364), bound to
`liangzixuan/investing-pro` and its published `main` branch. Use PowerShell 7 as the
signed-in Windows user from the repository root:

```powershell
pwsh -NoProfile -File .\scripts\codescene\Get-InvestmentCodeScene.ps1 -ProjectId 85364 -IncludeRefactoringTargets
```

The command retrieves a report when needed; it does not trigger a new analysis.

The owner authorized reuse of the existing account-level CodeScene PAT. Windows
stores it as an encrypted SecureString outside the repository, under
`%LOCALAPPDATA%/Nourishing/CodeScene/rest-api-token.clixml`. The directory name is
historical; the credential has account scope. Do not copy it into this repository,
print it, pass it on a command line or run the credential setter again.

The Investment reader uses the credential in memory for requests to the fixed
CodeScene API origin. It verifies the project and repository, refuses redirects,
and binds file findings to the same analysis ID and source revision. Missing
scores remain missing. Reports contain selected analysis data, not credentials
or developer profiles.

The default file list is limited to ten files ordered by change frequency.
Refactoring targets are a separate list; preserve its pagination limits and do
not treat list order as a verified priority ranking.
An affected file missing from this excerpt may still have findings. Inspect its
CodeScene file view or the native PR review before drawing a conclusion.

## Launch priorities

When production authentication and shared data are connected, review changes to
the session adapters, request retirement, watchlist transactions and Appwrite
transport. Keep their existing authorization, stale-response and uncertain-save
tests intact.

Research and Markets UI are candidates for hotspot assessment as their connected
workflows are expanded. Distinguish product code from historical release evidence
and current safety tooling when interpreting results. File size alone is not a
reason to postpone the launch or refactor unrelated code.

## References

- [CodeScene public API](https://codescene.io/docs/integrations/rest-api.html)
- [PR integration and quality profiles](https://codescene.io/docs/guides/pr-integration/integrate-into-ci-cd.html)
- [Code health terminology](https://codescene.io/docs/terminology/codescene-terminology.html#code-health)

## Setup checkpoint

On September 30, 2026, the Investment project was created for the sole repository
above with `main` selected. Native PR integration is enabled with the explicit
Bare Minimum profile, Check Run annotations and Always comment off. The owner
approved the daily baseline at 03:00 America/Chicago; that schedule is saved.
The email-report recipient list is empty. Existing GitHub checks, branch
protection and the Appwrite delivery workflow were not changed.

The initial analysis is [7746695](https://codescene.io/projects/85364/jobs/7746695/results).
At the first API verification on September 30 at 05:11 UTC, CodeScene reported
it running and returned no completed analysis. The reader correctly emitted
`latest_analysis_unavailable`, with null scores and no analyzed revision. Later
baseline results belong in workspace `CURRENT.md` and `tmp/codescene`, separate
from that initial observation.

The source-reviewed reader passed syntax validation and those two authenticated
GETs. Full file/target retrieval requires a completed analysis. The first native
PR review remains unverified: the seven open PRs at setup were dependency updates,
and none was changed or triggered for this task. Verify the next substantive PR.

An earlier API project-creation attempt returned 403 and was not retried. The
normal provider UI subsequently created the project. Two browser approval holds
were resolved before their actions: public GitHub metadata corrected the private
repository assumption, and the owner explicitly approved the daily schedule.
Retained setup evidence is outside Git under `tmp/codescene`; no token or private
configuration is stored with it.
