# Cycle 2s exit matrix

Scope: add bounded local payload-custody recording and explicit
owner-triggered live-payload deletion capabilities for the active
`personal_single_user_local` profile. This source promotion uses generated
temporary fixtures only; it does not claim that a particular owner corpus was
operated, that retention is automatically enforced, or that deletion reaches
copies outside the selected live payload root. The decision is recorded in
[ADR 0046](./adr/0046-personal-local-filing-payload-custody-and-owner-deletion.md).

Current status: **Pass only for exact source revision
`78b3880632ff7e54ac493e9c208ee1d93a275aa1`, the direct child of promoted
Cycle 2r documentation baseline
`a13b51d2cd6862029aa598829e40209ce178c7be`.**

| Gate                                    | Required result                                                                                                                                                          | Current status              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Inherited verification                  | Owned Cycle 2q documents are reverified and Cycle 2r payload identity succeeds over the current exact live set                                                           | Pass                        |
| Separate bounded roots                  | Existing canonical payload and audit roots are distinct, non-root, nonnested, and observed with bigint identity                                                          | Pass                        |
| Location binding                        | Unkeyed domain-separated SHA-256 covers canonical root paths plus observed identities; plaintext paths are not returned, but digest secrecy/unlinkability is not claimed | Pass (bounded claim)        |
| Exact audit inventory                   | Only the fixed canonical custody/intent/receipt names and one allowed in-flight pending name are accepted                                                                | Pass                        |
| Custody publication                     | Canonical aggregate record uses exclusive pending creation, synchronization, destination-absence observation, same-directory rename, and reread                          | Pass (active-race nonclaim) |
| Exact custody binding                   | Record binds declaration, manifest, runtime payload-identity result, location, path mapping, platform link assurance, counts, and bytes                                  | Pass                        |
| Retention semantics                     | `retentionTargetAt` records custody time plus declared days, without claiming a minimum hold, scheduler, or deadline enforcement                                         | Pass (metadata only)        |
| Explicit delete intent and scope inputs | Caller supplies the fixed confirmation literal and expected custody-record digest                                                                                        | Pass (not authentication)   |
| Intent before unlink                    | Append-only canonical intent is published before any selected live payload unlink                                                                                        | Pass                        |
| Narrow deletion target                  | Only manifest-derived direct children are considered; no recursive removal or payload-root deletion occurs                                                               | Pass                        |
| Pre-unlink observation                  | Each present selected file is boundedly rehashed and its path/descriptor identity is observed before unlink                                                              | Pass (bounded claim)        |
| Retry and partial failure               | Already-missing names are accepted only after validated intent; no terminal receipt is minted while any live-root name remains                                           | Pass                        |
| Terminal absence                        | Every selected name is absent and the exact live payload-root inventory is empty; the empty root remains                                                                 | Pass                        |
| Aggregate result                        | Frozen results return no plaintext root paths, accessions, per-file digests, or bytes; location-digest secrecy and resistance to offline guessing are not claimed        | Pass (bounded claim)        |
| Safe pending recovery                   | Only complete canonical pending bytes meeting the record-specific bindings may be promoted; arbitrary, partial, linked, or invalid candidates remain untouched           | Pass (bounded retry only)   |
| Exact routing and history               | Exact 11-path direct child routes before inherited Cycle 2r/2q/2p/2o; 19-path protected surface fails closed; no Cycle 2s CI evidence artifact; prior history preserved  | Pass                        |
| Local verification                      | Full release gate passes 1,405 tests with 8 intentional capability skips; focused personal package passes 80 with 4 skips                                                | Pass                        |
| Exact-revision workflows                | All five workflows triggered for the exact source reach terminal success                                                                                                 | Pass                        |
| Specific owner corpus                   | One owner-selected declaration, manifest, payload root, and separate audit root complete a custody invocation outside Git                                                | Next operational blocker    |
| Authenticity, parser, and fact quality  | SEC authenticity/provenance, MIME/archive/malware safety, parser correctness, ten-fact lineage, and owner-reviewed quality                                               | Pending after activation    |
| Enterprise and shared-service gates     | Organizational approval, tenant/multi-user controls, B15/V15, and production operations                                                                                  | Out of scope                |

## Bounded custody conclusion

