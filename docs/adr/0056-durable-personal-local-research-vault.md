# ADR 0056: durable personal local research vault

Status: **Accepted and promoted only for the exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at terminal routing
closure `3edb5464a3414313a980ffd9fecce5ca5257084a`. No actual personal vault,
recovery key, backup, restore, or private activation has been performed or
recorded.**

## Context

The personal profile already has a process-local owner session and bounded
read-only personal filing compositions. Cycle 3c separately prepares a
provider-neutral connected-source policy controller, but its kill,
reservation, replay, budget, and lifecycle state is deliberately process
memory. The demo thesis and alert surfaces previously used browser storage,
which would become a competing durable source if a server-side vault were
added without an explicit cutover.

Cycle 3d establishes the narrow persistence boundary needed by one person on one
local machine. It does not add a tenant, remote service, provider connection,
or browser product workflow. The source must fail closed on path ambiguity,
unexpected schema or files, corruption, stale writes, replay conflicts, and
incomplete recovery. A missing or damaged initialized vault must never be
silently replaced with a blank database.

## Decision

Add the private zero-production-dependency package
`@research-cockpit/local-research-vault` and the exact profile
`personal_single_user_local_vault`. The closed durable record kinds are:

- `thesis`;
- `settings`;
- `watchlist`;
- `alert_definition`;
- `job_state`; and
- `portfolio`.

Each record has one bounded identifier, positive version, canonical JSON
payload, payload SHA-256, and creation/update times. Attachments are a separate
package-level capability bound to one record and record version. No open-ended
table or caller-selected SQL is part of the model. Paths enter only through
startup or offline package operations and must pass their exact geometry; HTTP
never selects one.

Cycle 3d has a distinct non-splitting `vault-server` entry. Exact startup uses
`RESEARCH_COCKPIT_MODE=personal_single_user_local_vault`, one startup-fixed
`RESEARCH_COCKPIT_VAULT_ROOT`, and
`RESEARCH_COCKPIT_VAULT_STARTUP=initialize|open`. The owner bootstrap secret is
still required by the Cycle 3a session boundary. The ordinary, connected, and
other offline entries reject vault-only configuration rather than silently
loading this capability.

The vault root is fixed before listen. HTTP requests cannot select a database,
root, attachment path, backup path, recovery-key path, or restore destination.

## Promoted record and transaction model

The promoted adapter uses the Node 24 `node:sqlite` surface and one synchronous
SQLite connection. Its exact V2 schema contains records, attachments,
tombstones, idempotency results, payload-free audit metadata, one migration
ledger, and one schema metadata row. It has no Cycle 3c policy, kill,
reservation, replay, or budget table.

Database initialization applies the reviewed V1 base and V2
`unique-ledger-request-bindings` suffix in one `BEGIN IMMEDIATE` transaction.
Opening an exact V1 database first verifies the complete reviewed V1 identity,
ledger, tables, indexes, and integrity, then applies only that V2 suffix in one
transaction. V2 adds unique request-digest indexes to the idempotency and audit
ledgers. A migration constraint failure rolls back to the unchanged V1 state so
an operator can remove the conflict and retry; arbitrary or unreviewed version
transitions beyond the exact reviewed V1-to-V2 path fail closed.

Runtime record, delete, and attachment mutations atomically bind the state
change, exact idempotency result, and audit entry. Creating a record requires
expected version zero. Updating or deleting requires an exact positive current
version. Reusing an idempotency key with the same canonical request returns the
recorded result; reusing it for different input fails. A delete removes the
live record and dependent attachments and creates a tombstone instead of making
the identifier look unused.

Startup configures foreign keys, `trusted_schema=OFF`, `secure_delete=ON`, WAL,
and `synchronous=FULL`; disables SQLite extensions; verifies the exact
application identifier, user version, migration digest, table/index inventory,
full `PRAGMA integrity_check(1)`, and foreign-key check; and installs a runtime
authorizer that denies schema changes, attach/detach, and unreviewed pragmas.
Only the exact reviewed V1-to-V2 migration is supported; arbitrary or
unreviewed migration beyond that transition is corruption rather than input to
a general automatic migrator.

