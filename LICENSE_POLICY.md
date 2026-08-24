# Dependency and content policy

The default proprietary runtime permits reviewed MIT, ISC, 0BSD, BSD-2-Clause, BSD-3-Clause, and Apache-2.0 dependencies with exact pins and required notices.

Denied without written counsel/procurement approval:

- AGPL, GPL, LGPL, Commons-Clause, source-available, mixed, proprietary, contradictory, or unknown licenses;
- unreviewed fonts, icons, images, screenshots, fixtures, model weights, datasets, or copied documentation;
- personal-use-only, scraped, or unproven financial/content data; and
- dependencies with floating versions.

Code licenses never grant provider-data, trademark, content, model, or dataset rights. Every exception requires a recorded owner, exact version/hash, approved use, renewal review date, and replacement plan.

## Recorded Sprint 0 exception

| Package      |      Version | License   | Approved use                                                            | Owner                  | Review by  | Replacement plan                                                                                      |
| ------------ | -----------: | --------- | ----------------------------------------------------------------------- | ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| caniuse-lite | 1.0.30001809 | CC-BY-4.0 | Transitive browser-compatibility dataset used by pinned Next.js tooling | Engineering governance | 2026-11-15 | Remove when no longer required; otherwise refresh attribution and re-review with each lockfile update |

This is an engineering approval for the synthetic development slice, not counsel approval for customer deployment.

## Cycle 2a acceptance-image boundary

The isolated filing-parser acceptance job pins the Docker Official Image
`python:3.12.13-slim-bookworm` by its exact OCI index digest and separately
records the `linux/amd64` child-manifest digest. CPython 3.12.13 is distributed
under the Python Software Foundation License Version 2; the primary license
text is retained at <https://docs.python.org/3.12/license.html>.

That CPython license anchor does not classify or approve the complete image.
The image also contains Debian Bookworm packages with their own licenses. A
complete image package/license inventory, redistribution review, counsel or
procurement approval, vulnerability admission, and production image approval
remain pending. The image is permitted only as digest-pinned, synthetic,
CI-acceptance infrastructure for the bounded Cycle 2a isolation gate. It is
not added to the production dependency allowlist and creates no blanket license
exception.

## Cycle 2b Phase-A content-admission boundary

