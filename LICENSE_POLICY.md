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
vendor dataset, image, service, or license exception. The exact frozen-byte
local `pnpm verify` gate passed all 86 production-license checks, along with
format, lint, every guardrail, all project typechecks and builds, and 39 test
files with 847 passed tests plus 2 POSIX-only Windows skips (849 total cases).
Two-OS CI run `32463955370`, dedicated Linux custody run `32463955421`,
exact-commit offline review, and independent retained artifact/log review pass
on exact commit `ef22c7bc10596840b8ff686b9190730956fab0c4`.

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
