# ADR 0009: Instrument-bound, operation-scoped projections

Status: accepted for Cycle 1b-a; database adapter/query integration pending

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
validator. ADR 0011 defines the disconnected fail-closed normalizer for the
narrow dimensionless PostgreSQL financial-fact row subset. B4 now implements a
separate reviewed query and identity/unit mapping with live review pending. A
driver, pool boundary, and complete dossier sources remain mandatory before any
database source is composed.

The later Cycle 1b-b1 through b3 PostgreSQL runs did not exercise this
projection port. B4 source now does so through the driverless query, but its
pinned live execution remains pending and it does not establish adapter
integration.
