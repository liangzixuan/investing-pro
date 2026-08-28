# Cycle 2q exit matrix

Scope: establish the explicit `personal_single_user_local` filing-corpus
profile and verify its declaration plus content-addressed manifest without
claiming raw filing custody or enterprise admission. The decision is recorded
in
[ADR 0044](./adr/0044-personal-single-user-local-filing-corpus-manifest-verification.md).

Current status: **Pass only for exact source revision
`398bb280593b6de125c5561ac9dd1b1c0fe254bd`, the direct child of baseline
`2f0534d2a5b4206221cc66ece5e03cf529e5d373`.**

This is the active filing-corpus profile for the owner's personal project. It
does not change the historical enterprise-oriented Cycle 2b or Cycle 2p
results. Rights-authority/data-steward approval, multi-user controls,
production readiness, and B15/V15 are **Out of scope**, not Pass and not
Blockers, for this profile only.

| Gate                     | Required result                                                                                                                                                  | Current status |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Closed personal profile  | Declaration is exactly personal, single-user, local-only, offline research, noncommercial, and nonredistributable                                                | Pass           |
| Owned canonical inputs   | Declaration and manifest are bounded, owned `Uint8Array` snapshots containing exact canonical JSON                                                               | Pass           |
| Manifest binding         | Declaration binds exact manifest SHA-256 and matching corpus ID/version; both documents independently require schema `1.0.0`                                     | Pass           |
| Bounded inventory        | Manifest contains 1–100 accession-sorted, unique filing entries within per-entry and aggregate declared-byte limits                                              | Pass           |
| Filing metadata          | CIK, form, accepted/available/frozen time, media type, taxonomy, SEC locator, declared-digest syntax/uniqueness, and amendment lineage are closed and consistent | Pass           |
| Atomic failure           | Any invalid or hostile input produces a fresh, value-free public error without partial results or attacker-forged details                                        | Pass           |
| Bounded result           | Success returns only an immutable aggregate record with status `verified_for_personal_use`; it never returns `admitted`                                          | Pass           |
| Package isolation        | Package has zero production dependencies and is not composed into the API, web app, database, queue, fetcher, or parser                                          | Pass           |
| Exact routing            | One exact 13-path direct-child transition routes before inherited Cycle 2p/2o evidence and any other protected intersection fails closed                         | Pass           |
| Historical preservation  | Enterprise Cycle 2p implementation blob `e456cae97cf9eb377e3b3e8aabc156fdb377e2c7` and Cycle 2o evidence v5 remain unchanged                                     | Pass           |
| Local verification       | Full release gate passes 1,330 tests with 4 intentional skips; focused package suite passes 17 tests                                                             | Pass           |
| Exact-revision workflows | Every workflow triggered for the exact source revision reaches terminal success                                                                                  | Pass           |
| Rights/steward approval  | Organizational rights authority, data steward, key-authority review, and enterprise admission                                                                    | Out of scope   |
| Shared-service controls  | End-user identity, tenancy, authorization, customer privacy operations, and multi-user isolation                                                                 | Out of scope   |
| Production gates         | B15/V15, KMS, queues, load/SLOs, incident readiness, and production authorization                                                                                | Out of scope   |
| Payload identity         | Read actual local filing bytes and prove presence, bounded size, and equality with each declared content SHA-256                                                 | Next blocker   |

## Bounded conclusion

For the exact promoted source only, a caller can prove that one closed personal
declaration binds one structurally valid, bounded filing manifest and receive a
minimal aggregate verification record. The verifier snapshots inputs before
parsing, rejects duplicate or noncanonical JSON, validates the complete closed
schema, and fails atomically.

`verified_for_personal_use` means manifest metadata was verified. It does not
mean a filing payload exists, that its bytes match the declared digest, that
SEC supplied it, or that any parser output is correct. It is not an enterprise
admission result.

The exact successful claim is
`bounded_content_addressed_manifest_verified_for_personal_single_user_local_use`.

## Exact source transition

