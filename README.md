# Research Cockpit

An evidence-first investment research workspace being built from the audited product plan. `Research Cockpit` is an internal working name and is not trademark-cleared.

## Active profile

The active filing-corpus path is `personal_single_user_local`: one owner,
local-only offline research, no customers or tenants, no commercial use, no
payload redistribution, and no production service. Organizational
rights-authority/data-steward approvals, multi-user controls, B15/V15, and
production-readiness gates are therefore **Out of scope for this profile**,
not Pass and not current Blockers. Historical enterprise Cycle 2b/2p work is
preserved and becomes applicable only if that scope widens.

## Current slice

Sprint 0 is a zero-infrastructure demo that proves:

- a synthetic company dossier with “as known on” fact supersession and
  separately named public-knowledge/database-recorded intervals (the current
  demo still uses one cutoff for both axes);
- server-side rights filtering and explicit omissions;
- an evidence passport for every displayed number;
- deterministic valuation scenarios;
- browser-local, non-sensitive thesis and alert state; and
- an original responsive interface with semantic chart alternatives.

It uses **only deterministic synthetic data**. It does not call market-data providers, SEC, Investing.com, news sites, LLMs, brokers, payment services, or external notification providers.

Cycle 1a also includes a disconnected synthetic tenant/authorization module and
a statically checked PostgreSQL migration contract. They are development proof
artifacts only: at that cycle's exit the running API remained GET-only, browser
state remained local, and no database or identity provider was connected.

Cycle 1c source now composes only two seeded in-memory update operations:
`PUT /v1/theses/{thesisId}` and `PUT /v1/alerts/{alertId}`. They require a
public, non-secret synthetic persona selector, a strong `If-Match`, and an
operation-scoped `Idempotency-Key`, and they accept only an exact loopback
peer. Browser thesis/alert state remains local; no PostgreSQL adapter or
identity provider is connected. **Implemented and verified only for the bounded
synthetic loopback source/test contract; not remote/live-engine or production
evidence.** The full frozen-byte local release gate and two-OS CI run
`32401541724` passed on exact commit
`84f6b92163e93fa8c5c079a786e49f8134b81f56`. The separate PostgreSQL run
`32401541467` is unchanged V14 regression health only; it is not Cycle 1c
engine evidence, B15/V15, or a replacement for the canonical B14 result at
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`. Production admission remains
blocked. See
[ADR 0027](./docs/adr/0027-loopback-synthetic-persona-research-state-api.md)
and the [Cycle 1c exit matrix](./docs/CYCLE_1C_EXIT_MATRIX.md).

Cycle 2a is a reviewed bounded stage: a disconnected, one-shot synthetic
ZIP/XML filing parser in a new locked-down Linux container per nonempty
host-size-eligible worker call. It adds no
upload route, external fetch, application/database composition, or real filing
data. Its separate filing-parser evidence v1 passed the exact dedicated Linux
run and independent commit-bound offline review on commit
`73e391e339bf42332d7082adaba00807facc233c`; retained artifact `9429394295`
binds all 103 synthetic cases, 26 source hashes, 16 checks, and 16 nonclaims.
The exact frozen-byte local `pnpm verify` gate passes format, lint, every
guardrail, seven-project typechecking, all builds, and 32 test files with 792
tests. This is not B15/V15 and does not complete the wider Cycle 2 corpus,
rights, ten-fact, dual-validation, quality, or lineage gates. See
[ADR 0028](./docs/adr/0028-bounded-synthetic-filing-parser-isolation.md) and
the [Cycle 2a exit matrix](./docs/CYCLE_2A_EXIT_MATRIX.md), with retained proof
recorded in the
[Cycle 2a evidence note](./docs/FILING_PARSER_ISOLATION_EVIDENCE.md).

Those exact live and review anchors remain historical green facts, but the
bounded owned-byte security conclusion is Superseded by the Cycle 2h
hostile-carrier finding on those bytes. Cycle 2h restores the bounded owned-byte
premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, whose local, CI, parser, and custody
gates passed.

Cycle 2b Phase A now implements only the side-effect-free
`verifyFilingCorpusAdmission` protocol for a future fixed, content-addressed
public-filing candidate manifest. **Local and CI verification pass; Cycle 2b
remains Blocked.** No real configuration, external metadata, rights or steward
approval, Cycle 2b workflow, run, evidence schema, artifact, raw filing, fetch,
parser execution, or application/database composition has been added. The target
claim
`fixed_rights_and_steward_approved_content_addressed_100_filing_corpus_admission`
cannot be accepted until an exact external inventory of 100 filings,
distinct rights/steward signatures, and human key-authority review exist and
the later local/live/offline gates pass. This is not B15/V15 and does not close
the wider Cycle 2 quality or production gates. See
[ADR 0029](./docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md)
and the [Cycle 2b exit matrix](./docs/CYCLE_2B_EXIT_MATRIX.md).

The exact Phase-A local/CI jobs remain historical green facts, but their
bounded owned-byte security conclusion is Superseded by the Cycle 2h
hostile-carrier finding on those bytes. Cycle 2h restores the bounded owned-byte
premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`; Cycle 2b remains Blocked on the
same external inputs.

