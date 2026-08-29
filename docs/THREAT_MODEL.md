# Sprint 0 through promoted Cycle 2u threat model

## Current trust boundaries

The browser accepts dossier JSON only from the local Fastify API and keeps its
thesis and alert profile local. The API reads only source-controlled synthetic
fixtures and now has exactly two additional update-only routes over seeded
synthetic in-memory research state. The write composition accepts only an exact
loopback peer and a fixed public fixture persona selector; the selector is not
a credential. There is no authentication, customer tenant data, live database,
file upload, external fetch, email, broker, payment, model, or filing-parser
boundary in the running profile.

The active filing-corpus profile is separately
`personal_single_user_local`: one owner, local-only offline research, no
commercial use or payload redistribution, and no production/shared service.
Cycle 2q/2r/2s/2u are disconnected from the running API and web application.
Cycle 2q accepts declaration and manifest metadata; the Cycle 2r verifier can
read a caller-selected local payload root during an explicit invocation; Cycle
2s can write aggregate audit records and unlink manifest-selected live payload
names only during an explicit caller invocation; and Cycle 2u is a pure
normalizer over caller-supplied owned byte snapshots. Cycle 2t records only
**owner-approved private operation Pass for one owner-selected corpus** and
introduces no repository-visible input or runtime route.
Enterprise approval, tenancy, B15/V15, and production controls are not trust
boundaries for this profile unless its scope widens.

Cycle 1a added an isolated synthetic authorization harness and PostgreSQL
migration contract. At that historical exit neither component was imported by
the API or web application. Cycle 1c now imports only the in-memory
research-state service into the API for two seeded update operations; the
PostgreSQL contract and every database adapter remain disconnected. Synthetic
actor context is fixture-controlled and trusted; it does not establish
identity.

Cycle 1c resolves one of six public, non-secret persona labels only after an
exact loopback peer check and rejection of caller-supplied organization,
principal, tenant, or role authority headers. Missing, duplicate, malformed, or
unresolved persona, non-loopback, and caller-authority cases are denied before
body parsing. After valid syntax, owner/researcher updates flow directly through the
existing atomic service while viewer, inactive, and no-membership contexts are
denied before resource, version, or idempotency observation. Strong ETags and
organization + principal + operation + key idempotency apply only to the two
exact update paths. Operation includes the resource type and ID, so a
cross-path/resource key is a separate scope rather than a claimed conflict.
Browser state remains local and no server research-state create, delete,
read/list, export, evaluation, delivery, or background route is added.

Cycle 2a introduces a disconnected bounded parser boundary, not a running
application upload or fetch surface. Each nonempty, host-size-eligible bounded
synthetic archive is staged as one read-only file for one new locked-down Linux
container; empty and host-oversize inputs quarantine without a process. The worker has no
network, secret, signing key, tenant, database, application, or arbitrary
plugin context. Its exact dedicated Linux run and independent offline review
passed for 103 synthetic cases; this does not establish a production container
host, general parser, external input, or real-filing boundary.

