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
