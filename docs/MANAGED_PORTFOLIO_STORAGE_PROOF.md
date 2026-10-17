# Portfolio storage qualification

The Portfolio storage proof is an internal qualification tool. It uses the real
Portfolio repository, versioned row store and bounded Appwrite transport with
invented identities and ledgers. It does not load an owner's portfolio, Watchlist
or Follow-ups. Local model tests do not establish live persistence.

## Fixed scope

The request can select one of eleven phases through an empty, query-free
`POST /proof/{phase}` request. The compiled proof fixes the project, database,
tables, three invented principals, commands and seventeen row locations. The
request cannot supply a target, principal, ledger or command. The function captures
its platform execution key before awaiting work; keys and raw upstream errors
are excluded from reports.

Run the phases in order and stop at the first refused, failed, incomplete or
uncertain result:

1. **Preflight:** require all seventeen exact locations to be absent.
2. **Create:** save the canonical ledger and replay its original receipt.
3. **Isolation:** save another invented principal's ledger independently.
4. **Stale:** refuse an old version and retain the winner and original receipt.
5. **Prestage:** hold a writer before increment; preserve the concurrent winner.
6. **Overlap:** hold a writer before commit; require one winner.
7. **Rollback:** interrupt receipt creation; require acknowledged rollback and
   unchanged current-row bytes and metadata.
8. **Unknown:** suppress an acknowledged commit locally, then reconcile the
   original receipt without a second commit.
9. **Reopen:** read the saved ledger in a fresh invocation.
10. **Capacity:** round-trip twenty identities and 250 activities; refuse activity
    251 before store access.
11. **Domain guards:** retain historical reads and original receipt replay while
    refusing future activity, stale catalogs and changed stable identities.

The capacity ledger has 132,270 canonical payload bytes. It does not test the
256 KiB payload ceiling. Each phase has its own operation ceiling, an eleven-second
deadline and bounded cleanup. The combined proposed ceiling is 155 counted store
calls. Failed observations must retain their actual result; do not replay phases
blindly, delete conflicting rows or replace the fixed principals.

## Artifact and operational acceptance

The dedicated builder binds source, tool, module graph, command, row and plan
hashes. It retains installed dependency notices in a unique artifact directory.
Review the actual artifact and its graph before any deployment. A successful
build does not authorize schema creation, function deployment or execution.

Schema identity, column bounds, empty grants and row security need separate
verification. Authority, available quota and zero additional spending must also
be established. Storage remains disabled by default. Provisioning, isolated
execution, backup and restore, product publication and physical-device use each
retain their own acceptance requirements.
