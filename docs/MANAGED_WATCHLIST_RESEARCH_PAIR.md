# Compare two watched companies

The source candidate adds a complete research comparison directly to My
Watchlist. It uses the exact watched listings and existing Research controls.
Choosing a pair makes no source request and does not run an Annual screen.

## Workflow

1. Load My Watchlist and finish its current-catalog identity review. Finish
   resource recovery, file review and pending navigation.
2. Choose two distinct listings, then preview their complete identities and
   start the pair. Two share classes of the same issuer remain distinct. All
   Watchlist entries remain reachable through the 25-row pages.
3. Open either company from the pair. Use the existing explicit source controls
   and authored valuation inputs. An unsupported or missing source remains
   visible. Retaining a reading requires at least one admitted response or an
   authored calculation.
4. Retain the complete reading, then use owned Back to return to My Watchlist.
   Repeat for the other company. Before switching valuation inputs, save or
   explicitly discard the previous company's editor state as required.
5. Inspect both readings. Each keeps its own fiscal periods, source clocks,
   authored thesis, assumptions, results and refusals. A later source refresh
   does not replace a retained reading. Explicit recapture replaces one side.
6. Open the chosen company's current Research to edit its thesis or prepare a
   dated check. Save Watchlist, Follow-ups and valuation inputs separately.
   Explicit fresh Loads confirm the saved resources.

Clear a reading or end the pair without changing a saved resource or draft.
The pair stays in memory only. It does not rank the companies, align reporting
periods or give a retained reading authority to edit inputs, make requests or
save anything.

## Lifetime

A fresh, settled Watchlist Load is required to start. Once started, the pair
keeps its identities through note edits and ordinary confirmed Saves, including
the coordinator's replacement of the saved draft. Current actions become
unavailable during pending work and must use the new settled state.

Load or recovery ends the pair. Membership additions, removals, reordering or
identity changes also end it, even if both selected listings remain. Catalog,
session and file-operation changes retire its authority. Restoring equal values
cannot revive an old action.

Owned Research, section changes and Back preserve the readings. A foreign
company visit or leaving My Watchlist ends the pair. Source, calculation and
navigation completions cannot silently capture another company or move focus.

## Implementation and acceptance

`managed-watchlist-research-pair.ts` owns selection, pair lifetime and captures.
`passive-company-research.ts` holds the existing bounded detached-copy operation
shared with screen comparisons. The Watchlist interface reuses the complete
reading presenter. Workspace navigation owns the current company visit; URL
state does not own the retained data.

The saved schemas, source coverage, quotas, API and deployment are unchanged.
Model, rendered, workspace and native workflow checks cover their specified
boundaries. Current source and Android acceptance are recorded in
[Current work](CURRENT_WORK.md); physical-phone acceptance remains separate.
