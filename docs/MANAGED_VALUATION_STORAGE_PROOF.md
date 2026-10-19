# Editable valuation storage proof

This source prepares a private test of editable valuation persistence. It uses
invented listings, inputs and principal names. It does not use owner records.
The application storage switch remains disabled. Local tests and a local bundle
do not establish cloud persistence, provisioning or release acceptance.

The [valuation workbench guide](MANAGED_VALUATION_WORKBENCH.md) defines the product
workflow. This proof checks its repository storage layer. It does not calculate
investment results or replace the separate client and native workflow checks.

## Fixed scope

The schema module fixes the existing Appwrite project, regional endpoint and
new `investment_managed_valuation_v1` database. Its only tables are `assumptions`
and `receipts`, each with seven required columns. The payload column uses
`mediumtext`. Tables require row security, empty permission grants and no indexes.

`VALUATION_PROOF_CREATE_OPERATIONS` describes 17 ordered creation requests:
one database, two tables and 14 columns. It is data for review. No source command
in this proof sends those creation requests. No deletion, backup or restore
operation is included. The owner deferred the optional backup drill separately.

Only three invented principal namespaces and 18 exact row locations are admitted.
The final expected state contains 13 rows: three current records and ten receipts.
The empty collection test saves a new empty payload; it does not delete the row.
The operation plan binds the schema, creation descriptors, commands, catalog
snapshots, clocks, row locations and phase ceilings by digest.

The request entry accepts only an empty, query-free `POST /proof/<phase>` for an
exact phase below. It captures the platform execution key before the first
asynchronous step. Callers cannot select a project, principal, command, catalog
or endpoint. Reports contain finite results and fingerprints, without the key,
raw payload or raw upstream error. Each invocation owns and closes its transport.

## Ordered phases

Each phase uses a new operation and repository. Later phases read the state left
by earlier phases. They do not seed memory from an earlier report.

| Phase                                | Required behavior                                                                                                                     | Logical operation ceiling |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------: |
| `schema`                             | Read the fixed database and bounded table list; admit the exact ready schema.                                                         |          2 metadata reads |
| `preflight`                          | All 18 exact locations must be absent.                                                                                                |                        18 |
| `create-isolation`                   | Create A and B with the same idempotency key in separate principal namespaces; read and replay both.                                  |                        18 |
| `stale`                              | Commit the winner; refuse a stale writer without its receipt; retain the original receipt.                                            |                        14 |
| `prestage`                           | Hold a stale actor before staging; commit its competitor and refuse the held actor.                                                   |                        19 |
| `overlap`                            | Stage overlapping transactions; require one winner and no loser receipt.                                                              |                        19 |
| `rollback`                           | Inject a staged failure; confirm rollback and unchanged canonical state.                                                              |                        10 |
| `unknown`                            | Lose the commit response; recover the original receipt and canonical state.                                                           |                         9 |
| `capacity`                           | Persist and reread 20 entries with exactly 262,144 UTF-8 payload bytes; refuse malformed and over-limit commands before store access. |                         8 |
| `domain-guards`                      | Retain historical reads and replay; refuse five invalid current catalog identities and changed content under a consumed key.          |                        15 |
| `historical-edit-and-catalog-review` | Save a historical raw edit, then independently reviewed current catalog metadata.                                                     |                        18 |
| `reopen`                             | Fresh reads join all three canonical records to their receipts.                                                                       |                         6 |
| `remove`                             | Explicitly save an empty A collection at the next version.                                                                            |                         9 |
| `reopen-empty`                       | A fresh read retains the empty collection and its version.                                                                            |                         2 |

The ceilings are limits, not required dispatch totals. The rollback phase has a
logical operation that deliberately throws before an HTTP dispatch. Transport
limits remain unchanged: at most 20 requests, with the twentieth reserved for
rollback, a 12-second transport deadline and bounded individual requests and
responses. Each phase has an 11-second lifetime. No phase combines the schema
reads with the 18-location preflight. No automatic retry is permitted.

The schema inspector accepts bounded SDK metadata only when the two tables and
all columns are ready, enabled and exact. Unexpected shapes, accessors, grants,
indexes or incomplete columns cause refusal. Optional backup metadata does not
create a backup requirement or grant backup authority.

## Local artifact

With the pinned Node 24 runtime, run the dedicated builder from the checkout:

```sh
pnpm exec tsx scripts/valuation/build-proof.ts
```

The builder accepts no arguments. It creates an ignored discovery directory and
an exclusive final directory under `dist/managed-valuation-proof/<buildProof>`.
It never cleans or overwrites an existing identity.

The marker binds source files, lockfile, compiler configuration, actual builder
and compiler implementations, the Node executable, the four allowed installed
runtime packages and notices. The actual esbuild graph must contain the required
valuation modules and only admitted application modules, dependencies and Node
built-ins. The discovery and final graphs must agree. Changed inputs, warnings,
extra outputs, links, unsupported dynamic imports and an oversized bundle cause
refusal. The output contains `main.js`, notices, a private ESM package marker and
`build-proof.json`. Building does not publish or execute the proof.

## Separate cloud acceptance

Before execution, prepare a concrete operation plan for the exact bundle digest,
17 creation descriptors and 14 ordered invocations. Obtain the matching owner
decision through the established email channel. Apply actual tool restrictions
to each action. Local source authorization does not authorize provisioning,
private-function deployment, credentials, cloud writes or a live release.

An executed proof needs original creation and readiness evidence, each producing
invocation and report, exact dispatch counts, finite failures, closed transports
and retained canonical row and receipt fingerprints. Compare reported creation
times across invocations and join update times to the relevant original receipts.
Reconcile all 18 locations with the 13 expected final rows. Preserve failed or
incomplete outcomes; do not hide them with a replay or memory-seeded replacement.

Even a successful private proof would qualify only its fixed invented scope.
Production configuration, owner recovery, API and client releases, device use
and wider accessibility acceptance remain separate.
