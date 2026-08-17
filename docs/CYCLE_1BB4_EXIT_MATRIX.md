# Cycle 1b-b4 exit matrix

Scope: one driverless, operation-specific financial-fact projection query,
closed semantic unit mapping, authenticated container-local execution, and
fail-closed normalization against the existing synthetic PostgreSQL fixture.
B4 is selected as the next milestone; source and live evidence are pending.

| Gate                                 | Evidence required                                                                                                                                                                           | Current status |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Immutable query contract             | One source-controlled query renderer accepts only typed listing/public-known/system-recorded parameters and a closed operation mapping; no interpolation or context IDs                     | Pending        |
| Listing and security identity        | Explicit listing -> share class -> security joins emit the listing as instrument identity and preserve security as a separate echo                                                          | Pending        |
| Public/system temporal filtering     | Listing effective/system and fact known/system intervals use reviewed half-open predicates; source availability is no later than the public-known cutoff                                    | Pending        |
| Exact operation rights               | Fact, evidence, policy ID/version, and one exact display/API, derive/API, or alert/local-alert grant are joined and echoed consistently                                                     | Pending        |
| Closed semantic unit mapping         | Only five exact unit/currency pairs are accepted; ambiguous `USD` / `USD`, case variants, mismatches, and unknown units fail the whole batch                                                | Pending        |
| Exact wire serialization             | Every Cycle 1b-a2 key has an explicit alias and deterministic primitive/text encoding; no `SELECT *`, denied IDs, row decisions, counts, or completeness claim                              | Pending        |
| Deterministic result bound           | `MAX_POSTGRES_PROJECTION_ROWS = 100`; SQL requests `LIMIT 101`; 0–100 valid rows normalize and 101 rows fail before normalization without truncation                                        | Pending        |
| Authenticated execution boundary     | In the query transaction, `session_user` is the SCRAM login and `current_user` is the runtime capability after local role/context selection; pre-role/cross-role denials and cleanup remain | Pending        |
| Authenticated orchestration          | The B4 probe uses only the authenticated client inside the existing authentication `try/finally`, before login/passfile cleanup and before success-only evidence emission                   | Pending        |
| Operation results                    | Display/API returns two reviewed facts; derive/API and alert/local-alert each return one; wrong listing, pre-cutoff, inactive, and no-current-membership contexts return empty              | Pending        |
| Fail-closed normalizer integration   | Raw parsed rows enter `normalizePostgresFinancialFactRows`; malformed, partial, unsupported, duplicate, or mutation-hostile batches produce no partial result                               | Pending        |
| Existing acceptance regressions      | All b1-b3 migration, RLS, authenticated matrix, write-denial, cleanup, and success-only evidence probes remain mandatory                                                                    | Pending        |
| Version 4 success-only evidence      | New immutable record binds query and normalizer sources, adds only the B4 completed check after cleanup, preserves v1-v3 review, and retains every remaining limitation                     | Pending        |
| Application/dependency boundary      | No external or database-driver dependency, manifest dependency change, lockfile change, pool, URL, app import/composition, writer, migration, role/grant change, or real data               | Pending        |
| End-user identity and tenant binding | Application identity resolution and trusted tenant selection are demonstrated                                                                                                               | Out of scope   |
| Driver, pool, cancellation, and load | A real client/pool proves checkout/reset, cancellation, timeouts, concurrency, and required load                                                                                            | Out of scope   |
| Complete and dimensioned projections | Dossier, history, timeline, dimensioned facts, and general unit taxonomy are queried and composed                                                                                           | Out of scope   |
| Operational identities and restore   | Test-loader, migrator, and backup logins plus logical restore are separately proven                                                                                                         | Deferred       |

## Exit rule

Cycle 1b-b4 is complete only when every in-scope row above has executable
source, the dedicated PostgreSQL workflow passes from a clean checkout against
the pinned image, and the exact version 4 record, source hashes, workflow logs,
artifact digest, and offline review are retained and linked. Selection, an ADR,
unit tests, static SQL, or historical b1-b3 artifacts cannot satisfy the live
exit rule.

Even after a successful B4 run, the permitted claim is limited to one bounded,
synthetic, container-local execution of the reviewed financial-fact projection
query through the existing service account followed by fail-closed
normalization. It is not a database adapter, application integration, identity
boundary, pool/concurrency result, complete research projection, or production
readiness evidence.
