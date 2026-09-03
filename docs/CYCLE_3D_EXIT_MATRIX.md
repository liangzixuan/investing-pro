# Cycle 3d exit matrix

Scope: close one durable personal local research-vault package and one
dedicated owner-session-authenticated API entry without adding a browser vault
client, provider connection, tenant, remote service, or production boundary.
The decision is recorded in
[ADR 0056](./adr/0056-durable-personal-local-research-vault.md).

Implementation status: **Pass for the exact corrected public/local-temporary
chain rooted at `520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at
terminal routing closure `3edb5464a3414313a980ffd9fecce5ca5257084a`.**

Terminal verification status: **Pass.**

Private activation status: **Not performed or authorized.**

Acceptance/promotion status: **Accepted and promoted only for the exact
public/local-temporary scope above.**

No actual personal vault, recovery key, backup, restore, or private payload is
recorded by this matrix.

## Gate matrix

| Gate                           | Required result                                                                                                                                                                                                                        | Current status                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Exact vault mode               | Only `personal_single_user_local_vault` selects the dedicated entry; missing, partial, near-match, connected, and prior offline modes fail before listen                                                                               | Pass                                                                    |
| Startup input closure          | One startup-fixed absolute root and exact `initialize` or `open` action are captured and scrubbed with the owner bootstrap input; HTTP cannot select a path or startup action                                                          | Pass                                                                    |
| Prior-mode isolation           | Synthetic, readiness, selected-fact, dossier, and connected entries reject vault-only configuration and preserve their prior contracts                                                                                                 | Pass                                                                    |
| Static entry isolation         | A separate non-splitting vault server owns the mode; its exact first-party graph excludes demo, connected policy, corpus, dossier/fact, research-state, and command-execution modules                                                  | Pass                                                                    |
| Closed record model            | Only `thesis`, `settings`, `watchlist`, `alert_definition`, `job_state`, and `portfolio` records are representable                                                                                                                     | Pass                                                                    |
| Fixed root geometry            | The root is one normalized absolute direct child of a pre-existing canonical parent and admits only fixed database, WAL, SHM, recovery-key, and temporary staging names                                                                | Pass                                                                    |
| Link and substitution defense  | Relative, URI, UNC/device/double-root/dot/alternate-stream paths, symlinks, junctions, hardlinks, nonregular files, unknown children, link count changes, and file/parent/root identity changes fail closed                            | Pass                                                                    |
| Owner-only files               | POSIX directories/files verify exact `0700`/`0600`; Windows requires a receipt binding canonical root, verified paths, current owner SID, protected inheritance, and owner-only effective access                                       | Pass                                                                    |
| Windows ACL trust              | Native ACL inspection correctness remains a trusted-adapter boundary; TypeScript validates the exact receipt, not the operating system independently                                                                                   | Explicit nonclaim                                                       |
| Exact SQLite identity          | Application id, V2 user/schema version, two-entry migration ledger/digests, schema metadata, exact table/index inventory, full `integrity_check(1)`, and foreign-key check match before use                                            | Pass                                                                    |
| Reviewed V1-to-V2 migration    | Opening an exact verified V1 applies only the V2 unique-ledger-request-binding indexes in one `BEGIN IMMEDIATE`; failure rolls back to retryable V1 and arbitrary/unreviewed transitions beyond it fail closed                         | Pass                                                                    |
| Runtime SQLite controls        | Foreign keys, `trusted_schema=OFF`, `secure_delete=ON`, WAL, `synchronous=FULL`, bounded journal/page settings, extensions off, and the runtime authorizer remain exact                                                                | Pass                                                                    |
| Atomic optimistic mutation     | Record/attachment change, exact CAS, idempotency result, tombstone where applicable, and payload-free audit metadata commit in one `BEGIN IMMEDIATE` transaction                                                                       | Pass                                                                    |
| Replay and conflict behavior   | Same-key/same-request replay returns the recorded result; changed input, stale version, duplicate live identifier, and concurrent backup/mutation conflicts fail closed                                                                | Pass                                                                    |
| Missing/corrupt behavior       | Missing-after-initialization, unexpected schema/files, failed integrity, wrong key, ambiguous rollback, and tampered ciphertext never become a blank or partially trusted vault                                                        | Pass                                                                    |
| Bounded crash recovery         | A child process commits a mutation, terminates abruptly, and the reopened vault preserves the committed state without admitting an uncommitted row                                                                                     | Pass                                                                    |
| Payload and attachment AEAD    | Canonical record payloads and attachment bytes use domain-separated HKDF-SHA-256 keys and AES-256-GCM with fresh random nonces and authenticated context                                                                               | Pass                                                                    |
| Encryption nonclaim            | SQLite metadata/digests and process memory are not fully encrypted; there is no whole-file, filesystem, memory, swap, crash-dump, or forensic-erasure claim                                                                            | Explicit nonclaim                                                       |
| Recovery-key separation        | A fresh owner-only 32-byte key file is separate from SQLite and excluded from the backup; losing it makes the backup unrecoverable                                                                                                     | Pass                                                                    |
| Backup KDF boundary            | The current design uses a fixed domain-separation KDF salt and fresh random GCM nonce; it makes no per-backup random-salt claim                                                                                                        | Explicit nonclaim                                                       |
| Encrypted backup publication   | One unique identity-pinned external SQLite snapshot is verified; the encrypted pending file is exclusively written/synced, hard-linked to the same-directory final with no replacement, then pending is unlinked and final is verified | Pass                                                                    |
| Offline absent-root restore    | Wrong key or malformed backup fails before target creation; a valid backup restores only into an absent fixed root and must reproduce record and attachment inventories/digests                                                        | Pass                                                                    |
| Backup deletion residual       | Live deletion does not rewrite or erase prior backups; a deliberately restored old backup may reintroduce deleted records                                                                                                              | Explicit nonclaim                                                       |
| Authenticated record API       | Status, list, get, create, update, and delete remain under `/v1/personal-filing/vault`; owner authorization runs at the request boundary and every response is private/noncacheable                                                    | Pass                                                                    |
| Mutation headers               | Create/update/delete require their exact intent, one bounded idempotency key, duplicate-header rejection, and exact `If-None-Match` or strong `If-Match` semantics with version ETags                                                  | Pass                                                                    |
| Generic failure                | Runnable denial, invalid, not-found, conflict, corruption, and startup failure disclose no personal payload, local path, recovery key, backup, digest, ACL detail, or internal exception                                               | Pass                                                                    |
| Package-only recovery surface  | Attachments, backup, and restore are package interfaces; Cycle 3d exposes no corresponding HTTP or browser operation                                                                                                                   | Explicit nonclaim                                                       |
| Browser durable-source cutover | The demo thesis/alert form is page memory only and no longer reads or writes Web Storage; the web app cannot import the vault package directly                                                                                         | Pass                                                                    |
| No browser vault client        | No browser vault editor, attachment workflow, backup UI, restore UI, or end-user migration is included                                                                                                                                 | Explicit nonclaim                                                       |
| Cycle 3c separation            | Policy, kill, reservation, replay, and budget state is absent from the vault schema and remains process-local across restart                                                                                                           | Pass                                                                    |
| No provider or scheduler       | No source credential, network request, SEC refresh, market-data adapter, scheduler execution, delivered alert, or background ingestion is added                                                                                        | Explicit nonclaim                                                       |
| Personal-only scope            | Remote, multi-device, multi-user, tenant, shared-service, commercial, organizational, billing, and production controls remain outside this profile                                                                                     | Out of scope                                                            |
| Preserved evidence             | Cycle 2z and Cycles 3a-3c contracts, approvals, source bindings, and evidence remain unchanged                                                                                                                                         | Pass                                                                    |
| Public verification            | Focused tests, full local verification, terminal routing-tip Windows/Linux CI validating the pinned exact chain, and independent review pass                                                                                           | Pass — terminal route: 1,906 tests, 9 intentional skips; four workflows |
| Actual personal operation      | Any later real vault/key/backup/restore use is separately owner-authorized and yields only a coarse nonsecret result                                                                                                                   | Not performed or authorized                                             |
| Promotion topology             | Exact merge-free source, corrective, and routing revisions are pinned; the documentation-promotion transition is exact-diff verified                                                                                                   | Pass — corrected chain pinned; this transition exact-diff verified      |

## Promoted interface boundary

The exact selector is
`RESEARCH_COCKPIT_MODE=personal_single_user_local_vault`. Startup additionally
requires `RESEARCH_COCKPIT_VAULT_ROOT`,
`RESEARCH_COCKPIT_VAULT_STARTUP=initialize|open`, and the existing Cycle 3a
owner bootstrap secret. Vault-specific captured inputs are deleted from the
process environment before listen. The root is fixed at startup and never read
from an HTTP path, query, header, or body.

The zero-production-dependency package is
`@research-cockpit/local-research-vault`. Its closed record namespaces are
`thesis`, `settings`, `watchlist`, `alert_definition`, `job_state`, and
`portfolio`. The dedicated non-splitting `vault-server` entry composes only the
vault, owner-session routes, vault routes, and loopback listen boundary. It does
not load the demo research state, connected-source policy, personal filing
corpus, dossier/fact loaders, or command-execution modules.

## Storage and recovery boundary

The database uses the exact promoted V2 SQLite schema and its two-entry
migration ledger. New initialization applies the reviewed V1 base and V2
unique-ledger-request-binding suffix atomically. Opening an exact V1 verifies
the complete legacy identity and runs only the reviewed V1-to-V2 migration;
failed migration rolls back to retryable V1, while arbitrary or unreviewed
migrations fail closed. Runtime verification uses full
`PRAGMA integrity_check(1)` plus the foreign-key and exact schema checks.

Record payloads and attachment bytes are AES-256-GCM ciphertext; record
identity, versions, timestamps, sizes, digests, tombstones, idempotency, and
audit metadata are not whole-file encrypted. A separate owner-only
recovery-key file derives domain-separated record, attachment, and backup keys
using the current fixed KDF salt. Each encryption uses a fresh random GCM
nonce. The backup does not contain the recovery key.

The package can prepare an encrypted immutable backup at the one fixed
filename. It uses a unique owner-only snapshot in the external backup parent,
pins that file's identity throughout snapshot creation/normalization/readback,
and publishes the synced encrypted pending file by creating the
same-directory final as a no-replace hard link before unlinking the pending
name. It then verifies the final file and can restore it offline to an absent
root after verifying the authenticated manifest, database digest, schema,
records, attachments, and permissions. No actual personal backup or clean-
machine restore has been run or authorized. Old backups remain separate
deletion inventory and may contain records removed from the live vault.

## Owner API and browser boundary

The promoted HTTP surface is limited to authenticated status, record list,
record read, record create/update, and record delete below
`/v1/personal-filing/vault`. Mutation intent, conditional version, and
idempotency headers are mandatory and exact. Authentication and mutation
header validation occur before request-body parsing. All success and failure
responses are private/no-store and generic where disclosure would widen the
boundary.

There is no attachment, backup, or restore route. There is also no Cycle 3d
browser vault client. The existing demo thesis and alert controls are
short-lived page state and no longer create a second browser-durable source.

## Exit and next milestone

Cycle 3d is Pass only for the exact corrected public/local-temporary chain rooted
at `520fb9f860600c699b9a5a6fee940bc3e1cb185c` and ending at routing closure
`3edb5464a3414313a980ffd9fecce5ca5257084a`. Focused tests, independent review,
the terminal-routing-tip full local gate with 1,906 passing tests and 9
intentional skips, and the workflows validating that pinned chain are green:
[CI `33593192127`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192127),
[cross-engine `33593192168`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192168),
[parser isolation `33593192135`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192135),
and [payload custody `33593192126`](https://github.com/liangzixuan/investing-pro/actions/runs/33593192126).
Local-temporary test vaults and keys are not actual personal activation
evidence.

Cycle 3e-a owner-local security-master snapshot admission and symbol/name search
has a recorded public engineering Pass only for its exact engine/API chain. It
is not accepted or promoted. This Cycle 3d promotion and the Cycle 3e-a recorded
public engineering result authorize
no source download or network adapter, and no real-universe breadth claim may
be made until a later exact owner-approved, rights-compatible snapshot is
separately admitted and measured.

## References

- [ADR 0056](./adr/0056-durable-personal-local-research-vault.md)
- [ADR 0057](./adr/0057-owner-local-security-master-snapshot-and-search.md)
- [Cycle 3c exit matrix](./CYCLE_3C_EXIT_MATRIX.md)
- [Cycle 3e-a exit matrix](./CYCLE_3E_A_EXIT_MATRIX.md)
- [Personal product-breadth roadmap](./PERSONAL_PRODUCT_BREADTH_ROADMAP.md)
- [Build roadmap](./BUILD_ROADMAP.md)
- [Threat model](./THREAT_MODEL.md)
- [Canonical model](./CANONICAL_MODEL.md)
