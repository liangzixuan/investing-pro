# Managed annual reports

The managed client opens an Annual report panel from a current Discover result
or watchlist listing. Loading is explicit. The workspace stays mounted so its
watchlist draft survives opening and closing the report. Selection, catalog and
session changes retire the old request and evidence; editing a note does not
invalidate an unchanged listing. Workspace CURRENT records actual delivery.

The server admits the exact listing ID, symbol and current catalog digest before
resolving the issuer. The reviewed cohort maps AAPL to Apple and keeps GOOG and
GOOGL as distinct listings for the same Alphabet issuer. The caller cannot send
an arbitrary CIK or source URL. This is limited annual filing and reported-fact
coverage, with source dates and availability shown by the existing renderer.

## Request lifetime and data

Authenticated `POST /v1/managed/sec-annual-evidence` accepts at most 4 KiB and
returns at most 2 MiB. It retains the current SEC provider, annual resolver and
response validation, including source hashes, identity joins, observation rules
and generation identity. The shared decoder takes its own copy before awaiting
hash work and freezes the validated result. Client parsing remains inside the
request's twenty-second lifetime.

The function starts its ten-second deadline at entry, before bridge and account
checks. Authentication, catalog admission and the storage reservation must finish
within two seconds of entry. The source operation then gets at most 7.5 seconds,
ending no later than 9.5 seconds after entry; serialization must finish before
ten seconds. Synchronous parsing is checked after it returns. These are measured
application bounds, not a guarantee about platform scheduling or cold starts.

Each admitted attempt can request only the issuer's SEC Submissions and Company
Facts resources through the existing bounded adapter. Existing eight-MiB input
caps and filing/fact/observation limits remain. Source bodies are not persisted.
Cancel immediately retires the client's result. The Appwrite bridge has no proven
client-disconnect signal, so cancellation does not claim to stop remote work;
the server deadline remains responsible for that work.

## Shared admission

One pre-provisioned private row, `observed-annual-v1`, belongs to the admitted
principal in `investment_managed_watchlist_v1/sec_annual_budget`. It contains
`ownerId`, a monotonically increasing `version` and `nextAllowedAt`. Table and row
permissions are empty and row security is enabled. Account and catalog checks
precede access to this row.

The official SDK performs a read, creates a transaction, stages a bounded version
increment, updates only the reservation time, and commits. The increment's maximum
is the read version plus one. Only a timely acknowledged commit grants source
work. An uncertain commit grants no work and is not retried or refunded. A sixth
transport slot is reserved for rollback before a commit has started. A pending
transaction expires after sixty seconds.

The reservation ends twenty seconds after the request entered the function.
Assuming each instance clock is within one second of UTC and admission finishes
within two seconds, consecutive granted source operations are separated by at
least sixteen seconds. This clock assumption is not a measured service guarantee.
Impossible row chronology or a late admission fails closed. The budget applies
to this feature only and does not redefine existing monitor background policy.

The separate synthetic proof uses `investment_sec_annual_proof_v1`, an invented
principal and a private proof function. It must establish one winner from
competing same-version requests, immediate cooldown, loss of an acknowledgement
after a real commit, and later admission from the persisted version. Local source
sentinels are not SEC requests. Provisioning metadata alone does not accept those
scenarios or authorize production schema as complete.

## Server configuration and release

Managed function builds require separate reviewed identity and SEC configuration
files. The latter is either `null`, which explicitly closes source admission, or
an object containing one valid `userAgent` contact string. Validation occurs
before output cleanup. The contact stays in the server bundle.

```powershell
node --import ./node_modules/tsx/dist/loader.mjs scripts/clerk-trial/build-function.ts managed <server-config-path> <sec-config-path>
```

The accepted website, production API, signed APK, synthetic trial and local vault
remain separate release surfaces. A source merge alone does not change them.
Production provisioning, service activation, exact-build website delivery and
Android packaging each need their own recorded outcomes. No owner-record
migration or phone acceptance follows from the isolated proof.
