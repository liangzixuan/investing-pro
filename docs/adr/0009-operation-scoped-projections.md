# ADR 0009: Instrument-bound, operation-scoped projections

Status: accepted for Cycle 1b-a; live PostgreSQL execution pending

The source-controlled demo snapshot is complete by construction, but an RLS
query cannot prove that the rows it can see are the complete candidate set.
Those two trust boundaries now use different ports. `GetDossier` accepts only
the explicitly named `CompleteSyntheticSnapshotRepository`. A future database
adapter must implement `OperationScopedProjectionSource` and enter through
`GetOperationProjection`, which verifies the returned instrument, independent
public-knowledge and system-recorded cutoffs, and exact operation before
projecting anything. Its authorization territory and evaluation time come from
an injected trusted context provider; they are not fields on the caller's
historical projection request.

Each database view is evaluated for one exact operation: display/API,
derive/API, or alert/local-alert. The core resolves the candidate's frozen
rights-policy ID and version itself. A missing grant in another operation's RLS
view is never interpreted as a denial in the current view. Denied row IDs are
not returned.

Database-source completeness may be `known_incomplete` or `unknown`; this
contract deliberately has no caller-constructible `complete` or expected-count
state. Both states force `hasOmissions: true` and `count: null`. Exact omission
counts remain confined to the closed synthetic fixture path until an approved
non-leaking proof exists.

History and timeline values are instrument-scoped snapshot records rather than
composer constants. Public evidence passports remain reusable records, while
internal instrument/evidence bindings decide whether a fact, historical point,
event, or passport may cross one instrument projection boundary. The binding
does not change the public evidence DTO.

The current dossier requires display and derive permission. Alert permission is
evaluated separately so a future server alert cannot inherit authorization from
a display query. The browser-local alert remains synthetic demonstration state
only.

This ADR freezes a core contract, not a production adapter or ingestion
validator. Full RFC 3339, interval-ordering, decimal-bound, and text
normalization at an untrusted adapter boundary remains mandatory before any
database or provider source is composed.