Phase A implements only a verifier protocol for a future fixed public-filing
candidate manifest. It adds no real filing metadata, raw payload, dataset,
rights approval, steward approval, authority-key configuration, or content
exception. The exact local source gate, including all 86 production-license
checks, passes. Exact commit
`b9a9edf680b4c3a7373cd6d96210a24544ba0bbe` also passed
[CI run 32447542432](https://github.com/liangzixuan/investing-pro/actions/runs/32447542432)
on Ubuntu and Windows. Cycle 2b remains blocked.

Before any external candidate manifest can be admitted, this policy still
requires the exact inventory and content hashes, approved use and retention
class, recorded owner, renewal/review date, replacement plan, separate
rights-authority and data-steward signatures, and human review of the signing
authority. A machine-valid signature proves only binding to the supplied key;
it does not authenticate counsel, establish legal validity, or prove revocation
freshness.

Both future approval payloads must bind the exact `authorityKeysSha256` of the
supplied validity/revocation registry. A human/host must compare that digest to
the separately reviewed out-of-band anchor. `status: "admitted"` is only an
internal cryptographic/schema consistency result under that registry, never a
substitute for an authority, counsel, or steward identity decision. Signed
timestamp/hash consistency likewise cannot prove that no earlier parser or
adjudication result existed; that chronology requires external attestation.

The [SEC Webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions)
states that public EDGAR filing content is generally free to access and reuse.
The SEC also publishes a
[ten-requests-per-second automated-access limit](https://www.sec.gov/filergroup/announcements-old/new-rate-control-limits).
Those statements are useful context, but they do not satisfy this repository's
required counsel/procurement approval, authenticate source bytes or declared
digests, or implement EDGAR fetch, DNS, TLS, SSRF, rate-control, custody,
retention, or deletion controls.

## Cycle 2c synthetic payload-custody boundary

Cycle 2c adds one private workspace package with no runtime dependency and
generates its sole 4,096-byte synthetic fixture in process. It adds no external
content, real filing metadata or payload, corpus configuration, approval,
vendor dataset, image, service, or license exception. The final
successor-compatible local `pnpm verify` gate passed all 86 production-license
checks, along with format, lint, every guardrail, all project typechecks and
builds, and 39 test files with 848 passed tests plus 2 POSIX-only Windows skips
(850 total cases).
Two-OS CI run `32463955370`, dedicated Linux custody run `32463955421`,
exact-commit offline review, and independent retained artifact/log review pass
on exact commit `ef22c7bc10596840b8ff686b9190730956fab0c4`. The later local
compatibility result does not replace or widen that canonical live evidence.

The injected entropy provider is an out-of-band trusted CSPRNG TCB. Source
validates only the returned byte shape and exact requested length, not
randomness or uniqueness. The dedicated Linux record is limited to
observed Node `crypto.randomBytes` use and distinct DEK-fingerprint and
nonce-hash samples in that run; it cannot establish OS entropy quality or
approve a production entropy source.

This engineering-only source protocol is not a rights decision and does not
alter Cycle 2b's external inventory, counsel/procurement, steward, or human
key-authority prerequisites. It also does not approve a production KMS,
storage provider, backup/deletion system, cryptographic-erasure claim, real
data, or production use. See
[ADR 0030](./docs/adr/0030-bounded-synthetic-filing-payload-custody.md) and the
[Cycle 2c exit matrix](./docs/CYCLE_2C_EXIT_MATRIX.md), with exact run and
custody anchors in the
[Cycle 2c evidence note](./docs/FILING_PAYLOAD_CUSTODY_EVIDENCE.md).

## Cycle 2d synthetic fact-normalization boundary

Cycle 2d adds one private workspace package with no runtime dependency. Tests
provide fresh deterministic canonical JSON bytes for one original/amendment
pair. The source accepts only caller-supplied bytes matching that closed
synthetic schema and does not authenticate their generator or provenance. It adds no external content,
filing payload, candidate manifest, dataset, image, service, vendor package,
license exception, or production dependency. Local verification is Pass on the
exact frozen bytes: 86 production-license checks and all format, lint,
guardrail, typecheck, test, and build gates passed; 41 test files contain 876
passed plus 2 POSIX-only Windows skips (878 total cases: parser 65; custody 36
passed plus 2 skipped; normalization 26; DB 582; API 49; state 48; contracts 5;
core 62; web 3). The bounded source-stage claim, local gate, and two-OS CI are
Pass only for exact source commit
`f0dcd8056955722681a4ed3d6b296d15a9c3fbbc`; CI run `32511008752` passed in
Windows job `96861883906` and Ubuntu job `96861884146`. Parser run/job
`32511008497` / `96861883641`, custody run/job `32511008447` / `96861883543`,
and PostgreSQL run/job `32511008417` / `96861882949` are unchanged regression
health on that commit, not Cycle 2d evidence.

This source/test protocol is not a rights or corpus-admission decision. It does
not change Cycle 2b's exact external inventory, counsel/procurement,
rights-authority, data-steward, chronology, or human key-authority prerequisites.
No real filing bytes or external metadata are permitted, and no dedicated
Cycle 2d workflow, evidence schema, artifact, offline evidence review, or
evidence note exists. Cycle 2b and production admission remain Blocked; this is
not B15/V15. See
[ADR 0031](./docs/adr/0031-bounded-synthetic-ten-fact-normalization-and-lineage.md)
and the [Cycle 2d exit matrix](./docs/CYCLE_2D_EXIT_MATRIX.md).

## Cycle 2e synthetic two-declared-validator comparison boundary

Cycle 2e adds one private workspace package with no runtime dependency or
external content. Tests construct two canonical same-schema synthetic
validator envelopes in process. The package adds no real filing, candidate
manifest, raw payload, dataset, service, image, vendor package, license
exception, or production dependency. Source implementation is complete. Local
verification is Pass on the exact frozen bytes: `corepack pnpm verify` passed
all format, lint, guardrail, typecheck, test, and build stages with 43 test
files, 911 passed plus 2 skipped (913 total), all 11 workspace project checks,
and 10 builds. The bounded source-stage claim, local gate, and two-OS CI are
Pass only for exact source commit
`60b92aa527435904776144f5e2d5a1a3ab61e67e`; CI run `32518970387` passed in
Ubuntu job `96886795980` and Windows job `96886796247`. Parser run/job
`32518970423` / `96886796118`, custody run/job `32518970453` / `96886796256`,
and PostgreSQL run/job `32518970454` / `96886796382` are unchanged regression
health only, not Cycle 2e evidence.

The fixed validator roles, identifiers, versions, and implementation digests
are unauthenticated declarations. They do not prove code correspondence,
signatures, authority, or independent parsers, processes, hosts, operators,
keys, or failure domains. Cycle 2e creates no dedicated workflow, evidence
schema, artifact, offline review, or evidence note; changes no Cycle 2b
external authority prerequisite; admits no real data; and is not B15/V15. See
[ADR 0032](./docs/adr/0032-bounded-synthetic-two-declared-validator-fact-comparison.md)
and the [Cycle 2e exit matrix](./docs/CYCLE_2E_EXIT_MATRIX.md).

## Cycle 2f synthetic declared-reference quality-measurement boundary

Cycle 2f adds one private workspace package with no runtime dependency or
external content. Tests generate three bounded canonical synthetic documents
for a fixed plan, candidate, and declared reference. The 100 document labels,
1,000 fact targets, 2,000 derived critical assertions, values, identifiers, and
outcomes are repository-authored synthetic fixtures. The package adds no real
filing, candidate manifest, raw payload, public dataset, vendor sample, service,
image, font, model output, or third-party license obligation.

The fixed declared-adjudicator and candidate roles, identifiers, versions, and
declaration digests are unauthenticated declarations. They do not prove human
identity, independent adjudication, blinding, label correctness, parser
execution, or real filing quality. The fixed 0.95/0.99/0.99/0.05/zero-silent
policy is a synthetic-pilot engineering threshold only, not counsel,
procurement, data-steward, statistical, or production approval.

The prior bounded source-stage security conclusion for exact source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` is Superseded. Its recorded local
release run and CI run `32681826143` in Ubuntu job `97299715600` and Windows job
`97299715638` were green, but hostile plain `Uint8Array` carriers could spoof
bounds/shared-buffer metadata or invoke caller `constructor` /
`Symbol.species` hooks during snapshot allocation. Those runs remain historical
green gate facts only and do not establish the bounded owned-snapshot claim.
Current hardened Cycle 2f bytes have a Local restoration Pass from the exact
final pre-promotion Cycle 2g gate; two-OS CI is Pending. Parser run/job `32681826015` /
`97299715074`, custody run/job `32681826030` / `97299715006`, and PostgreSQL
run/job `32681826040` / `97299715107` remain unchanged regression health only,
not Cycle 2f evidence. Cycle 2f creates no
dedicated workflow, evidence schema, artifact, offline review, or evidence
note; changes no Cycle 2b external authority prerequisite; admits no real data;
does not establish the real 2,000-assertion quality gate; and is not B15/V15.
See
[ADR 0033](./docs/adr/0033-bounded-synthetic-declared-reference-quality-measurement.md)
and the [Cycle 2f exit matrix](./docs/CYCLE_2F_EXIT_MATRIX.md).

## Cycle 2g synthetic declared-reference precommitment boundary

Cycle 2g adds one private workspace package with one exact workspace dependency
on the private Cycle 2f quality-measurement package and no external runtime or
development dependency. Tests build bounded canonical plan, candidate
observation, and declared-reference documents entirely in process. All
documents, observations, hashes, counts, capabilities, and outcomes are
repository-authored synthetic fixtures. The package adds no real filing,
candidate manifest, raw payload, public dataset, vendor sample, service, image,
font, model output, package-registry dependency, or third-party license
obligation.

The candidate observation binds one declared-reference SHA-256 before the same
instance accepts those reference bytes, but the digest is not a secret,
credential, signature, timestamp, authority, or proof that the caller lacked
the reference elsewhere. The empty object-identity capability is in-process
only and supplies no external security or serializable authority.

The atomic Cycle 2g source transition also hardens byte snapshotting in both
the new boundary and the public Cycle 2f evaluator. Intrinsic typed-array
getters recover the actual backing buffer and byte length, an ordinary
`Uint8Array` is allocated directly, and the intrinsic typed-array `set` copies
the bytes. Caller-owned `buffer`, `byteLength`, `constructor`, or
`Symbol.species` properties cannot spoof carrier admission or receive snapshot
allocation dispatch. This hardening adds no external dependency, data, or
license obligation.

Source implementation and the exact final pre-promotion local gate are Pass;
two-OS CI is Pending. The local gate passed formatting, full ESLint, all
guardrails, the production-license check across 86 versions, every scripted
typecheck/test/build across 12 of 13 workspace projects, 47 test files with 987
passed plus two skipped (989 total), and the boundary verifier. Cycle 2g creates
no dedicated workflow, evidence schema, artifact, offline review, or evidence
note; changes no Cycle 2b external authority prerequisite; admits no real data;
does not establish actual blinding, independent adjudication, real parser
quality, or the real 2,000-assertion quality gate; and is not B15/V15. Cycle
2f's existing CI anchors remain historical green gate facts for source commit
`72e91f502b31f15deeaad761b82d9ed7b6377d39` only and do not attest the current
hardened Cycle 2f bytes or revive the superseded conclusion. The local
restoration gate is Pass; two-OS CI remains Pending. No Cycle 2g source commit
or CI anchor exists yet. See
[ADR 0034](./docs/adr/0034-bounded-synthetic-declared-reference-precommitment.md)
and the [Cycle 2g exit matrix](./docs/CYCLE_2G_EXIT_MATRIX.md).