An ambiguous transaction or rollback failure closes the database rather than
continuing with uncertain state. Child-process crash verification exercises a
committed update followed by abrupt termination and checks the restart result.
This is bounded crash-recovery evidence, not a power-loss, disk-controller, or
filesystem certification.

## Local path and owner-only boundary

The startup root must be one normalized absolute direct child of an existing,
canonical, real parent. Relative, URI, UNC, device-namespace, double-root,
root-relative, dot-segment, alternate-stream, symlink, junction, hardlink, and
changed-parent/root forms fail closed. The root admits only these fixed direct
children:

- `vault-recovery.key`;
- `vault.sqlite3`;
- `vault.sqlite3-wal`;
- `vault.sqlite3-shm`; and
- the temporary `vault-backup.staging` while an offline restore owns it.

Unknown children, nonregular files, link counts other than one, identity
changes during validation, and a leftover staging file are rejected. POSIX
preparation requires exact owner-only modes: `0700` for directories and `0600`
for files.

Windows does not treat `chmod` as ACL evidence. A native adapter applies and
then inspects the effective ACL. Its receipt must bind the canonical root,
every verified path, the current owner SID, protected inheritance, and an
owner-only result. The TypeScript boundary validates that receipt contract;
the correctness of the native Windows ACL inspection remains a trusted-adapter
boundary.

## Encryption, backup, and recovery boundary

Initialization creates a fresh 32-byte recovery key in the separate owner-only
`vault-recovery.key` file. The key is not stored in SQLite and is not embedded
in the encrypted backup. Domain-separated HKDF-SHA-256 keys protect record
payloads, attachment bytes, and backup containers with AES-256-GCM, fresh
random 12-byte nonces, and authenticated context. The current KDF uses one
fixed domain-separation salt; Cycle 3d makes no claim of a fresh random KDF salt
for each backup.

Payload and attachment plaintext are encrypted, but this is not full-file or
whole-database encryption. SQLite schema, record/attachment identifiers,
versions, timestamps, sizes, media types, digests, tombstones, idempotency
metadata, and audit metadata remain observable to a reader who can bypass the
owner-only file boundary. Memory inspection, swap, crash dumps, and hostile
same-user or administrator access remain outside the claim.

The package-level backup operation reserves one unique owner-only external
snapshot in the validated backup parent, pins its device/inode identity across
SQLite snapshot creation, normalization, and readback, and removes only that
same file afterward. It verifies the declared inventory, places the manifest
and database bytes inside one bounded authenticated encrypted container, then
writes and syncs a separate exclusive owner-only pending file. Final
publication creates the same-directory final path with a no-replace hard link
to that pending file and then unlinks the pending name. It verifies owner-only
access and reads, decrypts, and verifies the final file before reporting
success. The only accepted final name is
`research-cockpit-vault.backup` in a separately validated private parent.

Restore is offline and requires separately supplied recovery-key bytes. It
decrypts and validates the backup before creating the restore target, then
restores only into an absent fixed root and reopens and verifies the exact
inventory. It never overwrites the live vault or silently substitutes an empty
one. Recovery-key loss makes the backup unrecoverable. A live delete does not
rewrite or erase old backups; an older backup can reintroduce a deleted record
when deliberately restored.

## Promoted API and browser boundary

The dedicated vault app inherits the exact Cycle 3a literal-loopback Host,
Origin, credentialed CORS, cookie, negotiation, framing, and owner-session
controls. Its vault business surface is limited to:

1. authenticated `GET /v1/personal-filing/vault` status;
2. authenticated `GET /v1/personal-filing/vault/records/:kind` list;
3. authenticated `GET /v1/personal-filing/vault/records/:kind/:id` read;
4. authenticated `POST /v1/personal-filing/vault/records/:kind/:id` create or
   update; and
5. authenticated
   `POST /v1/personal-filing/vault/records/:kind/:id/delete` delete.