The promotion is one direct child:

1. baseline `2f0534d2a5b4206221cc66ece5e03cf529e5d373`;
2. source and promoted revision
   `398bb280593b6de125c5561ac9dd1b1c0fe254bd`.

The NUL-delimited `git diff --name-status --no-renames -z` transition has 13
paths, 26 NUL fields, 775 bytes, and digest
`sha256:a780c8a8fc65a204c41e5daf05b6ac2120f6a3d952d2e677c7775879c6270ff8`.
It consists of the workflow, both independent evidence verifiers and their
tests, the six-file personal package, the lockfile, and the boundary guard. The
protected surface adds the immutable enterprise
`packages/filing-parser/src/corpus-admission.ts` as its fourteenth path.

Both independent offline boundaries accept the exact committed source. The
cross-engine route typechecks and tests the personal package, emits no Cycle 2q
artifact, and cannot replace or inherit Cycle 2o version 5 evidence at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`.

## Verification record

Full local verification passed 1,330 tests with 4 intentional skips. The
focused personal package passed 17 tests. Every exact-source workflow reached
terminal success:

- CI run `33125521900`: Windows job `98702620717` and Ubuntu job
  `98702620941`;
- normalization execution run/job `33125521872` / `98702620690`;
- cross-engine execution run/job `33125521890` / `98702620795`, with no
  Cycle 2q artifact by design;
- parser isolation run/job `33125521898` / `98702621112`;
- PostgreSQL acceptance run/job `33125521899` / `98702620875`;
- payload custody run/job `33125521910` / `98702620781`; and
- Dependabot dynamic run/job `33125607844` / `98702902403`.

The standard parser, custody, and normalization runs are regression health,
not Cycle 2q evidence. No independent artifact review is claimed because the
personal route creates no artifact.

## Profile boundary

The personal profile remains applicable only while all of these facts remain
true:

- one owner uses the corpus locally;
- no account, tenant, team, customer, or shared service is introduced;
- use remains noncommercial and filing payloads are not redistributed; and
- the project is not operated as a production service.

If any fact changes, the newly applicable identity, authorization, rights,
privacy, operational, and production gates must be reopened before that wider
use. External law and source terms still apply; this profile decision only
removes inapplicable internal enterprise approval machinery.

## Next blocker

At the Cycle 2q exit, the next blocker was a bounded streaming local-payload
verifier: define and validate one deterministic accession-to-relative-path
mapping (or a separately manifest-bound local path map), accept an exact
manifest record plus a caller-selected local root, reject links and path escape,
stream each expected payload within declared and aggregate byte limits,
recompute SHA-256, and return an aggregate-only result. Until Cycle 2r supplied
that later capability, real payload presence and digest equality remained
unverified.

## Payload-identity follow-on

Cycle 2r later adds that bounded verifier capability at exact source revision
`e15ddd8aa923a43fdca730e233abfbe684101e78`. It reuses and re-verifies the
Cycle 2q declaration and manifest inputs, fixes the direct-root
`<accession>.payload` mapping, and can establish presence, declared length, and
SHA-256 equality for the bytes observed during one successful invocation.

This follow-on does not revise Cycle 2q's source, status, claim, or historical
conclusion. `verified_for_personal_use` remains a manifest-only Cycle 2q
record. Cycle 2r has its own
`payload_identity_verified_for_personal_use` status and does not prove any
specific owner corpus without a successful invocation over that corpus. The
next source milestone is bounded local custody, audit metadata, retention, and
owner-managed deletion. See [ADR 0045](./adr/0045-personal-local-filing-payload-identity-verification.md)
and the [Cycle 2r exit matrix](./CYCLE_2R_EXIT_MATRIX.md).

## Exit rule

Cycle 2q is Pass only for the exact source transition above and only for the
declared personal profile. Enterprise Cycle 2b/2p history remains true but is
not on the active path. Raw payload identity, source authenticity, parser
correctness, adjudicated quality, enforced retention/deletion, and any wider
profile remain unproven.
