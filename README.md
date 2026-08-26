# Research Cockpit

An evidence-first investment research workspace being built from the audited product plan. `Research Cockpit` is an internal working name and is not trademark-cleared.

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

Cycle 2k is a proposal-only cross-engine successor and is **Pending exact
recovery** from baseline `962a00f65835fc6126e4da98e0e0d5998e8d59cc` through
failed precursor `14b4ecf41806dca7759a06bebf7ef8da96374f76` and failed
corrective revision `061944f8f770e8a08b2a38d1e2fedf8b8e2de348` to failed
recovery revision `f29e39cea40e76d500df833fd8e0e94e0c86a68c`. Its sole proposed claim is
`bounded_synthetic_two_distinct_pinned_engine_executions_to_exact_ten_fact_normalization_agreement`:
the existing Cycle 2j Python worker and a distinct zero-install pinned Node
worker must produce byte-exact equal complete stdout documents and complete
normalization records for the same owned synthetic original/amendment pair, or
return one atomic value-free quarantine. Dedicated run `32910394736` attempt 1
failed closed at image inspection. Corrective run `32912204603` attempt 1
completed live Docker execution and residue checks, then failed closed at
evidence assembly. Recovery run `32913611954` attempt 1, job `98012515052`,
also completed live Docker execution and residue checks, then failed closed at
evidence assembly; its offline review and upload were skipped. All three runs
retained zero artifacts and are non-evidence. One exact recovery child, its frozen cumulative transition, green
local/CI/regression gates, successful live artifact, and `offline_consistent`
review are still required. The proposal does not establish true organizational, operator,
key, host, or failure-domain independence; general parser or accounting
correctness; real SEC/source authority; Cycle 2b approval; independently
adjudicated real quality; real-data admission; or production. Cycle 2b remains
externally Blocked on the exact inventory, rights/steward approvals, chronology,
authority keys, and human review. See [ADR 0038](./docs/adr/0038-bounded-synthetic-cross-engine-parser-execution-agreement.md)
and the [Cycle 2k exit matrix](./docs/CYCLE_2K_EXIT_MATRIX.md).

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

Open `http://localhost:3000/research/SYN1`. The API listens on `http://localhost:3100`.

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
- Cycle 2k is a proposal-only cross-engine agreement milestone and is Pending
  an exact recovery child of failed recovery revision
  `f29e39cea40e76d500df833fd8e0e94e0c86a68c`, itself an exact single-parent
  direct child of failed corrective revision
  `061944f8f770e8a08b2a38d1e2fedf8b8e2de348`, itself an exact single-parent
  direct child of failed precursor `14b4ecf41806dca7759a06bebf7ef8da96374f76`,
  itself an exact single-parent direct child of baseline
  `962a00f65835fc6126e4da98e0e0d5998e8d59cc`. Failed runs `32910394736`,
  `32912204603`, and `32913611954`, each attempt 1, retained zero artifacts;
  the third run's offline review and upload were skipped. No passing evidence
  or offline verdict exists.
  It cannot establish true independence, correctness, real source
  authority, Cycle 2b approval, adjudicated real quality, real data, or
  production.

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
and [architecture decisions](./docs/adr/).
