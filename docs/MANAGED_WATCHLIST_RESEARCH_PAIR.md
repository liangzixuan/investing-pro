# Compare two watched companies

The application provides a complete research comparison directly in My
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
   does not replace a retained reading. Review an updated reading before replacing
   one side.
6. Open the chosen company's current Research to edit its thesis or prepare a
   dated check. Save Watchlist, Follow-ups and valuation inputs separately.
   Explicit fresh Loads confirm the saved resources.

Clear a reading or end the pair without changing a saved resource or draft.
The pair stays in memory only. It does not rank the companies, align reporting
periods or give a retained reading authority to edit inputs, make requests or
save anything.

## Review an updated reading

Open a company from the pair and use its normal source, note and calculation
controls. Choose **Review updated company reading** to inspect the complete
previous and updated readings. Both retain exact identities, notes, inputs,
results, source states and independent dates. A new capture time does not mean
that a source was refreshed.

**Keep previous reading** discards the proposal. **Use updated reading** replaces
only that side with the exact previewed candidate. The other side stays unchanged.
The first capture needs no replacement review. Use owned Back to return to the
pair, then continue the separate thesis, dated-check and resource Save workflow.

Changes to the source, calculation, note, resource state or current visit withdraw
the proposal. Back also discards it. The retained readings keep their existing
lifetime rules below. A pending proposal cannot prepare a report; after Cancel or
Apply and Back, prepare a fresh report from the readings you kept. None of these
review actions requests a source, calculates a result or saves a resource.

## Keep a private offline report

After both readings are retained, choose **Prepare Watchlist research report**.
Open the complete preview to inspect the two listings, source disclosures,
valuation inputs and results, unsupported states, exact raw values and full JSON
payload. Each side keeps its original capture, calculation and source times.
The report identifies a Watchlist selection; it has no Annual-screen criteria.

Choose **Download Watchlist research (HTML)** in the browser, or **Save Watchlist
research (HTML)** on Android and choose a document destination. Cancelling the
picker preserves the pair and drafts. Clear report preview removes only that
preview. Browser confirmation means the download was requested; check the browser
destination for the file. A failed write can leave an incomplete chosen document.

The file contains both complete readings and no scripts or external assets. It
can be read after the in-memory comparison ends. Output must fit within 8 MiB of
UTF-8; oversized or malformed text is refused before destination selection.
Nothing is clipped. This private historical copy cannot restore inputs, create
a check or update an account.

A prepared report belongs to one settled resource and route state. Changes to
Watchlist, Follow-ups, Portfolio or saved valuation inputs, pending operations,
file activity, navigation, recapture, Clear or End withdraw its save authority.
Restoring equal values cannot revive it. Prepare again after the work settles.
The readings themselves can survive ordinary note edits and confirmed Saves;
to include a later note in the file, recapture that company first. Resource Save
and fresh Load remain separate from report delivery.

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

`OwnedReportController` shares capture, cancellation and delivery sequencing
with the Annual-screen paired report. Each consumer has its own admission,
payload and formatter. The browser and native adapters use the existing text
document mechanisms; Android checks the exact purpose, UTC filename, envelope,
CSP, style hash and UTF-8 size before writing.

The saved schemas, source coverage, quotas, API and deployment are unchanged.
Model, rendered, workspace and native workflow checks cover their specified
boundaries. Current source and Android acceptance are recorded in
[Current work](CURRENT_WORK.md); physical-phone acceptance remains separate.
