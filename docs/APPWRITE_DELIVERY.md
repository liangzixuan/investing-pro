# Appwrite delivery

The owner approved GitHub checks, Appwrite staging, BrowserStack against the
exact build, then production promotion. The pipeline packages the production
Clerk web client. The connected managed version adds Discover and the full
shared watchlist through a separate service. The accepted development APK
and local research workspace remain separate. Production Android, owner-data
migration and broader research features are later outcomes.

The production web demo completed this flow on September 30 at main `b2172d26`.
The [delivery status table](./CURRENT_WORK.md#delivery-status) records its site
and API deployment IDs and the separate authenticated desktop/Pixel evidence.
Subsequent source-only catalog work has not replaced those deployments.

## Release sequence

The `Appwrite site release` workflow has one manual start on `main`. Supply the
successful main CI run ID and its latest attempt. Leave **promote** off for a
staging-only release. Select it when the same tested artifact should also go to
the configured production site. No local terminal needs to remain open.

The successful Ubuntu CI job records the push's before/after revisions, changed
paths and workflow hashes. The delivery verifier reconstructs that inventory
from Git and checks the latest exact-revision runs and jobs for every applicable
release workflow. Missing, pending, failed or superseded checks stop deployment.
It performs one bounded observation, without polling or rerunning gates. After
the remaining checks finish, start a new release workflow using the current
successful CI attempt.

The pipeline then:

1. Builds the production Clerk client once with the full commit SHA embedded in the
   document. Packaging admits only its index and hashed JavaScript/CSS assets;
   it records file and archive hashes and enforces a 4 MiB compressed limit.
2. Uploads that archive to the fixed staging site without activation. It waits
   within a bounded deadline for a ready build, checks for an intervening site
   change, activates the candidate and confirms the site's active deployment ID.
3. Runs the BrowserStack staging preview check. The same bundle boots at the
   fixed staging origin and renders its frame, connected-workspace description and
   software notices without mounting either authentication SDK or the watchlist
   controller. The test requires one matching commit marker, desktop and narrow
   layouts, and no authentication or data requests. It accepts website delivery
   and the preview UI; authenticated watchlist behavior needs separate checks at
   the canonical production origin. No retries or additional platform sessions
   are added.
4. Records the artifact hashes, staging deployment and successful GitHub test
   step. If promotion was selected, a separate production job downloads those
   same bytes, checks their evidence and deploys them without rebuilding.

The Appwrite SDK creates a new deployment ID in each site. Promotion does not
mean the two sites share a deployment ID. Its receipt records the previous and
new active IDs. The public marker establishes document identity; artifact hashes
bind the uploaded bytes. This is not a measured trace of every CDN asset response.

GitHub Actions is the deployment controller. Do not also link these sites to an
auto-activating production Git branch. The obsolete automatic disconnected-preview
workflow is retired because it expected the previous page at this same staging
origin. The release workflow owns the current BrowserStack gate and keeps its
concurrency group to serialize releases. Historical preview results do not
establish acceptance of the Clerk client.

The workflow supplies the verified public Clerk publishable key, explicit
production environment, fixed API origin and source SHA. It packages only
`apps/web/dist/clerk-production`. Neither a backend key nor an account allowlist
belongs in this client. The canonical `https://app.investingpro.app` origin
mounts Clerk; the fixed staging origin is inert, and other production origins
are rejected. Staging does not expand the API's CORS or authorized-party list.

Before promoting the managed client, accept the separate managed API deployment,
private table schema, seven isolated transaction scenarios and bounded runtime
context checks. Bind the new API origin to actual Appwrite rule metadata before
placing it in the client configuration and workflow. Keep the accepted demo's
service, database and prior site deployment available. An inert staging preview
does not prove authenticated saves or a production native app.

## One-time configuration

Create GitHub environments `appwrite-staging` and `appwrite-production`. Restrict
each to `main`; use required reviewers for production where the repository plan
supports them. The workflow itself rejects other branches.

Each environment needs `APPWRITE_DEPLOY_KEY`, entered privately as an environment
secret. Create separate Appwrite project API keys with only `sites.read` and
`sites.write`; these scopes cover all sites in the project, so they are not
site-specific credentials. Do not reuse a data-service or owner-session key.
The existing repository BrowserStack secret names are already configured and
are supplied only to the browser-test step. No credential goes into the bundle,
command arguments, proof artifacts or source.

Staging is the existing project `6abac57a0007b7c1a671`, site
`6abadfd3003d87db016b`, at `investment-device-preview.appwrite.network`, using the
fixed NYC Appwrite endpoint. Production uses the separate Static/Other site
`investment-production` in that same project. Its public ID is configured in
the production environment variable `APPWRITE_PRODUCTION_SITE_ID`. The helper
rejects the staging ID as production. Preserve the site's current deployment as
the rollback target; source or site configuration alone does not establish a
new release.

Both sites must be enabled, use the static adapter, `index.html` fallback, no
Git integration and no function scopes. Deployment retention must be disabled
(`0`) so the previous accepted deployment remains available. The upload supplies
empty install/build commands and output directory `.`; it contains already-built
public files. Confirm that these resources fit the existing Education allowance;
this workflow never creates a paid service or changes the plan.

The signed-in local CLI does not authenticate a GitHub runner. This pipeline uses
the existing pinned `node-appwrite` SDK, which accepts a runtime key without a
credential file. The deployment transport fixes the endpoint/project, bounds
requests and body sizes, cancels expired work, suppresses upstream warning and
error payloads, and never retries uploads or activation.

## Failures and rollback

No production job runs after a failed staging test. A failed or uncertain upload
retains its receipt; do not blindly repeat a mutation to manufacture success.
If activation is uncertain, first compare the actual site's active deployment
with the retained previous/candidate IDs. If the new production build needs a
rollback, activate the recorded previous ready deployment in Appwrite and verify
the active ID and expected build. Do not delete that deployment to free space.
Automatic rollback is intentionally not claimed by this workflow.

Artifacts retain the tar archive, manifest and finite receipts for 30 days.
BrowserStack raw logs can contain capabilities/credentials and are never uploaded.
The acceptance record proves the GitHub runner's successful test step; independent
BrowserStack dashboard session inspection remains separate.

## Local and cloud acceptance

Run `pnpm test:delivery` for the root helper tests. CI runs this in addition to
its unchanged `pnpm verify` release gate; API helper and build-identity tests are
also part of their existing workspace test discovery. A static production build
and archive check establish local packaging only. Source review, tests and a
prepared workflow do not establish a successful cloud deployment.

The first disconnected staging/test/production flow completed on September 29
at `a3366e6`, with independent acceptance of the original production receipt.
Both GitHub environments are restricted to `main`; the configured production
review remains in place. The subsequent production synthetic API, private
storage scenarios and API domain checks are accepted separately. The Clerk
client delivery change still needs its own exact-revision checks, BrowserStack
result and production receipt. Workspace CURRENT records actual outcomes.
See the
[current filing acceptance contract](./CURRENT_FILING_ACCEPTANCE.md) for the
CI provenance repair prompted by PR 11. Backend
functions, schema migrations, storage proofs and Android signing are not
performed by this static-site workflow.

## References

- [Appwrite Sites deployments](https://appwrite.io/docs/products/sites/deployments)
- [Appwrite Git deployment behavior](https://appwrite.io/docs/products/sites/deploy-from-git)
- [Server Sites API](https://appwrite.io/docs/references/cloud/server-nodejs/sites)
- [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