`recordPersonalFilingPayloadCustody` re-verifies the owned declaration and
manifest and invokes the Cycle 2r payload-identity verifier internally. From
an empty audit root it publishes one canonical aggregate record; an existing
final record is revalidated and replayed, and a valid pending record may be
promoted. The record has status
`local_payload_custody_recorded_for_personal_use`, state
`live_payloads_verified`, and exact claim
`bounded_separate_local_payload_and_audit_custody_recorded_for_personal_single_user_local_use`.

The record binds corpus/declaration/manifest identity, the runtime
payload-identity result, platform-valued `linkAssurance`, selected counts and
bytes, and an unkeyed domain-separated location binding over canonical paths
and observed identities. Plaintext paths are not returned, but binding-digest
secrecy, unlinkability, and resistance to offline guessing are not claimed. It records
`retentionTargetAt` as custody time plus the manifest's declared retention
days. This is policy metadata only: it is neither an automatic schedule nor a
minimum hold, and the explicit owner-delete operation may run before that
target.

## Bounded deletion conclusion

`deletePersonalFilingPayloadCustody` requires the exact confirmation
`delete_all_manifest_bound_local_payloads` and the caller's expected custody
record digest. It rereads and validates the existing custody chain, publishes
a canonical intent before any unlink, and targets only the manifest-derived
direct children. Present files are rehashed and observed through their path and
descriptor immediately before unlink. It never recursively removes a tree and
never removes the payload root.

Terminal success requires every selected name to be absent and the exact live
root inventory to be empty. The retained empty directory is reported as
`directory_retained_empty`; the audit root retains custody, intent, and
terminal receipt records. The returned receipt has status
`live_payload_names_absent_after_explicit_personal_delete`, state
`owner_delete_live_payloads_absent_observed`, assurance
`observed_pre_unlink_identity_and_post_unlink_path_absence`, and exact claim
`bounded_owner_triggered_selected_live_payload_paths_observed_absent_for_personal_single_user_local_use`.

That assurance covers only the selected names and observations made during the
operation. The confirmation denotes explicit caller intent; it is not owner
authentication or authorization. The receipt does not embed the nonclaim list
below. Its bounded interpretation is constrained by the exported
`PERSONAL_FILING_PAYLOAD_CUSTODY_NOT_PROVEN` constant and this exit boundary.

## Failure, publication, and recovery boundary

Canonical audit JSON is bounded to 16,384 bytes per file. A successful custody
state contains one public audit file; a terminal deletion state contains
exactly three. Publication uses one fixed pending name, exclusive creation,
file synchronization, destination-absence observation, a same-directory
rename, and reread. It does not claim safety against an active rename race.

If same-invocation cleanup fails after complete pending bytes were written,
promotion is record-specific. Custody pending requires canonical bytes plus
the current manifest, location, and exact live-payload identity. Intent pending
requires the canonical custody/location/intent chain; after promotion,
deletion rejects extras, rehashes each present selected payload before unlink,
and permits missing selected names under that persisted intent. Receipt pending
requires the canonical custody/intent/receipt chain and an observed-empty live
root. A filename match alone is never enough: arbitrary bytes, partial records,
directories, hard links, symbolic links, or binding-mismatched records remain
untouched and fail closed. This is bounded retry, not crash, power-loss,
cross-process, transactional, or exactly-once recovery.

## Exact source transition

The promotion is one direct child:

1. baseline `a13b51d2cd6862029aa598829e40209ce178c7be`;
2. source revision `78b3880632ff7e54ac493e9c208ee1d93a275aa1`.

The NUL-delimited `git diff --name-status --no-renames -z` transition has 11
paths, 22 NUL fields, 778 bytes, and digest
`sha256:f8feb8c71409711439761778e738872c3ff91974ce1a2a047dbf410f276805e6`.
It consists of the cross-engine workflow, both independent evidence verifiers
and tests, the personal-package barrel, three new custody source/test files,
one payload-identity security regression file, and the boundary guard.

The 19-path protected surface adds immutable enterprise
`corpus-admission.ts` and the unchanged personal package manifest, tsconfig,
manifest verifier/tests, and payload-identity implementation/test. Any
non-exact protected intersection fails closed. Both independent offline
boundaries accept the committed source.

