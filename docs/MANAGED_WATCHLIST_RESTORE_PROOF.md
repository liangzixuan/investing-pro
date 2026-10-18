# Isolated Watchlist restore qualification

This internal tool prepares a controlled native Appwrite backup and restore
drill. It uses the real Watchlist repository, bounded transport and fixed invented
commands. Local model tests qualify these checks; they do not establish cloud
backup, restore, owner-account recovery or a delivered backup feature.

## Native service and scope

Use Appwrite's existing [TablesDB backup service](https://appwrite.io/docs/products/databases/tablesdb/backups)
for the archive and restore operations. A database backup must retain both the
current table and the original command receipts. A text export of a saved
Watchlist is not that recovery mechanism. The older PostgreSQL proof uses a
different storage path.

The source database is `investment_backup_watchlist_v1`. The restored database is
`investment_restore_watchlist_v1`. Both use `watchlists` and `receipts` tables.
These are separate from all three live managed databases and the Portfolio
qualification resources. Keep the existing Portfolio proof and its artifact
unchanged.

The installed Appwrite SDK supports an explicit destination for a restoration.
Omitting `newResourceId` requests an in-place restore. Any operational controller
must require the exact, different target and verify that the target database is
absent. Row-location absence alone does not prove that a database is empty.
Refuse an existing or uncertain destination; do not delete it or try another ID.

## Fixed phases

Each phase accepts only an empty, query-free `POST /proof/{phase}` request. The
request cannot provide data, a principal, database, table, destination or archive.
The entry captures its platform execution key before awaiting work and excludes
keys, raw provider errors and payload bodies from reports.

1. **Preflight:** require the four declared source row locations to be absent in
   the provisioned source schema. Require the restored database to be absent at
   each declared target location. Refuse a missing source database/table or an
   existing target, including an empty target. An operator separately verifies
   the source schema and the absence of the whole restored database before using
   the native service.
2. **Seed:** save two fixed canonical versions in the source. Check the current
   row and both original receipts. Retain the reported source fingerprints.
3. Use one targeted native archive, wait for its successful completion and
   restore it alongside the source at the explicit target. These operations are
   outside this function and need their own reviewed authority and cost scope.
4. **Verify restored:** require the original version, canonical payload, digests,
   application times and receipt identities at the restored target. Replay the
   older original command without a second commit, then make one valid
   next-version Save at the target.
5. **Verify source:** require the original source state and historical receipts
   to remain intact, with no target-only command at the source. Compare its
   fingerprints with the seed result.

The phase ceilings are 8, 19, 18 and 6 counted store calls, respectively. The
runner retains a finite deadline and closes its transport on every outcome.
Stop at the first refused, failed, incomplete or uncertain result. Preserve the
original result rather than rerunning a phase or weakening its assertions.

This fixed closed command set does not qualify concurrent writes during a hot
backup, complete enumeration of an owner's records or an atomic snapshot across
the three separate application databases. Schema, column bounds, empty grants
and row security also need actual source/destination metadata verification.

## Artifact and execution

Build with `pnpm exec tsx scripts/recovery/build-watchlist-restore-proof.ts` under
Node 24. The dedicated builder binds the fixed plan, source files, installed
tools, runtime module graph and license notices. It writes an exclusive output
directory under `dist/managed-watchlist-restore-proof/`, preserving prior builds.
The build neither contacts Appwrite nor creates an archive or restoration.

Before any cloud operation, review the actual artifact and graph, exact schema,
source/archive/destination identities, bounded call plan, available allowance and
zero additional spending. Appwrite's public Education terms and a visible backup
control do not independently establish this organization's backup retention
accounting. Do not enable a policy, add-on, dedicated database or paid feature to
complete the drill.

Provisioning, function deployment/execution, native archive/restore, production
configuration and owner backup acceptance remain separate operations. A source
merge or a passing in-memory test grants no authority for them.

The [operator boundaries](NATIVE_BACKUP_OPERATOR_BOUNDARIES.md) provide separate
SDK request limits and native receipt validation. Their local tests do not
replace the complete operational controller or an executed restore drill.
