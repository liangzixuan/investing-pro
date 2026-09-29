# Current filing acceptance

Current CI evidence binds the checked-out source revision and freshly executed
acceptance cases. Historical release classifiers describe the revisions for
which they were written. Their commit counts do not admit or reject a new
feature branch or GitHub pull-request merge.

The current contracts are parser isolation schema `2.0.0`, payload custody
schema `2.0.0`, and cross-engine execution schema `6.0.0`. Each records a closed
source-boundary policy and the actual revision. The parser and custody records
use evidence version `2`; the cross-engine record uses version `6`.

## Source and execution

The producer requires the actual Git `HEAD` to match `GITHUB_SHA`. For a pull
request, that can be GitHub's integration merge commit. The offline review uses
the same revision, repository, run ID and run attempt. A pull request's branch
head must not be substituted for the merge that actually ran.

Both sides verify regular committed source files against their recorded hashes,
the complete execution inventory and a clean worktree. Git replacement refs,
effective grafts and caller-supplied repository or object substitutions are
rejected. The producer checks source identity before execution and again before
emitting evidence. Source movement cannot inherit a successful receipt.

The fixed ancestor `65cb08c94dd8767d1a59b01dd1b7a355d5c5667e` identifies the
preserved desktop history. It does not impose a current commit count or a
single-parent restriction. Normal descendants and two-parent merges must still
pass the actual current source checks and all required cases.

Parser and payload verification retain their historical checks at that anchor
and check their declared domain file inventories at the current revision.
Cross-engine verification retains its historical transition assertions at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`. Current cross-engine execution reuses
the existing case, image, runtime, custody and quality predicates. A historical
routing success is not current execution evidence.

## Artifacts and release use

Current parser and payload artifacts use `v2` names. Current cross-engine
artifacts use `v6` names. The producer path, offline-review path and uploaded
artifact must refer to the same canonical bytes. Their SHA-256 and exact source
revision are checked before acceptance.

The existing dedicated workflows still require their real isolation or custody
cases, offline canonical review and successful artifact upload. Package tests
and source review are useful local checks; they do not establish those hosted
outcomes. The Appwrite release workflow additionally requires every applicable
main-push job to succeed at its exact source revision before deploying staging.

The retained [parser evidence](./FILING_PARSER_ISOLATION_EVIDENCE.md),
[payload evidence](./FILING_PAYLOAD_CUSTODY_EVIDENCE.md) and earlier cross-engine
records keep their original schemas, hashes and qualified claims. Their
historical verifiers remain in Git. These records are not rewritten as proof
of a later commit. The workspace `CURRENT.md` records actual new-run status;
this guide describes the contract and does not claim a passing cloud run.
