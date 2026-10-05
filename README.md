# Investment

Investment is a personal market and research platform for desktop and Android.
`Research Cockpit` remains the internal package name. The goal is a useful daily
workflow for discovering companies, inspecting prices and financial evidence,
keeping ideas, and reviewing holdings using permitted data and existing resources.

The public repository contains several deliberate runtime profiles. Their
capabilities and acceptance are different:

| Profile                               | What it provides                                                                                                                   | Data and access                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Managed browser and Android           | Discover, a shared watchlist with notes/order and conflict handling, explicit Annual report, and AAPL/GOOG/GOOGL EOD close history | Clerk identity, private Appwrite storage and server-side SEC/Tiingo adapters; configured account access is required |
| Local research workspace              | Broader financials, valuation, comparisons, screening, portfolio and filing tools                                                  | Explicit local startup with an admitted catalog and encrypted vault; not migrated to the managed service            |
| Synthetic demo / disconnected Android | Reproducible development and test journeys                                                                                         | Invented data; no production account, provider key or owner vault required                                          |

The managed workspace includes a three-listing Markets board with dated
raw-close changes and company research visits that retain loaded Price and Annual
sections, with a shared watchlist research-note draft. Each change compares the
final two observations already loaded for that listing and discloses that prices
are not adjusted for splits or dividends. Markets coverage remains limited to AAPL, GOOG
and GOOGL. An explicit Load or Refresh for one selected listing preserves the
other board histories. Selection alone makes no price request.

[Current status and limits](docs/CURRENT_WORK.md#accepted-release) records the
accepted website and signed Android releases, source revisions and physical-device
status. Earlier bounded live checks covered explicit reads for those three listings
and their displayed changes; they do not establish acceptance of later client
changes. The current-work record retains the dated evidence and next work.

## Start reading

- [Current work](docs/CURRENT_WORK.md): accepted capabilities, evidence limits and active task.
- [Product roadmap](docs/PRODUCT_ROADMAP.md): Android-first delivery order and longer-term goals.
- [Architecture](docs/ARCHITECTURE.md): runtime profiles, module ownership and trust boundaries.
- [Agent instructions](AGENTS.md): repository working rules and verification.
- [AI context guide](docs/AI_CONTEXT.md): reading current source and the pending Repomix integration.

The [capability guide](docs/CAPABILITY_STATUS.md) retains the broader local-app
inventory. [Historical README](docs/history/README-2026-10-03.md),
[build history](docs/BUILD_ROADMAP.md) and [ADRs](docs/adr/) preserve earlier work;
they do not override the current managed status.

## Run the synthetic demo

Use Node.js 24 within the range in [package.json](package.json) and pnpm 11.19.0.
The current CI uses the pinned Node 24 toolchain. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open `http://localhost:3000/research/SYN1`; the Fastify API listens on
`http://127.0.0.1:3100`. This is the invented demo, not the deployed managed app.
Do not enable personal-workspace environment variables for this startup. Keep
ports free rather than restarting an unrelated local service.

Production credentials and signing material are not included. Local personal
startup has separate catalog, vault and account prerequisites described in the
[local login guide](docs/LOCAL_OWNER_LOGIN.md) and
[local company research guide](docs/PERSONAL_COMPANY_RESEARCH.md). Do not point
synthetic tests at an existing personal vault or initialize over saved data.

Managed setup is explicit: [watchlist storage](docs/APPWRITE_WATCHLIST.md),
[managed catalog](docs/MANAGED_SECURITY_CATALOG.md),
[Annual report](docs/MANAGED_SEC_ANNUAL.md),
[EOD close history](docs/MANAGED_EOD_HISTORY.md),
[selected Markets home](docs/MANAGED_MARKETS_HOME.md),
[website delivery](docs/APPWRITE_DELIVERY.md) and
[Android build profiles](docs/ANDROID_CLIENT.md). A public configuration or
successful build does not grant account access or permission to deploy.

## Verify a change

Start with the affected tests and types. For example:

```sh
pnpm --filter @research-cockpit/web exec vitest run src/clerk-trial/managed-eod-history.test.ts
pnpm --filter @research-cockpit/web typecheck
pnpm --filter @research-cockpit/api typecheck
```

The full local verification entry point is:

```sh
pnpm verify
```

It includes formatting, lint, boundary/fixture/license checks, types, peer
validation, tests and builds, so it is broader than a focused edit check. Hosted
workflows add their own Windows, Linux, parser, custody, cross-engine and Android
requirements according to the actual change. See
[delivery source checks](docs/APPWRITE_DELIVERY.md#release-sequence). Passing local checks
alone does not establish deployment, provider coverage or a phone install.

Do not run signing, deployment, live-provider requests or a generated-assets sync
as an ordinary documentation or unit-test step. Preserve successful artifacts and
failed-attempt evidence; do not repeat terminal operations to collect another pass.

## Repository map

| Path                                | Responsibility                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web`                          | Next.js local/demo app, Vite managed client, shared React UI and Capacitor Android project |
| `apps/api`                          | Fastify local entry points and the separately built managed Appwrite function              |
| `packages/contracts`                | Public DTOs, exact identity and response validation                                        |
| `packages/personal-security-master` | Catalog identity, admission and search                                                     |
| `packages/local-research-vault`     | Encrypted local research persistence                                                       |
| `packages/personal-*-analytics`     | Shared financial and price calculations                                                    |
| `modules`                           | Research features and provider adapters                                                    |
| `scripts`                           | Boundaries, release classification, delivery and focused acceptance tooling                |
| `docs`, `specs`                     | Current guides, roadmap, feature specifications and dated decisions                        |

Never commit credentials, account identifiers used for private admission, owner
records, provider payloads, signing custody, local evidence or generated context
exports. This repository is public. Public application URLs and source revisions
are context, not authorization to use the configured services.