Create requires exact intent `personal-vault-create`, `If-None-Match: *`, and
one bounded idempotency key. Update requires exact intent
`personal-vault-update`, one strong `If-Match: "vN"`, and one idempotency key.
Delete is bodyless and requires exact intent `personal-vault-delete`, the same
strong precondition, and one idempotency key. Authentication and mutation
header checks run at the request boundary before the JSON body is parsed.
Successful record reads and mutations use strong version ETags. Success,
denial, conflict, not-found, and internal failure responses are private and
noncacheable and do not disclose a local path, recovery key, payload, backup,
or internal failure detail.

Attachments, backup, and restore are package interfaces only. Cycle 3d adds no
HTTP route for them. The demo thesis and alert form no longer writes to Web
Storage; it is presentation memory for that page only. No browser vault client
or durable end-user vault workflow is prepared in this cycle, so the browser
cannot yet create, edit, back up, or restore vault records.

## Promoted implementation and security checklist

Cycle 3d source is complete only when all of these public properties are
implemented and terminally verified:

1. **Mode closure:** only the exact vault mode and complete startup
   configuration select the dedicated entry; every other entry rejects vault
   configuration.
2. **Static isolation:** the vault entry's first-party graph remains limited to
   vault app/composition/routes, owner session, listen options, and server; it
   excludes demo, connected policy, corpus, dossier/fact, research-state, and
   command-execution modules.
3. **Path closure:** root and backup geometry, fixed names, file identity,
   symlink/junction/hardlink rejection, unknown-child rejection, and no-
   overwrite behavior fail closed.
4. **Owner-only files:** exact POSIX modes or one verified Windows ACL receipt
   cover the root, database, WAL/SHM, recovery key, staging file, and backup.
5. **Schema closure:** application/schema identities, migration ledger,
   exact reviewed V1-to-V2 transition, tables, indexes, constraints, full
   integrity checks, pragmas, extension denial, and authorizer remain exact.
6. **Atomic mutation:** optimistic concurrency, idempotency, tombstone, and
   payload-free audit changes share one immediate transaction and survive the
   bounded restart tests.
7. **Confidential values:** canonical payloads and attachment bytes are
   authenticated-encrypted and plaintext does not enter public responses,
   logs, source, fixtures, or public CI.
8. **Backup/restore:** bounded authenticated backup, exclusive durable publish,
   identity-pinned external snapshot staging, same-directory hard-link
   no-replace publication followed by pending-name unlink, wrong-key/tamper
   rejection, absent-target restore, and exact digest and inventory
   reproduction pass on local temporary data.
9. **Owner API:** exact routes, intents, preconditions, idempotency, duplicate-
   header rejection, private caching, and generic error behavior remain bound
   to the owner session.
10. **Browser cutover:** the demo no longer treats browser storage as a durable
    thesis or alert source, and the web app cannot directly import the vault
    package.
11. **Cycle 3c separation:** connected policy, kill, reservation, replay, and
    budget state remains process-local and resets on restart.
12. **Historical preservation:** Cycle 2z and Cycles 3a-3c contracts,
    approvals, source bindings, and evidence remain unchanged.
13. **Exact-source evidence:** focused tests, full public verification,
    Windows/Linux CI, independent review, exact source topology, and any later
    separately authorized private operation are terminal before acceptance or
    promotion is recorded.

## Exact nonclaims

Cycle 3d does not establish:

1. an actual owner vault, recovery key, backup, restore, private-data
   migration, activation, acceptance, or promotion;
2. a browser vault client, user-facing durable editor, attachment workflow,
   backup UI, or restore UI;
3. full-file, whole-database, filesystem, memory, swap, crash-dump, or forensic
   encryption or erasure;
4. a fresh random KDF salt for each backup;
5. resistance to a hostile same-user process, administrator, browser
   extension, developer tools, debugger, malware, or physical/offline attacker;
6. native Windows ACL correctness beyond the trusted adapter and validated
   receipt contract;
7. recovery after loss of the separately retained recovery key;
8. deletion from old backups, backup inventory management, backup expiration,
   secure media destruction, or proof that deleted bytes are forensically gone;
9. arbitrary or online restore, overwrite of a live vault, arbitrary or
   unreviewed migration beyond the exact V1-to-V2 transition, cross-platform
   filesystem equivalence, RPO, RTO, or disaster recovery;