Cycle 2b Phase A adds only a pure metadata-admission verifier. It has no real
configuration, external candidate inventory, approval, authority key, raw
filing, fetch, parser execution, workflow, evidence artifact, or application
composition. The exact 34-file/810-test local source gate and
[CI run 32447542432](https://github.com/liangzixuan/investing-pro/actions/runs/32447542432)
pass for exact commit `b9a9edf680b4c3a7373cd6d96210a24544ba0bbe`.
The future protocol accepts exact
bytes and returns only a closed schema/claim/corpus/version/evaluation identity,
aggregate input hashes, count, validity, and an admitted status; whole-input
failures are value-free. All document bytes are syntactically untrusted. The
authority/revocation registry and current-time `evaluatedAt` become trusted
out-of-band inputs only after separate human review; Phase A proves neither
clock authenticity nor revocation freshness. It is not a new running trust
boundary, and Cycle 2b remains blocked on exact external metadata, distinct
rights/steward signatures, and human key-authority review.

Both signed approvals bind `authorityKeysSha256`, but an admitted result proves
only internal consistency under the supplied registry. A human/host must match
that exact digest to the reviewed out-of-band anchor; the verifier does not
make an authority, counsel, or steward identity decision. It also verifies only
signed timestamp/hash consistency. Absence of earlier parser or adjudication
results is externally attested chronology, not a machine-proven property.

Cycle 2c adds a disconnected local filesystem/crypto boundary for one generated
4,096-byte synthetic payload only. It snapshots caller bytes, recomputes the
fixed digest, requests a fresh AES-256-GCM key and nonce from an injected
entropy provider, binds closed identity and retention metadata as AAD, and
separates the injected key store from ciphertext/audit files. The provider is
an out-of-band trusted CSPRNG TCB; source validates only returned byte shape and
exact requested length, not randomness or uniqueness. The dedicated Linux
record is limited to observed Node `crypto.randomBytes` use and distinct
DEK-fingerprint and nonce-hash samples in that run; it cannot establish OS
entropy quality. No network, parser, corpus admission, database, API, web,
queue, real configuration, external approval, or real payload enters the
boundary. The final successor-compatible local `pnpm verify` gate passed
format, lint, every guardrail including 86 production-license checks, all
project typechecks and builds, and 39 test files with 848 passed tests plus 2
POSIX-only Windows skips (850 total cases). Two-OS CI run `32463955370`,
dedicated success-only Linux custody run `32463955421`, exact-commit offline
review, and independent retained artifact/log review pass on exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4`.
The later local compatibility result does not replace or widen that canonical
live evidence.

The trusted host clock is part of the TCB. At the half-open expiry boundary the
implementation forgets the key, records terminal logical unavailability, and
then removes ciphertext with retry cleanup. This proves neither clock
authenticity nor physical-media overwrite, memory zeroization, cryptographic
erasure, backup/replica/cache/log deletion, crash durability, production key
custody, multi-host consistency, or real-data admission. Cycle 2b remains
blocked, and Cycle 2c is not B15/V15.

Cycle 2d adds a disconnected, pure TypeScript normalization boundary. The
caller supplies exactly two bounded canonical JSON byte documents matching the
closed synthetic 10-K/10-K/A schema; the boundary immediately takes fresh owned
snapshots before validation. Tests generate the canonical pair, but the
boundary does not authenticate its generator or provenance. Canonical JSON
bytes, exact ten-key membership, strict decimal and
context rules, one acyclic predecessor, half-open known windows, and atomic
empty quarantine are the only accepted surface. The package has no runtime
dependency and performs no network, file, raw-parser, custody,
corpus-admission, database, API, web, or queue operation. Local verification is
Pass on exact frozen bytes: format, lint, guardrails, all project typechecks and
builds, 86 production-license checks, and 41 test files with 876 passed plus 2
POSIX-only Windows skips (878 total cases: parser 65; custody 36 passed plus 2
skipped; normalization 26; DB 582; API 49; state 48; contracts 5; core 62; web
3). The bounded source-stage claim, local gate, and two-OS CI historically passed for
exact source commit `f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`; CI run
`32511008752` passed in Windows job `96861883906` and Ubuntu job `96861884146`.
Parser run/job `32511008497` / `96861883641`, custody run/job `32511008447` /
`96861883543`, and PostgreSQL run/job `32511008417` / `96861882949` are
unchanged regression health on that commit, not Cycle 2d evidence. There is no
dedicated workflow, evidence schema, artifact, offline evidence review, or
evidence note.

The test-generated metadata and values are synthetic inputs, not trusted SEC,
parser, accounting, rights, or adjudication assertions. Cycle 2d does not
authenticate real source bytes, prove amendment completeness, establish
general taxonomy/unit/dimension/fiscal handling, execute correction discovery,
or create database system intervals. Its aggregate quarantine errors and CI
output must remain value-free and canary-free. Cycle 2b and production remain
blocked, and Cycle 2d is not B15/V15.

Cycle 2e adds a disconnected pure-TypeScript comparison boundary for exactly
two canonical synthetic envelopes in fixed declared-validator A/B argument
roles. The boundary owns snapshots before two separate strict modules validate
the complete same-schema normalized payloads. Only after both validations pass
does it compare full canonical payload bytes. Digest, subset, count, or
selected-field agreement is insufficient.

Any invalid report, upstream quarantine, identity/preimage/pointer/chronology
failure, or byte difference yields empty value-free aggregate quarantine. No
preferred report, merge, fallback, reordering, tolerance, coercion, silent
repair, mismatch detail, hashes, validator metadata, or values cross that
failure boundary. Success exposes only an immutable metadata receipt, not the
normalized facts or lineage.

The two fixed role/ID/version/digest tuples are declarations, not credentials,
signatures, executable measurements, authorities, or proof of independent
validators, parsers, codebases, processes, hosts, operators, keys, or failure
domains. Both implementations run in one package/process and may share common
assumptions or failures. Source implementation is complete. Local verification
is Pass on exact frozen bytes: `corepack pnpm verify` passed all format, lint,
guardrail, typecheck, test, and build stages with 43 test files, 911 passed plus
2 skipped (913 total), all 11 workspace project checks, and 10 builds. The
bounded source-stage claim, local gate, and two-OS CI historically passed for exact
source commit `60b92aa527435904776144f5e2d5a1a3ab61e67e`; CI run `32518970387`
passed in Ubuntu job `96886795980` and Windows job `96886796247`. Parser
run/job `32518970423` / `96886796118`, custody run/job `32518970453` /
`96886796256`, and PostgreSQL run/job `32518970454` / `96886796382` are
unchanged regression health only, not Cycle 2e evidence. Cycle 2e has no
dedicated workflow, evidence schema, artifact, offline review, or evidence note, and
performs no network, raw parser, normalizer, custody, corpus, database, API,
web, or queue operation. Cycle 2b and production remain Blocked; this is not
B15/V15.

Cycle 2f adds a disconnected pure-TypeScript quality-measurement boundary for
exactly three canonical synthetic documents in fixed plan, candidate, and
declared-reference roles. It snapshots each input before closed parsing and
accepts only the exact fixed population of 100 declared-reference documents,
ten fact coordinates each, and 2,000 evaluator-derived critical assertions.
Unexpected keys, duplicate JSON keys, non-canonical bytes, oversized documents,
coordinate duplication/omission, invalid decimals or Gregorian periods,
declaration/hash/chronology mismatch, or incoherent candidate state fail closed.

The evaluator derives all counts, denominators, fact classifications, assertion
outcomes, and metrics. Callers cannot submit weights, exclusions, metrics, or
assertion results. A wrong fact creates one false positive and one false
negative. Missing or mismatched succeeded output is silent; explicit
quarantine is not silent, but it still creates false negatives, reduces
document success and recall, and increases quarantine rate. Undefined ratio
denominators fail closed.

Threshold arithmetic is integer-only: document success `>=95/100`, precision
and recall `>=99/100`, quarantine `<=5/100`, zero silent critical failures,
exact canonical units, and zero-day period tolerance. There is no float,
`NaN`, rounding, epsilon, caller tolerance, reweighting, repair, or fallback.
Valid below-threshold input produces aggregate `not_met`; malformed input
produces empty value-free quarantine. Neither result exposes fact values,
coordinates, mismatch details, or canaries.

The declared adjudicator/candidate roles and digests are unauthenticated
synthetic declarations. The boundary cannot establish independent adjudicator
identity or failure domains, blinding, prediction precommitment, chronology
authenticity, reference-label correctness, strategic-quarantine detection, real
parser quality, or threshold adequacy. Hardened source implementation and the
exact final local/two-OS restoration gate passed at source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708` as historical facts, but that
restoration is now Superseded because backing prototype equality did not
intrinsically brand an `ArrayBuffer`, and carrier prototype equality did not
prove the intrinsic `Uint8Array` element type; re-prototyped shared backing and
alternate typed arrays remained admissible. Cycle 2h restores the bounded
owned-byte premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.
The prior bounded source-stage
conclusion for exact source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` is Superseded: shadowable
typed-array `buffer` / `byteLength` properties could disguise shared or
oversized backing, and typed-array `slice` could dispatch caller `constructor`
/ `Symbol.species` hooks during snapshot allocation. Its recorded local release
run and CI run `32681826143` in Ubuntu job `97299715600` and Windows job
`97299715638` were green, but remain historical gate facts only and do not
establish the bounded owned-snapshot check. The current local restoration gate
and Cycle 2g Ubuntu/Windows CI passed at
`df1ddffdede9900302da34160ce6b9a62b9d1708`, historically restoring the
hardened bounded claim for those bytes; that conclusion is now Superseded.
Parser run/job `32681826015` /
`97299715074`, custody run/job `32681826030` / `97299715006`, and PostgreSQL
run/job `32681826040` / `97299715107` remain unchanged regression health only,
not Cycle 2f evidence. Cycle 2f has no dedicated workflow,
evidence schema, artifact, offline review, or evidence note and performs no
network, parser, custody, corpus, database, API, web, or queue operation. Cycle
2b, full Cycle 2 quality, and production remain Blocked; this is not B15/V15.

Cycle 2g addresses only Cycle 2f's in-process prediction-order gap. One factory
instance owns a candidate-observation snapshot validated against the closed
100-document coordinate space before it accepts declared-reference bytes;
omissions are preserved for fail-closed evaluation. The committed document
includes the exact declared-reference SHA-256 commitment but no raw reference
bytes/content or caller `producedAt`.
The first commit or reveal attempt reserves state before validation; a bad first
commit, open-state reveal, second commit, or any reveal consumes the instance.
There is no retry, reset, replacement, or recovery.

A successful commit returns only aggregate hashes/counts and one empty frozen
object-identity capability. The capability is bound to the exact instance,
cannot be reconstructed by serialization, and is single-use. Reveal consumes
before checking the capability, reference, or dependency, recomputes the
reference byte digest, requires the committed digest, injects only the fixed
Cycle 2f compatibility role/time, and delegates to Cycle 2f. Evaluated output
is aggregate-only and immutable; protocol or measurement quarantine exposes
zero audit counts and `measurement: null` without hashes, values, reference
content, mismatch detail, capability, or canary.

The atomic transition also closes a hostile typed-array carrier gap in both the
new boundary and the public Cycle 2f evaluator. Intrinsic typed-array getters
recover the actual backing buffer and byte length, an ordinary `ArrayBuffer` is
required, an ordinary `Uint8Array` snapshot is allocated directly, and the
intrinsic typed-array `set` copies the bytes. Own `buffer` or `byteLength`
properties cannot disguise shared or oversized carriers, and own `constructor`
or `Symbol.species` hooks receive no snapshot-allocation dispatch or reentrant
observation opportunity.

This boundary prevents reference-byte substitution within one successful call
sequence, but the digest is not hiding or secret and the package cannot know
what the caller learned elsewhere. A caller can know or brute-force reference
content, create another instance, restart the process, or call Cycle 2f
directly. No clock, signature, external identity, cross-process state, durable
receipt, transparency log, or independent adjudicator is added. Source
implementation, the exact final local gate, and two-OS CI passed at source
commit `df1ddffdede9900302da34160ce6b9a62b9d1708` as historical green facts, but
the bounded owned-byte conclusion is Superseded. Backing prototype equality did
not intrinsically brand an `ArrayBuffer`, carrier prototype equality did not
prove the intrinsic `Uint8Array` element type, and re-prototyped shared backing
and alternate typed arrays remained admissible. A proxy-sensitive prototype
check preceded complete intrinsic brand validation. Cycle 2h restores the
bounded owned-byte premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. The historical Cycle 2g local gate passed
formatting, full ESLint, all guardrails, 86
production license versions, every scripted typecheck/test/build across 12 of
13 workspace projects, 47 test files with 987 passed plus two skipped (989
total), and the boundary verifier. Cycle 2g has no dedicated workflow, evidence
schema, artifact, offline review, or evidence note. CI run `32690685837` passed
in Ubuntu job `97323672725` and Windows job `97323672813`. Parser run/job
`32690685841` / `97323672800`, custody run/job `32690685846` / `97323672628`,
and PostgreSQL run/job `32690685829` / `97323672631` passed as unchanged
regression health only; they are not Cycle 2g or Cycle 2f restoration evidence.
Cycle 2g performs no network, parser, custody, corpus, normalizer,
comparison, database, API, web, or queue operation. Cycle 2b, full Cycle 2
quality, and production remain Blocked; this is not B15/V15. The existing Cycle
2f CI anchors remain historical green gate facts for source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` only. They do not attest the
current hardened Cycle 2f bytes. The Cycle 2g frozen-byte local and two-OS CI
gates passed at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`; both that Cycle 2f restoration and
the Cycle 2g conclusion are now Superseded, while the original `72e91f5`
conclusion remains Superseded.

Cycle 2h addresses one repeated byte-carrier threat across Cycle 2a through
Cycle 2g. Their public or injected `Uint8Array` paths historically claimed to
own bytes before parsing, validation, asynchronous work, storage, or comparison,
but across the set could read shadowable `buffer` / `byteLength`, dispatch
iterator, constructor, `Symbol.species`, accessor, proxy, or instance-method
hooks, or allocate before validating actual internal length. A hostile carrier
could therefore spoof backing/bounds, observe allocation, or reenter before
ownership. Prior Cycle 2a–2g bounded owned-byte security conclusions on their
original bytes remain Superseded; their green jobs and canonical Cycle
2a/Cycle 2c artifacts remain historical facts only. The bounded owned-byte
premises are restored only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.

The hardened paths first call intrinsic typed-array backing-buffer, byte-length,
and `%TypedArray%.prototype[Symbol.toStringTag]` getters; intrinsically require
element type `Uint8Array`; brand-check the recovered backing as `ArrayBuffer`;
and only then perform proxy-sensitive exact prototype checks. They check each
role's actual internal length before owned allocation, then use a direct
ordinary `Uint8Array` and intrinsic `set.call`. The affected inventory is the
parser archive, injected signer signature output, create/start/remove/residue
process-runner stdout/stderr, seven admission documents, the custody staging
payload/five semantic entropy results/key-store reads and writes,
two normalization documents, two comparison reports, three quality-
measurement documents, and three quality-precommitment documents. Signatures are
bounded to exactly 64 actual bytes and streams to the requesting process limits
before owned allocation. Cycle 2a hashes an
exact oversized archive synchronously without a copy and preserves its signed
`archive_limit_exceeded` quarantine. All existing coarse failures and value-free
results remain unchanged. Focused regressions cover hostile metadata/accessor/
iterator/allocation roles, shared or oversized backing, re-prototyped alternate
typed arrays, subclasses, detached buffers, proxies, and post-call mutation.

Cycle 2h's sole target is
`bounded_synthetic_cycle2_public_uint8array_ingress_intrinsic_backing_and_length_validation_owned_copy_and_no_caller_metadata_iterator_or_allocation_dispatch`.
The claim is Pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`; its frozen-byte local gate,
existing Ubuntu/Windows CI, parser live acceptance, and custody live acceptance
all passed. The exact transition is 40 paths (38
modified, two added) from
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98` and exactly 82 cumulative Cycle 2c
paths. Cycle 2g's historical exact 32-path/73-unique history remains unchanged.
The additional Cycle 2h transition path is the existing historical custody
fixture manifest. It adds no new cumulative-union path and refreshes only the
two changed custody source/test SHA-256 entries; fixture cases, schema, order,
and payload identity/content remain unchanged.
Cycle 2f's original `72e91f5` conclusion remains Superseded; its `df1ddff`
restoration and Cycle 2g's claim remain Superseded historical conclusions because prototype
equality admitted re-prototyped shared backing and alternate typed-array element
types.

Baseline CI `32695006904` and PostgreSQL `32695006890` are historical health
only. Parser `32695006897` and custody `32695006869` passed source/test stages
but failed at `commit_boundary` on one already-pinned unrelated database path;
no runtime acceptance occurred. Cycle 2h adds no package, dependency, workflow,
new evidence schema, new/dedicated/live evidence artifact, evidence note,
external data, or composition. The refreshed existing local custody manifest is
a fixture-integrity anchor, not new live evidence. Cycle 2h
does not defend poisoned primordials, isolate caller code in another process or
realm, authenticate real sources, supply Cycle 2b authority, prove independent
parsing/adjudication or real quality, make precommitment durable, secure a
network, provide production custody/KMS, complete Cycle 2, or authorize
production.

For exact source commit `61701307ded7fa77a555e27925ae86670f6b4dc0`, CI run
`32757171049` passed in Ubuntu job `97527284364` and Windows job `97527284624`.
Parser run/job/artifact `32757171096` / `97527284903` / `9531335028` and custody
run/job/artifact `32757171127` / `97527284597` / `9531290999` passed runtime
acceptance and commit-bound review on attempt 1. Parser and custody remain
regression and historical-boundary anchors, not a new Cycle 2h evidence domain.

Cycle 2i addresses a narrower P1 interface threat: historical Cycle 2a signed
parser-result provenance and historical Cycle 2d normalization existed as
separate contracts, so no bounded boundary required exact raw-archive digest
bindings and authenticated complete parser-result envelopes before delegating
canonical documents to the normalizer. The private
`@research-cockpit/filing-parser-normalization-handoff` package accepts exactly
two raw synthetic archives and two canonical Ed25519-signed complete ten-fact
envelopes with distinct original/amendment roles.
It does not translate or widen Cycle 2a's historical two-fact v1 output; that
shape fails the complete-result contract.

The handoff owns and bounds archive, envelope, and supplied canonical Ed25519
DER SPKI bytes before use. It rejects non-canonical JSON and duplicate keys,
reconstructs each domain-separated signing payload, verifies the signature
under the supplied key, requires exact supplied key and image identities, and
recomputes the corresponding raw-archive SHA-256. Canonical document
reconstruction is part of strict envelope parsing; provenance and archive
verification precede unchanged delegation of the exact embedded
original/amendment bytes to `normalizeSyntheticFilingFactPair`. Cycle 2d then
validates the distinct roles, complete closed ten-fact sets, parser, taxonomy,
concept, unit, period, dimension, source, amendment lineage, and pair; only its
`normalized` result succeeds.

This closes only substitution, partial-set, silent-repair, and unverified
synthetic interface paths under caller-supplied trust inputs. It does not prove
the key owner or image is authoritative, that the image or parser ran, that
extraction was correct, or that signed documents were derived from archive
content beyond the asserted digest binding. A malicious or mistaken caller can
supply a self-consistent key, image identity, archives, and signed envelopes;
Cycle 2i authenticates their internal binding, not their external truth.

Any carrier, syntax, signature, key/image, archive-digest, role, fact-set,
metadata, lineage, mutation, dependency, or downstream Cycle 2d failure maps to
the same empty value-free quarantine. Failure reveals no normalized facts,
input values, archive/document hashes, provenance identifiers, signature or
mismatch detail, or canary content. Success exposes only the unchanged Cycle
2d normalized record plus aggregate synthetic handoff provenance.

The sole target is
`bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff`.
Implementation and promotion are Pass only for exact source commit
`5a1589ede57e00d6ff60521e7b53bea2ac849b0a`, whose exact baseline is
`dda2ecafc70aa6c4859a29cb312849bac5dec253`. Its 21-path transition (9 added, 12
modified), frozen local gate (1,064 passed tests and 3 skips), and CI run
`32817294734` in Ubuntu job `97708048290` and Windows job `97708048027` all
passed on those source bytes.
Cycle 2i adds no dedicated workflow, evidence schema, evidence artifact,
offline review, evidence note, I/O, parser execution, custody, database, API,
web, queue, or real data. Historical Cycle 2a and Cycle 2d evidence remains
immutable. Parser run/job `32817294720` / `97708047987`, custody run/job
`32817294732` / `97708048009`, and PostgreSQL run/job `32817294741` /
`97708049006` are regression health only.

Cycle 2j closes one repository-controlled execution/derivation gap. Each
accepted closed synthetic original/amendment archive pair uses exactly two
fresh, isolated, digest-pinned, network-disabled workers; additional fresh
workers cover replay and adversarial paths. The host must recompute source
digests, validate complete canonical Cycle 2d ten-fact documents, sign Cycle 2i
envelopes outside the workers, and pass the exact archive/envelope bytes without
repair to the unchanged Cycle 2i handoff. This narrows the risk that
self-consistent envelopes were never produced by the reviewed worker path.

The sole claim is
`bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff`.
The historical execution evidence passed only for exact source commit
`b2c7a28c2c5720253eba275b65d3313b114c3bc4` from exact baseline
`f17bacc6adc46851e182d260d59830652f1953bb`. The 44-path transition, 1,095-pass
local gate, all exact-source workflows, dedicated run/job `32897837981` /
`97964475815`, retained artifact `9581921300`, matching artifact/evidence
anchors, and 51-of-51 `offline_consistent` review passed. Any input, container,
output, signing, source, role, mutation, cleanup, or handoff failure collapses
to one empty value-free quarantine.

Cycle 2j cannot establish general parser or accounting correctness, an
independent second engine, signer/image/source authority, real filing
authenticity, Cycle 2b approval, adjudicated real quality, custody,
application/database/queue composition, full Cycle 2 exit, real-data admission,
or production. Its exact promoted boundary is in
[ADR 0037](./adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md)
and the [Cycle 2j exit matrix](./CYCLE_2J_EXIT_MATRIX.md).

Cycle 2k attempted to close one bounded cross-engine agreement gap. From exact
baseline `962a00f65835fc6126e4da98e0e0d5998e8d59cc` through four failed revisions to
exact source commit `54908db1ded8193ac4ade7a3d6f38505c6b4b8e5`, it executes the same
owned synthetic original/amendment pair through the existing Cycle 2j Python
worker and a distinct zero-install pinned Node worker. Each fixed role's live
canonical stdout document and both engines' complete normalization records must
agree byte for byte; any disagreement or failure returns one atomic empty
value-free quarantine. The historical sole claim was
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`.

The historical execution evidence passed only for exact source commit
`54908db1ded8193ac4ade7a3d6f38505c6b4b8e5`: the exact five-commit chain,
44-path transition, full local and exact-source workflow gates, dedicated
run/job `32917020041` / `98022742591`, retained artifact `9588542275`, and
66-of-66 `offline_consistent` review passed. The four earlier failed runs
remain historical non-evidence with zero artifacts. Distinct language, source,
image, and process identities cannot establish true organizational, operator,
key, host, or failure-domain independence. The historical bounded execution
Pass also cannot establish
general parser/accounting correctness, real SEC/source authority, Cycle 2b
approval, independently adjudicated real quality, real data, or production.
Cycle 2b remains externally Blocked on the exact inventory, rights/steward
approvals, chronology, authority keys, and human review. Historical evidence
and anchors remain immutable. See
[ADR 0038](./adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md)
and the [Cycle 2k exit matrix](./CYCLE_2K_EXIT_MATRIX.md).

The Cycle 2k security conclusion and claim are Superseded. A caller could
present new archives while injected engines returned cached valid child results
for an unrelated archive pair: outward provenance named the current inputs, but
the normalized facts and child receipts remained bound to the stale archives.
In addition, byte-exact engine agreement could accept an identical common-mode
lineage mutation because the boundary did not validate complete reciprocal
per-key predecessor/successor relations.

Cycle 2l is Pass only for exact source commit
`2e3a7e33a76d19b993375958aff671707a81ef05`, the exact corrective child of
failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f` from baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397`. It treats child results as
untrusted inputs and recomputes their pair and execution bindings against the
current original/amendment archive hashes, exact top-level documents, the
configured image, and receipt-declared key/public-key context. Every fact must
bind to its current archive and correct role. The complete result must have the
fixed original-then-amendment
20-fact partition and ten reciprocal per-key lineage edges with matching
endpoints and effective times, strict accepted-before-available chronology,
canonical decimals, fixed concept/unit/period context, duration start strictly
before end, one common period end and duration-fact start across both roles,
accession-year and shared ten-digit issuer-segment consistency, and at least one
changed and one unchanged amendment outcome.

Any failure remains one atomic empty value-free quarantine. The six-case v2
live matrix requires one exact archive-bound agreement and five quarantines:
cached replay under different archives, identical common-mode lineage mutation,
normalization mismatch, archive tamper, and role swap. The sole target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement`.
Dedicated run/job `33011584084` / `98318943081` failed at
`evidence_validation_transition` before artifact retention. Custody run/job
`33011584059` / `98318941993` and parser-isolation run/job `33011584060` /
`98318941736` failed at `commit_boundary`; all three runs retained zero
artifacts and are immutable non-evidence. The promoted source completes the
exact two-commit, two-first-parent chain with 23 cumulative paths and 14 paths
in the corrective commit. Full local `pnpm verify` passed, including 51
acceptance tests. Source CI run `33013464811` passed Ubuntu job `98325467206`
and Windows job `98325467249`. Dedicated run/job `33013464847` / `98325467722`
retained 7,581-byte artifact `9623531283`, named
`filing-parser-cross-engine-execution-evidence-v2-2e3a7e33a76d19b993375958aff671707a81ef05-1`,
with ZIP digest
`sha256:bfd3eb2fabdba8b533cbbcd488fe9decd19f47cd4d73c408ac824a87717aaed8`
and canonical evidence digest
`sha256:c1d4d7c6c77bd5aa0a9a0af5de08fbbf3b823744b9cba47e3a59283dfd41f6d8`.
It binds 66 source hashes, 23 transition paths, 16 ordered checks, 16 ordered
nonclaims, and six outcomes (one agreed and five quarantined); independent
review returned `offline_consistent` for 66 of 66 source hashes. Injected
boundary and receipt authenticity and fresh engine execution are nonclaims.
Quality composition is deferred, and real-data, Cycle 2b authority, full
quality, and production gates remain Blocked. See
[ADR 0039](./adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md)
and the [Cycle 2l exit matrix](./CYCLE_2L_EXIT_MATRIX.md).

Cycle 2m is promoted only for exact source commit
`5d61868e6075865b32640ddaceb845ac9dbc69f3`, the single-parent child of frozen
baseline `1cb7d3ce024cbd29665af7ec4e010da0c380b726`. It removes injected child
factories, runners, and signers from the public configuration: callers may
supply only sealed engine descriptors. The package owns audited direct-Docker
runners and creates one internal ephemeral Ed25519 signer per invocation. Each
invocation creates, starts, attaches to, and removes exactly four fresh
containers, verifies zero residue, and binds every independently recomputable
lifecycle receipt with the Cycle 2l agreement, complete normalization record,
and key context into one distinct invocation binding. Two invocations over the
same inputs normalized byte-identically while producing eight unique
container-ID digests, eight unique lifecycle-binding hashes, and two distinct
invocation bindings. Their receipts contained the exact `python-original`,
`python-amendment`, `node-original`, and `node-amendment` partition twice. Any
descriptor, Docker operation, receipt, binding, agreement, uniqueness, or
cleanup failure returns one atomic empty value-free quarantine.

The sole promoted target claim is
`bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding`.
Full local verification passed, including 27 core Vitest tests, 10 worker tests,
and 50 of 50 acceptance tests. Exact-source CI run `33022797756` passed Ubuntu
job `98356972324` and Windows job `98356973090`. Dedicated run/job
`33022797708` / `98356972412` passed and retained 8,858-byte artifact
`9627207288`, named
`filing-parser-cross-engine-execution-evidence-v3-5d61868e6075865b32640ddaceb845ac9dbc69f3-1`.
Its ZIP digest is
`sha256:dfd56f1564a55f1c37fc6f0fdab33e390f5530662b96107c47602e03008ecd9b`;
the 32,961-byte canonical evidence digest is
`sha256:25dfd0dd5c36d24656de9eda85a34940a40f50e11cd02535bae1fb8f24c05c6e`.
The version `3` / schema `3.0.0` record has status `passed`, `sourceCount: 71`,
and `transitionPathCount: 24`. It preserves all 16 ordered checks and 16 ordered
nonclaims and records exactly one agreement and five quarantines, with
`normalizationStable: true`, `lifecycleBindingsDistinct: true`, and
`invocationBindingsDistinct: true`. Independent review returned
`offline_consistent` for the complete frozen source inventory.

Source-triggered parser-isolation run `33022798055` and payload-custody run
`33022797729` failed only at their historical `commit_boundary`, retained zero
artifacts, and remain immutable non-evidence. Exact five-file maintenance child
`1860bb367afdb6d725e41880ebb121dda4a04f39` restored strict legacy routing
without replacing the v3 evidence. Custody run/job `33024664186` /
`98363073966`, parser-isolation run/job `33024664197` / `98363074166`, and
maintenance CI run `33024664292` passed; CI passed Ubuntu job `98363074101`
and Windows job `98363074221`. Cycle 2m maintenance run/job `33024664259` /
`98363074109` also passed and deliberately retained zero artifacts because the
child is routing maintenance, not a second v3 evidence source. Cycle 2l v2 and
Cycle 2k v1 evidence remain immutable.
This boundary does not authenticate the Docker daemon, host, kernel, or
container IDs; attest the worker-image supply chain; semantically prove the
absence of nonce/cache behavior inside workers; establish an external signer,
KMS, or HSM identity; prove real parser quality; establish Cycle 2b authority;
cover 100 real filings or 2,000 adjudicated assertions; create B15/V15; admit
real data; or authorize production. Quality composition is deferred until the
fresh lifecycle boundary is proven. Cycle 2b cannot be created from synthetic
metadata, authority keys, approvals, clocks, or human-review assertions. See
[ADR 0040](./adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md)
and the [Cycle 2m exit matrix](./CYCLE_2M_EXIT_MATRIX.md).

Cycle 1b-a adds a disconnected operation-scoped projection contract. It has no
database implementation. The complete synthetic fixture port is explicitly not
a database adapter seam.

Cycle 1b-a2 adds a disconnected PostgreSQL-row normalizer for dimensionless
synthetic financial facts. It accepts no connection or SQL capability and is
not imported by either running app.

Cycle 1b-b1 adds a disconnected, clean-only PostgreSQL acceptance harness and a
digest-pinned Ubuntu service workflow. Its first reviewed run passed at
`611c93d`. The live checks bootstrap through the ephemeral container superuser and impersonate
the migration-defined `NOLOGIN` capabilities, so they do not establish
production authentication, identity binding, network security, or migrator
separation. `set_request_context` still accepts trusted synthetic IDs and must
not be treated as an identity resolver.

After all implemented probes pass, the acceptance entry point creates one
exact-schema, success-only run record and the workflow may upload exactly that
file. Exclusive creation and success-only upload reduce stale or false-green
records; exact source hashes bind the record to reviewed inputs. The record is
unsigned metadata, not independent provenance. It intentionally excludes
secrets, raw environment values, SQL/logs, data identities, and counts. Pull
request artifacts and expired/deleted artifacts remain an external trust and
retention boundary.

The first retained record, run links, hashes, and explicit limitations are
listed in the [Cycle 1b-b1 evidence note](./POSTGRESQL_ACCEPTANCE_EVIDENCE.md).

Cycle 1b-b2 proves one narrower boundary in reviewed run `31988811000`: an
ephemeral PostgreSQL runtime service account authenticated with a run-local
SCRAM password over loopback TCP inside the same isolated service container,
then explicitly assumed only the existing `NOLOGIN` runtime capability. The
service published no host port. The run covered wrong-password rejection,
direct pre-`SET ROLE` denial, cross-capability role denial, exact membership
options, missing-context zero visibility, one alpha-versus-beta tenant read,
transaction cleanup, and a representative runtime write denial. Exact anchors
and limitations are in the
[Cycle 1b-b2 evidence note](./POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). The broader
b1 query-shape, rights, and prepared-read probes are not reclassified as
authenticated-session evidence.

Cycle 1b-b3 closes that precise bounded evidence gap in reviewed PostgreSQL run
`31991498652` at commit `664c0e5b`. While the b2 ephemeral login and passfile
were active, the harness repeated the reviewed alpha/beta visibility, inactive
and non-current membership, direct/join/subquery isolation, operation-rights,
and alternating prepared-read assertions through transaction-local selection
of the runtime capability. The b1 administrator-impersonation path remained
intact. The downloaded version 3 record returned `offline_consistent` against
separately supplied anchors. See the
[Cycle 1b-b3 evidence note](./POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[exit matrix](./CYCLE_1BB3_EXIT_MATRIX.md), and
[ADR 0015](./adr/0015-authenticated-runtime-authorization-matrix.md).

Cycle 1b-b4 then exercised the narrow driverless financial-fact projection
query through that authenticated service account and passed the untrusted
JSON-lines rows through the fail-closed normalizer. The reviewed PostgreSQL run
`32007521395` at commit `55c61ec` retained an offline-consistent version 4
record. Exact scope and limitations are in the
[Cycle 1b-b4 evidence note](./POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[exit matrix](./CYCLE_1BB4_EXIT_MATRIX.md), and
[ADR 0016](./adr/0016-driverless-projection-query-and-semantic-unit-mapping.md).
This does not add an application driver, pool, composition root, complete
projection, write path, or real data.

Cycle 1b-b5 source now replaces only the fixture-load authentication boundary.
It preserves the reviewed fixture and migrations, extracts the validated
direct-insert body, and runs it through one ephemeral container-local SCRAM
login with an exact set-only edge to the existing synthetic test-seed
capability. The source includes wrong-password, pre-role, escalation,
full-fixture rollback, synthetic-only RLS, mutation/ledger/DDL denial,
role-reset, and zero-residue probes. That exact path passed in reviewed
PostgreSQL run `32012508025` at commit `04e5c1b`; the retained version 5 record
returned `offline_consistent`. See the
[B5 evidence note](./POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](./adr/0017-authenticated-test-loader-fixture-load.md), and the
[Cycle 1b-b5 exit matrix](./CYCLE_1BB5_EXIT_MATRIX.md).

Cycle 1b-b6 adds a separate preparatory owner-DDL canary after the
unchanged bootstrap and test-loader cleanup. One ephemeral container-local
SCRAM login has no direct application privilege and may select only the
existing owner capability through an exact set-only edge. The reviewed run
covered wrong-password rejection; pre-role denial; the reviewed forbidden role
and session-authorization transitions; transaction-local owner identity;
injected DDL rollback; one committed canary with exact owner and ACL;
authenticated removal; ledger immutability; role reset; and zero login,
membership, backend, passfile, and object residue before catalog checks and
evidence. That path passed in PostgreSQL run `32058853521` at commit `7aac502`;
the retained version 6 record returned `offline_consistent`. See the
[B6 evidence note](./POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](./adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](./CYCLE_1BB6_EXIT_MATRIX.md).

The temporary owner edge is a high-authority acceptance boundary despite the
login's otherwise weak attributes. Mandatory cleanup and a fixed canary object
limit the exercised path, but they do not make the login a least-privileged
migrator or authorize any production owner membership.

Cycle 1b-b7 introduces a separate v2 plan as the sole current migration
authority for B7. After inherited b1 through b6 regressions, an exact
maintenance-database reset removes the disposable target and four
dependency-free capability roles before proving a pristine namespace. A local
container-superuser platform transaction then creates the roles, owner-owned
schemas, database/schema/public ACL lockdown, and hardened `btree_gist`.
Only the separately committed application phase uses an ephemeral,
connection-limited, non-superuser SCRAM login with one set-only owner edge.
Rollback/replay, identity, ledger attribution, object ownership, passfile,
backend, membership, login, and login-owned-object residue are fail-closed
gates before V7 evidence. That bounded path passed in PostgreSQL run
`32068159652` at commit `41d13dd`; the retained version 7 record returned
`offline_consistent`. See the
[B7 evidence note](./POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[ADR 0019](./adr/0019-versioned-authenticated-migration-phase.md), and the
[Cycle 1b-b7 exit matrix](./CYCLE_1BB7_EXIT_MATRIX.md).

Cycle 1b-b8 adds one ephemeral container-local
SCRAM login with one exact set-only edge to the existing `NOBYPASSRLS` backup
capability. The pinned `pg_dump` retains row security and creates a custom,
column-insert, data-only archive containing exactly the 21 reviewed synthetic
application data tables, not the migration ledger or any schema/global object.
Its restore phase creates a second database from `template0` in the same
cluster, independently establishes the reviewed platform and exact v2
application plan, then uses a different ephemeral SCRAM login with one exact
set-only test-seed edge to perform a single-transaction data restore. The
archive file, privileged target provisioning, restore login, and temporary
database are new acceptance-only trust boundaries. Their source contracts,
negative probes, and cleanup orchestration passed 409 tests across the 10
database test files plus database typechecking, the migration and static
PostgreSQL guardrails, ESLint, Prettier, and the diff check. The bounded live
path then passed in PostgreSQL run `32076642878` at commit `49d3a96`; its
retained version 8 record returned `offline_consistent`. See the
[B8 evidence note](./POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md)
and the [Cycle 1b-b8 exit matrix](./CYCLE_1BB8_EXIT_MATRIX.md).

Cycle 1b-b9 adds one real-driver boundary without connecting it to the
running application. A non-owning adapter receives one exclusively leased,
already-connected client and a separately injected trusted synthetic actor. It
snapshots actor and query data before I/O, resets transaction state, executes
one read-only transaction with transaction-local runtime role/context, feeds
only the reviewed B4 result shape to the fail-closed normalizer, rolls back
failures, poisons after unsafe reset or rollback failure, and rejects overlap
before SQL. The workflow exposes one random port bound only to runner loopback
for the real-client probe. All 450 database tests and local source gates passed.
The bounded live path then passed in PostgreSQL run `32083732063` at commit
`8e470e9`; its retained version 9 record returned `offline_consistent`. See the
[B9 evidence note](./POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./adr/0021-single-client-read-only-postgresql-projection-adapter.md),
and the [Cycle 1b-b9 exit matrix](./CYCLE_1BB9_EXIT_MATRIX.md).

Cycle 1b-b10 has a live-reviewed bounded-pool result, still disconnected from
the running application. `PooledPostgresFinancialFactProjectionSource` owns one
explicitly transferred real `pg.Pool` limited to two clients; the caller may not
call `connect()`, query or release a client, call `end()`, or otherwise inspect
or use the pool during source ownership. Only read-only counters may be checked
after `source.close()` completes. It snapshots the complete query and trusted
synthetic actor before checkout, cleans each session,
reimplements the exact B9 read-only role/context/B4-query transaction, and
recycles only an unambiguously successful checkout after postflight reset.
Finite pool acquisition and PostgreSQL `statement_timeout` bound waiting;
adapter failure, timeout, failed transaction, or cleanup ambiguity destroys the
checkout. An active abort marks cancellation, waits for the in-flight
PostgreSQL operation to settle under the fixed server timeout, and only then
destroys the checkout. A queued abort cannot promptly cancel `pg-pool.connect()`;
it remains bounded by acquisition and destroys any late checkout. Source and
local verification pass all 12 database test files and 485 tests, database
typechecking, migration and PostgreSQL static guardrails, focused
ESLint/Prettier, and the diff check; independent integrated review reports GO
with no P0/P1 finding. The bounded path passed in PostgreSQL run `32161137775`
at commit `2dcb259`; its retained version 10 record returned
`offline_consistent`. See the
[B10 evidence note](./POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./adr/0022-bounded-postgresql-projection-pool-lifecycle.md), and the
[Cycle 1b-b10 exit matrix](./CYCLE_1BB10_EXIT_MATRIX.md).

The reviewed live reset probe stays outside that ownership boundary. A separate
administrative connection may observe only same-PID idle state, canonical
application name, session user, and advisory-lock absence, then the source must
perform a subsequent actor-isolated load and the timeout/application-name
probes. Custom-GUC and prepared-statement cleanup are source/unit/static
`DISCARD ALL` evidence, not direct live pool inspection.

The queue probe also avoids inspecting the owned pool: fixed `max: 2`, two
admin-observed blocked PIDs, and a stable timeout from the third source load are
the complete live acquisition-bound evidence.

Cycle 1b-b11 source adds a separate high-authority migration boundary without
connecting it to either running application. One non-owning deployer snapshots
the closed v2 plan, accepts only an exclusively leased authenticated client,
and selects the reviewed owner capability only inside a finite-timeout
read-write transaction. The shared advisory lock precedes the exact ledger
table lock; ledger shape and an exact non-empty manifest prefix are validated
before pending reviewed bodies and matching rows may run. Drift is value-free,
injected failure must roll back body and ledger effects together, and any
ambiguous rollback, commit, or role-reset state poisons the deployer. The
acceptance-only `v2-0005` reconstruction is a bounded disposable-target setup,
not a downgrade or production recovery interface. Integrated local verification
and the bounded live V11 execution, cleanup, artifact, and independent review
are complete. PostgreSQL run `32183709701` passed at commit `5df9d07`; its
retained record returned `offline_consistent`.

Cycle 1b-b12 adds a separate acceptance-only query-plan/load boundary,
still disconnected from both running applications. Its fixed module and fixture
admit no caller-selected SQL, endpoint, planner setting, connection setting, or
benchmark scenario. The reviewed live path used a disposable clone, a fresh
SCRAM `NOBYPASSRLS` runtime login, and a runner-owned pool bounded to eight
clients. Authenticated
forced-RLS plans used the reviewed fact and tenant indexes without disabling
sequential scans or adding an index. Exactly 2,000 promises were submitted, but
only the first eight runtime workload backends could execute at once. A
separate out-of-band administrator observed that barrier but executed none of
those 2,000 workload reads; queued promises are not database identities or
connections. Source and integrated local verification plus the live V12
execution, cleanup, artifact, and independent review are complete. PostgreSQL
run `32230667908` passed at commit `59c4e58`; its retained record returned
`offline_consistent`.

These database logins and injected actors are not user identities. The runtime service still chooses
the synthetic principal and organization passed to `set_request_context`, so a
compromised service account could choose another synthetic context unless a
future verified identity resolver prevents it. B2 therefore does not establish
end-user binding, production BOLA protection, external/TLS transport, secret
management, an application pool, or deployed persistence. B11 narrows only one
exact container-local v2 suffix; external or production incremental
migrator credentials, arbitrary-manifest or multi-release upgrades, production
orchestration/recovery/cancellation/failover, and global platform/application
atomicity remain deferred. External/production/incremental/continuous backup
and full-scope restore also remain deferred. The
reviewed B8 result is strictly narrower than that broad production gate. The B5
test-loader result establishes only one sequential, synthetic, container-local
acceptance-only session, not a production loader or identity boundary. The
reviewed B6 canary does not execute a migration, redesign role bootstrap, or
close `authenticated_migrator_sessions`. B7 targets only the exact
container-local clean application migration after a separately committed
platform phase; external/production/incremental migration and global
cross-phase atomicity remain explicit nonclaims.
The reviewed B9 adapter narrows only the prior “no driver” gap; it does not
verify who supplied the synthetic actor and does not establish pool
reset, simultaneous backends, cancellation, timeout, TLS, secret-management, or
application-composition behavior.

The reviewed B10 result narrows only the bounded lifecycle mechanism. It proves
clean checkout/reuse, two simultaneous tenant-isolated backends, bounded
acquisition, settlement-before-discard active abort, server-timeout recovery,
destructive failure discard, idempotent close, and zero observed residue for
one runner-local pool. B10 never claims graceful PostgreSQL CancelRequest,
prompt queued abort, reuse of a canceled backend, production tuning, load
capacity, retries, failover, identity resolution, or application composition.

The B11 live result remains limited to its bounded exact-v2 proof. It does not
establish external or production credentials,
arbitrary manifests, general incremental or multi-release migration, online
application/schema compatibility, concurrent application writes, crash
recovery, cancellation, retry/failover, distributed coordination, or global
platform/application atomicity.

The reviewed B12 result does not establish production capacity, throughput,
latency SLOs, pool sizing/tuning/failover, 1,000 or 2,000 simultaneous database
backends, or planner stability across other data distributions, statistics,
hardware, versions, extensions, settings, or schema changes. Its privileged
synthetic reference plan is not a runtime authorization path. Real data,
end-user identity, application composition, deployment, and production
readiness remain outside B12.

The offline record verifier accepts only a small regular non-symlink file,
requires independent repository/run/hash anchors, and compares canonical bytes
with fixed source blobs read from the explicit local Git commit. It never
consults a remote or mutable worktree and emits only `offline_consistent`.
Malicious or mistaken trust anchors, forged GitHub runs/artifacts, compromised
workflow logs, unsigned/unreachable commits, and a dishonest database execution
remain outside that result and require operator review.
The operator-controlled local Git database and PATH-resolved Git executable are
part of this verifier's trusted computing base; the CLI is not a sandbox for an
untrusted repository.

Assets at risk are source integrity, fixture provenance, rights-policy behavior,
browser-local thesis text, seeded synthetic in-memory research state, denial
response minimization, and the guarantee that restricted fixture data does not
leave the server projection.

## Implemented controls

- Server-side allow/deny checks run before API serialization; denial paths have tests.
- The API exposes the four existing reads plus exactly two update-only
  synthetic research-state routes, permits CORS only from the two local web
  origins, disables caching, emits trace IDs, and applies security headers.
- The Cycle 1c write composition requires an exact loopback peer, one fixed
  public persona selector, one strong safe-integer `If-Match`, and one bounded
  `Idempotency-Key`; it rejects query strings, duplicate/comma-joined headers,
  caller authority headers, non-allowlisted body fields, and aggregate bodies
  above 384 KiB. Authorization is re-evaluated before idempotent replay.
  The server generates its trace identifier and ignores a caller trace rather
  than using it as request or audit identity. Response DTOs omit organization,
  principal, creator/updater, audit, and idempotency metadata; failure bodies
  disclose no rejected values or tenant-state detail.
- The web app applies a CSP, denies framing, disables unused browser permissions, has no third-party scripts/fonts/assets, and renders evidence as React text rather than HTML.
- Fixture excerpts have SHA-256 hashes, a provenance manifest, and a gate that rejects missing, stale, or mismatched records.
- Clean-room and dependency gates reject competitor references, unapproved collectors, copied raster assets, and forbidden packages in application source.
- Clean-room scanning now covers SQL, future database/config directories, Dockerfiles, and Compose files. It rejects external database file/network import primitives and paths outside the project boundary.
- Context-bound repository ports remove per-operation tenant arguments. The in-memory unit of work serializes and rolls back transactions, applies a fail-closed owner/researcher/viewer matrix, and returns defensive copies.
- Idempotency records are principal/organization/operation scoped,
  request-hashed, and expire after 24 hours. Audit events are allowlisted
  metadata with a 90-day retention deadline; that deadline is not yet a
  production purge guarantee. Thesis and alert deletes remove payload content
  while retaining only a tenant- and resource-type-scoped ID marker to prevent
  same-type delete/recreate ABA.
- PostgreSQL migrations have ordered SHA-256 checksums and static guards for synthetic-only constraints, fixed numeric values, exact rights-policy versions, tenant composite keys, forced RLS, transaction-local context, public privilege revocation, and read-only runtime grants.
- Operation-scoped projections bind candidates to one instrument and exact
  rights-policy version, validate returned scope and temporal cutoffs in core,
  take policy evaluation time from an injected trusted provider, expose no
  denied row IDs, accept no caller-complete/count state, and force an unknown
  public omission count for every incomplete or RLS-unknown view.
- The PostgreSQL wire boundary accepts only exact plain data rows, keeps
  listing and security identities separate, validates lossless timestamps,
  fixed decimals, intervals, cutoffs, units, and exact policy/grant echoes, and
  rejects an entire malformed batch with a value-free error. It cannot accept
  completeness or count input.
- The B9 adapter source accepts no host, port, URL, password, environment,
  client factory, pool, logger, retry, timeout, cancellation, or arbitrary SQL
  seam. It requires one exclusively leased client, captures a trusted actor
  provider once, snapshots every call before awaiting, resets transaction state,
  uses one unnamed parameterized B4 query inside one read-only transaction,
  normalizes before commit, and emits one stable value-free error.
- The B11 deployer accepts no connection configuration, credential, pool,
  client factory, arbitrary manifest, logger, retry, cancellation, or shutdown
  seam. It snapshots the exact reviewed plan before I/O, uses fixed local
  timeouts and lock ordering, validates the ledger object and exact manifest
  prefix, applies a pending suffix and its ledger rows atomically, fails drift
  through one stable value-free error, and poisons ambiguous client state.
- The B12 plan/load source accepts no caller-selected SQL, fixture, endpoint,
  planner knob, connection configuration, logger, production load profile, or caller
  concurrency. It freezes two query shapes, two named indexes, a deterministic
  fixture, exactly 2,000 submissions, a pool maximum of eight, and configured
  bounds on pending checkout and workload/plan/seed/`ANALYZE` statements.
  Success still requires every submission to settle and the pool to close;
  cleanup calls are not each independently cancellable, so the workflow's
  15-minute job timeout is the outer fail-closed bound. Runtime RLS and
  privileged reference plans remain distinct, and disabling sequential scans or
  creating an acceptance-only index is forbidden.
- The B13 privacy plan is a separate manifest-bound, pristine/empty-data-only
  suffix over the unchanged v2 plan in one fixed disposable database. Stable
  resource tokens use exact externally keyed HMAC framing, while the database
  accepts only 32-byte token shape and uniqueness and makes no authenticity
  claim. Raw tenant/resource UUID pairs in registry allocations exist only
  while that allocation is live and are cleared on the exact hard-delete
  transition. Active-to-offboarding locks
  out allocation before bounded online synthetic purge; expired audit and
  idempotency cleanup uses the transaction clock, `SKIP LOCKED`, and a fixed
  1,000-row-per-class bound. Exact roles, triggers, procedures, RLS, grants,
  fixture, policy, manifest, and SQL bodies are source-controlled and bound by
  V13 review. PostgreSQL run `32305478242` passed that exact synthetic path at
  commit `a959cba`; its retained V13 record returned `offline_consistent`.
- The B14 populated-cutover source starts only from the exact v2 pre-`0005`
  synthetic branch. An audited temporary work registry captures current and
  post-boundary thesis/alert identifiers while authenticated bounded token
  backfill runs. Contract rechecks the exact capture epoch and zero pending
  work under a short final write-conflicting barrier before installing the B13
  target and removing capture objects. The gate's test-seed insert and
  migrator-to-owner delete are not production writer authentication or a
  dual-write/allocation protocol. Identifiers deleted before capture have no
  authoritative recovery source. PostgreSQL run `32343225599` passed this exact
  bounded synthetic sequence at commit
  `d688aa21e969feef6611f6efcd1aeaaed6e31df9`; its retained V14 record returned
  `offline_consistent`. The catalog check is normalized semantic, not physical,
  equivalence to B13.
- The b3 acceptance source preserves the bounded b2 authentication controls and
  reuses the reviewed b1 tenant/rights assertions through the authenticated
  runtime session. It retains per-transaction `SET LOCAL ROLE`, sequential
  prepared-read isolation, and mandatory login/passfile/backend cleanup. The
  exact bounded matrix passed in the reviewed b3 workflow run; this is not a
  pool or concurrent-backend result.
- Exact dependency pins, a lockfile, a single allowed install script, an allowlisted production-license gate, dependency review, and two-OS CI reduce supply-chain drift.
- The evidence dialog traps/restores focus; chart values have a semantic table; reduced-motion and high-contrast preferences are respected.
- The reviewed bounded Cycle 2a parser uses a digest-pinned, zero-pip Python 3.12.13
  image, numeric non-root execution, dropped capabilities,
  no-new-privileges, network none, no ports, read-only root/input, hardened
  tmpfs, bounded CPU/memory/PIDs/nofile/output/time, exact archive/XML/taxonomy
  allowlists, atomic quarantine, exact-byte replay, and outside-worker
  ephemeral Ed25519 provenance bound to the built image ID. Its exact
  frozen-byte local `pnpm verify` gate passes format, lint, every guardrail,
  seven-project typechecking, all builds, and 32 test files with 792 tests. The
  separate Linux run, retained artifact, and independent offline review passed
  only the exact bounded synthetic claim.
- The reviewed bounded Cycle 2c boundary owns the input snapshot, recomputes its
  fixed SHA-256, requests a per-lifecycle AES-256-GCM key and nonce from the
  trusted injected CSPRNG,
  authenticates closed identity/retention metadata, avoids plaintext staging,
  publishes one complete record atomically, reauthenticates reads, serializes
  lifecycle operations, and retains the closed available/terminal audit-domain
  history after logical key unavailability. Only the public aggregate audit,
  errors, evidence, and log markers are value-free. Exact frozen local,
  Ubuntu/Windows CI, dedicated Linux evidence, offline review, and retained
  custody gates are Pass only for commit
  `ef22c7bc10596840b8ff686b9190730956fab0c4`.
- The promoted Cycle 2h source transition validates intrinsic typed-array
  backing and length before proxy-sensitive checks, enforces exact local
  carrier/backing prototypes and preallocation role limits, and uses ordinary allocation
  plus intrinsic copying across the full Cycle 2a–2g ingress inventory. Its
  focused hostile-carrier coverage and every promotion gate pass only for exact
  source commit `61701307ded7fa77a555e27925ae86670f6b4dc0`; historical Cycle
  2a–2g jobs do not establish the Superseded old-source conclusions.
- Promoted Cycle 2i defines one atomic synthetic interface: both raw archives
  must hash to their corresponding canonical signed complete ten-fact
  original/amendment envelopes, supplied key/image expectations and Ed25519
  signatures must verify, and exact embedded Cycle 2d documents must normalize
  without repair. This bounded guarantee and every promotion gate pass only for
  exact source commit `5a1589ede57e00d6ff60521e7b53bea2ac849b0a` from baseline
  `dda2ecafc70aa6c4859a29cb312849bac5dec253`.
- Cycle 2j is Pass only for exact source commit
  `b2c7a28c2c5720253eba275b65d3313b114c3bc4` from baseline
  `f17bacc6adc46851e182d260d59830652f1953bb`. Each accepted closed synthetic
  ten-fact original/amendment pair uses exactly two fresh isolated workers;
  additional fresh workers cover replay and adversarial paths. Outside-worker
  signed Cycle 2i envelopes, unchanged atomic normalization, exact-source
  workflows, retained evidence, and offline review passed.

## Non-production constraints

Local storage and the in-memory authorization harness are not encrypted and have no production identity boundary. Users are explicitly told not to enter sensitive information. The demo must not be exposed as a public service, connected to real data, or used for investment decisions.

The reviewed clean-only b1 run proves PostgreSQL syntax and only the exact
catalog, RLS, authorization, transaction-context, and failure probes listed in
its run record. It did not prove authenticated sessions. The reviewed b2 run
adds only one container-local SCRAM runtime service account and its explicitly
bounded probes. B3's broader authenticated tenant/rights/prepared-read matrix
passed only in the reviewed, sequential, container-local b3 run. None of these
results proves an authenticated end user, external or production
authentication, connection pooling, concurrent backends, cancellation,
dump/restore, disaster recovery, or production identity. An emulator is not a
substitute for those later gates, and `offline_consistent` alone is not engine
evidence without separate review of the GitHub run and logs. B2 does not
retroactively expand the historical b1 result, and b3 does not promote b1's
additional null/malformed/unsupported-context cases.

The reviewed B8 run adds only one authenticated, policy-scoped dump of
synthetic application rows and bounded restore into an independently
provisioned database in the same cluster. It does not establish an end-user,
external, production, or application trust boundary. Full-schema/global or
cross-cluster/version restore, untrusted
archive handling, external/production/incremental/continuous backup, storage
encryption or retention, backup deletion, disaster recovery, and RPO/RTO remain
release blockers outside B8.

The reviewed B9 run proves only that one real Node driver client reached the
ephemeral PostgreSQL service and passed the exact SCRAM/backend/read-only/
context/rollback/cleanup probes recorded for version 9. The trusted actor can
still be chosen by a compromised service, and the random loopback mapping is
only an acceptance-runner path, not production network security. Pool reset,
simultaneous backends, cancellation settlement, and timeout handling later
passed only the separate bounded B10 live gate; that result does not widen B9.
B11's reviewed V11 result covers the exact locked-ledger,
checksum-drift-refusal, once-only suffix, rollback, cleanup, and two-deployer
boundary. It is not a general or production migration system. See the
[B11 evidence note](./POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md).

B12's reviewed live gate submitted 1,000 fact and 1,000 tenant reads through at
most eight runtime workload backends, required exact Alpha/Beta isolation and
named-index plans, and removed all B12 login/backend/clone residue. That bounded
gate is not production capacity, general planner stability, real-data,
identity, or application-composition evidence. See the
[B12 evidence note](./POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](./CYCLE_1BB12_EXIT_MATRIX.md).

B13 reduces raw permanent-identifier retention only inside its separate
synthetic plan. A pseudonymous token can still be linkable within its privacy
domain, and PostgreSQL cannot distinguish a genuine external HMAC from an
attacker-supplied 32-byte value. Database deletion does not prove deletion from
replicas, caches, logs, search/analytics, third parties, backups, archives, or
restored media, and key-reference removal does not itself prove KMS/HSM key
destruction or cryptographic erasure. The source also does not authenticate a
data subject, resolve legal holds, schedule or monitor offboarding/retention,
support a populated online cutover, or admit real tenant/personal data.
Production admission remains blocked. The reviewed live V13 result is limited
to the exact synthetic, pristine/empty-data-only lifecycle in one disposable
database. See the
[B13 evidence note](./POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](./adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [Cycle 1b-b13 exit matrix](./CYCLE_1BB13_EXIT_MATRIX.md).

B14 narrows only the historical populated-cutover gap for one synthetic
capture/backfill/contract sequence. It does not establish production writer
authorization or allocation-gap coordination, continuous zero downtime,
production volume/duration/SLO/lock budgets, process or cluster crash recovery,
restart/resume, failover/replication/prepared-transaction concurrency,
post-contract downgrade, recovery of identifiers deleted before capture,
external key operations, global deletion, or real-data admission. Source-stage
work alone is not live engine evidence; the reviewed run establishes only the
exact bounded sequence above. See the
[B14 evidence note](./POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](./adr/0026-bounded-populated-resource-identifier-online-cutover.md)
and the [Cycle 1b-b14 exit matrix](./CYCLE_1BB14_EXIT_MATRIX.md).

Cycle 1c is implemented and verified only for the bounded synthetic loopback
source/test contract; it is not remote/live-engine or production evidence. The
full frozen-byte local release gate and two-OS CI run `32401541724` passed on
exact commit `84f6b92163e93fa8c5c079a786e49f8134b81f56`. Separate PostgreSQL
run `32401541467` is unchanged V14 regression health only; it is not Cycle 1c
engine evidence, B15/V15, or a replacement for the canonical B14 result at
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`. Its public selector does not prove
end-user authentication, account ownership, secrecy, unforgeability, or
impersonation resistance. Exact loopback checks do not prove external TLS,
CORS/CSRF/DNS-rebinding safety, reverse-proxy safety, or defense from a hostile
local process. The in-memory adapter supplies no
PostgreSQL/RLS, durable persistence, database-context cleanup, process-restart,
multi-process, or cross-instance continuity. The two exact updates do not prove
general API BOLA, research-state create/delete/read/list/export, alert
evaluation/delivery, production writer or B13/B14 token integration, browser-state migration,
tamper-evident denial audit, production load/SLO/failover behavior, or
production privacy/legal/DSAR/retention/KMS/backup/global-deletion controls.
Real customer, tenant, and personal data remain prohibited. Cycle 1c does not
widen any B1 through B14 evidence, and production admission remains blocked.
See
[ADR 0027](./adr/0027-loopback-synthetic-persona-research-state-api.md) and the
[Cycle 1c exit matrix](./CYCLE_1C_EXIT_MATRIX.md).

Cycle 2a is reviewed only for its exact bounded synthetic run. It does not
prove real public SEC filings,
counsel-approved corpus rights, ten-fact coverage, precision/recall or
adjudicated quality, general XBRL/iXBRL/taxonomy/plugins, external EDGAR/DNS/
TLS/SSRF/rate-limit handling, source authenticity, production KMS/HSM keys,
production container-host/kernel/daemon isolation, malware or zero-day safety,
distributed queues/retries/exactly-once, database/API/web composition or
B15/V15, retention/crypto-erasure/quarantine operations, correction lineage,
load/SLOs, or real-data/production admission. The full ordered boundary is in
[ADR 0028](./adr/0028-bounded-synthetic-filing-parser-isolation.md) and the
[Cycle 2a exit matrix](./CYCLE_2A_EXIT_MATRIX.md). Exact live and custody
anchors are in the
[Cycle 2a evidence note](./FILING_PARSER_ISOLATION_EVIDENCE.md).

Cycle 2b's source protocol does not establish its target claim. A future
machine-valid approval would prove only that supplied bytes verify under a
supplied key. It would not establish legal-opinion validity, authenticate
counsel or SEC, prove revocation freshness, prove that declared payload bytes
exist or match their hashes, or establish representativeness outside the exact
approved selection plan. Phase A also proves no raw-payload custody/retention/
deletion, EDGAR fetch/DNS/TLS/SSRF/rate control, malware safety, ten-fact parser
correctness, adjudicated ground truth or 2,000 assertions, quality or zero
silent failures, independent dual parsing, general XBRL/iXBRL, correction
lineage, production keys/queues/load, database/API/web composition, B15/V15,
real-data admission, or production readiness. The exact boundary is in
[ADR 0029](./adr/0029-fixed-public-filing-candidate-manifest-admission.md) and
the [Cycle 2b exit matrix](./CYCLE_2B_EXIT_MATRIX.md).

The SEC's public reuse statement and automated-access rate notice are context,
not approval or security controls. They do not replace repository-required
counsel/procurement review, source authentication, external approvals, or
fetch-control implementation.

Cycle 2c's bounded target claim passed only for exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4`, one generated synthetic object,
and one process after local, two-OS CI, dedicated Linux artifact, offline, and
custody gates all agreed. It does not establish Cycle 2b
approval or authority, real payload presence, source authenticity,
EDGAR/fetch/malware controls, production KMS or key recovery, physical or
cryptographic erasure, backup/replica/cache/log deletion, legal/DSAR/hold
execution, multi-host or crash durability, parser correctness, adjudicated
quality, application/database composition, B15/V15, real-data admission, or
production readiness. The exact boundary is in
[ADR 0030](./adr/0030-bounded-synthetic-filing-payload-custody.md) and the
[Cycle 2c exit matrix](./CYCLE_2C_EXIT_MATRIX.md); exact remote and custody
anchors are in the
[Cycle 2c evidence note](./FILING_PAYLOAD_CUSTODY_EVIDENCE.md).

Cycle 2d's target is only
`bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage`
for one exact closed synthetic original/amendment schema. It cannot establish Cycle 2b
approval, real payload identity or SEC provenance, rights/legal validity,
fetch/malware safety, XML/XBRL/iXBRL parser correctness, custody or
cryptographic erasure, independent dual validation, adjudicated ground truth,
2,000 assertions, quality thresholds, general concept/unit/dimension/fiscal
coverage, real amendment discovery, multi-document concurrency/recovery,
derived metrics/evidence/rights, database/API/web/queue composition, B15/V15,
real-data admission, full Cycle 2 exit, or production readiness. The exact
ordered boundary is in
[ADR 0031](./adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md)
and the [Cycle 2d exit matrix](./CYCLE_2D_EXIT_MATRIX.md).

Cycle 2e's target is only
`bounded_synthetic_two_declared_validator_exact_payload_agreement_conflict_quarantine_and_no_silent_repair`
for two fixed same-schema synthetic declarations in one package/process. It
cannot establish true validator/parser/implementation/failure-domain
independence, declaration or digest authenticity, real filing or fact
correctness, Cycle 2d normalizer correctness, external authority, adjudicated
ground truth, quality thresholds, malicious-collusion resistance, repair or
human adjudication, production composition, B15/V15, full Cycle 2 exit, or
production readiness. The exact boundary is in
[ADR 0032](./adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md)
and the [Cycle 2e exit matrix](./CYCLE_2E_EXIT_MATRIX.md).

Cycle 2f's target is only
`bounded_synthetic_fixed_population_declared_reference_quality_metric_accounting_and_fail_closed_threshold_evaluation`
for one fixed 100-document synthetic declared reference. Its original and
restored owned-byte conclusions remain Superseded historical claims; Cycle 2h
restores the bounded premise only on exact commit `61701307`. It cannot establish
actual independent adjudication, blinding, label correctness, representative
real filings, real parser quality, approved or statistically adequate
thresholds, Cycle 2b authority, malicious failure masking detection, production
composition, B15/V15, full Cycle 2 exit, or production readiness. The exact
boundary is in
[ADR 0033](./adr/0033-bounded-synthetic-declared-reference-quality-measurement.md)
and the [Cycle 2f exit matrix](./CYCLE_2F_EXIT_MATRIX.md).

Cycle 2g's target is only
`bounded_synthetic_in_process_one_shot_candidate_observation_commit_before_declared_reference_reveal_and_fail_closed_quality_evaluation`
for one synthetic in-process protocol instance. Its owned-byte conclusion is
Superseded on `df1ddff` and restored only on exact Cycle 2h commit `61701307`.
It cannot establish actual
reference inaccessibility before commit, external blinding or label-leakage
absence, digest secrecy, trusted chronology, durable or distributed
precommitment, signer/capability identity, independent adjudication, real
filings or parser quality, threshold adequacy, Cycle 2b authority, production
composition, B15/V15, full Cycle 2 exit, or production readiness. The exact
boundary is in
[ADR 0034](./adr/0034-bounded-synthetic-declared-reference-precommitment.md)
and the [Cycle 2g exit matrix](./CYCLE_2G_EXIT_MATRIX.md).

Cycle 2h's target is only
`bounded_synthetic_cycle2_public_uint8array_ingress_intrinsic_backing_and_length_validation_owned_copy_and_no_caller_metadata_iterator_or_allocation_dispatch`
for carriers satisfying the intrinsic brands and exact local prototypes across
the enumerated Cycle 2a–2g roles. It cannot establish primordial safety, caller-process isolation,
real payload/source authenticity, Cycle 2b authority, true validator
independence, independently adjudicated quality, durable precommitment, network
safety, production custody/KMS, database/API/web/queue composition, B15/V15,
full Cycle 2 exit, real-data admission, or production readiness. Its exact
boundary is in
[ADR 0035](./adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md) and
the [Cycle 2h exit matrix](./CYCLE_2H_EXIT_MATRIX.md). The claim and every gate
are Pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.

Cycle 2i's target is only
`bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff`
for exactly two raw synthetic archives and two canonical Ed25519-signed
complete ten-fact original/amendment envelopes under caller-supplied key/image
expectations. It can establish exact cryptographic consistency, recomputed
archive-digest binding, complete closed fact roles, unchanged Cycle 2d
delegation, immutable aggregate provenance, and fail-closed empty quarantine.
It cannot establish actual parser/worker/container execution, extraction or
accounting correctness, signer identity or key/image authority, signed-document
derivation from archive content beyond a digest assertion, real filing/SEC
authenticity, Cycle 2b inventory/rights/steward/authority/human review,
independent validation, adjudicated ground truth or real quality, custody,
database/API/web/queue composition, B15/V15, full Cycle 2 exit, real-data
admission, or production readiness. Implementation and promotion are Pass only
for exact source commit `5a1589ede57e00d6ff60521e7b53bea2ac849b0a` from
baseline `dda2ecafc70aa6c4859a29cb312849bac5dec253`.
The exact boundary is in
[ADR 0036](./adr/0036-bounded-synthetic-authenticated-parser-normalization-handoff.md)
and the [Cycle 2i exit matrix](./CYCLE_2I_EXIT_MATRIX.md).

Cycle 2j's promoted target is only
`bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff`
for one closed synthetic original/amendment archive pair executed in fresh
bounded workers and delegated through the unchanged Cycle 2i handoff. It cannot
establish real source or signer authority, general parser/accounting
correctness, independent validation, adjudicated real quality, custody,
database/API/web/queue composition, B15/V15, full Cycle 2 exit, real-data
admission, or production readiness. Every source and dedicated live gate passed
only for exact source commit `b2c7a28c2c5720253eba275b65d3313b114c3bc4`
from baseline `f17bacc6adc46851e182d260d59830652f1953bb`. The exact promoted
boundary is in
[ADR 0037](./adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md)
and the [Cycle 2j exit matrix](./CYCLE_2J_EXIT_MATRIX.md).

Cycle 2k's historical target was only exact source commit
`54908db1ded8193ac4ade7a3d6f38505c6b4b8e5`, the exact fifth single-parent
successor of baseline `962a00f65835fc6126e4da98e0e0d5998e8d59cc`, for the sole claim
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`.
Its security conclusion and claim are Superseded; its exact execution anchors
remain immutable historical facts. No broader source or evidence result is
promoted. Exact gates and nonclaims are in
[ADR 0038](./adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md)
and the [Cycle 2k exit matrix](./CYCLE_2K_EXIT_MATRIX.md).

Cycle 2l's target is only
`bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement`
from exact baseline `b9b7dd19996f0c5bb1e073ab5522c42e06dee397` through exact failed
precursor `67af24176df3c17fd6d54498095888c9a43ebe1f` to exact corrective source
`2e3a7e33a76d19b993375958aff671707a81ef05`. Its exact two-commit,
two-first-parent chain, exact-source six-case v2 live artifact, and independent
66-of-66 `offline_consistent` review passed. The three failed workflow runs
retained zero artifacts and remain immutable non-evidence.
Exact gates and nonclaims are in
[ADR 0039](./adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md)
and the [Cycle 2l exit matrix](./CYCLE_2L_EXIT_MATRIX.md).

Cycle 2m's promoted target is only
`bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding`
for exact source `5d61868e6075865b32640ddaceb845ac9dbc69f3`, the single-parent child of
baseline `1cb7d3ce024cbd29665af7ec4e010da0c380b726`. Its full local, two-OS CI,
success-only v3 artifact, digest-inspection, and independent offline-review
gates passed. Exact five-file maintenance child
`1860bb367afdb6d725e41880ebb121dda4a04f39` restored legacy routing and passed
its custody, parser-isolation, Cycle 2m, and two-OS CI workflows without minting
a replacement v3 artifact. Cycle 2m preserves Cycle 2l v2 and Cycle 2k v1
history and does not widen any external-authority, real-quality, real-data, or
production boundary. Exact gates and nonclaims are in
[ADR 0040](./adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md)
and the [Cycle 2m exit matrix](./CYCLE_2M_EXIT_MATRIX.md).

Cycle 2n's promoted target is only
`bounded_synthetic_source_owned_direct_docker_cross_engine_two_document_observation_precommitment_and_fixed_population_quality_evaluation_binding`
for exact source `1d7dee56c66c1ad0f5d612603567adf2589e0930`, the direct
single-parent child of frozen baseline
`09e76235b5683427f2dd3201aefa740bb5adb16e`. The public
factory accepts only sealed Cycle 2m descriptors and owns the direct-Docker
boundary. Callers cannot inject execution results, candidate observations,
facts, measurements, weights, exclusions, outcomes, callbacks, or options.

Commit reserves its one-shot state before validation or asynchronous execution.
It snapshots the exact plan, predeclared reference digest, and both archives,
then accepts only a complete Cycle 2m result. Ten original facts map once to
fixed coordinate 0001 and ten amendment facts map once to coordinate 0002;
source role/archive/document, lifecycle, observation, and quality-coordinate
hashes are bound by each mapping; the outer composition additionally binds the
complete invocation. The other 98 documents remain absent.
Reference content first enters after the same-instance capability is revealed,
and unchanged Cycle 2g/Cycle 2f perform the commitment and fixed-denominator
evaluation. Any mutation, concurrency, replay, substitution, mapping, execution,
reference, measurement, or dependency failure collapses to one empty value-free
quarantine.

The required successful protocol result is deliberately `evaluated/not_met`,
with 2/100 documents, 20/1,000 true-positive facts, 980 missing facts, and
1,960/2,000 silent critical failures. Treating that result as a parser-quality
Pass, hiding the missing population, or converting it to a quarantine would be
a security failure. Full local verification and all exact-source workflows
passed. CI run `33036093870` passed Ubuntu job `98398983676` and Windows job
`98398983801`; parser-isolation run/job `33036093898` / `98398983760`, custody
`33036093896` / `98398983789`, normalization `33036093852` / `98398983588`,
PostgreSQL `33036093864` / `98398983520`, and dedicated v4 `33036093863` /
`98398989554` also passed. Dependabot dynamic-scan run/job `33036162143` /
`98399193694` reached terminal green. The dedicated run retained canonical artifact
`9632073116`; ZIP digest
`sha256:12c5d5aeca103d693b5c0b761eb16a5ed5af24cc55402f4a6d7c976b994a3522`
and evidence digest
`sha256:4fdbb860468413929968c56cf72037a0f72b65669b3ae9c46844476bddf12c5c`
passed independent inspection, and review returned `offline_consistent`.
Versions 1 through 3 remain immutable history. Docker/host authenticity, worker
supply-chain attestation, external signer identity, actual blinding, correct
independent adjudication, representative real filings, real parser quality,
Cycle 2b authority, B15/V15, real-data admission, full Cycle 2 exit, and
production remain nonclaims or Blocked. See
[ADR 0041](./adr/0041-bounded-synthetic-source-owned-quality-composition.md)
and the [Cycle 2n exit matrix](./CYCLE_2N_EXIT_MATRIX.md).

Cycle 2o is Pass only for exact promoted revision
`472cc10b8df90bee01925b2efd4fbcb614d7590c`, the exact corrective child of
source precursor `46408ec875755ef531c124846143e9b619c1961f` from frozen
baseline `711fe866594d5e20a657a24c0a0c72fd78ab90be`. It closes the bounded
synthetic archive-input bypass left outside Cycle 2n: callers previously
supplied the original/amendment bytes directly, while historical Cycle 2c
covers a different single generated custody fixture. The outer protocol
encrypts the fixed original and amendment archives separately with fresh
AES-256-GCM key/nonce pairs, binds role/content/source into closed AAD and
canonical audit records, authenticates exact readback, and allows only owned readback snapshots
to enter unchanged Cycle 2n.
The sole claim is
`bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding`.

The primary threats are direct-input bypass; original/amendment role swap;
caller-injected custody, clock, entropy, key, nonce, path, digest, receipt, or
readback; mutation across asynchronous I/O; partial pair publication; audit,
AAD, ciphertext, tag, or key substitution; replay and concurrent reuse;
unbound custody-to-Cycle 2n results; and cleanup failure. One-shot reservation
must precede validation and I/O. Both records must complete before publication;
readback must recompute every binding; outer hashes must bind custody, complete
Cycle 2n commitment/evaluation, plan, and declared-reference digest; and every
failure must collapse to one empty value-free quarantine. Key/plaintext wipe
attempts and removal of the verified owned workspace are required, but neither
is a JavaScript memory-erasure or physical-media guarantee.

The quality security invariant is unchanged: a successful protocol operation
must still report `evaluated/not_met`, with 2/100 documents, 20/1,000
true-positive facts, 980 missing facts, and 1,960/2,000 silent failures.
Changing that accounting, populating the other 98 coordinates, or presenting
the custody round trip as real quality is a security failure. All exact Cycle
2n nonclaims remain the frozen ordered prefix and six custody-specific
limitations are appended. Real filing/source authenticity, Cycle 2b external
rights/authority, production KMS/HSM, durable retention/expiry, physical or
cryptographic erasure, backup deletion, crash/multi-host recovery, Docker/image
authenticity, independent adjudication, representativeness, B15/V15, real data,
and production remain nonclaims or Blocked.

The exact cumulative baseline-to-promoted transition contains 39 paths and 78
NUL fields with digest
`sha256:d830b547c4c0727bd948267819a01e8beba575e2d80d8a5e89fd1d8542b30212`;
the exact 14-path, 28-NUL-field, 1,274-byte corrective transition has digest
`sha256:5104d3ef85cfcee8e62010d9a76e3efbf0479dcf7f777fa784e956620b02df63`.
Full local verification passed 1,295 tests with 4 intentional skips, and all
five triggered workflows reached terminal green. CI run `33060480830` passed
Ubuntu/Windows jobs `98477727410` / `98477727517`; dedicated version 5 run/job
`33060480847` / `98477728062` retained success-only artifact `9641519947`.
Its ZIP digest is
`sha256:82916aa3b53112b8cc29b0e3bc5e575213757ca70a7d623a87d0167c89ecf419`;
the canonical evidence digest is
`sha256:1f53136f1811b19de0ba63ae1c1ec6d70cf2d5f86f578214e884069d137e5581`.
Independent artifact inspection and anchored review returned
`offline_consistent` for the 105-source, 39-transition-path record. These facts
do not authenticate the GitHub control plane, Docker host, worker image, or
external filing source, and do not change any external blocker. Exact gates are
in
[ADR 0042](./adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md)
and the [Cycle 2o exit matrix](./CYCLE_2O_EXIT_MATRIX.md).

Cycle 2p is Pass only for exact promoted revision
`d642e534b8911b58a32d50f8dfb976ae2900cadc`, the exact corrective child of
source `bc4b371784711102462ad28a9c9eb7cb567f1072` from frozen documentation
baseline `e21408acf70a28909136cc3eb0c10bbbd48b8266`. It closes two bounded
repository-controlled failure modes without adding an external trust boundary.

First, a Phase-A admission could previously remain marked valid until approval
expiry even when its supplied authority registry scheduled an earlier rights or
steward revocation. The immutable corrected implementation computes each
role's effective end and publishes the earliest end across both roles. The
half-open cutoff is tested in both role orderings and against an earlier
approval expiry. This prevents a stale advertised validity window, but the
registry, authority identities, revocation freshness, `evaluatedAt`, and clock
remain unauthenticated caller/out-of-band inputs.

Second, the source revision's Windows CI run exposed a false-quarantine path in
custody cleanup. Numeric `fs.Stats.dev` and `ino` cannot preserve every 64-bit
NTFS identity above `2^53`; distinct concurrent workspaces could therefore
appear identical. The corrective revision obtains bigint metadata throughout
workspace discovery and revalidation plus bounded regular-file link-count and
size checks. A deterministic alias regression proves that numeric equality does
not substitute for exact bigint identity. This prevents the observed collision
without claiming host, kernel, filesystem, disk, cleanup durability, or
physical erasure attestation.

Both independent evidence verifiers and the cross-engine workflow route Cycle
2p before Cycle 2o. All three accept only the exact six-path source or its one
exact eight-path corrective child, require the exact nine-path cumulative
transition, and fail closed on any other intersection with the ten protected
paths. Separately, the two verifiers replay the exact `7243f16` → `96b0426` →
`711fe86` historical chain and compare the current corpus-admission blob with
historical blob `e456cae97cf9eb377e3b3e8aabc156fdb377e2c7`.

Full local verification passed 1,306 tests with 4 intentional skips. CI run
`33118610052` passed Ubuntu/Windows jobs `98679559915` / `98679560385`; parser
isolation, custody, normalization, and cross-engine runs `33118609943`,
`33118610058`, `33118609968`, and `33118610020` reached terminal green. Cycle
2p creates no canonical evidence version; cross-engine acceptance emitted no
artifact, standard workflow artifacts are regression anchors only, and Cycle
2o version 5 remains immutable history at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`.

For the historical Cycle 2b/2p enterprise-admission track, exact external
inventory, rights/steward approval, trusted time, authenticated human authority,
real filing data, independent adjudication, real quality, B15/V15, real-data
admission, full Cycle 2 exit, and production remain nonclaims or Blocked. Exact
gates are in
[ADR 0043](./adr/0043-admission-validity-corrective-chain-promotion.md) and the
[Cycle 2p exit matrix](./CYCLE_2P_EXIT_MATRIX.md).

Cycle 2q is Pass only for exact source revision
`398bb280593b6de125c5561ac9dd1b1c0fe254bd`, the direct child of baseline
`2f0534d2a5b4206221cc66ece5e03cf529e5d373`. It introduces a disconnected,
zero-production-dependency manifest boundary for the explicit
`personal_single_user_local` profile. It neither imports the enterprise
Cycle 2b admission operation nor changes the immutable Cycle 2p implementation.

Assets at risk are profile integrity, manifest identity, corpus metadata,
bounded resource use, and error confidentiality. Primary threats are scope
confusion; open or ambiguous JSON; duplicate properties; mutation before
snapshot; hostile proxies or typed-array carriers; oversized or deeply nested
documents; duplicate accession or content identity; invalid chronology or
amendment lineage; declaration/manifest substitution; partial result leakage;
and forgery of public error details.

Controls are intrinsic owned byte snapshots, fatal UTF-8 decoding, exact
canonical JSON replay, closed schemas, bounded document budgets, exact
declaration-to-manifest SHA-256 binding, 1–100 sorted unique entries, closed
metadata and chronology checks, aggregate declared-byte limits, aggregate-only
immutable success, and a fresh generic public error on every failure. The
package has no production dependencies or composition into a fetcher, parser,
database, API, web app, or queue.

At the Cycle 2q exit, the largest remaining threat was payload substitution or
absence. Cycle 2q validates declared digest syntax and uniqueness but never
opens the referenced file; an attacker or accidental local edit could leave
valid metadata alongside missing or different bytes. Cycle 2r closes a bounded
source-capability form of that threat without changing Cycle 2q's historical
manifest-only claim.

Rights-authority/data-steward/key-authority approval, end-user identity,
tenancy, multi-user privacy operations, B15/V15, production KMS/queues/load/
SLOs, incident response, and production authorization are Out of scope for the
declared personal profile. They are not claimed as Pass. They become applicable
before any shared, customer-facing, commercial, redistributed-payload, or
production use. External law and source terms remain outside this internal
scope decision.

The exact source has a 13-path transition and a 14-path protected surface. It
routes before inherited Cycle 2p/2o evidence, creates no evidence version or
artifact, and preserves historical Cycle 2p blob
`e456cae97cf9eb377e3b3e8aabc156fdb377e2c7` plus Cycle 2o version 5 at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`. Exact gates are in
[ADR 0044](./adr/0044-personal-single-user-local-filing-corpus-manifest-verification.md)
and the [Cycle 2q exit matrix](./CYCLE_2Q_EXIT_MATRIX.md).

Cycle 2r is Pass only for exact source revision
`e15ddd8aa923a43fdca730e233abfbe684101e78`, the direct child of promoted
Cycle 2q documentation baseline
`436f7fed6af9efaec21a26e5709b90073610384e`. It adds the disconnected
`verifyPersonalFilingCorpusPayloadIdentity` operation to the isolated personal
package. No API, web, database, queue, fetcher, parser, or owner corpus invokes
it in this promotion.

The new assets at risk are local-root/path identity, the manifest-to-payload
binding, bounded streaming behavior, aggregate-result confidentiality, and
honest platform assurance. Primary threats are hostile declaration/manifest
carriers, manifest substitution, accession path escape, root aliasing, links
or junctions, unexpected directory entries, file substitution between path
checks and descriptor use, truncation or extension while reading, oversized
reads, digest mismatch, mutation during verification, partial-result leakage,
and overclaiming Windows link/race guarantees.

Controls are owned document snapshots followed by full Cycle 2q
reverification; the fixed direct-root `<accession>.payload` mapping; canonical
direct-child containment; exact 1–100-name inventories before and after reads;
Node-visible root-chain link/junction rejection; regular, single-link,
same-device bigint identity checks; one descriptor per file; one reusable
65,536-byte buffer with positional reads; declared-length early-EOF and
extra-byte probes; incremental SHA-256; pre/open/post root, path, and descriptor
observations; atomic value-free failure; and an aggregate-only immutable
result.

The residual filesystem race is explicit. On supported non-Windows runtimes
where Node exposes `O_NOFOLLOW`, success reports
`kernel_final_component_nofollow_plus_observed_snapshots`. On Windows it
reports `observed_snapshots_only`. Windows success rejects Node-visible
symlinks/junctions and observed multi-link files, but does not claim kernel
final-component no-follow, rejection of every reparse/cloud-placeholder/
filter-driver behavior, adversarial namespace ABA elimination, race freedom,
or absence of transient out-of-root reads against an active same-machine
attacker. It also does not attest kernel device ownership, ACLs, storage,
hard-link history, future links, or post-return immutability.

Success means the bytes read during that invocation had the declared length
and SHA-256 and the observed identities matched. The exact claim is
`bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use`;
the status is `payload_identity_verified_for_personal_use`. No path,
accession, per-file digest, or payload content crosses the result boundary.
Generated temporary fixtures prove verifier behavior only: this promotion
adds no owner-selected corpus, payload-root configuration, filing payload, or
successful owner-corpus invocation, so no specific corpus is yet verified.

The exact ten-path transition has 20 NUL fields, 693 bytes, digest
`sha256:46e497134b8cae95acc6211503a636b559064fdcf0dc95924d793f2d5dbaf4fb`,
and a 16-path protected surface. Both offline boundaries accept the committed
source. The route emits no artifact and preserves Cycle 2q/2p and Cycle 2o
version 5 history. Exact gates are in
[ADR 0045](./adr/0045-personal-local-filing-payload-identity-verification.md)
and the [Cycle 2r exit matrix](./CYCLE_2R_EXIT_MATRIX.md).

Cycle 2s is Pass only for exact source revision
`78b3880632ff7e54ac493e9c208ee1d93a275aa1`, the direct child of promoted
Cycle 2r documentation baseline
`a13b51d2cd6862029aa598829e40209ce178c7be`. It adds disconnected custody and
owner-deletion operations to the same zero-production-dependency personal
package. No API, web, database, queue, fetcher, parser, or owner corpus invokes
them in this promotion.

The new assets at risk are separation and identity of the payload/audit roots;
manifest, payload-identity, location, and custody-chain binding; audit-record
integrity and inventory; intent-before-unlink ordering; terminal-receipt
truthfulness; bounded retry behavior; and public error confidentiality.
Primary threats are root aliasing, nesting, replacement, links, unexpected
payload or audit entries, canonical-record tamper, stale custody/intent chains,
wrong confirmation or expected digest, file replacement before unlink,
partial deletion falsely minting a receipt, clock rollback, failed pending
publication, unsafe pending promotion, and leakage through result or error
details.

Custody controls are full owned-document reverification; internal Cycle 2r
identity over the current exact set; canonical distinct non-root/nonnested root
observations with bigint identity; an unkeyed domain-separated SHA-256 over
canonical paths plus those identities; fixed bounded audit names and canonical
aggregate schemas; exclusive
pending-file creation, synchronization, destination-absence observation,
same-directory rename, and reread; and an exact binding from the manifest to
the runtime payload-identity result. Retention days produce a target timestamp
only. They do not impose a minimum hold, scheduler, automatic deadline, or
legal-hold execution.

Deletion controls require the fixed confirmation and expected custody digest;
publish append-only intent before any unlink; derive every target from the
manifest's direct-child mapping; prohibit recursive removal and root deletion;
rehash and observe each present path/descriptor immediately before unlink; and
withhold the receipt until every selected name is absent and the exact live
root is empty. The empty payload directory plus custody, intent, and terminal
receipt audit files remain.

Pending-state promotion is intentionally narrow and record-specific. Custody
pending requires canonical bytes plus the current manifest, location, and exact
live-payload identity. Intent pending requires the canonical
custody/location/intent chain; after promotion, deletion rejects extras,
rehashes each present selected payload before unlink, and permits missing
selected names under that persisted intent. Receipt pending requires the
canonical custody/intent/receipt chain and an observed-empty live root.
Arbitrary, partial, binding-mismatched, directory, hard-link, or symbolic-link
candidates remain untouched and fail closed. This is bounded retry, not
transactional rollback, crash/power-loss recovery, cross-process coordination,
or exactly-once deletion.

The exact custody and deletion claims are
`bounded_separate_local_payload_and_audit_custody_recorded_for_personal_single_user_local_use`
and
`bounded_owner_triggered_selected_live_payload_paths_observed_absent_for_personal_single_user_local_use`.
The deletion assurance is
`observed_pre_unlink_identity_and_post_unlink_path_absence`. No root path,
accession, per-file digest, or payload bytes cross the aggregate result
boundary.

Residuals are explicit. Selected-live-root absence does not cover backup,
cloud, replica, snapshot, cache, temp, log, swap, recycle bin, filesystem
history, third party, process memory, forensic recovery, or physical media and
is not cryptographic erasure. The operation does not prevent future recreation
or resurrection. It does not prove automated retention, atomicity, active
attacker race safety, every Windows reparse behavior, filesystem/ACL/storage
attestation, signed/tamper-proof audit, caller identity/authority, application
composition, or any specific owner corpus. SEC authenticity/provenance,
MIME/archive/malware safety, parser correctness, and fact quality remain
unproven. The location digest is not a plaintext root field, but its secrecy,
unlinkability, and resistance to offline path/root-identity guessing are not
claimed.

The exact 11-path transition has 22 NUL fields, 778 bytes, digest
`sha256:f8feb8c71409711439761778e738872c3ff91974ce1a2a047dbf410f276805e6`,
and a 19-path protected surface. Both offline boundaries accept the committed
source. The route emits no Cycle 2s cross-engine/CI evidence artifact and
preserves Cycle 2r/2q/2p plus Cycle 2o version 5 history. Exact gates are in
[ADR 0046](./adr/0046-personal-local-filing-payload-custody-and-owner-deletion.md)
and the [Cycle 2s exit matrix](./CYCLE_2S_EXIT_MATRIX.md).

Cycle 2t's entire repository-visible statement is **owner-approved private
operation Pass for one owner-selected corpus**. The selection and every private
input and output remain outside Git and logs. This coarse statement is neither
an independently reviewed artifact nor proof of source authenticity, parsing,
fact truth, or quality.

Cycle 2u is Pass only for exact source revision
`4df5549087660b5b5d473c478b03b17576fd4784`, the direct child of promoted
Cycle 2s documentation baseline
`39f0ce974f84e278ec9d12193b284876c928110e`. It adds no filesystem, network,
process, database, API, web, queue, or fetch boundary. It accepts only bounded
declaration, manifest, normalization-plan, and parser-result byte snapshots
and returns a normalized record or a value-free quarantine.

The assets at risk are exact corpus/plan/source binding; confidentiality of the
private plan and fact material; completeness and ordering of the fixed ten-key
set; decimal, unit, period, and empty-dimension semantics; free-cash-flow
operand integrity; root/amendment role and lineage integrity; deterministic
fact identity; truthful manifest-scoped open ends; immutability; and atomic
failure confidentiality.

Primary threats are caller mutation or accessor side effects during validation;
oversize or noncanonical JSON; plan substitution; parser-version or taxonomy
substitution; source-document replay under another manifest entry; metadata or
content-binding mismatch; missing, duplicate, reordered, or extra facts;
dimension or context smuggling; noncanonical decimal or implicit unit
conversion; forged free-cash-flow operands or arithmetic; amendment-only or
unlinked-pair lineage; false global-currentness inference; partial results on
failure; and leakage through error detail.

Controls are intrinsic bounded byte ownership before parse or hash; canonical
JSON and closed keys; reuse of Cycle 2q declaration/manifest verification;
exact corpus, plan, manifest-entry, parser, taxonomy, source, and content
bindings; exactly one root 10-K or one manifest-linked root/amendment pair;
exactly ten ordered fact keys per document; fixed unit and instant/duration
contracts with empty dimensions; unique direct source QNames; rejection of a
free-cash-flow subtrahend that collides with a direct mapping; only the
deliberate reuse of the mapped `operating_cash_flow` as the free-cash-flow
minuend; bounded canonical decimal strings without binary floating point; and
no implicit unit conversion.

Free cash flow is accepted only as the fixed
`operating_cash_flow_minus_capital_expenditures` subtraction. Both private-plan
mapped operands must share the fact's duration and USD unit, and the result is
recomputed exactly. This prevents an unexplained direct free-cash-flow value
from entering the bounded record but does not establish accounting truth.

Root-only mode creates ten versions, zero edges, and null predecessor/successor
links. Its open end is explicitly
`no_later_version_within_exact_frozen_manifest_only`. Optional linked-pair mode
creates twenty versions and ten key-matched edges with half-open known windows.
These are manifest-scoped source events; the normalizer neither discovers
external amendments nor declares a globally current fact.

Every success graph is frozen and exact replay is deterministic. Every failure
returns one frozen aggregate quarantine code with zero fact versions and zero
lineage. No partial source value, mapping, identifier, digest, or timestamp
crosses the failure boundary, and the operation performs no silent repair.

Residuals remain explicit. Cycle 2u does not establish raw payload identity at
normalization time; raw XBRL/iXBRL parsing, extraction, or taxonomy mapping;
SEC authenticity or complete provenance; accounting/fact truth; taxonomy
authority or general coverage; amendment discovery or global currentness;
independent parser/validator agreement; conflict adjudication; owner-reviewed
precision/recall or other quality thresholds; or running-app and production
composition. The private Cycle 2u operation is recorded only as
**owner-approved private operation Pass for one owner-selected corpus**; no
selected-corpus characteristic or private run data is repository evidence.
Exact gates are in
[ADR 0047](./adr/0047-bounded-personal-ten-fact-normalization-and-root-lineage.md)
and the [Cycle 2u exit matrix](./CYCLE_2U_EXIT_MATRIX.md).

## Gates before adding new trust boundaries

1. **Authentication or customer tenant data:** building on b1's bounded real-PostgreSQL run and the live-verified container-local b2/b3 service-account boundaries, prove end-user identity/role mapping, BOLA isolation, pooled context cleanup, external TLS, production secret handling, retention, export/delete, DSAR, backup deletion, and restore before adding verified OIDC/JWT identity. A database service login or synthetic context is never accepted as end-user authentication evidence.
2. **Personal filing ingestion:** retain Cycle 2a's one-shot isolation controls.
   Cycle 2t now records **owner-approved private operation Pass for one
   owner-selected corpus**, and Cycle 2u adds bounded exact-plan ten-fact
   normalization plus manifest-scoped
   root/amendment lineage. Next require Cycle 2v independent parser/validator
   comparison with atomic conflict quarantine and no silent repair, followed by
   owner-reviewed parser quality and provenance evidence.
   Cycle 2c's generated synthetic lifecycle, Cycle 2d's closed synthetic
   normalization/lineage contract, Cycle 2e's same-process declared-role
   comparison, Cycle 2f's declared-reference metric accounting, and Cycle 2g's
   in-process candidate precommitment, plus Cycle 2h's byte-carrier hardening,
   Cycle 2i's promoted authenticated synthetic parser-result-to-normalizer
   handoff, and Cycle 2j's promoted bounded synthetic execution are
   engineering preparation only and do not satisfy any real-corpus prerequisite.
   Superseded Cycle 2k, promoted Cycle 2l and Cycle 2m lifecycle agreements,
   promoted Cycle 2n quality composition, promoted Cycle 2o archive-custody
   composition, and promoted Cycle 2p admission-validity correction remain
   engineering preparation. Cycle 2q closes the personal declaration and
   manifest boundary, Cycle 2r adds payload identity, Cycle 2s adds custody and
   selected-live-root deletion, Cycle 2t records coarse private activation,
   and Cycle 2u adds bounded personal normalization/lineage. None proves the
   pending independent comparison or owner-reviewed quality boundary.
   Organizational rights/steward approval and authority keys are separate
   enterprise-profile gates, not personal-profile prerequisites.
3. **External URLs or files:** add SSRF allowlists, DNS/IP revalidation, MIME and size checks, sandboxed parsing, malware scanning, and stored-XSS sanitization.
4. **Licensed vendor data:** require executed field/channel/purpose/retention/derived-use/AI rights, executable policy versions, deletion tests, and unit economics before connection.
5. **Alerts:** use at-least-once processing, deterministic dedupe keys, idempotent internal state, provider receipts, duplicate SLOs, and correction notices.
6. **AI:** keep it outside deterministic calculations; require a rights-safe evidence ledger, prompt-injection isolation, numeric-claim evaluation, cost limits, and unsupported-claim fail-closed behavior.

These are blockers when their corresponding trust boundary is introduced.
Enterprise-only items are not blockers for the current
`personal_single_user_local` profile.
