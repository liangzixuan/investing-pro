# Release classification

The release-classification generator prepares the existing filing-parser,
payload-custody and cross-engine routing adapters from one reviewed descriptor.
It keeps release identities, change inventories and routing text consistent
without replacing historical evidence checks or broadening non-evidence routes.
Classification describes source topology; it does not establish that a native
gate, hosted workflow or source acquisition passed.

## Commands

Run these commands from the repository root:

```powershell
pnpm release:classify --descriptor ../tmp/next-release.json
pnpm release:classify --descriptor ../tmp/next-release.json --write
pnpm test:release-classification
pnpm guardrails:release-classification
```

The first command checks whether all nine outputs match regeneration and writes
nothing. Before generation it normally reports stale or missing outputs; it
does not prepare a preview file. Writing requires the explicit `--write` flag
and a clean working tree at the descriptor's exact committed feature revision.
Keep the input JSON outside the repository so preparing it does not dirty that
feature commit. The generator does not commit, push, launch the app or acquire
provider data.

The guardrail, also available as `pnpm release:classify` without arguments,
regenerates the installed latest registry entry and checks its outputs for
drift. Missing registry entries are allowed only at the pinned bootstrap
predecessor or its immediate feature child. The manual a14 routing closure
installs the first entry; later checks require the contiguous registry.

## Descriptor contract

Use strict JSON with exactly the following fields. Revision values are distinct,
nonzero, full lowercase Git commit hashes; paths are repository-relative.

| Field                 | Meaning                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `version`             | Exactly `1`.                                                                                        |
| `caseNumber`          | Integer suffix in `cycle3kaN`, from `14` through `64`; generated writes start at `15`.              |
| `baselineRevision`    | Fixed historical baseline `62c01dafe305ddd43c75688e0225163b3abdf6df`.                               |
| `predecessorRevision` | The preceding committed routing closure; its validation outcome is recorded separately.             |
| `featureRevision`     | The committed feature whose routing closure is being prepared.                                      |
| `featureCount`        | The feature's commit count after the fixed baseline: `101 + 2 * caseNumber`.                        |
| `closureCount`        | The next routing closure's commit count after the baseline: `featureCount + 1`.                     |
| `featureChanges`      | Exact feature inventory, with one `{ "path": "…", "status": "A" }` or `"M"` entry per changed path. |
| `closureChanges`      | Exact inventory of the nine generated closure outputs.                                              |
| `descriptorPath`      | Registry output `scripts/release-classification/releases/cycle3kaN.json` for this case.             |
| `presentation`        | The six routing and test-description fields below.                                                  |

`presentation` contains `featureDescription`, `closureDescription`,
`inventoryDescription`, `testBinding`, `routingDescription` and
`summaryDescription`. These provide the existing adapters' descriptions and
test binding; they do not declare additional validation or execution evidence.
Use short plain descriptions, at most 240 characters each. `testBinding` must
start with a lowercase letter and contain only letters and digits.

The input is limited to 64,000 bytes, with at most 256 feature paths. Inventories
must be sorted by path and unique even when case is ignored. Only additions and
modifications are supported; duplicate JSON keys, unknown fields, unsafe paths
and unsupported statuses fail validation. Feature changes cannot include the
eight adapters or release registry. Changes to `scripts/release-classification*`
require independent manual release preparation, so `--write` rejects them.

Full Git history is required. The descriptor binds identities, matching total
and first-parent counts, and exact inventories to that history. Each feature
must be a single-parent commit directly after its predecessor; each closure must
be directly after its feature, with no merge parents. Prior registry entries
are checked back to a14. Do not infer the feature count from the number of files,
omit an unrelated changed file to force classification, or relax an inventory
after a check fails. A changed feature commit requires a fresh descriptor with
its new identity.

The generator does not place its future closure hash inside its own output.
The descriptor is added in the closure commit, after the feature hash is known.
The following release can then pin that completed closure as its predecessor.

## Bootstrap and generated outputs

The initial case, **a14**, uses a manual bootstrap closure. Its predecessor is
the accepted owner-login release
`9edb8cbe47b9847ff1264a1e04507738dfaf3d3c`; its feature and closure counts are
`129` and `130`. The generator supports writing **a15 through a64**. It does not
rewrite a14 or retrofit descriptors into earlier accepted releases.

Each generated closure modifies these eight adapters:

- `.github/workflows/filing-parser-acceptance.yml`
- `.github/workflows/filing-parser-cross-engine-execution-acceptance.yml`
- `.github/workflows/filing-payload-custody-acceptance.yml`
- `packages/filing-parser/src/filing-parser-evidence-verifier.test.ts`
- `packages/filing-parser/src/filing-parser-evidence-verifier.ts`
- `packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.test.ts`
- `packages/filing-payload-custody/src/filing-payload-custody-evidence-verifier.ts`
- `scripts/classify-filing-parser-cross-engine-source.sh`

It also adds `scripts/release-classification/releases/cycle3kaN.json`. These are
the complete nine-file output inventory: eight `M` entries and one `A` entry.
Keep product changes, new generator behavior and unrelated documentation outside
the routing closure.

## Release sequence and verification

1. Finish the feature, review its complete diff and run its focused checks.
   Commit the feature and record its full hash and preceding closure hash.
2. Prepare the external descriptor from that committed Git history. Run the
   default read-only check and inspect the declared nine-file inventory. Stale
   or missing outputs are expected before generation; resolve descriptor and
   Git-history errors before writing.
3. At the clean feature HEAD, run the same command with `--write`. Review all
   generated changes, rerun the read-only check, run the focused generator tests
   and installed-registry guardrail, and commit the routing closure separately.
4. Verify the clean release candidate with the unchanged native gate in an
   isolated verification clone. Push the verified candidate and inspect the
   applicable hosted results. Record actual outcomes separately from generated
   routing classifications.

The focused tests include an independent PP&E golden fixture extracted from
immutable accepted Git objects, plus strict rejection cases. Expected historical
outputs must not be recreated from the renderer under test. Golden comparison
checks compatibility with the accepted PP&E adapters; it does not rerun PP&E
source coverage or make a new financial-data claim.

The generator remains a bounded release-maintenance tool. Changes to its routing
policy, descriptor schema or historical acceptance behavior need their own
reviewed feature and tests. Return to the next financial-screening outcome after
this workflow is accepted; see [current work](./CURRENT_WORK.md).