10. restart-safe Cycle 3c kill, policy, reservation, replay, or budget state;
11. scheduled execution, background jobs, delivered alerts, portfolio
    calculation, security-master content, ingestion, or provider refresh;
12. any provider account, credential, entitlement, external request, SEC
    access, market-data adapter, source freshness, or legal determination;
13. remote access, synchronization, multi-device state, multi-user identity,
    tenant isolation, shared-service, commercial, or production operation; or
14. competitor feature parity.

The personal-only profile keeps organizational stewardship, customer/tenant
controls, commercial redistribution, paid billing, and production operations
out of scope. It does not remove the owner's responsibility to protect the
vault root, recovery key, backups, operating-system account, and machine.

## Evidence and promotion rule

Cycle 3d is accepted and promoted only for the exact corrected
public/local-temporary chain rooted at
`520fb9f860600c699b9a5a6fee940bc3e1cb185c`, a merge-free count-14 child of
`86e712574a5eee4e9f636c25ebd5d6fb70f20581` with the exact 63-file,
10,267-insertion, 159-deletion source transition. Its exact adjacent stages are:

1. routing closure `1c831d59cf1558e1b63c9031c598825349bcd516`, seven files,
   merge-free count 15;
2. Windows ACL correction `5041b396f4cc89652b01f896ff9f69531cc2cb7e`,
   two files, count 16;
3. corrective route `a8fe1518484a4d0d8962a8318f4e0baaec0b9d36`, seven files,
   count 17;
4. Windows fixture stabilization
   `c329b081019ac61fb857dc8f709315b3ae497398`, two files, count 18;
5. stabilization route `fa5d31a0c1bc5f37e7b7f869cc8a888bd1f74021`, seven
   files, count 19;
6. API fixture correction `0228e253f5173fc5d8b73d00f5abbf486107999d`, two
   files, count 20;
7. API correction route `3982631bb87c209044078e47bb1bec9c738a4fee`, seven
   files, count 21;
8. parser timeout correction `33e7ca938f19df4ec1e738b19c884860ee85fc7e`,
   three files, count 22; and
9. terminal route `3edb5464a3414313a980ffd9fecce5ca5257084a`, seven
   files, merge-free first-parent and total count 23.

Tests may create disposable synthetic/local-temporary vaults, keys, records,
attachments, backups, and restores; those are not the owner's actual personal
vault or private activation evidence. No actual path, recovery key, personal
payload, backup, or restore result may enter source, fixtures, logs, public CI,
or public evidence.

Focused package, path, ACL, schema, mutation, API, crash, backup, restore, and
browser-cutover tests passed. At terminal routing closure
`3edb5464a3414313a980ffd9fecce5ca5257084a`, the full repository gate passed
1,906 tests with 9 intentional skips, independent review closed actionable
findings, and the exact corrected topology is recorded. Routing-tip CI validated the
pinned exact chain:

- [CI run `33593192127`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192127),
  Ubuntu job `100131233014`, and Windows job `100131233105`;
- [cross-engine run `33593192168`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192168),
  job `100131233432`;
- [parser isolation run `33593192135`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192135),
  job `100131232872`; and
- [payload custody run `33593192126`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192126),
  job `100131233056`.

No Actions run occurred directly at the root source revision.
Any later operation on an actual personal vault must be explicitly and
separately authorized and may publish only a coarse nonsecret outcome.

Cycle 3e-a owner-local security-master snapshot admission and symbol/name search
is the next planned functional slice. This promoted Cycle 3d public source does
not authorize Cycle 3e data loading or network access, and no real-universe
breadth claim exists without an exact rights-compatible source snapshot.

## References

- [Cycle 3d exit matrix](../CYCLE_3D_EXIT_MATRIX.md)
- [ADR 0055](./0055-connected-personal-source-policy-registry.md)
- [Cycle 3c exit matrix](../CYCLE_3C_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](../PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](../BUILD_ROADMAP.md)
- [Threat model](../THREAT_MODEL.md)
- [Canonical model](../CANONICAL_MODEL.md)
