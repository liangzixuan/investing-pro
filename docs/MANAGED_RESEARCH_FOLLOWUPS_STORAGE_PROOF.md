# Follow-ups storage qualification

The private Follow-ups proof prepares persistence checks for the complete daily
research workflow: author a question, save it, reopen it in a fresh invocation,
record a result and save again. It uses the existing Follow-ups repository,
versioned row store and bounded Appwrite transport with invented identities and
checks. It does not read an owner's Follow-ups, Watchlist or Portfolio.

The managed function already connects the Follow-ups route to its fixed
repository. There is no Follow-ups enable flag. Portfolio and valuation flags
do not control it. Source wiring does not establish the deployed schema, current
execution permissions or live persistence. Creating or changing the fixed
Follow-ups tables can affect the existing route and requires its own operational
scope.

## Existing qualification and replay boundary

The retained October 16 acceptance already qualified the fixed private v3
artifact `a4bf7fa6`, plan `8a381028`, on deployment
`6ad166846d0a6d6439a2`. All eleven phases passed with 131 counted store calls
and 130 recorded HTTP dispatches, within the combined ceiling of 156. The live
capacity case used 250,191 bytes. The two concurrent phases followed the admitted
`commit400` paths. This is acceptance of that exact invented-data storage proof;
it does not establish owner-account Save, physical-device use, every payload
length, a container restart or full product acceptance.

Keep that accepted evidence and its consumed authority. Do not repeat the proof
because a later checkout has older status text. The earlier v2 attempt passed
five phases and stopped at an unadmitted overlap response; its cause remains
unproven and its authority is consumed. Preserve that failure as history.

The builder's current data still selects the consumed v2 principals
`proof-followups-prestage-v2-a`, `-b` and `-size`, with plan
`b1f35ad067007bb7cc66de5a3bcdedad52a1605f1171ad614e741b280660f910`.
Its local build and notices checks are valid for their recorded scope. They do
not make this cohort eligible for another live run. Do not upload or execute it,
delete retained rows, replace principals or manufacture a new empty baseline.
Reuse the accepted v3 evidence only where source, dependencies and settings
match; keep any later differences explicit.

## Fixed proof scope

An empty, query-free `POST /proof/{phase}` selects one of eleven compiled phases.
The artifact fixes the target, two tables, three invented principals, commands,
catalogs and eighteen row locations. The request cannot supply a target,
principal, question, row or command. The function captures its platform execution
key before awaiting work. Reports exclude keys and raw upstream errors.

Run the phases in order. Stop on a refused, failed, incomplete or uncertain
result and reconcile its retained evidence before continuing.

| Phase         | Required observation                                                                                                                | Expected store calls | Store-call ceiling |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------: | -----------------: |
| Preflight     | All eighteen exact row locations are absent                                                                                         |                   18 |                 18 |
| Create        | Canonical save and original receipt replay; changed command with the same key refused                                               |                   10 |                 16 |
| Isolation     | Two invented principals retain independent current rows and receipts                                                                |                    9 |                 12 |
| Stale         | An old-version writer loses; the winning current row and original receipt remain                                                    |                   13 |                 16 |
| Prestage      | A writer held before increment cannot replace the concurrent winner                                                                 |                   16 |                 20 |
| Overlap       | Writers held before commit produce one winner                                                                                       |                   17 |                 20 |
| Rollback      | Interrupted receipt creation acknowledges rollback and preserves current-row bytes and metadata                                     |                   10 |                 12 |
| Unknown       | A locally suppressed acknowledged commit reconciles through its original receipt without another commit                             |                    9 |                 12 |
| Reopen        | A fresh invocation reads the saved check and replays its original receipt                                                           |                    2 |                  2 |
| Capacity      | The fixed twenty-entry, 250,191-byte payload round-trips; an oversized payload is refused before store access                       |                    8 |                 12 |
| Domain guards | Future completion, changed stable identity and old-clock writes are refused; original replay and retained evidence remain available |                   16 |                 16 |

The complete sequence expects 128 counted store calls, with combined ceilings
of 156. Each phase retains its eleven-second deadline and bounded transaction
cleanup. These are the existing proof limits. They do not grant permission for
external calls or establish available quota. Capacity checks the fixed payload;
it does not test every byte length up to the 256 KiB contract ceiling.

Preflight proves row absence only. It does not verify table existence, schema
column limits, empty client grants, row security, execution-key scope or the
current product deployment. Do not delete conflicting rows, replace fixed
principals or replay completed phases to manufacture an empty baseline.

## Local artifact admission

Use the fixed Node 24 builder without arguments:

```sh
node --import tsx scripts/research-followups/build-proof.ts
```

The builder creates a unique artifact under `dist/managed-followups-proof/`.
Its build identity binds source, installed builder code and executable, fixed
commands and catalogs, complete module graph and runtime notices. Discovery and
final builds must have the same graph. Required proof modules must be present;
unrelated execution modules, unreviewed runtime packages and unknown external
imports are refused. Existing source and graph size limits remain in force.

The runtime graph admits only the fixed installed versions of node-appwrite,
Undici, json-bigint and bignumber.js. Their package manifests, complete license
files and reviewed embedded notices are retained and rechecked. Legal comments
remain in the unminified bundle. `THIRD_PARTY_NOTICES.txt` records the complete
runtime notices beside `main.js`, `package.json` and `build-proof.json`.
Frontend fonts and icons are outside this proof graph.

Building the artifact does not import its entry or run a storage phase. The
local artifact check must inspect its actual hashes, graph, required modules,
runtime package roots and notices without invoking the exported function.
Source tests and a local build establish only their recorded synthetic scope.

## Operational acceptance

Before any live action, prepare an exact artifact and staged delivery scope.
Separately establish current table schema and limits, row security, empty client
grants, least required execution scope, available quota and zero additional cost.
Keep the existing public function, owner rows and unrelated resources intact.

Schema changes, private function deployment, phase execution and product
publication need their action-specific authority. Existing Android update
authority and an earlier Portfolio or valuation release do not authorize them.
No local build result proves that live Follow-ups storage is ready or enabled.
Physical-device use and owner-account Save remain separate observations.
