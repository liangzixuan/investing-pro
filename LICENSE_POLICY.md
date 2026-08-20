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
