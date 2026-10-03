# Repository instructions

This repository is public. These instructions describe development in a clone;
they do not grant access to an owner's account, deployment, data or signing keys.
Honor the current task's authorization and narrower applicable instructions.

## Read first

1. [README](README.md) for profiles and setup.
2. [Current work](docs/CURRENT_WORK.md) for the dated accepted baseline and active outcome.
3. [Architecture](docs/ARCHITECTURE.md) and the relevant feature guide or specification.
4. [Product roadmap](docs/PRODUCT_ROADMAP.md) when selecting new product work.

For exported context, follow [AI context](docs/AI_CONTEXT.md). Missing operational
receipts or private configuration are not a reason to search another workspace,
credential store or owner-data directory. Historical documents retain their dated
scope and do not supersede current status.

## Engineering

- Preserve unrelated changes and the working product. Choose the smallest version
  that meets the current requirements end to end, then add the next layer.
- Keep responsibilities modular: UI/state, shared contracts, domain calculations,
  transport, identity and persistence each have their own boundary.
- Reuse existing modules and established libraries. Check their declared types and
  documentation before adding dependencies or custom replacements.
- Do not preserve obsolete interfaces through compatibility layers. Protect saved
  data, current requirements and explicit migration boundaries.
- Choose durable designs rather than temporary implementations intended for replacement.
  Study established product patterns when designing a new interaction.
- Preserve exact listing/share-class identity, dated provenance and unavailable
  values. Never invent financial values or weaken a validator to get a test pass.
- Keep one coherent outcome and explicit file ownership when working in parallel.
  Do not expand a small fix into a general framework or code-health score exercise.

## Privacy and operations

- Never include credentials, private account subjects, owner records, provider
  bodies, signing material, local custody paths or private evidence in Git,
  documentation, context exports, logs or test fixtures.
- Use invented data for routine tests. Do not write QA records into an owner's
  watchlist or vault. The default demo and managed fixture need no live credentials.
- Managed browser/Android, local research and disconnected profiles are distinct.
  Do not bypass authentication, origin rules or profile checks to combine them.
- Live requests, provisioning, deployment, signing, account actions and installation
  need authorization for that task and the reviewed operational workflow. A public
  URL, config name or historical receipt is not that authorization.
- Do not inspect or export secrets to make a workflow portable. Public configuration
  and secret variable names may be documented; values stay in the authorized private setup.
- Preserve prior releases and rollback identities. Treat timeouts and uncertain
  commits according to the existing reconciliation rules, without blind retries.

## Verification and handoff

Use affected tests and types first, plus scoped lint/format and relevant boundary
checks. Root commands are in [package.json](package.json); `pnpm verify` runs the
full local suite. Do not repeat unchanged passing checks without a reason.
Documentation-only work normally needs scoped formatting and link/config checks,
not an Android build or live-provider call.

For behavior changes, test the meaningful failure and lifetime boundaries:
selection/session retirement, cancellation and late completion, draft retention,
conflicts and malformed responses as applicable. Synthetic tests establish their
specified scope, not production account or physical-device acceptance.

The release workflow derives applicable checks from the actual revision and
workflow sources. Use current-head results and the producing CI attempt. Preserve
original failed outcomes; do not replay terminal observers or operations. A source
merge, API deployment, website promotion, APK artifact and phone upgrade are
separate acceptance events.

When finishing, state what changed, the checks actually run, any remaining limits
and the next useful step. Update the relevant guide and current status when the
accepted product surface changes. Keep operational history outside the public
context; retain a concise, dated summary here. Use plain, concise prose and avoid
claims that test counts or code-health scores establish feature coverage.