The exact frozen-byte local `pnpm verify` gate passes format, lint, every
guardrail including all 86 production-license checks, all project typechecks,
all builds, and 34 test files with 810 tests: DB 18/582, API 4/49,
research-state 1/48, contracts 1/5, research-core 2/62, web 2/3, and
filing-parser 6/61. [CI run 32447542432](https://github.com/liangzixuan/investing-pro/actions/runs/32447542432)
passed the same gate on Ubuntu and Windows for exact commit
`b9a9edf680b4c3a7373cd6d96210a24544ba0bbe`. Concurrent
[parser run 32447542455](https://github.com/liangzixuan/investing-pro/actions/runs/32447542455)
and artifact `9434590292` are unchanged Cycle 2a regression health only, not a
Cycle 2b workflow, evidence record, or replacement for the canonical Cycle 2a
result.

Even a future `status: "admitted"` would prove only internal schema and
signature consistency under the supplied authority/revocation registry. A
human/host must compare its exact digest with the reviewed out-of-band anchor;
the result is not itself an authority, counsel, or steward identity decision.
The verifier can compare signed timestamps and hashes, but absence of earlier
parser or adjudication results remains externally attested chronology.

Cycle 2c adds a separate, zero-dependency filing-payload custody
protocol for exactly one generated 4,096-byte synthetic fixture. It snapshots
and recomputes the fixed content hash, requests a fresh AES-256-GCM key and
nonce from an injected entropy provider, keeps key and payload/audit domains
separate, enforces a trusted-clock 24-hour boundary, and ends only in
`logical_key_unavailability`. The injected provider is an out-of-band trusted
CSPRNG TCB; source validates only the returned byte shape and exact requested
length, not randomness or uniqueness. The dedicated Linux record is
limited to observed Node `crypto.randomBytes` use and distinct DEK-fingerprint
and nonce-hash samples in that run; it cannot establish OS entropy quality.
**The bounded synthetic claim was historically accepted on exact commit
`ef22c7bc10596840b8ff686b9190730956fab0c4`; its bounded owned-byte security
conclusion is now Superseded.** The final successor-compatible
local `pnpm verify` gate passed format, lint, every guardrail including 86
production-license checks, all project typechecks and builds, and 39 test
files with 848 passed tests plus 2 POSIX-only Windows skips (850 total cases).
Two-OS CI run `32463955370`, dedicated Linux custody run `32463955421`,
exact-commit offline review, and independent retained artifact/log review also
passed on `ef22c7bc10596840b8ff686b9190730956fab0c4`. The later local
compatibility result does not replace or widen that canonical live evidence.
It adds no real filing bytes, external configuration, network/fetch path,
parser, corpus admission, database, API, web, queue, production KMS, or
cryptographic-erasure claim. Cycle 2b and production admission remain Blocked;
this is not B15/V15. See
[ADR 0030](./docs/adr/0030-bounded-synthetic-filing-payload-custody.md) and the
[Cycle 2c exit matrix](./docs/CYCLE_2C_EXIT_MATRIX.md), with exact remote and
custody anchors in the
[Cycle 2c evidence note](./docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md).

Those canonical live and review anchors remain historical green facts, but the
bounded owned-byte security conclusion is Superseded by the Cycle 2h
hostile-carrier finding. Canonical evidence bytes remain unchanged. The Cycle
2h gates passed only for exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, restoring the bounded owned-byte
premise only on those bytes.

Cycle 2d adds a separate, zero-dependency synthetic fact-normalization
protocol. The caller supplies exactly two bounded canonical JSON byte
documents matching the closed synthetic 10-K/10-K/A schema, and the boundary
immediately takes fresh owned snapshots before validation. Tests generate the
canonical pair, but the boundary does not authenticate its generator or
provenance. It requires the frozen ten launch-fact keys exactly once per
document, strict decimal/unit/period/dimension metadata, one acyclic predecessor, and half-open
pre/post-amendment known windows. The complete pair either normalizes
atomically or produces only an empty, value-free quarantine result. **Local
verification is Pass on the exact frozen bytes: format, lint, guardrails, all
project typechecks and builds, 86 production-license checks, and 41 test files
with 876 passed plus 2 POSIX-only Windows skips (878 total cases: parser 65;
custody 36 passed plus 2 skipped; normalization 26; DB 582; API 49; state 48;
contracts 5; core 62; web 3). The bounded source-stage claim, local gate, and
two-OS CI historically passed for exact source commit
`f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`; CI run `32511008752` passed in
Windows job `96861883906` and Ubuntu job `96861884146`.** Parser run/job
`32511008497` / `96861883641`, custody run/job `32511008447` / `96861883543`,
and PostgreSQL run/job `32511008417` / `96861882949` are unchanged regression
health on that commit, not Cycle 2d evidence. Cycle 2d creates no dedicated
workflow, evidence schema, artifact, offline evidence review, or evidence note;
it has no real filing bytes, parser execution, corpus approval, custody,
database, API, web, or queue composition. Cycle 2b and production admission
remain Blocked, and this is not B15/V15. See
[ADR 0031](./docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md)
and the [Cycle 2d exit matrix](./docs/CYCLE_2D_EXIT_MATRIX.md).

The exact Cycle 2d local/CI jobs remain historical green facts, but their
bounded owned-byte security conclusion is Superseded by the Cycle 2h
hostile-carrier finding on those bytes. Cycle 2h restores the bounded owned-byte
premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.

Cycle 2e adds a separate, zero-dependency synthetic fact-comparison protocol.
Exactly two bounded canonical envelopes occupy fixed declared-validator A/B
roles. Two separate strict modules validate their complete same-schema
ten-fact/twenty-version/ten-edge payloads before the boundary compares the full
canonical payload bytes. Agreement returns only an immutable metadata receipt;
any invalid input or byte conflict returns empty, value-free aggregate
quarantine with no preferred report, merge, coercion, or silent repair.
**Source implementation is complete. Local verification is Pass on the exact
frozen bytes: `corepack pnpm verify` passed all format, lint, guardrail,
typecheck, test, and build stages with 43 test files, 911 passed plus 2 skipped
(913 total), all 11 workspace project checks, and 10 builds. The bounded
source-stage claim, local gate, and two-OS CI historically passed for exact source
commit `60b92aa527435904776144f5e2d5a1a3ab61e67e`; CI run `32518970387`
passed in Ubuntu job `96886795980` and Windows job `96886796247`. Parser
run/job `32518970423` / `96886796118`, custody run/job `32518970453` /
`96886796256`, and PostgreSQL run/job `32518970454` / `96886796382` are
unchanged regression health only, not Cycle 2e evidence.** Distinct fixed
roles, identifiers, versions, and implementation
digests are declarations only. They do not establish validator/parser/code,
process, host, operator, key, or failure-domain independence or authenticity.
Cycle 2e creates no dedicated workflow, evidence schema, artifact, offline
review, or evidence note; it admits no real data, leaves Cycle 2b and production
Blocked, and is not B15/V15. See
[ADR 0032](./docs/adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md)
and the [Cycle 2e exit matrix](./docs/CYCLE_2E_EXIT_MATRIX.md).

The exact Cycle 2e local/CI jobs remain historical green facts, but their
bounded owned-byte security conclusion is Superseded by the Cycle 2h
hostile-carrier finding on those bytes. Cycle 2h restores the bounded owned-byte
premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.

Cycle 2f adds a separate, zero-dependency synthetic quality-measurement
protocol. Exactly three bounded canonical documents occupy fixed plan,
candidate, and declared-reference roles. The declared reference fixes 100
unique documents with the ten launch facts each; the evaluator derives two
critical assertions per target and accounts for all 2,000 without accepting
caller metrics, weights, exclusions, or assertion results. The only explicit
candidate row statuses are `succeeded` and `quarantined`; a succeeded row may
carry zero through ten sorted unique known-coordinate facts and is measured
incomplete when facts are omitted, while absence is derived as missing.
Explicit quarantine is not silent, but it still contributes false negatives,
reduces document success, and increases quarantine rate.

The fixed synthetic-pilot policy uses document success `>=95/100`, precision
and recall `>=99/100`, quarantine rate `<=5/100`, zero silent critical
failures, exact canonical units, and zero-day period tolerance. Thresholds use
integer cross-multiplication only. Valid below-threshold input returns an
aggregate `not_met` evaluation; malformed input alone returns empty value-free
quarantine. **The prior bounded source-stage security conclusion for source
commit `72e91f502b31f15deeaad761b82d9ed7b6377d39` is Superseded. Its recorded
`corepack pnpm verify` run and CI run `32681826143` in Ubuntu job `97299715600`
and Windows job `97299715638` were green, but hostile plain `Uint8Array`
carriers could spoof bounds/shared-buffer metadata or invoke caller
`constructor` / `Symbol.species` hooks during snapshot allocation. Those green
jobs are historical gate facts, not support for the bounded owned-snapshot
claim. The hardened Cycle 2f bounded claim was restored for exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708`, where the final local gate and
Cycle 2g Ubuntu/Windows CI passed, but that restoration is now also Superseded:
prototype equality did not intrinsically brand the backing as `ArrayBuffer`, so
a re-prototyped `SharedArrayBuffer` remained admissible; carrier prototype
equality likewise admitted re-prototyped alternate typed arrays. Cycle 2h
restores the bounded owned-byte premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`, whose local, CI, parser, and custody
gates passed. Parser run/job `32681826015` / `97299715074`,
custody run/job `32681826030` / `97299715006`, and PostgreSQL run/job
`32681826040` / `97299715107` remain historical regression health only, not
Cycle 2f evidence.**
The declared reference does not establish independent adjudication, blinding,
real parser quality, or approved production thresholds. Cycle 2f creates no
dedicated workflow, evidence schema, artifact, offline review, or evidence
note; it admits no real data, leaves Cycle 2b, full Cycle 2 quality, and
production Blocked, and is not B15/V15. See
[ADR 0033](./docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md)
and the [Cycle 2f exit matrix](./docs/CYCLE_2F_EXIT_MATRIX.md).

Cycle 2g addresses the repository-controlled prediction-order gap and restores
the upstream hostile-carrier boundary without claiming real-world blinding. A
private package with one exact
workspace dependency on Cycle 2f exposes a zero-argument factory for one
synchronous in-process `commit` / `reveal` instance. Commit owns and validates
the candidate snapshot against the closed 100-document coordinate space before
any declared-reference bytes enter that instance, preserving omitted documents
and facts for fail-closed evaluation. The candidate document binds the exact
declared-reference SHA-256 commitment but contains no raw reference
bytes/content, caller `producedAt`, metrics, weights, exclusions, assertion
outcomes, or quality result.

State advances only `open` to `candidate_committed` to `consumed`. A first bad
commit, open-state reveal, second commit, or any reveal attempt consumes before
validation, so there is no retry, replacement, or reset. A successful commit
returns aggregate hashes/counts and one empty frozen identity-bound capability.
Reveal recomputes the reference byte digest, requires the committed digest,
injects only the fixed Cycle 2f compatibility role/time, and delegates the
derived candidate and reference to Cycle 2f. Evaluated output is immutable and
aggregate-only; failure is empty value-free quarantine with zero audit counts
and `measurement: null`.

The same atomic successor transition also hardens byte ownership in the public
Cycle 2f evaluator. Both boundaries read the backing buffer and byte length
through intrinsic typed-array getters, require an ordinary `ArrayBuffer`,
allocate an ordinary `Uint8Array`, and copy with the intrinsic typed-array
`set`. Caller-owned `buffer`, `byteLength`, `constructor`, or `Symbol.species`
properties therefore cannot spoof carrier admission or redirect snapshot
allocation into caller code.

**Cycle 2g's local gate and two-OS CI at exact source commit
`df1ddffdede9900302da34160ce6b9a62b9d1708` remain historical green facts, but
its bounded owned-byte security conclusion on those bytes remains Superseded.
Cycle 2h restores that premise only on exact hardened successor commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`.**
Prototype equality did not intrinsically brand the backing as `ArrayBuffer`,
did not prove the intrinsic `Uint8Array` element type, and admitted
re-prototyped shared backing and alternate typed arrays. A proxy-sensitive
prototype check also preceded complete intrinsic brand validation. The
local gate passed formatting, full ESLint, all guardrails, the
production-license check across 86 versions, every scripted
typecheck/test/build across 12 of 13 workspace projects, and the boundary
verifier. All 47 test files completed with 987 passed plus two skipped (989
total), including 39 Cycle 2f tests, 29 Cycle 2g tests, 582 database tests, 70
parser tests, and 41 passed plus two skipped custody tests. CI run `32690685837`
passed in Ubuntu job `97323672725` and Windows job `97323672813`. Parser run/job
`32690685841` / `97323672800`, custody run/job `32690685846` / `97323672628`,
and PostgreSQL run/job `32690685829` / `97323672631` passed as unchanged
regression health only; they are not Cycle 2g or Cycle 2f restoration evidence.
Cycle 2g creates no
dedicated workflow, evidence schema, artifact, offline review, or evidence note
and admits no real data. A caller may already know or infer the reference, use
another instance, restart the process, or call Cycle 2f directly. Cycle 2g
therefore does not prove actual blinding, label secrecy, external chronology,
durable precommitment, independent adjudication, real parser quality, Cycle 2b
authority, full Cycle 2 quality, B15/V15, or production use. Cycle 2f's existing
CI anchors remain historical green gate facts for source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` only; they do not attest the
current hardened Cycle 2f bytes or revive the superseded conclusion. The local
and Cycle 2g two-OS gates historically restored the hardened bounded claim at
`df1ddffdede9900302da34160ce6b9a62b9d1708`; both that restoration and the
Cycle 2g conclusion are now Superseded, while the original `72e91f5`
conclusion remains Superseded. See
[ADR 0034](./docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md)
and the [Cycle 2g exit matrix](./docs/CYCLE_2G_EXIT_MATRIX.md).

Cycle 2h closes the repeated public-byte-carrier gap across Cycle 2a through
Cycle 2g. The affected roles are the parser archive, injected signer signature
output, and create/start/remove/residue process-runner stdout/stderr; seven Cycle 2b
admission documents; the Cycle 2c staging payload, five semantic entropy
results, and key-store reads/writes; both Cycle
2d documents; both Cycle 2e validator reports; the Cycle 2f plan, candidate,
and declared reference; and the Cycle 2g plan, candidate observation, and
declared reference. Each path now calls intrinsic typed-array backing-buffer,
byte-length, and `%TypedArray%.prototype[Symbol.toStringTag]` getters before
proxy-sensitive prototype checks, requires intrinsic element type `Uint8Array`
plus exact `Uint8Array.prototype`, brand-checks actual `ArrayBuffer` internal
slots plus exact `ArrayBuffer.prototype`, and checks the
actual role limit before snapshot allocation—including exact 64-byte
signatures and per-request process stream limits—then
allocates an ordinary `Uint8Array` and copies with intrinsic `set.call`.
Caller-owned `buffer`, `byteLength`, iterator, constructor, species, accessor,
or instance-method hooks do not supply metadata or receive allocation/copy
dispatch. Cycle 2a hashes an exact oversized carrier synchronously without an
owned archive copy and preserves its signed `archive_limit_exceeded`
quarantine. Existing coarse failures and value-free results remain unchanged.

**Cycle 2h is Pass only for exact source commit
`61701307ded7fa77a555e27925ae86670f6b4dc0`. Its frozen-byte local gate, existing
Ubuntu/Windows CI, parser live acceptance, and custody live acceptance all
passed. The prior Cycle 2a through Cycle 2g bounded owned-byte conclusions on
their original source bytes remain Superseded; their bounded owned-byte
premises are restored only on this exact hardened successor.** Cycle 2f's original
`72e91f5` conclusion remains Superseded; its restored claim and Cycle 2g's claim
at `df1ddff` are now also Superseded because prototype equality did not
intrinsically brand the backing as `ArrayBuffer` or the element type as
`Uint8Array`, and Cycle 2g did not complete intrinsic brand validation before a
proxy-sensitive prototype check.

Cycle 2h is exactly 40 paths (38 modified and two added) from baseline
`14f76bbd29fb51c37d7ba0c8c8d6c9b06cedac98`, leaving 82 cumulative unique
Cycle 2c paths because the eight additional Cycle 2f/Cycle 2g hardening paths
already exist in cumulative history. The existing historical custody fixture
manifest is the additional transition path and adds no new union path; it
refreshes only the two changed custody source/test SHA-256 entries, while
fixture cases, schema, order, and payload identity/content remain unchanged.
The exact historical Cycle 2g transition remains 32 paths and 73 cumulative
unique paths. One intervening pinned database-test maintenance path raises the
pre-Cycle 2h cumulative history to 74 and is history, not evidence. Cycle 2h
adds no package, dependency, workflow, new evidence schema,
new/dedicated/live evidence artifact, evidence note, or application
composition. The refreshed existing local manifest is a fixture-integrity
anchor, not new live evidence.

Baseline CI `32695006904` and PostgreSQL `32695006890` are historical health
only. Baseline parser `32695006897` and custody `32695006869` passed source/test
stages but failed at `commit_boundary` on that already-pinned unrelated
database path, so no runtime acceptance occurred. Cycle 2h does not establish
primordial hardening, process isolation, source authenticity, Cycle 2b
authority, independent parsing/adjudication, real quality, durable
precommitment, network safety, production custody/KMS, composition, full Cycle
2 exit, real-data admission, or production readiness. See
[ADR 0035](./docs/adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md)
and the [Cycle 2h exit matrix](./docs/CYCLE_2H_EXIT_MATRIX.md).

For exact source commit `61701307ded7fa77a555e27925ae86670f6b4dc0`, CI run
`32757171049` passed in Ubuntu job `97527284364` and Windows job `97527284624`.
Parser run/job/artifact `32757171096` / `97527284903` / `9531335028` and custody
run/job/artifact `32757171127` / `97527284597` / `9531290999` passed runtime
acceptance and exact-commit review on attempt 1. Parser and custody remain
regression and historical-boundary anchors, not a new Cycle 2h evidence domain.

Cycle 2i defines the next bounded source-stage interface in the private
`@research-cockpit/filing-parser-normalization-handoff` package. It accepts
exactly two raw synthetic archives and two canonical Ed25519-signed complete
ten-fact parser-result envelopes in distinct original/amendment roles. It owns
and bounds the archive, envelope, and supplied public-key bytes; verifies
canonical envelope syntax, domain-separated signatures, supplied key/image
expectations, and recomputed raw-archive SHA-256 bindings; and rejects any
missing, duplicate, defaulted, inferred, repaired, or silently remapped fact.
It does not translate or widen Cycle 2a's historical two-fact v1 result; that
shape fails the complete ten-fact contract.

Cycle 2i canonicalizes the embedded documents while parsing the closed signed
envelopes. After carrier, envelope, signature, key/image, and raw-archive
binding checks pass, it delegates those exact original/amendment bytes
unchanged to the public `normalizeSyntheticFilingFactPair` function. Cycle 2d
validates the closed roles, facts, metadata, and pair during delegation; only a
downstream `normalized` result succeeds. Success exposes only the immutable
normalized record plus aggregate handoff provenance.
Any invalid input or provenance, partial fact set, substitution, mutation,
dependency failure, or downstream Cycle 2d quarantine collapses to the same
empty value-free handoff quarantine.

The sole bounded target is
`bounded_synthetic_authenticated_ten_fact_parser_result_to_normalization_handoff`.
Implementation and promotion are Pass only for exact source commit
`5a1589ede57e00d6ff60521e7b53bea2ac849b0a`, whose transition from exact
baseline `dda2ecafc70aa6c4859a29cb312849bac5dec253` is exactly 21 paths: 9 added
and 12 modified. The frozen-byte local release gate passed all formatting,
lint, guardrail, dependency, typecheck, test, and build stages with 49 test
files, 1,064 passed tests, and 3 intentional skips (1,067 total cases). CI run
`32817294734` passed in Ubuntu job `97708048290` and Windows job
`97708048027` on those exact source bytes.

Cycle 2i creates no dedicated workflow, evidence schema, evidence artifact,
offline review, or evidence note. Historical Cycle 2a and Cycle 2d evidence is
immutable. Parser run/job `32817294720` / `97708047987`, custody run/job
`32817294732` / `97708048009`, and PostgreSQL run/job `32817294741` /
`97708049006` passed as regression health only. The handoff does not prove
actual parser execution or correctness, signed-document derivation from archive content
beyond digest binding, key or image authority, real filing authenticity, Cycle
2b authority, independent validation, adjudicated quality, application
composition, full Cycle 2 exit, B15/V15, real-data admission, or production.
See
[ADR 0036](./docs/adr/0036-bounded-synthetic-authenticated-parser-normalization-handoff.md)
and the [Cycle 2i exit matrix](./docs/CYCLE_2I_EXIT_MATRIX.md).

Cycle 2j now promotes one bounded repository-controlled execution milestone.
From exact baseline `f17bacc6adc46851e182d260d59830652f1953bb`, one closed
synthetic original archive and one amendment archive execute in fresh bounded,
network-disabled Python 3.12 workers; the host creates complete signed ten-fact
envelopes and delegates the exact archive/envelope pair to the unchanged Cycle
2i handoff. Its sole claim is
`bounded_synthetic_one_shot_ten_fact_parser_execution_to_authenticated_normalization_handoff`.
It is Pass only for exact source commit
`b2c7a28c2c5720253eba275b65d3313b114c3bc4`: the exact 44-path transition,
1,095-pass local gate, Ubuntu/Windows CI run `32897837955`, exact-source parser,
custody, and PostgreSQL regressions, dedicated run/job `32897837981` /
`97964475815`, retained artifact `9581921300`, and 51-of-51
`offline_consistent` review all passed. This milestone cannot prove general
parser or accounting correctness, independent validation, signer/image/source
authority, real filing quality, Cycle 2b authority, B15/V15, real-data
admission, or production. See
[ADR 0037](./docs/adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md)
and the [Cycle 2j exit matrix](./docs/CYCLE_2J_EXIT_MATRIX.md).

Cycle 2k's exact source, workflow, artifact, and offline-review anchors remain
immutable historical execution facts. Its bounded security conclusion and sole
claim
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`
are **Superseded**: cached valid child receipts for unrelated input archives
could be accepted while outward provenance named the current archives, and an
identical common-mode lineage mutation could pass both engines. Exact source
commit `54908db1ded8193ac4ade7a3d6f38505c6b4b8e5`, run/job `32917020041` /
`98022742591`, artifact `9588542275`, and its 66-of-66 `offline_consistent`
review remain historical facts, not support for the Superseded conclusion. See
[ADR 0038](./docs/adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md)
and the [Cycle 2k exit matrix](./docs/CYCLE_2K_EXIT_MATRIX.md).

Cycle 2l is **Pass only for exact source commit
`2e3a7e33a76d19b993375958aff671707a81ef05`**, the exact single-parent
corrective child of failed precursor
`67af24176df3c17fd6d54498095888c9a43ebe1f` from baseline
`b9b7dd19996f0c5bb1e073ab5522c42e06dee397`. Its target claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_with_exact_archive_bound_child_receipts_and_reciprocal_ten_fact_lineage_agreement`.
The hardened boundary binds each child receipt and every normalized fact to the
current invocation's exact archive and document role, recomputes pair and
execution bindings, freezes the original/amendment 20-fact partition, and
validates ten reciprocal lineage edges, strict chronology, canonical decimals,
one common period end and duration-fact start across both roles, accession-year and
issuer-segment consistency, and changed-plus-unchanged amendment coverage
before agreement. The exact baseline-to-source transition contains two commits,
two first-parent commits, and 23 paths; the corrective commit contains 14 paths.
Full local `pnpm verify` passed, including 51 acceptance tests. Exact-source CI
run `33013464811` passed Ubuntu job `98325467206` and Windows job
`98325467249`. Dedicated run/job `33013464847` / `98325467722` retained
artifact `9623531283`, named
`filing-parser-cross-engine-execution-evidence-v2-2e3a7e33a76d19b993375958aff671707a81ef05-1`,
size 7,581 bytes. Its ZIP digest is
`sha256:bfd3eb2fabdba8b533cbbcd488fe9decd19f47cd4d73c408ac824a87717aaed8`;
the canonical evidence digest is
`sha256:c1d4d7c6c77bd5aa0a9a0af5de08fbbf3b823744b9cba47e3a59283dfd41f6d8`.
The record binds 66 source hashes, the 23-path transition, 16 ordered checks,
16 ordered nonclaims, and six outcomes (one agreed and five quarantined); the
independent review returned `offline_consistent` for 66 of 66 source hashes.
Dedicated precursor run/job `33011584084` / `98318943081` failed at
`evidence_validation_transition` before artifact retention. Custody run/job
`33011584059` / `98318941993` and parser-isolation run/job `33011584060` /
`98318941736` failed at `commit_boundary`; both are regression non-evidence. All
three failed runs retained zero artifacts and remain immutable non-evidence.
Injected boundary or receipt authenticity and fresh execution are nonclaims;
quality composition is deferred, and real quality, real data, Cycle 2b
authority, and production remain Blocked. See [ADR 0039](./docs/adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md)
and the [Cycle 2l exit matrix](./docs/CYCLE_2L_EXIT_MATRIX.md).

Cycle 2m is **Pass only for exact source commit
`5d61868e6075865b32640ddaceb845ac9dbc69f3`**, the exact single-parent child of
baseline `1cb7d3ce024cbd29665af7ec4e010da0c380b726`. Its sole claim is
`bounded_synthetic_source_owned_direct_docker_cross_engine_current_input_and_lineage_agreement_with_lifecycle_binding`.
The public configuration exposes only sealed engine descriptors. An internal
ephemeral Ed25519 signer and package-owned audited Docker runners perform
exactly four fresh create/start/attach/remove lifecycles per invocation, leave
zero container residue, and bind every lifecycle receipt with the Cycle 2l
agreement, normalization record, and key context into a distinct invocation
binding. Two invocations over the same inputs must normalize identically while
producing eight unique container-ID digests and distinct lifecycle and
invocation hashes. Any configuration, lifecycle, receipt, binding, agreement,
or cleanup failure must return one atomic empty value-free quarantine.

Full local verification passed, including 27 core Vitest tests, 10 worker tests,
and 50 of 50 acceptance tests. Exact-source CI run `33022797756` passed Ubuntu
job `98356972324` and Windows job `98356973090`. Dedicated run/job
`33022797708` / `98356972412` retained 8,858-byte artifact `9627207288`, named
`filing-parser-cross-engine-execution-evidence-v3-5d61868e6075865b32640ddaceb845ac9dbc69f3-1`.
Its ZIP digest is
`sha256:dfd56f1564a55f1c37fc6f0fdab33e390f5530662b96107c47602e03008ecd9b`;
the 32,961-byte canonical evidence digest is
`sha256:25dfd0dd5c36d24656de9eda85a34940a40f50e11cd02535bae1fb8f24c05c6e`.
Version 3, schema `3.0.0` evidence has status `passed` and binds 71 source
hashes, 24 transition paths, 16 ordered checks, 16 ordered nonclaims, and six
outcomes: one agreed and five quarantined. The repeated agreed case has stable
normalization, distinct lifecycle and invocation bindings, eight receipts,
eight unique container-ID digests, eight unique lifecycle-binding hashes, and
the exact Python-original, Python-amendment, Node-original, Node-amendment role
partition twice. Independent review returned `offline_consistent`.

Source-triggered parser-isolation run `33022798055` and custody run
`33022797729` failed only at their legacy commit-boundary routing and retained
zero artifacts, so they remain non-evidence. Exact five-file maintenance child
`1860bb367afdb6d725e41880ebb121dda4a04f39` restored that historical routing
without replacing or reminting the v3 evidence. Custody run/job `33024664186` /
`98363073966`, parser-isolation run/job `33024664197` / `98363074166`, and CI run
`33024664292` with Ubuntu job `98363074101` and Windows job `98363074221` all
passed. Dedicated bridge run/job `33024664259` / `98363074109` also passed and
retained zero artifacts, as required. Cycle 2l v2 and Cycle 2k v1 evidence
remain immutable history.

Docker daemon/host/kernel/container-ID authenticity, image supply-chain
attestation, semantic absence of nonce/cache behavior inside workers, external
signer identity/KMS, quality composition, real parser quality, Cycle 2b
authority, 100 real filings/2,000 assertions, B15/V15, real data, and production
remain nonclaims or Blocked. Quality composition is deferred because lifecycle
freshness must be established before metrics can consume execution output;
Cycle 2b cannot be manufactured from synthetic metadata, keys, or approvals.
See [ADR 0040](./docs/adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md)
and the [Cycle 2m exit matrix](./docs/CYCLE_2M_EXIT_MATRIX.md).

Cycle 2n is **Promoted only for exact source commit
`1d7dee56c66c1ad0f5d612603567adf2589e0930`, the direct single-parent child of
frozen baseline `09e76235b5683427f2dd3201aefa740bb5adb16e`.** Its sole claim is
`bounded_synthetic_source_owned_direct_docker_cross_engine_two_document_observation_precommitment_and_fixed_population_quality_evaluation_binding`.
The new package-owned protocol executes Cycle 2m internally, maps the ten
original facts once to `synthetic-filing-0001` and the ten amendment facts once
to `synthetic-filing-0002`, and delegates those internally derived candidate
observations to unchanged Cycle 2g and Cycle 2f boundaries. The other 98 fixed
population coordinates remain absent; no caller may inject an execution
result, candidate observation, metric, weight, exclusion, or outcome.

The required result is deliberately `evaluated/not_met`: 2 of 100 documents,
20 true positives out of 1,000 expected facts, 980 missing facts, and 1,960 of
2,000 silent critical failures. Precision and quarantine-rate gates meet their
thresholds, while document success, recall, and zero-silent-failure gates fail.
That closes only the source-execution-to-measurement composition gap; it is not
a parser-quality Pass. Full local verification passed with 1,232 passed tests
and 4 intentional skips. Exact-source CI run `33036093870`, parser-isolation run
`33036093898`, custody run `33036093896`, normalization run `33036093852`,
PostgreSQL run `33036093864`, dedicated run/job `33036093863` /
`98398989554`, and Dependabot dynamic-scan run/job `33036162143` /
`98399193694` all passed. The dedicated run retained 10,765-byte artifact
`9632073116`, named
`filing-parser-cross-engine-execution-evidence-v4-1d7dee56c66c1ad0f5d612603567adf2589e0930-1`.
Its ZIP digest is
`sha256:12c5d5aeca103d693b5c0b761eb16a5ed5af24cc55402f4a6d7c976b994a3522`;
the 38,827-byte canonical version `4` / schema `4.0.0` evidence digest is
`sha256:4fdbb860468413929968c56cf72037a0f72b65669b3ae9c46844476bddf12c5c`.
It binds 95 source hashes, the exact 34-path transition, 16 ordered checks, 16
ordered nonclaims, and six outcomes: one `evaluated_not_met` and five
`quarantined`. Runtime accounting records four composition commits, three quality
evaluations, 16 successful lifecycle receipts, four two-document observation
pairs, and zero residue. Independently anchored review returned
`offline_consistent`; versions 1 through 3 remain immutable history.
Representative real filings, independent adjudication, Cycle 2b authority,
B15/V15, real-data admission, full Cycle 2 exit, and production remain Blocked.
See
[ADR 0041](./docs/adr/0041-bounded-synthetic-source-owned-quality-composition.md)
and the [Cycle 2n exit matrix](./docs/CYCLE_2N_EXIT_MATRIX.md).

Cycle 2o is **Pass only for exact promoted revision
`472cc10b8df90bee01925b2efd4fbcb614d7590c`**, the exact corrective child of
source precursor `46408ec875755ef531c124846143e9b619c1961f` from frozen
baseline `711fe866594d5e20a657a24c0a0c72fd78ab90be`. Its sole claim is
`bounded_synthetic_source_owned_exact_pair_encrypted_custody_authenticated_readback_to_direct_docker_cross_engine_quality_evaluation_binding`.
The package-owned outer protocol encrypts the exact 2,306-byte original and
2,330-byte amendment synthetic archives as separate role-bound AES-256-GCM
records, authenticates closed audit and ciphertext readback, and passes only owned
readback snapshots into a fresh unchanged Cycle 2n protocol. Callers may not
inject a custody/execution boundary, clock, entropy source, key, nonce,
workspace path, digest, receipt, readback, result, callback, or options seam.

The quality accounting cannot improve: the required successful result remains
`evaluated/not_met`, with 2/100 documents, 20/1,000 true-positive facts, 980
missing facts, and 1,960/2,000 silent critical failures. The other 98
coordinates remain absent. All exact Cycle 2n nonclaims remain frozen;
they are the ordered prefix and six custody-specific limitations are appended.
Encrypted staging and cleanup do not establish real filing custody, durable
retention, cryptographic erasure, external authority, representative data, or
real quality.

Full local verification passed 1,295 tests with 4 intentional skips. All five
triggered workflows reached terminal green: CI run `33060480830` passed Ubuntu
job `98477727410` and Windows job `98477727517`; parser isolation run/job
`33060480816` / `98477727240`, payload custody `33060480845` / `98477727017`,
normalization execution `33060480837` / `98477728031`, and dedicated version 5
`33060480847` / `98477728062` passed. The dedicated run retained 12,449-byte
artifact `9641519947`, named
`filing-parser-cross-engine-execution-evidence-v5-472cc10b8df90bee01925b2efd4fbcb614d7590c-1`.
Its ZIP digest is
`sha256:82916aa3b53112b8cc29b0e3bc5e575213757ca70a7d623a87d0167c89ecf419`;
the 45,312-byte canonical version `5` / schema `5.0.0` evidence digest is
`sha256:1f53136f1811b19de0ba63ae1c1ec6d70cf2d5f86f578214e884069d137e5581`.
It binds 105 source hashes and the exact cumulative 39-path transition;
independently anchored review returned `offline_consistent`. Versions 1 through
4 and failed-run history remain immutable. Cycle 2b, B15/V15, real-data
admission, full Cycle 2 exit, and production remain Blocked.
See
[ADR 0042](./docs/adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md)
and the [Cycle 2o exit matrix](./docs/CYCLE_2O_EXIT_MATRIX.md).

Cycle 2p is **Pass only for exact promoted revision
`d642e534b8911b58a32d50f8dfb976ae2900cadc`**, the exact corrective child of
source `bc4b371784711102462ad28a9c9eb7cb567f1072` from frozen documentation
baseline `e21408acf70a28909136cc3eb0c10bbbd48b8266`. It promotes only the
repository-controlled Phase-A admission-validity correction and its exact
evidence routing. For an otherwise valid record, `validUntil` is the earliest
of both approval expiries and any scheduled rights-authority or data-steward
revocation. Evaluation at or after that cutoff fails closed.

The immutable corpus-admission implementation remains historical blob
`e456cae97cf9eb377e3b3e8aabc156fdb377e2c7` from the exact
`7243f16` → `96b0426` → `711fe86` chain. Both independent evidence verifiers
and the cross-engine workflow accept only the exact six-path Cycle 2p source or
its one exact eight-path corrective child; the cumulative transition has nine
paths, and any other touch to the ten-path protected surface fails before Cycle
2o routing.

The corrective child also closes the source revision's Windows CI blocker.
Custody workspace identity, link-count, and file-size checks now use exact
bigint metadata, preventing distinct 64-bit NTFS identities from aliasing after
lossy number conversion. Full local verification passed 1,306 tests with 4
intentional skips. CI run `33118610052` passed Ubuntu/Windows jobs
`98679559915` / `98679560385`; parser isolation, payload custody,
normalization execution, and cross-engine acceptance runs `33118609943`,
`33118610058`, `33118609968`, and `33118610020` also reached terminal green.

Cycle 2p creates no new canonical evidence version. Cross-engine acceptance
emitted no artifact by design, the three standard workflow artifacts are
regression anchors only, and Cycle 2o version 5 remains immutable history at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`. For the historical Cycle 2b/2p
enterprise-admission track, exact external inventory, rights/steward approval,
trusted time and human authority, real filing data, independent adjudication,
real quality, B15/V15, real-data admission, full Cycle 2 exit, and production
remain Blocked. See
[ADR 0043](./docs/adr/0043-admission-validity-corrective-chain-promotion.md)
and the [Cycle 2p exit matrix](./docs/CYCLE_2P_EXIT_MATRIX.md).

Cycle 2q is **Pass only for exact source revision
`398bb280593b6de125c5561ac9dd1b1c0fe254bd`**, the direct child of baseline
`2f0534d2a5b4206221cc66ece5e03cf529e5d373`. It adds the isolated,
zero-production-dependency `@research-cockpit/personal-filing-corpus` package
for the active `personal_single_user_local` profile. The verifier snapshots
bounded canonical declaration and manifest bytes, binds the declaration to the
exact manifest SHA-256, validates 1–100 sorted unique filing metadata entries,
and returns only an immutable aggregate record with status
`verified_for_personal_use`.

This is manifest verification, not filing admission. It does not open a raw
payload, prove payload presence or digest equality, authenticate SEC as the
source, evaluate parser output, or enforce deletion. Its exact direct-child
transition has 13 paths; the protected surface adds unchanged enterprise
`corpus-admission.ts`. The cross-engine route runs the package checks, emits no
Cycle 2q artifact, and preserves Cycle 2o version 5 at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`. Full local verification passed
1,330 tests with 4 intentional skips; the focused package suite passed all 17
tests. CI `33125521900` passed Ubuntu and Windows; normalization, cross-engine,
parser-isolation, PostgreSQL, payload-custody, and Dependabot runs
`33125521872`, `33125521890`, `33125521898`, `33125521899`, `33125521910`, and
`33125607844` also reached terminal success.

Enterprise rights/steward approval, multi-user identity and tenancy, B15/V15,
and production operations are Out of scope for this personal profile only.
They are not being claimed as satisfied, and Cycle 2b/2p remains unchanged.
At the Cycle 2q exit, the next blocker was a bounded streaming local-payload
verifier. Cycle 2r closes that source-capability boundary without changing the
manifest-only Cycle 2q claim. See
[ADR 0044](./docs/adr/0044-personal-single-user-local-filing-corpus-manifest-verification.md)
and the [Cycle 2q exit matrix](./docs/CYCLE_2Q_EXIT_MATRIX.md).

Cycle 2r is **Pass only for exact source revision
`e15ddd8aa923a43fdca730e233abfbe684101e78`**, the direct child of promoted
Cycle 2q documentation baseline
`436f7fed6af9efaec21a26e5709b90073610384e`. It extends the isolated personal
package with `verifyPersonalFilingCorpusPayloadIdentity`. On a successful
invocation, the verifier re-verifies owned declaration and manifest snapshots,
maps every accession to the fixed direct child `<accession>.payload`, observes
the exact bounded root inventory before and after reading, and streams every
expected regular, single-link, same-device file through one descriptor in
positional chunks of at most 65,536 bytes plus an EOF probe. The bytes read
during that invocation must have the declared length and SHA-256 while the
root, path, and descriptor identities match at the verifier's pre/open/post
observations.

Success returns only an immutable aggregate record with status
`payload_identity_verified_for_personal_use`; the exact claim is
`bounded_streamed_local_payload_presence_length_and_sha256_verified_for_personal_single_user_local_use`.
No root path, accession, per-file digest, or payload bytes cross the result
boundary. On supported non-Windows runtimes with `O_NOFOLLOW`, `linkAssurance`
is `kernel_final_component_nofollow_plus_observed_snapshots`; on Windows it is
`observed_snapshots_only`. The Windows claim rejects Node-visible links and
observed multi-link files but does not promise universal reparse-point
rejection, namespace race freedom, or protection against every active
same-machine attacker.

The exact ten-path transition has 20 NUL fields, 693 bytes, and digest
`sha256:46e497134b8cae95acc6211503a636b559064fdcf0dc95924d793f2d5dbaf4fb`;
both offline boundaries accept it. Full local verification passed 1,364 tests
with 4 intentional skips, and the focused personal-package suite passed 45
tests with one capability-based Windows skip. CI `33207340001` passed Ubuntu
and Windows jobs `98971624813` / `98971625033`; cross-engine, parser-isolation,
normalization, and payload-custody runs `33207340045`, `33207340114`,
`33207340070`, and `33207340021` also reached terminal success. No Cycle 2r
artifact is emitted, and Cycle 2o version 5 remains anchored at
`472cc10b8df90bee01925b2efd4fbcb614d7590c`.

This promotion proves the verifier with generated temporary fixtures; it adds
no owner corpus, payload-root configuration, filing payloads, or successful
owner-corpus operation record. Enterprise approvals, shared-user controls,
B15/V15, and production operations remain Out of scope for this personal
profile only. At the Cycle 2r exit, the next blocker was bounded local custody,
audit metadata, retention-target metadata, and explicit owner-managed deletion with an
aggregate receipt. Cycle 2s closes that source-capability boundary without
retroactively changing Cycle 2r or proving a specific owner corpus. See
[ADR 0045](./docs/adr/0045-personal-local-filing-payload-identity-verification.md)
and the [Cycle 2r exit matrix](./docs/CYCLE_2R_EXIT_MATRIX.md).

Cycle 2s is **Pass only for exact source revision
`78b3880632ff7e54ac493e9c208ee1d93a275aa1`**, the direct child of promoted
Cycle 2r documentation baseline
`a13b51d2cd6862029aa598829e40209ce178c7be`. It adds
`recordPersonalFilingPayloadCustody` and
`deletePersonalFilingPayloadCustody` to the disconnected personal package.

Custody re-verifies the owned Cycle 2q documents, invokes Cycle 2r payload
identity internally, and requires separate canonical non-root and nonnested
live payload/audit roots. From an empty audit root it publishes through
exclusive pending creation, synchronization, destination-absence observation,
same-directory rename, and reread; later calls revalidate/replay the final
record or may promote valid pending bytes. The exact custody claim is
`bounded_separate_local_payload_and_audit_custody_recorded_for_personal_single_user_local_use`;
the status is `local_payload_custody_recorded_for_personal_use`. The record
binds the manifest and runtime identity result plus an unkeyed location digest
over canonical paths and observed identities. Plaintext paths are not returned,
but digest secrecy, unlinkability, and resistance to offline guessing are not
claimed. Its retention target is recorded arithmetic metadata, not a minimum
hold, scheduler, or enforcement promise.

Explicit deletion requires the fixed caller confirmation and expected custody
digest, publishes an append-only intent before any unlink, and targets only
manifest-derived direct children. Present selected files are rehashed and
identity-observed before unlink. Terminal success requires every selected name
absent and the exact live-root inventory empty; the empty payload directory and
the three aggregate custody/intent/receipt audit files remain. The exact
deletion claim is
`bounded_owner_triggered_selected_live_payload_paths_observed_absent_for_personal_single_user_local_use`;
the status is `live_payload_names_absent_after_explicit_personal_delete`.

The receipt covers selected live names only. It does not prove deletion from
backup, cloud, replica, snapshot, cache, temp, log, swap, recycle-bin,
filesystem-history, third-party, memory, or physical-media locations and is not
cryptographic erasure. Caller confirmation is not owner authentication. No
automatic retention, crash/cross-process/exactly-once recovery, active-attacker
race safety, signed/tamper-proof audit, running-app composition, or specific
owner corpus is claimed.

The exact 11-path transition has 22 NUL fields, 778 bytes, digest
`sha256:f8feb8c71409711439761778e738872c3ff91974ce1a2a047dbf410f276805e6`,
and a 19-path protected surface. Both offline boundaries accept it. Full local
verification passed 1,405 tests with 8 intentional capability skips; the
focused personal-package suite passed 80 with 4 skips. CI `33221451567` passed
Ubuntu/Windows jobs `99016146240` / `99016146391`; cross-engine,
parser-isolation, normalization, and payload-custody runs `33221451518`,
`33221451525`, `33221451528`, and `33221451601` also reached terminal success.
No Cycle 2s cross-engine/CI evidence artifact is emitted.

Generated fixtures prove the disconnected capability only. Cycle 2t's complete
repository-visible status is **owner-approved private operation Pass for one
owner-selected corpus**; the selection and every private operation input and
output remain unrecorded here. That status is not an independent review and
does not prove source authenticity, parser correctness, or fact truth.
Enterprise approval, multi-user controls, B15/V15, and production remain Out
of scope for this profile. See
[ADR 0046](./docs/adr/0046-personal-local-filing-payload-custody-and-owner-deletion.md)
and the [Cycle 2s exit matrix](./docs/CYCLE_2S_EXIT_MATRIX.md).

Cycle 2u is **Pass only for exact source revision
`4df5549087660b5b5d473c478b03b17576fd4784`, the direct child of promoted
Cycle 2s documentation baseline
`39f0ce974f84e278ec9d12193b284876c928110e`.** It adds the disconnected
`normalizePersonalFilingFacts` boundary to the personal package. The operation
owns bounded declaration, manifest, normalization-plan, and parser-result byte
snapshots; reuses the personal manifest verifier; and accepts only canonical
private plan and source documents bound to that verified manifest.

The closed contract contains exactly `assets`, `cash`, `debt`,
`diluted_shares`, `free_cash_flow`, `gross_profit`, `net_income`,
`operating_cash_flow`, `operating_income`, and `revenue`, once and in order per
source document. Direct facts use exact plan mappings with unique source
QNames, fixed unit/period contracts, empty dimensions, and canonical decimals.
The free-cash-flow subtrahend cannot collide with any direct mapping; the only
deliberate coordinate reuse is its minuend matching the mapped
`operating_cash_flow`. Free cash flow is allowed only as the fixed
operating-cash-flow-minus-capital-expenditures subtraction with both operands
and exact decimal recomputation; no other implicit derivation or unit
conversion is accepted.

One manifest root creates 10 versions and zero lineage edges with
`root_only_no_in_corpus_amendment`. Its open end means only no later version in
the exact frozen manifest. An optional manifest-linked amendment pair creates
20 versions and exactly 10 one-to-one supersession edges with half-open known
windows. It does not discover external amendments or establish global
currentness.

Any failure produces one immutable value-free quarantine with zero facts and
zero lineage. The success claim is
`bounded_private_ten_fact_normalization_and_manifest_linked_lineage_for_personal_single_user_local_use`.
The exact private plan, parser-result documents, normalized material, and
operation record stay outside Git and logs. The complete private-operation
status is **owner-approved private operation Pass for one owner-selected
corpus**. Raw XBRL/iXBRL parsing, SEC authenticity, accounting/fact truth,
taxonomy authority, amendment discovery, independent parser comparison,
quality, database/API/web composition, and production remain unproven. Cycle
2v narrows that next comparison to distinct repository-pinned TypeScript and
Python reconstruction of the same complete record; it does not claim an
independent raw parser.
See [ADR 0047](./docs/adr/0047-bounded-personal-ten-fact-normalization-and-root-lineage.md)
and the [Cycle 2u exit matrix](./docs/CYCLE_2U_EXIT_MATRIX.md).

Cycle 2v is **Pass only for exact source revision
`76bd8a1319d6b5feb05da412ca30fe6507c5bdbb`, the direct child of promoted
Cycle 2u documentation baseline
`90c20e6eeb6c387015af81f74ba4b8e7aebc444b`.** It supplies the same owned
declaration, manifest, plan, and parser-result bytes to the repository-pinned
TypeScript Cycle 2u normalizer and a distinct repository-pinned,
zero-dependency Python validator. Python independently reconstructs the exact
complete Cycle 2u record; the TypeScript comparator accepts only byte-identical
canonical records, including all values, operands, identities, bindings,
lineage, scopes, and statuses.

Any invalid input, normalization quarantine, Python source or execution
failure, invalid secondary record, or byte difference returns one atomic
value-free quarantine. There is no tolerance,
preferred side, detailed conflict disclosure, or silent repair. Success is an
immutable metadata-only receipt binding the input set, agreed record, and both
pinned implementations. The private comparison is recorded only as
**owner-approved private TypeScript/Python validator comparison Pass for one
owner-selected corpus**; no corpus characteristic or private input/output is
repository-visible.

This is independent normalization-record reconstruction, not independent raw
parsing or extraction. Shared-input/specification correctness, accounting
truth, operator/host/key/failure-domain independence, common error or
collusion, runtime attestation, SEC authenticity, amendment discovery, global
currentness, owner-reviewed quality, application composition, and production
remain unproven. Cycle 2w narrows the next step to a separate raw extraction
path for the primary-selected dimensionless coordinates. Enterprise/shared-
service requirements remain Out of scope for the personal profile. See
[ADR 0048](./docs/adr/0048-bounded-personal-typescript-python-normalization-record-agreement.md)
and the [Cycle 2v exit matrix](./docs/CYCLE_2V_EXIT_MATRIX.md).

Cycle 2w is **Pass only for exact source revision
`1f7ff096c9187386cad9ae60e1e44861e6e5f842`, the direct child of promoted
Cycle 2v documentation baseline
`ad5e3003d3670c84021dabe47c4fb3976274bb23`.** It first requires the same
owned declaration, manifest, plan, and parser-result snapshot to pass Cycle
2v, then rebinds the raw filing documents to the manifest's exact count, order,
byte lengths, and SHA-256 values. A repository-pinned zero-dependency Python
worker receives only those raw document bytes and the ten sorted target QNames;
the primary parser results, normalized record, expected values, and their
digests do not cross that worker boundary.

The Python structural HTML/iXBRL path independently reconstructs contexts,
periods, empty/nonempty dimension classification, bounded simple USD or shares
units, and allowlisted transform/sign/scale decimal values. The comparator
requires exact value agreement without tolerance at the ten primary-selected
dimensionless raw coordinates per document, including the two free-cash-flow
operands with the operating-cash-flow coordinate reused. Equivalent duplicates
collapse and conflicting duplicates quarantine. Additional distinct raw
coordinates are outside this projection, as are the unit, transform, and value
semantics of excluded dimensional target facts.

Success is an immutable metadata-only receipt with status
`raw_extraction_agreed_for_personal_use`; every invalid input, missing Cycle 2v
agreement, raw-scope mismatch, worker failure, malformed output, or selected-
coordinate conflict becomes one atomic value-free quarantine. The private run
is recorded only as **owner-approved private raw-extraction comparison Pass for
one owner-selected corpus**. No selected-corpus characteristic, private input,
fact, value, mapping, digest, timestamp, receipt, or execution mode is
repository-visible.

Cycle 2w removes the shared parser-result document from the secondary selected-
value path; it does not prove the shared QName mapping or primary selection,
completeness among additional coordinates, excluded dimensional semantics,
primary parser identity or code lineage, general XBRL coverage, SEC
authenticity, accounting truth, amendment discovery, runtime independence,
owner-reviewed quality, application composition, or production. Cycle 2x
closes the next bounded owner-reviewed quality step without changing Cycle
2w's historical claim. Enterprise/shared-service requirements remain Out of
scope. See
[ADR 0049](./docs/adr/0049-bounded-personal-raw-filing-selected-fact-extraction-agreement.md)
and the [Cycle 2w exit matrix](./docs/CYCLE_2W_EXIT_MATRIX.md).

Cycle 2x is **Pass only for exact promoted corrective-chain tip
`39ce73760afe0e5d22063b02a60efe64e83f3747`**. The bounded capability began at
source revision `c0138a3121361fc06f210e42febe6af4c6fa3e13`, the direct child of
promoted Cycle 2w documentation baseline
`716a3f6b7ad5a43c48a6a61d18b59c2cd5645018`. Validator subprocess isolation
was corrected at `7f7163d4673360645e332d0b7d28467c15656f8a`, and `39ce737` is the
exact routing-closure child that admits only that three-commit source chain.

The protocol owns bounded declaration, manifest, normalization-plan,
quality-plan, parser-result, and raw-filing snapshots. The plan binds the exact
owner-reviewed reference digest, population, selection rules, and fixed
zero-tolerance thresholds before candidate execution. Candidate observations
are derived internally through Cycle 2w and Cycle 2u and committed before the
reference content can be revealed. The reveal capability is instance-bound,
single-use, and consumed by every first attempt.

The frozen reference contract contains the exact ordered launch labels for
each admitted document, including the fixed free-cash-flow operand contract.
The evaluator derives document success, fact precision and recall, exact unit
and date agreement, silent critical failures, and quarantine rate with integer
ratio arithmetic. The caller cannot supply counts, metrics, thresholds,
weights, exclusions, or outcomes. Every threshold must pass; any successful
disagreement or explicit pipeline quarantine is evaluated as `not_met`, while
invalid protocol or reference material becomes one atomic value-free
quarantine. Results are immutable and aggregate-only.

The private result is recorded only as **owner-approved private bounded
quality-measurement Pass for one owner-selected corpus**: the protocol reached
`quality_evaluated_for_personal_use` and its predeclared personal threshold
outcome was met. No selected-corpus characteristic, private reference or plan,
input or output, fact, label, value, coordinate, mapping, count, metric,
measured numerator, denominator, or per-metric outcome, digest, timestamp,
token, approval, seal, receipt, runner artifact, execution mode, or execution
detail is repository-visible.

The exact tip passed exact-source CI run `33290262191`'s full hosted release
gate on Ubuntu and Windows. Cross-engine, parser-isolation,
normalization, and payload-custody runs `33290262193`, `33290262185`,
`33290262180`, and `33290262184` also passed. These public runs prove source
and routing health only; they do not authenticate the private measurement.

Cycle 2x closes the currently declared `personal_single_user_local` filing-
ingestion exit gate for the one owner-selected corpus. It does not establish
external chronology or secrecy, owner identity, independent adjudication,
label correctness, representativeness or generalization, SEC authenticity,
accounting truth, broad parser coverage, runtime independence, amendment
discovery, global currentness, database/API/web composition, shared-service
safety, or production readiness. Any changed source, corpus, reference, plan,
or thresholds requires fresh review and measurement. Cycle 2y and Cycle 2z
separately close bounded readiness and selected-fact composition without
widening Cycle 2x. Enterprise/shared-service requirements remain Out of scope.
See
[ADR 0050](./docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md)
and the [Cycle 2x exit matrix](./docs/CYCLE_2X_EXIT_MATRIX.md).

Cycle 2y closes a **disabled-by-default coarse personal-quality readiness
composition boundary** at exact source revision
`a3ab46aa09f1b63a86fdb8c1f98976b26ba30e3f`. Only explicit
`personal_readiness` startup may admit
the exact source-pinned and hash-pinned resource-corrected Cycle 2x aggregate,
once and before listen. The local readiness route is guarded by exact loopback,
Host, and Origin checks and returns only
`{schemaVersion, profile, status, dataPlane: "disabled"}` with private/no-store
and no-cache response controls. An optional browser chip may render only that
same coarse state. The paired absolute path and owner-provided digest are
pre-listen inputs only and are removed from the process environment before the
listener starts.

Cycle 2y does not compose personal facts or a personal dossier. Personal values, labels,
reference content, quality-plan content, metrics, hashes, paths, approvals,
aggregate material, and execution detail remain outside responses, browser
state, logs, and storage. Cycle 2z separately closes the exact same-snapshot
selected-fact release boundary without widening Cycle 2y. An authenticated
browser session and resistance to hostile same-user processes remain later
boundaries. Enterprise/shared-service requirements remain Out of scope.

Exact-source CI run `33334380969` passed on Ubuntu job `99318536228` and
Windows job `99318536323`; the full local release gate passed 1,526 tests with
8 intentional skips. See
[ADR 0051](./docs/adr/0051-bounded-personal-quality-readiness-composition.md)
and the [Cycle 2y exit matrix](./docs/CYCLE_2Y_EXIT_MATRIX.md).

Cycle 2z is **promoted only for exact frozen source revision
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`**. Its private evidence is limited
to the permitted coarse outcome below. It closes one explicit personal
selected-fact startup boundary that
rederives the production candidate from the same frozen inputs, matches it to
the admitted quality result, and consumes fresh owner authorization before
listen. Only the exact startup-fixed selected-facts response may reach the
guarded local GET route and optional nonpersistent browser view.

The source is the merge-free chain
`62c01dafe305ddd43c75688e0225163b3abdf6df` ->
`e64924bc091bfc7a3e071e7db746910e082051c4` ->
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66`. Its implementation transition
contains 43 paths, 13 added and 30 modified, with 3,840 insertions and 46
deletions; its corrective transition contains 5 modified paths, with 1,310
insertions and 9 deletions. Local `corepack pnpm verify` passed 1,573 tests
with 8 intentional skips and every format, lint, guardrail, type, peer, and
production-build gate. Exact-source general CI run `33344500398` passed through
Ubuntu job `99345958471` and Windows job `99345958683`; parser-isolation run
`33344500394`, payload-custody run `33344500364`, and cross-engine run
`33344500412` also passed. Independent read-only source review found no
remaining actionable P0/P1/P2 issue for the declared personal scope.

Coarse owner-approved private selected-fact release outcome: Pass for the exact
frozen personal scope.

Cycle 2z does not authorize dynamic selection, a personal dossier, history,
evidence display, valuation, thesis, alerts, export, persistence, or background
ingestion. Loopback, Host, and Origin checks are not owner authentication.
Cycle 3a separately closes the authenticated owner-browser boundary only for
exact source revision `ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`.
Hostile same-user processes remain unproven.
Enterprise/shared-service requirements remain Out of scope. See
[ADR 0052](./docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md)
and the [Cycle 2z exit matrix](./docs/CYCLE_2Z_EXIT_MATRIX.md).

Cycle 3a is **accepted and promoted only for exact source revision
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`**. Private evidence is limited to
the permitted coarse outcome below. It uses one operator-supplied bootstrap that is single-use within one
API authority/process and one active process-memory owner session in front of
both explicit personal API modes. The API accepts only exactly 64 lowercase
hexadecimal characters in `RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET`; that shape
check does not prove how the value was generated. Generating 32 fresh bytes with
a CSPRNG for every API process and encoding them as lowercase hexadecimal is an
operator precondition. The API captures and deletes the variable from its
process environment before composition and listen, then retains only digests.
The owner pastes the secret into a password field shown only under exact
`RESEARCH_COCKPIT_WEB_MODE=personal_single_user_local`. It is sent only in
`X-Research-Cockpit-Bootstrap` on a bodyless POST. Cycle 3a code puts it in no
URL, body, durable cookie, browser storage, console, or application log.

Success sets one host-only, nonpersistent `HttpOnly`, `SameSite=Strict` cookie
scoped to `/v1/personal-filing`. Valid use refreshes a 10-minute monotonic idle
deadline but not the fixed 60-minute absolute deadline. Exact intent-header
CSRF checks, rotation, logout, explicit revocation, expiry, and process-close
invalidation are included. IPv4 personal mode requires
`http://127.0.0.1:3000`; IPv6 requires `http://[::1]:3000`. Never mix
`localhost` with an API bound to `127.0.0.1`. Before any personal browser fetch,
the client also requires `NEXT_PUBLIC_API_BASE_URL` to be an exact literal-
loopback HTTP origin with an explicit port from 1 through 65535 and no userinfo,
path, query, or fragment. An invalid base fails locally without issuing a fetch.
Personal calls also fail before fetch when the page has a controlling service
worker or its controller state cannot be read. Cycle 3a registers no application
service worker and puts no authority in application service-worker state; this
is a narrow guard, not a claim against hostile browser state.

The personal browser lifecycle is also memory-only. Bootstrap establishes local
idle and absolute deadlines. Each local lifecycle observation is captured
before dispatch of its corresponding bootstrap, revalidation, rotation, or
protected-read request, so it is never later than server authorization.
Successful authorized private reads and rotation reset only the local idle
deadline; rotation preserves the known absolute deadline. A tab that discovers
an already-active cookie but lacks the original absolute timestamp uses a
conservative local lease bounded by the idle TTL, without claiming
synchronization with the server deadline. `pagehide` and a hidden visibility
transition clear and deactivate local private presentation while preserving any
known local deadline, without broadcasting or ending the server session. Window focus, `pageshow`, and a visible transition
clear first and revalidate with the server without polling.

Personal access is disabled if the browser cannot construct the nonpersistent,
credential-free `BroadcastChannel`. A publish failure locks and clears the
initiating tab. Local expiry, logout, revocation, or failed revalidation clears
rendered private state immediately; immediate sibling invalidation is claimed
only when the channel delivers the signal operationally. An already-active
sibling that misses a signal falls back to focus/visible/`pageshow`
revalidation or its conservative local lease. Bootstrap and rotation use the same fail-closed
transport to ask siblings to clear first and revalidate. No lifecycle signal or
timestamp enters Web Storage, IndexedDB, or a durable cookie; the API remains
authoritative.

After restart or expiry, a fresh process can bootstrap with no owner cookie or
one syntactically valid stale owner cookie; success replaces the stale value.
Malformed or duplicate cookies fail, and the fresh process must still have an
unused bootstrap digest and no active session.

The code protects both personal compositions. The preserved Cycle 2z release
evidence remains bound to exact Cycle 2z source
`e76eeca112949f58e7e6e4ed57bcc0ab7e102d66` and remains historical. Cycle 3a's
source binding is distinct, and no private sub-result enters public evidence.
This does not widen or alter Cycle 2z.

The exact merge-free source transition is
`dd7fb5ea0b5c288f4337793dd6ddcb314f8b41f3` ->
`ee023b9cf7cf43fd63baa9b531ae71cc34f349e1`: 39 paths, comprising 13 additions
and 26 modifications, with 6,543 insertions and 238 deletions. Local
`corepack pnpm verify` passed every format, lint, guardrail, type, peer, test,
and production-build gate. Settled suite totals include 119 API tests, 94 web
tests, and 582 database tests; every remaining package suite passed with only
intentional skips. Exact-source general CI run `33460175145` passed on attempt
1 in Ubuntu job `99708487084` and Windows job `99708487035`; payload-custody
run/job `33460175120` / `99708486913` and cross-engine run/job `33460175088` /
`99708486675` also passed on attempt 1. Independent read-only source review
found no remaining actionable P0/P1/P2 issue for the declared personal scope;
this is not an external audit.

Coarse owner-approved private selected-fact release outcome: Pass for the exact
frozen personal scope.

This proves local bearer possession, not verified human identity. Single-use and
replay denial apply only within one authority/process; the API cannot detect an
operator reusing the same valid-shaped secret in another process. Cross-process
same-secret reuse, hostile same-user processes, browser extensions, developer
tools, screenshots, clipboard readers, hostile browser state beyond the narrow
service-worker guard, remote or multi-user authentication, durable sessions, and
Cycle 3b dossier composition remain nonclaims. See
[ADR 0053](./docs/adr/0053-personal-local-owner-session.md) and the
[Cycle 3a exit matrix](./docs/CYCLE_3A_EXIT_MATRIX.md). The next separate
milestone is Cycle 3b authenticated personal dossier composition: one coherent
admitted snapshot for dossier, evidence-passport, restatement-lineage, chart,
and valuation inputs, with no synthetic/personal mixing. Dynamic selection,
refresh, persistence, and background work remain later milestones.

Cycle 1b-a moves history, timeline, and evidence membership into
instrument-scoped snapshots and freezes a separate operation-scoped port for an
RLS reader. That port cannot claim complete coverage or disclose hidden row
counts. B9 now has a separately live-reviewed database-package implementation,
but the running app remains disconnected and continues to use only the closed
SYN1 fixture.

Cycle 1b-a2 adds a pure, fail-closed normalizer for the narrow synthetic,
dimensionless financial-fact row shape the later B9 adapter now supplies to the
normalizer.
It separates listing and security identity, preserves decimals and timestamps
without rounding or precision loss, and rejects an entire ambiguous batch. It
does not add the query, driver, pool, or app wiring.

Cycle 1b-b1 adds an executable, clean-database PostgreSQL acceptance harness
for a separate Ubuntu CI job. It atomically renders the seven reviewed
migrations and ledger records, loads only source-controlled synthetic fixtures,
and probes impersonated capability-role/RLS semantics against one exact
PostgreSQL 17.11 image digest. A green run writes and uploads a
success-only, exact-schema record bound to the commit, GitHub run, reviewed
inputs, observed versions, completed checks, and explicit limitations. The
first reviewed run passed at commit `611c93d`; its retained run record is linked
in [the Cycle 1b-b1 evidence note](./docs/POSTGRESQL_ACCEPTANCE_EVIDENCE.md).
The harness remains disconnected from the app and is not deployed persistence.

The final local Cycle 1b-b1 review gate verifies a downloaded run record against
independently supplied repository/run/hash anchors and fixed source blobs read
from its exact Git commit. Its only success verdict is `offline_consistent`;
it cannot authenticate GitHub, inspect logs, or independently prove PostgreSQL
executed. The first retained artifact produced that verdict after the linked run
and logs were reviewed separately.

Cycle 1b-b2 proves one additional, bounded PostgreSQL contract. At commit
`3479e164`, an ephemeral runtime service account authenticated with SCRAM over
loopback TCP inside the isolated service container, then explicitly assumed
only the existing read-only runtime capability. The reviewed run and retained
version 2 record are linked in the
[Cycle 1b-b2 evidence note](./docs/POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md). This did
not add an application driver or pool, expose a database port, authenticate an
end user, or prove external TLS, production secrets,
migrator/test-loader/backup authentication, restore, or deployment readiness.
At B2 the distinct-migrator boundary remained separate because PostgreSQL 17
role creation conflicts with migration `0001`'s zero-membership bootstrap
invariant; B7 addresses only the bounded redesign recorded below.

Cycle 1b-b3 now has a reviewed live result at commit `664c0e5b`. While the same
ephemeral b2 login was active, the acceptance harness reran the reviewed alpha/
beta tenant visibility, inactive and non-current membership, direct/join/
subquery isolation, operation-rights, and alternating prepared-read assertions
through the SCRAM-authenticated session with transaction-local runtime role
selection. Run `31991498652` produced a version 3 success record that returned
`offline_consistent` against separately supplied anchors. B3 changes no
migration, capability role, application dependency, network exposure, driver,
pool, or composition root, and it does not promote b1's additional
null/malformed/unsupported-context cases. See the
[Cycle 1b-b3 evidence note](./docs/POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[exit matrix](./docs/CYCLE_1BB3_EXIT_MATRIX.md), and
[ADR 0015](./docs/adr/0015-authenticated-runtime-authorization-matrix.md).

Cycle 1b-b4 is complete for its bounded recorded scope. It adds one
parameterized, operation-specific listing-to-financial-fact PostgreSQL query, a
closed semantic unit mapping, a 100-row fail-closed result bound, and
integration with the existing row normalizer through the authenticated
container-local `psql` path.
It is deliberately driverless: no pool, API/web import, app composition, write
path, migration, or real data is included. It also adds no external
runtime/development dependency, database-driver dependency, package-manifest
dependency change, or lockfile change. The pinned PostgreSQL run passed and its
version 4 artifact returned `offline_consistent`; see the
[B4 evidence note](./docs/POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[ADR 0016](./docs/adr/0016-driverless-projection-query-and-semantic-unit-mapping.md)
and the [Cycle 1b-b4 exit matrix](./docs/CYCLE_1BB4_EXIT_MATRIX.md).

Cycle 1b-b5 is complete for its bounded recorded scope at commit `04e5c1b`.
The unchanged reviewed fixture was loaded through one ephemeral,
acceptance-only SCRAM login with one exact non-inheriting, non-admin, set-only
edge to the existing test-seed capability. The pinned PostgreSQL run and
version 5 record passed independent review and returned `offline_consistent`.
B5 adds no production or external authentication, TLS, managed secret system,
driver, pool, concurrent loader, migrator, backup/restore, real data, or app
integration. See the
[B5 evidence note](./docs/POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[ADR 0017](./docs/adr/0017-authenticated-test-loader-fixture-load.md), and the
[Cycle 1b-b5 exit matrix](./docs/CYCLE_1BB5_EXIT_MATRIX.md).

Cycle 1b-b6 is complete for its bounded recorded scope at commit `7aac502`.
One ephemeral, acceptance-only SCRAM login received one exact non-inheriting,
non-admin, set-only edge to the existing owner capability. The reviewed run
proved pre-role denial, rejected the reviewed forbidden role and
session-authorization transitions, and exercised transaction-local owner
selection, rollback and committed-create behavior for one fixed DDL object,
authenticated removal, ledger immutability, role reset, and zero residue.
PostgreSQL run `32058853521` produced a retained version 6 record that returned
`offline_consistent`. B6 did not execute a migration or close
`authenticated_migrator_sessions`; that versioned platform/application gap was
reserved for B7 and is closed only for the bounded result below.
See the [B6 evidence note](./docs/POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[ADR 0018](./docs/adr/0018-authenticated-owner-ddl-canary.md), and the
[Cycle 1b-b6 exit matrix](./docs/CYCLE_1BB6_EXIT_MATRIX.md).

Cycle 1b-b7 is complete for its bounded recorded scope at commit `41d13dd`.
PostgreSQL run `32068159652` produced a retained version 7 record that returned
`offline_consistent` against separately supplied anchors. The reviewed path
keeps the historical b1 through b6 plan as regression-only input, then resets
the exact disposable database and four capability roles before a new, closed
v2 platform/application plan. The container-superuser platform phase creates
the roles, owner-owned schemas, database/schema/public ACL lockdown, and
hardened `btree_gist` installation. A distinct ephemeral non-superuser then
authenticates with SCRAM, selects only the owner capability, and applies the
complete role-neutral application plan with login-attributed ledger rows,
rollback/replay checks, and mandatory zero-residue cleanup. This does not prove
a production or incremental migrator, external/TLS identity, managed secrets,
cross-phase atomicity, backup/restore, concurrency, a driver or pool, real data,
or deployment readiness. See the
[B7 evidence note](./docs/POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[ADR 0019](./docs/adr/0019-versioned-authenticated-migration-phase.md), and the
[Cycle 1b-b7 exit matrix](./docs/CYCLE_1BB7_EXIT_MATRIX.md).

Cycle 1b-b8 is complete for its bounded recorded scope at commit `49d3a96`.
PostgreSQL run `32076642878` produced a retained version 8 record that returned
`offline_consistent` against separately supplied anchors. One ephemeral SCRAM
login selected only the existing `NOBYPASSRLS` backup capability to create a
custom, policy-scoped, column-insert, data-only archive of the 21 reviewed
synthetic application data tables; the migration ledger was excluded. A
different ephemeral SCRAM login selected only the test-seed capability to
restore that archive in one transaction into a same-cluster database created
from `template0` and independently provisioned with the reviewed platform and
exact v2 application plan. The run covered transactional failure rollback,
successful restore, replay denial, fingerprint/catalog/authorization
equivalence, source isolation, and mandatory zero-residue cleanup. It does not
cover full-schema/global or cross-cluster/version restore,
production/incremental/continuous backup, storage encryption/retention,
disaster recovery, or RPO/RTO. See the
[B8 evidence note](./docs/POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./docs/adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md),
and the [Cycle 1b-b8 exit matrix](./docs/CYCLE_1BB8_EXIT_MATRIX.md).

Cycle 1b-b9 is complete for its bounded recorded scope at commit `8e470e9`. It
adds one non-owning,
exclusively leased single-client, read-only `pg` implementation of
`OperationScopedProjectionSource<FinancialFact>`. A trusted synthetic actor is
injected outside the query; every load first resets transaction state, then
uses transaction-local runtime role and request context; and the adapter reuses
the reviewed B4 query and fail-closed normalizer. PostgreSQL run `32083732063`
used one real SCRAM-authenticated client through a random loopback-only workflow
mapping, proved a pre-existing read-write transaction was rolled back rather
than committed, then closed and drained the client before writing version 9
evidence. The retained record returned `offline_consistent` against separately
supplied anchors. B9 adds no pool, app/API import, identity resolver, production
secret handling, external/TLS path, concurrency, cancellation, or timeout
claim. See the
[B9 evidence note](./docs/POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./docs/adr/0021-single-client-read-only-postgresql-projection-adapter.md),
and the [Cycle 1b-b9 exit matrix](./docs/CYCLE_1BB9_EXIT_MATRIX.md).

Cycle 1b-b10 is complete for its bounded recorded scope. Its accepted source,
`PooledPostgresFinancialFactProjectionSource`, owns one explicitly transferred,
real `pg.Pool` bounded to two clients and reimplements the exact B9
read-only role/context/B4-query transaction for each checkout. The design
snapshots the query and trusted synthetic actor before checkout, bounds pool
acquisition and PostgreSQL `statement_timeout`, and recycles a client only after
successful preflight, transaction, and postflight cleanup. Active abort marks
cancellation, waits for the in-flight operation to settle under the fixed
server timeout, then destroys the checkout; ambiguous or timed-out checkouts are
also never reused. The source closes the owned pool idempotently after registered
work settles. Source and local verification are complete: all 12 database test
files and 485 tests, database typechecking, migration and PostgreSQL static
guardrails, focused ESLint/Prettier, and the diff check pass; independent
integrated review reports GO with no P0/P1 finding. The bounded live path passed
in PostgreSQL run `32161137775` at commit `2dcb259`; its retained version 10
record returned `offline_consistent`. See the
[B10 evidence note](./docs/POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./docs/adr/0022-bounded-postgresql-projection-pool-lifecycle.md), and
the [Cycle 1b-b10 exit matrix](./docs/CYCLE_1BB10_EXIT_MATRIX.md).

Cycle 1b-b11 source, integrated local verification, and bounded live V11 review
are complete. `PostgresMigrationDeployer` snapshots the exact closed v2 plan
before I/O and runs one pending suffix through an exclusively leased,
authenticated client. One read-write transaction applies finite statement and
lock timeouts, the reviewed advisory lock, transaction-local owner selection,
an exact ledger-table lock, identity/ledger-shape checks, exact ordered-prefix
validation, pending reviewed bodies, and matching ledger rows. Checksum, file,
order, shape, or extra-row drift fails through a stable value-free boundary.
Injected failure rolls the pending body and ledger row back; a current ledger
is a no-op; ambiguous cleanup poisons the deployer. The reviewed live gate
reconstructed only the exact `v2-0005` prefix and used two loopback clients to
prove one applied `v2-0006` while the other observed current state. PostgreSQL
run `32183709701` passed at commit `5df9d07`; its retained version 11 record
returned `offline_consistent`. See the
[B11 evidence note](./docs/POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md),
[ADR 0023](./docs/adr/0023-locked-postgresql-migration-ledger-deployment.md),
and the [Cycle 1b-b11 exit matrix](./docs/CYCLE_1BB11_EXIT_MATRIX.md).

Cycle 1b-b12 is complete for one deterministic RLS query-plan and bounded
2,000-read load gate. The fixed source module and fixture cover the existing B4
fact-as-known shape plus one tenant thesis read. Authenticated forced-RLS plans
used `financial_facts_as_known` and `theses_by_instrument` without disabling
sequential scans or creating an acceptance-only index. Exactly 1,000 fact and
1,000 tenant promises were submitted before one barrier release through a pool
and login both bounded to eight connections. The first eight runtime workload
backends were observed together; a separately connected out-of-band
administrator observed them but executed none of the 2,000 workload reads. The
submissions were not 2,000 connections. PostgreSQL run `32230667908` passed at
commit `59c4e58`; its retained V12 record returned `offline_consistent`. See the
[B12 evidence note](./docs/POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./docs/adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md)
and the [Cycle 1b-b12 exit matrix](./docs/CYCLE_1BB12_EXIT_MATRIX.md).

Cycle 1b-b13 now freezes an accepted technical privacy/retention model and a
separate empty-only, synthetic keyed-resource-identifier lifecycle. Deleted
registry allocations clear raw tenant/resource UUIDs while retaining a
pseudonymous domain/type/token tombstone; a fixed authenticated capability
performs that single-resource transition, offboarding blocks new allocations,
and fixed procedures bound online tenant purge and expired audit/idempotency
cleanup. Token MAC keys remain behind an external provider, and PostgreSQL does
not verify HMAC authenticity. The source and V13 evidence contract do not
constitute production privacy/legal approval. Production admission remains
blocked. PostgreSQL run `32305478242` passed the exact bounded synthetic path
at commit `a959cba`; its retained V13 record returned `offline_consistent`. See
the [B13 evidence note](./docs/POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](./docs/adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md)
and the [Cycle 1b-b13 exit matrix](./docs/CYCLE_1BB13_EXIT_MATRIX.md).

Cycle 1b-b14 now adds the source contract for one bounded synthetic populated
cutover from the exact v2 pre-`0005` branch to the B13 keyed lifecycle. A
temporary audited work registry captures post-boundary thesis/alert inserts
and deletes while authenticated bounded backfill is open; an exact capture
epoch and short final write-conflicting barrier gate target validation and
contract. The acceptance actors are test-only and the design neither recovers
identifiers deleted before capture nor proves a production writer/dual-write
protocol, uninterrupted writes, crash/failover recovery, production scale, or
real-data safety. PostgreSQL run `32343225599` passed the exact bounded
synthetic path at commit `d688aa21e969feef6611f6efcd1aeaaed6e31df9`;
its retained V14 record returned `offline_consistent`. The final catalog check
is semantic rather than physical equivalence to B13. See the
[B14 evidence note](./docs/POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](./docs/adr/0026-bounded-populated-resource-identifier-online-cutover.md)
and the [Cycle 1b-b14 exit matrix](./docs/CYCLE_1BB14_EXIT_MATRIX.md).

Pool transfer is exclusive: after construction the caller may not call
`connect()`, query or release a client, call `end()`, or otherwise inspect or use
the pool while the source owns it. Only read-only counters may be inspected
after `source.close()` completes. The reviewed live reset proof therefore uses
only an out-of-band administrative observer for same-PID idle/application/user/
advisory-lock state, followed by a source-owned actor-isolated load and the
timeout/application-name probes. Custom-GUC and prepared-statement cleanup are
source, unit, and static `DISCARD ALL` evidence, not direct live inspection.

## Requirements

- Node.js 24.19.x
- pnpm 11.19.0

## Run

```powershell
pnpm install --frozen-lockfile
pnpm dev:demo
```

For the default synthetic demo, open
`http://localhost:3000/research/SYN1`. The API listens on
`http://127.0.0.1:3100`. Do not set either personal-mode variable for this
default.

Personal mode is a separate explicit startup. In the API terminal, first set the
existing complete personal-mode inputs. The example below uses readiness-only
mode. Build before creating authority, then generate one fresh 32-byte bootstrap
with the platform CSPRNG and place it in the API environment and clipboard
without printing it. The API captures and deletes its child-process copy of the
bootstrap environment variable before listen. The parent shell must still clear
its own copy.

```powershell
$env:RESEARCH_COCKPIT_MODE = "personal_readiness"
$env:PERSONAL_FILING_QUALITY_RESULT_PATH = "C:\absolute\owner-local\quality-result.json"
$env:PERSONAL_FILING_QUALITY_RESULT_SHA256 = "sha256:<64 lowercase hex characters>"

pnpm --filter @research-cockpit/api build

try {
  $ownerBootstrapBytes = New-Object byte[] 32
  $ownerBootstrapRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $ownerBootstrapRng.GetBytes($ownerBootstrapBytes)
    $ownerBootstrapSecret = -join ($ownerBootstrapBytes | ForEach-Object { $_.ToString("x2") })
  } finally {
    $ownerBootstrapRng.Dispose()
    [Array]::Clear($ownerBootstrapBytes, 0, $ownerBootstrapBytes.Length)
    $ownerBootstrapBytes = $null
  }

  $env:RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET = $ownerBootstrapSecret
  Set-Clipboard -Value $ownerBootstrapSecret
  $ownerBootstrapSecret = $null
  pnpm --filter @research-cockpit/api start
} finally {
  $ownerBootstrapSecret = $null
  Remove-Item Env:RESEARCH_COCKPIT_OWNER_BOOTSTRAP_SECRET -ErrorAction SilentlyContinue
  Set-Clipboard -Value ([string]::Empty)
}
```

Do not echo the variable, pass it as a command-line argument, include it in a
transcript, or save it in the repository. `personal_fact_release` uses the same
bootstrap steps. Its authorization remains source-bound and single-use; a later
source requires a fresh owner-reviewed release and fresh authorization rather
than reusing historical evidence.

In the web terminal, opt into the matching IPv4 personal web mode and start
Next.js on the literal IPv4 address:

```powershell
$env:RESEARCH_COCKPIT_WEB_MODE = "personal_single_user_local"
$env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:3100"
pnpm --filter @research-cockpit/web exec next dev -p 3000 -H 127.0.0.1
```

Open `http://127.0.0.1:3000/research/SYN1`, paste the clipboard value into the
one-time bootstrap password field, and select **Start session**. After the
session is confirmed, clear the clipboard from either terminal without
displaying it:

```powershell
Set-Clipboard -Value ([string]::Empty)
```

The same session can be reused until idle or absolute expiry and can be rotated,
logged out, or explicitly revoked from the owner panel. Stopping the API exits
the `try` block, whose `finally` removes the parent-shell environment copy and
clears the clipboard so the ordinary runbook cannot accidentally reuse the
secret. The API itself enforces the hexadecimal shape and per-process single-use
transition, but it cannot prove CSPRNG entropy or detect reuse in a different
process.

For the IPv6 variant, set `$env:HOST = "::1"`, set
`NEXT_PUBLIC_API_BASE_URL` to `http://[::1]:3100`, start Next.js with `-H ::1`,
and open `http://[::1]:3000/research/SYN1`. The browser URL, API URL, and bind
host must use the same literal loopback family. `localhost` and `127.0.0.1` are
not interchangeable in personal mode.

## Verify

```powershell
pnpm verify
```

The release gate checks formatting, lint, clean-room/database boundaries,
fixture and migration hashes, the acceptance-harness declaration, production
licenses, strict types, tests, and both production builds. CI runs the same gate
on Windows and Linux. The digest-pinned Ubuntu PostgreSQL workflow and both CI
platforms passed for the b1 commit `611c93d` and the bounded b2 commit
`3479e164`. B1 remains clean-only impersonated-capability evidence. B2
additionally proves only one container-local SCRAM runtime service account; it
does not substitute for end-user or production identity, concurrent pool
behavior, dump/restore, or deployment readiness. B3's broader authenticated
tenant/rights/prepared-read matrix passed in PostgreSQL run `31991498652` at
commit `664c0e5b`; its retained version 3 record returned `offline_consistent`.
B4's driverless query-to-normalizer path passed in run `32007521395`. B5's
authenticated fixture-load path passed in run `32012508025` at commit
`04e5c1b`; its retained version 5 record returned `offline_consistent`. B6's
bounded owner-DDL canary passed in run `32058853521` at commit `7aac502`; its
retained version 6 record also returned `offline_consistent`. B7's bounded
authenticated application-migration path passed in run `32068159652` at
commit `41d13dd`; its retained version 7 record returned
`offline_consistent`. B8's bounded authenticated policy-scoped dump and clean
restore passed in run `32076642878` at commit `49d3a96`; its retained version 8
record returned `offline_consistent`. B9's single-client adapter passed in run
`32083732063` at commit `8e470e9`; its retained version 9 record also returned
`offline_consistent`. B10's bounded two-client pool lifecycle passed in run
`32161137775` at commit `2dcb259`; its retained version 10 record returned
`offline_consistent`. B11's locked migration-ledger deployment passed in run
`32183709701` at commit `5df9d07`; its retained version 11 record returned
`offline_consistent`. B12's bounded query-plan/load path passed in run
`32230667908` at commit `59c4e58`; its retained version 12 record returned
`offline_consistent`. These remain bounded, synthetic acceptance results. The
offline verifier checks record/source consistency after download but cannot
authenticate the GitHub run or independently prove PostgreSQL execution.
B13's synthetic privacy/retention lifecycle passed separately in PostgreSQL run
`32305478242` at commit `a959cba`; its retained version 13 record returned
`offline_consistent`. B14's bounded synthetic populated cutover passed in
PostgreSQL run `32343225599` at commit
`d688aa21e969feef6611f6efcd1aeaaed6e31df9`; its retained version 14 record
also returned `offline_consistent`. Production privacy/legal admission remains
blocked.

## Safety boundary

- Synthetic records declare provenance and a rights policy.
- Restricted facts are removed before API serialization.
- Financial values cross domain/API boundaries as decimal strings.
- Browser-local state is for demonstration only and must not contain real holdings or personal information.
- Production data, identity, billing, persistence, SEC ingestion, external alerts, and AI remain gated work.
- Synthetic tests and a clean-only acceptance run are not production authentication or deployed-persistence evidence.
- The proved container-local database service-account boundary does not
  establish end-user identity, external/TLS transport, managed
  secrets, pool safety, or production authorization.
- The reviewed b3 authenticated matrix does not establish a trusted end-user or
  tenant binding, an external/TLS path, production secrets, pool safety,
  concurrent behavior, restore viability, or deployed persistence.
- The reviewed B5 run is limited to one ephemeral acceptance-only synthetic
  loader; it does not establish production/external authentication, TLS, secret
  operations, concurrent loading, an authenticated migrator or backup, restore,
  real-data ingestion, or application integration.
- The reviewed B6 result is only an authenticated owner-DDL canary. It applies
  no migration, does not redesign role bootstrap, and does not authorize a
  production owner or migrator login.
- The reviewed B7 result separates a local container-superuser platform phase
  from an acceptance-only authenticated application migration phase. It cannot
  authorize production/incremental migration or make the two phases globally
  atomic.
- The reviewed B8 result covers only RLS-visible synthetic application data
  restored inside the same ephemeral cluster. It is not a full backup,
  production schedule, encrypted/retained archive, disaster-recovery plan, or
  RPO/RTO result.
- The reviewed B9 result establishes only a sequential, non-owning read adapter
  over one exclusively leased client and its fail-closed transaction-reset
  contract. It does not establish end-user identity, pool safety,
  application composition, external/TLS transport, managed secrets,
  concurrency, cancellation, timeouts, or production readiness.
- The reviewed B10 result is limited to a runner-local, two-client pool with
  bounded acquisition, settlement-before-discard active abort, server-timeout
  recovery, destructive failure discard, idempotent close, and zero observed
  residue. It does not prove
  graceful PostgreSQL cancellation, prompt cancellation while queued, reuse of
  a canceled backend, production pool tuning, load capacity, retry/failover,
  identity, application composition, or production readiness.
- B11 passed only one exact v2 suffix through two container-local authenticated
  deployers. It does not prove external/production migrator credentials,
  arbitrary or multi-release upgrades, application compatibility under live
  writes, crash recovery, cancellation, distributed coordination, global
  platform/application atomicity, or production readiness.
- B12 passed only its exact synthetic two-plan, 2,000-submission gate. It
  uses at most eight runtime workload backends plus a separate administrator
  observer and does not prove 1,000 or 2,000 simultaneous connections,
  production capacity/SLOs or pool tuning/failover,
  plan stability across other data/statistics/hardware/versions, real data,
  application composition, or production readiness.
- B13 passed only its exact synthetic-only, empty-data-only keyed-identifier
  lifecycle. It does not provide
  production privacy/legal approval, verified-subject DSAR or legal-hold
  handling, an operating offboarding scheduler, KMS/HSM custody or token
  verification, deletion across online/backup/third-party planes, populated
  migration/cutover, cryptographic erasure, global deletion proof, or
  real-customer-data admission.
- B14 passed only its exact bounded synthetic populated-cutover sequence in
  one disposable database. It does not establish production
  application-writer integration or authorization, a dual-write/allocation-gap
  protocol, continuous zero downtime, production duration/SLO/lock budgets,
  crash/restart/failover/downgrade behavior, recovery of identifiers deleted
  before capture, physical catalog equivalence, or permission for real tenant
  or personal data.
- Cycle 1c adds only two update-only seeded in-memory routes on an exact
  loopback boundary. Its public persona selectors are not credentials; it does
  not establish end-user authentication, general BOLA protection, external
  network safety, PostgreSQL/RLS or durable persistence, production writer
  integration, browser-state migration, load/operational readiness,
  privacy/legal controls, or permission for real data.
- Cycle 2a's exact disconnected synthetic parser-envelope run remains a
  historical green fact; its bounded owned-byte security conclusion is
  Superseded on the historical bytes and restored only on exact Cycle 2h commit
  `61701307ded7fa77a555e27925ae86670f6b4dc0`.
  It does not prove a representative or counsel-approved corpus, ten-fact
  quality, general XBRL/iXBRL, production container host/key/queue/retention
  controls, malware safety, app/database composition, load/SLOs, source
  authenticity, or permission for real filings.
- Cycle 2b Phase A implements only an unverified metadata-admission protocol.
  Its historical local/CI jobs do not establish the Superseded owned-byte
  security conclusion or the blocked target claim.
  It does not supply or approve a filing manifest, authenticate counsel or SEC,
  verify raw payload presence or content digests, establish revocation
  freshness, normalize facts, measure quality, compose an application, or
  authorize real-data or production use.
- Cycle 2c implements only one generated synthetic payload lifecycle. It does
  not support the historical Superseded bounded owned-byte conclusion; its
  canonical jobs/artifacts remain historical facts. Exact Cycle 2h commit
  `61701307ded7fa77a555e27925ae86670f6b4dc0` restores only the bounded
  owned-byte premise. It does not admit a Cycle 2b manifest, prove real payload presence or SEC provenance,
  establish production key/storage/retention/deletion controls or
  cryptographic erasure, compose the application, satisfy parser-quality
  gates, or authorize real-data or production use.
- Cycle 2d is limited to one closed synthetic original/amendment schema and
  one exact ten-key normalization contract; tests generate the canonical pair,
  while the boundary does not authenticate generator provenance. Its prior
  bounded owned-byte security conclusion remains Superseded on the historical
  bytes and is restored only on exact Cycle 2h commit `61701307`. It
  does not approve Cycle 2b,
  execute a parser, validate real filing bytes, establish independent
  adjudication or quality, compose a database/application, or authorize
  real-data or production use.
- Cycle 2e proves only exact byte agreement between two separately implemented,
  distinctly declared synthetic validators after complete closed-schema
  validation. Its prior bounded owned-byte security conclusion is Superseded
  on the historical bytes and restored only on exact Cycle 2h commit `61701307`.
  It does not authenticate either declaration or digest, establish
  true independence, execute a parser, validate a real filing or accounting
  truth, provide adjudicated quality evidence, compose the application, or
  authorize real-data or production use.
- Cycle 2f accounts for one fixed 100-document synthetic declared reference and
  evaluates fixed synthetic-pilot thresholds. Its original and restored
  bounded owned-byte security conclusions remain Superseded historical claims;
  the premise is restored only on exact Cycle 2h commit `61701307`. It does not prove actual
  adjudicator independence, blinding, label correctness, representative real
  filings, real parser quality, threshold adequacy, or production acceptance.
- Cycle 2g is limited to one in-process one-shot candidate-observation commit
  before declared-reference reveal. Its bounded owned-byte security conclusion
  remains Superseded on `df1ddff` and is restored only on exact Cycle 2h commit
  `61701307`. It does not prove that the caller lacked
  reference content out of band, that the digest hides labels, that chronology
  is authentic or durable across instances/restarts, or that Cycle 2f cannot be
  called directly.
- Cycle 2h targets only intrinsic typed-array carrier/backing/length validation,
  exact local prototypes, and hook-free owned copying across the Cycle 2a–2g public
  ingress inventory. The claim and every promotion gate are Pass only for exact
  source commit `61701307ded7fa77a555e27925ae86670f6b4dc0`. It does not harden poisoned primordials, isolate caller code,
  authenticate real sources, or close any wider Cycle 2 or production gate.
- Cycle 2i targets only the bounded synthetic authenticated interface from two
  raw-archive digest bindings and two signed complete ten-fact
  original/amendment envelopes into the unchanged Cycle 2d normalizer. Its
  bounded source claim and every promotion gate are Pass only for exact source
  commit `5a1589ede57e00d6ff60521e7b53bea2ac849b0a`, from baseline
  `dda2ecafc70aa6c4859a29cb312849bac5dec253`. It does not execute or validate a
  parser, establish key/image/source authority, approve Cycle 2b, prove
  independent adjudication or real quality, admit real filings, or close any
  production gate.
- Cycle 2j is Pass only for exact source commit
  `b2c7a28c2c5720253eba275b65d3313b114c3bc4` from baseline
  `f17bacc6adc46851e182d260d59830652f1953bb`. Each accepted closed synthetic
  ten-fact original/amendment pair uses exactly two fresh isolated workers;
  additional fresh workers cover replay and adversarial paths. Outside-worker
  signing, unchanged Cycle 2i handoff, exact-source workflows, retained live
  artifact, and offline review passed. External authority, independent real
  quality, full Cycle 2 exit, and production remain Blocked.
- Cycle 2k's historical execution record passed only for exact source commit
  `54908db1ded8193ac4ade7a3d6f38505c6b4b8e5` from baseline
  `962a00f65835fc6126e4da98e0e0d5998e8d59cc`. Its exact five-commit chain,
  44-path transition, local and exact-source workflow gates, dedicated run/job
  `32917020041` / `98022742591`, retained artifact, and 66-of-66
  `offline_consistent` review passed. The four earlier failed runs remain
  immutable non-evidence with zero artifacts. Its security conclusion and claim
  are Superseded because child receipts were not bound to the current input
  archives and common-mode lineage mutations could pass. The immutable anchors
  remain historical facts only.
- Cycle 2l is Pass only for exact source commit
  `2e3a7e33a76d19b993375958aff671707a81ef05`, the exact corrective child of
  failed precursor `67af24176df3c17fd6d54498095888c9a43ebe1f` from baseline
  `b9b7dd19996f0c5bb1e073ab5522c42e06dee397`. It targets exact current-archive,
  child-receipt, document-role, pair/execution-binding, 20-fact partition, and
  reciprocal ten-edge lineage validation. Its exact two-commit,
  two-first-parent, 23-path transition passed local verification, exact-source
  Ubuntu/Windows CI, the six-case v2 live matrix, retained artifact
  `9623531283`, and a 66-of-66 `offline_consistent` review. The failed precursor
  and three zero-artifact failed workflow runs remain immutable non-evidence.
  It cannot prove
  injected boundary or receipt authenticity, fresh execution, independent real
  quality, real data, Cycle 2b authority, or production.
- Cycle 2m is Pass only for exact source commit
  `5d61868e6075865b32640ddaceb845ac9dbc69f3`, the single-parent child of baseline
  `1cb7d3ce024cbd29665af7ec4e010da0c380b726`. Full local verification,
  exact-source two-OS CI, six-case success-only v3 artifact `9627207288`, and
  independently anchored `offline_consistent` review passed. The record binds
  71 source hashes, 24 transition paths, 16 checks, 16 nonclaims, one agreed and
  five quarantined outcomes, and two identical normalizations with eight unique
  container-ID and lifecycle-binding hashes. Source-triggered legacy failures
  `33022798055` and `33022797729` retained zero artifacts and remain
  non-evidence; exact five-file maintenance child
  `1860bb367afdb6d725e41880ebb121dda4a04f39` restored their historical routing,
  and its custody, parser-isolation, dedicated zero-artifact bridge, and two-OS
  CI runs all passed. Cycle 2l v2 and Cycle 2k v1 history remain immutable.
  Docker/host authenticity, image attestation, worker-internal nonce/cache
  semantics, external signer/KMS identity, quality, Cycle 2b, real data,
  B15/V15, and production remain nonclaims or Blocked.

See [the sanitized product brief](./docs/SANITIZED_PRODUCT_BRIEF.md),
[threat model](./docs/THREAT_MODEL.md), [next build cycles](./docs/BUILD_ROADMAP.md),
[canonical model](./docs/CANONICAL_MODEL.md),
[Cycle 1b-a exit matrix](./docs/CYCLE_1BA_EXIT_MATRIX.md),
[Cycle 1b-a2 exit matrix](./docs/CYCLE_1BA2_EXIT_MATRIX.md),
[Cycle 1b-b1 exit matrix](./docs/CYCLE_1BB1_EXIT_MATRIX.md),
[Cycle 1b-b2 exit matrix](./docs/CYCLE_1BB2_EXIT_MATRIX.md),
[Cycle 1b-b2 evidence note](./docs/POSTGRESQL_RUNTIME_AUTH_EVIDENCE.md),
[Cycle 1b-b3 exit matrix](./docs/CYCLE_1BB3_EXIT_MATRIX.md),
[Cycle 1b-b3 evidence note](./docs/POSTGRESQL_AUTHORIZATION_MATRIX_EVIDENCE.md),
[Cycle 1b-b4 exit matrix](./docs/CYCLE_1BB4_EXIT_MATRIX.md),
[Cycle 1b-b4 evidence note](./docs/POSTGRESQL_PROJECTION_QUERY_EVIDENCE.md),
[Cycle 1b-b5 exit matrix](./docs/CYCLE_1BB5_EXIT_MATRIX.md),
[Cycle 1b-b5 evidence note](./docs/POSTGRESQL_TEST_LOADER_EVIDENCE.md),
[Cycle 1b-b6 exit matrix](./docs/CYCLE_1BB6_EXIT_MATRIX.md),
[Cycle 1b-b6 evidence note](./docs/POSTGRESQL_OWNER_DDL_EVIDENCE.md),
[Cycle 1b-b7 exit matrix](./docs/CYCLE_1BB7_EXIT_MATRIX.md),
[Cycle 1b-b7 evidence note](./docs/POSTGRESQL_AUTHENTICATED_MIGRATION_EVIDENCE.md),
[Cycle 1b-b8 exit matrix](./docs/CYCLE_1BB8_EXIT_MATRIX.md),
[Cycle 1b-b8 evidence note](./docs/POSTGRESQL_AUTHENTICATED_BACKUP_RESTORE_EVIDENCE.md),
[ADR 0020](./docs/adr/0020-authenticated-policy-scoped-data-backup-and-bounded-clean-restore.md),
[Cycle 1b-b9 exit matrix](./docs/CYCLE_1BB9_EXIT_MATRIX.md),
[Cycle 1b-b9 evidence note](./docs/POSTGRESQL_SINGLE_CLIENT_PROJECTION_ADAPTER_EVIDENCE.md),
[ADR 0021](./docs/adr/0021-single-client-read-only-postgresql-projection-adapter.md),
[Cycle 1b-b10 exit matrix](./docs/CYCLE_1BB10_EXIT_MATRIX.md),
[Cycle 1b-b10 evidence note](./docs/POSTGRESQL_BOUNDED_PROJECTION_POOL_EVIDENCE.md),
[ADR 0022](./docs/adr/0022-bounded-postgresql-projection-pool-lifecycle.md),
[Cycle 1b-b11 exit matrix](./docs/CYCLE_1BB11_EXIT_MATRIX.md),
[Cycle 1b-b11 evidence note](./docs/POSTGRESQL_LOCKED_MIGRATION_LEDGER_EVIDENCE.md),
[ADR 0023](./docs/adr/0023-locked-postgresql-migration-ledger-deployment.md),
[Cycle 1b-b12 exit matrix](./docs/CYCLE_1BB12_EXIT_MATRIX.md),
[Cycle 1b-b12 evidence note](./docs/POSTGRESQL_QUERY_PLAN_LOAD_EVIDENCE.md),
[ADR 0024](./docs/adr/0024-bounded-postgresql-rls-query-plan-and-load-acceptance.md),
[Cycle 1b-b13 exit matrix](./docs/CYCLE_1BB13_EXIT_MATRIX.md),
[Cycle 1b-b13 evidence note](./docs/POSTGRESQL_PRIVACY_RETENTION_EVIDENCE.md),
[ADR 0025](./docs/adr/0025-versioned-resource-identifier-privacy-and-retention-lifecycle.md),
[Cycle 1b-b14 exit matrix](./docs/CYCLE_1BB14_EXIT_MATRIX.md),
[Cycle 1b-b14 evidence note](./docs/POSTGRESQL_POPULATED_CUTOVER_EVIDENCE.md),
[ADR 0026](./docs/adr/0026-bounded-populated-resource-identifier-online-cutover.md),
[Cycle 1c exit matrix](./docs/CYCLE_1C_EXIT_MATRIX.md),
[ADR 0027](./docs/adr/0027-loopback-synthetic-persona-research-state-api.md),
[Cycle 2a exit matrix](./docs/CYCLE_2A_EXIT_MATRIX.md),
[Cycle 2a evidence note](./docs/FILING_PARSER_ISOLATION_EVIDENCE.md),
[ADR 0028](./docs/adr/0028-bounded-synthetic-filing-parser-isolation.md),
[Cycle 2b exit matrix](./docs/CYCLE_2B_EXIT_MATRIX.md),
[ADR 0029](./docs/adr/0029-fixed-public-filing-candidate-manifest-admission.md),
[Cycle 2c exit matrix](./docs/CYCLE_2C_EXIT_MATRIX.md),
[Cycle 2c evidence note](./docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md),
[ADR 0030](./docs/adr/0030-bounded-synthetic-filing-payload-custody.md),
[Cycle 2d exit matrix](./docs/CYCLE_2D_EXIT_MATRIX.md),
[ADR 0031](./docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md),
[Cycle 2e exit matrix](./docs/CYCLE_2E_EXIT_MATRIX.md),
[ADR 0032](./docs/adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md),
[Cycle 2f exit matrix](./docs/CYCLE_2F_EXIT_MATRIX.md),
[ADR 0033](./docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md),
[Cycle 2g exit matrix](./docs/CYCLE_2G_EXIT_MATRIX.md),
[ADR 0034](./docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md),
[Cycle 2h exit matrix](./docs/CYCLE_2H_EXIT_MATRIX.md),
[ADR 0035](./docs/adr/0035-cross-boundary-intrinsic-byte-snapshot-hardening.md),
[Cycle 2i exit matrix](./docs/CYCLE_2I_EXIT_MATRIX.md),
[ADR 0036](./docs/adr/0036-bounded-synthetic-authenticated-parser-normalization-handoff.md),
[Cycle 2j exit matrix](./docs/CYCLE_2J_EXIT_MATRIX.md),
[ADR 0037](./docs/adr/0037-bounded-synthetic-ten-fact-parser-execution-normalization.md),
[Cycle 2k exit matrix](./docs/CYCLE_2K_EXIT_MATRIX.md),
[ADR 0038](./docs/adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md),
[Cycle 2l exit matrix](./docs/CYCLE_2L_EXIT_MATRIX.md),
[ADR 0039](./docs/adr/0039-bounded-synthetic-cross-engine-current-input-and-lineage-agreement.md),
[Cycle 2m exit matrix](./docs/CYCLE_2M_EXIT_MATRIX.md),
[ADR 0040](./docs/adr/0040-bounded-synthetic-source-owned-direct-docker-cross-engine-lifecycle-agreement.md),
[Cycle 2n exit matrix](./docs/CYCLE_2N_EXIT_MATRIX.md),
[ADR 0041](./docs/adr/0041-bounded-synthetic-source-owned-quality-composition.md),
[Cycle 2o exit matrix](./docs/CYCLE_2O_EXIT_MATRIX.md),
[ADR 0042](./docs/adr/0042-bounded-synthetic-parser-archive-custody-quality-composition.md),
[Cycle 2p exit matrix](./docs/CYCLE_2P_EXIT_MATRIX.md),
[ADR 0043](./docs/adr/0043-admission-validity-corrective-chain-promotion.md),
[Cycle 2q exit matrix](./docs/CYCLE_2Q_EXIT_MATRIX.md),
[ADR 0044](./docs/adr/0044-personal-single-user-local-filing-corpus-manifest-verification.md),
[Cycle 2r exit matrix](./docs/CYCLE_2R_EXIT_MATRIX.md),
[ADR 0045](./docs/adr/0045-personal-local-filing-payload-identity-verification.md),
[Cycle 2s exit matrix](./docs/CYCLE_2S_EXIT_MATRIX.md),
[ADR 0046](./docs/adr/0046-personal-local-filing-payload-custody-and-owner-deletion.md),
[Cycle 2u exit matrix](./docs/CYCLE_2U_EXIT_MATRIX.md),
[ADR 0047](./docs/adr/0047-bounded-personal-ten-fact-normalization-and-root-lineage.md),
[Cycle 2v exit matrix](./docs/CYCLE_2V_EXIT_MATRIX.md),
[ADR 0048](./docs/adr/0048-bounded-personal-typescript-python-normalization-record-agreement.md),
[Cycle 2w exit matrix](./docs/CYCLE_2W_EXIT_MATRIX.md),
[ADR 0049](./docs/adr/0049-bounded-personal-raw-filing-selected-fact-extraction-agreement.md),
[Cycle 2x exit matrix](./docs/CYCLE_2X_EXIT_MATRIX.md),
[ADR 0050](./docs/adr/0050-bounded-personal-owner-reviewed-filing-quality-measurement.md),
[Cycle 2y exit matrix](./docs/CYCLE_2Y_EXIT_MATRIX.md),
[ADR 0051](./docs/adr/0051-bounded-personal-quality-readiness-composition.md),
[Cycle 2z exit matrix](./docs/CYCLE_2Z_EXIT_MATRIX.md),
[ADR 0052](./docs/adr/0052-bounded-personal-owner-authorized-selected-fact-release.md),
and [architecture decisions](./docs/adr/).