The route creates no Cycle 2s evidence schema, canonical evidence version, or
cross-engine/CI evidence artifact. Historical Cycle 2r source
`e15ddd8aa923a43fdca730e233abfbe684101e78`, Cycle 2q source
`398bb280593b6de125c5561ac9dd1b1c0fe254bd`, and Cycle 2o version 5 at
`472cc10b8df90bee01925b2efd4fbcb614d7590c` remain unchanged.

## Verification record

Full local verification passed 1,405 tests with 8 intentional capability
skips. The focused personal-package suite passed 80 tests with 4
capability-based skips. Both offline boundaries accepted the committed SHA.
Every exact-source workflow reached terminal success:

- CI run `33221451567`: Ubuntu job `99016146240` and Windows job
  `99016146391`;
- cross-engine run/job `33221451518` / `99016145897`, with no Cycle 2s
  cross-engine/CI evidence artifact by design;
- parser-isolation run/job `33221451525` / `99016146058`;
- normalization run/job `33221451528` / `99016145920`; and
- payload-custody run/job `33221451601` / `99016146192`.

The parser, custody, and normalization workflows are regression health, not a
Cycle 2s evidence artifact. No independent artifact review is claimed because
the personal CI route creates no evidence artifact.

## Exact nonclaims

The frozen exported nonclaim order is:

1. `sec_source_authenticity_attestation_or_complete_filing_provenance`
2. `mime_truth_archive_structure_malware_safety_parser_correctness_or_fact_quality`
3. `automatic_retention_scheduling_deadline_enforcement_or_legal_hold_execution`
4. `backup_cloud_sync_replica_snapshot_cache_temp_log_swap_recycle_bin_or_third_party_deletion`
5. `filesystem_journal_history_recovery_tool_physical_media_overwrite_or_cryptographic_erasure`
6. `process_memory_buffer_zeroization_or_post_operation_forensic_absence`
7. `post_return_absence_future_recreation_or_external_resurrection_prevention`
8. `transactional_atomicity_between_payload_and_audit_roots_or_rollback`
9. `crash_power_loss_cross_process_recovery_or_exactly_once_deletion`
10. `adversarial_namespace_aba_elimination_race_freedom_or_active_same_machine_attacker_safety`
11. `every_windows_reparse_cloud_placeholder_filter_driver_or_kernel_path_behavior`
12. `filesystem_acl_owner_device_storage_encryption_or_local_host_attestation`
13. `audit_signature_nonrepudiation_trusted_timestamp_or_tamper_proofing`
14. `any_specific_owner_corpus_without_a_successful_operation_invocation`
15. `caller_confirmation_as_owner_authentication_or_authorization`
16. `database_api_web_fetcher_parser_queue_or_running_application_composition`
17. `multi_user_commercial_redistributed_shared_service_or_production_safety`
18. `enterprise_rights_steward_approval_database_b15_or_v15`

For this profile only, organizational rights/steward/key-authority approval,
tenant and multi-user controls, B15/V15, and production operations remain Out
of scope—not Pass and not current blockers—while use remains one owner,
local/offline, noncommercial, nonredistributed, and not shared or production.
Those gates reopen if the profile widens. External law and source terms remain
outside this internal engineering classification.

## Next blocker

Cycle 2t should activate one owner-selected local corpus through custody
recording only: the owner supplies canonical declaration/manifest bytes, the
exact manifest-complete live payload root, and a new empty canonical non-root
audit root which is separate and nonnested. Success must return the custody
record and leave exactly the final custody JSON with no pending name. Deletion
is not part of this activation gate.

All owner inputs, payloads, raw paths, returned records/digests, and audit bytes
must remain outside Git and logs. Generated fixtures cannot substitute. A
repository document may record only a coarse owner-approved `Pass` or
`Unproven` status; the private operation record is not independently reviewed
through Git. If those owner inputs do not exist yet, Cycle 2t is blocked on the
personal corpus—not on an enterprise requirement.

After owner-corpus activation, the next engineering boundary is bounded
personal ten-fact normalization and correction lineage. SEC authenticity,
parser correctness, fact quality, and all wider-profile gates remain separate.

## Exit rule

Cycle 2s is Pass only for the exact source transition and disconnected
capabilities above. A specific owner corpus remains Unproven until a successful
owner operation occurs outside Git. Global deletion, enforced retention,
authenticity, parsing, quality, and wider-profile safety are not implied.
